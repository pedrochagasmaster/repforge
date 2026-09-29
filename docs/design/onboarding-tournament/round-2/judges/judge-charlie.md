# Round 2 judge report: Charlie

Artifact: `/home/user/repforge` at commit `0af5848eb480d33906537f5591bfc14054f80c64` (freeze of artifact
`2396890`). Candidates D, E and F. I read the judge brief, the product sources it lists, the
synthesis spec, the generator brief, `JOURNEYS.md`, the manifest, the acceptance summary and the
three candidates' sources and notes. I did not read any other judge's work.

## How I gathered the evidence

- I drove the phones myself with Playwright (Chromium 1194, `--no-sandbox`) against
  `http://127.0.0.1:8123/…/round-2/app.html`, with locale `pt-BR` unless stated, DPR 1, 390×844
  unless stated. My scripts are `walk.mjs` (step-driven taps), `s1.mjs` (checkpoint captures),
  `chg.mjs` (where the change statement sits after a recompile), `meas.mjs`, `words.mjs` and
  `smoke.mjs`. `smoke.mjs` taps every visible control on every checkpoint once and flags raw
  keys, `undefined` and runtime errors.
- **S/** stands for my screenshot directory,
  `/tmp/claude-0/-home-user-repforge/d4429a92-dc1c-5374-aae2-80a77b0b0566/scratchpad/judge-charlie/shots/`.
  Files named `M__<checkpoint>__<cell>.png` show D, E and F side by side, left to right.
- `d.js:N`, `e.js:N` and `f.js:N` are `round-2/candidates/<id>.js` at line N. `ss.js` is
  `candidates/shared-screens.js`. Spec IDs (C-n, R-n, L-n, SM-n, O-n, PD-n) refer to
  `round-1/synthesis-spec.md`. SC is the Plan 058 semantic contract at the PR #256 head.
- Acceptance at the freeze: every candidate has 360/360 clean checkpoint cells and 122/122
  journeys passed (`round-2/acceptance/summary.md`). The acceptance run has blind spots, and three
  of the defects below sit in them.

---

## 1. Candidate-by-dimension comparison

Dimensions 1–17 are scored 1–5. Dimensions 18–20 are pass, partial or fail.

| # | Dimension | D · control | E · uma pergunta por vez (PD-1) | F · a primeira pergunta |
|---|---|---|---|---|
| 1 | Activation efficiency | **3.** Rafael takes 15 taps from landing to Today: 14 to the review in my walk plus activation (`dR` run, "TAPS 14"). The chooser costs a tap, and "Pular esta seção" / "Mostrar meu programa" is one extra decision on the optional section (S/dR__prio.png). | **3.** 16 taps (my walk reached the review in 15; manifest K-24). It saves the chooser but pays one Continue per question, 7 of them (S/eR__days.png). | **4.** 13 taps (my walk reached the review in 12). Answering the goal on the chooser *is* the Recommend choice (S/fR__s1.png shows the goal carried with "Alterar"). Browse reaches its list in 5 taps, against D's 6 and E's 7 (`fB`, `dB` and `eB` runs). |
| 2 | Route comprehension | **4.** Every door states "Você faz / Você recebe", and Recommend and Custom have different outcome lines (S/d__route-choice__pt-light-390-100-full.png). The helper asks two questions and ends at all five jobs (`d.js:396-405`). | **3.** The other four jobs sit under the question as a list (S/e__route-choice__pt-light-390-100-vp.png). Build and Import become separate rows, not the "Usar meu próprio programa" group. The Browse row promises "2 perguntas" but asks three separate screens (`e.js:71`; `eB` run: days, minutes, environment). | **4.** The featured block is labelled "Recomendar um programa" and the lede says truthfully "Responder à primeira pergunta já começa a recomendação" (S/f__route-choice__pt-light-390-100-full.png). The helper is one question with five statements. |
| 3 | Decision burden | **3.** A route choice comes before any answer, and the priorities section offers both Skip and Show (S/dR__prio.png). | **4.** One decision per screen, and the first decision is the goal. The review then carries 18 controls (`words.mjs`: rec-result has 18 buttons against D's 10 and F's 13). | **4.** The first decision is the goal itself. The disabled reason lists what is still missing: "Falta responder: tempo com programas, últimas seis semanas." (S/fR__s1.png). |
| 4 | Information scent | **3.** After a correction the change statement is off screen. It sits 401 px above the viewport at 390 and 2,836 px above at 320/200 (`chg.mjs`), because focus returns to "Alterar" below the weekly structure (`d.js:636`). S/dC__after.png shows no visible sign that anything changed. | **4.** The statement stays in view at both sizes (`chg.mjs`: top 177 at 390, 405 at 320/200), and the changed answer is underlined (S/eC__after.png). Two copy slips: the Browse count, and "Suas respostas vieram junto" when switching from Import to Build, where there are no answers to carry (`eI` run). | **3.** The before/after block is in view at 390 (S/fC__after.png) but 606 px above the viewport at 320/200 (`chg.mjs`). The third import door shows the raw key "entry.route.undefined" and goes nowhere (S/fI2__after.png). |
| 5 | Trust | **4.** Full reasons and the determinism line. On the pain case it says "Restrições aplicadas. Nenhum exercício mudou." (`d__rec-result-avoided` text). | **4.** Clearest pain explanation: "Não estava no programa, então nada foi trocado." (`e__rec-result-avoided` text). It also shows "Nenhum ajuste foi necessário." explicitly. | **3.** The before/after block is honest. The answer chip "Quase todas as sessões" misstates the answer "Completei a maioria das sessões planejadas", and EN says "Most sessions" (`f.js:135` against `f.js:261`). |
| 6 | Progressive disclosure | **4.** Build and Import sit in a disclosure. The answers come after the program. | **3.** The review holds everything: answers, optional editors, adjustments, four route rows, Edit and Start over. It runs 319 words and 5,911 px at 320/200 (`words.mjs`, `meas.mjs`). | **4.** The chooser is compact. Chips are one tap from a sheet. |
| 7 | Editability and agency | **4.** Sheets per fact, Restore, and an answer rail during the questions. Correcting means scrolling past the whole week first (S/dR__review-full.png). | **5.** Inline editors. Switching route from the review carries the answers, and Back restores route, step, answers and the 18-exercise result exactly (`eSw` run: `entry()` back to recommend/result, n=18). | **4.** A sheet per chip with a fixed footer, and focus returns to the chip (`fK` run). |
| 8 | Error and recovery | **5.** `smoke.mjs` found no issues on any of the 45 checkpoints. Switching paste ↔ file keeps the paste session (`dS` run returns to `ff-reply`), and the switches are hidden during gap repair (`d.js:564`). Resume sits on the chooser, so an existing user can reach it (`d.js:412`). | **2.** Any tap on the import-mode tabs, **including the tab already active**, silently wipes the pasted program, the reply and the gap answers (`e.js:784`; `eS3`/`eS4` runs: `ff-gaps` goes to `ff-empty`, "0 de 12.000"). Resume and rules-changed render only on the landing (`e.js:642-652`). An existing user who taps Keep gets a resumable draft and no surface that shows it (`eK` run). | **2.** The same silent wipe (`f.js:834`; `fS3`/`fS4` runs), again including a tap on the current door. The third import door is dead (`f.js:644` sets no `data-route`; `f.js:799` reads `d.route`). Resume on the landing and on the chooser works (`f.js:720`, `f.js:735`). |
| 9 | Mobile ergonomics | **3.** Only the primary is pinned (9% at 390; 21% at 320/200, `meas.mjs`). Correcting an answer needs a long scroll. | **3.** The pinned bar is removed while an editor is open, which is good (S/eC__open-lh.png). The review is the longest page, 5,911 px at 320/200. | **4.** The pinned bar holds the primary only. The chips are 44 px targets and sit within one thumb reach of the facts (S/fR__review.png). |
| 10 | PT-BR robustness | **4.** No word breaks at 320/200 (S/M__rec-result__pt-light-320-200-full.png). One "guardadas" (`d.js:48`). Long uppercase production labels. | **4.** The question headings read naturally ("Até quanto tempo pode durar uma sessão?"). "6 a 24 meses de programa" is slightly stiff. | **3.** "Guardada em {date}" and "configuração guardada" (`f.js:69-72`), plus the "Quase todas" misstatement above. |
| 11 | Accessibility | **4.** Focus goes to the sheet title and returns to the opener, and Escape closes (`dK` run). A missing answer focuses a `role=alert` summary (`dV` run, S/dV__val.png). | **3.** Focus handling is correct (`eK2` run). The import-mode switches carry `aria-pressed` (`e.js:579`), which SC "Import-mode subview switches" forbids by name. | **4.** Focus goes to the sheet title and returns to the chip, and Escape closes (`fK` run). The current import door uses `aria-current` with a check mark (`f.js:644`). |
| 12 | Visual hierarchy and craft | **4.** Calm, and the program comes first (S/dR__review.png). Minor: the shared preview shows two stacked labels, "PROGRAMA COMPARTILHADO" and "PROGRAMA TAURIFER COMPARTILHADO". | **3.** The first review viewport goes to nine underlined answer rows, and the first day heading sits at the fold (S/eR__review.png). That repeats the Round 1 A problem ([S-7]). | **4.** The strongest first viewport: name, facts, chips and the first day's rows (S/fR__review.png). Custom-result breaks L-3: the chips fill the first viewport and the week is below it (S/M__custom-result__pt-light-390-100-vp.png). |
| 13 | Brand and system fit | **5.** Header navigation and the Privacy link are ink. Orange is kept to the primary, the featured door and changes (S/M__route-choice__pt-light-390-100-vp.png). | **3.** Orange Voltar, Cancelar, Privacidade and inline links on the same screen (shared `.btn--link` recipe, `base.css:90`), plus the `aria-pressed` switch. | **3.** Orange Voltar, Cancelar, Privacidade and orange eyebrows alongside the orange featured block (S/f__route-choice…-vp, S/M__shared-gate__pt-light-390-100-vp.png). |
| 14 | Cross-route coherence | **4.** One review component for every route. | **4.** Routes link to each other explicitly ("Caminho anterior: …"). | **4.** One review, one sheet model. |
| 15 | Feasibility | **5.** `ROUTE_STEPS` unchanged, no product decision. | **3.** Needs PD-1. Resume only on the landing conflicts with P054 "The generic landing appears once". | **4.** No product decision. The chooser has to create a Recommend entry state that already holds `desiredResult`, which is a small `program-entry.js` addition. The hybrid grouping maps onto `ROUTE_STEPS`. |
| 16 | Improvement over PR #256 | **4.** Result and preview are merged, correction happens in place, and the "Prioriza Equilibrar…" bug is gone (compare the baseline `onboarding-recommend/result__phone-390-light-pt.png`). | **4.** Same gains, plus deferred choice. | **4.** Same gains, plus the cheapest path. |
| 17 | Validation value | **3.** The control that measures the spec's cost. | **4.** Tests PD-1 directly. | **4.** Tests "cheaper choice without a policy change", the most transferable hypothesis. |
| 18 | Spec compliance | **Pass.** I found no settled or rejected item violated (details in §4). | **Fail (local).** R-5 / C-7: unconfirmed whole-draft destruction (`e.js:784`). SC import-mode semantics (`e.js:579`). D-13 / P054 AD: Build and Import not grouped (`hub-existing`, `route-choice`). | **Fail (local).** R-5 / C-7 (`f.js:834`). C-6 / K-10 spirit: raw key visible (`import-source`, all `ff-*` checkpoints, per `smoke.mjs`). L-3 on `custom-result`. |
| 19 | Visible divergence | **Pass.** It takes every §9 default. | **Pass.** O-1, O-2, O-3, O-5, O-6, O-9 and O-10 are all visibly different on screen. | **Partial.** O-1, O-3, O-5, O-7, O-8 and O-10 are visible. O-11's third door is visible but does not work. |
| 20 | Product-decision declaration | **Pass** (none). | **Partial.** PD-1 is declared in the header (`e.js:12-29`), in `policy.productDecisions` and in the manifest. The declaration leaves out two Plan 054 departures: Build and Import ungrouped, and resume only on the landing. | **Pass** (none declared, and none needed). The landing proof is shown cropped (O-8); because Plan 054 gates the visual on the owner, the owner should confirm the crop. |

---

## 2. Scenario-by-scenario verdicts (strongest treatment)

| # | Scenario | Strongest | Why |
|---|---|---|---|
| 1 | Brand-new user (`landing`) | **F** | Proof and both actions share the first viewport, and F's own lede states the loop in one sentence (S/f__landing__pt-light-390-100-vp.png). D is equally correct with ink chrome; E adds a true count caption, "Sete perguntas curtas". |
| 2 | Uncertain route (`route-choice`, `route-help`) | **F** | The first decision is the goal, with no chooser tax and no product decision. The helper ends at all five jobs (K-19 pass). E makes the same move only under PD-1 and miscounts Browse. |
| 3 | Recommend (`rec-*`) | **F** | 13 taps, 4 sections, and missing answers named in the disabled reason (S/fR__s1.png). D asks the same questions in 15 taps. |
| 4 | Correction | **E** | The statement and the underlined changed answer stay in view at 390 and at 320/200 (`chg.mjs`, S/eC__after.png). F is in view at 390 only. D is off screen at both sizes. |
| 5 | Pain avoidance | **E** | "Não estava no programa, então nada foi trocado." is the most exact truth. All three block Apply until a reason is chosen and show the production pain note (`rec-avoid-pain` texts). |
| 6 | Browse | **F** | One filter screen and 5 taps to the list (`fB` run). E's route from the review carries the answers, but its direct entry takes three screens under a "2 perguntas" label. |
| 7 | Custom | **D** | The only custom review whose first viewport shows the week (S/M__custom-result__pt-light-390-100-vp.png). In E and F the answers crowd it out. |
| 8 | Build | **Tie D/E** | The editor is shared. From the import route, D's and E's quiet links work (`dI`, `eI`). F's third door is dead. |
| 9 | Free-form / import | **D** | The only candidate that never discards a paste session without asking (`dS` run, `d.js:564`, `d.js:709`). |
| 10 | Shared (`shared-gate`, `shared-preview`) | **F** | Day breakdown on the gate, and "Agora não" returns to the generic landing with nothing active and no draft (`fG` run: `{"active":false,"draft":null}`). Whether a decline belongs there at all is O-7 taste. |
| 11 | Invalid link | **Tie** | Same fail-closed copy and live reason in all three (`shared-invalid` texts). |
| 12 | Existing program | **D** | Chooser with the active notice, and a kept draft can be resumed from it (`d.js:406-412`). E orphans a kept draft (`eK` run, `e.js:642-652`). |
| 13 | Recovery (`resume`, `rules-changed`, `cancel-confirm`) | **D ≈ F** | Both put resume where a returning user will land: D on the chooser, F on the landing and the chooser. E's landing-only card is unreachable once a program is active. |
| 14 | Activation | **Tie** | Shared Today with the localized name and toast (`activated-today` texts, identical). |

---

## 3. Biggest strength and biggest weakness

- **D.** *Strength:* the only candidate with no correctness defect I could find. `smoke.mjs` over
  all 45 checkpoints was clean, it preserves paste-door work, and resume is reachable for everyone.
  *Weakness:* the spec defaults, put together, hide the consequence of a correction. The "Montado
  com" list sits after the week and focus returns to it, so the change statement is scrolled away
  at every size (`chg.mjs`).
- **E.** *Strength:* the best correction and route-switch mechanics. Changes are visible in place,
  switches are explicit and Back restores exactly (`eSw` run). *Weakness:* it depends on PD-1 and
  still costs more taps than F (16 against 13). On top of that come a silent data-loss control
  (`e.js:784`) and a resume card that existing users never see (`e.js:642-652`).
- **F.** *Strength:* the cheapest path to a trainable program without any product decision, and a
  review whose first viewport is the program (S/fR__review.png). *Weakness:* its own divergent
  import surface is broken. The third door is dead and shows a raw key (`f.js:644`/`f.js:799`), and
  any door tap wipes the paste session (`f.js:834`).

---

## 4. Correctness and product-truth defects

| ID | Candidate | Defect | Evidence | Rule broken |
|---|---|---|---|---|
| CH-1 | **E, F** | A tap on an import-mode control wipes the whole paste-door session (pasted text, AI reply, gap answers) with no confirmation. This includes a tap on the tab or door that is **already active**. | `e.js:784`, `f.js:834` (`S.ff = TS.freeform.create()`). Runs `eS3`, `eS4`, `fS3`, `fS4`: `ff-gaps` or `ff-reply` becomes `ff-empty` with "0 de 12.000". S/eS3__before.png against S/eS3__after.png. | R-5, C-7. SC "Entry hub import doors" says the file path keeps its confirmation before discarding staged freeform work. Acceptance K-7 tests only "Recomeçar". |
| CH-2 | **F** | The O-11 third door "Escrever do zero" does nothing. The header shows the raw key "entry.route.undefined" and `entry()` is null. It is broken from `import-source` and from every `ff-*` stage. | `f.js:644` builds `data-act="route" data-mode="build"` without `data-route`; `f.js:799` reads `d.route`. Runs `fI`, `fI2`, `fI3`; S/fI2__after.png; `smoke.mjs` lists 8 checkpoints. | C-6 and K-10 in spirit (a raw key is visible, but not in snake_case, so K-10 misses it). P048 #18: "Every feature-looking control works." |
| CH-3 | **E** | Resume and rules-changed exist only on the landing. With an active program the landing never renders, so a draft kept by an existing lifter has no surface. In production the landing is also shown only once. | `e.js:642-652` (only caller is `landingView`); `e.js:206` sets view `today` when a program is active. Run `eK`: draft `resumable`, recommend/background, and Today only. | D-55 (resume names and returns); P054 AD "The generic landing appears once"; N-4 interaction. |
| CH-4 | **E** | The Browse row promises "2 perguntas" and asks three separate question screens. | `e.js:71` (`{n}` = 2 `ROUTE_STEPS` sections). Run `eB`: days, then minutes, then environment. | C-8 (honest counts). |
| CH-5 | **F** | The answer chip says "Quase todas as sessões" (almost all) for the answer "Completei a maioria…" (most). EN says "Most sessions". | `f.js:135` against `f.js:261`. | C-9 "Name the fact"; EN/PT meaning parity (§5.1). |
| CH-6 | **E** | "Suas respostas vieram junto" appears after Import → Build, where nothing was carried. | Run `eI`. | C-9. |
| CH-7 | **F** | `custom-result` first viewport: 10 chips and the change block push the weekly structure below the fold. | S/M__custom-result__pt-light-390-100-vp.png (K-22 checks only `rec-result`). | L-3, D-26. |
| CH-8 | **D** | Not a rule break, but a usability-truth gap: after "Atualizar programa" the only visible sign of the recompile is off screen at every size. | `d.js:479-482` places the statement; `d.js:636` focuses the opener. `chg.mjs`: top −401 at 390, −2836 at 320/200; S/dC__after.png. | O-5 default combined with the O-3 default. A-3 is satisfied, but a sighted user sees nothing change. |

Nothing fakes an engine output. The compile results in all three matched `TF.compile`: 18/49 for
Rafael, 15/42 after the correction, 22 exercises at 4 days (my runs; `entry()` n). No candidate
activates without answers (K-18 passes for all three).

---

## 5. Accessibility and responsive defects

- **E, `import-source` and `ff-*`, every cell:** `aria-pressed` on the paste/file switches
  (`e.js:579`). The SC names this pattern as wrong for subview switches.
- **F, `import-source`:** a current-door check mark plus `aria-current="true"` (`f.js:644`).
  This is a milder deviation from the SC "no selected state" rule for import doors.
- **F, 320/200:** after a sheet apply the before/after block is 606 px above the viewport
  (`chg.mjs`). The polite status is still announced, but a sighted user at 200% text sees only
  chips.
- **D, 390 and 320/200:** the same visibility problem after any sheet apply (CH-8).
- **E, `rec-result`, 390 PT light:** the first day heading sits at the fold. K-22 passes, but only
  just (S/eR__review.png).
- **All three, 320/200:** no horizontal overflow, no mid-word breaks, and a pinned share of 20–23%
  (`meas.mjs`; S/M__rec-result__pt-light-320-200-full.png, S/M__rec-schedule__pt-light-320-200-vp.png).
  Dark theme is at parity for all three (S/M__rec-result-corrected__pt-dark-390-100-vp.png,
  S/M__rec-env-correction__pt-dark-390-100-vp.png). Reduced motion passes K-21 in every cell
  (summary).
- **Targets:** no control under 44 px on `rec-result` in any candidate at 390/100 or 320/200
  (`meas.mjs`).

---

## 6. Implementation conflicts and hidden product decisions

- **E, PD-1:** declared in three places. Two consequences are missing from the declaration.
  (a) Plan 054 AD "Build/Import group as Bring or build my own" is dropped: they are separate rows
  (S/e__route-choice…). (b) With the resume card only on the landing, the production rule that the
  landing appears once leaves drafts unreachable (CH-3). The declaration is **incomplete**.
- **E, O-6** (routes from the review) is allowed only if the chooser offers the routes up front
  (N-8). Under PD-1 the "chooser" is the first question's list, so O-6 in E depends on PD-1 being
  accepted.
- **F:** no PD dependency, and I agree. Implementing it means starting a Recommend entry from the
  chooser with `desiredResult` pre-filled, and mapping 4 display sections onto 5 `ROUTE_STEPS`
  (`entry().step` is `desired_result` or `background`). Both are UI-layer work. The cropped landing
  proof needs the owner's visual gate (P054 "Mandatory visual approval gate").
- **D:** none. Its choice to enable Continue and validate on tap (notes deviation 2) follows the
  production pattern and passes K-18.
- **All:** PD-5 (catalog fixes) applies equally. The shared cancel dialog's "Guardar rascunho e
  sair" is production copy in every candidate.

---

## 7. Comparison against PR #256

| Area | D | E | F |
|---|---|---|---|
| Landing | Equal (same composition, same strings) | Equal, plus a count caption | Better: proof and actions together, clearer lede |
| Chooser | Better: facts per door, and a helper that reaches all five jobs (the baseline hub has none, `onboarding-start/hub`) | Different, under PD-1: no chooser page | Better: the goal is answered on the chooser |
| Result and preview | Better: merged, no "Revisar este programa" hop (baseline `onboarding-recommend/result`), "Objetivo:" fix | Better | Better |
| Correction | Better: in place, but the statement is not visible | Better: in place and visible | Better: in place, visible at 390 |
| Import | Equal to better (shared widgets, Build link works) | **Worse** on paste-session safety (CH-1) | **Worse** (CH-1, CH-2) |
| Recovery | Better (resume names route, step and date) | Worse for existing users (CH-3) | Better |

---

## 8. Nature of the remaining differences

**D against F**
- Activation cost, 15 against 13 taps, with the first decision being a route or a goal:
  **usability, on evidence.** F saves the chooser tap and one grouping tap with no policy change.
- Change-statement visibility after a correction: **usability, on evidence** (`chg.mjs`). F wins
  at 390, and both lose at 320/200.
- Import integrity (CH-1, CH-2): **correctness.** D wins. Both F defects are local one-line fixes.
- Custom first viewport (CH-7): **accessibility / L-3.** D wins.
- Chips against a "Montado com" list, and a before/after block against a status line:
  **taste**, once visibility is fixed.
- Gate decline (O-7) and a third import door against a quiet link (O-11): **taste / product
  policy**, once the door works.

**D against E**
- PD-1 against a chooser: **product policy.** No user evidence exists either way (spec §10).
- CH-1 and CH-3: **correctness / product truth.** D wins.
- One question per screen against sections: **taste**, with a measured cost of +1 tap for E.
- Inline editing against sheets: **taste.** Both satisfy L-2 and A-3.

**E against F**
- Both lower the route-choice cost. F does it in 13 taps with no policy change; E needs PD-1 and
  16 taps. That is **usability plus product policy**, and F is ahead on both.
- Correction feedback: E is visible at 320/200 and F is not. **Usability, on evidence.** E wins.
- Both share CH-1. E's CH-3 and F's CH-2 are **correctness.** Each is local.

**Best two: F and D.** As frozen, D is better on correctness: F ships a dead door and a
data-loss control. Those defects are local and fixable without changing F's design. What remains
after fixing them is **not mainly taste**. F is better on evidence for activation cost (−2 taps,
no product decision) and for correction feedback at 390. D is better on evidence for the Custom
first viewport. The only choices that come down to taste or policy are chips against a list, the
gate decline, and third door against link.

---

## 9. Final recommendation

**An explicit synthesis on F's architecture. Neither F nor D ships as frozen.**

1. **From F:** the chooser whose featured Recommend block is the goal question; the hybrid grouping
   (goal and background, then schedule, environment, optional priorities); answer chips placed
   before the week on the review; the before/after count. These carry the measured activation and
   feedback gains without a product decision.
2. **From D:** import-mode behaviour. Never reset the paste session on a mode switch; hide the
   switches during gap repair (`d.js:564`, `d.js:709`); switch to file only with the confirmation
   the SC requires. Also D's ink header navigation and Privacy link (SM-5), and D's Custom review,
   where the program comes first and the choices sit after the week (fixes CH-7).
3. **From E:** after an apply, move focus and scroll to the change statement (or a changed row),
   not to the opener, so the consequence is visible at 320/200 as well (fixes CH-8 for D and F's
   200% case). Optionally, E's "novo" row marker.
4. **F-specific fixes:** give the third door `data-route="build"`, or take D's quiet link (O-11
   stays taste); make the consistency chip say "A maioria das sessões"; replace "guardada/guardar"
   with "salva/salvar".

**If PD-1 is approved:** my recommendation does not change. F already moves the first decision
onto the goal without PD-1, at 3 fewer taps than E. E's extra value (routes from the review, with
exact restore) is O-6. The owner can add it to the synthesis if wanted, and it needs PD-1 only
because it replaces the up-front list. E as a whole should not be picked: CH-1 and CH-3 are real,
and its review is the most crowded.

**If the owner wants a candidate that ships with no fixes at all:** D is the only one with no
correctness defect, and it is safe to ship. It has one known usability gap, the change statement
that is scrolled out of view.

---

## 10. Citations index

- Spec: `round-1/synthesis-spec.md` §2 rows 9, 11, 13, 32; §3 L-3, N-4, N-8; §4.1 C-6 to C-9;
  §7 SM-5; §8 R-5; §9 O-3, O-5 to O-11; §10 PD-1; §12.2 K-7, K-10, K-22.
- Product sources: Plan 054 Approved direction ("generic landing appears once"; "Build/Import
  group"; visual gate); Plan 048 locked decision #18; semantic contract at the PR #256 head
  (`docs/design/ui-system-semantic-contract.md` "Entry hub import doors", "Import-mode subview
  switches"); DESIGN.md "One Mark Rule".
- Candidate code: `d.js:406-412, 479-482, 564, 636, 709`; `e.js:71, 206, 579, 642-652, 784`;
  `f.js:69-72, 135, 261, 644, 720, 735, 799, 834`; `base.css:90`.
- Acceptance: `round-2/acceptance/summary.md` (all pass; K-24 taps D 15, E 16, F 13).
- My runs (scripts in the scratch directory): `dR`, `eR`, `fR` (Recommend walks); `dC`, `eC`,
  `fC` (environment correction); `chg.mjs` (statement position); `eSw` (E route switch and
  restore); `eB`, `fB`, `dB` (Browse); `fG` (F decline); `eK` (E orphaned draft); `fI`, `fI2`,
  `fI3`, `dI`, `eI` (Build from import); `dS`, `eS3`, `eS4`, `fS3`, `fS4` (paste-session wipe);
  `dK`, `eK2`, `fK` (focus and Escape); `dV` (D validation); `meas.mjs`, `words.mjs`,
  `smoke.mjs` (results: D 0 issues, E 0, F 8).
- Screenshots in S/ as named above. The PR #256 baseline is in the scratch `pr256` checkout at
  `docs/ui-screens/screens/onboarding-{start,recommend}/`.
