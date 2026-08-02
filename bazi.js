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
  // 十神的大白话对照(铁律八:术语只在推演时用,写给客人看的一律翻成这一列)。
  // **这张表只此一份**(§四 一个口径一处算):dashi 的年表依据、yunshi 的运势卡、
  // 将来任何要把十神说给客人听的地方,一律从这里取,不许各写各的。
  // 缘起:v0.65 修过一轮运势三卡的术语,但**年表的「依据」那一栏漏了**——
  // v0.80 拿断语体检员扫程序自己的成稿,量出年表依据 536 条里 190 条带术语(35.4%),
  // 而那一栏在运势页与吉日页都是直接渲染给客人看的。用户为这件事说过两次「看不懂」。
  const SHEN_PLAIN = {
    比肩: '跟你同路的人(同辈、同行、合伙的)',
    劫财: '跟你抢的人(同辈里分你东西的那种)',
    食神: '你拿得出手的本事(手艺、口才、作品)',
    伤官: '你身上那股锋芒(会出彩,也容易顶撞人)',
    正财: '正路来的钱(工资、正经买卖)',
    偏财: '外快与机会财(副业、人情场上的钱)',
    正官: '名分与规矩(职级、管你的人、正式手续)',
    七杀: '压着你的那股力(硬仗、期限、说一不二的人)',
    正印: '照应你的人与文书(长辈、靠山、证件合同)',
    偏印: '偏门的本事与心思(想得多、饭碗易生变)',
  };
  const plainShen = n => SHEN_PLAIN[n] || n;

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

  // 调候(寒暖之要):喜用之外此行亦作药。
  // 2026-08 之前这里只有一条粗糙规则(冬取火、夏取水),既不看日主、春秋六个月还完全没有。
  // 现按《穷通宝鉴》原文(data/classics/穷通宝鉴.txt)补日主×月份的逐格取用。
  // **收录口径**:只收「从原文断言句(专用X/先用X/喜X为用/X为尊/先X后Y/非X不…)里抽出的用神」
  // 与「通行整理版」两者一致的格子,双重印证,共 79/120 格;其余 41 格原文与整理版不合或抽不出,
  // 一概不收,退回下面那条粗糙规则并写明出处待核。宁可少收,不许把没核实的挂上书名。
  const TIAOHOU = {
    甲: { 寅: '丙', 卯: '庚', 辰: '庚', 巳: '癸', 午: '癸', 未: '癸', 申: '丁', 酉: '丁', 戌: '丁', 亥: '庚', 子: '丁', 丑: '丁' },
    乙: { 寅: '丙', 卯: '丙', 辰: '癸', 巳: '癸', 午: '癸', 未: '癸', 申: '己', 酉: '癸', 戌: '癸', 亥: '丙', 子: '丙', 丑: '丙' },
    丙: { 寅: '壬', 卯: '壬', 辰: '壬', 巳: '壬', 午: '壬', 未: '壬', 申: '壬', 酉: '壬', 戌: '甲', 子: '壬', 丑: '壬' },
    丁: { 寅: '庚', 卯: '庚', 辰: '甲', 巳: '甲', 未: '甲', 申: '甲', 酉: '甲', 戌: '甲', 亥: '甲', 子: '甲', 丑: '甲' },
    戊: { 寅: '丙', 卯: '丙', 辰: '甲', 巳: '甲', 午: '壬', 未: '癸', 申: '丙', 酉: '丙', 戌: '甲', 亥: '甲', 子: '丙', 丑: '丙' },
    己: { 寅: '丙', 卯: '甲', 辰: '丙', 巳: '癸', 午: '癸', 未: '癸', 申: '癸', 酉: '癸', 戌: '甲', 亥: '丙', 子: '丙', 丑: '丙' },
    庚: { 寅: '丙', 卯: '丁', 辰: '甲', 巳: '壬', 午: '壬', 未: '丁', 申: '丁', 酉: '丁', 戌: '甲', 亥: '丁', 子: '丁', 丑: '丙' },
    辛: { 寅: '己', 卯: '壬', 辰: '壬', 巳: '壬', 午: '壬', 未: '壬', 申: '壬', 酉: '壬', 戌: '壬', 亥: '壬', 子: '丙', 丑: '丙' },
    壬: { 寅: '庚', 卯: '戊', 辰: '甲', 巳: '壬', 午: '癸', 未: '辛', 申: '戊', 酉: '甲', 戌: '甲', 亥: '戊', 子: '戊', 丑: '丙' },
    癸: { 寅: '辛', 卯: '庚', 辰: '丙', 巳: '辛', 午: '庚', 未: '庚', 申: '丁', 酉: '辛', 戌: '辛', 亥: '庚', 子: '丙', 丑: '丙' },
  };
  // v0.76 补录的那批格子里,原文自己前后不一致的七格(开篇一说、收束句另一说,或季总纲与月条打架)。
  // 本表按定死的规程取了其中一味,但**分歧要当面告诉人**,不许装作原文只有一个说法。
  // 逐格的分歧内容存 data/tiaohou.json 的 _meta.补录分歧,有测试核这两处的格子对不对得上。
  const TIAOHOU_YI = ['甲申', '甲丑', '乙申', '乙酉', '丁亥', '丁子', '丁丑'];
  function tiaoHou(monthZhi, dayGan) {
    const u = dayGan && TIAOHOU[dayGan] && TIAOHOU[dayGan][monthZhi];
    if (u) return { need: GAN_WX[u], gan: u, src: '穷通宝鉴',
      yi: TIAOHOU_YI.includes(dayGan + monthZhi),
      note: `此月此日主,古法调候取${u}(${GAN_WX[u]})——依《穷通宝鉴》该月本条;` +
            `${GAN_WX[u]}这一行的颜色、方位、时辰都算你的药` +
            (TIAOHOU_YI.includes(dayGan + monthZhi)
              ? ';这一格原文前后有两种说法,本表取的是原文收束句那一味,另一说也记在案' : '') };
    if ('亥子丑'.includes(monthZhi)) return { need: '火', src: '通行口径,出处待核', note: '生于冬月,局寒——调候先取火(丙丁)暖局,穿用红紫、向南、午时发力皆是药' };
    if ('巳午未'.includes(monthZhi)) return { need: '水', src: '通行口径,出处待核', note: '生于夏月,局燥——调候先取水(壬癸)润局,黑蓝之色、向北、亥子时静养皆是药' };
    return null;
  }

  // 主排盘:birth 为 Date(设备本地时刻,视为出生地时间;传 lon 则先校真太阳时)
  // 晚子时(23点后)依当今主流「子时换日法」:日柱与五鼠遁均按次日排。
  function chart(birth, gender, lonDeg) {
    // 夏令时回拨与均时差是钟表时刻本身的事实,与是否填出生地无关(未填出生地按国标经线 120°E 计),
    // 只有经度差要靠出生地——不填就少这一项,不能连夏令时都不拨,否则 1986-91 年生人时柱整整错一个时辰。
    birth = trueSolarDate(birth, lonDeg);
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
    const kong = kongOf(dayGZ);
    for (const k of Object.keys(pillars)) {
      const p = pillars[k];
      p.ganWx = GAN_WX[p.gan]; p.zhiWx = ZHI_WX[p.zhi];
      p.ganShen = k === 'day' ? '日主' : shiShen(dayGan, p.gan);
      p.cang = CANGGAN[p.zhi].map((g, i) => ({
        gan: g, wx: GAN_WX[g], shen: shiShen(dayGan, g),
        qi: i === 0 ? '本气' : (i === 1 ? '中气' : '余气'),
      }));
      p.nayin = nayin(p.gz);                 // 纳音
      p.zizuo = changSheng(p.gan, p.zhi);    // 自坐十二运(本柱干坐本柱支)
      p.xingyun = changSheng(dayGan, p.zhi); // 星运(日主行至此支的十二运)
      p.kong = kong.includes(p.zhi);         // 是否落空亡
    }
    const days = daysIntoJie(birth);                  // 节入后第几天(定人元司令)
    const siLing = siLingOf(monthGZ[1], days);
    const strength = judgeStrength(pillars, dayGan, days);
    const cong = judgeCong(strength, pillars, dayGan);
    let yong = pickYongShen(dayGan, strength, tiaoHou(cal.monthZhi, dayGan));
    let geju = cong ? cong.name : null;
    if (cong && cong.type === '从强') {
      const me = GAN_WX[dayGan], yin = invSheng(me);
      yong = { strong: true, xiWx: [me, yin], jiWx: [KE[me], invKe(me), SHENG[me]].filter((v, i, a) => a.indexOf(v) === i), xiName: '比劫·印(从其强势)', jiName: '克泄耗(逆势为忌)' };
    } else if (cong && cong.type === '从弱') {
      const me = GAN_WX[dayGan];
      yong = { strong: false, xiWx: [KE[me], SHENG[me], invKe(me)], jiWx: [me, invSheng(me)], xiName: '财官食伤(从其弱势)', jiName: '比劫·印(逆势为忌)' };
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
      // gender 原先在这里 `|| '男'` 顶上——**那是本项目最里层的一处默认男**,
      // 上游即便改好了,这里照样会把空性别变成男命。v0.83 一并拔掉:
      // 性别未知就据实标成未知,大运那一路自己会停(见 computeDayun),喜忌照常算。
      birth, gender: (gender === '男' || gender === '女') ? gender : '',
      genderKnown: (gender === '男' || gender === '女'),
      pillars, dayGan, dayWx: GAN_WX[dayGan],
      ziNote: lateZi ? '晚子时(23点后)出生,依主流子时换日法,日柱按次日排' : null,
      strength, yong, geju, cong, tiaohou: tiaoHou(cal.monthZhi, dayGan), neiChong,
      kong, taiYuan: taiYuan(monthGZ), daysIntoJie: days, siLing,
      rel: strength.rel, wuxing: strength.pow, wuxingCount: countWuxing(pillars),
      lunarText: Lunar.format(lunar), calYear: cal.year, calMonth: cal.month, monthZhi: cal.monthZhi,
      dayun: computeDayun(pillars, yearGZ[0], gender, birth),
    };
  }

  // ————————————————————————————————————————————————
  //  排盘补全:纳音、十二长生、人元司令、胎元、刑冲合害会
  // ————————————————————————————————————————————————
  const NAYIN = ['海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
    '泉中水', '屋上土', '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木', '壁上土', '金箔金',
    '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水'];
  function jiaziIdx(gz) {
    const gi = GAN.indexOf(gz[0]), zi = ZHI.indexOf(gz[1]);
    if (gi < 0 || zi < 0) return -1;
    for (let i = 0; i < 60; i++) if (i % 10 === gi && i % 12 === zi) return i;
    return -1;
  }
  function nayin(gz) { const i = jiaziIdx(gz); return i < 0 ? '' : NAYIN[Math.floor(i / 2)]; }

  // 十二长生(阳干顺行、阴干逆行,与禄刃位自洽:甲禄寅刃卯、庚禄申刃酉…)
  const CS_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  const CS_START = { 甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申', 乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯' };
  function changSheng(gan, zhi) {
    const s = ZHI.indexOf(CS_START[gan]), z = ZHI.indexOf(zhi);
    if (s < 0 || z < 0) return '';
    return CS_NAMES[GAN_YY[gan] === 1 ? (z - s + 12) % 12 : (s - z + 12) % 12];
  }

  // 人元司令分野(行内通行表,单位:日;出处待核——本环境取不到古籍原文,
  //   此表来自通行转述而非核对过的原文,拿到原刻本再逐条挂出处)
  // 注:亥宫分野另列戊土七日,而通行藏干表「亥藏壬甲是真踪」不列戊,
  //     故本程序按藏干表过滤后按比例折回三十日,避免两张表打架。
  const SILING_RAW = {
    寅: [['戊', 7], ['丙', 7], ['甲', 16]], 卯: [['甲', 10], ['乙', 20]], 辰: [['乙', 9], ['癸', 3], ['戊', 18]],
    巳: [['戊', 5], ['庚', 9], ['丙', 16]], 午: [['丙', 10], ['己', 9], ['丁', 11]], 未: [['丁', 9], ['乙', 3], ['己', 18]],
    申: [['戊', 7], ['壬', 7], ['庚', 16]], 酉: [['庚', 10], ['辛', 20]], 戌: [['辛', 9], ['丁', 3], ['戊', 18]],
    亥: [['戊', 7], ['甲', 7], ['壬', 16]], 子: [['壬', 10], ['癸', 20]], 丑: [['癸', 9], ['辛', 3], ['己', 18]],
  };
  // 分野表与藏干表本是两张表:子月前十日壬水司令(壬是亥月余气),而藏干「子藏癸」只列本气。
  // 两表各司其职——分野只用来定「谁在当令」,藏干只用来分配地支力量,不再互相削足适履。
  const SILING = SILING_RAW;
  // 节入后经过日数(节气定月,自出生日回溯至月支变化之日)
  function daysIntoJie(date) {
    const mz = Najia.ganZhi(date).monthZhi;
    for (let i = 1; i <= 32; i++) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - i, 12);
      if (Najia.ganZhi(d).monthZhi !== mz) return i;
    }
    return 32;
  }
  function siLingOf(monthZhi, days) {
    let acc = 0;
    for (const [g, d] of SILING[monthZhi]) { acc += d; if (days <= acc) return { gan: g, days: d, upto: acc }; }
    const last = SILING[monthZhi][SILING[monthZhi].length - 1];
    return { gan: last[0], days: last[1], upto: 30 };
  }
  // 胎元:月干进一位、月支进三位
  function taiYuan(monthGZ) {
    return GAN[(GAN.indexOf(monthGZ[0]) + 1) % 10] + ZHI[(ZHI.indexOf(monthGZ[1]) + 3) % 12];
  }

  // 干支关系表
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const LIUHAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
  const SANXING = [[['寅', '巳', '申'], '无恩之刑'], [['丑', '戌', '未'], '恃势之刑']];
  const ZIXING = ['辰', '午', '酉', '亥'];
  const SANHE = [[['申', '子', '辰'], '水'], [['亥', '卯', '未'], '木'], [['寅', '午', '戌'], '火'], [['巳', '酉', '丑'], '金']];
  const SANHUI = [[['亥', '子', '丑'], '水'], [['寅', '卯', '辰'], '木'], [['巳', '午', '未'], '火'], [['申', '酉', '戌'], '金']];
  const GANHE = { 甲: ['己', '土'], 己: ['甲', '土'], 乙: ['庚', '金'], 庚: ['乙', '金'], 丙: ['辛', '水'], 辛: ['丙', '水'], 丁: ['壬', '木'], 壬: ['丁', '木'], 戊: ['癸', '火'], 癸: ['戊', '火'] };
  const PILLAR_NAME = { year: '年', month: '月', day: '日', hour: '时' };

  // 四柱刑冲合害会:逐对列出,不含大运流年(那是流运的事)
  function relations(pillars) {
    const ks = ['year', 'month', 'day', 'hour'];
    const zs = ks.map(k => pillars[k].zhi), gs = ks.map(k => pillars[k].gan);
    const out = { chong: [], he: [], hai: [], xing: [], sanhe: [], sanhui: [], ganhe: [], ganchong: [] };
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const a = zs[i], b = zs[j], tag = PILLAR_NAME[ks[i]] + PILLAR_NAME[ks[j]];
      if ((ZHI.indexOf(a) + 6) % 12 === ZHI.indexOf(b)) out.chong.push(`${tag}·${a}${b}相冲`);
      if (LIUHE[a] === b) out.he.push(`${tag}·${a}${b}六合`);
      if (LIUHAI[a] === b) out.hai.push(`${tag}·${a}${b}相害`);
      if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) out.xing.push(`${tag}·子卯相刑(无礼之刑)`);
      if (a === b && ZIXING.includes(a)) out.xing.push(`${tag}·${a}${b}自刑`);
      // 天干:五合与相冲(戊己居中不冲)
      if (GANHE[gs[i]] && GANHE[gs[i]][0] === gs[j]) out.ganhe.push(`${tag}干·${gs[i]}${gs[j]}合化${GANHE[gs[i]][1]}`);
      if (GAN_WX[gs[i]] === KE[GAN_WX[gs[j]]] || GAN_WX[gs[j]] === KE[GAN_WX[gs[i]]]) {
        if (GAN_YY[gs[i]] === GAN_YY[gs[j]] && !'戊己'.includes(gs[i]) && !'戊己'.includes(gs[j])) out.ganchong.push(`${tag}干·${gs[i]}${gs[j]}相冲`);
      }
    }
    for (const [trio, name] of SANXING) if (trio.every(z => zs.includes(z))) out.xing.push(`${trio.join('')}三刑(${name})`);
    for (const [trio, wx] of SANHE) {
      if (trio.every(z => zs.includes(z))) out.sanhe.push({ text: `${trio.join('')}三合${wx}局`, wx, full: true });
      else { // 半合:必带旺神(子午卯酉)方论
        const wang = trio[1];
        if (zs.includes(wang) && (zs.includes(trio[0]) || zs.includes(trio[2]))) {
          const other = zs.includes(trio[0]) ? trio[0] : trio[2];
          out.sanhe.push({ text: `${wang}${other}半合${wx}`, wx, full: false });
        }
      }
    }
    for (const [trio, wx] of SANHUI) if (trio.every(z => zs.includes(z))) out.sanhui.push({ text: `${trio.join('')}三会${wx}方`, wx });
    return out;
  }

  // ————————————————————————————————————————————————
  //  旺衰:双向称量法(不是单报「帮身分」,而是同党/异党各自称重)
  //  旧法之弊:只累加生扶、把 100−生扶 当作克泄,克泄一方从未真正称过,
  //  于是「丙火时支坐禄」这种明明有根的盘也能掉进从格,喜忌整个翻转。
  //  今法:八个字(四干四支)按位置定权,地支按藏干分野拆权,月支按人元司令比例拆,
  //        天干有根加力、虚透减力,再计三会三合成势,归一到百分,
  //        同党(比劫+印)与异党(食伤+财+官杀)正面对称。
  // ————————————————————————————————————————————————
  const POS_W = { dayGan: 9, monthGan: 9, yearGan: 8, hourGan: 8, monthZhi: 28, dayZhi: 16, yearZhi: 11, hourZhi: 11 };
  const CANG_RATIO = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.28, 0.12] };

  function wuxingPower(pillars, dayGan, days) {
    const add = {}; for (const w of ['木', '火', '土', '金', '水']) add[w] = 0;
    const ks = ['year', 'month', 'day', 'hour'];
    // 一、天干(日干本身也占位:日主即比肩,自己是自己的党)
    const ganW = { year: POS_W.yearGan, month: POS_W.monthGan, day: POS_W.dayGan, hour: POS_W.hourGan };
    const allZhi = ks.map(k => pillars[k].zhi);
    const rooted = g => allZhi.some(z => CANGGAN[z].some(c => GAN_WX[c] === GAN_WX[g]));
    for (const k of ks) {
      const g = pillars[k].gan;
      add[GAN_WX[g]] += ganW[k] * (rooted(g) ? 1.3 : 0.6); // 有根方能任事,虚透力减
    }
    // 二、地支(月支按人元司令比例,余支按本气/中气/余气)
    const zhiW = { year: POS_W.yearZhi, month: POS_W.monthZhi, day: POS_W.dayZhi, hour: POS_W.hourZhi };
    for (const k of ks) {
      const z = pillars[k].zhi, cang = CANGGAN[z], W = zhiW[k];
      if (k === 'month') {
        // 月支力量仍按藏干本/中/余气分,再给「当令者」加权五成(当令者不在藏干里则不加)
        const r = CANG_RATIO[cang.length] || CANG_RATIO[3];
        const ruler = siLingOf(z, days).gan;
        const parts = cang.map((g, i) => [g, (r[i] || 0) * (g === ruler ? 1.5 : 1)]);
        const ps = parts.reduce((a, e) => a + e[1], 0) || 1;
        parts.forEach(([g, w]) => { add[GAN_WX[g]] += W * w / ps; });
      } else {
        const r = CANG_RATIO[cang.length] || CANG_RATIO[3];
        cang.forEach((g, i) => { add[GAN_WX[g]] += W * (r[i] || 0); });
      }
    }
    // 三、成局成方(会方力大于合局,半合再次之)
    const rel = relations(pillars);
    const bonus = [];
    for (const h of rel.sanhui) { add[h.wx] += 10; bonus.push(h.text + '(+10)'); }
    for (const h of rel.sanhe) { const b = h.full ? 8 : 4; add[h.wx] += b; bonus.push(h.text + '(+' + b + ')'); }
    // 四、归一到百分
    const tot = Object.values(add).reduce((a, b) => a + b, 0) || 1;
    const pow = {}; for (const w of Object.keys(add)) pow[w] = +(add[w] / tot * 100).toFixed(1);
    return { pow, bonus, rel };
  }

  // 日主通根明细:本气根(禄刃/长生之类)最实,中气次之,余气(墓库)最虚
  function rootsOf(pillars, dayGan) {
    const me = GAN_WX[dayGan], out = [];
    for (const k of ['year', 'month', 'day', 'hour']) {
      const z = pillars[k].zhi;
      CANGGAN[z].forEach((g, i) => {
        if (GAN_WX[g] !== me) return;
        const lv = i === 0 ? '本气根' : (i === 1 ? '中气根' : '余气根');
        const cs = changSheng(dayGan, z);
        out.push({ pos: PILLAR_NAME[k], zhi: z, gan: g, level: lv, cs, strong: i === 0 });
      });
    }
    return out;
  }

  const BANDS = [[65, '身旺'], [55, '偏旺'], [45, '中和'], [35, '偏弱'], [-1, '身弱']];
  // 旺衰五档的大白话对照。**这张表只此一份**(§四 一个口径一处算)。
  // 缘起(v0.81):拿断语体检员扫程序自己的成稿,发现「身弱」两个字一直原样摆在运势页
  // 「你这人底子身弱」、侧栏「底子」那一行、地利「先说你的喜忌」那一段里——都是给客人看的,违反铁律八。
  // band 本身不动(材料、专业区、回测都靠它),只是**客人那一头一律走 plainBand**。
  const BAND_PLAIN = { 身旺: '厚', 偏旺: '偏厚', 中和: '不厚不薄', 偏弱: '偏薄', 身弱: '薄' };
  const plainBand = b => BAND_PLAIN[b] || b;
  // 「得不得令」五种说法的白话对照(同上,只此一份)。运势页命盘那一行直接渲染它。
  const DELING_PLAIN = {
    当令: '生在自己当家的月份,一出生就占着地利',
    得月令之生: '生在有人给你添力的月份',
    '受月令克(失令)': '生在压着你的月份,起手就吃亏',
    泄于月令: '生在往外泄你的月份,力气容易散',
    '克月令(耗力)': '生在得你去克的月份,使的是自己的劲',
  };
  const plainDeLing = d => DELING_PLAIN[d] || d;
  // 从格三档的白话对照(同上,只此一份)。定时辰板块拿它区分「哪几个时辰断得不一样」。
  const CONG_PLAIN = { 正格: '常规这一档', 从强格: '一路强到底这一档', 从弱格: '整盘顺着势走这一档', 假从: '像顺势又不算这一档' };
  const plainGe = g => CONG_PLAIN[String(g || '').split('(')[0]] || g;

  function judgeStrength(pillars, dayGan, days) {
    const me = GAN_WX[dayGan], yin = invSheng(me);
    const { pow, bonus, rel } = wuxingPower(pillars, dayGan, days);
    const tong = +(pow[me] + pow[yin]).toFixed(1);                    // 同党:比劫+印
    const yi = +(100 - tong).toFixed(1);                              // 异党:食伤+财+官杀
    const roots = rootsOf(pillars, dayGan);
    const band = BANDS.find(b => tong >= b[0])[1];
    const deLing = getDeLing(pillars.month.zhi, me);
    return {
      strong: tong >= 50, pct: Math.round(tong), band,
      help: tong, drain: yi, tong, yi, pow, bonus, roots,
      hasRoot: roots.length > 0, hasStrongRoot: roots.some(r => r.strong),
      yinPower: pow[yin], biPower: pow[me], deLing,
      detail: { 比劫: pow[me], 印: pow[yin], 食伤: pow[SHENG[me]], 财: pow[KE[me]], 官杀: pow[invKe(me)] },
      rel,
    };
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

  // 从格判定:铁门槛「有根不从」——日主但凡在四支藏干里有一点根,就不许从。
  // 这条门槛有原文撑腰,出处:《滴天髓阐微·衰旺章》「日干不论月令休囚，只要四柱有根，便能受财官食神而当伤官七杀」;
  // 同书又说,出处:《滴天髓阐微·干支总论》「就使逢库，亦为有根」——墓库也算根,只是轻根。
  // (v0.79 更正章名:此前标的是「地支章」,拿 tools/chapter-check.mjs 一查,这句实际落在「九、干支总论」。)
  // (同书从象章的命例里却有带库根仍判从的,原文两处自相牵制;详见 docs/从格复核-01-滴天髓命例.md,
  //  此处从严——宁可少断从格,不可反断。)
  //
  // 真从弱:四支无一丝比劫之根、印又无力、同党极微。
  // 真从强:v0.76 改——旧法用「异党 ≤ 15」一刀切,把食伤也算作破从的力量,于是原书自己的
  //   从旺样板「丙午 甲午 丙午 甲午」(四柱皆刃)因午中己土占了两成多而判不成从。
  //   原书两处都只把财与官杀当破从之物,出处:《滴天髓阐微·从象章》「从旺者，四柱皆比劫，无官杀之制，有印绶之生」,
  //   同章又说,出处:《滴天髓阐微·从象章》「绝无一毫财星官杀之气，谓二人同心，强之极矣」;
  //   且明说「如局中印轻，行伤食亦佳」——食伤不破从。
  //   故改为直接称量财与官杀。人群实测:从强占比 0.64% → 0.40%(更严),该样板盘转为判对。
  //
  // margin(v0.77 加):离「掉出这一格」还差几分。从格一成立喜忌就翻 180°,
  //   所以「离门槛多远」跟「是不是从格」一样重要——实测 6000 副盘,判真从的里头
  //   有 11.9%(从弱)与 13.6%(从强)离门槛不足 1 分,那种盘的喜忌本质上是掷硬币掷出来的。
  //   本函数只负责把这个距离算出来;要不要因此改口,由上层决定(见 Dingshi.stability)。
  function judgeCong(st, pillars, dayGan) {
    const me = GAN_WX[dayGan], yin = invSheng(me);
    if (!st.hasRoot && st.yinPower <= 8 && st.tong <= 20) {
      return { type: '从弱', name: '从弱格(四支无根、印星无力,弃命从势)',
        margin: +Math.min(20 - st.tong, 8 - st.yinPower).toFixed(1) };
    }
    if ((st.detail.财 + st.detail.官杀) <= 3 && st.tong >= 70 && ['当令', '得月令之生'].includes(st.deLing)) {
      return { type: '从强', name: '从强格(满局生扶、财官几无,顺其强势)',
        margin: +Math.min(st.tong - 70, 3 - (st.detail.财 + st.detail.官杀)).toFixed(1) };
    }
    if (!st.hasRoot && st.tong <= 30) {
      return { type: '假从', name: '假从(无根而印比尚存一线,不作真从论,仍以扶抑为主)',
        margin: +(30 - st.tong).toFixed(1) };
    }
    return null;
  }

  // 五行个数(排盘常列的「几木几火」,按八字字面数,藏干另计)
  function countWuxing(pillars) {
    const c = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    for (const k of ['year', 'month', 'day', 'hour']) { c[GAN_WX[pillars[k].gan]]++; c[ZHI_WX[pillars[k].zhi]]++; }
    return c;
  }

  // 喜用忌:扶抑为主、调候为急。
  //  身旺/偏旺 → 喜克泄耗(食伤财官杀),忌生扶;
  //  身弱/偏弱 → 喜生扶(印比),忌克泄耗;
  //  中和(45-55) → 扶抑无甚可扶,古法「中和之命取调候、取通关」:
  //                先看寒暖(冬取火夏取水),无调候可取则补五行中最弱的一方,不硬分强弱。
  function pickYongShen(dayGan, st, th) {
    const me = GAN_WX[dayGan];
    const yin = invSheng(me), shi = SHENG[me], cai = KE[me], guan = invKe(me);
    const help = [me, yin], drain = [shi, cai, guan];
    const band = st.band || (st.strong ? '身旺' : '身弱');
    if (band === '中和') {
      // 中和之局:调候优先;无调候则取局中最弱的五行为药(通关补缺)
      const weakest = Object.keys(st.pow).sort((x, y) => st.pow[x] - st.pow[y])[0];
      const needTiao = th && st.pow[th.need] < 12;   // 调候只在确实缺那味药时才取
      const xi = needTiao ? [th.need, weakest].filter((v, i, a) => a.indexOf(v) === i) : [weakest];
      const strongest = Object.keys(st.pow).sort((x, y) => st.pow[y] - st.pow[x])[0];
      return {
        strong: st.strong, band, xiWx: xi, jiWx: [strongest].filter(w => !xi.includes(w)),
        xiName: needTiao ? `调候取${th.need}(中和之局以寒暖为急),兼补最弱之${weakest}` : `补局中最弱之${weakest}(中和之局取通关补缺)`,
        jiName: `局中已过旺之${strongest}`,
        neutral: true,
      };
    }
    const strong = band === '身旺' || band === '偏旺';
    const xi = strong ? drain.slice() : help.slice();
    const ji = strong ? help.slice() : drain.slice();
    // 调候为急:冬生取火、夏生取水,纵与扶抑相左也须并列为药(古法「调候急于扶抑」)
    let tiaoNote = '';
    const lackTiao = th && st.pow[th.need] < 12 && !(strong && th.need === me);
    if (lackTiao && !xi.includes(th.need)) { xi.push(th.need); tiaoNote = `;局中${th.need}仅${st.pow[th.need]}分,寒暖失衡,另调候急取${th.need}`; }
    return {
      strong, band, xiWx: xi, jiWx: ji.filter(w => !xi.includes(w)),
      xiName: (strong ? '食伤·财·官杀(耗泄)' : '比劫·印(生扶)') + tiaoNote,
      jiName: strong ? '比劫·印' : '财·官杀·食伤',
    };
  }
  function invKe(el) { for (const a of Object.keys(KE)) if (KE[a] === el) return a; }

  // 大运:阳年男/阴年女顺行,阴年男/阳年女逆行;自月柱起排,起运岁由节气距离约算
  //
  // **性别不填就不许排大运**(v0.83)。缘起:上游原先在拿不到性别时按「男」顶上,
  // 而 `gender === '男'` 对空值恒为 false,于是空性别被**当成女命**排,一声不吭。
  // 实测 368 副盘:性别一换,大运顺逆 **100% 翻转**、第一步干支 100% 不同;
  // 逐年主事型 32.0% 对不上、人生节点 34.9% 对不上——填错等于看的是另一个人的一生。
  // 时辰不知道情有可原(v0.77 因此选择「照算但把话说清」),性别没人不知道,
  // 所以这一层的处置是**不排**,而不是「排了再解释」。
  // 留神:**喜忌不看性别**(实测改变 0.0%),所以只有大运这一路停,
  // 日运/月运/择日「对你」层/地利这些只吃喜忌的照常算——不许一竿子打翻。
  function computeDayun(pillars, yearGan, gender, birth) {
    if (gender !== '男' && gender !== '女') {
      return { unknown: true, forward: null, startAge: null, startDays: null, list: [],
        startText: '性别没填,大运方向定不了(古法阳男阴女顺行、阴男阳女逆行)' };
    }
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
    kongOf, flowMarks, tianZhongShaYears, jiShi, HOUR_SPAN, trueSolarDate, eotMinutes, tiaoHou, TIANYI, WENCHANG, YANGREN, TAOHUA, YIMA, HUAGAI, HONGLUAN, sanheIdx,
    SHEN_PLAIN, plainShen, BAND_PLAIN, plainBand, DELING_PLAIN, plainDeLing, CONG_PLAIN, plainGe,
    nayin, changSheng, taiYuan, siLingOf, SILING, daysIntoJie, relations, judgeStrength, judgeCong, wuxingPower, rootsOf, countWuxing, pickYongShen };
}));
