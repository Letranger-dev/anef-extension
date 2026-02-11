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
  CREDENTIALS: 'credentials'
};

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  autoCheckEnabled: false,
  autoCheckInterval: 60,
  historyLimit: 100,
  anonymousStatsEnabled: true
};

// ─────────────────────────────────────────────────────────────
// Fonctions de base
// ─────────────────────────────────────────────────────────────

export async function get(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

export async function set(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}

export async function remove(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
}

export async function clear() {
  return new Promise(resolve => chrome.storage.local.clear(resolve));
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

/** Récupère le dernier statut connu */
export async function getLastStatus() {
  const data = await get(STORAGE_KEYS.LAST_STATUS);
  return data[STORAGE_KEYS.LAST_STATUS] || null;
}

/** Sauvegarde le statut actuel et l'ajoute à l'historique */
export async function saveStatus(status) {
  const now = new Date().toISOString();

  await set({
    [STORAGE_KEYS.LAST_STATUS]: status,
    [STORAGE_KEYS.LAST_CHECK]: now
  });

  await addToHistory({ ...status, timestamp: now });
}

/** Récupère la date de dernière vérification */
export async function getLastCheck() {
  const data = await get(STORAGE_KEYS.LAST_CHECK);
  return data[STORAGE_KEYS.LAST_CHECK] || null;
}

/** Vérifie si le statut a changé */
export async function hasStatusChanged(newStatus) {
  const lastStatus = await getLastStatus();
  if (!lastStatus) return true;
  return lastStatus.date_statut !== newStatus.date_statut;
}

// ─────────────────────────────────────────────────────────────
// Historique
// ─────────────────────────────────────────────────────────────

/** Récupère l'historique des statuts */
export async function getHistory() {
  const data = await get(STORAGE_KEYS.HISTORY);
  return data[STORAGE_KEYS.HISTORY] || [];
}

/** Ajoute une entrée à l'historique (évite les doublons) */
export async function addToHistory(entry) {
  const settings = await getSettings();
  const history = await getHistory();

  const isDuplicate = history.some(h =>
    h.statut === entry.statut && h.date_statut === entry.date_statut
  );

  if (!isDuplicate) {
    history.push(entry);
    await set({ [STORAGE_KEYS.HISTORY]: history.slice(-settings.historyLimit) });
    scheduleBackupToSync();
  }
}

/** Efface l'historique */
export async function clearHistory() {
  await set({ [STORAGE_KEYS.HISTORY]: [] });
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

/** Sauvegarde les données détaillées de l'API */
export async function saveApiData(apiData) {
  await set({ [STORAGE_KEYS.API_DATA]: apiData });
}

/** Récupère les données API */
export async function getApiData() {
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
// Backup sync / Restore
// ─────────────────────────────────────────────────────────────

const SYNC_KEYS = {
  HISTORY: 'sync_history',
  LAST_STATUS: 'sync_lastStatus'
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
    const [history, lastStatus] = await Promise.all([
      getHistory(),
      getLastStatus()
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
        [SYNC_KEYS.LAST_STATUS]: lastStatus
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
      chrome.storage.sync.get([SYNC_KEYS.HISTORY, SYNC_KEYS.LAST_STATUS], resolve);
    });

    const syncHistory = syncData[SYNC_KEYS.HISTORY];
    const syncStatus = syncData[SYNC_KEYS.LAST_STATUS];

    if (!syncHistory?.length && !syncStatus) {
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

    return true;
  } catch (error) {
    console.warn('[Storage] Erreur restore sync:', error.message);
    return false;
  }
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

/** Exporte toutes les données pour sauvegarde */
export async function exportData() {
  const data = await get([
    STORAGE_KEYS.LAST_STATUS,
    STORAGE_KEYS.LAST_CHECK,
    STORAGE_KEYS.HISTORY,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.API_DATA,
    STORAGE_KEYS.CREDENTIALS,
    ENCRYPTION_KEY_NAME
  ]);

  return {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    ...data
  };
}

/** Importe des données depuis une sauvegarde */
export async function importData(data) {
  const { exportDate, version, ...storageData } = data;
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
