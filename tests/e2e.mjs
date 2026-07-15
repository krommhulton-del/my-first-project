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
  await expandGroups();
  await page.click('#histlist .hist:first-child .head');
  ok(await page.locator('#histlist .hist:first-child .body pre').isVisible(), '展开后应见回报全文');
  await page.click('#histlist .hist:first-child .btn-delrec');
  ok((await page.locator('#histlist .hist').count()) === 1, '删除后应剩 1 条');
});

await t('清空卦档', async () => {
  await expandGroups();
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
