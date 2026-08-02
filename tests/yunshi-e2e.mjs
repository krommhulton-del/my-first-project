// 内测:运势页端到端(node tests/yunshi-e2e.mjs)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8751;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const path = req.url === '/' ? '/yunshi.html' : req.url.split('?')[0];
  try { const b = await readFile(join(ROOT, path)); res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.error('  ✗', name, '——', e.message); } }
const ok = (v, m) => { if (!v) throw new Error(m || '断言失败'); };

await page.goto(`http://127.0.0.1:${PORT}/`);

await t('页面加载:标题与生辰输入可见,无脚本错误', async () => {
  ok(await page.title() === '东玄运势 · 看人日月年运', '标题');
  ok(await page.locator('#btn-go').isVisible(), '排盘按钮');
});

await t('未填日期点排盘 → 报错提示', async () => {
  await page.click('#btn-go');
  ok((await page.textContent('#in-err')).includes('出生日期'), '应提示填日期');
});

await t('排盘:四柱四列、日主标注、身强弱大白话', async () => {
  await page.fill('#bdate', '1990-06-15');
  await page.fill('#btime', '10:30');
  await page.selectOption('#gender', '男');
  await page.click('#btn-go');
  await page.waitForSelector('#sec-ming:not(.hidden)');
  ok((await page.locator('#pillars .pcol').count()) === 4, '四柱四列');
  const ss = await page.locator('#pillars .pcol .ss').allTextContents();
  ok(ss.includes('日主'), '日主标注:' + ss.join(','));
  const bl = await page.textContent('#body-line');
  // v0.81 改断言:这一条名叫「大白话」,可断言原先要求那一行必须出现「身强/身弱」——
  // 钉的正是要洗掉的术语。现在正反两头都钉:必须给出底子的厚薄,且不许再出现那几个名目。
  ok(/底子/.test(bl) && /(厚|薄|不厚不薄)/.test(bl) && /命/.test(bl), '底子厚薄的大白话:' + bl);
  ok(!/身(强|旺|弱)|偏(旺|弱)/.test(bl), '这一行不许再出现旺衰的名目:' + bl);
});

await t('人体星図:五主星三従星、中心星描边、能量点数与天中殺注解', async () => {
  ok(!(await page.locator('#sec-sanmei').evaluate(el => el.classList.contains('hidden'))), '星図区应显示');
  const stars = await page.locator('#sm-grid .sm-cell .star').allTextContents();
  ok(stars.length === 8, `应八星,得${stars.length}:` + stars.join(','));
  ok(stars.every(s => /星$/.test(s)), '皆以星结尾');
  ok((await page.locator('#sm-grid .sm-cell.center').count()) === 1, '中心星唯一');
  const sub = await page.textContent('#sm-sub');
  ok(sub.includes('点') && sub.includes('天中殺') && sub.includes('中心星'), '能量与天中殺注解:' + sub.slice(0, 50));
});

await t('运势三卡:今日/本月/今年,含等级与领域,白话成句', async () => {
  await page.waitForSelector('#sec-yun:not(.hidden)');
  const cards = page.locator('#yun-cards .yscard');
  ok((await cards.count()) === 3, '三张卡');
  const labels = await cards.locator('.ylabel').allTextContents();
  ok(labels.join(',') === '日运,月运,年运', '卡序:' + labels.join(','));
  for (let i = 0; i < 3; i++) {
    const lv = await cards.nth(i).locator('.ylv').textContent();
    ok(['大吉', '吉', '平顺', '小凶', '凶'].includes(lv), '等级:' + lv);
    ok((await cards.nth(i).locator('.ytext').first().textContent()).length >= 15, '白话正文');
    ok((await cards.nth(i).locator('.ytext').count()) >= 2, '应带分步细账(干支拆解/十神两层/动宫等)');
  }
});

await t('大运表:八步 + 当前步高亮', async () => {
  ok(await page.locator('#sec-dayun:not(.hidden)').isVisible(), '大运区可见');
  ok((await page.locator('#dayun-body td').count()) === 9, '一列标题+八步');
});

await t('查某一天的运:改日期 → 流日卡随之变化', async () => {
  const before = await page.locator('#yun-cards .yscard').first().locator('.ymeta').textContent();
  await page.fill('#qdate', '2027-02-14');
  await page.click('#btn-qday');
  await page.waitForTimeout(150);
  const after = await page.locator('#yun-cards .yscard').first().locator('.ymeta').textContent();
  ok(before !== after, '流日卡应随日期变化');
});

await t('AI 深批区:切 DeepSeek、Key 独立存、无 Key 提示', async () => {
  ok(await page.locator('#sec-ai').isVisible(), 'AI 区可见');
  await page.selectOption('#ai-provider', 'deepseek');
  ok((await page.locator('#ai-model option').allTextContents()).some(o => o.includes('DeepSeek R1')), 'DS 模型列表');
  await page.click('#btn-ai');
  ok((await page.textContent('#ai-status')).includes('DeepSeek'), '无 Key 提示指向 DeepSeek');
  await page.fill('#api-key', 'sk-ds-x'); await page.click('#btn-savekey');
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_ds_key'))) === 'sk-ds-x', 'DS Key 独立存');
  await page.evaluate(() => localStorage.removeItem('dongxuan_ds_key'));
});

await t('无横向溢出、全程无脚本错误', async () => {
  const of = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(of === 0, '横向溢出 ' + of);
  ok(errs.length === 0, '脚本错误:' + errs.join('; '));
});

await t('生辰档案簿:存两份、切换即重排、刷新自动套用上次那份', async () => {
  await page.evaluate(() => { try { localStorage.removeItem('dongxuan_profiles_v1'); localStorage.removeItem('dongxuan_profile_cur'); } catch (e) {} });
  await page.reload();
  await page.fill('#bdate', '1990-05-20'); await page.fill('#btime', '09:30'); await page.fill('#prof-name', '甲');
  await page.click('#btn-go'); await page.waitForTimeout(400);
  await page.click('#btn-prof-save'); await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById('prof-sel').value = ''; });
  await page.fill('#bdate', '1985-08-03'); await page.fill('#btime', '20:00');
  await page.selectOption('#gender', '女'); await page.fill('#prof-name', '乙');
  await page.click('#btn-go'); await page.waitForTimeout(400);
  await page.click('#btn-prof-save'); await page.waitForTimeout(300);
  const opts = await page.locator('#prof-sel option').allTextContents();
  ok(opts.length === 3 && opts.join().includes('甲') && opts.join().includes('乙'), '两份档案都该在下拉里:' + opts.join(' | '));
  const firstId = await page.evaluate(() => JSON.parse(localStorage.getItem('dongxuan_profiles_v1'))[0].id);
  await page.selectOption('#prof-sel', firstId);
  await page.waitForTimeout(800);
  ok(await page.inputValue('#bdate') === '1990-05-20', '切档案后生日字段应跟着换');
  ok(await page.locator('#sec-ming').isVisible(), '切档案应自动重排');
  await page.reload(); await page.waitForTimeout(1000);
  ok(await page.inputValue('#bdate') === '1990-05-20', '刷新后应自动套用上次那份');
  ok(await page.locator('#sec-ming').isVisible(), '刷新后命盘应直接就位');
});

await t('三档时间各自可选:日/月/年分别指定,还能一键回到今天', async () => {
  await page.fill('#qyear', '2030');
  await page.selectOption('#qmonth', '9');
  await page.click('#btn-qday');
  await page.waitForTimeout(600);
  const yTxt = await page.locator('#yun-cards').innerText();
  ok(yTxt.includes('2030') || yTxt.includes('庚戌'), '年运月运应随之改:' + yTxt.slice(0, 100));
  await page.click('#btn-qtoday');
  await page.waitForTimeout(500);
  ok((await page.inputValue('#qyear')) === String(new Date().getFullYear()), '「回到今天」应把三档拨回当下');
});

await t('逐年细账:每年列多事型、可展开十二流月(应期落到月)', async () => {
  const yrow = page.locator('.yrow').first();
  ok((await yrow.locator('.ycat').count()) >= 1, '每年应列出事型');
  await page.evaluate(() => { const d = document.querySelector('.ymons'); if (d) d.open = true; });
  await page.waitForTimeout(300);
  ok((await page.locator('.yrow').first().locator('.ymon').count()) === 12, '展开后应有十二个流月');
});

await t('格局:取格、成败、原话俱在,且不带术语不改喜忌', async () => {
  ok(await page.locator('#sec-geju').isVisible(), '格局版块应显示');
  const head = await page.locator('#gj-head').innerText();
  ok(head.length > 8, '第一句白话结论要在:' + head);
  const BAN = /正官|七杀|偏印|食神|伤官|比劫|用神|喜忌|旺衰|格局|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/;
  ok(!BAN.test(head), '白话结论里不许带术语:' + head);
  const take = await page.locator('#gj-take').innerText();
  ok(/主线/.test(take), '取格那一行要说清是按什么定的:' + take);
  const body = await page.locator('#gj-body').innerText();
  ok(body.length > 10, '成败区不能是空的');
  // 有成败条目时必须逐条附原话
  const li = await page.locator('#gj-body .gj-li').count();
  if (li && !/没照到/.test(body)) {
    ok((await page.locator('#gj-body .gj-li q').count()) >= 1, '每条断语都要附书上原话');
  }
  const foot = await page.locator('#gj-foot').innerText();
  ok(/没做/.test(foot) && /不替你合成一个答案/.test(foot), '末尾要写明没做什么、且不与喜忌合流:' + foot);
  ok(!/仅供参考|因人而异/.test(body + head + foot), '不许出现空话');
});

await t('往年细账:能翻到出生起运以来每一年,并明说是给用户对账用的', async () => {
  ok(await page.locator('#ds-past').count() === 1, '往年区块应存在');
  const txt = await page.locator('#ds-past').innerText();
  ok(/翻看往年:\d{4}—\d{4} 共 \d+ 年/.test(txt), '应给出往年年份范围:' + txt.slice(0, 60));
  await page.evaluate(() => { const d = document.querySelector('#ds-past details'); if (d) d.open = true; });
  await page.waitForTimeout(300);
  const opened = await page.locator('#ds-past').innerText();
  ok(/对账/.test(opened) && /驳回我/.test(opened), '要明说是给用户对账、对不上就驳回:' + opened.slice(0, 200));
  ok((await page.locator('#ds-past .yrow').count()) >= 10, '往年应逐年列出');
  ok((await page.locator('#ds-past .ymons').count()) >= 10, '往年也要能展开十二流月');
});

await t('三件说清楚:明面底下是什么、月年不按日历、等级五档', async () => {
  const how = await page.locator('#yun-howto').innerText();
  ok(/明面上那股力/.test(how) && /底下那股力/.test(how), '要解释明面与底下各指什么:' + how.slice(0, 60));
  ok(/节气/.test(how) && /立春/.test(how), '要说清月按节气、年按立春');
  ok(/大吉|平顺/.test(how), '要给出五档尺度');
  const cards = await page.locator('#yun-cards').innerText();
  ok(/\d+月\d+日—/.test(cards), '月运年运卡上要写真实起止日期:' + cards.slice(0, 120));
  ok(/不是公历/.test(cards), '要点明不是公历的月/年');
  ok(/五档里的第\d档/.test(cards), '角标要标明第几档');
});

await t('日月年三种尺度说的不是同一句话', async () => {
  const txts = await page.locator('#yun-cards .yscard .ytext').allInnerTexts();
  const firsts = [txts[0], txts[Math.floor(txts.length / 2)]].filter(Boolean);
  ok(firsts.length >= 2, '取不到卡片正文');
  const all = await page.locator('#yun-cards').innerText();
  ok(/就今天这一天而言/.test(all), '日运要落到「今天这一天」');
  ok(/这一个月是这么个基调/.test(all), '月运要落到「这一个月」');
  ok(/整整一年都是这个底子/.test(all), '年运要落到「整整一年」');
});

// ——— v0.77:姻缘方向留白 + 结论稳不稳 ———
await t('姻缘那一类:不填感情状态,年表把两条路都摆出来,不下吉凶断语', async () => {
  await page.selectOption('#marital', '');
  await page.click('#btn-go');
  await page.waitForSelector('#sec-dashi:not(.hidden)');
  // 往年节点默认折叠,点开才看得到全部
  const det = page.locator('#ds-nodes details.dspast');
  if (await det.count()) await det.first().click();
  const all = await page.locator('#ds-nodes').innerText();
  const yy = all.split('\n').filter(l => l.includes('感情'));
  ok(yy.length, '年表里没有感情类节点,换个生日');
  const held = yy.filter(l => l.includes('单身') && l.includes('有伴'));
  ok(held.length, '不填状态时,姻缘断语必须把「单身会怎样、有伴会怎样」两条路都写出来:' + yy[0].slice(0, 60));
  ok(!/这年感情大吉|感情必有波折/.test(all), '不填状态时不许自己下吉凶断语');
});

await t('填了感情状态:方向跟着处境走,并写明这一层不是卦定的', async () => {
  await page.selectOption('#marital', '有伴');
  await page.click('#btn-go');
  await page.waitForSelector('#sec-dashi:not(.hidden)');
  const det = page.locator('#ds-nodes details.dspast');
  if (await det.count()) await det.first().click();
  const all = await page.locator('#ds-nodes').innerText();
  ok(/不是卦定的/.test(all), '按处境断的那一条,依据里必须写明来源:' + all.slice(0, 200));
  ok(/有伴/.test(all), '依据里要点出用的是哪一种处境');
});

await t('结论稳不稳:填了钟点不提示;勾了「不知道钟点」就当面说清底下的话靠不靠得住', async () => {
  ok(!(await page.locator('#stab-box .stab').count()), '填了确切钟点不该跳这个提示');
  await page.check('#bt-unknown');
  ok(await page.locator('#btime').isDisabled(), '勾上之后钟点框应停用,免得人以为那个值是他填的');
  await page.click('#btn-go');
  await page.waitForSelector('#sec-ming:not(.hidden)');
  const box = page.locator('#stab-box .stab');
  ok(await box.count(), '没填钟点就必须给出「稳不稳」的判断');
  const txt = await box.innerText();
  ok(/时辰/.test(txt), '话要落到时辰上:' + txt.slice(0, 80));
  ok(/定时辰|不用纠结/.test(txt), '要么指路去定时辰,要么明说不用纠结:' + txt.slice(0, 120));
  await page.uncheck('#bt-unknown');
});

await t('无页面报错', async () => { ok(errs.length === 0, errs.join(' | ')); });

await browser.close();
server.close();
console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
