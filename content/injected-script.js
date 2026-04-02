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
    const timestamp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' });
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
    const timestamp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' });
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

  log('Interception script loaded');

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
        log('forge.js not available');
        return encryptedData;
      }

      let privateKey = forge.pki.decryptRsaPrivateKey(PRIVATE_KEY.trim(), PASSPHRASE);
      if (!privateKey) {
        privateKey = forge.pki.privateKeyFromPem(PRIVATE_KEY.trim());
      }
      if (!privateKey) throw new Error('Invalid private key');

      const decoded = forge.util.decode64(encryptedData);
      const buffer = forge.util.createBuffer(decoded, 'raw');
      const decrypted = privateKey.decrypt(buffer.getBytes(), 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: forge.md.sha256.create()
      });

      // Le statut est avant le séparateur #K#
      return decrypted.split('#K#')[0] || decrypted;

    } catch (error) {
      log('Decryption error:', error.message);
      return encryptedData;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Chargement de forge.js (bibliothèque de cryptographie)
  // Chargé depuis le package de l'extension (requis par Manifest V3,
  // le code hébergé à distance est interdit par le Chrome Web Store).
  // L'URL locale est passée par content-script.js via data-forge-url.
  // ─────────────────────────────────────────────────────────────

  // Récupérer l'URL locale de forge.js passée par le content-script
  const FORGE_URL = (function() {
    const el = document.querySelector('script[data-forge-url]');
    return el ? el.dataset.forgeUrl : null;
  })();

  function loadForge() {
    return new Promise((resolve, reject) => {
      if (typeof forge !== 'undefined') {
        resolve();
        return;
      }

      if (!FORGE_URL) {
        reject(new Error('forge.js URL not available'));
        return;
      }

      const script = document.createElement('script');
      script.src = FORGE_URL;
      script.onload = () => {
        log('✅ forge.js loaded (local)');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load forge.js'));
      document.head.appendChild(script);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Mapping département français (code postal → nom)
  // ─────────────────────────────────────────────────────────────

  const DEPT_MAP = {
    '01':'Ain','02':'Aisne','03':'Allier','04':'Alpes-de-Haute-Provence','05':'Hautes-Alpes',
    '06':'Alpes-Maritimes','07':'Ardèche','08':'Ardennes','09':'Ariège','10':'Aube',
    '11':'Aude','12':'Aveyron','13':'Bouches-du-Rhône','14':'Calvados','15':'Cantal',
    '16':'Charente','17':'Charente-Maritime','18':'Cher','19':'Corrèze',
    '2A':'Corse-du-Sud','2B':'Haute-Corse',
    '21':"Côte-d'Or",'22':"Côtes-d'Armor",'23':'Creuse','24':'Dordogne','25':'Doubs',
    '26':'Drôme','27':'Eure','28':'Eure-et-Loir','29':'Finistère','30':'Gard',
    '31':'Haute-Garonne','32':'Gers','33':'Gironde','34':'Hérault','35':'Ille-et-Vilaine',
    '36':'Indre','37':'Indre-et-Loire','38':'Isère','39':'Jura','40':'Landes',
    '41':'Loir-et-Cher','42':'Loire','43':'Haute-Loire','44':'Loire-Atlantique','45':'Loiret',
    '46':'Lot','47':'Lot-et-Garonne','48':'Lozère','49':'Maine-et-Loire','50':'Manche',
    '51':'Marne','52':'Haute-Marne','53':'Mayenne','54':'Meurthe-et-Moselle','55':'Meuse',
    '56':'Morbihan','57':'Moselle','58':'Nièvre','59':'Nord','60':'Oise',
    '61':'Orne','62':'Pas-de-Calais','63':'Puy-de-Dôme','64':'Pyrénées-Atlantiques',
    '65':'Hautes-Pyrénées','66':'Pyrénées-Orientales','67':'Bas-Rhin','68':'Haut-Rhin',
    '69':'Rhône','70':'Haute-Saône','71':'Saône-et-Loire','72':'Sarthe','73':'Savoie',
    '74':'Haute-Savoie','75':'Paris','76':'Seine-Maritime','77':'Seine-et-Marne',
    '78':'Yvelines','79':'Deux-Sèvres','80':'Somme','81':'Tarn','82':'Tarn-et-Garonne',
    '83':'Var','84':'Vaucluse','85':'Vendée','86':'Vienne','87':'Haute-Vienne',
    '88':'Vosges','89':'Yonne','90':'Territoire de Belfort',
    '91':'Essonne','92':'Hauts-de-Seine','93':'Seine-Saint-Denis','94':'Val-de-Marne','95':"Val-d'Oise",
    '971':'Guadeloupe','972':'Martinique','973':'Guyane','974':'La Réunion','976':'Mayotte'
  };

  /** Extrait le nom du département à partir du code postal */
  function getDepartementFromCP(codePostal) {
    if (!codePostal) return null;
    const cp = String(codePostal).padStart(5, '0');
    // Outre-mer (97x)
    if (cp.startsWith('97')) return DEPT_MAP[cp.substring(0, 3)] || null;
    // Corse (20xxx)
    if (cp.startsWith('20')) return DEPT_MAP[parseInt(cp, 10) < 20200 ? '2A' : '2B'] || null;
    // Métropole
    return DEPT_MAP[cp.substring(0, 2)] || null;
  }

  // ─────────────────────────────────────────────────────────────
  // Récupération des données
  // ─────────────────────────────────────────────────────────────

  async function fetchDossierData() {
    try {
      const startTime = Date.now();
      log('📡 Calling dossier-stepper API...');

      const response = await fetch(API.DOSSIER_STEPPER);
      log('📡 API responded in ' + (Date.now() - startTime) + 'ms');
      if (!response.ok) {
        // HTTP 502/503 = maintenance probable
        if (response.status === 502 || response.status === 503) {
          log('🔧 API under maintenance (HTTP ' + response.status + ')');
          sendToExtension('MAINTENANCE', { inMaintenance: true });
          return null;
        }
        throw new Error(`Error ${response.status}`);
      }

      const data = await response.json();

      if (!data?.dossier?.statut) {
        log('No status in response');
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
      log('Error fetching dossier:', error.message);
      return null;
    }
  }

  /** Extrait le numéro de décret depuis la réponse API détails */
  function extractDecretId(details) {
    if (!details) return null;
    // Chemin : demande.informations.etat_civil.identites_decrets[].decret.id
    try {
      var idents = details?.demande?.informations?.etat_civil?.identites_decrets;
      if (Array.isArray(idents) && idents.length > 0) {
        for (var i = 0; i < idents.length; i++) {
          if (idents[i]?.decret?.id) {
            return String(idents[i].decret.id);
          }
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  async function fetchDossierDetails(dossierId) {
    try {
      log('📡 Calling dossier details API...');

      const response = await fetch(API.DOSSIER_DETAILS + dossierId);
      if (!response.ok) return;

      const raw = await response.json();
      const details = raw?.data ?? raw;

      // Log diagnostic : clés de la réponse + recherche champ décret
      if (details) {
        log('📋 API details keys: ' + Object.keys(details).join(', '));
        // Recherche récursive de tout champ contenant "decret"
        var decretFields = [];
        (function findDecret(obj, path) {
          if (!obj || typeof obj !== 'object') return;
          for (var k in obj) {
            if (k.toLowerCase().includes('decret') || k.toLowerCase().includes('decree')) {
              decretFields.push(path + '.' + k + '=' + JSON.stringify(obj[k]));
            }
            if (typeof obj[k] === 'object' && obj[k] !== null && path.split('.').length < 4) {
              findDecret(obj[k], path + '.' + k);
            }
          }
        })(details, 'details');
        if (decretFields.length) {
          log('📋 Decree fields found: ' + decretFields.join(' | '));
        }
      }

      // Extraire les dates importantes
      const dateDepot = details?.taxe_payee?.date_consommation
        || details?.date_creation
        || details?.date_depot;
      const dateEntretien = details?.entretien_assimilation?.date_rdv;

      // Préfecture : priorité entretien > code postal domicile
      const prefEntretien = details?.entretien_assimilation?.unite_gestion?.nom_plateforme
        || details?.entretien_assimilation?.unite_gestion?.libelle || null;
      const domicile = details?.demande?.domicile?.adresse;
      const codePostal = domicile?.code_postal || null;
      const prefDomicile = getDepartementFromCP(codePostal);
      const prefecture = prefEntretien || prefDomicile;

      sendToExtension('API_DATA', {
        id: dossierId,
        date_depot: dateDepot,
        entretien_date: dateEntretien,
        entretien_lieu: prefEntretien,
        prefecture: prefecture,
        domicile_code_postal: codePostal,
        domicile_ville: domicile?.ville || null,
        type_demande: 'naturalisation',
        complement_instruction: details?.demande_complement,
        numero_national: details?.numero_national,
        numero_decret: extractDecretId(details),
        raw_taxe_payee: details?.taxe_payee,
        raw_entretien: details?.entretien_assimilation
      });

    } catch (error) {
      log('Error fetching details:', error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Attente de l'onglet Nationalité
  // ─────────────────────────────────────────────────────────────

  async function waitForNationalityTab() {
    const MAX_WAIT = 30000;
    log('⏳ Looking for Nationality tab...');

    // Vérifier immédiatement
    const found = findNationalityTab();
    if (found) {
      log('✅ Nationality tab found immediately');
      return found;
    }

    // Utiliser MutationObserver (insensible au throttle des fenêtres minimisées)
    return new Promise((resolve) => {
      const startTime = Date.now();
      let maintenanceChecked = false;

      const observer = new MutationObserver(() => {
        // Page d'erreur ou login
        if (document.querySelector('.error-page') || window.location.href.includes('connexion')) {
          observer.disconnect();
          log('❌ Error or login page detected');
          resolve(null);
          return;
        }

        // Vérifier la maintenance périodiquement (après 3s d'attente)
        if (!maintenanceChecked && Date.now() - startTime > 3000) {
          maintenanceChecked = true;
          if (checkMaintenance()) {
            observer.disconnect();
            resolve(null);
            return;
          }
        }

        const tab = findNationalityTab();
        if (tab) {
          observer.disconnect();
          log('✅ Nationality tab found after ' + (Date.now() - startTime) + 'ms');
          resolve(tab);
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true, subtree: true
      });

      // Timeout de sécurité
      setTimeout(() => {
        observer.disconnect();
        const tab = findNationalityTab();
        if (tab) {
          resolve(tab);
        } else {
          const allTabs = document.querySelectorAll('a[role="tab"], li[role="presentation"] a, .p-tabview-nav a, .p-tabview-nav li, [role="tablist"] a, [role="tablist"] li');
          const allLinks = document.querySelectorAll('a');
          const tabTexts = Array.from(allTabs).map(el => '"' + (el.textContent || '').trim().substring(0, 40) + '"');
          log('❌ Timeout: tab not found after ' + MAX_WAIT / 1000 + 's. DOM tabs: ' + allTabs.length + ' [' + tabTexts.join(', ') + ']. Total links: ' + allLinks.length + '. Body length: ' + (document.body?.innerHTML?.length || 0));
          resolve(null);
        }
      }, MAX_WAIT);
    });
  }

  function findNationalityTab() {
    const tabs = document.querySelectorAll('a[role="tab"], li[role="presentation"] a, .p-tabview-nav a, .p-tabview-nav li, [role="tablist"] a, [role="tablist"] li');
    if (tabs.length > 0 && !findNationalityTab._logged) {
      findNationalityTab._logged = true;
      log('🔍 DOM tabs found: ' + tabs.length + ' — texts: ' + Array.from(tabs).map(el => '"' + (el.textContent || '').trim().substring(0, 40) + '"').join(', '));
    }
    return Array.from(tabs).find(
      el => el.textContent?.includes("Nationalité Française") ||
            el.textContent?.includes("Nationalité") ||
            el.textContent?.includes("nationalité") ||
            el.getAttribute('aria-label')?.includes("Nationalité")
    ) || null;
  }

  /** Attend que le contenu de l'onglet soit chargé (MutationObserver) */
  async function waitForTabContent() {
    const MAX_WAIT = 3000;
    log('⏳ Waiting for tab content to load...');

    // Vérifier immédiatement
    if (isTabContentLoaded()) {
      log('✅ Nationality tab content already loaded');
      return;
    }

    return new Promise((resolve) => {
      const startTime = Date.now();

      const observer = new MutationObserver(() => {
        if (isTabContentLoaded()) {
          observer.disconnect();
          log('✅ Tab content loaded after ' + (Date.now() - startTime) + 'ms');
          resolve();
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true, subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        log('⚠️ Timeout waiting for content (' + MAX_WAIT + 'ms), continuing');
        resolve();
      }, MAX_WAIT);
    });
  }

  function isTabContentLoaded() {
    const activeTab = document.querySelector(
      'a[role="tab"].p-tabview-nav-link-active, ' +
      '.p-tabview-nav-link.p-highlight, ' +
      'li.p-highlight a[role="tab"]'
    );
    const hasContent = document.querySelector(
      '.dossier-card, [class*="statut"], [class*="dossier"], ' +
      '.p-tabview-panel:not(.p-hidden), .p-card-body'
    );
    return !!(activeTab && hasContent);
  }

  // ─────────────────────────────────────────────────────────────
  // Détection de maintenance
  // ─────────────────────────────────────────────────────────────

  /**
   * Détecte si le site est en maintenance.
   * Vérifie plusieurs patterns car la page de maintenance peut varier
   * (texte h1, contenu body, classes CSS, titre de page, code HTTP).
   */
  function checkMaintenance() {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const titleText = (document.title || '').toLowerCase();

    const isMaintenance =
      // Texte dans les titres
      bodyText.includes('site en maintenance') ||
      bodyText.includes('service momentanément indisponible') ||
      bodyText.includes('service indisponible') ||
      bodyText.includes('temporairement indisponible') ||
      bodyText.includes('service unavailable') ||
      bodyText.includes('erreur 503') ||
      // Titre de la page
      titleText.includes('maintenance') ||
      titleText.includes('indisponible') ||
      titleText.includes('503') ||
      // Classes CSS de maintenance
      !!document.querySelector('.maintenance-page, .maintenance, [class*="maintenance"]') ||
      // Page d'erreur HTTP (souvent un <h1> avec le code)
      !!(document.querySelector('h1')?.textContent?.includes('503'));

    if (isMaintenance) {
      log('🔧 Site maintenance detected');
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
      log('⏳ Already running');
      return;
    }

    // Vérifier qu'on est sur une page appropriée (pas login)
    const currentUrl = window.location.href;
    if (currentUrl.includes('connexion-inscription')) {
      log('📍 Login page, waiting for navigation...');
      return;
    }

    isRunning = true;
    log('🚀 Starting...');

    if (checkMaintenance()) {
      sendToExtension('FETCH_COMPLETE', { success: false, reason: 'maintenance' });
      isRunning = false;
      return;
    }

    // Écouter les erreurs JWT Angular (session/mot de passe expiré)
    let jwtErrorDetected = false;
    const jwtErrorHandler = function(event) {
      if (event.message && event.message.includes('doesn\'t appear to be a JWT')) {
        jwtErrorDetected = true;
        log('🔑 JWT error detected — invalid session or expired password');
      }
    };
    window.addEventListener('error', jwtErrorHandler);

    try {
      await loadForge();
    } catch {
      log('forge.js not available, decryption disabled');
    }

    // Si l'erreur JWT est déjà arrivée (elle arrive très vite), sortir immédiatement
    if (jwtErrorDetected) {
      window.removeEventListener('error', jwtErrorHandler);
      log('❌ Invalid ANEF session (expired JWT) — password needs renewal');
      sendToExtension('FETCH_COMPLETE', { success: false, reason: 'expired_session' });
      sendToExtension('EXPIRED_SESSION', { reason: 'jwt_invalid' });
      isRunning = false;
      return;
    }

    const tab = await waitForNationalityTab();
    window.removeEventListener('error', jwtErrorHandler);

    // Vérifier si l'erreur JWT est arrivée pendant l'attente
    if (jwtErrorDetected) {
      log('❌ Invalid ANEF session (expired JWT) — password needs renewal');
      sendToExtension('FETCH_COMPLETE', { success: false, reason: 'expired_session' });
      sendToExtension('EXPIRED_SESSION', { reason: 'jwt_invalid' });
      isRunning = false;
      return;
    }

    if (!tab) {
      // Revérifier la maintenance (la page a pu finir de charger entre-temps)
      checkMaintenance();
      log('❌ Nationality tab not found after waiting');
      sendToExtension('FETCH_COMPLETE', { success: false, reason: 'no_nationality_tab' });
      isRunning = false;
      return;
    }

    if (!tab.classList.contains('active')) {
      log('👆 Activating Nationality tab');
      tab.click();
      // Petit délai pour laisser Angular réagir au clic
      await new Promise(r => setTimeout(r, 500));
    }

    log('📡 Starting data fetch...');
    const result = await fetchDossierData();
    if (result) {
      log('✅ Data retrieved');
      hasRun = true;
      sendToExtension('FETCH_COMPLETE', { success: true });
    } else {
      // Revérifier la maintenance en cas d'échec API
      checkMaintenance();
      sendToExtension('FETCH_COMPLETE', { success: false, reason: 'api_error' });
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
      log('📥 Data fetch request received');
      await main();
    }
  });

  // Démarrer dès qu'Angular est chargé (MutationObserver = insensible au throttle)
  function startWhenReady() {
    // Ne démarrer que si on est sur mon-compte
    if (!window.location.href.includes('mon-compte')) {
      log('📍 Not on mon-compte, waiting for navigation...');
      // Vérifier quand même la maintenance (le site peut avoir redirigé)
      setTimeout(() => {
        if (checkMaintenance()) {
          sendToExtension('FETCH_COMPLETE', { success: false, reason: 'maintenance' });
        }
      }, 3000);
      return;
    }

    // Vérifier immédiatement
    if (document.querySelector('app-root, [ng-version], .p-tabview, router-outlet')) {
      log('✅ Angular detected immediately');
      main();
      return;
    }

    // Observer les mutations DOM pour détecter Angular instantanément
    const startTime = Date.now();
    const MAX_WAIT = 10000;

    const observer = new MutationObserver(() => {
      if (document.querySelector('app-root, [ng-version], .p-tabview, router-outlet')) {
        observer.disconnect();
        log('✅ Angular detected (after ' + (Date.now() - startTime) + 'ms)');
        main();
      }
    });

    observer.observe(document.documentElement, {
      childList: true, subtree: true
    });

    // Vérifier la maintenance à mi-parcours (si Angular ne charge pas)
    setTimeout(() => {
      if (!isRunning && !hasRun && checkMaintenance()) {
        observer.disconnect();
        sendToExtension('FETCH_COMPLETE', { success: false, reason: 'maintenance' });
      }
    }, 5000);

    // Timeout de sécurité : démarrer même sans Angular après 10s
    setTimeout(() => {
      observer.disconnect();
      if (!isRunning && !hasRun) {
        log('⚠️ Angular detection timeout, forced start');
        main();
      }
    }, MAX_WAIT);
  }

  // Démarrer dès que le DOM est prêt
  if (document.body) {
    startWhenReady();
  } else {
    document.addEventListener('DOMContentLoaded', startWhenReady);
  }

})();
