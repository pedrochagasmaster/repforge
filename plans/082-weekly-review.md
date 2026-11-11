# Plan 082: the weekly review

Status: **approved in substance by owner decision D-9 (2026-11-08)**: the week's facts and a bounded,
cause-matched proposal with approval both ship in the alpha; the Free/Pro split is decided after it. The
catalogue, records and placement marked *proposed* are defaults for the PRs; copy is reviewed in each PR
(#315). Docs only.
Source: `docs/coach-layer-strategy-2026-11-08.md` §5 and §10 (D-9); thesis §7.5 and §8.3 job 3; the Gated
backlog row "Bounded within-program adaptation", whose gate is "intervention catalogue and versioned program
changes". Step 6 of the note's §11.
Written against `main` 0fbae7b; check for drift before executing.

Out of scope: any Free/Pro split (D-9), block-end transitions (Plan 052 and the recovery-week policy own
them), structural changes to days per week mid-block (block end), telemetry, notifications, Pro.

## 1. Problem

Taurifer watches the week only at the end of the block. `weeklySnapshot(date)` (`app.js:3968–3990`) already
computes the calendar week's completed and planned days, improved, flat and regressed lifts, fatigue flags,
records and a status word, and shows only the "0 of 4 sessions" line on Today (`:8739–8748`); the status word
is never rendered. Progress › Review is read-only while the block is active (`review.active_readonly`,
`renderReview`, `:4174–4205`); structural actions appear only at `block-complete`.

Two facts a coach would ask about every week are not recorded at all. **Pain** exists only as a swap reason
sent to telemetry (`SUBSTITUTION_REASONS`, `app.js:16190`; `:3113–3125`) and an abandon reason held in
memory (`:9006`). **Skips** leave no trace: `toHistoryRows` drops skipped exercises (`workout-draft.js:1711`)
and the draft's `skipReason` admits only `trim` (`:549, 1504`). Thesis §8.2 lists structured skip and pain
capture in the Free floor, and §7.5 says pain gets an immediate Free conservative path.

The only in-block adaptation today is Trim (`applyFatigueTrim`, `app.js:3447`): session-scoped, applied on
one tap with Undo, never touching the program. Nothing mid-block proposes, asks why, is approved, is
versioned and is evaluated, which is thesis §7.5's policy in one sentence.

## 2. Owner decision (2026-11-08)

**D-9.** The weekly review shows the week's facts (sessions done, lifts that moved, lifts that stalled, pain
reported) and offers a bounded, cause-matched proposal with approval. Both ship in the alpha; the Free/Pro
line is decided after. The proposed commercial target, recorded in the note's §5 and thesis §8.3: facts
Free, proposals Pro, and a Free lifter is never shown what Pro would have proposed, so the surface must read
whole with no proposal present.

## 3. The facts. Proposed.

### 3.1 Two records the week needs

Both are durable records keyed by session id beside `sessionTiming` (the existing precedent for per-session
facts that are not rows), written in the same commit as the session's rows, carried by transfer and backup.

- **`sessionEvents[sessionId]`**: `{v:1, skips:[{exerciseId, slotId, reason}], pain:[{exerciseId, slotId,
  kind:"pain"|"discomfort", swapped:boolean}]}`. `reason` is a closed enum: `time`, `recovery`, `pain`,
  `equipment`, `schedule`, `trim`, `other` (the existing abandon reasons plus `trim`). The draft gains
  `skipReason` for the lifter's skip (today only `trim`) and a per-exercise `discomfort` mark set from the
  exercise actions sheet ("Pain or discomfort on this lift") or implied by a swap with reason `pain`.
  `toHistoryRows` keeps dropping skipped exercises from `log`; the record carries them.
- **`adaptations`** (§4.3), on `programMeta`.

`workout-draft.js`, `durable-state.js` and the transfer contract change: PR 1 redeploys the Worker before
merge (Plan 077 §6.1).

**Amendment (owner, 2026-11-08):** the coach-layer Worker deploys once, from the final green integration head, before PR #687 merges to main, with the owner's go-ahead. A packet merge into `integration/coach-layer` reaches no phone and needs no deploy. This is a stated exception to hard rule 18's per-PR wording.

### 3.2 What the review states

For the **last completed calendar week** (Monday to Sunday, `weekStart`/`weekRange`, `app.js:1442–1444`,
the same week Today counts), from `weeklySnapshot` plus the two records:

- sessions done of planned, and which training days were missed;
- lifts that moved up, held and moved down (`compareExerciseSession`, the CONTEXT.md "Session outcome"
  rule), by name;
- lifts stalled: the same load for three sessions with no top-rep gain (`isStalled`, `:5990`), by name;
- pain or discomfort reported, by lift, and the swap made if one was;
- exercises skipped, by lift and reason;
- fatigue flags raised, and whether Trim was used.

Sentences, not tiles. No word about the lifter's discipline: "3 of 4 sessions; Thursday was missed" states
the fact and stops. The `weeklySnapshot` status word stays unrendered: "under target" and "productive week"
are verdicts.

### 3.3 Where

- **Progress › Review, while the block is active**: the read-only notice is replaced by "Last week" with the
  facts above, then "This week so far", then the block-to-date evidence the tab already shows. The
  block-complete actions are untouched.
- **Today, once per week**: on the first open in a new week after a week with at least one session, a card
  under the program strip summarises last week in two lines and opens Review. Dismissed per week in
  `uiPrefs.weekCardSeen` (the ISO week id). Never shown on a device with no sessions last week; nothing
  nags an absence.

## 4. The proposal. Proposed.

### 4.1 The policy, from thesis §7.5

Observe, interpret through the program's declared strategy, detect a **recurring** pattern, ask why, propose
one cause-matched change, obtain approval, version the change on the program instance, observe its effect.
One main variable at a time. The lifter can accept, change, snooze or decline. Pain gets the conservative
path at once, not at the week's end.

### 4.2 The v1 catalogue: four patterns, three changes

Bounded to what the program system can version today without a new compiler path. Days per week and
session length stay block-end changes (`CHANGE_KINDS` `fewer_days`, `shorter_sessions`,
`program-transition.js:220`).

| Pattern (over the last two completed weeks) | Ask why (closed enum) | Proposal |
| --- | --- | --- |
| **Recurring skip**: one lift skipped in ≥ 2 sessions, reason not `trim` | `time`, `equipment`, `pain`, `preference`, `other` | `swap_exercise` to a slot alternate (ADR 0019) if one exists, else `drop_exercise` for the rest of the block |
| **Recurring pain**: pain or discomfort on one lift in ≥ 2 sessions | (none; the mark is the why) | `swap_exercise` to an alternate with a different equipment class or movement, else `drop_exercise`; also offered immediately at the second mark, in the session (§4.1) |
| **Recurring fatigue**: a training day with ≥ 2 flagged lifts in ≥ 2 of its last 3 sessions, or Trim used twice | `recovery`, `time`, `schedule`, `other` | `reduce_sets`: one set fewer on that day's accessory lifts (not the first compound) for the rest of the block |
| **Stall with hard sets**: a lift stalled three sessions whose sets were logged at ≤ 1 left | (none) | no program change: the engine already holds; the review states it and points to the Why reader. Recorded so the lifter sees the pattern was seen |

Everything else the thesis lists (recurring override, overrun, schedule mismatch, unfinished transition)
is **observed and stated** in v1 and proposes nothing; the catalogue widens by evidence, not by guess.

### 4.3 Versioned changes on the program instance

`programMeta.adaptations: [{id, v:1, blockId, week, pattern, cause, kind, target:{slotId, exerciseId,
replacementId?, setsDelta?}, proposedAt, decision:"accepted"|"declined"|"snoozed", decidedAt, appliedEdit:{
expectedToken, intent}, evaluation:{week, outcome:"pattern_stopped"|"pattern_continued"|"insufficient"}}]`.

An accepted proposal is applied through the program editor's commit path (`adapter.commit({expectedToken,
nextDocument, intent})`, `program-editor.js:731, 1015`) with a new intent `adaptation_apply`, so the program
document, its token and the existing validation are the single write path; no second editor. The record is
the versioned change the Gated row asks for. Snooze is two weeks; a declined pattern is not re-proposed in
the block. The following week's review evaluates it and records the outcome in one line.

A proposal is never applied without the tap, never reorders or rewords an engine conclusion, and never
changes loads: those are the engine's.

### 4.4 Where the proposal appears

Under the facts in Progress › Review, as one card: the pattern in a sentence, the why question with its
chips, the proposed change with before and after, and Accept / Change / Later / No. "Change" opens the
editor on the affected slot. At most one proposal per week. With no proposal the card is absent and the
facts stand alone, which is the shape a facts-only tier would have later.

## 5. Changes by owner module

| Owner | Change |
| --- | --- |
| `workout-draft.js` | `skipReason` enum widened; a per-exercise `discomfort` mark and its command; the swap reason carried on the exercise; `toHistoryRows` returns `sessionEvents` beside rows |
| `durable-state.js` | The `sessionEvents` record written with the session's rows; validation; replica carry |
| `install-transfer-contract.js` | `sessionEvents`, the draft fields, `programMeta.adaptations` |
| `progress-model.js` | `buildWeekReview(log, sessionEvents, program, meta, week)` for the facts; `detectPatterns` over two weeks; pure |
| `program-transition.js` or a new `adaptation.js` | `proposeAdaptation(pattern, program, alternates)` returning the proposal and the `nextDocument`; validation; the evaluation rule. Pure. The owner picks the module in PR 2; the transition module already owns proposal validation and hash confirmation, which is the closer fit |
| `program-editor.js` | The `adaptation_apply` intent on the adapter's commit |
| `app.js` | The Review tab's active-block section; the Today week card; the exercise actions sheet's pain mark; the skip reason sheet; the proposal card and its four actions; `uiPrefs.weekCardSeen` |
| `index.html`, `styles.css` | The Review section, the card, the sheet; script revisions |
| `i18n-en.json`, `i18n-pt.json` | `review.week.*` facts, `review.pattern.*`, `review.why.*`, `review.proposal.*`, `focus.actions.discomfort`, `focus.skip_reason.*`; regenerate `i18n.js` |
| `sw.js` | Revisions from live `main` at merge |
| `docs/block-transition-provenance.md` | A section distinguishing mid-block adaptations from transitions; `adaptations` is not a transition record |
| `CONTEXT.md` | *Weekly review* already defined; add *Adaptation* and *Pattern* |

No telemetry change: the review and proposals are unmeasured in the alpha; a later event needs its own
approval under Plan 071.

## 6. Safety

- Pain's conservative path is immediate and Free by thesis §8.3: at the second pain mark on a lift, the swap
  sheet opens with alternates ordered by equipment difference; no proposal waits for Sunday.
- `sessionEvents` never contains free text; reasons are closed enums (the consented research path owns free
  text).
- A recovered or replicated draft carries the marks like any draft field; a session abandoned writes no
  record.
- An adaptation applies through the editor's token, so a concurrent edit is refused the way any stale editor
  commit is.

## 7. Tests (each red before its change)

- `test/workout-draft*.mjs`: skip reasons, the discomfort mark, `toHistoryRows`' events output.
- `test/durable-state*.mjs`, `test/install-transfer-contract*.mjs`: the two records round-trip, validate and
  are refused when malformed; the Worker suite per the RUNBOOK.
- New `test/week-review.mjs` (Node, pure): the facts for seeded weeks; the four patterns' detection over two
  weeks and their non-detection over one; the proposal's `nextDocument` for swap, drop and reduce; the
  evaluation outcomes.
- New `test/week-review-browser.mjs`: Review during an active block shows last week's sentences; the Today
  card appears once per week and never after an empty week; the proposal card's four actions; Accept
  applies through the editor and records the adaptation; the next week's review evaluates it; the page
  reads whole with no proposal.
- `test/program-editor-a.mjs`: the `adaptation_apply` intent commits and bumps the token.
- `test/progress-tabs.mjs`, `test/progress-lifecycle.mjs`: the block-complete actions are unchanged.
- `test/i18n.mjs`; the production syntax check.

## 8. Catalog states

- `progress/review-active` recaptured with "Last week" (sessions, lifts moved, one stall, one pain mark).
- New `progress/review-proposal` (recurring skip → swap to an alternate, the why chips, the four actions),
  `progress/review-evaluated` (last week's accepted change and its outcome line), `today/week-card`,
  `workout/discomfort-mark`, `workout/skip-reason`.

## 9. PR split

| PR | Content | Worker redeploy |
| --- | --- | --- |
| 1 | The two capture points (skip reason, discomfort mark), `sessionEvents`, the contract, the facts in Review and the Today card | **yes** |
| 2 | Pattern detection, the proposal module, the `adaptation_apply` intent, the card, the evaluation | no |
| 3 | Pain's immediate path at the second mark; docs | no |
