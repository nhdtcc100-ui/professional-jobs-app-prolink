const fs = require('fs');

const cp1252 = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201C: 0x93, // “
  0x201D: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F, // Ÿ
};

function fixMojibake1252(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 256) {
      bytes.push(code);
    } else if (cp1252[code]) {
      bytes.push(cp1252[code]);
    } else {
      bytes.push(code & 0xFF);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

const decoder = new TextDecoder('windows-1256');
const allBytes = new Uint8Array(256);
for(let i=0; i<256; i++) allBytes[i] = i;
const cp1256_str = decoder.decode(allBytes);
const charToByte1256 = {};
for(let i=0; i<256; i++) {
  charToByte1256[cp1256_str.charCodeAt(i)] = i;
}

function fixMojibake1256(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (charToByte1256[code] !== undefined) {
      bytes.push(charToByte1256[code]);
    } else {
      bytes.push(code & 0xFF);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

const content = fs.readFileSync('src/App.tsx', 'utf8');
const fixed1252 = fixMojibake1252(content);
const fullyFixed = fixMojibake1256(fixed1252);
fs.writeFileSync('src/App.recovered.tsx', fullyFixed, 'utf8');
console.log("Recovered App.tsx to App.recovered.tsx");
