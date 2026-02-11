/**
 * pages/delais.js — Analyse des delais
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
    transitionsDetailed: null,
    filters: {}
  };

  document.addEventListener('DOMContentLoaded', async function() {
    CH.registerDarkTheme();
    var loading = document.getElementById('loading');
    var main = document.getElementById('main-content');

    try {
      var snapshots = await D.loadData();
      if (!snapshots.length) {
        loading.innerHTML = '<div class="error-msg"><p>Aucune donnée disponible.</p></div>';
        return;
      }

      state.snapshots = snapshots;
      state.grouped = D.groupByDossier(snapshots);
      state.summaries = D.computeDossierSummaries(state.grouped);
      state.transitionsDetailed = M.computeTransitionsDetailed(state.grouped);
      state.filters = F.readFiltersFromURL();

      loading.style.display = 'none';
      main.style.display = 'block';

      var prefectures = D.getUniquePrefectures(state.summaries);
      initFilters(prefectures);
      initEstimator(prefectures);
      renderAll();

    } catch (error) {
      loading.innerHTML = '<div class="error-msg"><p>Erreur: ' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function initFilters(prefectures) {
    F.createPrefectureDropdown('filter-prefecture-container', prefectures, state.filters.prefecture, function(v) {
      state.filters.prefecture = v; syncAndRender();
    });
    F.createOutcomeFilter('filter-outcome-container', state.filters.outcome, function(v) {
      state.filters.outcome = v; syncAndRender();
    });
  }

  function syncAndRender() {
    F.writeFiltersToURL(state.filters);
    renderAll();
  }

  function getFiltered() {
    return D.applyFilters(state.summaries, state.filters);
  }

  function getFilteredSnapshots(filtered) {
    var hashes = filtered.map(function(s) { return s.fullHash; });
    return D.getSnapshotsForHashes(state.snapshots, hashes);
  }

  function renderAll() {
    var filtered = getFiltered();
    var filteredSnapshots = getFilteredSnapshots(filtered);

    var countEl = document.getElementById('filter-count');
    countEl.textContent = filtered.length + ' dossier' + (filtered.length > 1 ? 's' : '');

    var durations = D.computeDurationByStep(filteredSnapshots);

    renderDurationBarChart(durations);
    renderPercentileTable(durations);
    renderCumulativeCurve(durations);
    renderDurationTable(durations);
  }

  // ─── Estimator ───────────────────────────────────────────

  var estimatorStep = 3; // default step for estimator

  function initEstimator(prefectures) {
    var prefSelect = document.getElementById('estimator-prefecture');
    for (var i = 0; i < prefectures.length; i++) {
      var opt = document.createElement('option');
      opt.value = prefectures[i];
      opt.textContent = prefectures[i];
      prefSelect.appendChild(opt);
    }

    // Create searchable status select for estimator
    ANEF.ui.createStatusSelect('estimator-status-container', {
      includeAll: false,
      defaultValue: 'verification_formelle_a_traiter',
      placeholder: 'Rechercher un statut...',
      onChange: function(statusCode, stepNumber) {
        estimatorStep = stepNumber || 3;
        updateEstimator();
      }
    });

    prefSelect.addEventListener('change', updateEstimator);

    updateEstimator();
  }

  function updateEstimator() {
    var step = estimatorStep;
    var pref = document.getElementById('estimator-prefecture').value || null;

    var result = M.estimateRemainingDuration(step, pref, state.transitionsDetailed);

    if (result.p50 !== null) {
      U.setText('est-p25', U.formatDuration(result.p25));
      U.setText('est-p50', U.formatDuration(result.p50));
      U.setText('est-p75', U.formatDuration(result.p75));
    } else {
      U.setText('est-p25', '\u2014');
      U.setText('est-p50', '\u2014');
      U.setText('est-p75', '\u2014');
    }

    var confEl = document.getElementById('est-confidence');
    if (result.confidence === 'none') {
      confEl.innerHTML = '<span class="confidence-dot confidence-low"></span> Pas assez de données';
    } else {
      var cls = result.confidence === 'high' ? 'confidence-high' : result.confidence === 'medium' ? 'confidence-medium' : 'confidence-low';
      var label = result.confidence === 'high' ? 'Fiabilité élevée' : result.confidence === 'medium' ? 'Fiabilité moyenne' : 'Fiabilité faible';
      confEl.innerHTML = '<span class="confidence-dot ' + cls + '"></span> ' + label + ' (échantillon moy. ' + result.sampleSize + ')';
    }
  }

  /** Build label with most common status codes in parentheses */
  function labelWithStatus(d) {
    var label = d.etape + '. ' + d.phase;
    if (d.statuts) {
      var codes = Object.keys(d.statuts).sort(function(a, b) { return d.statuts[b] - d.statuts[a]; });
      if (codes.length === 1) {
        label += ' (' + codes[0] + ')';
      } else if (codes.length === 2) {
        label += ' (' + codes[0] + ', ' + codes[1] + ')';
      } else if (codes.length > 2) {
        label += ' (' + codes[0] + ', ' + codes[1] + '...)';
      }
    }
    return label;
  }

  // ─── Duration Bar Chart ──────────────────────────────────

  function renderDurationBarChart(durations) {
    var canvas = document.getElementById('duration-bar-chart');
    var noData = document.getElementById('duration-bar-no-data');

    if (!durations.length) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      CH.destroy('durationBar');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    var labels = durations.map(labelWithStatus);
    var colors = durations.map(function(d) { return C.STEP_COLORS[d.etape] || C.STEP_COLORS[0]; });

    // Compute P25/P75 for whiskers
    var avgValues = durations.map(function(d) { return d.avg_days; });
    var medValues = durations.map(function(d) { return d.median_days; });
    var p25Values = durations.map(function(d) { return d.days ? U.round1(M.percentile(d.days, 25)) : 0; });
    var p75Values = durations.map(function(d) { return d.days ? U.round1(M.percentile(d.days, 75)) : 0; });

    var datasets = [
      {
        label: 'Moyenne (jours)',
        data: avgValues,
        backgroundColor: colors.map(function(c) { return c + '99'; }),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: 'Médiane (jours)',
        data: medValues,
        backgroundColor: '#f59e0b55',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4
      }
    ];

    var config = CH.barConfig(labels, datasets, { suffix: 'j', ySuffix: 'j' });
    CH.create('durationBar', 'duration-bar-chart', config);
  }

  // ─── Percentile Table ────────────────────────────────────

  function renderPercentileTable(durations) {
    var tbody = document.getElementById('percentile-tbody');
    if (!durations.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">Pas de données</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < durations.length; i++) {
      var d = durations[i];
      var days = d.days || [];
      html += '<tr>' +
        '<td>' + U.escapeHtml(labelWithStatus(d)) + '</td>' +
        '<td class="num">' + (days.length ? Math.round(M.percentile(days, 10)) + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + (days.length ? Math.round(M.percentile(days, 25)) + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + (days.length ? Math.round(M.percentile(days, 50)) + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + (days.length ? Math.round(M.percentile(days, 75)) + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + (days.length ? Math.round(M.percentile(days, 90)) + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + d.count + '</td>' +
      '</tr>';
    }
    tbody.innerHTML = html;
  }

  // ─── Cumulative Curve ────────────────────────────────────

  function renderCumulativeCurve(durations) {
    var canvas = document.getElementById('cumulative-chart');
    var noData = document.getElementById('cumulative-no-data');

    if (durations.length < 2) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      CH.destroy('cumulative');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    var labels = durations.map(labelWithStatus);

    // Cumulative P25/P50/P75
    var cumP25 = [], cumP50 = [], cumP75 = [];
    var runP25 = 0, runP50 = 0, runP75 = 0;

    for (var i = 0; i < durations.length; i++) {
      var days = durations[i].days || [];
      if (days.length) {
        runP25 += M.percentile(days, 25);
        runP50 += M.percentile(days, 50);
        runP75 += M.percentile(days, 75);
      }
      cumP25.push(Math.round(runP25));
      cumP50.push(Math.round(runP50));
      cumP75.push(Math.round(runP75));
    }

    var datasets = [
      { label: 'P25 (optimiste)', data: cumP25, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: false, tension: 0.3 },
      { label: 'P50 (médiane)', data: cumP50, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: false, tension: 0.3, borderWidth: 3 },
      { label: 'P75 (pessimiste)', data: cumP75, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: false, tension: 0.3 }
    ];

    var config = CH.lineConfig(labels, datasets, { ySuffix: 'j' });
    CH.create('cumulative', 'cumulative-chart', config);
  }

  // ─── Duration Table ──────────────────────────────────────

  function renderDurationTable(durations) {
    var tbody = document.getElementById('duration-tbody');
    if (!durations.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="no-data">Pas de données</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < durations.length; i++) {
      var d = durations[i];
      var days = d.days || [];
      var minDays = days.length ? Math.min.apply(null, days) : null;
      var maxDays = days.length ? Math.max.apply(null, days) : null;
      html += '<tr>' +
        '<td>' + U.escapeHtml(labelWithStatus(d)) + '</td>' +
        '<td class="num">' + d.avg_days + ' j</td>' +
        '<td class="num">' + d.median_days + ' j</td>' +
        '<td class="num">' + (days.length ? Math.round(M.percentile(days, 25)) + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + (days.length ? Math.round(M.percentile(days, 75)) + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + (minDays !== null ? minDays + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + (maxDays !== null ? maxDays + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + d.count + '</td>' +
        '<td>' + U.daysToMonths(d.avg_days) + '</td>' +
      '</tr>';
    }
    tbody.innerHTML = html;
  }

})();
