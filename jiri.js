// jiri.js — 吉日历(择吉):建除十二神 + 黄黑道值神 + 冲煞合害 + 本命生克
// 依据:建除自月建起顺行十二辰(「建满平收黑,除危定执黄,成开皆可用,破闭不相当」);
// 值神青龙歌诀「寅申须加子,卯酉却居寅,辰戌龙位上,巳亥午中寻,子午临申地,丑未戌上行」,
// 黄道六神:青龙明堂金匮天德玉堂司命;冲煞按日支六冲生肖,煞方依三合局(申子辰煞南等)。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./lunar.js'));
  } else { root.Jiri = factory(root.Najia, root.Lunar); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Lunar) {
  const ZHI = Najia.ZHI, GAN = Najia.GAN;
  const ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  const zi = name => ZHI.indexOf(name);

  // ——— 建除十二神:月建地支日为「建」,顺行 ———
  const JIANCHU = [
    { name: '建', luck: 0, gist: '万物初始,旺气之日', yi: '出行、赴任、求谋、拜师', ji: '动土、开仓、安葬' },
    { name: '除', luck: 2, gist: '除旧布新', yi: '打扫除秽、治病就医、了结旧事', ji: '搬家入宅、嫁娶大事' },
    { name: '满', luck: 0, gist: '丰收圆满', yi: '祭祀祈福、开市纳财', ji: '上任、服药、安葬' },
    { name: '平', luck: 0, gist: '平平常常', yi: '修饰、涂泥、日常事务', ji: '大动作皆不显' },
    { name: '定', luck: 2, gist: '安定平顺', yi: '订盟订婚、签约宴饮、安床', ji: '就医、诉讼、出师' },
    { name: '执', luck: 2, gist: '固执其事', yi: '建屋种植、捕捉、收账', ji: '搬家、远行、开市' },
    { name: '破', luck: -4, gist: '日月相冲,大事勿用', yi: '拆除、破屋、求医治病', ji: '其余诸事不取' },
    { name: '危', luck: 2, gist: '危中藏机,宜静不宜险', yi: '安床、祭祀、谨慎小事', ji: '登高、行船、冒险' },
    { name: '成', luck: 3, gist: '万事有成', yi: '开业、嫁娶、上任、入学', ji: '诉讼' },
    { name: '收', luck: 0, gist: '收敛纳藏', yi: '收账、纳财、入仓', ji: '开张、出行、下葬' },
    { name: '开', luck: 3, gist: '开通顺遂', yi: '开业开工、嫁娶、求职、入学', ji: '动土、安葬' },
    { name: '闭', luck: -2, gist: '闭塞不通', yi: '筑堤、封仓、收尾', ji: '开市、出行、上任' },
  ];

  // ——— 黄黑道十二值神:按月支定青龙起点,顺行 ———
  // 起点 = (月支×2 + 8) % 12:寅申→子,卯酉→寅,辰戌→辰,巳亥→午,子午→申,丑未→戌
  const ZHISHEN = [
    { name: '青龙', huang: true, luck: 3, note: '天乙黄道,万事大吉' },
    { name: '明堂', huang: true, luck: 2, note: '贵人黄道,宜见贵、上书、谋事' },
    { name: '天刑', huang: false, luck: -2, note: '黑道,忌词讼动土,利武不利文' },
    { name: '朱雀', huang: false, luck: -2, note: '黑道,防口舌是非,签约谈判慎' },
    { name: '金匮', huang: true, luck: 2, note: '福德黄道,宜嫁娶、纳财' },
    { name: '天德', huang: true, luck: 3, note: '宝光黄道,宜祈福、修造、大事' },
    { name: '白虎', huang: false, luck: -2, note: '黑道,忌远行冒险,祭祀可制' },
    { name: '玉堂', huang: true, luck: 2, note: '少微黄道,宜安床入宅、文书' },
    { name: '天牢', huang: false, luck: -2, note: '黑道,忌官司囚系、强出头' },
    { name: '玄武', huang: false, luck: -2, note: '黑道,防盗防小人、暗昧不明' },
    { name: '司命', huang: true, luck: 2, note: '凤辇黄道,白日用事吉' },
    { name: '勾陈', huang: false, luck: -2, note: '黑道,忌田土纠纷,事易缠绕' },
  ];

  const jianchuOf = (monthZhi, dayZhi) => JIANCHU[(zi(dayZhi) - zi(monthZhi) + 12) % 12];
  const zhishenOf = (monthZhi, dayZhi) => {
    const start = (zi(monthZhi) * 2 + 8) % 12;
    return ZHISHEN[(zi(dayZhi) - start + 12) % 12];
  };

  // ——— 冲煞合害刑 ———
  const chongOf = z => (z + 6) % 12;
  // 煞方:申子辰日煞南,寅午戌煞北,巳酉丑煞东,亥卯未煞西
  const SHA_DIR = ['南', '东', '北', '西', '南', '东', '北', '西', '南', '东', '北', '西'];
  const LIUHE = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
  const LIUHAI = { 0: 7, 7: 0, 1: 6, 6: 1, 2: 5, 5: 2, 3: 4, 4: 3, 8: 11, 11: 8, 9: 10, 10: 9 };
  const SANHE = [[8, 0, 4], [5, 9, 1], [2, 6, 10], [11, 3, 7]];
  const sanheMates = z => { const g = SANHE.find(a => a.includes(z)); return g.filter(x => x !== z); };
  const XING_PAIRS = [[0, 3], [2, 5], [5, 8], [8, 2], [1, 10], [10, 7], [7, 1]]; // 子卯 / 寅巳申 / 丑戌未
  const ZIXING = [4, 6, 9, 11]; // 辰午酉亥自刑
  const isXing = (a, b) => (a === b && ZIXING.includes(a)) ||
    XING_PAIRS.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));

  // ——— 五行(天干)与生克 ———
  const GAN_WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  // 流日天干对本命日干:同我/生我/我克 顺,克我 逆,我生 耗
  function wxRelation(dayGan, selfGan) {
    const d = GAN_WX[GAN.indexOf(dayGan)], s = GAN_WX[GAN.indexOf(selfGan)];
    if (d === s) return { rel: '同我', score: 1, note: `流日${d}与你日主同气,做事顺手` };
    if (SHENG[d] === s) return { rel: '生我', score: 1, note: `流日${d}生你日主${s},有滋养、有人帮衬` };
    if (SHENG[s] === d) return { rel: '我生', score: 0, note: `你日主${s}生流日${d},操心出力的日子` };
    if (KE[s] === d) return { rel: '我克', score: 1, note: `你日主${s}克流日${d},主动可为、拿得住` };
    return { rel: '克我', score: -1, note: `流日${d}克你日主${s},压力大、费力气` };
  }

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const atNoon = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

  // ——— 单日详情。birth 可选:{date: Date}(按出生日算年支生肖与日主天干)———
  function dayInfo(date, birth) {
    const gz = Najia.ganZhi(date);
    const jc = jianchuOf(gz.monthZhi, gz.dayZhi);
    const zs = zhishenOf(gz.monthZhi, gz.dayZhi);
    const dz = zi(gz.dayZhi);
    const chongZhi = chongOf(dz);
    let lunar = null;
    try { lunar = Lunar.fromDate(date); } catch (e) { /* 历表越界时只缺农历显示 */ }

    let score = jc.luck + zs.luck;
    let personal = null;
    if (birth && birth instanceof Date && !isNaN(birth)) {
      const bgz = Najia.ganZhi(birth);
      const byZhi = ZHI.indexOf(bgz.year.charAt(1)); // 年支(生肖按立春界,与排盘一致)
      const marks = [];
      let ps = 0;
      if (chongOf(dz) === byZhi) { ps -= 5; marks.push(`日支${gz.dayZhi}冲你年支${ZHI[byZhi]}——正冲你的日子,大事勿用`); }
      if (LIUHE[dz] === byZhi) { ps += 2; marks.push(`日支${gz.dayZhi}与你年支${ZHI[byZhi]}六合,人事相协`); }
      if (sanheMates(dz).includes(byZhi)) { ps += 2; marks.push(`日支${gz.dayZhi}与你年支${ZHI[byZhi]}三合,得势顺遂`); }
      if (LIUHAI[dz] === byZhi) { ps -= 1; marks.push(`日支${gz.dayZhi}害你年支${ZHI[byZhi]},小人小阻,留个心`); }
      if (isXing(dz, byZhi)) { ps -= 1; marks.push(`日支${gz.dayZhi}刑你年支${ZHI[byZhi]},易生摩擦,忍口舌`); }
      const wx = wxRelation(gz.dayGan, bgz.dayGan);
      ps += wx.score;
      personal = {
        animal: ANIMALS[byZhi], yearZhi: ZHI[byZhi], selfGan: bgz.dayGan,
        chong: chongOf(dz) === byZhi, marks, wx, score: ps,
      };
      score += ps;
    }
    let level = score >= 5 ? '上吉' : score >= 3 ? '吉' : score >= -1 ? '平' : score >= -4 ? '慎' : '忌';
    if (jc.name === '破' && (level === '上吉' || level === '吉' || level === '平')) level = '慎'; // 破日封顶
    if (personal && personal.chong) level = '冲';
    return {
      iso: iso(date), y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(),
      week: (date.getDay() + 6) % 7, // 0=周一
      gz, lunar,
      lunarText: lunar ? (lunar.lDay === 1 ? lunar.monthName : lunar.dayName) : '',
      jianchu: jc, zhishen: zs,
      chongAnimal: ANIMALS[chongZhi], chongZhi: ZHI[chongZhi], shaDir: SHA_DIR[dz],
      personal, score, level,
    };
  }

  // ——— 整月网格(month 1–12)———
  function monthGrid(year, month, birth) {
    const nDays = new Date(year, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= nDays; d++) days.push(dayInfo(atNoon(year, month, d), birth));
    return { year, month, firstWeek: days[0].week, days };
  }

  // ——— 按事挑日 ———
  const EVENTS = {
    jiaqu: { label: '嫁娶订婚', yi: ['定', '成', '开'], ji: ['破', '闭', '除'], bonus: ['金匮', '天德', '玉堂'], malus: [], note: '两口子的生肖都别被当日日支冲到' },
    kaiye: { label: '开业开市', yi: ['成', '开', '满'], ji: ['破', '闭', '收', '执'], bonus: ['金匮', '青龙'], malus: ['玄武'] },
    ruzhai: { label: '搬家入宅', yi: ['定', '成', '开'], ji: ['破', '危', '除', '闭'], bonus: ['玉堂', '天德', '青龙'], malus: [] },
    chuxing: { label: '出行远行', yi: ['建', '成', '开', '除'], ji: ['破', '危', '闭', '执'], bonus: ['青龙', '明堂'], malus: ['白虎'] },
    qianyue: { label: '签约谈判', yi: ['定', '成', '开', '执'], ji: ['破', '平', '闭'], bonus: ['明堂', '金匮'], malus: ['朱雀', '玄武'] },
    dongtu: { label: '动土装修', yi: ['平', '定', '执', '开'], ji: ['建', '破', '收', '闭'], bonus: ['青龙', '天德'], malus: ['勾陈', '天刑'] },
    qiuyi: { label: '求医就诊', yi: ['除', '破', '成', '开'], ji: ['定', '满'], bonus: ['天德', '司命'], malus: [], note: '破日反宜治病拆除,是十二建星里的老规矩' },
    shangren: { label: '上任面试', yi: ['建', '定', '成', '开'], ji: ['破', '闭', '收'], bonus: ['明堂', '青龙', '司命'], malus: ['天牢', '勾陈'] },
    kaoshi: { label: '考试文书', yi: ['建', '成', '开'], ji: ['破', '闭'], bonus: ['明堂', '玉堂'], malus: ['朱雀'] },
    jisi: { label: '祭祀祈福', yi: ['满', '平', '除', '成', '开'], ji: ['破'], bonus: ['天德', '明堂'], malus: [] },
  };

  function pickDays(eventKey, fromDate, nDays, birth, topN) {
    const ev = EVENTS[eventKey];
    if (!ev) return [];
    const out = [];
    const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 12);
    for (let i = 0; i < (nDays || 30); i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const info = dayInfo(d, birth);
      if (ev.ji.includes(info.jianchu.name)) continue;       // 建星犯忌,直接排除
      if (info.personal && info.personal.chong) continue;     // 冲本人,排除
      if (info.level === '忌') continue;
      let s = info.score;
      const why = [];
      if (ev.yi.includes(info.jianchu.name)) { s += 2; why.push(`${info.jianchu.name}日正合(${info.jianchu.gist})`); }
      if (ev.bonus.includes(info.zhishen.name)) { s += 2; why.push(`${info.zhishen.name}${info.zhishen.huang ? '黄道' : ''}相扶`); }
      if (ev.malus.includes(info.zhishen.name)) { s -= 2; why.push(`${info.zhishen.name}黑道有碍,列名但靠后`); }
      if (!ev.yi.includes(info.jianchu.name) && !why.length) continue; // 既不合建星又无神扶,不推
      if (info.zhishen.huang && !ev.bonus.includes(info.zhishen.name)) why.push(`${info.zhishen.name}黄道`);
      if (info.personal) {
        info.personal.marks.forEach(m => why.push(m.split('——')[0]));
        why.push(info.personal.wx.rel === '克我' ? '流日克你日主,稍费力' : info.personal.wx.note.split(',')[1] || info.personal.wx.rel);
      }
      out.push({ info, score: s, why });
    }
    out.sort((a, b) => b.score - a.score || a.info.iso.localeCompare(b.info.iso));
    return out.slice(0, topN || 5);
  }

  return { JIANCHU, ZHISHEN, EVENTS, ANIMALS, jianchuOf, zhishenOf, wxRelation, dayInfo, monthGrid, pickDays };
}));
