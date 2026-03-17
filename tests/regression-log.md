# Journal de non-régression — ANEF Status Tracker

> Généré automatiquement par la commande `/check`.
> Chaque run est ajouté chronologiquement. Ne pas modifier manuellement.

---

## Run #1 — 2026-03-17

**Version extension :** 2.2.0
**Version site :** 1.16.0
**Commit base :** 1f3617c Site v1.15.3
**Fichiers modifiés :** 11 (190 insertions, 82 suppressions)
**Verdict :** PASS

### Changements

| Fichier | Classification | Description |
|---------|---------------|-------------|
| `manifest.json` | [FEATURE] | Version 2.1.0 → 2.2.0 |
| `lib/constants.js` | [FEATURE] | Ajout `URLPatterns.isPasswordExpired()` |
| `lib/storage.js` | [FEATURE] | Ajout `LAST_CHECK_ATTEMPT`, `saveLastCheckAttempt()`, `getLastCheckAttempt()` ; suppression `disabledByFailure` ; ajout clés à `exportData()` |
| `background/service-worker.js` | [FIX][FEATURE] | Détection mot de passe expiré ; suppression suspension → backoff progressif ; tracking `lastCheckAttempt` ; reset `passwordExpired` à chaque refresh ; migration `disabledByFailure` |
| `popup/popup.html` | [FEATURE] | Vue `view-password-expired` |
| `popup/popup.js` | [FEATURE][SECURITY] | Vue mot de passe expiré ; affichage tentative échouée ; remplacement innerHTML par DOM API |
| `popup/popup.css` | [FEATURE] | Style `.last-check-attempt` |
| `options/options.html` | [FIX] | Texte/bouton bloc suspension → mot de passe expiré |
| `options/options.js` | [FIX] | Remplacement `disabledByFailure` par `passwordExpired` + affichage backoff |
| `docs/pages/dossiers.js` | [FEATURE] | Affichage "Vérifié le ..." sur vues liste et carte |
| `docs/shared/constants.js` | [FEATURE] | Version 1.15.3 → 1.16.0 |

### Problèmes trouvés et corrigés

| Sévérité | Fichier:Ligne | Description | Action |
|----------|---------------|-------------|--------|
| MEDIUM | `service-worker.js:1039` | `ALARM_RETRY_NAME` non clear avant recréation — risque doublon | Corrigé : ajout `chrome.alarms.clear(ALARM_RETRY_NAME)` |
| LOW | `service-worker.js:1117` | Migration string hardcodé au lieu de `STORAGE_KEYS` | Corrigé : `storage.STORAGE_KEYS.AUTO_CHECK_META` |

### Matrice de non-régression (39 tests)

| ID | Scénario | Impacté ? |
|----|----------|-----------|
| **A — Refresh manuel** | | |
| A1 | Clic "Vérifier" depuis noData → ouvre ANEF | Non |
| A2 | Clic "Actualiser" → loading → statut | Oui (lastCheckAttempt) |
| A3 | Refresh réussi → lastCheck + lastCheckAttempt MAJ | Oui |
| A4 | Refresh échoué → lastCheckAttempt success:false | Oui |
| A5 | Refresh quand mdp expiré → vue password-expired | Oui |
| A6 | Bouton "Renouveler sur ANEF" → ouvre login | Oui |
| **B — Abort** | | |
| B1 | Double clic → premier annulé | Non |
| B2 | Manuel pendant auto-check → auto annulé | Non |
| B3 | Aborted → pas de lastCheckAttempt écrit | Oui |
| **C — Auto-check** | | |
| C1 | Réussi → reset failures + lastCheckAttempt | Oui |
| C2 | 1er échec → failures=1, backoff x1.5, retry +30min | Oui |
| C3 | 3ème échec → intervalle ~10h, PAS de suspension | Oui |
| C4 | 4+ échecs → cap x4 (~12h), continue | Oui |
| C5 | Cooldown < 90min → skip | Non |
| C6 | PC éteint longtemps → check rapide | Non |
| C7 | Mdp expiré → flag, pas compté comme échec | Oui |
| C8 | Maintenance → pas compté comme échec | Non |
| C9 | Retry alarm → clear puis create proprement | Oui |
| **D — Login automatique** | | |
| D1 | Page ANEF + credentials → auto-login | Non |
| D2 | Page SSO + credentials → formulaire rempli | Non |
| D3 | Page UPDATE_PASSWORD → break immédiat | Oui |
| D4 | isPasswordExpired vérifié AVANT isSSOPage | Oui |
| D5 | Login réussi → loginCompleted, passwordExpired reset | Oui |
| **E — Fenêtre** | | |
| E1 | Timeout → fenêtre fermée | Non |
| E2 | Erreur → fenêtre fermée (catch) | Non |
| E3 | Annulé → fenêtre fermée | Non |
| E4 | Mdp expiré → break → fenêtre fermée | Oui |
| **F — UI popup** | | |
| F1 | Affichage statut normal | Non |
| F2 | Dernière vérification réussie | Non |
| F3 | Vérification réussie + tentative échouée récente | Oui |
| F4 | Aucun succès, une tentative → orange | Oui |
| F5 | Vue maintenance | Non |
| F6 | Vue mot de passe expiré → 🔑 + bouton | Oui |
| F7 | Auto-check info mdp expiré | Oui |
| **G — Options** | | |
| G1 | Toggle auto-check | Non |
| G2 | Statut mdp expiré → dot rouge | Oui |
| G3 | Échecs + backoff → dot warning | Oui |
| G4 | Bouton "Réinitialiser" → reset | Oui |
| G5 | Export inclut nouvelles clés | Oui |
