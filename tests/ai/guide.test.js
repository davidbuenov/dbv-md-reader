// =============================================================================
// dbv-tauri-starter — Tests de la guía de conexión de IAs dentro de la app
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTranslations } from '../../src/ai/i18nBridge.js';
import { AI_TRANSLATIONS } from '../../src/ai/translations.js';
import { GUIDE } from '../../src/ai/guideContent.js';
import { GUIDE_SECTIONS, guideText, openGuide, renderGuide } from '../../src/ai/guide.js';
import { parseBlocks, renderMarkdown, slugify } from '../../src/ai/markdown.js';

registerTranslations(AI_TRANSLATIONS);

beforeEach(() => {
  document.body.innerHTML = '';
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Markdown para la guía', () => {
  it('calcula las anclas como GitHub', () => {
    expect(slugify('Google Antigravity: instalar su servidor ACP')).toBe('google-antigravity-instalar-su-servidor-acp');
    expect(slugify("GitHub Copilot: VS Code's `copilot` command is not the CLI")).toBe('github-copilot-vs-codes-copilot-command-is-not-the-cli');
    expect(slugify('3. Con tu suscripción: agentes instalados')).toBe('3-con-tu-suscripción-agentes-instalados');
  });

  it('una lista numerada sigue la numeración aunque un paso lleve una tabla o código con líneas en blanco', () => {
    const blocks = parseBlocks('1. Uno\n2. Dos:\n\n   | A | B |\n   | --- | --- |\n   | 1 | 2 |\n\n   ```bash\n   echo hola\n   ```\n\n3. Tres');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].items.map((item) => item.text)).toEqual(['Uno', 'Dos:', 'Tres']);
    expect(blocks[0].items[1].children.map((child) => child.type)).toEqual(['table', 'code']);
    expect(parseBlocks('4. Cuatro\n5. Cinco')[0].start).toBe(4);
  });

  it('los enlaces #ancla solo se siguen si quien pinta lo pide (el chat no)', () => {
    const chat = document.createElement('div');
    chat.append(renderMarkdown('Ver [abajo](#seccion).'));
    expect(chat.querySelector('a')).toBeNull();
    const onAnchorLink = vi.fn();
    const guide = document.createElement('div');
    guide.append(renderMarkdown('Ver [abajo](#seccion).', { onAnchorLink }));
    guide.querySelector('a').click();
    expect(onAnchorLink).toHaveBeenCalledWith('seccion');
  });
});

describe('texto de la guía (generado desde la plantilla común)', () => {
  it('existe en español e inglés, sin la línea de navegación ni la marca', () => {
    for (const lang of ['es', 'en']) {
      expect(GUIDE[lang]).toMatch(/^# 🤖 /);
      expect(GUIDE[lang]).not.toContain('{{APP_NAME}}');
      expect(GUIDE[lang]).not.toContain('> 🌐');
      expect(GUIDE[lang]).not.toContain('dbv-ia:fin-guia-comun');
    }
    expect(guideText('fr')).toBe(GUIDE.es);
  });

  it('todas las secciones a las que se salta existen en los dos idiomas', () => {
    for (const lang of ['es', 'en']) {
      const host = document.createElement('div');
      renderGuide(host, { lang });
      const anchors = [...host.querySelectorAll('[data-anchor]')].map((node) => node.dataset.anchor);
      for (const section of Object.values(GUIDE_SECTIONS)) expect(anchors).toContain(section[lang]);
    }
  });

  it('cada enlace interno de la guía lleva a un encabezado que existe', () => {
    for (const lang of ['es', 'en']) {
      const host = document.createElement('div');
      renderGuide(host, { lang });
      const anchors = new Set([...host.querySelectorAll('[data-anchor]')].map((node) => node.dataset.anchor));
      const targets = [...GUIDE[lang].matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]);
      expect(targets.length).toBeGreaterThan(3);
      for (const target of targets) expect(anchors.has(target)).toBe(true);
    }
  });
});

describe('ventana de la guía', () => {
  it('se abre, salta a la sección pedida y se cierra con Esc', async () => {
    const openExternalUrl = vi.fn();
    const guide = openGuide({ section: 'antigravity', lang: 'es', openExternalUrl });
    expect(document.querySelector('.ai-guide')).toBe(guide.element);
    // El título va en el idioma de la interfaz; el texto, en el que se pida.
    expect(guide.element.querySelector('.ai-guide__title').textContent).toMatch(/^(Guía: conectar una IA|Guide: connecting an AI)$/);
    await vi.waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(Element.prototype.scrollIntoView.mock.contexts[0].dataset.anchor).toBe('google-antigravity-instalar-su-servidor-acp');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.ai-guide')).toBeNull();
  });

  it('los enlaces externos van al navegador del sistema y no hay imágenes ni navegación', () => {
    const openExternalUrl = vi.fn();
    const guide = openGuide({ lang: 'en', openExternalUrl });
    expect(guide.element.querySelector('img')).toBeNull();
    const external = guide.element.querySelector('.md-link--external');
    expect(external.getAttribute('href')).toBe('#');
    external.click();
    expect(openExternalUrl).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\//));
    guide.close();
    expect(document.querySelector('.ai-guide')).toBeNull();
  });

  it('abrirla otra vez no apila ventanas', () => {
    openGuide({ lang: 'es' });
    openGuide({ lang: 'es' });
    expect(document.querySelectorAll('.ai-guide')).toHaveLength(1);
  });
});

describe('copiar órdenes', () => {
  it('cada bloque de código de la guía tiene un botón que lo copia al portapapeles', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const host = document.createElement('div');
    renderGuide(host, { lang: 'es' });
    const blocks = host.querySelectorAll('.md-codeblock');
    expect(blocks.length).toBeGreaterThan(3);
    const powershell = [...blocks].find((block) => block.textContent.includes('Expand-Archive'));
    powershell.querySelector('.ai-guide__copy').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Expand-Archive')));
  });
});
