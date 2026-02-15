# Politique de confidentialité — ANEF Status Tracker

*Dernière mise à jour : 15 février 2026*

## Données collectées

### Données stockées localement (sur votre appareil uniquement)
- **Statut du dossier** : statut actuel et historique des changements
- **Identifiants ANEF** : chiffrés localement avec AES-256-GCM, jamais transmis à des tiers
- **Paramètres** : préférences de notifications et de vérification automatique
- **Journal des vérifications** : horodatage des vérifications automatiques (conservé 24h)

### Statistiques anonymes (opt-in)
Si vous activez les statistiques anonymes dans les paramètres, les données suivantes sont envoyées :
- Étape actuelle du dossier (numéro uniquement)
- Statut actuel (code uniquement)
- Département de la préfecture
- Date du dernier changement de statut

Ces données sont **agrégées et anonymes** : aucun identifiant personnel, numéro de dossier, nom ou adresse email n'est collecté ni transmis.

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
