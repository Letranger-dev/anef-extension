/**
 * shared/utils.js — Fonctions utilitaires
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  function toParisCalendarUTC(d) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    var y = 0, m = 0, day = 0;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'year') y = +parts[i].value;
      else if (parts[i].type === 'month') m = +parts[i].value;
      else if (parts[i].type === 'day') day = +parts[i].value;
    }
    return Date.UTC(y, m - 1, day);
  }

  function daysDiff(dateStr1, dateStr2OrDate) {
    try {
      var d1 = new Date(dateStr1);
      var d2 = dateStr2OrDate instanceof Date ? dateStr2OrDate : new Date(dateStr2OrDate);
      if (isNaN(d1) || isNaN(d2)) return null;
      var u1 = toParisCalendarUTC(d1);
      var u2 = toParisCalendarUTC(d2);
      return Math.max(0, Math.round((u2 - u1) / 86400000));
    } catch(e) {
      return null;
    }
  }

  function formatDuration(days) {
    if (days === null || days === undefined) return '\u2014';
    if (days === 0) return '< 1 jour';
    if (days < 30) return days + ' jour' + (days > 1 ? 's' : '');
    var totalMonths = Math.floor(days / 30);
    var remainDays = days % 30;
    if (totalMonths < 12) {
      if (remainDays === 0) return totalMonths + ' mois';
      return totalMonths + ' mois, ' + remainDays + ' j';
    }
    var years = Math.floor(totalMonths / 12);
    var remainMonths = totalMonths % 12;
    if (remainMonths === 0) return years + ' an' + (years > 1 ? 's' : '');
    return years + ' an' + (years > 1 ? 's' : '') + ', ' + remainMonths + ' mois';
  }

  function formatDateFr(dateStr) {
    if (!dateStr) return '\u2014';
    try {
      var d = new Date(dateStr);
      if (isNaN(d)) return '\u2014';
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
        timeZone: 'Europe/Paris'
      });
    } catch(e) {
      return '\u2014';
    }
  }

  function formatDateTimeFr(dateStr) {
    if (!dateStr) return '\u2014';
    try {
      var d = new Date(dateStr);
      if (isNaN(d)) return '\u2014';
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Paris'
      });
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
