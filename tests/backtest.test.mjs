// 名人回测:以命理文献公开记载的历史人物八字为客观答案,校验排盘引擎与断法方向
// node tests/backtest.test.mjs
// 方法论说明:排盘层(四柱)有唯一正确答案,逐柱必须全中;
// 强弱喜用层以命理界公开共识为对照(如毛氏丁火生子月身弱喜木火);
// 事件层不设硬断言——同八字不同命是全行业客观限制,不假装能考(详见 README 之诚实条款)。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require('../bazi.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】历史名例排盘全中(文献八字为客观答案)');
t('毛泽东 1893-12-26 辰时:癸巳年 甲子月 丁酉日 甲辰时(文献通行记载)', () => {
  const c = Bazi.chart(new Date(1893, 11, 26, 8, 0), '男');
  eq(c.pillars.year.gz, '癸巳', '年柱');
  eq(c.pillars.month.gz, '甲子', '月柱');
  eq(c.pillars.day.gz, '丁酉', '日柱');
  eq(c.pillars.hour.gz, '甲辰', '时柱');
});
t('蒋介石 1887-10-31 午时:丁亥年 庚戌月 己巳日 庚午时(文献通行记载)', () => {
  const c = Bazi.chart(new Date(1887, 9, 31, 12, 0), '男');
  eq(c.pillars.year.gz, '丁亥', '年柱');
  eq(c.pillars.month.gz, '庚戌', '月柱');
  eq(c.pillars.day.gz, '己巳', '日柱');
  eq(c.pillars.hour.gz, '庚午', '时柱');
});

console.log('【二】断法方向与行内公开共识对齐');
t('毛例:丁火生子月为失令,断身弱、喜木火(印比),与通行论命一致', () => {
  const c = Bazi.chart(new Date(1893, 11, 26, 8, 0), '男');
  eq(c.dayGan, '丁');
  ok(!c.strength.strong || c.geju, '子月丁火不当令,应判弱(或从格)');
  if (!c.geju) {
    ok(c.yong.xiWx.includes('木') && c.yong.xiWx.includes('火'), '喜木火:' + c.yong.xiWx.join(''));
    ok(c.yong.jiWx.includes('水'), '忌水:' + c.yong.jiWx.join(''));
  }
  eq(c.strength.deLing, '受月令克(失令)', '子月癸水当权,丁火失令');
  ok(!c.geju, '此局年支巳中有丙火之根、又双甲透印,判从格即为错');
});
t('蒋例:己土生戌月为当令,通根戌未、巳午印生,当断身旺用泄耗', () => {
  const c = Bazi.chart(new Date(1887, 9, 31, 12, 0), '男');
  eq(c.dayGan, '己');
  eq(c.strength.deLing, '当令', '戌月主气戊土,己土当令');
  ok(['身旺', '偏旺'].includes(c.strength.band), '应断旺,实得' + c.strength.band);
  ok(c.yong.jiWx.includes('土'), '身旺当忌比劫土');
});
t('大运顺逆:毛例癸巳阴年男命逆行,蒋例丁亥阴年男命逆行(阳男阴女顺、阴男阳女逆)', () => {
  const mao = Bazi.chart(new Date(1893, 11, 26, 8, 0), '男');
  const jiang = Bazi.chart(new Date(1887, 9, 31, 12, 0), '男');
  eq(mao.dayun.forward, false, '癸为阴干,男命逆排');
  eq(jiang.dayun.forward, false, '丁为阴干,男命逆排');
  const yang = Bazi.chart(new Date(1964, 8, 10, 12, 0), '男'); // 甲辰年
  eq(yang.dayun.forward, true, '甲为阳干,男命顺排');
});

console.log('【三】现代公开生日排盘抽验(年柱月柱按历法必然)');
t('1964-09-10:甲辰年癸酉月;2000-01-07:己卯年丁丑月甲子日', () => {
  const a = Bazi.chart(new Date(1964, 8, 10, 12), '男');
  eq(a.pillars.year.gz, '甲辰');
  eq(a.pillars.month.gz, '癸酉');
  const b = Bazi.chart(new Date(2000, 0, 7, 12), '男');
  eq(b.pillars.year.gz, '己卯', '立春前属旧岁');
  eq(b.pillars.day.gz, '甲子', '锚点日');
});

console.log('【四】事件层语料与回测口径(缘起:2026-07 拿到 28 人语料,事件层第一次能量数字)');
// 这一节不钉命中率——命中率会随断法改动而变,钉死它等于禁止改进。
// 钉的是**语料的完整性**与**报告的诚实性**:格式对不对、类别越不越界、
// 以及那份报告里有没有把落空一起摆出来(宪法第七节:只报命中不报落空等同作假)。
const BT = JSON.parse(readFileSync(join(ROOT, 'data', 'backtest-cases.json'), 'utf8'));
const CATKEYS = ['yinyuan', 'shiye', 'caiyun', 'wenshu', 'biandong', 'zinv', 'jiankang', 'guanfei'];
t('语料结构完整:人数、事件数与自述一致,类别零越界', () => {
  eq(BT.cases.length, BT._meta['人数'], '人数');
  const n = BT.cases.reduce((a, c) => a + c.events.length, 0);
  eq(n, BT._meta['事件数'], '事件数');
  for (const c of BT.cases) {
    ok(/^\d{4}-\d{2}-\d{2}$/.test(c.birth), c.name + ' 生日格式');
    ok(typeof c.lon === 'number' && typeof c.tzMin === 'number', c.name + ' 缺经度或时差');
    ok(c.tzNote && c.tzNote.length > 4, c.name + ' 时差没写依据');
    for (const e of c.events) {
      ok(CATKEYS.includes(e.type), `${c.name} ${e.year} 类别越界:${e.type}`);
      ok(typeof e.good === 'boolean', `${c.name} ${e.year} 没标好事坏事`);
      ok(e.source && e.source.length > 1, `${c.name} ${e.year} 没写来源`);
    }
  }
});
t('时辰铁律:只有档案级来源才算数,其余一律留空', () => {
  const known = BT.cases.filter(c => c.hourKnown);
  eq(known.length, BT._meta['有档案级时辰'], '档案级时辰人数');
  for (const c of known) ok(/^\d{1,2}:\d{2}$/.test(c.hour), c.name + ' 标了可靠却没有钟点');
  for (const c of BT.cases.filter(x => !x.hourKnown)) {
    eq(c.hour, '', c.name + ' 时辰不详却填了钟点——倒推来的时辰不许进语料');
    ok(c.hourNote.length > 0, c.name + ' 时辰不详却没写为什么不采信');
  }
});
t('回测报告必须连落空一起报,并写明口径与自身毛病', () => {
  const rep = readFileSync(join(ROOT, 'docs', '回测报告-01-事件层.md'), 'utf8');
  for (const k of ['落空清单', '命中率', '弃权', '这份回测本身的毛病', '按人分层']) {
    ok(rep.includes(k), '报告缺:' + k);
  }
  // 落空表里的条目数要与报告正文声称的落空数对得上
  const claimed = Number((rep.match(/\| 1\.0 \| \d+ \| \d+ \| \d+ \| (\d+) \|/) || [])[1]);
  const listed = (rep.match(/^\| [^|]+ \| 1?\d{3} \| /gm) || []).length;
  ok(claimed > 0 && listed === claimed, `报告说落空 ${claimed} 件,清单里只列了 ${listed} 件`);
});
t('不许把弱信号说成准:报告里必须有「不够格叫准」这类明话', () => {
  const rep = readFileSync(join(ROOT, 'docs', '回测报告-01-事件层.md'), 'utf8');
  ok(/不够格叫准|不许说「?经回测验证准确/.test(rep), '报告没有把话说死');
  ok(!/经回测验证.{0,4}准确(?!」)/.test(rep.replace(/不许说「[^」]*」/g, '')), '报告里出现了「经回测验证准确」这种话');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
