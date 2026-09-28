# Round 2 harness proof (H-1 to H-15, acceptance tooling)

Base: branch `ccr-15c50ac8-pki40i`, parent `3ebac2a` (synthesis spec).
Static server `http://127.0.0.1:8123/` rooted at the repository; Playwright
from `test/node_modules`, Chromium 1194 (`/opt/pw-browsers/chromium-1194`,
`--no-sandbox`). Round 1 files (`app.html`, `candidates/{a,b,c}.*`,
`round-1/`) are not edited, and Round 1 acceptance was not re-run into
`round-1/`; a scratch quick run (`--round 1 --quick --out <scratch>`) shows
all 135 Round 1 checkpoint cells still load without errors on the new
shared code.

## 1. The fifteen harness fixes

| ID | Status | Where | Proof |
| --- | --- | --- | --- |
| H-1 | done | `runtime.js` `importPreview` / new `importResult`, `jsonClean` | §2: file import and repaired paste door activate and reach Today; `activate.import-file`, `activate.import-paste` pass |
| H-2 | done | `shared-screens.js` `TS.build.fromPreview` / `toPreview` | §2: no-change round trip is byte-identical, `range` and `rep_goal` kept; `edit.roundtrip` passes |
| H-3 | done | `TS.build.commit(result, build)` | §2: removing two activates exactly 16 identical rows; `edit.remove-two.editor` / `.review` pass |
| H-4 | done | `TS.build.result`, `TS.build.status` (reads `TF.readiness`), `TS.build.statusLine` | §2 status texts; Build activates its own draft; `build.gating`, `activate.build` pass |
| H-5 | done | `TF.activate` stores `name` + `namePt`; `TF.activeName`; `renderToday` uses `TF.muscleLabels` (all `muscle.*` / `entry.muscle.*` keys, comma-split) | §2: "Ganhar massa", "Quadríceps · Peito · Costas" |
| H-6 | done | `TS.freeform` `start-over` → `restartDialog` with `entry.freeform.confirm_start_over`; `start-over-confirm` / `-cancel` | §2; `destroy.paste-restart` passes |
| H-7 | done | `OVERRIDES` in `runtime.js` (applied by `TF.makeT` for every candidate); §5.3 `x.*` strings in `TS.COPY` (PT and EN) | §2; K-15 finds no banned or EU-PT word in any PT cell |
| H-8 | done | `vendor/brand/today-ready-{pt,en}-{light,dark}.webp` (verbatim from the baseline), `TS.landingProof` with `landing.shot.today_ready.alt` | K-23 passes in cells 1 and 2 (image present, alt exact, loaded) |
| H-9 | done | `TF.saveDraft` / `loadDraft` / `clearDraft` (real envelope validation and resume rules); seeds `interrupted`, `rules-drift` use it | §2; `cancel.keep-resume` passes |
| H-10 | done | `TS.issueText` / `TS.issueTexts`; `TS.adjustments` no longer falls back to a code | §2; K-10 finds no raw code in 360 cells |
| H-11 | done | `x.cost.*` without minutes, counts from `ROUTE_STEPS` (`TS.routeSections`: 5 / 7 / 2); `x.get.browse` without the literal 20 | §2 |
| H-12 | **changed** | `base.css` `.btn`, `.choice__title`: `overflow-wrap:normal`, not `break-word` | §3: `break-word` still splits the word; `normal` makes it overflow, which K-12 catches |
| H-13 | done | `base.css`: metrics one per row at 200%; `.metric__label` wraps only between words; paste-door rows already stack (`.btnrow`, `.grid-2`) | no clipping warning and no K-12 failure on `import-review` or any `ff-*` checkpoint in any of the eight cells |
| H-14 | done | `verify.mjs` (Round 1 path) and `audit-page.js`: clipping ignores `.visually-hidden` and its descendants; §12 checks added | §4 self-test (last two cases) |
| H-15 | done | `TS.privacySheet`, `TS.privacyButton`, `TS.openPrivacy` / `closePrivacy`; `TS.wire` opens it for any `[data-act="privacy-open"]` | §2; K-23's real tap opens it in cells 1 and 2 |

## 2. Shared helpers called directly (H-1 to H-11, H-15)

`node docs/design/onboarding-tournament/tools/harness-selftest.mjs` loads
`round-2/app.html` with no candidate and calls `TF` / `TS` directly in the
browser (output also in `harness-proof/harness-selftest.txt`):

```text
PASS H-1 importResult has no undefined fields (raw row 'Zerbulator 9000' has no libraryId key) — {"id":"r5","day":"Dia 2","order":5,"name":"Zerbulator 9000","sets":3,"min":10,"max":15,"notes":"","progression":{"schemaVersion":1,"strategy":{"id":"manual","version":1,"params":{"authored":true}},"modifiers":[]}}
PASS H-1 file import activates and Today shows it — activate={"ok":true,"revision":1}; active exercises=6
PASS H-1 paste door (gaps repaired) activates and Today shows it — activate={"ok":true,"revision":1}; active exercises=6
PASS H-2 fromPreview → commit with no change is byte-identical to the reviewed result — strategies before range,rep_goal after range,rep_goal
PASS H-2 every exercise keeps its progression id — 4 rep_goal, 14 range
PASS H-2 the round-tripped result activates (Round 1 threw here) — {"ok":true,"revision":1}
PASS H-3 removing two exercises activates exactly 16, each identical to the reviewed row — 18 → 16; removed growth_3_d1_s1, growth_3_d2_s1
PASS C-5 change statement by identity — 2 dos 16 exercícios mudaram.
PASS H-4 status reads TF.readiness — "Adicione um exercício a Dia 1, Dia 2, Dia 3." / "Adicione um exercício a Dia 2, Dia 3." / "Pronto para ativar."
PASS H-4 Build activates its own draft (not a stale compile) — pd_bw,rw_bb,sq_lp
PASS H-5 Today shows the localized program name — Ganhar massa
PASS H-5 muscle tokens on the session line are localized and split — Quadríceps · Peito · Costas · 6 exercícios
PASS H-9 Keep (TF.saveDraft) then resume (TF.loadDraft) restores the step and answers — resumable recommend/schedule; Recomendação · Encaixe o treino na sua semana
PASS H-9 Discard (TF.clearDraft) leaves nothing to resume
PASS H-9 seed 'interrupted' is read through the same API — resumable
PASS H-9 seed 'rules-drift' reports rules_changed
PASS H-6 Recomeçar asks entry.freeform.confirm_start_over before discarding
PASS H-6 confirming discards
PASS H-10 issueText maps codes to copy; unknown code → generic sentence — Adicione um exercício a Dia 1. | Revise o programa antes de usá-lo. | Corrija os dados inválidos do exercício antes de usar este programa. | O Taurifer não conseguiu montar um programa com estas respostas. Altere uma resposta e tente de novo. | Não foi possível usar este programa agora. Revise o programa e tente de novo.
PASS H-11 door facts have no minutes; counts come from ROUTE_STEPS — recommend 5, custom 7, browse 2
PASS H-15 the Privacy stub opens and takes focus
PASS H-15 closing returns focus to the opener
PASS H-7 override layer and §5.3 strings are live
all harness self-tests passed
exit 0
```

## 3. H-12: why `normal` instead of `break-word`

The spec asks for `overflow-wrap:break-word` "so a label that does not fit
overflows and is caught by acceptance instead of breaking mid-word". In a
`min-width:0` flex button (the shared `.btn` recipe) `break-word` still
breaks an unbreakable word; only the min-content contribution differs from
`anywhere`. Measured in Chromium 1194 with "Desenvolvimento militar" in an
80 px flex row (lines occupied by "Desenvolvimento", scroll vs client width):

```text
{"anywhere":{"lines":2,"scrollW":76,"clientW":76},"break-word":{"lines":2,"scrollW":76,"clientW":76},"normal":{"lines":1,"scrollW":106,"clientW":76}}
```

So the intent (wrap only between words; a label that does not fit overflows)
is implemented with `overflow-wrap:normal`, and K-12 reports both a word split
across lines (candidate CSS that re-enables `anywhere`) and a control label
wider than its box (the overflow `normal` produces). Exercise names, import
row text and user text keep `anywhere`.

## 4. The generic checks fire for the right reason

`node docs/design/onboarding-tournament/tools/audit-selftest.mjs` loads real
checkpoints of the placeholder, runs the audit clean, injects one known
defect, and runs it again (output also in `harness-proof/audit-selftest.txt`):

```text
PASS K-10 @build-empty: clean 0, injected 1 → K-10 raw code "day_empty" in text: "day_empty:manual_d1"
PASS K-10 @rec-result: clean 0, injected 1 → K-10 raw code "preview_not_ready" in aria-label of button.btn.btn--primary: "preview_not_ready"
PASS K-11 @rec-result: clean 0, injected 1 → K-11 2 persistent-action regions: footer.pinned, div
PASS K-11 @rec-result: clean 0, injected 1 → K-11 persistent-action region footer.pinned is 38% of the viewport (320px of 844px)
PASS K-12 @rec-result: clean 0, injected 1 → K-12 word split across lines: "Desenvolvimento" in button.btn "Desenvolvimento"
PASS K-12 @rec-result: clean 0, injected 1 → K-12 control label overflows its box: button.btn "Desenvolvimento" (108>88)
PASS K-13 @rec-schedule: clean 0, injected 5 → K-13 numeric option "30" renders on 2 lines in button.choice.choice--seg
PASS K-15 @landing: clean 0, injected 1 → K-15 banned or EU-PT word "aparelho": "acidade Seu treino fica neste aparelho. A tela de Hoje: Corp"
PASS K-15 @landing: clean 0, injected 1 → K-15 English fallback label "Close" on button.btn
PASS K-15 @landing: clean 0, injected 1 → K-15 banned or EU-PT word "Porquê": "este dispositivo. Privacidade Porquê evitar? A tela de Hoje:"
PASS K-16 @route-choice: clean 0, injected 1 → K-16 unmeasured claim "maioria": "ama Não sabe qual escolher? A maioria começa por aqui"
PASS K-16 @route-choice: clean 0, injected 1 → K-16 minutes on the route chooser: "cerca de 2 minutos"
PASS K-21 @landing: clean 0, injected 1 → K-21 button#firstRunCreate.btn.btn--primary  transition 0.3s
PASS K-23 @landing: clean 0, injected 1 → K-23 Privacy control ([data-privacy-open]) missing
PASS K-23 @landing: clean 0, injected 1 → K-23 landing proof image with landing.shot.today_ready.alt missing
PASS clipped @landing: clean 0, injected 1 → clipped text: p "personalizados"
PASS clipped @landing (H-14: the same clipped text inside .visually-hidden is ignored): clean 0, injected 0
all self-test cases behaved as expected
exit 0
```

## 5. Round 2 acceptance against the placeholder

```bash
node docs/design/onboarding-tournament/tools/verify.mjs --round 2 --candidates _example \
  --no-shots --out docs/design/onboarding-tournament/round-2/harness-proof/acceptance
```

Full output: `harness-proof/acceptance/summary.md` and `results.json`
(console log in `harness-proof/verify-run.log`). Outcome:

| Candidate | Declared product decisions | Checkpoint cells | Cells without hard failures | Cells with warnings | Journey runs | Journeys passed | Journeys failed (hard) | Not implemented |
|---|---|---|---|---|---|---|---|---|
| _example | none | 360 | 353 | 0 | 122 | 92 | 2 | 28 |

K-24 tap counts (from the same summary):

| Task | Cell 1 | Cell 6 |
|---|---|---|
| Rafael, landing → Today (Recommend) | 15 | 15 |
| Correction from the review → recompiled review (hard bound 6 taps) | 6 | 6 |
| Avoid bench press from the review → recompiled review | – | – |

What the failures mean (all are the placeholder's own, as intended):

- **K-11, 7 cells.** At 320×568 / 200% the placeholder's pinned footer holds
  the disabled-reason caption plus the button (199 px, 35%), and on the
  replacement state the long "Arquivar o programa atual e usar este" label
  wraps to four lines (250–300 px). L-1 says only the primary stays pinned
  and the region stays ≤ one third; a real candidate moves the caption into
  the flow and keeps the pin short.
- **K-14 `overlays`.** The environment sheet opens with the correction
  disclosure expanded, so its "Atualizar programa" sits below the viewport
  inside the scrolling sheet (top 979 px of 844 at 390; 2,467 px of 568 at
  320/200%) and the days sheet's confirm sits at 794–922 px of 568 at
  320/200%. That is L-2's defect exactly; the check reports it with the
  geometry.
- **Not implemented (28 runs, 14 journey ids).** The placeholder exports
  only a subset of `journeys`; every missing id is a hard failure
  (`journey not exported by the candidate`), so a Round 2 candidate cannot
  pass by omission.
- Everything the placeholder does implement passes in both journey cells,
  including the end-to-end activations of Recommend, Build, file import,
  paste door and Shared through the real DOM, the editor round trip, the
  16-exercise removal from the editor and from the review, Build gating,
  Cancel on all 24 non-landing views, Keep then resume, the pain avoidance
  with its truthful "Nenhum exercício mudou." statement, the environment
  correction at the 6-tap bound, and the seven K-18 probes.

The first placeholder draft also failed `activate.build`
(`snapshot "review": entry().result is empty`): its `entry()` returned no
result inside the Build editor, which breaks the contract that `entry().result`
is what activation would commit. The check caught it; the placeholder was
fixed.

## 6. Interpretations and observations

- **K-11 "exactly one".** Implemented as "at most one" visible
  persistent-action region, each ≤ 33% of the viewport. Screens without a
  pinned action (landing, chooser, Today) would otherwise fail by design; the
  Round 1 evidence the check answers was two regions in one state.
- **K-15 / K-16 exemptions.** Library exercise names are data and are
  removed before matching (the library has "Aparelho de pegada na máquina").
  Production catalog strings (after the H-7 overrides) are exempt: the
  required answers "Completei a maioria das sessões planejadas"
  (`entry.background.consistency.most`) and "Puxada vertical segura"
  (`entry.cap.safe_pull`) would otherwise fail every candidate. Words added
  by a candidate or the shared `x.*` copy are judged.
- **K-10 scope.** Text inside `textarea`, `input`, `pre`, `code` and
  `[data-user-text]` is skipped: pasted text, the assistant reply and the
  quoted prompt are user or machine text, not interface copy.
- **Journey preconditions.** Journeys start at a checkpoint rendered by the
  candidate's own `reach()`, with that checkpoint's seed; the verifier's
  expectations are always recomputed from the fixtures and the engine.
- **Tap counting.** Taps are real Playwright clicks and fills requested
  through the api; a click that bypasses the api (untrusted event) fails the
  journey.
- **Harness fixes beyond §4.4 that Round 2 needs.** `TF.mediaFor` and the
  proof image now resolve against the harness root (`TF.asset`), so a
  document one level deeper (`round-2/app.html`) finds the same files;
  `harness.js` no longer probes the contract through candidate `a`.
- **Observation for PD-5 (not changed).** `entry.resume.detail` PT reads
  "Parou em {where}, guardado a {when}.", European Portuguese ("guardado a");
  it is not in §5.3, so it is not overridden. Candidates can phrase the
  resume card with their own copy (`TS.resumeFacts` returns the parts).

## 7. Progress log (written while the work landed)


- Fixtures: `tools/build-fixtures.mjs` now also copies the `privacy.*` and
  `muscle.*` catalog keys (H-15, H-5). Regenerated from the PR #256 checkout:
  only additions (663 → 703 keys per language); every other fixture
  (shared fragments, import file, free-form replies, users) is byte-identical.
- H-8: `vendor/brand/today-ready-{pt,en}-{light,dark}.webp` copied verbatim
  from the baseline `assets/brand/` (VP8X webp, 903×1832).
- runtime.js: H-1, H-5, H-7 override layer, H-9 draft API, identity diff,
  JSON hygiene, shared fixture answers, asset URLs independent of document depth.
- shared-screens.js: H-2/H-3/H-4 build model (fromPreview, toPreview,
  commit, result, status, statusLine), H-6 paste-door confirmation, H-10
  issueText/issueTexts, H-11 route sections, H-15 privacy stub, H-8
  landingProof, §5.3 x.restart.* / x.change.* / fixed x.privacy.line and
  x.cost.file, restartSheet, changeStatement, routeName/stepName/resumeFacts.
  Node smoke test (scratch script): Rafael's compiled result →
  fromPreview → commit with no change is byte-identical to the original
  result; removing two exercises and activating stores 16 exercises with
  `range` and `rep_goal` intact; Build empty/partial/ready status reads
  TF.readiness ("Adicione um exercício a Dia 1, Dia 2, Dia 3." →
  "… a Dia 2, Dia 3." → "Pronto para ativar.").
- base.css: H-12 (`overflow-wrap:normal` on `.btn` and `.choice__title`, see
  the H-12 note below), H-13 (metrics one per row at 200%), styles for the
  proof figure, Privacy stub, change statement and editor status.
- round-2/app.html (loads only `candidates/<c>.{js,css}`), harness.js
  contract loader no longer assumes candidate `a` exists.
- tools: `verify.mjs` (Round 1 path kept, H-14 applied; Round 2 path added),
  `audit-page.js` (generic checks), `journey-api.js` (in-page api),
  `journey-checks.js` (engine-backed journey assertions).
- Found while proving: `TS.build.toPreview` first renumbered `order` after
  a removal, so untouched rows were not byte-identical; fixed (untouched
  rows keep their `order`, new rows are numbered after them).
- The placeholder's first `entry()` returned no result inside the Build
  editor; `activate.build` failed with `snapshot "review": entry().result is
  empty`, which is the contract working. Fixed in `_example.js`.
