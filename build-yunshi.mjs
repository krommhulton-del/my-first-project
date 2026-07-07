// 构建单文件运势桌面版:内联依赖 → dist/东玄运势.html(双击即用)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(ROOT, f), 'utf8');

let html = read('yunshi.html');
for (const dep of ['najia.js', 'lunar.js', 'bazi.js', 'yunshi.js']) {
  html = html.replace(`<script src="${dep}"></script>`, '<script>\n' + read(dep) + '\n</script>');
}
html = html
  .replace(/\n  if \('serviceWorker'[\s\S]*?catch\(\(\) => \{\}\);\n/, '\n')
  .replace('<link rel="manifest" href="yunshi.webmanifest">\n', '')
  .replace('<link rel="apple-touch-icon" href="icon-192.png">\n', '')
  .replace('<link rel="icon" type="image/png" href="icon-192.png">\n',
    '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f4eee1"/><circle cx="50" cy="50" r="38" fill="#c9a45c" stroke="#8a6f3a" stroke-width="3"/><rect x="40" y="40" width="20" height="20" fill="#f4eee1" stroke="#8a6f3a" stroke-width="2"/></svg>'
    ) + '">\n')
  .replace('<a href="index.html">← 去卜卦(东玄卜卦)</a>', '<span style="opacity:.5">东玄卜卦(卜卦另存)</span>');

if (html.includes('script src') || html.includes('serviceWorker')) throw new Error('内联未完成');
mkdirSync(join(ROOT, 'dist'), { recursive: true });
const out = join(ROOT, 'dist', '东玄运势.html');
writeFileSync(out, html);
writeFileSync(join(ROOT, 'dist', 'yunshi.html'), html);
console.log('已生成', out, '(', Buffer.byteLength(html), '字节 )');
