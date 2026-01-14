/**
 * Script d'interception - Extension ANEF Status Tracker
 *
 * Ce script est injecté directement dans la page ANEF pour :
 * - Appeler les API internes d'ANEF
 * - Déchiffrer le statut (qui est chiffré côté serveur)
 * - Envoyer les données au content script
 */

(function() {
  'use strict';

  const LOG_PREFIX = '[ANEF-INJECT]';
  const SOURCE = 'InjectedScript';

  function log(msg, data) {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(data ? `${LOG_PREFIX} [${timestamp}] ${msg}` : `${LOG_PREFIX} [${timestamp}] ${msg}`, data || '');

    // Envoyer le log au content-script pour stockage centralisé
    sendToExtension('LOG', {
      level: 'INFO',
      source: SOURCE,
      message: msg,
      data: data
    });
  }

  function logError(msg, data) {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.error(`${LOG_PREFIX} [${timestamp}] ${msg}`, data || '');

    sendToExtension('LOG', {
      level: 'ERROR',
      source: SOURCE,
      message: msg,
      data: data
    });
  }

  function sendToExtension(type, data) {
    window.dispatchEvent(new CustomEvent('ANEF_EXTENSION_DATA', {
      detail: { type, data }
    }));
  }

  log('Script d\'interception chargé');

  // ─────────────────────────────────────────────────────────────
  // Configuration des API
  // ─────────────────────────────────────────────────────────────

  const API = {
    DOSSIER_STEPPER: 'https://administration-etrangers-en-france.interieur.gouv.fr/api/anf/dossier-stepper',
    DOSSIER_DETAILS: 'https://administration-etrangers-en-france.interieur.gouv.fr/api/anf/usager/dossiers/'
  };

  // ─────────────────────────────────────────────────────────────
  // Déchiffrement RSA du statut
  // ─────────────────────────────────────────────────────────────

  // Clé privée pour déchiffrer le statut (fournie par l'API ANEF)
  const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC/WvhR9YrO6DHY
0UpAoIlIuDoF3PtLEJ3J0T5FOLAPSY2sa33AnECl6jWfM7uLuojuTDbfIz6J3vAo
sNUzwYFNHKx3EG1o6cYzjWm2LzZDa4e25wYlXcL2r3T0mFGS9DT7adKlomNURj4L
f2WUt11oNH8RYyH/uNk+kIL0HRJLtfTjyyjlWSyjUUDD1ATYZwjnQS2HvdcqJ+Go
3TTvqTG7yOPzC/lwSKG3zE3eL+pi9E9Lgw9NlSanewOu7toB9NiKwzP3kfSBNpkz
Sv4UBNClfp1UG+psSPnTx3Csil9TbPjSe99ZZ0/ffPf0h2xoga/7rWgScQwHzN9E
crvEfDgxAgMBAAECggEAa08Ikm2wOffcfEph6XwdgLpPT5ptEdtvoQ3GbessUGZf
HKHrE2iMmH6PM4g/VEx3Hat/2gJZv9dVtnv0E+IgMK4zyVFdCciPbbmP3qr7MzPK
F7fWqn26J7ydSc1hcZehXpwplNlL+qaphKkcvhlWOGm4GHgPSOjQa1V/GoZzDCE1
e1z9KpVuMMiV4d89FFiE3MHtnrmMnmUdbnesffVftnPmzkkGKKWTCL1BLrdEXgCz
GSFdqCo+PjcJjEojjmqHhgzTyjPOR6JGh0FqG9ht3aduIQMZfKR1p2+Ds18NlOZu
T60Lyc7Ud/d0H0f2h9GfftHYCSLkIxfTaAmoYXzXAQKBgQDoWc91xlh8Kb3vmIN1
IoVY2yhviDTpUqkGxvjt6WYmu38CFpEwSO0cpTVCAkWRKvjKLUOoCAaqfaTrN04t
LG85Z18gvSQKmncfv0zrKaTN/FrnKOA//hPCAcveDT6Ir9SCxgVmNBox70k89eQ+
5cDOZACqFhKcoAQa/LjF621HBQKBgQDS1Pi+GhSwbn6nBiqQdzU1+RpXdburzubd
3dgNlrAOmLoFEGqYNzaMcKbNljNTnAdv/FX6/NYaQGx/pYTs26o/SZZ+SE7Cl2RS
RJIuWeskuNEoH4W06JgO1djyHVOiHmKbyaATWCjoZSQnnHo8OUBUKOJpw8mrNlQl
IYUE0OLcPQKBgQDD3LlKUZnTiKhoqYrfGeuIfK34Xrwjlx+O6/l5LA+FRPaKfxWC
u2bNh+J+M0YLWksAuulWYvWjkGiOMz++Sr+zhxUkluwj2BPk+jDP53nafgju5YEr
0HU9TKBbHZUCSh384wo4HmGaiFiXf7wY3ToLgTciKZsk1qq/SRxFEvE6NQKBgHcS
Cs2qgybFsMf55o4ilS2/Ww4sEurMdny1bvD1usbzoJN9mwYOoMMeWEZh3ukIhPbN
J24R34WB/wT0YSc4RGVr1Q/LHJgv0lvYGEsPQ4tAyfeEHgp3FnHCerz6rSIxUPW1
IK/sKWZewNWSPULH/rnJQV4EUmBc1ZcG4E5A/u7tAoGBAMneO96PMhJFQDhsakTL
vGTbhuwBnFjbSuxmyebhszASOuKm8XTVDe004AZTSy7lAm+iYTkfeRbfVrIGWElT
5DWhmlN/zNTdX56dQWG3P5M48+bxZFXz0YCBAZJw8jZ5LcFuKrr5tQbcNZN9Pqgk
QJNdXtE3G7SjkDOn36yZSaXp
-----END PRIVATE KEY-----`;
  const PASSPHRASE = 'wa_sir_3awtani_Dir_l_bou9_aaa_khay_div';

  function decryptStatus(encryptedData) {
    try {
      if (typeof forge === 'undefined') {
        log('forge.js non disponible');
        return encryptedData;
      }

      let privateKey = forge.pki.decryptRsaPrivateKey(PRIVATE_KEY.trim(), PASSPHRASE);
      if (!privateKey) {
        privateKey = forge.pki.privateKeyFromPem(PRIVATE_KEY.trim());
      }
      if (!privateKey) throw new Error('Clé privée invalide');

      const decoded = forge.util.decode64(encryptedData);
      const buffer = forge.util.createBuffer(decoded, 'raw');
      const decrypted = privateKey.decrypt(buffer.getBytes(), 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: forge.md.sha256.create()
      });

      // Le statut est avant le séparateur #K#
      return decrypted.split('#K#')[0] || decrypted;

    } catch (error) {
      log('Erreur déchiffrement:', error.message);
      return encryptedData;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Chargement de forge.js (bibliothèque de cryptographie)
  // ─────────────────────────────────────────────────────────────

  function loadForge() {
    return new Promise((resolve, reject) => {
      if (typeof forge !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js';
      script.onload = () => {
        log('✅ forge.js chargé');
        resolve();
      };
      script.onerror = () => reject(new Error('Échec chargement forge.js'));
      document.head.appendChild(script);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Récupération des données
  // ─────────────────────────────────────────────────────────────

  async function fetchDossierData() {
    try {
      const startTime = Date.now();
      log('📡 Appel API dossier-stepper...');

      const response = await fetch(API.DOSSIER_STEPPER);
      log('📡 API répondu en ' + (Date.now() - startTime) + 'ms');
      if (!response.ok) throw new Error(`Erreur ${response.status}`);

      const data = await response.json();

      if (!data?.dossier?.statut) {
        log('Pas de statut dans la réponse');
        return null;
      }

      // Déchiffrer le statut
      const decryptedStatus = decryptStatus(data.dossier.statut);
      log('🔓 Statut:', decryptedStatus);

      // Envoyer les données principales
      sendToExtension('DOSSIER_DATA', {
        statut: decryptedStatus,
        statut_encrypted: data.dossier.statut,
        date_statut: data.dossier.date_statut,
        id: data.dossier.id,
        dossier: data.dossier
      });

      // Récupérer les détails supplémentaires
      if (data.dossier.id) {
        await fetchDossierDetails(data.dossier.id);
      }

      return { statut: decryptedStatus, date_statut: data.dossier.date_statut };

    } catch (error) {
      log('Erreur récupération dossier:', error.message);
      return null;
    }
  }

  async function fetchDossierDetails(dossierId) {
    try {
      log('📡 Appel API détails dossier...');

      const response = await fetch(API.DOSSIER_DETAILS + dossierId);
      if (!response.ok) return;

      const raw = await response.json();
      const details = raw?.data ?? raw;

      // Extraire les dates importantes
      const dateDepot = details?.taxe_payee?.date_consommation
        || details?.date_creation
        || details?.date_depot;
      const dateEntretien = details?.entretien_assimilation?.date_rdv;

      sendToExtension('API_DATA', {
        id: dossierId,
        date_depot: dateDepot,
        entretien_date: dateEntretien,
        entretien_lieu: details?.entretien_assimilation?.unite_gestion?.nom_plateforme,
        prefecture: details?.prefecture?.libelle,
        type_demande: details?.type_demande?.libelle,
        complement_instruction: details?.demande_complement,
        numero_national: details?.numero_national,
        numero_decret: details?.numero_decret,
        raw_taxe_payee: details?.taxe_payee,
        raw_entretien: details?.entretien_assimilation
      });

    } catch (error) {
      log('Erreur récupération détails:', error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Attente de l'onglet Nationalité
  // ─────────────────────────────────────────────────────────────

  async function waitForNationalityTab() {
    const MAX_WAIT = 15000;  // 15 secondes max
    const INTERVAL = 150;    // Vérification très fréquente (150ms)
    let waited = 0;

    log('⏳ Recherche onglet Nationalité...');

    while (waited < MAX_WAIT) {
      // Chercher l'onglet avec plusieurs variantes
      const tabs = document.querySelectorAll('a[role="tab"], li[role="presentation"] a, .p-tabview-nav a');
      const nationalityTab = Array.from(tabs).find(
        el => el.textContent?.includes("Nationalité Française") ||
              el.textContent?.includes("Nationalité") ||
              el.getAttribute('aria-label')?.includes("Nationalité")
      );

      if (nationalityTab) {
        log('✅ Onglet Nationalité trouvé après ' + waited + 'ms');
        return nationalityTab;
      }

      // Vérifier si on est sur une page d'erreur ou de login
      if (document.querySelector('.error-page') ||
          window.location.href.includes('connexion')) {
        log('❌ Page d\'erreur ou de connexion détectée');
        return null;
      }

      await new Promise(r => setTimeout(r, INTERVAL));
      waited += INTERVAL;

      // Log de progression toutes les 5 secondes
      if (waited % 5000 === 0) {
        log('⏳ Toujours en attente... (' + waited / 1000 + 's)');
      }
    }

    log('❌ Timeout: onglet non trouvé après ' + MAX_WAIT / 1000 + 's');
    return null;
  }

  /** Attend que le contenu de l'onglet soit chargé */
  async function waitForTabContent() {
    const MAX_WAIT = 3000;   // 3 secondes max
    const INTERVAL = 100;    // Vérification très fréquente
    let waited = 0;

    log('⏳ Attente chargement contenu onglet...');

    while (waited < MAX_WAIT) {
      // Vérifier si l'onglet Nationalité est actif ET si du contenu spécifique est présent
      const activeNationalityTab = document.querySelector(
        'a[role="tab"].p-tabview-nav-link-active, ' +
        '.p-tabview-nav-link.p-highlight, ' +
        'li.p-highlight a[role="tab"]'
      );

      // Contenu spécifique à l'onglet nationalité
      const hasNationalityContent = document.querySelector(
        '.dossier-card, [class*="statut"], [class*="dossier"], ' +
        '.p-tabview-panel:not(.p-hidden), .p-card-body'
      );

      if (activeNationalityTab && hasNationalityContent) {
        log('✅ Contenu onglet Nationalité chargé après ' + waited + 'ms');
        return;
      }

      await new Promise(r => setTimeout(r, INTERVAL));
      waited += INTERVAL;
    }

    log('⚠️ Timeout attente contenu (' + MAX_WAIT + 'ms), on continue quand même');
  }

  // ─────────────────────────────────────────────────────────────
  // Détection de maintenance
  // ─────────────────────────────────────────────────────────────

  function checkMaintenance() {
    const h1 = document.querySelector('h1');
    if (h1?.textContent.trim() === 'Site en maintenance') {
      log('🔧 Site en maintenance');
      sendToExtension('MAINTENANCE', { inMaintenance: true });
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // Point d'entrée
  // ─────────────────────────────────────────────────────────────

  let isRunning = false;
  let hasRun = false;

  async function main() {
    // Éviter les exécutions simultanées
    if (isRunning) {
      log('⏳ Déjà en cours d\'exécution');
      return;
    }

    // Vérifier qu'on est sur une page appropriée (pas login)
    const currentUrl = window.location.href;
    if (currentUrl.includes('connexion-inscription')) {
      log('📍 Page de connexion, attente navigation...');
      return;
    }

    isRunning = true;
    log('🚀 Démarrage...');

    if (checkMaintenance()) {
      isRunning = false;
      return;
    }

    try {
      await loadForge();
    } catch {
      log('forge.js non disponible, déchiffrement désactivé');
    }

    const tab = await waitForNationalityTab();

    if (!tab) {
      log('❌ Onglet Nationalité non trouvé après attente');
      isRunning = false;
      return;
    }

    if (!tab.classList.contains('active')) {
      log('👆 Activation onglet Nationalité');
      tab.click();
      // Petit délai pour laisser Angular réagir au clic
      await new Promise(r => setTimeout(r, 500));
    }

    log('📡 Lancement récupération données...');
    const result = await fetchDossierData();
    if (result) {
      log('✅ Données récupérées');
      hasRun = true;
    }

    isRunning = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Écoute des messages pour relancer la récupération
  // ─────────────────────────────────────────────────────────────

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'ANEF_EXTENSION') return;

    if (event.data.type === 'TRIGGER_DATA_FETCH') {
      log('📥 Demande de récupération des données reçue');
      await main();
    }
  });

  // Démarrer dès que possible - on attend juste que le DOM soit stable
  let startAttempts = 0;
  const MAX_START_ATTEMPTS = 20; // 10 secondes max (20 * 500ms)

  function startWhenReady() {
    startAttempts++;

    // Ne démarrer que si on est sur mon-compte
    if (!window.location.href.includes('mon-compte')) {
      if (startAttempts < MAX_START_ATTEMPTS) {
        // Continuer à vérifier au cas où on navigue vers mon-compte
        setTimeout(startWhenReady, 500);
      }
      return;
    }

    // Vérifier si Angular a chargé (présence d'éléments spécifiques)
    const hasAngularContent = document.querySelector('app-root, [ng-version], .p-tabview, router-outlet');

    if (hasAngularContent) {
      log('✅ Angular détecté, démarrage (après ' + (startAttempts * 500) + 'ms)');
      main();
    } else if (startAttempts < MAX_START_ATTEMPTS) {
      // Réessayer dans 500ms
      setTimeout(startWhenReady, 500);
    } else {
      log('⚠️ Timeout détection Angular, démarrage forcé');
      main();
    }
  }

  // Premier essai après 300ms (laisser le temps au DOM de se construire)
  setTimeout(startWhenReady, 300);

})();
