/**
 * Popup - Extension ANEF Status Tracker
 *
 * Interface utilisateur principale affichant :
 * - Le statut actuel de la demande
 * - Les statistiques temporelles
 * - Les détails du dossier
 */

import { getStatusExplanation, formatDuration, formatDate, formatDateShort, formatTimestamp, daysSince, daysBetween, isPositiveStatus, isNegativeStatus, isClosedStatus, formatSubStep, resolveEntretienDate, STEP_DEFAULTS } from '../lib/status-parser.js';
import { downloadLogs } from '../lib/logger.js';
import { getDmrStatut, formatDmrEtape, isDmrLinkValid, dmrEventNeedsAction, DMR_EVENT_MOTIFS, DMR_MOTIFS_AJOUT, DMR_JUSTIFICATIFS } from '../lib/dmr.js';
// ─────────────────────────────────────────────────────────────
// Citations sur la patience
// ─────────────────────────────────────────────────────────────

const QUOTES = [
  { text: "La patience est la clé du bien-être.", author: "Mohammed ﷺ" },
  { text: "Tout vient à point à qui sait attendre.", author: "Proverbe français" },
  { text: "La patience est amère, mais son fruit est doux.", author: "Jean-Jacques Rousseau" },
  { text: "Adoptez le rythme de la nature : son secret est la patience.", author: "Ralph Waldo Emerson" },
  { text: "La patience est l'art d'espérer.", author: "Luc de Clapiers" },
  { text: "Ce qui est différé n'est pas perdu.", author: "Proverbe italien" },
  { text: "Les grandes œuvres naissent de la patience.", author: "Gustave Flaubert" },
  { text: "La patience et le temps font plus que force ni que rage.", author: "Jean de La Fontaine" },
  { text: "Qui va lentement va sûrement.", author: "Proverbe latin" },
  { text: "La persévérance vient à bout de tout.", author: "Proverbe français" },
  { text: "Un voyage de mille lieues commence par un premier pas.", author: "Lao Tseu" },
  { text: "L'attente est déjà la moitié du bonheur.", author: "Proverbe chinois" },

  // Formats courts : tiennent sur une ligne à 380 px, donc aucun saut de
  // hauteur quand le carrousel enchaîne.
  { text: "Patience passe science.", author: "Proverbe français" },
  { text: "Chaque chose en son temps.", author: "Proverbe français" },
  { text: "Pas à pas, on va bien loin.", author: "Proverbe français" },
  { text: "Après la pluie, le beau temps.", author: "Proverbe français" },
  { text: "Petit à petit, l'oiseau fait son nid.", author: "Proverbe français" },
  { text: "La patience adoucit tous les maux.", author: "Proverbe français" },
  { text: "L'arbre ne tombe pas du premier coup.", author: "Proverbe français" },
  { text: "Le temps est un grand maître.", author: "Corneille" },
  { text: "Goutte à goutte, l'eau creuse la pierre.", author: "Ovide" },
  { text: "Rien ne sert de courir, il faut partir à point.", author: "Jean de La Fontaine" },
  { text: "Qui veut voyager loin ménage sa monture.", author: "Racine" },
  { text: "Avec le temps, l'herbe devient lait.", author: "Proverbe chinois" }
];

let quoteInterval = null;
let quoteFadeTimeout = null;
let currentQuoteIndex = 0;

function startQuoteCarousel() {
  stopQuoteCarousel();
  currentQuoteIndex = Math.floor(Math.random() * QUOTES.length);
  showQuote(currentQuoteIndex);

  quoteInterval = setInterval(() => {
    const textEl = document.getElementById('quote-text');
    const authorEl = document.getElementById('quote-author');

    if (textEl && authorEl) {
      textEl.classList.add('fade-out');
      authorEl.classList.add('fade-out');

      quoteFadeTimeout = setTimeout(() => {
        quoteFadeTimeout = null;
        currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES.length;
        showQuote(currentQuoteIndex);
      }, 400);
    }
  }, 5000);
}

function showQuote(index) {
  const quote = QUOTES[index];
  const textEl = document.getElementById('quote-text');
  const authorEl = document.getElementById('quote-author');

  if (textEl && authorEl && quote) {
    textEl.classList.remove('fade-out');
    authorEl.classList.remove('fade-out');

    // Force reflow pour relancer l'animation
    void textEl.offsetWidth;

    textEl.textContent = `« ${quote.text} »`;
    authorEl.textContent = `— ${quote.author}`;

    // Réappliquer l'animation
    textEl.style.animation = 'none';
    authorEl.style.animation = 'none';
    void textEl.offsetWidth;
    textEl.style.animation = '';
    authorEl.style.animation = '';
  }
}

function stopQuoteCarousel() {
  if (quoteInterval) {
    clearInterval(quoteInterval);
    quoteInterval = null;
  }
  // Le fondu arme un setTimeout de 400 ms : sans ça, une actualisation qui
  // aboutit pendant la transition écrivait encore une citation après l'arrêt.
  if (quoteFadeTimeout) {
    clearTimeout(quoteFadeTimeout);
    quoteFadeTimeout = null;
  }
}

// ─────────────────────────────────────────────────────────────
// Éléments DOM
// ─────────────────────────────────────────────────────────────

let views = {};
let elements = {};

function initializeElements() {
  views = {
    maintenance: document.getElementById('view-maintenance'),
    passwordExpired: document.getElementById('view-password-expired'),
    notConnected: document.getElementById('view-not-connected'),
    noData: document.getElementById('view-no-data'),
    loading: document.getElementById('view-loading'),
    status: document.getElementById('view-status')
  };

  elements = {
    // Boutons
    btnRetry: document.getElementById('btn-retry'),
    btnLogin: document.getElementById('btn-login'),
    btnCheck: document.getElementById('btn-check'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnShare: document.getElementById('btn-share'),
    btnSettings: document.getElementById('btn-settings'),
    btnPrivacy: document.getElementById('btn-privacy'),

    // Affichage statut
    statusIcon: document.getElementById('status-icon'),
    statusPhase: document.getElementById('status-phase'),
    statusStep: document.getElementById('status-step'),
    statusCode: document.getElementById('status-code'),
    statusDescription: document.getElementById('status-description'),
    statusDate: document.getElementById('status-date'),
    stepMeter: document.getElementById('step-meter'),
    stateHeroValue: document.getElementById('state-hero-value'),
    stateHeroLabel: document.getElementById('state-hero-label'),
    btnDescMore: document.getElementById('btn-desc-more'),

    // Bannière de clôture (procédure terminée)
    closureBanner: document.getElementById('closure-banner'),
    closureTotalValue: document.getElementById('closure-total-value'),
    closureDecretFigure: document.getElementById('closure-decret-figure'),
    closureDecretNum: document.getElementById('closure-decret-num'),
    closureDepotDate: document.getElementById('closure-depot-date'),

    // Statistiques temporelles
    statsSection: document.getElementById('stats-section'),
    statDepot: document.getElementById('stat-depot'),
    statDepotValue: document.getElementById('stat-depot-value'),
    statDepotDate: document.getElementById('stat-depot-date'),
    statEntretien: document.getElementById('stat-entretien'),
    statEntretienValue: document.getElementById('stat-entretien-value'),
    statEntretienDate: document.getElementById('stat-entretien-date'),

    // Dernière vérification
    lastCheckDate: document.getElementById('last-check-date'),

    // Détails du dossier
    detailsSection: document.getElementById('details-section'),
    detailDossierId: document.getElementById('detail-dossier-id'),
    detailDossierIdValue: document.getElementById('detail-dossier-id-value'),
    detailNumeroNational: document.getElementById('detail-numero-national'),
    detailNumeroNationalValue: document.getElementById('detail-numero-national-value'),
    detailPrefecture: document.getElementById('detail-prefecture'),
    detailPrefectureValue: document.getElementById('detail-prefecture-value'),
    detailTypeDemande: document.getElementById('detail-type-demande'),
    detailTypeDemandeValue: document.getElementById('detail-type-demande-value'),
    detailEntretienLieu: document.getElementById('detail-entretien-lieu'),
    detailEntretienLieuValue: document.getElementById('detail-entretien-lieu-value'),
    detailDecret: document.getElementById('detail-decret'),
    detailDecretValue: document.getElementById('detail-decret-value'),
    statusBadges: document.getElementById('status-badges')
  };
}

// ─────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();

  // Afficher la version
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('version');
  if (versionEl && manifest.version) {
    versionEl.textContent = `v${manifest.version}`;
  }

  attachEventListeners();
  // Posée avant tout le reste : la question du consentement ne doit dépendre
  // d'aucun chargement de données qui pourrait échouer.
  await initStatsConsent();
  await renderDossierTabs(); // barre d'onglets multi-dossier
  await loadData();
  await checkDossierSwitchNotice();
});

// ─────────────────────────────────────────────────────────────
// Consentement aux statistiques communautaires (opt-in)
// ─────────────────────────────────────────────────────────────
// La bannière n'apparaît que tant que la question n'a pas été tranchée. Elle
// n'empêche aucun usage de l'extension : refuser n'enlève aucune fonction, ce
// qui est la condition pour qu'un consentement soit libre (RGPD art. 7-4).

async function initStatsConsent() {
  const banner = document.getElementById('stats-consent-banner');
  if (!banner) return;

  let state = null;
  try {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATS_CONSENT' });
  } catch (e) {
    console.warn('[Popup] État du consentement indisponible:', e);
  }

  // En cas d'erreur on n'affiche rien : mieux vaut ne pas poser la question
  // qu'enregistrer une réponse sur un état inconnu (le service worker, lui,
  // reste muet tant qu'aucun consentement n'est enregistré).
  if (!state?.needsConsent) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');

  const accept = document.getElementById('btn-stats-consent-accept');
  const decline = document.getElementById('btn-stats-consent-decline');
  if (accept && !accept.dataset.bound) {
    accept.dataset.bound = '1';
    accept.addEventListener('click', () => submitStatsConsent(true));
  }
  if (decline && !decline.dataset.bound) {
    decline.dataset.bound = '1';
    decline.addEventListener('click', () => submitStatsConsent(false));
  }
}

/** Enregistre la réponse de l'utilisateur et referme la bannière. */
async function submitStatsConsent(granted) {
  const banner = document.getElementById('stats-consent-banner');
  const buttons = banner ? banner.querySelectorAll('button') : [];
  buttons.forEach(b => { b.disabled = true; });

  try {
    const res = await chrome.runtime.sendMessage({ type: 'SET_STATS_CONSENT', granted });
    if (!res?.success) throw new Error(res?.error || 'réponse invalide');
    banner?.classList.add('hidden');
  } catch (e) {
    console.warn('[Popup] Enregistrement du consentement échoué:', e);
    buttons.forEach(b => { b.disabled = false; });
  }
}

// ─────────────────────────────────────────────────────────────
// Multi-dossier — barre d'onglets
// ─────────────────────────────────────────────────────────────

let _activeViewDossierId = null; // null = primaire

async function renderDossierTabs() {
  const tabs = document.getElementById('dossier-tabs');
  const scroll = document.getElementById('dossier-tabs-scroll');
  if (!tabs || !scroll) return;

  try {
    const { dossiers = {}, primaryDossierId } = await chrome.storage.local.get(['dossiers', 'primaryDossierId']);
    const ids = Object.keys(dossiers);

    // Moins de 2 dossiers → pas d'onglets (UI simple)
    if (ids.length < 2) {
      tabs.classList.add('hidden');
      _activeViewDossierId = null;
      return;
    }

    tabs.classList.remove('hidden');

    // Si aucun onglet actif, on active le primaire
    if (!_activeViewDossierId || !dossiers[_activeViewDossierId]) {
      _activeViewDossierId = primaryDossierId || ids[0];
    }

    // Trier : primaire en premier, puis par lastSeen desc
    const sorted = ids.slice().sort((a, b) => {
      if (a === primaryDossierId) return -1;
      if (b === primaryDossierId) return 1;
      return (dossiers[b].lastSeen || '').localeCompare(dossiers[a].lastSeen || '');
    });

    scroll.innerHTML = sorted.map(id => {
      const d = dossiers[id];
      const isPrimary = id === primaryDossierId;
      const isActive = id === _activeViewDossierId;
      const etape = d.lastStatus?.statut ? getEtapeBadge(d.lastStatus.statut) : '?';
      const label = dossierLabel(d, id);
      return `
        <button class="dossier-tab ${isActive ? 'active' : ''}" data-dossier-id="${escapeAttr(id)}" role="tab" aria-selected="${isActive}">
          ${isPrimary ? '<span class="dossier-tab-primary-star" title="Dossier principal">★</span>' : ''}
          <span class="dossier-tab-label">${escapeHtml(label)}</span>
          <span class="dossier-tab-etape">${escapeHtml(etape)}</span>
        </button>
      `;
    }).join('');

    // Bind clicks
    scroll.querySelectorAll('.dossier-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        _activeViewDossierId = btn.dataset.dossierId;
        await renderDossierTabs();
        await loadData();
      });
    });
  } catch (e) {
    console.warn('[Popup] renderDossierTabs error:', e);
    tabs.classList.add('hidden');
  }
}

/** Extrait le badge d'étape courte (ex: "8.1", "11") pour affichage onglet */
function getEtapeBadge(statut) {
  try {
    const info = getStatusExplanation(statut);
    return formatSubStep(info.rang) || String(info.etape);
  } catch { return '?'; }
}

/** Label affiché dans l'onglet : numéro national si dispo, sinon ID court.
 *  Ex : "2024/01234" ou fallback "Dossier ABCDE". */
function dossierLabel(d, id) {
  const num = d?.apiData?.numeroNational;
  if (num) return String(num);
  // Fallback : 5 premiers chars de l'ID (hash) si pas encore de numéro national
  return 'Dossier ' + String(id || '').substring(0, 5);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// Re-render quand le storage change (nouveau dossier observé, primaire changé)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.dossiers || changes.primaryDossierId) {
    renderDossierTabs().catch(() => {});
  }
});

// ─────────────────────────────────────────────────────────────
// Bannière "changement de dossier détecté"
// ─────────────────────────────────────────────────────────────

async function checkDossierSwitchNotice() {
  try {
    const { dossierSwitchNotice } = await chrome.storage.local.get('dossierSwitchNotice');
    if (!dossierSwitchNotice || dossierSwitchNotice.acknowledged) return;
    showDossierSwitchBanner();
  } catch (e) {
    console.warn('[Popup] Erreur lecture dossierSwitchNotice:', e);
  }
}

function showDossierSwitchBanner() {
  const banner = document.getElementById('dossier-switch-banner');
  if (!banner) return;
  banner.classList.remove('hidden');

  document.getElementById('btn-dossier-switch-dismiss')?.addEventListener('click', async () => {
    await dismissDossierSwitchNotice();
    banner.classList.add('hidden');
  });

  document.getElementById('btn-dossier-switch-analyze')?.addEventListener('click', async () => {
    // Bascule l'onglet popup sur le dossier nouvellement détecté (ses données
    // sont déjà fraîches côté storage — pas besoin de relancer un refresh).
    try {
      const { dossierSwitchNotice } = await chrome.storage.local.get('dossierSwitchNotice');
      if (dossierSwitchNotice?.newId) {
        _activeViewDossierId = dossierSwitchNotice.newId;
        await renderDossierTabs();
        await loadData();
      }
    } catch (e) {
      console.warn('[Popup] Erreur bascule nouveau dossier:', e);
    }
    await dismissDossierSwitchNotice();
    banner.classList.add('hidden');
  });
}

async function dismissDossierSwitchNotice() {
  try {
    const { dossierSwitchNotice } = await chrome.storage.local.get('dossierSwitchNotice');
    if (dossierSwitchNotice) {
      await chrome.storage.local.set({
        dossierSwitchNotice: { ...dossierSwitchNotice, acknowledged: true }
      });
    }
  } catch (e) {
    console.warn('[Popup] Erreur dismiss notice:', e);
  }
}

// Écoute en temps réel : si l'utilisateur est dans la popup quand un
// changement de dossier est détecté par le service-worker, afficher
// immédiatement la bannière.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.dossierSwitchNotice) return;
  const notice = changes.dossierSwitchNotice.newValue;
  if (notice && !notice.acknowledged) {
    showDossierSwitchBanner();
    // Recharger les données pour refléter le nouveau dossier
    loadData().catch(() => {});
  }
});

/** Attache les gestionnaires d'événements */
function attachEventListeners() {
  elements.btnRetry?.addEventListener('click', refreshInBackground);
  elements.btnLogin?.addEventListener('click', () => openAnefPage('login'));
  elements.btnCheck?.addEventListener('click', () => openAnefPage('mon-compte'));
  document.getElementById('btn-renew-password')?.addEventListener('click', () => openAnefPage('login'));
  document.getElementById('btn-password-expired-close')?.addEventListener('click', dismissPasswordExpiredView);
  document.getElementById('btn-password-expired-dismiss')?.addEventListener('click', dismissPasswordExpiredView);
  elements.btnRefresh?.addEventListener('click', refreshInBackground);
  elements.btnShare?.addEventListener('click', shareStatusText);
  elements.btnSettings?.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Privacy toggle
  elements.btnPrivacy?.addEventListener('click', () => {
    const isNowPrivate = document.body.classList.toggle('privacy-mode');
    document.getElementById('icon-eye-open').style.display = isNowPrivate ? 'none' : '';
    document.getElementById('icon-eye-closed').style.display = isNowPrivate ? '' : 'none';
    chrome.storage.local.set({ privacyMode: isNowPrivate });
  });
  // Restore privacy state
  chrome.storage.local.get('privacyMode', (d) => {
    if (d.privacyMode) {
      document.body.classList.add('privacy-mode');
      document.getElementById('icon-eye-open').style.display = 'none';
      document.getElementById('icon-eye-closed').style.display = '';
    }
  });

  // Clic sur la version = export logs (caché pour les devs)
  document.getElementById('version')?.addEventListener('click', handleExportLogs);

  // Bouton copier le code statut
  document.getElementById('btn-copy-status')?.addEventListener('click', copyStatusCode);

  document.getElementById('link-save-credentials')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('auto-check-settings-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Multi-dossier : actions secondaires
  document.getElementById('btn-make-primary')?.addEventListener('click', handleMakePrimary);
  document.getElementById('btn-remove-dossier')?.addEventListener('click', handleRemoveDossier);
}

async function handleMakePrimary() {
  if (!_activeViewDossierId) return;
  const ok = confirm(
    'Définir ce dossier comme principal ?\n\n' +
    "L'auto-check utilisera les identifiants enregistrés pour ce dossier " +
    '(ou aucun si tu n\'en as pas encore saisi — gère-les dans Paramètres).'
  );
  if (!ok) return;

  const response = await chrome.runtime.sendMessage({
    type: 'SET_PRIMARY_DOSSIER',
    dossierId: _activeViewDossierId
  });
  if (response?.success) {
    _activeViewDossierId = null; // reset → pointe vers nouveau primaire
    await renderDossierTabs();
    await loadData();
  } else {
    alert('Erreur : ' + (response?.error || 'impossible de changer le principal'));
  }
}

// ─────────────────────────────────────────────────────────────
// Avertissements fermables définitivement
// ─────────────────────────────────────────────────────────────
// Chaque avertissement (vue "mot de passe expiré", bannière "identifiants non
// enregistrés") a son drapeau dans chrome.storage.local. Une fois fermé, il ne
// se réaffiche plus tant que la situation n'a pas été résolue puis reproduite.

/** Vrai si l'utilisateur a fermé cet avertissement. */
async function isBannerDismissed(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] === true;
  } catch {
    return false;
  }
}

/** Mémorise la fermeture d'un avertissement. */
async function setBannerDismissed(key) {
  try {
    await chrome.storage.local.set({ [key]: true });
  } catch (e) {
    console.warn('[Popup] Impossible de mémoriser la fermeture:', e);
  }
}

/** Réarme un avertissement (situation résolue). */
async function clearBannerDismissed(key) {
  try {
    if (await isBannerDismissed(key)) await chrome.storage.local.remove(key);
  } catch { /* ignore */ }
}

/** Le drapeau "mot de passe expiré" est remis à zéro par le service worker dès
 *  qu'une vérification aboutit (le mot de passe fonctionne à nouveau). */
function isPasswordExpiredDismissed() {
  return isBannerDismissed('passwordExpiredDismissed');
}

/** Ferme la vue "mot de passe expiré" : elle ne se réaffichera plus. */
async function dismissPasswordExpiredView() {
  await setBannerDismissed('passwordExpiredDismissed');
  await loadData();
}

function showRefreshErrorBanner(title, message) {
  const banner = document.getElementById('refresh-error-banner');
  if (!banner) return;
  const titleEl = document.getElementById('refresh-error-title');
  const msgEl = document.getElementById('refresh-error-message');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  banner.classList.remove('hidden');

  const openBtn = document.getElementById('btn-refresh-error-open-anef');
  const dismissBtn = document.getElementById('btn-refresh-error-dismiss');
  if (openBtn && !openBtn.dataset.bound) {
    openBtn.dataset.bound = '1';
    openBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_ANEF', page: 'mon-compte' });
      window.close();
    });
  }
  if (dismissBtn && !dismissBtn.dataset.bound) {
    dismissBtn.dataset.bound = '1';
    dismissBtn.addEventListener('click', () => banner.classList.add('hidden'));
  }
}

function showWrongAccountBanner(info) {
  const banner = document.getElementById('wrong-account-banner');
  if (!banner) return;
  const expectedEl = document.getElementById('wrong-account-expected');
  const fetchedEl = document.getElementById('wrong-account-fetched');
  if (expectedEl) expectedEl.textContent = info.expectedNumero || ('Dossier ' + (info.expectedId || '').substring(0, 5));
  if (fetchedEl) fetchedEl.textContent = info.fetchedNumero || ('Dossier ' + (info.fetchedId || '').substring(0, 5));
  banner.classList.remove('hidden');

  // Bind actions (idempotent)
  const logoutBtn = document.getElementById('btn-wrong-account-logout');
  const dismissBtn = document.getElementById('btn-wrong-account-dismiss');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = '1';
    logoutBtn.addEventListener('click', () => {
      // Ouvre ANEF dans un nouvel onglet actif → user peut se déconnecter
      chrome.runtime.sendMessage({ type: 'OPEN_ANEF', page: 'mon-compte' });
      window.close();
    });
  }
  if (dismissBtn && !dismissBtn.dataset.bound) {
    dismissBtn.dataset.bound = '1';
    dismissBtn.addEventListener('click', () => {
      banner.classList.add('hidden');
    });
  }
}

async function handleRemoveDossier() {
  if (!_activeViewDossierId) return;
  const ok = confirm(
    'Retirer ce dossier de ta liste locale ?\n\n' +
    'Les données anonymes côté serveur ne sont pas supprimées — seule ta liste locale est nettoyée. ' +
    'Tu pourras le retrouver en te reconnectant à ce dossier sur ANEF.'
  );
  if (!ok) return;

  const response = await chrome.runtime.sendMessage({
    type: 'REMOVE_DOSSIER',
    dossierId: _activeViewDossierId
  });
  if (response?.success) {
    _activeViewDossierId = null;
    await renderDossierTabs();
    await loadData();
  } else {
    alert('Erreur : ' + (response?.error || 'impossible de retirer'));
  }
}

/** Copie le code statut dans le presse-papier */
async function copyStatusCode() {
  const statusCode = elements.statusCode?.textContent;
  const btn = document.getElementById('btn-copy-status');

  if (!statusCode || statusCode === '—' || !btn) return;

  try {
    await navigator.clipboard.writeText(statusCode);

    // Animation de confirmation
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  } catch (err) {
    console.error('[Popup] Erreur copie:', err);
  }
}

/** Exporte les logs pour le debugging (clic sur version) */
async function handleExportLogs() {
  const versionEl = document.getElementById('version');
  try {
    await downloadLogs();
    // Feedback visuel discret
    if (versionEl) {
      versionEl.textContent = '✓ logs';
      versionEl.style.color = '#22c55e';
      setTimeout(() => {
        versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
        versionEl.style.color = '';
      }, 1500);
    }
  } catch (error) {
    console.error('[Popup] Erreur export logs:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Chargement des données
// ─────────────────────────────────────────────────────────────

/** Charge les données depuis le service worker (ou depuis dossiers[id] si onglet secondaire actif) */
async function loadData() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    if (!response) {
      showView('noData');
      return;
    }

    if (response.inMaintenance) {
      showView('maintenance');
      return;
    }

    if (response.passwordExpired && !(await isPasswordExpiredDismissed())) {
      showView('passwordExpired');
      return;
    }

    // Si on a un onglet secondaire actif, on bypasse GET_STATUS et on lit
    // directement le record dans chrome.storage.local.dossiers[id]
    let { lastStatus, lastCheck, lastCheckAttempt, apiData } = response;
    const { dossiers = {}, primaryDossierId } = await chrome.storage.local.get(['dossiers', 'primaryDossierId']);
    const isViewingSecondary = _activeViewDossierId && _activeViewDossierId !== primaryDossierId;

    if (isViewingSecondary && dossiers[_activeViewDossierId]) {
      const d = dossiers[_activeViewDossierId];
      lastStatus = d.lastStatus;
      apiData = d.apiData;
      lastCheck = d.lastCheck;
      lastCheckAttempt = null; // pas de tentative pour un secondaire
    }

    // Toggle UI : boutons actualiser (primaire) vs actions secondaires
    toggleSecondaryActionsUI(isViewingSecondary);

    if (!lastStatus) {
      showView('noData');
      return;
    }

    displayStatus(lastStatus, apiData, lastCheck);
    displayLastCheck(lastCheck, lastCheckAttempt);
    showView('status');

    // Avertissement si primaire sans creds (et qu'on est en train de voir le primaire)
    const noCredsBanner = document.getElementById('no-creds-banner');
    if (noCredsBanner) {
      // Les identifiants sont enregistrés → on réarme la bannière pour le jour
      // où elle redeviendrait pertinente (identifiants supprimés).
      if (response.primaryHasCredentials === true) {
        await clearBannerDismissed('noCredsBannerDismissed');
      }
      const showBanner = response.primaryHasCredentials === false && !isViewingSecondary &&
        !(await isBannerDismissed('noCredsBannerDismissed'));
      noCredsBanner.classList.toggle('hidden', !showBanner);
      if (showBanner) {
        const btn = document.getElementById('btn-no-creds-open-settings');
        if (btn && !btn.dataset.bound) {
          btn.dataset.bound = '1';
          btn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
            window.close();
          });
        }
        const closeBtn = document.getElementById('btn-no-creds-close');
        if (closeBtn && !closeBtn.dataset.bound) {
          closeBtn.dataset.bound = '1';
          closeBtn.addEventListener('click', async () => {
            noCredsBanner.classList.add('hidden');
            await setBannerDismissed('noCredsBannerDismissed');
          });
        }
      }
    }

  } catch (error) {
    console.error('[Popup] Erreur chargement:', error);
    showView('noData');
  } finally {
    // Toujours afficher l'info auto-check (visible sur toutes les vues)
    loadAutoCheckNext();
    checkStepDatesAlert();
  }
}

/** Bascule l'UI entre mode primaire et mode secondaire */
function toggleSecondaryActionsUI(isSecondary) {
  const refreshBtn = document.getElementById('btn-refresh');
  const secondaryActions = document.getElementById('secondary-actions');
  if (refreshBtn) refreshBtn.style.display = isSecondary ? 'none' : '';
  if (secondaryActions) secondaryActions.classList.toggle('hidden', !isSecondary);
}

// ─────────────────────────────────────────────────────────────
// Affichage
// ─────────────────────────────────────────────────────────────

/** Affiche une vue spécifique */
function showView(viewName) {
  Object.keys(views).forEach(key => {
    if (views[key]) {
      views[key].classList.toggle('hidden', key !== viewName);
    }
  });
}

/** Affiche le statut */
function displayStatus(statusData, apiData, lastCheck) {
  const { statut, date_statut } = statusData;
  const statusInfo = getStatusExplanation(statut);
  // Procédure clôturée : décret de naturalisation publié → on fige les compteurs
  const closed = isClosedStatus(statut);

  // Icône et phase
  if (elements.statusIcon) elements.statusIcon.textContent = statusInfo.icon || '📋';
  if (elements.statusPhase) elements.statusPhase.textContent = statusInfo.phase;
  if (elements.statusStep) elements.statusStep.textContent = `Étape ${formatSubStep(statusInfo.rang)}/12`;

  // Code et description
  if (elements.statusCode) elements.statusCode.textContent = statut;
  if (elements.statusDescription) elements.statusDescription.textContent = statusInfo.description;

  // Date du statut : chercher la plus ancienne (manual ou auto)
  if (elements.statusDate) {
    (async () => {
      // stepDates (rectification manuelle) a priorité absolue
      const sdData = await chrome.storage.local.get('stepDates');
      const stepDates = sdData.stepDates || [];
      const manualEntry = stepDates.find(sd =>
        (sd.statut || '').toLowerCase() === (statut || '').toLowerCase()
      );

      let earliestDate;
      if (manualEntry?.date_statut) {
        // Date rectifiée/manuelle → fait foi
        earliestDate = manualEntry.date_statut;
      } else {
        // Pas de rectification → utiliser la date ANEF
        earliestDate = date_statut;
      }

      if (earliestDate) {
        if (closed) {
          // Procédure terminée → on n'affiche plus de durée qui s'incrémente
          elements.statusDate.textContent = formatDate(earliestDate);
        } else {
          const days = daysSince(earliestDate);
          const duration = formatDuration(days);
          elements.statusDate.textContent = `${formatDate(earliestDate)} (${days === 0 ? "aujourd'hui" : 'il y a ' + duration})`;
          ecrireHeros(duration, 'à cette étape');
        }
      } else {
        elements.statusDate.textContent = '—';
        if (!closed) ecrireHeros('—', 'à cette étape');
      }

      // Dernière MAJ (date ANEF la plus récente, peut être = date statut ou plus récente)
      const statusLastCheck = document.getElementById('status-last-check');
      if (statusLastCheck) {
        const majDate = (date_statut && earliestDate && date_statut.substring(0, 10) !== earliestDate.substring(0, 10))
          ? date_statut : lastCheck;
        if (majDate) {
          const datePart = formatDate(majDate);
          const d = new Date(majDate);
          const timePart = !isNaN(d) ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : '';
          statusLastCheck.textContent = datePart + ' ';
          if (timePart) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'privacy-time';
            timeSpan.textContent = timePart;
            statusLastCheck.appendChild(timeSpan);
          }
        } else {
          statusLastCheck.textContent = '—';
        }
        // Même règle que les autres lignes de détail : pas de valeur, pas de
        // ligne. Le basculement se fait ici et non dans displayDetails, qui
        // s'exécute avant que cette date asynchrone soit connue.
        document.getElementById('detail-last-maj')?.classList.toggle('hidden', !majDate);
      }
    })().catch(e => console.warn('[Popup] Erreur mise à jour dates:', e));
  }

  // Compteur d'étape : 12 segments, un par étape. Bien plus lisible qu'une
  // barre continue — on compte les étapes d'un coup d'œil — et la couleur
  // encode enfin quelque chose : franchi / en cours / à venir.
  renderStepMeter(statusInfo.etape);

  // Figure héros : durée passée à l'étape courante. Remplacée par la durée
  // totale de la procédure quand le dossier est clôturé (cf. displayClosureBanner).
  // La figure héros est écrite dans l'IIFE asynchrone ci-dessus, pour partir
  // de la MÊME date que la ligne « depuis le … » : celle-ci donne la priorité
  // à la date rectifiée manuellement, et le héros la contredisait.


  // Description : repliée à deux lignes tant qu'elle déborde
  setupDescriptionToggle();

  // Style de la carte selon le statut
  const statusCard = document.querySelector('.status-card');
  if (statusCard) {
    statusCard.classList.remove('status-success', 'status-warning', 'status-error');

    if (isPositiveStatus(statut)) {
      statusCard.classList.add('status-success');
    } else if (isNegativeStatus(statut)) {
      statusCard.classList.add('status-error');
    }
  }

  displayClosureBanner(statusData, apiData, closed);
  displayTemporalStats(statusData, apiData, closed);
  displayDetails(statusData, apiData);
  displayDmr(apiData);
  displayStatusBadges(apiData);
}

// Description dépliée par l'utilisateur ? Conservé le temps du popup.
let descriptionDepliee = false;

/** Écrit la figure héros en adaptant le corps aux chaînes longues.
 *  `formatDuration` peut produire « 3 ans, 3 mois, 15 j » (19 caractères) :
 *  à 30 px dans une fenêtre de 380 px, ça passe à la ligne et, avec
 *  `line-height: .98`, les deux lignes se chevauchent. */
function ecrireHeros(texte, libelle) {
  const el = elements.stateHeroValue;
  if (el) {
    el.textContent = texte;
    // Filet de sécurité fondé sur une MESURE et non sur un compte de
    // caractères : mesuré à 380 px, même « 11 ans, 11 mois, 29 j » (le pire
    // cas réaliste, 21 caractères) tient sur une ligne. Un seuil arbitraire
    // rapetissait donc la figure sans raison. On ne réduit que si le texte
    // a effectivement débordé sur une seconde ligne.
    el.classList.remove('is-long');
    if (el.offsetHeight > 40) el.classList.add('is-long');
  }
  if (elements.stateHeroLabel && libelle) elements.stateHeroLabel.textContent = libelle;
}

/** Dessine le compteur d'étape : 12 segments, l'étape courante mise en avant. */
function renderStepMeter(etape) {
  const host = elements.stepMeter;
  if (!host) return;
  host.textContent = '';
  // `getStatusExplanation` renvoie `etape: 0` pour un code non répertorié —
  // le cas s'est produit en juillet 2026 quand ANEF a changé son vocabulaire.
  // `etape || 1` transformait alors « inconnu » en « étape 1 » : le dossier
  // affichait « Étape 0/12 » en texte et le premier segment en rouge, soit
  // « vous êtes au tout début » à quelqu'un potentiellement à l'étape 11.
  // Zéro segment allumé est le bon signal : on ne sait pas.
  const n = Math.round(Number(etape));
  const courante = Number.isFinite(n) ? Math.max(0, Math.min(12, n)) : 0;
  for (let i = 1; i <= 12; i++) {
    const seg = document.createElement('div');
    seg.className = 'meter-seg' + (i < courante ? ' is-done' : i === courante ? ' is-now' : '');
    host.appendChild(seg);
  }
  host.setAttribute('aria-label', courante ? `Étape ${courante} sur 12` : 'Étape inconnue');
}

/** Le bouton « Lire la suite » n'apparaît que si la description est tronquée. */
function setupDescriptionToggle() {
  const desc = elements.statusDescription;
  const btn = elements.btnDescMore;
  if (!desc || !btn) return;

  // On respecte le choix de l'utilisateur pour la durée du popup : une
  // actualisation qui aboutit pendant qu'il lit ne doit pas replier le texte
  // sous ses yeux.
  // Le choix « déplié » ne vaut que pour LE texte affiché : en changeant
  // d'onglet de dossier, on héritait de l'état du dossier précédent et le
  // bouton annonçait « Réduire » sur une description d'une seule ligne.
  const signature = desc.textContent.slice(0, 80);
  if (desc.dataset.signature !== signature) {
    desc.dataset.signature = signature;
    descriptionDepliee = false;
  }

  desc.classList.toggle('status-description-clamp', !descriptionDepliee);
  btn.textContent = descriptionDepliee ? 'Réduire' : 'Lire la suite';

  // Mesure après rendu, clamp temporairement remis pour ne pas dépendre de
  // l'état courant : scrollHeight > clientHeight ⇒ le texte déborde.
  requestAnimationFrame(() => {
    const deplie = !desc.classList.contains('status-description-clamp');
    if (deplie) desc.classList.add('status-description-clamp');
    const tronque = desc.scrollHeight > desc.clientHeight + 1;
    if (deplie) desc.classList.remove('status-description-clamp');
    btn.classList.toggle('hidden', !tronque);
  });

  if (!btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const replie = desc.classList.toggle('status-description-clamp');
      descriptionDepliee = !replie;
      btn.textContent = replie ? 'Lire la suite' : 'Réduire';
    });
  }
}

/**
 * Affiche le suivi de la demande de modification du décret (DMR).
 *
 * L'API ANEF (/api/anf/usager/dmr) ne donne qu'un statut grossier
 * (BROUILLON / DEPOT_CONFIRME / TRAITEMENT_TERMINE) : le détail de
 * l'instruction arrive par les notifications, d'où le bloc « Suivi ».
 * Rien de tout ceci ne quitte le navigateur.
 */
function displayDmr(apiData) {
  const section = document.getElementById('dmr-section');
  if (!section) return;

  const dmr = apiData?.dmr;
  if (!dmr?.statut) { section.classList.add('hidden'); return; }

  const info = getDmrStatut(dmr.statut);

  const badge = document.getElementById('dmr-statut-badge');
  if (badge) {
    badge.textContent = `${info.icon} ${info.label}`;
    badge.className = 'dmr-badge tone-' + (info.tone || 'pending');
  }
  const hint = document.getElementById('dmr-hint');
  if (hint) hint.textContent = info.hint || '';

  // Dates
  const dateEl = document.getElementById('dmr-date-depot');
  if (dateEl) dateEl.textContent = dmr.date_depot ? formatDate(dmr.date_depot) : '—';

  const ageEl = document.getElementById('dmr-age');
  if (ageEl) {
    const days = dmr.date_depot ? daysSince(dmr.date_depot) : null;
    // Une demande terminée n'a plus de compteur qui court
    ageEl.textContent = (days != null && dmr.statut !== 'TRAITEMENT_TERMINE')
      ? formatDuration(days)
      : '—';
  }

  const decretEl = document.getElementById('dmr-decret');
  const decretItem = document.getElementById('dmr-decret-item');
  if (decretEl && decretItem) {
    if (dmr.decret_id) {
      decretEl.textContent = 'n° ' + dmr.decret_id;
      decretItem.classList.remove('hidden');
    } else {
      decretItem.classList.add('hidden');
    }
  }

  // Progression du formulaire : n'a de sens que tant que la demande n'est pas déposée
  const etapeRow = document.getElementById('dmr-etape-row');
  const etapeEl = document.getElementById('dmr-etape');
  const etapeLabel = formatDmrEtape(dmr.etape_actuelle);
  if (etapeRow && etapeEl) {
    if (etapeLabel && dmr.statut === 'BROUILLON') {
      etapeEl.textContent = etapeLabel;
      etapeRow.classList.remove('hidden');
    } else {
      etapeRow.classList.add('hidden');
    }
  }

  renderDmrEnfants(dmr.enfants);
  renderDmrEvents(apiData.dmrEvents);
  renderDmrAttestation(dmr.attestation);

  section.classList.remove('hidden');
}

/** Liste des enfants demandés à l'ajout (ce qu'on a réellement soumis) */
function renderDmrEnfants(enfants) {
  const block = document.getElementById('dmr-enfants-block');
  const list = document.getElementById('dmr-enfants');
  const title = document.getElementById('dmr-enfants-title');
  if (!block || !list) return;

  list.textContent = '';
  if (!Array.isArray(enfants) || enfants.length === 0) {
    block.classList.add('hidden');
    return;
  }

  if (title) title.textContent = enfants.length > 1 ? `Enfants ajoutés (${enfants.length})` : 'Enfant ajouté';

  for (const e of enfants) {
    const li = document.createElement('li');

    const nom = document.createElement('span');
    nom.className = 'dmr-enfant-nom';
    nom.textContent = [e.prenoms, e.nom].filter(Boolean).join(' ') || 'Enfant';
    li.appendChild(nom);

    const parts = [];
    if (e.date_naissance) parts.push('né(e) le ' + formatDate(e.date_naissance));
    if (e.lieu_naissance) parts.push(e.lieu_naissance);
    if (e.motif_ajout) parts.push(DMR_MOTIFS_AJOUT[e.motif_ajout] || e.motif_ajout);
    if (parts.length) {
      const detail = document.createElement('span');
      detail.className = 'dmr-enfant-detail';
      detail.textContent = parts.join(' · ');
      li.appendChild(detail);
    }

    if (Array.isArray(e.justificatifs) && e.justificatifs.length) {
      const justif = document.createElement('span');
      justif.className = 'dmr-enfant-detail';
      justif.textContent = '📎 ' + e.justificatifs
        .map(t => DMR_JUSTIFICATIFS[t] || t)
        .join(', ');
      li.appendChild(justif);
    }

    list.appendChild(li);
  }
  block.classList.remove('hidden');
}

/** Évènements ANEF liés à la DMR (compléments demandés, décision, publication) */
function renderDmrEvents(events) {
  const block = document.getElementById('dmr-events-block');
  const list = document.getElementById('dmr-events');
  if (!block || !list) return;

  list.textContent = '';
  if (!Array.isArray(events) || events.length === 0) {
    block.classList.add('hidden');
    return;
  }

  // Plus récent en premier
  for (const ev of [...events].reverse()) {
    const li = document.createElement('li');
    if (dmrEventNeedsAction(ev.motif)) li.classList.add('needs-action');

    const date = document.createElement('span');
    date.className = 'dmr-event-date';
    date.textContent = ev.date ? formatDateShort(ev.date) : '—';
    li.appendChild(date);

    const label = document.createElement('span');
    label.textContent = DMR_EVENT_MOTIFS[ev.motif]?.label || ev.motif;
    li.appendChild(label);

    list.appendChild(li);
  }
  block.classList.remove('hidden');
}

/** Bouton d'attestation : le lien ANEF est signé et n'est valable que 24 h */
function renderDmrAttestation(attestation) {
  const btn = document.getElementById('btn-dmr-attestation');
  const stale = document.getElementById('dmr-attestation-stale');
  if (!btn || !stale) return;

  if (isDmrLinkValid(attestation)) {
    btn.dataset.url = attestation.url;
    if (attestation.nom) btn.title = attestation.nom;
    btn.classList.remove('hidden');
    stale.classList.add('hidden');
    if (!btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        if (btn.dataset.url) chrome.tabs.create({ url: btn.dataset.url });
      });
    }
  } else {
    btn.classList.add('hidden');
    // On ne signale l'expiration que si une attestation existe bel et bien
    stale.classList.toggle('hidden', !attestation?.url);
  }
}

/** Affiche les badges d'état déduits des drapeaux ANEF (décision, décret, recours) */
function displayStatusBadges(apiData) {
  const host = elements.statusBadges;
  if (!host) return;
  host.textContent = '';

  // Une ligne par signal : titre court + qualificatif. L'explication complète
  // reste accessible en infobulle plutôt que d'alourdir la lecture.
  const signaux = [];
  if (apiData?.decisionAvailable) signaux.push({
    icon: '📄', titre: 'Décision disponible', court: 'à télécharger sur ANEF',
    detail: "La décision préfectorale est prise. Le document est téléchargeable dans votre espace ANEF.",
    cls: 'signal-info'
  });
  if (apiData?.inDecretPipeline) signaux.push({
    icon: '📜', titre: 'Pipeline décret', court: 'décision favorable',
    detail: "ANEF propose le désistement du décret : la décision est favorable et votre dossier suit le circuit du décret.",
    cls: 'signal-success'
  });
  if (apiData?.canRapo) signaux.push({
    icon: '⚖️', titre: 'Recours possible', court: 'RAPO ouvert',
    detail: "Un recours administratif préalable obligatoire (RAPO) peut être déposé depuis votre espace ANEF.",
    cls: 'signal-warning'
  });

  if (!signaux.length) { host.classList.add('hidden'); return; }

  for (const sig of signaux) {
    const ligne = document.createElement('div');
    ligne.className = 'signal ' + sig.cls;
    ligne.title = sig.detail;

    const icone = document.createElement('span');
    icone.className = 'signal-icon';
    icone.textContent = sig.icon;

    const titre = document.createElement('span');
    titre.className = 'signal-title';
    titre.textContent = sig.titre;

    const court = document.createElement('span');
    court.className = 'signal-hint';
    court.textContent = sig.court;

    ligne.append(icone, titre, court);
    host.appendChild(ligne);
  }
  host.classList.remove('hidden');
}

/** Affiche la bannière de clôture quand la procédure est terminée (décret publié).
 *  Remplace les stats temporelles « vivantes » par un récap figé et festif. */
function displayClosureBanner(statusData, apiData, closed) {
  const banner = elements.closureBanner;
  if (!banner) return;

  const carte = document.querySelector('.status-card');

  if (!closed) {
    banner.classList.add('hidden');
    carte?.classList.remove('is-closed');
    elements.statsSection?.classList.remove('hidden');
    return;
  }

  const dateDepot = apiData?.dateDepot || apiData?.rawTaxePayee?.date_consommation;
  // Fin de procédure : date d'enregistrement du statut « décret publié » côté ANEF
  const dateFin = statusData?.date_statut;

  // Durée totale figée : dépôt → fin de procédure. Elle devient la figure
  // héros de la carte — le dossier est clos, la durée à l'étape courante
  // n'a plus de sens.
  const total = (dateDepot && dateFin) ? daysBetween(dateDepot, dateFin) : null;
  const totalTexte = (total != null) ? formatDuration(total) : '—';
  if (elements.closureTotalValue) elements.closureTotalValue.textContent = totalTexte;
  ecrireHeros(totalTexte, 'procédure terminée');
  carte?.classList.add('is-closed');
  // Numéro de décret (donnée fiable de l'API) ; on masque la figure s'il est absent
  if (elements.closureDecretFigure) {
    const numDecret = apiData?.numeroDecret;
    if (numDecret) {
      if (elements.closureDecretNum) elements.closureDecretNum.textContent = numDecret;
      elements.closureDecretFigure.classList.remove('hidden');
    } else {
      elements.closureDecretFigure.classList.add('hidden');
    }
  }
  if (elements.closureDepotDate) {
    elements.closureDepotDate.textContent = dateDepot ? formatDate(dateDepot) : '—';
  }

  banner.classList.remove('hidden');
  // La procédure est terminée : on masque les compteurs qui continueraient à courir
  elements.statsSection?.classList.add('hidden');
}

/** Affiche les statistiques temporelles */
function displayTemporalStats(statusData, apiData, closed = false) {
  const dateDepot = apiData?.dateDepot || apiData?.rawTaxePayee?.date_consommation;
  const dateEntretien = apiData?.dateEntretien || apiData?.rawEntretien?.date_rdv;

  // Depuis le dépôt (figé à la date du décret si la procédure est terminée)
  if (dateDepot && elements.statDepot) {
    const days = closed ? daysBetween(dateDepot, statusData?.date_statut) : daysSince(dateDepot);
    elements.statDepotValue.textContent = formatDuration(days);
    elements.statDepotDate.textContent = formatDate(dateDepot, true);
    elements.statDepot.classList.remove('hidden');
  } else if (elements.statDepot) {
    elements.statDepot.classList.add('hidden');
  }

  // Entretien
  if (dateEntretien && elements.statEntretien) {
    const entretienDateObj = new Date(dateEntretien);
    const now = new Date();
    const isPast = entretienDateObj < now;

    if (isPast) {
      const days = daysSince(dateEntretien);
      elements.statEntretienValue.textContent = days === 0
        ? "Aujourd'hui"
        : `Il y a ${formatDuration(days)}`;
    } else {
      const days = Math.ceil((entretienDateObj - now) / 86400000);
      elements.statEntretienValue.textContent = `Dans ${formatDuration(days)}`;
    }
    elements.statEntretienDate.textContent = formatDate(dateEntretien, true);
    elements.statEntretien.classList.remove('hidden');
  } else if (elements.statEntretien) {
    elements.statEntretien.classList.add('hidden');
  }

  // La durée passée au statut courant est portée par la figure héros de la
  // carte d'état (v2.12). La tuile qui la répétait a été retirée : la garder
  // « pour le cas clôturé » ne servait à rien, displayClosureBanner masquant
  // justement tout #stats-section dans ce cas — elle n'était donc visible
  // dans aucun état.
}

/**
 * Pointe le lien « Statistiques » sur la ligne de CE dossier.
 *
 * Le site n'offre aucun moyen de reconnaître son propre dossier : l'identifiant
 * qu'il affiche est régénéré à chaque chargement de page. Sans ce lien, un
 * utilisateur repère sa ligne à l'œil sur ses dates — plus de 1 400 dossiers
 * partagent parfois la même étape, dont 70 % figés par des installations
 * abandonnées. On passe donc par un FRAGMENT (`#d=`) et non un paramètre : il
 * n'est envoyé ni au serveur, ni dans l'en-tête de référent.
 */
function cablerLienStats(apiData) {
  const lien = document.getElementById('link-stats');
  if (!lien) return;
  const base = 'https://letranger-dev.github.io/anef-extension/';
  const pid = apiData?.publicId;
  if (pid) {
    lien.href = base + 'dossiers.html#d=' + encodeURIComponent(pid);
    lien.title = 'Voir mon dossier dans les statistiques communautaires';
  } else {
    lien.href = base;
    lien.title = 'Comparer votre progression aux statistiques communautaires';
  }
}

/** Affiche les détails du dossier */
function displayDetails(statusData, apiData) {
  cablerLienStats(apiData);

  if (!elements.detailsSection) return;

  let hasDetails = false;

  // ID du dossier
  if (statusData?.id && elements.detailDossierId) {
    elements.detailDossierIdValue.textContent = statusData.id;
    elements.detailDossierId.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailDossierId?.classList.add('hidden');
  }

  // Numéro national
  if (apiData?.numeroNational && elements.detailNumeroNational) {
    elements.detailNumeroNationalValue.textContent = apiData.numeroNational;
    elements.detailNumeroNational.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailNumeroNational?.classList.add('hidden');
  }

  // Préfecture
  if (apiData?.prefecture && elements.detailPrefecture) {
    elements.detailPrefectureValue.textContent = apiData.prefecture;
    elements.detailPrefecture.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailPrefecture?.classList.add('hidden');
  }

  // Type de demande
  if (apiData?.typeDemande && elements.detailTypeDemande) {
    elements.detailTypeDemandeValue.textContent = apiData.typeDemande;
    elements.detailTypeDemande.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailTypeDemande?.classList.add('hidden');
  }

  // Lieu entretien
  if (apiData?.lieuEntretien && elements.detailEntretienLieu) {
    elements.detailEntretienLieuValue.textContent = apiData.lieuEntretien;
    elements.detailEntretienLieu.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailEntretienLieu?.classList.add('hidden');
  }

  // Numéro de décret
  if (apiData?.numeroDecret && elements.detailDecret) {
    elements.detailDecretValue.textContent = apiData.numeroDecret;
    elements.detailDecret.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailDecret?.classList.add('hidden');
  }

  elements.detailsSection.classList.toggle('hidden', !hasDetails);
}

/** Affiche la date de dernière vérification */
function displayLastCheck(lastCheck, lastCheckAttempt) {
  if (!elements.lastCheckDate) return;

  // Nettoyer le contenu existant
  elements.lastCheckDate.textContent = '';

  if (lastCheck) {
    // Si la dernière tentative a échoué ET est strictement plus récente, afficher les deux
    const attemptFailed = lastCheckAttempt && !lastCheckAttempt.success;
    const attemptNewer = attemptFailed && lastCheckAttempt.timestamp &&
      new Date(lastCheckAttempt.timestamp).getTime() > new Date(lastCheck).getTime() + 5000;
    if (attemptNewer) {
      elements.lastCheckDate.textContent = formatDateShort(lastCheck) + ' ';
      const span = document.createElement('span');
      span.className = 'last-check-attempt';
      span.textContent = '(tentative ' + formatDateShort(lastCheckAttempt.timestamp) + ')';
      elements.lastCheckDate.appendChild(span);
    } else {
      elements.lastCheckDate.textContent = formatDateShort(lastCheck);
    }
  } else if (lastCheckAttempt) {
    const span = document.createElement('span');
    span.className = 'last-check-attempt';
    span.textContent = 'Tentative ' + formatDateShort(lastCheckAttempt.timestamp);
    elements.lastCheckDate.appendChild(span);
  } else {
    elements.lastCheckDate.textContent = 'Jamais';
  }
}

// ─────────────────────────────────────────────────────────────
// Auto-check info
// ─────────────────────────────────────────────────────────────

async function loadAutoCheckNext() {
  const container = document.getElementById('auto-check-next');
  const text = document.getElementById('auto-check-next-text');
  const dot = document.getElementById('auto-check-dot');
  const sep = document.getElementById('foot-sep');
  if (!container || !text) return;

  // ⚠️ L'état visuel se porte sur la PASTILLE, pas sur le texte. Jusqu'à la
  // v2.12 ces classes allaient sur `#auto-check-next`, qui était la bannière
  // entière et portait `.auto-check-banner.warning`. Depuis la refonte du pied
  // c'est un simple <span class="foot-item"> : aucune règle ne le colorait plus,
  // et la pastille restait verte même sur « mot de passe expiré ».
  const etat = (niveau) => {
    dot?.classList.remove('warning', 'error', 'off');
    if (niveau) dot?.classList.add(niveau);
  };
  // Le séparateur ne sépare plus rien si le texte disparaît.
  const reglages = document.getElementById('auto-check-settings-link');
  const montrer = (visible) => {
    container.classList.toggle('hidden', !visible);
    sep?.classList.toggle('hidden', !visible);
    // L'engrenage renvoie au réglage de la vérification automatique : le
    // laisser seul quand le texte disparaît donne une icône orpheline dont
    // plus rien n'indique l'objet.
    reglages?.classList.toggle('hidden', !visible);
  };

  try {
    const info = await chrome.runtime.sendMessage({ type: 'GET_AUTO_CHECK_INFO' });

    if (!info || !info.enabled) {
      // On ne masque plus tout : un utilisateur dont la vérification
      // automatique s'est retrouvée coupée n'avait AUCUN signal dans le popup,
      // et ne pouvait donc pas deviner qu'il fallait la rallumer.
      montrer(true);
      etat('off');
      text.textContent = 'vérification auto désactivée';
      container.title = "Réactivez-la dans les paramètres pour que votre dossier soit vérifié automatiquement.";
      return;
    }

    montrer(true);

    if (info.passwordExpired) {
      etat('warning');
      text.textContent = 'mot de passe ANEF expiré';
      container.title = 'Renouvelez votre mot de passe sur le portail ANEF pour relancer la vérification automatique.';
    } else if (!info.hasCredentials) {
      etat('warning');
      text.textContent = 'identifiants requis';
      container.title = "La vérification automatique est activée mais aucun identifiant n'est enregistré.";
    } else if (info.consecutiveFailures > 0) {
      etat('warning');
      text.textContent = `${info.consecutiveFailures} échec(s)`;
      container.title = 'Les dernières vérifications automatiques ont échoué ; les tentatives sont espacées.';
    } else if (info.nextAlarm) {
      etat(null);
      const diffMin = Math.round((info.nextAlarm - Date.now()) / 60000);
      let delai;
      if (diffMin <= 0) {
        delai = 'imminente';
      } else if (diffMin < 60) {
        delai = `dans ~${diffMin} min`;
      } else {
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        delai = `dans ~${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`;
      }
      text.textContent = `prochaine ${delai}`;
      container.title = 'Vérification automatique activée';
    } else {
      etat(null);
      text.textContent = 'vérification auto activée';
      container.title = '';
    }
  } catch (e) {
    console.warn('[Popup] Erreur chargement auto-check info:', e);
    montrer(false);
    etat('off');
  }
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

/** Ouvre une page ANEF */
function openAnefPage(page) {
  chrome.runtime.sendMessage({ type: 'OPEN_ANEF', page });
  window.close();
}

/** Met à jour l'état des étapes de chargement */
function updateLoadingStep(step) {
  const stepOpen = document.getElementById('step-open');
  const stepLoad = document.getElementById('step-load');
  const stepData = document.getElementById('step-data');
  const loadingMessage = document.getElementById('loading-message');

  [stepOpen, stepLoad, stepData].forEach(s => s?.classList.remove('active', 'done'));

  // Le conteneur porte `role="progressbar"` : sans `aria-valuenow`, un lecteur
  // d'ecran annonce « barre de progression » sans jamais dire ou on en est.
  // Le compte est celui des etapes FRANCHIES, d'ou le `step - 1`.
  const steps = document.querySelector('.loading-steps');
  if (steps) steps.setAttribute('aria-valuenow', String(Math.max(0, Math.min(3, step - 1))));

  switch (step) {
    case 1:
      stepOpen?.classList.add('active');
      if (loadingMessage) loadingMessage.textContent = 'Ouverture de la page ANEF...';
      break;
    case 2:
      stepOpen?.classList.add('done');
      stepLoad?.classList.add('active');
      if (loadingMessage) loadingMessage.textContent = 'Chargement de la page...';
      break;
    case 3:
      stepOpen?.classList.add('done');
      stepLoad?.classList.add('done');
      stepData?.classList.add('active');
      if (loadingMessage) loadingMessage.textContent = 'Récupération des données...';
      break;
    case 4:
      stepOpen?.classList.add('done');
      stepLoad?.classList.add('done');
      stepData?.classList.add('done');
      if (loadingMessage) loadingMessage.textContent = 'Terminé !';
      break;
  }
}

/** Actualise le statut en arrière-plan */
async function refreshInBackground() {
  showView('loading');
  updateLoadingStep(1);
  startQuoteCarousel();

  if (elements.btnRefresh) {
    elements.btnRefresh.classList.add('loading');
    elements.btnRefresh.disabled = true;
  }

  // Progression automatique pendant le chargement
  const progressInterval = setInterval(() => {
    const stepLoad = document.getElementById('step-load');
    const stepData = document.getElementById('step-data');

    if (stepLoad && !stepLoad.classList.contains('done') && !stepLoad.classList.contains('active')) {
      updateLoadingStep(2);
    } else if (stepLoad?.classList.contains('active') && stepData && !stepData.classList.contains('active')) {
      updateLoadingStep(3);
    }
  }, 5000);

  try {
    const result = await chrome.runtime.sendMessage({ type: 'BACKGROUND_REFRESH' });

    if (result?.needsLogin) {
      // Session ANEF expirée + pas d'identifiants → on revient au status
      // mais on affiche la bannière d'erreur explicite (et la bannière no-creds)
      await loadData();
      showRefreshErrorBanner(
        'Non connecté à ANEF',
        'Ta session ANEF a expiré et aucun identifiant n\'est enregistré. Connecte-toi manuellement sur ANEF ou configure tes identifiants.'
      );
      return;
    }

    // v2.6.1 : priorité au cas "mauvais compte" avant maintenance —
    // si on a reçu des données pour un autre dossier, c'est PAS une maintenance
    if (result?.unexpectedDossier) {
      showWrongAccountBanner(result.unexpectedDossier);
      await loadData();
      return;
    }

    if (result?.maintenance) {
      showView('maintenance');
      return;
    }

    if (result?.passwordExpired) {
      if (await isPasswordExpiredDismissed()) {
        // Avertissement masqué par l'utilisateur → on reste sur le statut connu,
        // avec juste une bannière (fermable) puisqu'il a demandé l'actualisation.
        await loadData();
        showRefreshErrorBanner(
          'Mot de passe ANEF expiré',
          'Renouvelle ton mot de passe sur le portail ANEF, puis relance une vérification.'
        );
      } else {
        showView('passwordExpired');
      }
      return;
    }

    if (result?.success) {
      updateLoadingStep(4);
      await new Promise(r => setTimeout(r, 500));
    } else if (!result?.aborted) {
      // Échec générique (timeout, login échoué, erreur réseau…) → message explicite
      await loadData();
      showRefreshErrorBanner(
        'Actualisation impossible',
        result?.error || 'Impossible de récupérer les données. Vérifie ta connexion et tes identifiants.'
      );
      return;
    }

    await loadData();

  } catch (error) {
    console.error('[Popup] Erreur refresh:', error);
    await loadData();
  } finally {
    clearInterval(progressInterval);
    stopQuoteCarousel();
    if (elements.btnRefresh) {
      elements.btnRefresh.classList.remove('loading');
      elements.btnRefresh.disabled = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Export image
// ─────────────────────────────────────────────────────────────

/** Génère et télécharge une image du suivi */
async function shareStatusText() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (!response?.lastStatus) return;

    const { lastStatus, apiData } = response;
    const statusInfo = getStatusExplanation(lastStatus.statut);

    // Récupérer les stepDates pour les dates rectifiées
    const sdData = await chrome.storage.local.get('stepDates');
    const stepDates = sdData.stepDates || [];

    // Construire les lignes du texte (anonyme, pas d'info perso)
    const lines = [];
    lines.push(`Mon dossier ANEF — ${statusInfo.phase}`);
    lines.push(`Étape ${formatSubStep(statusInfo.rang)}/12`);
    lines.push('');

    // Statut actuel avec date
    const manualEntry = stepDates.find(sd =>
      (sd.statut || '').toLowerCase() === (lastStatus.statut || '').toLowerCase()
    );
    const statutDate = manualEntry?.date_statut || lastStatus.date_statut;
    if (statutDate) {
      const days = daysSince(statutDate);
      const duration = days !== null ? (days === 0 ? " (aujourd'hui)" : ` (il y a ${formatDuration(days)})`) : '';
      lines.push(`Statut : ${lastStatus.statut}`);
      lines.push(`${statusInfo.description}`);
      lines.push(`Depuis le : ${formatDate(statutDate)}${duration}`);
    } else {
      lines.push(`Statut : ${lastStatus.statut}`);
      lines.push(`${statusInfo.description}`);
    }

    // Historique des étapes traversées (stepDates + history + apiData)
    const histData = await chrome.storage.local.get('history');
    const history = histData.history || [];

    // Fusionner toutes les sources de dates par statut
    const dateByStatut = {};
    const manualByStatut = {};
    for (const h of history) {
      const key = (h.statut || '').toLowerCase();
      if (key && h.date_statut) dateByStatut[key] = h.date_statut;
    }
    for (const sd of stepDates) {
      const key = (sd.statut || '').toLowerCase();
      if (key && sd.date_statut) {
        dateByStatut[key] = sd.date_statut; // stepDates prioritaires
        manualByStatut[key] = sd.date_statut;
      }
    }

    // Construire la timeline avec durée passée à chaque étape
    const stepsWithDates = [];
    for (const step of STEP_DEFAULTS) {
      const key = step.statut.toLowerCase();
      let date = dateByStatut[key];
      if (!date && step.etape === 2 && apiData?.dateDepot) date = apiData.dateDepot;
      // Étape 7 : l'historique date la CONVOCATION (passage en « en attente
      // d'entretien »), pas l'entretien lui-même — le REX affichait donc la
      // mauvaise date sous le libellé « Entretien d'assimilation ». Le
      // rendez-vous réel fait foi ; une date saisie à la main reste prioritaire.
      if (step.etape === 7 && !manualByStatut[key]) {
        date = resolveEntretienDate(apiData?.dateEntretien, date);
      }
      if (date) stepsWithDates.push({ ...step, date });
    }

    const timeline = [];
    for (let i = 0; i < stepsWithDates.length; i++) {
      const s = stepsWithDates[i];
      const indent = s.sub ? '  ' : '';
      const prefix = s.sub || s.etape;
      const isLast = i === stepsWithDates.length - 1;

      if (isLast) {
        // Étape en cours : "il y a X" ou "aujourd'hui"
        const days = daysSince(s.date);
        const agoStr = days === 0 ? " (aujourd'hui)" : days > 0 ? ` (il y a ${formatDuration(days)})` : '';
        timeline.push(`${s.icon} ${indent}${prefix}. ${s.label} — ${formatDate(s.date)}${agoStr} \u2190 en cours`);
      } else {
        // Étape passée : durée passée à ce statut
        const nextDate = stepsWithDates[i + 1].date;
        const daysAt = Math.round((new Date(nextDate) - new Date(s.date)) / 86400000);
        const spentStr = daysAt > 0 ? ` (${formatDuration(daysAt)} à ce statut)` : daysAt === 0 ? ' (< 1 jour à ce statut)' : '';
        timeline.push(`${s.icon} ${indent}${prefix}. ${s.label} — ${formatDate(s.date)}${spentStr}`);
      }
    }

    if (timeline.length) {
      lines.push('');
      lines.push('Parcours :');
      lines.push(...timeline);
    }

    // Barre de progression texte
    const step = statusInfo.etape;
    const filled = Math.round((step / 12) * 10);
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
    lines.push('');
    lines.push(`Progression : [${bar}] ${step}/12`);

    lines.push('');
    lines.push('— ANEF Status Tracker');

    const text = lines.join('\n');

    // Copier dans le clipboard
    await navigator.clipboard.writeText(text);

    // Feedback visuel sur le bouton
    const btn = elements.btnShare;
    const btnLabel = btn?.querySelector('span');
    if (btn && btnLabel) {
      const originalText = btnLabel.textContent;
      btnLabel.textContent = 'Copié !';
      btn.classList.add('copied');
      setTimeout(() => {
        btnLabel.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    }

  } catch (error) {
    console.error('[Popup] Erreur partage texte:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Alerte dates d'étapes
// ─────────────────────────────────────────────────────────────

async function checkStepDatesAlert() {
  try {
    const alertEl = document.getElementById('step-dates-alert');
    if (!alertEl) return;

    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (!response?.lastStatus || !response?.apiData?.dossierId) return;

    const currentInfo = getStatusExplanation(response.lastStatus.statut);
    if (currentInfo.etape <= 2) return;
    const currentRang = currentInfo.rang;

    // Statuts couverts (auto + manual), normalisés en minuscules
    const historyData = await chrome.storage.local.get('history');
    const history = historyData.history || [];
    const stepDatesData = await chrome.storage.local.get('stepDates');
    const stepDates = stepDatesData.stepDates || [];

    const coveredStatuts = new Set();
    for (const h of history) coveredStatuts.add((h.statut || '').toLowerCase());
    for (const sd of stepDates) coveredStatuts.add((sd.statut || '').toLowerCase());
    if (response.apiData.dateDepot) coveredStatuts.add('dossier_depose');
    if (response.apiData.dateEntretien) coveredStatuts.add('ea_en_attente_ea');

    // Seuls les jalons obligatoires (locked) sans date déclenchent l'alerte.
    // Les étapes intermédiaires non observées sont simplement sautées.
    const pastSteps = STEP_DEFAULTS.filter(s => {
      if (!s.locked) return false;
      const sRang = getStatusExplanation(s.statut).rang;
      return sRang <= currentRang;
    });

    let missing = 0;
    for (const s of pastSteps) {
      if (!coveredStatuts.has(s.statut)) missing++;
    }

    if (missing === 0) return;

    alertEl.classList.remove('hidden');

    // Clic → ouvrir la page options
    alertEl.onclick = (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    };
  } catch (e) {
    console.warn('[Popup] Erreur check step dates:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────

window.addEventListener('unload', () => {
  stopQuoteCarousel();
});
