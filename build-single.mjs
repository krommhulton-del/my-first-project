// 构建单文件桌面版:把数据、逻辑全部内联进一个 HTML,双击即用(node build-single.mjs)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(ROOT, f), 'utf8');

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
  .replace('<script src="jiri.js"></script>', '<script>\n' + read('jiri.js') + '\n</script>')
  // 桌面单文件版无 Service Worker 与 manifest(file:// 下不适用)
  .replace(/\n  \/\/ —— PWA[\s\S]*?\.catch\(\(\) => \{\}\);\n  \}\n/, '\n')
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
  .replace('<link rel="apple-touch-icon" href="icon-192.png">\n', '')
  .replace('<link rel="icon" type="image/png" href="icon-192.png">\n',
    '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f4eee1"/><circle cx="50" cy="50" r="38" fill="#c9a45c" stroke="#8a6f3a" stroke-width="3"/><rect x="40" y="40" width="20" height="20" fill="#f4eee1" stroke="#8a6f3a" stroke-width="2"/></svg>'
    ) + '">\n');

if (html.includes('script src') || html.includes('serviceWorker')) throw new Error('内联未完成');

mkdirSync(join(ROOT, 'dist'), { recursive: true });
for (const name of ['东玄卜卦.html', 'dongxuan.html']) { // 中文名 + ASCII 名(避免双击乱码打不开)
  const out = join(ROOT, 'dist', name);
  writeFileSync(out, html);
  console.log('已生成', out, '(', Buffer.byteLength(html), '字节 )');
}
