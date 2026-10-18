// =============================================================================
// dbv-md-reader — Agente ACP falso para los tests del transporte (RF-32)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Se comporta como el adaptador real de Claude Code observado en el spike
// S-ACP: pide permiso antes de editar y escribe en disco por su cuenta (no
// usa fs/write_text_file). Además lee un fichero a través del cliente.

import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

let cwd = process.cwd();
let nextId = 100;
const waiting = new Map();
const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
const ask = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    send({ id, method, params });
  });

createInterface({ input: process.stdin }).on('line', async (line) => {
  const message = JSON.parse(line);
  if (message.method === undefined && waiting.has(message.id)) {
    waiting.get(message.id)(message.result ?? message.error);
    waiting.delete(message.id);
    return;
  }
  if (message.method === 'initialize') send({ id: message.id, result: { protocolVersion: 1, agentInfo: { name: 'falso' }, agentCapabilities: {} } });
  else if (message.method === 'session/new') {
    cwd = message.params.cwd ?? cwd;
    send({ id: message.id, result: { sessionId: 's1' } });
  } else if (message.method === 'session/prompt') {
    const permission = await ask('session/request_permission', {
      sessionId: 's1',
      toolCall: { toolCallId: 't1', title: 'Edit main.md', kind: 'edit', content: [{ type: 'diff', path: join(cwd, 'main.md'), oldText: '# Hola', newText: '# Hola, agente' }] },
      options: [{ optionId: 'allow', kind: 'allow_once', name: 'Allow' }, { optionId: 'reject', kind: 'reject_once', name: 'Reject' }],
    });
    await ask('fs/read_text_file', { sessionId: 's1', path: join(cwd, 'main.md') });
    if (permission?.outcome?.optionId === 'allow') writeFileSync(join(cwd, 'main.md'), '# Hola, agente');
    send({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hecho.' } } } });
    send({ id: message.id, result: { stopReason: 'end_turn' } });
  }
});
