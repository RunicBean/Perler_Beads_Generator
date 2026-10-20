// Encode a flat pixel preview without exposing layers or palette identifiers.
const { patternMetrics } = require('./pattern-filters.cjs');
const { deflateSync } = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
const colors = new Map([...fs.readFileSync(path.join(__dirname, '../src/palette.ts'), 'utf8').matchAll(/^([A-Z]+\d+),(#[\dA-Fa-f]{6})$/gm)].map(m => [`mard-${m[1].toLowerCase()}`, m[2]]));
function crc(bytes) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([size, name, data, checksum]); }
function publicListing(item) {
 const { project, ...metadata } = item;
 const width = project.width, height = project.height;
 const bytes = Buffer.alloc(height * (1 + width * 4));
 project.cells.forEach((id, i) => { const hex = colors.get(id); if (!hex) return; const offset = Math.floor(i / width) * (width * 4 + 1) + 1 + (i % width) * 4; bytes[offset] = parseInt(hex.slice(1,3),16); bytes[offset+1] = parseInt(hex.slice(3,5),16); bytes[offset+2] = parseInt(hex.slice(5,7),16); bytes[offset+3] = 255; });
 const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
 const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(bytes)),chunk('IEND',Buffer.alloc(0))]);
 return { ...metadata, width, height, ...patternMetrics(project), preview: `data:image/png;base64,${png.toString('base64')}` };
}
module.exports = { publicListing };
