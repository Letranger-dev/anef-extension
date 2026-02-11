/**
 * shared/nav.js — Navigation partagee + page active
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  /** Detect current page and set active nav link */
  function initNav() {
    var path = window.location.pathname;
    var page = path.split('/').pop() || 'index.html';

    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href === page || (page === '' && href === 'index.html')) {
        links[i].classList.add('active');
      } else {
        links[i].classList.remove('active');
      }
    }
  }

  /** Inject version tag in footer */
  function initVersion() {
    var footer = document.querySelector('footer');
    if (!footer || !ANEF.constants || !ANEF.constants.SITE_VERSION) return;
    var tag = document.createElement('p');
    tag.style.cssText = 'margin-top:0.25rem;font-size:0.65rem;opacity:0.35;';
    tag.textContent = 'v' + ANEF.constants.SITE_VERSION;
    footer.appendChild(tag);
  }

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    initNav();
    initVersion();
  });

  ANEF.nav = {
    initNav: initNav
  };
})();
