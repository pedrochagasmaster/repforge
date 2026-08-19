# Taurifer

Taurifer (formerly RepForge) is a local-first mobile PWA for tracking progressive overload. It is a static site (`index.html`, `styles.css`, `app.js`, `shared-setup.js`, `schedule.js`, `notify.js`, `i18n.js`, `exercises.js`, `sw.js`, `manifest.webmanifest`, `icons/`, `assets/exercises/`) with no build step, no package manager, and no application dependencies. Workout logs, drafts, and history stay on this device and Taurifer never uploads them. Setup links intentionally share a program, its configuration, eight allowlisted settings, and language; their temporary iOS handoff cookie is sent to the static host.

Only the user-facing brand is Taurifer. Internal identifiers deliberately keep the historical `repforge` codename so existing installs keep their data and scope: storage keys and the `repforge_setup_v1` handoff cookie, the IndexedDB name, the cache-name prefix, the cross-tab lock name, `window.__repforge*` test hooks, the `RepForgeI18n`/`RepForgeSchedule`/`RepForgeNotify`/`RepForgeSharedSetup` globals, the repository slug, and the GitHub Pages URL. Do not rename these. The full naming-surface inventory, plus voice, copy, and visual rules, lives in `docs/brand-guide.md` (rationale in `docs/adr/0004-taurifer-rebrand-neutral-copy.md`).

Durable state is mirrored in `localStorage` (`repforge_v1`) and IndexedDB (`repforge` / `kv`). An in-progress workout draft lives in `localStorage` only (`repforge_draft_v1`). While state writes wait on the cross-tab lock, immutable unversioned write-ahead entries under the `repforge_pending_v1:` key prefix preserve their order for boot-time replay without claiming durable revisions. Destructive program changes use a provisional `_storageDraftTransaction` marker plus queued `repforge_draft_v1:pending:` writes and short-lived `repforge_draft_v1:closing:` ownership markers, so a newer draft either survives with the old program or the exact captured draft is cleared/replaced atomically. The un-suffixed `repforge_pending_v1` key is read only for legacy-journal migration.

A setup link is a coach-created URL fragment (`index.html#setup=v1.<base64url-gzip>`), not a backend upload. Its first-run gate is the confirmation surface: persist no payload field until **Start this program**, and never apply one when a program is onboarded or any workout log/program history exists. Received v1 exercise IDs must be current built-ins or custom definitions carried in that payload; do not fuzzy-match or accept legacy aliases. The full encoded value is limited to 3,072 characters. A temporary `repforge_setup_v1` cookie (the `index.html` path, seven days, `SameSite=Lax`, and `Secure` outside localhost) carries the encoded—not encrypted—proposal into iOS/iPadOS 17.2+ Home Screen installs and is sent with that matching HTML request. Never log the payload, cookie, or full URL, and do not claim older Home Screen installs inherit it. See `docs/adr/0007-shared-setup-links.md`.

## Cursor Cloud specific instructions

- The application has no dependencies to install and no application build/lint/test tooling. Do not look for a root `package.json`, an application test runner, or a bundler — none exist.
- Browser suites are separate: they use pinned test-only npm dependencies under `test/` (Playwright). In a fresh checkout run `(cd test && npm ci && npx playwright install chromium --with-deps)` before a browser gate. Do not add root or application dependencies, and do not use npm to run the app.
- Run the app in development by serving the repo root over HTTP (a static server is required because of the service worker and `fetch` of `manifest`/assets). The README documents `python3 -m http.server 8000`, then open `http://localhost:8000/`. Python 3 is available on the VM.
- Service worker caching gotcha: `sw.js` uses a `repforge-vNN` cache name (v102 today; the prefix is a codename and does not follow the brand). `ASSETS` is `./`, `index.html`, `styles.css`, `manifest.webmanifest`, `schedule.js`, `notify.js`, `i18n.js`, `exercises.js`, `shared-setup.js`, `app.js`, the icon SVG/PNGs, the two brand files (`assets/brand/mark.png`, the ground-free mark the first-run gate draws, and `assets/brand/milo-hero.webp`, its ethos hero illustration), the 96 `assets/exercises/*.webp` illustrations (~3.2 MB, precached atomically by `addAll`), and the Plex font woff2 files. `SHELL` is `/`, `/index.html`, `/app.js`, `/styles.css`, `/i18n.js`, `/exercises.js`, `/shared-setup.js`, `/manifest.webmanifest`. Bump `CACHE` when any of them changes. After editing those files, a normal reload may serve stale cached copies. Hard-reload (or unregister the service worker / clear site data via DevTools → Application) to see changes.
- To reset state for a clean test, clear site storage or use **Settings → Delete workout history**.
- Core flow to smoke-test: on the **Log** tab fill a set's kg/reps/RIR and click **Save workout**, then confirm the session summary opens over the app, and that the **Stats** and **History** tabs populate with the saved session once it is dismissed.

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

Issues and PRDs live as GitHub issues in `pedrochagasmaster/repforge` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by the skills as terms and decisions get resolved). See `docs/agents/domain.md`.
