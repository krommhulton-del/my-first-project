// 把 VSOP87D 全序列裁成能进浏览器的截断表,并量出截断误差(v0.94 西洋星盘的地基)
//
// 规矩(§三 排盘层):**全序列就是客观标准**——截断表的每一个输出都拿全序列回对,
// 误差量出来写死在生成物里;经度最大误差超过 30″(0.008°)就收紧门槛重来。
// 跑法:node tools/build-vsop.mjs   → 生成 data/astro-vsop.js + 打印逐星误差表
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const PLANETS = { mer: '水星', ven: '金星', ear: '地球', mar: '火星', jup: '木星', sat: '土星', ura: '天王星', nep: '海王星' };
// 截断门槛(单位与系数同:L/B 为弧度、R 为 AU)。外行星周期长、项少,门槛放低些保精度。
const CUT = { mer: 5e-7, ven: 5e-7, ear: 5e-7, mar: 5e-7, jup: 1e-6, sat: 1e-6, ura: 1e-6, nep: 1e-6 };

function parse(file) {
  const txt = readFileSync(join(ROOT, 'data', 'vsop87', file), 'utf8');
  const series = { 1: [], 2: [], 3: [] };   // L, B, R;每项 [power, A, B, C]
  let vari = 1, power = 0;
  for (const line of txt.split('\n')) {
    const h = line.match(/VARIABLE (\d) \(LBR\).*\*T\*\*(\d)/);
    if (h) { vari = +h[1]; power = +h[2]; continue; }
    if (!/^ \d{4}/.test(line)) continue;
    const f = line.trim().split(/\s+/);
    const A = +f[f.length - 3], B = +f[f.length - 2], C = +f[f.length - 1];
    if (isNaN(A) || isNaN(B) || isNaN(C)) continue;
    series[vari].push([power, A, B, C]);
  }
  return series;
}
const evalSeries = (terms, t) => {
  let s = 0;
  for (const [p, A, B, C] of terms) s += A * Math.cos(B + C * t) * Math.pow(t, p);
  return s;
};
const norm = a => { a %= 2 * Math.PI; return a < 0 ? a + 2 * Math.PI : a; };

let out = '// data/astro-vsop.js — VSOP87D 截断表(机器生成,勿手改;生成器 tools/build-vsop.mjs)\n' +
  '// 源:data/vsop87/VSOP87D.*(ctdk/vsop87 @faa1189,详 report.txt)。全序列为标准,截断误差实测如下:\n';
const table = {};
console.log('星     | 全项数 → 截断 | 经度最大误差(1900–2100) | 距离最大误差');
for (const [key, name] of Object.entries(PLANETS)) {
  const full = parse('VSOP87D.' + key);
  const cut = CUT[key];
  const trunc = {};
  let nFull = 0, nCut = 0;
  for (const v of [1, 2, 3]) {
    nFull += full[v].length;
    trunc[v] = full[v].filter(([, A]) => Math.abs(A) >= cut);
    nCut += trunc[v].length;
  }
  // 量:1900–2100 每 73 天一个采样点
  let maxL = 0, maxR = 0;
  for (let i = 0; i <= 1000; i++) {
    const jd = 2415020 + i * 73;                     // 1900 起
    const t = (jd - 2451545) / 365250;               // VSOP87 的千儒略年
    const dL = Math.abs(norm(evalSeries(full[1], t)) - norm(evalSeries(trunc[1], t)));
    const dl = Math.min(dL, 2 * Math.PI - dL);
    maxL = Math.max(maxL, dl);
    maxR = Math.max(maxR, Math.abs(evalSeries(full[3], t) - evalSeries(trunc[3], t)));
  }
  const arcsec = maxL * 180 / Math.PI * 3600;
  console.log(`${name}(${key}) | ${nFull} → ${nCut} | ${arcsec.toFixed(1)}″ | ${(maxR * 1.496e8).toFixed(0)} km`);
  if (arcsec > 30) { console.error(`✗ ${name} 经度误差超 30″,收紧 CUT 后重跑`); process.exit(1); }
  table[key] = { name, err: +arcsec.toFixed(1), L: trunc[1], B: trunc[2], R: trunc[3] };
  out += `// ${name}: ${nFull}→${nCut} 项,经度最大误差 ${arcsec.toFixed(1)}″\n`;
}
out += '(function(root,factory){if(typeof module==="object"&&module.exports){module.exports=factory();}else{root.AstroVsop=factory();}}' +
  '(typeof self!=="undefined"?self:this,function(){\nreturn ' + JSON.stringify(table) + ';\n}));\n';
writeFileSync(join(ROOT, 'data', 'astro-vsop.js'), out);
console.log('已写 data/astro-vsop.js,' + (out.length / 1024).toFixed(0) + ' KB');
