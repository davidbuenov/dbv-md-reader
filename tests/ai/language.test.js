// =============================================================================
// dbv-md-reader — Tests del idioma de respuesta de la IA (RF-39.7)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-39

import { describe, expect, it } from 'vitest';
import { agentLanguageInstruction, chatLanguageInstruction, inlineLanguageInstruction, languageName } from '../../src/ai/language.js';
import { systemPrompt } from '../../src/ai/context.js';
import { inlineSystemPrompt } from '../../src/ai/inline.js';

describe('RF-39.7 · la IA contesta en el idioma de la interfaz', () => {
  it('conoce el nombre en inglés de los idiomas registrados y se apaña con el resto', () => {
    expect(languageName('ko')).toBe('Korean');
    expect(languageName('es')).toBe('Spanish');
    expect(languageName('fr')).toBe('French');
    expect(languageName('')).toBe('');
  });

  it('chat: es y en conservan su texto; coreano pide contestar en coreano', () => {
    expect(chatLanguageInstruction('es')).toBe('Responde en español salvo que el usuario escriba en otro idioma.');
    expect(chatLanguageInstruction('en')).toBe('Answer in English unless the user writes in another language.');
    expect(chatLanguageInstruction('ko')).toBe('Answer in Korean unless the user writes in another language.');
  });

  it('el prompt del sistema del chat lleva la instrucción del idioma (antes, un idioma nuevo caía en español)', () => {
    expect(systemPrompt({ lang: 'ko' })).toContain('Answer in Korean');
    expect(systemPrompt({ lang: 'ko' })).not.toContain('Responde en español');
    expect(systemPrompt({ lang: 'en' })).toContain('Answer in English');
    expect(systemPrompt({ lang: 'es' })).toContain('Responde en español');
    expect(systemPrompt()).toContain('Responde en español');
  });

  it('acciones en línea: explicar contesta en el idioma elegido', () => {
    expect(inlineSystemPrompt({ lang: 'ko', kind: 'explain' })).toContain('answer in Korean');
    expect(inlineSystemPrompt({ lang: 'es' })).toContain('responde en español');
    expect(inlineLanguageInstruction('en')).toBe('When you explain, answer in English.');
  });

  it('agente ACP: el primer mensaje pide el idioma elegido (antes, un idioma nuevo recibía inglés)', () => {
    expect(agentLanguageInstruction('ko')).toBe('Answer in Korean.');
    expect(agentLanguageInstruction('es')).toBe('Responde en español.');
    expect(agentLanguageInstruction('en')).toBe('Answer in English.');
  });
});
