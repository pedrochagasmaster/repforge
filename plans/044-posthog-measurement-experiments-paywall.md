# Plan 044: PostHog measurement, experiments, and the experimental Pro paywall

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 231ec54..HEAD -- app.js index.html styles.css sw.js test/exercise-library.mjs i18n-en.json i18n-pt.json tools/capture-ui-screens.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 (thesis §22 validation backlog items A, C, and part of B/D)
- **Effort**: L (multi-commit; each step below is one reviewable commit)
- **Risk**: MED-HIGH (third-party SDK on the gym floor, privacy discipline is
  constitutional, paywall touches the block-review and onboarding flows)
- **Depends on**: PR #174 (`docs/business-product-thesis.md` v1.1 +
  `docs/adr/0010-product-business-thesis-and-validation-sequencing.md`) —
  this plan implements that ADR's P0 backlog and cites its rules
- **Category**: measurement / monetization
- **Planned at**: commit `231ec54`, 2026-08-22

## Product decisions (locked, owner session 2026-08-22)

1. **PostHog is the analytics engine.** PostHog Cloud (US region), the
   official browser snippet plus `posthog-js`. No self-hosted analytics, no
   custom collector.
2. **Full PostHog usage is authorized for the pre-native era**: explicit
   schema-driven events (the measurement source of truth), autocapture,
   **session replay**, heatmaps, feature flags, experiments, surveys, web
   analytics, console-log capture, and exception capture. Nothing is off the
   table as a *product*; the constraints below are about *payload content*.
3. **The constitutional boundary stands** (thesis §15.4, constitution plank
   30, ADR 0010): analytics must never reconstruct the training record.
   Enforced mechanically, not by convention: default-deny replay text
   masking with explicit chrome unmasking, autocapture text masking, a
   strict per-event property allowlist in `before_send`, and a global
   setup-fragment scrub. Loads, reps, RIR, bodyweight, workout notes,
   custom/free-text exercise names, and program payloads never reach
   PostHog — not as event properties, not as replay text, not as element
   text.
4. **The URL fragment is never captured anywhere.** `AGENTS.md` setup-link
   law: never log the payload or full URL. `#setup=` payloads must be
   stripped from `$current_url`, replay page URLs, and every string
   property.
5. **Telemetry defaults ON for pilot builds**, with plain-language
   disclosure and a working off switch in Settings (PostHog opt-out API,
   state persisted by the SDK). Pilot cohorts are hand-recruited and told.
   This is the owner's explicit non-privacy-maximalist posture; do not add
   a consent wall.
6. **The paywall is experimental and pilot-framed.** It must visibly say it
   is an early-access pilot offer; it does not establish the permanent
   Free/Pro contract (thesis §8.0, §8.4 — the launch clock). Price variants
   R$149.90 / R$179.90 / R$199.90 annual via a PostHog experiment. v1 CTA
   is a fake-door intent capture; real checkout is the owner-gated
   follow-on (Step 8).
7. **The capability abstraction is billing-agnostic.** Product code asks
   `hasCapability("advanced_generation")`; nothing in `app.js` ever names a
   billing vendor. Entitlement is device-local (`repforge_pro_v1`), never
   in export/import, never in setup links.
8. **Analytical independence** (constitution planks 12–13): no paywall
   trigger inside or above the engine's outputs. The block-review teaser
   renders *after* the strategy buttons, visually subordinate. The
   recommendation, strategy ordering, highlight (plan 035), and why-sheet
   (plan 043) are untouched.
9. **The baseline generator stays fully free and uninterrupted** (thesis
   §8.2–§8.3, no-clawback). The locked affordances are additive advanced
   controls only. Saving a generated program must never route through the
   paywall.
10. **New event names are plain snake_case with no prefix** (e.g.
    `program_activated`). The catalog in this plan is the closed namespace;
    the `before_send` guard drops anything else.

## Why this matters

ADR 0010 commits Phase 1 to validating six hypotheses (thesis §20) on the
existing web core, and its P0 backlog (thesis §22) blocks meaningful
quantitative external testing on exactly this work: telemetry and cohort
attribution (A), and the Free/Pro capability abstraction plus experimental
paywall (C). Today the app measures nothing and has no Pro surface, so H1
(acquisition), H2 (activation), H3 (retention), H5 (willingness to pay), and
H7 (creator distribution) are all unreadable. This plan is the
instrumentation and the first commercial experiment; it deliberately builds
no production commerce infrastructure ("validate the commercial proposition
before building the commercial infrastructure").

## Current state (verified at `231ec54`)

`index.html:895-900` — script loading, no CSP meta anywhere in the file:

```html
<script src="schedule.js"></script>
<script src="notify.js"></script>
<script src="i18n.js"></script>
<script src="exercises.js"></script>
<script src="shared-setup.js?v=110"></script>
<script src="app.js?v=110"></script>
```

`sw.js:1-5` — cache name and the head of `ASSETS`:

```javascript
const CACHE = "repforge-v110";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./schedule.js", "./notify.js", "./i18n.js", "./exercises.js",
  "./shared-setup.js", "./shared-setup.js?v=110", "./app.js", "./app.js?v=110",
```

`sw.js:59-64` — **the fetch handler intercepts every GET, including
cross-origin**. Left as is, the PostHog SDK script would be cached
cache-first forever (never updating), and an offline miss would return
`index.html` as JavaScript:

```javascript
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const path = shellPathname(url.pathname);
  const isShell = event.request.mode === "navigate" ||
    SHELL.has(path) || SHELL.has(path.replace(/\/$/, "/index.html"));
```

`test/exercise-library.mjs:234-237` — the revision-lockstep gate this plan
must extend:

```javascript
const revision = sw.match(/const CACHE = "repforge-v(\d+)"/)?.[1] || "";
const transitionAssets = ["shared-setup.js", "app.js"];
const missingRevision = transitionAssets.filter(file => !index.includes(`src="${file}?v=${revision}"`));
const missingCache = transitionAssets.filter(file => !sw.includes(`"./${file}?v=${revision}"`));
```

`app.js` anchors (single file, minified-ish house style; line numbers will
drift — re-locate by symbol name):

- `app.js:1` — `const KEY="repforge_v1",DRAFT="repforge_draft_v1",PENDING="repforge_pending_v1",NOTIFY_META="repforge_notify_v1";`
- `app.js:7617` — `const UIKEY="repforge_ui_v1";` (device-only UI prefs pattern to copy for entitlement)
- `app.js:1099` / `app.js:1148` — `openModal(el,opts)` / `closeModal(el)` (dialog helpers; the paywall uses them)
- `app.js:1791` — `generateProgramFromOnboarding(answers)` (the baseline generator — do not gate)
- `app.js:7488-7611` — onboarding wizard: `defaultOnbAnswers` (goal, experience, daysPerWeek, splitType, equipment), `startOnboarding(origin)` at 7500, `renderOnboarding()` at 7522, `saveOnboardingProgram(io)` at 7608
- `app.js:2503-2524` — `finishBlockAndStart(strategy,…)`, `openBlockReview(review,…)`, `promptEndBlock()`; markup `#blockReview` at `index.html:536`
- `app.js:3905` — the per-set `.saveset` button render (`data-save` key); its delegated click handler is the per-set commit point
- `app.js:3118` — `applySuggestions(ex,draft)` uses `recommendation(ex)`; the suggestion the athlete sees before committing a set
- `app.js:4616` — `async function saveWorkout(e,io)`; `app.js:4801` — `openSessionSummary(s)`
- `app.js:7906` — `openWhySheet(exId,opener)` (plan 043 inspector)
- `app.js:8124` — `#firstRunSharedStart` click wiring (shared-program acceptance)

`index.html:344-423` — Settings section: groups are
`<p class="settings-group__label">` + `<div class="settings-group">` of
`.settings-row` items; the toggle pattern to copy is the voice row
(`#voiceToggle` `button.toggle` + visually-hidden checkbox,
`index.html:388-393`); the App group starts at `index.html:419` with the
Appearance row.

First-run gate: `#firstRun` at `index.html:581` with rows `#firstRunCreate`
(619), `#firstRunImport` (627), `#firstRunSharedStart` (637). Import review
commit: `#importCommit` at `index.html:339`. Program JSON export:
`#exportProgram` at `index.html:279`.

i18n: flat keys in `i18n-en.json` + `i18n-pt.json`, `{n}`-style
placeholders, compiled to `i18n.js` by `node tools/build-i18n.mjs`
(`--check` gates drift). PT-BR is primary-market copy — author it, do not
translate literally.

Baseline gates at `231ec54` (branch `cursor/product-thesis-adr-0010-5fc3`):
`node --check app.js` clean, `node tools/build-i18n.mjs --check` clean,
simulation `FAILED: 0` per plans index at `4e3d044` (code files unchanged
since).

## PostHog facts this plan is written against (verified 2026-08 docs)

- Current config-defaults date: `defaults: "2026-05-30"`.
- Replay masking: `session_recording: { maskAllInputs, maskTextSelector,
  maskTextFn }`; `ph-no-capture` class blocks an element from replay *and*
  autocapture; `ph-mask` masks text in replay.
- Autocapture masking: `mask_all_text: true` prevents `$el_text` capture.
- `before_send(event)` may mutate properties or return `null` to drop.
- `get_current_url` overrides the URL used for capture and replay targeting.
- Consent: `opt_in_capturing()` / `opt_out_capturing()` /
  `has_opted_out_capturing()`; the SDK persists the choice itself.
- Flags: `getFeatureFlag(key)`, `getFeatureFlagResult(key)` (value +
  payload), `onFeatureFlags(cb)`; exposure auto-captures
  `$feature_flag_called`.
- The snippet's inline stub queues calls made before `array.js` loads; if
  the script never loads (offline gym), queued calls are no-ops — the app
  must never depend on PostHog being up.

## Architecture

One new root file, `telemetry.js`, loaded after `shared-setup.js` and
before `app.js`. It owns: the PostHog init, the consent API, the
`before_send` guard, the closed event catalog, super properties, and the
experiment-variant reader. It exposes exactly one app-facing global,
`window.Telemetry`, and one test hook, `window.__repforgeTelemetry`
(codename hooks are the convention — `AGENTS.md`). The official PostHog
inline stub snippet goes in the `<head>` of `index.html` so early calls
queue. `app.js` gains the capability/entitlement layer, the paywall dialog
wiring, and one-line `Telemetry.capture(...)` calls at the funnel points.

The API key: `telemetry.js` declares
`const POSTHOG_KEY = "__POSTHOG_PROJECT_KEY__";`. When the value still
looks like a placeholder (starts with `__`), `telemetry.js` skips
`posthog.init` entirely and `Telemetry.capture` pushes into an in-memory
queue (`window.__repforgeTelemetry.queue`) instead. This keeps every test
network-silent and lets the code land before the owner creates the PostHog
project and pastes the real public key (project keys are client-side
public; committing one is fine).

## Implementation steps

Each step is one commit. Run the gate block at the end of every step:

```bash
node --check app.js && node --check telemetry.js && node --check sw.js
node tools/build-i18n.mjs --check
# with python3 -m http.server 8000 serving the repo root:
node test/schedule.mjs && node test/simulation.mjs && node test/i18n.mjs
node test/exercise-library.mjs && node test/accessibility.mjs
# expect: FAILED: 0 everywhere, exit code 0
```

### Step 1 — Service worker same-origin guard, revision bump, telemetry.js stub

1. `sw.js`: after `const url = new URL(event.request.url);` (line 61) add:
   `if (url.origin !== self.location.origin) return;`
   Cross-origin requests (the PostHog SDK and API) must bypass the cache
   entirely — never cached, never given the `index.html` offline fallback.
2. `sw.js`: `CACHE` → `"repforge-v111"`; in `ASSETS` change the two
   `?v=110` entries to `?v=111` and add `"./telemetry.js",
   "./telemetry.js?v=111"` beside the `app.js` pair; add
   `"/telemetry.js"` to the `SHELL` set (`sw.js:52`).
3. Create `telemetry.js` as a minimal stub in this commit (so the SW's
   `addAll` does not 404 and fail install):
   `window.Telemetry={capture(){},setConsent(){},hasConsent(){return true},variant(){return null}};`
   The real module replaces it in Step 2.
4. `index.html:899-900`: bump both `?v=110` → `?v=111` and insert
   `<script src="telemetry.js?v=111"></script>` between `shared-setup.js`
   and `app.js`.
5. `test/exercise-library.mjs:235`: `transitionAssets` →
   `["shared-setup.js", "app.js", "telemetry.js"]`.

Verify: gate block; then in a served browser session confirm the new
worker activates (`repforge-v111` in Cache Storage, no `repforge-v110`
remains) and that a cross-origin `fetch` in the console is not answered
from the cache.

### Step 2 — telemetry.js: init, consent, guards, catalog

Replace the stub with the real module (plain script, IIFE, house style —
no modules, no build). Contents, in order:

1. **Head snippet**: add the official PostHog inline stub snippet to
   `index.html` `<head>` (before the `styles.css` link), configured with
   `api_host: "https://us.i.posthog.com"`. The stub is inert until
   `posthog.init` runs from `telemetry.js`.
2. **Constants**: `POSTHOG_KEY` placeholder; `APP_REVISION = "111"` (keep
   equal to the `?v=` revision; update it whenever the cache bumps — add a
   line to the lockstep test asserting `telemetry.js` contains
   `APP_REVISION = "<revision>"`).
3. **The event catalog** — `EVENT_SCHEMA`, a frozen object mapping every
   allowed custom event name to its allowed property keys (the full
   catalog is the appendix of this plan). Anything not listed is dropped.
4. **The guard**:

   ```javascript
   function scrub(value){return typeof value==="string"?value.replace(/#setup=[^\s"']*/g,"#setup=[redacted]"):value}
   function guard(event){
     if(!event)return null;
     if(event.properties&&typeof event.properties.$current_url==="string")
       event.properties.$current_url=event.properties.$current_url.split("#")[0];
     if(event.event&&event.event[0]!=="$"){
       const allowed=EVENT_SCHEMA[event.event];
       if(!allowed)return null;
       const clean={};
       for(const k of allowed)if(event.properties&&event.properties[k]!==undefined)clean[k]=scrub(event.properties[k]);
       for(const k of Object.keys(event.properties||{}))if(k[0]==="$"||k.startsWith("tf_"))clean[k]=scrub(event.properties[k]);
       event.properties=clean}
     return event}
   ```

   (`$`-prefixed events — pageviews, autocapture, replay snapshots,
   `$feature_flag_called`, surveys, exceptions — pass through; custom
   events are allowlist-only.)
5. **Replay unmask function** — default-deny with explicit chrome
   unmasking:

   ```javascript
   function unmaskChrome(text,element){
     return element&&element.closest&&element.closest("[data-ph-unmask]")?text:"*".repeat(text.trim().length)}
   ```
6. **Init** (only when the key is real):

   ```javascript
   posthog.init(POSTHOG_KEY,{
     api_host:"https://us.i.posthog.com",
     defaults:"2026-05-30",
     autocapture:true,
     mask_all_text:true,
     capture_exceptions:true,
     enable_recording_console_log:true,
     session_recording:{maskAllInputs:true,maskTextSelector:"*",maskTextFn:unmaskChrome},
     get_current_url:()=>location.href.split("#")[0],
     before_send:guard,
     persistence:"localStorage+cookie"});
   posthog.register({tf_app_revision:APP_REVISION,
     tf_display_mode:matchMedia("(display-mode: standalone)").matches?"standalone":"browser"});
   ```

   `mask_all_text` keeps autocapture to tags/ids/classes (all stable
   identifiers in this codebase); `get_current_url` strips the fragment
   from captures *and* replay page URLs — this is the setup-link law
   applied mechanically. Register `tf_lang` after i18n resolves (call from
   `app.js` boot via `Telemetry.setLang(lang)`).
7. **Public API**: `window.Telemetry = { capture(name, props),
   setConsent(bool), hasConsent(), setLang(lang), variant(flagKey) }`.
   `capture` validates against `EVENT_SCHEMA` locally (console.warn on
   violation in addition to the guard), then `posthog.capture` — or pushes
   `{name, props}` onto the placeholder queue. `setConsent(false)` captures
   `analytics_disabled` first, then `posthog.opt_out_capturing()`;
   `setConsent(true)` opts in then captures `analytics_enabled`.
   `variant(flagKey)` returns
   `posthog.getFeatureFlagResult(flagKey) || null`, never throws, and
   returns `null` in placeholder mode.
8. **Test hook**: `window.__repforgeTelemetry = { guard, unmaskChrome,
   EVENT_SCHEMA, queue }`.

Add `node --check telemetry.js` to your loop. New suite
`test/telemetry.mjs` (use `launchChromium` from `test/browser.mjs`):

- guard drops a non-catalog custom event; passes `$pageview` through;
- guard strips non-allowlisted properties from a catalog event;
- guard redacts `#setup=…` from string properties and `$current_url`;
- `unmaskChrome` masks text outside `[data-ph-unmask]` and passes text
  inside it;
- with the placeholder key: a full page load performs **zero** requests to
  `*.posthog.com` (assert via Playwright route interception), and
  `Telemetry.capture` lands in `__repforgeTelemetry.queue`.

### Step 3 — Settings: analytics disclosure and off switch

1. `index.html`: in the App group (after the Appearance row,
   `index.html:421-423`), add a toggle row copying the voice pattern
   (`index.html:388-393`): label `settings.analytics`, toggle button
   `#analyticsToggle`, hidden checkbox `#analyticsEnabled`, followed by a
   `p.lede` with `settings.analytics_lede`.
2. `app.js`: wire the toggle to `Telemetry.setConsent(...)`; initial state
   from `Telemetry.hasConsent()`. No app-state storage — PostHog persists
   the choice; the row is device-scoped like Appearance.
3. i18n keys (author PT-BR, do not calque):
   - `settings.analytics` — en "Share anonymous usage data" / pt
     "Compartilhar dados anônimos de uso"
   - `settings.analytics_lede` — en "During the pilot, Taurifer collects
     anonymous usage analytics — screens, taps and product events — to
     improve the app. Your training record is not part of it: loads, reps,
     names and notes are masked or never sent. Turn this off to stop all
     collection." / pt "Durante o piloto, o Taurifer coleta dados anônimos
     de uso — telas, toques e eventos do produto — para melhorar o app.
     Seu registro de treino fica de fora: cargas, repetições, nomes e
     anotações são mascarados ou nunca enviados. Desative para
     interromper toda a coleta."
4. `node tools/build-i18n.mjs` to regenerate `i18n.js`.

Verify: gate block; toggle flips `aria-pressed`, survives reload (SDK
persistence), and `test/telemetry.mjs` gains an assertion that opt-out
stops queue/capture growth.

### Step 4 — Funnel events and the replay unmask pass

Instrument these call sites with one-line `Telemetry.capture` calls
(re-locate symbols by name; the catalog appendix defines each event's
allowed properties — pass nothing else):

| Call site (anchor) | Event |
|---|---|
| `boot()` completion | `app_boot` `{first_run}` |
| `#firstRunCreate` / `#firstRunImport` / `#firstRunSharedStart` clicks | `program_path_selected` `{route: generated\|import\|shared}` |
| valid shared decode at the gate (`app.js:7773` area) | `shared_link_opened` `{valid: true}` — invalid decode captures `{valid: false}`; **never** any payload content |
| `startOnboarding(origin)` (`app.js:7500`) | `generator_started` `{origin}` |
| `saveOnboardingProgram(io)` (`app.js:7608`) | `generator_completed` `{goal, experience, days_per_week, split}` (closed enums from `defaultOnbAnswers`) + `program_activated` `{route:"generated"}` |
| `#importCommit` success | `import_used` + `program_activated` `{route:"import"}` |
| first manual program save when nothing was onboarded | `program_activated` `{route:"manual"}` |
| `#firstRunSharedStart` acceptance success (`app.js:8124`) | `shared_program_started` + `program_activated` `{route:"shared"}` |
| `.saveset` commit handler (render at `app.js:3905`) | first commit of the session: `first_set_logged`; every commit: `set_saved` `{vs_suggestion: matched\|raised\|lowered\|no_suggestion}` — compare committed load/reps to the `applySuggestions` values, transmit **only the enum** |
| `saveWorkout` success (`app.js:4616`) | `session_completed` `{exercises, sets, duration_min, day_index}` |
| `openSessionSummary` (`app.js:4801`) | `session_summary_viewed` |
| substitution flow commit (plan 021 surface) | `substitution_used` |
| `openWhySheet` (`app.js:7906`) | `why_sheet_opened` |
| end-block confirm → review open (`app.js:2514`) | `block_review_viewed` |
| `finishBlockAndStart(strategy)` (`app.js:2503`) | `block_completed` `{strategy}` |
| `#exportProgram`, backup JSON export, CSV export rows | `export_used` `{kind: program\|backup\|csv}` |

Replay unmask pass — add `data-ph-unmask` to static-chrome containers
only: the bottom nav, the top bar (excluding the gauge count), the
Settings section (labels and group headers — the rows contain no training
values except displays like rest seconds, which are settings, not
training data), the first-run gate, the onboarding wizard, dialog chrome
(headers/buttons of `#blockReview`, glossary, import review — **not**
their body containers), and toasts are left masked (they can carry
counts and names). Everything else — the log tab, history, stats,
exercise pages, session summary, program editor — stays masked by
default-deny. Do not use `ph-no-capture` on whole views (it would blank
replay's layout value); masking text is the correct level.

Acquisition source: PostHog captures UTM parameters automatically. Creator
pilot links will carry `?utm_source=<creator>` — query, never fragment —
no code needed in this step; document it in the ops section dashboard.

Verify: gate block; extend `test/telemetry.mjs` to walk create-program →
log set → save workout in placeholder mode and assert the queue contains
exactly the expected event names with exactly the allowed property keys
(no extras — this is the shadow-database regression test). Simulation must
stay `FAILED: 0` (instrumentation must not alter behavior).

### Step 5 — Capability layer and device-local entitlement

1. `app.js` (beside `UIKEY`, `app.js:7617`): `const PROKEY="repforge_pro_v1";`
   with `loadEntitlement()` / `saveEntitlement(o)` (same try/JSON pattern
   as `loadUiPrefs`). Shape: `{plan:"pilot", code, activatedAt}`.
2. `const CAPABILITIES=new Set(["advanced_generation","history_informed_generation","cross_block_analysis"]);`
   `function hasCapability(name){return CAPABILITIES.has(name)&&!!loadEntitlement().activatedAt}`
   All capabilities are entitlement-gated; everything currently shipped
   stays capability-free by definition (no clawbacks — do **not** wrap any
   existing behavior in `hasCapability`).
3. Redeem validation v1: trimmed code, length ≥ 6. Codes are owner-issued
   strings (founding-user activation, manual fulfillment); no server
   check. Forgeability is accepted at pilot scale — record this in a code
   comment pointing at thesis §22 P0-C.
4. Exclusions (verify, then test): `repforge_pro_v1` is not part of
   `repforge_v1` state, so export/import and the setup-link allowlist
   cannot carry it. Add a test assertion that the backup JSON export
   string does not contain `repforge_pro` or the redeemed code.
5. Test hook: `window.__repforgePro={activate(code),clear()}`.

Verify: gate block; new assertions in `test/paywall-flow.mjs` (created
next step) or a small `test/entitlement.mjs`.

### Step 6 — Paywall sheet, triggers, price experiment, intent capture

1. **Markup** (`index.html`, beside `#blockReview`): `#paywall` dialog
   (`role="dialog"`, `aria-modal`, hidden by default), chrome marked
   `data-ph-unmask`:
   - eyebrow `paywall.eyebrow` — en "Early access pilot" / pt "Piloto de
     acesso antecipado";
   - title `paywall.title` — en "Taurifer Pro" (shared);
   - a capability line swapped per trigger (`paywall.cap.advanced_generation`,
     `paywall.cap.cross_block_analysis`);
   - benefit list (calm, concrete, thesis §28 voice): advanced program
     personalization; cross-block comparison; long-horizon progression
     analysis; future cross-device sync — four `li`, no hype, no emoji;
   - price line `paywall.price` — en "R$ {price} per year during the
     pilot" / pt "R$ {price} por ano durante o piloto";
   - pilot disclaimer `paywall.pilot_note` — en "Early-access offer while
     Taurifer is in pilot. Packaging and pricing may change before
     launch." / pt "Oferta de acesso antecipado durante o piloto do
     Taurifer. Condições e preço podem mudar antes do lançamento.";
   - CTA `#paywallCta` `paywall.cta_intent` — en "Request early access" /
     pt "Quero acesso antecipado"; secondary `#paywallNotNow`
     `paywall.not_now` — en "Not now" / pt "Agora não";
   - footer link `#paywallRedeem` `paywall.redeem` — en "Have a code?" /
     pt "Tem um código?" → inline panel `#paywallRedeemPanel` (input +
     activate button `paywall.redeem_activate`).
2. **Behavior** (`app.js`): `openPaywall(trigger)` reads the experiment —
   `const r=Telemetry.variant("pro-annual-price")`; price =
   `r?.payload?.amount ?? 179.90`, variant = `r?.variant ?? "fallback"` —
   renders, opens via `openModal`, captures `paywall_viewed`
   `{trigger, variant, price_brl}`. CTA captures `pro_intent_confirmed`
   `{trigger, variant, price_brl}` and swaps the body to a confirmation
   state (`paywall.intent_done` — en "Thanks — early-access invitations go
   out during the pilot." / pt "Obrigado — os convites de acesso
   antecipado saem durante o piloto."). Dismiss captures
   `paywall_dismissed` `{trigger}`. Redeem success captures
   `pro_code_redeemed`, activates the entitlement, and re-renders the
   opener surface.
3. **Triggers** (all explicit taps on clearly-Pro affordances):
   - **Onboarding review step** (`renderOnboarding`, final step): a locked
     row "Advanced options · Pro" (`onb.advanced_locked` — en "Advanced
     options — muscle priorities, volume preferences · Pro" / pt "Opções
     avançadas — prioridades por músculo, preferências de volume · Pro")
     → `openPaywall("advanced_generation")`. With an active entitlement it
     renders as a disabled "coming in the pilot" note (the optimizer
     doesn't exist yet — thesis §22 P0-C explicitly authorizes measuring
     demand ahead of the build). **Save program never routes through
     this.**
   - **Block review**: after the strategy buttons inside
     `#blockReviewBody`, a visually subordinate row
     (`blockreview.compare_locked` — en "Compare with previous blocks ·
     Pro" / pt "Comparar com blocos anteriores · Pro") →
     `openPaywall("cross_block_analysis")`. It must render *below* every
     strategy action and outside the recommendation copy (analytical
     independence, constitution planks 12–13 and thesis §23).
   - **Settings**: a "Taurifer Pro" row in the App group showing status
     (en "Not active" / "Pilot access active"; pt "Inativo" / "Acesso
     piloto ativo") → opens the paywall (or the redeem panel when the
     athlete has a code).
4. **Experiment** (ops half in the workspace section): multivariate flag
   `pro-annual-price`, variants `p149`/`p179`/`p199`, payloads
   `{"amount":149.90}` etc. Exposure is auto-captured; `fallback` renders
   R$179.90 and is excluded from experiment readouts.
5. Styles: reuse the block-review dialog styling; token-named colors only
   (`AGENTS.md` appearance law); the locked rows use an existing subdued
   row treatment plus a small "Pro" tag — no new palette.
6. i18n for every key above (en + authored PT-BR), regenerate `i18n.js`.

New suite `test/paywall-flow.mjs`:

- each trigger opens the paywall with the right capability line;
- fallback price renders R$179,90 (pt formatting uses comma — format via
  the existing locale number helpers) and `paywall_viewed` carries
  `variant:"fallback"`;
- CTA produces `pro_intent_confirmed` in the placeholder queue and swaps
  to the confirmation state;
- redeem activates: Settings row flips to active, onboarding locked row
  changes state;
- **analytical-independence regression**: in the block review DOM, the
  teaser row's index is greater than every `.blockreview__act` strategy
  button, and the recommended-strategy highlight (plan 035) is unchanged;
- dismissing the paywall from the block review leaves `finishBlockAndStart`
  fully functional (end-block flow unchanged).

Simulation must stay `FAILED: 0` — the paywall never auto-opens.

### Step 7 — UI screen catalog and index bookkeeping

1. `tools/capture-ui-screens.mjs`: add screens for the Settings analytics
   toggle (scrolled into view), the Settings Pro row, the paywall (opened
   from the block-review trigger), and the onboarding review step showing
   the locked advanced row. Update the `docs/ui-screens/` README list.
2. Regenerate both theme folders (`node tools/capture-ui-screens.mjs`
   with the app served on `REPFORGE_URL`) and commit the PNGs — light and
   dark (`AGENTS.md` catalog law; do not hand-edit).
3. Update this plan's status row in `plans/README.md`.

### Step 8 — Real-payment pilot (owner-gated follow-on; do not start without the owner's go)

Replace the fake door behind a PostHog flag (`pro-checkout-mode`, payload
`{"mode":"intent"}` → `{"mode":"stripe"}` — flips without a deploy):

1. Owner creates three Stripe Payment Links (BRL, one-time annual pilot
   price per variant, card + Pix enabled). URLs land in `telemetry.js` as
   flag payload or constants.
2. In `stripe` mode the CTA captures `checkout_started`
   `{variant, price_brl}` and opens the matching Payment Link in a new
   tab; the paywall swaps to `paywall.checkout_note` (en "After payment
   you'll receive your access code by email within a day." / pt "Após o
   pagamento, você recebe seu código de acesso por e-mail em até um
   dia."). Fulfillment is manual founding-user activation: the owner
   emails a code; the athlete redeems in Settings (Step 5/6 machinery,
   `pro_code_redeemed` closes the loop).
3. Explicitly not built: StoreKit, Play Billing, subscription lifecycle,
   receipt validation, webhooks, any Taurifer backend. A payment webhook
   or small entitlement endpoint is *allowed* by the AGENTS.md guard if
   manual fulfillment becomes the bottleneck — that is a separate plan.

## PostHog workspace configuration (ops checklist — owner, or executor with access)

1. Create the project on PostHog Cloud US; paste the public key into
   `telemetry.js` (`POSTHOG_KEY`), bump nothing else.
2. Project settings → Session replay: enable; sampling 100% (pilot scale);
   canvas recording off; **network capture: headers and body OFF**
   (constitutional — request bodies could carry state payloads); confirm
   the project-level masking mirrors the client (mask all inputs + text).
3. Enable autocapture, heatmaps, web analytics, error tracking, surveys
   (surveys need no code — use them later for qualitative pilot prompts).
4. Feature flags: create `pro-annual-price` (multivariate, `p149`/`p179`/
   `p199`, payloads with `amount`) and `pro-checkout-mode` (payload
   `{"mode":"intent"}`).
5. Experiment: `pro-annual-price` targeting `pro_intent_confirmed`
   (primary) and `paywall_viewed → pro_intent_confirmed` conversion
   (secondary), split by cohort property `route` (generated vs shared vs
   manual/import).
6. Dashboards (freeze the definitions before reading data — thesis §20.3):
   - **Activation funnel**: `$pageview → program_path_selected →
     program_activated → first_set_logged → session_completed`, broken
     down by `route`; H2 targets: >60% reach `program_activated`, >50%
     complete a first workout within 72h.
   - **Retention**: retention insight on `session_completed`; frozen
     definition of active — ≥2 `session_completed` in any rolling 14-day
     window; D7/D30/D60 views; H3 targets: >50% with ≥6 workouts in 30
     days, >30% active at D60.
   - **Paywall**: `paywall_viewed → pro_intent_confirmed` by variant,
     trigger, and route (H5).
   - **Creator**: `utm_source` breakdown over `shared_link_opened →
     shared_program_started → session_completed` and week-4 activity (H7).
7. LGPD notes (not legal advice): events are pseudonymous
   (device-scoped distinct id, no emails, no names); deletion requests are
   honored via PostHog person deletion; the Settings disclosure (Step 3)
   is the notice surface. Do not add email capture to the fake door
   without revisiting this.

## Event catalog (the closed namespace — Appendix)

| Event | Allowed properties | Notes |
|---|---|---|
| `app_boot` | `first_run` | once per load, after boot() |
| `program_path_selected` | `route` | `generated`/`import`/`shared` |
| `shared_link_opened` | `valid` | boolean only; never payload content |
| `generator_started` | `origin` | |
| `generator_completed` | `goal`, `experience`, `days_per_week`, `split` | closed enums only |
| `program_activated` | `route` | `generated`/`manual`/`import`/`shared` |
| `shared_program_started` | — | |
| `import_used` | — | |
| `export_used` | `kind` | `program`/`backup`/`csv` |
| `first_set_logged` | — | once per session draft |
| `set_saved` | `vs_suggestion` | `matched`/`raised`/`lowered`/`no_suggestion` — never values |
| `session_completed` | `exercises`, `sets`, `duration_min`, `day_index` | coarse counts only |
| `session_summary_viewed` | — | |
| `substitution_used` | — | |
| `why_sheet_opened` | — | |
| `block_review_viewed` | — | |
| `block_completed` | `strategy` | strategy key enum |
| `paywall_viewed` | `trigger`, `variant`, `price_brl` | |
| `paywall_dismissed` | `trigger` | |
| `pro_intent_confirmed` | `trigger`, `variant`, `price_brl` | |
| `checkout_started` | `variant`, `price_brl` | Step 8 only |
| `pro_code_redeemed` | — | never the code itself |
| `analytics_enabled` / `analytics_disabled` | — | disabled captured before opt-out |

Forbidden everywhere (the `before_send` guard enforces; tests assert):
loads/weights, reps, RIR, e1RM/capacity values, bodyweight, workout or
exercise notes, exercise names or custom-exercise names, program names,
program payloads, setup-link fragments/cookies, redeem codes, emails.
Library ids are also excluded from v1 events — nothing in the catalog
needs them, so don't add them casually (per-set ids over time are a
longitudinal record).

## Hard scope boundaries / STOP conditions

- STOP if any step seems to require: user accounts, a Taurifer backend
  service (beyond PostHog Cloud itself), StoreKit/Play Billing,
  subscription lifecycle, cloud sync, or native shells — that is Phase 2
  (ADR 0010).
- STOP if an event "needs" a forbidden property, if the fragment-scrub
  cannot be made airtight, or if replay masking must be weakened below
  default-deny to be useful — escalate to the owner instead of widening
  capture.
- STOP if a paywall trigger would sit inside or above the engine's
  recommendation content, reorder strategies, or reword engine copy
  (constitution planks 12–13).
- STOP if any currently-free behavior would end up behind
  `hasCapability` (no clawbacks; the baseline generator and Save program
  must remain uninterrupted).
- STOP if the PostHog SDK failing to load breaks boot, logging, or saving
  (the app must be fully functional with the SDK absent/blocked/offline).
- STOP if `test/exercise-library.mjs`'s revision lockstep cannot pass.
- The paywall must always carry the pilot framing copy (launch clock,
  thesis §8.0/§8.4). Removing it is a STOP, not a design choice.

## Done criteria

- All gates green: `node --check` on `app.js`/`telemetry.js`/`sw.js`;
  `node tools/build-i18n.mjs --check`; schedule, simulation (`FAILED: 0`),
  i18n, exercise-library, accessibility; new `test/telemetry.mjs` and
  `test/paywall-flow.mjs` suites pass.
- With the placeholder key, zero network requests to `*.posthog.com`
  across every suite.
- The placeholder-queue walk asserts the catalog exactly (names and
  property keys) for the create → log → save → end-block flow.
- Replay masking verified: text outside `[data-ph-unmask]` masked; inputs
  masked; `$current_url` and replay URLs carry no fragment.
- Paywall opens only from its three explicit triggers, always
  pilot-framed, price from the experiment with a working fallback; intent
  and redeem events land; block-review hierarchy regression passes.
- Backup export contains no entitlement material.
- `docs/ui-screens/` regenerated (light + dark) including the new
  surfaces; `plans/README.md` status row updated.
