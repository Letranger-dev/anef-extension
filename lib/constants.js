/**
 * Constantes et utilitaires centralisés - Extension ANEF Status Tracker
 */

// ─────────────────────────────────────────────────────────────
// URLs et domaines
// ─────────────────────────────────────────────────────────────

export const ANEF_BASE_URL = 'https://administration-etrangers-en-france.interieur.gouv.fr';

export const ANEF_ROUTES = {
  LOGIN: '/#/espace-personnel/connexion-inscription',
  MON_COMPTE: '/#/espace-personnel/mon-compte',
  HOME: '/#/'
};

// ─────────────────────────────────────────────────────────────
// Patterns de détection d'URL
// ─────────────────────────────────────────────────────────────

export const URLPatterns = {
  isANEFLogin: (url) => url?.includes('connexion-inscription') || false,
  isMonCompte: (url) => url?.includes('mon-compte') || false,
  isSSOPage: (url) => {
    if (!url) return false;
    return (
      url.includes('authentification') ||
      url.includes('agentconnect') ||
      url.includes('/auth') ||
      url.includes('/login') ||
      url.includes('sso.')
    );
  },
  isHomepage: (url) => {
    if (!url) return false;
    return url.endsWith('/#/') || url.endsWith('/#') || /particuliers\/#\/?$/.test(url);
  },
  isLoginPage: (url) => URLPatterns.isANEFLogin(url) || URLPatterns.isSSOPage(url)
};

// ─────────────────────────────────────────────────────────────
// Messages autorisés (whitelist sécurité)
// ─────────────────────────────────────────────────────────────

export const ALLOWED_MESSAGE_TYPES = [
  'DOSSIER_DATA',
  'DOSSIER_STEPPER',
  'API_DATA',
  'NOTIFICATIONS',
  'USER_INFO',
  'HISTORIQUE',
  'MAINTENANCE',
  'LOG'
];

// ─────────────────────────────────────────────────────────────
// Configuration des logs
// ─────────────────────────────────────────────────────────────

export const LogConfig = {
  MAX_LOGS: 500,
  STORAGE_KEY: 'debug_logs'
};
