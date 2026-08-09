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

})();
