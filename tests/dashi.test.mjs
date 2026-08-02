// 人生大事年表 + 具体事宜 专项内测
// 两条硬要求:①凡报节点必有可追溯的依据,依据方向与结论方向必须一致(不许依据说吉、结论说凶);
//            ②断语必须落到能照着做的事,禁空话套话——「机遇与挑战并存」这类一律视为废稿。
import Bazi from '../bazi.js';
import Dashi from '../dashi.js';
import Yunshi from '../yunshi.js';
import Tijian from '../tijian.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

const SAMPLES = [
  ['男', new Date(1990, 4, 20, 9, 30), 120.15],
  ['女', new Date(1985, 7, 3, 20, 0), 116.4],
  ['男', new Date(2008, 0, 16, 12, 0), 121.5],
  ['女', new Date(1972, 10, 8, 4, 0), 108.9],
  ['男', new Date(1966, 2, 27, 15, 0), 113.3],
];
const charts = SAMPLES.map(([g, d, lon]) => Bazi.chart(new Date(d), g, lon));

console.log('【一】年表骨架');
t('大运分八步、逐步接续十年,起止年份与年龄自洽', () => {
  for (const c of charts) {
    const tl = Dashi.timeline(c, { nowYear: 2026 });
    eq(tl.steps.length, 8);
    for (let i = 1; i < tl.steps.length; i++) {
      eq(tl.steps[i].fromYear, tl.steps[i - 1].fromYear + 10, '大运每步相隔十年');
      ok(Math.abs(tl.steps[i].fromAge - tl.steps[i - 1].fromAge - 10) < 0.001, '年龄同步');
    }
    eq(tl.turns.length, 8, '每步大运都该有交运转折带');
  }
});
t('年柱以立春为界(取年中推),不按元旦直算', () => {
  // 1984 年立春在 2 月 4 日:全年年柱应为甲子
  eq(Dashi.ganZhiOfYear(1984), '甲子');
  const c = charts[0];
  const tl = Dashi.timeline(c, { nowYear: 2026 });
  const r = tl.yearly.find(x => x.year === 2026);
  eq(r.gz, '丙午', '2026 年柱');
  const r2 = tl.yearly.find(x => x.year === 2033);
  eq(r2.gz, '癸丑', '2033 年柱');
});
t('近十年逐年细账连续无断档', () => {
  for (const c of charts) {
    const tl = Dashi.timeline(c, { nowYear: 2026 });
    if (!tl.nextTen.length) continue;
    eq(tl.nextTen.length, 10);
    for (let i = 1; i < 10; i++) eq(tl.nextTen[i].year, tl.nextTen[i - 1].year + 1);
  }
});

console.log('【二】依据与结论必须同向(不许自相矛盾)');
t('每个节点都带依据,且依据条数不为零', () => {
  for (const c of charts) {
    for (const n of Dashi.timeline(c, { nowYear: 2026 }).nodes) {
      ok(n.top && n.top.reasons.length > 0, `${n.year} 无依据`);
      ok(n.text && n.text.length > 12, `${n.year} 断语过短`);
    }
  }
});
t('结论方向 = 该事型自身证据的方向(吉/凶/变三档,不拿全年干支硬套)', () => {
  const GOOD = ['落定的窗口', '往上走的年份', '进财的年份', '得力的年份', '添人添喜', '顺遂的年份'];
  const BAD = ['起波的年份', '压担子的年份', '漏财的年份', '易反复的年份', '牵扯精力', '亮灯的年份', '缠身的年份', '操心的年份'];
  for (const c of charts) {
    for (const n of Dashi.timeline(c, { nowYear: 2026 }).nodes) {
      const d = n.top.dirSum;
      if (d > 0.6) ok(!BAD.some(b => n.text.includes(b)) || n.top.key === 'jiankang' || n.top.key === 'guanfei',
        `${n.year} ${n.top.label} 证据向吉(${d.toFixed(1)})却报凶语:${n.text.slice(0, 20)}`);
      if (d < -0.6) ok(!GOOD.some(g => n.text.includes(g)),
        `${n.year} ${n.top.label} 证据向凶(${d.toFixed(1)})却报吉语:${n.text.slice(0, 20)}`);
    }
  }
});
t('年龄闸门:未成年不断姻缘事业财运、未及二十不断子女', () => {
  for (const c of charts) {
    for (const r of Dashi.timeline(c, { nowYear: 2026 }).yearly) {
      const keys = r.cats.map(x => x.key);
      if (r.age < 16) {
        for (const k of ['yinyuan', 'shiye', 'caiyun']) ok(!keys.includes(k), `${r.age}岁竟断${k}`);
      }
      if (r.age < 20) ok(!keys.includes('zinv'), `${r.age}岁竟断子女`);
    }
  }
});
t('童限的财官姻缘之应折回「家境父母」一路,不凭空丢掉', () => {
  let found = false;
  for (const c of charts) {
    for (const r of Dashi.timeline(c, { nowYear: 2026 }).yearly) {
      if (r.age < 16 && r.cats.some(x => x.key === 'jiajing')) {
        found = true;
        const j = r.cats.find(x => x.key === 'jiajing');
        ok(j.reasons.some(x => x.includes('未到本人应事之年')), '折算须留痕:' + j.reasons.join('|'));
      }
    }
  }
  ok(found, '五副样盘里应有童限折算之例');
});
t('大变之年(岁运并临/天克地冲大运)一律保留,不被裁掉', () => {
  for (const c of charts) {
    const tl = Dashi.timeline(c, { nowYear: 2026 });
    const bigAll = tl.allNodes.filter(n => n.big).map(n => n.year);
    const bigKept = tl.nodes.filter(n => n.big).map(n => n.year);
    eq(bigKept.join(), bigAll.join(), '大变之年被裁掉了');
  }
});

console.log('【三】断语必须落到具体事,禁空话');
// 空话表不再各写各的:一律取 tijian.js 那一份权威表(§四 一个口径一处算)。
// 缘起:实测同一类禁词散在九处以上、内容互不相同,于是「什么算空话」有九个互相冲突的答案。
const BANNED = Tijian.RULES['空话'].words;
t('年表断语里没有一句禁用空话', () => {
  for (const c of charts) {
    for (const n of Dashi.timeline(c, { nowYear: 2026 }).nodes) {
      for (const b of BANNED) ok(!n.text.includes(b), `${n.year} 出现空话「${b}」`);
    }
  }
});
t('日运/月运/年运都给得出「宜什么、忌什么」的具体动作', () => {
  for (const c of charts) {
    for (let d = 0; d < 40; d++) {
      const y = Yunshi.all(c, new Date(2026, 0, 1 + d * 9, 12));
      for (const k of ['day', 'month', 'year']) {
        const cd = y[k];
        ok(cd.when && ['今天', '这个月', '今年'].includes(cd.when), '缺时间口径:' + cd.when);
        ok((cd.yi && cd.yi.length) || (cd.ji && cd.ji.length), `${cd.label} ${cd.gz} 一条事宜都没有`);
        for (const x of (cd.yi || []).concat(cd.ji || [])) {
          ok(x.length >= 4, '事宜过短像标签而非动作:' + x);
          for (const b of BANNED) ok(!x.includes(b), `事宜里出现空话「${b}」`);
        }
      }
    }
  }
});
t('事宜随喜忌翻面:同一颗十神,为喜与为忌给的做法必须不同', () => {
  const c = charts[0];
  // 造两副喜忌相反的假盘,同一流年干支应给出不同事宜
  const a = Object.assign({}, c, { yong: { xiWx: ['木', '水'], jiWx: ['火', '土', '金'] } });
  const b = Object.assign({}, c, { yong: { xiWx: ['火', '土', '金'], jiWx: ['木', '水'] } });
  const ya = Yunshi.riYun(a, new Date(2026, 6, 31, 12));
  const yb = Yunshi.riYun(b, new Date(2026, 6, 31, 12));
  ok(ya.yi.join() !== yb.yi.join(), '喜忌相反却给同一套宜:' + ya.yi.join());
});
t('神煞带来的具体事项确实进了清单(文昌→递材料、羊刃→别动利器、空亡→别开业)', () => {
  let wc = 0, yr = 0, kw = 0;
  for (const c of charts) {
    for (let d = 0; d < 120; d++) {
      const cd = Yunshi.riYun(c, new Date(2026, 0, 1 + d * 3, 12));
      const all = (cd.yi || []).concat(cd.ji || []).join(' ');
      if (all.includes('递材料')) wc++;
      if (all.includes('利器') || all.includes('开快车')) yr++;
      if (all.includes('立根基')) kw++;
    }
  }
  ok(wc > 0, '文昌之日未见「递材料」');
  ok(yr > 0, '羊刃之日未见「别动利器」');
  ok(kw > 0, '空亡之日未见「不宜立根基」');
});

console.log('【四】流月:应期落到月份');
t('十二流月齐全、月名按月支定、起始日落在节气之后', () => {
  const NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  for (const c of charts) {
    const ms = Dashi.monthsOf(c, 2027, null);
    eq(ms.length, 12);
    const seen = new Set(ms.map(m => m.gz));
    eq(seen.size, 12, '十二个月柱不该重复');
    for (const m of ms) {
      ok(NAMES.includes(m.name), '月名须按月支定:' + m.name + ' ' + m.gz);
      eq(m.name, ({ 寅: '正月', 卯: '二月', 辰: '三月', 巳: '四月', 午: '五月', 未: '六月', 申: '七月', 酉: '八月', 戌: '九月', 亥: '十月', 子: '冬月', 丑: '腊月' })[m.gz[1]]);
      const d = parseInt((m.span.match(/月(\d+)日/) || [])[1], 10);
      ok(d >= 3 && d <= 9, '节气月起始日应在每月上旬:' + m.span);
    }
  }
});
t('流月断语改口径:不许还写「流年」「这一年」', () => {
  for (const c of charts) {
    for (const m of Dashi.monthsOf(c, 2027, null)) {
      const txt = (m.cats || []).flatMap(x => x.reasons.concat((x.tips || []).map(t => t.tip))).join(' ') + ' ' + m.flags.join(' ');
      ok(!txt.includes('流年'), m.name + ' 的依据里还写着「流年」:' + txt.slice(0, 40));
      ok(!txt.includes('这一年'), m.name + ' 的依据里还写着「这一年」');
    }
  }
});
t('应期落月:节点与近十年都算得出热月,且热月确属该事型', () => {
  let got = 0;
  for (const c of charts) {
    const tl = Dashi.timeline(c, { nowYear: 2026 });
    for (const r of tl.nextTen) {
      ok(Array.isArray(r.months) && r.months.length === 12, r.year + ' 缺流月');
      for (const h of r.hot || []) {
        got++;
        const m = r.months.find(x => x.idx === h.idx);
        ok(m && m.cats.some(cc => cc.key === r.top.key && cc.score >= 2), `${r.year}年${h.idx}月被列为热月却无该事型证据`);
      }
    }
  }
  ok(got > 0, '十年里应当有热月');
});

console.log('【五】材料交付 AI 时,结论已由程序算死');
t('材料含起运、大运分段、转折带、节点依据,且注明不许另立结论', () => {
  const c = charts[0];
  const tl = Dashi.timeline(c, { nowYear: 2026 });
  const m = Dashi.material(c, tl);
  for (const k of ['起运', '大运分段', '交运转折带', '重要节点与依据', '勿另立结论']) ok(m.includes(k), '材料缺:' + k);
  ok(m.includes('不许用「机遇与挑战并存」'), '材料须明令禁空话');
});

console.log('【姻缘】方向留给处境,命盘只算动量(v0.77,队列第 0 条)');
// 缘起:回测量出来姻缘方向只有 47.6%,比抛硬币还差。查清病根不是参数,是把两件事揉成了一件——
//   「这一年感情上动不动」是命盘能算的;「动了以后是聚是散」由处境决定,命盘算不出来。
//   数字:33 人 37 件姻缘事,结合类 28 件里 25 件是好事、分离类 7 件里 0 件是好事;
//   而结合还是分离,未见婚的 27 件里 25 件是结合、已婚的 10 件里 7 件是分离。
//   同一状态内部,旧方向分对好坏零区分度(未见婚 好0.19/坏0.96,已婚 好1.17/坏1.11)。
// 这几条测试守住:撤下的不许悄悄加回来,加回来的必须靠处境且当面说明来源。
t('不填处境:姻缘一律不给方向,但动量照算', () => {
  let held = 0, scored = 0;
  for (const c of charts) {
    for (const y of [2015, 2020, 2026, 2031]) {
      const ev = Dashi.yearEvidence(c, Dashi.ganZhiOfYear(y), null);
      const yy = ev.cats.yinyuan;
      if (!yy) continue;
      eq(yy.dirSum, 0, `${y}年的姻缘方向`);
      ok(yy.held === true, `${y}年的姻缘应标明方向留白`);
      ok(yy.reasons.some(r => r.includes('单身') && r.includes('有伴')), '留白时必须把两条路都写出来');
      held++; if (yy.score > 0) scored++;
    }
  }
  ok(held >= 5, '样本里姻缘证据太少,测不出什么:' + held);
  ok(scored === held, '动量分不该跟着方向一起消失');
});
t('填了处境:方向跟着处境走,且必须写明这一层不是卦定的', () => {
  const c = charts[0];
  let n = 0;
  for (const y of [2015, 2020, 2026, 2031]) {
    const gz = Dashi.ganZhiOfYear(y);
    const a = Dashi.yearEvidence(c, gz, null, { marital: '单身' }).cats.yinyuan;
    const b = Dashi.yearEvidence(c, gz, null, { marital: '有伴' }).cats.yinyuan;
    if (!a || !b) continue;
    n++;
    ok(a.dirSum > 0 && b.dirSum < 0, `${y}年:单身应偏吉、有伴应偏凶,实得 ${a.dirSum}/${b.dirSum}`);
    eq(a.dirSum, -b.dirSum, `${y}年:两条路的力度应当等大反向`);
    eq(a.score, b.score, `${y}年:动量与处境无关,不该跟着变`);
    for (const x of [a, b]) {
      eq(x.dirFrom, '处境');
      ok(x.reasons.some(r => r.includes('不是卦定的')), '按处境断的那一条必须写明来源');
    }
  }
  ok(n >= 2, '样本不足');
});
t('姻缘的断语:留白时两条路都写,不许自己挑一条', () => {
  const c = charts[1];
  const tl = Dashi.timeline(c, { nowYear: 2026 });
  const yy = (tl.allNodes || tl.nodes).filter(n => n.top.key === 'yinyuan');
  ok(yy.length, '样本盘里没有姻缘节点,换个盘');
  for (const n of yy) {
    ok(n.text.includes('单身') && n.text.includes('有伴'), '留白的姻缘断语必须把两条路都摆出来:' + n.text.slice(0, 40));
    ok(!/这年感情大吉|必有波折/.test(n.text), '留白时不许自己下吉凶断语');
  }
});
t('喂给模型的材料里,姻缘口径写死了「不许自己补吉凶」', () => {
  const c = charts[0];
  const held = Dashi.material(c, Dashi.timeline(c, { nowYear: 2026 }));
  ok(held.includes('不给吉凶方向'), '留白版材料须写明不给方向');
  ok(held.includes('绝对不许自己补'), '留白版材料须挡住模型自行补一个吉凶');
  const known = Dashi.material(c, Dashi.timeline(c, { nowYear: 2026, marital: '有伴' }));
  ok(known.includes('有伴') && known.includes('不是按命盘推的'), '按处境断时须标明来源');
});

console.log('【八】年表这一栏得说人话(铁律八)');
// 缘起(v0.80):拿断语体检员回头扫**程序自己**的成稿,量出年表依据 4466 条渲染字段里
// 1206 条带术语(节点依据一项就 35.4%)——而 .dwhy(运势页)与 .jwhy(吉日页)是直接摆给客人看的。
// v0.65 修过一轮运势三卡的术语,**年表这一栏当时整个漏了**;用户为「看不懂」说过两次。
// 修法是把一条证据存两份:reasons 白话给客人、techs 原文喂模型。
// 这条测试两头都钉:①客人那一列一个术语不许有 ②模型那一份不许被顺手一起洗掉
//   ——只钉①的话,把两份都删成白话也能变绿,那等于把模型的原料也砍了。
t('客人看得到的每一处年表字段,一个推演名目都不许有', () => {
  let total = 0;
  const bad = [];
  const scan = (where, s) => {
    if (!s) return;
    total++;
    const hits = Tijian.check(String(s), { zone: '断语', minChars: 0 }).hits
      .filter(h => ['术语', '说教', '空话', '花钱消灾', '模棱'].includes(h.kind));
    if (hits.length) bad.push(`${where}「${String(s).slice(0, 30)}」← ${hits.map(h => h.kind + ':' + h.snippet).join('/')}`);
  };
  for (const c of charts) {
    const tl = Dashi.timeline(c, { nowYear: 2026 });
    for (const n of tl.nodes) {
      n.top.reasons.forEach(r => scan('节点依据', r));
      (n.top.tips || []).forEach(x => scan('节点做法', x.tip));
      n.flags.forEach(f => scan('节点旁注', f));
      scan('节点断语', n.text);
    }
    for (const r of (tl.nextTen || [])) {
      (r.cats || []).forEach(x => { x.reasons.forEach(y => scan('逐年依据', y)); (x.tips || []).forEach(y => scan('逐年做法', y.tip)); });
      for (const m of (r.months || [])) if (m.top) {
        m.top.reasons.forEach(y => scan('流月依据', y));
        (m.top.tips || []).forEach(y => scan('流月做法', y.tip));
        m.flags.forEach(f => scan('流月旁注', f));
      }
    }
    // 运势页那一行渲染的是 shenPlain,不是 shen
    tl.steps.forEach(x => scan('大运分段(界面)', `这十年当值的是${x.shenPlain},整体${x.dir}`));
    tl.turns.forEach(x => scan('转折带', x.note));
    scan('童限', tl.childhood);
  }
  ok(total > 500, `扫到的字段太少(${total}),测试自己可能失效了`);
  ok(!bad.length, `${bad.length}/${total} 条不干净:\n      ` + bad.slice(0, 8).join('\n      '));
});
t('喂模型的那一份仍留着推演原文——不许连模型的原料一起洗掉', () => {
  const c = charts[0];
  const m = Dashi.material(c, Dashi.timeline(c, { nowYear: 2026 }));
  for (const w of ['流年', '日支', '大运']) ok(m.includes(w), `材料里缺了「${w}」,推演原料被洗没了`);
  const shen = ['正官', '七杀', '正财', '偏财', '正印', '偏印', '食神', '伤官', '比肩', '劫财'];
  ok(shen.filter(x => m.includes(x)).length >= 3, '材料里至少该留着几味十神,否则模型没原料可讲');
});
t('白话与原文是一一对应的两列,不许一多一少', () => {
  for (const c of charts) {
    for (let y = 2020; y < 2032; y++) {
      const ev = Dashi.yearEvidence(c, Dashi.ganZhiOfYear(y), null, {});
      eq(ev.flags.length, ev.flagsTech.length, `${y}年 旁注两列不等长`);
      for (const k of Object.keys(ev.cats)) {
        // 姻缘那一类会在末尾追加一条「方向留白」的话,只加在白话这一列
        const d = ev.cats[k].reasons.length - ev.cats[k].techs.length;
        ok(d === 0 || (k === 'yinyuan' && d === 1), `${y}年 ${k} 两列差 ${d} 条`);
      }
    }
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
