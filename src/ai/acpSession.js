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
//   · `session/request_permission` → la interfaz decide (nunca solo);
//   · `fs/read_text_file` → contenido del editor si está abierto, confinado al
//     proyecto;
//   · `fs/write_text_file` → NO escribe: pasa a la propuesta del turno.
// Antes de cada turno se toma un punto de restauración; al acabar, se piden
// los cambios que el agente hizo en disco por su cuenta.
// Las consultas sueltas (`askAside`, p. ej. «Mejorar con IA») van en otra sesión
// del mismo agente, sin servidores MCP: solo devuelven texto, nunca tocan nada.

import { APP_NAME } from './appInfo.js';

/** Versión del protocolo ACP que habla la app. */
export const PROTOCOL_VERSION = 1;

/** Espera máxima de una consulta suelta (ms): luego se cancela. */
export const ASIDE_TIMEOUT_MS = 120_000;

/** Lo que se responde a una sesión de consulta suelta que pide algo: no tiene acceso a nada. */
const ASIDE_REFUSAL = 'consulta suelta: sin acceso a ficheros ni herramientas';

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

/**
 * Método de inicio de sesión que se pide al agente cuando `session/new` exige autenticarse: el primero
 * que anuncia en `initialize` (`authMethods`), que es el habitual de cada agente (p. ej. `oauth-personal`,
 * «Log in with Google», en Antigravity y Gemini CLI). `null` si no anuncia ninguno.
 */
export function pickAuthMethod(methods) {
  return Array.isArray(methods) && methods[0]?.id ? methods[0] : null;
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
 * @param {() => Promise<Array>|Array} [deps.mcpServers] Servidores MCP que recibe el agente en `session/new`.
 */
export function createAcpSession({ backend, getRoot, readText, askPermission, stageWrite, onUpdate, mcpServers = () => [], onAuthenticate = () => {} }) {
  let spec = null;
  let sessionId = null;
  let root = null;
  let conversationId = null;
  let agentInfo = null;
  let images = false;
  let listening = null;
  /** Sesiones de consulta suelta abiertas: id → recoge su texto. */
  const asides = new Map();

  function effectiveModelOf(targetSpec) {
    const raw = targetSpec?.model;
    if (!raw) return '';
    if (targetSpec.id === 'claude' && (raw === 'claude' || raw === 'claude-sonnet' || raw === 'default')) {
      return 'claude-sonnet-5-5';
    }
    if (raw === targetSpec.id || raw === 'antigravity' || raw === 'agy') return '';
    return raw;
  }

  async function respond(id, result, error = null) {
    await backend.acpRespond(id, result ?? null, error);
  }

  async function handle(message) {
    if (message.kind === 'notification') {
      if (message.method === 'session/update' && message.params?.sessionId === sessionId) onUpdate(describeUpdate(message.params.update));
      else if (message.method === 'session/update') asides.get(message.params?.sessionId)?.(describeUpdate(message.params.update));
      return;
    }
    const { id, method, params } = message;
    try {
      // Una consulta suelta no pide permisos ni toca ficheros: se le deniega todo sin preguntar.
      if (asides.has(params?.sessionId)) {
        if (method === 'session/request_permission') await respond(id, { outcome: { outcome: 'cancelled' } });
        else await respond(id, null, ASIDE_REFUSAL);
      } else if (method === 'session/request_permission') {
        const optionId = await askPermission(params);
        await respond(id, { outcome: optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' } });
      } else if (method === 'fs/read_text_file') {
        const relative = insideProject(root, params.path);
        const content = relative === null ? null : await readText(relative);
        if (content === null) await respond(id, null, relative === null ? 'fuera del proyecto: la app no da acceso' : 'el fichero no existe');
        else await respond(id, { content: sliceLines(content, params.line, params.limit) });
      } else if (method === 'fs/write_text_file') {
        const relative = insideProject(root, params.path);
        if (relative === null) await respond(id, null, 'fuera del proyecto: la app no da acceso');
        else {
          await stageWrite(relative, String(params.content ?? ''));
          await respond(id, null);
        }
      } else {
        await respond(id, null, `método no admitido por la app: ${method}`);
      }
    } catch (error) {
      await respond(id, null, error?.message ?? String(error));
    }
  }

  async function ensureListener() {
    listening ??= backend.on('acp-message', (message) => handle(message));
    await listening;
  }

  /** Arranca el agente y abre una sesión en el proyecto (si no lo estaba ya para esta conversación). */
  async function ensureSession(nextSpec, nextConversationId = null) {
    await ensureListener();
    const currentRoot = getRoot();
    const targetConversationId = nextConversationId ?? conversationId;
    if (
      sessionId &&
      spec &&
      spec.id === nextSpec.id &&
      spec.model === nextSpec.model &&
      spec.reasoningEffort === nextSpec.reasoningEffort &&
      spec.command === nextSpec.command &&
      root === currentRoot &&
      conversationId === targetConversationId
    ) {
      return { fresh: false, agentInfo, images };
    }
    await backend.acpStop();
    const started = await backend.acpStart(nextSpec, currentRoot);
    if (!started.ok) throw Object.assign(new Error(started.error.message), { kind: started.error.kind });
    const init = await backend.acpRequest('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
      clientInfo: { name: APP_NAME, title: APP_NAME },
    });
    if (!init.ok) throw Object.assign(new Error(init.error.message), { kind: 'network' });
    // Servidores MCP para el agente, si el host los da.
    const servers = await mcpServers();
    const newSession = () => backend.acpRequest('session/new', { cwd: currentRoot, mcpServers: Array.isArray(servers) ? servers : [] });
    let session = await newSession();
    // «Authentication required»: se pide al agente que inicie sesión con su método habitual (puede abrir
    // el navegador) y se reintenta. La app nunca ve las credenciales: las guarda el agente.
    const method = pickAuthMethod(init.value?.authMethods);
    if (!session.ok && method && /auth/i.test(session.error.message)) {
      onAuthenticate(method);
      const auth = await backend.acpRequest('authenticate', { methodId: method.id });
      if (!auth.ok) throw Object.assign(new Error(auth.error.message), { kind: 'auth' });
      session = await newSession();
    }
    if (!session.ok) throw Object.assign(new Error(session.error.message), { kind: session.error.kind === 'badRequest' ? 'auth' : session.error.kind });
    spec = nextSpec;
    root = currentRoot;
    conversationId = targetConversationId;
    sessionId = session.value.sessionId;
    agentInfo = init.value?.agentInfo ?? null;
    images = Boolean(init.value?.agentCapabilities?.promptCapabilities?.image);
    const cleanModel = effectiveModelOf(nextSpec);
    if (cleanModel) {
      await backend.acpRequest('session/set_config_option', {
        sessionId,
        configId: 'model',
        value: cleanModel,
      });
    }
    if (nextSpec.reasoningEffort && nextSpec.reasoningEffort !== 'off') {
      const options = Array.isArray(session.value?.configOptions) ? session.value.configOptions : [];
      const effortConfigId = options.find((o) => o.id === 'effort' || o.id === 'reasoning_effort' || o.category === 'thought_level')?.id ?? 'effort';
      await backend.acpRequest('session/set_config_option', {
        sessionId,
        configId: effortConfigId,
        value: nextSpec.reasoningEffort,
      });
    }
    return { fresh: true, agentInfo, images };
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

  /**
   * Una pregunta suelta, fuera de la conversación: otra sesión del mismo agente (ya arrancado con
   * `ensureSession`), sin servidores MCP, sin punto de restauración y sin panel. Devuelve el texto del agente.
   */
  async function askAside(text, timeoutMs = ASIDE_TIMEOUT_MS) {
    const opened = await backend.acpRequest('session/new', { cwd: root, mcpServers: [] });
    if (!opened.ok) throw Object.assign(new Error(opened.error.message), { kind: opened.error.kind });
    const asideId = opened.value.sessionId;
    const cleanModel = effectiveModelOf(spec);
    if (cleanModel) {
      await backend.acpRequest('session/set_config_option', { sessionId: asideId, configId: 'model', value: cleanModel });
    }
    let reply = '';
    asides.set(asideId, (update) => {
      if (update.type === 'text') reply += update.text;
    });
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        backend.acpNotify('session/cancel', { sessionId: asideId });
        reject(Object.assign(new Error('el agente no respondió a tiempo'), { kind: 'timeout' }));
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([backend.acpRequest('session/prompt', { sessionId: asideId, prompt: [{ type: 'text', text }] }), timeout]);
      if (!result.ok) throw Object.assign(new Error(result.error.message), { kind: result.error.kind });
    } finally {
      clearTimeout(timer);
      asides.delete(asideId);
    }
    return reply;
  }

  return {
    ensureSession,
    prompt,
    askAside,
    cancel: () => sessionId && backend.acpNotify('session/cancel', { sessionId }),
    stop: async () => {
      sessionId = null;
      spec = null;
      conversationId = null;
      agentInfo = null;
      images = false;
      await backend.acpStop();
    },
    get sessionId() {
      return sessionId;
    },
  };
}
