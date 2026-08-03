// 西洋星盘专项内测(v0.94,板块 E)
// 缘起:用户点名要西洋合盘(马盘星盘);VSOP87D 系数 2026-08-02 入库(外援抓取,逐字节核过)。
// 这套测试守的是 §三 排盘层的底线——**能对照的全对照**:
//   一、太阳:与 najia.sunLongitude(独立实现,已对公开历书核过节气)互核;
//   二、截断表:生成物自带逐星实测误差,一颗都不许超 30″;
//   三、上升点:公式结果拿**独立方法**(黄道过地平线的暴力搜索)回核;
//   四、儒略日:J2000.0 历元是写死的公论;
//   五、水星逆行率:公论约两成上下,差得远就是几何算错了;
//   六、月亮的 ±0.3° 必须当面写着,近交界必须提示——不许装精确;
//   七、相位与组合盘的数学(边界、对称、短弧);答案之锚;措辞。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Astro = require(join(ROOT, 'astro.js'));
const Najia = require(join(ROOT, 'najia.js'));
const V = require(join(ROOT, 'data', 'astro-vsop.js'));
const Tijian = require(join(ROOT, 'tijian.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const norm = d => { d %= 360; return d < 0 ? d + 360 : d; };

console.log('【一】外部对照:太阳与独立实现互核,历元写死');
t('太阳黄经与 najia.sunLongitude 逐点互核(500 点,1900–2100),最大差 ≤0.02°', () => {
  let maxD = 0;
  for (let i = 0; i < 500; i++) {
    const d = new Date(Date.UTC(1900 + (i * 2) % 200, (i * 5) % 12, 1 + (i * 11) % 28, (i * 7) % 24));
    const sun = Astro.chart(d).planets.sun.lon;
    const nj = Najia.ganZhi(d).sunLon;
    let diff = Math.abs(sun - nj); if (diff > 180) diff = 360 - diff;
    maxD = Math.max(maxD, diff);
  }
  ok(maxD <= 0.02, `两实现最大差 ${maxD.toFixed(4)}°,超了`);
  console.log(`      (最大差 ${maxD.toFixed(4)}°——najia 那头是已对节气历书核过的独立实现)`);
});
// v1.12:ΔT 从写死的 69 秒改成逐年(Espenak–Meeus 分段式,2005 起锚在观测值 69s)。
// 这条钉子跟着改:历元本身不动,ΔT 那一项按当年取。
t('J2000.0 历元:2000-01-01 12:00 UTC 的儒略日 = 2451545.0 + 当年 ΔT', () => {
  const jd = Astro.jdOf(new Date(Date.UTC(2000, 0, 1, 12)));
  ok(Math.abs(jd - 2451545.0 - Astro.deltaT(2000) / 86400) < 1e-6, 'JD 差了:' + jd);
});
t('ΔT 逐年:曲线合乎公认量级,且现代锚在观测值上', () => {
  // 公认量级:1940 年代约 24 秒、1980 年约 50 秒、2000 年约 64 秒、2010 年代起约 69 秒。
  // 差得远就是式子抄错了(这是外部对照:ΔT 是观测量,不是本项目能自证的东西)。
  const near = (y, v, tol) => ok(Math.abs(Astro.deltaT(y) - v) <= tol, `ΔT(${y})=${Astro.deltaT(y).toFixed(1)},该在 ${v}±${tol}`);
  near(1940, 24, 3); near(1960, 33, 3); near(1980, 50, 3); near(2000, 64, 2); near(2024, 69, 1);
  // 单调不倒挂(二十世纪以来 ΔT 一路增大;倒挂说明分段接错了)
  for (let y = 1905; y <= 2004; y++) ok(Astro.deltaT(y + 1) >= Astro.deltaT(y) - 0.6, `ΔT 在 ${y} 附近倒挂了`);
});
t('截断表逐星自带实测误差戳,一颗不许超 30″;生成器抬头写明全序列为标准', () => {
  for (const [k, p] of Object.entries(V)) {
    ok(typeof p.err === 'number' && p.err <= 30, `${k} 误差戳缺失或超限:${p.err}`);
    ok(p.L.length > 20 && p.R.length > 10, `${k} 的截断序列薄得可疑`);
  }
  const gen = readFileSync(join(ROOT, 'tools', 'build-vsop.mjs'), 'utf8');
  ok(/全序列.*客观标准|全序列为标准/.test(gen), '生成器须写明全序列是标准');
});

console.log('【二】上升点:公式拿独立方法(地平线搜索)回核');
t('随机 60 组时间×纬度,公式上升点与暴力搜索差 ≤0.5°', () => {
  const eps = jd => (23.439291 - 0.0130042 * ((jd - 2451545) / 36525)) * RAD;
  for (let i = 0; i < 60; i++) {
    const jd = 2440000 + (i * 977) % 40000;
    const lat = -55 + (i * 13) % 110, lon = -160 + (i * 37) % 320;
    const f = Astro.ascendant(jd, lon, lat);
    // 独立方法:黄道 β=0 逐点找「在地平线上且在东边升起」的那一点。
    // 恒星时按 **UT** 算(jd 是 TT,先减 ΔT)——v1.08 修的真错:此前引擎与本测试
    // 都拿 TT 喂 GMST,两边一起错 17.3′,测试照样绿,这正是「独立方法不独立」的教训。
    // v1.12:ΔT 改逐年,这里跟着取 Astro.deltaT。**共用的是输入(ΔT 是观测量),不是方法**——
    // 求上升点那一步仍是地平线搜索 vs 闭式反解,两条路各走各的。
    const gmst = norm(280.46061837 + 360.98564736629 * (jd - Astro.deltaT(2000 + (jd - 2451545) / 365.25) / 86400 - 2451545));
    const lst = norm(gmst + lon) * RAD, e = eps(jd), phi = lat * RAD;
    let best = null, bestAlt = 99;
    for (let lam = 0; lam < 360; lam += 0.05) {
      const L = lam * RAD;
      const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
      const dec = Math.asin(Math.sin(L) * Math.sin(e));
      const H = lst - ra;
      const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
      // 东边:时角 sin<0(还没过中天)
      if (Math.sin(H) < 0 && Math.abs(alt) < bestAlt) { bestAlt = Math.abs(alt); best = lam; }
    }
    let d = Math.abs(best - f.asc); if (d > 180) d = 360 - d;
    ok(d <= 0.5, `jd=${jd} lat=${lat}:公式 ${f.asc.toFixed(2)} vs 搜索 ${best.toFixed(2)},差 ${d.toFixed(2)}°`);
  }
});

console.log('【三】几何 sanity:逆行率是公论');
t('水星 2020–2029 十年逐日扫:逆行天数占比在 15%–25% 之间(公论约两成)', () => {
  let retro = 0, n = 0;
  for (let d = 0; d < 3650; d += 2) {
    const c = Astro.chart(new Date(Date.UTC(2020, 0, 1 + d)));
    n++; if (c.planets.mer.retro) retro++;
  }
  const rate = retro / n;
  ok(rate > 0.15 && rate < 0.25, `水星逆行率 ${(rate * 100).toFixed(1)}%,不合公论——几何有错`);
  console.log(`      (实测 ${(rate * 100).toFixed(1)}%)`);
});

console.log('【四】月亮的诚实:实测误差当面写,近交界必须喊');
// v1.08 起月亮换 DE421 拟合式(实测 ≤0.0149°),±0.3° 那套话只留给数据缺失的退路。
// 这条测试跟着换口径:声明必须报**新的实测数**,旧的 ±0.3° 不许再出现在正常路径上。
t('moonNote 报实测误差(0.0149°);近交界(0.05° 阈)必须提示;±0.3° 旧话不许残留', () => {
  const c = Astro.chart(new Date(Date.UTC(1990, 4, 20, 1, 30)));
  ok(!c.planets.moon.approx, '数据表在,月亮该走拟合式');
  ok(/0\.0149/.test(c.moonNote), 'moonNote 必须写明实测误差:' + c.moonNote);
  ok(!/±0\.3°/.test(c.moonNote), '正常路径不许再挂旧的 ±0.3°:' + c.moonNote);
  let cusp = null;
  for (let d = 0; d < 400 && !cusp; d++) for (let h = 0; h < 24; h++) {
    const cc = Astro.chart(new Date(Date.UTC(2026, 0, 1 + d, h)));
    if (cc.planets.moon.nearCusp) { cusp = cc; break; }
  }
  ok(cusp, '一年多里竟扫不到一次月亮近交界(阈 0.05°,月亮每小时走约 0.55°,逐时扫必中)——nearCusp 是死条');
  ok(/交界|两个星座/.test(cusp.moonNote), '近交界要提示两个星座都看:' + cusp.moonNote);
});

console.log('【五】相位与组合盘的数学');
t('相位判定:构造精确角度逐档验,容许度边界内收外拒', () => {
  const mk = lons => { const o = {}; Object.keys(lons).forEach((k, i) => { o[k] = { name: k, plain: k, lon: lons[k] }; }); return o; };
  for (const { deg, orb, key } of Astro.ASPECTS) {
    const inA = Astro.aspectsOf(mk({ a: 10, b: norm(10 + deg + orb - 0.1) }));
    ok(inA.length === 1 && inA[0].asp === key, `${key}:边界内没认出来`);
    const out = Astro.aspectsOf(mk({ a: 10, b: norm(10 + deg + orb + 1.1) }));
    ok(!out.some(x => x.asp === key), `${key}:出了容许度还在认`);
  }
});
t('双人相位对称:A×B 与 B×A 条数一致;组合盘中点走短弧且对称', () => {
  const d1 = new Date(Date.UTC(1990, 4, 20, 9, 30)), d2 = new Date(Date.UTC(1993, 10, 7, 20));
  const c1 = Astro.chart(d1), c2 = Astro.chart(d2);
  ok(Astro.aspectsOf(c1.planets, c2.planets).length === Astro.aspectsOf(c2.planets, c1.planets).length, '交叉相位不对称');
  const s12 = Astro.synastry(c1, c2), s21 = Astro.synastry(c2, c1);
  for (const k of Astro.KEYS) {
    ok(s12.comp[k].lon === s21.comp[k].lon, `组合盘 ${k} 不对称`);
    const a = c1.planets[k].lon, b = c2.planets[k].lon, m = s12.comp[k].lon;
    let arc = Math.abs(a - b); if (arc > 180) arc = 360 - arc;
    let dm = Math.abs(a - m); if (dm > 180) dm = 360 - dm;
    ok(dm <= arc / 2 + 0.01, `组合盘 ${k} 中点没走短弧`);
  }
});

console.log('【六】答案之锚与边界');
t('同一时刻反复排三十次,逐字节一致', () => {
  const d = new Date(Date.UTC(1988, 2, 12, 6));
  const first = JSON.stringify(Astro.chart(d, { lat: 31.2, lon: 121.5 }));
  for (let i = 0; i < 30; i++) ok(JSON.stringify(Astro.chart(d, { lat: 31.2, lon: 121.5 })) === first, '第' + i + '次不一致');
});
t('缺钟点或地点:上升不硬造,照实说缺什么', () => {
  const c = Astro.chart(new Date(Date.UTC(1990, 4, 20, 9, 30)));
  ok(!c.asc && !c.houses, '缺地点竟排出了上升');
  ok(/上升排不了/.test(c.ascNote), '要写明为什么没有上升:' + c.ascNote);
});

console.log('【七】措辞与诚实分级');
t('行星白话、相位白话过体检员;HONEST 写明零回测与两套不互相计分', () => {
  for (const s of [...Object.values(Astro.PLAIN), ...Astro.ASPECTS.map(a => a.plain)]) {
    const rep = Tijian.check(s, {});
    const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
    ok(!bad.length, `体检不过:${s} → ${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
  }
  ok(/零回测/.test(Astro.HONEST) && /不互相计分/.test(Astro.HONEST), 'HONEST 缺关键句');
  const c1 = Astro.chart(new Date(Date.UTC(1990, 4, 20))), c2 = Astro.chart(new Date(Date.UTC(1993, 10, 7)));
  const m = Astro.material(c1, Astro.synastry(c1, c2), ['甲', '乙']);
  ok(/勿另立|勿另改/.test(m) && /铁律十一|不替人做去留/.test(m), '材料缺铁规');
});

// ══════════ v0.98 解读加厚与行运(缘起:用户 2026-08-02「星盘解读一坨屎,赶快搞好」——
// v0.94 的解读只有每星一句标签;这一轮补庙旺/失衡/图形相位/因果链细读 + 年运月运返照)══════════
const Lunar = require(join(ROOT, 'lunar.js'));

console.log('【八】庙旺陷落:托勒密传统表手写进测试,逐格对照(外部对照)');
t('主星表 12 格与曜升表 7 格逐格对手写标准;陷落必须恰是庙旺的对宫', () => {
  const RULER_STD = { 白羊: 'mar', 金牛: 'ven', 双子: 'mer', 巨蟹: 'moon', 狮子: 'sun', 处女: 'mer', 天秤: 'ven', 天蝎: 'mar', 射手: 'jup', 摩羯: 'sat', 水瓶: 'sat', 双鱼: 'jup' };
  const EXALT_STD = { sun: '白羊', moon: '金牛', mer: '处女', ven: '双鱼', mar: '摩羯', jup: '巨蟹', sat: '天秤' };
  for (const [s, k] of Object.entries(RULER_STD)) ok(Astro.RULER[s] === k, `主星表 ${s} 应为 ${k},实为 ${Astro.RULER[s]}`);
  for (const [k, s] of Object.entries(EXALT_STD)) ok(Astro.EXALT[k] === s, `曜升表 ${k} 应为 ${s}`);
  const opp = s => Astro.SIGNS[(Astro.SIGNS.indexOf(s) + 6) % 12];
  ok(Astro.dignity('sun', '狮子').st === '入庙' && Astro.dignity('sun', '白羊').st === '旺', '太阳庙旺错了');
  ok(Astro.dignity('sun', opp('狮子')).st === '陷' && Astro.dignity('sun', opp('白羊')).st === '落', '陷落必须是庙旺的对宫');
  ok(Astro.dignity('moon', '巨蟹').st === '入庙' && Astro.dignity('moon', '天蝎').st === '落', '月亮的庙与落错了');
  ok(Astro.dignity('mar', '天蝎').st === '入庙', '天蝎传统主星是火星(冥王未做,照实取传统口径)');
  ok(Astro.dignity('ura', '水瓶') === null && Astro.dignity('nep', '双鱼') === null, '天海无传统庙旺,必须不论——论了就是编');
});

console.log('【九】朔望拿农历初一交叉核(lunar.js 是独立实现、已对公开历书核过)');
t('连扫 26 个新月,折成北京日期后逐个对初一;满月与新月必须交替', () => {
  const luns = Astro.lunations(new Date(Date.UTC(2026, 0, 1)), 390);
  const news = luns.filter(l => l.kind === '新月');
  ok(news.length >= 12 && news.length <= 14, '一年该有 12–13 个新月,实得 ' + news.length);
  let hit = 0;
  for (const l of news) {
    const bj = new Date(l.at.getTime() + 8 * 3600 * 1000);
    const d0 = new Date(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
    const days = [0, -1, 1].map(off => Lunar.fromDate(new Date(d0.getTime() + off * 86400000)).lDay);
    ok(days.includes(1), `${l.date} 前后一天都不是初一——朔算错了`);
    if (days[0] === 1) hit++;
  }
  ok(hit / news.length >= 0.8, `逐日精确命中率 ${hit}/${news.length}——月亮±0.3°只该在近午夜时偏一天,偏得太多`);
  console.log(`      (${news.length} 个新月,当日即初一 ${hit} 个,其余在邻日——月亮公式±0.3°的正常代价)`);
  for (let i = 1; i < luns.length; i++) ok(luns[i].kind !== luns[i - 1].kind, '朔望必须交替');
});

console.log('【十】行运:窗口的数学与土星回归');
const NATAL = Astro.chart(new Date(Date.UTC(1990, 4, 20, 1, 30)), { lat: 31.2, lon: 121.5 });
t('窗口自洽:from≤to、精确应期都落在窗内、passes=应期数;同参数重跑逐字节一致', () => {
  const tr = Astro.transits(NATAL, new Date(Date.UTC(2026, 7, 2)), 12);
  ok(tr.wins.length >= 3, '一整年慢星窗口竟不足 3 个,扫描有漏');
  for (const w of tr.wins) {
    ok(w.from <= w.to, `窗口起止倒挂:${w.from}>${w.to}`);
    for (const e of w.exact) ok(e >= w.from && e <= w.to, `应期 ${e} 落在窗外 ${w.from}~${w.to}`);
    ok(w.passes === w.exact.length, 'passes 与应期数不符');
    ok(w.plain.length >= 15, '判语太短:' + w.plain);
  }
  ok(JSON.stringify(tr) === JSON.stringify(Astro.transits(NATAL, new Date(Date.UTC(2026, 7, 2)), 12)), '同参数两跑不一致');
});
t('土星回归:1990 年生人,2019 年起扫 24 个月必须逮到「土星回归」,且是合相', () => {
  const tr = Astro.transits(NATAL, new Date(Date.UTC(2019, 0, 1)), 24);
  const ret = tr.wins.find(w => w.ret && w.mover === '土星');
  ok(ret, '土星回归没逮到——回归检测是死条');
  ok(/土星回归/.test(ret.plain) && /二十九年半/.test(ret.plain), '回归判语要写明周期:' + ret.plain);
});
// v1.08 换口径:月亮改拟合式(≤0.0149°)后,本命月亮不再是「糊的」,压月亮的窗口
// **不该再挂 ±0.3° 放宽声明**——旧声明反倒成了错话。这条测试从「必须带声明」
// 反转为「不许再带」,并顺带钉住压月亮的窗口扫得到(扫描本身不是死条)。
t('压本命月亮的窗口:拟合式月亮不再挂 ±0.3° 旧声明(位置已实测 ≤0.0149°)', () => {
  let found = null;
  for (let y = 2026; y <= 2032 && !found; y++) {
    const tr = Astro.transits(NATAL, new Date(Date.UTC(y, 0, 1)), 12);
    found = tr.wins.find(w => w.target === '本命月亮');
  }
  ok(found, '七年里竟无一个压月亮的窗口——扫描有漏');
  ok(!/±0\.3°/.test(found.plain), '拟合式月亮不该再挂旧的 ±0.3° 声明:' + found.plain);
});

console.log('【十一】太阳返照:回归那一刻的太阳必须分毫不差(排盘层,可核)');
t('五个生日逐个验:返照时刻太阳黄经与本命差 <0.01°,日期离生日 ±2 天内', () => {
  for (const [y, m, d] of [[1985, 2, 3], [1990, 4, 20], [1996, 11, 30], [2001, 0, 1], [1978, 6, 15]]) {
    const c = Astro.chart(new Date(Date.UTC(y, m, d, 6)));
    const sr = Astro.solarReturn(c, 2026);
    let diff = Math.abs(Astro.lonAt('sun', Astro.jdOf(sr.at)) - c.planets.sun.lon);
    if (diff > 180) diff = 360 - diff;
    ok(diff < 0.01, `返照太阳差 ${diff.toFixed(4)}°`);
    const bday = Date.UTC(2026, m, d), delta = Math.abs(sr.at.getTime() - bday) / 86400000;
    ok(delta <= 2.5, `返照日期离生日 ${delta.toFixed(1)} 天`);
  }
});

console.log('【十二】月运:朔望、快星与水逆都在账上');
t('月运结构:35 天内朔望 2–3 次、快星应期都在期内、水逆段起止在期内', () => {
  const mo = Astro.monthRun(NATAL, new Date(Date.UTC(2026, 7, 2)));
  ok(mo.luns.length >= 2 && mo.luns.length <= 3, '35 天朔望应 2–3 次:' + mo.luns.length);
  ok(mo.evs.length >= 5, '快星应期太少:' + mo.evs.length);
  const from = '2026-08-02', to = '2026-09-07';
  for (const e of mo.evs) ok(e.date >= from && e.date <= to, '应期出界:' + e.date);
  for (const r of mo.retro) ok(r.from >= from && r.to <= to, '水逆段出界');
  ok(/朔望/.test(mo.verdict) && /\d+ 处/.test(mo.verdict), '第一句要带数:' + mo.verdict);
});

console.log('【十三】细读的死条穷举与措辞(400 盘)');
t('庙旺四态、缺元素、独大、星群/大三角/T三角、命主星——各分支都触发得到', () => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const c = Astro.chart(new Date(Date.UTC(1950 + (i * 7) % 80, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24)), { lat: 30 + (i % 20), lon: 100 + (i % 40) });
    const dp = Astro.deepRead(c);
    for (const d of dp.digs) seen.add('位:' + d.st);
    if (dp.missing.length) seen.add('缺元素');
    if (dp.domin) seen.add('独大');
    for (const p of dp.pat) seen.add('形:' + p.kind);
    if (dp.ruler) seen.add('命主星');
    if (dp.hard) seen.add('紧相位');
  }
  const need = ['位:入庙', '位:旺', '位:陷', '位:落', '缺元素', '独大', '形:星群', '形:大三角', '形:T三角', '命主星', '紧相位'];
  const miss = need.filter(k => !seen.has(k));
  ok(!miss.length, '细读死条:' + miss.join('、'));
  console.log(`      (400 盘,${seen.size} 类分支全活)`);
});
t('细读与行运的全部白话过体检员;叙事是因果链(连词齐)不是并列短句堆', () => {
  const texts = [];
  for (let i = 0; i < 60; i++) {
    const c = Astro.chart(new Date(Date.UTC(1955 + (i * 13) % 70, (i * 7) % 12, 1 + (i * 5) % 28, (i * 11) % 24)), { lat: 25 + (i % 25), lon: 90 + (i % 50) });
    const dp = Astro.deepRead(c);
    texts.push(dp.verdict, dp.story);
    // 同 mingge:v0.98 强制每句带「因为」,评审查出产出假因果。改钉真链条结构——
    // 起于配置(先看配置)、经太阳与月亮两段、收于「因此」这类真推论连词。
    ok(/先看配置/.test(dp.story), '细读要从元素配置起:' + dp.story.slice(0, 40));
    ok(/太阳(自我与主线)/.test(dp.story.replace(/[()]/g, m => m === '(' ? '(' : ')')) || /太阳\(自我与主线\)/.test(dp.story), '缺太阳那一段');
    ok(/月亮\(情绪与安全感\)/.test(dp.story), '缺月亮那一段');
    ok(/因此|所以/.test(dp.story) || !dp.ruler, '缺收束的推论连词:' + dp.story.slice(0, 60));
  }
  const tr = Astro.transits(NATAL, new Date(Date.UTC(2026, 7, 2)), 12);
  const mo = Astro.monthRun(NATAL, new Date(Date.UTC(2026, 7, 2)));
  texts.push(tr.verdict, mo.verdict, ...tr.wins.map(w => w.plain), ...mo.evs.map(e => e.plain), ...mo.luns.map(l => l.plain));
  const seen2 = new Set();
  for (const s of texts) {
    if (!s || seen2.has(s.slice(0, 16))) continue; seen2.add(s.slice(0, 16));
    const rep = Tijian.check(s, {});
    const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
    ok(!bad.length, `体检不过:${s.slice(0, 34)} → ${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
  }
});
t('material 带上细读与年运月运;HONEST 把行运的位置/说法两层分清', () => {
  const now = new Date(Date.UTC(2026, 7, 2));
  const m = Astro.material(NATAL, null, null, { deep: Astro.deepRead(NATAL), trans: Astro.transits(NATAL, now, 12), month: Astro.monthRun(NATAL, now), sr: Astro.solarReturn(NATAL, 2026) });
  ok(/细读/.test(m) && /年运·行运窗口/.test(m) && /月运/.test(m) && /太阳返照/.test(m), '材料缺块');
  ok(/勿另立结论/.test(m), '细读块要写明程序已算死');
  ok(/零回测/.test(Astro.HONEST) && /行运|应期/.test(Astro.HONEST), 'HONEST 要把行运也纳入分级');
});

console.log('【十四】v0.99 对抗评审查出的三个真缺陷,逐条钉死');
t('元素/三态统计不许把天王海王算进去——世代星一星座停 7–14 年,断个人性格是外行错', () => {
  // 缘起:v0.98 把三颗世代星计入四正,于是太阳金牛(固定)+ 上升狮子(固定)的盘
  // 被算成「开创型」,同一段里自相矛盾。评审一眼识破。
  const c = Astro.chart(new Date(Date.UTC(1990, 4, 20, 1, 30)), { lat: 31.2, lon: 121.5 });
  const dp = Astro.deepRead(c);
  const tot = Object.values(dp.modes).reduce((a, b) => a + b, 0);
  // 日月各2 + 水金火各1 + 木土各1 + 上升1 = 10;若把天海算进去会变成 12
  ok(tot === 10, `三态票数应为 10(日月各2、水金火木土各1、上升1),实得 ${tot}——天海八成又被算进去了`);
  ok(dp.modes['固定'] >= dp.modes['开创'], `太阳金牛+上升狮子该偏固定,实得 开创${dp.modes['开创']} 固定${dp.modes['固定']}`);
  // 一致性校验必须在:主导三态与日月上升全不符时不许开口
  let checked = 0;
  for (let i = 0; i < 200; i++) {
    const cc = Astro.chart(new Date(Date.UTC(1950 + (i * 7) % 80, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24)), { lat: 30, lon: 120 });
    const d2 = Astro.deepRead(cc);
    if (!d2.modeOK) { checked++; ok(!/做事方式上/.test(d2.story), '三态与日月上升不符时不许报三态那句'); }
  }
  console.log(`      (200 盘里 ${checked} 盘触发一致性拦截)`);
});
t('星群必须含至少一颗个人行星——纯世代星群是同代人的共同背景,不是个人特征', () => {
  // 缘起:v0.98 给 1989–1991 年生人人手发了一份「摩羯星群」(土天海),这是外行标志。
  let pure = 0, ok9 = 0;
  for (let i = 0; i < 400; i++) {
    const c = Astro.chart(new Date(Date.UTC(1950 + (i * 7) % 80, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24)), { lat: 30, lon: 120 });
    const dp = Astro.deepRead(c);
    for (const p of dp.pat) {
      if (p.kind !== '星群') continue;
      ok9++;
      const per = p.who.filter(n => ['太阳', '月亮', '水星', '金星', '火星'].includes(n));
      if (!per.length) pure++;
    }
  }
  ok(pure === 0, `报出了 ${pure} 个纯世代行星星群——门槛没守住`);
  ok(ok9 > 0, '400 盘一个星群都没有,门槛过严成了死条');
  console.log(`      (400 盘 ${ok9} 个星群,纯世代星群 0)`);
});
t('年运主线不许取扫描起点的截断窗;命主星被行运打到必须标出来', () => {
  // 缘起:v0.98 拿一条 11 天后就结束、精确应期恰好等于查询当天的尾巴当全年主线。
  for (let i = 0; i < 40; i++) {
    const c = Astro.chart(new Date(Date.UTC(1960 + (i * 3) % 60, (i * 5) % 12, 1 + (i * 7) % 28, (i * 11) % 24)), { lat: 31.2, lon: 121.5 });
    const tr = Astro.transits(c, new Date(Date.UTC(2026, 7, 2)), 12);
    if (!tr.wins.length) continue;
    const nonTrunc = tr.wins.filter(w => !w.truncStart);
    const mainIsTrunc = /主线/.test(tr.verdict) && nonTrunc.length && tr.wins.filter(w => w.truncStart).some(w => tr.verdict.includes(w.from + '~' + w.to) && tr.verdict.indexOf('主线') >= 0 && tr.verdict.includes(w.mover + w.asp + w.target));
    ok(!(nonTrunc.length && mainIsTrunc), '主线取到了截断窗');
    for (const w of tr.wins) {
      if (w.truncStart) ok(/已开始/.test(w.plain), '截断窗要注明它早已开始:' + w.plain.slice(-30));
      if (w.isRuler) ok(/命主星/.test(w.plain), '打到命主星要标出来');
    }
  }
});
t('月运第一句是结论不是库存清点(铁律二);返照报的是重心宫位不是软硬相位计数', () => {
  const c = Astro.chart(new Date(Date.UTC(1990, 4, 20, 1, 30)), { lat: 31.2, lon: 121.5 });
  const mo = Astro.monthRun(c, new Date(Date.UTC(2026, 7, 2)));
  ok(/最好用的一天|最该避开|没有落到你本命的要点/.test(mo.verdict.slice(0, 40)), '月运第一句要先给结论:' + mo.verdict.slice(0, 50));
  ok(!/^这三十五天:快星应期/.test(mo.verdict), '第一句又退回库存清点了');
  const sr = Astro.solarReturn(c, 2026, { lat: 31.2, lon: 121.5 });
  ok(/重心落在本命第\d+宫/.test(sr.verdict), '返照要报重心宫位:' + sr.verdict.slice(-80));
  ok(!/软相位|硬相位相当|顺的多|拧的多/.test(sr.verdict), '软硬相位计数法已废,不许回流');
  ok(sr.ascHouse >= 1 && sr.ascHouse <= 12, '返照上升宫位算错:' + sr.ascHouse);
});
t('缺位元素与该元素主星的状态必须合成,不许同一段里既说短板又说长项', () => {
  // 缘起:v0.98 同一段里写「缺火:启动力弱」又写「火星入庙:行动力是长项」,零合成。
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const c = Astro.chart(new Date(Date.UTC(1950 + (i * 11) % 80, (i * 7) % 12, 1 + (i * 5) % 28, (i * 3) % 24)), { lat: 30, lon: 120 });
    const dp = Astro.deepRead(c);
    for (const cb of dp.combos) {
      n++;
      ok(/缺位/.test(cb.plain) && /主星/.test(cb.plain), '合成句要同时点出缺位与主星:' + cb.plain.slice(0, 30));
      // 主星有力时不许再说这一路「确实是短板」
      if (cb.strong) ok(!/确实是短板|确实是弱项|确实薄|确实不易/.test(cb.plain), '主星有力却仍断为短板,没合成:' + cb.plain);
    }
  }
  ok(n > 0, '300 盘一个缺位元素都没有,合成层是死条');
  console.log(`      (300 盘 ${n} 条缺位合成)`);
});

console.log('【十五】跨设备时区:同一生辰必须排出同一张盘(v0.99 用户报的真错)');
t('UTC / 东八区 / 纽约 三种设备时区下,本命盘与行运首窗逐字节相同', () => {
  // 缘起:用户 2026-08-02「你这个新盘排盘都是排错的」。跑数据证实——界面用
  // new Date(y,m-1,d,h,mi) 建时刻,那是**看盘设备**的本地时区,而星历按绝对时刻算。
  // 实测同一生辰:上升分别落 天蝎7.3°/巨蟹19.7°/射手26.3°,月亮也换星座。
  // 修法:出生时刻收归 Astro.birthMoment(按出生地时区折),日期格式化按固定 TZ_OUT。
  const { execFileSync } = require('node:child_process');
  const code = `const A=require(${JSON.stringify(join(ROOT, 'astro.js'))});` +
    `const c=A.chart(A.birthMoment(1990,5,20,9,30),{lat:39.9,lon:116.4});` +
    `const tr=A.transits(c,new Date(Date.UTC(2026,7,2)),12);` +
    `const mo=A.monthRun(c,new Date(Date.UTC(2026,7,2)));` +
    `const sr=A.solarReturn(c,2026,{lat:39.9,lon:116.4});` +
    `process.stdout.write(JSON.stringify({asc:c.asc,moon:c.planets.moon,w:tr.wins.map(w=>w.from+w.to),m:mo.luns.map(l=>l.date),s:sr.date}));`;
  const outs = ['UTC', 'Asia/Shanghai', 'America/New_York', 'Pacific/Kiritimati'].map(tz =>
    execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }));
  for (let i = 1; i < outs.length; i++) ok(outs[i] === outs[0], `设备时区一换结果就变了(第 ${i} 个)——排盘吃了设备时区`);
  const o = JSON.parse(outs[0]);
  ok(o.asc.sign === '狮子', '1990-05-20 09:30 北京的上升应在狮子,实得 ' + o.asc.sign + o.asc.deg);
  console.log(`      (四个时区逐字节一致;上升 ${o.asc.sign}${o.asc.deg}°、月亮 ${o.moon.sign}${o.moon.deg}°)`);
});
t('birthMoment 是唯一入口:界面不许再自己 new Date 建出生时刻', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  // 先剥掉注释再扫——第一版栽在自己的注释上:那段注释正解释着「new Date(y,m-1,…) 是病根」,
  // 于是断言把解释病根的话当成了病根本身。同类自伤这是第六次,规矩是**扫代码前先去注释**。
  const seg = html.slice(html.indexOf('function xzBirthDate'), html.indexOf('function xzWheel'))
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(!/new Date\(\s*y\s*,\s*m\s*-\s*1/.test(seg), '星盘那一段又出现了本地时区的 new Date(y,m-1,...)');
  ok(/Astro\.birthMoment/.test(seg), '出生时刻必须走 Astro.birthMoment');
});

console.log('【十五】v1.08 排盘二次体检:恒星时 UT、Placidus、月亮拟合式、冥王、北交');
// 缘起:用户报「排盘一塌糊涂」。四个病各钉一条;客观标准是 JPL DE421(pypi jplephem+de421,
// 量测与生成见 tools/build-astro-tables.py 与 tools/de421-ref.py,数字戳在 data/astro-moon.js 抬头)。
t('恒星时按 UT:J2000.0(UT) 那一刻 GMST 必须 = 280.4606°(定义值)', () => {
  // 此前 GMST 吃了带 ΔT 的 TT 儒略日,恒星时恒偏 17.3′、上升/中天偏约 0.3°——
  // 引擎与地平线搜索测试两边一起错,照样全绿。定义锚死:jd(TT)=J2000.0+69s ⟺ UT=J2000.0。
  // v1.12:ΔT 改逐年,锚点跟着按当年取(2000 年约 63.9 秒)
  const a = Astro.ascendant(2451545.0 + Astro.deltaT(2000) / 86400, 0, 0);
  ok(Math.abs(a.ramc - 280.4606) < 0.001, `GMST@J2000(UT)=${a.ramc.toFixed(4)},应为 280.4606`);
});
t('Placidus 宫尖满足定义不变量:赤经距 = 半弧份额(1/3、2/3、1、1+1/3、1+2/3)', () => {
  const norm2 = d => { d %= 360; return d < 0 ? d + 360 : d; };
  for (const [y, mo, d, la, lo] of [[1990, 5, 15, 39.9, 116.4], [1985, 1, 3, 23.1, 113.3], [2001, 10, 20, 45.8, 126.5], [1975, 8, 9, -33.9, 151.2]]) {
    const jd = Astro.jdOf(new Date(Date.UTC(y, mo, d, 4, 30)));
    const pl = Astro.placidusCusps(jd, lo, la);
    ok(pl, `lat=${la} 不该退整宫`);
    const eps = (23.439291 - 0.0130042 * ((jd - 2451545) / 36525)) * RAD, phi = la * RAD;
    const raOf = L => norm2(Math.atan2(Math.sin(L * RAD) * Math.cos(eps), Math.cos(L * RAD)) * DEG);
    const saOf = L => Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(Math.asin(Math.sin(eps) * Math.sin(L * RAD)))))) * DEG;
    for (const [h, frac] of [[11, 1 / 3], [12, 2 / 3], [1, 1], [2, 4 / 3], [3, 5 / 3]]) {
      const L = pl.cusps[h], sa = saOf(L), t2 = frac <= 1 ? sa * frac : sa + (180 - sa) * (frac - 1);
      let md = norm2(raOf(L) - pl.ramc); if (md > 180) md -= 360;
      ok(Math.abs(md - t2) < 0.01, `宫${h} 赤经距 ${md.toFixed(3)} ≠ 份额 ${t2.toFixed(3)}`);
    }
    for (let h = 1; h <= 6; h++) ok(Math.abs(norm2(pl.cusps[h] + 180) - pl.cusps[(h + 5) % 12 + 1]) < 1e-9, `宫${h} 对宫不差 180°`);
    ok(Math.abs(pl.cusps[1] - pl.asc) < 1e-9 && Math.abs(pl.cusps[10] - pl.mc) < 1e-9, '1 宫=上升、10 宫=天顶');
  }
  ok(Astro.placidusCusps(Astro.jdOf(new Date(Date.UTC(1990, 5, 15))), 20, 70) === null, '|纬|>66° 该退 null(极圈 Placidus 无定义)');
});
t('月亮拟合式:数据表误差戳 ≤0.02°,与旧低精度式全程相差 ≤0.35°(结构互核)', () => {
  const MOD = JSON.parse('{"a":1}') && require(join(ROOT, 'data', 'astro-moon.js'));
  ok(MOD.ERR.lonMax <= 0.02, '黄经误差戳超界:' + MOD.ERR.lonMax);
  ok(MOD.ERR.nodeMax <= 0.25, '北交残差戳超界:' + MOD.ERR.nodeMax);
  ok(MOD.LON_COEF.length === MOD.LON_ARGS.length && MOD.LAT_COEF.length === MOD.LAT_ARGS.length, '表长不齐');
  // 与旧式互核:两套独立来源,若相差超过旧式自身的误差圈,必有一套接错
  const sOld = (jd) => { const T = (jd - 2451545) / 36525, s = d2 => Math.sin(d2 * RAD);
    return (218.32 + 481267.881 * T + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T)
      + 0.66 * s(235.7 + 890534.22 * T) + 0.21 * s(269.9 + 954397.74 * T)
      - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T)) % 360; };
  for (let i = 0; i < 300; i++) {
    const jd = 2440000 + i * 137.7;
    let d2 = Math.abs(Astro.moonPos(jd).lon - ((sOld(jd) + 360) % 360)); if (d2 > 180) d2 = 360 - d2;
    ok(d2 <= 0.35, `jd=${jd} 新旧月亮差 ${d2.toFixed(3)}°,超出旧式误差圈`);
  }
});
t('冥王星:采样表连续、时代落座对(1990 天蝎/2000 射手/2020 摩羯)、逆行约四成', () => {
  const c90 = Astro.chart(new Date(Date.UTC(1990, 5, 15))), c00 = Astro.chart(new Date(Date.UTC(2000, 5, 15))), c20 = Astro.chart(new Date(Date.UTC(2020, 5, 15)));
  ok(c90.planets.plu && c90.planets.plu.sign === '天蝎', '1990 冥王该在天蝎:' + (c90.planets.plu && c90.planets.plu.sign));
  ok(c00.planets.plu.sign === '射手', '2000 冥王该在射手:' + c00.planets.plu.sign);
  ok(c20.planets.plu.sign === '摩羯', '2020 冥王该在摩羯:' + c20.planets.plu.sign);
  let retro = 0, n = 0;
  for (let d2 = 0; d2 < 3650; d2 += 5) { const cc = Astro.chart(new Date(Date.UTC(2015, 0, 1 + d2))); n++; if (cc.planets.plu.retro) retro++; }
  const rate = retro / n;
  ok(rate > 0.3 && rate < 0.55, `冥王逆行天数占比 ${(rate * 100).toFixed(1)}%,不合外行星公论(约四到五成)`);
  // 出界照实不排:1880 年不在表内
  const old = Astro.chart(new Date(Date.UTC(1880, 0, 1)));
  ok(!old.planets.plu && /1900/.test(old.pluNote), '表外该不排并说明:' + old.pluNote);
});
t('真北交:围绕平交点摆动 ≤2°、十八年半退行一圈的速率对、正常在盘里带宫位', () => {
  const norm2 = d2 => { d2 %= 360; return d2 < 0 ? d2 + 360 : d2; };
  for (let i = 0; i < 200; i++) {
    const jd = 2440000 + i * 180.5;
    const nl = Astro.nodeLon(jd);
    const T = (jd - 2451545) / 36525;
    const om = norm2(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441);
    let d2 = Math.abs(nl - om); if (d2 > 180) d2 = 360 - d2;
    ok(d2 <= 2.0, `jd=${jd} 真交点偏离平交点 ${d2.toFixed(2)}°,超过实测摆幅`);
  }
  const c = Astro.chart(new Date(Date.UTC(1990, 5, 15, 4, 30)), { lat: 39.9, lon: 116.4 });
  ok(c.node && c.node.sign && c.node.house >= 1 && c.node.house <= 12, '北交要有落座与宫位');
});
t('宫位跟着 Placidus 走:同一副盘 Placidus 与整宫的宫位该有差别(不然等于没换)', () => {
  const c = Astro.chart(new Date(Date.UTC(1990, 5, 15, 4, 30)), { lat: 39.9, lon: 116.4 });
  ok(c.houseSys === 'Placidus', '默认分宫制该是 Placidus:' + c.houseSys);
  ok(c.cusps && c.cusps.length === 12, '要暴露 12 个宫尖');
  const ascSign = Math.floor(c.asc.lon / 30);
  let diff = 0;
  for (const k of Astro.KEYS) {
    if (!c.planets[k]) continue;
    const ws = ((Math.floor(c.planets[k].lon / 30)) - ascSign + 12) % 12 + 1;
    if (ws !== c.houses[k]) diff++;
  }
  ok(diff >= 1, 'Placidus 与整宫逐星宫位完全一致——多半没真换分宫制');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
