# Taurifer

Taurifer (formerly RepForge) is a local-first mobile PWA for tracking progressive overload. It is a static site (`index.html`, `styles.css`, `app.js`, `shared-setup.js`, `schedule.js`, `notify.js`, `i18n.js`, `exercises.js`, `sw.js`, `manifest.webmanifest`, `icons/`, `assets/exercises/`) with no build step, no package manager, and no application dependencies. Workout logs, drafts, and history stay on this device and Taurifer never uploads them except through the explicit one-hour install-transfer exception (`docs/adr/0013-temporary-install-transfer.md`) or opted-in telemetry. Setup links intentionally share a program, its configuration, eight allowlisted settings, and language; their temporary iOS handoff cookie is sent to the static host. The install-transfer token cookie is a separate object from the setup-proposal cookie and never carries the clone.

Only the user-facing brand is Taurifer. Internal identifiers deliberately keep the historical `repforge` codename so existing installs keep their data and scope: storage keys and the `repforge_setup_v1` handoff cookie, the IndexedDB name, the cache-name prefix, the cross-tab lock name, `window.__repforge*` test hooks, the `RepForgeI18n`/`RepForgeSchedule`/`RepForgeNotify`/`RepForgeSharedSetup` globals, the repository slug, and the GitHub Pages URL. Do not rename these. The full naming-surface inventory, plus voice, copy, and visual rules, lives in `docs/brand-guide.md` (rationale in `docs/adr/0004-taurifer-rebrand-neutral-copy.md`).

Appearance (System/Light/Dark) is the one visible setting that is not a setting: it lives in the device-only UI prefs (`repforge_ui_v1`, key `theme`), so ordinary backup import excludes it and it never enters a state proposal or the setup-link allowlist. The approved one-hour install transfer is the single exception that includes UI preferences (`docs/adr/0013-temporary-install-transfer.md`). `app.js` resolves it to `<html data-theme>`, an inline snippet in `index.html` replays it before the first paint, and `styles.css` reads nothing else — dark is a `:root[data-theme="dark"]` token swap, so a new rule must name tokens rather than colours. See `docs/adr/0009-appearance-setting-dark-theme.md`.

When adding or changing device UI preferences, check both install-transfer clone fidelity and destination eligibility. Automatic presentation metadata must not make an otherwise fresh destination ineligible for transfer; explicit user choices and unknown or malformed records must remain protected. Exercise both acceptance after normal boot and reload and refusal through the production import path.

Durable state is mirrored in `localStorage` (`repforge_v1`) and IndexedDB (`repforge` / `kv`). While state writes wait on the cross-tab lock, immutable unversioned write-ahead entries under the `repforge_pending_v1:` key prefix preserve their order for boot-time replay without claiming durable revisions. An in-progress DraftV2 workout lives in `localStorage` under the historical `repforge_draft_v1` key and is acknowledged by `repforge_draft_v1:v2-checkpoint`; the checkpoint records a pending publication, committed aggregate, pending removal, or tombstone. `repforge_draft_v1:recovery` retains raw bytes when canonical storage or its checkpoint cannot be trusted. Draft commands use the cross-tab lock and compare-and-swap on draft identity plus revision; the whole aggregate is the durable value, and the checkpoint is authoritative during rollback or legacy-writer races. Legacy flat drafts remain readable for the cache-upgrade window and are migrated once, while an older worker's later overwrite is retained for recovery and cannot displace an acknowledged V2 value. Destructive program changes use a provisional `_storageDraftTransaction` marker plus queued `repforge_draft_v1:pending:` writes and short-lived `repforge_draft_v1:closing:` ownership markers, so a newer draft either survives with the old program or the exact captured draft is cleared/replaced atomically. The un-suffixed `repforge_pending_v1` key is read only for legacy-journal migration.

A device that has not been through onboarding holds no program. First-run state is `program: []` with `programMeta.onboarded === false`; there is no bundled starter split, and nothing may mint one behind the lifter's back. The entry hub is the only thing that creates a program, and until it does, Today and the Program tab render their no-program state (`#todayNoProgram` / `#programNoProgram`) and offer setup instead of a session — cancelling out of onboarding is exactly this state, not a fallback program. Both surfaces gate on `hasProgramContent()` — is there a program at all — which is deliberately blind to `programMeta.onboarded`, because a restored backup or migrated legacy snapshot can carry a real program with the flag unset and must not be hidden behind "No program yet". The Program tab additionally requires the device to be un-onboarded before it shows the invitation, so a lifter who emptied their own program keeps the editor and its Add day. `hasActiveProgram()` stays the separate question of whether the entry hub is replacing something. Browser tests wait on `window.__repforgeBooted` (set at the end of `init()`), never on a day tab, which such a device never grows.

A setup link is a coach-created URL fragment (`index.html#setup=v1.<base64url-gzip>`, `v2.<base64url-gzip>`, or `v3.<base64url-gzip>`), not a backend upload. The semantic document stays kind `taurifer-shared-setup` / version 1. `v1.` is canonical JSON+gzip; `v2.` is an immutable compact tuple JSON+gzip; `v3.` is the compact tuple extension that also carries the versioned progression envelope (program relations, modifiers, structure, and per-exercise progression/slot identity — `v2.` is skipped for such payloads). Decode v1, v2, and v3 forever. New encoding emits the shortest valid candidate (ties keep `v1.`). Its first-run gate is the confirmation surface: persist no payload field until **Start this program**, and never apply one when a program is onboarded or any workout log/program history exists. Received exercise IDs must be current built-ins or custom definitions carried in that payload; do not fuzzy-match or accept legacy aliases. The encoded value has a hard 3,072-character limit; a representative complete URL is a ≤700-character regression target, not a universal maximum, and notes-heavy payloads must never be truncated. A temporary `repforge_setup_v1` cookie (historical name, even for `v2.`/`v3.` values; the `index.html` path, seven days, `SameSite=Lax`, and `Secure` outside localhost) carries the encoded—not encrypted—proposal into iOS/iPadOS 17.2+ Home Screen installs and is sent with that matching HTML request. Outbound system share is title plus URL only; the Share sheet stays task-only and the privacy/cookie disclosure lives on the cached in-app Privacy page, never in the outbound message. Never log the payload, cookie, or full URL, and do not claim older Home Screen installs inherit it or that physical iOS validation was done. See `docs/adr/0007-shared-setup-links.md`.

The import route has two doors. One reads a Taurifer program file; the other
takes a free-form program pasted as text — a coach's message, a note — and
hands it to the lifter's own ChatGPT or Claude for conversion through a link
they tap. This is a hand-off, not an integration: no key, no account, no
request made by the app, and nothing leaves the device until a link is tapped.
The pasted program and the reply are never exported, put in a state proposal,
or logged. They are held for the length of the flow in tab-scoped
`sessionStorage` (`repforge_freeform_session_v1`, carrying source, reply, stage
and last provider), so a phone that evicts the tab during the hand-off does not
lose a coach's message, and they are cleared at all five exits: transition to
review, cancel, start over, switching to the file door, and activation. Which
door a staged import came through rides the same tab scope
(`repforge_import_source_v1`) from the review commit to the activation a screen
later, because `importDraft` is already null by then; it holds only
`freeform` or `file`. Which door was last used is remembered across tabs, in the
device-only UI prefs (`repforge_ui_v1`, key `importSourceMode`). The prompt is a reviewed i18n
string (`entry.freeform.prompt`), not assembled in code, and the reply is
validated and reviewed exactly like a file before anything is written. It does
not pull an LLM dependency into Free or core and does not front-run ADR 0011.
See `docs/adr/0014-free-form-program-import-handoff.md`.

## Product strategy

`docs/business-product-thesis.md` is the strategic source of truth for market, business model, Free/Pro boundaries, validation sequencing, creator distribution, data principles, and the eventual native direction. `docs/backlog.md` is the only ordered product and engineering queue. `docs/adr/0010-product-business-thesis-and-validation-sequencing.md` records the governing decisions. The completed owner grilling session through Q602 is preserved in `docs/product-grilling-decision-register.md` and has been reconciled into the thesis, backlog, ADR 0010, and Plan 044. Managed Taurifer AI is governed by `docs/adr/0011-managed-taurifer-ai.md`; `docs/adr/0002-byok-ai-coach.md` and Plan 038 are superseded and must not be executed. Precedence: this file governs how the repository works today; the strategy documents govern why we are building and what strategic direction is authorized. The current repository architecture remains the Phase 1 static PWA until the evidence gates described there justify native commercialization. Do not implement Phase 2 platform hardening on the strength of the thesis alone: no native shells, no package managers at the root, and no production platform/backend architecture (an account platform, production cloud sync, hosted workout-history storage, a production subscription backend, hosted creator publishing, a generalized API layer). Minimal infrastructure whose direct purpose is validating an approved Phase 1 hypothesis is allowed — e.g. a telemetry collector, attribution endpoint, lightweight checkout integration, payment webhook, small entitlement service, or experiment assignment/config — only where the canonical backlog authorizes it. Treat the thesis's quantitative figures as hypotheses to test, not requirements.

## Cursor Cloud specific instructions

- The application has no dependencies to install and no application build/lint/test tooling. Do not look for a root `package.json`, an application test runner, or a bundler — none exist.
- Browser suites are separate: they use pinned test-only npm dependencies under `test/` (Playwright, fast-check). In a fresh checkout run `(cd test && npm ci && npx playwright install chromium --with-deps)` before a browser gate. Do not add root or application dependencies, and do not use npm to run the app.
- **Agent verification loop:** During correction, run the exact owning suite, or `node tools/run-tests.mjs edit` when ownership is unclear. After a coherent commit, run `node tools/run-tests.mjs packet --base <packet-start-sha>`. At handoff, establish a clean candidate SHA and dispatch candidate CI for that exact SHA once; source changes create a new candidate. Do **not** run the exhaustive local `candidate` mode as routine handoff evidence—the remote exact-SHA candidate is the completion boundary and runs its lanes in parallel. Use a local candidate only to diagnose CI/selector tooling itself or when a concrete failure cannot be reproduced narrowly. `edit` is feedback, not completion evidence; `branch` (the old `affected` semantics) is diagnostic. Focus an exact failure with `--suite-id` and use runner `--evidence /tmp/proof.json` on a clean commit when provenance is required. Do not retry a failed Actions run to seek green; diagnostic replay never changes red to green. Inspect retained logs/traces. Do not poll Actions repeatedly while useful independent work remains. See `docs/ci.md` and `test/AGENTS.md`.
- **Test-authoring policy:** Product behavior is proved at the highest realistic boundary, normally the production-backed browser journey. Never write a unit/isolated test after implementing the code it tests. If isolation is genuinely required, first enumerate the concrete failure modes the browser suite cannot reasonably or deterministically exercise, then write the failing proof before the implementation. Good isolation targets include serialization/canonicalization, migrations, algorithms with combinatorial boundaries, protocol fault injection, races, and durable-state recovery. Do not freeze private helper names, source strings, CSS declaration order, or completed-plan implementation shape as product tests. A historical test has no retention privilege: keep it only while it catches a plausible production bug not already caught by stronger evidence. Substantive E2E runs must leave repeatable evidence under `.ci-results/` or through `--evidence`, tied to the command/fixture/seed and source SHA. `tools/run-tests.mjs` automatically writes per-browser-suite `evidence.json` with source identity, exact command, outcome, duration, output digest, and rerun command; contract-specific screenshots/traces/state/network artifacts belong beside it via `REPFORGE_ARTIFACT_DIR`.
- Regenerating a vendored runtime needs `(cd tools/vendor-runtimes && npm ci)` first. Those are build-time dependencies for `tools/build-vendor-runtimes.mjs` only — the app ships the committed bundles and still resolves nothing at runtime. Verifying them (`--check`) needs neither network nor `node_modules`.
- Generative property suite (`test/generative/`, fast-check, pure Node — no browser or server): run `node test/generative/run.mjs` (profiles `smoke` default, `ci`, `deep`, `campaign`; `--seed`/`--filter` for replay). It tests `shared-setup.js`/`exercises.js` through `generative/adapters/domain-adapter.mjs` and must not scrape app.js internals; see `test/generative/README.md` for the invariant catalogue and the Phase 2+ state-machine roadmap.
- Browser gates run through `tools/run-tests.mjs`, which owns an isolated loopback preview on a fresh port when `REPFORGE_URL` is unset and passes that exact origin to every selected browser suite. If `REPFORGE_URL` names a local server, the runner first proves that server is rooted at the current worktree with a transient identity marker; a stale Taurifer server from another worktree is rejected even if its shell boots. Browser suites must use `REPFORGE_URL` (canonical standalone fallback `http://localhost:8000/`) and must not start private fixed-port static servers. Manual development may still use `python3 -m http.server <port> --directory <absolute-worktree>`, but set `REPFORGE_URL` when using it for test evidence.
- Service worker caching gotcha: `sw.js` uses a `repforge-vNN` cache name (the prefix is a codename and does not follow the brand). Read the live `CACHE` revision in `sw.js` and treat `ASSETS` and `SHELL` as the canonical cache inventory. Bump `CACHE` when a cached file changes. Use the live `transitionAssets` inventory in `test/exercise-library.mjs`; keep every listed script's `index.html` URL, `sw.js` precache URL, and the test's expected revision aligned. The two vendored runtimes under `vendor/` are precached unrevisioned; separate content hashes pin them. These revisions stop an older controlling worker from combining schema-incompatible state and interaction modules on the first updated navigation. Before removing or renaming boot-bound shell IDs or globals, inspect retained historical-app fixtures; start with `rg "OLD_APP_SHA" test`. Those fixtures may run older scripts against current HTML. Run the affected compatibility proof with the removal. A cache revision bump alone does not establish compatibility, and historical fixtures do not imply permanent support for every retired element. Keep any required compatibility element hidden, non-interactive, and absent from the accessibility tree. After editing cached files, hard-reload or clear/unregister the service worker to see changes.
- To reset training state manually, use **Settings → Delete workout history**. For a fresh-device test, clear all site storage, including device UI preferences; deleting workout history is not a full device reset.
- Core flow to smoke-test: on the **Log** tab fill a set's kg/reps/RIR and click **Save workout**, then confirm the session summary opens over the app, and that the **Stats** and **History** tabs populate with the saved session once it is dismissed.
- **UI screen catalog (keep in sync):** `docs/ui-screens/screens/` is the mobile phone-frame reference. For a user-visible change, run `node tools/capture-ui-screens.mjs --affected --accept-visual-change` and review/commit the updated PNGs; use unfiltered capture for shared/global changes or new screens. Leave `REPFORGE_URL` unset in normal automated test and capture runs; both tools own an isolated worktree preview. Screens, variants and paths are declared in `docs/ui-screens/manifest.json`; a new screen needs a manifest entry and scenario. CI compares fresh captures against the committed pixels and semantics. PR feedback/candidate runs use the reviewed affected-screen selector and widen to full on unknown/global ownership; pushes to `main` retain the full catalog sweep. Do not hand-edit PNGs.

### Vendored runtimes

The app loads exactly two third-party runtimes, and neither is a dependency in
the package-manager sense: `vendor/motion/motion.js` (Motion, animation and
gesture physics) and `vendor/dnd-kit/dnd-kit.js` (@dnd-kit/dom, the program
editor's reordering). Both are bundled offline from `tools/vendor-runtimes/`
by `node tools/build-vendor-runtimes.mjs`, tree-shaken to the exports named in
that directory's entry files, committed, pinned by version and content hash
beside each bundle, and precached by the service worker. The browser resolves no
package and reaches no CDN, so the app behaves identically offline. `--check`
re-hashes the committed bundles with no network and no `node_modules`; CI runs
it, so hand-editing vendored code fails the build.

Application code never touches `window.Motion`. Everything animated through
Motion goes via `motion-layer.js`, which owns the motion vocabulary, the single
reduced-motion decision, and the fallback for a runtime that failed to load.

Boot mounts one sheet/Focus gesture controller through
`RepForgeMotion.mountGestureController()` and keeps its disposal handle in
`window.__repforgeGestureHandle`. The layer selects Motion or delegates to
`mountFallbackGestures()`; if the layer itself is absent, boot mounts that
fallback directly. Each owner binds and removes its own listeners. Mounting is
idempotent, and disposal cancels navigation, releases drag state, and permits a
fresh mount. Route deck navigation through the handle rather than replacing a
global callback. `test/focus-geometry.mjs` proves cancellation/disposal with
Motion, without Motion, and without the layer; `test/motion-integration.mjs`
guards the live gesture path.
@dnd-kit is reached only from `program-editor.js`. Both runtimes are optional by
construction: without Motion every caller keeps its stylesheet path; without
@dnd-kit the editor still mounts and reordering stays reachable through each
row's Move controls. What is animated where, and why each interaction was or was
not migrated, is recorded in `docs/design/interaction-runtime-audit.md` — read it
before adding, removing or re-tuning motion.

Widening either entry file grows a payload every lifter downloads before their
first set. Do it deliberately, and record why in the audit.

### Generated files

`i18n.js` and `exercises.js` are generated and committed; nothing regenerates
them at serve or install time. `i18n.js` comes from `i18n-en.json` +
`i18n-pt.json` via `node tools/build-i18n.mjs` (`--check` fails when the three
files drift). `exercises.js` comes from `tools/build-exercises.mjs` plus the
reviewed allowlist in `tools/exercise-curation.json` — edit those and re-run,
never the generated file. See `tools/README.md`; note that library ids are
stored in saved programs as `libraryId` and must never be repointed at a
different movement.

`assets/exercises/` holds the 96 licensed exercise illustrations, keyed by
library id. That set is closed: the other 174 movements, built-in or custom,
render a deliberately empty tile. Do not add exercise media without a licence
covering it, and do not fill the empty state with icons, initials or silhouettes
— `test/exercise-library.mjs` and `test/library-flow.mjs` both hold that line.
The allowlist lives in `MEDIA_IDS` in `tools/build-exercises.mjs`; adding a file
without listing it there (or the reverse) fails the build and the gates. Each
mapped entry also carries `mediaBg`, the paper colour that drawing sits on, read
from `tools/exercise-media-bg.json` and regenerated by
`node tools/sample-media-bg.mjs` — the one tool that needs the pinned test
browser, because the files are lossy VP8 and Node has no decoder.

## Implementation and review evidence

For UI-overhaul implementation or review, durable-schema changes, and new
completion checkers, read `docs/agents/implementation-evidence.md` before
substantive work. It governs acceptance evidence, first-contract proof,
correction review, and completion claims. For Plans 049–059, also read the
matching checkpoint in `docs/agents/ui-overhaul-proof-checkpoints.md`.

## Agent skills

Matt Pocock's engineering skills are installed under `.agents/skills/` (see `skills-lock.json`). The configuration below tells those skills where this repo tracks work, which triage labels it uses, and how its domain docs are laid out.

### Issue tracker

Issues and specs live as GitHub issues in `pedrochagasmaster/repforge` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by the skills as terms and decisions get resolved). See `docs/agents/domain.md`.
