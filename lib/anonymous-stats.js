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

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants.js';
import { getStatusExplanation } from './status-parser.js';
import * as storage from './storage.js';

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
    statut: dossierData.statut,
    etape: statusInfo.etape,
    phase: statusInfo.phase,
    date_depot: truncateToDay(apiData?.dateDepot),
    date_statut: truncateToDay(dossierData.date_statut),
    date_entretien: truncateToDay(apiData?.dateEntretien),
    prefecture: apiData?.prefecture || null,
    type_demande: apiData?.typeDemande || null,
    has_complement: !!(apiData?.complementInstruction),
    numero_decret: apiData?.numeroDecret || null,
    lieu_entretien: apiData?.lieuEntretien || null,
    extension_version: version
  };
}

// ─────────────────────────────────────────────────────────────
// Envoi vers Supabase
// ─────────────────────────────────────────────────────────────

/**
 * Envoie le payload vers Supabase via REST API (UPSERT).
 * Utilise le header Prefer: resolution=merge-duplicates pour
 * mettre à jour si le couple (dossier_hash, statut) existe déjà.
 */
async function sendToSupabase(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dossier_snapshots?on_conflict=dossier_hash,statut`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${response.statusText}`);
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
    // Vérifier que l'utilisateur n'a pas désactivé
    const settings = await storage.getSettings();
    if (!settings.anonymousStatsEnabled) return;

    // Vérifier que la config Supabase est renseignée
    if (!SUPABASE_URL || SUPABASE_URL.includes('<PROJECT_ID>')) return;

    const payload = await buildAnonymousPayload(dossierData, apiData);
    if (!payload) return;

    await sendToSupabase(payload);
    console.info('[Stats] Données anonymes envoyées');
  } catch (error) {
    // Silencieux : ne jamais impacter l'expérience utilisateur
    console.warn('[Stats] Erreur envoi anonyme:', error.message);
  }
}
