// gaiyun.js — 改运·运的行当:一个诊断 + 六条可动的杠杆(v0.91,板块 D)
//
// 缘起:用户 2026-08-02——「构成人的运势的因素有很多很多部分…风水、日运、穿戴、你去的城市、
// 你身边的人、你的行业…很多很多都是可以改变你运势的东西,做一个运的这么一个行当,
// 这不是单纯的算卦,更是十年大运里、流年里可以转变的一个板块和类目。」
//
// ── 策划书把「不做什么」先写死(板块 D)──
//   ❌ 不推荐任何花钱的东西(铁律五)——开光、法物、改名收费、风水摆件,一概不提;
//   ❌ 不讲道理、不谈心态修养(铁律一)——「心态认知」那一层只做**具体动作**,不做道理;
//   ❌ 不承诺「照做就能改运」。
//
// ── 做什么:把已经算出来的东西串成一份可执行的清单,每条标「证据强度」──
//   这六条的分量本来就不一样,不标分量就是耍流氓;但**分量是按证据强度排的序,不是疗效**。
//   诚实分级全项目最低的一档,那段话(HONEST)必须上界面第一屏,钉成测试。
//
// ── §四:本模块**一个断法都不许自己算**,六条杠杆全部取自已有模块 ──
//   诊断:chart.yong / chart.tiaohou / Bazi.plainBand / Bazi.shiShen+plainShen / Dili.dayunNow
//   时:Dashi.timeline(年窗)+ 吉日板块入口 · 地:Dili.WX_DIRS(方位表只此一份)
//   色:Jiri.WX_GOODS(颜色数字时段表只此一份) · 业:Dili.YE(行业表)+ Mingge.read(六路)
//   宅:占宅板块未建,照实给「另起一卦」的入口,不硬造 · 人:合盘板块入口(那套规则自拟零回测)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./bazi.js'), require('./dili.js'), require('./dashi.js'),
      require('./jiri.js'), require('./mingge.js'));
  } else { root.Gaiyun = factory(root.Bazi, root.Dili, root.Dashi, root.Jiri, root.Mingge); }
}(typeof self !== 'undefined' ? self : this, function (Bazi, Dili, Dashi, Jiri, Mingge) {

  const HONEST = '这六条里,地、时、色、业是从你的盘算出来的,有据可依;宅要另起一卦;人是自拟的算法。' +
    '但没有一条验过「照做之后运真的变好了」——那需要一份「某人做了某事之后过得如何」的语料,眼下没有。' +
    '所以这一页给的是依据,不是疗效;各条的分量标的是证据强度,也不是疗效。';

  // ── 诊断:眼下这十年走的什么路数、这副盘卡在哪一味 ──
  function zhenduan(chart, age, now) {
    const body = [], tech = [];
    // 底子(白话对照表只此一份)
    body.push(`你这人底子${Bazi.plainBand(chart.strength.band)},旺你的是${chart.yong.xiWx.join('、')}这几路,背你的是${chart.yong.jiWx.join('、')}`);
    tech.push(`${chart.strength.band},喜${chart.yong.xiWx.join('')},忌${chart.yong.jiWx.join('')}`);
    // 缺的那味药(调候,穷通宝鉴一格一核)
    if (chart.tiaohou && chart.tiaohou.need) {
      body.push(`这副盘缺的那味药是「${chart.tiaohou.need}」——${(chart.tiaohou.note || '').split(/[;;]/)[0]}`);
      tech.push(`调候取${chart.tiaohou.need}(${chart.tiaohou.src || ''})`);
    }
    // 眼下这十年(大运要性别与年龄;缺哪样照实说哪样,v0.83 的规矩:不硬猜)
    let dayunLine = null;
    if (chart.dayun && chart.dayun.unknown) {
      dayunLine = '十年大运这一层排不了:' + (chart.genderKnown ? '' : '性别没填(古法男女的大运方向是反的)。') +
        '下面的杠杆只按盘面喜忌给,少了「眼下这十年」那一层。';
    } else if (age == null) {
      dayunLine = '没有年龄,定位不了你眼下走到哪一步大运——下面的杠杆只按盘面喜忌给。';
    } else {
      const list = (chart.dayun && chart.dayun.list) || [];
      let cur = null;
      for (const d of list) if (age >= d.fromAge) cur = d;
      if (cur) {
        const shen = Bazi.shiShen(chart.dayGan, cur.gz[0]);
        dayunLine = `你眼下这十年走的是「${Bazi.plainShen(shen)}」这一路当家` +
          (chart.yong.jiWx.includes(Bazi.GAN_WX[cur.gz[0]]) ? ',而且这十年明面走的正是背你的五行——顺水的事少,底下六条杠杆才更要紧' :
            (chart.yong.xiWx.includes(Bazi.GAN_WX[cur.gz[0]]) ? ',这十年明面走的是旺你的五行——顺水,杠杆是锦上添花' : ',明面不帮不压'));
        tech.push(`现行大运${cur.gz}(${shen}),${cur.fromAge}岁起`);
      } else dayunLine = `还没起运(${chart.dayun.startText || ''}),这几年主要看家里给的底子`;
    }
    return { body, tech, dayunLine };
  }

  // ── 六条杠杆(证据强度从高到低排;强度说的是「程序里这一层的依据硬不硬」,不是疗效)──
  function levers(chart, age, now) {
    const xi = chart.yong.xiWx, ji = chart.yong.jiWx;
    const out = [];

    // 时——事件层回测过一轮的只有这一层(弱相关、样本小,照实标)
    const shiItems = [];
    try {
      const tl = Dashi.timeline(chart);
      const thisYear = (now || new Date()).getFullYear();
      const ahead = (tl.allNodes || tl.nodes || []).filter(n => n.year >= thisYear && n.year <= thisYear + 5 && n.top && n.top.score >= 2);
      // **score 是力度,dirSum 才是方向**——头一版拿 score 正负当吉凶,把「健康撑不住」的凶年
      // 也归进了「动这一摊」,当场揪出改掉(依据凶、结论吉是本项目明令禁止的)。
      // 姻缘的方向 v0.77 起由处境定,dirSum 恒为 0,单独措辞,不硬安吉凶。
      // 跨尺度用词换口径:年表的理由写在「某一年」名下用的是「今年/这一年」,搬到清单里说的是未来某年
      const rephrase = s => String(s || '').replace(/今年|这一年/g, '那年');
      const good = ahead.filter(n => n.top.dirSum > 0 && n.top.key !== 'yinyuan').slice(0, 2);
      const bad = ahead.filter(n => n.top.dirSum < 0).slice(0, 1);
      const yy = ahead.find(n => n.top.key === 'yinyuan');
      for (const n of good) shiItems.push({
        do_: `${n.year} 年宜动「${n.top.label}」——${rephrase(n.top.reasons && n.top.reasons[0])}`,
        tech: (n.top.techs && n.top.techs[0]) || '',
      });
      for (const n of bad) shiItems.push({
        do_: `${n.year} 年守——那年的力冲着「${n.top.label}」来:${rephrase(n.top.reasons && n.top.reasons[0])}。大动作挪开这一年`,
        tech: (n.top.techs && n.top.techs[0]) || '',
      });
      if (yy) shiItems.push({
        do_: `${yy.year} 年感情一事动得重——是聚是散不看盘看处境,去「运势」或年表填了感情状态再看方向`,
        tech: '姻缘只报动量,方向归处境(v0.77)',
      });
      if (!shiItems.length) shiItems.push({ do_: '未来五年没有哪年的信号过线——年份挑不出轻重,具体日子照下一条办', tech: '年表未来五年无过阈节点' });
    } catch (e) { shiItems.push({ do_: '年表这一层排不出来(通常是大运停摆:缺性别或年龄)——补上再看年份', tech: String(e.message || e) }); }
    shiItems.push({ do_: '要办的具体日子去「吉日」板块挑:那里把黄历层与「对你」层分开账,按事给日子', tech: 'jiri 两层分账' });
    out.push({
      key: 'shi', name: '时 · 哪几年动、哪几月办', from: '年表(dashi)+ 吉日(jiri)',
      strength: '六条里唯一回测过的一层(33 人 175 件事,方向命中 79.2%,弱相关、样本小,不够格叫准)',
      items: shiItems,
    });

    // 地——喜忌有据;「方位配五行」通行口径出处待核;地气表自拟(v0.68 的账照抄)
    const wangDirs = xi.flatMap(w => Dili.WX_DIRS[w] || []);
    const jiDirs = ji.flatMap(w => Dili.WX_DIRS[w] || []);
    out.push({
      key: 'di', name: '地 · 去哪、避哪', from: '地利(dili)七层',
      strength: '喜忌那半有据;「方位配五行」这半是通行口径、五本书里查不到出处(v0.68 查过,照实标)',
      items: [
        { do_: `办事、出差、挪窝,往${[...new Set(wangDirs)].join('、')}这几个方向的城市去`, tech: `喜${xi.join('')} → ${[...new Set(wangDirs)].join('/')}` },
        { do_: `${[...new Set(jiDirs)].join('、')}方向能不去就不去,非去不可就短去短回`, tech: `忌${ji.join('')} → ${[...new Set(jiDirs)].join('/')}` },
        { do_: '具体到城市与省份,去「地利」板块——那里按你的盘逐城实算,还分了大城市榜与近处榜', tech: 'dili 449 处逐城' },
      ],
    });

    // 色——颜色数字时段表取 jiri 的 WX_GOODS(只此一份,不另抄)
    const seItems = xi.map(w => {
      const g = Jiri.WX_GOODS[w] || {};
      return { do_: `穿用${g.colors}这一路;要挑数字取${g.nums};要紧的事放在${g.hours}办`, tech: `喜${w}:${g.colors}/${g.nums}/${g.hours}` };
    });
    ji.forEach(w => {
      const g = Jiri.WX_GOODS[w] || {};
      seItems.push({ do_: `${g.colors}这一路少上身,大事别挑${g.hours}办`, tech: `忌${w}` });
    });
    out.push({
      key: 'se', name: '色 · 穿用什么、几点办事', from: '吉日(jiri)的五行用度表',
      strength: '喜忌那半有据;色、数、时段的对应是通行口径',
      items: seItems,
    });

    // 业——命格六路(条条有原话)+ 行业名单(dili 业层表)
    const yeItems = [];
    try {
      const mg = Mingge.read(chart);
      if (mg && mg.top && mg.top.score >= 25) yeItems.push({
        do_: `这碗饭最像:${mg.top.name}——细账与古书原话去「命格取向」板块看`,
        tech: `命格六路之首 ${mg.top.key}:${mg.top.score}`,
      });
    } catch (e) {}
    for (const w of xi) yeItems.push({ do_: `${w}一路的行当旺你:${Dili.YE[w]}`, tech: `喜${w}之业` });
    out.push({
      key: 'ye', name: '业 · 吃哪一路的饭', from: '命格取向(mingge)+ 地利的行业表',
      strength: '六路取向条条挂得出古书原话;行业名单是现代对照、通行口径;两样都零回测',
      items: yeItems,
    });

    // 宅——占宅板块没建,照实说,给的是「另起一卦」的正路,不硬造
    out.push({
      key: 'zhai', name: '宅 · 住处怎么调', from: '(占宅板块未建)',
      strength: '这一层要另起一卦才有依据——瞎给摆设建议是本程序明令禁止的',
      items: [
        { do_: '去「问卦」起一卦,问「现在住的这处旺不旺我」;要搬家,搬之前拿要搬的那处再起一卦', tech: '占宅走六爻,古书那部分正文在库里,专门板块排在队列上' },
        { do_: '不必买任何东西——清理居处、通风见光、腾出睡觉那间的杂物,这些不花钱的传统做法可以先做', tech: '铁律五:不推荐花钱消灾' },
      ],
    });

    // 人——合盘入口(组合规则自拟零回测,照 v0.85 的账标)
    out.push({
      key: 'ren', name: '人 · 身边该多走动谁', from: '双人合盘(hepan)',
      strength: '自拟算法、零回测——六条里证据最薄的一条,当参考别当判决',
      items: [
        { do_: '把常来往的几个人各建一份档案,去「双人合盘」逐个合:多走动「他旺你」那一路的,少纠缠「拧」的那几位', tech: 'hepan 四种关系分开算' },
        { do_: '合盘会写明拧在哪、怎么绕——那是绕法,不是叫你断交', tech: '铁律十一:不替人做去留的决定' },
      ],
    });

    return out;
  }

  function plan(chart, opts) {
    if (!chart) return null;
    opts = opts || {};
    const now = opts.now || new Date();
    const age = opts.age != null ? opts.age : (chart.birth ? now.getFullYear() - chart.birth.getFullYear() : null);
    const z = zhenduan(chart, age, now);
    return { zhen: z, levers: levers(chart, age, now), honest: HONEST };
  }

  function material(chart, opts) {
    const p = plan(chart, opts);
    if (!p) return '';
    let s = '【改运·运的行当·程序推定(已算死,勿另立结论)】\n诊断:' + p.zhen.body.join(';') + '\n' + (p.zhen.dayunLine || '') + '\n';
    for (const l of p.levers) {
      s += `【${l.name}】(证据强度:${l.strength})\n`;
      for (const it of l.items) s += `— ${it.do_}(推演:${it.tech})\n`;
    }
    s += '【写法铁规】①只说动作与时间,不讲道理不谈心态(铁律一)——「保持积极」「相信自己」这类句子一个不许有;' +
      '②不推荐任何花钱的东西:开光、法物、摆件、付费改名一概不许提(铁律五);' +
      '③不许承诺「照做就能改运」——' + HONEST + '④禁空话;第一句就是答案。';
    return s;
  }

  return { plan, material, HONEST };
}));
