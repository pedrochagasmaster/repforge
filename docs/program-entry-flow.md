# Program entry flow

This document fixes the route and screen contract for Taurifer's shipped
program-entry redesign. The pure contract was first specified as the Wave 1
boundary in [Plan 048](../plans/048-program-entry-onboarding-redesign.md);
Plans 045 through 047 are now integrated and the production route consumes
those contracts through the entry adapter.

## Authorship decides the route

The person choosing a split does not make a program manual. The route depends
on who writes the executable prescription.

| Route | Who chooses the prescription? | First destination | Shipped production surface |
|---|---|---|---|
| Recommend | Taurifer chooses structure, exercises, sets, targets, and progression from factual context. | Desired result | Five questionnaire sections, recommendation, and common editable preview |
| Custom | The user chooses bounded preferences. Taurifer still writes the prescription. | Desired result | Five questionnaire sections, split choice, generated result, and common editable preview |
| Browse | The user chooses a complete, executable Taurifer program. | Compatibility context | Reviewed catalogue and common editable preview |
| Build | The user writes days, exercises, sets, targets, and a supported progression method. | Program name and day count | Empty-day editor and common editable preview |
| Import | The user brings an external prescription. | Import source and review handoff | Import mapping, common editable preview, and explicit activation |
| Shared | Another Taurifer user supplied a released setup payload. | Existing shared-program review | Consent gate, common editable preview, and explicit activation |

Recommend is the default inside the primary **Create a program** group. Custom
is its deliberate alternative. Browse is a lower-emphasis choice. Build and
Import sit under **Bring or build my own**.

Research participants use these routes without a special entry path. Pro,
payment, future-family teasers, and disabled controls do not belong here.

## Screen contract

The state machine uses stable semantic step IDs. UI adapters may group closely
related questions on one screen, but they must not replace these IDs with
display indexes.

| Step ID | Routes | Required before Continue | Notes |
|---|---|---|---|
| `entry` | all | Route selection | Back exits only through an explicit UI cancellation decision. |
| `desired_result` | Recommend, Custom | `muscle_growth`, `balanced`, or `strength` | Consistency is never a desired result. |
| `background` | Recommend, Custom | Structured-program experience and recent six-week consistency | Experience is factual time, not beginner/intermediate/advanced. |
| `schedule` | Recommend, Custom, Browse | 2-6 days, 30/45/60/75/90+ minutes, and preferred rest for generated routes | Browse may reuse reviewed compatibility context and ask only missing facts. |
| `environment` | Recommend, Custom, Browse | A reviewed environment shortcut | Equipment correction is compact and capability-based. |
| `priorities` | Recommend, Custom | A valid bounded selection, including none | At most two primary muscles. Avoided exercises carry one closed reason. |
| `custom_shape` | Custom | One of at most two compiler-approved split choices | The compiler supplies the choices and default after frequency is known. |
| `catalogue` | Browse | One complete, executable, browseable version | Disabled and future entries never enter the service result. |
| `build_setup` | Build | Non-empty bounded name and 2-6 days | The editor receives real empty day containers, never placeholder exercises. |
| `import_source` | Import | A validated import handoff | This module never reads files or decodes payloads. |
| `shared_review` | Shared | A validated released setup handoff | Preserve [ADR 0007](adr/0007-shared-setup-links.md) first-run precedence and consent. |
| `result` | Recommend, Custom | A deterministic selected candidate and snapshot | Recommend has one primary result and at most one close alternative. Custom has one result and no reroll. |
| `preview` | Recommend, Custom, Browse, Import, Shared | A complete preview snapshot | Edits affect the draft only. The active program remains untouched. |
| `editor` | Build | Empty-day draft created | Activation stays blocked until the later production editor validates it. |
| `activation_conflict` | Preview routes | Fresh review after a revision mismatch | A stale setup can never overwrite a newer active program. |

Recommend groups `desired_result`, `background`, `schedule`, `environment`,
and `priorities` into roughly five short sections. Custom reuses those facts,
then adds `custom_shape`. It must not ask for Taurifer's set-volume logic,
RIR, rep ranges, progression formulas, or deload timing.

Browse asks only the compatibility facts that the chosen catalogue version
needs. Build asks only for a name and day count before the editor. Import and
Shared accept validated handoffs from their owning adapters; neither parser
belongs in `program-entry.js`.

## Route transitions

`Back` follows the graph and preserves answers. Optional omissions never create
an impossible step. UI cancellation is separate because the user must choose
whether to keep or discard the setup draft.

| Route | Forward path | Back from terminal |
|---|---|---|
| Recommend | `entry -> desired_result -> background -> schedule -> environment -> priorities -> result -> preview` | `preview -> result` |
| Custom | `entry -> desired_result -> background -> schedule -> environment -> priorities -> custom_shape -> result -> preview` | `preview -> result` |
| Browse | `entry -> schedule -> environment -> catalogue -> preview` | `preview -> catalogue` |
| Build | `entry -> build_setup -> editor` | `editor -> build_setup` |
| Import | `entry -> import_source -> preview` | `preview -> import_source` |
| Shared | `entry -> shared_review -> preview` | `preview -> shared_review` |

Switching between Recommend and Custom keeps their shared factual context.
Switching to Browse keeps schedule, environment, and factual experience where
compatible, then removes generator-only choices such as desired result,
priorities, split, result, and preview. Switching to Build, Import, or Shared
removes every generator prescription and result. No switch changes the active
program.

## Context and draft ownership

Reusable programming context and the setup draft are different records.

- Reusable context belongs to the user, is included in full backup, and is
  omitted from program export and setup sharing.
- The setup draft snapshots route answers, service versions, result selection,
  preview, timestamps, and the active-program revision observed at start.
- A later setup may prefill reusable context, but the UI must require review of
  result, schedule, environment, consistency, and constraints before compiling.
- Starting over deletes only the setup draft.
- Corrupt, oversized, too-deep, or unsupported drafts fail closed and leave the
  active program, reusable context, history, and import source unchanged.
- A saved old-version preview stays readable. The application must not silently
  regenerate it under new rules.

The pure module normalizes these records. The production entry adapter owns the
`repforge_program_setup_draft_v1` key and persists the owned draft through the
existing storage lock. Activation remains a separate explicit transaction; no
draft edit changes the active program.

## Service boundary

The original Wave 1 tests state-machine behavior with injected fixture
services. Those services document the historical compiler and catalogue
contract; the shipped production route now uses the Plan 047 compiler and
catalogue through `program-entry-adapter.js`.

- The compiler receives normalized answers and an explicit version set. It
  returns candidates, diagnostics, a complete preview snapshot, and a stable
  fingerprint.
- The split service returns zero to two compatible choices and identifies its
  deterministic default.
- The catalogue returns only complete, executable, tested versions marked for
  browsing. It owns card facts and mismatch explanations.
- Import and shared adapters return validated preview handoffs. The state
  machine never reads a file, URL, fragment, cookie, DOM node, or global.

The same normalized inputs and versions must produce the same semantic result.
Changing a named input permits recompilation. Calling the same service again is
not a reroll.

## Activation boundary

The state machine reports readiness; it does not activate a program. Before a
production adapter commits activation, it must compare the draft's
`activeProgramRevisionAtStart` with live durable state.

- Equal revisions allow the existing activation transaction to proceed.
- Different revisions move the setup to `activation_conflict` and require a
  fresh review.
- Cancel, Back, preview edits, route switches, reload, resume, and start-over
  never archive or replace the active program.
- First-run activation uses **Use this program**. Existing-program activation
  uses **Archive current program and use this one**.

This boundary preserves Taurifer's current transition and workout-draft
protections instead of introducing a second commit path.

## Legacy answers

Legacy answers are reviewable hints, not new factual claims.

| Old answer | Prefill or hint |
|---|---|
| Goal `hypertrophy` | Prefill desired result `muscle_growth`; require review. |
| Goal `strength_hypertrophy` or `strength` | Prefill `balanced`; require review. |
| Goal `beginner_consistency` | Leave desired result unanswered. Preserve a legacy hint. |
| Self-rating `beginner`, `intermediate`, or `advanced` | Preserve a legacy hint. Ask structured-program time. |
| `daysPerWeek` from 2 through 6 | Prefill days and require schedule review. |
| Vague `sessionLength` | Preserve a hint. Ask for 30/45/60/75/90+ minutes. |
| Exact known equipment semantics | Prefill a reviewable environment mapping. Unknown values remain hints. |
| `splitType` | Keep only for Custom and only if the injected split service still accepts it. |
| More than two priorities | Preserve the whole legacy hint and require a new choice. Never truncate it. |

Historical `programMeta` is unchanged. New provenance begins only when a new
draft is created.

## Historical production integration gates

The following list records the historical gates that governed the transition
from the Wave 1 fixture handoff to production. Plans 045, 046, and 047 have
landed, and the Plan 048 production route now consumes those contracts:

1. Merge Plan 045 before adding semantic telemetry calls.
2. Merge Plan 046 before exposing progression choices in the manual editor.
3. Merge Plan 047 before connecting Recommend, Custom, Browse, or Build to real
   program output.
4. Replace the legacy DOM only after pure, browser, accessibility, privacy,
   screenshot, and physical-device gates cover the new route.

The production adapter must continue to honor the local-first and shared-setup
rules in [AGENTS.md](../AGENTS.md), the owner decisions in the
[decision register](product-grilling-decision-register.md), and the strategy in
[the business and product thesis](business-product-thesis.md).

## Production UI integration handoff (historical Wave 1 contract)

Wave 1 is complete. This section preserves the contract that the production
slices consumed; its runtime implementation now lives in the shipped entry
adapter and application. Editing this section alone adds no runtime code.

### What Wave 1 delivered

- `program-entry.js` — the dependency-free `RepForgeProgramEntry` module. It
  exposes `SCHEMA_VERSION`, `CONTEXT_SCHEMA_VERSION`, `MAX_CONTEXT_BYTES`,
  `MAX_DRAFT_BYTES`, `ROUTES`, `ROUTE_STEPS`, and the pure functions
  `createState`, `selectRoute`, `setAnswers`, `setResult`,
  `normalizeProgrammingContext`, `normalizeSetupDraft`, `migrateLegacyAnswers`,
  `validationIssues`, `advance`, `back`, `resumeSetupDraft`, `updateTimestamp`,
  `startOver`, and `activationReadiness`. Every function is pure: it clones its
  input, never reads a global, DOM node, file, URL, or clock, and returns a new
  frozen-shape value or a typed failure.
- `test/fixtures/program-entry-services.mjs` — `createFixtureServices()`
  returning `splitChoices`, `compile`, and `browseCatalogue`. It is a
  test-only description of the future service contract, never a shipped
  generator.
- Coverage: `test/program-entry.mjs` (pure graph, schemas, migration, resume,
  switching, stale drafts), `test/program-entry-fixture-services.mjs`
  (deterministic compile, closed inputs, 2–6 day coverage, catalogue
  filtering), and `test/generative/properties/program-entry.mjs` with
  `test/generative/model/program-entry.mjs` (seeded route/switch/resume/
  restart/conflict journeys with active-program byte-equivalence invariants).

### Fixture service to production service swap

A production service must return the same shapes the fixture returns. Only the
source of the data changes.

| Service | Fixture stand-in | Production source | Invariant that must hold |
|---|---|---|---|
| `compile(mode, answers, versions)` | Deterministic FNV fingerprint over sorted inputs | Plan 047 family selection plus the Plan 047 compiler through the Plan 046 engine | Same normalized answers and version set produce the same candidates, diagnostics, preview snapshot, and fingerprint. |
| `splitChoices(answers)` | Static frequency map, first choice is default | Plan 047 recipe metadata for the resolved family and frequency | Zero to two choices, exactly one default, and every returned split is compiler-approved for that frequency. |
| `browseCatalogue(context)` | Three hand-authored entries, one disabled | Plan 047 compiled catalogue metadata | Only `browse && complete && executable && tested` versions appear; card facts and mismatch text come from Plan 047, not a second UI algorithm. |
| Import handoff | `{ importReady: true }` answer plus a `setResult` snapshot | The existing import review/mapping adapter | `program-entry.js` still never reads a file or decodes a payload; it receives a validated preview handoff. |
| Shared handoff | `{ sharedReady: true }` answer plus a `setResult` snapshot | The released [ADR 0007](adr/0007-shared-setup-links.md) shared-setup adapter | First-run precedence and consent are unchanged; personal context never enters a shared or exported payload. |

### Ordered production slice consumption

The production slices map to
[Plan 048](../plans/048-program-entry-onboarding-redesign.md) Slices 2–7. Each
slice consumes Wave 1 as follows and must not point a public route at a
partially built next slice.

1. **Entry hub and shared context (Slice 2).** Render `entry` plus the
   `desired_result`, `background`, `schedule`, `environment`, and `priorities`
   steps against `ROUTE_STEPS`, `validationIssues`, `advance`, and `back`. Own
   the `repforge_program_setup_draft_v1` key and call `normalizeSetupDraft`,
   `resumeSetupDraft`, `startOver`, and `updateTimestamp` for durable state.
   Prefill from `migrateLegacyAnswers`; use the Plan 048 compiler path for
   every supported setup route.
2. **Recommend and common preview (Slice 3).** Swap the fixture `compile` for
   the real Plan 047 + Plan 046 path. Feed `setResult` with the compiled
   snapshot. Activate through the existing transition journal after
   `activationReadiness` returns `ok`; route a revision mismatch to
   `activation_conflict`.
3. **Custom (Slice 4).** Add the `custom_shape` step backed by the real
   `splitChoices`. Prove no reroll: calling `compile` again with unchanged
   inputs must not change the fingerprint. Never surface set-volume, RIR,
   rep-range, or deload math.
4. **Browse (Slice 5).** Render `schedule`, `environment`, `catalogue`, and
   `preview` using the real `browseCatalogue`. Disabled and future entries must
   never reach the step.
5. **Build, Import, and shared convergence (Slice 6).** Build uses
   `build_setup` then `editor` with real empty day containers from Plan 047
   structure; the manual editor offers only Plan 046 strategies. Route Import
   and shared setup through the same `preview` and activation path without
   changing released payload handling.
6. **Legacy removal and hardening (Slice 7).** The obsolete `onbStep`,
   `onbAnswers`, and embedded generator APIs are removed; retain only the
   migration and import compatibility needed for existing data.

### Gates before legacy DOM removal

- Plans 045, 046, and 047 are merged to `main`; this branch has merged current
  `origin/main` with an explicit merge commit.
- Pure suite, `test/program-entry-fixture-services.mjs`, and the
  `program-entry` generative suites pass, plus every browser suite in
  `.github/workflows/simulation.yml` touching entry, first-run, install modes,
  shared setup, and session summary.
- Accessibility, privacy/leakage, and full light/dark screenshot catalogue
  regenerated for every route at 320 px and representative phone/tablet/desktop
  widths, in PT-BR and English.
- iOS Safari/VoiceOver and Android Chrome/TalkBack manual checks on the exact
  release build for first run, returning user with an active program, valid
  shared link, and invalid shared link.
- Service-worker `CACHE` bumped and `?v=NN` revisions moved in lockstep for any
  newly precached module.

### Historical Wave 1 non-deliverables

- No second temporary production generator was part of the Wave 1 handoff.
- Wave 1 changed no `app.js`, `index.html`, `styles.css`, `i18n`, `sw.js`, or
  telemetry file; the later Plan 048 production integration does ship changes
  in those surfaces.
- No public route pointing at a placeholder or unbuilt slice.
- No Pro, paywall, participant-only flow, or future-family teaser.
