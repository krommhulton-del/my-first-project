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

  // 通用:把一个流干支断成白话卡片
  function judgeCard(chart, gan, zhi, label, span) {
    const r = scoreGZ(chart, gan, zhi);
    const L = levelOf(r.score);
    const dom = DOMAIN[r.cls] || { area: '综合', good: '', bad: '' };
    const good = r.score >= 0;
    const domainText = good ? dom.good : dom.bad;
    return {
      label, span, gz: gan + zhi, score: r.score, level: L.lv, tone: L.tone,
      shen: r.shen, cls: r.cls, area: dom.area,
      // 大白话总断
      text: `${span}的天地是「${gan}${zhi}」(${r.gw}${r.zw})。${xiJiLine(chart, r)}${sum(L, domainText)}`,
      domainText, area2: dom.area,
    };
  }
  function xiJiLine(chart, r) {
    const xi = new Set(chart.yong.xiWx);
    const parts = [];
    if (xi.has(r.gw) || xi.has(r.zw)) parts.push('带的是给你添力的五行');
    else parts.push('带的是消耗你的五行');
    return parts.join('') + ',';
  }
  function sum(L, domainText) {
    return `整体${L.tone}。${domainText}`;
  }

  // 流年:target 为 Date(通常为当年任意一天,取其年柱)
  function nianYun(chart, targetDate) {
    const cal = Najia.ganZhi(targetDate);
    const [g, z] = [cal.year[0], cal.year[1]];
    const c = judgeCard(chart, g, z, '年运', `${cal.year}年`);
    // 流年与大运叠加提示(取当前所处大运)
    const age = targetDate.getFullYear() - chart.birth.getFullYear();
    const du = chart.dayun.list.find(d => age >= d.fromAge && age < d.fromAge + 10);
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
