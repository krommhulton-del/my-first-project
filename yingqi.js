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
    if (wantAmount) {
      const a = amount(cast);
      s += `\n取数:${a.tier},区间 ${a.rangeText},${a.seg}(上下卦先天数合${a.sum},取用支定首位)。`;
    }
    s += `\n【锚定规矩】答方位/日期/数额,以上推定就是底答:要么采纳,要么依卦面(旺衰冲合)明说为何取冲应或月应——不许凭空另立第三个答案;日期必须给全年月日,不许只说月份。`;
    return s;
  }

  return { direction, dates, amount, material, keyLine, ZHI_DIR };
}));
