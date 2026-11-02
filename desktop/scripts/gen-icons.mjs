/**
 * Генерация иконок A11yLens Desktop без внешних зависимостей:
 * PNG (32/128/512) и ICO (16/24/32/48/256, BMP-записи).
 * Мотив «линза»: тёмный скруглённый квадрат, светлое кольцо, точка-зрачок.
 * Запуск: node scripts/gen-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const iconsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src-tauri",
  "icons"
);
mkdirSync(iconsDir, { recursive: true });

// ── CRC32 для чанков PNG ──
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function png(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Мотив иконки ──
const BG = [0x0a, 0x0a, 0x0a];
const MARK = [0xfa, 0xfa, 0xfa];
const MID = [0xa1, 0xa1, 0xaa];

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size / 2 - size * 0.02;
  const corner = size * 0.22; // радиус скругления квадрата
  const ringOuter = size * 0.36;
  const ringInner = size * 0.28;
  const pupil = size * 0.12;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      // Вне скруглённого квадрата — прозрачность.
      const dx = Math.max(corner - x, x - (size - 1 - corner), 0);
      const dy = Math.max(corner - y, y - (size - 1 - corner), 0);
      const cornerDistance = Math.hypot(dx, dy);
      if (cornerDistance > corner) {
        rgba[index + 3] = 0;
        continue;
      }
      const distance = Math.hypot(x - center, y - center);
      let color = BG;
      if (distance >= ringInner && distance <= ringOuter) {
        color = MARK;
      } else if (distance < pupil) {
        color = MARK;
      } else if (distance < ringInner + size * 0.02) {
        color = MID;
      }
      rgba[index] = color[0];
      rgba[index + 1] = color[1];
      rgba[index + 2] = color[2];
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}

for (const [name, size] of [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["icon.png", 512],
]) {
  writeFileSync(path.join(iconsDir, name), png(size, size, drawIcon(size)));
  console.log(`icons/${name} (${size}x${size})`);
}

// ── ICO: BMP-записи (BGRA снизу вверх + AND-маска) ──
function icoEntry(size) {
  const rgba = drawIcon(size);
  const xorSize = size * size * 4;
  const maskRow = Math.ceil(size / 32) * 4;
  const andSize = maskRow * size;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // высота XOR+AND
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(xorSize + andSize, 20);

  const xor = Buffer.alloc(xorSize);
  for (let y = 0; y < size; y++) {
    const source = (size - 1 - y) * size * 4; // снизу вверх
    for (let x = 0; x < size; x++) {
      const s = source + x * 4;
      const d = (y * size + x) * 4;
      xor[d] = rgba[s + 2]; // B
      xor[d + 1] = rgba[s + 1]; // G
      xor[d + 2] = rgba[s]; // R
      xor[d + 3] = rgba[s + 3]; // A
    }
  }
  return Buffer.concat([header, xor, Buffer.alloc(andSize)]);
}

function ico(sizes) {
  const images = sizes.map(icoEntry);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  const directory = Buffer.alloc(16 * sizes.length);
  let offset = 6 + directory.length;
  sizes.forEach((size, index) => {
    const entry = index * 16;
    directory[entry] = size >= 256 ? 0 : size; // 256 кодируется нулём
    directory[entry + 1] = size >= 256 ? 0 : size;
    directory[entry + 4] = 1; // planes
    directory.writeUInt16LE(32, entry + 6); // bpp
    directory.writeUInt32LE(images[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  return Buffer.concat([header, directory, ...images]);
}

writeFileSync(path.join(iconsDir, "icon.ico"), ico([16, 24, 32, 48, 256]));
console.log("icons/icon.ico (16/24/32/48/256)");
