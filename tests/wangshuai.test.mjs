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
function mkChart(four, days = 15) {
  const gz = four.match(/.{2}/g);
  const pillars = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { pillars[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  const dayGan = pillars.day.gan;
  const strength = Bazi.judgeStrength(pillars, dayGan, days);
  const cong = Bazi.judgeCong(strength, pillars, dayGan);
  const th = Bazi.tiaoHou(pillars.month.zhi);
  let yong = Bazi.pickYongShen(dayGan, strength, th);
  const me = Bazi.GAN_WX[dayGan];
  if (cong && cong.type === '从强') yong = { xiWx: [me], jiWx: [], xiName: '从强' };
  else if (cong && cong.type === '从弱') yong = { xiWx: [Bazi.KE[me]], jiWx: [me], xiName: '从弱' };
  return { pillars, dayGan, dayWx: me, strength, cong, geju: cong ? cong.name : null, yong };
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
t('扫描四千盘:凡判从弱格者,四支必无一丝日主之根', () => {
  const d0 = new Date(1950, 0, 1);
  let ruo = 0, bad = 0;
  for (let i = 0; i < 4000; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), i % 2 ? '男' : '女');
    if (c.cong && c.cong.type === '从弱') { ruo++; if (c.strength.hasRoot) bad++; }
  }
  ok(ruo > 0, '样本里应当有从弱格');
  eq(bad, 0, '有根却判从弱的盘数');
});
t('从格是稀有格局:真从占比应在 5% 以内(旧法曾高达 11%)', () => {
  const d0 = new Date(1950, 0, 1);
  let n = 0, cong = 0;
  for (let i = 0; i < 3000; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), '男'); n++;
    if (c.cong && c.cong.type !== '假从') cong++;
  }
  ok(cong / n < 0.05, '从格占比=' + (cong / n * 100).toFixed(2) + '%');
});
t('曾误判的三个实盘,今判正格身弱且指得出根', () => {
  for (const [four, wantRoot] of [['己丑丁丑甲子戊辰', '辰'], ['辛卯己亥丙子癸巳', '巳'], ['壬辰壬子丁亥庚戌', '戌']]) {
    const c = mkChart(four);
    ok(!c.geju || !c.geju.includes('从弱'), four + ' 仍被判从弱');
    ok(c.strength.roots.some(r => r.zhi === wantRoot), four + ' 应认出' + wantRoot + '中之根');
    ok(c.yong.xiWx.includes(c.dayWx), four + ' 身弱当喜比劫');
  }
});
t('假从只作标注,不翻喜忌(宁可少断,不可反断)', () => {
  const d0 = new Date(1950, 0, 1);
  let jia = 0;
  for (let i = 0; i < 3000; i++) {
    const d = new Date(d0.getTime() + i * 7 * 86400000); d.setHours((i % 12) * 2 + 1);
    const c = Bazi.chart(new Date(d), '男');
    if (c.cong && c.cong.type === '假从') { jia++; ok(c.yong.xiWx.includes(c.dayWx) || c.yong.neutral, '假从不该翻喜忌'); }
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
t('命例基线不许倒退:旺衰子集复现 ≥ 41/53(v0.96 合化落地后的数)', () => {
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
  ok(n === 53, '旺衰子集该 53 例,实得 ' + n);
  ok(hit >= 41, `复现 ${hit}/53,倒退了(v0.96 基线 41)`);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
