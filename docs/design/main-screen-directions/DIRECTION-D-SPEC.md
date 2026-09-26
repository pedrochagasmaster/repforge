# Direction D, "Folha e polegar": implementation spec

Status: definitive brief for the agent that builds the next candidate. It
settles the disagreements between the two design reviews of PR #259
(`fafe92f3`). Do not reopen a decision recorded here. If the code proves one
of them wrong, write the evidence in the README notes and pick the smallest
change that fixes it.

## Amendments, 2026-09-25 (owner decisions)

D was built on the review page (#264), and the owner selected it as the
reference for the main screens. These decisions change how the rest of this
spec is read:

- **Order.** Plan 058 finishes first. D is then built on 058's semantic roles,
  and Plan 059 validates the result before anything ships. See the
  "Direction D redesign" row in `docs/backlog.md` (#266).
- **Numbers defer to Plan 058.** Where §3 or §5 names a size, radius or depth
  that 058's frozen role scale does not have, 058 wins. Known cases: body 16px
  (not 15), the cue's second line on the 18px `subtitle` role (not 17), the
  Today load figure on the 22px `metric` role (not 20; it fits at 360 with a
  66px kg column), the rest clock at 058's protected `clamp(32px,10vw,42px)`
  (not 56px), and the CTA and shelf radius decided by 058's Today/Focus
  migration (not 14px). Anything D needs that 058 lacks, such as the shelf or
  inline rest, goes through 058's contract review as a new content job.
- **§2.1 is decided.** Outcomes describe the logged sets, not the
  prescription. The rule is "Session outcome" in `CONTEXT.md`, shipped by #265
  together with D: at the same load total reps decide; when the load went up,
  best-set e1RM decides at ±1% (the fixture squat reads Manteve); when it went
  down, the lift reads Melhorou only on more strength or more volume at
  similar effort, and a deload is never Regressou. The owner note §2.1 asked
  for is answered.
- **Copy fixes from the review:** "Why this weight" names the logged anchor
  reps plus their RIR (not capacity reps), and the EN pause label is "Pause".

## 0. What to build

Add a fourth direction, **D · Folha e polegar** ("Sheet and thumb"), to the
existing review page. Keep A, B and C as they are so the review can compare
all four side by side.

- New files: `dir-d.js`, `data-d.js`. Add D styles to `phone.css` under a
  `.dd` scope. Register D in `index.html` and `main.js` (key `4`).
- Do not change the app shell: `index.html` at the repo root, `styles.css`,
  `app.js`, `sw.js`. Nothing new is precached, and the UI screen catalog is
  unaffected.
- `data-d.js` extends `TX` and never changes values that A, B or C read.
- D renders all 11 screens plus the 5 edge screens in §6, at PT/EN,
  light/dark, and 360/390/430.

The one-line idea: **A's record, B's hand.** Everything you read is laid out as
A's ledger (aligned mono columns, hairlines, one inventory per screen).
Everything you do mid-set sits in B's bottom shelf. C contributes three small
ideas and none of its visual encodings.

## 1. Decision log (the disputes, settled)

| # | Question | Report 1 | Report 2 | **Decision** | Why |
|---|---|---|---|---|---|
| 1 | Base system | B | A | **A's grammar for reading, B's shelf for acting** | Both reports end up here. They only disagree on which one to call the base. |
| 2 | Today | B | A | **A's prescription table, restyled with B's figure scale. No artwork on rows.** | A shows load, target and last session for all 5 lifts on the first screen at 360. B's rows depend on artwork, and 174 of the 270 movements have an empty tile. |
| 3 | Why this weight | B (sentences) | A (worked calculation) | **B's sentences first. A's calculation behind a "Ver o cálculo" disclosure.** | Moderate transparency builds the most trust, and too much detail up front lowers it (Kizilcec 2016). The shipped `why.*` keys and the landing page's quote are already sentences. The calculation stays one tap away for anyone who wants to check it. |
| 4 | Rest | B (full screen) | A (inline) + B controls | **Inline. The clock takes the cue slot. The shelf's pad row becomes the rest controls. "Registrar série N" stays enabled.** | Logging a set stays one tap, with no "Ir para a série 2" step. The clock is still readable from the bench. |
| 5 | Summary | A (one group per lift) | B order (next targets first) | **One group per lift, and the next target is the group's strongest line** | One inventory instead of three. Each group ties what happened to what comes next, and the next target still appears on the first screen. |
| 6 | Exercise chart | A | C (with the step trace) | **A's honest chart. Primary series is the shipped "Maior carga". "Melhor e1RM" is a toggle. Load increases are marked from logged facts only.** | C's trace plots `top × (e1RM₀/top₀)` (`kit.js:111-116`), so its values don't match the axis it sits on. C's "why the load changed" text is invented, because the app stores no past rationale. |
| 7 | Progress attention rows | A + B's clickable rows + evidence as small text | A + C's evidence badge | **A's row, clickable as in B, with evidence as small soft text and no outline** | Evidence supports the verdict. It must not compete with it. |
| 8 | Bottom nav | B capsule | B/C capsule | **The production glass dock, unchanged** | Both reports agree. It is the spec in DESIGN.md. |
| 9 | History list | A | A | **A, without the 30-cell strip. A calendar button opens the month.** | The strip loses weekday alignment and can't be tapped. |
| 10 | History session | A | A + C's previous-exposure line | **A + C's previous-exposure line, as a page (not a sheet)** | |
| 11 | Program | A, with authored vs suggested made clear | A + strategy name per row | **Both** | |

## 2. Correctness fixes (binding on D; they change the data layer, not only the look)

1. **Canonical outcomes only.** Delete the use of `TX.outcome()` in D, which
   compares best-set e1RM within ±1% (`data.js:149-157`). Add
   `canonicalOutcome(k, iso)` to `data-d.js`. It must reproduce
   `buildSessionDelta` (`app.js:4639-4651`, `DELTA_THRESHOLDS` at `app.js:4626`)
   and the evidence states in `strengthEvidenceRecords` (`app.js:8664-8700`):
   `improved | maintained | declined`, plus `insufficient` with reason
   `single-observation | missing-effort | changed-load | incompatible-exposure`.
   Cite those lines in a comment. Summary, History and Progress call only this
   function.
   - **Expect this and render it honestly:** under the canonical rule, the
     fixture squat (100 × 8,8,8 → 102,5 × 7,6,6) is **declined, "Regressou"**
     (e1RM −0,2 %, reps −5), while it also sets a **load PR**. D shows both
     truthfully (§5.5). Do not reword the result or hide it. Add a README
     note: *"Canonical evidence reads a planned load increase with the expected
     rep drop as Regressou. Is that the intended semantics? This is a question
     for the owner (PRODUCT principle 1), not a copy fix."*
2. **Observed vs predicted capacity.** 7 reps at RIR 1 shows a capacity of
   **8**. The 7,5 in `SQUAT_SET2` is the fatigue-adjusted prediction for the
   next set (`progression-engine.js:1484-1488`). Copy must say "mostrou 8" for
   the observation and "cerca de 7,5 na próxima série" for the prediction.
   Never swap them.
3. **Recommendations come from the engine.** Produce every D target by calling
   `RepForgeProgression.evaluateProgression` (load `../../../progression-engine.js`,
   read-only). If the input contract makes a live call impractical, hard-code
   the outputs, but record the exact input next to each constant. No
   hand-authored targets.
4. **Strength metric parity.** The shipped Strength evidence plots load
   ("Maior carga", `progress-model.js:370-372`, `stats.trend.top_load`).
   D's Progress strength rows and the chart default to Maior carga `a → b kg`.
   "Melhor e1RM" is the second metric (`stats.metric.best_e1rm`), labeled
   wherever it appears. The RIR-blind e1RM never labels an engine outcome.
5. **Shipped words.** When `i18n-pt.json`/`i18n-en.json` already has a string,
   use it word for word. Verdicts come from `rec.*.label`
   (`Aumentar carga`, `Manter · somar reps`, `Manter · recuperar`,
   `Travado · deload`, `Reduzir`, `Novo exercício`). Outcomes come from
   `stats.outcome.*` (`Melhorou / Manteve / Regressou`). Evidence comes from
   `stats.evidence.*`. Strategy names come from `program.progression.strategy.*`.
   The EN pause label is **"Pause"**, never "Hold". Keep a table of every new
   string in the D README section, PT and EN.
6. **Targets.** Every interactive element is ≥ 44 × 44 px at 360 in PT and
   EN. That includes tabs ("PRs"), month/calendar buttons, Why links, chart
   points and ledger rows.

## 3. System rules for D

- **Tokens only.** Use the `.ph` token set in `phone.css`, the same names as
  `styles.css`. No raw hex values in `.dd` rules.
- **Radii.** 14 px for controls, the CTA and bounded groups; 12 px for the
  numeric field group; 20 px for the top corners of sheets and the shelf;
  999 px for the dock. B's 16/18/26 px radii are gone.
- **Surfaces.** Reading screens use A's paper-and-hairline ledger. D adds no
  cards. A group is a hairline-ruled band, never a bounded box inside another
  one. The shelf and sheets are the only floating material besides the dock.
- **Rules.** `--rule` hairlines everywhere. A's heavy ink rules
  (`phone.css:121,122,151,181,230`) are gone. A sentence-case section heading
  plus 26 px of space is what separates sections.
- **Type scale:**
  - Page title: 30 px/650.
  - Cue: 24 px/600. The load inside it is mono.
  - Cue sub-line: 17 px.
  - Today load figure: 20 px mono/500.
  - Body: 15 px.
  - Secondary: 13–14 px in Soft Ink.
  - Label tier: 11 px uppercase, for column heads only.
  - Nothing below 12 px, and nothing that carries data below 13 px.
- **The orange budget, per screen.** Orange may mark only:
  - verdict glyphs for up or down,
  - the current exercise segment,
  - a running timer's drain bar,
  - the CTA arrow,
  - the active dock icon.

  It never marks set rows, the "now" segment of the week rule, calculation
  totals, row pins or legends. PR text uses `--positive`. Declines are ink,
  never red.
- **Artwork.** Only in the workout header, as a 56 px tile. Non-illustrated
  and custom movements get the deliberately empty tile. There is no artwork on
  any list row.
- **CTA reservation.** Any screen with a CTA above the dock pads its scroll
  area by `CTA height + dock + 16 px`. Nothing may sit under the CTA when
  scrolled to the end. A's Today currently hides "Escolher outro dia".
- **PT-first.** Exercise names and muscle lists wrap and are never
  ellipsized. Validate at 360 PT before EN.

## 4. Shared components

- **Ledger row:** `[index 32 px] [kg] [reps] [RIR]`, mono columns aligned to
  A's column heads, 48 px minimum height.
  - Done rows: check glyph, values in ink.
  - Open row: `--well` ground, 1.5 px ink outline, values in Soft Ink until
    confirmed.
  - Queued rows: engine targets in Soft Ink.
  - Second line, 13 px Soft Ink: `antes 100 × 8 · RIR 1`.
  - The index column also accepts a label (warm-up), so D must not assume
    purely numeric indices.
- **Verdict mark:** `kit.js mark()` glyph + the shipped `rec.*.label`.
- **The shelf** (workout only; it replaces the dock):
  1. Field row: three 56 px buttons, `Carga, kg | Reps | RIR`, value in 22 px
     mono.
     - First tap selects a field.
     - A second tap on the selected field makes it a real
       `<input inputmode="decimal">` at ≥ 16 px.
     - Selected state: ink outline **and** the pads name the field.
  2. Pad row: two 56 px pads that name their step. `− 1 rep / + 1 rep`,
     `− 2,5 kg / + 2,5 kg` (step from settings), `− 1 RIR / + 1 RIR`.
  3. CTA, 54 px: `Registrar série N`, or `Salvar série N` when correcting.

  **Default field: Reps.** Load comes pre-filled from the engine. Selection
  returns to Reps after every log.

## 5. Screens

### 5.1 Today (ready)
In this order:
1. Header row: long date on the left; on the right, `Escolher outro dia` (a 44 px
   text button) and the settings icon (44 px).
2. H1 day name.
3. Lede: `Corpo todo, semana 4 de 6`, then the 6-segment week rule (no orange).
4. Tally line (C): `↑ 2 sobem · = 2 mantêm · ↻ 1 travado`, using the shipped
   verdict glyphs. It replaces A's footer sentence.
5. `Prescrição de hoje`, with meta `5 exercícios, 13 séries`.
6. Column heads: blank | `Exercício` | `kg` | `Meta`.
7. One row per lift:
   - Mark, then the name (wraps).
   - Sub-line, one of `Antes 100 × 8, 8, 8`, `Primeira vez`, or the shipped
     stalled reason.
   - Load as a 20 px mono figure.
   - Target as `3 × 7`. Other strategies use their own form: rep_goal
     `total 36`, anchor_backoff `1 + 2`, manual `3 × 8–12` in Soft Ink with
     no mark.
8. `Esta semana 0 de 3 sessões · A seguir Dia 2`.

CTA `Começar treino →` above the dock.

### 5.2 Focus workout
1. Header (44 px buttons):
   - back chevron,
   - center `Dia 1 · exercício 1 de 5`,
   - timer (shows the remaining time when running; tapping it opens the
     existing presets sheet),
   - table view,
   - `⋯` (the existing exercise actions: note, substitute, skip, reorder,
     finish early).

   Below the header: the 5-segment exercise progress.
2. Exercise header: 56 px art tile, name (wraps), `3 × 4–8 reps · RIR 0–2 ·
   Faixa de repetições`.
3. Cue, from B:
   - Line 1, 24 px: `↑ Subir para 102,5 kg`.
   - Line 2, 17 px: `buscar 7 reps`.
   - `Por que essa carga?`, a 44 px text button in `--accent-deep`.
4. Note line, if present.
5. Ledger with column heads (Série, kg, reps, RIR), one row per set as in §4.
   Tapping a done row loads it into the shelf, and the CTA becomes
   `Salvar série 1`.
6. `Próximo: Supino com barra ›`, a 48 px row.

Then the shelf.

### 5.3 Why this weight (sheet)
1. Grab handle, and a 44 px close button top right.
2. Small title `Por que essa carga`. Headline: the cue, with its verdict mark.
3. Two or three reason blocks. Each has a bold 4–5 word lead and one sentence
   from the shipped `why.*` key for the strategy:

   | Strategy | Reason keys, in order |
   |---|---|
   | range | `why.rule.*` → `why.load_*` → `why.reps*` |
   | rep_goal | `why.repgoal.total` → `.effort` → `.distribution` or `.rebuild` |
   | anchor_backoff | `why.anchor.top` → `.backoff` → `.untouched` |
   | effort_target | `why.effort.evidence` → `.target` → `.grid` |
   | manual | one line: the program sets this load; the engine doesn't change it (new string) |

   The first sentence must include the RIR it used: *"8, 8 e 8 reps com 100 kg,
   RIR 1, 1 e 0"*.
4. `Ver o cálculo`, a 44 px disclosure. It opens A's worked calculation: last
   session's sets with RIR, capacity shown, rule, new load, rep target, and a
   sum line in ink.
5. Evidence footer, 13 px Soft Ink: `Com base em 1 sessão comparável, 14 set`.
6. `Entendi`: a secondary button at the bottom, 54 px.

In-session variant (opened from set 2's cue): the lead reason is `why.session`,
with the §2.2 copy about observed vs predicted capacity.

### 5.4 Rest (state of 5.2, not a screen of its own)
After `Registrar série 1`:
- Row 1 becomes done.
- The cue slot turns into the rest block:
  - `Descanso`, with the clock `1:24` in 56 px mono and `de 2:00` next to it.
  - A 4 px drain bar in orange.
  - Under it, the next cue at 17 px: `Série 2: manter 102,5 kg, buscar 7 reps ·
    Por quê?`.
- The shelf's field row shows set 2 pre-filled.
- The pad row becomes four 56 px controls: `−30 s | Pausar | +30 s | Pular`.
  Tapping any field brings the pads back.
- `Registrar série 2` stays enabled the whole time.

When the timer ends:
- The clock collapses to a 17 px line `Descanso concluído`.
- The cue returns to 24 px.
- The pads come back.

There is no full-screen rest and no rest sheet.

### 5.5 Session summary (with PRs), and 5.6 (without PRs)
The two summaries share one structure. The only difference is that PR lines
are missing when there are no PRs.
1. Eyebrow `Treino salvo` (`summary.eyebrow`). No check circle.
2. H1 day name; lede with date and week.
3. Totals, flat, with a fixed meaning: `séries · kg movimentados · exercícios`.
   Labels may wrap to two lines; figures never wrap.
4. `Resultado e próxima meta`: one group per lift, separated by hairlines.
   - Line 1: name, and on the right the canonical outcome word. An
     insufficient state shows its short form instead: `Carga alterada`,
     `Primeira sessão`, `Sem RIR`.
   - Line 2, 14 px mono Soft Ink: the performed sets, `102,5 kg × 7, 6, 6`.
   - Line 3, only when there is a PR: in `--positive`,
     `PR · +2,5 kg acima do seu melhor` (`summary.pr.over_load`).
   - Line 4, the strongest line in the group: mark + `Próxima: 102,5 kg × 8`,
     15 px mono in ink.
5. `Séries efetivas por músculo`: A's two-column list, top 6, with
   `Ver os N músculos`.
6. `Esta semana 1 de 3 · A seguir Dia 2`.
7. Actions: B's two-button row, `Ver a sessão | Concluir`, both 54 px.

The squat group reads: `Regressou` / `102,5 kg × 7, 6, 6` /
`PR · +2,5 kg acima do seu melhor` / `= Próxima: 102,5 kg × 8`.
That is correct under canonical rules, and §2.1 covers the owner note.

### 5.7 Progress overview
1. H1.
2. One tab row, `Visão geral | Força | Volume | PRs | Revisão`. Each tab is
   ≥ 44 × 44. When the row overflows at 360 PT, it scrolls horizontally with
   a paper fade on the edge.
3. A's two totals: `1/3 sessões · 13/39 séries de trabalho`, and
   `Semana 4 de 6 em andamento`.
4. `Precisa de atenção (4)`: full-width buttons, at least 64 px tall.
   - Left: mark, then the name.
   - Line 2: verdict + a one-sentence reason.
   - Line 3, 13 px Soft Ink: `Comparação, 2 sessões`.
   - Right: the figure (`170 → 175 kg`) and a chevron.
5. `Força neste bloco`: rows with name, sparkline of Maior carga, and
   `a → b kg`. Tapping a row opens 5.8.

### 5.8 Exercise chart
1. Back link (44 px), H1 name.
2. Segmented scope control `Bloco atual | Todo o histórico`, plus a metric
   toggle `Maior carga | Melhor e1RM`. Both are 44 px tall.
3. Three flat figures.
4. The chart: one series, the block start ruled, and the axis in the units of
   the selected metric.
   - In Maior carga mode, a load increase shows as the step itself, with a
     small ▲ tick.
   - Tapping a point or its 44 px column updates a one-line readout: date,
     metric value, source set.
5. The data table, which works as the accessible alternative to the chart:
   `Data | maior série | e1RM | Δ`.

The table and readout carry no explanation of why the load changed. C's
reason text isn't available in the stored data.

### 5.9 History list
1. H1, with a search button and a calendar button (both 44 px). The calendar
   button opens the existing month calendar as a sheet.
2. `Setembro de 2026 · N sessões, M séries`, computed from the fixture.
3. Groups by week, `Semana 4 · 1 de 3`, each with A's session rows (48 px or
   more):
   - weekday and day,
   - day name, with the muscle list below it (wraps),
   - `sets · kg · N PRs` on the right.

### 5.10 History session (page)
1. Back link, H1, lede, and the totals `séries · kg movimentados · PRs`.
2. One group per lift:
   - Header: name, canonical outcome, and `PR` when present.
   - Sub-line (C): `Antes, 14 set: 100 × 8, 8, 8`.
   - A's numbered set rows: `n | kg | reps | RIR`.
3. `Editar` (secondary) and `Excluir sessão` (danger text button), both
   ≥ 44 px.

### 5.11 Program
1. Header `Programa` with an `Editar` text button (44 px). H1, lede, the week
   rule, and the status line `No caminho certo: 3 de 3 nos últimos 7 dias`.
2. Every day open. The day header wraps and is never truncated.
3. Columns: `Exercício | Séries × faixa | Próxima (kg)`.
   - The Próxima values are Soft Ink mono.
   - The row sub-line is the strategy name (`Faixa de repetições`,
     `Total de repetições`, …).
   - Manual rows show the authored load with no mark.
4. A one-line legend under the first column head: `Próxima: carga sugerida
   pelo Taurifer para a próxima sessão`.

### 5.12 Nav
The production glass capsule: 62 px, 4 columns, active icon orange. It is
hidden during workout, rest and summary.

## 6. Fixture additions (`data-d.js`), plus 5 edge screens

A second D-only program day, **Dia 2 · misto**. A, B and C never see it.
- one `rep_goal` lift,
- one `anchor_backoff` lift,
- one `effort_target` lift,
- one `manual` lift,
- one library movement **without** an illustration,
- one **custom exercise**,
- one lift with a set logged without RIR (`missing-effort`).

Add these D-only screens to the review list. Other directions fall back to
their base screen and label it "not drawn".
1. `today-mixed`: Today for Dia 2 · misto.
2. `why-repgoal`
3. `why-anchor`
4. `why-manual`
5. `summary-first`: every lift is a first exposure, so it uses the
   `summary.baseline` sentence and has no outcome words.

## 7. Acceptance checks (the agent runs these and pastes the results into the PR)

1. **Targets:** a Playwright script over every D screen at 360 PT and EN. Every
   `button, a, input, [role=button], [data-pt]` is ≥ 44 × 44. Zero failures.
2. **Overflow:** no element in D has `scrollWidth > clientWidth` at 360 PT,
   except the tab row, which is allowed to scroll. No `text-overflow:
   ellipsis` in `.dd` rules.
3. **Orange:** for each screen, list the elements whose computed
   color/fill/background resolves to `--accent`. Every one must be in the §3
   allowlist.
4. **Parity:**
   - For every lift and session, the outcome word in Summary, History and
     Progress is the same `canonicalOutcome()` value.
   - Every target equals the engine output recorded per §2.3.
5. **Strings:**
   - No `Regrediu`, no EN `Hold` as a pause label, no em dashes.
   - Every D string is either a shipped key's text or listed in the
     new-strings table.
6. **Captures:** all D screens at 360/390/430 × PT/EN × light/dark. Look at
   PT 360 first. Attach PT 390 light captures of Today, focus, Why, the rest
   state and summary to the PR, since those are the landing-page shots (§8).
7. **Five-second read:** for Today, focus and Why, write one sentence each
   saying what a stranger learns from a static 390 crop in five seconds. If
   the sentence isn't "the app tells me the exact load and reps, and why",
   iterate.

## 8. Why these choices, in brief

- **Where the thumb reaches.** Most phone use is one-handed, and the easy
  reach is the lower-middle of the screen (Hoober 2013). Bigger, closer
  targets are faster and cause fewer errors (Fitts 1954). One-handed use needs
  about 9–10 mm targets (Parhi, Karlson & Bederson 2006). That is the case
  for the shelf and 56 px pads.
- **Trust in the recommendation.** People trust an algorithm more when they
  can adjust its output (Dietvorst, Simmons & Massey 2018). That is why every
  engine value in the shelf stays directly editable. Moderate transparency
  earns more trust than none or too much (Kizilcec 2016), which is why Why
  leads with sentences and puts the calculation behind a disclosure.
- **Knowing what comes next.** A specific "when X, do Y" plan makes
  follow-through much more likely (Gollwitzer & Sheeran 2006, d ≈ 0.65).
  Watching progress toward a goal improves attainment (Harkin et al. 2016).
  People judge an experience largely by its end (Redelmeier & Kahneman 1996).
  So the summary, the last thing the lifter sees, ends each lift on its next
  target. It does not celebrate.
- **Honest charts.** People read position on a common scale most accurately
  (Cleveland & McGill 1984), and dual-scale charts invite misreading
  (Isenberg et al. 2011). That rules out C's rescaled trace and argues for
  aligned columns.
- **Acquisition.** These are in-app screens, not a landing page. The link to
  acquisition is concrete, though: the shipped landing page uses screenshots
  of **Today (ready), the focus screen and Why this weight**
  (`landing.shot.*`) and quotes the Why sentence (`landing.system.quote`).
  D's versions of those three screens become the marketing shots, so each has
  to explain the product on its own in a static crop (check 7.7). None of the
  studies above is evidence about Taurifer's own acquisition. The product has
  no users yet (PRODUCT.md), so treat these as design rationale, not
  predicted results.

## 9. Out of scope

- Changes to the app shell.
- Changes to the engine or the evidence semantics (§2.1 is a question for the
  owner).
- Onboarding, Settings, Library.
- Real persistence or recovery. The prototype shows layout, not logging
  correctness.
- Warm-up and substitution flows beyond the ledger's label column.
