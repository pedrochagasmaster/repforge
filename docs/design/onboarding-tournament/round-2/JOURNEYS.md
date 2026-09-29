# Round 2 candidate journey interface

The acceptance journeys of the synthesis spec (§12.2: K-1 to K-9, K-14,
K-17, K-18, K-19, K-24) depend on each candidate's UI, so the candidate
scripts the taps and the verifier judges the outcome with real engine data.
This file is the contract between a Round 2 candidate
(`round-2/candidates/<id>.js`) and `tools/verify.mjs --round 2`. The layout
and content checks that need no candidate cooperation (K-10 to K-13, K-15,
K-16, K-21 to K-23) run on every checkpoint and are described at the end.

A working reference is `round-2/candidates/_example.js` (a plain placeholder,
not a design). Checks live in `tools/journey-checks.js`; the in-page api in
`tools/journey-api.js`; the journey registry (ids and start checkpoints) in
`tools/verify.mjs` (`JOURNEYS`, `CANCEL_VIEWS`). Keep the three in lockstep
with this file.

## 1. What a candidate exports

```js
window.__tournamentCandidates.d = {
  id: "d", name: "D · …",
  policy: { productDecisions: [] },        // e.g. ["PD-1"], ["PD-2", "PD-3"]; §10 ids only
  async mount(ctx) {},                      // as Round 1: { lang, theme, checkpoint, seed, root }
  async reach(checkpointId) {},             // as Round 1
  entry() {},                               // see below
  journeys: { "activate.recommend": async (api) => {}, … },
};
```

- `entry()` returns the production-shaped entry state the lifter is looking
  at, or `null` outside setup (landing, chooser, Today):
  `{ route, step, answers, result }`, where `route` is an `Entry.ROUTES` id,
  `step` is the `Entry.ROUTE_STEPS` id of the visible view (`"result"` for
  the Recommend/Custom review, `"preview"` for the other reviews, `"editor"`
  for Build), `answers` uses the engine's answer keys, and `result` is the
  exact result object the review shows and activation would commit (the
  shape `TF.entryState` accepts), or `null` before one exists. It must be
  JSON-serializable. The verifier reads it only; it never mutates it.
- `policy.productDecisions` lists the §10 product decisions the candidate
  depends on (the same list as its header and `round-2/manifest.md`). It
  relaxes exactly two checks: PD-2 / PD-3 drop the `sessionMinutes` /
  `preferredRestSeconds` probes of K-18, and PD-1 turns K-19 failures into
  warnings. Nothing else is relaxed.

## 2. Markup the verifier reads

| Attribute | Where | Used by |
| --- | --- | --- |
| `data-checkpoint="<id>"` | the element representing each of the 45 checkpoints (Round 1 rule) | audit, K-5, K-6, K-8 |
| `data-entry-step="<ROUTE_STEPS id>"` | the container of every route view, including the review (`result` / `preview`) and the Build editor (`editor`); an Edit-before-using editor keeps the review's step | K-5, K-6, K-24 |
| `data-advance` | the forward control of a question step (Continue, Apply, Generate) | K-9, K-18 |
| `data-activate` | every activation control (review and editor); when disabled: `disabled` or `aria-disabled="true"` plus `aria-describedby` naming the visible reason | K-1, K-4, K-18 |
| `data-change-statement data-changed="n" data-total="total"` | the change statement after a recompile or an avoidance (`TS.changeStatement` renders it) | K-9, K-17 |
| `data-persistent-action` | the pinned action region (recommended; the audit also detects bottom-anchored fixed/sticky regions) | K-11, K-14 |
| `#firstRunCreate`, `#firstRunImport`, `#firstRunSharedStart` | landing actions (SM-2) | K-23 |
| `data-privacy-open` | the landing Privacy control (`TS.privacyButton`; `TS.wire` opens the shared stub) | K-23 |
| `data-user-text` | optional, on text the lifter or a fixture supplied (a file name, a pasted line), so the raw-code and word checks skip it | K-10, K-15, K-16 |

Dialogs and sheets use `role="dialog"` or `role="alertdialog"`. The shared
dialogs already carry `data-checkpoint` (`cancel-confirm`, `replace-confirm`)
or `data-confirm` (`restart`, `ff-start-over`).

## 3. The `api` a journey receives

Every user action goes through the api. `api.tap` and `api.type` resolve one
visible element and ask the Node side to perform a real Playwright click or
fill on it (scrolling, actionability and hit-testing included), then wait
for the next frame. Each is one tap. A click that did not come through the
api (an untrusted `el.click()`) fails the journey. A journey may read its own
state to decide what to tap (for example which import rows are still open);
it must not change state except through taps and typing.

| Member | Meaning |
| --- | --- |
| `lang`, `cell` (`{ vw, text, lang }`), `journey`, `params` | context; `params.checkpoint` for the per-view `cancel` journey |
| `t(key, params)` | production catalog + overrides + shared `x.*` copy for `lang`. It does **not** include the candidate's own copy: a journey matching its own labels uses the candidate's `t` (`TF.makeT(lang, <candidate COPY>)`) |
| `await tap(target, { label, first })` | tap one visible element. `target`: a CSS selector, an `Element`, or `{ text, selector?, within?, exact? }` (text matches the accessible name or text). Fails if nothing or more than one element matches (unless `first: true`). Counts 1 tap |
| `await type(target, text)` | fill a field (fires `input`). Counts 1 tap |
| `find(target)`, `findAll(target)` | visible elements, no action |
| `await waitFor(targetOrFn, { timeout })` | wait until visible / true (default 4 s) |
| `snapshot(label, extra)` | record `entry()`, a DOM digest (visible checkpoints, entry steps, dialogs, `[data-activate]` / `[data-advance]` state and reasons, change statement, import rows, Today's program name, visible text) and the simulated device (active program, revision, kept draft) |
| `mark(label)` | record the tap count at a boundary (K-24 segments use `start` and `end`) |
| `await probe(label)` | K-18: records whether the visible `[data-advance]` blocks. A disabled control counts as blocked; an enabled one is tapped once (not counted) and must leave the step and result unchanged |
| `await checkOverlay(target, label)` | K-14: the confirm control must be fully inside the viewport, above the pinned region (unless it is inside a modal), and on top at its centre |
| `notOffered(what, why)` | declare that an optional action does not exist (only `"start-over"` is accepted, for K-7) |
| `fail(message)` | the candidate's own assertion failure |

A journey returns nothing (any return value is recorded). Its time limit is
60 s. After it returns, the verifier waits briefly, takes a final digest and
runs the check.

## 4. Preconditions

Every journey starts from a document opened at a checkpoint:
`round-2/app.html?c=<id>&cp=<start>&lang=pt&theme=light&text=…&journey=<id>`,
so the seed is the start checkpoint's seed in `TF.CHECKPOINTS` (`fresh`,
`existing`, `shared`, …) and the state is whatever the candidate's
`reach(start)` renders. Journeys run in two cells: **PT light 390×844 100%**
and **PT light 320×568 200%** (§12.2), locale `pt-BR`. All answers are the
shared fixtures (`TF.fixtureAnswers("rafael" | "custom" | "browse")`,
`TF.F.importFile`, `TF.F.freeform`, `TF.F.sharedFragments`).

## 5. Journeys

"Review" means the snapshot the journey takes on the review immediately
before tapping activation. "Engine" means the verifier's own computation.
Program equality compares, per exercise in order: day, library id (or folded
name), sets, min, max and progression strategy id; "exactly" also compares
the full progression object.

### K-1 · every route activates what was reviewed

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `activate.recommend` | `landing` (fresh) | From the landing, starts Recommend and answers Rafael (`fixtureAnswers("rafael")`: muscle growth, 6 to 24 months, most sessions, 3 days, 60 min, rest 120 s, commercial gym; no priorities, no avoidance), reaches the review, taps activation, waits for Today | `review` | reviewed answers equal the fixture; reviewed program equals `TF.compile("recommend", rafael)`; the active program equals the reviewed one exactly; Today (`activated-today`) shows the localized name ("Ganhar massa"). Total taps are reported for K-24 |
| `activate.custom` | `route-choice` | Custom with `fixtureAnswers("custom")` (balanced, 6 to 24 months, most, 4 days, 60 min, rest "Deixar o Taurifer escolher", commercial gym, chest prioritized, calves de-emphasized, include barbell bench press, avoid barbell curl for "não gosto"), the default structure, review, activate | `review` | as above against `TF.compile("custom", …)` with the default `splitPreference`; name "Massa + força" |
| `activate.browse` | `route-choice` | Browse with 4 days, 60 min, commercial gym; opens "Massa + força · 4 dias" (`balanced_4_v1`), activate | `review` | reviewed program equals that card's preview from `TF.browseCards`; active equals reviewed; localized card name on Today |
| `activate.build` | `route-choice` | Build named `t("entry.build_setup.name_placeholder")` ("Meu programa"), 3 days; Day 1 barbell back squat (`sq_bb`) and barbell bench press (`pr_bb`), Day 2 pull-up (`pd_bw`) and barbell row (`rw_bb`), Day 3 leg press (`sq_lp`), each with the shared editor's default prescription; activate from the editor | `review` (in the editor) | reviewed and active programs equal the shared build model (`TS.build.result`) for that plan; Today shows "Meu programa" |
| `activate.import-file` | `import-source` | Chooses the file, resolves every row still to review by taking the first proposed link, or "keep as written" when there is none, commits, activates | `review` | reviewed program equals `TF.importResult` of the fixture file with those decisions; active equals reviewed; Today shows "Treino do Rafael" |
| `activate.import-paste` | `ff-empty` | Pastes `TF.F.freeform.pasted.pt`, continues, opens ChatGPT, imports the reply from the clipboard (the gaps fixture), fills reps `10-12` and sets `3`, submits, resolves import rows as above, commits, activates | `review` | reviewed program equals the ported parse + gap assembly + import of those values; active equals reviewed; Today shows "Empurrar e puxar" |
| `activate.shared` | `shared-gate` (shared) | Taps Start, activates | `review` | reviewed program equals `TF.sharedResult` of the coach fixture; active equals reviewed; Today shows "Programa do treinador" |

### K-2, K-3 · the editor round trip

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `edit.roundtrip` | `rec-result` | Opens Edit before using, returns to the review without changing anything, activates | `before`, `after` | same exercise ids in the same order; every exercise's progression, sets, min, max unchanged; `result.explanation`, `preview.limitations`, `preview.reductions` unchanged; the review still shows the program name; active equals `after` exactly; Today reached |
| `edit.remove-two.editor` | `rec-result` | Opens the editor, removes two exercises, activates from inside the editor | `before` | active has `before − 2` exercises; every active exercise equals the reviewed one with the same id (progression, prescription, library id); Today reached |
| `edit.remove-two.review` | `rec-result` | Same removals, returns to the review, activates from the review | `before`, `after` | as above, plus `after` shows 16 and active equals `after` exactly |

### K-4 · Build gating

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `build.gating` | `build-setup` | Names the program "Meu programa", 3 days, opens the editor; then adds pull-up to Day 1; then barbell row to Day 2 and leg press to Day 3; activates | `empty`, `partial`, `ready` | `empty`: the visible `[data-activate]` is disabled and its `aria-describedby` reason names Dia 1, Dia 2 and Dia 3 and has no raw code; `partial`: still disabled, names Dia 2 and Dia 3, not Dia 1; `ready`: enabled; active equals the built plan; Today shows "Meu programa" |

### K-5 · Cancel is a question, Keep keeps

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `cancel` (run once per start in `CANCEL_VIEWS`) | each of `rec-goal`, `rec-background`, `rec-schedule`, `rec-environment`, `rec-priorities`, `rec-result`, `custom-priorities`, `custom-exercises`, `custom-shape`, `custom-result`, `browse-filters`, `browse-list`, `browse-preview`, `build-setup`, `build-empty`, `build-ready`, `ff-empty`, `ff-reply`, `ff-gaps`, `ff-unreadable`, `import-source`, `import-review`, `import-preview`, `shared-preview` | Taps this view's Cancel (the start is in `api.params.checkpoint`) | none | a dialog with `data-checkpoint="cancel-confirm"` is visible, and the entry state (route, step, answers) and the kept draft are unchanged; for `shared-preview`, the gate is visible instead and nothing is persisted |
| `cancel.keep-resume` | `rec-schedule` | Chooses 4 days, taps Cancel, taps Keep, then goes to wherever the candidate offers resume (O-10) and continues | `before` (after choosing 4 days), `kept` (after Keep), `resumed` | `kept`: `TF.device.draft` holds step `schedule` with the same answers as `before`; `resumed`: `entry()` is Recommend / `schedule` with the same answers and `[data-entry-step="schedule"]` is visible |

### K-6 · Back from every review

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `back.recommend` | `rec-result` | Taps the review's Back | `after` | no dialog; not the landing; a route step other than `result`/`preview` is visible; same route; answers unchanged |
| `back.custom` | `custom-result` | Same | `after` | same |
| `back.browse` | `browse-preview` | Same | `after` | `[data-entry-step="catalogue"]` visible; same route; days, minutes and environment unchanged |
| `back.import` | `import-review` | Resolves the open rows (rule of `activate.import-file`), commits, taps Back from the preview | `decided`, `preview`, `back` | `preview` shows `[data-entry-step="preview"]`; `back` shows `import-review` with the same row targets and badges as `decided` and no row reopened |
| `back.shared` | `shared-preview` | Taps Back (or the review's Cancel) | none | the gate is visible; nothing active, no draft |

### K-7 · whole-draft destruction confirms

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `destroy.review-start-over` | `rec-result` | Taps Start over, then the confirmation's cancel. A candidate without Start over calls `api.notOffered("start-over")` and returns | `asked`, `after-cancel` | a dialog opened; route, step, answers, result fingerprint and size unchanged at both snapshots; dialog closed after cancel |
| `destroy.paste-restart` | `ff-reply` | Taps Recomeçar, then keeps | `asked`, `after-cancel` | a dialog shows `entry.freeform.confirm_start_over`; after keeping it is closed and the reply stage is still there |
| `destroy.discard-draft` | `rec-schedule` | Taps Cancel, then Discard | `asked`, `discarded` | `asked`: `cancel-confirm` visible and state unchanged; `discarded`: no kept draft, dialog closed |

### K-8 · configured users never see the first-run landing (seed `existing`)

| Id | Start | The candidate does | The verifier asserts |
| --- | --- | --- | --- |
| `existing.back` | `hub-existing` | Leaves the chooser by its Back / close | no trace step and no final state shows the landing; Today visible; active program unchanged |
| `existing.cancel-keep` | `hub-existing` | Starts Recommend, answers the goal, Cancel, Keep | same |
| `existing.cancel-discard` | `hub-existing` | Starts Recommend, answers the goal, Cancel, Discard | same |
| `existing.replace-cancel` | `replace-confirm` | Taps "Manter {current}" | no landing; replacement dialog closed; the review visible; active unchanged |
| `existing.conflict` | `activation-conflict` | Taps "Revisar de novo" (snapshot `reviewed`), then activation | `reviewed` shows the review; the final state shows `replace-confirm`; no landing; active unchanged |

### K-9 · pain avoidance

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `avoid.pain` | `rec-priorities` | Prioritizes chest (fixture), searches and selects barbell bench press (`pr_bb`), then chooses "Dor ou desconforto", then continues to the review | `pending` (exercise chosen, no reason), `reasoned`, `review` | `pending`: `[data-advance]` disabled; `reasoned`: enabled and the production `entry.priorities.pain_note` visible; `review`: answers avoid `pr_bb` for `pain`, the exercise name and the reason are shown, and the change statement equals the identity diff between the program without and with the avoidance (today: no exercise changed) |

### K-14 · overlays above the pinned region

| Id | Start | The candidate does | The verifier asserts |
| --- | --- | --- | --- |
| `overlays` | `rec-result` | Opens each answer editor, sheet or panel the review offers, calls `api.checkOverlay(<its confirm control>, <label>)` for each, closes it without applying | at least one overlay checked; every check passed |

### K-17, K-24 · recompiles and their statements

| Id | Start | The candidate does | Snapshots / marks | The verifier asserts |
| --- | --- | --- | --- | --- |
| `change.days` | `rec-result` | Changes days per week to 4 from the review and applies | `changed` | answers have 4 days; the result equals `TF.compile` of Rafael with 4 days; `data-changed` / `data-total` equal `TF.identityDiff(3-day program, 4-day program)`, and the text states both numbers when n > 0 |
| `correct.environment` | `rec-result` | `mark("start")` right before opening the environment editor from the review; switches to limited home, adds dumbbells, band and safe pull (fixture correction); applies; `mark("end")` when the recompiled review shows | `corrected` | **hard bound**: taps between the marks ≤ 1 (open) + answer changes (1 + missing equipment + missing capabilities relative to `TF.env("limited_home")`, today 4) + 1 (apply) = 6; no view with a `data-entry-step` other than `result`/`preview` appears between the marks; the environment equals the correction; the result equals the engine's; the statement equals the identity diff. Segment taps reported for K-24 |
| `avoid.from-review` | `rec-result` | `mark("start")`, avoids barbell bench press for pain through whatever the review offers, reaches the recompiled review, `mark("end")` | `review` | answers avoid `pr_bb` for pain; the statement equals the identity diff against Rafael's program. Segment taps reported for K-24 |

### K-18 · Recommend asks every required answer

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `recommend.required` | `rec-goal` | Walks Recommend with Rafael's answers. Immediately before giving each of `desiredResult`, `structuredExperience`, `recentConsistency`, `daysPerWeek`, `sessionMinutes`, `preferredRestSeconds`, `environment`, calls `await api.probe("missing:<key>")`; then reaches the review | `missing:<key>` ×7, `review` | at each probe: the key is not answered in `entry().answers`, advancing is blocked, no enabled `[data-activate]` is visible and no result exists; `review` has a result. PD-2 / PD-3 candidates skip the minutes / rest probes |

### K-19 · all five jobs, and a helper that reaches each

| Id | Start | The candidate does | Snapshots | The verifier asserts |
| --- | --- | --- | --- | --- |
| `chooser.doors` | `route-choice` | For each of recommend, custom, browse, build, import: opens that door from the chooser, snapshots, returns to the chooser | `door:<job>` ×5 | `entry().route` is that job at each snapshot |
| `help.recommend`, `help.custom`, `help.browse`, `help.build`, `help.import` | `route-choice` | Opens the help affordance, answers it so that it ends at that job, and follows its suggestion until the route has started | `end` | `entry().route` is that job. Warning instead of failure for a PD-1 candidate |

## 6. Checks on every checkpoint (no candidate code)

`tools/audit-page.js` runs in all 45 checkpoints × the eight §12.1 cells:
runtime errors, missing marker and horizontal overflow (hard); K-10 raw
engine codes (snake_case or `code:` forms) in visible text or accessible
names; K-11 at most one persistent-action region, never taller than 33% of
the viewport (a screen without one passes); K-12 no word of a button,
choice title, chip, summary or heading split across lines, and no control
label overflowing its box (the H-12 counterpart); K-13 numeric option
values on one line; K-15 in PT, no banned or EU-PT word and no "Close"/"OK"
label (library exercise names and production catalog strings are exempt);
K-16 no "maioria", "most people", "seguro", "safe" outside production
strings, and no minutes on the chooser (`route-choice`, `route-help`,
`hub-existing`); K-21 in reduced-motion cells, no animation or transition
longer than 0; K-23 on `landing` at 390×844 100%, both actions in the first
viewport above any pinned region, the proof image with
`landing.shot.today_ready.alt` loaded, and a real tap on
`[data-privacy-open]` opening the Privacy stub. Warnings: targets under
44 px, clipped text (`.visually-hidden` excluded, H-14), K-22 (the
`rec-result` first viewport shows the program name, facts line and first
day at 390×844 100%) and K-20 (focus back on the Privacy control).

## 7. Running

```bash
node docs/design/onboarding-tournament/tools/verify.mjs --round 2 \
  --base http://127.0.0.1:8123/docs/design/onboarding-tournament/ --candidates d,e,f
# subsets: --cells 1,6  --checkpoints landing,rec-result  --journeys activate.recommend,cancel  --journeys none  --no-audit  --no-shots  --out DIR
```

`summary.md` lists hard failures by check id, warnings, one row per journey
and cell, and the K-24 tap counts.
