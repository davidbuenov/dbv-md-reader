// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Diccionarios ES/EN + helper t(). Sin librería de i18n (vanilla, mismo patrón
// IIFE que app.js) — la app tiene pocos textos, no justifica una dependencia.
// Cargar este script ANTES de app.js en index.html.
// =============================================================================
(function () {
  'use strict';

  var DICT = {
    es: {
      'toolbar.back': 'Atrás (Alt+←)',
      'toolbar.forward': 'Adelante (Alt+→)',
      'toolbar.noDocument': 'Sin documento abierto',
      'toolbar.search': 'Buscar (Ctrl+F)',
      'toolbar.openFile': 'Abrir archivo (Ctrl+O)',
      'toolbar.openUrl': 'Abrir desde URL',
      'toolbar.recent': 'Archivos recientes',
      'toolbar.print': 'Imprimir / PDF (Ctrl+P)',
      'toolbar.alwaysOnTop': 'Fijar ventana encima',
      'toolbar.alwaysOnTopActive': 'Ventana fijada encima — clic para quitar',
      'toolbar.editMode': 'Modo edición (Ctrl+E)',
      'toolbar.editModeActive': 'Modo edición activo — clic para volver a lectura (Ctrl+E)',
      'toolbar.toc': 'Tabla de Contenidos',
      'toolbar.markdownHelp': 'Ayuda de sintaxis Markdown',
      'toolbar.about': 'Acerca de DBV Markdown Reader',
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
      'mermaid.openLive': '🔗 Abrir en mermaid.live',
      'mermaid.error': 'Error de sintaxis en el diagrama Mermaid',
      'empty.subtitle': 'Lector nativo ultra-ligero para archivos Markdown',
      'empty.openButton': 'Abrir archivo .md',
      'empty.dragHint': 'o arrastra un archivo .md aquí',
      'empty.urlLink': 'o abrir desde una URL',
      'toc.empty': 'Sin encabezados',
      'sidebar.tabIndex': 'Índice',
      'sidebar.tabFiles': 'Archivos',
      'fileTree.filterPlaceholder': 'Filtrar…',
      'fileTree.empty': 'Sin carpeta que mostrar',
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
      'copy.copy': 'Copiar',
      'copy.copied': '¡Copiado!',
      'code.wrapOn': 'Ajustar línea',
      'code.wrapOff': 'Sin ajuste',
      'doc.readingTime': '{n} min de lectura',
      'doc.readOnly': 'Solo lectura',
      'time.now': 'ahora mismo',
      'time.minutes': '{n} min',
      'time.hours': '{n} h',
      'time.days': '{n} d',
      'errors.loadFailed': 'Error al cargar: {error}',
      'errors.saveFailed': 'Error al guardar: {error}',
      'errors.fatalNoTauri': '[FATAL] window.__TAURI__ no está disponible. ¿Estás ejecutando fuera de Tauri?',
      'errors.fatalNoInvoke': '[FATAL] window.__TAURI__.core.invoke no disponible.',
      'editor.placeholder': 'Markdown…',
      'editor.conflictTitle': 'El archivo cambió',
      'editor.conflictBody': 'Este archivo se modificó fuera de la aplicación mientras lo editabas. ¿Qué quieres hacer?',
      'editor.conflictKeep': 'Conservar mis cambios',
      'editor.conflictReload': 'Recargar desde disco',
      'editor.bannerText': 'El archivo cambió en disco desde tu última edición.',
      'editor.bannerReload': 'Recargar desde disco',
      'help.close': 'Cerrar (Esc)',
      'help.loadError': 'No se pudo cargar la ayuda de sintaxis Markdown.',
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
      'toolbar.openFile': 'Open file (Ctrl+O)',
      'toolbar.openUrl': 'Open from URL',
      'toolbar.recent': 'Recent files',
      'toolbar.print': 'Print / PDF (Ctrl+P)',
      'toolbar.alwaysOnTop': 'Keep window on top',
      'toolbar.alwaysOnTopActive': 'Window pinned on top — click to unpin',
      'toolbar.editMode': 'Edit mode (Ctrl+E)',
      'toolbar.editModeActive': 'Edit mode active — click to return to reading (Ctrl+E)',
      'toolbar.toc': 'Table of Contents',
      'toolbar.markdownHelp': 'Markdown syntax help',
      'toolbar.about': 'About DBV Markdown Reader',
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
      'mermaid.openLive': '🔗 Open in mermaid.live',
      'mermaid.error': 'Mermaid diagram syntax error',
      'empty.subtitle': 'Ultra-lightweight native reader for Markdown files',
      'empty.openButton': 'Open .md file',
      'empty.dragHint': 'or drag a .md file here',
      'empty.urlLink': 'or open from a URL',
      'toc.empty': 'No headings',
      'sidebar.tabIndex': 'Index',
      'sidebar.tabFiles': 'Files',
      'fileTree.filterPlaceholder': 'Filter…',
      'fileTree.empty': 'No folder to show',
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
      'copy.copy': 'Copy',
      'copy.copied': 'Copied!',
      'code.wrapOn': 'Wrap line',
      'code.wrapOff': 'No wrap',
      'doc.readingTime': '{n} min read',
      'doc.readOnly': 'Read-only',
      'time.now': 'just now',
      'time.minutes': '{n} min',
      'time.hours': '{n} h',
      'time.days': '{n} d',
      'errors.loadFailed': 'Failed to load: {error}',
      'errors.saveFailed': 'Failed to save: {error}',
      'errors.fatalNoTauri': '[FATAL] window.__TAURI__ is not available. Are you running outside of Tauri?',
      'errors.fatalNoInvoke': '[FATAL] window.__TAURI__.core.invoke not available.',
      'editor.placeholder': 'Markdown…',
      'editor.conflictTitle': 'The file changed',
      'editor.conflictBody': 'This file was modified outside the app while you were editing it. What do you want to do?',
      'editor.conflictKeep': 'Keep my changes',
      'editor.conflictReload': 'Reload from disk',
      'editor.bannerText': 'The file changed on disk since your last edit.',
      'editor.bannerReload': 'Reload from disk',
      'help.close': 'Close (Esc)',
      'help.loadError': 'Could not load the Markdown syntax help.',
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

  var STORAGE_KEY = 'dbv-md-lang';
  var currentLang = null;

  function detectLang() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
    var nav = (navigator.language || 'es').toLowerCase();
    return nav.indexOf('en') === 0 ? 'en' : 'es';
  }

  function t(key, vars) {
    var lang = currentLang || detectLang();
    var str = (DICT[lang] && DICT[lang][key]) || DICT.es[key] || key;
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

  function setLang(lang) {
    if (lang !== 'es' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('dbv-lang-changed', { detail: { lang: lang } }));
  }

  function getLang() {
    return currentLang || detectLang();
  }

  window.DBV_I18N = { t: t, setLang: setLang, getLang: getLang, applyTranslations: applyTranslations };
})();
