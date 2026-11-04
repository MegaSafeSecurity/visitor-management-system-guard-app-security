// Service worker: cangkang aplikasi tersedia luar talian (untuk mod Kunci Pas Luar Talian)
const V = 'megasafe-v5.0';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/config.js', 'manifest.json', 'img/logo.png', 'img/icon-192.png', 'img/icon-512.png'];
const CDN = ['https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(async c => {
    await Promise.all(SHELL.map(u => c.add(u).catch(() => { })));
    await Promise.all(CDN.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => { })));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin === location.origin || CDN.indexOf(r.url) >= 0) {
    // rangkaian dahulu (versi terkini), cache sebagai sandaran luar talian
    e.respondWith(fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
  }
});
