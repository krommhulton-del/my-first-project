// 命例库抽取器(深造期第一仗,v0.95):把《滴天髓阐微》的命例逐个抽成结构化习题
//
// 缘起:用户 2026-08-02 方向性批评——「水平不够,换词无用;慢慢学专业知识再做软件」。
// 学的教材就是书里的命例:四柱+大运+任氏判语,约五百个,每个都是一道带标准答案的题。
// 规矩(照 v0.76 从格复核):**抽完机器校验——四柱与判语必须在原文里逐字搜得到**,
// 标签只收正则高精度子集(判语里明写「身弱」「旺」「从格」的才收),含糊的标 null 不硬猜。
//
// 跑法:node tools/build-mingli-cases.mjs  → data/mingli-cases.json + 逐类计数
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const raw = readFileSync(join(ROOT, 'data', 'classics', '滴天髓阐微.txt'), 'utf8');
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const GZ = `[${GAN}][${ZHI}]`;
// 命例样式:四柱连排(可带空格),紧跟 3~10 组大运干支,再接判语正文
const CASE_RE = new RegExp(`(${GZ})\\s+(${GZ})\\s+(${GZ})\\s+(${GZ})((?:\\s*${GZ}){3,10})\\s*([^]{20,900}?)(?=(?:${GZ}\\s+${GZ}\\s+${GZ}\\s+${GZ}(?:\\s*${GZ}){3,10})|==|$)`, 'g');

// 章名:取最近的 ==标题==
const chapters = [...raw.matchAll(/^==([^=\n]+)==$/gm)].map(m => ({ at: m.index, name: m[1].trim() }));
const chapterAt = i => { let c = ''; for (const ch of chapters) { if (ch.at < i) c = ch.name; else break; } return c; };

// 标签:只收判语里明写的(高精度正则;写法含糊的标 null,不硬猜)
function labelBand(txt) {
  if (/(日主|日元|身)(甚|太|极)?旺|旺之极|从旺|从强/.test(txt) && !/不旺|虽旺/.test(txt)) return '旺';
  if (/(日主|日元|身)(甚|太|极)?弱|弱之极|(日主|日元)休囚/.test(txt) && !/不弱|虽弱/.test(txt)) return '弱';
  return null;
}
// 从格标签(v1.01 重写)——**头一版是错的,而且错得很凶**:
// 原来只要判语里出现「从财/从杀/从儿/从旺/从强」五个字就收,于是把这三类全收成了「从格」:
//   ① **否定句**:dtsy-077「非前造从强论也」、dtsy-231「不能弃命从杀」——原文明说不是;
//   ② **假设句**:dtsy-079「倘年月时干不杂财官…谓之从强」、dtsy-169「若生丑戌月,为从儿格」
//      (紧接着「生于未月…必以未中丁火为用」,明说这盘不是);
//   ③ **理论讨论**:dtsy-063「故旧有从强之说」、dtsy-416「乃从旺从弱之理」、
//      dtsy-492 把「化气、从气、神气、精气」当术语罗列。
// 后果:34 例的「从格复现率 38.2%」量的是噪声,而 v0.96 记的「从格纹丝不动」也就无从谈起。
// 现在改成:**必须命中肯定式的判语句式,且窗口内不许有否定词或假设词**。
// 判不了的一律标 null(不硬猜)——宁可样本少,不要样本脏。
const CONG_POS = /(其势从|弃命从|作从[财杀儿旺强势气]论|为从[财杀儿旺强势气]格|真从[财杀儿旺强势气]|只得从|宜从|从[财杀儿旺强势气]格也|从[财杀儿旺强势气]是也|以从[财杀儿旺强势气])/;
const CONG_NEG = /(非|不能|不可|不作|不宜|岂能|焉能|莫作|若|倘|如原|之说|之理|之意|旧有)/;
function labelCong(txt) {
  // 先找肯定式句式,再看它所在的那一句里有没有否定/假设/理论标记
  const m = txt.match(CONG_POS);
  if (m) {
    const at = m.index;
    // 取这一句(前后以句读为界)判有没有否定或假设
    const lo = Math.max(0, txt.lastIndexOf('，', at) + 1 || 0);
    const sentStart = Math.max(txt.lastIndexOf('。', at) + 1, txt.lastIndexOf('；', at) + 1, 0);
    const sentEnd = (() => { const a2 = txt.indexOf('。', at), b2 = txt.indexOf('；', at);
      const c2 = [a2, b2].filter(x => x > 0); return c2.length ? Math.min(...c2) : txt.length; })();
    const sent = txt.slice(sentStart, sentEnd);
    if (!CONG_NEG.test(sent)) {
      const k = sent.match(/从([财杀儿旺强势气])/);
      if (k) return '从' + k[1];
    }
  }
  // 明确的否定判语才收「不从」(原文自己说不能从)
  if (/(不能弃命从|不作从[财杀儿旺强势气]论|非[^。；]{0,8}从[财杀儿旺强势气]论|不可从|岂能从|焉能从)/.test(txt)) return '不从';
  return null;
}
function labelOutcome(txt) {
  const good = /(仕至|科甲|连登|发甲|鼎甲|巨富|大富|丰盈|名利两全|寿至|显宦|黄堂|方伯|尚书|侍郎|观察|司马|州牧|县令|遗业丰|万缗|万金)/.test(txt);
  const bad = /(不禄|夭|刑妻克子|克三妻|破败|家业破|落职|诖误|孤苦|贫乏|乞丐|自缢|恶疾|凶灾|刑伤并见|无子|削职)/.test(txt);
  if (good && !bad) return '吉';
  if (bad && !good) return '凶';
  if (good && bad) return '先吉后凶或吉凶互见';
  return null;
}
// 司令回填(v0.96):判语明写节入深浅或司令干的,抽出来喂基线——书给的真值,不用月中近似
const CN_NUM = { 一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10 };
function cnNum(s) {
  if (/^十/.test(s)) return 10 + (CN_NUM[s[1]] || 0);
  if (/十/.test(s)) { const [a,b]=s.split('十'); return (CN_NUM[a]||1)*10 + (CN_NUM[b]||0); }
  return CN_NUM[s] || null;
}
function labelSiling(txt) {
  let m = txt.match(/(?:立春|雨水|惊蛰|春分|清明|谷雨|立夏|小满|芒种|夏至|小暑|大暑|立秋|处暑|白露|秋分|寒露|霜降|立冬|小雪|大雪|冬至|小寒|大寒)后?([一二三四五六七八九十]+)日/);
  if (m) { const d = cnNum(m[1]); if (d && d <= 31) return { days: d, from: m[0] }; }
  m = txt.match(/([甲乙丙丁戊己庚辛壬癸])[木火土金水]?(?:司令|当令|司权|秉令)/);
  if (m) return { gan: m[1], from: m[0] };
  return null;
}
// 用神标签(v1.07 重写)——**头一版与从格标签同一种病**(v1.01 记过):
// 只要「用X」出现就收头一个,逐例回看 24 个旧标签,8 个是假的:
//   ① **两案皆废式**:dtsy-048「用庚金则…用丙火则…即或用火,亦无安顿之运」、
//      dtsy-476「用土则金多气泄,用木则金锐木凋」——列出来的每一味都是被否掉的;
//   ② **俗论引述**:dtsy-093「以俗论之…此造必以木为用,以致吉凶颠倒」——抄的是被驳的错法;
//   ③ **明写不用**:dtsy-449「其不用火者,身衰之故也」——标签却是火;
//   ④ **抓错了行**:dtsy-259 原文明写「以火为用,以木为喜」,第一个「用」字却抓出个金;
//   ⑤ **随窗带进的章首理论**:dtsy-362/403/410——「生于冬末春初…必须用金伐木」是泛论季节,
//      「用金以顺其势」讲的是水奔之局的通则,都不是这一盘的判语(判语窗口会吞进下一章的理论,
//      见 _meta.已知边界)。
// 后果:「用神 45.8%」有三分之一量的是噪声。规矩照 labelCong:
//   只收**肯定式判语句**;句内有否定/假设/枚举/泛论标记即弃;句子必须**钉在这一盘上**
//   (此造/日主/生于某月/行运出身这类锚);「以X为用」是最强的显式句式,一旦出现以它为准;
//   两味以上都被肯定(理论列举)判不了,标 null 不硬猜——宁可样本少,不要样本脏。
function labelYong(txt0) {
  // 判语窗口会吞进**下一章的〔原注〕与任氏曰理论**(dtsy-259 教的:窗口尾巴里
  // 「如寅月生人…或喜火以化之,或用金以制之」是何知章的通则,不是这一例的判语)——
  // 标签只从这一例自己的注文里取,见到章首理论的标志就把后面整段裁掉。
  const txt = txt0.split(/任氏曰|〔原注|原注[:：]/)[0];
  const sents = txt.split(/[。；;？?！!]/);
  // 两类坏标记要分开管辖(dtsy-209 教的:「此造以俗论之…中得用水,不能用火矣」一句里
  // 前半引俗论、末尾才是真判语——俗论只管它那一小节,不能把整句的真判语一起否掉):
  //   SCOPE(假设/泛论):管到句尾——若/倘 之后整段都是假设,凡 之后整段都是通则;
  //   QUOTE(引述错法):只管它自己那一小节与紧邻的下一小节(「以俗论之,前造必以金水为用」)。
  const SCOPE = /(即或|若|倘|如用|凡|岂能|焉能|之说|之理)/;
  const QUOTE = /(俗论|或曰|旧有)/;
  const ANCHOR = /(此造|此与|前造|日主|日元|[年月日时天][干支]|大?运|生于[孟仲季]?[春夏秋冬]|生于[子丑寅卯辰巳午未申酉戌亥]月|[甲乙丙丁戊己庚辛壬癸][金木水火土]?生|科甲|登科|出仕|入泮|发甲|出身|妙在|喜其|喜得)/;
  let explicit = null; const found = new Set();
  for (const s0 of sents) {
    // 剥掉对另一味的否定(「中得用水,不能用火矣」——否定的是火,别拖累同句对水的肯定)
    const s = s0.replace(/(不能用|不用|非用|莫用)[金木水火土]/g, '');
    if (SCOPE.test(s)) continue;
    if (/[春夏秋冬]末[春夏秋冬]初/.test(s)) continue;   // 泛论季节段,章首理论的标志
    const anchored = ANCHOR.test(s);
    const clauses = s.split('，');
    for (let ci = 0; ci < clauses.length; ci++) {
      const c = clauses[ci];
      if (QUOTE.test(c) || (ci > 0 && QUOTE.test(clauses[ci - 1]))) continue;
      if (/^\s*或/.test(c)) continue;                    // 「或喜火以化之,或用金以制之」是并列选项
      let m = c.match(/以([金木水火土])为用/);
      // 「以X为用」是最强的显式句式,不要求句内另有锚(dtsy-259 的「以火为用,以木为喜」
      // 整句都在说取用本身,没有别的锚,但它正是判语)
      if (m) { if (!explicit) explicit = m[1]; found.add(m[1]); continue; }
      if (!anchored) continue;                           // 非显式句式要求句内有锚,泛论句不收
      m = c.match(/(?:必须|只得|专|中得|足以|只可)用([金木水火土])/) ||
          c.match(/用([金木水火土])明矣/) ||
          c.match(/用([金木水火土])以[^，。;；]{1,6}之/) ||
          c.match(/用([金木水火土])[敌制去]./);
      if (!m) continue;
      if (new RegExp(`用${m[1]}[^，。;；]{0,10}则`).test(s)) continue;  // 「用X则…」是枚举选项不是判语
      found.add(m[1]);
    }
  }
  if (explicit) return explicit;
  if (found.size === 1) return [...found][0];
  return null;
}

const cases = [];
let mIdx = 0;
for (const m of raw.matchAll(CASE_RE)) {
  mIdx++;
  const four = [m[1], m[2], m[3], m[4]].join(' ');
  const dayun = m[5].trim().split(/\s+/).filter(x => new RegExp(`^${GZ}$`).test(x));
  const ju = m[6].replace(/\s+/g, ' ').trim();
  // 机器校验:四柱原样(允许原文里带空白差异)与判语头一截必须在原文搜得到
  const fourFlat = four.replace(/\s+/g, '');
  const rawFlat = raw.replace(/\s+/g, '');
  if (!rawFlat.includes(fourFlat)) continue;
  const juProbe = ju.replace(/\s+/g, '').slice(0, 18);
  if (juProbe.length >= 12 && !rawFlat.includes(juProbe)) continue;
  if (ju.length < 30) continue;                      // 太短的多半是切错了
  cases.push({
    id: 'dtsy-' + String(cases.length + 1).padStart(3, '0'),
    four, dayun, chapter: chapterAt(m.index),
    judgment: ju.slice(0, 600),
    labels: { band: labelBand(ju), cong: labelCong(ju), outcome: labelOutcome(ju), yong: labelYong(ju), siling: labelSiling(ju) },
  });
}

const stat = { total: cases.length, band: 0, cong: 0, outcome: 0, yong: 0, siling: 0 };
for (const c of cases) for (const k of ['band', 'cong', 'outcome', 'yong', 'siling']) if (c.labels[k]) stat[k]++;
const out = {
  _meta: {
    源: '《滴天髓阐微》(data/classics/滴天髓阐微.txt,简体转录),抽取器 tools/build-mingli-cases.mjs',
    规矩: '四柱与判语逐字核回原文;标签只收判语明写的(正则高精度子集),含糊标 null 不硬猜;判语截 600 字',
    已知边界: [
      '命例只给四柱,不给出生年月日——人元司令的节入深浅无从得知,基线一律按月中(第 15 天)近似,这是系统性近似,照实记',
      '标签是正则抽的高精度子集,覆盖不全:没标上的不等于书里没说,只等于机器不敢确定',
      '判语切分按「下一命例出现处」为界,个别长注可能被截断',
    ],
    统计: stat,
  },
  cases,
};
writeFileSync(join(ROOT, 'data', 'mingli-cases.json'), JSON.stringify(out, null, 1));
console.log(`共抽得 ${stat.total} 例(四柱+判语逐字核回原文)`);
console.log(`带旺衰标签 ${stat.band} · 从格 ${stat.cong} · 吉凶 ${stat.outcome} · 用神 ${stat.yong} · 司令明文 ${stat.siling}`);
