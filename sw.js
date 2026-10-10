// Scaffale — service worker: l'app funziona anche offline
const VERSION = 'scaffale-v1.4.1';
const SHELL = ['./', './index.html', './app.css', './app.js', './config.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const LIBS = /(unpkg\.com|cdn\.jsdelivr\.net|fastly\.jsdelivr\.net)\/(npm\/)?(@zxing|barcode-detector|zxing-wasm)|fonts\.(googleapis|gstatic)\.com/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Libreria scanner: dalla cache se c'è
  if (LIBS.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  // File dell'app: prima la rete (per avere gli aggiornamenti), poi la cache
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
