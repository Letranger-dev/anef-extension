/**
 * Statistiques anonymes communautaires - Extension ANEF Status Tracker
 *
 * Envoie des données anonymisées vers Supabase pour alimenter
 * les statistiques publiques sur les délais de naturalisation.
 *
 * Principes :
 * - Hash SHA-256 du numéro de dossier (irréversible)
 * - Dates tronquées au jour (pas d'heure)
 * - Aucune donnée personnelle (nom, email, etc.)
 * - Opt-out possible dans les paramètres
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_FUNCTION_URL, SUPABASE_EDGE_KEY } from './constants.js';
import { getStatusExplanation } from './status-parser.js';
import * as storage from './storage.js';

// ─────────────────────────────────────────────────────────────
// Dev local : charge config.local.json si les placeholders sont actifs
// ─────────────────────────────────────────────────────────────

let _sbUrl = SUPABASE_URL;
let _sbKey = SUPABASE_ANON_KEY;
let _sbFnUrl = SUPABASE_FUNCTION_URL;
let _sbEdgeKey = SUPABASE_EDGE_KEY;
let _configLoaded = false;

async function loadLocalConfig() {
  if (_configLoaded) return;
  _configLoaded = true;
  if (_sbUrl && !_sbUrl.startsWith('__')) return; // déjà injecté (build CI)
  try {
    const r = await fetch(chrome.runtime.getURL('config.local.json'));
    if (!r.ok) return;
    const cfg = await r.json();
    _sbUrl = cfg.SUPABASE_URL || _sbUrl;
    _sbKey = cfg.SUPABASE_ANON_KEY || _sbKey;
    _sbFnUrl = cfg.SUPABASE_FUNCTION_URL || _sbFnUrl;
    _sbEdgeKey = cfg.SUPABASE_EDGE_KEY || _sbEdgeKey;
  } catch { /* pas de config locale, mode production */ }
}

// ─────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────

/** Hash SHA-256 via Web Crypto API → chaîne hex 64 caractères */
async function sha256(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(value));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Tronque une date ISO au jour (YYYY-MM-DD) */
function truncateToDay(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Construction du payload
// ─────────────────────────────────────────────────────────────

/**
 * Construit le payload anonyme à envoyer à Supabase.
 * @param {Object} dossierData - Données du dossier (statut, date_statut, etc.)
 * @param {Object} apiData - Données API détaillées (dates, préfecture, etc.)
 * @returns {Object|null} Payload anonymisé ou null si données insuffisantes
 */
async function buildAnonymousPayload(dossierData, apiData) {
  if (!dossierData?.statut) return null;

  // Il faut un identifiant de dossier pour le hash
  const dossierId = apiData?.dossierId || apiData?.numeroNational;
  if (!dossierId) return null;

  const statusInfo = getStatusExplanation(dossierData.statut);
  const version = chrome.runtime.getManifest().version;

  return {
    dossier_hash: await sha256(dossierId),
    statut: dossierData.statut.toLowerCase(),
    etape: statusInfo.etape,
    phase: statusInfo.phase,
    date_depot: truncateToDay(apiData?.dateDepot),
    date_statut: truncateToDay(dossierData.date_statut),
    date_entretien: truncateToDay(apiData?.dateEntretien),
    prefecture: apiData?.prefecture || null,
    domicile_code_postal: apiData?.domicileCodePostal || null,
    domicile_ville: apiData?.domicileVille || null,
    type_demande: apiData?.typeDemande || null,
    has_complement: !!(apiData?.complementInstruction),
    numero_decret: apiData?.numeroDecret || null,
    lieu_entretien: apiData?.lieuEntretien || null,
    extension_version: version,
    source: 'auto',
    checked_at: new Date().toISOString()
  };
}

// ─────────────────────────────────────────────────────────────
// Envoi vers Supabase
// ─────────────────────────────────────────────────────────────

/**
 * Envoie le payload vers l'Edge Function submit-snapshot.
 * La fonction valide et écrit dans Supabase avec service_role.
 */
async function sendToSupabase(payload) {
  const response = await fetch(_sbFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_sbKey}`,
      'X-Extension-Key': _sbEdgeKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Edge Function ${response.status}: ${body.error || response.statusText}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Export principal
// ─────────────────────────────────────────────────────────────

/**
 * Envoie les statistiques anonymes si l'option est activée.
 * Fire-and-forget : ne bloque jamais le flux principal.
 *
 * @param {Object} dossierData - Données du dossier
 * @param {Object} apiData - Données API détaillées
 */
export async function sendAnonymousStats(dossierData, apiData) {
  try {
    // Vérifier que la config Supabase est renseignée
    await loadLocalConfig();
    if (!_sbUrl || _sbUrl.startsWith('__')) return;

    // Respecter le choix de l'utilisateur
    const settings = await storage.getSettings();
    if (!settings.anonymousStatsEnabled) return;

    const payload = await buildAnonymousPayload(dossierData, apiData);
    if (!payload) return;

    // Si ce statut a été rectifié manuellement, garder la date manuelle
    const stepDates = await storage.getStepDates();
    const manualEntry = stepDates.find(sd =>
      (sd.statut || '').toLowerCase() === (dossierData.statut || '').toLowerCase()
    );
    if (manualEntry) {
      payload.date_statut = truncateToDay(manualEntry.date_statut);
      payload.source = 'manual';
    }

    // Vérifier si une entrée existe déjà avec une date plus ancienne
    try {
      const existing = await fetchExistingSnapshot(payload.dossier_hash, payload.statut);
      if (existing?.date_statut && payload.date_statut) {
        if (existing.date_statut < payload.date_statut) {
          // Garder la date la plus ancienne
          payload.date_statut = existing.date_statut;
          // Garder la source existante si manuelle
          if (existing.source === 'manual') payload.source = 'manual';
        }
      }
    } catch { /* continue avec le payload tel quel */ }

    await sendToSupabase(payload);
    console.info('[Stats] Données anonymes envoyées');
  } catch (error) {
    // Silencieux : ne jamais impacter l'expérience utilisateur
    console.warn('[Stats] Erreur envoi anonyme:', error.message);
  }
}

/** Récupère un snapshot existant par hash + statut */
async function fetchExistingSnapshot(hash, statut) {
  const response = await fetch(
    `${_sbUrl}/rest/v1/dossier_snapshots?dossier_hash=eq.${hash}&statut=eq.${statut}&select=date_statut,source&limit=1`,
    {
      headers: {
        'apikey': _sbKey,
        'Authorization': `Bearer ${_sbKey}`
      }
    }
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return rows.length ? rows[0] : null;
}

/**
 * Envoie les dates manuelles des étapes vers Supabase (batch UPSERT).
 * @param {Array} stepDates - Array of { statut, date_statut }
 * @param {Object} apiData - Données API détaillées
 */
export async function sendManualStepDates(stepDates, apiData) {
  try {
    await loadLocalConfig();
    if (!_sbUrl || _sbUrl.startsWith('__')) return;
    if (!stepDates?.length || !apiData) return;

    const dossierId = apiData.dossierId || apiData.numeroNational;
    if (!dossierId) return;

    const hash = await sha256(dossierId);
    const version = chrome.runtime.getManifest().version;

    const payloads = stepDates.map(entry => {
      const statusInfo = getStatusExplanation(entry.statut);
      return {
        dossier_hash: hash,
        statut: entry.statut.toLowerCase(),
        etape: statusInfo.etape,
        phase: statusInfo.phase,
        date_depot: truncateToDay(apiData.dateDepot),
        date_statut: truncateToDay(entry.date_statut),
        date_entretien: truncateToDay(apiData.dateEntretien),
        prefecture: apiData.prefecture || null,
        domicile_code_postal: apiData.domicileCodePostal || null,
        domicile_ville: apiData.domicileVille || null,
        type_demande: apiData.typeDemande || null,
        has_complement: !!(apiData.complementInstruction),
        numero_decret: apiData.numeroDecret || null,
        lieu_entretien: apiData.lieuEntretien || null,
        extension_version: version,
        source: 'manual',
        checked_at: new Date().toISOString()
      };
    });

    for (const p of payloads) {
      await sendToSupabase(p);
    }
    console.info('[Stats] Dates manuelles envoyées:', payloads.length);
  } catch (error) {
    console.warn('[Stats] Erreur envoi dates manuelles:', error.message);
  }
}

/**
 * Récupère tous les snapshots d'un dossier depuis Supabase.
 * @param {Object} apiData - Données API (pour le dossierId)
 * @returns {Array} Snapshots du dossier
 */
export async function fetchDossierSnapshots(apiData) {
  await loadLocalConfig();
  if (!_sbUrl || _sbUrl.startsWith('__')) return [];

  const dossierId = apiData?.dossierId || apiData?.numeroNational;
  if (!dossierId) return [];

  const hash = await sha256(dossierId);

  const response = await fetch(
    `${_sbUrl}/rest/v1/dossier_snapshots?dossier_hash=eq.${hash}&order=etape.asc`,
    {
      headers: {
        'apikey': _sbKey,
        'Authorization': `Bearer ${_sbKey}`
      }
    }
  );

  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return await response.json();
}
