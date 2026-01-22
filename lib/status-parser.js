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
    description: "Votre dossier est en cours de préparation sur la plateforme ANEF. Complétez toutes les sections et joignez les pièces justificatives requises avant de soumettre.",
    icon: "📝"
  },
  "dossier_depose": {
    phase: "Dépôt",
    explication: "Dossier déposé",
    etape: 2,
    description: "Votre dossier a été soumis avec succès. Il est maintenant dans la file d'attente de la préfecture pour un premier examen de recevabilité.",
    icon: "📨"
  },

  // Vérification formelle
  "verification_formelle_a_traiter": {
    phase: "Vérification préfecture",
    explication: "En file d'attente",
    etape: 3,
    description: "La préfecture a bien reçu votre demande. Elle est placée en file d'attente pour le premier tri administratif (vérification des pièces obligatoires et conditions de base).",
    icon: "🔍"
  },
  "verification_formelle_en_cours": {
    phase: "Vérification préfecture",
    explication: "Vérification en cours",
    etape: 3,
    description: "Un agent vérifie l'admissibilité formelle de votre dossier : présence des documents requis, validité des pièces, conditions légales. Des compléments peuvent être demandés.",
    icon: "🔍"
  },
  "verification_formelle_mise_en_demeure": {
    phase: "Vérification préfecture",
    explication: "Mise en demeure",
    etape: 3,
    description: "Des documents obligatoires sont manquants ou non conformes. Vous allez recevoir un courrier détaillant les pièces à fournir. Répondez dans le délai imparti pour éviter un rejet.",
    icon: "⚠️"
  },
  "instruction_a_affecter": {
    phase: "Demande déposée",
    explication: "Attente d'affectation",
    etape: 4,
    description: "Votre dossier a passé la vérification formelle avec succès ! Il attend maintenant d'être attribué à un agent instructeur pour un examen approfondi. Vous recevrez un récépissé de dépôt.",
    icon: "👤"
  },

  // Récépissé de complétude
  "instruction_recepisse_completude_a_envoyer": {
    phase: "Instruction",
    explication: "Lecture approfondie",
    etape: 5,
    description: "Un agent instructeur examine en détail votre dossier : situation personnelle, professionnelle, fiscale, assimilation. Il peut vous convoquer pour l'entretien d'assimilation.",
    icon: "📖"
  },
  "instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter": {
    phase: "Instruction",
    explication: "Compléments à vérifier",
    etape: 5,
    description: "Vous avez fourni des documents complémentaires suite à une demande. L'agent vérifie leur conformité avant de poursuivre l'instruction de votre dossier.",
    icon: "📋"
  },

  // Entretien
  "instruction_date_ea_a_fixer": {
    phase: "Récépissé de complétude",
    explication: "Enquêtes lancées",
    etape: 6,
    description: "Votre dossier est officiellement complet ! Les enquêtes administratives obligatoires sont lancées (casier judiciaire, renseignements, fichiers). La date d'entretien sera fixée prochainement.",
    icon: "🔎"
  },
  "ea_demande_report_ea": {
    phase: "Entretien",
    explication: "Demande de report",
    etape: 6,
    description: "Une demande de report de l'entretien d'assimilation a été enregistrée. La préfecture vous proposera une nouvelle date. Attention aux délais pour ne pas retarder votre dossier.",
    icon: "🔄"
  },
  "ea_en_attente_ea": {
    phase: "Entretien",
    explication: "Convocation envoyée",
    etape: 7,
    description: "Votre convocation à l'entretien d'assimilation est envoyée ou disponible. Préparez-vous : questions sur la France (histoire, culture, valeurs), votre parcours et motivations.",
    icon: "📬"
  },
  "ea_crea_a_valider": {
    phase: "Entretien passé",
    explication: "Compte-rendu en rédaction",
    etape: 7,
    description: "Vous avez passé l'entretien d'assimilation ! L'agent rédige le compte-rendu évaluant votre niveau de langue, connaissance de la France et assimilation à la communauté française.",
    icon: "✅"
  },

  // Décision préfecture
  "prop_decision_pref_a_effectuer": {
    phase: "Décision préfecture",
    explication: "Avis en cours",
    etape: 8,
    description: "L'agent instructeur analyse l'ensemble de votre dossier (enquêtes, entretien, pièces) pour formuler sa proposition d'avis : favorable, défavorable ou ajournement.",
    icon: "⚖️"
  },
  "prop_decision_pref_en_attente_retour_hierarchique": {
    phase: "Décision préfecture",
    explication: "Validation hiérarchique",
    etape: 8,
    description: "La proposition de l'agent est soumise à sa hiérarchie pour validation. Cette étape permet de confirmer l'avis avant transmission au préfet. Durée variable selon les préfectures.",
    icon: "👔"
  },
  "prop_decision_pref_prop_a_editer": {
    phase: "Décision préfecture",
    explication: "Mise au propre",
    etape: 8,
    description: "L'avis est validé et le document officiel de proposition est en cours de rédaction. Il résume votre situation et la recommandation de la préfecture au ministère.",
    icon: "📝"
  },
  "prop_decision_pref_en_attente_retour_signataire": {
    phase: "Décision préfecture",
    explication: "Attente signature préfet",
    etape: 8,
    description: "Le document de proposition est finalisé et transmis au préfet (ou son représentant) pour signature. Une fois signé, votre dossier sera envoyé au ministère de l'Intérieur.",
    icon: "✍️"
  },

  // Contrôle SDANF
  "controle_a_affecter": {
    phase: "Contrôle ministériel",
    explication: "Arrivé aux services centraux",
    etape: 9,
    description: "Votre dossier est arrivé à la Sous-Direction de l'Accès à la Nationalité Française (SDANF) à Rezé. Il attend d'être attribué à un agent pour le contrôle ministériel.",
    icon: "🏛️"
  },
  "controle_a_effectuer": {
    phase: "Contrôle ministériel",
    explication: "Contrôle en cours",
    etape: 9,
    description: "Un agent du ministère contrôle votre dossier : vérification des pièces d'état civil, cohérence des informations, respect des conditions légales. Cette étape peut prendre plusieurs semaines.",
    icon: "📑"
  },
  "controle_en_attente_pec": {
    phase: "Contrôle SCEC",
    explication: "Attente validation SCEC",
    etape: 9,
    description: "Le Service Central d'État Civil (SCEC) de Nantes vérifie l'authenticité de vos actes d'état civil étrangers. Cette vérification est obligatoire pour valider votre identité.",
    icon: "🏛️"
  },
  "controle_pec_a_faire": {
    phase: "Contrôle SCEC",
    explication: "Validation en cours",
    etape: 9,
    description: "Le SCEC procède à la vérification de vos pièces d'état civil. Une fois validées, vos actes seront transcrits dans les registres français si votre naturalisation aboutit.",
    icon: "✔️"
  },
  "controle_transmise_pour_decret": {
    phase: "Décret",
    explication: "Transmis pour décret",
    etape: 10,
    description: "Excellente nouvelle ! L'avis est FAVORABLE. Votre dossier est transmis au service des décrets pour être inclus dans un prochain décret de naturalisation. La fin approche !",
    icon: "🎉"
  },
  "controle_en_attente_retour_hierarchique": {
    phase: "Décret",
    explication: "Attente retour hiérarchique",
    etape: 10,
    description: "Le projet de décret incluant votre demande est soumis à la validation de la hiérarchie ministérielle. Étape administrative normale avant la finalisation du décret.",
    icon: "👔"
  },
  "controle_decision_a_editer": {
    phase: "Décret",
    explication: "Édition prochaine",
    etape: 10,
    description: "La décision favorable est confirmée. Le document officiel du décret incluant votre nom est en cours d'édition. Vous serez bientôt inscrit(e) dans un décret de naturalisation.",
    icon: "📄"
  },
  "controle_en_attente_signature": {
    phase: "Décret",
    explication: "Attente de signature",
    etape: 10,
    description: "Le décret de naturalisation est finalisé et attend la signature du ministre ou de son représentant. Une fois signé, il sera publié au Journal Officiel.",
    icon: "✍️"
  },

  // Traitement décret
  "transmis_a_ac": {
    phase: "Service décret",
    explication: "Transmis au service décret",
    etape: 10,
    description: "Votre dossier favorable est transmis à l'administration centrale chargée de préparer les décrets. Vous êtes dans la dernière ligne droite de la procédure !",
    icon: "📬"
  },
  "a_verifier_avant_insertion_decret": {
    phase: "Service décret",
    explication: "Vérification avant insertion",
    etape: 10,
    description: "Dernières vérifications administratives avant l'insertion de votre nom dans un décret. On s'assure qu'aucun élément nouveau ne s'oppose à votre naturalisation.",
    icon: "🔎"
  },
  "prete_pour_insertion_decret": {
    phase: "Décision favorable",
    explication: "Signé par le Ministre",
    etape: 10,
    description: "Votre décision favorable a été signée par le Ministre ! Votre nom va être inséré dans le prochain décret de naturalisation. Publication au Journal Officiel imminente.",
    icon: "✅"
  },
  "decret_en_preparation": {
    phase: "Décret",
    explication: "Décret en préparation",
    etape: 10,
    description: "Un décret de naturalisation incluant votre nom est en cours de préparation. Plusieurs dossiers sont regroupés dans chaque décret avant publication au Journal Officiel.",
    icon: "📋"
  },
  "inseree_dans_decret": {
    phase: "Inséré dans décret",
    explication: "Attente signature ministérielle",
    etape: 11,
    description: "Votre nom est officiellement inscrit dans un décret de naturalisation ! Il attend maintenant la signature finale du Premier ministre pour publication au Journal Officiel.",
    icon: "🎉"
  },
  "decret_envoye_prefecture": {
    phase: "Publication",
    explication: "Décret envoyé à la préfecture",
    etape: 11,
    description: "Le décret signé a été transmis à votre préfecture. Elle va vous convoquer pour la cérémonie d'accueil et la remise de votre décret de naturalisation.",
    icon: "📨"
  },
  "notification_envoyee": {
    phase: "Publication",
    explication: "Notification envoyée",
    etape: 11,
    description: "La notification officielle de votre naturalisation vous a été envoyée. Vous serez convoqué(e) à la cérémonie d'accueil dans la citoyenneté française.",
    icon: "📬"
  },

  // Décisions finales positives
  "decret_naturalisation_publie": {
    phase: "NATURALISÉ(E)",
    explication: "Publié au Journal Officiel",
    etape: 12,
    description: "FÉLICITATIONS ! Votre décret est publié au Journal Officiel de la République Française. Vous êtes officiellement français(e) ! Bienvenue dans la communauté nationale 🇫🇷",
    icon: "🇫🇷"
  },
  "decret_naturalisation_publie_jo": {
    phase: "NATURALISÉ(E)",
    explication: "Publié au Journal Officiel",
    etape: 12,
    description: "FÉLICITATIONS ! Votre décret est publié au Journal Officiel de la République Française. Vous êtes officiellement français(e) ! Bienvenue dans la communauté nationale 🇫🇷",
    icon: "🇫🇷"
  },
  "decret_publie": {
    phase: "NATURALISÉ(E)",
    explication: "Décret publié",
    etape: 12,
    description: "FÉLICITATIONS ! Votre décret de naturalisation est publié. Vous êtes officiellement citoyen(ne) français(e) ! La préfecture vous convoquera pour la cérémonie d'accueil.",
    icon: "🇫🇷"
  },
  "demande_traitee": {
    phase: "Finalisé",
    explication: "Demande finalisée",
    etape: 12,
    description: "Votre demande de naturalisation a été entièrement traitée. Consultez vos courriers ou contactez votre préfecture pour connaître l'issue de votre dossier.",
    icon: "✅"
  },

  // Décisions négatives
  "decision_negative_en_delais_recours": {
    phase: "Décision négative",
    explication: "En délais de recours",
    etape: 12,
    description: "Votre demande a reçu une décision défavorable. Vous disposez d'un délai de 2 mois pour former un recours gracieux auprès du ministre ou un recours contentieux devant le tribunal administratif.",
    icon: "❌"
  },
  "irrecevabilite_manifeste": {
    phase: "Irrecevabilité",
    explication: "Irrecevabilité manifeste",
    etape: 12,
    description: "Votre demande ne remplit pas les conditions légales de recevabilité (résidence, durée de séjour, etc.). Vérifiez les critères d'éligibilité avant de déposer une nouvelle demande.",
    icon: "❌"
  },
  "irrecevabilite_manifeste_en_delais_recours": {
    phase: "Irrecevabilité",
    explication: "En délais de recours",
    etape: 12,
    description: "Votre demande a été déclarée irrecevable. Vous pouvez contester cette décision par un recours gracieux ou contentieux dans un délai de 2 mois.",
    icon: "❌"
  },
  "css_en_delais_recours": {
    phase: "Classement sans suite",
    explication: "En délais de recours",
    etape: 12,
    description: "Votre dossier a été classé sans suite (pièces non fournies, délai dépassé, etc.). Vous pouvez former un recours ou déposer une nouvelle demande complète.",
    icon: "⚠️"
  },
  "css_notifie": {
    phase: "Classement sans suite",
    explication: "Notifié",
    etape: 12,
    description: "Le classement sans suite de votre dossier vous a été officiellement notifié. Analysez les motifs indiqués avant d'envisager une nouvelle demande.",
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
    const diff = new Date() - date;
    // Math.ceil pour arrondir vers le haut (ex: 10.3 jours → 11 jours)
    return diff >= 0 ? Math.ceil(diff / 86400000) : null;
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
  return ['decret_naturalisation_publie', 'decret_naturalisation_publie_jo', 'decret_publie', 'demande_traitee'].includes(code);
}

/** Vérifie si un statut est négatif (refus/irrecevabilité) */
export function isNegativeStatus(statutCode) {
  const code = String(statutCode || '').toLowerCase().trim();
  return code.includes('negative') || code.includes('irrecevabilite') || code.includes('css_');
}

export { STATUTS };
