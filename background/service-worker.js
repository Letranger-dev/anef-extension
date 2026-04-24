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
import { sendAnonymousStats, sendManualStepDates, rehydrateLocalHistoryFromServer } from '../lib/anonymous-stats.js';

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
// Nettoyage des fenêtres orphelines (veille / redémarrage)
// ─────────────────────────────────────────────────────────────

const REFRESH_WINDOW_KEY = '_refreshWindowId';

async function cleanupOrphanedWindow() {
  try {
    // 1. Fermer la fenêtre dont l'ID est sauvegardé
    const data = await chrome.storage.local.get(REFRESH_WINDOW_KEY);
    const savedWindowId = data[REFRESH_WINDOW_KEY];
    if (savedWindowId) {
      try {
        await chrome.windows.remove(savedWindowId);
        logger.info('🗑️ Fenêtre orpheline fermée:', savedWindowId);
      } catch {
        // Fenêtre déjà fermée, ok
      }
      await chrome.storage.local.remove(REFRESH_WINDOW_KEY);
    }

  } catch {}
}

// Nettoyage immédiat au chargement du service worker
cleanupOrphanedWindow();

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
      handleDossierData(message.data).catch(e => logger.error('handleDossierData error', e));
      sendResponse({ received: true });
      break;

    // Données du stepper (ID dossier)
    case 'DOSSIER_STEPPER':
      logger.info('📥 Stepper reçu', { id: message.data?.dossier?.id });
      handleDossierStepper(message.data).catch(e => logger.error('handleDossierStepper error', e));
      break;

    // Données détaillées de l'API
    case 'API_DATA':
      logger.info('📥 Données API reçues');
      handleApiData(message.data).catch(e => logger.error('handleApiData error', e));
      break;

    // Notifications ANEF
    case 'NOTIFICATIONS':
      logger.info('📥 Notifications reçues', { count: message.data?.length });
      handleNotifications(message.data).catch(e => logger.error('handleNotifications error', e));
      break;

    // Informations utilisateur
    case 'USER_INFO':
      logger.info('📥 Infos utilisateur reçues', message.data);
      handleUserInfo(message.data).catch(e => logger.error('handleUserInfo error', e));
      break;

    // Historique des séjours
    case 'HISTORIQUE':
      logger.info('📥 Historique reçu', message.data);
      handleHistorique(message.data).catch(e => logger.error('handleHistorique error', e));
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
      handleMaintenance().catch(e => logger.error('handleMaintenance error', e));
      break;

    // Session expirée (JWT invalide / mot de passe expiré)
    case 'EXPIRED_SESSION':
      logger.warn('🔑 Session expirée détectée (JWT invalide)');
      handleExpiredSession().catch(e => logger.error('handleExpiredSession error', e));
      break;

    // Résultat de la récupération par le script injecté
    case 'FETCH_COMPLETE':
      logger.info('📥 Fetch terminé:', message.data);
      handleFetchComplete(message.data);
      break;

    // Signaux du script auto-login (relayés par content-script.js)
    case 'LOGIN_CLICKED':
    case 'LOGIN_SUBMITTED':
    case 'LOGIN_SUCCESS':
      logger.info('🔐 ' + message.type);
      handleLoginSignal(message.type, message.data);
      break;
    case 'LOGIN_FAILED':
    case 'NEED_CLICK_LOGIN':
      logger.warn('🔐 ' + message.type + ':', message.data?.error);
      handleLoginSignal(message.type, message.data);
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
      const p = backgroundRefresh();
      refreshPromise = p;
      p.then(async (result) => {
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

    // Test notification (dev/debug)
    case 'TEST_NOTIFICATION':
      sendStatusChangeNotification({ statut: message.statut || 'controle_a_effectuer' })
        .then(() => sendResponse({ sent: true }))
        .catch(e => sendResponse({ error: e.message }));
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

    // Multi-dossier : définir un nouveau dossier principal
    case 'SET_PRIMARY_DOSSIER':
      (async () => {
        try {
          await storage.setPrimaryDossier(message.dossierId);
          const newPrimary = await storage.getPrimaryDossier();
          if (newPrimary?.lastStatus?.statut) {
            await updateBadge(newPrimary.lastStatus.statut);
          }
          logger.info('⭐ Dossier principal changé:', message.dossierId);
          // Reprogrammer l'auto-check (creds effacées par setPrimaryDossier → désactivé)
          await scheduleAutoCheck();
          sendResponse({ success: true });
        } catch (e) {
          logger.error('SET_PRIMARY_DOSSIER error:', e.message);
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    // Multi-dossier : retirer un dossier secondaire de la liste locale
    // ⚠️ Ne supprime JAMAIS côté Supabase — règle absolue.
    case 'REMOVE_DOSSIER':
      (async () => {
        try {
          const removed = await storage.removeDossier(message.dossierId);
          logger.info('🗑 Dossier retiré (local only):', message.dossierId);
          sendResponse({ success: !!removed });
        } catch (e) {
          logger.error('REMOVE_DOSSIER error:', e.message);
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    // Récupérer les stepDates depuis chrome.storage.sync (backup auto multi-appareils)
    // → remplace l'ancien lookup Supabase pour éviter l'exposition par hash.
    case 'PULL_STEP_DATES':
      (async () => {
        try {
          const result = await storage.restoreStepDatesFromSync();
          sendResponse({ count: result.count });
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

    // ── Routage multi-dossier (v2.6.0+) ──
    // Chaque dossier a son propre record dans `dossiers[id]`. Pas de wipe :
    // on écrit dans le record correspondant à data.id. Si c'est un nouveau
    // dossier, il est ajouté comme secondaire (sauf si aucun primaire défini,
    // auquel cas upsertDossier le promeut automatiquement).
    const newId = data.id ? String(data.id) : null;
    const primaryId = await storage.getPrimaryDossierId();
    const knownDossiers = await storage.getDossiers();
    const isKnown = newId && knownDossiers[newId];
    const isNewSecondary = newId && !isKnown && primaryId && newId !== primaryId;

    // Comparaison de statut SCOPED au dossier reçu (pas le primaire)
    const prevStatus = newId ? (await storage.getLastStatus(newId)) : null;
    const hasChanged = !prevStatus
      || prevStatus.date_statut !== data.date_statut
      || (prevStatus.statut || '').toLowerCase() !== (data.statut || '').toLowerCase();

    // Écrire les données dans le bon record (saveStatus route via data.id)
    await storage.saveStatus(data);
    logger.info('✅ Statut sauvegardé', { dossierId: newId, isNew: isNewSecondary });

    if (isNewSecondary) {
      // Nouveau dossier détecté → notification informative (pas de wipe)
      await chrome.storage.local.set({
        dossierSwitchNotice: {
          at: new Date().toISOString(),
          previousId: primaryId,
          newId: newId,
          acknowledged: false,
          isNewSecondary: true
        }
      });
      await sendDossierChangedNotification(newId, primaryId);
    } else if (hasChanged && newId === primaryId) {
      // Changement de statut sur le primaire → notification standard
      logger.info('🔔 Changement de statut détecté !', { nouveau: data.statut });
      await sendStatusChangeNotification(data);
    }

    // Mettre à jour le badge seulement pour le primaire (ou premier dossier)
    if (!primaryId || newId === primaryId) {
      await updateBadge(data.statut);
    }

  } catch (error) {
    logger.error('Erreur traitement dossier:', error.message);
  }
}

/** Traite les données du stepper */
async function handleDossierStepper(data) {
  if (!data?.dossier?.id) return;

  const newId = String(data.dossier.id);
  const apiData = await storage.getApiData() || {};
  const oldId = apiData.dossierId ? String(apiData.dossierId) : null;

  // Détection de changement de dossier : si l'ID actuel diffère du précédent,
  // on wipe history / stepDates / lastStatus pour éviter le mélange entre
  // deux dossiers (ex: utilisateur + conjoint sur le même navigateur).
  // Sans ce reset, les transitions affichées sur le site peuvent être
  // incohérentes (ex: 11.1 → 8.1) et les stepDates se mélangent.
  if (oldId && oldId !== newId) {
    logger.warn('🔀 Changement de dossier détecté, reset des données locales', {
      oldId, newId
    });
    await storage.resetForNewDossier(newId);
    return;
  }

  apiData.dossierId = newId;
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

  // Statistiques anonymes communautaires + rehydrate post-switch
  // `lastStatus` doit être celui du dossier dont on traite les données,
  // pas du primaire (en multi-dossier, les secondaires mettent à jour aussi
  // leurs snapshots Supabase quand l'user les visite).
  const lastStatus = await storage.getLastStatus(apiData.dossierId);
  if (lastStatus) {
    // Lit le flag dossierSwitchNotice.acknowledged=false pour déclencher
    // la réhydratation complète depuis Supabase lors du changement de dossier.
    const { dossierSwitchNotice } = await chrome.storage.local.get('dossierSwitchNotice');
    const isPostSwitch = dossierSwitchNotice && !dossierSwitchNotice.rehydrated
      && dossierSwitchNotice.newId === apiData.dossierId;

    const result = await sendAnonymousStats(lastStatus, apiData).catch(e => {
      logger.warn('sendAnonymousStats error', e.message);
      return null;
    });

    // Rehydrate local depuis le serveur si on vient de basculer sur un dossier déjà connu
    if (isPostSwitch && result?.history?.length) {
      try {
        const count = await rehydrateLocalHistoryFromServer(result.history, apiData.dossierId);
        logger.info('🔁 Rehydrate depuis Supabase post-switch', { entrees: count, dossierId: apiData.dossierId });
        // Marquer comme rehydraté pour éviter de refaire la manip
        await chrome.storage.local.set({
          dossierSwitchNotice: { ...dossierSwitchNotice, rehydrated: true }
        });
      } catch (e) {
        logger.warn('Rehydrate échoué', e.message);
      }
    }
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

/**
 * Signal de résultat du script auto-login (LOGIN_CLICKED, LOGIN_SUBMITTED,
 * LOGIN_SUCCESS, LOGIN_FAILED, NEED_CLICK_LOGIN). Permet à backgroundRefresh
 * de réagir immédiatement au lieu d'attendre un sleep de 5-8s puis de boucler.
 */
let loginSignal = null;

function handleLoginSignal(type, data) {
  loginSignal = {
    type,
    reason: data?.error || null,
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

/** Envoie une notification discrète de changement de statut */
async function sendStatusChangeNotification(data) {
  const settings = await storage.getSettings();
  if (!settings.notificationsEnabled) {
    logger.info('Notifications désactivées, pas d\'envoi');
    return;
  }

  const statusInfo = getStatusExplanation(data.statut);
  let title = 'Nouveau statut ANEF';

  if (isPositiveStatus(data.statut)) {
    title = 'Bonne nouvelle ANEF !';
  } else if (isNegativeStatus(data.statut)) {
    title = 'Mise à jour ANEF';
  }

  const notifId = 'anef-status-' + Date.now();

  try {
    await chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon-128.png'),
      title,
      message: `${statusInfo.phase} — ${statusInfo.explication}`,
      priority: 1,
      silent: true,
      requireInteraction: false
    });
    logger.info('Notification envoyée:', notifId);
  } catch (error) {
    logger.error('Erreur notification:', error.message);
  }
}

// Clic sur la notification → ouvre le popup
chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId.startsWith('anef-status-') || notifId.startsWith('anef-dossier-switch-')) {
    chrome.notifications.clear(notifId);
  }
});

/** Notifie l'utilisateur qu'un autre dossier est en cours de suivi */
async function sendDossierChangedNotification(newId, oldId) {
  const settings = await storage.getSettings();
  if (!settings.notificationsEnabled) return;
  const notifId = 'anef-dossier-switch-' + Date.now();
  try {
    await chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon-128.png'),
      title: 'Dossier ANEF changé',
      message: 'Un nouveau dossier est désormais suivi. L\'historique local a été réinitialisé pour éviter le mélange de données.',
      priority: 1,
      silent: false,
      requireInteraction: false
    });
    logger.info('Notification changement de dossier envoyée', { notifId, newId, oldId });
  } catch (error) {
    logger.error('Erreur notification dossier:', error.message);
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
  const [lastStatus, lastCheck, lastCheckAttempt, apiData, history, settings, primaryHasCredentials] = await Promise.all([
    storage.getLastStatus(),
    storage.getLastCheck(),
    storage.getLastCheckAttempt(),
    storage.getApiData(),
    storage.getHistory(),
    storage.getSettings(),
    storage.hasCredentials()  // primaire
  ]);

  return {
    lastStatus,
    lastCheck,
    lastCheckAttempt,
    apiData,
    historyCount: history.length,
    settings,
    inMaintenance: apiData?.inMaintenance || false,
    passwordExpired: apiData?.passwordExpired || false,
    primaryHasCredentials
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
 * Attend jusqu'à `ms` OU jusqu'à ce que `check()` retourne truthy.
 * Utilisé pour sortir rapidement quand un LOGIN_FAILED / LOGIN_SUCCESS
 * arrive pendant un sleep post-login, au lieu d'attendre les 5-8s complets.
 * Retourne 'signal' / 'aborted' / 'timeout'.
 */
function sleepUntilSignal(ms, signal, check) {
  if (signal.aborted) return Promise.resolve('aborted');
  return new Promise((resolve) => {
    const start = Date.now();
    let done = false;
    const finish = (reason) => { if (!done) { done = true; resolve(reason); } };
    signal.addEventListener('abort', () => finish('aborted'), { once: true });
    const tick = () => {
      if (done) return;
      if (check()) return finish('signal');
      if (Date.now() - start >= ms) return finish('timeout');
      setTimeout(tick, 300);
    };
    tick();
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

  // v2.6.1 multi-dossier : snapshot du primaire avant refresh
  // pour détecter si le fetch ramène un autre dossier (user connecté sur un
  // compte différent sur ANEF).
  const expectedPrimaryId = await storage.getPrimaryDossierId();
  const beforePrimaryLastCheck = expectedPrimaryId
    ? (await storage.getLastCheck(expectedPrimaryId)) : null;

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

  // Nettoyer toute fenêtre orpheline d'un refresh précédent
  await cleanupOrphanedWindow();

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

  // v2.6.1 : snapshot des lastCheck de TOUS les dossiers, pour détecter
  // qu'un autre dossier (secondaire) a été fetched à la place du primaire.
  const beforeLastChecksByDossier = {};
  const _dossiersBefore = await storage.getDossiers();
  for (const id in _dossiersBefore) {
    beforeLastChecksByDossier[id] = _dossiersBefore[id].lastCheck || null;
  }

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

      // Persister l'ID pour nettoyage après veille/redémarrage
      await chrome.storage.local.set({ [REFRESH_WINDOW_KEY]: windowId });

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
          loginSignal = null;         // Reset signal login pour ce tour

          // Attendre que Angular soit prêt (MutationObserver côté auto-login)
          await abortableSleep(1500, abortController.signal);
          if (abortController.signal.aborted) continue;

          const sendRef = Date.now();
          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'DO_AUTO_LOGIN',
              credentials
            });
            logger.info('📤 Auto-login ANEF envoyé');
          } catch (e) {
            logger.warn('Erreur auto-login ANEF:', e.message);
          }

          // Attendre la redirection ou un signal explicite du script auto-login.
          // Sort tôt sur LOGIN_CLICKED / LOGIN_FAILED / NEED_CLICK_LOGIN.
          const result = await sleepUntilSignal(5000, abortController.signal,
            () => loginSignal && loginSignal.timestamp >= sendRef);
          if (result === 'signal' && (loginSignal.type === 'LOGIN_FAILED' || loginSignal.type === 'NEED_CLICK_LOGIN')) {
            logger.warn('⚠️ Login ANEF échoué:', loginSignal.reason);
            break;
          }
          continue;
        }

        // Page SSO détectée
        if (isSSOPage && !loginAttempted.sso && hasCredentials) {
          logger.info('🔐 Page SSO détectée');
          loginAttempted.sso = true;
          fetchCompleteSignal = null; // Signal pré-login obsolète
          loginSignal = null;

          // Attendre que le formulaire soit prêt (MutationObserver côté auto-login)
          await abortableSleep(1000, abortController.signal);
          if (abortController.signal.aborted) continue;

          const sendRef = Date.now();
          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'DO_AUTO_LOGIN',
              credentials
            });
            logger.info('📤 Auto-login SSO envoyé');
          } catch (e) {
            logger.warn('Erreur auto-login SSO:', e.message);
          }

          // Attendre la soumission + redirection, ou sortir tôt sur échec.
          const result = await sleepUntilSignal(8000, abortController.signal,
            () => loginSignal && loginSignal.timestamp >= sendRef);
          if (result === 'signal' && loginSignal.type === 'LOGIN_FAILED') {
            logger.warn('⚠️ Login SSO échoué:', loginSignal.reason);
            break;
          }
          continue;
        }

        // Session expirée sans identifiants — bail après 5s (au lieu de 10s)
        // car on ne pourra pas auto-login de toute façon
        if (isAnefLogin && !hasCredentials && elapsed > 5000) {
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

      // Vérifier si les données sont arrivées (primaire OU un secondaire)
      const currentCheck = await storage.getLastCheck();
      let anyDossierUpdated = currentCheck && (!beforeCheck || currentCheck > beforeCheck);
      // v2.6.1 : vérifier aussi si un SECONDAIRE a reçu des données (user connecté
      // sur un autre compte ANEF que le primaire)
      if (!anyDossierUpdated) {
        const currentDossiers = await storage.getDossiers();
        for (const id in currentDossiers) {
          const prevLc = beforeLastChecksByDossier[id] || '';
          const curLc = currentDossiers[id].lastCheck || '';
          if (curLc && curLc > prevLc) {
            anyDossierUpdated = true;
            break;
          }
        }
      }

      if (anyDossierUpdated && !dossierReceived) {
        logger.info('✅ Données dossier reçues !');
        dossierReceived = true;
        dossierTime = Date.now();
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
      await chrome.storage.local.remove(REFRESH_WINDOW_KEY).catch(() => {});
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

    // ── Helper : détecter un dossier secondaire fetched pendant ce refresh ──
    // Priorité sur toutes les autres conclusions (maintenance, timeout, ...)
    // car ça résout explicitement un cas concret : user connecté sur un autre
    // compte ANEF que le primaire de l'extension.
    async function _detectUnexpectedDossier() {
      if (!expectedPrimaryId) return null;
      try {
        const dossiers = await storage.getDossiers();
        let fetchedId = null;
        let mostRecent = '';
        for (const id in dossiers) {
          if (id === expectedPrimaryId) continue;
          const prevLc = beforeLastChecksByDossier[id] || '';
          const curLc = dossiers[id].lastCheck || '';
          if (curLc && curLc > prevLc && curLc > mostRecent) {
            mostRecent = curLc;
            fetchedId = id;
          }
        }
        if (!fetchedId) return null;
        return {
          fetchedId,
          fetchedNumero: dossiers[fetchedId]?.apiData?.numeroNational || null,
          expectedId: expectedPrimaryId,
          expectedNumero: dossiers[expectedPrimaryId]?.apiData?.numeroNational || null
        };
      } catch (e) {
        logger.warn('_detectUnexpectedDossier failed:', e.message);
        return null;
      }
    }

    // v2.6.1 : check prioritaire — un secondaire a-t-il été fetched ?
    const unexpected = await _detectUnexpectedDossier();

    // ── Résultat ──
    if (dataReceived) {
      logger.info('✅ Actualisation réussie');
      if (unexpected) {
        return { success: true, unexpectedDossier: unexpected };
      }
      return { success: true };
    }

    // Si on a reçu des données pour un autre dossier mais le loop a timeout
    // → c'est quand même un "mauvais compte", pas une vraie maintenance
    if (unexpected) {
      logger.info('✅ Autre dossier fetched (user connecté sur autre compte ANEF)');
      return { success: true, unexpectedDossier: unexpected };
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
      await chrome.storage.local.remove(REFRESH_WINDOW_KEY).catch(() => {});
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
const COOLDOWN_MINUTES = 45; // 45 min (marge sous l'intervalle de 60 min)

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
  const backoffMultiplier = failures > 0 ? Math.min(Math.pow(1.5, failures), 4) : 1; // cap x4 = ~4h (60×4)
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

    // Cooldown : skip si dernière tentative < COOLDOWN_MINUTES (ne s'applique PAS aux retries)
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

  // Migration multi-dossier v2.6.0 : encapsuler les données v2.5.x dans
  // dossiers[id]. Idempotent — ne fait rien si déjà migré ou rien à migrer.
  try {
    const migrated = await storage.migrateToMultiDossier();
    if (migrated) logger.info('✅ Migration v2.6.0 multi-dossier effectuée');
  } catch (e) {
    logger.error('Migration multi-dossier échouée:', e.message);
  }

  // v2.6.2+ safety net : si les creds ont disparu (bug antérieur ou migration
  // ratée), essayer de les restaurer depuis le backup pré-migration.
  try {
    const recovered = await storage.recoverCredentialsIfLost();
    if (recovered) logger.warn('⚠️ Credentials restaurées depuis backup pré-migration');
  } catch (e) {
    logger.error('Recovery credentials échoué:', e.message);
  }

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
    // Migration : forcer l'intervalle à 60 min (une seule fois — flag _intervalMigrated60)
    if (currentSettings.autoCheckInterval !== 60 && !currentSettings._intervalMigrated60) {
      await storage.saveSettings({ autoCheckInterval: 60, _intervalMigrated60: true });
      logger.info('⏰ Intervalle auto-check corrigé:', currentSettings.autoCheckInterval, '→ 60 min');
    } else if (!currentSettings._intervalMigrated60) {
      await storage.saveSettings({ _intervalMigrated60: true });
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

  // Nettoyer les fenêtres orphelines (veille, redémarrage, crash)
  await cleanupOrphanedWindow();

  const lastStatus = await storage.getLastStatus();
  if (lastStatus?.statut) {
    await updateBadge(lastStatus.statut);
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
      scheduleAutoCheck().catch(e => logger.error('scheduleAutoCheck error', e));
    }
  }
});

// ─────────────────────────────────────────────────────────────

logger.info('=== Service Worker initialisé ===');
