/**
 * pages/accueil.js — Page Accueil (dashboard)
 */
(function() {
  'use strict';

  var C = ANEF.constants;
  var U = ANEF.utils;
  var D = ANEF.data;
  var F = ANEF.filters;
  var _timelineWrapper = null;
  var CH = ANEF.charts;

  var allSummaries = [];

  // ─── Data freshness indicator ───
  // Uses the Last-Modified header of snapshots.json (deployed by GitHub Actions)
  // as the single source of truth for when data was last refreshed.
  var _freshnessInterval = null;

  function startFreshnessIndicator(fallbackTimestamp) {
    var dot = document.getElementById('freshness-dot');
    var text = document.getElementById('freshness-text');
    var sub = document.getElementById('kpi-updated-sub');
    if (!dot || !text) return;

    // Click handler to show cron history
    var card = dot.closest('.kpi-timer-card');
    if (card) card.addEventListener('click', showCronHistory);

    // HEAD request on snapshots.json to get the real deploy time
    fetch('./data/snapshots.json', { method: 'HEAD' })
      .then(function(r) {
        var lm = r.ok && r.headers.get('last-modified');
        return lm ? new Date(lm).getTime() : null;
      })
      .catch(function() { return null; })
      .then(function(deployedAt) {
        var updatedAt = deployedAt || new Date(fallbackTimestamp).getTime();

        function tick() {
          var ageMin = Math.floor((Date.now() - updatedAt) / 60000);

          // Freshness classes: green < 90min, orange < 150min, red >= 150min
          var cls = ageMin < 90 ? '' : ageMin < 150 ? 'warn' : 'stale';
          dot.className = 'freshness-dot' + (cls ? ' ' + cls : '');
          text.className = 'freshness-text' + (cls ? ' ' + cls : '');

          // Display age
          if (ageMin < 1) {
            text.textContent = "\u00e0 l'instant";
          } else if (ageMin < 60) {
            text.textContent = 'il y a ' + ageMin + ' min';
          } else {
            var h = Math.floor(ageMin / 60);
            var m = ageMin % 60;
            text.textContent = 'il y a ' + h + 'h' + (m > 0 ? String(m).padStart(2, '0') : '');
          }

          // Sub: exact time
          var d = new Date(updatedAt);
          sub.textContent = 'le ' + String(d.getDate()).padStart(2, '0') + '/'
            + String(d.getMonth() + 1).padStart(2, '0') + ' \u00e0 '
            + String(d.getHours()).padStart(2, '0') + ':'
            + String(d.getMinutes()).padStart(2, '0');
        }

        tick();
        if (_freshnessInterval) clearInterval(_freshnessInterval);
        _freshnessInterval = setInterval(tick, 30000);
      })
      .catch(function() {
        text.textContent = 'indisponible';
      });
  }

  // ─── Cron history modal ───
  var GITHUB_RUNS_API = 'https://api.github.com/repos/Letranger-dev/anef-extension/actions/workflows/refresh-data.yml/runs?per_page=15';

  function formatAgo(dateStr) {
    var min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (min < 1) return "\u00e0 l'instant";
    if (min < 60) return 'il y a ' + min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return 'il y a ' + h + 'h' + (min % 60 > 0 ? String(min % 60).padStart(2, '0') : '');
    var d = Math.floor(h / 24);
    return 'il y a ' + d + 'j';
  }

  function formatDateFR(dateStr) {
    var d = new Date(dateStr);
    return String(d.getDate()).padStart(2, '0') + '/'
      + String(d.getMonth() + 1).padStart(2, '0') + ' \u00e0 '
      + String(d.getHours()).padStart(2, '0') + ':'
      + String(d.getMinutes()).padStart(2, '0');
  }

  function conclusionClass(conclusion, status) {
    if (status === 'in_progress') return 'in_progress';
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure') return 'failure';
    return 'cancelled';
  }

  function showCronHistory() {
    // Remove existing modal if any
    var existing = document.getElementById('cron-history-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'cron-history-overlay';
    overlay.className = 'history-modal-overlay open';

    overlay.innerHTML =
      '<div class="history-modal" style="max-width:440px">' +
        '<div class="history-modal-header">' +
          '<h3>Historique des actualisations</h3>' +
          '<button class="history-close" id="cron-close">\u00d7</button>' +
        '</div>' +
        '<div class="modal-history-list" id="cron-list">' +
          '<div style="text-align:center;color:var(--text-dim);padding:1.5rem 0">Chargement\u2026</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target.closest('.history-close')) overlay.remove();
    });

    fetch(GITHUB_RUNS_API)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var runs = data.workflow_runs || [];
        var list = document.getElementById('cron-list');
        if (!runs.length) {
          list.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:1rem">Aucun run trouvé</div>';
          return;
        }

        var html = '';
        for (var i = 0; i < runs.length; i++) {
          var r = runs[i];
          var cls = conclusionClass(r.conclusion, r.status);
          var dur = '';
          if (r.updated_at && r.run_started_at) {
            var secs = Math.round((new Date(r.updated_at) - new Date(r.run_started_at)) / 1000);
            dur = secs + 's';
          }
          var trigger = r.event === 'schedule' ? 'cron' : r.event === 'workflow_dispatch' ? 'manuel' : r.event;

          html += '<div class="cron-run-item">'
            + '<span class="cron-run-dot ' + U.escapeHtml(cls) + '"></span>'
            + '<span class="cron-run-date">' + U.escapeHtml(formatDateFR(r.created_at)) + '</span>'
            + '<span class="cron-run-ago">' + U.escapeHtml(formatAgo(r.created_at)) + '</span>'
            + '<span class="cron-run-trigger">' + U.escapeHtml(trigger) + '</span>'
            + '<span class="cron-run-duration">' + U.escapeHtml(dur) + '</span>'
            + '</div>';
        }
        list.innerHTML = html;
      })
      .catch(function(err) {
        var list = document.getElementById('cron-list');
        if (list) list.innerHTML = '<div style="text-align:center;color:var(--red);padding:1rem">Erreur : ' + U.escapeHtml(err.message) + '</div>';
      });
  }

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

      allSummaries = summaries;

      loading.style.display = 'none';
      main.style.display = 'block';

      renderKPIs(summaries, snapshots);
      renderTimeline(summaries);

      var transitions = buildTransitions(snapshots, grouped);
      renderMouvements(transitions, grouped);
      renderMouvementsChart(transitions);

      renderSdanfWait(summaries);
      renderEntretienPipeline(summaries);
      renderActivityFeed(transitions);

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

    // Duree moyenne depuis le depot (dossiers en cours uniquement)
    var activeDossiers = summaries.filter(function(s) { return s.daysSinceDeposit != null && !s.isFinished; });
    if (activeDossiers.length > 0) {
      var totalDays = 0;
      for (var i = 0; i < activeDossiers.length; i++) {
        totalDays += activeDossiers[i].daysSinceDeposit;
      }
      var avgDays = Math.round(totalDays / activeDossiers.length);
      U.setText('kpi-avg-days', U.formatDuration(avgDays));
      U.setText('kpi-avg-sub', 'depuis le dépôt (' + activeDossiers.length + ' dossiers)');
    }

    // Data freshness indicator
    if (snapshots.length > 0) {
      var latest = snapshots[0].checked_at || snapshots[0].created_at;
      for (var k = 1; k < snapshots.length; k++) {
        var ts = snapshots[k].checked_at || snapshots[k].created_at;
        if (ts > latest) latest = ts;
      }
      startFreshnessIndicator(latest);
    }

    // Dernier décret
    var decretMap = {};
    for (var d = 0; d < summaries.length; d++) {
      var nd = summaries[d].numeroDecret;
      if (nd) {
        if (!decretMap[nd]) decretMap[nd] = [];
        decretMap[nd].push(summaries[d]);
      }
    }
    var decretKeys = Object.keys(decretMap);
    if (decretKeys.length > 0) {
      decretKeys.sort();
      var lastDecret = decretKeys[decretKeys.length - 1];
      var lastDecretDossiers = decretMap[lastDecret];
      var card = document.getElementById('kpi-decret-card');
      card.style.display = '';
      U.setText('kpi-decret', lastDecret);
      U.setText('kpi-decret-sub', lastDecretDossiers.length + ' dossier' + (lastDecretDossiers.length > 1 ? 's' : ''));
      card.onclick = function() { showDecretDossiers(lastDecret, decretMap[lastDecret]); };
    }
  }

  function renderTimeline(summaries) {
    var wrapper = _timelineWrapper = document.getElementById('timeline-wrapper');
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

    // Short readable labels
    var SHORT_LABELS = {
      'draft': 'Brouillon', 'dossier_depose': 'D\u00e9pos\u00e9',
      'verification_formelle_a_traiter': 'Re\u00e7u, tri', 'verification_formelle_en_cours': 'Tri en cours',
      'verification_formelle_mise_en_demeure': 'Mise en demeure', 'css_mise_en_demeure_a_affecter': 'CSS en cours',
      'css_mise_en_demeure_a_rediger': 'CSS r\u00e9daction',
      'instruction_a_affecter': 'Recevable',
      'instruction_recepisse_completude_a_envoyer': 'Dossier complet',
      'instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter': 'Compl\u00e9ment re\u00e7u',
      'instruction_date_ea_a_fixer': 'Enqu\u00eates', 'ea_demande_report_ea': 'Report entretien',
      'ea_en_attente_ea': 'Convocation', 'ea_crea_a_valider': 'Compte-rendu',
      'prop_decision_pref_a_effectuer': 'Avis pr\u00e9fectoral',
      'prop_decision_pref_en_attente_retour_hierarchique': 'Valid. hi\u00e9rarch.',
      'prop_decision_pref_prop_a_editer': 'R\u00e9daction d\u00e9c.',
      'prop_decision_pref_en_attente_retour_signataire': 'Signature pr\u00e9fet',
      'controle_a_affecter': 'SDANF attente', 'controle_a_effectuer': 'SDANF contr\u00f4le',
      'controle_en_attente_pec': 'SCEC transmis', 'controle_pec_a_faire': 'SCEC v\u00e9rif.',
      'controle_transmise_pour_decret': 'Avis favorable',
      'controle_en_attente_retour_hierarchique': 'Valid. hi\u00e9rarch.',
      'controle_decision_a_editer': 'D\u00e9cision \u00e9dition',
      'controle_en_attente_signature': 'Attente signature',
      'transmis_a_ac': 'Transmis AC', 'a_verifier_avant_insertion_decret': 'V\u00e9rifications',
      'prete_pour_insertion_decret': 'Pr\u00eat insertion',
      'decret_en_preparation': 'Pr\u00e9p. d\u00e9cret', 'decret_a_qualifier': 'Qualif. d\u00e9cret',
      'decret_en_validation': 'Valid. d\u00e9cret',
      'inseree_dans_decret': 'D\u00e9cret sign\u00e9', 'decret_envoye_prefecture': 'Envoy\u00e9 pr\u00e9f.',
      'notification_envoyee': 'Notification',
      'decret_naturalisation_publie': 'Publi\u00e9 JO', 'decret_naturalisation_publie_jo': 'Publi\u00e9 JO',
      'decret_publie': 'Publi\u00e9', 'demande_traitee': 'Trait\u00e9e',
      'decision_negative_en_delais_recours': 'D\u00e9favorable', 'decision_notifiee': 'D\u00e9c. notifi\u00e9e',
      'demande_en_cours_rapo': 'Recours RAPO', 'controle_demande_notifiee': 'Ctrl notifi\u00e9',
      'irrecevabilite_manifeste': 'Irrecevable', 'irrecevabilite_manifeste_en_delais_recours': 'Irrec. recours',
      'css_en_delais_recours': 'CSS recours', 'css_notifie': 'CSS notifi\u00e9'
    };
    function shortLabel(statutCode) {
      if (SHORT_LABELS[statutCode]) return SHORT_LABELS[statutCode];
      var info = STATUTS[statutCode];
      if (!info) return statutCode || '?';
      var exp = info.explication;
      if (exp.length > 16) exp = exp.substring(0, 14) + '\u2026';
      return exp;
    }

    // Store grouped data for click handlers
    var timelineData = byStep;

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
          bubbleHtml += '<span class="station-sub-bubble" tabindex="0" data-step="' + step + '" data-statut="' + U.escapeHtml(sk2) + '" style="background:' + color + '" title="' + U.escapeHtml(tooltip) + '">' +
            '<span class="station-sub-label">' + U.escapeHtml(label) + '</span>' +
            '<span class="station-sub-count">' + count + '</span>' +
            '</span>';
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

    // Click handler on sub-bubbles → open dossier list modal
    wrapper.addEventListener('click', function(e) {
      var bubble = e.target.closest('.station-sub-bubble');
      if (!bubble) return;
      var step = parseInt(bubble.dataset.step, 10);
      var statut = bubble.dataset.statut;
      var dossiers = (timelineData[step] && timelineData[step][statut]) || [];
      if (dossiers.length === 0) return;
      var color = C.STEP_COLORS[step];
      var label = shortLabel(statut);
      var fullExp = STATUTS[statut] ? STATUTS[statut].explication : statut;

      // Build dossier list HTML
      var listHtml = '';
      for (var d = 0; d < dossiers.length; d++) {
        var s = dossiers[d];
        var dColor = C.getStepColor(s.currentStep);
        var daysLabel = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';
        listHtml += '<div class="mouvement-dossier-item" data-hash="' + U.escapeHtml(s.hash) + '">' +
          '<span class="activity-dot" style="background:' + dColor + ';flex-shrink:0"></span>' +
          '<div class="mouvement-dossier-content">' +
            '<div class="mouvement-dossier-top">' +
              '<span class="activity-hash">#' + U.escapeHtml(s.hash) + '</span>' +
              '<span class="detail-badge" style="background:' + dColor + ';font-size:0.7rem;padding:0.1rem 0.4rem">' + U.escapeHtml(s.sousEtape) + '</span>' +
            '</div>' +
            '<div class="mouvement-dossier-desc">' + U.escapeHtml(s.explication) + '</div>' +
            '<div class="mouvement-dossier-detail">' + daysLabel + ' depuis le d\u00e9p\u00f4t' +
              (s.prefecture ? ' \u2014 ' + U.escapeHtml(s.prefecture) : '') +
            '</div>' +
          '</div>' +
          '<span class="mouvement-chevron">\u203a</span>' +
        '</div>';
      }

      var modal = document.getElementById('timeline-list-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'timeline-list-modal';
        modal.className = 'history-modal-overlay';
        modal.addEventListener('click', function(ev) {
          if (ev.target === modal) modal.classList.remove('open');
        });
        document.body.appendChild(modal);
      }

      modal.innerHTML =
        '<div class="history-modal">' +
          '<div class="history-modal-header">' +
            '<h3>' + U.escapeHtml(label) + ' \u2014 ' + dossiers.length + ' dossier' + (dossiers.length > 1 ? 's' : '') + '</h3>' +
            '<button class="history-close" title="Fermer">\u00d7</button>' +
          '</div>' +
          '<div class="modal-history-list mouvement-dossier-list">' + listHtml + '</div>' +
        '</div>';

      modal.querySelector('.history-close').addEventListener('click', function() {
        modal.classList.remove('open');
      });

      var items = modal.querySelectorAll('.mouvement-dossier-item');
      for (var j = 0; j < items.length; j++) {
        items[j].addEventListener('click', function(ev) {
          var hash = ev.currentTarget.getAttribute('data-hash');
          modal.classList.remove('open');
          showDossierHistory(hash, { timelineBubble: { step: step, statut: statut, label: label, dossiers: dossiers } });
        });
      }

      modal.classList.add('open');
    });
  }

  // ─── File d'attente SDANF ────────────────────────────────

  var sdanfState = { all: [], page: 1, pageSize: 5, sort: 'days-desc', pref: '', statut: '', changed: false };

  var FRESHNESS_DAYS = 20;

  function isFreshDossier(s) {
    if (!s.lastChecked) return false;
    return new Date(s.lastChecked).getTime() >= Date.now() - FRESHNESS_DAYS * 86400000;
  }

  function renderSdanfWait(summaries) {
    // Tous les dossiers étape 9, les obsolètes (>20j sans vérif) affichés en dernier
    sdanfState.all = summaries.filter(function(s) { return s.currentStep === 9; });

    // Populate statut filter pills
    var STATUT_PILLS = {
      'controle_a_affecter': { label: 'Contrôle à affecter', short: 'Ctrl. à affecter', color: '#f59e0b' },
      'controle_a_effectuer': { label: 'Contrôle à effectuer', short: 'Ctrl. à effectuer', color: '#3b82f6' },
      'controle_en_attente_pec': { label: 'En attente PEC', short: 'Ctrl. attente PEC', color: '#8b5cf6' },
      'controle_pec_a_faire': { label: 'PEC à faire', short: 'Ctrl. PEC à faire', color: '#8b5cf6' }
    };
    var statuts = {};
    var prefs = {};
    for (var i = 0; i < sdanfState.all.length; i++) {
      var st = sdanfState.all[i].statut;
      if (st) statuts[st.toLowerCase()] = true;
      var p = sdanfState.all[i].prefecture;
      if (p) prefs[p] = true;
    }
    var pillsContainer = document.getElementById('sdanf-statut-pills');
    var statutKeys = Object.keys(statuts).sort(function(a, b) {
      var ra = C.STATUTS[a] ? C.STATUTS[a].rang : 0;
      var rb = C.STATUTS[b] ? C.STATUTS[b].rang : 0;
      return ra - rb;
    });
    var pillsHtml = '<button class="pill sdanf-pill active" data-statut="">Tous</button>';
    for (var j = 0; j < statutKeys.length; j++) {
      var info = STATUT_PILLS[statutKeys[j]] || { label: statutKeys[j], short: statutKeys[j], color: '#64748b' };
      pillsHtml += '<button class="pill sdanf-pill" data-statut="' + statutKeys[j] + '" style="--pill-color:' + info.color + '"><span class="pill-full">' + info.label + '</span><span class="pill-short">' + info.short + '</span></button>';
    }
    pillsContainer.innerHTML = pillsHtml;
    F.createSearchablePrefectureDropdown('sdanf-pref-filter-container', Object.keys(prefs).sort(), '', function(v) {
      sdanfState.pref = v; sdanfState.page = 1; renderSdanfPage();
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
    // Trier : dossiers frais d'abord, obsolètes (>20j) en dernier
    var fresh = data.filter(isFreshDossier);
    var stale = data.filter(function(s) { return !isFreshDossier(s); });
    var sortFn;
    switch (sdanfState.sort) {
      case 'days-desc':
        sortFn = function(a, b) { return (b.daysAtCurrentStatus || 0) - (a.daysAtCurrentStatus || 0); };
        break;
      case 'days-asc':
        sortFn = function(a, b) { return (a.daysAtCurrentStatus || 0) - (b.daysAtCurrentStatus || 0); };
        break;
      case 'pref':
        sortFn = function(a, b) { return (a.prefecture || '').localeCompare(b.prefecture || '') || (b.daysAtCurrentStatus || 0) - (a.daysAtCurrentStatus || 0); };
        break;
    }
    if (sortFn) { fresh.sort(sortFn); stale.sort(sortFn); }
    return fresh.concat(stale);
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
    var kpiHtml = '<span class="kpi-bar-item"><strong>' + total + '</strong> total</span>';
    var subKeys = Object.keys(subCounts).sort(function(a, b) {
      var ra = C.STATUTS[a] ? C.STATUTS[a].rang : 0;
      var rb = C.STATUTS[b] ? C.STATUTS[b].rang : 0;
      return ra - rb;
    });
    for (var sk = 0; sk < subKeys.length; sk++) {
      var info = SUB_LABELS[subKeys[sk]] || { short: subKeys[sk], cls: '' };
      var valCls = info.cls ? ' ' + info.cls : '';
      kpiHtml += '<span class="kpi-bar-item"><strong class="' + valCls + '">' + subCounts[subKeys[sk]] + '</strong> ' + U.escapeHtml(info.short).toLowerCase() + '</span>';
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
      var isFresh = isFreshDossier(s);
      var staleStyle = isFresh ? '' : 'opacity:0.5;';

      // Last checked by extension
      var checkedHtml = '';
      if (s.lastChecked) {
        checkedHtml = '<span style="font-size:0.72rem;color:var(--text-dim)">V\u00e9rifi\u00e9 le ' + U.formatDateTimeFr(s.lastChecked) + (!isFresh ? ' (ancien)' : '') + '</span>';
      }

      // Status change indicator
      var changeHtml = '';
      if (s.previousStatut) {
        var prevKey = s.previousStatut.toLowerCase();
        var prevInfo = C.STATUTS[prevKey];
        var prevExpl = prevInfo ? prevInfo.explication : '';
        var prevDateStr = s.previousDateStatut ? ' depuis le ' + U.escapeHtml(U.formatDateFr(s.previousDateStatut)) : '';
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

      html += '<div class="dossier-row dossier-clickable" style="' + staleStyle + '--card-accent:' + color + ';cursor:pointer" data-hash="' + U.escapeHtml(s.hash) + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
            '<span class="' + badge.cls + '">' + U.escapeHtml(badge.text) + '</span>' +
          '</div>' +
          '<div class="dossier-row-status" title="' + U.escapeHtml(s.statut) + '">' +
            '<span class="statut-label">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</span>' +
            ' <span class="statut-code">(' + U.escapeHtml((s.statut || '').toUpperCase()) + ')</span>' +
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
    bindDossierClicks(list);
  }

  function initSdanfControls() {
    document.getElementById('sdanf-sort').addEventListener('change', function(e) {
      sdanfState.sort = e.target.value; sdanfState.page = 1; renderSdanfPage();
    });
    var statutPills = document.querySelectorAll('.sdanf-pill');
    for (var sp = 0; sp < statutPills.length; sp++) {
      statutPills[sp].addEventListener('click', function(e) {
        var all = document.querySelectorAll('.sdanf-pill');
        for (var x = 0; x < all.length; x++) all[x].classList.remove('active');
        e.currentTarget.classList.add('active');
        sdanfState.statut = e.currentTarget.getAttribute('data-statut');
        sdanfState.page = 1; renderSdanfPage();
      });
    }
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

  var entretienState = { all: [], page: 1, pageSize: 5, sort: 'days-desc', filter: '', pref: '', statut: '', changed: false };

  /** Entretien is considered "passed" if rang >= 702 (compte-rendu or later), excluding sans-entretien */
  function isEntretienPassed(s) {
    return s.rang >= 702 && !isDecisionSansEntretien(s);
  }

  /** Dossier en phase décision (étape 8) sans être passé par l'entretien (étape 7) */
  function isDecisionSansEntretien(s) {
    return s.currentStep === 8 && !s.dateEntretien && s.stepsTraversed.indexOf(7) === -1;
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
    F.createSearchablePrefectureDropdown('entretien-pref-filter-container', Object.keys(prefs).sort(), '', function(v) {
      entretienState.pref = v; entretienState.page = 1; renderEntretienPage();
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
      data = data.filter(function(s) { return !isEntretienPassed(s) && !isDecisionSansEntretien(s); });
    } else if (entretienState.filter === 'sans-entretien') {
      data = data.filter(function(s) { return isDecisionSansEntretien(s); });
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
    var sansEntretienCount = data.filter(function(s) { return isDecisionSansEntretien(s); }).length;
    var pending = total - passed - sansEntretienCount;
    var daysArr = data.filter(function(s) { return s.daysSinceDeposit != null; }).map(function(s) { return s.daysSinceDeposit; });
    var avg = daysArr.length ? Math.round(daysArr.reduce(function(a, b) { return a + b; }, 0) / daysArr.length) : 0;

    kpis.innerHTML =
      '<span class="kpi-bar-item"><strong>' + total + '</strong> total</span>' +
      '<span class="kpi-bar-item"><strong class="green">' + passed + '</strong> entretien passé</span>' +
      '<span class="kpi-bar-item"><strong class="orange">' + pending + '</strong> en attente</span>' +
      (sansEntretienCount ? '<span class="kpi-bar-item"><strong style="color:#ef4444">' + sansEntretienCount + '</strong> décision sans entretien</span>' : '') +
      '<span class="kpi-bar-item"><strong>' + U.formatDuration(avg) + '</strong> durée moy.</span>';

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
      var sansEntretien = isDecisionSansEntretien(s);
      var badgeClass, badgeText;
      if (sansEntretien) {
        badgeClass = 'badge-decision-sans-entretien';
        badgeText = '\u26A0 D\u00e9cision sans entretien';
      } else if (passed_flag) {
        badgeClass = 'badge-entretien-oui';
        badgeText = 'Entretien pass\u00e9';
      } else {
        badgeClass = 'badge-entretien-non';
        badgeText = 'En attente';
      }
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
        var prevDateStr = s.previousDateStatut ? ' depuis le ' + U.escapeHtml(U.formatDateFr(s.previousDateStatut)) : '';
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

      var sansEntretienHtml = '';
      if (sansEntretien) {
        sansEntretienHtml = '<div class="dossier-row-meta"><span style="font-size:0.72rem;color:#ef4444">' +
          '\u26A0 Dossier en phase d\u00e9cision sans \u00eatre pass\u00e9 par l\u2019entretien \u2014 ajournement ou classement anticip\u00e9 probable</span></div>';
      }

      html += '<div class="dossier-row dossier-clickable" style="--card-accent:' + color + ';cursor:pointer" data-hash="' + U.escapeHtml(s.hash) + '">' +
        '<div class="dossier-row-main">' +
          '<div class="dossier-row-top">' +
            '<span class="dossier-row-hash">#' + U.escapeHtml(s.hash) + '</span>' +
            '<span class="' + badgeClass + '">' + badgeText + '</span>' +
          '</div>' +
          '<div class="dossier-row-status" title="' + U.escapeHtml(s.statut) + '">' +
            '<span class="statut-label">' + U.escapeHtml(s.sousEtape + ' \u2014 ' + s.explication) + '</span>' +
            ' <span class="statut-code">(' + U.escapeHtml((s.statut || '').toUpperCase()) + ')</span>' +
          '</div>' +
          sansEntretienHtml +
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
    bindDossierClicks(list);
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

  // ─── Mouvements du jour ────────────────────────────────

  var mouvementsState = { period: 0, transitions: [], grouped: null };
  var SDANF_STATUTS = { 'controle_a_affecter': true, 'controle_a_effectuer': true };
  var SCEC_STATUTS = { 'controle_en_attente_pec': true, 'controle_pec_a_faire': true };

  function computeDailyMovements(transitions, periodDays, grouped) {
    var now = new Date();
    var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var cutoff;
    if (periodDays === 0) {
      cutoff = startOfToday;
    } else {
      cutoff = new Date(startOfToday.getTime() - periodDays * 86400000);
    }

    var caaToCAE = 0, sdanfToSCEC = 0, arrivedStep9 = 0, arrivedDecret = 0;

    // Comptage basé sur les snapshots groupés — fiable car indépendant de l'ordre des transitions
    // On cherche le premier snapshot de chaque catégorie et on vérifie son created_at
    if (grouped) {
      grouped.forEach(function(snaps) {
        var statuts = [];
        for (var i = 0; i < snaps.length; i++) {
          statuts.push({ s: (snaps[i].statut || '').toLowerCase(), etape: snaps[i].etape, created: snaps[i].created_at, source: snaps[i].source });
        }

        // Arrivée étape 9 : premier snapshot à étape 9 (SDANF) quand il y avait une étape différente avant
        var hadNon9 = false;
        for (var j = 0; j < statuts.length; j++) {
          if (statuts[j].etape !== 9) { hadNon9 = true; continue; }
          if (hadNon9 && SDANF_STATUTS[statuts[j].s] && statuts[j].source !== 'manual' && new Date(statuts[j].created) >= cutoff) {
            arrivedStep9++;
          }
          break;
        }

        // Pris en charge SDANF (CAA→CAE) : premier snapshot CAE quand le précédent est CAA
        for (var k = 0; k < statuts.length; k++) {
          if (statuts[k].s === 'controle_a_effectuer') {
            if (k > 0 && statuts[k - 1].s === 'controle_a_affecter' && statuts[k].source !== 'manual' && new Date(statuts[k].created) >= cutoff) {
              caaToCAE++;
            }
            break;
          }
        }

        // Transféré au SCEC : premier snapshot SCEC détecté dans la période
        // (soit transition depuis SDANF, soit première observation déjà au SCEC)
        for (var m = 0; m < statuts.length; m++) {
          if (SCEC_STATUTS[statuts[m].s]) {
            var prevNotSCEC = m === 0 || !SCEC_STATUTS[statuts[m - 1].s];
            if (prevNotSCEC && statuts[m].source !== 'manual' && new Date(statuts[m].created) >= cutoff) {
              sdanfToSCEC++;
            }
            break;
          }
        }

        // Inséré dans le décret : premier snapshot à étape 11
        for (var n = 0; n < statuts.length; n++) {
          if (statuts[n].etape === 11) {
            if (statuts[n].source !== 'manual' && new Date(statuts[n].created) >= cutoff) {
              arrivedDecret++;
            }
            break;
          }
        }
      });
    }

    return { caaToCAE: caaToCAE, sdanfToSCEC: sdanfToSCEC, arrivedStep9: arrivedStep9, arrivedDecret: arrivedDecret };
  }

  function renderMouvements(transitions, grouped) {
    mouvementsState.transitions = transitions;
    mouvementsState.grouped = grouped || null;

    // Vérifier si au moins une période a des mouvements
    var section = document.getElementById('mouvements-section');
    var periods = [
      { value: 0, label: "Aujourd\u2019hui" },
      { value: 7, label: '7 jours' },
      { value: 30, label: '30 jours' }
    ];
    var hasAny = false;
    for (var p = 0; p < periods.length; p++) {
      var m = computeDailyMovements(transitions, periods[p].value, mouvementsState.grouped);
      if (m.caaToCAE || m.sdanfToSCEC || m.arrivedStep9 || m.arrivedDecret) { hasAny = true; break; }
    }
    if (!hasAny) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    // Sélectionner la première période qui a des données
    if (mouvementsState.period === 0) {
      var todayM = computeDailyMovements(transitions, 0, mouvementsState.grouped);
      if (!todayM.caaToCAE && !todayM.sdanfToSCEC && !todayM.arrivedStep9 && !todayM.arrivedDecret) {
        for (var q = 0; q < periods.length; q++) {
          var qm = computeDailyMovements(transitions, periods[q].value, mouvementsState.grouped);
          if (qm.caaToCAE || qm.sdanfToSCEC || qm.arrivedStep9 || qm.arrivedDecret) {
            mouvementsState.period = periods[q].value;
            break;
          }
        }
      }
    }

    // Period pills
    var periodEl = document.getElementById('mouvements-period');
    var pillsHtml = '<div class="filter-pills">';
    for (var i = 0; i < periods.length; i++) {
      var pi = periods[i];
      var active = pi.value === mouvementsState.period ? ' active' : '';
      pillsHtml += '<button class="pill mouvement-pill' + active + '" data-period="' + pi.value + '">' + pi.label + '</button>';
    }
    pillsHtml += '</div>';
    periodEl.innerHTML = pillsHtml;

    // Bind pill clicks
    var pills = periodEl.querySelectorAll('.mouvement-pill');
    for (var j = 0; j < pills.length; j++) {
      pills[j].addEventListener('click', function(e) {
        mouvementsState.period = parseInt(e.currentTarget.getAttribute('data-period'), 10);
        var allPills = periodEl.querySelectorAll('.mouvement-pill');
        for (var k = 0; k < allPills.length; k++) allPills[k].classList.remove('active');
        e.currentTarget.classList.add('active');
        renderMouvementsCards();
      });
    }

    renderMouvementsCards();
  }

  function renderMouvementsCards() {
    var grid = document.getElementById('mouvements-grid');
    var section = document.getElementById('mouvements-section');
    var m = computeDailyMovements(mouvementsState.transitions, mouvementsState.period, mouvementsState.grouped);

    var notifs = [
      { count: m.arrivedStep9, color: 'violet', type: 'arrivedStep9', text: function(n) { return 'dossier' + (n > 1 ? 's' : '') + ' pass\u00e9' + (n > 1 ? 's' : '') + ' \u00e0 l\u2019\u00e9tape SDANF'; } },
      { count: m.caaToCAE, color: 'primary', type: 'caaToCAE', text: function(n) { return 'dossier' + (n > 1 ? 's' : '') + ' pris en charge par la SDANF'; } },
      { count: m.sdanfToSCEC, color: 'green', type: 'sdanfToSCEC', text: function(n) { return 'dossier' + (n > 1 ? 's' : '') + ' transf\u00e9r\u00e9' + (n > 1 ? 's' : '') + ' au SCEC'; } },
      { count: m.arrivedDecret, color: 'warning', type: 'arrivedDecret', text: function(n) { return 'dossier' + (n > 1 ? 's' : '') + ' ins\u00e9r\u00e9' + (n > 1 ? 's' : '') + ' dans le d\u00e9cret'; } }
    ];

    var active = notifs.filter(function(n) { return n.count > 0; });

    if (!active.length) {
      grid.innerHTML = '<div class="mouvements-empty">Aucun mouvement d\u00e9tect\u00e9 sur cette p\u00e9riode</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < active.length; i++) {
      var n = active[i];
      html += '<div class="mouvement-notif mouvement-' + n.color + ' mouvement-clickable" data-type="' + n.type + '">' +
        '<span class="mouvement-notif-text"><strong class="mouvement-notif-count">' + n.count + '</strong> ' + n.text(n.count) + '</span>' +
        '<span class="mouvement-chevron">\u203a</span>' +
      '</div>';
    }
    grid.innerHTML = html;

    // Bind click handlers
    var cards = grid.querySelectorAll('.mouvement-clickable');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function(e) {
        var type = e.currentTarget.getAttribute('data-type');
        showMovementDossiers(type);
      });
    }
  }

  /** Construit un objet transition-like depuis un snapshot et son précédent */
  function snapshotToTransition(snap, prevSnap, hash) {
    var toStatut = (snap.statut || '').toLowerCase();
    var fromStatut = prevSnap ? (prevSnap.statut || '').toLowerCase() : '';
    var toInfo = C.STATUTS[toStatut];
    var fromInfo = prevSnap ? C.STATUTS[fromStatut] : null;
    var duration = (prevSnap && prevSnap.date_statut && snap.date_statut) ? U.daysDiff(prevSnap.date_statut, snap.date_statut) : null;
    var type = prevSnap ? (snap.etape === prevSnap.etape ? 'status_change' : 'step_change') : 'step_change';
    return {
      type: type,
      hash: hash.substring(0, 6),
      fromStep: prevSnap ? prevSnap.etape : null,
      toStep: snap.etape,
      fromStatut: fromStatut,
      toStatut: toStatut,
      fromSousEtape: fromInfo ? C.formatSubStep(fromInfo.rang) : (prevSnap ? String(prevSnap.etape) : ''),
      toSousEtape: toInfo ? C.formatSubStep(toInfo.rang) : String(snap.etape),
      fromExplication: fromInfo ? fromInfo.explication : '',
      toExplication: toInfo ? toInfo.explication : '',
      created_at: snap.created_at,
      date_statut: snap.date_statut,
      daysForTransition: duration,
      source: snap.source || 'auto'
    };
  }

  function getMovementTransitions(type) {
    var now = new Date();
    var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var periodDays = mouvementsState.period;
    var cutoff = periodDays === 0 ? startOfToday : new Date(startOfToday.getTime() - periodDays * 86400000);
    var grouped = mouvementsState.grouped;
    var results = [];

    if (!grouped) return results;

    grouped.forEach(function(snaps, hash) {
      var statuts = [];
      for (var i = 0; i < snaps.length; i++) {
        statuts.push((snaps[i].statut || '').toLowerCase());
      }

      if (type === 'arrivedStep9') {
        var hadNon9 = false;
        for (var j = 0; j < snaps.length; j++) {
          if (snaps[j].etape !== 9) { hadNon9 = true; continue; }
          if (hadNon9 && SDANF_STATUTS[statuts[j]] && snaps[j].source !== 'manual' && new Date(snaps[j].created_at) >= cutoff) {
            results.push(snapshotToTransition(snaps[j], j > 0 ? snaps[j - 1] : null, hash));
          }
          break;
        }
      }

      if (type === 'caaToCAE') {
        for (var k = 0; k < snaps.length; k++) {
          if (statuts[k] === 'controle_a_effectuer') {
            if (k > 0 && statuts[k - 1] === 'controle_a_affecter' && snaps[k].source !== 'manual' && new Date(snaps[k].created_at) >= cutoff) {
              results.push(snapshotToTransition(snaps[k], snaps[k - 1], hash));
            }
            break;
          }
        }
      }

      if (type === 'sdanfToSCEC') {
        for (var m = 0; m < snaps.length; m++) {
          if (SCEC_STATUTS[statuts[m]]) {
            var prevNotSCEC = m === 0 || !SCEC_STATUTS[statuts[m - 1]];
            if (prevNotSCEC && snaps[m].source !== 'manual' && new Date(snaps[m].created_at) >= cutoff) {
              results.push(snapshotToTransition(snaps[m], m > 0 ? snaps[m - 1] : null, hash));
            }
            break;
          }
        }
      }

      if (type === 'arrivedDecret') {
        for (var n = 0; n < snaps.length; n++) {
          if (snaps[n].etape === 11) {
            if (snaps[n].source !== 'manual' && new Date(snaps[n].created_at) >= cutoff) {
              results.push(snapshotToTransition(snaps[n], n > 0 ? snaps[n - 1] : null, hash));
            }
            break;
          }
        }
      }
    });

    results.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    return results;
  }

  var MOVEMENT_TITLES = {
    arrivedStep9: 'Dossiers pass\u00e9s \u00e0 l\u2019\u00e9tape SDANF',
    caaToCAE: 'Dossiers pris en charge par la SDANF',
    sdanfToSCEC: 'Dossiers transf\u00e9r\u00e9s au SCEC',
    arrivedDecret: 'Dossiers ins\u00e9r\u00e9s dans le d\u00e9cret'
  };

  function showMovementDossiers(type) {
    var transitions = getMovementTransitions(type);
    if (!transitions.length) return;

    var title = MOVEMENT_TITLES[type] || 'Dossiers';

    var html = '';
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      var color = C.STEP_COLORS[t.toStep] || C.STEP_COLORS[0];
      var badge = ACTIVITY_BADGE[t.type];

      var desc, detail, codeDetail;
      if (t.fromSousEtape) {
        desc = t.fromSousEtape + ' \u2192 ' + (t.toSousEtape || '?');
        detail = (t.fromExplication || t.toExplication) ? (t.fromExplication || '') + ' \u2192 ' + (t.toExplication || '') : '';
        codeDetail = U.escapeHtml((t.fromStatut || '').toUpperCase()) + ' <span class="statut-code-arrow">\u2192</span> ' + U.escapeHtml((t.toStatut || '').toUpperCase());
      } else {
        // Première observation — pas de "from"
        desc = '\u2192 ' + (t.toSousEtape || '?');
        detail = t.toExplication || '';
        codeDetail = U.escapeHtml((t.toStatut || '').toUpperCase());
      }
      var durHtml = '';
      if (t.daysForTransition !== null) {
        durHtml = '<span class="history-duration">' + U.formatDuration(t.daysForTransition) + '</span>';
      }

      html += '<div class="mouvement-dossier-item" data-hash="' + U.escapeHtml(t.hash) + '">' +
        '<span class="activity-dot" style="background:' + color + ';flex-shrink:0"></span>' +
        '<div class="mouvement-dossier-content">' +
          '<div class="mouvement-dossier-top">' +
            '<span class="activity-hash">#' + U.escapeHtml(t.hash) + '</span>' +
            '<span class="badge-type ' + badge.css + '">' + badge.label + '</span>' +
            durHtml +
          '</div>' +
          '<div class="mouvement-dossier-desc">' + U.escapeHtml(desc) + '</div>' +
          (detail ? '<div class="mouvement-dossier-detail">' + U.escapeHtml(detail) + '</div>' : '') +
          '<div class="statut-code">' + codeDetail + '</div>' +
          '<div class="mouvement-dossier-date">' + U.formatDateTimeFr(t.created_at) + '</div>' +
        '</div>' +
        '<span class="mouvement-chevron">\u203a</span>' +
      '</div>';
    }

    // Create or reuse modal
    var modal = document.getElementById('mouvement-list-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mouvement-list-modal';
      modal.className = 'history-modal-overlay';
      modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('open');
      });
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="history-modal">' +
        '<div class="history-modal-header">' +
          '<h3>' + U.escapeHtml(title) + '</h3>' +
          '<button class="history-close" title="Fermer">\u00d7</button>' +
        '</div>' +
        '<div class="modal-history-list mouvement-dossier-list">' + html + '</div>' +
      '</div>';

    modal.querySelector('.history-close').addEventListener('click', function() {
      modal.classList.remove('open');
    });

    // Bind dossier click handlers → open history
    var items = modal.querySelectorAll('.mouvement-dossier-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function(e) {
        var hash = e.currentTarget.getAttribute('data-hash');
        modal.classList.remove('open');
        showDossierHistory(hash, { movementType: type });
      });
    }

    modal.classList.add('open');
  }

  // ─── Mouvements Chart ───────────────────────────────────

  var MOUVEMENT_SERIES = [
    { key: 'arrivedStep9', label: 'Arriv\u00e9s SDANF', color: '#8b5cf6' },
    { key: 'caaToCAE', label: 'Pris en charge SDANF', color: '#3b82f6' },
    { key: 'sdanfToSCEC', label: 'Transf\u00e9r\u00e9s SCEC', color: '#10b981' },
    { key: 'arrivedDecret', label: 'Ins\u00e9r\u00e9s d\u00e9cret', color: '#f59e0b' }
  ];

  var mouvChartState = { visible: {}, granularity: 'week', dateFrom: '', dateTo: '', transitions: [] };
  for (var ms = 0; ms < MOUVEMENT_SERIES.length; ms++) {
    mouvChartState.visible[MOUVEMENT_SERIES[ms].key] = true;
  }

  function getWeekLabel(date) {
    var d = new Date(date);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(d.getFullYear(), d.getMonth(), diff);
    return String(monday.getDate()).padStart(2, '0') + '/' + String(monday.getMonth() + 1).padStart(2, '0') + '/' + String(monday.getFullYear()).slice(-2);
  }

  function getMonthLabel(date) {
    var d = new Date(date);
    var MOIS = ['Jan', 'F\u00e9v', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Ao\u00fb', 'Sep', 'Oct', 'Nov', 'D\u00e9c'];
    return MOIS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function classifyTransition(t) {
    var r = { arrivedStep9: 0, caaToCAE: 0, sdanfToSCEC: 0, arrivedDecret: 0 };
    if (t.fromStatut === 'controle_a_affecter' && t.toStatut === 'controle_a_effectuer') r.caaToCAE = 1;
    if (t.type !== 'first_seen' && SCEC_STATUTS[t.toStatut] && !SCEC_STATUTS[t.fromStatut]) r.sdanfToSCEC = 1;
    if (t.type === 'step_change' && t.toStep === 9 && t.fromStep !== 9 && SDANF_STATUTS[t.toStatut]) r.arrivedStep9 = 1;
    if (t.type === 'step_change' && t.toStep === 11 && t.fromStep !== 11) r.arrivedDecret = 1;
    return r;
  }

  function computeGroupedMovements(transitions, granularity, dateFrom, dateTo) {
    var buckets = {};
    var fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    var toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;

    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      var d = new Date(t.created_at);
      if (fromDate && d < fromDate) continue;
      if (toDate && d > toDate) continue;

      var label = granularity === 'month' ? getMonthLabel(t.created_at) : getWeekLabel(t.created_at);
      if (!buckets[label]) buckets[label] = { arrivedStep9: 0, caaToCAE: 0, sdanfToSCEC: 0, arrivedDecret: 0, _sort: d };

      var cls = classifyTransition(t);
      buckets[label].arrivedStep9 += cls.arrivedStep9;
      buckets[label].caaToCAE += cls.caaToCAE;
      buckets[label].sdanfToSCEC += cls.sdanfToSCEC;
      buckets[label].arrivedDecret += cls.arrivedDecret;
    }
    var keys = Object.keys(buckets).sort(function(a, b) { return buckets[a]._sort - buckets[b]._sort; });
    return { labels: keys, data: buckets };
  }

  function renderMouvementsChart(transitions) {
    mouvChartState.transitions = transitions;
    var section = document.getElementById('mouvements-chart-section');

    // Check if any movement data exists
    var hasData = false;
    for (var i = 0; i < transitions.length; i++) {
      var cls = classifyTransition(transitions[i]);
      if (cls.arrivedStep9 || cls.caaToCAE || cls.sdanfToSCEC || cls.arrivedDecret) { hasData = true; break; }
    }
    if (!hasData) { section.style.display = 'none'; return; }
    section.style.display = '';

    // Collapsible toggle
    var header = document.getElementById('mouvements-chart-toggle');
    var panel = document.getElementById('mouvements-chart-panel');
    header.addEventListener('click', function() {
      var isOpen = panel.classList.contains('open');
      panel.classList.toggle('open');
      header.classList.toggle('open');
      if (!isOpen) refreshMouvChart();
    });

    // Detect date range from data
    var allDates = transitions.map(function(t) { return t.created_at.substring(0, 10); }).sort();
    if (allDates.length) {
      var fromInput = document.getElementById('mouv-date-from');
      var toInput = document.getElementById('mouv-date-to');
      fromInput.min = allDates[0];
      fromInput.max = allDates[allDates.length - 1];
      toInput.min = allDates[0];
      toInput.max = allDates[allDates.length - 1];
      fromInput.value = allDates[0];
      toInput.value = allDates[allDates.length - 1];
      mouvChartState.dateFrom = allDates[0];
      mouvChartState.dateTo = allDates[allDates.length - 1];
    }

    // Legend toggles
    var togglesEl = document.getElementById('mouvements-chart-toggles');
    var togglesHtml = '';
    for (var j = 0; j < MOUVEMENT_SERIES.length; j++) {
      var s = MOUVEMENT_SERIES[j];
      togglesHtml += '<span class="chart-legend-toggle active" data-key="' + s.key + '" style="color:' + s.color + '">' +
        '<span class="legend-dot" style="background:' + s.color + '"></span>' + s.label + '</span>';
    }
    togglesEl.innerHTML = togglesHtml;

    var toggleBtns = togglesEl.querySelectorAll('.chart-legend-toggle');
    for (var k = 0; k < toggleBtns.length; k++) {
      toggleBtns[k].addEventListener('click', function(e) {
        var btn = e.currentTarget;
        var key = btn.getAttribute('data-key');
        mouvChartState.visible[key] = !mouvChartState.visible[key];
        btn.classList.toggle('active', mouvChartState.visible[key]);
        refreshMouvChart();
      });
    }

    // Date inputs
    document.getElementById('mouv-date-from').addEventListener('change', function(e) {
      mouvChartState.dateFrom = e.target.value; refreshMouvChart();
    });
    document.getElementById('mouv-date-to').addEventListener('change', function(e) {
      mouvChartState.dateTo = e.target.value; refreshMouvChart();
    });

    // Granularity buttons
    var granBtns = document.querySelectorAll('.mouv-gran-btn');
    for (var g = 0; g < granBtns.length; g++) {
      granBtns[g].addEventListener('click', function(e) {
        for (var gb = 0; gb < granBtns.length; gb++) granBtns[gb].classList.remove('active');
        e.currentTarget.classList.add('active');
        mouvChartState.granularity = e.currentTarget.getAttribute('data-gran');
        refreshMouvChart();
      });
    }

  }

  function refreshMouvChart() {
    var grouped = computeGroupedMovements(
      mouvChartState.transitions,
      mouvChartState.granularity,
      mouvChartState.dateFrom,
      mouvChartState.dateTo
    );

    var datasets = [];
    for (var i = 0; i < MOUVEMENT_SERIES.length; i++) {
      var s = MOUVEMENT_SERIES[i];
      if (!mouvChartState.visible[s.key]) continue;
      var values = [];
      for (var j = 0; j < grouped.labels.length; j++) {
        values.push(grouped.data[grouped.labels[j]][s.key]);
      }
      datasets.push({
        label: s.label,
        data: values,
        backgroundColor: s.color + '99',
        borderColor: s.color,
        borderWidth: 1,
        borderRadius: 4
      });
    }

    var granLabel = mouvChartState.granularity === 'month' ? 'Mois de ' : 'Semaine du ';
    var config = CH.barConfig(grouped.labels, datasets, {
      stacked: true,
      datalabels: false
    });
    config.options.plugins.legend = { display: false };
    config.options.plugins.tooltip = {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: function(items) { return granLabel + items[0].label; },
        footer: function(items) {
          var total = 0;
          for (var i = 0; i < items.length; i++) total += items[i].parsed.y;
          return 'Total : ' + total;
        }
      }
    };
    config.options.scales.x.ticks = { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 };

    CH.create('mouvements-weekly', 'mouvements-chart-canvas', config);
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
        var fromInfo = prev.statut ? C.STATUTS[prev.statut.toLowerCase()] : null;
        var toInfo = cur.statut ? C.STATUTS[cur.statut.toLowerCase()] : null;
        var type = sameStep ? 'status_change' : 'step_change';
        transitions.push({
          type: type,
          hash: hash.substring(0, 6),
          fromStep: prev.etape,
          toStep: cur.etape,
          fromStatut: prev.statut ? prev.statut.toLowerCase() : '',
          toStatut: cur.statut ? cur.statut.toLowerCase() : '',
          fromSousEtape: fromInfo ? C.formatSubStep(fromInfo.rang) : String(prev.etape),
          toSousEtape: toInfo ? C.formatSubStep(toInfo.rang) : String(cur.etape),
          fromExplication: fromInfo ? fromInfo.explication : '',
          toExplication: toInfo ? toInfo.explication : '',
          created_at: cur.created_at,
          date_statut: cur.date_statut || null,
          statut: cur.statut,
          daysForTransition: duration,
          source: cur.source || 'auto'
        });
      }
      if (snaps.length > 0) {
        var firstInfo = snaps[0].statut ? C.STATUTS[snaps[0].statut.toLowerCase()] : null;
        transitions.push({
          type: 'first_seen',
          hash: hash.substring(0, 6),
          fromStep: null,
          toStep: snaps[0].etape,
          fromStatut: '',
          toStatut: snaps[0].statut ? snaps[0].statut.toLowerCase() : '',
          fromSousEtape: null,
          toSousEtape: firstInfo ? C.formatSubStep(firstInfo.rang) : String(snaps[0].etape),
          fromExplication: null,
          toExplication: firstInfo ? firstInfo.explication : '',
          created_at: snaps[0].created_at,
          date_statut: snaps[0].date_statut || null,
          statut: snaps[0].statut,
          daysForTransition: null,
          source: snaps[0].source || 'auto'
        });
      }
    });

    transitions.sort(function(a, b) {
      var diff = new Date(b.created_at) - new Date(a.created_at);
      if (diff !== 0) return diff;
      // Même created_at (ex: rectification manuelle) → trier par date_statut DESC
      var dsA = a.date_statut || '', dsB = b.date_statut || '';
      if (dsA !== dsB) return dsA < dsB ? 1 : -1;
      // Même date_statut → trier par étape DESC
      return (b.toStep || 0) - (a.toStep || 0);
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
        var toLabel = t.toExplication || C.PHASE_NAMES[t.toStep] || '\u00e9tape ' + t.toStep;
        text = 'Nouveau dossier \u2014 \u00e9tape ' + t.toSousEtape +
          ' <span style="color:var(--text-dim)">(' + U.escapeHtml(toLabel) + ')</span>' +
          ' <span class="statut-code">(' + U.escapeHtml(t.toStatut.toUpperCase()) + ')</span>';
      } else if (t.type === 'status_change') {
        var fromLbl = t.fromExplication || C.PHASE_NAMES[t.fromStep] || '\u00e9tape ' + t.fromStep;
        var toLbl = t.toExplication || C.PHASE_NAMES[t.toStep] || '\u00e9tape ' + t.toStep;
        var dur = '';
        if (t.daysForTransition !== null) {
          dur = ' <span class="activity-duration">' + U.formatDuration(t.daysForTransition) + '</span>';
        }
        text = '\u00c9tape ' + t.fromStep + ' \u2014 ' +
          '<span style="color:' + color + '">' + t.fromSousEtape + '</span>' +
          ' \u2192 ' +
          '<span style="color:' + color + '">' + t.toSousEtape + '</span>' +
          dur +
          ' <span style="color:var(--text-dim)">(' + U.escapeHtml(fromLbl) + ' \u2192 ' + U.escapeHtml(toLbl) + ')</span>' +
          ' <span class="statut-code">(' + U.escapeHtml(t.toStatut.toUpperCase()) + ')</span>';
      } else {
        var fromLabel2 = t.fromExplication || C.PHASE_NAMES[t.fromStep] || '\u00e9tape ' + t.fromStep;
        var toLabel2 = t.toExplication || C.PHASE_NAMES[t.toStep] || '\u00e9tape ' + t.toStep;
        var durationBadge = '';
        if (t.daysForTransition !== null) {
          durationBadge = ' <span class="activity-duration">' + U.formatDuration(t.daysForTransition) + '</span>';
        }
        text = '<span style="color:' + C.STEP_COLORS[t.fromStep] + '">' + t.fromSousEtape + '</span>' +
          ' \u2192 ' +
          '<span style="color:' + color + '">' + t.toSousEtape + '</span>' +
          durationBadge +
          ' <span style="color:var(--text-dim)">(' + U.escapeHtml(fromLabel2) + ' \u2192 ' + U.escapeHtml(toLabel2) + ')</span>' +
          ' <span class="statut-code">(' + U.escapeHtml(t.toStatut.toUpperCase()) + ')</span>';
      }

      html += '<li class="activity-item activity-clickable" data-hash="' + U.escapeHtml(t.hash) + '">' +
        '<span class="activity-dot" style="background:' + color + '"></span>' +
        '<span class="activity-hash">#' + U.escapeHtml(t.hash) + '</span>' +
        '<span class="activity-text">' + badgeHtml + text + '</span>' +
        '<span class="activity-time">' + U.formatDateTimeFr(t.created_at) + '</span>' +
        '</li>';
    }
    feed.innerHTML = html;

    // Bind click handlers for dossier history popup
    var items = feed.querySelectorAll('.activity-clickable');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function(e) {
        var hash = e.currentTarget.getAttribute('data-hash');
        showDossierHistory(hash);
      });
    }
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

  function renderActivityFeed(transitions) {
    activityState.transitions = transitions;
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

  // ─── Dossier Click Helper ─────────────────────────────

  function bindDossierClicks(container) {
    var items = container.querySelectorAll('.dossier-clickable');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function(e) {
        var hash = e.currentTarget.getAttribute('data-hash');
        if (hash) showDossierHistory(hash);
      });
    }
  }

  function findSummary(hash) {
    for (var i = 0; i < allSummaries.length; i++) {
      if (allSummaries[i].hash === hash) return allSummaries[i];
    }
    return null;
  }

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

  // ─── Dossier History Popup ─────────────────────────────

  function showDossierHistory(hash, backTo) {
    var summary = findSummary(hash);
    var history = activityState.transitions
      .filter(function(t) { return t.hash === hash; })
      .sort(function(a, b) {
        // Trier par date_statut ASC (chronologie réelle du dossier)
        var dsA = a.date_statut || '', dsB = b.date_statut || '';
        if (dsA !== dsB) return dsA < dsB ? -1 : 1;
        // Même date_statut → trier par étape ASC
        var stepDiff = (a.toStep || 0) - (b.toStep || 0);
        if (stepDiff !== 0) return stepDiff;
        // Fallback : created_at ASC
        return new Date(a.created_at) - new Date(b.created_at);
      });

    // Build timeline HTML
    var timelineHtml = '';
    var now = new Date();
    for (var i = 0; i < history.length; i++) {
      var t = history[i];
      var color = C.STEP_COLORS[t.toStep] || C.STEP_COLORS[0];
      var badge = ACTIVITY_BADGE[t.type];

      // Durée passée sur ce statut
      var thisDateStatut = t.date_statut;
      var nextDateStatut = (i + 1 < history.length) ? history[i + 1].date_statut : null;
      var isCurrentStatus = (i === history.length - 1);
      var dossierFinished = summary && summary.isFinished;
      var timeOnStatus = null;
      if (thisDateStatut && nextDateStatut) {
        timeOnStatus = U.daysDiff(thisDateStatut, nextDateStatut);
      } else if (thisDateStatut && !nextDateStatut) {
        if (dossierFinished) {
          // Dossier terminé : ne pas compter vers aujourd'hui
          timeOnStatus = null;
        } else {
          // Dernier statut (en cours) : date_statut → aujourd'hui
          timeOnStatus = U.daysDiff(thisDateStatut, now);
        }
      }
      if (timeOnStatus === null && !isCurrentStatus) {
        // Fallback sur created_at (date de vérification Supabase)
        var thisDate = t.created_at;
        var nextDate = (i + 1 < history.length) ? history[i + 1].created_at : now;
        timeOnStatus = U.daysDiff(thisDate, nextDate);
      }

      var desc;
      if (t.type === 'first_seen') {
        desc = 'Premi\u00e8re observation \u2014 \u00e9tape ' + t.toSousEtape +
          '<br><span class="history-detail">' + U.escapeHtml(t.toExplication || '') + '</span>' +
          '<br><span class="statut-code">(' + U.escapeHtml(t.toStatut.toUpperCase()) + ')</span>';
      } else if (t.type === 'status_change') {
        desc = '\u00c9tape ' + t.fromStep + ' : ' + t.fromSousEtape + ' \u2192 ' + t.toSousEtape;
        var fromExp = t.fromExplication || '';
        var toExp = t.toExplication || '';
        desc += '<br><span class="history-detail">' + U.escapeHtml(fromExp) + ' \u2192 ' + U.escapeHtml(toExp) + '</span>' +
          '<br><span class="statut-code">(' + U.escapeHtml(t.fromStatut.toUpperCase()) + ' <span class="statut-code-arrow">\u2192</span> ' + U.escapeHtml(t.toStatut.toUpperCase()) + ')</span>';
      } else {
        desc = t.fromSousEtape + ' \u2192 ' + t.toSousEtape;
        var fromExp2 = t.fromExplication || C.PHASE_NAMES[t.fromStep] || '';
        var toExp2 = t.toExplication || C.PHASE_NAMES[t.toStep] || '';
        desc += '<br><span class="history-detail">' + U.escapeHtml(fromExp2) + ' \u2192 ' + U.escapeHtml(toExp2) + '</span>' +
          '<br><span class="statut-code">(' + U.escapeHtml(t.fromStatut.toUpperCase()) + ' <span class="statut-code-arrow">\u2192</span> ' + U.escapeHtml(t.toStatut.toUpperCase()) + ')</span>';
      }

      var durHtml = '';
      if (t.daysForTransition !== null) {
        durHtml = '<span class="history-duration">' + U.formatDuration(t.daysForTransition) + '</span>';
      }

      // Badge "temps passé sur ce statut" + date du statut
      var timeOnHtml = '';
      if (isCurrentStatus && dossierFinished && thisDateStatut) {
        // Dossier terminé — afficher la date de fin sans compteur
        timeOnHtml = '<div class="history-time-on-status current">\u2705 Termin\u00e9 \u2014 ' + U.formatDateFr(thisDateStatut) + '</div>';
      } else if (timeOnStatus !== null) {
        var cssClass = isCurrentStatus ? 'history-time-on-status current' : 'history-time-on-status';
        var prefix = isCurrentStatus ? '\u23f3 ' : '\u23f1 ';
        var dateStatutStr = thisDateStatut ? ' \u2014 ' + U.formatDateFr(thisDateStatut) : '';
        timeOnHtml = '<div class="' + cssClass + '">' + prefix + U.formatDuration(timeOnStatus) + (isCurrentStatus ? ' (en cours)' : '') + dateStatutStr + '</div>';
      }

      timelineHtml += '<div class="history-item">' +
        '<div class="history-dot" style="background:' + color + '"></div>' +
        '<div class="history-connector"></div>' +
        '<div class="history-content">' +
          '<div class="history-header">' +
            '<span class="badge-type ' + badge.css + '">' + badge.label + '</span>' +
            durHtml +
            '<span class="history-date">' + U.formatDateTimeFr(t.created_at) + '</span>' +
          '</div>' +
          '<div class="history-desc">' + desc + '</div>' +
          timeOnHtml +
        '</div>' +
      '</div>';
    }

    // Create or reuse modal
    var modal = document.getElementById('history-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'history-modal';
      modal.className = 'history-modal-overlay';
      modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('open');
      });
      document.body.appendChild(modal);
    }

    var backBtnHtml = (backTo && (backTo.movementType || backTo.decret || backTo.timelineBubble))
      ? '<button class="history-back" title="Retour">\u2190</button>'
      : '';

    var infoHtml = buildDossierInfoHtml(summary);
    var historyLabel = history.length ? '<div class="detail-section-label">Historique des transitions</div>' : '<div class="detail-section-label" style="color:var(--text-dim)">Aucune transition observ\u00e9e</div>';

    modal.innerHTML =
      '<div class="history-modal">' +
        '<div class="history-modal-header">' +
          backBtnHtml +
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

    var backBtn = modal.querySelector('.history-back');
    if (backBtn && backTo) {
      backBtn.addEventListener('click', function() {
        modal.classList.remove('open');
        if (backTo.decret) {
          showDecretDossiers(backTo.decret.num, backTo.decret.dossiers);
        } else if (backTo.movementType) {
          showMovementDossiers(backTo.movementType);
        } else if (backTo.timelineBubble) {
          // Re-trigger the timeline bubble click to reopen its modal
          var tb = backTo.timelineBubble;
          var bubble = _timelineWrapper && _timelineWrapper.querySelector('.station-sub-bubble[data-step="' + tb.step + '"][data-statut="' + tb.statut + '"]');
          if (bubble) bubble.click();
        }
      });
    }

    // Open with animation
    modal.classList.add('open');
  }

  // ─── Décret Dossiers Popup ──────────────────────────────

  function showDecretDossiers(decretNum, dossiers) {
    var html = '';
    for (var i = 0; i < dossiers.length; i++) {
      var s = dossiers[i];
      var color = C.getStepColor(s.currentStep);
      var daysLabel = s.daysSinceDeposit != null ? U.formatDuration(s.daysSinceDeposit) : '\u2014';

      html += '<div class="mouvement-dossier-item" data-hash="' + U.escapeHtml(s.hash) + '">' +
        '<span class="activity-dot" style="background:' + color + ';flex-shrink:0"></span>' +
        '<div class="mouvement-dossier-content">' +
          '<div class="mouvement-dossier-top">' +
            '<span class="activity-hash">#' + U.escapeHtml(s.hash) + '</span>' +
            '<span class="detail-badge" style="background:' + color + ';font-size:0.7rem;padding:0.1rem 0.4rem">' + U.escapeHtml(s.sousEtape) + '</span>' +
          '</div>' +
          '<div class="mouvement-dossier-desc">' + U.escapeHtml(s.explication) + '</div>' +
          '<div class="mouvement-dossier-detail">' + daysLabel + ' depuis le d\u00e9p\u00f4t' +
            (s.prefecture ? ' \u2014 ' + U.escapeHtml(s.prefecture) : '') +
          '</div>' +
        '</div>' +
        '<span class="mouvement-chevron">\u203a</span>' +
      '</div>';
    }

    var modal = document.getElementById('decret-list-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'decret-list-modal';
      modal.className = 'history-modal-overlay';
      modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.remove('open');
      });
      document.body.appendChild(modal);
    }

    modal.innerHTML =
      '<div class="history-modal">' +
        '<div class="history-modal-header">' +
          '<h3>D\u00e9cret ' + U.escapeHtml(decretNum) + ' \u2014 ' + dossiers.length + ' dossier' + (dossiers.length > 1 ? 's' : '') + '</h3>' +
          '<button class="history-close" title="Fermer">\u00d7</button>' +
        '</div>' +
        '<div class="modal-history-list mouvement-dossier-list">' + html + '</div>' +
      '</div>';

    modal.querySelector('.history-close').addEventListener('click', function() {
      modal.classList.remove('open');
    });

    var items = modal.querySelectorAll('.mouvement-dossier-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function(e) {
        var hash = e.currentTarget.getAttribute('data-hash');
        modal.classList.remove('open');
        showDossierHistory(hash, { decret: { num: decretNum, dossiers: dossiers } });
      });
    }

    modal.classList.add('open');
  }

})();
