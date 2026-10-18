// =============================================================================
// dbv-md-reader — Tests de las imágenes pegadas o soltadas (RF-37)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-37

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

// `imagepaste.js` es un UMD clásico (sin `export`); con `"type": "module"` `require` lo trataría como
// ESM vacío, así que se ejecuta como script, igual que hace `scripts/test-source-sync.mjs`.
const sandbox = { FileReader, Promise };
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'imagepaste.js'), 'utf8'), sandbox);
const P = sandbox.DBVImagePaste;

/** Un `DataTransfer` mínimo: `types` y `items` como los entrega el navegador. */
function clipboard(entries) {
  return {
    types: entries.map((e) => (e.kind === 'file' ? 'Files' : e.type)),
    items: entries.map((e) => ({ kind: e.kind, type: e.type, getAsFile: () => (e.kind === 'file' ? { name: 'x', type: e.type } : null) })),
  };
}

describe('pickImageFromClipboard (RF-37.1, RF-37.2)', () => {
  it('toma un recorte de pantalla (solo un fichero image/png)', () => {
    const picked = P.pickImageFromClipboard(clipboard([{ kind: 'file', type: 'image/png' }]));
    expect(picked.extension).toBe('png');
  });

  it('un jpeg se guarda como .jpg', () => {
    expect(P.pickImageFromClipboard(clipboard([{ kind: 'file', type: 'image/jpeg' }])).extension).toBe('jpg');
  });

  it('con texto en el portapapeles NO intercepta: se quiere pegar el texto', () => {
    const mixed = clipboard([{ kind: 'string', type: 'text/plain' }, { kind: 'file', type: 'image/png' }]);
    expect(P.pickImageFromClipboard(mixed)).toBeNull();
  });

  it('descarta bmp y lo que no es imagen', () => {
    expect(P.pickImageFromClipboard(clipboard([{ kind: 'file', type: 'image/bmp' }]))).toBeNull();
    expect(P.pickImageFromClipboard(clipboard([{ kind: 'file', type: 'application/pdf' }]))).toBeNull();
  });

  it('sin portapapeles no hace nada', () => {
    expect(P.pickImageFromClipboard(null)).toBeNull();
  });
});

describe('captureName e imageMarkdown (RF-37.3, RF-37.4)', () => {
  it('nombre captura-AAAAMMDD-HHMMSS.ext con ceros a la izquierda', () => {
    expect(P.captureName(new Date(2026, 9, 8, 7, 5, 3), 'png')).toBe('captura-20261008-070503.png');
  });

  it('el código insertado lleva el texto alternativo vacío', () => {
    expect(P.imageMarkdown('images/captura-20261018-221500.png')).toBe('![](images/captura-20261018-221500.png)');
  });
});

describe('imagePaths (RF-37.1)', () => {
  it('deja solo imágenes admitidas, sin distinguir mayúsculas', () => {
    expect(P.imagePaths(['C:/a/foto.PNG', 'C:/a/nota.md', 'C:/a/x.bmp', 'C:/a/dibujo.svg', 'C:/a/carpeta'])).toEqual(['C:/a/foto.PNG', 'C:/a/dibujo.svg']);
  });
});

describe('isOverEditor (RF-37.4)', () => {
  const rect = { left: 0, right: 400, top: 100, bottom: 700 };

  it('compara en píxeles lógicos: con escala 150 % un soltado físico (300, 300) cae DENTRO', () => {
    expect(P.isOverEditor({ x: 300, y: 300 }, rect, 1.5)).toBe(true);
  });

  it('con escala 150 % un soltado físico (900, 300) cae FUERA (600 lógicos)', () => {
    expect(P.isOverEditor({ x: 900, y: 300 }, rect, 1.5)).toBe(false);
  });

  it('sin editor visible (modo lectura) nunca es «sobre el editor»', () => {
    expect(P.isOverEditor({ x: 10, y: 200 }, null, 1)).toBe(false);
  });
});

describe('relativeInside (RF-37.7)', () => {
  it('ruta dentro de la carpeta del documento, también con barras de Windows', () => {
    expect(P.relativeInside('D:/docs/libro', 'D:\\docs\\libro\\images\\a.png')).toBe('images/a.png');
  });

  it('la carpeta canónica de Windows (prefijo de ruta larga) y el agente/diálogo en la normal', () => {
    expect(P.relativeInside('\\\\?\\D:\\bueno\\notas', 'D:\\bueno\\notas\\images\\a.png')).toBe('images/a.png');
    expect(P.relativeInside('\\\\?\\UNC\\srv\\share\\libro', '\\\\srv\\share\\libro\\a.png')).toBe('a.png');
  });

  it('no distingue mayúsculas en Windows pero sí en Linux/macOS', () => {
    expect(P.relativeInside('D:/Docs', 'd:/docs/a.png')).toBe('a.png');
    expect(P.relativeInside('/home/u/Docs', '/home/u/docs/a.png')).toBeNull();
    expect(P.relativeInside('/home/u/docs', '/home/u/docs/images/a.png')).toBe('images/a.png');
  });

  it('fuera de la carpeta o con .. devuelve null', () => {
    expect(P.relativeInside('D:/docs', 'D:/docs-otro/a.png')).toBeNull();
    expect(P.relativeInside('D:/docs', 'D:/docs/../a.png')).toBeNull();
    expect(P.relativeInside('D:/docs', 'E:/docs/a.png')).toBeNull();
  });
});

describe('base64FromDataUrl', () => {
  it('quita la cabecera del data URL', () => {
    expect(P.base64FromDataUrl('data:image/png;base64,AAAA')).toBe('AAAA');
    expect(P.base64FromDataUrl('sin-coma')).toBe('');
  });

  it('readFileAsBase64 lee un File real (jsdom)', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' });
    expect(await P.readFileAsBase64(file)).toBe('iVBORw==');
  });
});
