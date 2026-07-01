# Plan 002: Plain-language recommendations + glossary-on-tap

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the expected result before moving on. On a STOP
> condition, stop and report. When done, update this plan's status row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> On any change to these files, compare the "Current state" excerpts against
> live code before proceeding; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (pairs well with 003)
- **Category**: dx / direction
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Beginner ("Nobody taught me RIR"), coach ("my clients want 'what
  do I do today,' not lore"). Report §2.4 "Legible intelligence".

## Why this matters

RepForge's recommendation engine is its best asset, but the copy assumes the
reader already knows double progression and RIR. Beginners "make up a number
and hope the app forgives" them. The fix is legibility, **not** dumbing down:
keep the engine, add a one-tap "why" for the jargon terms it already uses. No
engine change, no new tab (guardrail), no onboarding wizard.

## Current state

- Recommendation text/labels are authored in `recommendation()` (`app.js:124-140`):
  e.g. `label:"Add load ++",text:"You topped the range with reps to spare. Jump
  up boldly."` and `label:"Stalled · deload"`. These strings render at
  `app.js:171-172`:

  ```js
  `<span class="chip">${esc(r.label)}</span></div>`+
  `<p class="rec">${esc(r.text)}${r.load!==null?` Target <b>${fmt(r.load)} kg</b>.`:""}</p>`
  ```

- The exercise meta line shows raw jargon (`app.js:167`):
  `<p class="ex__meta">${ex.sets}×${ex.min}-${ex.max} reps · RIR 0-${fmt(state.settings.rirHigh)}</p>`.
- "RIR" also appears as a bare column header on Log (`app.js:175`) and in the
  Program lede (`index.html:84`) and Stats lede (`index.html:66`).
- `toast()` (`app.js:15`) is the only lightweight popover primitive today; it is
  a transient bottom banner, not a tap-to-explain affordance.
- There is no glossary anywhere: `grep -n "RIR" index.html app.js` shows RIR
  used ~10× with zero definition surfaced in the UI (only a `<meta
  name="description">` line at `index.html:7`).

## Commands you will need

Run from repo root unless noted.

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Test deps | `cd test && npm install` | exit 0 |
| Browser | `cd test && npx playwright install chromium` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (only these files):
- `app.js` — a `GLOSSARY` map, a `glossaryPopover()` helper, tap targets on
  jargon terms, and a plain-language second line under each recommendation.
- `index.html` — a reusable `#glossary` popover element (or reuse a `<dialog>`).
- `styles.css` — glossary popover + `.term` (dotted-underline tappable) styles.
- `test/simulation.mjs` — one check that tapping a term opens the definition.

**Out of scope** (do NOT touch):
- `recommendation()` math and status thresholds — copy only, no logic changes.
- Settings dials (Plan 003 handles hiding them).
- An "Easy/Hard/Max effort" RIR alternative input — that is a bigger feature;
  keep it out (record it in the backlog).

## Git workflow

- Branch: `advisor/002-recommendation-legibility`
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 1: Glossary data + popover primitive

In `app.js` (top-level, near `DEFAULTS`, `app.js:17`), add:

```js
const GLOSSARY={
  RIR:"Reps in reserve — how many more reps you could have done before failing. RIR 2 = you had 2 left. Newer? Just estimate: could I do 1–2 more?",
  "rep range":"The target reps per set (e.g. 4–8). Stay in the range; when every set hits the top, add weight next time.",
  "double progression":"Add reps until you top the range, then add weight and drop back to the bottom of the range. That's the whole recommendation engine.",
  deload:"A deliberately lighter session to recover when progress stalls. Not a failure — it's how you keep progressing.",
  e1RM:"Estimated one-rep max from your set (Epley: load × (1 + reps/30)). A single number to compare hard sets across days.",
  "hard set":"A set taken close enough to failure to drive growth (at or under your hard-set RIR ceiling). These are what the volume audit counts."
};
```

Add a popover helper (after `toast`, `app.js:16`):

```js
function glossaryPopover(term,anchor){const g=$("#glossary");if(!g)return;
  g.querySelector(".glossary__term").textContent=term;
  g.querySelector(".glossary__body").textContent=GLOSSARY[term]||"";
  g.classList.remove("hidden");
  const r=anchor.getBoundingClientRect();g.style.top=`${window.scrollY+r.bottom+6}px`;g.style.left=`${Math.max(8,r.left)}px`}
```

### Step 2: Popover markup + dismissal

In `index.html`, before `#toast` (`index.html:134`), add:

```html
<div id="glossary" class="glossary hidden" role="dialog" aria-label="Definition">
  <button type="button" class="glossary__close" aria-label="Close">✕</button>
  <p class="glossary__term"></p>
  <p class="glossary__body"></p>
</div>
```

In `init()` (`app.js:473`), wire close + outside-tap dismissal:

```js
$("#glossary .glossary__close").onclick=()=>$("#glossary").classList.add("hidden");
document.addEventListener("click",e=>{const g=$("#glossary");if(!g||g.classList.contains("hidden"))return;
  if(!g.contains(e.target)&&!e.target.closest("[data-term]"))g.classList.add("hidden")});
```

### Step 3: Make jargon tappable + add a plain-language line

Add a small helper (near `exerciseLabel`, `app.js:24`) that wraps a known term
as a tappable span:

```js
const term=t=>`<button type="button" class="term" data-term="${esc(t)}">${esc(t)}</button>`;
```

In `renderWorkout` (`app.js:167`), change the meta line so "RIR" is a term:

```js
`<p class="ex__meta">${ex.sets}×${ex.min}-${ex.max} reps · ${term("RIR")} 0-${fmt(state.settings.rirHigh)}</p>`
```

Under the recommendation `<p class="rec">` (`app.js:172`), append a plain-English
gloss keyed off `r.status`. Add a map near `recommendation()`:

```js
const PLAIN={add2:"Translation: it was easy and you hit the top reps — add weight.",
  add:"Translation: you hit the top of every set — add a little weight next time.",
  reduce:"Translation: this was too heavy to stay in range — drop the weight and rebuild.",
  hold:"Translation: keep this weight and try for one more rep next time.",
  new:"Translation: first time logging this — pick a weight you can control for the reps shown."};
```

and render it right after the `.rec` paragraph:

```js
`<p class="rec__plain">${esc(PLAIN[r.status]||"")}</p>`+
```

Wire term taps in `bindWorkout` (`app.js:183`):

```js
$$("#workout .term").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});
```

**Verify**: `node --check app.js` → 0. Browser: each exercise shows a
"Translation: …" line; tapping the underlined "RIR" opens the definition;
tapping elsewhere closes it.

### Step 4: Terms in the ledes

Wrap the first mention of jargon in `index.html` ledes as terms so beginners can
tap them where they first appear. Because ledes are static HTML, add a global
delegated handler (already added in Step 2's `document` listener) and mark terms
directly, e.g. in `index.html:66` and `index.html:84` wrap the word with:

```html
<button type="button" class="term" data-term="hard set">hard set</button>
```

Add a `document`-level binding in `init()` so static terms work:

```js
$$("[data-term]").forEach(b=>{if(!b.onclick)b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)}});
```

(Log-tab terms are re-bound every render in `bindWorkout`; this covers the
static ones. Re-run this line inside `render()` is unnecessary — static nodes
persist.)

**Verify**: `node --check app.js` → 0. Tapping "hard set" in the Stats lede
opens its definition.

### Step 5: Styles

In `styles.css` add:
- `.term` — inline, dotted underline, inherits color, no button chrome, tap
  target ≥ 24px tall.
- `.glossary` — absolutely-positioned card, `--panel`/`--rule` tokens (search
  styles.css for existing `--` custom properties and reuse them), max-width
  ~280px, above `.toast` z-index.
- `.rec__plain` — muted, smaller than `.rec` (mirror `.lede` styling).

**Verify**: popover is readable on a 360px screen and doesn't run off-edge
(clamped by the `Math.max(8, …)` in Step 1).

### Step 6: Simulation check

In `test/simulation.mjs` (~Phase 12, near line 900):

```js
await nav(page, "log");
await selectDay(page, "Day 1");
await page.click("#workout .term[data-term='RIR']");
await page.waitForTimeout(80);
assert(
  !(await page.locator("#glossary").getAttribute("class")).includes("hidden") &&
    /reserve/i.test(await page.locator("#glossary .glossary__body").textContent()),
  "Glossary explains RIR on tap",
  "Glossary popover did not open with RIR definition",
  "Log → tap 'RIR' → definition popover opens"
);
await page.click("#glossary .glossary__close");
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each edit.
- Manual: term taps open/close; every card shows a Translation line.
- One new simulation check; existing 61 stay green.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Every recommendation card renders a `.rec__plain` "Translation:" line
- [ ] Tapping RIR / hard set / rep range opens a definition; outside tap closes
- [ ] `recommendation()` logic is byte-unchanged except the added `PLAIN` map is
      **not** inside it (it's a sibling const) — no threshold edits
- [ ] `cd test && node simulation.mjs` → `FAILED: 0` (62 checks)
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: excerpts don't match live code.
- Making a term tappable requires restructuring `renderWorkout`'s template in a
  way that breaks the existing `.ex__meta`/`.rec` selectors the simulation reads
  (`cardInfo`, `app.js`-side; see `test/simulation.mjs` `cardInfo`, line 121).
  If `cardInfo`'s `.rec`/`.chip` scraping breaks, adjust the check rather than
  changing selector names the test depends on.

## Maintenance notes

- New jargon added anywhere in the UI should get a `GLOSSARY` entry and a
  `data-term`. Reviewers should reject new undefined jargon on user-facing text.
- The "Easy/Hard/Max → RIR" beginner input and a full first-run path are logged
  in the backlog; keep them out of this plan.
