/**
 * Popup - Extension ANEF Status Tracker
 *
 * Interface utilisateur principale affichant :
 * - Le statut actuel de la demande
 * - Les statistiques temporelles
 * - Les détails du dossier
 */

import { getStatusExplanation, formatDuration, formatDate, formatDateShort, formatTimestamp, daysSince, isPositiveStatus, isNegativeStatus, formatSubStep, STEP_DEFAULTS } from '../lib/status-parser.js';
import { downloadLogs } from '../lib/logger.js';
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
  { text: "L'attente est déjà la moitié du bonheur.", author: "Proverbe chinois" }
];

let quoteInterval = null;
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

      setTimeout(() => {
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
    progressFill: document.getElementById('progress-fill'),

    // Statistiques temporelles
    statsSection: document.getElementById('stats-section'),
    statDepot: document.getElementById('stat-depot'),
    statDepotValue: document.getElementById('stat-depot-value'),
    statDepotDate: document.getElementById('stat-depot-date'),
    statEntretien: document.getElementById('stat-entretien'),
    statEntretienValue: document.getElementById('stat-entretien-value'),
    statEntretienDate: document.getElementById('stat-entretien-date'),
    statStatutAge: document.getElementById('stat-statut-age'),
    statStatutAgeValue: document.getElementById('stat-statut-age-value'),
    statStatutAgeDate: document.getElementById('stat-statut-age-date'),

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
    detailDecretValue: document.getElementById('detail-decret-value')
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
  await loadData();
});

/** Attache les gestionnaires d'événements */
function attachEventListeners() {
  elements.btnRetry?.addEventListener('click', refreshInBackground);
  elements.btnLogin?.addEventListener('click', () => openAnefPage('login'));
  elements.btnCheck?.addEventListener('click', () => openAnefPage('mon-compte'));
  document.getElementById('btn-renew-password')?.addEventListener('click', () => openAnefPage('login'));
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

/** Charge les données depuis le service worker */
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

    if (response.passwordExpired) {
      showView('passwordExpired');
      return;
    }

    const { lastStatus, lastCheck, lastCheckAttempt, apiData } = response;

    if (!lastStatus) {
      showView('noData');
      return;
    }

    displayStatus(lastStatus, apiData, lastCheck);
    displayLastCheck(lastCheck, lastCheckAttempt);
    showView('status');

  } catch (error) {
    console.error('[Popup] Erreur chargement:', error);
    showView('noData');
  } finally {
    // Toujours afficher l'info auto-check (visible sur toutes les vues)
    loadAutoCheckNext();
    checkStepDatesAlert();
  }
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
        const days = daysSince(earliestDate);
        const duration = formatDuration(days);
        elements.statusDate.textContent = `${formatDate(earliestDate)} (${days === 0 ? "aujourd'hui" : 'il y a ' + duration})`;
      } else {
        elements.statusDate.textContent = '—';
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
      }
    })().catch(e => console.warn('[Popup] Erreur mise à jour dates:', e));
  }

  // Barre de progression
  const progress = (statusInfo.etape / 12) * 100;
  if (elements.progressFill) elements.progressFill.style.width = `${progress}%`;

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

  displayTemporalStats(statusData, apiData);
  displayDetails(statusData, apiData);
}

/** Affiche les statistiques temporelles */
function displayTemporalStats(statusData, apiData) {
  const dateDepot = apiData?.dateDepot || apiData?.rawTaxePayee?.date_consommation;
  const dateEntretien = apiData?.dateEntretien || apiData?.rawEntretien?.date_rdv;

  // Depuis le dépôt
  if (dateDepot && elements.statDepot) {
    const days = daysSince(dateDepot);
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

  // Âge du statut actuel
  if (statusData?.date_statut && elements.statStatutAge) {
    const days = daysSince(statusData.date_statut);
    elements.statStatutAgeValue.textContent = formatDuration(days);
    elements.statStatutAgeDate.textContent = formatDate(statusData.date_statut, true);
    elements.statStatutAge.classList.remove('hidden');
  } else if (elements.statStatutAge) {
    elements.statStatutAge.classList.add('hidden');
  }
}

/** Affiche les détails du dossier */
function displayDetails(statusData, apiData) {
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
  if (apiData?.uniteGestion && elements.detailEntretienLieu) {
    elements.detailEntretienLieuValue.textContent = apiData.uniteGestion;
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
  if (!container || !text) return;

  try {
    const info = await chrome.runtime.sendMessage({ type: 'GET_AUTO_CHECK_INFO' });

    if (!info || !info.enabled) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden', 'error', 'warning');

    if (info.passwordExpired) {
      container.classList.add('warning');
      text.textContent = 'Mot de passe ANEF expiré · renouveler sur le portail';
    } else if (!info.hasCredentials) {
      container.classList.add('warning');
      text.textContent = 'Vérification auto activée · identifiants requis';
    } else if (info.nextAlarm) {
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
      text.textContent = `Vérification auto activée · prochaine ${delai}`;
    } else {
      text.textContent = 'Vérification auto activée';
    }
  } catch (e) {
    console.warn('[Popup] Erreur chargement auto-check info:', e);
    container.classList.add('hidden');
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
      showView('notConnected');
      return;
    }

    if (result?.maintenance) {
      showView('maintenance');
      return;
    }

    if (result?.success) {
      updateLoadingStep(4);
      await new Promise(r => setTimeout(r, 500));
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
    for (const h of history) {
      const key = (h.statut || '').toLowerCase();
      if (key && h.date_statut) dateByStatut[key] = h.date_statut;
    }
    for (const sd of stepDates) {
      const key = (sd.statut || '').toLowerCase();
      if (key && sd.date_statut) dateByStatut[key] = sd.date_statut; // stepDates prioritaires
    }

    // Construire la timeline avec durée passée à chaque étape
    const stepsWithDates = [];
    for (const step of STEP_DEFAULTS) {
      const key = step.statut.toLowerCase();
      let date = dateByStatut[key];
      if (!date && step.etape === 2 && apiData?.dateDepot) date = apiData.dateDepot;
      if (!date && step.etape === 7 && apiData?.dateEntretien) date = apiData.dateEntretien;
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
