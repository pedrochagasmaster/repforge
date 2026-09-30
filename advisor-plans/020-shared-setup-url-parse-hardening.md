# Plan 020: Setup-link URL helpers fail closed on an unparseable URL instead of throwing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- shared-setup.js test/shared-setup-unit.mjs`, plus `grep -n "removeSetupFragment\|handoffCookiePath" app.js`

## Status

- **Priority**: P3 (defensive; production reachability is very low)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (plan 001 touches the same `app.js` region; land them separately)
- **Category**: bug (hardening)
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Later**: the "Small correctness hardening" row in §6 (Q613).

## Why this matters

`shared-setup.js` is the setup-link codec. `readSetupFragment` guards `new URL(href)` with `try/catch → null`, but its siblings `removeSetupFragment` and `handoffCookiePath` do not, so they throw on an unparseable URL. In the browser the default input is `location.href`, which is always valid, so this is hardening rather than a live bug. It matters for two reasons. First, the helpers are public API (`RepForgeSharedSetup`) used with caller-supplied values in tests and adapters. Second, `handoffCookiePath` decides a cookie `Path`. Its only safe failure mode is "don't set the cookie". A future "fallback to `/`" would silently widen the setup cookie to the whole origin, and that must never be the fallback.

## Current state

`shared-setup.js` (at `ff9991cf`):

```js
  // :1546-1554
  function readSetupFragment(url) {
    const href = resolveHref(url);
    let parsed;
    try { parsed = new URL(href); } catch { return null; }
    …
  }
  // :1556-1563
  function removeSetupFragment(url) {
    const href = resolveHref(url);
    const parsed = new URL(href);
    const params = new URLSearchParams(parsed.hash ? parsed.hash.slice(1) : "");
    params.delete("setup");
    const nextHash = params.toString();
    return `${parsed.pathname}${parsed.search}${nextHash ? `#${nextHash}` : ""}`;
  }
  // :1565-1570
  function handoffCookiePath(locationLike) {
    const href = typeof locationLike === "string"
      ? locationLike
      : (locationLike && locationLike.href) || resolveHref();
    return new URL("index.html", href).pathname;
  }
  // :1586-1594 writeHandoffCookie(value, adapters): … const path = handoffCookiePath(loc); doc.cookie = `${COOKIE_NAME}=${value}; Path=${path}; …`; return true;
  // :1611-1618 clearHandoffCookie(adapters): … const path = handoffCookiePath(loc); doc.cookie = `${COOKIE_NAME}=; Path=${path}; Max-Age=0; …`; return true;
```

`app.js` callers (at `ff9991cf`):

```js
// app.js:16031-16035 (already inside try/catch)
      staged=SharedSetup.writeHandoffCookie(encoded)===true;
      if(staged&&location.pathname===SharedSetup.handoffCookiePath())
// app.js:16041 (not wrapped)
    if(source==="cookie"||staged||matchingCookie)SharedSetup.clearHandoffCookie();
// app.js:16045-16047 (not wrapped)
  if(source==="fragment"&&staged){
    const next=SharedSetup.removeSetupFragment();
    history.replaceState({},"",next)}
```

Existing tests: `test/shared-setup-unit.mjs:735-768` (fast lane) cover `removeSetupFragment` and `handoffCookiePath` happy paths using a `loc(...)` helper. ADR 0007 fixes the cookie attributes: `index.html` path, seven days, `SameSite=Lax`, and `Secure` outside localhost.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit | `node test/shared-setup-unit.mjs` | exit 0 |
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| Browser flow | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)`, then `node tools/run-tests.mjs entry --suite shared-setup-flow` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `shared-setup.js` (`removeSetupFragment`, `handoffCookiePath`, `writeHandoffCookie`, `clearHandoffCookie`); `app.js` (one guard at the `removeSetupFragment` call); `test/shared-setup-unit.mjs`; the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.
**Out of scope:** the codec (`encode`/`decode`/`validate`), cookie attributes, and `readSetupFragment`.

## Git workflow

Branch `advisor/020-setup-url-hardening`; commits `test(share): cover unparseable URLs in setup helpers`, `fix(share): fail closed when setup URLs cannot be parsed`, and `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Failing unit cases

In `test/shared-setup-unit.mjs`, next to the existing `removeSetupFragment` and `handoffCookiePath` cases and using its assert style, add:
- `Setup.removeSetupFragment("not a url") === null`
- `Setup.handoffCookiePath("not a url") === null`
- `writeHandoffCookie(<a valid envelope from the file's fixtures>, { document: fakeDoc, location: { href: "not a url", hostname: "" } })` returns `false`, **and** `fakeDoc.cookie` is untouched (still `""`)
- the same for `clearHandoffCookie`

Check how the file builds adapters (`adapterDocument`/`adapterLocation` expect specific property names) and mirror it.

**Verify**: `node test/shared-setup-unit.mjs` → the new cases fail (they throw).

### Step 2: Fail closed in `shared-setup.js`

- `removeSetupFragment`: `let parsed; try { parsed = new URL(href); } catch { return null; }`
- `handoffCookiePath`: wrap it as `try { return new URL("index.html", href).pathname; } catch { return null; }`
- `writeHandoffCookie` and `clearHandoffCookie`: right after computing `path`, add `if (!path) return false;`

**Verify**: `node test/shared-setup-unit.mjs` → exit 0, including the existing path cases.

### Step 3: Guard the caller

In `app.js`: `const next=SharedSetup.removeSetupFragment();if(next!=null)history.replaceState({},"",next)}`. The `handoffCookiePath()` comparison at `16033` needs no change, because `null` never equals `location.pathname`.

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. `node tools/run-tests.mjs entry --suite shared-setup-flow` → exit 0.

### Step 4: Cache ritual

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` and `node tools/run-tests.mjs fast` → exit 0.

## Test plan

Four new unit cases (two return `null`, two cookie writers refuse without touching `document.cookie`). The existing unit and browser setup-link suites stay green.

## Done criteria

- [ ] `grep -c "catch { return null; }" shared-setup.js` → at least `3`
- [ ] `grep -c "if (!path) return false;" shared-setup.js` → `2`
- [ ] `node test/shared-setup-unit.mjs` and the `shared-setup-flow` suite exit 0
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- Any existing test expects these helpers to throw.
- The generative suite (`node test/generative/run.mjs`) fails on setup-link properties. It exercises `shared-setup.js` through `test/generative/adapters/domain-adapter.mjs`.

## Maintenance notes

- Never give `handoffCookiePath` a fallback path. Refusing to set the cookie is the only safe failure (ADR 0007 scopes it to `index.html`).
