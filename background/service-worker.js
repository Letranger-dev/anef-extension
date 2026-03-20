/**
 * Service Worker - Extension ANEF Status Tracker
 *
 * Gère toutes les opérations en arrière-plan :
 * - Réception et traitement des données interceptées
 * - Notifications de changement de statut
 * - Actualisation automatique en arrière-plan
 * - Connexion automatique si identifiants enregistrés
 */

import * as storage from '../lib/storage.js';
import { getStatusExplanation, isPositiveStatus, isNegativeStatus, getStepColor, formatTimestamp, formatSubStep } from '../lib/status-parser.js';
import { ANEF_BASE_URL, ANEF_ROUTES, URLPatterns, LogConfig } from '../lib/constants.js';
import { sendAnonymousStats, sendManualStepDates, fetchDossierSnapshots } from '../lib/anonymous-stats.js';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const LOG_STORAGE_KEY = LogConfig.STORAGE_KEY;
const MAX_LOGS = LogConfig.MAX_LOGS;

// ─────────────────────────────────────────────────────────────
// Système de logs
// ─────────────────────────────────────────────────────────────

function formatTime() {
  return formatTimestamp();
}

async function saveLog(entry) {
  try {
    const result = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const logs = result[LOG_STORAGE_KEY] || [];
    logs.push(entry);
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs.slice(-MAX_LOGS) });
  } catch {
    // Silencieux — le SW peut être terminé/rechargé pendant l'écriture
  }
}

function log(level, message, data = null) {
  const entry = {
    timestamp: formatTime(),
    level,
    source: 'ServiceWorker',
    message,
    data: data ? JSON.stringify(data) : null
  };

  const colors = {
    DEBUG: 'color: #9ca3af',
    INFO: 'color: #3b82f6',
    WARN: 'color: #f59e0b',
    ERROR: 'color: #ef4444; font-weight: bold'
  };

  const prefix = `[SW] [${entry.timestamp}] [${level}]`;
  console.log(`%c${prefix} ${message}`, colors[level], data || '');
  saveLog(entry);
}

const logger = {
  debug: (msg, data) => log('DEBUG', msg, data),
  info: (msg, data) => log('INFO', msg, data),
  warn: (msg, data) => log('WARN', msg, data),
  error: (msg, data) => log('ERROR', msg, data)
};

// ─────────────────────────────────────────────────────────────
// Gestionnaire de messages
// ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Message reçu:', { type: message.type, from: sender.tab?.url || 'popup' });

  switch (message.type) {
    // Logs du content script
    case 'LOG':
      saveLog({
        timestamp: formatTime(),
        level: message.level,
        source: message.source,
        message: message.message,
        data: message.data
      });
      break;

    // Données du dossier (statut principal)
    case 'DOSSIER_DATA':
      logger.info('📥 Données dossier reçues', message.data);
      handleDossierData(message.data);
      sendResponse({ received: true });
      break;

    // Données du stepper (ID dossier)
    case 'DOSSIER_STEPPER':
      logger.info('📥 Stepper reçu', { id: message.data?.dossier?.id });
      handleDossierStepper(message.data);
      break;

    // Données détaillées de l'API
    case 'API_DATA':
      logger.info('📥 Données API reçues');
      handleApiData(message.data);
      break;

    // Notifications ANEF
    case 'NOTIFICATIONS':
      logger.info('📥 Notifications reçues', { count: message.data?.length });
      handleNotifications(message.data);
      break;

    // Informations utilisateur
    case 'USER_INFO':
      logger.info('📥 Infos utilisateur reçues', message.data);
      handleUserInfo(message.data);
      break;

    // Historique des séjours
    case 'HISTORIQUE':
      logger.info('📥 Historique reçu', message.data);
      handleHistorique(message.data);
      break;

    // Page chargée
    case 'PAGE_READY':
      logger.info('📄 Page prête', message);
      break;

    // Navigation SPA
    case 'PAGE_CHANGED':
      logger.info('📍 Navigation:', message.url);
      break;

    // Site en maintenance
    case 'MAINTENANCE':
      logger.warn('🔧 Maintenance détectée');
      handleMaintenance();
      break;

    // Session expirée (JWT invalide / mot de passe expiré)
    case 'EXPIRED_SESSION':
      logger.warn('🔑 Session expirée détectée (JWT invalide)');
      handleExpiredSession();
      break;

    // Résultat de la récupération par le script injecté
    case 'FETCH_COMPLETE':
      logger.info('📥 Fetch terminé:', message.data);
      handleFetchComplete(message.data);
      break;

    // Récupérer le statut pour le popup
    case 'GET_STATUS':
      getStatusForPopup().then(sendResponse);
      return true;

    // Récupérer les logs
    case 'GET_LOGS':
      chrome.storage.local.get(LOG_STORAGE_KEY).then(result => {
        sendResponse(result[LOG_STORAGE_KEY] || []);
      });
      return true;

    // Effacer les logs
    case 'CLEAR_LOGS':
      chrome.storage.local.set({ [LOG_STORAGE_KEY]: [] }).then(() => {
        sendResponse({ success: true });
      });
      return true;

    // Ouvrir une page ANEF
    case 'OPEN_ANEF':
      openAnefPage(message.page || 'mon-compte');
      break;

    // Forcer une vérification
    case 'FORCE_CHECK':
      openAnefPage('mon-compte');
      break;

    // Actualisation en arrière-plan
    case 'BACKGROUND_REFRESH': {
      logger.info('🔄 Actualisation manuelle demandée');
      const manualStart = Date.now();
      refreshPromise = backgroundRefresh();
      refreshPromise.then(async (result) => {
        // Ne pas loguer les refreshes annulés par une nouvelle demande
        if (result.aborted) {
          sendResponse(result);
          return;
        }
        const manualDuration = Math.round((Date.now() - manualStart) / 1000);
        // Logger l'entrée manuelle
        await storage.addCheckLogEntry({
          type: 'manual',
          success: !!result.success,
          error: result.error || null,
          duration: manualDuration
        });
        // Mettre à jour lastAttempt pour le cooldown
        // Si succès, reset le compteur d'échecs (le système fonctionne)
        const metaUpdate = { lastAttempt: new Date().toISOString() };
        if (result.success) metaUpdate.consecutiveFailures = 0;
        await storage.saveAutoCheckMeta(metaUpdate);
        // Enregistrer la tentative
        await storage.saveLastCheckAttempt(!!result.success, result.error || null);
        sendResponse(result);
      });
      return true;
    }

    // Paramètres modifiés → reconfigurer l'alarme auto-check
    case 'SETTINGS_CHANGED':
      logger.info('⚙️ Paramètres modifiés, reconfiguration auto-check');
      scheduleAutoCheck().then(() => sendResponse({ ok: true }));
      return true;

    // Infos auto-check pour l'UI
    case 'GET_AUTO_CHECK_INFO':
      getAutoCheckInfo().then(sendResponse);
      return true;

    // Synchroniser les dates manuelles vers Supabase
    case 'SYNC_STEP_DATES':
      (async () => {
        try {
          const stepDates = await storage.getStepDates();
          const apiData = await storage.getApiData();
          if (stepDates.length && apiData) {
            await sendManualStepDates(stepDates, apiData);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Pas de données' });
          }
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    // Récupérer les snapshots depuis Supabase → stepDates locales
    case 'PULL_STEP_DATES':
      (async () => {
        try {
          const apiData = await storage.getApiData();
          if (!apiData?.dossierId) {
            sendResponse({ error: 'Aucun dossier connu' });
            return;
          }
          const snapshots = await fetchDossierSnapshots(apiData);
          if (!snapshots.length) {
            sendResponse({ count: 0 });
            return;
          }

          // Reconstruire stepDates depuis la base (source = manual)
          const pulledStepDates = [];
          for (const snap of snapshots) {
            if (snap.date_statut && snap.source === 'manual') {
              pulledStepDates.push({
                statut: snap.statut.toLowerCase(),
                date_statut: snap.date_statut,
                manual: true,
                timestamp: snap.checked_at || new Date().toISOString()
              });
            }
          }

          // Merger : la base fait autorité pour les manuels
          const existing = await storage.getStepDates();
          const mergedMap = {};
          for (const sd of existing) {
            mergedMap[(sd.statut || '').toLowerCase()] = sd;
          }
          for (const sd of pulledStepDates) {
            mergedMap[sd.statut] = sd; // la base écrase le local
          }
          await storage.saveStepDates(Object.values(mergedMap));

          // Ajouter à l'historique si absent
          for (const snap of snapshots) {
            if (snap.date_statut) {
              await storage.addToHistory({
                statut: snap.statut.toLowerCase(),
                date_statut: snap.date_statut,
                manual: snap.source === 'manual',
                timestamp: snap.checked_at || new Date().toISOString()
              });
            }
          }

          sendResponse({ count: pulledStepDates.length });
        } catch (e) {
          sendResponse({ error: e.message });
        }
      })();
      return true;

    default:
      logger.warn('Message non géré:', message.type);
  }
});

// ─────────────────────────────────────────────────────────────
// Traitement des données
// ─────────────────────────────────────────────────────────────

/** Traite les données du dossier (statut principal) */
async function handleDossierData(data) {
  if (!data?.statut) {
    logger.warn('Données invalides - pas de statut');
    return;
  }

  try {
    // Réinitialiser les états d'erreur
    const apiData = await storage.getApiData() || {};
    if (apiData.inMaintenance || apiData.passwordExpired) {
      apiData.inMaintenance = false;
      apiData.passwordExpired = false;
      await storage.saveApiData(apiData);
    }

    // Vérifier si le statut a changé
    const hasChanged = await storage.hasStatusChanged(data);
    if (hasChanged) {
      logger.info('🔔 Changement de statut détecté !', { nouveau: data.statut });
      await sendStatusChangeNotification(data);
    }

    // Sauvegarder et mettre à jour le badge
    await storage.saveStatus(data);
    await updateBadge(data.statut);
    logger.info('✅ Statut sauvegardé');

  } catch (error) {
    logger.error('Erreur traitement dossier:', error.message);
  }
}

/** Traite les données du stepper */
async function handleDossierStepper(data) {
  if (!data?.dossier?.id) return;

  const apiData = await storage.getApiData() || {};
  apiData.dossierId = data.dossier.id;
  await storage.saveApiData(apiData);
}

/** Traite les données détaillées de l'API */
async function handleApiData(data) {
  const apiData = {
    dossierId: data.id,
    numeroNational: data.numero_national,
    numeroDecret: data.numero_decret,
    dateDepot: data.date_depot,
    dateEntretien: data.entretien_date,
    lieuEntretien: data.entretien_lieu,
    prefecture: data.prefecture,
    domicileCodePostal: data.domicile_code_postal,
    domicileVille: data.domicile_ville,
    typeDemande: data.type_demande,
    complementInstruction: data.complement_instruction,
    rawTaxePayee: data.raw_taxe_payee,
    rawEntretien: data.raw_entretien,
    lastUpdate: new Date().toISOString()
  };

  await storage.saveApiData(apiData);
  logger.info('✅ Données API sauvegardées');

  // Statistiques anonymes communautaires (fire-and-forget)
  const lastStatus = await storage.getLastStatus();
  if (lastStatus) {
    sendAnonymousStats(lastStatus, apiData).catch(() => {});
  }
}

/** Marque le site en maintenance */
async function handleMaintenance() {
  const apiData = await storage.getApiData() || {};
  apiData.inMaintenance = true;
  apiData.maintenanceDetectedAt = new Date().toISOString();
  await storage.saveApiData(apiData);
}

/** Marque la session comme expirée (JWT invalide / mot de passe expiré) */
async function handleExpiredSession() {
  const apiData = await storage.getApiData() || {};
  apiData.passwordExpired = true;
  await storage.saveApiData(apiData);
}

/**
 * Signal de fin de récupération envoyé par le script injecté.
 * Permet au backgroundRefresh de sortir de sa boucle d'attente
 * immédiatement au lieu d'attendre le timeout de 45s.
 */
let fetchCompleteSignal = null;

function handleFetchComplete(data) {
  fetchCompleteSignal = {
    success: data?.success || false,
    reason: data?.reason || null,
    timestamp: Date.now()
  };
}

/** Traite les notifications */
async function handleNotifications(data) {
  if (!data) return;

  const apiData = await storage.getApiData() || {};
  apiData.notifications = (Array.isArray(data) ? data : data.data || []).slice(0, 10);
  await storage.saveApiData(apiData);
}

/** Traite les informations utilisateur */
async function handleUserInfo(data) {
  if (!data) return;

  const apiData = await storage.getApiData() || {};
  apiData.user = {
    nom: data.nom,
    prenom: data.prenom,
    email: data.email,
    dateNaissance: data.date_naissance
  };
  await storage.saveApiData(apiData);
}

/** Traite l'historique des séjours */
async function handleHistorique(data) {
  if (!data) return;

  const apiData = await storage.getApiData() || {};
  apiData.historiqueSejour = Array.isArray(data) ? data : data.data || [];
  await storage.saveApiData(apiData);
}

// ─────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────

/** Envoie une notification de changement de statut */
async function sendStatusChangeNotification(data) {
  const settings = await storage.getSettings();
  if (!settings.notificationsEnabled) return;

  const statusInfo = getStatusExplanation(data.statut);
  let title = '🔔 Changement de statut ANEF !';

  if (isPositiveStatus(data.statut)) {
    title = '🎉 FÉLICITATIONS !';
  } else if (isNegativeStatus(data.statut)) {
    title = '⚠️ Mise à jour de votre dossier';
  }

  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title,
      message: `${statusInfo.phase}: ${statusInfo.explication}`,
      priority: 2,
      requireInteraction: true
    });
  } catch (error) {
    logger.error('Erreur notification:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Badge de l'extension
// ─────────────────────────────────────────────────────────────

/** Met à jour le badge avec la sous-étape actuelle */
async function updateBadge(statut) {
  const statusInfo = getStatusExplanation(statut);
  const subStep = statusInfo.rang > 0 ? formatSubStep(statusInfo.rang) : '';
  // Badge Chrome : max 4 chars, tronquer si nécessaire
  const badgeText = subStep.length > 4 ? statusInfo.etape.toString() : subStep;
  const badgeColor = getStepColor(statusInfo.etape);

  try {
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    await chrome.action.setTitle({
      title: statusInfo.found
        ? `ANEF: ${statusInfo.phase} (${subStep}/12)`
        : 'ANEF Status Tracker'
    });
  } catch (error) {
    logger.error('Erreur badge:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Fonctions utilitaires
// ─────────────────────────────────────────────────────────────

/** Récupère toutes les données pour le popup */
async function getStatusForPopup() {
  const [lastStatus, lastCheck, lastCheckAttempt, apiData, history, settings] = await Promise.all([
    storage.getLastStatus(),
    storage.getLastCheck(),
    storage.getLastCheckAttempt(),
    storage.getApiData(),
    storage.getHistory(),
    storage.getSettings()
  ]);

  return {
    lastStatus,
    lastCheck,
    lastCheckAttempt,
    apiData,
    historyCount: history.length,
    settings,
    inMaintenance: apiData?.inMaintenance || false,
    passwordExpired: apiData?.passwordExpired || false
  };
}

/** Ouvre une page ANEF */
async function openAnefPage(page) {
  const routes = {
    'login': '/#/espace-personnel/connexion-inscription',
    'mon-compte': '/#/espace-personnel/mon-compte'
  };

  const url = ANEF_BASE_URL + (routes[page] || routes['mon-compte']);

  try {
    await chrome.tabs.create({ url, active: true });
  } catch (error) {
    logger.error('Erreur ouverture onglet:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Actualisation en arrière-plan
// ─────────────────────────────────────────────────────────────

// Protection contre les appels simultanés (race condition)
let isRefreshing = false;
let refreshAbortController = null;
let refreshPromise = null;

/** Sleep interruptible par un AbortController */
function abortableSleep(ms, signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

/**
 * Actualise le statut en arrière-plan de manière discrète.
 * Crée une fenêtre minimisée, attend les données interceptées par le
 * content script, puis la ferme. Gère automatiquement la connexion
 * si la session est expirée et que des identifiants sont enregistrés.
 *
 * ⚠️  ATTENTION — NE PAS MODIFIER la création de la fenêtre ci-dessous.
 * ──────────────────────────────────────────────────────────────────────
 * La méthode `chrome.windows.create({ state: 'minimized' })` est la
 * SEULE approche qui fonctionne correctement. Toutes les alternatives
 * ont été testées et échouent :
 *
 *   - type:'popup' + coordonnées hors-écran → Chrome throttle le JS,
 *     Angular ne charge pas, les données ne sont jamais reçues.
 *   - type:'popup' + petites dimensions (1×1) → même problème de throttle.
 *   - state:'minimized' + focused:false → la page ne charge pas les données.
 *   - windows.update() après create → ferme la popup de l'extension
 *     (erreur "Extension context invalidated").
 *   - chrome.tabs.create({ active: false }) → onglet visible dans la
 *     barre d'onglets de l'utilisateur.
 *
 * Le state:'minimized' provoque un très bref flash dans la barre des
 * tâches Windows, mais c'est le seul compromis fonctionnel.
 * ──────────────────────────────────────────────────────────────────────
 */
async function backgroundRefresh() {
  // Si une actualisation est déjà en cours, l'annuler et attendre son nettoyage
  if (isRefreshing && refreshAbortController) {
    logger.warn('⚠️ Actualisation déjà en cours → annulation de l\'ancienne');
    refreshAbortController.abort();
    if (refreshPromise) {
      try { await refreshPromise; } catch {}
    }
  }

  const abortController = new AbortController();
  refreshAbortController = abortController;
  isRefreshing = true;
  logger.info('🔄 Démarrage actualisation...');

  // Configuration des délais
  const TIMEOUT_MS = 45000;       // Timeout sans login
  const LOGIN_TIMEOUT_MS = 90000; // Timeout avec login (SSO + ANEF)
  const CHECK_INTERVAL_MS = 500;  // Fréquence de vérification des données
  const WAIT_BEFORE_CHECK_MS = 1500; // Délai avant de vérifier le login
  const POST_LOGIN_WAIT_MS = 1000;   // Délai après login réussi
  const MON_COMPTE_URL = ANEF_BASE_URL + ANEF_ROUTES.MON_COMPTE;

  // État du refresh
  let tabId = null;
  let windowId = null;
  let useWindow = true;
  let dataReceived = false;
  let needsLogin = false;
  let loginAttempted = { anef: false, sso: false };
  let loginCompleted = false;
  let lastUrl = '';

  // Reset le signal de completion du script injecté
  fetchCompleteSignal = null;

  // Reset le flag mot de passe expiré (on va revérifier)
  const preApiData = await storage.getApiData() || {};
  if (preApiData.passwordExpired) {
    preApiData.passwordExpired = false;
    await storage.saveApiData(preApiData);
  }

  // Snapshots avant le refresh pour détecter les nouvelles données
  const beforeCheck = await storage.getLastCheck();
  const beforeApiUpdate = preApiData?.lastUpdate;

  const credentials = await storage.getCredentials();
  const hasCredentials = !!(credentials?.username && credentials?.password);

  try {
    // ── Création de la fenêtre (NE PAS MODIFIER — voir JSDoc) ──
    try {
      const newWindow = await chrome.windows.create({
        url: 'about:blank',
        state: 'minimized'
      });
      windowId = newWindow.id;
      tabId = newWindow.tabs[0].id;
      useWindow = true;

      // Naviguer vers l'URL après que la fenêtre soit minimisée
      await chrome.tabs.update(tabId, { url: MON_COMPTE_URL });
      logger.info('✅ Fenêtre minimisée créée:', { windowId, tabId });
    } catch (winErr) {
      // Fallback: onglet inactif (si windows.create échoue, ex: ChromeOS)
      logger.warn('Fenêtre impossible:', winErr.message);
      const tab = await chrome.tabs.create({ url: MON_COMPTE_URL, active: false });
      tabId = tab.id;
      useWindow = false;
      logger.info('✅ Onglet inactif créé:', { tabId });
    }

    // ── Boucle d'attente des données ──
    const startTime = Date.now();
    const timeout = hasCredentials ? LOGIN_TIMEOUT_MS : TIMEOUT_MS;
    let dossierReceived = false;  // Données dossier (statut) reçues
    let dossierTime = null;       // Timestamp de réception du dossier

    while (Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));

      // Vérifier si cette actualisation a été annulée par une nouvelle
      if (abortController.signal.aborted) {
        logger.info('🛑 Actualisation annulée (nouvelle demandée)');
        break;
      }

      // Vérifier si l'onglet existe encore
      let tabInfo;
      try {
        tabInfo = await chrome.tabs.get(tabId);
      } catch {
        logger.warn('Onglet fermé prématurément');
        break;
      }

      const elapsed = Date.now() - startTime;
      const currentUrl = tabInfo.url || '';

      // Détecter les changements d'URL
      if (currentUrl !== lastUrl) {
        logger.info('📍 URL:', currentUrl.substring(0, 80));

        // Détecter si on revient sur mon-compte après login (utiliser URLPatterns)
        const wasOnLogin = URLPatterns.isLoginPage(lastUrl);
        const isOnMonCompte = URLPatterns.isMonCompte(currentUrl);
        const isOnHomepage = URLPatterns.isHomepage(currentUrl);

        // Si on arrive sur la page d'accueil après login, naviguer vers mon-compte
        if (isOnHomepage && (loginAttempted.anef || loginAttempted.sso) && !loginCompleted) {
          logger.info('🏠 Page d\'accueil détectée après login, navigation vers mon-compte...');
          try {
            await chrome.tabs.update(tabId, { url: MON_COMPTE_URL });
            logger.info('📤 Navigation vers mon-compte lancée');
          } catch (e) {
            logger.warn('Erreur navigation:', e.message);
          }
          lastUrl = currentUrl;
          continue;
        }

        if (isOnMonCompte && (loginAttempted.anef || loginAttempted.sso)) {
          logger.info('✅ Connexion réussie, arrivé sur mon-compte');
          loginCompleted = true;
          fetchCompleteSignal = null; // Attendre un nouveau signal post-login
          // Attendre que Angular charge la page
          await new Promise(r => setTimeout(r, POST_LOGIN_WAIT_MS));

          // Déclencher explicitement la récupération des données
          try {
            await chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_DATA_FETCH' });
            logger.info('📤 Demande de récupération envoyée');
          } catch (e) {
            logger.warn('Erreur envoi TRIGGER_DATA_FETCH:', e.message);
          }
        }

        lastUrl = currentUrl;
      }

      // Attendre que la page soit chargée
      if (elapsed > WAIT_BEFORE_CHECK_MS && tabInfo.status === 'complete') {
        const isAnefLogin = URLPatterns.isANEFLogin(currentUrl);
        const isSSOPage = !isAnefLogin && URLPatterns.isSSOPage(currentUrl);

        // Page de changement de mot de passe (expiré)
        if (URLPatterns.isPasswordExpired(currentUrl)) {
          logger.warn('🔑 Mot de passe ANEF expiré détecté');
          const apiData = await storage.getApiData() || {};
          apiData.passwordExpired = true;
          await storage.saveApiData(apiData);
          break;
        }

        // Page de connexion ANEF détectée
        if (isAnefLogin && !loginAttempted.anef && hasCredentials) {
          logger.info('🔐 Page connexion ANEF détectée');
          needsLogin = true;
          loginAttempted.anef = true;
          fetchCompleteSignal = null; // Signal pré-login obsolète

          // Attendre que Angular soit prêt
          await abortableSleep(3000, abortController.signal);
          if (abortController.signal.aborted) continue;

          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'DO_AUTO_LOGIN',
              credentials
            });
            logger.info('📤 Auto-login ANEF envoyé');
          } catch (e) {
            logger.warn('Erreur auto-login ANEF:', e.message);
          }

          // Attendre la redirection vers SSO
          await abortableSleep(5000, abortController.signal);
          continue;
        }

        // Page SSO détectée
        if (isSSOPage && !loginAttempted.sso && hasCredentials) {
          logger.info('🔐 Page SSO détectée');
          loginAttempted.sso = true;
          fetchCompleteSignal = null; // Signal pré-login obsolète

          // Attendre que le formulaire soit prêt
          await abortableSleep(2000, abortController.signal);
          if (abortController.signal.aborted) continue;

          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'DO_AUTO_LOGIN',
              credentials
            });
            logger.info('📤 Auto-login SSO envoyé');
          } catch (e) {
            logger.warn('Erreur auto-login SSO:', e.message);
          }

          // Attendre la soumission et redirection
          await abortableSleep(8000, abortController.signal);
          continue;
        }

        // Session expirée sans identifiants
        if (isAnefLogin && !hasCredentials && elapsed > 10000) {
          logger.warn('🔒 Session expirée, pas d\'identifiants');
          needsLogin = true;
          break;
        }
      }

      // Vérifier si le script injecté a terminé (succès ou échec)
      if (fetchCompleteSignal && fetchCompleteSignal.timestamp > startTime) {
        if (!fetchCompleteSignal.success) {
          logger.warn('⚠️ Script injecté a échoué:', fetchCompleteSignal.reason);
          // Si maintenance ou session expirée, sortir immédiatement
          if (fetchCompleteSignal.reason === 'maintenance' || fetchCompleteSignal.reason === 'expired_session') {
            break;
          }
          // Autres échecs : attendre encore un peu les données qui pourraient
          // être en transit (le signal peut arriver avant les données)
          if (fetchCompleteSignal.reason === 'no_nationality_tab' ||
              fetchCompleteSignal.reason === 'api_error') {
            // Laisser 3s supplémentaires au cas où des données sont en transit
            if (Date.now() - fetchCompleteSignal.timestamp > 3000) {
              break;
            }
          }
        }
      }

      // Vérifier si la maintenance a été détectée pendant ce refresh
      const currentApiData = await storage.getApiData();
      if (currentApiData?.inMaintenance && currentApiData?.maintenanceDetectedAt) {
        const detectedAt = new Date(currentApiData.maintenanceDetectedAt).getTime();
        if (detectedAt > startTime) {
          logger.warn('🔧 Maintenance détectée pendant le refresh, arrêt');
          break;
        }
      }

      // Vérifier si les données sont arrivées
      const currentCheck = await storage.getLastCheck();
      if (currentCheck && (!beforeCheck || currentCheck > beforeCheck)) {
        if (!dossierReceived) {
          logger.info('✅ Données dossier reçues !');
          dossierReceived = true;
          dossierTime = Date.now();
        }
      }

      // Attendre aussi les données API si possible
      if (dossierReceived) {
        const currentApiUpdate = (await storage.getApiData())?.lastUpdate;
        if (currentApiUpdate && (!beforeApiUpdate || currentApiUpdate > beforeApiUpdate)) {
          logger.info('✅ Données API reçues !');
          dataReceived = true;
          break;
        }
        // Timeout pour les données API (8 secondes au lieu de 5)
        if (Date.now() - dossierTime > 8000) {
          logger.info('⏱️ Timeout données API, on continue avec les données dossier');
          dataReceived = true;
          break;
        }
      }
    }

    // ── Nettoyage : fermer la fenêtre ou l'onglet ──
    if (useWindow && windowId) {
      try {
        await chrome.windows.remove(windowId);
        logger.info('🗑️ Fenêtre fermée');
      } catch {}
    } else if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
        logger.info('🗑️ Onglet fermé');
      } catch {}
    }

    // Si annulée par une nouvelle actualisation, sortir sans résultat d'erreur
    if (abortController.signal.aborted) {
      return { success: false, aborted: true, error: 'Annulée (nouvelle actualisation demandée)' };
    }

    // ── Résultat ──
    if (dataReceived) {
      logger.info('✅ Actualisation réussie');
      return { success: true };
    }

    // Vérifier si c'est une maintenance
    const finalApiData = await storage.getApiData();
    if (finalApiData?.inMaintenance && finalApiData?.maintenanceDetectedAt) {
      const detectedAt = new Date(finalApiData.maintenanceDetectedAt).getTime();
      if (detectedAt > startTime) {
        return { success: false, error: 'Site ANEF en maintenance. Réessayez plus tard.', maintenance: true };
      }
    }

    // Mot de passe expiré
    if (finalApiData?.passwordExpired) {
      return { success: false, error: 'Votre mot de passe ANEF a expiré. Renouvelez-le sur le portail ANEF.', passwordExpired: true };
    }

    if (needsLogin && !hasCredentials) {
      return { success: false, needsLogin: true };
    }

    if ((loginAttempted.anef || loginAttempted.sso) && !loginCompleted) {
      return { success: false, error: 'Connexion tentée mais échec. Vérifiez vos identifiants.' };
    }

    if (loginCompleted && !dataReceived) {
      return { success: false, error: 'Connexion réussie mais données non récupérées. Réessayez.' };
    }

    return { success: false, error: 'Délai dépassé - pas de données reçues.' };

  } catch (error) {
    logger.error('Erreur actualisation:', error.message);

    if (useWindow && windowId) {
      try { await chrome.windows.remove(windowId); } catch {}
    } else if (tabId) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }

    return { success: false, error: error.message };
  } finally {
    isRefreshing = false;
    if (refreshAbortController === abortController) {
      refreshAbortController = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Vérification automatique en arrière-plan (alarms)
// ─────────────────────────────────────────────────────────────

const ALARM_NAME = 'anef-auto-check';
const ALARM_RETRY_NAME = 'anef-auto-check-retry';
const COOLDOWN_MINUTES = 60; // 1h

/**
 * Configure ou annule l'alarme de vérification automatique
 * selon les paramètres et la présence d'identifiants.
 */
async function scheduleAutoCheck() {
  const settings = await storage.getSettings();
  const hasCreds = await storage.hasCredentials();
  const meta = await storage.getAutoCheckMeta();

  // Annuler les alarmes existantes dans tous les cas
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(ALARM_RETRY_NAME);

  if (!settings.autoCheckEnabled || !hasCreds) {
    logger.info('⏹️ Auto-check désactivé', {
      enabled: settings.autoCheckEnabled,
      creds: hasCreds
    });
    return;
  }

  // Intervalle + jitter pour décaler les utilisateurs
  // Backoff progressif : après des échecs consécutifs, augmenter l'intervalle
  const baseInterval = settings.autoCheckInterval || 90;
  const failures = meta.consecutiveFailures || 0;
  const backoffMultiplier = failures > 0 ? Math.min(Math.pow(1.5, failures), 4) : 1; // cap x4 = ~12h
  const intervalMinutes = Math.round(baseInterval * backoffMultiplier);
  const jitter = settings.autoCheckJitterMin || 0;

  // Calculer le délai intelligent avant la première alarme
  let delayMinutes;
  let delayReason;

  if (meta.lastAttempt) {
    const elapsedMin = (Date.now() - new Date(meta.lastAttempt).getTime()) / 60000;

    if (elapsedMin >= intervalMinutes) {
      // En retard (PC éteint, navigateur fermé...) → check rapide avec petit jitter
      delayMinutes = Math.floor(Math.random() * 3) + 1; // 1-3 min
      delayReason = `en retard de ${Math.round(elapsedMin - intervalMinutes)} min`;
    } else {
      // Pas encore l'heure → attendre le temps restant
      delayMinutes = Math.max(1, Math.round(intervalMinutes - elapsedMin));
      delayReason = `temps restant du cycle`;
    }
  } else {
    // Jamais vérifié → délai normal avec jitter
    delayMinutes = jitter + 1;
    delayReason = 'première vérification';
  }

  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: delayMinutes,
    periodInMinutes: intervalMinutes
  });

  logger.info('⏰ Auto-check programmé', {
    interval: intervalMinutes + ' min' + (failures > 0 ? ` (backoff x${backoffMultiplier.toFixed(1)}, ${failures} échec(s))` : ''),
    firstIn: delayMinutes + ' min',
    raison: delayReason
  });
}

/**
 * Listener pour les alarmes chrome.alarms
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME && alarm.name !== ALARM_RETRY_NAME) return;

  const isRetry = alarm.name === ALARM_RETRY_NAME;
  logger.info(`⏰ Alarme déclenchée: ${alarm.name}${isRetry ? ' (retry)' : ''}`);

  try {
    // Vérifier les prérequis
    const settings = await storage.getSettings();
    if (!settings.autoCheckEnabled) {
      logger.info('⏹️ Auto-check désactivé, skip');
      return;
    }

    const hasCreds = await storage.hasCredentials();
    if (!hasCreds) {
      logger.warn('⚠️ Pas d\'identifiants, skip auto-check');
      return;
    }

    // Cooldown : skip si dernière tentative < 1h30 (ne s'applique PAS aux retries)
    const meta = await storage.getAutoCheckMeta();
    if (!isRetry && meta.lastAttempt) {
      const elapsed = Date.now() - new Date(meta.lastAttempt).getTime();
      const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
      if (elapsed < cooldownMs) {
        const remaining = Math.round((cooldownMs - elapsed) / 60000);
        logger.info(`⏳ Cooldown actif, skip (encore ${remaining} min)`);
        return;
      }
    }

    // Vérifier qu'un refresh n'est pas déjà en cours
    if (isRefreshing) {
      logger.warn('⚠️ Refresh déjà en cours, skip auto-check');
      return;
    }

    // Marquer la tentative AVANT le refresh
    await storage.saveAutoCheckMeta({ lastAttempt: new Date().toISOString() });

    // Lancer le refresh et chronométrer
    const startTime = Date.now();
    refreshPromise = backgroundRefresh();
    const result = await refreshPromise;
    const durationSec = Math.round((Date.now() - startTime) / 1000);

    // Ne pas loguer les refreshes annulés
    if (!result.aborted) {
      await storage.addCheckLogEntry({
        type: isRetry ? 'retry' : 'auto',
        success: !!result.success,
        error: result.error || null,
        duration: durationSec
      });
    }

    // Enregistrer la tentative (succès ou échec)
    if (!result.aborted) {
      await storage.saveLastCheckAttempt(!!result.success, result.error || null);
    }

    if (result.success) {
      // Succès → reset compteur d'échecs
      await storage.saveAutoCheckMeta({ consecutiveFailures: 0 });
      logger.info(`✅ Auto-check réussi (${durationSec}s)`);
    } else if (result.maintenance) {
      // Maintenance → ne pas compter comme un échec (pas la faute de l'utilisateur)
      logger.info('🔧 Site en maintenance, ne compte pas comme échec');
    } else if (result.passwordExpired) {
      // Mot de passe expiré → ne pas compter comme échec, pas la faute du système
      logger.warn('🔑 Mot de passe expiré, ne compte pas comme échec');
    } else if (result.needsLogin) {
      // Session expirée sans identifiants → ne pas compter comme échec
      logger.info('🔒 Session expirée, identifiants requis');
    } else if (result.aborted) {
      // Annulé par un refresh manuel → ne pas compter comme échec
      logger.info('🛑 Auto-check annulé par refresh manuel');
    } else {
      // Échec
      await handleAutoCheckFailure(result.error || 'Échec inconnu', isRetry);
    }

  } catch (error) {
    logger.error('❌ Erreur auto-check:', error.message);
    await storage.addCheckLogEntry({
      type: isRetry ? 'retry' : 'auto',
      success: false,
      error: error.message,
      duration: null
    });
    await storage.saveLastCheckAttempt(false, error.message);
    await handleAutoCheckFailure(error.message, isRetry);
  }
});

/**
 * Gère un échec de vérification automatique.
 * - Si alarme principale (pas retry) → incrémente le compteur + planifie 1 retry à +30 min
 * - Si retry → pas d'incrément, pas de re-retry (seuls les cycles comptent)
 * - Backoff progressif via consecutiveFailures (géré dans scheduleAutoCheck)
 */
async function handleAutoCheckFailure(reason, isRetry) {
  const meta = await storage.getAutoCheckMeta();

  const failures = isRetry ? (meta.consecutiveFailures || 0) : (meta.consecutiveFailures || 0) + 1;

  logger.warn(`⚠️ Auto-check échoué (${failures})`, { reason, isRetry });

  if (!isRetry) {
    await storage.saveAutoCheckMeta({ consecutiveFailures: failures });
    // Recréer l'alarme principale avec le nouvel intervalle (backoff progressif)
    // Ne pas toucher au retry alarm — on le crée juste après
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.clear(ALARM_RETRY_NAME);
    const settings = await storage.getSettings();
    const baseInterval = settings.autoCheckInterval || 90;
    const backoffMultiplier = Math.min(Math.pow(1.5, failures), 4);
    const intervalMinutes = Math.round(baseInterval * backoffMultiplier);
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes
    });
    logger.info('⏰ Auto-check reprogrammé', {
      interval: intervalMinutes + ' min',
      backoff: `x${backoffMultiplier.toFixed(1)} (${failures} échec(s))`
    });
    // Planifier un retry à +30 min
    await chrome.alarms.create(ALARM_RETRY_NAME, { delayInMinutes: 30 });
    logger.info('🔄 Retry programmé dans 30 min');
  }
}

/**
 * Retourne l'état complet de la vérification automatique pour l'UI.
 */
async function getAutoCheckInfo() {
  const settings = await storage.getSettings();
  const meta = await storage.getAutoCheckMeta();
  const hasCreds = await storage.hasCredentials();
  const alarms = await chrome.alarms.getAll();
  const apiData = await storage.getApiData();

  const mainAlarm = alarms.find(a => a.name === ALARM_NAME);
  const retryAlarm = alarms.find(a => a.name === ALARM_RETRY_NAME);

  return {
    enabled: settings.autoCheckEnabled,
    hasCredentials: hasCreds,
    interval: settings.autoCheckInterval,
    lastAttempt: meta.lastAttempt,
    consecutiveFailures: meta.consecutiveFailures,
    passwordExpired: apiData?.passwordExpired || false,
    nextAlarm: mainAlarm ? mainAlarm.scheduledTime : null,
    retryAlarm: retryAlarm ? retryAlarm.scheduledTime : null
  };
}

// ─────────────────────────────────────────────────────────────
// Événements du cycle de vie
// ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('🚀 Extension installée:', details.reason);

  if (details.reason === 'install') {
    // Générer un jitter aléatoire unique pour cette installation (0-60 min)
    const jitter = Math.floor(Math.random() * 60);
    await storage.saveSettings({ ...storage.DEFAULT_SETTINGS, autoCheckJitterMin: jitter });
    logger.info('🎲 Jitter auto-check généré:', jitter + ' min');

    // Tenter de restaurer l'historique depuis sync (migration ou nouveau dossier)
    const restored = await storage.restoreFromSync();
    if (restored) {
      logger.info('✅ Données restaurées depuis sync');
      const lastStatus = await storage.getLastStatus();
      if (lastStatus?.statut) await updateBadge(lastStatus.statut);
    }
  }

  if (details.reason === 'update') {
    const currentSettings = await storage.getSettings();
    // Migration unique : activer l'auto-check pour les anciennes installations
    // (ne pas forcer si l'utilisateur l'a volontairement désactivé)
    if (!currentSettings.autoCheckEnabled && !currentSettings._autoCheckMigrated) {
      await storage.saveSettings({ autoCheckEnabled: true, _autoCheckMigrated: true });
      logger.info('✅ Auto-check activé (migration initiale)');
    } else if (!currentSettings._autoCheckMigrated) {
      await storage.saveSettings({ _autoCheckMigrated: true });
    }
    // Générer un jitter si absent
    if (!currentSettings.autoCheckJitterMin) {
      const jitter = Math.floor(Math.random() * 60);
      await storage.saveSettings({ autoCheckJitterMin: jitter });
      logger.info('🎲 Jitter auto-check généré (migration):', jitter + ' min');
    }
    // Migration : forcer l'intervalle à 90 min
    if (currentSettings.autoCheckInterval !== 90) {
      await storage.saveSettings({ autoCheckInterval: 90 });
      logger.info('⏰ Intervalle auto-check corrigé:', currentSettings.autoCheckInterval, '→ 90 min');
    }
    // Migration v2.2.0 : supprimer disabledByFailure obsolète, reset compteur
    const meta = await storage.getAutoCheckMeta();
    if (meta.disabledByFailure !== undefined) {
      // Écrire directement sans spread pour supprimer les clés obsolètes
      await storage.set({
        [storage.STORAGE_KEYS.AUTO_CHECK_META]: {
          lastAttempt: meta.lastAttempt || null,
          consecutiveFailures: 0
        }
      });
      logger.info('🔄 Migration: disabledByFailure supprimé, compteur reset');
    }

    // Vérifier l'intégrité des identifiants après mise à jour
    const credCheck = await storage.verifyCredentialsIntegrity();
    if (credCheck.status === 'ok') {
      logger.info('✅ Identifiants intacts après mise à jour');
    } else if (credCheck.status === 'corrupted') {
      logger.warn('⚠️ Identifiants corrompus après mise à jour');
    }

    // Sauvegarder les données actuelles vers sync après mise à jour
    storage.scheduleBackupToSync();
    const lastStatus = await storage.getLastStatus();
    if (lastStatus?.statut) await updateBadge(lastStatus.statut);
  }

  // Programmer l'auto-check après install ou update
  await scheduleAutoCheck();
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('🚀 Extension démarrée');

  const lastStatus = await storage.getLastStatus();
  if (lastStatus?.statut) {
    await updateBadge(lastStatus.statut);
  }

  // Migration ponctuelle : forcer l'intervalle à 90 min
  const currentSettings = await storage.getSettings();
  if (currentSettings.autoCheckInterval !== 90) {
    await storage.saveSettings({ autoCheckInterval: 90 });
    logger.info('⏰ Intervalle auto-check corrigé:', currentSettings.autoCheckInterval, '→ 90 min');
  }

  // Synchroniser le backup au démarrage
  storage.scheduleBackupToSync();

  // Reprogrammer l'auto-check au démarrage du navigateur
  await scheduleAutoCheck();
});

// ─────────────────────────────────────────────────────────────
// Filet de sécurité : reconfigurer l'alarme si les paramètres changent
// dans le storage (fonctionne même si sendMessage échoue)
// ─────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    const oldEnabled = changes.settings.oldValue?.autoCheckEnabled;
    const newEnabled = changes.settings.newValue?.autoCheckEnabled;
    if (oldEnabled !== newEnabled) {
      logger.info('⚙️ autoCheckEnabled changé via storage:', oldEnabled, '→', newEnabled);
      scheduleAutoCheck();
    }
  }
});

// ─────────────────────────────────────────────────────────────

logger.info('=== Service Worker initialisé ===');
