// 内测:农历、梅花易数、小六壬、蓍草分布(node tests/fangmen.test.mjs)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Lunar = require('../lunar.js');
const Meihua = require('../meihua.js');
const Xlr = require('../xiaoliuren.js');
const GuaCore = require('../gua-core.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期望 ${JSON.stringify(b)},得到 ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('【一】农历(朔日定月、无中气置闰)');
t('春节锚点:2023/2024/2025/2026 正月初一', () => {
  for (const [d, y] of [['2023-01-22', 2023], ['2024-02-10', 2024], ['2025-01-29', 2025], ['2026-02-17', 2026]]) {
    const l = Lunar.fromDate(new Date(d + 'T12:00:00'));
    eq(l.monthName + l.dayName, '正月初一', d); eq(l.lYear, y, d);
  }
});
t('闰月:2020 闰四月、2023 闰二月、2025 闰六月', () => {
  eq(Lunar.fromDate(new Date('2020-05-23T12:00:00')).monthName, '闰四月');
  eq(Lunar.fromDate(new Date('2023-03-22T12:00:00')).monthName, '闰二月');
  eq(Lunar.fromDate(new Date('2025-07-25T12:00:00')).monthName, '闰六月');
});
t('除夕与年干支:2024-02-09 = 癸卯年腊月三十', () => {
  const l = Lunar.fromDate(new Date('2024-02-09T12:00:00'));
  eq(l.yearGZ, '癸卯'); eq(l.monthName + l.dayName, '腊月三十');
});
t('时辰:23:30 为子时数1,15:00 为申时数9', () => {
  eq(Lunar.fromDate(new Date('2026-07-06T23:30:00')).hourNum, 1);
  eq(Lunar.fromDate(new Date('2026-07-06T15:00:00')).hourNum, 9);
});

console.log('【二】梅花易数(以《梅花易数》观梅占为准)');
t('观梅占:辰年十二月十七日申时 → 泽火革,初爻动,互乾巽,变泽山咸,体兑用离', () => {
  // 年支辰=5,月12,日17 → 34;34%8=2 兑上;加申时9=43;43%8=3 离下;43%6=1 初爻动
  const lunar = { yearBranchNum: 5, lMonth: 12, lDay: 17, hourNum: 9, yearGZ: '辰', monthName: '十二月', dayName: '十七', hourBranch: '申' };
  const c = Meihua.castByTime(lunar);
  eq(c.ben.full, '泽火革'); eq(c.moving, 1);
  eq(c.bian.full, '泽山咸');
  eq(c.tiTri.name, '兑', '体'); eq(c.yongTri.name, '离', '用');
  // 互卦:下互巽上互乾 → 天风姤
  eq(c.hu.full, '天风姤');
  const a = Meihua.analyze(c, '丑');
  eq(a.rel, '用克体'); eq(a.lv, '凶'); // 离火克兑金,classic 断有折股之凶
});
t('报数起卦:3、5 加午时7 → 上离下巽火风鼎,三爻动', () => {
  const c = Meihua.castByNumbers(3, 5, 7);
  eq(c.ben.full, '火风鼎'); // 上离3 下巽5
  eq(c.moving, 3); // (3+5+7)%6=15%6=3
  ok(c.movingInLower, '三爻在下卦'); eq(c.tiTri.name, '离', '体为上卦');
});
t('整八整六取满数:8、8 加子时1 → 坤为地,(8+8+1)%6=5 五爻动', () => {
  const c = Meihua.castByNumbers(8, 8, 1);
  eq(c.ben.full, '坤为地'); eq(c.moving, 5);
});
t('体用五行关系覆盖五种断语', () => {
  const rels = new Set();
  for (let n1 = 1; n1 <= 8; n1++) for (let n2 = 1; n2 <= 8; n2++) {
    rels.add(Meihua.analyze(Meihua.castByNumbers(n1, n2, 3), '午').rel);
  }
  for (const r of ['用生体', '体生用', '体克用', '用克体', '体用比和']) ok(rels.has(r), '缺 ' + r);
});

console.log('【三】小六壬');
t('时间起课:三月初五午时 → 速喜/大安/大安', () => {
  const c = Xlr.castByTime({ lMonth: 3, lDay: 5, hourNum: 7, yearGZ: '某', monthName: '三月', dayName: '初五', hourBranch: '午' });
  eq(c.gongs[0].name, '速喜'); eq(c.gongs[1].name, '大安'); eq(c.gongs[2].name, '大安');
});
t('正月初一子时 → 大安/大安/大安', () => {
  const c = Xlr.castByTime({ lMonth: 1, lDay: 1, hourNum: 1, yearGZ: '某', monthName: '正月', dayName: '初一', hourBranch: '子' });
  eq(c.gongs.map(g => g.name).join(','), '大安,大安,大安');
});
t('报数起课与六宫属性完备', () => {
  const c = Xlr.castByNumbers(6, 1, 1);
  eq(c.gongs[0].name, '空亡'); eq(c.gongs[1].name, '空亡'); eq(c.gongs[2].name, '空亡');
  for (const g of Xlr.GONG) ok(g.wx && g.shen && g.verse.length > 20 && g.ji, g.name);
});

console.log('【四】蓍草大衍法');
t('大衍分布:6=1/16, 7=5/16, 8=7/16, 9=3/16(4 万爻,偏差<1.5%)', () => {
  const freq = { 6: 0, 7: 0, 8: 0, 9: 0 }; const N = 40000;
  for (let i = 0; i < N; i++) freq[GuaCore.dayanLine().sum]++;
  const exp = { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 };
  for (const k of [6, 7, 8, 9]) {
    const r = freq[k] / N;
    ok(Math.abs(r - exp[k]) < 0.015, `${k}: ${r.toFixed(4)} vs ${exp[k].toFixed(4)}`);
  }
});
t('蓍草成卦走同一解卦管线', () => {
  const lines = Array.from({ length: 6 }, () => GuaCore.dayanLine().sum);
  const c = GuaCore.castFromSums(lines);
  ok(c.ben && c.ben.full, '本卦');
  const r = GuaCore.interpret(c);
  ok(r.headline && r.focus.length, '解读');
});

console.log('【五】问事分科(全面版)');
const Fenke = require('../fenke.js');
t('专科齐全(≥75项),十四大类分组,id 唯一,含奇门派单', () => {
  ok(Fenke.FENKE.length >= 75, '专科数 ' + Fenke.FENKE.length);
  eq(new Set(Fenke.FENKE.map(f => f.id)).size, Fenke.FENKE.length, 'id 唯一');
  ok(Array.isArray(Fenke.GROUPS) && Fenke.GROUPS.length >= 14, '分组数 ' + Fenke.GROUPS.length);
  ok(Fenke.GROUPS.includes('婚姻家庭') && Fenke.GROUPS.includes('谋事求人') && Fenke.GROUPS.includes('人际往来'), '含新增分组');
  ok(Fenke.FENKE.some(f => f.recommend.some(r => r.method === 'qimen')), '含奇门派单');
  eq(Fenke.METHOD_LABEL.qimen, '奇门遁甲', '奇门法门标签');
  // 高频民生问事全覆盖(按需求调研补充)
  const ids2 = new Set(Fenke.FENKE.map(f => f.id));
  for (const need of ['lianxi', 'wanglian', 'ta_qingkuang', 'hunqi', 'bianzhi', 'zhuanzheng', 'caiyuan', 'zimeiti',
    'kaoyan', 'maifang', 'huanzhai', 'dagoumai', 'jiaren_bing', 'chongwu', 'hehao', 'jieqian', 'zhouyun', 'zeri', 'zhuihui']) {
    ok(ids2.has(need), '缺高频专科 ' + need);
  }
});
t('覆盖各大问事门类(感情/事业/求学/财运/出行/健康/寻找/看人/运势/决策/官非)', () => {
  const ids = new Set(Fenke.FENKE.map(f => f.id));
  for (const need of ['yinyuan_when', 'zhengyuan_pic', 'guanxi_zouxiang', 'qiuzhi', 'tiaocao', 'kaoshi',
    'caiyun', 'touzi', 'taozhai', 'chuxing', 'banjia', 'jiankang', 'jibing', 'xunwu', 'xunren',
    'zhangxiang', 'xingge', 'riyun', 'yueyun', 'nianyun', 'gaibugai', 'yingqi', 'guansi', 'zaihuo']) {
    ok(ids.has(need), '缺 ' + need);
  }
});
t('每科:分组合法、问题模板、排序推荐、法门起式合法、断法规程含硬性输出', () => {
  const METHODS = { liuyao: ['coin', 'dayan'], meihua: ['num', 'time'], xlr: ['time', 'num'], qimen: ['time'] };
  const TAGS = ['首选', '次选', '亦可'];
  for (const f of Fenke.FENKE) {
    ok(Fenke.GROUPS.includes(f.group), f.id + ' 分组:' + f.group);
    ok(f.q && f.q.length >= 6, f.id + ' 问题模板');
    ok(Array.isArray(f.recommend) && f.recommend.length >= 1, f.id + ' 推荐列表');
    eq(f.recommend[0].tag, '首选', f.id + ' 首项应为首选');
    let lastStar = 4;
    for (const r of f.recommend) {
      ok(METHODS[r.method], f.id + ' 法门:' + r.method);
      ok(METHODS[r.method].includes(r.mode), f.id + ' 起式:' + r.mode);
      ok(r.star >= 1 && r.star <= 3, f.id + ' 适配度 1-3');
      ok(TAGS.includes(r.tag), f.id + ' 标签');
      ok(r.why && r.why.length >= 8, f.id + ' 推荐理由');
      ok(r.star <= lastStar, f.id + ' 适配度递减排序'); lastStar = r.star;
    }
    ok(f.ai && f.ai.length >= 60, f.id + ' 断法规程');
    ok(f.ai.includes('必须给'), f.id + ' 规程须含硬性输出要求');
  }
});
t('推荐首选符合术业专攻', () => {
  const top = id => Fenke.FENKE.find(f => f.id === id).recommend[0];
  // 具体人事吉凶/画像/婚恋/财 → 六爻
  for (const id of ['zhangxiang', 'touzi', 'qiuzhi', 'guanxi_zouxiang', 'caiyun', 'guansi']) eq(top(id).method, 'liuyao', id);
  // 趋势/月运 → 梅花
  for (const id of ['yueyun', 'zhuanye']) eq(top(id).method, 'meihua', id);
  // 当下急事/日运/出行 → 小六壬
  for (const id of ['riyun', 'chuxing']) eq(top(id).method, 'xlr', id);
  // 方位/寻物寻人/谋略博弈/求人办事 → 奇门遁甲
  for (const id of ['banjia', 'xunwu', 'xunren', 'mouren_nali', 'qiuren', 'moushi', 'jingzheng']) eq(top(id).method, 'qimen', id);
  // 年运岁占 → 蓍草
  eq(top('nianyun').mode, 'dayan', '年运用蓍草');
});
t('复杂科给分占方案与奇门总览;看人拆身高/长相/身材三分科', () => {
  for (const id of ['yueyun', 'nianyun', 'zonghe']) {
    const f = Fenke.FENKE.find(x => x.id === id);
    ok(f.duo && Array.isArray(f.duo.subs) && f.duo.subs.length >= 5, id + ' 应有分占方案(≥5分项)');
    for (const s of f.duo.subs) ok(s.k && s.q && s.q.length >= 6, id + ' 分项完整:' + JSON.stringify(s));
    ok(f.recommend.some(r => r.method === 'qimen'), id + ' 应含奇门一盘多断');
    ok(f.note && f.note.length >= 20, id + ' 应有复杂度规则说明');
  }
  const ids = new Set(Fenke.FENKE.map(f => f.id));
  for (const need of ['shengao', 'zhangxiang', 'shencai']) ok(ids.has(need), '缺 ' + need);
  ok(Fenke.FENKE.find(f => f.id === 'shengao').ai.includes('厘米'), '身高规程须给厘米区间');
  ok(Fenke.FENKE.find(f => f.id === 'shengao').ai.includes('性别'), '身高规程须按性别换算');
});
t('分占体系:验证卦收尾、落细规程;财富量级六卦逐层锁定', () => {
  for (const id of ['yueyun', 'nianyun', 'zonghe', 'cailiang']) {
    const f = Fenke.FENKE.find(x => x.id === id);
    ok(f.duo && f.duo.rules && f.duo.rules.length >= 40, id + ' 分占应带落细规程');
    const last = f.duo.subs[f.duo.subs.length - 1];
    ok(last.k.includes('验证'), id + ' 分占最后一卦应为验证卦,实为 ' + last.k);
  }
  const cl = Fenke.FENKE.find(f => f.id === 'cailiang');
  ok(cl.duo.subs.length === 6, '财富量级应为六卦,实为 ' + cl.duo.subs.length);
  const keys = cl.duo.subs.map(s => s.k).join(',');
  for (const k of ['定位数', '定区间', '定构成', '家庭资产', '年薪收入', '验证']) ok(keys.includes(k), '财富量级缺分项 ' + k);
  ok(cl.duo.rules.includes('位数') && cl.duo.rules.includes('承接'), '财富量级规程须含逐层承接锁定');
  ok(cl.duo.rules.includes('取数规程') && cl.duo.rules.includes('先天卦数') && cl.duo.rules.includes('常识校验'), '财富量级须含四步取数规程');
  ok(cl.ai.includes('测数四步'), '单卦规程亦须取数四步');
});
t('旺衰相性:人/城/司/宅四科,五卦分路、档位结论;核心运势可选时段', () => {
  ok(Fenke.GROUPS.includes('旺衰相性'), '应有旺衰相性分组');
  for (const id of ['wangren', 'wangdi', 'wanggs', 'wangzhai']) {
    const f = Fenke.FENKE.find(x => x.id === id);
    ok(f && f.duo && f.duo.subs.length === 5, id + ' 应为五卦分路');
    ok(f.duo.subs[0].k === '总相性' && f.duo.subs[4].k === '验证', id + ' 首总相性末验证');
    ok(f.duo.rules.includes('-10到+10') && f.duo.rules.includes('档位') || f.duo.rules.includes('旺我几分'), id + ' 应给分值与档位');
  }
  const yc = Fenke.FENKE.find(f => f.id === 'yunshi_core');
  ok(yc && yc.rangeInput === true, '核心运势应支持选时段');
  ok(yc.ai.includes('双轨') && yc.ai.includes('高点'), '核心运势规程须双轨与高低点');
  ok(yc.duo && yc.duo.subs.length === 6, '核心运势应有六卦分路');
  ok(yc.duo.subs.every(s2 => s2.q.includes('«T»')), '六卦问句均应带时段占位');
  ok(yc.duo.subs[yc.duo.subs.length - 1].k === '验证', '末卦应为验证');
  ok(yc.duo.rules.includes('画面感') || yc.duo.rules.includes('比喻'), '规程须要求画面感,忌流水账');
});
t('问数问期专类:五卦互证、复筮取交集、验证收尾', () => {
  ok(Fenke.GROUPS.includes('问数问期'), '应有问数问期分组');
  for (const id of ['wenshu', 'wenqi']) {
    const f = Fenke.FENKE.find(x => x.id === id);
    ok(f && f.duo && f.duo.subs.length === 5, id + ' 应为五卦互证');
    ok(f.duo.subs.some(s2 => s2.k === '复筮'), id + ' 应含复筮');
    ok(f.duo.subs[f.duo.subs.length - 1].k === '验证', id + ' 末卦应为验证');
    ok(f.duo.rules.includes('独立') && f.duo.rules.includes('可信度'), id + ' 规程须独立互证并给可信度');
  }
  ok(Fenke.FENKE.find(f => f.id === 'wenshu').duo.rules.includes('交集'), '问数须取交集');
  ok(Fenke.FENKE.find(f => f.id === 'wenqi').duo.rules.includes('数路') || Fenke.FENKE.find(f => f.id === 'wenqi').duo.subs.some(s2 => s2.k === '数路'), '问期须含数路');
});
t('日运可择日;月运九卦详占、年运十卦详占(时段卦+路卦交叉印证)', () => {
  const ri = Fenke.FENKE.find(f => f.id === 'riyun');
  ok(ri.dateInput === true, '日运应支持择日');
  ok(ri.ai.includes('将来某日'), '日运规程须含择日断法');
  const yy = Fenke.FENKE.find(f => f.id === 'yueyun');
  ok(yy.duo2 && yy.duo2.subs.length === 9, '月运详占应九卦,实为 ' + (yy.duo2 ? yy.duo2.subs.length : 0));
  const yk = yy.duo2.subs.map(s => s.k).join(',');
  for (const k of ['上旬', '中旬', '下旬', '验证']) ok(yk.includes(k), '月运详占缺 ' + k);
  ok(yy.duo2.rules.includes('交叉印证'), '月运详占须交叉印证');
  const ny = Fenke.FENKE.find(f => f.id === 'nianyun');
  ok(ny.duo2 && ny.duo2.subs.length === 10, '年运详占应十卦,实为 ' + (ny.duo2 ? ny.duo2.subs.length : 0));
  const nk = ny.duo2.subs.map(s => s.k).join(',');
  for (const k of ['一季度', '二季度', '三季度', '四季度', '验证']) ok(nk.includes(k), '年运详占缺 ' + k);
  ok(ny.duo2.rules.includes('交叉印证'), '年运详占须交叉印证');
});
t('每组都有专科,绝大多数科给多法门供选', () => {
  const groups = new Set(Fenke.FENKE.map(f => f.group));
  ok(groups.size >= 10, '组数 ' + groups.size);
  const multi = Fenke.FENKE.filter(f => f.recommend.length >= 2).length;
  ok(multi >= 15, '应有 ≥15 科多法门供选,实为 ' + multi);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
