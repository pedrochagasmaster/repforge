# Plan 012: Dynamic i18n lookups fall back to readable text instead of leaking a raw key

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- app.js i18n.js tools/i18n-runtime.js`
> Re-run the site-listing command in Step 1; the line numbers below are from `ff9991cf`.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (textual neighbour of 007, 008, 013, and 019 in `app.js`)
- **Category**: bug
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Later**: the "Small correctness hardening" row in §6 (Q613).

## Why this matters

`t(key)` never returns a falsy value. When a key is missing it returns **the key string itself**. So the idiom `t(\`entry.muscle.${muscle}\`)||muscle`, used about 15 times with *dynamically built* keys, can never reach its fallback. If a new muscle token, equipment token, movement, glossary term, or share-blocker reason code ships without catalog copy, the lifter sees text like `entry.muscle.adductors` or `program.share_setup_reason.undefined` instead of the intended readable fallback. The UI-screen catalog contract catches raw keys only on catalogued screens and states. The code's authors clearly meant these fallbacks to work, and two sites already use the correct "compare with the key" technique.

## Current state

- `i18n.js` is **generated** from `tools/i18n-runtime.js` (never hand-edit it). Its `t` (`i18n.js:4219-4231` at `ff9991cf`):

```js
  function t(key, vars) {
    const dict = STRINGS[lang] || STRINGS.en;
    let s = dict[key];
    if (s == null) s = STRINGS.en[key];
    if (s == null) {
      if (typeof key === "string") missingRequests.add(key);
      s = key;
    }
    ...
    return s;
  }
```

  The public API is `RepForgeI18n` = `{ STRINGS, detectLang, normalizeLang, setLang, getLang, t, tp, speechLang, applyDom }`. Missing keys are recorded in `missingRequests`, which `tools/ui-screens/catalog-contract.mjs:118` consumes via `window.__repforgeI18nMissingRequests.consume()` and reports as errors on catalogued screens.
- `app.js:782`: `const t=(k,v)=>I18N?I18N.t(k,v):k;`
- The correct technique, already in `app.js` (`13466`, `13472`): `const label=t(\`entry.muscle.${muscle}\`);return label===\`entry.muscle.${muscle}\`?muscle:label;`
- Dynamic-key sites using the unreachable `||` (from `grep` at `ff9991cf`): `802`, `1148`, `1149`, `1220` (glossary), `9588` (`onb.goal.*.label`), `10516` (`program.share_setup_reason.${blocker?.reasonCode}`), `13050` (`entry.equip.*`), `13052` (`entry.cap.*`), `13093`, `13100`, `13213` (`entry.muscle.*`), `13207`, `13215`, `13475` (`entry.movement.*`), `13940` (`entry.${stepId}.title`).
- Static-literal sites (`2336`, `3762`, `3838`, `10374`, `14805-14860`) also use `||"…"`. Their keys are verified to exist by `test/i18n.mjs`, so the fallback is dead but harmless. **Leave them alone.**

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Site list | `grep -noP '(?<![\w.$])t\((?:[^()]\|\((?:[^()]\|\([^()]*\))*\))*\)\s*\|\|' app.js` | the list above |
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| i18n | `node test/i18n.mjs` | exit 0 |
| Inventory | `node tools/run-tests.mjs --check` | exit 0 |
| Lanes | `node tools/run-tests.mjs workout` and `node tools/run-tests.mjs entry` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `app.js` (a new helper plus the dynamic-key sites); `test/i18n-fallback.mjs` (create); `test/suites.mjs`; `docs/ci.md` (counts); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.
**Out of scope:** `i18n.js`, `tools/i18n-runtime.js` (no runtime API change is needed), the static-literal sites, and the catalog contract.

## Git workflow

Branch `advisor/012-i18n-fallbacks`; commits `fix(i18n): make dynamic-key fallbacks reachable` and `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Add the helper

Directly below `app.js:782` (`const t=…`), add:

```js
/* An optional, dynamically built key: use the fallback without recording a missing-key request. */
const tOr=(k,fallback,v)=>{const S=I18N?.STRINGS,lang=I18N?.getLang?.();
  return S&&((S[lang]&&k in S[lang])||(S.en&&k in S.en))?t(k,v):fallback};
```

Checking with `in` before calling `t` means an intentionally optional key does not pollute `missingRequests`.

**Verify**: `node tools/check-production-syntax.mjs` → exit 0.

### Step 2: Convert the dynamic sites

Rewrite each listed site as `tOr(<same key expression>, <same fallback>)`. Examples:
- `t(\`entry.muscle.${muscle}\`)||muscle` → `tOr(\`entry.muscle.${muscle}\`,muscle)`
- `t(\`program.share_setup_reason.${blocker?.reasonCode}\`)||t("program.share_setup_reason.unknown")` → `tOr(\`program.share_setup_reason.${blocker?.reasonCode}\`,t("program.share_setup_reason.unknown"))`

At `1148-1149` (a chain of two `||`), preserve the order: `tOr(A,tOr(B,<last fallback>))`. Keep the exact fallback expressions. Also convert the two compare-with-key sites (`13466`, `13472`) to `tOr` for consistency.

**Verify**: re-run the site-list command → none of the dynamic lines remain (only static-literal ones). `node test/i18n.mjs` → exit 0.

### Step 3: Test

Create `test/i18n-fallback.mjs` (browser). Boot like `test/today-week-line.mjs` (wait on `window.__repforgeBooted`). In `page.evaluate`, assert:
- `tOr("zz.missing.key","fallback")==="fallback"`
- `window.__repforgeI18nMissingRequests.consume()` does **not** include `"zz.missing.key"` (call `consume()` once before the check to clear earlier noise)
- `tOr("nav.log","x")===t("nav.log")`
- after `I18N.setLang("pt")`, `tOr("nav.log","x")===t("nav.log")`, and it is not `"x"`

Register it under `workout:` in `test/suites.mjs` and bump the counts in `docs/ci.md`.

**Verify**: `node tools/run-tests.mjs --check` → exit 0. `node tools/run-tests.mjs workout --suite i18n-fallback` → exit 0.

### Step 4: Cache ritual and lanes

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html` (`?v=NN`), and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs`, `node tools/run-tests.mjs workout`, and `node tools/run-tests.mjs entry` → all exit 0. If any UI-screen catalog check runs locally (`node tools/check-ui-screens.mjs`), it also passes. Rendered text must not change, because every key used today exists.

## Test plan

A new `test/i18n-fallback.mjs` covers the helper semantics (missing, present, PT, no missing-request pollution). The existing entry and workout suites prove no visible copy changed.

## Done criteria

- [ ] `grep -c "const tOr=" app.js` → `1`
- [ ] No dynamic-key `t(...)||` sites remain (Step 2 verify)
- [ ] `node tools/run-tests.mjs workout` and `entry` exit 0
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- `I18N.STRINGS` is not exposed on the runtime API. Check with `grep -n "const api = {" i18n.js`.
- Any catalog or screen comparison shows changed text, meaning a key the code relies on was actually missing. Report which one.

## Maintenance notes

- New code that builds a key dynamically and has a sensible fallback should use `tOr`. Static keys should use plain `t`, since the i18n test guarantees they exist.
