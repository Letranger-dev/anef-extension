/**
 * shared/stats-math.js — Fonctions statistiques avancees
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  /** Percentile (p entre 0 et 100) */
  function percentile(arr, p) {
    if (!arr.length) return 0;
    var sorted = arr.slice().sort(function(a, b) { return a - b; });
    var idx = (p / 100) * (sorted.length - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /** Quartiles => {min, q1, median, q3, max} */
  function quartiles(arr) {
    if (!arr.length) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    var sorted = arr.slice().sort(function(a, b) { return a - b; });
    return {
      min: sorted[0],
      q1: percentile(arr, 25),
      median: percentile(arr, 50),
      q3: percentile(arr, 75),
      max: sorted[sorted.length - 1]
    };
  }

  /** Box plot data with outliers */
  function boxPlotData(arr) {
    var q = quartiles(arr);
    var iqr = q.q3 - q.q1;
    var lowerFence = q.q1 - 1.5 * iqr;
    var upperFence = q.q3 + 1.5 * iqr;
    var outliers = [];
    var sorted = arr.slice().sort(function(a, b) { return a - b; });
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

      totalP25 += percentile(days, 25);
      totalP50 += percentile(days, 50);
      totalP75 += percentile(days, 75);
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
          d = ANEF.utils.daysDiff(entryDate, new Date());
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

  ANEF.math = {
    percentile: percentile,
    quartiles: quartiles,
    boxPlotData: boxPlotData,
    computeCohorts: computeCohorts,
    estimateRemainingDuration: estimateRemainingDuration,
    computeTransitionsDetailed: computeTransitionsDetailed,
    survivalCurve: survivalCurve
  };
})();
