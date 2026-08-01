// 从格 · 外部对照测试(不是内部一致性)
// —— 命例与判语全部出自 data/classics/滴天髓阐微.txt 的「从象」「假从」两章,不是我编的口径。
//
// 缘起:CLAUDE.md 待办第 5 条「从格复核:拿《滴天髓阐微》的从格论述,逐条复核 v0.54 那套双向称量的门槛」。
// v0.76 跑完这一遍,结果与整改都记在 docs/从格复核-01-滴天髓命例.md。这套测试守住三件事:
//   ① 十五盘的四柱与判语必须真在原文里(防我抄错、防以后有人凭记忆改)
//   ② 已经判对的那几盘不许再判错(防回归)
//   ③ 判不对的那几盘照实钉住——**它们现在就是错的**,这几条断言写的是「现状」不是「应然」,
//      将来修好了这几条会红,那是提醒该改本文件,不是故障。
import Bazi from '../bazi.js';
import { CASES } from '../tools/cong-check.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

function judge(four, days = 15) {
  const gz = four.match(/.{2}/g), pillars = {};
  ['year', 'month', 'day', 'hour'].forEach((k, i) => { pillars[k] = { gz: gz[i], gan: gz[i][0], zhi: gz[i][1] }; });
  const st = Bazi.judgeStrength(pillars, pillars.day.gan, days);
  const cong = Bazi.judgeCong(st, pillars, pillars.day.gan);
  return { st, type: cong ? cong.type : '不从' };
}

console.log('【一】命例抄录:必须真出自原文');
t('十五盘四柱与判语,逐条在《滴天髓阐微》里搜得到', () => {
  const raw = readFileSync(join(ROOT, 'data', 'classics', '滴天髓阐微.txt'), 'utf8').replace(/\s/g, '');
  eq(CASES.length, 15, '命例条数');
  for (const [four, , quote] of CASES) {
    ok(raw.includes(four), `${four} 在原文里搜不到这一盘`);
    ok(raw.includes(quote.replace(/\s/g, '')), `${four} 的判语在原文里搜不到`);
  }
});

console.log('【二】判对的不许再判错(回归闸门)');
// 这四盘现在与原文一致,是本次复核的成果线,退步即红。
// 留神:命例只给四柱不给日期,人元司令天数一律按中值 15 天填。这个数不是无关紧要的——
// 「辛巳辛丑乙酉乙酉」在距节气 1–9 日判假从、10 日以后才判从弱(丑月头九天癸水司令,癸正是乙木的印)。
// 也就是说那一盘判对有一半功劳在这个 15。已记在 docs/从格复核-01-滴天髓命例.md 第五节。
for (const [four, want] of [
  ['辛巳辛丑乙酉乙酉', '从弱'],   // 从杀斯真
  ['癸酉乙丑丙申丙申', '从弱'],   // 从化金水之势
  ['癸卯乙卯甲寅乙亥', '从强'],   // 从其旺神
  ['丙午甲午丙午甲午', '从强'],   // 四柱皆刃,强旺极矣(v0.76 才判对)
]) t(`${four} 应判${want}`, () => eq(judge(four).type, want));

console.log('【三】v0.76 的整改本身:从强只称财与官杀,不把食伤算作破从');
t('《滴天髓》从旺样板「丙午甲午丙午甲午」:食伤(己土)占两成多,仍须判从强', () => {
  const { st, type } = judge('丙午甲午丙午甲午');
  ok(st.detail.食伤 > 15, '这盘的食伤确实不轻,才有对照意义:' + st.detail.食伤);
  eq(st.detail.财 + st.detail.官杀, 0, '这盘财与官杀应为零');
  eq(type, '从强');
});
t('财或官杀一旦有气,即便同党极旺也不作从强', () => {
  // 反面对照:拿上一盘换掉时干,添一点财(庚金),从强即应落空
  ok(judge('丙午甲午丙午庚寅').type !== '从强', '有财透干仍判从强');
});

console.log('【四】仍判不对的,照实钉住(这几条写的是现状,不是应然)');
// 详见 docs/从格复核-01-滴天髓命例.md 第三节:病根都在「印比的力量不看它自己是否死绝、被合、被克」
for (const [four, note] of [
  ['戊戌丙辰乙未丙戌', '原文「四柱皆财,其势必从」,程序因辰未两库根判不从'],
  ['壬寅壬寅庚寅戊寅', '原文「戊土虽生犹死」,程序把这点印算了 19 分'],
  ['丙寅庚寅壬午乙巳', '原文「一点庚金临绝」,程序把这点印算了 14 分'],
  ['丁卯壬寅庚午丙戌', '原文丁壬合化木、绝无生扶,程序不会合化'],
  ['丙戌壬辰癸巳甲寅', '原文「日主休囚无根」,程序认辰中癸为根'],
  ['癸酉癸亥庚申丁亥', '原文作「从气」,程序无此一格'],
]) t(`${four} 目前判不对(${note})`, () => {
  const { type } = judge(four);
  ok(type !== '从弱' && type !== '从强', '这盘居然判对了——该改测试与文档了,不是故障');
});

console.log('【五】从格仍须是稀有格局(整改不许把闸门放松)');
t('人群实测:真从(从弱+从强)占比不超过 5%', () => {
  let n = 0, zhen = 0;
  for (let i = 0; i < 4000; i++) {
    const d = new Date(Date.UTC(1950, 0, 1) + i * 7 * 86400000);
    const b = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (i % 12) * 2 + 1, 30);
    const c = Bazi.chart(b, i % 2 ? '男' : '女', 116.4); n++;
    if (c.cong && c.cong.type !== '假从') zhen++;
  }
  const pct = zhen / n * 100;
  ok(pct < 5, '真从占比=' + pct.toFixed(2) + '%');
  ok(pct > 0.5, '真从占比=' + pct.toFixed(2) + '%——低到这个地步说明闸门锁死了,反而不对');
  console.log(`      (实测真从占比 ${pct.toFixed(2)}%)`);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
