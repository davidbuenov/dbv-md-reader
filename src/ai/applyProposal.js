// =============================================================================
// dbv-md-reader — Aplicar y deshacer una propuesta (RF-34.4, RF-34.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La propuesta aceptada se aplica así:
//
//   · el documento ABIERTO se cambia en el editor, como una edición más
//     (deshacible con Ctrl+Z) y queda «Modificado»: el usuario revisa y guarda
//     con Ctrl+S (RNF-IA.7). Nada se escribe en disco por detrás del editor;
//   · cualquier OTRO documento de la carpeta se escribe tras la revisión, de
//     forma atómica y confinada (Rust: `ai_write_file`), y se puede deshacer;
//   · un documento NUEVO se crea igual, y se deshace borrándolo SOLO si sigue
//     exactamente como lo dejó la aplicación.
//
// Cada fichero se recoloca sobre su texto ACTUAL (`rebase`): si el usuario lo
// editó mientras la IA respondía, lo que ya no casa no se aplica y se informa.
//
// @spec RF-34

import { rebase } from './diff.js';
import { resultText } from './proposal.js';

/**
 * @param {object} deps
 * @param {() => string} deps.getRoot
 * @param {(relative: string) => Promise<string|null>} deps.readText Contenido actual (editor o disco).
 * @param {(relative: string) => boolean} deps.isOpenDocument ¿Es el documento abierto en el editor?
 * @param {(newText: string) => boolean} deps.applyToEditor Sustituye el texto del editor (deshacible); `false` si no se pudo.
 * @param {() => string} deps.editorText Texto actual del editor.
 * @param {{aiWriteFile: Function, aiDeleteCreated: Function}} deps.backend
 */
export function createProposalApplier({ getRoot, readText, isOpenDocument, applyToEditor, editorText, backend }) {
  /**
   * Aplica los ficheros aceptados. Devuelve qué se hizo, los conflictos y un
   * `undo()` que lo revierte (o no toca lo que el usuario cambió después).
   * @param {{files: Map}} proposal
   */
  async function apply(proposal) {
    const root = getRoot();
    const report = { modified: [], created: [], conflicts: [], failed: [], notes: [] };
    const undoSteps = [];

    for (const file of proposal.files.values()) {
      if (!file.accepted.size) continue;
      if (file.kind === 'create') {
        const text = resultText(file);
        const written = await backend.aiWriteFile(root, file.path, text);
        if (written.ok) {
          report.created.push(file.path);
          undoSteps.push(async () => {
            const removed = await backend.aiDeleteCreated(root, file.path, text);
            return removed.ok && removed.value === true;
          });
        } else report.failed.push({ path: file.path, message: written.error.message });
        continue;
      }
      const current = await readText(file.path);
      if (current === null) {
        report.failed.push({ path: file.path, message: 'ya no existe' });
        continue;
      }
      const result = rebase(file.base, current, file.regions, file.accepted);
      if (result.conflicts.length) report.conflicts.push({ path: file.path, count: result.conflicts.length });
      if (result.text === current) continue;
      if (isOpenDocument(file.path)) {
        if (!applyToEditor(result.text)) {
          report.failed.push({ path: file.path, message: 'no se pudo aplicar en el editor' });
          continue;
        }
        report.modified.push(file.path);
        report.notes.push(file.path);
        undoSteps.push(async () => {
          // Solo si el editor sigue como lo dejó la propuesta: si se siguió escribiendo, no se pisa.
          if (editorText() !== result.text) return false;
          return applyToEditor(current);
        });
      } else {
        const written = await backend.aiWriteFile(root, file.path, result.text);
        if (written.ok) {
          report.modified.push(file.path);
          undoSteps.push(async () => {
            const now = await readText(file.path);
            if (now !== result.text) return false;
            const restored = await backend.aiWriteFile(root, file.path, current);
            return restored.ok;
          });
        } else report.failed.push({ path: file.path, message: written.error.message });
      }
    }

    proposal.status = 'applied';
    const undo = async () => {
      let all = true;
      for (const step of [...undoSteps].reverse()) all = (await step()) && all;
      proposal.status = 'undone';
      return all;
    };
    return { report, undo };
  }

  return { apply };
}
