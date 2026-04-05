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

  logger.info('Content Script chargé');

  // ─────────────────────────────────────────────────────────────
  // Injection du script d'interception
  // ─────────────────────────────────────────────────────────────

  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/injected-script.js');
    // Passer l'URL locale de forge.js (le script injecté n'a pas accès à chrome.runtime)
    script.dataset.forgeUrl = chrome.runtime.getURL('lib/forge.min.js');
    script.onload = function() {
      logger.info('✅ Script d\'interception injecté');
      this.remove();
    };
    script.onerror = () => logger.error('Erreur injection script');

    (document.documentElement || document.head || document.body).appendChild(script);
  }

  injectScript();

  // ─────────────────────────────────────────────────────────────
  // Réception des données interceptées
  // ─────────────────────────────────────────────────────────────

  // Types de messages autorisés (whitelist sécurité)
  const ALLOWED_MESSAGE_TYPES = [
    'DOSSIER_DATA', 'DOSSIER_STEPPER', 'API_DATA', 'NOTIFICATIONS',
    'USER_INFO', 'HISTORIQUE', 'MAINTENANCE', 'EXPIRED_SESSION', 'FETCH_COMPLETE', 'LOG'
  ];

  window.addEventListener('ANEF_EXTENSION_DATA', function(event) {
    const { type, data } = event.detail || {};

    if (!type || !ALLOWED_MESSAGE_TYPES.includes(type)) {
      logger.warn('Type de message non autorisé ignoré:', type);
      return;
    }

    if (data) {
      safeSendMessage({ type, data })
        .then(() => logger.info('📤 Données envoyées:', type));
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
        logger.info('🔐 Auto-login demandé');
        injectAutoLoginScript();
        setTimeout(() => {
          window.postMessage({
            source: 'ANEF_EXTENSION',
            type: 'DO_AUTO_LOGIN',
            credentials: message.credentials
          }, window.location.origin);
        }, 500);
        sendResponse({ started: true });
        return true;

      // Déclencher la récupération des données
      case 'TRIGGER_DATA_FETCH':
        logger.info('📥 Demande de récupération des données');
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
      logger.info('✅ Script auto-login injecté');
      this.remove();
    };
    script.onerror = () => logger.error('Erreur injection auto-login');

    (document.documentElement || document.head || document.body).appendChild(script);
  }

  // Écouter les résultats du script auto-login
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data?.source !== 'ANEF_AUTO_LOGIN') return;

    const { type, data } = event.data;
    logger.info('📥 Résultat auto-login:', type);

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
        logger.info('📍 Navigation détectée:', { from: previousUrl.split('#')[1], to: lastUrl.split('#')[1] });
        safeSendMessage({ type: 'PAGE_CHANGED', url: lastUrl });

        const wasOnLogin = previousUrl.includes('connexion-inscription') ||
                          previousUrl.includes('authentification') ||
                          previousUrl.includes('/auth') ||
                          previousUrl.includes('/login');
        const isOnMonCompte = lastUrl.includes('mon-compte');

        // Reset quand on quitte mon-compte → permet un re-fetch au retour
        if (!isOnMonCompte && injectedScriptTriggered) {
          injectedScriptTriggered = false;
        }

        // Si on arrive sur mon-compte après connexion ou retour, relancer la récupération
        if (isOnMonCompte && (wasOnLogin || !injectedScriptTriggered)) {
          logger.info('🔄 Relance du script d\'interception après navigation');
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
    }, window.location.origin);
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
      logger.info('🏠 Page d\'accueil après login, redirection vers mon-compte...');
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

    logger.info('Content Script initialisé');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
