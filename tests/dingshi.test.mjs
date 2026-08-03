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
import Astro from '../astro.js';
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


console.log('【六】v1.11 精校:分钟级断点 + 多路证据(用户点名「最专业最精确」)');
// 缘起:用户 2026-08-03「深入的做这个生辰矫正,我要做最专业最精确的」。
// 先量出天花板:中式最细就是时柱(2 小时);上升星座边界与时辰**不重合**,两者交错把一天
// 切成约 24 段;上升度数连续(0.25°/分钟)才是唯一能到分钟的刻度。下面逐条钉住这些事实。
t('命宫按《三命通会》(殆知阁本)原文起,拿书自带的算例逐字核', () => {
  // 原文算例:「假令甲子年三月生人,得戌时生…即命坐卯宫是也…甲巳之年丙作首,乃丁夘宫也」
  const r = Bazi.mingGong('辰', '戌', '甲');     // 三月=辰月、戌时、甲年
  eq(r.zhi, '卯', '书里明写命坐卯宫');
  eq(r.gz, '丁卯', '书里明写乃丁夘宫也(干按五虎遁)');
  // 起法的两条不变量:同月里十二时辰给出十二个不同的宫(一一对应,不许塌成几个)
  const set = new Set('子丑寅卯辰巳午未申酉戌亥'.split('').map(z => Bazi.mingGong('辰', z, '甲').zhi));
  eq(set.size, 12, '同一月十二时辰该给十二个不同命宫');
  // 引文必须在库里逐字搜得到(§十二:搜得到才准挂)
  const book = readFileSync(new URL('../data/classics/三命通会-殆知阁本.txt', import.meta.url), 'utf8').replace(/[\s\u3000]+/g, '');
  ok(book.includes(r.quote), '命宫起例引文在殆知阁本里搜不到——不许凭记忆写');
  ok(Bazi.chart(new Date(1990, 5, 15, 10, 30), '男', { lon: 116.4 }).mingGong, '排盘要带上命宫');
});
t('断点扫描:一天切成的段数合乎实测(中式独走约 13 段;加上升约 24 段)', () => {
  const birth = new Date(1990, 5, 15);
  const cn = Dingshi.fineSegments({ birth, gender: '男', lon: 116.4 }, null);
  ok(cn.length >= 12 && cn.length <= 16, `中式独走该在 12–16 段(时柱 12 段为底),实得 ${cn.length}`);
  const both = Dingshi.fineSegments({ birth, gender: '男', lon: 116.4, lat: 39.9 }, Astro);
  ok(both.length > cn.length, `接上上升该切得更细:${cn.length} → ${both.length}`);
  // 段必须首尾相接、盖满一天、不重叠(区间算术错了会静默给出错的宽度)
  eq(both[0].from, 0, '第一段该从 00:00 起');
  eq(both[both.length - 1].to, 1439, '末段该到 23:59');
  for (let i = 1; i < both.length; i++) eq(both[i].from, both[i - 1].to + 1, `第 ${i} 段与上一段没接上`);
  // 段内断法必须真的一致(指纹相同),否则「段」这个概念就是假的
  for (const s of both.slice(0, 6)) {
    const a = Bazi.chart(new Date(1990, 5, 15, Math.floor(s.from / 60), s.from % 60), '男', { lon: 116.4 });
    const b = Bazi.chart(new Date(1990, 5, 15, Math.floor(s.to / 60), s.to % 60), '男', { lon: 116.4 });
    eq(a.pillars.hour.gz, b.pillars.hour.gz, `段 ${s.span} 首尾时柱不同,分段错了`);
    eq(a.yong.xiWx.join(''), b.yong.xiWx.join(''), `段 ${s.span} 首尾喜忌不同,分段错了`);
  }
});
t('木星不计票——这是量出来的:它一年三十度,任何年份都能对上', () => {
  const ev = [{ year: 2015 }, { year: 2019 }, { year: 2021 }];
  const hits = Dingshi.angleWindows(new Date(1990, 5, 15), 39.9, 116.4, ev, Astro);
  const wide = k => { const set = new Set(); for (const h of hits) if (h.mover === k) for (let m = h.from; m <= h.to; m++) set.add(m); return set.size; };
  const jup = wide('木星'), sat = wide('土星'), plu = wide('冥王星');
  ok(jup > sat * 2, `木星窗口该远宽于土星(实测约 3 倍),实得 木${jup} 土${sat}`);
  ok(plu < jup, `冥王星窗口该窄得多,实得 冥${plu} 木${jup}`);
  ok(hits.filter(h => h.mover === '木星').every(h => !h.vote), '木星那些条必须标成不计票');
  ok(hits.filter(h => h.mover === '土星').every(h => h.vote), '土星那些条该计票');
});
t('盖满全天的线索不算证据(通则,C 路实测撞上过)', () => {
  const r = Dingshi.rectify({ birth: new Date(1990, 5, 15), gender: '男', lon: 116.4, lat: 39.9, Astro,
    events: [{ year: 2015, type: 'shiye', good: false }], turnYears: [2017] });
  // 起运岁全天只挪约 0.3 岁,2017 这个换运年在任何时刻都成立 → 必须被剔除并当面说明
  ok(r.cDropped.length >= 1, '这一路该被判定为切不动并剔除');
  ok(r.bounds.some(b => /盖满全天|切不动/.test(b)), '剔除的理由必须写在「谁卡的边」里:' + r.bounds.join(' | '));
  ok(!r.cHits.length, '被剔除的线索不许还留在计票里');
});
t('票数、区间宽度、下一步:三样都不许含糊(铁律二、三)', () => {
  const base = { birth: new Date(1990, 5, 15), gender: '男', lon: 116.4, lat: 39.9, Astro };
  const ev = [{ year: 2015, type: 'shiye', good: false }, { year: 2019, type: 'caiyun', good: true }, { year: 2021, type: 'shiye', good: true }];
  const none = Dingshi.rectify({ ...base });
  ok(!none.anyEvidence, '零线索时不该有证据票');
  eq(none.alive.length, none.segs.length, '零线索时每一段都该还站得住(不许偷偷挑一个)');
  ok(/线索还不够/.test(none.first), '零线索要照实说线索不够:' + none.first);
  ok(/排除不掉|分不开/.test(none.first), '零线索要说清是「一段也排除不掉」:' + none.first);
  // v1.12 改口径(用户:「宁可保留质量最好,也不要出错」):
  // 慢星那一路降为旁注不计票——自测量出它每次都敢收到约 50 分钟,而真时刻只有 18.9% 在内
  // (碰运气 3.0%),八成会把真答案排除掉;中式那一路改用 solve 的判据(拉不开差距就不开口)。
  // 于是**多数情形不收窄**,这正是要的行为:宁可说分不开,不许说错。
  const withEv = Dingshi.rectify({ ...base, events: ev });
  ok(withEv.alive.every(s => s.votes === withEv.maxVotes), '存活段的票数该都等于最高票');
  ok(/分钟/.test(withEv.first), '第一句必须报出区间宽度:' + withEv.first);
  ok(withEv.next && withEv.next.length > 10, '必须给「下一步该补什么」');
  ok(!withEv.anyEvidence || withEv.alive.length >= 1, '有票就该有存活段');
  // 慢星窗口照算照摆,但一票不投(不许悄悄回来参与收窄)
  ok(withEv.bHits.length > 0, '慢星窗口该照算出来给人看');
  ok(withEv.segs.every(s => !s.bBest), '慢星不许参与计票');
  ok(withEv.bounds.some(b => /18\.9%|一票不投/.test(b)), '必须当面说明慢星为什么不计票:' + withEv.bounds.join(' | '));
  // 「敢收窄」这条路不是死条:证据够杂时仍触发得到(自测约 1%,且开口那次真时刻在内)
  // v1.15:A 路改走事型,合成事实也跟着改——**用户报的是「那年发生了哪一类」**,
  // 所以从真盘取那一年排第一的那一类当作事实(好坏一概不给,正是新设计的用法)。
  let decided = 0;
  for (let i = 0; i < 40; i++) {
    const y = 1960 + (i * 7) % 50, mo = (i * 5) % 12, d = 1 + (i * 11) % 28, tm = (i * 137) % 1440;
    const truth = Bazi.chart(new Date(y, mo, d, Math.floor(tm / 60), tm % 60), '男', { lon: 116.4 });
    const evs = [];
    for (let yy = y + 24; yy < y + 52 && evs.length < 4; yy += 5) {
      const sc = Dingshi.CATS.map(T => [T, Dingshi.yearEv(truth, yy, T).score]).sort((a, b) => b[1] - a[1]);
      if (sc[0][1] > 0.5) evs.push({ year: yy, type: sc[0][0] });     // 只报年份与类别
    }
    if (evs.length < 4) continue;
    const r = Dingshi.rectify({ birth: new Date(y, mo, d), gender: '男', lon: 116.4, lat: 39.9, Astro, events: evs });
    if (r.aDecided) decided++;
  }
  ok(decided >= 1, '「敢收窄」这条路一次都没触发过——成死条了');
  // 没有经纬度 → 西洋那一路整个用不上,必须当面说,不许假装还能精确
  const noGeo = Dingshi.rectify({ birth: base.birth, gender: '男', lon: 116.4, events: ev, Astro });
  ok(!noGeo.hasGeo && noGeo.bounds.some(b => /出生地/.test(b)), '缺经纬度要点名说是哪一路用不上');
  ok(noGeo.segs.length < withEv.segs.length, '缺经纬度时段数该更少(上升那一路没切)');
});
t('精校的话过体检员,并把「自拟零回测」写在明处', () => {
  const r = Dingshi.rectify({ birth: new Date(1990, 5, 15), gender: '男', lon: 116.4, lat: 39.9, Astro,
    events: [{ year: 2015, type: 'shiye', good: false }, { year: 2019, type: 'caiyun', good: true }, { year: 2021, type: 'shiye', good: true }] });
  // v1.12:诚实声明改成把**实测数字**摆出来(比一句「零回测」更硬)
  ok(/18\.9%/.test(r.honest) && /3\.0%/.test(r.honest), '第一屏必须把自测的命中率与随机基线一起写出来');
  ok(/不拿它定生辰/.test(r.honest), '必须写明慢星那一路不用于定生辰');
  ok(/两小时|生时那一格/.test(r.honest), '必须写明真正能定的那一路最细只到生时那一格');
  for (const txt of [r.first, r.next].concat(r.bounds)) {
    const t2 = Tijian.check(txt, {});
    ok(!t2.hits.some(h => h.cat === '术语'), '给客人的话里有行内名目:' + txt);
    ok(!t2.hits.some(h => h.cat === '空话' || h.cat === '装腔'), '话里有空话或装腔:' + txt);
  }
  const mat = Dingshi.fineMaterial(r, '1990-06-15 男 北京');
  ok(/区间宽度必须报出来/.test(mat), '材料里要钉死「宽度必须报」');
  ok(/零回测/.test(mat), '材料里要带上诚实声明');
});

// ══════════════════════════════════════════════════════════════════
//  这几段的差别改变了什么(v1.17)
// ══════════════════════════════════════════════════════════════════
// 缘起:用户 2026-08-03「排盘问题解决就去解读,生辰矫正八字星盘需要大换血」。
// **先量后改**:界面上「还站得住的区间」是十行参数堆,
// **十行里说了「这个差别意味着什么」的 0 行**,而那 25 段里藏着 4 组不同的喜用、
// 其中两组正好相反(金土 vs 木水火)——参数的形式正好把「你的盘可能在叫你往相反方向走」盖住了。
// 这一层只做集合运算:跨全部存活区间**不变的**挑出来(现在就能用),**变的**单列(定不下来)。
// 五条测试守:①不自算断法 ②不变/变分得对 ③翻盘判据沿用旧口径不另立
// ④两档(一套结论 / 多套结论)都不是死条 ⑤措辞过体检员。
console.log('\n【差别改变了什么(v1.17)】');
const stakeOf = (y, mo, d, lon, lat, events) => {
  const r = Dingshi.rectify({ birth: new Date(y, mo - 1, d), gender: '男', lon, lat, Astro, events: events || [] });
  return { r, st: Dingshi.stakes(r) };
};
const STK = [];
for (let i = 0; i < 24; i++) {
  const lon = [116.4, 121.5, 104.1, 87.6][i % 4], lat = [39.9, 31.2, 30.6, 43.8][i % 4];
  const s = stakeOf(1950 + (i * 3) % 70, 1 + (i % 12), 1 + (i * 7) % 28, lon, lat, []);
  if (s.st) STK.push(s);
}
t('「不变的」必须真的每段都一样,「变的」必须真的有两种以上', () => {
  for (const { r, st } of STK) {
    const A = r.alive;
    for (const f of st.fixed) {
      if (f.label === '旺你的那几行') ok(new Set(A.map(s => s.xi)).size === 1, '列进不变却真的在变:旺你的那几行');
      if (f.label === '底子厚薄') ok(new Set(A.map(s => s.band)).size === 1, '列进不变却真的在变:底子厚薄');
    }
    for (const v of st.varies) {
      if (v.label === '旺你的那几行') ok(new Set(A.map(s => s.xi)).size > 1, '列进变却其实不变:旺你的那几行');
      if (v.label === '底子厚薄') ok(new Set(A.map(s => s.band)).size > 1, '列进变却其实不变:底子厚薄');
    }
    ok(st.fixed.length + st.varies.length >= 3, '不变与变加起来太少,漏项了');
  }
});
t('并组与占比自洽:各组分钟数加起来 = 存活总分钟,占比不超 100', () => {
  for (const { r, st } of STK) {
    const sum = st.groups.reduce((a, g) => a + g.mins, 0);
    const alive = r.alive.reduce((a, s) => a + (s.narrowMins || s.mins), 0);
    eq(sum, alive, '各组分钟数之和对不上存活总分钟');
    ok(st.groups.every(g => g.pct >= 0 && g.pct <= 100), '占比越界');
    ok(st.groups.every(g => g.segs.length > 0), '空组');
  }
});
t('翻盘判据沿用旧口径(毫无交集才叫翻盘),不另立一套', () => {
  for (const { st } of STK) {
    for (const f of st.flips) {
      const a = f.a.split(/[、,,]/).filter(Boolean), b = f.b.split(/[、,,]/).filter(Boolean);
      ok(!a.some(x => b.includes(x)), `报了翻盘却有交集:${f.a} vs ${f.b}`);
    }
    // 反过来:真有毫无交集的两组,就必须报出来
    for (let i = 0; i < st.groups.length; i++) for (let j = i + 1; j < st.groups.length; j++) {
      const a = st.groups[i], b = st.groups[j];
      if (!a.wx.some(x => b.wx.includes(x))) ok(st.flipped, `有毫无交集的两组却没报翻盘:${a.xi} vs ${b.xi}`);
    }
  }
  ok(STK.some(x => x.st.flipped), '「翻盘」这一档一次都没触发,是死条');
  ok(STK.some(x => !x.st.flipped), '「不翻盘」这一档一次都没触发,恒真了');
});
t('一套结论 / 多套结论 两档都不是死条,且措辞跟着分档变', () => {
  const one = STK.filter(x => x.st.groups.length === 1), many = STK.filter(x => x.st.groups.length > 1);
  ok(one.length || many.length, '一个样本都没有');
  for (const { st } of one) ok(/给的是同一套结论/.test(st.story), '只有一套结论时该明说不耽误用');
  for (const { st } of many) ok(/套结论/.test(st.story) && /把钟点问准/.test(st.story), '多套结论时该给下一步');
  ok(many.length, '「多套结论」这一档没触发到');
});
t('§四 一个断法都不自算:只读各段已排好的盘做集合运算', () => {
  const SRC = readFileSync(join(ROOT, 'dingshi.js'), 'utf8');
  const body = SRC.slice(SRC.indexOf('function stakes('), SRC.indexOf('function fineMaterial('));
  ok(!/judgeStrength|pickYongShen|wuxingPower|judgeCong|yearEv\(|Dashi\./.test(body), 'stakes 里不许出现断法调用');
  ok(/Bazi\.plainBand/.test(body), '旺衰翻白话必须走 bazi 那一份(§四)');
  ok(/不新算任何东西/.test(SRC.slice(SRC.indexOf('function stakes('))), 'honest 要写明不自算');
});
t('措辞过体检员(禁术语/空话/说教/装腔)', () => {
  const seen = new Set();
  for (const { st } of STK) {
    for (const s of [st.story, st.honest, ...st.groups.map(g => g.say), ...st.fixed.map(f => f.say), ...st.varies.map(v => v.say)]) {
      if (!s || seen.has(s)) continue; seen.add(s);
      const rep = Tijian.check(String(s).replace(/「[^」]*」/g, ''), {});
      const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
      ok(!bad.length, `体检不过:${s.slice(0, 40)}… → ${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
    }
  }
  console.log(`      (扫了 ${seen.size} 条不重样的话)`);
});
t('材料里带这一段,并写明它是重点', () => {
  const { r } = STK[0];
  const m = Dingshi.fineMaterial(r, '测试');
  ok(/差别改变了什么/.test(m), '材料缺这一段');
  ok(/这是本页的重点/.test(m), '材料没写明它是重点');
  ok(/不许和稀泥/.test(m), '材料没禁和稀泥');
});
t('答案之锚:同一份结果反复算二十次,逐字节一致', () => {
  const { r } = STK[0];
  const first = JSON.stringify(Dingshi.stakes(r).story);
  for (let i = 0; i < 20; i++) ok(JSON.stringify(Dingshi.stakes(r).story) === first, '第' + i + '次不一致');
  ok(Dingshi.stakes(null) === null, '没结果该返回 null(不硬造)');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
