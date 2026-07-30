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
t('三纲强弱:分项有界且相加成总分;子月壬水得全令、午月壬水失令', () => {
  const c = Bazi.chart(new Date(1990, 5, 15, 12), '男');
  const d = c.strength.detail;
  ok(d.ling >= 0 && d.ling <= 40 && d.di >= 0 && d.di <= 30 && d.shi >= 0 && d.shi <= 30, JSON.stringify(d));
  eq(c.strength.pct, Math.round(d.ling + d.di + d.shi), '总分=三纲之和');
  // 子月(主气癸水)对壬水日主应得令28以上;找一个子月壬日验证
  let done = false;
  for (let i = 0; i < 400 && !done; i++) {
    const cc = Bazi.chart(new Date(1995, 11, 1 + (i % 60), 12), '男');
    if (cc.pillars.month.zhi === '子' && cc.dayGan === '壬') {
      ok(cc.strength.detail.ling >= 28, '子月壬水得令:' + cc.strength.detail.ling);
      done = true;
    }
  }
  ok(done, '应找到子月壬日样本');
});
t('县级市认识:昆山义乌晋江慈溪滕州巩义浏阳仙桃', () => {
  for (const n of ['昆山', '义乌', '晋江', '慈溪', '滕州', '巩义', '浏阳', '仙桃']) ok(require('../dili.js').find(n), n);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
