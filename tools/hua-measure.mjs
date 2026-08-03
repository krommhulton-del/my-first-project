// 合化第一量(v0.96):四种开关逐一量,证据定默认——不许拍脑袋
// 跑法:node tools/hua-measure.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const DATA = JSON.parse(readFileSync(join(ROOT, 'data', 'mingli-cases.json'), 'utf8'));

function silingDays(c, monthZhi) {
  const s = c.labels.siling;
  if (!s) return 15;
  if (s.days) return s.days;
  if (s.gan) { let acc = 0; for (const [g, d] of (Bazi.SILING[monthZhi] || [])) { if (g === s.gan) return acc + Math.ceil(d / 2); acc += d; } }
  return 15;
}
function mk(c, opts) {
  const gz = c.four.split(' ');
  const pillars = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { pillars[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  const days = silingDays(c, pillars.month.zhi);
  const st = Bazi.judgeStrength(pillars, pillars.day.gan, days, opts);
  return { pillars, st, cong: Bazi.judgeCong(st, pillars, pillars.day.gan) };
}

const VARIANTS = [
  ['off', { hua: 'off' }],
  ['other(只他干)', { hua: 'other' }],
  ['day严(日干+须辰)', { hua: 'day', huaChen: true }],
  ['day宽(日干,不须辰)', { hua: 'day', huaChen: false }],
  ['all严(他干+日干须辰)', { hua: 'all', huaChen: true }],
];
console.log('变体 | 旺衰(53) | 从格(34)');
for (const [name, opts] of VARIANTS) {
  let bn = 0, bh = 0, cn = 0, ch = 0;
  for (const c of DATA.cases) {
    if (c.labels.band) { bn++; const { st } = mk(c, opts); if ((st.strong ? '旺' : '弱') === c.labels.band) bh++; }
    if (c.labels.cong) { cn++; const { cong } = mk(c, opts); if (!!(cong && cong.type) === (c.labels.cong !== '不从')) ch++; }
  }
  console.log(`${name} | ${bh}/${bn} = ${(bh / bn * 100).toFixed(1)}% | ${ch}/${cn} = ${(ch / cn * 100).toFixed(1)}%`);
}
// 影响面:6000 随机盘,各变体触发率 + 相对 off 的喜忌翻盘率
console.log('\n影响面(6000 盘,相对 off):');
const charts = [];
for (let i = 0; i < 6000; i++) charts.push(new Date(1955 + (i * 7) % 70, (i * 3) % 12, 1 + (i * 11) % 28, (i * 5) % 24, 30));
for (const [name, opts] of VARIANTS.slice(1)) {
  let trig = 0, flip = 0;
  for (const d of charts) {
    const c0 = Bazi.chart(d, '男', { lon: 116.4 });
    const p = c0.pillars;
    const st1 = Bazi.judgeStrength(p, c0.dayGan, c0.daysIntoJie || 15, opts);
    const st0 = c0.strength;
    const y1 = Bazi.pickYongShen(c0.dayGan, st1, c0.tiaohou);
    const y0 = c0.yong;
    const changed = JSON.stringify(st0.pow) !== JSON.stringify(st1.pow);
    if (changed) trig++;
    if (changed && !y1.xiWx.some(w => y0.xiWx.includes(w))) flip++;
  }
  console.log(`${name}:力量分有变 ${(trig / 6000 * 100).toFixed(2)}%,其中喜忌完全翻盘 ${(flip / 6000 * 100).toFixed(2)}%(占全体)`);
}
