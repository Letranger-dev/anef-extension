/**
 * Module de stockage - Extension ANEF Status Tracker
 *
 * Gère la persistance des données dans chrome.storage.local :
 * - Statut actuel et historique
 * - Paramètres utilisateur
 * - Identifiants de connexion (encodés localement)
 */

// ─────────────────────────────────────────────────────────────
// Clés de stockage
// ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  LAST_STATUS: 'lastStatus',
  LAST_CHECK: 'lastCheck',
  HISTORY: 'history',
  SETTINGS: 'settings',
  API_DATA: 'apiData',
  CREDENTIALS: 'credentials',
  LAST_CHECK_ATTEMPT: 'lastCheckAttempt',
  AUTO_CHECK_META: 'autoCheckMeta',
  CHECK_LOG: 'checkLog',
  STEP_DATES: 'stepDates',
  // v2.6.0+ multi-dossier
  DOSSIERS: 'dossiers',                // map { dossierId → dossierRecord }
  PRIMARY_DOSSIER_ID: 'primaryDossierId'
};

// Plafond de dossiers stockés localement. Au-delà, on drop le plus ancien
// non-primaire (LRU). Décidé avec le user : 5 = bon compromis UI/performance.
const MAX_DOSSIERS = 5;

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  autoCheckEnabled: true,
  autoCheckInterval: 60,
  autoCheckJitterMin: 0,
  historyLimit: 100,
  anonymousStatsEnabled: true
};

// ─────────────────────────────────────────────────────────────
// Fonctions de base
// ─────────────────────────────────────────────────────────────

export async function get(keys) {
  return new Promise((resolve, reject) => chrome.storage.local.get(keys, (result) => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve(result);
  }));
}

export async function set(data) {
  return new Promise((resolve, reject) => chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

export async function remove(keys) {
  return new Promise((resolve, reject) => chrome.storage.local.remove(keys, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

export async function clear() {
  return new Promise((resolve, reject) => chrome.storage.local.clear(() => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

// ─────────────────────────────────────────────────────────────
// Multi-dossier (v2.6.0+)
// ─────────────────────────────────────────────────────────────

/** Retourne la map { dossierId → record } */
export async function getDossiers() {
  const data = await get(STORAGE_KEYS.DOSSIERS);
  return data[STORAGE_KEYS.DOSSIERS] || {};
}

/** Retourne l'ID du dossier principal (celui avec creds + auto-check) */
export async function getPrimaryDossierId() {
  const data = await get(STORAGE_KEYS.PRIMARY_DOSSIER_ID);
  return data[STORAGE_KEYS.PRIMARY_DOSSIER_ID] || null;
}

/** Retourne le record complet d'un dossier (ou null) */
export async function getDossier(id) {
  if (!id) return null;
  const dossiers = await getDossiers();
  return dossiers[id] || null;
}

/** Retourne le record du dossier principal */
export async function getPrimaryDossier() {
  const id = await getPrimaryDossierId();
  if (!id) return null;
  return getDossier(id);
}

/**
 * Merge partial dans dossiers[id]. Si le dossier n'existe pas encore,
 * le crée. Si aucun primaire n'est défini, ce dossier devient primaire.
 * Applique aussi la règle MAX_DOSSIERS (LRU sur les secondaires).
 */
export async function upsertDossier(id, partial) {
  if (!id) throw new Error('upsertDossier: id requis');
  id = String(id);
  const dossiers = await getDossiers();
  let primaryId = await getPrimaryDossierId();

  const existing = dossiers[id] || {
    lastStatus: null,
    apiData: null,
    history: [],
    stepDates: [],
    lastCheck: null,
    isPrimary: false,
    addedAt: new Date().toISOString()
  };

  dossiers[id] = {
    ...existing,
    ...partial,
    lastSeen: new Date().toISOString()
  };

  // Premier dossier ? Il devient primaire.
  if (!primaryId) {
    primaryId = id;
    dossiers[id].isPrimary = true;
  }

  // Cap à MAX_DOSSIERS — drop le secondaire avec le plus vieux lastSeen.
  const ids = Object.keys(dossiers);
  if (ids.length > MAX_DOSSIERS) {
    const secondaries = ids
      .filter(d => d !== primaryId)
      .sort((a, b) => (dossiers[a].lastSeen || '').localeCompare(dossiers[b].lastSeen || ''));
    const toDrop = ids.length - MAX_DOSSIERS;
    for (let i = 0; i < toDrop && i < secondaries.length; i++) {
      delete dossiers[secondaries[i]];
    }
  }

  await set({
    [STORAGE_KEYS.DOSSIERS]: dossiers,
    [STORAGE_KEYS.PRIMARY_DOSSIER_ID]: primaryId
  });

  // Sync legacy keys si on a touché au primaire
  if (id === primaryId) await _syncLegacyFromPrimary();

  scheduleBackupToSync();
  return dossiers[id];
}

/**
 * Change le dossier principal. L'ancien primaire devient secondaire.
 * ⚠️ Les credentials ne sont PAS liées par dossier — elles pointent
 * vers le user ANEF qui se connecte. Quand on change de principal,
 * on retire les creds pour forcer le user à les re-saisir s'il veut
 * l'auto-check sur le nouveau principal.
 */
export async function setPrimaryDossier(newPrimaryId) {
  const dossiers = await getDossiers();
  if (!dossiers[newPrimaryId]) throw new Error('Dossier inconnu: ' + newPrimaryId);

  for (const id in dossiers) {
    dossiers[id].isPrimary = (id === newPrimaryId);
  }

  await set({
    [STORAGE_KEYS.DOSSIERS]: dossiers,
    [STORAGE_KEYS.PRIMARY_DOSSIER_ID]: newPrimaryId
  });
  await _syncLegacyFromPrimary();
  // Les creds pointaient vers l'ancien primaire → invalidées
  await clearCredentials();
  scheduleBackupToSync();
}

/**
 * Supprime un dossier de la liste LOCALE uniquement.
 * ⚠️ N'AFFECTE PAS Supabase — la règle est stricte : aucun DELETE côté DB.
 * Les snapshots restent anonymes et alimentent les stats communautaires.
 */
export async function removeDossier(id) {
  const primaryId = await getPrimaryDossierId();
  if (id === primaryId) throw new Error('Impossible de retirer le dossier principal (change de principal d\'abord)');
  const dossiers = await getDossiers();
  if (!dossiers[id]) return false;
  delete dossiers[id];
  await set({ [STORAGE_KEYS.DOSSIERS]: dossiers });
  scheduleBackupToSync();
  return true;
}

/** Synchronise les clés legacy (lastStatus, apiData, history, stepDates)
 *  depuis le dossier primaire. Appelé automatiquement après chaque modif
 *  qui touche le primaire — garantit la backward-compat avec tout le code
 *  qui lit encore via les anciennes clés. */
async function _syncLegacyFromPrimary() {
  const primary = await getPrimaryDossier();
  if (!primary) {
    await set({
      [STORAGE_KEYS.LAST_STATUS]: null,
      [STORAGE_KEYS.LAST_CHECK]: null,
      [STORAGE_KEYS.API_DATA]: null,
      [STORAGE_KEYS.HISTORY]: [],
      [STORAGE_KEYS.STEP_DATES]: []
    });
    return;
  }
  await set({
    [STORAGE_KEYS.LAST_STATUS]: primary.lastStatus,
    [STORAGE_KEYS.LAST_CHECK]: primary.lastCheck,
    [STORAGE_KEYS.API_DATA]: primary.apiData,
    [STORAGE_KEYS.HISTORY]: primary.history || [],
    [STORAGE_KEYS.STEP_DATES]: primary.stepDates || []
  });
}

/**
 * Migration one-shot : prend les données v2.5.x (clés plates) et les
 * enferme dans dossiers[id] avec isPrimary=true. Idempotent.
 * Retourne true si une migration a eu lieu.
 */
export async function migrateToMultiDossier() {
  const existing = await get([
    STORAGE_KEYS.DOSSIERS,
    STORAGE_KEYS.LAST_STATUS,
    STORAGE_KEYS.API_DATA,
    STORAGE_KEYS.HISTORY,
    STORAGE_KEYS.STEP_DATES,
    STORAGE_KEYS.LAST_CHECK
  ]);

  // Déjà migré ?
  if (existing[STORAGE_KEYS.DOSSIERS] && Object.keys(existing[STORAGE_KEYS.DOSSIERS]).length > 0) {
    return false;
  }

  const apiData = existing[STORAGE_KEYS.API_DATA];
  const lastStatus = existing[STORAGE_KEYS.LAST_STATUS];
  const id = apiData?.dossierId ? String(apiData.dossierId)
    : (lastStatus?.id ? String(lastStatus.id) : null);

  // Rien à migrer (extension vierge)
  if (!id) return false;

  const dossier = {
    lastStatus: lastStatus || null,
    apiData: apiData || { dossierId: id },
    history: existing[STORAGE_KEYS.HISTORY] || [],
    stepDates: existing[STORAGE_KEYS.STEP_DATES] || [],
    lastCheck: existing[STORAGE_KEYS.LAST_CHECK] || null,
    isPrimary: true,
    addedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  await set({
    [STORAGE_KEYS.DOSSIERS]: { [id]: dossier },
    [STORAGE_KEYS.PRIMARY_DOSSIER_ID]: id
  });

  return true;
}

// ─────────────────────────────────────────────────────────────

/**
 * [DEPRECATED v2.6.0] Ancien reset destructif pour changement de dossier.
 * No-op désormais : le flow multi-dossier n'a plus besoin de wipe car
 * chaque dossier a son propre record dans la map `dossiers`. Conservé
 * comme alias vide pour backward-compat si du code externe l'appelle.
 */
export async function resetForNewDossier(_newDossierId) {
  // No-op volontaire (voir upsertDossier pour le nouveau comportement)
}

/** Efface toutes les données SAUF les identifiants et la clé de chiffrement */
export async function clearExceptCredentials() {
  const data = await get([STORAGE_KEYS.CREDENTIALS, ENCRYPTION_KEY_NAME]);
  const creds = data[STORAGE_KEYS.CREDENTIALS];
  const key = data[ENCRYPTION_KEY_NAME];

  await clear();

  // Restaurer les identifiants et la clé
  const restore = {};
  if (creds) restore[STORAGE_KEYS.CREDENTIALS] = creds;
  if (key) restore[ENCRYPTION_KEY_NAME] = key;
  if (Object.keys(restore).length > 0) await set(restore);
}

// ─────────────────────────────────────────────────────────────
// Gestion du statut
// ─────────────────────────────────────────────────────────────

/** Récupère le dernier statut connu (du dossier primaire si pas d'ID précisé) */
export async function getLastStatus(dossierId) {
  if (dossierId) {
    const d = await getDossier(dossierId);
    return d?.lastStatus || null;
  }
  const data = await get(STORAGE_KEYS.LAST_STATUS);
  return data[STORAGE_KEYS.LAST_STATUS] || null;
}

/** Sauvegarde le statut et l'ajoute à l'historique. Route vers dossiers[id]
 *  si `status.id` est présent (cas normal v2.6.0+), sinon fallback sur primaire. */
export async function saveStatus(status) {
  const now = new Date().toISOString();
  const id = status?.id ? String(status.id) : (await getPrimaryDossierId());

  if (id) {
    // Merge history avec dédup
    const dossier = await getDossier(id) || { history: [], stepDates: [], apiData: null };
    const newHistory = _mergeHistoryEntry(dossier.history || [], { ...status, timestamp: now });
    await upsertDossier(id, {
      lastStatus: status,
      lastCheck: now,
      history: newHistory
    });
  } else {
    // Extension vierge, pas encore de primaire — fallback legacy
    await set({
      [STORAGE_KEYS.LAST_STATUS]: status,
      [STORAGE_KEYS.LAST_CHECK]: now
    });
  }
}

/** Récupère la date de dernière vérification réussie */
export async function getLastCheck(dossierId) {
  if (dossierId) {
    const d = await getDossier(dossierId);
    return d?.lastCheck || null;
  }
  const data = await get(STORAGE_KEYS.LAST_CHECK);
  return data[STORAGE_KEYS.LAST_CHECK] || null;
}

/** Enregistre une tentative de vérification (succès ou échec) */
export async function saveLastCheckAttempt(success, error) {
  await set({
    [STORAGE_KEYS.LAST_CHECK_ATTEMPT]: {
      timestamp: new Date().toISOString(),
      success,
      error: error || null
    }
  });
}

/** Récupère la dernière tentative de vérification */
export async function getLastCheckAttempt() {
  const data = await get(STORAGE_KEYS.LAST_CHECK_ATTEMPT);
  return data[STORAGE_KEYS.LAST_CHECK_ATTEMPT] || null;
}

/** Vérifie si le statut a changé pour CE dossier (compare date ET code statut) */
export async function hasStatusChanged(newStatus) {
  const id = newStatus?.id ? String(newStatus.id) : null;
  const lastStatus = id ? await getLastStatus(id) : await getLastStatus();
  if (!lastStatus) return true;
  return lastStatus.date_statut !== newStatus.date_statut
    || (lastStatus.statut || '').toLowerCase() !== (newStatus.statut || '').toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// Historique
// ─────────────────────────────────────────────────────────────

/** Récupère l'historique du dossier (primaire si ID non précisé) */
export async function getHistory(dossierId) {
  if (dossierId) {
    const d = await getDossier(dossierId);
    return d?.history || [];
  }
  const data = await get(STORAGE_KEYS.HISTORY);
  return data[STORAGE_KEYS.HISTORY] || [];
}

/** Merge helper : garde 1 entrée/statut avec la date la plus ancienne */
function _mergeHistoryEntry(history, entry) {
  const norm = (s) => (s || '').toLowerCase();
  const entryKey = norm(entry.statut);
  const entryDate = (entry.date_statut || '').substring(0, 10);
  const existingIdx = history.findIndex(h => norm(h.statut) === entryKey);

  if (existingIdx >= 0) {
    const existingDate = (history[existingIdx].date_statut || '').substring(0, 10);
    if (entryDate && (!existingDate || entryDate < existingDate)) {
      history[existingIdx] = { ...entry, statut: entryKey };
    }
  } else {
    history.push({ ...entry, statut: entryKey });
  }
  return history.slice(-100); // cap dur à 100
}

/** Ajoute une entrée à l'historique du primaire (backward-compat).
 *  Pour cibler un dossier précis, passe un statut avec `id`. */
export async function addToHistory(entry) {
  const id = entry?.id ? String(entry.id) : (await getPrimaryDossierId());
  if (!id) {
    // Fallback legacy (extension vierge)
    const history = await getHistory();
    await set({ [STORAGE_KEYS.HISTORY]: _mergeHistoryEntry(history, entry) });
    scheduleBackupToSync();
    return;
  }
  const dossier = await getDossier(id) || { history: [] };
  const merged = _mergeHistoryEntry(dossier.history || [], entry);
  await upsertDossier(id, { history: merged });
}

/** Efface l'historique du primaire */
export async function clearHistory() {
  const id = await getPrimaryDossierId();
  if (id) {
    await upsertDossier(id, { history: [] });
  } else {
    await set({ [STORAGE_KEYS.HISTORY]: [] });
  }
}

// ─────────────────────────────────────────────────────────────
// Paramètres
// ─────────────────────────────────────────────────────────────

/** Récupère les paramètres (avec valeurs par défaut) */
export async function getSettings() {
  const data = await get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...data[STORAGE_KEYS.SETTINGS] };
}

/** Sauvegarde les paramètres */
export async function saveSettings(settings) {
  const current = await getSettings();
  await set({ [STORAGE_KEYS.SETTINGS]: { ...current, ...settings } });
}

// ─────────────────────────────────────────────────────────────
// Données API
// ─────────────────────────────────────────────────────────────

/** Sauvegarde les données détaillées de l'API pour CE dossier.
 *  Route vers dossiers[apiData.dossierId] si présent, sinon primaire. */
export async function saveApiData(apiData) {
  const id = apiData?.dossierId ? String(apiData.dossierId) : (await getPrimaryDossierId());
  if (id) {
    await upsertDossier(id, { apiData });
  } else {
    await set({ [STORAGE_KEYS.API_DATA]: apiData });
  }
}

/** Récupère les données API (du dossier primaire si ID non précisé) */
export async function getApiData(dossierId) {
  if (dossierId) {
    const d = await getDossier(dossierId);
    return d?.apiData || null;
  }
  const data = await get(STORAGE_KEYS.API_DATA);
  return data[STORAGE_KEYS.API_DATA] || null;
}

// ─────────────────────────────────────────────────────────────
// Identifiants (connexion automatique) - Chiffrement AES-GCM
// ─────────────────────────────────────────────────────────────

const ENCRYPTION_KEY_NAME = 'encryptionKey';

/** Génère ou récupère la clé de chiffrement AES-256 */
async function getOrCreateEncryptionKey() {
  const data = await get(ENCRYPTION_KEY_NAME);

  if (data[ENCRYPTION_KEY_NAME]) {
    const keyData = Uint8Array.from(atob(data[ENCRYPTION_KEY_NAME]), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  await set({ [ENCRYPTION_KEY_NAME]: keyBase64 });

  return key;
}

/** Chiffre une chaîne avec AES-GCM */
async function encryptData(plaintext) {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encoder.encode(plaintext)
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/** Déchiffre une chaîne chiffrée avec AES-GCM */
async function decryptData(encryptedBase64) {
  const key = await getOrCreateEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/** Sauvegarde les identifiants (chiffrés avec AES-256-GCM) */
export async function saveCredentials(username, password) {
  try {
    const encrypted = await encryptData(JSON.stringify({ username, password }));
    await set({ [STORAGE_KEYS.CREDENTIALS]: encrypted });
  } catch (error) {
    console.error('[Storage] Erreur chiffrement credentials:', error);
    throw error;
  }
}

/** Récupère les identifiants sauvegardés */
export async function getCredentials() {
  const data = await get(STORAGE_KEYS.CREDENTIALS);
  const stored = data[STORAGE_KEYS.CREDENTIALS];
  if (!stored) return null;

  // Essayer le nouveau format chiffré AES-GCM
  try {
    const decrypted = await decryptData(stored);
    return JSON.parse(decrypted);
  } catch {
    // Essayer l'ancien format Base64 (migration)
    try {
      const legacy = JSON.parse(atob(stored));
      if (legacy?.username && legacy?.password) {
        console.info('[Storage] Migration credentials Base64 → AES-GCM');
        await saveCredentials(legacy.username, legacy.password);
        return legacy;
      }
    } catch {
      console.warn('[Storage] Credentials invalides, suppression');
      await remove(STORAGE_KEYS.CREDENTIALS);
    }
    return null;
  }
}

/** Supprime les identifiants */
export async function clearCredentials() {
  await remove(STORAGE_KEYS.CREDENTIALS);
}

/** Vérifie si des identifiants sont enregistrés */
export async function hasCredentials() {
  const creds = await getCredentials();
  return !!(creds?.username && creds?.password);
}

// ─────────────────────────────────────────────────────────────
// Auto-check meta (état de la vérification automatique)
// ─────────────────────────────────────────────────────────────

const DEFAULT_AUTO_CHECK_META = {
  lastAttempt: null,
  consecutiveFailures: 0
};

/** Récupère les métadonnées de la vérification automatique */
export async function getAutoCheckMeta() {
  const data = await get(STORAGE_KEYS.AUTO_CHECK_META);
  return { ...DEFAULT_AUTO_CHECK_META, ...data[STORAGE_KEYS.AUTO_CHECK_META] };
}

/** Sauvegarde les métadonnées de la vérification automatique */
export async function saveAutoCheckMeta(meta) {
  const current = await getAutoCheckMeta();
  await set({ [STORAGE_KEYS.AUTO_CHECK_META]: { ...current, ...meta } });
}

// ─────────────────────────────────────────────────────────────
// Journal des vérifications (check log)
// ─────────────────────────────────────────────────────────────

const CHECK_LOG_MAX = 50;
const CHECK_LOG_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Ajoute une entrée au journal des vérifications et purge les anciennes */
export async function addCheckLogEntry(entry) {
  const data = await get(STORAGE_KEYS.CHECK_LOG);
  let log = data[STORAGE_KEYS.CHECK_LOG] || [];

  log.push({ ...entry, timestamp: new Date().toISOString() });

  // Purger les entrées > 24h
  const cutoff = Date.now() - CHECK_LOG_TTL_MS;
  log = log.filter(e => new Date(e.timestamp).getTime() > cutoff);

  // Limiter à 50 entrées
  if (log.length > CHECK_LOG_MAX) {
    log = log.slice(-CHECK_LOG_MAX);
  }

  await set({ [STORAGE_KEYS.CHECK_LOG]: log });
}

/** Récupère le journal des vérifications */
export async function getCheckLog() {
  const data = await get(STORAGE_KEYS.CHECK_LOG);
  return data[STORAGE_KEYS.CHECK_LOG] || [];
}

/** Supprime les entrées du journal > 24h */
export async function clearOldCheckLogs() {
  const log = await getCheckLog();
  const cutoff = Date.now() - CHECK_LOG_TTL_MS;
  const filtered = log.filter(e => new Date(e.timestamp).getTime() > cutoff);
  await set({ [STORAGE_KEYS.CHECK_LOG]: filtered });
}

// ─────────────────────────────────────────────────────────────
// Dates manuelles des étapes (stepDates)
// ─────────────────────────────────────────────────────────────

/** Récupère les dates manuelles des étapes (du dossier primaire si ID non précisé) */
export async function getStepDates(dossierId) {
  if (dossierId) {
    const d = await getDossier(dossierId);
    return d?.stepDates || [];
  }
  const data = await get(STORAGE_KEYS.STEP_DATES);
  return data[STORAGE_KEYS.STEP_DATES] || [];
}

/** Sauvegarde les dates manuelles des étapes (sur le dossier primaire) */
export async function saveStepDates(stepDates) {
  const id = await getPrimaryDossierId();
  if (id) {
    await upsertDossier(id, { stepDates });
  } else {
    await set({ [STORAGE_KEYS.STEP_DATES]: stepDates });
    scheduleBackupToSync();
  }
}

// ─────────────────────────────────────────────────────────────
// Backup sync / Restore
// ─────────────────────────────────────────────────────────────

const SYNC_KEYS = {
  HISTORY: 'sync_history',
  LAST_STATUS: 'sync_lastStatus',
  STEP_DATES: 'sync_stepDates'
};

const SYNC_HISTORY_LIMIT = 50;
let _backupTimer = null;

/** Planifie un backup vers chrome.storage.sync (debounce 5s) */
export function scheduleBackupToSync() {
  if (_backupTimer) clearTimeout(_backupTimer);
  _backupTimer = setTimeout(() => {
    _backupTimer = null;
    backupToSync();
  }, 5000);
}

/** Sauvegarde history + lastStatus dans chrome.storage.sync */
export async function backupToSync() {
  try {
    const [history, lastStatus, stepDates] = await Promise.all([
      getHistory(),
      getLastStatus(),
      getStepDates()
    ]);

    // Entrées slim pour respecter la limite de 8KB/item sync
    const slimHistory = history.slice(-SYNC_HISTORY_LIMIT).map(h => ({
      statut: h.statut,
      date_statut: h.date_statut,
      timestamp: h.timestamp
    }));

    await new Promise((resolve, reject) => {
      chrome.storage.sync.set({
        [SYNC_KEYS.HISTORY]: slimHistory,
        [SYNC_KEYS.LAST_STATUS]: lastStatus,
        [SYNC_KEYS.STEP_DATES]: stepDates
      }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });

    console.info('[Storage] Backup sync effectué:', slimHistory.length, 'entrées');
  } catch (error) {
    console.warn('[Storage] Erreur backup sync:', error.message);
  }
}

/** Restaure les données depuis chrome.storage.sync si local est vide */
export async function restoreFromSync() {
  try {
    const localHistory = await getHistory();
    const localStatus = await getLastStatus();

    // Ne restaurer que si le stockage local est vide
    if (localHistory.length > 0 || localStatus) {
      console.info('[Storage] Stockage local non vide, pas de restore');
      return false;
    }

    const syncData = await new Promise(resolve => {
      chrome.storage.sync.get([SYNC_KEYS.HISTORY, SYNC_KEYS.LAST_STATUS, SYNC_KEYS.STEP_DATES], resolve);
    });

    const syncHistory = syncData[SYNC_KEYS.HISTORY];
    const syncStatus = syncData[SYNC_KEYS.LAST_STATUS];
    const syncStepDates = syncData[SYNC_KEYS.STEP_DATES];

    if (!syncHistory?.length && !syncStatus && !syncStepDates?.length) {
      console.info('[Storage] Aucune donnée sync à restaurer');
      return false;
    }

    if (syncHistory?.length) {
      const merged = mergeHistories(localHistory, syncHistory);
      await set({ [STORAGE_KEYS.HISTORY]: merged });
      console.info('[Storage] Historique restauré depuis sync:', merged.length, 'entrées');
    }

    if (syncStatus) {
      await set({ [STORAGE_KEYS.LAST_STATUS]: syncStatus });
      console.info('[Storage] Dernier statut restauré depuis sync');
    }

    if (syncStepDates?.length) {
      await set({ [STORAGE_KEYS.STEP_DATES]: syncStepDates });
      console.info('[Storage] Dates manuelles restaurées depuis sync:', syncStepDates.length, 'entrées');
    }

    return true;
  } catch (error) {
    console.warn('[Storage] Erreur restore sync:', error.message);
    return false;
  }
}

/**
 * Force la restauration des stepDates depuis chrome.storage.sync et merge avec le local.
 * Utilisé par le bouton "Récupérer" dans les options : le backup sync fait autorité
 * pour les entrées manuelles. Pas de dépendance à Supabase.
 */
export async function restoreStepDatesFromSync() {
  const syncData = await new Promise(resolve => {
    chrome.storage.sync.get([SYNC_KEYS.STEP_DATES], resolve);
  });
  const syncStepDates = syncData[SYNC_KEYS.STEP_DATES] || [];
  if (!syncStepDates.length) return { count: 0 };

  const existing = await getStepDates();
  const map = {};
  for (const sd of existing) {
    map[(sd.statut || '').toLowerCase()] = sd;
  }
  for (const sd of syncStepDates) {
    map[(sd.statut || '').toLowerCase()] = sd; // sync fait autorité
  }
  const merged = Object.values(map);
  await saveStepDates(merged);
  return { count: syncStepDates.length };
}

/** Fusionne deux historiques en dédupliquant sur statut|date_statut */
function mergeHistories(local, sync) {
  const seen = new Set();
  const merged = [];

  for (const entry of [...local, ...sync]) {
    const key = `${entry.statut}|${entry.date_statut}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  }

  // Trier par timestamp chronologique
  merged.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

  return merged;
}

// ─────────────────────────────────────────────────────────────
// Export / Import
// ─────────────────────────────────────────────────────────────

/** Exporte toutes les données pour sauvegarde (sans clé de chiffrement) */
export async function exportData() {
  const data = await get([
    STORAGE_KEYS.LAST_STATUS,
    STORAGE_KEYS.LAST_CHECK,
    STORAGE_KEYS.LAST_CHECK_ATTEMPT,
    STORAGE_KEYS.HISTORY,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.API_DATA,
    STORAGE_KEYS.AUTO_CHECK_META,
    STORAGE_KEYS.CHECK_LOG,
    STORAGE_KEYS.STEP_DATES
  ]);

  // Indiquer la présence de credentials sans exporter la clé AES
  const creds = await get(STORAGE_KEYS.CREDENTIALS);
  if (creds[STORAGE_KEYS.CREDENTIALS]) {
    data._hasCredentials = true;
  }

  return {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    ...data
  };
}

/** Importe des données depuis une sauvegarde (exclut credentials et clé de chiffrement) */
export async function importData(data) {
  const { exportDate, version, [STORAGE_KEYS.CREDENTIALS]: _creds, [ENCRYPTION_KEY_NAME]: _key, ...storageData } = data;
  await set(storageData);
}

// ─────────────────────────────────────────────────────────────

/** Vérifie que les identifiants et la clé de chiffrement sont intacts */
export async function verifyCredentialsIntegrity() {
  try {
    const hasCreds = await hasCredentials();
    if (!hasCreds) return { status: 'none' };

    // Tenter de déchiffrer pour vérifier l'intégrité
    const creds = await getCredentials();
    if (creds?.username && creds?.password) {
      return { status: 'ok' };
    }
    return { status: 'corrupted' };
  } catch {
    return { status: 'corrupted' };
  }
}

export { STORAGE_KEYS, DEFAULT_SETTINGS };
