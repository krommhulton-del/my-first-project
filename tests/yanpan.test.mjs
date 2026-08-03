// 验盘簿(yanpan.js)专项内测
//
// 这套测试分两类,抬头写清是哪一类(§三 的规矩):
//
//   【外部对照测试】—— 证明算得对,拿得出程序之外的标准答案
//     · Fisher 精确检验的 p 值,对着教科书的四格表标准答案逐个核;
//     · 二项检验的尾概率,对着闭式解核;
//     · **最要紧的一条**:拿 33 人语料喂 Yanpan.tally,必须复现
//       tools/backtest-events.mjs 公布的那组数。
//       **这组数随断法改动而变,改一次就要在这里同步一次**——它是哨兵不是常量:
//       v1.01 补了从气格、重定了从格的根之后,门槛 1.0 从 53/42/11/79.2%
//       变成 52/41/11/78.8%(一件事跨线),这条测试当场红,正是它该干的事。
//       这一条是 §四「一个口径一处算」的实证——两边若不是同一段代码,数字必然对不上。
//
//   【内部一致性测试】—— 只证明程序不犯浑,不证明「这程序算命准」
//     · 封存的不可变、姻缘恒弃权、门槛单调、落空一条不漏、样本不足时必须把话说死。
//
// 这个模块本身量的是「程序对某个人准不准」,而**这套测试量不了那个**——
// 那要靠真人真事,正是本模块要去收集的东西。别把两件事混起来。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const Dingshi = require(join(ROOT, 'dingshi.js'));
const Yanpan = require(join(ROOT, 'yanpan.js'));
const Tijian = require(join(ROOT, 'tijian.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) throw new Error((m || '') + ` 期望[${b}±${tol}] 实得[${a}]`); };

const CHART = Bazi.chart(new Date(1990, 4, 20, 9, 30), '男', 120.15);

console.log('【一】外部对照:统计检验的数值对着标准答案核');
t('Fisher 精确检验(双尾)与教科书四格表逐个吻合', () => {
  // 标准答案由超几何分布闭式解算出(与 scipy.stats.fisher_exact 同法同值)
  const REF = [
    [[3, 1, 1, 3], 0.485714], [[8, 2, 1, 5], 0.034965],
    [[27, 4, 7, 15], 0.000087], [[10, 0, 0, 10], 0.000011], [[1, 1, 1, 1], 1.0],
  ];
  for (const [[a, b, c, d], want] of REF) {
    near(Yanpan.fisher2(a, b, c, d), want, Math.max(1e-6, want * 1e-3), `Fisher(${a},${b},${c},${d})`);
  }
});
t('二项检验的尾概率与闭式解吻合', () => {
  // P(X>=5 | n=5, p=.5) = 1/32;P(X>=0|n=k,p) 恒为 1
  near(Yanpan.binomTail(5, 5, 0.5), 1 / 32, 1e-9, '全中');
  near(Yanpan.binomTail(0, 7, 0.3), 1, 1e-9, '零门槛');
  // P(X>=8 | n=10, p=.5) = (45+10+1)/1024
  near(Yanpan.binomTail(8, 10, 0.5), 56 / 1024, 1e-9, '10 中 8');
});

console.log('【二】外部对照:与 33 人语料回测**同一处出账**(§四 的实证)');
t('拿名人语料喂 tally,复现 backtest 工具公布的那组数', () => {
  const DATA = JSON.parse(readFileSync(join(ROOT, 'data', 'backtest-cases.json'), 'utf8'));
  // 合并口径与工具那边一字不差:同人同年同事型只算一件,好坏矛盾的整条丢弃
  const CASES = DATA.cases.map(c => {
    const bucket = new Map();
    for (const e of c.events) {
      const k = e.year + '|' + e.type;
      if (!bucket.has(k)) bucket.set(k, { ...e });
      else { const p = bucket.get(k); if (p.good !== e.good) p.__drop = true; }
    }
    return { ...c, events: [...bucket.values()].filter(e => !e.__drop) };
  });
  const chartOf = (c, localMinutes) => {
    const [y, m, d] = c.birth.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 0, 0);
    dt.setMinutes(dt.getMinutes() + (localMinutes - c.tzMin + 480));
    return Bazi.chart(dt, c.gender, c.lon);
  };
  const chartsOf = c => c.hourKnown
    ? [chartOf(c, +c.hour.split(':')[0] * 60 + +c.hour.split(':')[1])]
    : Dingshi.HOURS.map(h => chartOf(c, h.h * 60 + h.m));
  const charts = CASES.map(chartsOf);
  const rows = [];
  CASES.forEach((c, i) => c.events.forEach(e => {
    let s = 0; for (const ch of charts[i]) s += Dingshi.yearEv(ch, e.year, e.type).dir;
    rows.push({ name: c.name, ...e, dir: s / charts[i].length });
  }));
  eq(rows.length, 175, '语料合并后的事件数');
  // docs/回测报告-01-事件层.md 与 CLAUDE.md §三 公布的就是这一组
  // (v1.07 同步:用神口径四开关落地——假从改判/从强从气出口闸/中和恒取调候/制杀路——
  //  表态数没动(52),命中 41→44。33 人不是断法的裁判(v1.02 的规矩),裁判是 16 命例 9→13;
  //  这里只保证「公布的数就是程序算出来的数」,数字变了这条就该红,红了就来这里对账。)
  const r = Yanpan.tally(rows, 1.0);
  eq(r.said, 52, '门槛 1.0 的表态数');
  eq(r.abstain, 123, '门槛 1.0 的弃权数');
  eq(r.hit, 44, '门槛 1.0 的命中数');
  eq(r.miss, 8, '门槛 1.0 的落空数');
  near(r.rate * 100, 84.6, 0.1, '门槛 1.0 的命中率');
  near(r.baseline * 100, 63.5, 0.1, '恒猜基线');
  const half = Yanpan.tally(rows, 0.5);
  eq(half.said, 64, '门槛 0.5 的表态数'); eq(half.hit, 52, '门槛 0.5 的命中数');
  near(half.rate * 100, 81.3, 0.1, '门槛 0.5 的命中率');
});

console.log('【三】内部一致性:封存与开封的规矩');
t('封存把八个事型**全部**锁下来,不许只锁一个', () => {
  const r = Yanpan.seal(CHART, 2019, {});
  for (const k of Yanpan.KEYS) ok(r.sealed.calls[k], `封存里少了 ${k}`);
  eq(r.sealed.ranked.length, Yanpan.KEYS.length, '排位表要覆盖全部事型');
  eq(r.sealed.ranked[0], r.sealed.top, '头名与 top 必须一致');
  // 只锁一类的话,事后说哪一类都能赖账——这条测试就是防这个
  ok(Yanpan.KEYS.length >= 8, '事型太少,口径怕是被改过');
});
t('封存是确定性的:同一副盘同一年,封两次一模一样', () => {
  const a = Yanpan.seal(CHART, 2019, {}), b = Yanpan.seal(CHART, 2019, {});
  eq(JSON.stringify(a.sealed.calls), JSON.stringify(b.sealed.calls), '封存内容必须可复现');
});
t('开封不许动封存那一头', () => {
  const r = Yanpan.seal(CHART, 2019, {});
  const before = JSON.stringify(r.sealed);
  r.actual = { type: 'shiye', good: true, what: '升职' };
  Yanpan.open(r);
  eq(JSON.stringify(r.sealed), before, '开封动了封存的内容——这是作弊');
});
t('方向一律取自 Dingshi.yearEv,不自己另算', () => {
  const r = Yanpan.seal(CHART, 2019, {});
  for (const k of Yanpan.KEYS) {
    const ev = Dingshi.yearEv(CHART, 2019, k);
    near(r.sealed.calls[k].dir, +ev.dir.toFixed(2), 0.005, `${k} 方向与唯一出处对不上`);
    near(r.sealed.calls[k].score, +ev.score.toFixed(2), 0.005, `${k} 分数与唯一出处对不上`);
  }
});
t('姻缘恒弃权,而且必须说明为什么(v0.77 的连锁)', () => {
  const r = Yanpan.seal(CHART, 2021, {});
  r.actual = { type: 'yinyuan', good: true, what: '结婚' };
  const o = Yanpan.open(r);
  eq(o.state, '弃权', '姻缘居然表了态');
  ok(/撤下|不敢说|零区分度/.test(o.say), '弃权必须写明理由:' + o.say);
  // 就算把方向硬塞成一个大数,也不许表态
  r.sealed.calls.yinyuan.dir = 9;
  eq(Yanpan.open(r).state, '弃权', '姻缘的弃权不许被分数绕过去');
});
t('没标好坏的事不参与方向判分', () => {
  const r = Yanpan.seal(CHART, 2019, {});
  r.actual = { type: 'biandong', good: null, what: '搬了个家' };
  eq(Yanpan.open(r).state, '不判方向');
  eq(Yanpan.tally([{ type: 'biandong', dir: 3, good: null }], 1).said, 0, '中性事件不许进表态数');
});

console.log('【四】内部一致性:计分与统计');
t('门槛越高,表态越少、弃权越多(单调)', () => {
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push({ type: 'shiye', dir: (i % 9 - 4) * 0.4, good: i % 3 !== 0 });
  let prevSaid = Infinity;
  for (const th of Yanpan.THRESHOLDS) {
    const r = Yanpan.tally(rows, th);
    ok(r.said <= prevSaid, `门槛 ${th} 的表态数反而变多了`);
    eq(r.said + r.abstain + r.skipped, rows.length, `门槛 ${th}:表态+弃权+不参与 应等于总数`);
    prevSaid = r.said;
  }
});
t('恒猜基线算的是「被表态的那一批里,押多数能得几分」', () => {
  // 表态 4 件:3 好 1 坏 → 恒猜好事得 75%
  const rows = [
    { type: 'shiye', dir: 2, good: true }, { type: 'shiye', dir: 2, good: true },
    { type: 'shiye', dir: -2, good: true }, { type: 'shiye', dir: -2, good: false },
    { type: 'shiye', dir: 0.1, good: false },            // 这件弃权,不该影响基线
  ];
  const r = Yanpan.tally(rows, 1.0);
  eq(r.said, 4); near(r.baseline, 0.75, 1e-9, '基线');
  eq(r.hit, 3, '中:两件判吉遇好事 + 一件判凶遇坏事');
  eq(r.miss, 1);
});
t('落空一条不许藏:misses 的条数必须等于 miss', () => {
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push({ year: 2000 + i, type: 'caiyun', dir: (i % 2 ? 2 : -2), good: i % 3 === 0 });
  for (const th of Yanpan.THRESHOLDS) {
    const r = Yanpan.tally(rows, th);
    eq(r.misses.length, r.miss, `门槛 ${th}:落空清单与落空数对不上`);
    eq(r.hits.length, r.hit, `门槛 ${th}:命中清单与命中数对不上`);
    eq(r.abstains.length, r.abstain, `门槛 ${th}:弃权清单与弃权数对不上`);
    eq(r.a + r.b + r.c + r.d, r.said, `门槛 ${th}:四格表合计应等于表态数`);
  }
});
t('四格表的四个格子对得上命中与落空', () => {
  const rows = [
    { type: 'shiye', dir: 2, good: true },    // a 判吉&好 → 中
    { type: 'shiye', dir: 2, good: false },   // b 判吉&坏 → 空
    { type: 'shiye', dir: -2, good: true },   // c 判凶&好 → 空
    { type: 'shiye', dir: -2, good: false },  // d 判凶&坏 → 中
  ];
  const r = Yanpan.tally(rows, 1.0);
  eq(r.a, 1); eq(r.b, 1); eq(r.c, 1); eq(r.d, 1);
  eq(r.hit, 2); eq(r.miss, 2);
  near(r.p, 1.0, 1e-9, '这副对称的表 p 应当恰为 1');
});

console.log('【五】诚实:样本不足时必须把话说死');
t('样本小到说明不了问题时,报告第一时间说出来', () => {
  const rows = [{ type: 'shiye', dir: 2, good: true }, { type: 'caiyun', dir: -2, good: false }];
  const rep = { main: Yanpan.tally(rows, 1.0) };
  const adv = Yanpan.sampleAdvice(rep.main);
  ok(!adv.enough, '两件事居然算「够了」');
  ok(/说明不了|还没超过瞎猜|还得再开封/.test(adv.say), '话没说死:' + adv.say);
});
t('命中率没超过恒猜基线时,明说「再攒也没用」', () => {
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push({ type: 'shiye', dir: 2, good: i < 14 });   // 全判吉,14 好 6 坏
  const adv = Yanpan.sampleAdvice(Yanpan.tally(rows, 1.0));
  ok(/还没超过瞎猜/.test(adv.say), '没点破「跟瞎猜一样」:' + adv.say);
});
t('给客人的报告里,一个推演名目都不许有', () => {
  const recs = [];
  const years = [2012, 2014, 2016, 2018, 2019, 2021, 2022, 2023];
  const types = ['shiye', 'caiyun', 'jiankang', 'wenshu', 'biandong', 'yinyuan', 'guanfei', 'zinv'];
  years.forEach((y, i) => {
    const r = Yanpan.seal(CHART, y, {});
    r.actual = { type: types[i], good: i % 3 !== 0, what: '第' + i + '件事', edits: i === 2 ? 1 : 0 };
    recs.push(r);
  });
  const rep = Yanpan.report(recs);
  const lines = Yanpan.plain(rep);
  ok(lines.length, '报告是空的');
  for (const ln of lines) {
    const hits = Tijian.check(ln, { zone: '断语', minChars: 0 }).hits
      .filter(h => ['术语', '说教', '空话', '花钱消灾', '模棱'].includes(h.kind));
    ok(!hits.length, `「${ln.slice(0, 30)}」← ${hits.map(h => h.kind + ':' + h.snippet).join('/')}`);
  }
  // 有落空就必须逐条摆出来
  if (rep.main.miss) ok(lines.some(x => /它错在这几件/.test(x)), '有落空却没列出来');
});
t('喂模型的材料里,落空逐条都在,且明令不许把闭嘴说成本事', () => {
  const recs = [];
  [2012, 2015, 2018, 2020].forEach((y, i) => {
    const r = Yanpan.seal(CHART, y, {});
    r.actual = { type: ['shiye', 'caiyun', 'jiankang', 'wenshu'][i], good: i % 2 === 0, what: 'e' + i };
    recs.push(r);
  });
  const rep = Yanpan.report(recs);
  const m = Yanpan.material(rep);
  ok(m.includes('恒猜基线'), '材料里必须有恒猜基线');
  ok(/落空逐条/.test(m), '材料里必须有落空清单这一节');
  ok(/闭嘴不是本事|不许把「命中率高」说成/.test(m), '材料里必须挡住「弃权换高命中率」这套说辞');
  for (const x of rep.main.misses) ok(m.includes(String(x.year)), `落空 ${x.year} 没进材料`);
});
t('一件都没表态时,不许报成零分', () => {
  const rows = [{ type: 'yinyuan', dir: 0, good: true }, { type: 'shiye', dir: 0.2, good: false }];
  const rep = { openedCount: 2, sealedCount: 2, pending: 0, main: Yanpan.tally(rows, 1.0), advice: Yanpan.sampleAdvice(Yanpan.tally(rows, 1.0)), rank: { n: 0 }, edited: 0 };
  const lines = Yanpan.plain(rep);
  ok(lines.some(x => /没上场|一次都没敢表态/.test(x)), '没表态被说成了别的:' + lines.join('|'));
});

console.log('【六】事型排位这一层(个人验盘簿才做得到的,但毛病要写清)');
t('排位的瞎排期望值算得对,且把主观这条毛病当面写出来', () => {
  const recs = [];
  [2010, 2013, 2017, 2020, 2024].forEach((y, i) => {
    const r = Yanpan.seal(CHART, y, {});
    r.actual = { type: r.sealed.ranked[0], good: true, what: 'x' };      // 全按程序头名填
    recs.push(r);
  });
  const rk = Yanpan.rankTally(recs, 1);
  eq(rk.n, 5); eq(rk.meanRank, 1, '全填头名,平均名次该是 1');
  near(rk.chanceRank, (Yanpan.KEYS.length + 1) / 2, 1e-9, '瞎排的期望名次');
  ok(rk.p < 0.05, '全中头名居然不显著,p=' + rk.p);
  ok(/主观/.test(rk.caveat), '这一层的毛病必须当面写出来');
});
t('排位检验是可复现的:同一份数据同一个种子,p 必须一样', () => {
  const recs = [];
  [2011, 2015, 2019].forEach((y, i) => {
    const r = Yanpan.seal(CHART, y, {});
    r.actual = { type: ['shiye', 'caiyun', 'jiankang'][i], good: true, what: 'x' };
    recs.push(r);
  });
  eq(Yanpan.rankTally(recs, 7).p, Yanpan.rankTally(recs, 7).p, '同种子两次跑出不同的 p');
});

console.log('【七】导出语料:与 data/backtest-cases.json 同构');
t('导出的那一条,字段与现有语料对得上,并注明是盲测协议', () => {
  const DATA = JSON.parse(readFileSync(join(ROOT, 'data', 'backtest-cases.json'), 'utf8'));
  const sample = DATA.cases[0];
  const recs = [];
  [2012, 2016].forEach((y, i) => {
    const r = Yanpan.seal(CHART, y, {});
    r.actual = { type: 'shiye', good: i === 0, what: '事' + i };
    recs.push(r);
  });
  const c = Yanpan.toCase(recs, { birth: '1990-05-20', hour: '09:30', hourKnown: true, gender: '男', lon: 120.15 });
  for (const k of ['id', 'name', 'gender', 'birth', 'hour', 'hourKnown', 'place', 'lon', 'tzMin', 'events']) {
    ok(k in c, `导出缺字段 ${k}`);
    ok(k in sample || k === 'protocol', `${k} 不在现有语料的字段里`);
  }
  eq(c.events.length, 2);
  for (const e of c.events) for (const k of ['year', 'type', 'what', 'good', 'source']) ok(k in e, `事件缺字段 ${k}`);
  ok(/盲测/.test(c.protocol), '导出必须注明这批数据是盲测协议下收的');
  ok(Yanpan.KEYS.includes(c.events[0].type), '事型 key 必须取自同一份表');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
