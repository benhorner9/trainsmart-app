/* TrainSmart service worker.
   - The page itself: network first (so updates show straight away), falling back to the
     saved copy after 3 s or with no signal, so the app still opens.
   - Icons: saved copy first.
   - Programme data (script.google.com) is never cached: always live. */
var CACHE = 'ts-shell-v1';
var SHELL = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function pageFromNetwork(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put('index.html', copy); });
    }
    return res;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') { return; }
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) { return; }
  var isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (isPage) {
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      var fallback = function () {
        caches.match('index.html').then(function (hit) {
          if (done) { return; }
          if (hit) { done = true; resolve(hit); }
        });
      };
      var timer = setTimeout(fallback, 3000);
      pageFromNetwork(req).then(function (res) {
        clearTimeout(timer);
        if (!done) { done = true; resolve(res); }
      }, function () {
        clearTimeout(timer);
        caches.match('index.html').then(function (hit) {
          if (!done) { done = true; resolve(hit || Response.error()); }
        });
      });
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req);
  }));
});
