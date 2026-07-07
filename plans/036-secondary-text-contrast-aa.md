# Plan 036: Bring dim secondary text up to WCAG AA contrast without flattening the steel/dim hierarchy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c46c1b..HEAD -- styles.css app.js test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (visual-only; needs screenshot review)
- **Depends on**: none
- **Category**: dx (accessibility)
- **Planned at**: commit `5c46c1b`, 2026-07-07

## Why this matters

Measured contrast ratios (WCAG 2.x relative luminance) for the two secondary
text colors on the app's backgrounds:

| Foreground | on `--iron #0e1116` | on `--slag #161b22` | AA (4.5:1) |
|---|---|---|---|
| `--steel #7c899b` | 5.32 | 4.87 | pass |
| `--steel-dim #586474` | **3.14** | **2.87** | **fail** |

`--steel-dim` is not decorative: it renders exercise meta lines
(`.ex__meta`), previous-session data (`.prev`), session delta summaries
(`.session__delta`), attention "why" lines (`.attn__why`), block review "why"
copy, setup notes labels, and more — all at 9.5–12.5px, where AA requires the
full 4.5:1. The chart canvas uses the identical value as `C.dim` for its
axis labels (`app.js:1187`). The UI/UX evaluation report flagged "secondary
steel-on-iron may fail WCAG AA"; measurement confirms it is specifically the
dim tier that fails.

The fix preserves the two-tier hierarchy by shifting both tiers up: `--steel`
gets slightly brighter, and `--steel-dim` moves to (approximately) today's
`--steel`, which already passes AA.

## Current state

`styles.css:24-25` (inside the `:root` custom-property block — read the whole
block first; line numbers may be ±2):

```css
  --steel:#7c899b;
  --steel-dim:#586474;
```

`app.js:1187` — the chart's hardcoded palette (canvas cannot read CSS vars
without extra plumbing; it duplicates the values):

```javascript
  const C={ember:"#ff5a1f",gold:"#ffb44c",white:"#ffe9c7",quench:"#4fb6d9",steel:"#7c899b",dim:"#586474",rule:"#2a323d",mist:"#eceff4"};
```

Usage shape: `--steel-dim` appears in ~28 rules in `styles.css` (grep
`steel-dim`); most are text colors, a few are hover border colors
(`.btn--steel:hover`, `.iconbtn:hover`, etc.) where contrast rules don't
apply — changing the variable adjusts all consistently, which is intended.

Target values (verified against the same luminance math):

| Token | New value | on iron | on slag |
|---|---|---|---|
| `--steel` | `#8b97a8` | ≈ 6.3 | ≈ 5.8 |
| `--steel-dim` | `#7b8899` | 5.24 | 4.80 |

(`#7b8899` is one step below today's steel so dim remains visibly the
quieter tier; both clear 4.5:1 on iron and slag.)

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Contrast check | `node -e "<snippet in Step 3>"` | ratios ≥ 4.5 |

At commit `5c46c1b` the simulation reports `PASSED: 267, FAILED: 0`.
Hard-reload after editing cached assets (service worker).

## Scope

**In scope** (the only files you should modify):
- `styles.css` — the two custom-property values only (no per-rule edits).
- `app.js` — the `steel` and `dim` entries in the chart's `C` palette.
- `test/simulation.mjs` — one computed-style regression check.

**Out of scope** (do NOT touch, even though they look related):
- `--steel-deep`, `--rule`, `--rule-soft`, or any other palette token —
  they are borders/backgrounds, not text.
- Color-encoded status classes (heat ramp, quench) — separate design surface.
  This includes `--heat:#586474` at `styles.css:208` (the heat-strip color for
  new/idle lifts) — it is a decorative bar fill, not text; leave it at the old
  value.

## Git workflow

- Branch: `cursor/plan-036-contrast-<suffix>`.
- Commit style: single-line imperative summary.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Update the CSS tokens

In `styles.css` `:root`, change:

```css
  --steel:#8b97a8;
  --steel-dim:#7b8899;
```

**Verify**: serve + hard-reload; Log tab secondary text (Last: lines,
ex meta) is visibly lighter but still clearly secondary to `--mist` body
text.

### Step 2: Update the chart palette

In `app.js:1187`, change `steel:"#7c899b"` → `steel:"#8b97a8"` and
`dim:"#586474"` → `dim:"#7b8899"` (keep every other entry byte-identical).

**Verify**: `node --check app.js` → exit 0; chart axis labels are readable
in Stats → Dig deeper.

### Step 3: Machine-check the ratios

Run:

```bash
node -e '
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const ratio=(a,b)=>{const[l1,l2]=[lum(a),lum(b)].sort((x,y)=>y-x);return+((l1+0.05)/(l2+0.05)).toFixed(2)};
const checks=[["#8b97a8","#0e1116"],["#8b97a8","#161b22"],["#7b8899","#0e1116"],["#7b8899","#161b22"]];
let ok=true;for(const[f,b]of checks){const r=ratio(f,b);console.log(f,"on",b,"=",r);if(r<4.5)ok=false}
process.exit(ok?0:1)'
```

**Verify**: exit 0, all four ratios ≥ 4.5.

### Step 4: Simulation regression check

In `test/simulation.mjs` (near the nav a11y checks — search `aria-current`),
add a computed-style assertion so the tokens can't silently regress:

```javascript
  const dimColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--steel-dim").trim());
  assert(
    dimColor.toLowerCase() === "#7b8899",
    "Secondary dim text token meets the audited AA value",
    `--steel-dim=${dimColor}`,
    "Computed style on :root → --steel-dim"
  );
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥ 268.

### Step 5: Visual review artifact

Take before/after screenshots of the Log tab and Stats Overview at 390×844
(any method; the simulation's Playwright install can be reused) and attach
them to the PR/summary — a token change this broad needs human eyes on the
result.

## Test plan

- Step 3 ratio script (machine gate for the actual accessibility claim).
- Step 4 simulation token check.
- Step 5 screenshots for human review.
- Existing checks that must keep passing: full simulation, `FAILED: 0` — no
  behavior changes expected.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] Step 3 ratio script exits 0 (all ≥ 4.5)
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 268
- [ ] `grep -n 'steel-dim:#586474' styles.css` returns no matches
- [ ] `grep -n 'dim:"#586474"' app.js` returns no matches
- [ ] `grep -n 'heat:#586474' styles.css` returns exactly 1 match (decorative heat strip untouched)
- [ ] No files outside `styles.css`, `app.js`, `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `:root` block or chart palette doesn't match the excerpts (drifted).
- The new values make the dim tier visually indistinguishable from steel in
  your screenshots — the exact hexes are a starting point, but if hierarchy
  collapses, report with screenshots instead of inventing new values.
- You find `--steel`/`--steel-dim` used as a **background** with dark text on
  top anywhere (grep `background:var(--steel`) — lightening it could break
  that pairing; none exists at `5c46c1b`, so finding one means drift.

## Maintenance notes

- The chart palette duplicates CSS tokens by design (canvas); any future
  palette change must touch both. Consider (deferred) reading tokens via
  `getComputedStyle(document.documentElement)` in `draw()` to remove the
  duplication.
- Reviewer should scrutinize: hover-border usages of `--steel-dim` (buttons)
  — they'll get slightly brighter; that's acceptable but worth a look in the
  screenshots.
