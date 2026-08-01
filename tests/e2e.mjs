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
// 分科组默认折叠;点分科片前先全部展开
const expandGroups = () => page.evaluate(() => {
  document.querySelectorAll('.fold .foldbody').forEach(el => el.classList.remove('hidden'));
  document.querySelectorAll('#fenke-chips .fkrow').forEach(r => r.classList.remove('hidden'));
});

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

await t('追问区:初始隐藏;展开后快捷按钮填模板、无深断时追问给提示', async () => {
  ok(await page.locator('#ai-followup').evaluate(el => el.classList.contains('hidden')), '追问区初始应隐藏');
  // 展开追问区(正常由深断成功后触发;此处直接显示以测交互)
  await page.evaluate(() => document.getElementById('ai-followup').classList.remove('hidden'));
  await page.locator('.fq').first().click();
  ok((await page.inputValue('#fu-input')).length > 5, '快捷按钮应填入追问模板');
  await page.click('#btn-followup');
  ok((await page.textContent('#ai-status')).includes('深断'), '未深断先追问应提示:' + (await page.textContent('#ai-status')));
  await page.fill('#fu-input', '');
  await page.evaluate(() => document.getElementById('ai-followup').classList.add('hidden'));
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
  await page.evaluate(() => dxShowView('hist'));
  await expandGroups();
  await page.click('#histlist .hist:first-child .head');
  ok(await page.locator('#histlist .hist:first-child .body pre').isVisible(), '展开后应见回报全文');
  await page.click('#histlist .hist:first-child .btn-delrec');
  ok((await page.locator('#histlist .hist').count()) === 1, '删除后应剩 1 条');
});

await t('清空卦档', async () => {
  await page.evaluate(() => dxShowView('hist'));
  await expandGroups();
  page.once('dialog', d => d.accept());
  await page.click('#btn-clearhist');
  await page.waitForFunction(() => document.querySelectorAll('#histlist .hist').length === 0);
  ok((await page.locator('#histlist .hist').count()) === 0, '应清空');
  await page.evaluate(() => dxShowView('ask'));
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

await t('奇门遁甲:此刻起局出九宫、值符值使、事宫、回报', async () => {
  await page.click('.tabs button[data-m=qimen]');
  ok(await page.locator('#sec-qm').isVisible(), '奇门起局面板应可见');
  await page.fill('#question', '奇门内测一问,往哪个方向利');
  await page.click('#btn-qm');
  await page.waitForSelector('#sec-qmres:not(.hidden)');
  ok((await page.locator('#qm-grid .qmcell').count()) === 9, '九宫九格');
  ok((await page.locator('#qm-grid .qmcell.key').count()) === 1, '事宫高亮一格');
  const info = await page.locator('#qm-info').textContent();
  ok(/遁.*局/.test(info), '起局含遁局:' + info.slice(0, 40));
  ok(info.includes('同一时辰'), '应标明同一时辰一局不变的规矩');
  ok(info.includes('空亡'), '应报时旬空亡');
  const notes = await page.locator('#qm-notes').textContent();
  ok(notes.includes('值符'), '含值符值使白话');
  ok(notes.includes('为什么断'), '应给断语依据');
  const rep = await page.inputValue('#report');
  ok(rep.includes('奇门遁甲') && rep.includes('值使'), '回报含奇门起局:' + rep.split('\n')[0]);
});

await t('分科全面版:≥75 专科、十四大类、含奇门派单', async () => {
  ok((await page.locator('#fenke-chips .fk').count()) >= 75, '专科数 ' + (await page.locator('#fenke-chips .fk').count()));
  ok((await page.locator('#fenke-chips .fkgroup').count()) >= 14, '应分十四大类以上');
});

await t('分科两步选择:点类别展开排序推荐,点方法才切法门', async () => {
  await expandGroups();
  await page.click('.fk[data-id=banjia]');
  ok(!(await page.locator('#fk-recommend').evaluate(el => el.classList.contains('hidden'))), '推荐面板应展开');
  const opts = page.locator('#fk-recommend .mopt');
  ok((await opts.count()) >= 2, '搬家方位类应给多种方法供选');
  ok((await opts.first().locator('.rtag').textContent()) === '首选', '首项标首选');
  ok((await opts.first().locator('.mname').textContent()) === '奇门遁甲', '搬家方位首选奇门');
  await opts.first().click();
  ok(await page.locator('#sec-qm').isVisible(), '应切到奇门面板');
  ok((await page.inputValue('#question')).includes('方向'), '问题模板已填');
});

await t('分科可改选非首选方法(搬家改选六爻)', async () => {
  await expandGroups();
  await page.click('.fk[data-id=banjia]'); // 收起
  await page.click('.fk[data-id=banjia]'); // 重新展开
  const opts = page.locator('#fk-recommend .mopt');
  const labels = await opts.locator('.mname').allTextContents();
  const liuyaoIdx = labels.indexOf('六爻');
  ok(liuyaoIdx >= 0, '搬家推荐应含六爻可选:' + labels.join(','));
  await opts.nth(liuyaoIdx).click();
  ok(await page.locator('#sec-cast').isVisible(), '改选六爻后应切到六爻面板');
});

await t('性别年龄:选男26-30岁起卦,回报注明问卦人;持久化;可选不想透露', async () => {
  await page.click('.tabs button[data-m=liuyao]');
  await page.selectOption('#q-gender', '男');
  await page.selectOption('#q-age', '26-30');
  await page.fill('#question', '性别年龄口径内测一问');
  await page.check('input[name=ly-mode][value=coin]');
  await page.click('#btn-auto');
  await page.waitForFunction(() => document.getElementById('report').value.includes('问卦人:男,26-30岁'), null, { timeout: 9000 });
  ok((await page.inputValue('#report')).includes('问卦人:男,26-30岁'), '回报应注明性别与年龄段');
  await page.reload({ waitUntil: 'load' });
  ok((await page.inputValue('#q-gender')) === '男', '性别应持久化');
  ok((await page.inputValue('#q-age')) === '26-30', '年龄段应持久化');
  await page.selectOption('#q-age', 'secret');
  ok((await page.textContent('#qh-q')).includes('不愿透露'), '不想透露应入口径提示');
  await page.selectOption('#q-gender', '');
  await page.selectOption('#q-age', '');
});

await t('分占连断:月运选六爻,六卦连占(含验证卦)出合并回报与总览', async () => {
  await expandGroups();
  await page.click('.fk[data-id=yueyun]');
  const opts = page.locator('#fk-recommend .mopt');
  const labels = await opts.locator('.mname').allTextContents();
  const li = labels.indexOf('六爻');
  ok(li >= 0, '月运应含六爻可选:' + labels.join(','));
  await opts.nth(li).click();
  ok(!(await page.locator('#duo-offer').evaluate(el => el.classList.contains('hidden'))), '应出现分占连断提议');
  await page.click('#btn-duo-start');
  for (let i = 0; i < 6; i++) {
    await page.waitForFunction(n => document.getElementById('duo-status').textContent.includes(`${n}/6`), i + 1, { timeout: 9000 });
    await page.click('#btn-auto');
  }
  await page.waitForFunction(() => document.getElementById('duo-status').textContent.includes('完成'), null, { timeout: 24000 });
  const rep = await page.inputValue('#report');
  ok(rep.startsWith('【东玄六爻 · 分占连断回报】'), rep.split('\n')[0]);
  for (const k of ['总基调', '财运', '事业', '感情人缘', '健康家宅', '验证']) ok(rep.includes(k), '回报含分项 ' + k);
  ok((await page.locator('#headline').textContent()).includes('分占连断'), '解读区出总览');
  ok((await page.locator('#focus .fblock').count()) === 6, '总览六个分项块(含验证)');
  ok((await page.locator('#histlist .badge').allTextContents()).some(b => b.includes('分占')), '卦档含分占徽记');
  // 完成后防误掷:问题框清空;再掷需确认,取消则不掷
  ok((await page.inputValue('#question')) === '', '连断完成后问题框应清空');
  page.once('dialog', d => d.dismiss());
  await page.click('#btn-auto');
  await page.waitForTimeout(400);
  ok((await page.locator('#tosslog .toss').count()) === 0, '未确认时不应再掷');
  await page.click('.fk[data-id=yueyun]'); // 收起分科
});

await t('财富量级:六卦逐层锁定方案可入(位数→区间→构成→家产→年薪→验证)', async () => {
  await expandGroups();
  await page.click('.fk[data-id=cailiang]');
  const opts = page.locator('#fk-recommend .mopt');
  await opts.first().click(); // 首选六爻
  ok(!(await page.locator('#duo-offer').evaluate(el => el.classList.contains('hidden'))), '财富量级应提议分占');
  const title = await page.locator('#duo-title').textContent();
  for (const k of ['定位数', '定区间', '定构成', '家庭资产', '年薪收入', '验证']) ok(title.includes(k), '提议含分项 ' + k);
  await page.click('#btn-duo-start');
  await page.waitForFunction(() => document.getElementById('duo-status').textContent.includes('1/6'), null, { timeout: 5000 });
  ok((await page.inputValue('#question')).includes('几位数'), '第一卦问位数');
  await page.click('#btn-reset'); // 取消本次连占,收尾
  await page.click('.fk[data-id=cailiang]');
});

await t('分科日运首选小六壬、年运首选蓍草', async () => {
  await expandGroups();
  await page.click('.fk[data-id=riyun]');
  const ri = page.locator('#fk-recommend .mopt').first();
  ok((await ri.locator('.mname').textContent()) === '小六壬', '日运首选小六壬');
  await ri.click();
  ok(await page.locator('#sec-xlr').isVisible(), '切到小六壬');
  await page.click('.fk[data-id=nianyun]');
  ok((await page.locator('#fk-recommend .mopt').first().locator('.mmode').textContent()).includes('蓍草'), '年运首选蓍草');
  await page.click('.fk[data-id=nianyun]');
  ok((await page.locator('.fk.on').count()) === 0, '取消选科');
  ok(await page.locator('#fk-recommend').evaluate(el => el.classList.contains('hidden')), '推荐面板收起');
  await page.click('.tabs button[data-m=liuyao]');
});

await t('分科组折叠:默认收起,点组名展开/收起', async () => {
  await page.reload();
  ok(await page.locator('#sec-fenke .foldbody').first().evaluate(el => el.classList.contains('hidden')), '分科整区默认应折叠');
  await page.click('#sec-fenke .foldh');
  ok((await page.locator('#fenke-chips .fkgroup').count()) >= 14, '组框应在');
  ok(await page.locator('#fenke-chips .fkrow').first().evaluate(el => el.classList.contains('hidden')), '默认应收起');
  await page.locator('#fenke-chips .fkgh').first().click();
  ok(!(await page.locator('#fenke-chips .fkrow').first().evaluate(el => el.classList.contains('hidden'))), '点组名应展开');
  ok((await page.locator('#fenke-chips .fkgh .tri').first().textContent()) === '▾', '三角应转向');
  await page.locator('#fenke-chips .fkgh').first().click();
  ok(await page.locator('#fenke-chips .fkrow').first().evaluate(el => el.classList.contains('hidden')), '再点应收起');
});

await t('择日日运:挑将来某日,问题带上该日期', async () => {
  await expandGroups();
  await page.click('.fk[data-id=riyun]');
  ok(await page.locator('#fk-date').isVisible(), '日运应有日期选择');
  const t2 = new Date(Date.now() + 10 * 86400000);
  const iso = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`;
  await page.fill('#fk-date', iso);
  await page.locator('#fk-recommend .mopt').first().click();
  const q = await page.inputValue('#question');
  ok(q.includes(`${t2.getMonth() + 1}月${t2.getDate()}日`), '问题应含所择日期:' + q);
  await page.click('.fk[data-id=riyun]');
});

await t('月运详占:提供九卦交叉印证入口;年运详占十卦', async () => {
  await expandGroups();
  await page.click('.fk[data-id=yueyun]');
  const labels = await page.locator('#fk-recommend .mopt .mname').allTextContents();
  await page.locator('#fk-recommend .mopt').nth(labels.indexOf('六爻')).click();
  ok(!(await page.locator('#btn-duo-start2').evaluate(el => el.classList.contains('hidden'))), '应有详占按钮');
  ok((await page.textContent('#btn-duo-start2')).includes('9'), '月运详占应为九卦');
  await page.click('#btn-duo-start2');
  await page.waitForFunction(() => document.getElementById('duo-status').textContent.includes('1/9'), null, { timeout: 5000 });
  ok((await page.inputValue('#question')).includes('主调'), '详占第一卦为总基调');
  await page.click('#btn-reset');
  await expandGroups();
  await page.click('.fk[data-id=nianyun]');
  const labels2 = await page.locator('#fk-recommend .mopt .mname').allTextContents();
  await page.locator('#fk-recommend .mopt').nth(labels2.indexOf('六爻')).click();
  ok((await page.textContent('#btn-duo-start2')).includes('10'), '年运详占应为十卦');
  await page.click('.fk[data-id=nianyun]');
  await page.click('#btn-reset');
});

await t('以卦追问:按钮在,未深断时给提示', async () => {
  await page.click('.tabs button[data-m=liuyao]');
  await page.fill('#question', '以卦追问内测');
  await page.click('#btn-auto');
  await page.waitForFunction(() => document.querySelectorAll('#tosslog .toss').length === 6, null, { timeout: 9000 });
  await page.evaluate(() => document.getElementById('ai-followup').classList.remove('hidden'));
  await page.fill('#fu-input', '这卦之外我还想问一件新事');
  await page.click('#btn-followup-gua');
  ok((await page.textContent('#ai-status')).includes('深断'), '未深断先以卦追问应提示:' + (await page.textContent('#ai-status')));
  await page.fill('#fu-input', '');
  await page.evaluate(() => document.getElementById('ai-followup').classList.add('hidden'));
});

await t('大问拆阵:现成人生轨迹阵可摆、逐卦可起、板块可折叠', async () => {
  await page.evaluate(() => dxOpenBoard('sec-dawen'));
  await expandGroups();
  await page.click('#btn-dw-example');
  ok((await page.locator('#dw-plan .dwgroup').count()) >= 5, '应有五个以上板块');
  ok((await page.locator('#dw-plan .dw-cast').count()) >= 8, '应有八个以上起卦位');
  ok((await page.inputValue('#dw-q')).includes('大方向'), '大问框应填入示例问');
  // 起两卦
  await page.locator('#dw-plan .dw-cast').first().click();
  ok((await page.locator('#dw-plan .res').count()) === 1, '第一卦应显示✓摘要');
  await page.locator('#dw-plan .dw-cast').first().click();
  ok((await page.locator('#dw-plan .res').count()) === 2, '第二卦应显示✓摘要');
  ok((await page.textContent('#dw-status')).includes('2/'), '进度应更新');
  ok(!(await page.locator('#dw-actions').evaluate(el => el.classList.contains('hidden'))), '汇总深断入口应出现');
  // 折叠板块
  await page.locator('#dw-plan .dwgh').first().click();
  ok(await page.locator('#dw-plan .dwbody').first().evaluate(el => el.classList.contains('hidden')), '板块应可折叠');
  await page.locator('#dw-plan .dwgh').first().click();
  // 整阵收起/展开
  await page.click('#btn-dw-toggle');
  ok(await page.locator('#dw-plan .dwbody').evaluateAll(els => els.every(el => el.classList.contains('hidden'))), '整阵应全部收起');
  ok((await page.textContent('#btn-dw-toggle')).includes('展开整阵'), '按钮应变为展开');
  await page.click('#btn-dw-toggle');
  ok(await page.locator('#dw-plan .dwbody').evaluateAll(els => els.every(el => !el.classList.contains('hidden'))), '整阵应全部展开');
  // 无 Key 汇总深断 → 提示
  await page.click('#btn-dw-read');
  ok((await page.textContent('#dw-status')).includes('API Key'), '无Key应提示:' + (await page.textContent('#dw-status')));
  // AI 拆阵无 Key → 提示
  await page.fill('#dw-q', '我的人生轨迹是什么样的?');
  await page.click('#btn-dw-plan');
  ok((await page.textContent('#dw-status')).includes('API Key'), '拆阵无Key应提示');
  // 清空
  await page.click('#btn-dw-clear');
  ok((await page.locator('#dw-plan .dwgroup').count()) === 0, '清空后阵应无');
});

await t('核心运势选时段:近一月/指定某年,问题自动重组', async () => {
  await page.evaluate(() => dxShowView('ask'));
  await expandGroups();
  await page.click('.fk[data-id=yunshi_core]');
  ok(await page.locator('#fk-range').isVisible(), '应有时段选择');
  await page.selectOption('#fk-range', '近一个月');
  await page.locator('#fk-recommend .mopt').first().click();
  ok((await page.inputValue('#question')).includes('近一个月'), '问题应带时段:' + (await page.inputValue('#question')));
  await expandGroups();
  await page.click('.fk[data-id=yunshi_core]');
  await page.click('.fk[data-id=yunshi_core]');
  ok(await page.locator('#fk-year').evaluate(el => el.classList.contains('hidden')), '年份框默认隐藏');
  await page.selectOption('#fk-range', 'year');
  ok(!(await page.locator('#fk-year').evaluate(el => el.classList.contains('hidden'))), '选指定某年应现年份框');
  await page.fill('#fk-year', '2028');
  await page.locator('#fk-recommend .mopt').first().click();
  ok((await page.inputValue('#question')).includes('2028年运势'), '问题应带年份:' + (await page.inputValue('#question')));
  // 六卦分路连断:时段短语代入每一卦
  ok(!(await page.locator('#duo-offer').evaluate(el => el.classList.contains('hidden'))), '核心运势应提议分占');
  await page.click('#btn-duo-start');
  await page.waitForFunction(() => document.getElementById('duo-status').textContent.includes('1/6'), null, { timeout: 5000 });
  ok((await page.inputValue('#question')).includes('2028年') && (await page.inputValue('#question')).includes('主调'), '第一卦应带时段:' + (await page.inputValue('#question')));
  await page.click('#btn-reset');
  await expandGroups();
  await page.click('.fk[data-id=yunshi_core]');
});

await t('为谁问:问题旁单独填性别年龄(替人问),盖过顶栏默认', async () => {
  await page.click('.tabs button[data-m=liuyao]');
  ok((await page.textContent('#qh-q')).includes('未填'), '空缺时应有提醒');
  await page.selectOption('#qg-q', '女');
  await page.selectOption('#qa-q', '36-40');
  ok((await page.textContent('#qh-q')).includes('女,36-40岁'), '提示应显示当前口径');
  await page.fill('#question', '替人问卦内测');
  await page.click('#btn-auto');
  await page.waitForFunction(() => document.getElementById('report').value.includes('问卦人:女,36-40岁'), null, { timeout: 9000 });
  await page.selectOption('#qg-q', '');
  await page.selectOption('#qa-q', '');
  ok((await page.locator('#qh-dw').count()) === 1 && (await page.locator('#qh-zy').count()) === 1, '拆阵与转运也应有为谁问');
});

await t('转运板块:可选时段、六卦阵可摆、诊断开方分组、逐卦可起、无Key开方给提示', async () => {
  await page.evaluate(() => dxOpenBoard('sec-zhuanyun'));
  await expandGroups();
  ok(await page.locator('#zy-range').isVisible(), '转运应有时段选择');
  await page.selectOption('#zy-range', '近一个月');
  await page.click('#btn-zy-start');
  ok((await page.locator('#zy-plan .q').first().textContent()).includes('近一个月'), '卦问应带时段:' + (await page.locator('#zy-plan .q').first().textContent()));
  ok((await page.textContent('#zy-status')).includes('近一个月'), '状态应注明时段');
  ok((await page.locator('#zy-plan .dwgroup').count()) === 2, '应有诊断/开方两组');
  ok((await page.locator('#zy-plan .zy-cast').count()) === 6, '应有六个起卦位');
  const badges = await page.locator('#zy-plan .m').allTextContents();
  ok(badges.filter(b => b === '六爻').length === 5 && badges.includes('奇门'), '五六爻一奇门:' + badges.join(','));
  await page.locator('#zy-plan .zy-cast').first().click();
  ok((await page.locator('#zy-plan .res').count()) === 1, '第一卦应✓');
  await page.locator('#zy-plan .zy-cast').first().click();
  ok((await page.locator('#zy-plan .res').count()) === 2, '第二卦应✓');
  ok(!(await page.locator('#zy-actions').evaluate(el => el.classList.contains('hidden'))), '开方入口应出现');
  await page.click('#btn-zy-read');
  ok((await page.textContent('#zy-status')).includes('API Key'), '无Key应提示:' + (await page.textContent('#zy-status')));
  // 板块折叠
  await page.locator('#zy-plan .dwgh').first().click();
  ok(await page.locator('#zy-plan .dwbody').first().evaluate(el => el.classList.contains('hidden')), '诊断组应可折叠');
  await page.click('#btn-zy-clear');
  ok((await page.locator('#zy-plan .dwgroup').count()) === 0, '清空后应无阵');
});

await t('卦档法门徽记与蓍草起卦', async () => {
  const badges = await page.locator('#histlist .badge').allTextContents();
  ok(badges.includes('梅花') && badges.includes('小六壬'), '徽记:' + badges.join(','));
  // 蓍草大衍法起一卦
  await page.evaluate(() => dxShowView('ask'));
  await page.click('.tabs button[data-m=liuyao]');
  await page.check('input[name=ly-mode][value=dayan]');
  await page.click('#btn-auto');
  await page.waitForSelector('#sec-read:not(.hidden)', { timeout: 8000 });
  const rep = await page.inputValue('#report');
  ok(rep.includes('蓍草大衍'), '回报应注明蓍草法');
  const badges2 = await page.locator('#histlist .badge').allTextContents();
  ok(badges2.includes('六爻·蓍草'), '蓍草徽记:' + badges2.join(','));
});

await t('吉日历:月历渲染、点日细账、生日个人化、按事挑日、转起卦', async () => {
  await page.evaluate(() => dxShowView('jiri'));
  await page.waitForSelector('.jr-cell', { timeout: 8000 });
  const cells = await page.locator('.jr-cell').count();
  ok(cells >= 28 && cells <= 31, `月历格数=${cells}`);
  const now = new Date();
  ok((await page.textContent('#jr-title')).includes(`${now.getFullYear()}年`), '标题应为当前年月');
  ok((await page.locator('.jr-cell.today').count()) === 1, '今天应有标记');
  // 点开今天的细账
  await page.locator('.jr-cell.today').click();
  const det = await page.textContent('#jr-detail');
  ok(det.includes('建除') && det.includes('值神') && det.includes('冲') && det.includes('综合'), '细账四要素:' + det.slice(0, 60));
  ok(det.includes('填了生日'), '未填生日应提示');
  // 填生日 → 个人化生效并持久
  await page.fill('#jr-birth', '1990-06-15');
  await page.dispatchEvent('#jr-birth', 'change');
  const det2 = await page.textContent('#jr-detail');
  ok(det2.includes('属马') && det2.includes('日主'), '个人层应现生肖与日主:' + det2.slice(-120));
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_birth'))) === '1990-06-15', '生日应持久化');
  // 日/月/年运三卡 + 时辰吉凶
  const yun = await page.textContent('#jr-yun');
  ok(yun.includes('日运') && yun.includes('月运') && yun.includes('年运'), '三卡应齐:' + yun.slice(0, 50));
  ok(yun.includes('吉时') && yun.includes('点'), '日运应含时辰钟点');
  // 点另一天 → 日运跟着换
  const other = await page.locator('.jr-cell:not(.today)').nth(5).getAttribute('data-iso');
  await page.locator(`.jr-cell[data-iso="${other}"]`).click();
  const yun2 = await page.textContent('#jr-yun');
  const d2 = Number(other.split('-')[2]);
  ok(yun2.includes(`月${d2}日`), '日运应换到所点之日:' + yun2.slice(0, 40));
  // 翻月
  await page.click('#jr-next');
  ok(!(await page.textContent('#jr-title')).includes(`${now.getFullYear()}年${now.getMonth() + 1}月`), '翻月后标题应变');
  await page.click('#jr-today');
  // 按事挑日
  await page.selectOption('#jr-event', 'kaiye');
  await page.click('#jr-pickbtn');
  const rows = await page.locator('.jp-row').count();
  ok(rows >= 1 && rows <= 5, `挑日行数=${rows}`);
  ok((await page.textContent('#jr-picked')).includes('复核'), '应提示起卦复核');
  // 点推荐行 → 细账 → 转起卦
  await page.locator('.jp-row').first().click();
  await page.waitForSelector('#jr-cast', { timeout: 5000 });
  await page.click('#jr-cast');
  const q = await page.inputValue('#question');
  ok(/\d{4}年\d{1,2}月\d{1,2}日/.test(q) || q.includes('今天'), '问题应带日期:' + q);
  ok((await page.textContent('#fk-why')).includes('日运'), '应已选定日运分科');
});

await t('日间/夜间主题切换与记忆', async () => {
  ok((await page.evaluate(() => document.documentElement.dataset.theme || 'light')) === 'light', '默认应为日间');
  await page.click('#btn-theme');
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', '点一下应变夜间');
  ok((await page.textContent('#btn-theme')).includes('日间'), '按钮文案应变「日间」');
  ok((await page.evaluate(() => document.querySelector('meta[name=theme-color]').content)) === '#141414', 'meta 主题色应跟随');
  await page.reload();
  await page.waitForSelector('#btn-theme');
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', '刷新后应记住夜间');
  await page.click('#btn-theme');
  ok((await page.evaluate(() => document.documentElement.dataset.theme || 'light')) === 'light', '再点应回日间');
});

await t('心愿板块:旺你牌、吉日窗、六卦阵、无Key深断给提示', async () => {
  await page.evaluate(() => dxOpenBoard('sec-xinyuan'));
  // 上一批用例已把生日 1990-06-15 存入本机,重载后应自动带出 → 旺你牌直接在
  ok((await page.inputValue('#xy-birth')) === '1990-06-15', '生日应从吉日历共用带出');
  const bazi = await page.textContent('#xy-bazi');
  ok(bazi.includes('日主') && bazi.includes('旺你的五行') && bazi.includes('贵人属相'), '旺你牌:' + bazi.slice(0, 50));
  // 点现成心愿条 → 吉日窗
  await page.locator('#xy-chips .fq').first().click();
  ok((await page.inputValue('#xy-wish')) === '谈恋爱', '心愿应填入');
  const days = await page.textContent('#xy-days');
  ok(days.includes('吉日窗') || days.includes('挑不出'), '吉日窗应有结果:' + days.slice(0, 40));
  // 摆阵:六卦(五六爻一奇门)
  await page.click('#btn-xy-start');
  ok((await page.locator('#xy-plan .xy-cast').count()) === 6, '应有六个起卦位');
  const badges = await page.locator('#xy-plan .m').allTextContents();
  ok(badges.filter(b => b === '六爻').length === 5 && badges.includes('奇门'), '五六爻一奇门:' + badges.join(','));
  ok((await page.locator('#xy-plan .q').first().textContent()).includes('谈恋爱'), '卦问应带心愿');
  // 起两卦
  await page.locator('#xy-plan .xy-cast').first().click();
  ok((await page.locator('#xy-plan .res').count()) === 1, '第一卦应✓');
  await page.locator('#xy-plan .xy-cast').first().click();
  ok((await page.locator('#xy-plan .res').count()) === 2, '第二卦应✓');
  // 无 Key 深断给提示
  ok(!(await page.locator('#xy-actions').evaluate(el => el.classList.contains('hidden'))), '深断入口应出现');
  await page.click('#btn-xy-read');
  ok((await page.textContent('#xy-status')).includes('API Key'), '无Key应提示:' + (await page.textContent('#xy-status')));
  await page.click('#btn-xy-clear');
  ok((await page.locator('#xy-plan .dwgroup').count()) === 0, '清空后应无阵');
});

await t('未来镜:三卦成景、现成条零输入、无Key成文给提示、追问双轨在位', async () => {
  await page.evaluate(() => dxOpenBoard('sec-wj'));
  // 现成条一点即填,不用自己写提示词
  await page.locator('#wj-chips .fq').first().click();
  ok((await page.inputValue('#wj-q')).includes('一年后'), '现成条应填入想看');
  await page.fill('#wj-q', '一年后我的日子是什么样');
  await page.selectOption('#wj-pov', '第三人称');
  await page.click('#btn-wj-start');
  ok((await page.locator('#wj-plan .wj-cast').count()) === 3, '应有三个起卦位');
  const badges = await page.locator('#wj-plan .m').allTextContents();
  ok(badges.join(',') === '六爻,梅花,小六壬', '三法各司其职:' + badges.join(','));
  ok((await page.locator('#wj-plan .q').first().textContent()).includes('一年后我的日子'), '卦问应带所看');
  // 起满三卦
  for (let i = 0; i < 3; i++) await page.locator('#wj-plan .wj-cast').first().click();
  ok((await page.locator('#wj-plan .res').count()) === 3, '三卦应✓');
  ok(!(await page.locator('#wj-actions').evaluate(el => el.classList.contains('hidden'))), '成文入口应出现');
  await page.click('#btn-wj-read');
  ok((await page.textContent('#wj-status')).includes('API Key'), '无Key应提示:' + (await page.textContent('#wj-status')));
  // 追问双轨按钮存在(未成文时点击给提示)
  await page.evaluate(() => document.querySelector('#wj-followup').classList.remove('hidden'));
  await page.click('#btn-wj-fugua');
  ok((await page.textContent('#wj-status')).includes('先解卦成文'), '未成文追卦应拦:' + (await page.textContent('#wj-status')));
  await page.click('#btn-wj-clear');
  ok((await page.locator('#wj-plan .dwgroup').count()) === 0, '清空后应无阵');
});

await t('姻缘板块:正缘八卦阵、断人六卦阵、无Key深断给提示', async () => {
  await page.evaluate(() => dxOpenBoard('sec-yinyuan'));
  // 性别记忆联动:设主页问卦人性别 → 板内提示应显示口径;板内可单独盖过
  await page.evaluate(() => { const g = document.getElementById('q-gender'); g.value = '女'; g.dispatchEvent(new Event('change')); });
  ok((await page.textContent('#qh-yl')).includes('女'), '板内应显示主页性别记忆:' + (await page.textContent('#qh-yl')));
  await page.selectOption('#qg-yl', '男');
  ok((await page.textContent('#qh-yl')).includes('男'), '板内改选应盖过主页');
  await page.selectOption('#qg-yl', '');
  // 正缘阵:8卦,含一奇门
  await page.click('#btn-yl-zl');
  ok((await page.textContent('#yl-status')).includes('按「女'), '摆阵状态应报所用口径:' + (await page.textContent('#yl-status')).slice(0, 40));
  ok((await page.locator('#yl-plan .yl-cast').count()) === 8, '正缘阵应8卦');
  const badges = await page.locator('#yl-plan .m').allTextContents();
  ok(badges.filter(b => b === '六爻').length === 7 && badges.includes('奇门'), '七六爻一奇门:' + badges.join(','));
  const qs = await page.locator('#yl-plan .q').allTextContents();
  ok(qs.some(q => q.includes('身高与身材')) && qs.some(q => q.includes('财富量级')) && qs.some(q => q.includes('是否异地')), '八问应含身高/财富/异地专卦:' + qs.join('|').slice(0, 80));
  // 起两卦 → 深断入口
  await page.locator('#yl-plan .yl-cast').first().click();
  await page.locator('#yl-plan .yl-cast').first().click();
  ok((await page.locator('#yl-plan .res').count()) === 2, '两卦应✓');
  ok(!(await page.locator('#yl-actions').evaluate(el => el.classList.contains('hidden'))), '深断入口应出现');
  await page.click('#btn-yl-read');
  ok((await page.textContent('#yl-status')).includes('API Key'), '无Key应提示');
  // 断人阵:必填人,6卦,问题带人
  await page.click('#btn-yl-dr');
  ok((await page.textContent('#yl-status')).includes('一两句'), '空信息应拦');
  await page.fill('#yl-p', '同事,男,大我3岁');
  await page.click('#btn-yl-dr');
  ok((await page.locator('#yl-plan .yl-cast').count()) === 6, '断人阵应6卦');
  ok((await page.locator('#yl-plan .q').first().textContent()).includes('同事,男'), '卦问应带此人');
  await page.locator('#yl-plan .yl-cast').first().click();
  ok((await page.locator('#yl-plan .res').count()) === 1, '断人第一卦应✓');
  await page.click('#btn-yl-clear');
  ok((await page.locator('#yl-plan .dwgroup').count()) === 0, '清空后应无阵');
});

await t('地利板块:挑旺地与验地实算方位、转起卦复核', async () => {
  await page.evaluate(() => dxOpenBoard('sec-dili'));
  await page.fill('#dl-birth', '1990-06-15');
  await page.selectOption('#dl-hour', '5');
  await page.fill('#dl-from', '北京');
  await page.click('#btn-dl-rec');
  const out = await page.textContent('#dl-out');
  ok(out.includes('旺你') && out.includes('地气') && out.includes('方向'), '挑旺地应有喜忌与去处:' + out.slice(0, 60));
  await page.fill('#dl-to', '广州');
  await page.click('#btn-dl-judge');
  const out2 = await page.textContent('#dl-out');
  ok(out2.includes('正南') && out2.includes('公里') && /「(大旺|旺|平|偏背|背)」/.test(out2), '验地应给方位与判语:' + out2.slice(0, 80));
  await page.click('#btn-dl-cast');
  ok((await page.inputValue('#question')).includes('广州'), '复核问应带地名');
  await page.evaluate(() => dxOpenBoard('sec-dili'));
  await page.fill('#dl-to', '亚特兰蒂斯');
  await page.click('#btn-dl-judge');
  ok((await page.textContent('#dl-status')).includes('不认识'), '胡写地名应拦');
});

// 缘起:用户 2026-08-01 说地利「不够专业不够深刻…后面那些大城市做太少了…这个类目就是太浅了」。
// 实测查出三处硬伤(docs/地利体检-01),这条 e2e 把修好的样子钉在界面上——
// 光引擎对了不算数,得用户在页面上真看得见。
// 缘起:CLAUDE.md 第五节把「程序算死,AI 只解释」定为核心哲学,可这五个卦阵板块
// 摆完卦只有一句卦名摘要,断语全靠 AI——没 API Key 的用户只看得到卦象。v0.71 全部接上。
// 这条盯着:五个板块每一卦都得有程序初断,且**无 Key 也看得见**。
await t('五个卦阵板块都接上程序初断,无 Key 也有结论', async () => {
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1990-06-15'); localStorage.setItem('dongxuan_birth_hour', '5'); });
  await page.reload(); await page.waitForTimeout(300);
  const BAN = ['用神', '世应', '旬空', '月破', '官鬼', '妻财', '子孙', '兄弟', '体卦', '当令', '旺相休囚', '纳甲'];
  const check = async (sel, name) => {
    const n = await page.locator(`${sel} .cdrow`).count();
    ok(n >= 1, `${name}:起了卦却没有程序初断`);
    const txt = (await page.locator(`${sel} .cdrow`).allTextContents()).join(' ');
    ok(/程序初断/.test(txt), `${name}:初断没标出处`);
    for (const w of BAN) ok(!txt.includes(w), `${name} 的初断里出现术语「${w}」:${txt.slice(0, 140)}`);
    ok(txt.replace(/\s/g, '').length > 25, `${name}:初断内容太薄`);
    return txt;
  };
  // 转运(零输入摆阵)
  await page.evaluate(() => dxOpenBoard('sec-zhuanyun'));
  await page.click('#btn-zy-start');
  await page.locator('#zy-plan .zy-cast').first().click();
  await check('#zy-plan', '转运');
  // 心愿
  await page.evaluate(() => dxOpenBoard('sec-xinyuan'));
  await page.locator('#xy-chips .fq').first().click();
  await page.click('#btn-xy-start');
  await page.locator('#xy-plan .xy-cast').first().click();
  const xy = await check('#xy-plan', '心愿');
  ok(/把握/.test(xy), '心愿(六爻)应给出把握度:' + xy.slice(0, 100));
  // 姻缘
  await page.evaluate(() => dxOpenBoard('sec-yinyuan'));
  await page.click('#btn-yl-zl');
  await page.locator('#yl-plan .yl-cast').first().click();
  await check('#yl-plan', '姻缘');
  // 大问(用现成阵,不需要 Key)
  await page.evaluate(() => dxOpenBoard('sec-dawen'));
  await page.click('#btn-dw-example');
  await page.locator('#dw-plan .dw-cast').first().click();
  await check('#dw-plan', '大问');
  // 未来镜:三卦三法,每一卦都得有,且主线卦给的是「基调」不是「成算」
  await page.evaluate(() => dxOpenBoard('sec-wj'));
  await page.fill('#wj-q', '一年后我的日子是什么样');
  await page.click('#btn-wj-start');
  for (let i = 0; i < 3; i++) await page.locator('#wj-plan .wj-cast').first().click();
  const rows = await page.locator('#wj-plan .cdrow').allTextContents();
  ok(rows.length === 3, `未来镜三卦应各有初断,实得 ${rows.length} 条`);
  for (const w of BAN) ok(!rows.join(' ').includes(w), '未来镜初断里有术语「' + w + '」');
  // 「一年后我的日子是什么样」不是个成不成的问题,不许硬安一个「成/几成」
  ok(/基调/.test(rows[0]), '未来镜主线卦应给基调而非成算:' + rows[0].slice(0, 90));
  ok(!/把握\s*[一二三四五六七八九]/.test(rows[0]), '未来镜主线卦不该出现把握度:' + rows[0].slice(0, 90));
  // 三法各有各的判语来源
  ok(/梅花体用/.test(rows[1]), '第二卦应是梅花的体用断:' + rows[1].slice(0, 60));
  ok(/小六壬/.test(rows[2]), '第三卦应是小六壬三宫:' + rows[2].slice(0, 60));
  // 清空之后初断跟着没
  await page.click('#btn-wj-clear');
  ok((await page.locator('#wj-plan .cdrow').count()) === 0, '清空后初断应一并清掉');
});

// ══════════ v0.70 大改版:四个新功能 ══════════
// 缘起:用户 2026-08-01「各个部分都不够看…我需要的是一次大变革…更多好用的功能」。
// 四个功能都做成「无 API Key 也有结论」,断语一律由程序算(Chuduan / Dili / Jiri),
// 这几条 e2e 就盯着这一点——AI 没接也得有答案。
await t('速答:一句话直接出结论、把握度与时间窗(无 Key 也有)', async () => {
  await page.evaluate(() => dxShowView('ask'));
  await page.fill('#qk-q', '我今年能不能换成工作?');
  await page.click('#btn-qk');
  const out = await page.textContent('#qk-out');
  ok(/成|悬|不成/.test(out), '缺结论:' + out.slice(0, 80));
  ok(/把握/.test(out), '缺把握度');
  ok(/见分晓/.test(out), '缺时间窗');
  // 铁律八:成稿里不许出现术语
  for (const w of ['用神', '世应', '旬空', '月破', '官鬼', '妻财', '子孙']) {
    ok(!out.includes(w), '速答稿里出现术语「' + w + '」:' + out.slice(0, 120));
  }
  // 分数是自拟的,必须自陈
  ok(/本项目定的/.test(out), '缺「分数是我自己排的」这句交代');
  // 空着问要拦
  await page.fill('#qk-q', '');
  await page.click('#btn-qk');
  ok(/先写一句话/.test(await page.textContent('#qk-hint')), '空问应拦');
});
await t('今日一览:进门就有,填了生日多两层', async () => {
  await page.evaluate(() => { localStorage.removeItem('dongxuan_birth'); });
  await page.reload(); await page.waitForTimeout(400);
  const bare = await page.textContent('#sec-today');
  ok(/今日/.test(bare) && /冲什么属相/.test(bare), '没填生日也该有黄历那层:' + bare.slice(0, 80));
  ok(/\[object Object\]/.test(bare) === false, '出现了 [object Object]——对象当字符串拼了');
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1990-06-15'); localStorage.setItem('dongxuan_birth_hour', '5'); });
  await page.reload(); await page.waitForTimeout(400);
  const full = await page.textContent('#sec-today');
  ok(/今天对你/.test(full), '填了生日应多出「今天对你」:' + full.slice(0, 100));
  ok(/今天值得做/.test(full) && /今天别做/.test(full), '应给出宜忌');
});
await t('命盘常驻侧栏:填过生辰才出现,内容随生辰变', async () => {
  await page.evaluate(() => { localStorage.removeItem('dongxuan_birth'); });
  await page.reload(); await page.waitForTimeout(400);
  ok(!(await page.isVisible('#sidepan')), '没填生辰不该显示侧栏');
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1990-06-15'); localStorage.setItem('dongxuan_birth_hour', '5'); });
  await page.reload(); await page.waitForTimeout(400);
  ok(await page.isVisible('#sidepan'), '填了生辰应显示侧栏');
  const a = await page.textContent('#sp-body');
  for (const k of ['四柱', '帮你的', '耗你的']) ok(a.includes(k), '侧栏缺「' + k + '」:' + a.slice(0, 100));
  // 换个生辰,侧栏得跟着变(不变就说明它是死的)
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1985-11-03'); });
  await page.reload(); await page.waitForTimeout(400);
  ok((await page.textContent('#sp-body')) !== a, '换生辰侧栏一字未变——它没接上排盘');
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1990-06-15'); });
  await page.reload(); await page.waitForTimeout(400);
});
await t('A 还是 B:三种比法都出结论,差得少时照实说「差不多」', async () => {
  await page.evaluate(() => dxOpenBoard('sec-vs'));
  await page.fill('#vs-from', '武汉'); await page.fill('#vs-a', '杭州'); await page.fill('#vs-b', '成都');
  await page.click('#btn-vs');
  let out = await page.textContent('#vs-out');
  ok(/选「|两个差不多/.test(out), '比地方没给结论:' + out.slice(0, 100));
  ok(/方位/.test(out) && /地气/.test(out), '比地方应摊出各层');
  // 同一个地方比它自己,必然打平——这时不许硬分高下
  await page.fill('#vs-a', '成都'); await page.fill('#vs-b', '成都');
  await page.click('#btn-vs');
  out = await page.textContent('#vs-out');
  ok(/两个差不多/.test(out), '两个一样的候选应判「差不多」,不许硬选:' + out.slice(0, 120));
  // 比日子
  await page.selectOption('#vs-kind', 'day');
  await page.fill('#vs-a', '2026-09-12'); await page.fill('#vs-b', '2026-09-18');
  await page.click('#btn-vs');
  out = await page.textContent('#vs-out');
  ok(/这天本身/.test(out) && /冲不冲你/.test(out), '比日子应摊出各层:' + out.slice(0, 100));
  ok(!/\[object Object\]/.test(out), '出现了 [object Object]');
  // 比两条路
  await page.selectOption('#vs-kind', 'road');
  await page.fill('#vs-a', '留在现在的公司'); await page.fill('#vs-b', '跳去那家新的');
  await page.click('#btn-vs');
  out = await page.textContent('#vs-out');
  ok(/成算/.test(out) && /一枝一卦/.test(out), '比两条路应各起一卦并声明一枝一卦:' + out.slice(0, 120));
  // 只填一个要拦
  await page.fill('#vs-b', '');
  await page.click('#btn-vs');
  ok(/都要填/.test(await page.textContent('#vs-status')), '缺一个候选应拦');
});
await t('改版:宽屏两栏、朱砂只给主行动、一屏一个主按钮', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => dxShowView('ask'));
  await page.waitForTimeout(200);
  // 宽屏下侧栏应在主内容右侧(而不是上下堆着)
  const box = await page.evaluate(() => {
    const s = document.getElementById('sidepan').getBoundingClientRect();
    const m = document.querySelector('.maincol').getBoundingClientRect();
    return { sx: s.x, mx: m.x, sw: s.width, mw: m.width };
  });
  ok(box.sx > box.mx + box.mw - 5, `宽屏侧栏没排到右边:主列 x=${box.mx} 宽=${box.mw},侧栏 x=${box.sx}`);
  // 「一屏一个主行动」的准确说法是:**同一个视口里不许同时看见两个朱砂实心按钮**。
  // 头一版写成「整页只许有一个」,可这是一条长滚动页,速答、起卦、择日各是一桩独立的事,
  // 每桩留一个主按钮是对的;真正要防的是两个红按钮同时映入眼帘,让人不知道该点哪个。
  // 所以改成按视口窗口滚动检查。
  const worst = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button.primary')].filter(b => b.offsetParent !== null);
    const rects = btns.map(b => { const r = b.getBoundingClientRect();
      return { top: r.top + window.scrollY, bot: r.bottom + window.scrollY, txt: b.textContent.trim() }; });
    const H = window.innerHeight;
    let max = 0, pair = [];
    for (const a of rects) {
      const inWin = rects.filter(x => x.top < a.top + H && x.bot > a.top);
      if (inWin.length > max) { max = inWin.length; pair = inWin.map(x => x.txt); }
    }
    return { max, pair };
  });
  ok(worst.max <= 1, `同一屏里同时看得见 ${worst.max} 个朱砂主按钮:${worst.pair.join(' / ')}`);
  await page.setViewportSize({ width: 900, height: 900 });
});

await t('地利 v0.68:七层俱在界面上、大城市榜真有大城市、时辰入了口', async () => {
  await page.evaluate(() => dxOpenBoard('sec-dili'));
  await page.fill('#dl-birth', '1990-06-15');
  await page.selectOption('#dl-hour', '5');
  await page.fill('#dl-from', '武汉');
  await page.click('#btn-dl-rec');
  const rec = await page.textContent('#dl-out');
  // 硬伤二:榜单标题写「大城市」就得真是大城市,不能又是黄石咸宁
  ok(rec.includes('这里头的大城市'), '缺大城市榜:' + rec.slice(0, 80));
  ok(/上海|北京|天津|广州|杭州|苏州|深圳|重庆/.test(rec), '大城市榜里一个大城市都没有');
  ok(rec.includes('按省看'), '缺省域视图');
  ok(rec.includes('哪几年适合动'), '缺「时」这一层');
  ok(rec.includes('去了做哪一路的活'), '缺「业」这一层');
  // 神煞降为旁注这件事必须当面说,且要点两本书的名
  ok(rec.includes('增删卜易') && rec.includes('滴天髓'), '神煞的分歧没摆出来');
  // 验地:七层逐条露面
  await page.fill('#dl-to', '哈尔滨');
  await page.click('#btn-dl-judge');
  const j = await page.textContent('#dl-out');
  for (const k of ['一、向', '二、气', '三、候', '五、时', '六、业', '七、程']) ok(j.includes(k), '验地缺' + k + ':' + j.slice(0, 120));
  ok(/合分/.test(j), '缺合分');
  // 时辰真的进了排盘:换个时辰,结论该跟着变(不变就说明这个输入是摆设)。
  // 用 1990-01-01 这一天——实测它十二个时辰能扫出四种喜忌(子时喜火木、寅时喜金、午时喜土金水),
  // 换个日子可能十二个时辰喜忌全同,那时结论不变是对的,拿它当反例会冤枉代码。
  await page.fill('#dl-birth', '1990-01-01');
  const grab = async () => (await page.textContent('#dl-out')).slice(0, 400);
  await page.selectOption('#dl-hour', '0');
  await page.click('#btn-dl-rec');
  const h0 = await grab();
  await page.selectOption('#dl-hour', '6');
  await page.click('#btn-dl-rec');
  const h6 = await grab();
  ok(h0 !== h6, '换时辰结论一字未变——时辰这个输入没接进排盘');
  ok(/旺你[^;]*火/.test(h0) && /旺你[^;]*土/.test(h6), `喜忌该随时辰翻过来:子时[${h0.slice(0, 70)}] 午时[${h6.slice(0, 70)}]`);
  // 不填时辰要当面说清是估的
  await page.selectOption('#dl-hour', '');
  await page.click('#btn-dl-rec');
  ok((await page.textContent('#dl-out')).includes('时辰没填'), '时辰空着必须明说是按中午估的');
});

await t('问机板块:一句话给出年/月/日三层应期,并带画像与贵人', async () => {
  await page.evaluate(() => window.dxOpenBoard('sec-wenji'));
  await page.fill('#wq-birth', '1996-08-12');
  await page.selectOption('#wq-hour', '10');
  await page.selectOption('#wq-gender', '女');
  await page.click('.chip[data-q="我什么时候能谈恋爱"]');
  await page.waitForTimeout(2500);
  const txt = await page.locator('#wq-out').innerText();
  ok(/最近的窗口是\s*\d{4}年/.test(txt), '开口第一句要把年份说死:' + txt.slice(0, 80));
  ok((await page.locator('#wq-out .wjyear').count()) >= 1, '应列出窗口年份');
  ok((await page.locator('#wq-out .wjmon').count()) >= 1, '应列出应期月份');
  ok((await page.locator('#wq-out .wjday').count()) >= 1, '应列出具体日子');
  ok(txt.includes('贵 人 从 哪 来'), '应有贵人卡');
  ok(!/机遇与挑战并存|顺其自然/.test(txt), '不许出现空话');
  ok(await page.locator('#btn-wq-cast').isVisible(), '起卦复核按钮应出现');
  await page.click('#btn-wq-cast');
  await page.waitForTimeout(400);
  ok((await page.inputValue('#question')).includes('复核'), '应把时间带进问句去复核');
});

await t('定时辰板块:分组、回推、能不能定、写回档案', async () => {
  await page.evaluate(() => window.dxOpenBoard('sec-dingshi'));
  ok((await page.locator('#ds-hours .dshr').count()) === 12, '十二时辰都要列出来');
  await page.fill('#ds-birth', '1985-11-03');
  await page.selectOption('#ds-gender', '女');
  await page.selectOption('#ds-range', '3,4,5,6,7,8,9');
  ok((await page.locator('#ds-hours .dshr.on').count()) === 7, '选「白天」应只留七个时辰');
  await page.click('#btn-ds-demo');
  ok((await page.locator('#ds-rows .dsrow').count()) === 4, '示例应填四件事');
  await page.click('#btn-ds-go');
  await page.waitForTimeout(1500);
  const txt = await page.locator('#ds-out').innerText();
  ok((await page.locator('#ds-out .dsgrp').count()) >= 1, '应给出「断得一样的时辰」分组');
  ok(/可以定|定不了/.test(txt), '必须表态能不能定:' + txt.slice(0, 60));
  ok(txt.includes('差 异 面 板'), '应有差异面板');
  ok(!/仅供参考|因人而异|机遇与挑战并存|顺其自然/.test(txt), '不许出现空话');
  ok(!/用神|旺相休囚|十神/.test(txt), '术语不许上稿');
  // 事件够三件时要给出排名;写回档案后全应用共用同一时辰
  ok((await page.locator('#ds-out .dsrk').count()) >= 2, '四件事应排得出名次');
  await page.selectOption('#ds-pick', '6');
  await page.click('#btn-ds-save');
  const hv = await page.evaluate(() => localStorage.getItem('dongxuan_birth_hour'));
  ok(hv === '6', '写回档案应存进全局时辰键,实得:' + hv);
  ok((await page.inputValue('#wq-hour')) === '6', '问机板块的时辰应同步');
  // 出生地偏西的,钟表时辰与太阳时辰整排差一格——必须当面解释,不解释就像算错了
  await page.fill('#ds-place', '成都');
  await page.click('#btn-ds-go');
  await page.waitForTimeout(1200);
  const t2 = await page.locator('#ds-out').innerText();
  ok(/差 \d+ 分钟/.test(t2), '应说清钟表与太阳差几分钟:' + t2.slice(-160));
  ok(t2.includes('不是算错'), '应挑明这是老规矩而非程序出错');
});

// 只见一摊:开过专项板块后切回问卦页,板块必须收起来(sec-wenji 曾漏登记在视图表里)
await t('视图路由:专项板块切走后不残留', async () => {
  await page.evaluate(() => window.dxOpenBoard('sec-wenji'));
  await page.evaluate(() => window.dxShowView('ask'));
  for (const id of ['sec-wenji', 'sec-dingshi']) {
    ok(!(await page.locator('#' + id).isVisible()), id + ' 切到问卦页后仍可见');
  }
});

await t('应期:断卦区直接给出日子与书上原话,无 Key 也看得到', async () => {
  await page.evaluate(() => window.dxShowView('ask'));
  await page.fill('#question', '这事什么时候能成?');
  await page.click('#btn-auto');
  await page.waitForSelector('#sec-read:not(.hidden)', { timeout: 8000 });
  const f = await page.locator('#focus').innerText();
  ok(/这事应在什么时候/.test(f), '断卦区应有应期块:' + f.slice(-200));
  ok(/\d{4}年\d{1,2}月\d{1,2}日|没有这个日子/.test(f), '应给出具体日子');
  ok(/书上原话/.test(f), '应附书上原话');
  ok(/我自己担着/.test(f), '应写明取法先后是本程序排的');
});

await browser.close();
server.close();
console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
