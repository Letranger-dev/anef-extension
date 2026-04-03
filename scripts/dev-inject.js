#!/usr/bin/env node
/**
 * Injecte les credentials Supabase depuis .env.local dans lib/constants.js
 * Usage : node scripts/dev-inject.js
 */
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env.local');
const CONSTANTS_FILE = path.join(__dirname, '..', 'lib', 'constants.js');

const PLACEHOLDERS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_FUNCTION_URL',
  'SUPABASE_EDGE_KEY'
];

// Lire .env.local
if (!fs.existsSync(ENV_FILE)) {
  console.error('\x1b[31m.env.local introuvable.\x1b[0m');
  console.error('Creez le fichier avec les 4 variables : ' + PLACEHOLDERS.join(', '));
  process.exit(1);
}

const env = {};
fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) env[match[1]] = match[2].trim();
});

// Verifier que toutes les variables sont presentes
const missing = PLACEHOLDERS.filter(k => !env[k]);
if (missing.length) {
  console.error('\x1b[31mVariables manquantes dans .env.local :\x1b[0m', missing.join(', '));
  process.exit(1);
}

// Lire constants.js
let content = fs.readFileSync(CONSTANTS_FILE, 'utf8');

// Verifier si deja injecte
if (!content.includes('__SUPABASE_URL__')) {
  console.log('\x1b[33mCredentials deja injectees.\x1b[0m Utilisez "node scripts/dev-restore.js" pour restaurer les placeholders.');
  process.exit(0);
}

// Remplacer les placeholders
PLACEHOLDERS.forEach(key => {
  content = content.replace(`'__${key}__'`, `'${env[key]}'`);
});

fs.writeFileSync(CONSTANTS_FILE, content, 'utf8');
console.log('\x1b[32mCredentials injectees dans lib/constants.js\x1b[0m');
console.log('Rechargez l\'extension dans chrome://extensions');
console.log('\x1b[33mATTENTION : ne pas commit ce fichier ! Utilisez "node scripts/dev-restore.js" avant.\x1b[0m');
