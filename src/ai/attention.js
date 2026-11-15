// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Aviso cuando la IA espera tu aprobación (RF-59, del REQ-115 de dbv-unreal-ai): si la ventana
// no tiene el foco, su icono parpadea en la barra de tareas (en macOS rebota en el Dock). Una
// sola vez por petición y nunca con la ventana ya delante. La decisión es pura; quien la usa
// llama a `requestUserAttention` y lo limpia al recuperar el foco.
// @spec RF-59

/**
 * @param {{ focused: boolean, requestId: string|number|null, lastNotifiedId: string|number|null }} state
 * @returns {boolean} `true` si hay que pedir atención para esta petición.
 */
export function shouldRequestAttention({ focused, requestId, lastNotifiedId }) {
  return !focused && requestId !== null && requestId !== undefined && requestId !== lastNotifiedId;
}

/**
 * Crea el avisador de una ventana. `win` es la ventana de Tauri (o un doble en los tests) con
 * `isFocused()` y `requestUserAttention(tipo|null)`.
 * @param {{ isFocused: () => Promise<boolean>, requestUserAttention: (type: number|null) => Promise<void> }} win
 * @param {number} informational Valor de `UserAttentionType.Informational` (2 en Tauri v2).
 */
export function createAttentionNotifier(win, informational = 2) {
  let lastNotifiedId = null;
  let active = false;
  return {
    async notify(requestId) {
      let focused = true;
      try { focused = await win.isFocused(); } catch { focused = true; }
      const notify = shouldRequestAttention({ focused, requestId, lastNotifiedId });
      if (notify) {
        lastNotifiedId = requestId;
        active = true;
        try { await win.requestUserAttention(informational); } catch { active = false; }
      }
      return notify;
    },
    /** Al recuperar el foco (o al resolverse la petición): deja de parpadear. */
    async clear() {
      if (!active) return;
      active = false;
      try { await win.requestUserAttention(null); } catch { /* la ventana puede estar cerrándose */ }
    },
  };
}
