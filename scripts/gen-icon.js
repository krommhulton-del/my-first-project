// 生成 assets/icon.png(托盘 / 窗口图标)—— 零依赖,纯 Node 实现
// 图案:官方 Clawd,Claude Code 启动画面字符画的逐格展开:
//    ▐▛███▜▌
//   ▝▜█████▛▘
//     ▘▘ ▝▝
// 用法:node scripts/gen-icon.js

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// 与 renderer/index.html 中的 SVG 同一张 18x5 亚格图
// X = 橙色,. = 透明(眼睛是原版的负空间缺口)
const GRID = [
  '...XXXXXXXXXXXX...',
  '...XX.XXXXXX.XX...',
  '.XXXXXXXXXXXXXXXX.',
  '...XXXXXXXXXXXX...',
  '....X.X....X.X....',
];

// 终端半格字符的亚格宽高比是 1:2
const CELL_W = 3;
const CELL_H = 6;
const W = GRID[0].length * CELL_W;    // 54
const H = GRID.length * CELL_H;       // 30
const SIZE = 64;                      // 画布 64x64,居中
const OFF_X = Math.floor((SIZE - W) / 2);
const OFF_Y = Math.floor((SIZE - H) / 2);

const ORANGE = [217, 119, 87, 255]; // #D97757
const NONE = [0, 0, 0, 0];

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

function colorAt(px, py) {
  const gx = Math.floor((px - OFF_X) / CELL_W);
  const gy = Math.floor((py - OFF_Y) / CELL_H);
  if (gy < 0 || gy >= GRID.length || gx < 0 || gx >= GRID[0].length) return NONE;
  return GRID[gy][gx] === 'X' ? ORANGE : NONE;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = colorAt(x, y);
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
