# UI screen catalog

Phone-frame captures of every user-visible Taurifer surface — 143 screens,
866 frames. This folder is the visual reference for UI and Brand Designers.

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
| [One-time landing](screens/onboarding-start/first-run__phone-390-light-en.png) | 7 | First empty visit. Hero, getting-started/program chapter, the signature progression system, and a closing chapter, with early Build and Track actions, Privacy, and device-local seen state. |
| [Entry hub](screens/onboarding-start/hub__phone-390-light-en.png) | 7 | Create a program. Recommend is the sole primary path; Custom is its generated alternative; Browse stands alone; Bring or build is collapsed. |
| [Entry hub — own disclosure open](screens/onboarding-start/hub-own-open__phone-390-light-en.png) | 3 | The Bring or build disclosure expanded with aria-expanded to reveal Build, paste, and Taurifer-file import paths. |
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
| [Recommend — recommendation and review](screens/onboarding-recommend/result__phone-390-light-en.png) | 8 | One candidate surface with rationale, editable program facts, and explicit activation. |
| [Recommend — recommendation with a program active](screens/onboarding-recommend/result-existing__phone-390-light-en.png) | 3 | The merged candidate surface while the current program remains untouched. |
| [Recommend — confirm replacement](screens/onboarding-recommend/replacement-confirm__phone-390-light-en.png) | 3 | The explicit archive-and-replace confirmation. History is not changed. |
| [Recommend — activation conflict](screens/onboarding-recommend/activation-conflict__phone-390-light-en.png) | 3 | Another tab changed the active program. The newer program stays active. |

### Onboarding — Generate a custom program

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Custom 1 — desired result](screens/onboarding-custom/desired-result__phone-390-light-en.png) | 4 | The custom route's own header and step count, not Recommend's. |
| [Custom 2 — training background](screens/onboarding-custom/background__phone-390-light-en.png) | 4 | Structured-program experience and recent consistency in the custom route. |
| [Custom 3 — real week](screens/onboarding-custom/schedule__phone-390-light-en.png) | 8 | Days per week, session ceiling and preferred rest in the custom route. |
| [Custom 4 — environment](screens/onboarding-custom/environment__phone-390-light-en.png) | 4 | Environment shortcuts in the custom route. |
| [Custom 5 — muscle priorities](screens/onboarding-custom/priorities__phone-390-light-en.png) | 8 | Each muscle has one accessible emphasis setting before exercise preferences. |
| [Custom 6 — exercise preferences](screens/onboarding-custom/exercise-preferences__phone-390-light-en.png) | 4 | One library search offers Include or Avoid, with separate selected lists. |
| [Custom — generated program and review](screens/onboarding-custom/result__phone-390-light-en.png) | 4 | The custom candidate, rationale, editable facts, and explicit activation on one surface. |

### Onboarding — Browse Taurifer programs

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Browse 1 — real week](screens/onboarding-browse/schedule__phone-390-light-en.png) | 7 | Days per week and session length, the only questions Browse asks. |
| [Browse 2 — environment](screens/onboarding-browse/environment__phone-390-light-en.png) | 7 | Environment shortcuts before the catalogue is filtered. |
| [Browse — catalogue](screens/onboarding-browse/catalogue__phone-390-light-en.png) | 7 | Released, complete, tested programs with purpose, frequency and mismatches. |
| [Browse — review](screens/onboarding-browse/preview__phone-390-light-en.png) | 7 | The common review surface for a catalogue program. |

### Onboarding — Build my own

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Build 1 — name and days](screens/onboarding-build/setup__phone-390-light-en.png) | 7 | The build_setup step: program name and day count before the editor opens. |
| [Build — empty days](screens/onboarding-build/editor-empty__phone-390-light-en.png) | 8 | Real empty day containers, Add exercise, Save draft, activation disabled. |
| [Build — partial draft](screens/onboarding-build/editor-partial__phone-390-light-en.png) | 8 | One populated day and one incomplete day. Activation stays disabled. |
| [Build — activation ready](screens/onboarding-build/editor-ready__phone-390-light-en.png) | 8 | A complete manual draft with supported progression and activation enabled. |

### Onboarding — Import a program file

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Import — source](screens/onboarding-import/source__phone-390-light-en.png) | 3 | The bounded supported-file and setup-source surface before any mutation. |
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
| [Shared setup — adaptive landing](screens/onboarding-shared/gate__phone-390-light-en.png) | 8 | An incoming setup link adapts the landing around its safe program summary. Nothing persists until Start. |
| [Shared setup — invalid landing](screens/onboarding-shared/invalid__phone-390-light-en.png) | 3 | An invalid setup link explains that nothing was saved and keeps safe Build and Track actions available. |
| [Shared setup — review](screens/onboarding-shared/preview__phone-390-light-en.png) | 7 | The editable preview a shared payload lands in before explicit activation. |

### Onboarding — resume and rule drift

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Resume setup](screens/onboarding-recovery/resume__phone-390-light-en.png) | 7 | The resumable notice after reload: route, step, recency, Resume, Start over. |
| [Rules changed](screens/onboarding-recovery/rules-drift__phone-390-light-en.png) | 7 | A draft whose compiler rules are stale. Rebuild is required before activation. |

### Today

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Today — no program](screens/today/no-program__phone-390-light-en.png) | 3 | A fresh device after leaving setup, with no program or workout controls. |
| [Today — ready to start](screens/today/ready__phone-390-light-en.png) | 8 | A seeded program with recent max-rep evidence makes the readiness shortcut visible. |
| [Today — choose another day](screens/today/day-picker__phone-390-light-en.png) | 8 | The day picker sheet open. |
| [Today — session complete](screens/today/done__phone-390-light-en.png) | 8 | The state after the day's session is logged. |
| [Read-only session preview](screens/today/preview__phone-390-light-en.png) | 8 | Read-only session preview through production controls. |
| [Resume saved draft](screens/today/draft-resume__phone-390-light-en.png) | 8 | Resume saved draft through production controls. |

### Workout logging

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Workout — focus mode](screens/workout/focus__phone-390-light-en.png) | 8 | One exercise at a time. |
| [Workout — stale draft recovery](screens/workout/stale-draft__phone-390-light-en.png) | 8 | A conflicting tab won while this tab retains a pending field value and offers Reload latest or Copy value. |
| [Workout — draft persistence retry](screens/workout/persist-retry__phone-390-light-en.png) | 8 | A field write was interrupted; the exact pending value remains visible beside Retry and Copy value actions. |
| [Workout — invalid draft recovery](screens/workout/invalid-draft__phone-390-light-en.png) | 8 | An unreadable local draft remains untouched and offers a non-destructive copy action. |
| [Workout — rest timer](screens/workout/rest-timer__phone-390-light-en.png) | 8 | The rest timer sheet. |
| [Workout — exercise note](screens/workout/exercise-note__phone-390-light-en.png) | 8 | The per-exercise note sheet. |
| [Workout — why this weight](screens/workout/why-this-weight__phone-390-light-en.png) | 8 | The recommendation inspector. |
| [Session details and map](screens/workout/session__phone-390-light-en.png) | 8 | Session details and map through production controls. |
| [Early finish confirmation](screens/workout/early-finish__phone-390-light-en.png) | 8 | Early finish confirmation through production controls. |
| [Exercise actions](screens/workout/exercise-actions__phone-390-light-en.png) | 8 | Exercise actions through production controls. |
| [Warm-up role](screens/workout/warmup-actions__phone-390-light-en.png) | 8 | Warm-up role through production controls. |
| [Session reorder](screens/workout/reorder__phone-390-light-en.png) | 8 | Session reorder through production controls. |
| [Set correction](screens/workout/correction__phone-390-light-en.png) | 8 | Set correction through production controls. |
| [Skipped exercise actions](screens/workout/skipped-actions__phone-390-light-en.png) | 8 | workout/skipped-actions |
| [Substituted exercise actions](screens/workout/substituted-actions__phone-390-light-en.png) | 8 | workout/substituted-actions |

### Session summary

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Session summary](screens/session/summary__phone-390-light-en.png) | 3 | The summary shown after Save workout. |
| [Session summary — maintained](screens/session/summary-maintained__phone-390-light-en.png) | 8 | The finished session reports maintained performance alongside its next-step context. |
| [Session summary — declined](screens/session/summary-declined__phone-390-light-en.png) | 8 | The finished session reports declined performance without turning the result into a prescription. |
| [Session summary — mixed outcomes](screens/session/summary-mixed__phone-390-light-en.png) | 8 | The finished session keeps maintained and declined lift outcomes distinct in one summary. |

### Progress

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Progress — overview](screens/progress/overview__phone-390-light-en.png) | 3 | The Progress landing tab. |
| [Progress — baseline-building overview](screens/progress/overview-baseline__phone-390-light-en.png) | 8 | Sparse evidence remains neutral and contributes no Needs action items. |
| [Progress — actionable overview](screens/progress/overview-action__phone-390-light-en.png) | 3 | Sufficient evidence produces linked program-wide action items. |
| [Progress — exercise chart](screens/progress/exercise-chart__phone-390-light-en.png) | 3 | A single lift's strength chart. |
| [Progress — Strength](screens/progress/strength__phone-390-light-en.png) | 3 | The Strength sub-tab. |
| [Progress — Strength current block](screens/progress/strength-current-block__phone-390-light-en.png) | 3 | Current-block values, outcomes, and drill-in share one scope. |
| [Progress — Strength all history](screens/progress/strength-all-history__phone-390-light-en.png) | 3 | All-history scope explicitly includes archived observations. |
| [Progress — Strength comparison](screens/progress/strength-comparison__phone-390-light-en.png) | 8 | Two compatible points show values, dates, absolute change, and percentage change. |
| [Progress — Strength sparse evidence](screens/progress/strength-sparse__phone-390-light-en.png) | 8 | Zero or one compatible point remains neutral baseline evidence. |
| [Progress — Volume](screens/progress/volume__phone-390-light-en.png) | 3 | The Volume sub-tab and its muscle rows. |
| [Progress — Volume block to date](screens/progress/volume-block__phone-390-light-en.png) | 3 | Block-to-date volume uses elapsed weekly prescriptions. |
| [Progress — Volume muscle detail](screens/progress/volume-drill-in__phone-390-light-en.png) | 8 | A primary muscle row expands to its scoped session evidence. |
| [Progress — PRs](screens/progress/prs__phone-390-light-en.png) | 3 | The personal-record list. |
| [Progress — PR detail](screens/progress/prs-drill-in__phone-390-light-en.png) | 3 | A personal record expands to locale-formatted evidence detail. |
| [Progress — Review](screens/progress/review__phone-390-light-en.png) | 8 | The mesocycle review surface. |
| [Progress — active Review](screens/progress/review-active__phone-390-light-en.png) | 8 | The active-block checkpoint is read-only. |
| [Progress — completed-block Review](screens/progress/review-complete__phone-390-light-en.png) | 8 | A completed block exposes the evidence-valid structural routes. |
| [Progress — insufficient-evidence Review](screens/progress/review-insufficient__phone-390-light-en.png) | 8 | A completed block with sparse evidence excludes performance-derived actions. |
| [Progress — schedule diagnosis](screens/progress/schedule-diagnosis__phone-390-light-en.png) | 8 | The one-question choice between fewer days and shorter sessions. |
| [Progress — lower-frequency preview](screens/progress/sibling-lower-frequency__phone-390-light-en.png) | 8 | A provenance-backed lower-frequency sibling diff before confirmation. |
| [Progress — shorter-session preview](screens/progress/sibling-shorter-session__phone-390-light-en.png) | 8 | A provenance-backed shorter-session sibling diff before confirmation. |
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
| [History](screens/history/list__phone-390-light-en.png) | 3 | The logged session list. |
| [History — expanded session](screens/history/session__phone-390-light-en.png) | 8 | One session expanded in place. |
| [History — dirty edit](screens/history/edit-dirty__phone-390-light-en.png) | 8 | A session edit with an unsaved canonical change and its destructive actions still visible. |
| [History — invalid edit](screens/history/edit-invalid__phone-390-light-en.png) | 8 | An invalid set value is held at the field boundary with the editor's validation state visible. |
| [History — confirmed delete](screens/history/delete-confirm__phone-390-light-en.png) | 8 | The explicit delete confirmation surface for one selected session. |
| [History — edit conflict](screens/history/conflict__phone-390-light-en.png) | 8 | A stale session edit refuses to overwrite a newer durable change and offers recovery actions. |

### Exercise library

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Exercise library](screens/library/list__phone-390-light-en.png) | 3 | The searchable movement library. |
| [Exercise library — preview](screens/library/exercise-preview__phone-390-light-en.png) | 3 | An illustrated movement preview. |
| [Exercise library — detail](screens/library/exercise-detail__phone-390-light-en.png) | 3 | The full movement detail surface. |

### Program

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Program — no program](screens/program/no-program__phone-390-light-en.png) | 3 | A fresh device's Program tab, with setup as the only action. |
| [Program](screens/program/overview__phone-390-light-en.png) | 3 | The current program and its days. |
| [Program — editor](screens/program/progression-editor__phone-390-light-en.png) | 3 | The installed program editor, with the first day open. |
| [Program — exercise picker](screens/program/exercise-picker__phone-390-light-en.png) | 3 | The picker sheet. |
| [Program — custom exercise](screens/program/custom-exercise__phone-390-light-en.png) | 3 | The custom movement sheet. |
| [Program — saving a custom exercise](screens/program/custom-exercise-saving__phone-390-light-en.png) | 3 | A new custom movement is saving; its actions stay unavailable until the durable write settles. |
| [Program — deleting a custom exercise](screens/program/custom-exercise-deleting__phone-390-light-en.png) | 3 | A custom movement is deleting; the action names deletion and all competing actions stay unavailable until the durable write settles. |
| [Program — archiving a custom exercise](screens/program/custom-exercise-archiving__phone-390-light-en.png) | 3 | A custom movement referenced by a performedMovementId-only history row is archiving; the action names archive and preserves its history identity. |
| [Program — recovering a custom exercise change](screens/program/custom-exercise-recovery__phone-390-light-en.png) | 3 | A partial archive stays visibly unresolved with recovery status, Retry recovery, and Reload actions. |
| [Program — share setup link](screens/program/share-setup__phone-390-light-en.png) | 8 | The setup-link share sheet. |
| [Program — share with one blocker](screens/program/share-one-blocker__phone-390-light-en.png) | 8 | The share sheet names one unresolved exercise and keeps copy/share unavailable. |
| [Program — repair returns to Share](screens/program/share-repair-return__phone-390-light-en.png) | 8 | The custom repair path has been cancelled and returns directly to the blocked Share sheet. |
| [Program — share link ready](screens/program/share-ready__phone-390-light-en.png) | 8 | A valid setup link is ready for copy or system sharing. |
| [Program — ready exercises](screens/program/readiness__phone-390-light-en.png) | 7 | The recommendation-owned readiness list, with metadata hidden and inert while the list is open. |
| [Program — text export](screens/program/text-export__phone-390-light-en.png) | 3 | The plain-text program export sheet. |

### Settings

| Screen | Frames | What it shows |
| --- | --- | --- |
| [Settings](screens/settings/main__phone-390-light-en.png) | 3 | The settings list. |
| [Settings — Appearance](screens/settings/appearance__phone-390-light-en.png) | 3 | The appearance/theme row. |
| [Settings — contextual guides](screens/settings/guides__phone-390-light-en.png) | 3 | The per-guide replay controls; replay changes presentation state only. |
| [Settings — replayed guide](screens/settings/guides-replay__phone-390-light-en.png) | 3 | A real contextual guide replayed from Settings and anchored to its live privacy action. |
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
