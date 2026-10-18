// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cero huella al arrancar y modal «Conectar una IA» (RNF-IA.1, RF-31).
//
// @spec RNF-IA.1
// @spec RF-31
// =============================================================================

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}


const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const OUT = tmpdir();
const doc = ['# Título', '', 'Párrafo con un erorr de ortografia.', '', '## Sección', '', 'Más texto aquí.', ''].join('\n');

const extra = JSON.stringify({
  ai_providers: [
    { provider: 'ollama', baseUrl: 'http://localhost:11434', cloud: false, contextTokens: 8192, maxOutputTokens: 4096 },
    { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', cloud: true, contextTokens: 200000, maxOutputTokens: null },
  ],
  ai_detect: { servers: [{ provider: 'ollama', running: true, models: ['qwen2.5:3b'] }, { provider: 'lmStudio', running: false, models: [] }], tools: [{ name: 'claude', path: 'C:/x/claude.exe' }] },
  ai_list_files: ['test.md', 'otro.md'],
  ai_project_state_load: null,
  ai_project_state_save: null,
});

// Sin conexiones guardadas: arranque «normal».
const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, extraInvoke: extra });
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

try {
  // ── Cero huella (RNF-IA.1) ──────────────────────────────────────────────────
  const boot = await h.eval(`
    const res = performance.getEntriesByType('resource').map(r => r.name);
    return {
      aiRequests: res.filter(n => /\\/ai\\//.test(n)),
      allCount: res.length,
      btnVisible: !document.getElementById('btn-ai').classList.contains('hidden'),
      tabVisible: !document.getElementById('tab-ai').classList.contains('hidden'),
      aiPanelEmpty: document.getElementById('ai-panel').children.length === 0,
      styleLink: !!document.getElementById('ai-styles'),
      calls: window.__calls.map(c => c[0]).filter(c => c.startsWith('ai_')),
    }`);
  ok('el arranque no pide ningún fichero de src/ai/', boot.aiRequests.length === 0, JSON.stringify(boot.aiRequests));
  ok('no se inyecta la hoja de estilos de la IA', boot.styleLink === false);
  ok('el panel del Asistente está vacío', boot.aiPanelEmpty);
  ok('solo se lee la lista de conexiones (ai_connections)', JSON.stringify(boot.calls) === '["ai_connections"]', JSON.stringify(boot.calls));
  ok('botón «IA» y pestaña visibles (escritorio)', boot.btnVisible && boot.tabVisible);

  // ── Pulsar el botón: se carga la IA y, sin conexiones, se abre «Conectar una IA» ──
  await h.eval(`document.getElementById('btn-ai').click()`);
  await h.sleep(1500);
  const loaded = await h.eval(`
    const res = performance.getEntriesByType('resource').map(r => r.name.split('/').slice(-2).join('/'));
    const modal = document.getElementById('ai-connect-modal');
    return {
      aiFiles: res.filter(n => n.startsWith('ai/')),
      modalOpen: !modal.classList.contains('hidden'),
      body: document.getElementById('ai-connect-body').innerText.slice(0, 600),
      style: !!document.getElementById('ai-styles'),
      detectCalled: window.__calls.some(c => c[0] === 'ai_detect'),
    }`);
  ok('al pulsar se descargan los módulos de la IA', loaded.aiFiles.length >= 8, loaded.aiFiles.join(', '));
  ok('se abre el modal «Conectar una IA»', loaded.modalOpen);
  ok('…que detecta lo instalado (solo al abrirlo)', loaded.detectCalled);
  ok('…y muestra Ollama, Claude Code y la explicación de la suscripción', /Ollama/.test(loaded.body) && /Claude Code/.test(loaded.body) && /suscripci/i.test(loaded.body), loaded.body.replace(/\n+/g, ' | ').slice(0, 420));
  ok('se inyecta la hoja de estilos', loaded.style);
  await h.screenshot(OUT + '/dbv-ai-connect.png');

  const errs = h.errors();
  ok('sin excepciones ni console.error', errs.length === 0, JSON.stringify(errs.slice(0, 4)));
} catch (e) {
  console.error('EXCEPCIÓN DEL BANCO:', e.message);
  failed++;
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} fallos` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
