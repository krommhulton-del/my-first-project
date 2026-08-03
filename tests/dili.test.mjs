// 内测:地利(方位合命选旺地) node tests/dili.test.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
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
// 缘起:这条原本钉着「按距离排序」。v0.68 把排序改了——旧法按距离升序取前 8,
// 而库里混着县级市,结果永远是身边的小城(实测居武汉给的是黄石咸宁信阳,居上海给的是海门慈溪余姚),
// 榜单标题写着「大城市」却全是小城。新法按三层合分 + 城市能级加权排,距离只作同分时的次序。
// 「按距离排序」这条断言因此作废,改钉:荐地必须在喜用方位、合分为正、且不与避地打架。
t('喜火木者居北京:荐地全在喜用方位、合分为正、不含背方;避地全在忌方', () => {
  const r = Dili.recommend(chartFire, '北京', 8);
  ok(r.good.length >= 4, '荐地应有货,得' + r.good.length);
  for (const g of r.good) ok(r.goodDirs.includes(g.dir), g.name + '在' + g.dir);
  for (const g of r.good) ok(g.sum > 0, g.name + ' 合分应为正,得' + g.sum);
  for (let i = 1; i < r.good.length; i++) ok(r.good[i - 1].rank >= r.good[i].rank, '按合分降序');
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
  // v0.68 起榜单拆成四张:总榜 good / 大城市榜 bigCities / 近处榜 near / 双合榜 bothWays
  ok(r.good.length >= 3, '旺地总榜应有货');
  ok(r.good.every(g => typeof g.mark === 'string'), '徽记字段在');
  ok(r.suiNote.includes('岁破'), '流年注在');
});

console.log('【六】v0.68 重做:地气、能级、七层');
// 缘起:用户 2026-08-01 说「不够专业不够深刻…后面那些大城市做太少了…这个类目就是太浅了」。
// 实测查出三处结构性硬伤(docs/地利体检-01):①四直辖市进不了城市榜 ②城市榜按距离排永远是小城
// ③省被省会一个点绑架。这一节把三处各钉一条,外加新增各层的自查。
t('内联地气表与 data/dili-cities.json 一字不差(防两处各改各的)', () => {
  const J = require('../data/dili-cities.json').cities;
  const names = Dili.PLACES.map(p => p[0]);
  eq(Object.keys(J).length, names.length, '数据文件条数应与 PLACES 相同');
  for (const n of names) ok(J[n], 'data 里缺 ' + n);
  for (const [k, v] of Object.entries(J)) {
    const a = Dili.ATTR[k];
    ok(a, 'dili.js 内联表缺 ' + k);
    eq(a[0], v[0], k + ' 地气');
    eq(a[1], v[1], k + ' 能级');
    eq(a[2], v[2], k + ' 依据');
  }
});
t('每一处都有地气、能级与一句依据,依据不许敷衍', () => {
  for (const p of Dili.PLACES) {
    const n = p[0];
    ok('金木水火土'.includes(Dili.qiOf(n)), n + ' 地气不合法:' + Dili.qiOf(n));
    const t = Dili.tierOf(n);
    ok(t >= 0 && t <= 5, n + ' 能级越界:' + t);
    ok(Dili.whyOf(n).length >= 8, n + ' 的依据太短:' + Dili.whyOf(n));
  }
  // 五行分布不许退化成一两味独大(退化就说明我在硬凑)
  const cnt = {};
  for (const p of Dili.PLACES) cnt[Dili.qiOf(p[0])] = (cnt[Dili.qiOf(p[0])] || 0) + 1;
  for (const w of '金木水火土') ok(cnt[w] >= 20, w + ' 只有 ' + cnt[w] + ' 处,分布退化');
  for (const w of '金木水火土') ok(cnt[w] / Dili.PLACES.length < 0.4, w + ' 占了四成以上,分布退化');
});
t('硬伤一已修:四直辖市进得了城市榜(旧版写死 p[3]===0,把它们永久排除)', () => {
  for (const n of ['北京', '天津', '上海', '重庆', '香港', '澳门']) {
    ok(Dili.tierOf(n) > 0, n + ' 应有城市能级');
    ok(Dili.isCity(Dili.PLACES.find(p => p[0] === n)), n + ' 应算作城市');
  }
  // 河北、山西这类纯省级锚不该混进城市榜
  for (const n of ['河北', '山西', '四川', '云南']) ok(!Dili.isCity(Dili.PLACES.find(p => p[0] === n)), n + ' 是省不是市');
  // 实打实地跑一遍:喜水木火的人居广州,北方城市榜里必须见得到直辖市
  const c = { yong: { xiWx: ['水', '木'], jiWx: ['金', '土'] } };
  const r = Dili.recommend(c, '广州', 10);
  ok(r.bigCities.some(x => ['北京', '天津', '上海'].includes(x.name)),
    '大城市榜里一个直辖市都没有:' + r.bigCities.map(x => x.name).join(' '));
});
t('硬伤二已修:大城市榜真的是大城市(全在二线及以上)', () => {
  const c = { yong: { xiWx: ['水', '木'], jiWx: ['金', '土'] } };
  for (const from of ['武汉', '上海', '成都', '北京', '西安']) {
    const r = Dili.recommend(c, from, 10);
    ok(r.bigCities.length >= 5, from + ' 的大城市榜太空:' + r.bigCities.length);
    for (const x of r.bigCities) ok(x.tier <= 3, `${from} 的大城市榜混进了${x.name}(能级${x.tier})`);
  }
});
t('硬伤三已修:省域视图按省内各市实算,并标出省内分歧', () => {
  // 居上海、喜水木火者:浙江锚杭州在西南(忌),但宁波温州舟山台州都在旺向——整省一刀切是失真的
  const c = { yong: { xiWx: ['水', '木', '火'], jiWx: ['金', '土'] } };
  const a = Dili.find('上海');
  const gd = [...new Set([].concat(...c.yong.xiWx.map(w => Dili.WX_DIRS[w] || [])))];
  const bd = [...new Set([].concat(...c.yong.jiWx.map(w => Dili.WX_DIRS[w] || [])))];
  const pv = Dili.provinceView(c, a, gd, bd);
  const zj = pv.find(p => p.prov === '浙江');
  ok(zj, '省域视图应含浙江');
  eq(Dili.dirOf(Dili.bearing(a, Dili.find('杭州'))), '西南', '省会杭州在上海西南(忌方)');
  ok(zj.good >= 6, `浙江应有多市落在旺向,实得 ${zj.good}/${zj.n}`);
  ok(zj.split, '浙江应标为省内分歧');
  ok(zj.best.some(b => ['宁波', '温州', '台州', '舟山'].includes(b.name)), '浙江首选应点名旺向上的市:' + zj.best.map(b => b.name).join(' '));
  // 每个省的城市数要对得上(县级市不许漏归)
  let n = 0;
  for (const list of Object.values(Dili.PROV_CITIES)) n += list.length;
  eq(n, Dili.PLACES.filter(p => Dili.isCity(p)).length, '省市归属有漏');
  eq(Dili.PROV_OF['昆山'], '江苏', '县级市归属');
  eq(Dili.PROV_OF['浏阳'], '湖南', '县级市归属');
  eq(Dili.PROV_OF['台北'], '台湾', '台北归属');
});
t('七层俱在:向气候煞时业程,各层各有断语', () => {
  const Bazi = require('../bazi.js');
  const c = Bazi.chart(new Date(1990, 4, 15, 10, 30), '男', 114.3);
  const r = Dili.judge(c, '武汉', '哈尔滨', '午', { age: 36 });
  for (const k of ['xiang', 'qi', 'hou', 'cheng', 'shi', 'ye']) ok(r[k], '缺第' + k + '层');
  ok(r.xiang.note.length > 8 && r.qi.note.length > 8, '向与气都要有断语');
  ok(r.qi.why.length > 6, '气这一层要说清那地方是个什么地方');
  ok(typeof r.total === 'number' && r.overall, '合分与合判都要有');
  ok(r.shi.best.length === 3 && r.shi.best.every(b => b.year > 2000), '时这一层要给出年份');
  ok(r.cheng.band && r.cheng.note.length > 10, '程这一层要说远近');
  ok(r.ye.fields.length > 10, '业这一层要给出行当');
  ok(r.tierName, '要报目的地能级');
});
t('主判仍是「向」,合分另计——两者不一致时不许抹平', () => {
  // 喜火忌水者从北京去广州:方位正南属火=大旺,但广州地气属水=犯忌。这两句必须都在。
  const c = { yong: { xiWx: ['火', '木'], jiWx: ['水', '金'] } };
  const r = Dili.judge(c, '北京', '广州');
  eq(r.verdict, '大旺', '主判仍看方位');
  eq(r.qi.wx, '水', '广州地气属水');
  ok(r.qi.score < 0, '水是此命忌神,气这一层该判负');
  ok(r.agree === false, '向与气不一致,agree 应为 false');
  ok(r.total < r.xiang.score, '合分应被气那一层拖下来');
});
t('候这一层接的是 Bazi 的调候,南北挪动才作数', () => {
  const Bazi = require('../bazi.js');
  const c = Bazi.chart(new Date(1990, 4, 15, 10, 30), '男', 114.3); // 巳月生,调候需水
  eq(c.tiaohou.need, '水', '此盘调候取水');
  const north = Dili.judge(c, '广州', '哈尔滨');
  eq(north.hou.verdict, '对症', '燥局北上应判对症:' + north.hou.note);
  // 南下内陆:润凉两味都做背了,判反着
  const south = Dili.judge(c, '哈尔滨', '西安');
  eq(south.hou.verdict, '反着', '燥局南下内陆应判反着:' + south.hou.note);
  // 南下海岛:得了「润」却丢了「凉」,只能算半对——不许拿临水盖过纬度
  const island = Dili.judge(c, '哈尔滨', '海口');
  eq(island.hou.verdict, '半对', '燥局南下临水应判半对:' + island.hou.note);
  eq(island.hou.score, 0, '半对不给分');
  ok(/润这一味有了/.test(island.hou.note) && /凉那一味反倒做背/.test(island.hou.note), '半对必须两头都说清:' + island.hou.note);
  // 没有调候的盘(纯 stub)不许崩,这一层直接缺席
  ok(Dili.judge({ yong: { xiWx: ['火'], jiWx: ['水'] } }, '北京', '广州').hou === null, '无调候时该层应为 null');
});
t('兼向:骑在两方界上的要说出来,正中的不许乱报', () => {
  ok(Dili.jianOf(0) === null && Dili.jianOf(90) === null, '正中不报兼向');
  ok(Dili.jianOf(22) === '东北', '22°应兼东北,得' + Dili.jianOf(22));
  ok(Dili.jianOf(24) === '正北', '24°归东北但兼正北,得' + Dili.jianOf(24));
  // 全圆扫一遍:报了兼向的,必须与主向相邻
  for (let d = 0; d < 360; d += 0.5) {
    const j = Dili.jianOf(d);
    if (!j) continue;
    const i = Dili.DIRS.indexOf(Dili.dirOf(d)), k = Dili.DIRS.indexOf(j);
    const gap = Math.min((i - k + 8) % 8, (k - i + 8) % 8);
    eq(gap, 1, d + '° 的兼向不相邻:' + Dili.dirOf(d) + '/' + j);
  }
});
t('神煞这一层明写「不计分」,并把两本书的分歧摆出来', () => {
  ok(/不进分数|不计分/.test(Dili.SHA_CAVEAT), '须写明不计分');
  ok(Dili.SHA_CAVEAT.includes('增删卜易') && Dili.SHA_CAVEAT.includes('滴天髓'), '两本书都要点名');
  // 神煞确实没有进合分:同一目的地,带不带 pillars 的合分必须一样
  const base = { yong: { xiWx: ['火', '木'], jiWx: ['水', '金'] } };
  const withSha = { ...base, dayGan: '甲', pillars: { year: { zhi: '午' } } };
  eq(Dili.judge(withSha, '北京', '成都').total, Dili.judge(base, '北京', '成都').total, '神煞不许影响合分');
});
t('诚实:地气表标明是今人自拟,不冒充古法', () => {
  const J = require('../data/dili-cities.json');
  ok(/自拟|不是古法|非古法/.test(JSON.stringify(J._meta)), '数据文件须自陈是今人自拟');
  const c = { yong: { xiWx: ['火'], jiWx: ['水'] } };
  const r = Dili.judge(c, '北京', '广州');
  ok(/自拟/.test(r.qi.src), '气这一层的输出要带自拟声明:' + r.qi.src);
  // 源码里不许给方位五行挂书名(五本书里查不到,见 docs/地利体检-01)
  const src = readFileSync(join(ROOT, 'dili.js'), 'utf8');
  ok(/出处待核/.test(src), 'dili.js 须写明方位这一层出处待核');
});

console.log('【七】说人话与死条(v0.81)');
// 缘起:v0.80 拿断语体检员扫年表,把那一栏洗干净了;这一轮把同一把尺子对准其余模块,
// 量出地利这边**界面渲染的字有 18.7% 带术语**(忌神/喜用/调候/用神),而七层断整个是摆给客人看的。
t('七层断给客人看的每一句,一个推演名目都不许有', () => {
  const Bazi = require('../bazi.js');
  const Najia = require('../najia.js');
  const Tijian = require('../tijian.js');
  const SAMPLES = [['男', new Date(1990, 4, 20, 9, 30), 120.15], ['女', new Date(1985, 7, 3, 20, 0), 116.4],
    ['男', new Date(1966, 2, 27, 15, 0), 113.3], ['女', new Date(1958, 2, 21, 11, 5), 114.3]];
  const cities = ['成都', '上海', '广州', '哈尔滨', '海口', '乌鲁木齐', '杭州', '西安'];
  let total = 0; const bad = [];
  const scan = (where, str) => {
    if (!str || typeof str !== 'string') return;
    total++;
    const hits = Tijian.check(str, { zone: '断语', minChars: 0 }).hits
      .filter(h => ['术语', '说教', '空话', '花钱消灾', '模棱'].includes(h.kind));
    if (hits.length) bad.push(`${where}「${str.slice(0, 34)}」← ${hits.map(h => h.kind + ':' + h.snippet).join('/')}`);
  };
  for (const [g, d, lon] of SAMPLES) {
    const c = Bazi.chart(new Date(d), g, lon);
    for (const to of cities) {
      const r = Dili.judge(c, '北京', to, Najia.ganZhi(new Date(2026, 7, 2)).year[1], { age: 36, hour: 10 });
      if (r.err || r.local) continue;
      for (const L of ['xiang', 'qi', 'hou', 'cheng', 'ye', 'dayun']) if (r[L]) scan('地利·' + L, r[L].note);
      scan('地利·总判', r.note); scan('地利·煞旁注', r.shaCaveat);
      (r.extras || []).forEach(x => scan('地利·旁注', x));
      ((r.shi && r.shi.best) || []).forEach(x => scan('地利·时', x.why));
    }
    const rec = Dili.recommend(c, '北京', { age: 36 });
    if (rec && !rec.err) {
      for (const k of ['good', 'bigCities', 'bothWays', 'near']) (rec[k] || []).forEach(x => scan('榜单.' + k, x.why || x.note));
      ((rec.shi && rec.shi.best) || []).forEach(x => scan('榜单·时', x.why));
    }
  }
  ok(total > 300, `扫到的字段太少(${total}),测试自己可能失效了`);
  ok(!bad.length, `${bad.length}/${total} 条不干净:\n      ` + bad.slice(0, 8).join('\n      '));
});
t('七层断没有死条:每一个判语分支都触发得到', () => {
  // §十二:写完断法规则,要穷举验一遍有没有「死条」——格局法用这一招揪出过两条永不触发的救应,
  // 地利七层是 v0.68 加的,此前从没验过。这一条把「全都触发得到」这个结论钉住。
  const Bazi = require('../bazi.js');
  const places = Dili.PLACES.map(p => p[0]);
  const ZH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const got = { xiang: new Set(), qi: new Set(), hou: new Set(), cheng: new Set(), extras: new Set() };
  let n = 0;
  for (let y = 1950; y <= 2010; y += 2) for (const mo of [0, 3, 6, 9]) for (const g of ['男', '女']) {
    const c = Bazi.chart(new Date(y, mo, 15, 10, 0), g, 116.4);
    for (let k = 0; k < 3; k++) {
      const r = Dili.judge(c, places[(n * 7 + k * 61) % places.length],
        places[(n * 13 + k * 97 + 5) % places.length], ZH[(n + k) % 12], { age: 30, hour: 10 });
      n++;
      if (r.err || r.local) continue;
      for (const L of ['xiang', 'qi', 'hou']) if (r[L] && r[L].verdict) got[L].add(r[L].verdict);
      if (r.cheng) got.cheng.add(r.cheng.band);
      // 去重取前 12 字:两条「流年注意」的前 8 字一模一样(此处栽过一次,取 8 会把 5 条并成 4 条)
      (r.extras || []).forEach(x => got.extras.add(x.slice(0, 12)));
    }
  }
  const want = {
    xiang: ['大旺', '旺', '平', '偏背', '背'],
    qi: ['大合', '合', '不相干', '略不合', '不合'],
    hou: ['对症', '半对', '不显', '反着'],
    cheng: ['邻近', '出省', '跨大区', '远行'],
  };
  for (const L of Object.keys(want)) for (const v of want[L]) ok(got[L].has(v), `${L} 层的「${v}」是死条:${n} 次判地里一次没触发`);
  eq(got.extras.size, 5, `煞层旁注五条应当都触发得到,实得 ${got.extras.size} 条`);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
