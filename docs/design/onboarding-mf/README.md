# Onboarding candidates referenced on MacroFactor Workouts

Status: **awaiting the owner's choice.** Working prototypes only, with no production code. Scope is onboarding: fresh install to an activated program. The main screens stay on Direction D ([ADR 0016](../../adr/0016-direction-d-design-reference.md)).

| Candidate | Idea | Screens, hub to Activate |
| --- | --- | --- |
| [A, Faithful](prototype/app.html?c=a&lang=pt&theme=dark&reset=1) | MacroFactor's structure and visual language almost one to one: charcoal surface, bordered option cards with a leading icon and a trailing radio, section title and progress rule in the header, full-width white button, wheel and ruler pickers. Taurifer mark and copy. | **17** (14 questions, intro, building, result) |
| [B, MacroFactor structure, Taurifer identity](prototype/app.html?c=b&lang=pt&theme=light&reset=1) | The same flow and patterns in Taurifer's paper, ink, Plex Sans and Plex Mono, one-accent budget, sectioned progress rule and calm copy. | **17** (14 questions, intro, building, result) |
| [C, Compressed](prototype/app.html?c=c&lang=pt&theme=light&reset=1) | All of MacroFactor's questions in fewer screens: Basics on two, Gym and equipment on one, Program on three. Same identity as B. | **8** (6 questions, building, result) |

Today's Generate route has 8 steps (`ROUTE_STEPS.recommend` in `program-entry.js`: six questions, result and preview). C matches that count while asking MacroFactor's full question set. A and B more than double it.

## How these were made

**Working prototypes, not exports.** Open [`prototype/index.html`](prototype/index.html) from a static server at the repository root (`python3 -m http.server` works; the engine worker needs HTTP, not `file://`). Each candidate runs end to end in PT or EN, light or dark:

- **The engine is the real one.** `prototype/engine-worker.js` loads `program-compiler.js`, `exercise-metrics.js` and `program-entry-adapter.js` in a Web Worker and builds the request with `programRequestFromAnswers`. Every answer changes the program you see: day tabs with rest days, exercises, set lines, rep ranges, per-set RIR, muscle chips and session time. The inputs the adapter doesn't take yet are applied in the worker exactly as Plan 068 and the table below describe: the Everything and Warehouse presets, the thirteen equipment groups (add and remove), weeks and rep pattern, deload, and movement confirmations. They are prototype-only.
- **Offers are verified.** For Plan 068 slice C the worker confirms every gated movement once, keeps the slots that changed, then regenerates each candidate alone with the same seed and offers it only if it lands in that slot. "Sim, trocar" regenerates in place, announces the change and moves focus to Desfazer.
- **Conflicts are real.** Untick the pull-up bar and bands under Casa and the result is the compiler's own `no_eligible_exercise` for vertical pull, with a way back to the equipment step.
- **The motion is the app's own.** Pages push and pop with `RepForgeMotion.animatePush` (the `navPush` spring), A adds MacroFactor's under-page parallax, the B/C day-tab underline travels with `animateIndicator`, C's equipment disclosure opens with `animateSlot`, the result builds in reading order with the O3 stagger from `motion-polish.css`, and choice cards follow O2 (quiet ring, no check growth). Sheets open on `navPush`, dismiss on `revealOut` and settle a released drag on `gestureSettle`. Under reduced motion (system setting or `&rm=1`) every frame is drawn at rest.
- **Controls behave like the real thing:** scroll-snapping wheels for birth date and height (cm or ft-in), a momentum ruler for weight (kg or lb), segmented controls, switches, checklists, a block-length stepper in a bottom sheet you can drag down, a Cancel confirmation as a native dialog, and the browser or Android back gesture as the app's back. Answers persist for the session, so a reload resumes where you were.
- **Deep links** for review: `app.html?c=b&lang=pt&theme=light&step=equipment` opens a step directly, and `&demo=1` fills a sample answer set.
- **Where it ends.** Activate lands on the live catalog capture of Today, not on your program: the prototype doesn't write app state. Build and Import open their first screen and then stop on a card that says so.

**Appllama can't generate mockups.** The Appllama connector is a read-only research library: it searches apps, walks an app's screens in journey order, searches screens and lists flows and UI elements. It generates, renders and exports nothing, so every screen here is hand-built HTML and CSS, as the owner chose on 2026-10-10, and Appllama was used only for research. It also doesn't have MacroFactor *Workouts*; MacroFactor's nutrition app stood in as the closest relative. The owner's 11 Workouts screenshots stayed local. The research used 12 Appllama credits.

**Copy is proposed, not cataloged** (`prototype/strings.js`). It follows the brand guide: sentence case, no exclamation marks, *você*, no em dashes in prose, "dispositivo" rather than "aparelho". The glyphs are drawn for the prototypes on the brand guide's 24 grid; exercises without art in `assets/exercises/` show a monogram tile.

### Engine finding: a conflict takes about 20 seconds

While building the conflict state I found that the compiler takes **about 22 s** (Node, devbox) to return `no_eligible_exercise` for Home without the pull-up bar, against about 150 ms for a request that succeeds. `selectAllJobs` (`program-compiler.js`) backtracks over every earlier job's candidates before it gives up on the job that has none, up to its 50,000-node cap, recomputing `candidatesForJob` at each node. In the app the generator runs on the main thread, so the screen would freeze for that long on exactly the conflict Plan 068 OD-4 introduces. The prototype runs the engine in a worker and shows a "Montando…" hairline while it waits. A fix belongs with Plan 068 slice A, for example failing fast when a job has no eligible candidate before collisions are considered. This branch changes no production code.

## Comparison board

Frames captured from the prototypes with `prototype/capture.mjs`, using `&demo=1` answers and reduced motion. PT, A in its native charcoal and B and C in light. "↑" means the question is on the screen above.

| Step | A, Faithful | B, Identity | C, Compressed |
| --- | --- | --- | --- |
| Entry hub | <img src="prototype/shots/a-hub.pt.dark.png" width="170"> | <img src="prototype/shots/b-hub.pt.light.png" width="170"> | <img src="prototype/shots/c-hub.pt.light.png" width="170"> |
| Section map | <img src="prototype/shots/a-intro.pt.dark.png" width="170"> | <img src="prototype/shots/b-intro.pt.light.png" width="170"> | Dropped |
| Sex | <img src="prototype/shots/a-sex.pt.dark.png" width="170"> | <img src="prototype/shots/b-sex.pt.light.png" width="170"> | <img src="prototype/shots/c-about.pt.light.png" width="170"> |
| Birth date | <img src="prototype/shots/a-birth.pt.dark.png" width="170"> | <img src="prototype/shots/b-birth.pt.light.png" width="170"> | ↑ |
| Height | <img src="prototype/shots/a-height.pt.dark.png" width="170"> | <img src="prototype/shots/b-height.pt.light.png" width="170"> | ↑ |
| Weight | <img src="prototype/shots/a-weight.pt.dark.png" width="170"> | <img src="prototype/shots/b-weight.pt.light.png" width="170"> | ↑ |
| Lifting experience | <img src="prototype/shots/a-lifting.pt.dark.png" width="170"> | <img src="prototype/shots/b-lifting.pt.light.png" width="170"> | <img src="prototype/shots/c-experience.pt.light.png" width="170"> |
| Cardio experience | <img src="prototype/shots/a-cardio.pt.dark.png" width="170"> | <img src="prototype/shots/b-cardio.pt.light.png" width="170"> | ↑ |
| Gym location | <img src="prototype/shots/a-gym.pt.dark.png" width="170"> | <img src="prototype/shots/b-gym.pt.light.png" width="170"> | <img src="prototype/shots/c-gym.pt.light.png" width="170"> |
| Equipment | <img src="prototype/shots/a-equipment.pt.dark.png" width="170"> | <img src="prototype/shots/b-equipment.pt.light.png" width="170"> | ↑ |
| Goal | <img src="prototype/shots/a-goal.pt.dark.png" width="170"> | <img src="prototype/shots/b-goal.pt.light.png" width="170"> | <img src="prototype/shots/c-program.pt.light.png" width="170"> |
| Days per week | <img src="prototype/shots/a-days.pt.dark.png" width="170"> | <img src="prototype/shots/b-days.pt.light.png" width="170"> | ↑ |
| Session length | <img src="prototype/shots/a-minutes.pt.dark.png" width="170"> | <img src="prototype/shots/b-minutes.pt.light.png" width="170"> | ↑ |
| Muscle priorities | <img src="prototype/shots/a-priorities.pt.dark.png" width="170"> | <img src="prototype/shots/b-priorities.pt.light.png" width="170"> | <img src="prototype/shots/c-focus.pt.light.png" width="170"> |
| Deload | <img src="prototype/shots/a-deload.pt.dark.png" width="170"> | <img src="prototype/shots/b-deload.pt.light.png" width="170"> | ↑ |
| Movement abilities | <img src="prototype/shots/a-competency.pt.dark.png" width="170"> | <img src="prototype/shots/b-competency.pt.light.png" width="170"> | <img src="prototype/shots/c-competency.pt.light.png" width="170"> |
| Program cycle (result) | <img src="prototype/shots/a-result.pt.dark.png" width="170"> | <img src="prototype/shots/b-result.pt.light.png" width="170"> | <img src="prototype/shots/c-result.pt.light.png" width="170"> |
| Handoff: Today after Activate | <img src="../../ui-screens/screens/today/ready__phone-390-light-pt.png" width="170"> | Same | Same |

English result, and the other appearance:

| | A | B | C |
| --- | --- | --- | --- |
| Result, EN | <img src="prototype/shots/a-result.en.dark.png" width="170"> | <img src="prototype/shots/b-result.en.light.png" width="170"> | <img src="prototype/shots/c-result.en.light.png" width="170"> |
| Abilities, other appearance | <img src="prototype/shots/a-competency.pt.light.png" width="170"> | <img src="prototype/shots/b-competency.pt.dark.png" width="170"> | <img src="prototype/shots/c-competency.pt.dark.png" width="170"> |
| Result, other appearance | <img src="prototype/shots/a-result.pt.light.png" width="170"> | <img src="prototype/shots/b-result.pt.dark.png" width="170"> | <img src="prototype/shots/c-result.pt.dark.png" width="170"> |

The other entry routes are restyled only: Build and Import show their first screen, and a received setup link (`#shared` on the launcher) opens its own screen, then generates and shows the program like the Generate route.

### The handoff seam

Activate lands on Today, drawn in Direction D. Frame shown above: the live catalog capture `today/ready`.

- **A: a large seam.** It goes from a charcoal MacroFactor surface with a white button, colored RIR dots and bordered cards to warm paper with ink ledger rows, mono columns and an ink button. Shipping A would mean a second visual identity for the first five minutes, against ADR 0009's single material grammar and the brand guide's one-accent rule.
- **B and C: a small seam.** Tokens, type, button and dark appearance are the same as Today. Two differences remain. The result screen's option cards and muscle chips are card-shaped where D uses ledger rows. The result shows thumbnails, which Today doesn't. Both are deliberate MacroFactor borrowings and can be ledger-ized if the owner prefers.

## What each answer feeds

The request field is the one `programRequestFromAnswers` (`program-entry-adapter.js`) builds. "Not used yet" marks screens kept from MacroFactor whose answers the engine doesn't read. The implementation plan must give each of those a purpose, keep it local only and never send it as telemetry, and keep its skip.

| Section | Screen | Feeds | When skipped or untouched | Engine today |
| --- | --- | --- | --- | --- |
| Basics | Sex | Nothing | Unset | **Not used yet** |
| Basics | Birth date | Nothing | Unset | **Not used yet** |
| Basics | Height (cm / ft-in) | Nothing | Unset | **Not used yet** |
| Basics | Weight (kg / lb) | Bodyweight contribution for bodyweight movements (`loadingModel.bodyweightCoefficient`) | Unset: bodyweight sets track reps only | Used |
| Basics | Lifting experience | `experience` via `structuredExperience`: None→`first`, Beginner→`under_6m`, Intermediate→`6_to_24m`, Advanced→`over_24m` | Required | Used. MacroFactor's bands (1 and 4 years) differ from the engine's tiers (6 and 24 months), so the plan must choose one set of definitions. |
| Basics | Cardio experience | Nothing | Unset | **Not used yet** |
| Gym | Location | `gymProfile.equipmentIds` from the catalog flags. Everything = all equipment (new), Commercial→`commercialGym`, Warehouse→`warehouseGym` (new mapping), Local→`localGym`, Garage→`garageGym`, Home→`homeGym` | Required | Used. Two presets are new. |
| Gym | Equipment, 13 groups, add and remove | `gymProfile.equipmentIds` = (preset ∪ added) − removed (Plan 068 slice A) | The preset, byte-identical to today | Used |
| Program | Goal | `goal`: Muscle growth→hypertrophy, Strength→strength, Both→hybrid | Required | Used |
| Program | Days per week (2–6) | `daysPerWeek` | Required | Used |
| Program | Session length (20–150) | `timeCeilingMinutes` | 60 | Used |
| Program | Split | `split` | The authored split | Each day count has one split today, so no candidate asks. They state it as a fact. |
| Program | Muscle priorities | `emphasisMuscleIds`, `deprioritizedMuscleIds` (up to 5 each) | None | Used |
| Program | Deload | `deloadCycles`, e.g. `[7]` for a deload in the last week | Proposed default: on, marked Recommended (needs owner sign-off) | New real input. Always `[]` today. |
| Program | Movement abilities, 7 questions | `competencyAnswers`; "Not sure" = null | All null | Used. `pullups10` maps to nothing yet (#340). |
| Result | Program length and rep pattern | `cycles`, `periodization` (Plan 068 slice B) | 7 weeks, static | Used. Shown as the block row on the result, not as a question. |
| Result | Per-movement offers | `movementConfirmations` (Plan 068 slice C) | `{}` | Used |

The building moment is about one second: a four-line checklist and a thin bar. It can be skipped with a quiet link, and with reduced motion it renders at rest. Generation itself takes about 70 ms, so this is pacing, not a wait.

## Research: onboarding patterns from Appllama

Screens were studied in Appllama and are described, not reproduced. Names and positions are Appllama's.

**MacroFactor, nutrition app** (app 1553503471; 34 onboarding screens, walked in full):

- *Section map.* Basics Intro (3), Goal Intro (20) and Program Intro (24) show a vertical stepper of three sections, the current one expanded, before each section starts. A and B keep one map at the start; C drops it.
- *Header.* A back chevron, a centered section title ("Basics") and a thin progress bar that restarts in each section. A copies it. B and C use Taurifer's existing "section · N of M" eyebrow over a segmented rule, so overall progress is visible.
- *One question per screen, full-width primary button.* Sex Selection (5), Exercise Frequency (12), Lifting Experience (14) and Cardio Experience (15) are option cards with a leading line icon and a trailing radio, and the selected card gets a heavier border. Every candidate's choice cards follow this.
- *Numeric pickers.* Birthdate Picker (6) is a three-column wheel. Height Picker (7) and Weight Picker (8) put a segmented unit toggle over a wheel or a ruler with a coloured tick. A and B copy these. C replaces them with value rows that open the same picker in a sheet.
- *No skip in Basics.* Every Basics screen requires an answer. Ours can't: sex, birth date, height and cardio don't change the program, so each gets a skip and a local-only note.
- *Result reveal.* Program Ready (30) is an animated orbit that ends on "All done. Your plan is ready." with Done disabled until it finishes. Goal Summary (23) and Macro Program Summary (31) are summary cards, each with a value and an explanation. Our building moment is shorter and skippable, and our result is the real program rather than a summary.
- *Left out:* Privacy Assurance (2) as a separate screen, Health Sync (4), the chat check-ins (16, 17), Social Proof Reviews (18), Referral Source (19) and the paywall (32–34). None of them asks a training question.

**Other categories:**

- *Several questions on one screen.* Monarch (finance, 1459319842), Profile Form Filled (7): label-left rows with inline Yes/No segmented answers under a "Step 6 of 6" counter. This is C's "Sobre você" and the competency layout. Monarch's Goal Selection (5) uses multi-select pills, the model for C's muscle chips.
- *Plain option rows with a progress bar and no section names.* YNAB (finance, 1010865877), Motivation Question (9). It reads well, but with 14 questions the section name is what tells the lifter how far they are, so we keep it.
- *Building checklist.* 12min (books, 1177343870), Plan Generation 4 and Plan Ready: a stepwise checklist, and one step asks a question mid-build. Blueprint for Creators (productivity, 6756682846), Personalization Complete: a percentage ring over a checklist. We keep the checklist and drop the mid-build question and the percentage.
- *Skippable sensitive questions.* Runna (fitness, 1594204443), Gender Selection: "Prefer not to say" as an option, plus a "Maybe later" link under Continue. Reframe (health, 1485756576), Profile Details Form: one line saying why the app asks, above the question. WODProof (fitness, 1130947789), Profile Details: "This data is private" with sex and birth date on one screen. Our Basics combine all three: a "Prefiro não informar" option, a Pular link and a one-line local-only note.

## Recommendation: C

C keeps every MacroFactor question and the clarity of MacroFactor's patterns, but needs 8 screens instead of 17.

1. **Time to first set.** The product thesis puts workout speed first, and Plan 068 already argued that a screen must earn its place. In A and B, four of the six Basics screens collect data the engine doesn't read. C puts all four on one skippable screen, so a lifter who skips spends one tap on them.
2. **It doesn't raise the step count.** C has the same number of steps as today's route (8) while asking more: equipment adjustments, deload and the MacroFactor Basics.
3. **No identity seam.** C uses B's tokens, so Activate lands on Today with no change of material. A would bring a second visual language into the first-run experience, which ADR 0009 and the brand guide rule out.
4. **The risks are known.** C's Program and Sobre você screens are the densest. They need a check on a real phone (the prototype makes that possible), and the Sobre você value rows depend on a picker sheet that A and B don't need.

If the owner wants MacroFactor's one-question-per-screen rhythm, B is the fallback: the same identity, with every question on its own screen. I don't recommend A as a direction. It's useful as the reference for B and C.

## After the owner chooses

1. An ADR that supersedes ADR 0016's onboarding scope with the chosen candidate. It also records "no further onboarding overhaul without evidence": a later redesign needs measured drop-off or lifter feedback, not another reference app.
2. An implementation plan that folds in Plan 068's inputs (equipment groups, block row, per-movement offers), the new deload input, the two new gym presets, the experience-band decision, and a purpose, privacy note and skip for each Basics answer the engine doesn't use yet.

Plan 068's measurements stand (PR #345). Its screen placement waits on this choice.
