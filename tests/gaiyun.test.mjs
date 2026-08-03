// 改运·运的行当专项内测(v0.91,板块 D)
// 缘起:用户 2026-08-02——「风水、穿戴、你去的城市、你身边的人、你的行业…都是可以改变运势的东西,
// 做一个运的行当」。策划书先把「不做什么」写死:不推荐花钱的东西(铁律五)、不讲道理不谈心态(铁律一)、
// 不承诺照做就能改运。这套测试守五件事:
//   一、§四:六条杠杆全部取自已有模块,gaiyun 一个断法不自算,表也不许另抄一份;
//   二、死条穷举:六条杠杆在各种盘下都触发得到,没有永远不出现的那条;
//   三、「不是疗效」那段话必须在(HONEST),每条杠杆必须标证据强度;
//   四、方向自洽:年表 dirSum 为负的年份必须是「守」,不许把凶年说成「动」(开发中真犯过,钉住);
//   五、措辞:禁花钱消灾词、禁心态说教、过体检员、缺性别缺年龄照实说。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const Bazi = require(join(ROOT, 'bazi.js'));
const Jiri = require(join(ROOT, 'jiri.js'));
const Dili = require(join(ROOT, 'dili.js'));
const Dashi = require(join(ROOT, 'dashi.js'));
const Gaiyun = require(join(ROOT, 'gaiyun.js'));
const Tijian = require(join(ROOT, 'tijian.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const SRC = readFileSync(join(ROOT, 'gaiyun.js'), 'utf8');
const NOW = new Date(2026, 7, 2);
const chartOf = (y, mo, d, h, g) => Bazi.chart(new Date(y, mo - 1, d, h, 30), g, { lon: 116.4 });

const SAMPLE = [];
for (let i = 0; i < 300; i++) {
  const c = chartOf(1960 + (i * 7) % 60, 1 + (i * 3) % 12, 1 + (i * 11) % 28, (i * 5) % 24, i % 2 ? '男' : '女');
  SAMPLE.push({ c, p: Gaiyun.plan(c, { age: 2026 - (1960 + (i * 7) % 60), now: NOW }) });
}

console.log('【一】§四:一个断法不自算,一张表不另抄');
t('gaiyun 不实现旺衰/用神/力量分,色与业的表逐字取自 jiri 与 dili', () => {
  ok(!/judgeStrength|pickYongShen|function\s+wuxingPower|function\s+shenPower/.test(SRC), '不许自算断法');
  ok(/Jiri\.WX_GOODS/.test(SRC) && /Dili\.YE/.test(SRC) && /Dili\.WX_DIRS/.test(SRC), '表必须取自源头模块');
  // 色杠杆输出的颜色必须与 WX_GOODS 逐字一致(防有人回头另抄一张表)
  const { c, p } = SAMPLE[0];
  const se = p.levers.find(l => l.key === 'se');
  for (const w of c.yong.xiWx) {
    ok(se.items.some(it => it.do_.includes(Jiri.WX_GOODS[w].colors)), `喜${w}的颜色没照 WX_GOODS 给:${Jiri.WX_GOODS[w].colors}`);
  }
});
t('地杠杆的方向逐字取自 Dili.WX_DIRS,喜忌两头各给各的', () => {
  const { c, p } = SAMPLE[1];
  const di = p.levers.find(l => l.key === 'di');
  for (const w of c.yong.xiWx) for (const d of Dili.WX_DIRS[w])
    ok(di.items[0].do_.includes(d), `旺向缺${d}(喜${w})`);
  for (const w of c.yong.jiWx) for (const d of Dili.WX_DIRS[w])
    ok(di.items[1].do_.includes(d) || di.items[0].do_.includes(d) === false, `避向缺${d}(忌${w})`);
});

console.log('【二】死条穷举:六条杠杆都在,都触发得到');
t('300 盘里六条杠杆条条在场、条条有货', () => {
  for (const { p } of SAMPLE) {
    const keys = p.levers.map(l => l.key);
    ok(JSON.stringify(keys) === JSON.stringify(['shi', 'di', 'se', 'ye', 'zhai', 'ren']),
      '六条杠杆的次序或数目不对:' + keys.join(','));
    for (const l of p.levers) ok(l.items.length >= 1, `「${l.name}」空了`);
  }
});
t('时杠杆的三种话(动/守/姻缘动量)都真出现过——没有死分支', () => {
  const seen = new Set();
  for (const { p } of SAMPLE) for (const it of p.levers[0].items) {
    if (/年宜动「/.test(it.do_)) seen.add('动');
    if (/年守——/.test(it.do_)) seen.add('守');
    if (/感情一事动得重/.test(it.do_)) seen.add('姻缘');
  }
  for (const k of ['动', '守', '姻缘']) ok(seen.has(k), `「${k}」那一款一次都没出现——死分支`);
});

console.log('【三】诚实:不是疗效,分量是证据强度');
t('HONEST 那段话在 plan 与 material 里都在,写明「依据不是疗效」', () => {
  const { c, p } = SAMPLE[2];
  ok(/依据,不是疗效/.test(p.honest), 'plan.honest 须写明不是疗效');
  ok(/没有一条验过/.test(p.honest), '须写明零验证');
  const m = Gaiyun.material(c, { age: 40, now: NOW });
  ok(/依据,不是疗效/.test(m) && /勿另立结论/.test(m), 'material 同样要带');
});
t('每条杠杆都标证据强度,且人那条必须写明自拟零回测、时那条写明弱相关样本小', () => {
  const { p } = SAMPLE[3];
  for (const l of p.levers) ok(l.strength && l.strength.length > 8, `「${l.name}」没标证据强度`);
  ok(/自拟|零回测/.test(p.levers.find(l => l.key === 'ren').strength), '人那条要认领自拟零回测');
  ok(/弱相关|样本小|不够格叫准/.test(p.levers.find(l => l.key === 'shi').strength), '时那条不许把回测说成准');
});

console.log('【四】方向自洽(开发中真犯过:凶年被说成「动」)');
t('年表 dirSum 为负的年份,在时杠杆里只许是「守」;dirSum 为正才许是「动」', () => {
  let checked = 0;
  for (const { c, p } of SAMPLE.slice(0, 120)) {
    const tl = Dashi.timeline(c);
    const byYear = {};
    for (const n of (tl.allNodes || [])) if (n.top) byYear[n.year] = n.top;
    for (const it of p.levers[0].items) {
      const m = it.do_.match(/^(\d{4}) 年(动|守)/);
      if (!m) continue;
      const top = byYear[+m[1]];
      if (!top) continue;
      if (m[2] === '动') ok(top.dirSum > 0, `${m[1]} 年 dirSum=${top.dirSum} 却说「动」`);
      if (m[2] === '守') ok(top.dirSum < 0, `${m[1]} 年 dirSum=${top.dirSum} 却说「守」`);
      checked++;
    }
  }
  ok(checked >= 30, '核到的年份太少:' + checked);
});

console.log('【五】措辞与边界');
t('铁律五:全部输出里不许出现任何花钱消灾的东西', () => {
  const BAN = /开光|法物|符咒|请购|风水摆件|转运珠|水晶|貔貅|付费|花钱化解/;
  for (const { c, p } of SAMPLE.slice(0, 100)) {
    const all = [p.honest, p.zhen.dayunLine, ...p.zhen.body,
      ...p.levers.flatMap(l => [l.name, l.strength, ...l.items.map(i => i.do_)])].join('\n');
    ok(!BAN.test(all), '出现花钱消灾之物:' + (all.match(BAN) || [])[0]);
  }
});
t('铁律一:不谈心态不讲道理——「保持积极」「相信自己」「心态」这类一个不许有', () => {
  const BAN = /保持积极|相信自己|心态|正能量|要学会|你要明白|与其.*不如/;
  for (const { p } of SAMPLE.slice(0, 100)) {
    const all = [p.honest, ...p.levers.flatMap(l => l.items.map(i => i.do_))].join('\n');
    ok(!BAN.test(all), '出现说教:' + (all.match(BAN) || [])[0]);
  }
});
t('杠杆动作过体检员(空话/说教/花钱消灾/术语四关)', () => {
  const seen = new Set();
  for (const { p } of SAMPLE) for (const l of p.levers) for (const it of l.items) {
    const k = it.do_.slice(0, 12); if (seen.has(k)) continue; seen.add(k);
    const r = Tijian.check(it.do_, {});
    const bad = r.hits.filter(h => ['空话', '说教', '花钱消灾', '术语', '装腔'].includes(h.kind));
    ok(!bad.length, `体检不过:${it.do_.slice(0, 28)}… → ${bad.map(h => h.kind + ':' + h.snippet).join(';')}`);
  }
});
t('缺性别:大运那层照实说排不了,杠杆照给;年龄没手填的按生日算(v0.83 的折法)', () => {
  const cg = Bazi.chart(new Date(1990, 4, 20, 9, 30), '', { lon: 116.4 });
  const pg = Gaiyun.plan(cg, { age: 36, now: NOW });
  ok(/性别没填/.test(pg.zhen.dayunLine), '缺性别要点名:' + pg.zhen.dayunLine);
  ok(pg.levers.every(l => l.items.length >= 1), '缺性别时六条杠杆也不许空');
  // 头一版测试要求「缺年龄照实说」——错的:盘里有生日,年龄就推得出来(v0.83:没手填的按生日算)。
  // plan 正是这么做的,「没有年龄」只是防御分支。这里钉正确行为:不传 age 也定位得了大运。
  const ca = chartOf(1990, 5, 20, 9, '男');
  const pa = Gaiyun.plan(ca, { now: NOW });
  ok(/这一路当家|还没起运/.test(pa.zhen.dayunLine), '不传 age 应按生日折算并定位大运:' + pa.zhen.dayunLine);
});
t('宅那条照实说「板块未建、另起一卦」,不硬造摆设建议', () => {
  const { p } = SAMPLE[4];
  const zhai = p.levers.find(l => l.key === 'zhai');
  ok(/起一卦/.test(zhai.items[0].do_), '宅要指到起卦那条正路');
  ok(/不必买任何东西/.test(zhai.items[1].do_), '要写明不必买东西');
  ok(/未建|排在队列/.test(zhai.items[0].tech + zhai.strength + zhai.from), '占宅未建这件事不许藏');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
