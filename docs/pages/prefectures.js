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
    filters: { statut: 'all', prefecture: 'all' },
    tableSort: { col: 'avg_days', dir: 'desc' },
    tablePage: 1,
    tablePageSize: 10
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
      state.filters.prefecture = urlFilters.prefecture;

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
    // Build unique sorted prefecture list
    var prefSet = {};
    for (var i = 0; i < state.summaries.length; i++) {
      var p = state.summaries[i].prefecture;
      if (p) prefSet[p] = true;
    }
    var prefList = Object.keys(prefSet).sort();

    F.createPrefectureMultiSelect('filter-prefecture-container', prefList, state.filters.prefecture, function(v) {
      state.filters.prefecture = v; state.tablePage = 1; syncAndRender();
    });
    F.createStatusFilter('filter-status-container', state.filters.statut, function(v) {
      state.filters.statut = v; syncAndRender();
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

    document.getElementById('filter-count').textContent = filtered.length + ' dossiers, ' + prefStats.length + ' préfectures';

    renderRankingTable(prefStats);
    renderBarChart(prefStats);
    renderHeatmap(filtered, prefStats);
    renderStackedBar(prefStats, filtered);
  }

  // ─── Ranking Table ───────────────────────────────────────

  function renderRankingTable(prefStats) {
    var toolbar = document.getElementById('ranking-toolbar');
    var tbody = document.getElementById('ranking-tbody');
    if (!prefStats.length) {
      toolbar.style.display = 'none';
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

    // Pagination
    var total = data.length;
    var pageSize = state.tablePageSize;
    var totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    state.tablePage = Math.min(state.tablePage, totalPages);
    var pageData = pageSize > 0 ? data.slice((state.tablePage - 1) * pageSize, state.tablePage * pageSize) : data;

    toolbar.style.display = 'flex';
    document.getElementById('ranking-count').textContent = total + ' préfecture' + (total > 1 ? 's' : '');
    document.getElementById('ranking-page-info').textContent = state.tablePage + '/' + totalPages;
    document.getElementById('ranking-btn-prev').disabled = state.tablePage <= 1;
    document.getElementById('ranking-btn-next').disabled = state.tablePage >= totalPages;

    // Sync sort select
    var sortSel = document.getElementById('ranking-sort');
    var sortVal = col + '-' + dir;
    if (sortSel.value !== sortVal) {
      for (var si = 0; si < sortSel.options.length; si++) {
        if (sortSel.options[si].value === sortVal) { sortSel.value = sortVal; break; }
      }
    }

    // Find max values for color bars
    var maxAvg = Math.max.apply(null, data.map(function(p) { return p.avg_days || 0; }));

    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      var p = pageData[i];
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
    // Apply default sort indicator
    ths.forEach(function(th) {
      if (th.dataset.col === state.tableSort.col) {
        th.classList.add('sort-' + state.tableSort.dir);
      }
    });
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
        state.tablePage = 1;
        renderAll();
      });
    });

    // Toolbar sort select
    document.getElementById('ranking-sort').addEventListener('change', function(e) {
      var parts = e.target.value.split('-');
      state.tableSort.col = parts[0];
      state.tableSort.dir = parts[1];
      ths.forEach(function(t) { t.classList.remove('sort-asc', 'sort-desc'); });
      ths.forEach(function(t) {
        if (t.dataset.col === state.tableSort.col) t.classList.add('sort-' + state.tableSort.dir);
      });
      state.tablePage = 1;
      renderAll();
    });

    // Page size
    document.getElementById('ranking-page-size').addEventListener('change', function(e) {
      state.tablePageSize = parseInt(e.target.value, 10);
      state.tablePage = 1;
      renderAll();
    });

    // Pagination
    document.getElementById('ranking-btn-prev').addEventListener('click', function() {
      if (state.tablePage > 1) { state.tablePage--; renderAll(); }
    });
    document.getElementById('ranking-btn-next').addEventListener('click', function() {
      var filtered = getFiltered();
      var prefStats = D.computePrefectureStats(filtered);
      var pageSize = state.tablePageSize;
      var totalPages = pageSize > 0 ? Math.ceil(prefStats.length / pageSize) : 1;
      if (state.tablePage < totalPages) { state.tablePage++; renderAll(); }
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

    var isMobile = window.innerWidth < 768;

    var labels = withDays.map(function(p) {
      var name = p.prefecture;
      // Shorten long names on mobile
      if (isMobile && name.length > 20) {
        name = name.replace(/^(Pr[ée]fecture|Sous-Pr[ée]fecture)\s+(de\s+la|de\s+l'|des|du|de)\s+/i, '');
        if (!name) name = p.prefecture;
      }
      return name;
    });
    var values = withDays.map(function(p) { return p.avg_days; });

    // Global average
    var globalAvg = values.reduce(function(a, b) { return a + b; }, 0) / values.length;

    var colors = withDays.map(function(p) {
      return p.avg_days < globalAvg ? '#10b981' : '#ef4444';
    });

    // Adjust container height based on number of bars
    var barHeight = isMobile ? 32 : 35;
    var container = document.getElementById('bar-chart-container');
    var totalH = Math.max(400, withDays.length * barHeight);
    container.style.minHeight = totalH + 'px';

    var config = CH.horizontalBarConfig(labels, values, colors, { suffix: 'j' });

    // Mobile: smaller font, show value at end of bar
    if (isMobile) {
      config.options.scales.y.ticks.font = { size: 10 };
      config.options.layout = { padding: { right: 40 } };
      config.options.plugins.datalabels = {
        color: '#e2e8f0',
        font: { size: 9, weight: 'bold' },
        anchor: 'end',
        align: 'right',
        formatter: function(v) { return v + 'j'; }
      };
      config.plugins = [ChartDataLabels];
    }

    CH.create('prefectureBar', 'prefecture-bar-chart', config);
  }

  // ─── Heatmap ─────────────────────────────────────────────

  // Heatmap columns: steps 1-8, then 4 sub-statuts for step 9, then 10-12
  var STEP9_STATUTS = D.STEP9_STATUTS;
  var HEATMAP_COLS = [
    { key: 1, label: 'Brouillon', title: C.PHASE_NAMES[1] },
    { key: 2, label: 'D\u00e9p\u00f4t', title: C.PHASE_NAMES[2] },
    { key: 3, label: 'V\u00e9rif.', title: C.PHASE_NAMES[3] },
    { key: 4, label: 'Affect.', title: C.PHASE_NAMES[4] },
    { key: 5, label: 'Instruct.', title: C.PHASE_NAMES[5] },
    { key: 6, label: 'Compl\u00e9t.', title: C.PHASE_NAMES[6] },
    { key: 7, label: 'Entretien', title: C.PHASE_NAMES[7] },
    { key: 8, label: 'D\u00e9cision', title: C.PHASE_NAMES[8] },
    { key: 'controle_a_affecter', label: 'CAA', title: 'Arriv\u00e9 \u00e0 la SDANF, attente affectation' },
    { key: 'controle_a_effectuer', label: 'CAE', title: 'Contr\u00f4le minist\u00e9riel en cours' },
    { key: 'controle_en_attente_pec', label: 'CEAP', title: 'Transmis au SCEC de Nantes' },
    { key: 'controle_pec_a_faire', label: 'CPAF', title: 'V\u00e9rification d\u2019\u00e9tat civil en cours' },
    { key: 10, label: 'D\u00e9cret', title: C.PHASE_NAMES[10] },
    { key: 11, label: 'Publi.', title: C.PHASE_NAMES[11] },
    { key: 12, label: 'Cl\u00f4ture', title: C.PHASE_NAMES[12] }
  ];

  function renderHeatmap(filtered, prefStats) {
    var container = document.getElementById('heatmap-container');

    if (!prefStats.length) {
      container.innerHTML = '<p class="no-data">Pas de donn\u00e9es</p>';
      return;
    }

    // Build matrix: prefecture x (step or statut for step 9) => days[]
    var matrix = {};
    var allHashes = new Set(filtered.map(function(s) { return s.fullHash; }));
    var relevantSnaps = state.snapshots.filter(function(s) { return allHashes.has(s.dossier_hash); });

    for (var i = 0; i < relevantSnaps.length; i++) {
      var s = relevantSnaps[i];
      var pref = D.normalizePrefecture(s.prefecture);
      if (!pref || !s.date_depot || !s.date_statut) continue;
      var days = U.daysDiff(s.date_depot, s.date_statut);
      if (days === null || days < 0) continue;

      var sLower = s.statut ? s.statut.toLowerCase() : '';
      if (Number(s.etape) === 9 && sLower && STEP9_STATUTS.indexOf(sLower) !== -1) {
        var sKey = pref + '|' + sLower;
        if (!matrix[sKey]) matrix[sKey] = [];
        matrix[sKey].push(days);
      } else {
        var eKey = pref + '|' + s.etape;
        if (!matrix[eKey]) matrix[eKey] = [];
        matrix[eKey].push(days);
      }
    }

    // Find global max for color scaling
    var globalMax = 0;
    var mKeys = Object.keys(matrix);
    for (var k = 0; k < mKeys.length; k++) {
      var arr = matrix[mKeys[k]];
      var avg = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
      if (avg > globalMax) globalMax = avg;
    }

    var prefs = prefStats.map(function(p) { return p.prefecture; });

    // Filter out columns with no data at all
    var activeCols = HEATMAP_COLS.filter(function(col) {
      for (var p = 0; p < prefs.length; p++) {
        if (matrix[prefs[p] + '|' + col.key]) return true;
      }
      return false;
    });

    // Filter out rows with no data in any active column
    var activePrefs = prefs.filter(function(pref) {
      for (var c = 0; c < activeCols.length; c++) {
        if (matrix[pref + '|' + activeCols[c].key]) return true;
      }
      return false;
    });

    if (!activeCols.length || !activePrefs.length) {
      container.innerHTML = '<p class="no-data">Pas assez de donn\u00e9es pour la heatmap</p>';
      return;
    }

    var html = '<table class="heatmap-table"><thead><tr><th></th>';
    for (var c = 0; c < activeCols.length; c++) {
      var col = activeCols[c];
      var thTitle = col.title ? ' title="' + col.title + '"' : '';
      html += '<th' + thTitle + '>' + col.label + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var p = 0; p < activePrefs.length; p++) {
      html += '<tr><td class="hm-label">' + U.escapeHtml(activePrefs[p]) + '</td>';
      for (var c2 = 0; c2 < activeCols.length; c2++) {
        var colKey = activeCols[c2].key;
        var cellKey = activePrefs[p] + '|' + colKey;
        var cellData = matrix[cellKey];
        if (cellData && cellData.length) {
          var cellAvg = Math.round(cellData.reduce(function(a, b) { return a + b; }, 0) / cellData.length);
          var intensity = globalMax > 0 ? cellAvg / globalMax : 0;
          var r = Math.round(intensity * 239 + (1 - intensity) * 16);
          var g = Math.round((1 - intensity) * 185 + intensity * 68);
          var b2 = Math.round((1 - intensity) * 129 + intensity * 68);
          var tipLabel = activeCols[c2].title || ('\u00e9tape ' + colKey);
          html += '<td class="hm-cell" style="background:rgba(' + r + ',' + g + ',' + b2 + ',0.7);color:#fff" title="' + activePrefs[p] + ' ' + tipLabel + ': ' + cellAvg + 'j (n=' + cellData.length + ')">' + cellAvg + '</td>';
        } else {
          html += '<td class="hm-cell" style="background:rgba(255,255,255,0.03);color:var(--text-dim)">\u2014</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ─── Stacked Bar ─────────────────────────────────────────

  // Series definition for stacked bar: steps 1-8, 4 sub-statuts for step 9, 10-12
  var STACKED_SERIES = [
    { step: 1, label: '1. ' + C.PHASE_NAMES[1], color: C.STEP_COLORS[1] },
    { step: 2, label: '2. ' + C.PHASE_NAMES[2], color: C.STEP_COLORS[2] },
    { step: 3, label: '3. ' + C.PHASE_NAMES[3], color: C.STEP_COLORS[3] },
    { step: 4, label: '4. ' + C.PHASE_NAMES[4], color: C.STEP_COLORS[4] },
    { step: 5, label: '5. ' + C.PHASE_NAMES[5], color: C.STEP_COLORS[5] },
    { step: 6, label: '6. ' + C.PHASE_NAMES[6], color: C.STEP_COLORS[6] },
    { step: 7, label: '7. ' + C.PHASE_NAMES[7], color: C.STEP_COLORS[7] },
    { step: 8, label: '8. ' + C.PHASE_NAMES[8], color: C.STEP_COLORS[8] },
    { step: 9, statut: 'controle_a_affecter', label: '9.1 SDANF aff.', color: '#f59e0b' },
    { step: 9, statut: 'controle_a_effectuer', label: '9.2 SDANF ctrl', color: '#d97706' },
    { step: 9, statut: 'controle_en_attente_pec', label: '9.3 SCEC trans.', color: '#b45309' },
    { step: 9, statut: 'controle_pec_a_faire', label: '9.4 SCEC v\u00e9rif.', color: '#92400e' },
    { step: 10, label: '10. ' + C.PHASE_NAMES[10], color: C.STEP_COLORS[10] },
    { step: 11, label: '11. ' + C.PHASE_NAMES[11], color: C.STEP_COLORS[11] },
    { step: 12, label: '12. ' + C.PHASE_NAMES[12], color: C.STEP_COLORS[12] }
  ];

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

    // Init counts for each series
    var seriesCounts = [];
    for (var si = 0; si < STACKED_SERIES.length; si++) {
      var counts = {};
      for (var j = 0; j < prefNames.length; j++) counts[prefNames[j]] = 0;
      seriesCounts.push(counts);
    }

    for (var i = 0; i < filtered.length; i++) {
      var s = filtered[i];
      if (!s.prefecture) continue;
      var sStatutLower = s.statut ? s.statut.toLowerCase() : '';
      var matched = false;
      for (var si2 = 0; si2 < STACKED_SERIES.length; si2++) {
        var ser = STACKED_SERIES[si2];
        if (ser.statut) {
          // Step 9 sub-statut match (lowercase comparison)
          if (s.currentStep === 9 && sStatutLower === ser.statut && seriesCounts[si2][s.prefecture] !== undefined) {
            seriesCounts[si2][s.prefecture]++;
            matched = true;
            break;
          }
        } else if (s.currentStep === ser.step && s.currentStep !== 9) {
          if (seriesCounts[si2][s.prefecture] !== undefined) {
            seriesCounts[si2][s.prefecture]++;
          }
          matched = true;
          break;
        }
      }
      // Step 9 dossiers with unknown statut — put in first step-9 bucket
      if (!matched && s.currentStep === 9) {
        var idx9 = 8; // index of first step-9 series
        if (seriesCounts[idx9][s.prefecture] !== undefined) {
          seriesCounts[idx9][s.prefecture]++;
        }
      }
    }

    var datasets = [];
    for (var si3 = 0; si3 < STACKED_SERIES.length; si3++) {
      var data = prefNames.map(function(p) { return seriesCounts[si3][p]; });
      datasets.push({
        label: STACKED_SERIES[si3].label,
        data: data,
        backgroundColor: STACKED_SERIES[si3].color + 'cc',
        borderColor: STACKED_SERIES[si3].color,
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
