# Plan 032: Command bar syntax help — visible `?` affordance, screen-reader description, and removal of the dead hints setting

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c46c1b..HEAD -- app.js index.html styles.css test/simulation.mjs`
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

The quick-entry command bar (`80 x 8 @1` → fills the next empty set) is the
fastest way to log, but its only documentation is the input placeholder —
which disappears the moment the user types, is invisible to screen readers as
a description, and shows a single form (no exercise prefix, no effort words,
no `set N`). The UI/UX evaluation report ranked a syntax help affordance as a
P0 recommendation. Separately, `state.settings.commandParserHints` is a dead
field: defined, normalized, and preserved on every save, but never read by
anything — it must either drive this feature or be deleted. This plan deletes
it (the help affordance is cheap enough to always show) and adds a `?` button
that opens the existing glossary popover with examples.

## Current state

`index.html:52-56` — the command bar:

```html
      <div class="commandbar">
        <input id="commandInput" type="text" autocomplete="off" placeholder="Type: 80 x 8 @1" aria-label="Quick set entry">
        <button type="button" id="voiceBtn" class="btn btn--steel hidden" aria-label="Voice input">🎤</button>
        <button type="button" id="commandApply" class="btn btn--steel">Apply</button>
      </div>
```

`app.js:57,60` — the dead setting (also preserved at `app.js:1404` in
`commitSettings`):

```javascript
const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,lastExport:"",unit:"kg",rirMode:"numeric",voiceInputEnabled:false,commandParserHints:true};
// … normalizeSettings includes:
// commandParserHints:normBool(s?.commandParserHints,DEFAULTS.commandParserHints)
```

`grep -n commandParserHints app.js` at `5c46c1b` returns exactly 4 hits:
lines 57, 60 (twice on the one-line normalizer), and 1404. Nothing reads it.

`app.js:41-56` — the glossary popover pattern this plan reuses. `GLOSSARY` is
a term→definition map; `glossaryPopover(term,anchor)` fills `#glossary`
(a `role="dialog"` div in `index.html:220-224`) and positions it under the
anchor. Term buttons are created with the `term()` helper (`app.js:70`):

```javascript
const term=t=>`<button type="button" class="term" data-term="${esc(t)}">${esc(t)}</button>`;
```

Term clicks inside `#workout` are bound in `bindWorkout`
(`app.js:784`): `$$("#workout .term").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});`
and a document-level click handler closes the popover
(`app.js:1564-1565`).

Parser accepted forms (from `parseSetCommand`, `app.js:1003-1024`, and
`resolveExerciseFromCommand`, `app.js:1035-1041`): `80 x 8 @1`,
`bench 80 x 8 @1` (name prefix/substring), `80 x 8 easy|hard|max`,
`set 2 80 x 8`, `80kg x 8`, `for` instead of `x`, `×` accepted, comma
decimals accepted. Applied to the active exercise (Focus mode) or the first
matching/first listed exercise.

The command bar is **outside** `#logForm` and outside `#workout` (see
`index.html:52-56`), so its handlers are bound once in `init`
(`app.js:1573-1577`), not in `bindWorkout`.

`styles.css` has a `.commandbar` block (search `commandbar`) sizing the input
and buttons.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |

At commit `5c46c1b` the simulation reports `PASSED: 267, FAILED: 0`.
Service-worker gotcha: after editing `index.html`/`app.js`/`styles.css`,
hard-reload (or unregister the SW via DevTools → Application) to see changes.

## Scope

**In scope** (the only files you should modify):
- `index.html` — add the `?` button and `aria-describedby` hookup.
- `app.js` — glossary entry, `?` handler, remove `commandParserHints`.
- `styles.css` — minimal styling for the `?` button (reuse `.btn--steel`).
- `test/simulation.mjs` — regression checks.

**Out of scope** (do NOT touch, even though they look related):
- `parseSetCommand` / `normalizeCommandText` / `applyParsedCommand` — parser
  behavior is unchanged; this is documentation only.
- Voice input (`startVoiceInput`, `#voiceBtn`) — plan does not alter it.
- `sw.js` cache version — bump ONLY if the repo's convention requires it for
  shipped asset changes (check `sw.js`; if it lists a versioned cache name,
  bump it as PRs #4/#9 did).

## Git workflow

- Branch: `cursor/plan-032-command-help-<suffix>`.
- Commit style: single-line imperative summary.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the dead `commandParserHints` field

In `app.js`, delete `commandParserHints:true` from `DEFAULTS` (line 57), the
`commandParserHints:normBool(…)` property from `normalizeSettings` (line 60),
and `commandParserHints:state.settings.commandParserHints` from
`commitSettings` (line 1404). `normalizeSettings` rebuilds the settings object
from an allowlist, so old backups containing the field import cleanly — the
key is simply dropped.

**Verify**: `node --check app.js` → exit 0, and
`grep -c commandParserHints app.js` → 0.

### Step 2: Add the glossary entry and the `?` button

1. In `GLOSSARY` (`app.js:41-50`), add a `"quick entry"` key:

```javascript
  "quick entry":"Type a set and hit Apply: 80 x 8 @1 (load × reps @RIR). Add the lift name to target it (bench 80 x 8), use easy/hard/max instead of @N in effort mode, or set 2 to pick the set. Goes to the current exercise in Focus mode.",
```

2. In `index.html`, inside `.commandbar` before `#voiceBtn`, add:

```html
        <button type="button" id="commandHelp" class="btn btn--steel commandbar__help" aria-label="Quick entry syntax help">?</button>
```

and add `aria-describedby="commandHelpText"` to `#commandInput`, plus a
visually hidden description element right after the commandbar div:

```html
      <p id="commandHelpText" class="visually-hidden">Quick set entry. Format: load x reps @RIR, for example 80 x 8 @1. Optionally start with the exercise name.</p>
```

3. In `styles.css`, add a `.visually-hidden` utility if one does not exist
(search first — if absent):

```css
.visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
```

and constrain the help button: `.commandbar__help{flex:none;min-width:2.4rem;padding:10px 0}` (match the existing commandbar button sizing — inspect the `.commandbar` block and keep visual rhythm).

4. In `app.js` `init` (next to the existing command bar bindings at
`app.js:1573-1577`), bind:

```javascript
  const cmdHelp=$("#commandHelp");if(cmdHelp)cmdHelp.onclick=e=>{e.stopPropagation();glossaryPopover("quick entry",cmdHelp)};
```

`e.stopPropagation()` is required — the document-level click handler
(`app.js:1564-1565`) closes the glossary on outside clicks and would
immediately close it otherwise (this mirrors the `.term` handler at
`app.js:784`).

**Verify**: `node --check app.js` → exit 0. Serve, hard-reload, Log tab: a
`?` button sits in the command bar; tapping it opens the glossary popover
with the syntax examples; tapping elsewhere closes it.

### Step 3: Simulation checks

In `test/simulation.mjs` near the existing command bar checks (search for
`commandInput`), add:

- `#commandHelp` exists and is visible on the Log tab.
- Clicking `#commandHelp` makes `#glossary` visible
  (`!classList.contains("hidden")`) and its body text contains `x 8` or
  `80 x 8`.
- `#commandInput` has `aria-describedby="commandHelpText"` and the element
  `#commandHelpText` exists.
- State audit: after a settings save, `state.settings.commandParserHints` is
  `undefined` (field removed).

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥ 271.

## Test plan

- New simulation checks (Step 3): help button presence, popover open with
  syntax content, aria description wiring, dead-field removal.
- Existing checks that must keep passing: command parser checks
  (`__repforgeParseCommand` fixtures), voice toggle checks, settings
  normalization checks. If any existing check asserts `commandParserHints`
  exists, update it to assert removal instead (search the sim for the name
  first).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 271
- [ ] `grep -c commandParserHints app.js test/simulation.mjs` → 0 in `app.js`
- [ ] `grep -c 'commandHelp' index.html` ≥ 1 and `grep -c '"quick entry"' app.js` ≥ 1
- [ ] No files outside `index.html`, `app.js`, `styles.css`, `test/simulation.mjs` (and `sw.js` if cache-bump convention applies) are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -n commandParserHints app.js` returns hits other than lines ~57, ~60,
  ~1404 — something started reading the setting since this plan was written;
  the feature intent changed, report instead of deleting.
- The glossary popover positioning breaks in the commandbar context (e.g.
  renders off-screen at 390px width) after a reasonable CSS fix attempt.
- An existing simulation check depends on `commandParserHints` being `true`
  in exported backups in a way that isn't a one-line update.

## Maintenance notes

- If richer inline hints are ever wanted (e.g. live parse preview under the
  input), reintroduce a setting deliberately — don't resurrect the old field
  name silently.
- Reviewer should scrutinize: `stopPropagation` on the help button (without
  it the popover flashes open/closed), and that the placeholder example, the
  glossary text, and `#commandHelpText` all describe the same syntax.
