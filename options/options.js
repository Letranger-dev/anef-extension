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
import { getStatusExplanation, formatDate, formatDuration, daysSince } from '../lib/status-parser.js';

// ─────────────────────────────────────────────────────────────
// Éléments DOM
// ─────────────────────────────────────────────────────────────

const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

const elements = {
  // Historique
  historyList: document.getElementById('history-list'),
  btnClearHistory: document.getElementById('btn-clear-history'),

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

  // Debug
  logsContainer: document.getElementById('logs-container'),
  btnRefreshLogs: document.getElementById('btn-refresh-logs'),
  btnClearLogs: document.getElementById('btn-clear-logs'),

  // Toast
  toast: document.getElementById('toast')
};

// ─────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initVersion();

  await loadHistory();
  await loadSettings();
  await loadCredentialStatus();

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
  // Historique
  elements.btnClearHistory?.addEventListener('click', handleClearHistory);

  // Paramètres
  elements.btnSaveSettings?.addEventListener('click', handleSaveSettings);
  elements.btnResetSettings?.addEventListener('click', handleResetSettings);

  // Identifiants
  elements.btnTogglePassword?.addEventListener('click', togglePasswordVisibility);
  elements.btnSaveCredentials?.addEventListener('click', handleSaveCredentials);
  elements.btnClearCredentials?.addEventListener('click', handleClearCredentials);

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
  const history = await storage.getHistory();
  const lastCheck = await storage.getLastCheck();

  // Afficher la dernière vérification en haut
  let lastCheckHtml = '';
  if (lastCheck) {
    const lastCheckDate = new Date(lastCheck);
    const formattedDate = lastCheckDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedTime = lastCheckDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    lastCheckHtml = `
      <div class="last-check-banner">
        <span class="last-check-icon">🔄</span>
        <span>Dernière vérification : <strong>${formattedDate} à ${formattedTime}</strong></span>
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
          <span class="step-number">${info.etape}</span>
          <span class="step-total">sur 12</span>
        </div>
      </div>
    `;
  }).join('');
}

async function handleClearHistory() {
  if (!confirm('Effacer tout l\'historique ?')) return;

  await storage.clearHistory();
  await loadHistory();
  showToast('Historique effacé', 'success');
}

// ─────────────────────────────────────────────────────────────
// Paramètres
// ─────────────────────────────────────────────────────────────

async function loadSettings() {
  const settings = await storage.getSettings();
  elements.settingNotifications.checked = settings.notificationsEnabled;
  elements.settingHistoryLimit.value = settings.historyLimit.toString();
}

async function handleSaveSettings() {
  await storage.saveSettings({
    notificationsEnabled: elements.settingNotifications.checked,
    historyLimit: parseInt(elements.settingHistoryLimit.value, 10)
  });
  showToast('Paramètres sauvegardés', 'success');
}

async function handleResetSettings() {
  if (!confirm('Réinitialiser les paramètres par défaut ?')) return;

  await storage.saveSettings(storage.DEFAULT_SETTINGS);
  await loadSettings();
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
    showToast('Identifiants supprimés', 'success');
  } catch (error) {
    showToast('Erreur lors de la suppression', 'error');
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
    a.click();

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
    if (!data.exportDate) throw new Error('Fichier invalide');

    await storage.importData(data);
    await loadHistory();
    await loadSettings();
    showToast('Import réussi', 'success');
  } catch (error) {
    showToast('Erreur lors de l\'import', 'error');
  }

  event.target.value = '';
}

async function handleClearAll() {
  if (!confirm('Supprimer toutes les données ? Cette action est irréversible.')) return;

  await storage.clear();
  await loadHistory();
  await loadSettings();
  showToast('Données supprimées', 'success');
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
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  setTimeout(() => elements.toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
