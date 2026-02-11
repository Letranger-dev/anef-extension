/**
 * pages/prefectures.js — Comparaison prefectures
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
    filters: { statut: 'all', minSample: 1 },
    tableSort: { col: 'total', dir: 'desc' },
    radarSelections: ['', '', '']
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
      state.filters.statut = urlFilters.statut;
      state.filters.minSample = urlFilters.minSample;

      loading.style.display = 'none';
      main.style.display = 'block';

      initFilters();
      initTableSort();
      renderAll();

    } catch (error) {
      loading.innerHTML = '<div class="error-msg"><p>Erreur: ' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function initFilters() {
    F.createStatusFilter('filter-status-container', state.filters.statut, function(v) {
      state.filters.statut = v; syncAndRender();
    });
    F.createMinSampleSlider('filter-min-sample', state.filters.minSample, function(v) {
      state.filters.minSample = v; syncAndRender();
    });
  }

  function syncAndRender() {
    F.writeFiltersToURL(state.filters);
    renderAll();
  }

  function getFiltered() {
    return D.applyFilters(state.summaries, state.filters);
  }

  function renderAll() {
    var filtered = getFiltered();
    var prefStats = D.computePrefectureStats(filtered);
    // Apply min sample filter
    prefStats = prefStats.filter(function(p) { return p.total >= state.filters.minSample; });

    document.getElementById('filter-count').textContent = filtered.length + ' dossiers, ' + prefStats.length + ' préfectures';

    renderRankingTable(prefStats);
    renderBarChart(prefStats);
    renderHeatmap(filtered, prefStats);
    renderRadarControls(prefStats);
    renderStackedBar(prefStats, filtered);
  }

  // ─── Ranking Table ───────────────────────────────────────

  function renderRankingTable(prefStats) {
    var tbody = document.getElementById('ranking-tbody');
    if (!prefStats.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">Aucune préfecture</td></tr>';
      return;
    }

    // Sort
    var data = prefStats.slice();
    var col = state.tableSort.col;
    var dir = state.tableSort.dir;
    data.sort(function(a, b) {
      var va = a[col], vb = b[col];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va == null) va = -Infinity;
      if (vb == null) vb = -Infinity;
      return dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    // Find max values for color bars
    var maxAvg = Math.max.apply(null, data.map(function(p) { return p.avg_days || 0; }));

    var html = '';
    for (var i = 0; i < data.length; i++) {
      var p = data[i];
      var barPct = maxAvg > 0 && p.avg_days ? Math.round(p.avg_days / maxAvg * 100) : 0;
      var barColor = p.avg_days && maxAvg ? (p.avg_days < maxAvg * 0.5 ? 'var(--green)' : p.avg_days < maxAvg * 0.75 ? 'var(--orange)' : 'var(--red)') : 'var(--border)';

      html += '<tr>' +
        '<td>' + U.escapeHtml(p.prefecture) + '</td>' +
        '<td class="num">' + p.total + '</td>' +
        '<td class="num"><div style="display:flex;align-items:center;justify-content:flex-end;gap:0.5rem"><span>' + (p.avg_days != null ? p.avg_days + ' j' : '\u2014') + '</span><div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:' + barPct + '%;height:100%;background:' + barColor + ';border-radius:3px"></div></div></div></td>' +
        '<td class="num">' + (p.median_days != null ? p.median_days + ' j' : '\u2014') + '</td>' +
        '<td class="num">' + p.avg_step + '/12</td>' +
        '<td class="num">' + p.favorable_pct + '%</td>' +
        '<td class="num">' + p.complement_pct + '%</td>' +
      '</tr>';
    }
    tbody.innerHTML = html;
  }

  function initTableSort() {
    var ths = document.querySelectorAll('th.sortable');
    ths.forEach(function(th) {
      th.addEventListener('click', function() {
        var col = th.dataset.col;
        if (state.tableSort.col === col) {
          state.tableSort.dir = state.tableSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.tableSort.col = col;
          state.tableSort.dir = 'desc';
        }
        ths.forEach(function(t) { t.classList.remove('sort-asc', 'sort-desc'); });
        th.classList.add('sort-' + state.tableSort.dir);
        renderAll();
      });
    });
  }

  // ─── Horizontal Bar Chart ────────────────────────────────

  function renderBarChart(prefStats) {
    var canvas = document.getElementById('prefecture-bar-chart');
    var noData = document.getElementById('bar-no-data');

    var withDays = prefStats.filter(function(p) { return p.avg_days != null; });
    if (!withDays.length) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      CH.destroy('prefectureBar');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    // Sort by avg_days asc (fastest first)
    withDays.sort(function(a, b) { return a.avg_days - b.avg_days; });

    var labels = withDays.map(function(p) { return p.prefecture; });
    var values = withDays.map(function(p) { return p.avg_days; });

    // Global average
    var globalAvg = values.reduce(function(a, b) { return a + b; }, 0) / values.length;

    var colors = withDays.map(function(p) {
      return p.avg_days < globalAvg ? '#10b981' : '#ef4444';
    });

    // Adjust container height based on number of bars
    var container = document.getElementById('bar-chart-container');
    container.style.minHeight = Math.max(400, withDays.length * 35) + 'px';

    var config = CH.horizontalBarConfig(labels, values, colors, { suffix: 'j' });
    CH.create('prefectureBar', 'prefecture-bar-chart', config);
  }

  // ─── Heatmap ─────────────────────────────────────────────

  function renderHeatmap(filtered, prefStats) {
    var container = document.getElementById('heatmap-container');

    if (!prefStats.length) {
      container.innerHTML = '<p class="no-data">Pas de données</p>';
      return;
    }

    // Build matrix: prefecture x step => avg duration
    var matrix = {};
    var allHashes = new Set(filtered.map(function(s) { return s.fullHash; }));
    var relevantSnaps = state.snapshots.filter(function(s) { return allHashes.has(s.dossier_hash); });

    for (var i = 0; i < relevantSnaps.length; i++) {
      var s = relevantSnaps[i];
      var pref = s.prefecture;
      if (!pref || !s.date_depot || !s.date_statut) continue;
      var days = U.daysDiff(s.date_depot, s.date_statut);
      if (days === null || days < 0) continue;
      var key = pref + '|' + s.etape;
      if (!matrix[key]) matrix[key] = [];
      matrix[key].push(days);
    }

    // Find global max for color scaling
    var globalMax = 0;
    var keys = Object.keys(matrix);
    for (var k = 0; k < keys.length; k++) {
      var arr = matrix[keys[k]];
      var avg = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
      if (avg > globalMax) globalMax = avg;
    }

    var prefs = prefStats.map(function(p) { return p.prefecture; });
    var html = '<table class="heatmap-table"><thead><tr><th></th>';
    for (var step = 1; step <= 12; step++) {
      html += '<th>' + step + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var p = 0; p < prefs.length; p++) {
      html += '<tr><td class="hm-label">' + U.escapeHtml(prefs[p]) + '</td>';
      for (var step2 = 1; step2 <= 12; step2++) {
        var cellKey = prefs[p] + '|' + step2;
        var cellData = matrix[cellKey];
        if (cellData && cellData.length) {
          var cellAvg = Math.round(cellData.reduce(function(a, b) { return a + b; }, 0) / cellData.length);
          var intensity = globalMax > 0 ? cellAvg / globalMax : 0;
          // Green for fast, red for slow
          var r = Math.round(intensity * 239 + (1 - intensity) * 16);
          var g = Math.round((1 - intensity) * 185 + intensity * 68);
          var b2 = Math.round((1 - intensity) * 129 + intensity * 68);
          html += '<td class="hm-cell" style="background:rgba(' + r + ',' + g + ',' + b2 + ',0.7);color:#fff" title="' + prefs[p] + ' \u00e9tape ' + step2 + ': ' + cellAvg + 'j (n=' + cellData.length + ')">' + cellAvg + '</td>';
        } else {
          html += '<td class="hm-cell" style="background:rgba(255,255,255,0.03);color:var(--text-dim)">\u2014</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ─── Radar Chart ─────────────────────────────────────────

  function renderRadarControls(prefStats) {
    var container = document.getElementById('radar-controls');
    var prefNames = prefStats.map(function(p) { return p.prefecture; });

    var html = '';
    for (var i = 0; i < 3; i++) {
      html += '<select class="radar-select" data-idx="' + i + '">' +
        '<option value="">Préfecture ' + (i + 1) + '</option>';
      for (var j = 0; j < prefNames.length; j++) {
        var sel = state.radarSelections[i] === prefNames[j] ? ' selected' : '';
        html += '<option value="' + U.escapeHtml(prefNames[j]) + '"' + sel + '>' + U.escapeHtml(prefNames[j]) + '</option>';
      }
      html += '</select>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.radar-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        state.radarSelections[parseInt(sel.dataset.idx)] = sel.value;
        renderRadarChart(prefStats);
      });
    });

    renderRadarChart(prefStats);
  }

  function renderRadarChart(prefStats) {
    var canvas = document.getElementById('radar-chart');
    var noData = document.getElementById('radar-no-data');

    var selected = state.radarSelections.filter(function(s) { return s !== ''; });
    if (selected.length < 2) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      CH.destroy('radar');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    var radarColors = ['#3b82f6', '#10b981', '#f59e0b'];
    var radarLabels = ['Durée moy. (inv.)', 'Échantillon', 'Étape moy.', 'Taux complément (inv.)', 'Taux succès'];

    // Normalize values to 0-100
    var maxDays = Math.max.apply(null, prefStats.map(function(p) { return p.avg_days || 0; }));
    var maxTotal = Math.max.apply(null, prefStats.map(function(p) { return p.total; }));

    var datasets = [];
    for (var i = 0; i < selected.length; i++) {
      var pref = prefStats.find(function(p) { return p.prefecture === selected[i]; });
      if (!pref) continue;

      var daysScore = maxDays > 0 ? Math.round((1 - (pref.avg_days || 0) / maxDays) * 100) : 50;
      var totalScore = maxTotal > 0 ? Math.round(pref.total / maxTotal * 100) : 0;
      var stepScore = Math.round(pref.avg_step / 12 * 100);
      var compScore = Math.round((100 - pref.complement_pct));
      var successScore = Math.round(pref.favorable_pct);

      datasets.push({
        label: pref.prefecture,
        data: [daysScore, totalScore, stepScore, compScore, successScore],
        borderColor: radarColors[i],
        backgroundColor: radarColors[i] + '33',
        borderWidth: 2,
        pointBackgroundColor: radarColors[i]
      });
    }

    CH.create('radar', 'radar-chart', {
      type: 'radar',
      data: { labels: radarLabels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            grid: { color: '#1e293b' },
            angleLines: { color: '#1e293b' },
            ticks: { color: '#94a3b8', backdropColor: 'transparent' },
            pointLabels: { color: '#e2e8f0', font: { size: 11 } }
          }
        },
        plugins: {
          legend: { labels: { color: '#e2e8f0' } },
          datalabels: false
        }
      }
    });
  }

  // ─── Stacked Bar ─────────────────────────────────────────

  function renderStackedBar(prefStats, filtered) {
    var canvas = document.getElementById('stacked-chart');
    var noData = document.getElementById('stacked-no-data');

    if (!prefStats.length) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      CH.destroy('stacked');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    var prefNames = prefStats.map(function(p) { return p.prefecture; });

    // Count per prefecture per step
    var stepData = {};
    for (var step = 1; step <= 12; step++) {
      stepData[step] = {};
      for (var j = 0; j < prefNames.length; j++) stepData[step][prefNames[j]] = 0;
    }

    for (var i = 0; i < filtered.length; i++) {
      var s = filtered[i];
      if (s.prefecture && stepData[s.currentStep] && stepData[s.currentStep][s.prefecture] !== undefined) {
        stepData[s.currentStep][s.prefecture]++;
      }
    }

    var datasets = [];
    for (var step2 = 1; step2 <= 12; step2++) {
      var data = prefNames.map(function(p) { return stepData[step2][p]; });
      datasets.push({
        label: step2 + '. ' + C.PHASE_NAMES[step2],
        data: data,
        backgroundColor: C.STEP_COLORS[step2] + 'cc',
        borderColor: C.STEP_COLORS[step2],
        borderWidth: 1
      });
    }

    var config = CH.barConfig(prefNames, datasets, { stacked: true, datalabels: false, ySuffix: '' });
    config.options.plugins.legend = {
      position: 'bottom',
      labels: { color: '#e2e8f0', font: { size: 10 }, boxWidth: 12 }
    };
    CH.create('stacked', 'stacked-chart', config);
  }

})();
