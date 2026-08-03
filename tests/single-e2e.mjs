// 单文件桌面版自测:dist/dongxuan.html 必须自足——「看人运势」在文件内直接打开
// (历史 bug:单文件里点运势去找外部 yunshi.html,用户看到「文件已被删除」)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FILE = join(ROOT, 'dist', 'dongxuan.html');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };

if (!existsSync(FILE)) { console.error('缺 dist/dongxuan.html,先跑 node build-single.mjs'); process.exit(1); }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGE: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
// 单文件版不该再向外部取任何资源(除 AI 接口),file:// 下外链即死链
const outbound = [];
page.on('requestfailed', r => { if (!r.url().startsWith('data:')) outbound.push(r.url()); });

await page.goto('file://' + FILE);
console.log('单文件桌面版 · 运势入口');

// 1) 卡片入口
await page.evaluate(() => window.dxShowView('boards'));
await page.click('.bcard[data-href="yunshi.html"]');
await page.waitForSelector('#dx-yunshi-ov', { timeout: 5000 });
ok('点「命·看人运势」卡片弹出应用内浮层', await page.locator('#dx-yunshi-ov').count() === 1);
ok('浏览器没被导航去外部 yunshi.html', page.url().endsWith('dongxuan.html'), page.url());

const fr = page.frameLocator('#dx-yunshi-frame');
await fr.locator('#btn-go').waitFor({ timeout: 8000 });
ok('运势页脚本已内联,排盘按钮就位', true);

// 2) 真排一盘,证明 bazi/yunshi/sanmei/dili 全都进来了
await fr.locator('#bdate').fill('1990-05-20');
await fr.locator('#btime').fill('09:30');
await fr.locator('#bplace').fill('杭州');
await fr.locator('#btn-go').click();
await page.waitForTimeout(1500);
const txt = await fr.locator('body').innerText();
ok('排出四柱', /日主|四柱|年柱/.test(txt));
ok('日运卡在', /日运|今日/.test(txt));
ok('月运卡在', /月运|本月/.test(txt));
ok('年运卡在', /年运|今年/.test(txt));
ok('人体星図(算命学)在', /星図|貫索|玉堂|従星/.test(txt), txt.slice(0, 200));

// 3) 返回 / 再进
await page.click('#dx-yunshi-back');
await page.waitForTimeout(150);
ok('返回键关掉浮层', await page.locator('#dx-yunshi-ov').count() === 0);
await page.evaluate(() => window.dxShowView('ask'));
await page.click('a[href="yunshi.html"]');
await page.waitForSelector('#dx-yunshi-ov', { timeout: 5000 });
ok('顶部导航「看人运势」同样弹出浮层', await page.locator('#dx-yunshi-ov').count() === 1);

// 3b) 底栏「运势」页签(用户两次说找不到运势,底栏必须常驻入口)
await page.click('#dx-yunshi-back');
await page.click('#nav-yunshi');
await page.waitForSelector('#dx-yunshi-ov', { timeout: 5000 });
ok('底栏「运」页签弹出浮层', await page.locator('#dx-yunshi-ov').count() === 1);
ok('底栏点运势没跳外部文件', page.url().endsWith('dongxuan.html'), page.url());

// 4) 夜间主题:浮层里的运势页跟主程序同色系,不再白闪
await page.click('#dx-yunshi-back');
await page.evaluate(() => { document.getElementById('btn-theme').click(); });
await page.waitForTimeout(150);
const isDark = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');
ok('主程序切到夜间', isDark);
await page.evaluate(() => window.dxShowView('boards'));
await page.click('.bcard[data-href="yunshi.html"]');
await page.waitForSelector('#dx-yunshi-ov', { timeout: 5000 });
await fr.locator('#btn-go').waitFor({ timeout: 8000 });
const frDark = await page.frameLocator('#dx-yunshi-frame').locator('body').evaluate(
  b => ({ theme: b.ownerDocument.documentElement.dataset.theme, bg: getComputedStyle(b).backgroundColor }));
ok('浮层内运势页同为夜间', frDark.theme === 'dark', JSON.stringify(frDark));
// v1.09:影院黑换成暖墨咖(#171210 = rgb(23,18,16)),用户点名「不要黑色」——底仍是深色,色温转暖
ok('运势页夜间底色是暖墨不是白纸也不是纯黑灰', /23, 18, 16/.test(frDark.bg), frDark.bg);

// 4.5) 新板块的引擎也得真进单文件里(漏登记 build-single 清单是老毛病)
await page.click('#dx-yunshi-back');
await page.evaluate(() => window.dxOpenBoard('sec-dingshi'));
await page.fill('#ds-birth', '1985-11-03');
await page.selectOption('#ds-gender', '女');
await page.click('#btn-ds-demo');
await page.click('#btn-ds-go');
await page.waitForTimeout(1200);
const dsTxt = await page.locator('#ds-out').innerText();
ok('定时辰板块在单文件里能算', /可以定|定不了/.test(dsTxt), dsTxt.slice(0, 60));
ok('定时辰给出同结论分组', await page.locator('#ds-out .dsgrp').count() >= 1);

// 5) 洁净度
ok('无页面报错', errs.length === 0, errs.join(' | '));
ok('无外部资源请求(单文件自足)', outbound.length === 0, outbound.join(' | '));

await browser.close();
console.log(`单文件版:${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
