# UI screen catalog

Phone-frame captures of every user-visible Taurifer surface — 71 screens,
209 frames. This folder is the visual reference for UI and Brand Designers.

The catalog is **mobile only**. Taurifer is a phone PWA and a desktop frame was
evidence nobody reviewed, so the manifest rejects non-phone viewports.

## Keeping it current

Whenever a change alters a user-visible surface (`index.html`, `styles.css`, `app.js`,
`program-entry-adapter.js`, on-screen copy in `i18n-*.json`, sheets, onboarding, or
install UI), regenerate before merging:

```bash
python3 -m http.server 8000
REPFORGE_URL=http://localhost:8000/ node tools/capture-ui-screens.mjs
```

CI runs `tools/check-ui-screens.mjs` (every registered frame exists, no strays) and
`tools/compare-ui-screens.mjs` (committed frames still match a fresh capture). A stale
catalog fails the build — it does not pass quietly.

Never hand-edit a PNG.

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
| [First-run gate](screens/onboarding-start/first-run__phone-390-light-en.png) | 7 | No program exists. The gate that precedes every entry route. |
| [Entry hub](screens/onboarding-start/hub__phone-390-light-en.png) | 7 | Create a program. Recommend and Custom carry the accent rail; Browse and Bring or build my own recede. |
| [Entry hub — own disclosure open](screens/onboarding-start/hub-own-open__phone-390-light-en.png) | 3 | The Bring or build my own disclosure expanded to reveal the nested Build and Import rows. |
| [Entry hub — existing program](screens/onboarding-start/hub-existing__phone-390-light-en.png) | 3 | Opened from Settings while a program is active, so replacement consequences are in view. |

### Onboarding — Recommend one for me

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Recommend 1 — desired result](screens/onboarding-recommend/desired-result__phone-390-light-en.png) | 3 | Route header, Cancel, progress 1 of 5, three desired-result choices. |
| [Recommend 2 — training background](screens/onboarding-recommend/background__phone-390-light-en.png) | 3 | Structured-program experience and recent six-week consistency. |
| [Recommend 3 — real week](screens/onboarding-recommend/schedule__phone-390-light-en.png) | 3 | Days per week, session-minute ceiling, preferred rest. |
| [Recommend 4 — environment](screens/onboarding-recommend/environment__phone-390-light-en.png) | 3 | Environment shortcuts with the capability correction disclosure closed. |
| [Recommend 4 — equipment correction](screens/onboarding-recommend/environment-correction__phone-390-light-en.png) | 7 | The capability correction disclosure open. |
| [Recommend 5 — priorities](screens/onboarding-recommend/priorities__phone-390-light-en.png) | 3 | Primary priorities plus optional movement and exercise-avoidance controls. |
| [Recommend 5 — avoidance and pain safety](screens/onboarding-recommend/avoidance-pain__phone-390-light-en.png) | 7 | One avoided exercise with the pain reason selected and its safety copy. |
| [Recommend — validation error](screens/onboarding-recommend/validation-error__phone-390-light-en.png) | 3 | Advancing without an answer. Errors sit adjacent to the control that failed. |
| [Recommend — recommendation](screens/onboarding-recommend/result__phone-390-light-en.png) | 7 | One named recommendation with its factual Why it fits explanation. |
| [Recommend — review before first activation](screens/onboarding-recommend/preview-first-run__phone-390-light-en.png) | 3 | Identity, source, day summaries, assumptions, Edit before using, Use this program. |
| [Recommend — review with a program active](screens/onboarding-recommend/preview-existing__phone-390-light-en.png) | 3 | The same review while the current program remains untouched. |
| [Recommend — confirm replacement](screens/onboarding-recommend/replacement-confirm__phone-390-light-en.png) | 3 | The explicit archive-and-replace confirmation. History is not changed. |
| [Recommend — activation conflict](screens/onboarding-recommend/activation-conflict__phone-390-light-en.png) | 3 | Another tab changed the active program. The newer program stays active. |

### Onboarding — Generate a custom program

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Custom 1 — desired result](screens/onboarding-custom/desired-result__phone-390-light-en.png) | 3 | The custom route's own header and step count, not Recommend's. |
| [Custom 2 — training background](screens/onboarding-custom/background__phone-390-light-en.png) | 3 | Structured-program experience and recent consistency in the custom route. |
| [Custom 3 — real week](screens/onboarding-custom/schedule__phone-390-light-en.png) | 3 | Days per week, session ceiling and preferred rest in the custom route. |
| [Custom 4 — environment](screens/onboarding-custom/environment__phone-390-light-en.png) | 3 | Environment shortcuts in the custom route. |
| [Custom 5 — priorities](screens/onboarding-custom/priorities__phone-390-light-en.png) | 3 | Priorities and avoidance controls before the split choice. |
| [Custom — split choice](screens/onboarding-custom/shape__phone-390-light-en.png) | 3 | Compiler-approved split choices with the Taurifer default and its rationale. |
| [Custom — generated program](screens/onboarding-custom/result__phone-390-light-en.png) | 3 | The generated candidate for the chosen split. |
| [Custom — review](screens/onboarding-custom/preview__phone-390-light-en.png) | 3 | The common review surface for a custom-generated program. |

### Onboarding — Browse Taurifer programs

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Browse 1 — real week](screens/onboarding-browse/schedule__phone-390-light-en.png) | 3 | Days per week and session length, the only questions Browse asks. |
| [Browse 2 — environment](screens/onboarding-browse/environment__phone-390-light-en.png) | 3 | Environment shortcuts before the catalogue is filtered. |
| [Browse — catalogue](screens/onboarding-browse/catalogue__phone-390-light-en.png) | 3 | Released, complete, tested programs with purpose, frequency and mismatches. |
| [Browse — review](screens/onboarding-browse/preview__phone-390-light-en.png) | 3 | The common review surface for a catalogue program. |

### Onboarding — Build my own

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Build 1 — name and days](screens/onboarding-build/setup__phone-390-light-en.png) | 3 | The build_setup step: program name and day count before the editor opens. |
| [Build — empty days](screens/onboarding-build/editor-empty__phone-390-light-en.png) | 7 | Real empty day containers, Add exercise, Save draft, activation disabled. |
| [Build — partial draft](screens/onboarding-build/editor-partial__phone-390-light-en.png) | 3 | One populated day and one incomplete day. Activation stays disabled. |
| [Build — activation ready](screens/onboarding-build/editor-ready__phone-390-light-en.png) | 3 | A complete manual draft with supported progression and activation enabled. |

### Onboarding — Import a program file

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Import — source](screens/onboarding-import/source__phone-390-light-en.png) | 3 | The bounded supported-file and setup-source surface before any mutation. |
| [Import — review](screens/onboarding-import/preview__phone-390-light-en.png) | 7 | A mapped exercise with manual progression ownership and provenance. |

### Onboarding — Shared setup link

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Shared setup — confirmation gate](screens/onboarding-shared/gate__phone-390-light-en.png) | 3 | The first-run gate for an incoming setup link. Nothing persists until Start. |
| [Shared setup — review](screens/onboarding-shared/preview__phone-390-light-en.png) | 3 | The editable preview a shared payload lands in before explicit activation. |

### Onboarding — resume and rule drift

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Resume setup](screens/onboarding-recovery/resume__phone-390-light-en.png) | 3 | The resumable notice after reload: route, step, recency, Resume, Start over. |
| [Rules changed](screens/onboarding-recovery/rules-drift__phone-390-light-en.png) | 3 | A draft whose compiler rules are stale. Rebuild is required before activation. |

### Today

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Today — ready to start](screens/today/ready__phone-390-light-en.png) | 2 | A seeded program on its next scheduled day. |
| [Today — choose another day](screens/today/day-picker__phone-390-light-en.png) | 2 | The day picker sheet open. |
| [Today — session complete](screens/today/done__phone-390-light-en.png) | 2 | The state after the day's session is logged. |

### Workout logging

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Workout — list mode](screens/workout/list__phone-390-light-en.png) | 2 | The default logging surface. |
| [Workout — focus mode](screens/workout/focus__phone-390-light-en.png) | 2 | One exercise at a time. |
| [Workout — rest timer](screens/workout/rest-timer__phone-390-light-en.png) | 2 | The rest timer sheet. |
| [Workout — exercise note](screens/workout/exercise-note__phone-390-light-en.png) | 2 | The per-exercise note sheet. |
| [Workout — why this weight](screens/workout/why-this-weight__phone-390-light-en.png) | 2 | The recommendation inspector. |

### Session summary

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Session summary](screens/session/summary__phone-390-light-en.png) | 2 | The summary shown after Save workout. |

### Progress

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Progress — overview](screens/progress/overview__phone-390-light-en.png) | 2 | The Progress landing tab. |
| [Progress — exercise chart](screens/progress/exercise-chart__phone-390-light-en.png) | 2 | A single lift's strength chart. |
| [Progress — Strength](screens/progress/strength__phone-390-light-en.png) | 2 | The Strength sub-tab. |
| [Progress — Volume](screens/progress/volume__phone-390-light-en.png) | 2 | The Volume sub-tab and its muscle rows. |
| [Progress — PRs](screens/progress/prs__phone-390-light-en.png) | 2 | The personal-record list. |
| [Progress — Review](screens/progress/review__phone-390-light-en.png) | 2 | The mesocycle review surface. |

### History

| Screen | Frames | What it shows |
| --- | --- | --- |
| [History](screens/history/list__phone-390-light-en.png) | 2 | The logged session list. |
| [History — expanded session](screens/history/session__phone-390-light-en.png) | 2 | One session expanded in place. |

### Exercise library

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Exercise library](screens/library/list__phone-390-light-en.png) | 2 | The searchable movement library. |
| [Exercise library — preview](screens/library/exercise-preview__phone-390-light-en.png) | 2 | An illustrated movement preview. |
| [Exercise library — detail](screens/library/exercise-detail__phone-390-light-en.png) | 2 | The full movement detail surface. |

### Program

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Program](screens/program/overview__phone-390-light-en.png) | 2 | The current program and its days. |
| [Program — progression editor](screens/program/progression-editor__phone-390-light-en.png) | 2 | Per-exercise progression strategy editing. |
| [Program — exercise picker](screens/program/exercise-picker__phone-390-light-en.png) | 2 | The picker sheet. |
| [Program — custom exercise](screens/program/custom-exercise__phone-390-light-en.png) | 2 | The custom movement sheet. |
| [Program — share setup link](screens/program/share-setup__phone-390-light-en.png) | 2 | The setup-link share sheet. |
| [Program — text export](screens/program/text-export__phone-390-light-en.png) | 2 | The plain-text program export sheet. |

### Settings

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Settings](screens/settings/main__phone-390-light-en.png) | 2 | The settings list. |
| [Settings — Appearance](screens/settings/appearance__phone-390-light-en.png) | 2 | The appearance/theme row. |
| [Settings — privacy and analytics](screens/settings/privacy__phone-390-light-en.png) | 2 | The privacy and analytics section. |

### Install and tour

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Install banner](screens/install/banner__phone-390-light-en.png) | 2 | The install prompt banner. |
| [iOS install sheet](screens/install/ios-sheet__phone-390-light-en.png) | 2 | The iOS add-to-home-screen instructions. |
| [Feature tour](screens/install/tour__phone-390-light-en.png) | 2 | The first-session feature tour. |
