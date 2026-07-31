// 诚信体检:防止再出现「假装引了书」与「把内部一致性说成准确」
// 缘起:本环境取不到古籍原文(实测 wikisource/ctext/gutenberg 全 403),
// 而代码里曾写着「依《渊海子平》」这类出处——那些来自训练记忆,不是核对过的原文。
// 规矩:拿不到原文就写「出处待核」,不许挂书名章节冒充有据。
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const k of ['零说教', '机遇与挑战并存', '花钱消灾']) ok(html.includes(k), 'index.html 缺铁律:' + k);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
