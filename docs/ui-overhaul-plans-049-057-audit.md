# Audit of merged UI overhaul Plans 049–057

Review date: 2026-09-26. Baseline: `63c57c1e`. Integrated head: `29fc1c36180abec3ff1839e4889f6d44a39fa6dc`.

The integrated work has one reproduced data-loss defect, three reproduced functional/accessibility defects, and one material enlarged-text verification gap. Two smaller Plan 055 omissions remain. Passing merged-head checks do not cover these cases.

## Scope and coverage

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

## Act on: correctness and spec

### A01 · P1 · Concurrent staged draft commands lose acknowledged input

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

Closing evidence: reproduce this pending-journal, two-writer interleaving in the owning browser suite. At most one command may accept the same predecessor revision. The other must remain visibly stale/recoverable, or be reapplied against the acknowledged successor. Verify canonical storage, checkpoint, staged artifacts, and reload. Preserve the existing state-transaction conflict behavior when introducing serialization.

The controlled reproduction used the production draft dispatcher and lock, with a scheduling barrier immediately before sidecar storage. It recorded both accepted revisions and the post-reload aggregate.

### A02 · P2 · History RIR corrections remain excluded from strength evidence

Location: `history-ui.js:191` and `:201`; consumer `app.js:8663`.

Missing historical RIR migrates to `rirMeasured:false`. Editing that RIR to 2 through History updates `rir` but preserves the false provenance flag. Saving and reloading produces `{rir:2, rirMeasured:false}`. With two otherwise comparable sessions, the real Strength producer still reports `insufficient`, reason `missing-effort`.

The specialist's independent control changed only that flag and obtained `sufficient / improved`. The lead independently reran the save/reload failure. The defect is present in #248 and affects Plan 056's canonical evidence and downstream eligibility.

Requirement: Plan 057's explicit historical correction must remain consistent with Plan 056's canonical evidence producer.

Closing evidence: edit missing RIR through the actual History controls, save, verify both replicas, reload, and assert restored evidence. Also prove a load-only or date-only edit does not falsely mark an unmeasured default RIR as measured.

The browser reproduction used a persisted legacy session, edited it through History, saved, reloaded, and queried the production Strength evidence hook. The DST case used the production Progress model in an `America/New_York` context.

### A03 · P2 · Spring DST selects the previous numbered week

Location: `progress-model.js:264`, also `:216`, `:333`, `:430`, and `:460`.

The new model computes calendar-day distance by flooring elapsed local-noon milliseconds divided by 86,400,000. In `America/New_York`, March 2 to March 9, 2026 spans 167 hours because daylight-saving time begins in between. The model counts six days.

With a March 2 block start and today set to March 9, the production Volume consumer selects week 1, March 2–8, and excludes the workout logged today. Week 2 should be March 9–15. The same arithmetic also affects elapsed denominators and lifecycle boundaries. The new model contains this defect in the original #244 merge; older app code has similar arithmetic.

Requirement: Plan 056's exact numbered-week scope and denominators.

Closing evidence: use calendar-day arithmetic and a real non-UTC browser test across spring DST. Assert the current-week interval, included sessions, block-to-date denominator, and completion boundary.

The browser reproduction used a persisted legacy session, edited it through History, saved, reloaded, and queried the production Strength evidence hook. The DST case used the production Progress model in an `America/New_York` context.

### A04 · P2 · Warm-up toggle destroys keyboard focus

Location: `app.js:6335–6347`.

Focus the exercise-actions **Make warm-up** button and press Enter. After the command succeeds, `renderExActionsSheet()` replaces the focused button through `innerHTML`. `document.activeElement` becomes `BODY` while the modal remains open. The next Tab returns to **Substitute exercise**, before the set controls, rather than preserving the user's position.

This implementation was introduced by Plan 055. Next/Previous exercise arrows also lose focus when their container is rebuilt, but that behavior predates the overhaul; it is a retained parity gap rather than a newly introduced regression. Session-map jumps correctly return focus to `#sessionSheetBtn` and are not included in this finding.

Requirement: Plan 055's keyboard parity and correct sheet focus behavior.

Closing evidence: preserve or restore focus to the corresponding set control after rendering. Assert focus and next Tab position after both warm-up and working-set toggles. Cover the navigation-arrow continuity separately.

The browser reproduction ran at 390px with reduced motion. It used keyboard activation, inspected `document.activeElement`, and checked the next Tab destination.

## Act on: verification standards

### A05 · P2 · “200% text” captures leave important text unscaled

Location: `tools/ui-screens/session.mjs:133–141`; concrete current consumer `styles.css:2634–2641`.

The catalog enlarges only the root font. Plan 057's History headings and rows use fixed pixel fonts. In a real History read view, changing the root from 16px to 32px leaves `.history-read__row` at 13px. The frame can be filed as text200 and pass overflow checks without exercising enlarged set data. Other pixel-sized labels have the same limitation.

This does not establish that every screen clips under actual text enlargement. It establishes that the current evidence cannot support that claim. Plan 050 supplied this matrix and Plan 057 depends on it for scaled History coverage.

Requirement: Plan 050's enlarged-text catalog evidence and Plan 057's compact/scaled/localized management frames.

Closing evidence: make relevant typography respond to the declared scale, or use a verified scaling method covering fixed-pixel text. Assert representative computed text sizes before evaluating reflow. Include History set data, headings, and action labels at 200% in EN and PT.

The production-backed browser probe measured `.history-read__row` at 13px with a 16px root, then again at 13px after changing the root to 32px.

## Smaller spec omissions

- **N01 · P3 · Untranslated set count.** `app.js:6288` hardcodes `${setsTotal} sets`. The PT exercise-actions sheet renders `Quadríceps · 2 sets`. Introduced by Plan 055. Use a complete translated message with count handling and assert PT rendered copy. The browser reproduction rendered `Quadríceps · 2 sets` in PT.
- **N02 · P3 · Preview omits programmed RIR.** `app.js:6068–6077` drops RIR from the preview model and renders sets × reps, muscle, notes, and selected recommendation text. Plan 055 line 137 explicitly includes programmed RIR. The fresh seeded preview displays `Hack squat2 × 4–8Quads`; no RIR is shown. Add the canonical programmed effort target without creating draft state. This is a source-backed spec omission, not a demonstrated persistence defect.

## Evidence audit and exclusions

All nine fetched PR heads have successful remote checks. PR bodies and comments were fetched from GitHub during the audit. These historical checks do not establish the current integrated result or the adversarial cases above.

The Plan 053 body and repository handoff documents describe older open staging/device gates. The [later acceptance comment](https://github.com/pedrochagasmaster/repforge/pull/235#issuecomment-5637065102) explicitly supersedes them and records all 34 gates closed. This audit does not classify those gates as missing based on stale text. It also does not independently certify the physical-device claims. The restored-provider-image gate deserves a precise artifact reference: the comment's S7 evidence describes purge/enumeration, which is narrower than demonstrating restored-image behavior.

Plans 055 and 056 PR bodies record owner preview approval and explicitly say VoiceOver/TalkBack was not performed. Preserve that distinction. Plan 054 and 057 descriptions retain stale draft/unmerged or open-review wording. Their merge state is known; the stale wording alone does not prove a missing owner approval. Plans 058/059 retain their separate convergence and release obligations.

Current `node tools/check-canonical-contradictions.mjs --check` fails with `FAIL: backlog: Next rows remain scheduled`. The checker at line 530 rejects every `| Next |` row. The current backlog's line 223 intentionally promotes exercise aliases to Next through later #249. Treat this as an outdated checker assumption after an authorized strategy change, not a reason to revert that strategy or a runtime defect in #222. Reconcile the checker with the current backlog contract.

Speculative repeat-last concerns, broad refactor preferences, and already-corrected Share/custom-delete race reports were not promoted to findings. No new Plan 052/053 blocker was established by this review.

## Commands and results

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

## Review independence and limits

A focused GPT-6 Sol XHigh reviewer examined foundations. Two additional reviewers examined entry/Focus and Progress/management. The latter reviewers inherited the parent model; this was not a full run of the interrogate skill's unavailable default model lineup. Two reviewers hit the provider usage limit before final summaries. Their useful findings were retained, and the lead continued the audit and independently reproduced the five principal findings.

A01 came from the foundation review and was proved by the lead. A02/A03 came from the management review and were rerun by the lead. A04/N01 came from the Focus review and were rerun by the lead. A05 and the checker failure were found by the lead. Agreement was not used as a substitute for reproduction.

This review does not certify a clean release. It did not rerun the exhaustive candidate gate, the full screenshot catalog, authenticated Cloudflare staging, or physical Safari/PWA/VoiceOver/Android/TalkBack journeys. “No additional confirmed defect” means none was established in the inspected scope, not that a plan is defect-free.
