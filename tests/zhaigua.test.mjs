// 占宅专项内测(v0.93,板块 C)
// 缘起:策划书板块 C——「本策划书里出处最硬的一块」,《增删卜易》占宅诸章约 7100 字。
// 开工前按 v0.79 教训先逐章核了家底:舊宅/尋地/占地形勢/入宅六親等章标题在、正文厚;
// **蓋造買宅章标题丢了**(内容混在家宅章那段),该章规则只挂书不挂章。
// 这套测试守六件事:
//   一、外部对照:每条规则的原话逐字在《增删卜易》里搜得到(繁体照原貌);挂了章的归章要对;
//   二、外部对照:六冲/六合卦的机械判法拿公认标准卦验(乾为天=六冲、地天泰=六合);
//   三、死条穷举:六种问型、各判语分支、鬼祟表、六亲互化表都触发得到;
//   四、铁律五从严:原文那条要买物件的送法不许进做法,只许「原文另载,本程序不荐」;
//   五、说人话 + 答案之锚(同卦同刻同答);
//   六、边界:用神不上卦照实说「再占」,不硬编。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Zhaigua = require(join(ROOT, 'zhaigua.js'));
const GuaData = require(join(ROOT, 'gua-data.js'));
const Tijian = require(join(ROOT, 'tijian.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };
const strip = x => x.replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒]/g, '');
const RAW = strip(readFileSync(join(ROOT, 'data', 'classics', '增删卜易.txt'), 'utf8'))
  + strip(readFileSync(join(ROOT, 'data', 'classics', '增删卜易-维基文库本.txt'), 'utf8'));
const SRC = readFileSync(join(ROOT, 'zhaigua.js'), 'utf8');
const IDS = Object.keys(GuaData.BY_ID);
const flip = (id, mv) => id.split('').map((c, i) => mv.includes(i) ? (c === '1' ? '0' : '1') : c).join('');
const castOf = (id, mv) => ({ benId: id, moving: mv, bianId: mv.length ? flip(id, mv) : id });
const D = new Date(2026, 7, 2, 10, 0);

console.log('【一】外部对照:每条原话逐字可搜,挂了章的归章要对');
t('源码里全部 q 引文(含 vq)逐条在《增删卜易》里搜得到', () => {
  const qs = [...SRC.matchAll(/q: '([^']{6,})'/g)].map(m => m[1]);
  ok(qs.length >= 30, '引文太少:' + qs.length);
  const bad = qs.filter(q => !RAW.includes(strip(q)));
  ok(!bad.length, '搜不到:\n      ' + bad.join('\n      '));
  console.log(`      (核了 ${qs.length} 条引文)`);
});
t('挂了「舊宅章」等章名的引文,归章逐条对得上;蓋造買宅那批只挂书不挂章', async () => {
  const { chapterOfQuote, chapKey } = await import('../tools/chapter-check.mjs');
  const hits = [...SRC.matchAll(/q: '([^']{6,})', src: '增删卜易·([^']+)'/g)];
  ok(hits.length >= 15, '挂章的引文太少:' + hits.length);
  const bad = [];
  for (const [, q, chap] of hits) {
    const r = chapterOfQuote('增删卜易', q, chap);
    if (!r.found) { bad.push(`搜不到:「${q.slice(0, 16)}」`); continue; }
    const same = chapKey(r.chapter) === chapKey(chap) || chapKey(r.chapter).includes(chapKey(chap)) || chapKey(chap).includes(chapKey(r.chapter));
    if (!same) bad.push(`「${q.slice(0, 14)}」标「${chap}」实落「${r.chapter}」`);
  }
  ok(!bad.length, '归章核不过:\n      ' + bad.join('\n      '));
  // 蓋造買宅那批(买房规则)不许挂章——那一章标题丢了
  ok(!/蓋造買宅章/.test(SRC.replace(/\/\/[^\n]*/g, '')), '蓋造買宅章标题丢了,代码里(注释除外)不许挂这个章名');
  console.log(`      (归章核了 ${hits.length} 条)`);
});

console.log('【二】外部对照:六冲六合的机械判法拿公认标准卦验');
t('乾为天(八纯)判六冲;地天泰判六合——公认标准答案', () => {
  const chong = Zhaigua.judge('mai', castOf('111111', []), { date: D });
  ok(chong.sub.some(x => x.tech === '六冲卦'), '乾为天该判六冲:' + JSON.stringify(chong.sub.map(x => x.tech)));
  const he = Zhaigua.judge('mai', castOf('111000', []), { date: D });
  ok(he.sub.some(x => x.tech === '六合卦'), '地天泰该判六合:' + JSON.stringify(he.sub.map(x => x.tech)));
});

console.log('【三】死条穷举:问型、分支、两张表都触发得到');
const SWEEP = [];
for (let d = 0; d < 8; d++) {
  const day = new Date(2026, 0, 3 + d * 40, 10, 0);
  for (const id of IDS) for (const mv of [[], [2], [0, 4], [1, 3, 5]]) {
    for (const ty of Object.keys(Zhaigua.TYPES)) {
      const r = Zhaigua.judge(ty, castOf(id, mv), { date: day, qin: ['父母', '兄弟', '妻儿'][d % 3] });
      SWEEP.push({ ty, r });
    }
  }
}
t('六种问型全出结论,verdict 第一句永不为空', () => {
  for (const { ty, r } of SWEEP) {
    ok(r && r.verdict && r.verdict.length >= 8, ty + ' 出了空结论');
    ok(r.vq && r.vq.q, ty + ' 的第一句没挂凭据');
  }
});
t('各问型的判语分支都触发得到(按 vq 原话去重),鬼祟表与六亲互化表也都活着', () => {
  const seen = new Set();
  let guiZhiHit = 0, guiShenHit = 0, huaHit = 0;
  for (const { ty, r } of SWEEP) {
    seen.add(ty + ':' + r.vq.q.slice(0, 10));
    for (const s of r.sub) {
      if (Object.values(Zhaigua.GUI_ZHI).some(g => g.q === s.q)) guiZhiHit++;
      if (Object.values(Zhaigua.GUI_SHEN).some(g => g.q === s.q)) guiShenHit++;
      if (/堂上之憂|膝前有損|分衾折枕|鬼動克兄/.test(s.q)) huaHit++;
    }
  }
  ok(seen.size >= 16, '判语分支只见到 ' + seen.size + ' 种:' + [...seen].join(' | '));
  ok(guiZhiHit > 0, '鬼祟按支那张表一次没触发');
  ok(guiShenHit > 0, '鬼祟按六神那张表一次没触发');
  ok(huaHit > 0, '六亲互化表一次没触发');
  console.log(`      (${seen.size} 种判语;鬼祟支 ${guiZhiHit} 次、六神 ${guiShenHit} 次、互化 ${huaHit} 次)`);
});
t('jiu 型四种结论(是这处/不是这处/没事/疑错处)都出现过', () => {
  const v = new Set(SWEEP.filter(x => x.ty === 'jiu').map(x => x.r.verdict.slice(0, 4)));
  for (const k of ['就是这处', '不是你疑', '这处没事', '这处不是']) ok([...v].some(s => k.startsWith(s) || s === k.slice(0, 4)), `jiu 缺「${k}」这种结论,只见:` + [...v].join('、'));
});

console.log('【四】铁律五从严:不荐任何要买的东西');
t('做法清单不出现送法购物;凡提原文送法必须跟着「不荐」', () => {
  for (const { r } of SWEEP) {
    for (const s of r.sub) {
      ok(!/开光|法物|符咒|请购|摆件/.test(s.plain), '出现花钱物件:' + s.plain);
      if (/送法|黃錢|黄钱/.test(s.plain)) ok(/不荐/.test(s.plain), '提了送法却没说不荐:' + s.plain);
    }
  }
  const m = Zhaigua.material('jiu', castOf(IDS[9], [1]), { date: D });
  ok(/不荐/.test(m), 'material 里要写明原文送法不荐');
});

console.log('【五】说人话 + 答案之锚');
t('全部 verdict 与 plain 过体检员(空话/说教/花钱消灾/术语)', () => {
  const seen = new Set();
  for (const { r } of SWEEP) {
    for (const s of [r.verdict, ...r.sub.map(x => x.plain), r.note || '']) {
      const k = s.slice(0, 12); if (!s || seen.has(k)) continue; seen.add(k);
      const rep = Tijian.check(s, {});
      const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
      ok(!bad.length, `体检不过:${s.slice(0, 26)}… → ${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
    }
  }
});
t('同卦同刻反复判五十次,逐字节一致', () => {
  const cast = castOf(IDS[17], [0, 3]);
  for (const ty of Object.keys(Zhaigua.TYPES)) {
    const first = JSON.stringify(Zhaigua.judge(ty, cast, { date: D, qin: '父母' }));
    for (let i = 0; i < 50; i++) eq(JSON.stringify(Zhaigua.judge(ty, cast, { date: D, qin: '父母' })), first, ty + ' 第' + i + '次不一致');
  }
});

console.log('【六】边界:照实说,不硬编');
t('入宅型遇用神不上卦,照实说「再占」', () => {
  const hit = SWEEP.find(x => x.ty === 'ru' && /没露面/.test(x.r.verdict));
  ok(hit, '扫不到用神不上卦的例子(样本问题)——或者程序在硬编');
  ok(/再占|换个时辰/.test(hit.r.verdict), '不上卦该让人再占:' + hit.r.verdict);
});
t('§四 结构:zhaigua 不自算断法元素,方位表取 dili', () => {
  ok(!/judgeStrength|pickYongShen|function\s+yaoPower|WANG_SCORE/.test(SRC), '不许自算断法');
  ok(/Najia\.zhuangGua/.test(SRC) && /Dili\.ZHI_DIR/.test(SRC), '排盘走 najia、方位取 dili');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
