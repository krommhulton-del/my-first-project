// 一次性截图(不入库):运势页人体星図
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = '/home/user/my-first-project';
const out = '/tmp/claude-0/-home-user-my-first-project/206d99f1-891b-578b-8b80-5ee4644c8d35/scratchpad';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/yunshi.html';
  const f = path.join(root, p);
  try { res.setHeader('Content-Type', mime[path.extname(f)] || 'text/plain'); res.end(fs.readFileSync(f)); }
  catch { res.statusCode = 404; res.end('nf'); }
});
await new Promise(r => server.listen(8127, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
await page.goto('http://localhost:8127/yunshi.html');
await page.fill('#bdate', '1990-06-15');
await page.fill('#btime', '08:30');
await page.click('#btn-go');
await page.waitForSelector('#sm-grid .sm-cell');
await page.locator('#sec-sanmei').scrollIntoViewIfNeeded();
await page.locator('#sec-sanmei').screenshot({ path: out + '/sanmei.png' });
await browser.close();
server.close();
console.log('done');
