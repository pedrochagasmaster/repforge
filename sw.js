const CACHE = "repforge-v8";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./icons/icon.svg",
  "./fonts/saira-600.woff2", "./fonts/saira-700.woff2", "./fonts/saira-800.woff2",
  "./fonts/plexsans.woff2",
  "./fonts/plexmono-400.woff2", "./fonts/plexmono-500.woff2", "./fonts/plexmono-600.woff2"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => key === CACHE ? null : caches.delete(key)))));
  self.clients.claim();
});

const SHELL = new Set(["/", "/index.html", "/app.js", "/styles.css", "/manifest.webmanifest"]);
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isShell = event.request.mode === "navigate" ||
    SHELL.has(url.pathname) || SHELL.has(url.pathname.replace(/\/$/, "/index.html"));
  if (isShell) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match("./index.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
