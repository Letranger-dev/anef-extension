/**
 * shared/utils.js — Fonctions utilitaires
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  // Formateur Intl créé UNE seule fois : l'instancier coûte ~0,1 ms, donc le
  // recréer à chaque appel (≈20k fois au chargement) ajoutait ~2 s. Réutilisé ici.
  var _parisDateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  // Mémoïsation par instant : formatToParts (conversion timezone) coûte ~0,2 ms,
  // mais les mêmes dates reviennent souvent (today, date_depot/statut partagés).
  var _parisCache = new Map();
  function toParisCalendarUTC(d) {
    var key = d.getTime();
    var hit = _parisCache.get(key);
    if (hit !== undefined) return hit;
    var parts = _parisDateFmt.formatToParts(d);
    var y = 0, m = 0, day = 0;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'year') y = +parts[i].value;
      else if (parts[i].type === 'month') m = +parts[i].value;
      else if (parts[i].type === 'day') day = +parts[i].value;
    }
    var res = Date.UTC(y, m - 1, day);
    _parisCache.set(key, res);
    return res;
  }

  // Chemin rapide pour les chaînes "YYYY-MM-DD" : minuit UTC tombe toujours le
  // même jour calendaire en Europe/Paris (UTC+1/+2), donc inutile de passer par
  // Intl — arithmétique pure. Les timestamps complets gardent la voie mémoïsée.
  var _DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
  function _toCalendarUTC(v) {
    if (typeof v === 'string') {
      var mm = _DATE_ONLY.exec(v);
      if (mm) {
        var y = +mm[1], mo = +mm[2], dd = +mm[3];
        var t = Date.UTC(y, mo - 1, dd);
        // Garde-fou : Date.UTC fait un rollover silencieux sur mois/jour hors
        // plage. On ne garde le chemin rapide que si la date ne déborde pas —
        // sinon on laisse la voie lente reproduire exactement new Date(str)
        // (qui renvoie Invalid Date → null). Round-trip = arithmétique pure.
        var chk = new Date(t);
        if (chk.getUTCFullYear() === y && chk.getUTCMonth() === mo - 1 && chk.getUTCDate() === dd) {
          return t;
        }
      }
    }
    var d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return NaN;
    return toParisCalendarUTC(d);
  }

  function daysDiff(dateStr1, dateStr2OrDate) {
    try {
      var u1 = _toCalendarUTC(dateStr1);
      var u2 = _toCalendarUTC(dateStr2OrDate);
      if (isNaN(u1) || isNaN(u2)) return null;
      return Math.max(0, Math.round((u2 - u1) / 86400000));
    } catch(e) {
      return null;
    }
  }

  function formatDuration(days) {
    if (days === null || days === undefined || isNaN(days) || days < 0) return '\u2014';
    // i18n : pluriels via Intl.PluralRules (catalogue dur.*). Repli FR inline si
    // l'i18n n'est pas charg\u00e9 (ne devrait pas arriver : utils.js charge apr\u00e8s).
    var i18n = (window.ANEF && ANEF.tn) ? ANEF.i18n : null;
    var tn = i18n ? ANEF.tn : function(k, n) { return n + (k === 'dur.years' ? ' an' + (n > 1 ? 's' : '') : k === 'dur.months' ? ' mois' : ' jour' + (n > 1 ? 's' : '')); };
    var t = i18n ? ANEF.t : function(k) { return k === 'dur.lt1day' ? '< 1 jour' : k === 'dur.day_short' ? 'j' : 'mois'; };
    if (days === 0) return t('dur.lt1day');
    if (days < 30) return tn('dur.days', days);
    if (days < 365) {
      var months = Math.floor(days / 30);
      var remain = days % 30;
      if (remain === 0) return tn('dur.months', months);
      return tn('dur.months', months) + ', ' + remain + ' ' + t('dur.day_short');
    }
    var years = Math.floor(days / 365);
    var rest = days % 365;
    var m = Math.floor(rest / 30);
    var d = rest % 30;
    var parts = [tn('dur.years', years)];
    if (m > 0) parts.push(tn('dur.months', m)); // pluriel correct (1 mes / 11 meses…)
    if (d > 0) parts.push(d + ' ' + t('dur.day_short'));
    return parts.join(', ');
  }

  // Formateurs de dates m\u00e9mo\u00efs\u00e9s par (locale + jeu d'options). M\u00eame garde-fou
  // perf que _parisDateFmt : on n'instancie JAMAIS un Intl.DateTimeFormat par
  // appel. La locale vient de l'i18n (fr-FR, en-GB, ar, zh-CN\u2026) ; repli fr-FR.
  // Les noms restent \u2026Fr pour ne pas casser les appelants ; le rendu suit la
  // langue active. Le fuseau reste Europe/Paris (jour calendaire fran\u00e7ais).
  var _DATE_OPTS = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' };
  var _DATETIME_OPTS = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' };
  var _dateFmtCache = new Map();
  function _currentLocale() {
    return (window.ANEF && ANEF.i18n && ANEF.i18n.locale) ? ANEF.i18n.locale() : 'fr-FR';
  }
  function _dateFmt(kind, opts) {
    var key = _currentLocale() + '|' + kind;
    var f = _dateFmtCache.get(key);
    if (!f) { f = new Intl.DateTimeFormat(_currentLocale(), opts); _dateFmtCache.set(key, f); }
    return f;
  }

  function formatDateFr(dateStr) {
    if (!dateStr) return '\u2014';
    try {
      var d = new Date(dateStr);
      if (isNaN(d)) return '\u2014';
      return _dateFmt('date', _DATE_OPTS).format(d);
    } catch(e) {
      return '\u2014';
    }
  }

  function formatDateTimeFr(dateStr) {
    if (!dateStr) return '\u2014';
    try {
      var d = new Date(dateStr);
      if (isNaN(d)) return '\u2014';
      return _dateFmt('datetime', _DATETIME_OPTS).format(d);
    } catch(e) {
      return '\u2014';
    }
  }

  function daysToMonths(days) {
    if (days == null) return '\u2014';
    return '~' + (days / 30).toFixed(1) + ' mois';
  }

  function medianCalc(arr) {
    if (!arr.length) return 0;
    var sorted = arr.slice().sort(function(a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHtml(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }

  /** Group an array of objects by month (YYYY-MM) based on a date field */
  function groupByMonth(items, dateField) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var val = item[dateField];
      if (!val) continue;
      var d = new Date(val);
      if (isNaN(d)) continue;
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  /** Group an array of objects by quarter (YYYY-Q#) */
  function groupByQuarter(items, dateField) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var val = item[dateField];
      if (!val) continue;
      var d = new Date(val);
      if (isNaN(d)) continue;
      var q = Math.ceil((d.getMonth() + 1) / 3);
      var key = d.getFullYear() + '-T' + q;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  /** Group by semester (YYYY-S#) */
  function groupBySemester(items, dateField) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var val = item[dateField];
      if (!val) continue;
      var d = new Date(val);
      if (isNaN(d)) continue;
      var s = d.getMonth() < 6 ? 1 : 2;
      var key = d.getFullYear() + '-S' + s;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  /** Group by ISO week (YYYY-W##) */
  function groupByWeek(items, dateField) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var val = item[dateField];
      if (!val) continue;
      var d = new Date(val);
      if (isNaN(d)) continue;
      var key = getISOWeek(d);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  function getISOWeek(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
  }

  /** Get day-of-week key (0=Mon..6=Sun) and week key for a date */
  function getDayOfWeekAndWeek(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d)) return null;
    var dow = d.getDay();
    dow = dow === 0 ? 6 : dow - 1; // Mon=0..Sun=6
    return { dow: dow, week: getISOWeek(d), date: d };
  }

  ANEF.utils = {
    daysDiff: daysDiff,
    formatDuration: formatDuration,
    formatDateFr: formatDateFr,
    formatDateTimeFr: formatDateTimeFr,
    daysToMonths: daysToMonths,
    medianCalc: medianCalc,
    round1: round1,
    escapeHtml: escapeHtml,
    setText: setText,
    setHtml: setHtml,
    groupByMonth: groupByMonth,
    groupByQuarter: groupByQuarter,
    groupBySemester: groupBySemester,
    groupByWeek: groupByWeek,
    getDayOfWeekAndWeek: getDayOfWeekAndWeek
  };
})();
