// mingge.js — 命格取向:这人该吃哪碗饭、钱从哪条路来、地位靠什么立(v0.90,板块 G)
//
// 缘起:用户 2026-08-02——要能看出这人适合当官、适合做生意、适合手艺,也要能看出
// 「适合依附伴侣、通过伴侣得到财富」;「这都是真话你必须得要讲真话,不能以普世价值观、
// 或者怕引导错误就不说真话」;尺度上「水多欲望重这种,甚至更大的尺度都没关系,
// 角度可以接地气,解读一定要专业」。
//
// ── 断法依据(每条规则的出处逐字核过,存于各规则的 quote/src;核对靠 tests/mingge.test.mjs)──
// 《渊海子平》(简体转录):财官俱旺应显达于仕途 · 财禄生马为经商之客 · 土稼穡兮富贵经商 ·
//   杀官混杂乃技艺之流 · 重重生气若无官当作清高技艺看 · 官杀不来无爵禄总为技艺也孤寒 ·
//   水润下兮文学显达 · 金水双清而为道 · 火土混浊而为僧 · 财星得位因妻致富成家 ·
//   咸池更会日宫缘妻致富 · 支中有官无刑破者因妻发官 · 时上见财者必须入舍 ·
//   凡观阴命先观夫主之盛衰 · 财官印綬三般物女命逢之必旺夫 · 壬癸之水盛者聪明多智
// 《三命通会》(简体转录):财旺生官白身荣显 · 财旺夫荣 · 日主旺相夺夫权而孤苦
// 《滴天髓阐微》(简体转录):淫靡无礼者火不现水得地之故也 · 必聪明美貌而贞洁也 ·
//   轻佻美貌而多淫也 · 武职超群(陈提督、仓提督两命例判语,**由命例归纳,非条文明文,降半档标注**)
//
// ── 三档处置(策划书 §板块G 定死)──
//   ① 能直断的照说不打折(两书无争,如「水得地而火不现」——这是反对派《滴天髓》自己给的);
//   ② 两书打架的降为旁注,原话两边并排摆,不计分、不下断(照 v0.68 神煞打架的成例):
//      《渊海》主张拿咸池、财官过旺直断女命情事(财太多官杀太旺乃明暗夫集多 · 杀多则夫多 ·
//      支上咸池干带合风流浪荡破家儿 · 浊乱娼淫),《滴天髓》点名反对(桃花咸池专论女命邪淫
//      受责鬼神 · 不可轻断淫邪以渎神怒)——分歧当面摆,谁也不替谁说话;
//   ③ 职业倾向照说:钱从人情场来、常见于夜里活络的行当——这些是**事**,不是评价。
//
// ── 说真话的那条线(策划书原话)──
//   **结论一个字不软,道德词一个字不带。**「淫/贱/娼/不检点/水性杨花」不是预测,是明代的
//   价值判断,不能被验盘簿证伪;把它当事实端上来恰恰是一种不诚实。程序报的是事:
//   钱从哪条路来、关系那一层是什么格局、代价是什么。DIRTY 表钉着,tests 与 material 共用。
//
// ── §四:一个口径一处算 ──
//   只吃 Bazi.chart 算好的东西:强弱 chart.strength、喜忌 chart.yong、力量分 chart.wuxing、
//   十神 chart.pillars.*.ganShen/cang、合冲 chart.rel;五类归口 Bazi.SHISHEN_CLASS,
//   生克 Bazi.SHENG/KE,桃花驿马 Bazi.TAOHUA/YIMA/sanheIdx。**本模块不自算任何断法元素。**
//   门槛是本项目自拟的,逐个在注释里写明校准占比(3000 盘,tools 探针,2026-08)。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./bazi.js'), require('./najia.js'));
  } else { root.Mingge = factory(root.Bazi, root.Najia); }
}(typeof self !== 'undefined' ? self : this, function (Bazi, Najia) {

  const inv = (m, v) => Object.keys(m).find(k => m[k] === v);

  // 明代道德词禁表(tests 与 material 共用;引文除外——原话照抄不改字,由体检员剥引号后再扫)
  const DIRTY = ['淫', '贱', '娼', '不贞', '不检点', '水性杨花'];

  // 五类力量:把力量分(chart.wuxing,只此一份)按日主折成五类十神的力
  function shenPower(chart) {
    const dw = chart.dayWx, pw = chart.wuxing;
    return {
      印星: pw[inv(Bazi.SHENG, dw)], 比劫: pw[dw], 食伤: pw[Bazi.SHENG[dw]],
      财星: pw[Bazi.KE[dw]], 官杀: pw[inv(Bazi.KE, dw)],
    };
  }

  // 十神在盘面的「透与藏」:透干或本气藏才算立得住(官杀混杂按全部余气算会滥到 53%,校准后收紧)
  function presence(chart) {
    const P = chart.pillars;
    const strong = [];   // 透干或本气
    const weak = [];     // 中气余气
    for (const k of ['year', 'month', 'hour']) strong.push(P[k].ganShen);
    for (const k of ['year', 'month', 'day', 'hour']) {
      for (const c of P[k].cang) (c.qi === '本气' ? strong : weak).push(c.shen);
    }
    const has = (list, names) => names.some(n => list.includes(n));
    return {
      guan: has(strong, ['正官']), sha: has(strong, ['七杀']),
      guanAny: has(strong.concat(weak), ['正官', '七杀']),
      caiTou: has([P.hour.ganShen], ['正财', '偏财']),                      // 时上见财(透时干)
      caiDe: ['year', 'month', 'day', 'hour'].filter(k => P[k].cang[0] && ['正财', '偏财'].includes(P[k].cang[0].shen)),  // 财星得位(支本气)
      guanZhi: ['year', 'month', 'day', 'hour'].filter(k => P[k].cang.some(c => c.shen === '正官')), // 支中有官
    };
  }

  // 某柱有没有被冲/刑碰着(「支中有官无刑破」用)
  const POS_CN = { year: '年', month: '月', day: '日', hour: '时' };
  function hitByChongXing(chart, posKey) {
    const cn = POS_CN[posKey];
    return [...(chart.rel.chong || []), ...(chart.rel.xing || [])].some(s => s.slice(0, s.indexOf('·')).includes(cn));
  }

  // ══════════ 一、吃哪碗饭:六路逐条给分,每分都挂得出原话 ══════════
  // 分值是本项目自拟的排序器(写明可吵),**原话决定一条规则存不存在,分值只决定谁排前头**。
  function sixRoads(chart) {
    const sp = shenPower(chart), pr = presence(chart), pw = chart.wuxing, dw = chart.dayWx;
    const P = chart.pillars;
    const roads = [];
    const road = (key, name, score, ev) => roads.push({ key, name, score: Math.round(score), ev: ev.filter(Boolean) });

    // 官:仕途——「财官俱旺,应显达于仕途」(渊海)。财生官,两头都要旺。
    // **分值与凭据同源**:凭据挂不出来的盘,这一路就是零分——不许分数比凭据多说半个字。
    const guanScore = (sp.官杀 >= 20 && sp.财星 >= 20) ? Math.min(sp.官杀, sp.财星) * 2 : 0;
    road('guan', '仕途(体制、名分、管人的位子)', guanScore, [
      sp.官杀 >= 20 && sp.财星 >= 20 ? {
        plain: `名分那股力(${sp.官杀.toFixed(0)})与钱财那股力(${sp.财星.toFixed(0)})都立得住,钱养名、名生位,这是走编制与职级的底子`,
        tech: `官杀${sp.官杀.toFixed(1)} 财星${sp.财星.toFixed(1)},财生官为用`,
        quote: '财官俱旺，应显达于仕途', src: '渊海子平',
      } : null,
    ]);

    // 商:经商——「财禄生马,为经商之客」「土稼穡兮,富贵经商」(渊海)。
    const yiMa = Bazi.YIMA[Bazi.sanheIdx(P.year.zhi)];
    const maCai = ['year', 'month', 'day', 'hour'].some(k => P[k].zhi === yiMa &&
      (['正财', '偏财'].includes(P[k].ganShen) || P[k].cang.some(c => ['正财', '偏财'].includes(c.shen))));
    const jiaSe = dw === '土' && pw.土 >= 45;   // 校准:4.3%
    road('shang', '买卖(生意、行商、把东西变成钱)', (sp.财星 >= 25 ? sp.财星 * 1.4 : 0) + (maCai ? 15 : 0) + (jiaSe ? 30 : 0), [
      sp.财星 >= 25 ? {
        plain: `钱财那股力占${sp.财星.toFixed(0)},在这副盘里排得上号——钱认你,这是做买卖的本钱`,
        tech: `财星${sp.财星.toFixed(1)}`, quote: '财禄生马，为经商之客', src: '渊海子平',
      } : null,
      maCai ? {
        plain: '钱财那股力正落在跑动的位置上,越动越活——行商、跑码头、买卖做在路上',
        tech: `驿马${yiMa}临财`, quote: '财禄生马，为经商之客', src: '渊海子平',
      } : null,
      jiaSe ? {
        plain: '一盘土厚得成了格,古书把这一格直接断给了买卖:稳、能囤、守得住本',
        tech: `土${pw.土.toFixed(1)},稼穑之象`, quote: '土稼穡兮，富贵经商', src: '渊海子平',
      } : null,
    ]);

    // 技:手艺——三条都有原话(渊海)。
    const hunZa = pr.guan && pr.sha;            // 透干/本气两见,校准后约两成
    const yinNoGuan = sp.印星 >= 30 && !pr.guanAny;  // 校准:1.0%
    road('ji', '手艺(技术、专业、凭本事吃饭)', (hunZa ? 25 : 0) + (yinNoGuan ? 35 : 0) + (!pr.guanAny ? 18 : 0), [
      hunZa ? {
        plain: '管你的力来了两股、还不是一路的,名分立不稳——古书把这样的盘断给手艺:靠本事,不靠位子',
        tech: '正官七杀并见(透干/本气),官杀混杂', quote: '杀官混杂，乃技艺之流', src: '渊海子平',
      } : null,
      yinNoGuan ? {
        plain: '养你的力重重,管你的力一点没有——清高的手艺路:学问、技艺,自己是自己的招牌',
        tech: `印星${sp.印星.toFixed(1)}而官杀不见`, quote: '重重生气若无官，当作清高技艺看', src: '渊海子平',
      } : null,
      !pr.guanAny ? {
        plain: '整副盘没有管你的那股力,名分职级那条路基本没门——吃饭靠手艺,古书连后半句也说了:这条路钱薄,得攒',
        tech: '官杀全不见', quote: '官杀不来无爵禄，总为技艺也孤寒', src: '渊海子平',
      } : null,
    ]);

    // 文:文教——「水润下兮,文学显达」(渊海)。窄,只认水成润下之势。
    const runXia = dw === '水' && pw.水 >= 40;
    road('wen', '文教(读书、文字、学问显名)', runXia ? 40 + pw.水 / 2 : 0, [
      runXia ? {
        plain: `一盘水成了势(${pw.水.toFixed(0)}),古书把这一格断给文字与学问:名气从笔下来`,
        tech: `日主水,水${pw.水.toFixed(1)},润下之象`, quote: '水润下兮，文学显达', src: '渊海子平',
      } : null,
    ]);

    // 武/异路——**由《滴天髓阐微》两条命例判语归纳(陈提督、仓提督皆「以杀化印」),非条文明文,降半档**。
    const wuOk = sp.官杀 >= 30 && sp.印星 >= 20;   // 校准:5.5%
    road('wu', '武职异路(纪律部队、竞技、编制外搏名)', wuOk ? Math.min(sp.官杀, sp.印星) * 1.6 : 0, [
      wuOk ? {
        plain: '压着你的力很硬,但有一股力把它化成自己的底气——这样的盘古书两条命例都断给了武职:动真格的行当,越硬越出头',
        tech: `官杀${sp.官杀.toFixed(1)}而印星${sp.印星.toFixed(1)}化之,杀印相生`,
        quote: '以杀化印，所以武职超群', src: '滴天髓阐微(命例判语归纳,非条文明文)',
      } : null,
    ]);

    // 出世:清静饭——「金水双清而为道」「火土混浊而为僧」(渊海)。
    const jinShui = pw.金 + pw.水 >= 60 && pw.木 <= 12 && pw.火 <= 12 && pw.土 <= 12;  // 校准:0.8%
    const huoTu = pw.火 + pw.土 >= 60 && pw.金 <= 10 && pw.水 <= 10;                    // 校准:4.7%
    road('chu', '清静饭(修行、独修的学问、离热闹远的行当)', (jinShui ? 55 : 0) + (huoTu ? 42 : 0), [
      jinShui ? {
        plain: '整副盘只剩两股清气,别的都淡——古书把这样的盘断给了出世那一路:清静、独修、离买卖与官场都远',
        tech: `金${pw.金.toFixed(1)}水${pw.水.toFixed(1)}双清`, quote: '金水双清而为道', src: '渊海子平',
      } : null,
      huoTu ? {
        plain: '火土两股搅在一处、清的那头出不来——古书断的也是出世一路:热闹里安不下,清静处反而立得住',
        tech: `火${pw.火.toFixed(1)}土${pw.土.toFixed(1)}相混`, quote: '火土混浊而为僧', src: '渊海子平',
      } : null,
    ]);

    roads.sort((a, b) => b.score - a.score);
    return roads;
  }

  // ══════════ 二、钱从哪条路来 ══════════
  function moneyPaths(chart) {
    const sp = shenPower(chart), pr = presence(chart), P = chart.pillars;
    const items = [];
    const band = chart.strength.band;
    const bodyStrong = band === '身旺' || band === '偏旺';

    if (sp.官杀 >= 25 && sp.财星 >= 20) items.push({
      path: '正路的钱', tier: '直断',
      plain: '工资、职级、正经名分带来的钱是主道——钱那股力养着名分那股力,位子越稳钱越顺',
      tech: `财${sp.财星.toFixed(1)}生官${sp.官杀.toFixed(1)}`, quote: '财旺生官，白身荣显', src: '三命通会',
    });
    if (sp.财星 >= 30) items.push({
      path: '买卖的钱', tier: '直断',
      plain: '把东西变成钱的本事在——买卖、生意这条道走得通',
      tech: `财星${sp.财星.toFixed(1)}`, quote: '财禄生马，为经商之客', src: '渊海子平',
    });

    // 伴侣与人脉那一路——用户点名要说真话的那条,出处是硬的,照说。
    // **性别口径照原文分家,不许镜像**:「因妻致富」那几条是男命措辞(财=妻),
    // 女命走的是官星(夫)那一套,两套原话各有各的,套错了性别等于凭空造断语。
    const xcYear = Bazi.TAOHUA[Bazi.sanheIdx(P.year.zhi)];
    const partner = [];
    const maleSide = !chart.genderKnown || chart.gender === '男';
    if (maleSide && pr.caiDe.length) partner.push({
      plain: '钱财那股力坐得正——古书直断:成家与致富是一件事,伴侣本人就是财路的一半',
      tech: `财星得位(${pr.caiDe.map(k => POS_CN[k]).join('')}支本气)`, quote: '财星得位，因妻致富成家', src: '渊海子平(三命通会同文)',
    });
    if (maleSide && P.day.zhi === xcYear) partner.push({
      plain: '桃花正落在婚配的位置上——古书断得更直:这一格的富贵从伴侣身上来',
      tech: `咸池${xcYear}会日宫`, quote: '咸池更会日宫，缘妻致富', src: '渊海子平',
    });
    const guanOk = pr.guanZhi.filter(k => !hitByChongXing(chart, k));
    if (maleSide && guanOk.length) partner.push({
      plain: '名分那股力藏在支里、没被冲坏——身份地位有一半经由婚配那条线抬上去',
      tech: `支中有官(${guanOk.map(k => POS_CN[k]).join('')})无刑破`, quote: '支中有官无刑破者，因妻发官', src: '渊海子平',
    });
    if (maleSide && pr.caiTou) partner.push({
      plain: '钱财那股力露在最后一柱上——古书这一条断得最不客气:靠到伴侣那一头去,财路更顺,面子上的主次可以不要',
      tech: '时上见财', quote: '时上见财者，必须入舍', src: '渊海子平',
    });
    // 女命的同一路:官星为夫,财旺生夫,身不可太旺——三句都有明文,反向那句也有。
    if (chart.genderKnown && chart.gender === '女') {
      if (sp.官杀 >= 25 && sp.财星 >= 20 && !bodyStrong) partner.push({
        plain: '伴侣那股力立得住、钱又养着它,自己那股力不抢戏——地位与钱经由婚配上行,这条路在这副盘里是正道,不是退路',
        tech: `官(夫星)${sp.官杀.toFixed(1)} 财${sp.财星.toFixed(1)}生之,身${band}`,
        quote: '财官印綬三般物，女命逢之必旺夫', src: '渊海子平(另:凡观阴命，先观夫主之盛衰;财旺夫荣,三命通会)',
      });
      if (bodyStrong) partner.push({
        plain: '自己那股力太足,凡事亲自拿主意——靠伴侣抬的那条路在这副盘里走不顺,钱与地位得自己挣',
        tech: `身${band},夺夫星之权`, quote: '日主旺相，夺夫权而孤苦', src: '三命通会',
      });
    }
    if (partner.length) items.push({
      path: '伴侣与人脉带来的钱', tier: '直断',
      plain: partner[0].plain, tech: partner.map(p => p.tech).join(';'),
      quote: partner[0].quote, src: partner[0].src, more: partner.slice(1),
      note: (!chart.genderKnown ? '性别没填:这一路古书男女两套口径(男按财=妻、女按官=夫),上面按男命那套摆;女命那套要填了性别才给,不硬猜。' : ''),
    });

    if (!pr.guanAny && sp.食伤 >= 20) items.push({
      path: '手艺换的钱', tier: '直断',
      plain: '钱靠本事一份份换——古书把丑话也说在前头:这条路孤,钱薄,靠攒不靠涌',
      tech: `官杀不见,食伤${sp.食伤.toFixed(1)}`, quote: '官杀不来无爵禄，总为技艺也孤寒', src: '渊海子平',
    });
    if (!items.length) items.push({
      path: '没有哪条独大', tier: '直断',
      plain: '这副盘钱路不偏科,哪条都不独大——钱跟着大运流年走,哪段旺哪段的路,去运势页看年月',
      tech: '财官食伤俱不过阈', quote: '', src: '',
    });
    return items;
  }

  // ══════════ 三、直断层(两书无争,照说不打折) ══════════
  function directReads(chart) {
    const sp = shenPower(chart), pw = chart.wuxing, band = chart.strength.band;
    const out = [];
    // 水得地而火不现(滴天髓——反对派自己给的五行断法,两书无争)。校准:5.5%(水≥35,火≤6)。
    if (pw.水 >= 35 && pw.火 <= 6) out.push({
      key: '水得地火不现', tier: '直断',
      plain: `一盘水占了大头(${pw.水.toFixed(0)})、火几乎不见(${pw.火.toFixed(0)})——欲望重,情事上花的心思多,不爱受拘束。这股劲用对了是魅力与闯劲,由着它走就是耗:钱与感情都容易从热闹场里过手,过手不留`,
      tech: `水${pw.水.toFixed(1)}得地,火${pw.火.toFixed(1)}不现`,
      quote: '淫靡无礼者，火不现，水得地之故也', src: '滴天髓阐微',
    });
    // 伤官三档(滴天髓成对原文)。
    if (sp.食伤 >= 30) {
      const yinOk = (band === '偏弱' || band === '身弱') && sp.印星 >= 15;
      const caiOk = (band === '身旺' || band === '偏旺') && sp.财星 >= 15;
      if (yinOk || caiOk) out.push({
        key: '锋芒有托', tier: '直断',
        plain: '锋芒重,又有东西接得住它——聪明、相貌出众,而且稳得住:出彩归出彩,不轻易失手',
        tech: `食伤${sp.食伤.toFixed(1)},${yinOk ? '身弱有印' : '身旺有财'}`,
        quote: '必聪明美貌而贞洁也', src: '滴天髓阐微',
      });
      else if (sp.食伤 >= 35) out.push({
        key: '锋芒无托', tier: '直断',
        plain: '锋芒重,没东西接——相貌出众、招人,也招事:情事上心思多、来得快去得也快,说话容易顶到人。要害不在收敛,在给这股劲找个出口:作品、台面、手艺,哪个都行',
        tech: `食伤${sp.食伤.toFixed(1)}而印财俱不足`,
        quote: '轻佻美貌而多淫也', src: '滴天髓阐微(原文之词照录于此,断语只说事)',
      });
    }
    // 场上饭(v0.92 补:策划书第③档「职业倾向照说」当初漏落实)——
    // 水得地火不现、或桃花坐婚配之位而财旺:钱从人情场、酒场、夜里活络的场合来。
    // 「路伎商贾,须观落地之财」是渊海的明文;说的是钱怎么来,是事,不是评价。
    {
      const xcY = Bazi.TAOHUA[Bazi.sanheIdx(chart.pillars.year.zhi)];
      const chang = (pw.水 >= 35 && pw.火 <= 6) || (chart.pillars.day.zhi === xcY && sp.财星 >= 30);
      if (chang) out.push({
        key: '场上饭', tier: '职业倾向',
        plain: '这一路的钱容易从人情场、酒场、夜里活络的场合来——演出、陪谈、场面上的行当都在这一路。挣得快也散得快,古书教的看法就一条:看落到手里的,不看过手的',
        tech: `${pw.水 >= 35 && pw.火 <= 6 ? '水得地火不现' : `咸池${xcY}会日宫且财${sp.财星.toFixed(1)}`}`,
        quote: '路伎商贾，须观落地之财', src: '渊海子平',
      });
    }
    // 水盛聪明(渊海,此半句两书无争;后半句「女多淫滥」在打架区,进旁注)。
    if ((chart.dayGan === '壬' || chart.dayGan === '癸') && pw.水 >= 35) out.push({
      key: '水盛多智', tier: '直断',
      plain: '脑子快、心思活,一点就透——这是这副盘里最值钱的本钱',
      tech: `壬癸日主,水${pw.水.toFixed(1)}`, quote: '壬癸之水盛者，聪明多智', src: '渊海子平',
    });
    return out;
  }

  // ══════════ 三之二、关系格局层(v0.92 新增:结构路直断)与相貌层 ══════════
  //
  // 【升档的道理,写在明处】策划书原把「明暗夫集多」「杀多则夫多」归进两书打架的旁注,
  // v0.92 核原文时发现作战地图画错了半张:《滴天髓》自己也给结构清单——
  // 「满局伤官无财者;满局官星无印者…」逐条列在「不可轻断」那一段**前面**。
  // 即它反对的是**神煞路**(「桃花咸池,专论女命邪淫,受责鬼神」)与**轻断**,不反对结构断——
  // 它自己就在结构断。所以:**财官结构的关系格局,两本书不打架,升为直断**;
  // 咸池桃花那一路照旧旁注。升档必须连它的两句告诫一起带上(GUANXI_CAUTION),一条不许省。
  //
  // 【各层各断,不许串】用户点名的规矩:关系那一层是什么格局,**不折损钱、地位、相貌那几层**——
  // 各是各的账。这一句进每次输出,也进 material 的写法铁规。
  const GUANXI_CAUTION = '书上把丑话说在前:这一层不可轻断、也不可一例言命——同一副格局,处境、家门、行当都能改它的走法' +
    '(《滴天髓阐微》原话「不可轻断淫邪，以渎神怒」「然亦不可一例言命」)。这里说的是格局与代价,不是给人定性。';
  const GUANXI_SPLIT = '这一层说的只是关系的格局——钱、地位、相貌各是各的账,别的层怎么断还怎么断,不因这一层打折。';
  function guanxiReads(chart) {
    const sp = shenPower(chart), pr = presence(chart), P = chart.pillars;
    const out = [];
    if (!chart.genderKnown) return { items: [], note: '性别没填:关系格局这一层古书男女两套条文(女看官杀为夫、男看财星为妻),不硬猜,填了才给。' };
    const fem = chart.gender === '女';
    if (fem) {
      // R1 财太多官杀太旺(校准 0.3%):两股都过了头——明暗并存。
      if (sp.财星 >= 35 && sp.官杀 >= 35) out.push({
        key: '明暗并存', tier: '直断',
        plain: '关系那一层热闹:明里暗里的人都不缺,名分内的与名分外的并存——盘面结构如此,这是格局不是行为评价。代价也直说:名分那条线越晚理清越贵',
        tech: `财${sp.财星.toFixed(1)} 官杀${sp.官杀.toFixed(1)},两旺`,
        quote: '财太多，官杀太旺，乃明暗夫集多', src: '渊海子平(另:杀多则夫多)',
      });
      // R2 官弱不透而藏库、财旺(校准 4.3%)——用户点名的那个格局,原话是硬的。
      const kuZhi = Najia.MU_OF[inv(Bazi.KE, chart.dayWx)];   // 墓库表只此一份(najia)
      const kuCang = ['year', 'month', 'day', 'hour'].some(k => P[k].zhi === kuZhi && P[k].cang.some(x => ['正官', '七杀'].includes(x.shen)));
      if (sp.官杀 < 20 && !pr.guan && !pr.sha && kuCang && sp.财星 >= 25) out.push({
        key: '官弱有库', tier: '直断',
        plain: '名分上的男人弱,库里收着的不少——来的多在暗处、多半各有归属。这一格古书写得明白:明处一个,暗处一库。你的钱、地位、相貌不因此打折,那几层各是各的账',
        tech: `官杀${sp.官杀.toFixed(1)}不透而藏${kuZhi}库,财${sp.财星.toFixed(1)}`,
        quote: '明有戊土为正夫，暗有辰戌为偏夫', src: '三命通会(同章:夫星明暗交集)',
      });
      // R3a 满局官星无印(滴天髓自己的结构清单,校准 2.1%)
      if (sp.官杀 >= 40 && sp.印星 <= 8) out.push({
        key: '官重无化', tier: '直断',
        plain: '管束那股力满盘都是、没有东西替你消化——关系那一层压得重,来的都带着要管你的劲。挑人先挑肯不肯让你喘气的',
        tech: `官杀${sp.官杀.toFixed(1)}而印${sp.印星.toFixed(1)},满局官星无印`,
        quote: '满局官星无印者', src: '滴天髓阐微(其结构清单自列于「不可轻断」之前)',
      });
      // R3b 身旺夫绝官衰食盛(三命通会的结构定义,校准 0.7%)——场上立身那一格,照说。
      const band = chart.strength.band;
      if ((band === '身旺' || band === '偏旺') && sp.官杀 <= 10 && sp.食伤 >= 30) out.push({
        key: '场上立身', tier: '直断',
        plain: '自己旺、名分星近乎绝、才艺锋芒当家——古书把这一格点给了以色艺立身的行当:吃的是场子饭,名分难稳,钱照挣、名照有。走这一格,合同与账要自己攥',
        tech: `身${band},官杀${sp.官杀.toFixed(1)}绝而食伤${sp.食伤.toFixed(1)}盛`,
        quote: '身旺夫绝，官衰食盛', src: '三命通会(此章标题是明代的评语,本程序只取其结构条文)',
      });
    } else {
      // 男命镜像,原话各有各的(渊海):偏财一路。
      if (sp.财星 >= 35 && ['year', 'month', 'hour'].some(k => P[k].ganShen === '偏财')) out.push({
        key: '偏财当道', tier: '直断',
        plain: '钱与人两头都偏得动:名分内的那位未必留得住你的心思,外头的缘分与外快常常一起来——格局如此,代价是家里的账越拖越难算',
        tech: `财${sp.财星.toFixed(1)}而偏财透干`,
        quote: '出现偏财，少爱正妻偏爱妾', src: '渊海子平(另:偏财得位，妾胜于妻)',
      });
    }
    return { items: out, note: out.length ? GUANXI_CAUTION + ' ' + GUANXI_SPLIT : '' };
  }

  // 相貌层(v0.92 新增:三条硬出处,不分性别;容貌堂堂那条触发自拟,仍留在旁注)
  function maoReads(chart) {
    const sp = shenPower(chart), pw = chart.wuxing, P = chart.pillars;
    const out = [];
    if (sp.食伤 >= 30) out.push({
      key: '伤官秀气', plain: '聪明外露、相貌带秀气——人堆里认得出来的那种',
      tech: `食伤${sp.食伤.toFixed(1)}`, quote: '伤官主人聪明，美貌秀气', src: '渊海子平',
    });
    if (pw.金 >= 25 && pw.水 >= 25) out.push({
      key: '金水相逢', plain: '金水两旺的盘,古书直断长相:轮廓清、皮相好',
      tech: `金${pw.金.toFixed(1)} 水${pw.水.toFixed(1)}`, quote: '金水若相逢，必招美丽容', src: '渊海子平',
    });
    if (['year', 'month', 'day', 'hour'].filter(k => P[k].xingyun === '长生').length >= 2) out.push({
      key: '多带长生', plain: '盘里长生位带得多,古书拿西施作的比——底子里带着让人多看一眼的东西',
      tech: '四柱行运两处以上临长生', quote: '西施美貌，自身多带长生', src: '渊海子平',
    });
    return out;
  }

  // ══════════ 四、旁注层(两书打架,原话并排,不计分不下断——v0.68 成例) ══════════
  function sideNotes(chart) {
    const sp = shenPower(chart), P = chart.pillars;
    const xc = [Bazi.TAOHUA[Bazi.sanheIdx(P.year.zhi)], Bazi.TAOHUA[Bazi.sanheIdx(P.day.zhi)]];
    const xcHit = ['year', 'month', 'day', 'hour'].filter(k => xc.includes(P[k].zhi));
    const ganHe = (chart.rel.ganhe || []).length > 0;
    const notes = [];
    if (xcHit.length) notes.push({
      key: '桃花咸池', where: xcHit.map(k => POS_CN[k]).join(''),
      say: '盘里带桃花' + (ganHe ? ',天干又有合' : '') + '。这一层两本书正面打架,原话都在下面,谁也不替谁说话——本程序不拿它计分。',
      yh: [
        { quote: '支上咸池干带合，风流浪荡破家儿', src: '渊海子平' },
        { quote: '财太多，官杀太旺，乃明暗夫集多', src: '渊海子平' },
        { quote: '杀多则夫多', src: '渊海子平' },
      ],
      dt: [
        { quote: '桃花咸池，专论女命邪淫，受责鬼神', src: '滴天髓阐微' },
        { quote: '不可轻断淫邪，以渎神怒', src: '滴天髓阐微' },
      ],
    });
    // 容貌堂堂:引文有,起例原文没给——触发是自拟的(财官印俱立而身不弱),照规矩只作旁注。
    const band = chart.strength.band;
    if (sp.财星 >= 15 && sp.官杀 >= 15 && sp.印星 >= 15 && band !== '身弱') notes.push({
      key: '容貌堂堂', where: '',
      say: '三股力都立得住的盘,古书连着相貌与产业一起断。这一条引文是真的,但**怎么触发原文没写死,是本程序自拟的**,故只作旁注。',
      yh: [{ quote: '容貌堂堂多产业，官居廊庙作公卿', src: '渊海子平(触发条件自拟,出处只保引文)' }],
      dt: [],
    });
    return notes;
  }

  // ══════════ 汇总 ══════════
  function read(chart) {
    if (!chart) return null;
    const roads = sixRoads(chart);
    const money = moneyPaths(chart);
    const zhi = directReads(chart);
    const guanxi = guanxiReads(chart);
    const mao = maoReads(chart);
    const pang = sideNotes(chart);
    const top = roads[0], second = roads[1];
    const gap = top.score - (second ? second.score : 0);
    let verdict;
    if (top.score < 25) verdict = '六路没有哪一路明显占优——这副盘吃饭的路不定在格局上,定在大运流年上,哪段旺走哪段的路。';
    else verdict = `这碗饭最像:${top.name}(强度${top.score},比第二名${second ? second.name.slice(0, second.name.indexOf('(')) : ''}高${gap})。` +
      (gap < 10 ? '两条路咬得近,都摆出来,别只看第一条。' : '');
    return {
      shen: shenPower(chart), roads, money, zhi, guanxi, mao, pang, top, gap, verdict,
      honest: '这一板块的规矩:规则条条有原话(引文逐字核过),「哪条压过哪条」的排序分是本项目自拟的,零回测。' +
        '两本书打架的那一层只摆原话不下断。说的都是事——钱从哪来、哪条路顺、代价是什么;' +
        '成不成还要看大运流年与你自己的手。',
    };
  }

  // 喂模型的材料:程序算死,AI 只解释(§五)
  function material(chart) {
    const r = read(chart);
    if (!r) return '';
    let s = '【命格取向·程序推定(已算死,勿另立结论)】\n' + r.verdict + '\n';
    s += '六路强度:' + r.roads.map(x => `${x.name.slice(0, x.name.indexOf('('))}${x.score}`).join(' · ') + '\n';
    for (const road of r.roads.slice(0, 3)) {
      for (const e of road.ev) s += `— ${e.plain}(推演:${e.tech};原话「${e.quote}」《${e.src}》)\n`;
    }
    s += '【钱从哪条路来】\n';
    for (const m of r.money) {
      s += `— ${m.path}:${m.plain}` + (m.quote ? `(推演:${m.tech};原话「${m.quote}」《${m.src}》)` : '') + '\n';
      for (const p of (m.more || [])) s += `   另:${p.plain}(原话「${p.quote}」)\n`;
      if (m.note) s += `   ${m.note}\n`;
    }
    if (r.zhi.length) {
      s += '【直断(两书无争,照说不打折)】\n';
      for (const z of r.zhi) s += `— ${z.plain}(推演:${z.tech};原话「${z.quote}」《${z.src}》)\n`;
    }
    if (r.guanxi.items.length) {
      s += '【关系格局(结构路直断——两本书都给了结构条文;告诫一并带上)】\n';
      for (const g of r.guanxi.items) s += `— ${g.plain}(推演:${g.tech};原话「${g.quote}」《${g.src}》)\n`;
      s += r.guanxi.note + '\n';
    } else if (r.guanxi.note) s += '【关系格局】' + r.guanxi.note + '\n';
    if (r.mao.length) {
      s += '【相貌(有原话的三条,照说)】\n';
      for (const m2 of r.mao) s += `— ${m2.plain}(推演:${m2.tech};原话「${m2.quote}」《${m2.src}》)\n`;
    }
    for (const n of r.pang) {
      s += `【旁注·${n.key}(两书打架/触发自拟,不计分不下断)】${n.say}\n`;
      for (const q of n.yh) s += `   渊海一方:「${q.quote}」\n`;
      for (const q of n.dt) s += `   滴天髓一方:「${q.quote}」\n`;
    }
    s += '【写法铁规】①结论一个字不许比上面乐观或悲观;②只说事,不说那个年代的道德词——' +
      DIRTY.map(w => `「${w}」`).join('') + '一个不许出现(引用原文除外);' +
      '③直断层照说不打折,不许因为话不好听就绕开;旁注层只可摆原话,不许替两本书裁决;' +
      '关系格局那一层说的是格局与代价,**不折损钱、地位、相貌那几层——各层各断,不许串**;' +
      '它的两句告诫(不可轻断、不可一例言命)必须原样带给客人;' +
      '④禁空话禁说教,第一句就是答案;⑤' + r.honest;
    return s;
  }

  return { read, material, shenPower, sixRoads, moneyPaths, directReads, sideNotes, DIRTY };
}));
