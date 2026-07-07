// 内测:端到端浏览器测试(node tests/e2e.mjs)
// 静态服务 + 无头 Chromium,验证:一键成卦、逐爻掷、解读渲染、回报格式、历史持久化与删除。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8737;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext()).newPage();

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '——', e.message); }
}
const ok = (v, m) => { if (!v) throw new Error(m || '断言失败'); };

const URL0 = `http://127.0.0.1:${PORT}/`;
await page.goto(URL0);

await t('页面加载:标题与起卦区可见', async () => {
  ok(await page.title() === '东玄卜卦 · 三钱起卦', '标题不符');
  ok(await page.locator('#btn-auto').isVisible(), '一键成卦按钮不可见');
});

await t('一键成卦:六爻掷齐,卦象/解读/回报三区出现', async () => {
  await page.fill('#question', '内测第一问:此程序可用否?');
  await page.click('#btn-auto');
  await page.waitForSelector('#sec-read:not(.hidden)', { timeout: 8000 });
  ok((await page.locator('#tosslog .toss').count()) === 6, '应有 6 条掷币记录');
  const headline = await page.textContent('#headline');
  ok(/^本卦.+/.test(headline), '首行断卦格式:' + headline);
  const lv = await page.textContent('#v-lv');
  ok(['大吉', '吉', '小吉', '平吉', '平', '谨慎', '凶', '大凶'].includes(lv), '断语等级:' + lv);
  ok((await page.locator('#focus .fblock').count()) >= 1, '应有断卦依据');
});

await t('回报文本:六行主报 + 纳甲排盘附录', async () => {
  const rep = await page.inputValue('#report');
  const lines = rep.split('\n');
  ok(lines[0] === '【东玄掷卦 · 卦象回报】', lines[0]);
  ok(/^六爻\(自下而上\):[6-9](、[6-9]){5}$/.test(lines[1]), lines[1]);
  ok(/^本卦:.+\(上卦. \/ 下卦.\)$/.test(lines[2]), lines[2]);
  ok(/^动爻:/.test(lines[3]) && /^变卦:/.test(lines[4]), lines[3] + '|' + lines[4]);
  ok(lines[5] === '我要问的事:内测第一问:此程序可用否?', lines[5]);
  ok(lines[6] === '【纳甲排盘】', lines[6]);
  ok(rep.includes('月建:') && rep.includes('旬空:') && rep.includes('卦宫:'), '排盘要素');
  ok(/初爻 (青龙|朱雀|勾陈|螣蛇|白虎|玄武) (父母|兄弟|子孙|妻财|官鬼)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][金木水火土]/.test(rep), '六爻纳甲行');
});

await t('纳甲排盘区:六行、世应各一、干支合法', async () => {
  ok(!(await page.locator('#sec-pan').evaluate(el => el.classList.contains('hidden'))), '排盘区应可见');
  ok((await page.locator('#pan-body tr').count()) === 6, '排盘应有 6 行');
  const shiYing = await page.locator('#pan-body .sy').allTextContents();
  ok(shiYing.filter(s => s === '世').length === 1 && shiYing.filter(s => s === '应').length === 1, '世应各一:' + shiYing.join(','));
  ok(/[乾兑离震巽坎艮坤]宫/.test(await page.textContent('#pan-info')), '卦宫标注');
});

await t('AI 深断区:无 Key 时点击给出设置提示', async () => {
  ok(!(await page.locator('#sec-ai').evaluate(el => el.classList.contains('hidden'))), 'AI 区应可见');
  await page.click('#btn-deepread');
  const status = await page.textContent('#ai-status');
  ok(status.includes('API Key'), '应提示设置 Key,得到:' + status);
  ok(!(await page.locator('#keybox').evaluate(el => el.classList.contains('hidden'))), 'Key 输入框应展开');
});

await t('AI 深断区:保存/清除 Key 走 localStorage', async () => {
  await page.fill('#api-key', 'sk-ant-test-123');
  await page.click('#btn-savekey');
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_api_key'))) === 'sk-ant-test-123', 'Key 应已保存');
  await page.click('#btn-togglekey');
  await page.click('#btn-clearkey');
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_api_key'))) === null, 'Key 应已清除');
  await page.click('#btn-togglekey');
});

await t('DeepSeek 通道:切换服务商、模型列表、Key 独立存储', async () => {
  await page.selectOption('#ai-provider', 'deepseek');
  const opts = await page.locator('#ai-model option').allTextContents();
  ok(opts.some(o => o.includes('DeepSeek R1')), '模型列表应为 DeepSeek:' + opts.join(','));
  await page.click('#btn-deepread');
  ok((await page.textContent('#ai-status')).includes('DeepSeek'), '无 Key 提示应指向 DeepSeek');
  await page.fill('#api-key', 'sk-ds-test-456');
  await page.click('#btn-savekey');
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_ds_key'))) === 'sk-ds-test-456', 'DS Key 应独立保存');
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_api_key'))) === null, 'Claude Key 不受影响');
  await page.selectOption('#ai-provider', 'claude');
  const opts2 = await page.locator('#ai-model option').allTextContents();
  ok(opts2.some(o => o.includes('Fable')), '切回 Claude 模型列表:' + opts2.join(','));
  await page.evaluate(() => localStorage.removeItem('dongxuan_ds_key'));
});

await t('历史记录:成卦自动入档', async () => {
  ok((await page.locator('#histlist .hist').count()) === 1, '应有 1 条卦档');
});

await t('逐爻掷:清盘后手掷六次亦可成卦', async () => {
  await page.click('#btn-reset');
  ok(await page.locator('#sec-read').evaluate(el => el.classList.contains('hidden')), '清盘后解读区应隐藏');
  await page.fill('#question', '内测第二问:逐爻掷可用否?');
  for (let i = 0; i < 6; i++) await page.click('#btn-step');
  await page.waitForSelector('#sec-read:not(.hidden)');
  ok((await page.locator('#histlist .hist').count()) === 2, '卦档应为 2 条');
});

await t('历史持久化:刷新页面卦档仍在', async () => {
  await page.reload();
  ok((await page.locator('#histlist .hist').count()) === 2, '刷新后卦档应为 2 条');
});

await t('卦档展开与删除', async () => {
  await page.click('#histlist .hist:first-child .head');
  ok(await page.locator('#histlist .hist:first-child .body pre').isVisible(), '展开后应见回报全文');
  await page.click('#histlist .hist:first-child .btn-delrec');
  ok((await page.locator('#histlist .hist').count()) === 1, '删除后应剩 1 条');
});

await t('清空卦档', async () => {
  page.once('dialog', d => d.accept());
  await page.click('#btn-clearhist');
  await page.waitForFunction(() => document.querySelectorAll('#histlist .hist').length === 0);
  ok((await page.locator('#histlist .hist').count()) === 0, '应清空');
});

await t('梅花易数:报数起卦出体用互变三卦', async () => {
  await page.click('.tabs button[data-m=meihua]');
  ok(await page.locator('#sec-mh').isVisible(), '梅花面板应可见');
  ok(await page.locator('#sec-cast').evaluate(el => el.classList.contains('hidden')), '六爻面板应隐藏');
  await page.fill('#question', '梅花内测一问');
  await page.fill('#mh-n1', '3');
  await page.fill('#mh-n2', '5');
  await page.click('#btn-mh');
  await page.waitForSelector('#sec-mhres:not(.hidden)');
  ok((await page.locator('#mh-guas .guabox').count()) === 3, '本互变三卦');
  ok(['大吉', '吉', '小吉', '不利', '凶'].includes(await page.textContent('#mh-lv')), '体用断语等级');
  const rep = await page.inputValue('#report');
  ok(rep.startsWith('【东玄梅花 · 卦象回报】'), rep.split('\n')[0]);
  ok(rep.includes('互卦:') && rep.includes('体用断:'), '回报要素');
});

await t('小六壬:时间起课三宫齐、诗诀在', async () => {
  await page.click('.tabs button[data-m=xlr]');
  await page.click('#btn-xlr');
  await page.waitForSelector('#sec-xlrres:not(.hidden)');
  ok((await page.locator('#xlr-gongs .gongbox').count()) === 3, '三宫');
  const names = await page.locator('#xlr-gongs .g-name').allTextContents();
  for (const n of names) ok(['大安', '留连', '速喜', '赤口', '小吉', '空亡'].includes(n), n);
  const rep = await page.inputValue('#report');
  ok(rep.startsWith('【东玄小六壬 · 课象回报】'), rep.split('\n')[0]);
});

await t('分科两步选择:点类别展开排序推荐,点方法才切法门', async () => {
  ok((await page.locator('#fenke-chips .fk').count()) === 13, '十三科');
  // 点类别:展开推荐,但先不切法门
  await page.click('.fk[data-id=fangwei]');
  ok(!(await page.locator('#fk-recommend').evaluate(el => el.classList.contains('hidden'))), '推荐面板应展开');
  const opts = page.locator('#fk-recommend .mopt');
  ok((await opts.count()) >= 2, '方位类应给多种方法供选');
  ok((await opts.first().locator('.rtag').textContent()) === '首选', '首项标首选');
  ok((await opts.first().locator('.mname').textContent()) === '梅花易数', '方位首选梅花');
  // 点首选方法 → 切到梅花、填问题
  await opts.first().click();
  ok(await page.locator('#sec-mh').isVisible(), '应切到梅花面板');
  ok((await page.inputValue('#question')).includes('方向'), '问题模板已填');
});

await t('分科可改选非首选方法(方位改选六爻)', async () => {
  await page.click('.fk[data-id=fangwei]'); // 收起
  await page.click('.fk[data-id=fangwei]'); // 重新展开
  const opts = page.locator('#fk-recommend .mopt');
  const labels = await opts.locator('.mname').allTextContents();
  const liuyaoIdx = labels.indexOf('六爻');
  ok(liuyaoIdx >= 0, '方位推荐应含六爻可选:' + labels.join(','));
  await opts.nth(liuyaoIdx).click();
  ok(await page.locator('#sec-cast').isVisible(), '改选六爻后应切到六爻面板');
});

await t('分科日运首选小六壬、年运首选蓍草', async () => {
  await page.click('.fk[data-id=riyun]');
  const ri = page.locator('#fk-recommend .mopt').first();
  ok((await ri.locator('.mname').textContent()) === '小六壬', '日运首选小六壬');
  await ri.click();
  ok(await page.locator('#sec-xlr').isVisible(), '切到小六壬');
  await page.click('.fk[data-id=nianyun]');
  ok((await page.locator('#fk-recommend .mopt').first().locator('.mmode').textContent()).includes('蓍草'), '年运首选蓍草');
  // 取消选科
  await page.click('.fk[data-id=nianyun]');
  ok((await page.locator('.fk.on').count()) === 0, '取消选科');
  ok(await page.locator('#fk-recommend').evaluate(el => el.classList.contains('hidden')), '推荐面板收起');
  await page.click('.tabs button[data-m=liuyao]');
});

await t('卦档法门徽记与蓍草起卦', async () => {
  const badges = await page.locator('#histlist .badge').allTextContents();
  ok(badges.includes('梅花') && badges.includes('小六壬'), '徽记:' + badges.join(','));
  // 蓍草大衍法起一卦
  await page.click('.tabs button[data-m=liuyao]');
  await page.check('input[name=ly-mode][value=dayan]');
  await page.click('#btn-auto');
  await page.waitForSelector('#sec-read:not(.hidden)', { timeout: 8000 });
  const rep = await page.inputValue('#report');
  ok(rep.includes('蓍草大衍'), '回报应注明蓍草法');
  const badges2 = await page.locator('#histlist .badge').allTextContents();
  ok(badges2.includes('六爻·蓍草'), '蓍草徽记:' + badges2.join(','));
});

await browser.close();
server.close();
console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
