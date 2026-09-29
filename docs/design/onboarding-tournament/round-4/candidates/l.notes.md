# L · Pino: build notes

Files: `round-4/candidates/l.js`, `l.css`, `l.notes.md`, `l.world.md`; fonts
under `round-4/fonts/{big-shoulders-stencil-display,barlow,barlow-condensed}/`.
Page: `round-4/app.html?c=l&cp=<checkpoint>&lang=pt|en&theme=light|dark&text=100|200&motion=normal|reduced`.
Direction contract: `.impeccable/surfaces/arding-tournament-round-4-candidates-l-js-a1ee4a5f.md`
(seed key 41ef581f, code-led, no comp).

## Product decision reopened: PD-4

**PD-4, a program from labelled defaults before the answers.** Declared in the
header comment of `l.js`, in `policy.productDecisions: ["PD-4"]`, and here.

- Recommend opens on a program the real engine compiles (`TF.compile`) from
  the first plate of every column, labelled **"Ainda não é seu · N respostas
  no padrão"** with a hazard tag and a hollow "Padrão" pin in each column.
- Every column is ordered so its first plate is the lightest commitment:
  first structured program, no recent training, 2 days, 30 minutes, "Deixar
  o Taurifer escolher" rest, commercial gym, muscle growth. The default
  program is therefore a small novice program (10 exercises, 14 sets, about
  29 minutes), never an intermediate lifter's program (R-1). It does not
  equal Rafael's program, so every pin visibly changes something.
- **Activating defaults is impossible.** The activation control is
  `aria-disabled` with a visible reason ("Faltam 7 respostas." / "Falta 1
  resposta: descanso.") until all seven pins were tapped by the lifter.
  Tapping it while locked scrolls to the first pin still at its default.
  Tapping the default plate counts as the lifter's answer; there is no
  "accept all defaults" control.
- The defaults never leave the display layer: `entry().answers` holds only
  the lifter's own answers, `entry().result` is `null` until every pin is
  theirs, a kept draft stores only their answers, and activation commits
  only a state built from their seven answers.
- PD-1, PD-2 and PD-3 stay closed: "Montar meu programa" opens a chooser
  (route-choice), and minutes and rest are pins like the others.

## Journey shape

Landing → chooser → the machine (tune) → the machine locks (review) → Today.

- **Chooser** (route-choice / hub-existing): one stack on one rod. Recommend,
  Colar de qualquer lugar and Importar um programa are numbered plates; the
  pin rests in plate 1, drops into the plate the lifter taps (FLIP, 380 ms)
  and the route opens. With reduced motion the route opens at once.

- **Tune** (`data-entry-step` = the station of the last touched pin): the
  readout plate (program name, tag, facts, Day 1 open with its exercises)
  followed by the seven stacks, all open. Each tap recompiles and shows the identity-diff change
  statement under that stack. A compact strip with the live facts slides in
  when the readout scrolls away (390/430 px at 100% only).
- **The pin drop** (signature interaction): the knob FLIPs from its old plate
  to the tapped one, changed facts flash, new exercises carry a "novo" tag.
  When the last pin goes in, the machine locks into the review: the hazard
  tag becomes "Seu programa · As 7 respostas são suas", the pin board seats
  in, the activation plate turns yellow.
- **Review** (`result`): readout (day 1 open), then the pin board. Each tile
  pulls its pin into an inline editor: the stack recompiles live against the
  program before the pull, "Confirmar" keeps it (statement moves to the
  readout, focus and scroll follow it, K-28), "Desfazer a mudança" / "Fechar
  sem mudar" restores. While a pin is pulled the pinned activation is
  hidden. Place correction (equipment and capabilities) is expanded inside
  the pulled place pin, so the correction costs 6 taps (bound 6).
- Back from the review returns to tune with every answer kept; tune then
  offers "Ver o programa completo" to lock again.
- **Paste door** is the machine's numbered instruction placard (three steps,
  done/now/next). Mode switch is a two-plate stack with the pin.
- **Import review**: each row is a plate stack under "Como veio: <name>".
  Plates: the shortlist matches (library names), Manter o nome importado,
  Criar personalizado, Escolher na biblioteca. A hollow pin marks the
  suggestion ("Sugerido"); the lifter's tap drops the yellow pin and folds
  the row to its decided plate with "Alterar". No duplicated match line, no
  status chip (status stays in a visually-hidden label for screen readers),
  no yellow buttons. Commit stays locked until no row is open.
- Dialogs are coat cards with a steel top edge; the hazard stripe is kept
  for "not yours yet" and lockouts only.

Rafael, landing to Today: 10 taps (Montar meu programa, Recomendar, 7 pins,
Usar este programa).

## Scope

Core checkpoints and core journeys only (brief §3). Custom, Browse and Build
are not drawn; their checkpoints fall back to the chooser, and the chooser
offers Recommend plus the two import doors (paste, file). This is a gap
against P054's five-job chooser that a later round must close; the machine
extends naturally (Custom is the same machine with emphasis, exercise and
structure pins; Browse is three pins over a live catalogue count). The
shared-link gate falls back to the landing. Also exported beyond the core:
`activate.import-file`, `cancel.keep-resume`, `back.import`,
`destroy.discard-draft`, `existing.*`, `avoid.from-review` (not run by the
Round 4 verifier).

## Copy decisions

- Brand rule "avoid metaphor labels": the word "pino" never appears in copy.
  The pin lives in the visuals; copy stays literal ("respostas", "padrão",
  "Sua escolha").
- Overrides: `entry.cancel_confirm.keep` → "Salvar rascunho e sair" (EU-PT
  "Guardar"); `entry.rules_changed.rebuild` → "Montar de novo com as regras
  atuais" ("Recompilar" contradicted its body).
- Short tile values avoid K-16 words ("A maior parte das sessões", not
  "maioria").

## Rebuild (finish review disposition REBUILD)

Topology, interaction model and copy kept. Rebuilt in one batch:
1. Material is flat powder coat: no grain, no bevels, no gradient rod. The
   machine reads through geometry: a flat steel rod through every pin hole,
   a single-stroke SVG pin (ring and shaft), stencilled numbers on every
   plate (numeric plates are their own numbers).
2. Tune readout at 390 shows Day 1's exercises; the tune paragraph is
   shortened (PT and EN).
3. Chooser redrawn as the machine (above); no cards, no icons.
4. Import review rebuilt as plate stacks (above).
5. Hazard stripe only on the "Ainda não é seu" tag, the default-state tag
   and locked actions; removed from the landing floor, the placard head and
   dialogs.
6. At 320 px and 200% text Voltar and Cancelar share one row and the locked
   activation is about 60 px; at 390 the compact strip puts its facts on
   their own line.
7. Facts separators sit before each fact and are clipped at every line
   start, so none dangles; pin-board keys are top-aligned with one value
   size.
8. Reason list: equipment is lowercased mid-sentence (Smith kept). Day
   titles come unchanged from the shared `TF.dayName`. The growth_3 titles
   ("Hipertrofia de membros inferiores" over a knee/horizontal full-body
   day) are the production catalog's own names, logged by the coordinator
   as a production finding and left as they are.

## Fix batch (finish review disposition FIX, after the rebuild)

1. First viewport (rec-goal, 390×844): the readout keeps Day 1's exercises
   and the whole Objetivo stack (three plates, the dashed "Padrão" pin) sits
   above the lock bar. Day meta is one line ("5 exercícios · 7 séries · ~29
   min"), exercise rows are about 30 px with no rules, the facts are one line
   ("2 dias · ~29 min · 10 exercícios · 14 séries"), and the "Montado com o
   primeiro valor…" paragraph moved below the Objetivo stack.
2. Landing: the proof and privacy line have the 16 px gutter again (a fused
   selector had disabled the rule).
3. No dangling separators: the status tag and the import file and count
   lines use the facts line's clipped leading separator.
4. Equipment, capability, priority and reason pickers are plates with their
   own hole: set pin when chosen, empty hole when not (`role="checkbox"` /
   `"radio"` and `aria-checked` kept).
5. Paste door: a flat instruction placard with ink rules top and bottom,
   stencilled step numerals, rules between steps, the set-pin stroke for a
   finished step and "Editar" as the placard's own underlined control.
   ff-gaps is the same placard: exercise as the step title, a short
   "Repetições"/"Séries" label, the example only in the placeholder (the
   input is labelled by both).
6. Change statement mark is the single-stroke set pin.
7. Conflict lock has a one-line reason ("O programa ativo mudou · revise de
   novo"; "O programa ativo mudou." at 320 px and 200% text).
8. The compact strip's "N respostas no padrão" carries the hazard stripe.
Ceiling: import rows keep the candidates as plates and put Manter o nome /
Criar novo / Biblioteca in one compact plate row (the pin marks keep or
create); the landing's plate numeral is ink on yellow.
Left alone as instructed: the growth_3 day names (production finding PF-1).

Verify after the fix batch: 168/168 cells without hard failures, 0
warnings, 30/30 journeys, 35/35 interaction checks; Rafael 10 taps; the
correction 6 taps (bound 6).

## Verification

- `verify.mjs --round 4 --candidates l`: 168/168 checkpoint cells without
  hard failures, 0 warnings, 30/30 journey runs, 35/35 interaction checks.
- Impeccable detector (run once): 2 `side-tab` warnings on full-width hazard
  bands; the import-row stripe was removed (the ringed pin hole carries the
  state), the landing panel's hazard floor edge was kept as the world's
  base. 92 advisories compare against the app's DESIGN.md ramp, which this
  candidate deliberately does not use (brief: each candidate owns its world).
- After the rebuild: `verify.mjs --round 4 --candidates l` again 168/168
  cells without hard failures, 0 warnings, 30/30 journeys, 35/35
  interaction checks; Rafael 10 taps; the correction 6 taps (bound 6).
- Inspection before the rebuild: one batched round (PT light 390, PT light 320 at 200%, EN dark
  390; reduced motion via K-21), one confirmation round. Fixed in batch: the
  tune readout pushed the first stack below the fold (days now collapsed in
  tune), the lock reason ran to three lines (names only when ≤3 missing),
  an odd tile gap (place spans the board), header/Privacy labels overflowing
  at 200%, and the paste-door restart dialog not returning focus.
