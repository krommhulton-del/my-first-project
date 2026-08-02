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
  // ——— 按用神之「状态」取应期(《增删卜易》) ———
  // v0.66 从全书 126 句里归纳出八法;v0.74 补齐「破而逢合」。
  // **v0.89 拿原书自己的总表逐条回核**:维基文库本转录带来了老转录缺的
  // 「各門類應期總注章第又二十六」——那正是应期的官方清单。逐条对下来:
  //   全对上 3 条(入墓、月破两解、空破并见),半对上 5 条(静只有冲没有值、动只有合没有值、
  //   旬空只有填没有冲、合住只冲本支不冲合神、衰绝只提生不提旺),整条没有 3 条
  //   (太旺逢墓逢冲、化进神逢值逢合、化退神忌值忌冲——进退神 najia 早判了,应期一直没接)。
  //   这一轮把半对的补全、没有的补上;机器够不着的四条(大象受克两条、世空元动、世衰元静)
  //   与变爻两应,照实记在 docs/应期回核-01-总注章对照.md,不硬做。
  //
  // **优先级的老实话**:原文没有明列一张优先级表。总注章是**状态清单不是先后表**——
  // 它把动静两条通则排在最前,若按清单次序当优先级,通则会把一切具体状态盖掉,显然不是此意。
  // 本项目的排法照旧:状态越具体越先(空/破/墓/合/太旺/进退神在前,动静通则垫底),
  // 原文明列先后的只有一条复合之例(又空又破取实空实破之日),这一层排法我自己担着。
  // **一条里两个日子都算得出时,取先到的那一天**——月破两解的旧例(v0.74)推广到所有两解。
  const MU_OF = Najia.MU_OF;   // 墓库表只此一份(najia),v0.92 收归——此前这里另抄了一张,正是 §四 说的破口
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  const chongOf = z => ZHI[(ZHI.indexOf(z) + 6) % 12];
  // 每条:{ key, hit(L,ctx), cands(L,ctx)->[{zhi,which}](按原文语序,先到者用), talk{which:人话}, q 原话(q2 备证) }
  const YQ_RULES = [
    { key: '空破并见', hit: L => L.kong && L.power && L.power.yuePo,
      cands: L => [{ zhi: L.zhi, which: '实' }],
      talk: { 实: '这一爻既落空又逢月破,要等到它自己那一天——既填实了空、也填实了破' },
      q: '又破又空至未日乃實空實破之日也' },
    // 旬空两解:填实有整章卦例(出空之日);「冲空」只有总注章「旬空最愛塡沖」四字的明文,
    // 细法那章(空亡論)通篇只示范了填——两解的证据强度不一样,照实记(q 是填的实证,q2 是冲的明文)。
    { key: '旬空', hit: L => L.kong,
      cands: L => [{ zhi: L.zhi, which: '实' }, { zhi: chongOf(L.zhi), which: '冲' }],
      talk: { 实: '这一爻眼下是空的,落不到实处,要等它本支值日把这个空填实',
              冲: '这一爻眼下是空的,落不到实处;被正对头冲一下,空的也能被冲起来' },
      q: '父化未土旬空出空之日到也', q2: '旬空最愛塡沖' },
    // 月破两解(v0.74 补):「今日𨿽破﹐實破之日則不破﹐合之日則不破」——填实与逢合都能解破。
    { key: '月破', hit: L => L.power && L.power.yuePo,
      cands: L => [{ zhi: L.zhi, which: '实' }, { zhi: LIUHE[L.zhi], which: '合' }],
      talk: { 实: '这一爻这个月被冲破,提不起劲,要等它本支值日把破填实',
              合: '这一爻这个月被冲破,提不起劲;等到与它相合的那一天,破就被合住了,事情才提得起来' },
      q: '今日𨿽破﹐實破之日則不破﹐合之日則不破' },
    { key: '入墓', hit: L => L.power && L.power.ruMu,
      cands: L => [{ zhi: chongOf(L.power.muZhi || MU_OF[L.wx]), which: '冲' }],
      talk: { 冲: '这一爻被关进库里,要等冲开那座库的日子才出得来' },
      q: '入三墓俱喜沖開:如主事爻臨午火,假使火墓於戌,後逢辰日則應之' },
    // 合住两解(v0.89 补):总注举例「主象臨子,與丑作合,後逢午未日應之」——午冲本支、未冲合神,
    // 两头哪头先到应哪头。口径出入记在案:书上的合住列的是月合与动而化合,程序判的是日辰合住,
    // 动它要先量对断卦的影响,本轮不动(docs/应期回核-01)。
    { key: '合住', hit: L => L.power && L.power.heRi && L.moving,
      cands: L => [{ zhi: chongOf(L.zhi), which: '冲' }, { zhi: chongOf(LIUHE[L.zhi]), which: '冲合神' }],
      talk: { 冲: '这一爻动是动了却被绊住,要等冲开这层牵合的日子才走得动',
              冲合神: '这一爻动是动了却被绊住;冲走绊住它的那一头,这一爻也就松开了' },
      q: '如逢合住須沖破以成功', q2: '卽如主象臨子,與丑作合,後逢午未日應之是也' },
    // 太旺(v0.89 新增):总注题头只给「逢墓逢沖」两解,例子里的「亥子日」是把冲扩成了克它的整个五行,
    // 按收窄不放大的规矩只做题头两解。触发条件有两处自拟:「卦中同类爻太多」折成六爻里同五行≥4(含本爻);
    // 「又遇巳火午月日占卦」读成月支日支五行**都**与该爻同(严读)——原文没说其一即足还是两者皆须,取严的那头。
    { key: '太旺', hit: (L, c) => (c.z.cal && ZHI_WX[c.z.cal.monthZhi] === L.wx && ZHI_WX[c.z.cal.dayZhi] === L.wx)
        || c.z.lines.filter(x => x.wx === L.wx).length >= 4,
      cands: L => [{ zhi: MU_OF[L.wx], which: '墓' }, { zhi: chongOf(L.zhi), which: '冲' }],
      talk: { 墓: '这一爻旺过了头,满则溢;要等把它收进库里的那一天,劲才收得拢、事才落得定',
              冲: '这一爻旺过了头,满则溢;要等正对头来冲它一下,这股劲才泄得出去、事才见分晓' },
      q: '太旺者逢墓逢沖:如主事爻臨午火,又遇巳火午月日占卦,或卦中巳午爻太多,後逢亥子日應之,又有戌日應之乃火入墓也' },
    // 进退神应期(v0.89 新增):进退神本身 najia v0.58 起就判(照原文十四对),但应期一直没接上。
    { key: '化进神', hit: (L, c) => c.bianItem && c.bianItem.jinTui === '进神',
      cands: L => [{ zhi: L.zhi, which: '值' }, { zhi: LIUHE[L.zhi], which: '合' }],
      talk: { 值: '这一爻越变越往前,事在往上走;应在它自己那一天,一步顶到位',
              合: '这一爻越变越往前,事在往上走;应在与它相合的那一天,有人搭手把它定住' },
      q: '化進神、逢值逢合:如申動酉,乃爲進神,爲福爲禍,有應申月日者,有應巳月日者' },
    { key: '化退神', hit: (L, c) => c.bianItem && c.bianItem.jinTui === '退神',
      cands: (L, c) => [{ zhi: c.bianItem.toZhi, which: '值' }, { zhi: chongOf(c.bianItem.toZhi), which: '冲' }],
      talk: { 值: '这一爻在往回缩,劲头一天比一天小;缩到头的那一天,这事就见真章',
              冲: '这一爻在往回缩,劲头一天比一天小;被冲一下,缩到哪儿算哪儿,当天见真章' },
      q: '化退神、忌值忌沖:如酉化申,乃爲退神,爲凶爲吉,有應申月日者,有應寅日月者' },
    // 动静两条通则,v0.89 各补上「值」那一解(总注:動而逢合逢值、靜而逢值逢沖)
    { key: '动而逢合逢值', hit: L => L.moving,
      cands: L => [{ zhi: LIUHE[L.zhi], which: '合' }, { zhi: L.zhi, which: '值' }],
      talk: { 合: '这一爻已经在动,动的东西要等有人来合它、把它定住的那一日才落定',
              值: '这一爻已经在动,应在它自己那一天——动到正日子,事就落地' },
      q: '動而逢合逢值:如主事爻臨子水發動,後遇丑日子日而應之' },
    { key: '静而逢值逢冲', hit: L => !L.moving,
      cands: L => [{ zhi: L.zhi, which: '值' }, { zhi: chongOf(L.zhi), which: '冲' }],
      talk: { 值: '这一爻眼下不动,应在它自己那一天——排到正日子,不催自来',
              冲: '这一爻眼下不动,不动的东西要等被冲一下才起来' },
      q: '靜而逢值逢沖:如主事爻臨子水不動,後逢子日午日而應之' },
  ];
  // 衰绝者另有一法,不与上面争主位,只作补充(v0.89 按总注补上「遇旺」那半)
  const YQ_SHENG = { key: '衰绝逢生', say: '这一爻眼下没气力,除了上面那个日子,逢生它的月份、到它自己当令的时节也会有转机',
    q: '衰絕者,遇生遇旺:如主事爻屬金,占卦於巳午月日,卽是休囚無气,後逢土月日或至秋令當時' };
  const YQ_NOTE = '取法的先后是本项目定的:状态越具体越先(空、破、墓、合、太旺、进退神在前,动静的通则垫底)。' +
    '原文没有明列一张优先级表——总注章是状态清单不是先后表,只给了一条复合之例(又空又破取实空实破之日),这一层排法我自己担着。' +
    '一条里两个日子都算得出时,取先到的那一天——这一裁决也是本项目定的,原文只把候选并列摆出、并不裁谁先;' +
    '总注凡言「月日」皆可应者,这一层只落到日,月一级的应期在近应月应与年表流月里另行覆盖。';

  function yingqiOf(cast, from) {
    const z = Najia.zhuangGua(cast.benId, from, { moving: movingArr(cast), bianId: cast.bianId });
    const pos = cast.moving && cast.moving.length ? cast.moving[cast.moving.length - 1] : z.shi - 1;
    const L = z.lines[pos];
    const bianItem = z.bian && z.bian.lines ? z.bian.lines.find(b => b.pos === pos + 1) : null;
    const ctx = { z, bianItem };
    const hit = YQ_RULES.find(r => r.hit(L, ctx));
    if (!hit) return null;
    const dated = hit.cands(L, ctx).filter(c => c && c.zhi)
      .map(c => ({ zhi: c.zhi, which: c.which, d: nextDayOfZhi(from, c.zhi, 40) }));
    let best = null;
    for (const c of dated) if (c.d && (!best || c.d < best.d)) best = c;
    if (!best) best = dated[0];
    const weak = L.power && ['休', '囚', '死'].includes(L.power.wang);
    return {
      pos: pos + 1, zhi: L.zhi, state: hit.key, targetZhi: best.zhi, which: best.which,
      date: best.d ? iso(best.d) : null,
      others: dated.filter(c => c !== best && c.d).map(c => ({ zhi: c.zhi, which: c.which, date: iso(c.d) })),
      say: (hit.talk && hit.talk[best.which]) || hit.say, quote: hit.q, quote2: hit.q2 || null,
      extra: weak ? { say: YQ_SHENG.say, quote: YQ_SHENG.q } : null,
      note: YQ_NOTE,
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
