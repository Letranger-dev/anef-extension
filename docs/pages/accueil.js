/**
 * pages/accueil.js — Page Accueil (dashboard)
 */
(function() {
  'use strict';

  var C = ANEF.constants;
  var U = ANEF.utils;
  var D = ANEF.data;
  var CH = ANEF.charts;

  document.addEventListener('DOMContentLoaded', async function() {
    CH.registerDarkTheme();

    var loading = document.getElementById('loading');
    var main = document.getElementById('main-content');

    try {
      var snapshots = await D.loadData();

      if (!snapshots.length) {
        loading.innerHTML = '<div class="error-msg"><p>Aucune donnée disponible pour le moment.</p>' +
          '<p style="font-size:0.85rem;margin-top:0.5rem;color:#94a3b8">Les données apparaîtront quand des utilisateurs partageront leurs statistiques.</p></div>';
        return;
      }

      var grouped = D.groupByDossier(snapshots);
      var summaries = D.computeDossierSummaries(grouped);

      loading.style.display = 'none';
      main.style.display = 'block';

      renderKPIs(summaries, snapshots);
      renderTimeline(summaries);
      renderSdanfWait(summaries);
      renderEntretienPipeline(summaries);
      renderActivityFeed(snapshots, grouped);

    } catch (error) {
      loading.innerHTML = '<div class="error-msg"><p>Impossible de charger les statistiques.</p>' +
        '<p style="font-size:0.85rem;margin-top:0.5rem;color:#94a3b8">' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function renderKPIs(summaries, snapshots) {
    // Dossiers suivis
    U.setText('kpi-dossiers', summaries.length);
    var prefSet = {};
    for (var j = 0; j < summaries.length; j++) {
      if (summaries[j].prefecture) prefSet[summaries[j].prefecture] = true;
    }
    var nbPref = Object.keys(prefSet).length;
    U.setText('kpi-dossiers-sub', nbPref + ' préfecture' + (nbPref > 1 ? 's' : ''));

    // Duree moyenne depuis le depot
    var withDeposit = summaries.filter(function(s) { return s.daysSinceDeposit != null; });
    if (withDeposit.length > 0) {
      var totalDays = 0;
      for (var i = 0; i < withDeposit.length; i++) {
        totalDays += withDeposit[i].daysSinceDeposit;
      }
      var avgDays = Math.round(totalDays / withDeposit.length);
      U.setText('kpi-avg-days', U.formatDuration(avgDays));
      U.setText('kpi-avg-sub', 'depuis le dépôt (' + withDeposit.length + ' dossiers)');
    }

    // Derniere mise a jour
    if (snapshots.length > 0) {
      var latest = snapshots[0].created_at;
      for (var k = 1; k < snapshots.length; k++) {
        if (snapshots[k].created_at > latest) latest = snapshots[k].created_at;
      }
      U.setText('kpi-updated', U.formatDateTimeFr(latest));
    }
  }

  function renderTimeline(summaries) {
    var wrapper = document.getElementById('timeline-wrapper');
    var byStep = {};
    var maxCount = 0;
    for (var i = 0; i < summaries.length; i++) {
      var s = summaries[i];
      if (!byStep[s.currentStep]) byStep[s.currentStep] = [];
      byStep[s.currentStep].push(s);
    }
    for (var k in byStep) {
      if (byStep[k].length > maxCount) maxCount = byStep[k].length;
    }

    function makeBubble(count, color, tooltip) {
      var ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0;
      var size = Math.round(24 + ratio * 28);
      return '<div class="station-bubble" style="background:' + color + ';width:' + size + 'px;height:' + size + 'px" title="' + U.escapeHtml(tooltip) + '">' + count + '</div>';
    }

    var html = '<div class="global-timeline">';
    for (var step = 1; step <= 12; step++) {
      var dossiers = byStep[step] || [];
      var count = dossiers.length;
      var color = C.STEP_COLORS[step];
      var isActive = count > 0;

      var bubbleHtml = '';
      if (count > 0) {
        if (step === 9) {
          // Split SDANF vs SCEC
          var sdanf = 0, scec = 0;
          for (var j = 0; j < dossiers.length; j++) {
            if (dossiers[j].rang >= 903) scec++;
            else sdanf++;
          }
          bubbleHtml = '<div class="station-sub-bubbles">';
          if (sdanf > 0) bubbleHtml += '<span class="station-sub-bubble" style="background:' + color + '" title="' + sdanf + ' dossier' + (sdanf > 1 ? 's' : '') + ' au controle SDANF"><span class="station-sub-label">SDANF</span>' + sdanf + '</span>';
          if (scec > 0) bubbleHtml += '<span class="station-sub-bubble" style="background:' + color + '" title="' + scec + ' dossier' + (scec > 1 ? 's' : '') + ' au controle SCEC"><span class="station-sub-label">SCEC</span>' + scec + '</span>';
          bubbleHtml += '</div>';
        } else {
          var tooltip = count + ' dossier' + (count > 1 ? 's' : '') + ' \u2014 ' + C.PHASE_NAMES[step];
          bubbleHtml = makeBubble(count, color, tooltip);
        }
      }

      html += '<div class="timeline-station ' + (isActive ? 'active' : '') + '">' +
        '<div class="station-dot" style="--dot-color:' + color + '"></div>' +
        '<div class="station-number">' + step + '</div>' +
        '<div class="station-name">' + C.PHASE_SHORT[step] + '</div>' +
        bubbleHtml +
        '</div>';
    }
    html += '</div>';
    wrapper.innerHTML = html;
  }

  // ─── File d'attente SDANF ────────────────────────────────

  var sdanfState = { all: [], filtered: [], page: 1, pageSize: 5, sort: 'days-desc', pref: '', statut: '' };

  function renderSdanfWait(summaries) {
    // Filter dossiers at etape 9 (all SDANF & SCEC statuses)
    sdanfState.all = summaries.filter(function(s) { return s.currentStep === 9; });

    // Populate statut filter
    var STATUT_LABELS = {
      'controle_a_affecter': 'Attente affectation',
      'controle_a_effectuer': 'Contrôle en cours',
      'controle_en_attente_pec': 'Transmis SCEC',
      'controle_pec_a_faire': 'Vérif. état civil'
    };
    var statuts = {};
    var prefs = {};
    for (var i = 0; i < sdanfState.all.length; i++) {
      var st = sdanfState.all[i].statut;
      if (st) statuts[st] = true;
      var p = sdanfState.all[i].prefecture;
      if (p) prefs[p] = true;
    }
    var statutSelect = document.getElementById('sdanf-statut-filter');
    var statutKeys = Object.keys(statuts).sort(function(a, b) {
      var ra = C.STATUTS[a] ? C.STATUTS[a].rang : 0;
      var rb = C.STATUTS[b] ? C.STATUTS[b].rang : 0;
      return ra - rb;
    });
    for (var j = 0; j < statutKeys.length; j++) {
      var opt = document.createElement('option');
      opt.value = statutKeys[j];
      opt.textContent = STATUT_LABELS[statutKeys[j]] || statutKeys[j];
      statutSelect.appendChild(opt);
    }
    var prefSelect = document.getElementById('sdanf-pref-filter');
    Object.keys(prefs).sort().forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      prefSelect.appendChild(opt);
    });

    initSdanfControls();
    renderSdanfPage();
  }

  function getSdanfFiltered() {
    var data = sdanfState.all;
    if (sdanfState.statut) {
      data = data.filter(function(s) { return s.statut === sdanfState.statut; });
    }
    if (sdanfState.pref) {
      data = data.filter(function(s) { return s.prefecture === sdanfState.pref; });
    }
    switch (sdanfState.sort) {
      case 'days-desc':
        data = data.slice().sort(function(a, b) { return (b.daysAtCurrentStatus || 0) - (a.daysAtCurrentStatus || 0); });
        break;
      case 'days-asc':
        data = data.slice().sort(function(a, b) { return (a.daysAtCurrentStatus || 0) - (b.daysAtCurrentStatus || 0); });
        break;
      case 'pref':
        data = data.slice().sort(function(a, b) { return (a.prefecture || '').localeCompare(b.prefecture || '') || (b.daysAtCurrentStatus || 0) - (a.daysAtCurrentStatus || 0); });
        break;
    }
    return data;
  }

  function renderSdanfPage() {
    var toolbar = document.getElementById('sdanf-toolbar');
    var list = document.getElementById('sdanf-list');
    var kpis = document.getElementById('sdanf-kpis');
    var data = getSdanfFiltered();

    if (!sdanfState.all.length) {
      toolbar.style.display = 'none';
      kpis.innerHTML = '';
      list.innerHTML = '<p class="no-data">Aucun dossier au contrôle SDANF/SCEC</p>';
      return;
    }

    // KPIs — count by exact sub-status
    var subCounts = {};
    for (var k = 0; k < data.length; k++) {
      var st = data[k].statut || 'inconnu';
      subCounts[st] = (subCounts[st] || 0) + 1;
    }
    var days = data.map(function(s) { return s.daysAtCurrentStatus || 0; });
    var total = data.length;
    var maxD = total ? Math.max.apply(null, days) : 0;

    var SUB_LABELS = {
      'controle_a_affecter': { short: 'Attente affectation', cls: 'orange' },
      'controle_a_effectuer': { short: 'Contrôle en cours', cls: '' },
      'controle_en_attente_pec': { short: 'Transmis SCEC', cls: 'violet' },
      'controle_pec_a_faire': { short: 'Vérif. état civil', cls: 'violet' }
    };
    var kpiHtml = '<div class="kpi-card"><div class="kpi-label">Total étape 9</div><div class="kpi-value">' + total + '</div></div>';
    var subKeys = Object.keys(subCounts).sort(function(a, b) {
      var ra = C.STATUTS[a] ? C.STATUTS[a].rang : 0;
      var rb = C.STATUTS[b] ? C.STATUTS[b].rang : 0;
      return ra - rb;
    });
    for (var sk = 0; sk < subKeys.length; sk++) {
      var info = SUB_LABELS[subKeys[sk]] || { short: subKeys[sk], cls: '' };
      var valCls = info.cls ? ' ' + info.cls : '';
      kpiHtml += '<div class="kpi-card"><div class="kpi-label">' + U.escapeHtml(info.short) + '</div><div class="kpi-value' + valCls + '">' + subCounts[subKeys[sk]] + '</div></div>';
    }
    kpis.innerHTML = kpiHtml;

    // Pagination
    var totalPages = Math.max(1, Math.ceil(data.length / sdanfState.pageSize));
    sdanfState.page = Math.min(sdanfState.page, totalPages);
    var start = (sdanfState.page - 1) * sdanfState.pageSize;
    var pageData = data.slice(start, start + sdanfState.pageSize);

    toolbar.style.display = 'flex';
    document.getElementById('sdanf-count').textContent = data.length + ' dossier' + (data.length > 1 ? 's' : '');
    document.getElementById('sdanf-page-info').textContent = sdanfState.page + '/' + totalPages;
    document.getElementById('sdanf-btn-prev').disabled = sdanfState.page <= 1;
    document.getElementById('sdanf-btn-next').disabled = sdanfState.page >= totalPages;

    // Render rows
    var color = C.STEP_COLORS[9];
    var BADGE_MAP = {
      'controle_a_affecter': { text: '9.1 Attente affectation', cls: 'badge-entretien-non' },
      'controle_a_effectuer': { text: '9.2 Contrôle en cours', cls: 'badge-entretien-non' },
      'controle_en_attente_pec': { text: '9.3 Transmis SCEC', cls: 'badge-entretien-oui' },
      'controle_pec_a_faire': { text: '9.4 Vérif. état civil', cls: 'badge-entretien-oui' }
    };
    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      var s = pageData[i];
      var d = s.daysAtCurrentStatus || 0;
      var urgency = d >= 60 ? 'var(--red)' : d >= 30 ? 'var(--orange)' : 'var(--green)';
      var badge = BADGE_MAP[s.statut] || { text: s.sousEtape + ' ' + s.explication, cls: 'badge-entretien-non' };

      html += '<div class="dossier-row" style="--card-accent:' + color + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
            '<span class="' + badge.cls + '">' + U.escapeHtml(badge.text) + '</span>' +
          '</div>' +
          '<div class="dossier-row-status">' +
            '<code class="statut-code">' + U.escapeHtml(s.statut) + '</code>' +
          '</div>' +
          '<div class="dossier-row-meta">' +
            '<span style="font-weight:700;color:' + urgency + '">' + U.formatDuration(d) + '</span>' +
            (s.dateStatut ? '<span>depuis le ' + U.formatDateFr(s.dateStatut) + '</span>' : '') +
          '</div>' +
          (s.prefecture ? '<div style="margin-top:0.2rem"><span style="font-size:0.8rem;color:var(--primary-light);font-weight:600">' + U.escapeHtml(s.prefecture) + '</span></div>' : '') +
        '</div>' +
        '<div style="width:60px;height:6px;border-radius:3px;background:rgba(255,255,255,0.08);flex-shrink:0">' +
          '<div style="width:' + Math.min(100, Math.round(d / Math.max(maxD, 1) * 100)) + '%;height:100%;border-radius:3px;background:' + urgency + '"></div>' +
        '</div>' +
      '</div>';
    }
    list.innerHTML = html;
  }

  function initSdanfControls() {
    document.getElementById('sdanf-sort').addEventListener('change', function(e) {
      sdanfState.sort = e.target.value; sdanfState.page = 1; renderSdanfPage();
    });
    document.getElementById('sdanf-statut-filter').addEventListener('change', function(e) {
      sdanfState.statut = e.target.value; sdanfState.page = 1; renderSdanfPage();
    });
    document.getElementById('sdanf-pref-filter').addEventListener('change', function(e) {
      sdanfState.pref = e.target.value; sdanfState.page = 1; renderSdanfPage();
    });
    var sel = document.getElementById('sdanf-page-size');
    sel.addEventListener('change', function() {
      sdanfState.pageSize = parseInt(sel.value, 10); sdanfState.page = 1; renderSdanfPage();
    });
    document.getElementById('sdanf-btn-prev').addEventListener('click', function() {
      if (sdanfState.page > 1) { sdanfState.page--; renderSdanfPage(); }
    });
    document.getElementById('sdanf-btn-next').addEventListener('click', function() {
      var totalPages = Math.ceil(getSdanfFiltered().length / sdanfState.pageSize);
      if (sdanfState.page < totalPages) { sdanfState.page++; renderSdanfPage(); }
    });
  }

  // ─── Phase entretien & decision prefecture ──────────────

  var entretienState = { all: [], filtered: [], page: 1, pageSize: 5, sort: 'days-desc', filter: '', pref: '' };

  /** Entretien is considered "passed" if rang >= 702 (compte-rendu or later) */
  function isEntretienPassed(s) {
    return s.rang >= 702;
  }

  function renderEntretienPipeline(summaries) {
    // Steps 6-8: from completude/enquetes through decision prefecture
    entretienState.all = summaries.filter(function(s) {
      return s.currentStep >= 6 && s.currentStep <= 8;
    });

    // Populate prefecture filter
    var prefs = {};
    for (var i = 0; i < entretienState.all.length; i++) {
      var p = entretienState.all[i].prefecture;
      if (p) prefs[p] = true;
    }
    var prefSelect = document.getElementById('entretien-pref-filter');
    Object.keys(prefs).sort().forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      prefSelect.appendChild(opt);
    });

    initEntretienControls();
    renderEntretienPage();
  }

  function getEntretienFiltered() {
    var data = entretienState.all;
    if (entretienState.filter === 'passed') {
      data = data.filter(function(s) { return isEntretienPassed(s); });
    } else if (entretienState.filter === 'pending') {
      data = data.filter(function(s) { return !isEntretienPassed(s); });
    }
    if (entretienState.pref) {
      data = data.filter(function(s) { return s.prefecture === entretienState.pref; });
    }
    switch (entretienState.sort) {
      case 'days-desc':
        data = data.slice().sort(function(a, b) { return (b.daysSinceDeposit || 0) - (a.daysSinceDeposit || 0); });
        break;
      case 'days-asc':
        data = data.slice().sort(function(a, b) { return (a.daysSinceDeposit || 0) - (b.daysSinceDeposit || 0); });
        break;
      case 'step-desc':
        data = data.slice().sort(function(a, b) { return b.rang - a.rang || (b.daysSinceDeposit || 0) - (a.daysSinceDeposit || 0); });
        break;
      case 'step-asc':
        data = data.slice().sort(function(a, b) { return a.rang - b.rang || (a.daysSinceDeposit || 0) - (b.daysSinceDeposit || 0); });
        break;
    }
    return data;
  }

  function renderEntretienPage() {
    var toolbar = document.getElementById('entretien-toolbar');
    var list = document.getElementById('entretien-list');
    var kpis = document.getElementById('entretien-kpis');
    var data = getEntretienFiltered();

    if (!entretienState.all.length) {
      toolbar.style.display = 'none';
      kpis.innerHTML = '';
      list.innerHTML = '<p class="no-data">Aucun dossier en phase entretien</p>';
      return;
    }

    // KPIs
    var total = data.length;
    var passed = data.filter(function(s) { return isEntretienPassed(s); }).length;
    var pending = total - passed;
    var daysArr = data.filter(function(s) { return s.daysSinceDeposit != null; }).map(function(s) { return s.daysSinceDeposit; });
    var avg = daysArr.length ? Math.round(daysArr.reduce(function(a, b) { return a + b; }, 0) / daysArr.length) : 0;

    kpis.innerHTML =
      '<div class="kpi-card"><div class="kpi-label">Total</div><div class="kpi-value">' + total + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">Entretien passé</div><div class="kpi-value green">' + passed + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">En attente</div><div class="kpi-value orange">' + pending + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">Durée moy.</div><div class="kpi-value">' + U.formatDuration(avg) + '</div><div class="kpi-sub">depuis le dépôt</div></div>';

    // Pagination
    var totalPages = Math.max(1, Math.ceil(data.length / entretienState.pageSize));
    entretienState.page = Math.min(entretienState.page, totalPages);
    var start = (entretienState.page - 1) * entretienState.pageSize;
    var pageData = data.slice(start, start + entretienState.pageSize);

    toolbar.style.display = 'flex';
    document.getElementById('entretien-count').textContent = data.length + ' dossier' + (data.length > 1 ? 's' : '');
    document.getElementById('entretien-page-info').textContent = entretienState.page + '/' + totalPages;
    document.getElementById('entretien-btn-prev').disabled = entretienState.page <= 1;
    document.getElementById('entretien-btn-next').disabled = entretienState.page >= totalPages;

    // Render rows
    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      var s = pageData[i];
      var color = C.STEP_COLORS[s.currentStep];
      var passed_flag = isEntretienPassed(s);
      var badgeClass = passed_flag ? 'badge-entretien-oui' : 'badge-entretien-non';
      var badgeText = passed_flag ? 'Entretien passé' : 'En attente';
      var daysLabel = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '—';

      html += '<div class="dossier-row" style="--card-accent:' + color + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
            '<span class="' + badgeClass + '">' + badgeText + '</span>' +
          '</div>' +
          '<div class="dossier-row-status">' +
            '<code class="statut-code">' + U.escapeHtml(s.statut) + '</code>' +
            '<span class="phase-hint">' + U.escapeHtml(s.currentPhase) + '</span>' +
          '</div>' +
          '<div class="dossier-row-meta">' +
            '<span>' + daysLabel + ' depuis le dépôt</span>' +
            (s.prefecture ? '<span>' + U.escapeHtml(s.prefecture) + '</span>' : '') +
            (s.dateEntretien ? '<span>Entretien: ' + U.formatDateFr(s.dateEntretien) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }
    list.innerHTML = html;
  }

  function initEntretienControls() {
    document.getElementById('entretien-sort').addEventListener('change', function(e) {
      entretienState.sort = e.target.value; entretienState.page = 1; renderEntretienPage();
    });
    document.getElementById('entretien-filter').addEventListener('change', function(e) {
      entretienState.filter = e.target.value; entretienState.page = 1; renderEntretienPage();
    });
    document.getElementById('entretien-pref-filter').addEventListener('change', function(e) {
      entretienState.pref = e.target.value; entretienState.page = 1; renderEntretienPage();
    });
    var sel = document.getElementById('entretien-page-size');
    sel.addEventListener('change', function() {
      entretienState.pageSize = parseInt(sel.value, 10); entretienState.page = 1; renderEntretienPage();
    });
    document.getElementById('entretien-btn-prev').addEventListener('click', function() {
      if (entretienState.page > 1) { entretienState.page--; renderEntretienPage(); }
    });
    document.getElementById('entretien-btn-next').addEventListener('click', function() {
      var totalPages = Math.ceil(getEntretienFiltered().length / entretienState.pageSize);
      if (entretienState.page < totalPages) { entretienState.page++; renderEntretienPage(); }
    });
  }

  // ─── Activity Feed with pagination ──────────────────────

  var activityState = { transitions: [], page: 1, pageSize: 5 };

  function buildTransitions(snapshots, grouped) {
    var transitions = [];

    grouped.forEach(function(snaps, hash) {
      for (var i = 1; i < snaps.length; i++) {
        if (snaps[i].etape !== snaps[i - 1].etape) {
          var duration = null;
          if (snaps[i - 1].date_statut && snaps[i].date_statut) {
            duration = U.daysDiff(snaps[i - 1].date_statut, snaps[i].date_statut);
          }
          var fromStatutInfo = C.STATUTS[snaps[i - 1].statut];
          var toStatutInfo = C.STATUTS[snaps[i].statut];
          transitions.push({
            hash: hash.substring(0, 6),
            fromStep: snaps[i - 1].etape,
            toStep: snaps[i].etape,
            fromSousEtape: fromStatutInfo ? C.formatSubStep(fromStatutInfo.rang) : String(snaps[i - 1].etape),
            toSousEtape: toStatutInfo ? C.formatSubStep(toStatutInfo.rang) : String(snaps[i].etape),
            fromExplication: fromStatutInfo ? fromStatutInfo.explication : '',
            toExplication: toStatutInfo ? toStatutInfo.explication : '',
            created_at: snaps[i].created_at,
            statut: snaps[i].statut,
            daysForTransition: duration
          });
        }
      }
      if (snaps.length > 0) {
        var firstStatutInfo = C.STATUTS[snaps[0].statut];
        transitions.push({
          hash: hash.substring(0, 6),
          fromStep: null,
          toStep: snaps[0].etape,
          fromSousEtape: null,
          toSousEtape: firstStatutInfo ? C.formatSubStep(firstStatutInfo.rang) : String(snaps[0].etape),
          fromExplication: null,
          toExplication: firstStatutInfo ? firstStatutInfo.explication : '',
          created_at: snaps[0].created_at,
          statut: snaps[0].statut,
          daysForTransition: null
        });
      }
    });

    transitions.sort(function(a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return transitions;
  }

  function renderActivityPage() {
    var feed = document.getElementById('activity-feed');
    var toolbar = document.getElementById('activity-toolbar');
    var all = activityState.transitions;

    if (!all.length) {
      toolbar.style.display = 'none';
      feed.innerHTML = '<li class="no-data">Aucune activité récente</li>';
      return;
    }

    var totalPages = Math.max(1, Math.ceil(all.length / activityState.pageSize));
    activityState.page = Math.min(activityState.page, totalPages);
    var start = (activityState.page - 1) * activityState.pageSize;
    var pageData = all.slice(start, start + activityState.pageSize);

    toolbar.style.display = 'flex';
    document.getElementById('activity-count').textContent = all.length + ' transition' + (all.length > 1 ? 's' : '');
    document.getElementById('activity-page-info').textContent = activityState.page + '/' + totalPages;
    document.getElementById('activity-btn-prev').disabled = activityState.page <= 1;
    document.getElementById('activity-btn-next').disabled = activityState.page >= totalPages;

    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      var t = pageData[i];
      var color = C.STEP_COLORS[t.toStep] || C.STEP_COLORS[0];

      var text;
      if (t.fromStep === null) {
        var toLabel = t.toExplication || C.PHASE_NAMES[t.toStep] || 'étape ' + t.toStep;
        text = 'début à l\'étape ' + t.toSousEtape + ' <span style="color:var(--text-dim)">(' + U.escapeHtml(toLabel) + ')</span>';
      } else {
        var fromLabel = t.fromExplication || C.PHASE_NAMES[t.fromStep] || 'étape ' + t.fromStep;
        var toLabel2 = t.toExplication || C.PHASE_NAMES[t.toStep] || 'étape ' + t.toStep;
        var durationBadge = '';
        if (t.daysForTransition !== null) {
          durationBadge = ' <span class="activity-duration">' + U.formatDuration(t.daysForTransition) + '</span>';
        }
        text = '<span style="color:' + C.STEP_COLORS[t.fromStep] + '">' + t.fromSousEtape + '</span>' +
          ' \u2192 ' +
          '<span style="color:' + color + '">' + t.toSousEtape + '</span>' +
          durationBadge +
          ' <span style="color:var(--text-dim)">(' + U.escapeHtml(fromLabel) + ' \u2192 ' + U.escapeHtml(toLabel2) + ')</span>';
      }

      html += '<li class="activity-item">' +
        '<span class="activity-dot" style="background:' + color + '"></span>' +
        '<span class="activity-hash">#' + U.escapeHtml(t.hash) + '</span>' +
        '<span class="activity-text">' + text + '</span>' +
        '<span class="activity-time">' + U.formatDateTimeFr(t.created_at) + '</span>' +
        '</li>';
    }
    feed.innerHTML = html;
  }

  function initActivityControls() {
    var sel = document.getElementById('activity-page-size');
    if (sel) {
      sel.addEventListener('change', function() {
        activityState.pageSize = parseInt(sel.value, 10);
        activityState.page = 1;
        renderActivityPage();
      });
    }
    document.getElementById('activity-btn-prev').addEventListener('click', function() {
      if (activityState.page > 1) { activityState.page--; renderActivityPage(); }
    });
    document.getElementById('activity-btn-next').addEventListener('click', function() {
      var totalPages = Math.ceil(activityState.transitions.length / activityState.pageSize);
      if (activityState.page < totalPages) { activityState.page++; renderActivityPage(); }
    });
  }

  function renderActivityFeed(snapshots, grouped) {
    activityState.transitions = buildTransitions(snapshots, grouped);
    initActivityControls();
    renderActivityPage();
  }

})();
