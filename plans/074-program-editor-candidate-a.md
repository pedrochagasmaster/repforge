# Plan 074: The Program editor in onboarding B's editing language (candidate A)

- **Status:** IN PROGRESS. The owner chose candidate A on 2026-10-18 and accepted every
  recommendation.
- **Decision:** [ADR 0021](../docs/adr/0021-program-editor-candidate-a.md).
- **Spec:** candidate A on PR #428 (`docs/design/program-editor-redesign/candidate-a/`,
  `index.html?lang=pt|en&theme=light|dark`, and its PNGs). Its structure, words and
  states are the reference. Its HTML is a hand-built mock, not code to copy.
- **Base:** `5a2a3928` (main on 17 October 2026).
- **Out of scope:** the Build route's editor (setup draft; Plan 072 S5 owns its
  restyle), onboarding's review screen, per-change undo beyond the last action,
  C's table view, next/previous inside the sheet (recorded in #428's research, not
  drawn), and any change to `program-compiler.js`.

## 1. What is true today

- Program tab → **Editar** sets `programEditMode` and mounts `program-editor.js` on
  `#programEditor` with `createInstalledProgramEditorAdapter()` (`app.js:11524`,
  `:11706`). The dock's action becomes **Pronto**, which runs `requestInstalledDone`
  (`app.js:11802`): Apply, or the leave dialog (Aplicar / Descartar / Continuar
  editando) when there are unapplied changes.
- The editor stages one intent per change. The host keeps them in
  `installedEditorSession` and checks each with `syncEditorCanonicalIntent`
  (`app.js:11263`) against the definition in `programMeta.programDefinition`. Apply
  refreshes the persisted head, rebases the intents onto it if another tab moved it
  (`editorRebaseDocument`, `app.js:11143`), confirms Suggest loads opt-ins, checks
  the workout draft (`installedEditorImpact`, `app.js:11483`) and commits through
  `commitProposedState`.
- `program-editor.js` draws every day as a card, every exercise as an expandable
  card with a name field, a sets stepper for the current cycle only, and a
  `<details>` per cycle with every set's metric targets, RIR and rest. Replace and
  Remove sit below the alternates; the row menu holds More details, Move up/down
  and Move to another day; the day menu holds Reorder and Remove day.
- `program-review.js` (`mountProgramReview`) draws onboarding B's editor over a
  recommendation's edit log. Its edit rules apply to a recommendation and replay
  from a baseline; its markup and classes (`review__*`, `review-sheet__*`,
  `review-step`, `review-seg`, `review-toast`) are styled in `styles.css`.

## 2. Owners

| Behaviour | Owner |
| --- | --- |
| The installed editor's screen: header, facts, changes bar, day tabs, day head, rows, exercise sheet, Weeks sheet, Loads block, Training days sheet, pinned Apply and its blocked reason | **`program-editor.js`**, a new A renderer in the same module. It keeps its contract: a document and a token in, intents out; no storage, route or flag reads. |
| Edit rules and intents | **`program-editor.js`**: the existing intents, plus `day_move`. A sheet control that means "every week" stages one existing intent per week (§4). |
| Shared visual vocabulary | **`program-review.js`**'s classes (`review__*`, `review-sheet__*`, `review-step`, `review-seg`, `review-toast`) and its `REST_PRESETS`: the A renderer draws with them, so both screens share one stylesheet and can't drift. Its edit log, replay and recommendation diff stay onboarding's. |
| Sheet, picker, dialogs, toast placement, motion, labels, catalog lookups | **`app.js`** host adapter (already supplied to both editors: `openSheet`/`closeSheet`, `chooseExercise`, `confirm`, `announce`, `afterModal`, `reducedMotion`). |
| Canonical sync, rebase, workout impact and commit of every intent, including `day_move` | **`app.js`** (`syncEditorCanonicalIntent`, `applyInstalledEditorIntent`, `installedEditorImpact`, `editorSnapshotFromDocument`). |
| Undo of the last change | **`program-editor.js`** keeps a stack of (document, intent count). The host gets one new adapter method, `revert(count)`, that truncates `installedEditorSession` to that many intents. |
| Strings | `i18n-en.json`, `i18n-pt.json` → `i18n.js` (generated; `tools/README.md`). |
| Styles | `styles.css`, existing tokens only. The Suggest loads switch uses the ink toggle. |
| Catalog states | `tools/ui-screens/screens-app.mjs`, `docs/ui-screens/manifest.json`, `tools/ui-role-inventory.json`. |

The Build host keeps the current renderer. The host chooses the renderer through one
adapter field (`layout: "review"`); nothing else in the module reads the host's
identity.

## 3. What is removed

From the installed editor's screen (the Build host keeps them until Plan 072 S5):

- the always-open per-cycle `<details>` forms and the current-cycle-only sets stepper;
- the free-text name field on catalog movements (decision 5);
- the row ⋮ menu and the floating Replace/Remove pair (they move into the sheet);
- dragging an exercise onto another day (a sheet's Move to another day does it; dragging stays inside the day's Reorder exercises list, with the same @dnd-kit pointer and keyboard drag and announcements);
- the day name input in the day card header (rename moves to the day head's pencil
  and the Training days sheet);
- "Ciclo N" and "Metric composition" as visible labels in the installed editor
  ("Semana N"; the composition lives in More details for custom movements only);
- the orange Suggest loads switch.

## 4. Data coverage

Every field editable today stays editable. The left column follows
`PROGRAM_EDITOR_INTENTS`.

| Today (intent) | In A | Intents staged |
| --- | --- | --- |
| Program name (`program_name`) | Pencil on the name → rename sheet | `program_name` |
| Day name (`day_name`) | Pencil on the day head, or the day's ··· menu; the Training days sheet in S2 | `day_name` |
| Add day (`day_add`), remove day (`day_remove`) | S1: the day's ··· menu (Adicionar dia; Remover dia, confirmed). S2: the Training days sheet | unchanged |
| **Day order (new)** | Training days sheet: handle drag, and Move up/down buttons as the accessible path | `day_move` (§6) |
| Add exercise (`exercise_add`) | + Adicionar exercício at the day's foot; day ··· menu | unchanged |
| Remove (`exercise_remove`) | Sheet → Remover exercício; toast with Desfazer | unchanged |
| Replace (`exercise_replace`) | Sheet → Trocar exercício: your alternates first, then Mesma função (`findSubstitutions`), then Buscar no catálogo (today's picker) | unchanged |
| Move within or across days (`exercise_move`) | Day ··· → Reordenar exercícios (handles and arrows); sheet → Mover para outro dia | unchanged |
| Sets (`prescription`, field `sets`) | Sheet: Séries stepper for every week; a deload week keeps its own count unless the lifter edits that week | one `prescription` per week whose count matched the shown count |
| Sets for one week | Weeks → week → + / − set | `prescription` for that week |
| Rep range (`metric_target`, reps semantics) | Sheet: Faixa de repetições min/max steppers, every week, every set | one `metric_target` per week × set that matched the shown range |
| Any metric target for one week × set (load, reps, duration, distance) | Weeks → week → per-set table, one column per metric in the slot's composition; an empty load reads "auto" | `metric_target` |
| RIR per set (`prescription_field`, `rir`) | Sheet ledger: per-set RIR stepper, every week (a deload week keeps its offset) | one `prescription_field` per week |
| RIR for one week × set | Weeks → week → RIR column | `prescription_field` |
| Rest (`prescription_field`, `restSeconds`) | Sheet: rest presets for every set of every week; Weeks → week → Desc. column for any value | one `prescription_field` per week × set |
| Match a differing week to the others | Weeks → week → Igualar às outras semanas: copies the most common week's sets onto it | the intents above for that week |
| Metric composition (`metric_composition`) | Custom movements only: sheet → Mais detalhes | unchanged |
| Notes, primary, secondary (`exercise_field`) | Sheet → Mais detalhes (muscles read-only on catalog movements, as today) | unchanged |
| Name (`exercise_field`, `name`) | Custom movements only: sheet → Mais detalhes (decision 5) | unchanged |
| Smallest load change (`load_step`) | Loads block stepper | unchanged |
| Suggest loads (`suggest_loads`), its RIR (`suggest_loads_rir`) | Loads block: ink switch; "RIR em todas as séries" stepper | unchanged |
| Per side (`execution_mode`) | Loads block: Como você faz este exercício? | unchanged |
| Alternates, up to five (`slot_alternates`, ADR 0019) | Sheet: Alternativas na sessão list with reorder and remove; + from the swap list | unchanged |
| Apply (`apply`), Apply that discards an unfinished workout (`apply_discard_workout`) | Pinned Aplicar alterações; today's leave and workout-conflict dialogs | unchanged |

"Every week" rules: a sheet control shows week 1's value (the current week's when the
program has a current week). It changes only the weeks that held that same value, so a
week the lifter made different stays different, and the Weeks row says so. Deload
weeks follow onboarding's rule: a sets change halves them (rounded up), an RIR change
keeps the deload offset.

## 5. Validation, Apply and Cancel

- **Removal fix (#434):** the host's `exercise_remove` sync now renumbers the day's remaining slots. Without it `validateProgramDefinition` refused every removal but a day's last one, in the classic layout too.
- **Validation** is unchanged at the boundary: every intent goes through
  `syncEditorCanonicalIntent`, and Apply goes through `confirmSuggestLoads`, the
  editor's `validation`, and `commitProposedState`, which validates the definition
  with `validateProgramDefinition`. An empty training day marks its tab with a pip,
  shows `entry.review.empty_day` in the day, and disables Apply with
  `program.editor.empty_days` above it. An incomplete Suggest loads opt-in opens its
  exercise's sheet at the field that needs an answer.
- **Apply** is the pinned bar. With no changes it reads Aplicar alterações and closes
  the editor (today's behaviour for an unchanged Done).
- **Cancel** (navigation bar) with changes opens today's leave dialog: Aplicar
  alterações, Descartar alterações, Continuar editando. Without changes it closes.
  The browser Back path keeps today's history guard.
- **Undo** in the changes bar and in toasts reverts the last change: the editor
  restores its document and calls `adapter.revert(count)` so the staged intents match.

## 6. Day reorder (`day_move`)

- Intent: `{ kind: "day_move", targetDay, fromIndex, toIndex, before: [labels], after: [labels] }`
  over the training days.
- Editor: the day's ··· menu → Treinos/Training days sheet. Each day has a handle
  (pointer drag; the press stops at the sheet, so the sheet's drag-to-dismiss never
  starts), its name (opens the rename sheet and returns), its exercise count, and
  Move up / Move down as the accessible path. + Add day sits at the foot. A move
  reorders `programStructure.days` and renumbers `order`; Undo takes it back.
- Host (`syncEditorCanonicalIntent`): the training days take the new order in the
  positions training days already hold; rest days stay where they are; every day is
  renumbered (`validateProgramDefinition` wants `order` to follow week order).
  `applyInstalledEditorIntent` refuses a move whose `before` no longer matches the
  head, so a second tab's reorder against the old order is a conflict and writes
  nothing. `installedEditorImpact`: a reorder is harmless to a draft (the draft
  keeps its day label).
- Today's day tabs are `days()`, the structure's order, which is what the next day
  is chosen from (`nextDayAfter`).
- **Shape check (P074-S2-SHAPE, `test/program-day-move-shape.mjs`):** no field is
  added or removed; only array order and `order` values change.
  `validateProgramDefinition` accepts the reordered definition, every day and slot
  keeps its keys, canonicalization is stable, and a setup link round-trips it in the
  new order. No draft or profile shape changes, so the install-transfer Worker does
  not need a redeploy for S2.

## 7. Catalog, roles and telemetry

- Catalog states (installed editor, PT light, with dark and EN where the manifest
  already pairs them): `editor` (overview), `editor-exercise-sheet`,
  `editor-loads` (replaces `editor-suggest-loads`), `editor-weeks`,
  `editor-week-open`, `editor-swap`, `editor-alternates` (re-pointed at the sheet),
  `editor-days`, `editor-day-name-refused` (re-pointed at the rename sheet),
  `editor-empty-day`, `editor-leave`. Each gets a manifest entry and role-inventory
  entries; none joins the fixed Plan 064 list in `tools/check-rules-only.mjs`.
  `progression-editor` is recaptured.
- The facts line under the program name reads the host's block copy ("Week 3 of 7", or that the block is ready for review), so it says what Today and the Program tab say.
- Telemetry stays inside the closed schema: `active_program_edited` with its existing
  `outcome` values is the only event. No new event or property; no free text, names or
  values.

## 8. Slices and proofs

Each slice starts with a failing browser journey at the highest boundary
(`node tools/run-tests.mjs <lane> --suite <stem>`), then the change, then the journey
green. One draft PR per slice; the editor slices land in order.

| Slice | Content | Proofs |
| --- | --- | --- |
| **S0** | This plan and ADR 0021 | Prose only |
| **S1** | The A renderer for the installed host: header, facts, changes bar with Undo, tabs, day head, rows, exercise sheet (ledger, Séries, Faixa, rest, estimate, swap, alternates, move, remove, Mais detalhes), Weeks sheet and one-week table, Loads block, pinned Apply, Cancel, leave dialog, empty-day state. Removes §3's controls from the installed host. Existing editor journeys move to the new controls without weakening their assertions. | **P074-S1-EDIT:** Program → Editar → change sets, rep range and RIR in the sheet → a week-7 exception in Weeks → swap to an alternate → Aplicar. The stored `programDefinition` matches in every week, survives a reload, and the next workout uses it. **P074-S1-CANCEL:** changes → Cancelar → Descartar leaves the stored program unchanged; Undo reverts the last change. **P074-S1-COVERAGE:** every intent in §4 is reachable from the new screen (one journey per group: loads, metrics for timed work, custom-movement details, alternates). **P074-S1-EMPTY:** an emptied day pips its tab and blocks Apply with the reason. |
| **S2** | Day reorder: `day_move`, the Training days sheet (rename, reorder, add, remove) | **P074-S2-REORDER:** reorder days → Aplicar → order persists after reload and the next workout follows it; a second tab's conflicting edit rebases or refuses. **P074-S2-SHAPE:** the §6 shape check. |
| **S3** | Catalog states, manifest, role inventory, recaptures of the program/editor flows | The catalog contract and role-inventory checks; recaptured PNGs. |

Revisions: every changed query-versioned script gets a new `?v=` and its exact
precache URL in `sw.js`; `CACHE` is bumped; all re-bumped above `main` at each final
rebase.

## 9. Owner gates

- **Strings:** the full new-string table (key, EN, PT, where used) goes to the owner
  through the coordinator as soon as it is final. Building continues meanwhile.
- **Shape:** S2 reports the §6 result before merge.
