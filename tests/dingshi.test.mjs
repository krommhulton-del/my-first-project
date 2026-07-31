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
import Bazi from '../bazi.js';
import Dashi from '../dashi.js';
import Dingshi from '../dingshi.js';

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
t('同一年在十二时辰下,方向的波动远大于强度的波动——这是本方法成立的前提', () => {
  const birth = new Date(1985, 10, 3);
  let dirWins = 0, n = 0;
  for (const [year, cat] of [[2012, 'shiye'], [2016, 'caiyun'], [2022, 'yinyuan'], [2019, 'wenshu']]) {
    const ss = [], ds = [];
    for (let i = 0; i < 12; i++) {
      const c = Dingshi.chartAt(birth, i, '女', 113.3);
      const e = Dingshi.yearEv(c, year, cat);
      ss.push(e.score); ds.push(e.dir);
    }
    const rng = a => Math.max(...a) - Math.min(...a);
    n++; if (rng(ds) > rng(ss)) dirWins++;
  }
  ok(dirWins >= n - 1, `方向波动应普遍大于强度波动,实得 ${dirWins}/${n}`);
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

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
