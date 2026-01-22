/**
 * Popup - Extension ANEF Status Tracker
 *
 * Interface utilisateur principale affichant :
 * - Le statut actuel de la demande
 * - Les statistiques temporelles
 * - Les détails du dossier
 */

import { getStatusExplanation, formatDuration, formatDate, daysSince, isPositiveStatus, isNegativeStatus } from '../lib/status-parser.js';
import { downloadLogs, clearLogs } from '../lib/logger.js';
import { checkForUpdate, dismissUpdate, isUpdateDismissed } from '../lib/version-check.js';

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
    btnDownload: document.getElementById('btn-download'),
    btnHistory: document.getElementById('btn-history'),
    btnSettings: document.getElementById('btn-settings'),

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
    detailDepot: document.getElementById('detail-depot'),
    detailDepotValue: document.getElementById('detail-depot-value'),
    detailEntretien: document.getElementById('detail-entretien'),
    detailEntretienValue: document.getElementById('detail-entretien-value'),
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

  // Vérifier les mises à jour (en arrière-plan)
  checkForUpdates();
});

/** Attache les gestionnaires d'événements */
function attachEventListeners() {
  elements.btnRetry?.addEventListener('click', refreshInBackground);
  elements.btnLogin?.addEventListener('click', () => openAnefPage('login'));
  elements.btnCheck?.addEventListener('click', () => openAnefPage('mon-compte'));
  elements.btnRefresh?.addEventListener('click', refreshInBackground);
  elements.btnDownload?.addEventListener('click', downloadStatusImage);
  elements.btnHistory?.addEventListener('click', () => chrome.runtime.openOptionsPage());
  elements.btnSettings?.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Clic sur la version = export logs (caché pour les devs)
  document.getElementById('version')?.addEventListener('click', handleExportLogs);

  // Bouton copier le code statut
  document.getElementById('btn-copy-status')?.addEventListener('click', copyStatusCode);

  document.getElementById('link-save-credentials')?.addEventListener('click', (e) => {
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

/** Vérifie si une mise à jour est disponible */
async function checkForUpdates() {
  try {
    const result = await checkForUpdate();

    if (!result.updateAvailable || !result.latestVersion) {
      return;
    }

    // Vérifier si l'utilisateur a ignoré cette version
    if (await isUpdateDismissed(result.latestVersion)) {
      return;
    }

    // Afficher la bannière
    const banner = document.getElementById('update-banner');
    const versionSpan = document.getElementById('update-version');
    const link = document.getElementById('update-link');
    const dismissBtn = document.getElementById('update-dismiss');

    if (banner && versionSpan && link) {
      versionSpan.textContent = result.latestVersion;
      link.href = result.repoUrl + '/releases';
      banner.classList.remove('hidden');

      // Gestion du bouton fermer
      dismissBtn?.addEventListener('click', async () => {
        await dismissUpdate(result.latestVersion);
        banner.classList.add('hidden');
      });
    }
  } catch (error) {
    console.warn('[Popup] Erreur vérification mise à jour:', error);
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

    const { lastStatus, lastCheck, apiData } = response;

    if (!lastStatus) {
      showView('noData');
      return;
    }

    displayStatus(lastStatus, apiData, lastCheck);
    displayLastCheck(lastCheck);
    showView('status');

  } catch (error) {
    console.error('[Popup] Erreur chargement:', error);
    showView('noData');
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
  if (elements.statusStep) elements.statusStep.textContent = `Étape ${statusInfo.etape}/12`;

  // Code et description
  if (elements.statusCode) elements.statusCode.textContent = statut;
  if (elements.statusDescription) elements.statusDescription.textContent = statusInfo.description;

  // Date du statut
  if (elements.statusDate) {
    if (date_statut) {
      const days = daysSince(date_statut);
      const formattedDate = formatDate(date_statut, true);
      const duration = formatDuration(days);
      elements.statusDate.textContent = `Mis à jour le ${formattedDate} (il y a ${duration})`;
    } else {
      elements.statusDate.textContent = '—';
    }
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
      elements.statEntretienValue.textContent = `Il y a ${formatDuration(days)}`;
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

  // Durée depuis le dépôt
  if (apiData?.dateDepot && elements.detailDepot) {
    const days = daysSince(apiData.dateDepot);
    const depotDate = formatDate(apiData.dateDepot, true);
    elements.detailDepotValue.textContent = `${formatDuration(days)} (${depotDate})`;
    elements.detailDepot.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailDepot?.classList.add('hidden');
  }

  // Date d'entretien
  if (apiData?.dateEntretien && elements.detailEntretien) {
    elements.detailEntretienValue.textContent = formatDate(apiData.dateEntretien, true);
    elements.detailEntretien.classList.remove('hidden');
    hasDetails = true;
  } else {
    elements.detailEntretien?.classList.add('hidden');
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
function displayLastCheck(lastCheck) {
  if (!elements.lastCheckDate) return;

  if (lastCheck) {
    const date = new Date(lastCheck);
    elements.lastCheckDate.textContent = date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } else {
    elements.lastCheckDate.textContent = 'Jamais';
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
    clearInterval(progressInterval);

    if (result?.needsLogin) {
      showView('notConnected');
      return;
    }

    if (result?.success) {
      updateLoadingStep(4);
      await new Promise(r => setTimeout(r, 500));
    }

    await loadData();

  } catch (error) {
    clearInterval(progressInterval);
    console.error('[Popup] Erreur refresh:', error);
    await loadData();
  } finally {
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
async function downloadStatusImage() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (!response?.lastStatus) return;

    const { lastStatus, apiData } = response;
    const statusInfo = getStatusExplanation(lastStatus.statut);

    // Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 520;
    const height = 340;
    canvas.width = width;
    canvas.height = height;

    // Couleurs
    const bleuFrance = '#002654';
    const rouge = '#ce1126';
    const blanc = '#ffffff';

    // Fond
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#f8fafc');
    bgGradient.addColorStop(1, '#e9ecef');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Header bleu
    ctx.fillStyle = bleuFrance;
    ctx.fillRect(0, 0, width, 52);

    // Bande tricolore
    ctx.fillStyle = bleuFrance;
    ctx.fillRect(0, 52, width / 3, 3);
    ctx.fillStyle = blanc;
    ctx.fillRect(width / 3, 52, width / 3, 3);
    ctx.fillStyle = rouge;
    ctx.fillRect(2 * width / 3, 52, width / 3, 3);

    // Titre
    ctx.fillStyle = blanc;
    ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
    ctx.fillText('ANEF Status Tracker', 20, 24);

    // Date et heure
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`${dateStr} à ${timeStr}`, 20, 42);

    // Carte principale
    const cardY = 68;
    const cardHeight = 115;

    // Ombre
    ctx.fillStyle = 'rgba(0, 38, 84, 0.1)';
    roundRect(ctx, 22, cardY + 4, width - 44, cardHeight, 12);
    ctx.fill();

    // Fond carte
    ctx.fillStyle = blanc;
    roundRect(ctx, 20, cardY, width - 40, cardHeight, 12);
    ctx.fill();

    // Bordure gauche
    const borderGradient = ctx.createLinearGradient(20, cardY, 20, cardY + cardHeight);
    borderGradient.addColorStop(0, bleuFrance);
    borderGradient.addColorStop(1, rouge);
    ctx.fillStyle = borderGradient;
    ctx.fillRect(20, cardY + 8, 4, cardHeight - 16);

    // Phase
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(statusInfo.phase, 36, cardY + 26);

    // Badge étape
    ctx.fillStyle = '#e8f0fe';
    roundRect(ctx, 36, cardY + 34, 70, 20, 10);
    ctx.fill();
    ctx.fillStyle = bleuFrance;
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Étape ${statusInfo.etape}/12`, 46, cardY + 48);

    // Badge code statut
    ctx.font = '11px Monaco, Consolas, monospace';
    const codeWidth = ctx.measureText(lastStatus.statut).width + 20;
    ctx.fillStyle = '#fef3c7';
    roundRect(ctx, 115, cardY + 34, codeWidth, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.fillText(lastStatus.statut, 125, cardY + 48);

    // Barre de progression
    const progressY = cardY + 70;
    const progressWidth = width - 80;
    const progressHeight = 10;

    ctx.fillStyle = '#e2e8f0';
    roundRect(ctx, 36, progressY, progressWidth, progressHeight, 5);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    roundRect(ctx, 36, progressY, progressWidth, progressHeight, 5);
    ctx.stroke();

    const progress = (statusInfo.etape / 12) * progressWidth;
    if (progress > 0) {
      const progressGradient = ctx.createLinearGradient(36, 0, 36 + progressWidth, 0);
      progressGradient.addColorStop(0, bleuFrance);
      progressGradient.addColorStop(0.6, '#3b5998');
      progressGradient.addColorStop(1, rouge);
      ctx.fillStyle = progressGradient;
      roundRect(ctx, 36, progressY, progress, progressHeight, 5);
      ctx.fill();
    }

    // Labels progression
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui, -apple-system, sans-serif';
    ctx.fillText('Dépôt', 36, progressY + 20);
    ctx.textAlign = 'right';
    ctx.fillText('Décret', 36 + progressWidth, progressY + 20);
    ctx.textAlign = 'left';

    // Section stats
    const statsY = 200;
    const statWidth = 150;
    const statGap = 12;

    let statsCount = 0;
    if (apiData?.dateDepot) statsCount++;
    if (apiData?.dateEntretien) statsCount++;
    if (lastStatus.date_statut) statsCount++;

    let statIndex = 0;
    const totalStatsWidth = statsCount * statWidth + (statsCount - 1) * statGap;
    const startX = (width - totalStatsWidth) / 2;

    if (apiData?.dateDepot) {
      drawStatCard(ctx, startX + statIndex * (statWidth + statGap), statsY, statWidth, 'DÉPÔT', formatDuration(daysSince(apiData.dateDepot)), bleuFrance);
      statIndex++;
    }

    if (apiData?.dateEntretien) {
      const entretienDate = new Date(apiData.dateEntretien);
      const isPast = entretienDate < new Date();
      const label = isPast ? 'ENTRETIEN' : 'ENTRETIEN PRÉVU';
      const dateFormatted = formatDate(apiData.dateEntretien, true);
      const duration = isPast
        ? `Il y a ${formatDuration(daysSince(apiData.dateEntretien))}`
        : `Dans ${formatDuration(Math.ceil((entretienDate - new Date()) / 86400000))}`;
      drawStatCard(ctx, startX + statIndex * (statWidth + statGap), statsY, statWidth, label, `${dateFormatted} (${duration})`, bleuFrance);
      statIndex++;
    }

    if (lastStatus.date_statut) {
      drawStatCard(ctx, startX + statIndex * (statWidth + statGap), statsY, statWidth, 'DERNIÈRE MAJ', formatDuration(daysSince(lastStatus.date_statut)), bleuFrance);
    }

    // Footer tricolore
    const footerY = height - 25;
    ctx.fillStyle = bleuFrance;
    ctx.fillRect(width/2 - 60, footerY, 40, 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(width/2 - 20, footerY, 40, 2);
    ctx.fillStyle = rouge;
    ctx.fillRect(width/2 + 20, footerY, 40, 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ANEF Status Tracker', width / 2, height - 8);
    ctx.textAlign = 'left';

    // Téléchargement
    const link = document.createElement('a');
    link.download = `anef-suivi-${now.toISOString().slice(0,10)}_${timeStr.replace(':', 'h')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

  } catch (error) {
    console.error('[Popup] Erreur génération image:', error);
  }
}

/** Dessine un rectangle arrondi */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Dessine une carte de statistique */
function drawStatCard(ctx, x, y, width, label, value, accentColor) {
  const cardHeight = 80;

  // Ombre
  ctx.fillStyle = 'rgba(0, 38, 84, 0.08)';
  roundRect(ctx, x + 2, y + 3, width, cardHeight, 10);
  ctx.fill();

  // Fond
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, width, cardHeight, 10);
  ctx.fill();

  // Bordure gauche
  const borderGrad = ctx.createLinearGradient(x, y, x, y + cardHeight);
  borderGrad.addColorStop(0, accentColor);
  borderGrad.addColorStop(1, '#ce1126');
  ctx.fillStyle = borderGrad;
  ctx.fillRect(x, y + 8, 3, cardHeight - 16);

  // Label
  ctx.fillStyle = '#64748b';
  ctx.font = '9px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + 18);

  // Valeur (avec retour à la ligne si nécessaire)
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';

  const words = value.split(' ');
  let line = '';
  let lineY = y + 34;
  const maxLines = 3;
  let lineCount = 0;

  for (const word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > width - 20 && line !== '') {
      ctx.fillText(line.trim(), x + 12, lineY);
      line = word + ' ';
      lineY += 14;
      lineCount++;
      if (lineCount >= maxLines) break;
    } else {
      line = testLine;
    }
  }
  if (lineCount < maxLines) {
    ctx.fillText(line.trim(), x + 12, lineY);
  }
}
