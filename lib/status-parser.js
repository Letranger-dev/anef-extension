/**
 * Dictionnaire des statuts ANEF - Extension ANEF Status Tracker
 *
 * Contient tous les codes de statut possibles avec :
 * - Phase (étape du processus)
 * - Explication simple
 * - Description détaillée
 * - Numéro d'étape (1-12)
 */

const STATUTS = {
  // Brouillon & Dépôt
  "draft": {
    phase: "Préparation",
    explication: "Dossier en brouillon",
    etape: 1,
    description: "Votre dossier est en cours de préparation.",
    icon: "📝"
  },
  "dossier_depose": {
    phase: "Dépôt",
    explication: "Dossier déposé",
    etape: 2,
    description: "Votre dossier a été déposé et attend d'être traité.",
    icon: "📨"
  },

  // Vérification formelle
  "verification_formelle_a_traiter": {
    phase: "Vérification préfecture",
    explication: "Vérification à traiter",
    etape: 3,
    description: "La préfecture va vérifier la conformité de votre dossier.",
    icon: "🔍"
  },
  "verification_formelle_en_cours": {
    phase: "Vérification préfecture",
    explication: "Vérification en cours",
    etape: 3,
    description: "La préfecture examine si votre dossier est complet.",
    icon: "🔍"
  },
  "verification_formelle_mise_en_demeure": {
    phase: "Vérification préfecture",
    explication: "Mise en demeure",
    etape: 3,
    description: "Des documents manquent. Vous recevrez une demande de compléments.",
    icon: "⚠️"
  },
  "instruction_a_affecter": {
    phase: "Affectation",
    explication: "Attente d'affectation",
    etape: 4,
    description: "Votre dossier va être assigné à un agent instructeur.",
    icon: "👤"
  },

  // Récépissé de complétude
  "instruction_recepisse_completude_a_envoyer": {
    phase: "Récépissé",
    explication: "Récépissé à envoyer",
    etape: 5,
    description: "Votre dossier est complet. Un récépissé va vous être envoyé.",
    icon: "✅"
  },
  "instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter": {
    phase: "Récépissé",
    explication: "Compléments à vérifier",
    etape: 5,
    description: "Vos documents complémentaires sont en cours de vérification.",
    icon: "📋"
  },

  // Entretien
  "instruction_date_ea_a_fixer": {
    phase: "Entretien",
    explication: "Date d'entretien à fixer",
    etape: 6,
    description: "La préfecture va vous proposer une date d'entretien.",
    icon: "📅"
  },
  "ea_demande_report_ea": {
    phase: "Entretien",
    explication: "Demande de report",
    etape: 6,
    description: "Une demande de report d'entretien a été effectuée.",
    icon: "🔄"
  },
  "ea_en_attente_ea": {
    phase: "Entretien",
    explication: "Attente de convocation",
    etape: 6,
    description: "Vous allez recevoir votre convocation pour l'entretien.",
    icon: "⏳"
  },
  "ea_crea_a_valider": {
    phase: "Entretien",
    explication: "Compte-rendu à valider",
    etape: 6,
    description: "Entretien passé ! Le compte-rendu est en cours de validation.",
    icon: "✅"
  },

  // Décision préfecture
  "prop_decision_pref_a_effectuer": {
    phase: "Décision préfecture",
    explication: "Décision à effectuer",
    etape: 7,
    description: "La préfecture va prendre une décision sur votre dossier.",
    icon: "⚖️"
  },
  "prop_decision_pref_en_attente_retour_hierarchique": {
    phase: "Décision préfecture",
    explication: "Attente retour hiérarchique",
    etape: 7,
    description: "La décision attend validation hiérarchique.",
    icon: "👔"
  },
  "prop_decision_pref_prop_a_editer": {
    phase: "Décision préfecture",
    explication: "Rédaction en cours",
    etape: 7,
    description: "La décision est prise, le document est en cours de rédaction.",
    icon: "📝"
  },
  "prop_decision_pref_en_attente_retour_signataire": {
    phase: "Décision préfecture",
    explication: "Attente de signature",
    etape: 7,
    description: "Le document attend la signature du responsable.",
    icon: "✍️"
  },

  // Contrôle SDANF
  "controle_a_affecter": {
    phase: "Contrôle SDANF",
    explication: "Transmis à la SDANF",
    etape: 8,
    description: "Dossier transmis à la Sous-Direction de l'Accès à la Nationalité.",
    icon: "🎯"
  },
  "controle_a_effectuer": {
    phase: "Contrôle SDANF",
    explication: "Contrôle état civil",
    etape: 8,
    description: "Vérification de vos pièces d'état civil en cours.",
    icon: "📑"
  },
  "controle_en_attente_pec": {
    phase: "Contrôle SCEC",
    explication: "Attente validation SCEC",
    etape: 8,
    description: "Le Service Central d'État Civil vérifie vos documents.",
    icon: "🏛️"
  },
  "controle_pec_a_faire": {
    phase: "Contrôle SCEC",
    explication: "Validation en cours",
    etape: 8,
    description: "Le SCEC valide vos pièces d'état civil.",
    icon: "✔️"
  },
  "controle_transmise_pour_decret": {
    phase: "Décret",
    explication: "Transmis pour décret",
    etape: 9,
    description: "Avis favorable ! Dossier transmis pour préparation du décret.",
    icon: "🎉"
  },
  "controle_en_attente_retour_hierarchique": {
    phase: "Décret",
    explication: "Attente retour hiérarchique",
    etape: 9,
    description: "Le projet de décret attend validation hiérarchique.",
    icon: "👔"
  },
  "controle_decision_a_editer": {
    phase: "Décret",
    explication: "Édition prochaine",
    etape: 9,
    description: "La décision est prise, le document va être édité.",
    icon: "📄"
  },
  "controle_en_attente_signature": {
    phase: "Décret",
    explication: "Attente de signature",
    etape: 9,
    description: "Le décret attend la signature officielle.",
    icon: "✍️"
  },

  // Traitement décret
  "transmis_a_ac": {
    phase: "Service décret",
    explication: "Transmis au service décret",
    etape: 10,
    description: "Dossier transmis au service en charge des décrets.",
    icon: "📬"
  },
  "a_verifier_avant_insertion_decret": {
    phase: "Service décret",
    explication: "Vérification avant insertion",
    etape: 10,
    description: "Dernières vérifications avant insertion dans un décret.",
    icon: "🔎"
  },
  "prete_pour_insertion_decret": {
    phase: "Service décret",
    explication: "Prêt pour insertion",
    etape: 10,
    description: "Prêt à être inséré dans un décret de naturalisation.",
    icon: "✅"
  },
  "decret_en_preparation": {
    phase: "Décret",
    explication: "Décret en préparation",
    etape: 10,
    description: "Le décret de naturalisation est en cours de préparation.",
    icon: "📋"
  },
  "inseree_dans_decret": {
    phase: "Service décret",
    explication: "Inséré dans un décret",
    etape: 11,
    description: "Votre demande a été insérée dans un décret !",
    icon: "🎉"
  },
  "decret_envoye_prefecture": {
    phase: "Publication",
    explication: "Décret envoyé à la préfecture",
    etape: 11,
    description: "Le décret signé a été envoyé à votre préfecture.",
    icon: "📨"
  },
  "notification_envoyee": {
    phase: "Publication",
    explication: "Notification envoyée",
    etape: 11,
    description: "La notification de naturalisation vous a été envoyée.",
    icon: "📬"
  },

  // Décisions finales positives
  "decret_naturalisation_publie": {
    phase: "NATURALISÉ(E)",
    explication: "Décret publié",
    etape: 12,
    description: "FÉLICITATIONS ! Votre décret est publié au Journal Officiel !",
    icon: "🎉"
  },
  "decret_publie": {
    phase: "NATURALISÉ(E)",
    explication: "Décret publié",
    etape: 12,
    description: "FÉLICITATIONS ! Vous êtes français(e) !",
    icon: "🎉"
  },
  "demande_traitee": {
    phase: "Finalisé",
    explication: "Demande finalisée",
    etape: 12,
    description: "Votre demande a été entièrement traitée.",
    icon: "✅"
  },

  // Décisions négatives
  "decision_negative_en_delais_recours": {
    phase: "Décision négative",
    explication: "En délais de recours",
    etape: 12,
    description: "Décision défavorable. Vous pouvez former un recours.",
    icon: "❌"
  },
  "irrecevabilite_manifeste": {
    phase: "Irrecevabilité",
    explication: "Irrecevabilité manifeste",
    etape: 12,
    description: "Votre demande a été jugée irrecevable.",
    icon: "❌"
  },
  "irrecevabilite_manifeste_en_delais_recours": {
    phase: "Irrecevabilité",
    explication: "En délais de recours",
    etape: 12,
    description: "Irrecevabilité prononcée. Vous pouvez former un recours.",
    icon: "❌"
  },
  "css_en_delais_recours": {
    phase: "Classement sans suite",
    explication: "En délais de recours",
    etape: 12,
    description: "Classement sans suite. Délai de recours en cours.",
    icon: "⚠️"
  },
  "css_notifie": {
    phase: "Classement sans suite",
    explication: "Notifié",
    etape: 12,
    description: "Le classement sans suite vous a été notifié.",
    icon: "⚠️"
  }
};

// ─────────────────────────────────────────────────────────────
// Fonctions utilitaires
// ─────────────────────────────────────────────────────────────

/** Récupère les informations d'un statut */
export function getStatusExplanation(statutCode) {
  const code = String(statutCode || '').toLowerCase().trim();
  const info = STATUTS[code];

  if (info) {
    return { ...info, found: true, code };
  }

  return {
    phase: "Statut inconnu",
    explication: statutCode || "Non disponible",
    etape: 0,
    description: "Statut non répertorié. Contactez votre préfecture.",
    icon: "❓",
    found: false,
    code
  };
}

/** Formate une durée en jours */
export function formatDuration(jours) {
  if (!jours || jours < 0) return "—";

  const annees = Math.floor(jours / 365);
  const mois = Math.floor((jours % 365) / 30);
  const joursRestants = Math.floor((jours % 365) % 30);

  const parts = [];
  if (annees > 0) parts.push(`${annees} an${annees > 1 ? 's' : ''}`);
  if (mois > 0) parts.push(`${mois} mois`);
  if (joursRestants > 0 || parts.length === 0) {
    parts.push(`${joursRestants} jour${joursRestants > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/** Calcule le nombre de jours depuis une date */
export function daysSince(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date)) return null;
    return Math.floor((new Date() - date) / 86400000);
  } catch {
    return null;
  }
}

/** Formate une date en français */
export function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (isNaN(date)) return "—";

    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Europe/Paris'
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return date.toLocaleDateString('fr-FR', options);
  } catch {
    return "—";
  }
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
  return ['decret_naturalisation_publie', 'decret_publie', 'demande_traitee'].includes(code);
}

/** Vérifie si un statut est négatif (refus/irrecevabilité) */
export function isNegativeStatus(statutCode) {
  const code = String(statutCode || '').toLowerCase().trim();
  return code.includes('negative') || code.includes('irrecevabilite') || code.includes('css_');
}

export { STATUTS };
