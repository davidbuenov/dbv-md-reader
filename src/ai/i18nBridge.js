// =============================================================================
// dbv-md-reader — Puente de i18n para los módulos de la IA
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Los módulos de la IA se cargan de forma perezosa (RNF-IA.1): sus textos llegan
// con ellos (`translations.js`) y se registran en el diccionario de la app
// (`src/i18n.js`, vanilla, sin librería). Este fichero es lo único que conoce
// `window.DBV_I18N`; el resto importa `t` y `getLanguage` de aquí.

/** Texto traducido (cae al español y, si falta, a la propia clave). */
export const t = (key, vars) => window.DBV_I18N.t(key, vars);

/** Idioma activo de la interfaz: `es` o `en`. */
export const getLanguage = () => window.DBV_I18N.getLang();

/** Añade las traducciones de la IA al diccionario de la app. */
export const registerTranslations = (dictionary) => window.DBV_I18N.register(dictionary);
