/**
 * pages/accueil.js — Page Accueil (dashboard)
 */
(function() {
  'use strict';

  var C = ANEF.constants;
  var U = ANEF.utils;
  var D = ANEF.data;
  var CH = ANEF.charts;

  function ageColor(days) {
    if (days == null) return 'var(--text-dim)';
    if (days < 180) return 'var(--green)';
    if (days < 365) return 'var(--orange)';
    return 'var(--red)';
  }

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
    var STATUTS = C.STATUTS;

    // Group by step, then by statut within each step
    var byStep = {};
    for (var i = 0; i < summaries.length; i++) {
      var s = summaries[i];
      var step = s.currentStep;
      if (!byStep[step]) byStep[step] = {};
      var statutKey = s.statut ? s.statut.toLowerCase() : '_unknown';
      if (!byStep[step][statutKey]) byStep[step][statutKey] = [];
      byStep[step][statutKey].push(s);
    }

    // Short readable labels for timeline bubbles (keys = STATUTS dictionary keys)
    var SHORT_LABELS = {
      // Étape 1
      'draft': 'Brouillon',
      // Étape 2
      'dossier_depose': 'Déposé',
      // Étape 3
      'verification_formelle_a_traiter': 'Reçu, tri',
      'verification_formelle_en_cours': 'Tri en cours',
      'verification_formelle_mise_en_demeure': 'Mise en demeure',
      'css_mise_en_demeure_a_affecter': 'CSS en cours',
      'css_mise_en_demeure_a_rediger': 'CSS rédaction',
      // Étape 4
      'instruction_a_affecter': 'Recevable',
      // Étape 5
      'instruction_recepisse_completude_a_envoyer': 'Dossier complet',
      'instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter': 'Complément reçu',
      // Étape 6
      'instruction_date_ea_a_fixer': 'Enquêtes',
      'ea_demande_report_ea': 'Report entretien',
      // Étape 7
      'ea_en_attente_ea': 'Convocation',
      'ea_crea_a_valider': 'Compte-rendu',
      // Étape 8
      'prop_decision_pref_a_effectuer': 'Avis préfectoral',
      'prop_decision_pref_en_attente_retour_hierarchique': 'Valid. hiérarch.',
      'prop_decision_pref_prop_a_editer': 'Rédaction déc.',
      'prop_decision_pref_en_attente_retour_signataire': 'Signature préfet',
      // Étape 9
      'controle_a_affecter': 'SDANF attente',
      'controle_a_effectuer': 'SDANF contrôle',
      'controle_en_attente_pec': 'SCEC transmis',
      'controle_pec_a_faire': 'SCEC vérif.',
      // Étape 10
      'controle_transmise_pour_decret': 'Avis favorable',
      'controle_en_attente_retour_hierarchique': 'Valid. hiérarch.',
      'controle_decision_a_editer': 'Décision édition',
      'controle_en_attente_signature': 'Attente signature',
      'transmis_a_ac': 'Transmis AC',
      'a_verifier_avant_insertion_decret': 'Vérifications',
      'prete_pour_insertion_decret': 'Prêt insertion',
      'decret_en_preparation': 'Prép. décret',
      'decret_a_qualifier': 'Qualif. décret',
      'decret_en_validation': 'Valid. décret',
      // Étape 11
      'inseree_dans_decret': 'Décret signé',
      'decret_envoye_prefecture': 'Envoyé préf.',
      'notification_envoyee': 'Notification',
      // Étape 12
      'decret_naturalisation_publie': 'Publié JO',
      'decret_naturalisation_publie_jo': 'Publié JO',
      'decret_publie': 'Publié',
      'demande_traitee': 'Traitée',
      'decision_negative_en_delais_recours': 'Défavorable',
      'decision_notifiee': 'Déc. notifiée',
      'demande_en_cours_rapo': 'Recours RAPO',
      'controle_demande_notifiee': 'Ctrl notifié',
      'irrecevabilite_manifeste': 'Irrecevable',
      'irrecevabilite_manifeste_en_delais_recours': 'Irrec. recours',
      'css_en_delais_recours': 'CSS recours',
      'css_notifie': 'CSS notifié'
    };
    function shortLabel(statutCode) {
      if (SHORT_LABELS[statutCode]) return SHORT_LABELS[statutCode];
      var info = STATUTS[statutCode];
      if (!info) return statutCode || '?';
      var exp = info.explication;
      if (exp.length > 16) exp = exp.substring(0, 14) + '\u2026';
      return exp;
    }

    var html = '<div class="global-timeline">';
    for (var step = 1; step <= 12; step++) {
      var stepData = byStep[step] || {};
      var statutKeys = Object.keys(stepData).sort(function(a, b) {
        var ra = STATUTS[a] ? STATUTS[a].rang : 0;
        var rb = STATUTS[b] ? STATUTS[b].rang : 0;
        return ra - rb;
      });
      var totalCount = 0;
      for (var sk in stepData) totalCount += stepData[sk].length;
      var color = C.STEP_COLORS[step];
      var isActive = totalCount > 0;

      var bubbleHtml = '';
      if (totalCount > 0) {
        bubbleHtml = '<div class="station-sub-bubbles">';
        for (var si = 0; si < statutKeys.length; si++) {
          var sk2 = statutKeys[si];
          var count = stepData[sk2].length;
          var label = shortLabel(sk2);
          var fullExp = STATUTS[sk2] ? STATUTS[sk2].explication : sk2;
          var tooltip = count + ' dossier' + (count > 1 ? 's' : '') + ' \u2014 ' + fullExp;
          bubbleHtml += '<span class="station-sub-bubble" tabindex="0" style="background:' + color + '" title="' + U.escapeHtml(tooltip) + '"><span class="station-sub-label">' + U.escapeHtml(label) + '</span><span class="station-sub-count">' + count + '</span></span>';
        }
        bubbleHtml += '</div>';
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

  var sdanfState = { all: [], filtered: [], page: 1, pageSize: 5, sort: 'days-desc', pref: '', statut: '', changed: false };

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
      var filterStatut = sdanfState.statut.toLowerCase();
      data = data.filter(function(s) { return (s.statut || '').toLowerCase() === filterStatut; });
    }
    if (sdanfState.pref) {
      data = data.filter(function(s) { return s.prefecture === sdanfState.pref; });
    }
    if (sdanfState.changed) {
      data = data.filter(function(s) { return !!s.previousStatut; });
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

    // KPIs — count by exact sub-status (lowercase keys)
    var subCounts = {};
    for (var k = 0; k < data.length; k++) {
      var st = (data[k].statut || 'inconnu').toLowerCase();
      subCounts[st] = (subCounts[st] || 0) + 1;
    }
    var days = data.map(function(s) { return s.daysAtCurrentStatus || 0; });
    var total = data.length;
    var maxD = total ? Math.max.apply(null, days) : 0;

    var SUB_LABELS = {
      'controle_a_affecter': { short: 'Attente affectation', cls: 'orange' },
      'controle_a_effectuer': { short: 'Contr\u00f4le en cours', cls: '' },
      'controle_en_attente_pec': { short: 'Transmis SCEC', cls: 'violet' },
      'controle_pec_a_faire': { short: 'V\u00e9rif. \u00e9tat civil', cls: 'violet' }
    };
    var kpiHtml = '<div class="kpi-card"><div class="kpi-label">Total \u00e9tape 9</div><div class="kpi-value">' + total + '</div></div>';
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
      var statutLower = s.statut ? s.statut.toLowerCase() : '';
      var d = s.daysAtCurrentStatus || 0;
      var urgency = d >= 60 ? 'var(--red)' : d >= 30 ? 'var(--orange)' : 'var(--green)';
      var badge = BADGE_MAP[statutLower] || { text: s.sousEtape + ' ' + s.explication, cls: 'badge-entretien-non' };

      // Last checked by extension
      var checkedHtml = '';
      if (s.lastChecked) {
        checkedHtml = '<span style="font-size:0.72rem;color:var(--text-dim)">V\u00e9rifi\u00e9 le ' + U.formatDateTimeFr(s.lastChecked) + '</span>';
      }

      // Status change indicator
      var changeHtml = '';
      if (s.previousStatut) {
        var prevKey = s.previousStatut.toLowerCase();
        var prevInfo = C.STATUTS[prevKey];
        var prevExpl = prevInfo ? prevInfo.explication : '';
        var prevDateStr = s.previousDateStatut ? ' depuis le ' + U.formatDateFr(s.previousDateStatut) : '';
        var prevSub = prevInfo ? C.formatSubStep(prevInfo.rang) : '';
        changeHtml = '<span class="badge-status-changed">Statut modifi\u00e9</span>' +
          '<span class="meta-wrap" style="font-size:0.7rem;color:var(--text-dim)"> ancien : ' +
          (prevSub ? U.escapeHtml(prevSub) + ' \u2014 ' : '') +
          (prevExpl ? U.escapeHtml(prevExpl) : U.escapeHtml(prevKey)) +
          prevDateStr +
          '</span>';
      } else {
        changeHtml = '<span style="font-size:0.7rem;color:var(--text-dim)">Aucun changement de statut d\u00e9tect\u00e9</span>';
      }

      html += '<div class="dossier-row" style="--card-accent:' + color + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
            '<span class="' + badge.cls + '">' + U.escapeHtml(badge.text) + '</span>' +
          '</div>' +
          '<div class="dossier-row-status" title="' + U.escapeHtml(s.statut) + '">' +
            '<span class="statut-label">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</span>' +
          '</div>' +
          '<div class="dossier-row-meta">' +
            '<span style="font-weight:700;color:' + urgency + '">' + U.formatDuration(d) + '</span>' +
            (s.dateStatut ? '<span>depuis le ' + U.formatDateFr(s.dateStatut) + '</span>' : '') +
          '</div>' +
          '<div class="dossier-row-meta">' + changeHtml + '</div>' +
          '<div class="dossier-row-meta">' +
            (s.prefecture ? '<span style="font-size:0.8rem;color:var(--primary-light);font-weight:600">' + U.escapeHtml(s.prefecture) + '</span>' : '<span style="font-size:0.8rem;color:var(--text-dim)">Préfecture inconnue</span>') +
            checkedHtml +
          '</div>' +
        '</div>' +
        '<div style="width:60px;height:6px;border-radius:3px;background:rgba(255,255,255,0.08);flex-shrink:0" title="Anciennet\u00e9 : ' + U.formatDuration(s.daysSinceDeposit) + '">' +
          '<div style="width:' + Math.min(100, Math.round(d / Math.max(maxD, 1) * 100)) + '%;height:100%;border-radius:3px;background:' + ageColor(s.daysSinceDeposit) + '"></div>' +
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
    var changedCb = document.getElementById('sdanf-changed-filter');
    changedCb.addEventListener('change', function() {
      sdanfState.changed = changedCb.checked;
      document.getElementById('sdanf-changed-label').classList.toggle('active', changedCb.checked);
      sdanfState.page = 1; renderSdanfPage();
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

  var entretienState = { all: [], filtered: [], page: 1, pageSize: 5, sort: 'days-desc', filter: '', pref: '', statut: '', changed: false };

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

    // Populate statut filter
    var ENTRETIEN_LABELS = {
      'instruction_date_ea_a_fixer': 'Enquêtes en cours',
      'ea_demande_report_ea': 'Report entretien',
      'ea_en_attente_ea': 'Convocation entretien',
      'ea_crea_a_valider': 'Compte-rendu',
      'prop_decision_pref_a_effectuer': 'Avis préfectoral',
      'prop_decision_pref_en_attente_retour_hierarchique': 'Valid. hiérarchique',
      'prop_decision_pref_prop_a_editer': 'Rédaction décision',
      'prop_decision_pref_en_attente_retour_signataire': 'Signature préfet'
    };
    var entretienStatuts = {};
    for (var ei = 0; ei < entretienState.all.length; ei++) {
      var est = entretienState.all[ei].statut;
      if (est) entretienStatuts[est] = true;
    }
    var entretienStatutSelect = document.getElementById('entretien-statut-filter');
    var entretienStatutKeys = Object.keys(entretienStatuts).sort(function(a, b) {
      var ra = C.STATUTS[a.toLowerCase()] ? C.STATUTS[a.toLowerCase()].rang : 0;
      var rb = C.STATUTS[b.toLowerCase()] ? C.STATUTS[b.toLowerCase()].rang : 0;
      return ra - rb;
    });
    for (var ej = 0; ej < entretienStatutKeys.length; ej++) {
      var eopt = document.createElement('option');
      eopt.value = entretienStatutKeys[ej];
      eopt.textContent = ENTRETIEN_LABELS[entretienStatutKeys[ej].toLowerCase()] || entretienStatutKeys[ej];
      entretienStatutSelect.appendChild(eopt);
    }

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
    if (entretienState.statut) {
      var filterStatutE = entretienState.statut.toLowerCase();
      data = data.filter(function(s) { return (s.statut || '').toLowerCase() === filterStatutE; });
    }
    if (entretienState.pref) {
      data = data.filter(function(s) { return s.prefecture === entretienState.pref; });
    }
    if (entretienState.changed) {
      data = data.filter(function(s) { return !!s.previousStatut; });
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
      var badgeText = passed_flag ? 'Entretien pass\u00e9' : 'En attente';
      var daysLabel = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

      // Last checked by extension
      var checkedHtml = '';
      if (s.lastChecked) {
        checkedHtml = '<span style="font-size:0.72rem;color:var(--text-dim)">V\u00e9rifi\u00e9 le ' + U.formatDateTimeFr(s.lastChecked) + '</span>';
      }

      // Status change indicator
      var changeHtml = '';
      if (s.previousStatut) {
        var prevKey = s.previousStatut.toLowerCase();
        var prevInfo = C.STATUTS[prevKey];
        var prevExpl = prevInfo ? prevInfo.explication : '';
        var prevDateStr = s.previousDateStatut ? ' depuis le ' + U.formatDateFr(s.previousDateStatut) : '';
        var prevSub = prevInfo ? C.formatSubStep(prevInfo.rang) : '';
        changeHtml = '<span class="badge-status-changed">Statut modifi\u00e9</span>' +
          '<span class="meta-wrap" style="font-size:0.7rem;color:var(--text-dim)"> ancien : ' +
          (prevSub ? U.escapeHtml(prevSub) + ' \u2014 ' : '') +
          (prevExpl ? U.escapeHtml(prevExpl) : U.escapeHtml(prevKey)) +
          prevDateStr +
          '</span>';
      } else {
        changeHtml = '<span style="font-size:0.7rem;color:var(--text-dim)">Aucun changement de statut d\u00e9tect\u00e9</span>';
      }

      html += '<div class="dossier-row" style="--card-accent:' + color + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
            '<span class="' + badgeClass + '">' + badgeText + '</span>' +
          '</div>' +
          '<div class="dossier-row-status" title="' + U.escapeHtml(s.statut) + '">' +
            '<span class="statut-label">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</span>' +
          '</div>' +
          '<div class="dossier-row-meta">' +
            '<span>' + daysLabel + ' depuis le d\u00e9p\u00f4t</span>' +
            (s.dateEntretien ? '<span>Entretien: ' + U.formatDateFr(s.dateEntretien) + '</span>' : '') +
          '</div>' +
          '<div class="dossier-row-meta">' + changeHtml + '</div>' +
          '<div class="dossier-row-meta">' +
            (s.prefecture ? '<span style="font-size:0.8rem;color:var(--primary-light);font-weight:600">' + U.escapeHtml(s.prefecture) + '</span>' : '<span style="font-size:0.8rem;color:var(--text-dim)">Préfecture inconnue</span>') +
            checkedHtml +
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
    document.getElementById('entretien-statut-filter').addEventListener('change', function(e) {
      entretienState.statut = e.target.value; entretienState.page = 1; renderEntretienPage();
    });
    document.getElementById('entretien-pref-filter').addEventListener('change', function(e) {
      entretienState.pref = e.target.value; entretienState.page = 1; renderEntretienPage();
    });
    var changedCbE = document.getElementById('entretien-changed-filter');
    changedCbE.addEventListener('change', function() {
      entretienState.changed = changedCbE.checked;
      document.getElementById('entretien-changed-label').classList.toggle('active', changedCbE.checked);
      entretienState.page = 1; renderEntretienPage();
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

  var activityState = { transitions: [], page: 1, pageSize: 5, typeFilter: 'all' };

  function buildTransitions(snapshots, grouped) {
    var transitions = [];

    grouped.forEach(function(snaps, hash) {
      for (var i = 1; i < snaps.length; i++) {
        var prev = snaps[i - 1], cur = snaps[i];
        var sameStep = cur.etape === prev.etape;
        var sameStatut = cur.statut === prev.statut;
        if (sameStep && sameStatut) continue;

        var duration = null;
        if (prev.date_statut && cur.date_statut) {
          duration = U.daysDiff(prev.date_statut, cur.date_statut);
        }
        var fromInfo = C.STATUTS[prev.statut.toLowerCase()];
        var toInfo = C.STATUTS[cur.statut.toLowerCase()];
        var type = sameStep ? 'status_change' : 'step_change';
        transitions.push({
          type: type,
          hash: hash.substring(0, 6),
          fromStep: prev.etape,
          toStep: cur.etape,
          fromSousEtape: fromInfo ? C.formatSubStep(fromInfo.rang) : String(prev.etape),
          toSousEtape: toInfo ? C.formatSubStep(toInfo.rang) : String(cur.etape),
          fromExplication: fromInfo ? fromInfo.explication : '',
          toExplication: toInfo ? toInfo.explication : '',
          created_at: cur.created_at,
          statut: cur.statut,
          daysForTransition: duration
        });
      }
      if (snaps.length > 0) {
        var firstInfo = C.STATUTS[snaps[0].statut.toLowerCase()];
        transitions.push({
          type: 'first_seen',
          hash: hash.substring(0, 6),
          fromStep: null,
          toStep: snaps[0].etape,
          fromSousEtape: null,
          toSousEtape: firstInfo ? C.formatSubStep(firstInfo.rang) : String(snaps[0].etape),
          fromExplication: null,
          toExplication: firstInfo ? firstInfo.explication : '',
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

  function getFilteredActivity() {
    var f = activityState.typeFilter;
    if (f === 'all') return activityState.transitions;
    return activityState.transitions.filter(function(t) { return t.type === f; });
  }

  var ACTIVITY_BADGE = {
    first_seen:    { label: 'Nouveau',     css: 'badge-type-new' },
    step_change:   { label: 'Étape',       css: 'badge-type-step' },
    status_change: { label: 'Progression', css: 'badge-type-progress' }
  };

  function renderActivityPage() {
    var feed = document.getElementById('activity-feed');
    var toolbar = document.getElementById('activity-toolbar');
    var all = getFilteredActivity();

    if (!activityState.transitions.length) {
      toolbar.style.display = 'none';
      feed.innerHTML = '<li class="no-data">Aucune activité récente</li>';
      return;
    }

    var totalPages = Math.max(1, Math.ceil(all.length / activityState.pageSize));
    activityState.page = Math.min(activityState.page, totalPages);
    var start = (activityState.page - 1) * activityState.pageSize;
    var pageData = all.slice(start, start + activityState.pageSize);

    toolbar.style.display = 'flex';
    document.getElementById('activity-count').textContent = all.length + ' événement' + (all.length > 1 ? 's' : '');
    document.getElementById('activity-page-info').textContent = activityState.page + '/' + totalPages;
    document.getElementById('activity-btn-prev').disabled = activityState.page <= 1;
    document.getElementById('activity-btn-next').disabled = activityState.page >= totalPages;

    var html = '';
    for (var i = 0; i < pageData.length; i++) {
      var t = pageData[i];
      var color = C.STEP_COLORS[t.toStep] || C.STEP_COLORS[0];
      var badge = ACTIVITY_BADGE[t.type];
      var badgeHtml = '<span class="badge-type ' + badge.css + '">' + badge.label + '</span>';

      var text;
      if (t.type === 'first_seen') {
        var toLabel = t.toExplication || C.PHASE_NAMES[t.toStep] || 'étape ' + t.toStep;
        text = 'Nouveau dossier \u2014 étape ' + t.toSousEtape + ' <span style="color:var(--text-dim)">(' + U.escapeHtml(toLabel) + ')</span>';
      } else if (t.type === 'status_change') {
        var fromLbl = t.fromExplication || C.PHASE_NAMES[t.fromStep] || 'étape ' + t.fromStep;
        var toLbl = t.toExplication || C.PHASE_NAMES[t.toStep] || 'étape ' + t.toStep;
        var dur = '';
        if (t.daysForTransition !== null) {
          dur = ' <span class="activity-duration">' + U.formatDuration(t.daysForTransition) + '</span>';
        }
        text = 'Étape ' + t.fromStep + ' \u2014 ' +
          '<span style="color:' + color + '">' + t.fromSousEtape + '</span>' +
          ' \u2192 ' +
          '<span style="color:' + color + '">' + t.toSousEtape + '</span>' +
          dur +
          ' <span style="color:var(--text-dim)">(' + U.escapeHtml(fromLbl) + ' \u2192 ' + U.escapeHtml(toLbl) + ')</span>';
      } else {
        var fromLabel2 = t.fromExplication || C.PHASE_NAMES[t.fromStep] || 'étape ' + t.fromStep;
        var toLabel2 = t.toExplication || C.PHASE_NAMES[t.toStep] || 'étape ' + t.toStep;
        var durationBadge = '';
        if (t.daysForTransition !== null) {
          durationBadge = ' <span class="activity-duration">' + U.formatDuration(t.daysForTransition) + '</span>';
        }
        text = '<span style="color:' + C.STEP_COLORS[t.fromStep] + '">' + t.fromSousEtape + '</span>' +
          ' \u2192 ' +
          '<span style="color:' + color + '">' + t.toSousEtape + '</span>' +
          durationBadge +
          ' <span style="color:var(--text-dim)">(' + U.escapeHtml(fromLabel2) + ' \u2192 ' + U.escapeHtml(toLabel2) + ')</span>';
      }

      html += '<li class="activity-item">' +
        '<span class="activity-dot" style="background:' + color + '"></span>' +
        '<span class="activity-hash">#' + U.escapeHtml(t.hash) + '</span>' +
        '<span class="activity-text">' + badgeHtml + text + '</span>' +
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
    var typeSel = document.getElementById('activity-type-filter');
    if (typeSel) {
      typeSel.addEventListener('change', function() {
        activityState.typeFilter = typeSel.value;
        activityState.page = 1;
        renderActivityPage();
      });
    }
    document.getElementById('activity-btn-prev').addEventListener('click', function() {
      if (activityState.page > 1) { activityState.page--; renderActivityPage(); }
    });
    document.getElementById('activity-btn-next').addEventListener('click', function() {
      var totalPages = Math.ceil(getFilteredActivity().length / activityState.pageSize);
      if (activityState.page < totalPages) { activityState.page++; renderActivityPage(); }
    });
  }

  function renderActivityFeed(snapshots, grouped) {
    activityState.transitions = buildTransitions(snapshots, grouped);
    initActivityControls();
    updateTypeFilterCounts();
    renderActivityPage();
  }

  function updateTypeFilterCounts() {
    var counts = { first_seen: 0, step_change: 0, status_change: 0 };
    for (var i = 0; i < activityState.transitions.length; i++) {
      var t = activityState.transitions[i].type;
      if (counts[t] !== undefined) counts[t]++;
    }
    var typeSel = document.getElementById('activity-type-filter');
    if (!typeSel) return;
    var labels = {
      'all': 'Tous types (' + activityState.transitions.length + ')',
      'first_seen': 'Nouveaux (' + counts.first_seen + ')',
      'step_change': '\u00c9tapes (' + counts.step_change + ')',
      'status_change': 'Progressions (' + counts.status_change + ')'
    };
    for (var j = 0; j < typeSel.options.length; j++) {
      var val = typeSel.options[j].value;
      if (labels[val]) typeSel.options[j].textContent = labels[val];
    }
  }

})();
