// yingqi.js — 答案之锚:取向(方位)、取期(年月日)、取数(量级)的机械推定
// 宗旨:同一卦只能推出同一个答案,颗粒度给足(日期必含年月日),规程先行、程序执行,
//      AI 只许在此锚上解释,或依卦面明说取其冲/次选——消灭"看着办"的主观空间。
// 取用规程(写死,盲测按此校):
//  · 取向:有动爻取最上动爻纳甲地支之方;静卦取世爻地支之方。距离档按爻位:
//    初二爻=近(同城百里内),三四爻=中(邻省数百里),五上爻=远(跨省千里上下)。
//  · 取期:同支应期。近应=未来第一个该支之日;冲应=未来第一个冲支之日(次选);
//    月应=未来第一个该支之月中的第一个该支之日(远事用)。全部给到公历年月日。
//  · 取数:量级位数由上下卦先天数之和定档(2-5→千级4位,6-8→万级5位,9-11→十万级6位,
//    12-14→百万级7位,15-16→千万级8位);区间首位由取用地支序数推(1-12 折 1-9);
//    老阳动取区间上半,老阴动取下半,余取中段。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./gua-data.js'));
  } else { root.Yingqi = factory(root.Najia, root.GuaData); }
}(typeof self !== 'undefined' ? self : this, function (Najia, GuaData) {
  const ZHI = Najia.ZHI;
  const ZHI_DIR = { 子: '正北', 丑: '东北', 寅: '东北', 卯: '正东', 辰: '东南', 巳: '东南', 午: '正南', 未: '西南', 申: '西南', 酉: '正西', 戌: '西北', 亥: '西北' };
  const DIST = ['近(同城,百里之内)', '近(同城,百里之内)', '中(邻省,数百里)', '中(邻省,数百里)', '远(跨省,千里上下)', '远(跨省,千里上下)'];

  // 取用之爻:有动爻取最上动爻;静卦取世爻。返回 {pos(0-5), zhi}
  function keyLine(cast) {
    const z = Najia.zhuangGua(cast.benId);
    const pos = cast.moving.length ? cast.moving[cast.moving.length - 1] : z.shi - 1;
    return { pos, zhi: z.lines[pos].zhi };
  }

  // ——— 取向 ———
  function direction(cast) {
    const k = keyLine(cast);
    return { dir: ZHI_DIR[k.zhi], zhi: k.zhi, dist: DIST[k.pos], pos: k.pos + 1 };
  }

  // ——— 取期(全公历年月日) ———
  const iso = d => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  function nextDayOfZhi(from, zhi, maxDays) {
    for (let i = 1; i <= (maxDays || 13); i++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12);
      if (Najia.ganZhi(d).dayZhi === zhi) return d;
    }
    return null;
  }
  // ——— 按用神之「状态」取应期(八法,《增删卜易》各章卦例) ———
  // 2026-08 补。此前只有值日、冲日两法,而把全书「什么情况应在什么日」的句子归类后发现:
  // 八种取法只覆盖了两种,漏掉的恰是原文里用得最多的三种(出空实空 35 处、实破 15 处、合日 13 处)。
  // 详见 docs/古籍研读-01-家底与差距.md。
  //
  // **优先级的老实话**:原文没有明列一张优先级表。下面这个次序是本项目定的,依据两条:
  //   ①原文里每条取法都自带触发状态(旬空→出空、月破→实破、入墓→冲开墓),状态本身就是选择器,
  //     所以先按状态选,而非按吉凶权重排;
  //   ②确实同时命中两种状态时,原文有一例可循——「又破又空,至未日乃**实空实破**之日也」,
  //     即取**同时满足两者**的那一日。空与破的填实日都是本支之日,故合并后仍落在本支。
  // 状态越具体越优先(空/破/墓/合住是具体状态,动/静是通则),这一层是我的排法,不是原文明文。
  const MU_OF = { 火: '戌', 水: '辰', 木: '未', 金: '丑', 土: '戌' };
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const chongOf = z => ZHI[(ZHI.indexOf(z) + 6) % 12];
  // 每条:{ 状态判定, 应在哪个支之日, 说法, 原话 }
  const YQ_RULES = [
    { key: '空破并见', hit: (L, c) => L.kong && L.power && L.power.yuePo, zhiOf: L => L.zhi,
      say: '这一爻既落空又逢月破,要等到它自己那一天——既填实了空、也填实了破',
      q: '又破又空至未日乃實空實破之日也' },
    { key: '旬空', hit: L => L.kong, zhiOf: L => L.zhi,
      say: '这一爻眼下是空的,落不到实处,要等它本支值日把这个空填实',
      q: '父化未土旬空出空之日到也' },
    { key: '月破', hit: (L) => L.power && L.power.yuePo, zhiOf: L => L.zhi,
      say: '这一爻这个月被冲破,提不起劲,要等它本支值日把破填实',
      q: '實破之日則不破' },
    { key: '入墓', hit: L => L.power && L.power.ruMu, zhiOf: L => chongOf(L.power.muZhi || MU_OF[L.wx]),
      say: '这一爻被关进库里,要等冲开那座库的日子才出得来',
      q: '明年辰戌是子水入墓之年' },
    { key: '合住', hit: L => L.power && L.power.heRi && L.moving, zhiOf: L => chongOf(L.zhi),
      say: '这一爻动是动了却被绊住,要等冲开这层牵合的日子才走得动',
      q: '如逢合住須沖破以成功' },
    { key: '动而逢合', hit: L => L.moving, zhiOf: L => LIUHE[L.zhi],
      say: '这一爻已经在动,动的东西要等有人来合它、把它定住的那一日才落定',
      q: '動而逢合之日' },
    { key: '静而逢冲', hit: L => !L.moving, zhiOf: L => chongOf(L.zhi),
      say: '这一爻眼下不动,不动的东西要等被冲一下才起来',
      q: '靜而逢沖之日' },
  ];
  // 衰绝者另有一法,不与上面争主位,只作补充
  const YQ_SHENG = { key: '衰绝逢生', say: '这一爻眼下没气力,除了上面那个日子,逢生它的月份也会有转机', q: '或得後來逢生助之日月' };

  function yingqiOf(cast, from) {
    const z = Najia.zhuangGua(cast.benId, from, { moving: movingArr(cast), bianId: cast.bianId });
    const pos = cast.moving && cast.moving.length ? cast.moving[cast.moving.length - 1] : z.shi - 1;
    const L = z.lines[pos];
    const hit = YQ_RULES.find(r => r.hit(L, z));
    if (!hit) return null;
    const zhi = hit.zhiOf(L);
    const d = nextDayOfZhi(from, zhi, 40);
    const weak = L.power && ['休', '囚', '死'].includes(L.power.wang);
    return {
      pos: pos + 1, zhi: L.zhi, state: hit.key, targetZhi: zhi,
      date: d ? iso(d) : null,
      say: hit.say, quote: hit.q,
      extra: weak ? { say: YQ_SHENG.say, quote: YQ_SHENG.q } : null,
      note: '取法的先后是本项目定的:状态越具体越先(空、破、墓、合住在前,动静的通则在后)。' +
        '原文没有明列一张优先级表,只给了一条复合之例(又空又破取实空实破之日),这一层排法我自己担着。',
    };
  }
  function movingArr(cast) {
    const a = [false, false, false, false, false, false];
    for (const i of (cast.moving || [])) a[i] = true;
    return a;
  }

  function dates(cast, from) {
    const k = keyLine(cast);
    const chong = ZHI[(ZHI.indexOf(k.zhi) + 6) % 12];
    const near = nextDayOfZhi(from, k.zhi);
    const chongD = nextDayOfZhi(from, chong);
    // 月应:未来第一个该支之月(节气月),取月内第一个该支之日
    let monthD = null;
    for (let i = 1; i <= 400; i++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, 12);
      const g = Najia.ganZhi(d);
      if (g.monthZhi === k.zhi && g.dayZhi === k.zhi) { monthD = d; break; }
    }
    return {
      zhi: k.zhi, chong,
      near: near ? { date: iso(near), why: `近应:未来第一个${k.zhi}日` } : null,
      chongDate: chongD ? { date: iso(chongD), why: `冲应(次选):未来第一个${chong}日(${k.zhi}之冲)` } : null,
      monthDate: monthD ? { date: iso(monthD), why: `月应(远事用):${k.zhi}月中的${k.zhi}日` } : null,
      byState: yingqiOf(cast, from),      // 按用神状态取的应期(八法),与上面的机械锚并列摆出
    };
  }

  // ——— 取数(量级) ———
  const TIER = [
    { max: 5, name: '千级(4位数)', digits: 4 },
    { max: 8, name: '万级(5位数)', digits: 5 },
    { max: 11, name: '十万级(6位数)', digits: 6 },
    { max: 14, name: '百万级(7位数)', digits: 7 },
    { max: 16, name: '千万级(8位数)', digits: 8 },
  ];
  function amount(cast) {
    const t = GuaData.TRIGRAMS;
    const up = t[cast.benId.slice(3, 6)], lo = t[cast.benId.slice(0, 3)];
    const sum = up.xt + lo.xt;
    const tier = TIER.find(x => sum <= x.max);
    const k = keyLine(cast);
    const lead = ((ZHI.indexOf(k.zhi)) % 9) + 1;
    const base = lead * Math.pow(10, tier.digits - 1);
    const line = cast.lines[k.pos];
    const seg = line && line.moving ? (line.yang ? '取区间上半(老阳主进)' : '取区间下半(老阴主守)') : '取区间中段';
    return {
      sum, tier: tier.name, digits: tier.digits,
      range: [base, base + Math.pow(10, tier.digits - 1)],
      rangeText: `${base.toLocaleString()} ~ ${(base + Math.pow(10, tier.digits - 1)).toLocaleString()}`,
      seg,
    };
  }

  // ——— 材料文本(答案之锚) ———
  function material(cast, from, wantAmount) {
    const d = direction(cast);
    const t = dates(cast, from || new Date());
    let s = `【程序推定·答案之锚(依取用规程机械推得,同卦必同答)】\n` +
      `取向:${d.dir}(取用第${d.pos}爻临${d.zhi}),距离${d.dist}。\n` +
      `取期(公历):${t.near ? t.near.date + '——' + t.near.why + ';' : ''}${t.chongDate ? t.chongDate.date + '——' + t.chongDate.why + ';' : ''}${t.monthDate ? t.monthDate.date + '——' + t.monthDate.why : ''}`;
    // 按用神状态取的应期(八法),与上面的机械锚并列摆出。两者不合时以这一条为准并说明缘由。
    const bs = t.byState;
    if (bs) {
      s += `\n取期(按这一爻眼下的状态,《增删卜易》各章之法):${bs.date || '四十日内无此日'}` +
        `——第${bs.pos}爻临${bs.zhi},${bs.state};${bs.say}(原话「${bs.quote}」)。` +
        (bs.extra ? `另:${bs.extra.say}(原话「${bs.extra.quote}」)。` : '') +
        `\n【取法先后的来历】${bs.note}`;
    }
    if (wantAmount) {
      const a = amount(cast);
      s += `\n取数:${a.tier},区间 ${a.rangeText},${a.seg}(上下卦先天数合${a.sum},取用支定首位)。`;
    }
    s += `\n【锚定规矩】答方位/日期/数额,以上推定就是底答:要么采纳,要么依卦面(旺衰冲合)明说为何取冲应或月应——不许凭空另立第三个答案;日期必须给全年月日,不许只说月份。` +
      (bs ? `两个取期不一致时,以「按状态」那一条为准,并把为什么不取另一条说给客人听。` : '');
    return s;
  }

  return { direction, dates, amount, material, keyLine, yingqiOf, YQ_RULES, ZHI_DIR };
}));
