---
version: 1
slug: "arding-tournament-round-4-candidates-k-js-29da62be"
primary_target: "docs/design/onboarding-tournament/round-4/candidates/k.js"
related_targets: []
---

# Surface brief: Round 4 · K · Linhas (onboarding tournament candidate)

Scope: the Round 4 core onboarding journey rendered by `round-4/candidates/k.js` + `k.css` (landing, line map chooser, Recommend stations, review, activation, paste door and import review, existing-program states). Mode: Operate (the lifter completes setup), with a Persuade first viewport on the landing.

Audience and job: a self-directed Brazilian lifter, PT-BR first, phone in one hand, who must pick a way in, answer or paste, check the program and start it. Proof and content come only from the real engine (TF/TS) and shared fixtures. Constraints: 320–430 px, 200% text, light and dark, reduced motion, 44 px targets, no invented numbers, no celebration, no bull/forge/Latin.

## Direction contract

THESIS: Setup is a trip on a metro network. The five ways in are five coloured lines on one map, each step is a station, the cost of a route is counted in stations, and every line ends at the same terminal: your program, then Today. It refuses the category default of a card chooser plus a numbered wizard with a thin progress bar.

OWN-WORLD: São Paulo Metrô wayfinding. Concrete-grey ground, white enamel panels, black station-name bands with a line-coloured stripe, line roundels, station dots on thick coloured rules, square corners. Line colours carry routes (1 Azul Recomendar, 2 Verde Personalizar, 3 Vermelha Importar, 4 Amarela Montar, 5 Lilás Explorar); ink and white do everything else. Archivo for signage and UI, Archivo Narrow for station labels and data. Dark is the night platform: charcoal ground, backlit light signs, brightened line colours.

STORY: The lifter sees the whole network, understands that Recommend is four stations and pasting is four more, boards a line, watches each answered station light up with their answer written on it, can step back to any passed station, and arrives at a terminal where the program is drawn as a line of training days, then boards Today.

FIRST VIEWPORT: Landing at 390×844: a black station band across the top with the mark and "Taurifer" as the station name and Privacidade at its right; below, the headline set large in Archivo 800; then a live diagram of the five coloured lines leaving one interchange and converging on a terminal marked Seu programa → Hoje, filling the middle third; the two actions (Montar meu programa as the black sign with a blue arrow block, Acompanhar meu programa atual as the outlined sign) sit in the lower third; the Today proof image follows below the fold.

FORM: Metro wayfinding system (line map, one-line in-car diagram, station signage). Position 1 on the ordered list for this direction (the card K · Linhas, assigned by the Round 4 brief). Seed key 41ef581f. Signature interaction: the Diagrama unifilar, the in-car one-line strip at the top of every station: passed stations light up in the line colour and carry the lifter's answer, the position marker travels to the next station on each Continue, any passed station is one tap back; Baldeação (transfer) keeps shared answers when switching line.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Round 4 note: the orchestrator runs the finish review and owns DESIGN.md; this candidate documents its world in `round-4/candidates/k.world.md` instead, and ships no rasters of its own.

Unresolved: Custom, Browse and Build lines are functional but outside the Round 4 core polish bar.
