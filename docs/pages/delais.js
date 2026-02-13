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
    F.createStatusFilter('filter-status-container', state.filters.statut, function(v) {
      state.filters.statut = v; syncAndRender();
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

    var durations = D.computeDurationByStatus(filteredSnapshots);

    renderDurationBarChart(durations);
    renderPercentileTable(durations);
    renderCumulativeCurve(durations);
    renderDurationTable(durations);
  }

  // ─── Estimator ───────────────────────────────────────────

  var estimatorStatut = 'verification_formelle_a_traiter';

  function initEstimator(prefectures) {
    ANEF.ui.createStatusSelect('estimator-status-container', {
      includeAll: false,
      defaultValue: 'verification_formelle_a_traiter',
      placeholder: 'Rechercher votre statut...',
      onChange: function(statusCode) {
        estimatorStatut = statusCode;
        updateEstimator();
      }
    });

    var prefSelect = document.getElementById('estimator-prefecture');
    for (var j = 0; j < prefectures.length; j++) {
      var opt = document.createElement('option');
      opt.value = prefectures[j];
      opt.textContent = prefectures[j];
      prefSelect.appendChild(opt);
    }
    prefSelect.addEventListener('change', updateEstimator);

    updateEstimator();
  }

  function updateEstimator() {
    var statut = estimatorStatut;
    var pref = document.getElementById('estimator-prefecture').value || null;
    var currentInfo = C.STATUTS[statut];
    var currentRang = currentInfo ? currentInfo.rang : 0;

    // Collect all snapshots, optionally filtered by prefecture
    var snaps = state.snapshots;
    if (pref) {
      var prefHashes = {};
      for (var p = 0; p < state.summaries.length; p++) {
        if (state.summaries[p].prefecture === pref) prefHashes[state.summaries[p].fullHash] = true;
      }
      snaps = snaps.filter(function(s) { return prefHashes[s.dossier_hash]; });
    }

    // Group days since deposit by rang
    var byRang = {};
    for (var i = 0; i < snaps.length; i++) {
      var sn = snaps[i];
      if (!sn.date_depot || !sn.date_statut || !sn.etape) continue;
      var d = U.daysDiff(sn.date_depot, sn.date_statut);
      if (d === null) continue;
      var snStatut = sn.statut ? sn.statut.toLowerCase() : '';
      var snInfo = snStatut ? C.STATUTS[snStatut] : null;
      var snRang = snInfo ? snInfo.rang : (sn.etape * 100);
      if (!byRang[snRang]) byRang[snRang] = [];
      byRang[snRang].push(d);
    }

    var currentDays = byRang[currentRang] || [];

    // Collect all target days from rangs beyond current
    var targetDays = [];
    var rangs = Object.keys(byRang).map(Number).sort(function(a, b) { return a - b; });
    for (var e = 0; e < rangs.length; e++) {
      if (rangs[e] > currentRang) {
        targetDays = targetDays.concat(byRang[rangs[e]]);
      }
    }

    var confEl = document.getElementById('est-confidence');

    if (!currentDays.length || !targetDays.length) {
      U.setText('est-p25', '\u2014');
      U.setText('est-p50', '\u2014');
      U.setText('est-p75', '\u2014');
      confEl.innerHTML = '<span class="confidence-dot confidence-low"></span> Pas assez de donn\u00e9es pour cette estimation';
      return;
    }

    // Conditional remaining time estimation:
    // For each target dossier, compute excess over current median.
    // Keep only positive diffs (dossiers that took longer than your current median).
    // This avoids selection bias where fast-completing dossiers skew the estimate to 0.
    var medianCurrent = M.percentile(currentDays, 50);
    var remainingDays = [];
    for (var t = 0; t < targetDays.length; t++) {
      var diff = targetDays[t] - medianCurrent;
      if (diff > 0) remainingDays.push(diff);
    }

    // Fallback: if too few positive diffs, use all diffs clamped to 0
    if (remainingDays.length < 3) {
      remainingDays = [];
      for (var t2 = 0; t2 < targetDays.length; t2++) {
        remainingDays.push(Math.max(0, targetDays[t2] - medianCurrent));
      }
    }

    if (!remainingDays.length) {
      U.setText('est-p25', '\u2014');
      U.setText('est-p50', '\u2014');
      U.setText('est-p75', '\u2014');
      confEl.innerHTML = '<span class="confidence-dot confidence-low"></span> Pas assez de donn\u00e9es pour cette estimation';
      return;
    }

    var remainP25 = Math.round(M.percentile(remainingDays, 25));
    var remainP50 = Math.round(M.percentile(remainingDays, 50));
    var remainP75 = Math.round(M.percentile(remainingDays, 75));

    U.setText('est-p25', U.formatDuration(remainP25));
    U.setText('est-p50', U.formatDuration(remainP50));
    U.setText('est-p75', U.formatDuration(remainP75));

    var totalSample = currentDays.length + targetDays.length;
    var confidence = totalSample >= 15 ? 'high' : totalSample >= 6 ? 'medium' : 'low';
    var cls = confidence === 'high' ? 'confidence-high' : confidence === 'medium' ? 'confidence-medium' : 'confidence-low';
    var label = confidence === 'high' ? 'Fiabilit\u00e9 \u00e9lev\u00e9e' : confidence === 'medium' ? 'Fiabilit\u00e9 moyenne' : 'Fiabilit\u00e9 faible';
    confEl.innerHTML = '<span class="confidence-dot ' + cls + '"></span> ' + label +
      ' \u2014 bas\u00e9 sur ' + currentDays.length + ' dossier' + (currentDays.length > 1 ? 's' : '') +
      ' \u00e0 votre statut et ' + targetDays.length + ' dossier' + (targetDays.length > 1 ? 's' : '') + ' plus avanc\u00e9' + (targetDays.length > 1 ? 's' : '');
  }

  // Short names for step 9 sub-statuts
  var STEP9_SHORT = {
    'controle_a_affecter': 'SDANF aff.',
    'controle_a_effectuer': 'SDANF ctrl',
    'controle_en_attente_pec': 'SCEC trans.',
    'controle_pec_a_faire': 'SCEC v\u00e9rif.'
  };

  /** Build label — for step 9 sub-statuts show detailed name */
  function labelWithStatus(d) {
    if (d.statut && STEP9_SHORT[d.statut]) {
      var sub = C.formatSubStep(d.rang);
      return sub + '. ' + d.phase + ' (' + d.statut + ')';
    }
    return d.etape + '. ' + d.phase;
  }

  /** Short label for chart axes */
  function shortLabel(d) {
    if (d.statut && STEP9_SHORT[d.statut]) {
      return C.formatSubStep(d.rang) + '. ' + STEP9_SHORT[d.statut];
    }
    return d.etape + '. ' + d.phase;
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

    var isMobile = window.innerWidth < 768;
    var chartLabels = durations.map(shortLabel);
    var fullLabels = durations.map(labelWithStatus);
    var step9Colors = { 'controle_a_affecter': '#f59e0b', 'controle_a_effectuer': '#d97706', 'controle_en_attente_pec': '#b45309', 'controle_pec_a_faire': '#92400e' };
    var colors = durations.map(function(d) {
      if (d.statut && step9Colors[d.statut]) return step9Colors[d.statut];
      return C.STEP_COLORS[d.etape] || C.STEP_COLORS[0];
    });

    var avgValues = durations.map(function(d) { return d.avg_days; });
    var medValues = durations.map(function(d) { return d.median_days; });

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
        label: 'Typique (jours)',
        data: medValues,
        backgroundColor: '#f59e0b55',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4
      }
    ];

    var config = CH.barConfig(chartLabels, datasets, { suffix: 'j', ySuffix: 'j', datalabels: isMobile ? false : undefined });
    // Use full labels in tooltips
    config.options.plugins.tooltip = config.options.plugins.tooltip || {};
    config.options.plugins.tooltip.callbacks = config.options.plugins.tooltip.callbacks || {};
    config.options.plugins.tooltip.callbacks.title = function(items) {
      return fullLabels[items[0].dataIndex] || items[0].label;
    };
    // Mobile: rotate labels more, smaller font
    if (isMobile) {
      config.options.scales.x.ticks.maxRotation = 65;
      config.options.scales.x.ticks.font = { size: 9 };
    }
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

    var isMobile = window.innerWidth < 768;
    var chartLabels = durations.map(shortLabel);
    var fullLabels = durations.map(labelWithStatus);

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
      { label: 'Optimiste (rapide)', data: cumP25, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: false, tension: 0.3 },
      { label: 'Typique', data: cumP50, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: false, tension: 0.3, borderWidth: 3 },
      { label: 'Pessimiste (lent)', data: cumP75, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: false, tension: 0.3 }
    ];

    var config = CH.lineConfig(chartLabels, datasets, { ySuffix: 'j' });
    // Use full labels in tooltips
    config.options.plugins.tooltip = config.options.plugins.tooltip || {};
    config.options.plugins.tooltip.callbacks = config.options.plugins.tooltip.callbacks || {};
    config.options.plugins.tooltip.callbacks.title = function(items) {
      return fullLabels[items[0].dataIndex] || items[0].label;
    };
    // Mobile: compact legend + smaller axis font
    if (isMobile) {
      config.options.scales.x.ticks.maxRotation = 65;
      config.options.scales.x.ticks.font = { size: 9 };
      config.options.plugins.legend.labels.font = { size: 10 };
      config.options.plugins.legend.labels.boxWidth = 12;
    }
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
