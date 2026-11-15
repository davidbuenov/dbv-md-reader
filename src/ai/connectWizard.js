// =============================================================================
// dbv-md-reader — «Conectar una IA» (RF-31)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lo más sencillo posible: al abrirlo detecta lo que hay en el equipo (Ollama,
// LM Studio, agentes instalados) y lo ofrece con un botón; para la nube, se
// elige el proveedor, se pega la clave, se prueba la conexión y se elige el
// modelo de la lista que devuelve el propio proveedor. La clave va al almacén
// de credenciales del sistema y nunca vuelve al frontend: al editar una
// conexión, el campo queda vacío y «sin cambios» conserva la guardada.

import { getLanguage, t } from './i18nBridge.js';
import { adviceMessages, createModelInfoLookup } from './modelAdvice.js';
import { DEFAULT_CONTEXT_TOKENS, reasoningControl } from './modelFit.js';

/** Enlaces de instalación de lo que no se encuentra. */
export const INSTALL_LINKS = {
  ollama: 'https://ollama.com/download',
  lmStudio: 'https://lmstudio.ai',
  claude: 'https://docs.anthropic.com/en/docs/claude-code/setup',
  antigravity: 'https://antigravity.google/product/antigravity-cli',
  gemini: 'https://github.com/google-gemini/gemini-cli',
  codex: 'https://github.com/openai/codex',
  copilot: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli',
  cursor: 'https://cursor.com/cli',
  opencode: 'https://opencode.ai/docs/',
  node: 'https://nodejs.org',
};

/** Etiqueta traducida de un proveedor. */
const providerLabel = (provider) => t(`ai.provider.${provider}`);

/** Identificador nuevo para una conexión (sin `/`, estable). */
export function newConnectionId(provider) {
  return `${provider}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Nombre por defecto de una conexión. */
export function defaultName(provider, model) {
  const label = providerLabel(provider).split(' (')[0].split(' · ').at(-1);
  return model ? `${label} · ${model}` : label;
}

const DEFAULT_AGENT_LABELS = {
  antigravity: 'Gemini 4 Argon',
  agy: 'Gemini 4 Argon',
  claude: 'Claude Sonnet 5.5',
  codex: 'GPT-6-Luna',
  gemini: 'Gemini 3.8 Pro',
  copilot: 'Claude Sonnet 5.5',
};

/** Modelo concreto por defecto de cada agente CLI cuando la conexión aún guarda el id genérico. */
export const DEFAULT_AGENT_MODELS = {
  antigravity: 'gemini-4-argon',
  agy: 'gemini-4-argon',
  claude: 'claude-sonnet-5-5',
  codex: 'gpt-6-luna',
  gemini: 'gemini-4-argon',
  copilot: 'claude-sonnet-5-5',
};

const KNOWN_MODEL_LABELS = {
  'gemini-4-argon': 'Gemini 4 Argon',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'gemini-3.8-pro': 'Gemini 3.8 Pro',
  'gemini-3.8-flash-lite': 'Gemini 3.8 Flash Lite',
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-fable-5-1': 'Claude Fable 5.1',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-opus-5': 'Claude Opus 5',
  'claude-fable-5': 'Claude Fable 5',
  'gpt-6-luna': 'GPT-6-Luna',
  'gpt-5.6-terra': 'GPT-5.6-Terra',
  'gpt-5.6-luna': 'GPT-5.6-Luna',
  'gpt-oss-120b': 'GPT-OSS 120B',
};

const EFFORT_SHORT_LABELS = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
  ultra: 'Ultra',
};

/**
 * Normaliza la respuesta de `aiListAgentModels` tanto si viene como objetos
 * `{ id, label, efforts, defaultEffort }` del backend Rust como si viene como
 * lista de strings simples en mocks de test.
 */
export function normalizeAgentModels(rawList, fallbackId = 'default') {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [
      {
        id: fallbackId,
        label: DEFAULT_AGENT_LABELS[fallbackId] || fallbackId,
        efforts: ['low', 'medium', 'high'],
        defaultEffort: 'medium',
      },
    ];
  }
  return rawList.map((entry) => {
    if (typeof entry === 'string') {
      return {
        id: entry,
        label: entry,
        efforts: ['low', 'medium', 'high'],
        defaultEffort: 'medium',
      };
    }
    const efforts = Array.isArray(entry.efforts) && entry.efforts.length > 0
      ? entry.efforts
      : ['low', 'medium', 'high'];
    return {
      id: entry.id,
      label: entry.label || entry.id,
      efforts,
      defaultEffort: entry.defaultEffort || (efforts.includes('medium') ? 'medium' : efforts[0]),
    };
  });
}

function isGenericOrCorruptedModel(modelId, agentKey) {
  if (!modelId) return true;
  if (modelId === agentKey || ['antigravity', 'agy', 'claude', 'codex', 'gemini', 'copilot', 'cursor', 'opencode', 'claude-sonnet', 'default'].includes(modelId)) {
    return true;
  }
  if (modelId.includes('|') || modelId.includes('**') || modelId.length > 64) {
    return true;
  }
  return false;
}

/**
 * Resuelve el identificador de modelo real que se debe pasar al agente ACP:
 * si la conexión tiene un id genérico (`"claude"`, `"codex"`…), usa el modelo
 * por defecto que muestra la interfaz (`DEFAULT_AGENT_MODELS`).
 */
export function resolveAgentModel(agentKey, rawModel) {
  let result = rawModel;
  if (isGenericOrCorruptedModel(rawModel, agentKey)) {
    result = DEFAULT_AGENT_MODELS[agentKey] || rawModel || agentKey;
  }
  return result;
}

/**
 * Formatea el resumen estilo Visual Studio (`"Gemini 4 Argon Medium"`, `"Claude Sonnet 5.5 Medium"`).
 */
export function formatAgentSummary(connection, agentKey, models = null) {
  const rawModel = connection?.model || '';
  let matched = null;
  if (Array.isArray(models) && models.length > 0) {
    matched = models.find((m) => m.id === rawModel || rawModel.startsWith(`${m.id}-`)) || models[0];
  }
  let modelLabel = matched?.label;
  if (!modelLabel) {
    if (isGenericOrCorruptedModel(rawModel, agentKey)) {
      modelLabel = DEFAULT_AGENT_LABELS[agentKey] || agentKey;
    } else {
      modelLabel = KNOWN_MODEL_LABELS[rawModel] || rawModel;
    }
  }
  const rawEffort = connection?.reasoningEffort
    || (connection?.reasoning === false ? 'off' : matched?.defaultEffort || 'medium');
  const effortLabel = EFFORT_SHORT_LABELS[rawEffort] || EFFORT_SHORT_LABELS.medium;
  return `${modelLabel} ${effortLabel}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick, className = 'button button--compact') {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function field(labelText, control, hint = '') {
  const row = el('label', 'ai-form__row');
  row.append(el('span', 'ai-form__label', labelText), control);
  if (hint) row.append(el('span', 'ai-form__hint', hint));
  return row;
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.host Cuerpo del panel flotante.
 * @param {object} deps.backend `aiProviders`, `aiDetect`, `aiListModels`, `aiSaveConnection`, `aiDeleteConnection`, `aiSetPreferences`, `openExternalUrl`.
 * @param {(file: object) => void} deps.onChanged Se guardaron o borraron conexiones.
 * @param {(tool: object) => void} [deps.onAgent] «Conectar» un agente detectado.
 * @param {(message: string, tone?: string) => void} deps.notify
 */
export function createConnectWizard({ host, backend, onChanged, onAgent, notify }) {
  let providers = [];
  let file = { connections: [], active: null, showAi: true };
  let detectedSection = null;
  let mineSection = null;
  let formSection = null;
  const agentModelsCache = new Map();
  const agentModelsInflight = new Map();

  /** Abre la guía de conexión de IAs (se carga solo ahora), opcionalmente en una sección. */
  async function openGuide(section) {
    const guide = await import('./guide.js');
    return guide.openGuide({ section, openExternalUrl: (url) => backend.openExternalUrl(url) });
  }

  function updateAgentSummaries(agentKey, models) {
    const conn = file.connections.find((c) => isAgentMatch(c, agentKey));
    if (!conn) return;
    if (Array.isArray(models) && models.length > 0 && isGenericOrCorruptedModel(conn.model, agentKey)) {
      conn.model = models[0].id;
    }
    const summaryText = formatAgentSummary(conn, agentKey, models);
    host.querySelectorAll(`[data-agent-summary="${agentKey}"]`).forEach((node) => {
      node.textContent = summaryText;
    });
    host.querySelectorAll(`[data-conn-summary="${agentKey}"]`).forEach((node) => {
      node.textContent = summaryText;
    });
  }

  async function loadAgentModels(agentKey, forceRefresh = false) {
    if (!forceRefresh && agentModelsCache.has(agentKey)) {
      return agentModelsCache.get(agentKey);
    }
    if (!forceRefresh && agentModelsInflight.has(agentKey)) {
      return agentModelsInflight.get(agentKey);
    }
    if (typeof backend.aiListAgentModels !== 'function') {
      const fallback = normalizeAgentModels([], agentKey);
      agentModelsCache.set(agentKey, fallback);
      return fallback;
    }
    const promise = (async () => {
      const res = forceRefresh
        ? await backend.aiListAgentModels(agentKey, true)
        : await backend.aiListAgentModels(agentKey);
      const models = normalizeAgentModels(res?.ok ? res.value : [], agentKey);
      agentModelsCache.set(agentKey, models);
      agentModelsInflight.delete(agentKey);
      updateAgentSummaries(agentKey, models);
      return models;
    })();
    agentModelsInflight.set(agentKey, promise);
    return promise;
  }

  async function render() {
    host.replaceChildren();
    const intro = el('p', 'ai-form__intro', t('ai.connectIntro'));
    const subscription = el('p', 'ai-form__note', t('ai.subscriptionNote'));
    const detected = el('section', 'ai-form__section');
    detected.append(el('h3', 'ai-form__title', t('ai.detectedTitle')), el('p', 'ai-form__hint', t('ai.detecting')));
    const mine = el('section', 'ai-form__section');
    const form = el('section', 'ai-form__section hidden');
    detectedSection = detected;
    mineSection = mine;
    formSection = form;
    const show = el('label', 'ai-form__toggle');
    const showBox = document.createElement('input');
    showBox.type = 'checkbox';
    showBox.checked = file.showAi !== false;
    showBox.addEventListener('change', async () => {
      const saved = await backend.aiSetPreferences({ showAi: showBox.checked });
      document.dispatchEvent(new CustomEvent('dbv-ai-show-changed', { detail: { show: showBox.checked } }));
      if (saved.ok) {
        file = saved.value;
        onChanged(file);
      }
    });
    show.append(showBox, el('span', '', t('ai.showAi')));
    host.append(intro, subscription, detected, mine, form, show);
    renderConnections(mine, form);
    renderDetection(detected, form);
  }

  const isAgentMatch = (connection, name) => {
    if (connection.provider !== 'agent') return false;
    if (connection.baseUrl === `acp:${name}` || connection.model === name) return true;
    if (name === 'antigravity' && (connection.baseUrl === 'acp:antigravity' || connection.model === 'antigravity' || connection.model === 'agy')) return true;
    return false;
  };

  const isAgentConnected = (name) => file.connections.some((c) => isAgentMatch(c, name));
  const isAgentActive = (name) => file.connections.some((c) => c.id === file.active && isAgentMatch(c, name));

  async function toggleAgentSettings(item, connection, agentKey) {
    const existingPanel = item.parentElement?.querySelector(`.ai-agent-settings[data-agent="${agentKey}"]`);
    if (existingPanel) {
      existingPanel.remove();
      return;
    }
    item.parentElement?.querySelectorAll('.ai-agent-settings').forEach((p) => p.remove());

    const panel = el('div', 'ai-agent-settings');
    panel.dataset.agent = agentKey;

    const rowModel = el('div', 'ai-agent-settings__row');
    const labelModel = el('label', 'ai-agent-settings__label', t('ai.agentModel'));
    const modelControl = el('div', 'ai-agent-settings__control');
    const modelSelect = el('select', 'form-row__input ai-agent-settings__select');
    const optLoading = document.createElement('option');
    optLoading.textContent = '…';
    modelSelect.append(optLoading);

    const refreshBtn = button('🔄', async () => {
      refreshBtn.disabled = true;
      modelSelect.disabled = true;
      const refreshedModels = await loadAgentModels(agentKey, true);
      populateModelAndEffort(refreshedModels);
      modelSelect.disabled = false;
      refreshBtn.disabled = false;
      notify(t('ai.agentModelsRefreshed'));
    }, 'button button--compact button--ghost ai-agent-refresh');
    refreshBtn.title = t('ai.agentRefreshModels');

    modelControl.append(modelSelect, refreshBtn);
    rowModel.append(labelModel, modelControl);

    const rowReasoning = el('div', 'ai-agent-settings__row');
    const labelReasoning = el('label', 'ai-agent-settings__label', t('ai.agentReasoning'));
    const reasoningSelect = el('select', 'form-row__input ai-agent-settings__select');
    rowReasoning.append(labelReasoning, reasoningSelect);

    function populateEffortOptions(selectedModel, preferredEffort) {
      reasoningSelect.replaceChildren();
      const supported = Array.isArray(selectedModel?.efforts) && selectedModel.efforts.length > 0
        ? selectedModel.efforts
        : ['low', 'medium', 'high'];
      const keys = ['off', ...supported.filter((k) => k !== 'off')];
      const targetEffort = keys.includes(preferredEffort)
        ? preferredEffort
        : (selectedModel?.defaultEffort && keys.includes(selectedModel.defaultEffort) ? selectedModel.defaultEffort : 'medium');
      for (const key of keys) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = t(`ai.reasoning.${key}`);
        if (key === targetEffort) {
          opt.selected = true;
        }
        reasoningSelect.append(opt);
      }
    }

    let currentModels = [];
    function populateModelAndEffort(models) {
      currentModels = models;
      modelSelect.replaceChildren();
      const matched = models.find((m) => m.id === connection.model || (connection.model && connection.model.startsWith(`${m.id}-`))) || models[0];
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.label;
        if (matched && m.id === matched.id) {
          opt.selected = true;
        }
        modelSelect.append(opt);
      }
      const initialEffort = connection.reasoningEffort ?? (connection.reasoning === false ? 'off' : matched?.defaultEffort || 'medium');
      populateEffortOptions(matched, initialEffort);
    }

    modelSelect.addEventListener('change', () => {
      const selected = currentModels.find((m) => m.id === modelSelect.value) || currentModels[0];
      populateEffortOptions(selected, reasoningSelect.value);
    });

    populateEffortOptions(null, connection.reasoningEffort ?? (connection.reasoning === false ? 'off' : 'medium'));

    const rowActions = el('div', 'ai-agent-settings__actions');
    const saveBtn = button(t('ai.save'), async () => {
      saveBtn.disabled = true;
      const updated = {
        ...connection,
        model: modelSelect.value,
        reasoningEffort: reasoningSelect.value,
        reasoning: reasoningSelect.value !== 'off',
      };
      const active = isAgentActive(agentKey) || connection.id === file.active;
      const saved = await backend.aiSaveConnection(updated, null, active);
      if (saved.ok) {
        file = saved.value.file;
        onChanged(file);
        notify(t('ai.agentSettingsSaved'));
        panel.remove();
        if (mineSection && formSection) renderConnections(mineSection, formSection);
        if (detectedSection && formSection) renderDetection(detectedSection, formSection);
      } else {
        notify(saved.error.message, 'error');
        saveBtn.disabled = false;
      }
    }, 'button button--primary button--compact');
    rowActions.append(saveBtn);

    panel.append(rowModel, rowReasoning, rowActions);
    item.after(panel);

    const models = await loadAgentModels(agentKey, false);
    populateModelAndEffort(models);
  }

  async function renderDetection(section, form) {
    const result = await backend.aiDetect();
    const detection = result.ok ? result.value : { servers: [], tools: [] };
    section.replaceChildren(el('h3', 'ai-form__title', t('ai.detectedTitle')));

    // 1. IAs Locales (100% Offline y Privacidad)
    const localCard = el('div', 'ai-cat-card ai-cat-card--local');
    const localHeader = el('div', 'ai-cat-card__header');
    localHeader.append(
      el('h4', 'ai-cat-card__title', t('ai.cat.local')),
      el('p', 'ai-cat-card__hint', t('ai.cat.localHint')),
    );
    localCard.append(localHeader);
    const localList = el('ul', 'ai-detect');
    for (const server of detection.servers) {
      const item = el('li', `ai-detect__item${server.running ? ' is-ok' : ''}`);
      item.append(el('span', 'ai-detect__mark', server.running ? '✓' : '○'));
      item.append(el('span', 'ai-detect__name', providerLabel(server.provider)));
      if (server.running) {
        item.append(el('span', 'ai-detect__detail', t('ai.modelsFound').replace('{n}', String(server.models.length))));
        item.append(button(t('ai.use'), () => openForm(form, { provider: server.provider, model: server.models[0] ?? '' }, server.models), 'button button--primary button--compact'));
      } else {
        item.append(el('span', 'ai-detect__detail', t('ai.notRunning')));
        item.append(button(t('ai.howToInstall'), () => backend.openExternalUrl(INSTALL_LINKS[server.provider]), 'button button--compact button--ghost'));
      }
      localList.append(item);
    }
    localCard.append(localList);

    // 2. IAs por Suscripción (Agentes ACP)
    const agentCard = el('div', 'ai-cat-card ai-cat-card--agent');
    const agentHeader = el('div', 'ai-cat-card__header');
    agentHeader.append(
      el('h4', 'ai-cat-card__title', t('ai.cat.subscription')),
      el('p', 'ai-cat-card__hint', t('ai.cat.subscriptionHint')),
    );
    agentCard.append(agentHeader);
    const agentList = el('ul', 'ai-detect');
    const node = detection.tools.find((tool) => tool.name === 'node');

    function appendAgentItem(tool, agentKey, agentLabel) {
      const hasPath = Boolean(tool?.path);
      const item = el('li', `ai-detect__item${hasPath ? ' is-ok' : ''}`);
      item.append(el('span', 'ai-detect__mark', hasPath ? '✓' : '○'));
      item.append(el('span', 'ai-detect__name', agentLabel));
      if (hasPath) {
        item.append(el('span', 'ai-detect__detail', t('ai.agentInstalled')));
        if (isAgentConnected(agentKey)) {
          const active = isAgentActive(agentKey);
          const conn = file.connections.find((c) => isAgentMatch(c, agentKey));
          if (conn) {
            const summaryBadge = el(
              'span',
              'ai-agent-summary',
              formatAgentSummary(conn, agentKey, agentModelsCache.get(agentKey)),
            );
            summaryBadge.dataset.agentSummary = agentKey;
            item.append(summaryBadge);
            if (!agentModelsCache.has(agentKey)) {
              void loadAgentModels(agentKey, false);
            }
          }
          item.append(el('span', `ai-badge ${active ? 'ai-badge--active' : 'ai-badge--connected'}`, active ? `✓ ${t('ai.active')}` : `✓ ${t('ai.connected')}`));
          if (conn) {
            const gearBtn = button('⚙️', () => toggleAgentSettings(item, conn, agentKey), 'button button--compact button--ghost ai-agent-gear');
            gearBtn.title = t('ai.agentSettings');
            item.append(gearBtn);
          }
        } else if (onAgent) {
          item.append(
            button(
              t('ai.connectAgent'),
              async () => {
                await onAgent({ ...tool, nodeAvailable: Boolean(node?.path) });
                const refreshed = await backend.aiConnections();
                if (refreshed.ok) file = refreshed.value;
                if (mineSection && formSection) renderConnections(mineSection, formSection);
                if (detectedSection && formSection) renderDetection(detectedSection, formSection);
              },
              'button button--primary button--compact',
            ),
          );
        }
      } else {
        item.append(el('span', 'ai-detect__detail', t('ai.notInstalled')));
        // Copilot: lo habitual es tener solo el lanzador `copilot` de VS Code; la guía explica cómo instalar la CLI.
        const install = agentKey === 'copilot' ? () => openGuide('copilot') : () => backend.openExternalUrl(INSTALL_LINKS[agentKey]);
        item.append(button(t('ai.howToInstall'), install, 'button button--compact button--ghost'));
      }
      agentList.append(item);
    }

    // Antigravity: la CLI `agy` no habla ACP; solo se puede conectar con su servidor `agy_acp_server`.
    const agyServer = detection.tools.find((tool) => tool.name === 'agy_acp_server' && tool.path);
    const agyCli = detection.tools.find((tool) => ['antigravity', 'agy'].includes(tool.name) && tool.path);
    if (detection.tools.length > 0 && !agyServer && agyCli) {
      const item = el('li', 'ai-detect__item');
      item.append(
        el('span', 'ai-detect__mark', '○'),
        el('span', 'ai-detect__name', t('ai.agent.antigravity')),
        el('span', 'ai-detect__detail', t('ai.agentNoAcp')),
        button(t('ai.howToInstall'), () => openGuide('antigravity'), 'button button--compact button--ghost'),
      );
      agentList.append(item);
    } else if (detection.tools.length > 0) {
      appendAgentItem(agyServer ? { name: 'antigravity', path: agyServer.path, nodeAvailable: true } : null, 'antigravity', t('ai.agent.antigravity'));
    }

    // Otros agentes estándar
    for (const tool of detection.tools.filter((x) => ['claude', 'gemini', 'codex', 'copilot'].includes(x.name))) {
      appendAgentItem(tool, tool.name, t(`ai.agent.${tool.name}`));
    }
    // Cursor (`agent acp`, antes `cursor-agent`) y OpenCode (`opencode acp`), con los comandos que usa el Unreal Assistant de UE 5.9.
    if (detection.tools.length > 0) {
      const cursor = detection.tools.find((x) => ['cursor-agent', 'agent'].includes(x.name) && x.path) ?? detection.tools.find((x) => x.name === 'agent');
      appendAgentItem(cursor ? { ...cursor, name: 'cursor' } : null, 'cursor', t('ai.agent.cursor'));
      appendAgentItem(detection.tools.find((x) => x.name === 'opencode') ?? null, 'opencode', t('ai.agent.opencode'));
    }
    if (detection.tools.length > 0) {
      agentCard.append(agentList);
    }

    // 3. IAs en la nube con clave de API
    const cloudCard = el('div', 'ai-cat-card ai-cat-card--cloud');
    const cloudHeader = el('div', 'ai-cat-card__header');
    cloudHeader.append(
      el('h4', 'ai-cat-card__title', t('ai.cat.cloud')),
      el('p', 'ai-cat-card__hint', t('ai.cat.cloudHint')),
    );
    const cloudAction = el('div', 'ai-cat-card__actions');
    cloudAction.append(button(t('ai.addCloud'), () => openForm(form, { provider: 'anthropic' }), 'button button--compact'));
    cloudCard.append(cloudAction);

    // La guía de conexión de IAs, dentro de la app (la misma en todas las apps DBV).
    const helpBtn = el('button', 'ai-help-link', t('ai.helpLink'));
    helpBtn.type = 'button';
    helpBtn.addEventListener('click', () => {
      void openGuide();
    });

    const cards = [localCard];
    if (detection.tools.length > 0) cards.push(agentCard);
    cards.push(cloudCard, helpBtn);
    section.append(...cards);
  }

  function renderConnections(section, form) {
    section.replaceChildren(el('h3', 'ai-form__title', t('ai.myConnections')));
    if (!file.connections.length) {
      section.append(el('p', 'ai-form__hint', t('ai.noConnections')));
      return;
    }
    const list = el('ul', 'ai-conn');
    for (const connection of file.connections) {
      const item = el('li', 'ai-conn__item');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'ai-active-connection';
      radio.checked = connection.id === file.active;
      radio.title = t('ai.makeActive');
      radio.addEventListener('change', async () => {
        const saved = await backend.aiSetPreferences({ active: connection.id });
        if (saved.ok) {
          file = saved.value;
          onChanged(file);
          if (detectedSection && formSection) renderDetection(detectedSection, formSection);
        }
      });
      const provider = providers.find((p) => p.provider === connection.provider);
      
      // Badge semántico de categoría
      let badgeClass = 'ai-badge--local';
      let badgeText = t('ai.badge.local');
      if (connection.provider === 'agent') {
        badgeClass = 'ai-badge--agent';
        badgeText = t('ai.badge.agent');
      } else if (provider?.cloud) {
        badgeClass = 'ai-badge--cloud';
        badgeText = t('ai.badge.cloud');
      }
      const badge = el('span', `ai-badge ${badgeClass}`, badgeText);

      const agentKey = connection.provider === 'agent'
        ? (connection.baseUrl.replace(/^acp:/, '') || connection.model)
        : null;
      const detailText = connection.provider === 'agent'
        ? formatAgentSummary(connection, agentKey, agentModelsCache.get(agentKey))
        : `${provider?.cloud ? '☁ ' : ''}${connection.model}`;
      const detailEl = el('span', 'ai-conn__detail', detailText);
      if (agentKey) {
        detailEl.dataset.connSummary = agentKey;
      }

      item.append(radio, el('span', 'ai-conn__name', connection.name), badge, detailEl);
      if (connection.provider === 'agent') {
        const gearBtn = button('⚙️', () => toggleAgentSettings(item, connection, agentKey), 'button button--compact button--ghost ai-agent-gear');
        gearBtn.title = t('ai.agentSettings');
        item.append(gearBtn);
      } else {
        item.append(button(t('ai.edit'), () => openForm(form, connection), 'button button--compact button--ghost'));
      }
      item.append(
        button(t('ai.delete'), async () => {
          const deleted = await backend.aiDeleteConnection(connection.id);
          if (deleted.ok) {
            file = deleted.value;
            onChanged(file);
            renderConnections(section, form);
            if (detectedSection && formSection) renderDetection(detectedSection, formSection);
          } else notify(deleted.error.message, 'error');
        }, 'button button--compact button--ghost'),
      );
      list.append(item);
    }
    section.append(list);
  }

  function openForm(section, initial, knownModels = []) {
    const editing = file.connections.find((c) => c.id === initial.id) ?? null;
    section.classList.remove('hidden');
    section.replaceChildren(el('h3', 'ai-form__title', editing ? t('ai.editConnection') : t('ai.newConnection')));
    const providerSelect = el('select', 'form-row__input');
    for (const p of providers.filter((x) => x.provider !== 'agent')) providerSelect.append(new Option(providerLabel(p.provider), p.provider, false, p.provider === initial.provider));
    providerSelect.disabled = Boolean(editing);
    const name = el('input', 'form-row__input');
    name.value = editing?.name ?? '';
    const url = el('input', 'form-row__input');
    url.spellcheck = false;
    const key = el('input', 'form-row__input');
    key.type = 'password';
    key.autocomplete = 'off';
    key.spellcheck = false;
    const model = el('input', 'form-row__input');
    model.spellcheck = false;
    // Con la lista de modelos del proveedor, un desplegable con TODOS (una `datalist` solo
    // enseña los que coinciden con lo ya escrito) y «Otro…» para escribir uno a mano.
    const modelSelect = el('select', 'form-row__input hidden');
    modelSelect.setAttribute('aria-label', t('ai.model'));
    const modelBox = el('div', 'ai-form__model');
    modelBox.append(modelSelect, model);
    const OTHER_MODEL = '__other__';
    let modelList = [];
    const context = el('input', 'form-row__input');
    context.type = 'number';
    context.min = '1024';
    const maxOutput = el('input', 'form-row__input');
    maxOutput.type = 'number';
    maxOutput.min = '256';
    const tools = el('select', 'form-row__input');
    tools.append(new Option(t('ai.toolsAuto'), ''), new Option(t('ai.yes'), 'true'), new Option(t('ai.no'), 'false'));
    const reasoning = el('select', 'form-row__input');
    reasoning.append(new Option(t('ai.reasoningOff'), 'false'), new Option(t('ai.reasoningOn'), 'true'));
    const reasoningRow = field(t('ai.reasoning'), reasoning, t('ai.reasoningHint'));
    const advice = el('div', 'ai-form__advice');
    advice.setAttribute('aria-live', 'polite');
    const status = el('p', 'ai-form__status');
    status.setAttribute('aria-live', 'polite');
    const keyRow = field(t('ai.apiKey'), key, editing?.hasKey ? t('ai.keyStored') : t('ai.keyHint'));

    /** Pone al día el desplegable y el campo de texto según la lista y el valor actual. */
    const syncModelControl = () => {
      const hasList = modelList.length > 0;
      modelSelect.classList.toggle('hidden', !hasList);
      const known = modelList.includes(model.value);
      model.classList.toggle('hidden', hasList && known);
      if (hasList) modelSelect.value = known ? model.value : OTHER_MODEL;
    };
    const setModels = (models) => {
      modelList = models;
      modelSelect.replaceChildren(...models.map((m) => new Option(m, m)), new Option(t('ai.modelOther'), OTHER_MODEL));
      syncModelControl();
    };
    modelSelect.addEventListener('change', () => {
      if (modelSelect.value === OTHER_MODEL) {
        model.value = '';
        syncModelControl();
        model.focus();
        return;
      }
      model.value = modelSelect.value;
      syncModelControl();
      model.dispatchEvent(new Event('change'));
    });
    setModels(knownModels);
    const sync = () => {
      const info = providers.find((p) => p.provider === providerSelect.value);
      if (!editing || url.value === '') url.value = editing?.baseUrl ?? info?.baseUrl ?? '';
      context.placeholder = String(info?.contextTokens ?? DEFAULT_CONTEXT_TOKENS);
      // El tope real que se aplicará con el campo vacío: las nubes no tienen uno por defecto.
      maxOutput.placeholder = info?.maxOutputTokens ? String(info.maxOutputTokens) : t('ai.maxOutputNone');
      keyRow.classList.toggle('hidden', !(info?.cloud || providerSelect.value === 'openAiCompatible'));
    };
    providerSelect.addEventListener('change', () => {
      url.value = '';
      sync();
    });
    sync();
    model.value = editing?.model ?? initial.model ?? '';
    syncModelControl();
    context.value = editing?.contextTokens ? String(editing.contextTokens) : '';
    maxOutput.value = editing?.maxOutputTokens ? String(editing.maxOutputTokens) : '';
    tools.value = editing?.supportsTools === undefined || editing?.supportsTools === null ? '' : String(editing.supportsTools);
    reasoning.value = editing?.reasoning === true ? 'true' : 'false';

    const draft = () => ({
      id: editing?.id ?? newConnectionId(providerSelect.value),
      name: name.value.trim() || defaultName(providerSelect.value, model.value.trim()),
      provider: providerSelect.value,
      baseUrl: url.value.trim(),
      model: model.value.trim(),
      hasKey: Boolean(editing?.hasKey),
      contextTokens: context.value ? Number(context.value) : null,
      maxOutputTokens: maxOutput.value ? Number(maxOutput.value) : null,
      supportsTools: tools.value === '' ? null : tools.value === 'true',
      supportsImages: editing?.supportsImages ?? null,
      // `null` donde la app no puede fijarlo; si no, desactivado salvo que se active.
      reasoning: reasoning.disabled ? null : reasoning.value === 'true',
    });

    // Avisos del modelo y control del razonamiento: con Ollama se pregunta
    // a `/api/show`; con el resto no hay datos y solo se avisa del contexto.
    const lookupModelInfo = createModelInfoLookup((connection) => backend.aiModelInfo(connection));
    let adviceRun = 0;
    const refreshAdvice = async () => {
      const run = (adviceRun += 1);
      const connection = draft();
      const info = connection.provider === 'ollama' && connection.model ? await lookupModelInfo(connection) : null;
      if (run !== adviceRun) return;
      const control = reasoningControl({ provider: connection.provider, info });
      reasoning.disabled = control !== 'available';
      if (reasoning.disabled) reasoning.value = 'false';
      const hints = { available: 'ai.reasoningHint', unsupported: 'ai.reasoningUnsupported', unavailable: 'ai.reasoningUnavailable' };
      reasoningRow.querySelector('.ai-form__hint').textContent = t(hints[control]);
      const providerInfo = providers.find((p) => p.provider === connection.provider);
      // El razonamiento que cuenta es el del interruptor tal como ha quedado, no el del borrador de antes de evaluarlo.
      const messages = adviceMessages({ info, connection: { ...connection, reasoning: reasoning.value === 'true' }, providerInfo, lang: getLanguage() }, t);
      advice.replaceChildren(...messages.map((text) => el('p', 'ai-advice', text)));
    };
    for (const control of [model, context, tools, reasoning]) control.addEventListener('change', refreshAdvice);
    providerSelect.addEventListener('change', refreshAdvice);

    const test = button(t('ai.test'), async () => {
      status.className = 'ai-form__status';
      status.textContent = t('ai.testing');
      const result = await backend.aiListModels(draft(), key.value || null);
      if (result.ok) {
        if (!model.value && result.value[0]) model.value = result.value[0];
        setModels(result.value);
        status.classList.add('is-ok');
        status.textContent = t('ai.testOk').replace('{n}', String(result.value.length));
        refreshAdvice();
      } else {
        status.classList.add('is-error');
        status.textContent = `${t(`ai.error.${result.error.kind}`)} ${result.error.message}`;
      }
    });
    const save = button(t('ai.save'), async () => {
      const connection = draft();
      if (!connection.model) {
        status.className = 'ai-form__status is-error';
        status.textContent = t('ai.needModel');
        return;
      }
      const saved = await backend.aiSaveConnection(connection, key.value ? key.value : null, true);
      if (!saved.ok) {
        status.className = 'ai-form__status is-error';
        status.textContent = saved.error.message;
        return;
      }
      file = saved.value.file;
      if (saved.value.keyStorage === 'session') notify(t('ai.keySessionOnly'), 'error');
      key.value = '';
      section.classList.add('hidden');
      onChanged(file);
      if (mineSection) renderConnections(mineSection, section);
      if (detectedSection) renderDetection(detectedSection, section);
      notify(t('ai.saved'));
    }, 'button button--primary button--compact');
    const cancel = button(t('action.cancel'), () => section.classList.add('hidden'), 'button button--compact button--ghost');
    const forget = editing?.hasKey ? button(t('ai.forgetKey'), async () => {
      const saved = await backend.aiSaveConnection(draft(), '', false);
      if (saved.ok) {
        file = saved.value.file;
        onChanged(file);
        keyRow.querySelector('.ai-form__hint').textContent = t('ai.keyHint');
      }
    }, 'button button--compact button--ghost') : null;

    section.append(
      field(t('ai.provider'), providerSelect),
      field(t('ai.name'), name),
      field(t('ai.url'), url, t('ai.urlHint')),
      keyRow,
      field(t('ai.model'), modelBox),
      advice,
      field(t('ai.contextTokens'), context, t('ai.contextHint')),
      field(t('ai.maxOutput'), maxOutput, t('ai.maxOutputHint')),
      field(t('ai.supportsTools'), tools, t('ai.toolsHint')),
      reasoningRow,
      status,
    );
    const row = el('div', 'ai-form__actions');
    row.append(test, save, cancel);
    if (forget) row.append(forget);
    section.append(row);
    name.placeholder = defaultName(providerSelect.value, model.value);
    refreshAdvice();
    section.scrollIntoView?.({ block: 'nearest' });
  }

  return {
    async open() {
      const [list, loaded] = await Promise.all([backend.aiProviders(), backend.aiConnections()]);
      providers = list.ok ? list.value : [];
      if (loaded.ok) file = loaded.value;
      await render();
    },
  };
}
