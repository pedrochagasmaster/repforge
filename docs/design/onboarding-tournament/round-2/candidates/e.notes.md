# E · Uma pergunta por vez: generator notes

Files: `round-2/candidates/e.js`, `e.css`, `e.notes.md`. Not committed.

## Thesis and axis

- **Thesis.** Start is a conversation, not a menu. Taurifer asks one thing at
  a time and builds the program. Every other way to get a program stays one
  explicit, named, reversible step away from the question you are on and from
  the program you are looking at.
- **Axis.** Deferred route choice (PD-1) with single-question screens. The
  review is the hub: the answers, the optional refinements and the other four
  routes all hang off the program, and every answer is corrected inline, in
  place.
- **Where E differs from D (spec §9 requires at least two of O-1 to O-6):** O-1,
  O-2, O-3, O-5, O-6 and O-9 all differ, plus route choice itself (PD-1) and
  O-10.

## Allocation followed (brief, column E)

| Open item | E |
| --- | --- |
| Route choice | PD-1. The landing primary opens Recommend's first question. |
| O-1 grouping | One question per screen. Recommend has 7 questions in 4 semantic sections, because priorities moved to the review. |
| O-2 priorities/avoid | Offered from the review as optional refinements before activation. Avoidance uses a proactive search with a required reason. |
| O-3 facts | An inline fact list at the top of the review, under the name and facts line. |
| O-5 change statement | Changed rows are marked inline and a polite status is announced. |
| O-6 routes from review | Yes. |
| O-7 shared decline | Start only. |
| O-8 landing | Default composition. |
| O-9 answer editing | Inline expansion. |
| O-10 resume card | On the landing. |
| O-11 Build from import | A quiet link, "Prefiro escrever do zero". |

E asks minutes and rest and preselects neither (no PD-2 or PD-3). It shows no
program before the answers (no PD-4).

## How each open item was resolved

- **Route choice (PD-1).** `#firstRunCreate` goes straight to "O que você quer
  deste programa?". Below its three answers, that first screen always shows
  (never collapsed) "Ou comece de outro jeito". This is a hairline list of the
  other four jobs. Each row states what you do and what you get, as facts
  only: section counts come from `ROUTE_STEPS`, and Recommend and Custom have
  different outcome lines. Under the list is a helper, "Não sabe qual caminho
  serve?", that can end at each of the five jobs.
  - The days question offers "Ver programas para {n} dias" once days are
    chosen.
  - The review offers every route again ("Outros caminhos a partir daqui"),
    carrying the answers:
    - Custom takes the four shared sections plus priorities and avoidance, and
      opens on its own muscle-emphasis section.
    - Browse opens straight on the list for your days, minutes and environment.
  - Every switch is explicit. The destination states "Caminho anterior: …
    Suas respostas vieram junto." and offers "Voltar ao caminho anterior".
    Back at the entry point restores the previous route, step, answers and
    result exactly (N-2, N-7).
  - Custom keeps its own route, its 7 sections, its own questions and its own
    provenance ("Programa personalizado pelo Taurifer", "Seu programa
    personalizado").
- **Existing users (the Round 1 failure for this family).** Entering setup
  with an active program lands on the same first question. That screen shows
  the production active-program notice, the full list of the other four jobs
  and the helper, so every job is reachable from the first screen. Every exit
  goes to Today and never to the landing (Back, Cancel, Keep, Discard,
  replacement cancel, conflict).
- **O-1.** Screens: goal → experience → consistency → days → minutes → rest →
  environment → review. The counter reads "Seção n de 4 · <name>" and is
  announced politely. The progress bar draws each question as a tick, and
  ticks are grouped by section, so the count stays semantic (SM-4) while
  showing where you are inside a section. Days and minutes are a 3+2 grid of
  number cards without radio marks, and "90+" stays on one line. The minutes
  question is worded as a ceiling. The rest question says it changes the
  estimated duration, not the exercises, which is the engine's behaviour
  ([S-1]). The last Recommend question's button reads "Montar meu programa".
- **O-2.** The review has an "Opcional" group with two facts: "Sem prioridade
  muscular especial" and "Nenhum exercício evitado".
  - Each opens its own inline editor with its own "Atualizar programa".
  - Avoidance keeps the shared proactive search. "Atualizar programa" stays
    disabled until a reason is chosen, and pain shows the production
    `entry.priorities.pain_note`.
  - Priorities and avoidance are separate editors on purpose. A chest priority
    alone changes 2 of 18 exercises, so one combined Apply could not state the
    avoidance's own consequence truthfully (C-5).
  - "Suas restrições" lists every constraint with "Restaurar". When the
    exercise was never in the program it says so ("Não estava no programa,
    então nada foi trocado").
- **O-3.** Under the program name and the mono facts line, "Suas respostas"
  lists the seven answers as dotted-underline inline buttons (16 px, 44 px
  targets). Each has an accessible name of the form "<label>: <value>. Toque
  para alterar.". The Custom review adds "Suas escolhas": emphasis, exercises
  and structure. The first day heading still sits in the first viewport at
  390×844 (K-22 clean).
- **O-5.** After a recompile, a status line (`role=status`, polite) gives the
  identity diff through the shared `x.change.*` copy, followed by "Saíram: …"
  (or the count). Rows that entered the program get a 2 px accent edge and a
  text tag "novo" (A-6), and the days that contain them open.
  - When every row changed (the limited-home correction replaces all 15), the
    rows are not marked individually. The statement already says "15 dos 15",
    and marking every row would spend the accent on nothing.
  - The answer that caused the recompile keeps a solid accent underline.
- **O-9.** Tapping a fact expands its editor directly under the fact list. The
  editor has the same options and reducer as the question screen, then
  "Atualizar programa" and "Manter como estava".
  - While an editor is open, the pinned activation is removed, so nothing can
    sit over the editor (L-2). The view then scrolls so the confirm control is
    in view.
  - Focus goes to the editor heading, and back to the fact on apply or close.
  - Choosing a different environment opens the equipment and capability
    correction automatically, so the correction needs no extra tap: 6 taps,
    at the K-24 bound.
- **O-10.** The resume card sits on the landing, above the two actions, and
  names the route, step and date. "Retomar configuração" returns to the exact
  sub-question, which is saved in the draft `ui` blob. "Descartar rascunho"
  asks before discarding (C-7). A Recommend draft saved at `priorities` resumes
  on the review with the priorities editor open, because that is where E asks
  priorities.
- **O-11.** The import screen has two quiet mode tabs ("Colar texto" / "Arquivo
  Taurifer") with the paste door as the default, and the link "Prefiro
  escrever do zero".

## PD-1 declaration

- **Depends on:** PD-1 (deferred route choice) and no other product decision.
- **Changes versus Plan 054:**
  - "Start training opens the five-job chooser" becomes "Start opens
    Recommend's first question, which carries the other four jobs as a visible
    list plus a helper that ends at all five".
  - Routes can also be reached from the days question and from the review.
- **Kept from Plan 054:**
  - No merging of Recommend and Custom. Custom has its own route, questions,
    counter and provenance.
  - No hidden expert controls. Custom's muscle and exercise controls are all
    visible, and the four other jobs are never behind a disclosure or a
    generated result.
  - The landing secondary opens Import on the paste door, so importers never
    pass a Recommend screen.
- **Checks it relaxes:** K-19 only, where failures of `chooser.doors` and
  `help.*` would become warnings. None were needed: all six pass in both
  journey cells.
- **Interpretation to note:** in `chooser.doors` the Recommend door is
  snapshotted without a tap. Under PD-1 the "chooser" is Recommend's first
  question, so the lifter is already inside Recommend. The other four doors are
  real taps followed by a real Back.

## Deviations from the spec, with reasons

- **`rec-priorities` checkpoint.** This is the review with the optional
  priorities editor open, not a question step. It follows directly from O-2 as
  allocated. `entry().step` there is `result`.
- **`route-choice` / `rec-goal` / `hub-existing`.** These three checkpoints are
  the same first-question screen (PD-1). The route list carries
  `data-checkpoint="route-choice"`, and the main element carries `rec-goal`
  (fresh device) or `hub-existing` (active program).
- **`entry.freeform.copy`.** Overridden in E's copy to "Copiar o comando",
  which is the spec's ff-handoff wording (the production string reads "Copiar
  o pedido"). It is a copy override only, not an easier widget.
- **Title sizes.** On questions, the program name and the landing headline,
  title sizes are capped with `min(token, max(9–10vw, body × 1.15–1.25))`.
  This keeps long PT words ("estruturados", "exatamente") inside 320 px at
  200% text. It also keeps headings larger than the 200% body text, so the
  hierarchy never inverts.
- **At 200% text:**
  - The pinned primary drops the arrow glyph and uses control size, so "Arquivar
    o programa atual e usar este" stays under a third of a 568 px viewport.
  - Decorative option icons are hidden.
  - The brand row stacks.
- **E's pinned bar** uses a solid `--bg` with a hairline top edge instead of the
  shared gradient. The disabled reason is part of the bar, and with the
  gradient it read over scrolling content.

## Harness defects found

None blocking. Observations for the orchestrator:

1. **Full-page screenshots and sticky regions.** `verify.mjs` takes
   `fullPage: true` screenshots, which draw a `position: sticky` pinned region
   in the middle of the page (at the old viewport bottom), over content. This
   affects every candidate's review screenshots equally. Judges should read
   pinned-bar placement from the journey screenshots (viewport-only) or live
   phones. Minimal fix, if wanted: take a viewport screenshot in addition to
   the full page.
2. **Hover state carries between checkpoints.** The audit reuses one page per
   cell, and K-23's real Privacy tap on the landing leaves the mouse at the
   top right. Later checkpoints in the same cell therefore render the
   top-right control (E's "Cancelar") in its hover state (underlined) in
   screenshots. This is cosmetic and affects all candidates. Minimal fix:
   `page.mouse.move(0, 0)` after the Privacy check.

## Final verification

`node docs/design/onboarding-tournament/tools/verify.mjs --round 2 --candidates e --out <scratchpad>/verify-e`

| Candidate | Declared product decisions | Checkpoint cells | Cells without hard failures | Cells with warnings | Journey runs | Journeys passed | Journeys failed (hard) | Not implemented |
|---|---|---|---|---|---|---|---|---|
| e | PD-1 | 360 | 360 | 0 | 122 | 122 | 0 | 0 |

Checkpoint audit: hard failures: none. Warnings: none. Every journey passed in
both cells, including all six K-19 journeys (none downgraded to warnings).

K-24 tap counts (reported, not thresholds):

| Task | Cell 1 | Cell 6 |
|---|---|---|
| Rafael, landing → Today (Recommend) | 16 | 16 |
| Correction from the review → recompiled review (hard bound 6 taps) | 6 | 6 |
| Avoid bench press from the review → recompiled review | 5 | 5 |

Tap-count note: one question per screen costs one Continue per question (7).
E saves the chooser tap and the priorities Skip, so Rafael's run is 16 taps:
1 landing + 7 × (answer + Continue) + 1 activation. Other journey totals: Custom
26, Browse 9, Build 20, file import 7, paste door 14, shared 2.
