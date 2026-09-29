# K · Linhas: build notes

Files: `round-4/candidates/k.js`, `k.css`, `k.world.md`, `k.notes.md`, and
fonts in `round-4/fonts/archivo/` and `round-4/fonts/archivo-narrow/`. Page:
`round-4/app.html?c=k&cp=<checkpoint>&lang=pt|en&theme=light|dark&text=100|200&motion=normal|reduced`.
The direction contract is in the surface brief:
`.impeccable/surfaces/arding-tournament-round-4-candidates-k-js-29da62be.md`
(seed `41ef581f`, code-led).

## Thesis

Setup is a trip on a metro network. The five ways in are five coloured lines
on one map, each step is a station, and the cost of a route is counted in
stations: Recomendar has 4, Personalizar 6, Programas prontos 3, Montar do
zero 1, and Trazer o seu 4 by pasting or 2 with a file. Every line ends at the
same terminal, your program, and after it comes Today.

**Signature interaction: the Diagrama unifilar.** The in-car one-line strip
sits at the top of every station. Passed stations light up in the line colour
and carry the lifter's own answer. The passed rule travels to the next
station on each Continue, and any passed question station is one tap back.
**Baldeação** (transfer) switches between Recomendar and Personalizar at a
shared station and keeps the shared answers.

## Product decisions

**None reopened.** PD-1 to PD-4 and the question set stay as closed. The
line map is the chooser, and it marks `route-choice`. Recommend asks every
required answer, including minutes and rest. No program exists before the
answers, and nothing persists before activation.

## Where it departs from G (and why)

- The chooser is the network map rather than cards. The goal question is not
  embedded in it (G's Q627 graft), because the map shows every line equally.
  As a result, Rafael takes 14 taps from landing to Today, one more than G's 13.
- Titles are short station names ("Agenda", "Local"), with the production
  question set as the line under the band. There are no eyebrows anywhere.
- The Continue labels name the next station ("Próxima: Local"), and the last
  question station says "Mostrar meu programa".
- The cancel dialog uses K copy in PT-BR ("Salvar e sair", "Descartar e
  sair"), avoiding "guardar".
- "Skip" does not exist. The optional Prioridades station continues with
  nothing chosen.
- The engine, state machine, import and paste-door models, dialogs' focus
  behaviour and journeys follow G's contract through `TF`/`TS`. The paste
  door, gaps, import review, dialogs, environment correction and the avoid
  search are rendered in K's own markup, and state changes still go through
  `TS.freeform.apply` and `TS.importReview.apply`.

## Not at core polish

Personalizar (its emphasis and preference stations), Programas prontos,
Montar do zero, the shared-link gate, resume and rules-changed all work in
the K vocabulary, but they reuse shared widgets (`TS.muscleEmphasis`,
`TS.exercisePrefs`, `TS.build.editor`) restyled through `.k-legacy`. They
were not inspected at finish quality.

## Detector (run once)

After the mechanical fixes, the remaining warnings are:

- The `side-tab` finding on `.k-sign--map::after` is a false positive. It is
  the horizontal five-line band under the map's station band.
- The advisories about radii, sizes and colours outside DESIGN.md are expected,
  because K owns its world.

The two fixes were: the strip fill moved from a `width` transition to
`transform: scaleX`, and the Privacy stub's accent borders became inset
shadows.

## Verification

The last run was `node tools/verify.mjs --round 4 --candidates k` (see the
report). It had zero hard failures: 168/168 checkpoint cells, 30/30 journeys
and 35/35 interaction checks. Rafael needs 14 taps from landing to Today, and
the correction from the review takes 6 (the bound is 6).
