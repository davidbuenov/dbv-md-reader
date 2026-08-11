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

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var contentEl    = document.getElementById('content');
  var emptyEl      = document.getElementById('empty-state');
  var breadcrumb   = document.getElementById('doc-breadcrumb');
  var tocSidebar   = document.getElementById('toc-sidebar');
  var tocList      = document.getElementById('toc-list');
  var btnBack      = document.getElementById('btn-back');
  var btnForward   = document.getElementById('btn-forward');

  // ─── markdown-it ─────────────────────────────────────────────────────────
  if (!window.markdownit) { showError('[ERROR] markdown-it no cargado'); return; }
  var md = window.markdownit({ html: true, linkify: true, typographer: true });

  // ─── DOMPurify (sanitización de HTML, RF-03) ──────────────────────────────
  if (!window.DOMPurify) { showError('[ERROR] DOMPurify no cargado'); return; }

  // ─── Mermaid ─────────────────────────────────────────────────────────────
  if (window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
  }

  // =========================================================================
  // Carga y renderizado de documentos
  // =========================================================================

  function loadDocument(filePath, opts) {
    if (!filePath) return;
    opts = opts || {};
    var isHistory     = opts.isHistory;
    var scrollAnchor  = opts.scrollAnchor;
    var isPrimaryOpen = opts.isPrimaryOpen;
    invoke('read_file', { path: filePath })
      .then(function (doc) {
        currentDoc = doc;
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
        // Auto-abrir TOC si tiene encabezados
        var headers = contentEl.querySelectorAll('h1,h2,h3');
        if (headers.length > 0) tocSidebar.classList.remove('hidden');
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
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        } else {
          container.scrollTop = 0;
        }
        // Auto-recarga (RF-06): vigilar el documento activo
        invoke('watch_file', { path: doc.path }).catch(function (err) {
          console.warn('[watch_file]', err);
        });
        // Archivos recientes (RF-11): solo en aperturas explícitas
        if (isPrimaryOpen) {
          invoke('add_recent_file', { path: doc.path, fileName: doc.file_name })
            .then(renderRecentPanel)
            .catch(function (err) { console.warn('[add_recent_file]', err); });
        }
      })
      .catch(function (err) {
        showError('[loadDocument] ' + err);
        alert(t('errors.loadFailed', { error: err }));
      });
  }

  // ─── Auto-recarga por cambios externos (RF-06) ────────────────────────────
  var reloadDebounceTimer = null;

  function reloadCurrentDocument() {
    if (!currentDoc) return;
    var container = document.getElementById('reader-container');
    var savedScroll = container.scrollTop;
    invoke('read_file', { path: currentDoc.path })
      .then(function (doc) {
        currentDoc = doc;
        renderMarkdown(doc.content);
        container.scrollTop = savedScroll;
      })
      .catch(function (err) { console.warn('[reloadCurrentDocument]', err); });
  }

  window.__TAURI__.event.listen('file-changed', function (event) {
    if (!currentDoc || event.payload !== currentDoc.path) return;
    clearTimeout(reloadDebounceTimer);
    reloadDebounceTimer = setTimeout(reloadCurrentDocument, 150);
  }).catch(function (err) {
    showError('[file-changed listener] ' + err);
  });

  function renderMarkdown(raw) {
    var html = md.render(raw);
    html = window.DOMPurify.sanitize(html, { ADD_ATTR: ['id', 'class', 'name'] });
    contentEl.innerHTML = html;
    contentEl.querySelectorAll('pre code').forEach(function (block) {
      if (window.Prism) window.Prism.highlightElement(block);
      addCopyButton(block.parentElement);
    });
    processMermaid();
    interceptLinks();
    resolveImages();
    buildToc();
  }

  // ─── Resolución de imágenes locales (RF-07) ───────────────────────────────
  function resolveImages() {
    if (!currentDoc || !currentDoc.dir_path) return;
    contentEl.querySelectorAll('img[src]').forEach(function (img) {
      var src = img.getAttribute('src');
      if (!src || /^(https?:|data:|asset:)/i.test(src)) return;
      invoke('resolve_relative_path', { baseDir: currentDoc.dir_path, relativePath: src })
        .then(function (resolved) {
          img.src = window.__TAURI__.core.convertFileSrc(resolved);
        })
        .catch(function (err) { console.warn('[resolveImages]', src, err); });
    });
  }

  function addCopyButton(pre) {
    if (pre.querySelector('.code-copy-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = t('copy.copy');
    btn.addEventListener('click', function () {
      var text = (pre.querySelector('code') || {}).innerText || '';
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = t('copy.copied');
        setTimeout(function () { btn.textContent = t('copy.copy'); }, 2000);
      });
    });
    pre.appendChild(btn);
  }

  function processMermaid() {
    if (!window.mermaid) return;
    var blocks = contentEl.querySelectorAll('pre code.language-mermaid');
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
        .catch(function (e) { console.warn('Mermaid:', e); });
    });
  }

  function interceptLinks() {
    contentEl.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (href.startsWith('http://') || href.startsWith('https://')) {
          openExternal(href);
        } else if (href.startsWith('#')) {
          // Ancla en el documento actual
          var el = document.getElementById(href.slice(1));
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (currentDoc && currentDoc.dir_path) {
          // Enlace relativo — separar ruta del fragmento #ancla
          var hashIdx = href.indexOf('#');
          var filePart   = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
          var anchorPart = hashIdx >= 0 ? href.slice(hashIdx)   : '';
          if (!filePart) {
            // Solo ancla, sin archivo
            var el = document.getElementById(anchorPart.slice(1));
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            return;
          }
          invoke('resolve_relative_path', { baseDir: currentDoc.dir_path, relativePath: filePart })
            .then(function (resolved) { loadDocument(resolved, { scrollAnchor: anchorPart }); })
            .catch(function (err) { showError('[link] ' + err); });
        }
      });
    });
  }

  function buildToc() {
    tocList.innerHTML = '';
    var headers = contentEl.querySelectorAll('h1,h2,h3');
    if (!headers.length) {
      tocList.innerHTML = '<p class="text-xs text-muted">' + t('toc.empty') + '</p>';
      return;
    }
    headers.forEach(function (h, i) {
      if (!h.id) h.id = 'h-' + i;
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.innerText;
      a.className = 'block py-1 hover:text-accent truncate transition ' +
        (h.tagName === 'H1' ? 'toc-item-h1' : h.tagName === 'H2' ? 'toc-item-h2' : 'toc-item-h3');
      a.addEventListener('click', function (e) { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth' }); });
      tocList.appendChild(a);
    });
  }

  // =========================================================================
  // Navegación historia
  // =========================================================================

  function updateNavButtons() {
    btnBack.disabled    = histIdx <= 0;
    btnForward.disabled = histIdx >= history.length - 1;
  }

  btnBack.addEventListener('click', function () {
    if (histIdx > 0) { histIdx--; loadDocument(history[histIdx], { isHistory: true }); }
  });
  btnForward.addEventListener('click', function () {
    if (histIdx < history.length - 1) { histIdx++; loadDocument(history[histIdx], { isHistory: true }); }
  });

  // =========================================================================
  // Temas
  // =========================================================================

  var btnThemes = {
    light: document.getElementById('theme-light'),
    dark:  document.getElementById('theme-dark'),
    sepia: document.getElementById('theme-sepia')
  };

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Object.keys(btnThemes).forEach(function (k) { btnThemes[k].classList.remove('active'); });
    if (btnThemes[theme]) btnThemes[theme].classList.add('active');
    localStorage.setItem('dbv-md-theme', theme);
  }

  Object.keys(btnThemes).forEach(function (name) {
    btnThemes[name].addEventListener('click', function () { setTheme(name); });
  });

  document.getElementById('btn-toggle-toc').addEventListener('click', function () {
    tocSidebar.classList.toggle('hidden');
  });

  // =========================================================================
  // Idioma
  // =========================================================================

  var btnLangs = {
    es: document.getElementById('lang-es'),
    en: document.getElementById('lang-en')
  };

  function setLang(lang) {
    window.DBV_I18N.setLang(lang);
    Object.keys(btnLangs).forEach(function (k) { btnLangs[k].classList.remove('active'); });
    if (btnLangs[lang]) btnLangs[lang].classList.add('active');
    // El breadcrumb no lleva data-i18n (si hay un documento abierto, applyTranslations()
    // no debe pisar su nombre de archivo con el texto de "sin documento").
    if (!currentDoc) breadcrumb.textContent = t('toolbar.noDocument');
  }

  Object.keys(btnLangs).forEach(function (name) {
    btnLangs[name].addEventListener('click', function () { setLang(name); });
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

  // Instalado vía MSIX (Microsoft Store): las actualizaciones las gestiona la
  // Store/Windows Update, no este updater (que apunta a GitHub Releases y
  // solo tiene sentido para el instalador NSIS). Descargar y ejecutar ese
  // instalador dentro del sandbox del paquete fallaría o crearía una
  // instalación separada y desconectada de la de la Store.
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
      m.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  document.getElementById('btn-open-file').addEventListener('click', openFileDialog);
  document.getElementById('btn-empty-open').addEventListener('click', openFileDialog);
  document.getElementById('btn-print').addEventListener('click', function () { window.print(); });

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
    if (!/^https?:\/\//i.test(url)) {
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
  // Atajos de teclado
  // =========================================================================

  window.addEventListener('keydown', function (e) {
    if      (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchPanel.open(); }
    else if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openFileDialog(); }
    else if (e.ctrlKey && e.key === 'p') { e.preventDefault(); window.print(); }
    else if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); }
    else if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); }
    else if (e.ctrlKey && e.key === '0') { e.preventDefault(); zoomReset(); }
    else if (e.altKey  && e.key === 'ArrowLeft')  { e.preventDefault(); if (histIdx > 0) btnBack.click(); }
    else if (e.altKey  && e.key === 'ArrowRight') { e.preventDefault(); if (histIdx < history.length - 1) btnForward.click(); }
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
          if (cliPath) loadDocument(cliPath, { isPrimaryOpen: true });
        })
        .catch(function (err) {
          console.log('[init] no CLI arg:', err);
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
