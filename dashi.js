// dashi.js — 人生大事年表:按大运流年逐年推「什么时候会发生什么事」
//
// 断法依据(子平流运通行口径,每条都留了可追溯的依据串):
//   ①十神定事型:财主钱与妻(男)、官杀主事业与夫(女)、印主文书贵人房产、
//     比劫主同辈合伙争财、食伤主才华子女(女)与表达投资;
//   ②喜忌定吉凶方向:同一颗十神,为喜是得其利,为忌是受其累——不问喜忌只报十神即是空话;
//   ③宫位受冲合定应事之处:日支为夫妻宫、月支为提纲(事业居所)、时支为子女宫、年支为根基宫;
//   ④神煞定应事之象:红鸾天喜主婚喜、桃花主情缘、驿马主动迁、文昌主文书、
//     羊刃主刀伤口角、天乙主贵人、空亡(天中殺)主一段低潮;
//   ⑤大运层面的大动:岁运并临(流年干支与大运干支相同)、天克地冲大运、换运前后一两年为转折带。
// 凡本表所报,必列依据;依据不足者宁可不报——不许拿「机遇与挑战并存」凑数。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./bazi.js'));
  } else { root.Dashi = factory(root.Najia, root.Bazi); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Bazi) {
  const { GAN_WX, ZHI_WX, CANGGAN, GAN, ZHI, SHISHEN_CLASS } = Bazi;
  const zIdx = z => ZHI.indexOf(z);
  const chongOf = z => ZHI[(zIdx(z) + 6) % 12];
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const SANHE = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']];
  const SANXING = [['寅', '巳', '申'], ['丑', '戌', '未']];
  const ZIXING = ['辰', '午', '酉', '亥'];

  // 事型:key → 显示名 + 该类事的落地说法(不是形容词,是能照着做的事)
  const CATS = {
    yinyuan: { label: '姻缘', icon: '缘' },
    shiye: { label: '事业', icon: '业' },
    caiyun: { label: '财运', icon: '财' },
    wenshu: { label: '学业文书', icon: '文' },
    biandong: { label: '搬迁变动', icon: '动' },
    zinv: { label: '子女家人', icon: '嗣' },
    jiankang: { label: '健康身体', icon: '体' },
    guanfei: { label: '是非官非', icon: '讼' },
    jiajing: { label: '家境父母', icon: '家' },
  };

  function shen(chart, gan) { return Bazi.shiShen(chart.dayGan, gan); }
  function cls(chart, gan) { return SHISHEN_CLASS[shen(chart, gan)]; }
  function tagOf(chart, wx) {
    if (chart.yong.xiWx.includes(wx)) return '喜';
    if (chart.yong.jiWx.includes(wx)) return '忌';
    return '闲';
  }
  // 配偶星:男命以财为妻、女命以官杀为夫(通行口径)
  function peiOuClass(gender) { return gender === '女' ? '官杀' : '财星'; }

  // 一年的证据链:返回各事型得分与依据
  // opts.marital:'单身' | '有伴' | 空。只对姻缘一类有用,理由见下面 YINYUAN_HELD 那段。
  function yearEvidence(chart, gz, dayunGz, opts) {
    const marital = (opts && opts.marital) || '';
    const g = gz[0], z = gz[1];
    const P = chart.pillars;
    const dz = P.day.zhi, mz = P.month.zhi, yz = P.year.zhi, hz = P.hour.zhi;
    const zhu = CANGGAN[z][0];                       // 流年支本气
    const gShen = shen(chart, g), zShen = shen(chart, zhu);
    const gCls = SHISHEN_CLASS[gShen], zCls = SHISHEN_CLASS[zShen];
    const gTag = tagOf(chart, GAN_WX[g]), zTag = tagOf(chart, ZHI_WX[z]);
    // dir:+1 吉向、-1 凶向、0 中性(主「变」)。事型的吉凶由它自己的证据定,
    // 不能拿全年干支喜忌一刀切——否则会出现「依据说印星得用、结论却说文书反复」这种自相矛盾。
    // 一条证据存两份:reasons 是**给客人看的大白话**,techs 是**喂模型的推演原文**。
    // 缘起(v0.80):拿断语体检员扫程序自己的成稿,量出年表依据 536 条里 190 条带术语(35.4%)——
    // 而这一栏在运势页(.dwhy)与吉日页(.jwhy)都是直接渲染给客人看的,违反铁律八。
    // v0.65 修过一轮运势三卡,**年表这一栏当时漏了**,用户为「看不懂」说过两次。
    // 分两份之后:客人看白话,模型仍拿得到干支十神(它需要原料才能讲透),两不耽误。
    const cats = {}; const add = (k, s, why, dir, tip, ju, tech) => {
      if (!cats[k]) cats[k] = { score: 0, reasons: [], techs: [], dirSum: 0, tips: [], juSum: 0 };
      cats[k].score += s; cats[k].reasons.push(why); cats[k].techs.push(tech || why);
      cats[k].dirSum += s * (dir === undefined ? 0 : dir);
      if (ju) cats[k].juSum += s * ju;                 // 聚(+)散(-)向:只在姻缘用,且只作旁注不作方向
      if (tip) cats[k].tips.push({ w: s, tip });      // 每条信号自带「所以该怎么办」,断语随信号走而不是套模板
    };
    // flags 同理分两份:flags 给客人看(白话),flagsTech 喂模型(留干支十神)。
    const flags = [], flagsTech = [];
    const flag = (why, tech) => { flags.push(why); flagsTech.push(tech || why); };

    // —— 神煞(与 bazi.js 同表,结构化取用)——
    const yzi = zIdx(yz), dzi = zIdx(dz);
    const sanheIdx = Bazi.sanheIdx;
    const isTaohua = z === Bazi.TAOHUA[sanheIdx(yz)] || z === Bazi.TAOHUA[sanheIdx(dz)];
    const isYima = z === Bazi.YIMA[sanheIdx(yz)] || z === Bazi.YIMA[sanheIdx(dz)];
    const isHuagai = z === Bazi.HUAGAI[sanheIdx(yz)] || z === Bazi.HUAGAI[sanheIdx(dz)];
    const isWenchang = Bazi.WENCHANG[chart.dayGan] === z;
    const isYangren = Bazi.YANGREN[chart.dayGan] === z;
    const isTianyi = (Bazi.TIANYI[chart.dayGan] || '').includes(z);
    const hongluan = Bazi.HONGLUAN[yzi];
    const isHongluan = hongluan === z;
    const isTianxi = ZHI[(zIdx(hongluan) + 6) % 12] === z;
    const isKong = chart.kong.includes(z);

    // —— 宫位冲合 ——
    const chongDay = chongOf(z) === dz, chongMonth = chongOf(z) === mz;
    const chongYear = chongOf(z) === yz, chongHour = chongOf(z) === hz;
    const heDay = LIUHE[z] === dz, heHour = LIUHE[z] === hz;
    const sanheDay = SANHE.some(t => t.includes(z) && t.includes(dz) && z !== dz);
    // 三刑:命局已有二支,流年补齐第三支
    let xing = null;
    const local = [yz, mz, dz, hz];
    for (const t of SANXING) {
      if (t.includes(z) && t.filter(x => x !== z).every(x => local.includes(x))) xing = t.join('');
    }
    if (!xing && ZIXING.includes(z) && local.includes(z)) xing = z + z + '自刑';
    if (!xing && ((z === '子' && local.includes('卯')) || (z === '卯' && local.includes('子')))) xing = '子卯相刑';

    // —— 大运层面的大动 ——
    let daYunFlag = null;
    if (dayunGz) {
      if (dayunGz === gz) {
        daYunFlag = '岁运并临';
        flag('今年这组力,与你正走的这十年那组一模一样——古法主大变之年,好坏都放大',
          `岁运并临(流年${gz}与大运${dayunGz}同一干支)——古法主大变之年,好坏都放大`);
      } else if (GAN_WX[dayunGz[0]] === Bazi.KE[GAN_WX[g]] || GAN_WX[g] === Bazi.KE[GAN_WX[dayunGz[0]]]) {
        if (chongOf(z) === dayunGz[1]) {
          daYunFlag = '天克地冲大运';
          flag('今年这组力,与你正走的这十年那组正面对撞——换轨之年,人事环境大改',
            `流年${gz}天克地冲大运${dayunGz}——运程换轨之年,人事环境大改`);
        }
      }
    }
    // 大运层面两种大动的白话名(客人看这一列,推演原文留给 techs)
    const daYunPlain = daYunFlag === '岁运并临' ? '今年这组力与你正走的这十年那组一模一样'
      : daYunFlag === '天克地冲大运' ? '今年这组力与你正走的这十年那组正面对撞' : '';
    if (isKong) flag('此年是运气之冬(古称天中殺):新起之事难扎根,宜守成清账、学习养神,不宜开业置产定亲',
      `此年落空亡(${z}在旬空之位,天中殺):运气之冬——新起之事难扎根,宜守成清账、学习养神,不宜开业置产定亲`);

    // ——— 姻缘 ———
    // v0.77 大改:**这一类不再输出无条件的吉凶方向**,只算「动量」(哪一年动、动多重)。
    // 缘起是回测量出来的三个数,不是我改主意:
    //   ① 33 人 37 件姻缘事,好坏几乎完全由「这一年发生的是结合还是分离」决定
    //      ——结合类 28 件里 25 件是好事(89.3%),分离类 7 件里 0 件是好事(0%)。
    //   ② 而结合还是分离,又几乎完全由「进这一年时是单身还是有伴」决定
    //      ——未见婚的 27 件里 25 件是结合,已婚的 10 件里 7 件是分离。
    //   ③ 这两个变量命盘一个都算不出来。实测同一状态内部,旧的方向分对好坏零区分度:
    //      未见婚组好事平均 0.19 分、坏事 0.96 分(方向还是反的);已婚组 1.17 对 1.11(几乎一样)。
    //   旧法把「动不动」和「动得好不好」揉成一个方向分,于是结合类判吉 60%、分离类也判吉 75%,
    //   合起来 47.6%——比抛硬币还差,而这是用户问得最多的一类。
    // 所以:dir 一律传 0(不表态),改传第六个参数 ju(聚 +1 / 散 -1)——那是古法「合主聚、冲主散」的说法,
    //   但实测覆盖率只有 3/37(合)与 2/37(冲),32 件两样都没有,**故只作旁注,不计入方向**。
    // 方向留给处境:调用方传 opts.marital 才给,且断语里必须写明那一层是处境定的,不是卦定的。
    // ——— 姻缘分两路(v0.84)———
    // 缘起(用户 2026-08-02):「谈恋爱不一定以结婚为前提,也可能只是很久没谈了想试一下。
    // 这个程度也应该放得近一点……但不能因为要近就胡编乱造,一定要客观。」
    //
    // 先量后改,量出两件事:
    //   ① **按「拆两档各报各的年份」去做,日期不会变近,反而更远**——
    //      只靠「动一动」类够 3.4 分门槛的第一年平均落在 2033.36,而现在报的是 2029.63,
    //      而且 78 副盘里只有 59 副有。那条路走不通,已作废。
    //   ② 病根不在权重,在**粒度**:3.4 这个门槛是按「人生大事」校准的,
    //      而「谈一个」本来就是小事、本来就发生得密。同一批证据落到**月**上,
    //      近档门槛 2.0 时:36/36 副盘都有信号,**第一个窗口平均在 3.4 个月之后**,
    //      未来 24 个月里命中 3.9 个月(约六分之一,仍有区分度)。
    //
    // 所以修法是:**不动任何权重、不新造任何证据**,只把已有的姻缘证据分成两营,
    //   「定下来」那一营照旧报年份(**报出来的年份一个都不许变**,有测试钉着),
    //   「动一动」那一营另外报未来两年的月份窗口。
    // 铁律(**这一条我头一版写错过,照实改**):原先写的是「近档单条权重不许高于远档最低权重」,
    //   可配偶星透干 2.0 本来就大于天喜 1.6,那句话根本不成立。
    //   真正成立、也真正管用的不变量是:**这八条的权重一分没动**,拆档只是给已有证据贴了个标签。
    //   有测试拿一张冻结的权重表逐条比对——只要有人为了「让它更近」去动某一条的分,测试当场变红。
    const peiCls = peiOuClass(chart.gender);
    const peiOnGan = gCls === peiCls, peiOnZhi = zCls === peiCls;
    let yyNear = 0, yyFar = 0;
    const near = w => { yyNear += w; }, far = w => { yyFar += w; };
    if (peiOnGan) { near(2); } if (peiOnGan) add('yinyuan', 2, `今年明面当值的正是${chart.gender === '女' ? '男人缘' : '女人缘'}这一路,摆在台面上`, 0, gTag === '忌' ? '对象这条线上你要多贴钱贴心力,别用「我付出了」来要回报' : '对象是明摆着往你这边走的,主动一点就成', 0,
      `流年天干${g}为${gShen}(${chart.gender === '女' ? '夫星' : '妻星'})透出`);
    if (peiOnZhi) { near(1.2); } if (peiOnZhi) add('yinyuan', 1.2, `今年底下暗着走的也是${chart.gender === '女' ? '男人缘' : '女人缘'}这一路——不摆在明面上,但一直在`, 0, null, 0,
      `流年支${z}藏${zhu}为${zShen},配偶星伏于支下`);
    if (heDay) { far(2.5); } if (heDay) add('yinyuan', 2.5, '今年这股力与你婚姻那一块正好合在一处', 0, '婚姻这一块被合动:见家长、订婚、领证这类要「定下来」的动作挑这一年办最顺', 1,
      `流年支${z}与你日支${dz}六合——合动婚姻宫`);
    if (sanheDay) { far(1.8); } if (sanheDay) add('yinyuan', 1.8, `今年有几股力凑成一团、正往你的婚姻这一块使`, 0, '会被一群人推着往前走:相亲、介绍、朋友局里成的概率最高', 1,
      `流年支${z}与日支${dz}成三合局——婚姻宫被牵动`);
    if (isHongluan) { far(2); } if (isHongluan) add('yinyuan', 2, '红鸾星动(婚恋之喜的老信号)', 0, '这一年适合把婚事摆上桌面:提亲、定日子、办酒', 1);
    if (isTianxi) { far(1.6); } if (isTianxi) add('yinyuan', 1.6, '天喜临(喜庆添丁之应)', 0, null, 1);
    if (isTaohua) { near(1.4); } if (isTaohua) add('yinyuan', 1.4, '桃花当值——人缘情事活络', 0, '桃花旺:单身的多出门多见人,有主的把边界划清,暧昧最容易在这一年出事', 0, `桃花(咸池)临${z}——人缘情事活络`);
    if (chongDay) { near(1.6); } if (chongDay) add('yinyuan', 1.6, '今年这股力正冲着你婚姻那一块来——聚散都在这一年见分晓', 0, '婚姻这一块被冲:该摊开的话别憋,拖到年底最容易散;也主自己或伴侣身体上的一次折腾', -1,
      `流年支${z}冲你日支${dz}——夫妻宫受冲,聚散都在这一年见分晓`);
    // 两营的分数挂到姻缘那一类上,供 romanceTracks 取用(不参与总分,总分一分没动)
    if (cats.yinyuan) { cats.yinyuan.nearScore = +yyNear.toFixed(2); cats.yinyuan.farScore = +yyFar.toFixed(2); }
    // 方向这一层:命盘不定,处境定。填了才给,且标明来源。
    if (cats.yinyuan) {
      if (marital === '单身' || marital === '有伴') {
        const sign = marital === '单身' ? 1 : -1;
        cats.yinyuan.dirSum = +(cats.yinyuan.score * 0.6 * sign).toFixed(2);
        cats.yinyuan.dirFrom = '处境';
        cats.yinyuan.reasons.push(marital === '单身'
          ? '按你填的「眼下单身」断:这一动多半往结合上走(这一层是处境定的,不是卦定的——回测里单身状态下的姻缘年 27 件有 22 件是好事)'
          : '按你填的「眼下有伴」断:这一动多半使在摩擦或聚散上(这一层是处境定的,不是卦定的——回测里有伴状态下的姻缘年 10 件有 7 件是坏事)');
      } else {
        cats.yinyuan.dirSum = 0;
        cats.yinyuan.held = true;    // 方向留白:没有处境就不表态
        cats.yinyuan.reasons.push('吉凶方向此处留白:同一股力,单身的多半往结合走、有伴的多半使在摩擦上——命盘只定哪一年动,定不了动的方向。要方向就填一下眼下是单身还是有伴');
      }
    }

    // ——— 事业 ———
    if (gCls === '官杀' || zCls === '官杀') {
      const t = gCls === '官杀' ? gTag : zTag;
      const gs = gCls === '官杀' ? gShen : zShen;
      add('shiye', t === '忌' ? 1.6 : 2,
        t === '忌' ? '今年当值的是压力与考验之力,而这一年它偏偏耗你——硬仗、期限、说一不二的人都往你这边压'
                   : '今年当值的是名分那条力,而这一年它是帮你的——职级、正式手续、压得住场的活都在这上头',
        t === '忌' ? -1 : 1,
        t === '忌' ? '活会变重、管你的人会变多,守住本职、留书面记录,别在这年硬碰上位者' : '该报的评审、该争的职级、该接的硬活别推,这一年名分是给得出来的',
        0, `官杀星当值(${gs}),${t === '忌' ? '为你忌神——主压力管束' : '为你喜用——主名分与担子'}`);
    }
    if ((gCls === '印星' || zCls === '印星') && (gTag === '喜' || zTag === '喜')) add('shiye', 1, '照应你的那条力这一年得用:名分、文书、靠山这条线顺', 1, null, 0, '印星得用:名分、文书、靠山这条线顺');
    if (chongMonth) add('shiye', 2, '今年这股力正冲着你的岗位与常驻之地来——岗位、公司、常驻之地这一年多变', 0,
      '调岗、换公司、换城市、换工位都比平时容易成:自己先挑好下家,别等通知', 0,
      `流年支${z}冲你月支${mz}(提纲)——岗位、公司、常驻之地这一年多变`);
    if (daYunFlag) add('shiye', 2, `${daYunPlain}——你正走的这十年这一层跟着换轨,事业格局重排`, 0, null, 0, `${daYunFlag}——大运层面的换轨,事业格局重排`);
    if (isTianyi) add('shiye', 1, '天乙贵人临:提携之人露面,求人办事挑这一年', 1, '有人肯拉你一把:该开口求的事、该递的话,这一年开口成功率最高'); 

    // ——— 财运 ———
    if (gCls === '财星' || zCls === '财星') {
      const t = gCls === '财星' ? gTag : zTag;
      const cs = gCls === '财星' ? gShen : zShen;
      add('caiyun', t === '忌' ? 1.8 : 2,
        t === '忌' ? '今年当值的是钱那条力,但这一年它是耗你的——财来财去、为钱奔波'
                   : '今年当值的是钱那条力,而这一年它是帮你的——进项与机会都在这上头',
        t === '忌' ? -1 : 1,
        t === '忌' ? '钱进得来也留不住:固定支出先砍一轮,大额决定拖过这一年' : '该谈的价、该签的单、该收的账往这一年靠,正路进财这条线是开的',
        0, `财星当值(${cs}),${t === '忌' ? '为你忌神——财来财去、为钱奔波' : '为你喜用——进项与机会都在这条线上'}`);
    }
    if ((gCls === '食伤' && gTag === '喜') && (zCls === '财星' || gCls === '财星')) add('caiyun', 1, '靠本事换钱这条路这一年通:手艺、口才、作品都变得出钱', 1, null, 0, '食伤生财:靠本事、靠作品换钱的路子通');
    if ((gCls === '比劫' || zCls === '比劫') && (gTag === '忌' || zTag === '忌')) add('caiyun', 2, '今年当值的正是与你分利的同辈之力:合伙、借贷、分账这类事最易漏财,先小人后君子', -1, '最容易在熟人身上破财:借钱、担保、合伙这三样这一年一概免谈,非做不可就写合同', 0, '比劫夺财:合伙、借贷、分账这类事最易漏财,先小人后君子');
    if (isYangren && (gCls === '财星' || zCls === '财星')) add('caiyun', 1.2, '钱上带着一股戾气:因钱起争之象,合同条款写死', -1, null, 0, '羊刃逢财:因钱起争之象,合同条款写死');

    // ——— 学业文书 ———
    if ((gCls === '印星' || zCls === '印星')) {
      const t = gCls === '印星' ? gTag : zTag;
      const ys = gCls === '印星' ? gShen : zShen;
      add('wenshu', t === '忌' ? 1.2 : 2,
        t === '忌' ? '今年当值的是照应你的那条力,但这一年它是拖你的——文书房产易反复、想得多做得少'
                   : '今年当值的是照应你的那条力,而这一年它是帮你的——考学、证书、合同、房产这条线得力',
        t === '忌' ? -1 : 1,
        t === '忌' ? '文书房产这条线会来回折腾:合同多看两遍,别把方案想到完美才动手' : '考试、评职称、拿证、签合同、买房过户,这一年办什么成什么',
        0, `印星当值(${ys}),${t === '忌' ? '为忌——文书房产易反复、想得多做得少' : '为喜——考学、证书、合同、房产这条线得力'}`);
    }
    if (isWenchang) add('wenshu', 1.6, '文昌临:考试、递材料、签字、投稿挑这一年', 1, '文昌当值:考证、考编、投稿、递材料,把要交的东西集中在这一年交'); 
    if (isHuagai) add('wenshu', 0.8, '华盖临:适合一个人闷头钻研的事', 1);

    // ——— 搬迁变动 ———
    if (isYima) add('biandong', 2.2, '驿马当值:动迁之应——出差、调动、搬家、换赛道', 0, '这一年人待不住:搬家、换城市、频繁出差、换赛道,顺着挪比硬守省劲', 0, `驿马临${z}:动迁之应——出差、调动、搬家、换赛道`);
    if (chongMonth) add('biandong', 1.5, '今年这股力冲着你的常驻之地来:居所或工作地点生变', 0, null, 0, `冲提纲${mz}:居所或工作地点生变`);
    if (chongHour) add('biandong', 1, '今年这股力冲着你的既定安排来:计划被打乱、小辈之事有动静', 0, null, 0, `冲时支${hz}:既定计划被打乱、小辈之事有动静`);
    if (daYunFlag === '天克地冲大运') add('biandong', 1.5, `${daYunPlain}:环境整体换一遍`, 0, null, 0, '天克地冲大运:环境整体换一遍');

    // ——— 子女家人 ———
    if (chart.gender === '女' && (gCls === '食伤' || zCls === '食伤')) add('zinv', 2, '今年当值的正是古法看女方子女的那条力——你拿得出手的本事那一路', 1, '子女这条线当值:备孕、生育、小辈的事集中在这一年', 0, `食伤当值(${gCls === '食伤' ? gShen : zShen})——女命以食伤为子息`);
    if (chart.gender === '男' && (gCls === '官杀' || zCls === '官杀')) add('zinv', 1.4, '今年当值的正是古法看男方子女的那一路(压力与名分之力)', 1, null, 0, '官杀当值——男命古法以官杀为子息');
    if (heHour) add('zinv', 1.6, '今年这股力与你子女那一块合在一处——添丁或小辈之事', 1, '子女那一块被合动:添丁、小辈升学、给孩子定大事,都在这一年', 0,
      `流年支${z}合你时支${hz}(子女宫)——添丁或小辈之事`);
    if (chongHour) add('zinv', 1.2, '今年这股力冲着你子女那一块来——小辈之事或既定计划生变', -1, null, 0, `流年支${z}冲你时支${hz}(子女宫)——小辈之事或既定计划生变`);
    if (isHongluan || isTianxi) add('zinv', 0.8, '红鸾天喜临:家中喜事之应', 1);
    if (chongYear) add('zinv', 1.2, '今年这股力冲着你的根基那一块来——长辈、老家、祖产之事有动静', -1, '根基那一块被冲:长辈身体、老家房子、祖产分配这几样容易在这一年摆上台面,早安排别等急事', 0,
      `流年支${z}冲你年支${yz}(根基宫)——长辈、老家、祖产之事有动静`);

    // ——— 健康身体 ———
    const weak = ['偏弱', '身弱'].includes(chart.strength.band);
    if ((gCls === '官杀' || zCls === '官杀') && (gTag === '忌' || zTag === '忌') && weak) add('jiankang', 2, '今年压力与考验之力正旺,而你本身这一年撑不住:劳损、旧疾、免疫这一路最先出问题', -1, '压力先伤睡眠和肠胃:这一年把体检排进日程,别拿硬扛当本事', 0, '七杀官星为忌又逢你身弱:压力攻身,劳损、旧疾、免疫这一路最先出问题');
    if (chongDay) add('jiankang', 1.5, '今年这股力正冲着你自身那一块来:旧疾易翻,也主动手术或身边人身体之事', -1, '自身那一块被冲:旧毛病最容易在这一年翻出来,也可能是一次小手术或伴侣的身体状况', 0,
      `流年支${z}冲日支${dz}:自身宫受冲,旧疾易翻、也主动手术或身边人身体之事`);
    if (isYangren) add('jiankang', 1.2, '今年带着一股戾气:刀伤磕碰、火气上头,车马与利器慢着点', -1, '交通、利器、剧烈运动这三样这一年格外慢一点,火气上头先离开现场', 0,
      '羊刃现:刀伤磕碰、火气上头,车马与利器慢着点');
    if (xing) add('jiankang', 1.2, '今年凑齐了古法说的一组相刑:刑主折损,身体与人事两头都要慢', -1, '筋骨关节、牙口、旧伤这类「刑」的部位先亮灯,别拖着不看', 0,
      `${xing}:刑主折损,身体与人事两头都要慢`);
    if (gTag === '忌' && zTag === '忌') add('jiankang', 1, '今年明面底下两股力都在耗你:整年逆水,先保身体再谈别的', -1, null, 0,
      '流年干支全是你的忌神:整年逆水,先保身体再谈别的');

    // ——— 是非官非 ———
    if ((gCls === '官杀' || zCls === '官杀') && isYangren) add('guanfei', 2, '压力之力撞上一股戾气:争执升级之象,忍口舌、别硬顶', -1, '争执最容易升级成事故:这一年少表态、少接茬,该低头就低头', 0, '官杀逢羊刃:争执升级之象,忍口舌、别硬顶');
    if (xing) add('guanfei', 1.5, '今年凑齐了古法说的一组相刑:刑主纠缠,合同、口头承诺留凭据', -1, '纠缠之象:合同、转账、口头承诺一律留凭据,别在这一年打官司', 0,
      `${xing}:刑主纠缠,合同、口头承诺留凭据`);
    const hasGuan = ['year', 'month', 'hour'].some(k => SHISHEN_CLASS[shen(chart, chart.pillars[k].gan)] === '官杀');
    if (gCls === '食伤' && shen(chart, g) === '伤官' && hasGuan) add('guanfei', 1.5, '你身上那股锋芒撞上管你的人:顶撞上位者、文书出岔的老象,该低头时低头', -1, '最容易跟管你的人杠上:邮件写清楚、话说三分,这一年别赌一口气', 0, '伤官见官:顶撞上位者、文书出岔的老象,该低头时低头');

    return { cats, flags, flagsTech, gShen, zShen, gTag, zTag, chongDay, chongMonth, heDay, isKong, daYunFlag };
  }

  // 年龄闸门:九岁的孩子不该被断「姻缘」,二十岁的人不该被断「子女出生」。
  // 断流年不看年龄阶段,是命理软件最常见的笑话之一——本表按年龄段筛事型,
  // 童限则把财官姻缘一路的证据折回「家境/父母」这条线上说。
  const AGE_GATE = {
    yinyuan: [16, 99], shiye: [16, 99], caiyun: [16, 99], zinv: [20, 99],
    wenshu: [0, 99], biandong: [0, 99], jiankang: [0, 99], guanfei: [12, 99],
  };
  function ageFilter(cats, age) {
    const out = {};
    let childBucket = null;
    for (const k of Object.keys(cats)) {
      const [lo, hi] = AGE_GATE[k] || [0, 99];
      if (age >= lo && age <= hi) { out[k] = cats[k]; continue; }
      if (age < lo && ['yinyuan', 'shiye', 'caiyun', 'zinv'].includes(k)) {
        // 未到年纪的财官姻缘之应,折算成家境与父母那一路(减半计分)
        childBucket = childBucket || { score: 0, reasons: [], techs: [], dirSum: 0, tips: [], folded: true };
        childBucket.score += cats[k].score * 0.5;
        childBucket.dirSum += cats[k].dirSum * 0.5;
        (cats[k].tips || []).forEach(x => childBucket.tips.push({ w: x.w * 0.5, tip: x.tip }));
        cats[k].reasons.forEach(r => childBucket.reasons.push(r));   // 注脚只在末尾说一次,不逐条重复
        (cats[k].techs || []).forEach(r => childBucket.techs.push(r));
      }
    }
    if (childBucket) {
      out.jiajing = out.jiajing || { score: 0, reasons: [], techs: [], dirSum: 0 };
      out.jiajing.score += childBucket.score;
      out.jiajing.dirSum += childBucket.dirSum;
      childBucket.reasons.slice(0, 4).forEach(r => out.jiajing.reasons.push(r));
      out.jiajing.reasons.push('(以上皆未到本人应事之年,一律折半归到家中长辈这一路看)');
      childBucket.techs.slice(0, 4).forEach(r => out.jiajing.techs.push(r));
      out.jiajing.techs.push('(以上皆未到本人应事之年,一律折半归到家中长辈这一路看)');
      out.jiajing.tips = (out.jiajing.tips || []).concat(childBucket.tips || []);
    }
    return out;
  }

  // 该年主事型与一句人话结论
  function nodeText(chart, year, age, gz, ev, top) {
    const good = top.dirSum > 0;             // 方向由该事型自己的证据定,不拿全年干支硬套
    const neutral = Math.abs(top.dirSum) < 0.6;
    const K = top.key;
    const S = {
      // 姻缘:方向这一层由处境定(见 yearEvidence 里那段实测)。没填处境就把两条路都摆出来,不替人选。
      yinyuan: top.held
        ? '感情上动得最重的一年:眼下单身的,这一动八成往结合上走——见家长、订婚、领证挑这一年办;眼下有伴的,同一股力多半使在摩擦与聚散上,该摊开的话别拖过年底。是哪一条,看你此刻的处境,不看命盘'
        : (neutral ? '感情起变化的年份:合与散的力都在,单身的容易遇上人、有主的容易起摩擦——这年别把话憋着,摊开谈就能定方向'
          : (good ? '感情落定的窗口:从遇上到谈定的节奏会明显快起来,见家长、订婚、领证这类事挑这一年办'
            : '感情起波的年份:该谈的摊开谈,冷战拖延最伤;有对象的把话说清,没对象的别在这年仓促定终身')),
      shiye: neutral ? '事业换轨的年份:岗位、公司、常驻地都可能动,自己先挑好下一步,别等通知'
        : (good ? '事业往上走的年份:该争的位子、该接的担子别推,主动报名比等着被点名管用'
          : '事业压担子的年份:被管、被挑刺、活儿变重是常态,守住本职别硬顶,熬过去就是资历'),
      caiyun: neutral ? '钱上进出都大的年份:进得来也留不住,收支两头都要记账,大额决定拖过这一年再说'
        : (good ? '进财的年份:正路收入和额外机会都在,该谈的价、该签的单往这年靠'
          : '漏财的年份:合伙、借贷、投机三样最容易出事,大额支出往后压,合同条款写死'),
      wenshu: good ? '文书学业得力的年份:考试、评职称、拿证、签合同、置产,这条线办什么成什么'
        : '文书易反复的年份:合同房产多看两遍,想得多做得少是这年最大的坑',
      biandong: '动的年份:换城市、换岗位、换住处、频繁出差都可能,别硬顶着不动,顺势挪反而省力',
      zinv: neutral ? '家里事多的年份:添丁与操心两头的信号都有,家里的安排早定早省心'
        : (good ? '家里添人添喜的年份:生育、小辈升学、长辈大事,重心往家里挪一挪'
          : '家人牵扯精力的年份:老人身体、小辈状况都要多分心,提前安排别等急事'),
      jiankang: '身体亮灯的年份:旧疾复动、劳损、意外磕碰这几样最先来,体检别拖、作息硬性调',
      guanfei: '是非缠身的年份:口舌、合同纠纷、跟上位者顶撞,留凭据、少表态、别在这年打官司',
      jiajing: good ? '家里顺遂的年份:父母长辈这条线有好消息,家境或住处往好里变'
        : '家里操心的年份:父母长辈的身体、工作、住处容易生变,这段的起落多半不由自己',
    };
    // 年限论:同一组信号,三十岁与七十岁应的不是同一件事,断语须随年岁落地
    const AGE_NOTE = {
      jiankang: age < 30 ? '这个岁数多半是熬出来的——作息、久坐、运动损伤这一路'
        : age < 45 ? '这个岁数常应在腰颈、肝胆与代谢指标上'
          : age < 60 ? '到了盯血压血糖血脂的年纪,指标别只看不管'
            : '这个岁数首防骨关节与心脑,跌倒和季节交替最要紧',
      shiye: age < 30 ? '这个岁数是打底子的阶段,吃亏也换得到本事'
        : age < 45 ? '正是升迁与转型的窗口期,错过要多等一轮'
          : age < 60 ? '到了守成与带人的阶段,把位子坐稳比冲更值'
            : '这个岁数多应在返聘、顾问、余热这一路',
      yinyuan: age < 32 ? '这个岁数多应初婚或定下来'
        : age < 50 ? '这个岁数多应婚内的进退,或是再一次的开始'
          : '这个岁数应的是相守与陪伴这一层,不必往轰烈里想',
      zinv: age < 40 ? '这个岁数多应生育与小辈的事' : '这个岁数多应长辈的身体与小辈的前程',
      caiyun: age < 30 ? '本钱薄,一次踩空要还很久' : age < 55 ? '正是攒本与放本的年纪,进退都要算清' : '这个岁数守住本金比多赚要紧',
    }[K];
    const base = (S[K] || '这一年有明确的动向,依据见下。') + (AGE_NOTE ? `(${age}岁:${AGE_NOTE})` : '');
    // 具体到事:取该年权重最高的两条信号自带的做法,断语因此随年份而变,不再套同一句模板
    const tips = (top.tips || []).slice().sort((a, b) => b.w - a.w).map(x => x.tip);
    const uniq = [];
    for (const x of tips) if (!uniq.includes(x)) uniq.push(x);
    return uniq.length ? `${base}。具体到事:${uniq.slice(0, 2).join(';')}。` : base + '。';
  }

  // ——— 流月:年定其事,月定其期 ———
  // 大运定十年、流年定一年、流月定月份——只报到年份,应期就还差一层。
  // 节气月为界:取每个公历月 20 日读月柱(必在该月节气之后),再回扫求起始日,得准确区间。
  // 月名按月支定(节气月),不按公历月序——公历一月中旬多半还是丑月(腊月)
  const ZHI_MONTH = { 寅: '正月', 卯: '二月', 辰: '三月', 巳: '四月', 午: '五月', 未: '六月', 申: '七月', 酉: '八月', 戌: '九月', 亥: '十月', 子: '冬月', 丑: '腊月' };
  function monthsOf(chart, year, dayunGz, opts) {
    const out = [];
    for (let m = 0; m < 12; m++) {
      const probe = new Date(year, m, 20, 12);
      const gz = Najia.ganZhi(probe).month;
      // 回扫求节气月起始日
      let startDay = 1;
      for (let d = 19; d >= 1; d--) {
        if (Najia.ganZhi(new Date(year, m, d, 12)).month !== gz) { startDay = d + 1; break; }
      }
      const ev = yearEvidence(chart, gz, dayunGz, opts);
      // 证据规则对年月通用,只有措辞得换口径:同一条规则用在流月上,不能还写「流年」「这一年」
      const toMonth = x => String(x).replace(/流年/g, '流月').replace(/这一年/g, '这个月').replace(/整年/g, '整月');
      const list = Object.keys(ev.cats).map(k => ({
        key: k, label: CATS[k].label, score: ev.cats[k].score, dirSum: ev.cats[k].dirSum,
        held: !!ev.cats[k].held, juSum: ev.cats[k].juSum || 0,
        nearScore: ev.cats[k].nearScore || 0, farScore: ev.cats[k].farScore || 0,
        reasons: ev.cats[k].reasons.map(toMonth),
        techs: (ev.cats[k].techs || []).map(toMonth),
        tips: (ev.cats[k].tips || []).map(t => ({ w: t.w, tip: toMonth(t.tip) })),
      })).sort((a, b) => b.score - a.score);
      const top = list[0] || null;
      out.push({
        idx: m + 1, gz, name: ZHI_MONTH[gz[1]] || '',
        span: `${m + 1}月${startDay}日起`,
        top, cats: list,
        flags: ev.flags.map(x => String(x).replace(/此年/g, '此月').replace(/之年/g, '之月')),
        flagsTech: (ev.flagsTech || []).map(x => String(x).replace(/此年/g, '此月').replace(/之年/g, '之月')),
        score: +((ev.gTag === '喜' ? 1 : ev.gTag === '忌' ? -1 : 0) + (ev.zTag === '喜' ? 1.2 : ev.zTag === '忌' ? -1.2 : 0)).toFixed(1),
        kong: ev.isKong,
      });
    }
    return out;
  }
  // 某一年里,该事型最应在哪几个月(应期落地)
  function hotMonths(months, catKey) {
    return months.filter(m => m.cats.some(c => c.key === catKey && c.score >= 2))
      .map(m => ({ idx: m.idx, gz: m.gz, span: m.span, score: m.cats.find(c => c.key === catKey).score }))
      .sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.idx - b.idx);
  }

  // 主函数:排一份大事年表
  // opts: { years: 推多少年(默认到 80 岁), nowYear, minScore }
  // 喂给模型的姻缘口径:方向留白这件事必须写进材料,否则模型会自己补一个吉凶上去
  const YY_HELD_NOTE = '【姻缘这一类的铁规矩】程序只算出「哪一年感情上动得最重、动多重」,**不给吉凶方向**——' +
    '因为回测量出来:同一股力,单身的多半往结合走、有伴的多半使在摩擦上,而这个人眼下是单身还是有伴,命盘算不出来。' +
    '所以写姻缘的年份时:①把年份和力度说死;②把两条路都写出来(单身会怎样、有伴会怎样),让他自己对号;' +
    '③**绝对不许自己补一个「这年感情大吉」或「这年必有波折」**——那是材料里没有的东西。';
  const YY_KNOWN_NOTE = m => `【姻缘这一类的口径】客人自述眼下${m}。程序据此把方向定为「${m === '单身' ? '这一动多半往结合上走' : '这一动多半使在摩擦与聚散上'}」。` +
    `写的时候要说清这一层是按他的处境推的,不是按命盘推的——命盘只定哪一年动。`;

  function timeline(chart, opts) {
    opts = opts || {};
    const birthYear = chart.birth.getFullYear();
    const nowYear = opts.nowYear || new Date().getFullYear();
    const maxAge = opts.maxAge || 80;
    const minScore = opts.minScore || 3.4;
    const dayun = chart.dayun;

    // 大运分段(含起止年份)
    const steps = dayun.list.map((d, i) => {
      const fromYear = Math.round(birthYear + d.fromAge);
      return {
        gz: d.gz, gan: d.gan, zhi: d.zhi, fromAge: d.fromAge,
        toAge: +(d.fromAge + 10).toFixed(1),
        fromYear, toYear: fromYear + 9,
        shen: shen(chart, d.gan),
        shenPlain: Bazi.plainShen(shen(chart, d.gan)),   // 铁律八:界面渲染这一份
        tag: tagOf(chart, GAN_WX[d.gan]),
        zhiTag: tagOf(chart, ZHI_WX[d.zhi]),
      };
    });
    steps.forEach(st => {
      const c = SHISHEN_CLASS[st.shen];
      const dir = (st.tag === '喜' || st.zhiTag === '喜') ? '得力' : (st.tag === '忌' && st.zhiTag === '忌') ? '吃力' : '半顺半阻';
      st.theme = `${st.gz}运(${st.fromYear}-${st.toYear},${Math.floor(st.fromAge)}-${Math.floor(st.toAge)}岁):走${st.shen},主${(CATS[clsToCat(c)] || { label: '综合' }).label}一路,整体${dir}`;
      st.dir = dir;
    });

    const dayunAt = y => {
      for (let i = steps.length - 1; i >= 0; i--) if (y >= steps[i].fromYear) return steps[i];
      return null;
    };

    const nodes = [], yearly = [];
    const startYear = Math.round(birthYear + dayun.startAge);
    const endYear = birthYear + maxAge;
    for (let y = startYear; y <= endYear; y++) {
      const gz = Najia.ganZhi(new Date(y, 5, 1, 12)).year;   // 取年中,必在立春之后,年柱以节气为界
      const st = dayunAt(y);
      const ev = yearEvidence(chart, gz, st ? st.gz : null, opts);
      const age = y - birthYear;
      const gated = ageFilter(ev.cats, age);
      const list = Object.keys(gated).map(k => ({ key: k, label: CATS[k].label, ...gated[k] }))
        .sort((a, b) => b.score - a.score);
      const top = list[0];
      const row = {
        year: y, age: y - birthYear, gz, dayunGz: st ? st.gz : '',
        top: top || null, cats: list, flags: ev.flags, flagsTech: ev.flagsTech || ev.flags,
        ganShen: ev.gShen, zhiShen: ev.zShen, ganTag: ev.gTag, zhiTag: ev.zTag,
        kong: ev.isKong,
      };
      yearly.push(row);
      const strong = ev.daYunFlag || (ev.heDay && top && top.key === 'yinyuan');
      if (top && (top.score >= minScore || strong)) {
        nodes.push(Object.assign({}, row, {
          text: nodeText(chart, y, y - birthYear, gz, ev, top),
          big: !!ev.daYunFlag,
        }));
      }
    }

    // 换运转折带(每步大运头一年,古法「交运前后一两年,人事必动」)
    const turns = steps.map(st => ({
      year: st.fromYear, age: Math.floor(st.fromAge), gz: st.gz,
      note: `${st.fromYear}年前后交${st.gz}运(${Math.floor(st.fromAge)}岁)——交运带上下一两年,人事环境按新运的路子重排,${st.dir}`,
    }));

    // 每步大运只留最重的三个节点(大动之年一律保留),否则一页几十条谁也看不动
    const byStep = {};
    for (const n of nodes) {
      const k = n.dayunGz || '_';
      (byStep[k] = byStep[k] || []).push(n);
    }
    const trimmed = [];
    for (const k of Object.keys(byStep)) {
      const arr = byStep[k].sort((a, b) => b.top.score - a.top.score);
      const keep = arr.filter(n => n.big).concat(arr.filter(n => !n.big).slice(0, 3));
      trimmed.push(...keep);
    }
    trimmed.sort((a, b) => a.year - b.year);

    const nextTen = yearly.filter(r => r.year >= nowYear && r.year < nowYear + 10);
    // 往年逐年细账:从起运那年一直排到去年。
    // 用户点名要的——「可以做一些 2026 以前的本人的运势」。
    // 这一段格外要紧:**已经发生过的年份,人自己知道对不对**,是这个程序唯一现成的反馈回路。
    const pastYears = yearly.filter(r => r.year < nowYear);
    // 只给要细看的年份算流月(节点年 + 近十年 + 往年);往年也算,人才对得上具体月份
    const needMonths = new Set(nextTen.map(r => r.year)
      .concat(trimmed.map(n => n.year)).concat(pastYears.map(r => r.year)));
    for (const r of yearly) {
      if (!needMonths.has(r.year)) continue;
      const st = dayunAt(r.year);
      r.months = monthsOf(chart, r.year, st ? st.gz : null, opts);
      r.hot = r.top ? hotMonths(r.months, r.top.key) : [];
    }
    for (const n of trimmed) {
      const src = yearly.find(r => r.year === n.year);
      if (src) { n.months = src.months; n.hot = src.hot; }
    }
    return {
      birthYear, startYear, startText: dayun.startText, forward: dayun.forward,
      steps, turns, nodes: trimmed, allNodes: nodes, yearly, nextTen, pastYears,
      marital: opts.marital || '',
      maritalNote: (opts.marital === '单身' || opts.marital === '有伴') ? YY_KNOWN_NOTE(opts.marital) : YY_HELD_NOTE,
      childhood: `起运之前(${birthYear}-${startYear - 1}年,${0}-${Math.floor(dayun.startAge)}岁)为童限——这段由你出生那个月的那组力管事,底色随父母家境走,不单独排流年大事。`,
      childhoodTech: `起运之前(${birthYear}-${startYear - 1}年,${0}-${Math.floor(dayun.startAge)}岁)为童限,按月柱管事:${chart.pillars.month.gz}——这段的底色随父母家境走,不单独排流年大事。`,
    };
  }
  function clsToCat(c) {
    return { 财星: 'caiyun', 官杀: 'shiye', 印星: 'wenshu', 比劫: 'caiyun', 食伤: 'wenshu' }[c] || 'shiye';
  }
  // 年干支(立春为界由调用方保证;此处按公元年推,与命理年一致)
  function ganZhiOfYear(y) {
    const gi = ((y - 4) % 10 + 10) % 10, zi = ((y - 4) % 12 + 12) % 12;
    return GAN[gi] + ZHI[zi];
  }

  // ——— 姻缘的两路应期(v0.84)———
  // far:「定下来」那一路,照旧按年报,门槛与年表节点同一个(3.4),**报出来的年份一个都不许变**。
  // near:「动一动」那一路,按**月**报未来 24 个月,门槛 2.0。
  //
  // 两条铁规矩:
  //   ① **不许为了让它更近而调高近档的分**。八条证据的权重一分没动(有冻结表钉着);
  //      近档报得近纯粹因为它触发得密(桃花年年有、六合三年一遇),不是因为我加了权。
  //   ② **方向照旧不给**(v0.77):这两路都只报「哪一年/哪几个月有动静」,不报是好是坏。
  //      单身的人问「什么时候能谈一个」,程序给窗口,**不承诺结果**。
  const NEAR_TH = 2.0, FAR_TH = 3.4, NEAR_MONTHS = 24;
  function romanceTracks(chart, opts) {
    const o = opts || {};
    const from = o.from instanceof Date ? o.from : new Date();
    const y0 = from.getFullYear(), m0 = from.getMonth() + 1;
    const years = o.years || 12;
    const birthYear = chart.birth.getFullYear();
    const dyAt = y => (chart.dayun.list || []).find(d => (y - birthYear) >= d.fromAge && (y - birthYear) < d.fromAge + 10);

    const far = [];
    for (let y = y0; y < y0 + years; y++) {
      const du = dyAt(y);
      const ev = yearEvidence(chart, ganZhiOfYear(y), du ? du.gz : null, o);
      const yy = ev.cats.yinyuan;
      if (!yy || yy.score < FAR_TH) continue;
      if ((yy.farScore || 0) <= 0) continue;              // 全靠近档凑够分的,不算「定下来」
      far.push({ year: y, age: y - birthYear, score: +yy.score.toFixed(1), farScore: yy.farScore,
        reasons: yy.reasons.slice(0, 3) });
    }
    const nearList = [];
    for (let k = 0; k < NEAR_MONTHS; k++) {
      const y = y0 + Math.floor((m0 - 1 + k) / 12), mi = ((m0 - 1 + k) % 12) + 1;
      const du = dyAt(y);
      const ms = monthsOf(chart, y, du ? du.gz : null, o);
      const m = ms.find(x => x.idx === mi);
      if (!m) continue;
      const yy = (m.cats || []).find(x => x.key === 'yinyuan');
      if (!yy || (yy.nearScore || 0) < NEAR_TH) continue;
      nearList.push({ year: y, month: mi, name: m.name, span: m.span,
        score: +(yy.nearScore || 0).toFixed(1), reasons: yy.reasons.slice(0, 2) });
    }
    // 诚实那一段:门槛低就报得密,这件事必须当面说,不能让人以为「报得多=看得准」
    const dens = nearList.length;
    return {
      near: nearList, far, nearTh: NEAR_TH, farTh: FAR_TH, span: NEAR_MONTHS,
      note: dens
        ? `「容易开始点什么」这一档报了未来两年里的 ${dens} 个月(约每 ${(NEAR_MONTHS / dens).toFixed(1)} 个月一次)。`
          + `它报得密,是因为这一档收的本来就是小事——桃花、配偶星引动这类年年都有;`
          + `**门槛低不等于看得准**,它只挑出「这几个月比别的月份活络」,不承诺那几个月一定会怎样。`
        : '未来两年里,这一档一个月都没挑出来——照实说没有,不硬凑一个。',
      heldNote: '这两路都只报什么时候有动静,**不报是好是坏**——那要看你眼下是单身还是有伴,'
        + '是处境定的,不是命盘定的。',
    };
  }

  // 交给 AI 的材料(结构化,断语已由程序算死,AI 只许解释不许另立结论)
  function material(chart, tl) {
    const nd = tl.nodes.slice(0, 24).map(n =>
      `${n.year}年(${n.age}岁,${n.gz}${n.dayunGz ? ',走' + n.dayunGz + '运' : ''}):主${n.top.label}(分${n.top.score.toFixed(1)})` +
      `${(n.hot || []).length ? ',应期落在' + n.hot.map(h => h.idx + '月(' + h.gz + ')').join('、') : ''}` +
      `——依据:${(n.top.techs || n.top.reasons).join(';')}${n.flagsTech.length ? ';另:' + n.flagsTech.join(';') : ''}`
    ).join('\n');
    const ten = (tl.nextTen || []).map(r =>
      `${r.year}年(${r.age}岁,${r.gz}):${(r.cats || []).slice(0, 3).map(c => c.label + c.score.toFixed(1)).join('、') || '无凸出信号'}` +
      `${(r.hot || []).length ? ';热月' + r.hot.map(h => h.idx + '月').join('、') : ''}`
    ).join('\n');
    const st = tl.steps.map(s => s.theme).join('\n');
    return `【人生大事年表(程序按大运流年算死,勿另立结论)】\n起运:${tl.startText},大运${tl.forward ? '顺' : '逆'}行。\n${tl.childhoodTech || tl.childhood}\n\n[大运分段]\n${st}\n\n[交运转折带]\n${tl.turns.map(t => t.note).join('\n')}\n\n[重要节点与依据]\n${nd}\n\n[近十年逐年(含热月)]\n${ten}\n\n【写法要求】按时间顺序讲这个人一生的关键年份会发生什么,每个节点必须落到具体的事(结婚/生子/换工作/买房/搬城市/破财/开刀/打官司这类看得见的事),给出年份与年龄,并说清这一年该做什么、别做什么;凡材料给了「应期落月」的,必须把月份说出来,不许只说年份。不许用「机遇与挑战并存」「顺其自然」这类空话,不许把十神、喜忌、干支这些名目写给客人看。
${tl.maritalNote}`;
  }

  return { timeline, yearEvidence, material, CATS, ganZhiOfYear, monthsOf, hotMonths, ZHI_MONTH,
    romanceTracks, NEAR_TH, FAR_TH };
}));
