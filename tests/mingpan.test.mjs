// 命盘细读专项内测(v1.00,板块 B′)
// 缘起:用户 2026-08-02「你这个八字的解读太少太少了…要深入的做…我们要做的是金砖」。
// 摸家底量出来:chart 算得很厚,而十神组合、四柱宫位、六亲、性格、健康、大运主题一条都没有。
// 这套测试守五件事:
//   一、**外部对照**:每条规则的引文逐字在所标那本书里搜得到(五本都是简体转录,照原貌);
//   二、死条穷举:每个组合、每个宫位判语、六亲四路、健康两档,在大样本里都触发得到;
//   三、**依据与结论同向**(本项目明令禁止「引文说 A、判语说 B」)——
//       食神制杀那一条头一版就栽在这:原文写着「身杀两停」,而程序不查两停,
//       于是身弱杀重的盘被判成「压得住」。现在两条互斥,逐盘查;
//   四、同一副盘的各层不许自相矛盾(宫位说顺、六亲说耗,是头一版的真 bug);
//   五、措辞过体检员(禁术语/空话/说教/装腔),§四 结构不自算断法。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const Mingpan = require(join(ROOT, 'mingpan.js'));
const Tijian = require(join(ROOT, 'tijian.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const strip = x => x.replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒]/g, '').replace(/<[^>]*>/g, '');
const SRC = readFileSync(join(ROOT, 'mingpan.js'), 'utf8');
const BOOK = {};
for (const b of ['渊海子平', '三命通会', '子平真诠', '滴天髓阐微', '穷通宝鉴'])
  BOOK[b] = strip(readFileSync(join(ROOT, 'data', 'classics', b + '.txt'), 'utf8'));
const chartOf = (y, mo, d, h, g) => Bazi.chart(new Date(y, mo - 1, d, h, 30), g, { lon: 116.4 });

console.log('【一】外部对照:每条引文逐字在所标那本书里搜得到');
t('源码里每一处 quote 都核回原书(五本简体转录,照原貌)', () => {
  const hits = [...SRC.matchAll(/quote: '([^']+)', src: '([^']+)'/g)]
    .concat([...SRC.matchAll(/'([^']{6,60})', '(渊海子平|三命通会|子平真诠|滴天髓阐微|穷通宝鉴)'/g)]);
  const seen = new Set(), bad = [];
  for (const [, q, src] of hits) {
    if (seen.has(q + src)) continue; seen.add(q + src);
    const book = Object.keys(BOOK).find(b => src.startsWith(b));
    if (!book) { bad.push(`「${q}」认不出书名:${src}`); continue; }
    if (!BOOK[book].includes(strip(q))) bad.push(`《${book}》里搜不到「${q}」`);
  }
  ok(hits.length >= 16, '挂引文的规则太少:' + hits.length);
  ok(!bad.length, '核不到:\n      ' + bad.join('\n      '));
  console.log(`      (核了 ${seen.size} 条引文,涉五本古籍)`);
});
t('宫位、六亲、健康三层的原话都在源码里,且是那三本的明文', () => {
  for (const [q, b] of [['年为祖上，月为父母伯叔兄弟门户，日为妻妾己身', '渊海子平'],
    ['以时为子息，临死绝之乡，言子少之断', '渊海子平'],
    ['日干为己身，日支为妻妾，则知妻妾之贤淑', '渊海子平'],
    ['比肩为兄弟姐妹也', '渊海子平'],
    ['五行和者，一世无灾', '滴天髓阐微'], ['血气乱者，生平多疾', '滴天髓阐微'],
    ['盖大运重地支，故有行东方、南方、西方、北方之辨', '三命通会']]) {
    ok(BOOK[b].includes(strip(q)), `《${b}》里搜不到「${q}」`);
    ok(SRC.includes(q), '源码里没挂这句:' + q);
  }
});

console.log('【二】死条穷举:每个分支都触发得到(1200 盘)');
const SAMPLE = [];
for (let i = 0; i < 1200; i++) {
  const c = chartOf(1955 + (i * 7) % 68, 1 + (i * 3) % 12, 1 + (i * 11) % 28, (i * 5) % 24, i % 2 ? '男' : '女');
  SAMPLE.push({ c, r: Mingpan.read(c, { age: 40 }) });
}
t('十四款组合、四个宫位、四路六亲、健康两档,都至少触发一次', () => {
  const seen = new Set();
  for (const { r } of SAMPLE) {
    for (const x of r.combos) seen.add('合:' + x.key);
    for (const p of r.palaces) { seen.add('宫:' + p.key); if (p.hit.length) seen.add('宫:刑冲'); }
    for (const k of r.kin) seen.add('亲:' + k.who);
    seen.add('健:' + (r.health.balanced ? '和' : '偏'));
    if (r.dayun.unknown) seen.add('运:未知'); else seen.add('运:有');
  }
  const need = ['合:杀重身轻', '合:食神制杀', '合:伤官佩印', '合:伤官见官', '合:财多身弱', '合:官印相生',
    '合:杀印相生', '合:枭神夺食', '合:伤官生财', '合:食神生财', '合:比劫分财', '合:印重无泄',
    '合:财官印俱全', '合:木火通明', '合:金水伤官', '合:年上伤官',
    '宫:year', '宫:month', '宫:day', '宫:hour', '宫:刑冲',
    '亲:父母', '亲:兄弟姐妹与同辈', '亲:配偶', '亲:子女', '健:和', '健:偏', '运:有'];
  const miss = need.filter(k => !seen.has(k));
  ok(!miss.length, '这些分支一次都没触发(死条):' + miss.join('、'));
  console.log(`      (1200 盘,${seen.size} 个分支全活)`);
});
t('组合不是恒触发也不是恒不触发:每款的出现率都在合理区间', () => {
  const cnt = {};
  for (const { r } of SAMPLE) for (const x of r.combos) cnt[x.key] = (cnt[x.key] || 0) + 1;
  for (const [k, v] of Object.entries(cnt)) {
    const rate = v / SAMPLE.length;
    ok(rate < 0.85, `${k} 触发率 ${(rate * 100).toFixed(0)}%——门槛太松,等于恒真`);
  }
  const list = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${(v / SAMPLE.length * 100).toFixed(0)}%`);
  console.log(`      (${list.join(' · ')})`);
});

console.log('【三】依据与结论同向:引文说什么,判语就得说什么');
t('食神制杀与杀重身轻互斥,且「食神制杀」只在真的身杀两停时才报', () => {
  // 缘起:头一版只查「有杀有食」就报「压得住」,而它引的原话是「身杀两停,则以食神制杀」——
  // 一副 比劫+印 14、七杀 51 的盘被判成压得住,引文与判语直接打架。
  for (const { c, r } of SAMPLE) {
    const keys = r.combos.map(x => x.key);
    ok(!(keys.includes('食神制杀') && keys.includes('杀重身轻')), '两条互斥却同报');
    const sp = Mingpan.shenPower(c);
    const ratio = sp.官杀 > 0 ? (sp.比劫 + sp.印星) / sp.官杀 : 99;
    if (keys.includes('食神制杀')) ok(ratio >= 0.6, `身/杀仅 ${ratio.toFixed(2)} 却报「压得住」——与「身杀两停」原文打架`);
    if (keys.includes('杀重身轻')) ok(ratio < 0.6, `身/杀 ${ratio.toFixed(2)} 已两停却报「杀重身轻」`);
  }
});
t('凶的组合必须报凶、吉的必须报吉——不许比原文乐观或悲观(铁律七)', () => {
  const MUST_BAD = ['伤官见官', '财多身弱', '枭神夺食', '比劫分财', '印重无泄', '年上伤官', '杀重身轻'];
  const MUST_GOOD = ['杀印相生', '官印相生', '财官印俱全'];
  for (const { r } of SAMPLE) for (const x of r.combos) {
    if (MUST_BAD.includes(x.key)) ok(x.tone === '凶', `${x.key} 该报凶,实报${x.tone}`);
    if (MUST_GOOD.includes(x.key)) ok(x.tone === '吉', `${x.key} 该报吉,实报${x.tone}`);
  }
});
t('第一句必须先报最要紧的那条,有凶先报凶(铁律二 + 铁律七)', () => {
  for (const { r } of SAMPLE.slice(0, 400)) {
    const bad = r.combos.filter(x => x.tone === '凶');
    if (bad.length) ok(r.verdict.includes(bad[0].title), '有凶却没先报:' + r.verdict.slice(0, 40));
    ok(r.verdict.length > 20, '第一句太短:' + r.verdict);
  }
});

console.log('【四】各层不许自相矛盾(头一版的真 bug:宫位说顺、六亲说耗)');
t('日柱宫位与配偶那一层,对同一个日支的方向判断必须一致', () => {
  for (const { c, r } of SAMPLE.slice(0, 500)) {
    const day = r.palaces.find(p => p.key === 'day');
    const pei = r.kin.find(k => k.who === '配偶');
    const zw = c.pillars.day.zhiWx;
    const jiZhi = c.yong.jiWx.includes(zw), xiZhi = c.yong.xiWx.includes(zw);
    // 日支耗你时,日柱那一句不许说「都是帮你的五行,顺」
    if (jiZhi) ok(!/天干地支都是帮你的五行/.test(day.plain), '日支耗你,日柱却说全是帮你的:' + day.plain);
    if (xiZhi) ok(!/天干地支都是耗你的五行/.test(day.plain), '日支帮你,日柱却说全是耗你的');
    if (jiZhi) ok(/耗你|方向相反/.test(pei.plain), '配偶那一层没照日支说');
  }
});
t('大运逐步:顺逆判语必须与地支喜忌同向(古书口径「大运重地支」)', () => {
  for (const { c, r } of SAMPLE.slice(0, 300)) {
    if (r.dayun.unknown) continue;
    for (const s of r.dayun.steps) {
      const zw = Bazi.ZHI_WX[s.gz[1]];
      if (c.yong.xiWx.includes(zw) && s.tone === '逆') ok(false, `${s.gz} 地支${zw}是喜用却判「逆」`);
      if (c.yong.jiWx.includes(zw) && s.tone === '顺') ok(false, `${s.gz} 地支${zw}是忌神却判「顺」`);
      if (s.tone === '顺') ok(/可以进取|机会成本最低/.test(s.plain), '判顺的话没说到位');
      if (s.tone === '逆') ok(/要守|不宜/.test(s.plain), '判逆的话没说到位');
    }
  }
});
t('性别没填:大运不硬排,并写明为什么', () => {
  const c = Bazi.chart(new Date(1988, 3, 12, 14, 30), '', { lon: 116.4 });
  const r = Mingpan.read(c, { age: 38 });
  ok(r.dayun.unknown && !r.dayun.steps.length, '性别未知竟排出了大运');
  ok(/性别/.test(r.dayun.note), '要写明为什么排不出:' + r.dayun.note);
  const pei = r.kin.find(k => k.who === '配偶');
  ok(/性别没填/.test(pei.plain), '配偶星那一层性别未知时不许硬断');
});

console.log('【五】措辞与结构');
t('全部给客人看的话过体检员:无术语、无空话、无说教、无装腔', () => {
  const seen = new Set();
  for (const { r } of SAMPLE) {
    const texts = [r.verdict, r.story, r.personality, r.health.plain, r.honest,
      ...r.combos.map(x => x.plain), ...r.palaces.map(p => p.plain),
      ...r.kin.map(k => k.plain), ...r.dayun.steps.map(s => s.plain), r.dayun.note];
    for (const s0 of texts) {
      if (!s0 || seen.has(s0.slice(0, 18))) continue; seen.add(s0.slice(0, 18));
      const s = String(s0).replace(/「[^」]*」/g, '');   // 引文照抄不改字,先剥再扫
      const rep = Tijian.check(s, {});
      const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
      ok(!bad.length, `体检不过:${s.slice(0, 34)}… → ${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
    }
  }
  console.log(`      (扫了 ${seen.size} 条不重样的话)`);
});
t('每条组合都给到「机制 + 做法或时间」,不是只有一句断言', () => {
  const seen = new Set();
  for (const { r } of SAMPLE) for (const x of r.combos) {
    if (seen.has(x.key)) continue; seen.add(x.key);
    ok(x.plain.length >= 60, `${x.key} 的话太短,只有断言没有内容:${x.plain}`);
    ok(/做法|落到|可控|对策|实处|选工作|破法|要留神|注意|留心/.test(x.plain), `${x.key} 没给做法:${x.plain.slice(0, 50)}`);
    ok(x.tech && x.quote && x.src, `${x.key} 缺推演依据或出处`);
  }
  ok(seen.size >= 12, '组合覆盖太少:' + seen.size);
});
t('material 写明程序已算死、带禁装腔铁规;HONEST 写明门槛自拟零回测', () => {
  const c = chartOf(1993, 6, 15, 10, '女');
  const m = Mingpan.material(c, { age: 33 });
  ok(/勿另立|勿改判/.test(m), '材料要写明程序已算死');
  ok(/装腔|市井腔/.test(m), '材料要禁装腔');
  ok(/十神组合/.test(m) && /四柱宫位/.test(m) && /六亲/.test(m) && /健康/.test(m), '材料缺块');
  ok(/门槛是本项目自拟|零回测/.test(Mingpan.HONEST), 'HONEST 要写明门槛自拟零回测');
});
t('§四 结构:不自算旺衰、用神、大运、神煞,只吃 chart', () => {
  ok(!/judgeStrength|pickYongShen|function\s+wuxingPower|computeDayun|function\s+shenShaOf/.test(SRC),
    'mingpan 不许自算断法元素');
  ok(/Bazi\.plainShen|Bazi\.SHEN_PLAIN/.test(SRC), '十神翻白话必须取自 bazi(只此一份)');
  ok(/Bazi\.shiShen/.test(SRC), '十神取法必须走 bazi');
});
t('答案之锚:同一副盘反复读五十次,逐字节一致', () => {
  const c = chartOf(1986, 9, 3, 15, '男');
  const first = JSON.stringify(Mingpan.read(c, { age: 40 }));
  for (let i = 0; i < 50; i++) ok(JSON.stringify(Mingpan.read(c, { age: 40 })) === first, '第' + i + '次不一致');
});

// ══════════════════════════════════════════════════════════════════
//  通盘(v1.15)
// ══════════════════════════════════════════════════════════════════
// 缘起:用户 2026-08-03「排盘问题解决就去解读,生辰矫正八字星盘需要大换血」。
// 量出来的病:用户一眼看到六块独立文本,其中只有 17% 提到「跟别处的关系」——
// 零件齐了,线没有。这一层负责串线,而串线最容易犯的错有四种,四条测试各盯一种:
//   ①「眼下」那一段静默消失(头一版照抄 dayunRead 去找 steps.now,而年表的 steps 没有这个字段);
//   ②对已经过去的年份发号施令(给 36 岁的人报「2010 年该出手的投入放这一年」);
//   ③姻缘那一类漏出聚散方向(v0.77 起的铁律);
//   ④并成一句话的大段(「1997–2056 这 60 年顺」等于没说)。
const Dashi = require(join(ROOT, 'dashi.js'));
const wholeOf = (y, mo, d, h, g, nowYear) => {
  const c = chartOf(y, mo, d, h, g);
  const tl = Dashi.timeline(c, { nowYear });
  return { c, tl, w: Mingpan.whole(c, tl, { nowYear }) };
};
const WSAMPLE = [];
for (let i = 0; i < 240; i++) {
  const y = 1945 + (i % 78), mo = 1 + (i % 12), d = 1 + ((i * 11) % 28), h = (i * 7) % 24;
  const s = wholeOf(y, mo, d, h, i % 2 ? '男' : '女', 2026);
  if (s.w && s.w.phases.length) WSAMPLE.push(s);
}

t('通盘:四档大运分段全触发得到,没有死条', () => {
  const lv = new Set();
  for (const { w } of WSAMPLE) for (const p of w.phases) lv.add(p.lv);
  for (const k of ['大顺', '底顺', '面顺', '逆']) ok(lv.has(k), `「${k}」这一档永不触发,是死条:实际只见到 ${[...lv].join('/')}`);
});
t('通盘:事型做法表逐条都触发得到,且不含年龄闸门挡死的那一类(死条穷举)', () => {
  const used = new Set();
  for (const { w } of WSAMPLE) for (const m of w.marks) used.add(m.key);
  const declared = [...SRC.matchAll(/^\s{8}(\w+): \['/gm)].map(x => x[1]);
  ok(declared.length >= 8, '做法表没抽到,正则该改了:' + declared.length);
  for (const k of declared) {
    ok(Object.keys(Dashi.CATS).includes(k), `做法表里的「${k}」不是年表的事型`);
    ok(used.has(k), `做法表里的「${k}」在 ${WSAMPLE.length} 副盘里一次都没触发,是死条`);
  }
  // 「家境父母」有意不列:它的节点全在童限,而这一层从 16 岁起看——
  // 这条断言把「有意不做」和「忘了做」分开,免得日后有人当漏项补回来。
  ok(Object.keys(Dashi.CATS).includes('jiajing'), '年表应有家境父母这一类');
  ok(!declared.includes('jiajing'), '家境父母不该进做法表(它的节点全在 16 岁以下)');
  ok(!used.has('jiajing'), '家境父母不该出现在大年里(年龄闸门 16 岁)');
});
t('通盘:「眼下」那一段必须出现(年表的 steps 不带 now,照抄会静默丢掉整段)', () => {
  let has = 0, tot = 0;
  for (const { w } of WSAMPLE) {
    const inRange = w.phases.some(p => 2026 >= p.fromYear && 2026 <= p.toYear);
    if (!inRange) continue;
    tot++;
    if (w.now && /眼下:/.test(w.story)) has++;
  }
  ok(tot > 20, '样本不够:' + tot);
  ok(has === tot, `${tot} 副盘里有 ${tot - has} 副落在大运区间内却没有「眼下」那一段`);
});
t('通盘:已经过去的年份不许给做法,只许拿来对账', () => {
  let past = 0;
  for (const { w } of WSAMPLE) for (const m of w.marks) {
    if (m.year >= 2026) { ok(!m.past, `${m.year} 不该标成过去`); continue; }
    past++;
    ok(m.past, `${m.year} 年在 2026 之前却没标成过去`);
    ok(/已经过去|对一对/.test(m.say), `对过去的年份发号施令:${m.say}`);
    ok(!/放这一年|排在这一年|就这一年|定下来/.test(m.say), `对过去的年份给了做法:${m.say}`);
  }
  ok(past > 50, '过去那一路样本太少:' + past);
});
t('通盘:姻缘那一类只报动、不报是聚是散(v0.77 铁律)', () => {
  let n = 0;
  for (const { w } of WSAMPLE) for (const m of w.marks) {
    if (m.key !== 'yinyuan') continue;
    n++;
    if (m.past) continue;
    ok(/不报是聚是散/.test(m.say), `姻缘那一条没带留白声明:${m.say}`);
    ok(!/该定的关系|定下来|分开|散了|必有波折|感情大吉/.test(m.say), `姻缘漏出了方向:${m.say}`);
  }
  ok(n > 10, '姻缘样本太少:' + n);
});
t('通盘:并了多步的大运段必须报出段内各步当家的力(不许把几十年说成一句话)', () => {
  let multi = 0;
  for (const { w } of WSAMPLE) for (const p of w.phases) {
    if (p.gzs.length < 2) continue;
    multi++;
    ok(/依次是|当家的是/.test(p.say), `并了 ${p.gzs.length} 步却没报段内变化:${p.say}`);
  }
  ok(multi > 30, '多步段样本太少:' + multi);
});
t('通盘:最得力那一段的远近必须当面说清(已走过 / 还有几年 / 正在其中)', () => {
  const kinds = new Set();
  for (const { w } of WSAMPLE) {
    ok(/已经走过|年之后|还有|正在这一段/.test(w.lead), `没说清最得力那一段的远近:${w.lead}`);
    kinds.add(/已经走过/.test(w.lead) ? '过' : /年之后/.test(w.lead) ? '远' : /还有/.test(w.lead) ? '近' : '在');
  }
  ok(kinds.size >= 3, '远近那几档没都触发到:' + [...kinds].join('/'));
});
t('通盘:话过体检员(禁术语/空话/说教/装腔),AI 腔不许回流', () => {
  const seen = new Set(); const scores = [];
  for (const { w } of WSAMPLE.slice(0, 60)) {
    // honest 也要扫:头一版漏了它,「喜忌」这个术语一路漏到界面上,是 e2e 逮住的(铁律八)
    for (const s of [w.lead, w.honest, ...w.phases.map(p => p.say), ...w.marks.map(m => m.say)]) {
      const f = Tijian.aiFlavor(s); if (f.n) scores.push(f.index);
      if (seen.has(s)) continue; seen.add(s);
      const rep = Tijian.check(String(s).replace(/「[^」]*」/g, ''), {});
      const bad = rep.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
      ok(!bad.length, `体检不过:${s.slice(0, 40)}… → ${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
    }
  }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  // 门槛是方向盘不是靶子(v1.06):只拦真回流,不逐分去追
  ok(avg <= 45, `AI 腔均值 ${avg.toFixed(1)} 偏高,回到清单体了`);
  console.log(`      (${seen.size} 条不重样,AI 腔均值 ${avg.toFixed(1)})`);
});
t('§四 通盘一个断法都不自算:喜忌/大运/大年全从外面吃进来', () => {
  const body = SRC.slice(SRC.indexOf('function whole('));
  ok(!/judgeStrength|pickYongShen|wuxingPower|shenShaOf|yearEvidence/.test(body), '通盘里不许出现断法函数');
  ok(/chart\.yong/.test(body) && /P\.steps/.test(body) && /P\.nodes/.test(body), '通盘必须从 chart.yong 与年表的 steps/nodes 取料');
  ok(/串法是本项目自拟的,零回测/.test(SRC), 'HONEST 要写明串法自拟零回测');
});
t('通盘:材料里带这条线,且注明按次序讲', () => {
  const { c, tl } = wholeOf(1990, 6, 15, 10, '男', 2026);
  const m = Mingpan.material(c, { age: 36, parts: tl, nowYear: 2026 });
  ok(/通盘这一条线/.test(m), '材料缺通盘那一条线');
  ok(/别打散成清单/.test(m), '材料没要求按次序讲');
  const m0 = Mingpan.material(c, { age: 36 });
  ok(!/通盘这一条线/.test(m0), '没喂年表就不该有通盘那一层(不许硬造)');
});
t('答案之锚:通盘同一副盘反复算二十次,逐字节一致', () => {
  const { c, tl } = wholeOf(1986, 9, 3, 15, '男', 2026);
  const first = JSON.stringify(Mingpan.whole(c, tl, { nowYear: 2026 }));
  for (let i = 0; i < 20; i++) ok(JSON.stringify(Mingpan.whole(c, tl, { nowYear: 2026 })) === first, '第' + i + '次不一致');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
