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
t('J2000.0 历元:2000-01-01 12:00 UTC 的儒略日 = 2451545.0(+ΔT 69 秒)', () => {
  const jd = Astro.jdOf(new Date(Date.UTC(2000, 0, 1, 12)));
  ok(Math.abs(jd - 2451545.0 - 69 / 86400) < 1e-6, 'JD 差了:' + jd);
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
    // 独立方法:黄道 β=0 逐点找「在地平线上且在东边升起」的那一点
    const gmst = norm(280.46061837 + 360.98564736629 * (jd - 2451545));
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

console.log('【四】月亮的诚实:±0.3° 当面写,近交界必须喊');
t('moonNote 永远带误差声明;近交界时换成「定不死」那段话', () => {
  const c = Astro.chart(new Date(Date.UTC(1990, 4, 20, 1, 30)));
  ok(/±0\.3°/.test(c.moonNote), 'moonNote 必须写明月亮误差:' + c.moonNote);
  let cusp = null;
  for (let d = 0; d < 60 && !cusp; d++) for (let h = 0; h < 24; h += 3) {
    const cc = Astro.chart(new Date(Date.UTC(2026, 0, 1 + d, h)));
    if (cc.planets.moon.nearCusp) { cusp = cc; break; }
  }
  ok(cusp, '两个月里竟扫不到一次月亮近交界(每两三天该有一次)——nearCusp 是死条');
  ok(/定不死/.test(cusp.moonNote), '近交界要说「定不死」:' + cusp.moonNote);
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
    const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语'].includes(h.kind));
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
t('压本命月亮的窗口必须带±0.3°放宽几天的声明——不许把糊的说成准的', () => {
  let found = null;
  for (let y = 2026; y <= 2032 && !found; y++) {
    const tr = Astro.transits(NATAL, new Date(Date.UTC(y, 0, 1)), 12);
    found = tr.wins.find(w => w.target === '心里那一汪');
  }
  ok(found, '七年里竟无一个压月亮的窗口——扫描有漏');
  ok(/±0\.3°/.test(found.plain) && /放宽/.test(found.plain), '缺月亮误差声明:' + found.plain);
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
    ok(/因为/.test(dp.story) && /所以/.test(dp.story), '细读叙事缺因果连词:' + dp.story.slice(0, 50));
  }
  const tr = Astro.transits(NATAL, new Date(Date.UTC(2026, 7, 2)), 12);
  const mo = Astro.monthRun(NATAL, new Date(Date.UTC(2026, 7, 2)));
  texts.push(tr.verdict, mo.verdict, ...tr.wins.map(w => w.plain), ...mo.evs.map(e => e.plain), ...mo.luns.map(l => l.plain));
  const seen2 = new Set();
  for (const s of texts) {
    if (!s || seen2.has(s.slice(0, 16))) continue; seen2.add(s.slice(0, 16));
    const rep = Tijian.check(s, {});
    const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语'].includes(h.kind));
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

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
