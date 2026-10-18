// =============================================================================
// dbv-md-reader — Velocidad de respuesta del modelo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Funciones PURAS: tokens por segundo de una respuesta y cuándo merece la pena
// sugerir comprobar la GPU. Si el servidor informa de cuánto tardó en generar
// (`evalMs`, Ollama), se usa ese dato, que es exacto; si no, se mide desde que
// llegó el primer dato hasta el último (aproximado: no incluye la carga del
// modelo, pero un servidor que no informa puede colar cierto error).

/** Por debajo de esto, un modelo local casi seguro no está usando la GPU (orientativo). */
export const SLOW_TOKENS_PER_SECOND = 5;

/** Respuestas más cortas que esto no dan una medida fiable. */
export const MIN_TOKENS_TO_JUDGE = 20;

/**
 * @param {{outputTokens: number, evalMs?: number, wallMs?: number}} options
 *   `evalMs`: lo que informa el servidor; `wallMs`: del primer al último dato.
 * @returns {{tokensPerSecond: number, seconds: number, approximate: boolean}|null} `null` si no hay datos para medir.
 */
export function computeSpeed({ outputTokens, evalMs = 0, wallMs = 0 }) {
  const reported = evalMs > 0;
  const ms = reported ? evalMs : wallMs;
  const valid = outputTokens > 0 && ms > 0;
  return valid ? { tokensPerSecond: outputTokens / (ms / 1000), seconds: ms / 1000, approximate: !reported } : null;
}

/**
 * ¿Sugerir comprobar la GPU? Solo con un modelo local lento, una vez por conversación.
 * @param {{speed: ReturnType<typeof computeSpeed>, outputTokens: number, local: boolean, alreadyHinted: boolean}} options
 */
export function shouldHintSlow({ speed, outputTokens, local, alreadyHinted }) {
  return Boolean(speed) && local && !alreadyHinted && outputTokens >= MIN_TOKENS_TO_JUDGE && speed.tokensPerSecond < SLOW_TOKENS_PER_SECOND;
}

/** «12,3 tok/s» (con «~» si es aproximado) y duración en segundos, para el panel. */
export function formatSpeed(speed) {
  const rate = speed.tokensPerSecond >= 10 ? Math.round(speed.tokensPerSecond) : Math.round(speed.tokensPerSecond * 10) / 10;
  return { rate: `${speed.approximate ? '~' : ''}${rate}`, seconds: speed.seconds >= 10 ? String(Math.round(speed.seconds)) : (Math.round(speed.seconds * 10) / 10).toString() };
}
