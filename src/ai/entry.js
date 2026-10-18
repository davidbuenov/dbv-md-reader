// =============================================================================
// dbv-md-reader — Entrada de la IA: lo ÚNICO que se descarga al abrirla (RNF-IA.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `app.js` (script clásico) importa este módulo con `import()` solo cuando el
// usuario pulsa el botón del Asistente, usa su atajo, o abre un menú que ofrece
// la IA en línea y ya hay una IA conectada. Sin eso, ni este fichero ni
// `aiApp.js`, ni su hoja de estilos ni sus textos se piden: la app arranca igual
// que una sin IA.

import * as backend from './backend.js';

/** Hoja de estilos de la IA: se inyecta una sola vez, con la IA. */
function ensureStyles() {
  if (document.getElementById('ai-styles')) return;
  const link = document.createElement('link');
  link.id = 'ai-styles';
  link.rel = 'stylesheet';
  link.href = 'ai/ai.css';
  document.head.appendChild(link);
}

/** Conexiones guardadas (un fichero local), o la lista vacía si no se pueden leer. */
export async function readConnections() {
  const loaded = await backend.aiConnections();
  return loaded.ok ? loaded.value : { connections: [], active: null, showAi: true };
}

/**
 * Crea la aplicación de IA sobre `host` (ver `window.DBVAiHost` en `app.js`).
 * @returns {Promise<ReturnType<import('./aiApp.js').createAiApp>>}
 */
export async function createAi(host) {
  ensureStyles();
  const [{ createAiApp }, initialFile] = await Promise.all([import('./aiApp.js'), readConnections()]);
  return createAiApp({ backend, host, initialFile });
}
