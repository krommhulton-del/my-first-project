// 应期专项内测
// 缘起:古籍研读(docs/古籍研读-01)把《增删卜易》全书「什么情况应在什么日」的句子捞出来归类,
// 发现程序只覆盖 8 种取法里的 2 种(值日、冲日),而且**恰好漏掉原文里用得最多的三种**:
// 出空实空 35 处、实破 15 处、合日 13 处,另缺冲墓 12 处。v0.66 补齐,v0.74 补「破而逢合」。
//
// **v0.89 换了一把更硬的尺**:维基文库本转录带来了老转录缺的「各門類應期總注章」——
// 原书自己的应期总表。这套测试从此按它钉:
//   一、每条规则的原话在两份转录合并的原文里逐字搜得到(老转录繁体、维基文库本繁体,各照原貌);
//   二、**总表里带例子的条目,规则函数必须复现书上的例子**(外部对照,这是 v0.89 新增的硬尺);
//   三、不许有取不到应期的卦,不许某一法独占,不许有死分支;
//   四、同一卦同一时刻反复算,结果必须完全一样——「答案之锚」不许被补法破坏;
//   五、两解并存时取先到的那一天,这是不变量;
//   六、优先级是本项目排的,必须写明(总注章是状态清单,不是先后表)。
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
// 同一本书的两份转录并成一个库(老转录缺卷之一;维基文库本恰是卷之一,总注章在其中)
const RAW = strip(readFileSync(join(ROOT, 'data', 'classics', '增删卜易.txt'), 'utf8'))
  + strip(readFileSync(join(ROOT, 'data', 'classics', '增删卜易-维基文库本.txt'), 'utf8'));
const IDS = Object.keys(GuaData.BY_ID);
const FROM = new Date(2026, 7, 2, 10, 0);
// 动爻翻卦得变卦 id(进退神应期要用:没有变卦就没有进退神)
const flip = (id, mv) => id.split('').map((c, i) => mv.includes(i) ? (c === '1' ? '0' : '1') : c).join('');
const castOf = (id, mv) => ({ benId: id, moving: mv, bianId: mv.length ? flip(id, mv) : id });
const ruleOf = k => Yingqi.YQ_RULES.find(r => r.key === k);

console.log('【一】外部对照:每条取法的原话都要在《增删卜易》里核得到');
t('全部取法的引文(含备证 q2)逐条搜得到——两份转录合并的库,繁体照原貌', () => {
  const bad = [];
  for (const r of Yingqi.YQ_RULES) {
    if (!RAW.includes(strip(r.q))) bad.push(`${r.key}:「${r.q}」`);
    if (r.q2 && !RAW.includes(strip(r.q2))) bad.push(`${r.key}(备证):「${r.q2}」`);
  }
  ok(!bad.length, '这些原话在原文里搜不到:\n      ' + bad.join('\n      '));
  ok(Yingqi.YQ_RULES.length >= 10, '取法条数太少:' + Yingqi.YQ_RULES.length);
});
t('入墓的墓库对应:火墓戌、水墓辰这两味原文直接核得到', () => {
  // 木墓未、金墓丑、土墓戌那三味这份转录里搜不到,故代码里没挂它的名,改从十二长生表推。
  // 这条只核能核的那两味,核不了的不假装核过。
  ok(RAW.includes(strip('火墓於戌')), '火墓戌应有原文');
  ok(RAW.includes(strip('子水入墓之年')), '水入墓(辰)应有原文');
});

console.log('【二】外部对照(v0.89 新增的硬尺):总注章带例子的条目,规则必须复现书上的例子');
t('静而逢值逢冲:书例「臨子水不動,後逢子日午日」——规则给的正是子、午', () => {
  const c = ruleOf('静而逢值逢冲').cands({ zhi: '子' });
  eq(c.map(x => x.zhi).join(''), '子午', '次序也要照原文(值先冲后)');
  eq(c.map(x => x.which).join(''), '值冲');
});
t('动而逢合逢值:书例「臨子水發動,後遇丑日子日」——规则给的正是丑、子', () => {
  const c = ruleOf('动而逢合逢值').cands({ zhi: '子' });
  eq(c.map(x => x.zhi).join(''), '丑子', '次序也要照原文(合先值后)');
});
t('太旺:书例「主事爻臨午火…又有戌日應之乃火入墓也」——墓取戌、冲取子', () => {
  const c = ruleOf('太旺').cands({ zhi: '午', wx: '火' });
  eq(c.map(x => x.zhi).join(''), '戌子');
  eq(c.map(x => x.which).join(''), '墓冲');
});
t('入墓:书例「臨午火,火墓於戌,後逢辰日則應之」——冲开戌墓正是辰', () => {
  const c = ruleOf('入墓').cands({ zhi: '午', wx: '火', power: { ruMu: '日墓', muZhi: '戌' } });
  eq(c[0].zhi, '辰');
});
t('合住(遇六合相击):书例「主象臨子,與丑作合,後逢午未日應之」——冲本支午、冲合神未', () => {
  const c = ruleOf('合住').cands({ zhi: '子' });
  eq(c.map(x => x.zhi).join(''), '午未');
});
t('化进神:书例「申動酉…有應申月日者,有應巳月日者」——值本支申、合本支巳', () => {
  const c = ruleOf('化进神').cands({ zhi: '申' }, { bianItem: { jinTui: '进神', toZhi: '酉' } });
  eq(c.map(x => x.zhi).join(''), '申巳');
});
t('化退神:书例「酉化申…有應申月日者,有應寅日月者」——值变出之申、冲申之寅', () => {
  const c = ruleOf('化退神').cands({ zhi: '酉' }, { bianItem: { jinTui: '退神', toZhi: '申' } });
  eq(c.map(x => x.zhi).join(''), '申寅');
});
t('三墓的定义与「題頭總注章」逐字对上:入日墓、入动墓、动而化墓(非世墓身墓命墓)', () => {
  // 缘起:najia 的三墓判定 v0.66 从随鬼入墓章建的;v0.89 维基文库本到手,
  // 「題頭總注章」自带定义,头一次能拿原文钉死这三种就是这三种。
  ok(RAW.includes(strip('入日墓、入動墓、動而化墓,非古法之世墓、身墓、命墓')), '总注的三墓定义应在原文里');
  const src = readFileSync(join(ROOT, 'najia.js'), 'utf8');
  for (const k of ['日墓', '动墓', '化墓']) ok(src.includes(`'${k}'`) || src.includes(`${k}'`) || src.includes(`ruMu = '${k}`) || src.includes(k), `najia 缺${k}`);
  for (const k of ['世墓', '身墓', '命墓']) ok(!new RegExp(`ruMu.{0,6}${k}`).test(src), `najia 不该实现${k}(总注明说非古法之${k})`);
});

console.log('【三】覆盖与分布:不许取不到,不许独占,不许有死分支');
t('六十四卦 × 四种动爻组合,每一例都取得到应期', () => {
  let n = 0, nulls = 0;
  for (const id of IDS) for (const mv of [[], [2], [0, 4], [1, 3, 5]]) {
    const r = Yingqi.yingqiOf(castOf(id, mv), FROM);
    n++; if (!r) nulls++;
  }
  eq(nulls, 0, `${n} 例里有 ${nulls} 例取不到应期`);
  ok(n >= 250, '样本太少');
});
t('跨年扫一遍:没有哪一法占七成以上,十一法至少见到九法,且每条两解都真触发得到(死条穷举)', () => {
  const cnt = {}; let n = 0;
  for (let d = 0; d < 24; d++) {
    const from = new Date(2026, 0, 3 + d * 15, 10, 0);
    for (const id of IDS) for (const mv of [[], [2], [0, 4], [1, 3, 5]]) {
      const r = Yingqi.yingqiOf(castOf(id, mv), from);
      if (!r) continue; n++;
      cnt[r.state + '/' + r.which] = (cnt[r.state + '/' + r.which] || 0) + 1;
      cnt[r.state] = (cnt[r.state] || 0) + 1;
    }
  }
  for (const r of Yingqi.YQ_RULES) {
    ok(cnt[r.key] > 0, `「${r.key}」一次都没触发——死条`);
    ok(cnt[r.key] / n < 0.7, `「${r.key}」占了 ${(cnt[r.key] / n * 100).toFixed(0)}%,分布不正常`);
  }
  // 两解的每一解都得触发得到(v0.74 只查月破,v0.89 推广到所有两解规则)
  for (const [rule, whiches] of [['旬空', ['实', '冲']], ['月破', ['实', '合']], ['合住', ['冲', '冲合神']],
    ['太旺', ['墓', '冲']], ['化进神', ['值', '合']], ['化退神', ['值', '冲']],
    ['动而逢合逢值', ['合', '值']], ['静而逢值逢冲', ['值', '冲']]]) {
    for (const w of whiches) ok(cnt[rule + '/' + w] > 0, `「${rule}/${w}」这一解一次都没触发——死分支`);
  }
  console.log(`      (${n} 例;化进神 ${cnt['化进神'] || 0}、化退神 ${cnt['化退神'] || 0}、太旺 ${cnt['太旺'] || 0})`);
});
t('取法的先后守着「状态越具体越先」:又空又破必取「空破并见」,具体状态全在动静通则之前', () => {
  const rules = Yingqi.YQ_RULES.map(r => r.key);
  ok(rules.indexOf('空破并见') === 0, '「空破并见」必须排在最前,实得次序:' + rules.join('>'));
  for (const k of ['旬空', '月破', '入墓', '合住', '太旺', '化进神', '化退神']) {
    ok(rules.indexOf(k) < rules.indexOf('动而逢合逢值'), `${k} 应排在通则「动而逢合逢值」之前`);
  }
  ok(rules.indexOf('动而逢合逢值') < rules.indexOf('静而逢值逢冲'), '动通则在静通则之前(动者事急)');
});

console.log('【四】两解取先到:这是 v0.74 月破立下、v0.89 推广到全部的不变量');
t('凡有 others 的,选中的日子必不晚于备选的日子', () => {
  let n = 0;
  for (let d = 0; d < 12; d++) {
    const from = new Date(2026, 0, 5 + d * 30, 10, 0);
    for (const id of IDS.slice(0, 32)) for (const mv of [[], [2], [1, 3, 5]]) {
      const r = Yingqi.yingqiOf(castOf(id, mv), from);
      if (!r || !r.date || !r.others || !r.others.length) continue;
      const toN = s => { const [y, m, dd] = s.replace(/[年月]/g, '-').replace('日', '').split('-').map(Number); return y * 10000 + m * 100 + dd; };
      for (const o of r.others) ok(toN(r.date) <= toN(o.date), `${r.state}:选了 ${r.date},可备选 ${o.date} 更早`);
      n++;
    }
  }
  ok(n >= 200, '两解样本太少:' + n);
});
t('月破的两解都活着,且比例大体各半(v0.74 的旧钉子,不许被重构弄丢)', () => {
  let he = 0, shi = 0, n = 0;
  for (let d = 0; d < 120; d++) {
    const from = new Date(2026, 0, 1 + d * 3, 10, 0);
    for (const id of IDS.slice(0, 16)) for (const mv of [[], [2], [1, 3, 5]]) {
      const r = Yingqi.yingqiOf(castOf(id, mv), from);
      if (r && r.state === '月破') { n++; r.which === '合' ? he++ : shi++; }
    }
  }
  ok(n >= 100, '月破样本太少:' + n);
  ok(he > 0 && shi > 0, `有一解成了死分支:合 ${he} / 实 ${shi}`);
  ok(Math.abs(he - shi) / n < 0.3, `两解比例失衡:合 ${he} / 实 ${shi}——取「先到」的话应大体各半`);
});
t('逢合取的那个支,真是本支的六合之支', () => {
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  let n = 0;
  for (let d = 0; d < 60; d++) {
    const from = new Date(2026, 0, 1 + d * 5, 10, 0);
    for (const id of IDS.slice(0, 24)) {
      const r = Yingqi.yingqiOf(castOf(id, [2]), from);
      if (!r || r.state !== '月破' || r.which !== '合') continue;
      eq(r.targetZhi, LIUHE[r.zhi], `${r.zhi}的六合应是${LIUHE[r.zhi]}`);
      n++;
    }
  }
  ok(n >= 10, '逢合样本太少:' + n);
});

console.log('【五】答案之锚:同一卦同一时刻,结论必须只有一个');
t('反复算一百次,结果完全一致(不许有随机)', () => {
  const cast = castOf(IDS[7], [1, 4]);
  const first = JSON.stringify(Yingqi.yingqiOf(cast, FROM));
  for (let i = 0; i < 100; i++) eq(JSON.stringify(Yingqi.yingqiOf(cast, FROM)), first, '第' + i + '次不一致');
});
t('算出来的日子,其地支真的是该法要求的那个支', () => {
  let n = 0;
  for (const id of IDS.slice(0, 24)) for (const mv of [[], [3]]) {
    const r = Yingqi.yingqiOf(castOf(id, mv), FROM);
    if (!r || !r.date) continue;
    const [y, m, d] = r.date.replace(/[年月]/g, '-').replace('日', '').split('-').map(Number);
    eq(Najia.ganZhi(new Date(y, m - 1, d, 12)).dayZhi, r.targetZhi,
      `${r.state}:算出 ${r.date},但那天不是${r.targetZhi}日`);
    n++;
  }
  ok(n >= 20, '有效样本太少:' + n);
});

console.log('【六】诚实:优先级是本项目排的,必须写明;证据强弱不许混着说');
t('每次输出都带一句「这个先后是我排的,原文没有明列」,并写明总注章是清单不是先后表', () => {
  const r = Yingqi.yingqiOf(castOf(IDS[0], [2]), FROM);
  ok(r.note && /本项目定的|我自己担着/.test(r.note), '缺优先级来源说明:' + (r && r.note));
  ok(/原文没有明列/.test(r.note), '须写明原文没有优先级表');
  ok(/清单不是先后表/.test(r.note), '须写明总注章是状态清单,不能当优先级用');
});
t('旬空「冲」那一解的证据强度差,必须当面写着(细法章只示范了填)', () => {
  const src = readFileSync(join(ROOT, 'yingqi.js'), 'utf8');
  ok(/证据强度不一样|证据强度差/.test(src), '旬空两解证据不等,源码里要写明');
  ok(/收窄不放大/.test(src), '太旺例子的亥子宽读收窄成题头两解,要写明');
  ok(/自拟/.test(src), '「同类爻太多」的门槛是自拟的,要写明');
});
t('源码里写明了哪些墓库对应核过、哪些没核过', () => {
  const src = readFileSync(join(ROOT, 'najia.js'), 'utf8');
  ok(/火墓戌、水墓辰这两味原文里直接核得到/.test(src), 'najia 须写明哪两味核过');
  ok(/出处待核/.test(src), '核不了的须标出处待核');
});
t('断语里不出现术语堆砌——说的是人话(全部 which 的说法都查)', () => {
  const BAN = /用神|六亲|世应|纳甲|旬空之爻|月破之爻|十神/;
  for (const r of Yingqi.YQ_RULES) {
    const talks = Object.values(r.talk || {});
    ok(talks.length > 0, `「${r.key}」没有说法`);
    for (const s of talks) {
      ok(!BAN.test(s), `「${r.key}」的说法带术语:${s}`);
      ok(s.length >= 12, `「${r.key}」的说法太短,等于没说:${s}`);
    }
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
