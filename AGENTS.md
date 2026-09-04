# Taurifer

Taurifer (formerly RepForge) is a local-first mobile PWA for tracking progressive overload. It is a static site (`index.html`, `styles.css`, `app.js`, `shared-setup.js`, `schedule.js`, `notify.js`, `i18n.js`, `exercises.js`, `sw.js`, `manifest.webmanifest`, `icons/`, `assets/exercises/`) with no build step, no package manager, and no application dependencies. Workout logs, drafts, and history stay on this device and Taurifer never uploads them except through the explicit one-hour install-transfer exception (`docs/adr/0013-temporary-install-transfer.md`) or opted-in telemetry. Setup links intentionally share a program, its configuration, eight allowlisted settings, and language; their temporary iOS handoff cookie is sent to the static host. The install-transfer token cookie is a separate object from the setup-proposal cookie and never carries the clone.

Only the user-facing brand is Taurifer. Internal identifiers deliberately keep the historical `repforge` codename so existing installs keep their data and scope: storage keys and the `repforge_setup_v1` handoff cookie, the IndexedDB name, the cache-name prefix, the cross-tab lock name, `window.__repforge*` test hooks, the `RepForgeI18n`/`RepForgeSchedule`/`RepForgeNotify`/`RepForgeSharedSetup` globals, the repository slug, and the GitHub Pages URL. Do not rename these. The full naming-surface inventory, plus voice, copy, and visual rules, lives in `docs/brand-guide.md` (rationale in `docs/adr/0004-taurifer-rebrand-neutral-copy.md`).

Appearance (System/Light/Dark) is the one visible setting that is not a setting: it lives in the device-only UI prefs (`repforge_ui_v1`, key `theme`), so it never enters export/import, a state proposal, or the setup-link allowlist. `app.js` resolves it to `<html data-theme>`, an inline snippet in `index.html` replays it before the first paint, and `styles.css` reads nothing else — dark is a `:root[data-theme="dark"]` token swap, so a new rule must name tokens rather than colours. See `docs/adr/0009-appearance-setting-dark-theme.md`.

Durable state is mirrored in `localStorage` (`repforge_v1`) and IndexedDB (`repforge` / `kv`). An in-progress workout draft lives in `localStorage` only (`repforge_draft_v1`). While state writes wait on the cross-tab lock, immutable unversioned write-ahead entries under the `repforge_pending_v1:` key prefix preserve their order for boot-time replay without claiming durable revisions. Destructive program changes use a provisional `_storageDraftTransaction` marker plus queued `repforge_draft_v1:pending:` writes and short-lived `repforge_draft_v1:closing:` ownership markers, so a newer draft either survives with the old program or the exact captured draft is cleared/replaced atomically. The un-suffixed `repforge_pending_v1` key is read only for legacy-journal migration.

A device that has not been through onboarding holds no program. First-run state is `program: []` with `programMeta.onboarded === false`; there is no bundled starter split, and nothing may mint one behind the lifter's back. The entry hub is the only thing that creates a program, and until it does, Today and the Program tab render their no-program state (`#todayNoProgram` / `#programNoProgram`) and offer setup instead of a session — cancelling out of onboarding is exactly this state, not a fallback program. Both surfaces gate on `hasProgramContent()` — is there a program at all — which is deliberately blind to `programMeta.onboarded`, because a restored backup or migrated legacy snapshot can carry a real program with the flag unset and must not be hidden behind "No program yet". The Program tab additionally requires the device to be un-onboarded before it shows the invitation, so a lifter who emptied their own program keeps the editor and its Add day. `hasActiveProgram()` stays the separate question of whether the entry hub is replacing something. Browser tests wait on `window.__repforgeBooted` (set at the end of `init()`), never on a day tab, which such a device never grows.

A setup link is a coach-created URL fragment (`index.html#setup=v1.<base64url-gzip>` or `v2.<base64url-gzip>`), not a backend upload. The semantic document stays kind `taurifer-shared-setup` / version 1. `v1.` is canonical JSON+gzip; `v2.` is an immutable compact tuple JSON+gzip. Decode both forever. New encoding emits the shortest valid candidate (tie `v1.`). Its first-run gate is the confirmation surface: persist no payload field until **Start this program**, and never apply one when a program is onboarded or any workout log/program history exists. Received exercise IDs must be current built-ins or custom definitions carried in that payload; do not fuzzy-match or accept legacy aliases. The encoded value has a hard 3,072-character limit; a representative complete URL is a ≤700-character regression target, not a universal maximum, and notes-heavy payloads must never be truncated. A temporary `repforge_setup_v1` cookie (historical name, even for `v2.` values; the `index.html` path, seven days, `SameSite=Lax`, and `Secure` outside localhost) carries the encoded—not encrypted—proposal into iOS/iPadOS 17.2+ Home Screen installs and is sent with that matching HTML request. Outbound system share is title plus URL only; the privacy/cookie paragraph stays in the in-app sheet. Never log the payload, cookie, or full URL, and do not claim older Home Screen installs inherit it or that physical iOS validation was done. See `docs/adr/0007-shared-setup-links.md`.

## Product strategy

`docs/business-product-thesis.md` is the strategic source of truth for market, business model, Free/Pro boundaries, validation sequencing, creator distribution, data principles, and the eventual native direction. `docs/backlog.md` is the only ordered product and engineering queue. `docs/adr/0010-product-business-thesis-and-validation-sequencing.md` records the governing decisions. The completed owner grilling session through Q602 is preserved in `docs/product-grilling-decision-register.md` and has been reconciled into the thesis, backlog, ADR 0010, and Plan 044. Managed Taurifer AI is governed by `docs/adr/0011-managed-taurifer-ai.md`; `docs/adr/0002-byok-ai-coach.md` and Plan 038 are superseded and must not be executed. Precedence: this file governs how the repository works today; the strategy documents govern why we are building and what strategic direction is authorized. The current repository architecture remains the Phase 1 static PWA until the evidence gates described there justify native commercialization. Do not implement Phase 2 platform hardening on the strength of the thesis alone: no native shells, no package managers at the root, and no production platform/backend architecture (an account platform, production cloud sync, hosted workout-history storage, a production subscription backend, hosted creator publishing, a generalized API layer). Minimal infrastructure whose direct purpose is validating an approved Phase 1 hypothesis is allowed — e.g. a telemetry collector, attribution endpoint, lightweight checkout integration, payment webhook, small entitlement service, or experiment assignment/config — only where the canonical backlog authorizes it. Treat the thesis's quantitative figures as hypotheses to test, not requirements.

## Cursor Cloud specific instructions

- The application has no dependencies to install and no application build/lint/test tooling. Do not look for a root `package.json`, an application test runner, or a bundler — none exist.
- Browser suites are separate: they use pinned test-only npm dependencies under `test/` (Playwright, fast-check). In a fresh checkout run `(cd test && npm ci && npx playwright install chromium --with-deps)` before a browser gate. Do not add root or application dependencies, and do not use npm to run the app.
- Generative property suite (`test/generative/`, fast-check, pure Node — no browser or server): run `node test/generative/run.mjs` (profiles `smoke` default, `ci`, `deep`, `campaign`; `--seed`/`--filter` for replay). It tests `shared-setup.js`/`exercises.js` through `generative/adapters/domain-adapter.mjs` and must not scrape app.js internals; see `test/generative/README.md` for the invariant catalogue and the Phase 2+ state-machine roadmap.
- Run the app in development by serving the repo root over HTTP (a static server is required because of the service worker and `fetch` of `manifest`/assets). The README documents `python3 -m http.server 8000`, then open `http://localhost:8000/`. Python 3 is available on the VM. Browser gates boot-check via `waitForAppBoot` in `test/browser.mjs`: if a stale server rooted elsewhere holds the port, they fail within seconds naming the cause — kill the stale listener before blaming a test.
- Service worker caching gotcha: `sw.js` uses a `repforge-vNN` cache name (the prefix is a codename and does not follow the brand). Read the live `CACHE` revision in `sw.js` — never rely on a documented number — and treat `ASSETS` and `SHELL` in that file as the canonical cache inventory. Bump `CACHE` when a cached file changes. Move the matching `?v=NN` revisions for `program-compiler.js`, `program-entry.js`, `program-entry-adapter.js`, `shared-setup.js`, and `app.js` in both `index.html` and `ASSETS`; `test/exercise-library.mjs` holds the cache and those five script revisions in lockstep. These revisions stop an older controlling worker from combining schema-incompatible program-entry files or serving a v1-only shared-setup script on the first updated navigation. After editing cached files, a normal reload may serve stale copies. Hard-reload (or unregister the service worker / clear site data via DevTools → Application) to see changes.
- To reset state for a clean test, clear site storage or use **Settings → Delete workout history**.
- Core flow to smoke-test: on the **Log** tab fill a set's kg/reps/RIR and click **Save workout**, then confirm the session summary opens over the app, and that the **Stats** and **History** tabs populate with the saved session once it is dismissed.
- **UI screen catalog (keep in sync):** `docs/ui-screens/screens/` is the phone-frame reference for UI and Brand Designers, covering every primary surface plus every onboarding state route by route. It is **mobile only** — the manifest rejects a desktop viewport. Whenever a change alters a user-visible surface — layout, palette, copy on screen, sheets, onboarding, install UI, or a new view — regenerate with `node tools/capture-ui-screens.mjs` (app served on `REPFORGE_URL`, pinned Chromium under `test/`) and commit the updated PNGs with the UI change. Screens, variants and paths are declared once in `docs/ui-screens/manifest.json`; a new screen needs a manifest entry and a scenario in `tools/ui-screens/screens-*.mjs`. CI fails on drift (`tools/check-ui-screens.mjs` + `tools/compare-ui-screens.mjs` over the whole catalog), so a stale catalog blocks the build rather than passing quietly. Do not hand-edit the PNGs. The folder README lists every screen; `tools/README.md` documents the tooling.

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

## Agent skills

Matt Pocock's engineering skills are installed under `.agents/skills/` (see `skills-lock.json`). The configuration below tells those skills where this repo tracks work, which triage labels it uses, and how its domain docs are laid out.

### Issue tracker

Issues and specs live as GitHub issues in `pedrochagasmaster/repforge` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by the skills as terms and decisions get resolved). See `docs/agents/domain.md`.
