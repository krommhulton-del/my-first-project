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
    let s = `你本人五行属${chart.dayWx}:${DAY_WX_CHAR[chart.dayWx]}。` +
      `整体力量${Bazi.plainBand(band)},${strong ? '主见强、扛得动事,毛病是不容易听劝,认死理' : '心思细、听得进意见,毛病是拿主意慢、容易被环境带着走'}。`;
    s += `五类力量里最重的是${Bazi.plainShen(SHEN_HEAD[top[0]])}这一路(${top[1].toFixed(0)}),所以在性格上最明显的一层是:${TRAIT[top[0]]}。`;
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
    const age = opts && opts.age != null && isFinite(+opts.age) ? +opts.age : null;
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
    };
  }

  function material(chart, opts) {
    const r = read(chart, opts);
    if (!r) return '';
    let s = '【命盘细读·程序按古法算死(勿另立结论)】\n第一句:' + r.verdict + '\n骨架:' + r.story + '\n';
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

  return { read, material, combos, palaces, kin, personality, health, dayunRead, shenPower, HONEST, PALACE, WX_BODY };
}));
