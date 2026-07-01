# Plan 007: Rich analysis CSV export (computed columns + stable ids)

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js`
> On any change, compare the `exportCsv` excerpt against live code; mismatch =
> STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 006 (stable ids) — recommended, not strictly required
- **Category**: direction / dx
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Spreadsheet maximalist ("CSV export is raw inputs … I export and
  immediately re-derive everything your app already calculated"), coach.
  Report §5 "Next 2 months" — "Rich CSV export".

## Why this matters

The app already computes e1RM (`e1rm`, `app.js:12`), tonnage, and hard-set
status, but the CSV dumps only raw inputs — "portability that's homework." One
enrichment of the existing `exportCsv` turns a re-derivation chore into a real
analysis artifact, and it's the spreadsheet persona's single biggest unlock.
Pure export change; no data model, no UI.

## Current state

- `exportCsv` (`app.js:468`):

  ```js
  function exportCsv(){const h=["session","date","day","name","set","load","reps","rir","notes","created"],csv=[h.join(","),...state.log.map(r=>h.map(k=>`"${String(r[k]??"").replaceAll('"','""')}"`).join(","))].join("\n");download(csv,`repforge_log_${today()}.csv`,"text/csv")}
  ```

- Building blocks already exist:
  - `e1rm(load,reps)` (`app.js:12`) = `load*(1+reps/30)`.
  - `rowMuscles(row)` (`app.js:26-28`) → `{primary,secondary}` from the row
    snapshot or live program.
  - Hard-set rule (from `renderCompleted`, `app.js:282`): `+x.load>0 && +x.reps>0
    && +x.rir<=hardRir` where `hardRir=+state.settings.hardRir`.
  - Each log row already stores `exerciseId` (`saveWorkout`, `app.js:217`).
- The `download` helper (`app.js:16`) handles the file save.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (only `app.js` + the test):
- `app.js` — extend `exportCsv` to add computed columns: `exercise_id`, `e1rm`,
  `tonnage`, `primary`, `secondary`, `is_hard_set`. Keep existing columns and
  their order first (backward compatible for anyone parsing by position is not
  guaranteed, but header-based parsers are safe; document in the maintenance
  note).
- `test/simulation.mjs` — a check that the CSV header includes the new columns
  and a data row's `e1rm` matches `load*(1+reps/30)`.

**Out of scope** (do NOT touch):
- CSV **import** (backlog / larger).
- The JSON backup format.
- A PR ledger, mesocycle columns (backlog).
- Multiple e1RM formulas — Epley only (the report explicitly warns against a
  formula toggle before one exportable column exists).

## Git workflow

- Branch: `advisor/007-rich-csv-export`
- Single commit is fine. Do NOT push/PR unless asked.

## Steps

### Step 1: Enrich `exportCsv`

Replace `exportCsv` (`app.js:468`) with a version that appends computed columns
derived from the same helpers the app already uses:

```js
function exportCsv(){
  const hr=+state.settings.hardRir;
  const cols=[
    ["session",r=>r.session],["date",r=>r.date],["day",r=>r.day],
    ["name",r=>exerciseLabel(r)],["exercise_id",r=>r.exerciseId||""],
    ["set",r=>r.set],["load",r=>r.load],["reps",r=>r.reps],["rir",r=>r.rir],
    ["e1rm",r=>+e1rm(+r.load,+r.reps).toFixed(2)],
    ["tonnage",r=>+((+r.load||0)*(+r.reps||0)).toFixed(2)],
    ["primary",r=>rowMuscles(r).primary],["secondary",r=>rowMuscles(r).secondary],
    ["is_hard_set",r=>(+r.load>0&&+r.reps>0&&+r.rir<=hr)?1:0],
    ["notes",r=>r.notes],["created",r=>r.created],
  ];
  const q=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols.map(c=>c[0]).join(","),
    ...state.log.map(r=>cols.map(c=>q(c[1](r))).join(","))].join("\n");
  download(csv,`repforge_log_${today()}.csv`,"text/csv");
}
```

Use `exerciseLabel(r)` (`app.js:24`) so `name` reflects the current program name
(consistent with History/Stats), while `exercise_id` gives the stable key.

**Verify**: `node --check app.js` → 0. Export CSV with real data; open it and
confirm the new header and that `e1rm` on a `100 kg × 6` row reads `120.00`
(`100 * (1 + 6/30) = 120`).

### Step 2: Simulation check

In `test/simulation.mjs`, add a CSV-content check. The download uses an anchor;
in headless Chromium the simplest verification is to recompute the CSV in-page
via the same function, or intercept the download. Prefer computing expected
values from state and asserting the exported string. Reuse the existing export
pattern if the test already triggers `#exportCsv`
(`grep -n "exportCsv\|Export log CSV\|download" test/simulation.mjs`). If no CSV
check exists, add:

```js
await nav(page, "settings");
const csv = await page.evaluate(() => {
  // call the app's own exporter logic by reading state and rebuilding is unsafe;
  // instead capture the Blob text via a temporary override
  return new Promise(res => {
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => { blob.text().then(res); return "blob:mock"; };
    document.querySelector("#exportCsv").click();
    URL.createObjectURL = origCreate;
  });
});
assert(
  /(^|,)exercise_id(,|$)/m.test(csv.split("\n")[0]) && /(^|,)e1rm(,|$)/m.test(csv.split("\n")[0]) && /(^|,)is_hard_set(,|$)/m.test(csv.split("\n")[0]),
  "CSV export includes computed columns",
  `header: ${csv.split("\n")[0]}`,
  "Settings → Export log CSV → header has exercise_id, e1rm, is_hard_set"
);
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js`.
- Manual: open exported CSV in a spreadsheet; verify `e1rm`, `tonnage`,
  `is_hard_set`, `primary`/`secondary`, `exercise_id` populate correctly.
- Simulation: header/computed-column check; existing 61 stay green.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Exported CSV header includes `exercise_id, e1rm, tonnage, primary,
      secondary, is_hard_set` alongside the original columns
- [ ] `e1rm` column equals `load*(1+reps/30)` rounded to 2 dp
- [ ] `is_hard_set` is 1 exactly when `load>0 && reps>0 && rir<=hardRir`
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] Only `app.js` + test changed; `plans/README.md` status updated

## STOP conditions

- Drift: `exportCsv` doesn't match the excerpt.
- The `URL.createObjectURL` override approach fails in the test harness — fall
  back to asserting the header by reading the file the download writes (the sim
  runs in a temp profile; check how other download-based checks capture output)
  rather than weakening the assertion.

## Maintenance notes

- Column **order changed** (computed columns interleaved). Anyone parsing by
  index will break; header-based parsing is safe. Note this in the README/commit.
- A PR ledger and mesocycle columns build on `exercise_id` + `e1rm` here; they're
  in the backlog.
