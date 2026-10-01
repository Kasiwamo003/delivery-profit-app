const CACHE_NAME = "delivery-profit-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=16",
  "./app.js",
  "./config.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
