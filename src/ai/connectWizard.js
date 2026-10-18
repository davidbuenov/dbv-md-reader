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

/** Enlaces de instalación de lo que no se encuentra (RF-31.1). */
export const INSTALL_LINKS = {
  ollama: 'https://ollama.com/download',
  lmStudio: 'https://lmstudio.ai',
  claude: 'https://docs.anthropic.com/en/docs/claude-code/setup',
  gemini: 'https://github.com/google-gemini/gemini-cli',
  codex: 'https://github.com/openai/codex',
  copilot: 'https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli',
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
 * @param {(tool: object) => void} [deps.onAgent] «Conectar» un agente detectado (RF-32).
 * @param {(message: string, tone?: string) => void} deps.notify
 */
export function createConnectWizard({ host, backend, onChanged, onAgent, notify }) {
  let providers = [];
  let file = { connections: [], active: null, showAi: true };

  async function render() {
    host.replaceChildren();
    const intro = el('p', 'ai-form__intro', t('ai.connectIntro'));
    const subscription = el('p', 'ai-form__note', t('ai.subscriptionNote'));
    const detected = el('section', 'ai-form__section');
    detected.append(el('h3', 'ai-form__title', t('ai.detectedTitle')), el('p', 'ai-form__hint', t('ai.detecting')));
    const mine = el('section', 'ai-form__section');
    const form = el('section', 'ai-form__section hidden');
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

  async function renderDetection(section, form) {
    const result = await backend.aiDetect();
    const detection = result.ok ? result.value : { servers: [], tools: [] };
    section.replaceChildren(el('h3', 'ai-form__title', t('ai.detectedTitle')));
    const list = el('ul', 'ai-detect');
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
      list.append(item);
    }
    const node = detection.tools.find((tool) => tool.name === 'node');
    for (const tool of detection.tools.filter((x) => ['claude', 'gemini', 'codex', 'copilot'].includes(x.name))) {
      const item = el('li', `ai-detect__item${tool.path ? ' is-ok' : ''}`);
      item.append(el('span', 'ai-detect__mark', tool.path ? '✓' : '○'));
      item.append(el('span', 'ai-detect__name', t(`ai.agent.${tool.name}`)));
      if (tool.path) {
        item.append(el('span', 'ai-detect__detail', t('ai.agentInstalled')));
        if (onAgent) item.append(button(t('ai.connectAgent'), () => onAgent({ ...tool, nodeAvailable: Boolean(node?.path) }), 'button button--primary button--compact'));
      } else {
        item.append(el('span', 'ai-detect__detail', t('ai.notInstalled')));
        item.append(button(t('ai.howToInstall'), () => backend.openExternalUrl(INSTALL_LINKS[tool.name]), 'button button--compact button--ghost'));
      }
      list.append(item);
    }
    section.append(list);
    section.append(button(t('ai.addCloud'), () => openForm(form, { provider: 'anthropic' }), 'button button--compact'));
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
        }
      });
      const provider = providers.find((p) => p.provider === connection.provider);
      item.append(radio, el('span', 'ai-conn__name', connection.name), el('span', 'ai-conn__detail', `${provider?.cloud ? '☁ ' : ''}${connection.model}`));
      // Un agente no tiene nada que editar: su cuenta y su modelo los lleva él.
      if (connection.provider !== 'agent') item.append(button(t('ai.edit'), () => openForm(form, connection), 'button button--compact button--ghost'));
      item.append(
        button(t('ai.delete'), async () => {
          const deleted = await backend.aiDeleteConnection(connection.id);
          if (deleted.ok) {
            file = deleted.value;
            onChanged(file);
            renderConnections(section, form);
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
      // `null` donde DBV no puede fijarlo; si no, desactivado salvo que se active.
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
      renderConnections(host.querySelectorAll('.ai-form__section')[1], section);
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
