// 内测:纳甲排盘与干支历测试(node tests/najia.test.mjs)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Najia = require('../najia.js');
const GuaData = require('../gua-data.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】八宫归宫与世应(经典卦例)');
t('全部 64 卦均有归宫,每宫恰 8 卦', () => {
  eq(Object.keys(Najia.PALACE_MAP).length, 64);
  const count = {};
  for (const k of Object.keys(Najia.PALACE_MAP)) count[Najia.PALACE_MAP[k].palace] = (count[Najia.PALACE_MAP[k].palace] || 0) + 1;
  for (const p of Object.keys(count)) eq(count[p], 8, p + '宫');
});
t('乾宫八卦次序:乾姤遯否观剥晋大有', () => {
  const cases = [
    ['111111', '本宫卦', 6], // 乾为天
    ['011111', '一世卦', 1], // 天风姤
    ['001111', '二世卦', 2], // 天山遯
    ['000111', '三世卦', 3], // 天地否
    ['000011', '四世卦', 4], // 风地观
    ['000001', '五世卦', 5], // 山地剥
    ['000101', '游魂卦', 4], // 火地晋
    ['111101', '归魂卦', 3], // 火天大有
  ];
  for (const [id, gen, shi] of cases) {
    const p = Najia.PALACE_MAP[id];
    eq(p.palace, '乾', GuaData.BY_ID[id].full); eq(p.gen, gen, GuaData.BY_ID[id].full); eq(p.shi, shi, GuaData.BY_ID[id].full);
  }
});
t('散卦归宫抽查:既济坎宫三世、未济离宫三世、随震宫归魂、复坤宫一世', () => {
  let p = Najia.PALACE_MAP['101010']; eq(p.palace, '坎'); eq(p.gen, '三世卦'); eq(p.shi, 3); // 水火既济
  p = Najia.PALACE_MAP['010101']; eq(p.palace, '离'); eq(p.gen, '三世卦');                    // 火水未济
  p = Najia.PALACE_MAP['100110']; eq(p.palace, '震'); eq(p.gen, '归魂卦'); eq(p.shi, 3);      // 泽雷随
  p = Najia.PALACE_MAP['100000']; eq(p.palace, '坤'); eq(p.gen, '一世卦'); eq(p.shi, 1);      // 地雷复
});
t('世应相隔三位', () => {
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    const p = Najia.PALACE_MAP[id];
    eq((p.shi - 1 + 3) % 6, p.ying - 1, id);
  }
});

console.log('【二】纳甲干支与六亲');
t('乾卦六爻纳甲:甲子水子孙 … 壬戌土父母', () => {
  const z = Najia.zhuangGua('111111');
  const expect = [['甲子', '水', '子孙'], ['甲寅', '木', '妻财'], ['甲辰', '土', '父母'], ['壬午', '火', '官鬼'], ['壬申', '金', '兄弟'], ['壬戌', '土', '父母']];
  z.lines.forEach((l, i) => { eq(l.ganZhi, expect[i][0], '爻' + (i + 1)); eq(l.wx, expect[i][1]); eq(l.liuQin, expect[i][2]); });
  ok(z.lines[5].shi && z.lines[2].ying, '乾世上爻应三爻');
});
t('坤卦纳乙癸:初爻乙未土兄弟,上爻癸酉金子孙', () => {
  const z = Najia.zhuangGua('000000');
  eq(z.lines[0].ganZhi, '乙未'); eq(z.lines[0].liuQin, '兄弟');
  eq(z.lines[5].ganZhi, '癸酉'); eq(z.lines[5].liuQin, '子孙');
});
t('坎卦纳戊:初爻戊寅木子孙;离卦纳己:初爻己卯木父母?', () => {
  const zk = Najia.zhuangGua('010010');
  eq(zk.lines[0].ganZhi, '戊寅'); eq(zk.lines[0].liuQin, '子孙'); // 坎宫水,寅木,水生木
  const zl = Najia.zhuangGua('101101');
  eq(zl.lines[0].ganZhi, '己卯'); eq(zl.lines[0].liuQin, '父母'); // 离宫火,卯木,木生火→生我=父母
});
t('世应爻标记唯一', () => {
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    const z = Najia.zhuangGua(id);
    eq(z.lines.filter(l => l.shi).length, 1, id);
    eq(z.lines.filter(l => l.ying).length, 1, id);
  }
});

console.log('【三】干支历');
t('日柱锚点:2000-01-07 甲子、2000-01-01 戊午、1970-01-01 辛巳', () => {
  eq(Najia.ganZhi(new Date(2000, 0, 7)).day, '甲子');
  eq(Najia.ganZhi(new Date(2000, 0, 1)).day, '戊午');
  eq(Najia.ganZhi(new Date(1970, 0, 1)).day, '辛巳');
});
t('太阳黄经:2026 春分(3-20 前后)黄经≈0°', () => {
  const lam = Najia.sunLongitude(Date.UTC(2026, 2, 20, 12));
  ok(lam > 359 || lam < 1, '得到 ' + lam.toFixed(3));
});
t('年柱与月建:2024-02-10 甲辰年丙寅月;2024-01-20 癸卯年乙丑月(立春前属旧岁)', () => {
  const a = Najia.ganZhi(new Date(2024, 1, 10, 12));
  eq(a.year, '甲辰'); eq(a.month, '丙寅');
  const b = Najia.ganZhi(new Date(2024, 0, 20, 12));
  eq(b.year, '癸卯'); eq(b.month, '乙丑');
});
t('月建连续性:全年十二节各月支齐全(2025)', () => {
  const seen = new Set();
  for (let m = 0; m < 12; m++) seen.add(Najia.ganZhi(new Date(2025, m, 15, 12)).monthZhi);
  eq(seen.size, 12, [...seen].join(','));
});
t('旬空:甲子日戌亥空;癸亥日子丑空', () => {
  const a = Najia.ganZhi(new Date(2000, 0, 7));
  eq(a.xunKong.join(''), '戌亥');
  // 癸亥 = 甲子 + 59 天
  const b = Najia.ganZhi(new Date(2000, 2, 6)); // 2000-01-07 + 59 = 2000-03-06
  eq(b.day, '癸亥'); eq(b.xunKong.join(''), '子丑');
});

console.log('【四】六神');
t('甲乙日青龙起初爻,丙丁朱雀,戊勾陈,己螣蛇,庚辛白虎,壬癸玄武', () => {
  eq(Najia.liuShen('甲')[0], '青龙'); eq(Najia.liuShen('乙')[0], '青龙');
  eq(Najia.liuShen('丙')[0], '朱雀'); eq(Najia.liuShen('戊')[0], '勾陈');
  eq(Najia.liuShen('己')[0], '螣蛇'); eq(Najia.liuShen('庚')[0], '白虎');
  eq(Najia.liuShen('癸')[0], '玄武');
  eq(Najia.liuShen('甲').join(','), '青龙,朱雀,勾陈,螣蛇,白虎,玄武');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
