#!/usr/bin/env node
/**
 * Restaure les placeholders dans lib/constants.js (inverse de dev-inject.js)
 * Usage : node scripts/dev-restore.js
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

// Lire constants.js
let content = fs.readFileSync(CONSTANTS_FILE, 'utf8');

// Verifier si deja restaure
if (content.includes('__SUPABASE_URL__')) {
  console.log('\x1b[33mPlaceholders deja en place.\x1b[0m');
  process.exit(0);
}

// Lire .env.local pour connaitre les valeurs a remplacer
if (!fs.existsSync(ENV_FILE)) {
  console.error('\x1b[31m.env.local introuvable — impossible de restaurer automatiquement.\x1b[0m');
  process.exit(1);
}

const env = {};
fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) env[match[1]] = match[2].trim();
});

// Remplacer les valeurs reelles par les placeholders
PLACEHOLDERS.forEach(key => {
  if (env[key]) {
    content = content.replace(`'${env[key]}'`, `'__${key}__'`);
  }
});

// Verification finale
const remaining = PLACEHOLDERS.filter(k => !content.includes(`'__${k}__'`));
if (remaining.length) {
  console.error('\x1b[31mCertains placeholders n\'ont pas pu etre restaures :\x1b[0m', remaining.join(', '));
  console.error('Verifiez lib/constants.js manuellement.');
  process.exit(1);
}

fs.writeFileSync(CONSTANTS_FILE, content, 'utf8');
console.log('\x1b[32mPlaceholders restaures dans lib/constants.js\x1b[0m');
console.log('Pret a commit.');
