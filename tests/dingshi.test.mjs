// 定时辰专项内测
// 缘起与两次失败(照实记下来,免得以后有人把它改回去):
//   第一版拿事型「强度分」回推,失败——真相酉时被排到第 10 名。
//   查因:同一年十二个时辰,强度分几乎不动(实测波动 0.2~1.8),
//   因为强度主要由流年干支与日月支决定,时柱只占一点点;
//   而吉凶「方向」波动极大(3.6~5.8,能从 -3.8 翻到 0)——方向由喜忌定,喜忌正是时柱定的。
//   第二版改比方向,但自测用例设计有毛病(拿真盘下方向最极端的年份当事件,那种年份对多数盘都极端),
//   于是六个时辰并列 100%。第三版改用严格蒙特卡洛:随机盘、随机真时辰、随机年份,方向由真盘定。
//
// 注意这套模拟只证明「求解器能反解出自己这套模型」,**不证明这套模型合乎现实**——
// 后者要靠真实回测语料(见 CLAUDE.md 第七节),现在还没有。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Bazi from '../bazi.js';
import Dashi from '../dashi.js';
import Dingshi from '../dingshi.js';
import Tijian from '../tijian.js';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

console.log('【一】候选范围:口语说法要认得出');
t('常见的模糊说法各自转成正确的候选时辰', () => {
  eq(Dingshi.parseRange('大概是后半夜').idx.join(), '0,1,2');
  eq(Dingshi.parseRange('好像是上午').idx.join(), '3,4,5');
  eq(Dingshi.parseRange('吃午饭那会儿').idx.join(), '5,6,7');
  eq(Dingshi.parseRange('傍晚,太阳快落山').idx.join(), '8,9,10');
  eq(Dingshi.parseRange('白天').idx.join(), '3,4,5,6,7,8,9');
  eq(Dingshi.parseRange('完全不知道').idx.length, 12);
  eq(Dingshi.parseRange('').idx.length, 12, '说不清就十二时辰全排,不硬猜');
});

console.log('【二】同结论分组:这一半答案任何时候都给得出');
t('十二时辰按「旺衰+喜用+格局」分组,组内断法完全一致', () => {
  for (const [d, g] of [[new Date(1985, 10, 3), '女'], [new Date(1996, 7, 12), '女'], [new Date(1990, 4, 20), '男']]) {
    const res = Dingshi.solve({ birth: d, gender: g, lon: 116.4, range: '不知道', events: [] });
    eq(res.cands.length, 12);
    const total = res.groups.reduce((a, x) => a + x.hours.length, 0);
    eq(total, 12, '分组要不重不漏地盖住十二时辰');
    for (const grp of res.groups) {
      const members = res.cands.filter(c => c.fp === grp.fp);
      for (const m of members) {
        eq(m.band, grp.band, grp.hours.join('') + ' 组内旺衰应一致');
        eq(m.xi, grp.xi, grp.hours.join('') + ' 组内喜用应一致');
      }
      ok(grp.note.length > 10, '每组都要有一句人话');
    }
  }
});
t('全组同一档时,直接告诉人「不用纠结」', () => {
  // 找一副在指定范围内断法唯一的盘:1996-08-12 女,寅到申
  const res = Dingshi.solve({ birth: new Date(1996, 7, 12), gender: '女', lon: 116.4, range: [2, 3, 4, 5, 6, 7, 8], events: [] });
  if (res.sameAll) ok(res.advice.includes('不用再纠结') || res.advice.includes('不影响'), '同档时应明说不必纠结:' + res.advice);
  else ok(res.groups.length >= 2, '不同档就该分出组来');
});

console.log('【三】事件回推:比方向,不比强度(第一版就栽在比强度上)');
// 2026-08 把这条的判据改了一次,原委照实记:
//   ① 原判据是「四个抽样里至少三个,方向幅 > 强度幅」,而那四个是当初挑出来的——挑得过巧。
//      实测同一副盘换几组年份与事型,方向幅与强度幅**相等**的组合很常见(健康类的 dir 恒 = ±score),
//      于是「逐组比大小」本身就不是个稳的判据,换组样本就会红。
//   ② 更要紧的是原样本里有一个是姻缘(2022, yinyuan)。v0.77 起姻缘的吉凶方向已整个撤下
//      (回测量出来命盘对「结婚还是离婚」零区分度,见 dashi.js 里那段),它的方向幅恒为 0。
//   现改为**不挑样本、看总量**:在有方向的六个事型里取九组年份×事型,
//   要求「方向的总波动」显著大于「强度的总波动」,并且逐组不许出现方向幅小于强度幅的倒挂。
//   搬迁与姻缘两类的 dir 结构性为 0(前者本就只主「变」不主吉凶,后者已撤下),不参与本条。
t('同一年在十二时辰下,方向的波动远大于强度的波动——这是本方法成立的前提', () => {
  const birth = new Date(1985, 10, 3);
  const CASES = [[2012, 'shiye'], [2016, 'caiyun'], [2020, 'jiankang'], [2019, 'wenshu'],
    [2014, 'jiankang'], [2018, 'shiye'], [2005, 'caiyun'], [2010, 'wenshu'], [2013, 'guanfei']];
  let sumS = 0, sumD = 0, inverted = [];
  for (const [year, cat] of CASES) {
    const ss = [], ds = [];
    for (let i = 0; i < 12; i++) {
      const c = Dingshi.chartAt(birth, i, '女', 113.3);
      const e = Dingshi.yearEv(c, year, cat);
      ss.push(e.score); ds.push(e.dir);
    }
    const rng = a => Math.max(...a) - Math.min(...a);
    sumS += rng(ss); sumD += rng(ds);
    if (rng(ds) < rng(ss) - 1e-9) inverted.push(`${year}${cat}(强${rng(ss).toFixed(1)}>方向${rng(ds).toFixed(1)})`);
  }
  ok(!inverted.length, '这些组出现了倒挂:' + inverted.join('、'));
  ok(sumD > sumS * 2, `方向总波动应是强度的两倍以上,实得 方向${sumD.toFixed(1)} / 强度${sumS.toFixed(1)}`);
  console.log(`      (九组实测:方向总波动 ${sumD.toFixed(1)},强度总波动 ${sumS.toFixed(1)},${(sumD / sumS).toFixed(1)} 倍)`);
});
t('姻缘类在任何时辰下都不给方向(v0.77 撤下),也不参与回推', () => {
  // 缘起:姻缘的方向分回测只有 47.6%,比抛硬币还差;查清病根是「动不动」与「动得好不好」
  // 被揉成一个分,而后者由处境决定、命盘算不出来。撤下之后不许有人悄悄加回来。
  const birth = new Date(1985, 10, 3);
  for (let i = 0; i < 12; i++) {
    const c = Dingshi.chartAt(birth, i, '女', 113.3);
    for (const y of [2015, 2022, 2026]) eq(Dingshi.yearEv(c, y, 'yinyuan').dir, 0, `${y}年第${i}个时辰的姻缘方向`);
  }
  // 但「动量」还在——那是命盘真算得出来的
  const anyScore = [0, 3, 6, 9].some(i => Dingshi.yearEv(Dingshi.chartAt(birth, i, '女', 113.3), 2022, 'yinyuan').score > 0);
  ok(anyScore, '姻缘的动量分不该跟着方向一起消失');
  // 回推时姻缘一律不计权
  const c9 = Dingshi.chartAt(birth, 9, '女', 113.3);
  const a = Dingshi.agreementOf(c9, [{ year: 2022, type: 'yinyuan', good: true }]);
  eq(a.total, 0, '姻缘事件不该给回推贡献权重');
});
t('方向吻合度算得对:全吻合为 1、全相反为 0', () => {
  const c = Dingshi.chartAt(new Date(1985, 10, 3), 9, '女', 113.3);
  const evs = [];
  for (const [y, k] of [[2005, 'caiyun'], [2007, 'shiye'], [2014, 'jiankang']]) {
    const e = Dingshi.yearEv(c, y, k);
    if (Math.abs(e.dir) >= 0.8) evs.push({ year: y, type: k, good: e.dir > 0 });
  }
  ok(evs.length >= 2, '样本不足');
  const a = Dingshi.agreementOf(c, evs);
  ok(Math.abs(a.rate - 1) < 1e-9, '按真盘方向标注的事,在真盘下应全吻合:' + a.rate);
  const flipped = evs.map(e => ({ ...e, good: !e.good }));
  const b = Dingshi.agreementOf(c, flipped);
  ok(Math.abs(b.rate) < 1e-9, '把好坏全标反,吻合度应为 0:' + b.rate);
});
t('中性事件(没标好坏)不参与判分,也不许被算成吻合', () => {
  const c = Dingshi.chartAt(new Date(1985, 10, 3), 9, '女', 113.3);
  const a = Dingshi.agreementOf(c, [{ year: 2012, type: 'shiye' }, { year: 2016, type: 'caiyun' }]);
  eq(a.rate, null, '全是中性事件时应返回 null(无从判断),而不是 0 或 1');
});

console.log('【四】蒙特卡洛:方法到底有没有区分力(以及「不敢定」是否校准)');
t('随机盘随机时辰:真时辰所在断法组排第一 ≥50%、排进前三 ≥80%(随机基线约 8~20%)', () => {
  const cats = ['yinyuan', 'shiye', 'caiyun', 'wenshu', 'jiankang', 'zinv'];
  let n = 0, top1 = 0, top3 = 0;
  for (let s = 1; s <= 100; s++) {
    const y = 1960 + (s * 7) % 50, m = (s * 3) % 12, d = 1 + (s * 11) % 27;
    const birth = new Date(y, m, d), gender = s % 2 ? '男' : '女', truth = (s * 5) % 12;
    const tc = Dingshi.chartAt(birth, truth, gender, 116.4);
    const evs = [];
    for (let k = 0; k < 10; k++) {
      const yr = y + 20 + ((s * 13 + k * 7) % 25);
      const cat = cats[(s + k) % cats.length];
      const e = Dingshi.yearEv(tc, yr, cat);
      if (Math.abs(e.dir) >= 0.8) evs.push({ year: yr, type: cat, good: e.dir > 0 });
    }
    if (evs.length < 4) continue;
    const res = Dingshi.solve({ birth, gender, lon: 116.4, range: '不知道', events: evs });
    if (!res.ranked.length) continue;
    n++;
    const truthFp = res.cands.find(c => c.idx === truth).fp;
    if (res.ranked[0].fp === truthFp) top1++;
    if (res.ranked.findIndex(x => x.fp === truthFp) < 3) top3++;
  }
  ok(n >= 60, '有效模拟次数太少:' + n);
  ok(top1 / n >= 0.5, `排第一率仅 ${(top1 / n * 100).toFixed(0)}%(样本${n})`);
  ok(top3 / n >= 0.8, `前三率仅 ${(top3 / n * 100).toFixed(0)}%(样本${n})`);
});
t('自称「可以定」的时候必须真的对——宁可少说,不许说错', () => {
  const cats = ['yinyuan', 'shiye', 'caiyun', 'wenshu', 'jiankang', 'zinv'];
  let decided = 0, right = 0;
  for (let s = 1; s <= 100; s++) {
    const y = 1960 + (s * 7) % 50, m = (s * 3) % 12, d = 1 + (s * 11) % 27;
    const birth = new Date(y, m, d), gender = s % 2 ? '男' : '女', truth = (s * 5) % 12;
    const tc = Dingshi.chartAt(birth, truth, gender, 116.4);
    const evs = [];
    for (let k = 0; k < 10; k++) {
      const yr = y + 20 + ((s * 13 + k * 7) % 25);
      const cat = cats[(s + k) % cats.length];
      const e = Dingshi.yearEv(tc, yr, cat);
      if (Math.abs(e.dir) >= 0.8) evs.push({ year: yr, type: cat, good: e.dir > 0 });
    }
    if (evs.length < 4) continue;
    const res = Dingshi.solve({ birth, gender, lon: 116.4, range: '不知道', events: evs });
    if (!res.canDecide || !res.ranked.length) continue;
    decided++;
    const truthFp = res.cands.find(c => c.idx === truth).fp;
    if (res.ranked[0].fp === truthFp) right++;
  }
  ok(decided >= 5, '样本里应当有若干次敢下结论的,实得' + decided);
  ok(right / decided >= 0.9, `自称可以定却判错太多:${right}/${decided}`);
});

console.log('【五】诚实:定不了就说定不了,民俗只作参考');
t('事件不足三件时,明说无法回推,只给分组这一半答案', () => {
  const res = Dingshi.solve({ birth: new Date(1985, 10, 3), gender: '女', lon: 113.3, range: '不知道', events: [{ year: 2012, type: 'shiye', good: true }] });
  eq(res.canDecide, false);
  ok(res.reason.includes('不足三件') || res.reason.includes('只有'), '应说清缺什么:' + res.reason);
  ok(res.groups.length >= 1, '分组这一半仍要给');
});
t('民俗征验列得出来,且把话说死——不作依据', () => {
  ok(Dingshi.FOLK.length >= 4, '民俗条目');
  ok(Dingshi.FOLK_NOTE.includes('不作依据'), '必须写明不作依据');
  ok(Dingshi.FOLK_NOTE.includes('无从验证'), '必须写明无从验证');
});
t('材料交给 AI 时,已把结论算死并禁掉空话与硬定', () => {
  const res = Dingshi.solve({ birth: new Date(1985, 10, 3), gender: '女', lon: 113.3, range: '不知道', events: [] });
  const m = Dingshi.material(res, '1985-11-03 女');
  for (const k of ['勿另立结论', '断得一样的时辰分组', '能不能定']) ok(m.includes(k), '材料缺:' + k);
  ok(m.includes('不许拿相貌性格'), '须禁掉靠相貌性格硬定时辰');
  ok(m.includes('定不了就照实说定不了'), '须要求照实说定不了');
});

console.log('【六】子时跨半夜:早子晚子不是同一副盘');
// 缘起:做定时辰界面时扫十二时辰,发现 子时(庚子)与 丑时(己丑)天干不连,查出来是日界所致。
// 通行口径日界在子初(23:00),所以 23:00-24:00 生的算第二天,00:00-01:00 生的算当天,两者日柱差一整天。
// 全应用把「子时」一律折成当天 23:30(见 index.html 的 dxBirthChart),因此真在 0-1 点出生的人这样填,日柱时柱全错。
// 这一节钉三件事:①bazi 本身的日界判得对;②现行折法对早子确实是错的(错了就照实测出来);③界面里给的补救办法真的等价。
t('日界在子初:23:30 算第二天的日子,00:30 算当天的日子', () => {
  const late = Bazi.chart(new Date(1985, 10, 3, 23, 30), '女', 116.4);
  const early = Bazi.chart(new Date(1985, 10, 3, 0, 30), '女', 116.4);
  const nextEarly = Bazi.chart(new Date(1985, 10, 4, 0, 30), '女', 116.4);
  eq(early.pillars.day.gz, '丙午', '1985-11-03 凌晨的日柱');
  eq(late.pillars.day.gz, '丁未', '同日 23:30 应进到第二天的日柱');
  eq(late.pillars.day.gz, nextEarly.pillars.day.gz, '晚子与次日凌晨应同属一个干支日');
  eq(early.pillars.hour.gz, '戊子'); eq(late.pillars.hour.gz, '庚子');
});
// 注:取样年份必须避开 1986-1991 的夏令时,否则量到的是夏令时而不是日界(第一版就踩了这个坑)。
t('现行折法对「0-1点生」是错的:东部经度日柱整整推后一天', () => {
  let bad = 0, n = 0;
  for (let d = 2; d <= 27; d++) {
    const truth = Bazi.chart(new Date(1995, 5, d, 0, 30), '男', 116.4);   // 真·零点半生
    const asApp = Bazi.chart(new Date(1995, 5, d, 23, 30), '男', 116.4);  // 应用把子时一律折成当天 23:30
    n++;
    if (truth.pillars.day.gz !== asApp.pillars.day.gz) bad++;
  }
  eq(bad, n, '这一格必须全错——哪天它不全错了,说明输入折法已经改了,界面上那段补救话术要跟着改');
});
t('界面给的补救办法(生日前挪一天)在东部经度与真盘逐日等价', () => {
  let same = 0, n = 0;
  for (let d = 2; d <= 27; d++) {
    const truth = Bazi.chart(new Date(1995, 5, d, 0, 30), '男', 116.4);
    const fix = Bazi.chart(new Date(1995, 5, d - 1, 23, 30), '男', 116.4); // 日期前挪一天 + 子时
    n++;
    if (truth.pillars.day.gz === fix.pillars.day.gz && truth.pillars.hour.gz === fix.pillars.hour.gz) same++;
  }
  eq(same, n, '四柱必须逐日全等,否则界面上那句补救话是错的');
});
t('钟表时辰 ≠ 太阳时辰:出生地偏西的整排时辰会挪一格,界面必须解释而不是硬顶', () => {
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const offOf = lon => Dingshi.solve({ birth: new Date(1995, 5, 10), gender: '男', lon, range: '不知道', events: [] })
    .cands.filter(c => c.gz[1] !== ZHI[c.idx]).length;
  eq(offOf(116.4), 0, '北京一带钟表与太阳只差十几分钟,不该错位');
  eq(offOf(104.1), 12, '成都一带差约一小时,十二个时辰应整排前移一格');
  eq(offOf(87.6), 12, '乌鲁木齐差两小时以上,同样整排前移');
});

console.log('【七】「准不准」那一段得说人话(v0.81)');
// 缘起:v0.77 加了 stability,那一段在主程序侧栏与运势页都是直接渲染给客人的,
// 可里头一直写着「喜忌」「身强身弱档位」——v0.81 拿断语体检员扫出来的。
t('stability 的那段话,一个推演名目都不许有', () => {
  const S = [['男', new Date(1990, 4, 20)], ['女', new Date(1985, 7, 3)], ['男', new Date(2008, 0, 16)],
    ['女', new Date(1972, 10, 8)], ['男', new Date(1966, 2, 27)], ['女', new Date(1958, 2, 21)],
    ['男', new Date(1995, 5, 10)], ['女', new Date(2001, 10, 3)]];
  const lv = new Set(); const bad = [];
  for (const [g, d] of S) for (const lon of [116.4, 104.1]) {
    const r = Dingshi.stability({ birth: new Date(d), gender: g, lon });
    lv.add(r.level);
    const hits = Tijian.check(r.note, { zone: '断语', minChars: 0 }).hits
      .filter(h => ['术语', '说教', '空话', '花钱消灾', '模棱'].includes(h.kind));
    if (hits.length) bad.push(`${r.level}「${r.note.slice(0, 34)}」← ${hits.map(h => h.kind + ':' + h.snippet).join('/')}`);
  }
  ok(lv.size >= 2, `只扫到 ${[...lv].join('/')} 一档,样本不够`);
  ok(!bad.length, bad.slice(0, 5).join('\n      '));
});
t('得不得令的五种说法也各有白话对照', () => {
  for (const d of ['当令', '得月令之生', '受月令克(失令)', '泄于月令', '克月令(耗力)']) {
    ok(Bazi.DELING_PLAIN[d], `${d} 没有白话对照`);
    ok(!/月令/.test(Bazi.plainDeLing(d)), `${d} 的白话对照里还留着「月令」`);
  }
});
t('旺衰五档的白话对照只此一份,且五档一个不缺', () => {
  for (const b of ['身旺', '偏旺', '中和', '偏弱', '身弱']) {
    ok(Bazi.BAND_PLAIN[b], `${b} 没有白话对照`);
    ok(Bazi.plainBand(b) !== b, `${b} 的白话对照跟原样一样,等于没翻`);
  }
  // 别处不许另写一套:除 bazi.js 外,源码里不许再出现第二张 band→白话 的表
  const files = ['dili.js', 'dingshi.js', 'dashi.js', 'yunshi.js', 'index.html', 'yunshi.html'];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    ok(!/身旺\s*:\s*['\u2018\u201c]/.test(src), `${f} 里疑似另写了一张 band 白话表`);
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
