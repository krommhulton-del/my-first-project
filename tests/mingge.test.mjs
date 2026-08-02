// 命格取向专项内测(v0.90,板块 G)
// 缘起:用户 2026-08-02 点名要「这人该吃哪碗饭」并且**必须说真话**——适合当官、适合买卖、
// 适合手艺、适合靠伴侣得财,都要照说,不许拿普世价值观打折;同时策划书把线画死:
// **结论一个字不软,道德词一个字不带**(「淫/贱/娼」是明代的价值判断,不是可证伪的预测)。
// 这套测试守四件事:
//   一、外部对照:每条规则的引文逐字在所标那本书里搜得到(三本都是简体转录,照原貌);
//   二、死条穷举:六路、钱路、直断、旁注,每个分支在大样本里都触发得到;
//   三、**说真话的反向测试**:构造该说狠话的盘,断言那句话必须说出来——回避即失败;
//   四、道德词禁表 + 性别口径不许镜像(男命规则不许套女命)+ 依据与结论同向。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const Mingge = require(join(ROOT, 'mingge.js'));
const Tijian = require(join(ROOT, 'tijian.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const strip = x => x.replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒]/g, '');
const SRC = readFileSync(join(ROOT, 'mingge.js'), 'utf8');
const BOOK = {};
for (const b of ['渊海子平', '三命通会', '滴天髓阐微'])
  BOOK[b] = strip(readFileSync(join(ROOT, 'data', 'classics', b + '.txt'), 'utf8'));
const chartOf = (y, mo, d, h, g) => Bazi.chart(new Date(y, mo - 1, d, h, 30), g, { lon: 116.4 });

console.log('【一】外部对照:每条引文逐字在所标那本书里搜得到');
t('源码里每一处 quote 都核到原书(简体照原貌,含混排的「穡」字)', () => {
  const hits = [...SRC.matchAll(/quote: '([^']+)', src: '([^']+)'/g)];
  ok(hits.length >= 20, '挂引文的规则太少:' + hits.length);
  const bad = [];
  for (const [, q, src] of hits) {
    const book = Object.keys(BOOK).find(b => src.startsWith(b));
    if (!book) { bad.push(`「${q}」的出处认不出书名:${src}`); continue; }
    if (!BOOK[book].includes(strip(q))) bad.push(`《${book}》里搜不到「${q}」`);
  }
  ok(!bad.length, '核不到:\n      ' + bad.join('\n      '));
  console.log(`      (核了 ${hits.length} 条引文)`);
});
t('旁注层「两书打架」的原话两边都在,且滴天髓反对的那两句一字不差', () => {
  for (const q of ['桃花咸池，专论女命邪淫，受责鬼神', '不可轻断淫邪，以渎神怒'])
    ok(BOOK['滴天髓阐微'].includes(strip(q)) && SRC.includes(q), '缺滴天髓反对方原话:' + q);
  for (const q of ['支上咸池干带合，风流浪荡破家儿', '财太多，官杀太旺，乃明暗夫集多', '杀多则夫多'])
    ok(BOOK['渊海子平'].includes(strip(q)) && SRC.includes(q), '缺渊海主张方原话:' + q);
});
t('武职那条降半档的标注在:命例判语归纳,非条文明文', () => {
  ok(/命例判语归纳,非条文明文/.test(SRC), '武职规则须标明是命例归纳,不许冒充条文');
});

console.log('【二】死条穷举:每个分支都触发得到(1500 盘)');
const SAMPLE = [];
for (let i = 0; i < 1500; i++) {
  const c = chartOf(1958 + (i * 7) % 65, 1 + (i * 3) % 12, 1 + (i * 11) % 28, (i * 5) % 24, i % 2 ? '男' : '女');
  SAMPLE.push(Mingge.read(c));
}
t('六路的每一条证据、直断与旁注的每一款,都至少触发一次', () => {
  const seen = new Set();
  for (const r of SAMPLE) {
    for (const road of r.roads) if (road.ev.length) seen.add('路:' + road.key);
    for (const m of r.money) seen.add('钱:' + m.path);
    for (const z of r.zhi) seen.add('直:' + z.key);
    for (const p of r.pang) seen.add('旁:' + p.key);
  }
  const need = ['路:guan', '路:shang', '路:ji', '路:wen', '路:wu', '路:chu',
    '钱:正路的钱', '钱:买卖的钱', '钱:伴侣与人脉带来的钱', '钱:手艺换的钱', '钱:没有哪条独大',
    '直:水得地火不现', '直:锋芒有托', '直:锋芒无托', '直:水盛多智', '旁:桃花咸池', '旁:容貌堂堂'];
  const miss = need.filter(k => !seen.has(k));
  ok(!miss.length, '这些分支一次都没触发(死条):' + miss.join('、'));
  console.log(`      (1500 盘,${seen.size} 个分支全活)`);
});
t('没有哪一路恒居第一(排序器不许失灵)', () => {
  const tops = {};
  for (const r of SAMPLE) tops[r.top.key] = (tops[r.top.key] || 0) + 1;
  ok(Object.keys(tops).length >= 4, '登顶过的路太少:' + JSON.stringify(tops));
  for (const [k, v] of Object.entries(tops)) ok(v / SAMPLE.length < 0.75, `${k} 占了 ${(v / SAMPLE.length * 100).toFixed(0)}% 的第一,分布不正常`);
});

console.log('【三】说真话的反向测试:该说的狠话必须说出来,回避即失败');
t('水得地火不现的盘,「欲望重」那句必须在——这是反对派自己给的直断,不许软', () => {
  const hit = SAMPLE.find(r => r.zhi.some(z => z.key === '水得地火不现'));
  ok(hit, '样本里竟无一副水得地火不现的盘,先查门槛');
  const z = hit.zhi.find(z => z.key === '水得地火不现');
  ok(/欲望重/.test(z.plain) && /情事/.test(z.plain), '直断被软化了:' + z.plain);
  ok(/淫靡无礼者/.test(z.quote), '原话必须挂着');
});
t('女命身旺的盘,「夺夫权」那句必须在——不许因为不好听就藏', () => {
  let found = null;
  for (let i = 0; i < 3000 && !found; i++) {
    const c = chartOf(1960 + (i * 13) % 60, 1 + (i * 5) % 12, 1 + (i * 7) % 28, (i * 3) % 24, '女');
    const band = c.strength.band;
    if (band === '身旺' || band === '偏旺') {
      const r = Mingge.read(c);
      const m = r.money.find(x => x.path.includes('伴侣'));
      if (m) { found = m; }
    }
  }
  ok(found, '找不到女命身旺且出伴侣条目的盘');
  ok(/得自己挣|走不顺/.test(found.plain), '该说的实话没说:' + found.plain);
  ok(found.quote === '日主旺相，夺夫权而孤苦', '原话要挂三命通会那句');
});
t('时上见财的男命,「入舍」那条必须照说——古书原话最不客气的一条', () => {
  const hit = SAMPLE.find(r => r.money.some(m => (m.more || []).concat(m).some(x => x.quote === '时上见财者，必须入舍')))
    || SAMPLE.find(r => r.money.some(m => m.quote === '时上见财者，必须入舍'));
  ok(hit, '样本里没有一副触发「时上见财」的盘——死条或被回避');
});

console.log('【四】道德词禁表 + 性别口径 + 依据结论同向');
t('全部白话输出(plain/say/verdict)一个道德词都不许有——引文除外', () => {
  const bad = [];
  for (const r of SAMPLE.slice(0, 300)) {
    const texts = [r.verdict, r.honest,
      ...r.roads.flatMap(x => x.ev.map(e => e.plain)),
      ...r.money.flatMap(m => [m.plain, ...(m.more || []).map(x => x.plain)]),
      ...r.zhi.map(z => z.plain), ...r.pang.map(p => p.say)];
    for (const s of texts) if (s) for (const w of Mingge.DIRTY) if (s.includes(w)) bad.push(`「${w}」出现在:${s.slice(0, 40)}`);
  }
  ok(!bad.length, '道德词漏进白话:\n      ' + [...new Set(bad)].slice(0, 5).join('\n      '));
});
t('material 里引文之外的部分同样干净,且写法铁规把禁词点了名', () => {
  const c = chartOf(1993, 6, 15, 10, '女');
  const m = Mingge.material(c);
  const noQuote = m.replace(/「[^」]*」/g, '');
  for (const w of ['水性杨花', '不检点', '不贞']) ok(!noQuote.includes(w), `material 白话部分带道德词:${w}`);
  ok(/道德词/.test(m) && /不许出现/.test(m), '写法铁规须点名禁道德词');
  ok(/勿另立结论/.test(m), '材料须写明程序已算死');
});
t('性别口径不许镜像:女命不出「因妻」的男命措辞,男命不出「夺夫权」', () => {
  for (const g of ['男', '女']) {
    for (let i = 0; i < 400; i++) {
      const r = Mingge.read(chartOf(1965 + (i * 9) % 55, 1 + (i * 5) % 12, 2 + (i * 7) % 26, (i * 11) % 24, g));
      const m = r.money.find(x => x.path.includes('伴侣'));
      if (!m) continue;
      const all = [m, ...(m.more || [])];
      if (g === '女') ok(!all.some(x => /因妻|缘妻|入舍/.test(x.quote)), '女命套了男命的「因妻」规则');
      else ok(!all.some(x => /夺夫权|旺夫/.test(x.quote)), '男命套了女命的「夫星」规则');
    }
  }
});
t('性别没填:按男命那套摆并写明「女命那套要填了性别才给」,不硬猜', () => {
  const c = Bazi.chart(new Date(1988, 3, 12, 14, 30), '', { lon: 116.4 });
  ok(!c.genderKnown, '前提:空性别 genderKnown 应为 false');
  const r = Mingge.read(c);
  const m = r.money.find(x => x.path.includes('伴侣'));
  if (m) ok(/性别没填/.test(m.note || ''), '性别未知时须当面说明两套口径:' + JSON.stringify(m.note));
});
t('依据与结论同向:凡登顶的那一路,必须至少有一条真凭据;评分为零的路不许有凭据', () => {
  for (const r of SAMPLE.slice(0, 500)) {
    if (r.top.score >= 25) ok(r.top.ev.length >= 1, `登顶的${r.top.key}分${r.top.score}却无凭据`);
    for (const road of r.roads) if (road.score === 0) ok(!road.ev.length, `${road.key} 零分却带凭据`);
  }
});
t('白话过体检员:无空话、无说教、无花钱消灾、无推演术语', () => {
  const seen = new Set(); const texts = [];
  for (const r of SAMPLE) {
    for (const road of r.roads) for (const e of road.ev) texts.push(e.plain);
    for (const z of r.zhi) texts.push(z.plain);
    for (const m of r.money) texts.push(m.plain);
  }
  for (const s of texts) {
    if (seen.has(s.slice(0, 14))) continue; seen.add(s.slice(0, 14));
    const rep = Tijian.check(s, {});
    const hard = rep.hits.filter(i => ['空话', '说教', '花钱消灾', '术语'].includes(i.kind));
    ok(!hard.length, `体检不过:${s.slice(0, 30)}… → ${hard.map(i => i.kind + ':' + i.snippet).join(';')}`);
  }
});
t('§四 结构:mingge 不自算旺衰与用神,只吃 chart', () => {
  ok(!/judgeStrength|pickYongShen|function\s+wuxingPower/.test(SRC), 'mingge 不许自算断法元素');
  ok(/Bazi\.SHISHEN_CLASS|Bazi\.SHENG/.test(SRC), '五类归口与生克必须取自 bazi(只此一份)');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
