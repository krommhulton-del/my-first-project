// hepan.js —— 双人合盘(中式):两副盘摆在一起,逐层看哪儿顺、哪儿拧
//
// ————————————————————————————————————————————————
//  先把这个模块的诚实分级写在最前面(§三),因为它是全项目最低的一档
// ————————————————————————————————————————————————
// 这一层用到的**元素**每一条都有古书撑着:
//   · 喜忌怎么定 —— 扶抑法,《滴天髓阐微》《子平真诠》一脉;
//   · 冲、合、刑、害怎么算 —— 地支六合六冲三合三刑相害,通行口径逐条可核;
//   · 缺哪一味 —— 调候取《穷通宝鉴》逐格;
//   · 逐年得力不得力 —— 走 `Yunshi.nianYun`,与运势页同一处出账。
//
// **但「两个人合着看」这套组合规则,在手上这五本书里查不到出处。**
// 实测:「合婚」0 命中、「婚配」1 命中(还是误匹配)、「生肖」「属相」各 0 命中——
// 市面上最流行的那套生肖配对(六合三合、六冲相害配对),这五本里一个字都没有。
//
// 所以本模块的定位写死在这里:
//   **元素有据,组合自拟,零回测。** 它说得通,不代表它验过准。
//   界面第一屏必须把这句话摆出来,不许藏进脚注。有测试钉着。
//
// ————————————————————————————————————————————————
//  一条自律:不替人做去留的决定
// ————————————————————————————————————————————————
// 铁律一是零说教,铁律五是不推荐花钱消灾。合盘这一路要再加一条:
//   **只报「哪一层顺、哪一层拧」与「拧在哪、怎么绕」,不报「合适/不合适」「该不该在一起」。**
// 两个人处不处得来是他们自己的事,一副盘定不了。程序给的是这两副盘之间哪几处对得上、
// 哪几处对不上,以及对不上的地方通常卡在什么事上——**决定永远是人做的**。
//
// 连带 v0.77 那条铁律照旧管用:**不许自己补一个「你俩这年感情大吉」**。
//
// ————————————————————————————————————————————————
//  §四:这个模块一个断法都不许自己算
// ————————————————————————————————————————————————
// 喜忌取 `chart.yong`(bazi 算好的)、调候取 `chart.tiaohou`、五行力量取 `chart.strength.pow`、
// 逐年得力取 `Yunshi.nianYun`。本模块只做**对照与加权**,不自己判旺衰、不自己取用神。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./bazi.js'), require('./yunshi.js'));
  } else { root.Hepan = factory(root.Bazi, root.Yunshi); }
}(typeof self !== 'undefined' ? self : this, function (Bazi, Yunshi) {
  'use strict';

  const WX = ['木', '火', '土', '金', '水'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const SANHE = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']];
  const SANXING = [['寅', '巳', '申'], ['丑', '戌', '未']];
  const XIANGHAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
  const chongOf = z => ZHI[(ZHI.indexOf(z) + 6) % 12];

  // 五行说人话(铁律八:客人那一列一个推演名目都不许有)
  const WX_PLAIN = { 木: '木(生发、条达那一路)', 火: '火(热烈、张扬那一路)', 土: '土(厚重、守成那一路)', 金: '金(果断、锋利那一路)', 水: '水(灵活、流动那一路)' };

  // ——————————————————————————————————————
  //  ①② 他旺不旺我 / 我旺不旺他
  //  看两样:对方的底色(日主五行)、对方盘里最旺的那一行。
  //  **必须双向各算一遍**——这两个数天然不对称,合成一个就等于把关键信息抹了。
  // ——————————————————————————————————————
  function strongestWx(chart) {
    const p = chart.strength.pow;
    return WX.slice().sort((a, b) => p[b] - p[a])[0];
  }
  function scoreOn(wx, yong, weight) {
    const xi = yong.xiWx || [], ji = yong.jiWx || [];
    if (wx === xi[0]) return { s: 2 * weight, k: '正是最旺你的那一路' };
    if (xi.includes(wx)) return { s: 1 * weight, k: '在旺你的那几路里' };
    if (wx === ji[0]) return { s: -2 * weight, k: '正是最背你的那一路' };
    if (ji.includes(wx)) return { s: -1 * weight, k: '在背你的那几路里' };
    return { s: 0, k: '于你不旺不背' };
  }
  function layerWang(from, to, fromName, toName) {
    // from 这个人,对 to 这个人是旺还是背
    const dz = from.dayWx, sw = strongestWx(from);
    const a = scoreOn(dz, to.yong, 1);
    const b = scoreOn(sw, to.yong, 0.6);
    const score = +(a.s + b.s).toFixed(2);
    const lines = [
      `${fromName}这人的底色是${WX_PLAIN[dz]}——${a.k}。`,
      sw === dz ? `${fromName}盘里最重的那一股力也是这一路,分量更足。`
        : `${fromName}盘里最重的那一股力是${WX_PLAIN[sw]}——${b.k}。`,
    ];
    return { score, wx: dz, strongest: sw, lines, verdict: bandOf(score, 2.2, 0.8) };
  }

  // ——————————————————————————————————————
  //  ③ 两盘的冲合:自身那一块(日支)与根基那一块(年支)
  //  元素逐条有出处;**哪一条算几分是自拟的**。
  // ——————————————————————————————————————
  function layerGong(A, B, nameA, nameB) {
    const items = [];
    const ad = A.pillars.day.zhi, bd = B.pillars.day.zhi;
    const ay = A.pillars.year.zhi, by = B.pillars.year.zhi;
    const ag = A.pillars.day.gan, bg = B.pillars.day.gan;
    const ke = Bazi.KE, gwx = Bazi.GAN_WX;
    const tianKe = gwx[ag] === ke[gwx[bg]] || gwx[bg] === ke[gwx[ag]];
    const diChong = chongOf(ad) === bd;

    if (tianKe && diChong) {
      items.push({ s: -2.5, why: '两个人自身那一块正面对撞——明面上的路数相克、底下的位子相冲,这是最硬的一处拧。', tag: '拧' });
    } else if (diChong) {
      items.push({ s: -2, why: '两个人自身那一块相冲——凑近了容易起摩擦,谁也不肯先退半步。', tag: '拧' });
    } else if (LIUHE[ad] === bd) {
      items.push({ s: 2, why: '两个人自身那一块正好合在一处——待在一起本身就顺,不用刻意迁就。', tag: '顺' });
    } else if (SANHE.some(t => t.includes(ad) && t.includes(bd) && ad !== bd)) {
      items.push({ s: 1.5, why: '两个人自身那一块能凑成一团——有共同的路数,容易往一处使劲。', tag: '顺' });
    } else if (SANXING.some(t => t.includes(ad) && t.includes(bd) && ad !== bd)
      || (ad === bd && ['辰', '午', '酉', '亥'].includes(ad))) {
      items.push({ s: -1.5, why: '两个人自身那一块带着一层刑——不是明着吵,是磨,时间长了都累。', tag: '拧' });
    } else if (XIANGHAI[ad] === bd) {
      items.push({ s: -1, why: '两个人自身那一块相害——不至于翻脸,但总有点使不上劲的别扭。', tag: '拧' });
    } else {
      items.push({ s: 0, why: '两个人自身那一块既不相合也不相冲——这一处谈不上帮也谈不上碍。', tag: '平' });
    }

    if (LIUHE[ay] === by) items.push({ s: 1, why: '两家根基那一块相合——长辈那边、家里那摊子事上,阻力小。', tag: '顺' });
    else if (chongOf(ay) === by) items.push({ s: -1, why: '两家根基那一块相冲——长辈、老家、原生家庭这几样上容易有分歧。', tag: '拧' });

    if (A.dayGan === B.dayGan) items.push({ s: 0.5, why: '两个人明面上的路数是同一味——想事情的方式像,话说半句就懂。', tag: '顺' });
    const score = +items.reduce((s, x) => s + x.s, 0).toFixed(2);
    return { score, items, verdict: bandOf(score, 2, 0.8) };
  }

  // ——————————————————————————————————————
  //  ④ 补不补得上:我缺的那一味,他身上有没有(双向)
  // ——————————————————————————————————————
  const ENOUGH = 20;   // 五行力量满分 100,过 20 才算「他身上真有这一味」(本项目自定)
  function layerBu(from, to, fromName, toName) {
    const lines = []; let score = 0;
    const need = to.tiaohou && to.tiaohou.need;
    const p = from.strength.pow;
    if (need) {
      const have = p[need] || 0;
      if (have >= ENOUGH) { score += 2; lines.push(`${toName}这盘缺的那一味是${WX_PLAIN[need]},而${fromName}身上正好厚——这一处补得上。`); }
      else lines.push(`${toName}这盘缺的那一味是${WX_PLAIN[need]},${fromName}身上也不厚(${have.toFixed(0)} 分,不到 ${ENOUGH})——这一味指望不上对方。`);
    }
    const weakest = WX.slice().sort((x, y) => (to.strength.pow[x] || 0) - (to.strength.pow[y] || 0))[0];
    if (!need || weakest !== need) {
      const have = p[weakest] || 0;
      if (have >= ENOUGH) { score += 1; lines.push(`${toName}盘里最薄的是${WX_PLAIN[weakest]},${fromName}身上有——短板那一处,对方顶得上。`); }
      else lines.push(`${toName}盘里最薄的是${WX_PLAIN[weakest]},${fromName}身上也薄——两个人在同一处都缺,这一块得自己想办法。`);
    }
    // 这一层**只有三档**,不套上面那把五档的尺。
    // 缘起(死条穷举查出来的):补的分只可能是 0/1/2/3,拿五档尺去套,
    // 「偏拧」「很拧」两档**永远触发不到**——那是死条。
    // 而且道理上也不该有负档:对方身上没有你缺的那一味,只是**帮不上**,不是害你。
    // 真要害你,那是①②两层的事(他的底色正撞你背的那一路),已经在那儿算过了,不许重复计分。
    const verdict = score >= 2.5 ? '补得上' : score >= 1 ? '补上一半' : '补不上';
    return { score: +score.toFixed(2), need, weakest, lines, verdict };
  }

  // ——————————————————————————————————————
  //  ⑤ 同期走什么运:未来十年两人各自得力不得力,叠在一起看
  //  逐年取自 `Yunshi.nianYun`(§四:年运只此一处),本模块只做比对。
  // ——————————————————————————————————————
  function layerYun(A, B, years, fromYear) {
    const y0 = fromYear || new Date().getFullYear();
    const rows = [];
    for (let y = y0; y < y0 + (years || 10); y++) {
      let sa = 0, sb = 0;
      try { sa = Yunshi.nianYun(A, new Date(y, 5, 1)).score; } catch (e) {}
      try { sb = Yunshi.nianYun(B, new Date(y, 5, 1)).score; } catch (e) {}
      const kind = (sa > 0 && sb > 0) ? '同得力' : (sa < 0 && sb < 0) ? '同吃力' : '一个上一个下';
      rows.push({ year: y, a: +sa.toFixed(1), b: +sb.toFixed(1), kind });
    }
    const both = rows.filter(r => r.kind === '同得力').map(r => r.year);
    const neither = rows.filter(r => r.kind === '同吃力').map(r => r.year);
    const split = rows.filter(r => r.kind === '一个上一个下').map(r => r.year);
    // 这一层不打分进总账——它讲的是「什么时候」,不是「合不合」
    return {
      rows, both, neither, split,
      line: `未来十年里,两个人同时得力的是 ${both.length ? both.join('、') + ' 年' : '没有'};`
        + `同时吃力的是 ${neither.length ? neither.join('、') + ' 年' : '没有'};`
        + `${split.length ? split.join('、') + ' 年是一个上一个下——那种年份最容易一头热一头冷,事先知道就不至于误会。' : '没有一头热一头冷的年份。'}`,
    };
  }

  function bandOf(s, hi, lo) {
    if (s >= hi) return '很顺';
    if (s >= lo) return '偏顺';
    if (s > -lo) return '不顺不拧';
    if (s > -hi) return '偏拧';
    return '很拧';
  }

  // ——————————————————————————————————————
  //  四种关系各有各的看法:同一对人,合作可能极好、过日子可能极累
  //  **权重全是自拟的**,每一条写明为什么这么排——写不出理由的权重不许留。
  // ——————————————————————————————————————
  const RELS = {
    lianai: {
      label: '谈恋爱 / 过日子',
      w: { ta2me: 1.0, me2ta: 1.0, gong: 1.2, bu: 1.0 },
      why: '过日子是两个人天天贴着,所以「自身那一块合不合」压得最重;两边旺不旺对方要各看一遍,不能只算一头。',
    },
    hezuo: {
      label: '合伙做事',
      w: { ta2me: 1.0, me2ta: 1.0, gong: 0.6, bu: 1.4 },
      why: '合伙看的是互补——你缺的他有,他缺的你有,这门生意才立得住;日常摩擦那一层反而轻,因为不必天天同处一室。',
    },
    pengyou: {
      label: '做朋友',
      w: { ta2me: 0.7, me2ta: 0.7, gong: 1.0, bu: 0.5 },
      why: '朋友不图互补也不图谁旺谁,图的是待在一起舒服,所以「处起来顺不顺」那一层为主,「旺不旺对方」那两层减半。',
    },
    gongshi: {
      label: '共事 / 上下级',
      w: { ta2me: 1.3, me2ta: 0.5, gong: 1.0, bu: 0.9 },
      why: '上下级是单向的:对方旺不旺你,比你旺不旺对方要紧得多——这一层的不对称是故意留的。',
    },
  };

  function pair(A, B, opts) {
    const o = opts || {};
    const nameA = o.nameA || '你', nameB = o.nameB || '对方';
    const L = {
      ta2me: layerWang(B, A, nameB, nameA),   // ① 他旺不旺我
      me2ta: layerWang(A, B, nameA, nameB),   // ② 我旺不旺他
      gong: layerGong(A, B, nameA, nameB),    // ③ 冲合
      buA: layerBu(B, A, nameB, nameA),       // ④ 他补不补得上我
      buB: layerBu(A, B, nameA, nameB),       // ④ 我补不补得上他
      yun: layerYun(A, B, o.years || 10, o.fromYear),  // ⑤ 同期运
    };
    const bu = { score: +((L.buA.score + L.buB.score) / 2).toFixed(2) };
    const rels = {};
    for (const k of Object.keys(RELS)) {
      const w = RELS[k].w;
      const total = +(L.ta2me.score * w.ta2me + L.me2ta.score * w.me2ta
        + L.gong.score * w.gong + bu.score * w.bu).toFixed(2);
      // 哪几层顺、哪几层拧——**只报这个,不报「合不合适」**。
      // 留神:这里算的是**这一路自己的加权分**,不是原始分。
      // 头一版拿原始分判,结果四种关系的叙述一模一样(只有总分不同),那四个分类就成了摆设——
      // 自测当场看出来。同一层在「做朋友」里权重 0.5、在「合伙」里 1.4,顺不顺本来就该不一样。
      const shun = [], ning = [];
      const parts = [
        { nm: `${nameB}旺不旺${nameA}`, v: L.ta2me.score * w.ta2me },
        { nm: `${nameA}旺不旺${nameB}`, v: L.me2ta.score * w.me2ta },
        { nm: '两个人处起来顺不顺', v: L.gong.score * w.gong },
        { nm: '缺的那一味补不补得上', v: bu.score * w.bu },
      ];
      for (const x of parts) { if (x.v >= 1.0) shun.push(x.nm); else if (x.v <= -1.0) ning.push(x.nm); }
      // 这一路上分量最重的是哪一层——四种关系看重的东西不同,这一句要说出来
      const lead = parts.slice().sort((x, y) => Math.abs(y.v) - Math.abs(x.v))[0];
      rels[k] = {
        key: k, label: RELS[k].label, why: RELS[k].why, total,
        band: bandOf(total, 3.5, 1.2), shun, ning,
        lead: lead.nm, leadValue: +lead.v.toFixed(2),
        say: (shun.length || ning.length
          ? `${shun.length ? '顺在:' + shun.join('、') + '。' : ''}${ning.length ? '拧在:' + ning.join('、') + '。' : ''}`
          : '这几层都不偏不倚——谈不上顺,也谈不上拧。')
          + `这一路上分量最重的是「${lead.nm}」。`,
      };
    }
    return {
      nameA, nameB, layers: L, bu, rels,
      // 拧了怎么绕:每一层各有各的绕法,全是能照着做的动作,不讲道理
      howto: howtoOf(L, bu, nameA, nameB),
      honest: HONEST,
      heldNote: '这里不报「你俩合适不合适」「该不该在一起」——那是你自己的事,一副盘定不了。'
        + '程序只把两副盘对得上的地方和对不上的地方摆出来,再告诉你对不上的地方通常卡在什么事上。',
    };
  }

  function howtoOf(L, bu, nameA, nameB) {
    const out = [];
    if (L.gong.score <= -0.8) {
      const worst = L.gong.items.slice().sort((a, b) => a.s - b.s)[0];
      out.push(`处起来拧的那一处:${worst.why}绕法是别在同一件事上正面顶——把决定权按事分开,`
        + `谁擅长哪一摊谁定,少开需要当场表态的会。`);
    }
    if (L.ta2me.score <= -0.8) out.push(`${nameB}这人的路数与${nameA}对着来:别指望靠贴近来化解,拉开点距离反而处得久;有事走书面,少即兴。`);
    if (L.me2ta.score <= -0.8) out.push(`${nameA}这人的路数对${nameB}是耗:该给对方留出不受你影响的地盘,别什么都替他拿主意。`);
    if (bu.score < 0.5) out.push(`两个人缺的东西撞在一处:这一块指望不上对方,要么各自补,要么找第三个人补——别互相埋怨。`);
    if (L.yun.split.length) out.push(`${L.yun.split.slice(0, 3).join('、')} 这几年一个上一个下:那种年份最容易一头热一头冷,提前说好谁那年主外谁主内。`);
    if (!out.length) out.push('这几层没有明显拧着的地方——没什么要特意去绕的。');
    return out;
  }

  const HONEST = '这一页的**元素**都有古书撑着:什么旺你什么背你怎么定、两个人相冲相合怎么算、缺哪一味怎么取,逐条可核。'
    + '**但「两个人合着看」这套算法是我自拟的,一件回测都没有。**'
    + '手上这五本古籍里,「合婚」查不到成法,「生肖配对」更是一个字都没有。'
    + '所以这一页说得通,不代表它验过准——**当参考,别当判决**。';

  // 喂模型的材料:结论已由程序算死,模型只许解释
  function material(r) {
    const L = r.layers;
    return `【双人合盘(中式) · 程序算死,勿另立结论】
${r.nameA} 与 ${r.nameB}。
[① ${r.nameB}旺不旺${r.nameA}] 分 ${L.ta2me.score}(${L.ta2me.verdict});${L.ta2me.lines.join('')}
[② ${r.nameA}旺不旺${r.nameB}] 分 ${L.me2ta.score}(${L.me2ta.verdict});${L.me2ta.lines.join('')}
[③ 两个人处起来] 分 ${L.gong.score}(${L.gong.verdict});${L.gong.items.map(x => x.why).join('')}
[④ 缺的那一味补不补得上] ${r.nameB}补${r.nameA}:${L.buA.score} 分;${L.buA.lines.join('')}
    ${r.nameA}补${r.nameB}:${L.buB.score} 分;${L.buB.lines.join('')}
[⑤ 同期走什么运] ${L.yun.line}
[四种关系分开算]
${Object.keys(r.rels).map(k => `  ${r.rels[k].label}:${r.rels[k].total} 分(${r.rels[k].band})。${r.rels[k].say}权重理由:${r.rels[k].why}`).join('\n')}
[拧了怎么绕]
${r.howto.map(x => '  · ' + x).join('\n')}
【写法要求】第一句就把「哪几层顺、哪几层拧」说死,四种关系分开讲,不许合成一个总分。
**不许说「合适/不合适」「该不该在一起」「建议分开」这类替人做决定的话**——只讲哪一层顺、哪一层拧、拧在哪、怎么绕。
不许自己补「你俩这年感情大吉」这类断语。不许出现推演名目,不许说空话。
必须原样转述这一句:这套「两个人合着看」的算法是自拟的、没有回测,当参考别当判决。`;
  }

  return { pair, material, RELS, HONEST, bandOf, layerWang, layerGong, layerBu, layerYun, WX_PLAIN, ENOUGH };
}));
