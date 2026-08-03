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
    const refs = [];   // 挂得住的出处:**只放在 data/classics/ 里逐字搜得到的**,搜不到的一条不放
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
    // 同一个六亲,问的事不同,指的东西就不同——问婚恋时的官鬼是「那个人」,不是「那个位置」;
    // 妻财是「那个人」,不是「那笔钱」。najia 的 note 已经写明了是不是夫妻星,照它分流。
    // 缘起:对抗式体检揪出来的——女问「他会不会跟我复合」填了性别后取官鬼为夫星,
    // 可 WHAT_PLAIN 一律译成「你惦记的那个位置(或那桩管着你的事)」,整句话答非所问。
    const isSpouse = /夫星|妻星|夫婿|妻室/.test(ys.note || '');
    const what = byShiYing ? '你问的那一头(对方,或这件事本身)'
      : isSpouse ? '你问的那个人'
      : WHAT_PLAIN[ys.liuQin] || '你要的那样东西';

    if (yongLine) {
      yongWx = yongLine.wx;
      const p = yongLine.power || {};
      score += (p.score || 0) * 0.9;
      tech.push(`用神${ys.liuQin || '(世应法·应爻)'}:${p.wang || ''}${(p.notes || []).length ? ';' + p.notes.join(';') : ''}`);
      why.push(`${what}在这一卦里现着,眼下${plainWang(p.wang)}`);
      if (p.yuePo) { score -= 1.5; why.push('它这个月正被冲着,本月内使不上劲,得过了这个月才算数'); }
      if (yongLine.kong) { score -= 1.5; why.push('它眼下是空的——现在问等于问了个空,得等这段空过去才见真章');
        refs.push({ pt: '空要等到填实那一天才算数',
          q: '用神旺相而遇旬空﹐出空之日則出矣', src: '增删卜易·旬空章' }); }
      if (p.ruMu) { score -= 1; why.push(`它像锁在柜子里,得有外力来撬开才动得了`); }
    } else if (fu) {
      yongWx = fu.wx;
      score -= 1.5;
      why.push(`${what}没在明面上,藏在底下——这事眼下摆不到台面,得有人先把它掀开才动得了`);
      refs.push({ pt: '要看的那样东西不上卦时,往底下找',
        q: '若用神不現﹐卽以日月爲用神﹐倘日月非用神者﹐則本宮首卦尋之',
        src: '增删卜易·飞伏神章' });
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
    let help = 0, block = 0;
    if (!movers.length) {
      why.push('满卦不动——局面是静的,没人推它,也没人拦它;这种卦多半是「照旧」');
    } else {
            for (const m of movers) {
        if (!yongWx) break;
        if (SHENG[m.wx] === yongWx) { score += .8; help++; tech.push(`动爻${m.liuQin}${m.zhi}${m.wx}生用神`); }
        else if (KE[m.wx] === yongWx) { score -= .8; block++; tech.push(`动爻${m.liuQin}${m.zhi}${m.wx}克用神`); }
      }
      // 六亲名不上稿:说的是「有几股力在帮、几股在拦」,不是它们在术数里叫什么
      if (block && yongLine && yongLine.power && ['旺', '相'].includes(yongLine.power.wang)) {
        refs.push({ pt: '有来拦的,但它自己够硬,拦得住',
          q: '用神旺相可以敵之﹐必然無妨﹐得禍亦輕', src: '增删卜易·用神章' });
      }
      if (help && block) why.push(`局面在动:有 ${help} 股力在帮衬,也有 ${block} 股在拦——两边拉扯,谁快谁占先`);
      else if (help) why.push(`局面在动,而且有 ${help} 股力正推着它往成里走`);
      else if (block) why.push(`局面在动,可动的那几股力是来拦的——有 ${block} 处在往回拽`);
      else why.push('局面在动,但动的那几处跟你问的这件事不搭界——热闹是别人的');
    }

    const band = bandOf(score);
    const yq = Yingqi ? Yingqi.yingqiOf(cast, now) : null;
    const dir = Yingqi ? Yingqi.direction(cast) : null;

    // ——— 五、该怎么办 ———
    // 缘起:用户 2026-08 原话——「他很多解读我觉得就是没有那么专业…不要再拿出那种半吊子的感觉了」。
    // 病根在这儿:原先只给「为什么」,不给「那我该干什么」。断而不给做法,就是半吊子。
    // 做法一律由卦面状态推出,不是套话:催还是等看用神实虚,进还是守看它对你的态度,
    // 门路与时辰取既有的取向与应期。**只说动作与时间,不讲道理**(铁律一)。
    const advice = [];
    const kong = yongLine && yongLine.kong, po = yongLine && yongLine.power && yongLine.power.yuePo;
    const mu = yongLine && yongLine.power && yongLine.power.ruMu;
    if (kong) advice.push({ k: '眼下', v: '别催。这段是空的,现在推、现在问、现在下本钱都白费——等它落实了再动手' });
    else if (po) advice.push({ k: '眼下', v: '本月别动。过了这个月它才使得上劲,这几周只做准备,不做决定' });
    else if (mu) advice.push({ k: '眼下', v: '光等没用,得有人来撬。找个能拍板的人插一脚,自己干耗着不会动' });
    else if (score >= 1.2) advice.push({ k: '眼下', v: '可以推。这是该出手的时候,慢一步就凉一分' });
    else if (score <= -2.7) advice.push({ k: '眼下', v: '收着点。这一路眼下推不动,先把损失掐住,别追加' });
    else advice.push({ k: '眼下', v: '先探一次再定。小成本试一步,看它接不接得住,别一次押满' });

    if (rel.s >= 1) advice.push({ k: '姿态', v: '主动去要。它本来就朝你来,开口比等着强' });
    else if (rel.s <= -1) advice.push({ k: '姿态', v: '别硬顶。让一步、换个说法、绕开正面,才拿得到' });
    else if (rel.s > 0) advice.push({ k: '姿态', v: '你压得住它,但要费手脚——把功夫花在细节上，别指望一次谈成' });

    if (yq && yq.date) advice.push({ k: '时候', v: `${yq.date}前后见分晓${yq.say ? '——' + yq.say : ''}` });
    if (dir && dir.dir) advice.push({ k: '门路', v: `往${dir.dir}这一路找人找事最顺${dir.dist ? '(' + dir.dist + ')' : ''}` });
    if (movers.length && block) advice.push({ k: '提防', v: `有 ${block} 处在往回拽——动手前先把这几处堵上,不然做一半会翻` });

    return {
      score: +score.toFixed(1),
      cheng: band.cheng, pct: band.pct, say: band.say,
      yongName: ys.liuQin, yongNote: ys.note, byShiYing, tech, advice, refs,
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

  // ══════════ 断语的因果链(v1.05,深造期第二期第三块,核心板块回炉收尾)══════════
  // 缘起:用户「口语化的解读一看就知道很 AI」「原先的项目没有改进」。
  // 病根与年运、年表那两块同源:初断给的是**四条并列观察(why)+ 一个做法清单(advice)**,
  // 谁也不接谁——读者看得见每一条,却拿不到「这几成是怎么算出来的」。
  // 改法:**结论(几成)→ 这个数怎么来的(用神一头、你自己一头、动静一层,逐层递进)→
  // 应期落到哪一天 → 具体做法 → 卦没照到的地方照实说**。
  // 本函数只做串联,**一个断卦元素不自算**(成算、应期、方位全取自 judge 的结果,§四)。
  function story(res, ask) {
    if (!res) return '';
    const q = (ask && ask.q) ? String(ask.q).slice(0, 30) : '这一问';
    // 一、结论先行(铁律二 + 铁律三:把握度用几成说死)
    const dot = x => !x ? '' : (/[。;;!?]$/.test(x) ? x : x + '。');
    let s = `${q}:${res.cheng === '成' ? '能成' : res.cheng === '不成' ? '成不了' : '悬着'},${res.pct}把握。${dot(res.say)}`;
    // 二、这个数怎么来的——三层递进,层与层之间是真依赖(用神有没有气 → 世应谁占上风 → 卦动不动)
    const w = res.why || [];
    if (w.length) {
      s += '这个数是这么来的:';
      s += w[0] + (w.length > 1 ? ';' : '。');
      if (w.length > 1) s += `而${w[1].replace(/^你/, '你')}` + (w.length > 2 ? ';' : '。');
      if (w.length > 2) s += `再看整卦:${w.slice(2, 4).join(';')}。`;
      s += `三层叠起来,才落到「${res.pct}」这个数上——不比卦面多说半分,也不少说半分。`;
    }
    // 三、应期:落到具体日子(不是「近期」这种话)
    if (res.yingqi && res.yingqi.date) {
      s += `什么时候见分晓:${res.yingqi.date}前后。${dot(res.yingqi.say)}`;
      if (res.yingqi.others && res.yingqi.others.length) {
        const o = res.yingqi.others[0];
        s += `另有一解落在${o.date},古法两解并存时取先到的那一天,所以按前一个日子准备。`;
      }
    }
    // 四、做法:具体到动作与方向
    const adv = (res.advice || []).filter(a => a && a.v);
    if (adv.length) s += '该怎么办:' + adv.map(a => `${a.k}——${a.v}`).join(';') + '。';
    // 五、边界(铁律六:卦面没照到的地方明写)
    s += '这一卦只答这一问;别的枝节要另起一卦,拿这一卦硬答别的问题不作数。';
    return s;
  }

  return { judge, story, bandOf, BANDS, relToShi };
}));
