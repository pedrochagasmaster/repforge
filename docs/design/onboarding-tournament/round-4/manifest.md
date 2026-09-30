# Round 4: manifest

Round 4 is five deliberately different onboarding directions, H to L. The
owner found Round 3's G too close to today's layout (`round-3/manifest.md`)
and asked for bolder ideas, each in its own visual world. Each direction was
built to finish quality on the core journey only: the 21 `CORE_CPS` states
and 12 core journeys in `tools/verify.mjs`. The owner picks what advances.
Reviews and the acceptance floor only assist. Brief: `round-4/brief.md`.

- Page: `round-4/app.html?c=<id>&cp=<checkpoint>&lang=pt|en&theme=light|dark&text=100|200&motion=normal|reduced`
- Review page: `index.html?round=4` (the state picker lists only the core states, from `ROUNDS[4].core` in `harness.js`)
- Baseline: PR #256 at `f61ce44b`, as in every round. G (Round 3) stays in the harness as the conventional arm.
- Every direction runs on the same real engine, fixtures and checks as Rounds 2 and 3 (`README.md`, *What is real*).

## The five directions

| Id | Name | Thesis | Product decision reopened |
| --- | --- | --- | --- |
| H | Concreto | Each screen is one concrete-poetry composition: one monumental lowercase word states the decision, the answers are words placed on a six-column grid, and the program is set as a poster with days as columns of words. | None |
| I | Ficha | Setup is filling in your own gym training card. Each answer is written onto the card in the lifter's pen, the review is the completed card, and activation presses a red "ATIVO" date stamp onto it. | None |
| J | Conversa | Setup is a message thread. Quick replies answer the questions, and the lifter corrects the program by replying to a line of it. No typing indicator, no "I", no free-text reading. | **PD-1**: no chooser; paste and file are offered as buttons on the first message |
| K | Linhas | Setup is a trip on the São Paulo metro. The five routes are lines on one map, each step is a station, route cost is counted in stations, and every line ends at one terminal. | None |
| L | Pino | The program exists before the questions. Each answer is a selector pin on a weight stack. The program recompiles on every pin, and activation stays locked until the lifter has set every pin. | **PD-4**: a program compiled from labelled defaults ("Ainda não é seu") before any answer; activating defaults is impossible |

### Worlds

Each world is documented in `round-4/candidates/<id>.world.md` (palette with
roles and contrast, type, components, motion, dark rendition). Round 4 has no
`DESIGN.md`. That file belongs to the app.

| Id | World | Type (self-hosted, OFL) | Signature interaction |
| --- | --- | --- | --- |
| H | 1950s São Paulo concretists: white paper, black ink and rules, one vermilion field (`#E0251A`) that only ever means "what the lifter decides". Square everything. | Jost | "O verso": each answer is set as a word into a running verse, and on the review the verse becomes the poster's colophon. Each line reopens that group of answers. |
| I | Coloured cardstock with three materials that never mix: print (Taurifer), BIC-blue pen (the lifter), red stamp ink (activation and destructive acts). | Sofia Sans, Sofia Sans Condensed, Kalam (pen only) | "Escrito na ficha": every mark is drawn and each answer is written into its printed field. A correction strikes the old answer through in pen beside the new one. |
| J | A messaging thread in Taurifer's own material: sage wallpaper printed with training notation, white bubbles for Taurifer, signal-orange bubbles for the lifter, graphite app bar. | Atkinson Hyperlegible Next and Mono | Reply to correct: swipe or tap any answer or "Montado com" line. The reply quotes it, and a new version of the program arrives with the change statement. |
| K | Metrô wayfinding: platform-concrete ground, white enamel panels, five line colours (one per route, never the only signal), station bands, roundels. | Archivo, Archivo Narrow | "Diagrama unifilar": the in-car one-line strip at the top of every station. Passed stations light up and carry the answer, and "Baldeação" switches Recommend ↔ Custom keeping shared answers. |
| L | Flat black powder coat and zinc primer, a steel rod through stencilled plates, one safety yellow for the lifter's choices, and a hazard stripe for what is not theirs yet. | Big Shoulders Stencil Display, Barlow, Barlow Condensed | The pin drop: the pin moves to the tapped plate, the changed facts flash, and new exercises carry "novo". When the last pin is set, the machine locks into the review. |

### Files

| Id | Candidate | Direction contract | Fonts and assets |
| --- | --- | --- | --- |
| H | `round-4/candidates/h.{js,css,notes.md,world.md}` | `.impeccable/surfaces/arding-tournament-round-4-candidates-h-js-20ba48f4.md` | `round-4/fonts/jost/`; own Today capture `round-4/assets/h/` (PROVENANCE.txt) |
| I | `round-4/candidates/i.{js,css,notes.md,world.md}` | `…-candidates-i-js-0a7c3a79.md` | `round-4/fonts/{sofia-sans,sofia-sans-condensed,kalam}/`; own Today capture `round-4/assets/i/` (PROVENANCE.txt) |
| J | `round-4/candidates/j.{js,css,notes.md,world.md}` | `…-candidates-j-js-71537a32.md` | `round-4/fonts/{atkinson-hyperlegible-next,atkinson-hyperlegible-mono}/` |
| K | `round-4/candidates/k.{js,css,notes.md,world.md}` | `…-candidates-k-js-29da62be.md` | `round-4/fonts/{archivo,archivo-narrow}/` |
| L | `round-4/candidates/l.{js,css,notes.md,world.md}` | `…-candidates-l-js-a1ee4a5f.md` | `round-4/fonts/{big-shoulders-stencil-display,barlow,barlow-condensed}/` |

J, K and L use the production Today capture (`vendor/brand/`) as the landing
proof. H and I show a capture of their own activated Today (see K-23 below).

### Scope

All five reach every core state and export every core journey. Outside the
core, each falls back to the nearest view, as the brief allows:

- **H and K** build Custom, Browse and Build, but those routes were not
  polished to core level.
- **I** reuses the restyled shared widgets on its non-core routes.
- **J** does not offer Custom, Browse or Build anywhere in the thread (the
  cost of PD-1 here). If J advances, those routes need a place.
- **L** draws only Recommend, paste and file on its chooser. Custom and
  Browse fall back to the chooser.

## Acceptance at freeze

Freeze commit: **`b7753d9`** (candidate files as at `0c0d15c`; `b7753d9` changes only the verifier's screenshot step, below). Command:

```bash
node docs/design/onboarding-tournament/tools/verify.mjs --round 4 --candidates h,i,j,k,l
```

It covers the 21 core checkpoints in all 8 cells, the 12 core journeys in
cells 1 and 6, and the interaction checks, including the tap-every-control
pass. Every hard check is a failure.

**The freeze run at `b7753d9` is in progress.** H is complete with zero hard
failures and zero warnings. The table below will be filled in when all five
finish. On each builder's last run, every candidate had 168/168 checkpoint
cells, 0 warnings, 30/30 journeys and 35/35 interaction checks.

| Taps (Rafael) | H | I | J | K | L | G (Round 3) |
| --- | --- | --- | --- | --- | --- | --- |
| Landing → Today | 18 | 13 | 11 | 14 | 10 | 13 |
| Correction from the review (bound 6) | 6 | 6 | 6 | 6 | 6 | 6 |

H is the slowest by design: one decision per screen, a tap to answer and a
tap to continue, with no auto-advance, so focus stays on the chosen answer. L
is the fastest: a chooser tap, seven pins and activation.

## Review process

Every candidate went through the same loop, with a fresh
`impeccable-finish-reviewer` agent for each review:

1. **Build.** One builder per direction followed the brief's Impeccable
   process: direction contract, one batched screenshot round, one detector
   run, then the acceptance floor to zero hard failures.
2. **Full finish review.** The reviewer returned a disposition and a
   numbered fix list, plus optional "ceiling" items.
3. **Fix batch.** The builder applied every fix in one batch, plus the
   ceiling items it took, and reran the acceptance floor.
4. **Verdict pass.** A reviewer checked each fix against the list. Where it
   found leftovers, the builder applied one last batch.

| Id | Disposition | What the batches changed |
| --- | --- | --- |
| H | Fix batch, then verdict | Own Today capture with its own alt; the composition fits the first viewport at 200% text; brand copy restored (per commit `e519d68`; `h.notes.md` has no itemized fix list) |
| I | FIX (8 fixes + ceiling) | No ink on empty marks; print/pen/stamp rule enforced; drawn pen strike; the card head folds at 200% text; own Today capture and printed-grid Today (`i.notes.md`) |
| J | Fix batch, then verdict | Composer usable at 200% text; lighter notation wallpaper (per commit `1dbf357`; `j.notes.md` has no itemized fix list) |
| K | FIX (8 fixes + ceiling) | Chooser redrawn as a real network; octilinear landing map (HTML network at 200% / below 360 px); ff-reply single heading; conflict alert placement; one icon system (`k.notes.md`) |
| L | **REBUILD**, then FIX (8 fixes + ceiling) | Rebuilt as flat powder coat (no grain or bevels), pin chooser instead of cards, plate-stack import review; then first-viewport, paste-placard and picker fixes (`l.notes.md`) |

The reviewers' own reports were working files and are not committed. The
candidate notes record what each batch changed.

L is the only direction rebuilt. Its first build read as a textured 3D object
and put cards on the chooser. The rebuild kept the topology, interaction and
copy, and a fresh review of the rebuild returned FIX.

## Harness changes made during the round

- **K-23 (`b4efd7b`).** The landing-proof check now also accepts a
  candidate's own Today capture marked `data-proof-own` with its own alt of at
  least 40 characters. The production alt describes the production
  screenshot (week 5 of 6). An own capture shows week 1, so pinning the
  production alt would force an untrue description. H and I use this path,
  and each capture's source is recorded in `round-4/assets/<id>/PROVENANCE.txt`.
- **K-18 with PD-4 (`2ab74ce`).** A direction declaring PD-4 may show a
  program before the answers. It must still refuse to activate until every
  required answer is the lifter's own.
- **Over-tall evidence shots (`b7753d9`).** The first freeze attempt at
  `0c0d15c` did not complete. J's thread at 320 px and 200% text is 10,100 to
  11,600 CSS px tall, past what Chromium can capture at DPR 2. The full-page
  capture failed, was counted as a hard failure, and then crashed the
  browser. The verifier now clips a full-page shot taller than 16,000 device
  px from the top and marks it `shotClipped` in `results.json`. No check
  changed: the audit had already read the whole page, and the same four
  states passed once the capture was clipped. The candidates' files are
  unchanged since `0c0d15c`.
- **Registration (`d4d7b2e`).** `ROUNDS[4]` in `harness.js` declares the core
  states, so the scenario and state pickers and prev/next stepping show only
  those. `index.html` has the Round 4 option.

## Production finding

**PF-1** (`round-4/production-findings.md`): the growth 3-day Day 1 is named
"Lower body hypertrophy" / "Hipertrofia de membros inferiores" but contains
Machine chest press, Seated machine row, Cable lateral raise and Cable curl.
The name and the contents both come from the real engine and catalogs. The
reviewers for J and L flagged it independently, and no candidate changes
it. It needs its own production change.

## Optional polish left undone

L's last review listed three optional items. None blocks, and none was done:

- the import action-plate labels wrap;
- the pin shaft overhangs the toggle plates;
- "séries de trabalho" was shortened to "séries".
