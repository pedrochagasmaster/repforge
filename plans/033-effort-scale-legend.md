# Plan 033: Surface the Easy/Hard/Max → RIR mapping where effort mode is chosen and used

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c46c1b..HEAD -- app.js index.html test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / direction
- **Planned at**: commit `5c46c1b`, 2026-07-07

## Why this matters

Effort mode (Settings → RIR logging → Easy / Hard / Max) exists for beginners
who don't know RIR — but nothing tells them what the three words mean or that
they map to RIR 3 / 1 / 0 under the hood (`EFFORT_RIR`, `app.js:51`). The
glossary already contains exactly the right definitions ("Easy effort",
"Hard effort", "Max effort" at `app.js:47-49`) and nothing surfaces them. The
UI/UX evaluation report flagged the missing legend as a P0 recommendation.
This plan wires the existing glossary entries into the two places the choice
is made and used: the Settings radio group and the Log tab's set-grid header.

## Current state

`app.js:47-51` — glossary entries and the mapping (already correct):

```javascript
  "Easy effort":"You could have done several more reps — about 3 reps in reserve (RIR 3). Use this when the set felt comfortable.",
  "Hard effort":"You were working but not grinding — about 1 rep in reserve (RIR 1). This is the sweet spot for most working sets.",
  "Max effort":"You were at or very near failure — 0 reps in reserve (RIR 0). Save this for your last set or when you're pushing hard."
};
const EFFORT_RIR={easy:3,hard:1,max:0};
```

`app.js:70` — the `term()` helper that renders a tappable glossary term:

```javascript
const term=t=>`<button type="button" class="term" data-term="${esc(t)}">${esc(t)}</button>`;
```

`app.js:760` — the Log set-grid header (inside `renderWorkout`'s big template;
`effortMode` is `state.settings.rirMode==="effort"`):

```javascript
      `<div class="sets__head"><span>Set</span><span>${unitLabel()}</span><span>reps</span><span>${effortMode?"Effort":"RIR"}</span><span></span></div>${rows}</article>`;
```

Term clicks inside `#workout` are already bound in `bindWorkout`
(`app.js:784`):

```javascript
  $$("#workout .term").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});
```

`index.html:160-164` — the Settings radio group (no legend today):

```html
        <fieldset class="field rirmode">
          <legend>RIR logging</legend>
          <label class="rirmode__opt"><input type="radio" name="rirMode" value="numeric" checked> Numbers</label>
          <label class="rirmode__opt"><input type="radio" name="rirMode" value="effort"> Easy / Hard / Max</label>
        </fieldset>
```

Settings copy convention: explanatory lines are `<p class="lede">…</p>`
directly under the control they explain (see `index.html:167` for the voice
input example). Term-button bindings: dynamic terms inside `#workout` are
re-bound on every render (`app.js:784`); statically present terms anywhere
else are bound once in `init` (`app.js:1566` —
`$$("[data-term]").forEach(b=>{if(!b.onclick)b.onclick=…})`). The Settings
legend in this plan is plain lede text (no term button), so no new binding is
needed; the Log header term rides the existing `#workout` binding.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |

At commit `5c46c1b` the simulation reports `PASSED: 267, FAILED: 0`.
Hard-reload after editing cached assets (service worker).

## Scope

**In scope** (the only files you should modify):
- `index.html` — legend line under the RIR-mode fieldset.
- `app.js` — make the "Effort" column header a glossary term; add one
  glossary entry alias if needed; bind terms in Settings if not already bound.
- `test/simulation.mjs` — regression checks.

**Out of scope** (do NOT touch, even though they look related):
- `EFFORT_RIR` values and effort-mode save/draft logic — behavior unchanged.
- The effort buttons themselves (`app.js:728-731`) — turning each set-row
  button into a glossary trigger would collide with its select action; the
  column header is the documentation point.
- `styles.css` — `.term` and `.lede` styles already exist.

## Git workflow

- Branch: `cursor/plan-033-effort-legend-<suffix>`.
- Commit style: single-line imperative summary.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Settings legend

In `index.html`, directly after the closing `</fieldset>` of the RIR-mode
group, add:

```html
        <p class="lede">Easy ≈ 3 reps left in the tank (RIR 3) · Hard ≈ 1 left (RIR 1) · Max ≈ nothing left (RIR 0).</p>
```

**Verify**: serve + hard-reload → Settings shows the mapping line under the
radio group.

### Step 2: Make the Log "Effort" header a glossary term

In `app.js:760`, change the effort branch of the header from
`<span>${effortMode?"Effort":"RIR"}</span>` to render a term button in effort
mode. `GLOSSARY` keys are matched exactly, so add a short `"Effort"` entry
next to the three existing effort entries (`app.js:49`):

```javascript
  Effort:"Easy ≈ 3 reps in reserve, Hard ≈ 1, Max ≈ 0. Pick how the set felt; RepForge converts it to RIR for its coaching math.",
```

and in the header template:

```javascript
<span>${effortMode?term("Effort"):term("RIR")}</span>
```

Note `term("RIR")` already works — `"RIR"` is an existing glossary key
(`app.js:41`) and `.term` clicks in `#workout` are bound at `app.js:784`. The
`sets__head span` style (`styles.css:260`) sizes the header cells; check the
term button doesn't overflow the narrow column at 390px — if it does, keep
the effort branch as `term("Effort")` but leave the RIR branch as the
existing `${term("RIR")}`-free plain text ONLY if it was plain before your
change (it is: plain `RIR` text today — upgrading both is preferred if it
fits).

**Verify**: `node --check app.js` → exit 0. Serve, switch Settings → RIR
logging → Easy/Hard/Max, go to Log: the set-grid header shows "Effort" as a
dotted-underline term; tapping it opens the glossary popover with the
mapping.

### Step 3: Simulation checks

In `test/simulation.mjs` near the existing effort-mode checks (search for
`rirMode` / `effort__btn`), add:

- With `rirMode:"effort"` set, the Log tab contains a
  `#workout .term[data-term="Effort"]` element.
- Clicking it makes `#glossary` visible and the body text matches `/RIR 0|≈ 0|reps in reserve/i`.
- Settings view text includes `RIR 3` (the legend line renders).

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥ 270.

## Test plan

- New simulation checks (Step 3).
- Existing checks that must keep passing: effort-mode logging checks
  (EFFORT_RIR mapping asserts), glossary checks, settings persistence checks.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 270
- [ ] `grep -c 'Effort:' app.js` ≥ 1 (glossary entry) and `grep -c 'RIR 3' index.html` ≥ 1 (legend)
- [ ] No files outside `index.html`, `app.js`, `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts don't match live code (drifted).
- The term button visually breaks the 5-column set-grid header at 390px width
  after a reasonable attempt (e.g. shortening the label) — report with a
  screenshot rather than restructuring the grid.

## Maintenance notes

- If `EFFORT_RIR` values ever change, three copies of the mapping now exist:
  the constant, the glossary entries, and the Settings legend — update all.
  Reviewers should grep for `RIR 3` on any change to `EFFORT_RIR`.
- Deferred: an "effort" glossary term on the onboarding flow (out of scope;
  onboarding does not mention effort mode today).
