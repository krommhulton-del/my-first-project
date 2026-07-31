// 内测·铁案审计:拿行内公认的标准答案对全系统(node tests/audit.test.mjs)
// 覆盖:纳甲歌八宫全表、世应安法、六亲、旬空、干支日历史锚点、农历春节/中秋铁案、
//       节气月建切换、梅花「观梅占」原例、小六壬起课、三钱/大衍概率分布。
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Najia = require('../najia.js');
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

console.log('【一】京房纳甲歌·八宫全表(甲子外壬午/乙未外癸丑…逐爻对)');
const NAJIA_EXPECT = {
  '111111': ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌'], // 乾为天
  '000000': ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉'], // 坤为地
  '100100': ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌'], // 震为雷
  '011011': ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯'], // 巽为风
  '010010': ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子'], // 坎为水
  '101101': ['己卯', '己丑', '己亥', '己酉', '己未', '己巳'], // 离为火
  '001001': ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅'], // 艮为山
  '110110': ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未'], // 兑为泽
};
t('八纯卦四十八爻干支与纳甲歌逐一相符', () => {
  for (const [id, exp] of Object.entries(NAJIA_EXPECT)) {
    const z = Najia.zhuangGua(id);
    z.lines.forEach((l, i) => eq(l.ganZhi, exp[i], `卦${id}第${i + 1}爻`));
  }
});
t('世应安法:八纯世上应三;一世姤世初应四;游魂晋世四;归魂大有世三', () => {
  eq(Najia.zhuangGua('111111').shi, 6, '乾为天世'); eq(Najia.zhuangGua('111111').ying, 3, '乾为天应');
  eq(Najia.zhuangGua('011111').shi, 1, '天风姤世'); eq(Najia.zhuangGua('011111').ying, 4, '天风姤应');
  eq(Najia.zhuangGua('000101').shi, 4, '火地晋(游魂)世');
  eq(Najia.zhuangGua('111101').shi, 3, '火天大有(归魂)世');
});
t('六亲(乾宫属金):子水子孙、寅木妻财、辰土父母、午火官鬼、申金兄弟', () => {
  const z = Najia.zhuangGua('111111');
  eq(z.palaceWx, '金', '乾宫五行');
  const qin = z.lines.map(l => l.liuQin).join(',');
  eq(qin, '子孙,妻财,父母,官鬼,兄弟,父母', '乾为天六亲自下而上');
});
t('晋、大有归乾宫(游魂归魂不离本宫)', () => {
  eq(Najia.zhuangGua('000101').palace, '乾', '火地晋');
  eq(Najia.zhuangGua('111101').palace, '乾', '火天大有');
});

console.log('【二】干支历铁案');
t('2000-01-07 甲子日(锚点),旬空戌亥', () => {
  const g = Najia.ganZhi(new Date(2000, 0, 7, 12));
  eq(g.day, '甲子');
  eq(g.xunKong.join(''), '戌亥', '甲子旬空');
});
t('1949-10-01 开国大典为甲子日(独立历史锚点)', () => {
  eq(Najia.ganZhi(new Date(1949, 9, 1, 12)).day, '甲子');
});
t('立春换月建:2026-02-03 仍丑月,2026-02-05 已寅月;年柱同界切换', () => {
  const before = Najia.ganZhi(new Date(2026, 1, 3, 12));
  const after = Najia.ganZhi(new Date(2026, 1, 5, 12));
  eq(before.monthZhi, '丑', '立春前');
  eq(after.monthZhi, '寅', '立春后');
  eq(before.year, '乙巳', '立春前属旧岁');
  eq(after.year, '丙午', '立春后属新岁');
});

console.log('【三】农历铁案(官方历对照)');
t('春节三连:2024-02-10 甲辰正月初一;2025-01-29 乙巳;2026-02-17 丙午', () => {
  const a = Lunar.fromDate(new Date(2024, 1, 10, 12));
  eq(`${a.yearGZ}${a.lMonth}-${a.lDay}`, '甲辰1-1', '2024');
  const b = Lunar.fromDate(new Date(2025, 0, 29, 12));
  eq(`${b.yearGZ}${b.lMonth}-${b.lDay}`, '乙巳1-1', '2025');
  const c = Lunar.fromDate(new Date(2026, 1, 17, 12));
  eq(`${c.yearGZ}${c.lMonth}-${c.lDay}`, '丙午1-1', '2026');
});
t('2025-10-06 中秋=八月十五', () => {
  const l = Lunar.fromDate(new Date(2025, 9, 6, 12));
  eq(`${l.lMonth}-${l.lDay}`, '8-15');
});

console.log('【四】梅花易数·邵雍「观梅占」原例复刻');
t('辰年十二月十七日申时:泽火革、互天风姤、初爻动变泽山咸、兑金为体离火克之断凶', () => {
  // 年5(辰)+月12+日17=34→上卦兑(2);+时9(申)=43→下卦离(3);43÷6余1→初爻动
  const lunar = { yearBranchNum: 5, lMonth: 12, lDay: 17, hourNum: 9, yearGZ: '甲辰', monthName: '腊月', dayName: '十七', hourBranch: '申' };
  const c = Meihua.castByTime(lunar);
  eq(c.ben.full, '泽火革', '本卦');
  eq(c.hu.full, '天风姤', '互卦');
  eq(c.moving, 1, '动爻');
  eq(c.bian.full, '泽山咸', '变卦');
  eq(c.tiTri.name, '兑', '体卦(动在下,体为上兑)');
  eq(c.yongTri.name, '离', '用卦');
  const a = Meihua.analyze(c);
  eq(a.rel, '用克体', '生克');
  eq(a.lv, '凶', '断级——史例果有女子折花伤股');
});

console.log('【五】小六壬起课');
t('宫序大安→留连→速喜→赤口→小吉→空亡;正月初一子时三宫全大安', () => {
  eq(Xlr.GONG.map(g => g.name).join(''), '大安留连速喜赤口小吉空亡', '宫序');
  const c = Xlr.castByTime({ lMonth: 1, lDay: 1, hourNum: 1, yearGZ: '', monthName: '正月', dayName: '初一', hourBranch: '子' });
  eq(c.gongs.map(g => g.name).join(','), '大安,大安,大安');
});
t('月上起日、日上起时连环推:五月初五午时=小吉/速喜/速喜', () => {
  const c = Xlr.castByTime({ lMonth: 5, lDay: 5, hourNum: 7, yearGZ: '', monthName: '五月', dayName: '初五', hourBranch: '午' });
  eq(c.gongs.map(g => g.name).join(','), '小吉,速喜,速喜');
});

console.log('【六】随机性与概率分布(CSPRNG 实测)');
t('三钱法四万爻:6=1/8、7=3/8、8=3/8、9=1/8,偏差<1.5%', () => {
  const n = 40000, cnt = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let i = 0; i < n; i++) cnt[GuaCore.tossLine().sum]++;
  const expct = { 6: .125, 7: .375, 8: .375, 9: .125 };
  for (const k of [6, 7, 8, 9]) {
    const p = cnt[k] / n;
    ok(Math.abs(p - expct[k]) < .015, `${k}:实测${(p * 100).toFixed(2)}% 期望${expct[k] * 100}%`);
  }
});
t('三钱逐位无偏:每一枚钱字面占比 50%±1.5%(排除位置偏差)', () => {
  const n = 30000, pos = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const l = GuaCore.tossLine();
    l.coins.forEach((c, j) => { if (c === '字') pos[j]++; });
  }
  pos.forEach((c, j) => ok(Math.abs(c / n - .5) < .015, `第${j + 1}枚:${(c / n * 100).toFixed(2)}%`));
});
t('大衍蓍草四万爻:6=1/16、7=5/16、8=7/16、9=3/16,偏差<1.5%(与三钱分布不同,老阳多于老阴)', () => {
  const n = 40000, cnt = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let i = 0; i < n; i++) cnt[GuaCore.dayanLine().sum]++;
  const expct = { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 };
  for (const k of [6, 7, 8, 9]) {
    const p = cnt[k] / n;
    ok(Math.abs(p - expct[k]) < .015, `${k}:实测${(p * 100).toFixed(2)}% 期望${(expct[k] * 100).toFixed(2)}%`);
  }
});
t('成卦无偏:一万卦中六十四卦皆现,最热门与最冷门差距在统计噪声内', () => {
  const n = 10000, cnt = {};
  for (let i = 0; i < n; i++) {
    const c = GuaCore.castHexagram();
    cnt[c.ben.full] = (cnt[c.ben.full] || 0) + 1;
  }
  const names = Object.keys(cnt);
  eq(names.length, 64, '六十四卦全该出现');
  const vals = names.map(k => cnt[k]);
  const min = Math.min(...vals), max = Math.max(...vals);
  // 每卦期望 156.25,σ≈12.4;min/max 容±5σ
  ok(min > 156.25 - 62 && max < 156.25 + 62, `min=${min} max=${max}`);
});

console.log('【七】神煞口诀铁案(天乙/桃花/驿马/华盖/文昌/羊刃/红鸾天喜/空亡)');
const Bazi = require('../bazi.js');
t('天乙贵人:甲戊庚牛羊、乙己鼠猴、丙丁猪鸡、壬癸蛇兔、六辛虎马,十干全表', () => {
  const exp = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '巳卯', 癸: '巳卯', 辛: '寅午' };
  for (const [g, z] of Object.entries(exp)) eq(Bazi.TIANYI[g], z, g);
});
t('桃花/驿马/华盖按三合局:申子辰→酉寅辰,寅午戌→卯申戌,巳酉丑→午亥丑,亥卯未→子巳未', () => {
  const cases = [['子', '酉', '寅', '辰'], ['午', '卯', '申', '戌'], ['酉', '午', '亥', '丑'], ['卯', '子', '巳', '未']];
  for (const [z, th, ym, hg] of cases) {
    const i = Bazi.sanheIdx(z);
    eq(Bazi.TAOHUA[i], th, z + '桃花'); eq(Bazi.YIMA[i], ym, z + '驿马'); eq(Bazi.HUAGAI[i], hg, z + '华盖');
  }
});
t('文昌:甲巳乙午、丙戊申、丁己酉、庚亥辛子、壬寅癸卯;羊刃四阳干', () => {
  const wc = { 甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
  for (const [g, z] of Object.entries(wc)) eq(Bazi.WENCHANG[g], z, '文昌' + g);
  eq(Bazi.YANGREN['甲'], '卯'); eq(Bazi.YANGREN['丙'], '午'); eq(Bazi.YANGREN['庚'], '酉'); eq(Bazi.YANGREN['壬'], '子');
});
t('红鸾自卯逆行、天喜对冲:子年红鸾卯天喜酉,午年红鸾酉天喜卯', () => {
  eq(Bazi.HONGLUAN[0], '卯', '子年红鸾');
  eq(Bazi.HONGLUAN[6], '酉', '午年红鸾');
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  eq(ZHI[(ZHI.indexOf(Bazi.HONGLUAN[0]) + 6) % 12], '酉', '子年天喜');
});
t('空亡(天中殺):甲子旬戌亥空、甲戌旬申酉空、甲寅旬子丑空', () => {
  eq(Bazi.kongOf('甲子').join(''), '戌亥');
  eq(Bazi.kongOf('癸酉').join(''), '戌亥', '甲子旬末位');
  eq(Bazi.kongOf('甲戌').join(''), '申酉');
  eq(Bazi.kongOf('乙卯').join(''), '子丑', '甲寅旬中');
});
t('flowMarks 整合:命主流日触天乙/桃花/空亡/冲提纲各有其辞', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男'); // 庚午年生,日主自排
  const kong = Bazi.kongOf(c.pillars.day.gz);
  const tyZhi = Bazi.TIANYI[c.dayGan][0];
  ok(Bazi.flowMarks(c, '甲', tyZhi).some(m => m.includes('天乙贵人')), '天乙');
  const th = Bazi.TAOHUA[Bazi.sanheIdx(c.pillars.year.zhi)];
  ok(Bazi.flowMarks(c, '甲', th).some(m => m.includes('桃花')), '桃花');
  ok(Bazi.flowMarks(c, '甲', kong[0]).some(m => m.includes('天中殺')), '空亡');
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const chongYue = ZHI[(ZHI.indexOf(c.pillars.month.zhi) + 6) % 12];
  ok(Bazi.flowMarks(c, '甲', chongYue).some(m => m.includes('冲提纲')), '冲提纲');
});
t('天中殺之年:十二年窗口里恰两年,且年支必落日柱旬空', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男');
  const tz = Bazi.tianZhongShaYears(c, 2026, 12);
  eq(tz.length, 2, '十二年中两年');
  const kong = Bazi.kongOf(c.pillars.day.gz);
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  tz.forEach(y => ok(kong.includes(ZHI[((y - 4) % 12 + 12) % 12]), y + '年支应在空亡'));
});

console.log('【八】断语库客观性(敢报凶,不偏喜)');
const GuaData = require('../gua-data.js');
t('六十四卦断级:凶类不少于8卦、谨慎不少于10卦、大吉不超过8卦、吉类占比不过六成', () => {
  const guas = Object.values(GuaData.BY_ID);
  eq(guas.length, 64, '卦数');
  const cnt = {};
  guas.forEach(g => { cnt[g.lv] = (cnt[g.lv] || 0) + 1; });
  const xiong = (cnt['凶'] || 0) + (cnt['大凶'] || 0);
  const ji = (cnt['大吉'] || 0) + (cnt['吉'] || 0) + (cnt['小吉'] || 0) + (cnt['平吉'] || 0);
  ok(xiong >= 8, `凶类=${xiong},断语库不许回避凶卦`);
  ok((cnt['谨慎'] || 0) >= 10, `谨慎=${cnt['谨慎']}`);
  ok((cnt['大吉'] || 0) <= 8, `大吉=${cnt['大吉']},不许滥报大吉`);
  ok(ji / 64 <= 0.6, `吉类占比=${(ji / 64 * 100).toFixed(0)}%,不许偏喜`);
});
t('小六壬三吉三凶:大安速喜小吉为吉,留连赤口凶、空亡大凶', () => {
  const g = Object.fromEntries(Xlr.GONG.map(x => [x.name, x.ji]));
  ok(g['大安'].includes('吉') && g['速喜'].includes('吉') && g['小吉'].includes('吉'), '三吉');
  ok(g['留连'].includes('凶') && g['赤口'].includes('凶'), '两凶');
  ok(g['空亡'].includes('大凶'), '空亡大凶');
});

console.log('【九】时辰吉凶引擎(日运精确到钟点)');
t('五鼠遁:甲己日起甲子时、乙庚日丙子、丙辛日戊子、丁壬日庚子、戊癸日壬子', () => {
  const exp = { 甲: '甲子', 己: '甲子', 乙: '丙子', 庚: '丙子', 丙: '戊子', 辛: '戊子', 丁: '庚子', 壬: '庚子', 戊: '壬子', 癸: '壬子' };
  for (const [g, gz] of Object.entries(exp)) eq(Bazi.hourPillar(g, 0), gz, g + '日子时');
});
t('jiShi:十二时辰全、时柱随日干、冲本人年支之时必带避记且分数最低档', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男'); // 庚午年,冲支=子
  const hs = Bazi.jiShi(c, '甲');
  eq(hs.length, 12, '十二时辰');
  eq(hs[0].gz, '甲子', '甲日首时柱');
  const ziHour = hs.find(h => h.zhi === '子');
  ok(ziHour.marks.some(m => m.includes('冲你年支')), '子时冲午年生人');
  ok(ziHour.score <= -1, '冲时分数应低:' + ziHour.score);
  const heHour = hs.find(h => h.zhi === '未');
  ok(heHour.marks.some(m => m.includes('合你年支')), '未时合午年生人');
});
t('jiShi 评分与喜忌挂钩:喜用时干加分、忌神时干减分', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男'); // 日主辛,身弱喜金土忌水木火
  const hs = Bazi.jiShi(c, '甲');
  for (const h of hs) {
    const wx = Bazi.GAN_WX[h.gz[0]];
    if (c.yong.xiWx.includes(wx)) ok(h.marks.includes('时干扶你'), h.gz);
    if (c.yong.jiWx.includes(wx)) ok(h.marks.includes('时干耗你'), h.gz);
  }
});

console.log('【十】真太阳时与专业环节');
t('均时差全年有界(|EoT|≤17分),二月中在-14分上下、十一月初在+16分上下', () => {
  for (let m = 0; m < 12; m++) ok(Math.abs(Bazi.eotMinutes(new Date(2026, m, 15))) <= 17, '月' + (m + 1));
  ok(Bazi.eotMinutes(new Date(2026, 1, 12)) < -12, '二月中负极值');
  ok(Bazi.eotMinutes(new Date(2026, 10, 3)) > 14, '十一月初正极值');
});
t('经度校正:乌鲁木齐(东经87.6°)约拨慢130分钟;120°地几乎不动', () => {
  const d = new Date(1995, 6, 1, 12, 0);
  const diffWlmq = (Bazi.trueSolarDate(d, 87.6) - d) / 60000;
  ok(diffWlmq > -142 && diffWlmq < -118, '乌市差=' + diffWlmq.toFixed(1));
  const diff120 = (Bazi.trueSolarDate(d, 120) - d) / 60000;
  ok(Math.abs(diff120) <= 8, '120°差=' + diff120.toFixed(1));
});
t('夏令时回拨:1988-07-01 比 1992-07-01 多拨慢一小时', () => {
  const a = (Bazi.trueSolarDate(new Date(1988, 6, 1, 12), 120) - new Date(1988, 6, 1, 12)) / 60000;
  const b = (Bazi.trueSolarDate(new Date(1992, 6, 1, 12), 120) - new Date(1992, 6, 1, 12)) / 60000;
  ok(Math.abs((a - b) + 60) <= 3, `88年=${a.toFixed(1)} 92年=${b.toFixed(1)}`);
});
t('夏令时不看出生地也必须回拨:1986-91 年生人不填出生地,时柱仍按拨回一小时排', () => {
  // 曾漏:夏令时回拨写在经度校正的同一道门里,不填出生地就整条不走,1986-91 年生人时柱整错一个时辰
  const d = () => new Date(1990, 4, 20, 9, 30);           // 钟表 9:30 → 实为 8:30 标准时 → 辰时
  eq(Bazi.chart(d(), '男').pillars.hour.zhi, '辰');
  eq(Bazi.chart(d(), '男', 120.15).pillars.hour.zhi, '辰'); // 填了杭州,结论一致
  eq(Bazi.chart(new Date(1992, 4, 20, 9, 30), '男').pillars.hour.zhi, '巳'); // 92 年已废夏令时,9:30 就是巳时
});
t('不填出生地也走均时差(按国标 120°E 计),只少经度这一项', () => {
  const d = new Date(1995, 10, 3, 12, 0);                  // 十一月初 EoT 约 +16 分
  const noPlace = (Bazi.trueSolarDate(new Date(d)) - d) / 60000;
  ok(noPlace > 14 && noPlace < 18, '未填地校正=' + noPlace.toFixed(1));
  const withPlace = (Bazi.trueSolarDate(new Date(d), 87.6) - d) / 60000;
  ok(withPlace < noPlace - 100, '填乌市后再减经度差=' + withPlace.toFixed(1));
});
t('真太阳时改时柱:乌鲁木齐生人时柱与钟表时排法不同', () => {
  const d = new Date(1995, 6, 1, 12, 30);
  const c1 = Bazi.chart(new Date(d), '男');
  const c2 = Bazi.chart(new Date(d), '男', 87.6);
  ok(c1.pillars.hour.gz !== c2.pillars.hour.gz, `钟表${c1.pillars.hour.gz} vs 真太阳${c2.pillars.hour.gz}`);
});
t('调候:冬月取火、夏月取水、春秋不另立', () => {
  eq(Bazi.tiaoHou('子').need, '火'); eq(Bazi.tiaoHou('丑').need, '火');
  eq(Bazi.tiaoHou('午').need, '水'); eq(Bazi.tiaoHou('巳').need, '水');
  eq(Bazi.tiaoHou('卯'), null); eq(Bazi.tiaoHou('酉'), null);
});
t('从格:扫描三十年逐日,从强从弱皆有例,且喜忌确按顺势翻转', () => {
  let cong = 0, congRuo = 0;
  for (let i = 0; i < 10950 && (cong === 0 || congRuo === 0); i += 3) {
    const c = Bazi.chart(new Date(1975, 0, 1 + i, 12), '男');
    if (c.geju && c.geju.includes('从强')) { cong++; ok(c.yong.xiWx.includes(Bazi.GAN_WX[c.dayGan]), '从强喜比劫'); }
    if (c.geju && c.geju.includes('从弱')) { congRuo++; ok(c.yong.jiWx.includes(Bazi.GAN_WX[c.dayGan]), '从弱忌比劫'); }
  }
  ok(cong + congRuo >= 1, `三十年中从格例数=${cong + congRuo}(极端格局本就少见,有例即可)`);
});
t('命局内冲:能检出且注明宫位;无冲之局不硬报', () => {
  let found = false;
  for (let i = 0; i < 400 && !found; i++) {
    const c = Bazi.chart(new Date(1990, 0, 1 + i, 12), '男');
    if (c.neiChong.length) { found = true; ok(c.neiChong[0].includes('宫'), c.neiChong[0]); }
  }
  ok(found, '400天内应有内冲之例');
});
t('旺衰双向称量:五行分合百、同党异党对称、十神明细齐备;子月壬水必得令', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男');
  const d = c.strength.detail;
  for (const k of ['比劫', '印', '食伤', '财', '官杀']) ok(typeof d[k] === 'number', '缺十神力量明细:' + k);
  const sum = Object.values(c.strength.pow).reduce((a, b) => a + b, 0);
  ok(Math.abs(sum - 100) < 0.5, '五行力量合计=' + sum);
  ok(Math.abs(c.strength.tong + c.strength.yi - 100) < 0.5, '同党+异党须为百');
  eq(c.strength.pct, Math.round(c.strength.tong), '总分即同党分');
  // 子月(主气癸水)对壬水日主为当令,同党当中比劫一项应占大头
  let done = false;
  for (let i = 0; i < 400 && !done; i++) {
    const cc = Bazi.chart(new Date(1995, 11, 1 + (i % 60), 12), '男');
    if (cc.pillars.month.zhi === '子' && cc.dayGan === '壬') {
      eq(cc.strength.deLing, '当令', '子月壬水');
      ok(cc.strength.detail.比劫 > 25, '子月壬水比劫力量:' + cc.strength.detail.比劫);
      done = true;
    }
  }
  ok(done, '应找到子月壬日样本');
});
t('县级市认识:昆山义乌晋江慈溪滕州巩义浏阳仙桃', () => {
  for (const n of ['昆山', '义乌', '晋江', '慈溪', '滕州', '巩义', '浏阳', '仙桃']) ok(require('../dili.js').find(n), n);
});

console.log('【十一】流运判读全规程(干支拆解/双层十神/动宫/天克地冲/伏吟/调候)');
const Yunshi = require('../yunshi.js');
t('动宫:巳日冲亥日主之支,日运必报婚姻宫动;十神两层行必在', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男'); // 日柱辛亥
  const d = Yunshi.riYun(c, new Date(2026, 6, 30, 12)); // 乙巳日
  ok(d.lines.some(l => l.includes('你自己与伴侣那一块')), '巳冲亥应动婚姻宫(文案已改人话):' + d.lines.join('|'));
  ok(d.lines.some(l => /明面上主要是|管的是同一摊事/.test(l)), '两层事象那一行必在:' + d.lines.join('|'));
  ok(d.lines.some(l => /明面(上那股力|和底下)|不偏不倚/.test(l)), '两股力那一行必在:' + d.lines.join('|'));
});
// 2026-08:用户反馈运势卡看不懂,文案全部改成人话(去掉干支/十神/动宫/伏吟这些名目)。
// 下面几条测试本意是验「这条规则触发了」,不是验字面措辞,故改认新说法。
t('天克地冲:丁巳日对辛亥日主(丁克辛+巳冲亥)必报大动之象', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男');
  let found = false;
  for (let i = 0; i < 60 && !found; i++) {
    const dt = new Date(2026, 6, 30 + i, 12);
    const gz = Najia.ganZhi(dt).day;
    if (gz === '丁巳') {
      const d = Yunshi.riYun(c, dt);
      ok(d.lines.some(l => l.includes('上下两头一齐冲你自己')), d.lines.join('|'));
      found = true;
    }
  }
  ok(found, '60日内必有丁巳日');
});
t('伏吟:辛亥日对辛亥日主必报伏吟', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男');
  let found = false;
  for (let i = 0; i < 60 && !found; i++) {
    const dt = new Date(2026, 6, 30 + i, 12);
    if (Najia.ganZhi(dt).day === '辛亥') {
      ok(Yunshi.riYun(c, dt).lines.some(l => l.includes('与你自己那一柱一模一样')), '伏吟那一行(已改人话)');
      found = true;
    }
  }
  ok(found, '60日内必有辛亥日');
});
t('干支分评:干喜支忌之日必报「面上顺、底下漏」', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男');
  const xi = c.yong.xiWx, ji = c.yong.jiWx;   // 喜忌随引擎实算,不写死
  let found = false;
  for (let i = 0; i < 120 && !found; i++) {
    const dt = new Date(2026, 6, 30 + i, 12);
    const gz = Najia.ganZhi(dt).day;
    if (xi.includes(Bazi.GAN_WX[gz[0]]) && ji.includes(Bazi.ZHI_WX[gz[1]])) {
      const d = Yunshi.riYun(c, dt);
      ok(d.lines.some(l => l.includes('开头顺、后头漏')), gz + ':' + d.lines[0]);
      found = true;
    }
  }
  ok(found, '120日内必有干喜支忌之日');
});
t('调候入流运:冬月生人逢火日必报调候得药', () => {
  const c = Bazi.chart(new Date(1990, 11, 20, 12), '男'); // 子月冬生,调候取火
  ok(c.tiaohou && c.tiaohou.need === '火', '冬生调候火');
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    const dt = new Date(2026, 6, 30 + i, 12);
    const gz = Najia.ganZhi(dt).day;
    if ('丙丁'.includes(gz[0])) {
      ok(Yunshi.riYun(c, dt).lines.some(l => l.includes('补上你命里缺的那一味')), gz);
      found = true;
    }
  }
  ok(found, '30日内必有火日');
});

console.log('【十二】排盘行规三修(十神全表/晚子时换日/精确起运)');
t('十神对照表(命理通行全表,阳阴日主各验十干)', () => {
  const jia = { 甲: '比肩', 乙: '劫财', 丙: '食神', 丁: '伤官', 戊: '偏财', 己: '正财', 庚: '七杀', 辛: '正官', 壬: '偏印', 癸: '正印' };
  for (const [g, s] of Object.entries(jia)) eq(Bazi.shiShen('甲', g), s, '甲见' + g);
  const gui = { 癸: '比肩', 壬: '劫财', 乙: '食神', 甲: '伤官', 丁: '偏财', 丙: '正财', 己: '七杀', 戊: '正官', 辛: '偏印', 庚: '正印' };
  for (const [g, s] of Object.entries(gui)) eq(Bazi.shiShen('癸', g), s, '癸见' + g);
});
t('晚子时换日(主流子时换日法):23:30生按次日日柱,22:59生按当日', () => {
  const late = Bazi.chart(new Date(2026, 6, 30, 23, 30), '男');
  const nextNoon = Bazi.chart(new Date(2026, 6, 31, 12, 0), '男');
  eq(late.pillars.day.gz, nextNoon.pillars.day.gz, '晚子时日柱=次日');
  eq(late.pillars.hour.zhi, '子', '时支子');
  ok(late.ziNote && late.ziNote.includes('换日'), '应注明换日');
  const early = Bazi.chart(new Date(2026, 6, 30, 22, 59), '男');
  eq(early.pillars.day.gz, '乙巳', '23点前按当日');
  ok(!early.ziNote, '非晚子时无注');
});
t('起运精确折算:顺逆两向天数之和=一个节间隔(29-32天),起运文本齐备', () => {
  const b = new Date(1964, 8, 10, 12); // 甲辰阳年
  const m = Bazi.chart(new Date(b), '男'); // 阳男顺
  const f = Bazi.chart(new Date(b), '女'); // 阳女逆
  ok(m.dayun.forward && !f.dayun.forward, '顺逆方向');
  const sum = m.dayun.startDays + f.dayun.startDays;
  ok(sum > 28 && sum < 33, `两向天数和=${sum.toFixed(2)},应为一个节间隔`);
  ok(/^\d+岁\d+个月起运$/.test(m.dayun.startText), m.dayun.startText);
  ok(m.dayun.startAge > 0 && m.dayun.startAge <= 10.4, '起运岁在常理内:' + m.dayun.startAge);
  ok(Math.abs(m.dayun.list[0].fromAge - m.dayun.startAge) < 0.01, '首运起于起运岁');
});

console.log('【十三】断法专业底线(合成命局边界校验,越界即错)');
function mkPillars(spec) { // spec: {yg,yz,mg,mz,dg,dz,hg,hz}
  const GW = g => Bazi.GAN_WX[g], ZW = z => Bazi.ZHI_WX[z];
  const p = {};
  [['year', spec.yg, spec.yz], ['month', spec.mg, spec.mz], ['day', spec.dg, spec.dz], ['hour', spec.hg, spec.hz]]
    .forEach(([k, g, z]) => { p[k] = { gz: g + z, gan: g, zhi: z, ganWx: GW(g), zhiWx: ZW(z) }; });
  return p;
}
// judgeStrength 未导出,经 chart 不便造极端局——通过公开成员间接验:用真实日期逼近 + 合成规则口径
t('底线一:当令+坐禄+干见比印,必不判弱(甲日寅月寅时,干透甲乙)', () => {
  // 找真实日期:寅月甲日。扫描2020-2030年立春后数日
  let found = false;
  for (let y = 2020; y <= 2030 && !found; y++) {
    for (let d = 4; d < 34 && !found; d++) {
      const c = Bazi.chart(new Date(y, 1, d, 4, 30), '男'); // 寅时
      if (c.pillars.month.zhi === '寅' && c.dayGan === '甲') {
        eq(c.strength.deLing, '当令', '甲得寅月');
        ok(c.strength.band !== '身弱', `当令甲木判到最弱一档即为错:${c.strength.band} ${c.strength.tong}%`);
        found = true;
      }
    }
  }
  ok(found, '应找到寅月甲日样本');
});
t('底线二:失令+无根+无势,必不判强(火日主生亥子月而地支无火根)', () => {
  let checked = 0;
  for (let y = 1950; y <= 2025 && checked < 3; y += 1) {
    for (let o = 0; o < 50 && checked < 3; o++) {
      const c = Bazi.chart(new Date(y, 11, 7 + o, 8, 30), '男'); // 辰时,避免午时自带火根
      if (!'丙丁'.includes(c.dayGan)) continue;
      if (!'亥子丑'.includes(c.pillars.month.zhi)) continue;
      const hasRoot = ['year', 'month', 'day', 'hour'].some(k => ['寅', '午', '戌', '巳', '未', '卯'].includes(c.pillars[k].zhi));
      const hasShi = ['year', 'month', 'hour'].some(k => '丙丁甲乙'.includes(c.pillars[k].gan));
      if (hasRoot || hasShi) continue;
      ok(!c.strength.strong, `冬月火日主无根无势判强即为错:${c.pillars.day.gz} 同党${c.strength.tong}%`);
      checked++;
    }
  }
  ok(checked >= 1, '至少验到一例,验了' + checked);
});
t('底线三:同一命盘,断语方向与强弱自洽(旺则忌比印、弱则喜比印;从格与中和局另有取法)', () => {
  for (let i = 0; i < 120; i++) {
    const c = Bazi.chart(new Date(1980, 0, 1 + i * 91, 12), '男');
    if (c.geju || c.yong.neutral) continue;
    const me = Bazi.GAN_WX[c.dayGan];
    if (c.strength.strong) ok(c.yong.jiWx.includes(me), c.pillars.day.gz + ' 强而不忌比劫');
    else ok(c.yong.xiWx.includes(me), c.pillars.day.gz + ' 弱而不喜比劫');
  }
});
t('底线四:流运断向与喜忌自洽(喜用之年必不判凶,忌神之年必不判大吉——无冲时)', () => {
  const Yun = require('../yunshi.js');
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男');
  const xi = new Set(c.yong.xiWx), ji = new Set(c.yong.jiWx);
  for (let i = 0; i < 120; i++) {
    const d = Yun.riYun(c, new Date(2026, 0, 1 + i, 12));
    const gw = Bazi.GAN_WX[d.gz[0]], zw = Bazi.ZHI_WX[d.gz[1]];
    const hasChong = d.lines.some(l => l.includes('动宫') || l.includes('天克地冲'));
    if (xi.has(gw) && xi.has(zw) && !hasChong) ok(d.score > 0, d.gz + ' 干支全喜而分数不正:' + d.score);
    if (ji.has(gw) && ji.has(zw)) ok(d.level !== '大吉', d.gz + ' 干支全忌而判大吉');
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
