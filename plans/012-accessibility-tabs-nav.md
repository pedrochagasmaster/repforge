# Plan 012: Accessibility — tab/nav state and keyboard-operable controls

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html`
> On any change, compare "Current state" excerpts against live code; mismatch =
> STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx (accessibility)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: **Audit finding.** RepForge is a mobile PWA used one-handed and at
  6am; screen-reader/keyboard correctness is table stakes and cheap here.

## Why this matters

Several interactive controls advertise ARIA roles but never update state, and
one clickable control isn't keyboard-operable:

1. Day tabs and the volume-window segmented control declare `role="tab"` inside
   `role="tablist"` but never set `aria-selected` — only a CSS `.active` class.
   Screen readers announce every tab as unselected.
2. The bottom `nav` buttons use `.active` class only; no `aria-current`.
3. The heat gauge (`#heatGauge`) is a `<span>` with a JS `onclick`
   (`updateGauge`, `app.js:201`) — not focusable or keyboard-activatable.

## Current state

- Day tabs (`renderTabs`, `app.js:144-146`): buttons get `class="${d===day?"active":""}"`
  and `role="tab"` but no `aria-selected`. Container `#dayTabs` is
  `role="tablist"` (`index.html:42`).
- Volume window (`index.html:67-70`): `role="tablist"` with `role`-less buttons
  toggled by `.active` in `renderCompleted` (`app.js:290`).
- Bottom nav (`index.html:126-132`): buttons toggled via `.active` in `init`
  (`app.js:487`); no `aria-current`.
- Heat gauge (`index.html:25-28`): a `<span id="heatGauge" class="gauge">` given
  an `onclick` and `style.cursor` in `updateGauge` (`app.js:200-201`). Not a
  button, not focusable.
- Views/sections have `aria-label` (`index.html:34,56,76,82,98`) but tabs don't
  reference them via `aria-controls` (optional; not required by this plan).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `app.js` — set `aria-selected` on day tabs and volume-window buttons; set
  `aria-current` on nav; make the gauge keyboard-operable.
- `index.html` — change `#heatGauge` from `<span>` to `<button type="button">`
  (keeps id/classes) and give volume-window buttons `role="tab"`.
- `test/simulation.mjs` — a check that the active day tab has `aria-selected="true"`.

**Out of scope**:
- Full `aria-controls`/`tabpanel` wiring and roving-tabindex keyboard arrow
  navigation (larger; note in maintenance).
- Visual design changes (the gauge must still look identical).

## Git workflow

- Branch: `advisor/012-accessibility`
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 1: `aria-selected` on day tabs

In `renderTabs` (`app.js:145`), add `aria-selected`:

```js
$("#dayTabs").innerHTML=ds.map(d=>`<button type="button" role="tab" aria-selected="${d===day?"true":"false"}" class="${d===day?"active":""}" data-day="${esc(d)}">${esc(d)}</button>`).join("");
```

### Step 2: Volume-window buttons become real tabs

In `index.html:68-69`, add `role="tab"` to both buttons. In `renderCompleted`
(`app.js:290`), set `aria-selected` alongside the class:

```js
$$("#volWindow button").forEach(b=>{const on=+b.dataset.win===volWindow;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});
```

### Step 3: `aria-current` on bottom nav

In `init()` nav wiring (`app.js:487`), set `aria-current`:

```js
$$("nav button").forEach(b=>b.onclick=()=>{$$("nav button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render()});
```

Also set the initial state once after wiring: `$("nav button.active")?.setAttribute("aria-current","page");`

### Step 4: Gauge as a keyboard-operable button

In `index.html:25-28`, change the wrapper element from `<span id="heatGauge"
class="gauge" …>` to `<button id="heatGauge" type="button" class="gauge" …>`
keeping the inner `.gauge__fill`/`.gauge__label` spans. In `updateGauge`
(`app.js:200-201`), the existing `g.onclick` and `g.style.cursor` still work; a
`<button>` is focusable and Enter/Space-activatable for free. Ensure `styles.css`
`.gauge` doesn't rely on it being a span (reset default button chrome —
`background:none;border:0;font:inherit;`), so it looks identical.

**Verify**: `node --check app.js` → 0. Keyboard-tab to the gauge → it focuses;
Enter scrolls to the first hot lift (same as click). Visually unchanged.

### Step 5: Simulation check

In `test/simulation.mjs`:

```js
await nav(page, "log");
await selectDay(page, "Day 1");
assert(
  (await page.getAttribute('#dayTabs button[data-day="Day 1"]', "aria-selected")) === "true",
  "Active day tab exposes aria-selected",
  "Active day tab missing aria-selected=true",
  "Log → select a day → its tab is aria-selected"
);
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js`.
- Manual: keyboard-tab through day tabs, nav, and the gauge; confirm focus rings
  and Enter/Space activation; confirm the gauge looks identical to before.
- Simulation: aria-selected check; existing 61 stay green (the gauge is `#heatGauge`
  either way; confirm no check selects `span#heatGauge` specifically —
  `grep -n "heatGauge" test/simulation.mjs`).

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Active day tab and volume-window tab report `aria-selected="true"`
- [ ] Active nav button reports `aria-current="page"`
- [ ] `#heatGauge` is a `<button>`, focusable and Enter/Space-activatable, and
      visually identical
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: excerpts don't match live code.
- If changing `#heatGauge` to a button alters layout (button box model) and it
  can't be reset to look identical with a few CSS resets, STOP and report — do
  not ship a visual regression.

## Maintenance notes

- Full arrow-key roving tabindex and `aria-controls` → tabpanel wiring is a
  worthwhile follow-up but out of scope here.
- New role="tab" controls must set `aria-selected` on state change, not just a
  CSS class — reviewers should enforce this.
