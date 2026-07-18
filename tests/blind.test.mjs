// 盲测器:答案之锚(取向/取期/取数)公平公正校验 node tests/blind.test.mjs
// 方法:规程即答案钥匙。固定卦反复问 → 答案必须逐字一致(确定性);
// 扫全六十四卦×各动爻 → 八方与量级档不许偏科(公平);日期必须年月日俱全且在窗内(公正)。
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Yingqi = require('../yingqi.js');
const GuaCore = require('../gua-core.js');
const Najia = require('../najia.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

const FROM = new Date(2026, 6, 18, 12);
// 造全量固定卦:64卦 × (静卦 + 六个单动爻) = 448 个确定卦例
function allCasts() {
  const out = [];
  for (let n = 0; n < 64; n++) {
    const bits = n.toString(2).padStart(6, '0').split('').map(Number);
    out.push(GuaCore.castFromSums(bits.map(b => (b ? 7 : 8))));
    for (let mv = 0; mv < 6; mv++) {
      out.push(GuaCore.castFromSums(bits.map((b, i) => (i === mv ? (b ? 9 : 6) : (b ? 7 : 8)))));
    }
  }
  return out;
}

console.log('【一】确定性:同卦百问必同答(主观性=零)');
t('随机抽 20 卦,各连问 100 遍,取向/取期/取数逐字一致', () => {
  const casts = allCasts();
  for (let i = 0; i < 20; i++) {
    const c = casts[(i * 97 + 13) % casts.length];
    const first = JSON.stringify([Yingqi.direction(c), Yingqi.dates(c, FROM), Yingqi.amount(c)]);
    for (let j = 0; j < 100; j++) {
      eq(JSON.stringify([Yingqi.direction(c), Yingqi.dates(c, FROM), Yingqi.amount(c)]), first, `第${i}卦第${j}问`);
    }
  }
});

console.log('【二】取期:年月日俱全、在窗内、支序正确');
t('448 卦例:近应必在 13 天内且日支正对,冲应日支正冲,月应落该支之月', () => {
  for (const c of allCasts()) {
    const d = Yingqi.dates(c, FROM);
    ok(/^\d{4}年\d{1,2}月\d{1,2}日$/.test(d.near.date), '近应格式:' + d.near.date);
    const m = d.near.date.match(/^(\d+)年(\d+)月(\d+)日$/);
    const nd = new Date(+m[1], +m[2] - 1, +m[3], 12);
    const diff = (nd - FROM) / 86400000;
    ok(diff >= 0.5 && diff <= 13, '近应窗:' + diff);
    eq(Najia.ganZhi(nd).dayZhi, d.zhi, '近应日支');
    const cm = d.chongDate.date.match(/^(\d+)年(\d+)月(\d+)日$/);
    eq(Najia.ganZhi(new Date(+cm[1], +cm[2] - 1, +cm[3], 12)).dayZhi, d.chong, '冲应日支');
    const mm = d.monthDate.date.match(/^(\d+)年(\d+)月(\d+)日$/);
    const md = new Date(+mm[1], +mm[2] - 1, +mm[3], 12);
    eq(Najia.ganZhi(md).monthZhi, d.zhi, '月应之月支');
    eq(Najia.ganZhi(md).dayZhi, d.zhi, '月应之日支');
  }
});

console.log('【三】取向:八方齐备、无偏科(公平)');
t('448 卦例取向覆盖全部八方,单方占比不过 25%', () => {
  const cnt = {};
  const casts = allCasts();
  for (const c of casts) {
    const d = Yingqi.direction(c);
    cnt[d.dir] = (cnt[d.dir] || 0) + 1;
  }
  const dirs = Object.keys(cnt);
  ok(dirs.length === 8, '八方应齐,得' + dirs.join(','));
  for (const [k, v] of Object.entries(cnt)) ok(v / casts.length <= 0.25, `${k}偏科:${(v / casts.length * 100).toFixed(1)}%`);
});
t('距离档三档齐备且各不低于一成', () => {
  const cnt = {};
  const casts = allCasts();
  for (const c of casts) { const d = Yingqi.direction(c); cnt[d.dist] = (cnt[d.dist] || 0) + 1; }
  eq(Object.keys(cnt).length, 3, '三档');
  for (const v of Object.values(cnt)) ok(v / casts.length >= 0.1, '档位过瘦');
});

console.log('【四】取数:量级档分布公平、区间自洽');
t('448 卦例五档量级至少现四档,单档不过四成;区间宽恰一个首位步长', () => {
  const cnt = {};
  const casts = allCasts();
  for (const c of casts) {
    const a = Yingqi.amount(c);
    cnt[a.tier] = (cnt[a.tier] || 0) + 1;
    eq(a.range[1] - a.range[0], Math.pow(10, a.digits - 1), '区间宽');
    ok(a.range[0] >= Math.pow(10, a.digits - 1) && a.range[1] <= Math.pow(10, a.digits), '区间落在本档位数内');
  }
  ok(Object.keys(cnt).length >= 4, '档数=' + Object.keys(cnt).length);
  for (const [k, v] of Object.entries(cnt)) ok(v / casts.length <= 0.4, `${k}偏科:${(v / casts.length * 100).toFixed(1)}%`);
});

console.log('【五】锚文本:规矩句与全要素在位');
t('材料含答案之锚、锚定规矩、全年月日;问数时含量级区间', () => {
  const c = GuaCore.castFromSums([9, 7, 7, 8, 8, 8]);
  const m = Yingqi.material(c, FROM, true);
  ok(m.includes('答案之锚') && m.includes('锚定规矩'), '锚与规矩');
  ok(/\d{4}年\d{1,2}月\d{1,2}日/.test(m), '全日期');
  ok(m.includes('区间') && m.includes('~'), '量级区间');
  const m2 = Yingqi.material(c, FROM, false);
  ok(!m2.includes('取数:'), '不问数不给数');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
