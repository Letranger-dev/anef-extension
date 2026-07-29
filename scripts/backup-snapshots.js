#!/usr/bin/env node
/**
 * backup-snapshots.js — Dump complet de la table dossier_snapshots.
 *
 * Contrairement à fetch-snapshots.js (qui prépare le JSON public du site et
 * omet volontairement dossier_hash), ce script exporte TOUTES les colonnes :
 * l'objectif est de pouvoir restaurer la table à l'identique.
 *
 * ⚠️ La sortie contient `dossier_hash` — donnée sensible. Le workflow qui
 * appelle ce script la chiffre AVANT de la stocker : le dépôt est public, donc
 * un artefact non chiffré serait téléchargeable par n'importe qui.
 *
 * Usage : SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backup-snapshots.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PAGE_SIZE = 1000;
const OUT_FILE = process.env.BACKUP_OUT || path.join(__dirname, '..', 'backup-snapshots.json');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

async function fetchAll() {
  var all = [];
  var offset = 0;

  while (true) {
    var url = SUPABASE_URL + '/rest/v1/dossier_snapshots?select=*&order=id.asc&limit=' + PAGE_SIZE + '&offset=' + offset;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 60000);
    var res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error('Supabase API error: ' + res.status + ' ' + (await res.text()));
    }
    var rows = await res.json();
    all = all.concat(rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

(async function main() {
  var rows = await fetchAll();

  // Garde-fou : une sauvegarde quasi vide signale un incident (RLS, clé
  // révoquée, table tronquée). Mieux vaut échouer bruyamment que remplacer
  // une bonne sauvegarde par une mauvaise.
  if (rows.length < 1000) {
    console.error('::error::Seulement ' + rows.length + ' lignes récupérées — sauvegarde suspecte, abandon');
    process.exit(1);
  }

  var dossiers = new Set(rows.map(function (r) { return r.public_id; })).size;
  var payload = {
    exported_at: new Date().toISOString(),
    table: 'dossier_snapshots',
    row_count: rows.length,
    dossier_count: dossiers,
    rows: rows
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
  var mb = (fs.statSync(OUT_FILE).size / 1048576).toFixed(1);
  console.log('Sauvegarde écrite : ' + rows.length + ' lignes / ' + dossiers + ' dossiers (' + mb + ' Mo) → ' + OUT_FILE);
})().catch(function (err) {
  console.error('::error::Sauvegarde échouée : ' + err.message);
  process.exit(1);
});
