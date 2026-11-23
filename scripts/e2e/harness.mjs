// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Banco de pruebas de la interfaz: Edge/Chromium headless dirigido por CDP, con
// `window.__TAURI__` simulado. Es el mismo motor que WebView2, así que cubre lo
// que los tests de Node no ven (DOM, selección, scroll, menús, eventos reales de
// ratón y teclado). `src/` se sirve por HTTP, como lo sirve la app real: desde
// file:// Chromium bloquea el `import()` de módulos.
//
// Uso: ver `scripts/e2e/*.e2e.mjs` y `npm run test:e2e`.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);
/**
 * Modificador de las ediciones NATIVAS del navegador (deshacer del `<textarea>`): Chromium usa los atajos del sistema
 * donde corre, Cmd en macOS y Ctrl en los demás. No depende de la plataforma simulada (`platform`), que solo cambia
 * lo que ve la app. Bits de CDP: 2 = Ctrl, 4 = Meta.
 */
export const NATIVE_MOD = process.platform === 'darwin' ? 4 : 2;
/** Ruta de Edge/Chromium (el mismo motor que WebView2), o `null` si no hay. */
export const findEdge = () => EDGE_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
const EDGE = findEdge();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ appDir, docPath, docContent, extraInvoke = '{}', customInvoke = '(() => undefined)', width = 1400, height = 900, port = 9333, platform = 'Win32' }) {
  // Se sirve src/ por HTTP, como lo sirve la app real (tauri://localhost): desde file:// Chromium bloquea import() de módulos.
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.join(appDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('no'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const appUrl = `http://127.0.0.1:${server.address().port}/index.html`;
  const profile = mkdtempSync(path.join(tmpdir(), 'dbv-harness-'));
  const proc = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });
  // Edge debe morir con el banco aunque este lance una excepción antes de `close()`: en Windows el hijo sobrevive
  // al proceso de Node, se queda con el puerto de depuración y el banco siguiente puede acabar hablando con él.
  // En Windows el PID de `spawn` es el de un lanzador que sale enseguida: el navegador real es hijo suyo y queda
  // huérfano, así que ni `proc.kill()` ni `taskkill /T` lo alcanzan. Se mata por perfil: todo proceso de Edge cuya
  // línea de comandos lleve la carpeta temporal de este banco (el navegador, render, GPU, crashpad…).
  let stopped = false;
  const stopEdge = () => {
    if (stopped) return;
    stopped = true;
    if (process.platform === 'win32') {
      const script = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${profile.replace(/'/g, "''")}') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
      spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore' });
    } else proc.kill();
    // Justo tras matar a Edge, el sistema (o el antivirus) aún retiene ficheros del perfil unos instantes: se reintenta
    // hasta ~5 s en vez de rendirse a los 300 ms y dejar la carpeta en %TEMP%.
    for (let i = 0; i < 25 && existsSync(profile); i++) {
      try { rmSync(profile, { recursive: true, force: true }); } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200); }
    }
  };
  process.once('exit', stopEdge);
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.some((t) => t.type === 'page')) break; } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  const errors = [];
  const poll = () => { for (const e of events.splice(0)) {
    if (e.method === 'Runtime.exceptionThrown') errors.push(e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
    if (e.method === 'Runtime.consoleAPICalled' && ['error'].includes(e.params.type)) errors.push('console.error: ' + e.params.args.map((a) => a.value ?? a.description).join(' '));
  } return errors; };

  const mock = `
    (function () {
      const deep = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : (k in t ? t[k] : deep())), apply: () => Promise.resolve(null) });
      const doc = ${JSON.stringify({ path: docPath, content: docContent, dir_path: path.posix.dirname(docPath), file_name: path.posix.basename(docPath) })};
      // La plataforma es la de la prueba, no la del equipo donde corre (RF-65: en un Mac real los bancos pensados
      // para Windows verían el menú nativo y sus menús ocultos).
      Object.defineProperty(navigator, 'platform', { get: () => ${JSON.stringify(platform)}, configurable: true });
      const calls = [];
      window.__calls = calls;
      const extra = ${extraInvoke};
      const custom = ${customInvoke};
      const listeners = {};
      window.__emit = (name, payload) => (listeners[name] || []).forEach((cb) => cb({ payload }));
      window.__chat = [];
      const T = deep();
      T.core = {
        invoke: (cmd, args) => {
          calls.push([cmd, args]);
          const custom_result = custom(cmd, args);
          if (custom_result !== undefined) return Promise.resolve(custom_result);
          if (cmd in extra) return Promise.resolve(extra[cmd]);
          if (cmd === 'get_cli_argument') return Promise.resolve(doc.path);
          if (cmd === 'read_file') return Promise.resolve(doc);
          if (cmd === 'list_directory') return Promise.resolve([]);
          if (cmd === 'get_app_version') return Promise.resolve('0.19.0');
          if (cmd === 'get_recent_files') return Promise.resolve([]);
          if (cmd === 'write_file') return Promise.resolve(null);
          if (cmd === 'ai_connections') return Promise.resolve({ connections: [], active: null, showAi: true });
          // Como el backend real (ai_providers devuelve siempre una lista): con null, aiApp.js fallaba en providerInfo.find.
          if (cmd === 'ai_providers') return Promise.resolve([]);

          return Promise.resolve(null);
        },
        convertFileSrc: (p) => p,
      };
      T.os = { platform: () => (${JSON.stringify(platform)}.startsWith('Mac') ? 'macos' : 'windows') };
      T.event = { listen: (name, cb) => { (listeners[name] = listeners[name] || []).push(cb); return Promise.resolve(() => {}); } };
      T.window = { getCurrentWindow: () => deep() };
      window.__TAURI__ = T;
    })();`;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: mock });
  await send('Page.navigate', { url: appUrl });
  await sleep(1500);

  const api = {
    /** Acceso directo al protocolo CDP (emulación de medio `print`, tamaño de ventana…). */
    send,
    errors: poll,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: `(async()=>{ ${expr} })()`, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async mouse(type, x, y, { button = 'left', clickCount = 1 } = {}) {
      await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount, buttons: button === 'left' ? 1 : 2 });
    },
    async click(x, y, count = 1, button = 'left') {
      await this.mouse('mouseMoved', x, y);
      for (let i = 1; i <= count; i++) {
        await this.mouse('mousePressed', x, y, { button, clickCount: i });
        await this.mouse('mouseReleased', x, y, { button, clickCount: i });
      }
    },
    async key(key, code, vk, modifiers = 0, commands = undefined) {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers, ...(commands ? { commands } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
    },
    /**
     * Deshacer NATIVO del `<textarea>`, como lo pulsaría el usuario: Ctrl+Z en Windows/Linux y Cmd+Z en macOS. En un
     * Mac, Chromium dirigido por CDP no traduce Cmd+Z en la orden de edición (eso lo hace AppKit en la app real), así
     * que se le pasa explícita con `commands`.
     */
    async nativeUndo() {
      await this.key('z', 'KeyZ', 90, NATIVE_MOD, process.platform === 'darwin' ? ['undo'] : undefined);
    },
    sleep,
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async close() { try { ws.close(); } catch {} stopEdge(); server.close(); },
  };
  return api;
}

export { readFileSync, sleep };
