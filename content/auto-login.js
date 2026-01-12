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
    log('📍 Page ANEF détectée');

    // Attendre que Angular charge
    await sleep(2000);

    const btn = await waitForElement('p-button.fullWidthButton button', 10000);

    if (!btn) {
      log('❌ Bouton "Se connecter" non trouvé');
      notifyExtension('NEED_CLICK_LOGIN', { error: 'Bouton non trouvé' });
      return false;
    }

    log('👆 Clic sur "Se connecter"');
    btn.click();
    notifyExtension('LOGIN_CLICKED', {});

    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Étape 2 : Page SSO - Remplir le formulaire
  // ─────────────────────────────────────────────────────────────

  async function fillSSOForm(username, password) {
    log('📍 Page SSO détectée');

    const usernameInput = await waitForElement(
      "input[name='username'], input[type='email'], input[id='username']",
      10000
    );

    if (!usernameInput) {
      log('❌ Champ identifiant non trouvé');
      notifyExtension('LOGIN_FAILED', { error: 'Champ identifiant non trouvé' });
      return false;
    }

    log('📝 Saisie identifiant');
    fillInput(usernameInput, username);
    await sleep(500);

    const passwordInput = document.querySelector(
      "input[name='password'], input[type='password']"
    );

    if (!passwordInput) {
      log('❌ Champ mot de passe non trouvé');
      notifyExtension('LOGIN_FAILED', { error: 'Champ mot de passe non trouvé' });
      return false;
    }

    log('📝 Saisie mot de passe');
    fillInput(passwordInput, password);
    await sleep(500);

    const submitBtn = document.querySelector(
      "button.fr-btn[type='submit'], button[type='submit'], input[type='submit']"
    );

    if (!submitBtn) {
      log('❌ Bouton de connexion non trouvé');
      notifyExtension('LOGIN_FAILED', { error: 'Bouton submit non trouvé' });
      return false;
    }

    log('👆 Soumission du formulaire');
    submitBtn.click();
    notifyExtension('LOGIN_SUBMITTED', {});

    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Point d'entrée
  // ─────────────────────────────────────────────────────────────

  async function performAutoLogin(username, password) {
    log('🚀 Démarrage connexion automatique');
    log('📍 URL:', window.location.href);

    const pageType = detectPageType();
    log('📄 Type de page:', pageType);

    try {
      switch (pageType) {
        case 'ANEF_LOGIN':
          await clickSeConnecter();
          break;

        case 'SSO_LOGIN':
          await fillSSOForm(username, password);
          break;

        case 'LOGGED_IN':
          log('✅ Déjà connecté');
          notifyExtension('LOGIN_SUCCESS', {});
          break;

        default:
          log('⚠️ Page inconnue, tentative SSO');
          const hasForm = document.querySelector("input[name='username'], input[type='email']");
          if (hasForm) {
            await fillSSOForm(username, password);
          } else {
            notifyExtension('LOGIN_FAILED', { error: 'Page non reconnue' });
          }
      }
    } catch (error) {
      log('❌ Erreur:', error.message);
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
        log('❌ Identifiants manquants');
        notifyExtension('LOGIN_FAILED', { error: 'Identifiants manquants' });
      }
    }
  });

  log('Script auto-login chargé');

})();
