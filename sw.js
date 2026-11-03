// Service worker : l'application s'ouvre même sans réseau, et les vues satellite déjà affichées restent en cache.
const APP = 'parcellaire-app-v1';
const LIBS = 'parcellaire-libs-v1';
const TILES = 'parcellaire-tuiles-v1';
const MAX_TILES = 3000;
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  const keep = [APP, LIBS, TILES];
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !keep.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const isTile = u => u.hostname === 'data.geopf.fr' && u.pathname.startsWith('/wmts') || u.hostname === 'server.arcgisonline.com';
const isLib = u => ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.hostname) || (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'));

async function trim() {
  const c = await caches.open(TILES); const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    // réseau d'abord pour recevoir les mises à jour, cache si pas de réseau
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(APP).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else if (isLib(u) || isTile(u)) {
    const name = isTile(u) ? TILES : LIBS;
    e.respondWith(caches.open(name).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { c.put(req, r.clone()); if (name === TILES) trim(); }
      return r;
    }))));
  }
});
