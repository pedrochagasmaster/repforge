# Program editor redesign: three candidates

**Status:** design candidates for the owner's choice. No production code changes.
**Asked by the owner, 2026-10-18:** "The program editor page is the one that needs the most polishing of all the screens we worked on recently. It needs a complete redesign."
**Scope:** the post-activation Program editor (Program tab → Editar), meaning `program-editor.js` and its host in `app.js`. Onboarding, Focus and the other tabs are out of scope.

Every frame is hand-built HTML and CSS on the live tokens, captured at 390 px in light and dark. Portuguese comes first; the two densest screens of each candidate are also in English. The HTML for each candidate is in its folder (`candidate-*/index.html?lang=pt|en&theme=light|dark`), and `capture.mjs` redraws the PNGs.

- [Recommendation](#recommendation)
- [What is wrong today](#what-is-wrong-today)
- [Research](#research)
- [The candidates](#the-candidates)
- [Side by side, per journey step](#side-by-side-per-journey-step)
- [What each candidate does with onboarding B's editor](#what-each-candidate-does-with-onboarding-bs-editor)
- [Data coverage](#data-coverage)
- [Decisions for the owner](#decisions-for-the-owner)
- [New strings](#new-strings)

## Recommendation

**Candidate A, "one editing language".** The Program editor becomes onboarding B's review screen (ADR 0020): day tabs, exercise rows, one exercise sheet, a changes bar with Undo, a live day estimate and a pinned Apply. I added the two things B never needed: a **Weeks** row that reads "Same in all 7 weeks" until a week differs, and a **Loads** block (Suggest loads, smallest load change, per-side question).

Why A:

1. **It is already approved.** The owner chose B's editor on 2026-10-10 and it ships in onboarding. A lifter who adjusted a recommendation during onboarding meets the same sheet, steppers, words and undo in the Program tab. B and C would add a second way to edit a program.
2. **It fixes every problem in the owner's screenshots.** Inputs have padding, the set summary uses Sans with Mono figures only, labels appear once, there is no jargon, and per-week detail stays folded until it is used. Replace and Remove move into the sheet with the other actions.
3. **It is the cheapest build.** `program-review.js` already draws the rows, the sheet, the steppers, the rest presets, the swap list and the alternates, and onboarding's edit rules (sets, rep range and RIR across weeks; deload offsets) already exist. The new work is the Weeks sheet, the Loads block and wiring all of it to `program-editor.js`'s intents.

What A costs: B's rows show one line per set, so a five-exercise day is about two and a half screens tall. C's table fits the same day in one. The exercise sheet also gets longer than onboarding's. If the owner wants the overview denser, A can take C's one-line row ("3 × 4–6 · RIR 2·1·1") without changing anything else. That is the fallback I would try first.

My second choice is **B**. It has the clearest hierarchy, and its "only what differs" list of exceptions is the best answer here to per-week and per-set targets. But it adds a third navigation level and a design language that exists nowhere else in the app. **C** is the right tool for someone who edits a lot. At 390 px in Portuguese it is tight, and a full-row table of figures is the hardest of the three to read in a gym. I would keep it as a later "table view" if usage shows heavy editors.

## What is wrong today

| The owner's phone, 2026-10-18 | | |
| --- | --- | --- |
| <img src="current/phone-editor-inputs-no-padding.png" width="230"> | <img src="current/phone-editor-set-targets-labels.png" width="230"> | <img src="current/phone-editor-cycle7-timer-pill.png" width="230"> |
| Name fields have no inner padding. The set summary is all Mono. | Labels are doubled ("Reps / REPS REPS", "Rest (seconds) s") with no min or max distinction, and "Metric composition" is jargon. Every week × set is expanded. | Replace and Remove float between rows. The "Cycle 7" header overlaps the status bar. The timer pill covers a row. |

| Catalog, PT light: Suggest loads | Catalog: alternates and row actions | Catalog: day name refused |
| --- | --- | --- |
| <img src="current/catalog-editor-suggest-loads.png" width="230"> | <img src="current/catalog-editor-alternates.png" width="230"> | <img src="current/catalog-editor-day-name-refused.png" width="230"> |

What I found, in order of weight:

1. **No hierarchy.** Program, days, exercises, weeks and sets are all drawn at the same level, as bordered fields. Nothing says what matters most, and the one thing most edits touch (sets × reps × RIR) has the same weight as the smallest load change.
2. **The storage shape is the screen.** The definition stores each week × each set, so the editor shows each week × each set: a 3-set exercise over 7 weeks is 21 field groups, 84 inputs. Most programs repeat the same values in every week, and the screen never says so.
3. **Labels are doubled or missing.** "Reps" appears as a legend and then twice as an uppercase label with no min or max. "Rest (seconds)" also carries a unit "s". The label "Metric composition: Load + reps" is jargon.
4. **The type mixes roles.** The set summary ("3 × 4–6 reps", "5 exercises") is fully Mono, including the words. The contract asks for Mono on values, not on language.
5. **Actions float.** Replace and Remove sit between one exercise's alternates and the next exercise's name field. The row menu (⋮) holds More details, Move up, Move down and Move to another day; the day menu holds Reorder and Remove day.
6. **The current week leaks.** The sets stepper edits only the current week ("SETS · CYCLE 1"), while the per-week targets below it list every week. Onboarding's sheet applies a set count to every week.
7. **Small breakage.** Inputs have no padding, the sticky "Cycle 7" head overlaps the status bar, and the timer pill covers content.

## Research

The Appllama library (research only; it renders nothing) does not carry MacroFactor *Workouts*. I used the owner's local MacroFactor Workouts screenshots for that app, as onboarding did. The research used 9 Appllama credits, and no third-party screenshot is committed.

| App | What it does | What I took |
| --- | --- | --- |
| **MacroFactor Workouts** (owner's screenshots: the program-cycle preview) | Day tabs including rest days, "6 exercises · estimated 51 min", each exercise as a thumbnail, numbered set lines (reps) with an RIR badge, and muscle chips. The whole week reads on one scroll. | It is the source of onboarding B's review screen. A keeps it as is; C keeps the estimate and the day-as-a-unit idea. |
| **Hevy**: routine builder and exercise options sheet | The routine editor is a list of exercises, each with a SET / KG / REPS table and "Add set". Rarer actions (reorder, replace, superset, remove) are in a ⋮ sheet, with Remove last in red. | A per-set table appears only where per-set values are edited (A's week and B's exception), and Remove is always the last row of an action list (all three). |
| **Goodbudget**: edit budget | Categories as plain hairline rows: name on the left, a right-aligned amount, a drag handle, and a red minus to delete. A total sits in the footer. | C's table: one row per item, right-aligned figures in a column, and swipe-to-remove in place of a delete column. |
| **Fleur**: budget category editor | A two-column CATEGORY / AMOUNT block, with switches for the behaviors below it. | Group the numbers apart from the switches. Every candidate puts Suggest loads and the per-side choice in their own Loads block, below the prescription. |
| **Planner Pro**: event repeat | A short list of presets (None, Daily, Weekly…) and "Custom…" as the last row, with the rare case behind it. | The exceptions model: say "Same in all 7 weeks" and keep the per-week detail behind one row (A's Weeks, B's "Weeks and sets"). |
| **OmniFocus 4**: task inspector | One item is edited in a panel with up/down arrows that step through its siblings without closing it. | Recorded, not drawn: a next/previous control in A's exercise sheet would let a lifter walk a day without closing and reopening the sheet. Owner's call. |
| **Recipe Keeper**: edit recipe | Editing is split into tabs for the parts of one object (Overview, Ingredients, Directions, Notes). | A's day tabs reuse the same idea; within one day nothing is tabbed. |
| **Pestle**: new recipe | Grouped sections, each with its own "+" add row at its foot. | "+ Add exercise" at the foot of each day (all three), and "+ Add day" at the foot of the day list. |

## The candidates

### A. One editing language (recommended)

Onboarding B's review screen becomes the Program editor. Tabs pick the day; each exercise row shows its set lines; tapping a row opens B's exercise sheet. The sheet adds a Weeks row (a second sheet lists the weeks; one week opens as a per-set table) and a Loads block. The changes bar ("3 ajustes seus · Desfazer") is B's. Apply is pinned where the dock was. Leaving with unapplied changes uses today's dialog.

| Overview | Exercise sheet | Weeks, loads, per side | Weeks: one week open |
| --- | --- | --- | --- |
| <img src="candidate-a/png/a1-overview.pt.light.png" width="190"> | <img src="candidate-a/png/a2-exercise.pt.light.png" width="190"> | <img src="candidate-a/png/a3-exercise-loads.pt.light.png" width="190"> | <img src="candidate-a/png/a4-weeks.pt.light.png" width="190"> |
| **Swap (alternates first)** | **Remove (undo) and add** | **Rename and reorder days** | **Validation** |
| <img src="candidate-a/png/a5-replace.pt.light.png" width="190"> | <img src="candidate-a/png/a6-remove-add.pt.light.png" width="190"> | <img src="candidate-a/png/a7-days.pt.light.png" width="190"> | <img src="candidate-a/png/a8-validation.pt.light.png" width="190"> |
| **Leave with changes** | **Dark: overview** | **Dark: sheet** | **EN dark: weeks** |
| <img src="candidate-a/png/a9-done.pt.light.png" width="190"> | <img src="candidate-a/png/a1-overview.pt.dark.png" width="190"> | <img src="candidate-a/png/a2-exercise.pt.dark.png" width="190"> | <img src="candidate-a/png/a4-weeks.en.dark.png" width="190"> |

### B. Progressive disclosure

Three pushed pages: program (a ledger of days), day (a ledger of exercises with a one-line prescription each), and exercise. The exercise page shows the prescription that holds for every week. Under it, one line says "Same in every week". Opening it lists **only the exceptions**; each exception is a per-set table with the differing cells outlined. Done is a **Review changes** page where every change has its own Undo, ahead of Apply and Discard.

| Program | Day | Exercise | Exceptions open |
| --- | --- | --- | --- |
| <img src="candidate-b/png/b1-overview.pt.light.png" width="190"> | <img src="candidate-b/png/b2-day.pt.light.png" width="190"> | <img src="candidate-b/png/b3-exercise.pt.light.png" width="190"> | <img src="candidate-b/png/b4-exceptions.pt.light.png" width="190"> |
| **Suggest loads, per side** | **Swap** | **Remove (undo) and add** | **Rename and reorder days** |
| <img src="candidate-b/png/b5-loads.pt.light.png" width="190"> | <img src="candidate-b/png/b6-replace.pt.light.png" width="190"> | <img src="candidate-b/png/b7-remove-add.pt.light.png" width="190"> | <img src="candidate-b/png/b8-days.pt.light.png" width="190"> |
| **Validation** | **Review before Apply** | **Dark: exercise** | **EN dark: exceptions** |
| <img src="candidate-b/png/b9-validation.pt.light.png" width="190"> | <img src="candidate-b/png/b10-done.pt.light.png" width="190"> | <img src="candidate-b/png/b3-exercise.pt.dark.png" width="190"> | <img src="candidate-b/png/b4-exceptions.en.dark.png" width="190"> |

### C. Compact table

One page. Each day is a table (Exercise, Sets, Reps, RIR, Rest) with right-aligned Mono columns, the Direction D ledger applied to editing. A week selector (All, 1–7) switches the whole table to one week, and cells that differ from the other weeks are outlined. Tapping a cell opens a value pad modeled on the workout shelf, with the change's scope ("All weeks" or "Week 1 only"). Tapping a name opens a sheet with what the table can't hold. Swipe removes a row. Apply sits top right, as in Hevy's Save.

| Overview | Edit a cell | Exercise sheet | Week 7 and its sets |
| --- | --- | --- | --- |
| <img src="candidate-c/png/c1-overview.pt.light.png" width="190"> | <img src="candidate-c/png/c2-cell.pt.light.png" width="190"> | <img src="candidate-c/png/c3-exercise.pt.light.png" width="190"> | <img src="candidate-c/png/c4-exceptions.pt.light.png" width="190"> |
| **Swap** | **Swipe to remove, add** | **Day menu** | **Validation** |
| <img src="candidate-c/png/c5-replace.pt.light.png" width="190"> | <img src="candidate-c/png/c6-remove-add.pt.light.png" width="190"> | <img src="candidate-c/png/c7-days.pt.light.png" width="190"> | <img src="candidate-c/png/c8-validation.pt.light.png" width="190"> |
| **Cancel with changes** | **Dark: overview** | **EN light: overview** | **EN dark: week 7** |
| <img src="candidate-c/png/c9-done.pt.light.png" width="190"> | <img src="candidate-c/png/c1-overview.pt.dark.png" width="190"> | <img src="candidate-c/png/c1-overview.en.light.png" width="190"> | <img src="candidate-c/png/c4-exceptions.en.dark.png" width="190"> |

Every frame in both themes is in `candidate-*/png/` (`<screen>.<lang>.<theme>.png`).

## Side by side, per journey step

| Step | A. One language | B. Progressive disclosure | C. Compact table |
| --- | --- | --- | --- |
| Overview | Day tabs; rows with thumbnail and set lines; changes bar; pinned Apply | Ledger of days; facts; changes count with Review; pinned Apply | Every day as a table on one page; week selector; Apply top right |
| Open an exercise | Bottom sheet (onboarding's) | Pushed page | Tap a value: pad. Tap a name: sheet |
| Sets, reps, RIR, rest | Steppers and rest presets, applying to every week | Steppers; RIR as one cell per set; rest stepper | Value pad with an "All weeks / this week" scope |
| Suggest loads, per side | Loads block lower in the sheet | Loads section on the page; it says when it evens out RIR, with Undo | In the name sheet; per side as a segmented control |
| Week and set exceptions | Weeks row → week list → one week open as a per-set table | Only the exceptions are listed; each is a per-set table; "+ Add exception" | Pick a week: differing cells are outlined; a name opens its set rows |
| Swap, with alternates | Sheet: your alternates, then same job, then search | Page: search, your alternates, same job | The add picker with your alternates pinned first |
| Remove, add | In the sheet; toast with Undo; "+ Add exercise" at the day's foot | In the exercise page's action list; toast with Undo | Swipe; toast with Undo; "+ Add exercise" row |
| Rename, reorder days | Day ··· → "Training days" sheet with handles and rename | Program page → Reorder mode with handles and rename | Day ··· menu: Rename, Move day up or down |
| Validation | The empty day says so on its tab and in the day; Apply is disabled with the reason above it | The field says what is wrong; a banner at the top; Apply names the exercise | The cell turns red with its reason under the row; a banner counts the issues |
| Done with changes | Today's dialog (Apply, Discard, Keep editing) | Review page: each change with Undo, then Apply or Discard | Today's dialog |

## What each candidate does with onboarding B's editor

- **A converges.** It reuses B's rows, sheet, steppers, rest presets, swap list, alternates, changes bar and estimates, and `program-review.js` would draw both surfaces. It adds what B doesn't need (the Weeks sheet, the Loads block, notes and muscles for custom movements, metrics) as sections that onboarding hides. The decision: **one editor, two hosts.**
- **B shares B's words, not its layout.** It uses the same strings (Séries, Faixa de repetições, Descanso entre séries, Trocar exercício, Alternativas) and the same edit rules (a set count applies to every week), but on pushed pages, not a sheet. The decision: **diverge on purpose**, because the installed program carries more (exceptions, loads, manual targets) than a fresh recommendation does.
- **C diverges.** It uses B's swap list and alternates in its sheet, but the main surface is a table with no counterpart in onboarding. The decision: **a power tool**, kept apart from onboarding.

## Data coverage

Nothing the editor can edit today is lost. The left column follows `PROGRAM_EDITOR_INTENTS` in `program-editor.js` and what `validateProgramDefinition` accepts.

| Today (intent or field) | A | B | C |
| --- | --- | --- | --- |
| Program name (`program_name`) | Pencil on the name | Field on the program page | Pencil on the name |
| Day name, add, remove (`day_name`, `day_add`, `day_remove`) | Training days sheet | Program page; Reorder mode | Day ··· menu |
| Exercise add, remove, replace (`exercise_add`, `exercise_remove`, `exercise_replace`) | Day foot; sheet; swap sheet | Day foot; exercise page | Add row; swipe; name sheet |
| Move within or across days (`exercise_move`) | B's Reorder exercises (day menu); "Move to another day" in the sheet | Day page Reorder; exercise page action | Day menu Reorder exercises; name sheet |
| Sets (`prescription`): today per current week | Stepper for every week; Weeks for one week | Prescription stepper; exception for one week | Pad with the "All weeks / this week" scope |
| Reps min and max, load, duration and distance targets, per week × set (`metric_target`) | Week table: one column per metric in the slot's composition | Exception table, the same columns | Week selector and set rows, the same columns |
| RIR and rest per week × set (`prescription_field`) | Per-set RIR stepper and rest presets; Week table | RIR cells and rest stepper; exception table | RIR and Rest columns; set rows |
| Metric composition for a custom movement (`metric_composition`) | Sheet → More details (not drawn) | Exercise page → More details (not drawn) | Name sheet (not drawn) |
| Smallest load change (`load_step`) | Loads block | Loads section | Name sheet |
| Suggest loads, its RIR, per side (`suggest_loads`, `suggest_loads_rir`, `execution_mode`) | Loads block | Loads section | Name sheet |
| Alternates, up to 5 (`slot_alternates`) | Sheet list; swap lists them first | Exercise page; swap lists them first | Name sheet; swap lists them first |
| Notes, primary and secondary muscles (`exercise_field`) | Sheet → More details (not drawn) | Exercise page → More details (not drawn) | Name sheet (notes drawn) |
| Exercise name typed freely (`exercise_field: name`) | **Proposed change:** the catalog name is shown; a custom movement is renamed in its sheet | Same | Same |
| Apply, and Apply that discards an unfinished workout (`apply`, `apply_discard_workout`) | Pinned Apply; today's dialogs | Review page; today's conflict dialog | Apply top right; today's dialogs |
| Draft saved, undo of a move, conflict from another tab | Changes bar and toasts | Changes count and Review | Facts line and toasts |

Two things in the brief are **new capabilities** rather than redraws, and each needs an intent and the owner's approval: **reordering days** (no `day_move` intent exists today; the day order is the order of `structure`) and **per-change undo** (B's Review page; today's editor undoes only the last move).

Timed and distance work: the week tables take their columns from the slot's metrics, as `renderMetricTargets` does today. A plank shows "Tempo s" where a lift shows "Reps", and a load column appears only when the composition has load.

## Decisions for the owner

1. **The candidate:** A, B or C (or A with C's one-line rows).
2. **Mono for values only.** All three draw "4–6" in Plex Mono and "reps" in Plex Sans. This reads the type contract as "Mono for loads, reps, RIR, time and counts" and fixes the full-Mono summary in the screenshots.
3. **"Semana", not "Ciclo".** The editor says "Cycle N" today, while onboarding and the Program tab say week. The candidates say "Semana N" / "Week N".
4. **The switch is ink, not orange.** Suggest loads' switch is orange today, which the five-use orange budget doesn't allow. The candidates draw it in ink. The only orange left in the editor is the arrow on Apply.
5. **Typed names.** Today any row's name can be retyped. The candidates show the catalog name and let only custom movements be renamed.
6. **Reordering days** (a new capability, see Data coverage).
7. **While editing, the dock is replaced** by the edit session's own action bar (A, B) or by the Apply in the navigation bar (C). The edit session already hides the dock's role today; the candidates make it explicit.
8. **All new copy** (below) needs approval in both languages before it goes into the catalogs.

## New strings

Strings drawn with a catalog value already in `i18n-pt.json` / `i18n-en.json` are reused unchanged. These are new; the HTML records them with `n()`, and `strings.json` holds the generated list:

<!-- NEW-STRINGS -->

<details><summary><b>Candidate A</b>: 25 new strings</summary>

| PT | EN |
| --- | --- |
| Editar treino | Edit program |
| 4 dias · 7 semanas · você está na semana 1 | 4 days · 7 weeks · you are in week 1 |
| Semanas | Weeks |
| Igual nas 7 semanas | Same in all 7 weeks |
| Ajustar | Adjust |
| RIR em todas as séries | RIR on every set |
| A carga e as repetições passam a ser por lado. | Load and reps are now counted per side. |
| 1 semana diferente | 1 week differs |
| Semana 1 | Week 1 |
| Semana 2 | Week 2 |
| Semana 3 | Week 3 |
| Semana 4 | Week 4 |
| Semana 5 | Week 5 |
| Semana 6 | Week 6 |
| Semana 7 | Week 7 |
| Diferente | Differs |
| Carga kg | Load kg |
| Desc. | Rest |
| auto | auto |
| Contornado: diferente das outras semanas. Carga vazia: o Taurifer sugere. | Outlined: differs from the other weeks. Empty load: Taurifer suggests it. |
| Igualar às outras semanas | Match the other weeks |
| Suas alternativas | Your alternates |
| Mesma função | Same job |
| Arraste pela alça para mudar a ordem. Toque no nome para renomear. | Drag by the handle to change the order. Tap a name to rename it. |
| Adicionar dia | Add day |

</details>

<details><summary><b>Candidate B</b>: 33 new strings</summary>

| PT | EN |
| --- | --- |
| Editar treino | Edit program |
| 7 semanas · você está na semana 1 | 7 weeks · you are in week 1 |
| Reordenar | Reorder |
| Adicionar dia | Add day |
| 3 alterações | 3 changes |
| Revisar | Review |
| Prescrição | Prescription |
| Por série. Toque para mudar. | Per set. Tap to change. |
| Semanas e séries | Weeks and sets |
| Igual em todas as semanas | Same in every week |
| Ajustar | Adjust |
| Cargas | Loads |
| 1 exceção · semana 7 | 1 exception · week 7 |
| As outras semanas seguem a prescrição acima. | The other weeks follow the prescription above. |
| Semana 7 | Week 7 |
| Remover exceção | Remove exception |
| Carga kg | Load kg |
| Desc. | Rest |
| auto | auto |
| Contornado: diferente da prescrição. Carga vazia: o Taurifer sugere. | Outlined: differs from the prescription. Empty load: Taurifer suggests it. |
| Adicionar exceção | Add exception |
| 4 alterações | 4 changes |
| Sugerir cargas usa o mesmo RIR em todas as séries. As séries 1 a 3 ficaram com RIR 1. | Suggest loads uses one RIR on every set. Sets 1 to 3 now have RIR 1. |
| Carga e repetições contadas por lado. | Load and reps counted per side. |
| 5 alterações | 5 changes |
| Suas alternativas | Your alternates |
| Mesma função | Same job |
| A troca mantém séries, repetições e alternativas. | Swapping keeps sets, reps and alternates. |
| Arraste pela alça para mudar a ordem. Toque no nome para renomear. | Drag by the handle to change the order. Tap a name to rename it. |
| O mínimo não pode passar do máximo. | The minimum can't be above the maximum. |
| Corrija 1 valor em Remada curvada com barra. | Fix 1 value in Bent-over barbell row. |
| Revisar alterações | Review changes |
| Valem a partir da próxima sessão. O histórico não muda. | They apply from the next session. Your history doesn't change. |

</details>

<details><summary><b>Candidate C</b>: 26 new strings</summary>

| PT | EN |
| --- | --- |
| Editar treino | Edit program |
| 4 dias · 3 alterações não aplicadas | 4 days · 3 unapplied changes |
| Todas | All |
| Sér. | Sets |
| Desc. | Rest |
| Mínimo | Minimum |
| Máximo | Maximum |
| Todas as semanas | All weeks |
| Só a semana 1 | Week 1 only |
| Anterior | Previous |
| Juntos | Together |
| Um lado por vez | One side at a time |
| Carga e repetições contadas por lado. | Load and reps counted per side. |
| Banco no 4 | Bench on 4 |
| Semana 7 · contornado: diferente das outras semanas. | Week 7 · outlined: differs from the other weeks. |
| Série 1 | Set 1 |
| carga auto | load auto |
| Série 2 | Set 2 |
| Toque no nome para abrir as séries. Toque num valor para mudar. | Tap a name to open its sets. Tap a value to change it. |
| Suas alternativas | Your alternates |
| 1ª alternativa | 1st alternate |
| Mesma função | Same job |
| Mover dia para cima | Move day up |
| Mover dia para baixo | Move day down |
| Corrija 2 itens para aplicar. | Fix 2 items to apply. |
| O mínimo não pode passar do máximo. | The minimum can't be above the maximum. |

</details>
