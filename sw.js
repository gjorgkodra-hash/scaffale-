// Scaffale — service worker: l'app funziona anche offline
const VERSION = 'scaffale-v2.15.0';
const SHELL = ['./', './index.html', './app.css', './app.js', './i18n.js', './legal.js', './config.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const LIBS = /(unpkg\.com|cdn\.jsdelivr\.net|fastly\.jsdelivr\.net)\/(npm\/)?(@zxing|barcode-detector|zxing-wasm|tesseract)|tessdata\.projectnaptha\.com|fonts\.(googleapis|gstatic)\.com/;

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
  // GitHub Pages tiene i file in cache per 10 minuti: con un parametro sempre nuovo arriva subito l'ultima versione
  const fresh = url.origin + url.pathname + (url.search ? url.search + '&' : '?') + '_=' + Date.now();
  e.respondWith(fetch(fresh, { cache: 'no-store', credentials: 'same-origin' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});

// Notifiche push della Community (arrivano anche con l'app chiusa)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { title: 'Spinyl', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Spinyl', {
      body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: { go: d.go || 'notifs' },
    }),
    // se l'app è aperta, aggiorna subito i pallini delle notifiche
    self.clients.matchAll({ type: 'window' }).then(list => list.forEach(c => c.postMessage({ type: 'push' }))),
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.go) || 'notifs';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(w => w.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ type: 'push-go', go }); return c.focus(); }
    return self.clients.openWindow('./?go=' + encodeURIComponent(go));
  }));
});
