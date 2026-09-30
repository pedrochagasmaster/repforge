# Post-058 reconciliation of the Plans 049–057 audit

Revalidated 2026-09-29 against `origin/main`
`8aff328eeea0694f7ae5d7739e9d9168cc230b70`. This is PR #280's stage-3
reconciliation under the [merged clearance sequence](post-058-open-pr-clearance-sequence.md).
It changes documentation only. Six findings remain open; A05 is closed by
Plan 058. An open audit finding does not block merging this truthful record,
but its owning work must meet the disposition below before final acceptance.

## Baseline and authority

| Object | Pinned state at start |
|---|---|
| `origin/main` and #281 merge | `8aff328eeea0694f7ae5d7739e9d9168cc230b70` |
| #281 merged | 2026-09-29 21:48:31 UTC |
| #280 head | `45702f4fd75eaa59cfb1240e6c127e7b8f91838a` |
| #280 GitHub base SHA | `de0f7e619f14e2b61345879c16a6a90a76280f3d` |
| Current main ancestor of starting #280 head | No, `git merge-base --is-ancestor` exited 1 |
| #280 draft / mergeability | Non-draft / `CONFLICTING` |
| Root and audit worktrees | Clean before work; unrelated worktrees untouched |

The audit uses the existing clean worktree
`/home/ubuntu/.t3/worktrees/repforge/t3code-f38ff2b2`. Main was integrated by
merge commit `2f519e73`; the only conflict was the backlog's overhaul row.
The resolution retained #281's ordering. Published history was not rewritten.
The merged branch's production files are identical to the pinned main;
`git diff origin/main --name-only` before reconciliation listed only this audit.
Thus the production observations below concern that exact main source, not
an older audit branch's application. Clean-commit execution receipts also
bind the refreshed probes to the integrated and final audit heads.

Current merged `AGENTS.md`, `docs/ci.md`, backlog, clearance sequence, plan
index, Plans 058/059, implementation sequence, disposition register and
semantic contract were consulted. Historical plan-index/checkpoint status
lines do not reopen completed 058 or outrank #281. #268/#269 retain their
orientation cleanup. Plan 059 remains last and has not started. Independent review corrected A04
routing to stage 4 and the A03 code-location labels; both corrections were
verified against current code and #281 before the final candidate.

Complete starting open-PR inventory, fetched from GitHub:

| PR | Head SHA | Draft | Work |
|---|---|---|---|
| #280 | `45702f4fd75eaa59cfb1240e6c127e7b8f91838a` | No | This audit |
| #279 | `e519d689affe40cd49aa2697f65520bdcd94792a` | Yes | Onboarding tournament |
| #276 | `336b492d0db3bf1812070bef3f7d3112d7273384` | Yes | Landing redesign |
| #272 | `964f827effc6e8d16965b4193e7709bae4e83691` | Yes | Direction D |
| #271 | `525fabfaabae72d7a845505cfe9829f9ab01e573` | Yes | Rebase-journal write failure |
| #269 | `6dc6820a4fdfbfa0fa136722d3f79cc6e1be9aaf` | Yes | CLAUDE.md drift |
| #268 | `37d98affd573ed92cd1f53403866d1cd30ae0173` | Yes | Plan index |
| #258 | `ef49788f034d58adc9cd346cd0cfb9529eded15f` | Yes | History migration |
| #257 | `e013984ddbcbf1e5e4cd844f15f7f2c08652290e` | Yes | One-off domain |
| #255 | `db5819e221783f70a3eafe430a61fc1698a26d60` | Yes | Unsupported grammar measurement |

## Finding matrix

Every OPEN row means **OPEN — reproduced on
`8aff328eeea0694f7ae5d7739e9d9168cc230b70`**. Evidence is repeatable through
[the focused production probes](ui-overhaul-plans-049-057-reproduction.md).
They assert the observed defect rather than silently treating it as a passing
product contract. Current executable regression expectations belong to the
remediation owner; no product fix or retained suite was added here.

| Finding | Post-058 status | Executable evidence | Smallest next owner |
|---|---|---|---|
| A01, P1 | CLOSED by PR #284, fix commit `81e6e97bbc42bcccd2a2de4b2b4404e0cf849324` | `test/draftv2-staged-cas.mjs` rejects a second writer from the same predecessor and preserves the accepted aggregate through promotion and reload | No A01 follow-up |
| A02, P2 | OPEN | History RIR=2 saves to both replicas with `rirMeasured:false`; reload remains `insufficient / missing-effort`. Flag-only control yields `sufficient / improved / progress` | Narrow evidence-correctness fix in stage 4 before #255; preserve provenance for load/date-only edits |
| A03, P2 | OPEN | New York spring DST returns week 1 on March 9 and excludes today's session; block denominator also remains one week | Narrow evidence-correctness fix in stage 4 before #255; may share the A02 packet if ownership/proofs stay clear |
| A04, P2 | OPEN | Enter on both warm-up/working toggles leaves `BODY` focused in an open sheet; next Tab jumps to Substitute | Narrow stage-4 focus-continuity fix before #255; D retains this utility |
| A05, former P2 | CLOSED — fixed by #256, History convergence `dbf55da1`, with EN/PT computed typography proof | Catalog and external computed-root 200% both double data, headings and action labels; scaling survives reload | No fix. Preserve scaling proof in D and final 059 evidence |
| N01, P3 | OPEN | PT sheet still says `Quadríceps · 2 sets` | Direction D #272's retained exercise-actions copy |
| N02, P3 | OPEN | Live read-only Today Preview with an authoritative `effort_target@1` RIR 2–3 prescription shows sets/reps/muscle but no effort target | Direction D #272 decision 9 / Today preview retirement, with removal and no-draft evidence |

A01 was separate from #271. That PR made a failed lock-held **state-journal
rewrite** fail closed. It did not change the unlocked **draft-sidecar CAS** in
`compareAndSwapV2()` or `stageFor()`. PR #284 closes that distinct race.

## Current observations and closing contracts

### A01: concurrent staged DraftV2 commands lose acknowledged input (closed)

PR #284 fixes A01 in commit
`81e6e97bbc42bcccd2a2de4b2b4404e0cf849324`. The production owner remains
`durable-state.js`: `DraftStore.compareAndSwapV2()`, `writeSidecar()`,
`promote()`, and checkpoint handling. The regression in
`test/draftv2-staged-cas.mjs` uses the production dispatcher, storage,
journal, checkpoint, promotion, and boot path.

**Pre-fix evidence.** Exact `origin/main` was
`f7b516361ef1083b7395f144c613a32817706722`, the #271 merge. Test-only commit
`7352ca38acef488af3c63e7d89f843f37c7c31c0` pinned the regression there. With
a state journal pending, the test paused writer A before sidecar storage.
Writer B accepted a reps edit, then writer A accepted a load edit from the
same revision. Both returned `applied` and wrote revision 1. After promotion
and reload, canonical storage and the checkpoint kept reps 12 and lost load
80. Both sidecars were gone.

**Fix and closing evidence.** Staged acceptance now compares and writes under
the cross-tab `repforge:draft-write` lock. A second writer rechecks the latest
sidecar while holding that lock and returns the existing `stale` outcome if
its predecessor has advanced. Canonical commits and state-transaction
settlement acquire `repforge:state-write` before `repforge:draft-write`.
Promotion uses the draft lock and preserves a committed canonical aggregate
when a stale sidecar has the same or an older revision. Boot waits for
promotion to finish.

At fix commit
`81e6e97bbc42bcccd2a2de4b2b4404e0cf849324`, `test/draftv2-staged-cas.mjs` passed with both field
orders, with the stale writer arriving before and after sidecar publication,
and with a legitimate sequential edit from the accepted revision. It also
checks checkpoint absence, reload before promotion, failed sidecar write and
retry, stale-sidecar promotion, canonical state, checkpoint, and reload. The
focused storage and durable-outcome suites passed. The durable-outcome suite
retains #271's D4–D9 journal regression. The separate historical reproduction
record remains unchanged.

### A02: corrected RIR is omitted from canonical Strength evidence

Current owners are `history-ui.js:180–207`,
`historySessionFromWorkingCopy()`/`historyApplyWorkingInput()`, and
`app.js:8664–8708`, `strengthEvidenceRows()`/`strengthEvidenceRecords()`.
History and Progress-model bytes are unchanged by 058; the app still filters
`rirMeasured:false` to null at the evidence boundary.

A legacy missing-RIR row migrates to an unmeasured default. The actual
History Edit → RIR 2 → Save path persists RIR 2 with that false flag to
localStorage and IndexedDB. Reloading two comparable 50 kg sessions still
produces `insufficient`, reason `missing-effort`. A control changing only
that flag to true produces `sufficient`, outcome `improved`, normalized
recommendation `progress`. These records feed the rendered Strength evidence
and `strengthFactsByLift()` used by recovery evaluation.

The claim is deliberately narrower than “all progression ignores corrected
RIR.” `progressionHistory()` at `app.js:4804–4812` reads numeric RIR through
a separate path. The probe records the real recommendation before and after
the flag-only control; it remains `add2`, target 52.5, typical RIR 2. This
finding establishes missing canonical Strength/outcome evidence, not a
blanket inability of the progression engine to read RIR. It remains P2.

Closing proof must use real History controls, save both replicas, reload and
restore evidence. A load/date-only correction must keep missing effort
unmeasured. The shared evidence/provenance repair survives D and belongs in
a narrow stage-4 correctness packet before #255.

### A03: calendar weeks still use elapsed local milliseconds

Current owner is `progress-model.js`, `buildWeekStatus():264`, with the same
pattern in `elapsedWeekOf():218` for Review checkpoints,
Review lifecycle completion `:333`, this-week Volume `:430`, and
block-to-date Volume `:460`. No byte changed between `29fc1c36`
and post-058 main.

The browser clock is March 9, 2026, in `America/New_York`; the block starts
March 2. Local noon distance is 167 hours after spring DST, so flooring
elapsed milliseconds/86,400,000 gives six days. The real Volume evidence
returns March 2–8, week 1, and excludes the March 9 workout. Block-to-date
includes both sessions but plans only 3 sessions/36 sets over one elapsed
numbered week, instead of two weeks' 6/72. This is a reproduced scope and
denominator error, still P2, independent of cosmetic D work.

The small shared-model fix belongs before #255. Closing regression must use
a non-UTC DST boundary and prove week interval, included sessions, elapsed
planned quantities and completion boundary. This audit did not independently
exercise every affected lifecycle branch; the shared arithmetic locations
are an inspected blast radius, not additional executed failures.

### A04 and N01: retained exercise-actions sheet

Current owner is `app.js`, `renderExActionsSheet():6275–6353`.
Plan 058 migrated styling/control roles but retained the handler that writes
`#exActionsWarmupList.innerHTML` after a successful toggle. In a rendered
390px, reduced-motion PT context, keyboard Enter on Make warm-up leaves
`document.activeElement` as `BODY` while the sheet remains visible. The next
Tab focuses `#exActionSubstBtn`. The reverse working-set toggle also loses
focus. A04 remains P2; current source shape alone was not the proof.

The same live function at `:6291` still emits `${setsTotal} sets`; the PT
sheet renders `Quadríceps · 2 sets`. N01 remains P3. No i18n convergence
translated it. Closing proof is a complete localized count message plus
rendered PT output, and corresponding-control focus after both toggle roles.

D's published spec decision 11 retains exercise utilities; P5b restyles the
sheets. A04 is a behavioral focus defect on that retained command, so its
repair is useful across D. Under #281's focus rule it belongs to a narrow
stage-4 fix before #255, with actual keyboard continuity proof, not to deferred
redesign acceptance. N01 is presentation copy on the same restyled utility and
can be corrected in D P5b with rendered PT proof. A new visual recipe alone
repairs neither focus nor copy.

### A05: genuine enlarged History text now exists

**CLOSED — fixed by #256, commit
`dbf55da131f37fcdcd593c87d9fdb13884f8be0e`, with current executable evidence.**
That commit migrates History's fixed-pixel typography to rem-backed semantic
roles. Plan 058's other consumer migrations and P6 strict literal scan remove
the old premise that ordinary labels still use an unscaled pixel recipe.
P7's later computed-root fixes `faa0bc49` / `e5bca41c` and title correction
`0eec7203` strengthen enlarged-text layout evidence; they are not substituted
for measured typography here.

The probe calls the actual catalog `openPage()` with manifest `text200`,
then opens production History. It measures the text itself in EN and PT:

| Computed typography | Normal | 200% |
|---|---:|---:|
| Root | 16 px | 32 px |
| Set data / exercise name | 14 px | 28 px |
| Column headings | 11 px | 22 px |
| Session heading | 18 px | 36 px |
| Edit action | 16 px | 32 px |
| Delete action | 14 px | 28 px |

All assertions require exactly twice the normal computed size. The catalog
init script reapplies scale across reload; a separate external stylesheet
sets computed root to 32 px after removing inline sizing and yields the same
sizes. Thus this is enlarged user text, not a zoomed image or an unchanged
13 px row filed as text200. The old reproducer's assertion no longer applies.
The role/AA traversal and strict debt checker are stronger current 058 guards,
but the focused typography assertions supply the specific closure proof.

This closes A05's false-evidence claim, not physical-device text/accessibility
sign-off or universal absence of clipping. Those remain 059 obligations.

### N02: Today Preview still exists

Current owners `plannedPreviewModel()` / `previewExerciseRowHtml()` at
`app.js:6068–6082` still omit programmed RIR, contrary to
[Plan 055's read-only Preview contract](../plans/055-focus-only-workout.md#today-preview-boundary).
The probe activates the visible `#previewSession` action on a fresh seeded
program with an `effort_target@1` envelope specifying RIR 2–3 and no workout history. The probe asserts that envelope survives production normalization. The first row says
`Hack squat / 2 × 4–8 / Quadríceps`; no RIR is shown and no draft is created.

No merged 058 authority retired the route. Direction D's future decision 9
supersedes G-44 by removing Preview, but #272 has not landed. N02 is therefore
OPEN, not SUPERSEDED today. It should close through D's actual removal of the
action/route and owning evidence, rather than adding RIR to a soon-retired
preview. If D retains it, its owner must fulfill the current contract instead.

## Verification and handoff

The repeatable probes and extraction instructions are in the linked
[reproduction record](ui-overhaul-plans-049-057-reproduction.md). Their
assertions cover every OPEN and CLOSED disposition. The clean integrated
source receipts were produced with `tools/record-verification.mjs`; final
clean-head receipts, independent review and exact-head candidate evidence
belong on [PR #280](https://github.com/pedrochagasmaster/repforge/pull/280).
The merge identity is added there only after the authorized merge.
No historical green result below is reused as current candidate evidence.

Current checks include `git diff --check`, canonical contradiction checking,
disposition/document-link checking and the affected selector. The old
canonical “Next rows remain scheduled” failure was repaired by merged #281;
it passes on this baseline. Only allowlisted Markdown is changed, so affected
selection requires no application suites; exact-SHA remote candidate remains
the mandatory broad boundary. Focused probes are additional disposition proof,
not a claim that every browser suite was rerun locally.

During probe development, two harness errors were corrected, a wrong outcome
property and a wrong delete selector. An overlapping preview briefly made the
selector see generated shell config and select the broad packet; that run was
interrupted, generated shell bytes restored, and selection rerun after cleanup.
None is reported as a green application regression result.

Next exact stage remains #268/#269 repository orientation, then integrated
#271 and stage-4 safety/correctness/focus fixes A01–A04, before #255 and the redesign
train. N01/N02 belong to D's owning UI acceptance. Preserve #281's remaining
Now work and landing → D → onboarding → #258 → #257 → convergence → 059
sequence. No remediation, redesign or later PR was started here.

## Historical pre-058 audit

The following is the original 2026-09-26 record at `29fc1c36`. Its locations,
severities, “current” statements and command results describe that old source
only. The post-058 matrix and observations above govern current dispositions.

## Audit of merged UI overhaul Plans 049–057

Review date: 2026-09-26. Baseline: `63c57c1e`. Integrated head: `29fc1c36180abec3ff1839e4889f6d44a39fa6dc`.

The integrated work has one reproduced data-loss defect, three reproduced functional/accessibility defects, and one material enlarged-text verification gap. Two smaller Plan 055 omissions remain. Passing merged-head checks do not cover these cases.

### Scope and coverage

| Plan | Main PR | Merge | Audit coverage and result |
|---|---|---|---|
| 049 | [#222](https://github.com/pedrochagasmaster/repforge/pull/222) | `8e40544703e3` | Canonical contracts, evidence protocol, downstream consumers and checker. No new runtime defect isolated to this plan. Current checker fails on an authorized later backlog change; see evidence notes. |
| 050 | [#227](https://github.com/pedrochagasmaster/repforge/pull/227) | `3fbae92fcee5` | Catalog collector, negative controls, text-scale mechanism, later consumers. A05 limits current scaling evidence. |
| 051 | [#226](https://github.com/pedrochagasmaster/repforge/pull/226) | `c3491c5e1eb6` | Draft CAS, checkpoints, staged writes, actual multi-tab persistence/reload. A01 loses acknowledged input. |
| 052 | [#228](https://github.com/pedrochagasmaster/repforge/pull/228) | `e3c798855c6f` | Transition/recovery contracts and current commit consumer. Pure transition tests and production commit suite passed; no additional confirmed defect. |
| 053 | [#235](https://github.com/pedrochagasmaster/repforge/pull/235) | `bad6cc9d04fd` | Clone, import/boot/recovery source paths, client limits and acceptance discussion. Client/contract/limits tests and production clone suite passed; no additional confirmed defect. Staging and physical claims were read, not repeated. |
| 054 | [#241](https://github.com/pedrochagasmaster/repforge/pull/241) | `87833ded1e92` | Entry contract, received setup/activation paths, PR evidence and current entry code. No additional confirmed defect. Full entry matrix was not rerun. |
| 055 | [#243](https://github.com/pedrochagasmaster/repforge/pull/243) | `412504849dd9` | Preview, Focus navigation, exercise actions, keyboard continuity and PT copy. A04, N01, N02. |
| 056 | [#244](https://github.com/pedrochagasmaster/repforge/pull/244) | `52c0cea2ea5c` | Canonical effort evidence, numbered-week scopes, denominators and lifecycle consumers. A02/A03. |
| 057 | [#248](https://github.com/pedrochagasmaster/repforge/pull/248) | `4c79af73c0c3` | History working copy/save/delete, Share repair/validation, summary and management consumers. A02 and A05. |

The durable-state bridge in #240 was included because it moved the Plan 051 implementation. Intervening changes were checked when they affected attribution. This is targeted adversarial review across all nine plans, not exhaustive execution of every suite, screen, or device matrix.

### Act on: correctness and spec

#### A01 · P1 · Concurrent staged draft commands lose acknowledged input

Location: `durable-state.js:335–343`, with promotion at `:559–577`. The same unlocked staging branch exists in Plan 051's original merged `app.js` at `c3491c5e`, before #240 extracted it.

When a durable-state journal is pending, `compareAndSwapV2()` calls `stageFor()` before acquiring the state lock. Reading the current revision, comparing it, and writing a sidecar are separate operations. Two tabs can both accept successors of revision 0. Promotion selects one whole aggregate and clears the other sidecar.

Production reproduction:

1. Start a workout and open it in two tabs.
2. Hold `repforge:state-write` and queue a real durable-state commit.
3. Pause tab A immediately before its sidecar `setItem`, after its revision comparison.
4. Tab B edits reps to 12 and receives `applied`.
5. Release A; its load edit to 80 also receives `applied`.
6. Release the state lock and reload.

Observed sidecars both had revision 1: one contained load 80 and reps 4; the other contained null load and reps 12. Canonical storage and reload contained null load and reps 12. The acknowledged load edit disappeared.

The pause is an isolated scheduling barrier at the storage write, not a replacement CAS implementation. The script uses the production dispatcher, journal creation, staging, promotion, and boot. The ordinary storage suite still passes.

Requirement: Plan 051's stale-tab CAS and exact aggregate preservation; root AGENTS.md requires draft commands to use a cross-tab lock.

Disposition: CLOSED by PR #284, fix commit
`81e6e97bbc42bcccd2a2de4b2b4404e0cf849324`. The pre-fix failure was pinned
on #271 main by test commit `7352ca38acef488af3c63e7d89f843f37c7c31c0`.
The closing regression is `test/draftv2-staged-cas.mjs`; it checks same-revision
rejection, sequential writes, the pending transaction path, sidecar publication,
checkpoint, canonical promotion, failure and retry, and reload. A02, A03, and
A04 remain open in the current matrix.

#### A02 · P2 · History RIR corrections remain excluded from strength evidence

Location: `history-ui.js:191` and `:201`; consumer `app.js:8663`.

Missing historical RIR migrates to `rirMeasured:false`. Editing that RIR to 2 through History updates `rir` but preserves the false provenance flag. Saving and reloading produces `{rir:2, rirMeasured:false}`. With two otherwise comparable sessions, the real Strength producer still reports `insufficient`, reason `missing-effort`.

The specialist's independent control changed only that flag and obtained `sufficient / improved`. The lead independently reran the save/reload failure. The defect is present in #248 and affects Plan 056's canonical evidence and downstream eligibility.

Requirement: Plan 057's explicit historical correction must remain consistent with Plan 056's canonical evidence producer.

Closing evidence: edit missing RIR through the actual History controls, save, verify both replicas, reload, and assert restored evidence. Also prove a load-only or date-only edit does not falsely mark an unmeasured default RIR as measured.

The browser reproduction used a persisted legacy session, edited it through History, saved, reloaded, and queried the production Strength evidence hook. The DST case used the production Progress model in an `America/New_York` context.

#### A03 · P2 · Spring DST selects the previous numbered week

Location: `progress-model.js:264`, also `:216`, `:333`, `:430`, and `:460`.

The new model computes calendar-day distance by flooring elapsed local-noon milliseconds divided by 86,400,000. In `America/New_York`, March 2 to March 9, 2026 spans 167 hours because daylight-saving time begins in between. The model counts six days.

With a March 2 block start and today set to March 9, the production Volume consumer selects week 1, March 2–8, and excludes the workout logged today. Week 2 should be March 9–15. The same arithmetic also affects elapsed denominators and lifecycle boundaries. The new model contains this defect in the original #244 merge; older app code has similar arithmetic.

Requirement: Plan 056's exact numbered-week scope and denominators.

Closing evidence: use calendar-day arithmetic and a real non-UTC browser test across spring DST. Assert the current-week interval, included sessions, block-to-date denominator, and completion boundary.

The browser reproduction used a persisted legacy session, edited it through History, saved, reloaded, and queried the production Strength evidence hook. The DST case used the production Progress model in an `America/New_York` context.

#### A04 · P2 · Warm-up toggle destroys keyboard focus

Location: `app.js:6335–6347`.

Focus the exercise-actions **Make warm-up** button and press Enter. After the command succeeds, `renderExActionsSheet()` replaces the focused button through `innerHTML`. `document.activeElement` becomes `BODY` while the modal remains open. The next Tab returns to **Substitute exercise**, before the set controls, rather than preserving the user's position.

This implementation was introduced by Plan 055. Next/Previous exercise arrows also lose focus when their container is rebuilt, but that behavior predates the overhaul; it is a retained parity gap rather than a newly introduced regression. Session-map jumps correctly return focus to `#sessionSheetBtn` and are not included in this finding.

Requirement: Plan 055's keyboard parity and correct sheet focus behavior.

Closing evidence: preserve or restore focus to the corresponding set control after rendering. Assert focus and next Tab position after both warm-up and working-set toggles. Cover the navigation-arrow continuity separately.

The browser reproduction ran at 390px with reduced motion. It used keyboard activation, inspected `document.activeElement`, and checked the next Tab destination.

### Act on: verification standards

#### A05 · P2 · “200% text” captures leave important text unscaled

Location: `tools/ui-screens/session.mjs:133–141`; concrete current consumer `styles.css:2634–2641`.

The catalog enlarges only the root font. Plan 057's History headings and rows use fixed pixel fonts. In a real History read view, changing the root from 16px to 32px leaves `.history-read__row` at 13px. The frame can be filed as text200 and pass overflow checks without exercising enlarged set data. Other pixel-sized labels have the same limitation.

This does not establish that every screen clips under actual text enlargement. It establishes that the current evidence cannot support that claim. Plan 050 supplied this matrix and Plan 057 depends on it for scaled History coverage.

Requirement: Plan 050's enlarged-text catalog evidence and Plan 057's compact/scaled/localized management frames.

Closing evidence: make relevant typography respond to the declared scale, or use a verified scaling method covering fixed-pixel text. Assert representative computed text sizes before evaluating reflow. Include History set data, headings, and action labels at 200% in EN and PT.

The production-backed browser probe measured `.history-read__row` at 13px with a 16px root, then again at 13px after changing the root to 32px.

### Smaller spec omissions

- **N01 · P3 · Untranslated set count.** `app.js:6288` hardcodes `${setsTotal} sets`. The PT exercise-actions sheet renders `Quadríceps · 2 sets`. Introduced by Plan 055. Use a complete translated message with count handling and assert PT rendered copy. The browser reproduction rendered `Quadríceps · 2 sets` in PT.
- **N02 · P3 · Preview omits programmed RIR.** `app.js:6068–6077` drops RIR from the preview model and renders sets × reps, muscle, notes, and selected recommendation text. Plan 055 line 137 explicitly includes programmed RIR. The fresh seeded preview displays `Hack squat2 × 4–8Quads`; no RIR is shown. Add the canonical programmed effort target without creating draft state. This is a source-backed spec omission, not a demonstrated persistence defect.

### Evidence audit and exclusions

All nine fetched PR heads have successful remote checks. PR bodies and comments were fetched from GitHub during the audit. These historical checks do not establish the current integrated result or the adversarial cases above.

The Plan 053 body and repository handoff documents describe older open staging/device gates. The [later acceptance comment](https://github.com/pedrochagasmaster/repforge/pull/235#issuecomment-5637065102) explicitly supersedes them and records all 34 gates closed. This audit does not classify those gates as missing based on stale text. It also does not independently certify the physical-device claims. The restored-provider-image gate deserves a precise artifact reference: the comment's S7 evidence describes purge/enumeration, which is narrower than demonstrating restored-image behavior.

Plans 055 and 056 PR bodies record owner preview approval and explicitly say VoiceOver/TalkBack was not performed. Preserve that distinction. Plan 054 and 057 descriptions retain stale draft/unmerged or open-review wording. Their merge state is known; the stale wording alone does not prove a missing owner approval. Plans 058/059 retain their separate convergence and release obligations.

Current `node tools/check-canonical-contradictions.mjs --check` fails with `FAIL: backlog: Next rows remain scheduled`. The checker at line 530 rejects every `| Next |` row. The current backlog's line 223 intentionally promotes exercise aliases to Next through later #249. Treat this as an outdated checker assumption after an authorized strategy change, not a reason to revert that strategy or a runtime defect in #222. Reconcile the checker with the current backlog contract.

Speculative repeat-last concerns, broad refactor preferences, and already-corrected Share/custom-delete race reports were not promoted to findings. No new Plan 052/053 blocker was established by this review.

### Commands and results

| Execution at the pinned integrated head | Result |
|---|---|
| `node tools/run-tests.mjs fast` | 49/49 passed |
| `node tools/run-tests.mjs entry --suite ui-catalog-contract --evidence /tmp/overhaul-audit/catalog-proof.json` | Passed, including deliberate invalid artifacts |
| `node tools/run-tests.mjs state --suite workout-draft-storage --evidence /tmp/overhaul-audit/draft-storage-proof.json` | Passed despite A01 |
| `node tools/run-tests.mjs state --suite program-transition-commit --evidence /tmp/overhaul-audit/transition-proof.json` | Passed |
| `node tools/run-tests.mjs state --suite install-transfer-clone --evidence /tmp/overhaul-audit/clone-proof.json` | Passed |
| `node tools/check-canonical-contradictions.mjs --check` | Failed on outdated Next-row assertion |
| Custom browser probes described above | Reproduced A01–A05 and N01; Preview output supports N02 |

No production source was edited, no commits or remote comments were created, and no candidate CI was dispatched. Test dependencies were installed under `test/`. Test runners temporarily generated local preview configuration and restored it on cleanup. The workspace was clean at completion. Focused reproduction scripts and logs remained in `/tmp` and are not part of this report artifact.

### Review independence and limits

A focused GPT-6 Sol XHigh reviewer examined foundations. Two additional reviewers examined entry/Focus and Progress/management. The latter reviewers inherited the parent model; this was not a full run of the interrogate skill's unavailable default model lineup. Two reviewers hit the provider usage limit before final summaries. Their useful findings were retained, and the lead continued the audit and independently reproduced the five principal findings.

A01 came from the foundation review and was proved by the lead. A02/A03 came from the management review and were rerun by the lead. A04/N01 came from the Focus review and were rerun by the lead. A05 and the checker failure were found by the lead. Agreement was not used as a substitute for reproduction.

This review does not certify a clean release. It did not rerun the exhaustive candidate gate, the full screenshot catalog, authenticated Cloudflare staging, or physical Safari/PWA/VoiceOver/Android/TalkBack journeys. “No additional confirmed defect” means none was established in the inspected scope, not that a plan is defect-free.
