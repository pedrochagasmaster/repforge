# Packet 078-pr3 CI capture review

Run [42600392277](https://github.com/pedrochagasmaster/repforge/actions/runs/42600392277), exact source `127ec26df599396a52b9055bc0dca93581b00334`. Fetched with `node tools/fetch-ci-captures.mjs 42600392277`. All six capture-shard artifacts were downloaded for the semantic comparison as well.

## Classification

`ui-system` failed only on four representative Workout frames: focus-per-side EN dark, rest-running EN dark, why-manual PT light and early-finish EN dark. Each is included in the intended copy/backdrop updates below. The other representative cells passed.

307 changed PNGs cover 57 states. Counts describe the retained run before the #712 correction below.

| Flow | PNGs | States | Cause |
| --- | ---: | ---: | --- |
| Workout | 266 | 45 | Focus metadata, previous-set lines and evidence, including sheet/menu backdrops; 8 include the approved glossary definition. |
| Library | 14 | 3 | 6 exercise details and suggested details change target labels and the glossary link; 8 glossary frames change the approved definition and underlying copy. |
| Progress | 17 | 5 | 14 comparison/sparse frames change the effort table heading; 3 Portuguese overview/range frames change missing-effort copy to Sem esforço. |
| Onboarding start | 7 | 3 | 3 FAQ definitions, 3 numerical proof phones and 1 first-run frame with the proof just visible at its bottom edge. |
| Onboarding shared | 3 | 1 | Invalid-link frames show the changed proof header at the bottom edge. |

The 28 changed entry semantic records contain only `glossary.RIR` text changes, 20 English and 8 Portuguese. Element order, roles, names and other attributes are unchanged. The baseline is updated from these retained observations, preserving every other record. Each shard artifact contains the baseline plus its own observations; only records differing from the committed baseline were applied.

No unexplained pixel cause was found. FAQ reflow and underlying Focus changes explain larger difference bounds. No new visible state, scenario, manifest cell or role entry is introduced.

## Eye samples

Reviewed contact sheets for all five flows, then full-size Portuguese 200% Library glossary and Progress sparse frames. Workout samples include numeric effort, evidence, previous-set copy and glossary/backdrops. Progress samples include sparse, comparison and missing-effort outcomes. Library samples include details, suggested details and glossary. Onboarding samples include the proof, FAQ and invalid-link bottom edge.

The longer Portuguese copy adds natural wrapping to Focus metadata/evidence and the shelf label. The sampled glossary and Focus copy remain visible or scrollable; no clipping was observed there. Progress has a known wrapping defect: at 390px normal text the sparse header splits SOBRAND / O, and at 200% it splits SOB / RAN / DO. Comparison has the same narrow header problem. Those frames record the approved copy faithfully, but are not a claim that the layout is accepted.

## Landing correction, issue #712

This is the same sweep and needs no new string. The inert numerical phone now reads the existing `focus.col.left` for its column, Left / Sobra, and `focus.field.left` for its shelf, Reps left / Reps sobrando. It keeps its numerical examples and timeline, regardless of the real device's effort stage. The catalog-key registry follows those keys.

Red-first proof is commit `fc8a5d8dc`. Command: `flock /tmp/taurifer-browser.lock node tools/run-tests.mjs full-browser --suite-id test-landing-variants-mjs`. Before: 363 passed, 2 failed, precisely the English and Portuguese column-label assertions. Both shelf assertions passed because the two keys currently have identical values. Runtime correction is commit `bbd395ea1`. After: **365 passed, 0 failed, 1/1 suite**, using the same command. The existing inertness, timeline and camera checks remain green, including PT 320px.

The four affected landing states were recaptured under the shared lock after #712: **16/16 succeeded**. Seven PNGs replace their retained-CI versions for the corrected visible phone header. Three FAQ recaptures differed only by one color level in the dock shadow, with no changed content; the retained CI versions were kept. The remaining six captures were byte-identical to their existing catalog files. The required phone recaptures also include slight shadow/mark raster differences. In the sampled EN light invalid/proof frames, differences outside the actual header stay below four color levels, with no layout shift observed. Their rasterization cause was not independently reproduced; retain this limitation for the next CI comparison.

## Narrow Portuguese readability probe

Used the production catalog scenarios for Progress sparse, numeric Focus and Library glossary at 320px, both normal and 200% root text. This is six isolated observations, not a catalog sweep. All six had no horizontal page overflow. Text-node Range measurements keep the word `sobrando` on one line in Focus and the glossary. The Focus shelf wraps between Reps and sobrando at 200%; previous-set lines also grow by a line. Their words and controls remain visible, with no clipping observed. The glossary at 200% fits its popup between y=8 and y=560 on the 568px viewport. Its body uses overflow-y:auto, so the longer definition requires vertical scrolling. The final sentence after scrolling was not separately exercised. An optional follow-up scroll probe was cancelled while still queued for the shared browser lock; it supplied no evidence.

The Progress header splits the word across **2 lines at 320px normal**, and **4 lines at 320px with 200% text**. At 390px it splits across 2 and 3 lines respectively. Filed the layout defect as [#715](https://github.com/pedrochagasmaster/repforge/issues/715). These intentional copy baselines must not be read as layout acceptance. No layout change or new wording is included here.

The probe screenshots and measured JSON are retained locally under `/tmp/078-ci-review/`; the reviewed CI frames are committed in the catalog. Physical-device behavior and complete UI fidelity remain unproved.

## Per-state CI counts

| Flow/state | Changed PNGs |
| --- | ---: |
| library/exercise-detail | 3 |
| library/exercise-detail-glossary | 8 |
| library/exercise-detail-suggested | 3 |
| onboarding-shared/invalid | 3 |
| onboarding-start/first-run | 1 |
| onboarding-start/first-run-faq-open | 3 |
| onboarding-start/first-run-proof | 3 |
| progress/strength | 1 |
| progress/strength-all-history | 1 |
| progress/strength-comparison | 6 |
| progress/strength-current-block | 1 |
| progress/strength-sparse | 8 |
| workout/abandon | 5 |
| workout/actions | 8 |
| workout/correction | 8 |
| workout/deload-week | 3 |
| workout/early-finish | 5 |
| workout/effort-menu | 1 |
| workout/effort-stage-a | 8 |
| workout/effort-stage-b | 8 |
| workout/exercise-actions | 5 |
| workout/exercise-note | 7 |
| workout/exercise-note-line | 8 |
| workout/fatigue | 3 |
| workout/first-set-guide | 2 |
| workout/focus-glossary | 8 |
| workout/focus-per-side | 8 |
| workout/focus-utilities-guide | 2 |
| workout/last-rep-slow | 8 |
| workout/logged-sets | 8 |
| workout/logged-sets-folded | 8 |
| workout/max-set-active | 3 |
| workout/max-set-guess | 5 |
| workout/max-set-prompt | 8 |
| workout/max-set-result | 7 |
| workout/persist-retry | 6 |
| workout/reorder | 5 |
| workout/rest-done | 8 |
| workout/rest-overrun-finish | 5 |
| workout/rest-running | 8 |
| workout/rest-sheet | 6 |
| workout/rest-sheet-idle | 3 |
| workout/session | 5 |
| workout/skipped-actions | 4 |
| workout/stage-tip | 7 |
| workout/stale-draft | 6 |
| workout/substituted-actions | 5 |
| workout/swap-reason | 3 |
| workout/warmup-actions | 5 |
| workout/wheel-load | 6 |
| workout/wheel-reps | 6 |
| workout/why-calibration | 3 |
| workout/why-in-session | 8 |
| workout/why-manual | 7 |
| workout/why-per-side | 8 |
| workout/why-setup | 8 |
| workout/why-this-weight | 8 |
