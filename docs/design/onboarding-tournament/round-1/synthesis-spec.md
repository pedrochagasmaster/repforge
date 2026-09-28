# Round 1 synthesis — Round 2 specification

Normative input for the Round 2 generator. Items are marked exactly one of
**settled** (fixed for every Round 2 candidate), **rejected** (excluded),
**open** (to be explored; D takes the stated default), or **requires product
decision** (a candidate may depend on it only if it flags the dependency in its
header comment and in `round-2/manifest.md`; D never depends on one).

- Artifact synthesized: freeze commit `9cf45d1a6fed93e4669cebff396d91cd58e6c0cb`
  (artifact `31a37b97`), branch `ccr-15c50ac8-pki40i`. Paths below are relative
  to `docs/design/onboarding-tournament/` unless they start with `plans/`,
  `docs/` or a repository-root file name.
- Redesign baseline: PR #256 head `f61ce44b`. "Baseline" means that head:
  its `app.js`, `index.html`, `test/i18n.mjs` and its captures under
  `docs/ui-screens/screens/onboarding-*` (the copies on this branch can
  differ; use the PR #256 head).
- Inputs weighed: both Round 1 judge reports, the three candidates and shared
  code, the acceptance run, the product sources, and my own browser runs
  (Playwright, Chromium 1194, 390×844 DPR 2 unless noted, `pt-BR`). My own
  observations are cited as **[S-n]** and listed in §11.4. Judge reports are
  not needed to use this document.
- Nothing here is chosen by vote or score. Where the judges disagreed, the
  decision cites the artifact or a product source, and names which judge the
  evidence supports.

Evidence shorthand: `a.js:380` = `candidates/a.js` line 380; `ss.js` =
`candidates/shared-screens.js`; `pe.js` = `vendor/program-entry.js`;
`P048 #7` = Plan 048 locked decision 7; `P054 AD` / `P054 NG` = Plan 054
Approved direction / Non-goals; `SC` = the Plan 058 semantic contract
(`docs/design/ui-system-semantic-contract.md` at the baseline; it is not on
this branch, read it from the PR #256 head).

---

## 1. Chosen base system

**Decision: an explicit synthesis. The base is B's information architecture
and state machine; A's "the result is the review" is grafted onto B's result;
C contributes only the idea of stating what a rebuild changed, recomputed
correctly. Status: settled.**

### 1.1 What is taken from each candidate

| From | Taken | Status |
| --- | --- | --- |
| B | Landing with two early actions (with the secondary action's destination corrected to the import route, D-12); the five-job chooser (Recommend featured, Custom as its deliberate alternative, Browse separate, Build and Import grouped under one disclosure); `ROUTE_STEPS` used unchanged (`b.js:161`, `pe.js:56-80`); sections with a visible section counter and an answer rail; a distinct Custom route with its own questions and provenance; Browse with its own two-question context and cards that lead with days, minutes, exercise and set ranges, progression and equipment; proactive exercise avoidance with a required reason; result that leads with the program and cites every reason; "What Taurifer adjusted" and "Your constraints" blocks; resume card that names route and step and returns to that step; working Cancel on every view. | settled |
| A | Answers shown on the result as editable facts; editing one opens a local editor (sheet or inline) and recompiles in place, without discarding the result or re-walking later sections (`a.js:313-325`, `a.js:399`); per-row "keep this exercise out" as a *complement* to proactive avoidance; Shared preview Cancel returns to the gate (`a.js:394`). | settled |
| C | A line after every recompile that states what changed, computed by exercise identity, never by position. | settled (idea only) |

### 1.2 Why B's architecture and not A's or C's

1. **Only B runs on the product's locked policy without a product decision.**
   A merges Recommend, Custom and Browse behind one guided path
   (`a.js:7-12`), which P054 NG forbids ("No merging Recommend and Custom,
   hiding expert controls") and which contradicts P054 AD ("Start training
   opens the five-job chooser"). A also assumes session length and rest
   (`a.js:207` `DEFAULTS`), which P048 #7 says must be asked. C compiles and
   lets the lifter activate a program built from defaults with zero facts
   confirmed (`c.js:185`, `c.js:261`), contradicting P048 #3, #5, #6 and
   PRODUCT.md principle 1. B declares no policy change, and its code confirms
   it (`b.js:161`, `b.js:175`).
2. **A's efficiency lead is mostly product-policy, not design.** Both judges
   measured Rafael at 11 taps to Today on A and 15 on B. Decomposed from the
   code: 2 taps are the assumed minutes and rest (A never asks them;
   B `b.js:293-297`), 1 tap is the chooser A skips, 1 tap is B's
   "Continue" on the optional priorities section (A folds priorities into the
   result). Only the last is available without a product decision, and it is
   left open (§9 O-2). The rest of A's advantage is the in-place correction
   model, which this synthesis adopts.
3. **B's defects are local; A's and C's are structural.** Verified in the
   browser **[S-2]**: B's Cancel opens the keep/discard dialog on every view,
   while A and C show no dialog on `import-source`, `import-review` and
   `build-setup`. C activates the stale default "Build Muscle" (18 exercises)
   when the lifter finishes Build **[S-3]**. A gives an existing user no
   chooser (`a.js:488`, **[S-5]**). B's defects (unconfirmed Start over,
   duplicated pinned footer, broken segment grid, one wrong Back target) are
   each one-rule fixes (§4).

### 1.3 Where the judges disagreed on the base, and who was right

- Judge Alpha recommended B as the base with A's result-as-review grafted in.
  Judge Bravo recommended A as the direction with B's reasons, captions,
  constraints list, resume card and 200% stacking grafted in, and asked for
  owner sign-off on the Plan 054 breach and on minutes and rest.
- **On the base, the evidence supports Alpha.** Bravo's own synthesis requires
  restoring Plan 054's separation of Custom and Browse (Bravo §8 item 2) and
  sign-off on minutes and rest (item 4). With those applied, A's structure
  reduces to B's chooser and sections plus A's result model, which is this
  synthesis. Bravo's grafts from B are all adopted.
- **On what matters most to the lifter, Bravo was right** that the route
  decision and the result are where attention is spent. The correction model
  (A) and the chooser's cost (open, §9) are where Round 2 must diverge.
- Both judges rejected C. The rejection stands on verified defects
  (§4.3, §8), not on taste.

### 1.4 Product truth versus prototype truth

Nothing below is canonical because a prototype did it. In particular: the
simulated device store, the Today screen and the shared editor are harness
stand-ins (README "What is real"); fixing their defects (§4.4) is a harness
task, not a design choice; and the compile outputs quoted here come from the
real vendored compiler.

---

## 2. Per-checkpoint decisions (all 45)

Every Round 2 candidate reaches all 45 checkpoints of `TF.CHECKPOINTS`
(`runtime.js:352-398`) with the same seeds and fixtures, marking the element
that represents each state with `data-checkpoint`. "D default" names what the
control candidate does. The Status column gives the checkpoint decision's one
status; an "Open aspect" inside a row is a separate item with its own status
in §9. Decision IDs refer to §11.

| # | Checkpoint | Decision | Status |
| --- | --- | --- | --- |
| 1 | `landing` | Generic first-run landing with exactly two early actions: `#firstRunCreate` (accent-filled primary, opens the five-job chooser) and `#firstRunImport` (bordered quiet-navigation, opens the import route on the paste door). Headline and lede state the loop: a program, logged sets, the next target (P054 AD). The owner-selected product-loop proof is shown (vendored `today-ready-*` capture and/or the `landing.proof.*` facts, §4.4 H-8); both actions stay in the first viewport at 390×844. Privacy link opens the harness Privacy stub. No theme words, no counts of users. D default: production strings `landing.headline`, `landing.body`, `landing.build`, `landing.track`. (D-10, D-11, D-12) Open aspect: composition (O-8). | settled |
| 2 | `route-choice` | The five-job chooser. Recommend is the featured primary (`.entry-card--primary` accent outline, SC "Permitted contextual variants"). Custom is the deliberate generated alternative; Browse is separate; Build and Import sit under one "Usar meu próprio programa" disclosure, Import with a paste door and a file door. Each door may state what the lifter does and gets, as facts only: section counts from `ROUTE_STEPS`, never minutes or popularity. Recommend and Custom must have different outcome lines. (D-13 to D-17) Open aspect: presentation (O-4). A chooser-less entry is PD-1. | settled |
| 3 | `route-help` | A help affordance on the chooser that can end at any of the five jobs, including Browse, without claims about other users. It routes; it does not replace the chooser. D default: B's two-question helper plus a third answer path to Browse ("Quero escolher entre programas prontos" / "I'd rather pick a ready-made program"). (D-18) Open aspect: form (O-4). | settled |
| 4 | `rec-goal` | Three plain choices exactly (P048 #4). Required. | settled |
| 5 | `rec-background` | Structured-program experience (4 ranges) and six-week consistency (4 behaviour choices), both required (P048 #5, #6). A lede may say how they affect the first weeks. D default: one section with both groups (B). Open aspect: grouping (O-1). | settled |
| 6 | `rec-schedule` | Days (2–6), session ceiling (30/45/60/75/90+), preferred rest with "Deixar o Taurifer escolher". All three asked and required (P048 #7, `pe.js:1397-1403`). Nothing preselected in D. Day and minute options render as a 3+2 grid of number-plus-unit cards like the baseline capture (`onboarding-recommend/schedule`), never a five-column row with a radio mark inside each cell. Time is described as a ceiling. (D-20, D-21, D-22, D-60) Preselecting or assuming minutes or rest is PD-2 / PD-3. | settled |
| 7 | `rec-environment` | Five shortcuts; the material-capability correction is a disclosure on the same step (shared `TS.environmentCorrection`). | settled |
| 8 | `rec-priorities` | Optional section, labelled optional once. "Nenhuma prioridade especial" is the default state; up to two muscles; optional movement priorities; a proactive avoid search where selecting an exercise requires one reason before the lifter can continue, and pain shows the production `entry.priorities.pain_note` verbatim. (D-23, D-24) Open aspect: placement before or after the first result (O-2). | settled |
| 9 | `rec-result` | The result is the review (common editable preview, P054 AD "merge result and preview"). First viewport at 390×844: program name, one facts line (days, duration range, exercises, sets) and the start of the weekly structure. Below: every day; the answers it was built from, each editable in place with an immediate recompile and no re-walk; full reasons (goal, schedule, main constraint, equipment, priorities, progression, first-week reductions, limitations; P048 #13); determinism line allowed (P048 #11). One pinned primary "Usar este programa". Secondary: edit before using; "Começar de novo" only behind a confirmation. Close alternative rendered only when the compiler returns one (today it returns `null`, verified [S-1]). (D-25 to D-33) Open aspects: answer presentation (O-3, O-9), change-statement form (O-5). | settled |
| 10 | `rec-env-correction` | Correction disclosure open with limited home + dumbbells + band + safe pull. Reachable from the environment step and from the environment fact on the result. | settled |
| 11 | `rec-result-corrected` | Recompiled result shows what changed and why: environment reason, equipment reason, and an "O que o Taurifer ajustou" list in plain language (shared `x.limit.*`, never a raw code). A change statement after the recompile (D-31). | settled |
| 12 | `rec-avoid-pain` | Barbell bench press avoided *proactively* through search, reason "dor ou desconforto" required, production pain note shown. The fixture's bench press is not in Rafael's program even with a chest priority [S-1], so a row-only design cannot reach this state honestly. A per-row "keep out" on the result is an allowed complement. (D-24) | settled |
| 13 | `rec-result-avoided` | Result lists the constraint under "Suas restrições" with a Restore action, and states truthfully whether any exercise changed (here none did). Never imply a substitution that did not happen. No "substituto seguro". | settled |
| 14 | `browse-filters` | Browse's own lightweight context: days, minutes, environment, reusing any answers already given (P048 Browse). No rest question for Browse (`pe.js:1401`). | settled |
| 15 | `browse-list` | Cards for 4 days / 60 min / commercial gym lead with name, days, purpose, minutes range, exercise and set ranges, progression model and equipment (P054 AD). Fitting cards first; others in a disclosure with the mismatch stated. Card count comes from the catalogue, not a literal. | settled |
| 16 | `browse-preview` | Common review of "Muscle + Strength · 4 days" with a non-destructive Back to the list that keeps the filters. Start over only with confirmation. (D-34, D-35) | settled |
| 17 | `custom-priorities` | Per-muscle four-state emphasis (normal, prioritize, de-emphasize, ignore) with at most two prioritized; each muscle is a labelled 2×2 group (P054 AD, shared `TS.muscleEmphasis`). | settled |
| 18 | `custom-exercises` | Include bench press, avoid barbell curl for "não gosto". Search-result buttons carry the exercise in their accessible name; chosen items move to named Include/Avoid lists with Remove (SC "Exercise-preference selection"). | settled |
| 19 | `custom-shape` | At most two compatible structures, default preselected; with one structure, say that only one fits these answers. | settled |
| 20 | `custom-result` | Same result surface as Recommend, with Custom provenance and a Custom title; "change" actions name the input they change and recompile predictably (P048 Custom). | settled |
| 21 | `build-setup` | Name and day count. Cancel opens the keep/discard dialog. | settled |
| 22 | `build-empty` | Empty day containers; activation disabled with an adjacent neutral reason naming the empty days (not danger colour before an attempt). | settled |
| 23 | `build-partial` | One day filled; the reason names the days still empty. | settled |
| 24 | `build-ready` | Activation enabled only when `TF.readiness` passes for the built program as the candidate result. Activation commits exactly the built program, and Today shows its name. Any failure is rendered in words next to the action. (D-40, H-4) | settled |
| 25 | `ff-empty` | Shared stage 1 (paste), privacy disclosure above the action, Continue disabled until text is present. | settled |
| 26 | `ff-filled` | Pasted fixture; character count; Continue enabled. | settled |
| 27 | `ff-handoff` | ChatGPT and Claude links, prompt preview and "Copiar o comando" (ADR 0014). | settled |
| 28 | `ff-reply` | Import from clipboard (on request only) and manual reply field; "Recomeçar" requires confirmation (production `entry.freeform.confirm_start_over`, H-6). | settled |
| 29 | `ff-gaps` | Gap repair for reps (Cable flyes) and sets (Lat pulldown); not-imported notice. | settled |
| 30 | `ff-gaps-invalid` | Empty and invalid values ("12-10", "abc") flagged per field with an adjacent error and a summary; focus moves to the summary. | settled |
| 31 | `ff-unreadable` | Unreadable notice with "copy repair prompt" and "try another"; nothing imported. | settled |
| 32 | `import-source` | File door and paste door; when entered from the landing's second action the paste door is the default subview (baseline `app.js` `openFirstRunImport`). Cancel works. A visible way to Build from here. (D-12) Open aspect: how Build is offered (O-11). | settled |
| 33 | `import-review` | Shared import review (exact, likely with shortlist, unmatched). Commit disabled with the count of rows to review. Cancel works. | settled |
| 34 | `import-preview` | Common review with the manual-progression explanation; Back to import review keeps row decisions; activation reaches Today once H-1 is fixed. | settled |
| 35 | `shared-gate` | Adaptive landing: "Programa recebido" eyebrow, headline, one `#firstRunSharedStart` action captioned with `setup.shared.cap_one/cap_many` (name and day count, ADR 0007), what arrives with the link and that nothing is saved until Start. Nothing persists before Start. (D-50) Open aspect: a decline action (O-7). | settled |
| 36 | `shared-preview` | Common review of the coach's program. Cancel/Back returns to the gate. No unconfirmed destructive action; a Start over, if offered, confirms and names that the received program is dropped. | settled |
| 37 | `shared-invalid` | Fail-closed headline and body, the specific reason as a live status, and the two generic landing actions. Does not consume "landing seen". | settled |
| 38 | `hub-existing` | The same chooser, with the persistent notice that the current program stays active until a replacement is confirmed (P048 Existing users). Every exit (Back, Cancel, Keep, Discard) returns to the configured app (Today), never to the first-run landing. (D-45) | settled |
| 39 | `replace-confirm` | Dialog naming the current program, the next program and the logged-session count that stays in History; cancel keeps the current one. A dialog instead of `window.confirm` is a UI change with no policy effect. | settled |
| 40 | `activation-conflict` | Activation blocked with the conflict notice; exactly one persistent-action region; "Revisar de novo" refreshes the revision and returns to the review, then the replacement dialog runs again. | settled |
| 41 | `resume` | Card naming the route, the step and the saved date; Continue returns to that exact step with answers intact; Start over discards the saved draft. Open aspect: placement (O-10). | settled |
| 42 | `rules-changed` | Notice: Rebuild for generated routes; Keep for import/shared when readiness allows. | settled |
| 43 | `cancel-confirm` | Keep draft and leave (the draft really is kept and resumable, H-9), Discard draft and leave, Continue. Reachable from every non-landing view of every route. | settled |
| 44 | `activate` | The review with its activation action; label follows the consequence: "Usar este programa" first run, "Arquivar o programa atual e usar este" with an active program (P048 Common preview). | settled |
| 45 | `activated-today` | Today with the localized program name and first session, and a one-sentence toast. | settled |

---

## 3. Cross-cutting navigation and layout rules

All settled unless marked. Each cites its evidence in §11.

### 3.1 Navigation

- **N-1 Entry order.** Landing → (primary) five-job chooser → route steps →
  review → activation → Today. Landing → (secondary) import route, paste door
  first, file door and chooser one tap away. A valid shared link → adaptive
  landing → review; it never opens the chooser (P054 AD, ADR 0007).
- **N-2 Every view has a way back that loses nothing.** A step's Back returns
  to the previous step with answers intact (P048 a11y "Back preserves
  answers"). A review reached from a list, a gate, an import review or a
  result has a Back to exactly that place, with its state (filters, row
  decisions, answers). In Round 1 no candidate had a Back from the Browse
  preview, and B's Shared and Browse previews offered only Cancel, Edit and an
  unconfirmed Start over [S-4].
- **N-3 Cancel is a question, never a silent exit.** From any setup view other
  than the landing, Cancel opens the shared keep/discard/continue dialog
  (`TS.cancelSheet`). A shared review's Cancel returns to the gate instead.
  Verified failures to avoid: A and C render no dialog on `import-source`,
  `import-review`, `build-setup` [S-2].
- **N-4 Configured state never reopens the first-run landing.** With an active
  program, every exit from setup lands in the configured app (Today). Two
  Round 1 violations: A's "bring your own" sets `view = "landing"`
  (`a.js:380`); B's chooser "Voltar" sets `view = "landing"` (`b.js:416`),
  verified with an active program to render "Saiba o que fazer na academia
  hoje." [S-5]. Brand guide "First-run modes": configured state does not
  reopen the gate.
- **N-5 Correction without re-walking.** Changing one answer from the review
  recompiles in place and stays on the review. Jumping back into the section
  flow is allowed only when the lifter asks for it, and must not discard the
  current result until a new one replaces it. B's `jumpTo` clears the result
  and forces re-traversal (`b.js:199`); A's fact sheet recompiles in place in
  3 taps (`a.js:399`).
- **N-6 Keep means keep.** "Guardar rascunho e sair" persists the draft to the
  simulated store and makes it resumable (H-9); C's handler discarded it
  (`c.js:378`).
- **N-7 Routes switch explicitly.** Choosing a different job never silently
  changes the current route or provenance. A switched Recommend to Custom
  when a sheet opened (`a.js:398`).
- **N-8 Reaching a route from the review is allowed** (for example "See
  ready-made programs for 4 days" from a Recommend result) as long as the
  chooser also offers it up front and the move is stated. Open (O-6).

### 3.2 Layout

- **L-1 One persistent-action region per screen.** It holds the primary action
  and at most one row of secondaries at 100% text. At 200% text or at 320 px,
  only the primary stays pinned; secondaries move into the flow, stacked full
  width. Measured Round 1 pinned share at 200%: 36–49% of the viewport at
  390×844 and 69–71% at 320×568 for all three candidates [S-6]. Limit: the
  pinned region never exceeds one third of the viewport height in any matrix
  cell.
- **L-2 Nothing interactive renders under the pinned region.** Editors,
  panels and sheets open where they are visible, or scroll their confirm
  control into view above the pinned edge. C's fact editor confirm rendered at
  779–827 px under a pin starting at 693 px at 390×844, and at 850 px (off
  screen) under a pin starting at 417 px at 320×568 [S-9]. A's last Q4
  option (bottom 780 px) opened under its pinned footer (top 746 px) [S-9].
- **L-3 Program before chrome on the review.** First viewport at 390×844
  shows the program name, the facts line and the start of the weekly
  structure. A's review spent the first viewport on seven fact chips; the
  first exercise row sat at the fold [S-7].
- **L-4 Numeric options are cards, not squeezed segments.** Days and minutes
  use a 3+2 grid (baseline `onboarding-recommend/schedule` capture); the
  value and unit stay on one line each; no radio mark inside the cell. B's
  five-column grid (`b.css:15`) wrapped "30" to two lines at 390 and "90+" at
  430 [S-8].
- **L-5 No mid-word breaks in control labels.** Side-by-side secondaries must
  stack before any word breaks. Round 1 breaks at 390/200%: A "Levantamento",
  "Desenvolvimento", "diferente?", "exercícios"; B "Continuar" in the step
  footer; C "Trocar", "programa", "Editar", "exercícios" at 320/200% [S-6].
  The shared `.btn` and `.choice__title` rules use `overflow-wrap:anywhere`
  (`base.css:55`, `base.css:105`), which hides this instead of overflowing;
  see H-12.
- **L-6 Single column, flat content.** No nested bounded cards, no sidebars,
  no desktop layout (DESIGN.md "Don't").

---

## 4. Mandatory correctness fixes

### 4.1 Product-truth and engine rules for every Round 2 candidate (settled)

- **C-1 No activation without the lifter's answers.** A generated program is
  activatable only after every required answer of its route was given by the
  lifter, or (only under PD-2/PD-3) shown and acknowledged as an assumption.
  Evidence: a novice (first program, no recent training) compiles to 15
  exercises / 43 sets / `range`; the default C activated (6–24 months, most
  sessions) compiles to 18 / 49 / `range,rep_goal` [S-1]; C enabled
  activation at 0 of 7 facts confirmed [S-9]. PRODUCT.md principle 1; P048
  #3, #5, #6.
- **C-2 Activation commits exactly the reviewed candidate.** Including after
  Edit before using, and including Build. Round 1 failed three ways, all
  verified [S-3]: A and B's Build "Usar este programa" did nothing
  (`preview_not_ready`, never rendered); C's Build activated the stale default
  "Build Muscle" with 18 exercises; in all three, removing two exercises in
  the editor and activating from the editor activated the unedited 18. P054
  Architecture 4 ("Activation must commit the exact candidate the user
  reviewed").
- **C-3 Editing never rewrites the engine's conclusions.** Opening the editor
  and returning with no change must leave every exercise's progression,
  prescription and reasons untouched. Round 1 rewrote `range,rep_goal` to
  `range` in all three and then threw on activation [S-3] (H-2). PRODUCT.md
  principle 1.
- **C-4 Reasons cite what the engine used.** The review cites desired result,
  current state, schedule and the main constraint (P048 #13), plus equipment,
  priorities, progression and any reductions/limitations when present. A
  filtered its reasons to goal and progression (`a.js:287`), so an
  environment correction was never explained.
- **C-5 Change statements are true.** After a recompile, say how many
  exercises changed by identity (added or removed library ids or slots), with
  the new total as denominator; `n ≤ total` always; say "no exercise changed"
  when none did. C counted by position (`c.js:197`): changing 3→4 days
  produced "Remontado: 21 de 22 exercícios mudaram." [S-9]; Bravo reported
  "18 de 12".
- **C-6 No raw engine codes in the interface.** Every activation, compile and
  limitation code maps to copy. Round 1 joined raw codes for display
  (`a.js:285`, `a.js:307`, `b.js:316`, `b.js:338`, `c.js:236`, `c.js:260`),
  and `TS.adjustments` falls back to the code (`ss.js:133-137`). H-10 adds the
  shared mapper.
- **C-7 Destructive actions confirm.** "Começar de novo" on any review,
  "Recomeçar" in the paste door, and "Descartar rascunho" ask first and name
  what is lost (SC Controls: destructive, "confirmation stays explicit"). B's
  "Começar de novo" cleared all answers in one tap on the Recommend, Browse
  and Shared reviews (`b.js:339`, `b.js:459`; [S-4]); the shared paste-door
  "Recomeçar" also discards without the production confirmation (H-6).
  Removing a single exercise or constraint inside a draft can be redone in
  place (add it back) and needs no dialog.
- **C-8 Honest counts and labels.** A promise of "four questions" must match
  what is asked (A asked five answers: `a.js:113` with `a.js:272`). A count of
  one uses singular agreement (C "0/7 confirmado", `c.js:253`).
- **C-9 No invented facts.** No time-to-complete estimates on doors
  (`ss.js:89-92`), no "A maioria começa por aqui" (`b.js:96`), no promise of a
  later step the product lacks (C "pode esperar até depois da primeira
  sessão", `c.js:105`), no "substituto seguro" (`a.js:162`; the production
  pain note says a compatible substitute and to stop any movement that hurts).
  PRODUCT.md "No users yet"; brand guide "Name the fact".
- **C-10 Close alternative only when real.** Render the alternative slot only
  when `compile().alternative` is non-null; it is `null` for every Round 1
  fixture [S-1]. Never derive one (P054 Entry routes).

### 4.2 ADR and brand rules (settled)

- **ADR 0007.** Nothing from a link persists before Start; the gate names the
  program and its day count; invalid links fail closed and say nothing was
  saved; a configured device never applies a payload.
- **ADR 0014.** The paste door's two assistant links stay inert until text is
  pasted; the privacy disclosure is on screen before the lifter sends
  anything; the clipboard is read only on request; the prompt is the reviewed
  `entry.freeform.prompt` string.
- **Brand.** Sentence case; no exclamation marks; no em dashes in app prose;
  no theme words; "você"; PT-BR words only (§5); positive colour only for PRs
  and completed targets (A used it for "Programa atualizado", `a.js:299`);
  danger only for destructive actions and validation failures.

### 4.3 Round 1 defects, classified

"Real" means reproduced by me or proven by the cited code. Harness defects are
shared and do not discriminate between candidates; they are fixed once in §4.4.

| ID | Claimed defect | Where | Verdict |
| --- | --- | --- | --- |
| X-1 | Import and paste-door activation throws `Invalid program-entry result` | all | Real, **harness** (H-1) [S-3] |
| X-2 | Edit then Back rewrites progression to `range`; activation then throws | all | Real, **harness** (H-2) [S-3] |
| X-3 | Activating from the editor drops the edits | all | Real; shared root cause (no shared "editor → candidate" helper), fixed as **harness** H-3 plus rule C-2 [S-3] |
| X-4 | Build "Usar este programa" does nothing after "Pronto para ativar." | A, B | Real, **candidate** wiring, made hard to repeat by H-4 [S-3] |
| X-5 | Build activates the default program instead of the built one | C | Real, **candidate** (structural to a result-always-exists design) [S-3] |
| X-6 | Today shows the English compiler name in PT ("Build Muscle") | all | Real, **harness** (H-5) [S-3] |
| X-7 | "Prioriza priorizar ganho de massa." and European Portuguese strings | all | Real, **harness/baseline copy** (H-7); present at PR #256 |
| X-8 | "aparelho" in PT copy | all (shared `x.cost.file`, `x.privacy.line`), A, C | Real; shared part **harness** (H-7), candidate strings `a.js:177`, `c.js:157` **candidate** |
| X-9 | Cancel renders no dialog on import-source, import-review, build-setup | A, C | Real, **candidate** [S-2] |
| X-10 | Existing user sent to the first-run landing | A (`a.js:380`); **also B** (`b.js:416`) | Real, **candidate**. The B instance was not reported by either judge [S-5] |
| X-11 | Existing user has no chooser | A (`a.js:488`) | Real, **candidate** [S-5] |
| X-12 | Unconfirmed "Começar de novo" | B | Real, **candidate** [S-4] |
| X-13 | Two pinned footers in the conflict state | B (`b.js:222`) | Real, **candidate** [S-6] |
| X-14 | Minute and day segments stack digits | B (`b.css:15` with `base.css:105`) | Real, **candidate** layout on a shared recipe [S-8] |
| X-15 | Door time estimates | B via shared `x.cost.*` | Real, **candidate** use of **harness** copy; H-11 removes the strings |
| X-16 | "A maioria começa por aqui" | B (`b.js:96`) | Real, **candidate**; not reported by either judge |
| X-17 | Helper never routes to Browse | B (`b.js:280`) | Real, **candidate** |
| X-18 | Recommend and Custom share one "Você recebe" line | B (`b.js:268-269`) | Real, **candidate** |
| X-19 | Correction from the result re-walks sections | B (`b.js:199`) | Real, **candidate** |
| X-20 | "Salvar rascunho" only shows a toast | B (`b.js:458`) | Real, but caused by the **harness** having no draft API (H-9) |
| X-21 | Reasons filtered to goal and progression | A (`a.js:287`) | Real, **candidate** (breaks P048 #13) |
| X-22 | Routes merged; minutes and rest assumed | A | Real, declared; product-policy (PD-1 to PD-3) |
| X-23 | Custom silently switches route | A (`a.js:398`) | Real, **candidate** |
| X-24 | Pain avoidance only reactive | A, C | Real; bench press is not in the program [S-1] |
| X-25 | Activation with 0/7 facts; keep-draft discards; positional diff; editors under the pin; 18 accent links; English "Close"; "OK" fallback | C | All real, **candidate** [S-9], `c.js:185`, `c.js:229`, `c.js:253`, `c.js:261`, `c.js:270`, `c.js:378` |
| X-26 | No Back from the Browse preview | all | Real, **candidate** [S-4] |
| X-27 | Pinned block takes most of the viewport at 200% | all | Real, **candidate** layout [S-6]; judges' figures (Alpha ~55–60%, Bravo 43–60%) bracket my 390 figures and understate 320 |
| X-28 | Mid-word breaks at 200% | A, C (buttons), B (footer), shared paste-door buttons | Real; candidate layout plus shared recipe (H-12) [S-6] |
| X-29 | Import metrics clip "personaliz…" at 200% | shared `TS.importReview.counts` | Real: "vinculados" and "personalizados" overflow their metric cells at 390/200% [S-11]; **harness** widget (H-13) |
| X-30 | Shared gate lacks a "not now" action required by Plan 054 | all | **Not upheld as a defect.** Plan 054's text has no such requirement; the brand guide specifies one Start action and the baseline gate capture (`onboarding-shared/gate`) has one. Left open (O-7) |
| X-31 | B's landing split is a pre-hub step Plan 054 did not specify | B | **Not upheld.** Two early landing actions are shipped product (brand guide "First-run modes"; baseline `index.html` `#firstRunCreate`, `#firstRunImport`). What B got wrong is the secondary action's destination: the baseline opens the import route on the paste door (`app.js` `openFirstRunImport`), B opens the chooser again (`b.js:402`). Fixed by D-12 |
| X-32 | Acceptance "clipped text" warnings on the reply label | all | False positive of `tools/verify.mjs` on a visually hidden label; **harness** (H-14) |
| X-33 | Privacy link inert | all | Real; harness has no Privacy surface (H-15) |

### 4.4 Harness defects: mandatory fixes before Round 2 generation

These are shared, do not discriminate between candidates, and must be fixed in
`runtime.js`, `candidates/shared-screens.js`, `base.css`, `vendor/`, or
`tools/verify.mjs` before any Round 2 candidate code is written. They land as
one separate harness commit that Round 2 builds on (made by whoever prepares
Round 2; if the generator does it, it is its first commit and touches no
candidate file). Round 1 stays reproducible at the freeze commit; its
candidates `candidates/{a,b,c}.*` and everything under `round-1/` are not
edited, and Round 1 acceptance is not re-run. Each fix must keep the
real/ported/simulated boundary in `README.md` true, and must give every
candidate the same helper (no candidate gets an easier version).

| ID | Fix | Evidence |
| --- | --- | --- |
| H-1 | `TF.importPreview` must emit JSON-clean results: no `undefined` fields (`libraryId`, `primary`, `secondary`, `min`, `max` for raw rows), so `Entry.setResult` accepts it. Import and paste-door activation must reach Today. | `runtime.js:181-190`; `pe.js:1374` rejects `non_json_value`; [S-3] all three throw |
| H-2 | Shared editor round trip: add `TS.build.fromPreview(preview)` and `TS.build.toPreview(build, basePreview)` that keep each untouched exercise's progression, prescription, `secondary`, notes, ids and day identity, and never emit `undefined`. Candidates must use them instead of hand-mapping. | `ss.js:347` sets every exercise to `range`; candidate mappers copy only `primary` (`a.js:437`, `b.js:456`, `c.js:380`); [S-3] |
| H-3 | Shared "commit editor to candidate": activation from the editor uses the edited draft. | [S-3] 18 → 16 removed, 18 activated |
| H-4 | `TS.build.result(build)` returns a result object for the Build route; the shared editor status reads `TF.readiness` so "Pronto para ativar." never shows when readiness fails. | `pe.js:1560-1562` `preview_not_ready` when `result === null`; [S-3] |
| H-5 | Today: store and render the localized program name (`namePt` in PT); localize every muscle token in the session line (split comma-joined `primary` values). | `runtime.js:328`, `runtime.js:339-342`; [S-3] "Build Muscle" in PT |
| H-6 | Paste door "Recomeçar" asks `entry.freeform.confirm_start_over` before discarding. | `ss.js:259`, `ss.js:297`; production key exists in `data/fixtures.js` |
| H-7 | Shared copy override layer for strings the harness shows in every candidate (production follow-up recorded, not part of the tournament): `entry.result.why_goal` composition; EU-PT strings `entry.freeform.gap_error`, `entry.freeform.privacy`, `entry.freeform.not_imported_notice`, `entry.freeform.lede`, `entry.build_setup.name_placeholder`, `entry.priorities.avoid_reason`, `entry.rules_changed.body_rebuild`; shared `x.cost.file` and `x.privacy.line` ("aparelho"). Settled replacements in §5.3. | `ss.js:109`; fixture strings [S-10]; `test/i18n.mjs:436` at the baseline rejects "aparelho" |
| H-8 | Vendor the owner-selected landing proof: `assets/brand/today-ready-{pt,en}-{light,dark}.webp` from the baseline into `vendor/brand/`, with `landing.shot.today_ready.alt`. | baseline `index.html` `.firstrun-hero__figure`; brand guide "First-run modes"; missing from `vendor/brand/` (only `mark.png`) |
| H-9 | Simulated draft API: `TF.saveDraft(state)` writes `device.draft`; resume reads it within the session; Keep in the cancel dialog and "Salvar rascunho" use it. | `runtime.js` device has `draft` but no writer; `b.js:458` toast; `c.js:378` |
| H-10 | `TS.issueText(t, code)` maps every activation, compile and limitation code to catalog copy, with a generic sentence as the only fallback. | C-6 |
| H-11 | Remove `x.cost.*` minute estimates from the shared copy; replace with section counts derived from `ROUTE_STEPS` and factual descriptions. | `ss.js:44-49`, `ss.js:89-94` |
| H-12 | `base.css`: controls (`.btn`, `.choice__title`) wrap only between words (`overflow-wrap:break-word`), so a label that does not fit overflows and is caught by acceptance instead of breaking mid-word; keep `anywhere` for exercise names and user text. | `base.css:55`, `base.css:105`; [S-6] |
| H-13 | Shared import metrics and paste-door button rows reflow at 200% without clipping or mid-word breaks. | X-28, X-29 |
| H-14 | `tools/verify.mjs`: ignore `.visually-hidden` in the clipping heuristic; add the journey and layout checks in §12. | `round-1/acceptance/summary.md`; README |
| H-15 | A shared Privacy stub (sheet or page) so the landing link is not a dead control (P048 #18, P054 AD Privacy page). | [S-7] link inert |

---

## 5. Copy principles (PT-BR first) and settled strings

### 5.1 Principles (settled)

- Write PT-BR first, then EN with equal meaning; judge length and rhythm in
  PT-BR (DESIGN.md "Don't judge copy length in English alone").
- "Você"; calm, direct; sentence case; no exclamation marks; periods and
  commas, no em dashes in prose; en dash only inside numeric ranges.
- One Portuguese word per thing: *programa*, *sessão*, *série*, *equipamento*
  for gym hardware, *dispositivo* for the phone (27 uses in the production PT
  catalog, "celular" none). Never: aparelho, stats, log, performance, delta,
  split, offline (`test/i18n.mjs` at the baseline). No European Portuguese:
  no "Introduza", "assinalados", "regista", "separador", "O meu", "Porquê",
  "folha de cálculo", "aplicação", "guardou". No slang ("Deixa pra lá").
- Agreement at every count: a string reachable with n = 1 has singular forms.
- Name the fact. No unmeasured durations, popularity, "safe", "seguro" or
  outcome promises. The engine's estimates (minutes per session, exercise
  and set counts) are facts and may be shown.
- Placeholders are `{token}`; never assemble sentences from fragments.
- Copy names the control it refers to by its exact label.
- Every string exists in both languages. Candidate strings use the candidate
  prefix; shared additions use `x.*` in `shared-screens.js`.
- Domain vocabulary per `CONTEXT.md`: program, session, capacity; never
  routine, plan, template, e1RM, true max; never "coach" for the AI.
- An assumed fact, if a candidate depends on PD-2 or PD-3, is labelled as
  assumed in words, not only by colour or border. "Suposto" read as awkward
  to one judge; the label wording is open (O-12).

### 5.2 Door and landing copy rules (settled)

- Recommend and Custom outcome lines differ. Recommend: Taurifer chooses the
  structure. Custom: the lifter chooses emphasis and exercises, Taurifer writes
  the program (baseline chooser capture copy, `entry.hub.*`).
- "Você faz" lines may cite section counts from `ROUTE_STEPS` (Recommend 5,
  Custom 7, Browse 2 questions then a list) and the concrete action (paste,
  file, write each exercise). No minutes.
- The landing states the loop in one sentence: Taurifer builds or runs a
  program, logs the sets, and gives the next target (P054 AD). A's landing
  lede ("Quatro perguntas. Depois um programa…") did not; B's did.

### 5.3 Settled strings

These replace strings that break the rules above. D uses them verbatim;
E and F may rephrase only if the meaning and rules hold.

| Key | PT-BR | EN |
| --- | --- | --- |
| `x.privacy.line` | Funciona sem conexão. Sem conta. Seu treino fica neste dispositivo. | Works offline. No account. Your training stays on this device. |
| `x.cost.file` (door description) | Um arquivo de programa Taurifer de outro dispositivo | A Taurifer program file from another device |
| `entry.result.why_goal` (override) | Objetivo: {goal}. | Goal: {goal}. |
| `entry.freeform.gap_error` (override) | Informe valores válidos nos campos destacados. | Please enter valid numbers for the highlighted fields. |
| `entry.freeform.privacy` (override) | O texto colado fica só nesta aba e só para esta importação. Ele nunca entra no histórico, nas exportações nem na telemetria, e o Taurifer o descarta quando o fluxo termina. | (keep production EN) |
| `entry.freeform.not_imported_notice` (override) | Não importado: {items}. O Taurifer registra séries de trabalho e repetições. | (keep production EN) |
| `entry.freeform.lede` (override) | Cole do jeito que estiver: mensagem do treinador, suas notas, uma planilha ou outro lugar. O Taurifer monta um comando para o ChatGPT ou o Claude, que devolve o programa no formato do app. | (keep production EN) |
| `entry.build_setup.name_placeholder` (override) | Meu programa | (keep production EN) |
| `entry.priorities.avoid_reason` (override) | Por que evitar {exercise}? | (keep production EN) |
| `entry.rules_changed.body_rebuild` (override) | O Taurifer mudou a forma de montar programas desde que você salvou este. Monte de novo para usar as regras atuais. | (keep production EN) |
| `x.restart.title` (new) | Começar de novo? | Start over? |
| `x.restart.body` (new) | Suas respostas e este programa ainda não usado serão descartados. O que já está ativo não muda. | Your answers and this unused program will be discarded. Nothing that is already active changes. |
| `x.restart.body_shared` (new) | O programa recebido pelo link será descartado deste dispositivo. Para vê-lo de novo, abra o link outra vez. | The program received by link will be discarded from this device. To see it again, open the link again. |
| `x.restart.confirm` (new) | Descartar e começar de novo | Discard and start over |
| `x.restart.cancel` (new) | Voltar ao programa | Back to the program |
| `x.change.none` (new) | Nenhum exercício mudou. | No exercise changed. |
| `x.change.one` (new, n = 1) | 1 dos {total} exercícios mudou. | 1 of {total} exercises changed. |
| `x.change.many` (new, n ≥ 2) | {n} dos {total} exercícios mudaram. | {n} of {total} exercises changed. |

Production strings kept as they are and required where they apply:
`entry.priorities.pain_note`, `entry.active_notice`,
`entry.preview.activate_first`, `entry.preview.activate_replace`,
`setup.shared.title`, `setup.shared.cap_one`, `setup.shared.cap_many`,
`landing.shared.invalid_headline`, `landing.shared.invalid_body`,
`entry.cancel_confirm.*`, `entry.conflict.*`, `entry.freeform.prompt`,
`x.replace.*`.

---

## 6. Accessibility constraints (settled)

- **A-1 Targets and text.** 44×44 px minimum for every interactive element
  in every cell; 16 px control text; labels and captions never the only
  critical control text (SC Type).
- **A-2 200% text.** No horizontal overflow; no clipped text; no mid-word break
  in a control label or heading word (L-5); the pinned region ≤ one third of
  the viewport and holds only the primary action (L-1); every step still
  shows its question and at least its first option above the pinned region at
  390×844.
- **A-3 Focus.** On every view change, focus moves to the new heading; on
  closing a sheet or dialog, focus returns to its opener; a failed activation
  or validation moves focus to the adjacent summary (P048 a11y).
- **A-4 Semantics.** Radio groups and checkbox groups with names; sheets and
  dialogs `role="dialog"` with `aria-modal` and a labelled title; disclosures
  expose `aria-expanded`; the section counter is announced
  (`aria-live="polite"`); search results are a named list; include/avoid
  buttons carry the exercise in their accessible name.
- **A-5 Localized accessible names.** No English `aria-label` or fallback
  string in PT (C used "Close" and "OK", `c.js:270`, `c.js:229`).
- **A-6 State not by colour alone.** Selected, assumed, confirmed, blocked and
  error states carry text or a mark plus text.
- **A-7 Disabled with a reason.** A disabled primary has an adjacent readable
  reason linked by `aria-describedby`; disabled is not opacity (DESIGN.md).
- **A-8 Reduced motion is one decision.** Only the shared `.view-enter`
  transition exists and `base.css:288-289` removes it; candidates add no
  motion that bypasses it. Coherent in all three Round 1 candidates (both
  judges).
- **A-9 Light/dark parity** via tokens only; no raw colours (clean in Round 1,
  both judges).
- **A-10 Widths.** 320, 390, 430 px with no layout that depends on one width;
  320×568 at 200% is the hardest cell and must pass A-2.
- **A-11 Scroll affordance.** A pinned footer never hides the last option of
  a step on first render without the content being scrollable to it (A's Q4,
  [S-9]).

---

## 7. Semantic-system constraints (Plan 058)

All settled; source is the Plan 058 semantic contract at the baseline.

- **SM-1 Control intents.**
  - `primary`: Continue, Mostrar/Usar este programa, Começar este programa,
    the featured Recommend door. One per screen region.
  - `quiet-navigation`: Back, Cancel, close, drill-in rows, `#firstRunImport`
    (bordered landing recipe), chooser doors other than the featured one,
    the import-mode switches.
  - `destructive`: Começar de novo, Recomeçar, Descartar rascunho, Remove;
    danger ink with a required boundary; whole-draft discards confirm (C-7).
  - `selection`: choice cards, chips, reason chips, include/avoid
    search-result buttons (no selected state on the latter).
  - `adjustment`: the build editor's set stepper (deliberate variant).
  - `disclosure`: the "Usar meu próprio programa" group, the environment
    correction, "Por que este programa" if collapsible; `aria-expanded`.
  - `field`: name, search, paste, gap inputs; invalid state on the field.
  A chevron on a drill-in row does not make it a disclosure, and a row that
  opens an avoid editor must not look like navigation (A's exercise rows had a
  navigation chevron but opened "Deixar este exercício fora").
- **SM-2 Landing recipes.** `#firstRunCreate` and `#firstRunSharedStart` use
  `landing-accent-primary`; `#firstRunImport` uses
  `landing-bordered-navigation`. Keep these IDs.
- **SM-3 Elevation.** Content is `flat`; chosen options are `selected` (inset,
  no outward shadow); sheets and dialogs are `modal`; the pinned action area is
  `persistent-action` with no second raised card inside it; exactly one
  persistent-action region per screen (B showed two in the conflict state,
  `b.js:222`, [S-6]). No nested bounded cards.
- **SM-4 Progress dimensions.** Entry step bars carry
  `data-progress-dimension="task"` and `data-progress-scope="entry-route-step"`;
  the denominator is the route's semantic section count, not a count that
  changes when an optional step appears (P048 a11y). A confirmation counter
  such as C's "0/7 confirmado" is a progress meter over facts and is not
  permitted.
- **SM-5 One accent.** Forge orange marks what is live or what changed:
  the landing primary, the featured door outline, the current section, a
  change statement. Not repeated per row (C's 18 "Deixar fora" links), not on
  assumed-fact borders plus links on the same screen. Orange text uses
  `--accent-deep`; fills, rings and glyphs use `--accent`.
- **SM-6 Semantic colours.** Positive only for a PR or a completed target:
  not for "Programa atualizado" (`a.js:299`) and not for "Pronto para ativar"
  (all three editors). Danger only for destructive actions and validation
  failures: an empty Build day before any activation attempt is a neutral
  status, not danger.
- **SM-7 Type roles.** `title` for step headings, `feature-title` for the
  program name, Mono (`--font-training-data`) for counts, loads, reps,
  minutes; no new sizes.

---

## 8. Patterns explicitly rejected, and why

| ID | Pattern | Why | Status |
| --- | --- | --- | --- |
| R-1 | Activating a program compiled from default answers the lifter never gave (C) | C-1; defaults describe an intermediate lifter (18 vs 15 exercises for a novice [S-1]); P048 #3, #5, #6; PRODUCT.md principle 1 | rejected |
| R-2 | A "result always exists" architecture where any route that forgets to set its result falls back to a stale compile | Produced C's wrong-program Build activation [S-3] | rejected |
| R-3 | Replacing an active program from the first surface an existing user sees, before any answer | C's "Arquivar o programa atual e usar este" enabled at 0 confirmed on `hub-existing` [S-5] | rejected |
| R-4 | Positional diff counts | Impossible statements ("21 de 22" for a days change, [S-9]) | rejected |
| R-5 | Unconfirmed whole-draft destruction (Start over, Recomeçar, discard) | C-7; SC destructive | rejected |
| R-6 | Time-to-complete estimates and popularity claims on doors | C-9; no users, no measurements (PRODUCT.md) | rejected |
| R-7 | Row-level avoidance as the only way to avoid an exercise | Cannot avoid an exercise not yet in the program; the scenario's bench press is absent from Rafael's program [S-1]; P048 #10 | rejected |
| R-8 | Hiding Browse, Custom, Build or Import behind a generated result for a lifter who has not asked for one (A: "Quer algo diferente?" after four answers; A's existing user has only Q1) | P054 AD five jobs, NG "hiding expert controls"; X-11. A deferred-route direction may be explored only as a flagged PD-1 dependency. | rejected |
| R-9 | Fact-confirmation counters and dashed-accent "unconfirmed" chips across the first screen | SM-4, SM-5; decision overload measured at 7 facts + 18 links on one 2,668 px screen (Bravo §1 row 6; `c.js:253`) | rejected |
| R-10 | Pinned bars holding two side-by-side secondaries at 200% | L-1, L-5 [S-6] | rejected |
| R-11 | Five-column numeric segments with a radio mark inside each cell | L-4 [S-8] | rejected |
| R-12 | Sending a configured user to the first-run landing | N-4 [S-5] | rejected |
| R-13 | Filtering the result's reasons to a subset | C-4; P048 #13 | rejected |
| R-14 | Copy promising what the product does not do ("safe substitute", later fact editing, "four questions" when five are asked) | C-8, C-9 | rejected |
| R-15 | Positive colour for status and danger colour for expected incompleteness | SM-6 | rejected |
| R-16 | Fabricating a close alternative | C-10; P054 Entry routes | rejected |

What survives from C: stating the consequence of a rebuild (C-5), and the
idea that facts can be corrected on the program (adopted through A's result
model, not C's inline strip).

---

## 9. Decisions intentionally open for Round 2

Each open item names the divergence it invites and D's default. E and F must
diverge from D and from each other on at least two of O-1 to O-6, and state
which in their thesis.

The route-choice question is not settled by the evidence (no users; the
judges' preferences are informed taste) and stays open for divergence. D keeps
the up-front chooser. At least one of E or F makes the route decision
materially cheaper, either inside the chooser (O-4) or, declared as a PD-1
dependency, by progressive questioning with deferred routes, so that Round 2
produces comparable evidence on it.

| ID | Open question | Divergence it invites | D default | Constraints that still bind |
| --- | --- | --- | --- | --- |
| O-1 | How Recommend's required answers are grouped | One question per screen (A-style, 5–6 screens) versus B's five grouped sections versus a hybrid (goal and background together, schedule alone) | B's five sections | All required answers asked; P048 "roughly five short sections"; section counter by semantic sections |
| O-2 | Where the optional priorities/avoid step sits | Before the first result (B) versus offered from the result as an optional refinement before activation, with proactive search | Before the result, with a visible Skip | Proactive avoid search with required reason; labelled optional; reachable before activation; `rec-avoid-pain` reachable honestly |
| O-3 | How the review shows the answers it was built from | A compact editable summary line, a fact list, chips, an "Alterar" panel | A compact "Montado com" list of editable facts placed after the first day, each opening a sheet | L-3 (program first); N-5 (in place, no re-walk); C-5 change statement |
| O-4 | How cheap the route decision is made | Door copy form, a helper that asks up to two questions, a chooser whose first door starts Recommend's first question in place, sheet versus page | B's chooser with factual "Você faz / Você recebe" lines and a helper that reaches all five jobs | P054 AD IA (§2 rows 2–3); no minutes, no popularity; the chooser is what the landing primary opens (unless PD-1) |
| O-5 | How the consequence of a recompile is shown | A status line, an inline highlight of changed rows, a before/after count | A status line under the facts line using `x.change.*` | C-5; one accent (SM-5); announced politely |
| O-6 | Whether routes can also be reached from the review | "See ready-made programs for {n} days" and "Choose muscles and exercises" as review actions, versus chooser only | Chooser only, plus Back | N-7 explicit switch; the chooser still offers every job up front |
| O-7 | Whether the shared gate offers a decline | A quiet "Agora não" that returns to the generic landing without saving, versus Start only (baseline) | Start only | ADR 0007: nothing persists; one Start action remains the primary; a decline must not apply the payload |
| O-8 | Landing composition | Proof figure above or below the actions, `landing.proof.*` facts as text versus the vendored capture | Headline, lede, the two actions, then the capture with its alt text | Both actions in the first viewport at 390×844; owner-selected visual only (P054 visual gate) |
| O-9 | How an answer is edited from the review | Bottom sheet versus inline expansion | Bottom sheet with its own "Atualizar programa" | L-2 (nothing under the pin); focus returns to the fact (A-3) |
| O-10 | Where the resume card lives | Landing versus chooser versus both | Chooser (it names route and step) | Names route, step and date; returns to the exact step |
| O-11 | How Build is offered from the import route | A quiet link "Prefiro escrever do zero" versus a third door | A quiet link to Build | Build stays in the chooser's own-program group |
| O-12 | The words for an assumed value | "Suposto", "Presumido", "Padrão", "Você ainda não escolheu" | Not used by D (D asks everything) | Only under PD-2/PD-3; text, not colour alone |

---

## 10. Product-policy decisions that require human approval

Do not resolve these in Round 2. A candidate may explore one only by flagging
it in its header comment and in `round-2/manifest.md`. D depends on none.

- **PD-1 Deferred route choice (progressive questioning).** Should "Start"
  go straight into Recommend's questions, with Custom, Browse, Build and Import
  offered later as refinements, instead of opening the five-job chooser?
  - For: removes one decision a new lifter often cannot make; measured saving
    is one tap plus the reading cost of five doors (B's chooser at 390 px holds
    about 400 words of door copy, Bravo §1 row 3).
  - Against: P054 AD ("Start training opens the five-job chooser") and P054
    NG ("No merging Recommend and Custom, hiding expert controls"); Custom
    loses distinct provenance unless kept as its own route; importers and
    builders must first pass a Recommend screen; A's version left existing
    users with no chooser at all.
  - Evidence does not settle it: there are no users, and both judges'
    preferences here are informed taste. This is the round's main open
    product question.
- **PD-2 Assumed session length.** May the ceiling default to 60 min, shown
  as an assumption, instead of being asked?
  - For: one fewer tap and decision.
  - Against: P048 #7 asks for minutes; the value changes the program
    materially: 45 min gives 15 exercises / 36 sets where 60 min gives 18 / 49
    for Rafael [S-1]. A lifter with a 45-minute ceiling who accepts the
    default gets sessions longer than their week allows.
- **PD-3 Assumed or preselected rest.** May "Deixar o Taurifer escolher" be
  preselected, or rest assumed, instead of requiring an explicit answer?
  - For: it is a real answer that satisfies validation; one fewer tap
    (Judge Alpha asked for preselection).
  - Against: P048 #7 asks preferred rest; the engine requires an explicit
    `preferredRestSeconds` key (`pe.js:1401-1403`), which a preselection
    satisfies without the lifter acting; rest changes the per-day estimate
    (49/53/49 min with Taurifer's choice versus 55/59/55 min at 2 min for
    Rafael) though not the exercise list [S-1]. Judge Bravo asked for owner
    sign-off, and the sources support that.
- **PD-4 An illustrative program before any answer.** May the first screen
  show a compiled, non-activatable example program built from defaults (C's
  thesis without C's activation)?
  - For: shows value before asking.
  - Against: the landing already carries the owner-selected product-loop
    proof (P054 visual gate); a compiled example invites "use this" and
    describes an intermediate lifter (R-1); PRODUCT.md principle 1.
- **PD-5 Production catalog corrections.** The EU-PT strings and the
  `why_goal` composition (§5.3) are production catalog defects present at
  PR #256. The tournament overrides them in the harness; changing
  `i18n-pt.json` is a production follow-up for the owner's queue, not part of
  Round 2.

---

## 11. Decision log

Every item carries exactly one status. Items defined in earlier sections are
logged here by ID with their status; their evidence is in the section named.

### 11.1 Decisions

| ID | Decision | Status | Evidence |
| --- | --- | --- | --- |
| D-01 | Base = B's IA and state machine + A's result-as-review + C's change statement (recomputed) | settled | §1; [S-2], [S-3], [S-5]; P054 AD/NG; P048 #7 |
| D-02 | C rejected as base and as direction | rejected | §4.3 X-5, X-25; R-1 to R-4 |
| D-03 | A's merged-route structure rejected as the D direction; available only under PD-1 | rejected | P054 AD, NG; X-11, X-22; [S-5] |
| D-10 | Landing: two early actions with the baseline recipes and IDs | settled | Brand guide "First-run modes"; baseline `index.html` `#firstRunCreate`/`#firstRunImport`; SC landing recipes |
| D-11 | Landing states the program → logged set → next target loop and shows the owner-selected proof | settled | P054 AD; brand guide; baseline capture `onboarding-start/first-run`; H-8 |
| D-12 | Landing secondary opens the import route on the paste door, file door and chooser one tap away | settled | Baseline `app.js` `openFirstRunImport` (sets `importSourceMode` freeform, selects `import`); X-31 |
| D-13 | Chooser keeps all five jobs: Recommend featured primary, Custom deliberate alternative, Browse separate, Build/Import grouped | settled | P054 AD; P048 #1, "Entry hub"; baseline `onboarding-start/hub` |
| D-14 | Recommend and Custom keep distinct questions, provenance and outcome lines | settled | P054 Entry routes; X-18 |
| D-15 | Door lines state facts only (section counts, concrete actions) | settled | C-9; R-6; H-11 |
| D-16 | Existing active program: same chooser with the active notice | settled | P048 "Existing users"; X-11 |
| D-17 | No popularity or "most people" labels | settled | X-16; PRODUCT.md "No users yet" |
| D-18 | Help affordance reaches all five jobs including Browse | settled | X-17 |
| D-20 | Minutes asked, required, 30/45/60/75/90+ | settled | P048 #7; `pe.js:1400`; [S-1] |
| D-21 | Rest asked with "Deixar o Taurifer escolher"; not preselected in D | settled | P048 #7; `pe.js:1401-1403`; baseline schedule capture has no preselection |
| D-22 | Time described as a ceiling | settled | P048 Section 3 |
| D-23 | Priorities optional with "no special priority" default; ≤ 2 muscles | settled | P048 #8, Section 5 |
| D-24 | Proactive avoid search with a required reason; production pain note; row-level avoid only as a complement | settled | P048 #10; [S-1]; R-7 |
| D-25 | Result is the review (merged result and editable preview) | settled | P054 AD |
| D-26 | Program first in the first viewport | settled | L-3; [S-7] |
| D-27 | Answers editable in place from the review, recompile without re-walk | settled | N-5; `a.js:399`; `b.js:199` |
| D-28 | Full reasons (P048 #13 plus equipment, priorities, progression, adjustments) | settled | C-4; X-21 |
| D-29 | "O que o Taurifer ajustou" and "Suas restrições" blocks in plain language | settled | §2 rows 11, 13; H-10 |
| D-30 | Determinism line allowed | settled | P048 #11 |
| D-31 | Change statement by identity after every recompile | settled | C-5; [S-9] |
| D-32 | Close alternative only when the compiler supplies one | settled | C-10; [S-1] |
| D-33 | One pinned primary; secondaries in flow at 200% and 320 px | settled | L-1; [S-6] |
| D-34 | Back from every review to where it was entered from | settled | N-2; X-26; [S-4] |
| D-35 | Start over confirms; on Shared it names the received program | settled | C-7; X-12 |
| D-40 | Build activates the built program via `TF.readiness`; failures rendered | settled | C-2; X-4, X-5; H-4 |
| D-41 | Edit before using commits edits and keeps engine fields | settled | C-2, C-3; H-2, H-3 |
| D-45 | Configured users never see the first-run landing | settled | N-4; X-10; [S-5] |
| D-46 | Replacement dialog instead of `window.confirm` | settled | UI-only change; `x.replace.*`; P048 Existing users |
| D-47 | Conflict state has one persistent-action region | settled | SM-3; X-13 |
| D-50 | Shared gate: name, day count, what arrives, nothing saved, one Start | settled | ADR 0007; brand guide; baseline `onboarding-shared/gate` |
| D-51 | Shared review Cancel returns to the gate | settled | `a.js:394`, `b.js:416` (both already did) |
| D-52 | Invalid link: reason, nothing saved, generic actions | settled | ADR 0007; brand guide |
| D-55 | Resume names route, step, date and returns to that step | settled | `b.js:289`, `b.js:454` |
| D-56 | Keep draft really keeps it | settled | N-6; H-9; `c.js:378` |
| D-60 | Numeric options as a 3+2 card grid without a radio mark per cell | settled | L-4; [S-8]; baseline schedule capture |
| D-61 | Harness fixes H-1 to H-15 land before Round 2 generation | settled | §4.4 |
| D-62 | Round 1 files stay frozen; Round 1 acceptance is not re-run | settled | `round-1/manifest.md`; generator brief |

### 11.2 Items defined elsewhere

| IDs | Status |
| --- | --- |
| C-1 to C-10 (§4.1), ADR/brand rules (§4.2) | settled |
| N-1 to N-7 (§3.1) | settled |
| N-8 (§3.1) | open (O-6) |
| L-1 to L-6 (§3.2) | settled |
| A-1 to A-11 (§6) | settled |
| SM-1 to SM-7 (§7) | settled |
| R-1 to R-16 (§8) | rejected |
| O-1 to O-12 (§9) | open |
| PD-1 to PD-5 (§10) | requires product decision |
| H-1 to H-15 (§4.4) | settled (mandatory harness fixes) |
| X-1 to X-29, X-32, X-33 (§4.3) | settled as real defects (fixed by the rule or harness item named) |
| X-30 (§4.3) | rejected as a defect; question kept as O-7 |
| X-31 (§4.3) | rejected as stated; the real defect is fixed by D-12 |
| §5.3 settled strings | settled |

### 11.3 Where the judges disagreed, and what the evidence says

| Topic | Judge Alpha | Judge Bravo | Resolution | Status |
| --- | --- | --- | --- | --- |
| Base | B as base, graft A's result | A as direction, graft B | Evidence supports Alpha on the base (policy, verified defects); Bravo's grafts adopted (§1.3) | settled |
| Brand-new user (scenario 1) | B: only one that explains the loop | A: B asks the same choice twice | Both partly right. The loop explanation is required (P054 AD) and the two-action landing is shipped product (X-31); the duplication Bravo saw comes from B sending "Já tenho" back into the chooser instead of the import route (D-12) | settled |
| Uncertain route (scenario 2) | B's helper | A spares the choice | Neither is proven: there are no users. Policy fixes D to the chooser (D-13, settled) and how cheap the chooser is stays open (O-4); the disputed question, whether to spare the choice, is PD-1 | requires product decision |
| Correction (scenario 4) | A: fixes on the result | B: explains the consequence | Both right on different halves; D takes A's mechanism and B's reasons (D-27, D-28) | settled |
| Shared (scenario 10) | A: no destructive side door | B: richer gate card | Both right; D takes B's gate and A's preview exits, and confirms Start over (D-35, D-50, D-51) | settled |
| Import (scenario 9) | B (A and C have dead Cancels) | Tie (widgets shared) | Alpha right: the dead Cancels are real and candidate-specific [S-2] | settled |
| Activation (scenario 14) | B content, A equal flow | A fewest taps | A's tap lead is PD-2/PD-3 plus the chooser (§1.2); content per B | settled |
| Rest | Preselect "let Taurifer choose" | Owner sign-off | Bravo right: P048 #7 and `pe.js:1401` | requires product decision (PD-3) |
| Shared "not now" | not raised | Missing, per Plan 054 | Not in Plan 054's text; baseline has one Start (X-30) | open (O-7) |
| B's landing split | not a defect | unspecified pre-hub step | Shipped product; destination was the defect (X-31, D-12) | settled |
| Pinned share at 200% | about 55–60% | 43–60% | Both directionally right; 36–49% at 390 and about 70% at 320 [S-6] | settled (L-1) |
| Editor activation drops edits | not reported | reported, all three | Real [S-3] | settled (D-41) |
| Existing user sent to landing | A only | not reported | A and B both [S-5] | settled (D-45) |

### 11.4 Synthesizer observations [S-n]

All runs: Playwright with Chromium 1194, `app.html` on the static server at
`http://127.0.0.1:8123/`, locale `pt-BR`, 390×844 DPR 2 unless stated, state
read through `window.__tournamentCandidates[c].state()` and `TF`.

- **[S-1] Compiler facts (real vendored compiler).** Rafael (muscle growth,
  6–24 months, most, 3 days, 60 min, rest 120 s, commercial gym): 18
  exercises, 49 sets, `range,rep_goal`, name "Build Muscle" / namePt "Ganhar
  massa", `alternative: null`. Barbell bench press `pr_bb` absent from the
  program with and without a chest priority. Novice (first, none): 15 / 43 /
  `range`. C's defaults compile to Rafael's program exactly. 45 min: 15 / 36.
  Rest changes only day estimates: Taurifer's choice or 60 s 49/53/49 min,
  120 s 55/59/55, 180 s 57/59/57. Browse for 4 days / 60 / commercial gym: 20
  cards.
- **[S-2] Cancel reachability.** Tapping `[data-act=cancel]`: A and C show no
  `cancel-confirm` on `import-source`, `import-review`, `build-setup`; all
  three show it on `ff-empty` and `build-empty`; B shows it on all five.
- **[S-3] Activation paths.** `build-ready` → `#entryEditorActivate`: A and B
  stay on `build-ready` with no alert and no active program; C lands on Today
  with "Build Muscle / 18 ex". `import-preview` → `#entryActivate`: all three
  throw `TypeError: Invalid program-entry result`. `rec-result` → Edit →
  "Voltar ao programa" with no change: progression `range,rep_goal` becomes
  `range`, and activation then throws in all three. `rec-result` → Edit →
  remove 2 → activate from the editor: the active program has 18 exercises in
  all three. `activated-today` in PT shows "Build Muscle" in all three.
- **[S-4] Review exits.** Browse and Shared previews offer: A "Cancelar |
  Usar este programa | Editar exercícios"; B the same plus "Começar de novo"
  (no dialog; `b.js:459` resets answers); C adds "Trocar programa". None has a
  Back to the list or gate other than A's and B's Shared Cancel.
- **[S-5] Existing user.** `hub-existing`: A renders question 1 only; B renders
  the chooser; C renders a default program with "Arquivar o programa atual e
  usar este" enabled. In B, "Voltar" from the chooser with an active program
  renders the first-run landing ("Saiba o que fazer na academia hoje.").
- **[S-6] 200% layout.** Pinned share of viewport: 390×844 A 43% (result),
  49% (conflict); B 36% and 42%+11% (two pinned regions in conflict); C 37%
  and 43%. 320×568: A 71%, B 69%, C 71% on the result. Words split across
  lines inside controls (Range rects): A at 390 "Levantamento",
  "Desenvolvimento", "diferente?", "exercícios"; B at 390 "Continuar" on
  `rec-schedule`; C at 320 "Trocar", "programa", "Editar", "exercícios".
- **[S-7] First viewports (390×844, PT light).** A's result shows seven fact
  chips and reaches the first exercise row only at the fold, just above
  the pinned block; B's result shows the program name, facts line and the first day's
  six rows. A and B landings: headline, lede, two actions, privacy line, and
  about half the viewport empty; no product-loop proof; the Privacidade button
  has no action (`a.js:241`, `b.js:245`).
- **[S-8] B schedule grid.** Line count of `.choice--seg .choice__title`:
  at 390 days 1 line each, minutes 2 lines ("30" … "75") and 3 lines ("90+");
  at 430 "90+" 2 lines; at 320 (3-column fallback) 1 line each.
- **[S-9] C and A overlays.** C: opening the days fact puts its confirm at
  779–827 px under a pin at 693 px (390×844), at 850 px under a pin at 417 px
  (320×568); `#entryActivate` enabled with 0 facts confirmed; changing days
  3→4 shows "Remontado: 21 de 22 exercícios mudaram." A: last Q4 option
  bottom 780 px under a pinned footer at 746 px.
- **[S-10] Catalog strings.** From `data/fixtures.js` (baseline catalog):
  `entry.result.why_goal` "Prioriza {goal}." with goal label "Priorizar ganho
  de massa"; EU-PT in `entry.freeform.gap_error`, `entry.freeform.privacy`,
  `entry.freeform.not_imported_notice`, `entry.freeform.lede`,
  `entry.build_setup.name_placeholder`, `entry.priorities.avoid_reason`,
  `entry.rules_changed.body_rebuild`; production has
  `entry.freeform.confirm_start_over`.
- **[S-11] Import metrics at 200%.** On `import-review` at 390×844 200% (A and
  B, shared widget), the captions "vinculados" and "personalizados" are wider
  than their metric cells (`scrollWidth > clientWidth`).

### 11.5 Classification of material findings

Classes from the synthesis brief. Each finding appears once, under its primary
class.

| Class | Findings |
| --- | --- |
| Product/domain correctness | X-5, X-25 (activation at 0/7, keep discards), X-21 (reasons filtered), X-22 (policy merges and assumptions), X-24 (reactive-only avoidance), C-5 positional diff, C-9 invented claims (X-15, X-16, "substituto seguro", post-session promise), X-10 and X-11 (existing users) |
| Activation and task performance | Tap counts 11 (A) vs 15 (B) and their decomposition (§1.2); X-4 Build dead end; X-19 re-walk on correction; A's in-place correction (adopted, D-27); X-3 editor activation |
| Information architecture | Five-job chooser versus deferred routes (PD-1, O-4); X-31 landing secondary destination; X-17 helper coverage; X-18 identical outcome lines; X-23 silent route switch; X-26 missing Back from previews |
| Interaction/system constraints | X-9 dead Cancel; X-12 unconfirmed Start over; X-13 duplicate persistent-action; C-7 destructive confirmation; N-6 keep draft; SM-1 control intents (chevron rows that open avoid editors) |
| Accessibility/responsiveness | X-14 segments; X-27 pinned share; X-28 mid-word breaks; L-2 editors under the pin; A's Q4 option under the footer; C's English aria-label; K-11 to K-14 |
| Visual craft | L-3 program-first review (A's chip column pushed the program to the fold); R-9 C's accent overload; SM-5 one accent; SM-6 positive/danger misuse; empty half-viewport landings without the loop proof ([S-7]) |
| Implementation risk | H-1 to H-15 harness defects; R-2 result-always-exists architecture; X-6 Today localization; raw codes (C-6) |
| Open taste decision | O-1 grouping, O-3 answer presentation, O-5 change-statement form, O-8 landing composition, O-9 sheet versus inline, O-10 resume placement, O-12 assumed-value wording |

---

## 12. Acceptance checks for Round 2

### 12.1 Comparison matrix (unchanged contract, extended cells)

- Candidates D, E, F; all 45 checkpoints; the same seeds, fixtures and example
  users as Round 1 (`data/fixtures.js`).
- Full matrix available to judges for every checkpoint: PT-BR and EN × light
  and dark × 320, 390, 430 px × 100% and 200% text × normal and reduced
  motion.
- `tools/verify.mjs --round 2` runs these cells per checkpoint (Round 1's five
  plus three the evidence showed to be the hardest):
  1. PT light 390 100%
  2. EN dark 390 100%
  3. PT light 320 100%
  4. PT light 390 200%
  5. EN light 430 100% reduced motion
  6. **PT light 320 200%** (pinned-share and word-break failures, [S-6])
  7. **PT light 430 100%** (segment failure, [S-8])
  8. **EN dark 320 200% reduced motion**
- Hard failures (must be zero before freezing): runtime errors; missing
  checkpoint marker; horizontal overflow; any check in §12.2 marked *hard*.
- Warnings reported per cell: targets under 44 px, clipped text (excluding
  `.visually-hidden`, H-14).

### 12.2 New checks the Round 1 evidence justifies

Journeys are scripted in `tools/verify.mjs` (or a sibling script it calls) and
run in PT light 390 100% and PT light 320 200% unless noted.

| ID | Check | Kind | Evidence |
| --- | --- | --- | --- |
| K-1 | Every route activates end to end and lands on Today: Recommend, Custom, Browse, Build, Import (file), Import (paste, gaps repaired), Shared. The active program equals the reviewed one (same exercise ids, sets, rep ranges, progression ids) and Today shows its localized name. | hard | [S-3]; C-2; H-1, H-5 |
| K-2 | Edit round trip without change leaves progression ids and reasons unchanged; activation succeeds. | hard | [S-3]; C-3; H-2 |
| K-3 | Remove two exercises in Edit before using, then activate from the editor and, separately, from the review after returning: the active program has 16. | hard | [S-3]; H-3 |
| K-4 | Build: with an empty day, activation is disabled with an adjacent reason; when complete, activation succeeds and Today shows the Build name. | hard | [S-3]; D-40 |
| K-5 | From every non-landing view of every route, Cancel opens `cancel-confirm` (or, on a shared review, returns to the gate). "Keep" then resume restores the same step and answers. | hard | [S-2]; N-3, N-6 |
| K-6 | Every review (Recommend, Custom, Browse, Import, Shared) has a non-destructive Back to where it was entered from, with filters, row decisions or answers intact. | hard | [S-4]; N-2 |
| K-7 | Every whole-draft destructive action opens a confirmation before any state changes (review Start over, paste-door Recomeçar, Discard draft). | hard | [S-4]; C-7 |
| K-8 | With an active program, no exit (Back, Cancel, Keep, Discard, conflict, replacement cancel) renders the first-run landing. | hard | [S-5]; N-4 |
| K-9 | Pain avoidance: barbell bench press can be avoided with reason "dor ou desconforto" before activation; Continue or Apply is disabled until a reason is chosen; the production pain note is visible; the review lists the constraint and truthfully states whether exercises changed. | hard | [S-1]; D-24 |
| K-10 | No raw engine codes in visible text or accessible names in any checkpoint or journey end state (pattern: lowercase snake_case tokens and `code:` forms such as `preview_not_ready`, `day_empty:`, `compile_threw`). | hard | C-6 |
| K-11 | Exactly one visible persistent-action region per screen, and its height ≤ 33% of the viewport in every verified cell. | hard | [S-6]; L-1, SM-3 |
| K-12 | No word inside a button, choice title, chip or heading renders across two lines (Range client rects per word), in every verified cell. | hard | [S-6]; L-5 |
| K-13 | Numeric option values ("2" … "6", "30" … "90+") render on a single line in every verified cell. | hard | [S-8]; L-4 |
| K-14 | Opening any editor, sheet or panel: its confirm control is fully visible above the pinned region, or the view scrolls it there. | hard | [S-9]; L-2 |
| K-15 | PT text and accessible names contain no banned or EU-PT words (aparelho, stats, log, performance, delta, split, offline, Introduza, assinalados, regista, separador, "O meu", Porquê, folha de cálculo, aplicação) and no English fallback labels ("Close", "OK"). | hard | §5.1; [S-10]; A-5 |
| K-16 | No unmeasured claims in visible text: no minutes on route doors, no "maioria"/"most people", no "seguro"/"safe". | hard | C-9 |
| K-17 | Change statements satisfy `n ≤ total` and equal the identity diff computed by the check (days 3→4; environment correction; pain avoidance). | hard | [S-9]; C-5 |
| K-18 | Recommend requires the lifter to set desired result, experience, consistency, days, minutes, rest and environment before a result can be activated (D and any candidate not flagged for PD-2/PD-3). | hard | P048 #3–#7; C-1 |
| K-19 | The chooser offers all five jobs; the help affordance can end at each of Recommend, Custom, Browse, Build and Import. | hard for D and for any candidate not flagged for PD-1 | D-13, D-18 |
| K-20 | Focus: after each view change focus is on the new heading; after closing a sheet or dialog focus returns to its opener; after a failed activation or gap submit focus is on the error summary. | warning | A-3 |
| K-21 | Reduced motion: no computed animation or transition duration > 0 with `data-motion="reduced"`. | hard | A-8 |
| K-22 | First viewport of `rec-result` at 390×844 100% contains the program name, the facts line and the first day heading. | warning | L-3; [S-7] |
| K-23 | Landing: both actions inside the first viewport at 390×844 100%; the proof image has its alt text; the Privacy control opens the stub. | hard | D-10, D-11; H-8, H-15 |
| K-24 | Tap counts recorded (not thresholds): Rafael landing → Today on Recommend; correction from the review (commercial gym → limited home with dumbbells, band, safe pull) → recompiled review; avoid bench press → recompiled review. Bound for the correction: no taps beyond opening the editor, the answer changes themselves and one apply, and no other section is shown on the way. | report; the correction bound is hard | N-5; §1.2 |

### 12.3 Judging

Round 2 judges use the Round 1 rubric (17 dimensions, 14 scenarios) and add:
- whether each candidate honours every **settled** and **rejected** item;
- whether each **open** item was resolved in a way that is visibly different
  from D, as its thesis claims;
- whether every **requires product decision** dependency is declared in the
  header and in `round-2/manifest.md`, and whether the declaration is complete.
