# ADR 0021: The Program editor uses onboarding B's editing language (candidate A)

- **Status:** Accepted, 2026-10-18 (owner)
- **Decision owner:** Product owner, after comparing three candidates
- **Reference:** [`docs/design/program-editor-redesign/`](../design/program-editor-redesign/README.md)
  on PR #428 (`design/program-editor-redesign`), candidate A
- **Affects:** `program-editor.js` and its installed-program host in `app.js`;
  [ADR 0020](0020-onboarding-candidate-b.md) (whose review editor this reuses);
  [ADR 0019](0019-slot-alternates.md) (alternates stay editable)
- **Plan:** [Plan 074](../../plans/074-program-editor-candidate-a.md)

## Context

The owner asked for a complete redesign of the installed Program editor (Program tab →
Editar), calling it the screen that needed the most polish. The editor draws the
storage shape: every week × every set as bordered fields, all at one level. A 3-set
exercise over 7 weeks is 84 inputs. Labels are doubled ("Reps / REPS REPS"), the set
summary is all Mono, Replace and Remove float between rows, and the sets stepper edits
only the current week while the targets below it list every week. PR #428 records the
captures and the research.

Onboarding B already ships an editor for a generated recommendation (`program-review.js`,
ADR 0020, Plan 070): day tabs, exercise rows with set lines, one exercise sheet, a
changes bar with Undo, a live day estimate and a pinned action. A lifter who adjusted a
recommendation during onboarding meets a different editor after activation.

Three candidates were drawn on the live tokens:

- **A, one editing language:** the Program editor becomes B's review editor, with a
  Weeks row and a Loads block added for what an installed program carries.
- **B, progressive disclosure:** three pushed pages (program, day, exercise) that list
  only per-week exceptions, and a Review page before Apply.
- **C, compact table:** one page of per-day tables with a week selector and a value
  pad.

## Decision

1. **Candidate A.** The Program editor converges on onboarding B's review editor: day
   tabs; exercise rows with numbered set lines; the exercise sheet (set ledger with
   per-set RIR, Sets, Rep range, rest presets, the day estimate, swap with alternates
   first, alternates, move to another day, remove); the changes bar with Undo; the live
   day estimate; and Apply pinned where the dock was. It adds what B never needed:
   - a **Weeks** row that reads "Igual nas N semanas" until a week differs. It opens a
     week list, and one week opens as a per-set table of that week's targets, RIR and
     rest;
   - a **Loads** block: Suggest loads, its RIR, the smallest load change and the
     per-side question.
2. **Mono for figures only.** "4–6" is Plex Mono; "reps" is Plex Sans.
3. **"Semana", not "Ciclo"** in the editor (EN "Week").
4. **The Suggest loads switch is ink,** not orange. Apply's arrow is the editor's only
   orange.
5. **Typed names only for custom movements.** A catalog movement shows its catalog
   name; only a custom movement can be renamed, in its sheet.
6. **Day reorder is in scope** as a new capability with its own editor intent
   (`day_move`).
7. While editing, the editor's own action bar replaces the dock (it already hides the
   dock's role today).
8. Every new string is approved by the owner before release.

The editing rules stay `program-editor.js`'s, and `validateProgramDefinition` still
checks every Apply. A sets change in the sheet is one sets change per week, an RIR
change is one RIR change per week for that set, and so on. The host's existing
canonical sync, rebase and workout-impact rules see the same intents they see today.
`program-review.js` lends its markup, classes and sheet behaviour; its
recommendation-only edit log stays onboarding's.

## Alternatives

- **B** has the clearest hierarchy, and its exceptions list is the best answer to
  per-week targets. But it adds a third navigation level and a design language that
  exists nowhere else in the app. It was the second choice.
- **C** suits heavy editors. At 390 px in Portuguese it is tight, and a full table of
  figures is the hardest of the three to read in a gym. It stays a possible later
  "table view" if usage shows heavy editing.
- **A with C's one-line rows** ("3 × 4–6 · RIR 2·1·1") is the first fallback if the
  overview proves too tall. It changes only the row.

## Consequences

- One editor language serves both hosts' lifters: the words, sheet, steppers and undo
  learned in onboarding apply in the Program tab.
- Nothing editable today is lost. Plan 074's data-coverage table maps every
  `PROGRAM_EDITOR_INTENTS` entry to its place in A.
- Day reorder adds `day_move` to `PROGRAM_EDITOR_INTENTS`. It changes the order of
  `programStructure.days` and of the definition's days, not their fields. Plan 074
  records whether any draft, profile or validation shape changes; if one does, the
  install-transfer Worker is redeployed from the exact head before merge.
- The Build route's editor (onboarding setup draft) keeps today's layout until Plan 072
  S5 restyles Build; this decision covers the installed host.
- A further redesign of this editor needs evidence (edit completion, abandonment or
  lifter feedback), as ADR 0020 requires for onboarding.
