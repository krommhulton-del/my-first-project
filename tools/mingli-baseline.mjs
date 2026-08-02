// 命例复现基线(深造期的第一个数):程序对书上命例的判断,与任氏判语对不对得上
// 跑法:node tools/mingli-baseline.mjs
// 规矩:司令天数按月中 15 天近似(命例无生日,系统性近似,照实记);
//      只考有标签的子集;错例逐个列出前十,不许只报命中。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const DATA = JSON.parse(readFileSync(join(ROOT, 'data', 'mingli-cases.json'), 'utf8'));

function mk(four) {
  const gz = four.split(' ');
  const pillars = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { pillars[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  const st = Bazi.judgeStrength(pillars, pillars.day.gan, 15);
  return { pillars, st, cong: Bazi.judgeCong(st, pillars, pillars.day.gan) };
}

// ── 旺衰 ──
let n = 0, hit = 0; const miss = [];
for (const c of DATA.cases) {
  if (!c.labels.band) continue;
  n++;
  const { st } = mk(c.four);
  const got = st.strong ? '旺' : '弱';
  if (got === c.labels.band) hit++;
  else miss.push(`${c.id} ${c.four} 书判「${c.labels.band}」程序「${got}(${st.band},${st.pct}%)」——${c.judgment.slice(0, 40)}`);
}
console.log(`【旺衰】${n} 例带明写标签:复现 ${hit}/${n} = ${(hit / n * 100).toFixed(1)}%`);
for (const m of miss.slice(0, 10)) console.log('  ✗', m);
if (miss.length > 10) console.log(`  …另 ${miss.length - 10} 例错,全录在下面的报告里`);

// ── 从格 ──
let cn = 0, chit = 0; const cmiss = [];
for (const c of DATA.cases) {
  if (!c.labels.cong) continue;
  cn++;
  const { cong } = mk(c.four);
  const gotCong = !!(cong && cong.type);
  const wantCong = c.labels.cong !== '不从';
  if (gotCong === wantCong) chit++;
  else cmiss.push(`${c.id} ${c.four} 书判「${c.labels.cong}」程序「${gotCong ? (cong.type || '从') : '不从'}」`);
}
console.log(`【从格】${cn} 例:方向复现 ${chit}/${cn} = ${(chit / cn * 100).toFixed(1)}%(只考从/不从,不考从哪一路)`);
for (const m of cmiss.slice(0, 8)) console.log('  ✗', m);

// ── 用神五行 ──
let yn = 0, yhit = 0; const ymiss = [];
for (const c of DATA.cases) {
  if (!c.labels.yong) continue;
  yn++;
  const { pillars, st } = mk(c.four);
  const th = Bazi.tiaoHou(pillars.month.zhi, pillars.day.gan);
  const y = Bazi.pickYongShen(pillars.day.gan, st, th);
  if (y && y.xiWx && y.xiWx.includes(c.labels.yong)) yhit++;
  else ymiss.push(`${c.id} ${c.four} 书用「${c.labels.yong}」程序喜「${y && y.xiWx ? y.xiWx.join('') : '?'}」`);
}
console.log(`【用神】${yn} 例书里明写用某行:落在程序喜用集合内 ${yhit}/${yn} = ${(yhit / yn * 100).toFixed(1)}%`);
for (const m of ymiss.slice(0, 8)) console.log('  ✗', m);

console.log('\n口径:司令按月中近似;标签是正则高精度子集;这三个数是**基线**——');
console.log('深造期的目标是把它们抬起来,每次改断法都要重跑这份基线,改前改后都记进报告。');
