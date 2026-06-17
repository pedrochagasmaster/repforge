# RepForge

RepForge is a local-only mobile PWA for tracking progressive overload. It is a static site (`index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/`) with no build step, no package manager, and no dependencies. All training data lives in the browser via `localStorage`; nothing is sent to a backend.

## Cursor Cloud specific instructions

- There are no dependencies to install and no build/lint/test tooling in this repo. Do not look for `package.json`, a test runner, or a bundler — none exist.
- Run the app in development by serving the repo root over HTTP (a static server is required because of the service worker and `fetch` of `manifest`/assets). The README documents `python3 -m http.server 8000`, then open `http://localhost:8000/`. Python 3 is available on the VM.
- Service worker caching gotcha: `sw.js` caches the core assets (`./`, `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `icons/icon.svg`). After editing those files, a normal reload may serve stale cached copies. Hard-reload (or unregister the service worker / clear site data via DevTools → Application) to see changes.
- App data persists per-browser under the `localStorage` key `repforge_v1` (and an in-progress draft under `repforge_draft_v1`). To reset state for a clean test, clear site storage or use **Settings → Delete log**.
- Core flow to smoke-test: on the **Log** tab fill a set's kg/reps/RIR and click **Save workout**, then confirm the **Stats** and **History** tabs populate with the saved session.
