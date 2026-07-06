// 内测:农历、梅花易数、小六壬、蓍草分布(node tests/fangmen.test.mjs)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Lunar = require('../lunar.js');
const Meihua = require('../meihua.js');
const Xlr = require('../xiaoliuren.js');
const GuaCore = require('../gua-core.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】农历(朔日定月、无中气置闰)');
t('春节锚点:2023/2024/2025/2026 正月初一', () => {
  for (const [d, y] of [['2023-01-22', 2023], ['2024-02-10', 2024], ['2025-01-29', 2025], ['2026-02-17', 2026]]) {
    const l = Lunar.fromDate(new Date(d + 'T12:00:00'));
    eq(l.monthName + l.dayName, '正月初一', d); eq(l.lYear, y, d);
  }
});
t('闰月:2020 闰四月、2023 闰二月、2025 闰六月', () => {
  eq(Lunar.fromDate(new Date('2020-05-23T12:00:00')).monthName, '闰四月');
  eq(Lunar.fromDate(new Date('2023-03-22T12:00:00')).monthName, '闰二月');
  eq(Lunar.fromDate(new Date('2025-07-25T12:00:00')).monthName, '闰六月');
});
t('除夕与年干支:2024-02-09 = 癸卯年腊月三十', () => {
  const l = Lunar.fromDate(new Date('2024-02-09T12:00:00'));
  eq(l.yearGZ, '癸卯'); eq(l.monthName + l.dayName, '腊月三十');
});
t('时辰:23:30 为子时数1,15:00 为申时数9', () => {
  eq(Lunar.fromDate(new Date('2026-07-06T23:30:00')).hourNum, 1);
  eq(Lunar.fromDate(new Date('2026-07-06T15:00:00')).hourNum, 9);
});

console.log('【二】梅花易数(以《梅花易数》观梅占为准)');
t('观梅占:辰年十二月十七日申时 → 泽火革,初爻动,互乾巽,变泽山咸,体兑用离', () => {
  // 年支辰=5,月12,日17 → 34;34%8=2 兑上;加申时9=43;43%8=3 离下;43%6=1 初爻动
  const lunar = { yearBranchNum: 5, lMonth: 12, lDay: 17, hourNum: 9, yearGZ: '辰', monthName: '十二月', dayName: '十七', hourBranch: '申' };
  const c = Meihua.castByTime(lunar);
  eq(c.ben.full, '泽火革'); eq(c.moving, 1);
  eq(c.bian.full, '泽山咸');
  eq(c.tiTri.name, '兑', '体'); eq(c.yongTri.name, '离', '用');
  // 互卦:下互巽上互乾 → 天风姤
  eq(c.hu.full, '天风姤');
  const a = Meihua.analyze(c, '丑');
  eq(a.rel, '用克体'); eq(a.lv, '凶'); // 离火克兑金,classic 断有折股之凶
});
t('报数起卦:3、5 加午时7 → 上离下巽火风鼎,三爻动', () => {
  const c = Meihua.castByNumbers(3, 5, 7);
  eq(c.ben.full, '火风鼎'); // 上离3 下巽5
  eq(c.moving, 3); // (3+5+7)%6=15%6=3
  ok(c.movingInLower, '三爻在下卦'); eq(c.tiTri.name, '离', '体为上卦');
});
t('整八整六取满数:8、8 加子时1 → 坤为地,(8+8+1)%6=5 五爻动', () => {
  const c = Meihua.castByNumbers(8, 8, 1);
  eq(c.ben.full, '坤为地'); eq(c.moving, 5);
});
t('体用五行关系覆盖五种断语', () => {
  const rels = new Set();
  for (let n1 = 1; n1 <= 8; n1++) for (let n2 = 1; n2 <= 8; n2++) {
    rels.add(Meihua.analyze(Meihua.castByNumbers(n1, n2, 3), '午').rel);
  }
  for (const r of ['用生体', '体生用', '体克用', '用克体', '体用比和']) ok(rels.has(r), '缺 ' + r);
});

console.log('【三】小六壬');
t('时间起课:三月初五午时 → 速喜/大安/大安', () => {
  const c = Xlr.castByTime({ lMonth: 3, lDay: 5, hourNum: 7, yearGZ: '某', monthName: '三月', dayName: '初五', hourBranch: '午' });
  eq(c.gongs[0].name, '速喜'); eq(c.gongs[1].name, '大安'); eq(c.gongs[2].name, '大安');
});
t('正月初一子时 → 大安/大安/大安', () => {
  const c = Xlr.castByTime({ lMonth: 1, lDay: 1, hourNum: 1, yearGZ: '某', monthName: '正月', dayName: '初一', hourBranch: '子' });
  eq(c.gongs.map(g => g.name).join(','), '大安,大安,大安');
});
t('报数起课与六宫属性完备', () => {
  const c = Xlr.castByNumbers(6, 1, 1);
  eq(c.gongs[0].name, '空亡'); eq(c.gongs[1].name, '空亡'); eq(c.gongs[2].name, '空亡');
  for (const g of Xlr.GONG) ok(g.wx && g.shen && g.verse.length > 20 && g.ji, g.name);
});

console.log('【四】蓍草大衍法');
t('大衍分布:6=1/16, 7=5/16, 8=7/16, 9=3/16(4 万爻,偏差<1.5%)', () => {
  const freq = { 6: 0, 7: 0, 8: 0, 9: 0 }; const N = 40000;
  for (let i = 0; i < N; i++) freq[GuaCore.dayanLine().sum]++;
  const exp = { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 };
  for (const k of [6, 7, 8, 9]) {
    const r = freq[k] / N;
    ok(Math.abs(r - exp[k]) < 0.015, `${k}: ${r.toFixed(4)} vs ${exp[k].toFixed(4)}`);
  }
});
t('蓍草成卦走同一解卦管线', () => {
  const lines = Array.from({ length: 6 }, () => GuaCore.dayanLine().sum);
  const c = GuaCore.castFromSums(lines);
  ok(c.ben && c.ben.full, '本卦');
  const r = GuaCore.interpret(c);
  ok(r.headline && r.focus.length, '解读');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
