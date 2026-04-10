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
    F.createSearchablePrefectureDropdown('histogram-filter-prefecture-container', prefectures, '', function(v) {
      state.histogramFilters.prefecture = v || 'all'; renderAll();
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
      var daysAtStatus, totalDuration;
      if (s.isFinished) {
        daysAtStatus = s.dateStatut ? U.formatDateFr(s.dateStatut) : 'Termin\u00e9';
        totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';
      } else {
        daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '\u2014';
        totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';
      }

      var triBadge = s.currentStep === 3 ? ' <span class="badge-tri">Tri</span>' : '';
      var sansEntretien = s.currentStep === 8 && !s.dateEntretien && s.stepsTraversed.indexOf(7) === -1;
      var sansEntretienBadge = sansEntretien ? ' <span class="badge-decision-sans-entretien">\u26A0 Sans entretien</span>' : '';
      var finishedBadge = s.isFinished ? (C.isPositiveStatus(s.statut) || s.currentStep === 11 ? ' <span class="badge-finished-ok">\u2713 Termin\u00e9</span>' : ' <span class="badge-finished-ko">\u2717 Cl\u00f4tur\u00e9</span>') : '';

      html += '<div class="dossier-row" style="--card-accent:' + color + '" data-row-idx="' + i + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-step" style="background:' + color + '">' + s.sousEtape + '/12</span>' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
          '</div>' +
          '<div class="dossier-row-status" title="' + U.escapeHtml(s.statut) + '">' +
            '<span class="statut-label">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</span>' +
            triBadge + sansEntretienBadge + finishedBadge +
          '</div>' +
          '<div class="dossier-row-meta">' +
            '<span>' + (s.isFinished ? daysAtStatus : daysAtStatus + ' au statut') + '</span>' +
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
        var days = null;
        if (snap.date_statut && nextSnap.date_statut) {
          days = U.daysDiff(snap.date_statut, nextSnap.date_statut);
        }
        if (!days && snap.created_at && nextSnap.created_at) {
          days = U.daysDiff(snap.created_at, nextSnap.created_at);
        }
        if (days !== null) {
          var dColor = days >= 60 ? 'var(--red);background:rgba(239,68,68,0.12)' :
                       days >= 30 ? 'var(--orange);background:rgba(245,158,11,0.12)' :
                                    'var(--green);background:rgba(16,185,129,0.12)';
          durationHtml = '<span class="ts-duration" style="color:' + dColor + '">' + U.formatDuration(days) + ' \u00e0 ce statut</span>';
        }
      } else {
        var isTerminated = C.isFinished({ etape: snap.etape, statut: snap.statut });
        if (isTerminated) {
          durationHtml = '<span class="ts-duration" style="color:var(--green);background:rgba(16,185,129,0.12)">\u2705 Termin\u00e9</span>';
        } else {
          var today = new Date(); today.setHours(0, 0, 0, 0);
          days = snap.date_statut ? U.daysDiff(snap.date_statut, today) : null;
          if (!days && snap.created_at) {
            days = U.daysDiff(snap.created_at, today);
          }
          if (days !== null) {
            durationHtml = '<span class="ts-duration" style="color:var(--primary-light);background:rgba(59,130,246,0.12)">' + U.formatDuration(days) + ' (en cours)</span>';
          }
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

    var daysAtStatus, totalDuration, durationLabel;
    if (s.isFinished) {
      daysAtStatus = s.dateStatut ? U.formatDateFr(s.dateStatut) : 'Termin\u00e9';
      durationLabel = 'Finalis\u00e9 le';
    } else {
      daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '\u2014';
      durationLabel = 'Au statut actuel';
    }
    totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

    var infoItems = '';
    if (s.prefecture) infoItems += '<div class="dossier-info-item"><span class="info-label">Pr\u00e9fecture</span><span class="info-value">' + U.escapeHtml(s.prefecture) + '</span></div>';
    if (s.dateEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Entretien</span><span class="info-value">' + U.formatDateFr(s.dateEntretien) + '</span></div>';
    if (s.lieuEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Lieu</span><span class="info-value">' + U.escapeHtml(s.lieuEntretien) + '</span></div>';
    if (s.numeroDecret) infoItems += '<div class="dossier-info-item"><span class="info-label">D\u00e9cret</span><span class="info-value">' + U.escapeHtml(s.numeroDecret) + '</span></div>';

    var complementBadge = s.hasComplement ? '<span class="badge-complement">Compl\u00e9ment demand\u00e9</span>' : '';
    var checkedHtml = s.lastChecked ? '<span style="font-size:0.72rem;color:var(--text-dim)">V\u00e9rifi\u00e9 le ' + U.formatDateTimeFr(s.lastChecked) + '</span>' : '';

    // Status history timeline
    var snaps = state.grouped.get(s.fullHash) || [];
    var timelineHtml = snaps.length > 0 ? buildStatusTimeline(snaps) : '';

    return '<div class="dossier-progress">' +
        '<div class="progress-track">' + progressHtml + '</div>' +
        '<div class="progress-label" title="' + U.escapeHtml(s.statut) + '">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</div>' +
      '</div>' +
      '<div class="dossier-durations">' +
        '<div class="duration-item"><span class="duration-label">' + durationLabel + '</span><span class="duration-value" style="color:' + color + '">' + daysAtStatus + '</span></div>' +
        '<div class="duration-item"><span class="duration-label">Depuis le d\u00e9p\u00f4t</span><span class="duration-value">' + totalDuration + '</span></div>' +
      '</div>' +
      (infoItems ? '<div class="dossier-info">' + infoItems + '</div>' : '') +
      (complementBadge ? '<div class="dossier-footer">' + complementBadge + '</div>' : '') +
      (checkedHtml ? '<div class="dossier-footer">' + checkedHtml + '</div>' : '') +
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
    var sansEntretienCard = s.currentStep === 8 && !s.dateEntretien && s.stepsTraversed.indexOf(7) === -1;
    var sansEntretienBadgeCard = sansEntretienCard ? ' <span class="badge-decision-sans-entretien">\u26A0 Sans entretien</span>' : '';

    var daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '\u2014';
    var totalDuration = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

    var infoItems = '';
    if (s.prefecture) infoItems += '<div class="dossier-info-item"><span class="info-label">Préfecture</span><span class="info-value">' + U.escapeHtml(s.prefecture) + '</span></div>';
    if (s.dateEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Entretien</span><span class="info-value">' + U.formatDateFr(s.dateEntretien) + '</span></div>';
    if (s.lieuEntretien) infoItems += '<div class="dossier-info-item"><span class="info-label">Lieu</span><span class="info-value">' + U.escapeHtml(s.lieuEntretien) + '</span></div>';
    if (s.numeroDecret) infoItems += '<div class="dossier-info-item"><span class="info-label">Décret</span><span class="info-value">' + U.escapeHtml(s.numeroDecret) + '</span></div>';

    var complementBadge = s.hasComplement ? '<span class="badge-complement">Complément demandé</span>' : '';
    var checkedHtml2 = s.lastChecked ? '<span style="font-size:0.72rem;color:var(--text-dim)">Vérifié le ' + U.formatDateTimeFr(s.lastChecked) + '</span>' : '';

    return '<div class="dossier-card" style="--card-accent:' + color + '">' +
      '<div class="dossier-header">' +
        '<span class="dossier-hash">#' + U.escapeHtml(s.hash) + '</span>' +
        '<span class="dossier-step-badge" style="background:' + color + '">' + s.sousEtape + '/12</span>' +
      '</div>' +
      '<div class="dossier-progress">' +
        '<div class="progress-track">' + progressHtml + '</div>' +
        '<div class="progress-label" title="' + U.escapeHtml(s.statut) + '">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + triBadge + sansEntretienBadgeCard + '</div>' +
      '</div>' +
      '<div class="dossier-durations">' +
        '<div class="duration-item"><span class="duration-label">Au statut actuel</span><span class="duration-value" style="color:' + color + '">' + daysAtStatus + '</span></div>' +
        '<div class="duration-item"><span class="duration-label">Depuis le dépôt</span><span class="duration-value">' + totalDuration + '</span></div>' +
      '</div>' +
      (infoItems ? '<div class="dossier-info">' + infoItems + '</div>' : '') +
      (complementBadge ? '<div class="dossier-footer">' + complementBadge + '</div>' : '') +
      (checkedHtml2 ? '<div class="dossier-footer">' + checkedHtml2 + '</div>' : '') +
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
      var hash = snaps[0] ? (snaps[0].dossier_hash || '').substring(0, 6) : '';
      var fullHash = snaps[0] ? snaps[0].dossier_hash : '';
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

        if (!buckets[key]) buckets[key] = { etape: Number(curr.etape), phase: phase, statut: statut, rang: rang, days: [], dossiers: [] };
        buckets[key].days.push(days);
        buckets[key].dossiers.push({ hash: hash, fullHash: fullHash, days: days, dateFrom: curr.date_statut, dateTo: next.date_statut });
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
        count: b.days.length,
        dossiers: b.dossiers
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

    // Dynamic height based on bar count — compact on mobile
    var isMobile = window.innerWidth <= 600;
    var barH = isMobile ? 26 : 38;
    container.style.height = Math.max(250, data.length * barH + 30) + 'px';
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

    // Click on bar → show dossier list for that step
    config.options.onClick = function(evt, elements) {
      if (!elements || !elements.length) return;
      var idx = elements[0].index;
      if (stepData[idx]) showDurationStepDossiers(stepData[idx]);
    };
    config.options.onHover = function(evt, elements) {
      evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
    };

    CH.create('duration', 'duration-chart', config);
  }

  // ─── Duration Step → Dossier List Modal ────────────────────

  function findSummaryByHash(hash) {
    for (var i = 0; i < state.summaries.length; i++) {
      if (state.summaries[i].hash === hash) return state.summaries[i];
    }
    return null;
  }

  function showDurationStepDossiers(stepInfo) {
    var sousEtape = C.formatSubStep(stepInfo.rang);
    var shortName = stepInfo.statut && STEP9_SHORT[stepInfo.statut]
      ? STEP9_SHORT[stepInfo.statut]
      : (C.PHASE_SHORT[stepInfo.etape] || stepInfo.phase);
    var title = sousEtape + ' \u2014 ' + shortName;
    var color = C.STEP_COLORS[stepInfo.etape] || '#64748b';

    // Sort dossiers by duration desc
    var dossiers = stepInfo.dossiers.slice().sort(function(a, b) { return b.days - a.days; });

    // Duration filter ranges
    var RANGES = [
      { key: 'all', label: 'Tous', min: 0, max: Infinity },
      { key: 'lt1', label: '\u2264 1 jour', min: 0, max: 2 },
      { key: 'lt7', label: '\u2264 1 semaine', min: 0, max: 8 },
      { key: 'lt14', label: '\u2264 2 semaines', min: 0, max: 15 },
      { key: 'lt30', label: '\u2264 1 mois', min: 0, max: 31 },
      { key: 'lt90', label: '\u2264 3 mois', min: 0, max: 91 },
      { key: 'gt90', label: '> 3 mois', min: 91, max: Infinity }
    ];
    // Count per range
    var rangeCounts = {};
    for (var r = 0; r < RANGES.length; r++) rangeCounts[RANGES[r].key] = 0;
    for (var c = 0; c < dossiers.length; c++) {
      var dd = dossiers[c].days;
      for (var r2 = 1; r2 < RANGES.length; r2++) {
        if (dd >= RANGES[r2].min && dd < RANGES[r2].max) rangeCounts[RANGES[r2].key]++;
      }
    }
    rangeCounts.all = dossiers.length;
    var totalDossiers = dossiers.length;

    // Stats header
    var statsHtml =
      '<div class="duration-stats-grid">' +
        '<div class="duration-stat-card"><span class="duration-stat-value">' + stepInfo.count + '</span><span class="duration-stat-label">passages</span></div>' +
        '<div class="duration-stat-card"><span class="duration-stat-value" style="color:#3b82f6">' + U.formatDuration(Math.round(stepInfo.median_days)) + '</span><span class="duration-stat-label">m\u00e9diane</span></div>' +
        '<div class="duration-stat-card"><span class="duration-stat-value" style="color:#10b981">' + (stepInfo.min_days === 0 ? '< 1 jour' : U.formatDuration(stepInfo.min_days)) + '</span><span class="duration-stat-label">min</span></div>' +
        '<div class="duration-stat-card"><span class="duration-stat-value" style="color:#ef4444">' + U.formatDuration(stepInfo.max_days) + '</span><span class="duration-stat-label">max</span></div>' +
      '</div>';

    // Filter row: select + result
    var filterHtml = '<div class="duration-filter-row">' +
      '<select class="duration-filter-select">';
    for (var f = 0; f < RANGES.length; f++) {
      var rng = RANGES[f];
      var cnt = rangeCounts[rng.key];
      var pct = totalDossiers ? Math.round(cnt / totalDossiers * 100) : 0;
      var optLabel = rng.key === 'all'
        ? rng.label + ' (' + cnt + ')'
        : rng.label + ' \u2014 ' + cnt + ' (' + pct + '%)';
      filterHtml += '<option value="' + rng.key + '">' + optLabel + '</option>';
    }
    filterHtml += '</select>' +
      '<span class="duration-filter-result"></span>' +
    '</div>';

    // Dossier list
    var listHtml = '';
    for (var i = 0; i < dossiers.length; i++) {
      var d = dossiers[i];
      var summary = findSummaryByHash(d.hash);
      var dColor = summary ? C.getStepColor(summary.currentStep) : color;
      var daysColor = d.days >= 60 ? '#ef4444' : d.days >= 30 ? '#f59e0b' : '#10b981';

      listHtml += '<div class="mouvement-dossier-item" data-hash="' + U.escapeHtml(d.hash) + '" data-full-hash="' + U.escapeHtml(d.fullHash) + '" data-days="' + d.days + '">' +
        '<span class="activity-dot" style="background:' + dColor + ';flex-shrink:0"></span>' +
        '<div class="mouvement-dossier-content">' +
          '<div class="mouvement-dossier-top">' +
            '<span class="activity-hash">#' + U.escapeHtml(d.hash) + '</span>' +
            '<span class="detail-badge" style="background:' + dColor + ';font-size:0.7rem;padding:0.1rem 0.4rem">' +
              (summary ? U.escapeHtml(summary.sousEtape) : sousEtape) +
            '</span>' +
          '</div>' +
          '<div class="mouvement-dossier-desc">' +
            '<span class="duration-dossier-duration" style="color:' + daysColor + '">' + (d.days === 0 ? '< 1 jour' : U.formatDuration(d.days)) + '</span> \u00e0 cette \u00e9tape' +
          '</div>' +
          '<div class="mouvement-dossier-detail">' +
            U.formatDateFr(d.dateFrom) + ' \u2192 ' + U.formatDateFr(d.dateTo) +
            (summary && summary.prefecture ? ' \u2014 ' + U.escapeHtml(summary.prefecture) : '') +
          '</div>' +
        '</div>' +
        '<span class="mouvement-chevron">\u203a</span>' +
      '</div>';
    }

    var modal = document.getElementById('duration-step-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'duration-step-modal';
      modal.className = 'history-modal-overlay';
      modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('open');
      });
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="history-modal">' +
        '<div class="history-modal-header">' +
          '<div class="duration-modal-header">' +
            '<span class="activity-dot" style="background:' + color + ';color:' + color + '"></span>' +
            '<h3>' + U.escapeHtml(title) + '</h3>' +
          '</div>' +
          '<button class="history-close" title="Fermer">\u00d7</button>' +
        '</div>' +
        '<div class="modal-history-list mouvement-dossier-list">' +
          statsHtml +
          filterHtml +
          listHtml +
        '</div>' +
      '</div>';

    modal.querySelector('.history-close').addEventListener('click', function() {
      modal.classList.remove('open');
    });

    // Filter select handler
    var select = modal.querySelector('.duration-filter-select');
    var resultEl = modal.querySelector('.duration-filter-result');
    select.addEventListener('change', function() {
      var rangeKey = select.value;
      var range = null;
      for (var rr = 0; rr < RANGES.length; rr++) {
        if (RANGES[rr].key === rangeKey) { range = RANGES[rr]; break; }
      }
      var allItems = modal.querySelectorAll('.mouvement-dossier-item');
      var visibleCount = 0;
      allItems.forEach(function(item) {
        var days = parseInt(item.getAttribute('data-days'), 10);
        var show = rangeKey === 'all' || (days >= range.min && days < range.max);
        item.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });
      if (rangeKey === 'all') {
        resultEl.textContent = '';
      } else {
        var pct = Math.round(visibleCount / totalDossiers * 100);
        resultEl.innerHTML = '<span class="duration-filter-result-count">' + visibleCount + '</span>/' + totalDossiers +
          ' <span class="duration-filter-result-pct">(' + pct + '%)</span>';
      }
    });

    // Click dossier → detail
    var items = modal.querySelectorAll('.mouvement-dossier-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function(ev) {
        var hash = ev.currentTarget.getAttribute('data-hash');
        var fullHash = ev.currentTarget.getAttribute('data-full-hash');
        modal.classList.remove('open');
        showDurationDossierDetail(hash, fullHash, { durationStep: stepInfo });
      });
    }

    modal.classList.add('open');
  }

  // ─── Duration Dossier Detail Modal ─────────────────────────

  function buildDossierInfoHtml(s) {
    if (!s) return '';
    var color = C.getStepColor(s.currentStep);
    var items = [];

    items.push('<span class="detail-badge" style="background:' + color + '">' + U.escapeHtml(s.sousEtape + '/12 \u2014 ' + s.explication) + '</span>');

    if (s.dateDepot) items.push('<div class="detail-row"><span class="detail-label">D\u00e9p\u00f4t</span><span>' + U.formatDateFr(s.dateDepot) + '</span></div>');
    if (s.dateStatut) {
      if (s.isFinished) {
        items.push('<div class="detail-row"><span class="detail-label">Finalis\u00e9 le</span><span>' + U.formatDateFr(s.dateStatut) + '</span></div>');
      } else {
        items.push('<div class="detail-row"><span class="detail-label">Statut depuis</span><span>' + U.formatDateFr(s.dateStatut) + (s.daysAtCurrentStatus != null ? ' (' + U.formatDuration(s.daysAtCurrentStatus) + ')' : '') + '</span></div>');
      }
    }
    if (s.daysSinceDeposit != null) items.push('<div class="detail-row"><span class="detail-label">Dur\u00e9e totale</span><span>' + U.formatDuration(s.daysSinceDeposit) + '</span></div>');
    if (s.dateEntretien) items.push('<div class="detail-row"><span class="detail-label">Entretien</span><span>' + U.formatDateFr(s.dateEntretien) + '</span></div>');
    if (s.lieuEntretien) items.push('<div class="detail-row"><span class="detail-label">Lieu</span><span>' + U.escapeHtml(s.lieuEntretien) + '</span></div>');
    if (s.prefecture) items.push('<div class="detail-row"><span class="detail-label">Pr\u00e9fecture</span><span>' + U.escapeHtml(s.prefecture) + '</span></div>');
    if (s.numeroDecret) items.push('<div class="detail-row"><span class="detail-label">D\u00e9cret</span><span>' + U.escapeHtml(s.numeroDecret) + '</span></div>');
    if (s.hasComplement) items.push('<div class="detail-row"><span class="detail-label">Compl\u00e9ment</span><span style="color:var(--orange)">Demand\u00e9</span></div>');
    if (s.lastChecked) items.push('<div class="detail-row"><span class="detail-label">Derni\u00e8re v\u00e9rif.</span><span style="color:var(--text-dim)">' + U.formatDateTimeFr(s.lastChecked) + '</span></div>');

    return '<div class="dossier-detail-info">' + items.join('') + '</div>';
  }

  function showDurationDossierDetail(hash, fullHash, backTo) {
    var summary = findSummaryByHash(hash);
    var snaps = state.grouped.get(fullHash) || [];

    var infoHtml = buildDossierInfoHtml(summary);
    var timelineHtml = snaps.length > 0 ? buildStatusTimeline(snaps) : '<div class="detail-section-label" style="color:var(--text-dim)">Aucun historique disponible</div>';
    var historyLabel = snaps.length > 0 ? '<div class="detail-section-label">Historique des statuts</div>' : '';

    var modal = document.getElementById('duration-dossier-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'duration-dossier-modal';
      modal.className = 'history-modal-overlay';
      modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('open');
      });
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="history-modal">' +
        '<div class="history-modal-header">' +
          '<button class="history-back" title="Retour">\u2190</button>' +
          '<h3>Dossier #' + U.escapeHtml(hash) + '</h3>' +
          '<button class="history-close" title="Fermer">\u00d7</button>' +
        '</div>' +
        '<div class="modal-history-list">' +
          infoHtml +
          historyLabel +
          timelineHtml +
        '</div>' +
      '</div>';

    modal.querySelector('.history-close').addEventListener('click', function() {
      modal.classList.remove('open');
    });

    modal.querySelector('.history-back').addEventListener('click', function() {
      modal.classList.remove('open');
      if (backTo && backTo.durationStep) {
        showDurationStepDossiers(backTo.durationStep);
      }
    });

    modal.classList.add('open');
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
    // Exclure les dossiers terminés (durée figée, pas comparable aux dossiers en cours)
    var days = filtered.filter(function(s) { return s.daysSinceDeposit != null && !s.isFinished; }).map(function(s) { return s.daysSinceDeposit; });

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
