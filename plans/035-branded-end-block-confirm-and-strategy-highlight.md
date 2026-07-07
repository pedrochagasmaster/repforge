# Plan 035: Branded End-block confirmation and a highlighted recommended strategy in the block review modal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c46c1b..HEAD -- app.js index.html styles.css test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (End block is a lifecycle-mutating flow; the simulation auto-accepts native dialogs today)
- **Depends on**: none
- **Category**: direction / dx
- **Planned at**: commit `5c46c1b`, 2026-07-07

## Why this matters

Ending a training block is the most consequential decision in the app's
mesocycle lifecycle, and it currently opens with a native browser
`confirm()` — visually foreign to the forge design system that every other
dialog follows (`#blockReview`, `#importChoice`, glossary all use branded
`role="dialog"` overlays). Once inside the review, five strategy buttons are
presented with equal weight even though `buildBlockReview` has already
computed a recommendation that is shown only as prose. Two fixes, one
surface: a branded confirm step, and a visually highlighted recommended
strategy button.

## Current state

`app.js:543-544` — the native confirm entry point:

```javascript
function promptEndBlock(){if(!confirm("End this training block? You'll review progress before starting the next one."))return;
  openBlockReview(buildBlockReview(state.programMeta,state.program,state.log))}
```

`app.js:540-542` — modal open + strategy wiring:

```javascript
function openBlockReview(review){blockReviewCurrent=review;renderBlockReviewPanel(review);const d=$("#blockReview");if(!d)return;
  d.classList.remove("hidden");$("#blockReviewClose").onclick=closeBlockReview;
  $$(".blockreview__act").forEach(b=>b.onclick=()=>finishBlockAndStart(b.dataset.strategy))}
```

`app.js:465-470` — the computed recommendation keys:

```javascript
  let recommendation;
  if(adherenceRatio<.5)recommendation="repeat_with_simpler_schedule";
  else if(stalledLifts>=3&&fatigueHigh)recommendation="reduce_volume_or_deload";
  else if(improvedHigh&&adherenceRatio>=.8)recommendation="repeat_or_progress";
  else if(volumeCompliance<.6)recommendation="keep_program_improve_completion";
  else recommendation="repeat_with_small_swaps";
```

`index.html:225-238` — the modal with its five strategy buttons (the
`data-strategy` values are the highlight targets):

```html
  <div id="blockReview" class="blockreview hidden" role="dialog" aria-modal="true" aria-label="Block review">
    <p class="blockreview__title">Block review</p>
    <div id="blockReviewBody" class="blockreview__body"></div>
    <div class="blockreview__actions">
      <button type="button" class="btn btn--steel blockreview__act" data-strategy="repeat">Repeat same program</button>
      <button type="button" class="btn btn--steel blockreview__act" data-strategy="repeat_swaps">Repeat with swaps</button>
      <button type="button" class="btn btn--steel blockreview__act" data-strategy="increase_volume">Increase volume</button>
      <button type="button" class="btn btn--steel blockreview__act" data-strategy="reduce_volume">Reduce volume</button>
      <button type="button" class="btn btn--steel blockreview__act" data-strategy="onboarding">Start from onboarding again</button>
    </div>
    <div class="btnrow">
      <button type="button" id="blockReviewClose" class="btn btn--forge">Close</button>
    </div>
  </div>
```

Branded dialog exemplar — `#importChoice` (`index.html:239-247`) plus its
handlers (search `app.js` for `importChoice`): a hidden overlay div with
Merge/Replace/Cancel buttons wired per-open. Match this pattern for the
confirm step.

Entry points, exhaustively mapped at `5c46c1b`
(`grep -n "promptEndBlock\|openBlockReview" app.js`): the Program tab button
(`app.js:1584` — `$("#endBlock").onclick=promptEndBlock;`) and the
final-week block banners' "Review block" button (`renderBlockPrompt`,
`app.js:546-548`, also wired to `promptEndBlock`). Both route through
`promptEndBlock`, so rewriting that one function covers every entry;
`openBlockReview` has no other callers.

**Simulation coupling** (`test/simulation.mjs`):

- Line ~426-428: a global `page.on("dialog", …accept())` handler exists —
  after this plan, the End block flow no longer emits a native dialog, but
  OTHER flows (delete session, delete log, program import, beginner program)
  still do. Do not remove the handler.
- Lines ~2811-2835: the P8 test clicks `#endBlock`, waits for
  `#blockReview:not(.hidden)`, asserts recommendation copy, and closes. With
  a branded confirm inserted, this test must click the new confirm button
  in between — update it.

Strategy ↔ recommendation mapping to implement (recommendation keys from
`buildBlockReview` → `data-strategy` to highlight):

| recommendation | highlighted strategy |
|---|---|
| `repeat_or_progress` | `repeat` |
| `repeat_with_small_swaps` | `repeat_swaps` |
| `reduce_volume_or_deload` | `reduce_volume` |
| `keep_program_improve_completion` | `repeat` |
| `repeat_with_simpler_schedule` | `reduce_volume` |

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |

At commit `5c46c1b` the simulation reports `PASSED: 267, FAILED: 0`.
Hard-reload after editing cached assets (service worker).

## Scope

**In scope** (the only files you should modify):
- `index.html` — new `#endBlockConfirm` overlay; no changes to the five
  strategy buttons themselves.
- `app.js` — `promptEndBlock` (confirm flow), `openBlockReview` /
  `renderBlockReviewPanel` (highlight), a small recommendation→strategy map.
- `styles.css` — confirm overlay styles (copy the `.importchoice` block) and
  a `.blockreview__act.is-recommended` style.
- `test/simulation.mjs` — update the P8 flow, add checks.

**Out of scope** (do NOT touch, even though they look related):
- The OTHER native `confirm()` calls (delete session `app.js:1235`, delete
  log `app.js:1596`, program import `app.js:1440`, beginner program
  `app.js:1586`, exercise/day delete `app.js:1364,1367`) — converting all of
  them is a follow-up; keeping scope tight keeps the sim churn reviewable.
- `finishBlockAndStart` and the strategy execution logic.
- `buildBlockReview` computation.

## Git workflow

- Branch: `cursor/plan-035-endblock-confirm-<suffix>`.
- Commit style: single-line imperative summary.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Branded confirm overlay

In `index.html`, after the `#importChoice` div, add:

```html
  <div id="endBlockConfirm" class="importchoice hidden" role="dialog" aria-modal="true" aria-label="End training block">
    <p class="importchoice__title">End this training block?</p>
    <p class="importchoice__body">You'll review this block's progress and pick how to start the next one. Nothing is deleted.</p>
    <div class="btnrow">
      <button type="button" id="endBlockGo" class="btn btn--forge">Review block</button>
      <button type="button" id="endBlockCancel" class="btn btn--steel">Cancel</button>
    </div>
  </div>
```

Reusing the `importchoice` classes keeps styling consistent with zero new
CSS; if visual separation is wanted later, a dedicated class can alias it.

In `app.js`, rewrite `promptEndBlock`:

```javascript
function promptEndBlock(){const d=$("#endBlockConfirm");if(!d)return;
  d.classList.remove("hidden");
  $("#endBlockGo").onclick=()=>{d.classList.add("hidden");openBlockReview(buildBlockReview(state.programMeta,state.program,state.log))};
  $("#endBlockCancel").onclick=()=>d.classList.add("hidden")}
```

**Verify**: `node --check app.js` → exit 0. Serve + hard-reload → Program →
End block opens the branded overlay; Cancel dismisses; Review block opens
the existing `#blockReview` modal.

### Step 2: Highlight the recommended strategy

In `app.js`, add next to `BLOCK_REC_COPY` (`app.js:474-479`):

```javascript
const REC_STRATEGY={repeat_or_progress:"repeat",repeat_with_small_swaps:"repeat_swaps",reduce_volume_or_deload:"reduce_volume",keep_program_improve_completion:"repeat",repeat_with_simpler_schedule:"reduce_volume"};
```

In `openBlockReview` (after `renderBlockReviewPanel(review)`), mark the
recommended button:

```javascript
  const rec=REC_STRATEGY[review.recommendation];
  $$(".blockreview__act").forEach(b=>{const on=b.dataset.strategy===rec;b.classList.toggle("is-recommended",on);b.setAttribute("aria-description",on?"Recommended":"")});
```

In `styles.css` (near the `.blockreview` block — search `blockreview__act`),
add:

```css
.blockreview__act.is-recommended{border-color:var(--gold);color:var(--mist);background:rgba(255,180,76,.1)}
.blockreview__act.is-recommended::after{content:" · recommended";color:var(--gold);font-size:.85em}
```

(Match the active-effort-button styling at `styles.css:234` for palette
consistency.)

**Verify**: serve, seed enough history for a review (or run the sim's P8
seeding manually), End block → exactly one strategy button carries the gold
recommended treatment, and it matches the prose recommendation line.

### Step 3: Update the simulation

1. In the P8 phase (`test/simulation.mjs` ~2811): after
   `await page.click("#endBlock")`, add
   `await page.waitForSelector("#endBlockConfirm:not(.hidden)")` and
   `await page.click("#endBlockGo")` before the existing
   `waitForSelector("#blockReview:not(.hidden)")`.
2. Add checks:
   - After `#endBlock` click, `#endBlockConfirm` is visible; after
     `#endBlockCancel` click, it hides and `#blockReview` stays hidden
     (do this cancel round-trip BEFORE the accept path).
   - In the open review, exactly one `.blockreview__act.is-recommended`
     exists and its `data-strategy` equals the expected mapping for
     `blockReview.recommendation` (the test already holds that object —
     replicate the `REC_STRATEGY` map inline in the test).
3. Search the sim for other `#endBlock` clicks (`grep -n '"#endBlock"'
   test/simulation.mjs`) and thread the confirm step through each.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥ 270.

## Test plan

- New checks: confirm-overlay open/cancel/accept path; single recommended
  strategy button matching the computed recommendation.
- Updated checks: every existing End-block flow now passes through
  `#endBlockGo`.
- Existing checks that must keep passing: P9 next-block strategy execution
  (unchanged entry via `finishBlockAndStart`), all dialog-accepting flows
  (delete session/log etc. still native).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 270
- [ ] `grep -n 'confirm("End this training block' app.js` returns no matches
- [ ] `grep -c "REC_STRATEGY" app.js` ≥ 2 (definition + use)
- [ ] `grep -c "endBlockConfirm" index.html` ≥ 1
- [ ] No files outside `index.html`, `app.js`, `styles.css`, `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts don't match live code (drifted).
- `openBlockReview` is called from more entry points than `promptEndBlock`
  and the block banners (`grep` in Step 0) in a way that would bypass the
  confirm — map them first, then report if the flow design is ambiguous.
- The recommendation key set in `buildBlockReview` has changed (new keys not
  in the mapping table) — the mapping needs a product decision.
- More than 3 existing sim checks break beyond the P8 threading described.

## Maintenance notes

- If `buildBlockReview` gains new recommendation keys, `REC_STRATEGY` must be
  extended — reviewers should treat the two as a pair (same for
  `BLOCK_REC_COPY`).
- Follow-up (deferred): convert the remaining native `confirm()` calls to the
  branded overlay using this plan's pattern; the sim's global dialog-accept
  handler can be removed only after the last one is converted.
- Reviewer should scrutinize: no double-binding of `#endBlockGo` handlers
  across repeated opens (per-open `.onclick=` assignment, matching the repo
  pattern, is idempotent).
