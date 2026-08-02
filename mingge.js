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

  // 五类力量 → 该类的代表十神(叙事里要说人话,一律走 Bazi.SHEN_PLAIN 那张表,§四:不另写一套说法)
  const SHEN_HEAD = { 印星: '正印', 比劫: '比肩', 食伤: '食神', 财星: '正财', 官杀: '正官' };

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
    road('guan', '仕途(体制、公职、管理岗位)', guanScore, [
      sp.官杀 >= 20 && sp.财星 >= 20 ? {
        plain: `名分与钱财两类力量都立得住(名分${sp.官杀.toFixed(0)}、钱财${sp.财星.toFixed(0)}),钱能养名、位能聚钱——这是走体制、职级、正式名分的底子`,
        tech: `官杀${sp.官杀.toFixed(1)} 财星${sp.财星.toFixed(1)},财生官为用`,
        quote: '财官俱旺，应显达于仕途', src: '渊海子平',
      } : null,
    ]);

    // 商:经商——「财禄生马,为经商之客」「土稼穡兮,富贵经商」(渊海)。
    const yiMa = Bazi.YIMA[Bazi.sanheIdx(P.year.zhi)];
    const maCai = ['year', 'month', 'day', 'hour'].some(k => P[k].zhi === yiMa &&
      (['正财', '偏财'].includes(P[k].ganShen) || P[k].cang.some(c => ['正财', '偏财'].includes(c.shen))));
    const jiaSe = dw === '土' && pw.土 >= 45;   // 校准:4.3%
    road('shang', '经营(贸易、经商、商品流通)', (sp.财星 >= 25 ? sp.财星 * 1.4 : 0) + (maCai ? 15 : 0) + (jiaSe ? 30 : 0), [
      sp.财星 >= 25 ? {
        plain: `财在这副盘里分量靠前(${sp.财星.toFixed(0)}):对钱的机会敏感,经手买卖、定价、周转是你的本行方向`,
        tech: `财星${sp.财星.toFixed(1)}`, quote: '财禄生马，为经商之客', src: '渊海子平',
      } : null,
      maCai ? {
        plain: '财恰好落在主奔走的位置上,越流动越旺——适合行商、跨地域的买卖,生意做在路上比守店强',
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
    road('ji', '专业技术(技艺、专业能力立身)', (hunZa ? 25 : 0) + (yinNoGuan ? 35 : 0) + (!pr.guanAny ? 18 : 0), [
      hunZa ? {
        plain: '约束你的力量有两个来源、且互不统属,名分与职位难稳——古书把这样的命局判给专业技术:立身在专业能力,不在职位',
        tech: '正官七杀并见(透干/本气),官杀混杂', quote: '杀官混杂，乃技艺之流', src: '渊海子平',
      } : null,
      yinNoGuan ? {
        plain: '扶助之力厚重而约束之力全无——利于独立门户的专业路线:学问、技艺,以个人声誉为招牌',
        tech: `印星${sp.印星.toFixed(1)}而官杀不见`, quote: '重重生气若无官，当作清高技艺看', src: '渊海子平',
      } : null,
      !pr.guanAny ? {
        plain: '全盘不见官,体制与职级那条路基本无门——立身靠手艺;古书连后半句也说了:这条路钱来得薄,靠年头积累',
        tech: '官杀全不见', quote: '官杀不来无爵禄，总为技艺也孤寒', src: '渊海子平',
      } : null,
    ]);

    // 文:文教——「水润下兮,文学显达」(渊海)。窄,只认水成润下之势。
    const runXia = dw === '水' && pw.水 >= 40;
    road('wen', '文教(学术、文字、教育)', runXia ? 40 + pw.水 / 2 : 0, [
      runXia ? {
        plain: `一盘水成了势(${pw.水.toFixed(0)}),古书把这一格断给文字与学问:名气从笔下来`,
        tech: `日主水,水${pw.水.toFixed(1)},润下之象`, quote: '水润下兮，文学显达', src: '渊海子平',
      } : null,
    ]);

    // 武/异路——**由《滴天髓阐微》两条命例判语归纳(陈提督、仓提督皆「以杀化印」),非条文明文,降半档**。
    const wuOk = sp.官杀 >= 30 && sp.印星 >= 20;   // 校准:5.5%
    road('wu', '武职异路(纪律部队、竞技、高风险行业)', wuOk ? Math.min(sp.官杀, sp.印星) * 1.6 : 0, [
      wuOk ? {
        plain: '外来的压制很硬,而盘中另有一路力量能把这份压力转成自己的承受力——这样的命局古书两条命例都判给武职:对抗性强、有实际风险的行业,环境越严酷越占优',
        tech: `官杀${sp.官杀.toFixed(1)}而印星${sp.印星.toFixed(1)}化之,杀印相生`,
        quote: '以杀化印，所以武职超群', src: '滴天髓阐微(命例判语归纳,非条文明文)',
      } : null,
    ]);

    // 出世:清静饭——「金水双清而为道」「火土混浊而为僧」(渊海)。
    const jinShui = pw.金 + pw.水 >= 60 && pw.木 <= 12 && pw.火 <= 12 && pw.土 <= 12;  // 校准:0.8%
    const huoTu = pw.火 + pw.土 >= 60 && pw.金 <= 10 && pw.水 <= 10;                    // 校准:4.7%
    road('chu', '清静一路(修行、独立研究、低社交行业)', (jinShui ? 55 : 0) + (huoTu ? 42 : 0), [
      jinShui ? {
        plain: '整副盘只剩两股清气,别的都淡——古书把这样的盘断给了出世那一路:清静、独修、离买卖与官场都远',
        tech: `金${pw.金.toFixed(1)}水${pw.水.toFixed(1)}双清`, quote: '金水双清而为道', src: '渊海子平',
      } : null,
      huoTu ? {
        plain: '火土相混而全盘偏浊,利于安静求成的那部分力量被压住——古书判为出世一路:热闹场中难安,独处独修反而立得住',
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
      plain: '工资、职级、正式名分带来的钱是主道——财生官的结构,位置越稳钱越顺,跳出体制反而两头落空',
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
      plain: '财的位置得正——古书直断:成家与致富是同一件事,伴侣本人就是财路的一半',
      tech: `财星得位(${pr.caiDe.map(k => POS_CN[k]).join('')}支本气)`, quote: '财星得位，因妻致富成家', src: '渊海子平(三命通会同文)',
    });
    if (maleSide && P.day.zhi === xcYear) partner.push({
      plain: '桃花正落在婚配的位置上——古书断得更直:这一格的富贵从伴侣身上来',
      tech: `咸池${xcYear}会日宫`, quote: '咸池更会日宫，缘妻致富', src: '渊海子平',
    });
    const guanOk = pr.guanZhi.filter(k => !hitByChongXing(chart, k));
    if (maleSide && guanOk.length) partner.push({
      plain: '官星藏而不露、又没有被冲坏——身份地位有一半经由婚配这条线抬升',
      tech: `支中有官(${guanOk.map(k => POS_CN[k]).join('')})无刑破`, quote: '支中有官无刑破者，因妻发官', src: '渊海子平',
    });
    if (maleSide && pr.caiTou) partner.push({
      plain: '财显露在时辰这一柱上——古书这一条断得最不客气:靠向伴侣一方,财路更顺;面子上的主次之争可以放下',
      tech: '时上见财', quote: '时上见财者，必须入舍', src: '渊海子平',
    });
    // 女命的同一路:官星为夫,财旺生夫,身不可太旺——三句都有明文,反向那句也有。
    if (chart.genderKnown && chart.gender === '女') {
      if (sp.官杀 >= 25 && sp.财星 >= 20 && !bodyStrong) partner.push({
        plain: '配偶星立得住、又有财滋养,自身不与之争——地位与钱经由婚配上行,这条路在这副盘里是正道,不是退路',
        tech: `官(夫星)${sp.官杀.toFixed(1)} 财${sp.财星.toFixed(1)}生之,身${band}`,
        quote: '财官印綬三般物，女命逢之必旺夫', src: '渊海子平(另:凡观阴命，先观夫主之盛衰;财旺夫荣,三命通会)',
      });
      if (bodyStrong) partner.push({
        plain: '自身力量过强,凡事要亲自拿主意——靠伴侣抬升的那条路在这副盘里走不顺,钱与地位得自己挣',
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
      plain: '财源不集中于某一类途径,没有哪条独大——收入结构随大运流年变化,以当段得力的路径为主;具体年月见运势页',
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
      plain: `一盘水占大头(${pw.水.toFixed(0)})而火几乎不见(${pw.火.toFixed(0)})——欲望重,情事上花的心思多,不受拘束。这份能量用对了是魅力与闯劲,放任不管就是消耗:钱与感情都容易从热闹场合过手,过手不留`,
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
        plain: '锋芒重而缺少固定出口——相貌出众、招人,也招是非:情事上心思多、来得快去得也快,说话容易顶撞。要害不在收敛,在给锋芒找一个固定出口:作品、舞台、手艺,任一个都行',
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
        plain: '满盘都是管束的力量,而没有化解的一环——感情关系普遍压得重,来的人多半带着支配欲。择人第一条标准:处得下来的前提是对方肯给你留空间',
        tech: `官杀${sp.官杀.toFixed(1)}而印${sp.印星.toFixed(1)},满局官星无印`,
        quote: '满局官星无印者', src: '滴天髓阐微(其结构清单自列于「不可轻断」之前)',
      });
      // R3b 身旺夫绝官衰食盛(三命通会的结构定义,校准 0.7%)——场上立身那一格,照说。
      const band = chart.strength.band;
      if ((band === '身旺' || band === '偏旺') && sp.官杀 <= 10 && sp.食伤 >= 30) out.push({
        key: '场上立身', tier: '直断',
        plain: '自己旺、官星近绝、才艺锋芒当家——古书把这一格点给了以色艺立身的行当:立身在场面上,名分难稳,钱照挣、名照有。走这一格,合同与账目必须握在自己手里',
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

  // ══════════ 三之三、竞争层(v0.97:雄竞雌竞,男女都做,客观直说)与顶路叙事 ══════════
  // 用户点名:「不要避讳雄竞雌竞,有一说一,要客观」。出处全是硬的:
  //   女——「姊妹透出,便见争夫」(渊海);胜负判据「本身自旺,彼身值衰…我正而彼偏」(三命·正偏自处);
  //   男——「劫财败财,主剋父母及剋妻、破财争斗之事」(渊海);
  //   策略——三命把打法写到反直觉那层:「用财不宜明露,柱见比劫,则宜透出,使人共见则不能夺;
  //   赋云:财宜藏,藏则丰厚,露则浮荡」——有人抢时亮出来确权,没人抢才闷声攒。
  function jingzhengReads(chart) {
    const sp = shenPower(chart), P = chart.pillars;
    const band = chart.strength.band;
    const bodyStrong = band === '身旺' || band === '偏旺';
    const bijieTou = ['year', 'month', 'hour'].some(k => ['比肩', '劫财'].includes(P[k].ganShen));
    const bijieOn = sp.比劫 >= 25 || bijieTou;
    const out = [];
    if (!chart.genderKnown) return { items: [], note: bijieOn ? '盘上有同辈竞争的配置,但男女的争点不同(女命争的是名分,男命的财与伴侣都在竞争范围内)——性别没填,不硬断。' : '' };
    const fem = chart.gender === '女';
    if (bijieOn && fem) {
      out.push({
        key: '雌竞明摆', tier: '直断',
        plain: '竞争方多为身边同层次的女性,位置与伴侣两处都在竞争范围内——这是盘面上明确的结构,与个人品行无关',
        tech: `比劫${sp.比劫.toFixed(1)}${bijieTou ? '且透干' : ''}(女)`,
        quote: '姊妹透出，便见争夫', src: '渊海子平',
      });
      out.push(bodyStrong ? {
        key: '竞而能胜', tier: '直断',
        plain: '古书给的胜负判据:根基旺的一方得正位,衰的一方退居偏处。你根基旺——正面把名分拿下,不打消耗战:名分一经确定(公开、确立关系、职位坐实),竞争的基础即不存在',
        tech: `身${band},自旺者正`,
        quote: '若本身自旺，彼身值衰，四柱不冲，则我正而彼偏矣', src: '三命通会(正偏自处章)',
      } : {
        key: '竞则避正', tier: '直断',
        plain: '古书给的胜负判据:根基旺的一方得正位。你目前根基不占优,正面消耗不划算——对策是错开:换场合、换时机,或等自己走强的阶段(下一节写明哪步大运对你有利)再正面争',
        tech: `身${band},衰者偏,须避其锋`,
        quote: '若本身自旺，彼身值衰，四柱不冲，则我正而彼偏矣', src: '三命通会(正偏自处章)',
      });
    }
    if (bijieOn && !fem) {
      out.push({
        key: '雄竞明摆', tier: '直断',
        plain: '古法里钱与伴侣同属「财」——竞争方是身边同层次的男性:合伙分账、竞标抢单、感情上被抢先,出自同一处配置',
        tech: `比劫${sp.比劫.toFixed(1)}${bijieTou ? '且透干' : ''}(男)`,
        quote: '名曰劫财败财，主剋父母及剋妻、破财争斗之事', src: '渊海子平',
      });
      out.push({
        key: '亮财确权', tier: '直断',
        plain: '书上给的对策与直觉相反:有竞争方时,财反而要公开确权——钱走明账、关系定名分、项目落合同;权属公开即难以被夺,隐匿反而留出被侵占的空间',
        tech: '柱见比劫,宜透出',
        quote: '用财不宜明露，柱见比劫，则宜透出，使人共见则不能夺', src: '三命通会',
      });
    }
    if (!bijieOn && sp.财星 >= 25 && !fem) {
      out.push({
        key: '藏财自厚', tier: '直断',
        plain: '盘上没有明显的竞争方——这种配置宜藏财:少展示、少许诺、低调积累;财一旦外露,反而招来不必要的事端',
        tech: `比劫${sp.比劫.toFixed(1)}弱而财${sp.财星.toFixed(1)}`,
        quote: '财宜藏，藏则丰厚，露则浮荡', src: '三命通会',
      });
    }
    return { items: out, note: out.length ? '这一层说的是竞争的格局与打法——谁在抢、怎么争、代价是什么;不评好坏,像下棋只讲棋理。' : '' };
  }

  // 顶路因果链叙事(v0.97):把「为什么是这碗饭」讲成一条推理,不是并列的碎句。
  // 病根是用户点破的:并列短句一眼 AI。这里按 底盘→为什么→几时发力→代价 四段串,连词写死因果。
  const ROAD_COST = {
    guan: '这条路的代价:靠资历与合规推进,前半程慢;名分带来的权限,同样受规矩约束',
    shang: '这条路的代价:收入起伏是常态,担保与垫资是最常见的两类损失来源——账目必须自己掌握,不替人背债',
    ji: '这条路的代价:收入增长靠积累,起薄、名声来得慢;技能属于个人,不随平台或职位变动流失',
    wen: '这条路的代价:机会窗口窄、受时运影响大,成名之前有较长的低回报期',
    wu: '这条路的代价:以身体与风险换取位置,伤病与责任事故需要事先留出余地',
    chu: '这条路的代价:亲缘淡、人际圈比常人窄,这既是这条路的收益也是它的成本',
  };
  function narrate(chart, roads, age) {
    const top = roads[0];
    if (!top || top.score < 25) return '';
    const sp = shenPower(chart);
    let s = `先看命局基础:你本人的力量${Bazi.plainBand(chart.strength.band)},` +
      `五类力量里最重的是${Bazi.plainShen(SHEN_HEAD[Object.entries(sp).sort((a, b) => b[1] - a[1])[0][0]])}这一类。`;
    // 连词只连真依赖:命局的厚薄推不出「财重」「官杀混杂」这类独立观测,硬安「因为」是假推理
    // (v0.98 评审点名)。这里用「同时」承接观测,再用「两者叠加…所以」收束到结论——这一步才是真链条。
    s += `同时,${top.ev.length ? top.ev[0].plain.split('——')[0] : '六路的凭据集中在这一路'};` +
      `两者叠加,适合的方向落在「${top.name.slice(0, top.name.indexOf('('))}」——此结论由盘面推出,非人为选定。`;
    // 发力窗:第一步喜用之运
    const list = (chart.dayun && chart.dayun.list) || [];
    let fw = null;
    for (const d of list) {
      const gw = Bazi.GAN_WX[d.gz[0]], zw = Bazi.ZHI_WX[d.gz[1]];
      if (chart.yong.xiWx.includes(gw) || chart.yong.xiWx.includes(zw)) { fw = d; break; }
    }
    if (fw) s += `${fw.fromAge}岁起的十年,大运走的是对你有利的五行,是这条路最有利的十年` +
      (age != null && age > fw.fromAge + 10 ? '(这一段你已走过,下一个有利的十年见运势页的大运分段)' : ',在此之前以积累为主') + '。';
    else if (chart.dayun && chart.dayun.unknown) s += '起效时间要看大运,而大运缺性别排不出——补上性别后这一层才有结论。';
    s += ROAD_COST[top.key] || '';
    return s;
  }

  // ══════════ 三之四、大运走哪条路(v0.99)══════════
  // 缘起:六路都不占优时,原先只说一句「由大运流年决定,以当段得力的路径为主」——
  // 这句话对任何人都成立,且**答案就在已经排好的大运里**,却推给别页。评审点名为「缺结论缺时间」。
  // 修法:把未来三步大运各自旺哪条路、起讫哪一年,当场算出来摆上。
  // 口径:大运天干与地支本气各取十神,归五类(Bazi.SHISHEN_CLASS,§四只此一份),再按五类→路。
  const CLASS_ROAD = {
    官杀: { key: 'guan', say: '体制、公职与管理岗' },
    财星: { key: 'shang', say: '经营与买卖' },
    食伤: { key: 'ji', say: '专业技术与作品' },
    印星: { key: 'wen', say: '学术、文教与资质证书' },
    比劫: { key: null, say: '同辈合作与自立门户(这一段没有单独的行业指向,靠人不靠格局)' },
  };
  function dayunRoads(chart, age) {
    const list = (chart.dayun && chart.dayun.list) || [];
    if (!list.length) return [];
    const by = chart.birth instanceof Date ? chart.birth.getFullYear() : null;
    const dg = chart.dayGan;
    const cur = age != null && isFinite(+age) ? +age : null;
    const pick = list.filter(d => cur == null || d.fromAge + 10 > cur).slice(0, 3);
    return pick.map(d => {
      const gShen = Bazi.shiShen(dg, d.gan);
      const zCang = (Bazi.CANGGAN[d.zhi] || [])[0];
      const zShen = zCang ? Bazi.shiShen(dg, zCang) : null;
      const cls = [Bazi.SHISHEN_CLASS[gShen], zShen ? Bazi.SHISHEN_CLASS[zShen] : null].filter(Boolean);
      const road = CLASS_ROAD[cls[0]] || CLASS_ROAD[cls[1]] || null;
      const y0 = by == null ? null : Math.round(by + d.fromAge);
      return { fromAge: d.fromAge, y0, y1: y0 == null ? null : y0 + 10, road: road && road.key, say: road ? road.say : '',
        plain: `${y0 == null ? d.fromAge + '岁' : y0 + '–' + (y0 + 10) + '年'}(${d.fromAge}岁起):这十年偏向${road ? road.say : '无明确指向'}` };
    });
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
  function read(chart, opts) {
    if (!chart) return null;
    const age = opts && opts.age != null && isFinite(+opts.age) ? +opts.age : null;
    const roads = sixRoads(chart);
    const money = moneyPaths(chart);
    const zhi = directReads(chart);
    const guanxi = guanxiReads(chart);
    const mao = maoReads(chart);
    const jingzheng = jingzhengReads(chart);
    const pang = sideNotes(chart);
    const top = roads[0], second = roads[1];
    const gap = top.score - (second ? second.score : 0);
    let verdict;
    const dyr = dayunRoads(chart, age);
    if (top.score < 25) {
      verdict = '六路中没有哪一路明显占优:这副命局的谋生方向不由格局决定,由大运定。' +
        (dyr.length ? '未来三步大运各自的指向是——' + dyr.map(x => x.plain).join(';') + '。按所在的那一段选路,比按格局选准。'
          : '而大运缺性别排不出,补上性别这一层才有结论。');
    } else {
      // 第二位若是零分(压根没凭据),不许拿它当「第二名」摆——那是排序器的残留位次,不是候选路
      verdict = second && second.score > 0
        ? `最适合的谋生方向:${top.name}(强度${top.score},高出第二位的${second.name.slice(0, second.name.indexOf('('))} ${gap} 分)。`
        : `最适合的谋生方向:${top.name}(强度${top.score})。其余五路在这副盘上没有古书凭据支持,不参与排序。`;
      // 多格并见时必须给取舍理由,不许几条古书判语各说各的(评审点名:同一副盘被「直接断给」四个互斥行当)
      if (gap < 10 && second && second.score > 0) {
        verdict += `第二位的${second.name.slice(0, second.name.indexOf('('))}只差${gap}分,两条并见——` +
          `取舍看凭据的分量:${top.name.slice(0, top.name.indexOf('('))}这一路有${top.ev.length}条古书明文支持,` +
          `${second.name.slice(0, second.name.indexOf('('))}有${second.ev.length}条;` +
          (dyr.length ? `再看时间——${dyr[0].plain},当下这一段以它为主。` : '条数相当时以当下大运所指为准(补上性别可算出大运)。');
      }
    }
    return {
      shen: shenPower(chart), roads, money, zhi, guanxi, mao, jingzheng, pang, top, gap, verdict, dayunRoads: dyr,
      story: narrate(chart, roads, age),
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
    if (r.story) s += '【方向的推导过程(程序已算死,勿另立)】\n' + r.story + '\n';
    if (r.jingzheng.items.length) {
      s += '【竞争层(雄竞雌竞,客观直说)】\n';
      for (const j of r.jingzheng.items) s += `— ${j.plain}(推演:${j.tech};原话「${j.quote}」《${j.src}》)\n`;
      s += r.jingzheng.note + '\n';
    }
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
