// 事件层回测:程序说某人某年该有什么方向,拿真人真事去对。
// node tools/backtest-events.mjs
//
// 这是本项目第一次给「事件层」量数字。宪法第三节说这一层「零外部回测、什么都不许承诺」,
// 今天起改成「有数字,但数字是多少就说多少」。
//
// 口径(先说死,免得数字被误读):
//   · 只考**方向**:这一年这类事,程序判吉还是判凶,与实际是好事还是坏事对不对得上。
//     不考「有没有发生」——语料里只有发生过的事,没有「这一年什么都没发生」的反例,考不了。
//   · 程序方向分 |dir| 低于阈值时算**弃权**,不计入命中率,但弃权率照报。
//   · 时辰不详者(28 人里 20 人),十二时辰各排一盘、方向取平均——这是唯一诚实的处理,
//     因为时辰未知就是未知,挑一个填等于替死人编。
//
// 关键的一条:**必须跑置换检验**。名人语料里好事占六成,「永远猜好事」就能得 60%。
// 所以把「人」和「盘」的对应关系打乱,重算命中率,看真实成绩有没有高出这个零假设分布。
// 高不出去,就说明程序在事件层没有信号——那也要照实公布。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const Dingshi = require(join(ROOT, 'dingshi.js'));
// 计分与统计一律走 yanpan.js——**那是唯一一份**(§四 一个口径一处算)。
// 缘起(v0.82):个人验盘簿要报的是同一件事(表态/弃权/命中/恒猜基线/Fisher),
// 若它另写一套,就会出现「个人验盘说 80%、名人回测说 79.2%」这种谁也说不清的局面。
// 于是把这一份挪进模块,两边跑同一段代码;本文件改前改后的数字必须一位不差。
const Yanpan = require(join(ROOT, 'yanpan.js'));

const DATA = JSON.parse(readFileSync(join(ROOT, 'data', 'backtest-cases.json'), 'utf8'));
// 同一个人、同一年、同一事型,程序只出一个判断——语料里若有两件(如特朗普 2024 两桩官司),
// 算两次等于把同一个预测重复计数,会虚增样本量、也会放大显著性。这里合并成一件:
// 好坏一致就合并,不一致则整条丢弃(方向自相矛盾,考不了)。
const CASES = DATA.cases.map(c => {
  const bucket = new Map();
  for (const e of c.events) {
    const k = e.year + '|' + e.type;
    if (!bucket.has(k)) bucket.set(k, { ...e });
    else {
      const p = bucket.get(k);
      if (p.good !== e.good) p.__drop = true;
      else p.what += ';' + e.what;
    }
  }
  return { ...c, events: [...bucket.values()].filter(e => !e.__drop) };
});
{
  const raw = DATA.cases.reduce((a, c) => a + c.events.length, 0);
  const merged = CASES.reduce((a, c) => a + c.events.length, 0);
  if (raw !== merged) console.log(`(同人同年同事型合并:${raw} 件 → ${merged} 件)`);
}

// —— 出生钟点 → 与本程序口径一致的输入 ——
// bazi.chart 把传入的钟点当北京时钟看待,再按经度折真太阳时。
// 所以外国人的当地钟点要先折成「北京时钟等价值」:北京钟 = 当地钟 - 当地时差 + 480 分。
function chartOf(c, localMinutes) {
  const [y, m, d] = c.birth.split('-').map(Number);
  const beijing = localMinutes - c.tzMin + 480;
  const dt = new Date(y, m - 1, d, 0, 0);
  dt.setMinutes(dt.getMinutes() + beijing);
  return Bazi.chart(dt, c.gender, c.lon);
}
function chartsOf(c) {
  if (c.hourKnown) {
    const [hh, mm] = c.hour.split(':').map(Number);
    return [chartOf(c, hh * 60 + mm)];
  }
  // 时辰不详:十二时辰各排一盘(取每个时辰的中点)
  return Dingshi.HOURS.map(h => chartOf(c, h.h * 60 + h.m));
}

// 某人某年某事型的方向:多盘时取平均
function dirOf(charts, year, type) {
  let s = 0;
  for (const ch of charts) s += Dingshi.yearEv(ch, year, type).dir;
  return s / charts.length;
}

// —— 主评测 ——
// 把语料摊成 yanpan.tally 认得的行:{dir, good, type, ...}
// 留神:名人语料这一份**不走 yanpan 的姻缘恒弃权**——它考的是 v0.77 之前就定下的口径,
// 而 v0.77 之后姻缘的 dir 本来就恒为 0,自然落在门槛以下。两条路殊途同归,但要说清楚。
function rowsOf(chartsList) {
  const rows = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i], ch = chartsList[i];
    for (const e of c.events) rows.push({ i, name: c.name, ...e, dir: dirOf(ch, e.year, e.type) });
  }
  return rows;
}
function score(chartsList, thresh) {
  const t = Yanpan.tally(rowsOf(chartsList), thresh);
  return { hit: t.hit, miss: t.miss, abstain: t.abstain, rate: t.rate, misses: t.misses };
}

const charts = CASES.map(chartsOf);
console.log(`语料:${CASES.length} 人 / ${CASES.reduce((a, c) => a + c.events.length, 0)} 件事;` +
  `有档案级时辰 ${CASES.filter(c => c.hourKnown).length} 人,其余按十二时辰平均\n`);

console.log('【一】不同「敢表态」门槛下的成绩');
console.log('门槛   表态数  弃权数  命中   落空   命中率   恒猜好事的基线');
for (const th of [0.001, 0.5, 1.0, 1.5, 2.0]) {
  const r = score(charts, th);
  // 同一批被表态的事件里,好事占比 = 恒猜好事能得的分
  let g = 0, n = 0;
  for (let i = 0; i < CASES.length; i++) for (const e of CASES[i].events) {
    if (Math.abs(dirOf(charts[i], e.year, e.type)) >= th) { n++; if (e.good) g++; }
  }
  console.log(
    String(th).padStart(5), String(r.hit + r.miss).padStart(7), String(r.abstain).padStart(7),
    String(r.hit).padStart(6), String(r.miss).padStart(6),
    (r.rate === null ? '  —  ' : (r.rate * 100).toFixed(1) + '%').padStart(8),
    (n ? Math.max(g, n - g) / n * 100 : 0).toFixed(1) + '%'.padStart(1));
}

// —— 有没有信号:四格表 + Fisher 精确检验 ——
// 「命中率高」本身说明不了问题:名人语料六成是好事,程序又偏爱判吉,两个偏好一撞就有高命中率。
// 真问题是:程序判吉/判凶,与实际好事/坏事之间**有没有关联**。这是标准的 2×2 关联检验。
// (第一版用「打乱人与盘」做置换,有毛病:孙中山 1884 年的事配到乔布斯盘上年龄是负的,
//  大运根本取不到,那种退化比较不能当零假设。改用四格表 + 标签置换,两者互证。)
function table(chartsList, thresh, idxs) {
  let a = 0, b = 0, c = 0, d = 0;   // a:判吉&好 b:判吉&坏 c:判凶&好 d:判凶&坏
  const rows = [];
  for (const i of idxs) for (const e of CASES[i].events) {
    const dir = dirOf(chartsList[i], e.year, e.type);
    if (Math.abs(dir) < thresh) continue;
    rows.push({ i, e, up: dir > 0 });
    if (dir > 0) (e.good ? a++ : b++); else (e.good ? c++ : d++);
  }
  return { a, b, c, d, rows };
}
const fisher2 = Yanpan.fisher2;        // 双尾 Fisher:只此一份,见 yanpan.js
const ALL = CASES.map((_, i) => i);
console.log('\n【二】程序的吉凶判断,与实际的好坏,到底有没有关联?');
for (const th of [0.001, 0.5, 1.0, 1.5]) {
  const t = table(charts, th, ALL);
  const p = fisher2(t.a, t.b, t.c, t.d);
  const or = (t.a * t.d) / (t.b * t.c || 0.5);
  console.log(`  门槛 ${String(th).padEnd(5)} 判吉中好${String(t.a).padStart(3)}/坏${String(t.b).padStart(3)}  ` +
    `判凶中好${String(t.c).padStart(3)}/坏${String(t.d).padStart(3)}  ` +
    `优势比 ${or.toFixed(2)}  Fisher 双尾 p = ${p.toFixed(4)} ${p < 0.05 ? '★有关联' : '(与无关联区分不开)'}`);
}
// 标签置换互证:把「好事/坏事」标签整体打乱,看真命中率在零假设分布里排第几
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
console.log('\n【二之二】标签置换互证(把 147 件事的好坏标签整体打乱 5000 次)');
for (const th of [0.5, 1.0]) {
  const t = table(charts, th, ALL);
  const labels = t.rows.map(r => r.e.good);
  const realHit = t.rows.filter((r, k) => r.up === labels[k]).length / t.rows.length;
  const rnd = lcg(20260731), nulls = [];
  for (let k = 0; k < 5000; k++) {
    const L = labels.slice();
    for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    nulls.push(t.rows.filter((r, x) => r.up === L[x]).length / t.rows.length);
  }
  nulls.sort((x, y) => x - y);
  const p = (nulls.filter(x => x >= realHit).length + 1) / (nulls.length + 1);
  const mean = nulls.reduce((x, y) => x + y, 0) / nulls.length;
  console.log(`  门槛 ${th}:真 ${(realHit * 100).toFixed(1)}%,打乱后平均 ${(mean * 100).toFixed(1)}%、` +
    `95% 分位 ${(nulls[Math.floor(nulls.length * 0.95)] * 100).toFixed(1)}%,p = ${p.toFixed(4)} ` +
    `${p < 0.05 ? '★有信号' : '(与瞎猜区分不开)'}`);
}

// 上面那个置换把 56 件事当成互相独立的,其实不是:同一个人的几件事共用一副盘,
// 盘偏吉的人他那几件事就一起偏吉。不做分层,显著性会被高估。这里按人分层再检一遍:
// 只在**每个人自己的事件内部**打乱好坏标签(每人好事坏事的件数不变),这是保守得多的零假设。
console.log('\n【二之三】按人分层的置换(只在每人自己的事件内部打乱标签,保守检验)');
for (const th of [0.5, 1.0]) {
  const t = table(charts, th, ALL);
  const byPerson = {};
  t.rows.forEach((r, k) => (byPerson[r.i] = byPerson[r.i] || []).push(k));
  const labels = t.rows.map(r => r.e.good);
  const realHit = t.rows.filter((r, k) => r.up === labels[k]).length / t.rows.length;
  const rnd = lcg(20260731), nulls = [];
  for (let k = 0; k < 5000; k++) {
    const L = labels.slice();
    for (const key of Object.keys(byPerson)) {
      const idx = byPerson[key];
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [L[idx[i]], L[idx[j]]] = [L[idx[j]], L[idx[i]]];
      }
    }
    nulls.push(t.rows.filter((r, x) => r.up === L[x]).length / t.rows.length);
  }
  nulls.sort((x, y) => x - y);
  const p = (nulls.filter(x => x >= realHit).length + 1) / (nulls.length + 1);
  const mean = nulls.reduce((x, y) => x + y, 0) / nulls.length;
  const usable = Object.values(byPerson).filter(v => v.length > 1).length;
  console.log(`  门槛 ${th}:真 ${(realHit * 100).toFixed(1)}%,人内打乱后平均 ${(mean * 100).toFixed(1)}%、` +
    `95% 分位 ${(nulls[Math.floor(nulls.length * 0.95)] * 100).toFixed(1)}%,p = ${p.toFixed(4)} ` +
    `${p < 0.05 ? '★仍有信号' : '(分层后就不显著了)'};` +
    `(有两件以上被表态事件的人:${usable} 位——只有这些人对检验有贡献)`);
}
// 逐人留一:看看成绩是不是被某一个人撑起来的
console.log('\n【二之四】逐人留一(去掉任一人后命中率的变动,门槛 1.0)');
{
  const base = table(charts, 1.0, ALL);
  const baseRate = base.rows.filter(r => r.up === r.e.good).length / base.rows.length;
  const deltas = [];
  for (let i = 0; i < CASES.length; i++) {
    const idxs = ALL.filter(x => x !== i);
    const t = table(charts, 1.0, idxs);
    if (!t.rows.length) continue;
    const r = t.rows.filter(x => x.up === x.e.good).length / t.rows.length;
    deltas.push({ name: CASES[i].name.slice(0, 10), r, d: r - baseRate });
  }
  deltas.sort((a, b) => a.r - b.r);
  console.log(`  全样本 ${(baseRate * 100).toFixed(1)}%;去掉后最低 ${(deltas[0].r * 100).toFixed(1)}%(${deltas[0].name})、` +
    `最高 ${(deltas[deltas.length - 1].r * 100).toFixed(1)}%(${deltas[deltas.length - 1].name});` +
    `区间宽 ${((deltas[deltas.length - 1].r - deltas[0].r) * 100).toFixed(1)} 个百分点`);
}

// —— 分事型、分时辰可靠度 ——
console.log('\n【三】分事型成绩(门槛 1.0)');
const TH = 1.0;
const byCat = {};
for (let i = 0; i < CASES.length; i++) for (const e of CASES[i].events) {
  const d = dirOf(charts[i], e.year, e.type);
  const b = byCat[e.type] || (byCat[e.type] = { hit: 0, miss: 0, ab: 0 });
  if (Math.abs(d) < TH) b.ab++; else ((d > 0) === e.good ? b.hit++ : b.miss++);
}
for (const k of Object.keys(byCat).sort((a, b) => (byCat[b].hit + byCat[b].miss) - (byCat[a].hit + byCat[a].miss))) {
  const b = byCat[k], n = b.hit + b.miss;
  console.log(`  ${k.padEnd(9)} 表态 ${String(n).padStart(3)} 弃权 ${String(b.ab).padStart(3)}  ` +
    `命中率 ${n ? (b.hit / n * 100).toFixed(1) + '%' : '—'}`);
}

console.log('\n【四】有档案级时辰的 8 人单独看(门槛 1.0)');
const idxKnown = CASES.map((c, i) => c.hourKnown ? i : -1).filter(i => i >= 0);
let kh = 0, km = 0, ka = 0;
for (const i of idxKnown) for (const e of CASES[i].events) {
  const d = dirOf(charts[i], e.year, e.type);
  if (Math.abs(d) < TH) ka++; else ((d > 0) === e.good ? kh++ : km++);
}
console.log(`  表态 ${kh + km} 弃权 ${ka} 命中率 ${kh + km ? (kh / (kh + km) * 100).toFixed(1) + '%' : '—'}`);

console.log('\n【五】落空清单(门槛 1.0,全列,不许只报命中)');
for (const m of score(charts, TH).misses) {
  console.log(`  ${m.name.slice(0, 12).padEnd(14)} ${m.year} ${m.type.padEnd(9)} ` +
    `实际${m.good ? '好事' : '坏事'} 程序判${m.dir > 0 ? '吉' : '凶'}(${m.dir})  ${m.what.slice(0, 26)}`);
}
