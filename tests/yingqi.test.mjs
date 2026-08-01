// 应期专项内测
// 缘起:古籍研读(docs/古籍研读-01)把《增删卜易》全书「什么情况应在什么日」的句子捞出来归类,
// 发现程序只覆盖 8 种取法里的 2 种(值日、冲日),而且**恰好漏掉原文里用得最多的三种**:
// 出空实空 35 处、实破 15 处、合日 13 处,另缺冲墓 12 处。v0.66 补齐。
//
// 这套测试守三件事:
//   一、每条规则的原话都要在 data/classics/增删卜易.txt 里搜得到(该本是繁体,原话照繁体存);
//   二、不许有取不到应期的卦,也不许某一法压倒性地占满;
//   三、同一卦同一时刻反复算,结果必须完全一样——「答案之锚」这条设计不能被补法破坏。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Yingqi = require(join(ROOT, 'yingqi.js'));
const Najia = require(join(ROOT, 'najia.js'));
const GuaData = require(join(ROOT, 'gua-data.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };
const strip = x => x.replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒]/g, '');
const RAW = strip(readFileSync(join(ROOT, 'data', 'classics', '增删卜易.txt'), 'utf8'));
const IDS = Object.keys(GuaData.BY_ID);
const FROM = new Date(2026, 7, 2, 10, 0);

console.log('【一】外部对照:每条取法的原话都要在《增删卜易》里核得到');
t('八法的引文逐条搜得到(繁体原文照抄)', () => {
  const bad = [];
  for (const r of Yingqi.YQ_RULES) {
    const q = strip(r.q);
    if (!RAW.includes(q)) bad.push(`${r.key}:「${r.q}」`);
  }
  ok(!bad.length, '这些原话在原文里搜不到:\n      ' + bad.join('\n      '));
  ok(Yingqi.YQ_RULES.length >= 7, '取法条数太少:' + Yingqi.YQ_RULES.length);
});
t('入墓的墓库对应:火墓戌、水墓辰这两味原文直接核得到', () => {
  // 木墓未、金墓丑、土墓戌那三味这份转录里搜不到,故代码里没挂它的名,改从十二长生表推。
  // 这条只核能核的那两味,核不了的不假装核过。
  ok(RAW.includes(strip('巳火墓於戌')) || RAW.includes(strip('火墓於戌')), '火墓戌应有原文');
  ok(RAW.includes(strip('子水入墓之年')), '水入墓(辰)应有原文');
});

console.log('【二】覆盖与分布:不许取不到,也不许某一法独占');
t('六十四卦 × 四种动爻组合,每一例都取得到应期', () => {
  let n = 0, nulls = 0;
  for (const id of IDS) for (const mv of [[], [2], [0, 4], [1, 3, 5]]) {
    const r = Yingqi.yingqiOf({ benId: id, moving: mv }, FROM);
    n++; if (!r) nulls++;
  }
  eq(nulls, 0, `${n} 例里有 ${nulls} 例取不到应期`);
  ok(n >= 250, '样本太少');
});
t('没有哪一法占掉七成以上,且至少见得到五法', () => {
  const cnt = {}; let n = 0;
  for (const id of IDS) for (const mv of [[], [2], [0, 4], [1, 3, 5]]) {
    const r = Yingqi.yingqiOf({ benId: id, moving: mv }, FROM);
    if (!r) continue; n++; cnt[r.state] = (cnt[r.state] || 0) + 1;
  }
  ok(Object.keys(cnt).length >= 5, '只见到 ' + Object.keys(cnt).length + ' 法:' + Object.keys(cnt).join('、'));
  for (const [k, v] of Object.entries(cnt)) ok(v / n < 0.7, `${k} 占了 ${(v / n * 100).toFixed(0)}%,分布不正常`);
});
t('取法的先后守着「状态越具体越先」:又空又破时必取「空破并见」而非单独的空或破', () => {
  const rules = Yingqi.YQ_RULES.map(r => r.key);
  ok(rules.indexOf('空破并见') === 0, '「空破并见」必须排在最前,实得次序:' + rules.join('>'));
  for (const k of ['旬空', '月破', '入墓', '合住']) {
    ok(rules.indexOf(k) < rules.indexOf('动而逢合'), `${k} 应排在通则「动而逢合」之前`);
  }
  ok(rules.indexOf('动而逢合') < rules.indexOf('静而逢冲') + 2, '动静两条通则应垫底');
});

t('破而逢合:月破的第二条解法补齐了,两条都真触发得到', () => {
  // 缘起:CLAUDE.md 待办第 3 条留的最后一个尾巴。原文一句话里并列写着两条解法——
  // 「今日𨿽破﹐實破之日則不破﹐合之日則不破」。原先只做了「实破」,「逢合」一直缺着。
  // 现在两条都算,取先到的那一天(忠于原文「两者皆可」,又保住答案之锚只出一个答案)。
  const rule = Yingqi.YQ_RULES.find(r => r.key === '月破');
  ok(rule, '找不到月破那条');
  ok(typeof rule.altZhiOf === 'function', '月破缺备取解法(破而逢合)');
  ok(strip(rule.q).includes(strip('合之日則不破')), '出处那句要含逢合这一解:' + rule.q);
  ok(RAW.includes(strip(rule.q)), '月破的出处在原文里搜不到:' + rule.q);
  // 跨半年扫一遍:两条解法都得真触发得到,不许有一条是死的
  let he = 0, shi = 0, n = 0;
  for (let d = 0; d < 120; d++) {
    const from = new Date(2026, 0, 1 + d * 3, 10, 0);
    for (const id of IDS.slice(0, 16)) for (const mv of [[], [2], [1, 3, 5]]) {
      const r = Yingqi.yingqiOf({ benId: id, moving: mv }, from);
      if (r && r.state === '月破') { n++; r.which === '合' ? he++ : shi++; }
    }
  }
  ok(n >= 100, '月破样本太少:' + n);
  ok(he > 0, '「破而逢合」这一解一次都没触发——是条死分支');
  ok(shi > 0, '「实破」这一解一次都没触发——补逢合时把原来那条挤死了');
  // 取的必须真是先到的那一天
  ok(Math.abs(he - shi) / n < 0.3, `两解比例失衡:合 ${he} / 实 ${shi}——取「先到」的话应大体各半`);
  console.log(`      (跨 120 个日子共 ${n} 例月破:逢合 ${(he / n * 100).toFixed(0)}%、实破 ${(shi / n * 100).toFixed(0)}%)`);
});
t('逢合取的那个支,真是本支的六合之支', () => {
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  let n = 0;
  for (let d = 0; d < 60; d++) {
    const from = new Date(2026, 0, 1 + d * 5, 10, 0);
    for (const id of IDS.slice(0, 24)) {
      const r = Yingqi.yingqiOf({ benId: id, moving: [2] }, from);
      if (!r || r.state !== '月破' || r.which !== '合') continue;
      eq(r.targetZhi, LIUHE[r.zhi], `${r.zhi}的六合应是${LIUHE[r.zhi]}`);
      n++;
    }
  }
  ok(n >= 10, '逢合样本太少:' + n);
});

console.log('【三】答案之锚:同一卦同一时刻,结论必须只有一个');
t('反复算一百次,结果完全一致(不许有随机)', () => {
  const cast = { benId: IDS[7], moving: [1, 4] };
  const first = JSON.stringify(Yingqi.yingqiOf(cast, FROM));
  for (let i = 0; i < 100; i++) eq(JSON.stringify(Yingqi.yingqiOf(cast, FROM)), first, '第' + i + '次不一致');
});
t('算出来的日子,其地支真的是该法要求的那个支', () => {
  let n = 0;
  for (const id of IDS.slice(0, 24)) for (const mv of [[], [3]]) {
    const r = Yingqi.yingqiOf({ benId: id, moving: mv }, FROM);
    if (!r || !r.date) continue;
    const [y, m, d] = r.date.replace(/[年月]/g, '-').replace('日', '').split('-').map(Number);
    eq(Najia.ganZhi(new Date(y, m - 1, d, 12)).dayZhi, r.targetZhi,
      `${r.state}:算出 ${r.date},但那天不是${r.targetZhi}日`);
    n++;
  }
  ok(n >= 20, '有效样本太少:' + n);
});

console.log('【四】诚实:优先级是本项目排的,必须写明');
t('每次输出都带一句「这个先后是我排的,原文没有明列」', () => {
  const r = Yingqi.yingqiOf({ benId: IDS[0], moving: [2] }, FROM);
  ok(r.note && /本项目定的|我自己担着/.test(r.note), '缺优先级来源说明:' + (r && r.note));
  ok(/原文没有明列/.test(r.note), '须写明原文没有优先级表');
});
t('源码里写明了哪些墓库对应核过、哪些没核过', () => {
  const src = readFileSync(join(ROOT, 'najia.js'), 'utf8');
  ok(/火墓戌、水墓辰这两味原文里直接核得到/.test(src), 'najia 须写明哪两味核过');
  ok(/出处待核/.test(src), '核不了的须标出处待核');
});
t('断语里不出现术语堆砌——说的是人话', () => {
  const BAN = /用神|六亲|世应|纳甲|旬空之爻|月破之爻|十神/;
  for (const r of Yingqi.YQ_RULES) {
    ok(!BAN.test(r.say), `「${r.key}」的说法带术语:${r.say}`);
    ok(r.say.length >= 12, `「${r.key}」的说法太短,等于没说:${r.say}`);
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
