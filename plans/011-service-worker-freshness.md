# Plan 011: Service-worker freshness for the app shell

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- sw.js`
> On any change to `sw.js`, compare the "Current state" excerpt against live
> code; mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED (SW caching is easy to get subtly wrong; test offline too)
- **Depends on**: none
- **Category**: correctness / dx
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: **Audit finding.** Grounds the `AGENTS.md` "stale cached copies"
  gotcha — the SW serves stale `app.js`/`index.html`/`styles.css` after a
  deploy until the cache name is manually bumped.

## Why this matters

`sw.js` is **cache-first for everything** (`caches.match(...) || fetch(...)`).
For the app shell (`index.html`, `app.js`, `styles.css`) that means a returning
user keeps running the old code after a GitHub Pages deploy until someone
remembers to bump `CACHE` (currently `repforge-v6`, `sw.js:1`). The project's
own `AGENTS.md` documents this as a "gotcha" requiring a hard reload — that's a
bug users hit, not just developers. A **network-first (fallback to cache)**
strategy for the shell keeps full offline capability while delivering fresh code
when the network is available.

## Current state

- `sw.js` (whole file, 29 lines). Fetch handler (`sw.js:20-28`):

  ```js
  self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match("./index.html")))
    );
  });
  ```

- `CACHE="repforge-v6"` (`sw.js:1`); `ASSETS` precache list (`sw.js:2-8`)
  includes the shell + fonts. `activate` deletes old caches (`sw.js:15-18`).
- App registers the SW in `init()` (`app.js:474`).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check sw.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (only `sw.js`):
- Adopt **network-first for navigations + the shell assets** (`index.html`,
  `app.js`, `styles.css`, `manifest.webmanifest`), falling back to cache when
  offline; keep **cache-first for fonts** (immutable, big).
- Bump `CACHE` to `repforge-v7` so the new SW installs cleanly.

**Out of scope** (do NOT touch):
- `app.js` registration logic, update prompts, or a "new version available"
  toast (nice, but separate).
- Precaching more assets.

## Git workflow

- Branch: `advisor/011-sw-freshness`
- Single commit is fine. Do NOT push/PR unless asked.

## Steps

### Step 1: Network-first for the shell, cache-first for fonts

Replace the fetch handler (`sw.js:20-28`) with:

```js
const SHELL = new Set(["/", "/index.html", "/app.js", "/styles.css", "/manifest.webmanifest"]);
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isShell = event.request.mode === "navigate" ||
    SHELL.has(url.pathname) || SHELL.has(url.pathname.replace(/\/$/, "/index.html"));
  if (isShell) {
    // network-first: fresh code when online, cached shell when offline
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match("./index.html")))
    );
    return;
  }
  // cache-first for everything else (fonts, icon)
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
```

Bump `sw.js:1`: `const CACHE = "repforge-v7";`

**Verify**: `node --check sw.js` → 0.

### Step 2: Manual freshness + offline verification

With the server running:
1. Load `http://localhost:8000/`, confirm the SW activates (DevTools →
   Application → Service Workers shows `repforge-v7` activated).
2. Edit a visible string in `index.html` (e.g. the `<title>`), reload **once**
   (no hard reload) → the change appears (network-first served fresh).
3. Revert the edit. Then go offline (DevTools → Network → Offline) and reload →
   the app still loads from cache (offline fallback works).

**Verify**: fresh-on-normal-reload AND offline-still-loads both hold. Revert the
temporary title edit before committing.

### Step 3: Simulation still green

The simulation loads the app over HTTP each run; network-first shouldn't affect
it. Run it to be sure. If the harness relies on SW registration timing, it
already tolerates `catch(()=>{})` in `app.js:474`.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check sw.js`.
- Manual: normal reload shows edited shell (fresh); offline reload still loads
  (cache fallback). This is the core of the fix — both must be demonstrated.
- Simulation: existing 61 stay green.

## Done criteria

- [ ] `node --check sw.js` exits 0
- [ ] Shell assets are served network-first (a normal reload picks up an edited
      `index.html`/`app.js` without a hard reload)
- [ ] App still loads fully offline (cache fallback)
- [ ] Fonts remain cache-first
- [ ] `CACHE` bumped to `repforge-v7`; old caches purged on activate
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] Only `sw.js` changed (plus the reverted test edit); `plans/README.md`
      status updated

## STOP conditions

- Drift: `sw.js` doesn't match the excerpt.
- If network-first causes a visible flash/regression on slow connections that
  the operator considers worse than staleness, consider stale-while-revalidate
  for the shell instead (serve cache immediately, fetch+update in background,
  and prompt reload). Note the trade-off; don't ship both.

## Maintenance notes

- Consider a follow-up "update available — reload" toast wired to
  `navigator.serviceWorker` `controllerchange` so users get fresh code without a
  manual reload. Kept out of scope here.
- After this lands, the `AGENTS.md` "hard-reload to see changes" note applies
  only to fonts/icon; update that doc in a docs-only change if desired.
