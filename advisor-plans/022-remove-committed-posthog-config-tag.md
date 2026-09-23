# Plan 022: The committed `index.html` stops loading a deploy-generated `posthog-config.js`, and a fast-lane guard keeps it out

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git show HEAD:index.html | grep -n 'posthog-config.js?v='`
> If it prints nothing, someone has already removed the tag. Do only Step 2 (the guard).

## Status

- **Priority**: P1 (small, recent regression on the branch being prepared for merge)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none; complements plan 002
- **Category**: bug
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: none needed. This reverts an accidental artifact. Coordinate with the owner of open draft PR #248 (Plan 057), whose branch introduced it.

## Why this matters

`scripts/generate-posthog-config.mjs` is a **deploy-time** step: Cloudflare Pages and CI previews run it. It writes the gitignored `posthog-config.js` and injects `<script src="posthog-config.js?v=<revision>">` into `index.html`, using `v=local` when no revision env is set. Commit `ffe4f105` ("chore(plan057): advance cached shell revision", 2026-09-22) accidentally committed that injected line with `?v=local`. On GitHub Pages, which is the documented hosting and does not run the generator, every boot now requests a file that does not exist: a 404 plus a console error. The service worker's shell handler then caches that 404, because `posthog-config.js` is in `SHELL` and the handler stores any status (plan 002 fixes that separately). On Cloudflare the generator strips and re-injects the tag, so production analytics are unaffected. Nothing prevents this from recurring: `tools/run-tests.mjs` snapshots and restores `index.html` around its own preview, so only a *manual* generator run leaks, and no test checks for it.

## Current state

- `index.html` at `ff9991cf`, lines 1168-1170:

```html
  <script src="telemetry.js"></script>
  <script src="posthog-config.js?v=local"></script>
  <script src="posthog-init.js"></script>
```

  At `90de1bd8` (before `ffe4f105`), `index.html` contained no `posthog-config` reference (`grep -c` = 0).
- `scripts/generate-posthog-config.mjs:5-6,47-53`:

```js
const POSTHOG_INIT_TAG = '  <script src="posthog-init.js"></script>';
const GENERATED_TAG_PATTERN = /^\s*<script src="posthog-config\.js\?v=[^"]+"><\/script>\r?\n/m;
…
let html = readFileSync(INDEX_PATH, "utf8").replace(GENERATED_TAG_PATTERN, "");
…
html = html.replace(POSTHOG_INIT_TAG, `${configTag}\n${POSTHOG_INIT_TAG}`);
```

- `.gitignore:5` lists `posthog-config.js`.
- `tools/run-tests.mjs:14`: `const PREVIEW_GENERATED_FILES = ["index.html", "posthog-config.js"];` (snapshot and restore around the preview).
- `test/simulation.mjs:33` treats `/posthog-config.js` as an optional deployment asset, so its absence is supported.
- `test/posthog-config.mjs` (fast lane, `node:assert/strict`) tests the generator in a temp dir. The new guard goes there.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Guard test | `node test/posthog-config.mjs` | exit 0 |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |
| Boot check (optional) | `node tools/run-tests.mjs workout --suite simulation` | exit 0 |

## Scope

**In scope:** `index.html` (delete the one line); `test/posthog-config.mjs` (add a guard).
**Out of scope:** `sw.js` `SHELL` (keeping `/posthog-config.js` there is correct for Cloudflare deploys) and the generator. **No cache bump is needed.** `index.html` is not `?v=`-revisioned, its shell handler is network-first, and removing a tag changes no cached module's schema. If `node test/exercise-library.mjs` disagrees, STOP.

## Git workflow

Branch `advisor/022-posthog-tag` (or, if the owner prefers, a commit on the PR #248 branch; ask). Commits: `fix(shell): drop the deploy-generated posthog-config tag`, and `test(posthog): forbid committing the generated config tag`. Do not push without operator approval.

## Steps

### Step 1: Remove the line

Delete exactly `  <script src="posthog-config.js?v=local"></script>` from `index.html`.

**Verify**: `grep -c 'posthog-config.js' index.html` → `0`. `node test/exercise-library.mjs` → exit 0.

### Step 2: Add the guard

Append to `test/posthog-config.mjs`:

```js
{
  // The generator injects this tag at deploy time only; the committed shell must not carry it.
  const committed = readFileSync(resolve(root, "index.html"), "utf8");
  assert.doesNotMatch(committed, /<script src="posthog-config\.js\?v=/, "index.html must not contain the deploy-generated posthog-config tag");
}
```

**Verify**: `node test/posthog-config.mjs` → exit 0. As a negative control, temporarily re-add the line and confirm the test fails, then remove it again. `node tools/run-tests.mjs fast` → exit 0.

## Test plan

A guard in `test/posthog-config.mjs`, plus a negative control. Existing generator tests are unchanged.

## Done criteria

- [ ] `grep -c 'posthog-config.js' index.html` → `0`
- [ ] `node test/posthog-config.mjs` exits 0, and the guard's negative control was observed failing
- [ ] `git diff --stat` shows only `index.html` and `test/posthog-config.mjs`
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- The owner says the committed tag is intentional (for example, a new hosting setup that serves a committed `posthog-config.js`). Then the real bug is the missing file; report it instead.
- The fast lane fails in a suite that expects the tag in `index.html`.

## Maintenance notes

- Local analytics testing should use `node tools/run-tests.mjs` (it restores `index.html`) or discard the generator's `index.html` edit before committing.
