# Plan 038: BYOK AI coach — chat sheet with structured, user-approved program proposals

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `BASE=$(git log -1 --format=%H -- plans/038-ai-coach.md); git diff --stat $BASE..HEAD -- app.js index.html styles.css sw.js i18n.js i18n-en.json i18n-pt.json test/simulation.mjs`
> If any in-scope file changed since this plan landed, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Line numbers below were taken at
> `5023c1c` plus the "Restore workout-level enter-weight toast" fix that
> shipped with this plan; they may be off by a line or two — match on code,
> not on line numbers.)
>
> **Guardrail note**: This plan implements a feature that was previously in
> the "Explicitly rejected" list. That rejection is formally superseded by
> the product owner's decision recorded in
> [`docs/adr/0002-byok-ai-coach.md`](../docs/adr/0002-byok-ai-coach.md) and
> the amended guardrails in `plans/README.md`. Do NOT treat the old
> rejection as a STOP condition; DO treat any drift from the *amended*
> guardrails (backend, sixth tab, key in exports, silent mutations) as one.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (first network feature in a local-only app; first LLM
  surface; touches export/import invariants and program mutation paths)
- **Depends on**: none (all waves 1–4 landed)
- **Category**: direction
- **Planned at**: commit `5023c1c`, 2026-08-09
- **Source**: product-owner decision session (grill transcript,
  2026-07-13 → 2026-08-09); ADR 0002

## Product decisions (locked — do not re-litigate)

Each of these was explicitly decided by the product owner. Deviating from
any of them is a STOP condition.

1. **Real LLM coach, BYOK.** The browser calls the provider directly with a
   user-pasted API key. No backend, no proxy hosted by us, no OAuth, no
   ChatGPT-subscription piggybacking (investigated and rejected: the Codex
   OAuth surface is unofficial, CORS-blocked from browsers, and killable by
   vendor decree). Off by default; explicit consent gate before the first
   request.
2. **Capability tier: chat + structured proposals.** The coach answers
   questions AND may emit machine-readable program-change proposals rendered
   as cards with Apply / Dismiss. The user always commits the change.
   Proposals touch the **program only** (exercise templates + program
   metadata) — never `state.log`.
3. **Integration layer:** raw `fetch` against OpenAI-compatible
   `/chat/completions` with SSE streaming. No SDK, no new runtime
   dependency. Presets: **OpenRouter (default) / Anthropic / Local Ollama /
   Custom base URL**. Anthropic is the one divergent request shape
   (`/v1/messages` + `x-api-key` + `anthropic-version` +
   `anthropic-dangerous-direct-browser-access: true`). OpenAI-direct is NOT
   a preset (its API rejects browser-origin CORS; GPT models are reachable
   via OpenRouter).
4. **Model choice is product-owned.** Hosted presets (OpenRouter, Anthropic)
   use a single model slug pinned in a code constant (`COACH_MODELS`),
   changed only via app releases. No user-facing model field for hosted
   presets. Ollama and Custom presets show a free-text model field (product
   cannot know what runs behind a user's endpoint). The concrete launch
   slugs are chosen by the product owner at implementation time — put a
   placeholder constant in code, then STOP and ask if the owner has not
   supplied slugs.
5. **Surface:** a full-screen coach **sheet** (overlay), not a tab. The nav
   keeps exactly five tabs. Entry points: (a) "Ask the coach" button on the
   Stats tab, (b) block review dialog, (c) attention-board chips
   (analysis-flavored groups), (d) a **post-save session review offer** on
   the Log tab (a button that appears with the save confirmation — never an
   auto-opened sheet). No other Log-tab presence; the coach module must add
   zero work to Log-tab render paths when unopened.
6. **Context is scoped per entry point** via a pure
   `buildCoachContext(entryPoint, opts)` function: program (templates +
   meta) + derived signals + a bounded window of raw log rows (full
   history for a single exercise when the topic is one lift; the saved
   session + previous comparable session for post-save review; last N
   sessions otherwise), older data as per-exercise aggregates, hard token
   budget. **Bodyweight rows are excluded unless the user enables the
   "share bodyweight" toggle.** The payload is user-inspectable from the
   sheet.
7. **Proposal wire protocol:** fenced <code>```repforge-proposal</code> JSON
   blocks inside the model's prose (no tool calling — support is too uneven
   across BYOK endpoints). Strict client-side validation against schema AND
   current program. Invalid blocks degrade to visible plain text, never to
   an applied change. Operation vocabulary (v1, closed set):
   `update_exercise`, `add_exercise`, `remove_exercise`, `move_exercise`,
   `update_program_meta`. Explicitly NOT in v1: creating/deleting training
   days, touching progression settings, mesocycle-structural changes.
8. **Storage:** everything coach-related lives in a **separate**
   `localStorage` key `repforge_coach_v1` (config: preset, base URL, model
   for ollama/custom, API key, consent timestamp, bodyweight toggle; plus
   the current conversation capped at 30 messages). It is **never** written
   into `state`, and therefore never appears in Export backup JSON, program
   export, or CSV. **Settings → Delete log** additionally wipes the chat
   history but keeps config; a new **Disconnect coach** action wipes the
   whole coach key. Applying a proposal has no separate audit trail (the
   card flips to "Applied"; standard program-editor persistence applies).
9. **Runtime behavior:** SSE streaming with automatic non-streaming
   fallback; entry points always visible (no key → sheet shows a setup
   pointer to Settings); error taxonomy mapped to actionable copy (401/403
   → key problem, 402/429 → quota/rate limit, network/CORS → base
   URL/connection); no temperature or token dials in the UI.
10. **Persona:** system prompt speaks this repo's domain language
    (session, log row, training day, RIR, double progression — see
    `CONTEXT.md`), reasons only from the provided context and must say
    when the log doesn't show something, hard-deflects injury/pain/medical
    topics to professionals, respects the app's double-progression
    philosophy, and emits proposals only when concretely justified.

## Why this matters

The app already computes deterministic coaching signals (recommendations,
program status, block reviews, attention groups) but can only *display*
them. The gap named repeatedly in persona feedback is turning insight into
conversation and action: "why did my bench stall?", "should I deload?",
"trim my Tuesday". A BYOK LLM coach grounded in the local log answers those
— while the fenced-proposal protocol turns advice into one-tap program
edits that ride the existing editor rails. The local-first story survives:
users who never enable the coach send nothing anywhere, and Ollama users
can run it with zero bytes leaving their machine.

## Current state

All in `app.js` unless noted. The repo is a static PWA: no build step, no
bundler; scripts load classically (`index.html:323-326`):

```html
  <script src="schedule.js"></script>
  <script src="notify.js"></script>
  <script src="i18n.js"></script>
  <script src="app.js"></script>
```

`app.js:1` — storage keys (the coach key must be a NEW sibling, never
inside `state`):

```javascript
const KEY="repforge_v1",DRAFT="repforge_draft_v1",NOTIFY_META="repforge_notify_v1";
```

`app.js:643-649` — persistence (`state` → localStorage mirror + IndexedDB):

```javascript
function save(){persist()}
function persist(){
  let lsOk=true;
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){lsOk=false;console.warn("localStorage mirror failed",e)}
  idbSet(KEY,state).catch(e=>{console.warn("idb persist failed",e);
```

`app.js:1758-1760` — backup export serializes `state` verbatim. This is why
the API key must never live in `state`:

```javascript
function exportJson(){state.settings.lastExport=new Date().toISOString();save();
  const text=JSON.stringify(state,null,2),name=`repforge_backup_${today()}.json`;
  shareOrDownload(text,name,"application/json");renderSettings()}
```

`app.js:189-205` — the `Program` class is the program mutation seam
(`find`, `update`, `move`; plus add/remove used by the program editor).
Proposal application MUST route through these methods and then
`persistProgram()` (`app.js:1698`), preserving exercise ids (plan 006):

```javascript
class Program{
  constructor(list=[]){const ids=new Set();this.exercises=(Array.isArray(list)?list:[]).map(e=>{const ex=new Exercise(e);if(ids.has(ex.id))ex.id=uid();ids.add(ex.id);return ex});this.renumber()}
  ...
  find(id){return this.exercises.find(e=>e.id===id)}
  update(id,field,value){const e=this.find(id);if(!e)return;
  ...
  move(id,dir){const e=this.find(id);if(!e)return;const list=this.forDay(e.day),i=list.indexOf(e),j=i+dir;
```

```javascript
function persistProgram(){state.program=prog.toJSON();save()}
```

`app.js:1059-1093` — `saveWorkout` builds rows, pushes to `state.log`,
saves, then toasts. The post-save review offer hooks in after the toast
(the saved `session` id and `rows` are in scope):

```javascript
  state.log.push(...rows);save();clearDraft();committed.clear();touched.clear();warmups.clear();substituted.clear();$("#notes").value="";
  ...
  toast(msg);render()}finally{saving=false}}
```

`app.js:1142-1151` — `renderStats` top (the Stats entry button mounts near
`#statsIntro` / `#thisWeek`); `index.html:131` — the Review segment:

```html
      <div id="segReview" class="stats-seg"><h3 class="subhead" data-i18n="stats.review">Review</h3><div id="reviewPanel"></div></div>
```

`app.js:613-617` — block review dialog (`openBlockReview`) — entry point
(c) adds a "Discuss with coach" button here:

```javascript
function openBlockReview(review){blockReviewCurrent=review;renderBlockReviewPanel(review);const d=$("#blockReview");if(!d)return;
  const rec=REC_STRATEGY[review.recommendation];
  $$(".blockreview__act").forEach(b=>{const on=b.dataset.strategy===rec;b.classList.toggle("is-recommended",on);b.setAttribute("aria-description",on?t("aria.recommended"):"")});
  d.classList.remove("hidden");$("#blockReviewClose").onclick=closeBlockReview;
```

`app.js:1357` — `renderAttention` (chips; plan 034 already split
action-groups → Log vs analysis-groups → chart. This plan adds a coach
affordance to the analysis groups only — see Step 8).

`sw.js:23-24` — the service worker ignores non-GET requests, so streaming
POSTs to providers pass through untouched. Do not change this contract:

```javascript
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
```

`app.js:1708-1723` — `renderSettings` (coach settings block mounts in the
Settings view; `index.html:170-228` has the settings cards, storage card
with `#exportJson` at line 225).

**i18n convention** (`i18n.js:1-2`): `i18n.js` holds `EN`/`PT` dictionaries
generated from `i18n-en.json` + `i18n-pt.json`. Every new user-facing
string needs a key in BOTH json files AND both objects in `i18n.js`
(there is no generator script in-repo; keep the three in sync by hand),
then rendered via `t("key")` / `data-i18n`.

**Existing simulation coverage you must respect** (`test/simulation.mjs`,
4011 lines): asserts five nav tabs, attention-chip navigation, `#endBlock`
flows, export shapes, and Log-tab behavior. Verified baseline (this plan's
branch, which includes the enter-weight toast fix — at bare `5023c1c` the
gate is red because that i18n regression breaks the harness's toast regex):
`PASSED: 305, FAILED: 0`. The count only grows.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Quick sim while iterating | `cd test && REPFORGE_SIM_WEEKS=12 node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (the only files you should modify):

- `coach.js` — NEW file: all coach logic (config store, context builder,
  provider client, SSE parser, proposal parse/validate/apply, sheet UI
  wiring). Exposed to `app.js` via a `window.RepForgeCoach` namespace,
  mirroring how `notify.js` exposes `RepForgeNotify`.
- `app.js` — entry-point hooks only (Stats button, block review button,
  attention-chip affordance, post-save offer, Settings block render/commit,
  Delete-log chat wipe). Keep the diff here small; the feature lives in
  `coach.js`.
- `index.html` — coach sheet markup (hidden dialog/overlay), Settings card,
  `<script src="coach.js">` before `app.js`.
- `styles.css` — sheet, chat bubbles, proposal cards, settings block.
- `sw.js` — add `./coach.js` to `ASSETS` and `"/coach.js"` to `SHELL`;
  bump `CACHE` version.
- `i18n.js`, `i18n-en.json`, `i18n-pt.json` — all new copy, EN + PT.
- `test/simulation.mjs` — new checks incl. the mock provider (Step 10).
- `plans/README.md` — status row (already amended for guardrails by the
  planning commit).

**Out of scope** (do NOT touch, even though they look related):

- `state` shape, `persist()`, import/export/CSV logic (except the
  Delete-log hook and the simulation assertions about exports).
- The deterministic recommendation engine, block review math, attention
  grouping.
- Progression settings, mesocycle structure (plan 024 remains DRAFT).
- Any OAuth, PKCE, or subscription-proxy flow (explicitly rejected).
- Tool/function-calling request shapes.
- Multi-conversation history, proposal undo/audit trail (deferred).

## Git workflow

- Branch: `cursor/plan-038-ai-coach-<suffix>`.
- Commit style: single-line imperative summary; one commit per logical
  step is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Coach store + settings surface

1. In `coach.js`, define the store: key `repforge_coach_v1`, shape
   `{config:{preset,baseUrl,model,apiKey,consentAt,shareBodyweight},chat:[...]}`.
   `loadCoach()` / `saveCoach()` with try/catch parse, mirroring
   `loadNotifyMeta` (`app.js:3-6`). localStorage only — no IndexedDB
   mirror (a lost key is re-pasteable; chat history is disposable).
2. Preset table: `openrouter` → `https://openrouter.ai/api/v1` (model from
   `COACH_MODELS.openrouter`), `anthropic` → `https://api.anthropic.com`
   (model from `COACH_MODELS.anthropic`), `ollama` →
   `http://localhost:11434/v1` (user model field), `custom` (user base URL
   + model fields).
3. Settings card in `index.html` (inside `#settings`, after the storage
   card): preset select, key input (`type="password"`, `autocomplete="off"`),
   conditional base-URL/model fields, bodyweight toggle, Disconnect coach
   button, and a short data-disclosure paragraph. Render/commit wiring
   follows the `renderSettings`/`commitSettings` pattern but reads/writes
   the coach store, NOT `state.settings`.
4. Hook Delete log: find the existing delete-log handler in `app.js` and
   add `RepForgeCoach.clearChat()` (config survives; `RepForgeCoach.disconnect()`
   wipes the whole key and is bound to the Disconnect button).

**Verify**: `node --check coach.js app.js` → exit 0. In the browser: paste
a key, reload, key survives; Export backup JSON → downloaded file contains
no `repforge_coach` material and no key string; Disconnect wipes it.

### Step 2: Context builder (pure)

`buildCoachContext(entryPoint, opts)` in `coach.js`, entry points
`"stats" | "block_review" | "attention" | "session_review"`. Assemble from
globals it is *passed* (accept `{state, prog}` args so the simulation can
call it purely via `window.RepForgeCoach`):

- Always: program templates (day, name, sets, rep range, muscles, notes),
  program meta (name, started, week/total), derived signals (per-exercise
  `recommendation(ex).status`, program status label, weekly snapshot).
- `session_review`: rows of the just-saved session + the previous session
  for the same training day (use `sessionsFor`-style filtering).
- `attention` with `opts.exerciseId`: full per-session history for that
  one exercise (the `sessionsFor(ex)` aggregate rows, not raw sets).
- `stats` / `block_review`: last 8 sessions as summaries + all-time
  per-exercise aggregates (first/best/latest e1rm, session count).
- Strip: `bodyweight` (unless `config.shareBodyweight`), `notes`/`exNote`
  free text stays IN (it's training context), no other fields exist that
  identify the user.
- Budget: serialize; if > ~8000 chars, drop oldest session summaries
  first, then reduce aggregates — deterministically.

Return `{system, contextText}` where `system` is the persona prompt
(decision 10) including the proposal-protocol instructions and the JSON
schema of the five operations with the *current* exercise ids/days inline.

**Verify**: `node --check coach.js`. Expose on `window.RepForgeCoach` and
eyeball `buildCoachContext("stats",{state,prog})` output in the console:
no `bodyweight` by default; flips on with the toggle.

### Step 3: Provider client + SSE parser

`coachSend(messages, {onDelta, onDone, onError})` in `coach.js`:

- OpenAI-compatible path (openrouter/ollama/custom): POST
  `${baseUrl}/chat/completions`, `Authorization: Bearer <key>` (omit for
  ollama if key empty), body `{model, messages, stream:true}`. Parse the
  `text/event-stream` body via `response.body.getReader()` +
  `TextDecoder`: split on newlines, handle `data: ` prefixes, `[DONE]`
  sentinel, accumulate `choices[0].delta.content`.
- Anthropic path: POST `${baseUrl}/v1/messages`, headers `x-api-key`,
  `anthropic-version: 2023-06-01`,
  `anthropic-dangerous-direct-browser-access: true`; body
  `{model, max_tokens: 2048, system, messages, stream:true}` (system is a
  top-level field, not a message); accumulate `content_block_delta`
  `text_delta` events.
- Fallback: if the stream errors after HTTP 200 mid-body, retry once with
  `stream:false` and deliver the whole text via `onDelta` + `onDone`.
- Error taxonomy (decision 9): map status → i18n key
  (`coach.err.auth`, `coach.err.quota`, `coach.err.network`), include
  provider message text when parseable. Never render raw JSON.

**Verify**: with Ollama or any OpenAI-compatible endpoint available, a
round trip streams into the console. If none is available locally, defer
live verification to Step 10's mock (the code path is identical).

### Step 4: Proposal parse / validate / apply

1. `parseProposals(text)`: extract ```` ```repforge-proposal ```` fenced
   blocks; `JSON.parse` each; on parse failure return the block as plain
   text.
2. `validateProposal(p, prog)`: closed-set `op` check; per-op field
   validation — `update_exercise`/`remove_exercise`/`move_exercise`
   require an `id` that `prog.find(id)` resolves; `update_exercise`
   allows only `{sets, repLow, repHigh, notes, alternates}` with sane
   bounds (`1<=sets<=6`, `1<=repLow<=repHigh<=30`); `add_exercise`
   requires `day` ∈ existing `days()`, a `name`, and valid set/rep
   fields; `update_program_meta` allows only `{name, weeksTotal}`.
   Reject anything else. Every proposal must carry a short `reason`
   string for the card.
3. `applyProposal(p)`: route through `Program` methods / the same
   mutations the program editor uses; end with `persistProgram();render()`.
   New exercises get fresh `uid()` ids via the `Exercise` constructor —
   never accept an id from the model for `add_exercise`.

**Verify**: `node --check coach.js`; unit-style assertions land in
Step 10 (valid ops apply; unknown op / bad id / insane reps rejected).

### Step 5: Coach sheet UI

Markup in `index.html` (hidden by default, sibling of the block-review
dialog): full-screen overlay with header (title, context-inspector button,
new-conversation button, close), scrollable message list, proposal cards
inline in the assistant messages, input row (textarea + send). Follow the
existing dialog pattern (`#blockReview` uses `classList` hidden toggling —
`app.js:588,616`). The context-inspector button opens a `<details>`/panel
showing the exact `contextText` that will be sent (decision 6).

Consent gate: if `config.consentAt` is unset, the sheet body shows the
consent copy ("your program and recent training data will be sent to
<preset host>...") with an Enable button that stamps `consentAt` and
reveals the chat; without a key it points to Settings instead.

Chat state: persist to the coach store after every completed exchange,
capped at the 30 most recent messages; "New conversation" clears it.
Streaming renders into the last assistant bubble as deltas arrive.

Accessibility: the sheet is `role="dialog"` `aria-modal="true"`, focus
moves in on open and back to the opener on close, Escape closes (mirror
whatever `#blockReview` does; improve only within the sheet).

**Verify**: manual — open from a temporary button, consent gate shows
once, messages stream, reload restores the conversation.

### Step 6: Entry points — Stats, block review, session review

1. **Stats**: an "Ask the coach" button in the Stats view header area
   (near `#thisWeek`, visible whether or not `#statsIntro` shows). Opens
   the sheet with `entryPoint:"stats"`.
2. **Block review**: a secondary "Discuss with coach" button in
   `#blockReview` (alongside the strategy actions, NOT one of
   `.blockreview__act` — it must not end the block). Opens the sheet with
   `entryPoint:"block_review"` and seeds the first user message with the
   review numbers.
3. **Session review**: in `saveWorkout` after `toast(msg)`, when the coach
   is configured+consented, reveal a small inline offer (a button in/next
   to the save confirmation area — reuse the toast bar region or a
   one-line banner under the save button): "Review this session with the
   coach". Tapping opens the sheet with `entryPoint:"session_review"` and
   the saved session id. It must be a no-op addition when the coach is
   unconfigured (nothing renders), and it must never open the sheet
   automatically.

**Verify**: all three paths open the sheet pre-seeded; with the coach
unconfigured, the Stats button still opens the sheet (setup pointer), and
the save flow shows no offer.

### Step 7: Lazy init + Log-tab protection

`coach.js` defines functions but builds no DOM and reads no storage until
the first `RepForgeCoach.open(...)` call (module-level work: constant
tables only). `render()`/`renderWorkout()` in `app.js` must not call into
`coach.js` except: (a) the one-line post-save offer check, (b) the
Settings block render. Measure nothing else on the Log path.

**Verify**: `rg -n "RepForgeCoach" app.js` shows only the agreed hooks;
Log tab renders identically with `coach.js` deleted from a scratch copy
(script tag tolerates absence via `window.RepForgeCoach?.` guards).

### Step 8: Attention-chip affordance

In `renderAttention` (`app.js:1357`), analysis-flavored groups (`reduce`,
`vol`, `fatigue`) get one extra small button per group (not per chip):
"Ask the coach why". Opens the sheet with `entryPoint:"attention"` and
`opts.exerciseIds` for that group. Action groups (`add`, `new`, `stale`)
keep plan 034's Log navigation untouched — do not modify their handler.

**Verify**: simulation checks from plan 034 still pass unchanged.

### Step 9: Service worker + i18n

1. `sw.js`: add `./coach.js` to `ASSETS`, `"/coach.js"` to `SHELL`, bump
   `CACHE` to the next version. The non-GET early-return stays byte-for-byte.
2. All new strings → `i18n-en.json`, `i18n-pt.json`, and both `EN`/`PT`
   objects in `i18n.js`. PT copy must be real Portuguese, not English
   duplicates (follow the tone of existing `pt` entries).

**Verify**: hard-reload with DevTools → Application → SW updated; UI in
PT shows translated coach copy (`Settings → language`).

### Step 10: Simulation coverage (mock provider)

In `test/simulation.mjs`:

1. **Mock provider**: start a tiny `node:http` server on a free port
   inside the simulation that implements POST `/v1/chat/completions`:
   responds with `text/event-stream` chunks streaming a canned reply that
   includes one valid ```` ```repforge-proposal ```` block
   (`update_exercise` reducing sets of a known seeded exercise) and one
   invalid block (unknown op). No new npm dependency.
2. **Flow checks** (configure the Custom preset at the mock's URL via the
   Settings UI, consent, then):
   - consent gate appears exactly once;
   - a question streams a reply into the sheet (assert incremental text);
   - exactly one proposal card renders; the invalid block renders as text;
   - Apply mutates the program (assert via `state.program` in
     `page.evaluate`), survives reload;
   - Dismiss leaves the program untouched.
3. **Security/regression checks**:
   - Export backup JSON (grab the blob text in-page) contains neither the
     configured key string nor `repforge_coach`;
   - context payload (call `RepForgeCoach.buildCoachContext` via
     `page.evaluate`) has no `bodyweight` by default and includes it with
     the toggle on;
   - `validateProposal` rejects: unknown `op`, unresolvable `id`,
     `sets:0`, `repHigh:99`, extra fields;
   - nav still has exactly five buttons; Log view renders with the coach
     never opened;
   - Delete log clears chat but keeps the key; Disconnect clears both.
4. Update any existing checks broken by new DOM (e.g. settings-card
   counts) — if more than a handful break, STOP (coupling wider than
   mapped).

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥
baseline + ~15.

### Step 11: Manual smoke test (human step — document, don't automate)

With a real OpenRouter key (product owner supplies; free-tier model is
fine): one full conversation from each entry point on a phone-sized
viewport, one applied proposal, one PT-language pass. CI never holds
credentials; this stays a checklist item in the PR description.

## Test plan

- Pure functions: context builder (scoping, bodyweight toggle, budget),
  proposal parser/validator (valid + hostile inputs), apply path
  (id-preserving mutations through `Program`).
- Mock-provider end-to-end: consent → stream → proposal card → apply →
  persist → reload.
- Security: no key material in any export; no coach data inside
  `repforge_v1`.
- Guardrails: five tabs; Log tab clean of coach work when unopened;
  plan 034 chip behavior unchanged.
- Existing checks: everything else, `FAILED: 0`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` and `node --check coach.js` exit 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0`
- [ ] `rg -c "repforge_coach_v1" coach.js` ≥ 1 and `rg -c "repforge_coach" app.js` = 0 (store isolation)
- [ ] `rg -n "apiKey" app.js` returns nothing (key handling confined to `coach.js`)
- [ ] `rg -n '"/coach.js"' sw.js` and `rg -n '"./coach.js"' sw.js` each return 1 match; `CACHE` version bumped
- [ ] `nav` in `index.html` still declares exactly five `data-view` buttons
- [ ] Every `coach.*` i18n key present in `i18n-en.json`, `i18n-pt.json`, and both dictionaries in `i18n.js` (spot-check with `rg -c '"coach\.' i18n-en.json i18n-pt.json i18n.js`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Product decisions" item above would be violated (a backend, OAuth,
  a sixth tab, auto-applied proposals, key inside `state`, log mutations
  from proposals, tool-calling, user-facing model field on hosted presets).
- `COACH_MODELS` launch slugs are needed and the product owner has not
  supplied them (placeholder is fine for review, but flag it).
- The current-state excerpts have drifted (see drift check).
- The mock-provider approach requires a new npm dependency or Playwright
  request interception that fights the SSE stream — report before working
  around.
- More than ~5 existing simulation checks break.
- The sheet cannot meet basic a11y (focus trap/escape/restore) without
  reworking the app's dialog pattern — report; do not invent a second
  dialog system.
- Streaming via `fetch` ReadableStream fails on the iOS-Safari-like
  Playwright WebKit profile if you test there (chromium is the gate; note
  WebKit issues, don't block on them).

## Maintenance notes

- `COACH_MODELS` is the product-owned model pin (decision 4); changing a
  hosted preset's model is a one-line release, and cost-per-conversation
  estimates should accompany any change.
- The fenced-proposal schema is versionless in v1; if ops are ever added,
  version the fence tag (```` ```repforge-proposal@2 ````) rather than
  silently widening validation.
- The OpenRouter OAuth PKCE flow ("Sign in with OpenRouter") is the
  planned fast-follow for mobile key UX; the config store already carries
  provenance-ready shape (a `keySource` field can be added additively).
- Deferred deliberately: proposal audit trail/undo, multi-conversation
  history, training-day-level ops, progression-settings ops, streaming
  abort button, per-conversation model override.
- Reviewer should scrutinize: prompt-injection surface (exercise names
  and notes are user text that enters the system prompt — the validator,
  not the prompt, is the security boundary); SSE parser on slow
  connections (partial `data:` lines across chunks); the post-save offer
  not delaying `saveWorkout`'s hot path.
