/**
 * Dictionnaire des statuts ANEF - Extension ANEF Status Tracker
 *
 * Contient tous les codes de statut possibles avec :
 * - Phase (étape du processus)
 * - Explication simple
 * - Description détaillée
 * - Numéro d'étape (1-12)
 */

import { t, getLocale } from './i18n-helper.js';

const STATUTS = {
  // ── Étape 1 : Brouillon ──────────────────────────────────────
  "draft": {
    phaseKey: "status_draft_phase",
    explicationKey: "status_draft_explication",
    etape: 1,
    rang: 100,
    descriptionKey: "status_draft_description",
    icon: "📝"
  },

  // ── Étape 2 : Dépôt du dossier ───────────────────────────────
  "dossier_depose": {
    phaseKey: "status_dossier_depose_phase",
    explicationKey: "status_dossier_depose_explication",
    etape: 2,
    rang: 200,
    descriptionKey: "status_dossier_depose_description",
    icon: "📨"
  },

  // ── Étape 3 : Vérification formelle ──────────────────────────
  "verification_formelle_a_traiter": {
    phaseKey: "status_verification_formelle_a_traiter_phase",
    explicationKey: "status_verification_formelle_a_traiter_explication",
    etape: 3,
    rang: 301,
    descriptionKey: "status_verification_formelle_a_traiter_description",
    icon: "🔍"
  },
  "verification_formelle_en_cours": {
    phaseKey: "status_verification_formelle_en_cours_phase",
    explicationKey: "status_verification_formelle_en_cours_explication",
    etape: 3,
    rang: 302,
    descriptionKey: "status_verification_formelle_en_cours_description",
    icon: "🔍"
  },
  "verification_formelle_mise_en_demeure": {
    phaseKey: "status_verification_formelle_mise_en_demeure_phase",
    explicationKey: "status_verification_formelle_mise_en_demeure_explication",
    etape: 3,
    rang: 303,
    descriptionKey: "status_verification_formelle_mise_en_demeure_description",
    icon: "⚠️"
  },
  "css_mise_en_demeure_a_affecter": {
    phaseKey: "status_css_mise_en_demeure_a_affecter_phase",
    explicationKey: "status_css_mise_en_demeure_a_affecter_explication",
    etape: 3,
    rang: 304,
    descriptionKey: "status_css_mise_en_demeure_a_affecter_description",
    icon: "⚠️"
  },
  "css_mise_en_demeure_a_rediger": {
    phaseKey: "status_css_mise_en_demeure_a_rediger_phase",
    explicationKey: "status_css_mise_en_demeure_a_rediger_explication",
    etape: 3,
    rang: 305,
    descriptionKey: "status_css_mise_en_demeure_a_rediger_description",
    icon: "⚠️"
  },

  // ── Étape 4 : Affectation instructeur ────────────────────────
  "instruction_a_affecter": {
    phaseKey: "status_instruction_a_affecter_phase",
    explicationKey: "status_instruction_a_affecter_explication",
    etape: 4,
    rang: 400,
    descriptionKey: "status_instruction_a_affecter_description",
    icon: "👤"
  },

  // ── Étape 5 : Instruction du dossier ─────────────────────────
  "instruction_recepisse_completude_a_envoyer": {
    phaseKey: "status_instruction_recepisse_completude_a_envoyer_phase",
    explicationKey: "status_instruction_recepisse_completude_a_envoyer_explication",
    etape: 5,
    rang: 501,
    descriptionKey: "status_instruction_recepisse_completude_a_envoyer_description",
    icon: "📖"
  },
  "instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter": {
    phaseKey: "status_instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter_phase",
    explicationKey: "status_instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter_explication",
    etape: 5,
    rang: 502,
    descriptionKey: "status_instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter_description",
    icon: "📋"
  },

  // ── Étape 6 : Complétude & enquêtes ──────────────────────────
  "instruction_date_ea_a_fixer": {
    phaseKey: "status_instruction_date_ea_a_fixer_phase",
    explicationKey: "status_instruction_date_ea_a_fixer_explication",
    etape: 6,
    rang: 601,
    descriptionKey: "status_instruction_date_ea_a_fixer_description",
    icon: "🔎"
  },
  "ea_demande_report_ea": {
    phaseKey: "status_ea_demande_report_ea_phase",
    explicationKey: "status_ea_demande_report_ea_explication",
    etape: 6,
    rang: 602,
    descriptionKey: "status_ea_demande_report_ea_description",
    icon: "🔄"
  },

  // ── Étape 7 : Entretien d'assimilation ───────────────────────
  "ea_en_attente_ea": {
    phaseKey: "status_ea_en_attente_ea_phase",
    explicationKey: "status_ea_en_attente_ea_explication",
    etape: 7,
    rang: 701,
    descriptionKey: "status_ea_en_attente_ea_description",
    icon: "📬"
  },
  "ea_crea_a_valider": {
    phaseKey: "status_ea_crea_a_valider_phase",
    explicationKey: "status_ea_crea_a_valider_explication",
    etape: 7,
    rang: 702,
    descriptionKey: "status_ea_crea_a_valider_description",
    icon: "✅"
  },

  // ── Étape 8 : Décision préfecture ────────────────────────────
  "prop_decision_pref_a_effectuer": {
    phaseKey: "status_prop_decision_pref_a_effectuer_phase",
    explicationKey: "status_prop_decision_pref_a_effectuer_explication",
    etape: 8,
    rang: 801,
    descriptionKey: "status_prop_decision_pref_a_effectuer_description",
    icon: "⚖️"
  },
  "prop_decision_pref_en_attente_retour_hierarchique": {
    phaseKey: "status_prop_decision_pref_en_attente_retour_hierarchique_phase",
    explicationKey: "status_prop_decision_pref_en_attente_retour_hierarchique_explication",
    etape: 8,
    rang: 802,
    descriptionKey: "status_prop_decision_pref_en_attente_retour_hierarchique_description",
    icon: "👔"
  },
  "prop_decision_pref_prop_a_editer": {
    phaseKey: "status_prop_decision_pref_prop_a_editer_phase",
    explicationKey: "status_prop_decision_pref_prop_a_editer_explication",
    etape: 8,
    rang: 803,
    descriptionKey: "status_prop_decision_pref_prop_a_editer_description",
    icon: "📝"
  },
  "prop_decision_pref_en_attente_retour_signataire": {
    phaseKey: "status_prop_decision_pref_en_attente_retour_signataire_phase",
    explicationKey: "status_prop_decision_pref_en_attente_retour_signataire_explication",
    etape: 8,
    rang: 804,
    descriptionKey: "status_prop_decision_pref_en_attente_retour_signataire_description",
    icon: "✍️"
  },

  // ── Étape 9 : Contrôle SDANF & SCEC ─────────────────────────
  "controle_a_affecter": {
    phaseKey: "status_controle_a_affecter_phase",
    explicationKey: "status_controle_a_affecter_explication",
    etape: 9,
    rang: 901,
    descriptionKey: "status_controle_a_affecter_description",
    icon: "🏛️"
  },
  "controle_a_effectuer": {
    phaseKey: "status_controle_a_effectuer_phase",
    explicationKey: "status_controle_a_effectuer_explication",
    etape: 9,
    rang: 902,
    descriptionKey: "status_controle_a_effectuer_description",
    icon: "📑"
  },
  "controle_en_attente_pec": {
    phaseKey: "status_controle_en_attente_pec_phase",
    explicationKey: "status_controle_en_attente_pec_explication",
    etape: 9,
    rang: 903,
    descriptionKey: "status_controle_en_attente_pec_description",
    icon: "🏛️"
  },
  "controle_pec_a_faire": {
    phaseKey: "status_controle_pec_a_faire_phase",
    explicationKey: "status_controle_pec_a_faire_explication",
    etape: 9,
    rang: 904,
    descriptionKey: "status_controle_pec_a_faire_description",
    icon: "✔️"
  },

  // ── Étape 10 : Préparation décret ────────────────────────────
  "controle_transmise_pour_decret": {
    phaseKey: "status_controle_transmise_pour_decret_phase",
    explicationKey: "status_controle_transmise_pour_decret_explication",
    etape: 10,
    rang: 1001,
    descriptionKey: "status_controle_transmise_pour_decret_description",
    icon: "🎉"
  },
  "controle_en_attente_retour_hierarchique": {
    phaseKey: "status_controle_en_attente_retour_hierarchique_phase",
    explicationKey: "status_controle_en_attente_retour_hierarchique_explication",
    etape: 10,
    rang: 1002,
    descriptionKey: "status_controle_en_attente_retour_hierarchique_description",
    icon: "👔"
  },
  "controle_decision_a_editer": {
    phaseKey: "status_controle_decision_a_editer_phase",
    explicationKey: "status_controle_decision_a_editer_explication",
    etape: 10,
    rang: 1003,
    descriptionKey: "status_controle_decision_a_editer_description",
    icon: "📄"
  },
  "controle_en_attente_signature": {
    phaseKey: "status_controle_en_attente_signature_phase",
    explicationKey: "status_controle_en_attente_signature_explication",
    etape: 10,
    rang: 1004,
    descriptionKey: "status_controle_en_attente_signature_description",
    icon: "✍️"
  },
  "transmis_a_ac": {
    phaseKey: "status_transmis_a_ac_phase",
    explicationKey: "status_transmis_a_ac_explication",
    etape: 10,
    rang: 1005,
    descriptionKey: "status_transmis_a_ac_description",
    icon: "📬"
  },
  "a_verifier_avant_insertion_decret": {
    phaseKey: "status_a_verifier_avant_insertion_decret_phase",
    explicationKey: "status_a_verifier_avant_insertion_decret_explication",
    etape: 10,
    rang: 1006,
    descriptionKey: "status_a_verifier_avant_insertion_decret_description",
    icon: "🔎"
  },
  "prete_pour_insertion_decret": {
    phaseKey: "status_prete_pour_insertion_decret_phase",
    explicationKey: "status_prete_pour_insertion_decret_explication",
    etape: 10,
    rang: 1007,
    descriptionKey: "status_prete_pour_insertion_decret_description",
    icon: "✅"
  },
  "decret_en_preparation": {
    phaseKey: "status_decret_en_preparation_phase",
    explicationKey: "status_decret_en_preparation_explication",
    etape: 10,
    rang: 1008,
    descriptionKey: "status_decret_en_preparation_description",
    icon: "📋"
  },
  "decret_a_qualifier": {
    phaseKey: "status_decret_a_qualifier_phase",
    explicationKey: "status_decret_a_qualifier_explication",
    etape: 10,
    rang: 1009,
    descriptionKey: "status_decret_a_qualifier_description",
    icon: "📋"
  },
  "decret_en_validation": {
    phaseKey: "status_decret_en_validation_phase",
    explicationKey: "status_decret_en_validation_explication",
    etape: 10,
    rang: 1010,
    descriptionKey: "status_decret_en_validation_description",
    icon: "📋"
  },

  // ── Étape 11 : Publication JO ────────────────────────────────
  "inseree_dans_decret": {
    phaseKey: "status_inseree_dans_decret_phase",
    explicationKey: "status_inseree_dans_decret_explication",
    etape: 11,
    rang: 1101,
    descriptionKey: "status_inseree_dans_decret_description",
    icon: "🎉"
  },
  "decret_envoye_prefecture": {
    phaseKey: "status_decret_envoye_prefecture_phase",
    explicationKey: "status_decret_envoye_prefecture_explication",
    etape: 11,
    rang: 1102,
    descriptionKey: "status_decret_envoye_prefecture_description",
    icon: "📨"
  },
  "notification_envoyee": {
    phaseKey: "status_notification_envoyee_phase",
    explicationKey: "status_notification_envoyee_explication",
    etape: 11,
    rang: 1103,
    descriptionKey: "status_notification_envoyee_description",
    icon: "📬"
  },

  // ── Étape 12 : Décision finale ───────────────────────────────
  // Décisions positives
  "decret_naturalisation_publie": {
    phaseKey: "status_decret_naturalisation_publie_phase",
    explicationKey: "status_decret_naturalisation_publie_explication",
    etape: 12,
    rang: 1201,
    descriptionKey: "status_decret_naturalisation_publie_description",
    icon: "🇫🇷"
  },
  "decret_naturalisation_publie_jo": {
    phaseKey: "status_decret_naturalisation_publie_jo_phase",
    explicationKey: "status_decret_naturalisation_publie_jo_explication",
    etape: 12,
    rang: 1202,
    descriptionKey: "status_decret_naturalisation_publie_jo_description",
    icon: "🇫🇷"
  },
  "decret_publie": {
    phaseKey: "status_decret_publie_phase",
    explicationKey: "status_decret_publie_explication",
    etape: 12,
    rang: 1203,
    descriptionKey: "status_decret_publie_description",
    icon: "🇫🇷"
  },
  "demande_traitee": {
    phaseKey: "status_demande_traitee_phase",
    explicationKey: "status_demande_traitee_explication",
    etape: 12,
    rang: 1204,
    descriptionKey: "status_demande_traitee_description",
    icon: "✅"
  },
  // Décisions négatives
  "decision_negative_en_delais_recours": {
    phaseKey: "status_decision_negative_en_delais_recours_phase",
    explicationKey: "status_decision_negative_en_delais_recours_explication",
    etape: 12,
    rang: 1205,
    descriptionKey: "status_decision_negative_en_delais_recours_description",
    icon: "❌"
  },
  "decision_notifiee": {
    phaseKey: "status_decision_notifiee_phase",
    explicationKey: "status_decision_notifiee_explication",
    etape: 12,
    rang: 1206,
    descriptionKey: "status_decision_notifiee_description",
    icon: "❌"
  },
  "demande_en_cours_rapo": {
    phaseKey: "status_demande_en_cours_rapo_phase",
    explicationKey: "status_demande_en_cours_rapo_explication",
    etape: 12,
    rang: 1207,
    descriptionKey: "status_demande_en_cours_rapo_description",
    icon: "⚖️"
  },
  "controle_demande_notifiee": {
    phaseKey: "status_controle_demande_notifiee_phase",
    explicationKey: "status_controle_demande_notifiee_explication",
    etape: 12,
    rang: 1208,
    descriptionKey: "status_controle_demande_notifiee_description",
    icon: "📬"
  },
  // Irrecevabilité
  "irrecevabilite_manifeste": {
    phaseKey: "status_irrecevabilite_manifeste_phase",
    explicationKey: "status_irrecevabilite_manifeste_explication",
    etape: 12,
    rang: 1209,
    descriptionKey: "status_irrecevabilite_manifeste_description",
    icon: "❌"
  },
  "irrecevabilite_manifeste_en_delais_recours": {
    phaseKey: "status_irrecevabilite_manifeste_en_delais_recours_phase",
    explicationKey: "status_irrecevabilite_manifeste_en_delais_recours_explication",
    etape: 12,
    rang: 1210,
    descriptionKey: "status_irrecevabilite_manifeste_en_delais_recours_description",
    icon: "❌"
  },
  // Classement sans suite
  "css_en_delais_recours": {
    phaseKey: "status_css_en_delais_recours_phase",
    explicationKey: "status_css_en_delais_recours_explication",
    etape: 12,
    rang: 1211,
    descriptionKey: "status_css_en_delais_recours_description",
    icon: "⚠️"
  },
  "css_notifie": {
    phaseKey: "status_css_notifie_phase",
    explicationKey: "status_css_notifie_explication",
    etape: 12,
    rang: 1212,
    descriptionKey: "status_css_notifie_description",
    icon: "⚠️"
  }
};

/** Étapes principales avec leur statut canonique pour la saisie manuelle */
export const STEP_DEFAULTS = [
  { etape: 2, statut: 'dossier_depose', label: t('step_dossier_depose_label'), code: 'dossier_depose', icon: '📨', locked: true },
  { etape: 7, statut: 'ea_en_attente_ea', label: t('step_ea_en_attente_ea_label'), code: 'ea_en_attente_ea', icon: '🗣️', locked: true },
  { etape: 9, statut: 'controle_a_affecter', label: t('step_controle_a_affecter_label'), code: 'controle_a_affecter', icon: '🏛️', sub: '9.1' },
  { etape: 9, statut: 'controle_a_effectuer', label: t('step_controle_a_effectuer_label'), code: 'controle_a_effectuer', icon: '📑', sub: '9.2' },
  { etape: 9, statut: 'controle_en_attente_pec', label: t('step_controle_en_attente_pec_label'), code: 'controle_en_attente_pec', icon: '🏛️', sub: '9.3' },
  { etape: 10, statut: 'prete_pour_insertion_decret', label: t('step_prete_pour_insertion_decret_label'), code: 'prete_pour_insertion_decret', icon: '✅', sub: '10.7' },
  { etape: 11, statut: 'inseree_dans_decret', label: t('step_inseree_dans_decret_label'), code: 'inseree_dans_decret', icon: '📜', sub: '11.1' },
  { etape: 12, statut: 'decret_naturalisation_publie', label: t('step_decret_naturalisation_publie_label'), code: 'decret_naturalisation_publie', icon: '🇫🇷' }
];

// ─────────────────────────────────────────────────────────────
// Fonctions utilitaires
// ─────────────────────────────────────────────────────────────

/** Récupère les informations d'un statut */
export function getStatusExplanation(statutCode) {
  const code = String(statutCode || '').toLowerCase().trim();
  const info = STATUTS[code];

  if (info) {
    return {
      ...info,
      phase: t(info.phaseKey),
      explication: t(info.explicationKey),
      description: t(info.descriptionKey),
      found: true,
      code
    };
  }

  return {
    phase: t("status_unknown_phase"),
    explication: statutCode || t("status_unknown_explication"),
    etape: 0,
    rang: 0,
    description: t("status_unknown_description"),
    icon: "❓",
    found: false,
    code
  };
}

/** Formate une durée en jours */
export function formatDuration(jours) {
  if (jours === 0) return t("duration_today");
  if (!jours || jours < 0) return "—";

  const annees = Math.floor(jours / 365);
  const mois = Math.floor((jours % 365) / 30);
  const joursRestants = Math.floor((jours % 365) % 30);

  const parts = [];
  if (annees > 0) parts.push(annees > 1 ? t('duration_year_other', [annees.toString()]) : t('duration_year_one', [annees.toString()]));
  if (mois > 0) parts.push(t('duration_month', [mois.toString()]));
  if (joursRestants > 0 || parts.length === 0) {
    parts.push(joursRestants > 1 ? t('duration_day_other', [joursRestants.toString()]) : t('duration_day_one', [joursRestants.toString()]));
  }

  return parts.join(', ');
}

/** Calcule le nombre de jours calendaires depuis une date (fuseau français) */
export function daysSince(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date)) return null;
    // Comparer les dates calendaires en fuseau français, pas les millisecondes brutes
    const fmt = new Intl.DateTimeFormat('fr-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = fmt.format(new Date());
    const dateLocalStr = fmt.format(date);
    const todayMs = new Date(todayStr).getTime();
    const dateMs = new Date(dateLocalStr).getTime();
    const diff = todayMs - dateMs;
    return diff >= 0 ? Math.round(diff / 86400000) : null;
  } catch {
    return null;
  }
}

// Fuseau horaire français
const TIMEZONE = 'Europe/Paris';

/** Formate une date selon la locale */
export function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date)) return "—";

    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: TIMEZONE
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return date.toLocaleDateString(getLocale(), options);
  } catch {
    return "—";
  }
}

/** Formate une date courte (ex: "1 janv., 14:30") */
export function formatDateShort(date) {
  return new Date(date).toLocaleString(getLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE
  });
}

/** Formate un timestamp pour les logs (ex: "01/02/2026 14:30:45") */
export function formatTimestamp(date = new Date()) {
  return date.toLocaleString(getLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: TIMEZONE
  }).replace(',', '');
}

/** Formate l'heure seule (ex: "14:30:45") */
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: TIMEZONE
  });
}

/** Formate un rang en sous-étape lisible (ex: 903 → "9.3", 100 → "1") */
export function formatSubStep(rang) {
  var sub = rang % 100;
  var step = Math.floor(rang / 100);
  return sub === 0 ? String(step) : step + '.' + sub;
}

/** Extrait l'étape majeure depuis un rang (ex: 903 → 9) */
export function rangToStep(rang) {
  return Math.floor(rang / 100);
}

/** Récupère le rang d'un code statut */
export function getRang(statutCode) {
  const code = String(statutCode || '').toLowerCase().trim();
  const info = STATUTS[code];
  return info ? info.rang : 0;
}

/** Retourne la couleur associée à une étape */
export function getStepColor(etape) {
  if (etape <= 2) return '#6b7280';  // Gris - Début
  if (etape <= 5) return '#3b82f6';  // Bleu - En cours
  if (etape <= 8) return '#8b5cf6';  // Violet - Avancé
  if (etape <= 11) return '#f59e0b'; // Orange - Presque fini
  return '#10b981';                   // Vert - Terminé
}

/** Vérifie si un statut est positif (naturalisation obtenue) */
export function isPositiveStatus(statutCode) {
  const code = String(statutCode || '').toLowerCase().trim();
  return ['decret_naturalisation_publie', 'decret_naturalisation_publie_jo', 'decret_publie', 'demande_traitee'].includes(code);
}

/** Vérifie si un statut est négatif (refus/irrecevabilité) */
export function isNegativeStatus(statutCode) {
  const code = String(statutCode || '').toLowerCase().trim();
  return code.includes('negative') || code.includes('irrecevabilite') ||
    code === 'css_en_delais_recours' || code === 'css_notifie';
}

export { STATUTS };
