// 内测:八字排盘与运势推断(node tests/yunshi.test.mjs)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Bazi = require('../bazi.js');
const Yunshi = require('../yunshi.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】十神与时柱');
t('十神对照:甲日见各干', () => {
  eq(Bazi.shiShen('甲', '甲'), '比肩');
  eq(Bazi.shiShen('甲', '乙'), '劫财');
  eq(Bazi.shiShen('甲', '丙'), '食神');
  eq(Bazi.shiShen('甲', '丁'), '伤官');
  eq(Bazi.shiShen('甲', '戊'), '偏财');
  eq(Bazi.shiShen('甲', '己'), '正财');
  eq(Bazi.shiShen('甲', '庚'), '七杀');
  eq(Bazi.shiShen('甲', '辛'), '正官');
  eq(Bazi.shiShen('甲', '壬'), '偏印');
  eq(Bazi.shiShen('甲', '癸'), '正印');
});
t('五鼠遁时柱:甲日子时甲子,戊日子时壬子,乙日午时壬午', () => {
  eq(Bazi.hourPillar('甲', 0), '甲子');
  eq(Bazi.hourPillar('戊', 0), '壬子'); // 戊癸起壬子
  eq(Bazi.hourPillar('丙', 0), '戊子'); // 丙辛起戊子
  eq(Bazi.hourPillar('乙', 6), '壬午'); // 乙庚起丙子,午为第7支
  eq(Bazi.hourPillar('癸', 11), '癸亥'); // 戊癸起壬子,亥为第12支
});

console.log('【二】四柱排盘');
t('四柱齐全、日主与五行、藏干、十神标注', () => {
  const c = Bazi.chart(new Date('1990-06-15T10:30:00'), '男');
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = c.pillars[k];
    ok(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(p.gz), k + ' 干支合法:' + p.gz);
    ok(p.ganWx && p.zhiWx, k + ' 五行');
    ok(Array.isArray(p.cang) && p.cang.length >= 1, k + ' 藏干');
  }
  eq(c.pillars.day.ganShen, '日主');
  eq(c.dayGan, c.pillars.day.gz[0]);
  ok(['木', '火', '土', '金', '水'].includes(c.dayWx));
});
t('时柱随出生时辰变化(子时 vs 午时不同)', () => {
  const a = Bazi.chart(new Date('2000-03-10T00:30:00'), '男'); // 子时
  const b = Bazi.chart(new Date('2000-03-10T12:30:00'), '男'); // 午时
  eq(a.pillars.day.gz, b.pillars.day.gz, '同日日柱应相同');
  ok(a.pillars.hour.gz !== b.pillars.hour.gz, '不同时辰时柱应不同');
  eq(a.pillars.hour.zhi, '子'); eq(b.pillars.hour.zhi, '午');
});

console.log('【三】身强身弱与喜用忌');
t('身强身弱判定自洽:强喜耗泄、弱喜生扶', () => {
  const c = Bazi.chart(new Date('1985-11-20T14:00:00'), '女');
  ok(typeof c.strength.strong === 'boolean');
  ok(c.strength.pct >= 0 && c.strength.pct <= 100, '强度百分比');
  const me = c.dayWx;
  const sheng = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const inv = el => Object.keys(sheng).find(a => sheng[a] === el);
  if (c.strength.strong) {
    // 强:喜神应含"我生/我克/克我",忌神应含比劫印(me + 生我)
    ok(c.yong.jiWx.includes(me), '身强忌比劫(含日主五行)');
    ok(!c.yong.xiWx.includes(me), '身强喜神不含日主五行');
  } else {
    ok(c.yong.xiWx.includes(me), '身弱喜比劫(含日主五行)');
    ok(c.yong.xiWx.includes(inv(me)), '身弱喜印(生我五行)');
  }
});
t('喜忌五行不重叠且各非空', () => {
  for (const d of ['1970-01-01T08:00:00', '1995-07-07T22:00:00', '2008-08-08T20:08:00']) {
    const c = Bazi.chart(new Date(d), '男');
    ok(c.yong.xiWx.length && c.yong.jiWx.length, d + ' 喜忌非空');
    ok(!c.yong.xiWx.some(w => c.yong.jiWx.includes(w)), d + ' 喜忌不重叠');
  }
});
t('大运:方向由年干阴阳与性别定,八步、起运岁合理', () => {
  const c = Bazi.chart(new Date('1990-06-15T10:30:00'), '男');
  eq(c.dayun.list.length, 8);
  ok(c.dayun.startAge >= 1 && c.dayun.startAge <= 10, '起运岁 1-10:' + c.dayun.startAge);
  ok(typeof c.dayun.forward === 'boolean');
  // 每步为合法两字干支
  const GZ = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;
  for (const d of c.dayun.list) ok(GZ.test(d.gz), d.gz);
});

console.log('【四】运势推断(大白话)');
t('日月年运三卡齐全、含领域与等级、白话无术语堆砌', () => {
  const c = Bazi.chart(new Date('1990-06-15T10:30:00'), '男');
  const y = Yunshi.all(c, new Date('2026-07-07T12:00:00'));
  for (const k of ['year', 'month', 'day']) {
    const card = y[k];
    ok(card.gz && card.level && card.area, k + ' 卡片要素');
    ok(['大吉', '吉', '平顺', '小凶', '凶'].includes(card.level), k + ' 等级:' + card.level);
    ok(card.text.length >= 20, k + ' 白话正文');
    ok(['财星', '官杀', '印星', '比劫', '食伤'].includes(card.cls), k + ' 十神领域');
  }
});
t('喜用之干支运势为正、忌神之干支为负(方向自洽)', () => {
  const c = Bazi.chart(new Date('1990-06-15T10:30:00'), '男');
  const xi = c.yong.xiWx, ji = c.yong.jiWx;
  // 构造纯喜神干支与纯忌神干支各一,验证打分方向
  const GAN_OF = { 木: '甲', 火: '丙', 土: '戊', 金: '庚', 水: '壬' };
  const ZHI_OF = { 木: '寅', 火: '午', 土: '辰', 金: '申', 水: '子' };
  const sXi = Yunshi.scoreGZ(c, GAN_OF[xi[0]], ZHI_OF[xi[0]]);
  const sJi = Yunshi.scoreGZ(c, GAN_OF[ji[0]], ZHI_OF[ji[0]]);
  ok(sXi.score > 0, '纯喜神应为正分:' + sXi.score);
  ok(sJi.score < 0, '纯忌神应为负分:' + sJi.score);
});
t('年运带大运背景、流日随日期变化', () => {
  const c = Bazi.chart(new Date('1990-06-15T10:30:00'), '男');
  const n = Yunshi.nianYun(c, new Date('2026-07-07T12:00:00'));
  ok(n.dayun && /大运/.test(n.dayun), '年运应含所处大运');
  const d1 = Yunshi.riYun(c, new Date('2026-07-07T12:00:00')).gz;
  const d2 = Yunshi.riYun(c, new Date('2026-07-08T12:00:00')).gz;
  ok(d1 !== d2, '相邻两日流日干支应不同');
});


console.log('【禁术语】运势卡写给人看的部分,不许出现干支十神这些名目');
{
  // 缘起:2026-08 用户反馈「月运还有运那里做的有点让人看不懂」。
  // 查出正文写着「乙未月的天地是『乙未』(木土)」(同义反复)、
  // 依据写着「干支拆解:天干乙(木)帮你、地支未(土)拆台」「十神两层:天干比肩…」——全是术语,违反铁律八。
  // 这条钉住:text 与 lines 里一个术语都不许有(干支两字可以出现在角标,那是凭据,不在这两处)。
  const BAN = /天干|地支|干支|十神|比肩|劫财|食神|伤官|正财|偏财|正官|七杀|正印|偏印|喜忌|旺衰|调候|动宫|伏吟|天克地冲|岁运|支藏|日主|日柱|月令/;
  let bad = [];
  for (const [d, g] of [[new Date(1990, 4, 20, 9, 30), '男'], [new Date(1985, 10, 3, 17, 30), '女'], [new Date(1975, 0, 8, 3, 30), '男']]) {
    const c = Bazi.chart(d, g, 116.4);
    for (const day of [new Date(2026, 0, 15), new Date(2026, 6, 31), new Date(2027, 4, 2)]) {
      const y = Yunshi.all(c, day);
      for (const k of ['day', 'month', 'year']) {
        const cd = y[k];
        if (BAN.test(cd.text)) bad.push(`${k}.text: ${cd.text}`);
        for (const l of cd.lines || []) if (BAN.test(l)) bad.push(`${k}.lines: ${l}`);
      }
    }
  }
  t('三卡的正文与依据里没有术语', () => ok(!bad.length, '这些话带着术语:\n      ' + [...new Set(bad)].slice(0, 8).join('\n      ')));
  t('正文不再是「××的天地是××」这种同义反复', () => {
    const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), '男', 116.4);
    const y = Yunshi.all(c, new Date(2026, 6, 31));
    for (const k of ['day', 'month', 'year']) ok(!/的天地是/.test(y[k].text), k + ' 仍是同义反复:' + y[k].text);
  });
}

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
