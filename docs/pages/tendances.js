/**
 * pages/tendances.js — Tendances temporelles
 */
(function() {
  'use strict';

  var C = ANEF.constants;
  var U = ANEF.utils;
  var D = ANEF.data;
  var M = ANEF.math;
  var CH = ANEF.charts;
  var F = ANEF.filters;

  var state = {
    summaries: [],
    snapshots: [],
    grouped: null,
    filters: { statut: 'all', prefecture: 'all', granularity: 'quarter' }
  };

  document.addEventListener('DOMContentLoaded', async function() {
    CH.registerDarkTheme();
    var loading = document.getElementById('loading');
    var main = document.getElementById('main-content');

    try {
      var snapshots = await D.loadData();
      if (!snapshots.length) {
        loading.innerHTML = '<div class="error-msg"><p>Aucune donnee disponible.</p></div>';
        return;
      }

      state.snapshots = snapshots;
      state.grouped = D.groupByDossier(snapshots);
      state.summaries = D.computeDossierSummaries(state.grouped);

      var urlFilters = F.readFiltersFromURL();
      state.filters.statut = urlFilters.statut;
      state.filters.prefecture = urlFilters.prefecture;
      state.filters.granularity = urlFilters.granularity || 'quarter';

      loading.style.display = 'none';
      main.style.display = 'block';

      initFilters();
      renderAll();

    } catch (error) {
      loading.innerHTML = '<div class="error-msg"><p>Erreur: ' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function initFilters() {
    var prefectures = D.getUniquePrefectures(state.summaries);
    F.createPrefectureDropdown('filter-prefecture-container', prefectures, state.filters.prefecture, function(v) {
      state.filters.prefecture = v; syncAndRender();
    });
    F.createStatusFilter('filter-status-container', state.filters.statut, function(v) {
      state.filters.statut = v; syncAndRender();
    });
    F.createGranularityToggle('filter-granularity-container', state.filters.granularity, function(v) {
      state.filters.granularity = v; syncAndRender();
    });
  }

  function syncAndRender() {
    F.writeFiltersToURL(state.filters);
    renderAll();
  }

  function getFiltered() {
    return D.applyFilters(state.summaries, state.filters);
  }

  function getGroupFn() {
    switch (state.filters.granularity) {
      case 'month': return U.groupByMonth;
      case 'semester': return U.groupBySemester;
      default: return U.groupByQuarter;
    }
  }

  function renderAll() {
    var filtered = getFiltered();
    document.getElementById('filter-count').textContent = filtered.length + ' dossier' + (filtered.length > 1 ? 's' : '');

    renderDepositTimeline(filtered);
    renderTrendChart(filtered);
    renderVelocityChart(filtered);
    renderCohortChart(filtered);
    renderCalendar();
    renderVolumeChart();
  }

  // ─── Deposit Timeline ────────────────────────────────────

  function renderDepositTimeline(filtered) {
    var canvas = document.getElementById('deposit-chart');
    var noData = document.getElementById('deposit-no-data');

    var withDeposit = filtered.filter(function(s) { return s.dateDepot; });
    if (!withDeposit.length) {
      canvas.style.display = 'none'; noData.style.display = 'block'; CH.destroy('deposit'); return;
    }

    canvas.style.display = 'block'; noData.style.display = 'none';

    var groups = getGroupFn()(withDeposit, 'dateDepot');
    var keys = Object.keys(groups).sort();
    var values = keys.map(function(k) { return groups[k].length; });

    var datasets = [{
      label: 'Depots',
      data: values,
      backgroundColor: 'rgba(59,130,246,0.3)',
      borderColor: '#3b82f6',
      borderWidth: 2,
      fill: true,
      tension: 0.3
    }];

    CH.create('deposit', 'deposit-chart', CH.lineConfig(keys, datasets, { ySuffix: '' }));
  }

  // ─── Duration Trend ──────────────────────────────────────

  function renderTrendChart(filtered) {
    var canvas = document.getElementById('trend-chart');
    var noData = document.getElementById('trend-no-data');

    var withData = filtered.filter(function(s) { return s.dateDepot && s.daysSinceDeposit != null; });
    if (!withData.length) {
      canvas.style.display = 'none'; noData.style.display = 'block'; CH.destroy('trend'); return;
    }

    canvas.style.display = 'block'; noData.style.display = 'none';

    var groups = getGroupFn()(withData, 'dateDepot');
    var keys = Object.keys(groups).sort();

    var avgValues = keys.map(function(k) {
      var items = groups[k];
      var sum = 0;
      for (var i = 0; i < items.length; i++) sum += items[i].daysSinceDeposit;
      return Math.round(sum / items.length);
    });

    var datasets = [{
      label: 'Duree moyenne (jours)',
      data: avgValues,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3
    }];

    CH.create('trend', 'trend-chart', CH.lineConfig(keys, datasets, { ySuffix: 'j' }));
  }

  // ─── Velocity ────────────────────────────────────────────

  function renderVelocityChart(filtered) {
    var canvas = document.getElementById('velocity-chart');
    var noData = document.getElementById('velocity-no-data');

    // Count transitions: snapshots where etape differs from previous for same dossier
    var hashes = new Set(filtered.map(function(s) { return s.fullHash; }));
    var transitions = [];

    state.grouped.forEach(function(snaps, hash) {
      if (!hashes.has(hash)) return;
      for (var i = 1; i < snaps.length; i++) {
        if (snaps[i].etape !== snaps[i-1].etape && snaps[i].created_at) {
          transitions.push({ created_at: snaps[i].created_at });
        }
      }
    });

    if (!transitions.length) {
      canvas.style.display = 'none'; noData.style.display = 'block'; CH.destroy('velocity'); return;
    }

    canvas.style.display = 'block'; noData.style.display = 'none';

    var groups = getGroupFn()(transitions, 'created_at');
    var keys = Object.keys(groups).sort();
    var values = keys.map(function(k) { return groups[k].length; });

    var datasets = [{
      label: 'Transitions',
      data: values,
      backgroundColor: 'rgba(139,92,246,0.5)',
      borderColor: '#8b5cf6',
      borderWidth: 1,
      borderRadius: 4
    }];

    var config = CH.barConfig(keys, datasets, { datalabels: false, ySuffix: '' });
    config.options.plugins.legend = { display: false };
    CH.create('velocity', 'velocity-chart', config);
  }

  // ─── Cohort Analysis ─────────────────────────────────────

  function renderCohortChart(filtered) {
    var canvas = document.getElementById('cohort-chart');
    var noData = document.getElementById('cohort-no-data');

    var cohorts = M.computeCohorts(filtered, state.filters.granularity);
    var keys = Object.keys(cohorts).sort();

    if (keys.length < 2) {
      canvas.style.display = 'none'; noData.style.display = 'block'; CH.destroy('cohort'); return;
    }

    canvas.style.display = 'block'; noData.style.display = 'none';

    var datasets = [
      {
        label: 'Atteint etape 6+',
        data: keys.map(function(k) { return cohorts[k].pctStep6; }),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.1)',
        tension: 0.3,
        fill: false
      },
      {
        label: 'Atteint etape 9+',
        data: keys.map(function(k) { return cohorts[k].pctStep9; }),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.1)',
        tension: 0.3,
        fill: false
      },
      {
        label: 'Atteint etape 12',
        data: keys.map(function(k) { return cohorts[k].pctStep12; }),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
        tension: 0.3,
        fill: false
      }
    ];

    var config = CH.lineConfig(keys, datasets, { ySuffix: '%' });
    config.options.scales.y.max = 100;
    CH.create('cohort', 'cohort-chart', config);
  }

  // ─── Activity Calendar ───────────────────────────────────

  function renderCalendar() {
    var container = document.getElementById('calendar-container');

    // Count snapshots per day
    var dayCounts = {};
    for (var i = 0; i < state.snapshots.length; i++) {
      var s = state.snapshots[i];
      if (!s.created_at) continue;
      var d = new Date(s.created_at);
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }

    var allDays = Object.keys(dayCounts).sort();
    if (!allDays.length) {
      container.innerHTML = '<p class="no-data">Pas de donnees</p>';
      return;
    }

    // Build 52 weeks of data ending at today
    var today = new Date();
    var startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364); // ~52 weeks
    // Move to Monday
    while (startDate.getDay() !== 1) startDate.setDate(startDate.getDate() - 1);

    var maxCount = Math.max.apply(null, Object.values(dayCounts));
    var dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

    // Build grid: 7 rows (Mon-Sun) x 52+ columns (weeks)
    var weeks = [];
    var current = new Date(startDate);
    var week = [];
    while (current <= today) {
      var dayKey = current.getFullYear() + '-' + String(current.getMonth()+1).padStart(2,'0') + '-' + String(current.getDate()).padStart(2,'0');
      var count = dayCounts[dayKey] || 0;
      var dow = current.getDay();
      dow = dow === 0 ? 6 : dow - 1; // Mon=0..Sun=6
      week[dow] = { count: count, date: dayKey };
      if (dow === 6) {
        weeks.push(week);
        week = [];
      }
      current.setDate(current.getDate() + 1);
    }
    if (week.length) weeks.push(week);

    var html = '<table class="calendar-table"><tbody>';
    for (var row = 0; row < 7; row++) {
      html += '<tr><td class="cal-label">' + dayNames[row] + '</td>';
      for (var col = 0; col < weeks.length; col++) {
        var cell = weeks[col][row];
        if (!cell) {
          html += '<td class="cal-empty"></td>';
        } else {
          var level = 'cal-empty';
          if (cell.count > 0) {
            var ratio = cell.count / maxCount;
            if (ratio > 0.75) level = 'cal-l4';
            else if (ratio > 0.5) level = 'cal-l3';
            else if (ratio > 0.25) level = 'cal-l2';
            else level = 'cal-l1';
          }
          html += '<td class="' + level + '" title="' + cell.date + ': ' + cell.count + ' obs."></td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ─── Volume Chart ────────────────────────────────────────

  function renderVolumeChart() {
    var canvas = document.getElementById('volume-chart');
    var noData = document.getElementById('volume-no-data');

    if (!state.snapshots.length) {
      canvas.style.display = 'none'; noData.style.display = 'block'; CH.destroy('volume'); return;
    }

    canvas.style.display = 'block'; noData.style.display = 'none';

    var groups = getGroupFn()(state.snapshots, 'created_at');
    var keys = Object.keys(groups).sort();
    var values = keys.map(function(k) { return groups[k].length; });

    var datasets = [{
      label: 'Snapshots',
      data: values,
      backgroundColor: 'rgba(16,185,129,0.5)',
      borderColor: '#10b981',
      borderWidth: 1,
      borderRadius: 4
    }];

    var config = CH.barConfig(keys, datasets, { datalabels: false, ySuffix: '' });
    config.options.plugins.legend = { display: false };
    CH.create('volume', 'volume-chart', config);
  }

})();
