// 构建单文件桌面版:把数据、逻辑全部内联进一个 HTML,双击即用(node build-single.mjs)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(ROOT, f), 'utf8');

// —— 一、先把「看人运势」整页打成自足文档(桌面单文件版里没有 yunshi.html 这个外部文件)——
const LS_GUARD = `<script>
(function(){ // file:// 下部分浏览器禁 localStorage,给个内存兜底,页面照常能用
  try { window.localStorage.setItem('__dxt','1'); window.localStorage.removeItem('__dxt'); return; } catch (e) {}
  var m = {};
  var shim = { getItem: function(k){ return Object.prototype.hasOwnProperty.call(m,k) ? m[k] : null; },
    setItem: function(k,v){ m[k] = String(v); }, removeItem: function(k){ delete m[k]; },
    clear: function(){ m = {}; }, key: function(i){ return Object.keys(m)[i] || null; },
    get length(){ return Object.keys(m).length; } };
  try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch (e) {}
})();
<\/script>`;

let yunshi = read('yunshi.html');
for (const f of ['najia.js', 'lunar.js', 'bazi.js', 'yunshi.js', 'sanmei.js', 'dili.js', 'dashi.js', 'geju.js', 'dingshi.js', 'tijian.js']) {
  const tag = `<script src="${f}"></script>`;
  if (!yunshi.includes(tag)) throw new Error('运势页缺少脚本标签:' + f);
  yunshi = yunshi.replace(tag, '<script>\n' + read(f) + '\n</script>');
}
yunshi = yunshi
  .replace('<link rel="manifest" href="yunshi.webmanifest">\n', '')
  .replace('<link rel="apple-touch-icon" href="icon-192.png">\n', '')
  .replace('<link rel="icon" type="image/png" href="icon-192.png">\n', '')
  .replace(/\n\s*if \('serviceWorker' in navigator[^\n]*\n/, '\n')
  // 页内「去卜卦」改成关闭浮层回主程序(单文件版没有 index.html 可跳)
  .replace('<a href="index.html">← 去卜卦(东玄卜卦)</a>',
    '<a href="#" onclick="try{parent.postMessage(\'dx-yunshi-close\',\'*\')}catch(e){};return false">← 回去卜卦</a>')
  .replace('<head>', '<head>\n' + LS_GUARD);
if (yunshi.includes('script src') || yunshi.includes('serviceWorker')) throw new Error('运势页内联未完成');

let html = read('index.html');
html = html
  .replace('<script src="gua-data.js"></script>', '<script>\n' + read('gua-data.js') + '\n</script>')
  .replace('<script src="gua-core.js"></script>', '<script>\n' + read('gua-core.js') + '\n</script>')
  .replace('<script src="najia.js"></script>', '<script>\n' + read('najia.js') + '\n</script>')
  .replace('<script src="lunar.js"></script>', '<script>\n' + read('lunar.js') + '\n</script>')
  .replace('<script src="meihua.js"></script>', '<script>\n' + read('meihua.js') + '\n</script>')
  .replace('<script src="xiaoliuren.js"></script>', '<script>\n' + read('xiaoliuren.js') + '\n</script>')
  .replace('<script src="qimen.js"></script>', '<script>\n' + read('qimen.js') + '\n</script>')
  .replace('<script src="fenke.js"></script>', '<script>\n' + read('fenke.js') + '\n</script>')
  .replace('<script src="bazi.js"></script>', '<script>\n' + read('bazi.js') + '\n</script>')
  .replace('<script src="yunshi.js"></script>', '<script>\n' + read('yunshi.js') + '\n</script>')
  .replace('<script src="jiri.js"></script>', '<script>\n' + read('jiri.js') + '\n</script>')
  .replace('<script src="yingqi.js"></script>', '<script>\n' + read('yingqi.js') + '\n</script>')
  .replace('<script src="chuduan.js"></script>', '<script>\n' + read('chuduan.js') + '\n</script>')
  .replace('<script src="dili.js"></script>', '<script>\n' + read('dili.js') + '\n</script>')
  .replace('<script src="dashi.js"></script>', '<script>\n' + read('dashi.js') + '\n</script>')
  .replace('<script src="wenji.js"></script>', '<script>\n' + read('wenji.js') + '\n</script>')
  .replace('<script src="dingshi.js"></script>', '<script>\n' + read('dingshi.js') + '\n</script>')
  .replace('<script src="tijian.js"></script>', '<script>\n' + read('tijian.js') + '\n</script>')
  .replace('<script src="yanpan.js"></script>', '<script>\n' + read('yanpan.js') + '\n</script>')
  .replace('<script src="hepan.js"></script>', '<script>\n' + read('hepan.js') + '\n</script>')
  .replace('<script src="mingge.js"></script>', '<script>\n' + read('mingge.js') + '\n</script>')
  .replace('<script src="mingpan.js"></script>', '<script>\n' + read('mingpan.js') + '\n</script>')
  .replace('<script src="gaiyun.js"></script>', '<script>\n' + read('gaiyun.js') + '\n</script>')
  .replace('<script src="zhaigua.js"></script>', '<script>\n' + read('zhaigua.js') + '\n</script>')
  .replace('<script src="data/astro-vsop.js"></script>', '<script>\n' + read('data/astro-vsop.js') + '\n</script>')
  .replace('<script src="astro.js"></script>', '<script>\n' + read('astro.js') + '\n</script>')
  // 桌面单文件版无 Service Worker 与 manifest(file:// 下不适用)
  .replace(/\n  \/\/ —— PWA[\s\S]*?\.catch\(\(\) => \{\}\);\n  \}\n/, '\n')
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
  .replace('<link rel="apple-touch-icon" href="icon-192.png">\n', '')
  .replace('<link rel="icon" type="image/png" href="icon-192.png">\n',
    '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f4eee1"/><circle cx="50" cy="50" r="38" fill="#c9a45c" stroke="#8a6f3a" stroke-width="3"/><rect x="40" y="40" width="20" height="20" fill="#f4eee1" stroke="#8a6f3a" stroke-width="2"/></svg>'
    ) + '">\n');

if (html.includes('script src') || html.includes('serviceWorker')) throw new Error('内联未完成');
if (!/href="yunshi\.html"/.test(html)) throw new Error('主页面没有运势入口,构建注入无处可挂');

// —— 二、把运势整页塞进主文件:点「看人运势」在应用内弹出,不再去找外部 yunshi.html ——
const yunshiLiteral = JSON.stringify(yunshi).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\u0021--');
const OVERLAY = `<script>
(function(){
  var DOC = ${yunshiLiteral};
  function close() { var ov = document.getElementById('dx-yunshi-ov'); if (ov) { ov.remove(); document.body.style.overflow = ''; } }
  function open() {
    if (document.getElementById('dx-yunshi-ov')) return;
    var ov = document.createElement('div');
    ov.id = 'dx-yunshi-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:var(--paper,#f4eee1)';
    var bar = document.createElement('div');
    bar.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 14px 8px;border-bottom:1px solid var(--line,#d8cdb2);background:var(--panel,#faf6ec);font-family:inherit';
    var back = document.createElement('button');
    back.type = 'button'; back.id = 'dx-yunshi-back'; back.textContent = '← 返回';
    back.style.cssText = 'font:inherit;cursor:pointer;border:1px solid var(--line,#d8cdb2);background:var(--panel2,#ece4d0);color:var(--ink,#33291d);border-radius:8px;padding:5px 12px';
    back.addEventListener('click', close);
    var ttl = document.createElement('span');
    ttl.textContent = '看人运势 · 八字命盘'; ttl.style.cssText = 'font-weight:700;color:var(--ink,#33291d)';
    bar.appendChild(back); bar.appendChild(ttl);
    var fr = document.createElement('iframe');
    fr.id = 'dx-yunshi-frame'; fr.title = '看人运势';
    fr.style.cssText = 'flex:1 1 auto;width:100%;border:0;background:var(--paper,#f4eee1)';
    // 主程序是夜间就把浮层也开成夜间(不依赖 file:// 下能否读 localStorage)
    fr.srcdoc = document.documentElement.dataset.theme === 'dark'
      ? DOC.replace('<html lang="zh-CN">', '<html lang="zh-CN" data-theme="dark">') : DOC;
    ov.appendChild(bar); ov.appendChild(fr);
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
  }
  window.dxOpenYunshi = open; // 供自测调用
  document.addEventListener('click', function(e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href="yunshi.html"],[data-href="yunshi.html"]') : null;
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    open();
  }, true);
  window.addEventListener('message', function(e) { if (e.data === 'dx-yunshi-close') close(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
})();
<\/script>`;
if (!html.includes('</body>')) throw new Error('主页面缺少 </body>,无法注入运势浮层');
html = html.replace('</body>', OVERLAY + '\n</body>');

mkdirSync(join(ROOT, 'dist'), { recursive: true });
for (const name of ['东玄卜卦.html', 'dongxuan.html']) { // 中文名 + ASCII 名(避免双击乱码打不开)
  const out = join(ROOT, 'dist', name);
  writeFileSync(out, html);
  console.log('已生成', out, '(', Buffer.byteLength(html), '字节 )');
}
