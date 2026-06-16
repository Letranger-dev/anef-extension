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
        loading.innerHTML = '<div class="error-msg"><p>' + ANEF.t('prefectures.no_data_available') + '</p></div>';
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
      loading.innerHTML = '<div class="error-msg"><p>' + ANEF.t('common.error') + ': ' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function initFilters() {
    // Build unique sorted prefecture list + statuts présents dans les dossiers
    var prefSet = {};
    var statusSet = {};
    for (var i = 0; i < state.summaries.length; i++) {
      var p = state.summaries[i].prefecture;
      if (p) prefSet[p] = true;
      var st = (state.summaries[i].statut || '').toLowerCase();
      if (st) statusSet[st] = true;
    }
    var prefList = Object.keys(prefSet).sort();
    var availableList = Object.keys(statusSet);

    F.createPrefectureMultiSelect('filter-prefecture-container', prefList, state.filters.prefecture, function(v) {
      state.filters.prefecture = v; state.tablePage = 1; state.barPage = 1; state.hmPage = 1; state.distribPage = 1; syncAndRender();
    });
    F.createStatusFilter('filter-status-container', state.filters.statut, function(v) {
      state.filters.statut = v; state.tablePage = 1; state.barPage = 1; state.hmPage = 1; state.distribPage = 1; syncAndRender();
    }, { filterStatuses: availableList });
  }

  function syncAndRender() {
    F.writeFiltersToURL(state.filters);
    renderAll();
  }

  // Signature des filtres actifs : sert de clé de cache pour les dérivés coûteux
  // (filtered, prefStats, matrice heatmap). Tri/pagination ne changent PAS le
  // filtre → on réutilise le cache au lieu de tout recalculer.
  function filterSig() {
    var p = state.filters.prefecture;
    return state.filters.statut + '||' + (Array.isArray(p) ? p.slice().sort().join(',') : p);
  }

  function getFiltered() {
    var sig = filterSig();
    if (state._derivedSig !== sig) {
      state._filtered = D.applyFilters(state.summaries, state.filters);
      state._prefStats = D.computePrefectureStats(state._filtered);
      state._derivedSig = sig;
    }
    return state._filtered;
  }

  function renderAll() {
    var filtered = getFiltered();
    var prefStats = state._prefStats;

    var countEl = document.getElementById('filter-count');
    if (filtered.length === 0) {
      countEl.textContent = ANEF.t('prefectures.no_match');
    } else {
      countEl.textContent = ANEF.t('prefectures.count_summary', {
        dossiers: ANEF.tn('common.dossier_count', filtered.length),
        prefs: ANEF.tn('prefectures.pref_count', prefStats.length)
      });
    }

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
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">' + ANEF.t('prefectures.no_pref') + '</td></tr>';
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
    document.getElementById('ranking-count').textContent = ANEF.tn('prefectures.pref_count', total);
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
        '<td class="num"><div style="display:flex;align-items:center;justify-content:flex-end;gap:0.5rem"><span>' + (p.avg_days != null ? p.avg_days + ' ' + ANEF.t('dur.day_short') : '\u2014') + '</span><div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:' + barPct + '%;height:100%;background:' + barColor + ';border-radius:3px"></div></div></div></td>' +
        '<td class="num">' + (p.median_days != null ? p.median_days + ' ' + ANEF.t('dur.day_short') : '\u2014') + '</td>' +
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
      getFiltered(); // assure le cache state._prefStats
      var pageSize = state.tablePageSize;
      var totalPages = pageSize > 0 ? Math.ceil(state._prefStats.length / pageSize) : 1;
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
    document.getElementById('bar-count').textContent = ANEF.tn('prefectures.pref_count', total);
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

    var config = CH.horizontalBarConfig(labels, values, colors, { suffix: ANEF.t('dur.day_short') });

    if (isMobile) {
      config.options.scales.y.ticks.font = { size: 10 };
      config.options.layout = { padding: { right: 40 } };
      config.options.plugins.datalabels = {
        color: '#e2e8f0',
        font: { size: 9, weight: 'bold' },
        anchor: 'end',
        align: 'right',
        formatter: function(v) { return v + ANEF.t('dur.day_short'); }
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
  // Construit dynamiquement pour refl\u00e9ter la langue active (les libell\u00e9s courts
  // et titres des sous-statuts SDANF/SCEC sont traduits ; les titres d'\u00e9tapes
  // viennent de C.PHASE_NAMES, d\u00e9j\u00e0 localis\u00e9s ailleurs).
  function buildHeatmapCols() {
    return [
      { key: 1, label: ANEF.t('prefectures.hm_brouillon'), title: C.PHASE_NAMES[1] },
      { key: 2, label: ANEF.t('prefectures.hm_depot'), title: C.PHASE_NAMES[2] },
      { key: 3, label: ANEF.t('prefectures.hm_verif'), title: C.PHASE_NAMES[3] },
      { key: 4, label: ANEF.t('prefectures.hm_affect'), title: C.PHASE_NAMES[4] },
      { key: 5, label: ANEF.t('prefectures.hm_instruct'), title: C.PHASE_NAMES[5] },
      { key: 6, label: ANEF.t('prefectures.hm_complet'), title: C.PHASE_NAMES[6] },
      { key: 7, label: ANEF.t('prefectures.hm_entretien'), title: C.PHASE_NAMES[7] },
      { key: 8, label: ANEF.t('prefectures.hm_decision'), title: C.PHASE_NAMES[8] },
      { key: 'controle_a_affecter', label: 'CAA', title: ANEF.t('prefectures.hm_caa_title') },
      { key: 'controle_a_effectuer', label: 'CAE', title: ANEF.t('prefectures.hm_cae_title') },
      { key: 'controle_en_attente_pec', label: 'CEAP', title: ANEF.t('prefectures.hm_ceap_title') },
      { key: 'controle_pec_a_faire', label: 'CPAF', title: ANEF.t('prefectures.hm_cpaf_title') },
      { key: 10, label: ANEF.t('prefectures.hm_decret'), title: C.PHASE_NAMES[10] },
      { key: 11, label: ANEF.t('prefectures.hm_publi'), title: C.PHASE_NAMES[11] },
      { key: 12, label: ANEF.t('prefectures.hm_cloture'), title: C.PHASE_NAMES[12] }
    ];
  }

  function renderHeatmap(filtered, prefStats) {
    var toolbar = document.getElementById('hm-toolbar');
    var container = document.getElementById('heatmap-container');

    if (!prefStats.length) {
      toolbar.style.display = 'none';
      container.innerHTML = '<p class="no-data">' + ANEF.t('prefectures.no_data') + '</p>';
      return;
    }

    // Build matrix: prefecture x (step or statut for step 9) => days spent AT each step
    // Use state.grouped (already deduplicated and sorted by groupByDossier)
    // Matrice préfecture×étape : ne dépend que du filtre. Cache par signature pour
    // éviter de re-scanner ~9000 snapshots (regex + daysDiff) sur pagination/tri.
    var _hmSig = filterSig();
    var matrix, globalMax;
    if (state._hmSig === _hmSig && state._hmMatrix) {
      matrix = state._hmMatrix; globalMax = state._hmMax;
    } else {
    matrix = {};
    var allHashes = new Set(filtered.map(function(s) { return s.fullHash; }));

    var today = new Date();
    state.grouped.forEach(function(snaps, hash) {
      if (!allHashes.has(hash)) return;

      for (var j = 0; j < snaps.length; j++) {
        var cur = snaps[j];
        var pref = D.normalizePrefecture(cur.prefecture);
        if (!pref || !cur.date_statut) continue;

        // Time spent AT this step:
        // - If there's a next snapshot: time until next step
        // - If it's the last (current) step: time until today (sauf dossiers terminés)
        var endDate;
        if (j + 1 < snaps.length) {
          endDate = snaps[j + 1].date_statut;
        } else {
          // Dernier snapshot — figer si dossier clôturé (hors étape 11 en attente JO)
          var isTerminated = C.isFinished({ etape: cur.etape, statut: cur.statut }) && Number(cur.etape) !== 11;
          endDate = isTerminated ? cur.date_statut : today;
        }
        if (!endDate) continue;
        var days = U.daysDiff(cur.date_statut, endDate);
        if (days === null || days < 0) continue;

        var entry = { days: days, hash: D.displayIdForFullHash(hash) };
        var sLower = cur.statut ? cur.statut.toLowerCase() : '';
        if (Number(cur.etape) === 9 && sLower && STEP9_STATUTS.indexOf(sLower) !== -1) {
          var sKey = pref + '|' + sLower;
          if (!matrix[sKey]) matrix[sKey] = [];
          matrix[sKey].push(entry);
        } else {
          var eKey = pref + '|' + cur.etape;
          if (!matrix[eKey]) matrix[eKey] = [];
          matrix[eKey].push(entry);
        }
      }
    });

    // Find global max for color scaling
    globalMax = 0;
    var mKeys = Object.keys(matrix);
    for (var k = 0; k < mKeys.length; k++) {
      var arr = matrix[mKeys[k]];
      var sum = 0; for (var s2 = 0; s2 < arr.length; s2++) sum += arr[s2].days;
      var avg = sum / arr.length;
      if (avg > globalMax) globalMax = avg;
    }
    state._hmMatrix = matrix; state._hmMax = globalMax; state._hmSig = _hmSig;
    }

    var prefs = prefStats.map(function(p) { return p.prefecture; });

    // Filter out columns with no data at all
    var activeCols = buildHeatmapCols().filter(function(col) {
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
      container.innerHTML = '<p class="no-data">' + ANEF.t('prefectures.no_data_heatmap') + '</p>';
      return;
    }

    // Pagination
    var total = activePrefs.length;
    var ps = state.hmPageSize;
    var totalPages = ps > 0 ? Math.max(1, Math.ceil(total / ps)) : 1;
    state.hmPage = Math.min(state.hmPage, totalPages);
    var pagePrefs = ps > 0 ? activePrefs.slice((state.hmPage - 1) * ps, state.hmPage * ps) : activePrefs;

    toolbar.style.display = 'flex';
    document.getElementById('hm-count').textContent = ANEF.tn('prefectures.pref_count', total);
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
          var daySum = 0; for (var ds = 0; ds < cellData.length; ds++) daySum += cellData[ds].days;
          var cellAvg = Math.round(daySum / cellData.length);
          var sorted = cellData.slice().sort(function(a, b) { return a.days - b.days; });
          var cellMin = sorted[0].days;
          var cellMax = sorted[sorted.length - 1].days;
          var minHash = sorted[0].hash;
          var maxHash = sorted[sorted.length - 1].hash;
          var intensity = globalMax > 0 ? cellAvg / globalMax : 0;
          var r = Math.round(intensity * 239 + (1 - intensity) * 16);
          var g = Math.round((1 - intensity) * 185 + intensity * 68);
          var b2 = Math.round((1 - intensity) * 129 + intensity * 68);
          var tipLabel = activeCols[c2].title || ANEF.t('prefectures.hm_step', { n: colKey });
          var cellTip = ANEF.t('prefectures.hm_cell_tip', { pref: pagePrefs[p], step: tipLabel, avg: cellAvg, n: cellData.length });
          html += '<td class="hm-cell hm-clickable" style="background:rgba(' + r + ',' + g + ',' + b2 + ',0.7);color:#fff;cursor:pointer" title="' + U.escapeHtml(cellTip) + '" data-pref="' + U.escapeHtml(pagePrefs[p]) + '" data-step="' + U.escapeHtml(tipLabel) + '" data-avg="' + cellAvg + '" data-min="' + cellMin + '" data-max="' + cellMax + '" data-min-hash="' + minHash + '" data-max-hash="' + maxHash + '" data-count="' + cellData.length + '">' + cellAvg + '</td>';
        } else {
          html += '<td class="hm-cell" style="background:rgba(255,255,255,0.03);color:var(--text-dim)">\u2014</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ─── Dossier detail modal (for heatmap links) ──────────

  function showHmDossierDetail(hash) {
    // `hash` est le displayId (token aléatoire per-session). Retrouver les
    // snapshots en comparant leur displayId (dérivé de public_id ou fallback
    // dossier_hash pour JSON legacy).
    var snaps = state.snapshots.filter(function(s) {
      var k = s.public_id || s.dossier_hash;
      return k && D.displayIdForFullHash(k) === hash;
    }).sort(function(a, b) {
      var stepDiff = Number(a.etape) - Number(b.etape);
      if (stepDiff !== 0) return stepDiff;
      return new Date(a.date_statut || 0) - new Date(b.date_statut || 0);
    });

    if (!snaps.length) return;

    // Enrichir avec jalons synthétiques : Dépôt + Entretien (si dates connues).
    var events = snaps.slice();
    var firstSnap = snaps[0] || {};
    var dateDepot = firstSnap.date_depot || null;
    var dateEntretien = null;
    for (var ei = 0; ei < snaps.length; ei++) {
      if (snaps[ei].date_entretien) { dateEntretien = snaps[ei].date_entretien; break; }
    }
    if (dateDepot) {
      events.push({ _synthetic: 'deposit', date_statut: dateDepot, etape: 2 });
    }
    if (dateEntretien) {
      events.push({ _synthetic: 'interview', date_statut: dateEntretien, etape: 7 });
    }
    events.sort(function(a, b) {
      var da = a.date_statut || '', db = b.date_statut || '';
      if (da !== db) return da < db ? -1 : 1;
      return (a.etape || 0) - (b.etape || 0);
    });

    var timelineHtml = '';
    for (var j = 0; j < events.length; j++) {
      var snap = events[j];

      if (snap._synthetic === 'deposit' || snap._synthetic === 'interview') {
        var synthLabel = snap._synthetic === 'deposit' ? ANEF.t('prefectures.deposit_label') : ANEF.t('prefectures.interview_label');
        var synthExpl = snap._synthetic === 'deposit'
          ? ANEF.t('prefectures.deposit_expl')
          : ANEF.t('prefectures.interview_expl');
        var synthColor = snap._synthetic === 'deposit' ? '#06b6d4' : '#f472b6';
        var synthDate = snap.date_statut ? U.formatDateFr(snap.date_statut) : '';
        var synthDur = '';
        if (j < events.length - 1) {
          var nextEv = events[j + 1];
          var dd = (snap.date_statut && nextEv.date_statut) ? U.daysDiff(snap.date_statut, nextEv.date_statut) : null;
          if (dd !== null) {
            synthDur = '<span class="ts-duration" style="color:var(--text-dim);background:rgba(148,163,184,0.1)">' + ANEF.t('prefectures.until_next', { dur: U.formatDuration(dd) }) + '</span>';
          }
        }
        timelineHtml += '<div class="timeline-step">' +
          '<div class="timeline-dot-col">' +
            '<div class="timeline-dot" style="background:' + synthColor + '"></div>' +
            (j < events.length - 1 ? '<div class="timeline-line"></div>' : '') +
          '</div>' +
          '<div class="timeline-content">' +
            '<div class="ts-status" style="color:' + synthColor + '">' + synthLabel + '</div>' +
            '<div class="ts-expl">' + synthExpl + '</div>' +
            (synthDate ? '<div class="ts-date">' + synthDate + '</div>' : '') +
            synthDur +
          '</div>' +
        '</div>';
        continue;
      }

      var statutKey = (snap.statut || '').toLowerCase();
      var info = C.STATUTS[statutKey];
      var stepColor = C.STEP_COLORS[snap.etape] || '#64748b';
      var expl = info ? info.explication : (snap.phase || '');
      var sousEtape = info ? C.formatSubStep(info.rang) : String(snap.etape);

      var durationHtml = '';
      if (j < events.length - 1) {
        var nextSnap = events[j + 1];
        if (snap.date_statut && nextSnap.date_statut) {
          var days = U.daysDiff(snap.date_statut, nextSnap.date_statut);
          var dColor = days >= 60 ? 'var(--red);background:rgba(239,68,68,0.12)' :
                       days >= 30 ? 'var(--orange);background:rgba(245,158,11,0.12)' :
                                    'var(--green);background:rgba(16,185,129,0.12)';
          durationHtml = '<span class="ts-duration" style="color:' + dColor + '">' + ANEF.t('prefectures.at_status', { dur: U.formatDuration(days) }) + '</span>';
        }
      } else {
        if (snap.date_statut) {
          // Étape 11 (IDD) : encore en cours, pas figé
          var isTerminated = C.isFinished({ etape: snap.etape, statut: snap.statut }) && Number(snap.etape) !== 11;
          if (isTerminated) {
            durationHtml = '<span class="ts-duration" style="color:var(--green);background:rgba(16,185,129,0.12)">' + ANEF.t('prefectures.finished') + '</span>';
          } else {
            var today = new Date(); today.setHours(0, 0, 0, 0);
            days = U.daysDiff(snap.date_statut, today);
            if (days !== null) {
              durationHtml = '<span class="ts-duration" style="color:var(--primary-light);background:rgba(59,130,246,0.12)">' + ANEF.t('prefectures.in_progress', { dur: U.formatDuration(days) }) + '</span>';
            }
          }
        }
      }

      var dateStr = snap.date_statut ? U.formatDateFr(snap.date_statut) : '';

      timelineHtml += '<div class="timeline-step">' +
        '<div class="timeline-dot-col">' +
          '<div class="timeline-dot" style="background:' + stepColor + '"></div>' +
          (j < events.length - 1 ? '<div class="timeline-line"></div>' : '') +
        '</div>' +
        '<div class="timeline-content">' +
          '<div class="ts-status">' + U.escapeHtml(sousEtape) + ' \u2014 ' + U.escapeHtml(statutKey) + '</div>' +
          (expl ? '<div class="ts-expl">' + U.escapeHtml(expl) + '</div>' : '') +
          (dateStr ? '<div class="ts-date">' + dateStr + '</div>' : '') +
          durationHtml +
        '</div>' +
      '</div>';
    }

    // Info summary
    var latest = snaps[snaps.length - 1];
    var pref = D.normalizePrefecture(latest.prefecture) || '';
    var infoHtml = '';
    if (latest.date_depot) infoHtml += '<div class="detail-row"><span class="detail-label">' + ANEF.t('prefectures.detail_depot') + '</span><span>' + U.formatDateFr(latest.date_depot) + '</span></div>';
    if (pref) infoHtml += '<div class="detail-row"><span class="detail-label">' + ANEF.t('prefectures.detail_prefecture') + '</span><span>' + U.escapeHtml(pref) + '</span></div>';

    var modal = document.getElementById('hm-dossier-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hm-dossier-modal';
      modal.className = 'history-modal-overlay';
      modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('open');
      });
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="history-modal">' +
        '<div class="history-modal-header">' +
          '<h3>' + ANEF.t('prefectures.modal_title') + '</h3>' +
          '<button class="history-close" title="' + U.escapeHtml(ANEF.t('common.close')) + '">\u00d7</button>' +
        '</div>' +
        '<div class="modal-history-list" style="padding:0.5rem 1rem">' +
          (infoHtml ? '<div class="dossier-detail-info">' + infoHtml + '</div>' : '') +
          '<div class="detail-section-label">' + ANEF.t('prefectures.modal_history') + '</div>' +
          timelineHtml +
        '</div>' +
      '</div>';

    modal.querySelector('.history-close').addEventListener('click', function() {
      modal.classList.remove('open');
    });
    modal.classList.add('open');
  }

  function initHmPagination() {
    // Click handler for heatmap cells (event delegation, bound once)
    document.getElementById('heatmap-container').addEventListener('click', function(e) {
      var cell = e.target.closest('.hm-clickable');
      if (!cell) return;
      var avg = parseInt(cell.dataset.avg, 10);
      var min = parseInt(cell.dataset.min, 10);
      var max = parseInt(cell.dataset.max, 10);
      var count = parseInt(cell.dataset.count, 10);
      var pref = cell.dataset.pref;
      var step = cell.dataset.step;
      var minHash = cell.dataset.minHash;
      var maxHash = cell.dataset.maxHash;

      // Remove existing popover
      var old = document.querySelector('.hm-popover');
      if (old) old.remove();

      var pop = document.createElement('div');
      pop.className = 'hm-popover';
      pop.innerHTML =
        '<div class="hm-popover-header">' + U.escapeHtml(pref) + '</div>' +
        '<div class="hm-popover-step">' + U.escapeHtml(step) + '</div>' +
        '<div class="hm-popover-stats">' +
          '<div class="hm-popover-row"><span>' + ANEF.t('prefectures.pop_avg') + '</span><strong>' + U.formatDuration(avg) + '</strong></div>' +
          '<div class="hm-popover-row hm-popover-link" data-hash="' + U.escapeHtml(minHash) + '"><span>' + ANEF.t('prefectures.pop_fastest') + '</span><strong>' + U.formatDuration(min) + '</strong></div>' +
          '<div class="hm-popover-row hm-popover-link" data-hash="' + U.escapeHtml(maxHash) + '"><span>' + ANEF.t('prefectures.pop_longest') + '</span><strong>' + U.formatDuration(max) + '</strong></div>' +
          '<div class="hm-popover-row"><span>' + ANEF.t('prefectures.pop_dossiers') + '</span><strong>' + count + '</strong></div>' +
        '</div>';

      // Click on "Plus rapide" / "Plus long" → open dossier detail
      pop.querySelectorAll('.hm-popover-link').forEach(function(row) {
        row.addEventListener('click', function(ev) {
          ev.stopPropagation();
          var h = row.dataset.hash;
          if (h) {
            pop.remove();
            showHmDossierDetail(h);
          }
        });
      });

      // Position popover near the cell (absolute, follows scroll)
      var rect = cell.getBoundingClientRect();
      pop.style.left = Math.min(rect.left + window.scrollX, document.documentElement.clientWidth - 240 + window.scrollX) + 'px';
      pop.style.top = (rect.bottom + window.scrollY + 6) + 'px';
      document.body.appendChild(pop);

      // Close on click outside
      function closePopover(ev) {
        if (!pop.contains(ev.target) && ev.target !== cell) {
          pop.remove();
          document.removeEventListener('click', closePopover, true);
        }
      }
      setTimeout(function() {
        document.addEventListener('click', closePopover, true);
      }, 0);
    });
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
      tbody.innerHTML = '<tr><td colspan="4" class="no-data">' + ANEF.t('prefectures.no_pref') + '</td></tr>';
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
    document.getElementById('distrib-count').textContent = ANEF.tn('prefectures.pref_count', total);
    document.getElementById('distrib-page-info').textContent = state.distribPage + '/' + totalPages;
    document.getElementById('distrib-btn-prev').disabled = state.distribPage <= 1;
    document.getElementById('distrib-btn-next').disabled = state.distribPage >= totalPages;

    var html = '';
    for (var r = 0; r < pageRows.length; r++) {
      var row = pageRows[r];
      var stepName = C.PHASE_NAMES[row.dominantStep] || ANEF.t('prefectures.step_label', { n: row.dominantStep });
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
        var dName = C.PHASE_NAMES[dStep] || ANEF.t('prefectures.step_label', { n: dStep });
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
