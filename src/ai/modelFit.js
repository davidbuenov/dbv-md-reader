// =============================================================================
// dbv-md-reader — ¿Le basta este modelo a la IA?
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Funciones PURAS (sin DOM ni red) que deciden si un modelo local es demasiado
// pequeño y si su ventana de contexto es demasiado corta para que el asistente
// con herramientas funcione. Los números son estimaciones medidas con
// `estimateTokens` (el sistema ≈313 tokens, las herramientas ≈631): el test de
// `tools.test.js` avisa si las herramientas crecen y esto queda desfasado.

import { RESPONSE_RESERVE } from './context.js';

/** Contexto que se supone cuando ni la conexión ni el proveedor lo dicen (el prudente de ADR-V0130-002). */
export const DEFAULT_CONTEXT_TOKENS = 8192;

/** Por debajo de esto (en miles de millones de parámetros) un modelo suele fallar al proponer cambios. */
export const SMALL_MODEL_BILLIONS = 7;

/** Fracción de la ventana que se llena; el resto es holgura (la usa `aiApp.contextBudget`). */
export const CONTEXT_FILL_RATIO = 0.8;

/** Tokens de las definiciones de las herramientas, que viajan en cada petición (las cinco de md-reader: listar, leer, buscar, proponer y comprobar; estimado, se mide en /test). */
export const TOOL_SPEC_TOKENS = 600;

/** Contexto automático básico: árbol de ficheros, fichero activo recortado, problemas y esquema. */
export const BASIC_CONTEXT_TOKENS = 1500;

/** Lo que añaden los resultados de las herramientas dentro de un turno (leer un trozo de fichero, buscar). */
export const LOOP_ALLOWANCE_TOKENS = 2500;

/** Reserva extra cuando el modelo razona: el razonamiento también gasta ventana. */
export const REASONING_RESERVE_TOKENS = 2048;

/** Ventana con la que el asistente trabaja con holgura (varios ficheros, historial y razonamiento). */
export const RECOMMENDED_CONTEXT = 16384;

/**
 * Tokens que el asistente puede gastar en contexto (instrucciones, fichero, historial…) con una ventana de
 * `contextTokens`: la fracción que se llena, menos la reserva de respuesta y las definiciones de las herramientas,
 * que viajan en cada petición.
 * @param {{contextTokens: number, tools?: boolean}} options
 */
export function contextBudget({ contextTokens, tools = true }) {
  return Math.floor(contextTokens * CONTEXT_FILL_RATIO) - RESPONSE_RESERVE - (tools ? TOOL_SPEC_TOKENS : 0);
}

/**
 * Parámetros, en miles de millones, de un tamaño tal cual lo da Ollama
 * («8.2B», «494M», «1.5T»). `null` si no se entiende.
 * @param {string|null|undefined} text
 * @returns {number|null}
 */
export function parseParameterSize(text) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([KMBT])\s*$/i.exec(String(text ?? ''));
  const factors = { K: 1e-6, M: 1e-3, B: 1, T: 1e3 };
  return match ? Number(match[1]) * factors[match[2].toUpperCase()] : null;
}

/**
 * ¿Es un modelo pequeño? Si el tamaño no se conoce, no se afirma nada.
 * @param {{parameterSize?: string|null}|null|undefined} info Lo que da `ai_model_info`.
 */
export function isSmallModel(info) {
  const size = parseParameterSize(info?.parameterSize);
  return size !== null && size < SMALL_MODEL_BILLIONS;
}

/**
 * Contexto mínimo con el que el asistente funciona y el recomendado.
 * @param {{systemTokens: number, tools?: boolean, reasoning?: boolean}} options
 * @returns {{minimum: number, recommended: number}}
 */
export function contextRequirements({ systemTokens, tools = true, reasoning = false }) {
  const fixed =
    systemTokens +
    (tools ? TOOL_SPEC_TOKENS + LOOP_ALLOWANCE_TOKENS : 0) +
    BASIC_CONTEXT_TOKENS +
    RESPONSE_RESERVE +
    (reasoning ? REASONING_RESERVE_TOKENS : 0);
  const minimum = Math.ceil(fixed / CONTEXT_FILL_RATIO / 1024) * 1024;
  return { minimum, recommended: Math.max(RECOMMENDED_CONTEXT, minimum) };
}

/**
 * ¿Se puede fijar el razonamiento desde DBV con este proveedor y modelo?
 *  · `available`: Ollama (`think`) y un servidor compatible genérico (`enable_thinking`);
 *  · `unsupported`: Ollama dice que el modelo no razona;
 *  · `unavailable`: el resto de proveedores, donde DBV no puede fijarlo.
 * @param {{provider: string, info?: {capabilities?: string[]}|null}} options
 * @returns {'available'|'unsupported'|'unavailable'}
 */
export function reasoningControl({ provider, info }) {
  let control = 'unavailable';
  if (provider === 'ollama') control = info?.capabilities && !info.capabilities.includes('thinking') ? 'unsupported' : 'available';
  else if (provider === 'openAiCompatible') control = 'available';
  return control;
}

/**
 * Todo lo que merece un aviso de este modelo y esta conexión.
 * @param {{info?: object|null, contextTokens: number, tools?: boolean, reasoning?: boolean, systemTokens: number}} options
 * @returns {{small: string|null, shortfall: ReturnType<typeof contextShortfall>, exceedsMax: number|null}}
 */
export function modelAdvice({ info, contextTokens, tools = true, reasoning = false, systemTokens }) {
  const requirements = contextRequirements({ systemTokens, tools, reasoning });
  const max = info?.contextLength ?? null;
  return {
    small: isSmallModel(info) ? info.parameterSize : null,
    shortfall: contextShortfall({ contextTokens, requirements }),
    exceedsMax: max && contextTokens > max ? max : null,
  };
}

/**
 * Si la ventana de la conexión es menor que el mínimo, los números para avisar; si no, `null`.
 * @param {{contextTokens: number, requirements: {minimum: number, recommended: number}}} options
 * @returns {{have: number, minimum: number, recommended: number}|null}
 */
export function contextShortfall({ contextTokens, requirements }) {
  return contextTokens < requirements.minimum ? { have: contextTokens, ...requirements } : null;
}
