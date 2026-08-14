# RepForge

RepForge is a local-only mobile PWA for tracking progressive overload. It is a static site (`index.html`, `styles.css`, `app.js`, `schedule.js`, `notify.js`, `i18n.js`, `sw.js`, `manifest.webmanifest`, `icons/`) with no build step, no package manager, and no application dependencies. All training data stays on this device; nothing is sent to a backend.

Durable state is mirrored in `localStorage` (`repforge_v1`) and IndexedDB (`repforge` / `kv`). An in-progress workout draft lives in `localStorage` only (`repforge_draft_v1`). While state writes wait on the cross-tab lock, immutable unversioned write-ahead entries under the `repforge_pending_v1:` key prefix preserve their order for boot-time replay without claiming durable revisions. Destructive program changes use a provisional `_storageDraftTransaction` marker plus queued `repforge_draft_v1:pending:` writes and short-lived `repforge_draft_v1:closing:` ownership markers, so a newer draft either survives with the old program or the exact captured draft is cleared/replaced atomically. The un-suffixed `repforge_pending_v1` key is read only for legacy-journal migration.

## Cursor Cloud specific instructions

- The application has no dependencies to install and no application build/lint/test tooling. Do not look for a root `package.json`, an application test runner, or a bundler — none exist.
- Browser suites are separate: they use pinned test-only npm dependencies under `test/` (Playwright). In a fresh checkout run `(cd test && npm ci && npx playwright install chromium --with-deps)` before a browser gate. Do not add root or application dependencies, and do not use npm to run the app.
- Run the app in development by serving the repo root over HTTP (a static server is required because of the service worker and `fetch` of `manifest`/assets). The README documents `python3 -m http.server 8000`, then open `http://localhost:8000/`. Python 3 is available on the VM.
- Service worker caching gotcha: `sw.js` uses cache `repforge-v63`. `ASSETS` is `./`, `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `schedule.js`, `notify.js`, `i18n.js`, the icon SVG/PNGs, and the Plex font woff2 files. `SHELL` is `/`, `/index.html`, `/app.js`, `/styles.css`, `/i18n.js`, `/manifest.webmanifest`. After editing those files, a normal reload may serve stale cached copies. Hard-reload (or unregister the service worker / clear site data via DevTools → Application) to see changes.
- To reset state for a clean test, clear site storage or use **Settings → Delete workout history**.
- Core flow to smoke-test: on the **Log** tab fill a set's kg/reps/RIR and click **Save workout**, then confirm the **Stats** and **History** tabs populate with the saved session.

## Agent skills

Matt Pocock's engineering skills are installed under `.agents/skills/` (see `skills-lock.json`). The configuration below tells those skills where this repo tracks work, which triage labels it uses, and how its domain docs are laid out.

### Issue tracker

Issues and PRDs live as GitHub issues in `pedrochagasmaster/repforge` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by the skills as terms and decisions get resolved). See `docs/agents/domain.md`.
