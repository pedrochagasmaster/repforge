# Plan 053: Temporary iOS install-transfer foundation

- **Plan number:** 053
- **Phase:** 2C — State and lifecycle foundations
- **Status:** Planned; implementation has not started
- **Owner approval state:** One-hour encrypted one-time transfer is approved; provider/operations selection remains gated if Plan 049 does not resolve it
- **Depends on:** Plan 049 clone/threat/endpoint contract and privacy reconciliation; Plan 051 DraftV2 before final clone integration
- **Blocks:** Plan 054 install promotion/late-transfer UX and Plan 059 installed-device acceptance
- **Governing G decisions:** G-07, G-39, G-48, G-71–G-72, G-84–G-88
- **Governing UI findings:** Infrastructure prerequisite beneath UI-19; preserves UI-16 shared-link confirmation boundaries
- **Affected surfaces:** Safari-to-installed-PWA handoff, storage import, browser recovery snapshot, Privacy disclosure, service operations, install telemetry
- **Complexity:** Very high
- **Risk:** Critical — temporary processing of the complete logical user state

## Problem statement

iOS Home Screen installation creates a distinct storage context. Existing setup-link handoff can carry an unconfirmed program proposal through the historical cookie, but it cannot clone an established device's durable state, active workout draft, preferences, consent, and telemetry identity. The approved experience requires an explicit late install-and-transfer action with an encrypted backend copy, one-hour maximum lifetime, one-time claim, atomic local import, immediate deletion, and browser recovery-snapshot behavior.

This exception must be implementable without turning Taurifer into a hosted account/sync product and without weakening its ordinary local-first/offline behavior.

## Approved direction

- Transfer an exact logical clone: durable state, active DraftV2, device/UI preferences, analytics consent, telemetry identity, and the Phase 049 disposition for unfinished program-entry candidate state.
- Exclude volatile journals, locks, transaction markers, caches, service-worker state, OS permissions, and session-only runtime values.
- Create the encrypted temporary copy only after an explicit informed action.
- Expire unclaimed payloads within 60 minutes; delete payload after verified local import (commit), never on claim alone.
- Permit only one claimant, while allowing the same interrupted claim to retry safely.
- Import atomically. Retain original Safari data. After success, make Safari a recovery snapshot and warn explicitly before browser resume.
- Emit consent-respecting `late_install_transfer` under the preserved identity and distinguish browser/standalone context.

## Preserved strengths

Preserve ordinary static/offline/local-first Taurifer, user ownership/export, setup-link formats and pre-confirmation boundary, exact exercise identity, current crash-safe storage transactions, device theme/preferences, Safari source data, and the existing core loop. The service is a narrow transfer bridge, never a new source of truth.

## Non-goals

- No accounts, login, sync, cloud backup, conflict merge, device list, remote workout history, publishing, generalized API, entitlement, or subscription infrastructure.
- No changes to the `v1.`/`v2.` setup-link payload, the `taurifer-shared-setup` semantic document, or its pre-confirmation persistence boundary.
- No server-side analytics of clone contents or claim tokens.
- No promise that install is required for offline use or provides native-grade reminder/durability semantics.
- No UI promotion timing; Plan 054 owns it after this primitive is safe.

## Current-state audit

- The app is a dependency-free static PWA. Root production has no package manager or backend.
- Durable state lives in localStorage `repforge_v1` and IndexedDB `repforge/kv`; write-ahead and transaction keys preserve crash safety.
- The active draft uses `repforge_draft_v1`; Plan 051 replaces its flat unversioned shape with DraftV2.
- UI prefs use `repforge_ui_v1`; theme is intentionally device-only in ordinary export/setup sharing.
- Consent and stable identity are separate keys in `telemetry.js`: `repforge_telemetry_enabled_v1` and `repforge_telemetry_identity_v1`.
- Candidate entry work uses `repforge_program_setup_draft_v1`; Phase 049 decides its exact-clone treatment without changing its activation boundary.
- The historical `repforge_setup_v1` cookie carries only an encoded setup proposal into iOS installation and is sent with the static HTML request. It remains distinct.
- Current install detection/promotion and iOS instructions live in `app.js`/`index.html`; dismissal lives in UI prefs and uses a seven-day cadence.
- Durable state writes already use Web Locks, revisioned pending entries, IndexedDB/localStorage reconciliation, and draft-transaction sidecars. The import must reuse those concepts instead of writing keys independently.
- Service worker cache is currently `repforge-v175`; implementation re-reads and advances the live value.

## Architecture

### Deployment boundary

Create an isolated `services/install-transfer/` project with its own manifest, tests, deployment/runbook, and lockfile if the selected provider requires dependencies. Do not add a root package manager or application dependency. The service has one purpose and one encrypted record type. It cannot query by user/installation, list transfers, retain payload history, or become a general state endpoint.

Phase 049 records provider, region, datastore, encryption-key owner, expiry mechanism, alert owner, and kill switch. A Cloudflare Worker plus a durable strongly consistent store is a suitable shape only if the owner approves it; do not infer provider authorization from the repository's static hosting.

Add a dependency-free browser module such as `install-transfer.js` loaded before `app.js`. It owns envelope construction/validation, API calls, handoff-token parsing, claim state, and browser recovery-snapshot markers. Storage mutation stays in the existing state persistence adapter.

### Logical clone V1

The browser constructs a fresh semantic envelope from parsed current state; it never uploads `localStorage`/IndexedDB wholesale.

```text
kind: taurifer-install-transfer
schemaVersion: 1
createdAt
source: { context: browser, logicalInstallationId }
sourceRevision
durableState: normalized repforge_v1 value
workoutDraft: null | DraftV2 logical section
programEntryDraft: null | versioned candidate section (per Plan 049)
uiPreferences: normalized repforge_ui_v1 value
analytics: { enabled }
telemetryIdentity: { schemaVersion, installationId, createdAt }
integrity: { canonicalPayloadHash }
```

Normalization removes `_storageRevision`, `_storageFollowUp`, `_storageDraftTransaction`, `_storageSetupActivation`, pending/closing sidecar data, tab/writer/operation IDs, cookies, notification/permission runtime data, and provider analytics session IDs. It retains program/history/archive/provenance and other logical user settings in the durable state. Parsing applies explicit field/size/depth limits and rejects unknown required versions.

### Server record and endpoints

Use Phase 049's endpoint semantics:

- Create validates envelope/size, assigns `expiresAt <= serverNow + 60 minutes`, encrypts with authenticated encryption, stores only a keyed token digest, and returns the plaintext opaque token once.
- Claim atomically changes `available` to `claiming(claimId)`. The bound claim ID can retry; every other claim receives a generic unavailable response.
- Commit/delete accepts the bound claim and deletes ciphertext immediately. A minimal non-sensitive tombstone retains only token digest, terminal state, and original expiry to communicate one-time/recovery status; it contains no clone or identity and is purged after the 15-minute tombstone margin. A `claiming` record whose commit never arrives expires into `claimed-expired` (import possibly complete); `expired` strictly means never claimed.
- An independent expiry process deletes ciphertext at/before 60 minutes even when the client never returns. Monitor the oldest live record and deletion lag.

Tokens have at least 256 random bits and are never stored plaintext. Claim IDs are independent 128+-bit random values. Responses use TLS, strict origin/CORS, `Cache-Control: no-store`, no redirect, uniform invalid/expired/claimed shape, bounded bodies, rate limiting, and no sensitive log fields. Use AEAD with per-record nonce and managed key version; authenticate schema/creation/expiry as associated data.

### iOS handoff

When Safari has created a transfer, set a dedicated short-lived handoff cookie containing only the opaque token and expiry—not the clone. Use a historical-codename-compatible but distinct key selected in Phase 049, matching `index.html` path, `SameSite=Lax`, and `Secure` outside localhost. Do not overload `repforge_setup_v1`; setup proposal and full-state transfer may coexist and must be disambiguated deterministically.

The installed context consumes and expires its transfer cookie before ordinary boot writes state. Token values never enter fragment/history, DOM text, telemetry, console, service-worker cache key, or screenshots. The matching static host necessarily receives the cookie; privacy documentation states that fact.

### Atomic local import

Add a versioned `repforge_install_import_v1` transaction marker through the existing durable write path. It contains encrypted-at-rest-local or ordinary local snapshots consistent with current storage practice, never remote secrets in logs:

```text
transactionId, claimIdDigest, phase
previous: validated logical local clone
incoming: validated logical clone
createdAt, expectedLocalRevision
```

Import protocol:

1. Before app initialization exposes mutable UI, read the handoff token, stage the `repforge_transfer_inbound_v1` marker with the sealed token and a stable client-generated claim ID, then claim.
2. Validate all envelope sections and canonical hash in memory.
3. Acquire the cross-tab state/draft/import lock and freeze other tabs through BroadcastChannel/storage signaling.
4. Stage the marker with complete previous and incoming snapshots.
5. Write normalized durable state through the existing mirror/WAL path, write/remove DraftV2 and candidate draft, then preferences/consent/identity.
6. Re-read and validate every section and identity; set marker `local-committed`.
7. Release into installed boot, call remote commit/delete, then clear the marker after confirmed or retryable deletion bookkeeping.

On boot, an incomplete marker either finishes the entire incoming import if the committed sections/hash prove safe or restores the entire previous snapshot. Mixed state is never exposed. Remote commit is idempotently retried after a locally committed import. A failure before local commit leaves current installed state unchanged. If the installed context unexpectedly already has meaningful local state, stop and require explicit choice; never overwrite automatically.

### Browser recovery snapshot

Safari retains its original data. It learns the outcome by polling `POST /v1/transfers/status` with the token — there is no acknowledgement channel or shared storage across the Safari/installed boundary. Safari backs off from 5 seconds to 60 seconds until a terminal state or `expiresAt` plus a 10-minute margin: `deleted` stores the local recovery-snapshot marker tied to token digest/time; `claimed-expired` (claim bound, commit never confirmed, import possibly complete) freezes exactly like success with may-have-completed copy and never resumes silently; `expired` with no claim ever bound clears the outbound marker and resumes normal use. A restart with an outbound marker first unseals the token from it and resumes polling. Only a genuine unseal failure enters unknown-outcome: if the installed app holds the data the transfer counts as complete, otherwise browser resume requires the explicit divergence warning and confirmation — plain dismissal is prohibited, since local data was never deleted but parallel use without the warning is unsafe. Creation records the source revision and takes the source operation lock; post-creation mutations are flagged so success messaging can warn the installed copy may be stale. While marked, normal mutating UI is replaced by a message directing the user to the installed app, plus read/recovery/backup access as approved in Phase 049. `Resume in browser` presents an explicit divergence warning: future browser and installed changes will not merge. Confirmation removes the freeze only in Safari and records that divergence was accepted.

There is no mechanism that writes installed changes back to Safari.

## Domain/state model

Server states: `available`, `claiming`, `deleted`, `expired`, `claimed-expired`; ciphertext exists only in the first two. A `claiming` record whose commit never arrives expires into `claimed-expired`, whose tombstone (digest, terminal state, original expiry) persists so Safari can learn it; `expired` strictly means never claimed. Client states: `idle`, `creating`, `ready`, `claiming`, `validating`, `importing`, `localCommitted`, `deletingRemote`, `complete`, `retryable`, `terminalUnavailable`. Recovery snapshot states: `none`, `awaitingClaimOutcome`, `confirmed`, `resumeWarning`, `resumedDiverged`.

State transitions are closed and idempotent. Network timeouts never imply success. The server clock owns expiry. Claim retries use the same claim ID; create retries use an idempotency key so a timeout cannot produce multiple live clones.

## Migrations

- Add parsers for clone schema V1 and import marker V1. Unknown future versions fail without local mutation.
- Plan 051 DraftV2 migration runs before source clone creation; target import accepts only current/supported draft versions.
- Existing users receive no automatic upload. Transfer records exist only after action/consent.
- Preserve `repforge_setup_v1` behavior and cleanly expire the new token cookie.
- Add the browser module to the service-worker inventory/current query lockstep; ensure old worker/new HTML cannot execute an incompatible import schema.
- Backup export/import includes the imported logical user state exactly as ordinary state, but never token/import markers.

## UX state specification

Plan 053 supplies safe functional states for Plan 054 to style:

- eligible explanation with included data, temporary processing, one-hour expiry, and original-browser retention;
- explicit `Install and transfer` action;
- creating, ready with iOS installation steps and absolute expiry/countdown;
- offline/service unavailable with Retry and ordinary-app continuation;
- installed claim/validate/import progress with non-dismissable integrity boundary;
- success directing the user into the installed app;
- expired, invalid, already claimed, duplicate-other-client, malformed, and unsupported-version outcomes without leaking which token existed;
- interrupted import recovery on next boot;
- Safari recovery snapshot and explicit `Resume in browser` divergence confirmation.

Do not present install transfer to an empty first-run state where the existing proposal handoff is appropriate.

## Accessibility

Progress/state changes use live regions without announcing the token. Focus remains trapped only in true modal confirmation; after completion/error it moves to the outcome heading. The countdown is not the sole expiry communication and is not announced every second. Error actions have concrete names/reasons. Recovery snapshot and divergence warning support keyboard, VoiceOver, and reduced motion; destructive overwrite never occurs on a timing-only interaction.

## Localization

All consent, expiry, failure, recovery, and divergence messages have complete EN/PT-BR variants. Dates/times use locale-aware absolute roles plus relative expiry where useful. Tokens and error codes never become visible copy.

## Responsive behavior

Functional states fit 320px, 390×844, 430px, applicable desktop Safari, 200% text, and PT-BR + 200%. Long program/content names are summarized safely without exposing payload and do not move the confirmation action off-screen.

## Light/dark

Use Phase 049 semantic roles and current token-swap theme. No separate transfer visual language or hard-coded security color. Meaning is carried by words/icons in addition to color.

## Offline/PWA

Creation/claim explicitly report that this one action needs a connection. Ordinary app use remains available when offline or when the service kill switch is active. Installed boot with an interrupted locally committed import finishes local recovery offline and queues remote deletion; it does not roll back a proven import merely because the network is absent. Service-worker fetch handlers never cache transfer requests/responses.

## Failure and recovery

Required cases:

- crash/timeout during create: retry the same idempotency key; a live record returns `{duplicate: true, expiresAt}` with NO token, because the server cannot reproduce a bearer it never stored. Seal the received token to the outbound marker immediately; a client that never received the token starts over with a new key after the orphan expires. One key never yields two live records;
- crash before claim bind: retry claim;
- crash after bind: same claim ID resumes, different claim fails;
- crash before local writes: installed prior state unchanged;
- partial local write: boot marker finishes or fully restores;
- crash after local commit before remote delete: imported state boots and deletion retries from sealed per-context credentials (Safari outbound marker, installed inbound marker; WebCrypto-sealed token and claim ID, wiped on confirmation or expiry; unseal failure falls back to 60-minute expiry plus the purge runbook);
- duplicate/expired/invalid token: no local change and generic terminal state;
- two Safari tabs creating/claiming/resuming: one source operation lock; no duplicate active snapshot markers;
- Safari/PWA divergence: browser frozen after success; resume requires explicit warning;
- service expiry failure: alarm and kill switch; manual purge runbook; no new creates until retention is healthy;
- key rotation/unknown key version: creation disabled or old key retained only through maximum record lifetime; never return undecryptable partial data.

## Privacy

Privacy copy must say what is temporarily copied, why, who processes it, encryption in transit/at rest, one-time claim, commit-verified/one-hour deletion, token cookie transport, original Safari retention, recovery-snapshot/divergence behavior, and how telemetry identity/consent carry over. It must not claim end-to-end encryption unless the server truly cannot decrypt. No payload/token appears in logs, error tracking, analytics, URLs, clipboard by default, catalog fixtures, or support screenshots.

## Telemetry

Emit `late_install_transfer` only after verified local import and according to transferred consent. Minimum approved properties: coarse outcome (`success` only for this event; separate coarse failure counters require Phase 049 approval), `source_context: browser`, `destination_context: standalone`, platform family, and schema version. Preserve `installationId`; do not generate a second identity before event initialization. Do not emit token, claim ID, timestamps precise enough to correlate service records, payload size/content, program identity, or readiness data.

## Testing and executable evidence

### Service contract/security

- Create/idempotency, claim bind/retry, competing/duplicate claim, commit-verified delete, 60-minute ciphertext expiry, tombstone retention through the 15-minute polling margin, uniform invalid response, size/schema/CORS/content-type/rate limits.
- AEAD tamper failure, unique nonces, token digest-only storage, entropy test, key rotation across maximum lifetime.
- Assert structured logs/traces contain no token, claim ID, ciphertext, envelope fields, or request body.
- Fake-clock expiry/deletion-lag tests and operational purge/kill-switch rehearsal.

### Client/storage adversarial matrix

- Crash at every numbered import step, partial localStorage/IndexedDB write, read-back mismatch, retry, unknown clone/draft/state schema, already-populated target, two tabs, stale draft, draft absence/removal, and storage quota.
- Backup round-trip after transfer and exact logical equality excluding normalized volatile fields.
- Service-worker old/new update during handoff and cookie coexistence with a setup proposal.
- Safari recovery snapshot, installed-context detection, resume warning, and permanent divergence behavior.

### Real-browser/device proof

Use a local fake service for deterministic browser CI and the approved staging service for integration. Test Safari browser and installed PWA on physical iOS for cookie handoff/storage separation; Chromium browser/installed behavior must not accidentally expose the iOS path. Never claim physical validation from emulation. Plan 059 owns final sign-off but this PR records pre-merge owner device evidence for the risky transfer path.

## Screen catalog changes

- **New states:** transfer explanation, creating, ready/install instructions, importing, success, retryable failure, terminal expired/unavailable, Safari recovery snapshot, divergence warning.
- **Removed states:** none.
- **Changed states:** current iOS install sheet gains functional transfer entry only for eligible established data; Settings hook may remain minimally wired until Plan 054.
- **Matrix expansion:** consent, failure, and divergence states need EN/PT, light/dark, compact, 200%, and demanding PT-BR + 200%; installed/browser context labels need semantic evidence.

## Owner gates

1. Plan 049 must record provider, region, key/operations owner, expiry/deletion SLA, cost ceiling, and incident/kill-switch authority.
2. Owner must review the exact temporary-processing/privacy disclosure before staging/production use.
3. Physical iOS Safari → installed PWA transfer evidence is required before this primitive is considered complete; Plan 059 repeats it for launch sign-off.

## STOP conditions

- Stop if the service cannot guarantee strong one-time claim, authenticated encryption, commit-verified payload deletion, or deletion within one hour.
- Stop if provider/region/key/operations ownership or privacy wording is unresolved.
- Stop if implementation would upload raw browser storage, log secrets, place the token in a URL, or overload the setup cookie.
- Stop if atomic import would overwrite meaningful destination state or expose a partial clone.
- Stop if interrupted claims cannot safely retry without allowing a second claimant.
- Stop before adding account/sync/backup/general API behavior or broad install-promotion UI.

## Rollback

The service has a creation kill switch and independent purge command. Client rollback first disables new transfer creation, leaves ordinary local use intact, and retains parsers/import-marker recovery until no in-flight record can exist (at least one hour plus operational margin). Never deploy code that abandons a locally committed marker or strips imported state. Service rollback retains old decryption keys only through the maximum live-record window, purges records, then removes them. Existing Safari and installed local data remain recoverable.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(install): define logical clone and transfer threat fixtures` | Exact include/exclude schema, hostile inputs, redaction assertions | new client/service tests and fixtures, transfer docs | Plan 049; Plan 051 schema known | Clone normalization/round-trip and threat checklist | Backup/shared-setup tests | None | Record provider/gates/schema | Tests/docs only |
| 2 | `feat(install): add one-hour transfer service` | Create/idempotency, encrypted storage, claim binding, delete/expiry, kill switch | `services/install-transfer/**` | Commit 1 and provider approval | Service fake-clock/security suite | Service integration/lint only | None | Record staging endpoint, retention proof, no-secret logs | Disable create/purge service |
| 3 | `feat(install): build and claim logical browser clones` | Client envelope/API, token cookie, setup-cookie coexistence, context detection | new `install-transfer.js`, `app.js`, `index.html`, i18n, SW/script revisions, tests | Commits 1–2; Plan 051 merged | Browser create/claim/cookie/context tests | Install/shared-setup/backup suites | Functional transfer states begin | Record cache/schema and redaction proof | Disable action; retain token parser through expiry |
| 4 | `feat(storage): import install transfers atomically` | Import marker, complete write/read-back, boot finish/rollback, remote delete retry | persistence portions of `app.js`, client module, storage/race tests | Commit 3 | Crash at every import boundary, partial write, two-tab | Thermonuclear/draft/backup/full storage suites | Import/recovery error states | Record every fault result | Keep recovery parser; kill new claims |
| 5 | `feat(install): preserve browser recovery snapshot` | Safari freeze/success acknowledgement and explicit divergence resume | client/app UI, i18n, focused CSS/tests | Commit 4 | Safari/PWA context and divergence journeys | Install/accessibility suites | Recovery/divergence states added | Record state machine and limitations | Remove freeze only after kill switch; keep data |
| 6 | `feat(telemetry): preserve identity across late install transfer` | Consent/identity import ordering and `late_install_transfer` event | `telemetry.js`, client/app adapter, schema/tests | Commit 4 and Phase 049 telemetry schema | Event exactly once, identity preserved, disabled consent silent | Telemetry/privacy suites | None | Record event properties/redaction | Revert emission only; preserve identity import |
| 7 | `test(install): prove transfer expiry recovery and device handoff` | Complete adversarial/upgrade/catalog/staging/physical-iOS evidence and runbook | tests, catalog manifest/scenarios/PNGs, operations/privacy docs | Commits 2–6 | Required matrix and staging purge rehearsal | Full browser/catalog/audit checks | All listed new states captured | Fill physical/device and completion evidence | Evidence reverts separately; client/service stays killed if unsafe |

For every row: mark 🟡; implement only the row; run focused proof; inspect all changes and secret/log output; remove unrelated edits; commit; push immediately; update the PR immediately; proceed only from a clean reconstructable remote boundary.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/053-ios-install-transfer`
- **Worktree:** `../repforge-ui-053-install-transfer`
- **Base:** current `origin/main`
- **Dependency gate:** Plan 049 approved/merged; Plan 051 merged before clone/import integration; provider/privacy gates recorded
- **Primary files:** `services/install-transfer/**`, new browser transfer module, persistence adapter, install/i18n/telemetry tests, operations/privacy docs
- **Shared hotspots:** `app.js`, `index.html`, `telemetry.js`, `sw.js`, i18n/generated files, install/shared-setup/storage tests, catalog manifest
- **Conflicting phases:** Plan 054 owns promotion/polish and cannot redefine transfer semantics; Plan 059 owns launch sign-off
- **Safe parallelism:** service-only commits may proceed while Plan 051 finishes after schema fixtures are pinned; client/storage integration waits. Plan 052 is independent except shared `app.js`/SW merges
- **Integration order:** 049 → 051 → 053 → transfer slice of 054 → 059

Fetch/inspect main, branches, worktrees, and PRs; resume existing work. Use the dedicated worktree and keep coordination main clean. Never copy uncommitted files or delete another worktree/branch. Push `chore(plan-053): start implementation`, open a draft PR, and complete its body before substantive work. Target main. When dependencies merge, fetch, explicitly merge `origin/main`, resolve deliberately, rerun all affected security/storage tests, push, and update the PR. Published branches are never rebased.

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
<!-- ⬜ planned; 🟡 in progress; ✅ pushed and verified; ⛔ blocked; ↪ changed -->
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

### Push, history, and handoff discipline

Push and document every coherent tested slice immediately. Stable published SHAs are part of the security audit: no amend, rebase, force-push, silent rewrite, or stash handoff. Never knowingly checkpoint a broken transfer/import state; return to the previous pushed boundary. Never bypass Plan 049/051 by duplicating schemas or copying unpublished code. Record threat decisions, staging identifiers without secrets, exact fault results, device evidence, and `Next exact steps` in the PR. Before stopping, run `git status --short` in client and service worktrees; handoff must be clean. Do not merge unless explicitly authorized; owner review requires all security/privacy/operations/device gates closed.

## Completion gate

- The logical clone has explicit executable include/exclude boundaries and round-trips exactly.
- Transfer uses ≥256-bit bearer entropy, digest-only lookup, AEAD storage, TLS, strict origins, bounded requests, no-store responses, secret-free logs, one claimant, retryable bound claims, immediate post-import deletion, and ≤60-minute expiry.
- Local import is all-or-nothing across durable state, DraftV2, candidate disposition, prefs, consent, and identity; crash/partial/retry tests pass.
- Safari original data remains, enters recovery-snapshot mode after success, and warns before divergence.
- `late_install_transfer` respects transferred consent/identity and distinguishes browser/standalone without sensitive properties.
- Service outage/kill switch never blocks ordinary local/offline Taurifer.
- Backup, two-tab, stale draft, draft removal, service-worker upgrade, setup-cookie coexistence, catalog/accessibility, and staging tests pass.
- Owner-approved privacy/operations architecture and physical iOS evidence are recorded.
- Branch/PR are pushed, clean, current, and stopped at owner review.
