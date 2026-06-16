/**
 * shared/i18n/fr.js — Catalogue FRANÇAIS (langue source / repli).
 *
 * Référence : toute clé UI doit exister ici. Les autres catalogues en sont la
 * traduction, clé pour clé. Convention : « zone.element » en minuscules.
 *
 * NB : le dictionnaire des STATUTS (status.*, phase.*, short.*) n'est PAS ici —
 * le français reste la source dans constants.js / accueil.js, et les autres
 * langues le superposent. Voir constants.js → localizeStatuts().
 */
(function() {
  'use strict';
  window.ANEF = window.ANEF || {};
  if (!ANEF.i18n) { console.error('[i18n] i18n.js doit être chargé avant fr.js'); return; }

  ANEF.i18n.register('fr', {
    // ── Sélecteur de langue ──
    'lang.label': 'Langue',

    // ── Titres de page (SEO, <title>) ──
    'meta.accueil.title': 'ANEF Stats — Suivi naturalisation française en temps réel',
    'meta.dossiers.title': 'ANEF Stats — Explorateur de dossiers naturalisation',
    'meta.prefectures.title': 'ANEF Stats — Délais par préfecture de naturalisation',
    'meta.delais.title': 'ANEF Stats — Délais de naturalisation française',
    'meta.guide.title': 'ANEF Stats — Guide des étapes de naturalisation',
    'meta.feedback.title': 'ANEF Stats — Contact et retours',
    'meta.accueil.desc': 'Suivez les délais de naturalisation française en temps réel grâce aux données anonymes de la communauté. Statistiques par préfecture, étapes SDANF/SCEC, durées moyennes.',
    'meta.dossiers.desc': 'Explorez les dossiers de naturalisation française : statut actuel, historique des étapes, durées par préfecture. Données anonymes et communautaires.',
    'meta.prefectures.desc': 'Comparez les délais de naturalisation par préfecture : durée moyenne, taux d’avis favorable, étape moyenne. Données anonymes de la communauté.',
    'meta.delais.desc': 'Estimez le temps restant jusqu’à votre naturalisation française selon votre statut et votre préfecture. Délais réels issus de la communauté.',
    'meta.guide.desc': 'Comprenez chaque étape de la naturalisation française et installez l’extension ANEF Status Tracker pour suivre votre dossier en temps réel.',
    'meta.feedback.desc': 'Un bug, une suggestion ? Rejoignez le groupe Facebook de la communauté ANEF Status Tracker pour échanger et proposer des améliorations.',

    // ── Header (commun) ──
    'header.subtitle': 'Statistiques communautaires',
    'header.badge': 'Données anonymes',

    // ── Navigation (commun) ──
    'nav.accueil': 'Accueil',
    'nav.dossiers': 'Dossiers',
    'nav.prefectures': 'Préfectures',
    'nav.prefectures_short': 'Préf.',
    'nav.delais': 'Délais',
    'nav.guide': 'Guide',
    'nav.contact': 'Contact',
    'nav.install': 'Installer l’extension',
    'nav.theme': 'Thème',

    // ── Chargement (commun) ──
    'loading.stats': 'Chargement des statistiques…',

    // ── Footer (commun) ──
    'footer.tagline': 'Extension Chrome pour suivre votre naturalisation',
    'footer.collected': 'Données collectées anonymement par les utilisateurs de l’extension',

    // ── SEO <noscript> ──
    'noscript.title': 'Statistiques de naturalisation française — ANEF Status Tracker',
    'noscript.p1': 'ANEF Status Tracker collecte des données anonymes auprès de sa communauté d’utilisateurs pour fournir des statistiques en temps réel sur les délais de naturalisation française.',
    'noscript.p2': 'Consultez les durées moyennes par préfecture, suivez les étapes du processus (instruction, entretien d’assimilation, décision préfecture, contrôle SDANF, vérification SCEC, décret) et visualisez les mouvements quotidiens dans le pipeline.',
    'noscript.p3': 'L’extension Chrome est disponible gratuitement sur le Chrome Web Store.',

    // ── KPIs ──
    'kpi.dossiers_label': 'Dossiers suivis',
    'kpi.dossiers_sub': 'dans la communauté',
    'kpi.avg_label': 'Durée moyenne',
    'kpi.avg_sub': 'depuis le dépôt',
    'kpi.refresh_label': 'Dernière actualisation',
    'kpi.refresh_tooltip': 'Les statistiques sont actualisées automatiquement ~11 fois par jour à partir des données anonymes envoyées par les utilisateurs de l’extension.',
    'kpi.decret_label': 'Dernier décret',
    'kpi.dossiers_sub_count': { one: '{n} préfecture', other: '{n} préfectures' },
    'kpi.avg_sub_count': { one: 'depuis le dépôt ({n} dossier)', other: 'depuis le dépôt ({n} dossiers)' },

    // ── Titres de sections ──
    'section.timeline_title': 'Timeline globale',
    'section.timeline_sub': 'Cliquez sur un statut pour voir les dossiers concernés',
    'section.mouvements_title': 'Mouvements du jour',
    'section.mouvements_sub': 'Transitions observées dans le pipeline SDANF / SCEC',
    'section.mouv_hist_title': 'Historique des mouvements',
    'section.mouv_hist_sub': 'Évolution des transitions SDANF / SCEC',
    'section.sdanf_title': 'Contrôle SDANF & SCEC',
    'section.sdanf_sub': 'Dossiers en cours de contrôle et d’insertion au décret (étapes 9 à 11)',
    'section.entretien_title': 'Phase entretien & décision préfecture',
    'section.entretien_sub': 'Dossiers entre la convocation d’entretien et le passage en SDANF',
    'section.activity_title': 'Activité récente',
    'section.activity_sub': 'Historique des changements observés',

    // ── Communs ──
    'common.expand': 'Déplier',
    'common.from': 'De',
    'common.to': 'À',
    'common.week': 'Semaine',
    'common.month': 'Mois',
    'common.since': 'depuis le {date}',
    'common.since_deposit': 'depuis le dépôt',
    'common.pref_unknown': 'Préfecture inconnue',
    'common.age_label': 'Ancienneté',
    'common.checked_on': 'Vérifié le {date}',
    'common.previous': 'ancien',
    'common.step': 'Étape',
    'common.back': 'Retour',
    'common.close': 'Fermer',
    'common.error': 'Erreur',
    'common.interview_label': 'Entretien',
    'common.dossier_count': { one: '{n} dossier', other: '{n} dossiers' },
    'common.event_count': { one: '{n} événement', other: '{n} événements' },

    // ── Barres d'outils (tri / filtres / pagination) ──
    'toolbar.sort': 'Trier',
    'toolbar.wait_desc': 'Attente ↓',
    'toolbar.wait_asc': 'Attente ↑',
    'toolbar.pref': 'Préfecture',
    'toolbar.changed_tip': 'Afficher uniquement les dossiers dont le statut a changé',
    'toolbar.modified': 'Modifiés',
    'toolbar.per_page_title': 'Par page',
    'toolbar.per_page_5': '5 / page',
    'toolbar.per_page_10': '10 / page',
    'toolbar.per_page_20': '20 / page',
    'toolbar.age_desc': 'Ancienneté ↓',
    'toolbar.age_asc': 'Ancienneté ↑',
    'toolbar.step_desc': 'Étape ↓',
    'toolbar.step_asc': 'Étape ↑',
    'toolbar.interview_recent': 'Entretien récent ↓',
    'toolbar.interview_old': 'Entretien ancien ↑',
    'toolbar.interview': 'Entretien',
    'toolbar.interview_all': 'Entretien : tous',
    'toolbar.interview_passed': 'Passé',
    'toolbar.interview_pending': 'En attente',
    'toolbar.interview_none': '⚠ Décision sans entretien',
    'toolbar.status': 'Statut',
    'toolbar.status_all': 'Statut : tous',
    'toolbar.type': 'Type',
    'toolbar.type_all': 'Tous types',
    'toolbar.type_new': 'Nouveaux',
    'toolbar.type_steps': 'Étapes',
    'toolbar.type_progress': 'Progressions',
    'toolbar.per_page_5b': '5 par page',
    'toolbar.per_page_10b': '10 par page',
    'toolbar.per_page_20b': '20 par page',
    'toolbar.per_page_50b': '50 par page',
    'toolbar.type_all_n': 'Tous types ({n})',
    'toolbar.type_new_n': 'Nouveaux ({n})',
    'toolbar.type_steps_n': 'Étapes ({n})',
    'toolbar.type_progress_n': 'Progressions ({n})',

    // ── Confidentialité ──
    'privacy.title': 'Confidentialité et anonymat',
    'privacy.item1': 'Le numéro de dossier est remplacé par un hash SHA-256 irréversible',
    'privacy.item2': 'Les dates sont tronquées au jour (pas d’heure ni de minute)',
    'privacy.item3': 'Aucune donnée personnelle n’est collectée (pas de nom, email, adresse)',
    'privacy.item4': 'Le partage est activé par défaut et peut être désactivé dans les paramètres',

    // ── Accueil : messages d'état ──
    'accueil.no_data_title': 'Aucune donnée disponible pour le moment.',
    'accueil.no_data_sub': 'Les données apparaîtront quand des utilisateurs partageront leurs statistiques.',
    'accueil.error_title': 'Impossible de charger les statistiques.',
    'accueil.sdanf_empty': 'Aucun dossier au contrôle SDANF/SCEC',
    'accueil.entretien_empty': 'Aucun dossier en phase entretien',
    'accueil.no_status_change': 'Aucun changement de statut détecté',
    'accueil.mouvements_empty': 'Aucun mouvement détecté sur cette période',
    'accueil.activity_empty': 'Aucune activité récente',
    'accueil.sans_entretien_warning': 'Dossier en phase décision sans être passé par l’entretien — ajournement ou classement anticipé probable',

    // ── Pills SDANF (label long + court) ──
    'pill.controle_a_affecter.label': 'Contrôle à affecter', 'pill.controle_a_affecter.short': 'À affecter',
    'pill.controle_a_effectuer.label': 'Contrôle à effectuer', 'pill.controle_a_effectuer.short': 'À effectuer',
    'pill.controle_en_attente_pec.label': 'En attente PEC', 'pill.controle_en_attente_pec.short': 'Attente PEC',
    'pill.controle_pec_a_faire.label': 'PEC à faire', 'pill.controle_pec_a_faire.short': 'PEC à faire',
    'pill.a_verifier_avant_insertion_decret.label': 'Vérifs avant décret', 'pill.a_verifier_avant_insertion_decret.short': 'Vérifs décret',
    'pill.prete_pour_insertion_decret.label': 'Prêt pour décret', 'pill.prete_pour_insertion_decret.short': 'Prêt décret',
    'pill.inseree_dans_decret.label': 'Inséré au décret', 'pill.inseree_dans_decret.short': 'Inséré décret',

    // ── Sous-labels KPI bar SDANF ──
    'sublabel.controle_a_affecter': 'Attente affectation',
    'sublabel.controle_a_effectuer': 'Contrôle en cours',
    'sublabel.controle_en_attente_pec': 'Transmis SCEC',
    'sublabel.controle_pec_a_faire': 'Vérif. état civil',
    'sublabel.a_verifier_avant_insertion_decret': 'Vérifs avant décret',
    'sublabel.prete_pour_insertion_decret': 'Prêt pour décret',
    'sublabel.inseree_dans_decret': 'Inséré au décret',

    // ── Labels filtre entretien ──
    'elabel.instruction_date_ea_a_fixer': 'Enquêtes en cours',
    'elabel.ea_demande_report_ea': 'Report entretien',
    'elabel.ea_en_attente_ea': 'Convocation entretien',
    'elabel.ea_crea_a_valider': 'Compte-rendu',
    'elabel.prop_decision_pref_a_effectuer': 'Avis préfectoral',
    'elabel.prop_decision_pref_en_attente_retour_hierarchique': 'Valid. hiérarchique',
    'elabel.prop_decision_pref_prop_a_editer': 'Rédaction décision',
    'elabel.prop_decision_pref_en_attente_retour_signataire': 'Signature préfet',

    // ── KPI bar (libellés agrégés) ──
    'kpibar.total': 'total',
    'kpibar.interview_passed': 'entretien passé',
    'kpibar.pending': 'en attente',
    'kpibar.decision_no_interview': 'décision sans entretien',
    'kpibar.avg_duration': 'durée moy.',

    // ── Badges de ligne ──
    'badge.decision_no_interview': 'Décision sans entretien',
    'badge.interview_passed': 'Entretien passé',
    'badge.waiting': 'En attente',
    'badge.status_changed': 'Statut modifié',

    // ── Mouvements du jour (phrases au pluriel) ──
    'mouv.arrivedStep9': { one: 'dossier passé à l’étape SDANF', other: 'dossiers passés à l’étape SDANF' },
    'mouv.caaToCAE': { one: 'dossier pris en charge par la SDANF', other: 'dossiers pris en charge par la SDANF' },
    'mouv.sdanfToSCEC': { one: 'dossier transféré au SCEC', other: 'dossiers transférés au SCEC' },
    'mouv.arrivedDecret': { one: 'dossier inséré dans le décret', other: 'dossiers insérés dans le décret' },

    // ── Activité (types) ──
    'activity.first_seen': 'Nouveau',
    'activity.step_change': 'Étape',
    'activity.status_change': 'Progression',
    'activity.deposit': 'Dépôt',
    'activity.interview': 'Entretien',

    // ── Modale détails dossier ──
    'modal.deposit_title': 'Dépôt du dossier',
    'modal.deposit_detail': 'Date officielle de dépôt enregistrée par l’ANEF',
    'modal.interview_title': 'Entretien d’assimilation',
    'modal.interview_detail': 'Date de l’entretien d’assimilation',
    'modal.first_seen': 'Première observation — étape {step}',
    'modal.finished': 'Terminé — {date}',
    'modal.in_progress': '(en cours)',
    'modal.history_label': 'Historique des transitions',
    'modal.no_transitions': 'Aucune transition observée',
    'modal.details_title': 'Détails du dossier',

    // ── Décrets ──
    'decret.published_jo': 'Publié au JO',
    'decret.pending_jo': 'En attente JO',
    'decret.decret_count': { one: '{n} décret', other: '{n} décrets' },
    'decret.modal_title': 'Décrets de naturalisation',
    'decret.back_to_decrets': 'Retour aux décrets',
    'decret.detail_title': 'Décret {num}',

    // ── Fiche détail (modale) ──
    'detail.depot': 'Dépôt',
    'detail.finalized_on': 'Finalisé le',
    'detail.status_since': 'Statut depuis',
    'detail.total_duration': 'Durée totale',
    'detail.location': 'Lieu',
    'detail.prefecture': 'Préfecture',
    'detail.decret': 'Décret',
    'detail.complement': 'Complément',
    'detail.requested': 'Demandé',
    'detail.last_check': 'Dernière vérif.',

    // ── Indicateur de fraîcheur ──
    'fresh.just_now': 'à l’instant',
    'fresh.ago_min': 'il y a {n} min',
    'fresh.ago_hour': 'il y a {h}h{m}',
    'fresh.ago_day': 'il y a {n}j',
    'fresh.at_datetime': 'le {dd}/{mm} à {hh}:{min}',
    'fresh.unavailable': 'indisponible',

    // ── Historique cron ──
    'cron.title': 'Historique des actualisations',
    'cron.loading': 'Chargement…',
    'cron.no_run': 'Aucun run trouvé',

    // ── Filtres partagés (filters.js / searchable-select.js) ──
    'filter.all': 'Toutes',
    'filter.all_steps': 'Toutes les étapes',
    'filter.search': 'Rechercher…',
    'filter.search_status': 'Rechercher un statut…',
    'filter.search_pref': 'Rechercher une préfecture…',
    'filter.no_status': 'Aucun statut trouvé',
    'filter.all_prefectures': 'Toutes les préfectures',
    'filter.pref_all_label': 'Préf. : toutes',
    'filter.selected_count': { one: '{n} sélectionnée', other: '{n} sélectionnées' },
    'filter.outcome_all': 'Tous',
    'filter.outcome_ongoing': 'En cours',
    'filter.outcome_favorable': 'Favorable',
    'filter.outcome_unfavorable': 'Défavorable',
    'filter.complement_all': 'Tous',
    'filter.complement_with': 'Avec complément',
    'filter.complement_without': 'Sans complément',

    // ── Durées (formatDuration) ──
    'dur.lt1day': '< 1 jour',
    'dur.day_short': 'j',
    'dur.month_short': 'mois',
    'dur.days': { one: '{n} jour', other: '{n} jours' },
    'dur.months': { one: '{n} mois', other: '{n} mois' },
    'dur.years': { one: '{n} an', other: '{n} ans' }
  });
})();
