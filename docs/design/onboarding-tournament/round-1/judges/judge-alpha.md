# Round 1 — Judge Alpha report

Artifact judged: freeze commit `9cf45d1a` (artifact `31a37b97`), served at `http://127.0.0.1:8123/`.
The later commit `1d24269` (Round 2 generator brief) was not read.

**Method.** I read the brief, the harness README and manifest, the product sources the brief names
(`PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`, `docs/brand-guide.md`, ADR 0007, ADR 0014, Plan 054 Approved
direction and Non-goals, Plan 048 Locked decisions), and the PR #256 captures under
`docs/ui-screens/screens/onboarding-*`. `docs/design/ui-system-semantic-contract.md` does not exist at
the freeze commit, so I read it from the PR #256 scratch checkout (`…/scratchpad/pr256/docs/design/`).
I read all of `runtime.js`, `candidates/shared-screens.js`, `a.js`, `b.js`, `c.js` and the three CSS files.

I drove every candidate in Chromium (Playwright, 390×844 at DPR 2, `pt-BR` locale unless noted) with
scripted journeys. The scripts tapped options, typed in searches, opened sheets and panels, submitted
empty and invalid gap values, resolved import rows, confirmed and cancelled replacement, triggered the
conflict, pressed Cancel and Keep, resumed, rebuilt after a rules change, activated, and landed on Today.
I then ran a matrix of 10 hard states × 3 candidates × 7 cells: PT 320, PT 430, PT dark 390, PT 390 at
200%, PT 320 at 200%, EN 390, and EN dark 430 with reduced motion. I measured overflow, targets under
44 px, clipping and input font size on every one of those renders.

Every screenshot I cite with a `jA-…`, `jB-…`, `jC-…`, `ja-…`, `mx__…`, `edit-…`, `cbuild-…` or
`*__pt-light-390-full` name is my own capture, under
`/tmp/claude-0/-home-user-repforge/d4429a92-dc1c-5374-aae2-80a77b0b0566/scratchpad/judge-alpha/shots/`.
Transcripts of each journey (tap counts and the checkpoint marker after each tap) are the `j*.mjs`
scripts in the parent directory. File citations are relative to `docs/design/onboarding-tournament/`.

**Bottom line.** B is the best base, but none of the three is ready to ship.

- **C** activates programs built on assumptions nobody confirmed. It also activates the *wrong*
  program when a lifter finishes Build, and its "keep draft" action discards the draft.
- **A** has the cheapest Recommend path. But it hides the other routes behind four questions, pushes
  existing users back to the first-run landing, and has dead Cancel buttons on the import and Build
  setup screens.
- **B** keeps every route and every production rule intact. Its defects are local and fixable.

---

## 1. Candidate-by-dimension comparison

Scores are 1–5 and do not average across dimensions. "Taps" means tap counts measured in the browser
from a fresh landing (full transcripts in §9, items E1–E3).

| # | Dimension | A · Uma pergunta | B · Cinco portas honestas | C · Programa primeiro |
|---|---|---|---|---|
| 1 | Activation efficiency | **4.** 10 taps to the result and 11 to Today for Rafael (`jA-rec` log). Minutes and rest are assumed, and the chips say so. | **3.** 14 taps to the result and 15 to Today (`jB-rec` log). "Deixar o Taurifer escolher" (let Taurifer choose rest) is not preselected, so the section blocks on it. Reaching a route needs a hub tap first. | **2.** One tap activates the default program at 0/7 confirmed (`jC-rec`: "Use enabled at 0/7? true"). That speed is not trustworthy: a novice gets a program calibrated for 6–24 months of training (§4 C1). The honest path is 8 taps to confirm 4 facts plus Use, and the editors open off-screen. Build activates the wrong program (§4 C2). |
| 2 | Route comprehension | **2.** Browse and Custom exist only as "Quer algo diferente?" (Want something different?) after all four answers (a.js:336). An existing user gets no route choice at all (a.js:488; `jA-exist__01-hub-existing`). | **4.** Each door states "Você faz" (you do) and "Você recebe" (you get) (b.js:260–275; `jB-rec__01-hub`). Weakness: Recommend and Custom share the same "Você recebe" line (`x.get.generated`, b.js:268–269), so only the cost line tells them apart. | **2.** Routes are "Trocar este programa por…" (switch this program for…) from a program the user never asked for (`jC-rec__11-switch`). An importer or builder must first reject a generated program. |
| 3 | Decision burden | **4.** One question per screen with a single-tap answer. Q4 packs 8 options into two groups (`jA-rec__04-q4`). | **3.** A hub, then five sections. Rest is a mandatory extra decision. Priorities is one long screen: 10 muscles, 6 patterns and a search (`jB-rec__06-prio`). | **2.** Seven fact chips, a 0/7 counter, a switch panel and 18 "Deixar fora" (leave out) links all appear at once (`c__landing__pt-light-390-full`). What must be confirmed is ambiguous; c.js:105 says only days and place matter. |
| 4 | Information scent | **3.** Fact chips carry pencils and "SUPOSTO" tags (`jA-rec__05-result`). The row hint says what a tap on an exercise does. But Cancel on import-source, import-review and build-setup does nothing (§4 A2). | **4.** Section counter, answer rail and door costs are all clear. "Começar de novo" (start over) wipes the draft without warning (b.js:459). | **2.** Tapping a chip opens its editor below all seven chips, under the pinned bar (`jC-rec__01-days-open`, `jC-rec__06-days4`, where "OK" is hidden). "Manter, só mudar os fatos" (keep it, just change the facts) does nothing on a Browse program. "Guardar rascunho e sair" (keep draft and leave) discards the draft. |
| 5 | Trust | **3.** Assumed facts are labelled, and avoidance explains substitution with the pain note (`jA-rec__11-ex-pain`). The "Why" list is cut to goal and progression (a.js result, `filter(["goal","progression"])`). | **4.** The program comes first, then reasons that cite schedule, environment, equipment and priorities (Plan 048 #13). "Mesmas respostas, mesmo programa, sempre" (same answers, same program, always). "O que o Taurifer ajustou" (what Taurifer adjusted) is its own section. The door time estimates are unmeasured claims (shared-screens.js:89–92). | **2.** The diff line "Remontado: 21 de 22 exercícios mudaram" (rebuilt: 21 of 22 exercises changed) is excellent. But the program asserts training history the user never gave. The copy says "quatro suposições" (four assumptions) while the strip shows 7 (c.js:101). Help promises the rest "pode esperar até depois da primeira sessão" (can wait until after the first session), and no such later step exists (c.js:105). |
| 6 | Progressive disclosure | **3.** Minutes, rest and priorities are deferred to chips, which is good. Browse, Custom and Build are over-deferred. | **3.** The five doors show early, and "Usar meu próprio programa" (use my own program) is a disclosure. Priorities shows every expert control at once. That is what Plan 054 requires, but it is heavy. | **2.** Everything is disclosed on first paint. |
| 7 | Editability and agency | **3.** Fact chips recompile in place in 3 taps (`jA-rec` steps 11–13), and each exercise row has an avoid sheet. Traps: a Browse preview has no way back to the list or the recommendation (buttons: Cancelar / Usar / Editar, `jA-rec` note). Import and build-setup have no working exit. | **3.** The rail and "Alterar uma resposta" (change an answer) work, but a jump discards the result and forces re-traversal (5 taps to change days, b.js:199). A Browse preview has no Back (`jB-browse` note). | **2.** Inline editing is powerful, but Keep discards (§4 C3). Once a catalogue program is picked there is no route back to the recommendation (`jC-rec` steps 18–19: route stays `browse`). |
| 8 | Error and recovery | **2.** Dead Cancel on 3 views. Build "Usar este programa" fails silently with `preview_not_ready` and no rendered message (`buildact-a`). Conflict and rules handling are correct (`jA-conf`). | **3.** Every Cancel opens the keep/discard dialog (`deadcancel.mjs`, all rows show `dialog=1`). The conflict state shows two overlapping pinned footers (`jB-conf__01`). Build activation fails silently exactly as in A. | **1.** Keep discards. Dead Cancel on 3 views. Build activates the default program in place of the one the user built. An existing user can replace a 7-session program with an unconfirmed default in 2 taps (`jC-exist__02-dialog`). |
| 9 | Mobile ergonomics | **3.** The pinned footer covers the last Q4 option at 390 (`jA-rec__04-q4`). The result's pinned bar is about 190 px and the program starts below the fold behind 7 chips (`jA-rec__05-result`). | **3.** Minutes and days segments crush the digits ("3/0", "9/0/+") at 390 and 430 (`jB-rec__04c-schedule-full`, `mx__b__rec-schedule__pt-light-430`). Vertical stacking avoids broken words on the result. | **2.** Fact editors sit under the pinned bar (`jC-rec__06-days4`). The 2668 px landing (metrics) is a long scroll before any action, apart from the pinned Use button. |
| 10 | PT-BR robustness | **3.** "SUPOSTO" (supposed) is an awkward tag for "assumed". "aparelho" appears in a.js:177 and in the shared privacy line (§5). | **3.** "Contin/uar" breaks mid-word at 200% (`mx__b__rec-schedule__pt-light-390-200`). "Opcional" appears twice on one screen (`jB-rec__06-prio`), and the goal lede repeats the title. | **2.** "aparelho" (c.js:157). "0/7 confirmado" is singular after a count. "Deixa pra lá" is slangy. The confirm label falls back to "OK", and the close button's aria-label falls back to English "Close" (c.js:229, c.js:270). |
| 11 | Accessibility | **2.** At 200% the result's side-by-side secondary buttons break words ("difere/nte?", "exerc/ício/s") and the pinned bar fills about 60% of the viewport (`mx__a__rec-result__pt-light-390-200`). Day blocks clip at 320/200% (matrix). | **3.** The pinned bar still fills about 55% at 200%, but its buttons stack full width without broken words (`mx__b__rec-result__pt-light-390-200`). The rail has aria-labels. The mid-word break sits in the question footer. | **2.** Same 200% word breaks as A, plus "Troc/ar progr/ama" (`mx__c__rec-result__pt-light-320-200`). Day sections clip at 320/200% on 8 states (matrix). Chip confirmed/unconfirmed state is carried by name and mark, which is good. |
| 12 | Visual hierarchy and craft | **3.** Calm, spare question screens. The result's first viewport is chips, not the program. | **3.** The program leads, and the hub doors are well ordered. The segment defect and footer collision undercut it. | **2.** Two headlines compete ("Um programa para começar amanhã" above "Ganhar massa"). The dashed-orange unconfirmed chips plus 18 orange links overload the page. |
| 13 | Brand and system fit | **3.** Uses `--positive` green for "Programa atualizado" (program updated) (a.js:299). Positive is reserved for PRs and completed targets. Drops Plan 054's product-loop preview from the landing. | **3.** Door time estimates are unmeasured claims (brand "Name the fact"; PRODUCT "No users yet"). Also drops the loop preview. Keeps the featured-primary accent keyline, the Plan 058 variant. | **2.** Breaks the One Mark Rule with 18 accent-deep "Deixar fora" links and accent-dashed chips (`c__landing__pt-light-390-full`). Uses `--positive` for confirmations (c.css:18) plus a 0/7 completion counter, which drifts toward a progress meter. |
| 14 | Cross-route coherence | **3.** Result chrome is uniform, but routes reached from the result lose the chips and the "something different" door. | **4.** One chrome, one section rail, one result layout for every route. | **3.** One program surface, but Build and Import leave it for full pages whose Cancel is dead. |
| 15 | Feasibility | **2.** Merges Recommend, Custom and Browse, which Plan 054's non-goals forbid. Injects defaults into answers before the question. Moves the Custom route change behind a Recommend result. | **4.** `ROUTE_STEPS` and `validationIssues` are used unchanged (b.js:161, 179). The replacement dialog replaces `window.confirm` (UI only). | **1.** Compiles before consent to any fact. Violates Plan 048 #3, #5 and #6 intent and Plan 054's non-goals. Its "result always exists" architecture already produces a wrong-program activation (§4 C2). |
| 16 | Improvement over PR #256 | **3.** Shorter Recommend and result-as-review, but loses route choice and the landing loop preview. | **3.** Door costs, the answer rail, program-first result and working inline recovery. Roughly baseline structure with better scent. | **2.** Genuinely new, but unsafe and regressive on existing-user replacement. |
| 17 | Validation value | **4.** A clean, testable hypothesis: does deferring route choice lift activation among uncertain lifters? | **3.** Tests whether cost labels cut hub abandonment. Incremental. | **3.** Tests program-first, but the unconfirmed-default confound makes any activation lift uninterpretable. |

---

## 2. Scenario-by-scenario verdicts

| # | Scenario | A | B | C | Strongest |
|---|---|---|---|---|---|
| 1 | Brand-new user | A headline and two actions. No product-loop explanation (`m-landing`). | "Saiba o que fazer na academia hoje" (know what to do at the gym today) and a lede that states the loop (program into sessions, every set logged, next target). This matches Plan 054's proposition. The two doors carry captions. | A program with 7 assumptions and no explanation of what Taurifer does. | **B.** It is the only one that says what the product does, which Plan 054 approved. |
| 2 | Uncertain route | "Como funciona" (how it works) explains the flow but does not help choose. | A two-question helper that names a door, then "Ir de Recomendar" (go with Recommend) (`jB-help` log reached `rec-goal`). | Help text that contradicts itself (c.js:105). | **B.** |
| 3 | Recommend | 11 taps, one decision per screen. | 15 taps, with a forced rest choice. | 1 unsafe tap, or 9 taps with hidden editors. | **A.** Fewest honest steps. Its assumed defaults are labelled and one tap from correction. |
| 4 | Correction | The equipment disclosure is on Q2, and the result chip reopens it in a sheet. | Section 4 with the rail. | The where-editor is inline but below the fold. | **A,** narrowly. The fix happens on the result without re-traversal. The content is shared (`TS.environmentCorrection`). |
| 5 | Pain avoidance | Reactive only, from a row sheet with reason chips and the pain note (`jA-rec__11-ex-pain`). Proactive search requires switching to the Custom route. | Proactive search plus a required reason. Continue stays disabled until the reason is chosen (`jB-avoid` note "next disabled? true"). The pain note is shown. The result lists "Suas restrições" (your constraints). | Reactive row editor, "Remontar sem ele" (rebuild without it), and a diff line. | **B.** A lifter with shoulder pain can exclude barbell bench *before* it appears. The fixture's bench press is not even in the 3-day program, so A and C can only reach this state through seeded reach (a.js reach `rec-avoid-pain`). |
| 6 | Browse | Only after 4 questions. Cards lack the progression model. No way back from the preview. | Cards lead with days, minutes, exercise and set ranges, progression model and equipment, as Plan 054 asks (`jB-browse__03-list`). No Back from the preview either. | 2 taps from landing, facts editable in the panel, but then no route back to the recommendation. | **B,** for the Plan 054 scan facts. All three need a working return from the preview. |
| 7 | Custom | Sheets on a Recommend result that silently switch the route. | Seven honest sections, with the shape explained when only one structure fits. | Tabs in a panel with "Remontar com estas escolhas" (rebuild with these choices). | **B.** It keeps Custom distinct, as Plan 054 requires. |
| 8 | Build | Setup Cancel is dead. "Usar" fails silently (`buildact-a`). | Cancel works. "Usar" fails silently (`buildact-b`). "Salvar rascunho" (save draft) is a toast only. | "Usar" activates the default "Build Muscle" instead of "Treino ABC" (`cbuild.mjs` output; `cbuild-today`). | **B,** as least bad. No candidate completes Build. |
| 9 | Free-form / import | Shared stages. Dead Cancel on import-source and import-review. | Shared stages with an explicit file door and paste door. Cancel works everywhere. | Same dead Cancel as A. | **B.** Import activation throws `Invalid program-entry result` in all three (§4 H1). |
| 10 | Shared | A clean gate. Preview Cancel returns to the gate. | Gate with "Recebido por link" (received by link). The preview offers a destructive "Começar de novo" that drops the coach's program without confirmation (`jb-sh__02-preview`). | Gate plus a preview that invites "Trocar programa" (switch program). | **A.** Cleanest consent path with no destructive side door. |
| 11 | Invalid link | Reason plus two actions. | Reason plus the two captioned doors. | Reason plus "Ver um programa para começar" (see a program to start). | **B,** narrowly, for the captions. |
| 12 | Existing program | Forced into Q1. Import is reachable only after 9 taps, and then it lands on the first-run landing (`aexist.mjs`, `jA-exist2__01-landing-for-existing`). | Hub with an active-program notice and every door (`jB-exist__01`). | A default program with "Arquivar o programa atual e usar este" (archive the current program and use this one) enabled at 0/7 (`jC-exist__01`). | **B.** |
| 13 | Recovery | Resume card says "Pergunta n de 4" (question n of 4). Rules notice plus rebuild. Keep works in the session. | Resume names the route and step and returns to that step (`jB-resume` → `rec-priorities`). Rules notice plus rebuild. | Keep discards (days 5→3, confirmed 0; `jC-cancel` log). | **B.** |
| 14 | Activation | Result then Use then Today. The conflict handling blocks, reviews and re-dialogs correctly (`jA-conf`). | Same, and the result cites all reasons. The conflict view has overlapping footers. | Activation without confirmation. | **B** for content, with A equal on flow. Today shows English program names in PT for all three (§4 H3). |

---

## 3. Biggest strength and biggest weakness

- **A.**
  - *Strength:* the result is the review. Seven labelled fact chips each recompile in place, and each
    exercise row opens a reasoned avoid sheet. This is the best correction model in the round
    (`jA-rec__05-result`, `jA-rec__11-ex-pain`).
  - *Weakness:* route choice is abolished rather than simplified. Browse, Custom and Build hide behind
    four questions. An existing user cannot import without answering them, and is then sent to the
    first-run landing (a.js:380, a.js:488).
- **B.**
  - *Strength:* it is the only candidate whose every Cancel, route and validation rule runs on the
    production state machine. Doors state their cost and outcome, and the result leads with the
    program plus a full rationale.
  - *Weakness:* changing an answer from the result throws the result away and re-walks the sections
    (b.js:199). Together with the mandatory rest choice, that makes it the slowest path to a
    corrected program.
- **C.**
  - *Strength:* the live diff line ("Remontado: N de M exercícios mudaram") is the clearest statement
    of consequence in the round.
  - *Weakness:* activation needs no confirmation of anything. The fact defaults describe an
    intermediate lifter. A novice who taps the most prominent button gets 18 exercises and 49 sets, where
    their true answers produce 15 exercises and 43 sets (`novice.mjs` output).

---

## 4. Correctness and product-truth defects

### Candidate C

- **C1. Activation without answers.** `#entryActivate` is enabled at 0/7 confirmed (c.js:260, where
  `disabled` depends only on `issue` and `conflict`). The defaults are `structuredExperience: "6_to_24m"`
  and `recentConsistency: "most"` (c.js:185). A first-program lifter therefore gets +3 exercises and
  +6 weekly sets, plus a `rep_goal` progression that is absent from their true compile (`novice.mjs`).
  This contradicts Plan 048 #3, #5 and #6 (ask what changes the program; experience and consistency
  are asked) and PRODUCT principle 1 (output follows the athlete's *declared* inputs).
- **C2. Build activates the wrong program.** `activateNow` uses `entry()`, whose `result` is still the
  default compile (c.js:201–202). Build never sets `S.result`. I built "Treino ABC" with 2 squats; Today
  then showed "Build Muscle", 18 exercises, Leg press first (`cbuild.mjs`; `cbuild-today`). The flaw is
  structural: in a program-first architecture, any route that forgets to set the result falls back to
  the default.
- **C3. "Guardar rascunho e sair" discards.** For a lifter with no program, the handler calls
  `fresh("fresh")` (c.js:378). In the browser, days went 5→3 and confirmed went →0 (`jC-cancel`).
- **C4. Existing-user replacement by defaults.** At `hub-existing`, "Arquivar o programa atual e usar
  este" is enabled with 0/7 confirmed. Two taps archive a 7-session program for an unconfirmed default
  (`jC-exist`).
- **C5. Dead Cancel.** Cancel on import-source, import-review and build-setup sets the overlay, but
  those views never render `cancelSheet` (c.js:294–304; `deadcancel.mjs`).
- **C6. False and misleading copy.**
  - "quatro suposições" (four assumptions) while the strip shows 7 (c.js:101).
  - The help promises a post-session revisit the product lacks (c.js:105).
  - "Manter, só mudar os fatos" is a no-op on a Browse program; the route stays `browse` (c.js:336;
    `jC-rec` 18–19).

### Candidate A

- **A1. Existing users sent to the first-run landing.** `bring` sets `S.view = "landing"` (a.js:380).
  That renders the generic first-run landing ("Sua próxima sessão, já decidida" and "Começar") to a
  user with an active program (`jA-exist2__01-landing-for-existing`). The brand guide says configured
  state never reopens that landing.
- **A2. Dead Cancel** on import-source, import-review and build-setup (a.js:352, 358, 361, none of
  which render `cancelSheet`; `deadcancel.mjs`).
- **A3. Build activation fails silently.** It returns `preview_not_ready`, and the error is rendered
  only in `result()` (a.js:223–229, 304; `buildact-a`).
- **A4. Routes merged.** Recommend, Custom and Browse are merged, which violates Plan 054's non-goal
  ("No merging Recommend and Custom, hiding expert controls"). The candidate declares this.
- **A5. Positive colour misused** for "Programa atualizado" (a.js:299).

### Candidate B

- **B1. Build activation fails silently,** as A3 (b.js:200–206; `buildact-b`).
- **B2. "Começar de novo" destroys without confirmation,** on the result, the Browse preview and the
  Shared preview (b.js:459). The semantic contract says "destructive … confirmation stays explicit".
- **B3. Door costs are unmeasured.** "cerca de 2 minutos" (about 2 minutes), "cerca de 5 minutos"
  (about 5 minutes) and "10 a 20 minutos" (10 to 20 minutes) (shared-screens.js:89–92) are presented
  as facts. PRODUCT.md records that there are no users yet.
- **B4. "Salvar rascunho" in Build only shows a toast** (b.js:460 area, `save-draft`). It fakes
  persistence.

### Harness defects (shared by all three; they do not discriminate between candidates)

- **H1.** Import and free-form activation throw `Invalid program-entry result` on the import-preview
  "Usar" (`impact.mjs`, all three). The import route is never proven end to end.
- **H2.** "Edit" then "Back to program" with no change silently rewrites the progression from
  `range, rep_goal` to `range`. The rationale changes, and activation then throws (`editact.mjs`;
  shared-screens.js:346–348). This alters the engine's conclusion, against PRODUCT principle 1.
  Every candidate exposes Edit prominently.
- **H3.** Today shows the English compiler name in PT ("Muscle + Strength · 4 days", "Build Muscle")
  and an untranslated "hamstrings,glutes" (runtime.js:328, 334; `jA-rec__17-today`).
- **H4.** The reason line reads "Prioriza priorizar ganho de massa." (it prioritizes "prioritize muscle
  gain"), a doubled verb (shared-screens.js:106+ `why_goal`), in all three. The gap error "Introduza
  valores válidos para os campos assinalados" uses European Portuguese (production catalog).

---

## 5. Accessibility and responsive defects

| Cand. | Defect | Where seen |
|---|---|---|
| A, C | Side-by-side secondary actions in the pinned bar break words mid-syllable at 200% ("exerc/ício/s", "Troc/ar"). The bar fills about 60–75% of the viewport. | `mx__{a,c}__rec-result__pt-light-{390,320}-200` |
| B | The pinned bar fills about 55% at 200%. "Contin/uar" breaks in the question footer. | `mx__b__rec-result__pt-light-390-200`, `mx__b__rec-schedule__pt-light-390-200` |
| B | Day and minute segments render the radio mark inside 5-column cells, so the digits stack ("3/0", "9/0/+"). | b.css:15 with base.css:118; `jB-rec__04c-schedule-full` (PT 390), `mx__b__rec-schedule__pt-light-430`, `mx__b__rec-schedule__en-dark-430-reduced` |
| B | The conflict state stacks a "Voltar" (back) footer over the confirm bar's secondary row. b.js:222 does not exclude `activation_conflict`. | `jB-conf__01` (PT light 390) |
| A, B | "Desenvolvimen/to vertical" (vertical press) breaks mid-word in the 2-column movement grid. | `jB-avoid__03-pain-full`, `a__rec-priorities__pt-light-390-full` |
| A, C | Day blocks clip (overflow hidden) at 320/200%. | matrix: `a/rec-result`, `a/replace-confirm`, `a/activation-conflict`, `c/*` at pt-light-320-200 |
| all | Import metrics clip "personaliz…" at 200%. | `mx__*__import-review__pt-light-390-200` |
| C | The fact editor and its confirm button render under the pinned bar. | `jC-rec__06-days4`, `jC-rec__01-days-open` |
| C | "OK" and English "Close" aria-label in PT. | c.js:229, c.js:270 |
| A | The pinned footer covers the last Q4 option. | `jA-rec__04-q4` |
| all | The "Privacidade" link is inert. | landing in all three |

Reduced motion is coherent in all three: the only motion is shared (`.view-enter`), and base.css:288–289
zeroes it. No candidate uses raw colours in its CSS. No horizontal overflow and no targets under 44 px
appeared in any of the 210 matrix renders (`matrix.json`).

---

## 6. Implementation conflicts and hidden product decisions

- **A** declares two decisions: routes merged, and minutes and rest assumed. That declaration is
  **incomplete**. It does not declare that:
  - existing users lose the hub (a.js:488);
  - proactive exercise avoidance is removed from Recommend (it exists only via Custom);
  - choosing "Escolher músculos e exercícios" (choose muscles and exercises) silently changes the
    route and the provenance to Custom (a.js `open-sheet` sets `S.mode = "custom"`);
  - Plan 054's landing loop preview is dropped.
- **B** declares "None". That is **nearly complete**. Undeclared:
  - the unmeasured time estimates on the doors;
  - an unconfirmed destructive "Começar de novo" on three surfaces;
  - dropping Plan 054's landing loop preview.
- **C** declares two decisions: pre-answer compile, and one surface. That declaration is **materially
  incomplete**. It does not declare that:
  - activation is allowed with zero confirmed facts;
  - an existing user can replace a program with defaults;
  - intermediate experience and consistency are the default (c.js:185);
  - the landing drops any explanation of the product loop.

---

## 7. Comparison against PR #256

| | Better | Equal | Worse |
|---|---|---|---|
| A | Recommend in 4 screens instead of 5 sections. Correction in place on the result. Row-level avoid. | Shared, import and free-form stages. | Loses the hub and route choice. Existing-user path. Loop preview. Dead Cancels. |
| B | Door cost and outcome. Answer rail. Program-first result with a fuller rationale. Help selector. Browse scan facts. | Section structure (`ROUTE_STEPS`). Recovery. | Loop preview dropped. Segment rendering. Unconfirmed restart. |
| C | Diff line. Browse reachable in 2 taps. | Shared stages. | Unconfirmed activation. Existing-user safety. Build correctness. No product explanation. Brand accent discipline. |

---

## 8. Final recommendation

**Winner: B, as the base for Round 2. It is not shippable as committed.**

Only B keeps the five jobs, the production state machine and every recovery exit working, and its
defects are local. A's efficiency comes from deleting route choice and failing existing users. C's
efficiency comes from activating facts the lifter never stated. Under the brief's rule that broken
product truth loses regardless of polish, C loses outright.

Explicit synthesis for Round 2:

1. **Keep B's hub, doors, sections and `ROUTE_STEPS`.** Remove the time estimates, or replace them with
   section counts only. Keep Recommend and Custom distinct, but give them different "Você recebe" lines.
2. **Adopt A's result-as-review.** Answer chips on the result recompile in place, replacing B's
   jump-and-retraverse. Add A's per-row avoid sheet as a complement to B's proactive avoid search.
3. **Adopt C's diff line** after every recompile.
4. **Preselect "Deixar o Taurifer escolher"** for rest. It is a real answer and still satisfies
   `validationIssues`.
5. **Fix these:**
   - confirm "Começar de novo";
   - add Back from Browse, Import and Shared previews;
   - render Build activation errors;
   - fix the `.b-seg` radio-in-segment layout;
   - fix the conflict footer collision;
   - stack pinned secondaries at 200%;
   - replace "aparelho";
   - restore Plan 054's loop preview on the landing.
6. **Fix harness defects H1–H3 before Round 2 judging.** Import and edit activation must be provable
   for every candidate.

## 9. Citations

All claims above carry inline citations. Supporting evidence:

- **E1.** A journey log (`jA.mjs`, `aexist.mjs`): Recommend reached the result at tap 10 and Today at
  tap 24 after edits. The existing user reached `route-choice` on the landing at tap 11.
- **E2.** B journey logs (`jB.mjs`, `jB2.mjs`): result at tap 14. Continue disabled until rest is set.
  "Começar de novo" → `route-choice` with no dialog.
- **E3.** C journey log (`jC.mjs`): "Use enabled at 0/7? true". Keep: days 5→3, confirmed 0. Existing
  user: Replace enabled at 0 confirmed.
- **E4.** `deadcancel.mjs`: A and C import-source, import-review and build-setup produce `dialog=0`.
  B produces `dialog=1` everywhere.
- **E5.** `impact.mjs`, `editact.mjs`, `buildact.mjs`, `cbuild.mjs`: activation failures and the
  wrong-program activation (C2).
- **E6.** `novice.mjs`: default compile 18 exercises / 49 sets / `range,rep_goal`. Novice compile 15 / 43 / `range`.
  20 catalogue cards, which confirms the "Vinte" (twenty) and "20" copy.
- **E7.** `matrix.mjs` / `matrix.json` and `metrics-pt-390.json`: overflow, targets and clipping per cell.
- **E8.** Baseline captures: `docs/ui-screens/screens/onboarding-start/{first-run,hub}__phone-390-light-pt.png`,
  `onboarding-recommend/{desired-result,result}__phone-390-light-pt.png`,
  `onboarding-shared/gate__phone-390-light-pt.png`.
