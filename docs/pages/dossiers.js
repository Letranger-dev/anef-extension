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
    F.createSearchablePrefectureDropdown('dossier-filter-prefecture-container', prefectures, '', function(v) {
      state.dossierFilters.prefecture = v || 'all'; state.page = 1; renderAll();
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
    renderDurationChart();
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

  // ─── Duration by Step Chart ─────────────────────────────

  var STEP9_SHORT = {
    'controle_a_affecter': 'SDANF aff.',
    'controle_a_effectuer': 'SDANF ctrl',
    'controle_en_attente_pec': 'SCEC trans.',
    'controle_pec_a_faire': 'SCEC vérif.'
  };

  /**
   * Compute how long dossiers stay at each step before moving on.
   * Uses transition data from grouped snapshots (only completed transitions).
   */
  function computeDurationAtStep(grouped) {
    var STATUTS = C.STATUTS;
    var STEP9 = D.STEP9_STATUTS;
    var buckets = {};

    grouped.forEach(function(snaps) {
      for (var i = 0; i < snaps.length - 1; i++) {
        var curr = snaps[i];
        var next = snaps[i + 1];
        if (!curr.date_statut || !next.date_statut) continue;
        // Skip if same etape + same statut (duplicate snapshot)
        if (curr.etape === next.etape && curr.statut === next.statut) continue;
        var days = U.daysDiff(curr.date_statut, next.date_statut);
        if (days === null || days < 0) continue;

        var key, rang, phase, statut = null;
        var statutLower = curr.statut ? curr.statut.toLowerCase() : '';

        if (Number(curr.etape) === 9 && statutLower && STEP9.indexOf(statutLower) !== -1) {
          key = 'statut:' + statutLower;
          var info = STATUTS[statutLower];
          rang = info ? info.rang : (curr.etape * 100);
          phase = info ? info.phase : C.PHASE_NAMES[curr.etape];
          statut = statutLower;
        } else {
          key = 'etape:' + curr.etape;
          rang = curr.etape * 100;
          phase = curr.phase || C.PHASE_NAMES[curr.etape];
        }

        if (!buckets[key]) buckets[key] = { etape: Number(curr.etape), phase: phase, statut: statut, rang: rang, days: [] };
        buckets[key].days.push(days);
      }
    });

    return Object.keys(buckets).map(function(key) {
      var b = buckets[key];
      var sorted = b.days.slice().sort(function(a, c) { return a - c; });
      var sum = 0;
      for (var j = 0; j < sorted.length; j++) sum += sorted[j];
      return {
        etape: b.etape,
        phase: b.phase,
        statut: b.statut,
        rang: b.rang,
        median_days: U.round1(U.medianCalc(b.days)),
        avg_days: U.round1(sum / sorted.length),
        min_days: sorted[0],
        max_days: sorted[sorted.length - 1],
        p25_days: M.percentile(sorted, 25),
        p75_days: M.percentile(sorted, 75),
        count: b.days.length
      };
    }).sort(function(a, b) { return a.rang - b.rang; });
  }

  function renderDurationChart() {
    var canvas = document.getElementById('duration-chart');
    var noData = document.getElementById('duration-no-data');
    var container = document.getElementById('duration-chart-container');
    var statsDiv = document.getElementById('duration-stats');
    var data = computeDurationAtStep(state.grouped);

    data = data.filter(function(d) { return d.median_days > 0 && d.count >= 2 && d.etape >= 2; });

    if (!data.length) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      if (statsDiv) statsDiv.style.display = 'none';
      CH.destroy('duration');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    // Find slowest step and total transitions
    var totalTransitions = 0;
    var slowest = data[0];
    var fastest = data[0];
    for (var k = 0; k < data.length; k++) {
      totalTransitions += data[k].count;
      if (data[k].median_days > slowest.median_days) slowest = data[k];
      if (data[k].median_days < fastest.median_days) fastest = data[k];
    }

    // Stats cards
    if (statsDiv) {
      var slowLabel = slowest.statut && STEP9_SHORT[slowest.statut]
        ? STEP9_SHORT[slowest.statut]
        : (C.PHASE_SHORT[slowest.etape] || slowest.phase);
      var fastLabel = fastest.statut && STEP9_SHORT[fastest.statut]
        ? STEP9_SHORT[fastest.statut]
        : (C.PHASE_SHORT[fastest.etape] || fastest.phase);
      statsDiv.style.display = 'flex';
      statsDiv.innerHTML =
        '<div class="chart-stat"><span class="chart-stat-value">' + totalTransitions + '</span><span class="chart-stat-label">passages observés</span></div>' +
        '<div class="chart-stat"><span class="chart-stat-value" style="color:#10b981">' + U.formatDuration(Math.round(fastest.median_days)) + '</span><span class="chart-stat-label">étape la plus rapide<br><small style="color:var(--text-dim)">' + U.escapeHtml(fastLabel) + '</small></span></div>' +
        '<div class="chart-stat"><span class="chart-stat-value" style="color:#ef4444">' + U.formatDuration(Math.round(slowest.median_days)) + '</span><span class="chart-stat-label">étape la plus lente<br><small style="color:var(--text-dim)">' + U.escapeHtml(slowLabel) + '</small></span></div>';
    }

    var labels = [];
    var values = [];
    var colors = [];
    var stepData = [];

    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var sousEtape = C.formatSubStep(d.rang);
      var shortName = d.statut && STEP9_SHORT[d.statut]
        ? STEP9_SHORT[d.statut]
        : (C.PHASE_SHORT[d.etape] || d.phase);
      labels.push(sousEtape + ' \u2014 ' + shortName);
      values.push(d.median_days);
      colors.push(C.STEP_COLORS[d.etape] || C.STEP_COLORS[0]);
      stepData.push(d);
    }

    // Dynamic height based on bar count
    container.style.height = Math.max(250, data.length * 38 + 50) + 'px';
    container.style.minHeight = 'auto';

    var config = CH.horizontalBarConfig(labels, values, colors, {
      suffix: 'j',
      datalabels: {
        color: '#e2e8f0',
        font: { size: 11, weight: 'bold' },
        anchor: 'end',
        align: 'right',
        formatter: function(value, ctx) {
          return U.formatDuration(Math.round(value)) + ' (' + stepData[ctx.dataIndex].count + ' dossiers)';
        }
      }
    });

    // Register datalabels plugin
    if (typeof ChartDataLabels !== 'undefined') {
      config.plugins = [ChartDataLabels];
    }

    // Enriched tooltip
    config.options.plugins.tooltip = {
      callbacks: {
        title: function(items) { return items[0].label; },
        label: function(ctx) {
          var d = stepData[ctx.dataIndex];
          return 'Attente habituelle : ' + U.formatDuration(Math.round(d.median_days));
        },
        afterLabel: function(ctx) {
          var d = stepData[ctx.dataIndex];
          var lines = [];
          lines.push('Le plus rapide : ' + U.formatDuration(d.min_days));
          lines.push('Le plus long : ' + U.formatDuration(d.max_days));
          if (d.count >= 4) {
            lines.push('25% passent en moins de ' + U.formatDuration(d.p25_days));
            lines.push('75% passent en moins de ' + U.formatDuration(d.p75_days));
          }
          lines.push(d.count + ' dossiers observés');
          return lines;
        }
      }
    };

    // Extra right padding for datalabels
    config.options.layout = { padding: { right: 160 } };

    CH.create('duration', 'duration-chart', config);
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
    var statsDiv = document.getElementById('histogram-stats');

    var filtered = applyHistogramFilters(allSummaries);
    var days = filtered.filter(function(s) { return s.daysSinceDeposit != null; }).map(function(s) { return s.daysSinceDeposit; });

    if (!days.length) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      if (statsDiv) statsDiv.style.display = 'none';
      CH.destroy('histogram');
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    // Stats
    var avg = Math.round(days.reduce(function(a, b) { return a + b; }, 0) / days.length);
    var med = Math.round(U.medianCalc(days));
    var maxD = Math.max.apply(null, days);
    var total = days.length;

    // Percentiles
    var sorted = days.slice().sort(function(a, b) { return a - b; });
    var p25 = Math.round(M.percentile(sorted, 25));
    var p75 = Math.round(M.percentile(sorted, 75));

    // Render stats cards
    if (statsDiv) {
      statsDiv.style.display = 'flex';
      statsDiv.innerHTML =
        '<div class="chart-stat"><span class="chart-stat-value">' + total + '</span><span class="chart-stat-label">dossiers suivis</span></div>' +
        '<div class="chart-stat"><span class="chart-stat-value" style="color:#10b981">' + U.formatDuration(p25) + '</span><span class="chart-stat-label">25% attendent moins de</span></div>' +
        '<div class="chart-stat"><span class="chart-stat-value" style="color:#3b82f6">' + U.formatDuration(med) + '</span><span class="chart-stat-label">attente habituelle</span></div>' +
        '<div class="chart-stat"><span class="chart-stat-value" style="color:#f59e0b">' + U.formatDuration(p75) + '</span><span class="chart-stat-label">75% attendent moins de</span></div>' +
        '<div class="chart-stat"><span class="chart-stat-value" style="color:#ef4444">' + U.formatDuration(maxD) + '</span><span class="chart-stat-label">le plus ancien</span></div>';
    }

    // Buckets of 60 days (~2 mois)
    var bucketSize = 60;
    var numBuckets = Math.ceil(maxD / bucketSize) + 1;
    var buckets = new Array(numBuckets).fill(0);
    var labels = [];

    for (var i = 0; i < numBuckets; i++) {
      var fromM = i * 2;
      var toM = (i + 1) * 2;
      labels.push(fromM + '-' + toM + ' mois');
    }
    for (var j = 0; j < days.length; j++) {
      var idx = Math.min(Math.floor(days[j] / bucketSize), numBuckets - 1);
      buckets[idx]++;
    }

    // Cumulative percentages for tooltips
    var cumulative = [];
    var cumSum = 0;
    for (var k = 0; k < buckets.length; k++) {
      cumSum += buckets[k];
      cumulative.push(Math.round(cumSum / total * 100));
    }

    var datasets = [{
      label: 'Dossiers',
      data: buckets,
      backgroundColor: 'rgba(59,130,246,0.5)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4
    }];

    var config = CH.barConfig(labels, datasets, { suffix: '', ySuffix: '', datalabels: {
      color: '#e2e8f0',
      font: { size: 10, weight: 'bold' },
      anchor: 'end',
      align: 'top',
      formatter: function(v) {
        if (!v) return '';
        var pct = Math.round(v / total * 100);
        return v + ' (' + pct + '%)';
      }
    }});
    config.options.plugins.legend = { display: false };
    config.options.layout = { padding: { top: 25 } };

    // Enriched tooltip
    config.options.plugins.tooltip = {
      callbacks: {
        title: function(items) {
          var i = items[0].dataIndex;
          var fromDays = i * bucketSize;
          var toDays = (i + 1) * bucketSize;
          return U.formatDuration(fromDays) + ' \u2192 ' + U.formatDuration(toDays);
        },
        label: function(ctx) {
          var count = ctx.parsed.y;
          var pct = Math.round(count / total * 100);
          return count + ' dossier' + (count > 1 ? 's' : '') + ' (' + pct + '%)';
        },
        afterLabel: function(ctx) {
          return cumulative[ctx.dataIndex] + '% attendent depuis \u2264 ' + U.formatDuration((ctx.dataIndex + 1) * bucketSize);
        }
      }
    };

    // Median & average vertical lines (custom plugin)
    var medBucket = med / bucketSize;
    var avgBucket = avg / bucketSize;
    var refLinesPlugin = {
      id: 'histogramRefLines',
      afterDraw: function(chart) {
        var xScale = chart.scales.x;
        var yScale = chart.scales.y;
        var ctx = chart.ctx;

        var lines = [
          { val: medBucket, color: '#3b82f6', label: 'Attente habituelle : ' + U.formatDuration(med) },
          { val: avgBucket, color: '#f59e0b', label: 'Attente moyenne : ' + U.formatDuration(avg) }
        ];

        for (var i = 0; i < lines.length; i++) {
          var l = lines[i];
          // x position: interpolate between bar centers
          var barIdx = Math.floor(l.val);
          var frac = l.val - barIdx;
          if (barIdx >= xScale.ticks.length) continue;

          var x1 = xScale.getPixelForTick(barIdx);
          var x2 = barIdx + 1 < xScale.ticks.length ? xScale.getPixelForTick(barIdx + 1) : x1;
          var xPos = x1 + (x2 - x1) * frac;

          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 2;
          ctx.moveTo(xPos, yScale.top);
          ctx.lineTo(xPos, yScale.bottom);
          ctx.stroke();

          // Label
          ctx.setLineDash([]);
          ctx.fillStyle = l.color;
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = xPos > chart.width / 2 ? 'right' : 'left';
          var xLabel = xPos > chart.width / 2 ? xPos - 6 : xPos + 6;
          ctx.fillText(l.label, xLabel, yScale.top + 14 + i * 16);
          ctx.restore();
        }
      }
    };

    config.plugins = config.plugins || [];
    config.plugins.push(refLinesPlugin);

    CH.create('histogram', 'histogram-chart', config);
  }

})();
