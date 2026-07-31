// 东玄卜卦 Service Worker:预缓存全部静态资源,离线可用
const CACHE = 'dongxuan-v0.60.0';
const ASSETS = [
  './',
  './index.html',
  './gua-core.js',
  './gua-data.js',
  './najia.js',
  './lunar.js',
  './meihua.js',
  './xiaoliuren.js',
  './qimen.js',
  './fenke.js',
  './jiri.js',
  './yingqi.js',
  './dili.js',
  './bazi.js',
  './sanmei.js',
  './dashi.js',
  './wenji.js',
  './yunshi.js',
  './yunshi.html',
  './yunshi.webmanifest',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先(打开即最新版),断网回退缓存——保证改版即时可见,离线仍可用
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok && new URL(e.request.url).origin === location.origin) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
