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
import { getStatusExplanation, isPositiveStatus, isNegativeStatus, getStepColor } from '../lib/status-parser.js';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const ANEF_BASE_URL = 'https://administration-etrangers-en-france.interieur.gouv.fr';
const LOG_STORAGE_KEY = 'debug_logs';
const MAX_LOGS = 500;

// ─────────────────────────────────────────────────────────────
// Système de logs
// ─────────────────────────────────────────────────────────────

function formatTime() {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

async function saveLog(entry) {
  try {
    const result = await chrome.storage.local.get(LOG_STORAGE_KEY);
    const logs = result[LOG_STORAGE_KEY] || [];
    logs.push(entry);
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs.slice(-MAX_LOGS) });
  } catch (e) {
    console.error('[SW] Erreur sauvegarde log:', e);
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
    case 'BACKGROUND_REFRESH':
      logger.info('🔄 Actualisation demandée');
      backgroundRefresh().then(sendResponse);
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
    // Réinitialiser l'état de maintenance
    const apiData = await storage.getApiData() || {};
    if (apiData.inMaintenance) {
      apiData.inMaintenance = false;
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
    typeDemande: data.type_demande,
    complementInstruction: data.complement_instruction,
    rawTaxePayee: data.raw_taxe_payee,
    rawEntretien: data.raw_entretien,
    lastUpdate: new Date().toISOString()
  };

  await storage.saveApiData(apiData);
  logger.info('✅ Données API sauvegardées');
}

/** Marque le site en maintenance */
async function handleMaintenance() {
  const apiData = await storage.getApiData() || {};
  apiData.inMaintenance = true;
  apiData.maintenanceDetectedAt = new Date().toISOString();
  await storage.saveApiData(apiData);
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

/** Met à jour le badge avec l'étape actuelle */
async function updateBadge(statut) {
  const statusInfo = getStatusExplanation(statut);
  const badgeText = statusInfo.etape > 0 ? statusInfo.etape.toString() : '';
  const badgeColor = getStepColor(statusInfo.etape);

  try {
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    await chrome.action.setTitle({
      title: statusInfo.found
        ? `ANEF: ${statusInfo.phase} (${statusInfo.etape}/12)`
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
  const [lastStatus, lastCheck, apiData, history, settings] = await Promise.all([
    storage.getLastStatus(),
    storage.getLastCheck(),
    storage.getApiData(),
    storage.getHistory(),
    storage.getSettings()
  ]);

  return {
    lastStatus,
    lastCheck,
    apiData,
    historyCount: history.length,
    settings,
    inMaintenance: apiData?.inMaintenance || false
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

/**
 * Actualise le statut en arrière-plan.
 * Ouvre un onglet invisible, attend les données, puis le ferme.
 * Si la session est expirée et que des identifiants sont enregistrés,
 * effectue une connexion automatique.
 */
async function backgroundRefresh() {
  logger.info('🔄 Démarrage actualisation...');

  // Configuration des délais
  const TIMEOUT_MS = 45000;
  const LOGIN_TIMEOUT_MS = 90000;
  const CHECK_INTERVAL_MS = 1000;
  const WAIT_BEFORE_CHECK_MS = 5000;
  const MON_COMPTE_URL = ANEF_BASE_URL + '/#/espace-personnel/mon-compte';

  // État
  let tabId = null;
  let dataReceived = false;
  let needsLogin = false;
  let loginAttempted = { anef: false, sso: false };
  let lastUrl = '';

  // Références pour détecter les nouvelles données
  const beforeCheck = await storage.getLastCheck();
  const beforeApiUpdate = (await storage.getApiData())?.lastUpdate;

  // Vérifier si des identifiants sont disponibles
  const credentials = await storage.getCredentials();
  const hasCredentials = !!(credentials?.username && credentials?.password);

  try {
    // Créer un onglet en arrière-plan
    const newTab = await chrome.tabs.create({ url: MON_COMPTE_URL, active: false });
    tabId = newTab.id;
    logger.info('✅ Onglet créé:', { tabId });

    const startTime = Date.now();
    const timeout = hasCredentials ? LOGIN_TIMEOUT_MS : TIMEOUT_MS;
    let dossierReceived = false;
    let dossierTime = null;

    // Boucle d'attente des données
    while (Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));

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

      // Attendre que la page soit chargée
      if (elapsed > WAIT_BEFORE_CHECK_MS && tabInfo.status === 'complete') {
        const isAnefLogin = currentUrl.includes('connexion-inscription');
        const isSSOPage = !isAnefLogin && currentUrl.includes('.gouv.fr') && (
          currentUrl.includes('authentification') ||
          currentUrl.includes('agentconnect') ||
          currentUrl.includes('/auth') ||
          currentUrl.includes('/login')
        );

        // Détecter les changements d'URL
        if (currentUrl !== lastUrl) {
          logger.info('📍 URL:', currentUrl.substring(0, 80));
          lastUrl = currentUrl;
        }

        // Page de connexion ANEF détectée
        if (isAnefLogin && !loginAttempted.anef && hasCredentials) {
          logger.info('🔐 Page connexion ANEF détectée');
          needsLogin = true;
          loginAttempted.anef = true;

          await new Promise(r => setTimeout(r, 3000));

          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'DO_AUTO_LOGIN',
              credentials
            });
            logger.info('📤 Auto-login ANEF envoyé');
          } catch (e) {
            logger.warn('Erreur auto-login ANEF:', e.message);
          }

          await new Promise(r => setTimeout(r, 8000));
          continue;
        }

        // Page SSO détectée
        if (isSSOPage && !loginAttempted.sso && hasCredentials) {
          logger.info('🔐 Page SSO détectée');
          loginAttempted.sso = true;

          await new Promise(r => setTimeout(r, 2000));

          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'DO_AUTO_LOGIN',
              credentials
            });
            logger.info('📤 Auto-login SSO envoyé');
          } catch (e) {
            logger.warn('Erreur auto-login SSO:', e.message);
          }

          await new Promise(r => setTimeout(r, 10000));
          continue;
        }

        // Session expirée sans identifiants
        if (isAnefLogin && !hasCredentials && elapsed > 10000) {
          logger.warn('🔒 Session expirée, pas d\'identifiants');
          needsLogin = true;
          break;
        }
      }

      // Vérifier si les données sont arrivées
      const currentCheck = await storage.getLastCheck();
      if (currentCheck && (!beforeCheck || currentCheck > beforeCheck)) {
        if (!dossierReceived) {
          logger.info('✅ Données reçues !');
          dossierReceived = true;
          dossierTime = Date.now();
        }
      }

      // Attendre aussi les données API si possible
      if (dossierReceived) {
        const currentApiUpdate = (await storage.getApiData())?.lastUpdate;
        if (currentApiUpdate && (!beforeApiUpdate || currentApiUpdate > beforeApiUpdate)) {
          dataReceived = true;
          break;
        }
        if (Date.now() - dossierTime > 5000) {
          dataReceived = true;
          break;
        }
      }
    }

    // Fermer l'onglet
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
        logger.info('🗑️ Onglet fermé');
      } catch {}
    }

    // Retourner le résultat
    if (dataReceived) {
      logger.info('✅ Actualisation réussie');
      return { success: true };
    }

    if (needsLogin && !hasCredentials) {
      return { success: false, needsLogin: true };
    }

    if (loginAttempted.anef || loginAttempted.sso) {
      return { success: false, error: 'Connexion tentée mais pas de données. Vérifiez vos identifiants.' };
    }

    return { success: false, error: 'Délai dépassé - pas de données reçues.' };

  } catch (error) {
    logger.error('Erreur actualisation:', error.message);

    if (tabId) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }

    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
// Événements du cycle de vie
// ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('🚀 Extension installée:', details.reason);

  if (details.reason === 'install') {
    await storage.saveSettings(storage.DEFAULT_SETTINGS);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('🚀 Extension démarrée');

  const lastStatus = await storage.getLastStatus();
  if (lastStatus?.statut) {
    await updateBadge(lastStatus.statut);
  }
});

// ─────────────────────────────────────────────────────────────

logger.info('=== Service Worker initialisé ===');
