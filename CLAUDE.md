# CLAUDE.md

Guidance for AI assistants working in this repository.

## Read these first

This file is a fast orientation. The authoritative, detailed guidance lives in:

- **`AGENTS.md`** — build-free architecture, storage-key inventory, the service-worker cache
  ritual, generated files, the UI screen catalog contract, product-strategy guardrails. Treat
  it as the source of truth; if this file and `AGENTS.md` disagree, `AGENTS.md` wins.
- **`CONTEXT.md`** — the domain glossary. Use its exact terms (program, exercise template,
  capacity, session, mesocycle, …) in code and copy. Words listed under *Avoid* are wrong.
- **`docs/adr/`** — one ADR per irreversible decision (rebrand, capacity currency, shared-setup
  links, appearance/dark theme, product thesis, managed AI, free-form import hand-off). Read the
  ones touching your area before editing. **ADR 0011 supersedes ADR 0002 and Plan 038** — the
  BYOK AI coach is dead; do not execute either. ADR 0012's paste-door hand-off is not an AI
  integration and does not front-run ADR 0011.
- **`docs/backlog.md`** — the repository's **only** ordered product and engineering queue,
  reconciled through Q602. Plans and specs say *how* a bounded piece of work is built; they do
  not create a second queue. If work isn't here, it isn't scheduled.
- **`docs/business-product-thesis.md`** + **`docs/product-grilling-decision-register.md`** —
  *why* we build and what is authorized. The grilling session is **complete (Q1–Q602) and
  already reconciled** into the thesis, backlog, ADR 0010, and Plan 044; the register is now an
  audit trail rather than an override layer.

## What this is

Taurifer (formerly RepForge) is a **local-first mobile PWA** for tracking progressive overload.
Static site, **no build step, no package manager, no application dependencies**. Workout data
never leaves the device; a "setup link" is the one intentional share (a program + allowlisted
settings + language, carried in the URL `#setup=` fragment).

Only the user-facing brand is "Taurifer". Internal identifiers keep the historical `repforge`
codename on purpose (storage keys, IndexedDB name, cache-name prefix, `window.__repforge*` test
hooks, `RepForge*` globals, repo slug, Pages URL). **Do not rename these** — existing installs
depend on them. Full inventory in `AGENTS.md` and `docs/brand-guide.md`.

## Repository layout

### Application (served as-is, no bundler)

| File | Role |
| --- | --- |
| `index.html` | App shell; inline pre-paint theme snippet; carries `?v=NN` revisions for `shared-setup.js` and `app.js` |
| `app.js` | ~566 KB single-file app: storage engine (localStorage `repforge_v1` + IndexedDB `repforge`/`kv`), cross-tab lock, write-ahead journal, rendering, progression engine, all UI |
| `styles.css` | All styles; dark is a `:root[data-theme="dark"]` token swap — new rules must name tokens, not colours |
| `shared-setup.js` | Setup-link codec (`v1.` canonical + `v2.` compact envelopes; both decode forever) |
| `exercises.js` | **Generated** exercise library (270 movements EN/PT) — never hand-edit |
| `i18n.js` / `i18n-en.json` / `i18n-pt.json` | `i18n.js` is **generated** from the two JSON catalogs |
| `schedule.js`, `notify.js` | Rest-timer scheduling and notification helpers (`RepForgeSchedule` / `RepForgeNotify`) |
| `shared-setup.js` globals | `RepForgeSharedSetup`; `i18n.js` exposes `RepForgeI18n` |
| `sw.js` | Service worker; `repforge-vNN` cache name (`repforge-v112` today; `?v=112` revisions), atomic `addAll` precache |
| `manifest.webmanifest`, `icons/`, `fonts/`, `assets/` | PWA manifest, icons, Plex woff2, brand + 96 licensed exercise `.webp` illustrations |
| `posthog-init.js` | Reads `window.__POSTHOG_CONFIG__` and loads the PostHog SDK via the managed reverse proxy; no-ops when unconfigured |

### Tooling and tests

| Path | Role |
| --- | --- |
| `tools/*.mjs` | Offline generators (never run in the browser): `build-i18n.mjs`, `build-exercises.mjs`, `capture-ui-screens.mjs`, `sample-media-bg.mjs`, `build-brand-mark.mjs`. See `tools/README.md`. |
| `tools/exercise-curation.json` | The reviewed allowlist feeding `build-exercises.mjs` |
| `scripts/generate-posthog-config.mjs` | Cloudflare Pages build step: writes `posthog-config.js` and injects its `<script>` tag into `index.html` |
| `test/*.mjs` | Playwright browser suites + pure-Node unit suites; pinned deps under `test/` only |
| `test/generative/` | fast-check property / model-based suite (pure Node, no browser) |
| `test/browser.mjs` | Shared Chromium launcher + `assertServingApp` / `waitForAppBoot` boot check |
| `.github/workflows/simulation.yml` | The CI gate — the canonical ordered list of every test that must pass |

### Docs and process

| Path | Role |
| --- | --- |
| `docs/backlog.md` | The single canonical ordered queue (Now / Next / Gated / Later / Evidence only) |
| `docs/adr/` | Architecture decision records |
| `docs/ui-screens/screens/` | Mobile phone-frame catalog (66 screens incl. every onboarding state) — the visual source of truth, regenerated on every user-visible change; declared in `docs/ui-screens/manifest.json` |
| `docs/agents/` | Issue tracker = GitHub issues in `pedrochagasmaster/repforge` via `gh`; triage label map; domain-doc layout |
| `docs/design/`, `docs/brand-guide.md` | Design specs and brand voice/visual rules |
| `plans/NNN-*.md` | Bounded implementation/audit plans — **not a roadmap**. Most are already implemented and kept as design/regression history; their file/line anchors describe the commit they were written at. Check drift and current governing decisions before executing an old one. State table in `plans/README.md`; Plan 044 is the active contract. |
| `docs/superpowers/{plans,specs}/` | Dated long-form design specs |
| `.agents/skills/` | Installed Matt Pocock engineering skills (`skills-lock.json`); config in `AGENTS.md` |
| `style-bench/` | **Untracked** (in `.git/info/exclude`) — a separate Python style-transfer benchmark harness, not part of the app. Leave it alone unless asked. |

## Development

No install for the app itself. Serve the repo root over HTTP (the service worker and
`manifest`/asset `fetch`es need a real origin — `file://` will not work):

```bash
python3 -m http.server 8000    # then open http://localhost:8000/
```

After editing cached files a normal reload may serve stale copies. Hard-reload, or
unregister the service worker / clear site data via DevTools → Application.

Reset state for a clean test: clear site storage, or **Settings → Delete workout history**.

Core smoke flow: on the **Log** tab fill a set's kg/reps/RIR → **Save workout** → the session
summary opens → dismiss it → **Stats** and **History** tabs show the saved session.

## Testing

Browser suites use pinned, test-only dependencies. In a fresh checkout:

```bash
(cd test && npm ci && npx playwright install chromium --with-deps)
```

Then, with a static server running, run the individual suites. `.github/workflows/simulation.yml`
is the authoritative list and order. Key entry points:

```bash
# Pure Node, no browser / no server
node test/generative/run.mjs                 # profiles: smoke (default), ci, deep, campaign
node test/generative/run.mjs --seed <s> --filter <name>   # replay
node test/schedule.mjs
node test/i18n.mjs                            # EN/PT key + placeholder parity
node test/exercise-library.mjs               # library integrity + cache-revision lockstep

# Browser suites (need: python3 -m http.server 8000, and REPFORGE_URL set)
REPFORGE_URL=http://localhost:8000/ node test/persistence.mjs
REPFORGE_URL=http://localhost:8000/ node test/simulation.mjs   # 52-week engine simulation
# …and the rest listed in simulation.yml (appearance, accessibility, focus-mode,
#   session-summary, install-modes, shared-setup-flow, draft-transaction guards, …)
```

Syntax gate CI runs: `node --check` over `app.js i18n.js notify.js schedule.js sw.js test/*.mjs
test/generative/*/*.mjs`.

`test/generative/` must exercise `shared-setup.js` / `exercises.js` through
`generative/adapters/domain-adapter.mjs` — do not scrape `app.js` internals. See
`test/generative/README.md`.

## Conventions and rituals

- **Generated files** — `i18n.js` and `exercises.js` are committed but generated. Edit the
  source (`i18n-*.json`, `tools/exercise-curation.json`) and re-run the tool; `--check` flags
  drift. Library `id`s are stored in saved programs as `libraryId` — **never repoint an id at a
  different movement**; merges go through `LEGACY_LIBRARY_IDS`.
- **Service-worker cache** — when any precached asset changes, bump `CACHE` (`repforge-vNN`) in
  `sw.js` *and* move the `?v=NN` revisions for `shared-setup.js` and `app.js` in both
  `index.html` and `sw.js` `ASSETS`. `test/exercise-library.mjs` holds those three numbers in
  lockstep.
- **UI screen catalog** — any change to a user-visible surface (layout, palette, on-screen copy,
  sheets, first-run, install UI, new view) must be followed by
  `node tools/capture-ui-screens.mjs` (app served on `REPFORGE_URL`), committing the refreshed
  PNGs with the change. Screens and variants are declared in `docs/ui-screens/manifest.json`;
  the catalog is mobile-only, and CI fails on drift across the whole tree. Never hand-edit the PNGs.
- **Exercise illustrations** — the 96 `.webp` set is closed. The other 174 movements render a
  deliberately empty tile; do not fill it with icons/initials/silhouettes. `MEDIA_IDS` in
  `tools/build-exercises.mjs` is the allowlist; a file without a listing (or vice versa) fails
  the build.
- **Appearance / dark theme** — lives in device-only UI prefs (`repforge_ui_v1`, key `theme`);
  never enters export/import, a state proposal, or the setup-link allowlist. See ADR 0009.
- **No program before onboarding** — first-run state is `program: []` / `onboarded:false`. There is
  no bundled starter split; Today and Program render their no-program state and point at the entry
  hub, which is what backing out of onboarding leaves behind. See `AGENTS.md`.
- **Setup links** — the first-run gate is the confirmation surface: persist nothing until
  **Start this program**, and never apply a payload when a program is onboarded or any
  log/history exists. Never log the payload, cookie, or full URL. 3,072-char hard cap;
  notes-heavy payloads are never truncated. See ADR 0007.
- **Muscle tokens** are a contract shared by the volume audit, `exercises.js`, and both i18n
  catalogs — a new token needs a deliberate addition in all three; a typo silently splits a row.
- **Domain language** — follow `CONTEXT.md`. Say "session" not "workout" in domain code,
  "program" not "routine/plan/template", "capacity" not "e1RM/true max". The AI vocabulary was
  renamed: it is **Taurifer AI** / **AI request context** / **AI proposal** — never "coach",
  "chatbot", "BYOK assistant", or the retired "coach context" / "session review".

## Product-strategy guardrails

The repo stays a **Phase 1 static PWA**. Do **not** add: native shells, a root `package.json` or
package manager, or production platform/backend architecture (accounts, cloud sync, hosted
history, subscription backend, hosted creator publishing, a general API layer). Minimal
infrastructure directly validating an *approved* Phase 1 hypothesis (telemetry collector,
attribution endpoint, lightweight checkout, entitlement service, experiment config) is allowed
**only where `docs/backlog.md` authorizes it**. Treat the thesis's quantitative figures as
hypotheses, not requirements. Managed Taurifer AI (ADR 0011) is sequenced *after* deterministic
paid-beta economics — it pulls no accounts, cloud infra, or LLM dependency into Free/core.

## Analytics / deployment

- App is hostable on **GitHub Pages** (`main` / `/root`) at
  `https://pedrochagasmaster.github.io/repforge/`. Production analytics builds run on
  **Cloudflare Pages**, which runs `scripts/generate-posthog-config.mjs` to produce the
  gitignored `posthog-config.js` and inject its tag. Env: `POSTHOG_PROJECT_TOKEN`,
  `POSTHOG_HOST` (default `https://e.taurifer.com`), `POSTHOG_ENABLE_PREVIEWS`. See
  `.env.example`; analytics stays off locally and on previews unless explicitly enabled.

## Issue tracker

Issues and specs are **GitHub issues** in `pedrochagasmaster/repforge`, managed with the `gh`
CLI. Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`. External PRs are not a triage surface. See `docs/agents/`.
