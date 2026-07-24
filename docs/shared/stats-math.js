/**
 * shared/stats-math.js — Fonctions statistiques avancees
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  var _numAsc = function(a, b) { return a - b; };

  /** Percentile sur un tableau DÉJÀ trié croissant (évite de re-trier). */
  function percentileSorted(sorted, p) {
    if (!sorted.length) return 0;
    var idx = (p / 100) * (sorted.length - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /** Percentile (p entre 0 et 100) */
  function percentile(arr, p) {
    if (!arr.length) return 0;
    return percentileSorted(arr.slice().sort(_numAsc), p);
  }

  /** Quartiles depuis un tableau DÉJÀ trié. */
  function quartilesSorted(sorted) {
    if (!sorted.length) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    return {
      min: sorted[0],
      q1: percentileSorted(sorted, 25),
      median: percentileSorted(sorted, 50),
      q3: percentileSorted(sorted, 75),
      max: sorted[sorted.length - 1]
    };
  }

  /** Quartiles => {min, q1, median, q3, max} */
  function quartiles(arr) {
    if (!arr.length) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    // Un seul tri partagé au lieu de 4 (1 ici + 3 dans percentile).
    return quartilesSorted(arr.slice().sort(_numAsc));
  }

  /** Box plot data with outliers */
  function boxPlotData(arr) {
    // Un seul tri réutilisé pour quartiles ET le calcul des outliers (était 5 tris).
    var sorted = arr.slice().sort(_numAsc);
    var q = quartilesSorted(sorted);
    var iqr = q.q3 - q.q1;
    var lowerFence = q.q1 - 1.5 * iqr;
    var upperFence = q.q3 + 1.5 * iqr;
    var outliers = [];
    var whiskerMin = q.max;
    var whiskerMax = q.min;
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i] < lowerFence || sorted[i] > upperFence) {
        outliers.push(sorted[i]);
      } else {
        if (sorted[i] < whiskerMin) whiskerMin = sorted[i];
        if (sorted[i] > whiskerMax) whiskerMax = sorted[i];
      }
    }
    return {
      min: whiskerMin,
      q1: q.q1,
      median: q.median,
      q3: q.q3,
      max: whiskerMax,
      outliers: outliers
    };
  }

  /**
   * Compute cohorts by deposit quarter
   * Returns: { "2024-T1": { total, reachedStep6, reachedStep9, reachedStep12, summaries }, ... }
   */
  function computeCohorts(summaries, granularity) {
    var groupFn = granularity === 'semester'
      ? ANEF.utils.groupBySemester
      : granularity === 'month'
        ? ANEF.utils.groupByMonth
        : ANEF.utils.groupByQuarter;

    var groups = groupFn(summaries, 'dateDepot');
    var result = {};

    var keys = Object.keys(groups).sort();
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var items = groups[key];
      var total = items.length;
      var reached6 = 0, reached9 = 0, reached12 = 0;
      for (var i = 0; i < items.length; i++) {
        var step = items[i].currentStep;
        if (step >= 6) reached6++;
        if (step >= 9) reached9++;
        if (step >= 12) reached12++;
      }
      result[key] = {
        total: total,
        reachedStep6: reached6,
        reachedStep9: reached9,
        reachedStep12: reached12,
        pctStep6: total > 0 ? Math.round(reached6 / total * 100) : 0,
        pctStep9: total > 0 ? Math.round(reached9 / total * 100) : 0,
        pctStep12: total > 0 ? Math.round(reached12 / total * 100) : 0,
        summaries: items
      };
    }
    return result;
  }

  /**
   * Estimate remaining duration from currentStep to step 12
   * Uses transition durations: returns {p25, p50, p75, confidence, sampleSize}
   */
  function estimateRemainingDuration(currentStep, prefecture, transitionsByKey) {
    var totalP25 = 0, totalP50 = 0, totalP75 = 0;
    var minSample = Infinity;
    var totalSample = 0;
    var stepsCount = 0;

    for (var from = currentStep; from < 12; from++) {
      var to = from + 1;
      var key = from + '-' + to;
      var data = transitionsByKey[key];
      if (!data || !data.days || !data.days.length) continue;

      var days = data.days;
      // Filter by prefecture if provided
      if (prefecture && data.daysByPref && data.daysByPref[prefecture] && data.daysByPref[prefecture].length >= 3) {
        days = data.daysByPref[prefecture];
      }

      var sortedDays = days.slice().sort(_numAsc);
      totalP25 += percentileSorted(sortedDays, 25);
      totalP50 += percentileSorted(sortedDays, 50);
      totalP75 += percentileSorted(sortedDays, 75);
      if (days.length < minSample) minSample = days.length;
      totalSample += days.length;
      stepsCount++;
    }

    if (stepsCount === 0) {
      return { p25: null, p50: null, p75: null, confidence: 'none', sampleSize: 0 };
    }

    var avgSample = totalSample / stepsCount;
    var confidence = avgSample >= 10 ? 'high' : avgSample >= 5 ? 'medium' : 'low';

    return {
      p25: Math.round(totalP25),
      p50: Math.round(totalP50),
      p75: Math.round(totalP75),
      confidence: confidence,
      sampleSize: Math.round(avgSample)
    };
  }

  /**
   * Compute transition data with per-prefecture breakdown
   * Returns Map: key => { from, to, days[], daysByPref: {pref: days[]} }
   */
  function computeTransitionsDetailed(grouped) {
    var transitions = {};

    grouped.forEach(function(snaps) {
      for (var i = 1; i < snaps.length; i++) {
        var prev = snaps[i - 1];
        var curr = snaps[i];
        if (!prev.date_statut || !curr.date_statut) continue;
        var days = ANEF.utils.daysDiff(prev.date_statut, curr.date_statut);
        if (days === null || days < 0) continue;

        var key = prev.etape + '-' + curr.etape;
        if (!transitions[key]) {
          transitions[key] = {
            from_etape: prev.etape,
            to_etape: curr.etape,
            from_phase: prev.phase || ANEF.constants.PHASE_NAMES[prev.etape],
            to_phase: curr.phase || ANEF.constants.PHASE_NAMES[curr.etape],
            days: [],
            daysByPref: {}
          };
        }
        transitions[key].days.push(days);

        var pref = curr.prefecture || prev.prefecture;
        if (pref) {
          if (!transitions[key].daysByPref[pref]) transitions[key].daysByPref[pref] = [];
          transitions[key].daysByPref[pref].push(days);
        }
      }
    });

    return transitions;
  }

  /**
   * Survival curve for a specific step
   * Returns sorted array: [{days, pctRemaining}, ...]
   */
  function survivalCurve(summaries, snapshots, grouped, targetStep) {
    // Find dossiers that were at targetStep at some point
    var durations = [];
    var now = new Date(); // hoisté hors de la boucle (était re-alloué par dossier)

    grouped.forEach(function(snaps, hash) {
      var atStep = [];
      for (var i = 0; i < snaps.length; i++) {
        if (snaps[i].etape === targetStep) atStep.push(snaps[i]);
      }
      if (!atStep.length) return;

      // Find how long they stayed at this step
      var entryDate = atStep[0].date_statut;
      var exitDate = null;

      // Look for next snap with different step
      for (var j = 0; j < snaps.length; j++) {
        if (snaps[j].etape > targetStep && snaps[j].date_statut) {
          exitDate = snaps[j].date_statut;
          break;
        }
      }

      if (entryDate) {
        var d;
        if (exitDate) {
          d = ANEF.utils.daysDiff(entryDate, exitDate);
        } else {
          // Still at this step
          d = ANEF.utils.daysDiff(entryDate, now);
        }
        if (d !== null && d >= 0) {
          durations.push({ days: d, censored: !exitDate });
        }
      }
    });

    if (!durations.length) return [];

    // Simple Kaplan-Meier
    durations.sort(function(a, b) { return a.days - b.days; });

    var n = durations.length;
    var atRisk = n;
    var survival = 1.0;
    var curve = [{ days: 0, pctRemaining: 100 }];

    for (var i = 0; i < durations.length; i++) {
      if (!durations[i].censored) {
        survival *= (atRisk - 1) / atRisk;
        curve.push({
          days: durations[i].days,
          pctRemaining: Math.round(survival * 100 * 10) / 10
        });
      }
      atRisk--;
    }

    return curve;
  }

  // ─────────────────────────────────────────────────────────────
  //  Vague 2 — Prévision : branches probables + estimation décomposée
  //  Branches au niveau STATUT (CAA/CAE/controle_sdanf DISTINCTS). L'estimation
  //  décomposée, elle, replie les 3 sous-états de contrôle SDANF en un seul nœud
  //  (même phase, ères d'API différentes) pour ne pas sur-compter l'étape 9.
  // ─────────────────────────────────────────────────────────────

  /** Nœud de statut normalisé pour un snapshot : { key, phase, rang } ou null.
   *  Statut BRUT : CAA/CAE/controle_sdanf restent distincts (branches par sous-état). */
  function _statutNode(snap) {
    var raw = (snap && snap.statut ? String(snap.statut) : '').toLowerCase().trim();
    if (!raw) return null;
    var info = ANEF.constants.STATUTS[raw];
    return {
      key: raw,
      phase: info ? info.phase : (snap.phase || raw),
      rang: info ? info.rang : (Number(snap.etape) || 0) * 100
    };
  }

  /**
   * Branches probables : pour chaque statut SOURCE, les statuts CIBLE observés en
   * transition, avec part (%) et délai médian. Le « ça ou ça » de la prévision.
   * @param {Map} grouped  hash → snapshots triés par date
   * @returns {Object} { <statutSource>: { from, from_phase, from_rang, total,
   *            branches: [{to, to_phase, to_rang, count, pct, median_days, sample}] } }
   */
  function computeBranchesByStatus(grouped) {
    var out = {};
    grouped.forEach(function(snaps) {
      if (!snaps || snaps.length < 2) return;
      for (var i = 1; i < snaps.length; i++) {
        var pm = _statutNode(snaps[i - 1]);
        var cm = _statutNode(snaps[i]);
        if (!pm || !cm || pm.key === cm.key) continue;
        if (!snaps[i - 1].date_statut || !snaps[i].date_statut) continue;
        var days = ANEF.utils.daysDiff(snaps[i - 1].date_statut, snaps[i].date_statut);
        if (days === null || days < 0) continue;
        if (!out[pm.key]) out[pm.key] = { from: pm.key, from_phase: pm.phase, from_rang: pm.rang, total: 0, _t: {} };
        var o = out[pm.key];
        if (!o._t[cm.key]) o._t[cm.key] = { to: cm.key, to_phase: cm.phase, to_rang: cm.rang, days: [] };
        o._t[cm.key].days.push(days);
        o.total++;
      }
    });
    var res = {};
    Object.keys(out).forEach(function(k) {
      var o = out[k];
      var branches = Object.keys(o._t).map(function(tk) {
        var t = o._t[tk];
        return {
          to: t.to, to_phase: t.to_phase, to_rang: t.to_rang,
          count: t.days.length,
          pct: Math.round(t.days.length / o.total * 100),
          median_days: Math.round(ANEF.utils.medianCalc(t.days)),
          sample: t.days.length
        };
      }).sort(function(a, b) { return b.count - a.count; });
      res[k] = { from: o.from, from_phase: o.from_phase, from_rang: o.from_rang, total: o.total, branches: branches };
    });
    return res;
  }

  /**
   * Estimation DÉCOMPOSÉE du temps restant jusqu'au décret : somme la durée médiane
   * (p25/p50/p75) de chaque étape/statut À VENIR (rang > courant, avant le décret),
   * triée par rang. Les 3 sous-états de contrôle SDANF (controle_sdanf / _a_affecter /
   * _a_effectuer) sont repliés en un seul nœud pour ne pas sur-compter l'étape 9.
   * @param {string} currentStatut
   * @param {Array}  waitTimesArr  sortie de data.computeStepWaitTimes (par statut)
   * @returns {{chain, p25, p50, p75, sample, confidence, reachedDecret}}
   */
  function estimateToDecret(currentStatut, waitTimesArr) {
    var C = ANEF.constants;
    var DECRET_RANG = 1101; // inseree_dans_decret : au-delà = terminal
    var SDANF_CTRL = { 'controle_sdanf': 1, 'controle_a_affecter': 1, 'controle_a_effectuer': 1 };
    var code = String(currentStatut || '').toLowerCase();
    var cinfo = C.STATUTS[code];
    var currentRang = cinfo ? cinfo.rang : 0;

    // Buckets non-SDANF → nœuds ordinaires (par statut étape 9 hors contrôle, par étape
    // sinon). Les 3 sous-états de contrôle SDANF sont mis de côté (nœud unique plus bas).
    var nodes = {};
    var sdanf = {};
    (waitTimesArr || []).forEach(function(w) {
      if (!w) return;
      var raw = w.statut ? String(w.statut).toLowerCase() : null;
      if (raw && SDANF_CTRL[raw]) { sdanf[raw] = (sdanf[raw] || []).concat(w.days || []); return; }
      var key, rang, phase;
      if (w.statut) { var fi = C.STATUTS[raw]; key = 'statut:' + raw; rang = fi ? fi.rang : w.rang; phase = fi ? fi.phase : w.phase; }
      else { key = 'etape:' + w.etape; rang = w.rang; phase = w.phase; }
      if (!nodes[key]) nodes[key] = { rang: rang, phase: phase, days: [] };
      nodes[key].days = nodes[key].days.concat(w.days || []);
    });

    // Liste des nœuds prêts { rang, phase, p25, p50, p75, sample }.
    var list = [];
    Object.keys(nodes).forEach(function(k) {
      var n = nodes[k];
      if (!n.days.length) return;
      list.push({ rang: n.rang, phase: n.phase, sample: n.days.length,
        p25: Math.round(percentile(n.days, 25)), p50: Math.round(percentile(n.days, 50)), p75: Math.round(percentile(n.days, 75)) });
    });

    // Nœud SDANF UNIQUE : le code unifié controle_sdanf s'il a des données (ère post-API,
    // durée en un seul bucket) ; SINON la SOMME séquentielle des sous-états historiques
    // (à affecter PUIS à effectuer = vraie durée de la phase). Jamais les deux ensemble
    // → pas de double-compte, pas de sous-estimation.
    var sdInfo = C.STATUTS['controle_sdanf'];
    var sdRang = sdInfo ? sdInfo.rang : 900, sdPhase = sdInfo ? sdInfo.phase : 'Contrôle SDANF';
    var pc = function(arr, p) { return arr && arr.length ? percentile(arr, p) : 0; };
    var newer = sdanf['controle_sdanf'] || [];
    if (newer.length) {
      list.push({ rang: sdRang, phase: sdPhase, sample: newer.length,
        p25: Math.round(pc(newer, 25)), p50: Math.round(pc(newer, 50)), p75: Math.round(pc(newer, 75)) });
    } else {
      var caa = sdanf['controle_a_affecter'] || [], cae = sdanf['controle_a_effectuer'] || [];
      if (caa.length || cae.length) {
        list.push({ rang: sdRang, phase: sdPhase,
          sample: Math.min(caa.length || cae.length, cae.length || caa.length),
          p25: Math.round(pc(caa, 25) + pc(cae, 25)), p50: Math.round(pc(caa, 50) + pc(cae, 50)), p75: Math.round(pc(caa, 75) + pc(cae, 75)) });
      }
    }

    // Chaîne = nœuds À VENIR (rang > courant) jusqu'au décret, triés par rang.
    var chain = [];
    var sampleMin = Infinity;
    list.filter(function(n) { return n.rang > currentRang && n.rang < DECRET_RANG; })
      .sort(function(a, b) { return a.rang - b.rang; })
      .forEach(function(n) {
        chain.push({ phase: n.phase, rang: n.rang, p25: n.p25, p50: n.p50, p75: n.p75, sample: n.sample });
        if (n.sample < sampleMin) sampleMin = n.sample;
      });

    var totalP25 = 0, totalP50 = 0, totalP75 = 0;
    chain.forEach(function(c) { totalP25 += c.p25; totalP50 += c.p50; totalP75 += c.p75; });
    return {
      chain: chain,
      p25: totalP25, p50: totalP50, p75: totalP75,
      sample: sampleMin === Infinity ? 0 : sampleMin,
      confidence: sampleMin >= 10 ? 'high' : sampleMin >= 5 ? 'medium' : 'low',
      reachedDecret: currentRang >= DECRET_RANG
    };
  }

  ANEF.math = {
    percentile: percentile,
    quartiles: quartiles,
    boxPlotData: boxPlotData,
    computeCohorts: computeCohorts,
    estimateRemainingDuration: estimateRemainingDuration,
    computeTransitionsDetailed: computeTransitionsDetailed,
    survivalCurve: survivalCurve,
    computeBranchesByStatus: computeBranchesByStatus,
    estimateToDecret: estimateToDecret
  };
})();
