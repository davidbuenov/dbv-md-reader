// =============================================================================
// dbv-md-reader — Permisos y cambios de un agente (RF-32.6, RF-32.7)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Dos tarjetas en la conversación:
//   · PERMISO: el agente pide editar, ejecutar o leer algo. Si es una edición,
//     se enseña el diff que trae la propia petición y si la comprobación de Markdown
//     (RF-34.3) lo da por bueno, ANTES de que se escriba (spike S-ACP). Nada se concede
//     por defecto: Permitir una vez, Permitir siempre en esta conversación o
//     Denegar, con los textos de las opciones que ofrece el agente.
//   · CAMBIOS EN DISCO: al acabar el turno, lo que el agente escribió (con
//     permiso o sin él) respecto al punto de restauración, con Deshacer por
//     fichero o todo.

import { t } from './i18nBridge.js';
import { diffRegions } from './diff.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Texto de cada tipo de opción de permiso (las del agente pueden venir en inglés). */
const OPTION_KEYS = { allow_once: 'ai.permAllowOnce', allow_always: 'ai.permAllowAlways', reject_once: 'ai.permReject', reject_always: 'ai.permRejectAlways' };

/** Diffs que trae una petición de permiso (`content: [{type: 'diff', path, oldText, newText}]`). */
export function permissionDiffs(params) {
  return (params?.toolCall?.content ?? []).filter((item) => item?.type === 'diff' && item.path);
}

function diffBlock(before, after) {
  const pre = el('pre', 'ai-hunk__diff');
  for (const region of diffRegions(before ?? '', after ?? '')) {
    if (region.type === 'equal') continue;
    for (const line of region.removed) pre.append(el('span', 'ai-hunk__del', `- ${line}\n`));
    for (const line of region.added) pre.append(el('span', 'ai-hunk__add', `+ ${line}\n`));
  }
  return pre;
}

/**
 * Tarjeta de permiso. Devuelve la tarjeta y una promesa con el `optionId`.
 * @param {object} params Los de `session/request_permission`.
 * @param {{toRelative: (abs: string) => string|null, check: (diffs: Array) => Promise<{fresh: Array}|null>, isDirty: (relative: string) => boolean}} deps
 */
export function createPermissionCard(params, { toRelative, check, isDirty }) {
  const card = el('div', 'ai-review ai-permission');
  const call = params?.toolCall ?? {};
  card.append(el('strong', '', t('ai.permTitle')), el('p', 'ai-permission__title', call.title ?? call.kind ?? ''));
  const command = call.rawInput?.command ?? call.rawInput?.cmd;
  if (command) card.append(el('pre', 'ai-hunk__diff', String(command)));
  const diffs = permissionDiffs(params);
  const outside = diffs.filter((diff) => toRelative(diff.path) === null);
  for (const diff of diffs) {
    const relative = toRelative(diff.path);
    const file = el('div', 'ai-file');
    file.append(el('div', 'ai-file__summary', relative ?? diff.path));
    if (relative && isDirty(relative)) file.append(el('p', 'ai-review__warn', t('ai.permDirty')));
    file.append(diffBlock(diff.oldText, diff.newText));
    card.append(file);
  }
  const status = el('p', 'ai-review__status');
  card.append(status);
  const actions = el('div', 'ai-review__actions');
  card.append(actions);

  let resolve;
  const decision = new Promise((done) => (resolve = done));
  const finish = (optionId, label) => {
    actions.replaceChildren(el('span', 'ai-review__done', label));
    resolve(optionId);
  };

  if (outside.length) {
    // RF-32.7: lo que sale de la carpeta del proyecto se deniega, con motivo.
    const reject = (params.options ?? []).find((option) => option.kind?.startsWith('reject'));
    status.textContent = t('ai.permOutside');
    finish(reject?.optionId ?? null, t('ai.permDenied'));
    return { card, decision };
  }
  if (diffs.length) {
    status.textContent = t('ai.checking');
    check(diffs).then((result) => {
      if (!result) status.textContent = t('ai.checkUnavailable');
      else {
        status.classList.add(result.fresh.length ? 'ai-review__status--error' : 'ai-review__status--ok');
        status.textContent = result.fresh.length ? t('ai.checkErrors').replace('{n}', String(result.fresh.length)) : t('ai.checkOk');
      }
    });
  }
  for (const option of params.options ?? []) {
    const button = el('button', `button button--compact${option.kind === 'allow_once' ? ' button--primary' : ''}`, OPTION_KEYS[option.kind] ? t(OPTION_KEYS[option.kind]) : option.name);
    button.type = 'button';
    button.title = option.name ?? '';
    button.addEventListener('click', () => finish(option.optionId, `${t('ai.permChosen')}: ${button.textContent}`));
    actions.append(button);
  }
  return { card, decision, cancel: () => finish(null, t('ai.stopped')) };
}

/**
 * Tarjeta de cambios hechos por el agente en disco durante el turno.
 * @param {Array<{path: string, before: string|null, after: string|null}>} changes
 * @param {{undo: (change: object) => Promise<boolean>, open: (relative: string) => void}} deps
 */
export function createChangesCard(changes, { undo, open }) {
  const card = el('div', 'ai-review');
  card.append(el('strong', '', t('ai.agentChangesTitle').replace('{n}', String(changes.length))));
  const undoAll = el('button', 'button button--compact', t('ai.undoAll'));
  undoAll.type = 'button';
  const rows = [];
  for (const change of changes) {
    const row = el('details', 'ai-file');
    const summary = el('summary', 'ai-file__summary');
    const kind = change.before === null ? 'create' : change.after === null ? 'delete' : 'modify';
    summary.append(el('span', `ai-file__kind ai-file__kind--${kind}`, t(`ai.kind.${kind}`)), el('span', 'ai-file__path', change.path));
    const body = el('div', 'ai-file__body');
    body.append(diffBlock(change.before, change.after));
    const tools = el('div', 'ai-file__tools');
    const undoButton = el('button', 'button button--compact', t('ai.undo'));
    undoButton.type = 'button';
    undoButton.addEventListener('click', async () => {
      undoButton.disabled = true;
      if (await undo(change)) undoButton.textContent = t('ai.undone');
      else undoButton.disabled = false;
    });
    tools.append(undoButton);
    if (change.after !== null) {
      const openButton = el('button', 'button button--compact button--ghost', t('ai.openFile'));
      openButton.type = 'button';
      openButton.addEventListener('click', () => open(change.path));
      tools.append(openButton);
    }
    body.append(tools);
    row.append(summary, body);
    rows.push(undoButton);
    card.append(row);
  }
  undoAll.addEventListener('click', () => {
    undoAll.disabled = true;
    for (const button of rows) if (!button.disabled) button.click();
  });
  card.append(undoAll);
  return card;
}
