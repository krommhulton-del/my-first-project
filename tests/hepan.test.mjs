// 双人合盘(hepan.js)专项内测
//
// **这套测试证明不了「合盘断得准」。** 它只证明程序不犯浑——
// 因为「两个人合着看」这套组合规则本身是自拟的、零回测(见 hepan.js 抬头)。
// 全部是【内部一致性测试】,一条外部对照都没有,这一点得先写明白。
//
// 钉的是五件事:
//   ① 双向不对称——他旺你与你旺他是两个数,不许算成一个;
//   ② 四种关系的叙述不许恒同(否则那四个分类是摆设);
//   ③ 死条穷举——每一层的每一档都触发得到;
//   ④ 不许替人做去留的决定(不出现「合适/不合适/该不该在一起/建议分开」);
//   ⑤ 诚实那段话必须在,且客人看得到的字里一个推演名目都不许有。
import { readFileSync } from 'node:fs';
import Bazi from '../bazi.js';
import Hepan from '../hepan.js';
import Tijian from '../tijian.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

const CHARTS = [];
for (let y = 1975; y <= 2002; y += 1) for (const m of [0, 4, 8]) for (const g of ['男', '女']) {
  CHARTS.push(Bazi.chart(new Date(y, m, 12, 10, 30), g, 116.4));
}
const PAIRS = [];
for (let i = 0; i < CHARTS.length; i += 3) for (let j = 1; j < CHARTS.length; j += 7) {
  if (i !== j) PAIRS.push([CHARTS[i], CHARTS[j]]);
}
const A = CHARTS[10], B = CHARTS[57];

console.log('【一】双向:他旺你与你旺他是两个数');
t('①② 不许算成一个数——总有相当一部分配对两边不等', () => {
  let diff = 0, n = 0;
  for (const [a, b] of PAIRS.slice(0, 400)) {
    const r = Hepan.pair(a, b, { fromYear: 2026, years: 2 });
    n++;
    if (r.layers.ta2me.score !== r.layers.me2ta.score) diff++;
  }
  ok(diff / n > 0.4, `只有 ${(diff / n * 100).toFixed(1)}% 的配对两边不等,这一层怕是被合成一个数了`);
});
t('把两人对调,①② 必须整个换位(证明确实是双向算的)', () => {
  const x = Hepan.pair(A, B, { fromYear: 2026, years: 2 });
  const y = Hepan.pair(B, A, { fromYear: 2026, years: 2 });
  eq(x.layers.ta2me.score, y.layers.me2ta.score, '对调后「他旺我」应等于原来的「我旺他」');
  eq(x.layers.me2ta.score, y.layers.ta2me.score, '反之亦然');
  eq(x.layers.gong.score, y.layers.gong.score, '冲合那一层与谁先谁后无关,应当一样');
});

console.log('【二】四种关系不许是摆设');
t('四种关系的分数与叙述,不许在样本里恒同', () => {
  let sameScore = 0, sameSay = 0, n = 0;
  for (const [a, b] of PAIRS.slice(0, 300)) {
    const r = Hepan.pair(a, b, { fromYear: 2026, years: 2 });
    const ks = Object.keys(r.rels);
    n++;
    if (new Set(ks.map(k => r.rels[k].total)).size === 1) sameScore++;
    if (new Set(ks.map(k => r.rels[k].say)).size === 1) sameSay++;
  }
  ok(sameScore / n < 0.05, `${(sameScore / n * 100).toFixed(1)}% 的配对四种关系分数完全一样`);
  // 这一条是自测当场揪出来的:头一版拿原始分判顺/拧,四种关系的叙述一模一样,
  // 只有总分不同——那四个分类就成了摆设。改成按各关系自己的加权分判。
  ok(sameSay / n < 0.35, `${(sameSay / n * 100).toFixed(1)}% 的配对四种关系叙述一模一样,权重怕是没吃上`);
});
t('每种关系都写明了它为什么这么排权重', () => {
  for (const k of Object.keys(Hepan.RELS)) {
    const R = Hepan.RELS[k];
    ok(R.why && R.why.length > 20, `${k} 没写权重理由——写不出理由的权重不许留`);
    const sum = Object.values(R.w).reduce((a, b) => a + b, 0);
    ok(sum > 0, `${k} 的权重不该全是零`);
  }
  // 共事那一路的不对称是故意的,钉住它
  ok(Hepan.RELS.gongshi.w.ta2me > Hepan.RELS.gongshi.w.me2ta, '上下级这一路,「对方旺不旺你」该重于反过来');
  ok(Hepan.RELS.hezuo.w.bu > Hepan.RELS.lianai.w.bu, '合伙看互补,该比过日子更看重「补不补得上」');
});

console.log('【三】死条穷举:每一层的每一档都触发得到');
t('①②③ 五档、④ 三档,一档不许是死的', () => {
  const got = { ta2me: new Set(), me2ta: new Set(), gong: new Set(), bu: new Set() };
  const relBand = {}; Object.keys(Hepan.RELS).forEach(k => (relBand[k] = new Set()));
  for (const [a, b] of PAIRS) {
    const r = Hepan.pair(a, b, { fromYear: 2026, years: 2 });
    got.ta2me.add(r.layers.ta2me.verdict); got.me2ta.add(r.layers.me2ta.verdict);
    got.gong.add(r.layers.gong.verdict);
    got.bu.add(r.layers.buA.verdict); got.bu.add(r.layers.buB.verdict);
    for (const k of Object.keys(r.rels)) relBand[k].add(r.rels[k].band);
  }
  const FIVE = ['很顺', '偏顺', '不顺不拧', '偏拧', '很拧'];
  for (const L of ['ta2me', 'me2ta', 'gong']) {
    for (const v of FIVE) ok(got[L].has(v), `${L} 层的「${v}」是死条:${PAIRS.length} 对里一次没触发`);
  }
  // 「补」这一层只有三档——分只可能是 0/1/2/3,套五档尺的话负档永远不可达(死条穷举查出来的)
  for (const v of ['补得上', '补上一半', '补不上']) ok(got.bu.has(v), `补这一层的「${v}」是死条`);
  eq(got.bu.size, 3, '补这一层不该出现三档以外的说法');
  for (const k of Object.keys(relBand)) for (const v of FIVE) ok(relBand[k].has(v), `${k} 的「${v}」是死条`);
});
t('冲合那一层的每一条判语都触发得到', () => {
  const seen = new Set();
  for (const [a, b] of PAIRS) {
    const r = Hepan.layerGong(a, b, '甲', '乙');
    for (const it of r.items) seen.add(it.why.slice(0, 12));
  }
  // 自身那一块 7 种(对撞/相冲/六合/三合/刑/害/无)+ 根基相合 + 根基相冲 + 同一味 = 10
  ok(seen.size >= 10, `只触发得到 ${seen.size} 条判语,应当 ≥10——有死条`);
});

console.log('【四】自律:不替人做去留的决定');
t('通篇不许出现「合适/不合适/该不该在一起/建议分开」', () => {
  const BAN = /合适|不合适|该不该在一起|建议(分开|在一起)|不宜结合|天生一对|命中注定/;
  for (const [a, b] of PAIRS.slice(0, 250)) {
    const r = Hepan.pair(a, b, { fromYear: 2026, years: 2 });
    // 留神:**免责声明那两段不进这一扫**。heldNote 里原样引着「不报『合适/不合适』」——
    // 那是个否定句,正是该说的话;拿禁词表去扫它,等于禁止程序声明自己不做某件事。
    // (同一类误伤 v0.84 已经栽过一次:测试禁「一定会」,卡住了自己那句「不承诺一定会怎样」。)
    // heldNote 本身由下面那条测试单独钉。
    const txt = [
      ...r.howto,
      ...r.layers.ta2me.lines, ...r.layers.me2ta.lines,
      ...r.layers.gong.items.map(x => x.why),
      ...r.layers.buA.lines, ...r.layers.buB.lines, r.layers.yun.line,
      ...Object.keys(r.rels).map(k => r.rels[k].say + r.rels[k].why),
    ].join(' ');
    ok(!BAN.test(txt), '出现了替人做决定的话:' + (txt.match(BAN) || [''])[0]);
  }
});
t('姻缘方向那条铁律照旧管用:不许自己补吉凶', () => {
  for (const [a, b] of PAIRS.slice(0, 200)) {
    const r = Hepan.pair(a, b, { fromYear: 2026, years: 3 });
    const txt = [r.layers.yun.line, ...r.howto].join(' ');
    ok(!/感情大吉|必有波折|必定[有能]|注定/.test(txt), '自己补了吉凶断语:' + txt.slice(0, 60));
  }
});
t('「不替人做决定」这句话本身必须摆出来', () => {
  const r = Hepan.pair(A, B, { fromYear: 2026, years: 2 });
  ok(/不报「?合适/.test(r.heldNote) || /该不该在一起/.test(r.heldNote), '这句话得在:' + r.heldNote);
  ok(/你自己的事|一副盘定不了/.test(r.heldNote), '要说清决定是人做的');
});

console.log('【五】诚实与说人话');
t('诚实那段话必须写着「自拟」「没有回测」', () => {
  ok(/自拟/.test(Hepan.HONEST), '要写明是自拟的');
  ok(/一件回测都没有|零回测|没有回测/.test(Hepan.HONEST), '要写明零回测');
  ok(/别当判决|不代表它验过准/.test(Hepan.HONEST), '要写明当参考别当判决');
  const r = Hepan.pair(A, B, { fromYear: 2026, years: 2 });
  eq(r.honest, Hepan.HONEST, '每次合盘都要把这段话带出来');
});
t('客人看得到的每一句,一个推演名目都不许有', () => {
  let total = 0; const bad = [];
  const scan = (where, str) => {
    if (!str) return;
    total++;
    const hits = Tijian.check(String(str), { zone: '断语', minChars: 0 }).hits
      .filter(h => ['术语', '说教', '空话', '花钱消灾', '模棱'].includes(h.kind));
    if (hits.length) bad.push(`${where}「${String(str).slice(0, 30)}」← ${hits.map(h => h.kind + ':' + h.snippet).join('/')}`);
  };
  for (const [a, b] of PAIRS.slice(0, 120)) {
    const r = Hepan.pair(a, b, { fromYear: 2026, years: 3 });
    scan('诚实', r.honest); scan('自律', r.heldNote);
    r.howto.forEach(x => scan('怎么绕', x));
    r.layers.ta2me.lines.forEach(x => scan('①', x));
    r.layers.me2ta.lines.forEach(x => scan('②', x));
    r.layers.gong.items.forEach(x => scan('③', x.why));
    r.layers.buA.lines.forEach(x => scan('④', x));
    r.layers.buB.lines.forEach(x => scan('④', x));
    scan('⑤', r.layers.yun.line);
    for (const k of Object.keys(r.rels)) { scan('关系', r.rels[k].say); scan('权重理由', r.rels[k].why); }
  }
  ok(total > 800, `扫到的字段太少(${total}),测试自己可能失效了`);
  ok(!bad.length, `${bad.length}/${total} 条不干净:\n      ` + bad.slice(0, 6).join('\n      '));
});
t('喂模型的材料里,把「不许替人做决定」写死了', () => {
  const m = Hepan.material(Hepan.pair(A, B, { fromYear: 2026, years: 3 }));
  ok(/不许说「合适\/不合适」/.test(m), '材料里要挡住「合适不合适」这套说辞');
  ok(/自拟的、没有回测/.test(m), '材料里要转述诚实那句话');
  ok(/四种关系分开讲,不许合成一个总分/.test(m), '材料里要写明四种关系分开');
});

console.log('【六】§四:这个模块不许自己算断法');
t('喜忌、调候、五行力量、年运一律取自别处', () => {
  const s = readFileSync(new URL('../hepan.js', import.meta.url), 'utf8');
  ok(!/judgeStrength|pickYongShen|function\s+tiaoHou/.test(s), 'hepan.js 里不许自己实现旺衰或取用神');
  ok(/chart\.yong/.test(s) && /tiaohou/.test(s) && /strength\.pow/.test(s), '该取的都要从 chart 上取');
  ok(/Yunshi\.nianYun/.test(s), '逐年得力要走 Yunshi.nianYun,不自己另算');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
