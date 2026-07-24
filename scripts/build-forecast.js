#!/usr/bin/env node
/**
 * build-forecast.js — Pré-agrège les « branches probables » par statut à partir
 * des snapshots communautaires, pour un fichier statique léger consommé par
 * l'EXTENSION (popup « prévision »).
 *
 * Entrée  : docs/data/snapshots.json (généré par fetch-snapshots.js)
 * Sortie  : docs/data/forecast.json
 *
 * Principe : pour chaque statut SOURCE, on observe vers quels statuts CIBLE les
 * dossiers ont transité (snapshots consécutifs), avec la part (%) et le délai
 * médian. C'est le « ça ou ça » de la prévision. Aucune dépendance au dictionnaire
 * de statuts : tout se déduit des transitions observées. Les libellés sont posés
 * côté extension (lib/status-parser.js).
 *
 * ⚠️ CAA (controle_a_affecter) et CAE (controle_a_effectuer) restent DISTINCTS :
 *    on ne fusionne rien ici (fidélité à l'historique).
 *
 * k-anonymat : une branche n'est publiée que si son échantillon ≥ MIN_SAMPLE.
 *
 * Usage : node scripts/build-forecast.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');
const IN_FILE = path.join(DATA_DIR, 'snapshots.json');
const OUT_FILE = path.join(DATA_DIR, 'forecast.json');

const MIN_SAMPLE = 3;   // k-anonymat par branche
const MAX_BRANCHES = 6;  // on garde les N cibles les plus fréquentes par statut

function daysBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function main() {
  if (!fs.existsSync(IN_FILE)) {
    console.error('Missing ' + IN_FILE + ' — run fetch-snapshots.js first');
    process.exit(1);
  }
  let snapshots;
  try {
    snapshots = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  } catch (e) {
    console.error('Cannot parse ' + IN_FILE + ': ' + e.message);
    process.exit(1);
  }
  console.log('Loaded ' + snapshots.length + ' snapshots');

  // Grouper par dossier (public_id) puis trier par date_statut.
  const byDossier = new Map();
  for (const s of snapshots) {
    const id = s.public_id || s.dossier_hash;
    if (!id || !s.statut || !s.date_statut) continue;
    if (!byDossier.has(id)) byDossier.set(id, []);
    byDossier.get(id).push(s);
  }

  // Agréger les transitions sortantes par statut source.
  // out[source] = { total, targets: { <cible>: days[] } }
  const out = {};
  let dossierCount = 0;
  byDossier.forEach((snaps) => {
    dossierCount++;
    snaps.sort((a, b) => String(a.date_statut).localeCompare(String(b.date_statut)));
    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1], curr = snaps[i];
      const from = String(prev.statut).toLowerCase();
      const to = String(curr.statut).toLowerCase();
      if (!from || !to || from === to) continue;
      const d = daysBetween(prev.date_statut, curr.date_statut);
      if (d === null || d < 0) continue;
      if (!out[from]) out[from] = { total: 0, targets: {} };
      if (!out[from].targets[to]) out[from].targets[to] = [];
      out[from].targets[to].push(d);
      out[from].total++;
    }
  });

  // Mise en forme + k-anonymat + top N.
  const byStatut = {};
  Object.keys(out).forEach((from) => {
    const o = out[from];
    const branches = Object.keys(o.targets)
      .map((to) => ({
        to: to,
        count: o.targets[to].length,
        pct: Math.round(o.targets[to].length / o.total * 100),
        median_days: median(o.targets[to])
      }))
      .filter((b) => b.count >= MIN_SAMPLE)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_BRANCHES);
    if (branches.length) {
      byStatut[from] = { total: o.total, branches: branches };
    }
  });

  // Bootstrap : le nouveau code unifié `controle_sdanf` (émis depuis juillet 2026)
  // n'a pas encore d'historique propre. En attendant, il hérite des branches
  // SORTANTES de CAA + CAE, en EXCLUANT les transitions internes CAA↔CAE (qui ne
  // veulent plus rien dire pour un statut unifié). Remplacé par de vraies données
  // dès que `controle_sdanf` en accumule.
  if (!byStatut['controle_sdanf']) {
    const SDANF_OLD = ['controle_a_affecter', 'controle_a_effectuer'];
    const merged = {};
    let total = 0;
    for (const src of SDANF_OLD) {
      const o = out[src];
      if (!o) continue;
      for (const to of Object.keys(o.targets)) {
        if (SDANF_OLD.indexOf(to) !== -1) continue; // exclut l'interne CAA↔CAE
        if (!merged[to]) merged[to] = [];
        merged[to] = merged[to].concat(o.targets[to]);
        total += o.targets[to].length;
      }
    }
    const branches = Object.keys(merged)
      .map((to) => ({ to: to, count: merged[to].length, pct: Math.round(merged[to].length / total * 100), median_days: median(merged[to]) }))
      .filter((b) => b.count >= MIN_SAMPLE)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_BRANCHES);
    if (branches.length) byStatut['controle_sdanf'] = { total: total, branches: branches, bootstrap: true };
  }

  const payload = {
    generated_at: new Date().toISOString().split('T')[0],
    total_dossiers: dossierCount,
    min_sample: MIN_SAMPLE,
    byStatut: byStatut
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
  const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log('Wrote ' + OUT_FILE + ' — ' + Object.keys(byStatut).length + ' statuts, ' + kb + ' KB');
}

main();
