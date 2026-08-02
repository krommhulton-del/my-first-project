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

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
