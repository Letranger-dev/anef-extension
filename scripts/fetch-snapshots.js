#!/usr/bin/env node
/**
 * fetch-snapshots.js — Fetches dossier_snapshots from Supabase REST API
 * and writes a static JSON file for the stats site.
 *
 * Only fetches columns used by the site (drops id, extension_version, type_demande).
 *
 * Used by GitHub Actions (refresh-data.yml + deploy-stats.yml) to generate
 * docs/data/snapshots.json so the site loads from GitHub Pages (0 Supabase egress).
 *
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/fetch-snapshots.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const PAGE_SIZE = 1000;
const OUT_DIR = path.join(__dirname, '..', 'docs', 'data');
const OUT_FILE = path.join(OUT_DIR, 'snapshots.json');

// Only columns the site actually uses (data.js processing functions).
// IMPORTANT : on expose public_id (HMAC serveur) mais PAS dossier_hash
// (SHA-256 réversible par rainbow table sur les numéros de dossier).
const COLUMNS = [
  'public_id', 'statut', 'etape', 'phase',
  'date_depot', 'date_statut', 'date_entretien',
  'prefecture', 'domicile_code_postal', 'lieu_entretien',
  'numero_decret', 'has_complement', 'source',
  'created_at', 'checked_at'
].join(',');

const STALE_HOURS = 6;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

async function fetchAllSnapshots() {
  var all = [];
  var offset = 0;

  while (true) {
    var url = SUPABASE_URL + '/rest/v1/dossier_snapshots?select=' + COLUMNS + '&order=created_at.desc&limit=' + PAGE_SIZE + '&offset=' + offset;
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 30000);
    var res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error('Supabase API error: ' + res.status + ' ' + (await res.text()));
    }
    var rows = await res.json();
    all = all.concat(rows);
    console.log('  Fetched ' + rows.length + ' rows (offset ' + offset + ')');
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

function checkFreshness(data) {
  if (data.length === 0) {
    console.warn('::warning::No snapshots returned from Supabase');
    return;
  }
  var newest = data[0].created_at || data[0].checked_at;
  if (!newest) return;
  var ageHours = (Date.now() - new Date(newest).getTime()) / 3600000;
  console.log('Newest snapshot: ' + newest + ' (' + Math.round(ageHours) + 'h ago)');
  if (ageHours > STALE_HOURS) {
    console.warn('::warning::Data may be stale — newest snapshot is ' + Math.round(ageHours) + 'h old');
  }
}

(async () => {
  try {
    console.log('Fetching snapshots from Supabase...');
    var data = await fetchAllSnapshots();
    console.log('Total: ' + data.length + ' snapshots');

    checkFreshness(data);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(data));

    var sizeKB = Math.round(fs.statSync(OUT_FILE).size / 1024);
    console.log('Written to ' + OUT_FILE + ' (' + sizeKB + ' KB)');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
