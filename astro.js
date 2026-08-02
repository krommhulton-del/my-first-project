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
    sun: '你这人的主心骨(自我、精气神)', moon: '你心里那一汪(情绪、安全感、离不开什么)',
    mer: '你的脑子与嘴(想法怎么转、话怎么说)', ven: '你动心的路数(喜欢什么、怎么亲近人)',
    mar: '你的火气与干劲(怎么争、怎么上)', jup: '你的运气口(哪里容易放大、松快)',
    sat: '你的紧箍(哪里收紧、哪里磨你也成你)', ura: '你不按牌理的那一下(说变就变的地方)',
    nep: '你的雾区(理想、迷糊、说不清的向往)',
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
    { deg: 0, orb: 8, key: '合', plain: '搅在一处——这两股劲不分家,好坏都放大' },
    { deg: 60, orb: 4, key: '六合', plain: '帮衬——顺手就能借上力' },
    { deg: 90, orb: 6, key: '刑', plain: '磨——两头别着劲,出事也出功夫' },
    { deg: 120, orb: 6, key: '拱', plain: '顺滑——不费劲就通,容易理所当然' },
    { deg: 180, orb: 8, key: '冲', plain: '拉扯——两头来回摆,压到一头另一头翘' },
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
    if (homes.includes(sign)) return { st: '入庙', plain: '落在自家地界,这股劲使得顺、成色足' };
    if (EXALT[key] === sign) return { st: '旺', plain: '落在抬它的地界,劲头比平常足' };
    if (homes.map(opp).includes(sign)) return { st: '陷', plain: '落在对家地界,这股劲得绕着使,费一倍功夫' };
    if (EXALT[key] && opp(EXALT[key]) === sign) return { st: '落', plain: '落在压它的地界,起劲慢、容易泄' };
    return null;
  }
  const SIGN_CHAR = {
    白羊: '冲在头里,先动手再盘算,火来得快去得也快', 金牛: '认实惠不认虚话,慢热,攥住了就不撒手',
    双子: '脑子转得比话快,样样通,烦了就换台', 巨蟹: '把人护在壳里,记性长,情绪跟着潮水走',
    狮子: '要台面也撑得起台面,吃软不吃硬', 处女: '眼里揉不下沙子,活儿要挑不出毛病才肯交',
    天秤: '先看关系再看事,两头找平,拖是它的税', 天蝎: '不动声色,盯得深,认定了就到底',
    射手: '要远方要意义,拴不住,话直得扎人', 摩羯: '把日子过成工程,能扛,慢富',
    水瓶: '不合群不是装的,道理大过人情', 双鱼: '边界薄,共情快,容易替别人疼',
  };
  const HOUSE_PLAIN = ['门面与身架', '钱袋与家底', '说话、跑腿与近亲', '家宅与根', '恋爱、玩与孩子', '日常、差事与身体',
    '伴侣与对家', '共财、债与深水', '远方、学问与见识', '名分、事业与顶头', '圈子与同道', '暗处、独处与旧账'];
  const ELEM_OF = i => ['火', '土', '风', '水'][i % 4];
  const MODE_OF = i => ['开创', '固定', '变动'][i % 3];
  const ELEM_PLAIN = {
    火: { strong: '先动后想,劲起得快', miss: '点火难——起心动念慢半拍,常要外头递火才动' },
    土: { strong: '落地、攒得住,不见兔子不撒鹰', miss: '悬空——想得多落得少,钱与日子容易没个抓手' },
    风: { strong: '话与念头不断电,靠说与写立身', miss: '闷——不爱解释,别人猜你费劲' },
    水: { strong: '感受当家,别人的情绪你先接到', miss: '感受那一路不过明路——不是没有,是不入账,攒久了走身体' },
  };
  const MODE_PLAIN = { 开创: '起头的人——开局有瘾,守成没劲', 固定: '守成的人——认准就钉死,转向最贵', 变动: '看风使舵的人——弯道快,直道容易飘' };

  function deepRead(c) {
    const P = c.planets;
    // 一、元素与三态失衡(9 曜逐个点数;日月是大头,占两票)
    const ec = { 火: 0, 土: 0, 风: 0, 水: 0 }, mc = { 开创: 0, 固定: 0, 变动: 0 };
    for (const k of KEYS) {
      const i = SIGNS.indexOf(P[k].sign), w = (k === 'sun' || k === 'moon') ? 2 : 1;
      ec[ELEM_OF(i)] += w; mc[MODE_OF(i)] += w;
    }
    const eSort = Object.entries(ec).sort((a, b) => b[1] - a[1]);
    const missing = eSort.filter(([, v]) => v === 0).map(([k]) => k);
    const domin = eSort[0][1] >= 5 ? eSort[0][0] : null;
    const mSort = Object.entries(mc).sort((a, b) => b[1] - a[1]);
    // 二、庙旺陷落逐星(传统七曜;天海不论)
    const digs = [];
    for (const k of KEYS) { const d = dignity(k, P[k].sign); if (d) digs.push({ key: k, name: P[k].name, sign: P[k].sign, ...d }); }
    const good = digs.filter(d => d.st === '入庙' || d.st === '旺');
    const badd = digs.filter(d => d.st === '陷' || d.st === '落');
    // 三、图形相位(星群/大三角/T三角;大十字九曜带常规容许度极难凑齐,不设——设了就是死条)
    const asps = aspectsOf(P);
    const pat = [];
    const bySign = {};
    for (const k of KEYS) (bySign[P[k].sign] = bySign[P[k].sign] || []).push(P[k].name);
    for (const [s, arr] of Object.entries(bySign)) if (arr.length >= 3) pat.push({ kind: '星群', sign: s, who: arr, plain: `${s}里挤了 ${arr.length} 颗星(${arr.join('、')}):这个星座的事在你身上浓度超标,${SIGN_CHAR[s].split(',')[0]}——好处坏处都是它给的` });
    const has = (a, b, t) => asps.some(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.asp === t);
    const names = KEYS.map(k => P[k].name);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) for (let k2 = j + 1; k2 < names.length; k2++) {
      const [a, b, cc] = [names[i], names[j], names[k2]];
      if (has(a, b, '拱') && has(b, cc, '拱') && has(a, cc, '拱')) pat.push({ kind: '大三角', who: [a, b, cc], plain: `${a}、${b}、${cc}拱成一圈(大三角):这三股劲互相递力,是天生顺的那条环——顺到容易偷懒,得有意识拿它干正事` });
      for (const [x, y, z] of [[a, b, cc], [a, cc, b], [b, cc, a]])
        if (has(x, y, '冲') && has(x, z, '刑') && has(y, z, '刑')) pat.push({ kind: 'T三角', who: [x, y, z], apex: z, plain: `${x}冲${y},两头又都刑${z}(T 三角):${z}是全盘的泄压口,大事小情最后都挤到它头上——把${z}管的那一摊安顿好,一盘都松` });
    }
    // 四、命主星(要上升;天蝎水瓶双鱼按传统主星,冥王未做照实说)
    let ruler = null;
    if (c.asc) {
      const rk = RULER[c.asc.sign], rp = P[rk];
      ruler = { key: rk, name: rp.name, sign: rp.sign, house: c.houses ? c.houses[rk] : null,
        plain: `你的命主星(上升${c.asc.sign}的主星)是${rp.name},落${rp.sign}${c.houses ? `第${c.houses[rk]}宫(${HOUSE_PLAIN[c.houses[rk] - 1]})` : ''}——一盘的方向盘握在这颗星手里,它顺你就顺` };
    }
    // 五、最紧的硬相位(终身课题)
    const hard = asps.filter(x => x.asp === '刑' || x.asp === '冲')[0] || null;
    // 六、因果链叙事(先答案后凭据;连词写死因果,不许并列短句堆)
    const sunP = P.sun, moonP = P.moon;
    const se = ELEM_OF(SIGNS.indexOf(sunP.sign)), me = ELEM_OF(SIGNS.indexOf(moonP.sign));
    const pairOK = (se === me) || (se === '火' && me === '风') || (se === '风' && me === '火') || (se === '土' && me === '水') || (se === '水' && me === '土');
    const verdict = `明面是${sunP.sign}(${SIGN_CHAR[sunP.sign].split(',')[0]}),里子是${moonP.sign}(${SIGN_CHAR[moonP.sign].split(',')[0]})` +
      (c.asc ? `,门面挂的是${c.asc.sign}` : '') + '——' +
      (se === me ? '表里一条道,痛快也好懂。' : pairOK ? '一明一暗合得拢,互相递劲。' : '明面里子两套账,外人只看得见一半,自己得两头都喂。');
    let story = `先看底子:${domin ? `九曜里${domin}最重,${ELEM_PLAIN[domin].strong}——这是出厂设置` : `四样元素分得开,${eSort[0][0]}略重(${ELEM_PLAIN[eSort[0][0]].strong})`}` +
      (missing.length ? `;而${missing.join('、')}一票没有,${missing.map(m => ELEM_PLAIN[m].miss).join(';')}——这不是毛病,是配置,后头的事都从这儿来` : '') + '。';
    story += `因为主心骨(太阳)落在${sunP.sign},${SIGN_CHAR[sunP.sign]}`;
    const sd = dignity('sun', sunP.sign);
    if (sd) story += `,又${sd.plain}`;
    if (c.houses) story += `,摆在第${c.houses.sun}宫——所以你的正事在「${HOUSE_PLAIN[c.houses.sun - 1]}」这一摊,劲要往这儿使`;
    story += `。可里子(月亮)要的是${moonP.sign}那一套——${SIGN_CHAR[moonP.sign]}` +
      (se === me || pairOK ? ',好在与明面递得上劲,不打架。' : ':明面要的与心里要的不是一样东西,所以外人按明面待你,你自己得记得给里子留口粮。');
    if (good.length) story += `这盘里最得力的是${good[0].name}(${good[0].st},${good[0].plain})——${good[0].name === '太阳' ? '主心骨本身' : PLAIN[good[0].key].split('(')[0]}是长项,可着劲用。`;
    if (badd.length) story += `最费劲的是${badd[0].name}(${badd[0].st}):${PLAIN[badd[0].key].split('(')[0]}那一摊天生要多花一倍功夫——知道贵,别硬省。`;
    if (pat.length) story += pat[0].plain + '。';
    if (hard) story += `全盘拧得最紧的一处:${hard.a}${hard.asp}${hard.b}(只差${hard.orb}°)——${hard.aPlain.split('(')[0]}与${hard.bPlain.split('(')[0]}这两股劲长期别着;这是终身课题,处法是轮流喂,不是选边。`;
    if (mSort[0][1] >= 5) story += `办事的路数上,你是${MODE_PLAIN[mSort[0][0]]}。`;
    return { verdict, story, elems: ec, modes: mc, missing, domin, digs, pat, ruler, hard,
      moonCaveat: moonP.nearCusp ? '月亮近星座交界(±0.3°定不死),里子那几句得两个星座都看看。' : '' };
  }

  // ══════════ 行运(时空盘看未来):把任一天的天空叠在本命盘上,逐日扫出应期窗口 ══════════
  // 排盘层:行运星位置与本命同一套星历,可核可验。**应期解读是通行占星口径,零回测**。
  const lonAt = (k, jd) => k === 'moon' ? moonPos(jd).lon : geo(k, (jd - 2451545) / 365250).lon;
  const dateOfJd = jd => new Date((jd - 2440587.5 - 69 / 86400) * 86400000);
  const fmtD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const MOVER_TR = { jup: '木星', sat: '土星', ura: '天王星', nep: '海王星' };
  const T_SHORT = { sun: '主心骨', moon: '心里那一汪', mer: '脑子与嘴', ven: '动心与人缘', mar: '火气与干劲', asc: '门面与身架', mc: '名分与事业' };
  const TRANS_SAY = {
    jup: { 合: '放大年:{T}这一摊有人递梯子,敢伸手就接得住;毛病是容易把摊子铺过头',
      刑: '机会来得别扭:{T}那头给的甜头带钩,答应之前把代价问清', 拱: '顺风窗:{T}这一摊不用使猛劲,把现成的路走宽就是',
      冲: '对面递来的放大镜:抬你的人也架你,{T}这一摊别把话说满' },
    sat: { 合: '验收年:{T}这一摊前几年攒的账一并清算——扎实的落定,虚的拆掉;累,但落下来的都归你',
      刑: '压测:{T}这一摊被摁进慢车道,躲不过;把该补的课补了,压力到点自己撤', 拱: '打地基:{T}这一摊进展不快,但这阵子定下的规矩往后十年都用得上',
      冲: '对家来对账:{T}这一摊有人跟你较真,含糊过不去,拿凭据说话' },
    ura: { 合: '掀桌:{T}这一摊旧格局待不住了,变化多半来得突然——留好退路,但别死守旧摊',
      刑: '电门:{T}这一摊说变就变,计划别定死,留三成余地', 拱: '松绑:{T}这一摊有不伤根基的新路,试新的成本这阵子最低',
      冲: '对面掀桌:变化从别人那头来,{T}这一摊被动的成分大,先稳住自己那半' },
    nep: { 合: '起雾:{T}这一摊看不真——理想化、错认、账目糊;凡要签字的,拿给明白人过目',
      刑: '漏水:{T}这一摊有说不清的损耗,界限画清,别替人扛糊涂账', 拱: '开窍:{T}这一摊的直觉与想象这阵子好使,宜创作养神,不宜下重注',
      冲: '对面起雾:别人给的图景打七折听,兑现看行动不看话' },
  };
  const T_ASPS = [{ deg: 0, key: '合' }, { deg: 90, key: '刑' }, { deg: 120, key: '拱' }, { deg: 180, key: '冲' }];
  function transits(natal, fromDate, months) {
    months = months || 12;
    const jd0 = jdOf(fromDate), nDays = Math.round(months * 30.44), ORB = 2;
    const targets = [];
    for (const k of ['sun', 'moon', 'mer', 'ven', 'mar']) targets.push({ k, lon: natal.planets[k].lon, approx: natal.planets[k].approx });
    if (natal.asc) { targets.push({ k: 'asc', lon: natal.asc.lon }); targets.push({ k: 'mc', lon: natal.asc.mc }); }
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
          (m === 'sat' ? '土星回归(约二十九年半一回):上一轮怎么活的,这两年逐项验收;推着你把「该定的」定下来——熬过去换的是自己的骨架' :
            '木星回归(约十二年一回):新一轮扩张的起点,这阵子起的头会长十二年') :
          TRANS_SAY[m][asp.key].replace(/\{T\}/g, T_SHORT[tk]);
        wins.push({ mover: MOVER_TR[m], target: T_SHORT[tk], asp: asp.key,
          from: fmtD(dateOfJd(jd0 + g[0].d)), to: fmtD(dateOfJd(jd0 + g[g.length - 1].d)),
          exact: exact.map(d => fmtD(dateOfJd(jd0 + d))), passes: exact.length, ret: !!isRet,
          weight: (isRet ? 10 : { sat: 8, ura: 7, nep: 6, jup: 5 }[m]) + (tk === 'sun' || tk === 'moon' || tk === 'asc' ? 2 : 0) + (asp.key === '合' || asp.key === '冲' ? 1 : 0),
          plain: say + (approx ? '(压的是本命月亮,位置±0.3°,应期得放宽几天)' : '') });
      }
    };
    for (const m of movers) {
      for (const t of targets) for (const asp of T_ASPS) scanOne(m, t.k, t.lon, asp, t.approx, false);
      const r = rets.find(x => x.k === m);
      if (r) scanOne(m, r.k, r.lon, T_ASPS[0], false, true);
    }
    wins.sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : b.weight - a.weight);
    const main = wins.slice().sort((a, b) => b.weight - a.weight)[0] || null;
    return { from: fmtD(fromDate), months, wins,
      verdict: !wins.length ? `未来${months}个月慢星不压你本命的要害——大格局无大动,日子按小年过,具体起落看月运。` :
        `未来${months}个月的主戏:${main.mover}${main.asp}你的${main.target}(${main.from}${main.to !== main.from ? '~' + main.to : ''}` +
        `${main.passes > 1 ? `,来回${main.passes}次,精确应期 ${main.exact.join('、')}` : `,应期${main.exact[0]}`})。${main.plain}` };
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
    const MSAY = { sun: '这几天灯照在{T}上——这一摊被看见,该露面露面', mer: '这几天的话与文书都绕着{T}走——该谈的趁这几天谈',
      ven: '这几天人缘的甜头落在{T}——软事(人情、和解、示好)挑这几天办', mar: '这几天的火落在{T}——干仗与赶工都在这儿,火气也在这儿,别双押' };
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
          if (best) evs.push({ date: fmtD(dateOfJd(jd0 + best.d)), mover: PLANET_CN[m], asp: asp.key, target: T_SHORT[t.k],
            hard: asp.key === '刑' || asp.key === '冲',
            plain: MSAY[m].replace(/\{T\}/g, T_SHORT[t.k]) + (asp.key === '刑' ? ';不过这一下是别着劲来的,顺序错一步就呛' : asp.key === '冲' ? ';劲从对面来,接得住是助力,接不住是顶撞' : '') });
        }
      }
    }
    evs.sort((a, b) => a.date < b.date ? -1 : 1);
    // 朔望落宫(要上升才有宫;没有就只报星座)
    const luns = lunations(fromDate, N).map(l => {
      const si = Math.floor(l.lon / 30);
      const house = natal.asc ? ((si - Math.floor(natal.asc.lon / 30) + 12) % 12 + 1) : null;
      return { ...l, house, plain: l.kind === '新月' ? `${l.date} ${l.sign}新月${house ? `落你第${house}宫` : ''}:起头的日子——「${house ? HOUSE_PLAIN[house - 1] : SIGN_CHAR[l.sign].split(',')[0]}」这一摊,这天前后开的头带一个月的势` :
        `${l.date} ${l.sign}满月${house ? `落你第${house}宫` : ''}:见分晓的日子——「${house ? HOUSE_PLAIN[house - 1] : SIGN_CHAR[l.sign].split(',')[0]}」这一摊摊牌、收账、情绪也满,别挑这天谈崩` };
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
    return { from: fmtD(fromDate), evs, luns, retro,
      verdict: `这三十五天里快星应期 ${evs.length} 处(其中较劲的 ${hardN} 处)、朔望 ${luns.length} 次` +
        (retro.length ? `,水星有一段走回头路(${retro.map(r => r.from + '~' + r.to).join('、')}:文书、合同、票,签之前多看一遍,旧事重提多半在这段)` : '') +
        '。逐日细账在下面,拣与你正事相关的用,不必天天对表。' };
  }

  // ── 太阳返照盘(生日年运盘):太阳走回本命度数那一刻起盘,管一整年 ──
  function solarReturn(natal, year) {
    const L0 = natal.planets.sun.lon;
    const bd = natal.date;
    let jd = jdOf(new Date(Date.UTC(year, bd.getMonth(), bd.getDate(), 12))) - 3;
    let lo = jd, hi = jd + 6;
    const f = j => { let d = lonAt('sun', j) - L0; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
    while (f(lo) > 0) lo -= 1;
    while (f(hi) < 0) hi += 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
    const at = dateOfJd((lo + hi) / 2);
    const src = chart(at);
    const cross = aspectsOf(src.planets, natal.planets).slice(0, 8);
    const smooth = cross.filter(x => x.asp === '拱' || x.asp === '六合').length, hard = cross.filter(x => x.asp === '刑' || x.asp === '冲').length;
    return { at, date: fmtD(at), chart: src, cross,
      verdict: `太阳在 ${fmtD(at)} 走回你出生那一度(误差<0.01°,这一刻可查天文年历核对)——占星通行做法拿这一刻的天空当你这一年的年运盘。` +
        `返照盘与本命盘之间${smooth > hard ? `顺的多(顺${smooth}拧${hard})——这一年借得上旧底子` : hard > smooth ? `拧的多(拧${hard}顺${smooth})——这一年跟自己的老路数别劲,变阵之年` : `顺拧对半(各${smooth}处)——这一年顺不顺看你把劲用在哪头`}。` };
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
