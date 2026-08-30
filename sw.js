const CACHE = "repforge-v127";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./telemetry.js", "./posthog-init.js", "./schedule.js", "./notify.js", "./i18n.js", "./exercises.js",
  "./progression-engine.js", "./program-compiler.js", "./program-entry.js", "./program-entry-adapter.js",
  "./shared-setup.js", "./shared-setup.js?v=127", "./app.js", "./app.js?v=127",
  "./icons/icon.svg", "./icons/favicon-32.png", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/icon-1024.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./assets/brand/mark.png", "./assets/brand/milo-hero.webp",
  "./assets/exercises/ab_cb.webp", "./assets/exercises/ab_mc.webp", "./assets/exercises/abc_mc.webp", "./assets/exercises/abdb_bw.webp",
  "./assets/exercises/ablr_bw.webp", "./assets/exercises/abr_bw.webp", "./assets/exercises/abrt_bw.webp", "./assets/exercises/ad_mc.webp",
  "./assets/exercises/arn_db.webp", "./assets/exercises/be_mc.webp", "./assets/exercises/cd_bw.webp", "./assets/exercises/cf_db.webp",
  "./assets/exercises/chn_bw.webp", "./assets/exercises/ci_cb.webp", "./assets/exercises/ci_mc.webp", "./assets/exercises/cu_bb.webp",
  "./assets/exercises/cu_cb.webp", "./assets/exercises/cu_db.webp", "./assets/exercises/cu_ez.webp", "./assets/exercises/cu_mc.webp",
  "./assets/exercises/cuh_db.webp", "./assets/exercises/cup_bb.webp", "./assets/exercises/cv_mc.webp", "./assets/exercises/cvl_mc.webp",
  "./assets/exercises/cvs_mc.webp", "./assets/exercises/cx_cb.webp", "./assets/exercises/dl_bb.webp", "./assets/exercises/dl_cb.webp",
  "./assets/exercises/dlt_bb.webp", "./assets/exercises/fp_cb.webp", "./assets/exercises/ghr_bw.webp", "./assets/exercises/hg_bb.webp",
  "./assets/exercises/hg_db.webp", "./assets/exercises/hg_mc.webp", "./assets/exercises/hg_sm.webp", "./assets/exercises/hr_mc.webp",
  "./assets/exercises/ht_bb.webp", "./assets/exercises/ht_mc.webp", "./assets/exercises/hx_bw.webp", "./assets/exercises/ilc_bw.webp",
  "./assets/exercises/ip_bb.webp", "./assets/exercises/ip_db.webp", "./assets/exercises/ip_mc.webp", "./assets/exercises/ip_sm.webp",
  "./assets/exercises/lc_mc.webp", "./assets/exercises/lcl_mc.webp", "./assets/exercises/le_mc.webp", "./assets/exercises/lg_bb.webp",
  "./assets/exercises/lg_db.webp", "./assets/exercises/lp1_mc.webp", "./assets/exercises/lph_mc.webp", "./assets/exercises/lr_db.webp",
  "./assets/exercises/lr_mc.webp", "./assets/exercises/pd_bw.webp", "./assets/exercises/pd_mc.webp", "./assets/exercises/pl_cb.webp",
  "./assets/exercises/pl_mc.webp", "./assets/exercises/pr_bb.webp", "./assets/exercises/pr_db.webp", "./assets/exercises/pr_mc.webp",
  "./assets/exercises/pr_sm.webp", "./assets/exercises/pu_bw.webp", "./assets/exercises/pup_bw.webp", "./assets/exercises/pupn_bw.webp",
  "./assets/exercises/pupw_wt.webp", "./assets/exercises/pv_db.webp", "./assets/exercises/rd_db.webp", "./assets/exercises/rd_mc.webp",
  "./assets/exercises/rw1_db.webp", "./assets/exercises/rw_bb.webp", "./assets/exercises/rw_cb.webp", "./assets/exercises/rw_db.webp",
  "./assets/exercises/rw_mc.webp", "./assets/exercises/sh_bb.webp", "./assets/exercises/sh_db.webp", "./assets/exercises/sp_bb.webp",
  "./assets/exercises/sp_db.webp", "./assets/exercises/sp_mc.webp", "./assets/exercises/sps_db.webp", "./assets/exercises/sq_bb.webp",
  "./assets/exercises/sq_db.webp", "./assets/exercises/sq_lp.webp", "./assets/exercises/sq_sm.webp", "./assets/exercises/sqf_bb.webp",
  "./assets/exercises/sqk_mc.webp", "./assets/exercises/ss_bw.webp", "./assets/exercises/ss_db.webp", "./assets/exercises/su_db.webp",
  "./assets/exercises/tb_mc.webp", "./assets/exercises/tr_cb.webp", "./assets/exercises/tr_mc.webp", "./assets/exercises/trd_bw.webp",
  "./assets/exercises/tro_cb.webp", "./assets/exercises/trr_cb.webp", "./assets/exercises/trs_db.webp", "./assets/exercises/wc_bb.webp",
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

const SHELL = new Set(["/", "/index.html", "/app.js", "/styles.css", "/i18n.js", "/exercises.js", "/shared-setup.js", "/program-compiler.js", "/program-entry.js", "/program-entry-adapter.js", "/telemetry.js", "/posthog-init.js", "/posthog-config.js", "/manifest.webmanifest"]);
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
function shellPathname(pathname) {
  if (!SCOPE_PATH) return pathname;
  return pathname === SCOPE_PATH ? "/" :
    pathname.startsWith(`${SCOPE_PATH}/`) ? pathname.slice(SCOPE_PATH.length) : pathname;
}
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const path = shellPathname(url.pathname);
  const isShell = event.request.mode === "navigate" ||
    SHELL.has(path) || SHELL.has(path.replace(/\/$/, "/index.html"));
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
