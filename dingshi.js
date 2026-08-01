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

  // ——— 主函数 ———
  // events: [{year, type}]  type 取 dashi 的事型 key
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
          ? `${g.map(x => x.name).join('、')}这${g.length}个时辰断出来完全一样(${g[0].band}、喜${g[0].xi}${g[0].geju ? '、' + g[0].geju : ''})——在这几个之间怎么填都不影响结论,不必纠结。`
          : `${g[0].name}自成一档(${g[0].band}、喜${g[0].xi}${g[0].geju ? '、' + g[0].geju : ''})。`,
      };
    }).sort((a, b) => b.hours.length - a.hours.length);

    // 三、事件回推:比「方向吻合度」(见上文 agreementOf 的实测缘由)
    let ranked = [], canDecide = false, reason = '';
    // 姻缘类不算「可用」:它的吉凶方向已撤下,拿它回推等于拿噪声定时辰
    const usable = events.filter(e => e.good !== undefined && e.good !== null && e.type !== 'yinyuan');
    const yyDropped = events.filter(e => e.type === 'yinyuan' && e.good !== undefined && e.good !== null).length;
    if (usable.length >= 3) {
      for (const c of cands) {
        const a = agreementOf(c.chart, usable);
        c.agree = a.rate; c.agreeHit = a.hit; c.agreeTotal = a.total; c.hits = a.detail;
      }
      const scored = cands.filter(c => c.agree !== null);
      ranked = scored.slice().sort((a, b) => b.agree - a.agree || b.agreeTotal - a.agreeTotal);
      if (!ranked.length) { reason = '这些年份在各时辰下都不表态(方向分都太弱),换几件方向鲜明的事再试。'; }
      else {
        const top = ranked[0];
        const distinct = ranked.filter(x => x.fp !== top.fp);
        const gap = distinct.length ? top.agree - distinct[0].agree : 1;
        if (gap < 0.15) {
          reason = `头名与第一个「断法不同」的时辰只差 ${(gap * 100).toFixed(0)} 个百分点,分不开——就这几件事而言,这些时辰解释力相当,定不了就是定不了。`;
        } else if (top.agree < 0.6) {
          reason = `就算头名,方向吻合度也只有 ${(top.agree * 100).toFixed(0)}%——多数事没被解释对。要么事记错了,要么这几个时辰都不对,要么是断法本身还不够。照实说:定不了。`;
        } else {
          canDecide = true;
          reason = `头名方向吻合 ${(top.agree * 100).toFixed(0)}%,比第一个断法不同的时辰高 ${(gap * 100).toFixed(0)} 个百分点,可以定。`;
        }
      }
    } else {
      reason = `能用来判方向的事只有 ${usable.length} 件(要标明是好事还是坏事才算数),不足三件,无法回推——本次只给「哪些时辰断得一样」这一半答案。`
        + (yyDropped ? `你给的 ${yyDropped} 件姻缘类没算进去:那一类的吉凶方向本程序已经撤下(回测量出来命盘对「结婚还是离婚」零区分度),拿它回推等于拿噪声定时辰。补几件事业、财运、健康类的事就能算。` : '');
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
        ? `好消息:你给的这个范围里,${cands.length} 个时辰断出来完全一样——${groups[0].band}、喜${groups[0].xi}。时辰不用再纠结了,随便填一个都不影响后面所有断语。`
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
          ? `病根在从格:${zhenCong.map(x => x.name).join('、')}这${zhenCong.length}个时辰判${zhenCong[0].cong},其余不判,` +
            `而从格一成立,该忌的全变成该喜的。最险的一个离门槛只剩 ${tightest} 分。`
          : '') +
        `先把出生钟点问准(问父母、翻出生证、查医院记录);问不准就去「定时辰」板块,拿已经发生过的事回推。` +
        (disjoint
          ? `在那之前,下面凡是靠喜忌推出来的话——旺你的颜色方位、哪年得力、择日的「对你」那一层——都只能当一半看。`
          : `在那之前,下面这些话的大方向可以照着走,只是力度别当准数。`);
    } else if (bandVaries) {
      level = '小动'; note = `没给确切钟点,不同时辰的身强身弱档位不同(${uniq('band').join('/')}),但旺你的五行是同一组(${campList[0].xi})——` +
        `下面的结论方向不变,只是力度上会有出入。`;
    } else {
      level = '稳'; note = `没给确切钟点,但这一天的十二个时辰断出来是同一套(${uniq('band')[0]}、旺${campList[0].xi})——时辰不用纠结,填哪个都不影响下面的话。`;
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
    '真要定时辰,还是拿已经发生过的事去回推——那是唯一能被推翻、也因此才算数的办法。';

  function material(res, birthText) {
    const g = res.groups.map(x => '· ' + x.note).join('\n');
    const r = res.ranked.length
      ? res.ranked.slice(0, 6).map((c, i) =>
        `${i + 1}. ${c.name}(${c.span},${c.gz}):${c.band}、喜${c.xi}${c.geju ? '、' + c.geju : ''};` +
        `方向吻合 ${(c.agree * 100).toFixed(0)}%(吻合权重 ${c.agreeHit}/${c.agreeTotal})` +
        (c.hits ? `\n     逐件:${c.hits.map(h => `${h.year}年${h.what || h.type}(${h.good ? '好事' : '坏事'})→此时辰判${h.dir > 0 ? '吉' : (h.dir < 0 ? '凶' : '平')},${h.verdict}`).join(';')}` : '')
      ).join('\n')
      : '(可判方向的事不足三件,无排名)';
    return `【定时辰(程序按事件方向回推算死,勿另立结论)】\n生辰:${birthText || ''};候选范围:${res.range.label}\n\n` +
      `[断得一样的时辰分组]\n${g}\n\n[事件方向回推排名]\n${r}\n\n[能不能定]\n${res.canDecide ? '可以定' : '定不了'}——${res.reason}\n\n` +
      `【写法要求】第一句就把结论说死:是「这几个时辰断出来一样、不用纠结」,还是「最可能是某时辰」,还是「定不了」。` +
      `定不了就照实说定不了,再告诉他还缺什么(多给几件方向鲜明的确凿事)。` +
      `不许拿相貌性格这类说辞硬定时辰,不许出现干支十神喜忌这些名目,不许说「仅供参考」「因人而异」这类空话。`;
  }

  return { solve, parseRange, chartAt, fingerprint, yearScore, yearEv, agreementOf, stability, HOURS, VAGUE, FOLK, FOLK_NOTE, material };
}));
