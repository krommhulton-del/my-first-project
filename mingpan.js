// mingpan.js — 命盘细读(v1.00,板块 B′):一张八字从头到尾讲一遍
//
// 缘起:用户 2026-08-02——「你这个八字的解读太少太少了,我觉得你深入的做这个八字的解读…
// 我们要做的是金砖…非常非常深刻的去把一个项目做好」。
// 摸家底的结果站得住:`Bazi.chart` 算出来的东西很厚(旺衰、喜忌、格局、调候、神煞、大运、
// 刑冲合会、藏干十神、十二长生、纳音、旬空),而**解读层只有零碎**——
//   yunshi 管时间(日月年运)、mingge 管职业、dashi 管年表,
//   **十神组合、四柱宫位、六亲、性格、健康、大运逐步主题,一条都没有**。
// 那正是行家拿到一张八字最先讲的六件事。本模块补的就是这一块。
//
// ── 断法依据(每条逐字核回原文,核对靠 tests/mingpan.test.mjs)──
// 《渊海子平》:年为祖上,月为父母伯叔兄弟门户,日为妻妾己身 · 以时为子息,临死绝之乡,言子少之断 ·
//   日干为己身,日支为妻妾,则知妻妾之贤淑 · 比肩为兄弟姐妹也 · 偏财是父,乃母之夫星也 ·
//   伤官见官,为祸百端 · 财多身弱,剋父母 · 财多身弱,妻反胜夫 · 时带伤官,子息无传 ·
//   大忌年上伤官,主产厄带疾 · 食神制杀逢梟,不贫则夭
// 《三命通会》:若财多身弱,柱无印助,财少身强,柱有比劫,太过不及,皆不为福 · 伤官少者又行印乡,
//   即枭神夺食 · 经云:财官印绶,镇居于寅申巳亥 · 盖大运重地支,故有行东方、南方、西方、北方之辨 ·
//   岁运并临,独羊刃、七煞为凶,财、官、印绶亦吉
// 《子平真诠》:伤官佩印,本秀而贵 · 见财透食神…而以为食神生财 · 春木逢火,木火通明,不利见官
// 《滴天髓阐微》:身杀两停,则以食神制杀 · 官印相生,日主休囚,喜印缓而不喜比劫 ·
//   甲申戊寅,真为杀印相生 · 凡伤官佩印喜用在木火者,忌见金水也 · 五行和者,一世无灾 ·
//   血气乱者,生平多疾 · 母慈灭子关因异
// 《穷通宝鉴》:如一派戊己,支会金局,为财多身弱,富屋贫人,终生劳苦,妻晚子迟 ·
//   或无庚金,有丁透,亦属文星,为木火通明之象
//
// ── §四:一个口径一处算 ──
//   只吃 Bazi.chart 算好的:pillars(含 ganShen/cang/xingyun/nayin)、strength、yong、
//   tiaohou、rel(刑冲合会)、wuxing、dayun、shenShaOf。
//   **本模块不自算任何断法元素**:不算旺衰、不取用神、不排大运、不判神煞。
//   十神翻白话一律走 Bazi.SHEN_PLAIN / plainBand / plainShen(§四:那几张表只此一份)。
//
// ── §三 诚实分级 ──
//   条文层:每条规则挂得出逐字可搜的原话(核对测试逐条扫);
//   触发门槛:本项目自拟(注释里写明校准占比),**零回测**,界面第一屏写明;
//   凡原文只给现象不给起例的,一律标「触发条件自拟」。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./bazi.js'));
  } else { root.Mingpan = factory(root.Bazi); }
}(typeof self !== 'undefined' ? self : this, function (Bazi) {

  const inv = (m, v) => Object.keys(m).find(k => m[k] === v);
  const POS_CN = { year: '年', month: '月', day: '日', hour: '时' };
  const KEYS4 = ['year', 'month', 'day', 'hour'];

  // 五类力量:按日主把力量分折成五类(取自 chart.wuxing,只此一份)
  function shenPower(chart) {
    const dw = chart.dayWx, pw = chart.wuxing;
    return {
      印星: pw[inv(Bazi.SHENG, dw)], 比劫: pw[dw], 食伤: pw[Bazi.SHENG[dw]],
      财星: pw[Bazi.KE[dw]], 官杀: pw[inv(Bazi.KE, dw)],
    };
  }
  // 十神在盘上「透」与「藏」:透干=四柱天干(日干除外),本气=地支本气藏干
  function spread(chart) {
    const P = chart.pillars, tou = [], ben = [], all = [];
    for (const k of KEYS4) {
      if (k !== 'day') { tou.push(P[k].ganShen); all.push(P[k].ganShen); }
      for (const c of P[k].cang) { all.push(c.shen); if (c.qi === '本气') ben.push(c.shen); }
    }
    const has = (list, ns) => ns.some(n => list.includes(n));
    return {
      tou, ben, all,
      touAny: ns => has(tou, ns), benAny: ns => has(ben, ns),
      anyOf: ns => has(all, ns),
      // 「立得住」= 透干或本气(校准后的口径:全部余气都算会滥,mingge 那一轮量过)
      solid: ns => has(tou, ns) || has(ben, ns),
      countOf: n => all.filter(x => x === n).length,
      posOf: n => KEYS4.filter(k => P[k].ganShen === n || P[k].cang.some(c => c.shen === n)),
    };
  }

  // ══════════ 一、十神组合断(核心:行家拿到一张八字最先看的就是这一层)══════════
  // 每一款都挂逐字原话;分「成局」与「破局」两向,凶的照报不打折(铁律七)。
  // 门槛是本项目自拟的排序器,写明可吵;**凭据挂不出来的组合一律不报**。
  function combos(chart) {
    const sp = shenPower(chart), sd = spread(chart), P = chart.pillars;
    const band = chart.strength.band, strong = chart.strength.strong;
    const out = [];
    // key 是行内名目(材料与测试用),**title 才是给客人看的**——头一版把 key 直接印进
    // 第一句与骨架里,于是「枭神夺食」「伤官见官」这些名目一路漏到客人眼前(铁律八)。
    const TITLE = {
      杀重身轻: '压力大过承载力', 食神制杀: '本事压得住压力', 伤官佩印: '锋芒有人接',
      伤官见官: '锋芒与规矩正面撞', 财多身弱: '钱多而人扛不动', 官印相生: '名分与资历接得上',
      杀印相生: '压力能转成本钱', 枭神夺食: '本事出不了口', 伤官生财: '本事直接换钱',
      食神生财: '本事稳稳换钱', 比劫分财: '钱要分给同辈', 印重无泄: '照顾太周全反而出不来',
      财官印俱全: '钱、名分、靠山三样齐', 木火通明: '脑子与表达最亮', 金水伤官: '聪明外露话锋利',
      年上伤官: '少年那一段不顺',
    };
    const add = (key, plain, tech, quote, src, tone) =>
      out.push({ key, title: TITLE[key] || key, plain, tech, quote, src, tone: tone || '平' });

    // ① 食神制杀:原文写死了前提是「**身杀两停**」——自测时发现头一版只查「有杀有食」,
    // 于是一副身弱(比劫+印 14)而七杀 51 的盘也被判成「压得住」,与它自己引的那句原话直接打架。
    // 这是**依据与结论不同向**,本项目明令禁止。现在两停按 身/杀 ≥0.6 判(自拟门槛,写明可吵),
    // 不够两停的那一头另走「杀重身轻」——那一条原文也有明文,且是凶。
    const shen0 = sp.比劫 + sp.印星;
    const liangTing = sp.官杀 > 0 && shen0 / sp.官杀 >= 0.6;
    if (sd.solid(['七杀']) && sp.官杀 >= 20 && !liangTing) {
      add('杀重身轻',
        '外面的压力远大过你能扛的:期限、竞争、说一不二的人、要负的责任,都比你的承载力重一截。'
        + '古书这一条的判语很硬,不转述软。可控的做法有三样:一是不接超出自己节奏的活,'
        + '二是把长期高压的位置换成有人分担的位置,三是先把身体与本钱这两样养厚——这一格最怕硬撑',
        `七杀${sp.官杀.toFixed(1)},而比劫+印仅${shen0.toFixed(1)}(身/杀 ${(shen0 / sp.官杀).toFixed(2)})`,
        '杀重身轻，终身有损', '渊海子平', '凶');
    }
    if (sd.solid(['七杀']) && sd.solid(['食神']) && liangTing && sp.官杀 >= 15 && sp.食伤 >= 12) {
      const xiao = sd.solid(['偏印']);
      add('食神制杀',
        xiao ? '压力有人接、但接的人又被截:本事能压住外面的硬事,可惜盘里另有一路把这条本事的路堵着——'
             + '古书对这一格的话很重,说的是把出路堵死之后的样子。落到实处:凡靠专业能力顶住压力的场合,先确认没有人在中间截你的活,该署名署名、该留痕留痕'
             : '压得住:外面来的硬事(期限、竞争、说一不二的人)由你的专业本事顶回去,这是能扛事的结构。'
             + '做法是拿作品和交付说话,不靠职位压人;越是硬仗越显本事,所以挑活要挑难的、挑有交付物的',
        `七杀${sp.官杀.toFixed(1)}、食神制之${xiao ? ',又见偏印' : ''}`,
        xiao ? '食神制杀逢梟，不贫则夭' : '身杀两停，则以食神制杀',
        xiao ? '渊海子平' : '滴天髓阐微', xiao ? '凶' : '吉');
    }
    // ② 伤官佩印:秀而贵,但印重伤浅反而无用——《子平真诠》两头都说了
    if (sd.solid(['伤官']) && sd.solid(['正印', '偏印'])) {
      const yinHeavy = sp.印星 > sp.食伤 * 2;
      add('伤官佩印',
        yinHeavy ? '锋芒被压得太狠:本有出彩的本事,可是管束与保护那一路压过头,想出头的劲被按住了。'
                 + '古书直说这种配置「不贵不秀」——出路在有意识地减少请示与依赖,把作品直接交到用得上的人手里'
                 : '锋芒有人接:才华外露而有靠山与资历托底,这是既能出彩又不至于闯祸的结构。'
                 + '做法上,创新的部分放手做,合规与背书那一半交给能给你背书的人',
        `伤官${sp.食伤.toFixed(1)}、印${sp.印星.toFixed(1)}${yinHeavy ? '(印重伤浅)' : ''}`,
        yinHeavy ? '伤官佩印，本秀而贵，而身主甚旺，伤官甚浅，印又太重，不贵不秀' : '伤官佩印，本秀而贵',
        '子平真诠', yinHeavy ? '凶' : '吉');
    }
    // ③ 伤官见官:古书最重的话之一,照报不软(铁律七)
    if (sd.solid(['伤官']) && sd.solid(['正官'])) {
      add('伤官见官',
        '锋芒与规矩正面撞上:这副盘里既有想出头、想说真话的劲,又有职级与规矩在管着——'
        + '两样同时在场,是非、顶撞、被穿小鞋这类事的概率明显高于常人。古书这一条的话说得极重,不打折转述。'
        + '可控的做法是:凡涉及上级与流程的场合把话写下来走正式渠道,把锋芒留给作品与对外的场合',
        '伤官与正官并见(透干或本气)', '伤官见官，为祸百端', '渊海子平', '凶');
    }
    // ④ 财多身弱:富屋贫人——这一条要连「有没有比劫印帮」一起判(三命通会原文自己就是这么说的)
    if (!strong && sp.财星 >= 30 && sp.财星 > sp.比劫 + sp.印星) {
      const help = sd.solid(['比肩', '劫财']) || sd.solid(['正印', '偏印']);
      add('财多身弱',
        (help ? '钱多而人扛不动,好在盘里有帮手:' : '钱多而人扛不动,盘里又没有帮手:')
        + '看得见的机会与金钱远多于你能吃下的量,硬吃就是累垮或赔进去。古书把这一格叫「富屋贫人」——'
        + '身处富贵之地却享不到,原因不在运气在承载力。'
        + (help ? '做法:合伙、借力、雇人分担,把摊子拆小了做,单干最吃亏' : '做法:先把身体与本钱这两样养起来,宁可少接一半的活;这一格最忌一个人硬扛全摊'),
        `财${sp.财星.toFixed(1)} > 比劫${sp.比劫.toFixed(1)}+印${sp.印星.toFixed(1)},身${band}`,
        help ? '若财多身弱，柱无印助，财少身强，柱有比劫，太过不及，皆不为福' : '如一派戊己，支会金局，为财多身弱，富屋贫人，终生劳苦，妻晚子迟',
        help ? '三命通会' : '穷通宝鉴', '凶');
    }
    // ⑤ 官印相生:名分与资历互相递——《滴天髓阐微》给的是「日主休囚喜印」的条件
    if (sd.solid(['正官']) && sd.solid(['正印'])) {
      add('官印相生',
        (strong ? '名分与资历接得上:职级、证书、背书这三样在你身上是一条线,升迁按部就班走得通。'
                : '名分与资历接得上,而你本人偏薄:靠山与资历是这一格的命门——')
        + (strong ? '要留神的是这条路升得慢,急不得;做法是把资历、证书、背书这三样按年攒,别为了快跳去没有晋升规则的地方'
                  : '往有人带、有体系、有明确晋升规则的地方去,单打独斗最不划算;做法是先找到能给你背书的人,再谈职位')
        + '。这一格最忌的是中途换赛道——前面攒的资历带不走,等于从头再来',
        `正官与正印并立,身${band}`, '官印相生，日主休囚，喜印缓而不喜比劫', '滴天髓阐微', '吉');
    }
    // ⑥ 杀印相生:硬压力被化成资历
    if (sd.solid(['七杀']) && sd.solid(['正印', '偏印']) && sp.官杀 >= 20) {
      add('杀印相生',
        '硬压力能转成本钱:外面给的是硬仗、期限、说一不二的人,而盘里有一路把这股压力接下来转成自己的资历与见识。'
        + '这种结构越是高压环境越出成绩,反倒是清闲环境里容易废掉。选工作按「压力大但有人带」这个标准挑',
        `七杀${sp.官杀.toFixed(1)},印${sp.印星.toFixed(1)}化之`, '甲申戊寅，真为杀印相生', '滴天髓阐微', '吉');
    }
    // ⑦ 枭神夺食:偏印压食神
    if (sd.solid(['偏印']) && sd.solid(['食神']) && sp.印星 >= sp.食伤) {
      add('枭神夺食',
        '本事出不了口:有拿得出手的能力,却常被另一路心思压住——想得多、启动慢、成果容易被人截走或自己中途撤回。'
        + '这一格的实处是「交付」两个字:定死交稿日期、找一个会催你的人、把半成品先发出去',
        `偏印${sp.印星.toFixed(1)} ≥ 食神${sp.食伤.toFixed(1)}`, '伤官少者又行印乡，即枭神夺食', '三命通会', '凶');
    }
    // ⑧ 伤官生财 / 食神生财:本事换钱
    if (sd.solid(['伤官', '食神']) && sd.solid(['正财', '偏财']) && sp.食伤 >= 12 && sp.财星 >= 15) {
      const shang = sd.solid(['伤官']);
      add(shang ? '伤官生财' : '食神生财',
        (shang ? '本事直接换钱,路子野:' : '本事稳稳换钱:')
        + '专业能力与收入之间有直路,不必经由职位与名分。'
        + (shang ? '这一路来钱快、也容易起伏;做法是合同与账目自己抓,收入好的年份先留出一年的生活费再谈扩张' : '这一路来得稳、涨得慢;做法是把一门手艺做长做深,别频繁换行当,复利在年头上')
        + (strong ? ';你本人扛得住,可以放开做' : ';但你本人偏薄,一次别开太多摊子'),
        `食伤${sp.食伤.toFixed(1)} → 财${sp.财星.toFixed(1)}`,
        shang ? '伤官生财，或伤官佩印而伤官旺，印有根' : '见财透食神，不以为财逢食生，而以为食神生财',
        '子平真诠', '吉');
    }
    // ⑨ 比劫夺财:同辈分利
    if (sp.比劫 >= 30 && sp.财星 >= 12 && sp.比劫 > sp.财星) {
      add('比劫分财',
        '钱要分给同辈:合伙、借贷、分账、竞标这几样,是这副盘最容易漏钱的口子。古书连剋父母、剋妻、破财争斗一并说了,话不软。'
        + '做法具体到动作:合伙先写清退出条款,借钱一律走书面,竞标别把底价交给中间人',
        `比劫${sp.比劫.toFixed(1)} > 财${sp.财星.toFixed(1)}`, '名曰劫财败财，主剋父母及剋妻、破财争斗之事', '渊海子平', '凶');
    }
    // ⑩ 母慈灭子:印重身旺无泄——《滴天髓阐微·反局》的名目
    if (sp.印星 >= 35 && sp.食伤 <= 10 && strong) {
      add('印重无泄',
        '被照顾得太周全,反而出不来:靠山、资历、长辈的保护都很足,而把这些换成成果的那条路很细。'
        + '典型表现是学历与见识高于产出,做事等条件齐了才动。古书给这一格起的名目就是「母慈灭子」——'
        + '爱得太满反而误事。破法是主动制造交付压力:接外部有截止日的活,不接可以无限延期的活',
        `印${sp.印星.toFixed(1)}、食伤${sp.食伤.toFixed(1)},身${band}`, '母慈灭子关因异', '滴天髓阐微', '凶');
    }
    // ⑪ 财官印三般俱全(三命通会明文)
    if (sd.solid(['正财', '偏财']) && sd.solid(['正官']) && sd.solid(['正印'])) {
      add('财官印俱全',
        '钱、名分、靠山三样都在盘上:这是古书点名的完整结构,做事有底子、出头有台阶。'
        + '这种盘的风险不在缺东西,在于三样互相牵制时的取舍。做法定死一条:先保名分那一头(职级、资质、正式身份),钱与资历会跟上来;反过来先抓钱,三样都松',
        '财、正官、正印三者并立', '经云：财官印绶，镇居于寅申巳亥', '三命通会', '吉');
    }
    // ⑫ 木火通明(《子平真诠》《穷通宝鉴》都有,窄格,触发按日主与力量)
    if (chart.dayWx === '木' && chart.wuxing.火 >= 30 && chart.wuxing.木 >= 20) {
      add('木火通明',
        '脑子与表达是这副盘最亮的一处:学、写、讲、设计这类靠脑子出成果的事,你比别人省力。'
        + '古书给这一格的判语是「聪明雅秀」，同时点了一句「不利见官」——'
        + '走专业与创作的路顺,进层级森严的体系里反而憋屈。做法是把产出做成可署名、可累积的东西(文章、课程、作品集),它们比职位更能替你说话',
        `日主木,火${chart.wuxing.火.toFixed(1)}`, '春木逢火，木火通明，不利见官', '子平真诠', '吉');
    }
    // ⑬ 金水伤官(《滴天髓阐微》有整段命例)
    if (chart.dayWx === '金' && chart.wuxing.水 >= 30) {
      add('金水伤官',
        '聪明外露、话锋利,冷的一面明显:反应快、看得穿,也容易把话说到人痛处。'
        + '古书对这一格特别强调冷暖的平衡——冷得过头要有暖意接着,落到实处是:别把工作与生活都安排成独处,'
        + '刻意留出与人面对面的场合,不然会越走越冷、越冷越尖',
        `日主金,水${chart.wuxing.水.toFixed(1)}`, '此金水伤官当令，喜支藏暖土，足以砥定中流', '滴天髓阐微', '平');
    }
    // ⑭ 年上伤官(《渊海子平》明文,主少年与身体)
    if (P.year.ganShen === '伤官') {
      add('年上伤官',
        '少年那一段不顺是结构里带的:与长辈、与出身环境的摩擦早,起步阶段容易走弯路,身体上也有落下毛病的可能。'
        + '古书这条说得直接。可用的部分是:这一格的人早早学会不靠家里,自立比同龄人早。做法是把早年那段摩擦当成本钱用——凡靠自己趟出来的路子,后面别轻易交回给长辈拿主意',
        '年干为伤官', '大忌年上伤官，主产厄带疾', '渊海子平', '凶');
    }
    return out;
  }

  // ══════════ 二、四柱宫位(《渊海子平》原文划的界)══════════
  // 显示名一律白话:「年柱/月柱/日柱/时柱」四个名目都在体检员的禁表上(铁律八),
  // 客人那一头只看得到「出生年那一格」这类说法,行内名目留在材料与专业区。
  const PALACE = {
    year: { name: '出生年那一格', who: '祖上与出身环境', age: '大致管 1–16 岁那一段' },
    month: { name: '出生月那一格', who: '父母、兄弟与门户', age: '大致管 17–32 岁那一段' },
    day: { name: '出生日那一格', who: '你自己与配偶(底下那一层是配偶的位置)', age: '大致管 33–48 岁那一段' },
    hour: { name: '出生时那一格', who: '子女与晚年', age: '大致管 49 岁以后' },
  };
  function palaces(chart) {
    const P = chart.pillars, xi = chart.yong.xiWx, ji = chart.yong.jiWx;
    const relText = [...(chart.rel.chong || []), ...(chart.rel.xing || []), ...(chart.rel.hai || [])];
    const PAL_QUOTE = { quote: '年为祖上，月为父母伯叔兄弟门户，日为妻妾己身', src: '渊海子平' };
    return KEYS4.map(k => {
      const p = P[k], cn = POS_CN[k];
      const hit = relText.filter(s => s.slice(0, s.indexOf('·')).includes(cn));
      const gw = p.ganWx, zw = p.zhiWx;
      // 干支不同向时必须分开说——头一版「干或支占一头就算顺」,于是日柱说「总体顺」,
      // 而六亲那一层按日支说「耗你」,同一副盘两句话打架。自测揪出,改成逐头报。
      const gGood = xi.includes(gw), gBad = ji.includes(gw);
      const zGood = xi.includes(zw), zBad = ji.includes(zw);
      const good = gGood && zGood, bad = gBad && zBad, mixed = (gGood && zBad) || (gBad && zGood);
      const shen = k === 'day' ? (p.cang[0] ? p.cang[0].shen : null) : p.ganShen;
      return {
        key: k, name: PALACE[k].name, who: PALACE[k].who, age: PALACE[k].age,
        quote: PAL_QUOTE.quote, src: PAL_QUOTE.src,
        shen, plainShen: shen && shen !== '日主' ? Bazi.plainShen(shen) : null,
        good, bad, hit,
        plain: `${PALACE[k].name}主${PALACE[k].who},${PALACE[k].age}。` +
          (shen && shen !== '日主' ? `这一格当家的是${Bazi.plainShen(shen)};` : '') +
          (good ? '这一格明面与底下都是帮你的五行,这一段与这一头的人事顺。' :
            bad ? '这一格明面与底下都是耗你的五行,这一段与这一头的人事要多费力气。' :
            mixed ? `这一格明面(${gw})与底下(${zw})方向相反——${gGood ? '看着顺、底下费力' : '看着紧、底下反倒托着'},这一头的事不能只看表面。` :
            '这一格不帮不压,平。') +
          (hit.length ? `另有${hit.join('、')}——这一头有拉扯,该断的关系与该分的账早点分清,拖着最伤。` : ''),
      };
    });
  }

  // ══════════ 三、六亲(星与宫两头看,《渊海子平》明文)══════════
  function kin(chart) {
    const sp = shenPower(chart), sd = spread(chart), P = chart.pillars;
    const fem = chart.gender === '女', known = chart.genderKnown;
    const out = [];
    const one = (who, plain, tech, quote, src) => out.push({ who, plain, tech, quote, src });
    // 父母:印为母、偏财为父(渊海明文);月柱为父母之宫
    const yinOK = sp.印星 >= 15, caiOK = sp.财星 >= 15;
    one('父母', `看两处:一处是出生月那一格,一处是盘上养你的与代表父亲的那两路力量。` +
      `${yinOK ? '母亲那一头的力量在盘上立得住,受照应多' : '母亲那一头的力量偏薄,早年受的照应有限或聚少离多'};` +
      `${caiOK ? '父亲那一头也立得住' : '父亲那一头偏薄,与父亲的缘分或助力偏淡'}。` +
      (sp.财星 >= 30 && !chart.strength.strong ? '另有一条古书说得直:钱多而人扛不动的盘,与父母的缘分要多留心。' : ''),
      `印${sp.印星.toFixed(1)}、财${sp.财星.toFixed(1)}`,
      '偏财是父，乃母之夫星也，亦为偏妻', '渊海子平');
    // 兄弟:比劫为兄弟姐妹(渊海明文)
    one('兄弟姐妹与同辈', `同辈这一路的力量${sp.比劫 >= 25 ? '很重——兄弟朋友多、来往密,但分你东西的也是他们' : sp.比劫 >= 12 ? '中等,同辈里有能帮上的人' : '偏薄,遇事多靠自己,同辈能借的力有限'}。` +
      (sp.比劫 >= 30 ? '合伙与借贷这两件事对你风险最高,写清楚再做。' : ''),
      `比劫${sp.比劫.toFixed(1)}`, '比肩为兄弟姐妹也', '渊海子平');
    // 配偶:日支为妻妾(渊海明文)+ 男财女官
    const dz = P.day.cang[0] ? P.day.cang[0].shen : null;
    const dzWx = P.day.zhiWx, dzGood = chart.yong.xiWx.includes(dzWx);
    let peiPlain = `配偶看两处:一处是出生日那一格的底下那一层(古书原话「日支为妻妾」),一处是代表配偶的那一路力量。` +
      `那一层坐的是${dzGood ? '帮你的五行——伴侣对你是助力,家里这一头能给你补上盘上缺的那一味' : chart.yong.jiWx.includes(dzWx) ? '耗你的五行——伴侣与你的需求方向不同,亲密关系里要主动说明彼此要什么,不然长期互相消耗' : '不帮不压的五行——伴侣与你之间没有明显的补或耗,处得成不成看后天'}。`;
    if (known) {
      const star = fem ? '官杀' : '财星';
      const v = fem ? sp.官杀 : sp.财星;
      peiPlain += `${fem ? '古法女命看丈夫,取的是管束你的那一路力量' : '古法男命看妻子,取的是你能管住的那一路力量(钱与妻同一路)'},这一路${v >= 25 ? '很重:对象缘不缺,可挑的多,但也容易一时定不下来' : v >= 12 ? '中等:该来的时候会来' : '偏薄:对象缘来得晚或来得少,主动出手比等着强'}。`;
    } else peiPlain += '配偶星那一层要按性别取(男看财、女看官),性别没填,这一层不硬断。';
    if (!chart.strength.strong && sp.财星 >= 30 && !fem && known) peiPlain += '另有古书一条照说:钱多而人扛不动的男命,家里那一头容易强过自己,原话是「妻反胜夫」。';
    one('配偶', peiPlain, `日支${P.day.zhi}(${dzWx})${dz ? '·' + dz : ''}`, '日干为己身，日支为妻妾，则知妻妾之贤淑', '渊海子平');
    // 子女:时柱为子息(渊海明文)
    const hourShen = P.hour.ganShen;
    one('子女', `子女看出生时那一格。这一格${chart.yong.xiWx.includes(P.hour.zhiWx) ? '坐的是帮你的五行,晚年与子女这一头是顺的,老来有靠' : chart.yong.jiWx.includes(P.hour.zhiWx) ? '坐的是耗你的五行,晚年与子女这一头要多操心,提早把养老与教育的账算清' : '不帮不压,平'}。` +
      (hourShen === '伤官' ? '另有一条古书说得直:出生时那一格带着锋芒那一路,子息这一头要留心,原话是「时带伤官,子息无传」——古人说的是难,不是无,现代医疗条件下按体检与调理来处理。' : '') +
      (P.hour.xingyun === '死' || P.hour.xingyun === '绝' ? '这一格落在古法所说的死绝之位,古书对这一格的判语是子少,照实记。' : ''),
      `时柱${P.hour.gz}${hourShen ? '·' + hourShen : ''}`, '以时为子息，临死绝之乡，言子少之断', '渊海子平');
    return out;
  }

  // ══════════ 四、性格(日主 + 强弱 + 当家的十神 + 调候)══════════
  const DAY_WX_CHAR = {
    木: '本性向上、要生长、讲仁义;不喜欢被框住,认准的方向会一直长',
    火: '本性外放、快、亮;情绪与表达都在明处,来得急去得也快',
    土: '本性厚重、守信、能承载;转身慢,一旦认定不轻易改',
    金: '本性刚断、有原则、讲义气;能断能舍,也容易把话说硬',
    水: '本性流动、聪明、善变通;点子多,定性要靠外部结构补',
  };
  function personality(chart) {
    const sp = shenPower(chart);
    const top = Object.entries(sp).sort((a, b) => b[1] - a[1])[0];
    const band = chart.strength.band, strong = chart.strength.strong;
    const SHEN_HEAD = { 印星: '正印', 比劫: '比肩', 食伤: '食神', 财星: '正财', 官杀: '正官' };
    const TRAIT = {
      印星: '重学习与名声,做事先找依据、先问规矩;短处是启动慢、依赖感强',
      比劫: '自我与主见强,不服管,凡事要自己拿主意;短处是不肯低头、容易与人争',
      食伤: '表达欲与创造欲强,想法多、坐不住;短处是话快得罪人、耐性短',
      财星: '现实、会算账、抓得住机会;短处是眼里事多、容易把关系也当资源算',
      官杀: '守规矩、有责任感、扛得住事;短处是压力内化、活得比别人紧',
    };
    // v1.06(AI 腔度量指出这一层是纯并列):改成一条链——底色 → 因为力量厚薄所以行为怎样 →
    // 又因为哪一路最重所以最明显的一层是什么 → 落到一个可观察的日常表现上。
    let s = `你本人五行属${chart.dayWx},底色是${DAY_WX_CHAR[chart.dayWx]}。`;
    s += `整体力量${Bazi.plainBand(band)}(${chart.strength.pct}%),所以${strong ? '主见强、扛得动事;代价是不容易听劝、认死理,别人越推你越顶' : '心思细、听得进意见;代价是拿主意慢,容易被当下的环境和身边人的态度带着走'}。`;
    s += `再看哪一路最重:是${Bazi.plainShen(SHEN_HEAD[top[0]])}这一路(${top[1].toFixed(0)} 分,五类里最高),因此性格上最明显的一层就是——${TRAIT[top[0]]}。`;
    s += `两者叠加,日常最容易被人看见的是${strong ? '你的坚持' : '你的周全'},最容易被自己忽略的是${strong ? '别人已经在退让' : '自己其实早有判断'}。`;
    if (chart.tiaohou && chart.tiaohou.wx) {
      s += `另有一层是气候:这副盘生在${chart.monthZhi}那个月,古法讲究先看冷暖燥湿,你缺的那一味是${chart.tiaohou.wx}——` +
        `落到性格上,${chart.tiaohou.wx === '火' ? '偏冷偏静,热起来慢,需要外部的热闹与正反馈把人带动' : chart.tiaohou.wx === '水' ? '偏躁偏急,静下来难,需要刻意安排独处与休息' : '需要靠外部环境补这一味,不是靠自己硬扭'}。`;
    }
    return s;
  }

  // ══════════ 五、健康(《滴天髓阐微·疾病》原文:五行和者一世无灾)══════════
  const WX_BODY = {
    木: '肝胆、筋、眼睛与情绪郁结', 火: '心血管、小肠、精神与睡眠',
    土: '脾胃、消化与肌肉', 金: '肺、大肠、皮肤与呼吸道', 水: '肾、膀胱、内分泌与骨',
  };
  function health(chart) {
    const pw = chart.wuxing;
    const arr = Object.entries(pw).sort((a, b) => b[1] - a[1]);
    const most = arr[0], least = arr[arr.length - 1];
    const spread5 = most[1] - least[1];
    const balanced = spread5 < 25;
    return {
      balanced, most: most[0], least: least[0], spread: +spread5.toFixed(1),
      plain: balanced
        ? `五行分布较匀(最高${most[0]}${most[1].toFixed(0)}、最低${least[0]}${least[1].toFixed(0)},差${spread5.toFixed(0)}),` +
          `古书对这种盘的判语是「五行和者,一世无灾」——这一层没有明显的先天短板,按常规体检与作息即可。`
        : `五行偏枯(${most[0]}最重${most[1].toFixed(0)}、${least[0]}最轻${least[1].toFixed(0)},差${spread5.toFixed(0)}),` +
          `古书讲「血气乱者,生平多疾」。落到身上:${least[0]}最弱,对应${WX_BODY[least[0]]}这一路最先出问题;` +
          `${most[0]}过旺,对应${WX_BODY[most[0]]}这一路容易亢而生病。` +
          `这是倾向不是诊断——真有不适看医生,这里只提示往哪一路多留意。`,
      quote: balanced ? '五行和者，一世无灾' : '血气乱者，生平多疾', src: '滴天髓阐微',
    };
  }

  // ══════════ 六、大运逐步主题(《三命通会》:盖大运重地支)══════════
  function dayunRead(chart, age) {
    const d = chart.dayun;
    if (!d || d.unknown || !d.list || !d.list.length) {
      return { unknown: true, note: '大运排不出——性别未填。性别一换大运顺逆全反(实测 100%),所以这一层不硬排,补上性别即可。', steps: [] };
    }
    const by = chart.birth instanceof Date ? chart.birth.getFullYear() : null;
    const xi = chart.yong.xiWx, ji = chart.yong.jiWx;
    const cur = age != null && isFinite(+age) ? +age : null;
    const steps = d.list.slice(0, 8).map(x => {
      const gw = Bazi.GAN_WX[x.gan], zw = Bazi.ZHI_WX[x.zhi];
      // 原文口径:大运重地支——地支那一头权重更高,判语按地支为主、天干为辅
      const zGood = xi.includes(zw), zBad = ji.includes(zw);
      const gGood = xi.includes(gw), gBad = ji.includes(gw);
      const score = (zGood ? 2 : zBad ? -2 : 0) + (gGood ? 1 : gBad ? -1 : 0);
      const y0 = by == null ? null : Math.round(by + x.fromAge);
      const gShen = Bazi.shiShen(chart.dayGan, x.gan);
      const zCang = (Bazi.CANGGAN[x.zhi] || [])[0];
      const zShen = zCang ? Bazi.shiShen(chart.dayGan, zCang) : null;
      const theme = zShen ? Bazi.plainShen(zShen) : Bazi.plainShen(gShen);
      const now = cur != null && cur >= x.fromAge && cur < x.fromAge + 10;
      return {
        gz: x.gz, fromAge: x.fromAge, y0, y1: y0 == null ? null : y0 + 10, score, now,
        tone: score >= 2 ? '顺' : score <= -2 ? '逆' : '平',
        plain: `${y0 == null ? x.fromAge + '岁起' : y0 + '–' + (y0 + 10) + '年'}(${x.fromAge}岁起)` +
          `${now ? '【眼下这一步】' : ''}:这十年当家的是${theme}这一路。` +
          (score >= 2 ? '底下那一层走的是帮你的五行,是可以进取的十年——该扩的扩、该定的定,机会成本最低。'
            : score <= -2 ? '底下那一层走的是耗你的五行,是要守的十年——不宜加杠杆、不宜同时开两摊,把手上的事做扎实反而稳。'
            : '这十年不帮不压,起落主要看流年,按既定节奏推进即可。'),
      };
    });
    return { unknown: false, steps, note: '这十年一步的判法按古书口径「大运重地支」——底下那一层的权重高于明面那一层,所以判语以底下为主。', quote: '盖大运重地支，故有行东方、南方、西方、北方之辨', src: '三命通会' };
  }

  // ══════════ 汇总 + 因果链总述 ══════════
  const HONEST = '这一页的规矩:每条规则挂得出古书原话(引文逐字核过原文,核对钉在测试里);' +
    '**什么情况下触发这条规则,门槛是本项目自拟的,零回测**;吉凶的轻重照原文说,不比它乐观也不比它悲观。' +
    '健康那一层说的是倾向不是诊断。这一页不替你做任何去留的决定。';

  function read(chart, opts) {
    if (!chart) return null;
    opts = opts || {};
    const age = opts.age != null && isFinite(+opts.age) ? +opts.age : null;
    const cb = combos(chart), pl = palaces(chart), kn = kin(chart), hl = health(chart);
    const dy = dayunRead(chart, age);
    const sp = shenPower(chart);
    // 第一句:先给这副盘最要紧的一条(有凶报凶,铁律七)
    const bad = cb.filter(x => x.tone === '凶'), good = cb.filter(x => x.tone === '吉');
    let verdict;
    if (!cb.length) verdict = `这副盘没有触发古书点名的那些组合——结构平顺,没有特别的成局也没有特别的破局,起落主要看大运流年。`;
    else if (bad.length) verdict = `这副盘上最要紧的一条是「${bad[0].title}」:${bad[0].plain.split('。')[0].replace(new RegExp('^' + bad[0].title + '[:：]?'), '')}。` +
      (good.length ? `同时也有立得住的一头:「${good[0].title}」。` : '') + `全部${cb.length}条组合列在下面,凶的照说不打折。`;
    else verdict = `这副盘上最立得住的一条是「${good[0].title}」:${good[0].plain.split('。')[0].replace(new RegExp('^' + good[0].title + '[:：]?'), '')}。共触发${cb.length}条组合,逐条列在下面。`;
    // 总述:一条因果链(基础→组合→宫位→时间),连词只连真依赖
    const nowStep = dy.steps.find(s => s.now);
    let story = `这副盘的骨架:你本人五行属${chart.dayWx},整体力量${Bazi.plainBand(chart.strength.band)},` +
      `旺你的是${chart.yong.xiWx.join('、')},耗你的是${chart.yong.jiWx.join('、')}——后面每一条判断都从这里出。`;
    if (cb.length) story += `盘上成形的组合有${cb.length}条,其中最要紧的是「${(bad[0] || good[0]).title}」;` +
      `这一条决定的是${bad.length ? '这副盘最容易出事的地方' : '这副盘最能借力的地方'},不是全部。`;
    story += `落到人身上:${pl.find(p => p.key === 'day').plain.split('。')[0]}。`;
    if (nowStep) story += `再落到时间上:${nowStep.plain}`;
    else if (dy.unknown) story += '时间那一层要大运,而大运缺性别排不出——补上性别这一层才有下文。';
    return {
      verdict, story, combos: cb, palaces: pl, kin: kn, personality: personality(chart),
      health: hl, dayun: dy, shen: sp, honest: HONEST,
      // 通盘那一层要年表的大运分段与大年,拿不到就没有(不硬造)
      whole: opts.parts ? whole(chart, opts.parts, opts) : null,
    };
  }

  function material(chart, opts) {
    const r = read(chart, opts);
    if (!r) return '';
    let s = '【命盘细读·程序按古法算死(勿另立结论)】\n第一句:' + r.verdict + '\n骨架:' + r.story + '\n';
    if (r.whole) {
      // 通盘那一条线是**给模型的骨架**:它规定了讲的次序(底 → 大运分段 → 大年 → 眼下),
      // 不是又一堆零件。模型照这条线展开,别再回到并列清单。
      s += '【通盘这一条线(按这个次序讲,别打散成清单)】\n' + r.whole.lead + '\n' + r.whole.story + '\n';
    }
    if (r.combos.length) {
      s += '【十神组合(每条挂原话)】\n';
      for (const c of r.combos) s += `— [${c.tone}] ${c.title}(行内名目:${c.key}):${c.plain}(推演:${c.tech};原话「${c.quote}」《${c.src}》)\n`;
    }
    s += '【四柱宫位】\n' + r.palaces.map(p => `— ${p.plain}`).join('\n') + '\n';
    s += '【六亲】\n' + r.kin.map(k => `— ${k.who}:${k.plain}(原话「${k.quote}」《${k.src}》)`).join('\n') + '\n';
    s += '【性格】' + r.personality + '\n';
    s += '【健康倾向】' + r.health.plain + `(原话「${r.health.quote}」《${r.health.src}》)\n`;
    if (!r.dayun.unknown) {
      s += '【大运逐步】' + r.dayun.note + '\n';
      for (const x of r.dayun.steps) s += `— ${x.plain}\n`;
    } else s += '【大运】' + r.dayun.note + '\n';
    s += '【写法铁规】①以上结论程序已按古法算死,勿另立、勿改判;②' + HONEST +
      '③禁空话禁说教,第一句就是结论;④凶就报凶(说清凶在哪、代价是什么、可控的做法),不安慰;' +
      '⑤不许凹市井腔(「那一摊」「那股力」这类绰号一个不用),平实书面语,每条=结论+机制+做法或时间;' +
      '⑥不替人做去留的决定(铁律十一)。';
    return s;
  }

  // ══════════════════════════════════════════════════════════════════
  //  通盘(v1.15):把散着的几块串成一条能读的线
  // ══════════════════════════════════════════════════════════════════
  // 缘起:用户 2026-08-03「排盘问题解决就去解读,生辰矫正八字星盘需要大换血」。
  // **先量后改**:拿一副盘把用户一眼看到的文本块数出来——6 块,而其中**只有 17%**
  // 提到「跟别处的关系」。也就是说命盘细读、命格取向、年表、运势各说各的,
  // 读者拿得到零件,拿不到一条贯穿的线。行家看盘不是这样的:他先定这副盘靠什么成事,
  // 再看大运把这条线送到哪几段顺、哪几段逆,再落到具体年份,最后说眼下。
  //
  // 本层**一个断法都不自算**(§四):喜忌取 chart.yong、大运顺逆取 Dashi 的 steps.tag/dir、
  // 大年取 Dashi 的 nodes、主导那条力取本模块的 shenPower、吃哪碗饭取 Mingge。
  // 它只做一件事——**把这些按真实依赖串起来**:
  //   用神 → 哪几步大运是顺的(真依赖:tag 就是拿喜忌判的)
  //   → 大运阶段 → 那几个大年落在顺段还是逆段(真依赖:年表分数本就受大运影响)
  //   → 眼下这一步 → 该做什么。
  // 连词只连真依赖(v0.99 的教训:硬塞「因为」比并列短句更糟)。
  function whole(chart, parts, opts) {
    if (!chart) return null;
    const P = parts || {};
    const steps = (P.steps || []).filter(s => s && s.fromYear);
    const nodes = (P.nodes || []).filter(n => n && n.year);
    // 年表给的 steps 不带「眼下是哪一步」(那是 dashi 自己不需要的字段),
    // 头一版照抄 dayunRead 的写法去找 s.now,于是**「眼下」整段永远不出现**——
    // 这一层最该说的话反而是空的。改成按当年年份自己定位。
    const nowYear = (P.nowYear || (opts && opts.nowYear)) || new Date().getFullYear();
    const sp = shenPower(chart);
    const topShen = Object.keys(sp).sort((a, b) => sp[b] - sp[a])[0];
    const SHEN_HOW = {
      印星: '靠积累与背书成事——学历、资历、有人带、有牌照,这类东西在你身上比在别人身上更管用',
      比劫: '靠人多势众成事——同辈、合伙、团队,单打独斗打不开局面,拉得起队伍就顺',
      食伤: '靠拿得出手的本事成事——手艺、表达、作品,别人认的是你做出来的东西,不是你的位置',
      财星: '靠算账与经营成事——找得到需求、算得清成本,钱这条线上你比多数人敏感',
      官杀: '靠位置与规矩成事——在有编制、有层级、有考核的地方,你比在散摊子上更立得住',
    };
    // 一、大运脉络:按**干支两层**分档再并段。
    // 头一版只看一个 dir,结果六步连着并成「60 年顺」——那种话等于没说。
    // 分档依《三命通会》「盖大运重地支」:底下那一层(支)分量更重,面上那一层(干)次之。
    const LV = { 大顺: 3, 底顺: 2, 面顺: 1, 逆: 0 };
    const lvOf = st => (st.zhiTag === '喜' && st.tag === '喜') ? '大顺'
      : (st.zhiTag === '喜') ? '底顺'
      : (st.tag === '喜') ? '面顺' : '逆';
    // 「明面/底下」是本项目已向用户解释过的定名(§十一),不算术语;「干支」是行内名目,不上稿(铁律八)
    const LV_SAY = {
      大顺: '明面与底下两层都走在旺你的那几行上——这是一辈子里最该使劲的时候,大事往这里排',
      底顺: '底下那一层顺、明面那一层拧:实惠是有的,过程不好看,别被脸面上的不顺劝退',
      面顺: '明面机会不少、底下不接力:看着热闹,落到实处费劲,宜挑着做不宜全接',
      逆: '明面与底下两层都在耗你:这段的正经用法是把底子做厚——补资质、还旧账、收摊子,不铺新的',
    };
    const phases = [];
    for (const st of steps) {
      const lv = lvOf(st);
      const last = phases[phases.length - 1];
      if (last && last.lv === lv) { last.toYear = st.toYear; last.toAge = st.toAge; last.gzs.push(st.gz); }
      else phases.push({ lv, dir: lv === '逆' ? '不得力' : lv === '大顺' ? '得力' : '半', fromYear: st.fromYear, toYear: st.toYear, fromAge: st.fromAge, toAge: st.toAge, gzs: [st.gz] });
    }
    for (const p of phases) {
      p.years = `${p.fromYear}–${p.toYear}`;
      p.ages = `${Math.round(p.fromAge)}–${Math.round(p.toAge)} 岁`;
      // 带上这一段各步的十神——一段并了四步却只报头一步的十神,等于把 40 年说成一句话,
      // 读者拿不到段内的变化。逐步报出来,段内的次序本身就是内容。
      const inSeg = steps.filter(x => x.fromYear >= p.fromYear && x.toYear <= p.toYear);
      const shens = [];
      for (const x of inSeg) { const s = x.shenPlain || ''; if (s && shens[shens.length - 1] !== s) shens.push(s); }
      p.shen = shens[0] || '';
      p.say = `${p.years}(${p.ages},走${p.gzs.join('、')})——${LV_SAY[p.lv]}` +
        (shens.length > 1 ? `。这一段里当家的力依次是:${shens.map(s => `「${s}」`).join('→')}`
          : p.shen ? `。这一段当家的是「${p.shen}」这条力` : '');
    }
    const best = phases.slice().sort((a, b) => (LV[b.lv] - LV[a.lv]) || ((b.toYear - b.fromYear) - (a.toYear - a.fromYear)))[0] || null;
    const nowStep = steps.find(s => nowYear >= s.fromYear && nowYear <= s.toYear) || null;
    const nowPhase = nowStep ? phases.find(p => nowStep.fromYear >= p.fromYear && nowStep.toYear <= p.toYear) : null;
    // 二、大年挂到它所在的那一段上——同样一个大年,落在顺段和逆段读法不一样
    // 二、大年:**取最重的、不取最早的**;同一类只留分最高的一个(头一版六条全是「家境父母」,
    // 因为按年份先后取了童年那几条,读起来像复读)。成年以后的优先。
    // **过去与将来分开取、分开说**:头一版按分数一路取下来,给一个 36 岁的人报出
    // 「2010 年该出手的投入放这一年」——对已经过去的年份发号施令,是明摆着的错。
    // 将来的给做法,过去的改成回头对账(那正是本项目唯一现成的反馈回路,§十一)。
    const phaseOf = y => phases.find(p => y >= p.fromYear && y <= p.toYear) || null;
    const byForce = (a, b) => Math.abs(((b.top || {}).score) || 0) - Math.abs(((a.top || {}).score) || 0);
    const dedupe = () => { const seen = new Set(); return nd => { const k = (nd.top && nd.top.key) || nd.year; if (seen.has(k)) return false; seen.add(k); return true; }; };
    const adult = nodes.filter(nd => (nd.age == null || nd.age >= 16));
    const future = adult.filter(nd => nd.year >= nowYear).sort(byForce).filter(dedupe()).slice(0, 4);
    const past = adult.filter(nd => nd.year < nowYear).sort(byForce).filter(dedupe()).slice(0, 2);
    const picked = future.concat(past).sort((a, b) => a.year - b.year);
    const marks = picked.map(nd => {
      const ph = phaseOf(nd.year);
      const lab = (nd.top && nd.top.label) || '这一年';
      const lv = ph ? ph.lv : null;
      // 同一段里的几个大年,若都套同一句尾巴,读起来就是复读(头一版 AI 腔 52 的病根)。
      // 改成**按事型给具体动作**,再叠这一段的力度——这样每一条真的在说不同的事。
      const key = (nd.top && nd.top.key) || '';
      const ACT = {
        shiye: ['正面争取:该报的岗位、该谈的晋升摆到台面上', '争是要争,但先把手里的活做出成绩再开口', '别主动挑事,守住现有位置,风头过了再谈'],
        caiyun: ['该出手的投入放这一年,回本周期按乐观算', '进项有,但先落袋再谈扩大,别拿账面数字做决定', '这一年收着花,大额投入往后挪'],
        // 姻缘这一类**只报动、不报是聚是散**(v0.77 起的铁律:方向归处境不归卦),
        // 所以三档给的都是「怎么应对这一年的动」,一句都不许暗含聚或散。
        // 头一版写的「该定的关系定下来」正是暗含了聚,当场作废。
        yinyuan: ['感情这一头这一年动得最重,把时间和话都留出来', '感情上多说少猜,把话讲开比自己揣摩强', '感情这一头这一年容易起波,别在情绪上做决定'],
        zinv: ['家里要添人或添事,提前把钱和时间腾出来', '孩子与长辈的事这一年占时间,排期先给他们', '家里人的事这一年容易起摩擦,少替人做主'],
        jiankang: ['体检该做的项目一次做全,趁有精力把旧毛病处理掉', '别熬,作息这一年是本钱', '身体这头别硬扛,该查就查、该停就停'],
        wenshu: ['考试、证书、合同这类事排在这一年最顺', '文书上的事逐字看清再签', '合同与手续这一年容易出岔,一律留底'],
        guanfei: ['该走的手续走全,别留把柄', '有纠纷早了结,拖到后面代价更大', '这一年沾了纠纷别硬碰,找人从中说和'],
        biandong: ['要搬要动就这一年,越往后越费劲', '动可以动,但先把落脚处定下来再走', '不宜大动,小调整可以'],
        // 年表的第九类「家境父母」(jiajing)有意不列:实测 800 副盘 2298 个这一类的节点,
        // **16 岁以上的一个都没有**——它本就是童限那一段的事,而这一层从 16 岁起看。
        // 头一版列了它,是一条永不触发的死条(§十二);删的理由是年龄闸门,不是年表没有这一类。
      };
      const bank = ACT[key] || ['这一类的事这一年最集中,提前排时间', '这一类的事这一年要留余地', '这一类的事这一年宜缓不宜急'];
      const pick = lv === '大顺' ? bank[0] : (lv === '底顺' || lv === '面顺') ? bank[1] : bank[2];
      const force = lv === '大顺' ? '这一年落在你最得力的那一段里,同样的事在此时办成算最高'
        : lv === '底顺' ? '那一段实惠在底下,场面上未必好看'
        : lv === '面顺' ? '那一段面上热闹底下不接力,挑着接'
        : lv === '逆' ? '偏偏落在耗你的那一段里,同样的动静更容易变成消耗'
        : '那几年大运不偏不倚,分量就是它本身';
      return { year: nd.year, age: nd.age, label: lab, key, lv, pick, force, past: nd.year < nowYear };
    });
    // 同一段里的第二条起不再重复段位说明——那句话上一条已经讲过了,再讲就是复读
    let prevLv = null;
    for (const m of marks) {
      m.say = m.past
        ? `${m.year} 年(${m.age} 岁)这一年程序判的是${m.label}最重——这一年已经过去,拿它对一对:那年这一头是不是真动了。对得上,后面几年的话才信得过`
        : `${m.year} 年(${m.age} 岁)最重的是${m.label}——${m.pick}` + (m.lv !== prevLv ? `。${m.force}` : '');
      // 姻缘那一类恒带留白声明(v0.77):只报动、不报是聚是散
      if (m.key === 'yinyuan') m.say += '。这一类只报哪一年动、动多重,不报是聚是散——那取决于你进这一年时的处境,不是盘定的';
      if (!m.past) prevLv = m.lv;
    }
    // 三、串成一段:每一句都接着上一句的结论
    const xi = chart.yong.xiWx.join('、'), ji = chart.yong.jiWx.join('、');
    // 「最吃得开的那一段」若在几十年后、或早已走过,必须当面说清——
    // 头一版对一个 36 岁的人报「最吃得开的是 67–77 岁那一段」却一个字不解释,
    // 读者只会当成好消息收下。远近与已过未过,是这句话的一半。
    let bestWhen = '';
    if (best) {
      if (best.toYear < nowYear) bestWhen = `,那一段已经走过了(${nowYear - best.toYear} 年前收的尾)——往后要在不如它的条件下办事,所以下面每一段该怎么用,比它更要紧`;
      else if (best.fromYear > nowYear + 10) bestWhen = `,还在 ${best.fromYear - nowYear} 年之后——这不是眼下能指望的东西,中间这些年按各自那一段的用法走`;
      else if (best.fromYear > nowYear) bestWhen = `,还有 ${best.fromYear - nowYear} 年到`;
      else bestWhen = `,你正在这一段里`;
    }
    const lead = `这副盘的主线是:${SHEN_HOW[topShen] || '靠自身条件成事'}` +
      (best ? `;而这条线最吃得开的是${best.years}(${best.ages})那一段${bestWhen}。` : '。');
    let story = `先把底定下来:你本人五行属${chart.dayWx},整体力量${Bazi.plainBand(chart.strength.band)},` +
      `旺你的是${xi},耗你的是${ji}。这两组五行是后面一切的尺子——大运顺不顺,看的就是它走到哪一行。\n\n` +
      `顺着这把尺子往下看,一辈子的大运分成这么几段:\n` + phases.map(p => '· ' + p.say).join('\n');
    if (marks.length) story += `\n\n再把大事落到年份上。同一个年份放在不同的段里读法不一样;已经过去的那几年不给做法,留着让你对账:\n`
      + marks.map(m => '· ' + m.say).join('\n');
    if (nowStep) {
      const lv = nowPhase ? nowPhase.lv : lvOf(nowStep);
      story += `\n\n眼下:你正走${nowStep.gz}运(${nowStep.fromYear}–${nowStep.toYear}),这一步属「${lv}」。` +
        (lv === '大顺' ? `这是全局里最该使劲的档,该办的大事——签长约、换赛道、置产、要孩子——排在这几年比排在后面划算。`
          : lv === '底顺' ? `实惠在底下,面上会有阻力:该谈的照谈,但别指望过程漂亮,拿到手的东西才算数。`
          : lv === '面顺' ? `机会会自己找上门,可底下不接力——挑一两件做透,比样样都接强。`
          : `这几年的正确用法是把底子做厚:补资质、还旧账、把摊子收拢,别在这时候铺新的大摊子。`);
    }
    return { lead, topShen, phases, marks, now: nowStep, nowPhase, story,
      honest: '这一层不新算任何东西:旺你耗你的那几行取自命盘、十年一步的顺逆与大年取自年表,' +
        '本层只负责按真实的先后与因果把它们串起来。串法是本项目自拟的,零回测——' +
        '它让你看得懂来龙去脉,不等于它更准。' };
  }

  return { read, material, combos, palaces, kin, personality, health, dayunRead, shenPower, whole, HONEST, PALACE, WX_BODY };
}));
