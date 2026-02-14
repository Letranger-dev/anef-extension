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
    page: 1,
    pageSize: 5,
    sort: 'status-recent',
    view: 'list',
    tableSort: { col: 'daysAtStatus', dir: 'asc' },
    tablePage: 1,
    tablePageSize: 5,
    tableFilters: {
      statut: 'all',
      prefecture: 'all',
      depotMin: '',
      depotMax: '',
      statutDateMin: '',
      statutDateMax: ''
    },
    dossierFilters: {
      statut: 'all',
      prefecture: 'all',
      history: 'all',
      depotMin: '',
      depotMax: '',
      statutDateMin: '',
      statutDateMax: ''
    },
    histogramFilters: {
      statut: 'all',
      prefecture: 'all'
    }
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
      if (urlFilters.sort) state.sort = urlFilters.sort;

      loading.style.display = 'none';
      main.style.display = 'block';

      var prefectures = D.getUniquePrefectures(state.summaries);
      initSectionFilters(prefectures);
      initDossierControls();
      initDossierFilters();
      initViewToggle();
      initPageSize();
      initTableSort();
      initTablePagination();
      initTableFilters();
      renderAll();

    } catch (error) {
      loading.innerHTML = '<div class="error-msg"><p>Erreur: ' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function initSectionFilters(prefectures) {
    // Parcours des dossiers: statut + prefecture
    F.createStatusFilter('dossier-filter-statut-container', 'all', function(v) {
      state.dossierFilters.statut = v; state.page = 1; renderAll();
    });
    F.createPrefectureDropdown('dossier-filter-prefecture-container', prefectures, 'all', function(v) {
      state.dossierFilters.prefecture = v; state.page = 1; renderAll();
    });

    // Tableau détaillé: statut + prefecture
    F.createStatusFilter('table-filter-statut-container', 'all', function(v) {
      state.tableFilters.statut = v; state.tablePage = 1; renderAll();
    });
    F.createPrefectureDropdown('table-filter-prefecture-container', prefectures, 'all', function(v) {
      state.tableFilters.prefecture = v; state.tablePage = 1; renderAll();
    });

    // Histogram: statut + prefecture
    F.createStatusFilter('histogram-filter-statut-container', 'all', function(v) {
      state.histogramFilters.statut = v; renderAll();
    });
    F.createPrefectureDropdown('histogram-filter-prefecture-container', prefectures, 'all', function(v) {
      state.histogramFilters.prefecture = v; renderAll();
    });
  }

  function renderAll() {
    renderDossiers(state.summaries);
    renderDetailTable(state.summaries);
    renderHistogram(state.summaries);
  }

  // ─── View Toggle ────────────────────────────────────────

  function initViewToggle() {
    var btns = document.querySelectorAll('.view-toggle .view-btn');
    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = btn.dataset.view;
        if (view === state.view) return;
        state.view = view;
        btns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderAll();
      });
    });
  }

  // ─── Page Size ──────────────────────────────────────────

  function initPageSize() {
    var sel = document.getElementById('page-size');
    if (!sel) return;
    sel.value = String(state.pageSize);
    sel.addEventListener('change', function() {
      state.pageSize = parseInt(sel.value, 10);
      state.page = 1;
      renderAll();
    });
  }

  // ─── Dossier Rendering (dispatch) ──────────────────────

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

  function applyDossierFilters(data) {
    var tf = state.dossierFilters;
    return data.filter(function(s) {
      if (tf.statut && tf.statut !== 'all') {
        if ((s.statut || '').toLowerCase() !== tf.statut) return false;
      }
      if (tf.prefecture && tf.prefecture !== 'all') {
        if (s.prefecture !== tf.prefecture) return false;
      }
      if (tf.history === 'multi' && s.snapshotCount < 2) return false;
      if (tf.depotMin && (s.dateDepot || '') < tf.depotMin) return false;
      if (tf.depotMax && (s.dateDepot || '') > tf.depotMax) return false;
      if (tf.statutDateMin && (s.dateStatut || '') < tf.statutDateMin) return false;
      if (tf.statutDateMax && (s.dateStatut || '') > tf.statutDateMax) return false;
      return true;
    });
  }

  function initDossierFilters() {
    var historySel = document.getElementById('dossier-filter-history');
    historySel.addEventListener('change', function() {
      state.dossierFilters.history = historySel.value;
      state.page = 1;
      renderAll();
    });

    var depotMin = document.getElementById('dossier-filter-depot-min');
    var depotMax = document.getElementById('dossier-filter-depot-max');
    var statutMin = document.getElementById('dossier-filter-statut-min');
    var statutMax = document.getElementById('dossier-filter-statut-max');

    depotMin.addEventListener('change', function() {
      state.dossierFilters.depotMin = depotMin.value;
      state.page = 1;
      renderAll();
    });
    depotMax.addEventListener('change', function() {
      state.dossierFilters.depotMax = depotMax.value;
      state.page = 1;
      renderAll();
    });
    statutMin.addEventListener('change', function() {
      state.dossierFilters.statutDateMin = statutMin.value;
      state.page = 1;
      renderAll();
    });
    statutMax.addEventListener('change', function() {
      state.dossierFilters.statutDateMax = statutMax.value;
      state.page = 1;
      renderAll();
    });
  }

  function renderDossiers(allSummaries) {
    var dossierData = applyDossierFilters(allSummaries);
    var toolbar = document.getElementById('dossier-toolbar');
    var grid = document.getElementById('dossier-grid');
    var list = document.getElementById('dossier-list');

    if (!dossierData.length) {
      toolbar.style.display = 'none';
      grid.innerHTML = '';
      grid.style.display = 'none';
      list.innerHTML = '<p class="no-data">Aucun dossier pour ce filtre</p>';
      list.style.display = 'flex';
      return;
    }

    var sorted = getSorted(dossierData);
    var totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);

    var start = (state.page - 1) * state.pageSize;
    var pageData = sorted.slice(start, start + state.pageSize);

    toolbar.style.display = 'flex';
    var countText = sorted.length === allSummaries.length
      ? sorted.length + ' dossier' + (sorted.length > 1 ? 's' : '')
      : sorted.length + ' / ' + allSummaries.length + ' dossiers';
    document.getElementById('dossier-count').textContent = countText;
    document.getElementById('page-info').textContent = state.page + '/' + totalPages;
    document.getElementById('btn-prev').disabled = state.page <= 1;
    document.getElementById('btn-next').disabled = state.page >= totalPages;

    if (state.view === 'list') {
      grid.innerHTML = '';
      grid.style.display = 'none';
      list.style.display = 'flex';
      renderDossierRows(list, pageData, state.summaries);
    } else {
      list.innerHTML = '';
      list.style.display = 'none';
      grid.style.display = 'grid';
      var html = '';
      for (var i = 0; i < pageData.length; i++) {
        html += renderOneCard(pageData[i], state.summaries);
      }
      grid.innerHTML = html;
    }
  }

  // ─── List View (compact rows) ──────────────────────────

  function renderDossierRows(container, pageData, allSummaries) {
    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      var s = pageData[i];
      var color = C.getStepColor(s.currentStep);
      var daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '\u2014';
      var totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

      var triBadge = s.currentStep === 3 ? ' <span class="badge-tri">Tri</span>' : '';

      html += '<div class="dossier-row" style="--card-accent:' + color + '" data-row-idx="' + i + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-step" style="background:' + color + '">' + s.sousEtape + '/12</span>' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
          '</div>' +
          '<div class="dossier-row-status" title="' + U.escapeHtml(s.statut) + '">' +
            '<span class="statut-label">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</span>' +
            triBadge +
          '</div>' +
          '<div class="dossier-row-meta">' +
            '<span>' + daysAtStatus + ' au statut</span>' +
            '<span>' + totalDuration + ' total</span>' +
            (s.prefecture ? '<span>' + U.escapeHtml(s.prefecture) + '</span>' : '') +
            (s.hasComplement ? '<span style="color:var(--orange)">Complément</span>' : '') +
          '</div>' +
        '</div>' +
        '<button class="dossier-row-expand" aria-label="Details">&#x25BC;</button>' +
      '</div>' +
      '<div class="dossier-row-detail" data-detail-idx="' + i + '"></div>';
    }
    container.innerHTML = html;

    // Bind expand/collapse
    var rows = container.querySelectorAll('.dossier-row');
    rows.forEach(function(row) {
      row.addEventListener('click', function() {
        var idx = parseInt(row.dataset.rowIdx, 10);
        var detail = container.querySelector('[data-detail-idx="' + idx + '"]');
        var isOpen = detail.classList.contains('open');

        if (isOpen) {
          row.classList.remove('expanded');
          detail.classList.remove('open');
          detail.innerHTML = '';
        } else {
          row.classList.add('expanded');
          detail.classList.add('open');
          detail.innerHTML = renderRowDetail(pageData[idx], allSummaries);
        }
      });
    });
  }

  function buildStatusTimeline(snaps) {
    if (!snaps || !snaps.length) return '';
    var html = '<div style="margin-top:0.75rem;padding-top:0.6rem">' +
      '<div class="detail-history-header">Historique des statuts</div>';
    for (var j = 0; j < snaps.length; j++) {
      var snap = snaps[j];
      var statutKey = (snap.statut || '').toLowerCase();
      var info = C.STATUTS[statutKey];
      var stepColor = C.STEP_COLORS[snap.etape] || '#64748b';
      var expl = info ? info.explication : (snap.phase || '');
      var sousEtape = info ? C.formatSubStep(info.rang) : String(snap.etape);

      var durationHtml = '';
      if (j < snaps.length - 1) {
        var nextSnap = snaps[j + 1];
        if (snap.date_statut && nextSnap.date_statut) {
          var days = U.daysDiff(snap.date_statut, nextSnap.date_statut);
          var dColor = days >= 60 ? 'var(--red);background:rgba(239,68,68,0.12)' :
                       days >= 30 ? 'var(--orange);background:rgba(245,158,11,0.12)' :
                                    'var(--green);background:rgba(16,185,129,0.12)';
          durationHtml = '<span class="ts-duration" style="color:' + dColor + '">' + U.formatDuration(days) + ' \u00e0 ce statut</span>';
        }
      } else {
        if (snap.date_statut) {
          var today = new Date(); today.setHours(0, 0, 0, 0);
          var days = U.daysDiff(snap.date_statut, today);
          durationHtml = '<span class="ts-duration" style="color:var(--primary-light);background:rgba(59,130,246,0.12)">' + U.formatDuration(days) + ' (en cours)</span>';
        }
      }

      var dateStr = snap.date_statut ? U.formatDateFr(snap.date_statut) : '';

      html += '<div class="timeline-step">' +
        '<div class="timeline-dot-col">' +
          '<div class="timeline-dot" style="background:' + stepColor + '"></div>' +
          (j < snaps.length - 1 ? '<div class="timeline-line"></div>' : '') +
        '</div>' +
        '<div class="timeline-content">' +
          '<div class="ts-status">' + U.escapeHtml(sousEtape) + ' \u2014 ' + U.escapeHtml(statutKey) + '</div>' +
          (expl ? '<div class="ts-expl">' + U.escapeHtml(expl) + '</div>' : '') +
          (dateStr ? '<div class="ts-date">' + dateStr + '</div>' : '') +
          durationHtml +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderRowDetail(s, allSummaries) {
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

    var daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '\u2014';
    var totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

    var infoItems = '';
    if (s.prefecture) infoItems += '<div class="dossier-info-item"><span class="info-label">Préfecture</span><span class="info-value">' + U.escapeHtml(s.prefecture) + '</span></div>';
    if (s.dateEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Entretien</span><span class="info-value">' + U.formatDateFr(s.dateEntretien) + '</span></div>';
    if (s.lieuEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Lieu</span><span class="info-value">' + U.escapeHtml(s.lieuEntretien) + '</span></div>';
    if (s.numeroDecret) infoItems += '<div class="dossier-info-item"><span class="info-label">Décret</span><span class="info-value">' + U.escapeHtml(s.numeroDecret) + '</span></div>';

    var complementBadge = s.hasComplement ? '<span class="badge-complement">Complément demandé</span>' : '';

    // Status history timeline
    var snaps = state.grouped.get(s.fullHash) || [];
    var timelineHtml = snaps.length > 0 ? buildStatusTimeline(snaps) : '';

    return '<div class="dossier-progress">' +
        '<div class="progress-track">' + progressHtml + '</div>' +
        '<div class="progress-label" title="' + U.escapeHtml(s.statut) + '">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</div>' +
      '</div>' +
      '<div class="dossier-durations">' +
        '<div class="duration-item"><span class="duration-label">Au statut actuel</span><span class="duration-value" style="color:' + color + '">' + daysAtStatus + '</span></div>' +
        '<div class="duration-item"><span class="duration-label">Depuis le dépôt</span><span class="duration-value">' + totalDuration + '</span></div>' +
      '</div>' +
      (infoItems ? '<div class="dossier-info">' + infoItems + '</div>' : '') +
      (complementBadge ? '<div class="dossier-footer">' + complementBadge + '</div>' : '') +
      '<div class="dossier-mini-timeline">' + miniTimeline + '</div>' +
      timelineHtml;
  }

  // ─── Card View ─────────────────────────────────────────

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

    var triBadge = s.currentStep === 3 ? ' <span class="badge-tri">Tri</span>' : '';

    var daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '\u2014';
    var totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

    var infoItems = '';
    if (s.prefecture) infoItems += '<div class="dossier-info-item"><span class="info-label">Préfecture</span><span class="info-value">' + U.escapeHtml(s.prefecture) + '</span></div>';
    if (s.dateEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Entretien</span><span class="info-value">' + U.formatDateFr(s.dateEntretien) + '</span></div>';
    if (s.lieuEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Lieu</span><span class="info-value">' + U.escapeHtml(s.lieuEntretien) + '</span></div>';
    if (s.numeroDecret) infoItems += '<div class="dossier-info-item"><span class="info-label">Décret</span><span class="info-value">' + U.escapeHtml(s.numeroDecret) + '</span></div>';

    var complementBadge = s.hasComplement ? '<span class="badge-complement">Complément demandé</span>' : '';

    return '<div class="dossier-card" style="--card-accent:' + color + '">' +
      '<div class="dossier-header">' +
        '<span class="dossier-hash">#' + U.escapeHtml(s.hash) + '</span>' +
        '<span class="dossier-step-badge" style="background:' + color + '">' + s.sousEtape + '/12</span>' +
      '</div>' +
      '<div class="dossier-progress">' +
        '<div class="progress-track">' + progressHtml + '</div>' +
        '<div class="progress-label" title="' + U.escapeHtml(s.statut) + '">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + triBadge + '</div>' +
      '</div>' +
      '<div class="dossier-durations">' +
        '<div class="duration-item"><span class="duration-label">Au statut actuel</span><span class="duration-value" style="color:' + color + '">' + daysAtStatus + '</span></div>' +
        '<div class="duration-item"><span class="duration-label">Depuis le dépôt</span><span class="duration-value">' + totalDuration + '</span></div>' +
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
      var dossierData = applyDossierFilters(state.summaries);
      var totalPages = Math.ceil(dossierData.length / state.pageSize);
      if (state.page < totalPages) { state.page++; renderAll(); }
    });
  }

  // ─── Detail Table ────────────────────────────────────────

  function getTableSorted(filtered) {
    var data = filtered.slice();
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
    return data;
  }

  function applyTableFilters(data) {
    var tf = state.tableFilters;
    return data.filter(function(s) {
      if (tf.statut && tf.statut !== 'all') {
        if ((s.statut || '').toLowerCase() !== tf.statut) return false;
      }
      if (tf.prefecture && tf.prefecture !== 'all') {
        if (s.prefecture !== tf.prefecture) return false;
      }
      if (tf.depotMin && (s.dateDepot || '') < tf.depotMin) return false;
      if (tf.depotMax && (s.dateDepot || '') > tf.depotMax) return false;
      if (tf.statutDateMin && (s.dateStatut || '') < tf.statutDateMin) return false;
      if (tf.statutDateMax && (s.dateStatut || '') > tf.statutDateMax) return false;
      return true;
    });
  }

  function initTableFilters() {
    var depotMin = document.getElementById('table-filter-depot-min');
    var depotMax = document.getElementById('table-filter-depot-max');
    var statutMin = document.getElementById('table-filter-statut-min');
    var statutMax = document.getElementById('table-filter-statut-max');

    depotMin.addEventListener('change', function() {
      state.tableFilters.depotMin = depotMin.value;
      state.tablePage = 1;
      renderAll();
    });
    depotMax.addEventListener('change', function() {
      state.tableFilters.depotMax = depotMax.value;
      state.tablePage = 1;
      renderAll();
    });
    statutMin.addEventListener('change', function() {
      state.tableFilters.statutDateMin = statutMin.value;
      state.tablePage = 1;
      renderAll();
    });
    statutMax.addEventListener('change', function() {
      state.tableFilters.statutDateMax = statutMax.value;
      state.tablePage = 1;
      renderAll();
    });
  }

  function renderDetailTable(allSummaries) {
    var tbody = document.getElementById('detail-tbody');
    var toolbar = document.getElementById('table-toolbar');
    var tableData = applyTableFilters(allSummaries);
    var data = getTableSorted(tableData);

    if (!data.length) {
      toolbar.style.display = 'none';
      tbody.innerHTML = '<tr><td colspan="11" class="no-data">Aucun dossier</td></tr>';
      return;
    }

    var totalPages = Math.max(1, Math.ceil(data.length / state.tablePageSize));
    state.tablePage = Math.min(state.tablePage, totalPages);
    var start = (state.tablePage - 1) * state.tablePageSize;
    var pageData = data.slice(start, start + state.tablePageSize);

    toolbar.style.display = 'flex';
    var tCountText = data.length === allSummaries.length
      ? data.length + ' dossier' + (data.length > 1 ? 's' : '')
      : data.length + ' / ' + allSummaries.length + ' dossiers';
    document.getElementById('table-count').textContent = tCountText;
    document.getElementById('table-page-info').textContent = state.tablePage + '/' + totalPages;
    document.getElementById('table-btn-prev').disabled = state.tablePage <= 1;
    document.getElementById('table-btn-next').disabled = state.tablePage >= totalPages;

    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      var s = pageData[i];
      html += '<tr>' +
        '<td><code>#' + U.escapeHtml(s.hash) + '</code></td>' +
        '<td class="num">' + s.sousEtape + '/12</td>' +
        '<td title="' + U.escapeHtml(s.statut) + '">' + U.escapeHtml(s.explication) + '</td>' +
        '<td class="num">' + (s.daysAtCurrentStatus != null ? (s.daysAtCurrentStatus === 0 ? '< 1 j' : s.daysAtCurrentStatus + ' j') : '\u2014') + '</td>' +
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
        state.tablePage = 1;
        ths.forEach(function(t) { t.classList.remove('sort-asc', 'sort-desc'); });
        th.classList.add('sort-' + state.tableSort.dir);
        renderAll();
      });
    });
  }

  function initTablePagination() {
    var sel = document.getElementById('table-page-size');
    if (sel) {
      sel.value = String(state.tablePageSize);
      sel.addEventListener('change', function() {
        state.tablePageSize = parseInt(sel.value, 10);
        state.tablePage = 1;
        renderAll();
      });
    }
    document.getElementById('table-btn-prev').addEventListener('click', function() {
      if (state.tablePage > 1) { state.tablePage--; renderAll(); }
    });
    document.getElementById('table-btn-next').addEventListener('click', function() {
      var tableData = applyTableFilters(state.summaries);
      var totalPages = Math.ceil(tableData.length / state.tablePageSize);
      if (state.tablePage < totalPages) { state.tablePage++; renderAll(); }
    });
  }

  // ─── Histogram ───────────────────────────────────────────

  function applyHistogramFilters(data) {
    var tf = state.histogramFilters;
    return data.filter(function(s) {
      if (tf.statut && tf.statut !== 'all') {
        if ((s.statut || '').toLowerCase() !== tf.statut) return false;
      }
      if (tf.prefecture && tf.prefecture !== 'all') {
        if (s.prefecture !== tf.prefecture) return false;
      }
      return true;
    });
  }

  function renderHistogram(allSummaries) {
    var canvas = document.getElementById('histogram-chart');
    var noData = document.getElementById('histogram-no-data');

    var filtered = applyHistogramFilters(allSummaries);
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

})();
