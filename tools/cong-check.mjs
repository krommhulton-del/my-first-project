// 从格复核:拿《滴天髓阐微》「从象」「假从」两章的命例,逐盘回对 v0.54 那套双向称量的门槛
// 缘起:CLAUDE.md 待办第 5 条——「从格:拿《滴天髓阐微》的 28 处从格论述,逐条复核 v0.54 那套双向称量的门槛」。
//
// 这是一套 **外部对照测试**:命例与判语都是原文里的,不是我自己编的口径。
// 十五盘全部逐字抄自 data/classics/滴天髓阐微.txt(抄完有校验:四柱串必须在原文里搜得到)。
// 跑法:node tools/cong-check.mjs
import Bazi from '../bazi.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// [四柱, 原文断语里的从法, 原文里那句判语]
export const CASES = [
  // ——— 十二、从象(真从) ———
  ['戊戌丙辰乙未丙戌', '从弱', '四柱皆财，其势必从'],
  ['壬寅壬寅庚寅戊寅', '从弱', '引通庚金，生扶嫩木而从财也'],
  ['丙寅庚寅壬午乙巳', '从弱', '一点庚金临绝，丙火力能锻之，从财格真'],
  ['丁卯壬寅庚午丙戌', '从弱', '财生杀旺，绝无一毫生扶之意'],
  ['辛巳辛丑乙酉乙酉', '从弱', '支全金局，干透两辛，从杀斯真'],
  ['癸卯乙卯甲寅乙亥', '从强', '癸之印旺之极矣，从其旺神'],
  ['丙午甲午丙午甲午', '从强', '四柱皆刃，天干并透甲丙，强旺极矣，可顺而不可逆也'],
  ['癸酉癸亥庚申丁亥', '从气', '局中气势金水，亦是从金水而论，丁反为病'],
  ['丙戌壬辰癸巳甲寅', '从弱', '日主休囚无根，惟官星当令，须从官星之势'],
  ['癸酉乙丑丙申丙申', '从弱', '丙火生丑临申，衰绝无气，酉丑拱金'],
  // ——— 十四、假从 ———
  ['癸巳乙卯己亥癸酉', '假从', '格成弃命从杀。第卯酉冲杀，巳酉半会金局，不作真从而论'],
  ['丁丑壬寅丙申壬辰', '假从', '嫩木逢金，紧贴相冲，运根拔尽，申金又辰土生扶，杀势愈旺，格成从杀'],
  ['乙卯己卯戊辰癸亥', '假从', '四柱绝无金气。又得亥时，水旺生木，又无火以生化之，格取从官，非身衰论也'],
  ['丁卯丙寅辛亥庚寅', '假从', '地支寅木当令，日时寅亥化木，格取从杀'],
  ['癸亥乙卯己未丁卯', '假从', '春木当令会局，时干丁火，被年上癸水克去，未土又会木局，不得不从杀矣'],
];

function mk(four, days = 15) {
  const gz = four.match(/.{2}/g);
  const pillars = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { pillars[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  const st = Bazi.judgeStrength(pillars, pillars.day.gan, days);
  return { pillars, st, cong: Bazi.judgeCong(st, pillars, pillars.day.gan) };
}

if (process.argv[1] && process.argv[1].endsWith('cong-check.mjs')) run();

function run() {
// ——— 抄录校验:四柱必须真在原文里 ———
// 原文把年月日时分四行排、时柱后面紧跟第一步大运,抹掉换行后四柱正好连成八个字,可直接搜。
const raw = readFileSync(join(ROOT, 'data', 'classics', '滴天髓阐微.txt'), 'utf8').replace(/\s/g, '');
let bad = [];
for (const [four, , quote] of CASES) {
  if (!raw.includes(four)) bad.push(`${four} 在原文里搜不到这一盘`);
  if (!raw.includes(quote.replace(/\s/g, ''))) bad.push(`${four} 的判语在原文里搜不到:${quote}`);
}
if (bad.length) { console.error('抄录校验没过:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`✓ 十五盘四柱与判语逐条在《滴天髓阐微》原文里核过\n`);

// ——— 逐盘回对 ———
const W = s => String(s).padEnd(10, ' ');
let hit = 0, miss = [];
console.log('四柱          原文    程序    同党  异党  印   有根  得令');
for (const [four, want, quote] of CASES) {
  const { st, cong } = mk(four);
  const got = cong ? cong.type : '不从(' + st.band + ')';
  // 原文的「从气」我们没有这一格,「假从」原文当从、程序当不从——两者都记为差异,不算命中
  const okCase = (want === '从弱' || want === '从强') && got === want;
  if (okCase) hit++; else miss.push([four, want, got, quote]);
  console.log(`${four}  ${W(want).slice(0, 6)}  ${W(got).slice(0, 8)}` +
    `${String(st.tong).padStart(5)}${String(st.yi).padStart(6)}${String(st.yinPower).padStart(5)}` +
    `${st.hasRoot ? '  有  ' : '  无  '}${st.deLing}`);
}
console.log(`\n真从十盘里程序判对 ${hit} 盘`);
if (miss.length) {
  console.log('\n对不上的:');
  for (const [four, want, got, quote] of miss) console.log(`  ${four} 原文「${want}」程序「${got}」  ——${quote}`);
}
}
