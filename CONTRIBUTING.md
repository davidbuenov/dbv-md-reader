# Contribuir a DBV Markdown Reader

¡Gracias por tu interés en mejorar **DBV Markdown Reader**! Este documento resume cómo proponer cambios para que el proceso sea rápido tanto para ti como para el mantenedor.

## Flujo de trabajo: fork + Pull Request

Este repositorio no admite pushes directos a `master`. El único camino para contribuir es:

1. Haz **fork** del repositorio a tu cuenta de GitHub.
2. Crea una rama descriptiva a partir de `master` (p. ej. `fix/macos-signing`, `feat/toc-shortcut`).
3. Haz tus cambios en esa rama de tu fork.
4. Abre un **Pull Request** contra `master` de este repositorio.

`master` está protegida: todo PR necesita al menos 1 aprobación y las conversaciones abiertas deben resolverse antes de poder mergear.

## Antes de abrir un PR grande, abre un issue primero

Este proyecto sigue **Spec-Driven Development** (ver `dbv-specs-ops/`): el "qué" y el "por qué" se acuerdan antes de escribir código. Para:

- **Fixes pequeños y acotados** (bug puntual, typo, ajuste de estilo): puedes abrir el PR directamente.
- **Features nuevas o cambios de comportamiento**: abre antes un issue describiendo el problema y la propuesta. Así evitamos trabajo duplicado o un PR grande que no encaje con la dirección del proyecto.

## Entorno de desarrollo

Requisitos: [Rust](https://www.rust-lang.org/) 1.76+, [Node.js](https://nodejs.org/) y las dependencias nativas de [Tauri v2](https://v2.tauri.app/start/prerequisites/) para tu sistema operativo.

```bash
npm install       # instala dependencias JS
npm run dev       # arranca la app en modo desarrollo
npm test          # tests unitarios de Rust (src-tauri)
npm run build     # build de producción
```

## Antes de enviar el PR

- `npm test` pasa en local.
- Sin archivos temporales, logs de depuración ni código comentado.
- Sin claves, tokens o rutas locales sensibles en el diff.
- Descripción del PR clara: qué cambia y por qué (une commits pequeños/de fixup si aporta claridad).
- Si el cambio es visible en la UI, añade una captura o GIF corto en el PR.

## Contribuciones para macOS especialmente bienvenidas

El desarrollo principal se hace en Windows, por lo que la build de macOS (`.github/workflows/release-macos.yml`, firma/notarización, comportamiento específico de WKWebView) se verifica con menos frecuencia en ese sistema. Si tienes hardware Apple, las contribuciones centradas en esa plataforma son especialmente útiles — antes de tocar código compartido con Windows/Linux, coméntalo en un issue para acotar el alcance.

## Licencia

Este proyecto está bajo licencia [MIT](LICENSE). Al enviar un PR, aceptas que tu contribución se licencie bajo los mismos términos.
