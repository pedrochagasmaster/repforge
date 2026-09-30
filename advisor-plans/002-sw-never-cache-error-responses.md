# Plan 002: The service worker never stores an error response over a good cached asset

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- sw.js test/suites.mjs docs/ci.md`
> If `sw.js` changed beyond the `CACHE`/`?v=` revision numbers, compare the
> "Current state" excerpt against the live file; on a structural mismatch,
> STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Now**: the "Alpha data-safety fixes" row, item (3); standalone PR (owner decisions Q604, Q609).

## Why this matters

Taurifer is an offline-first PWA, and a lifter logs sets in a gym that often has no signal. `sw.js` caches responses in three places without checking that the response succeeded. The shell handler is network-first: every online load of `app.js`, `index.html`, `styles.css` and so on writes whatever the network returned into the cache. A transient `404`/`5xx` therefore replaces the good cached copy. That happens during a GitHub Pages or Cloudflare deploy window, or at a captive portal. The next offline launch then serves that error, and the app does not boot until a later online load repairs it. The fix: store only successful responses, and when the network returns an error for a shell asset, serve the cached copy.

(Rejected alternative, recorded so nobody re-audits it: making the Motion/@dnd-kit precache best-effort. The atomic precache is deliberate and test-enforced. `test/vendor-runtimes.mjs:76` asserts "the runtime and layer are atomically precached", and the design goal is identical behavior offline. Do not change `ASSETS` or `addAll`.)

## Current state

`sw.js` (124 lines). The relevant parts at `ff9991cf`:

```js
// install: atomic precache — DO NOT CHANGE
caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())

// fetch, branch 1: pinned runtimes (cache-first)
if (IMMUTABLE_RUNTIMES.has(path)) {
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());   // <-- stores any status
      return response;
    } catch {
      return new Response("", { status: 503, statusText: "Runtime unavailable" });
    }
  })());
  return;
}
// fetch, branch 2: shell (network-first)
if (isShell) {
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());   // <-- overwrites good copy with 404/5xx
      return response;
    } catch {
      return (await caches.match(event.request)) || (await caches.match("./index.html"));
    }
  })());
  return;
}
// fetch, branch 3: everything else (cache-first)
event.respondWith((async () => {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  try {
    const response = await fetch(event.request);
    const cache = await caches.open(CACHE);
    await cache.put(event.request, response.clone());     // <-- stores any status
    return response;
  } catch {
    return await caches.match("./index.html");
  }
})());
```

`SHELL` includes `/posthog-config.js`. On GitHub Pages that file does not exist, because it is gitignored and generated only on Cloudflare, so today its `404` is cached on every boot.

Existing test pattern to copy: `test/sw-upgrade.mjs`. It runs its own `node:http` server rooted at the repo with a switchable `mode` variable, launches Chromium via `launchChromium`/`waitForAppBoot` from `test/browser.mjs`, waits on `caches.has(...)`, and uses plain `node:assert/strict`. Test registration: every runnable test must appear in `test/suites.mjs` (`s("test/<file>.mjs")` inside the right lane), or `node tools/run-tests.mjs --check` fails.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| One-time setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Syntax | `node --check sw.js && node tools/check-production-syntax.mjs` | exit 0 |
| Inventory | `node tools/run-tests.mjs --check` | exit 0 |
| New test | `node test/sw-error-responses.mjs` | exit 0, prints its summary line |
| Neighbours | `node tools/run-tests.mjs state --suite sw-upgrade` and `node test/vendor-runtimes.mjs` and `node test/runtime-budget.mjs` | exit 0 |
| Lane | `node tools/run-tests.mjs state` | exit 0 |

## Scope

**In scope:**
- `sw.js` (the fetch handler only)
- `test/sw-error-responses.mjs` (create)
- `test/suites.mjs` (register the new test in the `state` lane, next to `test/sw-upgrade.mjs`)
- `docs/ci.md` (update the "inventory currently contains N commands: … state (M)" counts)

**Out of scope:**
- `ASSETS`, `SHELL`, `IMMUTABLE_RUNTIMES`, the `install` and `activate` handlers, and the `notificationclick` handler.
- The `CACHE` constant and `?v=` revisions. `sw.js` is not itself in `ASSETS`, so no revision bump is needed. The browser re-installs a byte-changed worker.
- `index.html` (see Plan 022 for the committed `posthog-config.js?v=local` tag).

## Git workflow

- Branch: `advisor/002-sw-error-responses`
- Commits: for example `fix(sw): never cache error responses over good shell copies`, then `test(sw): prove error responses stay out of the cache`.
- Do not push.

## Steps

### Step 1: Write the failing test first

Create `test/sw-error-responses.mjs`, copying the server and boot skeleton from `test/sw-upgrade.mjs`. Serve the **current** `sw.js`; there is no old-worker fixture. Add a module-level `let failPath = null; let failStatus = 404;`. In the request handler, if the query-stripped `pathname === failPath`, respond `failStatus` with body `"fail"`; otherwise serve files as `sw-upgrade.mjs` does.

Flow:
1. `page.goto(base)`, `waitForAppBoot`, wait for `navigator.serviceWorker.controller` (reload once if needed, as `sw-upgrade.mjs` does) and for `caches.has(<CACHE>)`. Read the `CACHE` name from `sw.js` with the same regex `sw-upgrade.mjs` uses.
2. **Shell case:** set `failPath = "/styles.css"`. In the page, `await fetch("styles.css").then(r => r.status)`. Then read `(await (await caches.open(CACHE)).match("styles.css"))?.status`.
   Assert: the page fetch returns `200` (the cached copy is served), **and** the cached entry is still status `200`.
3. **Catch-all case:** set `failPath = "/does-not-exist.png"`. `fetch("does-not-exist.png")` must resolve (any status), and afterwards `caches.match("does-not-exist.png")` must be `undefined`.
4. **Runtime case:** in the page, delete `vendor/dnd-kit/dnd-kit.runtime.js` from the cache. Set `failPath = "/vendor/dnd-kit/dnd-kit.runtime.js"` and `failStatus = 503`, then fetch it and assert the response status is `503` and `caches.match(...)` is `undefined`. Then set `failPath = null`, fetch again, and assert `200` and that it is now cached.
5. Print `console.log("sw error responses: shell keeps good copy, catch-all and runtime skip non-ok")`.

Register it in `test/suites.mjs` under `state:` right after `s("test/sw-upgrade.mjs"),`, then bump the `state` count and the total in `docs/ci.md`.

**Verify**: `node tools/run-tests.mjs --check` → exit 0. `node test/sw-error-responses.mjs` → **fails** on the shell case (the cached `styles.css` is now 404) and the catch-all case. That failure proves the bug.

### Step 2: Guard every `cache.put`

In `sw.js`:
- Branch 1 (runtimes) and branch 3 (catch-all): wrap the `put` as `if (response.ok) await cache.put(event.request, response.clone());`.
- Branch 2 (shell): after `const response = await fetch(event.request);` add

```js
if (!response.ok) return (await caches.match(event.request)) || response;
```

and leave the existing `cache.put` for the ok path.

Do not change anything else. Keep the file's existing style: 2-space indent, double quotes, arrow functions.

**Verify**: `node --check sw.js` → exit 0. `node test/sw-error-responses.mjs` → exit 0 with the summary line.

### Step 3: Regression neighbours

**Verify**: `node test/vendor-runtimes.mjs` → exit 0. `node test/runtime-budget.mjs` → exit 0 (it regex-matches `if (IMMUTABLE_RUNTIMES.has(path))[\s\S]{0,240}caches.match(event.request)`; keep that distance under 240 characters). `node tools/run-tests.mjs state` → exit 0.

## Test plan

- New `test/sw-error-responses.mjs` with three cases: shell keeps its good copy and serves it on a network 404, catch-all does not store a 404, and a runtime 503 is not stored while a later 200 is.
- Existing `sw-upgrade`, `install-transfer-sw-upgrade`, `workout-draft-sw-upgrade`, `vendor-runtimes`, and `runtime-budget` stay green.

## Done criteria

- [ ] `grep -c "if (response.ok) await cache.put" sw.js` → `2`
- [ ] `grep -c "if (!response.ok) return (await caches.match(event.request)) || response;" sw.js` → `1`
- [ ] `node tools/run-tests.mjs --check` exits 0
- [ ] `node tools/run-tests.mjs state` exits 0
- [ ] `git diff --stat` touches only `sw.js`, `test/sw-error-responses.mjs`, `test/suites.mjs`, and `docs/ci.md`
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- `test/runtime-budget.mjs` or `test/vendor-runtimes.mjs` fails and the only fix would touch `ASSETS`/`IMMUTABLE_RUNTIMES`.
- Chromium cannot register the worker on the test's loopback origin. Report it; do not switch to a fixed port, because `docs/ci.md` forbids private fixed-port servers.
- Step 1's test passes before Step 2. The bug may already be fixed; report it.

## Maintenance notes

- Any future `cache.put` added to `sw.js` must keep the `response.ok` guard.
- The shell branch's "serve cached on error" behavior means a deliberately removed shell file keeps being served from cache until the next `CACHE` bump. That is consistent with how the cache ritual already works.
