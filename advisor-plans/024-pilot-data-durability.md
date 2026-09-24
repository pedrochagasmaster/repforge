# Plan 024: Resolve the pilot-data-protection contradiction, then ship the cheap durability mitigations the thesis names

> **Executor instructions**: Part A is **already decided**: the owner chose
> Option 1 on 2026-09-23 (Q606), and the backlog records it. Execute Part B
> steps B1, B2, and B4. B3 is **out of scope**: it is now the separate Later
> item "Proactive backup reminder" (Q620). Run every verification and honor the
> STOP conditions. When done, update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 76a31602..HEAD -- app.js index.html docs/backlog.md docs/business-product-thesis.md i18n-en.json i18n-pt.json guide-registry.js`
> Then run `grep -n "storage.persist" *.js`. If it now finds a call, re-scope Part B.

## Status

- **Priority**: P2 (direction; alpha-readiness)
- **Effort**: S (B1 + B2)
- **Risk**: LOW
- **Depends on**: none. B2 changes Settings copy, so coordinate with any open Plan 057/058 PR that touches Settings.
- **Category**: direction (data protection)
- **Planned at**: commit `76a31602`, 2026-09-23 (on `origin/ui-overhaul/057-management-surfaces`)
- **Backlog**: **Now**: the "Browser-persistence mitigation" row (owner decisions Q604, Q606, Q620). The former "Pilot-data protection (deferred)" row was replaced by that Now row plus a Later "Proactive backup reminder" row.

## Why this matters

Every alpha participant's training history exists only in their browser's storage, and browsers evict it: iOS Safari is the most aggressive for non-installed sites. The governing documents disagree about whether to mitigate this before the alpha:

- `docs/business-product-thesis.md:~2440`: "alpha readiness requires … honest browser-persistence mitigations."
- `:~2484-2497` names them: "request persistent browser storage where supported; encourage installation where useful; automatic or prominent export/backup nudges for pilot users; clearly communicate prototype/beta status… Do not turn this mitigation work into a major PWA infrastructure project."
- `docs/backlog.md` deferred all of it to "Later" until the owner resolved the contradiction in the thesis's favour (Q606).

Meanwhile the code has **no `navigator.storage.persist()` call anywhere**. The last-backup date is shown only inside Settings (`app.js:10286`), and the backup guide appears only when the lifter opens Settings → Data backup (`app.js:15758-15761`), which means they already went looking for it. Losing an alpha participant's history is also a lost data point, and the thesis treats that as a reason for Phase 2 native work.

## Current state

- `app.js:1152`: `DEFAULTS` includes `lastExport:""`; `app.js:10344` sets `proposal.settings.lastExport=new Date().toISOString()` on backup export.
- `app.js:10286-10287`: `const le=state.settings.lastExport,ago=le?t("settings.storage.last_backup",{lastBackup:le.slice(0,10)}):t("settings.storage.last_backup_never");` renders into `#storageNote`.
- `app.js:10288-10289`: a degraded-storage notice already exists (`DurableState.getStorageHealth().degraded` → `settings.storage.degraded`). Its copy says "Export a backup."
- `guide-registry.js:24`: `{ id: "backup", version: 1, anchorSelector: "#exportJson", … wired: true }`; triggered only at `app.js:15761` when the Data backup panel opens.
- Device-only UI preferences live in `localStorage` key `repforge_ui_v1` (`loadUiPrefs()` `app.js:14637`; the writer is around line 14647). `AGENTS.md`: "When adding or changing device UI preferences, check both install-transfer clone fidelity and destination eligibility. Automatic presentation metadata must not make an otherwise fresh destination ineligible for transfer." Any new pref must honor this.
- Boot: `function init()` (`app.js:15416`) ends with `window.__repforgeBooted=true` (`app.js:15863`).
- Product rules (`plans/README.md` guardrails, backlog G-40): contextual cues use the guide registry and must be action-linked; no fake doors; no nagging patterns.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| i18n | `node tools/build-i18n.mjs && node tools/build-i18n.mjs --check && node test/i18n.mjs` | exit 0 |
| Guides | `node tools/run-tests.mjs entry --suite entry-guides` and `--suite guide-eligibility` (check the lanes with `node tools/run-tests.mjs all --list \| grep guide`) | exit 0 |
| Transfer prefs | `node tools/run-tests.mjs state --suite install-transfer-clone` (find the lane with `--list`) | exit 0 |
| Catalog | `node tools/capture-ui-screens.mjs` (with `REPFORGE_URL` set), then `node tools/check-ui-screens.mjs` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `app.js`; `i18n-en.json`, `i18n-pt.json` (then regenerate `i18n.js`); new or updated tests; UI catalog PNGs for any changed screen; the cache ritual files.
**Out of scope:** `guide-registry.js` and any backup reminder (B3 is the separate Later item, Q620); sync, cloud backup, encrypted export (a separate backlog item), Web Push, and any server.

## Steps

### Part A — Decision (done)

The owner chose Option 1 on 2026-09-23 (Q606): the thesis wins, and browser-persistence mitigation is alpha-readiness work, limited to B1 and B2 (Q620). `docs/backlog.md` already records it as the Now row "Browser-persistence mitigation". Nothing to do here.

### Part B — Implementation

#### Step B1: Request persistent storage at a meaningful moment

Do **not** call it at first boot. Firefox shows a permission prompt, and an empty device has nothing to protect. Call it once, right after the **first completed session** is committed (the same place `captureEvent("first_set_logged",{})` fires, `app.js:~7033`):

```js
if(!prevLog.some(isWork)&&rows.some(isWork))requestPersistentStorage();
```

with a helper:

```js
async function requestPersistentStorage(){try{
  if(!navigator.storage?.persist||await navigator.storage.persisted?.())return;
  await navigator.storage.persist()}catch{}}
```

No preference is stored; `persisted()` is the source of truth.

**Verify**: a browser test (add to the suite that already covers session completion, for example `test/session-summary.mjs`) stubs `navigator.storage.persist`/`persisted` via `addInitScript` and asserts `persist` is called exactly once after the first session and never at boot.

#### Step B2: Show durability status in Settings

Beside `#storageNote`, render one line from `navigator.storage.persisted()`. When `true`: "This browser keeps Taurifer's data unless you clear it." When `false` or unavailable: "This browser may clear Taurifer's data if space runs low. Export a backup regularly." Write both in EN and PT, following `docs/brand-guide.md` voice. Add the keys to both JSON catalogs and regenerate `i18n.js`.

**Verify**: `node test/i18n.mjs` → exit 0; refresh the Settings catalog screens and `node tools/check-ui-screens.mjs` → exit 0.

#### Step B3: Not in this plan

The proactive backup cue is the Later backlog item "Proactive backup reminder" (Q620), and it needs its own owner-approved design. Starting-point idea for that future design, not for execution here: after a completed session, when `lastExport` is empty or older than 30 days **and** ≥ 5 sessions have been logged since, show the existing `backup` guide anchored to the session summary's close action, at most once per 30 days. Its state would go in the guide registry's records, checked against install-transfer eligibility (`AGENTS.md`).

#### Step B4: Cache ritual

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0; the affected lanes exit 0 (`node tools/run-tests.mjs affected --base origin/main`).

## Done criteria

- [ ] `grep -c "navigator.storage.persist" app.js` ≥ 1; the B1 test proves one call after the first session and none at boot
- [ ] The B2 copy exists in EN and PT; `node test/i18n.mjs` passes; the Settings catalog screens are refreshed
- [ ] `guide-registry.js` is unchanged; the `advisor-plans/README.md` row is updated

## STOP conditions

- Any copy change conflicts with a Plan 057/058 surface currently in review. Coordinate before touching Settings.
- The first-completed-session hook no longer exists where described (the `first_set_logged` emission). Report where session completion now lives rather than choosing a different moment.

## Maintenance notes

- The thesis treats durability complaints as evidence for Phase 2 (native). Keep this work small and let the evidence come in.
