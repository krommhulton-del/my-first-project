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
function labelCong(txt) {
  const m = txt.match(/从(财|杀|儿|旺|强|势|气)/);
  return m ? '从' + m[1] : (/(不|岂能|焉能)从/.test(txt) ? '不从' : null);
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
function labelYong(txt) {
  const m = txt.match(/(?:只可|专|当|必须|还须|仍须)?用([金木水火土])(?!局)/) || txt.match(/以([金木水火土])为用/);
  return m ? m[1] : null;
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
