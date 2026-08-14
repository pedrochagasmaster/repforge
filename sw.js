const CACHE = "repforge-v72";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./schedule.js", "./notify.js", "./i18n.js",
  "./icons/icon.svg", "./icons/favicon-32.png", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/icon-1024.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./fonts/plexsans.woff2",
  "./fonts/plexmono-400.woff2", "./fonts/plexmono-500.woff2", "./fonts/plexmono-600.woff2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key === CACHE ? null : caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const SHELL = new Set(["/", "/index.html", "/app.js", "/styles.css", "/i18n.js", "/manifest.webmanifest"]);
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isShell = event.request.mode === "navigate" ||
    SHELL.has(url.pathname) || SHELL.has(url.pathname.replace(/\/$/, "/index.html"));
  if (isShell) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
      return response;
    } catch {
      return await caches.match("./index.html");
    }
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) {
        await c.focus();
        if ("navigate" in c) { try { await c.navigate(url); return; } catch {} }
        break;
      }
    }
    await clients.openWindow(url);
  })());
});
