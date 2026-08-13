/**
 * Demande de modification du décret (DMR) - Extension ANEF Status Tracker
 *
 * Libellés et utilitaires pour la démarche de modification du décret de
 * naturalisation, récupérée depuis l'espace personnel ANEF de l'usager.
 *
 * Deux points de vigilance côté produit :
 *   • l'API ne renvoie qu'un état grossier (les trois valeurs ci-dessous) et la
 *     progression du FORMULAIRE, jamais l'avancement de l'instruction — ce
 *     dernier n'est visible qu'à travers les notifications ANEF ;
 *   • les liens de téléchargement fournis sont signés et expirent (24 h), d'où
 *     `isDmrLinkValid()`.
 *
 * ⚠️ Ce module manipule des données personnelles (état civil, enfants). Elles
 * restent dans chrome.storage.local : la liste blanche de
 * buildAnonymousPayload (lib/anonymous-stats.js) ne les reprend jamais, et le
 * backup chrome.storage.sync ne porte que l'historique de statuts.
 */

/** Statuts d'une DMR, dans l'ordre du cycle de vie. */
const DMR_STATUTS = {
  BROUILLON: {
    label: 'Brouillon',
    hint: 'Demande commencée mais pas encore déposée.',
    tone: 'draft',
    icon: '📝'
  },
  DEPOT_CONFIRME: {
    label: 'Dépôt confirmé',
    hint: 'Demande déposée, en attente de traitement par le ministère.',
    tone: 'pending',
    icon: '📨'
  },
  TRAITEMENT_TERMINE: {
    label: 'Traitement terminé',
    hint: 'Le ministère a fini de traiter la demande.',
    tone: 'done',
    icon: '✅'
  }
};

/** Étapes du formulaire (champ `etape_actuelle`). */
const DMR_ETAPES = [
  'Demandeur',
  'Effets collectifs',
  'Justificatifs',
  'Récapitulatif',
  'Confirmation du dépôt'
];

/** Motif d'ajout d'un enfant. */
export const DMR_MOTIFS_AJOUT = {
  ENFANT_DECLARE: 'Enfant déclaré',
  NAISSANCE: 'Naissance'
};

/** Types de justificatifs acceptés par le formulaire. */
export const DMR_JUSTIFICATIFS = {
  ACTE_ETAT_CIVIL: 'Acte d\'état civil',
  CERTIFICAT_DECES: 'Certificat de décès',
  RELEVE_CAF: 'Relevé CAF',
  JUSTIFICATIF_DOMICILE: 'Justificatif de domicile',
  PIECE_IDENTITE_SECOND_PARENT: 'Pièce d\'identité du second parent'
};

/**
 * Motifs de notification qui concernent une DMR.
 * Ce sont les seuls évènements datés du suivi côté ANEF.
 */
export const DMR_EVENT_MOTIFS = {
  DEMANDE_COMPLEMENT_DMR_MODIFICATIF: {
    label: 'Complément demandé (modification)',
    action: true
  },
  DEMANDE_COMPLEMENT_DMR_RECTIFICATIF: {
    label: 'Complément demandé (rectification)',
    action: true
  },
  DECISION_DEFAVORABLE_DMR: {
    label: 'Décision défavorable',
    action: false
  },
  CONFIRMATION_PUBLICATION_DECRET_RECTIFICATIF: {
    label: 'Décret rectificatif publié',
    action: false
  }
};

/** Libellé lisible d'un statut DMR (repli : le code brut). */
export function getDmrStatut(statut) {
  return DMR_STATUTS[statut] || { label: statut || 'Inconnu', hint: '', tone: 'pending', icon: '📄' };
}

/** Libellé d'une étape de formulaire, ex. « 5/5 — Confirmation du dépôt ». */
export function formatDmrEtape(etape) {
  const n = Number(etape);
  if (!n || n < 1 || n > DMR_ETAPES.length) return null;
  return `${n}/${DMR_ETAPES.length} — ${DMR_ETAPES[n - 1]}`;
}

/** Ne garde des notifications ANEF que celles liées à la DMR, triées par date. */
export function extractDmrEvents(notifications) {
  if (!Array.isArray(notifications)) return [];
  return notifications
    .filter(n => n && DMR_EVENT_MOTIFS[n.motif_notification])
    .map(n => ({
      motif: n.motif_notification,
      date: n._created || null,
      lu: !!n.lu
    }))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

/** Vrai si un évènement DMR appelle une action de l'usager (complément à fournir). */
export function dmrEventNeedsAction(motif) {
  return !!DMR_EVENT_MOTIFS[motif]?.action;
}

/** Vrai si le lien signé de l'attestation est encore valable. */
export function isDmrLinkValid(attestation) {
  if (!attestation?.url) return false;
  if (!attestation.expire) return true; // pas d'info d'expiration → on tente
  const exp = new Date(attestation.expire).getTime();
  return Number.isFinite(exp) && exp > Date.now();
}
