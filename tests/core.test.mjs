// 内测:核心逻辑测试(node tests/core.test.mjs)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GuaData = require('../gua-data.js');
const GuaCore = require('../gua-core.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】数据完整性');
t('六十四卦齐全且 id 唯一', () => {
  eq(GuaData.GUA.length, 64);
  eq(new Set(GuaData.GUA.map(g => g.id)).size, 64);
  eq(Object.keys(GuaData.BY_ID).length, 64);
});
t('每卦结构完整(卦辞/大象/爻辞/小象/东玄断)', () => {
  for (const g of GuaData.GUA) {
    ok(g.guaCi && g.daXiang && g.dx && g.lv, g.name + ' 缺字段');
    const n = (g.name === '乾' || g.name === '坤') ? 7 : 6;
    eq(g.yaoCi.length, n, g.name + ' 爻辞数');
    eq(g.xiaoXiang.length, n, g.name + ' 小象数');
    ok(/^[1-9]\d?$/.test(String(g.n)) && g.n >= 1 && g.n <= 64);
  }
});
t('经文抽查(通行本原文)', () => {
  eq(GuaData.BY_ID['111111'].guaCi, '乾：元亨，利贞。');
  eq(GuaData.BY_ID['111111'].yaoCi[0], '初九：潜龙，勿用。');
  eq(GuaData.BY_ID['111111'].yaoCi[6], '用九：见群龙无首，吉。');
  ok(GuaData.BY_ID['000000'].yaoCi[6].startsWith('用六'), '坤用六');
  eq(GuaData.BY_ID['000000'].daXiang, '地势坤，君子以厚德载物。');
  eq(GuaData.BY_ID['111111'].daXiang, '天行健，君子以自强不息。');
});
t('卦名与卦序抽查', () => {
  eq(GuaData.BY_ID['111000'].full, '地天泰'); eq(GuaData.BY_ID['111000'].n, 11);
  eq(GuaData.BY_ID['000111'].full, '天地否'); eq(GuaData.BY_ID['000111'].n, 12);
  eq(GuaData.BY_ID['001000'].full, '地山谦'); eq(GuaData.BY_ID['001000'].n, 15);
  eq(GuaData.BY_ID['101010'].full, '水火既济'); eq(GuaData.BY_ID['101010'].n, 63);
  eq(GuaData.BY_ID['010101'].full, '火水未济'); eq(GuaData.BY_ID['010101'].n, 64);
  eq(GuaData.BY_ID['100010'].full, '水雷屯');
  eq(GuaData.BY_ID['111111'].full, '乾为天');
});
t('八卦表:bits 自下而上、方位与数齐全', () => {
  const T = GuaData.TRIGRAMS;
  eq(Object.keys(T).length, 8);
  eq(T['100'].name, '震'); eq(T['100'].dir, '正东');   // 初爻阳
  eq(T['001'].name, '艮'); eq(T['001'].dir, '东北');   // 上爻阳
  eq(T['110'].name, '兑'); eq(T['011'].name, '巽');
  for (const k of Object.keys(T)) ok(T[k].xt >= 1 && T[k].xt <= 8 && T[k].ht >= 1 && T[k].ht <= 9 && T[k].branches.length > 0, k);
});

console.log('【二】三钱法掷爻数学');
t('铜钱组合→爻值:三字=9老阳动,三背=6老阴动,二字一背=8少阴,一字二背=7少阳', () => {
  const mk = bits => { let i = 0; return () => bits[i++]; };
  let l = GuaCore.tossLine(mk([1, 1, 1])); eq(l.sum, 9); ok(l.yang && l.moving, '9=老阳动');
  l = GuaCore.tossLine(mk([0, 0, 0])); eq(l.sum, 6); ok(!l.yang && l.moving, '6=老阴动');
  l = GuaCore.tossLine(mk([1, 1, 0])); eq(l.sum, 8); ok(!l.yang && !l.moving, '8=少阴静');
  l = GuaCore.tossLine(mk([1, 0, 0])); eq(l.sum, 7); ok(l.yang && !l.moving, '7=少阳静');
});
t('非法爻值报错', () => {
  let threw = false;
  try { GuaCore.castFromSums([5, 7, 7, 7, 7, 7]); } catch (e) { threw = true; }
  ok(threw, '5 应报错');
});

console.log('【三】成卦与变卦推导');
t('静卦:自下而上排爻,[7,7,7,8,8,8]=地天泰,无变卦', () => {
  const c = GuaCore.castFromSums([7, 7, 7, 8, 8, 8]);
  eq(c.ben.full, '地天泰'); eq(c.bian, null); eq(c.moving.length, 0);
});
t('一爻动:乾初爻9动→变天风姤', () => {
  const c = GuaCore.castFromSums([9, 7, 7, 7, 7, 7]);
  eq(c.ben.full, '乾为天'); eq(c.bian.full, '天风姤'); eq(c.moving.join(','), '0');
});
t('老阴变阳:坤五爻6动→变水地比', () => {
  const c = GuaCore.castFromSums([8, 8, 8, 8, 6, 8]);
  eq(c.ben.full, '坤为地'); eq(c.bian.full, '水地比'); eq(c.moving.join(','), '4');
});
t('多爻动:泰初三爻动(9,7,9,8,8,8)→变卦地水师', () => {
  // 泰 111000,初爻、三爻由阳变阴:下卦 111→010(坎),上卦坤不变,得地水师
  const c = GuaCore.castFromSums([9, 7, 9, 8, 8, 8]);
  eq(c.ben.full, '地天泰'); eq(c.bian.full, '地水师'); eq(c.moving.join(','), '0,2');
});
t('六爻全变:乾→坤,坤→乾', () => {
  const c1 = GuaCore.castFromSums([9, 9, 9, 9, 9, 9]);
  eq(c1.ben.full, '乾为天'); eq(c1.bian.full, '坤为地');
  const c2 = GuaCore.castFromSums([6, 6, 6, 6, 6, 6]);
  eq(c2.ben.full, '坤为地'); eq(c2.bian.full, '乾为天');
});
t('全部 64 卦静卦可查(BY_ID 全覆盖)', () => {
  for (const g of GuaData.GUA) {
    const sums = g.id.split('').map(b => (b === '1' ? 7 : 8));
    const c = GuaCore.castFromSums(sums);
    eq(c.ben.n, g.n, g.full);
  }
});

console.log('【四】解卦优先级规则');
t('0 变:以本卦卦辞断', () => {
  const p = GuaCore.interpretationPlan(GuaCore.castFromSums([7, 7, 7, 8, 8, 8]));
  eq(p.mode, '静卦'); ok(p.focus[0].kind.includes('本卦卦辞'), p.focus[0].kind);
});
t('1 变:以动爻爻辞为核心,兼看本变卦辞', () => {
  const p = GuaCore.interpretationPlan(GuaCore.castFromSums([9, 7, 7, 7, 7, 7]));
  ok(p.focus[0].kind.includes('动爻爻辞'), '首位为动爻爻辞');
  ok(p.focus[0].text.includes('潜龙'), '乾初九爻辞');
  ok(p.focus.some(f => f.kind.includes('变卦卦辞')), '含变卦卦辞');
});
t('2-3 变:本卦变卦并重,动爻逐一列出', () => {
  const p = GuaCore.interpretationPlan(GuaCore.castFromSums([9, 7, 9, 8, 8, 8]));
  eq(p.focus.filter(f => f.kind.includes('动爻爻辞')).length, 2);
  ok(p.focus.some(f => f.kind.includes('本卦卦辞')) && p.focus.some(f => f.kind.includes('变卦卦辞')));
});
t('4-5 变:以变卦为主', () => {
  const p = GuaCore.interpretationPlan(GuaCore.castFromSums([9, 9, 9, 9, 7, 6]));
  ok(p.focus[0].kind.includes('变卦卦辞') && p.focus[0].kind.includes('核心'), p.focus[0].kind);
});
t('六爻全变:乾用用九,坤用用六,余卦用变卦卦辞', () => {
  let p = GuaCore.interpretationPlan(GuaCore.castFromSums([9, 9, 9, 9, 9, 9]));
  ok(p.focus[0].kind.includes('用九') && p.focus[0].text.includes('群龙无首'), '乾用九');
  p = GuaCore.interpretationPlan(GuaCore.castFromSums([6, 6, 6, 6, 6, 6]));
  ok(p.focus[0].kind.includes('用六'), '坤用六');
  p = GuaCore.interpretationPlan(GuaCore.castFromSums([9, 6, 9, 6, 9, 6])); // 本卦离?1,0,1,0,1,0=坎上离下? id=101010 既济
  ok(p.focus[0].kind.includes('变卦卦辞'), '他卦全变以变卦断');
});
t('interpret():断语主取——3 变以下取本卦东玄断,4 变以上取变卦', () => {
  const r1 = GuaCore.interpret(GuaCore.castFromSums([9, 7, 7, 7, 7, 7]));
  ok(r1.dxFrom.includes('乾为天'), r1.dxFrom);
  const r2 = GuaCore.interpret(GuaCore.castFromSums([9, 9, 9, 9, 7, 6]));
  ok(r2.dxFrom.includes('变卦为主'), r2.dxFrom);
});

console.log('【五】回报文本格式');
t('回报文本五要素齐全、格式吻合', () => {
  const c = GuaCore.castFromSums([9, 7, 7, 7, 7, 7]);
  const rep = GuaCore.buildReport(c, '测试之问');
  const lines = rep.split('\n');
  eq(lines[0], '【东玄掷卦 · 卦象回报】');
  eq(lines[1], '六爻(自下而上):9、7、7、7、7、7');
  eq(lines[2], '本卦:乾为天(上卦乾 / 下卦乾)');
  eq(lines[3], '动爻:初爻动');
  eq(lines[4], '变卦:天风姤(上卦乾 / 下卦巽)');
  eq(lines[5], '我要问的事:测试之问');
});
t('静卦回报:动爻无、变卦无', () => {
  const rep = GuaCore.buildReport(GuaCore.castFromSums([7, 7, 7, 8, 8, 8]), '');
  ok(rep.includes('动爻:无(六爻安静)') && rep.includes('变卦:无'), rep);
});

console.log('【六】随机性检验(CSPRNG)');
t('铜钱比特均匀性:60000 次,字面占比 50%±1.5%', () => {
  let ones = 0; const N = 60000;
  for (let i = 0; i < N; i++) ones += GuaCore.cryptoBit();
  const ratio = ones / N;
  ok(Math.abs(ratio - 0.5) < 0.015, '占比 ' + ratio.toFixed(4));
});
t('爻值分布:40000 爻,理论 6:12.5% 7:37.5% 8:37.5% 9:12.5%,偏差<1.5%', () => {
  const freq = { 6: 0, 7: 0, 8: 0, 9: 0 }; const N = 40000;
  for (let i = 0; i < N; i++) freq[GuaCore.tossLine().sum]++;
  const exp = { 6: .125, 7: .375, 8: .375, 9: .125 };
  for (const k of [6, 7, 8, 9]) {
    const r = freq[k] / N;
    ok(Math.abs(r - exp[k]) < 0.015, `爻值${k} 占比 ${r.toFixed(4)}(期望 ${exp[k]})`);
  }
});
t('压力:1000 次随机成卦全部合法可解读', () => {
  const LV = new Set(['大吉', '吉', '小吉', '平吉', '平', '谨慎', '凶', '大凶']);
  for (let i = 0; i < 1000; i++) {
    const c = GuaCore.castHexagram();
    ok(c.ben && c.ben.full, '本卦缺失');
    if (c.moving.length) ok(c.bian && c.bian.full, '有动爻须有变卦');
    else ok(c.bian === null, '静卦不应有变卦');
    const r = GuaCore.interpret(c);
    ok(r.headline && r.focus.length > 0 && LV.has(r.level), '解读不完整:' + r.level);
    ok(GuaCore.buildReport(c, 'x').split('\n').length === 6, '回报应为 6 行');
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
