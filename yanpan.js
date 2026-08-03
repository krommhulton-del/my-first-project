// yanpan.js —— 验盘簿:这程序对**你**到底准不准
//
// 这是本项目唯一的反馈回路,建到 v0.81 都还没闭合。
// CLAUDE.md §十一 早就写着:「已经发生过的年份人自己知道对不对,是本程序唯一现成的反馈回路」,
// 可程序至今只能**让你读**过去那些年,不能**记下**它当年说得对不对。
// 于是本项目的准确率永远只能靠 33 个名人语料撑着,而 §九 把「回测扩样」挂在「等外部条件」里等着。
// 这个模块把那个回路接上:**用的人自己就是语料源**。
//
// ————————————————————————————————————————————————
//  一、为什么非得「盲测封存」不可
// ————————————————————————————————————————————————
// 算命这行当,自评准确率天然不可信,病根只有一个:**事后往上套**。
// 先看见「2019 主事业、判吉」,再回想 2019 年——人一定能想起点跟事业沾边的好事。
// 这不是用户不诚实,是记忆本来就这么工作。任何「先看断语再打分」的设计,量出来的都是废数。
//
// 所以这里立一条硬规程:
//   ① **封存**:选一个年份,程序当场把它对那一年的判断算出来,**连同八个事型的全部分数一起封存**,
//      然后**藏起来**——你在开封之前一个字都看不到。
//   ② **陈述**:你写下那一年实际发生了什么(哪一类、是好是坏、一句话)。此时仍看不见程序说了什么。
//   ③ **开封**:两边并排摆出来,计分。
//   ④ 封存的那句话**永不修改**。你事后改「实际发生了什么」可以(记错很正常),
//      但改一次记一次,报表上照实写着「这条改过几次」。
//
// 为什么八个事型**全部**封存,而不只封「程序认为最重的那一类」:
//   只封一类的话,你若说「那年是健康出事」,程序就可以事后说「我本来也算到了健康」——无从证伪。
//   八类全封,等于程序在听见任何事之前先把一整张向量交出来,你说哪一类就查哪一类,赖不掉。
//
// **还可以往后封**(封一个还没到的年份)。那是最硬的一种证据——真正的事前预测,
// 不是回溯。代价只有一个:得等。所以界面上把「往后封」摆在同等位置。
//
// ————————————————————————————————————————————————
//  二、计分口径:与 33 人回测**同一处出账**(§四)
// ————————————————————————————————————————————————
// 这一条是本模块最要紧的设计约束。若这里另写一套算法,就会出现
// 「个人验盘说 80%、名人回测说 79.2%」这种谁也说不清的局面——本项目已经因为
// 「同一件事两处算」出过两次事故(择日与运势打架、PKEY 重名白屏)。
//
// 所以:
//   · **方向从哪来**:一律走 `Dingshi.yearEv(chart, year, type).dir`,
//     它再往下走 `Dashi.yearEvidence` ——断法只有那一处。本模块不自己算任何断卦/断命元素。
//   · **计分怎么算**:`tally()` 是**唯一**的计分函数,
//     `tools/backtest-events.mjs`(33 人语料那份)已改为调用它。两边跑的是同一段代码。
//   · **只考方向**,不考「有没有发生」——理由见 backtest 工具抬头:
//     语料里只有发生过的事,没有「这一年什么都没发生」的反例。
//     (个人验盘簿其实**能**攒出一点反例,见下面第四节,但那一层单独报,绝不混进方向命中率。)
//   · **|dir| 低于门槛算弃权**,不计入命中率,但弃权率照报。
//   · **姻缘一类恒不表态**(v0.77 撤下方向,理由见 dashi.js 那一大段),
//     所以姻缘事件在这里永远弃权,并且明写是为什么——不许悄悄不算。
//
// ————————————————————————————————————————————————
//  三、这个数字能说明什么、不能说明什么(§三)
// ————————————————————————————————————————————————
// 一个人攒得出的样本极少。十来件事的命中率,**在统计上什么都说明不了**——
// 抛十次硬币抛出七次正面是常事。本模块因此把话说死在三处:
//   · 样本不足时,报表第一句就是「这个数说明不了任何事」,并算出**还差多少件**才谈得上;
//   · 永远同时报**恒猜基线**(全押「好事」能得几分)——命中率高于它才有意义;
//   · **落空逐条列出**,一条不许藏(§七 公布规矩:只报命中不报落空等同作假)。
//
// 本模块判得了「程序说的与你说的对不对得上」,判不了「程序断得对不对」——
// 你说的那件事本身也可能记错、也可能归错类。这是**内部一致性之外的第三种东西**:
// 一份**你自己的、可以推翻程序的证据**。它的价值不在数字好看,在于它能把程序钉在地上。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dashi.js'), require('./dingshi.js'), require('./bazi.js'));
  } else { root.Yanpan = factory(root.Dashi, root.Dingshi, root.Bazi); }
}(typeof self !== 'undefined' ? self : this, function (Dashi, Dingshi, Bazi) {
  'use strict';

  const SCHEMA = 1;
  // 事型:与 dashi.js 同一份表(§四),这里只取用不另立
  const CATS = Dashi.CATS;
  const KEYS = Object.keys(CATS);
  // 姻缘这一类程序不给方向(v0.77),恒弃权。写成常量免得散在各处判断。
  const NO_DIR = ['yinyuan'];
  const NO_DIR_WHY = '姻缘这一类的吉凶方向本程序已整个撤下(回测量出命盘对这一层零区分度),'
    + '只报哪一年动、动多重。所以它在这儿永远不表态——不是算不出,是不敢说。';
  // 门槛:与 33 人回测那份完全同一组
  const THRESHOLDS = [0.001, 0.5, 1.0, 1.5, 2.0];
  const DEFAULT_TH = 1.0;

  // ——————————————————————————————————————
  //  统计学的那几件家伙(**只此一份**,33 人回测那份工具也调这里)
  // ——————————————————————————————————————
  function lnFact(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
  function hyperP(a, b, c, d) {
    return Math.exp(lnFact(a + b) + lnFact(c + d) + lnFact(a + c) + lnFact(b + d)
      - lnFact(a + b + c + d) - lnFact(a) - lnFact(b) - lnFact(c) - lnFact(d));
  }
  // Fisher 精确检验(双尾)。小样本下卡方不可靠,这一层必须用精确检验。
  function fisher2(a, b, c, d) {
    const p0 = hyperP(a, b, c, d), r1 = a + b, k = a + c, n = a + b + c + d;
    if (!n) return 1;
    let p = 0;
    for (let x = Math.max(0, k - (n - r1)); x <= Math.min(r1, k); x++) {
      const q = hyperP(x, r1 - x, k - x, n - r1 - k + x);
      if (q <= p0 * 1.0000001) p += q;
    }
    return Math.min(1, p);
  }
  // 二项检验(单尾):n 次里中 h 次,零假设每次中的概率 p0
  function binomTail(h, n, p0) {
    let s = 0;
    for (let k = h; k <= n; k++) s += Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p0) + (n - k) * Math.log(1 - p0));
    return Math.min(1, s);
  }
  // 可复现的伪随机(置换检验用;不许用 Math.random,否则同一份数据每次跑出不同的 p)
  function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  // ——————————————————————————————————————
  //  计分:唯一入口
  //  rows: [{ dir, good, type, ...任意随行信息 }]
  //    dir  程序的方向分(正为判吉、负为判凶)
  //    good 实际是好事(true)还是坏事(false);null/undefined 一律不参与
  // ——————————————————————————————————————
  function tally(rows, thresh) {
    const th = thresh == null ? DEFAULT_TH : thresh;
    const out = {
      th, said: 0, abstain: 0, hit: 0, miss: 0, skipped: 0,
      rate: null, baseline: null, misses: [], hits: [], abstains: [],
      a: 0, b: 0, c: 0, d: 0,        // a判吉&好 b判吉&坏 c判凶&好 d判凶&坏
    };
    for (const r of rows) {
      if (r.good !== true && r.good !== false) { out.skipped++; continue; }   // 中性事件不参与方向判分
      const noDir = NO_DIR.indexOf(r.type) >= 0;
      const d = noDir ? 0 : (+r.dir || 0);
      if (noDir || Math.abs(d) < th) {
        out.abstain++;
        out.abstains.push(Object.assign({}, r, { dir: +d.toFixed(2), why: noDir ? NO_DIR_WHY : '方向分不够门槛,程序不表态' }));
        continue;
      }
      out.said++;
      const up = d > 0;
      if (up) (r.good ? out.a++ : out.b++); else (r.good ? out.c++ : out.d++);
      if (up === r.good) { out.hit++; out.hits.push(Object.assign({}, r, { dir: +d.toFixed(2) })); }
      else { out.miss++; out.misses.push(Object.assign({}, r, { dir: +d.toFixed(2) })); }
    }
    if (out.said) {
      out.rate = out.hit / out.said;
      // 恒猜基线:在**被表态的这一批**里,一律押多数那一边能得几分。
      // 不报这个数,命中率就是无意义的——名人语料六成是好事,闭眼押好事就有六成。
      const g = out.a + out.c;
      out.baseline = Math.max(g, out.said - g) / out.said;
      out.p = fisher2(out.a, out.b, out.c, out.d);
      out.or = (out.b * out.c) ? (out.a * out.d) / (out.b * out.c) : null;
      out.pBinom = binomTail(out.hit, out.said, out.baseline);
    }
    return out;
  }

  // 还差多少件才谈得上「有没有信号」:
  // 按当前命中率维持不变,算出最少要多少次表态,二项检验才压得到 0.05 以下。
  function sampleAdvice(t) {
    if (!t || !t.said) return { enough: false, need: 20, say: '一件都还没开封,先攒着。' };
    const rate = t.rate, base = t.baseline;
    if (rate <= base) {
      return {
        enough: false, need: null,
        say: `眼下 ${t.said} 次表态里中 ${t.hit} 次(${(rate * 100).toFixed(0)}%),而闭眼押一边就能得 ${(base * 100).toFixed(0)}%——`
          + `这个成绩还没超过瞎猜,再攒多少件也说明不了程序有本事。`,
      };
    }
    for (let n = t.said; n <= 400; n++) {
      const h = Math.round(rate * n);
      if (binomTail(h, n, base) < 0.05) {
        return n <= t.said
          ? { enough: true, need: 0, say: `${t.said} 次表态中 ${t.hit} 次,已经压得到 0.05 以下(p=${t.pBinom.toFixed(3)})——但这只是「与瞎猜区分得开」,离「准」还远。` }
          : { enough: false, need: n - t.said, say: `照这个命中率走下去,还得再开封约 ${n - t.said} 件(共 ${n} 件),这个数才算与瞎猜区分得开。眼下 p=${t.pBinom.toFixed(3)},说明不了任何事。` };
      }
    }
    return { enough: false, need: null, say: '照这个命中率,再怎么攒也压不到 0.05——差距太小。' };
  }

  // ——————————————————————————————————————
  //  封存:把程序对某一年的判断整个锁下来
  //  **一旦写下永不修改**。所以这里只放确定性的东西,不放任何随时间变的字段。
  // ——————————————————————————————————————
  function seal(chart, year, opts) {
    const o = opts || {};
    const birthYear = chart.birth.getFullYear();
    const age = year - birthYear;
    const gz = Dashi.ganZhiOfYear(year);
    const du = (chart.dayun.list || []).find(d => age >= d.fromAge && age < d.fromAge + 10);
    const calls = {};
    for (const k of KEYS) {
      const e = Dingshi.yearEv(chart, year, k);              // ← 断法唯一出处
      calls[k] = { score: +(+e.score).toFixed(2), dir: +(+e.dir).toFixed(2) };
    }
    // 程序自己最看重的那一类(姻缘不参与「最看重」的排序方向,但仍照分数排位)
    const ranked = KEYS.slice().sort((x, y) => calls[y].score - calls[x].score);
    const top = ranked[0];
    return {
      v: SCHEMA,
      who: o.who || fingerprint(chart),
      year, age, gz, dayunGz: du ? du.gz : '',
      sealed: {
        at: o.now || null,                 // 由调用方给,免得引擎里出现不确定性
        engine: o.engine || '',
        calls, ranked, top,
        hourKnown: !!o.hourKnown,
        stab: o.stab || '',                // 没填钟点时的稳定度,一并记下——事后不许拿这个当借口
      },
      actual: null,
    };
  }

  // 生辰指纹:换个人就换一本簿子,不许串
  function fingerprint(chart) {
    const P = chart.pillars;
    return [chart.gender, ['year', 'month', 'day', 'hour'].map(k => P[k].gz).join(''),
      chart.birth.getFullYear()].join('|');
  }

  // ——————————————————————————————————————
  //  开封:把封存的话与实际发生的事摆在一起
  // ——————————————————————————————————————
  function open(rec, thresh) {
    const th = thresh == null ? DEFAULT_TH : thresh;
    if (!rec || !rec.actual) return { state: '未开封', say: '这一条还没写实际发生了什么。' };
    const a = rec.actual;
    const call = rec.sealed.calls[a.type];
    if (!call) return { state: '无从判', say: `封存里没有「${a.type}」这一类——多半是簿子版本对不上。` };
    const noDir = NO_DIR.indexOf(a.type) >= 0;
    const dir = noDir ? 0 : call.dir;
    const rank = rec.sealed.ranked.indexOf(a.type) + 1;
    const base = {
      year: rec.year, type: a.type, label: CATS[a.type] ? CATS[a.type].label : a.type,
      good: a.good, what: a.what || '', dir: +dir.toFixed(2), score: call.score,
      rank, of: rec.sealed.ranked.length, top: rec.sealed.top,
      topLabel: CATS[rec.sealed.top] ? CATS[rec.sealed.top].label : rec.sealed.top,
      edits: a.edits || 0,
    };
    if (a.good !== true && a.good !== false) {
      return Object.assign(base, { state: '不判方向', say: '这件事你没标好坏,方向这一层就判不了——只留下事型这一层的对照。' });
    }
    if (noDir) return Object.assign(base, { state: '弃权', say: NO_DIR_WHY });
    if (Math.abs(dir) < th) {
      return Object.assign(base, { state: '弃权', say: `程序那年对这一类的方向分只有 ${dir.toFixed(2)},不到 ${th} 的门槛——它当时就没敢表态。` });
    }
    const up = dir > 0;
    const okk = up === a.good;
    return Object.assign(base, {
      state: okk ? '中' : '空',
      say: okk
        ? `程序当年判这一类往${up ? '好' : '坏'}处走(${dir.toFixed(2)}),你说的也是${a.good ? '好' : '坏'}事——对上了。`
        : `程序当年判这一类往${up ? '好' : '坏'}处走(${dir.toFixed(2)}),你说的却是${a.good ? '好' : '坏'}事——**这一条它错了**。`,
    });
  }

  // ——————————————————————————————————————
  //  总账
  // ——————————————————————————————————————
  function rowsOf(records) {
    return (records || []).filter(r => r && r.actual && r.sealed && r.sealed.calls[r.actual.type])
      .map(r => ({
        year: r.year, type: r.actual.type,
        label: CATS[r.actual.type] ? CATS[r.actual.type].label : r.actual.type,
        dir: r.sealed.calls[r.actual.type].dir,
        score: r.sealed.calls[r.actual.type].score,
        good: r.actual.good, what: r.actual.what || '',
        rank: r.sealed.ranked.indexOf(r.actual.type) + 1, of: r.sealed.ranked.length,
        top: r.sealed.top, edits: r.actual.edits || 0,
        prospective: !!r.sealed.prospective,
      }));
  }

  // 事型这一层:程序当年把「你说的那一类」排在第几?
  // 这一层是**个人验盘簿才做得到**的——33 人语料里没有「这一年主要是哪一类」的标注。
  // 但它的毛病也要当面写清:「你觉得那年主要是哪件事」本身就带主观,不能当硬指标。
  function rankTally(records, seed) {
    const rows = rowsOf(records);
    if (!rows.length) return { n: 0 };
    const K = rows[0].of;
    const mean = rows.reduce((s, r) => s + r.rank, 0) / rows.length;
    const chance = (K + 1) / 2;
    const topHit = rows.filter(r => r.rank === 1).length;
    // 零假设:名次在 1..K 上均匀。用可复现的置换算 p(单尾:实际名次更靠前)
    const rnd = lcg(seed || 20260802);
    const N = 4000; let better = 0;
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < rows.length; j++) s += 1 + Math.floor(rnd() * K);
      if (s / rows.length <= mean) better++;
    }
    return {
      n: rows.length, K, meanRank: +mean.toFixed(2), chanceRank: +chance.toFixed(2),
      topHit, topRate: +(topHit / rows.length).toFixed(3), topChance: +(1 / K).toFixed(3),
      p: +((better + 1) / (N + 1)).toFixed(4),
      caveat: '这一层只能当参考:「那年主要是哪一类事」是你自己归的类,归类本身就带主观,'
        + '而且一年里往往不止一件事。它判得了「程序有没有把重点放对」,判不了「程序断得准不准」。',
    };
  }

  function report(records, opts) {
    const o = opts || {};
    const rows = rowsOf(records);
    const th = o.th == null ? DEFAULT_TH : o.th;
    const main = tally(rows, th);
    const ladder = THRESHOLDS.map(t => Object.assign({ th: t }, (function (x) {
      return { said: x.said, abstain: x.abstain, hit: x.hit, miss: x.miss, rate: x.rate, baseline: x.baseline, p: x.p };
    })(tally(rows, t))));
    const advice = sampleAdvice(main);
    const byType = {};
    for (const r of rows) {
      const k = r.type;
      byType[k] = byType[k] || { label: r.label, n: 0, said: 0, hit: 0, miss: 0 };
      byType[k].n++;
      const one = tally([r], th);
      byType[k].said += one.said; byType[k].hit += one.hit; byType[k].miss += one.miss;
    }
    return {
      sealedCount: (records || []).length,
      openedCount: rows.length,
      pending: (records || []).filter(r => r && !r.actual).length,
      prospective: (records || []).filter(r => r && r.sealed && r.sealed.prospective && !r.actual).length,
      th, main, ladder, advice, byType, rank: rankTally(records, o.seed),
      edited: rows.filter(r => r.edits > 0).length,
    };
  }

  // ——————————————————————————————————————
  //  说人话的报告(客人看这一份;铁律八:一个推演名目都不许有)
  // ——————————————————————————————————————
  function plain(rep) {
    const L = [];
    const m = rep.main;
    if (!rep.openedCount) {
      L.push(rep.sealedCount
        ? `已经封存 ${rep.sealedCount} 年,一条都还没开封。把那几年实际发生了什么写下来,才算得出账。`
        : '这本簿子还是空的。先封一年——程序会当场把它对那一年的判断锁起来,你看不见;等你写下那年实际发生了什么,再一起开封。');
      return L;
    }
    if (!m.said) {
      L.push(`开封 ${rep.openedCount} 件,程序**一次都没敢表态**(全在门槛以下,或落在它已经声明不表态的那一类)。`
        + `没有表态就没有命中率——这不是零分,是没上场。`);
    } else {
      L.push(`${m.said} 次表态里对了 ${m.hit} 次、错了 ${m.miss} 次,${(m.rate * 100).toFixed(0)}%;`
        + `另有 ${m.abstain} 件它没敢表态。同一批事里,闭眼往一边押能得 ${(m.baseline * 100).toFixed(0)}%。`);
      L.push(rep.advice.say);
    }
    if (m.misses.length) {
      L.push(`**它错在这几件**:` + m.misses.map(x => `${x.year}年${x.label}(它说${x.dir > 0 ? '好' : '坏'},实际${x.good ? '好' : '坏'}${x.what ? ':' + x.what : ''})`).join(';'));
    } else if (m.said) {
      L.push('这批里它一件没错——但样本这么小,一件没错也说明不了什么。');
    }
    if (m.abstain) {
      const yy = m.abstains.filter(x => NO_DIR.indexOf(x.type) >= 0).length;
      L.push(`弃权的 ${m.abstain} 件里,有 ${yy} 件是姻缘——那一类的吉凶方向本程序已经整个撤下,永远不表态。`
        + `其余 ${m.abstain - yy} 件是分数不够门槛,它当时就没话说。`);
    }
    if (rep.pending) L.push(`还有 ${rep.pending} 年封着没开封${rep.prospective ? `,其中 ${rep.prospective} 年是往后封的(那几年还没到)` : ''}。`);
    if (rep.edited) L.push(`有 ${rep.edited} 条你后来改过「实际发生了什么」——封存那一头一个字没动,这里照实记着。`);
    return L;
  }

  // 喂模型的材料:结论已由程序算死,模型只许解释,不许另立结论
  function material(rep) {
    const m = rep.main;
    const lad = rep.ladder.map(x => `  门槛${x.th}:表态${x.said} 弃权${x.abstain} 中${x.hit} 空${x.miss} `
      + `命中率${x.rate == null ? '—' : (x.rate * 100).toFixed(1) + '%'} 恒猜基线${x.baseline == null ? '—' : (x.baseline * 100).toFixed(1) + '%'}`
      + `${x.p == null ? '' : ' p=' + x.p.toFixed(4)}`).join('\n');
    return `【验盘簿 · 这程序对本人的实测成绩(程序算死,勿另立结论)】
封存 ${rep.sealedCount} 年,已开封 ${rep.openedCount} 件${rep.pending ? `,待开封 ${rep.pending} 年` : ''}。
主门槛 ${rep.th}:表态 ${m.said}、弃权 ${m.abstain}、中 ${m.hit}、空 ${m.miss}、命中率 ${m.rate == null ? '—' : (m.rate * 100).toFixed(1) + '%'}、恒猜基线 ${m.baseline == null ? '—' : (m.baseline * 100).toFixed(1) + '%'}${m.p == null ? '' : `、Fisher 双尾 p=${m.p.toFixed(4)}`}。
[逐门槛]
${lad}
[落空逐条]
${m.misses.length ? m.misses.map(x => `${x.year}年 ${x.label}:程序方向${x.dir}(判${x.dir > 0 ? '吉' : '凶'}),实际${x.good ? '好事' : '坏事'}——${x.what || '(未写)'}`).join('\n') : '(本批无落空)'}
[事型排位]
${rep.rank.n ? `${rep.rank.n} 件里,程序把「实际那一类」平均排在第 ${rep.rank.meanRank} 位(瞎排的期望是第 ${rep.rank.chanceRank} 位),头名命中 ${rep.rank.topHit} 件,p=${rep.rank.p}。${rep.rank.caveat}` : '(样本不足)'}
[样本量的话]
${rep.advice.say}
【写法要求】第一句就把成绩说死:多少次表态、对了几次、比闭眼猜强不强。然后必须原样转述落空的那几件,一件都不许略过。
样本不足时,**开口第一句就要说这个数说明不了任何事**,不许拿「初见成效」这类话糊过去。
不许把「命中率高」说成「这程序准」——表态少、弃权多,命中率自然高,那是闭嘴不是本事。
不许出现推演名目,不许说「仅供参考」「因人而异」这类空话。`;
  }

  // ——————————————————————————————————————
  //  语料导出:攒够了可以变成 data/backtest-cases.json 的一条
  //  **导出是用户自己按的**,程序绝不自动上传(铁律十)。
  // ——————————————————————————————————————
  function toCase(records, meta) {
    const m = meta || {};
    const evs = (records || []).filter(r => r && r.actual && r.actual.good != null).map(r => ({
      year: r.year, type: r.actual.type, what: r.actual.what || '', good: !!r.actual.good,
      source: '本人自述(验盘簿盲测封存,封存在前、陈述在后)',
    })).sort((x, y) => x.year - y.year);
    return {
      id: m.id || 'self-001', name: m.name || '(本人,匿名)', gender: m.gender || '',
      birth: m.birth || '', hour: m.hour || '', hourKnown: !!m.hourKnown,
      hourNote: m.hourNote || (m.hourKnown ? '本人填报的确切钟点' : '本人未填确切钟点,按十二时辰平均处理'),
      place: m.place || '', lon: m.lon == null ? null : m.lon, tzMin: m.tzMin == null ? 480 : m.tzMin,
      tzNote: m.tzNote || '按现行东八区',
      source: '验盘簿自记',
      protocol: '盲测封存:程序的判断在用户陈述之前已锁定,用户陈述时看不见程序的判断',
      events: evs,
    };
  }

  return {
    SCHEMA, CATS, KEYS, NO_DIR, NO_DIR_WHY, THRESHOLDS, DEFAULT_TH,
    seal, open, tally, rowsOf, rankTally, report, plain, material, toCase,
    fingerprint, sampleAdvice,
    // 统计家伙什外露,供 tools/backtest-events.mjs 调用——**只此一份**
    fisher2, binomTail, lcg, hyperP,
  };
}));
