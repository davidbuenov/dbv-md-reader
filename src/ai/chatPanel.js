// =============================================================================
// dbv-md-reader — Panel de conversación con la IA (RF-33)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Solo interfaz: la cabecera (conexión activa, conversaciones, nueva), el
// destino de lo que se envía («Local» / «Nube: …»), el indicador de contexto
// con sus elementos quitables, los mensajes (Markdown seguro, con Copiar e
// Insertar en cada bloque de código), los pasos del asistente, las propuestas
// y el campo de texto con menciones `@`. Lo que hace cada acción lo decide
// `aiApp.js` a través de los callbacks.

import { t } from './i18nBridge.js';
import { looksLikeEdit } from './proposal.js';

/** Cada cuántos ms se pinta el razonamiento acumulado (agrupa los trozos que llegan muy seguidos). */
const THOUGHT_PAINT_MS = 40;
/** Con herramientas y sin ningún dato tras estos ms, «Esperando al modelo» pasa a «Preparando una propuesta». */
const PREPARING_AFTER_MS = 6000;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick, className = 'icon-button icon-button--small', title = '') {
  const node = el('button', className, label);
  node.type = 'button';
  if (title) node.title = title;
  node.addEventListener('click', onClick);
  return node;
}

/** `@ruta` que se está escribiendo justo antes del cursor, o `null`. */
export function mentionAt(text, cursor) {
  const before = text.slice(0, cursor);
  const match = before.match(/(^|\s)@([\w./-]*)$/);
  return match ? { query: match[2], start: cursor - match[2].length - 1 } : null;
}

/** Rutas mencionadas con `@` en un mensaje que existen en la carpeta del documento. */
export function mentionedPaths(text, files) {
  const found = new Set();
  for (const match of String(text ?? '').matchAll(/(?:^|\s)@([\w./-]+)/g)) {
    const path = match[1].replace(/[.,;:]+$/, '');
    if (files.includes(path)) found.add(path);
  }
  return [...found];
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.host
 * @param {object} deps.callbacks
 * @param {(target: HTMLElement, markdown: string) => void} deps.renderMarkdown El mismo render saneado (markdown-it + DOMPurify) que el documento.
 */
export function createChatPanel({ host, callbacks, renderMarkdown }) {
  host.replaceChildren();
  const header = el('div', 'ai-panel__header');
  const title = el('h2', 'ai-panel__title', t('ai.panelTitle'));
  const connection = el('select', 'form-row__input ai-panel__select');
  connection.setAttribute('aria-label', t('ai.connection'));
  connection.addEventListener('change', () => callbacks.onSelectConnection(connection.value));
  const conversations = el('select', 'form-row__input ai-panel__select');
  conversations.setAttribute('aria-label', t('ai.conversations'));
  conversations.addEventListener('change', () => callbacks.onSelectConversation(conversations.value));
  const newButton = button('＋', () => callbacks.onNewConversation(), 'icon-button icon-button--small', t('ai.newConversation'));
  const deleteButton = button('🗑', () => callbacks.onDeleteConversation(), 'icon-button icon-button--small', t('ai.deleteConversation'));
  const settingsButton = button('⚙', () => callbacks.onOpenSettings(), 'icon-button icon-button--small', t('ai.settings'));
  const closeButton = button('✕', () => callbacks.onClose(), 'icon-button icon-button--small', t('action.close'));
  const headerRow = el('div', 'ai-panel__row');
  headerRow.append(title, settingsButton, closeButton);
  const selectorsRow = el('div', 'ai-panel__row');
  selectorsRow.append(connection, conversations, newButton, deleteButton);
  header.append(headerRow, selectorsRow);

  const destination = el('div', 'ai-panel__destination');
  const warning = el('div', 'ai-panel__warning');
  const contextBar = el('div', 'ai-panel__context');
  contextBar.setAttribute('aria-label', t('ai.contextTitle'));
  const messages = el('div', 'ai-panel__messages');
  messages.setAttribute('aria-live', 'polite');
  messages.setAttribute('role', 'log');

  const composer = el('div', 'ai-panel__composer');
  const input = el('textarea', 'ai-panel__input');
  input.rows = 3;
  input.placeholder = t('ai.inputPlaceholder');
  input.setAttribute('aria-label', t('ai.inputPlaceholder'));
  const mentionList = el('div', 'ai-panel__mentions hidden');
  mentionList.setAttribute('role', 'listbox');
  const composerActions = el('div', 'ai-panel__composer-actions');
  const attachSection = button(t('ai.attachSection'), () => callbacks.onAttachSection(), 'button button--compact button--ghost');
  const attachments = el('span', 'ai-panel__attachments');
  const usage = el('span', 'ai-panel__usage');
  const speed = el('span', 'ai-panel__usage ai-panel__speed');
  const stopButton = button(t('ai.stop'), () => callbacks.onStop(), 'button button--compact hidden');
  const sendButton = button(t('ai.send'), () => send(), 'button button--primary button--compact');
  composerActions.append(attachSection, attachments, speed, usage, stopButton, sendButton);
  composer.append(mentionList, input, composerActions);
  host.append(header, destination, warning, contextBar, messages, composer);

  let files = [];
  let mentionIndex = 0;

  function send() {
    const text = input.value.trim();
    if (!text || sendButton.disabled) return;
    input.value = '';
    hideMentions();
    callbacks.onSend(text);
  }

  function hideMentions() {
    mentionList.classList.add('hidden');
    mentionList.replaceChildren();
  }

  function showMentions() {
    const mention = mentionAt(input.value, input.selectionStart);
    if (!mention) return hideMentions();
    const matches = files.filter((file) => file.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 8);
    if (!matches.length) return hideMentions();
    mentionIndex = Math.min(mentionIndex, matches.length - 1);
    mentionList.replaceChildren(
      ...matches.map((file, index) => {
        const option = button(file, () => pick(file), `ai-panel__mention${index === mentionIndex ? ' is-active' : ''}`);
        option.setAttribute('role', 'option');
        return option;
      }),
    );
    mentionList.classList.remove('hidden');
    return matches;
  }

  function pick(file) {
    const mention = mentionAt(input.value, input.selectionStart);
    if (!mention) return;
    input.value = `${input.value.slice(0, mention.start)}@${file} ${input.value.slice(input.selectionStart)}`;
    hideMentions();
    input.focus();
  }

  input.addEventListener('input', () => {
    mentionIndex = 0;
    showMentions();
  });
  input.addEventListener('keydown', (event) => {
    const open = !mentionList.classList.contains('hidden');
    if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      mentionIndex = Math.max(0, mentionIndex + (event.key === 'ArrowDown' ? 1 : -1));
      showMentions();
    } else if (open && (event.key === 'Enter' || event.key === 'Tab')) {
      event.preventDefault();
      mentionList.querySelectorAll('button')[mentionIndex]?.click();
    } else if (event.key === 'Escape' && open) {
      hideMentions();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });

  function scrollToEnd() {
    messages.scrollTop = messages.scrollHeight;
  }

  /**
   * El render saneado de la app ya añade «Copiar» y «Ajustar línea» a cada bloque de código; aquí se
   * suma «Insertar en el cursor». Un diff entero en el documento nunca es lo que se quiere: solo se copia.
   */
  function renderInto(node, markdown) {
    node.replaceChildren();
    renderMarkdown(node, markdown);
    node.querySelectorAll('pre').forEach((pre) => {
      const code = pre.querySelector('code')?.textContent ?? '';
      if (looksLikeEdit(code) || !code.trim()) return;
      const actions = pre.querySelector('.code-actions') ?? pre.appendChild(el('div', 'code-actions'));
      actions.append(button(t('ai.insert'), () => callbacks.onInsert(code), 'code-action-btn ai-insert-btn'));
    });
  }

  return {
    input,
    setFiles(list) {
      files = list;
    },
    setConnections(list, activeId) {
      connection.replaceChildren(...list.map((c) => new Option(`${c.name} · ${c.model}`, c.id, false, c.id === activeId)));
    },
    setConversations(list, activeId) {
      conversations.replaceChildren(...list.map((c) => new Option(c.title || t('ai.untitled'), c.id, false, c.id === activeId)));
    },
    /** Avisos del modelo activo: pequeño, contexto corto. Lista vacía = sin avisos. */
    setWarnings(list) {
      warning.replaceChildren(...list.map((text) => el('p', 'ai-advice', text)));
    },
    setDestination(text, cloud) {
      destination.textContent = text;
      destination.classList.toggle('ai-panel__destination--cloud', cloud);
    },
    /** Elementos del contexto (RF-33.2): cada uno se puede quitar. */
    setContext(items, onRemove) {
      contextBar.replaceChildren(el('span', 'ai-panel__context-label', t('ai.contextTitle')));
      for (const item of items) {
        const chip = el('span', `ai-chip${item.included ? '' : ' ai-chip--out'}${item.trimmed && item.included ? ' ai-chip--trimmed' : ''}`);
        chip.title = item.included ? (item.trimmed ? t('ai.chipTrimmed') : `~${item.tokens} tokens`) : t('ai.chipOut');
        chip.append(el('span', '', item.label));
        if (item.removable !== false) chip.append(button('×', () => onRemove(item.id), 'ai-chip__remove', t('ai.chipRemove')));
        contextBar.append(chip);
      }
    },
    setAttachments(list, onRemove) {
      attachments.replaceChildren(...list.map((item) => {
        const chip = el('span', 'ai-chip', item.label);
        chip.append(button('×', () => onRemove(item), 'ai-chip__remove', t('ai.chipRemove')));
        return chip;
      }));
    },
    /** El botón de adjuntar la sección visible solo tiene sentido con un documento abierto. */
    setCanAttachSection(can) {
      attachSection.classList.toggle('hidden', !can);
    },
    setBusy(busy) {
      sendButton.disabled = busy;
      stopButton.classList.toggle('hidden', !busy);
    },
    setUsage(text) {
      usage.textContent = text;
    },
    /** Tokens por segundo y tiempo de la última respuesta. */
    setSpeed(text) {
      speed.textContent = text;
    },
    clearMessages() {
      messages.replaceChildren();
    },
    /** Sugerencias de inicio (RF-33.4). */
    showSuggestions(list) {
      const box = el('div', 'ai-panel__suggestions');
      box.append(el('p', 'ai-panel__hint', t('ai.suggestionsTitle')));
      for (const text of list) box.append(button(text, () => callbacks.onSend(text), 'button button--compact ai-panel__suggestion'));
      messages.append(box);
    },
    addUser(text) {
      messages.append(el('div', 'ai-msg ai-msg--user', text));
      scrollToEnd();
    },
    /**
     * Burbuja del asistente; devuelve funciones para ir llenándola: el texto
     * (`append`/`finish`), el indicador de actividad y el bloque
     * plegable de razonamiento, que solo se muestra y nunca se guarda.
     */
    addAssistant(initial = '', { toolsOffered = false } = {}) {
      const bubble = el('div', 'ai-msg ai-msg--assistant md');
      const activityRow = el('div', 'ai-activity-row');
      const activityLine = el('div', 'ai-activity hidden');
      activityLine.setAttribute('role', 'status');
      // El contador de tiempo va aparte y fuera de la región `aria-live`: un segundo por segundo sería ruido.
      const activityTime = el('span', 'ai-activity__time hidden');
      activityTime.setAttribute('aria-hidden', 'true');
      activityRow.append(activityLine, activityTime);
      const thinkBox = el('details', 'ai-think hidden');
      const thinkSummary = el('summary', 'ai-think__summary');
      const thinkText = el('div', 'ai-think__text');
      // La lista de mensajes es `aria-live`: el razonamiento no se anuncia, solo el indicador de estado.
      thinkBox.setAttribute('aria-live', 'off');
      thinkBox.append(thinkSummary, thinkText);
      const body = el('div', 'ai-msg__body');
      bubble.append(activityRow, thinkBox, body);
      let text = initial;
      if (text) renderInto(body, text);
      messages.append(bubble);
      scrollToEnd();

      let activityKind = null;
      let thoughtStart = null;
      let thoughtSeconds = null;
      let timer = null;
      let pendingThought = '';
      let frame = null;
      let waitStart = null;
      let tick = null;
      let toPreparing = null;
      const stopTicking = () => {
        clearInterval(tick);
        clearTimeout(toPreparing);
        tick = null;
        toPreparing = null;
      };
      const paintWait = () => {
        activityTime.textContent = `${Math.max(0, Math.round((Date.now() - waitStart) / 1000))} s`;
      };
      const seconds = () => Math.max(0, Math.round((Date.now() - thoughtStart) / 1000));
      const flushThought = () => {
        if (frame !== null) clearTimeout(frame);
        frame = null;
        if (!pendingThought) return;
        thinkText.textContent += pendingThought;
        pendingThought = '';
        scrollToEnd();
      };
      const paintSummary = () => {
        thinkSummary.textContent = (thoughtSeconds === null ? t('ai.thinkingFor') : t('ai.thoughtFor')).replace('{s}', String(thoughtSeconds ?? seconds()));
      };

      const api = {
        text: () => text,
        append(chunk) {
          text += chunk;
          body.textContent = text;
          scrollToEnd();
        },
        /**
         * Qué está haciendo el modelo: `waiting`, `preparing`, `thinking`, `writing` o `null` (nada).
         * Mientras no llega nada (`waiting` y `preparing`) corre el tiempo transcurrido; con herramientas
         * y sin respuesta tras unos segundos pasa a `preparing`: un modelo local que escribe una llamada
         * larga a `propose_changes` no emite nada hasta terminarla (Ollama la entrega completa).
         */
        activity(kind) {
          if (kind === activityKind) return;
          activityKind = kind;
          stopTicking();
          activityLine.classList.toggle('hidden', !kind);
          activityLine.textContent = kind ? t(`ai.activity.${kind}`) : '';
          const counting = kind === 'waiting' || kind === 'preparing';
          activityTime.classList.toggle('hidden', !counting);
          if (!counting) {
            waitStart = null;
            return;
          }
          waitStart ??= Date.now();
          paintWait();
          tick = setInterval(paintWait, 1000);
          if (kind === 'waiting' && toolsOffered) toPreparing = setTimeout(() => api.activity('preparing'), PREPARING_AFTER_MS);
        },
        /** Un trozo de razonamiento: el bloque aparece abierto y se va llenando. */
        thinking(chunk) {
          if (thoughtStart === null) {
            thoughtStart = Date.now();
            thinkBox.classList.remove('hidden');
            thinkBox.open = true;
            paintSummary();
            timer = setInterval(paintSummary, 1000);
          }
          pendingThought += chunk;
          // Un modelo que razona emite cientos de trozos por segundo: se pintan agrupados.
          if (frame === null) frame = setTimeout(flushThought, THOUGHT_PAINT_MS);
        },
        /** El razonamiento terminó: se contrae a «Pensó durante N s». */
        endThinking() {
          if (thoughtStart === null || thoughtSeconds !== null) return;
          clearInterval(timer);
          flushThought();
          thoughtSeconds = seconds();
          thinkBox.open = false;
          paintSummary();
        },
        finish(final = text) {
          text = final;
          api.endThinking();
          api.activity(null);
          if (text.trim()) renderInto(body, text);
          else if (thoughtStart === null) bubble.remove();
          scrollToEnd();
        },
      };
      return api;
    },
    addStep(label) {
      messages.append(el('div', 'ai-step', `⋯ ${label}`));
      scrollToEnd();
    },
    addNote(text, tone = 'info') {
      messages.append(el('div', `ai-note ai-note--${tone}`, text));
      scrollToEnd();
    },
    addNode(node) {
      messages.append(node);
      scrollToEnd();
    },
    focus() {
      input.focus();
    },
  };
}
