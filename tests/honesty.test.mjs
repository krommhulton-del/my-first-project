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

// 允许出现的书名:①《周易》经文本身是程序内嵌的原文,可以引;
//                ②算命学一脉的书目是模块出处的自我说明,已在界面明示为「一脉」而非引文。
const ALLOW = ['周易', '易经', '系辞', '原典算命学大系'];
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
t('凡自称依某体例的模块,都注明了「出处待核」', () => {
  for (const f of ['najia.js', 'meihua.js', 'qimen.js', 'yunshi.js', 'wenji.js']) {
    const txt = readFileSync(join(ROOT, f), 'utf8');
    ok(txt.includes('出处待核'), f + ' 声称依通行体例,却没注明出处待核');
  }
});

console.log('【二】准确率不许越级表态');
t('宪法在,且写明了三层分级与事件层零回测', () => {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  for (const k of ['排盘层', '断法层', '事件层', '零外部回测', '出处待核']) ok(md.includes(k), 'CLAUDE.md 缺:' + k);
  ok(md.includes('什么都不许承诺'), '宪法须写死事件层不许承诺');
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
t('提示词里仍钉着零说教、禁空话、不推荐花钱消灾', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const k of ['零说教', '机遇与挑战并存', '花钱消灾']) ok(html.includes(k), 'index.html 缺铁律:' + k);
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
