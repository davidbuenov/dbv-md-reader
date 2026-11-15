// =============================================================================
// dbv-tauri-starter — Guía de conexión de IAs dentro de la aplicación
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Muestra la guía «Usar una IA con …»: la misma en todas las apps DBV, porque su
// texto (`guideContent.js`) lo genera `scripts/sync-ai.mjs` desde la plantilla común
// de dbv-specs-ops. Funciona sin conexión y corresponde a la versión instalada.
// Se carga solo al abrirla (import dinámico desde el asistente de conexión).
//
// Seguridad: el Markdown se pinta con `markdown.js` (nodos, sin `innerHTML`); los
// enlaces externos se abren en el navegador del sistema y los `#ancla` se siguen
// dentro de la propia ventana. Nada navega el WebView.

import { getLanguage, t } from './i18nBridge.js';
import { renderMarkdown } from './markdown.js';
import { GUIDE } from './guideContent.js';

/** Secciones a las que se puede saltar directamente (anclas de la guía, por idioma). */
export const GUIDE_SECTIONS = {
  subscription: { es: '3-con-tu-suscripción-agentes-instalados', en: '3-with-your-subscription-installed-agents' },
  antigravity: { es: 'google-antigravity-instalar-su-servidor-acp', en: 'google-antigravity-installing-its-acp-server' },
  copilot: { es: 'github-copilot-el-comando-copilot-de-vs-code-no-es-la-cli', en: 'github-copilot-vs-codes-copilot-command-is-not-the-cli' },
  problems: { es: 'problemas-frecuentes', en: 'common-problems' },
};

/** Texto de la guía en `lang` (español si no hay traducción). */
export function guideText(lang) {
  return GUIDE[lang] ?? GUIDE.es;
}

/** Lleva la vista al encabezado `anchor` dentro de `container`. `false` si no existe. */
export function scrollToAnchor(container, anchor) {
  const target = [...container.querySelectorAll('[data-anchor]')].find((node) => node.dataset.anchor === anchor);
  target?.scrollIntoView({ block: 'start' });
  return Boolean(target);
}

/** Botón «Copiar» bajo cada bloque de órdenes, para pegarlas en la terminal. */
function copyButton(code) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--compact button--ghost ai-guide__copy';
  button.textContent = t('ai.copy');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = t('ai.copied');
    } catch {
      button.textContent = '✕';
    }
    setTimeout(() => {
      button.textContent = t('ai.copy');
    }, 1500);
  });
  return button;
}

/**
 * Pinta la guía en `container` (sirve también para la pestaña de ayuda de una app).
 * @param {HTMLElement} container
 * @param {object} [options]
 * @param {keyof GUIDE_SECTIONS} [options.section] Sección a la que saltar.
 * @param {string} [options.lang] Idioma; por defecto, el de la interfaz.
 * @param {(url: string) => void} [options.openExternalUrl] Abre un enlace en el navegador del sistema.
 */
export function renderGuide(container, { section, lang = getLanguage(), openExternalUrl } = {}) {
  const body = document.createElement('div');
  body.className = 'md ai-guide__body';
  body.append(renderMarkdown(guideText(lang), {
    onExternalLink: (url) => openExternalUrl?.(url),
    onAnchorLink: (anchor) => scrollToAnchor(body, anchor),
    codeActions: (code) => [copyButton(code)],
  }));
  container.replaceChildren(body);
  const anchor = section ? GUIDE_SECTIONS[section]?.[lang === 'en' ? 'en' : 'es'] : null;
  // Tras pintar (en un entorno sin requestAnimationFrame, como los tests, en la siguiente vuelta).
  if (anchor) (globalThis.requestAnimationFrame ?? setTimeout)(() => scrollToAnchor(body, anchor));
  return body;
}

/**
 * Abre la guía en una ventana propia sobre la aplicación. `Esc` o ✕ la cierran.
 * @param {object} [options] Las de `renderGuide`.
 * @returns {{close: () => void, element: HTMLElement}}
 */
export function openGuide(options = {}) {
  document.querySelector('.ai-guide')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'ai-guide';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', t('ai.guideTitle'));
  const card = document.createElement('div');
  card.className = 'ai-guide__card';
  const header = document.createElement('div');
  header.className = 'ai-guide__header';
  const title = document.createElement('h2');
  title.className = 'ai-guide__title';
  title.textContent = t('ai.guideTitle');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'button button--compact button--ghost ai-guide__close';
  close.textContent = '✕';
  close.title = t('action.close');
  header.append(title, close);
  const content = document.createElement('div');
  content.className = 'ai-guide__content';
  card.append(header, content);
  overlay.append(card);
  document.body.append(overlay);
  renderGuide(content, options);

  function onKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dispose();
    }
  }
  function dispose() {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
  }
  close.addEventListener('click', dispose);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) dispose();
  });
  document.addEventListener('keydown', onKey, true);
  close.focus();
  return { close: dispose, element: overlay };
}
