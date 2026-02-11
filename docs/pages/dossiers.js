/**
 * pages/dossiers.js — Explorateur de dossiers
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
    filters: {},
    page: 1,
    pageSize: 12,
    sort: 'step-desc',
    tableSort: { col: null, dir: 'desc' }
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

      // Read URL filters
      state.filters = F.readFiltersFromURL();
      if (state.filters.sort) state.sort = state.filters.sort;

      loading.style.display = 'none';
      main.style.display = 'block';

      var prefectures = D.getUniquePrefectures(state.summaries);
      initFilters(prefectures);
      initDossierControls();
      initTableSort();
      initExportCSV();
      renderAll();

    } catch (error) {
      loading.innerHTML = '<div class="error-msg"><p>Erreur: ' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function initFilters(prefectures) {
    F.createStatusFilter('filter-status-container', state.filters.statut, function(v) {
      state.filters.statut = v; state.page = 1; syncAndRender();
    });
    F.createPrefectureDropdown('filter-prefecture-container', prefectures, state.filters.prefecture, function(v) {
      state.filters.prefecture = v; state.page = 1; syncAndRender();
    });
    F.createOutcomeFilter('filter-outcome-container', state.filters.outcome, function(v) {
      state.filters.outcome = v; state.page = 1; syncAndRender();
    });
    F.createComplementFilter('filter-complement-container', state.filters.complement, function(v) {
      state.filters.complement = v; state.page = 1; syncAndRender();
    });

    var searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.value = state.filters.search || '';
      searchInput.addEventListener('input', function() {
        state.filters.search = searchInput.value; state.page = 1; syncAndRender();
      });
    }
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

    // Filter count
    var countEl = document.getElementById('filter-count');
    if (state.summaries.length === filtered.length) {
      countEl.textContent = filtered.length + ' dossier' + (filtered.length > 1 ? 's' : '');
    } else {
      countEl.textContent = filtered.length + ' / ' + state.summaries.length + ' dossiers';
    }

    renderDossierCards(filtered);
    renderDetailTable(filtered);
    renderHistogram(filtered);
  }

  // ─── Dossier Cards ───────────────────────────────────────

  function getSorted(summaries) {
    var data = summaries.slice();
    switch (state.sort) {
      case 'step-desc':
        data.sort(function(a, b) { return b.rang - a.rang || (b.daysSinceDeposit || 0) - (a.daysSinceDeposit || 0); });
        break;
      case 'step-asc':
        data.sort(function(a, b) { return a.rang - b.rang || (a.daysSinceDeposit || 0) - (b.daysSinceDeposit || 0); });
        break;
      case 'duration-desc':
        data.sort(function(a, b) { return (b.daysSinceDeposit || 0) - (a.daysSinceDeposit || 0); });
        break;
      case 'status-recent':
        data.sort(function(a, b) { return (a.daysAtCurrentStatus || 9999) - (b.daysAtCurrentStatus || 9999); });
        break;
    }
    return data;
  }

  function computePercentile(s, allSummaries) {
    if (s.daysSinceDeposit == null) return null;
    var daysArr = allSummaries.filter(function(x) { return x.daysSinceDeposit != null; }).map(function(x) { return x.daysSinceDeposit; });
    if (daysArr.length < 2) return null;
    var sorted = daysArr.slice().sort(function(a, b) { return a - b; });
    var rank = 0;
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i] <= s.daysSinceDeposit) rank = i;
    }
    return Math.round((1 - rank / (sorted.length - 1)) * 100);
  }

  function renderDossierCards(filtered) {
    var toolbar = document.getElementById('dossier-toolbar');
    var grid = document.getElementById('dossier-grid');

    if (!filtered.length) {
      toolbar.style.display = 'none';
      grid.innerHTML = '<p class="no-data">Aucun dossier pour ce filtre</p>';
      return;
    }

    var sorted = getSorted(filtered);
    var totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);

    var start = (state.page - 1) * state.pageSize;
    var pageData = sorted.slice(start, start + state.pageSize);

    toolbar.style.display = 'flex';
    document.getElementById('dossier-count').textContent = sorted.length + ' dossier' + (sorted.length > 1 ? 's' : '');
    document.getElementById('page-info').textContent = state.page + '/' + totalPages;
    document.getElementById('btn-prev').disabled = state.page <= 1;
    document.getElementById('btn-next').disabled = state.page >= totalPages;

    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      html += renderOneCard(pageData[i], state.summaries);
    }
    grid.innerHTML = html;
  }

  function renderOneCard(s, allSummaries) {
    var color = C.getStepColor(s.currentStep);

    // Progress bar
    var progressHtml = '';
    for (var step = 1; step <= 12; step++) {
      var isCompleted = s.stepsTraversed.indexOf(step) !== -1 && step < s.currentStep;
      var isActive = step === s.currentStep;
      var segColor = C.STEP_COLORS[step];
      var cls = 'progress-seg';
      if (isActive) cls += ' active';
      else if (isCompleted) cls += ' completed';
      progressHtml += '<div class="' + cls + '" style="--seg-color:' + segColor + '" title="' + step + '. ' + C.PHASE_NAMES[step] + '"></div>';
    }

    // Mini timeline
    var miniTimeline = '';
    for (var j = 0; j < s.stepsTraversed.length; j++) {
      var st = s.stepsTraversed[j];
      miniTimeline += '<span class="step-dot' + (st === s.currentStep ? ' current' : '') + '" style="background:' + C.STEP_COLORS[st] + '" title="' + st + '. ' + C.PHASE_NAMES[st] + '">' + st + '</span>';
    }

    // Percentile badge
    var pct = computePercentile(s, allSummaries);
    var pctBadge = '';
    if (pct !== null) {
      var pctClass = pct >= 70 ? 'fast' : pct >= 40 ? 'normal' : 'slow';
      pctBadge = '<span class="badge-percentile ' + pctClass + '">Top ' + pct + '%</span>';
    }

    var daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '\u2014';
    var totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

    var infoItems = '';
    if (s.prefecture) infoItems += '<div class="dossier-info-item"><span class="info-label">Prefecture</span><span class="info-value">' + U.escapeHtml(s.prefecture) + '</span></div>';
    if (s.dateEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Entretien</span><span class="info-value">' + U.formatDateFr(s.dateEntretien) + '</span></div>';
    if (s.lieuEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Lieu</span><span class="info-value">' + U.escapeHtml(s.lieuEntretien) + '</span></div>';
    if (s.numeroDecret) infoItems += '<div class="dossier-info-item"><span class="info-label">Decret</span><span class="info-value">' + U.escapeHtml(s.numeroDecret) + '</span></div>';

    var complementBadge = s.hasComplement ? '<span class="badge-complement">Complement demande</span>' : '';

    return '<div class="dossier-card" style="--card-accent:' + color + '">' +
      '<div class="dossier-header">' +
        '<span class="dossier-hash">#' + U.escapeHtml(s.hash) + ' ' + pctBadge + '</span>' +
        '<span class="dossier-step-badge" style="background:' + color + '">' + s.sousEtape + '/12</span>' +
      '</div>' +
      '<div class="dossier-progress">' +
        '<div class="progress-track">' + progressHtml + '</div>' +
        '<div class="progress-label"><code>' + U.escapeHtml(s.statut) + '</code> <span class="phase-hint">(' + U.escapeHtml(s.explication) + ')</span></div>' +
      '</div>' +
      '<div class="dossier-durations">' +
        '<div class="duration-item"><span class="duration-label">Au statut actuel</span><span class="duration-value" style="color:' + color + '">' + daysAtStatus + '</span></div>' +
        '<div class="duration-item"><span class="duration-label">Depuis le depot</span><span class="duration-value">' + totalDuration + '</span></div>' +
      '</div>' +
      (infoItems ? '<div class="dossier-info">' + infoItems + '</div>' : '') +
      (complementBadge ? '<div class="dossier-footer">' + complementBadge + '</div>' : '') +
      '<div class="dossier-mini-timeline">' + miniTimeline + '</div>' +
    '</div>';
  }

  function initDossierControls() {
    var sortSelect = document.getElementById('sort-dossiers');
    if (state.sort) sortSelect.value = state.sort;
    sortSelect.addEventListener('change', function(e) {
      state.sort = e.target.value;
      state.page = 1;
      renderAll();
    });

    document.getElementById('btn-prev').addEventListener('click', function() {
      if (state.page > 1) { state.page--; renderAll(); }
    });
    document.getElementById('btn-next').addEventListener('click', function() {
      var filtered = getFiltered();
      var totalPages = Math.ceil(filtered.length / state.pageSize);
      if (state.page < totalPages) { state.page++; renderAll(); }
    });
  }

  // ─── Detail Table ────────────────────────────────────────

  function renderDetailTable(filtered) {
    var tbody = document.getElementById('detail-tbody');
    var data = filtered.slice();

    // Apply table sort
    if (state.tableSort.col) {
      data.sort(function(a, b) {
        var va, vb;
        switch (state.tableSort.col) {
          case 'hash': va = a.hash; vb = b.hash; break;
          case 'step': va = a.rang; vb = b.rang; break;
          case 'daysAtStatus': va = a.daysAtCurrentStatus || 0; vb = b.daysAtCurrentStatus || 0; break;
          case 'deposit': va = a.dateDepot || ''; vb = b.dateDepot || ''; break;
          default: return 0;
        }
        if (va < vb) return state.tableSort.dir === 'asc' ? -1 : 1;
        if (va > vb) return state.tableSort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="no-data">Aucun dossier</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < data.length; i++) {
      var s = data[i];
      html += '<tr>' +
        '<td><code>#' + U.escapeHtml(s.hash) + '</code></td>' +
        '<td class="num">' + s.sousEtape + '/12</td>' +
        '<td><code>' + U.escapeHtml(s.statut) + '</code></td>' +
        '<td class="num">' + (s.daysAtCurrentStatus != null ? s.daysAtCurrentStatus + ' j' : '\u2014') + '</td>' +
        '<td>' + U.formatDateFr(s.dateDepot) + '</td>' +
        '<td>' + U.formatDateFr(s.dateStatut) + '</td>' +
        '<td>' + U.formatDateFr(s.dateEntretien) + '</td>' +
        '<td>' + U.escapeHtml(s.lieuEntretien || '\u2014') + '</td>' +
        '<td>' + U.escapeHtml(s.numeroDecret || '\u2014') + '</td>' +
        '<td>' + U.escapeHtml(s.prefecture || '\u2014') + '</td>' +
        '<td>' + (s.hasComplement ? 'Oui' : 'Non') + '</td>' +
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
        // Update header classes
        ths.forEach(function(t) { t.classList.remove('sort-asc', 'sort-desc'); });
        th.classList.add('sort-' + state.tableSort.dir);
        renderAll();
      });
    });
  }

  // ─── Histogram ───────────────────────────────────────────

  function renderHistogram(filtered) {
    var canvas = document.getElementById('histogram-chart');
    var noData = document.getElementById('histogram-no-data');

    var days = filtered.filter(function(s) { return s.daysSinceDeposit != null; }).map(function(s) { return s.daysSinceDeposit; });

    if (!days.length) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      CH.destroy('histogram');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    // Buckets of 30 days
    var maxDays = Math.max.apply(null, days);
    var bucketSize = 30;
    var numBuckets = Math.ceil(maxDays / bucketSize) + 1;
    var buckets = new Array(numBuckets).fill(0);
    var labels = [];

    for (var i = 0; i < numBuckets; i++) {
      labels.push((i * bucketSize) + '-' + ((i + 1) * bucketSize) + 'j');
    }
    for (var j = 0; j < days.length; j++) {
      var idx = Math.min(Math.floor(days[j] / bucketSize), numBuckets - 1);
      buckets[idx]++;
    }

    var avg = days.reduce(function(a, b) { return a + b; }, 0) / days.length;
    var med = U.medianCalc(days);

    var datasets = [{
      label: 'Dossiers',
      data: buckets,
      backgroundColor: 'rgba(59,130,246,0.5)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4
    }];

    var config = CH.barConfig(labels, datasets, { suffix: '', ySuffix: '', datalabels: false });
    config.options.plugins.legend = { display: false };

    // Add annotation lines for avg/median
    config.options.plugins.annotation = undefined; // not using plugin, use afterDraw instead

    CH.create('histogram', 'histogram-chart', config);
  }

  // ─── CSV Export ──────────────────────────────────────────

  function initExportCSV() {
    document.getElementById('btn-export-csv').addEventListener('click', function() {
      var filtered = getFiltered();
      var headers = ['Hash', 'Etape', 'Statut', 'Jours au statut', 'Date depot', 'Date statut', 'Entretien', 'Lieu', 'Decret', 'Prefecture', 'Complement'];
      var rows = [headers.join(',')];

      for (var i = 0; i < filtered.length; i++) {
        var s = filtered[i];
        rows.push([
          s.hash,
          s.currentStep,
          '"' + (s.statut || '').replace(/"/g, '""') + '"',
          s.daysAtCurrentStatus != null ? s.daysAtCurrentStatus : '',
          s.dateDepot || '',
          s.dateStatut || '',
          s.dateEntretien || '',
          '"' + (s.lieuEntretien || '').replace(/"/g, '""') + '"',
          s.numeroDecret || '',
          '"' + (s.prefecture || '').replace(/"/g, '""') + '"',
          s.hasComplement ? 'Oui' : 'Non'
        ].join(','));
      }

      var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'anef-dossiers.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

})();
