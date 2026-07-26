// 生成 assets/icon.png(托盘 / 窗口图标)—— 零依赖,纯 Node 实现
// 用法:node scripts/gen-icon.js

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 64;
const CX = 32;
const CY = 32;

const ORANGE = [217, 119, 87]; // #D97757
const DARK = [56, 37, 28];     // 眼睛

// 星形边界:身体半径 + 8 根光芒(|cos(4θ)| 的 8 个波瓣)
function starRadius(theta) {
  return 15 + 13 * Math.pow(Math.abs(Math.cos(4 * theta)), 5);
}

function insideStar(px, py) {
  const dx = px - CX;
  const dy = py - CY;
  const r = Math.hypot(dx, dy);
  return r <= starRadius(Math.atan2(dy, dx));
}

function insideEye(px, py, ex, ey) {
  const dx = (px - ex) / 2.4;
  const dy = (py - ey) / 3.2;
  return dx * dx + dy * dy <= 1;
}

// 3x3 超采样抗锯齿
function samplePixel(x, y) {
  let starHits = 0;
  let eyeHits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const px = x + (sx + 0.5) / 3;
      const py = y + (sy + 0.5) / 3;
      if (insideStar(px, py)) {
        starHits++;
        if (insideEye(px, py, CX - 6, CY - 2) || insideEye(px, py, CX + 6, CY - 2)) {
          eyeHits++;
        }
      }
    }
  }
  if (starHits === 0) return [0, 0, 0, 0];
  const eyeRatio = eyeHits / starHits;
  const color = ORANGE.map((c, i) => Math.round(c * (1 - eyeRatio) + DARK[i] * eyeRatio));
  return [...color, Math.round((starHits / 9) * 255)];
}

// ---------- 最小 PNG 编码器 ----------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // 每行前加 filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 渲染并写文件 ----------

const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = samplePixel(x, y);
    const idx = (y * SIZE + x) * 4;
    rgba[idx] = r;
    rgba[idx + 1] = g;
    rgba[idx + 2] = b;
    rgba[idx + 3] = a;
  }
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'icon.png');
fs.writeFileSync(outPath, encodePNG(SIZE, SIZE, rgba));
console.log(`已生成 ${outPath}`);
