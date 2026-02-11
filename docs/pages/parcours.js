/**
 * pages/parcours.js — Analyse de parcours
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
    filters: { prefecture: 'all', outcome: 'all' }
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

      var urlFilters = F.readFiltersFromURL();
      state.filters.prefecture = urlFilters.prefecture;
      state.filters.outcome = urlFilters.outcome;

      loading.style.display = 'none';
      main.style.display = 'block';

      initFilters();
      initSurvivalControls();
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

  function getFilteredGrouped(filtered) {
    var hashes = new Set(filtered.map(function(s) { return s.fullHash; }));
    var result = new Map();
    state.grouped.forEach(function(snaps, hash) {
      if (hashes.has(hash)) result.set(hash, snaps);
    });
    return result;
  }

  function renderAll() {
    var filtered = getFiltered();
    var filteredGrouped = getFilteredGrouped(filtered);

    document.getElementById('filter-count').textContent = filtered.length + ' dossier' + (filtered.length > 1 ? 's' : '');

    renderFunnel(filtered);
    renderTransitionTable(filteredGrouped);
    renderBottlenecks(filtered);
    renderSurvivalCurve(filteredGrouped);
    renderComplementImpact(filtered);
    renderFlowDiagram(filteredGrouped);
  }

  // ─── Funnel ──────────────────────────────────────────────

  function renderFunnel(filtered) {
    var container = document.getElementById('funnel-container');
    if (!filtered.length) {
      container.innerHTML = '<p class="no-data">Aucun dossier</p>';
      return;
    }

    var ranges = [
      { label: 'Étapes 1-2 (Dépôt)', min: 1, max: 2, color: '#6b7280' },
      { label: 'Étapes 3-5 (Instruction)', min: 3, max: 5, color: '#3b82f6' },
      { label: 'Étapes 6-8 (Entretien)', min: 6, max: 8, color: '#8b5cf6' },
      { label: 'Étapes 9-11 (Contrôle)', min: 9, max: 11, color: '#f59e0b' },
      { label: 'Étape 12 (Finalisé)', min: 12, max: 12, color: '#10b981' }
    ];

    // Count dossiers that have reached at least this range
    var counts = ranges.map(function(r) {
      return filtered.filter(function(s) {
        // Has any step >= r.min
        for (var i = 0; i < s.stepsTraversed.length; i++) {
          if (s.stepsTraversed[i] >= r.min) return true;
        }
        return false;
      }).length;
    });

    var maxCount = counts[0] || 1;
    var html = '';

    for (var i = 0; i < ranges.length; i++) {
      var pct = Math.round(counts[i] / maxCount * 100);
      var barWidth = Math.max(pct, 5);
      html += '<div class="funnel-step">' +
        '<span class="funnel-label">' + ranges[i].label + '</span>' +
        '<div class="funnel-bar-wrapper">' +
          '<div class="funnel-bar" style="width:' + barWidth + '%;background:' + ranges[i].color + '">' + counts[i] + '</div>' +
        '</div>' +
        '<span class="funnel-pct">' + pct + '%</span>' +
      '</div>';

      if (i < ranges.length - 1 && counts[i] > 0) {
        var drop = counts[i] - counts[i + 1];
        var dropPct = Math.round(drop / counts[i] * 100);
        html += '<div class="funnel-drop">\u2193 -' + drop + ' (-' + dropPct + '%)</div>';
      }
    }

    container.innerHTML = html;
  }

  // ─── Transition Table ────────────────────────────────────

  function renderTransitionTable(grouped) {
    var transitions = D.computeTransitions(grouped);
    var tbody = document.getElementById('transition-tbody');

    if (!transitions.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">Pas de données</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      html += '<tr>' +
        '<td>' + t.from_etape + '. ' + U.escapeHtml(t.from_phase) + '</td>' +
        '<td>' + t.to_etape + '. ' + U.escapeHtml(t.to_phase) + '</td>' +
        '<td class="num">' + t.avg_days + ' j</td>' +
        '<td class="num">' + t.median_days + ' j</td>' +
        '<td class="num">' + t.min_days + ' j</td>' +
        '<td class="num">' + t.max_days + ' j</td>' +
        '<td class="num">' + t.count + '</td>' +
      '</tr>';
    }
    tbody.innerHTML = html;
  }

  // ─── Bottlenecks ─────────────────────────────────────────

  function renderBottlenecks(filtered) {
    var canvas = document.getElementById('bottleneck-chart');
    var noData = document.getElementById('bottleneck-no-data');

    // Group current dossiers by step and compute avg daysAtCurrentStatus
    var byStep = {};
    for (var i = 0; i < filtered.length; i++) {
      var s = filtered[i];
      if (s.daysAtCurrentStatus == null) continue;
      if (!byStep[s.currentStep]) byStep[s.currentStep] = [];
      byStep[s.currentStep].push(s.daysAtCurrentStatus);
    }

    var steps = Object.keys(byStep).map(Number).sort(function(a, b) { return a - b; });
    if (!steps.length) {
      canvas.style.display = 'none'; noData.style.display = 'block'; CH.destroy('bottleneck'); return;
    }

    canvas.style.display = 'block'; noData.style.display = 'none';

    var labels = steps.map(function(s) { return s + '. ' + C.PHASE_NAMES[s]; });
    var values = steps.map(function(s) {
      var arr = byStep[s];
      var sum = 0;
      for (var j = 0; j < arr.length; j++) sum += arr[j];
      return Math.round(sum / arr.length);
    });
    var colors = steps.map(function(s) { return C.STEP_COLORS[s]; });

    var datasets = [{
      label: 'Jours au statut actuel (moy.)',
      data: values,
      backgroundColor: colors.map(function(c) { return c + '99'; }),
      borderColor: colors,
      borderWidth: 1,
      borderRadius: 4
    }];

    var config = CH.barConfig(labels, datasets, { suffix: 'j', ySuffix: 'j', datalabels: false });
    config.options.plugins.legend = { display: false };
    CH.create('bottleneck', 'bottleneck-chart', config);
  }

  // ─── Survival Curves ────────────────────────────────────

  var survivalStep = 9; // default step for survival curve

  function initSurvivalControls() {
    ANEF.ui.createStatusSelect('survival-status-container', {
      includeAll: false,
      filterSteps: [3, 5, 7, 8, 9, 10],
      defaultValue: 'controle_a_effectuer',
      placeholder: 'Rechercher un statut...',
      onChange: function(statusCode, stepNumber) {
        survivalStep = stepNumber || 9;
        var filtered = getFiltered();
        var filteredGrouped = getFilteredGrouped(filtered);
        renderSurvivalCurve(filteredGrouped);
      }
    });
  }

  function renderSurvivalCurve(grouped) {
    var canvas = document.getElementById('survival-chart');
    var noData = document.getElementById('survival-no-data');
    var step = survivalStep;

    var curve = M.survivalCurve(null, state.snapshots, grouped, step);

    if (curve.length < 3) {
      canvas.style.display = 'none'; noData.style.display = 'block'; CH.destroy('survival'); return;
    }

    canvas.style.display = 'block'; noData.style.display = 'none';

    var labels = curve.map(function(p) { return p.days + 'j'; });
    var values = curve.map(function(p) { return p.pctRemaining; });

    var datasets = [{
      label: '% encore à l\'étape ' + step,
      data: values,
      borderColor: C.STEP_COLORS[step] || '#3b82f6',
      backgroundColor: (C.STEP_COLORS[step] || '#3b82f6') + '22',
      fill: true,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 1
    }];

    var config = CH.lineConfig(labels, datasets, { ySuffix: '%', beginAtZero: true });
    config.options.scales.y.max = 100;
    config.options.scales.x.title = { display: true, text: 'Jours à l\'étape', color: '#94a3b8' };
    CH.create('survival', 'survival-chart', config);
  }

  // ─── Complement Impact ───────────────────────────────────

  function renderComplementImpact(filtered) {
    var container = document.getElementById('complement-comparison');

    var withComp = filtered.filter(function(s) { return s.hasComplement; });
    var withoutComp = filtered.filter(function(s) { return !s.hasComplement; });

    function computeStats(arr) {
      if (!arr.length) return { count: 0, avgDays: '\u2014', avgStep: '\u2014', successRate: '\u2014' };
      var daysArr = arr.filter(function(s) { return s.daysSinceDeposit != null; });
      var avgDays = daysArr.length ? Math.round(daysArr.reduce(function(a, s) { return a + s.daysSinceDeposit; }, 0) / daysArr.length) : null;
      var stepSum = arr.reduce(function(a, s) { return a + s.currentStep; }, 0);
      var avgStep = U.round1(stepSum / arr.length);
      var step12 = arr.filter(function(s) { return s.currentStep === 12; });
      var positive = step12.filter(function(s) { return C.isPositiveStatus(s.statut); });
      var rate = step12.length > 0 ? Math.round(positive.length / step12.length * 100) : null;

      return {
        count: arr.length,
        avgDays: avgDays !== null ? avgDays + ' j' : '\u2014',
        avgStep: avgStep + '/12',
        successRate: rate !== null ? rate + '%' : '\u2014'
      };
    }

    var statsWith = computeStats(withComp);
    var statsWithout = computeStats(withoutComp);

    function card(title, stats, accent) {
      return '<div class="comparison-card">' +
        '<h4 style="color:' + accent + '">' + title + '</h4>' +
        '<div class="comparison-stat"><span class="cs-label">Dossiers</span><span class="cs-value">' + stats.count + '</span></div>' +
        '<div class="comparison-stat"><span class="cs-label">Durée moyenne</span><span class="cs-value">' + stats.avgDays + '</span></div>' +
        '<div class="comparison-stat"><span class="cs-label">Étape moyenne</span><span class="cs-value">' + stats.avgStep + '</span></div>' +
        '<div class="comparison-stat"><span class="cs-label">Taux succès</span><span class="cs-value">' + stats.successRate + '</span></div>' +
      '</div>';
    }

    container.innerHTML = card('Avec complément', statsWith, 'var(--orange)') + card('Sans complément', statsWithout, 'var(--green)');
  }

  // ─── Flow Diagram ───────────────────────────────────────

  function renderFlowDiagram(grouped) {
    var container = document.getElementById('flow-container');

    // Count transitions
    var transitionCounts = {};
    var maxCount = 0;

    grouped.forEach(function(snaps) {
      for (var i = 1; i < snaps.length; i++) {
        if (snaps[i].etape !== snaps[i-1].etape) {
          var key = snaps[i-1].etape + '-' + snaps[i].etape;
          transitionCounts[key] = (transitionCounts[key] || 0) + 1;
          if (transitionCounts[key] > maxCount) maxCount = transitionCounts[key];
        }
      }
    });

    if (!Object.keys(transitionCounts).length) {
      container.innerHTML = '<p class="no-data">Pas de transitions</p>';
      return;
    }

    // Build flow as connected steps
    var html = '';
    for (var step = 1; step <= 12; step++) {
      var color = C.STEP_COLORS[step];

      // Count dossiers at this step
      var atStep = 0;
      grouped.forEach(function(snaps) {
        for (var i = 0; i < snaps.length; i++) {
          if (snaps[i].etape === step) { atStep++; break; }
        }
      });

      html += '<div class="flow-column">' +
        '<div class="flow-node" style="background:' + color + '">' + step + '<br><small style="font-size:0.6rem;opacity:0.8">' + atStep + '</small></div>';

      // Draw connector to next step
      if (step < 12) {
        var nextKey = step + '-' + (step + 1);
        var count = transitionCounts[nextKey] || 0;
        var thickness = maxCount > 0 ? Math.max(2, Math.round(count / maxCount * 20)) : 2;

        html += '<div class="flow-connector" style="display:flex;align-items:center;justify-content:center">' +
          '<svg width="100%" height="' + (thickness + 10) + '" style="overflow:visible">' +
            '<line x1="0" y1="' + (thickness/2 + 5) + '" x2="100%" y2="' + (thickness/2 + 5) + '" stroke="' + color + '" stroke-width="' + thickness + '" stroke-opacity="0.6"/>' +
          '</svg>' +
        '</div>';

        if (count > 0) {
          html += '<div style="font-size:0.6rem;color:var(--text-dim);text-align:center">' + count + '</div>';
        }
      }

      html += '</div>';
    }

    container.innerHTML = html;
  }

})();
