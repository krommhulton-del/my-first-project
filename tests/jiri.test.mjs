// 内测:吉日历(建除十二神、黄黑道值神、冲煞合害、本命生克、按事挑日)
// node tests/jiri.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Jiri = require('../jiri.js');
const Najia = require('../najia.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】建除十二神');
t('月建之日为「建」,顺行十二辰;破日必与月建对冲', () => {
  const ZHI = Najia.ZHI;
  for (let m = 0; m < 12; m++) {
    eq(Jiri.jianchuOf(ZHI[m], ZHI[m]).name, '建', `${ZHI[m]}月${ZHI[m]}日`);
    eq(Jiri.jianchuOf(ZHI[m], ZHI[(m + 1) % 12]).name, '除', `${ZHI[m]}月次日`);
    eq(Jiri.jianchuOf(ZHI[m], ZHI[(m + 6) % 12]).name, '破', `${ZHI[m]}月对冲日`);
    eq(Jiri.jianchuOf(ZHI[m], ZHI[(m + 8) % 12]).name, '成', `${ZHI[m]}月+8`);
  }
});
t('建除逐日推进:相邻两天序数+1,唯节气换月建当天例外', () => {
  const seq = Jiri.JIANCHU.map(j => j.name);
  let prev = null, jumps = 0;
  for (let i = 0; i < 70; i++) {
    const d = new Date(2026, 6, 1 + i, 12);
    const info = Jiri.dayInfo(d);
    const idx = seq.indexOf(info.jianchu.name);
    if (prev !== null) {
      const step = (idx - prev + 12) % 12;
      ok(step === 1 || step === 0 || step === 2, `第${i}天步进异常:${step}`);
      if (step !== 1) jumps++;
    }
    prev = idx;
  }
  ok(jumps >= 1 && jumps <= 4, `70天应跨2-3个节气,例外次数=${jumps}`);
});

console.log('【二】黄黑道值神');
t('青龙歌诀:寅申加子、卯酉居寅、辰戌在辰、巳亥在午、子午临申、丑未在戌', () => {
  const starts = { 寅: '子', 申: '子', 卯: '寅', 酉: '寅', 辰: '辰', 戌: '辰', 巳: '午', 亥: '午', 子: '申', 午: '申', 丑: '戌', 未: '戌' };
  for (const [mz, dz] of Object.entries(starts)) {
    eq(Jiri.zhishenOf(mz, dz).name, '青龙', `${mz}月青龙起${dz}日`);
  }
});
t('十二神次序与黄黑道归属(黄道六:青龙明堂金匮天德玉堂司命)', () => {
  const names = Jiri.ZHISHEN.map(z => z.name);
  eq(names.join(''), '青龙明堂天刑朱雀金匮天德白虎玉堂天牢玄武司命勾陈', '次序');
  const huang = Jiri.ZHISHEN.filter(z => z.huang).map(z => z.name).join('');
  eq(huang, '青龙明堂金匮天德玉堂司命', '黄道六神');
});
t('寅月子日青龙、丑日明堂、寅日天刑(与歌诀示例一致)', () => {
  eq(Jiri.zhishenOf('寅', '子').name, '青龙');
  eq(Jiri.zhishenOf('寅', '丑').name, '明堂');
  eq(Jiri.zhishenOf('寅', '寅').name, '天刑');
  eq(Jiri.zhishenOf('寅', '巳').name, '天德');
});

console.log('【三】冲煞');
t('子日冲马煞南、午日冲鼠煞北、卯日冲鸡煞西、酉日冲兔煞东', () => {
  // 找到日支为子/午/卯/酉的日子逐一验证
  const want = { 子: ['马', '南'], 午: ['鼠', '北'], 卯: ['鸡', '西'], 酉: ['兔', '东'] };
  const found = {};
  for (let i = 0; i < 13; i++) {
    const info = Jiri.dayInfo(new Date(2026, 6, 1 + i, 12));
    if (want[info.gz.dayZhi]) found[info.gz.dayZhi] = [info.chongAnimal, info.shaDir];
  }
  for (const [z, [a, s]] of Object.entries(want)) {
    ok(found[z], `13天内必遇${z}日`);
    eq(found[z][0], a, `${z}日冲`);
    eq(found[z][1], s, `${z}日煞方`);
  }
});

console.log('【四】本命个人化');
t('属马者(1990庚午)逢子日为「冲」,大事勿用;逢未日得六合', () => {
  const birth = new Date(1990, 5, 15, 12); // 庚午年
  let chongDay = null, heDay = null;
  for (let i = 0; i < 13; i++) {
    const info = Jiri.dayInfo(new Date(2026, 6, 1 + i, 12), birth);
    if (info.gz.dayZhi === '子') chongDay = info;
    if (info.gz.dayZhi === '未') heDay = info;
  }
  ok(chongDay && chongDay.personal.chong, '子日应标冲');
  eq(chongDay.level, '冲', '冲日等级');
  ok(heDay && heDay.personal.marks.some(m => m.includes('六合')), '未日应见六合');
  ok(!heDay.personal.chong, '未日非冲');
});
t('三合:属马者逢寅日、戌日记三合', () => {
  const birth = new Date(1990, 5, 15, 12);
  for (let i = 0; i < 25; i++) {
    const info = Jiri.dayInfo(new Date(2026, 6, 1 + i, 12), birth);
    if (info.gz.dayZhi === '寅' || info.gz.dayZhi === '戌') {
      ok(info.personal.marks.some(m => m.includes('三合')), `${info.gz.dayZhi}日应记三合`);
    }
  }
});
t('无喜忌时的粗判:同我/生我/我克为顺,克我为逆,五种关系皆有断语且自报「粗判」', () => {
  // 新签名 wxRelation(流日干, 流日支, 本命日干, 喜忌);不传喜忌走粗判
  eq(Jiri.wxRelation('甲', '子', '甲').rel, '同我');
  eq(Jiri.wxRelation('壬', '子', '甲').rel, '生我');   // 水生木
  eq(Jiri.wxRelation('庚', '申', '甲').rel, '克我');   // 金克木
  eq(Jiri.wxRelation('戊', '辰', '甲').rel, '我克');   // 木克土
  eq(Jiri.wxRelation('丙', '午', '甲').rel, '我生');   // 木生火
  for (const g of '甲乙丙丁戊己庚辛壬癸') {
    const r = Jiri.wxRelation(g, '子', '庚');
    ok(r.note.length > 4, '断语非空');
    ok(r.note.includes('粗判') && r.byYong === false, '粗判须自报家门:' + r.note);
  }
});
t('给了喜忌就按喜忌断,与运势页同尺(天干1、地支1.2)', () => {
  const yong = { xiWx: ['火', '土'], jiWx: ['水', '木'] };
  eq(Jiri.wxRelation('丙', '午', '乙', yong).score, 2.2);   // 干火喜+1、支火喜+1.2
  eq(Jiri.wxRelation('壬', '子', '乙', yong).score, -2.2);  // 干水忌-1、支水忌-1.2
  eq(Jiri.wxRelation('丙', '子', '乙', yong).score, -0.2);  // 干喜+1、支忌-1.2
  ok(Jiri.wxRelation('丙', '子', '乙', yong).note.includes('面上顺、底下漏'));
  ok(Jiri.wxRelation('丙', '午', '乙', yong).byYong === true);
});
t('不填生日:无 personal,等级只按黄历', () => {
  const info = Jiri.dayInfo(new Date(2026, 6, 10, 12));
  ok(info.personal === null, '无个人层');
  ok(['上吉', '吉', '平', '慎', '忌'].includes(info.level), '等级在通用五档内');
});

console.log('【五】整月网格');
t('2026年7月:31天、首日周三、逐日含农历与干支', () => {
  const g = Jiri.monthGrid(2026, 7);
  eq(g.days.length, 31, '天数');
  eq(g.firstWeek, 2, '7月1日为周三(0=周一)');
  ok(g.days.every(d => d.gz.day.length === 2), '干支齐');
  ok(g.days.every(d => d.lunarText), '农历齐');
  ok(g.days.some(d => d.lunarText.includes('月')), '当月应有初一显示月名');
});
t('破日在月内必唯二或唯三,且等级不高于慎', () => {
  const g = Jiri.monthGrid(2026, 7);
  const po = g.days.filter(d => d.jianchu.name === '破');
  ok(po.length >= 2 && po.length <= 3, `破日数=${po.length}`);
  po.forEach(d => ok(d.level === '慎' || d.level === '忌', `破日${d.iso}等级=${d.level}`));
});

console.log('【六】按事挑日');
t('开业:所荐日子绝无破闭收执,且建星合宜或有吉神扶', () => {
  const birth = new Date(1990, 5, 15, 12);
  const picks = Jiri.pickDays('kaiye', new Date(2026, 6, 16, 12), 60, birth, 5);
  ok(picks.length >= 3, `60天内应挑得出日子,得${picks.length}`);
  picks.forEach(p => {
    ok(!['破', '闭', '收', '执'].includes(p.info.jianchu.name), `${p.info.iso}犯忌星${p.info.jianchu.name}`);
    ok(!p.info.personal.chong, '不得冲本人');
    ok(p.why.length > 0, '必给理由');
  });
  for (let i = 1; i < picks.length; i++) ok(picks[i - 1].score >= picks[i].score, '按分排序');
});
t('求医:破日可入选(破日宜治病是老规矩)', () => {
  const picks = Jiri.pickDays('qiuyi', new Date(2026, 6, 16, 12), 90, null, 20);
  ok(picks.length > 0, '有推荐');
  ok(picks.every(p => !['定', '满'].includes(p.info.jianchu.name)), '定满两星忌就医,不得入选');
});
t('嫁娶:除日不荐(除旧布新不宜合卺),破闭不荐', () => {
  const picks = Jiri.pickDays('jiaqu', new Date(2026, 6, 16, 12), 90, null, 20);
  ok(picks.length > 0, '有推荐');
  picks.forEach(p => ok(!['破', '闭', '除'].includes(p.info.jianchu.name), `${p.info.iso}=${p.info.jianchu.name}`));
});
t('全部十事项:60天内均能荐出日子,均带理由', () => {
  for (const k of Object.keys(Jiri.EVENTS)) {
    const picks = Jiri.pickDays(k, new Date(2026, 6, 16, 12), 60, null, 5);
    ok(picks.length >= 1, `${k} 挑不出日子`);
    ok(picks.every(p => p.why.length), `${k} 缺理由`);
  }
});

console.log('【七】心愿映射与旺衰用度');
t('心愿→事项:恋爱/跳槽/旅行/开店/装修各归其类,认不出的走通用', () => {
  eq(Jiri.wishEvent('我想谈恋爱').key, 'jiaqu');
  eq(Jiri.wishEvent('想跳槽换个工作').key, 'shangren');
  eq(Jiri.wishEvent('计划出国旅行').key, 'chuxing');
  eq(Jiri.wishEvent('开店做点小生意').key, 'kaiye');
  eq(Jiri.wishEvent('家里想装修').key, 'dongtu');
  eq(Jiri.wishEvent('想搬家换个环境').key, 'ruzhai');
  eq(Jiri.wishEvent('想变得更有钱').key, 'tongyong');
});
t('通用事项也能在60天里挑出日子', () => {
  const picks = Jiri.pickDays('tongyong', new Date(2026, 6, 16, 12), 60, null, 5);
  ok(picks.length >= 1, '通用应有推荐');
});
t('五行用度表五行齐全,颜色方位数字时段四样不缺', () => {
  for (const wx of ['木', '火', '土', '金', '水']) {
    const g = Jiri.WX_GOODS[wx];
    ok(g && g.colors && g.dir && g.nums && g.hours, wx);
  }
});
t('生肖贵人:午年三合得虎狗、六合得羊', () => {
  const a = Jiri.zodiacAllies(6);
  eq(a.sanhe.sort().join(''), ['虎', '狗'].sort().join(''), '三合');
  eq(a.liuhe, '羊', '六合');
});

console.log('【八】通书增补:二十八宿/彭祖百忌/杨公忌/消息卦');
t('外验锚点(对市售黄历):2026-07-18=癸巳日、柳土獐凶宿、开日、值神玉堂', () => {
  const info = Jiri.dayInfo(new Date(2026, 6, 18, 12));
  eq(info.gz.day, '癸巳', '日柱');
  eq(info.xiu.name, '柳土獐', '星宿');
  eq(info.xiu.luck, '凶', '宿吉凶');
  eq(info.jianchu.name, '开', '建除');
  eq(info.zhishen.name, '玉堂', '值神');
});
t('宿与七曜锁定:宿名中字对星期,连验28天且二十八宿无一重复', () => {
  const YAO = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
  const seen = new Set();
  for (let i = 0; i < 28; i++) {
    const d = new Date(2026, 6, 1 + i, 12);
    const x = Jiri.xiuOf(d);
    eq(YAO[x.name[1]], d.getDay(), x.name + '@' + d.toDateString());
    seen.add(x.name);
  }
  eq(seen.size, 28, '28宿轮满');
});
t('彭祖百忌:句首干支与日柱相符(癸巳日=癸不词讼+巳不远行)', () => {
  const info = Jiri.dayInfo(new Date(2026, 6, 18, 12));
  ok(info.pengzu.startsWith('癸不词讼'), info.pengzu);
  ok(info.pengzu.includes('巳不远行'), info.pengzu);
});
t('杨公忌:扫2026全年12-14天,含七月初一;挑日绝不荐杨公忌', () => {
  let n = 0, has71 = false;
  for (let i = 0; i < 365; i++) {
    const info = Jiri.dayInfo(new Date(2026, 0, 1 + i, 12));
    if (info.flags.yanggong) {
      n++;
      if (info.lunar.lMonth === 7 && info.lunar.lDay === 1) has71 = true;
    }
  }
  ok(n >= 12 && n <= 14, `杨公忌=${n}天`);
  ok(has71, '七月初一应在列');
  const picks = Jiri.pickDays('tongyong', new Date(2026, 1, 20, 12), 90, null, 20);
  ok(picks.every(p => !p.info.flags.yanggong), '荐日不得撞杨公忌');
});
t('十二消息卦:寅泰、未遯、子复、丑临,十二月支全有注', () => {
  eq(Jiri.xiaoxiOf('寅').gua, '泰');
  eq(Jiri.xiaoxiOf('未').gua, '遯');
  eq(Jiri.xiaoxiOf('子').gua, '复');
  eq(Jiri.xiaoxiOf('丑').gua, '临');
  for (const z of '子丑寅卯辰巳午未申酉戌亥') ok(Jiri.xiaoxiOf(z).note.length > 6, z);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
