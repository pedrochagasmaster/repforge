const CACHE = "repforge-v486";
const SOURCE_RELEASE = "source-486";
const ASSETS = [
  // BEGIN GENERATED NATIVE SOURCE ASSETS
  "./src/app/block-review.js",
  "./src/app/block-transition.js",
  "./src/app/custom-import.js",
  "./src/app/entry.js",
  "./src/app/entry/activation.js",
  "./src/app/entry/answers.js",
  "./src/app/entry/editor.js",
  "./src/app/entry/generation.js",
  "./src/app/entry/import-review.js",
  "./src/app/entry/landing-proof.js",
  "./src/app/entry/questions.js",
  "./src/app/entry/received-setup.js",
  "./src/app/entry/review-session.js",
  "./src/app/entry/setup.js",
  "./src/app/history-read-models.js",
  "./src/app/history.js",
  "./src/app/install-transfer.js",
  "./src/app/installed-editor.js",
  "./src/app/interchange.js",
  "./src/app/profile.js",
  "./src/app/program-form.js",
  "./src/app/program-sharing.js",
  "./src/app/program.js",
  "./src/app/progress-read-models.js",
  "./src/app/read-models.js",
  "./src/app/review.js",
  "./src/app/session.js",
  "./src/app/settings.js",
  "./src/app/storage-recovery.js",
  "./src/app/workout-context.js",
  "./src/app/workout-model.js",
  "./src/app/workout-reminder.js",
  "./src/app/workout.js",
  "./src/bootstrap.js",
  "./src/interchange/backup.js",
  "./src/interchange/csv.js",
  "./src/interchange/freeform.js",
  "./src/interchange/json.js",
  "./src/interchange/program-file.js",
  "./src/interchange/program-text.js",
  "./src/interchange/setup-link.js",
  "./src/interchange/transfer-contract.js",
  "./src/interchange/unsupported-grammar.js",
  "./src/persistence/durable.js",
  "./src/persistence/preferences.js",
  "./src/persistence/setup-draft.js",
  "./src/persistence/snapshot.js",
  "./src/platform/catalog.js",
  "./src/platform/files.js",
  "./src/platform/i18n.js",
  "./src/platform/install-transfer.js",
  "./src/platform/install.js",
  "./src/platform/motion.js",
  "./src/platform/notifications.js",
  "./src/platform/optional-script.js",
  "./src/platform/posthog.js",
  "./src/platform/program-executor.js",
  "./src/platform/program-worker.js",
  "./src/platform/telemetry.js",
  "./src/platform/transfer-device.js",
  "./src/release/gate.js",
  "./src/training/authoring.js",
  "./src/training/authoring/internal/adapter.js",
  "./src/training/authoring/internal/editor-contracts.js",
  "./src/training/authoring/internal/editor-document.js",
  "./src/training/authoring/internal/entry-contracts.js",
  "./src/training/authoring/internal/entry.js",
  "./src/training/authoring/internal/installed.js",
  "./src/training/authoring/internal/review-contracts.js",
  "./src/training/authoring/internal/review.js",
  "./src/training/authoring/internal/suggestion.js",
  "./src/training/generation.js",
  "./src/training/generation/internal/candidate-contracts.js",
  "./src/training/generation/internal/candidates.js",
  "./src/training/generation/internal/compiler-contracts.js",
  "./src/training/generation/internal/compiler.js",
  "./src/training/generation/internal/layout-contracts.js",
  "./src/training/generation/internal/layout.js",
  "./src/training/generation/internal/policy-contracts.js",
  "./src/training/generation/internal/policy.js",
  "./src/training/generation/internal/transition-contracts.js",
  "./src/training/generation/internal/transition.js",
  "./src/training/identity.js",
  "./src/training/metrics.js",
  "./src/training/model.js",
  "./src/training/model/internal/contracts.js",
  "./src/training/model/internal/names.js",
  "./src/training/model/internal/program.js",
  "./src/training/model/internal/values.js",
  "./src/training/progress.js",
  "./src/training/progress/internal/contracts.js",
  "./src/training/progress/internal/engine-contracts.js",
  "./src/training/progress/internal/evidence.js",
  "./src/training/progress/internal/health.js",
  "./src/training/progress/internal/personal-records.js",
  "./src/training/progress/internal/progression.js",
  "./src/training/progress/internal/schedule.js",
  "./src/training/progress/internal/session-outcome.js",
  "./src/training/progress/internal/summary.js",
  "./src/training/workout.js",
  "./src/ui/editors.js",
  "./src/ui/editors/contracts.js",
  "./src/ui/editors/program.js",
  "./src/ui/editors/review-contracts.js",
  "./src/ui/editors/review.js",
  "./src/ui/entry/answer-controls.js",
  "./src/ui/entry/answer-fields.js",
  "./src/ui/entry/controller.js",
  "./src/ui/entry/import/review.js",
  "./src/ui/entry/landing/artwork.js",
  "./src/ui/entry/landing/controller.js",
  "./src/ui/entry/landing/proof.js",
  "./src/ui/entry/landing/view.js",
  "./src/ui/entry/pickers.js",
  "./src/ui/entry/questions.js",
  "./src/ui/entry/view.js",
  "./src/ui/exercise-labels.js",
  "./src/ui/exercise-media.js",
  "./src/ui/focus/bindings.js",
  "./src/ui/focus/control-focus.js",
  "./src/ui/focus/controller.js",
  "./src/ui/focus/cue.js",
  "./src/ui/focus/dom.js",
  "./src/ui/focus/effects.js",
  "./src/ui/focus/effort.js",
  "./src/ui/focus/exercise-actions.js",
  "./src/ui/focus/format.js",
  "./src/ui/focus/geometry.js",
  "./src/ui/focus/gestures.js",
  "./src/ui/focus/inputs.js",
  "./src/ui/focus/ledger.js",
  "./src/ui/focus/navigation.js",
  "./src/ui/focus/prescription.js",
  "./src/ui/focus/presentation.js",
  "./src/ui/focus/rest-sheet.js",
  "./src/ui/focus/rest-slot.js",
  "./src/ui/focus/rest-view.js",
  "./src/ui/focus/rest.js",
  "./src/ui/focus/select.js",
  "./src/ui/focus/shelf.js",
  "./src/ui/focus/state.js",
  "./src/ui/focus/values.js",
  "./src/ui/focus/view.js",
  "./src/ui/focus/why-model.js",
  "./src/ui/focus/why.js",
  "./src/ui/focus/workout.js",
  "./src/ui/format.js",
  "./src/ui/history/controller.js",
  "./src/ui/history/fields.js",
  "./src/ui/history/view.js",
  "./src/ui/library/controller.js",
  "./src/ui/library/search.js",
  "./src/ui/metrics.js",
  "./src/ui/program/controller.js",
  "./src/ui/program/installed-editor.js",
  "./src/ui/program/sharing.js",
  "./src/ui/progress/controller.js",
  "./src/ui/progress/evidence.js",
  "./src/ui/progress/exercise-chart.js",
  "./src/ui/progress/exercise-trend.js",
  "./src/ui/progress/exercise.js",
  "./src/ui/progress/overview.js",
  "./src/ui/progress/review.js",
  "./src/ui/session-summary.js",
  "./src/ui/settings/appearance.js",
  "./src/ui/settings/backup.js",
  "./src/ui/settings/guide-registry.js",
  "./src/ui/settings/guides.js",
  "./src/ui/settings/install.js",
  "./src/ui/settings/notifications.js",
  "./src/ui/settings/view.js",
  "./src/ui/shell.js",
  "./src/ui/shell/sheet-gestures.js",
  "./src/ui/storage-recovery.js",
  "./src/ui/today/controller.js",
  "./src/ui/today/view.js",
  "./src/ui/workout/recovery.js",
  "./src/ui/workout/reminder.js",
  "./src/ui/workout/session-sheet.js",
  "./src/ui/workout/summary.js",
  // END GENERATED NATIVE SOURCE ASSETS
  "./", "./index.html", "./styles.css", "./motion-polish.css", "./manifest.webmanifest",
  { url: "./vendor/motion/motion.js", owner: "RepForgeMotion", required: false, immutable: true },
  { url: "./vendor/dnd-kit/dnd-kit.js", owner: "RepForgeDndRuntime", required: false },
  { url: "./vendor/dnd-kit/dnd-kit.runtime.js", owner: "RepForgeDndRuntime", required: false, immutable: true },
  { url: "./posthog-config.js", owner: "RepForgeTelemetry", required: false },
  "./i18n.js", "./exercises.js", "./assets/exercise-catalog.json?v=067", "./app.js", "./app.js?v=486",
  "./icons/icon.svg", "./icons/favicon-32.png", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/icon-1024.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./assets/brand/mark.png", "./assets/brand/wt-focus-en-dark.webp", "./assets/brand/wt-focus-pt-dark.webp",
  "./assets/brand/wt-rest-en-dark.webp", "./assets/brand/wt-actions-en-dark.webp", "./assets/brand/wt-note-en-dark.webp",
  "./assets/brand/wt-rest-pt-dark.webp", "./assets/brand/wt-actions-pt-dark.webp", "./assets/brand/wt-note-pt-dark.webp",
  "./assets/brand/paste-review-en-light.webp", "./assets/brand/paste-review-en-dark.webp", "./assets/brand/paste-review-pt-light.webp",
  "./assets/brand/paste-review-pt-dark.webp", "./assets/brand/exercise-chart-en-light.webp", "./assets/brand/exercise-chart-en-dark.webp",
  "./assets/brand/exercise-chart-pt-light.webp", "./assets/brand/exercise-chart-pt-dark.webp",
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

const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
function shellPathname(pathname) {
  if (!SCOPE_PATH) return pathname;
  return pathname === SCOPE_PATH ? "/" :
    pathname.startsWith(`${SCOPE_PATH}/`) ? pathname.slice(SCOPE_PATH.length) : pathname;
}

// ASSETS is the one release/cache inventory. Plain URLs are required and
// network-first; optional runtimes carry their owner and cache policy inline.
const RELEASE_ASSETS = ASSETS.map(entry => {
  const asset = typeof entry === "string" ? { url: entry } : entry;
  const resolved = new URL(asset.url, self.registration.scope);
  return {
    ...asset,
    required: asset.required !== false,
    immutable: asset.immutable === true,
    resolved,
    path: shellPathname(resolved.pathname),
    search: resolved.search,
  };
});
const APP_SHELL_PATHS = new Set(RELEASE_ASSETS
  .filter(asset => asset.path === "/" || /\.(?:html?|css|m?js|webmanifest)$/i.test(asset.path))
  .map(asset => asset.path));

function releaseAssetForRequest(url) {
  const path = shellPathname(url.pathname);
  const exact = RELEASE_ASSETS.find(asset => asset.path === path && asset.search === url.search);
  if (exact) return exact;
  return RELEASE_ASSETS.find(asset => asset.path === path && !asset.search && asset.required === false) || null;
}

function expectedCodeType(path) {
  if (/\.css$/i.test(path)) return ["text/css"];
  if (/\.(?:m?js)$/i.test(path)) return ["application/javascript", "text/javascript", "application/ecmascript", "text/ecmascript", "application/x-javascript"];
  return null;
}

function validCodeResponse(path, response) {
  if (!response?.ok || response.type === "opaque") return false;
  const acceptedTypes = expectedCodeType(path);
  if (!acceptedTypes) return false;
  const type = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  return acceptedTypes.includes(type);
}

function unavailableCodeResponse() {
  return new Response("Code asset unavailable", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/* A host may answer a release URL with a redirect: the production domain sends `/index.html` to `/` (#304). The
   precache fetch follows it, and the stored copy keeps the `redirected` flag, which Chrome refuses as the answer to a
   navigation (its redirect mode is `manual`), so serving it turned an installed launch into ERR_FAILED. Store and serve
   the same bytes without the flag. */
async function withoutRedirect(response) {
  if (!response?.redirected) return response;
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function installReleaseAssets() {
  const cache = await caches.open(CACHE);
  const failures = await Promise.all(RELEASE_ASSETS.map(async asset => {
    try {
      const response = await fetch(asset.resolved.href, { cache: "reload" });
      if (!response.ok || response.type === "opaque" ||
          (expectedCodeType(asset.path) && !validCodeResponse(asset.path, response))) {
        throw new Error(`Invalid release asset response: ${asset.url}`);
      }
      await cache.put(asset.resolved.href, await withoutRedirect(response));
      return null;
    } catch (error) {
      return asset.required ? error : null;
    }
  }));
  const failure = failures.find(Boolean);
  if (failure) {
    await caches.delete(CACHE);
    throw failure;
  }
}

self.addEventListener("install", event => {
  event.waitUntil(installReleaseAssets());
});

self.addEventListener("activate", event => {
  // Natural activation means the previous worker has no controlled clients.
  // Keep unrelated origin caches; do not take over an open session.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key !== CACHE && /^repforge-(?:v\d+|release-)/.test(key))
    .map(key => caches.delete(key)))));
});
self.addEventListener("message", event => {
  if(event.data?.type === "taurifer-release-query")
    event.ports[0]?.postMessage({type:"taurifer-release",id:SOURCE_RELEASE});
});

// The install-transfer Worker answers the origin-root `/v1/` endpoints on the app's own host; no cached copy,
// shell, or offline fallback may stand in for it.
const TRANSFER_ORIGIN = new URL(self.registration.scope).origin;

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin === TRANSFER_ORIGIN && url.pathname.startsWith("/v1/")) return;
  const path = shellPathname(url.pathname);
  const codeTypes = expectedCodeType(path);

  if (codeTypes) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const asset = releaseAssetForRequest(url);
      const cachedResponse = async () => {
        let cached = await cache.match(event.request);
        if (!cached && asset?.required === false) {
          cached = await cache.match(event.request, { ignoreSearch: true });
        }
        return validCodeResponse(path, cached) ? cached : null;
      };

      if (asset?.immutable) {
        const cached = await cachedResponse();
        if (cached) return cached;
      }
      try {
        const response = await fetch(event.request);
        if (validCodeResponse(path, response)) {
          if (asset) await cache.put(event.request, response.clone());
          return response;
        }
      } catch {}
      return (await cachedResponse()) || unavailableCodeResponse();
    })());
    return;
  }

  const isShell = event.request.mode === "navigate" || APP_SHELL_PATHS.has(path);
  if (isShell) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        // A navigation's redirect comes back opaque; hand it to the browser, which follows it (to `/` for the
        // production host's `/index.html`) and asks the worker again for the destination.
        if (response.type === "opaqueredirect") return response;
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, await withoutRedirect(response.clone()));
          return response;
        }
      } catch {}
      const cached = (await caches.match(event.request)) || (await caches.match("./")) || (await caches.match("./index.html"));
      return (await withoutRedirect(cached)) ||
        new Response("Document unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return new Response("Asset unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
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
