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

  function log(msg, data) {
    console.log(data ? `${LOG_PREFIX} ${msg}` : `${LOG_PREFIX} ${msg}`, data || '');
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
      log('📡 Appel API dossier-stepper...');

      const response = await fetch(API.DOSSIER_STEPPER);
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
    const MAX_WAIT = 30000;
    const INTERVAL = 500;
    let waited = 0;

    while (waited < MAX_WAIT) {
      const tabs = document.querySelectorAll('a[role="tab"]');
      const nationalityTab = Array.from(tabs).find(
        el => el.textContent.includes("Nationalité Française")
      );

      if (nationalityTab) {
        log('✅ Onglet Nationalité trouvé');
        return nationalityTab;
      }

      await new Promise(r => setTimeout(r, INTERVAL));
      waited += INTERVAL;
    }

    return null;
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

  async function main() {
    log('🚀 Démarrage...');

    if (checkMaintenance()) return;

    try {
      await loadForge();
    } catch {
      log('forge.js non disponible, déchiffrement désactivé');
    }

    const tab = await waitForNationalityTab();

    if (tab && !tab.classList.contains('active')) {
      log('👆 Activation onglet Nationalité');
      tab.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    const result = await fetchDossierData();
    if (result) {
      log('✅ Données récupérées');
    }
  }

  // Démarrer après chargement de la page
  setTimeout(main, 2000);

})();
