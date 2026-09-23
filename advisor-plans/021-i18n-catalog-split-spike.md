# Plan 021 (spike): Measure whether loading only the active language's catalog is worth it, before changing anything

> **Executor instructions**: This is a **measurement spike**. You will not
> change application code. Follow the steps, record the numbers, and apply
> the go/no-go rule. If anything in "STOP conditions" occurs, stop and report.
> When done, update the status row for this plan in `advisor-plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- i18n.js tools/build-i18n.mjs tools/i18n-runtime.js`

## Status

- **Priority**: P3
- **Effort**: S (spike); a later implementation would be M–L
- **Risk**: LOW (spike is read-only)
- **Depends on**: none (plan 011 changes `build-i18n.mjs --check` diagnostics; no conflict with a read-only spike)
- **Category**: perf (investigate)
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Evidence only**: the "Single-language i18n catalogs" row (Q608). Do not execute unless an English-first launch or measured boot-time complaints trigger it.

## Why this matters

`i18n.js` (≈285 KB raw / ≈74 KB gzip) always defines both the EN and PT dictionaries, and every device parses both. It is tempting to load only the active language. But three facts limit the win:

1. `t()` falls back to **EN** for any key missing in PT, so EN must always be present. Only PT is removable, and only on EN devices.
2. The product's primary market is **Brazil, PT-first** (`docs/business-product-thesis.md`), so most devices need both catalogs anyway.
3. `setLang` is synchronous and called mid-flow (for example, when a setup link switches language in `app.js` around line 16054). A lazy catalog would make it asynchronous and ripple through those flows.

So the question is empirical: on a throttled mid-range phone, how much boot time does parsing the PT half actually cost?

## Current state

- `tools/build-i18n.mjs` writes `i18n.js` as `const EN = {…}; const PT = {…};` followed by the runtime from `tools/i18n-runtime.js` (`const STRINGS = { en: EN, pt: PT };`, `setLang`, `t`).
- `index.html` loads `<script src="i18n.js"></script>` (not revisioned) before `app.js`. `sw.js` precaches it.
- `app.js` calls `I18N.setLang(...)` synchronously at `808`, `10316`, `15898`, `15991`, and `16054` (at `ff9991cf`).
- `test/browser.mjs` exports `launchChromium`/`waitForAppBoot`. Playwright can throttle the CPU via CDP (`const cdp = await context.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Serve | `python3 -m http.server 8000 --directory "$PWD" &` | serving |
| Spike script | `node /tmp/i18n-spike.mjs` (you write it; **outside the repo**) | prints the timings |

## Scope

**In scope:** a throwaway script at `/tmp/i18n-spike.mjs` (not committed), and this plan's row in `advisor-plans/README.md`.
**Out of scope:** every repo file. No code changes in this plan.

## Steps

### Step 1: Measure script evaluation cost under 4× CPU throttle

Write `/tmp/i18n-spike.mjs` that imports `playwright` from the repo's `test/node_modules` (use `createRequire` with `/<repo>/test/package.json`) and runs 10 iterations. For each iteration, on a fresh context with a 390×844 viewport and 4× CPU throttling:
- **A (EN+PT)**: `page.setContent('<script>…</script>')` with the full `i18n.js` text inlined, measuring `performance.now()` around the eval with `page.evaluate(src => { const t0 = performance.now(); (0, eval)(src); return performance.now() - t0; }, text)`.
- **B (EN only)**: the same, with the `const PT = {…};` block replaced by `const PT = {};`. Build that text in the script with a regex over the `const PT = {` … `\n};` block.

Report the median and p90 for A and B, and the difference.

**Verify**: 10 samples each; the numbers are printed.

### Step 2: Measure the share of real boot

On the served app with 4× throttling, record `performance.getEntriesByType("navigation")[0]` plus the time until `window.__repforgeBooted === true`, over 5 iterations.

**Verify**: median boot time printed.

### Step 3: Go / no-go

- **Go (write an implementation plan, don't implement)** if median(A) − median(B) ≥ **30 ms** **and** it is ≥ 5% of the median boot time. The follow-up plan must keep EN always loaded, precache both files, and handle the synchronous `setLang` callers.
- **No-go** otherwise. Mark this plan `REJECTED — PT parse cost <N> ms of <M> ms boot (4× throttle)`.

**Verify**: the decision is recorded with the numbers.

## Done criteria

- [ ] The medians and p90s for A and B, plus the boot median, are in the report
- [ ] `git status` is clean (no repo changes)
- [ ] The `advisor-plans/README.md` row is set to DONE (go, with a follow-up needed) or REJECTED (no-go), with numbers

## STOP conditions

- CPU throttling is unavailable in the pinned Chromium. Report it; do not substitute wall-clock numbers from an unthrottled run.

## Maintenance notes

- If the owner later makes EN-only devices a priority (for example, launching outside Brazil), rerun this spike first.
