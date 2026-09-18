# Politique de confidentialité — ANEF Status Tracker

*Dernière mise à jour : 23 août 2026*

## Données collectées

### Données stockées localement (sur votre appareil uniquement)
- **Statut du dossier** : statut actuel et historique des changements
- **Identifiants ANEF** : chiffrés localement avec AES-256-GCM, jamais transmis à des tiers
- **Paramètres** : préférences de notifications et de vérification automatique
- **Journal des vérifications** : horodatage des vérifications automatiques (conservé 24h)
- **Préférence d'affichage du mode privé** : état activé/désactivé du bouton de masquage visuel
- **Demande de modification du décret (DMR)** : si vous en avez déposé une sur votre espace ANEF, l'extension en lit le suivi — état de la demande, date de dépôt, décret concerné, personnes que vous avez demandé à ajouter (prénom, nom, date et lieu de naissance), types de justificatifs joints, et le lien temporaire vers votre attestation de dépôt

> **À noter** : la rubrique DMR est la seule à faire apparaître des noms — les vôtres et ceux des personnes que vous avez demandé à ajouter au décret, généralement vos enfants. Ces informations proviennent de votre propre espace ANEF, restent sur votre appareil, ne sont ni synchronisées ni envoyées à un serveur, et disparaissent si vous désinstallez l'extension ou effacez ses données.

### Partage des statistiques
- **Date de première activation du partage**, conservée localement pour information (voir plus bas)

### Mode privé (masquage visuel)
Un bouton en forme d'œil dans l'interface permet de masquer visuellement (effet flou CSS) les données sensibles — numéro de dossier, numéro national, préfecture, dates, lieu d'entretien, numéro de décret, type de demande, ainsi que les noms et dates de naissance affichés dans le suivi de la demande de modification du décret. Cette fonctionnalité est purement locale : aucune donnée n'est transmise ou modifiée, seul l'affichage est altéré pour faciliter le partage d'écran ou les captures.

### Statistiques communautaires

> **À partir de la version 2.11.0, le partage fait partie de l'utilisation de l'extension.** Installer et utiliser ANEF Status Tracker vaut acceptation du partage décrit ci-dessous. Il n'y a plus d'interrupteur pour le désactiver : les statistiques publiques sur les délais de naturalisation n'existent que parce que chaque utilisateur y contribue. Si vous ne souhaitez pas participer, n'installez pas l'extension, ou désinstallez-la — c'est le seul moyen d'interrompre les envois.

**Ce que « partagé » veut dire exactement.** Le partage est conçu pour qu'on ne puisse pas remonter jusqu'à vous :

- **Votre numéro de dossier n'est jamais transmis.** Il est réduit sur votre appareil à une empreinte à sens unique, puis re-transformé sur le serveur avec une clé secrète que l'extension ne possède pas. L'identifiant publié sur le site public n'est donc pas re-calculable : même en téléchargeant l'intégralité des données, personne ne peut retrouver un numéro de dossier.
- **Ne quittent jamais votre appareil** : votre nom, votre adresse e-mail, vos identifiants de connexion ANEF, votre numéro national, l'adresse de votre domicile, et l'intégralité du suivi de votre demande de modification du décret — y compris les noms et dates de naissance de vos enfants.
- **Les dates sont tronquées au jour**, jamais d'heure.
- **Rien n'est publié individuellement** : le site n'affiche que des agrégats (médianes, délais par étape, comparaisons entre préfectures).
- **Aucune publicité, aucun traceur, aucun tiers.** Les données ne sont ni revendues, ni partagées avec qui que ce soit, ni utilisées à d'autres fins que ces statistiques.
- **Le code de collecte est ouvert** et tient dans un seul fichier (`lib/anonymous-stats.js`) : la liste des champs transmis est fermée et vérifiable ligne à ligne.

**Pourquoi nous ne disons pas « anonyme ».** Par honnêteté. L'empreinte du dossier est stable dans le temps, pour pouvoir relier entre eux les instantanés d'une même demande — c'est ce qui permet de calculer combien de temps dure chaque étape. Cette stabilité suffit, au sens du RGPD, à qualifier la donnée de **pseudonymisée** plutôt que d'anonyme. Concrètement, cela ne change rien à ce qui précède : l'identifiant publié n'est pas re-calculable, et nous ne détenons aucun élément permettant de vous nommer. Mais nous préférons employer le mot juste plutôt que de promettre plus que ce que la technique garantit.

**Vos droits.** Vous pouvez à tout moment demander l'accès aux données rattachées à votre demande, leur rectification ou leur effacement, en ouvrant une issue sur le dépôt GitHub (voir *Contact*). La désinstallation de l'extension arrête immédiatement tout nouvel envoi.

**Utilisateurs des versions 2.10.0 à 2.10.x.** Ces versions demandaient votre accord avant tout envoi. À la mise à jour vers la 2.11.0, le partage devient systématique, y compris si vous aviez répondu « non ». Ce document et le README en font état ; si ce changement ne vous convient pas, la désinstallation reste possible à tout moment.

Si vous acceptez, les données suivantes sont envoyées à Supabase (hébergé en UE) pour alimenter les statistiques communautaires sur les délais de naturalisation :

**Identifiant pseudonymisé :**
- Le numéro de dossier est transformé en identifiant opaque au moyen d'une pseudonymisation cryptographique à double étage incluant une clé secrète serveur. Il est non-réversible vers le numéro d'origine.
- L'interface des statistiques publiques n'affiche aucun identifiant reconnaissable : les dossiers y sont représentés uniquement par leurs métadonnées (statut, préfecture, dates).

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

**Ce qui n'est jamais transmis**, bien que présent sur votre appareil : vos identifiants ANEF, l'adresse de votre domicile, l'ensemble du suivi de votre demande de modification du décret (noms, dates de naissance, justificatifs, attestation). L'envoi anonyme repose sur une liste fermée de champs — les champs ci-dessus n'y figurent pas et ne peuvent pas s'y ajouter par accident.

Ces données sont **pseudonymisées** : aucun nom, email, numéro de dossier en clair ou donnée d'identification directe n'est collecté ni transmis. Cependant, la combinaison de certains champs (code postal, ville, lieu d'entretien) pourrait théoriquement permettre une ré-identification dans les préfectures traitant peu de dossiers.

### Note sur les données antérieures au 23 avril 2026

Un renforcement de la pseudonymisation a été déployé le 23 avril 2026. Les nouvelles données suivent le modèle décrit ci-dessus. Des exports antérieurs à cette date, s'ils ont été téléchargés et archivés par des tiers avant la mise à jour, restent hors de notre contrôle. Si vous souhaitez que votre dossier soit retiré de la base communautaire, contactez-nous via GitHub.

## Données jamais transmises
Ces éléments ne quittent jamais votre appareil — ni vers nos statistiques, ni vers un tiers :
- Aucun nom, email ou information personnelle (y compris le suivi DMR, qui en contient et reste local)
- Aucun numéro de dossier ANEF
- Aucun identifiant de connexion
- Aucun cookie ou donnée de navigation
- Aucune donnée vendue ou partagée avec des tiers

## Stockage
- Les données locales sont stockées via `chrome.storage.local` sur votre appareil
- L'historique des statuts est sauvegardé via `chrome.storage.sync` pour la synchronisation entre vos appareils Chrome. Cette sauvegarde ne porte que sur l'historique des statuts, le statut courant et vos dates corrigées manuellement : ni les identifiants, ni les détails du dossier, ni le suivi DMR n'y figurent
- Les statistiques communautaires sont stockées sur Supabase (hébergé en UE)

## Autorisations
- **storage** : stockage local des données du dossier et des paramètres
- **alarms** : vérification automatique périodique du statut (par défaut toutes les 60 minutes)
- **notifications** : alertes lors des changements de statut
- **clipboardWrite** : bouton "copier" sur les éléments affichés
- **Accès au site ANEF** : lecture des données de votre dossier sur le portail officiel et son mécanisme d'authentification

## Contact
Pour toute question concernant cette politique de confidentialité, ouvrez une issue sur le dépôt GitHub du projet.

## Modifications
Cette politique peut être mise à jour. Les modifications seront publiées sur cette page.
