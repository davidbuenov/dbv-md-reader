// =============================================================================
// dbv-md-reader — Herramientas del asistente (RF-35.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lo que un modelo directo puede hacer: listar, leer y buscar en la carpeta del
// documento, ver el esquema del documento abierto y PROPONER cambios. Todas
// trabajan con rutas relativas a esa carpeta y las validan (RNF-IA.3); ninguna
// escribe en disco, accede a la red ni ejecuta programas (RNF-IA.6, RNF-IA.7).
// Leer usa el contenido del editor si el fichero está abierto.
//
// `propose_changes` acumula en la propuesta de la respuesta y la COMPRUEBA en
// memoria: si introduce errores nuevos, se lo dice al modelo para que los
// corrija, como mucho `MAX_FIX_ATTEMPTS` veces (RF-34.3).
//
// @spec RF-35

import { t } from './i18nBridge.js';
import { applyChange, normalizePath } from './proposal.js';
import { isSafeRelativePath } from './paths.js';

/** Reintentos de corrección tras una propuesta que no pasa la comprobación. */
export const MAX_FIX_ATTEMPTS = 2;
/** Tope de lo que devuelve una lectura (caracteres). */
const READ_LIMIT = 24000;
const LIST_LIMIT = 400;
const HIT_LIMIT = 60;

const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

/**
 * Problemas nuevos de una comprobación respecto a la línea base (mismo fichero y
 * mensaje no cuentan dos veces). `level` filtra por gravedad.
 */
export function newProblems(baseline, checked, level = 'error') {
  const key = (d) => `${d.file}|${d.message}`;
  const known = new Map();
  for (const d of baseline.filter((x) => x.level === level)) known.set(key(d), (known.get(key(d)) ?? 0) + 1);
  const fresh = [];
  for (const d of checked.filter((x) => x.level === level)) {
    const count = known.get(key(d)) ?? 0;
    if (count > 0) known.set(key(d), count - 1);
    else fresh.push(d);
  }
  return fresh;
}

/** Resumen de una comprobación para el modelo y para la revisión. */
export function describeCheck(baseline, checked) {
  const fresh = newProblems(baseline, checked, 'error');
  const errors = checked.filter((x) => x.level === 'error').length;
  const fixed = baseline.filter((d) => d.level === 'error').length - (errors - fresh.length);
  return { fresh, fixed: Math.max(0, fixed), errors, warnings: newProblems(baseline, checked, 'warning') };
}

const where = (d) => `${d.file ?? ''}${d.line ? `:${d.line}` : ''}`;

/**
 * @param {object} deps
 * @param {() => Promise<string[]>} deps.listFiles Rutas relativas de los documentos de la carpeta.
 * @param {(relative: string) => Promise<string|null>} deps.readText Contenido (editor o disco), o `null` si no existe.
 * @param {(query: string) => Promise<Array<{relative: string, line: number, text: string}>>} deps.search
 * @param {() => Array<{level: number, text: string}>} deps.outline Encabezados del documento abierto.
 * @param {(proposal: object) => Promise<{fresh: Array, fixed: number, warnings: Array}|null>} deps.checkProposal `null` si no se puede comprobar.
 * @param {() => object} deps.getProposal Propuesta de la respuesta en curso.
 */
export function createTools(deps) {
  let fixAttempts = 0;
  const safe = (path) => {
    const relative = normalizePath(path);
    if (!isSafeRelativePath(relative)) throw new Error(`path outside the document folder: ${path}`);
    return relative;
  };

  return [
    {
      name: 'list_files',
      description: 'List the Markdown documents of the folder of the open document (relative paths).',
      parameters: object({}),
      label: () => t('ai.step.listing'),
      run: async () => {
        const files = await deps.listFiles();
        const shown = files.slice(0, LIST_LIMIT);
        return `${shown.join('\n')}${files.length > shown.length ? `\n… (${files.length - shown.length} more)` : ''}`;
      },
    },
    {
      name: 'read_file',
      description: 'Read a Markdown document of the folder (with unsaved editor changes). Optional 1-based line range.',
      parameters: object({ path: { type: 'string' }, start_line: { type: 'integer' }, end_line: { type: 'integer' } }, ['path']),
      label: (args) => t('ai.step.reading').replace('{path}', args.path ?? ''),
      run: async ({ path, start_line: start, end_line: end }) => {
        const relative = safe(path);
        const content = await deps.readText(relative);
        if (content === null) return `error: ${relative} does not exist`;
        let text = content;
        if (start || end) {
          const lines = content.split('\n');
          text = lines.slice(Math.max(0, (start ?? 1) - 1), end ?? lines.length).join('\n');
        }
        return text.length > READ_LIMIT ? `${text.slice(0, READ_LIMIT)}\n… (truncated: ${text.length} characters; read a line range)` : text;
      },
    },
    {
      name: 'search_files',
      description: 'Search text (case-insensitive) in all Markdown documents of the folder. Returns file:line: text.',
      parameters: object({ query: { type: 'string' } }, ['query']),
      label: (args) => t('ai.step.searching').replace('{query}', args.query ?? ''),
      run: async ({ query }) => {
        const hits = await deps.search(String(query ?? ''));
        if (!hits.length) return 'no matches';
        return hits.slice(0, HIT_LIMIT).map((hit) => `${hit.relative}:${hit.line}: ${hit.text.trim()}`).join('\n');
      },
    },
    {
      name: 'get_outline',
      description: 'Headings (outline) of the open document.',
      parameters: object({}),
      label: () => t('ai.step.outline'),
      run: async () => {
        const outline = deps.outline();
        return outline.length ? outline.map((h) => `${'  '.repeat(Math.max(0, h.level - 1))}- ${h.text}`).join('\n') : 'no headings';
      },
    },
    {
      name: 'propose_changes',
      description:
        'Propose changes to Markdown documents for the user to review (nothing is written until accepted). Actions: "edit" (exact `search` text → `replace`), "create" (new document with `content`), "replace_all" (whole `content`). DBV checks the proposal (unclosed code blocks, unpaired $$, broken relative links) and reports new problems.',
      parameters: object(
        {
          summary: { type: 'string', description: 'One sentence describing the change for the user.' },
          changes: {
            type: 'array',
            items: object(
              {
                path: { type: 'string' },
                action: { type: 'string', enum: ['edit', 'create', 'replace_all'] },
                search: { type: 'string' },
                replace: { type: 'string' },
                content: { type: 'string' },
              },
              ['path', 'action'],
            ),
          },
        },
        ['changes'],
      ),
      // `changes` lo escribe el modelo: un modelo pequeño puede mandar un objeto o un texto.
      label: (args) => t('ai.step.proposing').replace('{paths}', (Array.isArray(args.changes) ? args.changes : []).map((c) => c?.path).filter(Boolean).join(', ') || '…'),
      run: async ({ changes = [], summary = '' }) => {
        const proposal = deps.getProposal();
        if (summary) proposal.summary = summary;
        const report = [];
        // Un modelo pequeño manda a veces un solo cambio como objeto en vez de lista.
        const received = Array.isArray(changes) ? changes : changes && typeof changes === 'object' ? [changes] : [];
        if (!received.length) {
          return 'error: no changes were received, so NOTHING was proposed. Call propose_changes again with `changes` as a non-empty array of {path, action, search, replace}. Do not tell the user a proposal was made.';
        }
        for (const change of received) {
          const result = await applyChange(proposal, change, (path) => deps.readText(path));
          report.push(result.ok ? `ok: ${change.action} ${change.path}` : `error: ${change?.path}: ${result.message}`);
        }
        if (!proposal.files.size) {
          report.push('NOTHING was proposed: no change modified any file (the edit may be empty or identical to the current text). Tell the user the proposal is empty or retry with a correct edit.');
        }
        const checked = proposal.files.size ? await deps.checkProposal(proposal) : null;
        if (checked) {
          const { fresh, fixed, warnings } = checked;
          if (fresh.length) {
            fixAttempts += 1;
            const list = fresh.slice(0, 10).map((d) => `- ${where(d)}: ${d.message}`).join('\n');
            report.push(
              fixAttempts <= MAX_FIX_ATTEMPTS
                ? `The proposal introduces ${fresh.length} NEW error(s). Fix them with another propose_changes call:\n${list}`
                : `The proposal still has ${fresh.length} new error(s):\n${list}\nDo not try again; explain the problem to the user.`,
            );
          } else report.push(`The proposal introduces no new errors${fixed ? ` and fixes ${fixed} existing error(s)` : ''}. The user will review it.`);
          if (warnings.length) report.push(`New warnings (not blocking):\n${warnings.slice(0, 10).map((d) => `- ${where(d)}: ${d.message}`).join('\n')}`);
        } else if (proposal.files.size) report.push('The proposal could not be checked; the user will review it.');
        return report.join('\n');
      },
    },
  ];
}
