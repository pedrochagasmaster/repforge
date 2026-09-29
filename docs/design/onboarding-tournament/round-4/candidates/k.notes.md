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
  question station's sign reads "Sentido: Seu programa".
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

## Finish review: FIX round (all eight fixes in one batch)

1. **Map as a network.** Route-choice and hub-existing are redrawn as rails
   and lines on the ground. The coloured track is the tap target, runs into
   the terminal rail, and carries the station names on its dots. Each
   description sits outside the line as secondary text, and no card scaffold
   remains.
2. **Landing diagram.** An octilinear SVG:
   - A ring-marked interchange capsule.
   - Five parallel lines at 45°.
   - Every line joins the right-hand terminal rail, which feeds Seu programa
     and then Hoje.
   - There are no per-row end capsules and no detached legend.
   - The yellow line's casing stays inside the rails.
3. **Hub-existing.** The eyebrow is gone. The heading reads "Programa ativo:
   Full body A/B".
4. **ff-reply.**
   - One heading: "Colar a resposta do assistente", on the question line.
   - The pasted-text summary is the Colar station's note ("Colar · 8 linhas
     coladas", with "Editar o texto").
   - "Importar da área de transferência" is the only black primary, and
     "Revisar o programa" is secondary.
   - The textarea's label is visually hidden, and the placeholder says "Ou
     cole a resposta do assistente".
   - Stage 2 lost its duplicate heading too.
5. **Activation conflict.** The alert sits below the station band, inside the
   station body, with its frame intact. The programmatic focus outline no
   longer overlaps the text above it.
6. **Import badges.** Sentence case, no letter-spacing, `overflow-wrap:
   normal` and `hyphens: auto` (the page is `lang="pt-BR"`).
7. **320 at 200% text.**
   - The strip shows the current station's name and the stations left.
   - The band's padding and roundel are compact.
   - The question line and group labels are capped.
   - The lede follows the controls.
   - The first answer control is now in the first viewport on every station.
   - The landing trust line anchors its shield to the first line.
8. **One icon system.** The CSS-border chevrons are replaced by the arrow's
   SVG arrowhead, at the same stroke.

**Ceiling items:**
- A black "Saída" exit sign for Cancelar.
- "Sentido: Seu programa" on the last station's go sign.
- An interchange ring heading the Baldeação panel.

## Verdict pass: last batch

- At 200% text or below 360 px, the landing map switches to an HTML network
  (`miniNetwork()`). Its line names and terminal labels scale with text and
  clear the lines. The SVG stays at wider widths with 100% text.
- The "Saída" sign is now outlined and panel weight, lighter than the black
  go sign.

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

The last run was `node tools/verify.mjs --round 4 --candidates k`, after the
FIX round. It had zero hard failures and zero warnings: 168/168 checkpoint
cells, 30/30 journeys and 35/35 interaction checks. Rafael needs 14 taps from
landing to Today, and the correction from the review takes 6 (the bound is
6).
