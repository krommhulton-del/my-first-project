import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT='/home/user/my-first-project', PORT=8873;
const OUT='/tmp/claude-0/-home-user-my-first-project/206d99f1-891b-578b-8b80-5ee4644c8d35/scratchpad';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{const p=req.url==='/'?'/index.html':req.url.split('?')[0];
 try{const b=await readFile(join(ROOT,p));res.writeHead(200,{'Content-Type':MIME[extname(p)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end('x');}});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const ctx=await browser.newContext(); const page=await ctx.newPage();
let cap=null;
const SSE='event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"(拦截)"}}\n\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n';
await ctx.route('**://api.anthropic.com/**', async route=>{
  try{ cap=JSON.parse(route.request().postData()||'{}'); }catch(e){ cap=null; }
  await route.fulfill({status:200, contentType:'text/event-stream', body:SSE});
});
await page.addInitScript(()=>{ localStorage.setItem('dongxuan_api_key','sk-ant-test'); localStorage.setItem('dongxuan_ai_provider','claude'); localStorage.setItem('dongxuan_birth','1990-06-15'); localStorage.setItem('dongxuan_birth_hour','5'); });
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.evaluate(()=>dxOpenBoard('sec-wj'));

const hits=[];
for (let t=0;t<14;t++){
  await page.fill('#wj-q','一年后我和现在这个人还在不在一起');
  await page.click('#btn-wj-start'); await page.waitForTimeout(200);
  for(let i=0;i<3;i++){ await page.locator('#wj-plan .wj-cast').first().click(); await page.waitForTimeout(150); }
  const uiRes = (await page.locator('#wj-plan .dwcast .res').first().textContent()).trim();
  const uiChips = (await page.locator('#wj-plan .cdrow').first().locator('.cdhead').textContent()).replace(/\s+/g,' ').trim();
  cap=null;
  await page.click('#btn-wj-read'); await page.waitForTimeout(700);
  const msg = cap && cap.messages && cap.messages[0] ? (typeof cap.messages[0].content==='string'?cap.messages[0].content:JSON.stringify(cap.messages[0].content)) : '';
  const lock = (msg.match(/【基调锁定[^\n]*/)||[''])[0];
  const fen  = (msg.match(/基调分值:[^\n]*/)||[''])[0];
  console.log(`\n#${t}\n  界面摘要: ${uiRes}\n  界面chip: ${uiChips}\n  材料锁定: ${lock}\n  材料分值: ${fen}`);
  hits.push({uiRes,uiChips,lock,fen,msg});
  await page.evaluate(()=>{ document.getElementById('wj-out').innerHTML=''; });
}
await writeFile(join(OUT,'wj-mats.txt'), hits.map((h,i)=>`===== #${i}\n${h.msg}`).join('\n\n'),'utf8');
await browser.close(); server.close();
