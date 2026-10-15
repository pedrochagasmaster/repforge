# Plan 070: Onboarding B's program editor (review and adjust before Activate)

- **Status:** IN PROGRESS. The owner approved the implementation on 2026-10-10.
- **Decision:** ADR 0020, decision 2, on PR #350 (`design/onboarding-mf-candidates`,
  not yet on `main`): Generate's result screen becomes the place where the
  recommendation is reviewed and adjusted. It replaces the preview step and the
  jump into the Build editor.
- **Spec:** candidate B's result screen in the PR #350 prototype
  (`docs/design/onboarding-mf/prototype/`, `?c=b&step=result&demo=1`). Its
  behaviour and structure are the reference. Its code is not: it runs in a
  worker, writes no app state and calls Motion directly.
- **Base:** `b92bc826` (main on 10 October 2026).
- **Out of scope:** the rest of B's onboarding (the Basics, the equipment step,
  B's question screens), Plan 068's inputs (block length, rep pattern, deload,
  inline offers; PR #345), the Program tab's editor, and #349's compiler fix.

## 1. What is true today

- `ROUTE_STEPS.recommend` and `.custom` end `result`, `preview`
  (`program-entry.js:75-97`). `activationReadiness` already lets `result`
  activate a generated candidate (`mergedRecommendation`, `program-entry.js:1803`).
  A setup draft saved at `preview` can still resume there, and the
  activation-conflict review returns every route to `preview` (`app.js:17237`, `:17243`).
- The result screen (`renderResultStep`, `app.js:16191`) shows the program read-only
  (`renderEntryWeek`), then the answer chips that regenerate in place, then
  why it fits, what was adjusted, the constraints, an alternative split and
  "Mais" with **Editar antes de usar** (`renderEntryMore`, `app.js:16546`).
- **Editar antes de usar** opens `program-editor.js` over the setup draft
  (`openEntryDraftEditor`, `app.js:11425`). That editor edits the flat row
  projection and syncs one cycle of the canonical definition per intent
  (`syncEditorCanonicalIntent`, `app.js:10803`). Every edit marks the set
  `manual`, which turns adaptive suggestions off (Plan 069 §1).
- An edited candidate reaches the setup draft through the setup-draft branch of
  `commitProgramEditorProposal` (`app.js:11320-11423`). Activation commits
  `result.preview.programDefinition` (`activateEntryPreview`, `app.js:17396`).
- `candidateActivationIssues` blocks an empty training day only for Build
  (`program-entry.js:1782`).

## 2. Owners

| Behaviour | Owner |
| --- | --- |
| Edit rules on a `ProgramDefinition`, the diff against the recommendation (row marks, change count), and deterministic replay of an edit log | **New `program-review.js`**, pure section. Runs in Node and the browser; reads the compiler (`validateProgramDefinition`, `findSubstitutions`, `estimateDaySeconds`, `MAX_SLOT_ALTERNATES`) and the raw catalog that the host passes in. |
| The review screen: header, changes bar, day tabs, exercise rows, exercise sheet, day menu, rename, reorder | **`program-review.js`**, `mountProgramReview(host, adapter)`. Same contract as `program-editor.js`: it receives a document, returns intents, and never reads storage, routes or flags. |
| Route steps, activation readiness, setup-draft normalization | `program-entry.js` |
| Where the screen mounts, the recommendation baseline, the commit of each edit into the setup draft, the undo log, catalog search, rebuild confirmation, activation | `app.js` |
| Strings | `i18n-en.json`, `i18n-pt.json` → `i18n.js` |
| Styles | `styles.css`, with existing tokens only |

`program-compiler.js` does not change.

## 3. Edit rules

All of them come from the prototype's `engine-worker.js` and ADR 0020's consequences:

- **Sets:** the count (1–8) applies to every cycle. A deload cycle keeps one set
  fewer, with a minimum of 1. Added sets copy the cycle's last set.
- **Rep range:** min and max shift together across every cycle, keeping any
  periodized offsets. Min ≥ 1, max ≥ min, max ≤ 30. A per-side slot keeps
  `repsPerSide`.
- **RIR per set** (0–4) applies to that set index in every cycle. A deload set
  is 2 higher, capped at 4.
- **Rest** (presets 60/90/120/150/180/240 s) applies to every set.
- **Swap** to a `findSubstitutions` candidate or any catalog movement that
  records reps. It copies the catalog-derived slot fields the compiler derives:
  metrics, laterality, loading model and bodyweight coefficient, muscles,
  execution mode. The ranges move to the new movement's rep semantic, and the
  new movement is dropped from the slot's alternates.
- **Alternates:** add, reorder and remove, up to `MAX_SLOT_ALTERNATES`. A slot's
  own movement can't be its alternate (ADR 0019).
- **Move** to another training day (appended), **remove**, **reorder within a
  day**, **add** from the catalog. An added slot is `role: "manual"` with 3 sets,
  modeled on an accessory slot, as the prototype does.
- **Rename** a day (`day.name`) or the program (`result.name`).
- Edited sets keep `status: "ready"`, so suggestions keep adapting to the
  edited targets. Their provenance source becomes `lifter_review`.
- Every edit runs through `validateProgramDefinition`. An edit that fails is
  refused and nothing changes. An empty training day is valid but blocks
  Activate (§5).
- Ids for added slots and sets come from the edit's position in the log, so
  replaying the same log on the same recommendation rebuilds the same
  definition.

## 4. What changes in the flow

- **Removed:** `preview` from the Recommend and Custom routes. A saved draft at
  `preview` on those routes resumes at `result` (normalization migrates the
  step; the stored result is unchanged). The activation-conflict review returns
  those routes to `result`. **Editar antes de usar** goes from the result
  screen. Build, Import and Shared keep their preview and editor.
- **The result screen** draws B's editor in place of today's program block:
  - the source kicker, the program name (tap to rename), and four facts: days,
    minutes per session, exercises, weeks;
  - the block row as a read-only fact (weeks · rep pattern · deload). Its
    "Alterar" arrives with Plan 068 slice B;
  - the changes bar (count, Desfazer, Restaurar), or the tap hint when nothing
    has changed;
  - day tabs with rest days and an empty-day pip;
  - the day panel: name (tap to rename), count and `estimateDaySeconds`
    minutes, the over-time line, `···` day menu, exercise rows (thumbnail or
    the empty tile, set lines with reps and RIR, muscle chips, change mark),
    and Adicionar exercício.
- **One exercise sheet** per row: head (movement, role · job, muscles); Séries
  ledger with RIR steppers; set count, rep range, rest; day time
  "a → b min" and the deload note; Trocar exercício (three engine candidates,
  then Mostrar mais, then Buscar no catálogo); Alternativas na sessão (list and
  suggestions); Mover para outro dia; Remover exercício; Pronto. The page
  behind repaints with every change.
- **Day menu:** Renomear dia, Reordenar exercícios (handle drag or arrows,
  Concluir), Adicionar exercício.
- **Catalog search** reuses the app's exercise picker (`openExercisePicker`),
  limited to catalog movements that record reps, for both add and replace.
- **Undo and restore:** Desfazer pops the last edit. Restaurar asks first, then
  clears the log. Removal, swap, move and add show a toast with Desfazer.
- **Rebuild asks first:** an answer chip or the alternative split regenerates the
  program. With adjustments present, B's confirmation runs first. Confirming
  discards the log.
- **Persistence:** each accepted edit commits the edited definition to the setup
  draft through the setup-draft commit path, factored out of
  `commitProgramEditorProposal` so both callers share it. The recommendation
  baseline is regenerated in memory from the draft's answers and seed, which is
  deterministic. The edit log lives in tab-scoped `sessionStorage`
  (`repforge_entry_review_v1`: draft id, baseline fingerprint, edit list). After
  a reload the log is replayed and kept only if it reproduces the saved
  definition. Otherwise the saved program stands and undo starts empty. Like
  the free-form session, the log is never exported, transferred or logged. It
  is cleared on activation, cancel, start over and regeneration.
- **Activate** commits the edited definition through today's path.
  `candidateActivationIssues` blocks an empty training day on every route, not
  just Build. The pinned footer shows the reason.

## 5. Shared, and not

Shared with the Program tab: the modal and sheet controller, the gesture
controller's sheet drag, the exercise picker, the toast, `exerciseDisplayName`
and the exercise media tile. Not shared: `program-editor.js` keeps its
document, intents and the Program tab exactly as they are. @dnd-kit stays
reachable only from `program-editor.js`. Reorder here is the prototype's
handle drag plus arrows.

## 6. The visual seam

B's editor ships while the questions before it are still today's. The result
screen keeps today's header, eyebrow and section progress. The editor fills the
program block. The answer chips, Why this program, What was adjusted,
constraints, the alternative split and Recomeçar stay below the day panel
under one section head, so today's regeneration paths keep working until B's
question screens replace them. Tokens, type, buttons and dark appearance are
today's.

## 7. Motion

Every animation goes through `motion-layer.js` and existing vocabulary.
Sheets use the existing sheet path (`navPush` in, `revealOut` out,
`gestureSettle` on a released drag). Rows that move use
`animateExerciseReorder` (`layoutShift`). The tab underline uses
`animateIndicator`. Toasts use the existing toast. Reduced motion draws
everything at rest. The interaction-runtime audit gets one row for the review
screen.

## 8. Telemetry

No new event and no new property. `program_activated` keeps reporting
`route: recommend|custom`. Edit counts and kinds are not sent. Adding them
would need an owner decision on the closed schema.

## 9. Catalog states and role inventory

States under `onboarding-recommend`, each with a manifest entry and
role-inventory rows:

- `result` (recaptured): the editor at rest with the tap hint.
- `result-changed`: a swapped, an added and a set-edited row with their marks,
  and the changes bar.
- `review-sheet`: the exercise sheet at its top.
- `review-sheet-swap`: the sheet scrolled to swap and alternates, with one
  alternate.
- `review-day-menu`: the day menu sheet.
- `review-reorder`: a day in reorder mode.
- `review-empty-day`: an emptied training day, its warning, and Activate
  blocked with its reason.
- `review-rebuild-confirm`: the confirmation before an answer chip rebuilds
  an adjusted program.

Recaptured because the result screen changed: `result-existing`,
`chip-editor-open`, `result-corrected`, `result-avoided`,
`replacement-confirm`, `activation-conflict` and `onboarding-custom/result`.

## 10. Slices and proofs

One PR. Each slice starts with a failing proof.

1. **This plan.**
2. **Edit rules.** RED `test/program-review.mjs` (Node), isolated because its
   boundaries are combinatorial and need no browser: deload set and RIR
   arithmetic, rep caps, the per-side retarget on swap, the alternates limit,
   validation of every edit, and replay determinism over a seeded sequence of
   random edits on generated programs. Then the pure section of `program-review.js`.
3. **Review screen and host.** RED: extend `test/generate-program-browser.mjs`.
   Generate, then edit sets, RIR, rest, rep range, swap (engine candidate and
   catalog search), alternates, move, remove, add, rename and reorder a day,
   undo, and restore then redo. Activate. The stored `ProgramDefinition` must
   deep-equal the edited one, survive a reload, and the first workout must
   start with the edited sets, reps, RIR and rest. Also: an emptied day
   blocks Activate, a reload mid-edit keeps the edits and the undo, a resumed
   `preview` draft opens at `result`, and Editar antes de usar is gone. Then
   the UI and host wiring.
4. **Catalog and governance.** Scenarios in `tools/ui-screens/screens-onboarding.mjs`,
   manifest and role inventory, recaptures under the browser lock, the motion
   audit row, the `AGENTS.md` storage note, and `?v=`/`CACHE` revisions per
   `AGENTS.md`.

`program-entry.mjs` keeps the route-step and migration contracts. The
accessibility suite covers the new controls through its existing entry pass.

## 11. Open owner questions (the prototype's behaviour is the default)

1. Undo after a reload: shipped as in the prototype (the log replays), held
   tab-scoped. The alternative is to forget undo on reload and keep only Restore.
2. The prototype adds a movement as a 3-set manual slot modeled on an
   accessory. Shipped as is.
3. Today's answer chips, why, adjusted and constraints stay below the editor
   until B's question screens land (§6). Moving or removing them is for the
   later B plan.
4. No telemetry for edits (§8).
