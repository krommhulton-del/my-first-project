// 跨模块口径一致性内测
// 缘起:同一天、同一个人,吉日历判「操心出力」,运势页日运判「大吉」——软件自己跟自己打架。
// 根子在 jiri.js 的「对你」层用的是一条死规矩(我生=泄=耗),不问身旺身弱、不问喜忌;
// 而 yunshi.js 的日运是按喜忌算的。身旺之人泄秀本是好事,一条死规矩把两种相反的命断成同一句。
// 本套件把「同一件事只能有一个口径」钉死:凡涉及本人喜忌的判断,各模块必须同尺同分。
import Bazi from '../bazi.js';
import Jiri from '../jiri.js';
import Yunshi from '../yunshi.js';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

const GAN_WX = Bazi.GAN_WX, ZHI_WX = Bazi.ZHI_WX;
// 运势页的干支喜忌权重:天干 1、地支 1.2(judgeCard 里的口径)
function ganzhiXiJiScore(yong, gan, zhi) {
  const xi = yong.xiWx, ji = yong.jiWx;
  let s = 0;
  const gw = GAN_WX[gan], zw = ZHI_WX[zhi];
  if (xi.includes(gw)) s += 1; else if (ji.includes(gw)) s -= 1;
  if (xi.includes(zw)) s += 1.2; else if (ji.includes(zw)) s -= 1.2;
  return +s.toFixed(1);
}

console.log('【一】择日「对你」层与运势页日运同一把尺');
t('两百组(生辰×日期):吉日历的干支喜忌分与运势页口径逐一相等', () => {
  let n = 0;
  for (let i = 0; i < 200; i++) {
    const by = 1950 + (i % 60), bm = i % 12, bd = (i % 27) + 1;
    const birth = new Date(by, bm, bd, ((i % 12) * 2 + 1), 30);
    const c = Bazi.chart(new Date(birth), i % 2 ? '男' : '女');
    const day = new Date(2026, (i * 7) % 12, ((i * 5) % 27) + 1, 12);
    const info = Jiri.dayInfo(day, birth, c.yong);
    ok(info.personal, '填了生辰就该有「对你」层');
    ok(info.personal.byYong, '有喜忌时必须走喜忌,不许退回粗判');
    const want = ganzhiXiJiScore(c.yong, info.gz.day[0], info.gz.day[1]);
    ok(Math.abs(info.personal.wx.score - want) < 0.01,
      `${info.iso} ${info.gz.day}:择日算${info.personal.wx.score},运势口径${want}`);
    n++;
  }
  ok(n === 200);
});
t('没有喜忌(未填生辰细节)时退回粗判,并且明明白白标出来', () => {
  const birth = new Date(1990, 4, 20, 12);
  const info = Jiri.dayInfo(new Date(2026, 6, 31, 12), birth, null);
  ok(info.personal && !info.personal.byYong, '无喜忌应标 byYong=false');
  ok(info.personal.wx.note.includes('粗判'), '粗判必须自报家门:' + info.personal.wx.note);
});
t('「我生」不再一律断成耗:身旺之人泄秀记吉、身弱之人才记耗', () => {
  // 身旺乙木(喜火土金)遇丙午火日 → 泄秀,记吉
  const wangYong = { xiWx: ['火', '土', '金'], jiWx: ['木', '水'] };
  const a = Jiri.dayInfo(new Date(2026, 6, 31, 12), new Date(2008, 0, 16, 12), wangYong);
  ok(a.personal.wx.score > 0, '身旺遇泄秀之日应记吉,实得' + a.personal.wx.score);
  // 身弱乙木(喜木水)遇同一天 → 火为忌,记凶
  const ruoYong = { xiWx: ['木', '水'], jiWx: ['火', '土', '金'] };
  const b = Jiri.dayInfo(new Date(2026, 6, 31, 12), new Date(2008, 0, 16, 12), ruoYong);
  ok(b.personal.wx.score < 0, '身弱遇火日应记凶,实得' + b.personal.wx.score);
  ok(a.personal.wx.score !== b.personal.wx.score, '两种相反的命不该断出同一句');
});

console.log('【二】两层分账:黄历归黄历、命理归命理');
t('黄历层 + 命理层 = 总分,一分不多一分不少', () => {
  for (let i = 0; i < 120; i++) {
    const birth = new Date(1960 + (i % 50), i % 12, (i % 27) + 1, 12);
    const c = Bazi.chart(new Date(birth), '男');
    const info = Jiri.dayInfo(new Date(2026, (i * 3) % 12, ((i * 7) % 27) + 1, 12), birth, c.yong);
    const sum = info.layers.almanac.score + info.layers.personal.score;
    ok(Math.abs(sum - info.score) < 0.01, `${info.iso}:黄历${info.layers.almanac.score}+命理${info.layers.personal.score}≠总${info.score}`);
  }
});
t('黄历层对谁都一样:换个人,建除值神星宿那一层的分文不动', () => {
  const day = new Date(2026, 6, 31, 12);
  const a = Jiri.dayInfo(day, new Date(1975, 3, 2, 12), { xiWx: ['火'], jiWx: ['水'] });
  const b = Jiri.dayInfo(day, new Date(1992, 10, 18, 12), { xiWx: ['水'], jiWx: ['火'] });
  const c = Jiri.dayInfo(day, null, null);
  eq(a.layers.almanac.score, b.layers.almanac.score, '黄历层不该因人而异');
  eq(a.layers.almanac.score, c.score, '没填生辰时,总分就等于黄历层');
});
t('无生辰时不硬造命理层', () => {
  const info = Jiri.dayInfo(new Date(2026, 6, 31, 12), null, null);
  eq(info.layers.personal, null);
  eq(info.personal, null);
});

console.log('【三】用户实报那一天:2026-07-31 丙午日,乙卯日主(丁亥癸丑乙卯壬午)');
t('该盘为偏旺、喜火土金,丙午火日于他是吉——两个板块必须同向', () => {
  const birth = new Date(2008, 0, 16, 12);          // 丁亥 癸丑 乙卯 壬午
  const c = Bazi.chart(new Date(birth), '男');
  eq(['year', 'month', 'day', 'hour'].map(k => c.pillars[k].gz).join(' '), '丁亥 癸丑 乙卯 壬午');
  eq(c.strength.band, '偏旺');
  ok(c.yong.xiWx.includes('火'), '偏旺乙木当喜火泄秀:' + c.yong.xiWx.join(''));
  const day = new Date(2026, 6, 31, 12);
  const ri = Yunshi.riYun(c, day);
  ok(ri.score > 0, '运势页日运应判吉,实得' + ri.score + '/' + ri.level);
  const info = Jiri.dayInfo(day, birth, c.yong);
  eq(info.gz.day, '丙午');
  ok(info.personal.wx.score > 0, '吉日历「对你」层应同为吉,实得' + info.personal.wx.score);
  ok(!info.personal.wx.note.includes('操心出力'), '不该再出现「操心出力」:' + info.personal.wx.note);
  ok(info.layers.personal.level === '旺你', '命理层应报旺你,实得' + info.layers.personal.level);
});
t('同一天的黄历层确实走低(闭日+黑道+凶宿),两层相左是实情不是错', () => {
  const birth = new Date(2008, 0, 16, 12);
  const c = Bazi.chart(new Date(birth), '男');
  const info = Jiri.dayInfo(new Date(2026, 6, 31, 12), birth, c.yong);
  eq(info.jianchu.name, '闭');
  eq(info.zhishen.huang, false, '天牢为黑道');
  eq(info.xiu.luck, '凶');
  ok(info.layers.almanac.score < 0, '黄历层应为负,实得' + info.layers.almanac.score);
  ok(info.layers.personal.score > 0, '命理层应为正');
});

console.log('【四】择吉挑日子也要按喜忌挑');
t('传了喜忌与不传,挑出的日子不该完全一样(说明喜忌真进了排序)', () => {
  const birth = new Date(2008, 0, 16, 12);
  const c = Bazi.chart(new Date(birth), '男');
  const withY = Jiri.pickDays('kaiye', new Date(2026, 6, 1), 60, birth, 5, c.yong).map(x => x.info.iso).join();
  const noY = Jiri.pickDays('kaiye', new Date(2026, 6, 1), 60, birth, 5, null).map(x => x.info.iso).join();
  ok(withY.length > 0, '应挑得出日子');
  ok(withY !== noY, `按喜忌挑与不按喜忌挑结果相同,说明喜忌没进排序:${withY}`);
});

console.log('【五】全应用只许有一个命盘出处(防再冒出第二把尺)');
t('index.html 里 Bazi.chart 只在 dxBirthChart 内部调用一次,各板块一律走它', () => {
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const calls = src.match(/Bazi\.chart\(/g) || [];
  eq(calls.length, 1, 'index.html 里出现了第二处排盘入口,喜忌会再次分家');
  const boards = ['xy', 'jr', 'q'];
  for (const b of boards) ok(src.includes(`dxBirthChart('${b}')`), `板块 ${b} 没走统一入口`);
});
t('凡用到喜忌的模块,都从 chart.yong 取,不各自另算', () => {
  for (const f of ['jiri.js', 'yunshi.js', 'dili.js', 'dashi.js']) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    ok(!/function\s+pickYongShen/.test(src), f + ' 里自己又实现了一套取用神');
    ok(!/judgeStrength\s*=\s*function|function\s+judgeStrength/.test(src), f + ' 里自己又实现了一套旺衰');
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
