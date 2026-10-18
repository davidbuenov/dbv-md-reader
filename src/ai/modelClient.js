// =============================================================================
// dbv-md-reader — Cliente del modelo sobre el backend (RF-33.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Convierte la petición de chat del backend (que responde con eventos
// `ai-stream`) en la función `callModel` que espera el bucle del asistente:
// una promesa con el texto completo, las llamadas a herramientas y el uso,
// mientras el texto se va entregando trozo a trozo para pintarlo en streaming.
// Un solo oyente del evento reparte por `requestId`.

let counter = 0;

/** Mensajes del asistente → formato del backend (`toolCalls`, `toolCallId`). */
export function toBackendMessages(messages) {
  return messages
    .filter((message) => ['system', 'user', 'assistant', 'tool'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: message.content ?? '',
      images: message.images ?? [],
      toolCalls: message.toolCalls ?? [],
      toolCallId: message.toolCallId ?? null,
    }));
}

/** Aplica un evento a la respuesta en curso. Puro, para probarlo. */
export function reduceEvent(state, payload) {
  if (payload.type === 'text') {
    state.text += payload.text;
    state.onText?.(payload.text);
  } else if (payload.type === 'thinking') {
    // El razonamiento SOLO se muestra: va por su callback y nunca se
    // acumula en la respuesta, que es lo que consume el bucle y acaba en el historial.
    state.onThinking?.(payload.text);
  } else if (payload.type === 'toolCall') {
    // `thoughtSignature` (Gemini 3) es opaca y hay que devolverla tal cual con la llamada, o la API rechaza el turno siguiente.
    state.toolCalls.push({ id: payload.id, name: payload.name, arguments: payload.arguments, ...(payload.thoughtSignature ? { thoughtSignature: payload.thoughtSignature } : {}) });
  }
  else if (payload.type === 'usage') state.usage = { input: payload.input, output: payload.output, evalMs: payload.evalMs ?? 0 };
  else if (payload.type === 'done') state.done = { stopReason: payload.stopReason };
  else if (payload.type === 'error') state.error = payload.error;
  return state;
}

/**
 * @param {object} deps
 * @param {(requestId: string, connectionId: string, request: object) => Promise<{ok: boolean, error?: object}>} deps.aiChat
 * @param {(requestId: string) => Promise<unknown>} deps.aiCancel
 * @param {(event: string, handler: Function) => Promise<() => void>} deps.on
 */
export function createModelClient({ aiChat, aiCancel, on }) {
  // Por cliente, no por módulo: cada cliente escucha con SU backend.
  const pending = new Map();
  let listening = null;

  async function ensureListener() {
    listening ??= on('ai-stream', (payload) => {
      const entry = pending.get(payload.requestId);
      if (!entry) return;
      reduceEvent(entry.state, payload);
      if (entry.state.error) {
        pending.delete(payload.requestId);
        entry.reject(Object.assign(new Error(entry.state.error.message ?? String(entry.state.error)), { kind: entry.state.error.kind }));
      } else if (entry.state.done) {
        pending.delete(payload.requestId);
        entry.resolve({ text: entry.state.text, toolCalls: entry.state.toolCalls, usage: entry.state.usage, stopReason: entry.state.done.stopReason });
      }
    });
    await listening;
  }

  /**
   * Una llamada al modelo. `onText` recibe cada trozo; `signal.cancelled`
   * se consulta para detenerla.
   */
  async function call(connectionId, { messages, tools, maxTokens }, { onText, onThinking, register } = {}) {
    await ensureListener();
    const requestId = `r${Date.now().toString(36)}-${(counter += 1)}`;
    const state = { text: '', toolCalls: [], usage: null, done: null, error: null, onText, onThinking };
    const promise = new Promise((resolve, reject) => pending.set(requestId, { state, resolve, reject }));
    // Detener avisa al backend Y libera la petición aquí: si el hilo del
    // backend hubiera muerto sin emitir nada, la conversación no se queda colgada.
    register?.(() => {
      aiCancel(requestId);
      const entry = pending.get(requestId);
      if (entry) {
        pending.delete(requestId);
        entry.reject(Object.assign(new Error('cancelled'), { kind: 'cancelled' }));
      }
    });
    const started = await aiChat(requestId, connectionId, { messages: toBackendMessages(messages), tools, maxTokens: maxTokens ?? null });
    if (!started.ok) {
      pending.delete(requestId);
      throw Object.assign(new Error(started.error.message), { kind: started.error.kind });
    }
    return promise;
  }

  return { call };
}
