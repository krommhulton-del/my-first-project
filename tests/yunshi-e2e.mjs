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
  ok(/身(强|偏强|弱|偏弱)/.test(bl) && /命/.test(bl), '身强弱白话:' + bl);
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
    ok((await cards.nth(i).locator('.ytext').textContent()).length >= 15, '白话正文');
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

await browser.close();
server.close();
console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
