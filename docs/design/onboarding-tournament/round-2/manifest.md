# Round 2 — judge artifact manifest

Frozen for independent judging. Do not revise candidates after judges begin
unless a factual defect prevents evaluation; if that happens, judging restarts
from the corrected commit.

- Repository: `pedrochagasmaster/repforge`, branch `ccr-15c50ac8-pki40i`
- Artifact commit: **`23968902d3df98c95b44280eb154ba9d4d93e797`** (the three candidates and the
  shared harness); freeze commit: the commit that adds this manifest and the
  Round 2 acceptance results. Judges evaluate the tree at the freeze commit,
  which differs from the artifact commit only by those files.
- Redesign baseline: PR #256 head `f61ce44b05b1b6717abb4ef00b2395204e9c9636`
- Normative spec: `round-1/synthesis-spec.md` (commit `3ebac2a`)
- Generator brief and open-item allocation: `round-2/generator-brief.md`
- Candidate interface and acceptance journeys: `round-2/JOURNEYS.md`
- Harness entry: `docs/design/onboarding-tournament/index.html?round=2` (served
  from the repository root); candidate documents:
  `round-2/app.html?c={d|e|f}&cp=<checkpoint>&lang={pt|en}&theme={light|dark}&text={100|200}&motion={normal|reduced}`
- Acceptance results: `round-2/acceptance/summary.md`, `results.json`;
  screenshots on disk under `round-2/acceptance/shots/` (gitignored)

## How Round 2 was generated

Three fresh generators ran in parallel, one candidate each, from the synthesis
spec. None of them saw the Round 1 judge reports. To guarantee the divergence
spec §9 requires, the orchestrator allocated each candidate's position on
every open item up front (table at the end of `round-2/generator-brief.md`).
Within that allocation each generator owned its thesis, composition, copy and
craft. Each generator's own account of what it did, where it deviated and
why, and what it found wrong in the harness is in
`round-2/candidates/<id>.notes.md`.

## Candidates

| Id | Name | Files | Thesis | Product decisions |
| --- | --- | --- | --- | --- |
| d | Cinco portas, uma revisão (control) | `round-2/candidates/d.{js,css,notes.md}` | The synthesis spec built as written: five honest doors up front, the required answers in five grouped sections, and one review that is the result, where every answer is corrected in place with a true statement of what changed. | none |
| e | Uma pergunta por vez | `round-2/candidates/e.{js,css,notes.md}` | Start is a conversation, not a menu: Taurifer asks one thing at a time and builds the program, and every other route stays one explicit, named, reversible step away from the question and from the program. | **PD-1** |
| f | A primeira pergunta | `round-2/candidates/f.{js,css,notes.md}` | Choosing a route should cost nothing extra: the chooser opens on Recommend's first question, and every later screen keeps the program in view, with answers as chips, each corrected in a sheet and followed by a before/after count. | none |

All three ask session minutes and rest and preselect neither (no PD-2 or
PD-3), show no program before the lifter answers (no PD-4), and use the H-7
copy override layer (production follow-up PD-5 applies to all three equally).

### E's product decision (PD-1), as declared

- **Changes versus Plan 054:** "Start training opens the five-job chooser"
  becomes "Start opens Recommend's first question". That screen always shows
  the other four jobs as a visible list plus a helper that ends at all five.
  Routes are also reachable from the days question (Browse) and from the
  review (every route, carrying the answers).
- **Kept:** Custom is its own route with its own questions, section count
  and provenance. No job is hidden behind a disclosure or a generated result.
  The landing secondary still opens Import directly, so importers never pass
  a Recommend screen. An existing user lands on the same first question with
  the active-program notice and all four other routes visible.
- **Checks relaxed:** K-19 only. None were needed: all six K-19 journeys pass
  outright for E.

## Open items (spec §9), as built

| Open item | D · control | E | F |
| --- | --- | --- | --- |
| Route choice | Up-front chooser with "Você faz / Você recebe" per door and a two-question helper | PD-1: Recommend's first question carries the other four routes and the helper | Up-front chooser whose featured block *is* Recommend's goal question; Custom and Browse as rows; Build, Paste and File under "Usar meu próprio programa" |
| O-1 grouping | Five sections | One question per screen (7 questions in 4 sections) | Hybrid: goal + background, schedule, environment, then optional priorities (4 sections) |
| O-2 priorities / avoid | Before the result, visible Skip | Optional refinements on the review | Before the result, optional |
| O-3 facts on the review | "Montado com" list after the weekly structure | Inline fact list at the top of the review | Answer chips under the facts line |
| O-5 change statement | Status line under the facts line | Changed rows marked inline plus a polite status | Before/after count block (exercises and sets) |
| O-6 routes from the review | Chooser only | Yes | Chooser only |
| O-7 shared-gate decline | Start only | Start only | Quiet "Agora não" that saves nothing |
| O-8 landing | Headline, lede, both actions, then the capture | Default | Capture above both actions, both in the first viewport |
| O-9 answer editing | Bottom sheet | Inline expansion | Bottom sheet |
| O-10 resume card | Chooser | Landing | Landing and chooser |
| O-11 Build from import | Quiet link | Quiet link | Third import door |

## Checkpoint mapping

The 45 checkpoints and 14 scenarios are listed in `README.md` and
`TF.CHECKPOINTS`. Each candidate marks the element representing a checkpoint
with `data-checkpoint`.

| Checkpoint | D | E | F |
| --- | --- | --- | --- |
| landing | Landing: headline, lede, Start / Import, capture | Landing, default composition | Landing with the capture above both actions |
| route-choice | Chooser with five doors | The route list on Recommend's first question | Chooser; the featured block is the goal question |
| route-help | Helper opened on the chooser | Helper disclosure on the first question | Helper disclosure on the chooser |
| rec-goal … rec-environment | Sections 1–4 | One question per screen | Goal on the chooser or section 1; section 2 schedule; section 3 environment |
| rec-priorities | Section 5 (priorities and avoid, with Skip) | The review with the optional priorities editor open | Section 4 (optional priorities and avoid) |
| rec-result | Review: program first, "Montado com" after the week | Review with the inline fact list at the top | Review with answer chips and the facts line |
| rec-env-correction / rec-result-corrected | Environment sheet with the correction; status line | Inline environment expansion; changed rows marked | Environment sheet opened on the correction; before/after count |
| rec-avoid-pain / rec-result-avoided | Section 5 avoid search with the pain note; result states the effect | Avoid editor on the review; changed rows marked | Section 4 avoid search; before/after compares "Sem evitar" and "Evitando" |
| browse-* | Two context questions, catalogue, review | Days question offers Browse; catalogue; review | One filter screen, flat catalogue, review |
| custom-* | Custom route with its own sections and provenance | Custom from the first question or the review, own sections and provenance | Custom row on the chooser, 6 sections |
| build-* | Setup then the shared editor | Setup then the shared editor | Setup then the shared editor (also the third import door) |
| ff-* / import-* | Shared paste door, gap repair, import review | Same shared widgets | Same shared widgets; import opens on three doors |
| shared-gate / shared-preview / shared-invalid | Gate with Start only; review; invalid-link landing | Gate with Start only; review; invalid-link landing | Gate with Start and "Agora não"; review; invalid-link landing |
| hub-existing | Chooser with the active-program notice | First question with the active notice and all routes | Chooser with the active notice |
| replace-confirm / activation-conflict | Shared dialog; shared conflict notice | Same | Same |
| resume / rules-changed / cancel-confirm | Resume card and rules notice on the chooser; shared cancel dialog | Resume card on the landing; rules notice; shared cancel dialog | Resume card on the landing and the chooser; rules notice on the chooser; shared cancel dialog |
| activate / activated-today | Review CTA → Today | Review CTA → Today | Review CTA → Today |

## Harness interpretations and notes for judges

- **K-11** allows at most one pinned action region per view.
- **K-15 / K-16** exempt text the lifter or a fixture supplied
  (`data-user-text`) and library exercise names.
- **Shared European-Portuguese strings.** Eight baseline strings in the shared
  widgets were European Portuguese (for example "Rever o programa", "guardado
  a"). They were replaced for every candidate through the H-7 override layer
  (commit `4fa5f14`) before the combined acceptance run. D also uses its own
  headings for gap repair and the resume line; E overrides the hand-off copy
  button to the spec's "Copiar o comando", which the shared layer now also
  uses.
- **"Guardada / guardar".** D ("respostas guardadas") and F ("configuração
  guardada", "Guardar rascunho e sair") use this verb in their own copy. It is
  not on the K-15 list, so it is not a hard failure. Judges should weigh it as
  PT-BR copy quality.
- **E's `chooser.doors` journey** records the Recommend door without a tap,
  because under PD-1 the lifter is already inside Recommend. The other four
  doors are real taps followed by a real Back.
- **E's `rec-priorities`** is the review with the priorities editor open, a
  direct consequence of its O-2 allocation; `entry().step` there is `result`.
- **200% text.** All three step headings down to existing type roles and drop
  the arrow glyph from the pinned primary so long PT words fit at 320 px.
  F moves its disabled reason between the pinned bar and the page flow with a
  script measurement of root font size and width, not a CSS rule.
- **Screenshots.** Full-page shots draw sticky pinned bars mid-page. Each
  checkpoint also has a `-vp.png` viewport shot showing where the phone
  actually draws them.
- **Harness fixes made during Round 2 generation** (all shared, none giving
  any candidate an advantage): pointer parked before screenshots and viewport
  shots added (`c32d74e`); PT-BR shared strings, K-15 additions and K-22
  reading rendered text (`4fa5f14`); exercise names in the shared day list
  wrap between words at 200% text (`2396890`). Each generator's full list is
  in its notes.

## Acceptance at freeze

Combined run: `node docs/design/onboarding-tournament/tools/verify.mjs --round 2`
against `http://127.0.0.1:8123/`, all 45 checkpoints in all 8 cells, all
journeys in cells 1 and 6. It ran on the tree of the artifact commit.

| Candidate | Product decisions | Checkpoint cells | Without hard failures | With warnings | Journey runs | Passed | Failed | Not implemented |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| d | none | 360 | 360 | 0 | 122 | 122 | 0 | 0 |
| e | PD-1 | 360 | 360 | 0 | 122 | 122 | 0 | 0 |
| f | none | 360 | 360 | 0 | 122 | 122 | 0 | 0 |

Taps per journey (cell 1 / cell 6). Every tap is a real Playwright click
through the journey api. The counts are evidence for activation cost, not a
score: a route that asks fewer questions is not better if it asks the wrong
ones.

| Journey | D | E | F |
| --- | --- | --- | --- |
| activate.recommend | 15 / 15 | 16 / 16 | 13 / 13 |
| activate.custom | 23 / 23 | 26 / 26 | 22 / 22 |
| activate.browse | 8 / 8 | 9 / 9 | 7 / 7 |
| activate.build | 21 / 21 | 20 / 20 | 21 / 21 |
| activate.import-file | 7 / 7 | 7 / 7 | 7 / 7 |
| activate.import-paste | 14 / 14 | 14 / 14 | 14 / 14 |
| activate.shared | 2 / 2 | 2 / 2 | 2 / 2 |
| correct.environment | 6 / 6 | 6 / 6 | 6 / 6 |
| avoid.from-review | 5 / 5 | 5 / 5 | 5 / 5 |
| change.days | 3 / 3 | 3 / 3 | 3 / 3 |
| recommend.required | 12 / 12 | 14 / 14 | 11 / 11 |
| chooser.doors | 11 / 11 | 8 / 8 | 11 / 11 |

Passing acceptance means each candidate meets the spec's mechanical bar. It
says nothing about which design is better; that is the judges' question.
