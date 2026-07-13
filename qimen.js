// qimen.js — 时家奇门遁甲:转盘法 · 拆补定局
// 定局:节气三元(阴阳遁 + 局数,冬至起阳遁、夏至起阴遁);符头(近甲己日)地支定上中下元。
// 地盘:阳遁顺、阴遁逆,布六仪三奇(戊己庚辛壬癸丁丙乙)。
// 天盘:值符星加于时干所落之宫,九星随转;八门:值使加于时宫(阳顺阴逆数时辰);
// 八神:值符神起于天盘值符宫,阳顺阴逆。中五宫寄坤二。
// 依《烟波钓叟歌》《奇门遁甲统宗》通行体例。爻宫序用洛书九宫。内测法,school 取转盘·拆补。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./najia.js')); }
  else { root.Qimen = factory(root.Najia); }
}(typeof self !== 'undefined' ? self : this, function (Najia) {
  const GAN = Najia.GAN, ZHI = Najia.ZHI;

  // 24 节气,0 = 冬至(黄经 270°),每 15° 一气
  const JIEQI = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种',
    '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'];
  // 各节气 上元/中元/下元 三元局数(1–9)
  const JU = [
    [1, 7, 4], [2, 8, 5], [3, 9, 6], [8, 5, 2], [9, 6, 3], [1, 7, 4], [3, 9, 6], [4, 1, 7], [5, 2, 8], [4, 1, 7], [5, 2, 8], [6, 3, 9],
    [9, 3, 6], [8, 2, 5], [7, 1, 4], [2, 5, 8], [1, 4, 7], [9, 3, 6], [7, 1, 4], [6, 9, 3], [5, 8, 2], [6, 9, 3], [5, 8, 2], [4, 7, 1],
  ];
  // 地盘布序:六仪(戊己庚辛壬癸)后接三奇(丁丙乙)
  const YIQI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
  // 九宫:1坎北 2坤西南 3震东 4巽东南 5中 6乾西北 7兑西 8艮东北 9离南
  const GONG = {
    1: { name: '坎', dir: '正北', wx: '水' }, 2: { name: '坤', dir: '西南', wx: '土' }, 3: { name: '震', dir: '正东', wx: '木' },
    4: { name: '巽', dir: '东南', wx: '木' }, 5: { name: '中', dir: '中央', wx: '土' }, 6: { name: '乾', dir: '西北', wx: '金' },
    7: { name: '兑', dir: '正西', wx: '金' }, 8: { name: '艮', dir: '东北', wx: '土' }, 9: { name: '离', dir: '正南', wx: '火' },
  };
  const HOME_STAR = { 1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英' };
  const HOME_GATE = { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' };
  const STAR_JI = { 天蓬: '凶(盗贼水险)', 天芮: '大凶(病)', 天冲: '小吉(动利)', 天辅: '吉(文昌)', 天禽: '吉(中正)', 天心: '大吉(医药谋)', 天柱: '凶(破守)', 天任: '吉(稳)', 天英: '平(血光文明)' };
  const GATE_JI = { 开门: '大吉(求官出行)', 休门: '吉(见贵谈和)', 生门: '大吉(求财治病)', 伤门: '凶(争斗损伤)', 杜门: '凶(闭藏躲避)', 景门: '平(文书信息)', 死门: '大凶(死丧诉讼)', 惊门: '凶(惊恐口舌)' };
  const SHEN = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];
  const SHEN_JI = { 值符: '吉(贵人)', 螣蛇: '虚惊怪异', 太阴: '吉(暗中相助)', 六合: '吉(和合婚姻)', 白虎: '凶(伤病争杀)', 玄武: '凶(盗骗暗昧)', 九地: '吉(藏守坚固)', 九天: '吉(扬名远行)' };
  const XUNSHOU = ['戊', '己', '庚', '辛', '壬', '癸']; // 甲子旬→戊、甲戌旬→己 … 甲寅旬→癸
  const RING = [1, 8, 3, 4, 9, 2, 7, 6];  // 转盘环序(顺时针八宫;中5寄坤2)
  const NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const eff = p => (p === 5 ? 2 : p);     // 中宫寄坤二
  const rIdx = p => RING.indexOf(eff(p));

  function gz60(gIdx, zIdx) { for (let i = 0; i < 60; i++) if (i % 10 === gIdx && i % 12 === zIdx) return i; return -1; }

  // 主排盘:date 为 Date(按其本地历日与时刻)
  function cast(date) {
    const d = date || new Date();
    const cal = Najia.ganZhi(d);
    const dIdx = Najia.dayIndex(d.getFullYear(), d.getMonth() + 1, d.getDate()); // 日 60 甲子 0..59

    // 节气 + 阴阳遁
    const qi = Math.floor((((cal.sunLon - 270) % 360 + 360) % 360) / 15); // 0=冬至 … 23=大雪
    const yin = qi >= 12;                                                  // 夏至起阴遁

    // 拆补定元:符头 = 最近(含当日)之甲或己日,其地支定上中下元
    const dayGan = dIdx % 10;
    const fuTou = ((dIdx - (dayGan % 5)) % 60 + 60) % 60;
    const fuZhi = fuTou % 12;
    const yuan = (fuZhi % 3 === 0) ? 0 : (fuZhi % 3 === 2 ? 1 : 2);        // 子午卯酉→上、寅申巳亥→中、辰戌丑未→下
    const ju = JU[qi][yuan];

    // 时干支(五鼠遁)
    const hb = Math.floor(((d.getHours() + 1) % 24) / 2);                  // 时支 子=0
    const hGan = ((dayGan % 5) * 2 + hb) % 10;
    const hIdx = gz60(hGan, hb);                                           // 时 60 甲子
    const xun = Math.floor(hIdx / 10);
    const fuYi = XUNSHOU[xun];                                             // 符头仪(旬首所遁之仪)

    // 地盘:布六仪三奇
    const earth = {}, ganPos = {};
    for (let i = 0; i < 9; i++) {
      const p = yin ? ((ju - 1 - i) % 9 + 9) % 9 + 1 : ((ju - 1 + i) % 9) + 1;
      earth[p] = YIQI[i]; ganPos[YIQI[i]] = p;
    }

    const fuGong = ganPos[fuYi];                       // 符头仪落宫 = 值符本宫
    // 符头仪若在中5,值符为天禽,寄坤2、与天芮同宫同行,盘面以坤2天芮为值符位
    const zhiFuStar = HOME_STAR[eff(fuGong)];
    const zhiShiGate = HOME_GATE[eff(fuGong)];
    const shiGong = (GAN[hGan] === '甲') ? fuGong : ganPos[GAN[hGan]]; // 甲遁符头仪

    const offStar = ((rIdx(shiGong) - rIdx(fuGong)) % 8 + 8) % 8;       // 值符加时干
    const dir = yin ? -1 : 1;
    const k = hIdx % 10;                                                // 时在本旬中的位次(旬首=0)
    const offGate = ((dir * k) % 8 + 8) % 8;                            // 值使加时宫(阳顺阴逆)

    // 组装八宫(1..9 除5)
    const cells = {};
    for (const p of [1, 2, 3, 4, 6, 7, 8, 9]) {
      const j = rIdx(p);
      const srcStar = RING[((j - offStar) % 8 + 8) % 8];
      const srcGate = RING[((j - offGate) % 8 + 8) % 8];
      cells[p] = {
        gong: p, name: GONG[p].name, dir: GONG[p].dir, wx: GONG[p].wx,
        earthGan: earth[p], skyGan: earth[srcStar],
        star: HOME_STAR[srcStar], gate: HOME_GATE[srcGate],
      };
    }
    cells[5] = { gong: 5, name: '中', dir: '中央', wx: '土', earthGan: earth[5], skyGan: null, star: '天禽(寄二)', gate: null };

    // 八神:值符神起于天盘值符宫(=时干宫),阳顺阴逆
    const startR = rIdx(shiGong);
    for (let s = 0; s < 8; s++) {
      const p = RING[((startR + dir * s) % 8 + 8) % 8];
      cells[p].shen = SHEN[s];
    }
    cells[5].shen = null;

    // 吉凶注记
    for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const c = cells[p];
      c.starJi = STAR_JI[c.star.replace('(寄二)', '')] || '';
      c.gateJi = c.gate ? GATE_JI[c.gate] : '';
      c.shenJi = c.shen ? SHEN_JI[c.shen] : '';
    }

    return {
      date: d, cal,
      qi, jieqi: JIEQI[qi], yin, ju, yuan: ['上元', '中元', '下元'][yuan],
      dun: (yin ? '阴遁' : '阳遁') + NUM[ju] + '局',
      dayGZ: cal.day, hourGZ: GAN[hGan] + ZHI[hb], fuYi,
      zhiFu: { star: zhiFuStar, homeGong: fuGong, atGong: eff(shiGong), qinJi: fuGong === 5 }, // 值符星:本宫→飞至时干宫;qinJi=符头在中5(天禽寄坤二)
      zhiShi: { gate: zhiShiGate, homeGong: eff(fuGong), atGong: RING[((rIdx(fuGong) + offGate) % 8 + 8) % 8] },
      cells,
    };
  }

  // 八门落到实事上的大白话
  const GATE_USE = {
    开门: '出门、见贵人、办正事、求官谋职最顺', 休门: '歇缓、谈和、见贵人、婚嫁办喜事吉',
    生门: '求财、看病、置业、办实事最旺的一门', 伤门: '争斗讨债、追人索物有力,但问病问和问平安不利',
    杜门: '宜守不宜进、宜藏宜避,躲事避灾可以,办事推进则被堵', 景门: '文书、信息、考试、宣传、打听消息',
    死门: '办事僵住不动、拖沓无果,涉丧涉讼才用得上', 惊门: '虚惊、口舌是非、官非纠缠,心神不宁',
  };
  // 事宫(值符/时干所临之宫)综合吉凶
  function verdict(c) {
    const gW = { 开门: 3, 休门: 2, 生门: 3, 景门: 0, 杜门: -1, 伤门: -2, 惊门: -2, 死门: -3 };
    const sW = { 天心: 2, 天辅: 2, 天任: 1, 天禽: 1, 天冲: 1, 天英: 0, 天柱: -2, 天蓬: -2, 天芮: -3 };
    const nW = { 值符: 2, 太阴: 1, 六合: 1, 九地: 1, 九天: 1, 螣蛇: -1, 白虎: -2, 玄武: -2 };
    const g = c.cells[c.zhiFu.atGong];
    const star = (g.star || '').replace('(寄二)', '');
    const score = (gW[g.gate] || 0) + (sW[star] || 0) + (nW[g.shen] || 0);
    const lv = score >= 4 ? '上吉' : score >= 2 ? '顺' : score >= -1 ? '平' : score >= -3 ? '滞' : '凶';
    return {
      gong: g.gong, name: g.name, dir: g.dir, gate: g.gate, star, shen: g.shen,
      score, lv, gateUse: GATE_USE[g.gate] || '',
    };
  }

  // 供 AI 深断的起局文本
  function report(c) {
    const order = [4, 9, 2, 3, 5, 7, 8, 1, 6]; // 巽离坤 / 震中兑 / 艮坎乾,九宫盘面顺序
    let s = `【奇门遁甲 · 起局回报(时家 · 转盘 · 拆补)】\n`;
    s += `起局:${c.cal.year} ${c.cal.month} ${c.dayGZ}日 ${c.hourGZ}时(节气${c.jieqi}·${c.yuan})\n`;
    s += `遁局:${c.dun}　旬首之仪:${c.fuYi}\n`;
    s += `值符:${c.zhiFu.star}${c.zhiFu.qinJi ? '(符头在中5,天禽寄坤二、以天芮同宫论)' : ''}(本居${GONG[c.zhiFu.homeGong].name}${c.zhiFu.homeGong}宫)飞临${GONG[c.zhiFu.atGong].name}${c.zhiFu.atGong}宫\n`;
    s += `值使:${c.zhiShi.gate}(本居${GONG[c.zhiShi.homeGong].name}${c.zhiShi.homeGong}宫)飞临${GONG[c.zhiShi.atGong].name}${c.zhiShi.atGong}宫\n`;
    s += `九宫盘面(天盘干/地盘干 · 九星 · 八门 · 八神 · 方位):\n`;
    for (const p of order) {
      const x = c.cells[p];
      if (p === 5) { s += `　[中5·中央] 地盘${x.earthGan}　${x.star}\n`; continue; }
      s += `　[${x.name}${p}·${x.dir}] 天${x.skyGan}/地${x.earthGan}　${x.star}(${x.starJi})　${x.gate}(${x.gateJi})　${x.shen}(${x.shenJi})\n`;
    }
    return s;
  }

  return { cast, report, verdict, GATE_USE, GONG, JIEQI, JU, RING, HOME_STAR, HOME_GATE };
}));
