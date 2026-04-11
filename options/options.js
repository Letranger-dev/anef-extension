/**
 * Page Options - Extension ANEF Status Tracker
 *
 * Gère les paramètres de l'extension :
 * - Historique des statuts
 * - Configuration (notifications, limites)
 * - Identifiants de connexion automatique
 * - Export/Import des données
 * - Logs de debug
 */

import * as storage from '../lib/storage.js';
import { getStatusExplanation, formatDate, formatDateShort, formatDuration, daysSince, formatSubStep, STEP_DEFAULTS } from '../lib/status-parser.js';

// ─────────────────────────────────────────────────────────────
// Éléments DOM (initialisés dans DOMContentLoaded)
// ─────────────────────────────────────────────────────────────

let tabs, tabContents;
const elements = {};

function initializeElements() {
  tabs = document.querySelectorAll('.tab');
  tabContents = document.querySelectorAll('.tab-content');

  Object.assign(elements, {
    // Historique
    historyList: document.getElementById('history-list'),

    // Step dates
    stepDatesSection: document.getElementById('step-dates-section'),
    stepDatesTimeline: document.getElementById('step-dates-timeline'),
    btnSaveDates: document.getElementById('btn-save-dates'),
    btnPullDates: document.getElementById('btn-pull-dates'),

    // Paramètres
    settingNotifications: document.getElementById('setting-notifications'),
    settingHistoryLimit: document.getElementById('setting-history-limit'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnResetSettings: document.getElementById('btn-reset-settings'),

    // Identifiants
    settingUsername: document.getElementById('setting-username'),
    settingPassword: document.getElementById('setting-password'),
    btnTogglePassword: document.getElementById('btn-toggle-password'),
    iconEye: document.getElementById('icon-eye'),
    iconEyeOff: document.getElementById('icon-eye-off'),
    credentialIndicator: document.getElementById('credential-indicator'),
    credentialStatusText: document.getElementById('credential-status-text'),
    btnSaveCredentials: document.getElementById('btn-save-credentials'),
    btnClearCredentials: document.getElementById('btn-clear-credentials'),

    // Export/Import
    btnExport: document.getElementById('btn-export'),
    btnImport: document.getElementById('btn-import'),
    importFile: document.getElementById('import-file'),
    btnClearAll: document.getElementById('btn-clear-all'),

    // Auto-check
    settingAutoCheck: document.getElementById('setting-auto-check'),
    autoCheckToggleWrapper: document.getElementById('auto-check-toggle-wrapper'),
    autoCheckStatus: document.getElementById('auto-check-status'),
    autoCheckDot: document.getElementById('auto-check-dot'),
    autoCheckStatusText: document.getElementById('auto-check-status-text'),
    autoCheckNoCreds: document.getElementById('auto-check-no-creds'),
    autoCheckSuspended: document.getElementById('auto-check-suspended'),
    btnResumeAutoCheck: document.getElementById('btn-resume-auto-check'),
    checkLogSection: document.getElementById('check-log-section'),
    checkLogList: document.getElementById('check-log-list'),

    // Debug
    logsContainer: document.getElementById('logs-container'),
    btnRefreshLogs: document.getElementById('btn-refresh-logs'),
    btnClearLogs: document.getElementById('btn-clear-logs'),

    // Toast
    toast: document.getElementById('toast')
  });
}

// ─────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  initTabs();
  initVersion();

  await loadHistory();
  await loadStepDates();
  await loadSettings();
  await loadCredentialStatus();
  await loadAutoCheckStatus();
  await loadCheckLog();

  attachEventListeners();

  // Afficher l'onglet selon le hash URL
  if (window.location.hash === '#history') {
    switchTab('history');
  } else if (window.location.hash === '#settings') {
    switchTab('settings');
  }
});

function initVersion() {
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = `ANEF Status Tracker v${manifest.version}`;
  }
}

function initTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

function switchTab(tabName) {
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

function attachEventListeners() {
  // Step dates
  elements.btnSaveDates?.addEventListener('click', handleSaveStepDates);
  elements.btnPullDates?.addEventListener('click', handlePullStepDates);

  // Paramètres
  elements.btnSaveSettings?.addEventListener('click', handleSaveSettings);
  elements.btnResetSettings?.addEventListener('click', handleResetSettings);

  // Identifiants
  elements.btnTogglePassword?.addEventListener('click', togglePasswordVisibility);
  elements.btnSaveCredentials?.addEventListener('click', handleSaveCredentials);
  elements.btnClearCredentials?.addEventListener('click', handleClearCredentials);

  // Auto-check
  elements.btnResumeAutoCheck?.addEventListener('click', handleResumeAutoCheck);

  // Export/Import
  elements.btnExport?.addEventListener('click', handleExport);
  elements.btnImport?.addEventListener('click', () => elements.importFile?.click());
  elements.importFile?.addEventListener('change', handleImport);
  elements.btnClearAll?.addEventListener('click', handleClearAll);

  // Debug
  elements.btnRefreshLogs?.addEventListener('click', loadLogs);
  elements.btnClearLogs?.addEventListener('click', handleClearLogs);
}

// ─────────────────────────────────────────────────────────────
// Historique
// ─────────────────────────────────────────────────────────────

async function loadHistory() {
  let history = await storage.getHistory();
  const lastCheck = await storage.getLastCheck();

  // Dédupliquer : une seule entrée par statut
  // stepDates (rectifications) ont priorité sur l'historique
  const stepDatesForHistory = await storage.getStepDates();
  const sdMap = {};
  for (const sd of stepDatesForHistory) {
    sdMap[(sd.statut || '').toLowerCase()] = (sd.date_statut || '').substring(0, 10);
  }

  const byStatut = {};
  for (const h of history) {
    const key = (h.statut || '').toLowerCase();
    const sdDate = sdMap[key];
    if (sdDate) {
      // stepDates a priorité → utiliser sa date
      byStatut[key] = { ...h, statut: key, date_statut: sdDate };
    } else {
      const date = (h.date_statut || '').substring(0, 10);
      if (!byStatut[key] || (date && (!byStatut[key].date_statut || date < byStatut[key].date_statut.substring(0, 10)))) {
        byStatut[key] = { ...h, statut: key };
      }
    }
  }
  const deduped = Object.values(byStatut);
  if (deduped.length < history.length || stepDatesForHistory.length) {
    await storage.set({ history: deduped });
    history = deduped;
  }

  // Afficher la dernière vérification en haut
  let lastCheckHtml = '';
  if (lastCheck) {
    lastCheckHtml = `
      <div class="last-check-banner">
        <span class="last-check-icon">🔄</span>
        <span>Dernière vérification : <strong>${formatDate(lastCheck, true)}</strong></span>
      </div>
    `;
  }

  if (!history || history.length === 0) {
    elements.historyList.innerHTML = `
      ${lastCheckHtml}
      <div class="empty-state">
        <span class="empty-icon">📊</span>
        <p>Aucun historique disponible</p>
        <p class="empty-hint">Visitez le site ANEF pour enregistrer votre historique.</p>
      </div>
    `;
    return;
  }

  const sorted = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  elements.historyList.innerHTML = lastCheckHtml + sorted.map(item => {
    const info = getStatusExplanation(item.statut);
    const statusDate = formatDate(item.date_statut);
    const days = daysSince(item.date_statut);
    const duration = formatDuration(days);

    return `
      <div class="history-item">
        <div class="history-icon">${info.icon}</div>
        <div class="history-content">
          <div class="history-phase">${info.phase}</div>
          <code class="history-code">${item.statut}</code>
          <div class="history-date">
            ${item.date_statut ? `Depuis le ${statusDate} <span class="duration-badge">${duration}</span>` : 'Date inconnue'}
          </div>
        </div>
        <div class="history-step">
          <span class="step-label">étape</span>
          <span class="step-number">${formatSubStep(info.rang)}</span>
          <span class="step-total">sur 12</span>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// Dates manuelles des étapes
// ─────────────────────────────────────────────────────────────

async function loadStepDates() {
  const apiData = await storage.getApiData();
  if (!apiData?.dossierId) {
    elements.stepDatesSection?.classList.add('hidden');
    return;
  }

  elements.stepDatesSection?.classList.remove('hidden');

  const history = await storage.getHistory();
  const stepDates = await storage.getStepDates();
  const lastStatus = await storage.getLastStatus();
  const currentInfo = lastStatus ? getStatusExplanation(lastStatus.statut) : null;
  const currentEtape = currentInfo ? currentInfo.etape : 0;
  const currentRang = currentInfo ? currentInfo.rang : 0;

  // Dates auto : apiData + statut actuel + historique observé
  const autoByStatut = {};
  if (apiData.dateDepot) autoByStatut['dossier_depose'] = toDateStr(apiData.dateDepot);
  if (apiData.dateEntretien) autoByStatut['ea_en_attente_ea'] = toDateStr(apiData.dateEntretien);
  // Remplir depuis l'historique (statuts passés observés par l'extension)
  for (const h of history) {
    const key = (h.statut || '').toLowerCase();
    const date = toDateStr(h.date_statut);
    if (key && date) autoByStatut[key] = date;
  }
  // Le statut actuel a priorité (date la plus récente)
  if (lastStatus?.date_statut) {
    autoByStatut[lastStatus.statut.toLowerCase()] = toDateStr(lastStatus.date_statut);
  }

  // Dates manuelles (saisies par l'utilisateur)
  const manualByStatut = {};
  for (const sd of stepDates) {
    manualByStatut[(sd.statut || '').toLowerCase()] = toDateStr(sd.date_statut);
  }

  // Afficher toutes les étapes (passées + futures)
  const stepsToShow = STEP_DEFAULTS;

  let html = '';
  for (const step of stepsToShow) {
    const autoDate = autoByStatut[step.statut];
    const manualDate = manualByStatut[step.statut];
    const hasManualOverride = !!autoDate && !!manualDate && manualDate !== autoDate;
    const isManualOnly = !!manualDate && !autoDate;
    const isAuto = !!autoDate && !hasManualOverride;
    const isLocked = !!step.locked;
    const dateValue = hasManualOverride ? manualDate : (isManualOnly ? manualDate : (autoDate || ''));
    const isCurrent = lastStatus && lastStatus.statut.toLowerCase() === step.statut;
    const stepRang = getStatusExplanation(step.statut).rang;
    const isFuture = !isCurrent && stepRang > currentRang;
    const itemClass = (isCurrent ? 'current ' : '') + (isFuture ? 'future ' : '') + (isAuto ? 'auto' : (dateValue ? 'filled' : ''));
    const etapeLabel = step.sub ? `Étape ${step.sub}` : `Étape ${step.etape}`;
    const disabled = (isAuto || isLocked || isFuture) ? 'disabled' : '';

    let badgeHtml = '';
    if (hasManualOverride) {
      badgeHtml = '<span class="step-date-badge manual">Rectifié</span>';
    } else if (isAuto) {
      badgeHtml = '<span class="step-date-badge auto">Auto</span>';
    } else if (dateValue) {
      badgeHtml = '<span class="step-date-badge manual">Manuel</span>';
    }

    // Bouton modifier pour les auto non verrouillés et non futurs
    let editBtn = '';
    if (disabled && !isLocked && !isFuture) {
      editBtn = '<button class="step-date-edit-btn" title="Rectifier la date">✏️</button>';
    }

    html += `
      <div class="step-date-item ${itemClass}" data-locked="${isLocked}">
        <span class="step-date-dot"></span>
        <span class="step-date-icon">${step.icon}</span>
        <div class="step-date-info">
          <div class="step-date-label">${step.label}</div>
          <div class="step-date-etape">${etapeLabel} · <code>${step.code}</code></div>
        </div>
        <div class="step-date-field">
          <input type="text" class="step-date-input" data-statut="${step.statut}" data-etape="${step.etape}"
            data-auto="${isAuto ? autoDate : ''}" data-value="${dateValue || ''}"
            data-has-saved="${isManualOnly || hasManualOverride ? '1' : ''}"
            value="${dateValue ? formatDateFR(dateValue) : ''}"
            placeholder="jj/mm/aaaa" maxlength="10" ${disabled}>
          <input type="date" class="step-date-picker" tabindex="-1">
        </div>
        ${badgeHtml}
        ${editBtn}
      </div>
    `;
  }

  elements.stepDatesTimeline.innerHTML = html;

  // Bouton "Modifier" → déverrouille le champ auto
  elements.stepDatesTimeline.querySelectorAll('.step-date-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.step-date-item');
      const input = item.querySelector('.step-date-input');
      input.disabled = false;
      input.focus();
      input.select();
      btn.remove();
      markUnsaved();
    });
  });

  // Lier le datepicker caché au champ texte
  elements.stepDatesTimeline.querySelectorAll('.step-date-field').forEach(field => {
    const textInput = field.querySelector('.step-date-input');
    const picker = field.querySelector('.step-date-picker');

    // Clic sur l'icône calendrier du champ → ouvrir le picker
    textInput.addEventListener('click', () => {
      if (textInput.disabled) return;
      picker.value = textInput.dataset.value || '';
      try { picker.showPicker(); } catch { /* fallback navigateurs anciens */ }
    });

    // Quand le picker change → mettre à jour le champ texte
    picker.addEventListener('change', () => {
      const iso = picker.value;
      textInput.dataset.value = iso;
      textInput.value = formatDateFR(iso);
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      updateBadge(textInput);
    });

    // Saisie manuelle en dd/mm/yyyy
    textInput.addEventListener('blur', () => {
      const val = textInput.value.trim();
      if (!val) {
        // Si une date était déjà enregistrée, interdire la suppression
        if (textInput.dataset.hasSaved) {
          textInput.value = formatDateFR(textInput.dataset.value);
        } else {
          textInput.dataset.value = '';
          updateBadge(textInput);
        }
        return;
      }
      const match = val.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
      if (match) {
        const iso = match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
        textInput.dataset.value = iso;
        textInput.value = formatDateFR(iso);
      } else {
        // Essayer format ISO
        const d = toDateStr(val);
        if (d && d.length === 10) {
          textInput.dataset.value = d;
          textInput.value = formatDateFR(d);
        }
      }
      updateBadge(textInput);
    });
  });

  function updateBadge(input) {
    const item = input.closest('.step-date-item');
    const autoVal = input.dataset.auto;
    const curVal = input.dataset.value;
    let badge = item.querySelector('.step-date-badge');
    if (autoVal && curVal && curVal !== autoVal) {
      item.classList.remove('auto');
      item.classList.add('filled');
      if (badge) { badge.textContent = 'Rectifié'; badge.className = 'step-date-badge manual'; }
    } else if (autoVal && (!curVal || curVal === autoVal)) {
      item.classList.remove('filled');
      item.classList.add('auto');
      if (badge) { badge.textContent = 'Auto'; badge.className = 'step-date-badge auto'; }
    } else if (curVal) {
      item.classList.add('filled');
      if (!badge) {
        input.closest('.step-date-field').insertAdjacentHTML('afterend', '<span class="step-date-badge manual">Manuel</span>');
      }
    }
    markUnsaved();
  }
}

function markUnsaved() {
  elements.btnSaveDates?.classList.add('unsaved');
  let banner = document.getElementById('unsaved-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'unsaved-banner';
    banner.className = 'unsaved-banner';
    banner.innerHTML = '<span class="unsaved-dot"></span> Modifications non enregistrées';
    elements.stepDatesTimeline.parentElement.insertBefore(banner, elements.stepDatesTimeline);
  }
  banner.classList.add('show');
}

function clearUnsaved() {
  elements.btnSaveDates?.classList.remove('unsaved');
  const banner = document.getElementById('unsaved-banner');
  if (banner) banner.remove();
}

async function handleSaveStepDates() {
  const allInputs = elements.stepDatesTimeline.querySelectorAll('.step-date-input');
  const entries = [];

  // Validate chronological order
  let prevDate = null;
  for (const input of allInputs) {
    const val = input.dataset.value;
    if (val) {
      if (prevDate && val < prevDate) {
        showToast('Les dates doivent être chronologiques', 'error');
        input.focus();
        return;
      }
      prevDate = val;
    }
  }

  // Récupérer les stepDates existantes pour ne jamais perdre une date
  const existingStepDates = await storage.getStepDates();
  const existingByStatut = {};
  for (const sd of existingStepDates) {
    existingByStatut[(sd.statut || '').toLowerCase()] = sd;
  }

  // Collect toutes les entrées
  for (const input of allInputs) {
    const statut = input.dataset.statut;
    const isoVal = input.dataset.value;
    const autoVal = input.dataset.auto;
    const existing = existingByStatut[statut];

    if (isoVal && (!autoVal || isoVal !== autoVal)) {
      // Nouvelle valeur ou valeur modifiée
      entries.push({
        statut,
        date_statut: isoVal,
        manual: true,
        timestamp: new Date().toISOString()
      });
    } else if (!isoVal && existing) {
      // Champ vidé mais date existante → garder l'ancienne (pas de suppression)
      entries.push(existing);
      showToast('Une date déjà enregistrée ne peut pas être supprimée', 'error');
      continue;
    }
  }

  await storage.saveStepDates(entries);

  // Also add manual entries to history for display
  for (const entry of entries) {
    await storage.addToHistory(entry);
  }

  // Sync to Supabase via service worker
  try {
    await chrome.runtime.sendMessage({ type: 'SYNC_STEP_DATES' });
  } catch (e) {
    console.warn('[Options] Erreur sync step dates:', e);
  }

  await loadStepDates();
  await loadHistory();
  clearUnsaved();
  showToast('Dates enregistrées et synchronisées', 'success');
}

async function handlePullStepDates() {
  try {
    elements.btnPullDates.disabled = true;
    elements.btnPullDates.textContent = 'Chargement...';

    const result = await chrome.runtime.sendMessage({ type: 'PULL_STEP_DATES' });

    if (result?.error) {
      showToast(result.error, 'error');
      return;
    }

    if (result?.count > 0) {
      await loadStepDates();
      await loadHistory();
      showToast(`${result.count} date(s) récupérée(s) depuis la base`, 'success');
    } else {
      showToast('Aucune donnée trouvée dans la base', 'info');
    }
  } catch (e) {
    showToast('Erreur de connexion', 'error');
  } finally {
    elements.btnPullDates.disabled = false;
    elements.btnPullDates.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Récupérer`;
  }
}

// ─────────────────────────────────────────────────────────────
// Paramètres
// ─────────────────────────────────────────────────────────────

async function loadSettings() {
  const settings = await storage.getSettings();
  if (elements.settingNotifications) elements.settingNotifications.checked = settings.notificationsEnabled;
  if (elements.settingHistoryLimit) elements.settingHistoryLimit.value = settings.historyLimit.toString();
  if (elements.settingAutoCheck) {
    elements.settingAutoCheck.checked = settings.autoCheckEnabled;
  }
}

async function handleSaveSettings() {
  const autoCheckEnabled = elements.settingAutoCheck?.checked || false;

  await storage.saveSettings({
    notificationsEnabled: elements.settingNotifications?.checked ?? true,
    autoCheckEnabled,
    historyLimit: parseInt(elements.settingHistoryLimit?.value || '100', 10)
  });

  // Notifier le service worker pour reconfigurer l'alarme
  try {
    await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
  } catch (e) {
    console.warn('[Options] Erreur envoi SETTINGS_CHANGED:', e);
  }

  await loadAutoCheckStatus();
  showToast('Paramètres sauvegardés', 'success');
}

async function handleResetSettings() {
  if (!confirm('Réinitialiser les paramètres par défaut ?')) return;

  // Préserver le jitter unique de cette installation
  const currentSettings = await storage.getSettings();
  await storage.saveSettings({
    ...storage.DEFAULT_SETTINGS,
    autoCheckJitterMin: currentSettings.autoCheckJitterMin || 0
  });
  await loadSettings();

  // Notifier le service worker pour reconfigurer l'alarme
  try {
    await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
  } catch (e) { /* ignore */ }
  await loadAutoCheckStatus();

  showToast('Paramètres réinitialisés', 'success');
}

// ─────────────────────────────────────────────────────────────
// Identifiants (connexion automatique)
// ─────────────────────────────────────────────────────────────

async function loadCredentialStatus() {
  const hasCredentials = await storage.hasCredentials();

  if (hasCredentials) {
    elements.credentialIndicator?.classList.add('active');
    if (elements.credentialStatusText) {
      elements.credentialStatusText.textContent = 'Identifiants enregistrés';
    }
    const creds = await storage.getCredentials();
    if (creds?.username && elements.settingUsername) {
      elements.settingUsername.value = creds.username;
      elements.settingPassword.value = '••••••••';
      elements.settingPassword.dataset.hasPassword = 'true';
    }
  } else {
    elements.credentialIndicator?.classList.remove('active');
    if (elements.credentialStatusText) {
      elements.credentialStatusText.textContent = 'Aucun identifiant enregistré';
    }
  }
}

async function togglePasswordVisibility() {
  const passwordInput = elements.settingPassword;
  if (!passwordInput) return;

  if (passwordInput.type === 'password') {
    // Charger le vrai mot de passe si placeholder affiché
    if (passwordInput.value === '••••••••' && passwordInput.dataset.hasPassword === 'true') {
      const creds = await storage.getCredentials();
      if (creds?.password) {
        passwordInput.value = creds.password;
      }
    }
    passwordInput.type = 'text';
    if (elements.iconEye) elements.iconEye.style.display = 'none';
    if (elements.iconEyeOff) elements.iconEyeOff.style.display = 'block';
  } else {
    passwordInput.type = 'password';
    if (elements.iconEye) elements.iconEye.style.display = 'block';
    if (elements.iconEyeOff) elements.iconEyeOff.style.display = 'none';
  }
}

async function handleSaveCredentials() {
  const username = elements.settingUsername?.value?.trim();
  let password = elements.settingPassword?.value;

  // Garder le mot de passe existant si placeholder
  if (password === '••••••••' && elements.settingPassword?.dataset.hasPassword === 'true') {
    const existingCreds = await storage.getCredentials();
    password = existingCreds?.password;
  }

  if (!username || !password) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  try {
    await storage.saveCredentials(username, password);
    elements.settingPassword.dataset.hasPassword = 'true';
    await loadCredentialStatus();

    // Notifier le service worker (l'alarme peut maintenant démarrer si auto-check activé)
    try {
      await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
    } catch (e) { /* ignore */ }
    await loadAutoCheckStatus();

    showToast('Identifiants enregistrés', 'success');
  } catch (error) {
    showToast('Erreur lors de la sauvegarde', 'error');
  }
}

async function handleClearCredentials() {
  if (!confirm('Supprimer vos identifiants ?')) return;

  try {
    await storage.clearCredentials();
    if (elements.settingUsername) elements.settingUsername.value = '';
    if (elements.settingPassword) {
      elements.settingPassword.value = '';
      elements.settingPassword.dataset.hasPassword = 'false';
    }
    await loadCredentialStatus();

    // Désactiver l'auto-check si actif (plus d'identifiants)
    const settings = await storage.getSettings();
    if (settings.autoCheckEnabled) {
      await storage.saveSettings({ autoCheckEnabled: false });
      if (elements.settingAutoCheck) elements.settingAutoCheck.checked = false;
      try {
        await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
      } catch (e) { /* ignore */ }
      await loadAutoCheckStatus();
    }

    showToast('Identifiants supprimés', 'success');
  } catch (error) {
    showToast('Erreur lors de la suppression', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// Vérification automatique
// ─────────────────────────────────────────────────────────────

async function loadAutoCheckStatus() {
  try {
    const info = await chrome.runtime.sendMessage({ type: 'GET_AUTO_CHECK_INFO' });
    if (!info) return;

    const { enabled, hasCredentials, passwordExpired, nextAlarm, consecutiveFailures } = info;

    // Toggle grisé si pas d'identifiants
    if (elements.settingAutoCheck) {
      elements.settingAutoCheck.disabled = !hasCredentials;
    }

    // Avertissement pas d'identifiants
    elements.autoCheckNoCreds?.classList.toggle('hidden', hasCredentials);

    // Avertissement mot de passe expiré (réutilise l'élément suspension)
    if (elements.autoCheckSuspended) {
      if (passwordExpired) {
        elements.autoCheckSuspended.classList.remove('hidden');
        const suspendedText = elements.autoCheckSuspended.querySelector('.auto-check-suspended-text, span');
        if (suspendedText) suspendedText.textContent = 'Mot de passe ANEF expiré — renouveler sur le portail';
      } else {
        elements.autoCheckSuspended.classList.add('hidden');
      }
    }

    // Zone de statut
    if (elements.autoCheckStatus && elements.autoCheckStatusText && elements.autoCheckDot) {
      if (!enabled || !hasCredentials) {
        elements.autoCheckStatus.classList.add('hidden');
      } else {
        elements.autoCheckStatus.classList.remove('hidden');

        if (passwordExpired) {
          elements.autoCheckDot.className = 'auto-check-dot error';
          elements.autoCheckStatusText.textContent = 'Mot de passe expiré';
        } else if (consecutiveFailures > 0 && nextAlarm) {
          elements.autoCheckDot.className = 'auto-check-dot warning';
          const nextDate = new Date(nextAlarm);
          const diffMin = Math.round((nextDate - Date.now()) / 60000);
          elements.autoCheckStatusText.textContent = `${consecutiveFailures} échec(s) · prochaine tentative dans ~${diffMin} min`;
        } else if (nextAlarm) {
          elements.autoCheckDot.className = 'auto-check-dot active';
          const nextDate = new Date(nextAlarm);
          const now = new Date();
          const diffMin = Math.round((nextDate - now) / 60000);

          if (diffMin <= 0) {
            elements.autoCheckStatusText.textContent = 'Prochaine vérification imminente';
          } else if (diffMin < 60) {
            elements.autoCheckStatusText.textContent = `Prochaine vérification dans ~${diffMin} min`;
          } else {
            const hours = Math.floor(diffMin / 60);
            const mins = diffMin % 60;
            elements.autoCheckStatusText.textContent = `Prochaine vérification dans ~${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`;
          }
        } else {
          elements.autoCheckDot.className = 'auto-check-dot';
          elements.autoCheckStatusText.textContent = 'En attente de programmation';
        }
      }
    }
  } catch (e) {
    console.warn('[Options] Erreur chargement auto-check:', e);
  }
}

async function handleResumeAutoCheck() {
  try {
    await storage.saveAutoCheckMeta({ consecutiveFailures: 0 });
    // Réinitialiser le flag mot de passe expiré
    const apiData = await storage.getApiData() || {};
    if (apiData.passwordExpired) {
      apiData.passwordExpired = false;
      await storage.saveApiData(apiData);
    }
    await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
    await loadAutoCheckStatus();
    showToast('Vérification automatique réactivée', 'success');
  } catch (e) {
    showToast('Erreur lors de la réactivation', 'error');
  }
}

async function loadCheckLog() {
  try {
    const log = await storage.getCheckLog();

    if (!log || log.length === 0) {
      elements.checkLogSection?.classList.add('hidden');
      return;
    }

    // Filtrer les entrées d'aujourd'hui
    const today = new Date().toISOString().slice(0, 10);
    const todayEntries = log.filter(e => e.timestamp && e.timestamp.startsWith(today));

    if (todayEntries.length === 0) {
      elements.checkLogSection?.classList.add('hidden');
      return;
    }

    elements.checkLogSection?.classList.remove('hidden');

    const typeLabels = { auto: 'Auto', manual: 'Manuel', retry: 'Retry' };
    const typeClasses = { auto: 'badge-auto', manual: 'badge-manual', retry: 'badge-retry' };

    elements.checkLogList.innerHTML = todayEntries
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const badge = `<span class="check-log-badge ${typeClasses[entry.type] || ''}">${typeLabels[entry.type] || entry.type}</span>`;
        const icon = entry.success ? '<span class="check-log-icon success">✓</span>' : '<span class="check-log-icon error">✗</span>';
        const duration = entry.duration != null ? `<span class="check-log-duration">${entry.duration}s</span>` : '';

        return `<div class="check-log-entry">${time} ${badge} ${icon} ${duration}</div>`;
      }).join('');

  } catch (e) {
    console.warn('[Options] Erreur chargement check log:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Export / Import
// ─────────────────────────────────────────────────────────────

async function handleExport() {
  try {
    const data = await storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `anef-status-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    showToast('Export réussi', 'success');
  } catch (error) {
    showToast('Erreur lors de l\'export', 'error');
  }
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (!data.exportDate || typeof data !== 'object') throw new Error('Fichier invalide');
    // Valider les clés attendues
    const validKeys = ['exportDate', 'version', 'lastStatus', 'lastCheck', 'lastCheckAttempt',
      'history', 'settings', 'apiData', 'autoCheckMeta', 'checkLog', 'stepDates', '_hasCredentials'];
    const dataKeys = Object.keys(data);
    if (!dataKeys.some(k => validKeys.includes(k))) throw new Error('Fichier invalide');

    await storage.importData(data);
    await loadHistory();
    await loadSettings();

    // Reconfigurer l'alarme avec les paramètres importés
    try {
      await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
    } catch (e) { /* ignore */ }
    await loadAutoCheckStatus();

    showToast('Import réussi', 'success');
  } catch (error) {
    showToast('Erreur lors de l\'import', 'error');
  }

  event.target.value = '';
}

async function handleClearAll() {
  if (!confirm('Supprimer toutes les données (historique, paramètres) ?\nVos identifiants de connexion seront conservés.\nCette action est irréversible.')) return;

  await storage.clearExceptCredentials();
  await loadHistory();
  await loadSettings();

  // Reconfigurer l'alarme (les paramètres ont été réinitialisés)
  try {
    await chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' });
  } catch (e) { /* ignore */ }
  await loadAutoCheckStatus();
  await loadCheckLog();

  showToast('Données supprimées (identifiants conservés)', 'success');
}

// ─────────────────────────────────────────────────────────────
// Debug / Logs
// ─────────────────────────────────────────────────────────────

async function loadLogs() {
  try {
    const logs = await chrome.runtime.sendMessage({ type: 'GET_LOGS' }) || [];

    if (logs.length === 0) {
      elements.logsContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>Aucun log disponible</p>
        </div>
      `;
      return;
    }

    elements.logsContainer.innerHTML = [...logs].reverse().map(log => {
      const levelClass = log.level?.toLowerCase() || 'info';
      return `
        <div class="log-entry log-${levelClass}">
          <span class="log-time">${log.timestamp || ''}</span>
          <span class="log-level">[${log.level || 'INFO'}]</span>
          <span class="log-source">[${log.source || '?'}]</span>
          <span class="log-message">${escapeHtml(log.message || '')}</span>
          ${log.data ? `<pre class="log-data">${escapeHtml(log.data)}</pre>` : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    elements.logsContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">❌</span>
        <p>Erreur de chargement</p>
      </div>
    `;
  }
}

async function handleClearLogs() {
  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' });
    await loadLogs();
    showToast('Logs effacés', 'success');
  } catch (error) {
    showToast('Erreur', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  setTimeout(() => elements.toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Formate une date YYYY-MM-DD en dd/mm/yyyy */
function formatDateFR(dateStr) {
  if (!dateStr) return '';
  const d = toDateStr(dateStr);
  if (!d || d.length < 10) return '';
  return d.substring(8, 10) + '/' + d.substring(5, 7) + '/' + d.substring(0, 4);
}

/** Normalise une date en YYYY-MM-DD (compatible input type="date") */
function toDateStr(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr);
  // Déjà au bon format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO timestamp → extraire la date
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  // Tenter un parse
  try {
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().substring(0, 10);
  } catch { /* ignore */ }
  return '';
}
