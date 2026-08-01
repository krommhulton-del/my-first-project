// 调候表补录:把《穷通宝鉴》原文里余下 41 格逐格读定
// 缘起:v0.62 只收了「原文抽取 ∩ 网络整理版」双重印证的 79 格,余 41 格退回粗糙的冬火夏水规则。
// 现在原文在库(data/classics/穷通宝鉴.txt),这 41 格逐格读原文定——但只有原文单一来源,
// 故与前 79 格分开标记(quotes 照存,tier 记明来源层级)。
//
// 取用神的规程(先定死再动手,不许一格一个心情):
//   ① 该月本条里的独断句优先:专用X / 耑用X / 姑用X / X为尊 / X为最 / X火为专 / 非X不(莫) / 喜X为用
//   ② 无独断句则取「先X后Y」「先看X,次取Y」的 X
//   ③ 月末若有「总之…」收束句且与上文不同,以收束句为准(那是原文自己的定论)
//   ④ 该月无月条时,取该季总纲(三春/三夏/三秋/三冬)里的同一规程
//   ⑤ 原文明写「随宜酌用」「非拘执先后」而不指一味的,该格不收——退回粗糙规则,照旧标出处待核
//
// 跑法:node tools/tiaohou-fill.mjs        (只核不写)
//       node tools/tiaohou-fill.mjs --write (核过之后写回 data/tiaohou.json 与 bazi.js)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

// [日主, 月支, 用神, 原文佐证]
const FILL = [
  // ——— 甲木 ———
  ['甲', '寅', '丙', '初春尚有余寒，得丙癸逢，富贵双全。癸藏丙透，名寒木向阳，主大富贵'],
  ['甲', '申', '丁', '丁火为尊，庚金次之，庚金不可少'],
  ['甲', '酉', '丁', '木囚金旺。丁火为先，次用丙火，庚金再次'],
  ['甲', '戌', '丁', '木星凋零，独爱丁火，壬癸滋扶'],
  ['甲', '丑', '丁', '总之腊月甲木，虽有庚金，丁不可少。乏庚略可，乏丁无用'],
  // ——— 乙木 ———
  ['乙', '未', '癸', '总之夏月之乙木，耑用癸水，丙火酌用，庚辛次之'],
  ['乙', '申', '己', '七月喜己土为用，或不见丙癸。己土必不可少'],
  ['乙', '酉', '癸', '在白露之后，桂蕊未开，耑用癸水以滋桂萼'],
  ['乙', '子', '丙', '喜用丙火解冻，则花木有向阳之意，不宜用癸以冻花木，故耑用丙火'],
  // ——— 丙火 ———(十月一格不收:原文作「随宜酌用可也」)
  ['丙', '午', '壬', '五月亦耑用壬。四五月壬透者富贵'],
  ['丙', '未', '壬', '三伏生寒，壬水为用，取庚辅佐'],
  ['丙', '子', '壬', '冬至一阳生，弱中复强，壬水为最，戊土佐之'],
  // ——— 丁火 ———(五月一格不收:原文只并列「用壬者…用甲者…」,不指一味)
  ['丁', '寅', '庚', '非庚不能噼甲，何以引丁，姑用庚金'],
  ['丁', '巳', '甲', '乘旺，虽取甲引丁，必用庚噼甲'],
  ['丁', '酉', '甲', '八月甲丙庚皆用，七八月或无甲木，乙亦可用'],
  ['丁', '戌', '甲', '九月耑用甲庚。大扺甲不离庚，乙不离丙，其理极明'],
  ['丁', '亥', '甲', '三冬丁火，甲木为尊，庚金佐之，癸戊权宜酌用可也'],
  ['丁', '子', '甲', '三冬丁火，甲木为尊，庚金佐之，癸戊权宜酌用可也'],
  ['丁', '丑', '甲', '三冬丁火，甲木为尊，庚金佐之，癸戊权宜酌用可也'],
  // ——— 戊土 ———
  ['戊', '辰', '甲', '三月先甲后丙，癸又次之，因戊土司权故也'],
  ['戊', '午', '壬', '仲夏火炎，先看壬水，次取甲木，丙火酌用，用癸力微'],
  ['戊', '未', '癸', '遇夏干枯，先看癸水，次用丙火甲木'],
  ['戊', '戌', '甲', '当权，不可专用丙，先看甲木，次取癸水'],
  ['戊', '子', '丙', '严寒冰冻，丙火为专，甲木为佐'],
  ['戊', '丑', '丙', '严寒冰冻，丙火为专，甲木为佐'],
  // ——— 己土 ———
  ['己', '申', '癸', '总之，三秋己土，先癸后丙，取辛辅癸'],
  ['己', '酉', '癸', '总之，三秋己土，先癸后丙，取辛辅癸'],
  ['己', '戌', '甲', '九月土盛，宜甲木疏之，余皆酌用'],
  // ——— 庚金 ———
  ['庚', '寅', '丙', '总之，正月庚金，丙甲为上，丁火次之'],
  ['庚', '巳', '壬', '但先壬水，方得中和，故曰群金生夏，喜用勾陈'],
  ['庚', '酉', '丁', '刚锐未退，用丁用甲，丙不可少'],
  ['庚', '亥', '丁', '水冷性寒，非丁莫造，非丙不暖'],
  // ——— 辛金 ———
  ['辛', '卯', '壬', '阳和之际，壬水为尊，见戊己为病'],
  ['辛', '巳', '壬', '时逢首夏，忌丙火之燥烈，喜壬水之洗淘'],
  ['辛', '午', '壬', '己无壬不湿，辛无己不生，故壬己并用'],
  ['辛', '申', '壬', '壬水为尊，甲戊酌用可也，癸水不可为用'],
  ['辛', '子', '丙', '冬月辛金，须丙温暖方妙'],
  // ——— 癸水 ———
  ['癸', '卯', '庚', '专以庚金为用，辛金次之'],
  ['癸', '午', '庚', '至弱无根，必须庚辛为生身之本'],
];

// 原文自身内部有分歧的格子,把分歧当面记下来(不许只报采信的那一边)
const NOTES = {
  乙申: '季总纲作「三秋乙木，金神司令，先丙后癸」,而七月本条作「七月喜己土为用…己土必不可少」。' +
        '依规程①月条独断句优先,取己;通行整理版把丙放在第一位,与原文月条不合,存疑记此。',
  丁亥: '三冬丁火开篇作「耑用庚甲」(庚在前),收束句作「甲木为尊,庚金佐之」(甲在前)。依规程③取收束句。',
  丁子: '同丁亥:开篇「耑用庚甲」与收束「甲木为尊,庚金佐之」互异,依规程③取收束句。',
  丁丑: '同丁亥:开篇「耑用庚甲」与收束「甲木为尊,庚金佐之」互异,依规程③取收束句。',
  甲丑: '本条先作「先用庚噼甲…故丁次之」(庚在前),收束句作「虽有庚金,丁不可少。乏庚略可,乏丁无用」。依规程③取收束句。',
  乙酉: '原文按半月分:白露后「耑用癸水以滋桂萼」,秋分后「却喜向阳,又宜用丙,癸水次之」。' +
        '本表一月一格,取白露后的独断句;交秋分后此格偏丙,程序未细分半月。',
  甲申: 'CLAUDE.md 记的那条已知分歧就是这一格:原文明作「丁火为尊,庚金次之」,网络整理版却把庚当用神。此处照原文取丁。',
};

// 不收的格子,把不收的理由记下来(不许悄悄留空)
const SKIP = {
  丙亥: '原文收束句作「总之十月丙火,木旺宜庚,水旺宜戊,火旺用壬,随宜酌用可也」——原文自己不指一味,依规程⑤不收。',
  丁午: '原文只并列「用壬者,金妻水子。用甲者,水妻木子」,且先有「不宜乱用甲木」一句自相牵制,不指一味,依规程⑤不收。',
};

const raw = readFileSync(join(ROOT, 'data', 'classics', '穷通宝鉴.txt'), 'utf8').replace(/\s/g, '');
const data = JSON.parse(readFileSync(join(ROOT, 'data', 'tiaohou.json'), 'utf8'));

let bad = [];
const seen = new Set();
for (const [gan, zhi, use, quote] of FILL) {
  const key = gan + zhi;
  if (seen.has(key)) bad.push(`${key} 在补录表里重复`);
  seen.add(key);
  if (data.table[gan] && data.table[gan][zhi]) bad.push(`${key} 已在 79 格里,不该重录`);
  if (!raw.includes(quote)) bad.push(`${key} 佐证在原文里搜不到:${quote}`);
  if (!quote.includes(use)) bad.push(`${key} 佐证句里没有用神${use}:${quote}`);
  // 佐证句必须唯一可定位,否则不知道是从哪一月抄来的
  const hits = raw.split(quote).length - 1;
  if (hits > 1) bad.push(`${key} 佐证句在原文里出现 ${hits} 次,定位不唯一:${quote}`);
}
// 补录 + 已有 + 不收,三者加起来必须正好是 120 格
const total = Object.values(data.table).reduce((n, c) => n + Object.keys(c).length, 0)
  + FILL.length + Object.keys(SKIP).length;
if (total !== 120) bad.push(`已有 ${total} 格,不是 120——有格子漏掉或重复了`);

if (bad.length) { console.error('核不过:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`✓ ${FILL.length} 格佐证逐条核过(原文里搜得到、含用神、定位唯一)`);
console.log(`✓ ${Object.keys(data.table).reduce((n, g) => n + Object.keys(data.table[g]).length, 0)} 已有 + ${FILL.length} 补录 + ${Object.keys(SKIP).length} 不收 = 120`);

if (!process.argv.includes('--write')) {
  console.log('\n(只核不写。加 --write 写回 data/tiaohou.json 与 bazi.js)');
  process.exit(0);
}

// ——— 写回 data/tiaohou.json ———
for (const [gan, zhi, use, quote] of FILL) {
  (data.table[gan] ||= {})[zhi] = use;
  data.quotes[gan + (ZHI.indexOf(zhi) + 1)] = quote;
}
// 按地支序重排每个日主的格子,免得补录的都挤在后面
for (const gan of Object.keys(data.table)) {
  const cells = data.table[gan], sorted = {};
  for (const z of ZHI) if (cells[z]) sorted[z] = cells[z];
  data.table[gan] = sorted;
}
data._meta['覆盖'] = '118/120;余 2 格原文自己不指一味(丙亥、丁午),照旧退回粗糙的冬火夏水规则并标出处待核';
data._meta['补录口径'] = 'v0.76 补的 39 格只有原文单一来源(手上没有整理版可对),故按定死的规程逐格读原文:' +
  '①月条独断句(专用/耑用/姑用/为尊/为最/为专/非X不/喜X为用)优先 ②次取先X后Y的X ' +
  '③月末总之收束句与上文不同的以收束句为准 ④该月无月条则取该季总纲 ⑤原文明写随宜酌用的不收';
data._meta['补录分歧'] = NOTES;
data._meta['不收'] = SKIP;
writeFileSync(join(ROOT, 'data', 'tiaohou.json'), JSON.stringify(data, null, 2) + '\n');

// ——— 写回 bazi.js 里的 TIAOHOU 常量(数据文件是出处,常量是副本,两处必须一致) ———
const baziPath = join(ROOT, 'bazi.js');
let bazi = readFileSync(baziPath, 'utf8');
const lines = Object.entries(data.table).map(([gan, cells]) =>
  `    ${gan}: { ${ZHI.filter(z => cells[z]).map(z => `${z}: '${cells[z]}'`).join(', ')} },`);
const block = `  const TIAOHOU = {\n${lines.join('\n')}\n  };`;
const re = /  const TIAOHOU = \{[\s\S]*?\n  \};/;
if (!re.test(bazi)) { console.error('bazi.js 里找不到 TIAOHOU 常量'); process.exit(1); }
bazi = bazi.replace(re, block);
writeFileSync(baziPath, bazi);
console.log('✓ 已写回 data/tiaohou.json 与 bazi.js');
