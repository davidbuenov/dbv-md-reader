// =============================================================================
// dbv-md-reader — Tests de la conversión DOM → menú nativo de macOS (RF-65)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-65

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(resolve(process.cwd(), 'src', 'nativemenu.js'), 'utf8');
const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(SRC, sandbox);
const { toAccelerator, describe: describeMenus, signature } = sandbox.DBVNativeMenu;

const item = (key, label, extra = {}) => ({ key, kind: 'item', label, ...extra });
const sep = { kind: 'sep' };

describe('toAccelerator (RF-65.6)', () => {
  it('traduce mod/Shift/Alt a los aceleradores de Tauri', () => {
    expect(toAccelerator('mod+N')).toBe('CmdOrCtrl+N');
    expect(toAccelerator('mod+Shift+S')).toBe('CmdOrCtrl+Shift+S');
    expect(toAccelerator('mod+Alt+P')).toBe('CmdOrCtrl+Alt+P');
    expect(toAccelerator('mod+Shift+I')).toBe('CmdOrCtrl+Shift+I');
  });
  it('acepta teclas de función y pasa a mayúscula', () => {
    expect(toAccelerator('F1')).toBe('F1');
    expect(toAccelerator('mod+k')).toBe('CmdOrCtrl+K');
  });
  it('una tecla o modificador desconocidos, o nada, dan null (sin atajo, sin error)', () => {
    expect(toAccelerator('')).toBeNull();
    expect(toAccelerator(undefined)).toBeNull();
    expect(toAccelerator('mod+Intro')).toBeNull();
    expect(toAccelerator('hyper+K')).toBeNull();
    expect(toAccelerator('mod+')).toBeNull();
  });
});

describe('describe (RF-65.2, RF-65.4)', () => {
  it('omite lo oculto y lo omitido («Salir») y conserva el orden', () => {
    const out = describeMenus([{ id: 'file', title: 'Archivo', items: [
      item('btn-new-file', 'Nuevo', { keys: 'mod+N' }), item('btn-ai', 'IA', { hidden: true }), item('exit', 'Salir', { omit: true }), item('btn-save', 'Guardar')
    ] }]);
    expect(out.menus[0].items.map((i) => i.label)).toEqual(['Nuevo', 'Guardar']);
    expect(out.menus[0].items[0].accel).toBe('CmdOrCtrl+N');
  });
  it('poda separadores huérfanos: inicial, final y consecutivos', () => {
    const out = describeMenus([{ id: 'm', title: 'M', items: [sep, item('a', 'A'), sep, item('x', 'X', { hidden: true }), sep, item('b', 'B'), sep] }]);
    expect(out.menus[0].items.map((i) => i.kind)).toEqual(['item', 'sep', 'item']);
  });
  it('lo deshabilitado sale apagado, no oculto (RF-65.4)', () => {
    const out = describeMenus([{ id: 'm', title: 'M', items: [item('print', 'Imprimir', { disabled: true })] }]);
    expect(out.menus[0].items[0]).toMatchObject({ label: 'Imprimir', enabled: false });
  });
  it('casillas y radios llevan su estado; una cabecera sale como entrada apagada', () => {
    const out = describeMenus([{ id: 'p', title: 'P', items: [
      { key: 'h', kind: 'heading', label: 'Ancho' },
      { key: 'w:narrow', kind: 'check', label: 'Estrecho', checked: false },
      { key: 'w:wide', kind: 'check', label: 'Ancho', checked: true }
    ] }]);
    const [h, a, b] = out.menus[0].items;
    expect(h).toMatchObject({ kind: 'item', enabled: false, accel: null });
    expect(a).toMatchObject({ kind: 'check', checked: false, enabled: true });
    expect(b).toMatchObject({ kind: 'check', checked: true });
  });
  it('los ids son únicos y llevan el id del menú', () => {
    const out = describeMenus([
      { id: 'file', title: 'A', items: [item('x', 'Uno'), item('x', 'Dos')] },
      { id: 'tools', title: 'H', items: [item('x', 'Tres')] }
    ]);
    const ids = out.menus.flatMap((m) => m.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe('file:x');
  });
  it('un menú sin entradas visibles desaparece', () => {
    expect(describeMenus([{ id: 'm', title: 'M', items: [item('a', 'A', { hidden: true })] }]).menus).toEqual([]);
  });
  it('normaliza el texto de la etiqueta', () => {
    const out = describeMenus([{ id: 'm', title: 'M', items: [item('a', '  Abrir\n   archivo… ')] }]);
    expect(out.menus[0].items[0].label).toBe('Abrir archivo…');
  });
});

describe('signature', () => {
  it('cambia con el estado y no con una descripción igual', () => {
    const mk = (checked) => describeMenus([{ id: 'p', title: 'P', items: [{ key: 'v', kind: 'check', label: 'Vim', checked }] }]);
    expect(signature(mk(true))).toBe(signature(mk(true)));
    expect(signature(mk(true))).not.toBe(signature(mk(false)));
  });
});
