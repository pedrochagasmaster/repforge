# UI screen catalog

Phone-frame captures of every user-visible Taurifer surface — 200 screens,
1163 frames. This folder is the visual reference for UI and Brand Designers.

The catalog is **mobile only**. Taurifer is a phone PWA and a desktop frame was
evidence nobody reviewed, so the manifest rejects non-phone viewports.

## Keeping it current

Whenever a change alters a user-visible surface (`index.html`, `styles.css`, `app.js`,
`program-entry-adapter.js`, on-screen copy in `i18n-*.json`, sheets, onboarding, or
install UI), regenerate before merging:

```bash
node tools/capture-ui-screens.mjs --affected --accept-visual-change
```

CI runs `tools/check-ui-screens.mjs` (every registered frame exists, no strays) and
`tools/compare-ui-screens.mjs` (committed frames still match a fresh capture). A stale
catalog fails the build — it does not pass quietly.

Never hand-edit a PNG.

## Release matrix

Coverage is risk-based rather than a full language × theme × text-size
product ([ADR 0012](../adr/0012-ui-overhaul-canonical-reconciliation.md)).
Broad normal-size coverage stays in both languages for every screen; the
demanding surfaces named in ADR 0012 additionally capture PT-BR at 200% text
(`pt-text200`, added by Plan 050). Document and component overflow assertions
run across every catalog screen — image comparison alone cannot tell a
designed scroller from a failure — and contrast is audited per rendered role
under WCAG 2.2 AA.

## Contextual guides

A contextual guide is a modal dialog, and the rendered-role audits skip what a modal
makes inert. Every state is therefore drawn on a device whose guides have been read, so
each surface is audited whole, and each of the eight guides has its own state that
replays it over its real surface: the `*-guide` states and `settings/guides-replay`.

## Naming

```
screens/<flow>/<screen>__<viewport>-<theme>-<locale>[-text200][-reduced].png
```

No ordinal prefixes: they encoded a capture order that went stale the moment a screen
was inserted or removed. Flow order lives in the manifest and is reflected below.

## Screens

### Onboarding — first run and hub

| Screen | Frames | What it shows |
| --- | --- | --- |
| [One-time landing](screens/onboarding-start/first-run__phone-390-light-en.png) | 7 | First empty visit. The hero: headline, subtitle, the Build pill, the Track link, three chips and Privacy, with the device-local seen state. The bands below it have their own scrolled states. |
| [One-time landing — proof](screens/onboarding-start/first-run-proof__phone-390-light-en.png) | 3 | Scrolled to the proof: seven steps over the real workout screen with the pinned phone, lens and rail, and the persistent Build control. |
| [One-time landing — three ways](screens/onboarding-start/first-run-ways__phone-390-light-en.png) | 3 | Scrolled to the three ways to start your training: the orange, surface and ink stripes, with the paste hand-off closed. |
| [One-time landing — outcomes](screens/onboarding-start/first-run-track__phone-390-light-en.png) | 3 | Scrolled to the three engine outcomes (add, hold, back off) with their next targets, and the strength-trend chart. |
| [One-time landing — your data](screens/onboarding-start/first-run-data__phone-390-light-en.png) | 3 | Scrolled to the ink band: the history stays on the phone, in three rows. |
| [One-time landing — questions](screens/onboarding-start/first-run-faq-open__phone-390-light-en.png) | 3 | Scrolled to the questions with the RIR answer open. |
| [One-time landing — close](screens/onboarding-start/first-run-close__phone-390-light-en.png) | 3 | Scrolled to the closing orange band with the Build pill and the Track link; the persistent Build control has stepped aside. |
| [Returning landing](screens/onboarding-start/first-run-returning__phone-390-light-en.png) | 7 | A later visit to a device with no program and no log, with nothing saved. The welcome-back headline and its line, the Build pill, the Track link and Privacy lead; the chips, the proof and the outcomes are left out, and the ways, the data promise, the questions and the closing band follow. |
| [Returning landing — setup saved](screens/onboarding-start/first-run-returning-resume__phone-390-light-en.png) | 7 | A later visit with a half-finished Recommend setup saved. The lead action names it (Continue choosing your program) in the hero and the closing band; tapping it opens the chooser's resume card. |
| [Entry hub](screens/onboarding-start/hub__phone-390-light-en.png) | 7 | B's hub: Recommend, Build and Import as choice cards, the setup-link note, Continue held until a choice. |
| [Entry hub — guide](screens/onboarding-start/hub-guide__phone-390-light-en.png) | 7 | The entry guide over the hub: the guide dialog, centred over the dimmed hub. |
| [Entry hub — Recommend chosen](screens/onboarding-start/hub-chosen__phone-390-light-en.png) | 3 | The hub with Recommend chosen and Continue enabled. |
| [Entry hub — existing program](screens/onboarding-start/hub-existing__phone-390-light-en.png) | 3 | Opened from Settings while a program is active, so replacement consequences are in view. |

### Onboarding — Recommend one for me

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Recommend — section map](screens/onboarding-recommend/intro__phone-390-light-en.png) | 3 | B's section map: Basics, Gym and equipment, Program, with Start with the basics. |
| [Recommend Basics 1 — sex](screens/onboarding-recommend/sex__phone-390-light-en.png) | 3 | Female, Male and Prefer not to say; the local-only note; Continue held until a choice; Skip. |
| [Recommend Basics 2 — birth date](screens/onboarding-recommend/birth-date__phone-390-light-en.png) | 3 | Day, month and year wheels at their starting date; the local-only note; Skip. |
| [Recommend Basics 2 — type a birth-date value](screens/onboarding-recommend/birth-date-typed__phone-390-light-en.png) | 3 | The year value opened for direct entry over the birth-date wheels. |
| [Recommend Basics 2 — invalid typed year](screens/onboarding-recommend/birth-date-typed-invalid__phone-390-light-en.png) | 3 | The year field remains open with its validation message after an unsupported value. |
| [Recommend Basics 3 — height](screens/onboarding-recommend/height__phone-390-light-en.png) | 3 | The centimeters/feet-and-inches toggle over the centimeter wheel; the local-only note; Skip. |
| [Recommend Basics 3 — height in feet and inches](screens/onboarding-recommend/height-ftin__phone-390-light-en.png) | 3 | The same screen with feet and inches chosen: two wheels. |
| [Recommend Basics 4 — weight](screens/onboarding-recommend/weight__phone-390-light-en.png) | 3 | The kilograms/pounds toggle over the ruler and its value; the note that weight sets bodyweight loads; Skip. |
| [Recommend Basics 4 — weight in pounds](screens/onboarding-recommend/weight-lb__phone-390-light-en.png) | 3 | The same screen with pounds chosen. |
| [Recommend Basics 5 — lifting experience](screens/onboarding-recommend/background__phone-390-light-en.png) | 3 | None, Beginner, Intermediate and Advanced with the engine's bands; required, no Skip. |
| [Recommend Basics 6 — cardio experience](screens/onboarding-recommend/cardio-experience__phone-390-light-en.png) | 3 | Four cardio choices; the local-only note; Skip. |
| [Recommend Gym 1 — where you train](screens/onboarding-recommend/environment__phone-390-light-en.png) | 3 | The six gym presets with Home chosen. |
| [Recommend Gym 2 — equipment](screens/onboarding-recommend/equipment__phone-390-light-en.png) | 8 | Home's thirteen equipment groups with the preset's ticked and the reset link disabled. |
| [Recommend Gym 2 — equipment adjusted](screens/onboarding-recommend/equipment-adjusted__phone-390-light-en.png) | 3 | Home with the bench ticked and the bands unticked, and the reset link enabled. |
| [Recommend Program 1 — goal](screens/onboarding-recommend/desired-result__phone-390-light-en.png) | 3 | Muscle growth, Strength and Both. |
| [Recommend Program 2 — days per week](screens/onboarding-recommend/days-per-week__phone-390-light-en.png) | 8 | Two to six days with four chosen and its split fact. |
| [Recommend Program 3 — session length](screens/onboarding-recommend/session-length__phone-390-light-en.png) | 8 | Up to 20 to up to 150 minutes, with 60 shown as the default. |
| [Recommend Program 4 — muscle priorities](screens/onboarding-recommend/muscle-priorities__phone-390-light-en.png) | 8 | Twenty-two muscles, each Less, Normal or More; glutes set to More and calves to Less; Skip. |
| [Recommend Program 4 — all twenty-two priorities](screens/onboarding-recommend/muscle-priorities-limit__phone-390-light-en.png) | 3 | All twenty-two muscles prioritized and accepted, with every More radio selected. |
| [Recommend Program 5 — deload](screens/onboarding-recommend/deload__phone-390-light-en.png) | 3 | The deload card switched on, marked Recommended. |
| [Recommend Program 6 — movement abilities](screens/onboarding-recommend/abilities__phone-390-light-en.png) | 3 | Seven yes, no or not sure questions in B's wording, with Skip pinned under Continue. |
| [Recommend — building](screens/onboarding-recommend/building__phone-390-light-en.png) | 3 | B's third checklist line is active after two lines complete, with generation still in the real worker and Show the program now available. |
| [Recommend — waiting for generation](screens/onboarding-recommend/building-pending__phone-390-light-en.png) | 3 | With reduced motion, B's checklist is complete and the real worker request remains pending with its waiting label visible. |
| [Recommend — recommendation and review](screens/onboarding-recommend/result__phone-390-light-en.png) | 8 | Onboarding B's review editor at rest: the source, the program name, four facts, the block row and its Change action, the day tabs with rest days and the first day's exercises with their sets, RIR and muscles; how it was built follows, with the pinned activation. |
| [Recommend — offered movement](screens/onboarding-recommend/result-confirm-offer__phone-390-light-en.png) | 3 | A real Worker-verified movement offer under its current exercise row, with the approved advice and confirmation action. |
| [Recommend — confirmed movement](screens/onboarding-recommend/result-confirmed__phone-390-light-en.png) | 3 | After confirming the offered movement: its row is marked Confirmed by you, Undo is available, and the changed rows are announced. |
| [Recommend — block inputs](screens/onboarding-recommend/result-block-sheet__phone-390-light-en.png) | 3 | The result's block sheet with seven regular weeks and the undulating rep pattern selected; the additional deload is off after exercising its switch. |
| [Recommend — equipment conflict](screens/onboarding-recommend/result-equipment-conflict__phone-390-light-en.png) | 3 | The result explains that the available candidates cannot complete the program, says nothing was saved, and offers Back to equipment with the adjustment preserved. |
| [Recommend — review with adjustments](screens/onboarding-recommend/result-changed__phone-390-light-en.png) | 3 | Three rows carry their marks (a set added, an engine swap, a movement added from the catalog) and the changes bar counts them with Undo and Restore. |
| [Recommend — exercise sheet](screens/onboarding-recommend/review-sheet__phone-390-light-en.png) | 7 | One exercise's sheet at its top: the movement, its role and job, the sets ledger with RIR per set, the set count, rep range and rest controls, and the day's time. |
| [Recommend — execution mode](screens/onboarding-recommend/review-sheet-execution-mode__phone-390-light-en.png) | 7 | The exercise sheet asks how an ambiguous per-side movement is performed, with both approved answers and the unresolved Review cue. |
| [Recommend — swap and alternates](screens/onboarding-recommend/review-sheet-swap__phone-390-light-en.png) | 3 | The exercise sheet scrolled to the engine's swap candidates, the catalog search and one in-session alternate with its suggestions. |
| [Recommend — day actions](screens/onboarding-recommend/review-day-menu__phone-390-light-en.png) | 3 | The day menu sheet: rename the day, reorder its exercises, add an exercise. |
| [Recommend — duplicate day name refused](screens/onboarding-recommend/review-day-name-refused__phone-390-light-en.png) | 3 | The day rename sheet keeps a duplicate name in the field and shows the existing linked alert. |
| [Recommend — reorder a day](screens/onboarding-recommend/review-reorder__phone-390-light-en.png) | 3 | A day in reorder mode: each exercise with its handle and up and down arrows, and Done. |
| [Recommend — an emptied day](screens/onboarding-recommend/review-empty-day__phone-390-light-en.png) | 3 | Every exercise of a training day removed: the tab's pip, the day's warning with Add exercise, and Activate disabled with its reason. |
| [Recommend — rebuild asks first](screens/onboarding-recommend/review-rebuild-confirm__phone-390-light-en.png) | 3 | An answer chip would rebuild an adjusted program: the confirmation to rebuild or keep the adjustments. |
| [Recommend — recommendation with a program active](screens/onboarding-recommend/result-existing__phone-390-light-en.png) | 3 | The merged candidate surface while the current program remains untouched. |
| [Recommend — answer editor open](screens/onboarding-recommend/chip-editor-open__phone-390-light-en.png) | 3 | The review with the days-per-week chip open on its inline editor: the same numeric cards as the question, an Update program action, and the pinned activation set aside. |
| [Recommend — after a changed answer](screens/onboarding-recommend/result-corrected__phone-390-light-en.png) | 3 | A changed answer rebuilt the program in place: the change statement with Before and Now, an added exercise tagged new, and its day open. |
| [Recommend — after avoiding an exercise](screens/onboarding-recommend/result-avoided__phone-390-light-en.png) | 3 | An exercise the program contained is avoided from the priorities editor: the statement, and the constraint line with Restore. |
| [Recommend — confirm replacement](screens/onboarding-recommend/replacement-confirm__phone-390-light-en.png) | 3 | The explicit archive-and-replace confirmation. History is not changed. |
| [Recommend — activation conflict](screens/onboarding-recommend/activation-conflict__phone-390-light-en.png) | 3 | Another tab changed the active program. The newer program stays active. |

### Onboarding — Build my own

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Build 1 — name and days](screens/onboarding-build/setup__phone-390-light-en.png) | 7 | The build_setup step: program name and day count before the editor opens. |
| [Build — empty days](screens/onboarding-build/editor-empty__phone-390-light-en.png) | 8 | Real empty day containers, Add exercise, Save draft, activation disabled. |
| [Build — partial draft](screens/onboarding-build/editor-partial__phone-390-light-en.png) | 8 | One populated day and one incomplete day. Activation stays disabled. |
| [Build — activation ready](screens/onboarding-build/editor-ready__phone-390-light-en.png) | 8 | A complete manual draft with supported progression and activation enabled. |
| [Build — editor alternates](screens/onboarding-build/editor-alternates__phone-390-light-en.png) | 3 | The Build editor (the classic layout) with its first exercise's in-session alternates: two chosen movements in order, each with move and remove controls, and Add alternate. |

### Onboarding — Import a program file

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Import — source](screens/onboarding-import/source__phone-390-light-en.png) | 3 | Import's first screen: Choose file and Paste a program, each with its explanation, and the way out to Build, before any mutation. |
| [Import — paste a program](screens/onboarding-import/freeform-empty__phone-390-light-en.png) | 3 | The free-form door as it opens: an empty field, and the hand-off to ChatGPT or Claude still unavailable. |
| [Import — paste ready to convert](screens/onboarding-import/freeform-filled__phone-390-light-en.png) | 7 | A pasted program with both app links live, the character counter, and the field the reply comes back into. |
| [Import — choose an assistant](screens/onboarding-import/freeform-stage2__phone-390-light-en.png) | 7 | Stage 2 with collapsed source summary, Edit button, ChatGPT and Claude buttons, and Preview prompt disclosure. |
| [Import — paste reply](screens/onboarding-import/freeform-stage3__phone-390-light-en.png) | 7 | Stage 3 with collapsed source summary, Import from clipboard, the "or paste" divider, reply textarea, Review CTA, Try another assistant, and Start over. |
| [Import — resolve gaps](screens/onboarding-import/freeform-gaps__phone-390-light-en.png) | 7 | Gap resolution screen with inputs for missing sets and reps, and the non-imported disclosure. |
| [Import — gap validation error](screens/onboarding-import/freeform-gaps-invalid__phone-390-light-en.png) | 3 | Gap resolution screen after submitting empty inputs, highlighting invalid fields with .is-invalid and aria-invalid. |
| [Import — unreadable reply](screens/onboarding-import/freeform-unreadable__phone-390-light-en.png) | 3 | Unreadable reply recovery block with Copy repair prompt and Try another assistant actions. |
| [Import — exercise review](screens/onboarding-import/review__phone-390-light-en.png) | 7 | Reviewing candidate matches: collapsed candidate chips, disclosure expanded, and unmatched flat escape hatches. |
| [Import — review](screens/onboarding-import/preview__phone-390-light-en.png) | 8 | A mapped exercise with manual progression ownership and provenance. |

### Onboarding — Shared setup link

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Shared setup — adaptive landing](screens/onboarding-shared/gate__phone-390-light-en.png) | 8 | The received-program gate names its program and training days, shows the no-history/no-change disclosure, and offers See the program plus Create a program from scratch. |
| [Shared setup — invalid landing](screens/onboarding-shared/invalid__phone-390-light-en.png) | 3 | An invalid setup link explains that nothing was saved and keeps safe Build and Track actions available. |
| [Shared setup — review](screens/onboarding-shared/preview__phone-390-light-en.png) | 7 | The received program in B's review with the Shared program source, Restore, and its block as received (no Change), before explicit activation. |

### Onboarding — resume and rule drift

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Resume setup](screens/onboarding-recovery/resume__phone-390-light-en.png) | 7 | The resumable notice after reload: route, step, recency, Resume, Start over. |
| [Rules changed](screens/onboarding-recovery/rules-drift__phone-390-light-en.png) | 7 | A draft whose compiler rules are stale. Rebuild is required before activation. |
| [Cancel setup — keep or discard](screens/onboarding-recovery/cancel-confirm__phone-390-light-en.png) | 3 | Cancel pressed mid-flow. A dialog over the current step asks whether to keep the draft or discard it; Escape or Continue setup returns to the step. |
| [Start over — confirm](screens/onboarding-recovery/restart-confirm__phone-390-light-en.png) | 3 | Start over pressed on a review. A dialog asks before the answers and the unused program are discarded; the active program does not change. |

### Today

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Today — no program](screens/today/no-program__phone-390-light-en.png) | 3 | A fresh device after leaving setup, with no program or workout controls. |
| [Today — ready to start](screens/today/ready__phone-390-light-en.png) | 12 | The Direction D lifter before Day 1 starts: the prescription table reads recommendation() for every exercise, with the verdict tally above it. |
| [Today — running rest bar](screens/today/rest-bar__phone-390-light-en.png) | 8 | The rest countdown remains visible after leaving the active workout. |
| [Today — choose another day](screens/today/day-picker__phone-390-light-en.png) | 8 | The day picker sheet open. |
| [Today — session complete](screens/today/done__phone-390-light-en.png) | 8 | The state after the day's session is logged. |
| [Today — deload week](screens/today/deload-week__phone-390-light-en.png) | 3 | The active program's deload cycle shows its recovery note. |
| [Resume saved draft](screens/today/draft-resume__phone-390-light-en.png) | 8 | Resume saved draft through production controls. |

### Workout logging

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Workout — focus mode](screens/workout/focus__phone-390-light-en.png) | 8 | One exercise at a time. |
| [Workout — first-set guide](screens/workout/first-set-guide__phone-390-light-en.png) | 8 | The first-set guide, opened by the first tap on a shelf field: the guide dialog centred over the dimmed Focus, holding the tap until Got it. |
| [Workout — workout menu guide](screens/workout/focus-utilities-guide__phone-390-light-en.png) | 8 | The focus-utilities guide: the guide dialog centred over the dimmed Focus. |
| [Workout — Focus, per-side target](screens/workout/focus-per-side__phone-390-light-en.png) | 8 | A generated bilateral press shows its per-side load label and adaptive target prefilled in ordinary Focus. |
| [Workout — why this weight, per-side loading](screens/workout/why-per-side__phone-390-light-en.png) | 8 | The generated bilateral press's Why sheet explains the multiplier and enabled bodyweight contribution. |
| [Workout — deload week](screens/workout/deload-week__phone-390-light-en.png) | 3 | Focus shows the recovery note during the program's deload cycle. |
| [Workout — Focus glossary definition](screens/workout/focus-glossary__phone-390-light-en.png) | 8 | A definition is open after tapping a glossary term in Focus. |
| [Workout — stale draft recovery](screens/workout/stale-draft__phone-390-light-en.png) | 8 | A conflicting tab won while this tab retains a pending field value and offers Reload latest or Copy value. |
| [Workout — draft persistence retry](screens/workout/persist-retry__phone-390-light-en.png) | 8 | A field write was interrupted; the exact pending value remains visible beside Retry and Copy value actions. |
| [Workout — invalid draft recovery](screens/workout/invalid-draft__phone-390-light-en.png) | 8 | An unreadable local draft remains untouched and offers a non-destructive copy action. |
| [Workout — rest running](screens/workout/rest-running__phone-390-light-en.png) | 8 | A logged set has started the rest: the clock, the drain bar and the next set's cue take the cue slot, and the rest controls take the shelf's pad row. |
| [Workout — rest done](screens/workout/rest-done__phone-390-light-en.png) | 8 | The rest has run out: the clock collapses to one line that counts the overrun up, the cue returns and the field pads come back. |
| [Workout — exercise note](screens/workout/exercise-note__phone-390-light-en.png) | 8 | The per-exercise note sheet. |
| [Workout — why this weight](screens/workout/why-this-weight__phone-390-light-en.png) | 8 | The recommendation inspector for a range lift: sentences first, each under a bold lead, the working behind See the working, the evidence footer. |
| [Workout — why this weight, mid-session](screens/workout/why-in-session__phone-390-light-en.png) | 8 | Opened after set 1 is logged: what the set showed (the observed capacity) before the prediction for the next set. |
| [Workout — why this weight, manual](screens/workout/why-manual__phone-390-light-en.png) | 8 | A Build-backed manual range: Why says Taurifer does not suggest a load without saying who chose the range. |
| [Workout — why this weight, setup required](screens/workout/why-setup__phone-390-light-en.png) | 8 | A generated asymmetric per-side slot with no known execution mode: Why asks the lifter to specify how they do the movement. |
| [Session details and map](screens/workout/session__phone-390-light-en.png) | 8 | Session details and map through production controls. |
| [Early finish confirmation](screens/workout/early-finish__phone-390-light-en.png) | 8 | Early finish confirmation through production controls. |
| [End without saving](screens/workout/abandon__phone-390-light-en.png) | 8 | End without saving, with a reason chip chosen, through production controls. |
| [Exercise actions](screens/workout/exercise-actions__phone-390-light-en.png) | 8 | Exercise actions through production controls. |
| [Warm-up role](screens/workout/warmup-actions__phone-390-light-en.png) | 8 | Warm-up role through production controls. |
| [Session reorder](screens/workout/reorder__phone-390-light-en.png) | 8 | Session reorder through production controls. |
| [Set correction](screens/workout/correction__phone-390-light-en.png) | 8 | Set correction through production controls. |
| [Logged sets](screens/workout/logged-sets__phone-390-light-en.png) | 8 | Layout D: a set is logged and the rest runs; the table's disclosure is open, the logged row back in place above the open set and the next one. |
| [Skipped exercise actions](screens/workout/skipped-actions__phone-390-light-en.png) | 8 | workout/skipped-actions |
| [Substituted exercise actions](screens/workout/substituted-actions__phone-390-light-en.png) | 8 | workout/substituted-actions |
| [Swap picker with alternates](screens/workout/swap-alternates__phone-390-light-en.png) | 3 | workout/swap-alternates |
| [Swap picker with a reason chosen](screens/workout/swap-reason__phone-390-light-en.png) | 3 | workout/swap-reason |

### Session summary

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Session summary](screens/session/summary__phone-390-light-en.png) | 8 | The Direction D lifter's Day 1 summary: an outcome word per lift, the sets, records in green and the next target as the strongest line. |
| [Session summary — maintained](screens/session/summary-maintained__phone-390-light-en.png) | 8 | A finished Day 2 whose Romanian deadlift is maintained, with its other lifts improved and a record. |
| [Session summary — declined](screens/session/summary-declined__phone-390-light-en.png) | 8 | A finished Day 3 that reports declined lifts in ink, without turning the result into a prescription. |
| [Session summary — first session](screens/session/summary-first__phone-390-light-en.png) | 8 | Every lift is a first exposure: the baseline sentence, no outcome words, and the next targets from the engine. |

### Progress

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Progress — overview](screens/progress/overview__phone-390-light-en.png) | 8 | The Progress landing tab. |
| [Progress — overview guide](screens/progress/overview-guide__phone-390-light-en.png) | 8 | The progress guide on arrival: the guide dialog centred over the dimmed Overview. |
| [Progress — baseline-building overview](screens/progress/overview-baseline__phone-390-light-en.png) | 8 | Sparse evidence remains neutral and contributes no Needs action items. |
| [Progress — actionable overview](screens/progress/overview-action__phone-390-light-en.png) | 8 | Sufficient evidence produces linked program-wide action items. |
| [Progress — exercise chart](screens/progress/exercise-chart__phone-390-light-en.png) | 8 | A per-side lift's e1RM chart and table in the logged unit. |
| [Progress — Strength](screens/progress/strength__phone-390-light-en.png) | 8 | The Strength sub-tab. |
| [Progress — Strength current block](screens/progress/strength-current-block__phone-390-light-en.png) | 8 | Current-block values, outcomes, and drill-in share one scope. |
| [Progress — Strength all history](screens/progress/strength-all-history__phone-390-light-en.png) | 8 | All-history scope explicitly includes archived observations. |
| [Progress — Strength comparison](screens/progress/strength-comparison__phone-390-light-en.png) | 8 | Two same-convention per-side points show labeled values, dates, comparison, and evidence. |
| [Progress — Strength sparse evidence](screens/progress/strength-sparse__phone-390-light-en.png) | 8 | Zero or one compatible point remains neutral baseline evidence. |
| [Progress — Volume](screens/progress/volume__phone-390-light-en.png) | 3 | The Volume sub-tab and its muscle rows. |
| [Progress — Volume block to date](screens/progress/volume-block__phone-390-light-en.png) | 3 | Block-to-date volume uses elapsed weekly prescriptions. |
| [Progress — Volume muscle detail](screens/progress/volume-drill-in__phone-390-light-en.png) | 8 | A primary muscle row expands to its scoped session evidence. |
| [Progress — PRs](screens/progress/prs__phone-390-light-en.png) | 3 | The personal-record list. |
| [Progress — PR detail](screens/progress/prs-drill-in__phone-390-light-en.png) | 3 | A personal record expands to locale-formatted evidence detail. |
| [Progress — Review](screens/progress/review__phone-390-light-en.png) | 8 | The mesocycle review surface. |
| [Progress — review guide](screens/progress/review-guide__phone-390-light-en.png) | 8 | The block-transition guide on the Review tab: the guide dialog centred over the dimmed review. |
| [Progress — active Review](screens/progress/review-active__phone-390-light-en.png) | 8 | The active-block checkpoint is read-only. |
| [Progress — completed-block Review](screens/progress/review-complete__phone-390-light-en.png) | 8 | A completed block exposes the evidence-valid structural routes. |
| [Progress — insufficient-evidence Review](screens/progress/review-insufficient__phone-390-light-en.png) | 8 | A completed block with sparse evidence excludes performance-derived actions. |
| [Progress — schedule diagnosis](screens/progress/schedule-diagnosis__phone-390-light-en.png) | 8 | The one-question choice between fewer days and shorter sessions. |
| [Progress — lower-frequency preview](screens/progress/sibling-lower-frequency__phone-390-light-en.png) | 8 | A provenance-backed lower-frequency sibling diff before confirmation, naming the block edit it keeps. |
| [Progress — shorter-session preview](screens/progress/sibling-shorter-session__phone-390-light-en.png) | 8 | A provenance-backed shorter-session sibling diff before confirmation, naming the block edits it clamps or cannot carry. |
| [Progress — guided repair staged](screens/progress/guided-repair__phone-390-light-en.png) | 8 | The exact current program is staged for explicit guided editing. |
| [Progress — volume-reduction preview](screens/progress/volume-reduction-preview__phone-390-light-en.png) | 8 | The protected permanent-volume reduction diff before confirmation. |
| [Progress — recovery eligibility](screens/progress/recovery-ineligible__phone-390-light-en.png) | 8 | Recovery stays unavailable without sufficient qualifying pattern evidence. |
| [Progress — recovery readiness question](screens/progress/recovery-questions__phone-390-light-en.png) | 8 | Eligible pattern evidence still requires the explicit local readiness answer. |
| [Progress — recovery preview](screens/progress/recovery-preview__phone-390-light-en.png) | 8 | The policy-versioned week-one prescription diff before confirmation. |
| [Progress — active recovery week](screens/progress/recovery-active__phone-390-light-en.png) | 8 | The confirmed recovery overlay is visible during week one. |
| [Progress — recovery reassessment](screens/progress/recovery-reassessment__phone-390-light-en.png) | 8 | Canonical week two asks Better, About the same, or Worse. |

### History

| Screen | Frames | What it shows |
| --- | --- | --- |
| [History](screens/history/list__phone-390-light-en.png) | 8 | The logged session list. |
| [History — expanded session](screens/history/session__phone-390-light-en.png) | 8 | One session expanded in place. |
| [History — per-side session](screens/history/per-side-session__phone-390-light-en.png) | 8 | A saved unilateral and bilateral per-side session shows physical tonnage and a per-side personal record. |
| [History — dirty edit](screens/history/edit-dirty__phone-390-light-en.png) | 8 | A session edit with an unsaved canonical change and its destructive actions still visible. |
| [History — invalid edit](screens/history/edit-invalid__phone-390-light-en.png) | 8 | An invalid set value is held at the field boundary with the editor's validation state visible. |
| [History — confirmed delete](screens/history/delete-confirm__phone-390-light-en.png) | 8 | The explicit delete confirmation surface for one selected session. |
| [History — edit conflict](screens/history/conflict__phone-390-light-en.png) | 8 | A stale session edit refuses to overwrite a newer durable change and offers recovery actions. |

### Exercise library

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Exercise library](screens/library/list__phone-390-light-en.png) | 8 | The searchable movement library. |
| [Exercise library — selected movement](screens/library/list-selected__phone-390-light-en.png) | 8 | One movement is selected and the persistent add bar is visible. |
| [Exercise library — preview](screens/library/exercise-preview__phone-390-light-en.png) | 3 | An illustrated movement preview. |
| [Exercise library — detail](screens/library/exercise-detail__phone-390-light-en.png) | 3 | The full movement detail surface. |
| [Exercise library — detail glossary definition](screens/library/exercise-detail-glossary__phone-390-light-en.png) | 8 | A definition is open after tapping a term in movement detail. |

### Program

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Program — no program](screens/program/no-program__phone-390-light-en.png) | 3 | A fresh device's Program tab, with setup as the only action. |
| [Program](screens/program/overview__phone-390-light-en.png) | 8 | The current program and its days. |
| [Program — editor](screens/program/progression-editor__phone-390-light-en.png) | 3 | The installed Program editor (Plan 074): the program name, its days and current week, the day tabs, the first day's exercises with one line per set, and Apply pinned where the dock was. |
| [Program — editor alternates](screens/program/editor-alternates__phone-390-light-en.png) | 3 | The installed Program editor with an exercise's sheet scrolled to its in-session alternates: two chosen movements in order, each with reorder and remove controls, and Add alternate. |
| [Program — Suggest loads](screens/program/editor-suggest-loads__phone-390-light-en.png) | 3 | The installed Program editor's sheet for a dumbbell renegade row with Suggest loads switched on (an ink switch): the current rep target, the RIR on every set, the smallest load change, and the question of how the lifter does the exercise. |
| [Program — refused day rename](screens/program/editor-day-name-refused__phone-390-light-en.png) | 3 | The installed Program editor's rename sheet after a day was given a name another day already uses: the field keeps the typed name, is marked invalid, and the reason sits under it; the day keeps its own name. |
| [Program — exercise picker](screens/program/exercise-picker__phone-390-light-en.png) | 3 | The picker sheet. |
| [Program — custom exercise](screens/program/custom-exercise__phone-390-light-en.png) | 3 | The custom movement sheet. |
| [Program — saving a custom exercise](screens/program/custom-exercise-saving__phone-390-light-en.png) | 3 | A new custom movement is saving; its actions stay unavailable until the durable write settles. |
| [Program — deleting a custom exercise](screens/program/custom-exercise-deleting__phone-390-light-en.png) | 3 | A custom movement is deleting; the action names deletion and all competing actions stay unavailable until the durable write settles. |
| [Program — archiving a custom exercise](screens/program/custom-exercise-archiving__phone-390-light-en.png) | 3 | A custom movement referenced by a performedMovementId-only history row is archiving; the action names archive and preserves its history identity. |
| [Program — recovering a custom exercise change](screens/program/custom-exercise-recovery__phone-390-light-en.png) | 3 | A partial archive stays visibly unresolved with recovery status, Retry recovery, and Reload actions. |
| [Program — share setup link](screens/program/share-setup__phone-390-light-en.png) | 8 | The setup-link share sheet. |
| [Program — share link ready](screens/program/share-ready__phone-390-light-en.png) | 8 | A valid setup link is ready for copy or system sharing. |
| [Program — share as file](screens/program/share-too-large__phone-390-light-en.png) | 8 | An edited generated program is too large for a setup link; the sheet offers sharing it as a program file. |
| [Program — text export](screens/program/text-export__phone-390-light-en.png) | 3 | The plain-text program export sheet. |

### Settings

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Settings](screens/settings/main__phone-390-light-en.png) | 3 | The settings list. |
| [Settings — Appearance](screens/settings/appearance__phone-390-light-en.png) | 3 | The appearance/theme row. |
| [Settings — contextual guides](screens/settings/guides__phone-390-light-en.png) | 3 | The per-guide replay controls; replay changes presentation state only. |
| [Settings — replayed guide](screens/settings/guides-replay__phone-390-light-en.png) | 3 | A real contextual guide replayed from Settings: the privacy guide dialog, centred over the dimmed list. |
| [Settings — backup guide](screens/settings/backup-guide__phone-390-light-en.png) | 3 | The backup guide in the open backup group: the guide dialog centred over the dimmed Settings. |
| [Settings — install guide](screens/settings/install-guide__phone-390-light-en.png) | 3 | The install guide where Settings offers Install (iOS Safari): the guide dialog centred over the dimmed Settings. |
| [Settings — privacy and analytics](screens/settings/privacy__phone-390-light-en.png) | 3 | The privacy and analytics section. |
| [Privacy — temporary install transfer](screens/settings/privacy-disclosure__phone-390-light-en.png) | 8 | The cached ADR 0013 disclosure reached from Settings. |

### Install

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Install banner](screens/install/banner__phone-390-light-en.png) | 3 | The install prompt banner. |
| [iOS install sheet](screens/install/ios-sheet__phone-390-light-en.png) | 3 | The iOS add-to-home-screen instructions. |
| [Install transfer — informed action](screens/install/transfer-eligible__phone-390-light-en.png) | 8 | The pre-action transfer explanation and explicit consent. |
| [Install transfer — creating](screens/install/transfer-creating__phone-390-light-en.png) | 8 | Transfer creation in progress. |
| [Install transfer — ready to install](screens/install/transfer-ready__phone-390-light-en.png) | 8 | Successful creation followed by Safari installation instructions. |
| [Install transfer — retryable creation failure](screens/install/transfer-retryable__phone-390-light-en.png) | 8 | A definitive pre-create failure with retry and install-without-transfer actions. |
| [Install transfer — claiming](screens/install/transfer-claiming__phone-390-light-en.png) | 8 | The installed app is claiming its one-time transfer. |
| [Install transfer — importing](screens/install/transfer-importing__phone-390-light-en.png) | 8 | The installed app is atomically importing the clone. |
| [Install transfer — complete](screens/install/transfer-success__phone-390-light-en.png) | 8 | Verified local import and remote deletion are complete. |
| [Install transfer — cleanup retry](screens/install/transfer-cleanup__phone-390-light-en.png) | 8 | Local import succeeded while verified remote deletion still needs retry. |
| [Install transfer — unavailable](screens/install/transfer-terminal__phone-390-light-en.png) | 8 | The transfer is definitively unavailable and the installed app can continue safely. |
| [Install transfer — destination protected](screens/install/transfer-destination__phone-390-light-en.png) | 8 | Existing installed-app data prevents replacement by a transfer. |
| [Install transfer — interrupted import](screens/install/transfer-interrupted__phone-390-light-en.png) | 8 | A recoverable installed import failure offers an explicit retry. |
| [Install transfer — unknown outcome](screens/install/transfer-unknown__phone-390-light-en.png) | 8 | An indeterminate source outcome remains frozen until explicit divergence confirmation. |
| [Install transfer — claimed then expired](screens/install/transfer-claimed-expired__phone-390-light-en.png) | 8 | Claimed-expired recovery remains frozen until explicit divergence confirmation. |

### Exercise catalog recovery

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Exercise catalog unavailable](screens/catalog-recovery/unavailable__phone-390-light-en.png) | 3 | The required offline exercise catalog fails to load. Saved data remains in place and a blocking retry dialog explains what happened. |
| [Exercise catalog retry failed](screens/catalog-recovery/retry-failed__phone-390-light-en.png) | 3 | The lifter retries while the catalog remains unavailable; the dialog reports the failed retry and keeps the retry action available. |
