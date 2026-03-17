// TruckFlow Service Worker — v1
const CACHE = 'truckflow-v1';
const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';

const APP_SHELL = [
  './truckflow_2058.html',
  './manifest.json',
  './icons/icon.svg',
  SHEETJS_URL
];

// ── Install : mise en cache de l'app shell ──────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      // On essaie de cacher SheetJS (CDN externe) séparément pour ne pas
      // bloquer l'install si le réseau est absent
      var local = APP_SHELL.filter(function(u){ return !u.startsWith('http'); });
      var cdn   = APP_SHELL.filter(function(u){ return  u.startsWith('http'); });
      return cache.addAll(local).then(function(){
        return Promise.allSettled(cdn.map(function(u){
          return fetch(u).then(function(r){ return cache.put(u, r); });
        }));
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

// ── Activate : suppression des anciens caches ───────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                            .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// ── Fetch : cache-first pour l'app, network-first pour le CDN ──────────────
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // CDN externe → network-first, fallback cache
  if (url.startsWith('https://cdn.sheetjs.com')) {
    e.respondWith(
      fetch(e.request).then(function(r) {
        var clone = r.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return r;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // App shell → cache-first, fallback network
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(r) {
          if (r && r.status === 200) {
            var clone = r.clone();
            caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
          }
          return r;
        });
      })
    );
  }
});
