// chuduan.js — 程序初断:一卦一问,先由程序把结论算死
//
// 缘起(CLAUDE.md 第五节与待办第 6 条):本项目的立身之本是「程序算死,AI 只解释」。
// 可自测发现姻缘/心愿/转运/未来镜/大问这五个卦阵板块,摆完卦只有一排「起卦」按钮,
// 程序一个结论都不给,断语全靠 AI——没有 API Key 的用户只看得到卦象。这违反了自己定的哲学。
// 这个模块把「成不成、几成、谁说了算、什么时候见分晓」算成一份可复现的结论,
// 让无 Key 也有断语,有 Key 时 AI 只负责讲透。
//
// **一个口径一处算**:成算的算法只此一份。别处要用就调它,不许各自再实现一套。
//
// 口径来源:用神取法、爻的旺衰、月破、旬空、入墓、伏神、进退神——全部走 najia.js,
// 本模块只做「把这些合成一个成算」这一层,不自己另算任何断卦元素。
// 合成的权重是本项目定的(古籍只说孰吉孰凶,没有给分数表),故对外必须写明「分数是本项目排的」。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./najia.js'), require('./yingqi.js')); }
  else { root.Chuduan = factory(root.Najia, root.Yingqi); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Yingqi) {

  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  // 成算分档:分数 → 几成把握 + 一句话。分档与措辞都是本项目定的。
  //
  // **门槛是量出来的,不是拍的。** 初版按 0 分居中来排,实测发现两件事:
  //   ① 随机两万卦的分数中位数是 **-1.3** 而不是 0(najia 的旺相休囚死本就负多正少,
  //      再加上空/破/墓/伏神只扣分没有对称的加分),于是七档里有五档落在负区,
  //      程序对随机一卦会有 53% 说「不成」——这比卦面本身悲观,犯铁律七。
  //   ② 最高那档(原门槛 6 分)四百卦一次都没触发过,是条**死条**(CLAUDE.md 十二节点名要查的)。
  //   ③ 校准本身也栽过一次:头一版只在「今天」抽样,可日月干支一换分数就整体挪位,
  //      单日量出的分位数拿到别的日子就不成立。现在跨一年(每三天取一天)抽两万四千卦。
  // 现在的门槛取自跨年抽样的分位数(8/22/40/60/78/92),七档各占一份,
  // 既不偏乐观也不偏悲观,最高最低两档都真触发得到。改动权重时必须重跑 tools/chuduan-calib.mjs 并改这里。
  const BANDS = [
    { min: 3.0, pct: '八九成', cheng: '成', say: '这事成' },              // 顶 8%
    { min: 1.2, pct: '七成上下', cheng: '成', say: '能成,但得你自己推一把' }, // 78–92%
    { min: -0.1, pct: '五六成', cheng: '悬', say: '五五之间,偏能成一点' },   // 60–78%
    { min: -1.4, pct: '五成上下', cheng: '悬', say: '悬着,现在下注太早' },   // 40–60%
    { min: -2.7, pct: '三四成', cheng: '悬', say: '偏不成,除非条件变了' },   // 22–40%
    { min: -4.3, pct: '两成上下', cheng: '不成', say: '这一路走不通' },      // 8–22%
    { min: -99, pct: '一成不到', cheng: '不成', say: '不成,别耗了' },        // 底 8%
  ];

  function bandOf(score) {
    for (const b of BANDS) if (score >= b.min) return b;
    return BANDS[BANDS.length - 1];
  }

  // 用神与世爻的关系:用神生世/合世为向着你,克世为拦着你
  function relToShi(yongWx, shiWx) {
    if (!yongWx || !shiWx) return { s: 0, txt: '' };
    if (SHENG[yongWx] === shiWx) return { s: 1.5, txt: '你要的那样东西正朝你来——它生你,是送上门的势头' };
    if (yongWx === shiWx) return { s: 1, txt: '你要的那样东西跟你是一路的,合得来' };
    if (KE[yongWx] === shiWx) return { s: -1.5, txt: '你要的那样东西正压着你——它克你,得让一步才拿得到' };
    if (KE[shiWx] === yongWx) return { s: .5, txt: '你压得住它——拿得到,但要费点手脚' };
    if (SHENG[shiWx] === yongWx) return { s: -.5, txt: '你在往它身上贴——出得多、回得少' };
    return { s: 0, txt: '' };
  }

  // 六亲名也是术语。成稿里说的是「那样东西」到底指什么,而不是它在术数里叫什么。
  const WHAT_PLAIN = {
    官鬼: '你惦记的那个位置(或那桩管着你的事)',
    妻财: '你惦记的那笔钱(或那样要拿到手的东西)',
    父母: '那份文书、房子、或长辈这一头',
    子孙: '孩子后辈这一头(它也管消灾解难)',
    兄弟: '平辈、同行、合伙人这一头',
  };
  // 旺相休囚死是术语,铁律八不许上稿。这里一次性译成人话,别处不许再自己译一遍。
  const WANG_PLAIN = {
    旺: '正当时,劲头最足', 相: '得着势,推得动', 休: '过了劲,使不上力',
    囚: '被困着,动弹不得', 死: '没气力,几乎推不动',
  };
  const plainWang = w => WANG_PLAIN[w] || '不好不坏';

  /**
   * @param cast  GuaCore 起卦结果 { benId, bianId, moving, lines }
   * @param z     Najia.zhuangGua 的结果
   * @param question 问的那句话(用来取用神)
   * @param from  起卦时刻(取应期用),默认此刻
   * @param gender 问卦人性别('男'/'女');问婚恋时要用它定用神,不填则退回世应法
   */
  function judge(cast, z, question, from, gender) {
    if (!cast || !z) return null;
    const now = from || new Date();
    const ys = Najia.yongShenOf(question || '', gender);
    const shiLine = z.lines[(z.shi || 1) - 1];
    const yingLine = z.lines[(z.ying || 4) - 1];
    const why = [];    // 给客人看的:一句术语都不许有
    const tech = [];   // 给推演与 AI 材料看的:术语在这里,不上稿
    let score = 0;

    // ——— 一、要看的那样东西在不在、旺不旺 ———
    // 所问不属六亲之一(或问婚恋而没填男女)时,najia 已经把口径写死了:
    // 「以世爻为自身、应爻为对方论」。这是古法本来的退法,不是没辙——
    // 初版在这里一律扣 2.5 分说「没抓手」,等于把一大批常见问法(复合、这事行不行)
    // 系统性判低,自己的测试当场抓住。
    const byShiYing = !ys.liuQin;
    const loc = byShiYing ? null : Najia.locateYong(z, ys.liuQin);
    let yongLine = byShiYing ? yingLine : (loc && loc.line);
    let fu = loc && loc.fu, yongWx = null;
    // 铁律八:成稿里一个术语都不许出现。六亲名(官鬼妻财父母子孙兄弟)只留在 yongName 字段里
    // 供推演与材料用,**不许拼进 why**。najia 的 power.notes 也是写给推演看的(「月破(被月建未冲)」),
    // 同理不进 why,只进 tech。自己的测试抓到过一次:那句话把「妻财」和「月破」一起端上了台面。
    const what = byShiYing ? '你问的那一头(对方,或这件事本身)' : WHAT_PLAIN[ys.liuQin] || '你要的那样东西';

    if (yongLine) {
      yongWx = yongLine.wx;
      const p = yongLine.power || {};
      score += (p.score || 0) * 0.9;
      tech.push(`用神${ys.liuQin || '(世应法·应爻)'}:${p.wang || ''}${(p.notes || []).length ? ';' + p.notes.join(';') : ''}`);
      why.push(`${what}在这一卦里现着,眼下${plainWang(p.wang)}`);
      if (p.yuePo) { score -= 1.5; why.push('它这个月正被冲着,本月内使不上劲,得过了这个月才算数'); }
      if (yongLine.kong) { score -= 1.5; why.push('它眼下是空的——现在问等于问了个空,得等这段空过去才见真章'); }
      if (p.ruMu) { score -= 1; why.push(`它像锁在柜子里,得有外力来撬开才动得了`); }
    } else if (fu) {
      yongWx = fu.wx;
      score -= 1.5;
      why.push(`${what}没在明面上,藏在底下——这事眼下摆不到台面,得有人先把它掀开才动得了`);
    } else {
      score -= 2.5;
      why.push(`${what}在这一卦里既没露面、也找不着影——这一问眼下没有抓手,多半是时候未到`);
    }

    // ——— 二、它对你是什么态度 ———
    const rel = relToShi(yongWx, shiLine && shiLine.wx);
    if (rel.txt) { score += rel.s; why.push(rel.txt); }

    // ——— 三、你自己站不站得住 ———
    if (shiLine) {
      const sp = shiLine.power || {};
      score += (sp.score || 0) * 0.5;
      if (shiLine.kong) { score -= 1; why.push('你自己这一头是空的——你心里其实还没拿定主意,或者这局里根本没你的位置'); }
      if (sp.yuePo) { score -= 1; why.push('你自己这一头本月被冲着,这个月你说了不算'); }
      why.push(`你自己眼下${plainWang(sp.wang)}`);
    }

    // ——— 四、动爻:有没有人搅局或帮衬 ———
    const movers = z.lines.filter(l => l.moving);
    if (!movers.length) {
      why.push('满卦不动——局面是静的,没人推它,也没人拦它;这种卦多半是「照旧」');
    } else {
      let help = 0, block = 0;
      for (const m of movers) {
        if (!yongWx) break;
        if (SHENG[m.wx] === yongWx) { score += .8; help++; tech.push(`动爻${m.liuQin}${m.zhi}${m.wx}生用神`); }
        else if (KE[m.wx] === yongWx) { score -= .8; block++; tech.push(`动爻${m.liuQin}${m.zhi}${m.wx}克用神`); }
      }
      // 六亲名不上稿:说的是「有几股力在帮、几股在拦」,不是它们在术数里叫什么
      if (help && block) why.push(`局面在动:有 ${help} 股力在帮衬,也有 ${block} 股在拦——两边拉扯,谁快谁占先`);
      else if (help) why.push(`局面在动,而且有 ${help} 股力正推着它往成里走`);
      else if (block) why.push(`局面在动,可动的那几股力是来拦的——有 ${block} 处在往回拽`);
      else why.push('局面在动,但动的那几处跟你问的这件事不搭界——热闹是别人的');
    }

    const band = bandOf(score);
    const yq = Yingqi ? Yingqi.yingqiOf(cast, now) : null;
    const dir = Yingqi ? Yingqi.direction(cast) : null;

    return {
      score: +score.toFixed(1),
      cheng: band.cheng, pct: band.pct, say: band.say,
      yongName: ys.liuQin, yongNote: ys.note, byShiYing, tech,
      where: byShiYing ? '所问不属六亲之一,按世应法论' : (loc ? loc.where : ''),
      why,
      yingqi: yq, dir,
      // 诚实交代:分数怎么来的、哪一段是本项目自己排的。
      // 这句是**给客人看的**,所以同样不许带术语——初版写成「用神旺衰、用神与世爻的生克」,
      // e2e 当场抓到「用神」二字上了台面。
      src: '这个把握度是本项目定的算法:看你要的那样东西旺不旺、是空是实、朝你来还是压着你、' +
        '有几股力在帮在拦,各占一份权重合出来。古籍只说吉凶,从没给过分数表——' +
        '所以这个数字保证同样的卦每次一样,但不敢说「古书上就是这么算的」。',
    };
  }

  return { judge, bandOf, BANDS, relToShi };
}));
