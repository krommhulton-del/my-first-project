// 内测:端到端浏览器测试(node tests/e2e.mjs)
// 静态服务 + 无头 Chromium,验证:一键成卦、逐爻掷、解读渲染、回报格式、历史持久化与删除。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import Tijian from '../tijian.js';

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
const eqs = (a, b, m) => { if (a !== b) throw new Error((m || "") + " 两次不一致"); };
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

await t('性别年龄:年龄改成具体岁数(v0.83),回报注明问卦人并持久化', async () => {
  // v0.83 把年龄段改成了具体岁数——缘起:dashi 的年龄闸门按具体岁数判,
  // 喂「26-30」进去程序还得自己挑一个数,那个挑法是隐式的。这条测试跟着改断言。
  await page.click('.tabs button[data-m=liuyao]');
  await page.evaluate(() => localStorage.removeItem('dongxuan_birth'));
  await page.selectOption('#q-gender', '男');
  await page.fill('#q-age', '28');
  await page.fill('#question', '性别年龄口径内测一问');
  await page.check('input[name=ly-mode][value=coin]');
  await page.click('#btn-auto');
  await page.waitForFunction(() => document.getElementById('report').value.includes('问卦人:男,28岁'), null, { timeout: 9000 });
  ok((await page.inputValue('#report')).includes('问卦人:男,28岁'), '回报应注明性别与具体岁数');
  await page.reload({ waitUntil: 'load' });
  ok((await page.inputValue('#q-gender')) === '男', '性别应持久化');
  ok((await page.inputValue('#q-age')) === '28', '岁数应持久化');
  // 非数字、超范围一律不收——不许把脏值存进去
  await page.fill('#q-age', '999');
  ok((await page.inputValue('#q-age')) === '', '超范围的岁数应被拒');
  await page.selectOption('#q-gender', '');
  await page.fill('#q-age', '');
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

await t('为谁问:默认收成一行,点开才见选项,功能一个没少(v0.78 表单瘦身)', async () => {
  await page.click('.tabs button[data-m=liuyao]');
  // 收起来是默认态:两个下拉不该占着首屏
  for (const c of ['q', 'dw', 'zy', 'yl']) {
    ok((await page.locator('#qwf-' + c).count()) === 1, `${c} 的「为谁问」应是可折叠的一行`);
    ok(!(await page.locator('#qwf-' + c).evaluate(e => e.open)), `${c} 的「为谁问」默认应是收起的`);
    ok(!(await page.locator('#qg-' + c).isVisible()), `${c} 收起时性别下拉不该露在首屏`);
  }
  ok((await page.textContent('#qh-q')).includes('没填'), '空缺时应有提醒');
  // 点那一行就展开,选项照旧能改
  await page.locator('#qwf-q > summary').click();
  ok(await page.locator('#qg-q').isVisible(), '点开之后选项应可见可改');
  await page.evaluate(() => { document.getElementById('qwf-q').open = false; });
});

await t('为谁问:问题旁单独填性别年龄(替人问),盖过顶栏默认', async () => {
  await page.click('.tabs button[data-m=liuyao]');
  await page.evaluate(() => { document.getElementById('qwf-q').open = true; });
  await page.selectOption('#qg-q', '女');
  await page.fill('#qa-q', '38');
  ok((await page.textContent('#qh-q')).includes('女,38岁'), '提示应显示当前口径');
  ok((await page.textContent('#qh-q')).includes('替人问'), '本问单独填了,那一行要标明是替人问的');
  await page.fill('#question', '替人问卦内测');
  await page.click('#btn-auto');
  await page.waitForFunction(() => document.getElementById('report').value.includes('问卦人:女,38岁'), null, { timeout: 9000 });
  await page.selectOption('#qg-q', '');
  await page.fill('#qa-q', '');
  await page.evaluate(() => { document.getElementById('qwf-q').open = false; });
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
  await page.evaluate(() => { document.getElementById('qwf-yl').open = true; });
  await page.selectOption('#qg-yl', '男');
  ok((await page.textContent('#qh-yl')).includes('男'), '板内改选应盖过主页');
  await page.selectOption('#qg-yl', '');
  await page.evaluate(() => { document.getElementById('qwf-yl').open = false; });
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


// 缘起:用户 2026-08 原话——「他很多解读我觉得就是没有那么专业…不要再拿出那种半吊子的感觉了」。
// 病根量出来是:只给「为什么」,不给「那我该干什么」。断而不给做法,就是半吊子。
// 这条盯着做法层真的出现在界面上,且说的是动作与时间,不是道理。
await t('程序初断给的是做法不是道理:眼下怎么办、什么时候、走哪条门路', async () => {
  await page.evaluate(() => dxShowView('ask'));
  await page.fill('#qk-q', '这笔钱能不能收回来?');
  await page.click('#btn-qk');
  const out = await page.textContent('#qk-out');
  ok(/眼下/.test(out), '缺「眼下该怎么办」:' + out.slice(0, 120));
  ok(/时候/.test(out) && /门路/.test(out), '缺时候与门路:' + out.slice(0, 160));
  // 铁律一:只留事、断、做法,不许讲道理灌鸡汤
  for (const w of ['你要明白', '学会', '与其', '其实人生', '要相信']) ok(!out.includes(w), '做法里在讲道理:' + w);
  // 铁律三:禁空话。词表取 tijian.js 那一份权威表(§四 一个口径一处算),不在这儿另写一份
  {
    const k = Tijian.check(out, { zone: '专业' }).hits.filter(h => h.kind === '空话');
    ok(!k.length, '做法里有空话:' + k.map(h => h.snippet).join('、'));
  }
  // 长脚注收进可展开,不许占满版面压住答案
  ok(/凭什么这么说/.test(out), '出处交代应收成可展开的一行');
});
await t('今日一卦:一天一支,同一人同一天刷新不换', async () => {
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1990-06-15'); });
  await page.reload(); await page.waitForTimeout(400);
  const a = await page.textContent('#td-qian');
  ok(a && a.replace(/\s/g, '').length > 20, '今日一卦没渲染:' + a);
  ok(/今日一卦/.test(a), '缺标识');
  // 刷新三次必须一模一样——签要是每次都换就成了老虎机,谁都不会当真
  for (let i = 0; i < 3; i++) {
    await page.reload(); await page.waitForTimeout(300);
    eqs(await page.textContent('#td-qian'), a, '第' + i + '次刷新签变了');
  }
  // 换个生辰,签应该跟着换(否则它跟人没关系)
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1985-11-03'); });
  await page.reload(); await page.waitForTimeout(400);
  ok((await page.textContent('#td-qian')) !== a, '换生辰签没变,说明它跟人无关');
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1990-06-15'); });
  await page.reload(); await page.waitForTimeout(300);
  // 这是签不是卦,必须当面写明白(铁律九:起卦的随机源不许动手脚,签另说)
  const t2 = await page.textContent('#td-qian');
  ok(/不是起卦/.test(t2), '必须写明这是签不是卦:' + t2.slice(-120));
});

await t('经文入断:六十四卦原文摆给客人看,不再只喂给模型', async () => {
  // 缘起:卦辞、爻辞、大象、小象一直都在库里,可只进了 c.report(喂大模型)——
  // 没有 API Key 的用户一个字都看不到。学了的东西没用上,也是「半吊子」的一种。
  await page.evaluate(() => dxShowView('ask'));
  await page.fill('#qk-q', '这事能不能成?');
  await page.click('#btn-qk');
  ok(await page.isVisible('.cdjing'), '缺经文块');
  const j = await page.textContent('.cdjing');
  ok(/《周易》原文/.test(j), '经文块须标明是原文');
  ok(/变占法/.test(j), '须写明按什么规程取的');
  ok(j.replace(/\s/g, '').length > 40, '经文太少:' + j);
  // 取材规程只许有一处(在 gua-core 里),界面不许自己再选一遍
  const own = await page.evaluate(() => typeof GuaCore.interpretationPlan === 'function');
  ok(own, '取材规程应在 gua-core');
});
await t('卦签图:把一次断语画成一张能存的图,高度跟着内容走', async () => {
  const r = await page.evaluate(() => {
    const cv = window.dxDrawCard({
      q: '我今年能不能换成工作?', guaName: '山泽损之山雷颐',
      lines: [{ yang: true, moving: false }, { yang: false, moving: true }, { yang: true, moving: false },
              { yang: false, moving: false }, { yang: false, moving: true }, { yang: true, moving: false }],
      say: '能成,但得你自己推一把', cheng: '成', pct: '七成上下', chengCls: 'ji',
      when: '2026年8月9日',
      advice: [{ k: '眼下', v: '可以推。这是该出手的时候' }, { k: '门路', v: '往东南这一路最顺' }],
      date: '2026年8月1日',
    });
    const cv2 = window.dxDrawCard({ q: '短问', guaName: '乾', lines: null, say: '成', cheng: '成', pct: '八九成',
      chengCls: 'ji', when: '', advice: [{ k: '眼下', v: '可以推,别犹豫' }], date: '2026年8月1日' });
    return { w: cv.width, h: cv.height, h2: cv2.height, url: cv.toDataURL('image/png').slice(0, 22) };
  });
  ok(r.w === 2160, '卡片宽度应为 1080@2x,实得 ' + r.w);
  ok(r.h > 1200 && r.h < 3000, '卡片高度不合理:' + r.h);
  // 内容少的那张必须更矮——这才叫「高度跟着内容走」
  ok(r.h2 < r.h, `内容少的卡片没变矮(${r.h2} vs ${r.h}),高度是写死的`);
  ok(r.url.startsWith('data:image/png'), '导不出 PNG:' + r.url);
});

await t('填钟点比选时辰准:0:30 出生的日柱不再差一天', async () => {
  // 缘起:队列第 1 条,已量化的真错(1995-06 逐日实测 26/26 全错)。
  // 从根上修:各处时辰旁边加一个钟点框,填了它就以钟点为准。
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1995-06-10'); localStorage.removeItem('dongxuan_birth_hour'); });
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate(() => dxOpenBoard('sec-dili'));
  ok(await page.isVisible('#dl-clock'), '地利板块缺钟点输入');
  // 选「子时」→ 按夜里那一段算
  await page.selectOption('#dl-hour', '0'); await page.waitForTimeout(200);
  const a = await page.evaluate(() => { const c = dxBirthChart('q'); return c && c.pillars.day.gz; });
  // 填 0:30 → 按早子算,日柱应当不同
  await page.fill('#dl-clock', '00:30'); await page.dispatchEvent('#dl-clock', 'change'); await page.waitForTimeout(200);
  const b = await page.evaluate(() => { const c = dxBirthChart('q'); return c && c.pillars.day.gz; });
  ok(a && b, '排不出盘:' + a + ' / ' + b);
  ok(a !== b, `选「子时」与填 0:30 排出同一个日柱(${a})——那个差一天的错还在`);
  // 钟点写回了存储,且格式是钟点
  const hv = await page.evaluate(() => localStorage.getItem('dongxuan_birth_hour'));
  ok(/^\d{1,2}:\d{2}$/.test(hv), '存的不是钟点格式:' + hv);
  // 换到别的板块也跟着(全应用一处折法)
  await page.evaluate(() => dxOpenBoard('sec-xinyuan'));
  ok((await page.inputValue('#xy-clock')) === '00:30', '别的板块没同步到钟点');
  // 当面把这个坑说清了
  await page.evaluate(() => dxOpenBoard('sec-dili'));
  ok(/0 点到 1 点/.test(await page.textContent('#dl-hrnote')), '没把 0–1 点这个坑当面说清');
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
  // 铁律八:**断语**里不许出现术语。
  // 判据这次收窄了一次,写清缘由:v0.74 起「凭什么这么说」里挂了《增删卜易》的原话
  // (如「若用神不現﹐卽以日月爲用神…」),「经文」里是《周易》原文——
  // 那两块是**引文**,照录原文正是诚实的做法,不能也不该改写成白话。
  // 所以禁词只查断语区(结论/理由/做法),引文区另有各自的规矩(见下面两条断言)。
  const say = await page.evaluate(() => {
    const box = document.querySelector('#qk-out').cloneNode(true);
    box.querySelectorAll('.qk-src, .cdjing').forEach(el => el.remove());   // 摘掉引文区
    return box.textContent;
  });
  for (const w of ['用神', '世应', '旬空', '月破', '官鬼', '妻财', '子孙']) {
    ok(!say.includes(w), '速答的断语里出现术语「' + w + '」:' + say.slice(0, 120));
  }
  // 引文区必须自陈是原文,不许拿原文冒充自己的话
  const quo = await page.textContent('.qk-src').catch(() => '');
  if (/用神/.test(quo)) ok(/增删卜易|逐字核过/.test(quo), '引了带术语的原话却没标出处');
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
  {
    const k = Tijian.check(txt, { zone: '专业' }).hits.filter(h => h.kind === '空话');
    ok(!k.length, '不许出现空话:' + k.map(h => h.snippet).join('、'));
  }
  ok(await page.locator('#btn-wq-cast').isVisible(), '起卦复核按钮应出现');
  await page.click('#btn-wq-cast');
  await page.waitForTimeout(400);
  ok((await page.inputValue('#question')).includes('复核'), '应把时间带进问句去复核');
});

await t('双人合盘:两份档案合一盘,四种关系分开算,不许替人做决定(v0.85)', async () => {
  // 先建两份档案(合盘吃的是档案,性别必填)
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_profiles_v1', JSON.stringify([
      { id: 'pA', name: '阿明', date: '1990-05-20', time: '09:30', gender: '男', place: '' },
      { id: 'pB', name: '小红', date: '1993-11-07', time: '20:00', gender: '女', place: '' },
      { id: 'pC', name: '缺性别的', date: '1988-02-02', time: '', gender: '', place: '' },
    ]));
  });
  await page.evaluate(() => window.dxOpenBoard('sec-hepan'));
  await page.waitForTimeout(300);

  // 诚实那段话必须在第一屏,而且写着「自拟」「没有回测」
  const honest = await page.locator('#hp-honest').innerText();
  ok(/自拟/.test(honest), '第一屏要写明这套算法是自拟的:' + honest.slice(0, 60));
  ok(/回测/.test(honest), '第一屏要写明零回测');
  ok(/别当判决/.test(honest), '第一屏要写明当参考别当判决');

  // 缺性别的那份不许进下拉
  const opts = await page.locator('#hp-a option').allTextContents();
  ok(!opts.some(x => x.includes('缺性别的')), '缺性别的档案不该出现在合盘的候选里');
  ok(opts.some(x => x.includes('阿明')) && opts.some(x => x.includes('小红')), '两份齐备的档案该在候选里');

  // 同一个人不许合
  await page.selectOption('#hp-a', 'pA');
  await page.selectOption('#hp-b', 'pA');
  await page.click('#btn-hp-go');
  await page.waitForTimeout(200);
  ok((await page.locator('#hp-err').innerText()).includes('同一个人'), '挑了同一个人该被挡下');

  await page.selectOption('#hp-b', 'pB');
  await page.click('#btn-hp-go');
  await page.waitForTimeout(600);
  const out = await page.locator('#hp-out').innerText();
  ok(/四 种 关 系 分 开 算/.test(out), '四种关系要分开列');
  for (const k of ['谈恋爱', '合伙做事', '做朋友', '共事']) ok(out.includes(k), `少了「${k}」这一路`);
  ok(/旺不旺/.test(out), '逐层要摊开');
  ok(/拧 了 怎 么 绕/.test(out), '要给出「拧了怎么绕」');
  ok(/未来十年/.test(out), '要有同期运那一层');

  // **自律**:通篇不许替人做去留的决定
  // 扫之前先把**免责声明整句**剥掉:那一句原样引着「合适不合适」「该不该在一起」,
  // 说的正是「这里不报这些」——拿禁词表去扫它,等于禁止程序声明自己不做某件事。
  // (同一类误伤前后栽过两次,记在案。)
  const scanTxt = out.replace(/这里不报[\s\S]*?一副盘定不了。/g, '');
  ok(!/合适|该不该在一起|建议分开|天生一对|命中注定/.test(scanTxt), '出现了替人做决定的话');
  ok(/一副盘定不了|你自己的事/.test(out), '要写明决定是人做的');

  // 说人话
  {
    const r = Tijian.check(out, { zone: '断语' });
    const bad = r.hits.filter(h => ['空话', '术语', '说教', '花钱消灾'].includes(h.kind));
    ok(!bad.length, '合盘输出不干净:' + bad.map(h => h.kind + ':' + h.snippet).join('、'));
  }
  // 四种关系的叙述不许一模一样
  const says = await page.locator('#hp-out .hprel .hpv').allTextContents();
  ok(says.length === 4, '该有四段关系叙述,实得 ' + says.length);
  ok(new Set(says).size >= 2, '四种关系的叙述完全一样——那四个分类就成了摆设');
  await page.evaluate(() => { localStorage.removeItem('dongxuan_profiles_v1'); localStorage.removeItem('dongxuan_profile_cur'); });
});

await t('西洋星盘:本命九曜落座、月亮误差声明、合盘相位与组合盘、两套不互相计分(v0.94)', async () => {
  // 缘起:板块 E 大工程。守四件事:本命盘无 Key 即出、星盘轮画出来、
  // 月亮 ±0.3° 声明在、合盘出相位与组合盘且诚实横幅写明零回测。
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_birth', '1990-05-20');
    localStorage.setItem('dongxuan_birth_hour', '09:30');
    localStorage.setItem('dongxuan_birth_place', '北京');
    localStorage.setItem('dongxuan_profiles_v1', JSON.stringify([
      { id: 'pA', name: '阿明', date: '1990-05-20', time: '09:30', gender: '男', place: '北京' },
      { id: 'pB', name: '小红', date: '1993-11-07', time: '20:00', gender: '女', place: '上海' },
    ]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dxOpenBoard('sec-xingpan'));
  await page.waitForTimeout(200);
  await page.click('#btn-xz-go');
  await page.waitForTimeout(600);
  const out = await page.locator('#xz-out').innerText();
  ok(/本 命 盘/.test(out), '本命盘区要在');
  for (const nm of ['太阳', '月亮', '水星', '土星']) ok(out.includes(nm), `九曜少了${nm}`);
  ok(/±0\.3°/.test(out), '月亮误差声明必须在界面上');
  ok(/上升/.test(out), '有钟点有地点该排出上升');
  ok(!(await page.locator('#xz-wheel').isHidden()), '星盘轮该画出来');
  const honest = await page.locator('#xz-honest').innerText();
  ok(/零回测/.test(honest) && /不互相计分/.test(honest), '诚实横幅缺关键句:' + honest.slice(0, 60));
  // 合盘
  await page.selectOption('#xz-mode', 'syn');
  await page.waitForTimeout(200);
  await page.selectOption('#xz-a', 'pA');
  await page.selectOption('#xz-b', 'pB');
  await page.click('#btn-xz-go');
  await page.waitForTimeout(600);
  const out2 = await page.locator('#xz-out').innerText();
  ok(/两 盘 相 位/.test(out2) && /组 合 盘/.test(out2), '合盘该出相位与组合盘');
  ok(/顺|拧/.test(out2), '相位基调要说人话');
  await page.evaluate(() => { localStorage.removeItem('dongxuan_profiles_v1'); });
});

await t('占宅:六型摇卦即断、原话上界面、一疑一占的规矩写明(v0.93)', async () => {
  // 缘起:板块 C。守三件事:无 Key 也有程序初断、书上凭据挂在界面、jiu 型有疑处输入框。
  await page.evaluate(() => window.dxOpenBoard('sec-zhaigua'));
  await page.waitForTimeout(300);
  const opts = await page.locator('#zg-type option').allTextContents();
  ok(opts.length === 6, '该有六种问型,实得 ' + opts.length);
  // jiu 型默认第一项,疑处输入框该在
  ok(!(await page.locator('#zg-yi').isHidden()), 'jiu 型的疑处输入框该显示');
  await page.fill('#zg-yi', '大门');
  await page.click('#btn-zg-go');
  await page.waitForTimeout(500);
  const out = await page.locator('#zg-out').innerText();
  ok(/程 序 初 断/.test(out), '程序初断区要在(无 Key 也看得到)');
  ok(/书上凭据/.test(out) && /《增删卜易/.test(out), '原话与出处要挂在界面上');
  ok(/一疑一占/.test(out), '「一疑一占」的规矩要写给人看');
  ok(/大门/.test(out), '所疑之处要回显');
  // 换到修方动土型,亲选与疑处该藏起来
  await page.selectOption('#zg-type', 'xiu');
  await page.waitForTimeout(150);
  ok(await page.locator('#zg-yi').isHidden(), '非 jiu 型疑处框该藏');
  await page.click('#btn-zg-go');
  await page.waitForTimeout(400);
  const out2 = await page.locator('#zg-out').innerText();
  ok(/动得|缓一缓|先停/.test(out2), '修方动土要出结论:' + out2.slice(0, 40));
  {
    const r = Tijian.check(out2.replace(/「[^」]*」/g, ''), { zone: '断语' });
    const bad = r.hits.filter(h => ['空话', '说教', '花钱消灾', '术语'].includes(h.kind));
    ok(!bad.length, '占宅输出不干净:' + bad.map(h => h.kind + ':' + h.snippet).join('、'));
  }
});

await t('改运·运的行当:诊断+六条杠杆、标证据强度、写明不是疗效、无花钱消灾(v0.91)', async () => {
  // 缘起:用户点名的「运的行当」。策划书的验收:六条全取自已有模块、
  // 「不是疗效」那段话必须出现在界面、不许出现任何花钱的东西。
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_birth', '1990-05-20');
    localStorage.setItem('dongxuan_birth_hour', '09:30');
    localStorage.setItem('dongxuan_gender', '男');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dxOpenBoard('sec-zhuanyun'));
  await page.waitForTimeout(200);
  await page.evaluate(() => { const h = document.querySelector('#sec-zhuanyun .foldh'); if (h && document.querySelector('#sec-zhuanyun .foldbody').classList.contains('hidden')) h.click(); });
  await page.waitForTimeout(200);
  await page.click('#btn-zy-gy');
  await page.waitForTimeout(600);
  const out = await page.locator('#zy-gy-out').innerText();
  ok(/诊断/.test(out), '诊断段要在');
  for (const k of ['时 ·', '地 ·', '色 ·', '业 ·', '宅 ·', '人 ·']) ok(out.includes(k), `六条杠杆少了「${k}」`);
  ok((out.match(/证据强度/g) || []).length >= 6, '每条杠杆都要标证据强度');
  const honest = await page.locator('#zy-gy-honest').innerText();
  ok(/依据,不是疗效/.test(honest), '「不是疗效」那段话必须在界面第一屏:' + honest.slice(0, 50));
  ok(!/开光|法物|摆件|水晶|貔貅|付费/.test(out), '出现了花钱消灾之物');
  ok(/起一卦/.test(out), '宅那条要指到起卦的正路');
  {
    const r = Tijian.check(out, { zone: '断语' });
    const bad = r.hits.filter(h => ['空话', '说教', '花钱消灾'].includes(h.kind));
    ok(!bad.length, '运的行当输出不干净:' + bad.map(h => h.kind + ':' + h.snippet).join('、'));
  }
});

await t('命格取向:六路挂原话、说真话不带道德词、两书打架并排摆(v0.90)', async () => {
  // 缘起:用户点名「必须说真话」,策划书画的线是「结论一个字不软,道德词一个字不带」。
  // 这条端到端守三件事:板块能出结论、原话挂在界面上、道德词一个不许漏到界面。
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_birth', '1990-05-20');
    localStorage.setItem('dongxuan_birth_hour', '09:30');
    localStorage.setItem('dongxuan_gender', '男');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dxOpenBoard('sec-mingge'));
  await page.waitForTimeout(200);
  await page.click('#btn-mg-go');
  await page.waitForTimeout(500);
  const out = await page.locator('#mg-out').innerText();
  ok(/第 一 句/.test(out), '第一句区要在');
  ok(/六路强度/.test(out), '六路强度要摆出来');
  ok(/钱 从 哪 条 路 来/.test(out), '钱路那一层要在');
  ok(/书上原话|原话/.test(out), '界面上要挂得出原话');
  ok(/《渊海子平》|《三命通会》|《滴天髓阐微/.test(out), '出处书名要在');
  // 诚实那段话必须在第一屏
  const honest = await page.locator('#mg-honest').innerText();
  ok(/自拟/.test(honest) && /零回测/.test(honest), '第一屏要写明排序分自拟、零回测:' + honest.slice(0, 50));
  // 道德词禁表:引文剥掉后一个不许有(引文原样保留是规矩,不算违规)
  const noQuote = out.replace(/「[^」]*」/g, '');
  for (const w of ['水性杨花', '不检点', '不贞', '娼']) ok(!noQuote.includes(w), `界面白话带道德词:${w}`);
  // 说人话
  {
    const r = Tijian.check(noQuote, { zone: '断语' });
    const bad = r.hits.filter(h => ['空话', '说教', '花钱消灾'].includes(h.kind));
    ok(!bad.length, '命格取向输出不干净:' + bad.map(h => h.kind + ':' + h.snippet).join('、'));
  }
});

await t('生辰档案:新建/改/复制/删,性别必填,切换全应用通用(v0.84)', async () => {
  await page.evaluate(() => {
    localStorage.removeItem('dongxuan_profiles_v1');
    localStorage.removeItem('dongxuan_profile_cur');
  });
  await page.evaluate(() => window.dxOpenBoard('sec-dangan'));
  await page.waitForTimeout(300);
  ok((await page.locator('#da-list').innerText()).includes('还没有档案'), '空簿子要说清');

  // —— 新建:性别不填不许存 ——
  await page.click('#btn-da-new');
  await page.waitForTimeout(200);
  await page.fill('#da-f-name', '我');
  await page.fill('#da-f-date', '1990-05-20');
  await page.fill('#da-f-time', '09:30');
  await page.click('#btn-da-save');
  await page.waitForTimeout(200);
  ok((await page.locator('#da-err').innerText()).includes('性别'), '性别没填就该被挡下');
  ok((await page.locator('#sec-dangan .darow').count()) === 0, '被挡下就不该存进去');

  await page.selectOption('#da-f-gender', '女');
  await page.click('#btn-da-save');
  await page.waitForTimeout(300);
  ok((await page.locator('#sec-dangan .darow').count()) === 1, '补上性别应存得下');
  ok((await page.locator('#sec-dangan .darow').innerText()).includes('我'), '名字应显示');

  // —— 再建一份,性别空着的老档案要被标出来 ——
  await page.click('#btn-da-new');
  await page.waitForTimeout(200);
  await page.fill('#da-f-name', '老妈');
  await page.fill('#da-f-date', '1962-03-08');
  await page.selectOption('#da-f-gender', '女');
  await page.click('#btn-da-save');
  await page.waitForTimeout(300);
  ok((await page.locator('#sec-dangan .darow').count()) === 2, '应有两份');
  const txt = await page.locator('#sec-dangan').innerText();
  ok(/钟点没填/.test(txt), '没填钟点的那份要当面标出来');
  ok(/三分之二|翻盘|只能当一半看/.test(txt), '要说清没填钟点的后果');

  // —— 复制 ——
  await page.locator('#sec-dangan .darow').first().locator('.dacopy').click();
  await page.waitForTimeout(300);
  ok((await page.locator('#sec-dangan .darow').count()) === 3, '复制后应有三份');
  ok((await page.locator('#sec-dangan').innerText()).includes('副本'), '副本要标出来');

  // —— 改:改完不许新增一条 ——
  await page.locator('#sec-dangan .darow').first().locator('.daedit').click();
  await page.waitForTimeout(200);
  await page.fill('#da-f-name', '我自己');
  await page.click('#btn-da-save');
  await page.waitForTimeout(300);
  ok((await page.locator('#sec-dangan .darow').count()) === 3, '改一份不许变成新增一份');
  ok((await page.locator('#sec-dangan').innerText()).includes('我自己'), '改名应生效');

  // —— 用这份:写回全局,全应用通用 ——
  await page.locator('#sec-dangan .darow').nth(1).locator('.dause').click();
  await page.waitForTimeout(400);
  const bd = await page.evaluate(() => localStorage.getItem('dongxuan_birth'));
  ok(bd === '1962-03-08', '「用这份」应写回全局生日,实得 ' + bd);
  ok((await page.locator('#sec-dangan .darow.on').count()) === 1, '正在用的那份要标出来');

  // —— 删:要二次确认;确认后删掉 ——
  page.once('dialog', d => d.accept());
  await page.locator('#sec-dangan .darow').first().locator('.dadel').click();
  await page.waitForTimeout(400);
  ok((await page.locator('#sec-dangan .darow').count()) === 2, '删完应剩两份');
  await page.evaluate(() => { localStorage.removeItem('dongxuan_profiles_v1'); localStorage.removeItem('dongxuan_profile_cur'); });
});

await t('问机·姻缘分两路:想谈一个的报到月,想定下来的报到年(v0.84)', async () => {
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_birth', '1995-04-10');
    localStorage.setItem('dongxuan_birth_hour', '14:00');
    localStorage.setItem('dongxuan_gender', '女');
  });
  await page.evaluate(() => window.dxOpenBoard('sec-wenji'));
  await page.waitForTimeout(300);
  await page.fill('#wq-birth', '1995-04-10');
  await page.selectOption('#wq-gender', '女');
  await page.fill('#wq-q', '我什么时候能谈个恋爱');
  await page.click('#btn-wq-go');
  await page.waitForTimeout(1500);
  const out = await page.locator('#wq-out').innerText();
  ok(/这 一 路 分 两 头 说|分两头说/.test(out), '问姻缘时应给出两路:' + out.slice(0, 100));
  ok(/容易开始点什么的月份|一个月都没挑出来/.test(out), '近档要报到月');
  ok(/门槛低不等于看得准|一个月都没挑出来/.test(out), '必须当面说清「报得密不等于看得准」');
  ok(/不报是好是坏/.test(out), '两路都不许给吉凶方向,这句话要在');
  {
    const r = Tijian.check(out, { zone: '断语' });
    const bad = r.hits.filter(h => ['空话', '术语', '说教', '花钱消灾'].includes(h.kind));
    ok(!bad.length, '问机输出不干净:' + bad.map(h => h.kind + ':' + h.snippet).join('、'));
  }
});

await t('验盘簿:封存期间断语一个字都不许进 DOM(盲测协议的命门)', async () => {
  await page.evaluate(() => { localStorage.removeItem('dongxuan_yanpan_v1'); });
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_birth', '1990-05-20');
    localStorage.setItem('dongxuan_birth_hour', '09:30');
  });
  await page.evaluate(() => window.dxOpenBoard('sec-yanpan'));
  await page.waitForTimeout(300);
  // —— 封一个过去的年份 ——
  await page.fill('#yp-year', '2019');
  await page.click('#btn-yp-seal');
  await page.waitForTimeout(400);
  ok((await page.locator('#yp-pending .yprec').count()) === 1, '封完应出现一条待开封');
  ok((await page.locator('#yp-sealmsg').innerText()).includes('2019'), '应回执封存了哪一年');

  // **命门**:待开封时,程序对这一年的判断不许能从 DOM 反推出来。
  // (这条断言第一版写成「DOM 里不许出现任何事型名」——错的:下拉里九类平铺列出,
  //  恰恰什么都没泄露。真正的不变量是下面这三条。)
  const sealedTxt = await page.locator('#sec-yanpan').innerText();
  ok(!/判吉|判凶|方向分|最看重|排在第/.test(sealedTxt), '封存期间漏出了吉凶或排位:' + sealedTxt.slice(0, 120));
  // ① 下拉的次序必须是那张固定的事型表,不许按程序的分数排——一排序就等于把答案摆出来了
  const optOrder = await page.locator('#yp-pending .ypcat option').allTextContents();
  const catOrder = await page.evaluate(() => Object.keys(Yanpan.CATS).map(k => Yanpan.CATS[k].label));
  ok(JSON.stringify(optOrder) === JSON.stringify(catOrder), '事型下拉被重排过,等于泄题:' + optOrder.join(','));
  // ② 封存的字段名与小数分值不许进 DOM
  const html = await page.locator('#yp-pending').innerHTML();
  ok(!/\bdir\b|\bcalls\b|ranked/.test(html), '待开封节点带上了封存字段:' + html.slice(0, 160));
  const decs = await page.evaluate(() => {
    const r = (JSON.parse(localStorage.getItem('dongxuan_yanpan_v1') || '[]')).find(x => x.year === 2019);
    return Object.values(r.sealed.calls).flatMap(v => [v.dir, v.score])
      .filter(v => Math.abs(v) >= 1 && v % 1 !== 0).map(String);
  });
  ok(!decs.filter(n => html.includes(n)).length, '待开封的 HTML 里带上了封存的分值:' + decs.join(','));

  // ③ **最硬的一条**:同一年份、两副完全不同的盘,待开封的标记必须逐字节相同。
  //    相同就等于这块 DOM 一个比特的判断信息都没带出来——比逐个词去找漏子可靠得多。
  //    (两人同年生,岁数一样,所以连岁数那一处都不必抹。)
  const shot = async (birth) => {
    await page.evaluate(b => {
      localStorage.removeItem('dongxuan_yanpan_v1');
      localStorage.setItem('dongxuan_birth', b);
      localStorage.setItem('dongxuan_birth_hour', '09:30');
    }, birth);
    await page.evaluate(() => window.dxYanpanRender());
    await page.fill('#yp-year', '2019');
    await page.click('#btn-yp-seal');
    await page.waitForTimeout(300);
    return page.locator('#yp-pending').innerHTML();
  };
  const hA = await shot('1990-05-20');
  const hB = await shot('1990-11-02');
  ok(hA === hB, '两副不同的盘,待开封的标记居然不一样——有判断信息漏进了 DOM');
  ok(hA.includes('2019'), '这条测试自己失效了:标记里连年份都没有');

  // 回到 A 的盘继续往下考
  await page.evaluate(() => { localStorage.removeItem('dongxuan_yanpan_v1'); localStorage.setItem('dongxuan_birth', '1990-05-20'); });
  await page.evaluate(() => window.dxYanpanRender());
  await page.fill('#yp-year', '2019');
  await page.click('#btn-yp-seal');
  await page.waitForTimeout(300);

  // —— 同一年不许封两次(免得挑着封) ——
  await page.fill('#yp-year', '2019');
  await page.click('#btn-yp-seal');
  await page.waitForTimeout(200);
  ok((await page.locator('#yp-err').innerText()).includes('已经封过'), '同一年重复封存应被挡下');

  // —— 开封:写下实际发生了什么 ——
  await page.selectOption('#yp-pending .ypcat', 'shiye');
  await page.selectOption('#yp-pending .ypgood', '1');
  await page.fill('#yp-pending .ypwhat', '换了家公司,待遇涨了');
  await page.click('#yp-pending .ypopen');
  await page.waitForTimeout(400);
  ok((await page.locator('#yp-opened .yprec').count()) === 1, '开封后应移到已开封');
  ok((await page.locator('#yp-pending .yprec').count()) === 0, '待开封里不该还留着');
  const opened = await page.locator('#yp-opened').innerText();
  ok(/对上了|它错了|没敢表态/.test(opened), '开封必须给出结论:' + opened.slice(0, 80));
  ok(/排在第 \d+\/\d+ 位/.test(opened), '应摆出封存时把这一类排第几');

  // —— 总账:样本小的时候必须把话说死,并且不许把弃权换来的高命中率说成本事 ——
  const led = await page.locator('#yp-ledger').innerText();
  ok(/什么都证明不了|说明不了/.test(led), '样本不足时必须当面说清:' + led.slice(0, 120));
  ok(led.includes('闭眼押一边') || /一次也没表态/.test(led), '必须同时报恒猜基线');
  {
    const r = Tijian.check(led, { zone: '断语' });
    const bad = r.hits.filter(h => ['空话', '术语', '说教', '花钱消灾'].includes(h.kind));
    ok(!bad.length, '总账不干净:' + bad.map(h => h.kind + ':' + h.snippet).join('、'));
  }

  // —— 往后封:还没到的年份不给填,免得当场就编 ——
  const nextY = new Date().getFullYear() + 2;
  await page.fill('#yp-year', String(nextY));
  await page.click('#btn-yp-seal');
  await page.waitForTimeout(300);
  const pend = await page.locator('#yp-pending').innerText();
  ok(pend.includes('往后封'), '未来年份应标成往后封:' + pend.slice(0, 100));
  ok((await page.locator('#yp-pending .ypopen').count()) === 0, '还没到的年份不该给开封表单');

  // —— 封存内容确实落到了本机,且改「实际」不动封存 ——
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem('dongxuan_yanpan_v1') || '[]'));
  ok(store.length === 2, '两条记录应都存下来');
  const rec2019 = store.find(r => r.year === 2019);
  ok(rec2019 && Object.keys(rec2019.sealed.calls).length >= 8, '封存必须锁住八类事的全部分数');
  const before = JSON.stringify(rec2019.sealed);
  await page.click('#yp-opened .ypedit');
  await page.waitForTimeout(300);
  await page.selectOption('#yp-pending .ypcat', 'jiankang');
  await page.selectOption('#yp-pending .ypgood', '0');
  await page.click('#yp-pending .ypopen');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => (JSON.parse(localStorage.getItem('dongxuan_yanpan_v1') || '[]')).find(r => r.year === 2019));
  ok(JSON.stringify(after.sealed) === before, '改「实际发生了什么」居然动了封存那一头');
  ok(after.actual.edits === 1, '改过一次要记一次,实得 ' + after.actual.edits);
  ok((await page.locator('#yp-opened').innerText()).includes('改过 1 次'), '报表上要照实写着改过几次');
  await page.evaluate(() => { localStorage.removeItem('dongxuan_yanpan_v1'); });
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
  {
    const r = Tijian.check(txt, { zone: '断语' });
    const k = r.hits.filter(h => h.kind === '空话');
    ok(!k.length, '不许出现空话:' + k.map(h => h.snippet).join('、'));
    const j = r.hits.filter(h => h.kind === '术语');
    ok(!j.length, '术语不许上稿:' + j.map(h => h.snippet).join('、'));
  }
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

// ——— v0.77:感情状态入口 + 侧栏「准不准」———
await t('填了确切钟点,任何一次渲染都不许把它抹掉(v0.77 揪出的真错)', async () => {
  // 缘起:v0.75 把时辰输入改成「可直接填钟点」,折法收归一处。可有三处**回写**没跟着改——
  //   心愿板块 renderXyBazi、地利取盘 dlChart 会无条件把「时辰下拉」的值写回 HRKEY,
  //   而下拉装不下 "03:30" 这种钟点串,value 是空的,于是**渲染一次就把钟点抹成「不知道」**,
  //   盘悄悄退回中午 12 点。实测 1957-06-02:填 03:30 排出的是「喜木水」,
  //   被抹掉后按中午排是「喜土火金」——**整个相反**。
  const savedPlace = await page.evaluate(() => localStorage.getItem('dongxuan_birth_place') || '');
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_birth', '1957-06-02');
    localStorage.setItem('dongxuan_birth_hour', '03:30');
    localStorage.removeItem('dongxuan_birth_place');   // 经度会挪时柱,这条测的不是经度
  });
  await page.reload(); await page.waitForTimeout(500);
  const kept = await page.evaluate(() => localStorage.getItem('dongxuan_birth_hour'));
  ok(kept === '03:30', '钟点被渲染抹掉了,实得:' + JSON.stringify(kept));
  const gz = await page.evaluate(() => {
    const c = window.dxBirthChart('q');
    return ['year', 'month', 'day', 'hour'].map(k => c.pillars[k].gz).join(' ');
  });
  ok(gz.endsWith('戊寅'), '03:30 应排出寅时(戊寅),实得:' + gz);
  // 同一天按中午排出来的是完全相反的一套喜忌——这正是这个错的杀伤力
  const xiExact = await page.evaluate(() => window.dxBirthChart('q').yong.xiWx.join('、'));
  const xiNoon = await page.evaluate(() => {
    const c = Bazi.chart(new Date(1957, 5, 2, 12, 0), 'undefined' === typeof dxMarital ? '男' : (localStorage.getItem('dongxuan_gender') || '男'));
    return c.yong.xiWx.join('、');
  });
  ok(xiExact !== xiNoon, `这一天填不填钟点本该断出两套喜忌,现在一样(${xiExact}),测例失去意义`);
  // 走一遍会触发那几处回写的板块(心愿的旺你牌、地利取盘),钟点仍须还在
  await page.evaluate(() => dxOpenBoard('sec-xinyuan'));
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_birth_hour'))) === '03:30', '开了心愿板块之后钟点又没了');
  await page.evaluate(() => dxOpenBoard('sec-dili'));
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => localStorage.getItem('dongxuan_birth_hour'))) === '03:30', '开了地利板块之后钟点又没了');
  await page.evaluate(p => { if (p) localStorage.setItem('dongxuan_birth_place', p); }, savedPlace);
});
await t('感情状态是全局选项,选了就记住', async () => {
  await page.evaluate(() => { localStorage.removeItem('dongxuan_marital'); });
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.isVisible('#q-marital'), '顶栏应有感情状态选项');
  const title = await page.getAttribute('#q-marital', 'title');
  ok(/算不出|处境/.test(title || ''), '提示里要讲明命盘算不出聚散:' + title);
  await page.selectOption('#q-marital', '有伴');
  ok(await page.evaluate(() => localStorage.getItem('dongxuan_marital')) === '有伴', '选了要存住');
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.inputValue('#q-marital') === '有伴', '刷新后要恢复');
  ok(await page.evaluate(() => window.dxMarital()) === '有伴', 'dxMarital() 应读得到');
  await page.selectOption('#q-marital', '');
});
await t('侧栏「准不准」:一个字没填钟点才提示,填了就不再啰嗦', async () => {
  // 一个字没填钟点 → 程序其实是按中午 12 点排的,这件事必须当面说
  await page.evaluate(() => {
    localStorage.setItem('dongxuan_birth', '1957-06-02');
    localStorage.removeItem('dongxuan_birth_hour');
  });
  await page.reload(); await page.waitForTimeout(500);
  const a = await page.textContent('#sp-body');
  ok(a.includes('准不准'), '没填钟点时侧栏应有「准不准」一行:' + a.slice(0, 160));
  ok(/换个时辰就相反|力度会变/.test(a), '要说清不确定在哪:' + a.slice(0, 200));
  ok(/生时校正|定时辰|问准/.test(a), '要指出路子,不能只吓唬人');
  // 填了确切钟点 → 盘是唯一的,不该再提示
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth_hour', '03:30'); });
  await page.reload(); await page.waitForTimeout(500);
  const b = await page.textContent('#sp-body');
  ok(!b.includes('准不准'), '填了确切钟点还提示,是啰嗦:' + b.slice(0, 160));
  await page.evaluate(() => { localStorage.setItem('dongxuan_birth', '1990-06-15'); localStorage.setItem('dongxuan_birth_hour', '5'); });
});

await t('断语体检员接进了界面:模型的稿子一出来就回查(队列第 8 条)', async () => {
  // 无 Key 的环境跑不了真深断,这里直接调界面里那个渲染函数,验它把结论摆出来了、
  // 并且**只报不改**——稿子原文一个字都不许动。
  const r = await page.evaluate(() => {
    const box = document.createElement('div');
    box.className = 'fq-ans';
    const wrap = document.createElement('div');
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    const draft = '首先,总的来说,这一年机遇与挑战并存,你要明白顺其自然的道理。' +
      '用神受克、喜忌翻转。建议你保持平常心,可以请一尊开光的貔貅化解。';
    box.textContent = draft;
    const res = window.dxTijian(box, draft, { cheng: '成' });
    const tj = wrap.querySelector('.tj-box');
    return {
      hasBox: !!tj,
      bad: tj ? tj.className.includes('bad') : false,
      txt: tj ? tj.innerText : '',
      draftKept: box.textContent === draft,
      score: res ? res.score : null,
      kinds: res ? [...new Set(res.hits.map(h => h.kind))] : [],
      hasBtn: tj ? !!tj.querySelector('.tj-again') : false,
    };
  });
  ok(r.hasBox, '稿子有问题却没给出体检结论');
  ok(r.bad, '这么脏的稿子应判不合格');
  ok(r.draftKept, '体检员改了稿子——它只许报,不许改');
  ok(r.hasBtn, '应给一个「打回重写」');
  for (const k of ['空话', '说教', '术语', '花钱消灾']) ok(r.kinds.includes(k), '没认出「' + k + '」:' + r.kinds.join('、'));
  ok(r.score === 0 || r.score < 60, '分数应当很低,实得 ' + r.score);
  ok(/不合格/.test(r.txt), '结论条要把话说死:' + r.txt.slice(0, 40));
});

await t('干净的稿子不打扰:体检员一个字都不吭', async () => {
  const has = await page.evaluate(() => {
    const box = document.createElement('div'); box.className = 'fq-ans';
    const wrap = document.createElement('div'); wrap.appendChild(box); document.body.appendChild(wrap);
    const good = '这事七成能成,落在2026年3月上旬。3月5日之前把合同递上去,别拖过清明。' +
      '眼下三件事:先找那位姓王的中间人开口,再把报价压到18万以内,月底前把材料补齐。忌往西边跑,少接熟人的合伙局。';
    box.textContent = good;
    window.dxTijian(box, good, {});
    return !!wrap.querySelector('.tj-box');
  });
  ok(!has, '干净的稿子不该弹结论条,那是打扰');
});

await browser.close();
server.close();
console.log(`\n结果:${pass} 通过,${fail} 失败`);
process.exit(fail ? 1 : 0);
