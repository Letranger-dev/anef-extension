# Commande : Check de non-régression complet

## Contexte

Tu es un QA engineer senior. Tu dois produire une étude de non-régression exhaustive avec code review.

Le fichier `tests/regression-log.md` sert de journal. Chaque exécution de cette commande **incrémente** le numéro de run et **ajoute** une nouvelle section datée dans ce fichier — ne jamais écraser les runs précédents.

## Étapes à suivre (dans l'ordre)

### Phase 1 — Préparation

1. Lire `tests/regression-log.md` pour récupérer le dernier numéro de run (créer le fichier s'il n'existe pas, commencer à Run #1).
2. Exécuter `git diff HEAD --stat` et `git diff HEAD` pour identifier **tous** les fichiers modifiés.
3. Si aucun fichier modifié, exécuter `git log -1 --format="%H %s"` et faire le diff avec le commit précédent (`git diff HEAD~1 HEAD`).
4. Créer une TaskList avec toutes les étapes ci-dessous.

### Phase 2 — Inventaire des changements

Pour chaque fichier modifié :
- Lire le fichier **en entier** (pas de skip).
- Lister chaque modification : numéro de ligne, nature (ajout/suppression/modification), description concise.
- Classifier : `[FEATURE]`, `[FIX]`, `[REFACTOR]`, `[CLEANUP]`, `[SECURITY]`.

### Phase 3 — Code review approfondie

Pour chaque fichier modifié, vérifier **tous** ces points :

#### 3.1 Correctness
- La logique est-elle correcte ? Tester mentalement chaque branche (if/else/switch).
- Les edge cases sont-ils gérés ? (null, undefined, tableau vide, erreur réseau, timeout)
- Les types sont-ils cohérents ? (boolean vs truthy, string vs number)
- Y a-t-il du code mort ou inatteignable ?

#### 3.2 Concurrence & timing
- Race conditions possibles ? (async/await, callbacks, events)
- Variables globales partagées entre appels concurrents ?
- Les Promises sont-elles toutes awaited ou catch-ées ?
- Les `setTimeout`/`setInterval` sont-ils nettoyés ?

#### 3.3 Robustesse
- Les appels Chrome API (`chrome.runtime`, `chrome.storage`, `chrome.tabs`, `chrome.windows`) sont-ils protégés par try-catch ?
- Les `sendMessage` sont-ils protégés contre `Extension context invalidated` (try-catch **synchrone**, pas juste `.catch()`) ?
- Les accès DOM sont-ils null-safe (`?.`, `if (el)`) ?

#### 3.4 Sécurité
- Injection de code possible ? (innerHTML, eval, postMessage sans vérification origin)
- Credentials exposés en clair dans les logs ?
- Permissions manifest minimales ?

#### 3.5 Performance
- Boucles avec `await` dans le body qui pourraient être parallélisées ?
- Accès storage/API redondants dans la même boucle ?
- Memory leaks (event listeners non nettoyés, intervals non clearés) ?

#### 3.6 Cohérence
- Le style de code est-il cohérent avec le reste du fichier ?
- Les noms de variables/fonctions suivent-ils les conventions existantes ?
- Les logs suivent-ils le format existant (emoji + message) ?

### Phase 4 — Analyse d'impact

Pour chaque modification, identifier :
- **Chemins d'exécution impactés** : quelles fonctionnalités passent par ce code ?
- **Chemins non impactés** : quelles fonctionnalités sont garanties non touchées ? (justifier en citant les fichiers/fonctions)
- **Effets de bord possibles** : une modif dans le service worker peut-elle impacter le popup ? le content script ? la page options ?

### Phase 5 — Matrice de non-régression

Produire une matrice complète en 7 catégories. Pour chaque test :
- **ID** unique (ex: `A1`, `B3`)
- **Scénario** : description précise et reproductible
- **Résultat attendu** : ce qu'on doit observer
- **Vérification** : comment confirmer (console, UI, storage, réseau)
- **Impacté par cette release ?** : Oui/Non + justification (quel changement)

Catégories obligatoires :
- **A** — Refresh manuel (popup)
- **B** — Abort / concurrence de refreshes
- **C** — Auto-check en arrière-plan
- **D** — Login automatique (ANEF + SSO)
- **E** — Fenêtre minimisée / nettoyage
- **F** — UI popup (affichage, export, carousel)
- **G** — Page Options (paramètres, identifiants, check log, export/import)
- **H** — Notifications & badge
- **I** — Content script & injection
- **J** — Maintenance & erreurs réseau

### Phase 6 — Verdict & rapport

1. **Résumé des problèmes trouvés** par sévérité :
   - `CRITICAL` : bug bloquant, perte de données, crash
   - `HIGH` : bug fonctionnel, race condition avérée
   - `MEDIUM` : comportement dégradé, UX confuse
   - `LOW` : cosmétique, log manquant, code mort
   - `INFO` : suggestion d'amélioration (ne pas corriger maintenant)

2. **Verdict global** : `PASS` / `PASS WITH WARNINGS` / `FAIL`

3. Mettre à jour chaque tâche de la TaskList au fur et à mesure.

### Phase 7 — Journalisation

Écrire le résultat dans `tests/regression-log.md` avec ce format :

```markdown
## Run #N — YYYY-MM-DD

**Version extension :** (lire manifest.json)
**Commit :** (hash court + message)
**Fichiers modifiés :** (liste)
**Verdict :** PASS / PASS WITH WARNINGS / FAIL

### Changements
(tableau inventaire Phase 2)

### Problèmes trouvés
(liste Phase 6, ou "Aucun")

### Matrice de non-régression
(tableau complet Phase 5)
```

## Règles

- Ne JAMAIS corriger de code pendant cette commande. C'est une commande **read-only**.
- Si un problème est trouvé, le documenter avec le fichier, la ligne, et la correction suggérée.
- Utiliser des agents Task en parallèle pour accélérer la review quand les fichiers sont indépendants.
- Être exhaustif : mieux vaut un faux positif qu'un bug raté en production.
