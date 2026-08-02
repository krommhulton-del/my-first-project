// 内测:程序初断(chuduan.js) node tests/chuduan.test.mjs
//
// 缘起:CLAUDE.md 第五节把「程序算死,AI 只解释」定为核心哲学,可自测发现五个卦阵板块
// 摆完卦一个结论都不给,断语全靠 AI——没 Key 的用户只看得到卦象。v0.70 补上这一层。
//
// 这套是**内部一致性测试**(证明程序不犯浑),不是外部对照测试(不证明断得准)。
// 事件层准不准,得靠 tools/backtest-events.mjs 那条路,不是这里。
//
// 守四件事:
//   一、同一卦同一时刻,结论必须只有一个(答案之锚——不许有随机);
//   二、七个分档一个都不许是死条,且说「成」与说「不成」的比例要对称(铁律七:不比卦面乐观或悲观);
//   三、每条理由都得是人话,不许术语堆砌(铁律八);
//   四、分数是本项目自己排的,必须自陈,不许冒充古法。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Tijian from '../tijian.js';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GuaCore = require(join(ROOT, 'gua-core.js'));
const Najia = require(join(ROOT, 'najia.js'));
const Chuduan = require(join(ROOT, 'chuduan.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

const QS = ['我今年能不能换成工作?', '这笔钱能不能收回来?', '他会不会跟我复合?', '孩子这次考得上吗?',
  '这房子买得成吗?', '这病治得好吗?', '能不能生个孩子?', '合伙这事靠谱吗?'];
const FROM = new Date(2026, 7, 2, 10, 0);
const mk = (seed) => {
  const cast = GuaCore.castHexagram();
  const z = Najia.zhuangGua(cast.benId, FROM, { moving: cast.lines.map(l => l.moving), bianId: cast.bianId });
  return { cast, z };
};

console.log('【一】答案之锚:一卦一时,只有一个结论');
t('同一卦反复断一百次,结果完全一致(不许有随机)', () => {
  const { cast, z } = mk();
  const first = JSON.stringify(Chuduan.judge(cast, z, QS[0], FROM));
  for (let i = 0; i < 100; i++) eq(JSON.stringify(Chuduan.judge(cast, z, QS[0], FROM)), first, '第' + i + '次不一致');
});
t('换个问法就换用神——同一卦问财与问官,取的不是同一样东西', () => {
  const { cast, z } = mk();
  const cai = Chuduan.judge(cast, z, '这笔钱能不能收回来?', FROM);
  const guan = Chuduan.judge(cast, z, '我这次升职有没有戏?', FROM);
  eq(cai.yongName, '妻财', '问钱应取妻财');
  eq(guan.yongName, '官鬼', '问功名应取官鬼');
});
t('所问不属六亲之一时退回世应法,不许当成「没抓手」一律判低', () => {
  // 缘起:初版对取不到用神的问法一律扣 2.5 分,而「他会不会跟我复合」这种
  // (问婚恋又没填性别)恰恰最常见,等于把一大批常见问法系统性判低。
  // najia 早把退法写死了:「以世爻为自身、应爻为对方论」——照它来。
  const { cast, z } = mk();
  const r = Chuduan.judge(cast, z, '他会不会跟我复合?', FROM);
  eq(r.yongName, null, '未填性别时取不到六亲用神');
  ok(r.byShiYing, '应转为世应法');
  ok(/世应法/.test(r.where), '须写明按世应论:' + r.where);
  ok(!r.why.some(w => /没有抓手/.test(w)), '世应法不该报「没抓手」:' + r.why.join(' | '));
  // 填了性别就该取到六亲用神
  const nv = Chuduan.judge(cast, z, '他会不会跟我复合?', FROM, '女');
  eq(nv.yongName, '官鬼', '女问婚恋取官鬼');
  ok(!nv.byShiYing, '取到用神就不该再走世应法');
});

console.log('【二】分档:七档都活着,两头对称(铁律七)');
t('一千卦扫下来,七个分档一个都不是死条', () => {
  const cnt = {};
  for (let i = 0; i < 1000; i++) {
    const { cast, z } = mk();
    const r = Chuduan.judge(cast, z, QS[i % QS.length], FROM);
    cnt[r.pct] = (cnt[r.pct] || 0) + 1;
  }
  const dead = Chuduan.BANDS.map(b => b.pct).filter(p => !cnt[p]);
  ok(!dead.length, '这些档永远触发不到(死条):' + dead.join('、') +
    '\n      实得分布:' + JSON.stringify(cnt));
});
t('说「成」与说「不成」的比例大体对称,不许系统性偏乐观或偏悲观', () => {
  // **必须跨日子抽样。** 头一版只在 2026-08-02 这一天抽两千卦,量出成 20.1% / 不成 13.8%,
  // 差 6.3 个点就判红——可那不是偏向,是**当天的日月干支本来就对某些用神有利**。
  // 分档门槛是拿一年里各种日子校准出来的,自然只能在跨日子的尺度上要求对称;
  // 拿单独一天去卡它,是我把测试写错了,不是程序有偏。
  // v0.98 又栽一回统计假红:2400 卦、6 点门槛离真实均值只有约 2.5σ,单跑假红率百分之零点几,
  // 全套天天跑就是隔三差五红一次(2026-08-02 发生一次,重跑即绿)。按 §三 的规矩收拾:
  // 样本翻倍到 4800(抽样差降到 ±0.9 点),门槛放到 7 点(≈均值+3σ,对应 0.001 显著性)——
  // 真有系统性偏向(铁律七)照样拦得住,随机抖动不再背锅。
  let cheng = 0, bu = 0, n = 0;
  for (let d = 0; d < 60; d++) {
    const day = new Date(2026, 0, 1 + d * 6, 10, 0);   // 一年里每隔六天取一天
    for (let i = 0; i < 80; i++) {
      const cast = GuaCore.castHexagram();
      const z = Najia.zhuangGua(cast.benId, day, { moving: cast.lines.map(l => l.moving), bianId: cast.bianId });
      const r = Chuduan.judge(cast, z, QS[i % QS.length], day);
      n++;
      if (r.cheng === '成') cheng++; else if (r.cheng === '不成') bu++;
    }
  }
  const gap = Math.abs(cheng - bu) / n;
  ok(gap < 0.07, `跨 60 天共 ${n} 卦:说成 ${(cheng / n * 100).toFixed(1)}%、说不成 ${(bu / n * 100).toFixed(1)}%,` +
    `差 ${(gap * 100).toFixed(1)} 个百分点——超过 7 个点(均值+3σ)就是系统性偏向,犯铁律七`);
  ok(cheng / n > 0.1 && bu / n > 0.1, `两头太少:成 ${cheng} 不成 ${bu}——只会说「悬」等于没断`);
});
t('分档门槛与 BANDS 的顺序自洽:分数越高档次越高', () => {
  const mins = Chuduan.BANDS.map(b => b.min);
  for (let i = 1; i < mins.length; i++) ok(mins[i - 1] > mins[i], '门槛必须严格递减:' + mins.join('>'));
  eq(Chuduan.bandOf(99).pct, '八九成');
  eq(Chuduan.bandOf(-99).pct, '一成不到');
  // 每个门槛线上下各取一点,档次必须真的换
  for (const b of Chuduan.BANDS.slice(0, -1)) {
    ok(Chuduan.bandOf(b.min).pct === b.pct, `${b.min} 应落在「${b.pct}」`);
    ok(Chuduan.bandOf(b.min - 0.01).pct !== b.pct, `${b.min} 往下一点应换档`);
  }
});

console.log('【三】说人话(铁律八)与理由完整');
t('每条理由都不带术语,且不许有空话', () => {
  // 缘起:头一版禁词表漏了六亲名本身,于是「兄弟动着来帮它」这句大摇大摆过了测试。
  // 六亲、旺衰状态字、爻位名——凡是术数里的名目,成稿里一个都不许有。
  const BAN = /用神|世应|旬空|月破|六亲|纳甲|十神|旺相休囚|飞伏|官鬼|妻财|父母爻|子孙|兄弟|世爻|应爻|[^不]旺相|休囚/;
  // 空话表取 tijian.js 那一份权威表(§四 一个口径一处算)
const KONG = new RegExp(Tijian.RULES['空话'].words.join('|'));
  for (let i = 0; i < 300; i++) {
    const { cast, z } = mk();
    const r = Chuduan.judge(cast, z, QS[i % QS.length], FROM);
    for (const w of r.why) {
      ok(!BAN.test(w), '理由里带术语:' + w);
      ok(!KONG.test(w), '理由里有空话:' + w);
      ok(w.length >= 8, '理由太短等于没说:' + w);
    }
    ok(!BAN.test(r.say), '结论带术语:' + r.say);
  }
});
t('每一卦都给得出:结论、几成、理由、应期', () => {
  for (let i = 0; i < 200; i++) {
    const { cast, z } = mk();
    const r = Chuduan.judge(cast, z, QS[i % QS.length], FROM);
    ok(r && r.cheng && r.pct, '结论缺项');
    ok(r.why.length >= 2, '理由少于两条:' + JSON.stringify(r.why));
    ok(r.yingqi && r.yingqi.date, '缺应期');
    ok(['成', '悬', '不成'].includes(r.cheng), '结论越界:' + r.cheng);
  }
});
t('用神不上卦时照实说,不许假装看见了', () => {
  let seenFu = 0, seenNone = 0;
  for (let i = 0; i < 600; i++) {
    const { cast, z } = mk();
    const r = Chuduan.judge(cast, z, QS[i % QS.length], FROM);
    if (r.where === '不上卦,取伏神') { seenFu++; ok(r.why.some(w => /藏在底下/.test(w)), '取伏神时须明说'); }
    if (r.where === '既不上卦、首卦亦无') { seenNone++; ok(r.why.some(w => /没抓手|找不着/.test(w)), '完全没有时须明说'); }
  }
  ok(seenFu > 0, '六百卦里没见过一次伏神,取法可能没接上');
});

console.log('【四】诚实:分数是本项目排的,必须自陈');
t('输出里带着「这个分是我自己排的」这句交代', () => {
  const { cast, z } = mk();
  const r = Chuduan.judge(cast, z, QS[0], FROM);
  ok(/本项目定的|本项目排的/.test(r.src), '缺自陈:' + r.src);
  ok(/给过分数表|没有分数表/.test(r.src), '须写明古籍没有分数表:' + r.src);
  // 这句是给客人看的,同样不许带术语(初版写成「用神旺衰、用神与世爻的生克」,被 e2e 抓到)
  ok(!/用神|世爻|应爻|旬空|月破/.test(r.src), '自陈这句话本身带了术语:' + r.src);
});
t('源码里不许给这套权重挂书名', () => {
  const src = readFileSync(join(ROOT, 'chuduan.js'), 'utf8');
  const books = src.match(/《[^》]{2,12}》/g) || [];
  ok(!books.length, 'chuduan.js 挂了书名,可这套权重是自拟的:' + books.join(' '));
  ok(/一个口径一处算|只此一份/.test(src), '须写明成算只此一份');
});
t('不自己另算断卦元素——旺衰、用神、应期一律走既有模块', () => {
  const src = readFileSync(join(ROOT, 'chuduan.js'), 'utf8');
  // 只许调 najia / yingqi,不许自己写月破、旬空、长生表之类
  ok(!/WANG_SCORE|CHANGSHENG|旬空表|const MU_OF/.test(src), 'chuduan 自己实现了断卦元素,违反一个口径一处算');
  ok(/Najia\.yongShenOf|Najia\.locateYong/.test(src), '用神取法须走 najia');
  ok(/Yingqi\./.test(src), '应期须走 yingqi');
});

console.log('【五】断语的因果链(v1.05,核心板块回炉收尾)');
t('断语五段齐:结论(几成)→这个数怎么来的→应期落到日→做法→只答这一问', () => {
  // 缘起:初断给的是四条并列观察 + 一个做法清单,谁也不接谁——读者看得见每一条,
  // 却拿不到「这几成是怎么算出来的」。
  const day = new Date(2026, 7, 3, 10, 0);
  let n = 0;
  for (let i = 0; i < 60; i++) {
    const cast = GuaCore.castHexagram();
    const z = Najia.zhuangGua(cast.benId, day, { moving: cast.lines.map(l => l.moving), bianId: cast.bianId });
    const r = Chuduan.judge(cast, z, QS[i % QS.length], day);
    const st = Chuduan.story(r, QS[i % QS.length]);
    n++;
    ok(st.length > 100, '断语太短:' + st);
    ok(/把握。/.test(st), '第一句要把几成说死(铁律三)');
    ok(/这个数是这么来的/.test(st), '缺「怎么算出来的」那一段——正是要治的病:' + st.slice(0, 60));
    ok(/三层叠起来/.test(st), '缺收束那一句');
    ok(/不比卦面多说半分/.test(st), '缺铁律七那句自陈');
    ok(/只答这一问/.test(st), '缺一枝一卦的边界(铁律四)');
    if (r.yingqi && r.yingqi.date) ok(st.includes(r.yingqi.date), '应期那一天没进断语');
    ok(!/。。|;;/.test(st), '标点重了:' + st.slice(0, 80));
    const rep = Tijian.check(st.replace(/「[^」]*」/g, ''), {});
    const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
    ok(!bad.length, `断语体检不过:${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
  }
  ok(n >= 60, '样本太少');
});
t('断语与初断同向:说成的不许写成不了,几成与 pct 一致(不许比卦面乐观悲观)', () => {
  const day = new Date(2026, 7, 3, 10, 0);
  for (let i = 0; i < 80; i++) {
    const cast = GuaCore.castHexagram();
    const z = Najia.zhuangGua(cast.benId, day, { moving: cast.lines.map(l => l.moving), bianId: cast.bianId });
    const r = Chuduan.judge(cast, z, QS[i % QS.length], day);
    const st = Chuduan.story(r, QS[i % QS.length]);
    const head = st.split('。')[0];
    if (r.cheng === '成') ok(/能成/.test(head) && !/成不了/.test(head), '程序判成,断语却不是:' + head);
    if (r.cheng === '不成') ok(/成不了/.test(head), '程序判不成,断语却不是:' + head);
    ok(st.includes(r.pct), '几成与初断给的不一致');
  }
});
t('答案之锚:同一卦同一时刻反复讲五十次,逐字一致', () => {
  const day = new Date(2026, 7, 3, 10, 0);
  const cast = GuaCore.castHexagram();
  const z = Najia.zhuangGua(cast.benId, day, { moving: cast.lines.map(l => l.moving), bianId: cast.bianId });
  const r = Chuduan.judge(cast, z, QS[0], day);
  const first = Chuduan.story(r, QS[0]);
  for (let i = 0; i < 50; i++) ok(Chuduan.story(Chuduan.judge(cast, z, QS[0], day), QS[0]) === first, '第' + i + '次不一致');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
