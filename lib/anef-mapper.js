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
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction_2', 7: 'decision_prefecture' };
  }
  if (type === 'DECISION_PLATEFORME_APRES_EA') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction_2', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'decision_prefecture' };
  }
  if (type === 'DECISION_SDANF_AVANT_SCEC') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction_2', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'decision_prise' };
  }
  if (type === 'DECISION_SDANF_APRES_SCEC') {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction_2', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'traitement_scec', 11: 'traitement_sdanf_2', 12: 'decision_prise' };
  }
  if (type === 'COMPLET' && hasStepScec === false) {
    return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction_2', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'decision_prise', 11: 'ceremonie_naturalisation' };
  }
  // COMPLET (avec SCEC) + repli par défaut = parcours le plus complet (14 nœuds)
  return { 0: 'demande_envoyee', 1: 'demande_envoyee', 2: 'examen_pieces', 3: 'demande_deposee', 4: 'traitement_instruction', 5: 'recepisse_completude', 6: 'traitement_instruction_2', 7: 'entretien_assimilation', 8: 'traitement_plateforme_3', 9: 'traitement_sdanf_1', 10: 'traitement_scec', 11: 'traitement_sdanf_2', 12: 'decision_prise', 13: 'ceremonie_naturalisation' };
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
    // 2e nœud d'instruction, APRÈS le récépissé de complétude : le dossier est
    // complet et attend sa date d'entretien. Le confondre avec le 1er nœud
    // renvoyait le dossier à l'étape 5 (50 régressions observées en base).
    case 'traitement_instruction_2': return 'instruction_date_ea_a_fixer';                // étape 6
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

/**
 * Sémantique des drapeaux d'état (ce que les concurrents jettent).
 *
 * ⚠️ Ces drapeaux sont de portée COMPTE, pas de portée dossier : leurs noms
 * disent ce que l'espace ANEF affiche et ce à quoi l'usager a accès. Une
 * demande antérieure laisse `SHOW_DECISION_DOWNLOAD_BUTTON` allumé pour tout
 * le compte (issue #18). Ne pas les lire tels quels depuis l'extérieur :
 * `deriveStatus` les filtre par `decisionCorroboree` avant de les exposer.
 */
export function interpretFlags(flags = []) {
  const has = (f) => flags.includes(f);
  return {
    // Une décision (favorable/défavorable) est téléchargeable dans l'espace usager.
    decisionAvailable: has('SHOW_DECISION_DOWNLOAD_BUTTON'),
    // Le dossier est dans le pipeline décret (on peut se désister du décret de nat).
    inDecretPipeline: has('CAN_ACCESS_DESISTEMENT_NAT_DECRET') || has('CAN_ACCESS_DESISTEMENT_NAT'),
    // Un recours (RAPO) est ouvert/accessible.
    canRapo: flags.some(f => f.includes('RAPO')),
    // ANEF marque le dossier comme clos : plus aucune étape à venir.
    // Observé en prod (juillet 2026) sur un dossier naturalisé :
    // « DECISION_NOTIFIEE|SHOW_DECISION_DOWNLOAD_BUTTON|CAN_ACCESS_DMR|
    //   MES_DEMANDES.DECISION_STATUS|STATUT_DOSSIER_COMPLETED ».
    dossierCompleted: has('STATUT_DOSSIER_COMPLETED'),
    // Service accessible uniquement une fois la procédure aboutie.
    canDmr: has('CAN_ACCESS_DMR'),
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
  DECRET_NATURALISATION_PUBLIE: 'decret_naturalisation_publie',
  NATURALISATION_PUBLIEE: 'decret_naturalisation_publie',
  DECISION_NOTIFIEE: 'decision_notifiee',   // confirmé en prod (juillet 2026)
  DEMANDE_TRAITEE: 'demande_traitee'
};

/**
 * Macros qui marquent une fin de procédure. Quand le dossier est clos
 * (STATUT_DOSSIER_COMPLETED), ces macros font autorité sur la frise, qui reste
 * figée sur son dernier nœud de parcours.
 */
const TERMINAL_MACROS = new Set([
  'DECISION_NOTIFIEE', 'DECISION_DEFAVORABLE', 'DEMANDE_REJETEE', 'DEMANDE_AJOURNEE',
  'DEMANDE_CLASSEE_SANS_SUITE', 'DEMANDE_IRRECEVABLE', 'DEMANDE_TRAITEE', 'DECRET_PUBLIE'
]);

/**
 * Codes d'issue que le macro (ou la dernière notification) annonce SANS
 * ambiguïté. Un repli sur ces codes reste digne de foi : « DEMANDE_REJETEE »
 * ne décrit qu'une seule situation, contrairement à
 * « DEMANDE_EN_COURS_DE_TRAITEMENT » qui couvre les étapes 4 à 11.
 * Sert à ne pas marquer `coarse` un repli qui, lui, sait de quoi il parle.
 */
const TERMINAL_FALLBACK_CODES = new Set([
  'decision_notifiee', 'decision_negative_en_delais_recours', 'css_notifie',
  'irrecevabilite_manifeste', 'decret_naturalisation_publie', 'demande_traitee'
]);

/**
 * Nœuds de frise situés AU NIVEAU ou APRÈS la décision. Tout ce qui n'y figure
 * pas place le dossier avant qu'une décision existe — voir `deriveStatus` et
 * l'issue #18. Les clés proviennent de `getFriseStepKeys` ; les parcours
 * diffèrent par leur longueur, jamais par le nom de ces nœuds terminaux.
 */
const POST_DECISION_FRISE_KEYS = new Set([
  'decision_prefecture', 'decision_prise', 'ceremonie_naturalisation'
]);

/**
 * Macros qui annoncent une décision FAVORABLE sur le dossier courant. Elles ne
 * sont pas dans TERMINAL_MACROS — à raison, la procédure continue (décret) —
 * mais elles répondent à une autre question : « une décision a-t-elle été
 * rendue ? ». Oui, et elle est de portée dossier, pas de portée compte.
 */
const DECISION_MACROS = new Set(['DECISION_FAVORABLE', 'DEMANDE_FAVORABLE']);

/**
 * Motifs de notification qui constatent une décision. Testés uniquement sur le
 * DERNIER événement daté de la timeline : c'est la différence entre « une
 * décision a existé un jour » (qui ne dit rien de l'état présent) et « le
 * dernier fait connu sur ce dossier est une décision ».
 */
const DECISION_MOTIFS = new Set([
  'DECISION_FAVORABLE', 'DECISION_DEFAVORABLE', 'DECRET_PUBLIE', 'CLASSEMENT_SANS_SUITE'
]);

/**
 * Vrai si le statut macro annonce explicitement la publication du décret.
 * Le vocabulaire ANEF varie selon les dossiers (DECRET_PUBLIE,
 * DECRET_NATURALISATION_PUBLIE, NATURALISATION_PUBLIEE…) : on détecte par motif
 * plutôt que par liste figée, sinon un libellé non répertorié retombe
 * silencieusement sur la frise — qui, elle, est en retard (cf. deriveStatus).
 */
export function isDecreePublishedMacro(macro) {
  const m = String(macro || '').toUpperCase();
  return /PUBLI/.test(m) && /(DECRET|NATURALISATION)/.test(m);
}

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
  DECRET_PUBLIE:                   { label: 'Décret publié au JO',            icon: '🏅', code: 'decret_naturalisation_publie' },
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

/**
 * Une demande de complément d'instruction a-t-elle été notifiée ?
 *
 * ⚠️ Ne PAS utiliser `!!dossier.demande_complement` pour répondre à cette
 * question : ce champ de l'API détail est truthy sur 76 % des lignes en base
 * (13 332 / 17 500 au 18/09/2026) — c'est une structure toujours présente, pas
 * un booléen. Comme il ouvrait l'exception « recul autorisé » des deux gardes
 * anti-régression, il les désactivait pour 3 dossiers sur 4 : 604 des 663
 * fausses rétrogradations enregistrées sont passées par là.
 *
 * Le seul signal fiable est la notification ANEF `DEMANDE_COMPLEMENT_INSTRUCTION`,
 * datée, filtrée sur le dossier courant par buildTimeline().
 *
 * @param {Array} timeline - sortie de buildTimeline()
 * @param {string|null} sinceDate - si fourni, seule une demande postérieure ou
 *   égale à cette date compte. Un complément traité il y a deux ans ne justifie
 *   pas de renvoyer aujourd'hui le dossier en instruction.
 */
export function isComplementPending(timeline, sinceDate = null) {
  const items = Array.isArray(timeline) ? timeline : [];
  const demandes = items.filter(e => e.motif === 'DEMANDE_COMPLEMENT_INSTRUCTION' && e.date);
  if (!demandes.length) return false;
  if (!sinceDate) return true;

  const seuil = String(sinceDate).slice(0, 10);
  return demandes.some(e => String(e.date).slice(0, 10) >= seuil);
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
 *   `decisionAvailable` et `inDecretPipeline` sont FILTRÉS (cf. `decisionCorroboree`),
 *   pas les drapeaux bruts ; ces derniers restent dans `flags`.
 */
export function deriveStatus(input = {}) {
  const { statut, frise, currentStep, notifications, dossierId, entretienDate, numeroDecret } = input;

  const { macro, flags } = parseStatutField(statut);
  const flagInfo = interpretFlags(flags);
  const timeline = buildTimeline(notifications, dossierId);

  // Étape granulaire depuis la frise (source d'autorité).
  let friseKey = null, friseIndex = null, friseTotal = null;
  // ⚠️ Ne PAS écrire `Number(frise?.id_active)` : `Number(null)` et `Number('')`
  // valent 0, que `Number.isFinite` accepte — une frise dégradée (`id_active:
  // null`, relayée telle quelle par injected-script.js) produisait alors
  // `demande_envoyee` → `dossier_depose`, étape 2, avec `derivedFrom: 'frise'`
  // et `coarse: false`. Une rétrogradation réputée fiable, que ni le garde
  // client ni le plafond serveur n'arrêtaient : c'est la seconde moitié de
  // l'issue #17 (50 régressions en `dossier_depose` observées en base).
  const rawActive = frise?.id_active;
  const idActive = (typeof rawActive === 'number' || (typeof rawActive === 'string' && rawActive.trim() !== ''))
    ? Number(rawActive)
    : NaN;
  if (Number.isInteger(idActive) && idActive >= 0) {
    const keys = getFriseStepKeys(frise?.type_frise, frise?.has_step_scec);
    const indices = Object.keys(keys).map(Number);
    friseTotal = indices.length ? Math.max(...indices) : null;
    friseIndex = idActive;
    friseKey = keys[idActive] || null;
  }

  const decretAssigned = numeroDecret != null && String(numeroDecret).trim() !== '';

  // ── Drapeaux d'espace usager vs état du dossier (issue #18) ──
  // `SHOW_DECISION_DOWNLOAD_BUTTON` et `CAN_ACCESS_DESISTEMENT_NAT_DECRET` ne
  // décrivent pas ce dossier-ci : leurs noms disent ce que l'espace ANEF affiche
  // et ce à quoi l'USAGER a accès. Une demande antérieure classée sans suite
  // laisse donc le bouton de téléchargement allumé pour le compte entier, et
  // l'extension l'attribuait au dossier en cours — d'où « Décision disponible »
  // et « Pipeline décret » sur un dossier à l'étape 8, où la préfecture n'a
  // même pas encore formulé sa proposition.
  //
  // On ne les retient donc que si un signal propre au dossier le place, MAINTENANT,
  // au stade de la décision. Deux précisions sur le choix des critères :
  //
  //  • une décision PASSÉE ne corrobore rien. Un dossier peut avoir reçu une
  //    décision puis avoir repris sa route (recours abouti, nouvelle demande),
  //    et se retrouver à l'étape 8 : le document reste téléchargeable, mais il
  //    ne décrit plus l'étape en cours. D'où le test sur le DERNIER événement
  //    daté seulement — « le dernier fait connu est une décision » — et non sur
  //    la présence d'une décision quelque part dans l'histoire, qui rouvrirait
  //    exactement le défaut qu'on ferme ici.
  //
  //  • la position de la frise ne suffit pas non plus à elle seule : elle reste
  //    en retrait dans un cas légitime — dossier déjà inséré au décret alors que
  //    la frise indique encore `traitement_sdanf_2` (cf. promotion « décret
  //    assigné » plus bas). D'où le décret assigné comme critère à part entière.
  //
  // `canRapo` est volontairement laissé tel quel : il alimente l'exception
  // `repriseApresRecours` du garde anti-régression (service-worker), et le
  // durcir risquerait de regeler les dossiers dont le recours a abouti — la
  // régression corrigée au run #15. Aucun élément de l'issue #18 ne le met en
  // cause.
  const dernierEvenement = timeline.length ? timeline[timeline.length - 1] : null;

  const decisionCorroboree =
       friseKey == null                           // pas de frise : on ne présume rien
    || POST_DECISION_FRISE_KEYS.has(friseKey)     // la frise a atteint la décision
    || decretAssigned                             // un décret nomme ce dossier
    || flagInfo.dossierCompleted                  // ANEF clôt ce dossier
    || TERMINAL_MACROS.has(macro)                 // le macro annonce l'issue en cours
    || DECISION_MACROS.has(macro)                 // le macro dit « décision favorable »
    || isDecreePublishedMacro(macro)
    // Le dernier fait daté connu sur CE dossier est une décision. Couvre aussi
    // la publication au JO constatée par notification alors que l'appel détail
    // a échoué : sans ça, `deriveStatus` conclut « décret publié » (étape 12)
    // tout en éteignant le badge « Décision disponible » — deux affirmations
    // contradictoires sur le même écran.
    || (dernierEvenement != null && DECISION_MOTIFS.has(dernierEvenement.motif));

  const decisionAvailable = decisionCorroboree && flagInfo.decisionAvailable;
  const inDecretPipeline  = decisionCorroboree && flagInfo.inDecretPipeline;

  const ctx = {
    inDecretPipeline,
    decisionAvailable,
    entretienDate,
    macro
  };

  // Priorité : frise > macro connu > dernier événement daté > inconnu.
  // `derivedFrom` retient LEQUEL de ces signaux a parlé : la frise est
  // granulaire et fait autorité ; le macro et la timeline sont des replis
  // grossiers qui ne savent pas distinguer l'étape 4 de l'étape 11 (cf. `coarse`).
  const friseCode = friseKey ? friseKeyToStatutCode(friseKey, ctx) : null;
  const macroCode = MACRO_STATUS_TO_CODE[macro] || null;
  const timelineCode = timeline.length ? timeline[timeline.length - 1].code : null;

  let derivedFrom = friseCode ? 'frise' : (macroCode ? 'macro' : (timelineCode ? 'timeline' : null));
  let statutCode = friseCode || macroCode || timelineCode || null;

  // Affinages transverses qui prévalent sur l'étape brute :
  if (decisionAvailable && inDecretPipeline && friseKey === 'decision_prise') {
    statutCode = 'inseree_dans_decret';
    derivedFrom = 'signal';
  }

  // ── Signal fort : décret assigné ──
  // Quand `identites_decrets[].decret.id` existe, l'identité du demandeur est
  // formalisée pour un décret précis → le dossier est AU MOINS « inséré dans le
  // décret » (étape 11), ce que la frise (souvent en retrait, ex. id_active=11
  // = validation hiérarchique) ne reflète pas encore. On promeut donc, sauf si
  // le dossier est déjà publié au JO / terminal (étape 12).
  const DECREE_PUBLISHED = ['decret_naturalisation_publie', 'decret_naturalisation_publie_jo', 'decret_publie', 'demande_traitee'];
  if (decretAssigned && !DECREE_PUBLISHED.includes(statutCode)) {
    statutCode = (friseKey === 'ceremonie_naturalisation') ? 'decret_naturalisation_publie' : 'inseree_dans_decret';
    derivedFrom = 'signal';
  }

  // ── Signaux terminaux (priorité absolue, appliqués EN DERNIER) ──
  // Après la publication au JO, la frise reste figée sur son dernier nœud de
  // parcours et le macro ne mentionne pas le décret : la promotion « décret
  // assigné » ci-dessus rétrogradait alors le dossier en `inseree_dans_decret`
  // (étape 11) alors que la personne est naturalisée depuis longtemps.
  const publishedEvent = timeline.some(e => e.motif === 'DECRET_PUBLIE');

  if (flagInfo.dossierCompleted && decretAssigned) {
    // Dossier clos AVEC un décret attribué : la seule issue possible est la
    // naturalisation (un refus n'a jamais de numéro de décret).
    statutCode = 'decret_naturalisation_publie';
    derivedFrom = 'signal';
  } else if (flagInfo.dossierCompleted && TERMINAL_MACROS.has(macro)) {
    // Dossier clos sans décret : c'est le macro qui dit l'issue, pas la frise.
    statutCode = MACRO_STATUS_TO_CODE[macro] || statutCode;
    derivedFrom = 'signal';
  }

  if (isDecreePublishedMacro(macro) || publishedEvent) {
    statutCode = 'decret_naturalisation_publie';
    derivedFrom = 'signal';
  }

  return {
    statutCode,
    // Qui a produit `statutCode` : 'frise' (granulaire, fiable), 'macro' ou
    // 'timeline' (replis grossiers), 'signal' (décret assigné / dossier clos /
    // publication — des faits, pas des approximations), null (rien d'exploitable).
    derivedFrom,
    // Vrai quand le statut ne repose que sur un repli grossier. Le macro ANEF
    // (« DEMANDE_EN_COURS_DE_TRAITEMENT ») est le MÊME de l'étape 4 à l'étape 11 :
    // le prendre au mot renvoie n'importe quel dossier en cours à l'étape 5.
    // C'est ce qui se produit dès que la frise ET le détail échouent dans le
    // même tour (les deux sont « best effort » et renvoient null sur erreur).
    // L'aval doit refuser de rétrograder un dossier sur cette seule base.
    coarse: (derivedFrom === 'macro' || derivedFrom === 'timeline')
      && !TERMINAL_FALLBACK_CODES.has(statutCode),
    macro,
    flags: flagInfo.raw,
    friseKey,
    friseIndex,
    friseTotal,
    decretAssigned,
    numeroDecret: decretAssigned ? String(numeroDecret) : null,
    // Filtrés par `decisionCorroboree` (issue #18) : ce sont des drapeaux d'espace
    // usager, pas des propriétés du dossier. `flagInfo.raw` garde le brut.
    decisionAvailable,
    inDecretPipeline,
    canRapo: flagInfo.canRapo,
    dossierCompleted: flagInfo.dossierCompleted,
    timeline
  };
}
