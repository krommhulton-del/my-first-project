// yunshi.js — 运势推断:拿流年/流月/流日的干支跟命局喜忌比生克,出大白话运势
// 判分:流X五行属喜用则加分、属忌神则减分;流X天干十神定"管哪方面的事"。
// 领域白话对照参行内通行口径(出处待核):财星管钱与感情、官杀管工作压力升迁、
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
  // ——— 事宜清单:十神细分 × 喜忌 → 能照着做的具体事 ———
  // 「今年财运不错」是空话;「该谈的价往这半年靠、别在这年做担保」才是话。
  // 每颗十神为喜、为忌各给一组宜忌,再叠神煞与动宫带来的具体事项。
  const ACT = {
    正官: { xi: { yi: ['争名分:该报的评审、该申的职级、该露脸的场合别躲', '办证照、走审批、递正式材料', '见上级、汇报进展,主动要资源'], ji: ['越权抢功、绕过直属去表功', '钻流程空子、拿口头承诺当数'] },
      ji: { yi: ['按流程留书面记录,口头承诺一律补一封确认', '体检别拖,压力最先伤睡眠和肠胃'], ji: ['顶撞上位者', '赶工硬扛', '在这段接超出权限的活'] } },
    七杀: { xi: { yi: ['接硬仗:竞标、攻坚、带队,越难的越是你的机会', '考试、比武、评比这类你死我活的场合', '定期限、下军令状,压力反而催你出成绩'], ji: ['拖延观望——这段的机会窗口关得快'] },
      ji: { yi: ['减负:能推的推,保住觉和身体', '把风险点写下来,提前给自己留退路'], ji: ['硬顶硬扛、明知超载还接', '开快车、动利器', '在这段跟人正面冲突'] } },
    正印: { xi: { yi: ['考试报名、进修、拿证', '签合同、办房产过户、办贷款', '找长辈或老领导说话,靠山这条线现在通'], ji: ['赌运气走捷径,该走的手续别省'] },
      ji: { yi: ['先动手再想,方案够用就落地', '把积压的文书、证件、旧账清一遍'], ji: ['把该拍板的事一拖再拖', '把关键环节全押在别人身上', '听一句小道消息就改主意'] } },
    偏印: { xi: { yi: ['钻研冷门本事、做研究、闭关做作品', '一个人能推完的事优先办'], ji: ['硬凑热闹的场合,人多反而误事'] },
      ji: { yi: ['作息定死,别熬夜——这段最容易失眠内耗', '想不通就搁置,别在这段做职业方向的大改'], ji: ['在这段换饭碗、改行', '听偏方、走没人验证过的野路子', '临门一脚临时改主意'] } },
    正财: { xi: { yi: ['谈价、签单、收账催款,该落袋的往这段靠', '置办耐用的大件、办储蓄理财', '跟伴侣把下一步定下来(见家长、定日子)'], ji: ['临时起意的大额支出,先压一周再看'] },
      ji: { yi: ['记账对账,把每一笔应收应付理清', '砍掉可有可无的固定支出'], ji: ['借钱给人、替人做担保', '投机押注,这段的运气不在这条线上', '为面子撑场面花钱'] } },
    偏财: { xi: { yi: ['跑业务、谈外快、做副业,机会在人堆里', '走动应酬、扩人脉,饭局上出单', '短线机会可以试,见好就收'], ji: ['押上身家的重注'] },
      ji: { yi: ['收缩摊子、清库存、砍掉不赚钱的支线'], ji: ['合伙投资,尤其是熟人局', '赌与投机', '暧昧牵扯——这段最容易因情失财'] } },
    食神: { xi: { yi: ['做作品、发内容、把手艺变成东西交出去', '谈合作、见客户,你的表达这段有说服力', '口福与养生兼顾,吃好睡好就出活'], ji: ['有难处硬扛着不说'] },
      ji: { yi: ['少说多做,想法先落纸再开口'], ji: ['乱吃东西、连续熬夜', '追新概念、跟风投机', '同时开三件新事,一件也做不透'] } },
    伤官: { xi: { yi: ['展示才华:面试、路演、演讲、投稿', '谈条件、谈跳槽,你这段议价力强', '把想法做成看得见的东西'], ji: ['快意一时得罪该敬的人'] },
      ji: { yi: ['少表态,凡事写清楚', '有火先压两天再回'], ji: ['当面顶撞上级或甲方', '在群里、评论区争高低', '冲动辞职、退群退圈'] } },
    比肩: { xi: { yi: ['找同行搭伙、组队作战', '正面竞争别怯场,这段你顶得住', '找朋友借力、拉资源'], ji: ['独吞好处,这段最忌吃独食'] },
      ji: { yi: ['明算账:合作先写清分成与退出'], ji: ['借钱出去、替人担保', '合伙投钱', '平摊费用的糊涂账'] } },
    劫财: { xi: { yi: ['借力打力:拉人入局、联合投标', '人多的场子里办事'], ji: ['露财显摆,财不外露这段尤其要紧'] },
      ji: { yi: ['藏财、低调,别晒别显摆', '大额决定拖过这段'], ji: ['把钱借出去', '跟人合伙分账', '赌与冲动消费'] } },
  };
  const MARK_ACT = {
    文昌: { yi: ['考试、递材料、签字、投稿挑这个当口'] },
    天乙: { yi: ['求人办事、见要紧人物,这段最容易碰上肯帮你的'] },
    桃花: { yi: ['单身的多走动多见人', '有主的把边界划清,防桃色是非'] },
    驿马: { yi: ['出差、调动、搬家、换赛道,顺势挪比硬守省力'], ji: ['死守原地不动,越守越憋'] },
    羊刃: { ji: ['动刀动利器、开快车', '跟人当面硬碰'] },
    红鸾: { yi: ['提亲、订婚、办喜事、见家长'] },
    天喜: { yi: ['办喜事、添置、宣布好消息'] },
    华盖: { yi: ['一个人闷头做的事最出活:读书、研艺、写方案'] },
    空亡: { yi: ['守成、清旧账、学习、养精神'], ji: ['开业、置产、定亲这类立根基的事'] },
  };

  const LEVELS = [
    { min: 2, lv: '大吉', tone: '很顺' },
    { min: 1, lv: '吉', tone: '偏顺' },
    { min: 0, lv: '平顺', tone: '平' },
    { min: -1, lv: '小凶', tone: '偏累' },
    { min: -99, lv: '凶', tone: '难熬' },
  ];
  const levelOf = s => LEVELS.find(l => s >= l.min);
  // 同一句话落在一天、一个月、一年上,分量完全不同,得各说各的
  const SCALE = {
    日: { good: '就今天这一天而言——该开口的开口、该出手的出手,过了今晚就换一茬。',
          bad: '就今天这一天而言——别较劲,拖到明后天再办也不迟。' },
    月: { good: '这一个月是这么个基调:该推进的事挑这段推,一个月的窗口够办成一件事。',
          bad: '这一个月是这么个基调:别在这段开新局,把手上的事收干净就算赢。' },
    年: { good: '整整一年都是这个底子:定方向、下大注、做长线安排,都往这一年靠。',
          bad: '整整一年都是这个底子:今年守成,大动作往后挪一年,别硬闯。' },
  };

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
    // 这一段原先写成「干支拆解:天干乙(木)帮你、地支未(土)拆台」——用户反馈看不懂。
    // 铁律八:术语不上稿。干支、天干、地支、十神这些只在推演时用,写给人看的一律翻成「明面/底下」。
    const P2 = { 日: '今天', 月: '这个月', 年: '今年' }[one] || '这段';
    if (gJ === '喜' && zJ === '忌') lines.push(`${P2}明面上那股力是帮你的,底下那股是拆台的——开头顺、后头漏,开场的甜头别全当真`);
    else if (gJ === '忌' && zJ === '喜') lines.push(`${P2}明面上那股力压着你,底下那股反倒托着——开头紧、后头稳,熬过开场有后劲`);
    else if (gJ === '喜' && zJ === '喜') lines.push(`${P2}明面和底下两股力都向着你,劲往一处使——该办的事趁这阵子办`);
    else if (gJ === '忌' && zJ === '忌') lines.push(`${P2}明面和底下两股力都压着你,劲往一处使——这阵子别硬顶,缩着过`);
    else lines.push(`${P2}这两股力不偏不倚,既不帮你也不拦你——事在人为,推一把才动`);
    if (chart.tiaohou && (chart.tiaohou.need === gw || chart.tiaohou.need === zw)) {
      s += 0.6;
      lines.push(`${P2}正好补上你命里缺的那一味——该暖的暖了、该润的润了,诸事松快三分`);
    }
    const shen = Bazi.shiShen(chart.dayGan, gan);
    const zhu = Bazi.CANGGAN[zhi][0];
    const zShen = Bazi.shiShen(chart.dayGan, zhu);
    const aOf = sh => (DOMAIN[SHISHEN_CLASS[sh]] || { area: '综合' }).area;
    lines.push(aOf(shen) === aOf(zShen)
      ? `${P2}明面和底下管的是同一摊事:${aOf(shen)}——这一摊会格外突出`
      : `${P2}明面上主要是${aOf(shen)}这一摊,底下暗着走的是${aOf(zShen)}那一摊`);
    const GONG = { year: '老家与长辈那一块', month: '事业与住处那一块', day: '你自己与伴侣那一块', hour: '孩子与长远打算那一块' };
    const ZN = { year: '年', month: '月', day: '日', hour: '时' };
    let keDay = KE[gw] === chart.dayWx;
    let tkdc = false;
    for (const k of ['year', 'month', 'day', 'hour']) {
      const pz = chart.pillars[k].zhi;
      if ((ZHIS.indexOf(zhi) + 6) % 12 === ZHIS.indexOf(pz)) {
        s -= (k === 'month' || k === 'day') ? 1 : 0.8;
        lines.push(`${P2}正冲着${GONG[k]}——这块多动荡,要办大事避开这阵风头`);
        if (k === 'day' && keDay) tkdc = true;
      } else if (k === 'day' && LIUHE_Y[zhi] === pz) {
        s += 0.5;
        lines.push(`${P2}与你自己那一块贴得紧——谈合作、谈感情自带黏性,开口容易被接住`);
      }
    }
    if (tkdc) { s -= 0.7; lines.push(`${P2}上下两头一齐冲你自己——大动之象,这阵子别下大决定、别远行动土,凡事留一手`); }
    if (gan + zhi === chart.pillars.day.gz) lines.push(`${P2}的字与你自己那一柱一模一样——旧事重提、心绪反复,适合了结旧账,不适合另起炉灶`);
    // —— 具体事宜:十神(天干为主、支藏为辅)× 喜忌,叠神煞与动宫 ——
    const YI = [], JI = [];
    const push = (arr, xs) => { for (const x of xs || []) if (!arr.includes(x)) arr.push(x); };
    const pick = (sh, t) => { const e = ACT[sh]; if (!e) return; const side = t === '忌' ? e.ji : e.xi; push(YI, side.yi); push(JI, side.ji); };
    // 次序要紧:神煞与动宫指的是「这个当口的具体事」,比十神的通则更贴,故排在前面,
    // 否则十神那几条先把名额占满,文昌该递材料、羊刃该避利器这种真正有用的反而被挤掉。
    const marks = Bazi.flowMarks(chart, gan, zhi);
    for (const m of marks) {
      for (const k of Object.keys(MARK_ACT)) if (m.startsWith(k) || m.indexOf(k) === 0) { push(YI, MARK_ACT[k].yi); push(JI, MARK_ACT[k].ji); }
      if (m.startsWith('空亡')) { push(YI, MARK_ACT.空亡.yi); push(JI, MARK_ACT.空亡.ji); }
      if (m.startsWith('冲日支')) { push(YI, ['提前体检、把该说的话说开']); push(JI, ['在这段做感情或身体上的大决定']); }
      if (m.startsWith('冲提纲')) { push(YI, ['借势换环境:调岗、换城市、搬工位都比平时容易']); push(JI, ['在风头上签长约、定长期方案']); }
      if (m.startsWith('合动日支')) { push(YI, ['谈合作、谈感情、找人说和,这段贴得近']); }
    }
    pick(shen, gJ);                                   // 天干十神主面上之事
    if (zShen !== shen) pick(zShen, zJ);              // 支藏主气主底下之事
    if (tkdc) { push(JI, ['远行、动土、下大决定——天克地冲之期,凡事留后手']); }
    const P4 = { 日: '今天', 月: '这个月', 年: '今年' }[one] || '这段';
    const yiList = YI.slice(0, 6), jiList = JI.slice(0, 6);
    if (opts && opts.dayunGz) {
      const dz = opts.dayunGz[1];
      if ((ZHIS.indexOf(zhi) + 6) % 12 === ZHIS.indexOf(dz)) {
        s -= 0.5;
        lines.push('这一年与你正走的那步大运顶上了——运程换挡,动静都大,稳字当头');
      } else if (LIUHE_Y[zhi] === dz) {
        lines.push('这一年与你正走的那步大运合得上——大势顺水推舟,借力使力');
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
      // 原先写「乙未月的天地是「乙未」(木土)」——同义反复,等于没说,用户反馈看不懂。
      // 改成:直接说这一段整体如何、主哪一摊事。干支留在卡片角落作凭据。
      // 另:日/月/年三种尺度得说不同的话——今年流日与流年撞同一组字时,
      // 原先两张卡一字不差,读者会觉得程序在敷衍。所以每种尺度各配一句「这话该怎么落到这个跨度上」。
      text: `${{ 日: '今天', 月: '这个月', 年: '今年' }[one] || '这段'}整体${L.tone}。${domainText}` +
        (SCALE[one] ? SCALE[one][score >= 0 ? 'good' : 'bad'] : ''),
      domainText, area2: dom.area,
      yi: yiList, ji: jiList, when: P4,   // 具体事宜:照着做的事,与照着躲的事
    };
  }

  // 流年:target 为 Date(通常为当年任意一天,取其年柱)
  // 命理的「年」以立春分界、「月」以节气分界,都不是公历的年月。
  // 用户反馈看不懂,这是其中最要命的一条:光写「乙未月」,人会当成公历七月,日子整个算错。
  // 所以这两张卡一律把**真实的起止日期**写出来。
  const two = n => String(n).padStart(2, '0');
  const md = d => `${d.getMonth() + 1}月${d.getDate()}日`;
  // 从某日往前/往后找到当前干支年(或月)的边界:逐日比对干支是否改变
  function spanOf(targetDate, kind) {
    const key = d => kind === 'year' ? Najia.ganZhi(d).year : Najia.ganZhi(d).month;
    const cur = key(targetDate);
    const step = kind === 'year' ? 20 : 3;      // 年用粗步长再细找,月用小步长
    const back = new Date(targetDate), fwd = new Date(targetDate);
    let guard = 0;
    while (guard++ < 400) { const p = new Date(back); p.setDate(p.getDate() - step); if (key(p) !== cur) break; back.setTime(p.getTime()); }
    while (guard++ < 800) { const p = new Date(back); p.setDate(p.getDate() - 1); if (key(p) !== cur) break; back.setTime(p.getTime()); }
    guard = 0;
    while (guard++ < 400) { const p = new Date(fwd); p.setDate(p.getDate() + step); if (key(p) !== cur) break; fwd.setTime(p.getTime()); }
    while (guard++ < 800) { const p = new Date(fwd); p.setDate(p.getDate() + 1); if (key(p) !== cur) break; fwd.setTime(p.getTime()); }
    const cross = back.getFullYear() !== fwd.getFullYear();
    return { from: back, to: fwd, text: `${md(back)}—${cross ? fwd.getFullYear() + '年' : ''}${md(fwd)}` };
  }

  function nianYun(chart, targetDate) {
    const cal = Najia.ganZhi(targetDate);
    const [g, z] = [cal.year[0], cal.year[1]];
    const age = targetDate.getFullYear() - chart.birth.getFullYear();
    const du = chart.dayun.list.find(d => age >= d.fromAge && age < d.fromAge + 10);
    const sp = spanOf(targetDate, 'year');
    const c = judgeCard(chart, g, z, '年运',
      `${sp.from.getFullYear()}年${sp.text}`, { dayunGz: du ? du.gz : null, gz: cal.year });
    c.realSpan = `这一「年」按老规矩从立春算到立春:${sp.from.getFullYear()}年${sp.text},不是公历的一整年——年头年尾那半个月要留神`;
    c.dayun = du ? `${du.gz}大运(${du.fromAge}岁起)` : null;
    return c;
  }
  // 流月:节气月建
  function yueYun(chart, targetDate) {
    const cal = Najia.ganZhi(targetDate);
    const sp = spanOf(targetDate, 'month');
    const c = judgeCard(chart, cal.month[0], cal.month[1], '月运', sp.text, { gz: cal.month });
    c.realSpan = `这一「月」按节气分界:${sp.text},不是公历那个月——差半个月,别按日历算`;
    return c;
  }
  // 流日
  function riYun(chart, targetDate) {
    const cal = Najia.ganZhi(targetDate);
    const span = `${targetDate.getFullYear()}-${two(targetDate.getMonth() + 1)}-${two(targetDate.getDate())}`;
    return judgeCard(chart, cal.day[0], cal.day[1], '日运', span, { gz: cal.day });
  }

  function all(chart, targetDate) {
    return { year: nianYun(chart, targetDate), month: yueYun(chart, targetDate), day: riYun(chart, targetDate) };
  }

  return { all, nianYun, yueYun, riYun, scoreGZ, DOMAIN };
}));
