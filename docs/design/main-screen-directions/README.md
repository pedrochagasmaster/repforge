# Main-screen directions

A standalone review page with three design directions for Taurifer's main
screens. It is review material only: nothing here is loaded by the app,
precached by `sw.js`, or captured by the UI screen catalog, and the app shell
(`index.html`, `styles.css`, `app.js`) is untouched.

Serve the repository root over HTTP and open
`docs/design/main-screen-directions/`:

```bash
python3 -m http.server 8000   # then http://localhost:8000/docs/design/main-screen-directions/
```

The page loads the self-hosted Plex fonts from `fonts/` and the licensed
exercise plates from `assets/exercises/` by relative path, so it has to be
served from the repo root.

## Controls

- **Direction**: A, B, C (keys `1` `2` `3`).
- **Screen**: eleven screens (arrow keys move between them). The phones are
  live where it matters. Steppers change values, *Why* opens the inspector,
  logging a set starts the rest timer, and the rest timer counts down.
- **PT / EN**: Portuguese is the default. Validate there first.
- **Light / Dark**: the app's own token swap (ADR 0009), not a second design.
- **360 / 390 / 430**: phone widths.
- **One screen / All screens**: one phone with its note, or the whole
  direction side by side to judge it as one system.

Deep links use a bare hash, for example `#b-workout` or `#c-why`.

## The three directions

| | Direction | Idea |
| --- | --- | --- |
| A | **Folha de treino** (training sheet) | Every screen is a page of the training record: figures in aligned mono columns, marks in a left margin, hairlines instead of boxes. No cards; a flat bottom bar whose active tab carries the orange mark. |
| B | **Um polegar** (one thumb) | Built at arm's length: read in the top half, act in the bottom third. During a session the dock gives way to a raised action shelf with large pads; rest takes the whole screen; figures are sized to read from a bench. |
| C | **Evidência** (evidence) | Every number carries its proof: the engine's answer leads, and the record that produced it is drawn beside it. Rep-range tracks, before and after slopes, and an evidence chain replace paragraphs. |

All three keep the design language in `DESIGN.md`: warm paper, near-black ink,
one burnt-orange mark for what is live or changed, Plex Sans for prose and Plex
Mono for measurements, tabular figures, 44 px minimum targets, flat content
surfaces, and floating material only for docks, shelves and sheets.

## What changes in every direction

These came out of reviewing the current catalog captures in PT-BR and apply
regardless of which direction is picked:

- **Today shows today's prescription.** The engine already knows the squat goes
  from 100 kg to 102,5 kg for 7 reps; the ready screen now says so instead of
  showing the template's `3 × 4–8`. The separate *Prévia da sessão* button is
  no longer needed.
- **The session summary ends with *Na próxima vez*.** PRODUCT.md defines
  success as finishing a session knowing what the next one asks; the summary
  now lists the next target for every lift it just recorded.
- **Fewer uppercase eyebrows.** Section labels become sentence-case headings;
  the 11 px uppercase tier stays only on table column heads.
- **One level of tabs on Progress** (Visão geral, Força, Volume, PRs, Revisão)
  instead of tabs inside tabs, and every attention item carries its reason.
- **History is not a full-screen calendar.** Each direction compresses the
  month (a one-line strip, a compact grid, or a dotted grid) so sessions are
  visible on the first screen.
- **No celebration.** The check-circle on the summary is gone. Declines are
  ink, not red; records are the only green.

## Data

One lifter, one program (*Corpo todo*, three days, six-week mesocycle started
31 Aug 2026), viewed on Monday 21 Sep (week 4, *Dia 1*). Exercise names, ids,
muscles and plate colours come from `exercises.js`. Every session is authored
set by set in `data.js`; totals, PRs, outcomes and hard sets by muscle are
derived from it, so the summary, History and Progress always agree.

Recommendations (`TODAY_REC`, `SQUAT_SET2`, `NEXT`) were produced by running
`progression-engine.js` on that exact history with the app defaults (2.5 %
jump, 2.5 kg minimum step, hard-RIR cap 4). The *Why this weight* copy follows
the app's `why.*` strings for the `range.performed_top` path. Terms follow
`CONTEXT.md`.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page shell and controls |
| `review.css` | Review-page chrome, theme-aware |
| `phone.css` | App tokens scoped to `.ph`, plus the three directions' styles |
| `data.js` | Program, sessions, engine outputs and derived figures |
| `kit.js` | Shared glyphs (copied from `styles.css`), charts, formatting |
| `dir-a.js`, `dir-b.js`, `dir-c.js` | One renderer per direction |
| `main.js` | Controller and live interactions |
