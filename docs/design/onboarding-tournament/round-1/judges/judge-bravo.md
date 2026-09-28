# Round 1: Judge Bravo

Artifact evaluated: branch `ccr-15c50ac8-pki40i`, freeze commit `9cf45d1a` (artifact `31a37b97`). HEAD at review time was `1d24269`, which only adds `round-2/generator-brief.md`. I did not read that file. I modified no candidate, harness, fixture or production file.

## How I judged

- **Sources read before scoring:** `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md` and `docs/brand-guide.md`. I read the Plan 058 semantic contract at the PR #256 baseline checkout (`…/scratchpad/pr256/docs/design/ui-system-semantic-contract.md`) because it is not present on this branch. I also read ADR 0007, ADR 0014, Plan 054 (Approved direction, Non-goals, Entry routes) and Plan 048 (Locked decisions, Recommend, Custom, Browse, Build, Import and Common preview). The baseline captures I compared against are the ones at `pr256/docs/ui-screens/screens/onboarding-*`, because the copies on this branch differ from the PR head.
- **Source code read:** `runtime.js`, `candidates/{a,b,c}.js`, the relevant parts of `shared-screens.js`, and `vendor/program-entry.js` (`ROUTE_STEPS` at L56–74 and `activationReadiness` at L1550–1566).
- **Browser work:** I drove every candidate in Chromium with Playwright, using a 390×844 phone at deviceScaleFactor 2 with locale pt-BR first and then en-US. Scripts are `j1`–`j11` in the scratch directory. The walks were:
  - landing to Today on the recommend path, counting taps;
  - the route-help helpers and every route door;
  - the environment correction, driven interactively from the result;
  - a pain avoidance;
  - browse to preview, then trying to get back;
  - custom include and avoid;
  - Build from the landing to activation;
  - the paste door through to import review: typed text, hand-off, reply, clipboard, submitting empty gaps, submitting bad gaps ("12-10", "abc"), then fixing them;
  - file import: deciding every row, committing, then activating;
  - the shared gate: start, cancel, start again;
  - the invalid link;
  - an existing program: cancelling and then confirming the replacement dialog;
  - the conflict: triggering it, choosing "review again", then activating;
  - resume, rules drift, and cancelling with each of keep, discard and continue;
  - edit-before-use followed by activating from the editor.
- **Matrix pass:** script `j8` ran 11 hard states × 6 cells for each candidate. The cells were PT light 320 and 430, PT dark 390, PT light 390 at 200%, EN light 390 with reduced motion, and EN dark 320 at 200%. Each cell recorded page height, pinned-action height, overflow and target size.
- **Screenshot paths:** `SB/` means `/tmp/claude-0/-home-user-repforge/d4429a92-dc1c-5374-aae2-80a77b0b0566/scratchpad/judge-bravo/shots/`. `ACC/` means `docs/design/onboarding-tournament/round-1/acceptance/shots/`. `BASE/` means `…/scratchpad/pr256/docs/ui-screens/screens/`.

---

## 1. Candidate-by-dimension comparison

Scale: 5 means excellent and 1 means broken or harmful. Scores are not curved.

| # | Dimension | A · Uma pergunta | B · Cinco portas honestas | C · Programa primeiro |
|---|---|---|---|---|
| 1 | Activation efficiency | **4.** It takes 11 taps from landing to Today for Rafael, with one decision per screen and the result doubling as the review (`j1-pt.log` "A TAPS 11"; `SB/j1-a-pt-00…06`). | **3.** It takes 15 taps: a landing split, then a 5-door hub, then 5 sections. Rest is required, because Continue stays disabled until a rest choice is made (`j1-pt.log` "B TAPS 15"; b.js:293–297). This is still better than the baseline, where result and review are separate. | **3.** Activation is 1 tap with nothing confirmed, or 9 taps with four facts confirmed (`SB/j1-c-pt-zero-activate`). The speed comes from activating a program built on assumed experience ("6_to_24m") and consistency ("most") (c.js:185). The fact editors sit behind the pinned bar (§5). Build activates the wrong program (§4). |
| 2 | Route comprehension | **3.** Other routes are captioned refinements in "Quer algo diferente?" (`SB/j7-a-pt-more`) plus a "Traga seu programa" sheet (`SB/j3-a-pt-bring`). Custom versus Recommend becomes invisible: it is a mode switch (a.js:398). | **4.** Every door states "Você faz" and "Você recebe" (`SB/j1-b-pt-01-hub`), and the Build and Import doors are grouped under "Usar meu próprio programa". The helper works (`SB/j7-b-pt-help`) but never routes anyone to Browse (b.js:280). | **2.** Routes appear as "Trocar este programa por…", and at 390 px the panel opens underneath the pinned CTA (`SB/j3-c-pt-switch`). After a Browse pick, "Manter, só mudar os fatos" does nothing (`j7c-pt.log` "'keep, change facts' after browse"). |
| 3 | Decision burden | **4.** There are 4 screens, each with one question and large targets (`SB/j1-a-pt-01-q1`). Screen 4 hides two questions behind the "Quatro perguntas" promise (a.js:113, 272). | **2.** The landing choice is followed by the same choice again on the hub. The hub carries about 400 words of door copy. Section 3 asks three things. Section 5 offers 10 muscles, 6 movements and a search (`SB/j1-b-pt-06-prio`). | **3.** Nothing is forced, but the screen shows 7 unconfirmed facts ("0/7 confirmado"), 18 "Deixar fora" buttons and a lede that says "quatro suposições" (`SB/j1-c-pt-00-landing`; c.js:101). What is actually required is unclear. |
| 4 | Information scent | **3.** The "suposto" tags on assumed facts are good (`SB/j1-a-pt-05-result`). Exercise rows carry a drill-in chevron but open "Deixar este exercício fora" (`SB/j7-a-pt-exsheetpain`). "Quer algo diferente?" is vague. | **4.** Cost and outcome copy is shown per door. The result's "Alterar uma resposta" buttons name their sections. However, "Começar de novo" wipes every answer in one tap with no confirmation (`j10` "answers {}"; b.js:459). | **2.** Tapping a fact chip visibly does nothing because its editor opens under the pinned bar (`SB/j2-c-pt-390-days-viewport`). The diff line reports impossible numbers such as "Remontado: 18 de 12 exercícios mudaram" (`j7c-pt.log`). |
| 5 | Trust | **3.** The chips expose every input and the assumptions. "Por que" is filtered down to goal and progression (a.js:287), so an environment correction is never explained (`j9` A rec-result-corrected). The pain sheet promises "um substituto seguro" (a.js:162). | **4.** The reasons include environment and equipment, and there is a "Suas restrições" list (`SB/j7-b-pt-painresult`; `j9` B rec-result-corrected). "Mesmas respostas, mesmo programa, sempre." is true (Plan 048 locked decision 11). The time costs ("cerca de 2 minutos", "10 a 20 minutos") are unvalidated estimates (shared-screens.js:89–92). | **2.** The program is built from assumptions that favour experience, and it can be activated with 0/7 facts confirmed. The positional diff arithmetic (c.js:197) yields "18 de 15" and "21 de 22". The help text says the rest "pode esperar até depois da primeira sessão" (c.js:105), but no fact is editable after activation. |
| 6 | Progressive disclosure | **4.** Minutes, rest, priority, custom, browse and build appear as sheets only after value has been shown. | **3.** Expert choices stay visible, as Plan 054 requires, but they are front-loaded into section 5. The "Usar meu próprio programa" disclosure is well judged. | **2.** Everything is on one surface of 2,668 px at 100% and 15,568 px at 200% (`j8.log`). |
| 7 | Editability and agency | **4.** Any fact can be re-edited from a chip sheet without restarting (`SB/j7-a-pt-wheresheet`), and an exercise kept out can be allowed back. After a Browse pick there is no way back to the recommendation or the list; only Cancel remains (`j10` "A browse-preview acts cancel,activate,edit"). | **3.** The rail and result jumps work, but a correction from the result re-walks the later sections (8 taps; `j7b-pt.log`). Restart is destructive without confirmation. The same Browse-preview trap applies. | **2.** Editing in place is the thesis, but it is occluded. "Guardar rascunho e sair" resets the facts to defaults: I set 5 days, kept the draft, and got 3 days back (c.js:378; `SB/j7-c-pt-afterkeep`). There is the same Browse trap. |
| 8 | Error and recovery | **2.** Build shows "Pronto para ativar." yet "Usar este programa" silently does nothing (`j5`/`j6`, issue `preview_not_ready` never rendered). Raw issue codes are joined for display (a.js:307). Resume, rules drift and conflict use the shared widgets correctly (`SB/j7-a-pt-resume`, `…-rules`, `…-conflict`). | **2.** Build has the same silent dead end (`SB/j6-b-buildactivated`), plus an unconfirmed restart. Resume names the route and step, which is the best resume card of the three (`SB/j7-b-pt-resume`). | **1.** Build activates the stale default "Build Muscle" program instead of "Treino ABC" (`SB/j6-c-buildactivated`). Keep-draft discards the draft. The diff counts are wrong. |
| 9 | Mobile ergonomics | **3.** Primary actions sit under the thumb, and the day buttons are 65×72. The pinned block is 151 px at 100%, and 360–511 px (43–60% of the viewport) at 200% (`j8.log`). | **2.** The session-length segmented control breaks at 390 and 430 px in both languages: digits stack as "3/0/min" and the controls are 67×101 (`ACC/b__rec-schedule__pt-light-390-100.png`; b.css:15). The hub doors are 125–146 px tall. | **1.** The pinned bar covers the fact editor at 390 px ("Confirmar" top 779 against pin top 693) and puts it off-screen at 320 px (`j2`). It also covers the switch panel. Each exercise row adds another target. |
| 10 | PT-BR robustness | **3.** The copy is natural ("Sua próxima sessão, já decidida."). a.js:177 uses "aparelho", which `test/i18n.mjs` rejects (pr256 `test/i18n.mjs:436`). At 200% the buttons break mid-word ("Próxim/a", "exercíc/ios") (`SB/m8.png`). | **3.** Copy is natural, but "Opcional" appears twice on section 5 and "Ir de {route}" is awkward (b.js:106). The shared "aparelho" appears in `x.cost.file`. At 200% its secondaries stack full-width and do not break. | **2.** "quatro suposições" sits beside 7 chips. "Deixa pra lá" is colloquial. The switch panel's close button has the English aria-label "Close" in PT (c.js:270). c.js:157 uses "aparelho". |
| 11 | Accessibility | **3.** Radiogroups, heading focus and a live progress label are present. The pinned bar takes up to 60% of the viewport at 200%. Buttons break mid-word. | **3.** It is the best of the three at 200% (`SB/m9.png`). The segmented-control breakage at 100% is also a legibility failure. | **2.** Editors are occluded. The live status is numerically false. There is an English aria-label. The first screen is 15.5k px tall at 200%. |
| 12 | Visual hierarchy and craft | **4.** Calm question screens with one clear primary. The result's column of 7 chips pushes the program down (`SB/j1-a-pt-05-result`). | **3.** The result leads with the program and the days collapse (`SB/j1-b-pt-07-result`). The hub is dense, and the schedule control is visibly broken. | **2.** 18 orange "Deixar fora" links and orange chip rings compete on one surface (`SB/j1-c-pt-00-landing`). |
| 13 | Brand and system fit | **4.** One accent, the landing recipe IDs (`#firstRunCreate`, `#firstRunImport`), token-only CSS. | **4.** The featured accent-outline door matches Plan 058's `.entry-card--primary` variant, and the landing recipe IDs are kept. | **2.** It breaks the One Mark Rule (DESIGN.md "Named Rules") with 18 accent-deep link buttons, and it removes the Plan 054 landing entirely. |
| 14 | Cross-route coherence | **4.** Every route lands on the same result surface and chrome. | **4.** Every route shares the same chrome and review. | **3.** Routes converge on the program surface, but once you switch away you cannot come back. |
| 15 | Feasibility | **3.** Merging Recommend, Custom and Browse into one guided path contradicts the Plan 054 Non-goal "No merging Recommend and Custom". Assuming minutes contradicts Plan 048 locked decision 7, which asks for minutes. Mapping onto `ROUTE_STEPS` is otherwise workable. | **4.** `ROUTE_STEPS` is used unchanged (b.js:161). Build activation needs the editor draft set as the result, which is a simple fix. | **2.** It needs default-answer compilation before any question, which skips locked decisions 5–6 on experience and consistency, drops the Plan 054 landing, and merges routes. Its activation is wired to a stale result (c.js:200–207). |
| 16 | Improvement over PR #256 | **4.** Fewer steps, a merged result and review, and visible assumptions. | **3.** It merges result and review and makes costs visible. The schedule layout regresses against the baseline's clean 3+2 grid (`BASE/onboarding-recommend/schedule__phone-390-light-pt.png`). | **2.** It is faster, but it regresses on truth, ergonomics and the landing contract. |
| 17 | Validation value | **4.** It tests the key activation hypothesis: whether deferring the route choice raises completion without hurting trust. | **3.** It tests whether stated costs improve route choice, which is incremental. | **3.** It tests the most radical hypothesis (activation with zero questions), but its defects would confound the reading. |

---

## 2. Scenario-by-scenario verdicts

| # | Scenario | Strongest | Why (evidence) |
|---|---|---|---|
| 1 | Brand-new user | **A** | One promise and two plain actions (`SB/j1-a-pt-00-landing`). B asks "Quero um programa / Já tenho" and then asks again on the hub (`SB/j1-b-pt-00`, `-01`). C skips the landing and puts an assumed program in front of a first-time user (`SB/j1-c-pt-00`). |
| 2 | Uncertain route | **A** (B's helper second) | A spares the uncertain user the choice altogether. B's two-question helper works (`SB/j7-b-pt-help`) but can never point to Browse (b.js:280). C's "Não sabe por onde começar?" gives advice that is misleading (c.js:105). |
| 3 | Recommend | **A** | 4 screens and 11 taps, with the program shown immediately (`SB/j1-a-pt-05-result`). B takes 15 taps through a broken schedule control. C's fact editors are occluded. |
| 4 | Correction | **B** | Only B explains the consequence: "Feito para equipamento limitado em casa. / Usa Halteres, Faixa elástica." (`j9`; `SB/j7-b-pt-resultcorrected`). A's sheet is quicker (`SB/j7-a-pt-wherecorrected`) but its "Por que" drops the environment. C reports "18 de 12". |
| 5 | Pain avoidance | **B** | Search, then a required reason (Continue stays disabled while the reason is pending; `j7b-pt.log`), the conservative production pain note, and the constraint echoed in the result (`SB/j7-b-pt-pain`, `-painresult`). A only avoids exercises already in the program and overclaims "substituto seguro". C's inline editor works but hides under the pinned bar. |
| 6 | Browse | **B** | A dedicated two-step compatibility context, then 4 fits plus "Outros horários (16)" (`SB/j7-b-pt-browselist`). All three trap the user on the preview with no path back to the list. |
| 7 | Custom | **B** | It is a distinct route that follows Plan 048's Custom flow, including the sole-structure explanation (`SB/j7-b-pt-customshape`). A and C fold Custom into a mode switch. |
| 8 | Build | **None** | A and B fail silently after "Pronto para ativar." (`SB/j6-a-buildactivated`, `SB/j6-b-buildactivated`). C activates a different program (`SB/j6-c-buildactivated`). A and B are the less harmful failures. |
| 9 | Free-form / import | **Tie A = B** | The widgets are shared and identical. Both reach the paste door in one tap from the landing, while C needs the switch panel. Activation from import throws `Invalid program-entry result` in all three (`j4`), which is a harness defect and does not separate the candidates. |
| 10 | Shared link | **B** | A "Recebido por link" card holds the name, days and exercise count, with the privacy line beside it (`SB/k-b-shared-gate`). None offers a "not now" action (Plan 054 UX spec). |
| 11 | Invalid link | **Tie A = B** | Both give a fail-closed reason and the generic doors (`SB/j7-a-pt-invalid`, `SB/j7-b-pt-invalid`). C's recovery leads straight into the assumption program. |
| 12 | Existing program | **B** | All three use the same notice and dialog. B's conflict view adds a Back path. C shows a one-tap "Arquivar o programa atual e usar este" on the very first surface for an active user (`j7c-pt.log` hub-existing). |
| 13 | Recovery | **B** (A close) | B's resume card names "Recomendação · Algo para priorizar ou evitar?" and returns to that exact step. A returns to question 4. C's keep-draft discards the facts. |
| 14 | Activation | **A** | It has the fewest taps to a program whose facts the lifter has actually answered (`SB/j1-a-pt-06-today`). C is faster only because it activates assumptions. |

---

## 3. Biggest strength and biggest weakness

- **A**
  - *Strength:* it removes the route decision a new lifter cannot make, asking four one-screen questions that land on a result which is also the editable review, with assumed facts labelled "suposto".
  - *Weakness:* it merges routes against the Plan 054 non-goal, and Build is a silent dead end.
- **B**
  - *Strength:* it is honest and faithful to the contract. It keeps `ROUTE_STEPS` unchanged, states costs and outcomes, gives the richest reasons (including the consequences of a correction), and handles 200% text best.
  - *Weakness:* it is the most expensive path to activation (a double route decision and 15 taps), the section 3 control is broken at common widths, and "Começar de novo" destroys all answers without confirmation.
- **C**
  - *Strength:* it is the boldest learning probe, putting a real compiled program on screen at the first frame.
  - *Weakness:* it lets a user activate unconfirmed assumptions about their experience, and several of its mechanics are broken: occluded editors, wrong diff counts, keep-draft discarding the draft, and Build activating the wrong program.

---

## 4. Correctness and product-truth defects

| Candidate | Defect | Evidence |
|---|---|---|
| **C** | Build activates the stale default program ("Build Muscle"), not the program the user built ("Treino ABC"). `activateNow` passes `S.result`, which still holds the initial compile. | c.js:189, 200–207; `SB/j6-c-buildfilled`, `SB/j6-c-buildactivated`; `j6` log |
| **A, B** | Build's "Usar este programa" is enabled under "Pronto para ativar." but does nothing: `activationReadiness` returns `preview_not_ready` because `result === null`, and the build view never renders `S.activationIssues`. | vendor/program-entry.js:1561–1563; a.js:352–356; b.js:352–358; `j5` state dump `{"issues":["preview_not_ready"],"result":false}` |
| **A, B, C** | Edits made in "Editar exercícios" / "Editar antes de usar" are thrown away if the user activates from the editor. I removed 2 of 18 exercises and the activated program still had 18. | a.js:437–438, b.js:456–457, c.js:380–381; `j11`: "editor rows 18 -> 16 … active 18" |
| **C** | The diff line is positional and reports impossible counts: "18 de 12", "18 de 15", "21 de 22" when only the day count changed. | c.js:197; `j2`, `j7c-pt.log`, `j9` |
| **C** | "Guardar rascunho e sair" calls `fresh("fresh")`, which discards the draft it claims to keep. | c.js:378; `j7c-pt.log` "after cancel-keep (should keep 5 days)" → 3 dias |
| **C** | A program can be activated with 0/7 facts confirmed. The defaults assume 6–24 months of experience and most sessions completed, so a first-timer gets an experienced lifter's first week. This contradicts Plan 048 locked decisions 5–6 (ask about recent behaviour and experience). | c.js:185, 261; `SB/j1-c-pt-zero-activate` |
| **C** | The help text promises facts "podem esperar até depois da primeira sessão", but no post-activation surface recompiles from facts. | c.js:105 |
| **C** | The defaults equal Rafael's fixture answers apart from rest, which flatters C on scenario 3. | c.js:185 against data/fixtures.js:1870–1877 |
| **B** | "Começar de novo" on the result clears all answers with no confirmation, which violates the contract's `destructive` rule that confirmation stays explicit. | b.js:459; `j10` "answers {}" |
| **B** | "Salvar rascunho" only shows a toast; nothing is persisted. | b.js:458 |
| **A** | The pain sheet promises "um substituto seguro", which is stronger than the production pain note ("compatível"). | a.js:162 |
| **A** | "Quatro perguntas" is five answers: screen 4 asks experience and consistency. | a.js:113, 272 |
| **B** | Unvalidated time estimates are presented as facts ("cerca de 2 minutos", "10 a 20 minutos"). | shared-screens.js:89–92 |
| **A, B, C** | Raw engine codes can be shown to users (`S.activationIssues.join(", ")`), as can the compile-error `code`. | a.js:285, 307; b.js:316, 338; c.js:236, 260 |
| **All (shared)** | "aparelho" ships in PT copy, which `test/i18n.mjs` rejects (`/aparelhos?/`). | shared-screens.js:94, 101; a.js:177; c.js:157; pr256 `test/i18n.mjs:436` |
| **All (harness)** | Import activation throws `TypeError: Invalid program-entry result`. `importPreview` produces a result `setResult` rejects, so no candidate reaches Today from import. | runtime.js:189, 311; vendor/program-entry.js:1374; `j3`, `j4` |
| **All (harness)** | Today in PT shows the English `result.name` ("Build Muscle") even though the result screen said "Ganhar massa". | runtime.js:328; `SB/j6-c-buildactivated` |
| **All (baseline carry-over)** | "Prioriza priorizar ganho de massa." is a string composition error that is also present at PR #256 (`BASE/onboarding-recommend/result__phone-390-light-pt.png`). European Portuguese strings are also carried over ("separador", "regista", "Introduza", "O meu programa", "Porquê"). No candidate fixed either. | shared-screens.js:109; `SB/k-b-ff-gaps-invalid`, `SB/j7-a-pt-exsheetpain` |
| **All** | After choosing a Browse card there is no path back to the catalogue or the recommendation, only Cancel. In C, "Manter, só mudar os fatos" is a no-op. | `j10` action lists; `j7c-pt.log` |

---

## 5. Accessibility and responsive defects

| Candidate | Defect | Cell / evidence |
|---|---|---|
| C | The fact editor opens underneath the pinned action bar ("Confirmar" 779–827 px against pin top 693 at 390 px, and off-screen at 320 px). The switch panel's doors are likewise hidden. | PT light 390 and 320 at 100%; `SB/j2-c-pt-390-days-viewport`, `SB/j2-c-pt-320-days-viewport`, `SB/j3-c-pt-switch` |
| B | The minutes and days segmented controls stack digits vertically ("3/0/min", "9/0/+/min"), with minute buttons at 67×101. | PT/EN light 390 and 430 at 100%; `ACC/b__rec-schedule__pt-light-390-100.png`, `SB/j2-b-pt-430-sched`, `SB/j2-b-en-390-sched`; cause b.css:15 |
| A, C | Button labels break mid-word ("Próxim/a", "Quer algo diferente/?", "Trocar progra/ma", "exercíc/ios", "Swit/ch progr/am"). | PT light 390 at 200%; EN dark 320 at 200%; `SB/m8.png`, `SB/m9.png` |
| A, B, C | The pinned action block takes 360–511 px of an 844 px viewport at 200% text: A 360 and 511, C 315–360 and 511, B 304 and 500. With the pin in place, C's conflict notice body is partly hidden. | `j8.log`; `SB/m-c-activation-conflict-en-dark-320-200-normal.png` |
| C | The first screen is 2,668 px tall at 100% and 15,568 px at 200%, with 18 extra "Deixar fora" targets. | `j8.log` C landing |
| C | The close button has the English aria-label "Close" in the PT UI. | c.js:270; `j3` dump "Close[52x44,panel]" |
| A, C | Exercise rows show a navigation chevron (A) or an accent link (C) for an avoid action, which is misleading scent for screen-reader and sighted users alike. | `SB/j1-a-pt-05-result`, `SB/j1-c-pt-00-landing` |
| All (shared) | Free-form buttons break mid-word even at 100% ("Rever o program/a", 174×104). | PT light 390 at 100%; `SB/k-b-ff-gaps-invalid` |

Dark theme parity was clean for all three (`SB/m13.png`). Reduced motion is one global kill switch in base.css:288–289; no candidate adds motion, so reduced motion is coherent in every case. The trade-off is that C's live rebuild is then signalled only by its incorrect diff line.

---

## 6. Implementation conflicts and hidden product decisions

- **A**
  - *Declared:* routes merged and assumed defaults (a.js:7–12).
  - *Completeness:* the declaration is incomplete. It omits four things:
    - the merge directly violates the Plan 054 Non-goal "No merging Recommend and Custom", not just "what Plan 054 kept separate";
    - Custom loses its distinct questions and provenance, against Plan 054's "Recommend and Custom keep distinct questions/provenance";
    - Browse is reachable only after a generated result exists;
    - the rest and minutes assumptions override Plan 048 locked decision 7 ("Ask weekly frequency, approximate minutes, preferred rest").
- **B**
  - *Declared:* "None" (b.js:7–9).
  - *Completeness:* the declaration is mostly accurate but not complete. B adds a pre-hub landing split that Plan 054 did not specify ("Start training opens the five-job chooser"). It presents unvalidated time costs as facts. It adds an unconfirmed destructive "Começar de novo" on the review.
- **C**
  - *Declared:* default compilation and routes on one surface (c.js:7–12).
  - *Completeness:* the declaration is incomplete. It omits four things:
    - the Plan 054 landing is removed;
    - activation is possible with zero confirmed facts, which effectively drops Plan 048 decisions 5–6 and makes Section 2 optional;
    - defaults are biased toward an experienced lifter;
    - the copy promises post-activation editing of facts that does not exist.
- **All three**
  - The replacement uses a dialog in place of `window.confirm`. That is a UI change and is fine.
  - None implements the Plan 054 "close alternative" slot, even though `compile` returns `alternative` (runtime.js:100).
  - None offers a decline action at the shared gate.

---

## 7. Comparison against PR #256 onboarding

Baseline: `BASE/onboarding-start/first-run`, `hub`, `onboarding-recommend/schedule`, `result`, `activation-conflict`.

| Aspect | A | B | C |
|---|---|---|---|
| Landing | Equal. It has a clearer promise but loses the product-loop preview. | Equal. | Worse: the landing is gone. |
| Route choice | Better for new lifters, because the choice is deferred. | Better: costs and outcomes are stated. It is worse in one respect, because the landing split duplicates the choice. | Worse: the routes are hidden. |
| Questions | Better: one per screen, 4 screens instead of 5. | Worse in section 3: the layout regresses against the baseline's 3+2 grid. | Different: no questions, but occluded editors. |
| Result and review | Better: merged, with visible assumptions. | Better: merged, program first, the baseline's full reasons kept. | Worse: an assumption-based program with false diff counts. |
| Recovery and conflict | Equal (shared). | Equal, slightly better on resume. | Worse: keep-draft is broken. |
| Build | Worse: the baseline activates, A does not. | Worse, for the same reason. | Worse: it activates the wrong program. |

---

## 8. Final recommendation

**Winner: A, taken as the direction. It is not shippable as committed. The synthesis below is required.** A is the only candidate that actually lowers the activation cost for a lifter who does not know which route is right, and it does so without activating unconfirmed guesses. The saving is 11 taps against 15, and no route decision is asked before value. C is faster, but only by activating assumptions, and its product-truth defects disqualify it: Build activates the wrong program, keep-draft discards the draft, and the diff counts are false. B is the most faithful and the most honest, but it spends the lifter's attention on a double route decision and a broken section 3.

Required synthesis for Round 2:

1. **Keep from A:** the one-question-per-screen recommend path; the result that doubles as the review, with fact chips and "suposto" tags; the sheet-based refinements.
2. **Restore Plan 054 separation in A's refinement sheet.** Custom must stay a named, deliberate alternative with its own questions and provenance, and Browse must be reachable from the landing sheet, not only after a result. Otherwise the owner has to explicitly approve the Plan 054 non-goal breach.
3. **Graft from B:**
   - the full reason set, including environment and equipment, so corrections are explained;
   - the "Você faz / Você recebe" captions for each refinement;
   - the "Suas restrições" list;
   - the resume card that names route and step;
   - the 200% button stacking.
4. **Rest and minutes:** either ask for them or keep them as labelled assumptions, and get an owner sign-off against Plan 048 decision 7.
5. **Fix for any winner:**
   - Build must activate the editor draft;
   - activating from the editor must apply the edits;
   - there must be a path back from a Browse preview to the list and the recommendation;
   - no raw codes shown to users;
   - no "aparelho";
   - no "substituto seguro";
   - every destructive reset needs confirmation;
   - buttons must not break mid-word at 200%.
6. **Reject from C:** zero-confirmation activation and positional diffs. Keep only the idea of explaining what a change did, and do it correctly.
7. **Harness to fix before Round 2 so import can be judged end to end:** import activation must stop throwing, and Today must show a localized program name.

---

## 9. Citations

Every claim above carries its citation inline. Consolidated index:

- **Product authorities:**
  - `PRODUCT.md` (Brand Commitments, Principles 5)
  - `DESIGN.md` (One Mark Rule, 44 px, 16 px, Flat Content)
  - `docs/brand-guide.md` (Voice and copy, Portuguese rules)
  - `pr256/docs/design/ui-system-semantic-contract.md` (Controls: `destructive`, featured entry)
  - `docs/adr/0007` (gate = consent)
  - `docs/adr/0014` (hand-off)
  - `plans/054` (Approved direction L28–42, Non-goals L48–59, Entry routes L113–122)
  - `plans/048` (Locked decisions L94–133, Recommend L319–403, Common preview L500–528)
  - `pr256/test/i18n.mjs:436`
- **Engine:** `docs/design/onboarding-tournament/vendor/program-entry.js` L56–74, L1374, L1550–1566; `runtime.js` L100, L189, L307–331.
- **Candidate sources:**
  - `candidates/a.js` L7–12, 113, 162, 177, 185, 285, 287, 307, 352–356, 398, 437–438
  - `candidates/b.js` L7–9, 106, 161, 280, 293–297, 316, 338, 352–358, 456–459
  - `candidates/c.js` L7–12, 101, 105, 157, 185, 189, 197, 200–207, 236, 260–261, 270, 378, 380–381
  - `candidates/shared-screens.js` L89–101, 109
  - `candidates/b.css` L15
- **Browser logs (scratch):** `j1-pt.log`, `j3-pt.log`, `j7a-pt.log`, `j7b-pt.log`, `j7c-pt.log`, `j8.log`, and console output of `j2`, `j4`, `j5`, `j6`, `j9`, `j10`, `j11` (scripts in the scratch directory).
- **Screenshots (scratch, `SB/`):**
  - `j1-{a,b,c}-{pt,en}-*`, `j2-*`, `j3-*`, `j5-*`, `j6-*`, `j7-{a,b,c}-pt-*`, `k-*`, and the matrix cells `m-{c}-{checkpoint}-{lang}-{theme}-{w}-{text}-{motion}.png`
  - contact sheets `../m1.png`–`../m13.png`
- **Acceptance:** `ACC/b__rec-schedule__pt-light-390-100.png` (the defect is present in a cell marked as a hard pass).
- **Baseline:** `BASE/onboarding-start/{first-run,hub}__phone-390-light-pt.png` and `BASE/onboarding-recommend/{schedule,result,replacement-confirm,activation-conflict}__phone-390-light-pt.png`.
