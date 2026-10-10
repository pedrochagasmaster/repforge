# CLAUDE.md

Fast orientation for coding agents. `AGENTS.md` owns repository operating rules. When guidance here conflicts with it, follow `AGENTS.md`. This file points to live owners; it does not define a second contract.

## Read for the task

- [`AGENTS.md`](AGENTS.md) for the static-app architecture, privacy and storage rules, generated-file sources, cache/revision procedure, UI catalog, and current execution constraints.
- [`CONTEXT.md`](CONTEXT.md) for domain terms and language to use in code and copy.
- [`docs/backlog.md`](docs/backlog.md) for the only ordered work queue. For the current post-058 candidate sequence, follow its linked clearance sequence.
- [`plans/README.md`](plans/README.md) before executing an existing plan. The plans directory is history and bounded implementation guidance, not a roadmap.
- [`docs/ci.md`](docs/ci.md) and [`test/suites.mjs`](test/suites.mjs) for current verification commands and test ownership.
- Relevant records in [`docs/adr/`](docs/adr/) for settled decisions. Managed Taurifer AI follows ADR 0011; the superseded BYOK plan is not an implementation path.
- [`docs/design/interaction-runtime-audit.md`](docs/design/interaction-runtime-audit.md) before adding, removing, or retuning motion.

## What this app is

Taurifer is a local-first mobile PWA served as a static site. Workout records stay on the device; the app sends only opted-in telemetry and supports the explicitly approved short-lived install transfer. User-facing name: Taurifer. Historical `repforge` identifiers preserve existing installs; see the naming inventory in `AGENTS.md` before touching identifiers.

## Application ownership

Use the module that owns the behavior. These are the principal production owners; `app.js` coordinates boot, UI, and host workflows, and still contains substantial application behavior.

| Owner | Responsibility |
| --- | --- |
| `index.html`, `app.js` | Script loading and shell; pre-paint theme setup; boot and UI coordination. `app.js` owns the production transition adapter and commit/recovery orchestration, the `WorkoutSession` lifecycle interface, and setup-link routing/confirmation, file and free-form import review, activation, and backup flows while delegating domain contracts to their modules. |
| `durable-state.js` | Durable localStorage/IndexedDB writes, lock and journal coordination, replica recovery, and DraftV2 storage/checkpoint protocol. |
| `workout-draft.js` | Pure DraftV2 aggregate, validation, commands, projection, and serialization. |
| `program-transition.js` | Validated block-transition proposals, identity mapping, recovery eligibility, and recovery projections. `app.js` owns the production adapter and transition commit/recovery workflows. |
| `progression-engine.js` | Deterministic set-level progression recommendations, calculations, and strategy evaluation. |
| `progress-model.js` | Pure Progress/history evidence and view-model projections. It consumes outcomes and recommendations from its caller. |
| `program-entry.js`, `program-entry-adapter.js` | Entry state and shared entry vocabulary; production compiler/catalog integration and entry choices. |
| `program-compiler.js` | Versioned program-family definitions, compilation, authored catalogue functions, week-aware selection, dose fitting, and structural validation. |
| `program-editor.js` | Reusable program editor. Its host supplies data and handles returned intents. |
| `program-review.js` | Onboarding B's review editor on Generate's result screen: pure edit rules on a `ProgramDefinition` (validated, replayable), the diff against the recommendation, and `mountProgramReview`. `app.js` supplies the document, persistence, sheet and picker. |
| `history-ui.js` | History rendering and interactions through dependencies supplied by the app. |
| `shared-setup.js` | Setup-link codec and validation; this module and `AGENTS.md` own the current format, compatibility, and privacy contract. |
| `install-transfer.js`, `install-transfer-contract.js` | Browser transfer client and its shared request/envelope contract. `services/install-transfer/` owns the service. |
| `install-policy.js`, `guide-registry.js` | Install-prompt eligibility and versioned contextual-guide definitions/state. |
| `motion-layer.js` | Motion vocabulary, reduced-motion decision, gesture controller, and fallback. `app.js` mounts and disposes the controller through this layer. |
| `telemetry.js`, `posthog-init.js` | Closed event/privacy boundary, consent and identity; `posthog-init.js` adapts the optional SDK using generated deployment configuration. |
| `schedule.js`, `notify.js` | Training schedule helpers; notification adapter and delivery helpers. |
| `sw.js` | Release asset inventory, cache lifecycle, offline shell, and code-response policy. |
| `styles.css`, `motion-polish.css` | Presentation tokens and component styles; appearance rules and exceptions are governed by `AGENTS.md` and the design audit. |
| `i18n-en.json`, `i18n-pt.json`, `tools/exercise-curation.json`, `tools/exercise-compiler-data.json` | Translation and exercise source data. `i18n.js` and `exercises.js` are generated runtime files; follow `AGENTS.md` and `tools/README.md`. |

The root JavaScript files are not all architecture owners. Check the relevant module and its callers before moving behavior or adding a new boundary.

## Cache and script revisions

`AGENTS.md` has the full release procedure. For a cache-related change, inspect the live `CACHE` and `ASSETS` in `sw.js`. The release inventory also determines shell routing and immutable asset behavior.

For query-versioned runtime scripts, use `transitionAssets` in `test/exercise-library.mjs` as the current inventory. Keep each listed script's `index.html` URL, its exact service-worker precache URL, and that contract's expected revision aligned. Cache revision and protected script query revisions have separate rules; follow `AGENTS.md` rather than copying a partial list or a revision number into this file. Optional script owners are recorded on the script tag and in `ASSETS`.

## Setup links and privacy

Setup-link encoding, validation, and compatibility are owned by `shared-setup.js`. Consult `AGENTS.md` and ADR 0007 before changing cookies, import eligibility, or sharing. The install-transfer cookie and setup-proposal handoff are separate mechanisms.

Telemetry event names and allowed properties live in `telemetry.js`; `AGENTS.md` and relevant ADRs define the data boundary.

## Working and verification

The app has no build step or root application dependency install. Test-only dependencies live under `test/`. Start with the owning suite or `node tools/run-tests.mjs edit`. Once a coherent commit is focused-test green, push it promptly so remote CI can run while independent review and any useful local `packet` feedback continue in parallel; do not delay the push merely to serialize broader local verification, and do not push known-red or half-implemented work. `packet` is supplemental feedback rather than merge evidence: if the local environment cannot complete it reliably or within its limits, report that limitation and rely on focused owning proofs, independent review, and the complete remote inventory instead of keeping `packet` on the critical path. For a non-prose PR, `ci` runs the complete inventory on the pushed head; genuinely prose-only PRs verify the plan and skip test jobs. Pushes to `main` and manual runs verify the full inventory. A green `ci` check on the final head is the authoritative broad completion evidence. `test/suites.mjs` and `tools/run-tests.mjs` own test selection; do not copy a test list into this file.

For browser tests and the screen catalog, use the worktree-owned preview and capture procedures in `AGENTS.md` and `docs/ci.md`. Do not treat browser automation as physical iOS or Android validation.

Keep product and platform changes inside the current backlog authority. The current architecture remains the Phase 1 static PWA; the approved evidence gates and exclusions are in `AGENTS.md`, `docs/backlog.md`, and the product thesis.
