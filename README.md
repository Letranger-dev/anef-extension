# ANEF Status Tracker

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/icnpklneeaiffilemaflccdejefpehek?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white&color=4285F4)](https://chromewebstore.google.com/detail/anef-status-tracker/icnpklneeaiffilemaflccdejefpehek)

Extension Chrome pour suivre votre statut de naturalisation française en temps réel.

> **💬 Bugs ou suggestions ?** Rejoignez le groupe Facebook pour en discuter :
> 👉 [Groupe Facebook - ANEF Status Tracker](https://www.facebook.com/groups/1206709331640208)

## Fonctionnalités

- **Affichage du statut réel** - Déchiffre et affiche le vrai code statut de votre dossier ANEF
- **Suivi de progression** - Visualisez votre avancement sur les 12 étapes du processus
- **Historique** - Gardez une trace de tous les changements de statut
- **Statistiques temporelles** - Durée depuis le dépôt, date d'entretien, dernière mise à jour
- **Connexion automatique** - Enregistrez vos identifiants pour une connexion rapide
- **Actualisation en arrière-plan** - Rafraîchissez vos données sans quitter votre onglet
- **Export d'image** - Téléchargez une image de votre suivi à partager
- **Notifications** - Soyez alerté lors d'un changement de statut

## Installation

### Méthode 1 : Chrome Web Store (recommandé)

**[Installer depuis le Chrome Web Store](https://chromewebstore.google.com/detail/anef-status-tracker/icnpklneeaiffilemaflccdejefpehek)** — installation en un clic, mises à jour automatiques.

### Méthode 2 : Télécharger depuis les Releases

1. Téléchargez le fichier ZIP depuis la [page Releases](../../releases/latest)
2. Décompressez le fichier ZIP
3. Ouvrez Chrome et accédez à `chrome://extensions`
4. Activez le **Mode développeur** (bouton en haut à droite)
5. Cliquez sur **"Charger l'extension non empaquetée"**
6. Sélectionnez le dossier décompressé

### Méthode 3 : Cloner le repository

```bash
git clone https://github.com/Letranger-dev/anef-extension.git
```

Puis suivez les étapes 3-6 ci-dessus.

## Utilisation

1. Connectez-vous sur le site [ANEF](https://administration-etrangers-en-france.interieur.gouv.fr/)
2. Cliquez sur l'icône de l'extension dans la barre Chrome
3. Votre statut s'affiche automatiquement

### Connexion automatique (optionnel)

1. Cliquez sur l'icône de l'extension
2. Allez dans **Paramètres** (icône engrenage)
3. Dans l'onglet **Identifiants**, entrez vos identifiants ANEF
4. Cliquez sur **Enregistrer**

Vos identifiants sont stockés localement et ne sont jamais envoyés ailleurs.

## Statistiques communautaires

L'extension propose un **tableau de bord public** avec des statistiques anonymes sur les dossiers de naturalisation :

**[Voir les statistiques](https://letranger-dev.github.io/anef-extension/)**

### Ce que vous y trouverez

- **Vue d'ensemble** des dossiers suivis par etape
- **Delais moyens** entre chaque etape (depot, instruction, entretien, decret...)
- **Comparaison par prefecture** pour situer votre attente
- **Tendances** et evolution des delais dans le temps
- **Parcours types** et goulots d'etranglement

### Protection de vos donnees

La confidentialite de vos donnees est notre priorite absolue. Voici les garanties :

- **Aucune donnee personnelle n'est collectee** : ni nom, ni email, ni numero de dossier en clair
- **Hash SHA-256 irreversible** : votre numero de dossier est transforme en empreinte cryptographique a sens unique — il est mathematiquement impossible de retrouver le numero original
- **Dates tronquees** : seul le jour est conserve (pas l'heure)
- **Opt-out possible** : vous pouvez desactiver l'envoi dans les parametres de l'extension a tout moment
- **Code source ouvert** : le code de collecte (`lib/anonymous-stats.js`) est entierement lisible et verifiable
- **Aucun cookie, aucun tracking** : le site de stats n'utilise ni cookies ni outils d'analyse

Les donnees collectees se limitent a : statut ANEF, etape, prefecture, type de demande, et dates (depot, statut, entretien). Rien de plus.

## Codes statut

L'extension traduit les codes cryptés en informations compréhensibles :

| Étape | Phase | Description |
|-------|-------|-------------|
| 1-2 | Dépôt | Dossier en préparation ou déposé |
| 3-4 | Vérification | Contrôle de complétude par la préfecture |
| 5 | Récépissé | Dossier complet, récépissé envoyé |
| 6 | Entretien | Convocation et passage de l'entretien |
| 7 | Décision préfecture | Avis de la préfecture |
| 8 | Contrôle SDANF | Vérification par le service central |
| 9-10 | Décret | Préparation et signature du décret |
| 11 | Publication | Envoi à la préfecture et notification |
| 12 | Finalisé | Décret publié au Journal Officiel |

## Structure du projet

```
anef-extension/
├── manifest.json           # Configuration de l'extension
├── background/
│   └── service-worker.js   # Service worker (orchestrateur)
├── content/
│   ├── content-script.js   # Script injecté sur les pages ANEF
│   ├── injected-script.js  # Interception des API et déchiffrement
│   └── auto-login.js       # Connexion automatique
├── lib/
│   ├── storage.js          # Gestion du stockage
│   ├── status-parser.js    # Dictionnaire des statuts
│   ├── constants.js        # Constantes (Supabase, etc.)
│   ├── anonymous-stats.js  # Envoi des stats anonymes
│   └── logger.js           # Module de logging
├── popup/
│   ├── popup.html          # Interface du popup
│   ├── popup.js            # Logique du popup
│   └── popup.css           # Styles du popup
├── options/
│   ├── options.html        # Page des paramètres
│   ├── options.js          # Logique des paramètres
│   └── options.css         # Styles des paramètres
├── docs/                   # Site de statistiques (GitHub Pages)
│   ├── index.html          # Accueil
│   ├── dossiers.html       # Repartition des dossiers
│   ├── delais.html         # Estimateur de delais
│   ├── prefectures.html    # Comparaison par prefecture
│   ├── tendances.html      # Tendances temporelles
│   ├── parcours.html       # Analyse de parcours
│   └── shared/             # JS/CSS partages entre les pages
└── assets/
    └── icon-*.png          # Icônes de l'extension
```

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## Avertissement

Cette extension est un outil personnel de suivi. Elle n'est pas affiliée au Ministère de l'Intérieur ni à aucun service officiel. Utilisez-la à vos propres risques.

## Remerciements

Un grand merci aux auteurs de l'extension [status_naturalisation](https://github.com/divisi0n/status_naturalisation) dont le travail a servi de base et d'inspiration pour ce projet. Leur contribution à la communauté a permis de rendre le suivi de naturalisation accessible à tous.

## Licence

MIT License - Voir le fichier [LICENSE](LICENSE) pour plus de détails.
