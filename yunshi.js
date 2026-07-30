// yunshi.js — 运势推断:拿流年/流月/流日的干支跟命局喜忌比生克,出大白话运势
// 判分:流X五行属喜用则加分、属忌神则减分;流X天干十神定"管哪方面的事"。
// 领域白话对照参《命理书》通行口径:财星管钱与感情、官杀管工作压力升迁、
// 印星管贵人文书房子长辈、比劫管合伙竞争朋友、食伤管才华表达投资子女。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./bazi.js'));
  } else { root.Yunshi = factory(root.Najia, root.Bazi); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Bazi) {
  const { GAN_WX, ZHI_WX, SHISHEN_CLASS, SHENG, KE } = Bazi;

  // 领域白话(按十神大类)
  const DOMAIN = {
    财星: { area: '钱财 · 感情', good: '进项、机会、感情升温,想买想赚的事顺;男命还主老婆缘、女人缘。', bad: '破财、为钱奔波、感情费心,别乱投乱借,守住钱袋。' },
    官杀: { area: '工作 · 压力', good: '升迁、被赏识、接下重担,考试考评有利;女命还主感情桃花、正缘。', bad: '压力大、被管束、易惹是非官非,注意身体别硬扛,少跟人对着干。' },
    印星: { area: '贵人 · 文书', good: '贵人扶、长辈助,文书合同、房子学习、名声之事顺,靠山稳。', bad: '想太多、依赖心重、拖着不动手,文书房产易反复,别钻牛角尖。' },
    比劫: { area: '人脉 · 合伙', good: '朋友帮衬、合伙有力、竞争占上风,团队里吃得开。', bad: '破财、被借被分、竞争激烈、易冲动争执,合伙谈钱要写清。' },
    食伤: { area: '才华 · 投资', good: '灵感足、表达强、才华被看见,投资副业、子女喜事有望,适合出手做新事。', bad: '话多惹祸、想法多而乱、投机易亏,管住嘴和冲动,别急着跳。' },
  };
  const LEVELS = [
    { min: 2, lv: '大吉', tone: '很顺' },
    { min: 1, lv: '吉', tone: '偏顺' },
    { min: 0, lv: '平顺', tone: '平' },
    { min: -1, lv: '小凶', tone: '偏累' },
    { min: -99, lv: '凶', tone: '难熬' },
  ];
  const levelOf = s => LEVELS.find(l => s >= l.min);

  // 对某个流干支相对命局打分 + 归类
  function scoreGZ(chart, gan, zhi) {
    const xi = new Set(chart.yong.xiWx), ji = new Set(chart.yong.jiWx);
    const gw = GAN_WX[gan], zw = ZHI_WX[zhi];
    let s = 0;
    if (xi.has(gw)) s += 1; else if (ji.has(gw)) s -= 1;
    if (xi.has(zw)) s += 1.2; else if (ji.has(zw)) s -= 1.2; // 地支主吉凶,权重略高
    const shen = Bazi.shiShen(chart.dayGan, gan);
    const cls = SHISHEN_CLASS[shen];
    return { score: +s.toFixed(1), gw, zw, shen, cls };
  }

  // 通用:把一个流干支按专业全规程断成卡片——每一步单列一行(lines),有账可查
  // 规程:①干支分评喜忌 ②调候得药 ③十神两层(天干主面上、支藏主气主底子)
  //       ④与命局四柱冲合(动宫) ⑤天克地冲/伏吟 ⑥岁运冲合(年运) → 计分定级
  const ZHIS = '子丑寅卯辰巳午未申酉戌亥';
  const LIUHE_Y = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  function judgeCard(chart, gan, zhi, label, span, opts) {
    const xi = new Set(chart.yong.xiWx), ji = new Set(chart.yong.jiWx);
    const gw = GAN_WX[gan], zw = ZHI_WX[zhi];
    const one = label.slice(0, 1) === '年' ? '年' : label.slice(0, 1) === '月' ? '月' : '日';
    const lines = [];
    let s = 0;
    const tag = w => xi.has(w) ? '喜' : (ji.has(w) ? '忌' : '闲');
    const gJ = tag(gw), zJ = tag(zw);
    if (gJ === '喜') s += 1; else if (gJ === '忌') s -= 1;
    if (zJ === '喜') s += 1.2; else if (zJ === '忌') s -= 1.2;
    if (gJ === '喜' && zJ === '忌') lines.push(`干支拆解:天干${gan}(${gw})帮你、地支${zhi}(${zw})拆台——面上顺、底下漏,开头的甜头别全当真`);
    else if (gJ === '忌' && zJ === '喜') lines.push(`干支拆解:天干${gan}(${gw})压你、地支${zhi}(${zw})托底——面上紧、底下稳,熬过开头有后劲`);
    else lines.push(`干支拆解:天干${gan}(${gw},${gJ})、地支${zhi}(${zw},${zJ}),劲往一处使`);
    if (chart.tiaohou && (chart.tiaohou.need === gw || chart.tiaohou.need === zw)) {
      s += 0.6;
      lines.push(`调候得药:此${one}带${chart.tiaohou.need},恰是你命里调候所需,寒燥得解、诸事松快三分`);
    }
    const shen = Bazi.shiShen(chart.dayGan, gan);
    const zhu = Bazi.CANGGAN[zhi][0];
    const zShen = Bazi.shiShen(chart.dayGan, zhu);
    const aOf = sh => (DOMAIN[SHISHEN_CLASS[sh]] || { area: '综合' }).area;
    lines.push(`十神两层:天干${shen}(${aOf(shen)})主面上之事,支藏${zhu}为${zShen}(${aOf(zShen)})主底下之事`);
    const GONG = { year: '根基宫(长辈老家)', month: '门户宫(事业居所)', day: '婚姻宫(自身伴侣)', hour: '子女宫(计划晚辈)' };
    const ZN = { year: '年', month: '月', day: '日', hour: '时' };
    let keDay = KE[gw] === chart.dayWx;
    let tkdc = false;
    for (const k of ['year', 'month', 'day', 'hour']) {
      const pz = chart.pillars[k].zhi;
      if ((ZHIS.indexOf(zhi) + 6) % 12 === ZHIS.indexOf(pz)) {
        s -= (k === 'month' || k === 'day') ? 1 : 0.8;
        lines.push(`动宫:流${one}支${zhi}冲你${ZN[k]}柱之${pz}——${GONG[k]}这段多动荡,该宫之事大动作避其锋`);
        if (k === 'day' && keDay) tkdc = true;
      } else if (k === 'day' && LIUHE_Y[zhi] === pz) {
        s += 0.5;
        lines.push(`合日支:流${one}与你日支相合——人事贴近,谈合作谈感情自带黏性`);
      }
    }
    if (tkdc) { s -= 0.7; lines.push('天克地冲:流干克你日主、流支又冲你日支——大动之象,此段忌大决定、忌远行动土,凡事留后手'); }
    if (gan + zhi === chart.pillars.day.gz) lines.push('伏吟:与你日柱干支相同——旧事重提、心绪反复之期,宜了结旧账,不宜另起炉灶');
    if (opts && opts.dayunGz) {
      const dz = opts.dayunGz[1];
      if ((ZHIS.indexOf(zhi) + 6) % 12 === ZHIS.indexOf(dz)) {
        s -= 0.5;
        lines.push(`岁运相冲:流年支${zhi}冲大运支${dz}——运程换挡之年,动静都大,稳字当头`);
      } else if (LIUHE_Y[zhi] === dz) {
        lines.push('岁运相合:流年与大运相合,大势顺水推舟,借力使力');
      }
    }
    const score = +s.toFixed(1);
    const L = levelOf(score);
    const cls = SHISHEN_CLASS[shen];
    const dom = DOMAIN[cls] || { area: '综合', good: '', bad: '' };
    const domainText = score >= 0 ? dom.good : dom.bad;
    return {
      label, span, gz: gan + zhi, score, level: L.lv, tone: L.tone,
      shen, cls, area: dom.area, lines,
      text: `${span}的天地是「${gan}${zhi}」(${gw}${zw})。整体${L.tone}。${domainText}`,
      domainText, area2: dom.area,
    };
  }

  // 流年:target 为 Date(通常为当年任意一天,取其年柱)
  function nianYun(chart, targetDate) {
    const cal = Najia.ganZhi(targetDate);
    const [g, z] = [cal.year[0], cal.year[1]];
    const age = targetDate.getFullYear() - chart.birth.getFullYear();
    const du = chart.dayun.list.find(d => age >= d.fromAge && age < d.fromAge + 10);
    const c = judgeCard(chart, g, z, '年运', `${cal.year}年`, { dayunGz: du ? du.gz : null });
    c.dayun = du ? `${du.gz}大运(${du.fromAge}岁起)` : null;
    return c;
  }
  // 流月:节气月建
  function yueYun(chart, targetDate) {
    const cal = Najia.ganZhi(targetDate);
    return judgeCard(chart, cal.month[0], cal.month[1], '月运', `${cal.month}月`);
  }
  // 流日
  function riYun(chart, targetDate) {
    const cal = Najia.ganZhi(targetDate);
    const two = n => String(n).padStart(2, '0');
    const span = `${targetDate.getFullYear()}-${two(targetDate.getMonth() + 1)}-${two(targetDate.getDate())}(${cal.day}日)`;
    return judgeCard(chart, cal.day[0], cal.day[1], '日运', span);
  }

  function all(chart, targetDate) {
    return { year: nianYun(chart, targetDate), month: yueYun(chart, targetDate), day: riYun(chart, targetDate) };
  }

  return { all, nianYun, yueYun, riYun, scoreGZ, DOMAIN };
}));
