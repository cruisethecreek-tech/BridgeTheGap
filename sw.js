/* ACCOUNTABILITY service worker - offline shell + fresh updates */
const CACHE = 'accountability-v3';
const ASSETS = [
  './',
  './index.html',
  './app.html',
  './budget.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './fonts/inter-var-latin.woff2',
  './shots/shot-shield.png',
  './shots/shot-home.png',
  './shots/shot-calendar.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // tolerate individual misses (e.g. a renamed screenshot) instead of failing the whole install
      Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Network-first for the app page so updates roll out; fall back to cache offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('app.html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./app.html') || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, fonts).
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok && (url.origin === location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => r || Response.error()))
  );
});
