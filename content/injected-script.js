/**
 * Script d'interception - Extension ANEF Status Tracker
 *
 * Injecté dans la page ANEF pour récupérer l'état du dossier de naturalisation.
 *
 * ⚠️ Changement d'API (juillet 2026) — voir lib/anef-mapper.js :
 *   Le statut n'est PLUS chiffré (RSA/forge abandonnés). L'API expose désormais
 *   trois signaux séparés qu'on récupère par appel direct (cookies de session) :
 *     • /api/anf/dossier-stepper            → statut « MACRO|drapeaux » (texte clair)
 *     • /api/anf/usager/dossiers/frise-stepper → étape granulaire (id_active)
 *     • /api/notifications                  → historique d'événements horodaté
 *     • /api/anf/usager/dossiers/{id}       → détails (dates, entretien, décret)
 *   La recombinaison (statut → code interne, timeline) est faite côté service
 *   worker via lib/anef-mapper.js. Ce script se contente de collecter le brut.
 */

(function() {
  'use strict';

  const LOG_PREFIX = '[ANEF-INJECT]';
  const SOURCE = 'InjectedScript';

  function ts() {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' });
  }

  function log(msg, data) {
    console.log(`${LOG_PREFIX} [${ts()}] ${msg}`, data || '');
    sendToExtension('LOG', { level: 'INFO', source: SOURCE, message: msg, data });
  }

  function logError(msg, data) {
    console.error(`${LOG_PREFIX} [${ts()}] ${msg}`, data || '');
    sendToExtension('LOG', { level: 'ERROR', source: SOURCE, message: msg, data });
  }

  function sendToExtension(type, data) {
    window.dispatchEvent(new CustomEvent('ANEF_EXTENSION_DATA', { detail: { type, data } }));
  }

  log('Script d\'interception chargé');

  // ─────────────────────────────────────────────────────────────
  // Configuration des API
  // ─────────────────────────────────────────────────────────────

  const ROOT = 'https://administration-etrangers-en-france.interieur.gouv.fr/api';
  const API = {
    STEPPER: ROOT + '/anf/dossier-stepper',
    FRISE: ROOT + '/anf/usager/dossiers/frise-stepper',
    NOTIFICATIONS: ROOT + '/notifications',
    DETAILS: ROOT + '/anf/usager/dossiers/'
  };

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
    if (cp.startsWith('97')) return DEPT_MAP[cp.substring(0, 3)] || null;
    if (cp.startsWith('20')) return DEPT_MAP[parseInt(cp, 10) < 20200 ? '2A' : '2B'] || null;
    return DEPT_MAP[cp.substring(0, 2)] || null;
  }

  /** Extrait le numéro de décret depuis la réponse API détails */
  function extractDecretId(details) {
    try {
      const idents = details?.demande?.informations?.etat_civil?.identites_decrets;
      if (Array.isArray(idents)) {
        for (const it of idents) {
          if (it?.decret?.id) return String(it.decret.id);
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Récupération des données (appels API directs, cookies de session)
  // ─────────────────────────────────────────────────────────────

  /** GET JSON avec cookies. Renvoie { ok, status, ct, json }. */
  async function getJson(url) {
    const r = await fetch(url, { credentials: 'include' });
    const ct = r.headers.get('content-type') || '';
    let json = null;
    if (r.ok && ct.includes('json')) {
      try { json = await r.json(); } catch { /* non-JSON */ }
    }
    return { ok: r.ok, status: r.status, ct, json };
  }

  async function fetchFrise() {
    try {
      const res = await getJson(API.FRISE);
      if (res.json) {
        const f = res.json.data ?? res.json;
        return { id_active: f?.id_active, type_frise: f?.type_frise, has_step_scec: f?.has_step_scec };
      }
    } catch (e) { log('Frise indisponible: ' + e.message); }
    return null;
  }

  async function fetchNotifications() {
    try {
      const res = await getJson(API.NOTIFICATIONS);
      if (res.json) {
        const items = res.json._items || res.json.items || res.json.data || [];
        // On ne transmet que les champs utiles (pas de contenu texte perso)
        return items.map(n => ({
          type_notification: n.type_notification,
          motif_notification: n.motif_notification,
          id_demande: n.id_demande,
          _created: n._created || n.date_creation || n.date,
          lu: n.lu
        }));
      }
    } catch (e) { log('Notifications indisponibles: ' + e.message); }
    return [];
  }

  async function fetchDossierData() {
    const startTime = Date.now();
    log('📡 Appel API dossier-stepper...');

    let stepper;
    try {
      stepper = await getJson(API.STEPPER);
    } catch (e) {
      log('Erreur réseau stepper: ' + e.message);
      return false;
    }
    log('📡 stepper répondu en ' + (Date.now() - startTime) + 'ms (HTTP ' + stepper.status + ')');

    // Maintenance probable
    if (stepper.status === 502 || stepper.status === 503) {
      log('🔧 API en maintenance (HTTP ' + stepper.status + ')');
      sendToExtension('MAINTENANCE', { inMaintenance: true });
      return false;
    }
    // Session invalide / mot de passe expiré (401/403 ou page de login HTML)
    if (stepper.status === 401 || stepper.status === 403 || (stepper.ok && !stepper.json)) {
      log('🔑 Session ANEF invalide (HTTP ' + stepper.status + ')');
      sendToExtension('EXPIRED_SESSION', { reason: 'jwt_invalid' });
      return false;
    }
    if (!stepper.json?.dossier?.statut) {
      log('Pas de statut dans la réponse stepper');
      return false;
    }

    const dossier = stepper.json.dossier;
    const statutRaw = dossier.statut;               // « MACRO|drapeaux » texte clair
    log('🔓 Statut brut: ' + String(statutRaw).slice(0, 80));

    // Signaux complémentaires en parallèle (best effort)
    const [frise, notifications] = await Promise.all([fetchFrise(), fetchNotifications()]);
    if (frise) log('🧭 Frise: id_active=' + frise.id_active + ' type=' + frise.type_frise);

    // On récupère le détail AVANT d'émettre DOSSIER_DATA pour y joindre le n° de
    // décret et current_step : un décret assigné (identites_decrets[].decret.id)
    // est un signal d'étape plus fiable que la frise (qui reste en retrait quand
    // le dossier est déjà inséré au décret).
    let detail = null;
    if (dossier.id) {
      try {
        const res = await getJson(API.DETAILS + dossier.id);
        detail = res.json ? (res.json.data ?? res.json) : null;
      } catch (e) { log('Détail indisponible: ' + e.message); }
    }
    const numeroDecret = detail ? extractDecretId(detail) : null;
    const currentStep = detail?.current_step ?? null;
    if (numeroDecret) log('📜 Décret assigné: ' + numeroDecret);

    // Envoi du statut principal (le service worker recombine via anef-mapper)
    sendToExtension('DOSSIER_DATA', {
      statut_raw: statutRaw,
      frise,
      notifications,
      numero_decret: numeroDecret,
      current_step: currentStep,
      date_statut: dossier.date_statut,
      id: dossier.id,
      dossier
    });

    // Détails enrichis (à partir du détail déjà récupéré)
    if (detail) {
      sendApiData(dossier.id, detail, statutRaw, frise, notifications);
    }
    return true;
  }

  function sendApiData(dossierId, d, statutRaw, frise, notifications) {
    try {
      const ea = d?.entretien_assimilation || null;
      const dateDepot = d?.taxe_payee?.date_consommation || d?.date_creation || d?._created || d?.date_depot;
      const prefEntretien = ea?.unite_gestion?.nom_plateforme || ea?.unite_gestion?.libelle || null;
      const domicile = d?.demande?.domicile?.adresse;
      const codePostal = domicile?.code_postal || null;
      const prefecture = prefEntretien || getDepartementFromCP(codePostal);

      sendToExtension('API_DATA', {
        id: dossierId,
        date_depot: dateDepot,
        entretien_date: ea?.date_rdv,
        entretien_lieu: prefEntretien,
        entretien_adresse: ea?.adresse_rdv || null,                       // NOUVEAU
        entretien_info: ea?.information_complementaire_rdv || null,        // NOUVEAU
        prefecture,
        domicile_code_postal: codePostal,
        domicile_ville: domicile?.ville || null,
        type_demande: 'naturalisation',
        complement_instruction: d?.demande_complement,
        numero_national: d?.numero_national,
        numero_decret: extractDecretId(d),
        current_step: d?.current_step,                                     // NOUVEAU (indicatif)
        // Signaux bruts pour recombinaison mapper côté service worker
        statut_raw: statutRaw,
        frise,
        notifications,
        raw_taxe_payee: d?.taxe_payee,
        raw_entretien: ea
      });
    } catch (error) {
      log('Erreur envoi détails: ' + error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Détection de maintenance (repli DOM, quand l'API ne répond pas)
  // ─────────────────────────────────────────────────────────────

  function checkMaintenance() {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const titleText = (document.title || '').toLowerCase();
    const isMaintenance =
      bodyText.includes('site en maintenance') ||
      bodyText.includes('service momentanément indisponible') ||
      bodyText.includes('service indisponible') ||
      bodyText.includes('temporairement indisponible') ||
      bodyText.includes('service unavailable') ||
      bodyText.includes('erreur 503') ||
      titleText.includes('maintenance') ||
      titleText.includes('indisponible') ||
      titleText.includes('503') ||
      !!document.querySelector('.maintenance-page, .maintenance, [class*="maintenance"]') ||
      !!(document.querySelector('h1')?.textContent?.includes('503'));
    if (isMaintenance) {
      log('🔧 Site en maintenance détecté (DOM)');
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
    if (isRunning) { log('⏳ Déjà en cours'); return; }

    const currentUrl = window.location.href;
    if (currentUrl.includes('connexion-inscription')) {
      log('📍 Page de connexion, attente navigation...');
      return;
    }

    isRunning = true;
    log('🚀 Démarrage...');

    try {
      const ok = await fetchDossierData();
      if (ok) {
        log('✅ Données récupérées');
        hasRun = true;
        sendToExtension('FETCH_COMPLETE', { success: true });
      } else {
        // L'échec a déjà émis MAINTENANCE / EXPIRED_SESSION le cas échéant.
        checkMaintenance();
        sendToExtension('FETCH_COMPLETE', { success: false, reason: 'api_error' });
      }
    } catch (e) {
      logError('Erreur main: ' + e.message);
      sendToExtension('FETCH_COMPLETE', { success: false, reason: 'api_error' });
    } finally {
      isRunning = false;
    }
  }

  // Relance à la demande (après auto-login, navigation, refresh manuel)
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'ANEF_EXTENSION') return;
    if (event.data.type === 'TRIGGER_DATA_FETCH') {
      log('📥 Demande de récupération reçue');
      await main();
    }
  });

  // Démarrage automatique sur mon-compte (les appels API ne dépendent plus
  // du DOM Angular : dès que les cookies de session existent, le fetch marche).
  function startWhenReady() {
    if (!window.location.href.includes('mon-compte')) {
      log('📍 Pas sur mon-compte, attente d\'un déclencheur...');
      setTimeout(() => {
        if (!isRunning && !hasRun) checkMaintenance();
      }, 3000);
      return;
    }
    main();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWhenReady);
  } else {
    startWhenReady();
  }

})();
