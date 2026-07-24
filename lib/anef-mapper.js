/**
 * Couche de traduction API ANEF → modèle interne - Extension ANEF Status Tracker
 *
 * Depuis mi-juillet 2026, l'API ANEF ne renvoie plus le statut granulaire chiffré.
 * Elle expose désormais TROIS signaux séparés qu'il faut recombiner :
 *
 *   1. dossier.statut  : « MACRO|DRAPEAU|DRAPEAU|MENU » — texte clair, plus de RSA.
 *                        Token 0 = statut macro grossier. Tokens 1+ = drapeaux d'UI
 *                        MAIS porteurs d'état (décision dispo, pipeline décret…).
 *   2. frise-stepper   : { id_active, type_frise, has_step_scec } — position d'étape
 *                        GRANULAIRE faisant autorité. C'est la vraie source de l'étape.
 *   3. /notifications  : historique d'événements HORODATÉ réel (dépôt, compléments,
 *                        entretien fixé, décision…). Filtrable par dossier.
 *
 * Ce module TRADUIT ces signaux vers l'ancien `statutCode` (vocabulaire de
 * lib/status-parser.js) afin que TOUT l'aval (popup, site, durées, multi-dossier)
 * continue de fonctionner sans réécriture. Aucune dépendance : fonctions pures.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// 1. Frise : id_active → clé d'étape, selon type_frise + SCEC
//    (table rétro-conçue à partir du parcours officiel ANEF)
// ─────────────────────────────────────────────────────────────

/** Renvoie la table { index → clé de frise } pour un type de frise donné. */
export function getFriseStepKeys(typeFrise, hasStepScec) {
  const type = String(typeFrise || '').trim().toUpperCase();

  if (type === 'DECISION_RAPO') return {};

  if (type === 'DECISION_PLATEFORME_AVANT_VF') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'traitement_instruction', 4: 'decision_prefecture' };
  }
  if (type === 'DECISION_PLATEFORME_AVANT_RECEPISSE_COMPLETUDE') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'decision_prefecture' };
  }
  if (type === 'DECISION_PLATEFORME_AVANT_EA') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction', 7: 'decision_prefecture' };
  }
  if (type === 'DECISION_PLATEFORME_APRES_EA') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'decision_prefecture' };
  }
  if (type === 'DECISION_SDANF_AVANT_SCEC') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'decision_prise' };
  }
  if (type === 'DECISION_SDANF_APRES_SCEC') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'traitement_scec', 11: 'traitement_sdanf_2', 12: 'decision_prise' };
  }
  if (type === 'COMPLET' && hasStepScec === false) {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'decision_prise', 11: 'ceremonie_naturalisation' };
  }
  // COMPLET (avec SCEC) + repli par défaut = parcours le plus complet (14 nœuds)
  return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'traitement_scec', 11: 'traitement_sdanf_2', 12: 'decision_prise', 13: 'ceremonie_naturalisation' };
}

/**
 * Traduit une clé de frise vers un code de statut du dictionnaire existant
 * (lib/status-parser.js), afin de réutiliser etape/rang/description/icône.
 * `ctx` = { inDecretPipeline, decisionAvailable, entretienDate, macro }.
 */
function friseKeyToStatutCode(friseKey, ctx = {}) {
  switch (friseKey) {
    case 'demande_envoyee':          return 'dossier_depose';                          // étape 2
    case 'examen_pieces':            return 'verification_formelle_en_cours';          // étape 3
    case 'demande_deposee':          return 'instruction_a_affecter';                  // étape 4 (recevable)
    case 'traitement_instruction':   return 'instruction_recepisse_completude_a_envoyer'; // étape 5
    case 'recepisse_completude':     return 'instruction_date_ea_a_fixer';             // étape 6 (complet, enquêtes)
    case 'entretien_assimilation':   return 'ea_en_attente_ea';                        // étape 7
    case 'traitement_plateforme_3':  return 'prop_decision_pref_a_effectuer';          // étape 8 (avis préfecture)
    case 'decision_prefecture':      return ctx.decisionAvailable ? 'decision_notifiee' : 'prop_decision_pref_a_effectuer';
    case 'traitement_sdanf_1':       return 'controle_sdanf';                          // étape 9 (contrôle SDANF) : l'API ne distingue plus « à affecter » (CAA) de « à effectuer » (CAE) → code unifié pour les nouveaux dossiers. Les anciens gardent controle_a_affecter / controle_a_effectuer.
    case 'traitement_scec':          return 'controle_en_attente_pec';                 // étape 9 (SCEC Nantes)
    case 'traitement_sdanf_2':       return 'controle_en_attente_retour_hierarchique'; // étape 10 (validation hiérarchique)
    case 'ceremonie_naturalisation': return 'decret_naturalisation_publie';            // étape 12
    case 'decision_prise':
      // La décision est prise : favorable (pipeline décret) ou notifiée (autre issue).
      if (ctx.inDecretPipeline) return 'prete_pour_insertion_decret';                 // étape 10 (favorable)
      if (ctx.decisionAvailable) return 'decision_notifiee';                          // étape 12
      return 'controle_en_attente_retour_hierarchique';
    default:                         return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Statut macro + drapeaux (token 0 = macro ; tokens 1+ = drapeaux)
// ─────────────────────────────────────────────────────────────

/**
 * Découpe le champ statut (« MACRO|DRAPEAU|... » ou objet { type }) en
 * { macro, flags[] }. Gère aussi l'objet renvoyé par l'endpoint détail.
 */
export function parseStatutField(statut) {
  let raw = (statut && typeof statut === 'object')
    ? (statut.type ?? statut.code ?? statut.value ?? statut.statut ?? '')
    : statut;
  raw = String(raw || '').trim();
  try { raw = decodeURIComponent(raw); } catch { /* pas URL-encodé */ }

  const tokens = raw.split('|').map(t => t.trim()).filter(Boolean);
  const macro = (tokens.shift() || '').toUpperCase();
  // On écarte les chemins de menu i18n (« MES_DEMANDES.TRAITEMENT »)
  const flags = tokens.filter(t => !t.includes('.')).map(t => t.toUpperCase());
  return { macro, flags };
}

/** Sémantique des drapeaux d'état (ce que les concurrents jettent). */
export function interpretFlags(flags = []) {
  const has = (f) => flags.includes(f);
  return {
    // Une décision (favorable/défavorable) est téléchargeable dans l'espace usager.
    decisionAvailable: has('SHOW_DECISION_DOWNLOAD_BUTTON'),
    // Le dossier est dans le pipeline décret (on peut se désister du décret de nat).
    inDecretPipeline: has('CAN_ACCESS_DESISTEMENT_NAT_DECRET') || has('CAN_ACCESS_DESISTEMENT_NAT'),
    // Un recours (RAPO) est ouvert/accessible.
    canRapo: flags.some(f => f.includes('RAPO')),
    raw: flags
  };
}

/**
 * Statuts macro connus → code interne (repli quand la frise est absente).
 * ⚠️ Vocabulaire à compléter au fil des dossiers observés. Le premier est confirmé
 * en prod (dossier 509729, juillet 2026) ; les autres sont des hypothèses prudentes
 * marquées à valider (leur repli reste sûr car la frise prime, cf. deriveStatus).
 */
const MACRO_STATUS_TO_CODE = {
  DEMANDE_EN_COURS_DE_TRAITEMENT: 'instruction_recepisse_completude_a_envoyer', // confirmé
  // ↓ hypothèses à confirmer :
  DECISION_FAVORABLE: 'controle_transmise_pour_decret',
  DEMANDE_FAVORABLE: 'controle_transmise_pour_decret',
  DECISION_DEFAVORABLE: 'decision_negative_en_delais_recours',
  DEMANDE_REJETEE: 'decision_negative_en_delais_recours',
  DEMANDE_AJOURNEE: 'decision_notifiee',
  DEMANDE_CLASSEE_SANS_SUITE: 'css_notifie',
  DEMANDE_IRRECEVABLE: 'irrecevabilite_manifeste',
  DECRET_PUBLIE: 'decret_naturalisation_publie',
  DEMANDE_TRAITEE: 'demande_traitee'
};

// ─────────────────────────────────────────────────────────────
// 3. Notifications → timeline horodatée (le différenciateur)
// ─────────────────────────────────────────────────────────────

/** motif_notification → { label lisible, icône, code d'étape éventuel }. */
export const MOTIF_LABELS = {
  CONFIRMATION_DEPOT:              { label: 'Dépôt confirmé',                 icon: '📨', code: 'dossier_depose' },
  RECEPISSE_DEPOT_ENVOYE:          { label: 'Récépissé de dépôt envoyé',      icon: '🧾', code: 'instruction_a_affecter' },
  DEMANDE_COMPLEMENT_INSTRUCTION:  { label: 'Demande de complément',          icon: '📎' },
  RECEPISSE_COMPLETUDE_ENVOYE:     { label: 'Récépissé de complétude',        icon: '✅', code: 'instruction_date_ea_a_fixer' },
  ENTRETIEN_ASSIMILATION_FIXE:     { label: "Entretien d'assimilation fixé",  icon: '🗓️', code: 'ea_en_attente_ea' },
  ENTRETIEN_ASSIMILATION_REPORTE:  { label: "Entretien reporté",              icon: '🔄', code: 'ea_demande_report_ea' },
  DECISION_FAVORABLE:              { label: 'Décision favorable',             icon: '🎉', code: 'controle_transmise_pour_decret' },
  DECISION_DEFAVORABLE:            { label: 'Décision défavorable',           icon: '❌', code: 'decision_negative_en_delais_recours' },
  DECRET_PUBLIE:                   { label: 'Décret publié au JO',            icon: '🇫🇷', code: 'decret_naturalisation_publie' },
  CLASSEMENT_SANS_SUITE:           { label: 'Classement sans suite',          icon: '⚠️', code: 'css_notifie' },
  MISE_EN_DEMEURE:                 { label: 'Mise en demeure',                icon: '⚠️', code: 'verification_formelle_mise_en_demeure' }
};

/**
 * Construit une timeline datée à partir des notifications ANEF, filtrée sur le
 * dossier courant. Filtre `type_notification === 'NATIONALITE'` ET `id_demande`
 * (indispensable en multi-dossier : ANEF mélange nationalité et séjour).
 */
export function buildTimeline(notifications, dossierId) {
  const items = Array.isArray(notifications) ? notifications
    : (notifications?._items || notifications?.items || []);
  const wantId = dossierId != null ? String(dossierId) : null;

  return items
    .filter(n => String(n.type_notification || '').toUpperCase() === 'NATIONALITE')
    .filter(n => wantId == null || String(n.id_demande) === wantId)
    .map(n => {
      const motif = String(n.motif_notification || '').toUpperCase();
      const meta = MOTIF_LABELS[motif] || { label: humanizeMotif(motif), icon: '•' };
      return {
        date: n._created || n.date_creation || n.date,
        motif,
        label: meta.label,
        icon: meta.icon,
        code: meta.code || null,
        lu: n.lu === true || n.lu === 'true'
      };
    })
    .filter(e => e.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Repli lisible pour un motif inconnu : « DEMANDE_COMPLEMENT » → « Demande complement ». */
function humanizeMotif(motif) {
  const s = String(motif || '').toLowerCase().replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Événement';
}

// ─────────────────────────────────────────────────────────────
// 4. Point d'entrée : recombine tous les signaux en un statut normalisé
// ─────────────────────────────────────────────────────────────

/**
 * Recombine statut + frise + notifications en un objet normalisé prêt pour l'aval.
 * @param {object} input
 *   - statut        : string | { type } venant de dossier-stepper ou du détail
 *   - frise         : { id_active, type_frise, has_step_scec }
 *   - currentStep   : number (échelle grossière du détail, indicatif)
 *   - notifications : tableau ou { _items } de /api/notifications
 *   - dossierId     : id du dossier courant (filtre notifications)
 *   - entretienDate : date d'entretien (affine l'étape EA)
 * @returns {{ statutCode, macro, flags, friseKey, friseIndex, friseTotal,
 *            decisionAvailable, inDecretPipeline, canRapo, timeline }}
 */
export function deriveStatus(input = {}) {
  const { statut, frise, currentStep, notifications, dossierId, entretienDate, numeroDecret } = input;

  const { macro, flags } = parseStatutField(statut);
  const flagInfo = interpretFlags(flags);
  const timeline = buildTimeline(notifications, dossierId);

  // Étape granulaire depuis la frise (source d'autorité).
  let friseKey = null, friseIndex = null, friseTotal = null;
  const idActive = Number(frise?.id_active);
  if (Number.isFinite(idActive)) {
    const keys = getFriseStepKeys(frise?.type_frise, frise?.has_step_scec);
    const indices = Object.keys(keys).map(Number);
    friseTotal = indices.length ? Math.max(...indices) : null;
    friseIndex = idActive;
    friseKey = keys[idActive] || null;
  }

  const ctx = {
    inDecretPipeline: flagInfo.inDecretPipeline,
    decisionAvailable: flagInfo.decisionAvailable,
    entretienDate,
    macro
  };

  // Priorité : frise > macro connu > dernier événement daté > inconnu.
  let statutCode =
    (friseKey && friseKeyToStatutCode(friseKey, ctx)) ||
    MACRO_STATUS_TO_CODE[macro] ||
    (timeline.length ? timeline[timeline.length - 1].code : null) ||
    null;

  // Affinages transverses qui prévalent sur l'étape brute :
  if (flagInfo.decisionAvailable && flagInfo.inDecretPipeline && friseKey === 'decision_prise') {
    statutCode = 'inseree_dans_decret';
  }

  // ── Signal fort : décret assigné ──
  // Quand `identites_decrets[].decret.id` existe, l'identité du demandeur est
  // formalisée pour un décret précis → le dossier est AU MOINS « inséré dans le
  // décret » (étape 11), ce que la frise (souvent en retrait, ex. id_active=11
  // = validation hiérarchique) ne reflète pas encore. On promeut donc, sauf si
  // le dossier est déjà publié au JO / terminal (étape 12).
  const DECREE_PUBLISHED = ['decret_naturalisation_publie', 'decret_naturalisation_publie_jo', 'decret_publie', 'demande_traitee'];
  const decretAssigned = numeroDecret != null && String(numeroDecret).trim() !== '';
  if (decretAssigned && !DECREE_PUBLISHED.includes(statutCode)) {
    statutCode = (friseKey === 'ceremonie_naturalisation') ? 'decret_naturalisation_publie' : 'inseree_dans_decret';
  }

  return {
    statutCode,
    macro,
    flags: flagInfo.raw,
    friseKey,
    friseIndex,
    friseTotal,
    decretAssigned,
    numeroDecret: decretAssigned ? String(numeroDecret) : null,
    decisionAvailable: flagInfo.decisionAvailable,
    inDecretPipeline: flagInfo.inDecretPipeline,
    canRapo: flagInfo.canRapo,
    timeline
  };
}
