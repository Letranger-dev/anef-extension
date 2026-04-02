/**
 * Content Script - Extension ANEF Status Tracker
 *
 * Injecté automatiquement sur les pages ANEF.
 * Rôle : faire le pont entre la page web et l'extension.
 *
 * - Injecte le script d'interception des appels API
 * - Relaie les données interceptées au service worker
 * - Gère les demandes de connexion automatique
 */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // Système de logs
  // ─────────────────────────────────────────────────────────────

  /** Envoie un message au service worker en avalant les erreurs "No SW" */
  function safeSendMessage(msg) {
    try {
      return chrome.runtime.sendMessage(msg).catch(() => {});
    } catch { return Promise.resolve(); }
  }

  const LOG_PREFIX = '[ANEF-CS]';

  function log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' });
    const prefix = `${LOG_PREFIX} [${timestamp}] [${level}]`;

    console.log(data ? `${prefix} ${message}` : `${prefix} ${message}`, data || '');

    // Envoyer aussi au service worker pour le debug
    safeSendMessage({
      type: 'LOG',
      level,
      source: 'ContentScript',
      message,
      data: data ? JSON.stringify(data) : null
    });
  }

  const logger = {
    debug: (msg, data) => log('DEBUG', msg, data),
    info: (msg, data) => log('INFO', msg, data),
    warn: (msg, data) => log('WARN', msg, data),
    error: (msg, data) => log('ERROR', msg, data)
  };

  // ─────────────────────────────────────────────────────────────
  // Protection contre les injections multiples
  // ─────────────────────────────────────────────────────────────

  if (window.__ANEF_EXTENSION_INJECTED__) return;
  window.__ANEF_EXTENSION_INJECTED__ = true;

  logger.info('Content Script loaded');

  // ─────────────────────────────────────────────────────────────
  // Injection du script d'interception
  // ─────────────────────────────────────────────────────────────

  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/injected-script.js');
    // Passer l'URL locale de forge.js (le script injecté n'a pas accès à chrome.runtime)
    script.dataset.forgeUrl = chrome.runtime.getURL('lib/forge.min.js');
    script.onload = function() {
      logger.info('✅ Interception script injected');
      this.remove();
    };
    script.onerror = () => logger.error('Script injection error');

    (document.documentElement || document.head || document.body).appendChild(script);
  }

  injectScript();

  // ─────────────────────────────────────────────────────────────
  // Réception des données interceptées
  // ─────────────────────────────────────────────────────────────

  // Types de messages autorisés (whitelist sécurité)
  const ALLOWED_MESSAGE_TYPES = [
    'DOSSIER_DATA', 'DOSSIER_STEPPER', 'API_DATA', 'NOTIFICATIONS',
    'USER_INFO', 'HISTORIQUE', 'MAINTENANCE', 'FETCH_COMPLETE', 'LOG'
  ];

  window.addEventListener('ANEF_EXTENSION_DATA', function(event) {
    const { type, data } = event.detail || {};

    if (!type || !ALLOWED_MESSAGE_TYPES.includes(type)) {
      logger.warn('Unauthorized message type ignored:', type);
      return;
    }

    if (data) {
      safeSendMessage({ type, data })
        .then(() => logger.info('📤 Data sent:', type));
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Gestionnaire de messages (popup/service worker)
  // ─────────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      // Vérifier si l'utilisateur est connecté
      case 'CHECK_LOGIN_STATUS':
        sendResponse({ isLoggedIn: checkLoginStatus() });
        return true;

      // Obtenir les infos de la page
      case 'GET_PAGE_INFO':
        sendResponse({ url: window.location.href, title: document.title });
        return true;

      // Lancer la connexion automatique
      case 'DO_AUTO_LOGIN':
        logger.info('🔐 Auto-login requested');
        injectAutoLoginScript();
        setTimeout(() => {
          window.postMessage({
            source: 'ANEF_EXTENSION',
            type: 'DO_AUTO_LOGIN',
            credentials: message.credentials
          }, '*');
        }, 500);
        sendResponse({ started: true });
        return true;

      // Déclencher la récupération des données
      case 'TRIGGER_DATA_FETCH':
        logger.info('📥 Data fetch requested');
        triggerDataFetch();
        sendResponse({ triggered: true });
        return true;

      // Vérifier si la page contient un formulaire de connexion
      case 'CHECK_LOGIN_FORM':
        const hasForm = !!(
          document.querySelector("input[name='username']") ||
          document.querySelector("input[type='email']") ||
          document.querySelector("input[id='username']") ||
          document.querySelector("input[name='login']")
        );
        sendResponse({ hasForm });
        return true;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Injection du script de connexion automatique
  // ─────────────────────────────────────────────────────────────

  let autoLoginInjected = false;

  function injectAutoLoginScript() {
    if (autoLoginInjected) return;
    autoLoginInjected = true;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/auto-login.js');
    script.onload = function() {
      logger.info('✅ Auto-login script injected');
      this.remove();
    };
    script.onerror = () => logger.error('Auto-login injection error');

    (document.documentElement || document.head || document.body).appendChild(script);
  }

  // Écouter les résultats du script auto-login
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data?.source !== 'ANEF_AUTO_LOGIN') return;

    const { type, data } = event.data;
    logger.info('📥 Auto-login result:', type);

    safeSendMessage({ type, data });
  });

  // ─────────────────────────────────────────────────────────────
  // Détection du statut de connexion
  // ─────────────────────────────────────────────────────────────

  function checkLoginStatus() {
    return !!(
      document.querySelector('.user-menu') ||
      document.querySelector('.user-profile') ||
      document.querySelector('[class*="deconnexion"]') ||
      document.querySelector('a[href*="deconnexion"]') ||
      window.location.href.includes('mon-compte')
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Observation des navigations (SPA Angular)
  // ─────────────────────────────────────────────────────────────

  let lastUrl = location.href;
  let injectedScriptTriggered = false;
  let navigationObserver = null; // Éviter les créations multiples

  function setupNavigationObserver() {
    if (navigationObserver) return; // Déjà créé

    const target = document.body || document.documentElement;
    if (!target) {
      setTimeout(setupNavigationObserver, 500);
      return;
    }

    navigationObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        const previousUrl = lastUrl;
        lastUrl = location.href;
        logger.info('📍 Navigation detected:', { from: previousUrl.split('#')[1], to: lastUrl.split('#')[1] });
        safeSendMessage({ type: 'PAGE_CHANGED', url: lastUrl });

        // Si on arrive sur mon-compte après une connexion, relancer le script d'injection
        const wasOnLogin = previousUrl.includes('connexion-inscription') ||
                          previousUrl.includes('authentification') ||
                          previousUrl.includes('/auth') ||
                          previousUrl.includes('/login');
        const isOnMonCompte = lastUrl.includes('mon-compte');

        if (isOnMonCompte && (wasOnLogin || !injectedScriptTriggered)) {
          logger.info('🔄 Re-launching interception script after navigation');
          injectedScriptTriggered = true;
          setTimeout(() => {
            triggerDataFetch();
          }, 800);
        }
      }
    });

    navigationObserver.observe(target, { childList: true, subtree: true });
  }

  /** Déclenche la récupération des données via le script injecté */
  function triggerDataFetch() {
    window.postMessage({
      source: 'ANEF_EXTENSION',
      type: 'TRIGGER_DATA_FETCH'
    }, '*');
  }

  // ─────────────────────────────────────────────────────────────
  // Notification de page prête
  // ─────────────────────────────────────────────────────────────

  function notifyReady() {
    safeSendMessage({
      type: 'PAGE_READY',
      url: window.location.href,
      isLoggedIn: checkLoginStatus()
    });

    // Optimisation: si on est sur la page d'accueil, naviguer directement vers mon-compte
    // Cela évite d'attendre que le service-worker détecte l'URL
    checkAndRedirectToMonCompte();
  }

  /** Redirige vers mon-compte si on est sur la page d'accueil après login */
  function checkAndRedirectToMonCompte() {
    const url = window.location.href;
    const isHomepage = url.endsWith('/#/') || url.endsWith('/#') || url.match(/particuliers\/#\/?$/);

    if (!isHomepage) return;

    // Ne rediriger que si on vient d'une page SSO (referrer contient sso ou auth)
    const referrer = document.referrer || '';
    const cameFromLogin = referrer.includes('sso.') ||
                          referrer.includes('/auth') ||
                          referrer.includes('connexion');

    if (cameFromLogin) {
      logger.info('🏠 Homepage after login, redirecting to mon-compte...');
      window.location.href = 'https://administration-etrangers-en-france.interieur.gouv.fr/particuliers/#/espace-personnel/mon-compte';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Initialisation
  // ─────────────────────────────────────────────────────────────

  function init() {
    setupNavigationObserver();

    if (document.readyState === 'complete') {
      notifyReady();
    } else {
      window.addEventListener('load', notifyReady);
    }

    logger.info('Content Script initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
