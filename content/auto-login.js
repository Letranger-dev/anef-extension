/**
 * Script de connexion automatique - Extension ANEF Status Tracker
 *
 * Gère la connexion automatique au site ANEF :
 * 1. Sur la page ANEF : clique sur "Se connecter"
 * 2. Sur la page SSO : remplit le formulaire et soumet
 */

(function() {
  'use strict';

  const LOG_PREFIX = '[ANEF-AUTO-LOGIN]';

  function log(msg, data) {
    console.log(data !== undefined ? `${LOG_PREFIX} ${msg}` : `${LOG_PREFIX} ${msg}`, data || '');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────────────────────
  // Utilitaires
  // ─────────────────────────────────────────────────────────────

  /** Attend qu'un élément soit présent dans le DOM */
  async function waitForElement(selector, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await sleep(300);
    }
    return null;
  }

  /** Simule une saisie de texte */
  function fillInput(input, text) {
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Envoie un message au content script */
  function notifyExtension(type, data) {
    window.postMessage({ source: 'ANEF_AUTO_LOGIN', type, data }, '*');
  }

  // ─────────────────────────────────────────────────────────────
  // Détection du type de page
  // ─────────────────────────────────────────────────────────────

  function detectPageType() {
    const url = window.location.href;

    if (url.includes('connexion-inscription')) {
      return 'ANEF_LOGIN';
    }

    if (document.querySelector("input[name='username']") ||
        document.querySelector("input[type='email']")) {
      return 'SSO_LOGIN';
    }

    if (url.includes('mon-compte')) {
      return 'LOGGED_IN';
    }

    return 'UNKNOWN';
  }

  // ─────────────────────────────────────────────────────────────
  // Étape 1 : Page ANEF - Cliquer sur "Se connecter"
  // ─────────────────────────────────────────────────────────────

  async function clickSeConnecter() {
    log('📍 ANEF page detected');

    // Attendre que Angular charge
    await sleep(2000);

    const btn = await waitForElement('p-button.fullWidthButton button', 10000);

    if (!btn) {
      log('❌ "Se connecter" button not found');
      notifyExtension('NEED_CLICK_LOGIN', { error: 'Button not found' });
      return false;
    }

    log('👆 Clicking "Se connecter"');
    btn.click();
    notifyExtension('LOGIN_CLICKED', {});

    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Étape 2 : Page SSO - Remplir le formulaire
  // ─────────────────────────────────────────────────────────────

  async function fillSSOForm(username, password) {
    log('📍 SSO page detected');

    const usernameInput = await waitForElement(
      "input[name='username'], input[type='email'], input[id='username']",
      10000
    );

    if (!usernameInput) {
      log('❌ Username field not found');
      notifyExtension('LOGIN_FAILED', { error: 'Username field not found' });
      return false;
    }

    log('📝 Filling username');
    fillInput(usernameInput, username);
    await sleep(500);

    const passwordInput = document.querySelector(
      "input[name='password'], input[type='password']"
    );

    if (!passwordInput) {
      log('❌ Password field not found');
      notifyExtension('LOGIN_FAILED', { error: 'Password field not found' });
      return false;
    }

    log('📝 Filling password');
    fillInput(passwordInput, password);
    await sleep(500);

    const submitBtn = document.querySelector(
      "button.fr-btn[type='submit'], button[type='submit'], input[type='submit']"
    );

    if (!submitBtn) {
      log('❌ Submit button not found');
      notifyExtension('LOGIN_FAILED', { error: 'Submit button not found' });
      return false;
    }

    log('👆 Submitting form');
    submitBtn.click();
    notifyExtension('LOGIN_SUBMITTED', {});

    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Point d'entrée
  // ─────────────────────────────────────────────────────────────

  async function performAutoLogin(username, password) {
    log('🚀 Starting auto-login');
    log('📍 URL:', window.location.href);

    const pageType = detectPageType();
    log('📄 Page type:', pageType);

    try {
      switch (pageType) {
        case 'ANEF_LOGIN':
          await clickSeConnecter();
          break;

        case 'SSO_LOGIN':
          await fillSSOForm(username, password);
          break;

        case 'LOGGED_IN':
          log('✅ Already logged in');
          notifyExtension('LOGIN_SUCCESS', {});
          break;

        default:
          log('⚠️ Unknown page, attempting SSO');
          const hasForm = document.querySelector("input[name='username'], input[type='email']");
          if (hasForm) {
            await fillSSOForm(username, password);
          } else {
            notifyExtension('LOGIN_FAILED', { error: 'Page not recognized' });
          }
      }
    } catch (error) {
      log('❌ Error:', error.message);
      notifyExtension('LOGIN_FAILED', { error: error.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Écoute des messages de l'extension
  // ─────────────────────────────────────────────────────────────

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'ANEF_EXTENSION') return;

    if (event.data.type === 'DO_AUTO_LOGIN') {
      const { username, password } = event.data.credentials || {};
      if (username && password) {
        await performAutoLogin(username, password);
      } else {
        log('❌ Missing credentials');
        notifyExtension('LOGIN_FAILED', { error: 'Missing credentials' });
      }
    }
  });

  log('Auto-login script loaded');

})();
