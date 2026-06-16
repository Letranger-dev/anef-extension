/**
 * shared/i18n/i18n.js — Moteur d'internationalisation runtime (zéro build).
 *
 * Principe : chaque langue est un fichier catalogue (`fr.js`, `en.js`, …) chargé
 * en <script> qui s'enregistre via ANEF.i18n.register(lang, dict). Le moteur
 * résout les clés à l'affichage, retombe sur le FR si une clé manque, et pilote
 * la direction du texte (LTR/RTL).
 *
 * Ajouter une langue = (1) déposer `xx.js`, (2) l'ajouter à SUPPORTED ci-dessous
 * (+ RTL si besoin), (3) ajouter sa balise <script> dans les 6 HTML. Rien d'autre.
 *
 * Ordre de chargement requis dans le HTML :
 *   i18n.js  →  fr.js  →  en.js …  →  (constants.js, pages, nav.js)
 * car les catalogues appellent register() et les pages appellent t() au render.
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  // Langue par défaut ET langue de repli (source de vérité).
  var DEFAULT = 'fr';
  // Toutes les langues proposées. L'ordre = ordre d'affichage dans le sélecteur.
  var SUPPORTED = ['fr', 'en', 'es', 'ar', 'zh'];
  // Sous-ensemble écrit de droite à gauche.
  var RTL = ['ar'];
  var STORAGE_KEY = 'anef-lang';

  // Métadonnées d'affichage du sélecteur (nom natif), locale BCP-47 (Intl) et
  // og:locale (format Open Graph language_TERRITORY pour le SEO/partage social).
  var META = {
    fr: { label: 'Français',  locale: 'fr-FR', og: 'fr_FR' },
    en: { label: 'English',   locale: 'en-GB', og: 'en_GB' },
    es: { label: 'Español',   locale: 'es-ES', og: 'es_ES' },
    ar: { label: 'العربية', locale: 'ar',    og: 'ar_AR' },
    zh: { label: '中文',      locale: 'zh-CN', og: 'zh_CN' }
  };

  var catalogs = {};   // { fr: {key: "…"}, en: {…}, … }
  var current = DEFAULT;

  /** Détecte la langue : ?lang= (URL partageable / SEO) > localStorage > navigateur > défaut. */
  function detect() {
    try {
      var p = new URLSearchParams(location.search).get('lang');
      if (p && SUPPORTED.indexOf(p) !== -1) {
        try { localStorage.setItem(STORAGE_KEY, p); } catch (e) {} // persiste le choix
        return p;
      }
    } catch (e) {}
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    var nav = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase();
    return SUPPORTED.indexOf(nav) !== -1 ? nav : DEFAULT;
  }

  /** Un catalogue s'enregistre ici. Fusionne (permet de splitter un catalogue). */
  function register(lang, dict) {
    if (!catalogs[lang]) catalogs[lang] = {};
    for (var k in dict) {
      if (Object.prototype.hasOwnProperty.call(dict, k)) catalogs[lang][k] = dict[k];
    }
  }

  /**
   * Traduit une clé. Interpolation : t('x.count', {n: 3}) remplace «{n}».
   * Repli : langue courante → FR → la clé elle-même (visible = trou de trad).
   */
  function t(key, vars) {
    var dict = catalogs[current] || {};
    var val = dict[key];
    if (val == null) val = (catalogs[DEFAULT] || {})[key];
    if (val == null) return key;
    if (vars) {
      val = String(val).replace(/\{(\w+)\}/g, function(_, name) {
        return vars[name] != null ? vars[name] : '{' + name + '}';
      });
    }
    return val;
  }

  // Règles de pluriel mémoïsées par locale (catégories CLDR : one/other/…).
  var _plural = {};
  function pluralRules() {
    var loc = locale();
    if (!_plural[loc]) {
      try { _plural[loc] = new Intl.PluralRules(loc); }
      catch (e) { _plural[loc] = { select: function(n) { return n === 1 ? 'one' : 'other'; } }; }
    }
    return _plural[loc];
  }

  /**
   * Traduction au pluriel. La valeur de la clé est un objet de formes CLDR,
   * ex. { one: '{n} préfecture', other: '{n} préfectures' }. On sélectionne la
   * forme selon n et la locale, puis on interpole {n} (et tout autre {var}).
   * Repli : forme manquante → 'other' → 'one' → la clé.
   */
  function tn(key, n, vars) {
    var dict = catalogs[current] || {};
    var forms = dict[key];
    if (forms == null) forms = (catalogs[DEFAULT] || {})[key];
    if (forms == null) return key;
    if (typeof forms === 'string') forms = { other: forms };
    var cat = pluralRules().select(n);
    var val = forms[cat] != null ? forms[cat] : (forms.other != null ? forms.other : forms.one);
    if (val == null) return key;
    var merged = { n: n };
    if (vars) for (var k in vars) merged[k] = vars[k];
    return String(val).replace(/\{(\w+)\}/g, function(_, name) {
      return merged[name] != null ? merged[name] : '{' + name + '}';
    });
  }

  /**
   * Lookup brut de la langue courante UNIQUEMENT (pas de repli FR ni clé).
   * Renvoie undefined si la clé n'est pas traduite dans la langue active.
   * Sert à superposer des traductions optionnelles (ex. dictionnaire STATUTS
   * dont le FR reste la source dans constants.js).
   */
  function tRaw(key) {
    var dict = catalogs[current];
    return dict ? dict[key] : undefined;
  }

  /** Applique les traductions au DOM statique (annoté data-i18n*). */
  function applyToDOM(root) {
    root = root || document;

    // Texte : <span data-i18n="nav.accueil">Accueil</span>
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }

    // Markup de confiance : <p data-i18n-html="privacy.list">…</p>
    var htmlNodes = root.querySelectorAll('[data-i18n-html]');
    for (var h = 0; h < htmlNodes.length; h++) {
      htmlNodes[h].innerHTML = t(htmlNodes[h].getAttribute('data-i18n-html'));
    }

    // Attributs : data-i18n-attr="title:tip.refresh;aria-label:tip.refresh"
    var attrNodes = root.querySelectorAll('[data-i18n-attr]');
    for (var a = 0; a < attrNodes.length; a++) {
      var spec = attrNodes[a].getAttribute('data-i18n-attr');
      var pairs = spec.split(';');
      for (var p = 0; p < pairs.length; p++) {
        var idx = pairs[p].indexOf(':');
        if (idx < 0) continue;
        var attr = pairs[p].slice(0, idx).trim();
        var key = pairs[p].slice(idx + 1).trim();
        if (attr) attrNodes[a].setAttribute(attr, t(key));
      }
    }
  }

  /** Pose lang + dir sur <html> + og:locale (SEO/partage). Idempotent. */
  function applyDir() {
    var dir = RTL.indexOf(current) !== -1 ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('lang', current);
    document.documentElement.setAttribute('dir', dir);
    var og = document.querySelector('meta[property="og:locale"]');
    if (og && META[current]) og.setAttribute('content', META[current].og);
  }

  /**
   * Change de langue. On recharge la page : les pages se reconstruisent depuis
   * les données et leurs caches par signature repartent propres — plus robuste
   * qu'un re-render à chaud (cf. perf v1.34.2).
   */
  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1 || lang === current) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    // Si l'URL porte un ?lang= (lien partagé), on le retire : sinon il
    // réécraserait le choix au reload et bloquerait le sélecteur. Désormais
    // c'est localStorage qui gouverne.
    try {
      var url = new URL(location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.delete('lang');
        location.replace(url.href);
        return;
      }
    } catch (e) {}
    try { location.reload(); } catch (e) {}
  }

  function isRTL() { return RTL.indexOf(current) !== -1; }

  /** Locale BCP-47 pour Intl (dates, nombres, tri). */
  function locale() { return (META[current] || META[DEFAULT]).locale; }

  // Détection au plus tôt pour que t()/locale() soient corrects dès le chargement
  // des catalogues et des pages (l'anti-FOUC du <head> a déjà posé lang/dir).
  current = detect();

  // Synchronise le DOM une fois prêt (chrome statique annoté data-i18n).
  document.addEventListener('DOMContentLoaded', function() {
    applyDir();
    applyToDOM(document);
  });

  ANEF.i18n = {
    register: register,
    t: t,
    tn: tn,
    tRaw: tRaw,
    setLang: setLang,
    getLang: function() { return current; },
    locale: locale,
    isRTL: isRTL,
    applyToDOM: applyToDOM,
    SUPPORTED: SUPPORTED,
    RTL: RTL,
    META: META
  };

  // Raccourcis globaux ergonomiques pour les pages : ANEF.t('key') / ANEF.tn('key', n)
  ANEF.t = t;
  ANEF.tn = tn;
})();
