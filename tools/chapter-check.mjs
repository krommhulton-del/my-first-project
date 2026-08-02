// 引文归章核对:挂了「《某书·某章》」,那句话就得真的落在那一章里
//
// 缘起(v0.79):补「逐事用神细目表」的出处时,顺手查了一件此前没人查过的事——
// 我们的引文核对(honesty.test.mjs)只验「这句话在这本书里搜得到」,
// **没验「它是不是出自所标的那一章」**。查下来两件事:
//   ① 《增删卜易》这份转录里,**卷之一(第一章到第二十六章)只有章名、没有正文**,
//      46 个 === 标题里 30 个是空壳;正文从卷之二起才有。
//      而 najia.js 曾挂着「《增删卜易·用神章第八》」——那一章正是空的,等于挂了个查不到的出处。
//   ② najia.js 的旬空那条引文标的是「旬空章第二十六」(也在卷之一、空的),
//      而那句话实际落在卷之二后段。章名挂错了。
// 这两件都是本项目铁律明令禁止的「挂书名冒充有据」,只是躲过了旧的检查方式。
//
// 跑法:node tools/chapter-check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// 转录里的痕迹(<br> 之类)与标点一律抹掉再比,免得连真引文都核不过
export const strip = x => String(x).replace(/<br\s*\/?>/gi, '')
  .replace(/\/\//g, '')     // 引文常跨几行注释,行首的 // 是代码不是正文
  .replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒﹕﹔﹑]/g, '');
// 章名比对要宽一格:书里排作「十七、衰旺」,我们习惯写「衰旺章」,指的是同一章。
// 故比对前把序号、「章」「第X」这些外壳剥掉,只留章名本身。
// 简繁不该算两章:引文照原文写繁体,而我们注释里习惯写简体,指的是同一章。
const S2T = { 进: '進', 退: '退', 伏: '伏', 变: '變', 动: '動', 静: '靜', 应: '應', 断: '斷',
  卜: '卜', 术: '術', 财: '財', 亲: '親', 门: '門', 类: '類', 总: '總', 归: '歸', 游: '遊',
  随: '隨', 独: '獨', 两: '兩', 现: '現', 杀: '殺', 数: '數', 时: '時', 将: '將', 辰: '辰' };
const chapKey = x => String(x).replace(/[\u4e00-\u9fa5]/g, c => S2T[c] || c)
  .replace(/^[一二三四五六七八九十百零又]+[、.·]\s*/, '')
  .replace(/章?第[一二三四五六七八九十百又零]+$/, '')
  .replace(/章$/, '')
  .replace(/[\s、·]/g, '');
export { chapKey };

// 一本书切成章:两种排法都认——① === 章名 === ② 独占一行的「某某章第几」
export function chaptersOf(book) {
  const raw = readFileSync(join(ROOT, 'data', 'classics', book + '.txt'), 'utf8');
  const flat = raw.replace(/<br\s*\/?>/gi, '\n');
  const marks = [];
  for (const m of flat.matchAll(/^\s*=+\s*(.+?)\s*=+\s*$/gm)) marks.push({ at: m.index, len: m[0].length, name: m[1] });
  for (const m of flat.matchAll(/^\s*([^\s=]{2,24}章第[一二三四五六七八九十百又零]+)\s*$/gm)) {
    if (!marks.some(x => x.at === m.index)) marks.push({ at: m.index, len: m[0].length, name: m[1] });
  }
  // 《子平真诠》那种「一．论十干十二支」的排法(全角点),也得认出来,否则整本书切不出章
  for (const m of flat.matchAll(/^\s*([一二三四五六七八九十百零又]+[．.、][^\s]{2,22})\s*$/gm)) {
    if (!marks.some(x => x.at === m.index)) marks.push({ at: m.index, len: m[0].length, name: m[1] });
  }
  marks.sort((a, b) => a.at - b.at);
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const s = marks[i].at + marks[i].len;
    const e = i + 1 < marks.length ? marks[i + 1].at : flat.length;
    out.push({ name: marks[i].name, from: strip(flat.slice(0, s)).length, body: strip(flat.slice(s, e)) });
  }
  return { flat, flatS: strip(flat), chapters: out };
}

// 目录列了、正文里却没有独立标题的章——那种地方**归章判不了**,不能硬判。
// 缘起(v0.79,自己的工具先误报了自己):《增删卜易》目录列 133 章,正文只有 98 个标题。
// 例如「星煞章第三十三」「增刪黃金策千金賦章第三十四」两章正文俱在、标题却没了,
// 于是它们的内容全被算进上一个有标题的「兩現章第三十二」名下。
// 第一版就这么把三处正确的引文误判成「归章不符」,还差点让我照着改错。
export function tocGaps(book) {
  const raw = readFileSync(join(ROOT, 'data', 'classics', book + '.txt'), 'utf8');
  const flat = raw.replace(/<br\s*\/?>/gi, '\n');
  // 目录段:从「目錄」那一行起,到正文第一卷的标题为止。
  // 留神:「卷之一」在目录里自己也出现,所以起点要取目录标题之后、终点要取**目录之后**第一处正文卷首。
  const a = flat.indexOf('目錄');
  if (a < 0) return { toc: [], missing: new Set() };
  // 只认二级标题(== … ==)作正文起点;目录里自己也有个 === 卷之一 ===,
  // 第一版取了它,于是目录段被切成空的,缺标题一个也查不出来(工具第二次自己骗自己,照实记)。
  const m0 = flat.slice(a).match(/^==\s*[^=\n]*卷之一[^=\n]*==\s*$/m);
  const b = m0 ? a + m0.index : flat.length;
  const toc = [...flat.slice(a, b).matchAll(/([^\s，,、。]{2,24}章第[一二三四五六七八九十百又零]+)/g)].map(m => m[1]);
  const names = chaptersOf(book).chapters.map(c => c.name);
  const body = new Set(names);
  // 目录与正文的章名常有出入(目录「進退章第二十九」,正文「進神退神章第二十九」),
  // 那不是缺标题,只是同章异名。故再按**章序号**(第X)对一遍。
  const ord = x => (String(x).match(/第[一二三四五六七八九十百又零]+/) || [''])[0];
  const bodyOrd = new Set(names.map(ord).filter(Boolean));
  return { toc, missing: new Set(toc.filter(n => !body.has(n) && !bodyOrd.has(ord(n)))) };
}

// 一句引文实际落在哪一章
export function chapterOfQuote(book, quote) {
  const { flatS, chapters } = chaptersOf(book);
  const k = flatS.indexOf(strip(quote));
  if (k < 0) return { found: false };
  let hit = null, idx = -1;
  for (let i = 0; i < chapters.length; i++) { if (chapters[i].from <= k) { hit = chapters[i]; idx = i; } else break; }
  if (!hit) return { found: true, at: k, chapter: '(卷首,不在任何章内)', ambiguous: false };
  // 这一段后面是不是接着几个「目录有、正文没标题」的章?是就说明这一段的归属判不了
  const { toc, missing } = tocGaps(book);
  const ti = toc.indexOf(hit.name);
  let ambiguous = false, couldBe = [hit.name];
  if (ti >= 0) {
    const nextBody = idx + 1 < chapters.length ? chapters[idx + 1].name : null;
    for (let j = ti + 1; j < toc.length && toc[j] !== nextBody; j++) {
      if (missing.has(toc[j])) { ambiguous = true; couldBe.push(toc[j]); } else break;
    }
  }
  return { found: true, at: k, chapter: hit.name, ambiguous, couldBe };
}

// 源码里所有形如「出处:《书·章》…「引文」」的地方
export function citationsIn(files) {
  const out = [];
  for (const f of files) {
    const txt = readFileSync(join(ROOT, f), 'utf8');
    // 引文常跨几行注释,所以「》」与「「」之间允许换行与 // ——第一版没允许,
    // 于是把带引文的条目误报成「没带引文」(自己的工具先误报了自己,照实记)。
    // 引文常跨几行注释,所以「》」与「「」之间允许换行与 //。但**不许跨句号**——
    // 第一版没拦句号,于是把一句普通说明里的「…」当成引文抓了进来,凭空报错(自己的工具先误报了自己)。
    for (const m of txt.matchAll(/出处:《([^》·]+)·?([^》]*)》[^「。]{0,60}「([^」]{6,})」/gs)) {
      out.push({ file: f, book: m[1], chapter: m[2], quote: m[3] });
    }
    // 没带引文、只挂了书与章的,也要收——那种最容易蒙混过关
    for (const m of txt.matchAll(/出处:《([^》·]+)·([^》]+)》(?![^「。]{0,60}「)/gs)) {
      out.push({ file: f, book: m[1], chapter: m[2], quote: null });
    }
  }
  return out;
}

const SRC = ['najia.js', 'bazi.js', 'geju.js', 'yingqi.js', 'chuduan.js', 'dashi.js'];

if (process.argv[1] && process.argv[1].endsWith('chapter-check.mjs')) {
  const cites = citationsIn(SRC);
  console.log(`共 ${cites.length} 处挂了「书·章」的出处\n`);
  let bad = 0;
  for (const c of cites) {
    let msg, ok = true;
    if (!c.quote) {
      // 不带引文的出处,退一步也要过一关:**所挂那一章在书里得有正文**。
      // 挂到一个只有章名、没有正文的空壳章上,等于挂了个查不到的出处(用神章第八就是这么露的)。
      const cs = chaptersOf(c.book).chapters.filter(x => chapKey(x.name) === chapKey(c.chapter)
        || chapKey(x.name).includes(chapKey(c.chapter)));
      if (!cs.length) { msg = `**书里没有这一章**:${c.chapter}`; ok = false; }
      else if (cs.every(x => x.body.length < 20)) { msg = `**那一章在本转录里只有章名、没有正文**——不许往空壳章上挂出处`; ok = false; }
      else msg = `没带引文,但所挂章「${cs[0].name}」有正文(${cs[0].body.length} 字),放行`;
    }
    else {
      const r = chapterOfQuote(c.book, c.quote);
      if (!r.found) { msg = '引文在原文里搜不到'; ok = false; }
      else if (!c.chapter) msg = `(未标章)实际落在「${r.chapter}」`;
      else if (chapKey(r.chapter) === chapKey(c.chapter)
        || chapKey(r.chapter).includes(chapKey(c.chapter)) || chapKey(c.chapter).includes(chapKey(r.chapter))) msg = `归章对得上(${r.chapter})`;
      else if (r.ambiguous && r.couldBe.some(n => chapKey(n) === chapKey(c.chapter))) {
        msg = `**归章判不了**:这一段落在「${r.couldBe.join('/')}」之间,后几章正文有、标题没了,机器分不清——不许标章`;
        ok = false;
      } else { msg = `**归章不符**:标的是「${c.chapter}」,实际落在「${r.chapter}」`; ok = false; }
    }
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${c.file} 《${c.book}${c.chapter ? '·' + c.chapter : ''}》 ${msg}`);
  }
  // 顺带报一遍各书里的空壳章(有章名没正文),那是转录的缺口,不是我们的错,但必须知道
  console.log('\n各书里「有章名、没正文」的章(转录缺口,不许往这些章上挂出处):');
  for (const book of ['增删卜易', '滴天髓阐微', '穷通宝鉴', '渊海子平', '子平真诠']) {
    try {
      const { chapters } = chaptersOf(book);
      // 「父章」(如《穷通宝鉴》的「论乙木」)自己没字,正文都在子章(「三春乙木」)里,
      // 那不是缺口。故只有**它和它后面直到下一个同级或更高级标题之间全都没字**才算空壳。
      const empty = chapters.filter((c, i) => {
        if (c.body.length >= 20) return false;
        // 往后看两章,只要有正文就当它是个壳子标题,不是缺口
        for (let k = i + 1; k <= i + 2 && k < chapters.length; k++) if (chapters[k].body.length >= 20) return false;
        return true;
      });
      console.log(`  《${book}》共 ${chapters.length} 章,空壳 ${empty.length} 章` +
        (empty.length ? ':' + empty.slice(0, 32).map(c => c.name).join('、') : ''));
    } catch (e) { console.log(`  《${book}》读不到:${e.message}`); }
  }
  process.exit(bad ? 1 : 0);
}
