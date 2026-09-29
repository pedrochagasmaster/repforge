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

- **Tune** (`data-entry-step` = the station of the last touched pin): the
  readout plate (program name, tag, facts, days) followed by the seven
  stacks, all open. Each tap recompiles and shows the identity-diff change
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
  done/now/next). Mode switch is a two-plate stack with the pin. Import
  review rows are plates whose empty pin hole is ringed yellow until a
  decision drops a pin in; commit stays locked until none remains.
- Dialogs are lockout tags (hazard edge, stencil title).

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

## Verification

- `verify.mjs --round 4 --candidates l`: 168/168 checkpoint cells without
  hard failures, 0 warnings, 30/30 journey runs, 35/35 interaction checks.
- Impeccable detector (run once): 2 `side-tab` warnings on full-width hazard
  bands; the import-row stripe was removed (the ringed pin hole carries the
  state), the landing panel's hazard floor edge was kept as the world's
  base. 92 advisories compare against the app's DESIGN.md ramp, which this
  candidate deliberately does not use (brief: each candidate owns its world).
- Inspection: one batched round (PT light 390, PT light 320 at 200%, EN dark
  390; reduced motion via K-21), one confirmation round. Fixed in batch: the
  tune readout pushed the first stack below the fold (days now collapsed in
  tune), the lock reason ran to three lines (names only when ≤3 missing),
  an odd tile gap (place spans the board), header/Privacy labels overflowing
  at 200%, and the paste-door restart dialog not returning focus.
