// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Diccionarios ES/EN + registro de idiomas (RF-39) + helper t(). Sin librería de i18n (vanilla,
// mismo patrón IIFE que app.js) — la app tiene pocos textos, no justifica una dependencia.
// Cargar este script ANTES de app.js en index.html (y de los scripts `i18n.<código>.js`).
// =============================================================================
(function () {
  'use strict';

  var DICT = {
    es: {
      'toolbar.back': 'Atrás (Alt+←)',
      'toolbar.forward': 'Adelante (Alt+→)',
      'toolbar.noDocument': 'Sin documento abierto',
      'toolbar.search': 'Buscar (Ctrl+F)',
      'toolbar.newFile': 'Nuevo documento (Ctrl+N)',
      'toolbar.openFile': 'Abrir archivo (Ctrl+O)',
      'toolbar.openUrl': 'Abrir desde URL',
      'toolbar.recent': 'Archivos recientes',
      'toolbar.print': 'Imprimir / PDF (Ctrl+P)',
      'toolbar.exportTypst': 'Exportar a Typst (.typ)',
      'typst.editorPromo': 'Este fichero se puede ver y editar con un editor de Typst. Recomendamos dbv-typst-editor: https://davidbuenov.github.io/dbv-typst-editor/',
      'toolbar.alwaysOnTop': 'Fijar ventana encima',
      'toolbar.alwaysOnTopActive': 'Ventana fijada encima — clic para quitar',
      'toolbar.editMode': 'Modo edición (Ctrl+E)',
      'toolbar.editModeActive': 'Modo edición activo — clic para volver a lectura (Ctrl+E)',
      'toolbar.toc': 'Tabla de Contenidos',
      'toolbar.markdownHelp': 'Ayuda (F1)',
      'toolbar.about': 'Acerca de DBV Markdown Reader',
      'toolbar.settings': 'Configuración',
      'menu.file': 'Archivo',
      'menu.tools': 'Herramientas',
      'menu.prefs': 'Preferencias',
      'menu.newDoc': 'Nuevo documento',
      'menu.openFile': 'Abrir archivo…',
      'menu.openUrl': 'Abrir desde URL…',
      'menu.recent': 'Archivos recientes…',
      'menu.save': 'Guardar',
      'menu.print': 'Imprimir / PDF…',
      'menu.exportTypst': 'Exportar a Typst…',
      'menu.quickOpen': 'Buscar archivo…',
      'menu.goPreview': 'Ir a la vista previa',
      'menu.connectAi': 'Conectar una IA…',
      'menu.syntaxHelp': 'Ayuda de sintaxis Markdown',
      'menu.about': 'Acerca de…',
      'menu.showAi': 'Mostrar las funciones de IA',
      'menu.width': 'Ancho de lectura',
      'menu.width.narrow': 'Estrecho',
      'menu.width.normal': 'Normal',
      'menu.width.wide': 'Ancho',
      'menu.width.full': 'Completo',
      'menu.wideBlocks': 'Bloques anchos a todo el ancho',
      'menu.rememberWindow': 'Recordar la posición y el tamaño de la ventana',
      'menu.editorFont': 'Tamaño de letra del editor',
      'menu.editorFont.dec': 'Reducir',
      'menu.editorFont.inc': 'Aumentar',
      'menu.editorFont.reset': 'Restablecer',
      'settings.title': 'Configuración',
      'settings.theme': 'Tema',
      'settings.language': 'Idioma',
      'settings.close': 'Cerrar',
      'settings.exit': 'Salir de la aplicación',
      'theme.light': 'Tema Claro',
      'theme.dark': 'Tema Oscuro',
      'theme.sepia': 'Tema Sepia',
      'lang.label': 'Idioma',
      'recent.title': 'Archivos Recientes',
      'recent.clear': 'Limpiar historial',
      'recent.clearBtn': 'Limpiar',
      'recent.empty': 'Sin archivos recientes',
      'recent.emptyStateTitle': 'Recientes',
      'about.version': 'Versión {version}',
      'about.versionPlaceholder': 'Versión —',
      'about.desc': 'Lector y editor nativo de Markdown para Windows, Linux y macOS.',
      'about.descAndroid': 'Lector nativo de Markdown para Android.',
      'about.close': 'Cerrar (Esc)',
      'about.checkUpdate': 'Buscar actualizaciones',
      'about.authorLine': 'David Bueno Vallejo · Licencia MIT',
      'update.checking': 'Buscando actualizaciones…',
      'update.upToDate': 'Ya tienes la última versión.',
      'update.available': 'Nueva versión {version} disponible.',
      'update.button': 'Actualizar',
      'update.downloading': 'Descargando e instalando…',
      'update.installed': 'Instalada. Reiniciando…',
      'update.installFailed': 'No se pudo instalar la actualización. Inténtalo de nuevo.',
      'update.checkFailed': 'No se pudo comprobar: revisa tu conexión.',
      'update.store': 'Las actualizaciones se instalan automáticamente desde Microsoft Store.',
      'update.playStore': 'Actualizaciones gestionadas por Google Play.',
      'ctx.goToSource': 'Ir al código aquí',
      'ctx.editHere': 'Editar aquí',
      'ctx.doubleClick': 'doble clic',
      'ctx.goToPreview': 'Ir a la vista previa',
      'ctx.copy': 'Copiar',
      'ctx.cut': 'Cortar',
      'ctx.paste': 'Pegar',
      'ctx.selectAll': 'Seleccionar todo',
      'ctx.copyMessage': 'Copiar mensaje',
      'ctx.clipboardDenied': 'El sistema no permitió acceder al portapapeles.',
      'img.pickFolder': 'Elige la carpeta donde guardar la imagen',
      'img.saveAsTitle': 'Guardar la imagen como',
      'img.saved': 'Imagen guardada en {path}',
      'img.savedMany': '{n} imágenes guardadas',
      'img.reused': 'Esa imagen ya estaba en {path}',
      'img.codeCopied': ' · código copiado al portapapeles',
      'img.failed': 'No se pudo guardar la imagen: {error}',
      'img.notSaved': 'No se guardó la imagen.',
      'sync.notFound': 'No se pudo localizar ese punto en el documento.',
      'action.close': 'Cerrar',
      'ai.loadFailed': 'No se pudo cargar la IA. Reinicia la aplicación e inténtalo de nuevo.',
      'ai.menu.inline': 'IA: acciones sobre el texto…',
      'ai.inline.needEdit': 'La IA en línea actúa sobre el editor: activa el Modo Edición (Ctrl+E).',
      'ai.addToChat': '✨ Añadir a la conversación de la IA',
      'ai.outsideFolder': 'Ese documento no está en la carpeta del documento abierto.',
      'ai.button': 'Asistente de IA (Ctrl+Mayús+I)',
      'ai.tab': 'Asistente',
      'ai.connectTitle': 'Conectar una IA',
      'mermaid.openLive': '🔗 Abrir en mermaid.live',
      'mermaid.error': 'Error de sintaxis en el diagrama Mermaid',
      'empty.subtitle': 'Lector nativo ultra-ligero para archivos Markdown',
      'empty.openButton': 'Abrir archivo .md',
      'empty.dragHint': 'o arrastra un archivo .md aquí',
      'empty.urlLink': 'o abrir desde una URL',
      'empty.newLink': 'o crear un documento nuevo',
      'toc.empty': 'Sin encabezados',
      'sidebar.tabIndex': 'Índice',
      'sidebar.tabFiles': 'Archivos',
      'fileTree.filterPlaceholder': 'Filtrar…',
      'fileTree.empty': 'Sin carpeta que mostrar',
      'fileTree.refresh': '🔄 Actualizar',
      'fileTree.reveal': '📂 Revelar en el Explorador',
      'fileTree.openNewWindow': '🗗 Abrir en ventana nueva ({mod}+clic)',
      'quickOpen.placeholder': 'Ir a archivo… (Ctrl+K)',
      'quickOpen.empty': 'Sin resultados',
      'url.placeholder': 'https://.../documento.md',
      'url.openButton': 'Abrir',
      'url.close': 'Cerrar (Esc)',
      'url.invalid': 'La URL debe empezar por http:// o https://',
      'search.placeholder': 'Buscar en el documento…',
      'search.prev': 'Anterior (Shift+Enter)',
      'search.next': 'Siguiente (Enter)',
      'search.close': 'Cerrar (Esc)',
      'search.target.editor': 'Editor',
      'search.target.preview': 'Vista previa',
      'search.targetLabel': 'Dónde buscar',
      'toc.reorderHint': 'Arrastra para mover la sección (Alt+↑/↓)',
      'toc.moveFailed': 'No se pudo mover la sección (el documento cambió). Inténtalo otra vez.',
      'copy.copy': 'Copiar',
      'copy.copied': '¡Copiado!',
      'code.wrapOn': 'Ajustar línea',
      'code.wrapOff': 'Sin ajuste',
      'doc.readingTime': '{n} min de lectura',
      'doc.readOnly': 'Solo lectura',
      'doc.modified': 'Modificado',
      'time.now': 'ahora mismo',
      'time.minutes': '{n} min',
      'time.hours': '{n} h',
      'time.days': '{n} d',
      'errors.loadFailed': 'Error al cargar: {error}',
      'errors.saveFailed': 'Error al guardar: {error}',
      'errors.fatalNoTauri': '[FATAL] window.__TAURI__ no está disponible. ¿Estás ejecutando fuera de Tauri?',
      'errors.fatalNoInvoke': '[FATAL] window.__TAURI__.core.invoke no disponible.',
      'editor.placeholder': 'Markdown…',
      'editor.newFileDefaultName': 'Sin título.md',
      'editor.conflictTitle': 'El archivo cambió',
      'editor.conflictBody': 'Este archivo se modificó fuera de la aplicación mientras lo editabas. ¿Qué quieres hacer?',
      'editor.conflictKeep': 'Conservar mis cambios',
      'editor.conflictReload': 'Recargar desde disco',
      'editor.bannerText': 'El archivo cambió en disco desde tu última edición.',
      'editor.bannerReload': 'Recargar desde disco',
      'editor.confirmDiscardTitle': 'Cambios sin guardar',
      'editor.confirmDiscardBody': 'Tienes cambios sin guardar en este documento. Si continúas, se perderán.',
      'editor.confirmDiscardCancel': 'Seguir editando',
      'editor.confirmDiscardOk': 'Descartar cambios',
      'help.close': 'Cerrar (Esc)',
      'help.tabApp': 'Guía de la aplicación',
      'help.tabSyntax': 'Sintaxis Markdown',
      'menu.help': 'Ayuda',
      'help.loadError': 'No se pudo cargar la ayuda.',
      'editor.resizeHandle': 'Arrastra para redimensionar',
      'toc.resizeHandle': 'Arrastra para redimensionar',
      'editor.save': 'Guardar (Ctrl+S)',
      'editor.format.bold': 'Negrita (Ctrl+B)',
      'editor.format.italic': 'Cursiva (Ctrl+I)',
      'editor.format.strike': 'Tachado',
      'editor.format.code': 'Código inline',
      'editor.format.h1': 'Encabezado 1',
      'editor.format.h2': 'Encabezado 2',
      'editor.format.h3': 'Encabezado 3',
      'editor.format.ul': 'Lista con viñetas',
      'editor.format.ol': 'Lista numerada',
      'editor.format.task': 'Lista de tareas',
      'editor.format.link': 'Enlace',
      'editor.format.image': 'Imagen',
      'editor.format.quote': 'Cita',
      'editor.format.codeblock': 'Bloque de código',
      'editor.format.table': 'Tabla',
      'editor.format.hr': 'Línea horizontal',
      'editor.format.boldSkeleton': 'texto en negrita',
      'editor.format.italicSkeleton': 'texto en cursiva',
      'editor.format.strikeSkeleton': 'texto tachado',
      'editor.format.codeSkeleton': 'código',
      'editor.format.linkTextSkeleton': 'texto del enlace',
      'editor.format.imageAltSkeleton': 'texto alternativo',
      'editor.format.codeLangSkeleton': 'lang',
      'editor.format.codeBlockSkeleton': 'código de ejemplo',
      'editor.format.tableSkeleton': '| Columna 1 | Columna 2 | Columna 3 |\n| --- | --- | --- |\n| Celda | Celda | Celda |\n| Celda | Celda | Celda |',
      'editor.format.hrSkeleton': '---'
    },
    en: {
      'toolbar.back': 'Back (Alt+←)',
      'toolbar.forward': 'Forward (Alt+→)',
      'toolbar.noDocument': 'No document open',
      'toolbar.search': 'Search (Ctrl+F)',
      'toolbar.newFile': 'New document (Ctrl+N)',
      'toolbar.openFile': 'Open file (Ctrl+O)',
      'toolbar.openUrl': 'Open from URL',
      'toolbar.recent': 'Recent files',
      'toolbar.print': 'Print / PDF (Ctrl+P)',
      'toolbar.exportTypst': 'Export to Typst (.typ)',
      'typst.editorPromo': 'This file can be viewed and edited with a Typst editor. We recommend dbv-typst-editor: https://davidbuenov.github.io/dbv-typst-editor/',
      'toolbar.alwaysOnTop': 'Keep window on top',
      'toolbar.alwaysOnTopActive': 'Window pinned on top — click to unpin',
      'toolbar.editMode': 'Edit mode (Ctrl+E)',
      'toolbar.editModeActive': 'Edit mode active — click to return to reading (Ctrl+E)',
      'toolbar.toc': 'Table of Contents',
      'toolbar.markdownHelp': 'Help (F1)',
      'toolbar.about': 'About DBV Markdown Reader',
      'toolbar.settings': 'Settings',
      'menu.file': 'File',
      'menu.tools': 'Tools',
      'menu.prefs': 'Preferences',
      'menu.newDoc': 'New document',
      'menu.openFile': 'Open file…',
      'menu.openUrl': 'Open from URL…',
      'menu.recent': 'Recent files…',
      'menu.save': 'Save',
      'menu.print': 'Print / PDF…',
      'menu.exportTypst': 'Export to Typst…',
      'menu.quickOpen': 'Find file…',
      'menu.goPreview': 'Go to preview',
      'menu.connectAi': 'Connect an AI…',
      'menu.syntaxHelp': 'Markdown syntax help',
      'menu.about': 'About…',
      'menu.showAi': 'Show the AI features',
      'menu.width': 'Reading width',
      'menu.width.narrow': 'Narrow',
      'menu.width.normal': 'Normal',
      'menu.width.wide': 'Wide',
      'menu.width.full': 'Full',
      'menu.wideBlocks': 'Wide blocks at full width',
      'menu.rememberWindow': 'Remember window position and size',
      'menu.editorFont': 'Editor font size',
      'menu.editorFont.dec': 'Smaller',
      'menu.editorFont.inc': 'Larger',
      'menu.editorFont.reset': 'Reset',
      'settings.title': 'Settings',
      'settings.theme': 'Theme',
      'settings.language': 'Language',
      'settings.close': 'Close',
      'settings.exit': 'Exit application',
      'theme.light': 'Light Theme',
      'theme.dark': 'Dark Theme',
      'theme.sepia': 'Sepia Theme',
      'lang.label': 'Language',
      'recent.title': 'Recent Files',
      'recent.clear': 'Clear history',
      'recent.clearBtn': 'Clear',
      'recent.empty': 'No recent files',
      'recent.emptyStateTitle': 'Recent',
      'about.version': 'Version {version}',
      'about.versionPlaceholder': 'Version —',
      'about.desc': 'Native Markdown reader and editor for Windows, Linux and macOS.',
      'about.descAndroid': 'Native Markdown reader for Android.',
      'about.close': 'Close (Esc)',
      'about.checkUpdate': 'Check for updates',
      'about.authorLine': 'David Bueno Vallejo · MIT License',
      'update.checking': 'Checking for updates…',
      'update.upToDate': "You're already on the latest version.",
      'update.available': 'New version {version} available.',
      'update.button': 'Update',
      'update.downloading': 'Downloading and installing…',
      'update.installed': 'Installed. Restarting…',
      'update.installFailed': 'Could not install the update. Please try again.',
      'update.checkFailed': "Couldn't check: verify your connection.",
      'update.store': 'Updates are installed automatically from the Microsoft Store.',
      'update.playStore': 'Updates managed by Google Play.',
      'ctx.goToSource': 'Go to code here',
      'ctx.editHere': 'Edit here',
      'ctx.doubleClick': 'double-click',
      'ctx.goToPreview': 'Go to preview',
      'ctx.copy': 'Copy',
      'ctx.cut': 'Cut',
      'ctx.paste': 'Paste',
      'ctx.selectAll': 'Select all',
      'ctx.copyMessage': 'Copy message',
      'ctx.clipboardDenied': 'The system did not allow access to the clipboard.',
      'img.pickFolder': 'Choose the folder to save the image in',
      'img.saveAsTitle': 'Save the image as',
      'img.saved': 'Image saved to {path}',
      'img.savedMany': '{n} images saved',
      'img.reused': 'That image was already in {path}',
      'img.codeCopied': ' · code copied to the clipboard',
      'img.failed': 'Could not save the image: {error}',
      'img.notSaved': 'The image was not saved.',
      'sync.notFound': 'Could not locate that point in the document.',
      'action.close': 'Close',
      'ai.loadFailed': 'Could not load the AI. Restart the app and try again.',
      'ai.menu.inline': 'AI: actions on the text…',
      'ai.inline.needEdit': 'Inline AI works on the editor: turn on Edit Mode (Ctrl+E).',
      'ai.addToChat': '✨ Add to the AI conversation',
      'ai.outsideFolder': 'That document is not in the folder of the open document.',
      'ai.button': 'AI assistant (Ctrl+Shift+I)',
      'ai.tab': 'Assistant',
      'ai.connectTitle': 'Connect an AI',
      'mermaid.openLive': '🔗 Open in mermaid.live',
      'mermaid.error': 'Mermaid diagram syntax error',
      'empty.subtitle': 'Ultra-lightweight native reader for Markdown files',
      'empty.openButton': 'Open .md file',
      'empty.dragHint': 'or drag a .md file here',
      'empty.urlLink': 'or open from a URL',
      'empty.newLink': 'or create a new document',
      'toc.empty': 'No headings',
      'sidebar.tabIndex': 'Index',
      'sidebar.tabFiles': 'Files',
      'fileTree.filterPlaceholder': 'Filter…',
      'fileTree.empty': 'No folder to show',
      'fileTree.refresh': '🔄 Refresh',
      'fileTree.reveal': '📂 Reveal in File Explorer',
      'fileTree.openNewWindow': '🗗 Open in new window ({mod}+click)',
      'quickOpen.placeholder': 'Go to file… (Ctrl+K)',
      'quickOpen.empty': 'No results',
      'url.placeholder': 'https://.../document.md',
      'url.openButton': 'Open',
      'url.close': 'Close (Esc)',
      'url.invalid': 'The URL must start with http:// or https://',
      'search.placeholder': 'Search in document…',
      'search.prev': 'Previous (Shift+Enter)',
      'search.next': 'Next (Enter)',
      'search.close': 'Close (Esc)',
      'search.target.editor': 'Editor',
      'search.target.preview': 'Preview',
      'search.targetLabel': 'Where to search',
      'toc.reorderHint': 'Drag to move the section (Alt+↑/↓)',
      'toc.moveFailed': 'Could not move the section (the document changed). Try again.',
      'copy.copy': 'Copy',
      'copy.copied': 'Copied!',
      'code.wrapOn': 'Wrap line',
      'code.wrapOff': 'No wrap',
      'doc.readingTime': '{n} min read',
      'doc.readOnly': 'Read-only',
      'doc.modified': 'Modified',
      'time.now': 'just now',
      'time.minutes': '{n} min',
      'time.hours': '{n} h',
      'time.days': '{n} d',
      'errors.loadFailed': 'Failed to load: {error}',
      'errors.saveFailed': 'Failed to save: {error}',
      'errors.fatalNoTauri': '[FATAL] window.__TAURI__ is not available. Are you running outside of Tauri?',
      'errors.fatalNoInvoke': '[FATAL] window.__TAURI__.core.invoke not available.',
      'editor.placeholder': 'Markdown…',
      'editor.newFileDefaultName': 'Untitled.md',
      'editor.conflictTitle': 'The file changed',
      'editor.conflictBody': 'This file was modified outside the app while you were editing it. What do you want to do?',
      'editor.conflictKeep': 'Keep my changes',
      'editor.conflictReload': 'Reload from disk',
      'editor.bannerText': 'The file changed on disk since your last edit.',
      'editor.bannerReload': 'Reload from disk',
      'editor.confirmDiscardTitle': 'Unsaved changes',
      'editor.confirmDiscardBody': 'You have unsaved changes in this document. If you continue, they will be lost.',
      'editor.confirmDiscardCancel': 'Keep editing',
      'editor.confirmDiscardOk': 'Discard changes',
      'help.close': 'Close (Esc)',
      'help.tabApp': 'App guide',
      'help.tabSyntax': 'Markdown syntax',
      'menu.help': 'Help',
      'help.loadError': 'Could not load the help.',
      'editor.resizeHandle': 'Drag to resize',
      'toc.resizeHandle': 'Drag to resize',
      'editor.save': 'Save (Ctrl+S)',
      'editor.format.bold': 'Bold (Ctrl+B)',
      'editor.format.italic': 'Italic (Ctrl+I)',
      'editor.format.strike': 'Strikethrough',
      'editor.format.code': 'Inline code',
      'editor.format.h1': 'Heading 1',
      'editor.format.h2': 'Heading 2',
      'editor.format.h3': 'Heading 3',
      'editor.format.ul': 'Bullet list',
      'editor.format.ol': 'Numbered list',
      'editor.format.task': 'Task list',
      'editor.format.link': 'Link',
      'editor.format.image': 'Image',
      'editor.format.quote': 'Blockquote',
      'editor.format.codeblock': 'Code block',
      'editor.format.table': 'Table',
      'editor.format.hr': 'Horizontal rule',
      'editor.format.boldSkeleton': 'bold text',
      'editor.format.italicSkeleton': 'italic text',
      'editor.format.strikeSkeleton': 'strikethrough text',
      'editor.format.codeSkeleton': 'code',
      'editor.format.linkTextSkeleton': 'link text',
      'editor.format.imageAltSkeleton': 'alt text',
      'editor.format.codeLangSkeleton': 'lang',
      'editor.format.codeBlockSkeleton': 'sample code',
      'editor.format.tableSkeleton': '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |',
      'editor.format.hrSkeleton': '---'
    }
  };

  // ─── Registro de idiomas (RF-39) ───────────────────────────────────────────
  // Añadir un idioma = su diccionario + `markdownhelp_<código>.md` + una llamada a `registerLanguage()`
  // (ver `i18n.ko.js`): el selector de la cabecera, la detección, `<html lang>` y la ayuda salen de aquí.
  // `es` y `en` van en este mismo fichero; el resto se registran desde su propio script, cargado antes de app.js.
  var LANGS = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' }
  ];
  // Idioma de reserva (RF-39.3/.5): el de un sistema no soportado y el de una clave que falte en el idioma activo.
  var FALLBACK_LANG = 'en';
  var STORAGE_KEY = 'dbv-md-lang';
  var currentLang = null;

  /** Idiomas disponibles, en orden de registro: `[{ code, name }]` con el nombre en su propio idioma. */
  function languages() {
    return LANGS.map(function (l) { return { code: l.code, name: l.name }; });
  }

  function isSupported(code) {
    return typeof code === 'string' && LANGS.some(function (l) { return l.code === code; });
  }

  /** Claves de un idioma (para comprobar que todos los diccionarios tienen las mismas). */
  function keysOf(code) {
    return DICT[code] ? Object.keys(DICT[code]) : [];
  }

  /**
   * Registra un idioma nuevo, o añade textos a uno existente. `code` son 2–3 letras minúsculas (el subtag
   * principal de BCP-47). Devuelve `false` si el código no vale.
   */
  function registerLanguage(code, name, dictionary) {
    var valid = typeof code === 'string' && /^[a-z]{2,3}$/.test(code);
    if (valid) {
      if (!DICT[code]) DICT[code] = {};
      if (!isSupported(code)) LANGS.push({ code: code, name: name || code });
      Object.keys(dictionary || {}).forEach(function (key) { DICT[code][key] = dictionary[key]; });
    }
    return valid;
  }

  /** Idioma que corresponde a una etiqueta del sistema (`ko-KR` → `ko`, `es-MX` → `es`), o el de reserva. */
  function fromSystem(tag) {
    var primary = String(tag || '').toLowerCase().split(/[-_]/)[0];
    return isSupported(primary) ? primary : FALLBACK_LANG;
  }

  /** Solo cuenta la elección EXPLÍCITA guardada; lo autodetectado no se guarda (RF-39.4). */
  function detectLang() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) { /* almacenamiento bloqueado: se autodetecta */ }
    return isSupported(saved) ? saved : fromSystem(navigator.language);
  }

  function t(key, vars) {
    var lang = currentLang || detectLang();
    var str = (DICT[lang] && DICT[lang][key]) || (DICT[FALLBACK_LANG] && DICT[FALLBACK_LANG][key]) || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace('{' + k + '}', vars[k]);
      });
    }
    return str;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
  }

  /**
   * Cambia el idioma activo. Por defecto es una elección del usuario y se guarda; el arranque pasa
   * `{ persist: false }` para aplicar el idioma detectado SIN convertirlo en una elección permanente.
   */
  function setLang(lang, opts) {
    if (!isSupported(lang)) return;
    currentLang = lang;
    if (!opts || opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* sin almacenamiento: vale solo para esta sesión */ }
    }
    document.documentElement.setAttribute('lang', lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('dbv-lang-changed', { detail: { lang: lang } }));
  }

  // Añade textos al diccionario: los módulos de la IA se cargan de forma perezosa
  // (RNF-IA.1) y traen los suyos, para no engordar el paquete inicial. Un idioma que no
  // traiga los suyos usa el inglés (reserva de `t()`).
  function register(dictionary) {
    Object.keys(dictionary || {}).forEach(function (lang) {
      var entries = dictionary[lang];
      // Propiedad propia: un nombre como `constructor` o `__proto__` no puede colarse como «idioma».
      if (Object.prototype.hasOwnProperty.call(DICT, lang) && entries) {
        Object.keys(entries).forEach(function (key) { DICT[lang][key] = entries[key]; });
      }
    });
    applyTranslations();
  }

  function getLang() {
    return currentLang || detectLang();
  }

  window.DBV_I18N = {
    t: t,
    setLang: setLang,
    getLang: getLang,
    applyTranslations: applyTranslations,
    register: register,
    languages: languages,
    registerLanguage: registerLanguage,
    isSupported: isSupported,
    fromSystem: fromSystem,
    keysOf: keysOf
  };
})();
