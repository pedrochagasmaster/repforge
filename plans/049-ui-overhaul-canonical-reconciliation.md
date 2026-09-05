# Plan 049: UI overhaul canonical reconciliation

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).

- **Plan number:** 049
- **Phase:** 0 — Canonical reconciliation
- **Status:** Planned; implementation has not started
- **Owner approval state:** Product direction is approved in `docs/ui-audit.md`; the two explicit owner gates below remain open
- **Depends on:** Owner approval of the planning PR; `origin/main` containing the consolidated audit
- **Blocks:** Plans 050–059
- **Governing G decisions:** G-01–G-88 (canonical disposition); especially G-01–G-08, G-13–G-14, G-17, G-24, G-28, G-38–G-40, G-46, G-55–G-56, G-70–G-71, G-74–G-88
- **Governing UI findings:** UI-01–UI-32 as a reconciliation register; no production finding is implemented here
- **Affected surfaces:** Product documentation, ADRs, plan index, brand and privacy contracts, test policy, all later overhaul phases
- **Complexity:** High
- **Risk:** High — contradictory contracts would make later implementation unsafe

## Problem statement

The owner-approved audit changes several contracts that current canonical documents still describe differently. The conflicts are not permission to rewrite history: implemented plans and accepted ADRs must remain truthful records, while current guidance must identify the newer decision and its scope. This phase establishes one executable contract for the overhaul before dependent code consumes ambiguous rules.

The planning baseline is `origin/main` at `09772f91b86549f71a5d845a7c74849569d592b6`. The audit baseline was `fe4bf52c`, with 72 manifest screens and 221 frames. Current main has the same 72/221 catalog; the only changes after `fe4bf52c` are the consolidated audit and its extraction/check tooling. Current cache and script revisions are `v175`; implementation must re-read them rather than rely on the older number in repository guidance.

## Approved direction

`docs/ui-audit.md` is the current product-direction source. Phase 0 must:

- make every G-01–G-88 decision discoverable and non-contradictory;
- preserve the protected Taurifer identity, core loop, safety language, explicit activation, local-first boundary, and screen catalog;
- supersede conflicting portions of older contracts without deleting their historical record;
- specify the bounded workout, transition, recovery-week, design-role, and temporary install-transfer contracts used later;
- keep unrelated post-Wave-3 work deferred;
- retain an owner decision wherever the audit itself leaves one open.

The temporary one-hour install transfer is an approved, narrow exception to the static/local-first architecture. It is not an account, synchronization, backup, publishing, or generalized API platform.

## Preserved strengths

Preserve Taurifer's identity; warm paper/ink/burnt-orange palette; token-swap dark theme; Sans/Mono roles; licensed art on its paper and intentional empty tiles; Today → workout → save → summary; Focus hierarchy and `Why this weight?`; deterministic-generation language; adjacent validation and pain boundaries; explicit activation; local-first architecture outside the one-hour exception; and the screen catalog as visual truth. Every later plan inherits this list.

## Non-goals

- No production JavaScript, CSS, HTML, service worker, backend, telemetry, or catalog image changes.
- No landing visual selection, UI implementation, transfer deployment, or recovery-week activation.
- No reopening settled G decisions or source-audit findings rejected by the consolidated register.
- No general lifecycle observability, publisher attribution, one-off workouts, multi-gym, Pro, payments, AI, cloud sync, or native work.
- No retroactive editing of old commit history or deletion of historical ADR/plan rationale.

## Current-state audit

### Governing-document conflicts

| Current contract | Conflict to reconcile | Required Phase 0 disposition |
|---|---|---|
| `docs/backlog.md` | The post-Wave-3 queue and launch-readiness ordering precede the owner-approved overhaul; Focus/List and Progress redesigns are still evidence-only or later | Make the overhaul the active initiative; preserve unrelated items as deferred; authorize only the audit-bounded transition work |
| `plans/README.md` | Ends at Plan 048 and presents the previous order as current | Register Plans 049–059, their phase mapping, dependencies, and the plans now historical where they conflict |
| ADR 0005 | Install promotion assumes the old first-run sequence and no late-data transfer | Add a superseding ADR/decision section for G-39, G-48, G-71–G-72, and G-84–G-88; retain historical context |
| ADR 0006 | Protects the full Milo/ethos first-run treatment | Supersede only the landing contract with G-09, G-18–G-21, G-51, and G-73; preserve brand identity elsewhere |
| ADR 0007 | Places privacy prose in Share and states a broad no-backend boundary | Preserve setup-link format, cookie, and confirmation boundary; move Privacy to the in-app page and distinguish the separate opaque install-transfer token/service |
| ADR 0009 | Defines token-swap dark theme | Reaffirm it; add no conflicting theme mechanism |
| ADR 0010 | Governs the old validation sequence | Record the owner-approved overhaul as the current priority while keeping later commercial/platform gates deferred |
| `docs/brand-guide.md` | Full poem/Milo landing, strict no-card/no-shadow language, old install/Share privacy wording, and unqualified “never uploads” wording | Preserve palette/type/art rules; replace the affected landing, elevation, privacy, install, progress-role, and accessibility policies |
| `docs/program-entry-flow.md` and Plans 047–048 | Separate recommendation result/preview and old first-run/install/tour behavior | Preserve candidate-draft and explicit activation contracts; specify the merged recommendation/preview and adaptive landing |
| `docs/progression-strategy-contract.md` and progression docs | Correctly prohibit implicit deload/target mutation but do not define the new explicit recovery schedule | Keep progression engines unchanged; define recovery as a confirmed, versioned schedule policy outside strategy math |
| `docs/design/ui-overhaul-spec.md`, Plan 013, and dual-mode specs/tests | Preserve List mode or describe an earlier visual-only overhaul | Mark as historical/superseded where they conflict; Phase 4 owns deletion only after Plan 051 removes hidden DOM state |
| `AGENTS.md`, UI-screen and tools documentation | Broad local-only/privacy wording and old cache-version examples; no new matrix requirements | Qualify the narrow transfer exception, make cache numbers non-normative, and document the risk-based catalog/overflow policy |

### Current technical anchors

- Durable state is mirrored under `repforge_v1` in localStorage and IndexedDB `repforge/kv`; active workout drafts use `repforge_draft_v1` in localStorage.
- UI preferences use `repforge_ui_v1`; telemetry consent and identity use `repforge_telemetry_enabled_v1` and `repforge_telemetry_identity_v1`.
- Candidate program entry uses `repforge_program_setup_draft_v1` and remains non-durable until explicit activation.
- `commitProgramReplacement()` and the `_storageDraftTransaction` protocol are the existing atomic program/draft replacement boundary.
- `program-compiler.js` already emits compiler and family provenance; archived programs do not yet carry a complete transition record.
- `styles.css` uses token-swap dark mode but has literal radius/elevation/control variants that need a named role contract.
- The screen catalog has 31 `standard`, 26 `localized`, 7 `accessibility`, and 8 `customAccessibility` states, totaling 221 frames.

## Architecture contracts to publish

### Canonical decision and finding register

Publish a machine-checkable or mechanically checkable table assigning every G decision and every UI finding to one of:

- `specified-here`;
- `implemented-by-plan-NNN`;
- `split`, with one contract owner and named consumers;
- `preserved-strength`;
- `rejected-or-closed-by-audit`;
- `owner-gated`.

There must be one contract owner for each mutable concern. Cross-cutting verification in Plan 059 is not a second implementation owner.

### Preliminary semantic design roles

Later phases may add UI only through documented semantic roles. Phase 0 must name, define, and test the intended meaning of at least:

- elevation: page/flat, selected, floating, modal, and persistent-action;
- radius: compact control, standard control, surface, and pill;
- typography: language/control Sans roles and training-data/technical Mono roles, with bounded size/line-height steps;
- controls: primary action, secondary action, quiet navigation, destructive action, selection, disabled action, and intentional horizontal scroller;
- progress: block progress, weekly completion, exercise/set progression, and onboarding/task progress;
- semantic color: accent/action, success/improved, warning/declined, neutral/maintained, focus, disabled, boundary, and decorative rule.

Names may follow the repository's existing token style, but meanings cannot change per feature. Phase 7 owns the full inventory and migration. Earlier phases own only the roles they consume.

### Logical clone schema

Specify a versioned `taurifer-install-transfer` envelope. It must be a logical clone, not a raw storage dump. At minimum it contains:

- normalized durable state from `repforge_v1`, excluding storage revisions, write-ahead records, locks, and in-flight transaction markers;
- the active workout draft after migration to the Plan 051 schema, or explicit absence;
- device/UI preferences from `repforge_ui_v1`;
- analytics consent;
- the stable telemetry identity;
- a schema version, creation time, source context, and integrity metadata.

Phase 0 must decide and document whether an unfinished program-entry candidate is user-authored durable intent and therefore included. The default proposed disposition is **included as a separately versioned candidate section**, because losing an active build/import draft would violate “exact logical clone”; it must still retain its no-program-persistence boundary. Notification permission, service-worker/cache state, OS install state, locks, pending journals, storage revision counters, `_storageDraftTransaction`, `_storageSetupActivation`, claim cookies, PostHog session state, and other volatile runtime state are excluded.

Each section is independently parsed and validated at the import boundary. Unknown required schema versions stop the import; unknown optional sections are retained only if the schema explicitly permits round-tripping. No implementation may enumerate browser storage and upload arbitrary keys.

### Temporary iOS install-transfer service

Specify the minimum isolated service, preferably under a non-root service directory with its own deployment tooling so the static PWA remains dependency-free. If the infrastructure provider is not already owner-approved, selection is an owner gate.

#### Endpoint contract

The specification must define equivalent operations to:

1. `POST /v1/transfers`: accept one validated encrypted logical clone over TLS; return an opaque bearer token and absolute expiry.
2. `POST /v1/transfers/{token}/claims`: atomically bind an available transfer to a client-generated claim ID and return the clone to that same claim on safe retries.
3. `DELETE /v1/transfers/{token}/claims/{claimId}` or an equivalent commit operation: delete encrypted payload immediately after the client proves atomic local import.
4. Expiry processing: delete payload no later than one hour after creation, independent of client activity.

An implementation may use different URL shapes only if the threat, retry, and deletion semantics are identical and recorded in the governing ADR.

#### Security and privacy requirements

- Generate at least 256 bits of cryptographically secure token entropy; store only a keyed digest of the token.
- Encrypt each payload at rest with authenticated encryption and managed key rotation; TLS is mandatory in transit.
- Treat the bearer as sensitive: never emit it or payload content in logs, analytics, error tracking, referrers, or URLs visible to unrelated origins.
- Apply exact-origin CORS, `Cache-Control: no-store`, content-type enforcement, schema/depth/size bounds, rate limits, and constant-shape invalid/expired responses.
- Prevent replay with an atomic `available → claiming → deleted/expired` state machine. A second claim ID never receives the payload. The bound claim may retry only until commit or expiry.
- The iOS handoff cookie carries only the opaque install-transfer token, never the clone. It is distinct from the historical `repforge_setup_v1` setup-proposal cookie and must use the matching HTML path, short lifetime, `SameSite=Lax`, and `Secure` outside localhost.
- Disclose that the temporary service operator can process the decrypted clone, that the opaque token is sent with the matching HTML request, and that payload deletion occurs on claim or within one hour.

Threat modeling must cover token theft, brute force, replay, log/referrer leakage, malicious or stale tabs, service/operator access, oversized or malformed payloads, cross-origin requests, interrupted claims, clock skew, expiration backlog, and compromise of encryption keys. Operational documentation must include expiry-job monitoring, deletion latency, key rotation, incident handling, cost/retention bounds, and a feature kill switch.

#### Claim, import, and recovery protocol

The client creates a random claim ID and obtains a server claim lease. It validates the complete envelope before touching live state, stages both the incoming clone and the pre-import local snapshot, and acquires the existing cross-tab storage lock. A versioned import marker makes boot either finish the complete import or restore the complete pre-import snapshot; partial visibility is prohibited. Only after a verified local read-back does the client commit the remote claim, causing immediate payload deletion.

If the process stops before local commit, the same claim ID can retry. If it stops after local commit but before remote deletion, boot verifies the import and retries the delete. A different or duplicate claimant sees a non-disclosing terminal state. Invalid or expired tokens leave local data unchanged.

Safari retains its original local state. Once the installed app reports a successful claim, Safari is marked as a recovery snapshot rather than silently continuing as an independent active copy. Resuming ordinary browser use requires an explicit divergence warning and confirmation. There is no reverse merge or synchronization.

Emit `late_install_transfer` only after successful local import, under the transferred telemetry identity and consent, with browser-versus-standalone context and coarse outcome fields. Never include the token, data size granular enough to fingerprint, program contents, or clone fields.

### Block-transition provenance schema

Specify a versioned immutable transition record shared by Plans 052 and 056. It must identify:

- transition ID, schema version, kind, creation and confirmation times;
- predecessor program identity/fingerprint/revision and source provenance;
- diagnosed constraint and the evidence snapshot used for eligibility;
- compiler request, context, family/blueprint/compiler/rules/catalogue versions when compilation is used;
- successor program identity/fingerprint and source provenance;
- an exact stable-identity diff for days, exercises, order, sets, and prescriptions;
- progression relation and strategy-contract preservation decisions;
- linked outgoing archive record and any recovery policy;
- whether the transition was compiler-derived, guided manual repair, permanent volume reduction, or recovery week.

The record is written atomically with outgoing archive and successor activation through the existing compare-and-swap/program-draft transaction boundary. Preview and commit must use the same immutable proposal hash; a stale proposal is rejected and regenerated.

### Recovery-week experiment contract

Recovery is a distinct, versioned schedule policy for week one of the next normal block. It does not mutate progression-engine arithmetic, the canonical compiled program, loads, RIR, frequency, or exercise identities. Week two automatically renders the canonical prescription.

Eligibility requires both:

- observed `maintained` or `declined` evidence under the approved outcome model, never untested/insufficient evidence; and
- corroborating recovery/readiness input captured in the checkpoint.

The preview must show base versus effective working sets per exercise and the evidence/provenance that enabled the proposal. The user must explicitly confirm. Optional work is removed first, ordinary `minSets` may be crossed under this separately named policy, at least one working set remains for each primary movement pattern, and the target direction is approximately half normal working-set volume. Reassessment occurs after the recovery week; no automatic repeat is allowed.

The audit does **not** settle the exact rounding, allocation, optional-work ordering ties, or definition used to classify a primary movement pattern. Phase 0 must present a deterministic candidate rule with representative program proofs to the owner, record the selected constants in the ADR/specification, and stop before Plans 052/056 implement recovery if approval is absent. No agent may invent load, RIR, frequency, or duration formulas to fill the gap.

## Domain/state model

Phase 0 publishes schemas rather than runtime state. The authoritative models are the logical-clone envelope and import state machine, immutable block-transition proposal/record, recovery-week overlay, preliminary semantic-role inventory, and G/UI disposition register described above. Each has a version, closed variants, parse boundary, contract owner, and named consumer. Later plans may extend only through a versioned Phase 0 amendment; they cannot add ad hoc fields or states in a renderer.

## Migrations

The migrations in this phase are documentation/status migrations:

1. Add a superseding overhaul ADR (or tightly scoped ADRs if transfer security requires separation) with explicit `Supersedes in part` references.
2. Update current-tense canonical docs to link to the new decisions; do not rewrite old plan completion records as if they were never valid.
3. Mark obsolete dual-workout/List, full-tour, earlier landing, and visual-only overhaul specs as historical where affected.
4. Update privacy/data statements consistently in `AGENTS.md`, README/privacy docs, brand guide, Share guidance, and transfer operations documentation.
5. Update the plan/backlog indexes without promoting deferred roadmap work.
6. Add deterministic check data for the G/UI disposition register and stale contradictory phrases where practical.

No stored user-data migration executes in this phase. The documents must assign later migrations to Plans 051–053 and 056.

## UX state specification

There is no shipped UI in this phase. Specifications must enumerate, without designing visual details, the later transfer states: unavailable, eligible, creating, ready-to-install, claiming, importing, success/recovery-snapshot, invalid, expired, already-claimed, interrupted/retryable, service-disabled, and divergence-warning. They must also enumerate recovery eligibility, ineligible/insufficient evidence, preview, stale preview, confirmed, active recovery week, week-two restoration, and reassessment.

## Accessibility

The canonical contract must require WCAG 2.2 AA by rendered role; 320px and 200% text without lost information/actions; focus order/restoration; status announcements; selected/disabled semantics with reasons; reduced motion; safe areas; touch targets; intentional-scroller exceptions; and physical VoiceOver/TalkBack gates. It must preserve adjacent validation and pain/discomfort boundaries.

## Localization

English and PT-BR are equal release targets. Generated `i18n.js` must always be rebuilt from `i18n-en.json` and `i18n-pt.json`. Complete messages replace grammar fragments. Exercise names are user/data content and are not automatically translation leaks; raw keys/identifiers are defects.

## Responsive behavior

Canonical requirements cover 320px, the 390×844 catalog phone, 430px, applicable desktop/browser layout, 200% root text, and demanding PT-BR + 200% combinations. Responsive reflow must keep expert program controls visible rather than hide them.

## Light/dark

Retain the `data-theme` token swap and pre-paint replay. New rules consume semantic tokens, not literal theme colors. Licensed art retains its paper background in both themes; missing media remains an intentionally empty tile.

## Offline/PWA

Ordinary Taurifer operation remains offline-capable and local-first. The install-transfer action alone requires connectivity. A service outage must not block ordinary browser use, setup links, backups, or manual installation. Plans must never claim that installation is required for offline use or supplies native-grade reminders/durability.

## Failure and recovery

The specifications must define fail-closed behavior for invalid documentation mappings, stale transition proposals, unknown clone schemas, transfer errors, partial import, remote deletion retry, and expiry. Existing data is retained until a complete replacement commits. Kill-switching the transfer service removes the promotion/action but never strands local data.

## Privacy

The cached Privacy page becomes the canonical user disclosure. Share remains task-only. Documentation must distinguish local workout/program data, fragment-encoded setup proposals, the temporary token cookie, the encrypted one-hour install clone, and consented telemetry. No document may broadly say “never uploads” without the narrow transfer and opted-in telemetry qualifications.

## Telemetry

This phase defines schemas only. Approved future measurements are comprehension/task funnels, installation, `late_install_transfer`, and relevant task outcomes. They inform owner interpretation, not autonomous redesign. No content payload, exercise/program identity, free text, token, or exact sensitive value enters telemetry.

## Testing and executable evidence

| Invariant | Evidence |
|---|---|
| Audit source is intact | `node tools/extract-ui-audit-findings.mjs --check` |
| Every G/UI item has one disposition | A repository check parses G-01–G-88 and UI-01–UI-32 against the new register and rejects duplicates without an explicit `split` owner |
| No canonical contradiction remains | Phrase/link checker plus manual review of the conflict matrix above |
| All referenced files exist | Link/path checker over Plans 049–059 and the sequence document |
| No production behavior changed | `git diff --name-only origin/main...HEAD` is documentation/plan/check-data only; no app, style, HTML, service-worker, generated, or catalog PNG paths |
| Existing catalog remains valid | `node tools/check-ui-screens.mjs` from a checkout with the pinned test dependencies |
| Transfer/recovery contracts are complete | Threat-model tabletop and representative clone/recovery examples reviewed against every G-55/G-56/G-70/G-71/G-84–G-88 clause |

## Screen catalog changes

- **New states:** none.
- **Removed states:** none.
- **Changed states:** none.
- **Matrix expansion:** specified here, implemented by Plan 050 and completed by Plan 059.

## Owner gates

1. Approve the infrastructure provider/operational ownership for the bounded transfer service if it is not already an established Taurifer deployment target.
2. Select the deterministic recovery-week rounding/allocation and primary-pattern rule after reviewing representative compiler outputs. This is a real STOP gate for recovery implementation, not for the rest of Phase 2.
3. Record, but do not execute, the Plan 054 image-generation selection and Plan 059 physical-device sign-off gates.

## STOP conditions

Stop rather than improvise if:

- a G decision cannot be reconciled without changing its product meaning;
- the transfer provider, data residency, key ownership, deletion mechanism, or operations owner is unresolved;
- the exact recovery-week rule lacks owner approval;
- a proposed schema expands into accounts, generalized storage, sync, or backup;
- a doc change would erase historical rationale rather than supersede it;
- a concurrently open PR owns the same canonical document without an agreed merge order.

Independent documentation slices may continue up to the first affected boundary.

## Rollback

Each documentation commit is independently revertible. Reverting Plan 049 restores the prior contracts and therefore also blocks Plans 050–059; it must not leave later implementation merged. If a contract is corrected after publication, add a new commit and update cross-references—do not amend or rewrite the published branch.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `docs(ui): establish overhaul decision disposition register` | One owner/disposition for G-01–G-88 and UI-01–UI-32; protected/rejected claims recorded | `docs/ui-audit.md` companion/register, `plans/README.md` | Approved planning PR | Disposition-count checker; audit extraction check | `git diff --check` | None | Mark row pushed; link register and SHA | Revert removes only register/index entry |
| 2 | `docs(architecture): specify semantic UI roles and release matrix` | Preliminary elevation/type/radius/control/progress/color roles and responsive/accessibility matrix | brand guide, UI-screen/tool docs, new/current ADR | Commit 1 | Role inventory has unique meanings; matrix examples resolve | Path/link check | No frames; future matrix specified | Record role decisions and consumers | Revert restores prior visual policy and blocks UI work |
| 3 | `docs(state): specify workout and transition foundation contracts` | DOM-not-state rule, transition provenance schema, ownership/dependency boundaries | state/progression/program docs, ADR | Commit 1 | Schema examples; stale-preview and atomic-archive tabletop | Audit extraction check | None | Record schema/version choices | Revert blocks Plans 051/052/055/056 |
| 4 | `docs(recovery): specify owner-gated recovery-week policy` | Eligibility, bounded volume-only overlay, provenance, reassessment, explicit unresolved constants | progression docs, ADR | Commit 3 and owner selection for constants; otherwise land as `Blocked` specification | Representative family fixtures and invariant table | Link/check suite | None | Record owner decision or ⛔ gate exactly | Revert removes recovery authorization only |
| 5 | `docs(install): specify temporary iOS transfer exception` | Logical clone, endpoints, threats, retry/import/delete/recovery snapshot, operations/privacy | dedicated ADR/spec, privacy/architecture docs | Commit 1 and provider gate if needed | Threat-model checklist; clone examples; endpoint state-machine review | Privacy phrase check; audit extraction | States specified only | Record provider and unresolved operational risks | Revert disables transfer plans without affecting local PWA |
| 6 | `docs(roadmap): make UI overhaul the active initiative` | Backlog/plan/ADR/brand cross-links agree; deferred roadmap remains deferred | `docs/backlog.md`, `plans/README.md`, affected ADRs/plans/spec status notes, `AGENTS.md` | Commits 1–5 | Contradiction/path checker | `git diff --check`; catalog check | None | Complete reconciliation evidence table | Revert this index slice only after consumers are also reverted |

After every row: mark it 🟡 before work; implement only that row; run its focused proof; inspect the complete diff; remove unrelated changes; commit; push immediately; update the PR immediately; continue only when the remote is a truthful handoff boundary.

## Implementation-agent operating protocol

### Branch, worktree, dependencies, and ownership

- **Recommended branch:** `ui-overhaul/049-canonical-reconciliation`
- **Recommended worktree:** `../repforge-ui-049-reconciliation`
- **Base:** current `origin/main`
- **Dependency gate:** the planning PR is owner-approved; no implementation-phase PR has merged ahead of this contract
- **Primary ownership:** plan/backlog index, new overhaul/transfer ADRs, affected current-tense sections of ADRs 0005–0007/0010, brand/privacy/state/progression guidance
- **Shared hotspots:** `AGENTS.md`, `docs/backlog.md`, `plans/README.md`, `docs/brand-guide.md`, ADR index, test/catalog documentation
- **Conflicting phases:** every later plan consumes these contracts; none may independently redefine them
- **Safe parallelism:** Plan 050 may prepare tests against unchanged behavior after the decision register lands, but must not merge contract-dependent changes first
- **Integration order:** Plan 049 merges before any implementation plan

At start: fetch `origin`; inspect branches, worktrees, and open PRs; resume an existing Plan 049 branch if present; otherwise create the dedicated worktree. Never replace another agent's branch/worktree, copy uncommitted files, or use the coordination checkout for implementation. Target `main` unless the owner records another integration topology.

For fresh work, create and push `chore(plan-049): start implementation`, open a draft PR, and populate the complete body below before substantive edits. After a prerequisite merges, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected verification, push, and update the PR. Never rebase a published branch.

### Required implementation PR body

```markdown
## Objective
## Scope boundary
### In this PR
### Explicitly out of scope
## Dependencies
- Depends on:
- Blocks:
- Required main state:
- Current dependency status:
## Planned commit sequence
| # | Status | Atomic commit | SHA | Focused verification |
|---|---|---|---|---|
<!-- Status: ⬜ planned; 🟡 in progress; ✅ pushed and verified; ⛔ blocked; ↪ changed -->
## Current state
- Current slice:
- Last pushed SHA:
- Worktree:
- Worktree clean:
- Relationship to main:
- Active blocker:
- Owner decision required:
- Completion-gate status:
## Completed work
## Verification evidence
| Check | Result | SHA |
|---|---|---|
## Risks and decisions
### Confirmed decisions
### Assumptions
### Newly discovered risks
### Outstanding owner decisions
## Next exact steps
1.
2.
3.
## Future plan steps
## Handoff
- Branch:
- Worktree:
- PR:
- Base:
- Current main SHA:
- Last known-good SHA:
- Latest focused tests:
- Latest full regression:
- Latest catalog evidence:
- Latest physical-device evidence:
- Files owned:
- Shared hotspots:
- Blocked on:
- Owner approval required:
- Exact next action:
- Last updated:
```

### Stable handoff discipline

- Published history is stable: no amend, rebase, force-push, silent rewrite, or stash-based handoff. Fix mistakes with new atomic commits.
- Do not create knowingly broken checkpoints. A slice is coherent, tested, committed, pushed, and recorded, or returned to the prior pushed boundary.
- Do not bypass dependencies by duplicating work, copying unpublished files, or cherry-picking arbitrary sibling commits.
- Assume interruption after every tool call. Keep reasoning, decisions, commands/results, and `Next exact steps` in the PR. Push every completed slice.
- Before stopping, run `git status --short` in every touched worktree. A valid takeover boundary is clean.
- Unless explicitly authorized, do not merge. Stop at owner review with all rows accounted for, remote current, PR body current, checks green, review threads closed, owner gates recorded, and no hidden STOP condition.

## Completion gate

- No governing current-tense document contradicts G-01–G-88.
- Every G decision and UI finding has exactly one implementation disposition or an explicit split.
- Historical decisions remain readable and are truthfully marked superseded in part where applicable.
- Workout state, transition provenance, logical clone, transfer, preliminary design roles, and recovery experiment have versioned specifications and named owners.
- Transfer threats, operations, privacy, rollback, and failure recovery are review-complete.
- Recovery constants are owner-approved or the recovery slice is explicitly blocked without blocking unrelated plans.
- Every Plan 050–059 document has dependencies, migrations, acceptance criteria, executable tests, rollback/recovery, owner gates, exact atomic commits, and the takeover protocol.
- Post-Wave-3 work remains deferred.
- Audit extraction, path/disposition checks, `git diff --check`, and catalog completeness pass.
- The implementation branch is pushed, clean, and stopped at owner review; it is not merged without authorization.
