// =============================================================================
// dbv-md-reader — Lector nativo de Markdown · David Bueno Vallejo · MIT
// =============================================================================
(function () {
  'use strict';

  var t = window.DBV_I18N.t;

  // ─── Error display (muestra errores directamente en la ventana) ──────────
  var errorPanel = document.getElementById('error-panel');
  function showError(msg) {
    errorPanel.style.display = 'block';
    errorPanel.textContent += msg + '\n';
  }
  window.addEventListener('error', function (e) {
    showError('[ERROR] ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    showError('[PROMISE] ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
  });

  // ─── Verificar que Tauri está disponible ─────────────────────────────────
  if (!window.__TAURI__) {
    showError(t('errors.fatalNoTauri'));
    return;
  }
  if (!window.__TAURI__.core || !window.__TAURI__.core.invoke) {
    showError(t('errors.fatalNoInvoke'));
    return;
  }

  var invoke = window.__TAURI__.core.invoke;

  // ─── Detección de plataforma vía tauri-plugin-os (Slice 4) ────────────────
  // ─── Detección de plataforma vía UserAgent y tauri-plugin-os (Slice 4) ───
  var isAndroid = /android/i.test(navigator.userAgent);
  try {
    if (!isAndroid && window.__TAURI__ && window.__TAURI__.os && typeof window.__TAURI__.os.platform === 'function') {
      isAndroid = window.__TAURI__.os.platform() === 'android';
    } else if (!isAndroid && window.__TAURI_OS_PLUGIN_INTERNALS__ && window.__TAURI_OS_PLUGIN_INTERNALS__.platform) {
      isAndroid = window.__TAURI_OS_PLUGIN_INTERNALS__.platform === 'android';
    }
  } catch (_) {}

  // ─── Abrir una URL en el navegador del sistema (con fallback) ─────────────
  function openExternal(href) {
    try {
      window.__TAURI__.shell.open(href).catch(function () { window.open(href, '_blank'); });
    } catch (ex) { window.open(href, '_blank'); }
  }

  // ─── Estado ──────────────────────────────────────────────────────────────
  var currentDoc   = null;
  var history      = [];
  var histIdx      = -1;
  var currentMathFormulas = [];

  // Modo Edición (RF-20/RF-21)
  var editMode = false;
  var isDirty = false;
  var conflictPending = false; // ya se mostró el modal para la divergencia actual — no repetirlo
  var suppressSelfWriteUntil = 0; // Date.now() hasta el que se ignora file-changed (eco del propio write_file)
  var editDebounceTimer = null;

  // Guarda de cambios sin guardar: promesa que resuelve a true si es seguro
  // descartar el buffer del editor (no hay cambios, o el usuario confirma
  // perderlos) — un único punto usado antes de cualquier acción que lo
  // sobrescriba sin pasar por guardar (cerrar la ventana, salir de Modo
  // Edición, abrir otro documento).
  //
  // No se usa window.confirm(): el script de init de tauri-plugin-dialog
  // 2.7.2 lo redefine para invocar el comando "plugin:dialog|confirm", pero
  // en esa versión del plugin ese comando ya no existe en el lado Rust (solo
  // quedan registrados "open"/"save"/"message" — "confirm" se fusionó con
  // "message" y el script de init nunca se actualizó); ningún permiso lo
  // arregla porque el comando no existe (confirmado en vivo: "Command not
  // found"). Tampoco se usa el diálogo nativo del SO vía "message" — queda
  // fuera de lugar frente al resto de la interfaz. discardModalCtrl se
  // declara más abajo junto a conflictModalCtrl — accesible aquí igual por
  // hoisting de var, ya usado por conflictModalCtrl desde el listener
  // file-changed (más arriba en el fichero, pero definido más abajo).
  var pendingDiscardResolve = null;
  function resolvePendingDiscard(value) {
    if (!pendingDiscardResolve) return;
    var resolve = pendingDiscardResolve;
    pendingDiscardResolve = null;
    resolve(value);
  }
  function confirmDiscardUnsavedChanges() {
    if (!(editMode && isDirty)) return Promise.resolve(true);
    // Ya hay una confirmación en curso (p. ej. Atrás y luego Ctrl+E antes de
    // responder): no pisar el resolver pendiente, o esa primera acción se
    // quedaría esperando para siempre. Declina la segunda en vez de competir.
    if (pendingDiscardResolve) return Promise.resolve(false);
    return new Promise(function (resolve) {
      pendingDiscardResolve = resolve;
      discardModalCtrl.open();
    });
  }

  // Único punto de escritura de isDirty: así el badge "Modificado" de la
  // cabecera nunca se desincroniza del estado real (en vez de acordarse de
  // actualizarlo a mano en cada sitio que toca isDirty).
  function setDirty(value) {
    if (isDirty === value) return; // evita una escritura al DOM en cada pulsación de tecla sin cambio real de estado
    isDirty = value;
    updateModifiedBadge();
  }
  function updateModifiedBadge() {
    modifiedBadge.classList.toggle('hidden', !(editMode && isDirty));
  }

  function isRemoteUrl(str) {
    return /^https?:\/\//i.test(str || '');
  }

  // "Sin guardado posible" — no solo URLs remotas (RF-08A): un documento SAF
  // en Android (content://) tampoco tiene comando de escritura implementado
  // (RF-20 fuera de alcance ahí, ADR-031) — mismo criterio de solo lectura,
  // así el botón "Editar"/badge "Solo lectura" no dependen de que exista
  // isSafUri() en el momento en que se declara esta función (hoisting).
  function isRemoteDoc(doc) {
    return !!doc && (isRemoteUrl(doc.path) || isSafUri(doc.path));
  }

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var contentEl    = document.getElementById('content');
  var emptyEl      = document.getElementById('empty-state');
  var breadcrumb   = document.getElementById('doc-breadcrumb');
  var readingTimeEl = document.getElementById('doc-reading-time');
  var readOnlyBadge = document.getElementById('doc-readonly-badge');
  var modifiedBadge = document.getElementById('doc-modified-badge');
  var tocSidebar   = document.getElementById('toc-sidebar');
  var tocResizer   = document.getElementById('toc-resizer');
  var tocList      = document.getElementById('toc-list');
  var btnBack      = document.getElementById('btn-back');
  var btnForward   = document.getElementById('btn-forward');
  var readerContainer = document.getElementById('reader-container');
  var progressFill = document.getElementById('reading-progress-fill');
  var scrollSpyObserver = null;
  var tocHeaders = []; // h1/h2/h3 del documento actual, calculado una vez en buildToc()

  // Modo Edición (RF-20/RF-21)
  var editorPane        = document.getElementById('editor-pane');
  var editorToolbar     = document.getElementById('editor-toolbar');
  var editorResizer     = document.getElementById('editor-resizer');
  var editorTextarea    = document.getElementById('editor-textarea');
  var editorLineNumbers = document.getElementById('editor-line-numbers');
  var btnEditToggle     = document.getElementById('btn-edit-toggle');
  var btnSave           = document.getElementById('btn-save');
  var conflictBanner    = document.getElementById('conflict-banner');

  // ─── Exclusiones de UI en Android (Slice 4, RF-13/19/20/21/25) ─────────────
  function applyPlatformExclusions() {
    if (!isAndroid) return;
    document.body.classList.add('is-android');
    if (btnEditToggle) btnEditToggle.classList.add('hidden');
    if (btnSave) btnSave.classList.add('hidden');
    var btnAlways = document.getElementById('btn-always-on-top');
    if (btnAlways) btnAlways.classList.add('hidden');
    var btnCheck = document.getElementById('btn-check-update');
    if (btnCheck) btnCheck.style.display = 'none';
    var uStatus = document.getElementById('update-status');
    if (uStatus) {
      uStatus.textContent = t('update.playStore');
      uStatus.classList.remove('is-available');
    }
    var aboutDesc = document.querySelector('.about-desc');
    if (aboutDesc) aboutDesc.textContent = t('about.descAndroid');
    var dragHint = document.querySelector('.empty-hint');
    if (dragHint) dragHint.classList.add('hidden');
  }

  if (isAndroid) {
    applyPlatformExclusions();
  } else if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    invoke('plugin:os|platform').then(function (plat) {
      if (plat === 'android') {
        isAndroid = true;
        applyPlatformExclusions();
      }
    }).catch(function () {});
  }

  // ─── markdown-it ─────────────────────────────────────────────────────────
  if (!window.markdownit) { showError('[ERROR] markdown-it no cargado'); return; }
  var md = window.markdownit({ html: true, linkify: true, typographer: true });
  // enabled:false deja los checkboxes con `disabled=""` — coherente con la app de solo lectura.
  if (window.markdownitTaskLists) md.use(window.markdownitTaskLists, { enabled: false });
  if (window.markdownitFootnote) md.use(window.markdownitFootnote);

  // ─── Alertas GFM: > [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION] ──
  // markdown-it no soporta esta sintaxis de fábrica: sin esto la cita se
  // renderiza literal, con "[!NOTE]" como texto plano dentro del blockquote.
  // Se detecta tras el parseo a bloques (core.ruler) y se reescribe el
  // blockquote_open/close como un div.markdown-alert con icono y color según tipo.
  (function githubAlertsPlugin() {
    var MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;
    var LABELS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };
    var ICONS = {
      NOTE: '<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="4.8" r="0.9" fill="currentColor"/><rect x="7.25" y="7" width="1.5" height="4.6" rx="0.6" fill="currentColor"/></svg>',
      TIP: '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.5a4.75 4.75 0 0 0-2.7 8.66c.32.22.53.58.53 1v.34h4.34v-.34c0-.42.21-.78.53-1A4.75 4.75 0 0 0 8 1.5Zm-1.6 11h3.2v.9a1.6 1.6 0 0 1-3.2 0v-.9Z"/></svg>',
      IMPORTANT: '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="1.3" d="M1.5 2.75c0-.69.56-1.25 1.25-1.25h10.5c.69 0 1.25.56 1.25 1.25v7.5c0 .69-.56 1.25-1.25 1.25H8.06l-2.85 2.85a.5.5 0 0 1-.85-.35v-2.5H2.75c-.69 0-1.25-.56-1.25-1.25v-7.5Z"/><rect x="7.3" y="4" width="1.4" height="4" rx="0.6" fill="currentColor"/><circle cx="8" cy="9.3" r="0.85" fill="currentColor"/></svg>',
      WARNING: '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" d="M8 1.5 15 13.5H1L8 1.5Z"/><rect x="7.3" y="5.8" width="1.4" height="3.6" rx="0.5" fill="currentColor"/><circle cx="8" cy="11" r="0.85" fill="currentColor"/></svg>',
      CAUTION: '<svg viewBox="0 0 16 16" width="16" height="16"><polygon fill="none" stroke="currentColor" stroke-width="1.3" points="5,1.5 11,1.5 14.5,5 14.5,11 11,14.5 5,14.5 1.5,11 1.5,5"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
    };

    // after('inline'): en 'block' los tokens de párrafo aún no tienen `.children`
    // (eso lo rellena la regla 'inline', que corre después) — hace falta esperar
    // a que exista para poder inspeccionar/editar el primer texto de la cita.
    md.core.ruler.after('inline', 'github_alerts', function (state) {
      var tokens = state.tokens;
      for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== 'blockquote_open') continue;
        var openIdx = i;
        var paraOpen = tokens[openIdx + 1];
        var inline = tokens[openIdx + 2];
        if (!paraOpen || paraOpen.type !== 'paragraph_open' || !inline || inline.type !== 'inline') continue;
        var firstChild = inline.children && inline.children[0];
        if (!firstChild || firstChild.type !== 'text') continue;
        var m = MARKER_RE.exec(firstChild.content);
        if (!m) continue;
        var kind = m[1];

        // Quita el marcador "[!TIPO]" del primer texto; si no queda nada en esa
        // línea (caso habitual: el marcador va solo, seguido de salto de línea),
        // se retira también el salto para que el contenido no arranque con hueco.
        firstChild.content = firstChild.content.slice(m[0].length);
        if (firstChild.content === '') {
          inline.children.shift();
          var next = inline.children[0];
          if (next && (next.type === 'softbreak' || next.type === 'hardbreak')) inline.children.shift();
        }
        // Marcador en su propio párrafo (línea en blanco antes del contenido real): se elimina el párrafo vacío.
        if (inline.children.length === 0) {
          tokens.splice(openIdx + 1, 3); // paragraph_open, inline, paragraph_close
        }

        var level = tokens[openIdx].level;
        for (var j = openIdx + 1; j < tokens.length; j++) {
          if (tokens[j].type === 'blockquote_close' && tokens[j].level === level) {
            tokens[j].type = 'github_alert_close';
            tokens[j].tag = 'div';
            break;
          }
        }

        tokens[openIdx].type = 'github_alert_open';
        tokens[openIdx].tag = 'div';
        tokens[openIdx].meta = { kind: kind };
      }
    });

    md.renderer.rules.github_alert_open = function (tokens, idx) {
      var kind = tokens[idx].meta.kind;
      return '<div class="markdown-alert markdown-alert-' + kind.toLowerCase() + '">\n' +
        '<p class="markdown-alert-title">' + ICONS[kind] + LABELS[kind] + '</p>\n';
    };
    md.renderer.rules.github_alert_close = function () {
      return '</div>\n';
    };
  })();

  // ─── DOMPurify (sanitización de HTML, RF-03) ──────────────────────────────
  if (!window.DOMPurify) { showError('[ERROR] DOMPurify no cargado'); return; }

  // ─── Mermaid ─────────────────────────────────────────────────────────────
  if (window.mermaid) {
    // suppressErrorRendering: sin esto, un diagrama con error de sintaxis resuelve
    // la promesa igualmente con un SVG de error propio de Mermaid (icono de bomba
    // enorme, sin detalle de línea) en vez de rechazarla — así se puede mostrar un
    // aviso compacto y con el mensaje real del parser (que si incluye la línea).
    window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose', suppressErrorRendering: true });
  }

  // ─── Matemáticas (KaTeX, RF-17) ────────────────────────────────────────────
  // Preprocesado: se ejecuta ANTES de md.render(). A diferencia de un bloque
  // ```mermaid``` (ya opaco para markdown-it desde el principio), $...$/$$...$$
  // son texto normal dentro de un párrafo — si se dejaran pasar tal cual,
  // emphasis/typographer podrían corromperlos (mismo problema de capa que
  // RF-03/ADR-009). Se sustituyen aquí por un placeholder de HTML crudo que
  // markdown-it (html:true) deja pasar intacto, y se rellenan de verdad en
  // processMath(), después del render + sanitizado.
  var MATH_PROTECT_RE = / MATH_PROTECT_(\d+) /g;

  function protectCodeRegions(text) {
    var blocks = [];
    function stash(s) {
      blocks.push(s);
      return ' MATH_PROTECT_' + (blocks.length - 1) + ' ';
    }
    // Bloques de código con fence (``` o ~~~, incluye ```math y ```mermaid).
    text = text.replace(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]{0,3}\2[ \t]*$/gm, stash);
    // Code spans inline (`code`).
    text = text.replace(/`+[^`\n]*`+/g, stash);
    return { text: text, blocks: blocks };
  }

  function restoreCodeRegions(text, blocks) {
    return text.replace(MATH_PROTECT_RE, function (_, i) { return blocks[Number(i)]; });
  }

  function mathPlaceholder(latex, displayMode, formulas) {
    var idx = formulas.length;
    formulas.push(latex);
    return '<span class="dbv-math" data-i="' + idx + '" data-display="' + (displayMode ? '1' : '0') + '"></span>';
  }

  function extractMath(raw) {
    var formulas = [];
    var protectedText = protectCodeRegions(raw);
    var text = protectedText.text;

    // Display: $$...$$ (antes del inline, que si no consumiría los $ sueltos).
    text = text.replace(/(^|[^\\])\$\$([\s\S]+?)\$\$/g, function (m, pre, body) {
      return pre + mathPlaceholder(body.trim(), true, formulas);
    });
    // Inline: $...$ — sin espacio pegado al delimitador; \$ escapa (no abre).
    text = text.replace(/(^|[^\\])\$([^\n$]+?)\$/g, function (m, pre, body) {
      if (/^\s|\s$/.test(body)) return m;
      return pre + mathPlaceholder(body, false, formulas);
    });

    text = restoreCodeRegions(text, protectedText.blocks);
    return { text: text, formulas: formulas };
  }

  function renderKatex(latex, displayMode) {
    var html = window.katex.renderToString(latex, { displayMode: displayMode, throwOnError: false });
    return window.DOMPurify.sanitize(html);
  }

  // =========================================================================
  // Carga y renderizado de documentos
  // =========================================================================

  // ─── Android: Storage Access Framework (SAF) — despacho por esquema de URI ─
  // Slice 2 (dbv-specs-ops/implementation_plan.md): en vez de hacer que los
  // comandos Rust de escritorio (`read_file`/`list_directory`/
  // `resolve_relative_path`) entiendan `content://`, cada uno tiene un
  // equivalente Android en el plugin `saf` (mismo shape de entrada/salida,
  // ver `src-tauri/plugins/tauri-plugin-saf/src/commands.rs`) y estas tres
  // funciones eligen cuál invocar según el esquema de la propia ruta — el
  // resto de la app (loadDocument, filetree.js, resolveImages, interceptLinks)
  // no necesita saber en qué plataforma corre.
  function isSafUri(path) { return !!path && path.indexOf('content://') === 0; }

  function readFileAny(path) {
    return isSafUri(path)
      ? invoke('plugin:saf|read_document', { uri: path })
      : invoke('read_file', { path: path });
  }

  function listDirectoryAny(path) {
    return isSafUri(path)
      ? invoke('plugin:saf|list_children', { uri: path })
      : invoke('list_directory', { path: path });
  }

  function resolveRelativeAny(baseDir, relativePath) {
    return isSafUri(baseDir)
      ? invoke('plugin:saf|resolve_relative', { baseDirUri: baseDir, relativePath: relativePath })
      : invoke('resolve_relative_path', { baseDir: baseDir, relativePath: relativePath });
  }

  function loadDocument(filePath, opts) {
    if (!filePath) return;
    opts = opts || {};
    var isHistory     = opts.isHistory;
    var scrollAnchor  = opts.scrollAnchor;
    var isPrimaryOpen = opts.isPrimaryOpen;

    // Navegar (RF-20): setEditMode(false) más abajo sobrescribe el buffer del
    // editor sin pasar por guardar — hay que confirmar antes si hay cambios
    // sin guardar. La navegación por historial (Alt+←/→, ver navigateHistory)
    // ya confirmó esto antes de mover histIdx: repetirlo aquí volvería a
    // preguntar sobre el mismo estado sin haber cambiado nada.
    var confirmed = isHistory ? Promise.resolve(true) : confirmDiscardUnsavedChanges();
    confirmed.then(function (proceed) {
      if (!proceed) return;
      var docPromise = (opts.initialPayload && opts.initialPayload.content)
        ? Promise.resolve(opts.initialPayload)
        : readFileAny(filePath);
      docPromise
        .then(function (doc) {
          currentDoc = doc;
          resolvedImageCache = {}; // documento nuevo: mismas rutas relativas podrían resolver distinto
          setEditMode(false); // cada documento nuevo empieza en modo lectura (RF-20)
          btnEditToggle.disabled = isRemoteDoc(doc); // sin guardado posible sobre una URL (RF-08A)
          if (isAndroid) {
            btnEditToggle.classList.add('hidden');
            btnSave.classList.add('hidden');
          }
          readOnlyBadge.classList.toggle('hidden', !isRemoteDoc(doc));
          if (!isHistory) {
            if (histIdx < history.length - 1) history = history.slice(0, histIdx + 1);
            history.push(doc.path);
            histIdx = history.length - 1;
          }
          breadcrumb.textContent = doc.file_name;
          breadcrumb.title = doc.path;
          updateNavButtons();
          renderMarkdown(doc.content);
          emptyEl.classList.add('hidden');
          contentEl.classList.remove('hidden');
          // Auto-abrir TOC si tiene encabezados en pantalla ancha (>768px); en móvil permanece cerrado hasta toggle explícito
          if (tocHeaders.length > 0 && window.innerWidth > 768) {
            setTocVisible(true);
          } else {
            setTocVisible(false);
          }
          // Scroll: si hay ancla, ir a ella; si no, al inicio
          var container = document.getElementById('reader-container');
          if (scrollAnchor) {
            container.scrollTop = 0;
            setTimeout(function () {
              var anchorId = scrollAnchor.replace(/^#/, '');
              var target = document.getElementById(anchorId);
              if (!target) {
                // Buscar por name attribute también
                target = document.querySelector('[name="' + anchorId + '"]');
              }
              if (target) scrollElementIntoView(target);
            }, 120);
          } else {
            container.scrollTop = 0;
          }
          // Persistencia del documento activo para restauración tras pausa/recarga en Android
          if (isAndroid && doc && doc.content) {
            try {
              localStorage.setItem('dbv-md-last-doc', JSON.stringify({
                path: doc.path,
                file_name: doc.file_name,
                content: doc.content,
                dir_path: doc.dir_path || ''
              }));
            } catch (_) {}
          }
          // Auto-recarga (RF-06), instancia única (RF-14) y Archivos Recientes
          // (RF-11): ninguno tiene todavía equivalente SAF en Android (RF-06 está
          // fuera de alcance por diseño; RF-14 no aplica al modelo de una sola
          // Activity; RF-11 sobre `content://` se autocuraría de inmediato porque
          // `Path::exists()` en Rust siempre es `false` para esas URIs) — se
          // omiten en vez de hacer llamadas Rust que fallarían o no harían nada.
          if (!isSafUri(doc.path)) {
            // Auto-recarga (RF-06): vigilar el documento activo
            invoke('watch_file', { path: doc.path }).catch(function (err) {
              console.warn('[watch_file]', err);
            });
            // RF-14: registra qué documento muestra esta ventana, para que un "Abrir con"
            // repetido sobre el mismo archivo enfoque esta ventana en vez de duplicarla.
            invoke('register_open_document', { path: doc.path }).catch(function (err) {
              console.warn('[register_open_document]', err);
            });
            // Archivos recientes (RF-11): solo en aperturas explícitas
            if (isPrimaryOpen) {
              invoke('add_recent_file', { path: doc.path, fileName: doc.file_name })
                .then(renderRecentPanel)
                .catch(function (err) { console.warn('[add_recent_file]', err); });
            }
          }
          // RF-25: la raíz del árbol de directorios sigue siempre al documento activo.
          if (window.DBVFileTree) window.DBVFileTree.onDocumentLoaded(doc);
        })
        .catch(function (err) {
          if (opts.isAutoRestore) {
            console.warn('[autoRestore]', err);
            try { localStorage.removeItem('dbv-md-last-doc'); } catch (_) {}
            return;
          }
          showError('[loadDocument] ' + err);
          alert(t('errors.loadFailed', { error: err }));
        });
    });
  }

  // ─── Android: Storage Access Framework (SAF) ───────────────────────────────
  // Selección directa de archivo individual con ACTION_OPEN_DOCUMENT (un solo toque)
  function openAndroidSafFile() {
    invoke('plugin:saf|pick_file_and_read_markdown')
      .then(function (doc) {
        if (!doc) return;
        loadDocument(doc.path, {
          isPrimaryOpen: true,
          initialPayload: doc
        });
      })
      .catch(function (err) {
        if (err === 'cancelled') return;
        console.warn('[saf pick_file_and_read_markdown fallback]', err);
        openAndroidSafFolder();
      });
  }

  // Selección de árbol/carpeta completa con ACTION_OPEN_DOCUMENT_TREE
  function openAndroidSafFolder() {
    invoke('plugin:saf|pick_folder_and_read_first_markdown')
      .then(function (doc) {
        if (!doc) return;
        loadDocument(doc.path, {
          isPrimaryOpen: true,
          initialPayload: doc
        });
      })
      .catch(function (err) {
        console.warn('[saf pick_folder_and_read_first_markdown]', err);
      });
  }



  // Puente hacia módulos hermanos (RF-25 árbol, RF-26 Quick Open,
  // `src/filetree.js`, cargado DESPUÉS de este script) — reutilizan la misma
  // apertura de documento, detección de URL remota y mecanismo de panel
  // flotante que ya tiene app.js, en vez de reimplementarlos.
  window.DBVApp = {
    // Abre un documento en la ventana actual sin conocer los detalles internos
    // de loadDocument() — cuenta como apertura explícita (isPrimaryOpen), igual
    // que un clic en Recientes.
    openDocument: function (path) { loadDocument(path, { isPrimaryOpen: true }); },
    isRemoteUrl: isRemoteUrl,
    setTocVisible: setTocVisible,
    registerPanel: registerPanel,
    // RF-25 sobre SAF (Slice 2): filetree.js lista carpetas sin saber si la
    // raíz actual es una ruta de disco o un árbol `content://` — ver
    // isSafUri()/listDirectoryAny() más arriba.
    listDirectory: listDirectoryAny,
    // Detección de plataforma expuesta para filetree.js (Slice 4)
    get isAndroid() { return isAndroid; },
    set isAndroid(v) { isAndroid = !!v; }
  };

  // ─── Auto-recarga por cambios externos (RF-06) ────────────────────────────
  var reloadDebounceTimer = null;

  function reloadCurrentDocument() {
    if (!currentDoc) return;
    var container = document.getElementById('reader-container');
    var savedScroll = container.scrollTop;
    readFileAny(currentDoc.path)
      .then(function (doc) {
        currentDoc = doc;
        var tokens = renderMarkdown(doc.content);
        // Vista Dividida en Vivo / Modo Espejo (RF-20): sin cambios propios sin
        // guardar, el panel de código también se refresca, no solo la preview.
        if (editMode) { editorTextarea.value = doc.content; setDirty(false); updateEditorLineNumbers(); updateHeadingAnchors(tokens); }
        container.scrollTop = savedScroll;
      })
      .catch(function (err) { console.warn('[reloadCurrentDocument]', err); });
  }

  window.__TAURI__.event.listen('file-changed', function (event) {
    if (!currentDoc || event.payload !== currentDoc.path) return;
    if (Date.now() < suppressSelfWriteUntil) return; // eco del propio write_file (RF-21)
    if (editMode && isDirty) {
      // Con cambios sin guardar: modal solo la primera vez para esta divergencia
      // (RF-21) — ni sobrescribir en silencio ni repetir el modal en cada evento.
      if (!conflictPending) {
        conflictPending = true;
        conflictModalCtrl.open();
      }
      return;
    }
    clearTimeout(reloadDebounceTimer);
    reloadDebounceTimer = setTimeout(reloadCurrentDocument, 150);
  }).catch(function (err) {
    showError('[file-changed listener] ' + err);
  });

  // Slice 3 (versión Android): "Abrir con" desde Gmail/Drive/un gestor de archivos
  // mientras la app ya está en marcha — emitido por lib.rs (RunEvent::Opened en
  // Android, ver el comentario junto a `.run(...)`) solo cuando ya hay una ventana,
  // así que aquí siempre sustituye el documento actual (RF-14 en Android: sin
  // equivalente a "ventana nueva"). El caso en frío (app arrancando) no pasa por
  // aquí — lo cubre `get_cli_argument()` más abajo en la inicialización, igual que
  // ya hace con argv en Windows/Linux.
  window.__TAURI__.event.listen('android-intent-opened', function (event) {
    loadDocument(event.payload, { isPrimaryOpen: true });
  }).catch(function (err) {
    showError('[android-intent-opened listener] ' + err);
  });

  // targetEl: dónde renderizar — por defecto #content (el documento abierto),
  // pero el modal de Ayuda de sintaxis (RF-22) reutiliza este mismo pipeline
  // completo sobre #help-content en vez de mantener un renderizador propio
  // más pobre (así comparten sanitizado, Prism, Mermaid, KaTeX e ids de
  // encabezado con slug real, sin duplicar ni la mitad de la lógica).
  // Lo que sí es exclusivo del documento principal (TOC, tiempo de lectura,
  // barra de progreso, resolución de imágenes relativas a currentDoc) solo se
  // ejecuta cuando targetEl es #content.
  // Devuelve los tokens de markdown-it usados para este render (en vez de solo
  // renderizar y tirarlos) — la sincronización de scroll del Modo Edición
  // necesita la línea de origen de cada encabezado (RF-20, updateHeadingAnchors),
  // y volver a parsear el mismo texto ahí sería un segundo parseo completo del
  // documento en cada render con debounce mientras se escribe. `md.render()`
  // internamente ya hace `parse()` + `renderer.render()`; separarlos dos
  // líneas permite reutilizar los tokens sin cambiar el HTML resultante.
  function renderMarkdown(raw, targetEl) {
    targetEl = targetEl || contentEl;
    var extracted = extractMath(raw);
    currentMathFormulas = extracted.formulas;
    var tokens = md.parse(extracted.text, {});
    var html = md.renderer.render(tokens, md.options, {});
    html = window.DOMPurify.sanitize(html, { ADD_ATTR: ['id', 'class', 'name'] });
    targetEl.innerHTML = html;
    // :not(.language-mermaid):not(.language-math) — esos bloques los sustituye
    // processMermaid()/processMath() por un SVG/KaTeX justo después, así que
    // resaltarlos y añadirles botones aquí sería trabajo tirado a la basura.
    targetEl.querySelectorAll('pre code:not(.language-mermaid):not(.language-math)').forEach(function (block) {
      block.parentElement.classList.add('line-numbers');
      if (window.Prism) window.Prism.highlightElement(block);
      addCopyButton(block.parentElement);
      addWrapToggleButton(block.parentElement);
    });
    assignHeadingIds(targetEl);
    processMermaid(targetEl);
    processMath(targetEl);
    interceptLinks(targetEl);
    if (targetEl === contentEl) {
      resolveImages(targetEl);
      buildToc();
      setupScrollSpy();
      updateReadingTime(raw);
      updateReadingProgress();
    }
    return tokens;
  }

  // ─── Tiempo de lectura estimado (200 palabras/min sobre el markdown crudo) ─
  function updateReadingTime(raw) {
    var words = raw.trim().split(/\s+/).filter(Boolean).length;
    if (!words) { readingTimeEl.classList.add('hidden'); return; }
    var minutes = Math.max(1, Math.round(words / 200));
    readingTimeEl.textContent = t('doc.readingTime', { n: minutes });
    readingTimeEl.classList.remove('hidden');
  }

  // ─── Resolución de imágenes locales (RF-07) ───────────────────────────────
  // ruta relativa → asset:// ya resuelta para el documento actual. En Modo
  // Edición renderMarkdown() (y por tanto resolveImages) se llama en cada
  // render con debounce mientras se escribe — sin este caché, cada imagen se
  // re-resolvería por IPC en cada uno aunque la ruta no haya cambiado.
  // Invalidado en loadDocument() al cambiar de documento (mismo texto de ruta
  // relativa podría resolver a otro sitio con un dir_path distinto).
  var resolvedImageCache = {};

  function resolveImages(container) {
    if (!currentDoc || !currentDoc.dir_path) return;
    container.querySelectorAll('img[src]').forEach(function (img) {
      var src = img.getAttribute('src');
      if (!src || /^(https?:|data:|asset:)/i.test(src)) return;
      if (resolvedImageCache[src]) { img.src = resolvedImageCache[src]; return; }
      resolveRelativeAny(currentDoc.dir_path, src)
        .then(function (resolved) {
          // El WebView de Android no puede cargar `content://` directamente en
          // <img src> como sí hace convertFileSrc() con rutas de fichero reales
          // en escritorio — se lee la imagen y se incrusta como `data:` URI.
          if (isSafUri(resolved)) {
            return invoke('plugin:saf|read_image_data_uri', { uri: resolved }).then(function (dataUri) {
              resolvedImageCache[src] = dataUri;
              img.src = dataUri;
            });
          }
          var assetUrl = window.__TAURI__.core.convertFileSrc(resolved);
          resolvedImageCache[src] = assetUrl;
          img.src = assetUrl;
        })
        .catch(function (err) { console.warn('[resolveImages]', src, err); });
    });
  }

  // ─── Botones flotantes de un bloque de código (Copiar, Ajustar línea) ──────
  // Comparten un único contenedor `.code-actions` (posicionamiento/aparición
  // al hover en CSS) y la clase base `.code-action-btn` (estilo visual);
  // cada botón solo aporta su clase identificadora, etiqueta y comportamiento.
  function ensureCodeActions(pre) {
    var actions = pre.querySelector('.code-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'code-actions';
      pre.appendChild(actions);
    }
    return actions;
  }

  function createActionButton(className, label) {
    var btn = document.createElement('button');
    btn.className = 'code-action-btn ' + className;
    btn.textContent = label;
    return btn;
  }

  function addCopyButton(pre) {
    var actions = ensureCodeActions(pre);
    if (actions.querySelector('.code-copy-btn')) return;
    var btn = createActionButton('code-copy-btn', t('copy.copy'));
    btn.addEventListener('click', function () {
      var text = (pre.querySelector('code') || {}).innerText || '';
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = t('copy.copied');
        setTimeout(function () { btn.textContent = t('copy.copy'); }, 2000);
      });
    });
    actions.appendChild(btn);
  }

  function addWrapToggleButton(pre) {
    var actions = ensureCodeActions(pre);
    if (actions.querySelector('.code-wrap-btn')) return;
    var btn = createActionButton('code-wrap-btn', t('code.wrapOn'));
    btn.addEventListener('click', function () {
      var wrapped = pre.classList.toggle('wrapped');
      btn.textContent = wrapped ? t('code.wrapOff') : t('code.wrapOn');
    });
    actions.appendChild(btn);
  }

  function processMermaid(container) {
    if (!window.mermaid) return;
    var blocks = container.querySelectorAll('pre code.language-mermaid');
    blocks.forEach(function (codeEl, i) {
      var pre = codeEl.parentElement;
      var code = codeEl.innerText;
      window.mermaid.render('mermaid-' + i + '-' + Date.now(), code)
        .then(function (result) {
          var div = document.createElement('div');
          div.className = 'mermaid-container';
          div.innerHTML = result.svg;
          div.dataset.mermaidSource = code; // para el menú contextual "Abrir en mermaid.live"
          pre.replaceWith(div);
        })
        .catch(function (e) {
          console.warn('Mermaid:', e);
          var div = document.createElement('div');
          div.className = 'mermaid-error';
          var title = document.createElement('strong');
          title.textContent = t('mermaid.error');
          var msg = document.createElement('pre');
          msg.textContent = (e && (e.message || e.str)) || String(e);
          div.appendChild(title);
          div.appendChild(msg);
          pre.replaceWith(div);
        });
    });
  }

  function processMath(container) {
    if (!window.katex) return;
    container.querySelectorAll('span.dbv-math').forEach(function (span) {
      var latex = currentMathFormulas[Number(span.dataset.i)];
      if (latex === undefined) return;
      try {
        span.outerHTML = renderKatex(latex, span.dataset.display === '1');
      } catch (e) { console.warn('KaTeX:', e); }
    });
    container.querySelectorAll('pre code.language-math').forEach(function (codeEl) {
      var pre = codeEl.parentElement;
      try {
        var div = document.createElement('div');
        div.className = 'katex-display-block';
        div.innerHTML = renderKatex(codeEl.innerText, true);
        pre.replaceWith(div);
      } catch (e) { console.warn('KaTeX:', e); }
    });
  }

  // El navegador serializa `getAttribute('href')` de un "#ancla-con-acentos"
  // percent-encoded (ej. "é" -> "%C3%A9") aunque el markdown original y el
  // `id` real del encabezado (asignado por githubSlug, texto Unicode literal)
  // no lo estén — sin decodificar aquí, cualquier ancla con tilde/ñ no
  // encuentra nunca su encabezado.
  function decodeAnchor(fragment) {
    try { return decodeURIComponent(fragment); } catch (e) { return fragment; }
  }

  function interceptLinks(container) {
    container.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (isRemoteUrl(href)) {
          openExternal(href);
        } else if (href.startsWith('#')) {
          // Ancla dentro de este mismo contenedor (documento principal o modal de ayuda)
          var el = container.querySelector('#' + CSS.escape(decodeAnchor(href.slice(1))));
          if (el) scrollElementIntoView(el);
        } else if (currentDoc && currentDoc.dir_path) {
          // Enlace relativo — separar ruta del fragmento #ancla
          var hashIdx = href.indexOf('#');
          var filePart   = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
          var anchorPart = hashIdx >= 0 ? decodeAnchor(href.slice(hashIdx)) : '';
          if (!filePart) {
            // Solo ancla, sin archivo
            var el = container.querySelector('#' + CSS.escape(anchorPart.slice(1)));
            if (el) scrollElementIntoView(el);
            return;
          }
          resolveRelativeAny(currentDoc.dir_path, filePart)
            .then(function (resolved) { loadDocument(resolved, { scrollAnchor: anchorPart }); })
            .catch(function (err) { showError('[link] ' + err); });
        }
      });
    });
  }

  // Emula el "slugger" de GitHub para ids de encabezado: markdown-it no genera
  // ninguno por defecto, pero cualquier documento con una tabla de contenidos
  // escrita a mano al estilo GitHub (ej. `[Encabezados](#1-encabezados)`, como
  // en markdownhelp_es.md) asume este formato exacto para que el enlace funcione.
  // El id que esta función asigna es SIEMPRE texto Unicode literal (nunca
  // percent-encoded) — markdown-it sí percent-codifica el `href` del enlace
  // que apunta a él si el slug tiene tildes/ñ (`normalizeLink`, interno a la
  // librería). decodeAnchor(), en interceptLinks() más abajo, es la mitad
  // que mantiene ambos lados sincronizados; si cambia este generador de ids,
  // revisar que decodeAnchor() lo siga cubriendo.
  function githubSlug(text, usedSlugs) {
    // Ojo, dos diferencias con un slugify "normal" — GitHub no las hace, y
    // hay documentos (README.md, markdownhelp_*.md) con enlaces internos
    // escritos a mano que ya asumen su comportamiento exacto:
    //  1. Sustituye cada espacio por un guion UNO A UNO, sin colapsar tiradas
    //     — quitar la "/" de "Alertas / callouts" deja dos espacios seguidos,
    //     luego dos guiones ("alertas--callouts"), no uno.
    //  2. No hace trim: un encabezado como "🚀 Instala" pierde el emoji pero
    //     no el espacio que le seguía, así que el id empieza en guion
    //     ("-instala"), no en la palabra.
    var slug = text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    if (!slug) slug = 'section';
    var count = usedSlugs[slug] || 0;
    usedSlugs[slug] = count + 1;
    return count === 0 ? slug : slug + '-' + count;
  }

  // Asigna id a TODOS los encabezados (h1-h6) de un contenedor recién
  // renderizado — independiente de cuáles acaben en la Tabla de Contenidos
  // (solo h1-h3, ver buildToc). Se llama para el documento principal y para
  // el modal de Ayuda (RF-22): cualquier contenido renderizado con
  // renderMarkdown() puede tener enlaces internos que dependan de estos ids.
  function assignHeadingIds(container) {
    var usedSlugs = {};
    container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (h) {
      if (!h.id) h.id = githubSlug(h.innerText, usedSlugs);
    });
  }

  // Encuentra el ancestro que realmente hace scroll (o el propio elemento) en
  // vez de asumir a mano cuál es el contenedor scrollable — cambia según el
  // contexto (documento principal en modo lectura vs. edición, modal de
  // ayuda...) y usar el ancestro equivocado desalinea el destino del scroll.
  function findScrollHost(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
      node = node.parentElement;
    }
    return readerContainer;
  }

  function scrollElementIntoView(el, opts) {
    var host = findScrollHost(el);
    var origin = host.getBoundingClientRect().top - host.scrollTop;
    var targetTop = el.getBoundingClientRect().top - origin;
    if (opts && opts.align === 'center') {
      targetTop -= (host.clientHeight - el.getBoundingClientRect().height) / 2;
    }
    host.scrollTo({ top: targetTop, behavior: 'smooth' });
  }

  function buildToc() {
    tocList.innerHTML = '';
    tocHeaders = Array.prototype.slice.call(contentEl.querySelectorAll('h1,h2,h3'));
    if (!tocHeaders.length) {
      tocList.innerHTML = '<p class="text-xs text-muted">' + t('toc.empty') + '</p>';
      return;
    }
    tocHeaders.forEach(function (h) {
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.innerText;
      a.className = 'block py-1 hover:text-accent truncate transition ' +
        (h.tagName === 'H1' ? 'toc-item-h1' : h.tagName === 'H2' ? 'toc-item-h2' : 'toc-item-h3');
      a.addEventListener('click', function (e) {
        e.preventDefault();
        scrollElementIntoView(h);
        if (window.innerWidth <= 768) {
          setTocVisible(false);
        }
      });
      tocList.appendChild(a);
    });
  }

  // Muestra/oculta el TOC y su divisor arrastrable juntos (mismo estado siempre).
  function setTocVisible(visible) {
    tocSidebar.classList.toggle('hidden', !visible);
    tocResizer.classList.toggle('hidden', !visible);
  }

  // ─── TOC: resaltar la sección visible mientras se hace scroll ─────────────
  function setupScrollSpy() {
    if (scrollSpyObserver) scrollSpyObserver.disconnect();
    if (!tocHeaders.length) return;
    scrollSpyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = tocList.querySelector('a[href="#' + entry.target.id + '"]');
        if (!link) return;
        tocList.querySelectorAll('a.active').forEach(function (a) { a.classList.remove('active'); });
        link.classList.add('active');
        // Mantiene la Tabla de Contenidos sincronizada con la sección visible:
        // si el enlace activo queda fuera de la vista del panel, lo trae a ella.
        // Nativo a propósito (no scrollElementIntoView()): #toc-sidebar es el
        // único ancestro scrollable de este enlace (hermano de #reader-container,
        // no descendiente — sin la ambigüedad que sí afecta a los clics dentro
        // del documento en Modo Edición), y "nearest" evita saltos innecesarios
        // cuando el enlace ya está visible, algo que el helper compartido no
        // ofrece (solo alinea a 'start'/'center').
        link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      // root: readerContainer es intencional y NO tiene por qué coincidir con
      // el contenedor que de verdad hace scroll en cada momento (en Modo
      // Edición es #content, no readerContainer, que pasa a overflow:hidden) —
      // IntersectionObserver solo usa `root` como marco de referencia para el
      // cálculo de intersección, no como el elemento que debe scrollear. Si un
      // futuro cambio "corrige" esto a contentEl, dejaría de funcionar en modo
      // lectura (donde #content no scrollea por sí solo). No tocar sin probar
      // ambos modos.
    }, { root: readerContainer, rootMargin: '0px 0px -70% 0px' });
    tocHeaders.forEach(function (h) { scrollSpyObserver.observe(h); });
  }

  // ─── Barra de progreso de lectura ──────────────────────────────────────────
  function updateReadingProgress() {
    var max = readerContainer.scrollHeight - readerContainer.clientHeight;
    var pct = max > 0 ? (readerContainer.scrollTop / max) * 100 : 0;
    progressFill.style.width = pct + '%';
  }
  readerContainer.addEventListener('scroll', function () {
    window.requestAnimationFrame(updateReadingProgress);
  });

  // =========================================================================
  // Navegación historia
  // =========================================================================

  function updateNavButtons() {
    btnBack.disabled    = histIdx <= 0;
    btnForward.disabled = histIdx >= history.length - 1;
  }

  // Confirmar ANTES de tocar histIdx: loadDocument no repite esta comprobación
  // para isHistory:true (ver su comentario), así que si el usuario cancelara
  // dentro de loadDocument, histIdx ya habría avanzado sin que la navegación
  // ocurriera de verdad — se desincronizaría del documento realmente mostrado.
  function navigateHistory(delta) {
    var target = histIdx + delta;
    if (target < 0 || target >= history.length) return;
    confirmDiscardUnsavedChanges().then(function (proceed) {
      if (!proceed) return;
      histIdx = target;
      loadDocument(history[histIdx], { isHistory: true });
    });
  }
  btnBack.addEventListener('click', function () { navigateHistory(-1); });
  btnForward.addEventListener('click', function () { navigateHistory(1); });

  // =========================================================================
  // Temas
  // =========================================================================

  var btnThemes = {
    light: document.getElementById('theme-light'),
    dark:  document.getElementById('theme-dark'),
    sepia: document.getElementById('theme-sepia')
  };

  var mBtnThemes = {
    light: document.getElementById('m-theme-light'),
    dark:  document.getElementById('m-theme-dark'),
    sepia: document.getElementById('m-theme-sepia')
  };

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Object.keys(btnThemes).forEach(function (k) {
      if (btnThemes[k]) btnThemes[k].classList.remove('active');
      if (mBtnThemes[k]) mBtnThemes[k].classList.remove('active');
    });
    if (btnThemes[theme]) btnThemes[theme].classList.add('active');
    if (mBtnThemes[theme]) mBtnThemes[theme].classList.add('active');
    localStorage.setItem('dbv-md-theme', theme);
  }

  Object.keys(btnThemes).forEach(function (name) {
    if (btnThemes[name]) btnThemes[name].addEventListener('click', function () { setTheme(name); });
    if (mBtnThemes[name]) mBtnThemes[name].addEventListener('click', function () { setTheme(name); });
  });

  document.getElementById('btn-toggle-toc').addEventListener('click', function () {
    setTocVisible(tocSidebar.classList.contains('hidden'));
  });

  // =========================================================================
  // Idioma
  // =========================================================================

  var btnLangs = {
    es: document.getElementById('lang-es'),
    en: document.getElementById('lang-en')
  };

  var mBtnLangs = {
    es: document.getElementById('m-lang-es'),
    en: document.getElementById('m-lang-en')
  };

  function setLang(lang) {
    window.DBV_I18N.setLang(lang);
    Object.keys(btnLangs).forEach(function (k) {
      if (btnLangs[k]) btnLangs[k].classList.remove('active');
      if (mBtnLangs[k]) mBtnLangs[k].classList.remove('active');
    });
    if (btnLangs[lang]) btnLangs[lang].classList.add('active');
    if (mBtnLangs[lang]) mBtnLangs[lang].classList.add('active');
    // El breadcrumb no lleva data-i18n (si hay un documento abierto, applyTranslations()
    // no debe pisar su nombre de archivo con el texto de "sin documento").
    if (!currentDoc) breadcrumb.textContent = t('toolbar.noDocument');
    if (isAndroid) {
      var uStatus = document.getElementById('update-status');
      if (uStatus) uStatus.textContent = t('update.playStore');
      var aboutDesc = document.querySelector('.about-desc');
      if (aboutDesc) aboutDesc.textContent = t('about.descAndroid');
    }
  }

  Object.keys(btnLangs).forEach(function (name) {
    if (btnLangs[name]) btnLangs[name].addEventListener('click', function () { setLang(name); });
    if (mBtnLangs[name]) mBtnLangs[name].addEventListener('click', function () { setLang(name); });
  });

  // =========================================================================
  // Paneles flotantes (helper compartido: abrir/cerrar/clic-fuera/Escape)
  // =========================================================================

  var panelClosers = [];

  function closeAllPanels() {
    panelClosers.forEach(function (close) { close(); });
  }

  // Registra un panel `.hidden`-toggleable y devuelve { open, close }.
  // opts.trigger: botón que lo abre (opts.toggle: true si ese botón alterna abrir/cerrar).
  // opts.closeOnOutsideClick: cierra al hacer clic fuera del panel y del trigger.
  // opts.onOpen / opts.onClose: efectos secundarios (foco, limpieza, fetch de datos...).
  function registerPanel(panelEl, opts) {
    opts = opts || {};
    var triggers = opts.trigger ? [].concat(opts.trigger) : [];
    function close() {
      panelEl.classList.add('hidden');
      if (opts.onClose) opts.onClose();
    }
    function open() {
      panelEl.classList.remove('hidden');
      if (opts.onOpen) opts.onOpen();
    }
    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        if (opts.toggle) {
          e.stopPropagation();
          if (panelEl.classList.contains('hidden')) open(); else close();
        } else {
          open();
        }
      });
    });
    if (opts.closeOnOutsideClick) {
      document.addEventListener('click', function (e) {
        if (!panelEl.classList.contains('hidden') && !panelEl.contains(e.target) && triggers.indexOf(e.target) === -1) {
          close();
        }
      });
    }
    panelClosers.push(close);
    return { open: open, close: close };
  }

  // =========================================================================
  // Menú contextual sobre un diagrama Mermaid — "Abrir en mermaid.live"
  // =========================================================================

  function uint8ToUrlSafeBase64(bytes) {
    var CHUNK = 0x8000; // evitar RangeError de String.fromCharCode.apply con diagramas grandes
    var binary = '';
    for (var i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Mismo formato que usa mermaid.live internamente (src/lib/util/serde.ts: pakoSerde)
  // para codificar su estado en la URL, así el enlace abre el diagrama ya cargado.
  function buildMermaidLiveUrl(code) {
    var state = {
      code: code,
      mermaid: JSON.stringify({ theme: 'dark' }, null, 2), // mismo tema que usamos al renderizar (ver processMermaid)
      updateDiagram: true,
      rough: false,
      grid: true
    };
    var bytes = new TextEncoder().encode(JSON.stringify(state));
    var compressed = window.pako.deflate(bytes, { level: 9 });
    return 'https://mermaid.live/edit#pako:' + uint8ToUrlSafeBase64(compressed);
  }

  var mermaidMenu = document.getElementById('mermaid-context-menu');
  var mermaidMenuSource = null;

  function hideMermaidMenu() { mermaidMenu.classList.add('hidden'); }

  contentEl.addEventListener('contextmenu', function (e) {
    var container = e.target.closest('.mermaid-container');
    if (!container) { hideMermaidMenu(); return; }
    e.preventDefault();
    mermaidMenuSource = container.dataset.mermaidSource || null;
    mermaidMenu.style.left = e.clientX + 'px';
    mermaidMenu.style.top = e.clientY + 'px';
    mermaidMenu.classList.remove('hidden');
  });
  document.addEventListener('click', hideMermaidMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideMermaidMenu(); });
  document.getElementById('mermaid-open-live').addEventListener('click', function () {
    if (mermaidMenuSource) openExternal(buildMermaidLiveUrl(mermaidMenuSource));
    hideMermaidMenu();
  });

  // =========================================================================
  // Acerca de
  // =========================================================================

  var aboutVersion = document.getElementById('about-version');
  var aboutPanel = registerPanel(document.getElementById('about-modal'), {
    trigger: document.getElementById('btn-about'),
    onOpen: function () {
      invoke('get_app_version')
        .then(function (version) { aboutVersion.textContent = t('about.version', { version: version }); })
        .catch(function (err) { console.warn('[get_app_version]', err); });
    }
  });

  document.getElementById('about-close').addEventListener('click', aboutPanel.close);
  document.getElementById('about-backdrop').addEventListener('click', aboutPanel.close);

  [document.getElementById('about-link-web'), document.getElementById('about-link-github')].forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      openExternal(link.getAttribute('href'));
    });
  });

  // =========================================================================
  // Configuración móvil (Android)
  // =========================================================================

  var settingsPanelEl = document.getElementById('settings-panel');
  var btnSettingsEl = document.getElementById('btn-settings');
  if (settingsPanelEl && btnSettingsEl) {
    var settingsPanel = registerPanel(settingsPanelEl, {
      trigger: btnSettingsEl,
      toggle: true,
      closeOnOutsideClick: true
    });
    var settingsCloseBtn = document.getElementById('settings-close');
    if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', settingsPanel.close);
    var mBtnAboutEl = document.getElementById('m-btn-about');
    if (mBtnAboutEl) {
      mBtnAboutEl.addEventListener('click', function () {
        settingsPanel.close();
        aboutPanel.open();
      });
    }
    var mBtnExitEl = document.getElementById('m-btn-exit');
    if (mBtnExitEl) {
      mBtnExitEl.addEventListener('click', function () {
        settingsPanel.close();
        if (isAndroid) {
          invoke('plugin:saf|exit_app').catch(function () {
            try { window.__TAURI__.window.getCurrentWindow().close(); } catch (_) { window.close(); }
          });
        } else {
          try { window.__TAURI__.window.getCurrentWindow().close(); } catch (_) { window.close(); }
        }
      });
    }
  }

  // =========================================================================
  // Ayuda de sintaxis Markdown (chuleta ES/EN según idioma activo)
  // =========================================================================

  var helpContentEl = document.getElementById('help-content');
  var helpRenderedText = null; // último texto ya renderizado en #help-content (con su idioma como prefijo)

  var helpModalCtrl = registerPanel(document.getElementById('help-modal'), {});
  document.getElementById('help-backdrop').addEventListener('click', helpModalCtrl.close);
  document.getElementById('help-close').addEventListener('click', helpModalCtrl.close);

  document.getElementById('btn-markdown-help').addEventListener('click', function () {
    var lang = window.DBV_I18N.getLang();
    helpModalCtrl.open();
    // La lectura del fichero (barata) se repite en cada apertura — a
    // diferencia del documento principal (RF-06, watch_file), este fetch no
    // reacciona solo a cambios externos del fichero, así que editar
    // markdownhelp_*.md no se reflejaba hasta recargar toda la ventana. Lo
    // caro (parseo + DOMPurify + Prism + Mermaid + KaTeX por diagrama/fórmula)
    // solo se repite si el contenido leído cambió de verdad.
    fetch('markdownhelp_' + lang + '.md', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        var cacheKey = lang + '\n' + text;
        if (cacheKey === helpRenderedText) return;
        helpRenderedText = cacheKey;
        // Mismo pipeline completo que el documento principal (RF-02/03) —
        // no un renderizador aparte: así el modal de ayuda también resuelve
        // fórmulas KaTeX, diagramas Mermaid y sus propios enlaces internos.
        renderMarkdown(text, helpContentEl);
      })
      .catch(function (err) {
        showError('[markdown-help] ' + err);
        helpContentEl.textContent = t('help.loadError');
      });
  });

  // ─── Buscar actualizaciones (bajo demanda, nunca al arrancar) ─────────────
  var btnCheckUpdate = document.getElementById('btn-check-update');
  var updateStatus   = document.getElementById('update-status');
  var pendingUpdate  = null; // Update de @tauri-apps/plugin-updater, ya descargable

  function setUpdateStatus(text, isAvailable) {
    updateStatus.textContent = text;
    updateStatus.classList.toggle('is-available', !!isAvailable);
  }

  function installPendingUpdate() {
    if (!pendingUpdate) return;
    btnCheckUpdate.disabled = true;
    setUpdateStatus(t('update.downloading'), true);
    pendingUpdate.downloadAndInstall()
      .then(function () {
        setUpdateStatus(t('update.installed'), true);
        return window.__TAURI__.process.relaunch();
      })
      .catch(function (err) {
        console.warn('[updater] downloadAndInstall', err);
        btnCheckUpdate.disabled = false;
        setUpdateStatus(t('update.installFailed'), false);
      });
  }

  // Instalado vía MSIX (Microsoft Store) o en Android (Google Play Store): las
  // actualizaciones las gestiona la Store, no este updater (que apunta a GitHub
  // Releases). En Android la comprobación de updates queda completamente fuera de alcance.
  if (isAndroid) {
    btnCheckUpdate.style.display = 'none';
    setUpdateStatus(t('update.playStore'), false);
  } else {
    invoke('is_packaged_app').then(function (isPackaged) {
      if (isPackaged) {
        btnCheckUpdate.style.display = 'none';
        setUpdateStatus(t('update.store'), false);
        return;
      }

    btnCheckUpdate.addEventListener('click', function () {
      if (pendingUpdate) { installPendingUpdate(); return; }

      btnCheckUpdate.disabled = true;
      setUpdateStatus(t('update.checking'), false);

      window.__TAURI__.updater.check()
        .then(function (update) {
          btnCheckUpdate.disabled = false;
          if (!update) {
            setUpdateStatus(t('update.upToDate'), false);
            return;
          }
          pendingUpdate = update;
          btnCheckUpdate.textContent = t('update.button');
          setUpdateStatus(t('update.available', { version: update.version }), true);
        })
        .catch(function (err) {
          console.warn('[updater] check', err);
          btnCheckUpdate.disabled = false;
          setUpdateStatus(t('update.checkFailed'), false);
        });
    });
  });
}

  // =========================================================================
  // Búsqueda (Ctrl+F)
  // =========================================================================

  var searchInput   = document.getElementById('search-input');
  var searchCounter = document.getElementById('search-counter');
  var searchMatches = [], searchCurrent = -1;

  var searchPanel = registerPanel(document.getElementById('search-modal'), {
    trigger: document.getElementById('btn-search'),
    onOpen: function () { searchInput.focus(); searchInput.select(); },
    onClose: function () {
      contentEl.querySelectorAll('mark.search-highlight').forEach(function (m) {
        m.replaceWith(document.createTextNode(m.textContent));
      });
      contentEl.normalize();
      searchMatches = []; searchCurrent = -1; searchCounter.textContent = '0/0';
    }
  });

  function runSearch(q) {
    contentEl.querySelectorAll('mark.search-highlight').forEach(function (m) {
      m.replaceWith(document.createTextNode(m.textContent));
    });
    contentEl.normalize();
    searchMatches = []; searchCurrent = -1;
    if (!q.trim()) { searchCounter.textContent = '0/0'; return; }
    var lq = q.toLowerCase();
    var walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var txt = node.textContent, low = txt.toLowerCase(), idx = low.indexOf(lq);
      if (idx === -1) return;
      var frag = document.createDocumentFragment(), last = 0;
      while (idx !== -1) {
        frag.appendChild(document.createTextNode(txt.slice(last, idx)));
        var mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = txt.slice(idx, idx + q.length);
        frag.appendChild(mark);
        searchMatches.push(mark);
        last = idx + q.length;
        idx = low.indexOf(lq, last);
      }
      frag.appendChild(document.createTextNode(txt.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
    if (searchMatches.length) { searchCurrent = 0; highlightCurrent(); }
    searchCounter.textContent = searchMatches.length ? '1/' + searchMatches.length : '0/0';
  }

  function highlightCurrent() {
    searchMatches.forEach(function (m) { m.classList.remove('search-active'); });
    var m = searchMatches[searchCurrent];
    if (m) {
      m.classList.add('search-active');
      scrollElementIntoView(m, { align: 'center' });
      searchCounter.textContent = (searchCurrent + 1) + '/' + searchMatches.length;
    }
  }

  document.getElementById('search-close').addEventListener('click', searchPanel.close);
  document.getElementById('search-prev').addEventListener('click', function () {
    if (searchCurrent > 0) { searchCurrent--; highlightCurrent(); }
  });
  document.getElementById('search-next').addEventListener('click', function () {
    if (searchCurrent < searchMatches.length - 1) { searchCurrent++; highlightCurrent(); }
  });
  searchInput.addEventListener('input', function (e) { runSearch(e.target.value); });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { if (searchCurrent > 0) { searchCurrent--; highlightCurrent(); } }
      else            { if (searchCurrent < searchMatches.length - 1) { searchCurrent++; highlightCurrent(); } }
    }
  });

  // =========================================================================
  // Archivos Recientes (RF-11)
  // =========================================================================

  var recentList      = document.getElementById('recent-list');
  var btnClearRecent  = document.getElementById('btn-clear-recent');
  var emptyRecent     = document.getElementById('empty-recent');
  var emptyRecentList = document.getElementById('empty-recent-list');

  function formatRelativeTime(epochSeconds) {
    var diff = Math.max(0, Math.floor(Date.now() / 1000) - epochSeconds);
    if (diff < 60) return t('time.now');
    if (diff < 3600) return t('time.minutes', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hours', { n: Math.floor(diff / 3600) });
    return t('time.days', { n: Math.floor(diff / 86400) });
  }

  function buildRecentItem(file) {
    var item = document.createElement('div');
    item.className = 'recent-item';
    item.title = file.path;
    var nameEl = document.createElement('span');
    nameEl.className = 'recent-item-name';
    nameEl.textContent = file.file_name;
    var pathEl = document.createElement('span');
    pathEl.className = 'recent-item-path';
    pathEl.textContent = file.path;
    var timeEl = document.createElement('span');
    timeEl.className = 'recent-item-time';
    timeEl.textContent = formatRelativeTime(file.last_opened);
    item.appendChild(nameEl);
    item.appendChild(pathEl);
    item.appendChild(timeEl);
    item.addEventListener('click', function () {
      loadDocument(file.path, { isPrimaryOpen: true });
      recentPanelCtrl.close();
    });
    return item;
  }

  function renderRecentPanel(list) {
    recentList.innerHTML = '';
    if (!list.length) {
      recentList.innerHTML = '<p class="text-xs text-muted">' + t('recent.empty') + '</p>';
    } else {
      list.forEach(function (file) { recentList.appendChild(buildRecentItem(file)); });
    }

    emptyRecentList.innerHTML = '';
    if (list.length) {
      list.slice(0, 5).forEach(function (file) { emptyRecentList.appendChild(buildRecentItem(file)); });
      emptyRecent.classList.remove('hidden');
    } else {
      emptyRecent.classList.add('hidden');
    }

    // RF-25: sin documento activo (arranque en frío), el árbol usa la carpeta
    // del último archivo de Recientes — no-op si ya hay una raíz (documento
    // cargado antes de que esta llamada asíncrona resuelva).
    if (window.DBVFileTree) window.DBVFileTree.onRecentFilesLoaded(list);
  }

  function loadRecentFiles() {
    invoke('get_recent_files')
      .then(renderRecentPanel)
      .catch(function (err) { console.warn('[get_recent_files]', err); });
  }

  var recentPanelCtrl = registerPanel(document.getElementById('recent-panel'), {
    trigger: document.getElementById('btn-recent'),
    toggle: true,
    closeOnOutsideClick: true
  });

  btnClearRecent.addEventListener('click', function () {
    invoke('clear_recent_files')
      .then(loadRecentFiles)
      .catch(function (err) { console.warn('[clear_recent_files]', err); });
  });

  // =========================================================================
  // Apertura de archivo (diálogo nativo vía Rust)
  // =========================================================================

  function openFileDialog() {
    invoke('open_file_dialog')
      .then(function (selected) {
        if (selected) loadDocument(selected, { isPrimaryOpen: true });
      })
      .catch(function (err) {
        showError('[open_file_dialog] ' + err);
      });
  }

  function handleOpenAction() {
    if (isAndroid) {
      openAndroidSafFile();
    } else {
      openFileDialog();
    }
  }

  document.getElementById('btn-open-file').addEventListener('click', handleOpenAction);
  document.getElementById('btn-empty-open').addEventListener('click', handleOpenAction);
  document.getElementById('btn-print').addEventListener('click', function () { window.print(); });

  // ─── Always on Top (por ventana, sin persistencia — ver memory.md ADR-023) ─
  (function () {
    var btnAlwaysOnTop = document.getElementById('btn-always-on-top');
    if (isAndroid) {
      if (btnAlwaysOnTop) btnAlwaysOnTop.classList.add('hidden');
      return;
    }
    var currentWindow = window.__TAURI__.window.getCurrentWindow();

    function setButtonState(active) {
      var key = active ? 'toolbar.alwaysOnTopActive' : 'toolbar.alwaysOnTop';
      btnAlwaysOnTop.classList.toggle('active', active);
      btnAlwaysOnTop.setAttribute('data-i18n-title', key);
      btnAlwaysOnTop.title = t(key);
    }

    btnAlwaysOnTop.addEventListener('click', function () {
      currentWindow.isAlwaysOnTop().then(function (isActive) {
        return currentWindow.setAlwaysOnTop(!isActive).then(function () { return !isActive; });
      }).then(setButtonState).catch(function (err) {
        showError('[always-on-top] ' + err);
      });
    });
  })();

  // ─── Confirmación al cerrar con cambios sin guardar ─────────────────────
  // El cierre nativo (la X de la ventana) no pasaba por isDirty: se perdían
  // ediciones sin avisar. onCloseRequested intercepta ese cierre para poder
  // preguntar antes, con la misma guarda que salir de Modo Edición o navegar
  // a otro documento (confirmDiscardUnsavedChanges).
  (function () {
    var currentWindow = window.__TAURI__.window.getCurrentWindow();
    currentWindow.onCloseRequested(function (event) {
      // Se devuelve la promesa (no se resuelve aquí mismo): el wrapper de
      // Tauri hace `await handler(evt)` antes de mirar isPreventDefault(),
      // así que hasta que no se resuelve confirmDiscardUnsavedChanges() no
      // decide si de verdad se cierra la ventana o no.
      return confirmDiscardUnsavedChanges().then(function (proceed) {
        if (!proceed) event.preventDefault();
      });
    });
  })();

  // "Abrir archivo…" del menú nativo File de macOS (Cmd+O): el menú vive en
  // Rust (no hay DOM ahí), así que emite este evento a la ventana enfocada
  // en vez de reimplementar el diálogo.
  window.__TAURI__.event.listen('menu-open-file', openFileDialog);
  // "Guardar" y "Alternar Modo Edición" del menú nativo de macOS (File/View):
  // mismo patrón, el menú vive en Rust y avisa por evento a la ventana enfocada.
  window.__TAURI__.event.listen('menu-save', saveCurrentDocument);
  window.__TAURI__.event.listen('menu-toggle-edit-mode', toggleEditMode);

  // =========================================================================
  // Apertura de documento remoto por URL (RF-08A)
  // =========================================================================

  var urlInput = document.getElementById('url-input');

  var urlPanelCtrl = registerPanel(document.getElementById('url-panel'), {
    trigger: [document.getElementById('btn-open-url'), document.getElementById('btn-empty-url')],
    closeOnOutsideClick: true,
    onOpen: function () { urlInput.focus(); urlInput.select(); }
  });

  function submitUrl() {
    var url = urlInput.value.trim();
    if (!url) return;
    if (!isRemoteUrl(url)) {
      showError('[open-url] ' + t('url.invalid'));
      alert(t('url.invalid'));
      return;
    }
    loadDocument(url, { isPrimaryOpen: true });
    urlPanelCtrl.close();
  }

  document.getElementById('url-close').addEventListener('click', urlPanelCtrl.close);
  document.getElementById('url-open-btn').addEventListener('click', submitUrl);
  urlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitUrl(); }
  });

  // =========================================================================
  // Drag & Drop nativo de Tauri v2
  // =========================================================================

  window.__TAURI__.event.listen('tauri://drag-drop', function (event) {
    var paths = event.payload && event.payload.paths;
    if (paths && paths.length > 0) {
      var fp = paths[0];
      if (/\.(md|markdown|txt)$/i.test(fp)) {
        loadDocument(fp, { isPrimaryOpen: true });
      } else if (window.DBVFileTree) {
        // RF-25: arrastrar una carpeta (no un .md) la fija como raíz del árbol.
        // setRootFromDrop() resuelve a false si `fp` no es una carpeta legible,
        // en cuyo caso el drop se ignora igual que antes (imágenes, PDFs...).
        window.DBVFileTree.setRootFromDrop(fp);
      }
    }
  }).catch(function (err) {
    showError('[drag-drop listener] ' + err);
  });

  window.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); });
  window.addEventListener('drop',     function (e) { e.preventDefault(); e.stopPropagation(); });

  // =========================================================================
  // Zoom (Ctrl+Rueda, Ctrl++, Ctrl+-, Ctrl+0)
  // =========================================================================

  var zoomLevel = parseInt(localStorage.getItem('dbv-md-zoom') || '100', 10);
  var zoomToast = null;

  function applyZoom(level, opts) {
    opts = opts || {};
    zoomLevel = Math.min(200, Math.max(60, level));
    contentEl.style.zoom = zoomLevel + '%';
    tocSidebar.style.zoom = zoomLevel + '%';
    localStorage.setItem('dbv-md-zoom', String(zoomLevel));
    if (!opts.silent) showZoomToast();
  }

  function zoomIn()    { applyZoom(zoomLevel + 10); }
  function zoomOut()   { applyZoom(zoomLevel - 10); }
  function zoomReset() { applyZoom(100); }

  function showZoomToast() {
    if (!zoomToast) {
      zoomToast = document.createElement('div');
      zoomToast.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:24px',
        'background:rgba(0,0,0,0.75)', 'color:#fff',
        'padding:8px 16px', 'border-radius:8px',
        'font-size:14px', 'font-weight:600',
        'pointer-events:none', 'z-index:9998',
        'transition:opacity 0.3s ease'
      ].join(';');
      document.body.appendChild(zoomToast);
    }
    zoomToast.textContent = '🔍 ' + zoomLevel + '%';
    zoomToast.style.opacity = '1';
    clearTimeout(zoomToast._timer);
    zoomToast._timer = setTimeout(function () {
      zoomToast.style.opacity = '0';
    }, 1200);
  }

  // Ctrl + Rueda de ratón
  window.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }, { passive: false });

  // =========================================================================
  // Modo Edición (RF-20) + Gestión de Conflictos (RF-21)
  // =========================================================================

  // Números de línea del panel de código: un <textarea> plano no los trae de
  // serie (decisión consciente de no usar un editor de código, ver ADR-027) —
  // se calculan a partir de los saltos de línea reales y se mantienen alineados
  // porque el textarea no hace wrap (wrap="off"/white-space:pre, 1 línea lógica
  // = 1 línea visual siempre).
  var lastGutterLineCount = 0;

  function updateEditorLineNumbers() {
    var lineCount = editorTextarea.value.split('\n').length;
    cachedTotalLines = Math.max(1, lineCount - 1);
    // La mayoría de pulsaciones no añaden ni quitan una línea — reconstruir y
    // reescribir el textContent de la columna en cada una sería trabajo tirado
    // a la basura para el caso común (editar dentro de la misma línea).
    if (lineCount !== lastGutterLineCount) {
      var lines = '';
      for (var i = 1; i <= lineCount; i++) lines += i + '\n';
      editorLineNumbers.textContent = lines;
      lastGutterLineCount = lineCount;
    }
    editorLineNumbers.scrollTop = editorTextarea.scrollTop;
  }

  // ─── Divisores arrastrables: editor↔preview y Tabla de Contenidos ─────────
  // getRect() se evalúa una sola vez al iniciar el arrastre, no en cada
  // 'mousemove' — el contenedor no se mueve durante su propio arrastre, así
  // que releer su geometría en cada evento sería trabajo (y un layout forzado
  // del navegador) tirado a la basura.
  function startHorizontalDrag(handle, getRect, onMove) {
    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      handle.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      var rect = getRect();
      function move(ev) { onMove(ev.clientX, rect); }
      function stop() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        handle.classList.remove('resizing');
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
    });
  }

  // Reparto código/preview como fracción (0.2-0.8) del ancho del panel — en
  // vez de píxeles absolutos, para que se reescale correctamente si la
  // ventana cambia de tamaño entre sesiones. Se expone como variable CSS
  // (--editor-split, ver #reader-container.edit-mode #content en styles.css)
  // en vez de estilo inline en #content/#editor-pane — así no hace falta
  // limpiar nada al salir del Modo Edición, la regla que la usa solo aplica
  // bajo la clase .edit-mode. Devuelve la fracción ya recortada para que
  // quien la llame no tenga que repetir el mismo clamp.
  function applyEditorSplit(fraction) {
    fraction = Math.min(0.8, Math.max(0.2, fraction));
    readerContainer.style.setProperty('--editor-split', (fraction * 100) + '%');
    return fraction;
  }

  function restoreEditorSplit() {
    var saved = parseFloat(localStorage.getItem('dbv-md-editor-split'));
    if (isFinite(saved)) applyEditorSplit(saved);
  }

  startHorizontalDrag(editorResizer, function () { return readerContainer.getBoundingClientRect(); }, function (clientX, rect) {
    var fraction = applyEditorSplit((clientX - rect.left) / rect.width);
    localStorage.setItem('dbv-md-editor-split', String(fraction));
  });

  // Ancho de la TOC en px absolutos (no fracción — es una barra lateral de
  // texto corto, tiene más sentido pensarla en caracteres que en proporción).
  // Devuelve el valor ya recortado, mismo motivo que applyEditorSplit().
  function applyTocWidth(px) {
    px = Math.min(480, Math.max(180, px));
    tocSidebar.style.width = px + 'px';
    tocSidebar.style.minWidth = px + 'px';
    return px;
  }

  startHorizontalDrag(tocResizer, function () { return tocSidebar.getBoundingClientRect(); }, function (clientX, rect) {
    var px = applyTocWidth(rect.right - clientX);
    localStorage.setItem('dbv-md-toc-width', String(px));
  });

  (function restoreTocWidth() {
    var saved = parseFloat(localStorage.getItem('dbv-md-toc-width'));
    if (isFinite(saved)) applyTocWidth(saved);
  })();

  // ─── Sincronización de scroll editor↔preview por línea de origen ──────────
  // Cada encabezado h1/h2/h3 tiene una línea de origen conocida (markdown-it
  // expone el rango de líneas de cada token vía .map) y una posición vertical
  // ya renderizada en la preview (tocHeaders[i].offsetTop) — con esos puntos
  // de referencia se interpola linealmente entre encabezados en vez de un
  // simple porcentaje de scroll global, que se desalinearía en cualquier
  // documento con secciones de longitud desigual (imágenes grandes, tablas...).
  var editHeadingAnchors = [];
  var syncingScroll = false;
  // Evitan recalcular en cada evento de scroll (alta frecuencia con rueda/
  // trackpad) lo que solo cambia cuando el documento se re-renderiza o se
  // teclea — se refrescan en updateEditorLineNumbers()/updateHeadingAnchors(),
  // no en fullScrollAnchors() ni en los listeners de scroll.
  var cachedTotalLines = 1;
  var cachedMaxScroll = 0;

  // tokens: opcional — si `renderMarkdown()` ya parseó este mismo texto en la
  // misma pasada (caso normal: debounce de escritura, modo espejo), se
  // reutilizan sus tokens en vez de volver a parsear el documento entero.
  // Solo se parsea aquí cuando no hay render de por medio (p. ej. al entrar
  // en Modo Edición sobre contenido ya renderizado antes).
  function updateHeadingAnchors(tokens) {
    editHeadingAnchors = [];
    if (!tokens) {
      try { tokens = md.parse(editorTextarea.value, {}); } catch (e) { return; }
    }
    // offsetTop no sirve aquí: depende de la cadena de offsetParent, que en este
    // layout no es #content (ningún ancestro entre el encabezado y #content
    // tiene position != static) — mide contra <body>, no contra el scroll
    // interno de #content. getBoundingClientRect() da el valor real, sea cual
    // sea la cadena de posicionamiento.
    var contentOrigin = contentEl.getBoundingClientRect().top - contentEl.scrollTop;
    var idx = 0;
    for (var i = 0; i < tokens.length && idx < tocHeaders.length; i++) {
      var tok = tokens[i];
      if (tok.type === 'heading_open' && tok.map && /^h[123]$/.test(tok.tag)) {
        var top = tocHeaders[idx].getBoundingClientRect().top - contentOrigin;
        editHeadingAnchors.push({ line: tok.map[0], top: top });
        idx++;
      }
    }
    // Se refresca aquí, no en cada evento de scroll — este es el único punto
    // donde la altura de la preview puede haber cambiado de verdad.
    cachedMaxScroll = Math.max(0, contentEl.scrollHeight - contentEl.clientHeight);
  }

  function editorLineHeightPx() {
    var lh = parseFloat(getComputedStyle(editorTextarea).lineHeight);
    return (isFinite(lh) && lh > 0) ? lh : 20.8;
  }

  // Añade el principio y el final del documento como anclas implícitas, así
  // la interpolación cubre todo el rango sin casos especiales para "antes del
  // primer encabezado" / "después del último" (o sin encabezados en absoluto).
  function fullScrollAnchors() {
    return [{ line: 0, top: 0 }].concat(editHeadingAnchors).concat([{ line: cachedTotalLines, top: cachedMaxScroll }]);
  }

  function interpolateScroll(anchors, fromKey, value, toKey) {
    for (var i = 0; i < anchors.length - 1; i++) {
      var a = anchors[i], b = anchors[i + 1];
      if (value >= a[fromKey] && value <= b[fromKey]) {
        var span = b[fromKey] - a[fromKey];
        var f = span > 0 ? (value - a[fromKey]) / span : 0;
        return a[toKey] + f * (b[toKey] - a[toKey]);
      }
    }
    return anchors[anchors.length - 1][toKey];
  }

  // Evita el bucle de retroalimentación: al fijar el scroll del otro panel a
  // mano, ese propio cambio dispara su listener de scroll — se ignora hasta
  // que llega ese eco. WebKit despacha el evento 'scroll' de forma asíncrona
  // y sin orden garantizado respecto a requestAnimationFrame, así que limpiar
  // el flag en un solo rAF es una carrera: si el eco llega después, el
  // listener lo trata como scroll real del usuario y sincroniza el otro
  // panel otra vez, y como interpolateScroll() no es exactamente su propia
  // inversa cada ida y vuelta arrastra unos píxeles de más, formando un
  // bucle que ya no para solo. En vez de adivinar el timing, se limpia el
  // flag cuando el propio elemento modificado dispara su eco (listener
  // 'once'), con un rAF doble como red de seguridad por si el navegador
  // coalesce el evento y no llega a dispararse.
  function withScrollLock(el, fn) {
    syncingScroll = true;
    var cleared = false;
    function clear() {
      if (cleared) return;
      cleared = true;
      el.removeEventListener('scroll', clear);
      syncingScroll = false;
    }
    el.addEventListener('scroll', clear, { once: true });
    fn();
    requestAnimationFrame(function () { requestAnimationFrame(clear); });
  }

  function setEditMode(on) {
    if (isAndroid && on) return;
    editMode = on;
    readerContainer.classList.toggle('edit-mode', on);
    editorPane.classList.toggle('hidden', !on);
    editorResizer.classList.toggle('hidden', !on);
    btnSave.classList.toggle('hidden', !on || isAndroid);
    btnEditToggle.classList.toggle('active', on);
    if (isAndroid) btnEditToggle.classList.add('hidden');
    var key = on ? 'toolbar.editModeActive' : 'toolbar.editMode';
    btnEditToggle.setAttribute('data-i18n-title', key);
    btnEditToggle.title = t(key);
    if (on) {
      editorTextarea.value = currentDoc.content;
      setDirty(false);
      conflictPending = false;
      conflictBanner.classList.add('hidden');
      updateEditorLineNumbers();
      restoreEditorSplit();
      updateHeadingAnchors();
    }
    // No solo por si setDirty(false) no bastó: la rama `!on` no toca isDirty
    // en absoluto, así que el badge necesita este empujón propio para
    // ocultarse al salir de Modo Edición (depende de `editMode`, no solo de `isDirty`).
    updateModifiedBadge();
  }

  function toggleEditMode() {
    if (isAndroid || !currentDoc || isRemoteDoc(currentDoc)) return;
    confirmDiscardUnsavedChanges().then(function (proceed) {
      if (proceed) setEditMode(!editMode);
    });
  }

  editorTextarea.addEventListener('input', function () {
    setDirty(editorTextarea.value !== currentDoc.content);
    updateEditorLineNumbers();
    clearTimeout(editDebounceTimer);
    editDebounceTimer = setTimeout(function () {
      updateHeadingAnchors(renderMarkdown(editorTextarea.value));
    }, 400);
  });

  // ─── Sincronización de scroll editor↔preview (línea real vía anclas de
  // encabezado, ver "Sincronización de scroll" más abajo) ───────────────────
  editorTextarea.addEventListener('scroll', function () {
    editorLineNumbers.scrollTop = editorTextarea.scrollTop;
    if (syncingScroll || !editMode) return;
    var line = editorTextarea.scrollTop / editorLineHeightPx();
    var top = interpolateScroll(fullScrollAnchors(), 'line', line, 'top');
    withScrollLock(contentEl, function () { contentEl.scrollTop = top; });
  });
  contentEl.addEventListener('scroll', function () {
    if (syncingScroll || !editMode) return;
    var line = interpolateScroll(fullScrollAnchors(), 'top', contentEl.scrollTop, 'line');
    withScrollLock(editorTextarea, function () { editorTextarea.scrollTop = line * editorLineHeightPx(); });
  });

  // =========================================================================
  // Barra de formato Markdown (RF-23) + indentación con Tab (RF-24)
  // =========================================================================

  // Aplica mapFn a cada línea completa que toca la selección [start, end) y
  // devuelve el texto reconstruido + el rango que cubre el bloque transformado
  // — único punto que comparten la barra de formato y la indentación con Tab.
  // firstLineDelta (cuánto creció/encogió solo la línea de `start`, que puede
  // diferir del delta agregado del bloque) se calcula aquí de paso, durante el
  // mismo recorrido de líneas — evita que cada llamante repita el escaneo de
  // límites de línea sólo para obtenerlo.
  function forEachSelectedLine(value, start, end, mapFn) {
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var lineEndIdx = value.indexOf('\n', end);
    var lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    var firstLineDelta = 0;
    var newLines = value.slice(lineStart, lineEnd).split('\n').map(function (line, i) {
      var mapped = mapFn(line);
      if (i === 0) firstLineDelta = mapped.length - line.length;
      return mapped;
    });
    var newBlock = newLines.join('\n');
    return {
      text: value.slice(0, lineStart) + newBlock + value.slice(lineEnd),
      lineStart: lineStart,
      oldBlockLen: lineEnd - lineStart,
      newBlockLen: newBlock.length,
      firstLineDelta: firstLineDelta
    };
  }

  // El doble clic en el <textarea> selecciona la palabra Y el espacio
  // siguiente — se recorta antes de envolver/enlazar, para los formatos que
  // pegan marcadores directamente al texto (CommonMark no reconoce
  // "**palabra **" como énfasis, ni tiene sentido "[palabra ](url)").
  function trimSelectionEdges(value, start, end) {
    if (start === end) return { start: start, end: end };
    var raw = value.slice(start, end);
    var leading = raw.match(/^\s*/)[0];
    var trailing = raw.length > leading.length ? raw.match(/\s*$/)[0] : '';
    if (raw.length - leading.length - trailing.length > 0) {
      return { start: start + leading.length, end: end - trailing.length };
    }
    return { start: start, end: end };
  }

  // Envuelve la selección con prefix/suffix; sin selección, inserta un
  // placeholder ya seleccionado. Si la selección ya está envuelta (con o sin
  // los marcadores incluidos en ella), desenvuelve — toggle al pulsar dos veces.
  function applyInlineWrap(value, start, end, prefix, suffix, placeholder) {
    var trimmed = trimSelectionEdges(value, start, end);
    start = trimmed.start; end = trimmed.end;
    var before = value.slice(0, start), selected = value.slice(start, end), after = value.slice(end);
    if (start === end) {
      return {
        text: before + prefix + placeholder + suffix + after,
        selStart: start + prefix.length,
        selEnd: start + prefix.length + placeholder.length
      };
    }
    if (selected.slice(0, prefix.length) === prefix && selected.slice(selected.length - suffix.length) === suffix &&
        selected.length >= prefix.length + suffix.length) {
      var unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
      return { text: before + unwrapped + after, selStart: start, selEnd: start + unwrapped.length };
    }
    if (before.slice(before.length - prefix.length) === prefix && after.slice(0, suffix.length) === suffix) {
      var nb = before.slice(0, before.length - prefix.length), na = after.slice(suffix.length);
      return { text: nb + selected + na, selStart: start - prefix.length, selEnd: start - prefix.length + selected.length };
    }
    return {
      text: before + prefix + selected + suffix + after,
      selStart: start + prefix.length,
      selEnd: start + prefix.length + selected.length
    };
  }

  // Los encabezados son de una sola línea: actúa sobre la que contiene selectionStart.
  // Toggle: si ya tenía el nivel pedido, lo quita en vez de duplicarlo.
  function applyHeading(value, start, end, level) {
    var marker = '#'.repeat(level) + ' ';
    var result = forEachSelectedLine(value, start, start, function (line) {
      var stripped = line.replace(/^#{1,6}\s*/, '');
      var hadSameLevel = new RegExp('^#{' + level + '}(?!#)\\s*').test(line);
      return hadSameLevel ? stripped : marker + stripped;
    });
    var lineLenDelta = result.newBlockLen - result.oldBlockLen;
    return { text: result.text, selStart: start + lineLenDelta, selEnd: end + lineLenDelta };
  }

  // Cita/lista/tarea: añade marker a cada línea seleccionada que no lo tenga ya;
  // si todas ya lo tienen, lo quita (toggle).
  function applyLinePrefix(value, start, end, marker) {
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var lineEndIdx = value.indexOf('\n', end);
    var lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    var raw = value.slice(lineStart, lineEnd).split('\n');
    var allPrefixed = raw.every(function (l) { return l.slice(0, marker.length) === marker; });
    var mapFn = function (line) {
      if (allPrefixed) return line.slice(marker.length);
      return line.slice(0, marker.length) === marker ? line : marker + line;
    };
    var result = forEachSelectedLine(value, start, end, mapFn);
    return {
      text: result.text,
      selStart: Math.max(result.lineStart, start + result.firstLineDelta),
      selEnd: end + (result.newBlockLen - result.oldBlockLen)
    };
  }

  function applyOrderedList(value, start, end) {
    var n = 0;
    var result = forEachSelectedLine(value, start, end, function (line) {
      n += 1;
      return n + '. ' + line.replace(/^\d+\.\s*/, '');
    });
    return {
      text: result.text,
      selStart: result.lineStart,
      selEnd: result.lineStart + result.newBlockLen
    };
  }

  function applyLinkWrap(value, start, end, isImage) {
    var prefix = isImage ? '![' : '[';
    var trimmed = trimSelectionEdges(value, start, end);
    start = trimmed.start; end = trimmed.end;
    if (start !== end) {
      var selected = value.slice(start, end);
      var inserted = prefix + selected + '](url)';
      var urlOffset = inserted.indexOf('(url)') + 1;
      return {
        text: value.slice(0, start) + inserted + value.slice(end),
        selStart: start + urlOffset,
        selEnd: start + urlOffset + 3
      };
    }
    var label = t(isImage ? 'editor.format.imageAltSkeleton' : 'editor.format.linkTextSkeleton');
    var skeleton = prefix + label + '](url)';
    return {
      text: value.slice(0, start) + skeleton + value.slice(end),
      selStart: start + prefix.length,
      selEnd: start + prefix.length + label.length
    };
  }

  // Tabla/HR: colapsa la selección y garantiza línea en blanco antes y después
  // del bloque insertado (obligatorio para que el GFM de tabla/HR renderice bien).
  function applyBlockInsert(value, start, end, skeleton) {
    var before = value.slice(0, start), after = value.slice(end);
    var lead = before.length === 0 || before.slice(-2) === '\n\n' ? '' : (before.slice(-1) === '\n' ? '\n' : '\n\n');
    var trail = after.length === 0 || after.slice(0, 2) === '\n\n' ? '' : (after.slice(0, 1) === '\n' ? '\n' : '\n\n');
    var insertStart = before.length + lead.length;
    return {
      text: before + lead + skeleton + trail + after,
      selStart: insertStart,
      selEnd: insertStart + skeleton.length
    };
  }

  function applyFenceWrap(value, start, end) {
    if (start !== end) {
      var selected = value.slice(start, end);
      var wrapped = '```\n' + selected + '\n```';
      return {
        text: value.slice(0, start) + wrapped + value.slice(end),
        selStart: start + 4,
        selEnd: start + 4 + selected.length
      };
    }
    var lang = t('editor.format.codeLangSkeleton');
    var body = t('editor.format.codeBlockSkeleton');
    var skeleton = '```' + lang + '\n' + body + '\n```';
    return {
      text: value.slice(0, start) + skeleton + value.slice(end),
      selStart: start + 3,
      selEnd: start + 3 + lang.length
    };
  }

  var MD_FORMATS = {
    bold:      { kind: 'wrap', prefix: '**', suffix: '**', ph: 'editor.format.boldSkeleton' },
    italic:    { kind: 'wrap', prefix: '*',  suffix: '*',  ph: 'editor.format.italicSkeleton' },
    strike:    { kind: 'wrap', prefix: '~~', suffix: '~~', ph: 'editor.format.strikeSkeleton' },
    code:      { kind: 'wrap', prefix: '`',  suffix: '`',  ph: 'editor.format.codeSkeleton' },
    h1:        { kind: 'heading', level: 1 },
    h2:        { kind: 'heading', level: 2 },
    h3:        { kind: 'heading', level: 3 },
    quote:     { kind: 'line-prefix', marker: '> ' },
    ul:        { kind: 'line-prefix', marker: '- ' },
    task:      { kind: 'line-prefix', marker: '- [ ] ' },
    ol:        { kind: 'ordered' },
    link:      { kind: 'link-wrap', isImage: false },
    image:     { kind: 'link-wrap', isImage: true },
    table:     { kind: 'block-insert', ph: 'editor.format.tableSkeleton' },
    hr:        { kind: 'block-insert', ph: 'editor.format.hrSkeleton' },
    codeblock: { kind: 'fence-wrap' }
  };

  function applyMarkdownFormat(spec) {
    var value = editorTextarea.value, start = editorTextarea.selectionStart, end = editorTextarea.selectionEnd, result;
    switch (spec.kind) {
      case 'wrap':         result = applyInlineWrap(value, start, end, spec.prefix, spec.suffix, t(spec.ph)); break;
      case 'heading':      result = applyHeading(value, start, end, spec.level); break;
      case 'line-prefix':  result = applyLinePrefix(value, start, end, spec.marker); break;
      case 'ordered':      result = applyOrderedList(value, start, end); break;
      case 'link-wrap':    result = applyLinkWrap(value, start, end, spec.isImage); break;
      case 'block-insert':  result = applyBlockInsert(value, start, end, t(spec.ph)); break;
      case 'fence-wrap':   result = applyFenceWrap(value, start, end); break;
    }
    editorTextarea.value = result.text;
    editorTextarea.setSelectionRange(result.selStart, result.selEnd);
    editorTextarea.focus();
    // Dispara el mismo evento 'input' que una edición tecleada: reutiliza isDirty,
    // updateEditorLineNumbers y el debounce de render sin caminos divergentes (RF-21).
    editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  editorToolbar.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-format]');
    if (btn) applyMarkdownFormat(MD_FORMATS[btn.dataset.format]);
  });

  // ─── Tab / Shift+Tab: indentar/desindentar en vez de mover el foco (RF-24) ──
  // Listener en editorTextarea, no en window, para no interferir con la
  // navegación por Tab del resto de la app (buscador, panel de URL, modales).
  var EDITOR_INDENT = '  '; // 2 espacios, mismo criterio que las listas anidadas del cheatsheet

  function indentLine(line) { return EDITOR_INDENT + line; }
  function outdentLine(line) {
    if (line.slice(0, EDITOR_INDENT.length) === EDITOR_INDENT) return line.slice(EDITOR_INDENT.length);
    if (line.charAt(0) === '\t') return line.slice(1);
    var m = line.match(/^ +/);
    return m ? line.slice(m[0].length) : line;
  }

  editorTextarea.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    var value = editorTextarea.value;
    var start = editorTextarea.selectionStart, end = editorTextarea.selectionEnd;
    var mapFn = e.shiftKey ? outdentLine : indentLine;
    var block = forEachSelectedLine(value, start, end, mapFn);
    editorTextarea.value = block.text;
    var totalDelta = block.newBlockLen - block.oldBlockLen;
    editorTextarea.setSelectionRange(Math.max(block.lineStart, start + block.firstLineDelta), end + totalDelta);
    editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  });

  function saveCurrentDocument() {
    if (isAndroid || !currentDoc || !editMode || isRemoteDoc(currentDoc)) return;
    var path = currentDoc.path;
    var content = editorTextarea.value;
    clearTimeout(editDebounceTimer);
    // La preview debe reflejar exactamente lo que se guarda — y como esto
    // cancela el debounce pendiente, también hay que refrescar las anclas de
    // scroll aquí (si no, quedarían desactualizadas hasta el siguiente input).
    updateHeadingAnchors(renderMarkdown(content));
    // Ventana de supresión (RF-21) fijada ANTES de invocar, no en el .then(): el
    // watcher de disco (RF-06) es un camino async independiente del propio invoke
    // y puede detectar la escritura y emitir file-changed antes de que vuelva esta
    // respuesta — confirmado en verificación real de esta fase (el modal de
    // conflicto saltaba contra el propio guardado). Todo el estado que evita el
    // eco debe quedar listo antes de pedir la escritura, no después de confirmarla.
    suppressSelfWriteUntil = Date.now() + 800;
    setDirty(false);
    conflictPending = false;
    conflictBanner.classList.add('hidden');
    invoke('write_file', { path: path, content: content })
      .then(function () {
        currentDoc.content = content;
      })
      .catch(function (err) {
        showError('[write_file] ' + err);
        alert(t('errors.saveFailed', { error: err }));
        // El guardado no llegó a ocurrir: revertir el estado optimista — sigue
        // habiendo cambios sin guardar y no hay ninguna escritura real que suprimir.
        setDirty(editorTextarea.value !== currentDoc.content);
        suppressSelfWriteUntil = 0;
      });
  }

  btnEditToggle.addEventListener('click', toggleEditMode);
  btnSave.addEventListener('click', saveCurrentDocument);

  // Modal de conflicto: onClose es el único sitio que decide mostrar la franja
  // persistente, así que tanto "Conservar mis cambios" como cerrar con Escape
  // convergen en el mismo resultado (nunca se pierde en silencio que hay un
  // conflicto pendiente).
  var conflictModalCtrl = registerPanel(document.getElementById('conflict-modal'), {
    onClose: function () { if (conflictPending) conflictBanner.classList.remove('hidden'); }
  });

  // Resuelve el conflicto a favor del disco — usado tanto por el botón del
  // modal como por el de la franja persistente, mismos 3 pasos en los dos.
  function resolveConflictByReload() {
    conflictPending = false; // antes de close()/ocultar, para que onClose no reabra la franja
    conflictModalCtrl.close();
    conflictBanner.classList.add('hidden');
    reloadCurrentDocument();
  }

  document.getElementById('conflict-keep').addEventListener('click', function () {
    conflictModalCtrl.close();
  });
  document.getElementById('conflict-reload').addEventListener('click', resolveConflictByReload);
  document.getElementById('banner-reload').addEventListener('click', resolveConflictByReload);

  // Modal de confirmación al descartar cambios sin guardar (ver
  // confirmDiscardUnsavedChanges): cerrar con Escape cuenta como cancelar,
  // igual que el modal de conflicto.
  var discardModalCtrl = registerPanel(document.getElementById('discard-modal'), {
    onClose: function () { resolvePendingDiscard(false); }
  });
  document.getElementById('discard-cancel').addEventListener('click', function () {
    resolvePendingDiscard(false);
    discardModalCtrl.close();
  });
  document.getElementById('discard-confirm').addEventListener('click', function () {
    resolvePendingDiscard(true);
    discardModalCtrl.close();
  });

  // =========================================================================
  // Atajos de teclado
  // =========================================================================

  window.addEventListener('keydown', function (e) {
    // Ctrl en Windows/Linux, Cmd en macOS: mismos atajos en las tres plataformas.
    var mod = e.ctrlKey || e.metaKey;
    if      (mod && e.key === 'f') { e.preventDefault(); searchPanel.open(); }
    else if (mod && e.key === 'o') { e.preventDefault(); openFileDialog(); }
    else if (mod && e.key === 'p') { e.preventDefault(); window.print(); }
    else if (mod && e.key === 'e') { e.preventDefault(); toggleEditMode(); }
    else if (mod && e.key === 's') { e.preventDefault(); saveCurrentDocument(); }
    else if (mod && e.key === 'k') { e.preventDefault(); if (window.DBVFileTree) window.DBVFileTree.toggleQuickOpen(); }
    else if (mod && e.key === 'b' && editMode && document.activeElement === editorTextarea) { e.preventDefault(); applyMarkdownFormat(MD_FORMATS.bold); }
    else if (mod && e.key === 'i' && editMode && document.activeElement === editorTextarea) { e.preventDefault(); applyMarkdownFormat(MD_FORMATS.italic); }
    else if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
    else if (mod && e.key === '-') { e.preventDefault(); zoomOut(); }
    else if (mod && e.key === '0') { e.preventDefault(); zoomReset(); }
    else if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); if (histIdx > 0) btnBack.click(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); if (histIdx < history.length - 1) btnForward.click(); }
    else if (e.key === 'Escape') { closeAllPanels(); }
  });

  // =========================================================================
  // Inicialización
  // =========================================================================

  function init() {
    setLang(window.DBV_I18N.getLang());

    var theme = localStorage.getItem('dbv-md-theme') || 'dark';
    setTheme(theme);

    // Restaurar zoom guardado
    var savedZoom = parseInt(localStorage.getItem('dbv-md-zoom') || '100', 10);
    if (savedZoom !== 100) applyZoom(savedZoom, { silent: true });

    // RF-14: una ventana abierta por el callback de instancia única (src-tauri/src/lib.rs,
    // open_document_window) trae su ruta inicial inyectada aquí en vez de en el argv del
    // proceso — get_cli_argument() siempre devolvería la del arranque original.
    if (window.__DBV_INITIAL_PATH__) {
      loadDocument(window.__DBV_INITIAL_PATH__, { isPrimaryOpen: true });
    } else {
      invoke('get_cli_argument')
        .then(function (cliPath) {
          if (cliPath) {
            loadDocument(cliPath, { isPrimaryOpen: true });
          } else if (isAndroid) {
            try {
              var savedDoc = localStorage.getItem('dbv-md-last-doc');
              if (savedDoc) {
                var parsed = JSON.parse(savedDoc);
                if (parsed && parsed.path && parsed.content) {
                  loadDocument(parsed.path, { isPrimaryOpen: false, isAutoRestore: true, initialPayload: parsed });
                }
              }
            } catch (_) {}
          }
        })
        .catch(function (err) {
          console.log('[init] no CLI arg:', err);
          if (isAndroid) {
            try {
              var savedDoc = localStorage.getItem('dbv-md-last-doc');
              if (savedDoc) {
                var parsed = JSON.parse(savedDoc);
                if (parsed && parsed.path && parsed.content) {
                  loadDocument(parsed.path, { isPrimaryOpen: false, isAutoRestore: true, initialPayload: parsed });
                }
              }
            } catch (_) {}
          }
        });
    }

    loadRecentFiles();
  }

  // Esperar a DOMContentLoaded por si el script se carga antes
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
