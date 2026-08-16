// =============================================================================
// dbv-md-reader — Página de presentación · David Bueno Vallejo · MIT
// =============================================================================
(function () {
  'use strict';

  var themeImg = document.getElementById('theme-img');
  var tabs = document.querySelectorAll('.theme-tab');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      if (themeImg) themeImg.src = tab.getAttribute('data-shot');
    });
  });

  // ─── Lightbox: ampliar la demo/capturas al hacer clic ───────────────────
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.innerHTML = '<button class="lightbox-close" type="button" aria-label="Cerrar">✕</button><img alt="" />';
  document.body.appendChild(lightbox);
  var lightboxImg = lightbox.querySelector('img');

  function openLightbox(img) {
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    lightbox.classList.add('is-open');
  }
  function closeLightbox() {
    lightbox.classList.remove('is-open');
  }

  document.querySelectorAll('.window-img, .screenshot-card img').forEach(function (img) {
    img.addEventListener('click', function () { openLightbox(img); });
  });
  lightbox.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

})();
