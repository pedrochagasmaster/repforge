# Plan 005: CLAUDE.md's architecture table stops stating facts that have drifted

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- CLAUDE.md`
> If it changed, re-read the lines quoted below and fix only what is still wrong.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (documentation only)
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: documentation hygiene. No backlog entry needed.

## Why this matters

`CLAUDE.md` is loaded into every AI agent session that works on this repo, and it calls itself the "fast orientation". Several of its hard facts are wrong, and because agents read it first, they act on them:

- It says the cache is `repforge-v112` with `?v=112`. The live value is in the 290s and moves with nearly every PR.
- It says `app.js` is ~566 KB. It is ~1.03 MB.
- It says only `shared-setup.js` and `app.js` carry `?v=NN` revisions. Fourteen scripts do, and `test/exercise-library.mjs`'s `transitionAssets` list is the source of truth. The same wrong claim appears in the "Service-worker cache" ritual bullet, so an agent following it will bump only two of the fourteen and fail CI.
- It says setup links have "`v1.` canonical + `v2.` compact envelopes". `AGENTS.md` documents `v3.` too.
- The file table omits ~15 application scripts (`durable-state.js`, `workout-draft.js`, `program-transition.js`, `progression-engine.js`, …) and still attributes the storage and progression engines to `app.js`.

`AGENTS.md` already avoids the drift problem by saying "read the live `CACHE` revision in `sw.js`" instead of hardcoding it. `CLAUDE.md` should do the same, and defer to `AGENTS.md` (which it already names as authoritative).

## Current state

`CLAUDE.md` at `ff9991cf`:

```
45: | `index.html` | App shell; inline pre-paint theme snippet; carries `?v=NN` revisions for `shared-setup.js` and `app.js` |
46: | `app.js` | ~566 KB single-file app: storage engine (localStorage `repforge_v1` + IndexedDB `repforge`/`kv`), cross-tab lock, write-ahead journal, rendering, progression engine, all UI |
48: | `shared-setup.js` | Setup-link codec (`v1.` canonical + `v2.` compact envelopes; both decode forever) |
53: | `sw.js` | Service worker; `repforge-vNN` cache name (`repforge-v112` today; `?v=112` revisions), atomic `addAll` precache |
143: - **Service-worker cache** — when any precached asset changes, bump `CACHE` (`repforge-vNN`) in
144:   `sw.js` *and* move the `?v=NN` revisions for `shared-setup.js` and `app.js` in both
145:   `index.html` and `sw.js` `ASSETS`. `test/exercise-library.mjs` holds those three numbers in
146:   lockstep.
```

Facts to use (verify each yourself):
- `grep -o 'repforge-v[0-9]*' sw.js` → the live cache name
- `wc -c app.js` → ~1,03x,xxx bytes
- `grep -n "const transitionAssets" -A 16 test/exercise-library.mjs` → the revisioned-script list (14 entries at planning time)
- `ls *.js` → the application scripts. At planning time: `app.js durable-state.js exercises.js guide-registry.js history-ui.js i18n.js install-policy.js install-transfer-contract.js install-transfer.js motion-layer.js notify.js posthog-init.js program-compiler.js program-editor.js program-entry-adapter.js program-entry.js program-transition.js progress-model.js progression-engine.js schedule.js shared-setup.js sw.js telemetry.js workout-draft.js` (plus the gitignored, generated `posthog-config.js`)
- `AGENTS.md:15` documents the `v1.`/`v2.`/`v3.` envelopes

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Doc checker | `node tools/check-canonical-contradictions.mjs` | exit 0 |
| Whitespace | `git diff --check` | no output |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |

## Scope

**In scope:** `CLAUDE.md` only.

**Out of scope:** `AGENTS.md` (already correct on these points), and every other doc.

## Git workflow

- Branch: `advisor/005-claude-md-drift`
- Commit: `docs(claude): replace drifting hard numbers with live-source pointers`
- Do not push.

## Steps

### Step 1: Fix the four table rows

- Line 45 (`index.html`): "…carries `?v=NN` revisions for the version-coupled scripts listed in `test/exercise-library.mjs` (`transitionAssets`)".
- Line 46 (`app.js`): "Main application script (~1 MB, by far the largest file): rendering, all UI, and boot wiring. It also still hosts parts of the storage and progression logic; see the extracted modules below." Do not state an exact size.
- Line 48 (`shared-setup.js`): "Setup-link codec (`v1.`, `v2.`, and `v3.` envelopes; all decode forever — see `AGENTS.md`)".
- Line 53 (`sw.js`): "Service worker; `repforge-vNN` cache name (read the live `CACHE` in `sw.js`), atomic `addAll` precache".

**Verify**: `grep -c "566 KB\|v112\|v=112" CLAUDE.md` → `0`.

### Step 2: Add one row for the extracted modules

Directly after the `app.js` row, add:

```
| `durable-state.js`, `workout-draft.js`, `program-transition.js`, `progression-engine.js`, `progress-model.js`, `program-compiler.js`, `program-entry.js`, `program-entry-adapter.js`, `program-editor.js`, `history-ui.js`, `install-transfer.js`, `install-transfer-contract.js`, `install-policy.js`, `guide-registry.js`, `telemetry.js` | Extracted subsystems (durable write/recovery engine, workout draft, block transitions, progression strategies, progress model, program compiler/entry/editor, history UI, install transfer, guides, telemetry). `AGENTS.md` is authoritative for their contracts. |
```

Cross-check the list against `ls *.js`. Every application script except those already in other rows (`app.js`, `shared-setup.js`, `exercises.js`, `i18n.js`, `schedule.js`, `notify.js`, `sw.js`, `posthog-init.js`, `motion-layer.js`) must appear exactly once.

**Verify**: for each file printed by `ls *.js | grep -v posthog-config`, `grep -c "\`$f\`" CLAUDE.md` → at least `1`.

### Step 3: Fix the ritual bullet (lines 143-146)

Replace it with: "when any precached asset changes, bump `CACHE` (`repforge-vNN`) in `sw.js` *and* move every `?v=NN` revision (the scripts in `test/exercise-library.mjs`'s `transitionAssets`) in both `index.html` and `sw.js` `ASSETS`; set that test's `expectedRevision` to the same number. See `AGENTS.md` for the full rule."

**Verify**: `grep -n "for \`shared-setup.js\` and \`app.js\`" CLAUDE.md` → no output.

### Step 4: Checks

**Verify**: `git diff --check` → empty. `node tools/check-canonical-contradictions.mjs` → exit 0. `node tools/run-tests.mjs fast` → exit 0.

## Test plan

Docs only. The canonical-contradiction checker in the fast lane must stay green.

## Done criteria

- [ ] `grep -c "566 KB\|v112\|v=112" CLAUDE.md` → `0`
- [ ] Every `*.js` application script is named somewhere in `CLAUDE.md`
- [ ] `node tools/run-tests.mjs fast` exits 0
- [ ] `git diff --stat` shows only `CLAUDE.md`
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- `check-canonical-contradictions.mjs` flags `CLAUDE.md` text in a way that requires changing `AGENTS.md`.
- `CLAUDE.md` is loaded by a tool that parses the table (`grep -rn "CLAUDE.md" tools test`). If a parser depends on the row format, stop.

## Maintenance notes

- Rule of thumb for this file: point to the live source (a file, constant, or test list), never copy a number that changes per PR.
