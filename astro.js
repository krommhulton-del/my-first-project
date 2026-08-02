// astro.js — 西洋星盘引擎(v0.94,板块 E):行星位置、本命盘、相位、双人合盘、组合盘
//
// ── 准确率分级(§三 的规矩,逐层照实)──
//   排盘层·行星:VSOP87D 截断表(data/astro-vsop.js,机器生成),**全序列为客观标准,
//     截断误差逐星实测 ≤2.0″**(1900–2100);太阳另与 najia.sunLongitude(已对公开历书核过节气)互核。
//     未做光行时与光行差(合计约 20″–1′ 量级),对「落在哪个星座哪一度」无碍,照实记。
//   排盘层·月亮:天文年历低精度通行公式,**误差可达 ±0.3°**——月亮近星座交界时结论可能翻,
//     程序会当面提示,不许装作精确。
//   排盘层·上升与宫位:标准公式;**测试用独立方法(地平线搜索)回核**。宫位用整星座制
//     (最古的一种,免去分宫制流派之争);缺钟点或出生地就不排上升,照实说。
//   解读层:相位的「顺滑/拉扯」是**通行占星口径,零回测**,诚实分级与合盘同档,第一屏写明。
//
// ── §四 ──
//   系数表只此一份(data/astro-vsop.js,生成器 tools/build-vsop.mjs);
//   本模块不算任何中式断法;中西两套永不互相计分,只可并排摆。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data/astro-vsop.js'));
  } else { root.Astro = factory(root.AstroVsop); }
}(typeof self !== 'undefined' ? self : this, function (V) {

  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const norm = d => { d %= 360; return d < 0 ? d + 360 : d; };
  const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
  const PLANET_CN = { sun: '太阳', moon: '月亮', mer: '水星', ven: '金星', mar: '火星', jup: '木星', sat: '土星', ura: '天王星', nep: '海王星' };
  const PLAIN = {
    sun: '自我、意志与人生主线', moon: '情绪、安全感与生活习惯',
    mer: '思维、语言与信息', ven: '感情、审美与人际吸引力',
    mar: '行动力、竞争与脾气', jup: '机会、扩张与信念',
    sat: '责任、限制与长期结构', ura: '突变、独立与反常规',
    nep: '想象、直觉与迷失',
  };

  // ── 时间 ──
  // TT−UTC 取 69s(2020 年代实值;误差逐年 ±1s,对行星经度影响 <0.003°,照实记不逐年拟合)
  const jdOf = date => date.getTime() / 86400000 + 2440587.5 + 69 / 86400;

  // ── VSOP87D:日心黄经/黄纬/距离(当日黄道与春分点) ──
  function helio(key, t) {
    const ev = terms => { let s = 0; for (const [p, A, B, C] of terms) s += A * Math.cos(B + C * t) * Math.pow(t, p); return s; };
    const P = V[key];
    return { L: ev(P.L), B: ev(P.B), R: ev(P.R) };
  }
  // 地心黄经/黄纬(几何位置;光行时未做,见抬头)
  function geo(key, t) {
    const e = helio('ear', t);
    if (key === 'sun') {
      return { lon: norm((e.L + Math.PI) * DEG), lat: -e.B * DEG, dist: e.R };
    }
    const p = helio(key, t);
    const xe = e.R * Math.cos(e.B) * Math.cos(e.L), ye = e.R * Math.cos(e.B) * Math.sin(e.L), ze = e.R * Math.sin(e.B);
    const xp = p.R * Math.cos(p.B) * Math.cos(p.L), yp = p.R * Math.cos(p.B) * Math.sin(p.L), zp = p.R * Math.sin(p.B);
    const x = xp - xe, y = yp - ye, z = zp - ze;
    return { lon: norm(Math.atan2(y, x) * DEG), lat: Math.atan2(z, Math.hypot(x, y)) * DEG, dist: Math.hypot(x, y, z) };
  }
  // 月亮:天文年历低精度式(±0.3°,当面标注)
  function moonPos(jd) {
    const T = (jd - 2451545) / 36525;
    const s = d => Math.sin(d * RAD);
    const lon = 218.32 + 481267.881 * T
      + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T)
      + 0.66 * s(235.7 + 890534.22 * T) + 0.21 * s(269.9 + 954397.74 * T)
      - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T);
    const lat = 5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.9 * T)
      - 0.28 * s(318.3 + 6003.2 * T) - 0.17 * s(217.6 - 407332.2 * T);
    return { lon: norm(lon), lat, approx: true };
  }
  const obliquity = jd => (23.439291 - 0.0130042 * ((jd - 2451545) / 36525)) * RAD;

  // ── 上升点(标准公式;tests 用地平线搜索独立回核)──
  function ascendant(jd, lonDeg, latDeg) {
    const gmst = norm(280.46061837 + 360.98564736629 * (jd - 2451545));
    const ramc = norm(gmst + lonDeg) * RAD;              // 当地恒星时(=天顶赤经)
    const eps = obliquity(jd), phi = latDeg * RAD;
    let asc = norm(Math.atan2(-Math.cos(ramc), Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)) * DEG);
    // 地平圈与黄道两大圆交于**对径两点**(上升点与下降点,恰差 180°)。闭式反正切分不清取的是哪头
    // ——独立的地平线搜索测试抓到过它取错(差正好 180°)。用「正在升起」条件校验:
    // 高度随时间上升 ⟺ sin(时角)<0;取错就翻半圈,翻转是精确的(对径)。
    const L = asc * RAD;
    const ra = Math.atan2(Math.sin(L) * Math.cos(eps), Math.cos(L));
    if (Math.sin(ramc - ra) > 0) asc = norm(asc + 180);
    const mc = Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * DEG;
    return { asc, mc: norm(mc), ramc: norm(ramc * DEG) };
  }

  // ── 本命盘 ──
  const KEYS = ['sun', 'moon', 'mer', 'ven', 'mar', 'jup', 'sat', 'ura', 'nep'];
  function chart(date, opts) {
    opts = opts || {};
    const jd = jdOf(date), t = (jd - 2451545) / 365250;
    const planets = {};
    for (const k of KEYS) {
      const p = k === 'moon' ? moonPos(jd) : geo(k, t);
      const sign = Math.floor(norm(p.lon) / 30);
      planets[k] = {
        key: k, name: PLANET_CN[k], plain: PLAIN[k],
        lon: +norm(p.lon).toFixed(3), lat: +(p.lat || 0).toFixed(2),
        sign: SIGNS[sign], deg: +(norm(p.lon) - sign * 30).toFixed(1),
        approx: !!p.approx,
        nearCusp: (norm(p.lon) % 30 < 0.5 || norm(p.lon) % 30 > 29.5) && !!p.approx,
      };
    }
    // 逆行:前后 12 小时黄经差(月亮太阳不论逆)
    for (const k of KEYS) {
      if (k === 'sun' || k === 'moon') continue;
      const a = geo(k, (jd - 0.5 - 2451545) / 365250).lon, b = geo(k, (jd + 0.5 - 2451545) / 365250).lon;
      let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360;
      planets[k].retro = d < 0;
    }
    let asc = null, houses = null, ascNote = '';
    if (opts.lat != null && opts.lon != null && opts.hourKnown !== false) {
      const a = ascendant(jd, opts.lon, opts.lat);
      const sign = Math.floor(a.asc / 30);
      asc = { lon: +a.asc.toFixed(2), sign: SIGNS[sign], deg: +(a.asc - sign * 30).toFixed(1), mc: +a.mc.toFixed(2) };
      houses = {};
      for (const k of KEYS) houses[k] = ((planets[k].sign ? SIGNS.indexOf(planets[k].sign) : 0) - sign + 12) % 12 + 1;
    } else {
      ascNote = '没有钟点或出生地,上升排不了——星座那一层照给,第几宫这一层缺着(整星座制的宫从上升起,起点没有就不硬造)。';
    }
    return { date, jd: +jd.toFixed(5), planets, asc, houses, ascNote,
      moonNote: planets.moon.nearCusp ? '月亮这一格离星座交界不到半度,而月亮用的是低精度公式(±0.3°)——它到底落哪个星座,这里定不死,照实说。' :
        '月亮位置用的是低精度通行公式,误差可达 ±0.3°(其余行星 ≤2″,截断误差逐星实测,见数据文件抬头)。' };
  }

  // ── 相位(通行占星口径:角度与容许度;解读零回测)──
  const ASPECTS = [
    { deg: 0, orb: 8, key: '合', plain: '两种功能绑在一起运作,互相放大,吉凶同源' },
    { deg: 60, orb: 4, key: '六合', plain: '配合顺畅,能互相借力' },
    { deg: 90, orb: 6, key: '刑', plain: '互相牵制,靠长期磨合出成果,压力持续但可控' },
    { deg: 120, orb: 6, key: '拱', plain: '天然协调,不费力,也因此容易被闲置' },
    { deg: 180, orb: 8, key: '冲', plain: '两端拉扯,常要在两种需求之间分场合取舍' },
  ];
  function aspectsOf(pa, pb) {
    const out = [];
    const A = Object.values(pa), B = pb ? Object.values(pb) : null;
    const pairs = [];
    if (B) { for (const x of A) for (const y of B) pairs.push([x, y]); }
    else { for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) pairs.push([A[i], A[j]]); }
    for (const [x, y] of pairs) {
      let d = Math.abs(x.lon - y.lon); if (d > 180) d = 360 - d;
      for (const asp of ASPECTS) {
        if (Math.abs(d - asp.deg) <= asp.orb) {
          out.push({ a: x.name, b: y.name, asp: asp.key, plain: asp.plain,
            orb: +Math.abs(d - asp.deg).toFixed(1),
            aPlain: x.plain, bPlain: y.plain, approx: x.approx || y.approx });
          break;
        }
      }
    }
    out.sort((p, q) => p.orb - q.orb);
    return out;
  }

  // ── 双人合盘(synastry)与组合中点盘(composite)──
  function synastry(c1, c2) {
    const cross = aspectsOf(c1.planets, c2.planets);
    // 组合盘:逐星取短弧中点
    const comp = {};
    for (const k of KEYS) {
      const a = c1.planets[k].lon, b = c2.planets[k].lon;
      let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360;
      const mid = norm(a + d / 2), sign = Math.floor(mid / 30);
      comp[k] = { key: k, name: PLANET_CN[k], plain: PLAIN[k], lon: +mid.toFixed(2),
        sign: SIGNS[sign], deg: +(mid - sign * 30).toFixed(1), approx: c1.planets[k].approx || c2.planets[k].approx };
    }
    const smooth = cross.filter(x => x.asp === '拱' || x.asp === '六合').length;
    const hard = cross.filter(x => x.asp === '刑' || x.asp === '冲').length;
    return { cross, comp,
      tone: smooth > hard ? `顺的多(顺 ${smooth} 处、拧 ${hard} 处):这两副盘搭起来省劲` :
        hard > smooth ? `拧的多(拧 ${hard} 处、顺 ${smooth} 处):处得成,但费功夫的地方明摆着` :
        `顺与拧对半(各 ${smooth}、${hard} 处):看你们把劲用在哪一头`,
    };
  }

  // ══════════ 解读加厚(v0.98)——缘起:用户 2026-08-02「星盘解读一坨屎,赶快搞好」 ══════════
  // 病根自查:v0.94 的解读层只有「每星一句标签+每相位一句标签」——没有落座、没有庙旺、
  // 没有格局、没有失衡、没有任何预测。下面这一整层都是**程序按通行占星口径算死的**(§五),
  // 口径出处:庙旺陷落是托勒密传统表(客观可核的表);元素三态、图形相位、行运、返照是
  // 现代占星通行做法。**解读层照旧零回测**,与中式永不互相计分。冥王星本程序未做,
  // 天蝎主星取传统口径火星(照实说,不是漏)。
  const RULER = { 白羊: 'mar', 金牛: 'ven', 双子: 'mer', 巨蟹: 'moon', 狮子: 'sun', 处女: 'mer', 天秤: 'ven', 天蝎: 'mar', 射手: 'jup', 摩羯: 'sat', 水瓶: 'sat', 双鱼: 'jup' };
  const EXALT = { sun: '白羊', moon: '金牛', mer: '处女', ven: '双鱼', mar: '摩羯', jup: '巨蟹', sat: '天秤' };
  function dignity(key, sign) {
    const homes = Object.keys(RULER).filter(s => RULER[s] === key);
    if (!homes.length) return null;                     // 天海无传统庙旺,不论(照实说)
    const opp = s => SIGNS[(SIGNS.indexOf(s) + 6) % 12];
    if (homes.includes(sign)) return { st: '入庙', plain: '在自己主管的星座,功能完整,是全盘可靠的支点' };
    if (EXALT[key] === sign) return { st: '旺', plain: '在擢升它的星座,发挥高于平均水平' };
    if (homes.map(opp).includes(sign)) return { st: '陷', plain: '在对宫星座,发挥受限,这项功能要刻意经营才立得起来' };
    if (EXALT[key] && opp(EXALT[key]) === sign) return { st: '落', plain: '在压制它的星座,起效慢,人在这方面常自我怀疑' };
    return null;
  }
  const SIGN_CHAR = {
    白羊: '行动快,竞争心强,想到就做,耐性短', 金牛: '求稳务实,钱物与感官上有定见,认定的事不轻易改',
    双子: '反应快,靠信息与表达立身,广而不深', 巨蟹: '重感情重归属,护短,情绪随亲近的人起落',
    狮子: '自尊心强,要被认可,肯扛事,受不得冷落', 处女: '重细节重秩序,标准高,先挑毛病后办事',
    天秤: '重关系重分寸,擅长权衡,决断偏慢', 天蝎: '话少心深,洞察与控制欲都强,不轻信人',
    射手: '要自由要意义,乐观直率,受不了拘束', 摩羯: '目标明确,能吃苦,走长线,情感表达节制',
    水瓶: '理性重原则,独立,与人群保持距离', 双鱼: '敏感共情,想象力强,边界与执行力是短板',
  };
  const HOUSE_PLAIN = ['自我与外在形象', '金钱与自有资产', '学习、沟通与近亲', '家庭与根基', '恋爱、子女与创作', '日常事务与健康',
    '婚姻与合作', '共有财产与危机', '高等学问与远行', '事业与社会地位', '朋友圈与愿景', '独处、潜意识与幕后'];
  const ELEM_OF = i => ['火', '土', '风', '水'][i % 4];
  const MODE_OF = i => ['开创', '固定', '变动'][i % 3];
  const ELEM_PLAIN = {
    火: { strong: '行动先于思考,启动快,热得快也冷得快', miss: '缺火:启动力弱,想得多动得慢,常要外部期限或旁人推动才动手' },
    土: { strong: '务实,重结果与积累,不做没把握的事', miss: '缺土:落实力弱,计划多兑现少,钱和日程需要外部结构(记账、定期检查)来托底' },
    风: { strong: '靠语言与信息立身,善沟通,善权衡', miss: '缺风:不习惯解释自己,沟通靠行动代替语言,容易被人误读' },
    水: { strong: '感受力强,情绪与直觉参与所有决定', miss: '缺水:情绪不易被自己察觉,压力倾向积压,最后从身体或突然的爆发找出口' },
  };
  const MODE_PLAIN = { 开创: '习惯主动开局,从零到一强,守成阶段容易松劲', 固定: '认定就不改,耐力强,转向成本高', 变动: '适应力强,随环境调整,方向感需要外部锚点' };

  // 元素↔主星的通行对应(火=火星、土=土星、风=水星、水=月亮),用于「缺某元素」与该元素主星
  // 状态的**合成**:缺位而主星有力,与缺位而主星也失力,是两种完全不同的人——
  // v0.99 之前两条各说各话,同一段里既写「行动力弱」又写「行动力是长项」,行家一眼看穿。
  const ELEM_RULER = { 火: 'mar', 土: 'sat', 风: 'mer', 水: 'moon' };
  const ELEM_COMBO = {
    火: { ok: '不是没有行动力,而是行动不以冲动的形式出现:启动偏慢,一旦决定则持续性强。发力方式靠计划推动,不靠一时上头',
      bad: '行动力确实是短板:启动要靠外部期限、他人推动或既定流程,自驱动的场合最容易拖' },
    土: { ok: '落实力不来自天性而来自纪律:一旦建立制度与流程就极稳,但离开结构就会松散。对策是把重要的事写进固定日程,不靠状态',
      bad: '落实这一环确实薄:计划与兑现之间常年有缺口,需要外部记账、定期复盘这类硬工具补位' },
    风: { ok: '不是不会表达,是不愿意常规社交:表达与分析能力本身在线,只在必要场合启用。对策是主动补一次说明,别让沉默替你发言',
      bad: '沟通确实是弱项:习惯用行动代替解释,容易被长期误读。对策是把关键的事写下来发出去,不指望别人领会' },
    水: { ok: '情绪并非不存在,而是走私人渠道:只在极亲近的人面前显露,外部场合近乎不可见。亲密关系里需要主动说明这一点',
      bad: '情绪确实不易被自己察觉:压力倾向积压,最后从身体或突然的爆发找出口。对策是设固定的复盘时点,不等有感觉才处理' },
  };
  const PERSONAL = ['sun', 'moon', 'mer', 'ven', 'mar'];   // 个人行星
  function deepRead(c) {
    const P = c.planets;
    // 一、元素与三态失衡
    // **口径(本项目定,写明可吵)**:只统计个人行星(日月各 2 票、水金火各 1 票)、上升 1 票、
    // 木土各 1 票;**天王海王不计入**——它们一星座停 7 到 14 年,同代人人手一份,
    // 拿它断个人性格是外行错。v0.98 曾把三颗世代星算进去,于是太阳金牛上升狮子(两个固定)
    // 的盘被算成「开创型」,同一段里自相矛盾;这一版按此口径修掉,并加一致性校验。
    const ec = { 火: 0, 土: 0, 风: 0, 水: 0 }, mc = { 开创: 0, 固定: 0, 变动: 0 };
    const vote = (sign, w) => { const i = SIGNS.indexOf(sign); ec[ELEM_OF(i)] += w; mc[MODE_OF(i)] += w; };
    for (const k of KEYS) {
      if (k === 'ura' || k === 'nep') continue;
      vote(P[k].sign, (k === 'sun' || k === 'moon') ? 2 : 1);
    }
    if (c.asc) vote(c.asc.sign, 1);
    const eSort = Object.entries(ec).sort((a, b) => b[1] - a[1]);
    const missing = eSort.filter(([, v]) => v === 0).map(([k]) => k);
    const domin = eSort[0][1] >= 5 ? eSort[0][0] : null;
    const mSort = Object.entries(mc).sort((a, b) => b[1] - a[1]);
    // 一致性校验:主导三态必须至少与日月上升之一相符,否则不报——统计被中间层带偏时宁可不说
    const coreModes = [MODE_OF(SIGNS.indexOf(P.sun.sign)), MODE_OF(SIGNS.indexOf(P.moon.sign))]
      .concat(c.asc ? [MODE_OF(SIGNS.indexOf(c.asc.sign))] : []);
    const modeOK = coreModes.includes(mSort[0][0]);
    // 二、庙旺陷落逐星(传统七曜;天海不论)
    const digs = [];
    for (const k of KEYS) { const d = dignity(k, P[k].sign); if (d) digs.push({ key: k, name: P[k].name, sign: P[k].sign, ...d }); }
    const good = digs.filter(d => d.st === '入庙' || d.st === '旺');
    const badd = digs.filter(d => d.st === '陷' || d.st === '落');
    const digOf = k => digs.find(d => d.key === k) || null;
    // 二之二、缺位元素 × 该元素主星状态 的**合成**(不许并排各说各的)
    const combos = missing.map(e => {
      const rk = ELEM_RULER[e], rd = digOf(rk), strong = !!(rd && (rd.st === '入庙' || rd.st === '旺'));
      return { elem: e, ruler: PLANET_CN[rk], st: rd ? rd.st : '不在传统庙旺表内', strong,
        plain: `${e}元素在个人行星里缺位,而它的主星${PLANET_CN[rk]}${rd ? '正好' + rd.st : '本身不在传统庙旺表内'}——` +
          (strong ? ELEM_COMBO[e].ok : ELEM_COMBO[e].bad) };
    });
    // 三、图形相位
    // **星群要求至少含一颗个人行星**:三颗世代星(天海)凑一堆是同代人的共同背景,
    // 不是个人特征——v0.98 因此给 1989–1991 年生人人手发了一份「摩羯星群」。
    const asps = aspectsOf(P);
    const pat = [];
    const bySign = {};
    for (const k of KEYS) (bySign[P[k].sign] = bySign[P[k].sign] || []).push(k);
    for (const [sg, keys] of Object.entries(bySign)) {
      if (keys.length < 3) continue;
      const per = keys.filter(k => PERSONAL.includes(k));
      if (!per.length) continue;                 // 纯世代星群:是时代背景不是个人特征,不报
      pat.push({ kind: '星群', sign: sg, who: keys.map(k => PLANET_CN[k]),
        plain: `${sg}座聚了 ${keys.length} 颗星(${keys.map(k => PLANET_CN[k]).join('、')},其中${per.map(k => PLANET_CN[k]).join('、')}属个人行星):` +
          `${sg}的行事方式在你身上权重极高——${SIGN_CHAR[sg]}。长处与代价都从这里来` });
    }
    const has = (a, b, t) => asps.some(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.asp === t);
    const names = KEYS.map(k => PLANET_CN[k]);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) for (let k2 = j + 1; k2 < names.length; k2++) {
      const [a, b, cc] = [names[i], names[j], names[k2]];
      if (has(a, b, '拱') && has(b, cc, '拱') && has(a, cc, '拱')) pat.push({ kind: '大三角', who: [a, b, cc], plain: `${a}、${b}、${cc}构成大三角:这三种功能天然协作,是全盘阻力最小的通道;因为不费力,常年被闲置——把重要事务有意识地放到这条通道上,利用率通常远低于它的能力` });
      for (const [x, y, z] of [[a, b, cc], [a, cc, b], [b, cc, a]])
        if (has(x, y, '冲') && has(x, z, '刑') && has(y, z, '刑')) pat.push({ kind: 'T三角', who: [x, y, z], apex: z, plain: `${x}与${y}对冲,两端又同时刑${z}(T 三角):全盘的压力最终汇到${z}。${z}代表的事项安排得当,整盘都稳;安排不当,问题会反复从这一处爆发` });
    }
    // 四、命主星:**必须报出它的庙旺状态并给结论**(命主星落陷是行家必说的头等判断)
    let ruler = null;
    if (c.asc) {
      const rk = RULER[c.asc.sign], rp = P[rk], rd = digOf(rk);
      const hs = c.houses ? c.houses[rk] : null;
      ruler = { key: rk, name: rp.name, sign: rp.sign, house: hs, dig: rd ? rd.st : null,
        plain: `命主星(上升${c.asc.sign}的主星)是${rp.name},在${rp.sign}${hs ? `第${hs}宫(${HOUSE_PLAIN[hs - 1]})` : ''}` +
          (rd ? `,且${rd.st}` : '') + '。' +
          (rd && (rd.st === '入庙' || rd.st === '旺')
            ? `命主星有力:整盘的推进力可靠,${hs ? `重心落在${HOUSE_PLAIN[hs - 1]}这一块,主动往这个方向使力最顺` : '主动争取的成功率高于被动等待'}`
            : rd && (rd.st === '陷' || rd.st === '落')
              ? `命主星失位:这是全盘头一条要说的——起步与自我推进先天费劲,成事多靠外部结构(团队、制度、期限)托一把;${hs ? `吃力最明显的场合在${HOUSE_PLAIN[hs - 1]}` : '单打独斗最吃亏'}`
              : `命主星无庙旺可论(天王海王不在传统庙旺表内),按落宫看:重心在${hs ? HOUSE_PLAIN[hs - 1] : '需要出生时间才能定'}`) };
    }
    // 五、最紧的硬相位(终身课题)
    const hard = asps.filter(x => x.asp === '刑' || x.asp === '冲')[0] || null;
    // 六、叙事:**连词只连真依赖**——v0.98 强制每句带「因为」,产出过「因为底子不厚不薄,所以财重」
    // 这类假推理,比并列短句更糟。这一版只在真有因果的两处用因果连词。
    const sunP = P.sun, moonP = P.moon;
    const se = ELEM_OF(SIGNS.indexOf(sunP.sign)), me = ELEM_OF(SIGNS.indexOf(moonP.sign));
    const pairOK = (se === me) || (se === '火' && me === '风') || (se === '风' && me === '火') || (se === '土' && me === '水') || (se === '水' && me === '土');
    const verdict = `太阳${sunP.sign}(${SIGN_CHAR[sunP.sign].split('，')[0]}),月亮${moonP.sign}(${SIGN_CHAR[moonP.sign].split('，')[0]})` +
      (c.asc ? `,上升${c.asc.sign}` : '') + '——' +
      (se === me ? '外在表现与内在需要一致,表里如一,行为好预判,内耗小。' : pairOK ? '外在与内在不同路但互补,一动一静互相支撑。' : '外在追求与内在需要方向不同:别人看到的你和你自己感受到的你有差距,两边都要给到位置——长期只顾一头,另一头会出问题。');
    let story = `先看配置:${domin ? `个人行星里${domin}元素最重——${ELEM_PLAIN[domin].strong}` : `四种元素分布尚均,${eSort[0][0]}略多(${ELEM_PLAIN[eSort[0][0]].strong})`}` +
      (combos.length ? `。${combos.map(x => x.plain).join('。')}` : '') + '。';
    story += `太阳(自我与主线)在${sunP.sign}——${SIGN_CHAR[sunP.sign]}`;
    const sd = dignity('sun', sunP.sign);
    if (sd) story += `,且${sd.plain}`;
    if (c.houses) story += `,落第${c.houses.sun}宫;因此人生的主战场在「${HOUSE_PLAIN[c.houses.sun - 1]}」,重要决定按这条主线取舍`;
    story += `。月亮(情绪与安全感)在${moonP.sign}:内在按「${SIGN_CHAR[moonP.sign]}」的方式运转` +
      (se === me || pairOK ? ',与太阳同路或互补,内外取向一致,无明显冲突。' : ';这套需要与太阳的方向不同,亲密关系和独处时要按月亮的规矩来——长期拿外在标准压内在需要,是这类配置最常见的内耗来源。');
    if (good.length) {
      const g = good[0], gh = c.houses ? c.houses[g.key] : null;
      story += `全盘最可靠的一颗星是${g.name}(${g.st}):${PLAIN[g.key]}是长项` +
        (gh ? `,最见效的场合是${HOUSE_PLAIN[gh - 1]}` : '') + ',决策与抗压优先依赖这一部分。';
    }
    if (badd.length) {
      const b = badd[0], bh = c.houses ? c.houses[b.key] : null;
      story += `最吃力的一颗是${b.name}(${b.st}):${PLAIN[b.key]}这部分天生费劲` +
        (bh ? `,集中显现在${HOUSE_PLAIN[bh - 1]}这一块` : '') + ',补法是外部方法与固定流程,不靠临场发挥。';
    }
    if (ruler && ruler.dig && (ruler.dig === '陷' || ruler.dig === '落')) story += ruler.plain + '。';
    if (pat.length) story += pat[0].plain + '。';
    if (hard) {
      const ka = KEYS.find(k => PLANET_CN[k] === hard.a), kb = KEYS.find(k => PLANET_CN[k] === hard.b);
      const ha = c.houses && ka ? c.houses[ka] : null, hb = c.houses && kb ? c.houses[kb] : null;
      story += `全盘最紧的硬相位:${hard.a}${hard.asp}${hard.b}(相差仅${hard.orb}°)。${hard.a}(${hard.aPlain})与${hard.b}(${hard.bPlain})互相牵制,是需要终身管理的张力;` +
        (ha && hb && ha !== hb
          ? `落点分别在「${HOUSE_PLAIN[ha - 1]}」和「${HOUSE_PLAIN[hb - 1]}」——处理办法是把这两块分到不同时段各自办完,不在同一件事里同时满足两边。`
          : `处理办法是分场合、分时段轮流满足两边,同时兼顾必定两头落空。`);
    }
    if (modeOK && mSort[0][1] >= 5) story += `做事方式上,${MODE_PLAIN[mSort[0][0]]}。`;
    return { verdict, story, elems: ec, modes: mc, missing, domin, digs, pat, ruler, hard, combos, modeOK,
      moonCaveat: moonP.nearCusp ? '月亮位置临近星座交界(公式误差±0.3°),与内在相关的判断请把相邻星座的描述也对照看。' : '' };
  }

  // ══════════ 行运(时空盘看未来):把任一天的天空叠在本命盘上,逐日扫出应期窗口 ══════════
  // 排盘层:行运星位置与本命同一套星历,可核可验。**应期解读是通行占星口径,零回测**。
  const lonAt = (k, jd) => k === 'moon' ? moonPos(jd).lon : geo(k, (jd - 2451545) / 365250).lon;
  const dateOfJd = jd => new Date((jd - 2440587.5 - 69 / 86400) * 86400000);
  const fmtD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const MOVER_TR = { jup: '木星', sat: '土星', ura: '天王星', nep: '海王星' };
  const T_SHORT = { sun: '本命太阳', moon: '本命月亮', mer: '本命水星', ven: '本命金星', mar: '本命火星', asc: '上升点', mc: '天顶' };
  // 行运判语落到生活领域:每条 = 结论 + 通常表现 + 做法,不许拿比喻凑数
  const T_DOMAIN = { sun: '你本人的目标、状态与健康', moon: '情绪、家庭与居住', mer: '沟通、学业与文书合同', ven: '感情、金钱与合作', mar: '行动、竞争与冲突', asc: '个人整体际遇', mc: '事业方向与名声' };
  const TRANS_SAY = {
    jup: { 合: '扩张窗口:{T}上机会密度明显高于平常,容易得到资源与信任。这类行运最常见的损耗是同时推进的事项过多——选一条主线推进,其余暂缓',
      刑: '机会带条件:{T}上出现的好事与现有安排相冲,接之前先算清要让出什么;两头都要,通常两头都受损',
      拱: '顺风段:{T}上推进现有计划阻力最小;此类时段的常见结果是空过,有既定计划的人获益最大',
      冲: '来自他人的抬举:{T}上别人给的承诺与期待偏高,机会是真的,兑现按七成估,合同条款照常抠' },
    sat: { 合: '结算定形:{T}上过去几年的积累在这段时间定型——扎实的固化为长期结构,虚的被拆掉。实际感受多为负担重、进度慢;这段确立的框架通常管十年以上',
      刑: '硬考核:{T}上外部标准收紧,回避无效,补足短板是唯一出路;压力有明确期限,窗口一过自行减轻',
      拱: '筑基段:{T}上适合立规矩、签长约、做长期投入;进展不快但极稳,此期建立的秩序日后长期受益',
      冲: '对面较真:{T}上有人或制度与你对账,含糊过不去;把凭据、合同、边界事先理清,是过关的具体办法' },
    ura: { 合: '格局松动:{T}上旧安排待不住了,变化常以突发形式出现(调动、搬迁、关系转折)。这类变化多半回不去,顺势重组比原地死守划算,但要留出过渡的余量',
      刑: '不稳定段:{T}上计划易被打断,意外率高;对策是缩短计划周期、不做刚性承诺、留三成余地',
      拱: '低成本试新:{T}上换方法、换领域不伤根基,试错成本这段时间最低,适合把想试的事排进来',
      冲: '变数在对方:{T}上的变化由别人或环境发起,你在应对的一方;先稳住自己可控的部分,再谈条件' },
    nep: { 合: '判断力下降:{T}上易理想化、易被误导,签字画押的事请第三方过目;同期想象力与直觉变好,创作、修养类的事宜做,大额投入缓做',
      刑: '隐性损耗:{T}上有不易察觉的流失(精力、金钱、边界);对策具体到动作:定期对账,把不愿说出口的拒绝说出口',
      拱: '灵感段:{T}上感受力好用,适合创作、学习、休整;不适合大额投入与重大承诺',
      冲: '图景失真:对方或环境呈现给你的{T}与实际有出入;判断以可验证的行动为准,不以口头承诺为准' },
  };
  const T_ASPS = [{ deg: 0, key: '合' }, { deg: 90, key: '刑' }, { deg: 120, key: '拱' }, { deg: 180, key: '冲' }];
  function transits(natal, fromDate, months) {
    months = months || 12;
    const jd0 = jdOf(fromDate), nDays = Math.round(months * 30.44), ORB = 2;
    const targets = [];
    for (const k of ['sun', 'moon', 'mer', 'ven', 'mar']) targets.push({ k, lon: natal.planets[k].lon, approx: natal.planets[k].approx });
    if (natal.asc) { targets.push({ k: 'asc', lon: natal.asc.lon }); targets.push({ k: 'mc', lon: natal.asc.mc }); }
    // 命主星:行运打到它是全盘的事,分量比打到别的星重——v0.98 算了命主星却从不在年运里标它,
    // 「看运势先看行运有没有动到这颗星」那句话自己从不执行。这一版把它接上。
    const rulerK = natal.asc ? RULER[natal.asc.sign] : null;
    if (rulerK && !targets.some(t => t.k === rulerK)) targets.push({ k: rulerK, lon: natal.planets[rulerK].lon, approx: natal.planets[rulerK].approx });
    // 回归两条(土星回归/木星回归)只认「合」
    const rets = [{ k: 'sat', lon: natal.planets.sat.lon }, { k: 'jup', lon: natal.planets.jup.lon }];
    const movers = ['jup', 'sat', 'ura', 'nep'];
    const daily = {};                                   // mover → [逐日黄经]
    for (const m of movers) { daily[m] = []; for (let d = 0; d <= nDays; d++) daily[m].push(lonAt(m, jd0 + d)); }
    const wins = [];
    const scanOne = (m, tk, tlon, asp, approx, isRet) => {
      const hits = [];
      for (let d = 0; d <= nDays; d++) {
        let dd = Math.abs(daily[m][d] - tlon); if (dd > 180) dd = 360 - dd;
        const off = Math.abs(dd - asp.deg);
        if (off <= ORB) hits.push({ d, off });
      }
      if (!hits.length) return;
      // 连续段→组;段间隔 <120 天并成一窗(逆行来回是同一件事的三次应期)
      const groups = [];
      let cur = [hits[0]];
      for (let i = 1; i < hits.length; i++) { if (hits[i].d - hits[i - 1].d <= 1) cur.push(hits[i]); else { groups.push(cur); cur = [hits[i]]; } }
      groups.push(cur);
      const merged = [];
      for (const g of groups) {
        const last = merged[merged.length - 1];
        if (last && g[0].d - last[last.length - 1].d < 120) last.push(...g); else merged.push(g.slice());
      }
      for (const g of merged) {
        // 精确应期:每个连续子段取 off 最小那天
        const exact = [];
        let seg = [g[0]];
        for (let i = 1; i <= g.length; i++) {
          if (i < g.length && g[i].d - g[i - 1].d <= 1) seg.push(g[i]);
          else { exact.push(seg.reduce((a, b) => (b.off < a.off ? b : a)).d); seg = i < g.length ? [g[i]] : []; }
        }
        const say = isRet ?
          (m === 'sat' ? '土星回归(约二十九年半一次,人生结构换代的节点):上一阶段积累的生活结构在这两年逐项受检,该定下的定下,撑不住的散掉。体感是压力与责任明显加重;这两年做的重大选择(职业、婚姻、去留)质量高、管得久' :
            '木星回归(约十二年一次):新一轮成长周期的起点,这一年立项的方向通常能发展十二年,值得把最想做的事在此立起来') :
          TRANS_SAY[m][asp.key].replace(/\{T\}/g, T_DOMAIN[tk]);
        // 截断窗:窗口从扫描第 0 天就开始,说明它在查询起点之前已经开始,此刻只剩尾段。
        // v0.98 曾拿这种伪影当全年主线报(一条 11 天后就结束、精确应期恰好等于今天的尾巴),
        // 内行一眼看穿。**主线不选截断窗**,且当面注明它早已开始。
        const truncStart = g[0].d === 0;
        const isRuler = !isRet && rulerK && tk === rulerK;
        wins.push({ mover: MOVER_TR[m], target: T_SHORT[tk] || PLANET_CN[tk], asp: asp.key,
          from: fmtD(dateOfJd(jd0 + g[0].d)), to: fmtD(dateOfJd(jd0 + g[g.length - 1].d)),
          exact: exact.map(d => fmtD(dateOfJd(jd0 + d))), passes: exact.length, ret: !!isRet,
          truncStart, isRuler, domain: T_DOMAIN[tk] || PLAIN[tk],
          weight: (isRet ? 10 : { sat: 8, ura: 7, nep: 6, jup: 5 }[m]) + (tk === 'sun' || tk === 'moon' || tk === 'asc' ? 2 : 0) + (asp.key === '合' || asp.key === '冲' ? 1 : 0)
            + (isRuler ? 2 : 0) - (truncStart ? 6 : 0),
          plain: say + (isRuler ? '。这一条动的是命主星,牵动的是全盘而不只是这一块,分量要加重看' : '')
            + (truncStart ? '。(此窗在查询起点之前就已开始,当前处于尾段,余下日子按收尾安排)' : '')
            + (approx ? '(此条压的是本命月亮,其位置有±0.3°误差,应期日子请放宽几天看)' : '') });
      }
    };
    for (const m of movers) {
      for (const t of targets) for (const asp of T_ASPS) scanOne(m, t.k, t.lon, asp, t.approx, false);
      const r = rets.find(x => x.k === m);
      if (r) scanOne(m, r.k, r.lon, T_ASPS[0], false, true);
    }
    wins.sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : b.weight - a.weight);
    const rank = wins.slice().sort((a, b) => b.weight - a.weight);
    const main = rank.find(w => !w.truncStart) || rank[0] || null;
    return { from: fmtD(fromDate), months, wins,
      verdict: !wins.length ? `未来${months}个月没有慢行星与你本命的要点成相位——大结构上无事,起落都在短周期里,看月运即可。` :
        `未来${months}个月的主线:${main.mover}${main.asp}${main.target}(${main.from}${main.to !== main.from ? '~' + main.to : ''}` +
        `${main.passes > 1 ? `,因逆行往返${main.passes}次,精确应期 ${main.exact.join('、')}` : `,精确应期 ${main.exact[0]}`})。${main.plain}` };
  }

  // ── 月运:快星(日水金火)+ 朔望,三十五天一张细账 ──
  function lunations(fromDate, days) {
    const jd0 = jdOf(fromDate), out = [];
    let prev = null;
    for (let x = 0; x <= (days || 35) * 4; x++) {
      const jd = jd0 + x / 4;
      let e = lonAt('moon', jd) - lonAt('sun', jd); e = norm(e);
      if (prev != null) {
        for (const [ang, kind] of [[0, '新月'], [180, '满月']]) {
          const a = (prev - ang + 360) % 360, b = (e - ang + 360) % 360;
          if (a > 300 && b < 60) {                       // 跨过 0 点
            let lo = jd - 0.25, hi = jd;
            for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2, dm = (norm(lonAt('moon', mid) - lonAt('sun', mid)) - ang + 360) % 360; if (dm > 300) lo = mid; else hi = mid; }
            const at = dateOfJd((lo + hi) / 2), lonM = lonAt('moon', (lo + hi) / 2), sign = SIGNS[Math.floor(norm(lonM) / 30)];
            out.push({ kind, at, date: fmtD(at), sign, lon: +norm(lonM).toFixed(2) });
          }
        }
      }
      prev = e;
    }
    return out;
  }
  function monthRun(natal, fromDate) {
    const jd0 = jdOf(fromDate), N = 35, ORB = 1;
    const targets = [];
    for (const k of ['sun', 'moon', 'ven', 'mar']) targets.push({ k, lon: natal.planets[k].lon, approx: natal.planets[k].approx });
    if (natal.asc) { targets.push({ k: 'asc', lon: natal.asc.lon }); targets.push({ k: 'mc', lon: natal.asc.mc }); }
    const movers = ['sun', 'mer', 'ven', 'mar'];
    const MSAY = { sun: '太阳过境:{T}这几天成为焦点,适合露面、汇报、推进正事', mer: '水星过境:{T}相关的沟通、谈判与文书这几天办效率最高',
      ven: '金星过境:{T}上的人际事项顺,示好、和解、谈钱都容易谈拢', mar: '火星过境:{T}上劲头与火气一起来,适合攻坚,防同一领域的口角' };
    const evs = [];
    for (const m of movers) {
      const lons = []; for (let d = 0; d <= N; d++) lons.push(lonAt(m, jd0 + d));
      for (const t of targets) {
        if (m === t.k) continue;
        for (const asp of T_ASPS) {
          let best = null;
          for (let d = 0; d <= N; d++) {
            let dd = Math.abs(lons[d] - t.lon); if (dd > 180) dd = 360 - dd;
            const off = Math.abs(dd - asp.deg);
            if (off <= ORB && (!best || off < best.off)) best = { d, off };
          }
          if (best) evs.push({ date: fmtD(dateOfJd(jd0 + best.d)), mover: PLANET_CN[m], asp: asp.key, target: T_SHORT[t.k], domain: T_DOMAIN[t.k],
            hard: asp.key === '刑' || asp.key === '冲',
            plain: MSAY[m].replace(/\{T\}/g, T_DOMAIN[t.k]) + (asp.key === '刑' ? ';以紧张的形式出现,当天先排顺序再动手,不要同时开两件' : asp.key === '冲' ? ';由对方先发起,当天宜接不宜定——先把对方的条件听全,决定挪到次日' : '') });
        }
      }
    }
    evs.sort((a, b) => a.date < b.date ? -1 : 1);
    // 朔望落宫(要上升才有宫;没有就只报星座)
    const luns = lunations(fromDate, N).map(l => {
      const si = Math.floor(l.lon / 30);
      const house = natal.asc ? ((si - Math.floor(natal.asc.lon / 30) + 12) % 12 + 1) : null;
      return { ...l, house, plain: l.kind === '新月' ? `${l.date} ${l.sign}新月${house ? `(落你第${house}宫)` : ''}:适合开头的日子——${house ? HOUSE_PLAIN[house - 1] : '这个星座相关'}的事,这天前后启动的事,顺势期约一个月` :
        `${l.date} ${l.sign}满月${house ? `(落你第${house}宫)` : ''}:见结果的日子——${house ? HOUSE_PLAIN[house - 1] : '这个星座相关'}的事在这两天出阶段性结果,情绪也到高点;适合收尾结算,重大谈判避开` };
    });
    // 水星逆行段(通行口径:文书合同多看一遍;不神化)
    const retro = [];
    let seg = null;
    for (let d = 0; d <= N; d++) {
      const jd = jd0 + d;
      const a = lonAt('mer', jd - 0.5), b = lonAt('mer', jd + 0.5);
      let dd = b - a; if (dd > 180) dd -= 360; if (dd < -180) dd += 360;
      if (dd < 0) { if (!seg) seg = { from: fmtD(dateOfJd(jd)) }; seg.to = fmtD(dateOfJd(jd)); }
      else if (seg) { retro.push(seg); seg = null; }
    }
    if (seg) retro.push(seg);
    const hardN = evs.filter(e => e.hard).length;
    // 第一句必须是结论(铁律二)。v0.98 这里报的是库存清点(「应期 14 处、朔望 2 次」),
    // 换个人也成立,且把「挑哪天」这件本该程序做的事推回给用户。这一版直接点名:
    // 最值得用的一天(软相位里权重最高)、最该避开的一天(硬相位里权重最高)。
    const SOFT_W = { 金星: 4, 木星: 4, 太阳: 3, 水星: 2, 火星: 1 };
    const HARD_W = { 火星: 4, 太阳: 2, 水星: 2, 金星: 1 };
    const best = evs.filter(e => !e.hard).sort((a, b) => (SOFT_W[b.mover] || 0) - (SOFT_W[a.mover] || 0))[0] || null;
    const worst = evs.filter(e => e.hard).sort((a, b) => (HARD_W[b.mover] || 0) - (HARD_W[a.mover] || 0))[0] || null;
    let vd = '';
    if (best) vd += `这三十五天里最好用的一天是 ${best.date}(${best.mover}${best.asp}${best.target}):${best.domain}这一类事排在这天推进,阻力最小。`;
    if (worst) vd += `最该避开的是 ${worst.date}(${worst.mover}${worst.asp}${worst.target}):这天不宜在${worst.domain}上摊牌、签约或硬碰。`;
    if (!best && !worst) vd += '这三十五天快星没有落到你本命的要点上,是平淡的一段,按既定节奏推进即可。';
    const nm = luns.find(l => l.kind === '新月'), fm = luns.find(l => l.kind === '满月');
    if (nm) vd += `要起头的事挑 ${nm.date} 前后(新月)。`;
    if (fm) vd += `要收尾结账挑 ${fm.date} 前后(满月),同期情绪也到高点。`;
    return { from: fmtD(fromDate), evs, luns, retro, best, worst,
      verdict: vd +
        (retro.length ? `水星有一段逆行(${retro.map(r => r.from + '~' + r.to).join('、')}),文书、合同、出行与设备易出岔子,签署前多核对,旧人旧事此段容易回头——适合复盘,不适合开新。` : '') +
        `全期快星应期 ${evs.length} 处(其中带张力的 ${hardN} 处)、朔望 ${luns.length} 次,逐日明细见下。` };
  }

  // ── 太阳返照盘(生日年运盘):太阳走回本命度数那一刻起盘,管一整年 ──
  // **口径改过一次(v0.99)**:v0.98 拿「返照盘对本命盘的软相位数 vs 硬相位数」定年运基调——
  // 没有哪一派这么做,且 n=3~7 的计数毫无区分度,产出的话(「基调由你主动选择的方向决定」)
  // 是放谁身上都成立的空话。这一版改报通行占星真正在看的三样硬信息:
  //   ① 返照盘上升落本命第几宫(这一年的重心搬到哪一块);
  //   ② 返照月亮落本命第几宫(这一年的情绪与日常绕着什么转);
  //   ③ 有没有行星合返照盘的上升/天顶(合四轴的星定这一年的主角)。
  // 前两样要出生地经纬度才排得出,没有就照实说排不了,不拿计数凑数。
  function solarReturn(natal, year, opts) {
    const L0 = natal.planets.sun.lon;
    const bd = natal.date;
    let jd = jdOf(new Date(Date.UTC(year, bd.getMonth(), bd.getDate(), 12))) - 3;
    let lo = jd, hi = jd + 6;
    const f = j => { let d = lonAt('sun', j) - L0; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
    while (f(lo) > 0) lo -= 1;
    while (f(hi) < 0) hi += 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
    const at = dateOfJd((lo + hi) / 2);
    const src = chart(at, opts || {});
    const cross = aspectsOf(src.planets, natal.planets).slice(0, 8);
    const natalAscSign = natal.asc ? Math.floor(natal.asc.lon / 30) : null;
    const houseIn = lon => natalAscSign == null ? null : ((Math.floor(norm(lon) / 30) - natalAscSign + 12) % 12 + 1);
    const srAscH = src.asc ? houseIn(src.asc.lon) : null;
    const moonH = houseIn(src.planets.moon.lon);
    // 合四轴(返照盘自己的上升/天顶):容许度 8°/5°,通行口径
    const angles = [];
    if (src.asc) {
      for (const k of KEYS) {
        for (const [alon, an, orb] of [[src.asc.lon, '上升', 8], [src.asc.mc, '天顶', 5]]) {
          let d = Math.abs(src.planets[k].lon - alon); if (d > 180) d = 360 - d;
          if (d <= orb) angles.push({ key: k, name: PLANET_CN[k], angle: an, orb: +d.toFixed(1), plain: PLAIN[k] });
        }
      }
    }
    let vd = `太阳在 ${fmtD(at)} 走回你出生那一度(误差<0.01°,这一刻可查天文年历核对)——占星通行做法拿这一刻的天空当你这一年的年运盘。`;
    if (srAscH) vd += `这一年的重心落在本命第${srAscH}宫:${HOUSE_PLAIN[srAscH - 1]}——一年里心力与事件密度都往这一块偏,年度计划按它排。`;
    else vd += '返照盘的上升要出生地与钟点才排得出,这里缺,重心那一层不硬给。';
    if (moonH) vd += `情绪与日常绕着本命第${moonH}宫(${HOUSE_PLAIN[moonH - 1]})转,这一年的起伏多半从这里来。`;
    if (angles.length) {
      const a0 = angles.sort((x, y) => x.orb - y.orb)[0];
      vd += `${a0.name}合${a0.angle}(差${a0.orb}°),是这一年的主角星:${a0.plain}这一路会被显著放大,好坏都由它带。`;
    } else if (src.asc) vd += '没有行星合返照盘的四轴,这一年没有单一主角,按上面两条的领域推进即可。';
    return { at, date: fmtD(at), chart: src, cross, ascHouse: srAscH, moonHouse: moonH, angles, verdict: vd };
  }

  const HONEST = '这一页的诚实分级分两层:行星落在哪个星座哪一度(含行运、返照的位置与应期日子)是排盘层,可核可验' +
    '(截断误差逐星实测≤2″,月亮除外——低精度公式±0.3°,近交界当面提示);落座、庙旺、相位、行运的一切「说法」' +
    '是通行占星口径,零回测,与中式那一套永不互相计分。窗口是窗口,不是保票。';

  function material(c, syn, names, extra) {
    let s = '【西洋星盘·程序排定(位置已算死,勿另改)】\n';
    const one = (cc, label) => {
      let x = label ? `【${label}】\n` : '';
      for (const k of KEYS) {
        const p = cc.planets[k];
        const d = dignity(k, p.sign);
        x += `${p.name} ${p.sign}${p.deg}°${p.retro ? '(逆行)' : ''}${cc.houses ? ` 第${cc.houses[k]}宫` : ''}${d ? `(${d.st})` : ''} —— ${p.plain}\n`;
      }
      if (cc.asc) x += `上升 ${cc.asc.sign}${cc.asc.deg}°(整星座制,宫从上升起)\n`;
      if (cc.ascNote) x += cc.ascNote + '\n';
      x += cc.moonNote + '\n';
      return x;
    };
    s += one(c, names && names[0]);
    if (extra && extra.deep) {
      const dp = extra.deep;
      s += '【细读(程序已按通行占星口径算死,勿另立结论)】\n第一句:' + dp.verdict + '\n来路:' + dp.story + '\n';
      if (dp.ruler) s += dp.ruler.plain + '\n';
      if (dp.moonCaveat) s += dp.moonCaveat + '\n';
    }
    if (extra && extra.trans) {
      s += `【年运·行运窗口(位置与日子程序算死;说法零回测)】\n第一句:${extra.trans.verdict}\n`;
      for (const w of extra.trans.wins.slice(0, 10)) s += `${w.from}~${w.to}${w.passes > 1 ? `(来回${w.passes}次:${w.exact.join('、')})` : `(应期${w.exact[0]})`} ${w.mover}${w.asp}${w.target}:${w.plain}\n`;
    }
    if (extra && extra.month) {
      s += `【月运·三十五天细账】\n第一句:${extra.month.verdict}\n`;
      for (const l of extra.month.luns) s += l.plain + '\n';
      for (const e of extra.month.evs.slice(0, 12)) s += `${e.date} ${e.mover}${e.asp}${e.target}:${e.plain}\n`;
    }
    if (extra && extra.sr) s += `【太阳返照(生日年运盘)】\n${extra.sr.verdict}\n` +
      extra.sr.cross.slice(0, 6).map(a => `返照${a.a}×本命${a.b} ${a.asp}(差${a.orb}°):${a.plain}`).join('\n') + '\n';
    if (syn && syn.cross) {
      s += `【两盘相位(${names ? names.join(' × ') : '双人'})】${syn.tone}\n`;
      for (const a of syn.cross.slice(0, 12)) s += `${a.a}×${a.b} ${a.asp}(差${a.orb}°):${a.plain}${a.approx ? '(涉月亮,位置有±0.3°误差)' : ''}\n`;
      s += '【组合盘(逐星中点)】' + KEYS.map(k => `${syn.comp[k].name}${syn.comp[k].sign}`).join(' · ') + '\n';
    } else {
      const asps = aspectsOf(c.planets);
      s += '【盘内相位】\n';
      for (const a of asps.slice(0, 10)) s += `${a.a}×${a.b} ${a.asp}(差${a.orb}°):${a.plain}\n`;
    }
    s += '【写法铁规】①位置与相位程序已算死,勿另立;②' + HONEST +
      '③禁空话禁说教,第一句就是答案;④凶就报凶(拧就说拧在哪、代价是什么),不安慰;' +
      '⑤不替人做去留的决定(铁律十一):只说哪股劲顺哪股劲拧,不说「合适不合适」。';
    return s;
  }

  return { chart, aspectsOf, synastry, material, ascendant, moonPos, geo, jdOf, SIGNS, PLANET_CN, PLAIN, ASPECTS, HONEST, KEYS,
    deepRead, transits, monthRun, solarReturn, lunations, dignity, RULER, EXALT, SIGN_CHAR, HOUSE_PLAIN, lonAt };
}));
