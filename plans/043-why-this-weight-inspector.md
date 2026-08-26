# Plan 043: "Why this weight?" — on-demand recommendation inspector

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4e3d044..HEAD -- app.js index.html styles.css sw.js i18n-en.json i18n-pt.json i18n.js test/simulation.mjs test/accessibility.mjs test/i18n.mjs tools/capture-ui-screens.mjs`
> If any in-scope file changed since `4e3d044` (the commit the excerpts were
> taken at), compare the "Current state" excerpts against the live code
> before proceeding; on a mismatch, treat it as a STOP condition. (Match on
> code, not on line numbers.)

## Status

- **Priority**: P1 (pre-launch — the go-to-market positioning leads with the
  engine's legibility)
- **Effort**: M
- **Risk**: MED (touches the Log-tab render path and adds a modal surface;
  engine arithmetic itself is read-only)
- **Depends on**: none open (plan 039 is DONE; independent of plan 038)
- **Category**: direction / dx
- **Planned at**: commit `4e3d044`, 2026-08-20. Baseline verified:
  `node --check app.js` clean, `node tools/build-i18n.mjs --check` clean
  (1181 keys), simulation `PASSED: 917, FAILED: 0`.
- **Source**: product-owner go-to-market session (2026-08-20): the capacity
  engine is the product's differentiator and must not read as a magic
  number. This is the deliberate follow-up to plan 039's decision 8, which
  shipped reason-tagged one-liners and explicitly deferred an inspector
  ("No inspector panel in v1").

## Product decisions (locked — do not re-litigate)

1. **On-demand only; inline copy is untouched.** Plan 039's decision 8
   ("copy names the signal, not the arithmetic") continues to govern every
   inline string: the `rec.*` texts, `log.insession.*` notes, chips, and
   heat gauge do not change by one byte. The sheet this plan adds is the
   sanctioned place where the arithmetic may appear, because the user asked
   for it by tapping.
2. **One brain.** The sheet renders fields the engine attaches to its own
   result (`recommendation()` gains additive fields in Step 1). It never
   re-derives a trigger in parallel. If the sheet needs a number the engine
   didn't attach, attach it — do not recompute the condition.
3. **Deterministic engine only.** Managed Taurifer AI (ADR 0011) is a later,
   separate surface and out of scope here.
4. **No new settings, no new tab, no render-path cost.** The sheet's content
   is built on tap, never during `renderWorkout`. The only render-path
   addition is one static button per card. Log-tab speed remains the top
   guardrail.
5. **Hidden for new lifts.** `status:"new"` has no history and no
   arithmetic; the button does not render there.
6. **Voice.** Facts in sentences, second person, sentence case, no
   exclamation marks, no em dashes in app prose, both languages together —
   `docs/brand-guide.md` "Voice and copy" applies to every new string.

## Why this matters

The recommendation is Taurifer's entire differentiation over notebook-style
loggers, and today it reads as an unexplained number: the recblock shows
"Hold 62.5 kg" plus one generic status sentence, and the ghost values fill
themselves in. A lifter who doubts one surprising target has no way to see
that it follows from their own logged sets, so they stop trusting — and
stop following — the engine. One tap from any stated target to its
arithmetic (last session's sets, the demonstrated capacity, the rule that
fired, the load and rep derivation, any tempering) converts the engine from
oracle to arithmetic. This surface is also the demo centerpiece for launch
marketing.

## Current state

All in `app.js` unless noted. Static PWA, no build step, no framework.

`app.js:2897-2936` — `recommendation(ex)`, the between-session engine
(capacity-driven since plan 039 / ADR 0003). The trigger chain, in order —
note which branch fires is currently not recorded on the result:

```javascript
const medCap=l.medCap,cr=repsAtLoad(medCap,load);
const rec=(()=>{
  if(cr>=ex.max+CAPACITY.bigJumpMargin)return{status:"add2",heat:1,label:t("rec.add2.label"),text:t("rec.add2.text"),load:round(load+jump(load,2)),stalled:false,pushReps:false};
  // Capacity extends the jump; performed reps at the top still fire it on their own.
  if(allTop||nearTop||cr>=ex.max+CAPACITY.jumpMargin)return{status:"add",heat:.82,...,load:round(load+jump(load,1)),...};
  // Back off only when capacity itself falls short of the range — stopping early is not failing.
  if(cr<ex.min)return{status:"reduce",heat:.18,...,load:Math.max(round(load-jump(load,1)),+state.settings.minJump||2.5),...};
  const holdLoad=Math.max(round(load),+state.settings.minJump||2.5);
  if(stalled)return{status:"reduce",heat:.3,label:t("rec.stalled.label"),...,load:holdLoad,stalled:true,...};
  if(recoverSignal(ex,sess))return{status:"hold",heat:.42,label:t("rec.recover.label"),...,load:holdLoad,...};
  if(cr-l.medReps>=CAPACITY.pushGap&&cr<=ex.max)return{status:"hold",heat:.6,label:t("rec.push_reps.label"),...,load:holdLoad,...,pushReps:true};
  return{status:"hold",heat:.48,label:t("rec.hold_add_reps.label"),...,load:holdLoad,...,pushReps:true};
})();
const trend=blockTrendFor(sess);
if(rec.status==="add2"&&trend.dir==="falling"){rec.status="add";rec.heat=.82;rec.label=t("rec.add.label");
  rec.text=t("rec.add.tempered.text");rec.load=round(load+jump(load,1))}
rec.block=trend;rec.blockNote=blockTrendNote(trend);
rec.cap=medCap;rec.typRir=typicalRir(ex,sess);
rec.reenterReps=rec.status==="add"||rec.status==="add2"||rec.status==="reduce"||!sameLoad(rec.load,load);
return rec;
```

`app.js:2938-2950` — the rep-target derivation the sheet must narrate:

```javascript
const reentryReps=(ex,cap,load,typRir)=>clamp(Math.round(repsAtLoad(cap,load)-(+typRir||0)),ex.min,ex.max);
function baseSetReps(ex,rec,old){
  if(rec.reenterReps)
    return rec.cap>0&&rec.load>0?reentryReps(ex,rec.cap,rec.load,rec.typRir):ex.min;
  const prev=old&&+old.reps>0?+old.reps:null;
  if(prev==null)return ex.min;
  if(!rec.pushReps)return clamp(prev,ex.min,ex.max);
  return clamp(prev+1,ex.min,ex.max)}
```

`app.js:2838-2839` — `sameLoad` and the jump formula (`jump` is
`max(load*jumpPct*mult/100, minJump)`, so a small percentage on a light
load is dominated by the `minJump` step — the sheet's load copy branches
on this):

```javascript
const sameLoad=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<=LOAD_EPS;
function jump(load,mult){return Math.max(load*(+state.settings.jumpPct||0)*mult/100,+state.settings.minJump||2.5)}
```

`app.js:2734-2737` — `last(ex)`: the most recent session's rows for this
lift, ordered by set. The Log card's "Last set" line already renders from
it (`app.js:4135`, via `fmtLoad` and `effortOrRirLabel`); the sheet reuses
the same source and formatters.

`app.js:3061-3075` — `inSessionNote(ex,draft)`: returns one localized
sentence (or `""`) describing how today's committed sets steer the next
unlogged set. The sheet embeds this verbatim; its keys
(`log.insession.*`) do not change.

`app.js:4167-4181` — the Log list card's recommendation block (inside
`renderWorkout`), where the primary affordance goes:

```javascript
const recHead=r.load!=null?t("today.rec_keep",{load:fmtLoad(r.load),unit:unitLabel()}):r.label;
const recBlock=`<div class="recblock is-${r.status}"><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
  `<div class="recblock__head">${esc(recHead)}</div><p class="recblock__body">${esc(r.text)}</p>${blockHtml}</div>`;
```

`app.js:4092` — focus mode has no recblock; the target is one line inside
`focusCardHtml` (peek copies wrap their buttons with `dead()` — follow
that pattern):

```javascript
`<p class="focus-ex__target"><span class="focus-ex__alvo">${esc(t("today.target_label"))}</span>${esc(targetText(ex))}</p>`
```

`app.js:5556-5560` — the exercise-detail recommendation block (inside the
exercise view render; `data-term` bindings for this view are at
`app.js:5599`):

```javascript
const recHtml=rec?`<div class="recblock is-${rec.status}"><div class="recblock__row"><div><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
  `<div class="recblock__head">${esc(rec.load!=null?t("today.rec_keep",{load:fmtLoad(rec.load),unit:unitLabel()}):rec.label)}</div>`+
  `<p class="recblock__body">${esc(rec.text)}</p></div>`+
  `<button type="button" class="link-accent" data-term="RIR">${esc(t("exercise.understand"))}</button></div></div>`:"";
```

`app.js:4328` — `$w`, the Log-tab binding helper (covers list cards and
the live focus card, excludes inert peeks):

```javascript
const $w=sel=>$$(`#workout ${sel}`).filter(el=>!el.closest(".is-peek"));
```

`app.js:1099-1147` — `openModal(el,opts)`: the one modal controller
(plan 041 policy: Escape cancels, outside click does nothing, focus is
trapped, background inert, `returnFocus` restored). Exemplar call with a
scrim: `app.js:7857` (`iosInstallSheet`). Sheet markup exemplar,
`index.html:659-660`:

```html
<div id="iosInstallScrim" class="sheet-scrim hidden"></div>
<div id="iosInstallSheet" class="sheet sheet--install hidden" role="dialog" aria-modal="true" aria-labelledby="iosInstallTitle" hidden>
```

The glossary close button shows the shared close-label convention
(`index.html:532`): `data-i18n-aria="dialog.close"`.

**Precedent for "why" copy**: the block-review sheet already renders a
reason line — `recblock__why-lab` + `t("review.why")` ("Why:" / "Motivo")
at `app.js:2405`. This plan's sheet is that idea, expanded to the per-lift
recommendation.

**i18n contract**: user-facing strings live in `i18n-en.json` +
`i18n-pt.json`; `i18n.js` is **generated** — edit the two catalogs, then
run `node tools/build-i18n.mjs` (never edit `i18n.js` by hand; plan 039's
"kept in sync by hand" note predates the generator). `test/i18n.mjs`
enforces key parity, placeholder parity, PT tone (você, no calques, banned
loanwords; allowed: backup, timer, deload, PR, RIR, e1RM), and
number/gender agreement.

**Service-worker contract** (`AGENTS.md`): `sw.js` `CACHE` is
`repforge-v108` today; `ASSETS` carries `./app.js?v=108` and
`./shared-setup.js?v=108`, and `index.html:884-885` loads both scripts
with `?v=108`. Any change to cached shell files bumps all three numbers
together; `test/exercise-library.mjs:234-237` holds them in lockstep.

**UI screen catalog contract** (`AGENTS.md`, `docs/ui-screens/README.md`):
a new user-visible surface must be captured into `docs/ui-screens/light/`
and `dark/` by `tools/capture-ui-screens.mjs` (32 screens today; this plan
adds screen 33). The folder README is **regenerated by the script** from
its internal `LABELS` map (`tools/capture-ui-screens.mjs:32-40`,
`writeReadme()` at `:677-733`) — never hand-edit the README; add the new
screen to `LABELS` and let the run rewrite it.

**Dynamic i18n keys are enumerated** (`test/i18n.mjs:160-195,467-473`):
any `t("prefix."+variable)` concatenation must have its family listed in
`DYNAMIC_FAMILIES` in `test/i18n.mjs`, or the i18n gate fails. Step 2
introduces `t("why.rule."+rec.reason,...)`, so Step 5 adds the family.

## Commands you will need

Run from the repo root unless noted. Bootstrap once in a fresh checkout:
`(cd test && npm ci && npx playwright install chromium --with-deps)`.

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Regenerate runtime i18n | `node tools/build-i18n.mjs` | rewrites `i18n.js`, exit 0 |
| i18n drift gate | `node tools/build-i18n.mjs --check` | "matches the catalogs", exit 0 |
| Static server (terminal 1) | `python3 -m http.server 8000` | serves on :8000 |
| i18n tone/parity gate | `cd test && node i18n.mjs` | `FAILED: 0`, exit 0 |
| Shell/revision lockstep | `cd test && node exercise-library.mjs` | `FAILED: 0`, exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Quick sim while iterating | `cd test && REPFORGE_SIM_WEEKS=12 node simulation.mjs` | `FAILED: 0` |
| Accessibility gate | `cd test && node accessibility.mjs` | `FAILED: 0`, exit 0 |
| UI catalog | `node tools/capture-ui-screens.mjs` | rewrites both theme folders + README |

## Suggested executor toolkit

- Read `docs/brand-guide.md` §"Voice and copy" before writing any string.
- Read ADR 0003 (`docs/adr/0003-capacity-as-progression-currency.md`) for
  the capacity vocabulary this sheet narrates.
- Skim plan 039's Step 5 for how the reason-tagged one-liners were wired —
  this plan deliberately leaves them alone.

## Scope

**In scope** (the only files you should modify):

- `app.js` — additive fields on `recommendation()`, the sheet builder,
  open/close wiring, three button placements, bindings.
- `index.html` — `#whyScrim` + `#whySheet` markup; the two `?v=` script
  revisions.
- `styles.css` — sheet content styles (token-named colours only; dark is a
  token swap, per ADR 0009).
- `i18n-en.json`, `i18n-pt.json` — new `why.*` keys; then regenerate
  `i18n.js` with the build tool.
- `sw.js` — `CACHE` bump + the two `?v=` entries in `ASSETS`.
- `test/simulation.mjs`, `test/accessibility.mjs` — new checks.
- `test/i18n.mjs` — one addition to `DYNAMIC_FAMILIES` (the `why.rule.`
  family); nothing else in that file.
- `tools/capture-ui-screens.mjs` (new `LABELS` entry + capture step),
  `docs/ui-screens/README.md` (regenerated by the script, committed),
  `docs/ui-screens/light/*.png`, `docs/ui-screens/dark/*.png` — screen 33.
- `plans/README.md` — status row.

**Out of scope** (do NOT touch, even though they look related):

- Every trigger condition, threshold, constant, and load/rep formula in
  `recommendation`, `baseSetReps`, `setSuggestion`, `sessionFreshness`,
  `expectedSetDrop`, `isStalled`, `recoverSignal`, `blockTrendFor`. This
  plan attaches fields; it changes no behavior. If an existing simulation
  progression assertion fails, you changed behavior — STOP.
- The inline copy: all `rec.*` and `log.insession.*` values stay
  byte-identical in both catalogs.
- The block-review sheet's own "Why:" line (`app.js:2405`) — different
  surface, already legible.
- The glossary popover mechanism (reused as-is, not extended).
- Plan 038 coach surfaces; Settings; `exercises.js`; `shared-setup.js`.

## Git workflow

- Branch: `cursor/plan-043-why-this-weight-<suffix>`.
- Commit style: single-line imperative summary; one commit per logical
  step is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Attach explanation fields to `recommendation()` (additive only)

In each branch of the trigger chain (`app.js:2912-2926`) and the temper
block (`app.js:2930-2931`), attach fields that record what happened —
extend the returned object literals; do not restructure the chain:

- `reason` — one of `"top"` (the `add` branch when `allTop||nearTop`,
  which takes naming precedence), `"cap_top"` (the `add` branch
  otherwise), `"cap_top2"` (add2), `"below_range"` (the below-range
  reduce), `"stalled"`, `"recover"`, `"push_reps"`, `"hold"`. The `new`
  early return gets `reason:"new"`.
- `jumpMult` — `2` on add2, `1` on add and on the below-range reduce;
  unset elsewhere. In the falling-block temper block, set `jumpMult=1`
  and `temperedBlock=true` (leave `reason` as `"cap_top2"`).
- After the chain, next to the existing `rec.cap=...` line, also attach
  `rec.cr=cr`, `rec.lastLoad=load`, and `rec.lastMedReps=l.medReps`.

Nothing reads these fields yet. The `add` branch needs its single `return`
split only enough to know which disjunct fired — e.g. compute
`const topFloor=allTop||nearTop;` before the chain and use
`reason:topFloor?"top":"cap_top"` inside the branch condition
`topFloor||cr>=ex.max+CAPACITY.jumpMargin`.

**Verify**: `node --check app.js` → exit 0. Then
`cd test && REPFORGE_SIM_WEEKS=12 node simulation.mjs` → `FAILED: 0`
(the fields are additive; any failure means behavior changed — STOP).

### Step 2: The explanation builder (pure, tap-time)

Add `explainRecommendation(ex)` near `inSessionNote` (`app.js:3061`). It
takes the *session* exercise (substitution applied — callers pass
`sessionExercise(prog.find(id))`), calls `recommendation(ex)`, `last(ex)`,
and `loadDraft()`, and returns an ordered array of
`{label?, text}` rows. No DOM access, no listeners — testable via
`page.evaluate`. Rows, in order:

1. **Last session** — label `t("why.last")`; text = the session's working
   sets joined with `" · "`, built with the same helpers the card's prev
   line uses (`app.js:4135` — that line additionally wraps the RIR part in
   `<small>`; the sheet row is plain text):
   `` `${fmtLoad(x.load)}×${x.reps} ${effortOrRirLabel(x.rir)}` ``.
2. **What it showed** — `t(isEffortMode()?"why.showed_effort":"why.showed",
   {cr:Math.round(rec.cr), load:fmtLoad(rec.lastLoad), unit:unitLabel(),
   cap:fmt(+state.settings.hardRir||4)})`.
3. **The rule** — when `rec.temperedBlock`, reuse the existing
   `t("rec.add.tempered.text")` verbatim (it already states the tempering);
   otherwise `t("why.rule."+rec.reason, {...})` with the interpolations
   from the copy table in Step 5 (`max:ex.max`, `min:ex.min`,
   `cr:Math.round(rec.cr)`, `margin:CAPACITY.bigJumpMargin`,
   `gap:Math.round(rec.cr-rec.lastMedReps)`).
4. **The load** — branch on the move:
   - Load increased (`reason` is `top`/`cap_top`/`cap_top2`): compute
     `const minJ=+state.settings.minJump||2.5, pct=(+state.settings.jumpPct||0)*(rec.jumpMult||1), raw=rec.lastLoad*pct/100;`
     and use `t(raw>minJ?"why.load_up":"why.load_up_step", {prev:fmtLoad(rec.lastLoad), pct:fmt(pct), step:fmtLoad(minJ), load:fmtLoad(rec.load), unit:unitLabel()})`.
   - Load decreased (`reason==="below_range"`): same computation with
     `why.load_down` / `why.load_down_step`.
   - Hold family with `sameLoad(rec.load,rec.lastLoad)`:
     `t("why.load_hold",{load:fmtLoad(rec.load),unit:unitLabel()})`.
   - Hold family otherwise (median off the grid, snapped by `round`):
     `t("why.load_snap",{step:fmtLoad(minJ),load:fmtLoad(rec.load),unit:unitLabel()})`.
5. **The reps** — branch on the policy `baseSetReps` applies:
   - `rec.reenterReps`: `t(isEffortMode()?"why.reps_effort":"why.reps",
     {load:fmtLoad(rec.load), unit:unitLabel(),
     pred:Math.round(repsAtLoad(rec.cap,rec.load)), typrir:fmt(rec.typRir),
     reps:reentryReps(ex,rec.cap,rec.load,rec.typRir)})`.
   - else `rec.pushReps`: `t("why.reps_chase",{min:ex.min,max:ex.max})`.
   - else (recover hold): `t("why.reps_hold")`.
6. **Block trend** — when `rec.blockNote` is non-empty and
   `rec.temperedBlock` is falsy (the tempered line already told this
   story), a row with text `rec.blockNote`.
7. **This session** — when `inSessionNote(ex,loadDraft())` returns a
   non-empty string, label `t("why.session")` and that string verbatim.

**Verify**: `node --check app.js` → exit 0. `app.js` is a classic
top-level script, so on a seeded install the function is reachable from
the DevTools console: `explainRecommendation(sessionExercise(state.program[0]))`
returns the ordered rows with real numbers. Do not add any new
`window.__repforge*` hook for this — the simulation drives the real UI.

### Step 3: Sheet markup, styles, open/close

In `index.html`, next to the iOS install sheet (`index.html:659`), add:

```html
<div id="whyScrim" class="sheet-scrim hidden"></div>
<div id="whySheet" class="sheet sheet--why hidden" role="dialog" aria-modal="true" aria-labelledby="whyTitle" hidden>
  <span class="sheet__grab" aria-hidden="true"></span>
  <div class="whysheet">
    <div class="whysheet__head">
      <h2 class="whysheet__title" id="whyTitle" data-i18n="why.title">Why this weight</h2>
      <button type="button" class="whysheet__close" id="whyClose" data-i18n-aria="dialog.close" aria-label="Close">✕</button>
    </div>
    <p class="whysheet__target" id="whyTarget"></p>
    <div class="whysheet__body" id="whyBody"></div>
  </div>
</div>
```

In `app.js`, add `openWhySheet(exId, opener)` + `closeWhySheet()` near the
other sheet controllers (e.g. beside the iOS install sheet wiring,
`app.js:7857`):

- Resolve `const ex=sessionExercise(prog.find(exId)); if(!ex)return;`
- Fill `#whyTarget` with the same headline the recblock shows
  (`rec.load!=null ? t("today.rec_keep",{load:fmtLoad(rec.load),unit:unitLabel()}) : rec.label`).
- Fill `#whyBody` from `explainRecommendation(ex)`: each row becomes
  `<div class="whysheet__row">` with an optional
  `<span class="whysheet__lab">` label and a `<p>` text — build with the
  existing `esc()`; payloads are user data.
- Open by mirroring `openIosInstallSheet` (`app.js:7851-7859`)
  **completely**: `document.body.classList.add("is-sheet-open")`, then
  `openModal(sheet,{initialFocus:$("#whyClose"),returnFocus:opener,onEscape:closeWhySheet,scrim:$("#whyScrim"),delayHide:reducedMotion()?0:280})`,
  then `requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})`.
  The CSS keeps every `.sheet` at `translateY(101%)` and every
  `.sheet-scrim` at opacity 0 until `is-open` lands
  (`styles.css:1232-1248`) — skipping this leaves the sheet parked
  off-screen while every focus/Escape check still "passes".
- `closeWhySheet` mirrors `closeIosInstallSheet` (`app.js:7860-7864`): a
  guard, then `closeModal(sheet)` — `hideModalElement`
  (`app.js:1077-1079`) already removes `is-open` from sheet and scrim and
  `is-sheet-open` from body; do not remove them by hand.
- `#whyClose` click → `closeWhySheet()`.

In `styles.css`: style `.sheet--why`, `.whysheet__head/__title/__close`,
`.whysheet__target` (the headline, mono numerals inherit from context),
`.whysheet__row` (hairline-separated stack — use `--rule`),
`.whysheet__lab` (muted label, mirror `.recblock__lab`). Name tokens only
(`--bg`, `--ink`, `--rule`, `--accent`); no hex literals, no shadows, per
`docs/brand-guide.md` and ADR 0009 — dark must come along for free.

**Verify**: `node --check app.js` → exit 0. Serve + hard-reload; in
DevTools run `openWhySheet(state.program[0].id)` on a seeded install: the
sheet opens over the app, Escape closes it, and in dark appearance it
renders charcoal/ink without any hand-picked dark colour.

### Step 4: The three affordances

One visible label, `t("why.open")`, aria label
`t("why.open_aria",{name})` where `name` is the displayed (possibly
substituted) exercise name. Render it **only when `r.status!=="new"`**.

1. **Log list card** — inside `recBlock` (`app.js:4168-4169`), after
   `${blockHtml}`:
   `<button type="button" class="text-link recblock__why" data-why="${esc(ex.id)}" aria-label="...">${esc(t("why.open"))}</button>`.
2. **Focus card** — in `focusCardHtml` (`app.js:4092`), directly after the
   `.focus-ex__target` paragraph, the same button with the peek guard the
   neighbouring buttons use (see the note-tool button at `app.js:4073-4074`):
   `` ${peek?dead():` data-why="${esc(ex.id)}"`} ``.
3. **Exercise detail** — in `recHtml` (`app.js:5557-5560`), add the same
   button beside the existing `exercise.understand` link inside
   `.recblock__row` (keep both; they answer different questions).

Bindings:

- In `bindWorkout`, next to the `.term` binding (`app.js:4336`):
  `$w("[data-why]").forEach(b=>b.onclick=e=>{e.stopPropagation();openWhySheet(b.dataset.why,b)});`
  — `$w` already covers list cards and the live focus card and excludes
  peeks.
- In the exercise view render, next to its `data-term` binding
  (`app.js:5599`): bind `#exDetail [data-why]` the same way.

**Verify**: serve + hard-reload. On a seeded install: the button shows on
every Log list card except never-trained lifts; tapping opens the sheet
with that lift's numbers; same from focus mode (live card only — swiping
shows no tappable button on peeks) and from the exercise detail page.
Close returns focus to the exact button (watch the focus ring).

### Step 5: i18n — the `why.*` catalog

Add to `i18n-en.json` and `i18n-pt.json` (both together, same keys), then
run `node tools/build-i18n.mjs`. Copy is locked below — deviations must
still obey the brand guide (sentence case, no exclamation marks, no em
dashes, placeholders in lowercase curly braces, PT uses você and real
Portuguese; RIR and reps are accepted loanwords; "carga" for load,
"faixa" for range, "série" for set, "sessão" for session).

| Key | English | Portuguese |
| --- | --- | --- |
| `why.open` | Why this weight? | Por que essa carga? |
| `why.open_aria` | Why this weight for {name} | Por que essa carga para {name} |
| `why.title` | Why this weight | Por que essa carga |
| `why.last` | Last session | Última sessão |
| `why.session` | This session | Esta sessão |
| `why.showed` | Counting reps plus up to {cap} RIR, your sets showed about {cr} reps at {load} {unit}. | Contando reps mais até {cap} RIR, suas séries mostraram cerca de {cr} reps com {load} {unit}. |
| `why.showed_effort` | Counting reps plus the effort you logged, your sets showed about {cr} reps at {load} {unit}. | Contando reps mais o esforço registrado, suas séries mostraram cerca de {cr} reps com {load} {unit}. |
| `why.rule.top` | Every set reached the top of the range, {max} reps. The load goes up. | Todas as séries chegaram ao topo da faixa, {max} reps. A carga sobe. |
| `why.rule.cap_top` | The range tops out at {max} reps and you showed about {cr}. The load goes up. | O topo da faixa é {max} reps e você mostrou cerca de {cr}. A carga sobe. |
| `why.rule.cap_top2` | You showed about {cr} reps, at least {margin} above the range top of {max}. The larger increase applies. | Você mostrou cerca de {cr} reps, pelo menos {margin} acima do topo da faixa de {max}. O aumento maior se aplica. |
| `why.rule.below_range` | Your sets showed fewer than {min} reps, the bottom of the range. The load comes down. | Suas séries mostraram menos de {min} reps, o piso da faixa. A carga desce. |
| `why.rule.stalled` | Three sessions at the same load without new reps. Use a lighter load for one session, or add one set. | Três sessões com a mesma carga e sem reps novas. Use uma carga mais leve por uma sessão, ou adicione uma série. |
| `why.rule.recover` | Hard sets without new reps. The load holds while you recover. | Séries pesadas sem reps novas. A carga se mantém enquanto você se recupera. |
| `why.rule.push_reps` | You showed about {gap} more reps than you performed. Add reps before load. | Você mostrou cerca de {gap} reps a mais do que executou. Adicione reps antes de carga. |
| `why.rule.hold` | The range still has room, so the load stays while reps climb. | A faixa ainda tem espaço, então a carga fica enquanto as reps sobem. |
| `why.load_up` | New load: {prev} {unit} plus {pct}%, rounded to the nearest {step} {unit}: {load} {unit}. | Nova carga: {prev} {unit} mais {pct}%, arredondado para o passo de {step} {unit}: {load} {unit}. |
| `why.load_up_step` | New load: {prev} {unit} plus one {step} {unit} step: {load} {unit}. | Nova carga: {prev} {unit} mais um passo de {step} {unit}: {load} {unit}. |
| `why.load_down` | New load: {prev} {unit} minus {pct}%, rounded to the nearest {step} {unit}: {load} {unit}. | Nova carga: {prev} {unit} menos {pct}%, arredondado para o passo de {step} {unit}: {load} {unit}. |
| `why.load_down_step` | New load: {prev} {unit} minus one {step} {unit} step: {load} {unit}. | Nova carga: {prev} {unit} menos um passo de {step} {unit}: {load} {unit}. |
| `why.load_hold` | The load stays at {load} {unit}. | A carga continua em {load} {unit}. |
| `why.load_snap` | Logged loads sit off the {step} {unit} step, so the target rounds to {load} {unit}. | As cargas registradas fogem do passo de {step} {unit}, então a meta arredonda para {load} {unit}. |
| `why.reps` | At {load} {unit}, about {pred} reps are within reach. Minus your usual {typrir} RIR, sets start at {reps} reps. | Com {load} {unit}, cerca de {pred} reps estão ao seu alcance. Menos seu RIR habitual de {typrir}, as séries começam com {reps} reps. |
| `why.reps_effort` | At {load} {unit}, about {pred} reps are within reach. At your usual effort, sets start at {reps} reps. | Com {load} {unit}, cerca de {pred} reps estão ao seu alcance. No seu esforço habitual, as séries começam com {reps} reps. |
| `why.reps_chase` | Keep the load and aim for one more rep than last time, inside {min}-{max}. | Mantenha a carga e busque uma rep a mais que a última vez, dentro de {min}-{max}. |
| `why.reps_hold` | The rep target stays where it was. | A meta de reps continua onde estava. |

(`why.rule.new` is deliberately absent — the button never renders for new
lifts, decision 5.)

Then register the dynamic family: in `test/i18n.mjs`, add a `why.rule.`
entry to `DYNAMIC_FAMILIES` (`test/i18n.mjs:168-195`) enumerating exactly
the eight `why.rule.*` keys above, following the shape of the existing
entries. Without it, the gate fails on Step 2's
`t("why.rule."+rec.reason,...)` concatenation. Change nothing else in
that file.

**Verify**: `node tools/build-i18n.mjs` → exit 0, then
`node tools/build-i18n.mjs --check` → "matches the catalogs".
`cd test && node i18n.mjs` → `FAILED: 0` (tone, parity, placeholders,
dynamic families).

### Step 6: Service-worker cache bump

`sw.js`: `CACHE` `repforge-v108` → `repforge-v109`; in `ASSETS` change
`./shared-setup.js?v=108` → `?v=109` and `./app.js?v=108` → `?v=109`.
`index.html:884-885`: both `?v=108` script URLs → `?v=109`.

**Verify**: `cd test && node exercise-library.mjs` → `FAILED: 0` (the
lockstep check reads all three numbers).

### Step 7: Simulation + accessibility coverage

`test/simulation.mjs` — add a phase after the existing capacity checks.
Seed deterministic histories by writing rows shaped like the delta phase's
`seedRows` (`test/simulation.mjs:7390-7404` — include `session`, `date`,
`day`, `name`, `exerciseId`, `set`, `load`, `reps`, `rir`, `notes`,
`created`, and the muscle snapshot `primary`/`secondary`) through the
existing `getState`/`persistState` helpers, then reload and drive the UI.
Checks to add (model each `assert` on the F1 block at
`test/simulation.mjs:3685-3695`):

1. **cap_top**: seed one 6-8 lift whose last session is 2×(100×6 @ RIR 3)
   → card shows the why button; click `[data-why]` → `#whySheet` is
   visible and `#whyBody` text contains the interpolated
   `why.rule.cap_top` (assert on "tops out at 8" and "about 9"), and the
   load row shows the engine's own `rec.load` (read it via
   `page.evaluate` from `recommendation` on the seeded lift rather than
   hard-coding).
2. **top**: seed 3×(100×8 @ RIR 1) → rule text is `why.rule.top`
   ("Every set reached the top").
3. **below_range**: seed 2×(100×4 @ RIR 0) → rule text is
   `why.rule.below_range` and the load row is a `why.load_down*` string.
4. **new lift hidden**: a never-trained lift's card contains no
   `[data-why]`.
5. **Escape + focus return**: open from a list card, press Escape →
   `#whySheet` hidden and `document.activeElement` is the opener button.
6. **PT**: switch language, reopen → button text "Por que essa carga?"
   and a PT rule string.
7. **Effort mode**: switch `rirMode` to effort, reopen → body contains the
   `why.showed_effort` rendering.
8. **Exercise detail**: open the same lift's detail page → `[data-why]`
   present, click → sheet opens.

`test/accessibility.mjs` — add a block modeled on the Exercise Note block
(`test/accessibility.mjs:757-775`): open the sheet from the Log tab,
assert initial focus is `#whyClose`, Tab wraps inside, background is
inert, Escape hides the sheet, inertness is restored, and focus returns to
the exact `[data-why]` opener.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED grows
by the new checks and **no existing assertion was edited**;
`cd test && node accessibility.mjs` → `FAILED: 0`.

### Step 8: UI screen catalog

In `tools/capture-ui-screens.mjs`:

1. Add `"33-why-this-weight": "Why this weight sheet"` to the `LABELS`
   map (`tools/capture-ui-screens.mjs:32-40`). The script's
   `writeReadme()` regenerates `docs/ui-screens/README.md` (table and
   footer count) from that map plus the PNGs on disk — do **not**
   hand-edit the README; the run rewrites it.
2. After the `03-workout-list` capture (`tools/capture-ui-screens.mjs:283`),
   add: click the first `#workout [data-why]`, wait for `#whySheet` to be
   visible **and** carry `is-open`, `shot(page, theme,
   "33-why-this-weight")`, then close it (Escape) and wait for it to hide
   before the next capture.

Then serve the app and run `node tools/capture-ui-screens.mjs`; commit the
regenerated PNGs in both theme folders and the regenerated README (never
hand-edit either).

**Verify**: the script exits 0; `git status` shows
`docs/ui-screens/light/33-why-this-weight.png` and
`docs/ui-screens/dark/33-why-this-weight.png` created; the regenerated
`docs/ui-screens/README.md` table has 33 rows and the footer says
"33 screens × 2 themes".

### Step 9: Manual smoke + index row

Serve, hard-reload (service-worker gotcha: after editing cached files a
normal reload may serve stale copies — unregister the worker or clear site
data if in doubt). Phone-sized viewport: log a full set on the Log tab,
open the sheet before and after committing sets (the "This session" row
appears once the in-session note exists), check dark appearance, check PT,
check focus mode. Update this plan's row in `plans/README.md` to DONE.

**Verify**: the core smoke flow from `AGENTS.md` still passes: fill a
set's kg/reps/RIR, Save workout, session summary opens, Stats and History
populate.

## Test plan

- New simulation checks (Step 7): one per rule family the seeds can reach
  deterministically (`cap_top`, `top`, `below_range`), the new-lift
  hidden-button rule, Escape/focus-return, PT rendering, effort-mode
  rendering, exercise-detail entry point. Model on the F1 block
  (`test/simulation.mjs:3685`).
- New accessibility block (Step 7): focus trap, inert background, Escape,
  focus restoration — model on the Exercise Note block.
- Existing suites stay green **without edits to existing assertions**:
  simulation, i18n, exercise-library, accessibility.
- Gates: `node --check app.js`; `node tools/build-i18n.mjs --check`;
  `cd test && node i18n.mjs && node exercise-library.mjs && node simulation.mjs && node accessibility.mjs`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `node tools/build-i18n.mjs --check` exits 0
- [ ] `rg -c '"why\.' i18n-en.json i18n-pt.json` → 25 and 25
- [ ] `rg -c 'why\.rule\.' app.js` ≥ 1 (builder reads the engine's `reason`) and
      `rg -c 'temperedBlock' app.js` ≥ 2 (set in the temper block, read by the builder);
      note `reason:` already appears 25 times in `app.js` at baseline for other
      subsystems, so do not grep for it bare — the Step 7 scenarios are the
      proof that every branch is tagged correctly
- [ ] `rg -n 'why\.rule\.new' i18n-en.json app.js` → no matches (decision 5)
- [ ] `rg -c 'data-why' app.js` ≥ 4 (three render sites + at least one binding)
- [ ] `grep -c 'repforge-v109' sw.js` → 1 and `grep -c '?v=109' index.html` → 2
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥ 917 + 8
- [ ] `cd test && node accessibility.mjs` → `FAILED: 0`
- [ ] `cd test && node i18n.mjs` → `FAILED: 0`
- [ ] `cd test && node exercise-library.mjs` → `FAILED: 0`
- [ ] `docs/ui-screens/{light,dark}/33-why-this-weight.png` exist; README table lists 33 screens
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any existing simulation assertion needs editing to pass — the engine's
  behavior must be byte-identical; this plan only attaches fields.
- The current-state excerpts have drifted (see the drift check).
- Adding the button inside `recBlock` breaks the `.recblock__head` scrapes
  the F1 simulation checks perform (Log card at `test/simulation.mjs:3679`,
  exercise page at `:3689`) — the button must be a sibling of the existing
  children, appended after `${blockHtml}`, never wrapped around them.
- The PT copy cannot pass `test/i18n.mjs` tone rules after two focused fix
  attempts — report the failing rule and strings; do not weaken the test.
- You find yourself adding a setting, a nav tab, per-render explanation
  work, arithmetic in the inline (`rec.*` / `log.insession.*`) strings, or
  any change to a trigger condition — all locked out by the Product
  decisions.
- `openModal` cannot host the sheet without modifying the controller —
  the policy table in plan 041 owns that file section; report instead.

## Findings (2026-08-21, post-implementation review)

Both amendments landed after the implementation PR's adversarial review. The
Step 5 copy table above records the copy as planned; the reworded strings below
supersede it for the seven keys named.

### Amended: the exercise page passes its own movement, not an id

Step 3 specified one entry point, `openWhySheet(exId, opener)`, resolving
`prog.find(exId)` → `sessionExercise(slot)`. That is right for the Log list and
focus cards, because `renderWorkout` already maps every slot through
`sessionExercise` before rendering. It is wrong for the exercise page:
`openExerciseView` renders the raw slot whenever the workout is not active, so a
slot substituted earlier in the session had the page showing the slot's
recommendation while the sheet showed the substitute's arithmetic — page
"Hold 102.5 kg" against a sheet headline of "New lift".

The resolver is now split. `openWhySheet(exId, opener)` is unchanged for the two
Log-tab callers; `openWhySheetFor(ex, opener)` takes an already-resolved
movement and is what the exercise page binds, passing the very object it fed to
`recommendation()`. That button's `aria-label` uses the page's displayed `name`
rather than the raw slot's. A simulation check drives the repro (swap, leave via
a nav tab, reopen from the Today list) and asserts the sheet headline equals the
page's recommendation headline.

### Amended: counts no longer sit on a singular-capable noun

The planned copy interpolated counts directly before "reps", which renders
"about 1 reps" once a count reaches 1. `{cr}` and `{pred}` reach 1 on near-max
work, and `{min}` / `{max}` reach 1 on a singles range (the program editor
accepts a positive integer, so 1-1 is a valid range). The i18n system has no
plural rules, so the fix is wording, not machinery: the count now falls at the
end of its clause or before a non-counting word.

| Key | English | Portuguese |
| --- | --- | --- |
| `why.showed` | Counting reps plus up to {cap} RIR, last session showed a rep capacity of about {cr} at {load} {unit}. | Contando reps mais até {cap} RIR, a última sessão mostrou uma capacidade de cerca de {cr} com {load} {unit}. |
| `why.showed_effort` | Counting reps plus the effort you logged, last session showed a rep capacity of about {cr} at {load} {unit}. | Contando reps mais o esforço registrado, a última sessão mostrou uma capacidade de cerca de {cr} com {load} {unit}. |
| `why.rule.top` | Every set reached the top of the range, which is {max}. The load goes up. | Todas as séries chegaram ao topo da faixa, que é {max}. A carga sobe. |
| `why.rule.cap_top` | The range tops out at {max} and your capacity showed about {cr}. The load goes up. | O topo da faixa é {max} e sua capacidade mostrou cerca de {cr}. A carga sobe. |
| `why.rule.below_range` | Your rep capacity fell below the range floor of {min}. The load comes down. | Sua capacidade em reps ficou abaixo do piso da faixa de {min}. A carga desce. |
| `why.reps` | At {load} {unit}, the rep capacity is about {pred}. Minus your usual {typrir} RIR, the rep target starts at {reps}. | Com {load} {unit}, a capacidade em reps é de cerca de {pred}. Menos seu RIR habitual de {typrir}, a meta de reps começa em {reps}. |
| `why.reps_effort` | At {load} {unit}, the rep capacity is about {pred}. At your usual effort, the rep target starts at {reps}. | Com {load} {unit}, a capacidade em reps é de cerca de {pred}. No seu esforço habitual, a meta de reps começa em {reps}. |

Placeholder sets are unchanged, so the builder needed no edit. Two counts still
sit on "reps" and are left alone because neither can be 1:
`why.rule.cap_top2`'s `{cr}` fires only at `cr >= ex.max + 3`, and
`why.rule.push_reps`'s `{gap}` only at `CAPACITY.pushGap` (2) or more. Any future
change to those thresholds must revisit both strings.

## Maintenance notes

- **F3 (lb display policy, `docs/prelaunch-deferrals.md`) will land on this
  surface.** The load rows format `minJump` and loads through
  `fmtLoad`/`unitLabel`, so in lb mode they inherit today's unloadable
  values (e.g. a "2.5 kg" step shown as 5.51 lb). When F3 is resolved,
  `why.load_*` strings and their `{step}` interpolation must be revisited.
- Any future change to the trigger chain must keep the `reason` vocabulary
  in sync — a new branch without a `reason` renders a sheet with a missing
  rule row. Reviewers should reject engine PRs that add a branch without
  extending `why.rule.*`.
- The sheet reuses `rec.add.tempered.text` and `log.insession.*` verbatim;
  rewording those keys rewords this surface too. That is intended (one
  brain), but reviewers should check the sheet after any engine-copy PR.
- Deliberately deferred: per-set ghost explanations (each input's own
  "why"), showing the freshness percentage, and a "today's sets" row in
  the sheet — all cut to keep v1 tap-cheap. Re-open only with a product
  decision.
- Managed Taurifer AI (ADR 0011) may later *reference* this sheet's facts in
  chat; it must call `explainRecommendation`, not duplicate it.
