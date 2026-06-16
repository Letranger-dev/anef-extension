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
      + '<span>' + (ANEF.t ? ANEF.t('nav.install') : 'Installer l\u2019extension') + '</span>';
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
        + 'color:var(--primary-light);'
        + 'background:rgba(59,130,246,0.08);'
        + 'border:1px solid rgba(59,130,246,0.25);'
        + 'border-radius:8px;'
        + 'text-decoration:none;'
        + 'white-space:nowrap;'
        + 'transition:all 0.2s;'
        + 'align-self:center;'
        + '}'
        + '.cws-nav-link:hover{'
        + 'background:rgba(59,130,246,0.18);'
        + 'border-color:rgba(59,130,246,0.45);'
        + 'color:var(--primary);'
        + 'transform:translateY(-1px);'
        + '}'
        + '.cws-nav-link svg{opacity:0.8;flex-shrink:0}';
      document.head.appendChild(style);
    }
  }

  /** Theme toggle (light/dark)
   *  - data-theme attribute on <html> drives all CSS variables in common.css.
   *  - localStorage 'anef-theme' persists user choice across visits.
   *  - First-paint application is handled by an inline script in the <head>
   *    (anti-FOUC). Here we only own the toggle UI + state sync.
   *  - System preference is followed only when the user hasn't picked a theme.
   *  - Two buttons are injected — one in the desktop nav, one in the mobile
   *    bottom nav — and CSS visibility selects the right one per viewport.
   *    This keeps the toggle in the same horizontal flow as other nav items
   *    (no floating overlay, no awkward absolute positioning in the header).
   */
  function initThemeToggle() {
    var STORAGE_KEY = 'anef-theme';

    var SUN_SVG =
        '<svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" width="20" height="20" '
      +     'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +   '<circle cx="12" cy="12" r="4"></circle>'
      +   '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>'
      + '</svg>';
    var MOON_SVG =
        '<svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" width="20" height="20" '
      +     'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +   '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
      + '</svg>';

    var buttons = [];

    // Desktop button — sits in the desktop top nav.
    var desktopNav = document.querySelector('nav.hidden.md\\:block .max-w-container');
    if (desktopNav) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'theme-toggle theme-toggle--desktop';
      d.innerHTML = SUN_SVG + MOON_SVG;
      desktopNav.appendChild(d);
      buttons.push(d);
    }

    // Mobile button — added as the rightmost item of the bottom nav.
    var mobileNav = document.querySelector('.mobile-nav-bar');
    if (mobileNav) {
      var m = document.createElement('button');
      m.type = 'button';
      m.className = 'nav-link theme-toggle theme-toggle--mobile';
      // Match other mobile nav items: vertical stack of icon + label, flex-1 width.
      m.innerHTML =
          '<span class="theme-toggle-icon-wrap">' + SUN_SVG + MOON_SVG + '</span>'
        + '<span class="theme-toggle-label">' + (ANEF.t ? ANEF.t('nav.theme') : 'Thème') + '</span>';
      mobileNav.appendChild(m);
      buttons.push(m);
    }

    if (!buttons.length) return;
    // Use the first injected button as the canonical one for tests/scripting.
    buttons[0].id = 'anef-theme-toggle';

    function applyTheme(theme, persist) {
      document.documentElement.setAttribute('data-theme', theme);
      var label = theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair';
      buttons.forEach(function(b) {
        b.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
        b.setAttribute('aria-label', label);
        b.title = label;
      });
      if (persist) {
        try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
      }
      try {
        document.dispatchEvent(new CustomEvent('anef:theme-change', { detail: { theme: theme } }));
      } catch (e) {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('anef:theme-change', false, false, { theme: theme });
        document.dispatchEvent(evt);
      }
    }

    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current, false);

    buttons.forEach(function(b) {
      b.addEventListener('click', function() {
        var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next, true);
      });
    });

    // Follow OS theme changes only if the user hasn't explicitly chosen.
    if (window.matchMedia) {
      var mql = window.matchMedia('(prefers-color-scheme: light)');
      var onMql = function(e) {
        var saved;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) { saved = null; }
        if (saved) return;
        applyTheme(e.matches ? 'light' : 'dark', false);
      };
      if (mql.addEventListener) mql.addEventListener('change', onMql);
      else if (mql.addListener) mql.addListener(onMql);
    }

    // Inject styles once.
    if (!document.getElementById('anef-theme-toggle-css')) {
      var style = document.createElement('style');
      style.id = 'anef-theme-toggle-css';
      style.textContent = [
        // Common: hide irrelevant icon, show the right one per theme.
        '.theme-toggle .theme-icon { display: none; }',
        '[data-theme="dark"] .theme-toggle .theme-icon-sun { display: block; }',
        '[data-theme="light"] .theme-toggle .theme-icon-moon { display: block; }',

        // Desktop variant: sits next to "Installer l\'extension".
        '.theme-toggle--desktop {',
        '  display: inline-flex; align-items: center; justify-content: center;',
        '  width: 38px; height: 38px;',
        '  margin-left: 0.5rem; padding: 0;',
        '  border: 1px solid var(--border); border-radius: 8px;',
        '  background: var(--bg); color: var(--text-muted);',
        '  cursor: pointer; align-self: center;',
        '  transition: color 0.15s, border-color 0.15s, background 0.15s, transform 0.15s;',
        '}',
        '.theme-toggle--desktop:hover {',
        '  color: var(--primary-light); border-color: var(--primary);',
        '  background: var(--bg-card-hover); transform: translateY(-1px);',
        '}',
        '.theme-toggle--desktop:focus-visible {',
        '  outline: 2px solid var(--primary); outline-offset: 2px;',
        '}',

        // Mobile variant: 7th item of the bottom nav, matches other nav-links.
        '.theme-toggle--mobile {',
        '  background: transparent; border: 0;',
        '  display: flex; flex-direction: column; align-items: center;',
        '  justify-content: center; flex: 1;',
        '  color: rgb(var(--text-dim-rgb));',
        '  font-size: 0.55rem; font-weight: 500;',
        '  padding: 0; cursor: pointer;',
        '  font-family: inherit; line-height: 1.1;',
        '}',
        '.theme-toggle--mobile .theme-icon-wrap,',
        '.theme-toggle--mobile .theme-toggle-icon-wrap {',
        '  display: inline-flex; line-height: 1; margin-bottom: 0.15rem;',
        '}',
        '.theme-toggle--mobile .theme-icon { width: 18px; height: 18px; }',
        '.theme-toggle--mobile:active { color: var(--primary-light); }',
        '.theme-toggle--mobile:focus-visible {',
        '  outline: 2px solid var(--primary); outline-offset: -2px;',
        '}',

        // Mobile bottom nav: 7 items get tight; reduce gap so labels fit.
        '@media (max-width: 767px) {',
        '  .mobile-nav-bar .nav-link { font-size: 0.52rem !important; }',
        '  .mobile-nav-bar .nav-link span:first-child { margin-bottom: 0.1rem; }',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  /** Language switcher (dropdown in the header, desktop + mobile).
   *  - Placed in the <header> (not the bottom nav, already full at 7 items).
   *  - Lists ANEF.i18n.SUPPORTED; picking one persists + reloads (see i18n.js).
   *  - Scales to N languages with zero layout change.
   */
  function initLangSwitcher() {
    if (!ANEF.i18n) return;
    var header = document.querySelector('header .max-w-container');
    if (!header) return;

    var i18n = ANEF.i18n;
    var cur = i18n.getLang();
    var meta = i18n.META[cur] || i18n.META.fr;

    // The header centers its content; anchor the switcher to the right edge.
    header.style.position = 'relative';

    var wrap = document.createElement('div');
    wrap.className = 'lang-switcher';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', i18n.t('lang.label'));
    btn.title = i18n.t('lang.label');
    // No flag emojis: they render as "tofu"/letter-pairs on Windows. Use a globe
    // icon + the language code instead — legible on every platform.
    var GLOBE_SVG =
        '<svg class="lang-globe" width="16" height="16" viewBox="0 0 24 24" fill="none" '
      +   'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +   '<circle cx="12" cy="12" r="10"></circle>'
      +   '<line x1="2" y1="12" x2="22" y2="12"></line>'
      +   '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'
      + '</svg>';
    btn.innerHTML =
        GLOBE_SVG
      + '<span class="lang-code">' + cur.toUpperCase() + '</span>'
      + '<svg class="lang-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    var menu = document.createElement('div');
    menu.className = 'lang-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    i18n.SUPPORTED.forEach(function(code) {
      var m = i18n.META[code] || {};
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'lang-item' + (code === cur ? ' active' : '');
      item.setAttribute('role', 'menuitem');
      item.setAttribute('lang', code);
      item.dataset.lang = code;
      item.innerHTML = '<span class="lang-code-chip">' + code.toUpperCase() + '</span><span>' + (m.label || code) + '</span>';
      item.addEventListener('click', function() { i18n.setLang(code); });
      menu.appendChild(item);
    });

    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    function open() { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (menu.hidden) open(); else close();
    });
    document.addEventListener('click', function(e) {
      if (!wrap.contains(e.target)) close();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') close();
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    header.appendChild(wrap);

    if (!document.getElementById('anef-lang-switcher-css')) {
      var style = document.createElement('style');
      style.id = 'anef-lang-switcher-css';
      style.textContent = [
        '.lang-switcher{position:absolute;top:50%;transform:translateY(-50%);',
        '  inset-inline-end:0.75rem;z-index:60;}',
        '.lang-btn{display:inline-flex;align-items:center;gap:0.3rem;',
        '  padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:8px;',
        '  background:var(--bg);color:var(--text-muted);cursor:pointer;',
        '  font-size:0.72rem;font-weight:600;font-family:inherit;line-height:1;',
        '  transition:color .15s,border-color .15s,background .15s;}',
        '.lang-btn:hover{color:var(--primary-light);border-color:var(--primary);}',
        '.lang-btn:focus-visible{outline:2px solid var(--primary);outline-offset:2px;}',
        '.lang-globe{opacity:0.85;flex-shrink:0;}',
        '.lang-caret{opacity:0.6;flex-shrink:0;}',
        '.lang-code-chip{display:inline-flex;align-items:center;justify-content:center;',
        '  min-width:1.6rem;padding:0.1rem 0.3rem;border-radius:5px;',
        '  background:var(--bg);border:1px solid var(--border);',
        '  font-size:0.66rem;font-weight:700;letter-spacing:0.02em;color:var(--text-muted);}',
        '.lang-item.active .lang-code-chip{border-color:var(--primary);color:var(--primary-light);}',
        '.lang-menu{position:absolute;inset-inline-end:0;top:calc(100% + 0.35rem);',
        '  min-width:150px;padding:0.3rem;border:1px solid var(--border);border-radius:10px;',
        '  background:var(--bg-card);box-shadow:0 8px 24px rgba(0,0,0,0.25);}',
        '.lang-item{display:flex;align-items:center;gap:0.55rem;width:100%;',
        '  padding:0.45rem 0.6rem;border:0;border-radius:7px;background:transparent;',
        '  color:var(--text-main);cursor:pointer;font-size:0.82rem;font-family:inherit;',
        '  text-align:start;}',
        '.lang-item:hover{background:var(--bg-card-hover);}',
        '.lang-item.active{color:var(--primary-light);font-weight:600;}',
        // Keep the language menu inside the viewport on any screen.
        '.lang-menu{max-width:calc(100vw - 1rem);}',
        // On small screens, declutter the header: globe-only switcher, drop the
        // decorative "Anonymous data" badge, and reserve room on the right so the
        // centred title never slides under the absolutely-positioned switcher.
        '@media (max-width:560px){',
        '  .lang-btn .lang-code{display:none;}',
        '  .lang-btn{padding:0.34rem 0.4rem;}',
        '  header .max-w-container{padding-inline-end:2.6rem;padding-inline-start:0.6rem;}',
        '  header [data-i18n="header.badge"]{display:none;}',
        '}',
        // Narrow phones: keep only the brand + switcher for a clean top bar.
        '@media (max-width:430px){',
        '  header [data-i18n="header.subtitle"]{display:none;}',
        '}'
      ].join('\n');
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
    initThemeToggle();
    initLangSwitcher();
    initVersion();
  });

  ANEF.nav = {
    initNav: initNav,
    initThemeToggle: initThemeToggle
  };
})();
