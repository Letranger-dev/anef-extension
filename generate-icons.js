/**
 * Générateur d'icônes - Extension ANEF Status Tracker
 *
 * Usage: node generate-icons.js
 *
 * Crée des icônes PNG placeholder (carrés bleus).
 * Pour de vraies icônes, utilisez generate-icons.html.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [16, 32, 48, 128];

/** Crée un PNG minimal avec fond bleu */
function createMinimalPNG(size) {
  const width = size;
  const height = size;

  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(2, 9);  // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdrData.copy(ihdr, 8);
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // Image data (bleu France: #002654)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      rawData.push(0x00, 0x26, 0x54);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4E, 0x44]);
  iend.writeUInt32BE(iendCrc, 4);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/** Calcul CRC32 pour PNG */
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

// Génération
const assetsDir = path.join(__dirname, 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('Génération des icônes placeholder...\n');

sizes.forEach(size => {
  const filename = `icon-${size}.png`;
  const filepath = path.join(assetsDir, filename);

  if (fs.existsSync(filepath)) {
    console.log(`⏭️  ${filename} existe déjà`);
    return;
  }

  try {
    const png = createMinimalPNG(size);
    fs.writeFileSync(filepath, png);
    console.log(`✅ ${filename} créé (${size}x${size})`);
  } catch (error) {
    console.error(`❌ Erreur ${filename}:`, error.message);
  }
});

console.log('\nTerminé !');
console.log('Ces icônes sont des placeholders (carrés bleus).');
console.log('Pour de vraies icônes, ouvrez assets/generate-icons.html.');
