# Politique de confidentialité — ANEF Status Tracker

*Dernière mise à jour : 2 avril 2026*

## Données collectées

### Données stockées localement (sur votre appareil uniquement)
- **Statut du dossier** : statut actuel et historique des changements
- **Identifiants ANEF** : chiffrés localement avec AES-256-GCM, jamais transmis à des tiers
- **Paramètres** : préférences de notifications et de vérification automatique
- **Journal des vérifications** : horodatage des vérifications automatiques (conservé 24h)

### Statistiques anonymes
Les données suivantes sont envoyées à Supabase (hébergé en UE) pour alimenter les statistiques communautaires sur les délais de naturalisation :

**Identifiant pseudonymisé :**
- Empreinte SHA-256 du numéro de dossier (irréversible, ne permet pas de retrouver le numéro)

**Données liées au dossier :**
- Étape actuelle (numéro de 1 à 12)
- Phase de traitement (libellé associé à l'étape)
- Statut actuel (code technique, ex. `instruction_a_affecter`)
- Date de dépôt du dossier (jour uniquement, sans heure)
- Date du dernier changement de statut (jour uniquement)
- Présence d'une demande de complément (oui/non)
- Type de demande (ex. naturalisation)

**Données géographiques :**
- Département de la préfecture
- Code postal du domicile (utilisé pour déterminer le département si la préfecture est absente)
- Ville du domicile
- Lieu de l'entretien d'assimilation

**Données liées à l'entretien et au décret :**
- Date de l'entretien d'assimilation (jour uniquement)
- Numéro de décret (si applicable)

**Données techniques :**
- Version de l'extension
- Horodatage de la vérification
- Source de la donnée (automatique ou saisie manuelle)

Ces données sont **pseudonymisées** : aucun nom, email, numéro de dossier en clair ou donnée d'identification directe n'est collecté ni transmis. Cependant, la combinaison de certains champs (code postal, ville, lieu d'entretien) pourrait théoriquement permettre une ré-identification dans les préfectures traitant peu de dossiers.

## Données NON collectées
- Aucun nom, email ou information personnelle
- Aucun numéro de dossier ANEF
- Aucun cookie ou donnée de navigation
- Aucune donnée vendue ou partagée avec des tiers

## Stockage
- Les données locales sont stockées via `chrome.storage.local` sur votre appareil
- L'historique est sauvegardé via `chrome.storage.sync` pour la synchronisation entre vos appareils Chrome
- Les statistiques anonymes sont stockées sur Supabase (hébergé en UE)

## Autorisations
- **storage** : stockage local des données du dossier et des paramètres
- **alarms** : vérification automatique périodique du statut
- **notifications** : alertes lors des changements de statut
- **tabs** : ouverture temporaire du portail ANEF pour les vérifications automatiques
- **Accès au site ANEF** : lecture des données de votre dossier sur le portail officiel

## Contact
Pour toute question concernant cette politique de confidentialité, ouvrez une issue sur le dépôt GitHub du projet.

## Modifications
Cette politique peut être mise à jour. Les modifications seront publiées sur cette page.
