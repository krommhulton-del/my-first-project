// 内测:算命学(陽占人体星図/十二大従星/蔵干/天中殺) node tests/sanmei.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Sanmei = require('../sanmei.js');
const Najia = require('../najia.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】十大主星转星(十神对应)');
t('甲日主对十干:比肩貫索、劫财石門、食神鳳閣、伤官調舒、偏财禄存、正财司禄、七杀車騎、正官牽牛、偏印龍高、正印玉堂', () => {
  const exp = { 甲: '貫索星', 乙: '石門星', 丙: '鳳閣星', 丁: '調舒星', 戊: '禄存星', 己: '司禄星', 庚: '車騎星', 辛: '牽牛星', 壬: '龍高星', 癸: '玉堂星' };
  for (const [g, s] of Object.entries(exp)) eq(Sanmei.mainStar('甲', g).star, s, '甲×' + g);
});
t('阴日主亦然:癸日主见戊为正官牽牛、见庚为正印玉堂、见丙为正财司禄', () => {
  eq(Sanmei.mainStar('癸', '戊').star, '牽牛星');
  eq(Sanmei.mainStar('癸', '庚').star, '玉堂星');
  eq(Sanmei.mainStar('癸', '丙').star, '司禄星');
  eq(Sanmei.mainStar('癸', '癸').star, '貫索星');
});

console.log('【二】十二運与十二大従星');
t('長生表:甲亥丙寅戊寅庚巳壬申(阳顺);乙午丁酉己酉辛子癸卯(阴逆)', () => {
  const exp = { 甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申', 乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯' };
  for (const [g, z] of Object.entries(exp)) eq(Sanmei.CHANGSHENG[g], z, g);
  eq(Sanmei.juniUn('甲', '亥'), '長生');
  eq(Sanmei.juniUn('甲', '子'), '沐浴', '阳干顺行');
  eq(Sanmei.juniUn('乙', '午'), '長生');
  eq(Sanmei.juniUn('乙', '巳'), '沐浴', '阴干逆行');
});
t('従星能量点数:将12禄11南10贵9堂8恍7印6库5胡4报3极2驰1', () => {
  const exp = { 帝旺: ['天将星', 12], 建禄: ['天禄星', 11], 冠帯: ['天南星', 10], 長生: ['天貴星', 9], 衰: ['天堂星', 8], 沐浴: ['天恍星', 7], 養: ['天印星', 6], 墓: ['天庫星', 5], 病: ['天胡星', 4], 胎: ['天報星', 3], 死: ['天極星', 2], 絶: ['天馳星', 1] };
  for (const [st, [n, p]] of Object.entries(exp)) { eq(Sanmei.JUSEI[st].name, n, st); eq(Sanmei.JUSEI[st].pts, p, st + '点'); }
});

console.log('【三】蔵干(节入深度)');
t('申支:第7天戊、第8天壬、第15天庚(初中本三元边界)', () => {
  eq(Sanmei.zokanOf('申', 7), '戊');
  eq(Sanmei.zokanOf('申', 8), '壬');
  eq(Sanmei.zokanOf('申', 14), '壬');
  eq(Sanmei.zokanOf('申', 15), '庚');
});
t('子卯酉两元支:第10天取初元,第11天取本元', () => {
  eq(Sanmei.zokanOf('子', 10), '壬'); eq(Sanmei.zokanOf('子', 11), '癸');
  eq(Sanmei.zokanOf('卯', 10), '甲'); eq(Sanmei.zokanOf('卯', 11), '乙');
  eq(Sanmei.zokanOf('酉', 10), '庚'); eq(Sanmei.zokanOf('酉', 11), '辛');
});
t('节入日数:节气换月次日为第1天起算,值域1-32,且与月支自洽', () => {
  const d = Sanmei.daysIntoJie(new Date(2026, 1, 5, 12)); // 立春(2026-02-04)次日
  ok(d >= 1 && d <= 2, '立春次日应为第1-2天,得' + d);
  const d2 = Sanmei.daysIntoJie(new Date(2026, 1, 28, 12));
  ok(d2 >= 23 && d2 <= 26, '2月底应在寅月第23-26天,得' + d2);
});

console.log('【四】人体星図整図');
t('2000-01-07(甲子日)整図:五主星三従星齐备,晚年従星=甲×子=沐浴天恍星7点', () => {
  const c = Sanmei.chart(new Date(2000, 0, 7, 12));
  eq(c.pillars.day, '甲子', '日柱');
  ok(c.stars.chest.star && c.stars.head.star && c.stars.belly.star && c.stars.leftHand.star && c.stars.rightHand.star, '五主星');
  eq(c.jusei.rightFoot.star, '天恍星', '晚年従星');
  eq(c.jusei.rightFoot.pts, 7);
  ok(c.energy.total >= 3 && c.energy.total <= 36, '能量范围');
  ok(c.energy.band.length > 2, '能量档位');
});
t('天中殺:甲子日生=戌亥天中殺,类型注解齐备;六种皆有注', () => {
  const c = Sanmei.chart(new Date(2000, 0, 7, 12));
  eq(c.tenchusatsu.type, '戌亥天中殺');
  eq(c.tenchusatsu.kong.join(''), '戌亥');
  for (const k of ['子丑', '寅卯', '辰巳', '午未', '申酉', '戌亥']) ok(Sanmei.TCS_NOTE[k], k);
});
t('主星取干口径:头=年干、腹=月干、左手=年支蔵干、胸=月支蔵干、右手=日支蔵干', () => {
  const date = new Date(1990, 5, 15, 12);
  const c = Sanmei.chart(date);
  const cal = Najia.ganZhi(date);
  eq(c.stars.head.from, cal.year[0], '头');
  eq(c.stars.belly.from, cal.month[0], '腹');
  eq(c.stars.leftHand.from, c.zokan.year, '左手');
  eq(c.stars.chest.from, c.zokan.month, '胸');
  eq(c.stars.rightHand.from, c.zokan.day, '右手');
});
t('材料文字版:含中心星、三期従星、能量、天中殺', () => {
  const m = Sanmei.material(Sanmei.chart(new Date(1990, 5, 15, 12)));
  ok(m.includes('中心星') && m.includes('従星三期') && m.includes('能量合计') && m.includes('天中殺'), m.slice(0, 60));
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
