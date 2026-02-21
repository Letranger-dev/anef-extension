/**
 * shared/data.js — Fetch, processing, cache, filtering
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  var _cfg = window.__SB_CONFIG__ || {};
  var _SB_URL = _cfg.url || '__SUPABASE_URL__';
  var _SB_KEY = _cfg.key || '__SUPABASE_ANON_KEY__';
  delete window.__SB_CONFIG__;

  var CACHE_KEY = 'anef_snapshots';
  var CACHE_TTL = 300000; // 5 min

  // Pull-to-refresh / F5 : vider le cache pour forcer un fetch frais
  try {
    var navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry && navEntry.type === 'reload') {
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch(e) { /* old browser, ignore */ }

  // bfcache (retour arrière mobile) : vider le cache à la restauration
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) sessionStorage.removeItem(CACHE_KEY);
  });

  // Retour depuis arrière-plan mobile : recharger si données périmées
  var _lastVisible = Date.now();
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      if (Date.now() - _lastVisible > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        location.reload();
      }
      _lastVisible = Date.now();
    }
  });

  /** Fetch all snapshots from Supabase REST API (with pagination) */
  async function fetchAllSnapshots() {
    var PAGE_SIZE = 1000;
    var all = [];
    var offset = 0;

    while (true) {
      var url = _SB_URL + '/rest/v1/dossier_snapshots?select=*&order=created_at.desc&limit=' + PAGE_SIZE + '&offset=' + offset;
      var res = await fetch(url, {
        headers: {
          'apikey': _SB_KEY,
          'Authorization': 'Bearer ' + _SB_KEY,
          'Prefer': 'count=exact'
        }
      });
      if (!res.ok) throw new Error('Erreur API: ' + res.status);
      var rows = await res.json();
      all = all.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return all;
  }

  /** Load data with sessionStorage cache (5 min TTL) */
  async function loadData() {
    try {
      var cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data;
      }
    } catch(e) { /* ignore cache errors */ }

    var data = await fetchAllSnapshots();
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, ts: Date.now() }));
    } catch(e) { /* storage full, ignore */ }
    return data;
  }

  /** Normalize prefecture name: accents, hyphens, casse */
  var PREF_FIXES = {
    'Meurthe Et Moselle': 'Meurthe-et-Moselle',
    'Seine Saint Denis': 'Seine-Saint-Denis',
    'Bas Rhin': 'Bas-Rhin',
    'Haut Rhin': 'Haut-Rhin',
    "Cote D'Or": "Côte-d'Or",
    'Deux Sevres': 'Deux-Sèvres',
    'Pas De Calais': 'Pas-de-Calais',
    'Ille Et Vilaine': 'Ille-et-Vilaine',
    'Indre Et Loire': 'Indre-et-Loire',
    'Loir Et Cher': 'Loir-et-Cher',
    'Lot Et Garonne': 'Lot-et-Garonne',
    'Maine Et Loire': 'Maine-et-Loire',
    'Saone Et Loire': 'Saône-et-Loire',
    'Seine Et Marne': 'Seine-et-Marne',
    'Tarn Et Garonne': 'Tarn-et-Garonne',
    'Val De Marne': 'Val-de-Marne',
    "Val D'Oise": "Val-d'Oise",
    'Cotes D Armor': "Côtes-d'Armor",
    "Cotes D'Armor": "Côtes-d'Armor",
    'Bouches Du Rhone': 'Bouches-du-Rhône',
    'Territoire De Belfort': 'Territoire de Belfort',
    'Alpes De Haute Provence': 'Alpes-de-Haute-Provence',
    'Hautes Alpes': 'Hautes-Alpes',
    'Alpes Maritimes': 'Alpes-Maritimes',
    'Pyrenees Atlantiques': 'Pyrénées-Atlantiques',
    'Hautes Pyrenees': 'Hautes-Pyrénées',
    'Pyrenees Orientales': 'Pyrénées-Orientales',
    'Haute Garonne': 'Haute-Garonne',
    'Haute Loire': 'Haute-Loire',
    'Haute Marne': 'Haute-Marne',
    'Haute Saone': 'Haute-Saône',
    'Haute Savoie': 'Haute-Savoie',
    'Haute Vienne': 'Haute-Vienne',
    'Hauts De Seine': 'Hauts-de-Seine',
    'Puy De Dome': 'Puy-de-Dôme',
    'Seine Maritime': 'Seine-Maritime',
    'Charente Maritime': 'Charente-Maritime'
  };

  function normalizePrefecture(name) {
    if (!name) return name;
    // Remove "Prefecture de/du/de la/des " prefix
    var cleaned = name.replace(/^Pr[eé]fecture\s+(de\s+l'|de\s+la\s+|du\s+|des\s+|de\s+|d')/i, '');
    // Exact match lookup
    if (PREF_FIXES[cleaned]) return PREF_FIXES[cleaned];
    return cleaned;
  }

  /** Group snapshots by dossier_hash => Map<hash, snapshot[]> */
  function groupByDossier(snapshots) {
    var map = new Map();
    for (var i = 0; i < snapshots.length; i++) {
      var s = snapshots[i];
      if (!map.has(s.dossier_hash)) map.set(s.dossier_hash, []);
      map.get(s.dossier_hash).push(s);
    }
    map.forEach(function(snaps) {
      snaps.sort(function(a, b) {
        var dateA = a.created_at || '';
        var dateB = b.created_at || '';
        return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
      });
    });
    return map;
  }

  /** Compute dossier summaries from grouped data */
  function computeDossierSummaries(grouped) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var summaries = [];
    var PHASE_NAMES = ANEF.constants.PHASE_NAMES;

    grouped.forEach(function(snaps, hash) {
      var latest = snaps[snaps.length - 1];
      var daysAtStatus = latest.date_statut ? ANEF.utils.daysDiff(latest.date_statut, today) : null;
      var daysSinceDeposit = latest.date_depot ? ANEF.utils.daysDiff(latest.date_depot, today) : null;

      var stepSet = {};
      for (var i = 0; i < snaps.length; i++) stepSet[snaps[i].etape] = true;
      var stepsTraversed = Object.keys(stepSet).map(Number).sort(function(a, b) { return a - b; });

      var dateEntretien = latest.date_entretien;
      var prefecture = latest.prefecture;
      var hasComplement = false;
      var numeroDecret = latest.numero_decret;
      var lieuEntretien = latest.lieu_entretien;
      var domicileCP = latest.domicile_code_postal;
      var lastChecked = latest.created_at || null;

      for (var j = 0; j < snaps.length; j++) {
        if (!dateEntretien && snaps[j].date_entretien) dateEntretien = snaps[j].date_entretien;
        if (!prefecture && snaps[j].prefecture) prefecture = snaps[j].prefecture;
        if (snaps[j].has_complement) hasComplement = true;
        if (!numeroDecret && snaps[j].numero_decret) numeroDecret = snaps[j].numero_decret;
        if (!lieuEntretien && snaps[j].lieu_entretien) lieuEntretien = snaps[j].lieu_entretien;
        if (!domicileCP && snaps[j].domicile_code_postal) domicileCP = snaps[j].domicile_code_postal;
        if (snaps[j].created_at && (!lastChecked || snaps[j].created_at > lastChecked)) {
          lastChecked = snaps[j].created_at;
        }
      }

      // Fallback : lieu_entretien > code postal domicile
      if (!prefecture && lieuEntretien) {
        prefecture = lieuEntretien;
      }
      if (!prefecture && domicileCP) {
        prefecture = ANEF.constants.getDepartementFromCP(domicileCP);
      }
      prefecture = normalizePrefecture(prefecture);

      var statutKey = latest.statut ? latest.statut.toLowerCase() : '';
      var statutInfo = ANEF.constants.STATUTS[statutKey];
      var rang = statutInfo ? statutInfo.rang : (latest.etape * 100);
      var sousEtape = ANEF.constants.formatSubStep(rang);
      var explication = statutInfo ? statutInfo.explication : (latest.phase || PHASE_NAMES[latest.etape] || 'Inconnu');

      // Previous statut (only if it actually differs from current)
      var previousStatut = null;
      var previousDateStatut = null;
      if (snaps.length > 1) {
        var prev = snaps[snaps.length - 2];
        var prevStatutNorm = (prev.statut || '').toLowerCase();
        var curStatutNorm = (latest.statut || '').toLowerCase();
        if (prevStatutNorm && prevStatutNorm !== curStatutNorm) {
          previousStatut = prev.statut || null;
          previousDateStatut = prev.date_statut || null;
        }
      }

      summaries.push({
        hash: hash.substring(0, 6),
        fullHash: hash,
        currentStep: latest.etape,
        currentPhase: latest.phase || PHASE_NAMES[latest.etape] || 'Inconnu',
        statut: latest.statut,
        rang: rang,
        sousEtape: sousEtape,
        explication: explication,
        daysAtCurrentStatus: daysAtStatus,
        daysSinceDeposit: daysSinceDeposit,
        stepsTraversed: stepsTraversed,
        dateEntretien: dateEntretien,
        prefecture: prefecture,
        dateDepot: latest.date_depot,
        dateStatut: latest.date_statut,
        snapshotCount: snaps.length,
        hasComplement: hasComplement,
        numeroDecret: numeroDecret,
        lieuEntretien: lieuEntretien,
        lastChecked: lastChecked,
        previousStatut: previousStatut,
        previousDateStatut: previousDateStatut
      });
    });

    summaries.sort(function(a, b) {
      return b.rang - a.rang || (b.daysSinceDeposit || 0) - (a.daysSinceDeposit || 0);
    });

    return summaries;
  }

  /** Phase distribution from summaries */
  function computePhaseDistribution(summaries) {
    var dist = {};
    for (var i = 0; i < summaries.length; i++) {
      var s = summaries[i];
      var key = s.currentStep;
      if (!dist[key]) dist[key] = { etape: s.currentStep, phase: s.currentPhase, count: 0, statuts: {} };
      dist[key].count++;
      if (s.statut) dist[key].statuts[s.statut] = (dist[key].statuts[s.statut] || 0) + 1;
    }
    return Object.values(dist).sort(function(a, b) { return a.etape - b.etape; });
  }

  /** Duration by step computed from snapshots */
  function computeDurationByStep(snapshots) {
    var byStep = {};
    var PHASE_NAMES = ANEF.constants.PHASE_NAMES;
    for (var i = 0; i < snapshots.length; i++) {
      var s = snapshots[i];
      if (!s.date_depot || !s.date_statut) continue;
      var days = ANEF.utils.daysDiff(s.date_depot, s.date_statut);
      if (days === null || days < 0) continue;
      if (!byStep[s.etape]) byStep[s.etape] = { phase: s.phase || PHASE_NAMES[s.etape], days: [], statuts: {} };
      byStep[s.etape].days.push(days);
      if (s.statut) byStep[s.etape].statuts[s.statut] = (byStep[s.etape].statuts[s.statut] || 0) + 1;
    }
    return Object.keys(byStep).map(function(etape) {
      var data = byStep[etape];
      var sum = 0;
      for (var j = 0; j < data.days.length; j++) sum += data.days[j];
      return {
        etape: parseInt(etape),
        phase: data.phase,
        avg_days: ANEF.utils.round1(sum / data.days.length),
        median_days: ANEF.utils.round1(ANEF.utils.medianCalc(data.days)),
        count: data.days.length,
        days: data.days,
        statuts: data.statuts
      };
    }).sort(function(a, b) { return a.etape - b.etape; });
  }

  /** Duration by status — like computeDurationByStep but splits step 9 into 4 sub-statuts */
  var STEP9_STATUTS = ['controle_a_affecter', 'controle_a_effectuer', 'controle_en_attente_pec', 'controle_pec_a_faire'];

  function computeDurationByStatus(snapshots) {
    var STATUTS = ANEF.constants.STATUTS;
    var PHASE_NAMES = ANEF.constants.PHASE_NAMES;
    var buckets = {};

    for (var i = 0; i < snapshots.length; i++) {
      var s = snapshots[i];
      if (!s.date_depot || !s.date_statut) continue;
      var days = ANEF.utils.daysDiff(s.date_depot, s.date_statut);
      if (days === null || days < 0) continue;

      var key, rang, phase;
      var statutLower = s.statut ? s.statut.toLowerCase() : '';
      if (Number(s.etape) === 9 && statutLower && STEP9_STATUTS.indexOf(statutLower) !== -1) {
        // Split step 9 by statut
        key = 'statut:' + statutLower;
        var info = STATUTS[statutLower];
        rang = info ? info.rang : (s.etape * 100);
        phase = info ? info.phase : PHASE_NAMES[s.etape];
      } else {
        // Group by etape
        key = 'etape:' + s.etape;
        rang = s.etape * 100;
        phase = s.phase || PHASE_NAMES[s.etape];
      }

      if (!buckets[key]) buckets[key] = { etape: Number(s.etape), phase: phase, statut: null, rang: rang, days: [] };
      buckets[key].days.push(days);
      // Store statut for step 9 sub-entries
      if (Number(s.etape) === 9 && statutLower && STEP9_STATUTS.indexOf(statutLower) !== -1) {
        buckets[key].statut = statutLower;
      }
    }

    return Object.keys(buckets).map(function(key) {
      var b = buckets[key];
      var sum = 0;
      for (var j = 0; j < b.days.length; j++) sum += b.days[j];
      return {
        etape: b.etape,
        phase: b.phase,
        statut: b.statut,
        rang: b.rang,
        avg_days: ANEF.utils.round1(sum / b.days.length),
        median_days: ANEF.utils.round1(ANEF.utils.medianCalc(b.days)),
        count: b.days.length,
        days: b.days
      };
    }).sort(function(a, b) { return a.rang - b.rang; });
  }

  /** Prefecture stats from summaries */
  function computePrefectureStats(summaries) {
    var byPref = {};
    var isPositive = ANEF.constants.isPositiveStatus;
    var isNegative = ANEF.constants.isNegativeStatus;

    for (var i = 0; i < summaries.length; i++) {
      var s = summaries[i];
      if (!s.prefecture) continue;
      if (!byPref[s.prefecture]) {
        byPref[s.prefecture] = { dossiers: 0, days: [], steps: [], complement: 0, favorable: 0, defavorable: 0 };
      }
      var p = byPref[s.prefecture];
      p.dossiers++;
      if (s.daysSinceDeposit != null) p.days.push(s.daysSinceDeposit);
      p.steps.push(s.currentStep);
      if (s.hasComplement) p.complement++;
      if (isPositive(s.statut)) p.favorable++;
      if (isNegative(s.statut)) p.defavorable++;
    }

    return Object.keys(byPref).map(function(pref) {
      var data = byPref[pref];
      var avgDays = null;
      var medDays = null;
      if (data.days.length > 0) {
        var sum = 0;
        for (var j = 0; j < data.days.length; j++) sum += data.days[j];
        avgDays = ANEF.utils.round1(sum / data.days.length);
        medDays = ANEF.utils.round1(ANEF.utils.medianCalc(data.days));
      }
      var stepSum = 0;
      for (var k = 0; k < data.steps.length; k++) stepSum += data.steps[k];
      return {
        prefecture: pref,
        total: data.dossiers,
        avg_days: avgDays,
        median_days: medDays,
        avg_step: ANEF.utils.round1(stepSum / data.steps.length),
        complement: data.complement,
        complement_pct: ANEF.utils.round1(data.complement / data.dossiers * 100),
        favorable: data.favorable,
        favorable_pct: data.dossiers > 0 ? ANEF.utils.round1(data.favorable / data.dossiers * 100) : 0,
        defavorable: data.defavorable,
        days: data.days,
        steps: data.steps
      };
    }).sort(function(a, b) { return b.total - a.total; });
  }

  /** Compute transitions from grouped data */
  function computeTransitions(grouped) {
    var transitions = {};
    var PHASE_NAMES = ANEF.constants.PHASE_NAMES;

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
            from_phase: prev.phase || PHASE_NAMES[prev.etape],
            to_phase: curr.phase || PHASE_NAMES[curr.etape],
            days: []
          };
        }
        transitions[key].days.push(days);
      }
    });

    return Object.values(transitions).map(function(t) {
      var sum = 0;
      for (var j = 0; j < t.days.length; j++) sum += t.days[j];
      return {
        from_etape: t.from_etape,
        to_etape: t.to_etape,
        from_phase: t.from_phase,
        to_phase: t.to_phase,
        avg_days: ANEF.utils.round1(sum / t.days.length),
        median_days: ANEF.utils.round1(ANEF.utils.medianCalc(t.days)),
        min_days: Math.min.apply(null, t.days),
        max_days: Math.max.apply(null, t.days),
        count: t.days.length,
        days: t.days
      };
    }).sort(function(a, b) { return a.from_etape - b.from_etape || a.to_etape - b.to_etape; });
  }

  /** Apply filters to summaries */
  function applyFilters(summaries, filters) {
    return summaries.filter(function(s) {
      // Statut filter (exact status code — case-insensitive)
      if (filters.statut && filters.statut !== 'all') {
        var sStatut = s.statut ? s.statut.toLowerCase() : '';
        if (sStatut !== filters.statut.toLowerCase()) return false;
      }
      // Step filter (legacy, for URL compat)
      else if (filters.step && filters.step !== 'all') {
        var range = ANEF.constants.STEP_RANGES[filters.step];
        if (range && range.indexOf(s.currentStep) === -1) return false;
      }
      // Prefecture filter (string or array)
      if (filters.prefecture && filters.prefecture !== 'all') {
        if (Array.isArray(filters.prefecture)) {
          if (filters.prefecture.indexOf(s.prefecture) === -1) return false;
        } else {
          if (s.prefecture !== filters.prefecture) return false;
        }
      }
      // Outcome filter
      if (filters.outcome && filters.outcome !== 'all') {
        var isPos = ANEF.constants.isPositiveStatus(s.statut);
        var isNeg = ANEF.constants.isNegativeStatus(s.statut);
        if (filters.outcome === 'favorable' && !isPos) return false;
        if (filters.outcome === 'defavorable' && !isNeg) return false;
        if (filters.outcome === 'en_cours' && (isPos || isNeg)) return false;
      }
      // Complement filter
      if (filters.complement && filters.complement !== 'all') {
        if (filters.complement === 'with' && !s.hasComplement) return false;
        if (filters.complement === 'without' && s.hasComplement) return false;
      }
      // Search by hash
      if (filters.search) {
        var q = filters.search.toLowerCase();
        if (s.hash.toLowerCase().indexOf(q) === -1 && s.fullHash.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /** Get snapshots for a set of hashes */
  function getSnapshotsForHashes(snapshots, hashes) {
    var set = new Set(hashes);
    return snapshots.filter(function(s) { return set.has(s.dossier_hash); });
  }

  /** Get unique prefectures from summaries */
  function getUniquePrefectures(summaries) {
    var set = {};
    for (var i = 0; i < summaries.length; i++) {
      if (summaries[i].prefecture) set[summaries[i].prefecture] = true;
    }
    return Object.keys(set).sort();
  }

  ANEF.data = {
    loadData: loadData,
    groupByDossier: groupByDossier,
    computeDossierSummaries: computeDossierSummaries,
    computePhaseDistribution: computePhaseDistribution,
    computeDurationByStep: computeDurationByStep,
    computeDurationByStatus: computeDurationByStatus,
    STEP9_STATUTS: STEP9_STATUTS,
    computePrefectureStats: computePrefectureStats,
    computeTransitions: computeTransitions,
    applyFilters: applyFilters,
    getSnapshotsForHashes: getSnapshotsForHashes,
    getUniquePrefectures: getUniquePrefectures,
    normalizePrefecture: normalizePrefecture
  };
})();
