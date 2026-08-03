// 排盘补全 + 旺衰双向称量 专项内测
// 缘起:旧法只累加「生扶分」,把 100−生扶 当克泄,克泄一方从未真正称过,
// 于是「丙火时支坐禄」这种明明有根的盘掉进从格,喜忌整个翻转 180°。
// 本套件把新法的每一条铁律都钉死:有根不从、月令最重、单调不倒挂、阴阳同五行同分。
import { readFileSync } from 'node:fs';
import Bazi from '../bazi.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

// 造盘:直接给四柱干支,绕开日期(专测断法,不测历法)
function make(y, m, d, h, days = 15) {
  const P = { year: y, month: m, day: d, hour: h };
  const pillars = {};
  for (const k of Object.keys(P)) pillars[k] = { gz: P[k], gan: P[k][0], zhi: P[k][1] };
  return Bazi.judgeStrength(pillars, d[0], days);
}
// 直接按四柱造一副完整判读(专测断法,不劳历法;历法另有 backtest 套件把关)
// v1.07 起走真路:从格改判收进了 pickYongShen(§四 取用只此一份),这里原先手搓的
// 「从强→[me]/从弱→[KE[me]]」迷你改判是它进不去 pickYongShen 年代的遗物,已删——
// 测试造的盘与 chart() 排的盘,取用必须是同一段代码。
function mkChart(four, days = 15) {
  const gz = four.match(/.{2}/g);
  const pillars = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { pillars[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  const dayGan = pillars.day.gan;
  const strength = Bazi.judgeStrength(pillars, dayGan, days);
  const cong = Bazi.judgeCong(strength, pillars, dayGan);
  const th = Bazi.tiaoHou(pillars.month.zhi, dayGan);
  const yong = Bazi.pickYongShen(dayGan, strength, th, cong);
  return { pillars, dayGan, dayWx: Bazi.GAN_WX[dayGan], strength, cong, geju: cong ? cong.name : null, yong };
}

console.log('【一】排盘补全项(纳音/长生/空亡/胎元/司令/刑冲合害)');
t('纳音六十甲子:抽查六组,且三十组名目不重不漏', () => {
  const c = Bazi.chart(new Date(1984, 5, 15, 10), '男');
  eq(Bazi.nayin('甲子'), '海中金'); eq(Bazi.nayin('庚午'), '路旁土');
  eq(Bazi.nayin('壬申'), '剑锋金'); eq(Bazi.nayin('戊戌'), '平地木');
  eq(Bazi.nayin('癸亥'), '大海水'); eq(Bazi.nayin('丙寅'), '炉中火');
  ok(c.pillars.day.nayin, '排盘须带纳音');
  const all = new Set();
  const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
  for (let i = 0; i < 60; i++) all.add(Bazi.nayin(GAN[i % 10] + ZHI[i % 12]));
  eq(all.size, 30, '六十甲子应得三十种纳音');
});
t('十二长生与禄刃自洽:临官即禄位、帝旺即刃位(阳顺阴逆)', () => {
  const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  for (const g of Object.keys(LU)) {
    eq(Bazi.changSheng(g, LU[g]), '临官', g + '禄在' + LU[g]);
    ok(['帝旺'].includes(Bazi.changSheng(g, nextZhi(LU[g], g))), g + '刃位应为帝旺');
  }
  function nextZhi(z, g) {
    const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const step = '甲丙戊庚壬'.includes(g) ? 1 : -1;
    return ZHI[(ZHI.indexOf(z) + step + 12) % 12];
  }
});
t('空亡按旬:甲子旬空戌亥、甲戌旬空申酉、甲寅旬空子丑', () => {
  eq(Bazi.kongOf('甲子').join(''), '戌亥');
  eq(Bazi.kongOf('甲戌').join(''), '申酉');
  eq(Bazi.kongOf('甲寅').join(''), '子丑');
  const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), '男');
  eq(c.kong.length, 2, '排盘须带空亡');
  for (const k of ['year', 'month', 'day', 'hour']) eq(c.pillars[k].kong, c.kong.includes(c.pillars[k].zhi), k + '柱空亡标记');
});
t('胎元:月干进一位、月支进三位', () => {
  eq(Bazi.taiYuan('丙寅'), '丁巳');
  eq(Bazi.taiYuan('癸亥'), '甲寅');
  eq(Bazi.taiYuan('辛巳'), '壬申');
});
t('人元司令:各月分野合三十日,寅月初戊中丙末甲', () => {
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  for (const z of ZHI) {
    const sum = Bazi.SILING[z].reduce((a, e) => a + e[1], 0);
    ok(Math.abs(sum - 30) < 0.05, z + '月分野合计=' + sum);
  }
  eq(Bazi.siLingOf('寅', 3).gan, '戊');
  eq(Bazi.siLingOf('寅', 10).gan, '丙');
  eq(Bazi.siLingOf('寅', 20).gan, '甲');
  eq(Bazi.siLingOf('子', 5).gan, '壬');   // 子月前十日,亥月余气壬水司令(分野表列之,藏干表不列,两表本不同)
  eq(Bazi.siLingOf('子', 25).gan, '癸');
});
t('刑冲合害会:六冲六合六害三刑自刑三合三会各出一例', () => {
  const R = f => Bazi.chart(f, '男').rel;
  const P = (y, m, d, h) => {
    const pil = {}; const src = { year: y, month: m, day: d, hour: h };
    for (const k of Object.keys(src)) pil[k] = { gz: src[k], gan: src[k][0], zhi: src[k][1] };
    return Bazi.relations(pil);
  };
  ok(P('甲子', '庚午', '丙寅', '戊戌').chong.some(x => x.includes('子午')), '子午冲');
  ok(P('甲子', '乙丑', '丙寅', '戊戌').he.some(x => x.includes('子丑')), '子丑六合');
  ok(P('甲子', '辛未', '丙寅', '戊戌').hai.some(x => x.includes('子未')), '子未相害');
  ok(P('丙寅', '癸巳', '庚申', '戊戌').xing.some(x => x.includes('三刑')), '寅巳申三刑');
  ok(P('甲辰', '戊辰', '丙寅', '庚午').xing.some(x => x.includes('自刑')), '辰辰自刑');
  ok(P('庚申', '丙子', '甲辰', '己巳').sanhe.some(x => x.full && x.wx === '水'), '申子辰三合水');
  ok(P('丙寅', '辛卯', '甲辰', '己巳').sanhui.some(x => x.wx === '木'), '寅卯辰三会木');
  ok(P('甲子', '己巳', '丙寅', '戊戌').ganhe.some(x => x.includes('甲己')), '甲己合土');
});
t('排盘每柱都带全:纳音/自坐/星运/藏干(含本中余气与十神)/空亡', () => {
  const c = Bazi.chart(new Date(1978, 2, 9, 14), '女', 116.4);
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = c.pillars[k];
    ok(p.nayin && p.zizuo && p.xingyun, k + '柱缺纳音/自坐/星运');
    ok(p.cang.length >= 1 && p.cang.every(x => x.gan && x.wx && x.shen && x.qi), k + '柱藏干不全');
    eq(p.cang[0].qi, '本气');
    ok(typeof p.kong === 'boolean');
  }
  ok(c.taiYuan && c.siLing && c.daysIntoJie >= 1, '缺胎元/司令/节入日数');
  ok(c.wuxingCount && Object.values(c.wuxingCount).reduce((a, b) => a + b, 0) === 8, '五行个数应合八字');
});

console.log('【二】旺衰双向称量:两边都要称,不许拿 100 减');
t('五行力量归一到百分,同党+异党=100', () => {
  for (let i = 0; i < 200; i++) {
    const c = Bazi.chart(new Date(1960 + (i % 60), i % 12, (i % 27) + 1, (i % 12) * 2 + 1), '男');
    const sum = Object.values(c.strength.pow).reduce((a, b) => a + b, 0);
    ok(Math.abs(sum - 100) < 0.5, '五行合计=' + sum);
    ok(Math.abs(c.strength.tong + c.strength.yi - 100) < 0.5, '同党+异党=' + (c.strength.tong + c.strength.yi));
  }
});
t('满局生扶必身旺、满局克泄必身弱(极端盘零争议)', () => {
  const s1 = make('癸卯', '乙卯', '甲寅', '乙亥');   // 木水一片
  ok(s1.tong > 85, '木水满局同党=' + s1.tong);
  eq(s1.band, '身旺');
  const s2 = make('戊戌', '丁巳', '甲午', '己巳');   // 支为戌巳午巳,通局无木无水,甲木无根无印
  ok(s2.tong < 25, '火土满局同党=' + s2.tong);
  ok(!s2.strong, '此局判强即为错');
});
t('单调不倒挂:换一字为印比,同党分只增不减;换为克泄,只减不增', () => {
  const base = ['庚申', '己卯', '甲子', '丙寅'];
  const b = make(...base).tong;
  const up = make('壬申', '己卯', '甲子', '丙寅').tong;    // 年干庚(杀)→壬(印)
  const down = make('庚申', '己卯', '甲子', '庚午').tong;  // 时柱丙寅(食+比根)→庚午(杀+泄)
  ok(up >= b - 0.01, `换印后反降:${b}→${up}`);
  ok(down <= b + 0.01, `换杀后反升:${b}→${down}`);
});
t('阴阳同五行同分:日主甲与乙、丙与丁,同党分一致', () => {
  const a = make('庚申', '己卯', '甲子', '丙寅').tong;
  const bq = make('庚申', '己卯', '乙子', '丙寅').tong;
  ok(Math.abs(a - bq) < 0.01, `甲${a} vs 乙${bq}`);
});
t('月令最重:同一个字放月支比放年支更抬旺衰', () => {
  const inMonth = make('庚申', '甲寅', '甲子', '庚午').tong;
  const inYear = make('甲寅', '庚申', '甲子', '庚午').tong;
  ok(inMonth > inYear, `寅在月${inMonth} 应高于 在年${inYear}`);
});
t('人元司令入权:同一盘节入不同日,月支当令者不同,旺衰随之微调', () => {
  const early = make('庚申', '丙寅', '甲子', '庚午', 3);   // 戊土司令
  const late = make('庚申', '丙寅', '甲子', '庚午', 25);   // 甲木司令
  ok(late.tong > early.tong, `甲当令(${late.tong}) 应高于 戊当令(${early.tong})`);
});
t('三会三合成势入账,并在明细里报出来', () => {
  const s = make('丁亥', '癸卯', '戊午', '己未');           // 亥卯未三合木局(克戊土)
  ok(s.bonus.some(x => x.includes('三合木')), '未报三合:' + JSON.stringify(s.bonus));
});
t('日主之根按本气/中气/余气分级,禄刃之根记为本气', () => {
  const s = make('庚申', '己卯', '丙子', '癸巳');           // 丙火时支巳=禄
  const r = s.roots.find(x => x.zhi === '巳');
  ok(r && r.level === '本气根' && r.cs === '临官', '丙坐巳应为本气根·临官:' + JSON.stringify(s.roots));
});

console.log('【三】从格铁门槛:有根不从');
// v1.01 改口径后这两条要跟着改——**改的是定义,不是把门槛拆了**:
// 「有根不从」这条铁律照旧,只是「什么算根」按《滴天髓阐微·从象章》的命例重定为**只认本气**。
// 原文自己两边都说过(衰旺章、地支章把库根当根,从象章的命例又当它不是),
// 判从格该以**讲从格的那一章**的命例为准——那一章 15 例实测 7/15 → 10/15。
// 代价照实记:v0.54 手挑的三副「误判样本」里,己丑丁丑甲子戊辰 与 壬辰壬子丁亥庚戌
// 在新定义下重新落回从弱(它们的根都在墓库里)。两边证据打架,取证据更对口的那一边。
t('扫描四千盘:凡判从弱格者,四支必无一丝日主之**本气**根', () => {
  const d0 = new Date(1950, 0, 1);
  let ruo = 0, bad = 0;
  for (let i = 0; i < 4000; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), i % 2 ? '男' : '女');
    if (c.cong && c.cong.type === '从弱') { ruo++; if (c.strength.congHasRoot) bad++; }
  }
  ok(ruo > 0, '样本里应当有从弱格');
  eq(bad, 0, '有本气根却判从弱的盘数');
});
t('从格是稀有格局:真从占比应在 6.5% 以内(四格合计;旧法曾高达 11%)', () => {
  const d0 = new Date(1950, 0, 1);
  let n = 0, cong = 0;
  for (let i = 0; i < 3000; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), '男'); n++;
    if (c.cong && c.cong.type !== '假从') cong++;
  }
  // v1.01:上界从 5% 放到 6.5%。**不是为了让测试变绿**——是分格数变了:
  // 这一版按《滴天髓阐微·从象章》原文补上了「从气格」(原文明载:「从气者,不论财官、印绶、
  // 食伤之类,如气势在木火,要行木火运」),真从由三格变四格,占比 3.72%→5.77%。
  // 这个上界本来就是本项目自拟的经验闸(不是行内标准),每加一格都要重新量、重新写明。
  // 闸门仍在:超过 6.5% 就是放水,当场红。
  ok(cong / n < 0.065, '从格占比=' + (cong / n * 100).toFixed(2) + '%(四格合计,上界 6.5% 是自拟经验闸)');
});
t('v0.54 那三副实盘:根照旧认得出;从不从按新定义分成两类,照实钉', () => {
  // v0.54 立这条时用的是旧定义(任何藏干都算根),三副盘一律要求「不从」。
  // v1.01 按从象章命例把「根」重定为只认本气之后,其中两副的根都在墓库里(辰中乙、戌中丁),
  // 于是重新落回从弱。**这不是把测试改绿,是定义变了**——两边证据打架时取更对口的那一边,
  // 代价写在明处:①根照旧要认得出(rootsOf 一分不动,专业区照旧摆得出来);
  // ②本气根还在的那一副(丙坐巳=禄)必须照旧不从——这一条守住了,说明门槛没被拆掉。
  const CASES = [
    ['己丑丁丑甲子戊辰', '辰', false],   // 甲木之根在辰(中气乙木,墓库)→ 新定义下不算根
    ['辛卯己亥丙子癸巳', '巳', true],    // 丙火坐巳=本气根·临官 → 照旧不从
    ['壬辰壬子丁亥庚戌', '戌', false],   // 丁火之根在戌(中气,火墓)→ 新定义下不算根
  ];
  for (const [four, wantRoot, mustNotCong] of CASES) {
    const c = mkChart(four);
    ok(c.strength.roots.some(r => r.zhi === wantRoot), four + ' 应认出' + wantRoot + '中之根(根的清单一分没动)');
    if (mustNotCong) {
      ok(!c.cong || c.cong.type !== '从弱', four + ' 有本气根却判从弱——门槛被拆了');
      ok(c.yong.xiWx.includes(c.dayWx), four + ' 身弱当喜比劫');
    } else {
      ok(!c.strength.congHasRoot, four + ' 的根在墓库,新定义下不该算本气根');
    }
  }
});
// v1.07 按原文改写:这条测试原来钉的是「假从只作标注,不翻喜忌」——那是 v0.54 起的旧口径。
// 命例回对(dtsy-220「用土以从之也,格成从杀」判成假从而喜忌不翻,书判永远对不上)把账翻了出来:
// 《滴天髓阐微·假从章》「假从者…只得投从于人也」「财之势旺,则从财;官之势旺,则从官」,
// 原注明说「虽是假从,亦可取富贵」——**原文的假从仍然是从**,v0.76 早记过两边含义相反这笔账。
// 旧口径与新口径的冲突照实写在这里,不偷偷抹掉:旧测试认为「宁可少断,不可反断」,
// 新口径认为「照原文断,注明从得不纯」。取新弃旧的裁决依据是命例(16 例 9→13)与假从章明文。
t('假从照原文按从论:喜忌翻向财官食伤,且 xiName 写明从得不纯(v1.07)', () => {
  const d0 = new Date(1950, 0, 1);
  let jia = 0;
  for (let i = 0; i < 3000; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), '男');
    if (c.cong && c.cong.type === '假从') {
      jia++;
      ok(!c.yong.xiWx.includes(c.dayWx), '假从按从论,比劫不该再在喜集里');
      ok(c.yong.jiWx.includes(c.dayWx), '假从按从论,比劫应在忌集里');
      ok(/假从/.test(c.yong.xiName) && /不纯/.test(c.yong.xiName), 'xiName 必须写明是假从、从得不纯');
    }
  }
  ok(jia > 0, '样本里应当有假从之例');
});

console.log('【四】名例对照(文献通行断法为客观答案)');
t('毛泽东 癸巳甲子丁酉甲辰:丁火子月失令、巳中丙火为根、双甲印透 → 身弱用木火,非从格', () => {
  const c = Bazi.chart(new Date(1893, 11, 26, 8, 0), '男', 112.9);
  eq(['year', 'month', 'day', 'hour'].map(k => c.pillars[k].gz).join(' '), '癸巳 甲子 丁酉 甲辰');
  ok(!c.geju, '此局有根有印,判从格即为错:' + c.geju);
  ok(['偏弱', '身弱'].includes(c.strength.band), '应断偏弱/身弱,实得' + c.strength.band);
  ok(c.yong.xiWx.includes('木') && c.yong.xiWx.includes('火'), '喜用应含木火:' + c.yong.xiWx);
  ok(c.strength.roots.some(r => r.zhi === '巳'), '须认出年支巳中丙火之根');
});
t('蒋介石 丁亥庚戌己巳庚午:己土戌月当令、巳午火印生身 → 身旺用金水木', () => {
  const c = Bazi.chart(new Date(1887, 9, 31, 12, 0), '男', 121.2);
  eq(['year', 'month', 'day', 'hour'].map(k => c.pillars[k].gz).join(' '), '丁亥 庚戌 己巳 庚午');
  ok(['身旺', '偏旺'].includes(c.strength.band), '应断身旺/偏旺,实得' + c.strength.band);
  ok(c.yong.xiWx.includes('金') || c.yong.xiWx.includes('水'), '身旺当喜泄耗:' + c.yong.xiWx);
  ok(!c.yong.xiWx.includes('土'), '身旺不该再喜比劫土');
});

console.log('【五】喜忌自洽与分布');
t('喜忌互不相交、且都是正经五行', () => {
  const WX = ['木', '火', '土', '金', '水'];
  for (let i = 0; i < 300; i++) {
    const c = Bazi.chart(new Date(1955 + (i % 65), i % 12, (i % 27) + 1, (i % 12) * 2 + 1), i % 2 ? '男' : '女');
    for (const w of c.yong.xiWx) ok(WX.includes(w), '喜神非五行:' + w);
    for (const w of c.yong.jiWx) ok(WX.includes(w), '忌神非五行:' + w);
    for (const w of c.yong.xiWx) ok(!c.yong.jiWx.includes(w), `${w} 既喜又忌(${c.pillars.day.gz})`);
  }
});
t('身旺者必忌比劫、身弱者必喜比劫(中和局除外,中和另走调候)', () => {
  for (let i = 0; i < 400; i++) {
    const c = Bazi.chart(new Date(1950 + (i % 70), i % 12, (i % 27) + 1, (i % 12) * 2 + 1), '男');
    if (c.geju || c.yong.neutral) continue;
    if (c.strength.band === '身旺' || c.strength.band === '偏旺') ok(c.yong.jiWx.includes(c.dayWx), c.pillars.day.gz + ' 旺而不忌比劫');
    if (c.strength.band === '身弱' || c.strength.band === '偏弱') ok(c.yong.xiWx.includes(c.dayWx), c.pillars.day.gz + ' 弱而不喜比劫');
  }
});
t('分布合理:五档皆有样本,身强率落在三到五成(古法「身弱者略多」)', () => {
  const d0 = new Date(1950, 0, 1);
  const bands = {}; let n = 0, strong = 0;
  for (let i = 0; i < 4000; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), i % 2 ? '男' : '女'); n++;
    bands[c.strength.band] = (bands[c.strength.band] || 0) + 1;
    if (c.strength.strong) strong++;
  }
  for (const b of ['身旺', '偏旺', '中和', '偏弱', '身弱']) ok(bands[b] > 0, b + '档一个样本都没有');
  const rate = strong / n;
  ok(rate > 0.30 && rate < 0.50, '身强率=' + (rate * 100).toFixed(1) + '%');
  ok(bands['中和'] / n > 0.10, '中和档应有相当比例,实得' + (bands['中和'] / n * 100).toFixed(1) + '%');
});
t('中和之局走调候/通关,不硬分强弱', () => {
  const d0 = new Date(1950, 0, 1);
  let found = 0;
  for (let i = 0; i < 2000 && found < 20; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), '男');
    if (c.strength.band === '中和' && !c.geju) {
      found++;
      ok(c.yong.neutral, '中和局应走中和取用:' + c.pillars.day.gz);
      ok(c.yong.xiWx.length >= 1 && c.yong.xiName.length > 4, '中和取用须说得出所以然');
    }
  }
  ok(found > 0, '未找到中和之局');
});

console.log('【性别】不填就不许排大运(v0.83 修的那个 100% 的洞)');
// 缘起:`Bazi.chart` 里两处把空性别 `|| '男'` 顶上,而 `gender === '男'` 对空值恒 false,
// 于是**空性别实际被当成女命排**,一声不吭。实测 368 副盘:性别一换,大运顺逆 100% 翻转。
// 这套断言两头都钉:①空性别必须停大运 ②喜忌不许跟着停(它本来就不看性别)。
t('性别一换,大运顺逆必翻——这是古法,先把它钉住', () => {
  let n = 0;
  for (let y = 1960; y <= 2005; y += 7) for (const m of [0, 5, 9]) {
    const dt = new Date(y, m, 15, 10, 30);
    const a = Bazi.chart(new Date(dt), '男', 116.4), b = Bazi.chart(new Date(dt), '女', 116.4);
    ok(a.dayun.forward !== b.dayun.forward, `${y}-${m + 1} 男女大运方向居然相同`);
    ok(a.dayun.list[0].gz !== b.dayun.list[0].gz, `${y}-${m + 1} 男女第一步大运居然相同`);
    n++;
  }
  ok(n >= 15, '样本太少');
});
t('性别没填:大运停摆,并说明为什么', () => {
  for (const g of ['', null, undefined, '未知', 'x']) {
    const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), g, 120.15);
    eq(c.genderKnown, false, `性别「${g}」不该被当成已知`);
    eq(c.gender, '', `性别「${g}」不该被顶成一个具体值`);
    ok(c.dayun.unknown === true, `性别「${g}」居然排出了大运`);
    eq(c.dayun.list.length, 0, `性别「${g}」的大运列表该是空的`);
    eq(c.dayun.forward, null, '方向该是 null,不许悄悄给一个');
    ok(/性别/.test(c.dayun.startText), '要说明为什么没有大运:' + c.dayun.startText);
  }
});
t('**喜忌不看性别**,所以它不许跟着停', () => {
  let n = 0;
  for (let y = 1955; y <= 2010; y += 5) for (const m of [1, 6, 10]) {
    const dt = new Date(y, m, 12, 14, 0);
    const nil = Bazi.chart(new Date(dt), '', 116.4);
    const man = Bazi.chart(new Date(dt), '男', 116.4);
    const woman = Bazi.chart(new Date(dt), '女', 116.4);
    eq(nil.yong.xiWx.join(), man.yong.xiWx.join(), `${y}-${m + 1} 不填性别的喜用与男命不一致`);
    eq(man.yong.xiWx.join(), woman.yong.xiWx.join(), `${y}-${m + 1} 男女喜用居然不同——喜忌本不看性别`);
    eq(nil.strength.band, man.strength.band, `${y}-${m + 1} 旺衰档不该随性别变`);
    ok(nil.pillars.day.gz === man.pillars.day.gz, '四柱不该随性别变');
    n++;
  }
  ok(n >= 30, '样本太少');
});
t('填了性别之后,大运照排,一步不少', () => {
  for (const g of ['男', '女']) {
    const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), g, 120.15);
    eq(c.genderKnown, true); eq(c.gender, g);
    ok(!c.dayun.unknown, '填了性别还说不知道');
    eq(c.dayun.list.length, 8, '大运应排八步');
    ok(typeof c.dayun.forward === 'boolean', '方向该是明确的');
  }
});
t('源码里不许再留「拿不到性别就当男」这种默认', () => {
  const src = readFileSync(new URL('../bazi.js', import.meta.url), 'utf8');
  ok(!/gender\s*\|\|\s*['\u2018\u201c]男/.test(src), "bazi.js 里还留着 gender || '男'");
});


console.log('【化气】天干五合化气(v0.96,先量后落;默认他干贴合开、日干化气格关)');
t('乙庚贴合于秋月无争合:月干乙按金计力(与关掉比,金升木降)', () => {
  const P = { year: { gz: '庚戌', gan: '庚', zhi: '戌' }, month: { gz: '乙酉', gan: '乙', zhi: '酉' },
    day: { gz: '丁丑', gan: '丁', zhi: '丑' }, hour: { gz: '丙午', gan: '丙', zhi: '午' } };
  const on = Bazi.wuxingPower(P, '丁', 15), off = Bazi.wuxingPower(P, '丁', 15, { hua: 'off' });
  ok(on.pow['金'] > off.pow['金'] && on.pow['木'] < off.pow['木'],
    `乙从庚化该金升木降:on金${on.pow['金']} off金${off.pow['金']} on木${on.pow['木']} off木${off.pow['木']}`);
});
t('争合不化:柱中另见乙来抢,力量分与关掉一字不差', () => {
  const P = { year: { gz: '庚戌', gan: '庚', zhi: '戌' }, month: { gz: '乙酉', gan: '乙', zhi: '酉' },
    day: { gz: '丁丑', gan: '丁', zhi: '丑' }, hour: { gz: '乙巳', gan: '乙', zhi: '巳' } };
  eq(JSON.stringify(Bazi.wuxingPower(P, '丁', 15).pow), JSON.stringify(Bazi.wuxingPower(P, '丁', 15, { hua: 'off' }).pow), '争合竟然化了');
});
t('化神不当令不化:乙庚贴合于寅月,与关掉一字不差', () => {
  const P = { year: { gz: '庚戌', gan: '庚', zhi: '戌' }, month: { gz: '乙寅', gan: '乙', zhi: '寅' },
    day: { gz: '丁丑', gan: '丁', zhi: '丑' }, hour: { gz: '丙午', gan: '丙', zhi: '午' } };
  eq(JSON.stringify(Bazi.wuxingPower(P, '丁', 15).pow), JSON.stringify(Bazi.wuxingPower(P, '丁', 15, { hua: 'off' }).pow), '不当令竟然化了');
});
t('日干化气格默认关:默认输出与 hua:other 逐字节同,与 hua:all 不同(防有人悄悄开)', () => {
  // 丁壬贴合于春月:day 模式会把日主换成木,默认不许
  const P = { year: { gz: '甲寅', gan: '甲', zhi: '寅' }, month: { gz: '壬卯', gan: '壬', zhi: '卯' },
    day: { gz: '丁亥', gan: '丁', zhi: '亥' }, hour: { gz: '庚子', gan: '庚', zhi: '子' } };
  const dft = Bazi.judgeStrength(P, '丁', 15), oth = Bazi.judgeStrength(P, '丁', 15, { hua: 'other' });
  eq(JSON.stringify(dft.pow), JSON.stringify(oth.pow), '默认该等于 other');
  const day = Bazi.judgeStrength(P, '丁', 15, { hua: 'all', huaChen: false });
  ok(JSON.stringify(dft.pow) !== JSON.stringify(day.pow), '这副盘 day 模式该有区别,说明开关是活的');
});
// v1.13 换口径:旺衰标签洗过一遍(第三次撞上「标签本身是噪声」这个病)——
// 53 例里 31 例是理论枚举/假设句/否定句/说的是上一造/「地旺天衰」那种分论两半的,
// 逐例人工复核后只剩 22 例。**数字跟着标签走,不是断法退步**:
// 旧的 41/53=77.4% 里有一半量的是噪声;洗净后 19/22=86.4%。
// 地板按洗净后的数钉,并钉住样本量——样本量一变就说明抽取器又动了,该来这里对账。
t('命例基线不许倒退:旺衰子集复现 ≥ 19/22(v1.13 洗净标签后的数)', () => {
  const DATA = JSON.parse(readFileSync(new URL('../data/mingli-cases.json', import.meta.url), 'utf8'));
  let n = 0, hit = 0;
  for (const c of DATA.cases) {
    if (!c.labels.band) continue;
    n++;
    const gz = c.four.split(' ');
    const P = {};
    ['year', 'month', 'day', 'hour'].forEach((k, i) => { P[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
    let days = 15;
    const sl = c.labels.siling;
    if (sl && sl.days) days = sl.days;
    else if (sl && sl.gan) { let acc = 0; for (const [g, d] of (Bazi.SILING[P.month.zhi] || [])) { if (g === sl.gan) { days = acc + Math.ceil(d / 2); break; } acc += d; } }
    const st = Bazi.judgeStrength(P, P.day.gan, days);
    if ((st.strong ? '旺' : '弱') === c.labels.band) hit++;
  }
  ok(n === 22, '旺衰子集该 22 例(v1.13 洗净后),实得 ' + n);
  ok(hit >= 19, `复现 ${hit}/22,倒退了(v1.13 基线 19)`);
});

console.log('【从格的根:v1.01 拿从象章命例定的口径】');
t('从格用的「根」只认地支本气——四变体量过,这一档在手抄命例上最准', () => {
  // 缘起:命例基线里「从格 38.2%」挂了三个版本纹丝不动,这一轮查出**那个数本身是错的**:
  // 抽标签的正则把否定句(「非前造从强论也」「不能弃命从杀」)、假设句(「倘…谓之从强」)、
  // 理论讨论(「旧有从强之说」)全当判语收了,34 例里 30 例是假标签。
  // 可信的尺是 v0.76 手抄的 15 例(从象章 10 + 假从章 5,逐字核回原文)。四变体实测:
  //   任何藏干算根 7/15 · 墓库余气不算 9/15 · **只本气 10/15** · 本气+禄刃长生 9/15
  // 真从率 2.33%→3.72%(仍是稀有格局),旺衰基线四变体全为 41/53(证明只动了从格口径)。
  const HAND = [['戊戌丙辰乙未丙戌', 1], ['壬寅壬寅庚寅戊寅', 1], ['丙寅庚寅壬午乙巳', 1],
    ['丁卯壬寅庚午丙戌', 1], ['辛巳辛丑乙酉乙酉', 1], ['癸卯乙卯甲寅乙亥', 1],
    ['丙午甲午丙午甲午', 1], ['丙戌壬辰癸巳甲寅', 1], ['癸酉乙丑丙申丙申', 1]];
  const mk = four => { const gz = four.match(/.{2}/g), p = {};
    ['year', 'month', 'day', 'hour'].forEach((k, i) => { p[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; }); return p; };
  let hit = 0;
  for (const [four] of HAND) {
    const p = mk(four);
    const st = Bazi.judgeStrength(p, p.day.gan, 15);
    const cong = Bazi.judgeCong(st, p, p.day.gan);
    if (cong && cong.type) hit++;
  }
  ok(hit >= 7, `从象章 9 例真从只认出 ${hit} 例——口径又收紧回去了`);
  console.log(`      (从象章 9 例认出 ${hit} 例)`);
});
t('真从仍是稀有格局:真从率不许超过 6.5%(防「为了对上命例而放水」)', () => {
  let real = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const d = new Date(1940 + (i * 7) % 86, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30);
    const c = Bazi.chart(d, i % 2 ? '男' : '女', { lon: 116.4 });
    n++; if (c.cong && c.cong.type && c.cong.type !== '假从') real++;
  }
  const rate = real / n;
  ok(rate > 0.01 && rate < 0.065, `真从率 ${(rate * 100).toFixed(2)}%——高于 6.5% 是放水,低于 1% 是又挡死了`);
  console.log(`      (3000 盘真从率 ${(rate * 100).toFixed(2)}%)`);
});
t('congRoot 口径可切换,且切换只动从格不动旺衰(改错地方当场红)', () => {
  const DATA = JSON.parse(readFileSync(new URL('../data/mingli-cases.json', import.meta.url), 'utf8'));
  const mk = four => { const gz = four.replace(/ /g, '').match(/.{2}/g), p = {};
    ['year', 'month', 'day', 'hour'].forEach((k, i) => { p[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; }); return p; };
  for (const mode of ['any', 'nolib', 'ben', 'lu']) {
    let n = 0, h = 0;
    for (const c of DATA.cases) {
      if (!c.labels.band) continue;
      const p = mk(c.four);
      const st = Bazi.judgeStrength(p, p.day.gan, 15, { congRoot: mode });
      n++; if ((st.strong ? '旺' : '弱') === c.labels.band) h++;
    }
    // v1.13:标签洗净后样本 53→22、基线 41→19(数字跟着尺子走,不是断法动了)
    ok(h === 19 && n === 22, `${mode} 口径下旺衰基线变成 ${h}/${n}——从格口径不该碰旺衰`);
  }
});

t('从气格按原文办:气势在相生两行且日主在其中;喜忌就是那两行,其余三行为忌', () => {
  // 《滴天髓阐微·从象章》:「从气者,不论财官、印绶、食伤之类,如气势在木火,要行木火运,
  // 气势在金水,要行金水运,反此必凶。」——**原文没要求无根**,手抄命例「癸酉癸亥庚申丁亥」
  // 庚金坐申(本气根)仍断从气金水,正是这个道理。
  const mk = four => { const gz = four.match(/.{2}/g), p = {};
    ['year', 'month', 'day', 'hour'].forEach((k, i) => { p[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; }); return p; };
  const p = mk('癸酉癸亥庚申丁亥');
  const st = Bazi.judgeStrength(p, p.day.gan, 15);
  const c = Bazi.judgeCong(st, p, p.day.gan);
  ok(c && c.type === '从气', '手抄那一例该判从气,实得 ' + (c ? c.type : '不从'));
  ok(c.qiWx.join('') === '金水', '气势该在金水,实得 ' + c.qiWx.join(''));
  ok(st.congHasRoot, '这一例是有本气根的——从气不要求无根,这一条正是它与从弱的分界');
  // 喜忌:那两行为喜,其余三行为忌
  const ch = Bazi.chart(new Date(1993, 10, 7, 20, 30), '男', { lon: 116.4 });
  let found = null;
  for (let i = 0; i < 3000 && !found; i++) {
    const cc = Bazi.chart(new Date(1940 + (i * 7) % 86, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30), i % 2 ? '男' : '女', { lon: 116.4 });
    if (cc.cong && cc.cong.type === '从气') found = cc;
  }
  ok(found, '3000 盘里一副从气都没有——门槛过严成了死条');
  ok(found.yong.xiWx.length === 2 && found.yong.xiWx.every(w => found.cong.qiWx.includes(w)), '从气的喜就该是那两行');
  ok(found.yong.jiWx.length === 3, '其余三行都该是忌');
  ok(found.yong.xiWx.includes(found.dayWx), '日主必在气势那一对里(不在就是从弱,不许混)');
});
t('从势细目按原文取:财官食伤中独旺者为所从;三者均停取财和解', () => {
  // 原文:「视其财官食伤之中,何其独旺,则从旺者之势。如三者均停,不分强弱,须行财运以和之」
  const mk = four => { const gz = four.match(/.{2}/g), p = {};
    ['year', 'month', 'day', 'hour'].forEach((k, i) => { p[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; }); return p; };
  const p = mk('辛巳辛丑乙酉乙酉');   // 原文判语:「支全金局,干透两辛,从杀斯真」
  const st = Bazi.judgeStrength(p, p.day.gan, 15);
  const c = Bazi.judgeCong(st, p, p.day.gan);
  ok(c && c.type === '从弱', '这一例该判从弱');
  ok(c.shi === '官杀', `原文说「从杀斯真」,程序该从官杀,实得 ${c.shi}`);
  ok(/独旺|均停/.test(c.shiName || ''), '从势细目要说清从的是哪一路:' + c.shiName);
  // 均停那一档也得触发得到(死条穷举)
  let jun = 0, du = 0;
  for (let i = 0; i < 3000; i++) {
    const cc = Bazi.chart(new Date(1940 + (i * 7) % 86, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30), i % 2 ? '男' : '女', { lon: 116.4 });
    if (cc.cong && cc.cong.type === '从弱') { if (cc.cong.junTing) jun++; else du++; }
  }
  ok(du > 0, '「独旺」那一档没触发过');
  ok(jun > 0, '「三者均停取财」那一档没触发过——是死条');
  console.log(`      (3000 盘从弱:独旺 ${du} 例、均停取财 ${jun} 例)`);
});

console.log('【十五】v1.07 用神口径四开关(命例回对定的,量表 tools/yong-measure.mjs)');
// 缘起:洗净标签后的 16 命例基线 9/16,四个病根各配一开关,量完一起落为默认(9→13)。
// 每个开关都拿**书上的命例**正反两头钉:该动的动了、不该动的一根汗毛没碰。
t('出口闸:本气食伤泄旺则不作从强/从气(「只换一申字…用金明矣」)', () => {
  // dtsy-032:四戊满局带一个申(本气庚金食神)——书不按从断,用金泄秀
  const c = mkChart('戊申戊午戊戌戊午');
  ok(!c.cong || !['从强', '从气'].includes(c.cong.type), '有本气食伤出口,不该判从强/从气,实得 ' + (c.cong && c.cong.type));
  ok(c.yong.xiWx.includes('金'), '书判「用金明矣」,金该在喜集:' + c.yong.xiWx);
  // 反面一:丙午×4——午中己土伤官只是**中气**,不算出口,原书的从旺样板必须守住
  const c2 = mkChart('丙午甲午丙午甲午');
  ok(c2.cong && c2.cong.type === '从强', '中气食伤不破从强,原书样板不许丢:' + (c2.cong && c2.cong.type));
  // 反面二:手抄从气例——食伤水在金水气势对**之内**,顺流不破局
  const c3 = mkChart('癸酉癸亥庚申丁亥');
  ok(c3.cong && c3.cong.type === '从气', '食伤在气势对之内不破从气:' + (c3.cong && c3.cong.type));
});
t('中和之局恒取调候(「春初木嫩…用火以攻之」,火 18.9 分也得进喜集)', () => {
  // dtsy-217:甲生立春后四日(司令按判语明写回填 days=4),中和局,调候火按旧门槛 <12 永远进不来
  const c = mkChart('丙寅庚寅甲申乙丑', 4);
  ok(c.strength.band === '中和', '这一例该是中和局,实得 ' + c.strength.band);
  ok(c.yong.xiWx.includes('火'), '中和恒取调候,火该在喜集:' + c.yong.xiWx);
  ok(c.yong.neutral, '中和路的标记不许丢');
});
t('制杀路:偏弱+官杀独重+身杀两停 → 食伤入喜(「不太过者宜克也」)', () => {
  // dtsy-434:戊生寅月木旺土虚,坐戌通根,书判「足以用金制杀」
  const c = mkChart('癸未甲寅戊戌庚申');
  ok(c.strength.band === '偏弱', '这一例该是偏弱,实得 ' + c.strength.band);
  ok(c.yong.xiWx.includes('金'), '书判「用金制杀」,金该在喜集:' + c.yong.xiWx);
  ok(/制杀/.test(c.yong.xiName), 'xiName 要写明制杀那一味是怎么来的');
  ok(c.yong.xiWx.includes('土') && c.yong.xiWx.includes('火'), '只补不换:印比照旧是喜');
  // 反面:身弱(不够两停)不给制杀——杀重身轻是凶,mingpan v1.00 早钉过
  let shenRuo = 0;
  for (let i = 0; i < 3000; i++) {
    const cc = Bazi.chart(new Date(1940 + (i * 7) % 86, (i * 5) % 12, 1 + (i * 11) % 28, (i * 3) % 24, 30), i % 2 ? '男' : '女', { lon: 116.4 });
    if (cc.strength.band === '身弱' && /制杀/.test(cc.yong.xiName || '')) shenRuo++;
  }
  eq(shenRuo, 0, '身弱盘不许走制杀路(太过者不宜克)');
});
t('jiName 按 jiWx 实际剩的算,喜忌两头不许同时挂名(v1.07 修的显示错)', () => {
  const NAME2WX = (me) => {
    const yin = Object.keys(Bazi.SHENG).find(k => Bazi.SHENG[k] === me);
    const guan = Object.keys(Bazi.KE).find(k => Bazi.KE[k] === me);
    return { '比劫': me, '印': yin, '食伤': Bazi.SHENG[me], '财': Bazi.KE[me], '官杀': guan };
  };
  for (let i = 0; i < 2000; i++) {
    const c = Bazi.chart(new Date(1945 + (i * 11) % 80, (i * 7) % 12, 1 + (i * 13) % 28, (i * 5) % 24, 30), i % 2 ? '男' : '女', { lon: 116.4 });
    if (c.cong || c.yong.neutral) continue;   // 从格与中和另有各自的名目
    const map = NAME2WX(c.dayWx);
    for (const nm of c.yong.jiName.split('·')) {
      const wx = map[nm];
      ok(wx && c.yong.jiWx.includes(wx), `jiName 提到「${nm}」但 ${wx} 不在 jiWx 里(${c.pillars.day.gz}:喜${c.yong.xiWx} 忌${c.yong.jiWx} 名「${c.yong.jiName}」)`);
      ok(!c.yong.xiWx.includes(wx), `「${nm}」喜忌两头挂名(${c.pillars.day.gz})`);
    }
  }
});
t('命例库用神标签保持洗净后的样子(8 个假标签不许回魂,两处修正不许倒退)', () => {
  const D = JSON.parse(readFileSync(new URL('../data/mingli-cases.json', import.meta.url), 'utf8'));
  const by = Object.fromEntries(D.cases.map(c => [c.id, c.labels.yong || null]));
  // 洗掉的 8 个:两案皆废式/俗论引述/明写不用/章首理论随窗带入(逐例缘由见 docs/命例复现-01-基线.md v1.07)
  for (const id of ['dtsy-048', 'dtsy-093', 'dtsy-294', 'dtsy-362', 'dtsy-403', 'dtsy-410', 'dtsy-449', 'dtsy-476']) {
    eq(by[id], null, id + ' 是查实的假标签,不许回魂');
  }
  eq(by['dtsy-259'], '火', '259 原文明写「以火为用,以木为喜」,不是金');
  eq(by['dtsy-209'], '水', '209「中得用水」是真判语(俗论只管它那一小节),不许误伤');
  const n = D.cases.filter(c => c.labels.yong).length;
  eq(n, 16, '洗净后的用神标签数');
});

// ══════════════════════════════════════════════════════════════════
//  经度校正:第三参两种形态必须等价(v1.17 揪出的真错)
// ══════════════════════════════════════════════════════════════════
// 缘起:做生辰矫正解读时顺手核了一遍时柱,发现**同一钟点在北京、成都、乌鲁木齐排出同一个时柱**
// ——而真太阳时差了两个多小时,§八 明明白白记着「成都 63 分、乌鲁木齐 129 分,
// 后两者十二个时辰整排前移一格」。病根:`chart(birth, gender, lonDeg)` 的第三参
// **数字是经度、对象是选项**,而 `trueSolarDate` 只认数字那一种,
// 于是凡是传对象的调用点,经度校正被一声不吭地丢掉。
// 实测 600 副盘:时柱差 34.7%、旺你的五行差 20.2%、旺衰档差 16.5%。
// 真正咬人的是 dingshi:粗筛传数字、精校分段传对象,**同一个板块的两层排在两套时间上**(§四)。
console.log('\n【经度校正】第三参两种形态必须等价(v1.17)');
t('传 {lon:x} 与传数字 x 必须排出同一副盘(此前对象那一路丢经度)', () => {
  for (const lon of [116.4, 121.5, 113.3, 104.1, 87.6, 126.6]) {
    for (let i = 0; i < 24; i++) {
      const d = new Date(1995, 5, 10, i, 30);
      const a = Bazi.chart(d, '男', { lon }), b = Bazi.chart(d, '男', lon);
      eq(a.pillars.hour.gz, b.pillars.hour.gz, `lon=${lon} ${i}:30 时柱两形态不一致`);
      eq(a.pillars.day.gz, b.pillars.day.gz, `lon=${lon} ${i}:30 日柱两形态不一致`);
      eq(a.yong.xiWx.join(), b.yong.xiWx.join(), `lon=${lon} ${i}:30 喜用两形态不一致`);
    }
  }
});
t('§八 记的实测要对得上:偏西的城市十二时辰整排前移一格', () => {
  // 1995-06-10 12:00 钟点:北京/广州不错位(仍午时),成都/乌鲁木齐前移一格(排出巳时)。
  // 这是**外部对照**——真太阳时该落在哪个时辰是历法的事,不是本项目能自证的。
  const at = lon => Bazi.chart(new Date(1995, 5, 10, 12, 0), '男', lon).pillars.hour.zhi;
  eq(at(116.4), '午', '北京 12:00 该仍是午时');
  eq(at(113.3), '午', '广州 12:00 该仍是午时');
  eq(at(104.1), '巳', '成都 12:00 真太阳 10:57,该前移成巳时');
  eq(at(87.6), '巳', '乌鲁木齐 12:00 真太阳 09:51,该前移成巳时');
});
t('不填经度仍按 120°E,夏令时照拨(缺经度不等于缺夏令时)', () => {
  const d = new Date(1990, 5, 15, 10, 0);   // 1990 夏令时期内
  eq(Bazi.chart(d, '男').pillars.hour.gz, Bazi.chart(d, '男', 120).pillars.hour.gz, '不填经度该等同 120°E');
  // 拿分钟差判,不拿 getHours 判:120°E 上均时差仍有零点几分钟,
  // 10:00 减掉 60 分夏令时之后是 08:59:48——按小时数判会得出「没拨」的错结论(头一版就栽在这)。
  const noDst = new Date(1995, 5, 15, 10, 0);
  const gap = x => (x - Bazi.trueSolarDate(x, 120)) / 60000;
  ok(Math.abs(gap(d) - 60) < 1.5, `1990 夏令时该回拨约一小时,实得 ${gap(d).toFixed(1)} 分钟`);
  ok(Math.abs(gap(noDst)) < 1.5, `1995 无夏令时不该拨,实得 ${gap(noDst).toFixed(1)} 分钟`);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
