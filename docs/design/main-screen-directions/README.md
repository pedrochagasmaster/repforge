# Main-screen directions

A standalone review page with seven design directions for Taurifer's main
screens. It is review material only: nothing here is loaded by the app,
precached by `sw.js`, or captured by the UI screen catalog, and the app shell
(`index.html`, `styles.css`, `app.js`, `sw.js`) is untouched.

Serve the repository root over HTTP and open
`docs/design/main-screen-directions/`:

```bash
python3 -m http.server 8000   # then http://localhost:8000/docs/design/main-screen-directions/
```

The page loads the self-hosted Plex fonts from `fonts/`, the licensed exercise
plates from `assets/exercises/`, and, for D to G, `i18n.js` and
`progression-engine.js` from the repository root (read-only). It has to be
served from the repo root.

## Controls

- **Direction**: A to G (keys `1` to `7`). New directions carry a dot.
- **Screen**: the eleven screens, plus six D-family screens (numbered in
  orange): the set-2 Why, a mixed-strategy Today, three strategy Whys and a
  first-session summary. A, B and C fall back to their base screen for these
  and say "Not drawn".
- **PT / EN**: Portuguese is the default. Validate there first.
- **Light / Dark**: the app's own token swap (ADR 0009), not a second design.
- **360 / 390 / 430**: phone widths.
- **One screen / Compare / All screens**: one phone with its note; the current
  screen in every direction side by side; or one direction's whole set.

**Full screen:** `play.html?d=1` to `?d=7` (A to G) opens one direction as the bare app, filling the viewport on a phone and in a phone-sized frame on a wider screen, with `&lang=en` and `&theme=dark` optional. Every in-app button navigates, so you can go from Today through the workout, rest and summary to Progress and History. On desktop, `l` switches the language and `t` the theme. Each screen note on the review page links to it.

Deep links use a bare hash, for example `#d-workout` or `#f-why`. The phones
are live: the shelf's fields and pads work (a second tap on the selected field
opens a real input), Why opens, the calculation discloses, logging a set
starts the rest clock, the clock counts down and its controls work, done sets
can be corrected, sheets open, and the chart and its table select sessions.

## The directions

| | Direction | The idea in one line |
| --- | --- | --- |
| A | **Folha de treino** (training sheet) | Every screen is a page of the training record: aligned mono columns, marks in a margin, hairlines instead of boxes. |
| B | **Um polegar** (one thumb) | Built at arm's length: read in the top half, act in the bottom third, with a raised action shelf during a session. |
| C | **Evidência** (evidence) | Every number carries its proof, drawn beside it: rep-range tracks, before and after slopes, an evidence chain. |
| D | **Folha e polegar** (sheet and thumb) | A's record, B's hand: read everything as a ledger of aligned columns, act on every set from one bottom shelf. Built exactly to `DIRECTION-D-SPEC.md`. |
| E | **Bloco** (the block) | The six-week block is the page: weeks are columns on every screen, so each lift reads across one row, from what each week logged to today's prescription and the next target. |
| F | **Uma folha só** (one sheet) | Today, the workout, the summary and the history entry are one document: every set is a box, you fill the boxes as you train, and the closed page is what you keep. |
| G | **Só o essencial** (only what matters) | Restraint: one line per item, answering one question per screen (what to lift now, what next time, what needs attention), with every supporting fact one tap away, in place. |

E, F and G keep every correctness fix in the spec (§2) and every system rule
(§3). Everything else is theirs to change, and each changes something
different:

- **E changes the axis.** D organises by exercise; E organises by week. Today,
  the workout's ledger, the summary, Progress, History and Program are all
  week grids, and History is the block itself (weeks by training days).
- **F changes the flow.** D pages between exercises; F never pages. The session
  is one scrolling document whose set boxes are planned on Today, filled
  during the workout, closed in the summary and kept in History. Why opens
  inside the sheet, not over it.
- **G changes the density.** D shows the whole ledger; G shows one line per
  decision and discloses the rest in place: Today's rows open to last session
  and the shipped reason, Why leads with one reason and holds the others and
  the calculation behind one tap, and Program opens one day at a time.

## How D to G are built

- `data-d.js` extends `TX` without changing anything A, B or C read.
  - **Targets are live.** Every recommendation is a call to
    `RepForgeProgression.evaluateProgression` with the fixture history,
    `SETTINGS` (2,5 % jump, 2,5 kg step, hard-RIR cap 4) and `CONTEXT`
    (week 4 of 6, block from 31 Aug). Nothing is hand-authored; the exact
    engine input is kept on each result (`rec().input`).
  - **Outcomes are canonical.** `canonicalOutcome(k, iso)` reproduces
    `buildSessionDelta` (`app.js:4639-4651`, `DELTA_THRESHOLDS` at
    `app.js:4626`) and the evidence states of `strengthEvidenceRecords`
    (`app.js:8664-8700`). Summary, History and Progress call only it.
  - **Words are shipped.** `s(key)` reads `i18n.js` word for word and throws on
    an unknown key. New copy goes through `n(key)` and the table below.
  - **Verdicts** follow the app's own mapping (`RANGE_REASON_UI`, `rangeCopy`
    and the strategy copy functions near `app.js:4825-4938`), and the Why
    rows follow `explainRecommendation` / `explainStrategy`
    (`app.js:5134-5203`).
  - The D-only **Dia 2 · misto** scenario (Wednesday 23 Sep, week 4) holds one
    lift per strategy (anchor and back-off, rep goal, fixed effort, manual),
    a movement without an illustration (skull crusher), a custom exercise and
    a set logged without RIR.
- `kit-d.js` holds the shared components: the production dock, sheets, the
  shelf, tabs, segmented controls, the honest chart and the shared wording.
- `phone.css` holds the shared `.dx` rules and D (`.dd`); `phone-e.css`,
  `phone-f.css` and `phone-g.css` hold E, F and G. All name tokens only; the
  three shadow tokens they add (`--dock-shadow`, `--dock-pill-shadow`,
  `--sheet-lift`) sit in the `.ph` token block with the others.

## Notes and questions for the owner

1. **Decided: outcomes describe the logged sets, not the prescription.** The
   owner ruled on 2026-09-25 (grilling on this PR's open questions) that a
   prescribed load increase with the expected rep drop is no regression. The
   rule is the "Session outcome" entry in `CONTEXT.md`, shipped in the app by
   the backlog row "Truthful session outcomes". `canonicalOutcome()` mirrors
   it: at the same load, total reps decide; when the load went up, best-set
   e1RM decides at ±1 %; when it went down, the lift reads Melhorou only on
   more strength or more volume at similar effort, and otherwise Carga
   alterada (a deload never reads Regressou). The fixture squat (100 × 8, 8, 8
   → 102,5 × 7, 6, 6) now reads **Manteve** beside its load PR.
2. **Decided: same load, fewer reps is a decline.** The incline press and the
   row on 18 Sep (same load, one rep fewer) used to fall through to "Carga
   alterada" although the load did not change. They now read **Regressou**.
3. **Decided: the anchor Why names the logged reps.** The shipped sheet
   passed capacity reps to `why.anchor.top`, so a logged 135 × 5 at RIR 1 read
   "por 6 repetições". The app fix shows the performed reps and the RIR as a
   second sentence, which is what D to G already do.
4. **Observed vs predicted capacity (§2.2).** Set 1 at 102,5 × 7, RIR 1 "mostrou
   uma capacidade de 8"; about 7,5 is the engine's fatigue-adjusted capacity
   for set 2 (`range.current_hold`), and the set-2 target stays 7. The
   set-2 Why says both, in that order.
5. **Pause, not Hold.** The rest controls read Pausar / Pause. The app fix
   changes the EN `rest.sheet.pause_aria` from "Hold rest" to "Pause rest".
   EN verdict labels such as "Hold · add reps" are the shipped `rec.*.label`
   values and stay.
6. **Chart targets.** With all nine squat sessions on 328 px the points are
   33 px apart, too close for a 44 px column each. The whole plot is one
   target that snaps to the nearest session, and every row of the table under
   it (48 px) selects the same point. That is the accessible path the spec
   asks for.
7. **Today at 360 PT.** D shows load and target for all five lifts above the
   CTA; the fifth lift's last-session line sits under the CTA until you
   scroll. At 390 everything fits. E and F trade first-screen count for their
   idea (week grid, set boxes) and show three to four lifts at 360; G shows
   all five.
8. **Manual slots** get no engine target by design (`manual.authored_target`).
   The authored template (3 × 12–15 at 120 kg) is fixture data in
   `data-d.js` (`MANUAL`), shown in soft ink with no mark.
9. **The custom exercise's name** is the lifter's own text, so it reads the same
   in PT and EN.
10. **Prototype shortcuts.** Logging set 2 jumps to the summary. Progress tabs
    other than Visão geral, search, Editar and the table-view button are drawn
    but inert. None of this is persistence (spec §9).

## Acceptance checks

`checks/acceptance.mjs` runs the spec's §7 checks 1 to 5 on D, E, F and G
(the latest run is in `checks/acceptance-report.md`), and
`checks/capture.mjs` produces the §7.6 capture matrix. Both use the pinned
Playwright under `test/`:

```bash
(cd test && npm ci)
REVIEW_URL=http://localhost:8000/docs/design/main-screen-directions/ node docs/design/main-screen-directions/checks/acceptance.mjs
REVIEW_URL=http://localhost:8000/docs/design/main-screen-directions/ node docs/design/main-screen-directions/checks/capture.mjs /tmp/captures
node docs/design/main-screen-directions/checks/strings-table.mjs   # refreshes the table below
```

The parity check does not trust `data-d.js`: it evaluates `buildSessionDelta`
and its helpers from `app.js`'s own source and recomputes every target with
the engine in Node, then compares both with what each screen shows.
`captures/` holds the PT 390 light shots of Today, focus, Why, rest and the
summary for each of D to G (§7.6, the landing-page shots of §8).

## New strings (D, E, F, G)

Every string a D-family screen shows is either a shipped `i18n` key, read from
`i18n.js`, or one of these. Generated from `data-d.js` and the `register()`
calls in `dir-e.js`, `dir-f.js` and `dir-g.js`.

<!-- strings-table:start -->
| Key | Used by | PT | EN |
| --- | --- | --- | --- |
| `d.lede_week` | D, E, F, G | {program}, semana {n} de {total} | {program}, week {n} of {total} |
| `d.tally.up.one` | D, E, F, G | {n} sobe | {n} goes up |
| `d.tally.up.other` | D, E, F, G | {n} sobem | {n} go up |
| `d.tally.hold.one` | D, E, F, G | {n} mantém | {n} holds |
| `d.tally.hold.other` | D, E, F, G | {n} mantêm | {n} hold |
| `d.tally.stalled.one` | D, E, F, G | {n} travado | {n} stalled |
| `d.tally.stalled.other` | D, E, F, G | {n} travados | {n} stalled |
| `d.tally.recover.one` | D, E, F, G | {n} recupera | {n} recovers |
| `d.tally.recover.other` | D, E, F, G | {n} recuperam | {n} recover |
| `d.tally.down.one` | D, E, F, G | {n} reduz | {n} backs off |
| `d.tally.down.other` | D, E, F, G | {n} reduzem | {n} back off |
| `d.tally.new.one` | D, E, F, G | {n} novo | {n} new |
| `d.tally.new.other` | D, E, F, G | {n} novos | {n} new |
| `d.tally.manual.one` | D, E, F, G | {n} manual | {n} manual |
| `d.tally.manual.other` | D, E, F, G | {n} manuais | {n} manual |
| `d.rx.title` | D, E, F, G | Prescrição de hoje | Today's prescription |
| `d.rx.meta` | D, E, F, G | {lifts} exercícios, {sets} séries | {lifts} exercises, {sets} sets |
| `d.col.exercise` | D, E, F, G | Exercício | Exercise |
| `d.col.target` | D, E, F, G | Meta | Target |
| `d.col.set` | D, E, F, G | Série | Set |
| `d.col.next` | D, E, F, G | Próxima (kg) | Next (kg) |
| `d.col.sets_range` | D, E, F, G | Séries × faixa | Sets × range |
| `d.col.top_set` | D, E, F, G | maior série | top set |
| `d.sub.before` | D, E, F, G | Antes {sets} | Last {sets} |
| `d.sub.first` | D, E, F, G | Primeira vez | First time |
| `d.sub.custom` | D, E, F, G | Exercício personalizado | Custom exercise |
| `d.week_line` | D, E, F, G | {done} de {planned} sessões | {done} of {planned} sessions |
| `d.target.total` | D, E, F, G | total {n} | total {n} |
| `d.target.anchor` | D, E, F, G | 1 + {n} | 1 + {n} |
| `d.head.day_ex` | D, E, F, G | {day} · exercício {n} de {m} | {day} · exercise {n} of {m} |
| `d.exmeta.range` | D, E, F, G | {sets} × {min}–{max} reps · RIR {rmin}–{rmax} | {sets} × {min}–{max} reps · RIR {rmin}–{rmax} |
| `d.exmeta.goal` | D, E, F, G | {sets} séries · total {goal} reps · RIR {rmin}–{rmax} | {sets} sets · {goal} reps total · RIR {rmin}–{rmax} |
| `d.exmeta.effort` | D, E, F, G | {sets} × {reps} reps · RIR {rmin}–{rmax} | {sets} × {reps} reps · RIR {rmin}–{rmax} |
| `d.exmeta.anchor` | D, E, F, G | 1 × {amin}–{amax} + {n} × {bmin}–{bmax} reps | 1 × {amin}–{amax} + {n} × {bmin}–{bmax} reps |
| `d.exmeta.manual` | D, E, F, G | {sets} × {min}–{max} reps | {sets} × {min}–{max} reps |
| `d.prev_line` | D, E, F, G | antes {load} × {reps} · RIR {rir} | last {load} × {reps} · RIR {rir} |
| `d.prev_line_norir` | D, E, F, G | antes {load} × {reps} · sem RIR | last {load} × {reps} · no RIR |
| `d.next_row` | D, E, F, G | Próximo: {name} | Next: {name} |
| `d.set_label` | D, E, F, G | Série {n} | Set {n} |
| `d.field.load` | D, E, F, G | Carga, kg | Load, kg |
| `d.pad.reps` | D, E, F, G | {sign} 1 rep | {sign} 1 rep |
| `d.pad.load` | D, E, F, G | {sign} {step} kg | {sign} {step} kg |
| `d.pad.rir` | D, E, F, G | {sign} 1 RIR | {sign} 1 RIR |
| `d.log_set` | D, E, F, G | Registrar série {n} | Log set {n} |
| `d.save_set` | D, E, F, G | Salvar série {n} | Save set {n} |
| `d.rest.label` | D, E, F, G | Descanso | Rest |
| `d.rest.of` | D, E, F, G | de {t} | of {t} |
| `d.rest.pause` | D, E, F, G | Pausar | Pause |
| `d.rest.resume` | D, E, F, G | Retomar | Resume |
| `d.rest.skip` | D, E, F, G | Pular | Skip |
| `d.rest.next` | D, E, F, G | Série {n}: manter {load} kg, buscar {reps} reps | Set {n}: hold {load} kg, aim for {reps} reps |
| `d.rest.done` | D, E, F, G | Descanso concluído | Rest done |
| `d.why_short` | D, E, F, G | Por quê? | Why? |
| `d.why.close` | D, E, F, G | Fechar | Close |
| `d.why.ok` | D, E, F, G | Entendi | Got it |
| `d.why.calc` | D, E, F, G | Ver o cálculo | See the working |
| `d.why.calc_hide` | D, E, F, G | Ocultar o cálculo | Hide the working |
| `d.why.evidence` | D, E, F, G | Com base em {n} sessão comparável, {date} | Based on {n} comparable session, {date} |
| `d.why.performed` | D, E, F, G | {reps} reps com {load} kg, RIR {rirs}. | {reps} reps at {load} kg, RIR {rirs}. |
| `d.why.lead.top` | D, E, F, G | Topo da faixa atingido | Top of the range reached |
| `d.why.lead.hold` | D, E, F, G | A faixa ainda tem espaço | The range still has room |
| `d.why.lead.stalled` | D, E, F, G | Três sessões iguais | Three sessions alike |
| `d.why.lead.recover` | D, E, F, G | Séries pesadas, reps iguais | Hard sets, same reps |
| `d.why.lead.load` | D, E, F, G | Passo de carga | Load step |
| `d.why.lead.load_hold` | D, E, F, G | Mesma carga | Same load |
| `d.why.lead.reps` | D, E, F, G | Meta de {n} reps | Target of {n} reps |
| `d.why.lead.set1` | D, E, F, G | O que a série 1 mostrou | What set 1 showed |
| `d.why.lead.set2` | D, E, F, G | Meta da série 2 | Set 2 target |
| `d.why.lead.goal` | D, E, F, G | Total da última vez | Last session's total |
| `d.why.lead.effort` | D, E, F, G | Esforço registrado | Logged effort |
| `d.why.lead.spread` | D, E, F, G | Como as reps se dividem | How the reps split |
| `d.why.lead.anchor` | D, E, F, G | Série principal | Top set |
| `d.why.lead.backoff` | D, E, F, G | Séries mais leves | Lighter sets |
| `d.why.lead.manual` | D, E, F, G | Carga do programa | Program load |
| `d.why.manual` | D, E, F, G | O programa define esta carga. O Taurifer não a altera. | The program sets this load. Taurifer does not change it. |
| `d.why.set1` | D, E, F, G | A série 1 mostrou uma capacidade de {cap}: {reps} reps com {load} kg e RIR {rir}. | Set 1 showed a capacity of {cap}: {reps} reps at {load} kg and RIR {rir}. |
| `d.why.set2` | D, E, F, G | Com a queda habitual entre séries, a capacidade prevista é de cerca de {pred} na próxima série. Menos seu RIR habitual de {rir}, a meta fica em {reps}. | With your usual drop between sets, the predicted capacity is about {pred} on the next set. Minus your usual {rir} RIR, the target stays at {reps}. |
| `d.why.split` | D, E, F, G | As {total} repetições de hoje se dividem em {reps}. | Today's {total} reps split into {reps}. |
| `d.why.top_rir` | D, E, F, G | Você registrou RIR {rir}. | You logged RIR {rir}. |
| `d.why.lead.rule` | D, E, F, G | O que a regra pede | What the rule asks |
| `d.calc.set` | D, E, F, G | Série {n} | Set {n} |
| `d.calc.last` | D, E, F, G | Última sessão, {date} | Last session, {date} |
| `d.calc.working` | D, E, F, G | Cálculo | Working |
| `d.calc.capacity` | D, E, F, G | Capacidade mostrada | Capacity shown |
| `d.calc.capacity_v` | D, E, F, G | cerca de {cap} reps com {load} kg | about {cap} reps at {load} kg |
| `d.calc.rule` | D, E, F, G | Regra | Rule |
| `d.calc.rule_top` | D, E, F, G | topo da faixa, {max} | range top, {max} |
| `d.calc.rule_hold` | D, E, F, G | dentro da faixa, {min}–{max} | inside the range, {min}–{max} |
| `d.calc.new_load` | D, E, F, G | Nova carga | New load |
| `d.calc.rep_target` | D, E, F, G | Meta de reps | Rep target |
| `d.calc.rep_target_v` | D, E, F, G | cerca de {pred} − {rir} = {reps} | about {pred} − {rir} = {reps} |
| `d.calc.today` | D, E, F, G | Hoje | Today |
| `d.calc.goal` | D, E, F, G | Total | Total |
| `d.calc.split` | D, E, F, G | Divisão | Split |
| `d.calc.backoff` | D, E, F, G | Séries leves | Lighter sets |
| `d.calc.block` | D, E, F, G | Bloco | Block |
| `d.saved_week` | D, E, F, G | {date}, semana {n} | {date}, week {n} |
| `d.totals.sets` | D, E, F, G | séries | sets |
| `d.totals.lifts` | D, E, F, G | exercícios | exercises |
| `d.outcome.head` | D, E, F, G | Resultado e próxima meta | Outcome and next target |
| `d.next_target` | D, E, F, G | Próxima: {target} | Next: {target} |
| `d.short.changed-load` | D, E, F, G | Carga alterada | Changed load |
| `d.short.single-observation` | D, E, F, G | Primeira sessão | First session |
| `d.short.missing-effort` | D, E, F, G | Sem RIR | No RIR |
| `d.short.incompatible-exposure` | D, E, F, G | Não comparável | Not comparable |
| `d.muscles.all` | D, E, F, G | Ver os {n} músculos | Show all {n} muscles |
| `d.muscles.fewer` | D, E, F, G | Ver menos | Show fewer |
| `d.progress.sessions` | D, E, F, G | sessões | sessions |
| `d.progress.sets` | D, E, F, G | séries de trabalho | working sets |
| `d.progress.week` | D, E, F, G | Semana {n} de {total} em andamento | Week {n} of {total} in progress |
| `d.progress.attention` | D, E, F, G | Precisa de atenção ({n}) | Needs attention ({n}) |
| `d.progress.strength` | D, E, F, G | Força neste bloco | Strength this block |
| `d.progress.evidence` | D, E, F, G | {kind}, {n} sessões | {kind}, {n} sessions |
| `d.chart.back` | D, E, F, G | Progresso | Progress |
| `d.chart.fig.top` | D, E, F, G | maior carga, kg | top load, kg |
| `d.chart.fig.e1rm` | D, E, F, G | melhor e1RM, kg | best e1RM, kg |
| `d.chart.fig.sessions` | D, E, F, G | sessões | sessions |
| `d.chart.fig.change` | D, E, F, G | no bloco, kg | this block, kg |
| `d.chart.readout` | D, E, F, G | {date} · {metric} {value} kg · {set} | {date} · {metric} {value} kg · {set} |
| `d.chart.aria` | D, E, F, G | {metric} do {name} por sessão | {metric} for {name} by session |
| `d.history.search` | D, E, F, G | Buscar sessões | Search sessions |
| `d.history.calendar` | D, E, F, G | Abrir o calendário | Open the calendar |
| `d.history.week` | D, E, F, G | Semana {n} · {done} de {planned} | Week {n} · {done} of {planned} |
| `d.history.sets` | D, E, F, G | {n} séries | {n} sets |
| `d.history.prs` | D, E, F, G | {n} PR | {n} PR |
| `d.history.prs_many` | D, E, F, G | {n} PRs | {n} PRs |
| `d.history.before` | D, E, F, G | Antes, {date}: {sets} | Before, {date}: {sets} |
| `d.freq.title` | D, E, F, G | Frequência no bloco | Frequency this block |
| `d.freq.wk` | D, E, F, G | S{n} | W{n} |
| `d.freq.count` | D, E, F, G | {done} de {planned} | {done} of {planned} |
| `d.freq.total` | D, E, F, G | {done} de {planned} sessões no bloco, semana {n} de {total} | {done} of {planned} sessions this block, week {n} of {total} |
| `d.freq.per_week` | D, E, F, G | Por semana | Per week |
| `d.freq.per_weekday` | D, E, F, G | Por dia da semana | By weekday |
| `d.history.cal_hint` | D, E, F, G | Dias com sessão estão marcados. | Days with a session are marked. |
| `d.program.status` | D, E, F, G | {status}: {n} de {m} nos últimos 7 dias | {status}: {n} of {m} in the last 7 days |
| `d.program.legend` | D, E, F, G | Próxima: carga sugerida pelo Taurifer para a próxima sessão | Next: the load Taurifer suggests for the next session |
| `d.program.lede` | D, E, F, G | {goal}, 3 dias por semana, semana {n} de {total} | {goal}, 3 days per week, week {n} of {total} |
| `d.program.day_meta` | D, E, F, G | {muscles} · {sets} séries | {muscles} · {sets} sets |
| `d.settings` | D, E, F, G | Ajustes | Settings |
| `d.back_today` | D, E, F, G | Voltar para Hoje | Back to Today |
| `d.timer` | D, E, F, G | Timer de descanso | Rest timer |
| `d.table_view` | D, E, F, G | Ver como tabela | Show as table |
| `d.more` | D, E, F, G | Ações do exercício | Exercise actions |
| `e.wk` | E | S{n} | W{n} |
| `e.wk_long` | E | Semana {n} | Week {n} |
| `e.col.week` | E | Semana | Week |
| `e.today` | E | hoje | today |
| `e.next` | E | próxima | next |
| `e.block_line` | E | {program} · semana {n} de {total} | {program} · week {n} of {total} |
| `e.grid_note` | E | Cada coluna é uma semana do bloco: maior série registrada e, na semana {n}, a prescrição de hoje. | Each column is a week of the block: the top set logged and, in week {n}, today's prescription. |
| `e.col.before` | E | Antes | Before |
| `e.why.weeks` | E | Semana a semana | Week by week |
| `e.why.weeks_note` | E | A decisão usa a semana {n}. As anteriores mostram a tendência do bloco. | The decision uses week {n}. Earlier weeks show the block's trend. |
| `e.history.block` | E | Bloco atual · semana {n} de {total} | Current block · week {n} of {total} |
| `e.history.ahead` | E | Semanas {a} e {b} ainda não começaram. | Weeks {a} and {b} have not started. |
| `e.history.free` | E | Livre | Open |
| `e.progress.matrix` | E | O bloco por exercício | The block by lift |
| `e.progress.matrix_meta` | E | maior carga, kg | top load, kg |
| `e.program.note` | E | Cargas registradas por semana. A semana {n} mostra a próxima carga do Taurifer. | Loads logged each week. Week {n} shows Taurifer's next load. |
| `f.count` | F | {done} de {total} séries | {done} of {total} sets |
| `f.head` | F | {day} · {done} de {total} séries | {day} · {done} of {total} sets |
| `f.before` | F | antes {sets} | last {sets} |
| `f.why.hide` | F | Fechar a explicação | Close the explanation |
| `f.first_time` | F | primeira vez | first time |
| `f.sheet_note` | F | Cada caixa é uma série. Ao treinar, você preenche esta mesma folha. | Each box is a set. When you train, you fill in this same sheet. |
| `f.program_note` | F | Cada dia é a folha que você vai preencher. As cargas são as próximas do Taurifer. | Each day is the sheet you will fill in. Loads are Taurifer's next ones. |
| `f.progress.top` | F | {a}→{b} kg | {a}→{b} kg |
| `f.next` | F | Próxima | Next |
| `g.lede` | G | Semana {n} de {total} · {lifts} exercícios | Week {n} of {total} · {lifts} exercises |
| `g.week_line` | G | Esta semana {done} de {planned} · a seguir {next} | This week {done} of {planned} · up next {next} |
| `g.more.one` | G | Mais 1 motivo e o cálculo | 1 more reason and the working |
| `g.more.other` | G | Mais {n} motivos e o cálculo | {n} more reasons and the working |
| `g.less` | G | Mostrar menos | Show less |
| `g.summary.line` | G | {sets} séries · {vol} kg · {lifts} exercícios | {sets} sets · {vol} kg · {lifts} exercises |
| `g.muscles.show` | G | Séries efetivas por músculo | Hard sets by muscle |
| `g.progress.line` | G | {s} de {S} sessões · {w} de {W} séries de trabalho · semana {n} de {t} | {s} of {S} sessions · {w} of {W} working sets · week {n} of {t} |
| `g.chart.more` | G | Ver as {n} sessões | Show all {n} sessions |
| `g.program.day` | G | {n} exercícios · {sets} séries | {n} exercises · {sets} sets |
| `g.done_set` | G | Série {n}: {load} × {reps} · RIR {rir} | Set {n}: {load} × {reps} · RIR {rir} |
| `g.last_set` | G | Da última vez: {load} × {reps} · RIR {rir} | Last time: {load} × {reps} · RIR {rir} |
| `g.last_set_norir` | G | Da última vez: {load} × {reps}, sem RIR | Last time: {load} × {reps}, no RIR |
| `g.first` | G | Sem sessão anterior | No previous session |
| `g.detail.before` | G | Da última vez, {date} | Last time, {date} |
<!-- strings-table:end -->

## Data

One lifter, one program (*Corpo todo*, three days, six-week mesocycle started
31 Aug 2026), viewed on Monday 21 Sep (week 4, *Dia 1*). Exercise names, ids,
muscles and plate colours come from `exercises.js`. Every session is authored
set by set in `data.js`; totals, PRs, outcomes and hard sets by muscle are
derived from it, so the summary, History and Progress always agree.

A, B and C read the recommendations recorded in `data.js` (`TODAY_REC`,
`SQUAT_SET2`, `NEXT`), produced by running `progression-engine.js` on that
history with the app defaults. D to G compute them live from the same history.
Terms follow `CONTEXT.md`.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page shell and controls |
| `review.css` | Review-page chrome, theme-aware |
| `phone.css` | App tokens scoped to `.ph`, A/B/C styles, the shared D-family `.dx` rules and D (`.dd`) |
| `phone-e.css`, `phone-f.css`, `phone-g.css` | E, F and G |
| `data.js` | Program, sessions, recorded engine outputs and derived figures |
| `data-d.js` | D-family data layer: live engine, canonical outcomes, shipped and new strings, the mixed day |
| `kit.js` | Shared glyphs (copied from `styles.css`), charts, formatting |
| `kit-d.js` | D-family components |
| `dir-a.js` … `dir-g.js` | One renderer per direction |
| `main.js` | Controller and live interactions |
| `checks/` | Acceptance checks, capture matrix, strings table |
| `captures/` | Landing-page shots for D to G |
