/**
 * Logger - Extension ANEF Status Tracker
 *
 * Module de logging avec stockage dans chrome.storage
 * pour consultation dans la page Options.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const MAX_LOGS = 500;
const STORAGE_KEY = 'debug_logs';

/** Formate un timestamp */
function formatTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').substring(0, 23);
}

/** Crée une entrée de log */
function createLogEntry(level, source, message, data = null) {
  return {
    timestamp: formatTime(),
    level,
    source,
    message,
    data: data ? JSON.stringify(data, null, 2) : null
  };
}

/** Sauvegarde un log */
async function saveLog(entry) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const logs = result[STORAGE_KEY] || [];
    logs.push(entry);
    await chrome.storage.local.set({ [STORAGE_KEY]: logs.slice(-MAX_LOGS) });
  } catch (e) {
    console.error('[Logger] Erreur sauvegarde:', e);
  }
}

/** Classe Logger */
class Logger {
  constructor(source) {
    this.source = source;
  }

  _log(level, levelName, message, data) {
    const entry = createLogEntry(levelName, this.source, message, data);

    const colors = {
      DEBUG: 'color: #9ca3af',
      INFO: 'color: #3b82f6',
      WARN: 'color: #f59e0b',
      ERROR: 'color: #ef4444; font-weight: bold'
    };

    const prefix = `[${entry.timestamp}] [${this.source}] [${levelName}]`;

    if (data) {
      console.log(`%c${prefix} ${message}`, colors[levelName], data);
    } else {
      console.log(`%c${prefix} ${message}`, colors[levelName]);
    }

    saveLog(entry);
  }

  debug(message, data = null) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', message, data);
  }

  info(message, data = null) {
    this._log(LOG_LEVELS.INFO, 'INFO', message, data);
  }

  warn(message, data = null) {
    this._log(LOG_LEVELS.WARN, 'WARN', message, data);
  }

  error(message, data = null) {
    this._log(LOG_LEVELS.ERROR, 'ERROR', message, data);
  }
}

/** Récupère tous les logs */
export async function getLogs() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  } catch (e) {
    console.error('[Logger] Erreur lecture:', e);
    return [];
  }
}

/** Efface tous les logs */
export async function clearLogs() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  } catch (e) {
    console.error('[Logger] Erreur suppression:', e);
  }
}

/** Exporte les logs en texte */
export async function exportLogsAsText() {
  const logs = await getLogs();
  return logs.map(log => {
    let line = `[${log.timestamp}] [${log.source}] [${log.level}] ${log.message}`;
    if (log.data) {
      line += `\n  Data: ${log.data}`;
    }
    return line;
  }).join('\n');
}

/** Crée un logger pour un module */
export function createLogger(source) {
  return new Logger(source);
}

export { LOG_LEVELS, STORAGE_KEY };
