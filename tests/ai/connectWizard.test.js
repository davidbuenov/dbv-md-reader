// =============================================================================
// dbv-md-reader — Tests del formulario de conexión (RF-101, RF-103)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTranslations } from '../../src/ai/i18nBridge.js';
import { createConnectWizard } from '../../src/ai/connectWizard.js';
import { AI_TRANSLATIONS } from '../../src/ai/translations.js';

registerTranslations(AI_TRANSLATIONS);
const setLanguage = (lang) => window.DBV_I18N.setLang(lang);

const ok = (value) => ({ ok: true, value });
const providers = [
  { provider: 'ollama', baseUrl: 'http://localhost:11434/v1', contextTokens: 8192, maxOutputTokens: 8192, cloud: false },
  { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', contextTokens: 32768, maxOutputTokens: null, cloud: true },
];

const SMALL = { parameterSize: '3.1B', contextLength: 32768, capabilities: ['completion', 'tools'] };
const THINKER = { parameterSize: '8.2B', contextLength: 40960, capabilities: ['completion', 'tools', 'thinking'] };

async function setup({ info = null } = {}) {
  document.body.innerHTML = '<div id="host"></div>';
  const backend = {
    aiProviders: vi.fn(async () => ok(providers)),
    aiConnections: vi.fn(async () => ok({ connections: [], active: null, showAi: true })),
    aiDetect: vi.fn(async () => ok({ servers: [{ provider: 'ollama', running: true, models: ['qwen3:8b'] }], tools: [] })),
    aiModelInfo: vi.fn(async () => ok(info)),
    aiListModels: vi.fn(async () => ok(['qwen3:8b'])),
    aiSaveConnection: vi.fn(async (connection) => ok({ file: { connections: [connection], active: connection.id, showAi: true }, keyStorage: null })),
    aiSetPreferences: vi.fn(async () => ok(null)),
    aiDeleteConnection: vi.fn(),
    openExternalUrl: vi.fn(),
  };
  const host = document.getElementById('host');
  const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), notify: vi.fn() });
  await wizard.open();
  await vi.waitFor(() => expect(host.querySelector('.ai-detect__item button')).not.toBeNull());
  return { host, backend };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function openOllamaForm(context) {
  context.host.querySelector('.ai-detect__item button').click();
  await vi.waitFor(() => expect(context.backend.aiModelInfo).toHaveBeenCalled());
  await settle();
}

const selectByLabel = (host, label) => [...host.querySelectorAll('.ai-form__row')].find((row) => row.textContent.startsWith(label))?.querySelector('select');
const hintOf = (host, label) => [...host.querySelectorAll('.ai-form__row')].find((row) => row.textContent.startsWith(label))?.querySelector('.ai-form__hint').textContent;
const inputByLabel = (host, label) => [...host.querySelectorAll('.ai-form__row')].find((row) => row.textContent.startsWith(label))?.querySelector('input');
const advice = (host) => [...host.querySelectorAll('.ai-advice')].map((node) => node.textContent);
const saveButton = (host) => [...host.querySelectorAll('.ai-form__actions button')].find((b) => b.classList.contains('button--primary'));

beforeEach(() => setLanguage('es'));

describe('avisos del modelo en el formulario', () => {
  it('un modelo pequeño con un contexto de 4 096 avisa de las dos cosas, con los números', async () => {
    const context = await setup({ info: SMALL });
    await openOllamaForm(context);
    const contextInput = inputByLabel(context.host, 'Contexto');
    contextInput.value = '4096';
    contextInput.dispatchEvent(new Event('change'));
    await settle();
    const messages = advice(context.host);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('modelo pequeño (3.1B)');
    expect(messages[1]).toMatch(/4[. ]?096 tokens/);
    expect(messages[1]).toMatch(/8[. ]?192/);
  });

  it('un modelo grande con contexto suficiente no avisa de nada', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    const contextInput = context.host.querySelector('input[type="number"]');
    contextInput.value = '16384';
    contextInput.dispatchEvent(new Event('change'));
    await settle();
    expect(advice(context.host)).toEqual([]);
  });

  it('sin información del modelo (servidor que no la da) no se inventa ningún aviso de tamaño', async () => {
    const context = await setup({ info: null });
    await openOllamaForm(context);
    expect(advice(context.host).every((text) => !text.includes('modelo pequeño'))).toBe(true);
  });
});

describe('contexto y máximo por respuesta', () => {
  it('con los campos vacíos muestran el valor real que se usará, y en la nube no hay tope', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    expect(inputByLabel(context.host, 'Contexto').placeholder).toBe('8192');
    expect(inputByLabel(context.host, 'Máximo por respuesta').placeholder).toBe('8192');
    expect(hintOf(context.host, 'Contexto')).toContain('Context length');

    [...context.host.querySelectorAll('button')].find((b) => b.textContent.startsWith('Añadir una IA en la nube')).click();
    await vi.waitFor(() => expect(context.host.querySelector('.ai-form__section:not(.hidden) input[type="number"]')).not.toBeNull());
    const cloudForm = [...context.host.querySelectorAll('.ai-form__section')].find((s) => !s.classList.contains('hidden') && s.textContent.includes('Máximo por respuesta'));
    expect(cloudForm.querySelectorAll('input[type="number"]')[1].placeholder).toBe('sin tope');
  });

  it('sin escribir nada se guarda «sin decidir» (null) y el backend aplica el suyo', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0].maxOutputTokens).toBeNull();
  });

  it('un tope escrito a mano se guarda como número', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    const maxOutput = inputByLabel(context.host, 'Máximo por respuesta');
    maxOutput.value = '12000';
    maxOutput.dispatchEvent(new Event('change'));
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0].maxOutputTokens).toBe(12000);
  });
});

describe('interruptor «Razonamiento»', () => {
  it('un modelo que razona: desactivado por defecto, activable, y se guarda en la conexión', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    const reasoning = selectByLabel(context.host, 'Razonamiento');
    expect(reasoning.disabled).toBe(false);
    expect(reasoning.value).toBe('false');
    reasoning.value = 'true';
    reasoning.dispatchEvent(new Event('change'));
    await settle();
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0]).toMatchObject({ provider: 'ollama', model: 'qwen3:8b', reasoning: true });
  });

  it('por defecto se guarda desactivado, nunca como «sin decidir»', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0].reasoning).toBe(false);
  });

  it('si Ollama dice que el modelo no razona, el interruptor queda inactivo y lo explica', async () => {
    const context = await setup({ info: SMALL });
    await openOllamaForm(context);
    expect(selectByLabel(context.host, 'Razonamiento').disabled).toBe(true);
    expect(hintOf(context.host, 'Razonamiento')).toContain('no razona');
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0].reasoning).toBeNull();
  });

  it('con un proveedor donde DBV no puede fijarlo, el interruptor es inactivo y dice cómo hacerlo en el servidor', async () => {
    const context = await setup();
    // «Añadir IA en la nube» abre el formulario de Anthropic.
    [...context.host.querySelectorAll('button')].find((b) => b.textContent.startsWith('Añadir una IA en la nube')).click();
    await vi.waitFor(() => expect(selectByLabel(context.host, 'Razonamiento')).toBeTruthy());
    await settle();
    expect(selectByLabel(context.host, 'Razonamiento').disabled).toBe(true);
    expect(hintOf(context.host, 'Razonamiento')).toContain('--reasoning-budget 0');
    expect(context.backend.aiModelInfo).not.toHaveBeenCalled();
  });
});

describe('elegir el modelo de la lista del proveedor', () => {
  const MODELS = ['antigravity-preview-05-2026', ...Array.from({ length: 59 }, (_, i) => `gemini-${i}-flash`), 'gemini-pro-latest'];

  async function openCloudFormWithModels() {
    const context = await setup();
    context.backend.aiListModels.mockResolvedValue(ok(MODELS));
    [...context.host.querySelectorAll('button')].find((b) => b.textContent.startsWith('Añadir una IA en la nube')).click();
    await vi.waitFor(() => expect(context.host.querySelector('.ai-form__actions')).not.toBeNull());
    const testButton = context.host.querySelector('.ai-form__actions button');
    testButton.click();
    await vi.waitFor(() => expect(context.backend.aiListModels).toHaveBeenCalled());
    await settle();
    return context;
  }

  const modelSelect = (host) => host.querySelector('.ai-form__model select');
  const modelInput = (host) => host.querySelector('.ai-form__model input');

  it('con 61 modelos disponibles el desplegable los ofrece todos (y «Otro»), no solo el que ya está escrito', async () => {
    const { host } = await openCloudFormWithModels();
    const select = modelSelect(host);
    expect(select.classList.contains('hidden')).toBe(false);
    expect([...select.options].map((o) => o.value).slice(0, 61)).toEqual(MODELS);
    expect(select.options).toHaveLength(62);
    expect(select.options[61].textContent).toBe('Otro (escribirlo)…');
    // El primero queda elegido y el campo de texto oculto.
    expect(select.value).toBe('antigravity-preview-05-2026');
    expect(modelInput(host).classList.contains('hidden')).toBe(true);
  });

  it('elegir otro modelo de la lista lo guarda en la conexión', async () => {
    const { host, backend } = await openCloudFormWithModels();
    const select = modelSelect(host);
    select.value = 'gemini-pro-latest';
    select.dispatchEvent(new Event('change'));
    saveButton(host).click();
    await vi.waitFor(() => expect(backend.aiSaveConnection).toHaveBeenCalled());
    expect(backend.aiSaveConnection.mock.calls[0][0].model).toBe('gemini-pro-latest');
  });

  it('«Otro» deja escribir un modelo que no está en la lista', async () => {
    const { host, backend } = await openCloudFormWithModels();
    const select = modelSelect(host);
    select.value = '__other__';
    select.dispatchEvent(new Event('change'));
    const input = modelInput(host);
    expect(input.classList.contains('hidden')).toBe(false);
    input.value = 'modelo-recien-salido';
    input.dispatchEvent(new Event('change'));
    saveButton(host).click();
    await vi.waitFor(() => expect(backend.aiSaveConnection).toHaveBeenCalled());
    expect(backend.aiSaveConnection.mock.calls[0][0].model).toBe('modelo-recien-salido');
  });

  it('sin lista de modelos (aún sin probar la conexión) se escribe a mano, sin desplegable', async () => {
    const context = await setup();
    [...context.host.querySelectorAll('button')].find((b) => b.textContent.startsWith('Añadir una IA en la nube')).click();
    await vi.waitFor(() => expect(modelSelect(context.host)).not.toBeNull());
    expect(modelSelect(context.host).classList.contains('hidden')).toBe(true);
    expect(modelInput(context.host).classList.contains('hidden')).toBe(false);
  });
});

describe('estado de conexión de agentes CLI', () => {
  it('un agente instalado no conectado muestra el botón Conectar', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const backend = {
      aiProviders: vi.fn(async () => ok(providers)),
      aiConnections: vi.fn(async () => ok({ connections: [], active: null, showAi: true })),
      aiDetect: vi.fn(async () =>
        ok({
          servers: [],
          tools: [
            { name: 'claude', path: 'C:\\claude.exe' },
            { name: 'node', path: 'C:\\node.exe' },
          ],
        }),
      ),
      aiSaveConnection: vi.fn(),
      aiSetPreferences: vi.fn(),
      openExternalUrl: vi.fn(),
    };
    const host = document.getElementById('host');
    const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), onAgent: vi.fn(), notify: vi.fn() });
    await wizard.open();
    await vi.waitFor(() => expect(host.querySelector('.ai-cat-card--agent')).not.toBeNull());

    const claudeItem = [...host.querySelectorAll('.ai-cat-card--agent .ai-detect__item')].find((li) => li.textContent.includes('Claude Code'));
    expect(claudeItem).toBeTruthy();
    const connectBtn = claudeItem.querySelector('button');
    expect(connectBtn).toBeTruthy();
    expect(connectBtn.textContent).toBe('Conectar');
  });

  it('un agente ya conectado no muestra el botón Conectar sino el badge Conectada o Activa', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const existing = {
      id: 'agent-claude-123',
      name: 'Claude Code (agente)',
      provider: 'agent',
      baseUrl: 'acp:claude',
      model: 'claude',
    };
    const backend = {
      aiProviders: vi.fn(async () => ok(providers)),
      aiConnections: vi.fn(async () => ok({ connections: [existing], active: 'agent-claude-123', showAi: true })),
      aiDetect: vi.fn(async () =>
        ok({
          servers: [],
          tools: [
            { name: 'claude', path: 'C:\\claude.exe' },
            { name: 'node', path: 'C:\\node.exe' },
          ],
        }),
      ),
      aiSaveConnection: vi.fn(),
      aiSetPreferences: vi.fn(),
      openExternalUrl: vi.fn(),
    };
    const host = document.getElementById('host');
    const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), onAgent: vi.fn(), notify: vi.fn() });
    await wizard.open();
    await vi.waitFor(() => expect(host.querySelector('.ai-cat-card--agent')).not.toBeNull());

    const claudeItem = [...host.querySelectorAll('.ai-cat-card--agent .ai-detect__item')].find((li) => li.textContent.includes('Claude Code'));
    expect(claudeItem).toBeTruthy();
    // No debe tener botón Conectar
    const connectBtn = [...claudeItem.querySelectorAll('button')].find((b) => b.textContent.includes('Conectar'));
    expect(connectBtn).toBeUndefined();
    // Debe tener el botón de ajustes ⚙️
    expect(claudeItem.querySelector('.ai-agent-gear')).toBeTruthy();
    // Debe tener el badge de activa
    const badge = claudeItem.querySelector('.ai-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('✓ Activa');
  });

  it('el botón de ajustes ⚙️ despliega los modelos dinámicos y el nivel de razonamiento', async () => {
    const backend = {
      aiDetect: () => Promise.resolve({
        ok: true,
        value: {
          servers: [],
          tools: [{ name: 'agy_acp_server', path: 'C:/agy_acp_server.exe' }, { name: 'node', path: 'C:/node.exe' }],
        },
      }),
      aiProviders: () => Promise.resolve({ ok: true, value: [] }),
      aiConnections: () => Promise.resolve({
        ok: true,
        value: {
          connections: [{ id: 'c1', name: 'Antigravity', provider: 'agent', baseUrl: 'acp:antigravity', model: 'antigravity' }],
          active: 'c1',
          showAi: true,
        },
      }),
      aiListAgentModels: vi.fn(() => Promise.resolve({ ok: true, value: ['gemini-3.8-flash', 'gemini-3.8-pro', 'gemini-3.8-flash-lite'] })),
      aiSaveConnection: vi.fn(() => Promise.resolve({ ok: true, value: { file: { connections: [], active: null } } })),
      aiSetPreferences: vi.fn(),
      openExternalUrl: vi.fn(),
    };
    const host = document.getElementById('host');
    const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), onAgent: vi.fn(), notify: vi.fn() });
    await wizard.open();
    await vi.waitFor(() => expect(host.querySelector('.ai-cat-card--agent')).not.toBeNull());

    const agyItem = [...host.querySelectorAll('.ai-cat-card--agent .ai-detect__item')].find((li) => li.textContent.includes('Antigravity'));
    expect(agyItem).toBeTruthy();
    const gear = agyItem.querySelector('.ai-agent-gear');
    expect(gear).toBeTruthy();

    gear.click();
    await vi.waitFor(() => expect(backend.aiListAgentModels).toHaveBeenCalledWith('antigravity'));
    const panel = host.querySelector('.ai-agent-settings');
    expect(panel).toBeTruthy();
    const selects = panel.querySelectorAll('select');
    expect(selects.length).toBe(2);
    // Verifica que el modelo contiene gemini-3.8-flash
    const modelOpts = [...selects[0].options].map((o) => o.value);
    expect(modelOpts).toContain('gemini-3.8-flash');
  });

  it('muestra el resumen estilo Visual Studio ("Gemini 4 Argon Medium"), cachea en sesión y permite refrescar manualmente', async () => {
    const richModels = [
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon', efforts: ['low', 'medium', 'high'], defaultEffort: 'medium' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', efforts: ['low', 'medium', 'high'], defaultEffort: 'medium' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'medium' },
    ];
    const backend = {
      aiDetect: () => Promise.resolve({
        ok: true,
        value: {
          servers: [],
          tools: [
            { name: 'agy_acp_server', path: 'C:/agy_acp_server.exe' },
            { name: 'codex', path: 'C:/codex.exe' },
            { name: 'node', path: 'C:/node.exe' },
          ],
        },
      }),
      aiProviders: () => Promise.resolve({ ok: true, value: [] }),
      aiConnections: () => Promise.resolve({
        ok: true,
        value: {
          connections: [
            { id: 'c1', name: 'Antigravity', provider: 'agent', baseUrl: 'acp:antigravity', model: 'antigravity', reasoningEffort: 'medium' },
          ],
          active: 'c1',
          showAi: true,
        },
      }),
      aiListAgentModels: vi.fn(() => Promise.resolve({ ok: true, value: richModels })),
      aiSaveConnection: vi.fn((conn) => Promise.resolve({
        ok: true,
        value: { file: { connections: [conn], active: conn.id, showAi: true } },
      })),
      aiSetPreferences: vi.fn(),
      openExternalUrl: vi.fn(),
    };
    const host = document.getElementById('host');
    const notify = vi.fn();
    const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), onAgent: vi.fn(), notify });
    await wizard.open();
    await vi.waitFor(() => expect(host.querySelector('.ai-cat-card--agent')).not.toBeNull());
    await vi.waitFor(() => expect(backend.aiListAgentModels).toHaveBeenCalledTimes(1));

    const summary = host.querySelector('[data-agent-summary="antigravity"]');
    expect(summary).toBeTruthy();
    expect(summary.textContent).toBe('Gemini 4 Argon Medium');

    const connSummary = host.querySelector('[data-conn-summary="antigravity"]');
    expect(connSummary).toBeTruthy();
    expect(connSummary.textContent).toBe('Gemini 4 Argon Medium');

    // Al abrir los ajustes ⚙️ reutiliza la caché de sesión sin volver a invocar al CLI
    const agyItem = [...host.querySelectorAll('.ai-cat-card--agent .ai-detect__item')].find((li) => li.textContent.includes('Antigravity'));
    agyItem.querySelector('.ai-agent-gear').click();
    await settle();
    expect(backend.aiListAgentModels).toHaveBeenCalledTimes(1);

    const panel = host.querySelector('.ai-agent-settings');
    const [modelSelect, reasoningSelect] = panel.querySelectorAll('select');
    expect([...modelSelect.options].map((o) => o.textContent)).toEqual([
      'Gemini 4 Argon',
      'Gemini 3.8 Flash',
      'Claude Sonnet 5.5',
    ]);

    // Al cambiar a Claude Sonnet 5.5 aparecen sus niveles de esfuerzo específicos (xhigh, max)
    modelSelect.value = 'claude-sonnet-5-5';
    modelSelect.dispatchEvent(new Event('change'));
    const effortValues = [...reasoningSelect.options].map((o) => o.value);
    expect(effortValues).toEqual(['off', 'low', 'medium', 'high', 'xhigh', 'max']);

    // El botón 🔄 fuerza la recarga (forceRefresh = true)
    const refreshBtn = panel.querySelector('.ai-agent-refresh');
    expect(refreshBtn).toBeTruthy();
    refreshBtn.click();
    await vi.waitFor(() => expect(backend.aiListAgentModels).toHaveBeenCalledWith('antigravity', true));
    await vi.waitFor(() => expect(notify).toHaveBeenCalled());
  });

  it('con la CLI agy pero sin agy_acp_server, Antigravity no se puede conectar y abre la guía en su sección', async () => {
    const backend = {
      aiDetect: () => Promise.resolve({
        ok: true,
        value: { servers: [], tools: [{ name: 'agy', path: 'C:/agy.exe' }, { name: 'node', path: 'C:/node.exe' }] },
      }),
      aiProviders: () => Promise.resolve({ ok: true, value: [] }),
      aiConnections: () => Promise.resolve({ ok: true, value: { connections: [], active: null, showAi: true } }),
      aiSetPreferences: vi.fn(),
      openExternalUrl: vi.fn(),
    };
    const host = document.getElementById('host');
    const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), onAgent: vi.fn(), notify: vi.fn() });
    await wizard.open();
    await vi.waitFor(() => expect(host.querySelector('.ai-cat-card--agent')).not.toBeNull());

    const agyItem = [...host.querySelectorAll('.ai-cat-card--agent .ai-detect__item')].find((li) => li.textContent.includes('Antigravity'));
    expect(agyItem.classList.contains('is-ok')).toBe(false);
    expect(agyItem.textContent).toContain('agy_acp_server');
    expect([...agyItem.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Conectar');
    Element.prototype.scrollIntoView = vi.fn();
    agyItem.querySelector('button').click();
    await vi.waitFor(() => expect(document.querySelector('.ai-guide')).not.toBeNull());
    await vi.waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(Element.prototype.scrollIntoView.mock.contexts[0].dataset.anchor).toBe('google-antigravity-instalar-su-servidor-acp');
    expect(backend.openExternalUrl).not.toHaveBeenCalled();
    document.querySelector('.ai-guide').remove();
  });

  it('el enlace de ayuda abre la guía dentro de la app; Copilot sin CLI enlaza a su sección', async () => {
    const backend = {
      aiDetect: () => Promise.resolve({
        ok: true,
        value: { servers: [], tools: [{ name: 'copilot', path: null }, { name: 'node', path: 'C:/node.exe' }] },
      }),
      aiProviders: () => Promise.resolve({ ok: true, value: [] }),
      aiConnections: () => Promise.resolve({ ok: true, value: { connections: [], active: null, showAi: true } }),
      aiSetPreferences: vi.fn(),
      openExternalUrl: vi.fn(),
    };
    const host = document.getElementById('host');
    const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), onAgent: vi.fn(), notify: vi.fn() });
    await wizard.open();
    await vi.waitFor(() => expect(host.querySelector('.ai-help-link')).not.toBeNull());

    host.querySelector('.ai-help-link').click();
    await vi.waitFor(() => expect(document.querySelector('.ai-guide')).not.toBeNull());
    document.querySelector('.ai-guide').remove();

    Element.prototype.scrollIntoView = vi.fn();
    const copilotItem = [...host.querySelectorAll('.ai-cat-card--agent .ai-detect__item')].find((li) => li.textContent.includes('Copilot'));
    copilotItem.querySelector('button').click();
    await vi.waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(Element.prototype.scrollIntoView.mock.contexts[0].dataset.anchor).toBe('github-copilot-el-comando-copilot-de-vs-code-no-es-la-cli');
    expect(backend.openExternalUrl).not.toHaveBeenCalled();
    document.querySelector('.ai-guide').remove();
  });
});

