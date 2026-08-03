// 断语体检员 专项内测(**内部一致性测试**,不是外部对照)
//
// 说清楚这套测试能证明什么、不能证明什么:
//   能证明——机器认得出空话、说教、术语、花钱消灾、与程序数据打架这几类;词表只有一份;
//            提示词里的禁令与检查器取的是同一份表。
//   **不能证明**——「解读断得准不准」。那是事件层的事,靠回测,不靠数词。
//
// 缘起(CLAUDE.md 待办第 8 条):本程序有一半的字是模型写的,而铁律一到八管的正是这些字,
// 可在此之前**没有任何一处在出稿之后回查过**。更麻烦的是同一类禁词散在九处以上、内容还互不相同
// (index.html 两份、yunshi.html 一份、六个测试各一份),于是「什么算空话」有九个互相冲突的答案。
import { createRequire } from 'node:module';
import Tijian from '../tijian.js';
const require = createRequire(import.meta.url);
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

// 一段合格的稿子:结论在前、有数字、有日子、有能照着做的动作
const GOOD = '这事七成能成,落在2026年3月上旬。3月5日之前把合同递上去,别拖过清明。' +
  '眼下三件事:先找那位姓王的中间人开口,再把报价压到18万以内,月底前把材料补齐。忌往西边跑,少接熟人的合伙局。';

console.log('【一】认得出铁律级的毛病');
for (const [name, text, kind] of [
  ['空话', '这一年机遇与挑战并存,顺其自然就好。' + GOOD, '空话'],
  ['说教', '你要明白,与其纠结不如放下执念。' + GOOD, '说教'],
  ['花钱消灾', '可以请一尊开光的貔貅化解。' + GOOD, '花钱消灾'],
  ['术语', '用神受克、喜忌翻转,日主偏弱。' + GOOD, '术语'],
  ['模棱', '不好说,建议你自己再想想。' + GOOD, '模棱'],
]) t(`${name}:一出现就判废稿`, () => {
  const r = Tijian.check(text);
  ok(!r.pass, `${name} 没被逮住:${r.summary}`);
  ok(r.fatal.some(h => h.kind === kind), `该判「${kind}」,实得 ${[...new Set(r.fatal.map(h => h.kind))].join('、')}`);
});

t('干净的稿子要判过,不许乱抓', () => {
  const r = Tijian.check(GOOD);
  ok(r.pass, '好稿被判废:' + JSON.stringify(r.hits.slice(0, 4)));
  eq(r.score, 100, '好稿应满分');
});

console.log('【二】不许误伤:引文、书名、专业区');
t('「」里的引文与《》书名里的术语不算泄漏', () => {
  const q = '书上原话:「用神受制，事必不成」——搁你这儿就是那条路今年走不通,10月前别动,先谈后签,少接熟人的局。';
  const r = Tijian.check(q);
  ok(r.pass, '引文被当成术语泄漏了:' + JSON.stringify(r.fatal));
});
t('专业区放行术语,断语区不放行', () => {
  const s = '日主偏弱,喜忌如上。' + GOOD;
  ok(!Tijian.check(s, { zone: '断语' }).pass, '断语区该拦住术语');
  ok(Tijian.check(s, { zone: '专业' }).pass, '专业区不该拦术语:' + Tijian.check(s, { zone: '专业' }).summary);
});
t('长词命中后短词不重复计:「保持平常心」只算一处,不算两处', () => {
  const r = Tijian.check('保持平常心。' + GOOD);
  const kong = r.hits.filter(h => h.kind === '空话');
  eq(kong.length, 1, '同一处空话被算了 ' + kong.length + ' 遍:' + kong.map(h => h.snippet).join('/'));
});

console.log('【三】与程序算死的数据打架,要判得出来');
t('程序说成、稿子说不成 → 矛盾', () => {
  const r = Tijian.check('这事成不了,别耗了。这条路今年走不通。', { facts: { cheng: '成' } });
  ok(r.fatal.some(h => h.rule === '成算'), '没逮住成算矛盾:' + r.summary);
});
t('「这事成不了」不许同时算成正面(第一版就栽在这)', () => {
  // 缘起:CHENG_POS 里的「这事成」把「这事成不了」也吃了,正反抵消,矛盾稿被判干净。
  const r = Tijian.check('这事成不了。', { facts: { cheng: '成' } });
  ok(!r.pass, '正反两组仍在互相抵消');
});
t('几成对不上 → 矛盾;对得上 → 放行', () => {
  ok(Tijian.check('这事三成把握。' + GOOD, { facts: { pct: '八九成' } }).fatal.some(h => h.rule === '几成'), '差五成没逮住');
  ok(!Tijian.check('这事七成能成。' + GOOD, { facts: { pct: '七成上下' } }).fatal.some(h => h.rule === '几成'), '对得上的不该报错');
});
t('把程序算作耗你的五行说成旺你的 → 矛盾', () => {
  const r = Tijian.check('旺你的是火,穿红的往南走。' + GOOD, { facts: { jiWx: ['火', '土'] } });
  ok(r.fatal.some(h => h.rule === '喜忌'), '喜忌反了没逮住:' + r.summary);
});
t('姻缘方向留白时,稿子不许自己补一个吉凶(v0.77 的连锁)', () => {
  const r = Tijian.check('2026年感情大吉,必成好事。' + GOOD, { facts: { held: true } });
  ok(r.fatal.some(h => h.rule === '方向留白'), '模型自己补吉凶没被逮住:' + r.summary);
  ok(Tijian.check('2026年感情上动得最重,单身的多半往结合走,有伴的多半是摩擦。' + GOOD, { facts: { held: true } }).pass,
    '照实写两条路的稿子不该被判错');
});
t('判不了的照实列出来,不许装作查过', () => {
  const r = Tijian.check(GOOD, { facts: { cheng: '成' } });
  ok(r.undecidable.length >= 2, '应当列出判不了的几类');
  ok(r.undecidable.join('').includes('机器'), '判不了的要说清为什么判不了');
});

console.log('【四】具体度:空洞但没禁词的稿子也要被拦下');
t('通篇正确的废话,一个禁词没有,照样不算合格', () => {
  const air = '这一段时间你的运势会有一些起伏,做事的时候多留意周围的人和事,把节奏放缓一点,' +
    '该来的总会来。工作上会有变化,感情上也会有波动,财务方面要注意一下,身体也要多关照。' +
    '整体而言这段日子是过渡期,过去了自然就好了。';
  const r = Tijian.check(air);
  ok(r.hits.some(h => h.kind === '不具体'), '空洞稿没被扣分:' + r.summary);
  ok(r.score < 100, '空洞稿不该满分');
});
t('数字按「一个数」计,不按「一个字」计(第一版就栽在这)', () => {
  // 缘起:RE_NUM 原先按字数,'2026' 算四个数,一句「2026年」就凑够具体度,门槛形同虚设。
  const one = Tijian.check('2026年怎样怎样,再说说别的,凑够字数以便触发具体度这一层的检查,随便写点什么。');
  ok(one.stats.nums <= 3, '一句「2026年」不该刷出 ' + one.stats.nums + ' 个数字');
});

console.log('【五】一个口径一处算:词表只此一份');
t('提示词里的禁令句由模块生成,与检查器取同一份表', () => {
  const line = Tijian.banLine(['空话']);
  for (const w of ['机遇与挑战并存', '顺其自然', '静观其变']) ok(line.includes(w), '禁令句里缺:' + w);
  // 生成出来的禁令句,拿回检查器自己查,每个词都该被认出来
  for (const w of Tijian.RULES['空话'].words) {
    ok(!Tijian.check(w + '。' + GOOD).pass, `词表里有「${w}」,检查器却认不出来`);
  }
});
t('测试里不许再各写各的空话正则——一律从 tijian.js 取', () => {
  // 缘起:实测同一类禁词散在九处以上、内容互不相同。这条钉住:测试目录里
  // 凡出现「机遇与挑战」这个词的文件,必须同时 import 了 tijian.js(即它取的是权威表)。
  const bad = [];
  for (const f of readdirSync(join(ROOT, 'tests'))) {
    if (!f.endsWith('.mjs')) continue;
    const txt = readFileSync(join(ROOT, 'tests', f), 'utf8');
    if (!/机遇与挑战/.test(txt)) continue;
    if (!/tijian\.js/.test(txt)) bad.push(f);
  }
  ok(!bad.length, '这些测试还在自写空话表,没接上唯一出处:' + bad.join('、'));
});
t('铁律级与警告级分得清,分数算得对', () => {
  eq(Tijian.FATAL.includes('空话'), true);
  eq(Tijian.FATAL.includes('铺垫'), false, '铺垫是扣分不是废稿');
  const r = Tijian.check('顺其自然。' + GOOD);
  eq(r.score, 88, '一条铁律级应扣 12 分');
});

console.log('【AI 腔的度量(v1.06,队列 26 第二期点名的那条)】');
t('并列清单打高分、因果链打低分——尺子本身分得开', () => {
  const list = '今年明面和底下两股力都向着你。今年明面上主要是才华。底下暗中走的是钱财。这一年与大运顶上了。';
  const chain = '2027年这一年偏顺,重点在才华与投资。之所以是这个定性,是因为当值的两股力明面与底下都向着你,' +
    '所以顺得比较整齐;而你正走的大运底下那一层也是帮你的,该办的大事往这一年靠最划算。' +
    '一年之内并不平均:十月动得最重,冬月最静。这一年该做的是把手艺变成作品交出去。';
  const a = Tijian.aiFlavor(list), b = Tijian.aiFlavor(chain);
  ok(a.index > b.index + 15, `尺子分不开:清单 ${a.index} vs 因果链 ${b.index}`);
  ok(!a.hasChain && b.hasChain, '因果链那一段该认出承接连词');
  console.log(`      (清单 ${a.index}「${a.verdict}」 vs 因果链 ${b.index}「${b.verdict}」)`);
});
t('太短的不量(不许拿一句话的样本下结论);同一段量两次结果一样', () => {
  ok(Tijian.aiFlavor('今天顺').index === 0, '太短的该直接不量');
  const x = '2027年这一年偏顺,因为两股力都帮你,所以该办的事往这一年靠;十月最重。';
  ok(JSON.stringify(Tijian.aiFlavor(x)) === JSON.stringify(Tijian.aiFlavor(x)), '同一段两次量不一致');
});
t('各板块程序生成的话:AI 腔指数不许回到「重」那一档(逐条量,不是拼在一起量)', () => {
  // **量法要公平**:把十几条独立条目拼成一大段再量,当然「通篇没有承接连词」——
  // 那是拼接的假象。按条目单独量才是公平的单位。头一版就栽在这,差点为了指标
  // 在不相干的条目之间硬加连词——那正是 v0.99 查出过的假因果。
  //
  // **这是方向盘不是靶子**:门槛设在能抓住真回流的地方(板块均值 ≤60、三块回炉过的叙事 ≤35),
  // 不逐分去追。为了刷分数硬塞连词,比并列短句更糟。
  const Bazi = require('../bazi.js'), Mingpan = require('../mingpan.js'), Mingge = require('../mingge.js');
  const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), '女', { lon: 116.4 });
  const mp = Mingpan.read(c, { age: 36 }), mg = Mingge.read(c, { age: 36 });
  const avg = arr => { const xs = arr.filter(x => x && x.length >= 40).map(x => Tijian.aiFlavor(x).index);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; };
  const boards = {
    '命盘·组合': avg(mp.combos.map(x => x.plain)),
    '命盘·六亲': avg(mp.kin.map(x => x.plain)),
    '命盘·大运': avg(mp.dayun.steps.map(x => x.plain)),
    '命盘·性格': avg([mp.personality]),
    '命格·钱路': avg(mg.money.map(x => x.plain)),
    '命格·六路': avg(mg.roads.flatMap(x => x.ev.map(e => e.plain))),
  };
  for (const [k, v] of Object.entries(boards)) ok(v <= 60, `${k} 的 AI 腔指数 ${v.toFixed(0)} 回到「重」那一档了`);
  // 三块回炉过的叙事是本项目的样板,不许退回去
  ok(Tijian.aiFlavor(mp.story).index <= 35, '命盘骨架的叙事退化了:' + Tijian.aiFlavor(mp.story).index);
  ok(Tijian.aiFlavor(mg.story).index <= 35, '命格叙事退化了:' + Tijian.aiFlavor(mg.story).index);
  console.log('      (' + Object.entries(boards).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' · ') + ')');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
