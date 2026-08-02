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

  const HONEST = '这一页的诚实分级分两层:行星落在哪个星座哪一度是排盘层,可核可验(截断误差逐星实测≤2″,' +
    '月亮除外——低精度公式±0.3°,近交界当面提示);相位「顺/拧」的说法是通行占星口径,零回测,' +
    '与中式那一套永不互相计分。当参考,别当判决。';

  function material(c, syn, names) {
    let s = '【西洋星盘·程序排定(位置已算死,勿另改)】\n';
    const one = (cc, label) => {
      let x = label ? `【${label}】\n` : '';
      for (const k of KEYS) {
        const p = cc.planets[k];
        x += `${p.name} ${p.sign}${p.deg}°${p.retro ? '(逆行)' : ''}${cc.houses ? ` 第${cc.houses[k]}宫` : ''} —— ${p.plain}\n`;
      }
      if (cc.asc) x += `上升 ${cc.asc.sign}${cc.asc.deg}°(整星座制,宫从上升起)\n`;
      if (cc.ascNote) x += cc.ascNote + '\n';
      x += cc.moonNote + '\n';
      return x;
    };
    s += one(c, names && names[0]);
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

  return { chart, aspectsOf, synastry, material, ascendant, moonPos, geo, jdOf, SIGNS, PLANET_CN, PLAIN, ASPECTS, HONEST, KEYS };
}));
