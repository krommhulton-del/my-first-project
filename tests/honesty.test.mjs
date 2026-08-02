// 诚信体检:防止再出现「假装引了书」与「把内部一致性说成准确」
// 缘起:本环境取不到古籍原文(实测 wikisource/ctext/gutenberg 全 403),
// 而代码里曾写着「依《渊海子平》」这类出处——那些来自训练记忆,不是核对过的原文。
// 规矩:拿不到原文就写「出处待核」,不许挂书名章节冒充有据。
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Tijian from '../tijian.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };

// 2026-08 改过一次:原本一概禁止引书(那时本环境取不到任何原文)。
// 现在用户传进来五本原文,存 data/classics/。规矩相应改成:
//   **书名在 data/classics/ 里有对应原文文件的,才准引;没有的照旧一律「出处待核」。**
// 这样「有没有资格引这本书」是可机械判定的,不靠自觉。
const CLASSICS = readdirSync(join(ROOT, 'data', 'classics'))
  .filter(f => f.endsWith('.txt')).map(f => f.replace(/\.txt$/, ''));
// ①《周易》经文本身是程序内嵌的原文;②算命学一脉的书目是模块出处的自我说明,界面已明示为「一脉」而非引文。
const ALLOW = ['周易', '易经', '系辞', '原典算命学大系', ...CLASSICS];
const SRC = ['bazi.js', 'najia.js', 'yunshi.js', 'jiri.js', 'dashi.js', 'wenji.js', 'dili.js',
  'meihua.js', 'xiaoliuren.js', 'qimen.js', 'gua-core.js', 'sanmei.js', 'index.html', 'yunshi.html'];

console.log('【一】不许假装引书');
t('源码与界面里不出现未经核对的古籍出处', () => {
  for (const f of SRC) {
    const txt = readFileSync(join(ROOT, f), 'utf8');
    const books = txt.match(/《[^》]{2,12}》/g) || [];
    for (const b of books) {
      const name = b.slice(1, -1);
      ok(ALLOW.some(a => name.includes(a)), `${f} 里挂着无法核对的出处 ${b}——拿不到原文就写「出处待核」`);
    }
  }
});
// 光是「书在库里」还不够——挂了书名就得真能核到那句话。这条盯住调候表的每一格。
t('调候表挂的是《穷通宝鉴》,就要逐格在原文里核得到', () => {
  const raw = readFileSync(join(ROOT, 'data', 'classics', '穷通宝鉴.txt'), 'utf8').replace(/\s/g, '');
  const tab = JSON.parse(readFileSync(join(ROOT, 'data', 'tiaohou.json'), 'utf8'));
  const bazi = readFileSync(join(ROOT, 'bazi.js'), 'utf8');
  const ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  let n = 0;
  for (const [gan, cells] of Object.entries(tab.table)) {
    for (const [zhi, use] of Object.entries(cells)) {
      n++;
      // ① bazi.js 里的常量必须与数据文件一致(防两处各改各的)
      const re = new RegExp(`${gan}:\\s*\\{[^}]*${zhi}:\\s*'${use}'`);
      ok(re.test(bazi), `bazi.js 的调候表缺或不符:${gan}日主${zhi}月应取${use}`);
      // ② 数据文件里存的那句原文,必须真的在《穷通宝鉴》里,且真的含这个用神
      const q = tab.quotes[gan + (ZHI.indexOf(zhi) + 1)];
      ok(q && q.length > 6, `${gan}${zhi} 没存原文佐证`);
      ok(raw.includes(q), `${gan}${zhi} 存的佐证在原文里搜不到:${q}`);
      ok(q.includes(use), `${gan}${zhi} 的佐证句里没有用神${use}:${q}`);
    }
  }
  ok(n >= 70, '调候表收得太少,只有 ' + n + ' 格');
  ok(tab._meta['收录口径'].includes('双重印证'), '数据文件须写明收录口径');
  ok(/出处待核/.test(bazi), '未收录的格子退回粗糙规则,那条必须标出处待核');
  // ③ v0.76 补录余下 41 格之后加的:收的 + 不收的必须正好凑满 120 格,
  //    且不收的要逐格写明为什么不收——不许有格子悄悄消失。
  const skip = tab._meta['不收'] || {};
  ok(n + Object.keys(skip).length === 120,
    `收了 ${n} 格、明说不收 ${Object.keys(skip).length} 格,加起来不是 120——有格子漏了或重了`);
  for (const [cell, why] of Object.entries(skip)) {
    ok(why && why.length > 10, `不收的 ${cell} 没写理由`);
    const [g, z] = [cell[0], cell[1]];
    ok(!(tab.table[g] && tab.table[g][z]), `${cell} 既说不收又收在表里`);
  }
  ok(tab._meta['补录口径'] && tab._meta['补录口径'].includes('单一来源'),
    '补录的那批只有原文一个来源,口径里必须写明,不许与双重印证的混为一谈');
  // ④ 原文自身有分歧的格子,数据文件里记了,bazi.js 也要认得——两处必须是同一批格子,
  //    否则界面上就会有人看到「原文只有一说」的假象。
  const yiKeys = Object.keys(tab._meta['补录分歧'] || {}).sort();
  ok(yiKeys.length >= 5, '原文分歧记得太少,只有 ' + yiKeys.length + ' 格');
  const inBazi = (bazi.match(/const TIAOHOU_YI = \[([^\]]*)\]/) || [])[1] || '';
  const baziKeys = (inBazi.match(/'([^']+)'/g) || []).map(x => x.slice(1, -1)).sort();
  ok(JSON.stringify(yiKeys) === JSON.stringify(baziKeys),
    `分歧格子两处对不上:数据文件 ${yiKeys.join(',')} / bazi.js ${baziKeys.join(',')}`);
  for (const k of yiKeys) ok(tab.table[k[0]] && tab.table[k[0]][k[1]], `${k} 记了分歧,表里却没这一格`);
});
t('凡写了「出处:《某书》…原话」的地方,原话必须在那本书里搜得到', () => {
  // 缘起:v0.67 开始给六爻各条挂真出处。规矩不变——搜得到才准挂。
  // 这条测试把注释里以「「…」」括起的引文全捞出来,逐条回对应的原文文件核。
  // 原文转录里夹着 <br> 之类的 HTML 断行,那是转录痕迹不是正文,比对前一并抹掉
  const strip = x => x.replace(/<br\s*\/?>/gi, '').replace(/\/\//g, '').replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒﹕﹔﹑]/g, '');
  const books = {};
  for (const f of readdirSync(join(ROOT, 'data', 'classics')).filter(x => x.endsWith('.txt')))
    books[f.replace(/\.txt$/, '')] = strip(readFileSync(join(ROOT, 'data', 'classics', f), 'utf8'));
  // 《增删卜易》有两份转录(老转录缺卷之一正文;维基文库本恰是卷之一)——
  // 同一本书并成一个键,哪份里搜得到都算搜得到(v0.88)
  if (books['增删卜易-维基文库本']) books['增删卜易'] += books['增删卜易-维基文库本'];
  let n = 0, bad = [];
  for (const f of ['najia.js', 'bazi.js', 'geju.js', 'yingqi.js']) {
    const txt = readFileSync(join(ROOT, f), 'utf8');
    // 形如:出处:《增删卜易·月破章第二十七》「…」
    for (const m of txt.matchAll(/出处:《([^》·]+)[^》]*》[^「]{0,40}「([^」]{6,})」/g)) {
      const [, book, quote] = m;
      n++;
      const raw = books[book];
      if (!raw) { bad.push(`${f}: 引了《${book}》,但 data/classics/ 里没有这本`); continue; }
      // 引文里可能带「…」节略,拆开逐段核
      for (const part of quote.split(/…|\.\.\./)) {
        const q = strip(part);
        if (q.length >= 5 && !raw.includes(q)) bad.push(`${f}: 《${book}》里搜不到「${part.slice(0, 24)}」`);
      }
    }
  }
  ok(n >= 3, '挂出处的条目太少,只有 ' + n);
  ok(!bad.length, '这些出处核不到:\n      ' + bad.join('\n      '));
  console.log(`      (共核了 ${n} 处挂出处的引文)`);
});
t('挂了「书·章」的,那句话必须真的出自那一章(v0.79 新增)', async () => {
  // 缘起:此前的核对只验「这句话在这本书里搜得到」,**没验它是不是出自所标的那一章**。
  // 一查就查出三件事:
  //   ①《增删卜易》这份转录的卷之一(第一到第二十六章)只有章名、没有正文,
  //     而 najia.js 曾把「用神取法」的总纲挂在其中的「用神章第八」上——挂了个查不到的出处;
  //   ②旬空那条引文标的是「旬空章第二十六」(也在卷之一),实际落在卷之二后段;
  //   ③bazi.js 的「就使逢库，亦为有根」标的是「地支章」,实际落在「九、干支总论」。
  // 判定逻辑在 tools/chapter-check.mjs,连**「归章判不了」也要报**——
  // 该书目录列 133 章、正文只有 98 个标题,丢了标题的那几段谁也说不清属于哪一章,那种一律不许标章。
  const { citationsIn, chapterOfQuote, chaptersOf, chapKey } = await import('../tools/chapter-check.mjs');
  const SRC = ['najia.js', 'bazi.js', 'geju.js', 'yingqi.js', 'chuduan.js', 'dashi.js'];
  const cites = citationsIn(SRC);
  ok(cites.length >= 10, '挂「书·章」的出处太少,只有 ' + cites.length);
  const bad = [];
  for (const c of cites) {
    if (!c.quote) {
      const cs = chaptersOf(c.book).chapters.filter(x => chapKey(x.name) === chapKey(c.chapter));
      if (!cs.length) bad.push(`${c.file}:《${c.book}》里没有「${c.chapter}」这一章`);
      else if (cs.every(x => x.body.length < 20)) bad.push(`${c.file}:「${c.chapter}」在本转录里只有章名没有正文,不许往上挂出处`);
      continue;
    }
    const r = chapterOfQuote(c.book, c.quote, c.chapter);
    if (!r.found) { bad.push(`${c.file}:《${c.book}》里搜不到「${c.quote.slice(0, 20)}」`); continue; }
    if (!c.chapter) continue;                       // 只挂书不挂章的,不作归章要求
    const same = chapKey(r.chapter) === chapKey(c.chapter)
      || chapKey(r.chapter).includes(chapKey(c.chapter)) || chapKey(c.chapter).includes(chapKey(r.chapter));
    if (same) continue;
    if (r.ambiguous) bad.push(`${c.file}:「${c.quote.slice(0, 14)}」落在「${r.couldBe.join('/')}」之间,归章判不了,不许标章`);
    else bad.push(`${c.file}:「${c.quote.slice(0, 14)}」标的是「${c.chapter}」,实际落在「${r.chapter}」`);
  }
  ok(!bad.length, '归章核不过:\n      ' + bad.join('\n      '));
  console.log(`      (逐条核了 ${cites.length} 处「书·章」出处的归章)`);
});
t('《增删卜易》维基文库本转录:卷之一逐章有正文(v0.88 的地基,塌了用神表就悬空)', async () => {
  // 缘起(v0.88):老转录的卷之一只有章名没正文,用神表三行因此挂了三个版本的「待核」。
  // 维基文库本转录到手后,那三行的出处全押在它身上——所以它的完整度必须钉死:
  // 章数、逐章非空、用神章第八本身的厚度,少一样都等于出处悬空而没人知道。
  const { chaptersOf } = await import('../tools/chapter-check.mjs');
  const { chapters } = chaptersOf('增删卜易-维基文库本');
  ok(chapters.length >= 30, `维基文库本只切出 ${chapters.length} 章,该有 32 章(序+26+又十五+又二十六×4)`);
  for (const c of chapters) ok(c.body.length >= 20, `「${c.name}」在维基文库本里没正文(${c.body.length} 字)——转录残了`);
  const yong = chapters.find(c => c.name.includes('用神章第八'));
  ok(yong && yong.body.length >= 300, '用神章第八的正文太薄,核不住用神表');
  for (const key of ['官鬼爻爲用神', '父母爻爲用神', '兄弟爻爲用神', '子孫爻爲用神', '妻財爻', '醫藥']) {
    ok(yong.body.includes(key.replace(/[、，]/g, '')), `用神章第八里搜不到「${key}」——正文对不上`);
  }
});
t('程序初断挂的出处,逐条在原文里核得到', () => {
  // 缘起:v0.74 给初断的几条凭据挂了《增删卜易》的原话。规矩不变——搜得到才准挂。
  const strip = x => x.replace(/<br\s*\/?>/gi, '').replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒﹕﹔﹑]/g, '');
  const raw = strip(readFileSync(join(ROOT, 'data', 'classics', '增删卜易.txt'), 'utf8'));
  const src = readFileSync(join(ROOT, 'chuduan.js'), 'utf8');
  const hits = [...src.matchAll(/q:\s*'([^']{8,})',\s*src:\s*'([^']+)'/g)];
  ok(hits.length >= 3, '挂的出处太少,只有 ' + hits.length);
  for (const [, q, srcName] of hits) {
    ok(srcName.startsWith('增删卜易'), '出处书名超出已入库范围:' + srcName);
    ok(raw.includes(strip(q)), `《${srcName}》里搜不到这句:「${q}」`);
  }
  console.log(`      (核了 ${hits.length} 条初断出处)`);
});
t('神煞表没有凭记忆扩表——起例查不到原文就不许加', () => {
  // 缘起:v0.74 本想扩神煞表,查下来渊海子平里**只有断语、没有起例**
  // (将星/劫煞/亡神/孤辰寡宿的推法一条都搜不到)。按铁律,搜不到就不许挂,
  // 凭训练记忆写表正是宪法明令禁止的。这条测试盯着别有人回头偷偷加。
  //
  // v0.87 改口径,**改严不改松**:用户传进《三命通会》之后,这几样的起例头一回
  // 有了正文,于是表加上了。但旧写法只在渊海子平里松松搜一个「将星者」就算过,
  // 那既拦不住从别处抄、也不验起例本身抄对没有。现在钉的是**两条路都不许沉默**:
  //   ① 收了的 —— data/shensha.json 的 items 里有一条,引文在《三命通会》里逐字搜得到;
  //   ② 没收的 —— 挂在「不收的」名下并写明为什么,同时代码里标「出处待核」。
  // 两样都不占的表,一律当成凭记忆写,当场红。逐格核表在 tests/shensha.test.mjs。
  //
  // 这条一改严,当场揪出旧账:**天乙贵人与文昌两张表是 v0.33 凭口诀写的,至今无出处**
  // (「甲戊庚牛羊」那套歌诀在《三命通会》里 0 命中)。不删表,但从此挂在明处。
  const strip = x => x.replace(/<br\s*\/?>/gi, '').replace(/[\s，。、；：？！,.;:?!「」『』()（）《》〈〉·…﹐﹒﹕﹔﹑]/g, '');
  const bazi = readFileSync(join(ROOT, 'bazi.js'), 'utf8');
  const ss = JSON.parse(readFileSync(join(ROOT, 'data', 'shensha.json'), 'utf8'));
  // 条目名带括号注(「桃花(咸池)」),按括号前那截认
  const key = s => s.replace(/[(（].*$/, '').replace(/\s*\/\s*/g, '');
  const byName = new Map(ss.items.map(x => [key(x.name), x]));
  const noSrc = new Set(ss.不收的.flatMap(x => [key(x.name), ...x.name.split(/\s*\/\s*/).map(key)]));
  for (const x of ss.不收的) ok(x.为什么 && x.为什么.length > 20, `「${x.name}」说不收,可没写清为什么`);
  const smtx = strip(readFileSync(join(ROOT, 'data', 'classics', '三命通会.txt'), 'utf8'));
  let n = 0, pend = [];
  for (const name of ['将星', '华盖', '桃花', '驿马', '劫煞', '亡神', '灾煞', '六厄', '孤辰',
                      '寡宿', '破碎', '德秀', '金舆', '天乙贵人', '天德', '月德', '太极贵', '文昌']) {
    // 表在不在:内联常量后头的注、或 SHENSHA_SAY 里的一条断语
    const has = new RegExp('//[^\\n]*' + name).test(bazi)
      || new RegExp('[\\s{,]' + name + ' *:').test(bazi);
    if (!has) continue;
    const rec = byName.get(name);
    if (!rec) {
      // ② 没收的那条路:必须**点名**挂在「不收的」名下并写清为什么。
      // 这里不许退成「文件里有『出处待核』四个字就算」——那是全文匹配,
      // 随便哪一处的待核声明都能替别的表遮丑。
      ok(noSrc.has(name),
        `bazi.js 里有「${name}」的表,shensha.json 既没收也没说不收——起例出处呢?`);
      pend.push(name);
      continue;
    }
    // ① 收了的那条路:引文逐字可搜
    ok(rec.chapter && rec.quote, `「${name}」在 shensha.json 里没写章名或原文`);
    // 简繁双查(§十二 栽过的跤):这份转录是简体,而 quote 留的是繁体原貌,
    // 只查一头会得出「书里没有」的错结论。
    ok(smtx.includes(strip(rec.quote)) || (rec.quoteS && smtx.includes(strip(rec.quoteS))),
      `「${name}」的起例引文在《三命通会》里搜不到:「${rec.quote}」——不许凭记忆写`);
    n++;
  }
  ok(n >= 8, `神煞表核到的条数只有 ${n},太少了,是不是判在不在的那个式子写漏了`);
  console.log(`      (核了 ${n} 张神煞表的起例出处;另有 ${pend.length} 张挂着出处待核:${pend.join('、')})`);
});
t('凡自称依某体例的模块,都注明了「出处待核」', () => {
  for (const f of ['najia.js', 'meihua.js', 'qimen.js', 'yunshi.js', 'wenji.js']) {
    const txt = readFileSync(join(ROOT, f), 'utf8');
    ok(txt.includes('出处待核'), f + ' 声称依通行体例,却没注明出处待核');
  }
});

console.log('【二】准确率不许越级表态');
// 2026-07-31 改过一次:这条原本钉着「事件层零外部回测」「什么都不许承诺」。
// 那天拿到 28 人语料、第一次量出了数字(方向命中 73.2%,但按人分层检验只勉强过线),
// 「零回测」这句话就不成立了。于是改钉新的诚实底线:数字可以有,但**仍不许说「准」**,
// 而且必须指向那份连落空一起公布的报告。
t('宪法在:三层分级俱在,事件层有了数字但仍不许说「准」', () => {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  for (const k of ['排盘层', '断法层', '事件层', '出处待核']) ok(md.includes(k), 'CLAUDE.md 缺:' + k);
  ok(/仍不许说「准」/.test(md), '宪法须写死事件层仍不许说准');
  ok(md.includes('回测报告-01-事件层.md'), '宪法须指向那份带落空清单的回测报告');
  ok(!/事件层[^|]*\|[^|]*准确验证|经回测验证.{0,3}准/.test(md), '宪法里不许出现「经回测验证准」这类话');
});
t('三个 SOP skill 都在,且各自写明了关键铁律', () => {
  const base = join(ROOT, '.claude', 'skills');
  const dirs = readdirSync(base);
  for (const d of ['dx-release', 'dx-audit', 'dx-board']) ok(dirs.includes(d), '缺 skill:' + d);
  const rel = readFileSync(join(base, 'dx-release', 'SKILL.md'), 'utf8');
  ok(rel.includes('三处') && rel.includes('CACHE'), '发版 SOP 须点明版本号三处与 CACHE');
  const aud = readFileSync(join(base, 'dx-audit', 'SKILL.md'), 'utf8');
  ok(aud.includes('外部对照') && aud.includes('内部一致性'), '体检 SOP 须区分两类测试');
  const brd = readFileSync(join(base, 'dx-board', 'SKILL.md'), 'utf8');
  ok(brd.includes('id 前缀') && brd.includes('常量名'), '板块 SOP 须提醒前缀与常量查重');
});

console.log('【三】铁律仍在代码里生效');
t('铁律十:仓库里不许出现任何形似 API Key 的串', () => {
  // 缘起:2026-08 用户在聊天里贴了自己的 DeepSeek Key。程序本来就不需要它
  // (Key 只存用户本机 localStorage,由他的浏览器直发接口),但这条测试把「仓库零密钥」钉死,
  // 免得将来谁手滑把调试用的 Key 写进代码或测试。
  const SCAN = ['index.html', 'yunshi.html', 'package.json', 'sw.js', 'build-single.mjs'];
  const KEYLIKE = /(sk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,})/i;
  for (const f of SCAN.concat(readdirSync(ROOT).filter(x => x.endsWith('.js')))) {
    let txt = '';
    try { txt = readFileSync(join(ROOT, f), 'utf8'); } catch (e) { continue; }
    const m = txt.match(KEYLIKE);
    ok(!m, `${f} 里出现了形似密钥的串(前 8 字符 ${m ? m[0].slice(0, 8) : ''}…)——密钥一律只存用户本机`);
  }
  // 测试目录也扫一遍(调试用的假 Key 也不许长得像真的)
  for (const f of readdirSync(join(ROOT, 'tests'))) {
    const txt = readFileSync(join(ROOT, 'tests', f), 'utf8');
    ok(!/sk-[A-Za-z0-9]{20,}/.test(txt), `tests/${f} 里有形似真密钥的串`);
  }
});
t('Key 只进 localStorage,不写进任何请求日志或回报文本', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8') + readFileSync(join(ROOT, 'yunshi.html'), 'utf8');
  // getKey() 的结果只许出现在 headers 里,不许被塞进 material/report/console
  ok(!/console\.log\([^)]*getKey\(\)/.test(html), 'Key 不许打进控制台');
  ok(!/(material|report|回报)[^\n]{0,80}getKey\(\)/.test(html), 'Key 不许进材料或回报文本');
});
t('提示词里仍钉着零说教、禁空话、不推荐花钱消灾', () => {
  // 2026-08 改过一次判据,原委照实记:
  //   原来这条查的是 index.html 里**有没有「机遇与挑战并存」这几个字**。
  //   v0.78 把禁词表收归 tijian.js 一处之后,提示词改成从那份表插值生成,
  //   于是字面上不再有那几个字——旧判据会红,而那不是退步,是「一个口径一处算」落地了。
  //   新判据比旧的更严:既要提示词确实接上了权威表,也要权威表里真有那些词。
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const yun = readFileSync(join(ROOT, 'yunshi.html'), 'utf8');
  for (const k of ['零说教', '花钱消灾']) ok(html.includes(k), 'index.html 缺铁律:' + k);
  for (const [f, txt] of [['index.html', html], ['yunshi.html', yun]]) {
    ok(/Tijian\.RULES\['空话'\]/.test(txt), f + ' 的禁句清单没接上唯一出处 tijian.js');
    ok(/Tijian\.RULES\['说教'\]/.test(txt), f + ' 的说教禁句没接上唯一出处 tijian.js');
  }
  for (const w of ['机遇与挑战并存', '顺其自然', '静观其变']) {
    ok(Tijian.RULES['空话'].words.includes(w), 'tijian.js 的空话表里少了:' + w);
  }
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
