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
  function agreementOf(chart, events) {
    let hit = 0, total = 0;
    const detail = [];
    for (const e of events) {
      if (e.good === undefined || e.good === null) continue;      // 中性事件(搬家换工作)不参与方向判分
      const { score, dir } = yearEv(chart, e.year, e.type);
      const w = Math.abs(dir);
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
    const usable = events.filter(e => e.good !== undefined && e.good !== null);
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
      reason = `能用来判方向的事只有 ${usable.length} 件(要标明是好事还是坏事才算数),不足三件,无法回推——本次只给「哪些时辰断得一样」这一半答案。`;
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

  return { solve, parseRange, chartAt, fingerprint, yearScore, yearEv, agreementOf, HOURS, VAGUE, FOLK, FOLK_NOTE, material };
}));
