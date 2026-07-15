// 东玄卜卦 Service Worker:预缓存全部静态资源,离线可用
const CACHE = 'dongxuan-v0.22.0';
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
  './bazi.js',
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

// 缓存优先,后台更新(stale-while-revalidate)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(resp => {
        if (resp.ok && new URL(e.request.url).origin === location.origin) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
