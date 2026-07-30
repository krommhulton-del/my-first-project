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

  // ——— 真太阳时:钟表时 → 出生地真太阳时(排时柱的行规) ———
  // 三步:①1986-1991 夏令时回拨一小时;②经度差(每偏东经120°一度差4分钟);③均时差(±16分)。
  const DST = { 1986: [5, 4, 9, 14], 1987: [4, 12, 9, 13], 1988: [4, 10, 9, 11], 1989: [4, 16, 9, 17], 1990: [4, 15, 9, 16], 1991: [4, 14, 9, 15] };
  function eotMinutes(date) {
    const start = Date.UTC(date.getFullYear(), 0, 1);
    const n = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000) + 1;
    const B = (360 * (n - 81) / 365) * Math.PI / 180;
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  }
  function trueSolarDate(birth, lonDeg) {
    let t = birth.getTime();
    const y = birth.getFullYear(), d = DST[y];
    if (d) {
      const s = new Date(y, d[0] - 1, d[1], 2).getTime(), e = new Date(y, d[2] - 1, d[3], 2).getTime();
      if (t >= s && t < e) t -= 3600000; // 夏令时拨回
    }
    if (typeof lonDeg === 'number' && !isNaN(lonDeg)) t += (lonDeg - 120) * 4 * 60000; // 经度差
    t += eotMinutes(birth) * 60000; // 均时差
    return new Date(t);
  }

  // 调候(寒暖之要):冬生先取火暖局,夏生先取水润局——喜用之外此行亦作药
  function tiaoHou(monthZhi) {
    if ('亥子丑'.includes(monthZhi)) return { need: '火', note: '生于冬月,局寒——调候先取火(丙丁)暖局,穿用红紫、向南、午时发力皆是药' };
    if ('巳午未'.includes(monthZhi)) return { need: '水', note: '生于夏月,局燥——调候先取水(壬癸)润局,黑蓝之色、向北、亥子时静养皆是药' };
    return null;
  }

  // 主排盘:birth 为 Date(设备本地时刻,视为出生地时间;传 lon 则先校真太阳时)
  // 晚子时(23点后)依当今主流「子时换日法」:日柱与五鼠遁均按次日排。
  function chart(birth, gender, lonDeg) {
    if (typeof lonDeg === 'number' && !isNaN(lonDeg)) birth = trueSolarDate(birth, lonDeg);
    const cal = Najia.ganZhi(birth);          // 年(立春界)、月(节气界)、日
    const lunar = Lunar.fromDate(birth);      // 取时辰序号
    const hourIdx = lunar.hourNum - 1;         // 子=0
    const yearGZ = cal.year, monthGZ = cal.month;
    const lateZi = birth.getHours() >= 23;
    const dayGZ = lateZi
      ? Najia.ganZhi(new Date(birth.getFullYear(), birth.getMonth(), birth.getDate() + 1, 1)).day
      : cal.day;
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
    let yong = pickYongShen(dayGan, strength.strong);
    // 从格:生扶极重为从强(顺其势喜帮扶),极轻为从弱(顺其势喜克泄)——喜忌翻转
    let geju = null;
    if (strength.pct >= 85) {
      geju = '从强格(生扶极盛,顺势不逆)';
      const me = GAN_WX[dayGan], yin = invSheng(me);
      yong = { strong: true, xiWx: [me, yin], jiWx: [KE[me], invKe(me), SHENG[me]].filter((v, i, a) => a.indexOf(v) === i), xiName: '比劫·印(从其强势)', jiName: '克泄耗(逆势为忌)' };
    } else if (strength.pct <= 15) {
      geju = '从弱格(生扶极微,弃命从势)';
      const me = GAN_WX[dayGan], yin = invSheng(me);
      yong = { strong: false, xiWx: [KE[me], SHENG[me]], jiWx: [me, yin], xiName: '财官食伤(从其弱势)', jiName: '比劫·印(逆势为忌)' };
    }
    // 命局内支冲:宫位互冲入注(年=根基长辈,月=门户事业,日=自身婚姻,时=子女晚景)
    const GONG = { year: '根基宫(长辈)', month: '门户宫(事业)', day: '婚姻宫(自身)', hour: '子女宫(晚景)' };
    const neiChong = [];
    const ks = ['year', 'month', 'day', 'hour'];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const a = pillars[ks[i]].zhi, b = pillars[ks[j]].zhi;
      if ((ZHI.indexOf(a) + 6) % 12 === ZHI.indexOf(b)) neiChong.push(`${a}${b}相冲:${GONG[ks[i]]}与${GONG[ks[j]]}互撼,此两处人生课题多动荡,逢冲之年应期尤验`);
    }
    return {
      birth, gender: gender || '男',
      pillars, dayGan, dayWx: GAN_WX[dayGan],
      ziNote: lateZi ? '晚子时(23点后)出生,依主流子时换日法,日柱按次日排' : null,
      strength, yong, geju, tiaohou: tiaoHou(cal.monthZhi), neiChong,
      lunarText: Lunar.format(lunar), calYear: cal.year, calMonth: cal.month, monthZhi: cal.monthZhi,
      dayun: computeDayun(pillars, yearGZ[0], gender || '男', birth),
    };
  }

  // 身强身弱:三纲计分——得令(月令,满40)+得地(通根,满30)+得势(天干帮扶,满30),总分≥50为强
  // 得令看月令主气是比劫(全令40)/印(得生28)/余气藏根(小得令12);
  // 得地看四支藏干之根:本气根8、余气根4,印根减半,封顶30;
  // 得势看年月时三干比劫印各计10。三项分开报,强弱有账可查。
  function judgeStrength(pillars, dayGan) {
    const me = GAN_WX[dayGan];
    const yin = invSheng(me);
    const mQi = CANGGAN[pillars.month.zhi][0];
    let ling = 0;
    if (GAN_WX[mQi] === me) ling = 40;
    else if (GAN_WX[mQi] === yin) ling = 28;
    else if (CANGGAN[pillars.month.zhi].some((g, i) => i > 0 && GAN_WX[g] === me)) ling = 12;
    let di = 0;
    for (const k of ['year', 'month', 'day', 'hour']) {
      CANGGAN[pillars[k].zhi].forEach((g, i) => {
        const w = i === 0 ? 8 : 4;
        if (GAN_WX[g] === me) di += w;
        else if (GAN_WX[g] === yin) di += w / 2;
      });
    }
    di = Math.min(30, +di.toFixed(1));
    let shi = 0;
    for (const k of ['year', 'month', 'hour']) {
      const w = pillars[k].ganWx;
      if (w === me || w === yin) shi += 10;
    }
    const total = +(ling + di + shi).toFixed(1);
    return { strong: total >= 50, pct: Math.round(total), help: total, drain: +(100 - total).toFixed(1),
      deLing: getDeLing(pillars.month.zhi, me), detail: { ling, di, shi } };
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
    const sa = estimateStartAge(birth, forward);
    const list = [];
    for (let i = 1; i <= 8; i++) {
      const g = ((mgIdx + (forward ? i : -i)) % 10 + 10) % 10;
      const z = ((mzIdx + (forward ? i : -i)) % 12 + 12) % 12;
      list.push({ gz: GAN[g] + ZHI[z], gan: GAN[g], zhi: ZHI[z], fromAge: +(sa.age + (i - 1) * 10).toFixed(1) });
    }
    return { forward, startAge: sa.age, startText: sa.text, startDays: sa.days, list };
  }
  // 起运岁(行规):阳男阴女顺数到下一节令、阴男阳女逆数到上一节令,
  // 二分法求节令精确时刻,三日折一年、余数折月(一日折四月)。
  function estimateStartAge(birth, forward) {
    const t = birth.getTime();
    const lam = Najia.sunLongitude(t);
    const seg = ((lam - 315) % 360 + 360) % 360;
    const within = seg % 30;
    const target = ((lam - within + (forward ? 30 : 0)) % 360 + 360) % 360;
    const diff = ms => { let d = Najia.sunLongitude(ms) - target; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
    let lo = forward ? t : t - 35 * 86400000;
    let hi = forward ? t + 35 * 86400000 : t;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (diff(lo) * diff(mid) <= 0) hi = mid; else lo = mid; }
    const days = Math.abs((lo + hi) / 2 - t) / 86400000;
    const years = days / 3;
    const y = Math.floor(years), m = Math.round((years - y) * 12);
    return { age: Math.max(0.1, +years.toFixed(1)), days: +days.toFixed(2), text: `${y}岁${m}个月起运` };
  }

  // ——— 神煞引擎(流运断事用)———
  // 口诀依据:天乙「甲戊庚牛羊,乙己鼠猴乡,丙丁猪鸡位,壬癸蛇兔藏,六辛逢虎马」;
  // 咸池(桃花)申子辰在酉、寅午戌在卯、巳酉丑在午、亥卯未在子;驿马寅申亥巳;华盖辰戌丑未;
  // 文昌「甲乙巳午报君知,丙戊申宫丁己鸡,庚猪辛鼠壬逢虎,癸人见卯入云梯」;羊刃甲卯丙戊午庚酉壬子;
  // 红鸾按年支子起卯逆行,天喜为其对冲;空亡(天中殺)依日柱旬。
  const TIANYI = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '巳卯', 癸: '巳卯', 辛: '寅午' };
  const sanheIdx = z => '申子辰'.includes(z) ? 0 : '寅午戌'.includes(z) ? 1 : '巳酉丑'.includes(z) ? 2 : 3;
  const TAOHUA = ['酉', '卯', '午', '子'];
  const YIMA = ['寅', '申', '亥', '巳'];
  const HUAGAI = ['辰', '戌', '丑', '未'];
  const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
  const YANGREN = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
  const HONGLUAN = ['卯', '寅', '丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰']; // 索引=年支序(子0)

  // 日柱旬空(天中殺二支)
  function kongOf(dayGZ) {
    let idx = -1;
    for (let i = 0; i < 60; i++) if (GAN[i % 10] === dayGZ[0] && ZHI[i % 12] === dayGZ[1]) { idx = i; break; }
    const xunShou = idx - (idx % 10);
    return [ZHI[(xunShou + 10) % 12], ZHI[(xunShou + 11) % 12]];
  }

  // 流运一支一干,对命局激起哪些星煞与动宫(返回大白话短语数组,供断事型)
  function flowMarks(chart, flowGan, flowZhi) {
    const P = chart.pillars, yz = P.year.zhi, mz = P.month.zhi, dz = P.day.zhi, hz = P.hour.zhi;
    const dg = chart.dayGan;
    const yzIdx = ZHI.indexOf(yz);
    const marks = [];
    if ((TIANYI[dg] || '').includes(flowZhi)) marks.push('天乙贵人临:贵人露面之应——求人、见要紧人物、谈事,应在此处');
    if (flowZhi === TAOHUA[sanheIdx(yz)] || flowZhi === TAOHUA[sanheIdx(dz)]) marks.push('桃花动:人缘情事活络——单身宜走动见人,有主的防桃色是非');
    if (flowZhi === YIMA[sanheIdx(yz)] || flowZhi === YIMA[sanheIdx(dz)]) marks.push('驿马动:奔波变动之应——出行、调动、搬迁、换事由,坐不住也不必硬坐');
    if (flowZhi === HUAGAI[sanheIdx(yz)] || flowZhi === HUAGAI[sanheIdx(dz)]) marks.push('华盖临:宜独处清修——读书、研艺、谋划这类一个人的事最出活,不宜硬凑热闹');
    if (WENCHANG[dg] === flowZhi) marks.push('文昌临:文书之利——考试、签字、投稿、递材料挑这个当口');
    if (YANGREN[dg] === flowZhi) marks.push('羊刃现:火气冲——防口角动手、利器磕碰,车马慢行,忍一步海阔');
    if (HONGLUAN[yzIdx] === flowZhi) marks.push('红鸾动:婚恋之喜的信号——感情事在这个当口容易落定');
    if (ZHI[(ZHI.indexOf(HONGLUAN[yzIdx]) + 6) % 12] === flowZhi) marks.push('天喜临:喜庆临门——好消息、喜事、添置之应');
    const kong = kongOf(P.day.gz);
    if (kong.includes(flowZhi)) marks.push('空亡(天中殺):运气之冬——新起之事难留根,不宜开业、置产、定亲这类立根基的动作;宜守成、学习、清旧账、养精神,过了这段自回暖');
    const chong = z => ZHI[(ZHI.indexOf(z) + 6) % 12];
    if (chong(flowZhi) === mz) marks.push('冲提纲(月柱):工作与居所之宫动荡——岗位、流程、住处这阵子多变,别在风头上硬定大局');
    if (chong(flowZhi) === dz) marks.push('冲日支(自身与婚姻宫):身边人与身体之事留心——伴侣情绪、旧疾复动,都在这个当口');
    if (chong(flowZhi) === yz) marks.push('冲年支(根基宫):长辈、老家、祖上住所之事有动静');
    if (chong(flowZhi) === hz) marks.push('冲时支(子女与计划宫):小辈之事或既定计划生变');
    const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
    if (LIUHE[flowZhi] === dz) marks.push('合动日支:有人贴近——亲近、说和、牵线之应');
    return marks;
  }

  // ——— 时辰吉凶(日运精确到钟点):流日日干五鼠遁排十二时柱,按喜忌与冲合本人年支评分 ———
  const HOUR_SPAN = ['23-1点', '1-3点', '3-5点', '5-7点', '7-9点', '9-11点', '11-13点', '13-15点', '15-17点', '17-19点', '19-21点', '21-23点'];
  function jiShi(chart, flowDayGan) {
    const xi = chart.yong.xiWx, ji = chart.yong.jiWx;
    const byZhi = chart.pillars.year.zhi;
    const LIUHE_H = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
    const out = [];
    for (let i = 0; i < 12; i++) {
      const gz = hourPillar(flowDayGan, i);
      const g = gz[0], z = gz[1];
      let s = 0;
      const marks = [];
      if (xi.includes(GAN_WX[g])) { s += 1; marks.push('时干扶你'); }
      if (ji.includes(GAN_WX[g])) { s -= 1; marks.push('时干耗你'); }
      if (xi.includes(ZHI_WX[z])) s += 0.5;
      if (ji.includes(ZHI_WX[z])) s -= 0.5;
      if (ZHI[(ZHI.indexOf(z) + 6) % 12] === byZhi) { s -= 2; marks.push('冲你年支,避'); }
      if (LIUHE_H[z] === byZhi) { s += 1; marks.push('合你年支'); }
      out.push({ gz, zhi: z, span: HOUR_SPAN[i], score: +s.toFixed(1), marks });
    }
    return out;
  }

  // 天中殺之年:未来 n 年里流年支落入日柱旬空的年份(算命学十二年中之两年)
  function tianZhongShaYears(chart, fromYear, n) {
    const kong = kongOf(chart.pillars.day.gz);
    const out = [];
    for (let y = fromYear; y < fromYear + (n || 12); y++) {
      const z = ZHI[((y - 4) % 12 + 12) % 12];
      if (kong.includes(z)) out.push(y);
    }
    return out;
  }

  return { chart, shiShen, hourPillar, GAN_WX, ZHI_WX, SHISHEN_CLASS, SHENG, KE, CANGGAN, GAN, ZHI,
    kongOf, flowMarks, tianZhongShaYears, jiShi, HOUR_SPAN, trueSolarDate, eotMinutes, tiaoHou, TIANYI, WENCHANG, YANGREN, TAOHUA, YIMA, HUAGAI, HONGLUAN, sanheIdx };
}));
