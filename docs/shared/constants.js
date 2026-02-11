/**
 * shared/constants.js — Constantes globales ANEF
 */
(function() {
  'use strict';

  window.ANEF = window.ANEF || {};

  const SUPABASE_URL = '__SUPABASE_URL__';
  const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

  // Palette par etape (index = numero d'etape)
  const STEP_COLORS = [
    '#6b7280', // 0 - inconnu
    '#6b7280', // 1 - Brouillon
    '#6b7280', // 2 - Depot du dossier
    '#3b82f6', // 3 - Verification formelle
    '#3b82f6', // 4 - Affectation instructeur
    '#3b82f6', // 5 - Instruction du dossier
    '#8b5cf6', // 6 - Completude & enquetes
    '#8b5cf6', // 7 - Entretien d'assimilation
    '#8b5cf6', // 8 - Decision prefecture
    '#f59e0b', // 9 - Controle SDANF & SCEC
    '#f59e0b', // 10 - Preparation decret
    '#f59e0b', // 11 - Publication JO
    '#10b981'  // 12 - Decision finale
  ];

  const PHASE_NAMES = {
    1: 'Brouillon',
    2: 'Depot du dossier',
    3: 'Verification formelle',
    4: 'Affectation instructeur',
    5: 'Instruction du dossier',
    6: 'Completude & enquetes',
    7: 'Entretien d\'assimilation',
    8: 'Decision prefecture',
    9: 'Controle SDANF & SCEC',
    10: 'Preparation decret',
    11: 'Publication JO',
    12: 'Decision finale'
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
    // ── Etape 1 : Brouillon ──────────────────────────────────────
    "draft": {
      phase: "Brouillon", explication: "Dossier en brouillon", etape: 1, rang: 100,
      description: "Votre dossier est en cours de preparation sur la plateforme ANEF. Completez toutes les sections et joignez les pieces justificatives avant de soumettre.",
      icon: "\uD83D\uDCDD"
    },

    // ── Etape 2 : Depot du dossier ───────────────────────────────
    "dossier_depose": {
      phase: "Depot", explication: "Dossier depose", etape: 2, rang: 200,
      description: "Votre dossier a ete soumis avec succes. Il est dans la file d'attente de la prefecture pour un premier examen de recevabilite.",
      icon: "\uD83D\uDCE8"
    },

    // ── Etape 3 : Verification formelle ──────────────────────────
    "verification_formelle_a_traiter": {
      phase: "Verification formelle", explication: "Dossier recu, en tri", etape: 3, rang: 301,
      description: "La prefecture a bien recu votre demande. Elle est placee en file d'attente pour le premier tri administratif : verification des pieces obligatoires et conditions de base.",
      icon: "\uD83D\uDD0D"
    },
    "verification_formelle_en_cours": {
      phase: "Verification formelle", explication: "Tri en cours", etape: 3, rang: 302,
      description: "Un agent verifie l'admissibilite formelle de votre dossier : presence des documents requis, validite des pieces, conditions legales. Des complements peuvent etre demandes.",
      icon: "\uD83D\uDD0D"
    },
    "verification_formelle_mise_en_demeure": {
      phase: "Verification formelle", explication: "Mise en demeure, pieces a fournir", etape: 3, rang: 303,
      description: "Des documents obligatoires sont manquants ou non conformes. Vous allez recevoir un courrier detaillant les pieces a fournir. Repondez dans le delai imparti pour eviter un classement sans suite.",
      icon: "\u26A0\uFE0F"
    },
    "css_mise_en_demeure_a_affecter": {
      phase: "Verification formelle", explication: "Classement sans suite en cours", etape: 3, rang: 304,
      description: "Suite a la mise en demeure restee sans reponse, un classement sans suite est en cours d'affectation a un agent. Fournissez les pieces manquantes au plus vite.",
      icon: "\u26A0\uFE0F"
    },
    "css_mise_en_demeure_a_rediger": {
      phase: "Verification formelle", explication: "Classement sans suite en redaction", etape: 3, rang: 305,
      description: "Le classement sans suite de votre dossier est en cours de redaction suite a l'absence de reponse a la mise en demeure. Contactez votre prefecture si vous avez transmis les pieces.",
      icon: "\u26A0\uFE0F"
    },

    // ── Etape 4 : Affectation instructeur ────────────────────────
    "instruction_a_affecter": {
      phase: "Affectation", explication: "Dossier recevable, attente d'affectation", etape: 4, rang: 400,
      description: "Votre dossier a passe la verification formelle avec succes ! Il est declare recevable et attend d'etre attribue a un agent instructeur pour un examen approfondi. Vous recevrez un recepisse de depot.",
      icon: "\uD83D\uDC64"
    },

    // ── Etape 5 : Instruction du dossier ─────────────────────────
    "instruction_recepisse_completude_a_envoyer": {
      phase: "Instruction", explication: "Dossier complet, examen approfondi", etape: 5, rang: 501,
      description: "Un agent instructeur examine en detail votre dossier : situation personnelle, professionnelle, fiscale, assimilation. Le recepisse de completude sera envoye. Il peut vous convoquer pour l'entretien.",
      icon: "\uD83D\uDCD6"
    },
    "instruction_recepisse_completude_a_envoyer_retour_complement_a_traiter": {
      phase: "Instruction", explication: "Complements recus, a verifier", etape: 5, rang: 502,
      description: "Vous avez fourni des documents complementaires suite a une demande de l'instructeur. L'agent verifie leur conformite avant de poursuivre l'instruction de votre dossier.",
      icon: "\uD83D\uDCCB"
    },

    // ── Etape 6 : Completude & enquetes ──────────────────────────
    "instruction_date_ea_a_fixer": {
      phase: "Completude & enquetes", explication: "Enquetes administratives lancees", etape: 6, rang: 601,
      description: "Votre dossier est officiellement complet ! Les enquetes administratives obligatoires sont lancees (casier judiciaire, renseignements, fichiers). La date d'entretien d'assimilation sera fixee prochainement.",
      icon: "\uD83D\uDD0E"
    },
    "ea_demande_report_ea": {
      phase: "Completude & enquetes", explication: "Demande de report d'entretien", etape: 6, rang: 602,
      description: "Une demande de report de l'entretien d'assimilation a ete enregistree. La prefecture vous proposera une nouvelle date. Attention aux delais pour ne pas retarder votre dossier.",
      icon: "\uD83D\uDD04"
    },

    // ── Etape 7 : Entretien d'assimilation ───────────────────────
    "ea_en_attente_ea": {
      phase: "Entretien d'assimilation", explication: "Convocation envoyee, en attente", etape: 7, rang: 701,
      description: "Votre convocation a l'entretien d'assimilation est envoyee ou disponible. Preparez-vous : questions sur la France (histoire, culture, valeurs republicaines), votre parcours et vos motivations.",
      icon: "\uD83D\uDCEC"
    },
    "ea_crea_a_valider": {
      phase: "Entretien d'assimilation", explication: "Entretien passe, compte-rendu en redaction", etape: 7, rang: 702,
      description: "Vous avez passe l'entretien d'assimilation ! L'agent redige le compte-rendu evaluant votre niveau de langue, connaissance de la France et assimilation a la communaute francaise.",
      icon: "\u2705"
    },

    // ── Etape 8 : Decision prefecture ────────────────────────────
    "prop_decision_pref_a_effectuer": {
      phase: "Decision prefecture", explication: "Avis prefectoral en cours", etape: 8, rang: 801,
      description: "L'agent instructeur analyse l'ensemble de votre dossier (enquetes, entretien, pieces) pour formuler sa proposition d'avis : favorable, defavorable ou ajournement.",
      icon: "\u2696\uFE0F"
    },
    "prop_decision_pref_en_attente_retour_hierarchique": {
      phase: "Decision prefecture", explication: "Validation hierarchique en cours", etape: 8, rang: 802,
      description: "La proposition de l'agent est soumise a sa hierarchie pour validation. Cette etape permet de confirmer l'avis avant transmission au prefet. Duree variable selon les prefectures.",
      icon: "\uD83D\uDC54"
    },
    "prop_decision_pref_prop_a_editer": {
      phase: "Decision prefecture", explication: "Redaction de la proposition", etape: 8, rang: 803,
      description: "L'avis est valide et le document officiel de proposition est en cours de redaction. Il resume votre situation et la recommandation de la prefecture au ministere.",
      icon: "\uD83D\uDCDD"
    },
    "prop_decision_pref_en_attente_retour_signataire": {
      phase: "Decision prefecture", explication: "Attente signature du prefet", etape: 8, rang: 804,
      description: "Le document de proposition est finalise et transmis au prefet (ou son representant) pour signature. Une fois signe, votre dossier sera envoye au ministere de l'Interieur (SDANF).",
      icon: "\u270D\uFE0F"
    },

    // ── Etape 9 : Controle SDANF & SCEC ─────────────────────────
    "controle_a_affecter": {
      phase: "Controle SDANF", explication: "Arrive a la SDANF, attente affectation", etape: 9, rang: 901,
      description: "Votre dossier est arrive a la Sous-Direction de l'Acces a la Nationalite Francaise (SDANF) a Reze (44). Il attend d'etre attribue a un agent pour le controle ministeriel.",
      icon: "\uD83C\uDFDB\uFE0F"
    },
    "controle_a_effectuer": {
      phase: "Controle SDANF", explication: "Controle ministeriel en cours", etape: 9, rang: 902,
      description: "Un agent de la SDANF controle votre dossier : verification des pieces d'etat civil, coherence des informations, respect des conditions legales. Cette etape peut prendre plusieurs semaines.",
      icon: "\uD83D\uDCD1"
    },
    "controle_en_attente_pec": {
      phase: "Controle SCEC", explication: "Transmis au SCEC de Nantes", etape: 9, rang: 903,
      description: "Le Service Central d'Etat Civil (SCEC) de Nantes verifie l'authenticite de vos actes d'etat civil etrangers. Cette verification est obligatoire pour valider votre identite.",
      icon: "\uD83C\uDFDB\uFE0F"
    },
    "controle_pec_a_faire": {
      phase: "Controle SCEC", explication: "Verification d'etat civil en cours", etape: 9, rang: 904,
      description: "Le SCEC procede a la verification de vos pieces d'etat civil. Une fois validees, vos actes seront transcrits dans les registres francais si votre naturalisation aboutit.",
      icon: "\u2714\uFE0F"
    },

    // ── Etape 10 : Preparation decret ────────────────────────────
    "controle_transmise_pour_decret": {
      phase: "Preparation decret", explication: "Avis FAVORABLE, transmis pour decret", etape: 10, rang: 1001,
      description: "Excellente nouvelle ! L'avis est FAVORABLE. Votre dossier est transmis au service des decrets pour etre inclus dans un prochain decret de naturalisation. La fin approche !",
      icon: "\uD83C\uDF89"
    },
    "controle_en_attente_retour_hierarchique": {
      phase: "Preparation decret", explication: "Validation hierarchique ministerielle", etape: 10, rang: 1002,
      description: "Le projet de decret incluant votre demande est soumis a la validation de la hierarchie ministerielle. Etape administrative normale avant la finalisation du decret.",
      icon: "\uD83D\uDC54"
    },
    "controle_decision_a_editer": {
      phase: "Preparation decret", explication: "Decision favorable, edition en cours", etape: 10, rang: 1003,
      description: "La decision favorable est confirmee. Le document officiel du decret incluant votre nom est en cours d'edition. Vous serez bientot inscrit(e) dans un decret de naturalisation.",
      icon: "\uD83D\uDCC4"
    },
    "controle_en_attente_signature": {
      phase: "Preparation decret", explication: "Attente signature ministerielle", etape: 10, rang: 1004,
      description: "Le decret de naturalisation est finalise et attend la signature du ministre ou de son representant. Une fois signe, il sera publie au Journal Officiel.",
      icon: "\u270D\uFE0F"
    },
    "transmis_a_ac": {
      phase: "Preparation decret", explication: "Transmis a l'administration centrale", etape: 10, rang: 1005,
      description: "Votre dossier favorable est transmis a l'administration centrale chargee de preparer les decrets. Vous etes dans la derniere ligne droite de la procedure !",
      icon: "\uD83D\uDCEC"
    },
    "a_verifier_avant_insertion_decret": {
      phase: "Preparation decret", explication: "Verifications finales avant insertion", etape: 10, rang: 1006,
      description: "Dernieres verifications administratives aleatoires et facultatives avant l'insertion de votre nom dans un decret. On s'assure qu'aucun element nouveau ne s'oppose a votre naturalisation.",
      icon: "\uD83D\uDD0E"
    },
    "prete_pour_insertion_decret": {
      phase: "Preparation decret", explication: "Valide, pret pour insertion au decret", etape: 10, rang: 1007,
      description: "Votre dossier est valide et pret pour etre insere dans le prochain decret de naturalisation. La decision favorable a ete signee par le Ministre !",
      icon: "\u2705"
    },
    "decret_en_preparation": {
      phase: "Preparation decret", explication: "Decret en cours de preparation", etape: 10, rang: 1008,
      description: "Un decret de naturalisation incluant votre nom est en cours de preparation. Plusieurs dossiers sont regroupes dans chaque decret avant publication au Journal Officiel.",
      icon: "\uD83D\uDCCB"
    },
    "decret_a_qualifier": {
      phase: "Preparation decret", explication: "Decret en cours de qualification", etape: 10, rang: 1009,
      description: "Le decret incluant votre nom est en phase de qualification : categorisation et verification du type de decret (naturalisation, reintegration, etc.) avant validation finale.",
      icon: "\uD83D\uDCCB"
    },
    "decret_en_validation": {
      phase: "Preparation decret", explication: "Decret en validation finale", etape: 10, rang: 1010,
      description: "Le decret de naturalisation est en cours de validation finale par les services competents. Derniere etape administrative avant la signature et la publication.",
      icon: "\uD83D\uDCCB"
    },

    // ── Etape 11 : Publication JO ────────────────────────────────
    "inseree_dans_decret": {
      phase: "Publication JO", explication: "Insere dans un decret signe", etape: 11, rang: 1101,
      description: "Votre nom est officiellement inscrit dans un decret de naturalisation ! Il attend maintenant la publication au Journal Officiel de la Republique Francaise.",
      icon: "\uD83C\uDF89"
    },
    "decret_envoye_prefecture": {
      phase: "Publication JO", explication: "Decret envoye a votre prefecture", etape: 11, rang: 1102,
      description: "Le decret signe a ete transmis a votre prefecture. Elle va vous convoquer pour la ceremonie d'accueil dans la citoyennete francaise et la remise de votre decret.",
      icon: "\uD83D\uDCE8"
    },
    "notification_envoyee": {
      phase: "Publication JO", explication: "Notification officielle envoyee", etape: 11, rang: 1103,
      description: "La notification officielle de votre naturalisation vous a ete envoyee. Vous serez convoque(e) a la ceremonie d'accueil dans la citoyennete francaise.",
      icon: "\uD83D\uDCEC"
    },

    // ── Etape 12 : Decision finale ───────────────────────────────
    // Decisions positives
    "decret_naturalisation_publie": {
      phase: "NATURALISE(E)", explication: "Decret publie au Journal Officiel", etape: 12, rang: 1201,
      description: "FELICITATIONS ! Votre decret de naturalisation est publie au Journal Officiel de la Republique Francaise. Vous etes officiellement citoyen(ne) francais(e) !",
      icon: "\uD83C\uDDEB\uD83C\uDDF7"
    },
    "decret_naturalisation_publie_jo": {
      phase: "NATURALISE(E)", explication: "Decret publie au Journal Officiel", etape: 12, rang: 1202,
      description: "FELICITATIONS ! Votre decret de naturalisation est publie au Journal Officiel. Vous etes officiellement francais(e) ! La prefecture vous convoquera pour la ceremonie.",
      icon: "\uD83C\uDDEB\uD83C\uDDF7"
    },
    "decret_publie": {
      phase: "NATURALISE(E)", explication: "Decret publie", etape: 12, rang: 1203,
      description: "FELICITATIONS ! Votre decret de naturalisation est publie. Vous etes officiellement citoyen(ne) francais(e) ! La prefecture vous convoquera pour la ceremonie d'accueil.",
      icon: "\uD83C\uDDEB\uD83C\uDDF7"
    },
    "demande_traitee": {
      phase: "Finalise", explication: "Demande entierement traitee", etape: 12, rang: 1204,
      description: "Votre demande de naturalisation a ete entierement traitee. Consultez vos courriers ou contactez votre prefecture pour connaitre l'issue de votre dossier.",
      icon: "\u2705"
    },
    // Decisions negatives
    "decision_negative_en_delais_recours": {
      phase: "Decision negative", explication: "Defavorable, delai de recours ouvert", etape: 12, rang: 1205,
      description: "Votre demande a recu une decision defavorable. Vous disposez d'un delai de 2 mois pour former un recours gracieux aupres du ministre (RAPO) ou un recours contentieux devant le tribunal administratif.",
      icon: "\u274C"
    },
    "decision_notifiee": {
      phase: "Decision negative", explication: "Decision notifiee au demandeur", etape: 12, rang: 1206,
      description: "La decision concernant votre dossier vous a ete officiellement notifiee. Consultez le courrier pour connaitre la nature de la decision et les voies de recours disponibles.",
      icon: "\u274C"
    },
    "demande_en_cours_rapo": {
      phase: "Recours RAPO", explication: "Recours administratif en cours", etape: 12, rang: 1207,
      description: "Votre recours administratif prealable obligatoire (RAPO) est en cours d'examen par le ministere. Le RAPO est un recours gracieux contre une decision defavorable. Delai de reponse : environ 4 mois.",
      icon: "\u2696\uFE0F"
    },
    "controle_demande_notifiee": {
      phase: "Decision notifiee", explication: "Decision de controle notifiee", etape: 12, rang: 1208,
      description: "La decision issue du controle ministeriel vous a ete officiellement communiquee. Verifiez vos courriers pour connaitre la suite donnee a votre dossier.",
      icon: "\uD83D\uDCEC"
    },
    // Irrecevabilite
    "irrecevabilite_manifeste": {
      phase: "Irrecevabilite", explication: "Conditions legales non remplies", etape: 12, rang: 1209,
      description: "Votre demande ne remplit pas les conditions legales de recevabilite (duree de residence, titre de sejour, etc.). Verifiez les criteres d'eligibilite avant de deposer une nouvelle demande.",
      icon: "\u274C"
    },
    "irrecevabilite_manifeste_en_delais_recours": {
      phase: "Irrecevabilite", explication: "Irrecevable, delai de recours ouvert", etape: 12, rang: 1210,
      description: "Votre demande a ete declaree irrecevable. Vous pouvez contester cette decision par un recours gracieux (RAPO) ou contentieux dans un delai de 2 mois.",
      icon: "\u274C"
    },
    // Classement sans suite
    "css_en_delais_recours": {
      phase: "Classement sans suite", explication: "Classe sans suite, recours possible", etape: 12, rang: 1211,
      description: "Votre dossier a ete classe sans suite (pieces non fournies dans les delais, desistement, etc.). Vous pouvez former un recours ou deposer une nouvelle demande complete.",
      icon: "\u26A0\uFE0F"
    },
    "css_notifie": {
      phase: "Classement sans suite", explication: "Classement sans suite notifie", etape: 12, rang: 1212,
      description: "Le classement sans suite de votre dossier vous a ete officiellement notifie. Analysez les motifs indiques avant d'envisager une nouvelle demande.",
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

  ANEF.constants = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    STEP_COLORS: STEP_COLORS,
    PHASE_NAMES: PHASE_NAMES,
    STEP_RANGES: STEP_RANGES,
    STATUTS: STATUTS,
    isPositiveStatus: isPositiveStatus,
    isNegativeStatus: isNegativeStatus,
    getStepColor: getStepColor,
    formatSubStep: formatSubStep,
    rangToStep: rangToStep,
    getRang: getRang
  };
})();
