// 人生大事年表 + 具体事宜 专项内测
// 两条硬要求:①凡报节点必有可追溯的依据,依据方向与结论方向必须一致(不许依据说吉、结论说凶);
//            ②断语必须落到能照着做的事,禁空话套话——「机遇与挑战并存」这类一律视为废稿。
import Bazi from '../bazi.js';
import Dashi from '../dashi.js';
import Yunshi from '../yunshi.js';

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
const BANNED = ['机遇与挑战并存', '顺其自然', '保持平常心', '一切皆有可能', '静观其变', '心态最重要', '仅供参考', '因人而异', '总的来说'];
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

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
