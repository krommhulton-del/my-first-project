// 问机(一句话 → 年/月/日三层应期)专项内测
// 三条硬要求:
//   ①三层要真串起来:年在窗口内、月属于该年、日落在该月的节气区间内;
//   ②荐的日子必须过三道门槛(黄历不忌不冲、日运为吉、建除合此事)——荐一个凶日就是自砸招牌;
//   ③凡报必有依据,且措辞随尺度切换(用到流月流日就不许再写「流年」「这一年」)。
import Bazi from '../bazi.js';
import Najia from '../najia.js';
import Jiri from '../jiri.js';
import Yunshi from '../yunshi.js';
import Wenji from '../wenji.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

const CHARTS = [
  Bazi.chart(new Date(1996, 7, 12, 20, 0), '女', 116.4),
  Bazi.chart(new Date(1990, 4, 20, 9, 30), '男', 120.15),
  Bazi.chart(new Date(1985, 10, 3, 6, 0), '女', 113.3),
  Bazi.chart(new Date(1978, 2, 9, 14, 0), '男', 121.5),
];
const OPTS = { nowYear: 2026, today: new Date(2026, 6, 31, 12) };
const QUESTIONS = ['我什么时候能谈恋爱', '我什么时候能进一笔钱', '我什么时候能换个好工作', '我什么时候能考上', '我什么时候适合搬家换城市'];

console.log('【一】认题:问什么归什么');
t('五类常见问法各自归对事型,并给出要答的是什么', () => {
  eq(Wenji.classify('我什么时候能谈恋爱').key, 'yinyuan');
  eq(Wenji.classify('什么时候能进一笔钱').key, 'caiyun');
  eq(Wenji.classify('我想跳槽,什么时候合适').key, 'shiye');
  eq(Wenji.classify('考研什么时候能上岸').key, 'wenshu');
  eq(Wenji.classify('什么时候能怀上孩子').key, 'zinv');
  eq(Wenji.classify('什么时候适合搬家').key, 'biandong');
  eq(Wenji.classify('我什么时候能遇到贵人').key, 'guiren');
  ok(Wenji.classify('嗯嗯').fallback, '认不出的应退回综合运程,而不是硬塞一类');
  for (const q of QUESTIONS) ok(Wenji.classify(q).ask.length > 4, '每类都该说清要答什么:' + q);
});

console.log('【二】三层要真串起来');
t('年在窗口内、月属于该年、日落在该月的节气区间内——一环扣一环不许错位', () => {
  for (const c of CHARTS) {
    for (const q of QUESTIONS) {
      const r = Wenji.ask(c, q, OPTS);
      if (r.empty) continue;
      for (const y of r.windows) {
        ok(y.year >= OPTS.nowYear && y.year < OPTS.nowYear + r.span, `年份越界:${y.year}`);
        eq(y.age, y.year - c.birth.getFullYear(), '年龄须与年份自洽');
        for (const m of y.months) {
          ok(m.idx >= 1 && m.idx <= 12, '月序越界');
          // 节气月区间:起始日必在公历上旬
          const st = parseInt((m.span.match(/^(\d+)月(\d+)日/) || [])[2], 10);
          ok(st >= 3 && st <= 9, `节气月起始日应在上旬:${m.span}`);
          for (const d of m.days) {
            eq(d.iso.slice(0, 4), String(y.year), `日子的年份须等于窗口年:${d.iso}`);
            const gz = Najia.ganZhi(new Date(y.year, d.m - 1, d.d, 12));
            eq(gz.month, m.gz, `${d.iso} 应落在 ${m.gz} 这个节气月里,实为 ${gz.month}`);
            eq(gz.day, d.gz, `${d.iso} 的日柱`);
          }
        }
      }
    }
  }
});
t('窗口按年份先后排列,月份按月序排列,日子按日期排列', () => {
  for (const c of CHARTS) {
    const r = Wenji.ask(c, '我什么时候能进一笔钱', OPTS);
    if (r.empty) continue;
    for (let i = 1; i < r.windows.length; i++) ok(r.windows[i].year > r.windows[i - 1].year, '年份未按先后排');
    for (const y of r.windows) {
      for (let i = 1; i < y.months.length; i++) ok(y.months[i].idx > y.months[i - 1].idx, '月份未按月序排');
      for (const m of y.months) for (let i = 1; i < m.days.length; i++) ok(m.days[i].iso > m.days[i - 1].iso, '日子未按日期排');
    }
  }
});

console.log('【三】荐的日子必须过三道门槛');
t('每一个荐日都:黄历不忌不冲、日运为吉、建除不犯此事之忌', () => {
  const EVENT_OF = { yinyuan: 'jiaqu', caiyun: 'kaiye', shiye: 'shangren', wenshu: 'kaoshi', zinv: 'qiuyi', biandong: 'ruzhai', jiankang: 'qiuyi' };
  let checked = 0;
  for (const c of CHARTS) {
    for (const q of QUESTIONS) {
      const r = Wenji.ask(c, q, OPTS);
      if (r.empty) continue;
      const cat = r.topic.key === 'guiren' ? 'shiye' : r.topic.key;
      for (const y of r.windows) for (const m of y.months) for (const d of m.days) {
        const date = new Date(y.year, d.m - 1, d.d, 12);
        const info = Jiri.dayInfo(date, c.birth, c.yong);
        ok(info.layers.almanac.level !== '忌', `${d.iso} 黄历为忌却被荐`);
        ok(info.level !== '冲', `${d.iso} 正冲本人却被荐`);
        ok(Yunshi.riYun(c, date).score > 0, `${d.iso} 日运非吉却被荐`);
        const ev = Jiri.EVENTS[EVENT_OF[cat] || 'tongyong'];
        if (ev) ok(!ev.ji.includes(info.jianchu.name), `${d.iso} ${info.jianchu.name}日犯${cat}之忌却被荐`);
        checked++;
      }
    }
  }
  ok(checked > 20, '样本太少,只验到' + checked + '天');
});
t('每个荐日都说得出挑它的理由', () => {
  for (const c of CHARTS) {
    const r = Wenji.ask(c, '我什么时候能谈恋爱', OPTS);
    if (r.empty) continue;
    for (const y of r.windows) for (const m of y.months) for (const d of m.days) {
      ok(d.why.length > 0 && d.why.join('').length > 4, `${d.iso} 没给理由`);
      ok(d.gz && d.riLevel && d.almLevel, `${d.iso} 缺干支或两层评级`);
    }
  }
});

console.log('【四】口径与措辞');
t('用到流月流日的依据,不许还写「流年」「这一年」', () => {
  for (const c of CHARTS) {
    for (const q of QUESTIONS) {
      const r = Wenji.ask(c, q, OPTS);
      if (r.empty) continue;
      for (const y of r.windows) for (const m of y.months) {
        for (const x of m.reasons) {
          ok(!x.includes('流年'), `流月依据里还写着「流年」:${x}`);
          ok(!x.includes('这一年'), `流月依据里还写着「这一年」:${x}`);
        }
        for (const d of m.days) for (const x of d.why) {
          ok(!x.includes('流年'), `流日依据里还写着「流年」:${x}`);
          ok(!x.includes('这一年'), `流日依据里还写着「这一年」:${x}`);
        }
      }
    }
  }
});
const BANNED = ['机遇与挑战并存', '顺其自然', '保持平常心', '一切皆有可能', '静观其变', '仅供参考', '因人而异'];
t('推出来的内容里没有一句空话(禁令那段本身不算)', () => {
  for (const c of CHARTS) {
    for (const q of QUESTIONS) {
      const r = Wenji.ask(c, q, OPTS);
      const mat = Wenji.material(c, r);
      const data = JSON.stringify(r) + mat.split('【写法要求】')[0];   // 禁令里必然出现这些词,不该算进来
      for (const b of BANNED) ok(!data.includes(b), '推算内容里出现空话「' + b + '」');
      ok(mat.includes('【写法要求】'), '材料须带写法要求');
      for (const b of ['机遇与挑战并存', '顺其自然']) ok(mat.includes(b), '写法要求里须点名禁掉「' + b + '」');
    }
  }
});

console.log('【五】画像与贵人');
t('姻缘画像:有配偶星就说路数模样行当方位属相,没有就照实说没有', () => {
  let withStar = 0, without = 0;
  for (const c of CHARTS) {
    const r = Wenji.ask(c, '我什么时候能谈恋爱', OPTS);
    if (r.empty) continue;
    for (const y of r.windows) for (const m of y.months) {
      const p = m.portrait;
      ok(p.lines.length > 0, '画像不能为空');
      if (p.star) {
        withStar++;
        const joined = p.lines.join(' ');
        for (const k of ['路数', '模样', '来的方位']) ok(joined.includes(k), '画像缺「' + k + '」:' + joined.slice(0, 40));
      } else { without++; ok(p.lines[0].includes('没有明摆着'), '无星时应照实说:' + p.lines[0]); }
    }
  }
  ok(withStar > 0, '样本里应有认得出配偶星的月份');
});
t('配偶星取法随性别翻面:男取财、女取官', () => {
  const gz = '丙午';
  const nan = Bazi.chart(new Date(1990, 4, 20, 9, 30), '男', 120.15);
  const nv = Bazi.chart(new Date(1990, 4, 20, 9, 30), '女', 120.15);
  const a = Wenji.keyStarOf(nan, 'yinyuan', gz);
  const b = Wenji.keyStarOf(nv, 'yinyuan', gz);
  ok(!a || Bazi.SHISHEN_CLASS[a.shen] === '财星', '男命配偶星应属财:' + JSON.stringify(a));
  ok(!b || Bazi.SHISHEN_CLASS[b.shen] === '官杀', '女命配偶星应属官杀:' + JSON.stringify(b));
});
t('贵人:方位属相与天乙表相符,年月日三层都给得出', () => {
  for (const c of CHARTS) {
    const g = Wenji.guiRen(c);
    const want = (Bazi.TIANYI[c.dayGan] || '').split('').filter(Boolean);
    eq(g.zhis.join(''), want.join(''), c.dayGan + ' 日主的天乙');
    for (const z of g.zhis) ok(Wenji.ZHI_DIR[z] && Wenji.ZHI_ANIMAL[z], z + ' 缺方位或属相');
    const r = Wenji.ask(c, '我什么时候能遇到贵人', OPTS);
    ok(r.guiren.days.length > 0, '近期贵人日应算得出');
    for (const d of r.guiren.days) {
      const gz = Najia.ganZhi(new Date(+d.iso.slice(0, 4), +d.iso.slice(5, 7) - 1, +d.iso.slice(8, 10), 12)).day;
      eq(gz, d.gz, d.iso + ' 日柱');
      ok(want.includes(gz[1]), d.iso + ' 被列为贵人日,但日支不在天乙之列');
    }
  }
});

console.log('【六】材料交付 AI:结论已算死、并禁空话');
t('材料含三层窗口、贵人、同期之事,且明令不许另立结论', () => {
  const c = CHARTS[0];
  const r = Wenji.ask(c, '我什么时候能谈恋爱', OPTS);
  const m = Wenji.material(c, r);
  for (const k of ['问机·三层应期', '勿另立结论', '[窗口]', '[贵人]', '起卦复核取用']) ok(m.includes(k), '材料缺:' + k);
  ok(m.includes('不许给没有依据的年份'), '材料须明令不许编年份');
});
t('扫不到窗口时照实说没有,不硬编', () => {
  const c = CHARTS[0];
  const r = Wenji.ask(c, '我什么时候能谈恋爱', { nowYear: 2026, span: 0, today: OPTS.today });
  ok(r.empty, 'span=0 时应为空窗');
  ok(Wenji.material(c, r).includes('别硬编'), '空窗时材料须明说别编');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
