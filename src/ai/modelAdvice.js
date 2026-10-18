// =============================================================================
// dbv-md-reader — Textos de los avisos de un modelo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { estimateTokens, systemPrompt } from './context.js';
import { DEFAULT_CONTEXT_TOKENS, modelAdvice } from './modelFit.js';

// El reemplazo es una FUNCIÓN: un valor que venga del proveedor (p. ej. el tamaño del modelo) con `$&` o `$1`
// no se interpreta como patrón de reemplazo.
const fill = (text, values) => Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, () => String(value)), text);
const thousands = (number) => new Intl.NumberFormat('es').format(number);

/**
 * Los avisos de `modelAdvice` como frases, en el idioma de la interfaz.
 * @param {{small: string|null, shortfall: object|null, exceedsMax: number|null}} advice
 * @param {(key: string) => string} t
 * @returns {string[]}
 */
export function describeAdvice(advice, t) {
  const messages = [];
  if (advice.small) messages.push(fill(t('ai.warnSmallModel'), { size: advice.small }));
  if (advice.shortfall) {
    messages.push(
      fill(t('ai.warnShortContext'), {
        have: thousands(advice.shortfall.have),
        minimum: thousands(advice.shortfall.minimum),
        recommended: thousands(advice.shortfall.recommended),
      }),
    );
  }
  if (advice.exceedsMax) messages.push(fill(t('ai.warnExceedsMax'), { max: thousands(advice.exceedsMax) }));
  return messages;
}

/**
 * Consulta de lo que Ollama sabe de un modelo (`ai_model_info`), compartida por el panel y el formulario. Recuerda
 * la petición EN VUELO (dos refrescos a la vez preguntan una sola vez) y las respuestas buenas; un fallo no se
 * recuerda: si el servidor estaba apagado, la próxima vez se vuelve a preguntar.
 * @param {(connection: object) => Promise<{ok: boolean, value?: object|null}>} askBackend
 * @returns {(connection: object) => Promise<object|null>} Lo que dice el modelo, o `null` si no se pudo saber.
 */
export function createModelInfoLookup(askBackend) {
  const requests = new Map();
  return function lookup(connection) {
    const key = `${connection.provider}|${connection.baseUrl}|${connection.model}`;
    if (!requests.has(key)) {
      requests.set(
        key,
        askBackend(connection).then((result) => {
          if (!result.ok) requests.delete(key);
          return result.ok ? (result.value ?? null) : null;
        }),
      );
    }
    return requests.get(key);
  };
}

/**
 * Contexto con el que se pedirá al modelo: el de la conexión, si no el que trae su proveedor y si no el prudente.
 * @param {{contextTokens?: number|null}|null|undefined} connection
 * @param {{contextTokens?: number|null}|null|undefined} providerInfo
 */
export function effectiveContext(connection, providerInfo) {
  return connection?.contextTokens ?? providerInfo?.contextTokens ?? DEFAULT_CONTEXT_TOKENS;
}

/**
 * Los avisos de un modelo y una conexión, ya como frases: lo que comparten el formulario de conexión y el panel.
 * @param {{info: object|null, connection: object, providerInfo?: object|null, lang: string}} options
 * @param {(key: string) => string} t
 * @returns {string[]}
 */
export function adviceMessages({ info, connection, providerInfo, lang }, t) {
  const advice = modelAdvice({
    info,
    contextTokens: effectiveContext(connection, providerInfo),
    tools: connection.supportsTools !== false,
    reasoning: connection.reasoning === true,
    systemTokens: estimateTokens(systemPrompt({ lang, tools: true })),
  });
  return describeAdvice(advice, t);
}
