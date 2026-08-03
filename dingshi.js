// dingshi.js — 定时辰:不知道自己生在哪个时辰,用「已发生过的事」把它回推出来
//
// 为什么要有这个:时辰只动时柱,但时柱在旺衰里占约两成权重,足以翻转喜用神甚至触发从格。
// 实测三副样盘各扫十二时辰:有的十二时辰出了 5 种喜用组合(错一个时辰用神完全不同),
// 有的十二时辰里七个触发从格(喜忌整个翻转 180°),也有的连着七个时辰结论一模一样。
//
// 本模块给两样东西,后一样同样要紧:
//   一、**事件回推**:拿你确凿发生过的事去反推——哪个时辰的年表最能解释这些事,它就最可能是真的。
//       这是唯一能自证的方法(可验证、可解释、可推翻),不靠相貌性格这类主观说辞。
//   二、**同结论分组**:哪几个时辰其实断出来一模一样。与其纠结,不如直接告诉你「这个范围内怎么填都不影响」。
//
// 方法上走过的弯路(照实记下):
//   · 第一版拿事型「强度分」回推,失败——实测真相酉时被排到第 10。
//     查因:强度主要由流年干支与日月支决定,十二时辰间几乎不动(波动 0.2~1.8)。
//   · 现行版改比**吉凶方向**:方向由喜忌定,而喜忌正是时柱定的,十二时辰间波动 3.6~5.8。
//     用户须标明每件事是好事还是坏事,看哪个时辰的判断与现实吻合。
//   · **区分不开就说区分不开**:严格蒙特卡洛实测——真时辰所在断法组排第一 69%、进前三 92%
//     (随机基线约 8~20%);而程序自称「可以定」的 16 次里 16 次全对。
//     宁可绝大多数时候说「定不了」,也不瞎猜。
//
// 边界要说清:上述模拟只证明求解器能反解出自己这套模型,**不证明这套模型合乎现实**。
// 后者要靠真实回测语料,目前没有。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./bazi.js'), require('./dashi.js'));
  } else { root.Dingshi = factory(root.Najia, root.Bazi, root.Dashi); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Bazi, Dashi) {
  const HOURS = [
    { idx: 0, name: '子时', span: '23:00-01:00', h: 23, m: 30 },
    { idx: 1, name: '丑时', span: '01:00-03:00', h: 1, m: 30 },
    { idx: 2, name: '寅时', span: '03:00-05:00', h: 3, m: 30 },
    { idx: 3, name: '卯时', span: '05:00-07:00', h: 5, m: 30 },
    { idx: 4, name: '辰时', span: '07:00-09:00', h: 7, m: 30 },
    { idx: 5, name: '巳时', span: '09:00-11:00', h: 9, m: 30 },
    { idx: 6, name: '午时', span: '11:00-13:00', h: 11, m: 30 },
    { idx: 7, name: '未时', span: '13:00-15:00', h: 13, m: 30 },
    { idx: 8, name: '申时', span: '15:00-17:00', h: 15, m: 30 },
    { idx: 9, name: '酉时', span: '17:00-19:00', h: 17, m: 30 },
    { idx: 10, name: '戌时', span: '19:00-21:00', h: 19, m: 30 },
    { idx: 11, name: '亥时', span: '21:00-23:00', h: 21, m: 30 },
  ];
  // 常见的模糊说法 → 候选时辰序号
  const VAGUE = [
    { re: /(后半夜|凌晨|半夜|夜里|深夜)/, idx: [0, 1, 2], label: '后半夜(23:00-05:00)' },
    { re: /(天没亮|天刚亮|清早|大早|一早)/, idx: [2, 3, 4], label: '天亮前后(03:00-09:00)' },
    { re: /(上午|早上|早晨)/, idx: [3, 4, 5], label: '上午(05:00-11:00)' },
    { re: /(中午|正午|晌午|午饭|吃午饭)/, idx: [5, 6, 7], label: '中午前后(09:00-15:00)' },
    { re: /(下午)/, idx: [7, 8, 9], label: '下午(13:00-19:00)' },
    { re: /(傍晚|黄昏|太阳落|晚饭|吃晚饭)/, idx: [8, 9, 10], label: '傍晚(15:00-21:00)' },
    { re: /(晚上|夜晚|入夜)/, idx: [9, 10, 11], label: '晚上(17:00-23:00)' },
    { re: /(白天)/, idx: [3, 4, 5, 6, 7, 8, 9], label: '白天(05:00-19:00)' },
    { re: /(不知道|不清楚|不确定|没人记得)/, idx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], label: '完全不知道(十二时辰全排)' },
  ];
  function parseRange(text) {
    const t = String(text || '');
    for (const v of VAGUE) if (v.re.test(t)) return { idx: v.idx.slice(), label: v.label };
    return { idx: HOURS.map(h => h.idx), label: '未指定,十二时辰全排' };
  }

  function chartAt(birthDate, hourIdx, gender, lon) {
    const H = HOURS[hourIdx];
    const d = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate(), H.h, H.m);
    return Bazi.chart(d, gender, lon);
  }

  // 一副盘的「结论指纹」:旺衰档 + 喜用 + 格局。指纹相同者,断出来的东西就一样。
  function fingerprint(c) {
    return [c.strength.band, c.yong.xiWx.slice().sort().join(''), c.geju ? c.geju.split('(')[0] : '正格'].join('|');
  }

  // 某一年在某副盘下、某个事型的「强度」与「方向」
  function yearEv(chart, year, catKey) {
    const gz = Najia.ganZhi(new Date(year, 5, 1, 12)).year;      // 年中取,必在立春后
    const age = year - chart.birth.getFullYear();
    const du = (chart.dayun.list || []).find(d => age >= d.fromAge && age < d.fromAge + 10);
    const ev = Dashi.yearEvidence(chart, gz, du ? du.gz : null);
    const c = ev.cats[catKey];
    return { score: c ? c.score : 0, dir: c ? c.dirSum : 0, reasons: c ? c.reasons : [] };
  }
  function yearScore(chart, year, catKey) { return yearEv(chart, year, catKey).score; }

  // ——— 回推该比什么:实测结论 ———
  // 自测发现:同一年、十二个时辰,事型「强度分」几乎不动(波动 0.2~1.8),
  // 因为强度主要由流年干支与日月支决定,时柱只占一点;
  // 而「吉凶方向」波动极大(3.6~5.8,能从 -3.8 翻到 0)——因为方向由喜忌定,喜忌正是时柱定的。
  // 所以拿强度回推是无效的(第一版就栽在这:真相酉时被排到第 10)。
  // 改为比**方向**:你说这件事是好事还是坏事,看哪个时辰的喜忌判断与现实吻合。
  // v0.77 起,姻缘类的吉凶方向已从程序里撤下(回测量出来命盘对那一层零区分度,详见 dashi.js 里那段),
  // 于是姻缘事件在这里恒不表态。回推时辰要靠事业/财运/健康这几类方向鲜明的事。
  function agreementOf(chart, events) {
    let hit = 0, total = 0;
    const detail = [];
    for (const e of events) {
      if (e.good === undefined || e.good === null) continue;      // 中性事件(搬家换工作)不参与方向判分
      const { score, dir } = yearEv(chart, e.year, e.type);
      const w = Math.abs(dir);
      if (e.type === 'yinyuan') { detail.push({ ...e, dir: 0, verdict: '姻缘类不参与回推(吉凶方向本程序已撤下)', w: 0 }); continue; }
      if (w < 0.6) { detail.push({ ...e, dir: +dir.toFixed(1), verdict: '此时辰对该年方向不表态', w: 0 }); continue; }
      total += w;
      const agree = (e.good && dir > 0) || (!e.good && dir < 0);
      if (agree) hit += w;
      detail.push({ ...e, score: +score.toFixed(1), dir: +dir.toFixed(1), verdict: agree ? '吻合' : '相反', w: +w.toFixed(1) });
    }
    return { rate: total > 0 ? hit / total : null, hit: +hit.toFixed(1), total: +total.toFixed(1), detail };
  }

  // ——— 按「事型」回推(v1.15 起的主路)———
  // **缘起是用户点破的一个设计错误**:此前只认「吉凶方向」,要用户先标每件事是好是坏。
  // 可很多事当事人根本判不了——「弟弟出生了」到底旺我还是克我,那正是命盘该告诉我的,
  // 反过来让用户先判,是把推断方向搞反了;搬迁更是事实清楚、好坏模糊,硬标就是逼人猜。
  // 而且方向不表态(|dir|<0.6)的年份会被整件丢掉,填了等于白填。
  //
  // 改成拿**事型**对:你只报「哪一年发生了哪一类事」(这是你知道的事实),
  // 程序看那个时辰的年表里,这一类在那一年排第几。排得越靠前,这个时辰越解释得通。
  // **先量后改**(蒙特卡洛,随机真时辰,事实由真盘取):
  //   同一年跨十二时辰「最重的那一类会变」占 82.5%(吉凶方向会变只占 64.4%)——区分度更高;
  //   真时辰排第一 38.3%(碰运气 8.3%)、进前三 70.0%(碰运气 25%)。
  // 照旧只证明求解器能反解自己这套模型,不证明模型合乎现实(真实语料仍然没有)。
  const CATS = ['yinyuan', 'shiye', 'caiyun', 'wenshu', 'biandong', 'zinv', 'jiankang', 'guanfei'];
  function typeAgreeOf(chart, events) {
    const use = events.filter(e => e && e.year && e.type && CATS.includes(e.type));
    if (!use.length) return { rate: null, detail: [] };
    let sum = 0; const detail = [];
    for (const e of use) {
      const sc = CATS.map(t => [t, yearEv(chart, e.year, t).score]).sort((a, b) => b[1] - a[1]);
      const rank = sc.findIndex(x => x[0] === e.type) + 1;
      const v = (CATS.length - rank) / (CATS.length - 1);
      sum += v;
      detail.push({ ...e, rank, of: CATS.length, val: +v.toFixed(2),
        verdict: rank === 1 ? '这个时辰把这一类排在头一位' : rank <= 3 ? `排第 ${rank}(前三)` : `排第 ${rank},靠后` });
    }
    return { rate: sum / use.length, n: use.length, detail };
  }

  // ——— 主函数 ———
  // events: [{year, type, good?}]  type 取 dashi 的事型 key;good 现在是**可选**的
  function solve(opts) {
    const { birth, gender, lon } = opts;
    const range = typeof opts.range === 'string' ? parseRange(opts.range)
      : { idx: (opts.range && opts.range.length ? opts.range : HOURS.map(h => h.idx)).slice(), label: opts.rangeLabel || '指定范围' };
    const events = (opts.events || []).filter(e => e && e.year && e.type);

    // 一、逐时辰排盘 + 结论指纹
    const cands = range.idx.map(i => {
      const c = chartAt(birth, i, gender, lon);
      return {
        idx: i, name: HOURS[i].name, span: HOURS[i].span,
        gz: c.pillars.hour.gz, chart: c,
        band: c.strength.band, tong: c.strength.tong,
        xi: c.yong.xiWx.join('、'), ji: c.yong.jiWx.join('、'),
        geju: c.geju ? c.geju.split('(')[0] : null,
        fp: fingerprint(c),
      };
    });

    // 二、同结论分组:指纹一样的归一堆
    const groupMap = {};
    for (const c of cands) (groupMap[c.fp] = groupMap[c.fp] || []).push(c);
    const groups = Object.keys(groupMap).map(fp => {
      const g = groupMap[fp];
      return {
        fp, hours: g.map(x => x.name), gzs: g.map(x => x.gz),
        band: g[0].band, xi: g[0].xi, ji: g[0].ji, geju: g[0].geju,
        note: g.length > 1
          ? `${g.map(x => x.name).join('、')}这${g.length}个时辰断出来完全一样(底子${Bazi.plainBand(g[0].band)}、旺你的是${g[0].xi}${g[0].geju ? '、' + Bazi.plainGe(g[0].geju) : ''})——在这几个之间怎么填都不影响结论,不必纠结。`
          : `${g[0].name}自成一档(底子${Bazi.plainBand(g[0].band)}、旺你的是${g[0].xi}${g[0].geju ? '、' + Bazi.plainGe(g[0].geju) : ''})。`,
      };
    }).sort((a, b) => b.hours.length - a.hours.length);

    // 三、事件回推:比「方向吻合度」(见上文 agreementOf 的实测缘由)
    let ranked = [], canDecide = false, reason = '';
    // 姻缘类不算「可用」:它的吉凶方向已撤下,拿它回推等于拿噪声定时辰
    const usable = events.filter(e => e.good !== undefined && e.good !== null && e.type !== 'yinyuan');
    const yyDropped = events.filter(e => e.type === 'yinyuan' && e.good !== undefined && e.good !== null).length;
    // v1.15:主路改成事型排名,吉凶方向降为**并列参考**(标了才算,不标不影响)。
    // 起判门槛也跟着松:事型这一路只要**两件**就能算(不必凑三件带好坏的)。
    const typed = events.filter(e => e && e.year && e.type);
    if (typed.length >= 2) {
      for (const c of cands) {
        const ta = typeAgreeOf(c.chart, typed);
        c.typeAgree = ta.rate; c.typeHits = ta.detail;
        const a = agreementOf(c.chart, usable);
        c.agree = a.rate; c.agreeHit = a.hit; c.agreeTotal = a.total; c.hits = a.detail;
      }
      const scored = cands.filter(c => c.typeAgree !== null);
      // 主排序看事型;打平了才拿吉凶方向断后(方向是可选信号,不许它反客为主)
      ranked = scored.slice().sort((a, b) => b.typeAgree - a.typeAgree || ((b.agree || 0) - (a.agree || 0)));
      if (!ranked.length) { reason = '这些年份在各时辰下都排不出名次,换几件年份记得准的事再试。'; }
      else {
        const top = ranked[0];
        const distinct = ranked.filter(x => x.fp !== top.fp);
        const gap = distinct.length ? top.typeAgree - distinct[0].typeAgree : 1;
        if (gap < 0.15) {
          reason = `头名与第一个「断法不同」的时辰只差 ${(gap * 100).toFixed(0)} 个百分点,分不开——就这几件事而言,这些时辰解释力相当,定不了就是定不了。`;
        } else if (top.typeAgree < 0.6) {
          reason = `就算头名,你报的那几类事在它的年表里也多数排得靠后(平均 ${(top.typeAgree * 100).toFixed(0)} 分)——要么年份记错了,要么这几个时辰都不对,要么是断法本身还不够。照实说:定不了。`;
        } else {
          canDecide = true;
          reason = `头名把你报的那几类事平均排到 ${(top.typeAgree * 100).toFixed(0)} 分,比第一个断法不同的时辰高 ${(gap * 100).toFixed(0)} 个百分点,可以定。`
            + (usable.length >= 3 && top.agree != null ? `(另外你标了好坏的那 ${usable.length} 件,它的吉凶方向吻合 ${(top.agree * 100).toFixed(0)}%——这一项只作参考,不参与排名。)` : '');
        }
      }
    } else {
      reason = `能用来回推的事只有 ${typed.length} 件(每件要有年份和类别),不足两件,无法回推——本次只给「哪些时辰断得一样」这一半答案。`
        + '**好坏不用你判**:只报哪一年发生了哪一类事就行,程序看那个时辰的年表把这一类排在第几。';
    }

    // 四、差异面板:各时辰到底差在哪
    const diffs = {
      band: [...new Set(cands.map(c => c.band))],
      xi: [...new Set(cands.map(c => c.xi))],
      geju: [...new Set(cands.map(c => c.geju || '正格'))],
      hourZhi: cands.map(c => ({ name: c.name, zhi: c.gz[1] })),
    };
    const sameAll = groups.length === 1;

    return {
      range, cands, groups, ranked, canDecide, reason, diffs, sameAll,
      events,
      advice: sameAll
        ? `好消息:你给的这个范围里,${cands.length} 个时辰断出来完全一样——底子${Bazi.plainBand(groups[0].band)}、旺你的是${groups[0].xi}。时辰不用再纠结了,随便填一个都不影响后面所有断语。`
        : (canDecide
          ? `按你给的事回推,最可能是${ranked[0].name}(${ranked[0].span},${ranked[0].gz})。${reason}`
          : `这个范围里断法不止一种(${groups.length} 档),但${reason}建议:再想想有没有更多确凿的事,或者按下面「差异面板」看看这几档差在哪、哪一档更像你。`),
    };
  }

  // ——— 结论稳不稳:你自己不确定的那点范围内,断出来的东西会不会翻个个儿 ———
  //
  // 缘起(v0.77,CLAUDE.md 待办第 9 条「从格边界专项体检」):
  //   用户当初报的是「样盘一的十二时辰里七个触发从格」。量了一遍,情况比那句话还硬:
  //   3000 天里有 9.70% 的日子,十二时辰中至少一个触发真从;而这些日子里 **100%** 是
  //   「换个时辰结论就不一样」,且喜忌也跟着整个翻转。另测经度:同一钟点,北京与乌鲁木齐
  //   从格判定不同的占 5.04%。
  //   从格一成立喜忌就反 180°,所以对一个不知道确切钟点的人,程序照旧给一个确定的喜忌,
  //   等于替他掷了一次硬币还不告诉他。**这不是断法问题,是该不该开口的问题。**
  //
  // 做法:拿他自己不确定的那点范围(不知钟点就是十二个时辰;只知道大概就是那几个),
  //   逐个排盘,看旺衰档/喜忌/从格三样会不会变。会变就当面说清楚,并指路去定时辰。
  //   **不偷偷改结论**——改了他更不知道自己站在哪。
  function stability(opts) {
    const { birth, gender, lon } = opts;
    const idx = (opts.hours && opts.hours.length ? opts.hours : HOURS.map(h => h.idx)).slice();
    const seen = idx.map(i => {
      const c = chartAt(birth, i, gender, lon);
      return {
        idx: i, name: HOURS[i].name, span: HOURS[i].span,
        band: c.strength.band, xi: c.yong.xiWx.slice().sort().join('、'),
        cong: c.cong ? c.cong.type : '不从',
        margin: c.cong ? c.cong.margin : null,
      };
    });
    const uniq = k => [...new Set(seen.map(x => x[k]))];
    const bandVaries = uniq('band').length > 1;
    const xiVaries = uniq('xi').length > 1;
    const congVaries = uniq('cong').length > 1;
    const zhenCong = seen.filter(x => x.cong === '从弱' || x.cong === '从强');
    // 最险的那一副离门槛还剩多少分(只看真从)
    const tightest = zhenCong.length ? Math.min(...zhenCong.map(x => x.margin)) : null;
    // 按「喜忌」分档,好把话说具体:哪几个时辰喜这个、哪几个喜那个
    const camps = {};
    for (const x of seen) (camps[x.xi] = camps[x.xi] || []).push(x.name);
    const campList = Object.keys(camps).map(xi => ({ xi, hours: camps[xi] }))
      .sort((a, b) => b.hours.length - a.hours.length);

    // 「变了」也要分轻重:两拨时辰的喜用**毫无交集**(木火 vs 土金水)才叫方向相反;
    // 只是多一味少一味(木水 vs 木火水)是力度之差,不该拿同一句话吓人。
    const camps0 = [...new Set(seen.map(x => x.xi))].map(x => x.split('、'));
    let disjoint = false;
    for (let a = 0; a < camps0.length; a++) for (let b = a + 1; b < camps0.length; b++) {
      if (!camps0[a].some(w => camps0[b].includes(w))) disjoint = true;
    }

    let level = '稳', note = '';
    if (idx.length === 1) {
      level = '稳'; note = '你给了确切钟点,这副盘是唯一的,下面的结论不受时辰影响。';
    } else if (xiVaries) {
      level = disjoint ? '翻盘' : '不稳';
      note = `你没给确切钟点,而这一天的时辰是分水岭:` +
        campList.map(c => `${c.hours.join('、')}这${c.hours.length}个时辰旺你的是${c.xi}`).join(';') +
        (disjoint ? `——**两拨之间毫无交集,方向是相反的**。` : `——**多一味少一味,方向大体一致但力度有出入**。`) +
        (congVaries && zhenCong.length
          ? `病根在「从」的那一档(整盘顺着最旺的一股力走):${zhenCong.map(x => x.name).join('、')}这${zhenCong.length}个时辰判${zhenCong[0].cong},其余不判,` +
            `而从格一成立,该忌的全变成该喜的。最险的一个离门槛只剩 ${tightest} 分。`
          : '') +
        `先把出生钟点问准(问父母、翻出生证、查医院记录);问不准就去「生时校正」板块,拿已经发生过的事回推。` +
        (disjoint
          ? `在那之前,下面凡是靠「什么旺你、什么背你」推出来的话——颜色方位、哪年得力、择日的「对你」那一层——都只能当一半看。`
          : `在那之前,下面这些话的大方向可以照着走,只是力度别当准数。`);
    } else if (bandVaries) {
      level = '小动'; note = `没给确切钟点,不同时辰底子的厚薄不同(${uniq('band').map(Bazi.plainBand).join('/')}),但旺你的五行是同一组(${campList[0].xi})——` +
        `下面的结论方向不变,只是力度上会有出入。`;
    } else {
      level = '稳'; note = `没给确切钟点,但这一天的十二个时辰断出来是同一套(底子${Bazi.plainBand(uniq('band')[0])}、旺${campList[0].xi})——时辰不用纠结,填哪个都不影响下面的话。`;
    }
    return { level, note, seen, camps: campList, bandVaries, xiVaries, congVaries, tightest,
      zhenCongHours: zhenCong.map(x => x.name) };
  }

  // ——— 民俗征验:列出来,但把话说死——不可验证,只作参考,不作依据 ———
  const FOLK = [
    { name: '发旋(头旋)位置', say: '旧说头顶正中为子午卯酉时,偏左偏右各主四生四墓' },
    { name: '手指螺纹(斗与簸箕)数', say: '旧说以十指斗数配时辰' },
    { name: '兄弟姐妹数与排行', say: '旧说以时支所主子女宫反推' },
    { name: '睡姿(仰卧/侧卧/趴睡)', say: '旧说仰为子午卯酉、侧为寅申巳亥、伏为辰戌丑未' },
    { name: '出生时天光(天亮没亮、掌灯没掌灯)', say: '这条最实在——按当地当天的日出日落反推,比上面几条靠谱得多' },
  ];
  const FOLK_NOTE = '以上除最后一条外,都是民间说法,无从验证、各地讲法还不一样,只能当线索,不作依据。' +
    '真要把生时校准,还是拿已经发生过的事去回推——那是唯一能被推翻、也因此才算数的办法。';

  // ══════════════════════════════════════════════════════════════════════════
  //  精校(v1.11):把「十二时辰选一个」升级成「分钟级区间」
  // ══════════════════════════════════════════════════════════════════════════
  // 缘起:用户 2026-08-03「深入的做这个生辰矫正,我要做最专业最精确的生辰矫正功能」。
  //
  // **先量后改**,量出来的天花板是这样的(1990-06-15 北京,逐分钟扫一天):
  //   时柱 12 次跳变(2 小时一格,这是中式的粒度天花板)· 喜忌 8 次 · 旺衰 6 次 · 从格 4 次
  //   **上升星座 12 次,但它的边界与时辰边界不重合**——两者交错,一天被切成约 24 段
  //   **上升度数连续,每分钟走 0.25°** ← 全项目唯一的分钟级刻度
  // 结论:靠中式一家,精度锁死在 2 小时;把西洋的上升接进来,才谈得上「精确」。
  //
  // 四路证据,各自的出处与强度写在 CHANNELS 里,**不合成一个总分**——
  // 每一路各给一组「可能的分钟区间」,最后取**交集**;交集空了就照实说几路打架。
  //   A 事件方向回推(中式,既有;分辨率 = 时柱段,2 小时)
  //   B 慢星过四轴(西洋,新;分辨率到分钟——这是精度的来源)
  //   C 起运换运年(中式,新;连续量,能在一个时辰**内部**再切)
  //   D 命宫 / 上升星座(展示与旁注,**不计分**——落宫主什么各派不一,不硬造)
  //
  // **诚实分级(§三)**:分段的边界是排盘层,可核可验;
  //   「拿事件去卡区间」这套组合规则是本项目自拟的、**零回测**,与合盘同档。
  //   西洋以行运校时是行内通行做法,同样没有公开的回测支撑。第一屏必须写着。
  const HONEST_FINE = '这一层分两截,分清楚了才不会被数字骗。' +
    '**一、区间边界是算出来的**——生时那一格什么时候换格、上升什么时候换星座、命宫什么时候换宫、' +
    '换大运的年份怎么挪,全都可核可验,这一半是硬的。' +
    '**二、拿事件去定是哪一段,本程序做不到分钟级,并且照实告诉你为什么**:' +
    '自测(随机生日、随机真出生时刻,事件的好坏由真盘定的理想情形)量出两个数——' +
    '拿慢星过四轴去卡,每次都敢收窄到约 50 分钟,可真时刻只有 18.9% 落在里头(碰运气是 3.0%);' +
    '它确实带一点信号,但八成会把真答案排除掉,所以本程序**不拿它定生辰**,只摆出来给你对照。' +
    '真正用来定的只有「已发生的事」那一路,而它最细只到生时那一格(两小时),' +
    '多数时候还拉不开差距——那时程序就说分不开,不替你挑一个。';

  const CHANNELS = {
    A: { name: '已发生的事(中式年表方向)', 分辨率: '生时那一格(2 小时)', 出处: '本程序年表事型证据链;方向由喜忌定,喜忌由时柱定', 强度: '唯一能自证可推翻的一路,但只到 2 小时' },
    B: { name: '慢星走到四轴(西洋行运)', 分辨率: '分钟(但不用于定生辰)', 出处: '通行占星行运口径;位置层可核(对过 DE421)', 强度: '**不计票**——自测收窄到约 50 分钟时真时刻只有 18.9% 在内(碰运气 3.0%),八成会排除掉真答案' },
    C: { name: '换大运的年份', 分辨率: '时辰内可再切', 出处: '三日为年折除法(《三命通会》论大运)', 强度: '全天只差约四个月,单用嫌粗,配合别路收边' },
    D: { name: '命宫 / 上升星座', 分辨率: '换宫换座处', 出处: '命宫依《三命通会》(殆知阁本)命宫章;上升依 Placidus 排盘', 强度: '**不计分**,只作对照——落宫主什么各派不一' },
  };

  // ——— 上升点逐分钟表:Astro.ascendant 是纯三角,便宜;不必调整盘的 Astro.chart ———
  function ascTable(birth, lat, lon, Astro) {
    const y = birth.getFullYear(), mo = birth.getMonth() + 1, d = birth.getDate();
    const out = new Array(1440);
    for (let m = 0; m < 1440; m++) {
      const jd = Astro.jdOf(Astro.birthMoment(y, mo, d, Math.floor(m / 60), m % 60));
      out[m] = Astro.ascendant(jd, lon, lat);
    }
    return out;
  }

  // ——— 断点扫描:这些量都是「分钟」的阶梯函数,用二分找边界,不硬扫 1440 次 ———
  // 指纹 = 时柱 + 旺衰 + 喜忌 + 从格 + 命宫 +(有经纬度时)上升星座
  function fineSegments(opts, Astro) {
    const { birth, gender, lon, lat } = opts;
    const y = birth.getFullYear(), mo = birth.getMonth(), d = birth.getDate();
    const hasGeo = lat != null && lon != null && Astro;
    const asc = hasGeo ? ascTable(birth, lat, lon, Astro) : null;
    const cache = new Map();
    const at = m => {
      if (cache.has(m)) return cache.get(m);
      const c = Bazi.chart(new Date(y, mo, d, Math.floor(m / 60), m % 60), gender, lon != null ? { lon } : undefined);
      const v = {
        chart: c,
        fp: [c.pillars.hour.gz, c.strength.band, c.yong.xiWx.slice().sort().join(''),
          c.cong ? c.cong.type : '-', c.mingGong ? c.mingGong.gz : '-',
          asc ? Astro.SIGNS[Math.floor(asc[m].asc / 30)] : '-'].join('|'),
      };
      cache.set(m, v);
      return v;
    };
    // 粗扫 8 分钟一步,变了再二分到分钟
    const segs = [];
    let start = 0, cur = at(0);
    for (let m = 8; m <= 1439; m += 8) {
      const mm = Math.min(m, 1439), nx = at(mm);
      if (nx.fp === cur.fp) continue;
      let lo = mm - 8, hi = mm;                       // (lo 同旧, hi 已不同]
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (at(mid).fp === cur.fp) lo = mid; else hi = mid; }
      segs.push({ from: start, to: hi - 1, ...cur });
      start = hi; cur = at(hi);
    }
    segs.push({ from: start, to: 1439, ...cur });
    return segs.map(s => {
      const c = s.chart;
      return {
        from: s.from, to: s.to, mins: s.to - s.from + 1, fp: s.fp, chart: c,
        span: `${hhmm(s.from)}–${hhmm(s.to)}`,
        hourGZ: c.pillars.hour.gz, hourName: HOURS[ZHI.indexOf(c.pillars.hour.zhi)] ? HOURS[ZHI.indexOf(c.pillars.hour.zhi)].name : c.pillars.hour.zhi + '时',
        band: c.strength.band, xi: c.yong.xiWx.join('、'),
        cong: c.cong ? c.cong.type : null, mingGong: c.mingGong ? c.mingGong.gz : null,
        ascSign: asc ? Astro.SIGNS[Math.floor(asc[s.from].asc / 30)] : null,
        ascFrom: asc ? +asc[s.from].asc.toFixed(2) : null, ascTo: asc ? +asc[s.to].asc.toFixed(2) : null,
      };
    });
  }
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  // ——— B 路:慢星走到四轴,**解析反解**成分钟区间 ———
  // 道理:行运星 λ(t) 在事件那一年扫过一段黄经;它与上升成某个相位,要求 ASC ≡ λ − 相位角。
  // 于是「这一年被打中」等价于「ASC 落在某一段」,而 ASC 是分钟的单调函数——反查即得分钟区间。
  // 不必逐分钟跑行运(那要几十秒),两次取黄经就够。
  // **木星不计票,只作旁注——这是量出来的,不是拍的。**
  // 实测(1990-06-15 北京,三个事件年):木星一年走约 30°,配三个相位后,单它一颗
  // 就在全天铺出约 1050 分钟的窗口——**任何年份它都能「解释」**,那不是证据是噪声。
  // 而土星每年约 12°(单相位窗约 45 分钟)、天海冥每年 1–4°(窗 16–62 分钟三年合计),
  // 才是真正能把区间切窄的刻度。木星照旧算出来摆着,但不进计票。
  const B_MOVERS = [
    { k: 'sat', name: '土星', w: 3, vote: true, say: '结构定形、责任加身的那种年份' },
    { k: 'plu', name: '冥王星', w: 3, vote: true, say: '连根翻动、回不去原样的那种年份' },
    { k: 'ura', name: '天王星', w: 2, vote: true, say: '突发变动、旧安排待不住的那种年份' },
    { k: 'nep', name: '海王星', w: 2, vote: true, say: '边界模糊、判断力下降的那种年份' },
    { k: 'jup', name: '木星', w: 0, vote: false, say: '机会扩张的那种年份(走得快,一年三十度,任何年份它都能对上——只摆着,不计票)' },
  ];
  const B_ASPS = [{ deg: 0, key: '合' }, { deg: 90, key: '刑' }, { deg: 180, key: '冲' }];
  function angleWindows(birth, lat, lon, events, Astro) {
    const asc = ascTable(birth, lat, lon, Astro);
    // ASC 值 → 分钟集合(ASC 一天单调走完 360°,但速度随星座变,故按表反查)
    const minutesForAscRange = (a0, a1) => {          // 含首尾,处理跨 0°
      const inR = v => { const d = ((v - a0) % 360 + 360) % 360; return d <= ((a1 - a0) % 360 + 360) % 360; };
      const out = [];
      let s = null;
      for (let m = 0; m < 1440; m++) {
        if (inR(asc[m].asc)) { if (s === null) s = m; }
        else if (s !== null) { out.push([s, m - 1]); s = null; }
      }
      if (s !== null) out.push([s, 1439]);
      return out;
    };
    const hits = [];
    for (const e of events) {
      if (!e.year) continue;
      const jd0 = Astro.jdOf(new Date(Date.UTC(e.year, 0, 1))), jd1 = Astro.jdOf(new Date(Date.UTC(e.year + 1, 0, 1)));
      for (const mv of B_MOVERS) {
        const l0 = Astro.lonAt(mv.k, jd0), l1 = Astro.lonAt(mv.k, jd1);
        if (isNaN(l0) || isNaN(l1)) continue;         // 冥王出表照实跳过
        // 这一年里行运星扫过的黄经段(含逆行往返:取最小包络)
        let lo = Math.min(l0, l1), hi = Math.max(l0, l1);
        if (hi - lo > 180) { const t = lo; lo = hi; hi = t + 360; }   // 跨 0°
        for (const asp of B_ASPS) {
          const a0 = ((lo - asp.deg) % 360 + 360) % 360, a1 = ((hi - asp.deg) % 360 + 360) % 360;
          for (const [f, t] of minutesForAscRange(a0, a1)) {
            hits.push({ year: e.year, what: e.what || '', mover: mv.name, w: mv.w, vote: mv.vote, asp: asp.key, from: f, to: t,
              plain: `${e.year} 年${e.what ? '「' + e.what + '」' : ''}——${mv.name}${asp.key}上升:${mv.say}。要这一年被打中,生时得落在 ${hhmm(f)}–${hhmm(t)}` +
                (mv.vote ? '' : '(此条不计票)') });
          }
        }
      }
    }
    return hits;
  }

  // ——— C 路:换大运的年份 ———
  // 起运岁由「到节气还有多久」折算(三日为年),是分钟的连续函数;全天只差约四个月,
  // 单用嫌粗,但它能在**一个时辰内部**再切一刀,与 A 路正交。
  function dayunWindows(birth, gender, lon, turnYears) {
    if (!turnYears || !turnYears.length) return [];
    const y = birth.getFullYear(), mo = birth.getMonth(), d = birth.getDate();
    const hitAt = m => {
      const c = Bazi.chart(new Date(y, mo, d, Math.floor(m / 60), m % 60), gender, lon != null ? { lon } : undefined);
      const list = (c.dayun && c.dayun.list) || [];
      if (!list.length) return null;
      return turnYears.map(ty => list.some(s => Math.abs((y + s.fromAge) - ty) <= 0.5));
    };
    const out = [];
    turnYears.forEach((ty, i) => {
      let s = null;
      for (let m = 0; m < 1440; m += 10) {            // 10 分钟一步足够:全天只挪约四个月
        const h = hitAt(m);
        const ok = h && h[i];
        if (ok) { if (s === null) s = m; }
        else if (s !== null) { out.push({ year: ty, from: s, to: m - 1, plain: `${ty} 年换大运——生时落在 ${hhmm(s)}–${hhmm(m - 1)} 才对得上` }); s = null; }
      }
      if (s !== null) out.push({ year: ty, from: s, to: 1439, plain: `${ty} 年换大运——生时落在 ${hhmm(s)}–${hhmm(1439)} 才对得上` });
    });
    return out;
  }

  // ——— 主函数:四路各给区间,取交集 ———
  // opts: { birth, gender, lon, lat, events:[{year,type,good,what}], turnYears:[年], Astro }
  function rectify(opts) {
    const Astro = opts.Astro || (typeof root !== 'undefined' && root.Astro) || null;
    const hasGeo = opts.lat != null && opts.lon != null && !!Astro;
    const segs = fineSegments(opts, hasGeo ? Astro : null);
    const events = (opts.events || []).filter(e => e && e.year);

    // ——— A 路:判据与 solve 同源(v1.12 收紧)———
    // **改严的缘由是量出来的**(用户 2026-08-03:「宁可保留质量最好,也不要出错」):
    // 旧判据是「吻合度 ≥ 最高分减 0.15」,松到几乎每段都过。换成 solve 那套
    // (同断法归一组、头名要与**第一个断法不同**的组拉开 gap≥0.15、且头名 ≥0.6)之后,
    // 蒙特卡洛 53 例里**一次都不敢收窄**——那不是程序无能,是三四件同类事本来就分不开。
    // 照 v0.61 定下的规矩:**分不开就说分不开**,不许把「大家都对得上」说成「就是这一段」。
    // v1.15:与 solve 一起改走**事型**——不再要用户判好坏(很多事当事人根本判不了),
    // 门槛也从三件降到两件。好坏若填了只作参考,不参与排名。
    const usable = events.filter(e => e && e.year && e.type);
    let aBest = null, aGap = null, aDecided = false;
    if (usable.length >= 2) {
      for (const s of segs) { const a = typeAgreeOf(s.chart, usable); s.agree = a.rate; s.agreeDetail = a.detail; }
      const scored = segs.filter(s => s.agree !== null);
      if (scored.length) {
        const rk = scored.slice().sort((x, y) => y.agree - x.agree);
        const top = rk[0], other = rk.find(x => x.fp !== top.fp);
        aBest = top.agree;
        aGap = other ? top.agree - other.agree : 1;
        aDecided = aGap >= 0.15 && top.agree >= 0.6;
        if (aDecided) for (const s of segs) s.aPass = s.fp === top.fp;
      }
    }
    // ——— 通则:**盖满全天的证据不算证据** ———
    // 木星那一条是量出来的特例(一年三十度,任何年份都能对上);但同一个病会从别处再犯:
    // C 路实测就撞上了——起运岁全天只挪约 0.3 岁,若用户报的换运年正落在那个区间里,
    // 这一路会给**每一段**都 +1 票,看着热闹,实则一分区分度都没有。
    // 所以统一加一道闸:某条线索若覆盖 ≥95% 的候选分钟,它就不参与计票,并当面说明为什么。
    const NOSPLIT = 0.95;
    const covered = list => { const set = new Set(); for (const h of list) for (let m = h.from; m <= h.to; m++) set.add(m); return set.size; };
    const useful = list => list.length > 0 && covered(list) < 1440 * NOSPLIT;

    // ——— B 路(慢星过四轴):v1.12 起**整路降为旁注,不参与收窄** ———
    // **这是量出来的,不是保守起见**。拿合成真值做蒙特卡洛(生日与真出生分钟随机,
    // 事件的好坏由**真盘**判定——这是对求解器最有利的理想自洽情形):
    //   带这一路时,程序每次都敢收窄到平均 50 分钟,**而真时刻只有 18.9% 落在给出的区间里**
    //   (随机基线 3.0%——所以它确实带一点信号,比碰运气强六倍,但**八成会把真时刻排除掉**)。
    // 一个把真答案排除掉八成的东西,不配拿来定生辰。它照旧算出来摆着(窗口是真的、
    // 可核可验),但**一票不投**,并且当面把 18.9% 这个数写给用户看。
    // 要让它够格计票,得有真实语料(真人的真事 + 档案级出生时刻)——本项目没有,照实挂着。
    const bHits = hasGeo && events.length ? angleWindows(opts.birth, opts.lat, opts.lon, events, Astro) : [];
    const bByYear = {}, bDropped = [];
    const bCover = () => 0;                       // 不计票
    const bYears = 0;
    // C 路(同一道闸)
    const cAll = dayunWindows(opts.birth, opts.gender, opts.lon, opts.turnYears);
    const cByYear = {}, cDropped = [];
    for (const h of cAll) (cByYear[h.year] = cByYear[h.year] || []).push(h);
    const cHits = [];
    for (const yy of Object.keys(cByYear)) {
      if (useful(cByYear[yy])) cHits.push(...cByYear[yy]);
      else cDropped.push(`${yy} 年这个换运年在全天任何时刻都成立(起运岁一天只挪约 0.3 岁),切不动,不计票`);
    }
    const cCover = m => cHits.filter(h => m >= h.from && m <= h.to).length;

    // ——— 不做硬交集,改数「可数的证据票」———
    // **这一改是量出来的**:去掉木星之后,三个事件年里没有任何一分钟能被慢星全部打中
    // (实测 0 分钟全中、53 分钟中两个)。原因不是程序不准,是**真实人生里多数年份四轴上
    // 本来就没有慢星**。硬按「每件事都得被解释」求交集,工具只会永远回答「打架」——
    // 那是把模型的苛刻说成了用户记错。改成:每段数它对上几条证据,取票数最高的一档,
    // 并把票面摊开给人看。**不合成百分比**——票是可数的条目,合成一个分数只会显得比实际精确。
    for (const s of segs) {
      const mins = rangeMins(s);
      s.bBest = 0;                                  // 慢星那一路不计票(实测 18.9%,见 B_MOVERS 上方)
      s.cBest = cHits.length ? Math.max(...mins.map(cCover)) : 0;
      s.votes = (s.aPass ? 1 : 0) + s.cBest;
      s.voteWhy = [];
      if (s.aPass) s.voteWhy.push('你报的那几类事,这一段的年表把它们排得最靠前,且与断法不同的那一档拉开了差距');
      if (s.cBest) s.voteWhy.push(`换大运的年份对上 ${s.cBest} 个`);
      // 段内收窄:只有换大运那一路是连续量,能在段内再切;慢星不参与
      if (s.cBest) {
        const best = s.cBest;
        const good = mins.filter(m => cCover(m) >= best);
        if (good.length && good.length < mins.length) {
          s.narrowFrom = good[0]; s.narrowTo = good[good.length - 1];
          s.narrowSpan = `${hhmm(good[0])}–${hhmm(good[good.length - 1])}`; s.narrowMins = good.length;
        }
      }
    }
    const maxVotes = Math.max(0, ...segs.map(s => s.votes));
    const anyEvidence = maxVotes > 0;
    const alive = anyEvidence ? segs.filter(s => s.votes === maxVotes) : segs.slice();
    const totalMins = alive.reduce((a, s) => a + (s.narrowMins != null ? s.narrowMins : s.mins), 0);
    const width = `${totalMins} 分钟`;
    // 谁卡的边
    const bounds = [];
    if (usable.length >= 2) bounds.push(`已发生的事(${usable.length} 件,按事型比对)把范围压到生时那一格这一级(两小时)`);
    else bounds.push(`能用来回推的事只有 ${usable.length} 件(要两件才算数,只需年份与类别),这一路没使上劲`);
    if (bHits.length) bounds.push(`慢星过四轴算了 ${bHits.length} 条窗口,但**一票不投**:自测里拿它收窄,每次都敢收到约 50 分钟,而真时刻只有 18.9% 落在里头(碰运气是 3.0%)——八成会把真答案排除掉。窗口摆给你看,不拿它定生辰`);
    else if (!hasGeo) bounds.push('没有出生地经纬度,上升那一层排不出来——补上能多一层对照(但它照旧不参与定生辰)');
    else bounds.push('没给事件年份,慢星那一路无从下手');
    if (cHits.length) bounds.push('换大运的年份又切了一刀(这一路能在一个时辰内部再分)');
    for (const x of bDropped.concat(cDropped)) bounds.push(x + '——盖满全天的线索区分不出任何东西,照实剔除,不拿它凑数');

    // 票面必须当面报出来:说「还剩几段」而不报「各对上几条」,等于把没验到的当验到了
    const voteNote = anyEvidence ? `(对上 ${maxVotes} 条能计票的证据)` : '';
    const first = !anyEvidence
      ? `这一天按「断出来会不会变」切成 ${segs.length} 段,**眼下一段也排除不掉**(合计 ${width})。`
        + (usable.length < 3
          ? `能拿来定生辰的只有「已发生的事」那一路,它要两件以上——每件只报「哪一年 + 哪一类」就行,**好坏不用你判**。你现在给了 ${usable.length} 件,线索还不够。`
          : `能拿来定生辰的只有「已发生的事」那一路,它算过了,但在你给的这些事上拉不开高下——**分不开就是分不开,不替你挑一个。**`)
        + `下面把每一段各是什么摆出来,你自己对照;要再往下走见「下一步」。`
      : alive.length === 1
        ? `生时落在 ${alive[0].narrowSpan || alive[0].span}${voteNote},共 ${alive[0].narrowMins || alive[0].mins} 分钟宽,按时辰算是${alive[0].hourName}。`
        : `还剩 ${alive.length} 段并列${voteNote},合计 ${width}:${alive.slice(0, 4).map(s => (s.narrowSpan || s.span)).join('、')}${alive.length > 4 ? ' 等' : ''}。这几段证据一样多,分不出高下——分不开就是分不开。`;
    const next = usable.length < 3
      ? `下一步最管用的:再报几件事——每件只要「哪一年 + 哪一类」(结婚、换工作、进钱、搬家、生孩子、生病、考学、官司…),**好坏不用你判**。现在只有 ${usable.length} 件,不足两件。`
      : (!aDecided && aBest != null)
        ? `下一步最管用的:换几件**类别更杂**的事(事业、财运、健康、文书、官非各来一件)。现在头名吻合 ${(aBest * 100).toFixed(0)}%,`
          + `但与断法不同的那一档只差 ${((aGap || 0) * 100).toFixed(0)} 个百分点——要拉开 15 个点才敢开口,同一类事再多也拉不开。`
        : (!opts.turnYears || !opts.turnYears.length)
          ? '下一步最管用的:报一两个「那一年整个轨道变了」的年份(换工作、换城市、换身份那种)。换大运的年份是连续量,能在一格内部再切一刀。'
          : '再往下要靠精确到月的事发日期,那超出本程序现在能做的——照实说,不硬往下猜。';

    return {
      segs, alive, width, totalMins, bHits, cHits, bounds, channels: CHANNELS, honest: HONEST_FINE,
      hasGeo, aBest, aGap, aDecided, bYears, maxVotes, anyEvidence, bDropped, cDropped, first, next,
      say: first + ' ' + next,
    };
  }
  function rangeMins(s) { const out = []; for (let m = s.from; m <= s.to; m++) out.push(m); return out; }

  function material(res, birthText) {
    const g = res.groups.map(x => '· ' + x.note).join('\n');
    const r = res.ranked.length
      ? res.ranked.slice(0, 6).map((c, i) =>
        `${i + 1}. ${c.name}(${c.span},${c.gz}):${c.band}、喜${c.xi}${c.geju ? '、' + c.geju : ''};` +
        `方向吻合 ${(c.agree * 100).toFixed(0)}%(吻合权重 ${c.agreeHit}/${c.agreeTotal})` +
        (c.hits ? `\n     逐件:${c.hits.map(h => `${h.year}年${h.what || h.type}(${h.good ? '好事' : '坏事'})→此时辰判${h.dir > 0 ? '吉' : (h.dir < 0 ? '凶' : '平')},${h.verdict}`).join(';')}` : '')
      ).join('\n')
      : '(可判方向的事不足三件,无排名)';
    return `【生时校正(程序按事件方向回推算死,勿另立结论)】\n生辰:${birthText || ''};候选范围:${res.range.label}\n\n` +
      `[断得一样的时辰分组]\n${g}\n\n[事件方向回推排名]\n${r}\n\n[能不能定]\n${res.canDecide ? '可以定' : '定不了'}——${res.reason}\n\n` +
      `【写法要求】第一句就把结论说死:是「这几个时辰断出来一样、不用纠结」,还是「最可能是某时辰」,还是「定不了」。` +
      `定不了就照实说定不了,再告诉他还缺什么(多给几件方向鲜明的确凿事)。` +
      `不许拿相貌性格这类说辞硬定时辰,不许出现干支十神喜忌这些名目,不许说「仅供参考」「因人而异」这类空话。`;
  }

  // ══════════════════════════════════════════════════════════════════
  //  这几段的差别到底改变了什么(v1.17)
  // ══════════════════════════════════════════════════════════════════
  // 缘起:用户 2026-08-03「排盘问题解决就去解读,生辰矫正八字星盘需要大换血」。
  // **先量后改**:界面上「还站得住的区间」给的是十行参数堆——
  //   「00:32–01:43(72 分钟,子时戊子)底子薄、旺你的是金、土 · 命宫丁亥 · 上升双鱼」
  // **十行里说了「这个差别意味着什么」的:0 行**。而这 25 段里藏着 **4 组不同的喜用**,
  // 其中两组正好相反(金土 vs 木水火)——也就是说这一页正在用参数的形式,
  // 掩盖「你的盘可能在叫你往相反方向走」这件事。
  //
  // 修法照用户那句话办:「你直接从这个八字里面看出来不就行了吗」——
  // **把跨全部存活区间不变的东西挑出来**(那些不管几点生都已经定了,现在就能用),
  // 与**随区间变的东西**分开报。这一层**一个断法都不自算**(§四):
  // 只读各段已经排好的 chart,做集合运算。
  const WX5 = ['木', '火', '土', '金', '水'];
  function stakes(r) {
    if (!r || !r.alive || !r.alive.length) return null;
    const A = r.alive;
    const gz = (s, k) => s.chart && s.chart.pillars && s.chart.pillars[k] ? s.chart.pillars[k].gz : '';
    const uniq = f => [...new Set(A.map(f))];
    // 一、跨全部存活区间不变的 = 不管几点生都已经定了
    const fixed = [], varies = [];
    const push = (arr, label, vals, say) => arr.push({ label, vals, say });
    const yearGZ = uniq(s => gz(s, 'year')), monthGZ = uniq(s => gz(s, 'month')), dayGZ = uniq(s => gz(s, 'day'));
    const dayWx = uniq(s => s.chart && s.chart.dayWx);
    const bands = uniq(s => s.band), xis = uniq(s => s.xi), congs = uniq(s => s.cong || '不从');
    // 日主那一行要说清它与「哪一天生的」的关系:两者可以一个变一个不变
    // (庚戌与辛亥是两天,可日主同属金)——不写明这一层,与下一行读起来像自相矛盾。
    const crossDay = dayGZ.length > 1;
    (dayWx.length === 1 ? push.bind(null, fixed) : push.bind(null, varies))(
      '你本人属哪一行', dayWx,
      dayWx.length === 1
        ? `你本人属${dayWx[0]}` + (crossDay ? '——虽然下面那条说「哪一天生的」有两种可能,但两种算下来都属这一行,所以这一条是稳的' : '——这一条钟点动不了它')
        : `随钟点变,有 ${dayWx.length} 种:${dayWx.join('/')}——跨了日界,连「你本人属哪一行」都还没定`);
    (yearGZ.length === 1 && monthGZ.length === 1 && !crossDay ? push.bind(null, fixed) : push.bind(null, varies))(
      '出生年月日那三格', [yearGZ.join('/'), monthGZ.join('/'), dayGZ.join('/')].join(' '),
      !crossDay ? '这三格由生日定,钟点改不了——凡是只吃这三格的判断,现在就能用'
        : '你这个钟点正好压在日界上(按真太阳时算,后半夜那几分钟还算前一天):连「哪一天生的」都有两种可能,这是最该先问准的一条');
    (bands.length === 1 ? push.bind(null, fixed) : push.bind(null, varies))(
      '底子厚薄', bands.map(b => Bazi.plainBand(b)), bands.length === 1 ? `一律是「${Bazi.plainBand(bands[0])}」` : `有 ${bands.length} 种说法:${bands.map(b => Bazi.plainBand(b)).join(' / ')}`);
    (xis.length === 1 ? push.bind(null, fixed) : push.bind(null, varies))(
      '旺你的那几行', xis, xis.length === 1 ? `一律是${xis[0]}` : `有 ${xis.length} 种说法:${xis.join(' / ')}`);
    if (congs.length > 1) push(varies, '走的是哪一档', congs, `有 ${congs.length} 种:${congs.join(' / ')}`);

    // 二、按「旺你的那几行」并组——这一项一变,下游全变(挑行业、挑方位、挑颜色、挑年份)
    const byXi = new Map();
    for (const s of A) {
      const k = s.xi;
      if (!byXi.has(k)) byXi.set(k, { xi: k, wx: String(k).split(/[、,,]/).filter(Boolean), mins: 0, segs: [], spans: [], bands: new Set() });
      const g = byXi.get(k);
      g.mins += (s.narrowMins || s.mins); g.segs.push(s); g.spans.push(s.narrowSpan || s.span); g.bands.add(s.band);
    }
    const groups = [...byXi.values()].sort((a, b) => b.mins - a.mins);
    const total = groups.reduce((a, g) => a + g.mins, 0) || 1;
    for (const g of groups) {
      g.pct = Math.round(100 * g.mins / total);
      g.bandSay = [...g.bands].map(b => Bazi.plainBand(b)).join('/');
      const st = g.segs[0];
      const dy = st.chart && st.chart.dayun;
      g.startAge = dy && dy.list && dy.list.length ? Math.round(dy.list[0].fromAge) : null;
      g.say = `${g.spans.slice(0, 3).join('、')}${g.spans.length > 3 ? ` 等 ${g.spans.length} 段` : ''}` +
        `(合 ${g.mins} 分钟,占${g.pct}%):旺你的是${g.xi},底子${g.bandSay}` +
        (g.startAge != null ? `,${g.startAge} 岁起运` : '');
    }
    // 三、**两组喜用毫无交集 = 翻盘**(v0.77 定的判据,这里照用,不另立)
    const flips = [];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      if (!a.wx.some(x => b.wx.includes(x))) flips.push({ a: a.xi, b: b.xi, aMins: a.mins, bMins: b.mins });
    }

    // 四、串成话:先说定了什么(现在就能用),再说定不下来的是什么(以及它压着哪些决定)
    let story = '';
    if (fixed.length) story += `先说不管你几点生都已经定了的——这些现在就能用:\n`
      + fixed.map(x => `· ${x.label}:${x.say}`).join('\n');
    if (varies.length) story += `${fixed.length ? '\n\n' : ''}再说钟点没定就定不下来的:\n`
      + varies.map(x => `· ${x.label}:${x.say}`).join('\n');
    if (groups.length === 1) {
      story += `\n\n好消息是:剩下这些区间虽然分不开,但它们**给的是同一套结论**——旺你的都是${groups[0].xi}。`
        + `钟点问不准也不耽误用,挑方向、挑年份照这一套走就是。`;
    } else {
      story += `\n\n这些区间分成 ${groups.length} 套结论:\n` + groups.map(g => '· ' + g.say).join('\n');
      if (flips.length) {
        const f = flips[0];
        story += `\n\n**其中至少两套是正好相反的**:一套说旺你的是${f.a},另一套说是${f.b},两边一个字都不重合。`
          + `这不是差一点,是反着走——挑行业、挑方位、挑穿用的颜色、挑哪几年动大事,四处全反。`
          + `所以在钟点问准之前,凡是靠「旺你的是哪几行」的话,一句都别当准;`
          + `只吃出生年月日那三格的判断不受影响,照用。`;
      } else {
        story += `\n\n这几套结论互相有重合的部分——重合的那几行大致可信,不重合的先别下注。`;
      }
      story += `\n\n把钟点问准最省事的两条路:一是出生证或出生医学记录上的时间(最硬),`
        + `二是问当时在场的人「天亮没有、吃过哪一顿饭」,能把范围缩到两三个时辰,再回来跑一遍。`;
    }
    return { fixed, varies, groups, flips, flipped: flips.length > 0, story,
      honest: '这一层不新算任何东西:每一段的盘是上面已经排好的,这里只做一件事——' +
        '把各段一一比对,挑出「哪些结论各段都一样」和「哪些各段不一样」。' +
        '「毫无交集就叫翻盘」这个判据沿用本程序原有的口径,不另立一套。' };
  }

  // 精校的材料:与 solve 那份分开,写法要求一样钉死(§五 程序算死、AI 只解释)
  function fineMaterial(r, birthText) {
    const seg = s => `${s.narrowSpan || s.span}(${s.narrowMins || s.mins}分,${s.hourName}${s.hourGZ}` +
      `,底子${Bazi.plainBand(s.band)}、旺${s.xi}${s.mingGong ? `、命宫${s.mingGong}` : ''}${s.ascSign ? `、上升${s.ascSign}` : ''})`;
    const st = stakes(r);
    return `【生时精校(程序算死,勿另立结论)】\n生辰:${birthText || ''}\n\n` +
      `[结论]${r.first}\n[还剩几段]${r.alive.length} 段:\n${r.alive.slice(0, 8).map(s => '· ' + seg(s)).join('\n') || '(无)'}\n\n` +
      (st ? `[这几段的差别改变了什么——按这个次序讲,这是本页的重点]\n${st.story}\n\n` : '') +
      `[慢星过四轴命中]\n${r.bHits.slice(0, 10).map(h => '· ' + h.plain).join('\n') || '(这一路没用上)'}\n\n` +
      `[换大运年份]\n${r.cHits.map(h => '· ' + h.plain).join('\n') || '(没给转折年份)'}\n\n` +
      `[是谁把边界卡在这]\n${r.bounds.map(x => '· ' + x).join('\n')}\n\n[下一步]${r.next}\n\n` +
      `【写法要求】第一句就说死:落在哪个区间、多少分钟宽,还是几段分不开、还是打架。` +
      `**区间宽度必须报出来**,不许把「还剩 3 段」说成「就是某时辰」。` +
      `**重点在「差别改变了什么」那一段**:先讲不管几点生都已经定了、现在就能用的那几条,` +
      `再讲定不下来的那几条各压着什么决定;有相反的两套结论就点名说反,不许和稀泥。` +
      `末尾照实带一句:区间边界是算出来的,拿事件卡区间那套规则是本项目自拟的、零回测。` +
      `不许出现干支十神喜忌这些名目,不许说「仅供参考」「因人而异」。`;
  }

  return { solve, parseRange, chartAt, fingerprint, yearScore, yearEv, agreementOf, typeAgreeOf, CATS, stability, HOURS, VAGUE, FOLK, FOLK_NOTE, material,
    rectify, fineSegments, angleWindows, dayunWindows, fineMaterial, stakes, CHANNELS, HONEST_FINE, hhmm };
}));
