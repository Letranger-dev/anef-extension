# Audit : Dossiers terminés — comptage et affichage incorrects

**Date :** 24 mars 2026
**Problème :** Les dossiers ayant atteint la fin de la procédure (insertion décret, publication JO, refus, irrecevabilité) continuent d'accumuler du temps dans les calculs de durée et sont mélangés aux dossiers actifs.

---

## Qu'est-ce qu'un dossier "terminé" ?

La procédure de naturalisation se termine par :

### Fin positive (succès)
- **Étape 11** — Inséré dans un décret signé (`inseree_dans_decret`)
- **Étape 12 positive** — Décret publié au JO (`decret_naturalisation_publie`, `decret_naturalisation_publie_jo`, `decret_publie`, `demande_traitee`)

### Fin négative (échec)
- Décision défavorable (`decision_negative_en_delais_recours`, `decision_notifiee`)
- Irrecevabilité (`irrecevabilite_manifeste`, `irrecevabilite_manifeste_en_delais_recours`)
- Classement sans suite (`css_en_delais_recours`, `css_notifie`)

### Cas particulier : RAPO
- `demande_en_cours_rapo` (étape 12) — Recours administratif en cours
- Le RAPO est un recours obligatoire préalable, le dossier est contesté → **toujours actif**
- `controle_demande_notifiee` — Décision de contrôle notifiée → **terminé**

### Fonctions existantes
- `isPositiveStatus()` dans `constants.js:333` — détecte les fins positives
- `isNegativeStatus()` dans `constants.js:338` — détecte les fins négatives

### Fonction à créer
```javascript
function isFinished(summary) {
  // Étape 11+ = inséré dans le décret ou au-delà (sauf RAPO = recours actif)
  if (summary.currentStep >= 11) {
    var statut = (summary.statut || '').toLowerCase();
    // RAPO = recours en cours, pas terminé
    if (statut === 'demande_en_cours_rapo') return false;
    return true;
  }
  // Fin négative à n'importe quelle étape
  return ANEF.constants.isNegativeStatus(summary.statut);
}
```

---

## Principe de correction

**Les dossiers terminés gardent toute leur valeur historique** (temps passé à chaque étape). Mais :
1. Leur durée ne doit plus compter vers `today` — utiliser `date_statut` du dernier snapshot
2. Ils ne doivent pas gonfler les moyennes des dossiers actifs
3. Ils doivent être visuellement distingués comme "terminés"

---

## Corrections par fichier

### 1. `shared/constants.js` — Nouvelle fonction `isFinished()`

**Ligne :** après ligne 341 (après `isNegativeStatus`)
**Action :** Ajouter la fonction `isFinished()` et l'exporter

```javascript
function isFinished(summary) {
  if (!summary) return false;
  var step = summary.currentStep || summary.etape || 0;
  if (step >= 11) {
    var statut = (summary.statut || '').toLowerCase();
    if (statut === 'demande_en_cours_rapo') return false;
    return true;
  }
  return isNegativeStatus(summary.statut);
}
```

---

### 2. `shared/data.js` — `computeDossierSummaries()` (CAUSE RACINE)

**Lignes :** 194-195
**Code actuel :**
```javascript
var daysAtStatus = latest.date_statut ? ANEF.utils.daysDiff(latest.date_statut, today) : null;
var daysSinceDeposit = latest.date_depot ? ANEF.utils.daysDiff(latest.date_depot, today) : null;
```

**Code corrigé :**
```javascript
var isTerminated = ANEF.constants.isFinished({ currentStep: latest.etape, statut: latest.statut });
// Dossiers terminés : figer la durée à la date du dernier statut
var endDate = isTerminated ? (latest.date_statut ? new Date(latest.date_statut) : today) : today;
var daysAtStatus = latest.date_statut ? ANEF.utils.daysDiff(latest.date_statut, endDate) : null;
var daysSinceDeposit = latest.date_depot ? ANEF.utils.daysDiff(latest.date_depot, endDate) : null;
```

**Aussi :** Ajouter `isFinished: isTerminated` dans l'objet `summaries.push({...})` (ligne ~251+)

**Impact :** Corrige automatiquement tous les endroits qui lisent `daysAtCurrentStatus` et `daysSinceDeposit` → pages dossiers, préfectures, activité, etc.

---

### 3. `shared/data.js` — `computePrefectureStats()`

**Lignes :** 386-398
**Problème :** `p.days.push(s.daysSinceDeposit)` inclut TOUS les dossiers
**Action :** Exclure les dossiers terminés des calculs de durée moyenne

```javascript
// Ligne 394 — remplacer :
if (s.daysSinceDeposit != null) p.days.push(s.daysSinceDeposit);

// Par :
if (s.daysSinceDeposit != null && !s.isFinished) p.days.push(s.daysSinceDeposit);
```

**Note :** Le comptage `p.dossiers++`, `p.favorable++`, `p.defavorable++` reste inchangé — on veut toujours compter les dossiers terminés, juste ne pas les inclure dans la moyenne de durée.

---

### 4. `pages/accueil.js` — `renderKPIs()` — KPI "Durée moyenne"

**Lignes :** 73-81
**Problème :** La moyenne inclut les dossiers terminés
**Action :** Filtrer les dossiers terminés

```javascript
// Ligne 73 — remplacer :
var withDeposit = summaries.filter(function(s) { return s.daysSinceDeposit != null; });

// Par :
var withDeposit = summaries.filter(function(s) { return s.daysSinceDeposit != null && !s.isFinished; });
```

**Aussi :** Mettre à jour le sous-titre pour indiquer le nombre de dossiers actifs :
```javascript
U.setText('kpi-avg-sub', 'depuis le dépôt (' + withDeposit.length + ' dossiers en cours)');
```

---

### 5. `pages/accueil.js` — `renderTimeline()` — Timeline globale

**Lignes :** ~120-230
**Problème :** Les étapes 11 et 12 affichent les dossiers terminés sans distinction
**Action :** Pas de filtrage (on veut voir les dossiers terminés dans la timeline), mais ajouter une indication visuelle. Les compteurs sont corrects car ils montrent la distribution réelle.

**Optionnel :** Ajouter une icône ✓ ou un style différent pour les bulles des étapes 11-12 (fin positive) et un style pour les fins négatives.

---

### 6. `pages/dossiers.js` — Liste des dossiers

**Lignes :** 249-303 (renderDossierRows), 363-414 (renderRowDetail), 418-473 (renderOneCard)
**Problème :** Affiche "X jours au statut" et "X total" pour les dossiers terminés
**Action :** Le fix 2 (computeDossierSummaries) corrige les valeurs. Pour les terminés, `daysAtStatus` sera 0 (date_statut = endDate).

**Amélioration visuelle :** Pour les dossiers terminés, afficher :
- Au lieu de "X jours au statut" → "Terminé" ou "Finalisé le JJ/MM/AAAA"
- Ou ajouter un badge "✓ Terminé" / "✗ Refusé"

**Code à modifier (ligne ~254) :**
```javascript
var daysAtStatus;
if (s.isFinished) {
  daysAtStatus = s.dateStatut ? 'Finalisé le ' + U.formatDateFr(s.dateStatut) : 'Terminé';
} else {
  daysAtStatus = s.daysAtCurrentStatus != null ? U.formatDuration(s.daysAtCurrentStatus) : '—';
}
```

---

### 7. `pages/dossiers.js` — `renderHistogram()` — Distribution des durées

**Ligne :** 698
**Problème :** L'histogramme inclut les dossiers terminés
**Action :** Exclure les terminés OU les séparer visuellement

```javascript
// Ligne 698 — remplacer :
var days = filtered.filter(function(s) { return s.daysSinceDeposit != null; }).map(...)

// Par :
var days = filtered.filter(function(s) { return s.daysSinceDeposit != null && !s.isFinished; }).map(...)
```

---

### 8. `pages/dossiers.js` — "Temps écoulé depuis le dépôt"

**Lignes :** Section "Temps écoulé" (KPI percentiles)
**Problème :** Les percentiles (25%, médiane, 75%, max) incluent les dossiers terminés
**Action :** Filtrer les terminés pour les percentiles, ou au minimum indiquer dans le sous-titre "dossiers en cours uniquement"

---

### 9. `pages/prefectures.js` — Classement et graphiques

**Problème :** Toutes les moyennes utilisent `computePrefectureStats()` (fix 3)
**Action :** Le fix 3 suffit — les moyennes excluront automatiquement les dossiers terminés
**Aucune modification directe nécessaire** dans prefectures.js

---

### 10. `pages/delais.js` — Page Délais

**Lignes :** 85-97 (renderAll)
**Problème :** Le filtre "Issue" par défaut est "Tous" → inclut les terminés
**Actions possibles :**
- a) Changer le filtre par défaut à "En cours" au lieu de "Tous"
- b) Ou garder "Tous" mais les durées seront correctes grâce au fix 2

**Estimateur de délai (ligne 123-216) :** ✅ Déjà correct — utilise `date_depot` → `date_statut` (pas `today`)

**Graphique "Temps cumulé" :** Les barres pour étapes 11-12 montrent la durée totale figée (correcte après fix 2). L'utilisateur peut voir combien de temps les dossiers terminés ont pris.

---

### 11. `shared/stats-math.js` — Fonctions statistiques

**`computeCohorts()` (ligne 65-99) :** ✅ Correct — compte les dossiers par progression, les terminés font partie des stats de complétion

**`survivalCurve()` (ligne 190-248) :** ✅ Correct — utilise `exitDate` pour les dossiers qui ont quitté une étape

---

## Sections déjà correctes (pas de modification nécessaire)

| Section | Raison |
|---------|--------|
| Section SDANF (accueil) | Filtre `currentStep === 9` |
| Section Entretien (accueil) | Filtre `currentStep >= 6 && <= 8` |
| Mouvements du jour (accueil) | Compte les transitions, pas les durées |
| Estimateur de délai (delais) | Utilise `date_depot` → `date_statut` |
| Survival curve (stats-math) | Utilise `exitDate` pour les sortis |
| Cohort analysis (stats-math) | Compte les progressions, pas les durées |
| Durée par étape (dossiers) | Utilise les transitions entre snapshots |

---

## Résumé du plan d'exécution

| # | Fichier | Modification | Priorité | Impact |
|---|---------|-------------|----------|--------|
| 1 | `shared/constants.js` | Ajouter `isFinished()` | **CRITIQUE** | Fonction utilitaire pour tout le reste |
| 2 | `shared/data.js:194` | Figer durées des terminés | **CRITIQUE** | Corrige la source de TOUTES les durées |
| 3 | `shared/data.js:394` | Exclure terminés des moyennes préf. | **HAUT** | Corrige les stats préfectures |
| 4 | `pages/accueil.js:73` | Exclure terminés du KPI durée | **HAUT** | Corrige le KPI principal |
| 5 | `pages/accueil.js` | Badge/style pour étapes 11-12 | **MOYEN** | Visuel amélioré timeline |
| 6 | `pages/dossiers.js:254` | Affichage "Terminé" au lieu de durée | **MOYEN** | Clarté dans la liste |
| 7 | `pages/dossiers.js:698` | Exclure terminés de l'histogramme | **MOYEN** | Distribution non faussée |
| 8 | `pages/dossiers.js` | Exclure terminés des percentiles | **MOYEN** | Stats "Temps écoulé" correctes |
| 9 | `pages/delais.js` | Optionnel : défaut "En cours" | **BAS** | UX améliorée |
