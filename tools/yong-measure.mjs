// 用神口径:四个变体先量后改(v1.07,深造期第四次动地基)
//
// 缘起:命例基线「用神 45.8%」查出三分之一是假标签(v1.01 从格标签的同一种病),
// 洗净后 16 例、9 中(56.3%)。7 个真错例逐个回看原文,病根落在四处,各配一个变体:
//   A 从强出口闸——dtsy-032 成对命例「此与前造只换一申字…用金明矣」:食伤带本气根,不作从强;
//   B 假从改判——dtsy-220「用土以从之也,格成从杀」:原文的假从仍是从(假从章「只得投从于人也」),
//     我们的假从只标注不翻喜忌,含义相反(v0.76 记过这笔账);
//   C 中和调候门槛——dtsy-217「春初木嫩…用火以攻之」:调候火 pow 17.7 被 <12 的门槛挡在外面;
//   D 制杀路——dtsy-434「足以用金制杀…所谓不太过者宜克也」:弱盘官杀独重而身杀两停,食伤入喜。
// 另三例(218/448/500)是旺衰边界错(中和 51–55% vs 书判旺),那是 wuxingPower 地基的仗,本轮不碰。
//
// 判读口径(照 v1.01 cong-measure 的成例):
//   ① 用神 16 例命中数——唯一的外部对照,越高越好;
//   ② 手抄 15 例从格方向 ≥11 不许倒退(A 动了从强,这一项必须盯);
//   ③ 旺衰 53 例 = 41 一动不动(四个开关都不碰 judgeStrength,动了就是改错了地方);
//   ④ 6000 盘:真从率(≤6.5% 的闸)、假从率、**喜用集合变动率**(改动的血域,必须有界);
//   ⑤ 采纳后重跑事件层(tools/backtest-events.mjs),数字进报告。
// 跑法:node tools/yong-measure.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const DATA = JSON.parse(readFileSync(join(ROOT, 'data', 'mingli-cases.json'), 'utf8'));

const HAND = [
  ['戊戌丙辰乙未丙戌', '从弱'], ['壬寅壬寅庚寅戊寅', '从弱'], ['丙寅庚寅壬午乙巳', '从弱'],
  ['丁卯壬寅庚午丙戌', '从弱'], ['辛巳辛丑乙酉乙酉', '从弱'], ['癸卯乙卯甲寅乙亥', '从强'],
  ['丙午甲午丙午甲午', '从强'], ['癸酉癸亥庚申丁亥', '从气'], ['丙戌壬辰癸巳甲寅', '从弱'],
  ['癸酉乙丑丙申丙申', '从弱'],
  ['癸巳乙卯己亥癸酉', '假从'], ['丁丑壬寅丙申壬辰', '假从'], ['乙卯己卯戊辰癸亥', '假从'],
  ['丁卯丙寅辛亥庚寅', '假从'], ['癸亥乙卯己未丁卯', '假从'],
];
const mkP = (four) => {
  const gz = four.replace(/ /g, '').match(/.{2}/g), p = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { p[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  return p;
};
function silingDays(c, monthZhi) {
  const s = c.labels.siling;
  if (!s) return 15;
  if (s.days) return s.days;
  if (s.gan) { let acc = 0; for (const [g, d] of (Bazi.SILING[monthZhi] || [])) { if (g === s.gan) return acc + Math.ceil(d / 2); acc += d; } }
  return 15;
}

// 变体组合:A=出口闸 B=假从改判 C=中和调候门槛 D=制杀
const COMBOS = [
  ['V0 现行', {}],
  ['A 出口闸', { shiOutlet: true }],
  ['B 假从改判', { jiaCongFollow: true }],
  ['C 门槛18', { tiaoGateZhonghe: 18 }],
  ['C∞ 中和恒取调候', { tiaoGateZhonghe: 999 }],
  ['D 制杀', { shaLiangTing: true }],
  ['A+B+D', { shiOutlet: true, jiaCongFollow: true, shaLiangTing: true }],
  ['A+B+C∞+D 全开', { shiOutlet: true, jiaCongFollow: true, tiaoGateZhonghe: 999, shaLiangTing: true }],
];

// 基准喜用集合(V0),供变动率对比
function yongOf(p, days, o) {
  const st = Bazi.judgeStrength(p, p.day.gan, days);
  const cong = Bazi.judgeCong(st, p, p.day.gan, o);
  const th = Bazi.tiaoHou(p.month.zhi, p.day.gan);
  return { st, cong, y: Bazi.pickYongShen(p.day.gan, st, th, cong, o) };
}
const baseXi = [];
for (let i = 0; i < 6000; i++) {
  const d = new Date(1940 + (i * 7) % 86, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30);
  const c = Bazi.chart(d, i % 2 ? '男' : '女', { lon: 116.4 });
  baseXi.push(c.yong.xiWx.slice().sort().join(''));
}

for (const [name, o] of COMBOS) {
  // ① 用神 16 例
  let yn = 0, yhit = 0; const ymiss = [];
  for (const c of DATA.cases) {
    if (!c.labels.yong) continue;
    yn++;
    const p = mkP(c.four);
    const { y } = yongOf(p, silingDays(c, p.month.zhi), o);
    if (y && y.xiWx && y.xiWx.includes(c.labels.yong)) yhit++;
    else ymiss.push(c.id);
  }
  // ② 手抄 15 例方向
  let hh = 0;
  for (const [four, want] of HAND) {
    const p = mkP(four);
    const st = Bazi.judgeStrength(p, p.day.gan, 15);
    const cong = Bazi.judgeCong(st, p, p.day.gan, o);
    if ((want === '不从') === (!cong || !cong.type)) hh++;
  }
  // ③ 旺衰 53
  let bn = 0, bh = 0;
  for (const c of DATA.cases) {
    if (!c.labels.band) continue;
    const p = mkP(c.four);
    const st = Bazi.judgeStrength(p, p.day.gan, silingDays(c, p.month.zhi));
    bn++; if ((st.strong ? '旺' : '弱') === c.labels.band) bh++;
  }
  // ④ 6000 盘血域
  let real = 0, jia = 0, flip = 0, dTrig = 0;
  for (let i = 0; i < 6000; i++) {
    const d = new Date(1940 + (i * 7) % 86, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30);
    const gz = Bazi.chart(d, i % 2 ? '男' : '女', { lon: 116.4 }).pillars;
    const p = {}; ['year', 'month', 'day', 'hour'].forEach(k => { p[k] = { gz: gz[k].gz, gan: gz[k].gan, zhi: gz[k].zhi }; });
    const { cong, y } = yongOf(p, Bazi.daysIntoJie ? Bazi.daysIntoJie(d) : 15, o);
    if (cong && cong.type && cong.type !== '假从') real++;
    else if (cong && cong.type === '假从') jia++;
    if (y.xiWx.slice().sort().join('') !== baseXi[i]) flip++;
    if (o.shaLiangTing && y.xiName && y.xiName.includes('制杀入喜')) dTrig++;
  }
  console.log(`\n【${name}】`);
  console.log(`  用神 16 例:${yhit}/${yn}${ymiss.length ? '(错:' + ymiss.join(' ') + ')' : ''}`);
  console.log(`  手抄从格方向:${hh}/15 ${hh < 11 ? '←倒退!' : ''} · 旺衰:${bh}/${bn} ${bh !== 41 ? '←动了!' : ''}`);
  console.log(`  6000 盘:真从 ${(real / 60).toFixed(2)}% · 假从 ${(jia / 60).toFixed(2)}% · 喜用集合变动 ${(flip / 60).toFixed(2)}%${o.shaLiangTing ? ' · 制杀触发 ' + (dTrig / 60).toFixed(2) + '%' : ''}`);
}
console.log('\n判读:①越高越好;②③是闸,倒退即弃;④变动率是血域,必须有界且能说清动的是谁。');
