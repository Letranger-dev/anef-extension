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

  /** Inject Chrome Web Store link in desktop nav (right-aligned) */
  function initCWSLink() {
    var desktopNav = document.querySelector('nav.hidden.md\\:block .max-w-container');
    if (!desktopNav) return;

    var link = document.createElement('a');
    link.href = 'https://chromewebstore.google.com/detail/anef-status-tracker/icnpklneeaiffilemaflccdejefpehek';
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'cws-nav-link';
    link.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="10"/>'
      + '<circle cx="12" cy="12" r="4"/>'
      + '<line x1="21.17" y1="8" x2="12" y2="8"/>'
      + '<line x1="3.95" y1="6.06" x2="8.54" y2="14"/>'
      + '<line x1="10.88" y1="21.94" x2="15.46" y2="14"/>'
      + '</svg>'
      + '<span>Installer l\u2019extension</span>';
    desktopNav.appendChild(link);

    // Inject styles once
    if (!document.getElementById('cws-link-css')) {
      var style = document.createElement('style');
      style.id = 'cws-link-css';
      style.textContent =
        '.cws-nav-link{'
        + 'margin-left:auto;'
        + 'display:flex;align-items:center;gap:0.4rem;'
        + 'padding:0.45rem 0.9rem;'
        + 'font-size:0.78rem;font-weight:600;'
        + 'color:#60a5fa;'
        + 'background:rgba(59,130,246,0.08);'
        + 'border:1px solid rgba(59,130,246,0.2);'
        + 'border-radius:8px;'
        + 'text-decoration:none;'
        + 'white-space:nowrap;'
        + 'transition:all 0.2s;'
        + 'align-self:center;'
        + '}'
        + '.cws-nav-link:hover{'
        + 'background:rgba(59,130,246,0.18);'
        + 'border-color:rgba(59,130,246,0.4);'
        + 'color:#93bbfd;'
        + 'transform:translateY(-1px);'
        + '}'
        + '.cws-nav-link svg{opacity:0.8;flex-shrink:0}';
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
    initCWSLink();
    initVersion();
  });

  ANEF.nav = {
    initNav: initNav
  };
})();
