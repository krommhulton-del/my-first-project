// 格局法专项内测
// 缘起:程序此前只有扶抑法,没有格局法。2026-08《子平真诠》原文入库后补上这一层。
// 这套测试要守的第一件事,不是「断得准」(那考不了),而是「**说的每句话都真是书上的**」——
// 逐条拿 data/classics/子平真诠.txt 核 geju.js 里每一条规则的引文。
// 自测过程中揪出来的错,也各钉一条(见【二】),免得以后改回去。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Tijian from '../tijian.js';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const Geju = require(join(ROOT, 'geju.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };
// 原文用全角标点(，。、),而规则里写的是半角。比对前一律抹掉标点,只比字。
const strip = x => x.replace(/[\s，。、；：？！,.;:?!「」『』()()《》〈〉·…]/g, '');
const RAW = strip(readFileSync(join(ROOT, 'data', 'classics', '子平真诠.txt'), 'utf8'));

console.log('【一】外部对照:每一条规则的引文都要能在原文里搜到');
t('成败救应各条的引文,逐条在《子平真诠》里核得到', () => {
  const seen = new Set();
  let n = 0, bad = [];
  for (const [ge, rule] of Object.entries(Geju.RULES)) {
    if (!rule) continue;
    for (const kind of ['成', '败', '救', '忌']) {
      for (const r of rule[kind] || []) {
        if (seen.has(r.q)) continue;
        seen.add(r.q); n++;
        // 引文里的「…」表示节略,拆成片段分别核;圆括号内是我自己的按语,不算引文
        const body = r.q.replace(/\([^)]*\)/g, '');
        const parts = body.split(/…|\.\.\./).map(x => strip(x)).filter(x => x.length >= 4);
        // 光查「片段在不在」不够——复核时发现「伤官用财…只要身强而有根」两段在原文里
        // **相隔 10018 字**(前一段是在别的章匹配上的),测试却照样绿。
        // 所以还要查:各片段位置递增、且相邻间隔不超过 60 字(即节略只许发生在同一句之内)。
        let last = -1, okAll = true;
        for (const p of parts) {
          const i = RAW.indexOf(p, last + 1);
          if (i < 0) { bad.push(`${ge}·${kind}:「${p}」原文里搜不到`); okAll = false; break; }
          if (last >= 0 && i - last > 60) {
            bad.push(`${ge}·${kind}:「${r.q}」的片段相隔 ${i - last} 字,不是同一句`); okAll = false; break;
          }
          last = i;
        }
        void okAll;
      }
    }
  }
  ok(n >= 45, '规则条数太少,只有 ' + n);
  ok(!bad.length, `有 ${bad.length} 条引文在原文里搜不到:\n      ` + bad.join('\n      '));
  console.log(`      (共核了 ${n} 条不重复引文)`);
});
t('取格三句总纲的引文也核得到', () => {
  for (const d of [new Date(1985, 10, 3, 17, 30), new Date(1996, 7, 12, 19, 30), new Date(1990, 4, 20, 9, 30)]) {
    const g = Geju.takeGe(Bazi.chart(d, '女', 116.4));
    const parts = g.quote.split(/…/).map(x => strip(x)).filter(x => x.length >= 4);
    for (const p of parts) ok(RAW.includes(p), `取格引文搜不到:「${p}」`);
  }
});

t('每条救应都要真能触发——不许有永远进不了输出的死条', () => {
  // 缘起:复核时穷举 16384 种条件组合发现,七杀与阳刃两格的救应**一次都不可能输出**——
  // 因为我给「败」私加了条件,与救应的前提互斥(七杀败写了 !c.印,而救应恰要 c.印)。
  // 救应只在有败时才报,所以互斥就等于这条规则白写。
  const KEYS = ['官', '杀', '财', '印', '枭', '食', '伤', '食伤', '比劫', '官杀混', '月受伤', '有会合', 'strong', 'weak'];
  const combos = [];
  for (let m = 0; m < (1 << KEYS.length); m++) {
    const c = {}; KEYS.forEach((k, i) => c[k] = !!(m >> i & 1));
    c.rooted = () => c.印; c.wxOf = () => null; combos.push(c);
  }
  const dead = [];
  for (const [ge, R] of Object.entries(Geju.RULES)) {
    if (!R) continue;
    (R.救 || []).forEach((r, i) => {
      const live = combos.some(c => {
        let a = false; try { a = r.f(c, { dayWx: '木' }); } catch (e) { return false; }
        if (!a) return false;
        return (R.败 || []).some(x => { try { return x.f(c, { dayWx: '木' }); } catch (e) { return false; } });
      });
      if (!live) dead.push(`${ge}·救${i}「${r.q.slice(0, 20)}」`);
    });
  }
  ok(!dead.length, '这些救应永远进不了输出:\n      ' + dead.join('\n      '));
});

console.log('【二】自测揪出来的三处错,各钉一条');
t('比劫不可为用:月令余气透出的劫财,不许取成「劫财格」', () => {
  // 缘起:丙午日戌月,戌余气丁(劫财)透于时干,第一版取出个「劫财格」——八格里没这东西。
  // 原文:「日与月同,本身不可为用,必看四柱有无财官煞食透干会支,另取用神」
  const c = Bazi.chart(new Date(1985, 10, 3, 17, 30), '女', 113.3);
  const g = Geju.takeGe(c);
  ok(!/比肩格|劫财格/.test(g.name), '取出了不存在的格:' + g.name);
  const OK = ['正官格', '七杀格', '正财格', '偏财格', '正印格', '偏印格', '食神格', '伤官格', '建禄格', '月劫格', '阳刃格'];
  ok(OK.includes(g.name), '格名越界:' + g.name);
});
t('没病就不开药:未见败时不许列救应', () => {
  // 缘起:第一版出现过「未见成败」却同时列着救应。
  let n = 0;
  for (let y = 1960; y < 2000; y += 3) for (let m = 0; m < 12; m += 2) {
    const r = Geju.judge(Bazi.chart(new Date(y, m, 12, 10, 0), '男', 116.4));
    n++;
    if (!r.bai.length) eq(r.jiu.length, 0, `${y}-${m + 1} 无败却列了救应`);
  }
  ok(n > 50, '样本太少');
});
t('总纲与专章并存:不许拿专章的细则替掉总纲的条目', () => {
  // 缘起:补《论伤官》专章时我把总纲那四条替掉了,伤官格空转率反而从 58% 涨到 70%。
  // 两处都是原书的话,该并存。
  const q = Geju.RULES.伤官.成.map(x => x.q).join('|');
  ok(q.includes('伤官生财'), '总纲的「伤官生财」被替掉了');
  ok(q.includes('伤官用财'), '专章的「伤官用财」不在');
});

console.log('【三】分布:不许某一档压倒性地占满,也不许某个格取不出来');
t('十一个格都取得出来,且没有哪个格占掉三成以上', () => {
  const ge = {}; let n = 0;
  for (let y = 1950; y < 2005; y += 2) for (let m = 0; m < 12; m++) for (const h of [3, 9, 15, 21]) {
    const r = Geju.takeGe(Bazi.chart(new Date(y, m, 17, h, 30), (n % 2 ? '男' : '女'), 116.4));
    ge[r.name] = (ge[r.name] || 0) + 1; n++;
  }
  ok(Object.keys(ge).length >= 10, '取不出来的格太多,只见到 ' + Object.keys(ge).length + ' 种');
  for (const [k, v] of Object.entries(ge)) ok(v / n < 0.3, `${k} 占了 ${(v / n * 100).toFixed(0)}%,分布不正常`);
});
t('「未见成败」不许过半——过半说明规则太窄,等于白断', () => {
  let none = 0, n = 0;
  for (let y = 1950; y < 2005; y += 2) for (let m = 0; m < 12; m++) for (const h of [3, 9, 15, 21]) {
    const r = Geju.judge(Bazi.chart(new Date(y, m, 17, h, 30), (n % 2 ? '男' : '女'), 116.4));
    n++; if (r.state.startsWith('未见')) none++;
  }
  const rate = none / n;
  ok(rate < 0.5, `未见成败占 ${(rate * 100).toFixed(1)}%,规则太窄`);
  console.log(`      (未见成败 ${(rate * 100).toFixed(1)}%;这是照原文直译的结果,原文条件本就具体)`);
});

console.log('【四】口径:本模块只出一层结论,不许碰喜忌');
t('geju.js 不自己判旺衰、不自己取用神', () => {
  const src = readFileSync(join(ROOT, 'geju.js'), 'utf8');
  ok(!/judgeStrength|pickYongShen/.test(src), 'geju.js 不许自己实现旺衰或取用神');
  ok(/不改喜忌、不动用神/.test(src), '抬头须写明本模块不动喜忌');
});
t('同一副盘反复判,结论完全一致(程序算死,不许有随机)', () => {
  const c = Bazi.chart(new Date(1976, 2, 8, 14, 20), '男', 121.5);
  const a = JSON.stringify(Geju.judge(c)), b = JSON.stringify(Geju.judge(c));
  eq(a, b, '两次判定不一致');
});

console.log('【五】措辞:成稿不许带术语与空话');
t('白话结论里不出现十神、格局、干支这些字眼', () => {
  // 单个天干字会误伤(「自己」里就有个「己」),改查干支组合与术语词本身
  const BAN = /正官|七杀|偏财|正财|偏印|正印|食神|伤官|比肩|劫财|比劫|用神|喜忌|旺衰|格局|月令|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/;
  for (const k of Object.keys(Geju.RULES)) {
    // plain() 只吃 state,遍历所有可能的 state
  }
  for (const st of ['成', '败', '成中带忌', '败中有救', '成败交见', '成败交见,有救应', '未见成败(x)']) {
    const p = Geju.plain({ state: st });
    ok(!BAN.test(p), `白话里带了术语:${p}`);
    ok(!Tijian.check(p, { zone: '专业' }).hits.some(h => h.kind === '空话'), '白话里有空话:' + p);
  }
});
t('每条断语的白话也不许带术语——原话里留术语,白话里不许有', () => {
  // 缘起:第一版界面上出现「官杀混杂,需取清」这种话,客人看不懂。
  // 规矩:quote 是引文,术语照留;w 是给客人看的白话,一个术语都不许有。
  const BAN = /正官|七杀|偏财|正财|偏印|正印|食神|伤官|比肩|劫财|比劫|印星|官杀|用神|月令|旺衰|喜忌|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/;
  const bad = [];
  for (const rule of Object.values(Geju.RULES)) {
    if (!rule) continue;
    for (const kind of ['成', '败', '救', '忌'])
      for (const r of rule[kind] || []) if (BAN.test(r.w)) bad.push(r.w);
  }
  ok(!bad.length, '这些白话里带着术语:\n      ' + [...new Set(bad)].join('\n      '));
});
t('每个格都配了一句白话主线', () => {
  const seen = new Set();
  for (let y = 1950; y < 2005; y += 3) for (let m = 0; m < 12; m++) for (const h of [3, 15]) {
    const g = Geju.takeGe(Bazi.chart(new Date(y, m, 17, h, 30), '男', 116.4));
    ok(g.plain && g.plain.length > 8, g.name + ' 没配白话主线');
    seen.add(g.name);
  }
  ok(seen.size >= 10, '只见到 ' + seen.size + ' 个格');
});
t('交给 AI 的材料:算死了结论、禁了术语与空话、并写明本模块没做什么', () => {
  const c = Bazi.chart(new Date(1990, 4, 20, 9, 30), '男', 116.4);
  const m = Geju.material(c, Geju.judge(c));
  for (const k of ['勿另立结论', '本模块没做的', '第一句就把结论说死', '不许说']) ok(m.includes(k), '材料缺:' + k);
  ok(Geju.notDone.length >= 3, '没做的事项要列全');
  ok(/位置妥贴/.test(m), '「位置妥贴」判不了这件事必须写在材料里');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
