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

### Choix de partage
- **Réponse au consentement** : votre accord ou votre refus concernant les statistiques communautaires, la date de cette décision et la version de la notice affichée (voir plus bas)

### Mode privé (masquage visuel)
Un bouton en forme d'œil dans l'interface permet de masquer visuellement (effet flou CSS) les données sensibles — numéro de dossier, numéro national, préfecture, dates, lieu d'entretien, numéro de décret, type de demande, ainsi que les noms et dates de naissance affichés dans le suivi de la demande de modification du décret. Cette fonctionnalité est purement locale : aucune donnée n'est transmise ou modifiée, seul l'affichage est altéré pour faciliter le partage d'écran ou les captures.

### Statistiques anonymes

> **Rien n'est envoyé sans votre accord explicite.** Le partage est **désactivé par défaut**. À la première ouverture, l'extension pose la question dans son popup ; tant que vous n'avez pas répondu « Accepter », aucune donnée ne quitte votre appareil. La base juridique de ce traitement est votre consentement (RGPD art. 6-1-a).

**Comment retirer votre accord.** À tout moment, dans *Paramètres → Statistiques communautaires*, l'interrupteur « Partager mes données anonymisées » coupe immédiatement les envois — en un clic, sans confirmation, sans redémarrer l'extension (RGPD art. 7-3). Refuser ou se rétracter n'enlève aucune fonctionnalité : suivi du statut, notifications, historique, vérification automatique et suivi DMR fonctionnent à l'identique.

**Ce que l'extension mémorise de votre choix.** Uniquement, en local : la réponse (oui/non), sa date, et la version de la notice d'information qui vous a été présentée. Ces trois éléments ne sont jamais transmis ; ils servent à ne pas reposer la question et à pouvoir justifier du consentement (RGPD art. 7-1).

**Utilisateurs des versions antérieures à la 2.10.0.** Ces versions envoyaient les statistiques par défaut. Un réglage activé d'office n'est pas un consentement : à la mise à jour, la collecte est **suspendue** et la question vous est posée. Elle ne reprend que si vous répondez « Accepter ». Les données déjà présentes dans la base communautaire restent pseudonymisées et non rattachables à votre identité ; pour en demander le retrait, ouvrez une issue sur le dépôt GitHub.

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
- Les statistiques anonymes sont stockées sur Supabase (hébergé en UE)

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
