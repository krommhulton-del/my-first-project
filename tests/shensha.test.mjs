// 神煞全表 专项内测(v0.87)
//
// 缘起:这张表是本项目挂得最久的一个洞。从 v0.33 起就只有十来个神煞,
// 而 §九 一直写着「神煞全表卡在语料上——渊海子平里只有断语、没有起例,
// 将星/劫煞/亡神/孤辰寡宿的推法一条都搜不到,按铁律不许凭记忆写表」。**挂了三个版本没编。**
// 2026-08-02 拿到《三命通会》,里头有十四个神煞专章、条条带起例,这才补上。
//
// 这套测试分两类,抬头写清:
//
//   【外部对照测试】—— 证明表是对的,拿得出程序之外的标准答案
//     · 每一条起例的原文,必须在 data/classics/三命通会.txt 里**逐字搜得到**;
//     · **程序原有的桃花/驿马/华盖三张表,拿原文逐格核**——这三张表此前从没核过;
//     · 内联表与 data/shensha.json 必须逐条一致(两处不许分家)。
//
//   【内部一致性测试】—— 只证明程序不犯浑
//     · 死条穷举:八个新神煞在样本里都触发得到;
//     · 白话断语不带术语、不带说教;
//     · 起例的内部自洽(如灾煞必冲将星、亡神必是三合临官)。
//
// **这套测试证明不了「神煞断得准」。** 那是事件层的事,要靠回测,不是这里。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const Tijian = require(join(ROOT, 'tijian.js'));
const SS = JSON.parse(readFileSync(join(ROOT, 'data', 'shensha.json'), 'utf8'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

const strip = s => String(s).replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒“”"　]/g, '');
const RAW = strip(readFileSync(join(ROOT, 'data', 'classics', '三命通会.txt'), 'utf8').replace(/<br\s*\/?>/gi, ''));
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const JU = ['申子辰', '寅午戌', '巳酉丑', '亥卯未'];
const FANG = ['亥子丑', '寅卯辰', '巳午未', '申酉戌'];

console.log('【一】外部对照:每一条起例的原文都要在《三命通会》里逐字搜得到');
t('十二条引文逐字可搜,一条落空都不许有', () => {
  ok(SS.items.length >= 12, `只收了 ${SS.items.length} 条,太少`);
  const miss = SS.items.filter(x => !RAW.includes(strip(x.quoteS)));
  ok(!miss.length, '搜不到的:' + miss.map(x => `${x.name}「${x.quoteS}」`).join(' / '));
});
t('每一条都写明了出自哪一章、以及起例是什么', () => {
  for (const x of SS.items) {
    ok(x.chapter, `${x.name} 没写章名`);
    ok(x.rule && x.rule.length >= 3, `${x.name} 没写起例`);
    ok(x.quote && x.quoteS, `${x.name} 缺原文(繁/简两份都要)`);
  }
});
t('说不收的那几样,理由必须写清楚', () => {
  ok(SS['不收的'].length >= 4, '不收的清单太短');
  for (const x of SS['不收的']) ok(x['为什么'] && x['为什么'].length > 15, `${x.name} 没写为什么不收`);
  const names = SS['不收的'].map(x => x.name).join('|');
  for (const k of ['天乙贵人', '天德', '羊刃']) ok(names.includes(k), `「${k}」该在不收的清单里`);
});

console.log('【二】外部对照:**程序原有的三张表,头一次拿原文逐格核**');
t('桃花、驿马、华盖 —— 与《三命通会》原文逐格吻合', () => {
  // 原文:「寅午戌卯、已酉丑午、申子辰酉、亥卯未子即長生第二位沐浴之宮」
  const 原文 = {
    桃花: { 申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子' },
    驿马: { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' },   // 「寅午戌生人，馬在申」
    华盖: { 申子辰: '辰', 寅午戌: '戌', 巳酉丑: '丑', 亥卯未: '未' },   // 「以三合底處得庫謂之華蓋」
  };
  const 程序 = { 桃花: Bazi.TAOHUA, 驿马: Bazi.YIMA, 华盖: Bazi.HUAGAI };
  for (const k of Object.keys(原文)) {
    JU.forEach((ju, i) => eq(程序[k][i], 原文[k][ju], `${k} 的 ${ju} 局`));
  }
});
t('羊刃里那条无出处的,必须标出来——不许假装它有出处', () => {
  ok(Bazi.YANGREN_SRC, '要有一张出处表');
  for (const g of ['甲', '丙', '庚', '壬']) ok(/三命通会/.test(Bazi.YANGREN_SRC[g]), `${g} 的刃该挂上出处`);
  ok(/待核/.test(Bazi.YANGREN_SRC['戊']), '戊的刃这本书没写,必须标「出处待核」');
  const src = readFileSync(join(ROOT, 'bazi.js'), 'utf8');
  ok(/戊己的刃没写|戊己的刃/.test(src), 'bazi.js 里要写明这一条为什么没出处');
});

console.log('【三】内联表与 data/shensha.json 不许分家(§四)');
t('八张新表逐格与数据文件一致', () => {
  const inline = {
    jiangxing: Bazi.JIANGXING, jiesha: Bazi.JIESHA, wangshen: Bazi.WANGSHEN,
    zaisha: Bazi.ZAISHA, liue: Bazi.LIUE, guchen: Bazi.GUCHEN, guasu: Bazi.GUASU,
    taohua: Bazi.TAOHUA, yima: Bazi.YIMA, huagai: Bazi.HUAGAI,
  };
  let n = 0;
  for (const it of SS.items) {
    if (!it.table || !inline[it.key]) continue;
    n++;
    eq(JSON.stringify(inline[it.key]), JSON.stringify(it.table), `${it.name} 内联表与数据文件对不上`);
  }
  ok(n >= 10, `只比对了 ${n} 张表`);
  // 破碎那一条是函数,单独比
  const po = SS.items.find(x => x.key === 'posui')['分组'];
  for (const grp of Object.keys(po)) for (const z of grp) eq(Bazi.posuiOf(z), po[grp], `破碎:${z}`);
});

console.log('【四】内部一致性:起例自己要说得通');
t('灾煞必定冲将星(原文:衝破將星)', () => {
  for (let i = 0; i < 4; i++) {
    const jx = Bazi.JIANGXING[i], zs = Bazi.ZAISHA[i];
    eq(ZHI[(ZHI.indexOf(jx) + 6) % 12], zs, `${JU[i]} 局:灾煞该冲将星`);
  }
});
t('将星必是三合的中位、华盖必是三合的库', () => {
  JU.forEach((ju, i) => {
    eq(ju[1], Bazi.JIANGXING[i], `${ju} 的中位`);
    eq(ju[2], Bazi.HUAGAI[i], `${ju} 的库`);
  });
});
t('劫煞、亡神、六厄都落在长生十二宫该落的位子上', () => {
  // 原文:劫在五行绝处、亡在五行临官、六厄在五行死处
  const WX = ['水', '火', '金', '木'];                 // 申子辰水 / 寅午戌火 / 巳酉丑金 / 亥卯未木
  const 绝 = { 水: '巳', 火: '亥', 金: '寅', 木: '申' };
  const 临官 = { 水: '亥', 火: '巳', 金: '申', 木: '寅' };
  const 死 = { 水: '卯', 火: '酉', 金: '子', 木: '午' };
  WX.forEach((w, i) => {
    eq(Bazi.JIESHA[i], 绝[w], `${JU[i]}(${w})的劫煞该在绝位`);
    eq(Bazi.WANGSHEN[i], 临官[w], `${JU[i]}(${w})的亡神该在临官`);
    eq(Bazi.LIUE[i], 死[w], `${JU[i]}(${w})的六厄该在死位`);
  });
});
t('孤辰是方前一位、寡宿是方后一位', () => {
  FANG.forEach((f, i) => {
    const last = f[2], first = f[0];
    eq(Bazi.GUCHEN[i], ZHI[(ZHI.indexOf(last) + 1) % 12], `${f} 的孤辰该是方的前一位`);
    eq(Bazi.GUASU[i], ZHI[(ZHI.indexOf(first) + 11) % 12], `${f} 的寡宿该是方的后一位`);
  });
});

console.log('【五】死条穷举:八个新神煞都触发得到,且不许把断语冲成噪音');
const CHARTS = [];
for (let y = 1975; y <= 2005; y += 2) for (const m of [0, 4, 8]) for (const g of ['男', '女']) {
  CHARTS.push(Bazi.chart(new Date(y, m, 12, 10, 30), g, 116.4));
}
t('八个新神煞在样本里全都触发得到', () => {
  const NEW = ['将星', '劫煞', '亡神', '灾煞', '六厄', '孤辰', '寡宿', '破碎'];
  const seen = {}; NEW.forEach(k => (seen[k] = 0));
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  let n = 0;
  for (const c of CHARTS) for (let k = 0; k < 60; k++) {
    const marks = Bazi.flowMarks(c, GAN[k % 10], ZHI[k % 12]);
    n++;
    for (const t0 of NEW) if (marks.some(x => x.startsWith(t0))) seen[t0]++;
  }
  for (const t0 of NEW) ok(seen[t0] > 0, `「${t0}」是死条:${n} 次里一次没触发`);
  // 触发率该在一个合理区间:每个神煞占 12 支里的 1~2 支,由年支与日支两头起
  for (const t0 of NEW) {
    const r = seen[t0] / n;
    ok(r > 0.05 && r < 0.35, `「${t0}」触发率 ${(r * 100).toFixed(1)}% 不合常理(该在 5%~35%)`);
  }
});
t('shenShaOf 直接查也要八个全查得到', () => {
  const got = new Set();
  for (const yz of ZHI) for (const dz of ZHI) for (const z of ZHI) Bazi.shenShaOf(yz, dz, z).forEach(x => got.add(x));
  for (const k of ['将星', '华盖', '桃花', '驿马', '劫煞', '亡神', '灾煞', '六厄', '孤辰', '寡宿', '破碎']) {
    ok(got.has(k), `${k} 查不出来`);
  }
});
t('加了九条之后,断语没被冲成噪音', () => {
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  let n = 0, tot = 0, mx = 0;
  for (const c of CHARTS.slice(0, 40)) for (let k = 0; k < 60; k++) {
    const m = Bazi.flowMarks(c, GAN[k % 10], ZHI[k % 12]);
    n++; tot += m.length; mx = Math.max(mx, m.length);
  }
  ok(tot / n < 4, `每个流支平均 ${(tot / n).toFixed(2)} 条标记,太吵了`);
  ok(mx <= 8, `单个流支最多 ${mx} 条标记,太吵了`);
});

console.log('【六】说人话:白话断语一个推演名目都不许有');
t('九条白话断语过体检员', () => {
  const bad = [];
  for (const k of Object.keys(Bazi.SHENSHA_SAY)) {
    const s = Bazi.SHENSHA_SAY[k];
    const hits = Tijian.check(s, { zone: '断语', minChars: 0 }).hits
      .filter(h => ['术语', '说教', '空话', '花钱消灾', '模棱'].includes(h.kind));
    if (hits.length) bad.push(`${k}「${s.slice(0, 24)}」← ${hits.map(h => h.kind + ':' + h.snippet).join('/')}`);
  }
  ok(!bad.length, bad.join('\n      '));
});
t('每一条都落到能照着做的事上,不是光报个名目', () => {
  for (const k of Object.keys(Bazi.SHENSHA_SAY)) {
    const s = Bazi.SHENSHA_SAY[k];
    ok(s.length >= 20, `${k} 太短,等于只报了个名目:${s}`);
    ok(/——|:|:/.test(s), `${k} 该是「名目 + 这是什么事 + 怎么办」的结构`);
  }
});
t('凶的那几条不许只报凶——原文两面都说的,程序也要两面都留着', () => {
  // 铁律七:不比卦面乐观或悲观半分。原文对劫煞、灾煞、六厄、破碎都写了「有救则吉」那一面。
  for (const k of ['jiesha', 'zaisha', 'liue', 'posui']) {
    const it = SS.items.find(x => x.key === k);
    ok(it['两面'] && it['两面'].length > 20, `${it.name} 没留下原文里好的那一面`);
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
