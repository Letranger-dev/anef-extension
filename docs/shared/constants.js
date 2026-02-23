/**
 * shared/constants.js — Constantes globales ANEF
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  var SITE_VERSION = '1.12.0';

  // Palette par étape (index = numéro d'étape)
  const STEP_COLORS = [
    '#6b7280', // 0 - inconnu
    '#6b7280', // 1 - Brouillon
    '#6b7280', // 2 - Dépôt du dossier
    '#3b82f6', // 3 - Vérification formelle
    '#3b82f6', // 4 - Affectation instructeur
    '#3b82f6', // 5 - Instruction du dossier
    '#8b5cf6', // 6 - Complétude & enquêtes
    '#8b5cf6', // 7 - Entretien d'assimilation
    '#8b5cf6', // 8 - Décision préfecture
    '#f59e0b', // 9 - Contrôle SDANF & SCEC
    '#f59e0b', // 10 - Préparation décret
    '#f59e0b', // 11 - Publication JO
    '#10b981'  // 12 - Décision finale
  ];

  const PHASE_NAMES = {
    1: 'Brouillon',
    2: 'Dépôt du dossier',
    3: 'Vérification formelle',
    4: 'Affectation instructeur',
    5: 'Instruction du dossier',
    6: 'Complétude & enquêtes',
    7: 'Entretien d\'assimilation',
    8: 'Décision préfecture',
    9: 'Contrôle SDANF & SCEC',
    10: 'Préparation décret',
    11: 'Publication JO',
    12: 'Décision finale'
  };

  const PHASE_SHORT = {
    1: 'Brouillon',
    2: 'Dépôt',
    3: 'Vérif.',
    4: 'Affect.',
    5: 'Instruction',
    6: 'Complétude',
    7: 'Entretien',
    8: 'Décision',
    9: 'Contrôle',
    10: 'Décret',
    11: 'Publication',
    12: 'Clôture'
  };

  const STEP_RANGES = {
    '1-2': [1, 2],
    '3-5': [3, 4, 5],
    '6-8': [6, 7, 8],
    '9-11': [9, 10, 11],
    '12-12': [12]
  };

  // Dictionnaire complet des statuts ANEF
  // Sources : mhk-avocats.com, franceprefecture.fr, easytrangers.com, prefecture-rendez-vous.fr
  var STATUTS = {
    // ── Étape 1 : Brouillon ──────────────────────────────────────
    "draft": {
      phase: "Brouillon", explication: "Dossier en brouillon", etape: 1, rang: 100,
      description: "Votre dossier est en cours de préparation sur la plateforme ANEF. Complétez toutes les sections et joignez les pièces justificatives avant de soumettre.",
      icon: "\uD83D\uDCDD"
    },

    // ── Étape 2 : Dépôt du dossier ───────────────────────────────
    "dossier_depose": {
      phase: "Dépôt", explication: "Dossier déposé", etape: 2, rang: 200,
      description: "Votre dossier a été soumis avec succès. Il est dans la file d'attente de la préfecture pour un premier examen de recevabilité.",
      icon: "\uD83D\uDCE8"
    },

    // ── Étape 3 : Vérification formelle ──────────────────────────
    "verification_formelle_a_traiter": {
      phase: "Vérification formelle", explication: "Dossier reçu, en tri", etape: 3, rang: 301,
      description: "La préfecture a bien reçu votre demande. Elle est placée en file d'attente pour le premier tri administratif : vérification des pièces obligatoires et conditions de base.",
      icon: "\uD83D\uDD0D"
    },
    "verification_formelle_en_cours": {
      phase: "Vérification formelle", explication: "Tri en cours", etape: 3, rang: 302,
      description: "Un agent vérifie l'admissibilité formelle de votre dossier : présence des documents requis, validité des pièces, conditions légales. Des compléments peuvent être demandés.",
      icon: "\uD83D\uDD0D"
    },
    "verification_formelle_mise_en_demeure": {
      phase: "Vérification formelle", explication: "Mise en demeure, pièces à fournir", etape: 3, rang: 303,
      description: "Des documents obligatoires sont manquants ou non conformes. Vous allez recevoir un courrier détaillant les pièces à fournir. Répondez dans le délai imparti pour éviter un classement sans suite.",
      icon: "\u26A0\uFE0F"
    },
    "css_mise_en_demeure_a_affecter": {
      phase: "Vérification formelle", explication: "Classement sans suite en cours", etape: 3, rang: 304,
      description: "Suite à la mise en demeure restée sans réponse, un classement sans suite est en cours d'affectation à un agent. Fournissez les pièces manquantes au plus vite.",
      icon: "\u26A0\uFE0F"
    },
    "css_mise_en_demeure_a_rediger": {
      phase: "Vérification formelle", explication: "Classement sans suite en rédaction", etape: 3, rang: 305,
      description: "Le classement sans suite de votre dossier est en cours de rédaction suite à l'absence de réponse à la mise en demeure. Contactez votre préfecture si vous avez transmis les pièces.",
      icon: "\u26A0\uFE0F"
    },

    // ── Étape 4 : Affectation instructeur ────────────────────────
    "instruction_a_affecter": {
      phase: "Affectation", explication: "Dossier recevable, attente d'affectation", etape: 4, rang: 400,
      description: "Votre dossier a passé la vérification formelle avec succès ! Il est déclaré recevable et attend d'être attribué à un agent instructeur pour un examen approfondi. Vous recevrez un récépissé de dépôt.",
      icon: "\uD83D\uDC64"
    },

    // ── Étape 5 : Instruction du dossier ─────────────────────────
    "instruction_recepisse_completude_a_envoyer": {
      phase: "Instruction", explication: "Dossier complet, examen approfondi", etape: 5, rang: 501,
      description: "Un agent instructeur examine en détail votre dossier : situation personnelle, professionnelle, fiscale, assimilation. Le récépissé de complétude sera envoyé. Il peut vous convoquer pour l'entretien.",
      icon: "\uD83D\uDCD6"
    },
    "instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter": {
      phase: "Instruction", explication: "Compléments reçus, à vérifier", etape: 5, rang: 502,
      description: "Vous avez fourni des documents complémentaires suite à une demande de l'instructeur. L'agent vérifie leur conformité avant de poursuivre l'instruction de votre dossier.",
      icon: "\uD83D\uDCCB"
    },

    // ── Étape 6 : Complétude & enquêtes ──────────────────────────
    "instruction_date_ea_a_fixer": {
      phase: "Complétude & enquêtes", explication: "Enquêtes administratives lancées", etape: 6, rang: 601,
      description: "Votre dossier est officiellement complet ! Les enquêtes administratives obligatoires sont lancées (casier judiciaire, renseignements, fichiers). La date d'entretien d'assimilation sera fixée prochainement.",
      icon: "\uD83D\uDD0E"
    },
    "ea_demande_report_ea": {
      phase: "Complétude & enquêtes", explication: "Demande de report d'entretien", etape: 6, rang: 602,
      description: "Une demande de report de l'entretien d'assimilation a été enregistrée. La préfecture vous proposera une nouvelle date. Attention aux délais pour ne pas retarder votre dossier.",
      icon: "\uD83D\uDD04"
    },

    // ── Étape 7 : Entretien d'assimilation ───────────────────────
    "ea_en_attente_ea": {
      phase: "Entretien d'assimilation", explication: "Convocation envoyée, en attente", etape: 7, rang: 701,
      description: "Votre convocation à l'entretien d'assimilation est envoyée ou disponible. Préparez-vous : questions sur la France (histoire, culture, valeurs républicaines), votre parcours et vos motivations.",
      icon: "\uD83D\uDCEC"
    },
    "ea_crea_a_valider": {
      phase: "Entretien d'assimilation", explication: "Entretien passé, compte-rendu en rédaction", etape: 7, rang: 702,
      description: "Vous avez passé l'entretien d'assimilation ! L'agent rédige le compte-rendu évaluant votre niveau de langue, connaissance de la France et assimilation à la communauté française.",
      icon: "\u2705"
    },

    // ── Étape 8 : Décision préfecture ────────────────────────────
    "prop_decision_pref_a_effectuer": {
      phase: "Décision préfecture", explication: "Avis préfectoral en cours", etape: 8, rang: 801,
      description: "L'agent instructeur analyse l'ensemble de votre dossier (enquêtes, entretien, pièces) pour formuler sa proposition d'avis : favorable, défavorable ou ajournement.",
      icon: "\u2696\uFE0F"
    },
    "prop_decision_pref_en_attente_retour_hierarchique": {
      phase: "Décision préfecture", explication: "Validation hiérarchique en cours", etape: 8, rang: 802,
      description: "La proposition de l'agent est soumise à sa hiérarchie pour validation. Cette étape permet de confirmer l'avis avant transmission au préfet. Durée variable selon les préfectures.",
      icon: "\uD83D\uDC54"
    },
    "prop_decision_pref_prop_a_editer": {
      phase: "Décision préfecture", explication: "Rédaction de la proposition", etape: 8, rang: 803,
      description: "L'avis est validé et le document officiel de proposition est en cours de rédaction. Il résume votre situation et la recommandation de la préfecture au ministère.",
      icon: "\uD83D\uDCDD"
    },
    "prop_decision_pref_en_attente_retour_signataire": {
      phase: "Décision préfecture", explication: "Attente signature du préfet", etape: 8, rang: 804,
      description: "Le document de proposition est finalisé et transmis au préfet (ou son représentant) pour signature. Une fois signé, votre dossier sera envoyé au ministère de l'Intérieur (SDANF).",
      icon: "\u270D\uFE0F"
    },

    // ── Étape 9 : Contrôle SDANF & SCEC ─────────────────────────
    "controle_a_affecter": {
      phase: "Contrôle SDANF", explication: "Arrivé à la SDANF, attente affectation", etape: 9, rang: 901,
      description: "Votre dossier est arrivé à la Sous-Direction de l'Accès à la Nationalité Française (SDANF) à Rezé (44). Il attend d'être attribué à un agent pour le contrôle ministériel.",
      icon: "\uD83C\uDFDB\uFE0F"
    },
    "controle_a_effectuer": {
      phase: "Contrôle SDANF", explication: "Contrôle ministériel en cours", etape: 9, rang: 902,
      description: "Un agent de la SDANF contrôle votre dossier : vérification des pièces d'état civil, cohérence des informations, respect des conditions légales. Cette étape peut prendre plusieurs semaines.",
      icon: "\uD83D\uDCD1"
    },
    "controle_en_attente_pec": {
      phase: "Contrôle SCEC", explication: "Transmis au SCEC de Nantes", etape: 9, rang: 903,
      description: "Le Service Central d'État Civil (SCEC) de Nantes vérifie l'authenticité de vos actes d'état civil étrangers. Cette vérification est obligatoire pour valider votre identité.",
      icon: "\uD83C\uDFDB\uFE0F"
    },
    "controle_pec_a_faire": {
      phase: "Contrôle SCEC", explication: "Vérification d'état civil en cours", etape: 9, rang: 904,
      description: "Le SCEC procède à la vérification de vos pièces d'état civil. Une fois validées, vos actes seront transcrits dans les registres français si votre naturalisation aboutit.",
      icon: "\u2714\uFE0F"
    },

    // ── Étape 10 : Préparation décret ────────────────────────────
    "controle_transmise_pour_decret": {
      phase: "Préparation décret", explication: "Avis FAVORABLE, transmis pour décret", etape: 10, rang: 1001,
      description: "Excellente nouvelle ! L'avis est FAVORABLE. Votre dossier est transmis au service des décrets pour être inclus dans un prochain décret de naturalisation. La fin approche !",
      icon: "\uD83C\uDF89"
    },
    "controle_en_attente_retour_hierarchique": {
      phase: "Préparation décret", explication: "Validation hiérarchique ministérielle", etape: 10, rang: 1002,
      description: "Le projet de décret incluant votre demande est soumis à la validation de la hiérarchie ministérielle. Étape administrative normale avant la finalisation du décret.",
      icon: "\uD83D\uDC54"
    },
    "controle_decision_a_editer": {
      phase: "Préparation décret", explication: "Décision favorable, édition en cours", etape: 10, rang: 1003,
      description: "La décision favorable est confirmée. Le document officiel du décret incluant votre nom est en cours d'édition. Vous serez bientôt inscrit(e) dans un décret de naturalisation.",
      icon: "\uD83D\uDCC4"
    },
    "controle_en_attente_signature": {
      phase: "Préparation décret", explication: "Attente signature ministérielle", etape: 10, rang: 1004,
      description: "Le décret de naturalisation est finalisé et attend la signature du ministre ou de son représentant. Une fois signé, il sera publié au Journal Officiel.",
      icon: "\u270D\uFE0F"
    },
    "transmis_a_ac": {
      phase: "Préparation décret", explication: "Transmis à l'administration centrale", etape: 10, rang: 1005,
      description: "Votre dossier favorable est transmis à l'administration centrale chargée de préparer les décrets. Vous êtes dans la dernière ligne droite de la procédure !",
      icon: "\uD83D\uDCEC"
    },
    "a_verifier_avant_insertion_decret": {
      phase: "Préparation décret", explication: "Vérifications finales avant insertion", etape: 10, rang: 1006,
      description: "Dernières vérifications administratives aléatoires et facultatives avant l'insertion de votre nom dans un décret. On s'assure qu'aucun élément nouveau ne s'oppose à votre naturalisation.",
      icon: "\uD83D\uDD0E"
    },
    "prete_pour_insertion_decret": {
      phase: "Préparation décret", explication: "Validé, prêt pour insertion au décret", etape: 10, rang: 1007,
      description: "Votre dossier est validé et prêt pour être inséré dans le prochain décret de naturalisation. La décision favorable a été signée par le Ministre !",
      icon: "\u2705"
    },
    "decret_en_preparation": {
      phase: "Préparation décret", explication: "Décret en cours de préparation", etape: 10, rang: 1008,
      description: "Un décret de naturalisation incluant votre nom est en cours de préparation. Plusieurs dossiers sont regroupés dans chaque décret avant publication au Journal Officiel.",
      icon: "\uD83D\uDCCB"
    },
    "decret_a_qualifier": {
      phase: "Préparation décret", explication: "Décret en cours de qualification", etape: 10, rang: 1009,
      description: "Le décret incluant votre nom est en phase de qualification : catégorisation et vérification du type de décret (naturalisation, réintégration, etc.) avant validation finale.",
      icon: "\uD83D\uDCCB"
    },
    "decret_en_validation": {
      phase: "Préparation décret", explication: "Décret en validation finale", etape: 10, rang: 1010,
      description: "Le décret de naturalisation est en cours de validation finale par les services compétents. Dernière étape administrative avant la signature et la publication.",
      icon: "\uD83D\uDCCB"
    },

    // ── Étape 11 : Publication JO ────────────────────────────────
    "inseree_dans_decret": {
      phase: "Publication JO", explication: "Inséré dans un décret signé", etape: 11, rang: 1101,
      description: "Votre nom est officiellement inscrit dans un décret de naturalisation ! Il attend maintenant la publication au Journal Officiel de la République Française.",
      icon: "\uD83C\uDF89"
    },
    "decret_envoye_prefecture": {
      phase: "Publication JO", explication: "Décret envoyé à votre préfecture", etape: 11, rang: 1102,
      description: "Le décret signé a été transmis à votre préfecture. Elle va vous convoquer pour la cérémonie d'accueil dans la citoyenneté française et la remise de votre décret.",
      icon: "\uD83D\uDCE8"
    },
    "notification_envoyee": {
      phase: "Publication JO", explication: "Notification officielle envoyée", etape: 11, rang: 1103,
      description: "La notification officielle de votre naturalisation vous a été envoyée. Vous serez convoqué(e) à la cérémonie d'accueil dans la citoyenneté française.",
      icon: "\uD83D\uDCEC"
    },

    // ── Étape 12 : Décision finale ───────────────────────────────
    // Décisions positives
    "decret_naturalisation_publie": {
      phase: "NATURALISE(E)", explication: "Décret publié au Journal Officiel", etape: 12, rang: 1201,
      description: "FÉLICITATIONS ! Votre décret de naturalisation est publié au Journal Officiel de la République Française. Vous êtes officiellement citoyen(ne) français(e) !",
      icon: "\uD83C\uDDEB\uD83C\uDDF7"
    },
    "decret_naturalisation_publie_jo": {
      phase: "NATURALISE(E)", explication: "Décret publié au Journal Officiel", etape: 12, rang: 1202,
      description: "FÉLICITATIONS ! Votre décret de naturalisation est publié au Journal Officiel. Vous êtes officiellement français(e) ! La préfecture vous convoquera pour la cérémonie.",
      icon: "\uD83C\uDDEB\uD83C\uDDF7"
    },
    "decret_publie": {
      phase: "NATURALISE(E)", explication: "Décret publié", etape: 12, rang: 1203,
      description: "FÉLICITATIONS ! Votre décret de naturalisation est publié. Vous êtes officiellement citoyen(ne) français(e) ! La préfecture vous convoquera pour la cérémonie d'accueil.",
      icon: "\uD83C\uDDEB\uD83C\uDDF7"
    },
    "demande_traitee": {
      phase: "Finalisé", explication: "Demande entièrement traitée", etape: 12, rang: 1204,
      description: "Votre demande de naturalisation a été entièrement traitée. Consultez vos courriers ou contactez votre préfecture pour connaître l'issue de votre dossier.",
      icon: "\u2705"
    },
    // Décisions négatives
    "decision_negative_en_delais_recours": {
      phase: "Décision négative", explication: "Défavorable, délai de recours ouvert", etape: 12, rang: 1205,
      description: "Votre demande a reçu une décision défavorable. Vous disposez d'un délai de 2 mois pour former un recours gracieux auprès du ministre (RAPO) ou un recours contentieux devant le tribunal administratif.",
      icon: "\u274C"
    },
    "decision_notifiee": {
      phase: "Décision négative", explication: "Décision notifiée au demandeur", etape: 12, rang: 1206,
      description: "La décision concernant votre dossier vous a été officiellement notifiée. Consultez le courrier pour connaître la nature de la décision et les voies de recours disponibles.",
      icon: "\u274C"
    },
    "demande_en_cours_rapo": {
      phase: "Recours RAPO", explication: "Recours administratif en cours", etape: 12, rang: 1207,
      description: "Votre recours administratif préalable obligatoire (RAPO) est en cours d'examen par le ministère. Le RAPO est un recours gracieux contre une décision défavorable. Délai de réponse : environ 4 mois.",
      icon: "\u2696\uFE0F"
    },
    "controle_demande_notifiee": {
      phase: "Décision notifiée", explication: "Décision de contrôle notifiée", etape: 12, rang: 1208,
      description: "La décision issue du contrôle ministériel vous a été officiellement communiquée. Vérifiez vos courriers pour connaître la suite donnée à votre dossier.",
      icon: "\uD83D\uDCEC"
    },
    // Irrecevabilité
    "irrecevabilite_manifeste": {
      phase: "Irrecevabilité", explication: "Conditions légales non remplies", etape: 12, rang: 1209,
      description: "Votre demande ne remplit pas les conditions légales de recevabilité (durée de résidence, titre de séjour, etc.). Vérifiez les critères d'éligibilité avant de déposer une nouvelle demande.",
      icon: "\u274C"
    },
    "irrecevabilite_manifeste_en_delais_recours": {
      phase: "Irrecevabilité", explication: "Irrecevable, délai de recours ouvert", etape: 12, rang: 1210,
      description: "Votre demande a été déclarée irrecevable. Vous pouvez contester cette décision par un recours gracieux (RAPO) ou contentieux dans un délai de 2 mois.",
      icon: "\u274C"
    },
    // Classement sans suite
    "css_en_delais_recours": {
      phase: "Classement sans suite", explication: "Classé sans suite, recours possible", etape: 12, rang: 1211,
      description: "Votre dossier a été classé sans suite (pièces non fournies dans les délais, désistement, etc.). Vous pouvez former un recours ou déposer une nouvelle demande complète.",
      icon: "\u26A0\uFE0F"
    },
    "css_notifie": {
      phase: "Classement sans suite", explication: "Classement sans suite notifié", etape: 12, rang: 1212,
      description: "Le classement sans suite de votre dossier vous a été officiellement notifié. Analysez les motifs indiqués avant d'envisager une nouvelle demande.",
      icon: "\u26A0\uFE0F"
    }
  };

  function isPositiveStatus(statutCode) {
    var code = String(statutCode || '').toLowerCase().trim();
    return ['decret_naturalisation_publie', 'decret_naturalisation_publie_jo', 'decret_publie', 'demande_traitee'].indexOf(code) !== -1;
  }

  function isNegativeStatus(statutCode) {
    var code = String(statutCode || '').toLowerCase().trim();
    return code.indexOf('negative') !== -1 || code.indexOf('irrecevabilite') !== -1 || code.indexOf('css_') !== -1;
  }

  function getStepColor(etape) {
    // Support rang values > 12 by extracting major step
    var step = etape > 12 ? Math.floor(etape / 100) : etape;
    return STEP_COLORS[step] || STEP_COLORS[0];
  }

  function formatSubStep(rang) {
    var sub = rang % 100;
    var step = Math.floor(rang / 100);
    return sub === 0 ? String(step) : step + '.' + sub;
  }

  function rangToStep(rang) {
    return Math.floor(rang / 100);
  }

  function getRang(statutCode) {
    var code = String(statutCode || '').toLowerCase().trim();
    var info = STATUTS[code];
    return info ? info.rang : 0;
  }

  // Mapping code departement → nom (pour fallback prefecture via code postal)
  var DEPT_MAP = {
    '01':'Ain','02':'Aisne','03':'Allier','04':'Alpes-de-Haute-Provence','05':'Hautes-Alpes',
    '06':'Alpes-Maritimes','07':'Ardèche','08':'Ardennes','09':'Ariège','10':'Aube',
    '11':'Aude','12':'Aveyron','13':'Bouches-du-Rhône','14':'Calvados','15':'Cantal',
    '16':'Charente','17':'Charente-Maritime','18':'Cher','19':'Corrèze',
    '2A':'Corse-du-Sud','2B':'Haute-Corse',
    '21':"Côte-d'Or",'22':"Côtes-d'Armor",'23':'Creuse','24':'Dordogne','25':'Doubs',
    '26':'Drôme','27':'Eure','28':'Eure-et-Loir','29':'Finistère','30':'Gard',
    '31':'Haute-Garonne','32':'Gers','33':'Gironde','34':'Hérault','35':'Ille-et-Vilaine',
    '36':'Indre','37':'Indre-et-Loire','38':'Isère','39':'Jura','40':'Landes',
    '41':'Loir-et-Cher','42':'Loire','43':'Haute-Loire','44':'Loire-Atlantique','45':'Loiret',
    '46':'Lot','47':'Lot-et-Garonne','48':'Lozère','49':'Maine-et-Loire','50':'Manche',
    '51':'Marne','52':'Haute-Marne','53':'Mayenne','54':'Meurthe-et-Moselle','55':'Meuse',
    '56':'Morbihan','57':'Moselle','58':'Nièvre','59':'Nord','60':'Oise',
    '61':'Orne','62':'Pas-de-Calais','63':'Puy-de-Dôme','64':'Pyrénées-Atlantiques',
    '65':'Hautes-Pyrénées','66':'Pyrénées-Orientales','67':'Bas-Rhin','68':'Haut-Rhin',
    '69':'Rhône','70':'Haute-Saône','71':'Saône-et-Loire','72':'Sarthe','73':'Savoie',
    '74':'Haute-Savoie','75':'Paris','76':'Seine-Maritime','77':'Seine-et-Marne',
    '78':'Yvelines','79':'Deux-Sèvres','80':'Somme','81':'Tarn','82':'Tarn-et-Garonne',
    '83':'Var','84':'Vaucluse','85':'Vendée','86':'Vienne','87':'Haute-Vienne',
    '88':'Vosges','89':'Yonne','90':'Territoire de Belfort',
    '91':'Essonne','92':'Hauts-de-Seine','93':'Seine-Saint-Denis','94':'Val-de-Marne','95':"Val-d'Oise",
    '971':'Guadeloupe','972':'Martinique','973':'Guyane','974':'La Réunion','976':'Mayotte'
  };

  function getDepartementFromCP(codePostal) {
    if (!codePostal) return null;
    var cp = String(codePostal).padStart(5, '0');
    if (cp.substring(0, 2) === '97') return DEPT_MAP[cp.substring(0, 3)] || null;
    if (cp.substring(0, 2) === '20') return DEPT_MAP[parseInt(cp, 10) < 20200 ? '2A' : '2B'] || null;
    return DEPT_MAP[cp.substring(0, 2)] || null;
  }

  ANEF.constants = {
    SITE_VERSION: SITE_VERSION,
    STEP_COLORS: STEP_COLORS,
    PHASE_NAMES: PHASE_NAMES,
    PHASE_SHORT: PHASE_SHORT,
    STEP_RANGES: STEP_RANGES,
    STATUTS: STATUTS,
    isPositiveStatus: isPositiveStatus,
    isNegativeStatus: isNegativeStatus,
    getStepColor: getStepColor,
    formatSubStep: formatSubStep,
    rangToStep: rangToStep,
    getRang: getRang,
    DEPT_MAP: DEPT_MAP,
    getDepartementFromCP: getDepartementFromCP
  };
})();
