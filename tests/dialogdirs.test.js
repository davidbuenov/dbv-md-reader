// =============================================================================
// dbv-md-reader — Tests de la carpeta inicial de los diálogos de archivo (RF-46)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-46

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'dialogdirs.js'), 'utf8'), sandbox);
const D = sandbox.DBVDialogDirs;

describe('RF-46 · parentDir', () => {
  it('saca la carpeta de rutas de Windows y de Unix', () => {
    expect(D.parentDir('C:\\notas\\a.md')).toBe('C:\\notas');
    expect(D.parentDir('/home/yo/a.md')).toBe('/home/yo');
    expect(D.parentDir('C:/mezcla\\a.md')).toBe('C:/mezcla');
  });

  it('la raíz de una unidad conserva su barra (C: sola significaría la carpeta actual de C)', () => {
    expect(D.parentDir('C:\\a.md')).toBe('C:\\');
    expect(D.parentDir('/a.md')).toBe('/');
  });

  it('sin carpeta o sin ruta devuelve null', () => {
    expect(D.parentDir('a.md')).toBeNull();
    expect(D.parentDir('')).toBeNull();
    expect(D.parentDir(null)).toBeNull();
    expect(D.parentDir(undefined)).toBeNull();
  });
});

describe('RF-46 · orden de las carpetas candidatas', () => {
  const ctx = {
    docDir: 'C:\\doc',
    recentPath: 'D:\\recientes\\viejo.md',
    remembered: { typst: 'E:\\exportados', newfile: 'E:\\nuevos', images: 'E:\\imagenes' },
  };

  it('Exportar a Typst: primero la última carpeta de exportación, luego la del documento', () => {
    expect(D.candidates('typst', ctx)).toEqual(['E:\\exportados', 'C:\\doc']);
  });

  it('Nuevo documento: primero la del documento abierto, luego la última usada para crear', () => {
    expect(D.candidates('newfile', ctx)).toEqual(['C:\\doc', 'E:\\nuevos']);
  });

  it('Abrir archivo: la del documento abierto y, si no, la del último reciente', () => {
    expect(D.candidates('open', ctx)).toEqual(['C:\\doc', 'D:\\recientes']);
    expect(D.candidates('open', { recentPath: 'D:\\recientes\\viejo.md' })).toEqual(['D:\\recientes']);
  });

  it('imágenes: la del documento abierto y, si no, la última usada', () => {
    expect(D.candidates('images', ctx)).toEqual(['C:\\doc', 'E:\\imagenes']);
  });

  it('un documento remoto (docDir null) no aporta carpeta', () => {
    expect(D.candidates('newfile', { ...ctx, docDir: null })).toEqual(['E:\\nuevos']);
    expect(D.candidates('typst', { ...ctx, docDir: null })).toEqual(['E:\\exportados']);
  });

  it('sin nada que recordar devuelve una lista vacía (Rust cae en Documentos)', () => {
    expect(D.candidates('typst', {})).toEqual([]);
    expect(D.candidates('open', undefined)).toEqual([]);
  });

  it('no repite carpetas ni deja entradas vacías', () => {
    expect(D.candidates('typst', { docDir: 'C:\\doc', remembered: { typst: 'C:\\doc' } })).toEqual(['C:\\doc']);
    expect(D.candidates('newfile', { docDir: '', remembered: { newfile: '' } })).toEqual([]);
  });

  it('un tipo desconocido no propone nada', () => {
    expect(D.candidates('otro', ctx)).toEqual([]);
  });
});
