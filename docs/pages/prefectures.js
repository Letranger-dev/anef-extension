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
    tablePageSize: 10,
    barPage: 1,
    barPageSize: 10,
    barSort: 'days-asc',
    hmPage: 1,
    hmPageSize: 10,
    hmSort: 'days-desc',
    distribPage: 1,
    distribPageSize: 10,
    distribSort: 'total-desc'
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
      initBarPagination();
      initHmPagination();
      initDistribPagination();
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
      state.filters.prefecture = v; state.tablePage = 1; state.barPage = 1; state.hmPage = 1; state.distribPage = 1; syncAndRender();
    });
    F.createStatusFilter('filter-status-container', state.filters.statut, function(v) {
      state.filters.statut = v; state.tablePage = 1; state.barPage = 1; state.hmPage = 1; state.distribPage = 1; syncAndRender();
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
    renderDistribTable(prefStats, filtered);
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
    var toolbar = document.getElementById('bar-toolbar');
    var canvas = document.getElementById('prefecture-bar-chart');
    var noData = document.getElementById('bar-no-data');

    var withDays = prefStats.filter(function(p) { return p.avg_days != null; });
    if (!withDays.length) {
      toolbar.style.display = 'none';
      canvas.style.display = 'none';
      noData.style.display = 'block';
      CH.destroy('prefectureBar');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    // Sort
    switch (state.barSort) {
      case 'days-desc':
        withDays.sort(function(a, b) { return b.avg_days - a.avg_days; }); break;
      case 'name-asc':
        withDays.sort(function(a, b) { return a.prefecture.localeCompare(b.prefecture); }); break;
      default: // days-asc
        withDays.sort(function(a, b) { return a.avg_days - b.avg_days; });
    }

    // Pagination
    var total = withDays.length;
    var ps = state.barPageSize;
    var totalPages = ps > 0 ? Math.max(1, Math.ceil(total / ps)) : 1;
    state.barPage = Math.min(state.barPage, totalPages);
    var pageData = ps > 0 ? withDays.slice((state.barPage - 1) * ps, state.barPage * ps) : withDays;

    toolbar.style.display = 'flex';
    document.getElementById('bar-count').textContent = total + ' pr\u00e9fecture' + (total > 1 ? 's' : '');
    document.getElementById('bar-page-info').textContent = state.barPage + '/' + totalPages;
    document.getElementById('bar-btn-prev').disabled = state.barPage <= 1;
    document.getElementById('bar-btn-next').disabled = state.barPage >= totalPages;

    var isMobile = window.innerWidth < 768;

    var labels = pageData.map(function(p) {
      var name = p.prefecture;
      if (isMobile && name.length > 20) {
        name = name.replace(/^(Pr[ée]fecture|Sous-Pr[ée]fecture)\s+(de\s+la|de\s+l'|des|du|de)\s+/i, '');
        if (!name) name = p.prefecture;
      }
      return name;
    });
    var values = pageData.map(function(p) { return p.avg_days; });

    // Global average (across ALL, not just page)
    var allValues = withDays.map(function(p) { return p.avg_days; });
    var globalAvg = allValues.reduce(function(a, b) { return a + b; }, 0) / allValues.length;

    var colors = pageData.map(function(p) {
      return p.avg_days < globalAvg ? '#10b981' : '#ef4444';
    });

    // Adjust container height based on number of bars on page
    var barHeight = isMobile ? 32 : 35;
    var container = document.getElementById('bar-chart-container');
    var totalH = Math.max(300, pageData.length * barHeight);
    container.style.minHeight = totalH + 'px';

    var config = CH.horizontalBarConfig(labels, values, colors, { suffix: 'j' });

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

  function initBarPagination() {
    document.getElementById('bar-sort').addEventListener('change', function(e) {
      state.barSort = e.target.value;
      state.barPage = 1;
      renderAll();
    });
    document.getElementById('bar-page-size').addEventListener('change', function(e) {
      state.barPageSize = parseInt(e.target.value, 10);
      state.barPage = 1;
      renderAll();
    });
    document.getElementById('bar-btn-prev').addEventListener('click', function() {
      if (state.barPage > 1) { state.barPage--; renderAll(); }
    });
    document.getElementById('bar-btn-next').addEventListener('click', function() {
      state.barPage++;
      renderAll();
    });
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
    var toolbar = document.getElementById('hm-toolbar');
    var container = document.getElementById('heatmap-container');

    if (!prefStats.length) {
      toolbar.style.display = 'none';
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

    // Build avg_days lookup from prefStats for sorting
    var prefAvg = {};
    for (var pa = 0; pa < prefStats.length; pa++) {
      prefAvg[prefStats[pa].prefecture] = prefStats[pa].avg_days || 0;
    }

    // Sort
    switch (state.hmSort) {
      case 'days-asc':
        activePrefs.sort(function(a, b) { return (prefAvg[a] || 0) - (prefAvg[b] || 0); }); break;
      case 'name-asc':
        activePrefs.sort(function(a, b) { return a.localeCompare(b); }); break;
      default: // days-desc
        activePrefs.sort(function(a, b) { return (prefAvg[b] || 0) - (prefAvg[a] || 0); });
    }

    if (!activeCols.length || !activePrefs.length) {
      toolbar.style.display = 'none';
      container.innerHTML = '<p class="no-data">Pas assez de donn\u00e9es pour la heatmap</p>';
      return;
    }

    // Pagination
    var total = activePrefs.length;
    var ps = state.hmPageSize;
    var totalPages = ps > 0 ? Math.max(1, Math.ceil(total / ps)) : 1;
    state.hmPage = Math.min(state.hmPage, totalPages);
    var pagePrefs = ps > 0 ? activePrefs.slice((state.hmPage - 1) * ps, state.hmPage * ps) : activePrefs;

    toolbar.style.display = 'flex';
    document.getElementById('hm-count').textContent = total + ' pr\u00e9fecture' + (total > 1 ? 's' : '');
    document.getElementById('hm-page-info').textContent = state.hmPage + '/' + totalPages;
    document.getElementById('hm-btn-prev').disabled = state.hmPage <= 1;
    document.getElementById('hm-btn-next').disabled = state.hmPage >= totalPages;

    var html = '<table class="heatmap-table"><thead><tr><th></th>';
    for (var c = 0; c < activeCols.length; c++) {
      var col = activeCols[c];
      var thTitle = col.title ? ' title="' + col.title + '"' : '';
      html += '<th' + thTitle + '>' + col.label + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var p = 0; p < pagePrefs.length; p++) {
      html += '<tr><td class="hm-label">' + U.escapeHtml(pagePrefs[p]) + '</td>';
      for (var c2 = 0; c2 < activeCols.length; c2++) {
        var colKey = activeCols[c2].key;
        var cellKey = pagePrefs[p] + '|' + colKey;
        var cellData = matrix[cellKey];
        if (cellData && cellData.length) {
          var cellAvg = Math.round(cellData.reduce(function(a, b) { return a + b; }, 0) / cellData.length);
          var intensity = globalMax > 0 ? cellAvg / globalMax : 0;
          var r = Math.round(intensity * 239 + (1 - intensity) * 16);
          var g = Math.round((1 - intensity) * 185 + intensity * 68);
          var b2 = Math.round((1 - intensity) * 129 + intensity * 68);
          var tipLabel = activeCols[c2].title || ('\u00e9tape ' + colKey);
          html += '<td class="hm-cell" style="background:rgba(' + r + ',' + g + ',' + b2 + ',0.7);color:#fff" title="' + U.escapeHtml(pagePrefs[p]) + ' ' + U.escapeHtml(tipLabel) + ': ' + cellAvg + 'j (n=' + cellData.length + ')">' + cellAvg + '</td>';
        } else {
          html += '<td class="hm-cell" style="background:rgba(255,255,255,0.03);color:var(--text-dim)">\u2014</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function initHmPagination() {
    document.getElementById('hm-sort').addEventListener('change', function(e) {
      state.hmSort = e.target.value;
      state.hmPage = 1;
      renderAll();
    });
    document.getElementById('hm-page-size').addEventListener('change', function(e) {
      state.hmPageSize = parseInt(e.target.value, 10);
      state.hmPage = 1;
      renderAll();
    });
    document.getElementById('hm-btn-prev').addEventListener('click', function() {
      if (state.hmPage > 1) { state.hmPage--; renderAll(); }
    });
    document.getElementById('hm-btn-next').addEventListener('click', function() {
      state.hmPage++;
      renderAll();
    });
  }

  // ─── Distribution Table ──────────────────────────────────

  function renderDistribTable(prefStats, filtered) {
    var toolbar = document.getElementById('distrib-toolbar');
    var tbody = document.getElementById('distrib-tbody');

    if (!prefStats.length) {
      toolbar.style.display = 'none';
      tbody.innerHTML = '<tr><td colspan="4" class="no-data">Aucune pr\u00e9fecture</td></tr>';
      return;
    }

    // Count dossiers per step per prefecture
    var prefSteps = {};
    for (var i = 0; i < filtered.length; i++) {
      var s = filtered[i];
      if (!s.prefecture) continue;
      var step = s.currentStep || 0;
      if (!prefSteps[s.prefecture]) prefSteps[s.prefecture] = {};
      prefSteps[s.prefecture][step] = (prefSteps[s.prefecture][step] || 0) + 1;
    }

    // Build rows: prefecture, dominant step, total, step counts
    var rows = [];
    for (var pi = 0; pi < prefStats.length; pi++) {
      var p = prefStats[pi];
      var steps = prefSteps[p.prefecture] || {};
      var dominantStep = 0;
      var dominantCount = 0;
      var stepKeys = Object.keys(steps);
      for (var sk = 0; sk < stepKeys.length; sk++) {
        var st = Number(stepKeys[sk]);
        if (steps[st] > dominantCount) {
          dominantCount = steps[st];
          dominantStep = st;
        }
      }
      rows.push({
        prefecture: p.prefecture,
        total: p.total,
        dominantStep: dominantStep,
        dominantCount: dominantCount,
        dominantPct: p.total > 0 ? Math.round(dominantCount / p.total * 100) : 0,
        steps: steps
      });
    }

    // Sort
    switch (state.distribSort) {
      case 'total-asc':
        rows.sort(function(a, b) { return a.total - b.total; }); break;
      case 'name-asc':
        rows.sort(function(a, b) { return a.prefecture.localeCompare(b.prefecture); }); break;
      default:
        rows.sort(function(a, b) { return b.total - a.total; });
    }

    // Pagination
    var total = rows.length;
    var ps = state.distribPageSize;
    var totalPages = ps > 0 ? Math.max(1, Math.ceil(total / ps)) : 1;
    state.distribPage = Math.min(state.distribPage, totalPages);
    var pageRows = ps > 0 ? rows.slice((state.distribPage - 1) * ps, state.distribPage * ps) : rows;

    toolbar.style.display = 'flex';
    document.getElementById('distrib-count').textContent = total + ' pr\u00e9fecture' + (total > 1 ? 's' : '');
    document.getElementById('distrib-page-info').textContent = state.distribPage + '/' + totalPages;
    document.getElementById('distrib-btn-prev').disabled = state.distribPage <= 1;
    document.getElementById('distrib-btn-next').disabled = state.distribPage >= totalPages;

    var html = '';
    for (var r = 0; r < pageRows.length; r++) {
      var row = pageRows[r];
      var stepName = C.PHASE_NAMES[row.dominantStep] || ('\u00c9tape ' + row.dominantStep);
      var stepColor = C.STEP_COLORS[row.dominantStep] || C.STEP_COLORS[0];

      // Build mini stacked bar
      var barHtml = '<div class="distrib-bar">';
      var barSteps = Object.keys(row.steps).map(Number).sort(function(a, b) { return a - b; });
      for (var bs = 0; bs < barSteps.length; bs++) {
        var bStep = barSteps[bs];
        var bCount = row.steps[bStep];
        var bPct = Math.round(bCount / row.total * 100);
        if (bPct < 2) bPct = 2;
        var bColor = C.STEP_COLORS[bStep] || C.STEP_COLORS[0];
        barHtml += '<div class="distrib-bar-seg" style="width:' + bPct + '%;background:' + bColor + '"></div>';
      }
      barHtml += '</div>';

      // Summary row (clickable)
      html += '<tr class="distrib-row" data-idx="' + r + '">' +
        '<td><span class="distrib-toggle">\u25B6</span> ' + U.escapeHtml(row.prefecture) + '</td>' +
        '<td><span class="distrib-step-badge" style="background:' + stepColor + '22;color:' + stepColor + ';border:1px solid ' + stepColor + '44">' + row.dominantStep + '. ' + U.escapeHtml(stepName) + '</span> <span class="text-dim">' + row.dominantPct + '%</span></td>' +
        '<td class="num">' + row.total + '</td>' +
        '<td>' + barHtml + '</td>' +
      '</tr>';

      // Detail rows (hidden by default) — one sub-row per step, sorted by count desc
      var detailSteps = barSteps.slice().sort(function(a, b) { return (row.steps[b] || 0) - (row.steps[a] || 0); });
      for (var ds = 0; ds < detailSteps.length; ds++) {
        var dStep = detailSteps[ds];
        var dCount = row.steps[dStep];
        var dPct = Math.round(dCount / row.total * 100);
        var dColor = C.STEP_COLORS[dStep] || C.STEP_COLORS[0];
        var dName = C.PHASE_NAMES[dStep] || ('\u00c9tape ' + dStep);
        html += '<tr class="distrib-detail" data-parent="' + r + '" style="display:none">' +
          '<td class="distrib-detail-name"><span class="distrib-dot" style="background:' + dColor + '"></span>' + dStep + '. ' + U.escapeHtml(dName) + '</td>' +
          '<td colspan="2" class="num">' + dCount + ' <span class="text-dim">(' + dPct + '%)</span></td>' +
          '<td><div class="distrib-detail-bar"><div style="width:' + dPct + '%;background:' + dColor + '"></div></div></td>' +
        '</tr>';
      }
    }
    tbody.innerHTML = html;

    // Toggle detail rows on click
    var summaryRows = tbody.querySelectorAll('.distrib-row');
    for (var tr = 0; tr < summaryRows.length; tr++) {
      summaryRows[tr].addEventListener('click', function() {
        var idx = this.dataset.idx;
        var toggle = this.querySelector('.distrib-toggle');
        var details = tbody.querySelectorAll('.distrib-detail[data-parent="' + idx + '"]');
        var isOpen = details.length && details[0].style.display !== 'none';
        for (var d = 0; d < details.length; d++) {
          details[d].style.display = isOpen ? 'none' : 'table-row';
        }
        toggle.textContent = isOpen ? '\u25B6' : '\u25BC';
        this.classList.toggle('distrib-row-open', !isOpen);
      });
    }
  }

  function initDistribPagination() {
    document.getElementById('distrib-sort').addEventListener('change', function(e) {
      state.distribSort = e.target.value;
      state.distribPage = 1;
      renderAll();
    });
    document.getElementById('distrib-page-size').addEventListener('change', function(e) {
      state.distribPageSize = parseInt(e.target.value, 10);
      state.distribPage = 1;
      renderAll();
    });
    document.getElementById('distrib-btn-prev').addEventListener('click', function() {
      if (state.distribPage > 1) { state.distribPage--; renderAll(); }
    });
    document.getElementById('distrib-btn-next').addEventListener('click', function() {
      state.distribPage++;
      renderAll();
    });
  }

})();
