// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Explorador de árbol de directorios (RF-25) + Quick Open (RF-26). Módulo propio
// (mismo patrón IIFE sin bundler que i18n.js/app.js — ADR-006) para no seguir
// haciendo crecer app.js. Cargado DESPUÉS de app.js en index.html (necesita
// `window.DBVApp` ya disponible de forma síncrona para registrar su panel
// flotante — ver más abajo). Se comunica con app.js mediante `window.DBVApp`
// (openDocument/isRemoteUrl/setTocVisible/registerPanel) y un puñado de
// funciones que app.js llama tras cargar un documento o los Archivos Recientes —
// ver `onDocumentLoaded`/`onRecentFilesLoaded` en `window.DBVFileTree` más abajo.
// =============================================================================
(function () {
  'use strict';

  if (!window.__TAURI__ || !window.__TAURI__.core || !window.__TAURI__.core.invoke) return;

  var invoke = window.__TAURI__.core.invoke;
  var t = window.DBV_I18N.t;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var tabIndexBtn  = document.getElementById('tab-index');
  var tabFilesBtn  = document.getElementById('tab-files');
  var tocPanelEl   = document.getElementById('toc-panel');
  var filesPanelEl = document.getElementById('files-panel');
  var fileTreeEl   = document.getElementById('file-tree');
  var filterInput  = document.getElementById('file-tree-filter');

  var quickOpenModal   = document.getElementById('quick-open-modal');
  var quickOpenBackdrop = document.getElementById('quick-open-backdrop');
  var quickOpenInput   = document.getElementById('quick-open-input');
  var quickOpenResultsEl = document.getElementById('quick-open-results');

  var treeContextMenu    = document.getElementById('tree-context-menu');
  var treeRevealBtn      = document.getElementById('tree-reveal');
  var treeOpenNewWinBtn  = document.getElementById('tree-open-new-window');

  // ─── Utilidades de ruta (JS puro, sin acceso a disco) ─────────────────────
  // Mismo criterio ya usado en la etiqueta de atajos de esta app (Ctrl en
  // Windows/Linux, Cmd en macOS) — solo para el texto del menú contextual, la
  // detección real de "¿es el modificador?" sigue siendo `e.ctrlKey || e.metaKey`.
  var MOD_KEY_LABEL = /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';

  // Funciona con separadores '/' y '\' a la vez — los documentos de esta app
  // pueden venir de cualquiera de las 3 plataformas soportadas (RNF-01).
  function dirnameOf(p) {
    var idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return idx >= 0 ? p.slice(0, idx) : p;
  }

  // ─── Pestañas "Índice" / "Archivos" ────────────────────────────────────────
  function setActiveTab(tab) {
    var filesActive = tab === 'files';
    tabIndexBtn.classList.toggle('active', !filesActive);
    tabFilesBtn.classList.toggle('active', filesActive);
    tocPanelEl.classList.toggle('hidden', filesActive);
    filesPanelEl.classList.toggle('hidden', !filesActive);
  }
  tabIndexBtn.addEventListener('click', function () { setActiveTab('index'); });
  tabFilesBtn.addEventListener('click', function () { setActiveTab('files'); });

  // ─── Árbol de directorios (RF-25) ──────────────────────────────────────────
  var currentRoot = null;
  // Lista de {name, path}, solo archivos `.md`/`.markdown`/`.txt` — fuente de
  // datos de Quick Open (RF-26), acotada a lo que el árbol ya ha cargado
  // (carpetas expandidas), nunca un recorrido recursivo completo del disco
  // (ver ADR-029/Adversarial Review en memory.md — trade-off consciente). Un
  // array simple basta: nunca se busca/borra por clave, solo se recorre entero.
  var knownFiles = [];

  // Se incrementa en cada resetTree() (nuevo documento/raíz). renderLevel()
  // captura su valor al arrancar la petición y lo revalida al resolver —
  // dos setRoot() consecutivos (p. ej. onRecentFilesLoaded corriendo antes
  // que onDocumentLoaded al arrancar) pueden dejar dos invoke('list_directory')
  // en vuelo a la vez; sin esta comprobación, la respuesta más lenta llega
  // después y añade sus filas encima de las ya correctas en vez de descartarse.
  var treeGeneration = 0;

  function resetTree() {
    treeGeneration++;
    fileTreeEl.innerHTML = '';
    knownFiles.length = 0;
  }

  function showTreeEmptyState() {
    fileTreeEl.innerHTML = '<p class="text-xs text-muted">' + t('fileTree.empty') + '</p>';
  }

  function registerKnownFiles(entries) {
    entries.forEach(function (entry) {
      if (entry.is_markdown) knownFiles.push({ name: entry.name, path: entry.path });
    });
  }

  function openFromTree(path, e) {
    var openInNewWindow = !!(e && (e.ctrlKey || e.metaKey));
    if (openInNewWindow) {
      invoke('open_in_new_window', { path: path }).catch(function (err) {
        console.warn('[open_in_new_window]', err);
      });
    } else if (window.DBVApp) {
      window.DBVApp.openDocument(path);
    }
  }

  // "Abrir en ventana nueva" solo tiene sentido sobre un archivo `.md` abrible
  // (no sobre una carpeta ni sobre un archivo no-`.md`, ver RF-25) — se oculta
  // en esos dos casos en vez de mostrarse deshabilitado.
  function showTreeContextMenu(x, y, path, isMarkdown) {
    treeContextMenu.dataset.path = path;
    treeOpenNewWinBtn.textContent = t('fileTree.openNewWindow', { mod: MOD_KEY_LABEL });
    treeOpenNewWinBtn.classList.toggle('hidden', !isMarkdown);
    treeContextMenu.style.left = x + 'px';
    treeContextMenu.style.top = y + 'px';
    treeContextMenu.classList.remove('hidden');
  }
  function hideTreeContextMenu() {
    treeContextMenu.classList.add('hidden');
    delete treeContextMenu.dataset.path;
  }
  document.addEventListener('click', hideTreeContextMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTreeContextMenu(); });
  treeRevealBtn.addEventListener('click', function () {
    var path = treeContextMenu.dataset.path;
    if (path) {
      invoke('reveal_in_file_manager', { path: path }).catch(function (err) {
        console.warn('[reveal_in_file_manager]', err);
      });
    }
    hideTreeContextMenu();
  });
  treeOpenNewWinBtn.addEventListener('click', function () {
    var path = treeContextMenu.dataset.path;
    if (path) {
      invoke('open_in_new_window', { path: path }).catch(function (err) {
        console.warn('[open_in_new_window]', err);
      });
    }
    hideTreeContextMenu();
  });

  // Una fila por entrada (carpeta o archivo) + su propio contenedor de hijos
  // (carpetas), leído bajo demanda la primera vez que se expande — nunca
  // recursivo de golpe (RF-25).
  function buildTreeRow(entry, depth) {
    var wrap = document.createElement('div');
    wrap.className = 'tree-item';

    var row = document.createElement('div');
    row.className = 'tree-row ' + (entry.is_dir ? 'is-dir' : entry.is_markdown ? 'is-file' : 'is-dimmed');
    row.style.paddingLeft = (8 + depth * 16) + 'px';
    row.dataset.name = entry.name;

    var toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    if (entry.is_dir) toggle.textContent = '▸';
    row.appendChild(toggle);

    var name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = entry.name;
    row.appendChild(name);

    wrap.appendChild(row);

    if (entry.is_dir) {
      var children = document.createElement('div');
      children.className = 'tree-children hidden';
      wrap.appendChild(children);

      var expanded = false;
      row.addEventListener('click', function () {
        expanded = !expanded;
        toggle.classList.toggle('expanded', expanded);
        children.classList.toggle('hidden', !expanded);
        if (expanded && !children.dataset.loaded) {
          children.dataset.loaded = '1';
          renderLevel(children, entry.path, depth + 1);
        }
      });
    } else if (entry.is_markdown) {
      row.addEventListener('click', function (e) { openFromTree(entry.path, e); });
    }

    row.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      showTreeContextMenu(e.clientX, e.clientY, entry.path, entry.is_markdown);
    });

    return wrap;
  }

  // depth 0 = raíz del árbol (#file-tree); depth > 0 = hijos de una carpeta
  // expandida. Devuelve una promesa que resuelve a true/false (¿había algo
  // que listar?), usada por setRoot()/tryUseAsRoot() para saber si el drop de
  // una carpeta (RF-25) fue válido.
  function renderLevel(containerEl, dirPath, depth) {
    var gen = treeGeneration;
    // window.DBVApp.listDirectory despacha a `list_directory` (escritorio) o al
    // plugin `saf` (Android, `content://`) según el esquema de dirPath — ver
    // isSafUri()/listDirectoryAny() en app.js (Slice 2 de la versión Android).
    return window.DBVApp.listDirectory(dirPath)
      .then(function (entries) {
        if (gen !== treeGeneration) return false; // superada por un setRoot() más reciente
        registerKnownFiles(entries);
        entries.forEach(function (entry) { containerEl.appendChild(buildTreeRow(entry, depth)); });
        if (depth === 0 && !entries.length) showTreeEmptyState();
        return true;
      })
      .catch(function (err) {
        if (gen !== treeGeneration) return false;
        if (depth === 0) showTreeEmptyState();
        console.warn('[list_directory]', dirPath, err);
        return false;
      });
  }

  // Reconstruye el árbol con `dirPath` como nueva raíz. No-op si ya es la raíz
  // actual (evita parpadeo al recargar el mismo documento). Un `dirPath` que
  // no resuelva a una carpeta real (documento remoto, RF-08A) simplemente cae
  // al estado vacío — sin necesidad de detectar "es remoto" aquí.
  function setRoot(dirPath) {
    if (!dirPath || dirPath === currentRoot) return Promise.resolve(!!dirPath);
    currentRoot = dirPath;
    resetTree();
    return renderLevel(fileTreeEl, dirPath, 0);
  }

  // ─── Filtro de texto sobre los nodos ya cargados ───────────────────────────
  filterInput.addEventListener('input', function (e) {
    var q = e.target.value.trim().toLowerCase();
    fileTreeEl.querySelectorAll('.tree-row').forEach(function (row) {
      var match = !q || row.dataset.name.toLowerCase().indexOf(q) !== -1;
      row.classList.toggle('tree-row-hidden', !match);
    });
  });

  // ─── Quick Open (RF-26, Ctrl/Cmd+K) ────────────────────────────────────────
  var quickOpenMatches = [];
  var quickOpenActiveIndex = -1;

  function renderQuickOpenList() {
    quickOpenResultsEl.innerHTML = '';
    if (!quickOpenMatches.length) {
      quickOpenResultsEl.innerHTML = '<p class="text-xs text-muted">' + t('quickOpen.empty') + '</p>';
      return;
    }
    quickOpenMatches.forEach(function (file, i) {
      var item = document.createElement('div');
      item.className = 'quick-open-item' + (i === quickOpenActiveIndex ? ' active' : '');
      var nameEl = document.createElement('span');
      nameEl.className = 'quick-open-item-name';
      nameEl.textContent = file.name;
      var pathEl = document.createElement('span');
      pathEl.className = 'quick-open-item-path';
      pathEl.textContent = file.path;
      item.appendChild(nameEl);
      item.appendChild(pathEl);
      item.addEventListener('click', function (e) { activateQuickOpenMatch(file.path, e); });
      quickOpenResultsEl.appendChild(item);
    });
  }

  function renderQuickOpenResults(query) {
    var q = query.trim().toLowerCase();
    quickOpenMatches = !q ? knownFiles.slice() : knownFiles.filter(function (f) { return f.name.toLowerCase().indexOf(q) !== -1; });
    quickOpenActiveIndex = quickOpenMatches.length ? 0 : -1;
    renderQuickOpenList();
  }

  function activateQuickOpenMatch(path, e) {
    openFromTree(path, e);
    quickOpenPanel.close();
  }

  // Mismo mecanismo de panel flotante que el resto de la app (búsqueda,
  // Recientes, "Abrir desde URL"...) — hereda gratis el cierre con Escape
  // (registrado en `panelClosers`, drenado por `closeAllPanels()` en app.js)
  // en vez de duplicar un listener de teclado propio.
  var quickOpenPanel = window.DBVApp.registerPanel(quickOpenModal, {
    onOpen: function () {
      quickOpenInput.value = '';
      quickOpenInput.focus();
      renderQuickOpenResults('');
    }
  });
  function toggleQuickOpen() {
    if (quickOpenModal.classList.contains('hidden')) quickOpenPanel.open(); else quickOpenPanel.close();
  }

  quickOpenBackdrop.addEventListener('click', quickOpenPanel.close);
  quickOpenInput.addEventListener('input', function (e) { renderQuickOpenResults(e.target.value); });
  quickOpenInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (quickOpenActiveIndex < quickOpenMatches.length - 1) { quickOpenActiveIndex++; renderQuickOpenList(); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (quickOpenActiveIndex > 0) { quickOpenActiveIndex--; renderQuickOpenList(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var match = quickOpenMatches[quickOpenActiveIndex];
      if (match) activateQuickOpenMatch(match.path, e);
    }
  });

  // ─── Refresco de textos dinámicos al cambiar de idioma ─────────────────────
  // Los botones/placeholders estáticos ya los cubre applyTranslations() (i18n.js,
  // atributos data-i18n*); esto solo re-renderiza los estados vacíos que este
  // módulo escribe a mano con t() en el momento de construirlos.
  document.addEventListener('dbv-lang-changed', function () {
    if (!fileTreeEl.children.length) showTreeEmptyState();
    if (!quickOpenModal.classList.contains('hidden')) renderQuickOpenList();
  });

  // ─── API pública para app.js ───────────────────────────────────────────────
  window.DBVFileTree = {
    // Llamado por app.js tras cada loadDocument() exitoso — la raíz del árbol
    // siempre sigue al documento activo (RF-25).
    onDocumentLoaded: function (doc) {
      setRoot(doc && doc.dir_path);
    },
    // Llamado por app.js tras cargar Archivos Recientes (RF-11). Si ya hay una
    // raíz (documento activo), no hace nada — solo cubre el arranque en frío
    // sin ningún documento abierto.
    onRecentFilesLoaded: function (list) {
      if (currentRoot) return;
      var firstLocal = (list || []).filter(function (f) { return !window.DBVApp.isRemoteUrl(f.path); })[0];
      if (firstLocal) setRoot(dirnameOf(firstLocal.path));
    },
    // Arrastrar una carpeta sobre la ventana (ampliación de RF-09/D&D). Devuelve
    // una promesa<boolean> — el listener de drag-drop de app.js la usa para
    // decidir si el drop se consumió como carpeta o si debe seguir ignorándolo.
    setRootFromDrop: function (path) {
      return setRoot(path).then(function (ok) {
        if (ok) { window.DBVApp.setTocVisible(true); setActiveTab('files'); }
        return ok;
      });
    },
    toggleQuickOpen: toggleQuickOpen
  };

  resetTree();
  showTreeEmptyState();
})();
