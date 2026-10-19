// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Idioma en el que debe contestar la IA (RF-39.7): el de la interfaz, sea cual sea.
//
// Las instrucciones del sistema están en inglés (y las de es/en, en su idioma); para cualquier otro
// idioma registrado se pide contestar en él por su NOMBRE en inglés. Antes del registro de idiomas el
// código decidía con `lang === 'es' ? … : 'Answer in English.'`, así que un usuario coreano habría
// recibido respuestas en inglés (o, en el chat, en español).
//
// @spec RF-39

const ENGLISH_NAMES = { es: 'Spanish', en: 'English', ko: 'Korean' };

/** Nombre en inglés de un idioma por su código (`ko` → `Korean`); el propio código si no se conoce. */
export function languageName(code) {
  let name = ENGLISH_NAMES[code];
  if (!name) {
    try {
      name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
    } catch {
      name = undefined;
    }
  }
  return name ?? String(code);
}

/** Instrucción de idioma del asistente del chat (RF-35.4). */
export function chatLanguageInstruction(lang) {
  let text;
  if (lang === 'es') text = 'Responde en español salvo que el usuario escriba en otro idioma.';
  else if (lang === 'en') text = 'Answer in English unless the user writes in another language.';
  else text = `Answer in ${languageName(lang)} unless the user writes in another language.`;
  return text;
}

/** Instrucción de idioma de las acciones en línea (RF-36), solo para cuando se pide explicar. */
export function inlineLanguageInstruction(lang) {
  let text;
  if (lang === 'es') text = 'Cuando expliques, responde en español.';
  else if (lang === 'en') text = 'When you explain, answer in English.';
  else text = `When you explain, answer in ${languageName(lang)}.`;
  return text;
}

/** Línea de idioma del primer mensaje a un agente ACP (RF-32). */
export function agentLanguageInstruction(lang) {
  let text;
  if (lang === 'es') text = 'Responde en español.';
  else if (lang === 'en') text = 'Answer in English.';
  else text = `Answer in ${languageName(lang)}.`;
  return text;
}
