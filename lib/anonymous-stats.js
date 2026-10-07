/**
 * Statistiques anonymes communautaires - Extension ANEF Status Tracker
 *
 * Envoie des données anonymisées vers Supabase pour alimenter
 * les statistiques publiques sur les délais de naturalisation.
 *
 * Principes :
 * - Opt-in strict : aucun envoi tant que l'utilisateur n'a pas explicitement
 *   accepté (storage.hasStatsConsent). Le consentement est retirable à tout
 *   moment depuis les paramètres, avec effet immédiat.
 * - Hash SHA-256 du numéro de dossier (irréversible)
 * - Dates tronquées au jour (pas d'heure)
 * - Aucune donnée personnelle (nom, email, etc.)
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_FUNCTION_URL, SUPABASE_EDGE_KEY } from './constants.js';
import { getStatusExplanation } from './status-parser.js';
import { isComplementPending } from './anef-mapper.js';
import * as storage from './storage.js';

// ─────────────────────────────────────────────────────────────
// Dev local : charge config.local.json si les placeholders sont actifs
// ─────────────────────────────────────────────────────────────

let _sbUrl = SUPABASE_URL;
let _sbKey = SUPABASE_ANON_KEY;
let _sbFnUrl = SUPABASE_FUNCTION_URL;
let _sbEdgeKey = SUPABASE_EDGE_KEY;
// On mémorise la PROMESSE, pas un booléen : poser un drapeau avant le `await`
// faisait retourner un second appelant concurrent alors que `_sbUrl` contenait
// encore le placeholder — il aurait conclu « extension non configurée » sur une
// installation parfaitement saine.
let _configPromise = null;

function loadLocalConfig() {
  if (!_configPromise) _configPromise = _chargerConfigLocale();
  return _configPromise;
}

async function _chargerConfigLocale() {
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

/**
 * Les clés serveur sont-elles réellement présentes ?
 *
 * Le dépôt public ne contient que des placeholders (`__SUPABASE_URL__`) : les
 * vraies valeurs sont injectées à la construction des versions publiées. Une
 * extension chargée à la main depuis un clone du dépôt actualise donc
 * normalement le dossier EN LOCAL, mais `sendAnonymousStats` sort avant tout
 * envoi — sans le moindre message. Vu de l'utilisateur, la date « Vérifié le »
 * du site reste figée quel que soit le nombre d'actualisations.
 *
 * @returns {Promise<boolean>} faux si l'extension tourne avec des placeholders
 */
export async function isStatsConfigured() {
  await loadLocalConfig();
  return !!_sbUrl && !_sbUrl.startsWith('__');
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
    // Une demande de complément réellement notifiée, pas le champ brut
    // `demande_complement` (truthy sur 76 % des dossiers — cf. isComplementPending).
    has_complement: isComplementPending(apiData?.timeline),
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

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Edge Function ${response.status}: ${body.error || response.statusText}`);
  }
  return body; // { success, count, history? } — history présent si Edge Function v2+
}

// ─────────────────────────────────────────────────────────────
// Export principal
// ─────────────────────────────────────────────────────────────

/**
 * Envoie les statistiques anonymes si l'utilisateur y a consenti.
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

    // Opt-in : rien ne part sans consentement explicite et en cours de validité
    const settings = await storage.getSettings();
    if (!storage.hasStatsConsent(settings)) return;

    const payload = await buildAnonymousPayload(dossierData, apiData);
    if (!payload) return;

    // Si ce statut a été rectifié manuellement, garder la date manuelle
    const stepDates = await storage.getStepDates();
    const manualEntry = stepDates.find(sd =>
      (sd.statut || '').toLowerCase() === (dossierData.statut || '').toLowerCase()
    );
    if (manualEntry) {
      payload.date_statut = truncateToDay(manualEntry.date_statut);
      // `source: 'manual'` exempte l'instantané du garde anti-régression côté
      // serveur — c'est voulu pour les comblements de trous saisis à la main.
      // Mais le statut courant peut venir d'un tour dégradé : si l'utilisateur
      // avait un jour daté cette étape à la main, le repli grossier repartait
      // estampillé « manual » et traversait le garde sans contrôle. Trois codes
      // sont concernés (`dossier_depose`, `ea_en_attente_ea`,
      // `controle_transmise_pour_decret` — les seuls à la fois saisissables et
      // produits par un repli). On ne promeut donc que si la dérivation est sûre.
      if (dossierData.coarse !== true) payload.source = 'manual';
    }

    // La logique "garder la date la plus ancienne" est maintenant côté Edge Function
    // (l'extension n'a plus accès en lecture à la colonne dossier_hash pour des raisons
    // de privacy : éviter qu'un tiers malveillant interroge par hash).
    const result = await sendToSupabase(payload);
    console.info('[Stats] Données anonymes envoyées');
    return result; // { success, count, history? }
  } catch (error) {
    // Silencieux : ne jamais impacter l'expérience utilisateur
    console.warn('[Stats] Erreur envoi anonyme:', error.message);
    return null;
  }
}

/**
 * Réhydrate l'historique local depuis la réponse Supabase (history).
 * Appelé après un changement de dossier pour restaurer les snapshots déjà
 * connus côté serveur (ex: l'utilisateur avait suivi ce dossier sur un
 * autre appareil ou dans le passé).
 *
 * @param {Array} serverHistory - Tableau retourné par l'Edge Function
 *   format: [{ statut, etape, phase, date_statut, source, created_at, ... }]
 * @param {string} dossierId - ID du dossier ciblé (v2.6.0 multi-dossier).
 *   Si omis, route vers le dossier primaire.
 */
export async function rehydrateLocalHistoryFromServer(serverHistory, dossierId) {
  if (!Array.isArray(serverHistory) || serverHistory.length === 0) return 0;

  // Garder une seule entrée par statut (la plus ancienne date_statut) — cohérent
  // avec la logique d'addToHistory.
  const byStatut = {};
  for (const s of serverHistory) {
    const key = (s.statut || '').toLowerCase();
    if (!key) continue;
    const existing = byStatut[key];
    if (!existing || (s.date_statut && s.date_statut < existing.date_statut)) {
      byStatut[key] = s;
    }
  }

  const history = Object.values(byStatut).map(s => ({
    statut: (s.statut || '').toLowerCase(),
    date_statut: s.date_statut,
    timestamp: s.created_at,
    etape: s.etape,
    phase: s.phase
  }));

  // stepDates = entrées marquées 'manual' côté serveur (rectifications de
  // l'utilisateur, déjà validées côté Supabase)
  const stepDates = serverHistory
    .filter(s => s.source === 'manual')
    .map(s => ({
      statut: (s.statut || '').toLowerCase(),
      date_statut: s.date_statut,
      manual: true,
      timestamp: s.created_at
    }));

  const settings = await storage.getSettings();
  const trimmedHistory = history.slice(-settings.historyLimit);

  // v2.6.0 : écrire dans le record du dossier concerné via upsertDossier.
  // Si aucun dossierId n'est fourni, on tombe sur le primaire.
  const targetId = dossierId ? String(dossierId) : (await storage.getPrimaryDossierId());
  if (targetId) {
    await storage.upsertDossier(targetId, {
      history: trimmedHistory,
      stepDates: stepDates
    });
  } else {
    // Fallback legacy (extension vierge, pas de dossier enregistré)
    await storage.set({
      history: trimmedHistory,
      stepDates: stepDates
    });
    storage.scheduleBackupToSync();
  }

  console.info('[Stats] Historique rehydraté depuis Supabase:', history.length, 'statuts',
    targetId ? `(dossier ${targetId.substring(0, 8)}…)` : '(legacy)');
  return history.length;
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

    // Même porte d'entrée que sendAnonymousStats : les dates rectifiées à la main
    // partent vers la même base communautaire, elles relèvent du même consentement.
    const settings = await storage.getSettings();
    if (!storage.hasStatsConsent(settings)) return;

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
        has_complement: isComplementPending(apiData.timeline),
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

// fetchDossierSnapshots supprimé : l'API Supabase n'est plus accessible en
// lecture à partir d'un dossier_hash (la colonne est bloquée pour le rôle anon).
// La restauration des stepDates passe maintenant par chrome.storage.sync
// (backup automatique multi-appareils tant que l'utilisateur est connecté au
// même compte Google Chrome).
