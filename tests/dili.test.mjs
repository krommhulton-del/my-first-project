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
t('坐标全在中国范围(纬度15-54,经度73-136,含三沙)', () => {
  for (const p of Dili.PLACES) ok(p[1] > 15 && p[1] < 54 && p[2] > 73 && p[2] < 136, p[0]);
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

console.log('【五】全国市州库与四层断法');
const Bazi = require('../bazi.js');
t('库容:330处以上、无重名、全在国境', () => {
  ok(Dili.PLACES.length >= 330, '库容=' + Dili.PLACES.length);
  const names = Dili.PLACES.map(p => p[0]);
  eq(new Set(names).size, names.length, '无重名');
  for (const p of Dili.PLACES) ok(p[1] > 16 && p[1] < 54 && p[2] > 73 && p[2] < 136 && !isNaN(p[1]) && !isNaN(p[2]), p[0]);
});
t('地级市抽查全认识:泉州南通潍坊临沂保定绵阳遵义大理襄阳赣州西双版纳恩施', () => {
  for (const n of ['泉州', '南通', '潍坊', '临沂', '保定', '绵阳', '遵义', '大理', '襄阳', '赣州', '西双版纳', '恩施', '延边朝鲜族自治州', '湘西土家族苗族自治州']) ok(Dili.find(n), n);
});
t('新城方位铁案:武汉→襄阳西北、广州→汕头正东、成都→绵阳东北', () => {
  const d = (a, b) => Dili.dirOf(Dili.bearing(Dili.find(a), Dili.find(b)));
  eq(d('武汉', '襄阳'), '西北');
  eq(d('广州', '汕头'), '正东');
  eq(d('成都', '绵阳'), '东北');
});
t('内置神煞表与 bazi.js 口诀逐项一致(防两处抄错)', () => {
  for (const g of '甲乙丙丁戊己庚辛壬癸') eq(Dili.TIANYI[g], Bazi.TIANYI[g], '天乙' + g);
  for (const z of '子午卯酉') {
    const i = Dili.sanheIdx(z);
    eq(Dili.YIMA[i], Bazi.YIMA[Bazi.sanheIdx(z)], '驿马' + z);
    eq(Dili.TAOHUA[i], Bazi.TAOHUA[Bazi.sanheIdx(z)], '桃花' + z);
  }
});
t('四层断法:甲日主午年生人,西南向兼驿马+贵人;2026丙午年正北犯岁破', () => {
  const c = { dayGan: '甲', yong: { xiWx: ['土', '金'], jiWx: ['水', '木'] }, pillars: { year: { zhi: '午' } } };
  const r = Dili.judge(c, '北京', '成都', '午'); // 成都在京西南
  ok(['西南', '正西'].includes(r.dir), '京→蓉:' + r.dir);
  if (r.dir === '西南') {
    ok(r.extras.some(x => x.includes('驿马')), '午年驿马申=西南:' + r.extras.join(';'));
    ok(r.extras.some(x => x.includes('贵人')), '甲贵人未=西南');
  }
  const rn = Dili.judge(c, '广州', '北京', '午'); // 正北=子方,午年岁破
  ok(rn.extras.some(x => x.includes('岁破')), '岁破应示警:' + rn.extras.join(';'));
});
t('挑旺地带城市清单与徽记字段', () => {
  const c = { dayGan: '甲', yong: { xiWx: ['土', '金'], jiWx: ['水', '木'] }, pillars: { year: { zhi: '午' } } };
  const r = Dili.recommend(c, '武汉', 8, '午');
  ok(r.cities.length >= 3, '旺方城市应有货');
  ok(r.good.every(g => typeof g.mark === 'string'), '徽记字段在');
  ok(r.suiNote.includes('岁破'), '流年注在');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
