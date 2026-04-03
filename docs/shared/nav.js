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

  /** Maintenance / update banner (temporary — remove when v2.4.7 is widely deployed) */
  function initMaintenanceBanner() {
    var header = document.querySelector('header');
    if (!header) return;

    var banner = document.createElement('div');
    banner.id = 'maintenance-banner';
    banner.innerHTML =
      '<div class="maint-inner">'
      + '<div class="maint-icon">&#x1f512;</div>'
      + '<div class="maint-text">'
      + '<strong class="maint-title">Mise \u00e0 jour de s\u00e9curit\u00e9 \u2014 v2.4.7</strong>'
      + '<p class="maint-desc">'
      + 'Pour des raisons de s\u00e9curit\u00e9, les versions ant\u00e9rieures de l\u2019extension '
      + 'ne transmettent plus de donn\u00e9es au site de statistiques. '
      + 'La mise \u00e0 jour vers la v2.4.7 se fait <strong>automatiquement</strong> via le Chrome Web Store.'
      + '</p>'
      + '<p class="maint-hint">'
      + 'Si vos donn\u00e9es n\u2019apparaissent plus ici, v\u00e9rifiez votre version dans les param\u00e8tres de l\u2019extension.'
      + '</p>'
      + '</div>'
      + '<a class="maint-btn" href="https://chromewebstore.google.com/detail/anef-status-tracker/icnpklneeaiffilemaflccdejefpehek" '
      + 'target="_blank" rel="noopener">'
      + 'Voir sur le Chrome Web Store'
      + '</a>'
      + '</div>';
    header.insertAdjacentElement('afterend', banner);

    // Inject styles once
    if (!document.getElementById('maint-banner-css')) {
      var style = document.createElement('style');
      style.id = 'maint-banner-css';
      style.textContent =
        '#maintenance-banner{background:linear-gradient(135deg,#1e3a5f 0%,#1a2744 100%);border-bottom:2px solid #f59e0b33;padding:1rem 1.25rem}'
        + '.maint-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;gap:1rem}'
        + '.maint-icon{font-size:1.8rem;flex-shrink:0}'
        + '.maint-text{flex:1;min-width:0}'
        + '.maint-title{color:#f59e0b;font-size:0.9rem;display:block}'
        + '.maint-desc{color:#cbd5e1;font-size:0.8rem;margin:0.3rem 0 0;line-height:1.5}'
        + '.maint-desc strong{color:#e2e8f0}'
        + '.maint-hint{color:#64748b;font-size:0.72rem;margin:0.25rem 0 0;font-style:italic}'
        + '.maint-btn{flex-shrink:0;background:#3b82f6;color:#fff;padding:0.5rem 1.2rem;border-radius:8px;text-decoration:none;font-size:0.78rem;font-weight:600;white-space:nowrap;transition:background 0.2s}'
        + '.maint-btn:hover{background:#2563eb}'
        + '@media(max-width:640px){'
        + '.maint-inner{flex-direction:column;text-align:center;gap:0.6rem}'
        + '.maint-icon{font-size:1.5rem}'
        + '.maint-title{font-size:0.82rem}'
        + '.maint-desc{font-size:0.75rem}'
        + '.maint-btn{width:100%;text-align:center;padding:0.6rem}'
        + '}';
      document.head.appendChild(style);
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
    initMaintenanceBanner();
    initVersion();
  });

  ANEF.nav = {
    initNav: initNav
  };
})();
