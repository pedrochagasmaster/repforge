# RepForge

RepForge is a local-only mobile PWA for tracking progressive overload. It is a static site (`index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/`) with no build step, no package manager, and no dependencies. All training data lives in the browser via `localStorage`; nothing is sent to a backend.

## Cursor Cloud specific instructions

- There are no dependencies to install and no build/lint/test tooling in this repo. Do not look for `package.json`, a test runner, or a bundler — none exist.
- Run the app in development by serving the repo root over HTTP (a static server is required because of the service worker and `fetch` of `manifest`/assets). The README documents `python3 -m http.server 8000`, then open `http://localhost:8000/`. Python 3 is available on the VM.
- Service worker caching gotcha: `sw.js` caches the core assets (`./`, `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `icons/icon.svg`). After editing those files, a normal reload may serve stale cached copies. Hard-reload (or unregister the service worker / clear site data via DevTools → Application) to see changes.
- App data persists per-browser under the `localStorage` key `repforge_v1` (and an in-progress draft under `repforge_draft_v1`). To reset state for a clean test, clear site storage or use **Settings → Delete log**.
- Core flow to smoke-test: on the **Log** tab fill a set's kg/reps/RIR and click **Save workout**, then confirm the **Stats** and **History** tabs populate with the saved session.

## Agent skills

Matt Pocock's engineering skills are installed under `.agents/skills/` (see `skills-lock.json`). The configuration below tells those skills where this repo tracks work, which triage labels it uses, and how its domain docs are laid out.

### Issue tracker

Issues and PRDs live as GitHub issues in `pedrochagasmaster/repforge` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by the skills as terms and decisions get resolved). See `docs/agents/domain.md`.
