# Plan 028: Program identity travels — Log tab context line and named export files

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f9da669..HEAD -- app.js index.html test/simulation.mjs`
> Plans 025–027 intentionally modify `app.js`; compare the "Current state"
> excerpts against the live code before proceeding and on a mismatch beyond
> those documented edits, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/025-program-meta-chip-refresh.md (same render function); plans/026-program-import-meta-semantics.md (import naming semantics should be settled first)
- **Category**: direction
- **Planned at**: commit `f9da669` (PR #19 branch `cursor/program-abstraction-df5f`), 2026-07-02

## Why this matters

PR #19's design note states the problem it exists to solve: "Users cannot
answer *what program am I running?*" — but after the PR, the answer is only
visible on the Program tab, the tab a lifter visits least. The identity the
feature created should travel to where it earns its keep:

1. **The Log tab** — the tab the product guardrails say to protect and where
   every session starts. One quiet line of context (program name + week)
   makes the abstraction real daily, at near-zero cost.
2. **The export filename** — `exportProgram` still writes
   `repforge_program_2026-07-02.json`. The coach story that motivated export
   v2 (tracker row PROG-19: "shared templates carry a name") breaks down in
   a downloads folder full of identically-named files. The name belongs in
   the filename.

Both are direction work grounded in this PR's own stated intent, scoped
deliberately small. Product guardrails that bind this plan: no new nav tab,
no gamification, and the Log tab's speed is sacred — the context line is
static text rendered once per `renderWorkout`, not a new interactive surface.

## Current state

- `app.js:830-831` — export with date-only filename:

```javascript
function exportProgram(){const payload={version:2,meta:state.programMeta,exercises:prog.toJSON()};
  download(JSON.stringify(payload,null,2),`repforge_program_${today()}.json`,"application/json")}
```

- `index.html:38-44` — the Log tab section head where the context line goes:

```html
      <div class="sectionhead">
        <p class="eyebrow">Today's session</p>
        <div class="sectionhead__row">
          <h2>Log workout</h2>
          <label class="datepick">Date<input id="date" type="date"></label>
        </div>
      </div>
```

- `app.js:209-211` — `programWeek()` returns the 1-based week number or
  `null` when no start date is set (reuse it; do not re-derive).
- `app.js:305` onward — `renderWorkout()` re-renders `#workout` on every Log
  interaction. The context line should be updated in `renderWorkout` (it is
  cheap: two field reads), or in `renderTabs` — either is acceptable; pick
  `renderWorkout` and update a dedicated element, not part of the `#workout`
  innerHTML churn.
- Escaping convention: any user-entered string interpolated into HTML goes
  through `esc()` (`app.js:18`). The program name is user-entered. For the
  context line, prefer `textContent` assignment, which needs no escaping.
- Vocabulary (`CONTEXT.md`): the name for this concept is **Program** /
  **Program metadata**; the week number is **Program progress**. "Untitled
  program" is the established placeholder for a blank name
  (see `renderProgramHeader`'s input placeholder).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Test deps (once, if missing) | `cd test && npm install && npx playwright install chromium` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `app.js` — `exportProgram`, a small filename-slug helper, one line in
  `renderWorkout`, and (for live name updates) one line in the
  `#programName` input handler in `renderProgramHeader`/`renderProgramChips`.
- `index.html` — the Log tab eyebrow line only.
- `styles.css` — only if the eyebrow needs a modifier class; prefer reusing
  the existing `.eyebrow` style untouched.
- `test/simulation.mjs` — extend the program-metadata phase and the program
  export check.

**Out of scope** (do NOT touch, even though they look related):
- The full-backup filename (`repforge_backup_…json` in `exportJson`) and CSV
  filename — device-local files, date-keying is right for them.
- The topbar brand / header (`.topbar`) — identity does not replace branding.
- Any new chip, bar, or interactive element on the Log tab — guardrail:
  protect Log tab speed and calm.
- `programMeta` shape — no new persisted fields.

## Git workflow

- Branch off whatever base carries plans 025–026 (or the PR #19 branch
  directly if they landed there): `git checkout <base> && git checkout -b <your-branch>`.
- Commit style from `git log`: single-line imperative summaries.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Named export files

In `app.js`, add next to `exportProgram` a slug helper and use it:

```javascript
const fileSlug=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
function exportProgram(){const payload={version:2,meta:state.programMeta,exercises:prog.toJSON()};
  const slug=fileSlug(state.programMeta?.name);
  download(JSON.stringify(payload,null,2),`repforge_program_${slug?`${slug}_`:""}${today()}.json`,"application/json")}
```

Unnamed programs keep exactly the old filename (no trailing underscore); a
program named "Upper / Lower 4-Day" exports as
`repforge_program_upper-lower-4-day_<date>.json`.

**Verify**: `node --check app.js` → exit 0.

### Step 2: Log tab context line

In `index.html`, replace the static eyebrow on the Log section with an
identified element (keep the class):

```html
        <p class="eyebrow" id="logContext">Today's session</p>
```

In `app.js`, at the top of `renderWorkout()` (before the `#workout` innerHTML
build), set its text:

```javascript
  const lc=$("#logContext");if(lc){const nm=state.programMeta?.name,wk=programWeek();
    lc.textContent=nm||wk?`${nm||"Untitled program"}${wk?` · Week ${wk}`:""}`:"Today's session"}
```

Behavior: no name and no start date → unchanged "Today's session"; name only
→ "Push Pull Legs"; name + started → "Push Pull Legs · Week 7"; started only
→ "Untitled program · Week 7".

**Verify**: `node --check app.js` → exit 0.

### Step 3: Keep the context line fresh after renames

Renaming the program on the Program tab must reflect on the Log tab next time
it renders. `render()` already re-runs `renderWorkout` on every nav switch, so
no extra wiring is strictly required — confirm this rather than adding
plumbing: serve the app, set a program name, switch to the Log tab, and check
the eyebrow shows the name. Only if it does not, add a `renderWorkout` —
no, STOP: if it does not update, something upstream broke; report it.

**Verify (automated in Step 4, manual here)**: eyebrow shows
"<name> · Week N" after setting name + start date on the Program tab and
navigating to Log.

### Step 4: Simulation checks

In `test/simulation.mjs`:

1. In the `Phase: program metadata` block, after the "Program name persists
   on edit" assert (the name is "Simulation Split" at that point), add:

```javascript
  await nav(page, "log");
  const logEyebrow = await page.locator("#logContext").textContent();
  assert(
    logEyebrow.includes("Simulation Split"),
    "Log tab eyebrow shows the program name",
    `eyebrow=${logEyebrow}`,
    "Program tab → name program → Log tab eyebrow"
  );
  await nav(page, "program");
```

2. In the program-export block (search for `"Program export is v2 with meta
   and exercises"`), extend the download-name assertion. The download object
   is `progDl`; after `saveAs`, add:

```javascript
  assert(
    /^repforge_program_.+\.json$/.test(progDl.suggestedFilename()),
    "Program export filename carries a slug segment",
    `filename=${progDl.suggestedFilename()}`,
    "Program → Advanced → Export program JSON with a named program"
  );
```

   Note: whether the slug appears depends on the program being named by the
   time this phase runs — the metadata phase names it "Simulation Split"
   earlier in the run, but a later import (plan 026 semantics) may rename it
   to "Imported Template". Assert on the generic pattern above, or on
   whichever concrete name the state holds at that point — check with
   `(await getState(page)).programMeta.name` first and assert the filename
   contains `fileSlug`-style output of that name.

**Verify**: with the static server running, `cd test && node simulation.mjs`
→ `FAILED: 0`, PASSED ≥ baseline + 2.

## Test plan

- New simulation checks (Step 4): Log-tab eyebrow reflects the program name;
  export filename includes the slug when the program is named.
- Existing checks that must keep passing: the whole suite (`FAILED: 0`),
  especially the program export/import phase — the filename change must not
  break the `saveAs`/re-import flow, which is path-based and independent of
  the suggested filename.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ baseline + 2
- [ ] `grep -c "logContext" index.html app.js` returns 1 per file (element + renderer)
- [ ] Exported filename for an unnamed program is byte-identical to the old scheme (`repforge_program_<date>.json`)
- [ ] No files outside `app.js`, `index.html`, `styles.css`, `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" do not match the live code beyond the edits
  documented in plans 025–027.
- The eyebrow does not refresh on tab switch (Step 3) — do not add render
  plumbing; the global `render()`-on-nav invariant is broken and needs a
  human look.
- You are tempted to add anything interactive (button, chip, link) to the Log
  tab header — out of scope by product guardrail.

## Maintenance notes

- If the multi-program library (design note Phase 3) lands, the Log-tab
  context line is the natural switcher affordance — whoever builds that
  should start here.
- Reviewer should scrutinize: `textContent` (not innerHTML) for the eyebrow —
  the program name is user input; and the unnamed-program filename staying
  identical to the pre-plan scheme.
- Deferred: program name in the document `<title>` / PWA install surfaces —
  cute, but touches `manifest.webmanifest` caching and is not worth the
  service-worker invalidation hassle now.
