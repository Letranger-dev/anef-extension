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

  /** Maintenance banner — version CWS obsolète (temporaire, supprimer quand v2.4.9 approuvée) */
  function initMaintenanceBanner() {
    var header = document.querySelector('header');
    if (!header) return;

    var banner = document.createElement('div');
    banner.id = 'maint-banner';
    banner.innerHTML =
      '<div class="maint-inner">'
      + '<div class="maint-icon">\u26a0\ufe0f</div>'
      + '<div class="maint-text">'
      + '<strong class="maint-title">Site en maintenance \u2014 Mise \u00e0 jour en cours</strong>'
      + '<p class="maint-desc">'
      + 'La version actuellement disponible sur le Chrome Web Store (v2.4.5) '
      + '<strong>n\u2019est plus compatible</strong> avec le site de statistiques. '
      + 'Une nouvelle version s\u00e9curis\u00e9e (v2.4.9) est en attente de validation par Google.'
      + '</p>'
      + '<p class="maint-hint">'
      + 'Les donn\u00e9es du site ne sont plus aliment\u00e9es en attendant. '
      + 'La mise \u00e0 jour sera automatique d\u00e8s l\u2019approbation.'
      + '</p>'
      + '</div>'
      + '</div>';
    header.insertAdjacentElement('afterend', banner);

    if (!document.getElementById('maint-banner-css')) {
      var style = document.createElement('style');
      style.id = 'maint-banner-css';
      style.textContent =
        '#maint-banner{background:linear-gradient(135deg,#451a03 0%,#78350f 100%);border-bottom:2px solid rgba(245,158,11,0.25);padding:0.9rem 1.25rem}'
        + '.maint-inner{max-width:900px;margin:0 auto;display:flex;align-items:flex-start;gap:0.8rem}'
        + '.maint-icon{font-size:1.5rem;flex-shrink:0;margin-top:0.1rem}'
        + '.maint-text{flex:1;min-width:0}'
        + '.maint-title{color:#fbbf24;font-size:0.85rem;display:block}'
        + '.maint-desc{color:#d6d3d1;font-size:0.78rem;margin:0.3rem 0 0;line-height:1.5}'
        + '.maint-desc strong{color:#fca5a5}'
        + '.maint-hint{color:#78716c;font-size:0.7rem;margin:0.25rem 0 0;font-style:italic}'
        + '@media(max-width:640px){'
        + '#maint-banner{padding:0.7rem 0.8rem}'
        + '.maint-inner{gap:0.5rem}'
        + '.maint-icon{font-size:1.2rem}'
        + '.maint-title{font-size:0.8rem}'
        + '.maint-desc{font-size:0.72rem}'
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
    initCWSLink();
    initVersion();
  });

  ANEF.nav = {
    initNav: initNav
  };
})();
