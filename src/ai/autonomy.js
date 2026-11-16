// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Niveles de autonomía de la IA (RF-58, adaptado del REQ-115 de dbv-unreal-ai). Tabla pura
// nivel × herramienta → `offer` (se ofrece y se ejecuta), `ask` (hay que pedir permiso) o `deny`
// (ni se ofrece ni se ejecuta). Se aplica en el CÓDIGO, no en las instrucciones del modelo: un
// modelo que pide una herramienta denegada recibe un error (lección de unreal-ai, cuyo nivel
// «Automático» ejecutaba lo que prometía preguntar).
//
// Sin «Automático» ni «Total»: en dbv-md-reader nada se escribe sin revisión (RF-34), que es la
// defensa frente a la inyección indirecta desde un `.md` de terceros (SPECIFICATIONS.md §7).
// @spec RF-58

export const AUTONOMY_LEVELS = Object.freeze(['askAll', 'readOnly', 'askOnWrite']);
export const DEFAULT_AUTONOMY = 'askOnWrite';
export const AUTONOMY_STORAGE_KEY = 'dbv-md-ai-autonomy';

/** Un valor guardado o recibido que no sea un nivel conocido cae al por defecto. */
export function normalizeAutonomy(value) {
  return AUTONOMY_LEVELS.includes(value) ? value : DEFAULT_AUTONOMY;
}

/** Herramientas que leen algo distinto del documento abierto (la carpeta). */
const FOLDER_READS = new Set(['list_files', 'read_file', 'search_files']);
/** Herramientas que proponen cambios (nunca escriben: lo hace el usuario al aceptar, RF-34). */
const WRITES = new Set(['propose_changes']);

/**
 * Política de una herramienta de los modelos directos (RF-35).
 * @param {string} level
 * @param {string} toolName
 * @param {{ path?: string, openDocument?: string|null }} [context] Para `read_file`: si lee el documento abierto no se pregunta.
 * @returns {'offer'|'ask'|'deny'}
 */
export function toolPolicy(level, toolName, context = {}) {
  const lvl = normalizeAutonomy(level);
  let policy = 'offer';
  if (WRITES.has(toolName)) {
    policy = lvl === 'readOnly' ? 'deny' : 'offer';
  } else if (FOLDER_READS.has(toolName) && lvl === 'askAll') {
    const readsOpenDocument = toolName === 'read_file' && !!context.path && context.path === context.openDocument;
    policy = readsOpenDocument ? 'offer' : 'ask';
  }
  return policy;
}

/** Herramientas que se ofrecen al modelo en este nivel: lo denegado ni siquiera se anuncia. */
export function offeredTools(level, tools) {
  return tools.filter((tool) => toolPolicy(level, tool.name) !== 'deny');
}

/**
 * Envuelve las herramientas para que el nivel se aplique AL EJECUTAR, aunque el modelo pida una
 * que no se le ofreció: lo denegado devuelve un error y lo que hay que preguntar pasa por `ask`.
 * @param {string|(() => string)} level Nivel, o función que lo da (puede cambiar durante la conversación).
 * @param {Array<{name: string, run: Function}>} tools
 * @param {{ ask: (tool: string, args: object) => Promise<boolean>, openDocument: () => string|null }} deps
 */
export function guardTools(level, tools, deps) {
  const current = typeof level === 'function' ? level : () => level;
  return tools.map((tool) => ({
    ...tool,
    run: async (args = {}) => {
      const policy = toolPolicy(current(), tool.name, { path: args.path, openDocument: deps.openDocument() });
      let result;
      if (policy === 'deny') {
        result = `error: the tool ${tool.name} is not available at the current autonomy level (read-only). Do not try again; tell the user they can change the level in the assistant bar if they want changes proposed.`;
      } else if (policy === 'ask' && !(await deps.ask(tool.name, args))) {
        result = `error: the user did not allow ${tool.name}. Continue without it or ask the user.`;
      } else {
        result = await tool.run(args);
      }
      return result;
    },
  }));
}

/** Tipos de llamada ACP (`toolCall.kind`) que modifican algo, ejecutan programas o cambian de modo. `switch_mode` es
 *  como Claude Code pide salir de `plan` («Ready to code?», ExitPlanMode): en «Solo lectura» mostrar esa tarjeta y
 *  bloquear después la edición confundía (prueba manual del usuario, 2026-11-16), así que se rechaza sin preguntar. */
const ACP_WRITE_KINDS = new Set(['edit', 'delete', 'move', 'execute', 'switch_mode']);

/**
 * Qué hacer con una petición `session/request_permission` de un agente ACP (RF-32, RF-58).
 * En «Solo lectura» se rechaza sin mostrar la tarjeta todo lo que modifica o ejecuta, y también
 * lo de tipo desconocido (`other` o ausente): ante la duda, no. En los demás niveles se pregunta,
 * como hasta ahora.
 * @returns {'ask'|'deny'}
 */
export function acpPermissionPolicy(level, kind) {
  const lvl = normalizeAutonomy(level);
  const known = typeof kind === 'string' && kind !== 'other';
  const modifies = !known || ACP_WRITE_KINDS.has(kind);
  return lvl === 'readOnly' && modifies ? 'deny' : 'ask';
}

/**
 * Lectura de un fichero pedida por un agente ACP con `fs/read_text_file`: en «Preguntar todo» se
 * pregunta si no es el documento abierto.
 * @returns {'allow'|'ask'}
 */
export function acpReadPolicy(level, relative, openDocument) {
  return normalizeAutonomy(level) === 'askAll' && relative !== openDocument ? 'ask' : 'allow';
}
