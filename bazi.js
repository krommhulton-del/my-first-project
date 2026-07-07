// bazi.js — 八字排盘核心:四柱、十神、地支藏干、身强身弱、喜用忌神、大运
// 依子平旺衰扶抑法(市面命理书主流):得令得地得生得助定强弱,
// 身强喜耗泄(财官食伤)忌生扶(印比),身弱喜生扶忌克泄。历法复用 najia/lunar。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./lunar.js'));
  } else { root.Bazi = factory(root.Najia, root.Lunar); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Lunar) {
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const GAN_YY = { 甲: 1, 丙: 1, 戊: 1, 庚: 1, 壬: 1, 乙: 0, 丁: 0, 己: 0, 辛: 0, 癸: 0 }; // 1阳0阴
  const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  // 地支藏干(主气在前,含余气)
  const CANGGAN = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
    辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
  };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // A生SHENG[A]
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };    // A克KE[A]

  // 十神:other(天干)相对日主 me
  function shiShen(meGan, otherGan) {
    const me = GAN_WX[meGan], ot = GAN_WX[otherGan];
    const sameYY = GAN_YY[meGan] === GAN_YY[otherGan];
    if (me === ot) return sameYY ? '比肩' : '劫财';
    if (SHENG[me] === ot) return sameYY ? '食神' : '伤官'; // 我生
    if (KE[me] === ot) return sameYY ? '偏财' : '正财';     // 我克
    if (KE[ot] === me) return sameYY ? '七杀' : '正官';     // 克我
    if (SHENG[ot] === me) return sameYY ? '偏印' : '正印';   // 生我
    return '';
  }
  // 十神归五类(用于运势领域归类)
  const SHISHEN_CLASS = {
    比肩: '比劫', 劫财: '比劫', 食神: '食伤', 伤官: '食伤',
    偏财: '财星', 正财: '财星', 七杀: '官杀', 正官: '官杀', 偏印: '印星', 正印: '印星',
  };

  // 时柱:五鼠遁(日干定子时干)
  function hourPillar(dayGan, hourBranchIdx) {
    const base = (GAN.indexOf(dayGan) % 5) * 2;
    return GAN[(base + hourBranchIdx) % 10] + ZHI[hourBranchIdx];
  }

  // 主排盘:birth 为 Date(设备本地时刻,视为出生地时间)
  function chart(birth, gender) {
    const cal = Najia.ganZhi(birth);          // 年(立春界)、月(节气界)、日
    const lunar = Lunar.fromDate(birth);      // 取时辰序号
    const hourIdx = lunar.hourNum - 1;         // 子=0
    const yearGZ = cal.year, monthGZ = cal.month, dayGZ = cal.day;
    const dayGan = dayGZ[0], dayZhi = dayGZ[1];
    const hourGZ = hourPillar(dayGan, hourIdx);
    const pillars = {
      year: { gz: yearGZ, gan: yearGZ[0], zhi: yearGZ[1] },
      month: { gz: monthGZ, gan: monthGZ[0], zhi: monthGZ[1] },
      day: { gz: dayGZ, gan: dayGan, zhi: dayZhi },
      hour: { gz: hourGZ, gan: hourGZ[0], zhi: hourGZ[1] },
    };
    for (const k of Object.keys(pillars)) {
      const p = pillars[k];
      p.ganWx = GAN_WX[p.gan]; p.zhiWx = ZHI_WX[p.zhi];
      p.ganShen = k === 'day' ? '日主' : shiShen(dayGan, p.gan);
      p.cang = CANGGAN[p.zhi].map(g => ({ gan: g, wx: GAN_WX[g], shen: shiShen(dayGan, g) }));
    }
    const strength = judgeStrength(pillars, dayGan);
    const yong = pickYongShen(dayGan, strength.strong);
    return {
      birth, gender: gender || '男',
      pillars, dayGan, dayWx: GAN_WX[dayGan],
      strength, yong,
      lunarText: Lunar.format(lunar), calYear: cal.year, calMonth: cal.month, monthZhi: cal.monthZhi,
      dayun: computeDayun(pillars, yearGZ[0], gender || '男', birth),
    };
  }

  // 身强身弱:加权计分(月令最重),生扶 vs 克泄耗
  function judgeStrength(pillars, dayGan) {
    const me = GAN_WX[dayGan];
    const helpEl = new Set([me, invSheng(me)]);      // 比劫 + 印(生我)
    let help = 0, drain = 0;
    const add = (wx, w) => { if (helpEl.has(wx)) help += w; else drain += w; };
    // 天干(除日主)
    for (const k of ['year', 'month', 'hour']) add(pillars[k].ganWx, 1.4);
    // 地支藏干:月令主气权重最大
    for (const k of ['year', 'month', 'day', 'hour']) {
      const cang = pillars[k].cang;
      cang.forEach((c, i) => {
        let w = i === 0 ? 2 : 1;               // 主气2 余气1
        if (k === 'month' && i === 0) w = 3.5;  // 月令主气加重
        add(c.wx, w);
      });
    }
    const strong = help >= drain;
    const pct = Math.round(help / (help + drain) * 100);
    return { strong, help: +help.toFixed(1), drain: +drain.toFixed(1), pct, deLing: getDeLing(pillars.month.zhi, me) };
  }
  function invSheng(el) { for (const a of Object.keys(SHENG)) if (SHENG[a] === el) return a; }
  function getDeLing(monthZhi, me) {
    const mz = ZHI_WX[monthZhi];
    if (mz === me) return '当令';
    if (SHENG[mz] === me) return '得月令之生';
    if (KE[mz] === me) return '受月令克(失令)';
    if (SHENG[me] === mz) return '泄于月令';
    return '克月令(耗力)';
  }

  // 喜用忌:扶抑法。身强→喜克泄耗(财官食伤);身弱→喜生扶(印比)
  function pickYongShen(dayGan, strong) {
    const me = GAN_WX[dayGan];
    const yin = invSheng(me), bi = me, shi = SHENG[me], cai = KE[me], guan = invKe(me);
    const help = [bi, yin], drain = [shi, cai, guan];
    const xi = strong ? drain : help;
    const ji = strong ? help : drain;
    return {
      strong, xiWx: xi, jiWx: ji,
      xiName: strong ? '食伤·财·官杀(耗泄)' : '比劫·印(生扶)',
      jiName: strong ? '比劫·印' : '财·官杀·食伤',
    };
  }
  function invKe(el) { for (const a of Object.keys(KE)) if (KE[a] === el) return a; }

  // 大运:阳年男/阴年女顺行,阴年男/阳年女逆行;自月柱起排,起运岁由节气距离约算
  function computeDayun(pillars, yearGan, gender, birth) {
    const forward = (GAN_YY[yearGan] === 1) === (gender === '男');
    const mgIdx = GAN.indexOf(pillars.month.gan), mzIdx = ZHI.indexOf(pillars.month.zhi);
    // 起运岁:到下/上一节气的天数 ÷ 3(一柱十年)
    const startAge = estimateStartAge(birth, forward);
    const list = [];
    for (let i = 1; i <= 8; i++) {
      const g = ((mgIdx + (forward ? i : -i)) % 10 + 10) % 10;
      const z = ((mzIdx + (forward ? i : -i)) % 12 + 12) % 12;
      list.push({ gz: GAN[g] + ZHI[z], gan: GAN[g], zhi: ZHI[z], fromAge: startAge + (i - 1) * 10 });
    }
    return { forward, startAge, list };
  }
  function estimateStartAge(birth, forward) {
    // 到相邻节气(每 15° 一节气,月建以每 30° 换月;起运数节令即每 30°)的天数
    const lam = Najia.sunLongitude(birth.getTime());
    const seg = ((lam - 315) % 360 + 360) % 360; // 立春起
    const within = seg % 30;                       // 距本月节气起点的度数
    const deg = forward ? (30 - within) : within;  // 顺数到下节,逆数到上节
    const days = deg * (365.2422 / 360);            // 度→天(粗略)
    return Math.max(1, Math.round(days / 3));
  }

  return { chart, shiShen, hourPillar, GAN_WX, ZHI_WX, SHISHEN_CLASS, SHENG, KE, CANGGAN, GAN, ZHI };
}));
