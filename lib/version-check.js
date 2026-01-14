/**
 * Version Check - Vérifie si une mise à jour est disponible
 *
 * Compare la version locale avec celle du repo GitHub
 */

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Letranger-dev/anef-extension/main/manifest.json';
const GITHUB_REPO_URL = 'https://github.com/Letranger-dev/anef-extension';
const CHECK_INTERVAL_HOURS = 24; // Vérifier une fois par jour

/**
 * Compare deux versions semver (ex: "1.0.0" vs "1.1.0")
 * @returns {number} -1 si v1 < v2, 0 si égal, 1 si v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

/**
 * Récupère la version actuelle de l'extension
 */
function getCurrentVersion() {
  return chrome.runtime.getManifest().version;
}

/**
 * Vérifie si on doit faire une nouvelle vérification
 */
async function shouldCheck() {
  try {
    const result = await chrome.storage.local.get('lastVersionCheck');
    if (!result.lastVersionCheck) return true;

    const lastCheck = new Date(result.lastVersionCheck);
    const now = new Date();
    const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);

    return hoursSinceLastCheck >= CHECK_INTERVAL_HOURS;
  } catch {
    return true;
  }
}

/**
 * Récupère la dernière version depuis GitHub
 */
async function fetchLatestVersion() {
  try {
    const response = await fetch(GITHUB_RAW_URL, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = await response.json();
    return manifest.version;
  } catch (error) {
    console.warn('[VersionCheck] Erreur fetch:', error.message);
    return null;
  }
}

/**
 * Sauvegarde le résultat de la vérification
 */
async function saveCheckResult(latestVersion) {
  await chrome.storage.local.set({
    lastVersionCheck: new Date().toISOString(),
    latestVersion: latestVersion
  });
}

/**
 * Récupère le résultat mis en cache
 */
export async function getCachedUpdateInfo() {
  try {
    const result = await chrome.storage.local.get(['latestVersion', 'updateAvailable']);
    return {
      latestVersion: result.latestVersion || null,
      updateAvailable: result.updateAvailable || false,
      repoUrl: GITHUB_REPO_URL
    };
  } catch {
    return { latestVersion: null, updateAvailable: false, repoUrl: GITHUB_REPO_URL };
  }
}

/**
 * Vérifie si une mise à jour est disponible
 * @param {boolean} force - Force la vérification même si le cache est récent
 * @returns {Promise<{updateAvailable: boolean, currentVersion: string, latestVersion: string|null, repoUrl: string}>}
 */
export async function checkForUpdate(force = false) {
  const currentVersion = getCurrentVersion();

  // Vérifier si on doit faire une requête
  if (!force && !(await shouldCheck())) {
    const cached = await getCachedUpdateInfo();
    // Toujours recalculer avec la version actuelle (au cas où elle a changé)
    const updateAvailable = cached.latestVersion
      ? compareVersions(currentVersion, cached.latestVersion) < 0
      : false;
    return {
      updateAvailable,
      currentVersion,
      latestVersion: cached.latestVersion,
      repoUrl: GITHUB_REPO_URL
    };
  }

  // Récupérer la dernière version
  const latestVersion = await fetchLatestVersion();

  if (!latestVersion) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: null,
      repoUrl: GITHUB_REPO_URL
    };
  }

  // Comparer les versions
  const updateAvailable = compareVersions(currentVersion, latestVersion) < 0;

  // Sauvegarder le résultat (on ne cache que latestVersion, pas updateAvailable)
  await saveCheckResult(latestVersion);

  return {
    updateAvailable,
    currentVersion,
    latestVersion,
    repoUrl: GITHUB_REPO_URL
  };
}

/**
 * Ignore la mise à jour (ne plus afficher pour cette version)
 */
export async function dismissUpdate(version) {
  await chrome.storage.local.set({
    dismissedVersion: version
  });
}

/**
 * Vérifie si la mise à jour a été ignorée
 */
export async function isUpdateDismissed(version) {
  const result = await chrome.storage.local.get('dismissedVersion');
  return result.dismissedVersion === version;
}
