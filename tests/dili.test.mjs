// 内测:地利(方位合命选旺地) node tests/dili.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Dili = require('../dili.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】地名与坐标');
t('省份、城市、带后缀名皆可识别;胡写不认', () => {
  ok(Dili.find('广东'), '广东');
  ok(Dili.find('深圳'), '深圳');
  ok(Dili.find('广东省'), '带省字');
  ok(Dili.find('内蒙古自治区'), '自治区');
  ok(!Dili.find('亚特兰蒂斯'), '不存在之地');
});
t('坐标全在中国范围(纬度18-54,经度73-136)', () => {
  for (const p of Dili.PLACES) ok(p[1] > 17 && p[1] < 54 && p[2] > 73 && p[2] < 136, p[0]);
});

console.log('【二】方位角地理铁案');
t('北京→广州=正南,北京→乌鲁木齐=西偏北,上海→成都=正西,哈尔滨→海口=西南偏南,广州→北京=正北', () => {
  const d = (a, b) => Dili.dirOf(Dili.bearing(Dili.find(a), Dili.find(b)));
  eq(d('北京', '广州'), '正南');
  ok(['正西', '西北'].includes(d('北京', '乌鲁木齐')), '京→乌:' + d('北京', '乌鲁木齐'));
  eq(d('上海', '成都'), '正西');
  ok(['西南', '正南'].includes(d('哈尔滨', '海口')), '哈→海:' + d('哈尔滨', '海口'));
  eq(d('广州', '北京'), '正北');
  eq(d('西安', '上海'), '正东', '西安→上海');
});
t('距离量级合理:京广约1900km±15%,京津不足150km', () => {
  const km = Dili.distKm(Dili.find('北京'), Dili.find('广州'));
  ok(km > 1600 && km < 2200, '京广=' + km);
  ok(Dili.distKm(Dili.find('北京'), Dili.find('天津')) < 150, '京津');
});

console.log('【三】合命判定');
const chartFire = { yong: { xiWx: ['火', '木'], jiWx: ['金', '水'] } };
t('喜火木忌金水者(居北京):去广州大旺、去杭州旺、去乌鲁木齐背、去哈尔滨偏背', () => {
  eq(Dili.judge(chartFire, '北京', '广州').verdict, '大旺', '南=火为第一喜用');
  const hz = Dili.judge(chartFire, '北京', '杭州');
  ok(['旺', '大旺'].includes(hz.verdict), '杭州(东南木):' + hz.verdict);
  const wlmq = Dili.judge(chartFire, '北京', '乌鲁木齐');
  ok(['背', '偏背'].includes(wlmq.verdict), '乌鲁木齐(西金):' + wlmq.verdict);
  const bj = Dili.judge(chartFire, '广州', '北京');
  ok(['背', '偏背'].includes(bj.verdict), '广州北上(正北水,忌):' + bj.verdict);
  eq(Dili.judge(chartFire, '北京', '哈尔滨').verdict, '平', '哈尔滨在京东北属土,不喜不忌应判平');
});
t('同城不论方位:北京→天津之外,北京→北京城内判本地', () => {
  const r = Dili.judge(chartFire, '广州', '佛山');
  ok(r.local, '广佛应判本地:' + JSON.stringify(r));
  ok(r.note.includes('宅运'), '本地提示宅运');
});
t('判定齐全:方向/五行/公里数/断语都在', () => {
  const r = Dili.judge(chartFire, '北京', '广州');
  ok(r.dir === '正南' && r.wx === '火' && r.km > 0 && r.note.length > 8, JSON.stringify(r));
});

console.log('【四】挑旺地');
t('喜火木者居北京:荐地全在喜用方位、按距离排序、不含背方;避地全在忌方', () => {
  const r = Dili.recommend(chartFire, '北京', 8);
  ok(r.good.length >= 4, '荐地应有货,得' + r.good.length);
  for (const g of r.good) ok(r.goodDirs.includes(g.dir), g.name + '在' + g.dir);
  for (let i = 1; i < r.good.length; i++) ok(r.good[i - 1].km <= r.good[i].km, '按距离排序');
  for (const b of r.bad) ok(r.badDirs.includes(b.dir), '避地' + b.name);
  ok(!r.good.some(g => r.badDirs.includes(g.dir)), '荐避不打架');
});
t('换个命(喜金水忌火木)荐避大体对调', () => {
  const chartMetal = { yong: { xiWx: ['金', '水'], jiWx: ['火', '木'] } };
  const r1 = Dili.recommend(chartFire, '武汉', 8);
  const r2 = Dili.recommend(chartMetal, '武汉', 8);
  const n1 = new Set(r1.good.map(g => g.name));
  const overlap = r2.good.filter(g => n1.has(g.name)).length;
  ok(overlap <= 2, `两命荐地重合=${overlap},应大体对调`);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
