# Taurifer onboarding design tournament

An isolated review harness for redesigning the complete onboarding system
(first run through activation) as one experience. It lives entirely under
`docs/design/onboarding-tournament/` and touches no production file. It is a
design artifact, not a shipped surface: nothing here is precached, referenced
by `index.html`, or part of the UI screen catalog.

## Baseline

- Redesign baseline: PR #256 `ui-overhaul/058-system-convergence`, head
  **`f61ce44b05b1b6717abb4ef00b2395204e9c9636`** (resolved from the live PR on
  2026-09-28; it had advanced past the `fb1e9c25` P4c/P4d close named in the
  brief). `main` at `de0f7e61` was not used as the visual baseline.
- Production captures compared against: `docs/ui-screens/screens/onboarding-*`
  at that head (66 onboarding frames across eight flows).
- Authorities read before designing: `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`,
  `docs/brand-guide.md`, `docs/design/ui-system-semantic-contract.md`,
  `tools/ui-role-inventory.json`, `docs/ui-screens/manifest.json`,
  `docs/ui-screens/entry-semantics.json`, `tools/ui-screens/screens-onboarding.mjs`,
  the onboarding implementation in `index.html` / `styles.css` / `app.js`
  (`renderOnboarding`, `renderEntryHub`, `renderResultStep`, `renderPreviewStep`,
  `renderImportReview`, free-form stages, `startOnboarding`, `activateEntryPreview`,
  `commitSharedSetup`), `program-entry.js` (`ROUTE_STEPS`, validation, resume,
  activation readiness), ADRs 0007/0009/0014, Plans 048/054/058/060/061 and the
  entry test suites (`entry-chooser`, `entry-landing`, `onboarding-cancel`,
  `program-entry-*`, `program-freeform-import`, `program-import-review`,
  `shared-setup-flow`).

## How to run

Serve the repository root over HTTP (fonts, brand mark and exercise
illustrations are referenced relative to the repository), then open the
harness:

```bash
python3 -m http.server 8000
# http://localhost:8000/docs/design/onboarding-tournament/
```

`index.html` is the control surface: round, candidate(s) side by side,
scenario, state, PT-BR/EN, light/dark, 320/390/430 width, 100%/200% text,
normal/reduced motion. Each phone is a live `app.html` document; every control
inside it works. Any phone can be opened alone with its `open ↗` link, e.g.
`app.html?c=b&cp=rec-result&lang=pt&theme=dark&text=200&motion=reduced`.

**Fullscreen, one candidate.** Add a suffix to `index.html`: `#h` opens H
alone at landing, `#h/rec-result` at a state, and options follow a `?`
(`#h/rec-result?lang=en&theme=dark&text=200&motion=reduced`). Candidate
letters a–l are unique across rounds, so the round is inferred. On a wide
window the phone keeps its width (`vw`, default 390) at full height; `w=full`
stretches it. Each phone in the grid has a `fullscreen ↗` link.

**Sharing.** `tools/serve.py [port]` serves this folder only (default port
8190) and also maps clean paths to the fullscreen suffix: `/h`,
`/h/rec-result?lang=en`, `/4/h`. For a public link, run a Cloudflare quick
tunnel: `cloudflared tunnel --url http://127.0.0.1:8190`. The link lasts as
long as both processes run.

Acceptance run (writes `round-N/acceptance/{results.json,summary.md,shots/}`):

```bash
node docs/design/onboarding-tournament/tools/verify.mjs --base http://127.0.0.1:8000/docs/design/onboarding-tournament/ --round 1
node docs/design/onboarding-tournament/tools/verify.mjs --base http://127.0.0.1:8000/docs/design/onboarding-tournament/ --round 2 --candidates d,e,f
```

Round 2 runs the eight §12.1 cells per checkpoint with the generic §12.2
checks, then the candidate journeys defined in `round-2/JOURNEYS.md`. Two
self-tests prove the tooling and the shared helpers:
`tools/audit-selftest.mjs` (injects one defect per generic check) and
`tools/harness-selftest.mjs` (calls the shared helpers directly). The proof
record is `round-2/harness-proof.md`.

## What is real, what is ported, what is simulated

The comparison is only fair if every candidate runs on the same truth. The
runtime (`runtime.js`) draws the line explicitly:

| Layer | Source | Notes |
| --- | --- | --- |
| Program compilation, browse catalogue, split choices, explanations, versions | **Real**: `vendor/program-compiler.js`, `vendor/program-entry-adapter.js`, `vendor/exercises.js` (verbatim from the baseline SHA) | Every program shown by any candidate is compiled live from the same answers; no program is hand-written. |
| Entry state, validation, resume/rules-drift status, activation readiness, candidate activation issues | **Real**: `vendor/program-entry.js` | Candidates may lay steps out differently, but activation gating and conflict detection are the production checks. |
| Setup-link decode/validate (incl. invalid link) | **Real**: `vendor/shared-setup.js` with the built-in id allowlist | The valid fragments in `data/fixtures.js` are `v1.` envelopes; `v1.not+base64` is the invalid one. |
| Import review classification (exact / other language / likely with a 3-entry shortlist / no match, 0.35 floor) | **Ported** from `app.js` at the baseline | Same scoring, ordering and decision defaults; `pickableExercises` is the whole library. `TF.importPreview` / `TF.importResult` emit JSON-clean results (H-1), so `Entry.setResult` accepts them and activation reaches Today. |
| Free-form reply reading (complete / gaps / unreadable), gap validation and assembly, the hand-off prompt | **Ported**; the prompt is the reviewed `entry.freeform.prompt` string | The reply and pasted text are fixtures (`data/fixtures.js`); the assistant links are real URLs and are not followed by the harness. "Recomeçar" asks the production `entry.freeform.confirm_start_over` first (H-6). |
| Device store (active program, revision, setup draft), activation transaction, replacement, cross-tab conflict, Today boundary | **Simulated** | Same rules for every candidate: activation runs `activationReadiness` first; replacement always confirms; a revision bump behind the draft produces the conflict state. Nothing persists across reloads. The active program stores `name` and `namePt`; Today renders the localized name and localizes every muscle token (H-5). |
| Setup-draft API (`TF.saveDraft`, `TF.loadDraft`, `TF.clearDraft`) | **Simulated** store, **real** rules | Keep in the cancel dialog and "Salvar rascunho" write `device.draft`; the envelope is validated by the real `Entry.normalizeSetupDraftEnvelope`, and `loadDraft` reads it back through the real `Entry.resumeSetupDraft` (resumable / rules_changed / activation_conflict). Seeds `interrupted` and `rules-drift` write their drafts the same way (H-9). In memory only. |
| Program editor for Build / Edit before using | **Simulated** shared widget (`candidates/shared-screens.js`) | Day list, library search, sets/min/max, remove. One model for both uses: `TS.build.fromPreview` / `toPreview` round-trip a reviewed preview keeping every untouched row byte-identical (progression, prescription, ids, day identity) and syncing progression params only for a changed prescription (H-2); `TS.build.commit(result, build)` is the edited result that activation commits (H-3); `TS.build.result(build)` is the Build route's result and `TS.build.status` reads the real `activationReadiness` (H-4). No drag reorder. |
| Engine codes to copy | **Shared** mapping (`TS.issueText` / `TS.issueTexts`) | Every activation, validation, compile and limitation code maps to catalog or `x.*` copy; the only fallback is a generic sentence (H-10). |
| Privacy page | **Simulated** stub (`TS.privacySheet`) | A sheet with the production `privacy.*` strings (local-first, setup links, telemetry, export/delete, limitations). `TS.wire` opens it for any `[data-act="privacy-open"]` (H-15). |
| Landing proof | **Real** asset | `vendor/brand/today-ready-{pt,en}-{light,dark}.webp` from the baseline with `landing.shot.today_ready.alt` (`TS.landingProof`, H-8). |
| File picker and clipboard | **Simulated** | "Choose file" loads the import fixture; "Import from clipboard" pastes the gaps reply fixture. |

Copy: production strings come from the two catalogs at the baseline
(`data/fixtures.js`, 703 keys, including `privacy.*` and `muscle.*`). A
shared **copy override layer** (`OVERRIDES` in `runtime.js`, applied by
`TF.makeT` for every candidate) replaces the baseline strings that break the
brand rules, with the settled replacements of synthesis spec §5.3 (H-7; the
catalog fix itself is production follow-up PD-5). Strings a candidate adds
are in its own file under `candidates/` or `round-2/candidates/` (both
languages, keys prefixed with the candidate id), plus a shared set (`x.*` in
`shared-screens.js`) for conditions the production catalog never names
(limitation codes, replacement and restart dialogs, change statements, issue
sentences, route facts derived from `ROUTE_STEPS`, never minutes, H-11).
Copy is written PT-BR first; brand rules apply (sentence case, no exclamation
marks, no em dashes in app prose, no theme words).

## Shared comparison contract

Every candidate must reach the same 45 checkpoints (`TF.CHECKPOINTS` in
`runtime.js`), grouped into the 14 required scenarios, with the same example
users, data and seeds:

| Scenario | Checkpoints |
| --- | --- |
| 1 Brand-new user | `landing` |
| 2 Uncertain route | `route-choice`, `route-help` |
| 3 Recommend | `rec-goal`, `rec-background`, `rec-schedule`, `rec-environment`, `rec-priorities`, `rec-result` |
| 4 Correction | `rec-env-correction` (limited home + dumbbells + band + safe pull), `rec-result-corrected` |
| 5 Pain avoidance | `rec-avoid-pain` (barbell bench press, reason pain), `rec-result-avoided` |
| 6 Browse | `browse-filters`, `browse-list` (4 days / 60 min / commercial gym), `browse-preview` (Muscle + Strength · 4 days) |
| 7 Custom | `custom-priorities`, `custom-exercises` (include bench press, avoid barbell curl), `custom-shape`, `custom-result` |
| 8 Build | `build-setup`, `build-empty`, `build-partial`, `build-ready` |
| 9 Free-form / import | `ff-empty`, `ff-filled`, `ff-handoff`, `ff-reply`, `ff-gaps`, `ff-gaps-invalid`, `ff-unreadable`, `import-source`, `import-review`, `import-preview` |
| 10 Shared | `shared-gate`, `shared-preview` |
| 11 Invalid link | `shared-invalid` |
| 12 Existing program | `hub-existing`, `replace-confirm`, `activation-conflict` |
| 13 Recovery | `resume`, `rules-changed`, `cancel-confirm` |
| 14 Activation | `activate`, `activated-today` |

Example users and data (`data/fixtures.js`): Rafael (28, São Paulo, commercial
gym, 3 days, 60 min, muscle growth, 6–24 months structured, most sessions
completed); the custom-route answer set (balanced, 4 days, chest priority,
calves de-emphasized, bench press included, barbell curl avoided); the browse
context (4 days, 60 min, commercial gym); an existing 2-day active program with
seven logged sessions; a coach's 3-day shared program (12 exercises) encoded in
both languages; Rafael's 6-exercise import file (exact, likely and unmatched
rows); a pasted push/pull program with a gaps reply (reps missing for cable
flyes, sets missing for lat pulldown, rest and RIR not imported) and an
unreadable reply.

Matrix per candidate: PT-BR and EN; light and dark; 320, 390 and 430 px; 100%
and 200% text; normal and reduced motion. The acceptance run covers five
representative cells per checkpoint (PT light 390; EN dark 390; PT light 320;
PT light 390 at 200%; EN light 430 reduced motion) and records runtime errors,
missing checkpoint markers, horizontal overflow, targets under 44 px and
clipped text.

A candidate may merge states its architecture makes unnecessary, but the
underlying condition must still be reachable and marked with
`data-checkpoint="<id>"` on the element that represents it.

## Round 1 candidates

| Candidate | Thesis | Divergence axis | Product-policy decisions required |
| --- | --- | --- | --- |
| **A · Uma pergunta** (`candidates/a.js`) | Never make a new lifter choose a method: ask the four things that change the program, one per screen, show the program at once, and offer every other route as a refinement of what is on screen. | Progressive questioning; deferred route choice; the result is the review; facts as editable chips; exercise avoidance on the program itself. | Recommend, Custom and Browse collapse into one guided path with refinements (Plan 054 explicitly kept them separate). Session length defaults to 60 min and rest to automatic before the lifter answers, shown as assumed facts. |
| **B · Cinco portas honestas** (`candidates/b.js`) | Keep the five jobs and make choosing one cheap: every door states its cost and its outcome; questions stay grouped by consequence with an answer rail; the result leads with the program; recovery lives inline. | Up-front route choice with transparent cost; configure-then-preview; `ROUTE_STEPS` unchanged. | **None.** Implementable within the current state machine and Plan 058 semantic contracts. The replacement confirmation is a dialog instead of `window.confirm`, which is a UI change, not a rule change. |
| **C · Programa primeiro** (`candidates/c.js`) | Show a real, trainable program before asking anything, and let the lifter correct the facts it was built from directly on the program until it is theirs. | Immediate preview; preview-and-edit; no question screens; live recompile with a diff line; other routes are "switch this program for…". | A program is compiled from default answers before the lifter answers (unconfirmed assumptions; nothing persisted). Recommend, Custom and Browse are reached from one surface rather than a chooser. |

All three preserve: no program before onboarding (candidates are in-memory
drafts until activation); explicit activation; replacement confirmation with
history untouched; cross-tab conflict handling; resume / rules-changed
recovery; the shared-link gate as the consent boundary; import review before
any write; the free-form hand-off stages, gap repair and unreadable recovery;
build activation gating; the 44 px floor; 16 px control text; token-only
colour; light/dark parity; reduced motion as one decision.

## Files

| Path | Role |
| --- | --- |
| `index.html`, `harness.js`, `harness.css` | Review control surface |
| `app.html` | Round 1 candidate document per phone; reads `?c=&cp=&lang=&theme=&text=&motion=` |
| `round-2/app.html` | Round 2 candidate document; shared files from `../`, the candidate from `round-2/candidates/<c>.{js,css}` (loaded on demand) |
| `round-2/JOURNEYS.md` | The Round 2 candidate journey interface (exports, markup, api, every journey and its assertions) |
| `round-2/candidates/_example.{js,css}` | Placeholder candidate that proves the Round 2 tooling end to end (not a design) |
| `round-2/harness-proof.md` | Proof of H-1 to H-15 and the Round 2 tooling, with commands and output |
| `tokens.css` | Semantic tokens vendored verbatim from `styles.css` at the baseline SHA |
| `base.css` | Shared control/surface recipes derived from the Plan 058 contract |
| `runtime.js` | Real/ported/simulated logic boundary, checkpoint contract, device store |
| `candidates/shared-screens.js` | Shared widgets for the hard states, shared new copy |
| `candidates/{a,b,c}.{js,css}` | The three directions |
| `data/fixtures.js` | Generated by `tools/build-fixtures.mjs <pr256-checkout>`; i18n subset, shared fragments, import/free-form fixtures, example users |
| `vendor/` | Verbatim modules from the baseline SHA, Plex fonts, brand mark (see `vendor/README.md`) |
| `tools/verify.mjs` | Acceptance run (Round 1 frozen contract; Round 2 cells, generic checks and journeys) |
| `tools/audit-page.js`, `tools/journey-api.js`, `tools/journey-checks.js` | In-page Round 2 audit, journey api and engine-backed journey checks (injected by `verify.mjs`) |
| `tools/audit-selftest.mjs`, `tools/harness-selftest.mjs` | Self-tests: one injected defect per generic check; the shared helpers called directly |
| `round-1/` | Manifest, acceptance results, judge reports, synthesis spec |
| `round-2/` | Second-round candidates, acceptance, judge reports, final comparison |
