// 内测:八字排盘与运势推断(node tests/yunshi.test.mjs)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const Tijian = createRequire(import.meta.url)('../tijian.js');
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

console.log('【日运】不许含糊、不许像流水账(v0.86,用户 08-02 报)');
// 缘起:用户说「运势日运之类的不能含糊,不能搞的好像流水帐一样」。先量,量出三个数:
//   · 同一人连续 60 天,断语**从来不落到时间上**(「落到时间」的处数 0.00);
//   · 同一天 12 副盘只有 5 种说法(区分度 41.7%)——正好等于开头那句的五种可能;
//   · 平均 64 字、数字 1.00 个。
// 病根:开头那一句只有五种(明面帮/压 × 底下帮/压 + 不偏不倚),而人第一眼看的就是它;
// 而**时辰吉凶本来就算好了,却只在吉日板块渲染,从没进过日运的话里**。
// 修法:接 Bazi.jiShi(§四 只取用不重造),并让第一句就是「主哪一摊 + 该挑哪几个时辰」(铁律二)。
t('日运必须落到时辰上——这是那次量出来 0.00 的那一项', () => {
  const cs = [];
  for (let y = 1980; y <= 2000; y += 4) for (const g of ['男', '女']) cs.push(Bazi.chart(new Date(y, 5, 15, 10, 30), g, 116.4));
  let n = 0, withHour = 0, tim = 0;
  for (const c of cs) for (let d = 0; d < 10; d++) {
    const r = Yunshi.riYun(c, new Date(2026, 7, 2 + d));
    n++;
    if (r.hour) withHour++;
    if (/时\(\d+-\d+点\)/.test(r.text) || /没有.*拔尖|没有非避不可/.test(r.text)) tim++;
  }
  eq(withHour, n, '每一条日运都该带时辰这一层');
  ok(tim / n > 0.95, `只有 ${(tim / n * 100).toFixed(1)}% 的日运把时辰写进了断语`);
});
t('月运年运不谈时辰——那个尺度上没有时辰这回事', () => {
  const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), '男', 120.15);
  ok(!Yunshi.yueYun(c, new Date(2026, 7, 2)).hour, '月运不该有时辰层');
  ok(!Yunshi.nianYun(c, new Date(2026, 7, 2)).hour, '年运不该有时辰层');
});
t('第一句就是具体答案,不是「今天整体如何」(铁律二)', () => {
  const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), '男', 120.15);
  for (let d = 0; d < 12; d++) {
    const t0 = Yunshi.riYun(c, new Date(2026, 7, 2 + d)).text;
    const first = t0.split('。')[0];
    ok(/重点在.+/.test(first), '第一句要说清今天重点在哪一类事:' + first);
    ok(!/^今天整体/.test(t0), '不许拿「今天整体如何」开头——那句只有五种说法:' + first);
  }
});
t('具体度必须比改之前高一大截(拿体检员的机械打分核)', () => {
  const cs = [];
  for (let y = 1980; y <= 2000; y += 4) for (const g of ['男', '女']) cs.push(Bazi.chart(new Date(y, 5, 15, 10, 30), g, 116.4));
  let n = 0, num = 0, act = 0, tim = 0;
  for (const c of cs) for (let d = 0; d < 10; d++) {
    const t0 = Yunshi.riYun(c, new Date(2026, 7, 2 + d)).text;
    const r = Tijian.check(t0, { zone: '断语', minChars: 0 });
    n++;
    if (r.stats) { num += r.stats.nums || 0; act += r.stats.acts || 0; tim += r.stats.times || 0; }
  }
  // 改之前实测:数字 1.00、动作 3.48、时间 0.00。这里钉的是「不许退回去」。
  ok(num / n >= 5, `数字密度掉回 ${(num / n).toFixed(2)},改前是 1.00、改后应 ≥5`);
  ok(act / n >= 4.5, `可照做的动作掉回 ${(act / n).toFixed(2)}`);
  ok(tim / n >= 2.5, `落到时间的处数掉回 ${(tim / n).toFixed(2)},改前是 0.00`);
});
t('时辰这一层取自 Bazi.jiShi,不自己另算(§四)', () => {
  const src = readFileSync(new URL('../yunshi.js', import.meta.url), 'utf8');
  ok(/Bazi\.jiShi/.test(src), '时辰吉凶要走 Bazi.jiShi');
  ok(!/function\s+jiShi/.test(src), 'yunshi.js 里不许自己再实现一份时辰吉凶');
});
t('加了时辰之后,断语仍然干净(体检员扫)', () => {
  const cs = [];
  for (let y = 1985; y <= 2000; y += 5) for (const g of ['男', '女']) cs.push(Bazi.chart(new Date(y, 2, 9, 14, 0), g, 116.4));
  const bad = [];
  for (const c of cs) for (let d = 0; d < 8; d++) {
    const t0 = Yunshi.riYun(c, new Date(2026, 7, 2 + d)).text;
    const h = Tijian.check(t0, { zone: '断语', minChars: 0 }).hits
      .filter(x => ['术语', '说教', '空话', '花钱消灾'].includes(x.kind));
    if (h.length) bad.push(t0.slice(0, 30) + ' ← ' + h.map(x => x.kind + ':' + x.snippet).join('/'));
  }
  ok(!bad.length, bad.slice(0, 4).join('\n      '));
});


t('时辰层吃流月(v0.92):月支一换,时辰表跟着换;不传月支走老口径不变', () => {
  // 缘起:用户两次说日运像流水账。v0.86 修半截,重样率卡在 50%——病根是时辰吉凶只认日干,
  // 五鼠遁一循环,60 天只有 5 张时辰表。v0.92 按 §九17 预案让时辰层吃流月:
  // 实测重样率 47.6% → 67.6%,最优时辰逐日变动率 72.7%(改前 73.9%,择时没被搞乱)。
  const c = Bazi.chart(new Date(1988, 3, 12, 14, 30), '女', { lon: 116.4 });
  const a = Bazi.jiShi(c, '甲');                 // 老口径
  const b = Bazi.jiShi(c, '甲', '子');
  const d = Bazi.jiShi(c, '甲', '午');
  ok(JSON.stringify(b) !== JSON.stringify(d), '月支子/午两套时辰表不该一样');
  // 不传月支 = 改前行为(防静默回归):没有任何「大气候」标记
  ok(!a.some(h => h.marks.some(m => /大气候/.test(m))), '不传月支不该出现月令标记');
  ok(b.some(h => h.marks.some(m => /大气候/.test(m))), '传了月支该有月令标记');
  // 月支冲的那个时辰要挨减分:子月冲午时
  const wu = b.find(h => h.zhi === '午'), wuOld = a.find(h => h.zhi === '午');
  ok(wu.score < wuOld.score, '子月的午时该比不看月时低分');
  // 60 天全文重样率:同一人日运不重样须过六成(改前 47.6%)
  const texts = new Set();
  for (let i = 0; i < 60; i++) {
    const r = Yunshi.riYun(c, new Date(2026, 0, 5 + i, 10, 0));
    texts.add(JSON.stringify(r));
  }
  ok(texts.size / 60 >= 0.6, `60 天不重样率 ${(texts.size / 60 * 100).toFixed(0)}%,应≥60%`);
});


t('性别融进解读(v0.95,用户点名):男财日带姻缘线、女官日带姻缘线、空性别不硬断、不许镜像', () => {
  // 缘起:用户 2026-08-02——「性别在日运里面要把它融入到解读里面,不是把选项加上就可以了」。
  // 口径有出处:男以财为妻星、女以官为夫星。
  const scan = (g, wantCls) => {
    const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), g, { lon: 116.4 });
    for (let d = 0; d < 60; d++) {
      const r = Yunshi.riYun(c, new Date(2026, 0, 5 + d, 10, 0));
      if (r.cls === wantCls) return r;
    }
    return null;
  };
  const m = scan('男', '财星');
  ok(m && /男命的钱与姻缘走同一条道/.test(m.text), '男命财星日该带姻缘线:' + (m && m.text.slice(0, 80)));
  const f = scan('女', '官杀');
  ok(f && /女命的名分与姻缘走同一条道/.test(f.text), '女命官杀日该带姻缘线:' + (f && f.text.slice(0, 80)));
  const u = scan('', '财星') || scan('', '官杀');
  ok(u && /性别没填,这一层不硬断/.test(u.text), '空性别该说明不硬断:' + (u && u.text.slice(-80)));
  const mGuan = scan('男', '官杀');
  ok(mGuan && !/女命/.test(mGuan.text) && !/夫/.test(mGuan.text), '男命官杀日不许套女命读法(不镜像)');
  const fCai = scan('女', '财星');
  ok(fCai && !/男命/.test(fCai.text), '女命财星日不许套男命读法(不镜像)');
});

console.log('【七】年运叙事:一条因果链,不是三条并列观察(v1.03 深造期第二期)');
t('年运叙事有五段:定性→机制→与大运的关系→哪几个月→做法;且与结论同向', () => {
  // 缘起:用户「口语化的解读让人膈应,一看就知道很 AI」「原先的项目没有改进」。
  // 病根:年运给的是三条并列观察 + 一段模板拼装,谁也不接谁,读者拿不到「所以呢」。
  const Dashi = require('../dashi.js');
  let n = 0;
  for (let i = 0; i < 40; i++) {
    const c = Bazi.chart(new Date(1960 + (i * 7) % 55, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30), i % 2 ? '男' : '女', { lon: 116.4 });
    const yr = 2024 + (i % 6);
    const card = Yunshi.nianYun(c, new Date(yr, 5, 1));
    const st = Yunshi.yearStory(c, card, Dashi.monthsOf(c, yr, null));
    n++;
    ok(st && st.length > 80, '叙事太短:' + st);
    ok(/之所以是这个定性,是因为/.test(st), '缺「机制」那一段(真因果那一步):' + st.slice(0, 60));
    ok(/该做的是|该躲的是/.test(st), '缺做法那一段');
    ok(/年\d+月\d+日|这一年/.test(st), '缺时间范围');
    // 与结论同向:判顺的年份不许在做法里先劝守成(自测逮到过这处自相矛盾)
    if ((card.score || 0) >= 0 && /该做的是:/.test(st)) {
      const seg = st.split('该做的是:')[1].split('。')[0];
      ok(!/^守成|^清旧账|^养精神/.test(seg), '判顺却先劝守成,与结论打架:' + seg);
    }
    // 不许出现装腔与术语
    const rep = Tijian.check(st.replace(/「[^」]*」/g, ''), {});
    const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
    ok(!bad.length, `叙事体检不过:${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
  }
  ok(n >= 40, '样本太少');
});
t('叙事随盘变化,不是模板:40 副盘的机制那一句不许只有一两种', () => {
  const Dashi = require('../dashi.js');
  const kinds = new Set();
  for (let i = 0; i < 40; i++) {
    const c = Bazi.chart(new Date(1960 + (i * 7) % 55, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30), i % 2 ? '男' : '女', { lon: 116.4 });
    const yr = 2024 + (i % 6);
    const st = Yunshi.yearStory(c, Yunshi.nianYun(c, new Date(yr, 5, 1)), Dashi.monthsOf(c, yr, null));
    const m = st.match(/是因为这一年当值的两股力([^;]{4,40})/);
    if (m) kinds.add(m[1]);
  }
  ok(kinds.size >= 3, `机制那一句只有 ${kinds.size} 种说法——退回模板了`);
  console.log(`      (40 盘,机制那一句 ${kinds.size} 种)`);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
