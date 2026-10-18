// =============================================================================
// dbv-md-reader — Sesión con un agente por ACP (RF-32)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Habla el protocolo con el agente a través del transporte de Rust:
// `initialize` → `session/new` (con la carpeta del proyecto) → un
// `session/prompt` por mensaje del usuario. Atiende lo que pide el agente:
//   · `session/request_permission` → la interfaz decide (nunca solo, RF-32.7);
//   · `fs/read_text_file` → contenido del editor si está abierto, confinado al
//     proyecto;
//   · `fs/write_text_file` → NO escribe: pasa a la propuesta del turno (RF-32.5).
// Antes de cada turno se toma un punto de restauración; al acabar, se piden
// los cambios que el agente hizo en disco por su cuenta (RF-32.6).

/** Versión del protocolo que habla DBV. */
export const PROTOCOL_VERSION = 1;

/**
 * Traduce una actualización de sesión (`session/update`) a algo que pintar.
 * @returns {{type: 'text'|'thought'|'tool'|'plan'|'ignore', text?: string, title?: string, status?: string, id?: string, entries?: Array}}
 */
export function describeUpdate(update) {
  const kind = update?.sessionUpdate;
  let result = { type: 'ignore' };
  if (kind === 'agent_message_chunk' && update.content?.type === 'text') result = { type: 'text', text: update.content.text ?? '' };
  else if (kind === 'agent_thought_chunk' && update.content?.type === 'text') result = { type: 'thought', text: update.content.text ?? '' };
  else if (kind === 'tool_call') result = { type: 'tool', id: update.toolCallId, title: update.title ?? update.kind ?? '', status: update.status ?? 'pending' };
  else if (kind === 'tool_call_update') result = { type: 'toolUpdate', id: update.toolCallId, title: update.title ?? '', status: update.status ?? '' };
  else if (kind === 'plan') result = { type: 'plan', entries: (update.entries ?? []).map((entry) => ({ content: entry.content ?? '', status: entry.status ?? 'pending' })) };
  return result;
}

/** Ruta relativa de `absolute` dentro de `root`, o `null` si está fuera. */
export function insideProject(root, absolute) {
  // `fs::canonicalize` de Windows devuelve `\\?\D:\…` (o `\\?\UNC\srv\…`): el agente habla en `D:\…`.
  const norm = (path) => String(path ?? '').replace(/\\/g, '/').replace(/^\/\/\?\/UNC\//i, '//').replace(/^\/\/\?\//, '').replace(/\/+$/, '');
  const base = norm(root);
  const target = norm(absolute);
  const caseless = /^[a-z]:/i.test(base);
  const same = (a, b) => (caseless ? a.toLowerCase() === b.toLowerCase() : a === b);
  let result = null;
  if (target.length > base.length && same(target.slice(0, base.length), base) && target[base.length] === '/') {
    const relative = target.slice(base.length + 1);
    if (!relative.split('/').includes('..')) result = relative;
  }
  return result;
}

/** Las líneas `line` (1-indexada) a `line + limit - 1` de `text`. */
export function sliceLines(text, line, limit) {
  if (!line && !limit) return text;
  const lines = text.split('\n');
  const start = Math.max(0, (line ?? 1) - 1);
  return lines.slice(start, limit ? start + limit : undefined).join('\n');
}

/**
 * @param {object} deps
 * @param {object} deps.backend `acpStart`, `acpRequest`, `acpNotify`, `acpRespond`, `acpStop`, `acpSnapshot`, `acpChanges`, `on`.
 * @param {() => string} deps.getRoot
 * @param {(relative: string) => Promise<string|null>} deps.readText
 * @param {(params: object) => Promise<string|null>} deps.askPermission optionId elegido, o `null` (cancelado).
 * @param {(relative: string, content: string) => Promise<void>} deps.stageWrite
 * @param {(update: object) => void} deps.onUpdate
 */
export function createAcpSession({ backend, getRoot, readText, askPermission, stageWrite, onUpdate }) {
  let spec = null;
  let sessionId = null;
  let root = null;
  let listening = null;

  async function respond(id, result, error = null) {
    await backend.acpRespond(id, result ?? null, error);
  }

  async function handle(message) {
    if (message.kind === 'notification') {
      if (message.method === 'session/update' && message.params?.sessionId === sessionId) onUpdate(describeUpdate(message.params.update));
      return;
    }
    const { id, method, params } = message;
    try {
      if (method === 'session/request_permission') {
        const optionId = await askPermission(params);
        await respond(id, { outcome: optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' } });
      } else if (method === 'fs/read_text_file') {
        const relative = insideProject(root, params.path);
        const content = relative === null ? null : await readText(relative);
        if (content === null) await respond(id, null, relative === null ? 'fuera del proyecto: DBV no da acceso' : 'el fichero no existe');
        else await respond(id, { content: sliceLines(content, params.line, params.limit) });
      } else if (method === 'fs/write_text_file') {
        const relative = insideProject(root, params.path);
        if (relative === null) await respond(id, null, 'fuera del proyecto: DBV no da acceso');
        else {
          await stageWrite(relative, String(params.content ?? ''));
          await respond(id, null);
        }
      } else {
        await respond(id, null, `método no admitido por DBV: ${method}`);
      }
    } catch (error) {
      await respond(id, null, error?.message ?? String(error));
    }
  }

  async function ensureListener() {
    listening ??= backend.on('acp-message', (message) => handle(message));
    await listening;
  }

  /** Arranca el agente y abre una sesión en el proyecto (si no lo estaba ya). */
  async function ensureSession(nextSpec) {
    await ensureListener();
    const currentRoot = getRoot();
    if (sessionId && spec && spec.id === nextSpec.id && spec.command === nextSpec.command && root === currentRoot) return { fresh: false };
    await backend.acpStop();
    const started = await backend.acpStart(nextSpec, currentRoot);
    if (!started.ok) throw Object.assign(new Error(started.error.message), { kind: started.error.kind });
    const init = await backend.acpRequest('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
      clientInfo: { name: 'dbv-md-reader', title: 'DBV Markdown Reader' },
    });
    if (!init.ok) throw Object.assign(new Error(init.error.message), { kind: 'network' });
    // Sin servidor MCP propio (decidido en /spec de la 0.18.0): el agente usa sus propias herramientas
    // y DBV le deja leer y proponer ficheros por el protocolo.
    const session = await backend.acpRequest('session/new', { cwd: currentRoot, mcpServers: [] });
    if (!session.ok) throw Object.assign(new Error(session.error.message), { kind: session.error.kind === 'badRequest' ? 'auth' : session.error.kind });
    spec = nextSpec;
    root = currentRoot;
    sessionId = session.value.sessionId;
    return { fresh: true, agentInfo: init.value?.agentInfo ?? null, images: Boolean(init.value?.agentCapabilities?.promptCapabilities?.image) };
  }

  /**
   * Un turno: punto de restauración, mensaje y cambios en disco al acabar.
   * @param {Array<object>} prompt Bloques de contenido ACP (`text`, `image`).
   */
  async function prompt(blocks) {
    await backend.acpSnapshot(root);
    const result = await backend.acpRequest('session/prompt', { sessionId, prompt: blocks });
    const changes = await backend.acpChanges();
    return { result, changes: changes.ok ? changes.value : [] };
  }

  return {
    ensureSession,
    prompt,
    cancel: () => sessionId && backend.acpNotify('session/cancel', { sessionId }),
    stop: async () => {
      sessionId = null;
      spec = null;
      await backend.acpStop();
    },
    get sessionId() {
      return sessionId;
    },
  };
}
