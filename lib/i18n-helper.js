/**
 * Helpers i18n pour l'extension ANEF Status Tracker.
 * Utilise l'API native chrome.i18n.getMessage().
 */

/** Raccourci pour chrome.i18n.getMessage */
export function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * Traduit tous les éléments d'une page portant des attributs data-i18n.
 *
 * Attributs reconnus :
 *   data-i18n          → remplace textContent
 *   data-i18n-title    → remplace title
 *   data-i18n-placeholder → remplace placeholder
 *   data-i18n-html     → remplace innerHTML (pour les liens intégrés)
 */
export function translatePage() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    if (msg) el.textContent = msg;
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n-title'));
    if (msg) el.title = msg;
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n-placeholder'));
    if (msg) el.placeholder = msg;
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n-html'));
    if (msg) el.innerHTML = msg;
  }
}

/** Returns the locale string for Intl/toLocaleString calls */
export function getLocale() {
  return chrome.i18n.getUILanguage() || 'fr';
}
