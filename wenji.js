// wenji.js — 问机:问一句话,看应期落在哪年、哪月、哪几天
//
// 串三层:年表定年(大运流年)→ 流月定月(节气月)→ 择日定日(黄历层×命理层)。
// 再加两样人最关心的:那段时间遇到的人/机会是什么路数(画像),贵人从哪个方向来。
//
// 断法依据:
//   ①事型认题:所问归入八类事型,并按通行口径取六亲用神(出处待核),供起卦复核对照;
//   ②定年:同 dashi 的证据链,取该事型分最高且方向不背的年份;
//   ③定月:节气月为界,十二流月各走同一套证据,取该事型最集中的月;
//   ④定日:逐日双层——命理层(流日干支合不合你的喜忌、动不动你的宫)与
//         黄历层(建除值神星宿,并排除冲你生肖之日),两层都过关才荐;
//   ⑤画像:以该事的用神(男财女官、财则正偏、贵人则天乙)之五行、十神、
//         所临地支与神煞,推人物路数、相识途径、方位与属相;
//   ⑥贵人:天乙贵人所临之支定方位与属相,逢之年月即其露面之期。
// 凡所报必列依据;程序算死,AI 只许照着解释。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./najia.js'), require('./bazi.js'), require('./dashi.js'), require('./jiri.js'), require('./yunshi.js'));
  } else { root.Wenji = factory(root.Najia, root.Bazi, root.Dashi, root.Jiri, root.Yunshi); }
}(typeof self !== 'undefined' ? self : this, function (Najia, Bazi, Dashi, Jiri, Yunshi) {
  const { GAN_WX, ZHI_WX, ZHI, CANGGAN, SHISHEN_CLASS } = Bazi;

  // ——— 一、认题:所问归入哪一类事 ———
  const TOPICS = [
    { key: 'yinyuan', label: '姻缘', re: /(恋爱|脱单|结婚|对象|姻缘|正缘|另一半|相亲|表白|复合|感情|谈朋友|在一起|嫁|娶|订婚|领证)/,
      ask: '什么时候能遇上、能定下来' },
    { key: 'caiyun', label: '财运', re: /(财|钱|发财|赚|收入|进账|工资|涨薪|生意|买卖|投资|理财|回款|分红|副业|外快)/,
      ask: '什么时候进得来钱' },
    { key: 'shiye', label: '事业', re: /(工作|事业|升职|晋升|跳槽|换工作|创业|老板|领导|职位|评职称|考公|考编|面试|录取|机会)/,
      ask: '什么时候有进展' },
    { key: 'wenshu', label: '学业文书', re: /(考试|考研|考证|升学|学业|论文|答辩|证书|房子|买房|过户|合同|签约|执照|文书)/,
      ask: '什么时候办得成' },
    { key: 'zinv', label: '子女家人', re: /(孩子|子女|怀孕|备孕|生育|添丁|小孩|父母|长辈|家里)/,
      ask: '什么时候有信儿' },
    { key: 'biandong', label: '搬迁变动', re: /(搬家|换城市|搬迁|调动|出国|移居|远行|出差|换环境|离开)/,
      ask: '什么时候动最顺' },
    { key: 'guiren', label: '贵人', re: /(贵人|帮我|提携|靠山|谁能帮|遇到贵人|扶我)/,
      ask: '贵人什么时候露面、从哪来' },
    { key: 'jiankang', label: '健康', re: /(身体|健康|生病|手术|康复|调理|体检)/,
      ask: '什么时候要当心、什么时候好转' },
  ];
  function classify(question) {
    const q = String(question || '');
    for (const t of TOPICS) if (t.re.test(q)) return { key: t.key, label: t.label, ask: t.ask };
    return { key: 'shiye', label: '综合运程', ask: '什么时候是当口', fallback: true };
  }

  // ——— 二、人物与机会画像:五行、十神、地支各说一层 ———
  const WX_PERSON = {
    木: { look: '个子偏高、身形偏瘦、眉眼清秀', xing: '有主见、爱往前冲、认死理', hang: '教育、文化、木材家具、医药、园林、成长型行业' },
    火: { look: '五官立体、气色亮、笑起来有热度', xing: '热情外向、来得快也急', hang: '传媒、餐饮、演艺、电子、能源、光电' },
    土: { look: '身形偏敦实、面方、耐看不扎眼', xing: '踏实、慢热、说到做到', hang: '地产建筑、农业、仓储、政务、保险' },
    金: { look: '轮廓分明、皮肤偏白、气质利落', xing: '果断、讲规矩、脸皮薄心气高', hang: '金融、机械制造、军警法、五金、珠宝' },
    水: { look: '面圆润、眼睛有神、显小', xing: '灵活、会来事、心思细', hang: '贸易物流、水产、旅游、互联网、咨询' },
  };
  const SHEN_NATURE = {
    正财: '正经过日子的路数:条件实在、来路正、图的是长久', 偏财: '来得活络:多半从饭局、朋友圈、生意场上来,起步不那么正式',
    正官: '端正守规矩:体制内或大单位的多,家里也认可', 七杀: '强势能干:压得住你,也容易让你有压力,相处要讲方法',
    正印: '偏长辈缘或师生缘:懂照顾人,给你安全感', 偏印: '路子偏、想法多:投缘但需要磨合',
    食神: '合得来、聊得开:相处轻松,靠共同爱好走近', 伤官: '有才气也有脾气:吸引力强,容易起口角',
    比肩: '像同辈同行:平起平坐,合作型', 劫财: '争夺之象:身边可能不止一个人在争,要防被截胡',
  };
  const ZHI_DIR = { 子: '正北', 丑: '东北偏北', 寅: '东北偏东', 卯: '正东', 辰: '东南偏东', 巳: '东南偏南', 午: '正南', 未: '西南偏南', 申: '西南偏西', 酉: '正西', 戌: '西北偏西', 亥: '西北偏北' };
  const ZHI_ANIMAL = { 子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇', 午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪' };
  const GONG_AGE = { year: '比你大一截(或经由长辈、老家这条线)', month: '年纪相仿或略长(多从工作、常去之处来)', day: '就在身边(同事、熟人、常打交道的圈子)', hour: '比你小(或经由晚辈、后来的场合)' };
  // 相识途径:看那一年那一月引动的是哪一路
  const MEET_BY = {
    桃花: '社交场合来的:聚会、饭局、兴趣圈、线上认识都算,人多的地方去得越勤越有',
    红鸾: '经人说合来的:亲友介绍、相亲这条路这段最灵',
    天喜: '喜事场合来的:婚礼、乔迁、庆功这类场子里遇上',
    天乙: '贵人牵线:长辈、老师、老领导引荐的,最靠谱的一条路',
    驿马: '路上遇见:出差、旅途、异地、搬迁途中，或是外地来的人',
    文昌: '正事里遇见:进修、考试、项目、专业场合,先做事后动情',
    合日支: '身边的人走近了:同事、老同学、常打交道的人,由熟转亲',
    冲日支: '突然出现的:变动中撞上的,来得急,要多看一阵再定',
  };

  function pillarOfZhi(chart, zhi) {
    for (const k of ['year', 'month', 'day', 'hour']) if (chart.pillars[k].zhi === zhi) return k;
    return null;
  }

  // 该事型在某年(或某月)的用神星:姻缘取配偶星、财运取财星、事业取官星、贵人取天乙
  function keyStarOf(chart, catKey, gz) {
    const g = gz[0], z = gz[1], zhu = CANGGAN[z][0];
    const gShen = Bazi.shiShen(chart.dayGan, g), zShen = Bazi.shiShen(chart.dayGan, zhu);
    const want = { yinyuan: chart.gender === '女' ? '官杀' : '财星', caiyun: '财星', shiye: '官杀', wenshu: '印星', zinv: chart.gender === '女' ? '食伤' : '官杀' }[catKey];
    if (!want) return null;
    if (SHISHEN_CLASS[gShen] === want) return { gan: g, shen: gShen, wx: GAN_WX[g], where: '天干', zhi: z };
    if (SHISHEN_CLASS[zShen] === want) return { gan: zhu, shen: zShen, wx: GAN_WX[zhu], where: '地支所藏', zhi: z };
    return null;
  }

  function portrait(chart, catKey, gz, marks) {
    const star = keyStarOf(chart, catKey, gz);
    const out = { star, lines: [] };
    if (catKey === 'yinyuan') {
      if (star) {
        const p = WX_PERSON[star.wx];
        out.lines.push(`路数:${SHEN_NATURE[star.shen] || star.shen}`);
        out.lines.push(`模样:${p.look};性子${p.xing}`);
        out.lines.push(`多半干这几行:${p.hang}`);
        const pk = pillarOfZhi(chart, star.zhi);
        if (pk) out.lines.push(`远近:${GONG_AGE[pk]}`);
        out.lines.push(`来的方位:自你住处往${ZHI_DIR[star.zhi]}那一带;属${ZHI_ANIMAL[star.zhi]}或与${ZHI_ANIMAL[star.zhi]}相合的人尤其对得上`);
      } else {
        out.lines.push('这一段没有明摆着的配偶星现出来,人多半是先以别的名义出现(同事、朋友、合作),过一阵才转成这层关系');
      }
    } else if (catKey === 'caiyun') {
      if (star) {
        out.lines.push(star.shen === '正财'
          ? '进的是正路的钱:工资、回款、稳定生意这条线,来得慢但落得住'
          : '进的是活钱:外快、副业、临时机会、饭局带来的单子,来得快也散得快,落袋要及时');
        out.lines.push(`钱从这类事上来:${WX_PERSON[star.wx].hang}`);
        out.lines.push(`谈钱的方位:往${ZHI_DIR[star.zhi]}那一带谈成的多;属${ZHI_ANIMAL[star.zhi]}的人是这笔钱的关口`);
      } else {
        out.lines.push('这一段财星不显,钱多半不是直接来的,而是先有事(项目、名分、人脉)再带出钱');
      }
    } else if (catKey === 'shiye') {
      if (star) {
        out.lines.push(star.shen === '正官'
          ? '走的是名分这条路:评审、转正、提级、正式任命这类,规规矩矩报上去就有'
          : '走的是硬仗这条路:接难活、救火、竞标、临危受命,压力大但出得来名声');
        out.lines.push(`机会多半出在:${WX_PERSON[star.wx].hang}`);
        out.lines.push(`拍板的人在${ZHI_DIR[star.zhi]}那一头;属${ZHI_ANIMAL[star.zhi]}的人是这事的关口`);
      } else out.lines.push('这一段官星不显,进展多半靠自己做出成绩来倒逼,而不是等人给名分');
    }
    // 相识/得手的途径:按那一年月引动的神煞与宫位
    const ways = [];
    for (const k of Object.keys(MEET_BY)) if (marks.some(m => m.startsWith(k) || m.includes(k))) ways.push(MEET_BY[k]);
    if (ways.length) out.lines.push('路子:' + ways.join(';'));
    return out;
  }

  // ——— 三、贵人:天乙所临之支定方位与属相 ———
  function guiRen(chart) {
    const zs = (Bazi.TIANYI[chart.dayGan] || '').split('').filter(Boolean);
    return {
      zhis: zs,
      dirs: zs.map(z => ZHI_DIR[z]),
      animals: zs.map(z => ZHI_ANIMAL[z]),
      note: zs.length
        ? `你的天乙贵人在${zs.join('、')}——方位往${zs.map(z => ZHI_DIR[z]).join('、')}那几头找,属${zs.map(z => ZHI_ANIMAL[z]).join('、')}的人对你最肯出力;流年流月流日逢这几个字,就是贵人露面之期。`
        : '此日主天乙不显,贵人之力须从别处论。',
    };
  }

  // ——— 四、定日:某个节气月里,逐日双层筛 ———
  const EVENT_OF_CAT = { yinyuan: 'jiaqu', caiyun: 'kaiye', shiye: 'shangren', wenshu: 'kaoshi', zinv: 'qiuyi', biandong: 'ruzhai', guiren: 'tongyong', jiankang: 'qiuyi' };
  function dayPicks(chart, year, monthGz, startDate, endDate, catKey, topN) {
    const out = [];
    const d = new Date(startDate.getTime());
    while (d <= endDate) {
      const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
      const info = Jiri.dayInfo(date, chart.birth, chart.yong);
      const gz = info.gz.day;
      const ev = Dashi.yearEvidence(chart, gz, null);
      const catScore = ev.cats[catKey] ? ev.cats[catKey].score : 0;
      const ri = Yunshi.riYun(chart, date);
      // 三道门槛,缺一不荐:
      //  ①黄历层不能是「忌」、也不能正冲你生肖;
      //  ②命理层(流日干支合你喜忌)要为正——日运小凶还往上荐,那叫自己打自己;
      //  ③该日的建除不能犯所问之事的忌(嫁娶忌破日、开市忌闭日之类)。
      const ev2 = Jiri.EVENTS[EVENT_OF_CAT[catKey] || 'tongyong'];
      const almOk = info.layers.almanac.level !== '忌' && info.level !== '冲';
      const perOk = info.personal ? info.personal.score > 0 : true;
      const riOk = ri.score > 0;
      const jcOk = !ev2 || !ev2.ji.includes(info.jianchu.name);
      if (almOk && perOk && riOk && jcOk) {
        const jcBonus = ev2 && ev2.yi.includes(info.jianchu.name) ? 1.5 : 0;
        const shenBonus = ev2 && ev2.bonus.includes(info.zhishen.name) ? 1 : 0;
        const guiBonus = (Bazi.TIANYI[chart.dayGan] || '').includes(gz[1]) ? 0.8 : 0;
        const score = +(catScore * 1.2 + ri.score + info.layers.almanac.score * 0.3 +
          (info.personal ? info.personal.score * 0.5 : 0) + jcBonus + shenBonus + guiBonus).toFixed(2);
        out.push({
          iso: info.iso, m: info.m, d: info.d, gz, score,
          catScore: +catScore.toFixed(1), riLevel: ri.level,
          almLevel: info.layers.almanac.level, perLevel: info.layers.personal ? info.layers.personal.level : '',
          jianchu: info.jianchu.name, zhishen: info.zhishen.name, huang: info.zhishen.huang,
          gui: guiBonus > 0,
          why: [
            jcBonus ? `${info.jianchu.name}日正合此事` : '',
            shenBonus ? `${info.zhishen.name}${info.zhishen.huang ? '黄道' : ''}相扶` : '',
            guiBonus ? '天乙贵人临此日' : '',
          ].filter(Boolean).concat(
            // 同一套证据规则用到流日上,措辞得换口径,不能还写「流年」「这一年」
            ev.cats[catKey] ? ev.cats[catKey].reasons.slice(0, 1).map(x =>
              String(x).replace(/流年/g, '流日').replace(/这一天/g, '这一天').replace(/这一年/g, '这一天')) : []),
          yi: ri.yi ? ri.yi.slice(0, 3) : [],
        });
        const last = out[out.length - 1];
        if (!last.why.length) last.why = [`黄历${info.jianchu.name}日${info.zhishen.huang ? '、' + info.zhishen.name + '黄道' : ''},你的日运判「${ri.level}」——三道门槛都过,是个稳当日子`];
      }
      d.setDate(d.getDate() + 1);
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, topN || 4).sort((a, b) => a.iso.localeCompare(b.iso));
  }

  // 某节气月的起止公历日期
  function monthRange(year, gIdx) {
    const probe = new Date(year, gIdx, 20, 12);
    const gz = Najia.ganZhi(probe).month;
    let s = 1;
    for (let dd = 19; dd >= 1; dd--) { if (Najia.ganZhi(new Date(year, gIdx, dd, 12)).month !== gz) { s = dd + 1; break; } }
    let e = new Date(year, gIdx + 1, 0).getDate();
    for (let dd = 21; dd <= e; dd++) { if (Najia.ganZhi(new Date(year, gIdx, dd, 12)).month !== gz) { e = dd - 1; break; } }
    return { gz, start: new Date(year, gIdx, s, 12), end: new Date(year, gIdx, e, 12) };
  }

  // ——— 主函数:问一句话,给三层应期 ———
  function ask(chart, question, opts) {
    opts = opts || {};
    const nowYear = opts.nowYear || new Date().getFullYear();
    const span = opts.span === undefined ? 6 : opts.span;   // 往后看几年(传 0 即不看,用于自测空窗)
    const topic = classify(question);
    const tl = Dashi.timeline(chart, { nowYear });
    const catKey = topic.key === 'guiren' ? 'shiye' : topic.key;

    // 定年:未来 span 年里,该事型分最高的几年
    const years = tl.yearly
      .filter(r => r.year >= nowYear && r.year < nowYear + span)
      .map(r => {
        const c = (r.cats || []).find(x => x.key === catKey);
        return { row: r, score: c ? c.score : 0, dir: c ? c.dirSum : 0, cat: c };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const pickedYears = years.slice(0, 3).sort((a, b) => a.row.year - b.row.year);

    const windows = pickedYears.map(y => {
      const r = y.row;
      const months = Dashi.monthsOf(chart, r.year, r.dayunGz || null)
        .map(m => ({ m, s: (m.cats.find(x => x.key === catKey) || { score: 0, reasons: [], dirSum: 0 }) }))
        .filter(x => x.s.score > 0)
        .sort((a, b) => b.s.score - a.s.score)
        .slice(0, 2)
        .sort((a, b) => a.m.idx - b.m.idx);
      const monthOut = months.map(({ m, s }) => {
        const rg = monthRange(r.year, m.idx - 1);
        const days = dayPicks(chart, r.year, m.gz, rg.start, rg.end, catKey, opts.daysPerMonth || 4);
        const marks = Bazi.flowMarks(chart, m.gz[0], m.gz[1]);
        let po = portrait(chart, catKey, m.gz, marks);
        // 月干支里不现用神星时,退一层看当月最合那几天——人终归是在某一天遇上的
        if (!po.star && days.length) {
          for (const d of days) {
            const alt = portrait(chart, catKey, d.gz, marks.concat(Bazi.flowMarks(chart, d.gz[0], d.gz[1])));
            if (alt.star) { po = alt; po.fromDay = `${d.m}月${d.d}日`; break; }
          }
        }
        return {
          idx: m.idx, name: m.name, gz: m.gz, span: `${rg.start.getMonth() + 1}月${rg.start.getDate()}日～${rg.end.getMonth() + 1}月${rg.end.getDate()}日`,
          score: +s.score.toFixed(1), reasons: s.reasons.slice(0, 3), days,
          portrait: po,
        };
      });
      return {
        year: r.year, age: r.age, gz: r.gz, dayunGz: r.dayunGz,
        score: +y.score.toFixed(1), dir: y.dir,
        reasons: (y.cat ? y.cat.reasons : []).slice(0, 3),
        tips: (y.cat && y.cat.tips ? y.cat.tips.slice().sort((a, b) => b.w - a.w).map(x => x.tip) : []).slice(0, 2),
        flags: r.flags || [],
        months: monthOut,
      };
    });

    // 贵人:天乙所临之支,以及未来 span 年里逢之的年月
    const gr = guiRen(chart);
    const grYears = tl.yearly.filter(r => r.year >= nowYear && r.year < nowYear + span && gr.zhis.includes(r.gz[1]))
      .map(r => ({ year: r.year, gz: r.gz }));
    // 贵人也落到月与日:未来一年里逢天乙之月、以及最近的几个天乙日
    const grMonths = [];
    for (let y = nowYear; y < nowYear + 2; y++) {
      for (const m of Dashi.monthsOf(chart, y, null)) {
        if (gr.zhis.includes(m.gz[1])) grMonths.push({ year: y, idx: m.idx, name: m.name, gz: m.gz, span: m.span });
      }
    }
    const grDays = [];
    {
      const d0 = new Date(opts.today ? opts.today.getTime() : Date.now());
      for (let i = 0; i < 120 && grDays.length < 6; i++) {
        const dt = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i, 12);
        const dgz = Najia.ganZhi(dt).day;
        if (gr.zhis.includes(dgz[1])) grDays.push({ iso: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`, gz: dgz });
      }
    }

    // 并发之事:这几年里同时还有哪些事型冒头(用户想看的「还会发生什么」)
    const alsoMap = {};
    for (const w of windows) {
      const row = tl.yearly.find(r => r.year === w.year);
      for (const c of (row.cats || [])) {
        if (c.key === catKey || c.score < 2.5) continue;
        (alsoMap[c.key] = alsoMap[c.key] || []).push({ year: w.year, label: c.label, score: +c.score.toFixed(1), why: c.reasons[0], dir: c.dirSum });
      }
    }
    const also = Object.keys(alsoMap).map(k => ({ key: k, label: Dashi.CATS[k] ? Dashi.CATS[k].label : k, items: alsoMap[k] }));

    // 起卦复核用的用神(与断卦那边同口径)
    const yong = Najia.yongShenOf(question, chart.gender);

    return {
      question, topic, nowYear, span, windows,
      guiren: Object.assign({}, gr, { years: grYears, months: grMonths, days: grDays }), also, yong,
      empty: windows.length === 0,
    };
  }

  function material(chart, res) {
    if (res.empty) return `【问机】所问:${res.question}(归为${res.topic.label})。未来${res.span}年内,程序未扫到该事型的凸出窗口——照实说没有明显当口,别硬编一个。`;
    const w = res.windows.map(y =>
      `${y.year}年(${y.age}岁,${y.gz}${y.dayunGz ? ',走' + y.dayunGz + '运' : ''})分${y.score}:${y.reasons.join(';')}\n` +
      y.months.map(m =>
        `   └ ${m.name}(${m.gz},${m.span})分${m.score}:${m.reasons.join(';')}\n` +
        `      最合的日子:${m.days.map(d => `${d.m}月${d.d}日(${d.gz},黄历${d.almLevel}、日运${d.riLevel})`).join('、') || '(此月无双层都过关之日)'}\n` +
        `      画像:${m.portrait.lines.join(';')}`
      ).join('\n')
    ).join('\n');
    const g = res.guiren;
    return `【问机·三层应期(程序按大运流年流月与择日算死,勿另立结论)】\n所问:${res.question} → 归为「${res.topic.label}」,要答的是「${res.topic.ask}」。\n起卦复核取用:${res.yong.note}。\n\n[窗口]\n${w}\n\n[贵人]\n${g.note}${g.years.length ? '\n未来逢天乙之年:' + g.years.map(x => x.year + '(' + x.gz + ')').join('、') : ''}${g.months.length ? '\n近两年逢天乙之月:' + g.months.slice(0, 6).map(x => x.year + '年' + x.idx + '月(' + x.gz + ')').join('、') : ''}${g.days.length ? '\n最近的贵人日:' + g.days.map(x => x.iso).join('、') : ''}\n\n[同期还会有的事]\n${res.also.map(a => a.label + ':' + a.items.map(i => i.year + '年(' + i.why + ')').join('、')).join('\n') || '(无其他凸出事型)'}\n\n【写法要求】开口第一句就把最近的窗口说死:哪一年、哪几个月、哪几天。然后依次讲清:为什么是这几年、这几个月的哪一段最集中、这几天具体该做什么;那段时间遇到的人或机会是什么路数(模样、性子、行当、从哪认识、方位属相都要说)；贵人从哪个方向来、什么时候露面;同期还会发生什么事。全程大白话,不许出现十神喜忌干支这些名目,不许说「机遇与挑战并存」「顺其自然」这类空话,不许给没有依据的年份。`;
  }

  return { ask, material, classify, portrait, guiRen, dayPicks, monthRange, keyStarOf, TOPICS, WX_PERSON, ZHI_DIR, ZHI_ANIMAL, MEET_BY };
}));
