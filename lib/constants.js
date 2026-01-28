/**
 * Constantes et utilitaires centralisés - Extension ANEF Status Tracker
 *
 * Ce module centralise toutes les constantes et patterns répétés
 * pour éviter la duplication de code et faciliter la maintenance.
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

export const ANEF_FULL_URLS = {
  LOGIN: ANEF_BASE_URL + '/particuliers' + ANEF_ROUTES.LOGIN,
  MON_COMPTE: ANEF_BASE_URL + '/particuliers' + ANEF_ROUTES.MON_COMPTE,
  HOME: ANEF_BASE_URL + '/particuliers' + ANEF_ROUTES.HOME
};

// ─────────────────────────────────────────────────────────────
// Patterns de détection d'URL
// ─────────────────────────────────────────────────────────────

export const URLPatterns = {
  /** Vérifie si l'URL est la page de connexion ANEF */
  isANEFLogin: (url) => url?.includes('connexion-inscription') || false,

  /** Vérifie si l'URL est la page mon-compte */
  isMonCompte: (url) => url?.includes('mon-compte') || false,

  /** Vérifie si l'URL est une page SSO/authentification */
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

  /** Vérifie si l'URL est la page d'accueil ANEF */
  isHomepage: (url) => {
    if (!url) return false;
    return (
      url.endsWith('/#/') ||
      url.endsWith('/#') ||
      /particuliers\/#\/?$/.test(url)
    );
  },

  /** Vérifie si l'URL est une page de connexion (ANEF ou SSO) */
  isLoginPage: (url) => {
    return URLPatterns.isANEFLogin(url) || URLPatterns.isSSOPage(url);
  },

  /** Vérifie si l'URL est sur le domaine ANEF */
  isANEFDomain: (url) => {
    return url?.includes('administration-etrangers-en-france.interieur.gouv.fr') || false;
  }
};

// ─────────────────────────────────────────────────────────────
// Sélecteurs DOM
// ─────────────────────────────────────────────────────────────

export const DOMSelectors = {
  // Formulaires de connexion
  USERNAME_INPUT: [
    "input[name='username']",
    "input[type='email']",
    "input[id='username']",
    "input[name='login']"
  ].join(', '),

  PASSWORD_INPUT: [
    "input[name='password']",
    "input[type='password']",
    "input[id='password']"
  ].join(', '),

  SUBMIT_BUTTON: [
    "button[type='submit']",
    "input[type='submit']",
    "button:contains('Connexion')",
    "button:contains('Se connecter')"
  ].join(', '),

  // Détection de connexion
  USER_LOGGED_IN: [
    '.user-menu',
    '.user-profile',
    '[class*="deconnexion"]',
    'a[href*="deconnexion"]'
  ].join(', '),

  // Angular
  ANGULAR_APP: 'app-root, [ng-version], .p-tabview, router-outlet'
};

// ─────────────────────────────────────────────────────────────
// Timeouts et intervalles
// ─────────────────────────────────────────────────────────────

export const Timeouts = {
  // Actualisation en arrière-plan
  REFRESH_DEFAULT: 45000,      // 45s sans credentials
  REFRESH_WITH_LOGIN: 90000,   // 90s avec credentials
  CHECK_INTERVAL: 500,         // Vérification toutes les 500ms
  WAIT_BEFORE_CHECK: 1500,     // Attente avant première vérification
  POST_LOGIN_WAIT: 1000,       // Attente après connexion

  // Angular
  ANGULAR_READY_WAIT: 3000,    // Attente que Angular soit prêt
  DOM_MUTATION_WAIT: 800,      // Attente après mutation DOM

  // Auto-login
  SSO_FORM_WAIT: 2000,         // Attente formulaire SSO
  SSO_REDIRECT_WAIT: 8000,     // Attente redirection SSO
  ANEF_FORM_WAIT: 3000,        // Attente formulaire ANEF
  ANEF_REDIRECT_WAIT: 5000     // Attente redirection ANEF
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
