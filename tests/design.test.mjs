// 设计系统体检:把 v0.70 定下的三条规矩钉死,免得下一版又改回去
//
// 缘起:用户 2026-08-01 原话——「各个部分都不够看…我需要的是一次大变革,包括整个的布局、
// 还有交互设计…调色、按键使用等等的设计」。动手前先量了一遍家底,量出四处结构性问题:
//   ① 一个朱砂干了所有的活:标题竖条、主按钮、版本印、板块字徽、报错文字、吉凶判语——
//      于是「出错了」和「大吉」是同一个红,用户分不出轻重;
//   ② 42 处内联样式,光输入框那一串就抄了 12 遍,改个圆角要翻十二处;
//   ③ .gold 这个按钮类实际上是蓝色(var(--blue)),类名在说谎;
//   ④ 桌面端整页只用中间 860px,1500px 高的屏幕里内容 830px 就结束。
//
// 这是**内部一致性测试**:只证明样式没走样,不证明好看。好看与否得看图。
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const CSS = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
const BODY = HTML.slice(HTML.indexOf('<body>'));

console.log('【一】朱砂只给品牌与主行动,不许拿它断吉凶');
t('四个语义色都在,且日夜两套都有', () => {
  for (const v of ['--jade', '--slate', '--ochre', '--mute']) {
    ok(CSS.includes(v + ':'), '缺语义色 ' + v);
    // 日间与夜间各定义一次
    const n = CSS.split(v + ':').length - 1;
    ok(n >= 2, `${v} 只定义了 ${n} 次——夜间那套忘了`);
  }
  for (const c of ['.v-ji', '.v-xiong', '.v-warn', '.v-ping']) ok(CSS.includes(c), '缺语义类 ' + c);
});
t('页面里不许再用内联 style 写朱砂来断吉凶', () => {
  const bad = BODY.match(/style="[^"]*--cinnabar[^"]*"/g) || [];
  ok(!bad.length, '这些地方拿品牌红当判语色用了:' + bad.join(' '));
});
t('报错与提示改用赭石,不再和主行动抢同一个红', () => {
  ok(/\.formerr\s*\{[^}]*--ochre/.test(CSS), '.formerr 应为赭石');
  ok(/\.qwhint\.warn\s*\{[^}]*--ochre/.test(CSS), '.qwhint.warn 应为赭石');
});
t('一屏一个主行动:同一个 section 里不许有两个 .primary 按钮', () => {
  // 缘起:朱砂实心是「这一屏该点的那个」。同屏两个就等于没有重点。
  const secs = BODY.split(/<section\b/).slice(1);
  const bad = [];
  for (const sec of secs) {
    const id = (sec.match(/id="([^"]+)"/) || [])[1] || '(无id)';
    const body = sec.split('</section>')[0];
    const n = (body.match(/class="[^"]*\bprimary\b[^"]*"/g) || []).length;
    if (n > 1) bad.push(`${id} 有 ${n} 个`);
  }
  ok(!bad.length, '这些板块里主行动按钮不止一个:' + bad.join('、'));
});

console.log('【二】组件化:表单控件不许再抄内联样式');
t('没有任何控件还在用内联的一长串样式', () => {
  const bad = BODY.match(/style="[^"]*var\(--panel2\)[^"]*"/g) || [];
  ok(!bad.length, `还有 ${bad.length} 处控件在写内联样式,应改用 .fld:` + bad.slice(0, 2).join(' '));
  ok(CSS.includes('.fld'), '缺 .fld 组件类');
});
t('内联 style 总数控制在二十以内(改版前是 42)', () => {
  const n = (BODY.match(/style="/g) || []).length;
  ok(n <= 20, `内联样式还有 ${n} 处,该收的没收干净`);
});
t('.gold 这个说谎的类名留作别名,新写法是 .btn-2', () => {
  ok(CSS.includes('.btn-2'), '缺 .btn-2');
  // .gold 必须和 .btn-2 同一条规则(即确认它只是别名,不是另一套颜色)
  ok(/\.btn-2,\s*button\.gold|button\.btn-2,\s*button\.gold/.test(CSS), '.gold 应与 .btn-2 同规则,证明它只是别名');
});

console.log('【三】布局:宽屏用得上横向空间,窄屏侧栏不许掉到页脚下面');
t('宽屏有两栏网格,且主内容与侧栏各有分区', () => {
  ok(/@media \(min-width: 1120px\)/.test(CSS), '缺宽屏断点');
  ok(/grid-template-areas/.test(CSS), '缺网格分区');
  ok(BODY.includes('class="maincol"'), '缺主内容列');
  ok(BODY.includes('id="sidepan"'), '缺侧栏');
});
t('窄屏用 order 把侧栏提到主内容之前', () => {
  // 缘起:侧栏在 DOM 里排在 maincol 后面(为了宽屏的网格分区),
  // 窄屏若不调 order,它会掉到页脚底下,等于没有。
  ok(/\.wrap > #sidepan \{ order: 1/.test(CSS), '窄屏侧栏没提前');
  ok(/\.wrap > \.maincol \{ order: 2/.test(CSS), '主内容 order 没设');
});
t('卡片靠细线分层,不靠重阴影', () => {
  ok(CSS.includes('--gold-hair'), '缺细金线');
  const m = CSS.match(/--shadow:\s*([^;]+);/);
  ok(m, '缺 --shadow');
  // 日间那条主阴影不许再有大模糊半径(改版前是 20px)
  const blur = (m[1].match(/(\d+)px/g) || []).map(x => parseInt(x, 10));
  ok(Math.max(...blur) <= 4, '主阴影还是太重:' + m[1]);
});

console.log('【四】新板块与新功能都挂上了');
t('四个新功能的容器都在,且都进了路由', () => {
  for (const id of ['sec-quick', 'sec-today', 'sidepan', 'sec-vs']) ok(BODY.includes(`id="${id}"`), '缺 ' + id);
  ok(/ask: \['sec-quick', 'sec-today'/.test(HTML), '速答与今日没进 ask 视图');
  ok(/boards: \['board-menu', 'sec-vs'/.test(HTML), '对照器没进 boards 视图');
  ok(/BOARD_IDS = \['sec-vs'/.test(HTML), '对照器没进 BOARD_IDS');
});
t('新板块的 id 前缀没跟别人撞', () => {
  // CLAUDE.md 四节记着已占用的前缀:wj- wq- jr- xy- yl- dl- zy- dw- ds-
  const used = ['wj-', 'wq-', 'jr-', 'xy-', 'yl-', 'dl-', 'zy-', 'dw-', 'ds-'];
  for (const p of ['qk-', 'td-', 'sp-', 'vs-']) ok(!used.includes(p), '新前缀 ' + p + ' 与既有前缀撞了');
  // 且新前缀确实在用
  for (const p of ['qk-', 'td-', 'sp-', 'vs-']) ok(BODY.includes(`id="${p}`), '前缀 ' + p + ' 没在用');
});
t('程序初断已登记进三处(script 标签 / sw 缓存 / 单文件构建)', () => {
  ok(HTML.includes('<script src="chuduan.js"></script>'), 'index.html 没引 chuduan.js');
  ok(readFileSync(join(ROOT, 'sw.js'), 'utf8').includes("'./chuduan.js'"), 'sw.js 没登记');
  ok(readFileSync(join(ROOT, 'build-single.mjs'), 'utf8').includes("read('chuduan.js')"), 'build-single 没登记');
});
t('速答与对照器都不自己另算断法,只调既有引擎', () => {
  const js = HTML.slice(HTML.indexOf('A 还是 B:两个候选并排比'));
  ok(/Dili\.judge/.test(js) && /Jiri\.dayInfo/.test(js) && /Chuduan\.judge/.test(js),
    '对照器应分别调 Dili / Jiri / Chuduan');
  // 不许在界面里自己写五行生克表(那是引擎的事)
  const uiSheng = HTML.match(/const (SHENG|KE)\s*=\s*\{\s*木:/g) || [];
  ok(!uiSheng.length, '界面里自己写了五行生克表,违反「一个口径一处算」');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
