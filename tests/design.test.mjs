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
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` 期望[${b}] 实得[${a}]`); };
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

t('五个卦阵板块共用同一份程序初断,没人另写一份', () => {
  // 缘起:CLAUDE.md 第四节「一个口径一处算」。五个板块原本就共用 dwCastOne 起卦,
  // 接程序初断时也必须共用 cdBlock/cdMaterial——各写一份迟早各改各的。
  ok(/function cdBlock\(/.test(HTML), '缺 cdBlock');
  ok(/function cdMaterial\(/.test(HTML), '缺 cdMaterial');
  ok((HTML.match(/function cdBlock\(/g) || []).length === 1, 'cdBlock 不止一份');
  ok((HTML.match(/function dwCastOne\(/g) || []).length === 1, 'dwCastOne 不止一份');
  // 五个板块的 render 都得拼上 cdBlock(c)
  const n = (HTML.match(/\+ cdBlock\(c\)/g) || []).length;
  ok(n === 5, `只有 ${n} 个板块接了 cdBlock,应为 5 个`);
  // 成算本身只许在 chuduan.js 里算,界面不许自己判成不成
  ok(/Chuduan\.judge/.test(HTML), '界面应调 Chuduan.judge');
  ok(!/function .*judgeCheng|const BANDS\s*=/.test(HTML), '界面里自己实现了成算分档');
});
t('程序初断喂给模型的材料里,写死了「不许改判」', () => {
  // 第五节:程序算死,AI 只解释。材料里没有这句约束,模型就会按自己的乐观倾向重写结论。
  const m = HTML.slice(HTML.indexOf('function cdMaterial'), HTML.indexOf('function cdBlock'));
  ok(/铁规/.test(m), '材料里缺「铁规」这类硬约束');
  ok(/不许把「不成」讲成「能成」/.test(m), '缺具体的不许改判条款');
  ok(/压过一切文采考虑/.test(m), '缺优先级声明(否则会被文采要求压过去)');
  // 术语只许进材料,不许进界面那一块
  ok(/成稿里一个字都不许出现/.test(m), '材料里须声明推演细目不上稿');
  // 缘起(对抗式体检两条):
  // ① 一阵里有不少卦问的不是「成不成」(「那时身边的人是什么模样」),硬套成败死命令会逼模型把描述题答成判断题;
  // ② 汇总深断时多卦初断拼在一起可能彼此矛盾,原先没说该怎么权衡,模型只能自己挑一个或和稀泥。
  ok(/本来就不是问成不成/.test(m), '缺「非成败之问按基调用」的退路');
  ok(/彼此不一致.*不许和稀泥|不许和稀泥/.test(m), '缺多卦初断矛盾时的权衡规则');
  ok(/以问得最直接的那一卦为主断/.test(m), '权衡规则要说清以哪一卦为主');
});

t('未来镜的基调锁定读的是分值,不是给人看的摘要字符串', () => {
  // 缘起:这是 v0.71 接程序初断时我制造的一个**静默回归**。
  // wjTone 原本靠 `summary.split('·').pop()` 抠吉凶等级;我给 summary 尾巴加了「·成(八九成)」,
  // 于是 pop() 拿到「成(八九成)」,六个分支一个都不匹配,基调锁定退化成兜底句「依主线卦自定」——
  // 等于没锁。而 v0.44 做未来镜时,基调锁定正是这个板块的核心机制。
  // 界面照常显示、当时所有测试照常绿,没人看得出来。
  // 根子在于**拿给人看的字符串当数据结构解析**。现在改成吃程序初断的分值。
  const i = HTML.indexOf('  function wjTone(');
  ok(i > 0, '找不到 wjTone');
  let depth = 0, started = false, j = i;
  while (j < HTML.length) {
    const ch = HTML[j];
    if (ch === '{') { depth++; started = true; }
    else if (ch === '}') { depth--; if (started && depth === 0) { j++; break; } }
    j++;
  }
  // wjTone 现在取 toneOf/TONE_BANDS,抽函数时得把那张表一并抽出来
  const tb = HTML.slice(HTML.indexOf('  const TONE_BANDS = ['), HTML.indexOf('const toneOf ='));
  const tf = HTML.slice(HTML.indexOf('  const toneOf ='), HTML.indexOf('\n', HTML.indexOf('  const toneOf =')) + 1);
  ok(tb.includes('TONE_BANDS') && tf.includes('toneOf'), '抽不出基调表');
  const wjTone = eval(`(function(){ ${tb} ${tf} ${HTML.slice(i, j)} return wjTone; })()`);
  // 一、有程序初断时,五档各自走得到,且随分值单调
  const tones = [5.5, 2.0, 0, -3, -6].map(s => wjTone({ cd: { score: s } }));
  eq(new Set(tones).size, 5, '五个分值应给出五种不同基调,实得:' + tones.join(' | '));
  for (const t of tones) ok(!/依主线卦自定/.test(t), '有初断时不该落到兜底句:' + t);
  ok(/大顺/.test(tones[0]) && /逆/.test(tones[4]), '两头的基调该是大顺与逆:' + tones.join(' | '));
  // 二、没有初断时的退路,对新旧两种摘要串都要认得出来
  ok(!/依主线卦自定/.test(wjTone('乾为天·大吉')), '旧格式摘要应解析得出');
  ok(!/依主线卦自定/.test(wjTone({ summary: '乾为天之天风姤·大吉·成(八九成)' })), '新格式摘要(尾巴带成算)也应解析得出');
  ok(/逆/.test(wjTone({ summary: '坤为地·凶·不成(两成上下)' })), '凶卦应判逆');
  // 三、基调门槛只许有一张表(第四节:一个口径一处算)
  //    缘起:我头一版在 cdBlock 与 wjTone 里各写了一遍同样的五档门槛(3/1.2/-1.4/-4.3)。
  //    数一样,但两处各写各的——下次调一处忘了另一处,界面显示的基调就会与
  //    喂给模型的锁定基调对不上,而那种不一致是静默的。
  ok(/const TONE_BANDS = \[/.test(HTML), '缺唯一的基调表 TONE_BANDS');
  ok((HTML.match(/const TONE_BANDS = \[/g) || []).length === 1, 'TONE_BANDS 不止一份');
  ok(/toneOf\(cd\.score\)/.test(HTML), 'cdBlock 应取 toneOf');
  ok(/toneOf\(c\.cd\.score\)\.lock/.test(HTML), 'wjTone 应取同一张表的 lock 文案');
  // 门槛数字不许再散落在别处
  const strays = (HTML.match(/s >= 1\.2|s > -1\.4|s > -4\.3/g) || []);
  ok(!strays.length, '基调门槛还散落在别处:' + strays.join(' '));
  // 四、调用处必须传卦对象,不许再传字符串(传字符串就丢了分值这条路)
  ok(/wjTone\(c1\)/.test(HTML), '调用处应传卦对象:搜不到 wjTone(c1)');
  ok(!/wjTone\(c1\.summary\)/.test(HTML), '调用处还在传摘要字符串');
});

t('四个法门的初断文字穷举一遍,一个术语都不许有(铁律八)', () => {
  // 缘起:这条是对抗式体检揪出来的。接程序初断时我给梅花、小六壬、六爻都做了人话翻译,
  // **唯独奇门那一路把 verdict.reasons 原样端上了台面**——采样八千个时刻,
  // reasons 去重 452 种,其中 439 种是「事落坎宫得死门(凶门)配天芮」这种模板,
  // 一句话里同时有宫名、八门、九星。自己检查时逐个"看一眼"是看不出来的,得穷举。
  // 规矩:**凡是会渲染到 cdBlock 的文字,都必须穷举它的全部取值,不许抽查。**
  const Qimen = require('../qimen.js');
  const Meihua = require('../meihua.js');
  const Xlr = require('../xiaoliuren.js');
  const Lunar = require('../lunar.js');
  const Najia = require('../najia.js');
  const BAN = /宫|八门|九星|门迫|天盘|地盘|三奇|六仪|值符|值使|空亡|旬空|纳甲|干支|用神|世应|月破|六亲|官鬼|妻财|子孙|兄弟|体卦|用卦|当令|旺相休囚|天芮|天英|天冲|天任|天辅|天心|天柱|天蓬|天禽|开门|休门|生门|伤门|杜门|景门|死门|惊门/;

  // ① 奇门:抽出 index.html 里的 QM_GATE / QM_PLAIN / qmWhy 原样跑
  const qi = HTML.indexOf('  const QM_GATE = {'), qj = HTML.indexOf('  // 体用关系是术语');
  ok(qi > 0 && qj > qi, '找不到奇门的人话层');
  const qmWhy = eval(`(function(){ ${HTML.slice(qi, qj)} return qmWhy; })()`);
  const qmSeen = new Set(); const qmBad = new Set();
  for (let k = 0; k < 6000; k++) {
    const d = new Date(1990 + Math.floor(k / 220), k % 12, 1 + (k % 28), (k * 7) % 24, (k * 13) % 60);
    let v; try { v = Qimen.verdict(Qimen.cast(d)); } catch (e) { continue; }
    for (const w of qmWhy(v)) { qmSeen.add(w); if (BAN.test(w)) qmBad.add(w); }
  }
  ok(qmSeen.size >= 10, '奇门取值太少,采样可能没跑起来:' + qmSeen.size);
  ok(!qmBad.size, '奇门初断里有术语:\n      ' + [...qmBad].slice(0, 5).join('\n      '));

  // ② 梅花:MH_PLAIN 与 MH_WANG 必须覆盖引擎的全部取值(查不到就会 fallback 回术语)
  const mi = HTML.indexOf('  const MH_PLAIN = {'), mj = HTML.indexOf('  // 吉凶档 → 语义色');
  const { MH_PLAIN, MH_WANG } = eval(`(function(){ ${HTML.slice(mi, mj)} return { MH_PLAIN, MH_WANG }; })()`);
  const relSeen = new Set(), wangSeen = new Set();
  for (let k = 0; k < 3000; k++) {
    const d = new Date(2026, 0, 1 + k % 365, (k * 5) % 24, (k * 11) % 60);
    const cst = Meihua.castByTime(Lunar.fromDate(d));
    const a = Meihua.analyze(cst, Najia.ganZhi(d).monthZhi);
    relSeen.add(a.rel); wangSeen.add(String(a.wang || '').split('，').pop().split(',').pop());
  }
  const relMiss = [...relSeen].filter(r => !MH_PLAIN[r]);
  ok(!relMiss.length, 'MH_PLAIN 漏了这些体用关系(会 fallback 回术语):' + relMiss.join('、'));
  const wangMiss = [...wangSeen].filter(w => w && !MH_WANG[w]);
  ok(!wangMiss.length, 'MH_WANG 漏了这些旺衰注记:' + wangMiss.join('、'));
  for (const v of Object.values(MH_PLAIN)) ok(!BAN.test(v), '梅花人话表里有术语:' + v);
  for (const v of Object.values(MH_WANG)) ok(!BAN.test(v), '梅花旺衰表里有术语:' + v);

  // ③ 小六壬:果宫的吉凶字段与三宫名,穷举一遍
  const xlrSeen = new Set();
  for (let k = 0; k < 2000; k++) {
    const d = new Date(2026, 0, 1 + k % 365, (k * 7) % 24, (k * 3) % 60);
    const kk = Xlr.castByTime(Lunar.fromDate(d));
    const g = kk.gongs[2];
    xlrSeen.add(`起因落在${kk.gongs[0].name}、过程落在${kk.gongs[1].name}、结果落在${g.name}——${g.ji}`);
  }
  // 小六壬的六个宫名(大安/留连/速喜/赤口/小吉/空亡)是这个法门**结果本身的名字**,
  // 性质同于六爻的卦名,不是推演术语——而且每次都紧跟着一句白话解释(如「空亡——大凶(无果)」)。
  // 所以把它们从禁词里排除,但**反过来要求:每条都必须带上那句白话**,否则等于甩了个名词就走。
  // (这条判据是这次调整的:头一版 BAN 里有「空亡」,把宫名当成了旬空那个术语,是我把测试写宽了。)
  const XLR_GONG = /大安|留连|速喜|赤口|小吉|空亡/g;
  const xlrBad = [...xlrSeen].filter(x => BAN.test(x.replace(XLR_GONG, '')));
  ok(!xlrBad.length, '小六壬初断里有术语:' + xlrBad.slice(0, 3).join(' | '));
  for (const x of xlrSeen) ok(/——(大凶|凶|吉|平)/.test(x), '小六壬只报了宫名却没解释是吉是凶:' + x);
  // 诗诀是文言,不许出现在初断里(它只该进 c.report 给模型看)
  ok(!/verse/.test(HTML.slice(HTML.indexOf("kind: '小六壬三宫'"), HTML.indexOf("kind: '小六壬三宫'") + 400)),
    '小六壬的诗诀不该进初断');
});

console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
