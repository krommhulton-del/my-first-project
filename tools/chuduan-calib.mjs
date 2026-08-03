// 程序初断的分档校准器:node tools/chuduan-calib.mjs [卦数]
//
// 缘起:chuduan.js 把「用神旺衰 + 空破墓 + 用神对世爻的生克 + 动爻生克」合成一个成算分。
// 权重是本项目定的,古籍没有分数表。既然是自己定的,就必须知道这套权重实际会把分数打到哪个区间——
// 初版拍脑袋按 0 分居中排档,结果:中位数其实是 -1.3(七档里五档在负区,53% 的卦被判「不成」,
// 比卦面悲观,犯铁律七),而最高一档四百卦一次都没触发,是条死条。
//
// 规矩:**凡改动 chuduan.js 的权重,必须重跑这个工具,把新的分位数写回 BANDS 的注释里。**
// 否则分档就跟权重脱节,程序会悄悄变得偏乐观或偏悲观而没人知道。
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GuaCore = require(join(ROOT, 'gua-core.js'));
const Najia = require(join(ROOT, 'najia.js'));
const Chuduan = require(join(ROOT, 'chuduan.js'));

const N = Number(process.argv[2]) || 20000;
// 八类问法各占一份,免得只拿一种用神(比如只问财)校准出偏门的门槛
const QS = ['我今年能不能换成工作?', '这笔钱能不能收回来?', '他会不会跟我复合?', '孩子这次考得上吗?',
  '这房子买得成吗?', '这病治得好吗?', '能不能生个孩子?', '合伙这事靠谱吗?'];
const CUTS = [0.08, 0.22, 0.40, 0.60, 0.78, 0.92];

// **必须跨日子抽样。** 头一版全在「今天」抽,量出来的分位数只对今天成立——
// 日月干支一换,同一副卦的分数就挪位。实测同一套权重在单日上能差出 6 个百分点的成/不成失衡,
// 而跨一年抽样就落回 3 个点以内。分档门槛是长期使用的,自然要按长期分布来定。
const scores = [];
const bandCount = {};
const DAYS = 120;                                  // 一年里每隔三天取一天
for (let i = 0; i < N; i++) {
  const day = new Date(2026, 0, 1 + (i % DAYS) * 3, 10, 0);
  const cast = GuaCore.castHexagram();
  const z = Najia.zhuangGua(cast.benId, day, { moving: cast.lines.map(l => l.moving), bianId: cast.bianId });
  const r = Chuduan.judge(cast, z, QS[i % QS.length], day);
  scores.push(r.score);
  bandCount[r.pct] = (bandCount[r.pct] || 0) + 1;
}
scores.sort((a, b) => a - b);
const q = p => scores[Math.floor(p * scores.length)];
const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

console.log(`样本 ${N} 卦(八类问法轮流)`);
console.log(`最低 ${scores[0]}  中位 ${q(0.5)}  最高 ${scores[scores.length - 1]}  均值 ${mean.toFixed(2)}`);
console.log('\n建议门槛(把这几个数写回 chuduan.js 的 BANDS):');
CUTS.forEach(p => console.log(`  ${String(p * 100).padStart(5)}% → ${q(p)}`));

console.log('\n当前分档实得比例:');
const order = Chuduan.BANDS.map(b => b.pct);
for (const pct of order) {
  const n = bandCount[pct] || 0;
  const share = n / N;
  const bar = '█'.repeat(Math.round(share * 60));
  console.log(`  ${pct.padEnd(6)} ${(share * 100).toFixed(1).padStart(5)}%  ${bar}${n === 0 ? '  ← 死条!这一档永远触发不到' : ''}`);
}
const dead = order.filter(p => !bandCount[p]);
const cheng = Object.entries(bandCount).filter(([k]) => ['八九成', '七成上下'].includes(k)).reduce((a, [, v]) => a + v, 0);
const bu = Object.entries(bandCount).filter(([k]) => ['两成上下', '一成不到'].includes(k)).reduce((a, [, v]) => a + v, 0);
console.log(`\n两头是否对称:说「成」${(cheng / N * 100).toFixed(1)}%,说「不成」${(bu / N * 100).toFixed(1)}%` +
  `(差得太多就是系统性偏乐观或偏悲观,犯铁律七)`);
if (dead.length) { console.log(`\n有死条:${dead.join('、')}`); process.exit(1); }
