# Plan 016: Per-set "Save set" commit + suggested-vs-completed clarity

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> On any change, compare "Current state" excerpts against live code; mismatch =
> STOP.

## Status

- **Priority**: P1 (core in-gym loop clarity — the report's highest-leverage area)
- **Effort**: M
- **Risk**: MED (touches the set-row template, draft schema, and save filter)
- **Depends on**: none. **Composes with** 001 (rest timer auto-start on commit)
  and 013 (session mode). Land this **before** 001 so 001's auto-start hooks the
  commit instead of the RIR-fill heuristic.
- **Category**: direction (feature) / dx
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: **Operator feedback while reviewing Plan 001**, grounded in the
  report's session-loop thesis (power user: "what's done? what's next?"; parent:
  "imperfect data beats no data"; minimalist: "type numbers, save, leave").

## Why this matters

Two problems the operator identified in the current Log loop:

1. **No per-set commit.** The only save is one "Save workout" button used once
   per session. There's no way to mark a single set done mid-workout, so there's
   no natural "set complete" moment (which is also the ideal trigger for the
   rest timer in Plan 001, where I otherwise had to guess "set complete" from an
   RIR keystroke).
2. **Suggested and completed values are indistinguishable.** `renderWorkout`
   pre-fills each input with a *suggestion* (recommendation load, last-session
   reps/RIR), but a pre-filled suggestion looks identical to a value the lifter
   actually entered. You can't tell at a glance what you've done vs what the app
   is proposing.

Fix: add a per-set **Save set** button that commits a set, style **untouched
suggestions greyed** and **committed sets solid** (three states: suggested →
editing → done), and reframe the bottom button as **Finish workout** (its true
once-per-session role) with a "N of M sets done" progress meta.

## Current state

- Set rows are built with suggestions pre-filled into `value` (`app.js:153-163`):

  ```js
  const kgVal=draftKg!=null?draftKg:(r.load!=null?fmt(r.load):(old&&old.load!=null?fmt(old.load):""));
  const repsVal=draft[`${ex.id}_${n}_reps`]??(old&&old.reps!=null?old.reps:ex.min);
  const rirVal=draft[`${ex.id}_${n}_rir`]??(old&&old.rir!=null?fmt(old.rir):1);
  return `<div class="setrow"><span class="setrow__n">${n}</span>`+ /* kg / reps / rir inputs */ ;
  ```

  Nothing distinguishes a pristine suggestion from an entered value.
- Draft autosave (`saveDraft`, `app.js:181`) rebuilds the draft object purely
  from input values — it drops any non-input keys:

  ```js
  function saveDraft(){const d={};$$("#workout input").forEach(x=>d[x.dataset.k]=x.value);localStorage.setItem(DRAFT,JSON.stringify(d))}
  ```

- `bindWorkout` (`app.js:183-193`) wires input/step/copy/collapse. The input
  handler is `i.oninput=()=>{saveDraft();updateSaveMeta()}` (`app.js:184`).
- `saveWorkout` (`app.js:212-221`) persists every set with `load>0`
  (`app.js:216`): `if(load<=0)continue;`.
- `updateSaveMeta` (`app.js:208-210`) already computes `filled/planned`.
- The bottom button (`index.html:49-52`) is `Save workout` with a `#saveMeta`
  span; it sits after `#workout` and the notes field (`index.html:44-53`) — i.e.
  already after the last exercise. The change is emphasis + label + meta, not
  position.
- In-memory ephemeral UI state already uses `Set`s (`collapsed`, `app.js:89`) —
  mirror that pattern for `committed`/`touched`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `app.js` — `committed` and `touched` `Set`s keyed `${ex.id}_${n}`, rehydrated
  from/persisted to the draft; a **Save set** button per row; three-state row
  styling; a save filter so pristine suggestions are NOT logged; relabel the
  submit button meta to "N of M sets done".
- `index.html` — relabel `Save workout` → `Finish workout` (keep id/classes and
  the `#saveMeta` span; keep its position after the last exercise).
- `styles.css` — `.setrow.is-suggested` (muted/greyed), `.setrow.is-done` (solid
  + check), and the `.saveset` button.
- `test/simulation.mjs` — checks for commit-marks-done, greyed suggestion, and
  the persistence rule.

**Out of scope** (do NOT touch):
- Writing each set to `state.log` immediately (true per-set persistence needs a
  session identity before "finish" and complicates edit/delete — see the
  alternative in STOP conditions; this plan commits into the **draft**, and
  "Finish workout" still persists the session via the existing `saveWorkout`).
- The rest timer itself (Plan 001) — only expose a hook it can call.
- Session mode layout (Plan 013).

## Git workflow

- Branch: `advisor/016-per-set-commit`
- Commit per step, gate green each time. Do NOT push/PR unless asked.

## Steps

### Step 1: Track committed + touched state (rehydrated from draft)

Near `collapsed` (`app.js:89`) add:

```js
const committed=new Set();  // `${ex.id}_${n}` sets the lifter marked done
const touched=new Set();     // `${ex.id}_${n}` sets the lifter edited (not pristine suggestions)
```

Make `saveDraft` (`app.js:181`) preserve these alongside input values by merging
rather than rebuilding from scratch:

```js
function saveDraft(){const d={};$$("#workout input").forEach(x=>d[x.dataset.k]=x.value);
  d.__done=[...committed];d.__touched=[...touched];localStorage.setItem(DRAFT,JSON.stringify(d))}
```

At the top of `renderWorkout` (`app.js:149`), rehydrate from the draft so a
reload keeps commit/touch state:

```js
const draft=loadDraft();
committed.clear();(draft.__done||[]).forEach(k=>committed.add(k));
touched.clear();(draft.__touched||[]).forEach(k=>touched.add(k));
```

Note: the draft's `__done`/`__touched` keys are ignored by the set-row lookups
because those read `draft[`${ex.id}_${n}_load`]` etc., never `__done`.
`clearDraft` (`app.js:20`) already wipes everything on save/import — good.

**Verify**: `node --check app.js` → 0.

### Step 2: Three-state row styling + a Save set button

In the row template (`app.js:158-163`), compute the row's state and add the
class + a Save set button. Replace the `return` for each row with:

```js
const key=`${ex.id}_${n}`;
const cls=committed.has(key)?"is-done":(touched.has(key)?"":"is-suggested");
return `<div class="setrow ${cls}" data-set="${esc(key)}"><span class="setrow__n">${n}</span>`+
  `<div class="kg"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="-1" tabindex="-1" aria-label="Set ${n} decrease kg">−</button>`+
  `<input data-k="${ex.id}_${n}_load" type="number" step="any" min="0" inputmode="decimal" aria-label="Set ${n} kg" placeholder="kg" value="${esc(kgVal)}">`+
  `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="1" tabindex="-1" aria-label="Set ${n} increase kg">+</button></div>`+
  `<input data-k="${ex.id}_${n}_reps" type="number" step="1" min="0" inputmode="numeric" aria-label="Set ${n} reps" value="${esc(repsVal)}">`+
  `<input data-k="${ex.id}_${n}_rir" type="number" step="0.5" min="0" inputmode="decimal" aria-label="Set ${n} RIR" value="${esc(rirVal)}">`+
  `<button type="button" class="saveset" data-save="${esc(key)}" aria-label="Save set ${n}">${committed.has(key)?"✓":"Save"}</button></div>`;
```

(A pristine, never-touched suggestion is `.is-suggested` = greyed. Editing any
field marks it touched → normal. Save set marks it done → `.is-done` + ✓.)

### Step 3: Wire input=touched, and the Save set button

In `bindWorkout` (`app.js:184`), extend the input handler to mark the row touched
and un-grey it live:

```js
$$("#workout input").forEach(i=>{i.oninput=()=>{const row=i.closest(".setrow");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta()};
  i.onfocus=()=>i.select()});
```

Add the Save set handler (in `bindWorkout`):

```js
$$("#workout .saveset").forEach(b=>b.onclick=()=>{const key=b.dataset.save;
  const load=+($(`[data-k="${key}_load"]`)?.value)||0;
  if(load<=0){toast("Enter a weight before saving the set.");return}
  const row=b.closest(".setrow");
  if(committed.has(key)){committed.delete(key)} // tap ✓ again to un-commit/edit
  else{committed.add(key);touched.add(key)}
  if(row){row.classList.toggle("is-done",committed.has(key));row.classList.remove("is-suggested");
    b.textContent=committed.has(key)?"✓":"Save"}
  saveDraft();updateSaveMeta();
  if(committed.has(key)&&typeof startRest==="function")startRest(); // Plan 001 hook (no-op if 001 not landed)
});
```

Also mark copy-last as touched (its values are real, from last session). In the
copylast handler (`app.js:188-190`), after filling, add the set keys to `touched`
and re-render or toggle classes:

```js
for(const s of prevSets){touched.add(`${b.dataset.copy}_${s.set}`);
  for(const f of ["load","reps","rir"]){const inp=$(`[data-k="${b.dataset.copy}_${s.set}_${f}"]`);if(inp)inp.value=fmt(s[f])}}
saveDraft();renderWorkout();toast("Filled from last session.");
```

(Re-rendering refreshes the greyed→normal styling for the copied rows.)

**Verify**: `node --check app.js` → 0. In the browser: untouched sets show greyed
numbers; editing a field un-greys that row; tapping **Save** shows ✓ and a solid
row; tapping ✓ again reverts to editable.

### Step 4: Only persist non-pristine sets on Finish

In `saveWorkout` (`app.js:214-217`), skip pristine suggestions — persist a set
only if it was committed or touched **and** has `load>0`:

```js
for(const ex of exercises())for(let n=1;n<=ex.sets;n++){
  const key=`${ex.id}_${n}`;
  const load=posNum($(`[data-k="${ex.id}_${n}_load"]`).value),reps=posNum($(`[data-k="${ex.id}_${n}_reps"]`).value),rir=posNum($(`[data-k="${ex.id}_${n}_rir"]`).value);
  if(load<=0)continue;
  if(!(committed.has(key)||touched.has(key)))continue; // pristine suggestion — not logged
  rows.push({session,date,day,name:ex.name,exerciseId:ex.id,set:n,load,reps,rir,notes,created,primary:ex.primary,secondary:ex.secondary})}
```

After a successful save, clear the in-memory state (the draft is already cleared
by `clearDraft()` at `app.js:219`): add `committed.clear();touched.clear();`
right after `clearDraft();`.

**Verify**: fill only some sets (edit or Save them), leave others as greyed
suggestions, tap Finish → only the non-pristine sets are logged; the greyed
suggestions are not.

### Step 5: Relabel bottom button + progress meta

In `index.html:49-52`, change the label text `Save workout` → `Finish workout`
(keep `class="btn btn--forge btn--save"`, `type="submit"`, and the
`<span id="saveMeta" class="btn__meta">`).

Update `updateSaveMeta` (`app.js:208-210`) to count committed/touched sets:

```js
function updateSaveMeta(){const exs=exercises(),planned=sum(exs.map(e=>e.sets));
  const done=[...committed].length;
  const entered=$$("#workout input").filter(i=>i.dataset.k&&i.dataset.k.endsWith("_load")&&+i.value>0).length;
  $("#saveMeta").textContent=done?`${day} · ${done}/${planned} sets done`:(entered?`${day} · ${entered}/${planned} entered`:`${day} · ${planned} sets`);}
```

**Verify**: `node --check app.js` → 0. The bottom button reads "Finish workout"
with a live "N/M sets done" meta as you Save sets.

### Step 6: Styles

In `styles.css`:
- `.setrow.is-suggested input{color:var(--steel? muted token);opacity:.55}` — the
  greyed suggestion look. Use an existing muted token (search styles.css for
  `--steel`/`--dim`/`.lede` color).
- `.setrow.is-done` — subtle solid/confirmed treatment (e.g. left ember accent
  or tinted background) and the ✓ button styled as confirmed.
- `.saveset` — compact button sized to sit at the end of the `.setrow` grid.
  Note `.setrow` is likely a CSS grid/flex row; add a column for the button so
  it doesn't wrap on 360px. Search styles.css for `.setrow` and extend its
  track/columns.

**Verify**: at 360px the row (n · kg±·reps·RIR·Save) fits without wrapping;
greyed vs done states are clearly distinct.

### Step 7: Simulation checks

In `test/simulation.mjs` (~Phase 12):

```js
await nav(page, "log");
await selectDay(page, "Day 1");
const meta = await getExerciseMeta(page, "Day 1");
const ex0 = meta[0].id;

// pristine suggestion row is greyed
assert(
  (await page.getAttribute(`.setrow[data-set="${ex0}_1"]`, "class")).includes("is-suggested"),
  "Untouched suggestion row is greyed",
  "Set row not marked is-suggested before edit",
  "Log → open exercise → set rows show as suggestions until touched"
);

// Save set marks it done and updates meta
await page.fill(`[data-k="${ex0}_1_load"]`, "100");
await page.click(`.saveset[data-save="${ex0}_1"]`);
await page.waitForTimeout(80);
assert(
  (await page.getAttribute(`.setrow[data-set="${ex0}_1"]`, "class")).includes("is-done"),
  "Save set marks the set done",
  "Row not is-done after Save set",
  "Log → enter weight → Save set → row shows done"
);

// pristine suggestions are NOT logged on Finish
await saveWorkout(page); // clicks the (now "Finish workout") submit button
const st = await getState(page);
const logged = st.log.filter(r => r.exerciseId === ex0);
assert(
  logged.length === 1 && +logged[0].set === 1,
  "Finish logs only committed/edited sets, not pristine suggestions",
  `logged sets for ex0: ${logged.map(r => r.set).join(",")}`,
  "Log → Save one set, leave others suggested → Finish logs only the saved set"
);
```

Confirm `saveWorkout(page)` in the harness clicks the submit button by selector,
not by the literal text "Save workout" (`grep -n "Save workout\|btn--save\|logForm\|requestSubmit" test/simulation.mjs`). If it matches on button **text**, update it to click `.btn--save` / submit the `#logForm` so the relabel to "Finish workout" doesn't break it.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each step.
- Manual: three visual states; Save set ✓ + un-commit; copy-last un-greys;
  Finish logs only non-pristine sets; reload keeps committed/touched state via
  draft; progress meta accurate.
- Simulation: the three new checks; **all existing 61 must stay green** — this is
  the key regression guard, since `fillExerciseSets` edits load/reps/rir (→
  touched), so previously-saved sim sets still persist under the new filter.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Untouched suggestion rows render greyed (`.is-suggested`); editing un-greys
- [ ] Each set has a **Save set** button that marks it done (✓, `.is-done`) and
      can be tapped again to re-open for editing
- [ ] Committing a set calls `startRest()` when Plan 001 is present (harmless no-op otherwise)
- [ ] "Finish workout" logs only sets that were committed or edited (pristine
      suggestions are not logged); committed/touched clear after a successful save
- [ ] Bottom button reads "Finish workout" with a "N/M sets done" meta
- [ ] Commit/touch state survives reload (persisted in the draft)
- [ ] `cd test && node simulation.mjs` → `FAILED: 0` (64 checks)
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: the set-row / `saveDraft` / `saveWorkout` / `updateSaveMeta` excerpts
  don't match live code.
- **If the new persistence filter turns any existing simulation check red**
  (e.g. a flow that saved a prefilled set without editing it), STOP: the safest
  fallback is to keep the visual/greying + Save-set behavior but revert the Step 4
  filter to the original `load>0`-only rule (so Finish still saves prefilled
  values), and record that "pristine suggestions are visually distinct but still
  saved on Finish" as the shipped behavior. Do not weaken existing checks to
  force the stricter filter.
- If the operator wants **true** per-set persistence (each Save set writes to
  `state.log` immediately), that's a different data model (needs a session id
  created on first commit, plus edit/undo semantics) — STOP and escalate; it is
  explicitly out of scope here.

## Maintenance notes

- Plan 001 (rest timer): once this lands, 001's auto-start should trigger on the
  Save-set commit (the `startRest()` hook in Step 3), and 001's RIR-keystroke
  heuristic can be dropped.
- Plan 013 (session mode): in focus mode, "Save set" + "Next" is the natural
  loop and "Finish workout" is the end — reuse this commit state, don't fork it.
- Keep commit/touch state ephemeral (draft-backed), never in `repforge_v1`.
