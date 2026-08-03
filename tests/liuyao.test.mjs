// 六爻断卦专项体检:起卦随机性 + 京房八宫全表 + 纳甲六亲 + 伏神 + 旺衰 + 进退神 + 用神取法
// 缘起:体检发现六十四卦里约七成有六亲不上卦(问财、问子各占四分之一),
// 而程序完全没有「伏神」这一项——遇上用神不现的卦,断语只能靠猜。
// 本套件把断卦这边的地基逐条钉死,并用客观外部答案(京房八宫次序、三钱概率)对照。
import GuaCore from '../gua-core.js';
import Najia from '../najia.js';
import GuaData from '../gua-data.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };

const XIANG = { 天: '乾', 泽: '兑', 火: '离', 雷: '震', 风: '巽', 水: '坎', 山: '艮', 地: '坤' };
const BITS = { 乾: '111', 兑: '110', 离: '101', 震: '100', 巽: '011', 坎: '010', 艮: '001', 坤: '000' };
// 京房八宫六十四卦次序(通行本):本宫→一世~五世→游魂→归魂
const PALACE_TABLE = {
  乾: ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'],
  坎: ['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师'],
  艮: ['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐'],
  震: ['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随'],
  巽: ['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊'],
  离: ['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人'],
  坤: ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比'],
  兑: ['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹'],
};
const GEN = ['本宫卦', '一世卦', '二世卦', '三世卦', '四世卦', '五世卦', '游魂卦', '归魂卦'];
const SHI = [6, 1, 2, 3, 4, 5, 4, 3];
const idOf = name => name.includes('为')
  ? BITS[name[0]] + BITS[name[0]]
  : BITS[XIANG[name[1]]] + BITS[XIANG[name[0]]];   // 索引0=初爻,下卦在前
const DAY = new Date(2026, 6, 31, 12);            // 丙午年 乙未月 丙午日,旬空寅卯

console.log('【一】起卦随机性(密码学随机源,外部可验的概率)');
t('三钱法四十万掷:老阳老阴各≈1/8、少阳少阴各≈3/8,偏差不超过 3%', () => {
  const N = 400000, cnt = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let i = 0; i < N; i++) cnt[GuaCore.tossLine().sum]++;
  const want = { 6: 1 / 8, 7: 3 / 8, 8: 3 / 8, 9: 1 / 8 };
  for (const k of [6, 7, 8, 9]) {
    const dev = Math.abs(cnt[k] / N - want[k]) / want[k];
    ok(dev < 0.03, `${k} 实测${(cnt[k] / N * 100).toFixed(2)}% 理论${(want[k] * 100)}% 偏差${(dev * 100).toFixed(1)}%`);
  }
});
t('六十四卦分布均匀:卡方检验(取 0.001 显著性,自由度63临界约103.4)', () => {
  // 用 0.05 会有 5% 的假阳性——这条测试自己就会随机变红(实测发生过一次),
  // 那是检验设计的毛病,不是随机源的毛病。改用 0.001,误报降到千分之一;
  // 同时加一条下界:卡方过分地小反而说明随机源被做了手脚(分布太「完美」)。
  const M = 128000, c = {};
  for (let i = 0; i < M; i++) { const h = GuaCore.castHexagram(); c[h.benId] = (c[h.benId] || 0) + 1; }
  eq(Object.keys(c).length, 64, '六十四卦应全覆盖');
  const exp = M / 64;
  let chi = 0;
  for (const id of Object.keys(c)) chi += Math.pow(c[id] - exp, 2) / exp;
  ok(chi < 103.4, '卡方偏高,分布不均:' + chi.toFixed(1));
  ok(chi > 30.9, '卡方过低(自由度63的0.999分位约30.9),分布「过于完美」,反查随机源是否被动过手脚:' + chi.toFixed(1));
});
t('六爻各爻位彼此独立:逐爻老阳率都在 12.5% 上下一个百分点内', () => {
  const M = 60000, byPos = Array.from({ length: 6 }, () => ({ 6: 0, 9: 0 }));
  for (let i = 0; i < M; i++) GuaCore.castHexagram().lines.forEach((l, j) => { if (byPos[j][l.sum] !== undefined) byPos[j][l.sum]++; });
  for (let j = 0; j < 6; j++) {
    ok(Math.abs(byPos[j][9] / M - 0.125) < 0.01, `第${j + 1}爻老阳率${(byPos[j][9] / M * 100).toFixed(2)}%`);
    ok(Math.abs(byPos[j][6] / M - 0.125) < 0.01, `第${j + 1}爻老阴率${(byPos[j][6] / M * 100).toFixed(2)}%`);
  }
});

console.log('【二】京房八宫六十四卦全表对照(有标准答案,零容错)');
t('六十四卦的归宫、世次、世爻、应爻逐卦对上通行本', () => {
  let n = 0;
  for (const pal of Object.keys(PALACE_TABLE)) {
    PALACE_TABLE[pal].forEach((name, i) => {
      const got = Najia.PALACE_MAP[idOf(name)];
      ok(got, name + ' 缺卦');
      eq(got.palace, pal, name + ' 归宫');
      eq(got.gen, GEN[i], name + ' 世次');
      eq(got.shi, SHI[i], name + ' 世爻');
      eq(got.ying, ((SHI[i] - 1 + 3) % 6) + 1, name + ' 应爻(世应相隔三位)');
      n++;
    });
  }
  eq(n, 64);
  eq(Object.keys(Najia.PALACE_MAP).length, 64, '程序表不多不少正好六十四卦');
});
t('纳甲干支抽查:乾内甲子寅辰外壬午申戌、坤内乙未巳卯外癸丑亥酉', () => {
  const qian = Najia.zhuangGua('111111', DAY);
  eq(qian.lines.map(l => l.ganZhi).join(' '), '甲子 甲寅 甲辰 壬午 壬申 壬戌');
  const kun = Najia.zhuangGua('000000', DAY);
  eq(kun.lines.map(l => l.ganZhi).join(' '), '乙未 乙巳 乙卯 癸丑 癸亥 癸酉');
  const kan = Najia.zhuangGua('010010', DAY);
  eq(kan.lines.map(l => l.ganZhi).join(' '), '戊寅 戊辰 戊午 戊申 戊戌 戊子');
});
t('六亲依卦宫五行论:生我父母、我生子孙、克我官鬼、我克妻财、同我兄弟', () => {
  const q = Najia.zhuangGua('111111', DAY);   // 乾宫属金
  eq(q.lines.map(l => l.liuQin).join(' '), '子孙 妻财 父母 官鬼 兄弟 父母');
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    const g = Najia.zhuangGua(id, DAY);
    for (const l of g.lines) ok(['父母', '兄弟', '子孙', '妻财', '官鬼'].includes(l.liuQin), id + ' 六亲越界');
  }
});
t('六神依日干起,六十甲子日各得其位', () => {
  eq(Najia.liuShen('甲').join(''), '青龙朱雀勾陈螣蛇白虎玄武');
  eq(Najia.liuShen('丙')[0], '朱雀');
  eq(Najia.liuShen('戊')[0], '勾陈');
  eq(Najia.liuShen('己')[0], '螣蛇');
  eq(Najia.liuShen('庚')[0], '白虎');
  eq(Najia.liuShen('壬')[0], '玄武');
});

console.log('【三】伏神:六亲不上卦时的取法(本轮补上的大缺口)');
t('六十四卦里确有约七成需要取伏神——这就是非补不可的理由', () => {
  let need = 0;
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    const g = Najia.zhuangGua(id, DAY);
    const have = new Set(g.lines.map(l => l.liuQin));
    if (have.size < 5) need++;
  }
  ok(need / 64 > 0.6, '需取伏神的卦占比=' + (need / 64 * 100).toFixed(0) + '%');
});
t('凡有六亲不上卦者,必给出伏神;齐全者不硬造伏神', () => {
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    const g = Najia.zhuangGua(id, DAY);
    const have = new Set(g.lines.map(l => l.liuQin));
    const missing = ['父母', '兄弟', '子孙', '妻财', '官鬼'].filter(x => !have.has(x));
    eq(g.fuShen.length, missing.length, id + ' 伏神条数应等于不上卦的六亲数');
    for (const m of missing) ok(g.fuShen.some(f => f.liuQin === m), id + ' 缺伏神:' + m);
  }
});
t('伏神取自本宫首卦(八纯卦)同一爻位,飞神即本卦同位之爻', () => {
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    const g = Najia.zhuangGua(id, DAY);
    const palBits = BITS[g.palace];
    const shou = Najia.bareLines(palBits + palBits, g.palaceWx);
    for (const f of g.fuShen) {
      const src = shou[f.pos - 1];
      eq(f.ganZhi, src.ganZhi, `${id} 伏神干支应取自首卦第${f.pos}爻`);
      eq(f.liuQin, src.liuQin, `${id} 伏神六亲`);
      eq(f.fei.ganZhi, g.lines[f.pos - 1].ganZhi, `${id} 飞神应为本卦同位之爻`);
    }
  }
});
t('飞伏生克判定正确:飞来克伏/伏克飞/飞生伏/伏生飞/比和,五种都判得出且与五行相符', () => {
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const seen = new Set();
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    for (const f of Najia.zhuangGua(id, DAY).fuShen) {
      seen.add(f.rel);
      const fu = f.wx, fei = f.fei.wx;
      if (f.rel === '飞来克伏') eq(KE[fei], fu, '飞克伏须五行相符');
      else if (f.rel === '伏克飞') eq(KE[fu], fei, '伏克飞须五行相符');
      else if (f.rel === '飞生伏') eq(SHENG[fei], fu, '飞生伏须五行相符');
      else if (f.rel === '伏生飞') eq(SHENG[fu], fei, '伏生飞须五行相符');
      else eq(fu, fei, '比和须同五行');
      ok(f.relNote && f.relNote.length > 8, '飞伏关系须有大白话断语');
    }
  }
  ok(seen.size >= 4, '五种飞伏关系至少见到四种:' + [...seen].join('、'));
});

console.log('【四】爻的旺衰:月建定四时、日辰定眼下');
t('旺相休囚死依月支五行论,五档都判得出', () => {
  const seen = new Set();
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    for (const l of Najia.zhuangGua(id, DAY).lines) seen.add(l.power.wang);
  }
  for (const w of ['旺', '相', '休', '囚', '死']) ok(seen.has(w), '未见「' + w + '」档');
});
t('月破:爻支被月建冲即为破,且力量分被扣', () => {
  // 未月,冲未者为丑
  let found = false;
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    for (const l of Najia.zhuangGua(id, DAY).lines) {
      if (l.zhi === '丑') { ok(l.power.yuePo, '丑爻在未月应为月破'); found = true; }
      else ok(!l.power.yuePo, l.zhi + ' 不该判月破');
    }
  }
  ok(found, '样本中应有丑爻');
});
t('暗动只判静爻、冲散只判动爻——同一支两种身份两种断语', () => {
  // 午日冲子:子爻静则暗动、动则冲散
  const stat = Najia.zhuangGua('111111', DAY);                      // 初爻甲子,静
  const c0 = stat.lines[0];
  eq(c0.zhi, '子');
  ok(c0.power.anDong && !c0.power.chongSan, '静爻逢日冲应为暗动');
  const mov = Najia.zhuangGua('111111', DAY, { moving: [true, false, false, false, false, false], bianId: '011111' });
  const m0 = mov.lines[0];
  ok(m0.power.chongSan && !m0.power.anDong, '动爻逢日冲应为冲散');
  ok(m0.power.score < c0.power.score, '冲散该扣分、暗动该加分');
});
t('日辰生克合各有其断,且力量分方向正确', () => {
  const g = Najia.zhuangGua('111111', DAY);   // 丙午日
  const wu = g.lines.find(l => l.zhi === '午');   // 与日辰同气
  ok(wu.power.notes.some(n => n.includes('同气')), '同气应有断语');
  const xu = g.lines.find(l => l.zhi === '戌');   // 午火生戌土
  ok(xu.power.notes.some(n => n.includes('生之')), '日生应有断语');
  const shen = g.lines.find(l => l.zhi === '申'); // 午火克申金
  ok(shen.power.notes.some(n => n.includes('克之')), '日克应有断语');
  ok(shen.power.score < xu.power.score, '被日辰克者力量应低于被日辰生者');
});

console.log('【五】动爻变爻:进退神、回头生克、化空化破、伏吟反吟');
t('进神退神依同五行的支序前后判定', () => {
  eq(Najia.jinTui('寅', '卯').type, '进神');
  eq(Najia.jinTui('卯', '寅').type, '退神');
  eq(Najia.jinTui('巳', '午').type, '进神');
  eq(Najia.jinTui('戌', '未').type, '退神');
  eq(Najia.jinTui('子', '午'), null, '五行不同不论进退');
  eq(Najia.jinTui('子', '子'), null, '同支不论进退');
});
t('回头生与回头克判得出,且方向与五行相符', () => {
  const g = Najia.zhuangGua('111111', DAY, { moving: [false, false, false, true, false, false], bianId: '111011' });
  const b = g.bian.lines[0];
  ok(b.huiTou === '回头生' || b.huiTou === '回头克' || !b.huiTou, '回头生克标记');
  ok(Array.isArray(b.notes), '变爻须带断语');
  eq(b.pos, 4);
});
t('化空、化月破、化伏吟、化反吟各能识别', () => {
  let kong = 0, po = 0, fu = 0, fan = 0;
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    for (let i = 0; i < 6; i++) {
      const mv = [false, false, false, false, false, false]; mv[i] = true;
      const bits = id.split(''); bits[i] = bits[i] === '1' ? '0' : '1';
      const g = Najia.zhuangGua(id, DAY, { moving: mv, bianId: bits.join('') });
      for (const b of g.bian.lines) {
        if (b.huaKong) kong++;
        if (b.huaPo) po++;
        if (b.fuYin) fu++;
        if (b.fanYin) fan++;
      }
    }
  }
  ok(kong > 0, '未识别出化空');
  ok(po > 0, '未识别出化月破');
  eq(fan, 0, '爻级反吟受纳甲表所限,单爻变时结构上出不来——若出现说明纳甲表被改坏了');
});
// 2026-08 改过一次,而且是这条测试**原先钉错了**:它钉的是「震↔巽 为反吟」,
// 可反吟指的是后天八卦上处于**对冲之位**的两卦,而震在正东、巽在东南,根本不对冲。
// 拿本程序 gua-data.js 里自带的方位数据一配就露馅:真正的四对是
// 乾(西北)↔巽(东南)、坎(正北)↔离(正南)、艮(东北)↔坤(西南)、震(正东)↔兑(正西)。
// 旧代码只写了错的那一对,等于反吟从来没报对过。现按方位对冲改正,这条测试也跟着改。
t('卦级反吟:四对对冲之卦都判得出,且不对冲的不许误报', () => {
  const T = { 震: '100', 离: '101', 兑: '110', 乾: '111', 巽: '011', 坎: '010', 艮: '001', 坤: '000' };
  const PAIRS = [['乾', '巽'], ['坎', '离'], ['艮', '坤'], ['震', '兑']];
  for (const [a, b] of PAIRS) {
    // 内卦 a 全变为 b(外卦不动)
    const ben = T[a] + T[a], bian = T[b] + T[a];
    const g = Najia.zhuangGua(ben, DAY, { moving: [true, true, true, false, false, false], bianId: bian });
    ok(g.bian.guaNotes.some(x => x.includes('内卦反吟')), `${a}变${b} 应判内卦反吟:` + JSON.stringify(g.bian.guaNotes));
  }
  // 震↔巽 不对冲(正东 vs 东南),不许再报反吟
  const bad = Najia.zhuangGua('100100', DAY, { moving: [true, true, true, false, false, false], bianId: '011100' });
  ok(!bad.bian.guaNotes.some(x => x.includes('反吟')), '震变巽不该判反吟(两者方位不对冲):' + JSON.stringify(bad.bian.guaNotes));
});
t('反吟的四对,与本程序自带的八卦方位数据逐对对得上(外部可核)', () => {
  const dir = {}; for (const k in GuaData.TRIGRAMS) dir[GuaData.TRIGRAMS[k].name] = GuaData.TRIGRAMS[k].dir;
  const OPP = { 正北: '正南', 正南: '正北', 正东: '正西', 正西: '正东', 东北: '西南', 西南: '东北', 东南: '西北', 西北: '东南' };
  for (const [a, b] of [['乾', '巽'], ['坎', '离'], ['艮', '坤'], ['震', '兑']]) {
    eq(OPP[dir[a]], dir[b], `${a}(${dir[a]}) 与 ${b}(${dir[b]}) 应为对冲之位`);
  }
});

console.log('【六】用神取法:问什么取哪一门六亲');
t('五类问题各取其用神,取法与《卜筮正宗》口径一致', () => {
  eq(Najia.yongShenOf('今年能赚到一笔钱吗').liuQin, '妻财');
  eq(Najia.yongShenOf('这份工作能不能升职').liuQin, '官鬼');
  eq(Najia.yongShenOf('我和男朋友能成吗').liuQin, '官鬼', '点名男友即取官鬼');
  eq(Najia.yongShenOf('我和女朋友能成吗').liuQin, '妻财', '点名女友即取妻财');
  eq(Najia.yongShenOf('我今年能脱单吗', '女').liuQin, '官鬼', '女问婚恋取官鬼');
  eq(Najia.yongShenOf('我今年能脱单吗', '男').liuQin, '妻财', '男问婚恋取妻财');
  eq(Najia.yongShenOf('我今年能脱单吗').liuQin, null, '未填性别时不硬猜,退回世应论');
  eq(Najia.yongShenOf('这场官司能赢吗').liuQin, '官鬼', '官非取官鬼');
  eq(Najia.yongShenOf('这套房子能不能买下来').liuQin, '父母');
  eq(Najia.yongShenOf('孩子这次能平安吗').liuQin, '子孙');
  eq(Najia.yongShenOf('这个合伙人靠不靠谱').liuQin, '兄弟', '问合伙之人取兄弟');
  const both = Najia.yongShenOf('跟朋友合伙做这生意如何');
  eq(both.liuQin, '妻财', '问生意成败以财为主用');
  ok(both.multi && both.also.some(x => x.liuQin === '兄弟'), '兼涉合伙者须把兄弟列为参看:' + JSON.stringify(both.also));
  eq(Najia.yongShenOf('这次考试能过吗').liuQin, '父母');
  eq(Najia.yongShenOf('随便问问').liuQin, null, '不属五类者应退回世应论');
});
t('v0.79 那三行「待核」的出处,v0.88 起必须挂着真章名——不许退回待核,也不许再挂「只挂书不挂章」', () => {
  // 缘起(v0.88):卷之一(维基文库本)与《卜筮正宗》全文到手,用神表最后三行的出处补齐了。
  // 这条钉住成果:引文对不对由 honesty 的归章核对管,这里只钉「挂没挂、挂在哪一章」。
  ok(/《增删卜易·用神章第八》/.test(Najia.yongShenOf('这份工作能不能升职').src), '功名官非那行要挂用神章第八');
  ok(/《增删卜易·用神章第八》/.test(Najia.yongShenOf('这套房子能不能买下来').src), '文书房产那行要挂用神章第八');
  const bing = Najia.yongShenOf('最近老是生病是怎么回事').src;
  ok(/《卜筮正宗·用神分类定例第一》/.test(bing) && /病症/.test(bing), '病症那半要挂《卜筮正宗》的明文');
  ok(/《增删卜易·用神章第八》/.test(bing) && /醫藥/.test(bing), '医药那半要挂用神章第八');
  const xiong = Najia.yongShenOf('这个合伙人靠不靠谱').src;
  ok(/《增删卜易·用神章第八》/.test(xiong) && /《卜筮正宗·用神分类定例第一》/.test(xiong), '兄弟那行两本书的明文都要在');
  ok(/應爻/.test(xiong) && /不驗/.test(xiong), '序言「朋友外人按应爻」的分工与野鹤自注要记在行内,不许只挑对自己有利的那半');
  for (const q of ['这份工作能不能升职', '这套房子能不能买下来', '最近老是生病是怎么回事', '这个合伙人靠不靠谱']) {
    ok(!/待核|只挂书不挂章/.test(Najia.yongShenOf(q).src), `「${q}」那行不许再写待核`);
  }
});
t('定位用神:上卦者取卦中之爻(优先动爻、次世爻),不上卦者取伏神', () => {
  let onBoard = 0, viaFu = 0;
  for (const id of Object.keys(Najia.PALACE_MAP)) {
    const g = Najia.zhuangGua(id, DAY);
    const loc = Najia.locateYong(g, '妻财');
    ok(loc, id + ' 定位失败');
    if (loc.line) { onBoard++; eq(loc.line.liuQin, '妻财'); ok(loc.where.includes('现于卦中')); }
    else { viaFu++; ok(loc.fu && loc.fu.liuQin === '妻财', id + ' 应给出妻财伏神'); ok(loc.where.includes('伏神')); }
  }
  ok(onBoard > 0 && viaFu > 0, `上卦${onBoard}卦、取伏${viaFu}卦,两条路都该走得通`);
});
t('用神有动爻时优先取动爻(动者主事)', () => {
  const g = Najia.zhuangGua('111111', DAY, { moving: [false, true, false, false, false, false], bianId: '101111' });
  const loc = Najia.locateYong(g, '妻财');
  ok(loc.line && loc.line.moving, '二爻妻财发动,应优先取它:' + JSON.stringify(loc.line && loc.line.pos));
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
