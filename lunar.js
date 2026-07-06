// lunar.js — 农历(夏历)自实现:朔日定月、冬至建子、无中气置闰
// 天文基础:Meeus 低精度朔望与太阳黄经;历日按东八区(中国标准时)零点为界。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./najia.js')); }
  else { root.Lunar = factory(root.Najia); }
}(typeof self !== 'undefined' ? self : this, function (Najia) {
  const rad = Math.PI / 180;
  const DAY = 86400000;
  const TZ = 8 * 3600000; // 东八区

  // ——— 朔(新月)时刻,Meeus 第 49 章主要项,精度约 1 分钟 ———
  function newMoonJDE(k) {
    const T = k / 1236.85;
    let jde = 2451550.09766 + 29.530588861 * k
      + 0.00015437 * T * T - 0.000000150 * T * T * T + 0.00000000073 * T * T * T * T;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const M = (2.5534 + 29.10535670 * k - 0.0000014 * T * T - 0.00000011 * T * T * T) * rad;
    const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T * T * T - 0.000000058 * T * T * T * T) * rad;
    const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T * T * T + 0.000000011 * T * T * T * T) * rad;
    const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T * T * T) * rad;
    jde += -0.40720 * Math.sin(Mp)
      + 0.17241 * E * Math.sin(M)
      + 0.01608 * Math.sin(2 * Mp)
      + 0.01039 * Math.sin(2 * F)
      + 0.00739 * E * Math.sin(Mp - M)
      - 0.00514 * E * Math.sin(Mp + M)
      + 0.00208 * E * E * Math.sin(2 * M)
      - 0.00111 * Math.sin(Mp - 2 * F)
      - 0.00057 * Math.sin(Mp + 2 * F)
      + 0.00056 * E * Math.sin(2 * Mp + M)
      - 0.00042 * Math.sin(3 * Mp)
      + 0.00042 * E * Math.sin(M + 2 * F)
      + 0.00038 * E * Math.sin(M - 2 * F)
      - 0.00024 * E * Math.sin(2 * Mp - M)
      - 0.00017 * Math.sin(Om)
      - 0.00007 * Math.sin(Mp + 2 * M);
    return jde;
  }
  const jdeToUtcMs = jde => (jde - 2440587.5) * DAY - 69000; // ΔT≈69s(2020 年代)
  // 东八区历日序号(当地零点为界)
  const localDayNum = utcMs => Math.floor((utcMs + TZ) / DAY);

  // 朔日(东八区历日序号)。k 由公历年份近似:k ≈ (y - 2000) * 12.3685
  function newMoonDay(k) { return localDayNum(jdeToUtcMs(newMoonJDE(k))); }

  // ——— 节气时刻:二分法求太阳黄经到达 target 度的 UTC 毫秒 ———
  function solarTermMs(targetDeg, approxUtcMs) {
    let lo = approxUtcMs - 20 * DAY, hi = approxUtcMs + 20 * DAY;
    const diff = t => {
      let d = Najia.sunLongitude(t) - targetDeg;
      while (d > 180) d -= 360; while (d < -180) d += 360;
      return d;
    };
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (diff(lo) * diff(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }
  // 某公历年的冬至(东八区历日序号)
  function winterSolsticeDay(year) {
    return localDayNum(solarTermMs(270, Date.UTC(year, 11, 21, 12)));
  }
  // 历日区间 [start, end) 内是否含中气(中气黄经 = 270+30n)
  function hasZhongQi(startDay, endDay) {
    // 逐个中气检查:以区间中点近似定位
    for (let n = 0; n < 12; n++) {
      const deg = (270 + 30 * n) % 360;
      const midMs = (startDay + endDay) / 2 * DAY - TZ;
      const d = localDayNum(solarTermMs(deg, midMs));
      if (d >= startDay && d < endDay) return true;
    }
    return false;
  }

  const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const DAY_NAMES = (function () {
    const a = [];
    const tens = ['初', '十', '廿', '三'];
    for (let d = 1; d <= 30; d++) {
      if (d === 10) a.push('初十');
      else if (d === 20) a.push('二十');
      else if (d === 30) a.push('三十');
      else a.push(tens[Math.floor(d / 10)] + '一二三四五六七八九'[d % 10 - 1]);
    }
    return a;
  })();

  // ——— 主函数:公历 Date → 农历 ———
  function fromDate(date) {
    const y = date.getFullYear();
    // 以设备本地日期构造历日序号(用户在东八区时与官方历一致;其它时区按其本地历日)
    const D = Math.floor(Date.UTC(y, date.getMonth(), date.getDate()) / DAY);

    // 建月:取覆盖上一年与当年冬至的朔序列
    const k0 = Math.floor((y - 1 - 2000) * 12.3685) - 2;
    const moons = [];
    for (let k = k0; k <= k0 + 30; k++) moons.push(newMoonDay(k));
    const ws1 = winterSolsticeDay(y - 1), ws2 = winterSolsticeDay(y);
    const idxOfMonthContaining = d => { for (let i = 0; i < moons.length - 1; i++) if (moons[i] <= d && d < moons[i + 1]) return i; return -1; };
    const m11a = idxOfMonthContaining(ws1), m11b = idxOfMonthContaining(ws2);
    if (m11a < 0 || m11b < 0) throw new Error('朔序列覆盖不足');

    // 给 [m11a, m11b) 区间内各月编号(自十一月起),无中气置闰
    const suite = m11b - m11a; // 常 12,闰年 13
    const labels = {}; // moonIndex -> {num(1..12), leap}
    let leapUsed = false;
    let num = 11;
    for (let i = m11a; i < m11b; i++) {
      if (suite === 13 && !leapUsed && i > m11a && !hasZhongQi(moons[i], moons[i + 1])) {
        labels[i] = { num: (num + 10) % 12 + 1, leap: true }; // 闰月袭前月之名
        leapUsed = true;
        continue;
      }
      labels[i] = { num, leap: false };
      num = num % 12 + 1;
    }
    // 目标日所在月
    let mi = idxOfMonthContaining(D);
    if (mi < 0) throw new Error('日期越界');
    let lab = labels[mi];
    if (!lab) {
      // 日期落在当年冬至月及其后(下一轮起点):以下一轮首月为十一月顺推
      let n2 = 11, leap2 = false;
      // 判断下一轮是否闰:需再下一个冬至;简化:仅顺推编号(该区间内不会跨到需要置闰判断的位置超过两个月)
      for (let i = m11b; i <= mi; i++) {
        if (i === mi) { lab = { num: n2, leap: leap2 }; break; }
        n2 = n2 % 12 + 1;
      }
    }
    const lDay = D - moons[mi] + 1;
    // 农历年归属:m11a 起的冬月/腊月属农历 y-1 年,正月起属 y 年;
    // 落在当年冬至月及其后(mi >= m11b)的冬腊月属农历 y 年。
    let lYear;
    if (mi >= m11b) lYear = y;
    else if (lab.num >= 11) lYear = y - 1;
    else lYear = y;
    const hourIdx = Math.floor(((date.getHours() + 1) % 24) / 2); // 0=子
    // 农历年干支随正月初一为界(与排盘之立春界不同属两套惯例)
    const yearGZ = Najia.GAN[((lYear - 4) % 10 + 10) % 10] + Najia.ZHI[((lYear - 4) % 12 + 12) % 12];
    return {
      lYear, lMonth: lab.num, lDay, isLeap: lab.leap,
      monthName: (lab.leap ? '闰' : '') + MONTH_NAMES[lab.num - 1] + '月',
      dayName: DAY_NAMES[lDay - 1],
      hourBranch: Najia.ZHI[hourIdx], hourNum: hourIdx + 1, // 子=1 … 亥=12
      yearBranchNum: ((lYear - 4) % 12 + 12) % 12 + 1,      // 子=1 … 亥=12(梅花年数)
      yearGZ,
    };
  }
  function format(l) {
    return `${l.yearGZ}年${l.monthName}${l.dayName} ${l.hourBranch}时`;
  }

  return { fromDate, format, newMoonDay, winterSolsticeDay };
}));
