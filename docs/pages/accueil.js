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
        loading.innerHTML = '<div class="error-msg"><p>Aucune donnee disponible pour le moment.</p>' +
          '<p style="font-size:0.85rem;margin-top:0.5rem;color:#94a3b8">Les donnees apparaitront quand des utilisateurs partageront leurs statistiques.</p></div>';
        return;
      }

      var grouped = D.groupByDossier(snapshots);
      var summaries = D.computeDossierSummaries(grouped);

      loading.style.display = 'none';
      main.style.display = 'block';

      renderKPIs(summaries, snapshots);
      renderTimeline(summaries);
      renderDoughnut(summaries);
      renderSummaryCards(summaries);
      renderCAEPassages(grouped);
      renderActivityFeed(snapshots, grouped);

    } catch (error) {
      loading.innerHTML = '<div class="error-msg"><p>Impossible de charger les statistiques.</p>' +
        '<p style="font-size:0.85rem;margin-top:0.5rem;color:#94a3b8">' + U.escapeHtml(error.message) + '</p></div>';
    }
  });

  function renderKPIs(summaries, snapshots) {
    U.setText('kpi-dossiers', summaries.length);
    U.setText('kpi-observations', snapshots.length);

    var withDeposit = summaries.filter(function(s) { return s.daysSinceDeposit != null; });
    if (withDeposit.length > 0) {
      var totalDays = 0;
      var daysArr = [];
      for (var i = 0; i < withDeposit.length; i++) {
        totalDays += withDeposit[i].daysSinceDeposit;
        daysArr.push(withDeposit[i].daysSinceDeposit);
      }
      var avgDays = Math.round(totalDays / withDeposit.length);
      var medDays = Math.round(U.medianCalc(daysArr));
      U.setText('kpi-avg-days', (avgDays / 30).toFixed(1) + ' mois');
      U.setText('kpi-avg-sub', avgDays + ' jours (' + withDeposit.length + ' dossier' + (withDeposit.length > 1 ? 's' : '') + ')');
      U.setText('kpi-med-days', (medDays / 30).toFixed(1) + ' mois');
      U.setText('kpi-med-sub', medDays + ' jours (mediane)');
    }

    // Prefectures
    var prefSet = {};
    for (var j = 0; j < summaries.length; j++) {
      if (summaries[j].prefecture) prefSet[summaries[j].prefecture] = true;
    }
    U.setText('kpi-prefectures', Object.keys(prefSet).length || '\u2014');

    // Success rate
    var step12 = summaries.filter(function(s) { return s.currentStep === 12; });
    if (step12.length > 0) {
      var positive = step12.filter(function(s) { return C.isPositiveStatus(s.statut); });
      var pct = Math.round(positive.length / step12.length * 100);
      U.setText('kpi-success-rate', pct + '%');
      U.setText('kpi-success-sub', positive.length + '/' + step12.length + ' favorables');
    }

    // Fastest dossier (step 12 positive, min daysSinceDeposit)
    var positives = summaries.filter(function(s) {
      return s.currentStep === 12 && C.isPositiveStatus(s.statut) && s.daysSinceDeposit != null;
    });
    if (positives.length > 0) {
      positives.sort(function(a, b) { return a.daysSinceDeposit - b.daysSinceDeposit; });
      var fastest = positives[0];
      U.setText('kpi-fastest', U.formatDuration(fastest.daysSinceDeposit));
      U.setText('kpi-fastest-sub', '#' + fastest.hash);
    }

    // Last update
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
    for (var i = 0; i < summaries.length; i++) {
      var s = summaries[i];
      if (!byStep[s.currentStep]) byStep[s.currentStep] = [];
      byStep[s.currentStep].push(s);
    }

    var html = '<div class="global-timeline">';
    for (var step = 1; step <= 12; step++) {
      var dossiers = byStep[step] || [];
      var color = C.STEP_COLORS[step];
      var isActive = dossiers.length > 0;

      var markers = '';
      for (var j = 0; j < dossiers.length; j++) {
        var d = dossiers[j];
        markers += '<span class="timeline-marker" style="background:' + color + '" title="#' + U.escapeHtml(d.hash) + ' \u2014 ' + d.sousEtape + ' ' + U.escapeHtml(d.explication) + ' \u2014 ' + U.formatDuration(d.daysAtCurrentStatus) + '">' + U.escapeHtml(d.hash.substring(0, 3)) + '</span>';
      }

      html += '<div class="timeline-station ' + (isActive ? 'active' : '') + '">' +
        '<div class="station-dot" style="--dot-color:' + color + '"></div>' +
        '<div class="station-number">' + step + '</div>' +
        '<div class="station-name">' + C.PHASE_NAMES[step] + '</div>' +
        '<div class="station-markers">' + markers + '</div>' +
        (dossiers.length > 0 ? '<div class="station-count">' + dossiers.length + '</div>' : '') +
        '</div>';
    }
    html += '</div>';
    wrapper.innerHTML = html;
  }

  function renderDoughnut(summaries) {
    var distribution = D.computePhaseDistribution(summaries);
    var canvas = document.getElementById('doughnut-chart');
    var noData = document.getElementById('doughnut-no-data');

    if (!distribution.length) {
      canvas.style.display = 'none';
      noData.style.display = 'block';
      return;
    }

    canvas.style.display = 'block';
    noData.style.display = 'none';

    var labels = distribution.map(function(d) {
      var label = d.etape + '. ' + d.phase;
      if (d.statuts) {
        var codes = Object.keys(d.statuts).sort(function(a, b) { return d.statuts[b] - d.statuts[a]; });
        if (codes.length === 1) {
          label += ' (' + codes[0] + ')';
        } else if (codes.length === 2) {
          label += ' (' + codes[0] + ', ' + codes[1] + ')';
        } else if (codes.length > 2) {
          label += ' (' + codes[0] + ', ' + codes[1] + '...)';
        }
      }
      return label;
    });
    var values = distribution.map(function(d) { return d.count; });
    var colors = distribution.map(function(d) { return C.STEP_COLORS[d.etape] || C.STEP_COLORS[0]; });

    CH.create('doughnut', 'doughnut-chart', CH.doughnutConfig(labels, values, colors));
  }

  function renderSummaryCards(summaries) {
    var container = document.getElementById('summary-cards');

    var enAttente = summaries.filter(function(s) { return s.currentStep >= 3 && s.currentStep <= 11; }).length;
    var naturalises = summaries.filter(function(s) { return s.currentStep === 12 && C.isPositiveStatus(s.statut); }).length;
    var negatifs = summaries.filter(function(s) { return C.isNegativeStatus(s.statut); }).length;
    var complements = summaries.filter(function(s) { return s.hasComplement; }).length;

    container.innerHTML =
      '<div class="summary-card"><div class="sc-label">En attente</div><div class="sc-value" style="color:var(--orange)">' + enAttente + '</div><div class="sc-sub">etapes 3-11</div></div>' +
      '<div class="summary-card"><div class="sc-label">Naturalises</div><div class="sc-value" style="color:var(--green)">' + naturalises + '</div><div class="sc-sub">decision favorable</div></div>' +
      '<div class="summary-card"><div class="sc-label">Decisions negatives</div><div class="sc-value" style="color:var(--red)">' + negatifs + '</div><div class="sc-sub">refus ou irrecevabilite</div></div>' +
      '<div class="summary-card"><div class="sc-label">Complement demande</div><div class="sc-value" style="color:var(--violet)">' + complements + '</div><div class="sc-sub">pieces supplementaires</div></div>';
  }

  function renderCAEPassages(grouped) {
    var todayBanner = document.getElementById('cae-today');
    var feed = document.getElementById('cae-feed');

    // Collect all transitions controle_a_affecter -> controle_a_effectuer
    var passages = [];

    grouped.forEach(function(snaps, hash) {
      for (var i = 1; i < snaps.length; i++) {
        if (snaps[i - 1].statut === 'controle_a_affecter' && snaps[i].statut === 'controle_a_effectuer') {
          var waitDays = null;
          if (snaps[i - 1].date_statut && snaps[i].date_statut) {
            waitDays = U.daysDiff(snaps[i - 1].date_statut, snaps[i].date_statut);
          }
          passages.push({
            hash: hash.substring(0, 6),
            date: snaps[i].date_statut || snaps[i].created_at,
            created_at: snaps[i].created_at,
            waitDays: waitDays,
            prefecture: snaps[i].prefecture || null
          });
        }
      }
    });

    // Sort by date desc
    passages.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    // Today banner
    var todayStr = new Date().toISOString().substring(0, 10);
    var todayPassages = passages.filter(function(p) {
      return p.date && p.date.substring(0, 10) === todayStr;
    });

    if (todayPassages.length > 0) {
      todayBanner.className = 'cae-today-banner has-passages';
      todayBanner.innerHTML = '<span class="cae-count">' + todayPassages.length + '</span> passage' +
        (todayPassages.length > 1 ? 's' : '') + ' en CAE aujourd\'hui';
    } else {
      todayBanner.className = 'cae-today-banner no-passages';
      todayBanner.innerHTML = 'Aucun passage en CAE aujourd\'hui';
    }

    // Feed: group by date, show last 30 passages
    var recent = passages.slice(0, 30);

    if (!recent.length) {
      feed.innerHTML = '<li class="no-data">Aucun passage contr\u00f4le_a_affecter \u2192 contr\u00f4le_a_effectuer enregistre</li>';
      return;
    }

    var html = '';
    var lastDateGroup = '';
    var color = C.STEP_COLORS[9];

    for (var i = 0; i < recent.length; i++) {
      var p = recent[i];
      var dateStr = p.date ? p.date.substring(0, 10) : '';
      var dateLabel = dateStr === todayStr ? 'Aujourd\'hui' : U.formatDateFr(dateStr);

      // Date group header
      if (dateStr !== lastDateGroup) {
        html += '<li class="cae-date-group">' + dateLabel + '</li>';
        lastDateGroup = dateStr;
      }

      var waitBadge = '';
      if (p.waitDays !== null) {
        waitBadge = ' <span class="activity-duration">' + U.formatDuration(p.waitDays) + ' d\'attente</span>';
      }

      var prefBadge = '';
      if (p.prefecture) {
        prefBadge = ' <span style="color:var(--text-dim)">\u2014 ' + U.escapeHtml(p.prefecture) + '</span>';
      }

      html += '<li class="activity-item">' +
        '<span class="activity-dot" style="background:' + color + '"></span>' +
        '<span class="activity-hash">#' + U.escapeHtml(p.hash) + '</span>' +
        '<span class="activity-text">9.1 \u2192 9.2' + waitBadge + prefBadge + '</span>' +
        '<span class="activity-time">' + U.formatDateTimeFr(p.created_at) + '</span>' +
        '</li>';
    }
    feed.innerHTML = html;
  }

  function renderActivityFeed(snapshots, grouped) {
    var feed = document.getElementById('activity-feed');

    // Build real transitions: only where etape actually changed
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
      // Also include first observation of each dossier as "debut"
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

    // Sort by date desc and take 15
    transitions.sort(function(a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    var recent = transitions.slice(0, 15);

    if (!recent.length) {
      feed.innerHTML = '<li class="no-data">Aucune activite recente</li>';
      return;
    }

    var html = '';
    for (var i = 0; i < recent.length; i++) {
      var t = recent[i];
      var color = C.STEP_COLORS[t.toStep] || C.STEP_COLORS[0];

      var text;
      if (t.fromStep === null) {
        var toLabel = t.toExplication || C.PHASE_NAMES[t.toStep] || 'etape ' + t.toStep;
        text = 'debut a l\'etape ' + t.toSousEtape + ' <span style="color:var(--text-dim)">(' + U.escapeHtml(toLabel) + ')</span>';
      } else {
        var fromLabel = t.fromExplication || C.PHASE_NAMES[t.fromStep] || 'etape ' + t.fromStep;
        var toLabel2 = t.toExplication || C.PHASE_NAMES[t.toStep] || 'etape ' + t.toStep;
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

})();
