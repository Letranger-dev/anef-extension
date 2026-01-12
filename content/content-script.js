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

  const LOG_PREFIX = '[ANEF-CS]';

  function log(level, message, data = null) {
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `${LOG_PREFIX} [${timestamp}] [${level}]`;

    console.log(data ? `${prefix} ${message}` : `${prefix} ${message}`, data || '');

    // Envoyer aussi au service worker pour le debug
    try {
      chrome.runtime.sendMessage({
        type: 'LOG',
        level,
        source: 'ContentScript',
        message,
        data: data ? JSON.stringify(data) : null
      }).catch(() => {});
    } catch {}
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

  window.addEventListener('ANEF_EXTENSION_DATA', function(event) {
    const { type, data } = event.detail || {};

    if (type && data) {
      chrome.runtime.sendMessage({ type, data })
        .then(() => logger.info('📤 Données envoyées:', type))
        .catch(e => logger.error('Erreur envoi:', e.message));
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
          }, '*');
        }, 500);
        sendResponse({ started: true });
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

    chrome.runtime.sendMessage({ type, data }).catch(() => {});
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

  function setupNavigationObserver() {
    const target = document.body || document.documentElement;
    if (!target) {
      setTimeout(setupNavigationObserver, 500);
      return;
    }

    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        chrome.runtime.sendMessage({ type: 'PAGE_CHANGED', url: lastUrl }).catch(() => {});
      }
    }).observe(target, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────────
  // Notification de page prête
  // ─────────────────────────────────────────────────────────────

  function notifyReady() {
    chrome.runtime.sendMessage({
      type: 'PAGE_READY',
      url: window.location.href,
      isLoggedIn: checkLoginStatus()
    }).catch(() => {});
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
