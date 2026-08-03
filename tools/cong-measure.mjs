// 从格「根」的口径:四个变体先量后改(v1.01,深造期第二次动地基)
//
// 缘起:命例复现基线里「从格 38.2%」挂了三个版本纹丝不动,这一轮查出**那个数本身是错的**——
// 抽标签的正则把否定句(「非前造从强论也」「不能弃命从杀」)、假设句(「倘…谓之从强」)、
// 理论讨论(「旧有从强之说」「乃从旺从弱之理」)全当成了判语,34 例里 30 例是假标签。
// 修完抽取器只剩 4 例,不够作指标。**真正可信的是 v0.76 手抄的 15 例**
// (从象章 10 + 假从章 5,四柱与判语逐字核回原文),那才是这一轮的尺。
//
// 手抄 15 例里当前口径判对 4、错 11,错例集中在一处:
//   **墓库(辰戌丑未)里的中气/余气被当成了日主的根**,于是「无根方可从」这条铁门槛把真从全挡了。
//   而原文从象章的命例恰恰把这些库根当作不算数(CLAUDE.md v0.76 记过:原文自己两边都说过)。
//
// 本工具量四个变体,三项指标一起看(照 v0.96 hua-measure 的成例):
//   ① 手抄 15 例的从格判对数(外部对照,唯一能证明「更准」的一项);
//   ② 6000 盘的真从率(从格是稀有格局,滥了就是错——这是防止「为了对上命例而放水」的闸);
//   ③ 旺衰基线 41/53 不许倒退(改的是从格口径,旺衰不该动;动了就是改错了地方)。
// 跑法:node tools/cong-measure.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));

// ── 手抄金标准:从象章 10 例 + 假从章 5 例(与 tools/cong-check.mjs 同源,四柱与判语核回原文)──
const HAND = [
  ['戊戌丙辰乙未丙戌', '从弱'], ['壬寅壬寅庚寅戊寅', '从弱'], ['丙寅庚寅壬午乙巳', '从弱'],
  ['丁卯壬寅庚午丙戌', '从弱'], ['辛巳辛丑乙酉乙酉', '从弱'], ['癸卯乙卯甲寅乙亥', '从强'],
  ['丙午甲午丙午甲午', '从强'], ['癸酉癸亥庚申丁亥', '从气'], ['丙戌壬辰癸巳甲寅', '从弱'],
  ['癸酉乙丑丙申丙申', '从弱'],
  ['癸巳乙卯己亥癸酉', '假从'], ['丁丑壬寅丙申壬辰', '假从'], ['乙卯己卯戊辰癸亥', '假从'],
  ['丁卯丙寅辛亥庚寅', '假从'], ['癸亥乙卯己未丁卯', '假从'],
];

const mk = (four) => {
  const gz = four.match(/.{2}/g), p = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { p[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  return p;
};

const MODES = [
  ['V0 现行', 'any', '任何藏干与日主同五行都算根(含墓库余气)'],
  ['V1 库余不算', 'nolib', '墓库(辰戌丑未)里的中气/余气不算根,本气照算'],
  ['V2 只本气', 'ben', '只有地支本气与日主同五行才算根'],
  ['V3 本气+禄刃长生', 'lu', '本气根,或落在日主的长生/禄/刃之位'],
];

for (const [name, mode, desc] of MODES) {
  // 手抄 15 例
  let hit = 0; const miss = [];
  for (const [four, want] of HAND) {
    const p = mk(four);
    const st = Bazi.judgeStrength(p, p.day.gan, 15, { congRoot: mode });
    const cong = Bazi.judgeCong(st, p, p.day.gan, { congRoot: mode });
    const got = cong ? cong.type : '不从';
    // 口径:原文的「假从」仍然是从(CLAUDE.md 记过:我们的假从与原文含义相反),
    // 所以只考「从/不从」这个方向,不考从哪一路。
    const okk = (want === '不从') === (got === '不从');
    if (okk) hit++; else miss.push(`${four} 书「${want}」程序「${got}」`);
  }
  // 6000 盘真从率
  let real = 0, jia = 0, n = 0;
  for (let i = 0; i < 6000; i++) {
    const d = new Date(1940 + (i * 7) % 86, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30);
    const c = Bazi.chart(d, i % 2 ? '男' : '女', { lon: 116.4, congRoot: mode });
    n++;
    if (c.cong && c.cong.type && c.cong.type !== '假从') real++;
    else if (c.cong && c.cong.type === '假从') jia++;
  }
  // 旺衰基线(改的是从格口径,这一项必须一动不动)
  const DATA = JSON.parse(readFileSync(join(ROOT, 'data', 'mingli-cases.json'), 'utf8'));
  let bn = 0, bh = 0;
  for (const c of DATA.cases) {
    if (!c.labels.band) continue;
    const p = mk(c.four.replace(/ /g, ''));
    const st = Bazi.judgeStrength(p, p.day.gan, 15, { congRoot: mode });
    bn++; if ((st.strong ? '旺' : '弱') === c.labels.band) bh++;
  }
  console.log(`\n【${name}】${desc}`);
  console.log(`  手抄 15 例从格方向:${hit}/15 = ${(hit / 15 * 100).toFixed(1)}%`);
  console.log(`  6000 盘:真从 ${(real / n * 100).toFixed(2)}% · 假从 ${(jia / n * 100).toFixed(2)}%`);
  console.log(`  旺衰基线:${bh}/${bn}(改从格口径,这一项该一动不动)`);
  for (const m of miss.slice(0, 6)) console.log('    ✗', m);
  if (miss.length > 6) console.log(`    …另 ${miss.length - 6} 例`);
}
console.log('\n判读口径:①手抄那一项越高越好(唯一的外部对照);②真从率是闸——从格是稀有格局,');
console.log('滥到两位数就是放水;③旺衰基线倒退说明改错了地方(从格口径不该碰旺衰)。');
