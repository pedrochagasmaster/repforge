# Plan 053: Temporary iOS install-transfer foundation

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).
Plan 053 uses native Luna with Max reasoning under the
[native worker protocol](#native-luna-worker-protocol) below. The latest owner
instruction for this run removes service-tier and priority selection; it
supersedes the starting prompt's Fast-service wording as well as the
Herdr/Gemini routing for this plan. The
[worker packets](#worker-packets) retain their acceptance requirements. Fill
live SHAs, worker IDs, worktrees, server origins, and PIDs before dispatch;
documented revisions are historical anchors.

- **Plan number:** 053
- **Phase:** 2C — State and lifecycle foundations
- **Status:** Coordinator kickoff complete; the P0 actor/credential/fault oracle is accepted and this documentation slice records its protocol resolutions. Implementation packets have not started on the integration branch. The current owner setting is Luna Max with no service-tier or priority selection.
- **Owner approval state:** One-hour transfer, Cloudflare provider, EU Durable
  Object boundary, token-derived encryption, operations, incident rules, and
  privacy disclosure are approved. Staging and physical-device evidence remain
  implementation gates.
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

Cloudflare Workers receive global edge ingress and use EU-jurisdiction SQLite
Durable Objects for durable transfer records and processing. Each transfer has
one Durable Object. The edge boundary is disclosed; request bodies, tokens,
payloads, and full URLs are excluded from logs.

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
- The active draft uses `repforge_draft_v1`; merged Plan 051 replaced its flat unversioned shape with DraftV2.
- UI prefs use `repforge_ui_v1`; theme is intentionally device-only in ordinary export/setup sharing.
- Consent and stable identity are separate keys in `telemetry.js`: `repforge_telemetry_enabled_v1` and `repforge_telemetry_identity_v1`.
- Candidate entry work uses `repforge_program_setup_draft_v1`; Phase 049 decides its exact-clone treatment without changing its activation boundary.
- The historical `repforge_setup_v1` cookie carries only an encoded setup proposal into iOS installation and is sent with the static HTML request. It remains distinct.
- Current install detection/promotion and iOS instructions live in `app.js`/`index.html`; dismissal lives in UI prefs and uses a seven-day cadence.
- Durable state writes already use Web Locks, revisioned pending entries, IndexedDB/localStorage reconciliation, and draft-transaction sidecars. The import must reuse those concepts instead of writing keys independently.
- The active draft is DraftV2 (Plan 051, merged). The clone's `workoutDraft` section is the **acknowledged** DraftV2 logical value read through `window.__repforgeWorkoutDraft` (`current`/`checkpoint`/`read`), never the raw flat `repforge_draft_v1` string. Transient checkpoint bytes, the write-ahead journal, cross-tab locks, and the `repforge_draft_v1:recovery` buffer are excluded; the atomic local import recreates a valid destination checkpoint through the approved local-import boundary. If the source cannot produce an acknowledged clone, the transfer fails safely under the approved contract rather than shipping a partial or stale draft.
- Service worker cache is `repforge-v188` on main `c3491c5e`, with `?v=188` script revisions; implementation re-reads and advances the live value rather than trusting a documented number.

## Architecture

### Deployment boundary

Create an isolated `services/install-transfer/` project with its own manifest, tests, deployment/runbook, and lockfile if the selected provider requires dependencies. Do not add a root package manager or application dependency. The service has one purpose and one encrypted record type. It cannot query by user/installation, list transfers, retain payload history, or become a general state endpoint.

The selected deployment is Cloudflare Workers with one EU-jurisdiction SQLite
Durable Object per transfer. Global Cloudflare edge ingress is accepted while
durable storage and Durable Object processing remain in the EU. The Taurifer
owner owns billing, key and HMAC-pepper configuration, expiry alerts and
watchdogs, incidents, and the kill switch. The Privacy page names Cloudflare,
the edge boundary, and the EU processing boundary.

The operating threshold is $10 USD/month for new creates. Billing data can lag,
so this threshold is not a hard cap. At the threshold, fail new creates and
alert the owner. Continue claims, status, commit, and purge during a small
overrun so existing transfers can recover. Raise the threshold only after
owner approval.

Fail new creates when deletion lag, alarms/watchdogs, key/configuration health,
or sensitive-log health is uncertain. Keep existing claim, status, commit, and
purge recovery available. Manual re-enable requires a runbook proof of
deadlines, purge, alarms, configuration, and clean logs. Public notice covers
confirmed token or payload exposure, decryptable retention beyond the promise,
or a material processor breach. Routine unavailability and lag for unreadable
ciphertext do not by themselves require public notice, subject to legal duties.

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

`canonicalPayloadHash` is the lowercase hex SHA-256 over the envelope's
canonical preimage: the whole envelope with `integrity.canonicalPayloadHash`
itself removed, serialized as canonical JSON (recursively sorted object keys,
UTF-8, no insignificant whitespace), covering every other field including
array order. It is validated in memory before any local write; a mismatch
stops the import. The executable rule and fixture live in
`tools/canonical-clone-hash.mjs` with `test/fixtures/install-transfer-clone-v1.json`
(`node tools/canonical-clone-hash.mjs --check`).

`logicalStateDigest` is a source-local comparison value used to detect stale
mutations. The browser derives it from an ordered projection of every logical
section, in this order: `durableState`, `workoutDraft`, `programEntryDraft`,
`uiPreferences`, `analytics`, and `telemetryIdentity`. Object keys are sorted
recursively, while array order is preserved. The projection excludes envelope
creation metadata (`kind`, `schemaVersion`, `createdAt`, `source`, and
`sourceRevision`) and is never serialized into the transfer envelope, its
integrity object, backup data, or the remote record. No logical section may be
omitted. The source compares this digest before and after creation; a change
marks the copy stale without changing the captured clone. The envelope's only
integrity field is `canonicalPayloadHash`, which remains the import hash.

Normalization removes `_storageRevision`, `_storageFollowUp`, `_storageDraftTransaction`, `_storageSetupActivation`, pending/closing sidecar data, tab/writer/operation IDs, cookies, notification/permission runtime data, and provider analytics session IDs. It retains program/history/archive/provenance and other logical user settings in the durable state. Parsing applies explicit field/size/depth limits and rejects unknown required versions. The limits are exactly ADR 0013's payload-boundary table (create body ≤ 2,000,000 bytes; claim/commit/status body ≤ 4,096 bytes; envelope ≤ 2,000,000 bytes; depth ≤ 64; keys per object ≤ 256; array items ≤ 10,000; string values ≤ 8,000 chars; log rows ≤ 200,000; program rows ≤ 2,000; programHistory ≤ 2,000; customExercises ≤ 1,000; claim ID 128–256 bits; create ≤ 5/min per IP; claim/commit/status ≤ 60/min per token). These are new shared transfer-envelope bounds, informed by but not equal to the app's current internal progression and setup-link limits: a complete clone is a different contract from a progression value or setup fragment. The numbers do not change existing app bounds. The browser module and the service must enforce the same transfer table — neither may invent different validators.

### Server record and endpoints

Use Phase 049's endpoint semantics:

- Create validates envelope/size, assigns `expiresAt <= serverNow + 60 minutes`, generates a 256-bit one-time token, derives an AES-256-GCM key with HKDF-SHA-256 using domain-separated info and a stored random salt, stores only ciphertext/nonce/associated data/salt plus a keyed token digest, and returns the plaintext token once.
- Claim atomically changes `available` to `claiming(claimId)`. The bound claim ID can retry; every other claim receives a generic unavailable response.
- Commit/delete authenticates the token and the claim ID bound during claim, then deletes ciphertext immediately. A token-authenticated retry after deletion returns the same deleted result. A minimal non-sensitive tombstone retains only token digest, terminal state, and original expiry to communicate one-time/recovery status; it contains no claim digest, clone, or identity and is purged after the 15-minute tombstone margin. A `claiming` record whose commit never arrives expires into `claimed-expired` (import possibly complete); `expired` strictly means never claimed.
- An independent expiry process deletes ciphertext at/before 60 minutes even when the client never returns. Monitor the oldest live record and deletion lag.

The ADR 0013 response boundary is exact:

| Result | HTTP | Body |
|---|---:|---|
| First create | `201` | `{token, expiresAt}` |
| Duplicate create with the same live idempotency key | `200` | `{duplicate: true, expiresAt}` |
| Bound claim, including a retry by the same claim | `200` | `{envelope, expiresAt}` |
| Bound active commit, or a token-authenticated retry after deletion | `200` | `{state: "deleted", expiresAt}` |
| Status for a token that authenticates, including a terminal state | `200` | `{state, expiresAt}` only |
| Generic invalid, expired, other-claim, or unavailable claim/commit/status operation; `claimed-expired` commit | `404` | `{state: "unavailable"}` |
| Rate rejection | `429` | `{state: "unavailable"}` |
| Creates disabled | `503` | `{state: "unavailable"}` |

The generic `404` body is used when the bearer cannot authenticate the
requested operation. A valid status bearer may expose only its terminal state
and expiry. A commit against `claimed-expired` returns `404` and cannot
resurrect server state or roll back a locally proven import.

The service keeps neither the token nor the derived encryption key after the
request. A long-lived HMAC pepper may authenticate token and IP digests but
cannot decrypt a clone. Cloudflare transiently sees plaintext during create
and claim. A restored provider image may retain ciphertext for up to 30 days,
but the image alone cannot decrypt it after the token and derived key are
discarded. Claim IDs are independent 128+-bit random values. Responses use
TLS, strict origin/CORS, `Cache-Control: no-store`, no redirect, uniform
invalid/expired/claimed shape, bounded bodies, rate limiting, and no sensitive
log fields. Authenticate schema, transfer identity, creation, expiry, and
protocol version as associated data.

Create rate limiting uses a separate short-lived Durable Object keyed by
HMAC(IP). The service stores no raw IP and links no bucket to a transfer or
token. Buckets last no more than two minutes. The exact limits are 5/min/IP
for create and 60/min/token for claim, commit, and status. Pepper rotation
changes authentication buckets without changing transfer decryption.

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
6. Re-read and validate every section, identity, and `canonicalPayloadHash`; set marker `local-committed`.
7. Release into installed boot, call remote commit/delete, then clear the marker after confirmed or retryable deletion bookkeeping.

The service cannot prove that the browser completed local read-back. The real
client call boundary proves the ordering: the installed client sends commit
only after the storage adapter has re-read every section and validated the
canonical hash. A remote commit never authorizes a local rollback.

On boot, an incomplete marker either finishes the entire incoming import if the committed sections and canonical hash prove safe or restores the entire previous snapshot. Mixed state is never exposed. Remote commit is idempotently retried after a locally committed import. A failure before local commit leaves current installed state unchanged. If the installed context unexpectedly already has meaningful local state, stop and require explicit choice; never overwrite automatically.

### Browser recovery snapshot

Safari retains its original data. It learns the outcome by polling `POST /v1/transfers/status` with the token — there is no acknowledgement channel or shared storage across the Safari/installed boundary. Safari backs off from 5 seconds to 60 seconds until a terminal state or `expiresAt` plus a 10-minute margin: `deleted` stores the local recovery-snapshot marker tied to token digest/time; `claimed-expired` (claim bound, commit never confirmed, import possibly complete) freezes exactly like success with may-have-completed copy and never resumes silently; `expired` with no claim ever bound clears the outbound marker and resumes normal use. A restart with an outbound marker first unseals the token from it and resumes polling. Any indeterminate outcome — Safari outbound credential loss, poll exhaustion at expiry plus margin, service failure or an unavailable status response, or polling after the tombstone has been purged — enters `unknown-outcome`: the installed PWA may already have imported the clone. If the installed app holds the data the transfer counts as complete (freeze plus snapshot marker); otherwise browser resume requires the explicit divergence warning and confirmation — plain dismissal is prohibited, since parallel use without the warning is exactly the silent divergence G-88 forbids. Safari outbound credential loss and installed inbound credential loss are distinct faults: the former always lands in `unknown-outcome` (Safari cannot prove the outcome), while the latter retries deletion from the inbound marker or falls back to tombstone expiry — it never needs a divergence warning by itself, because Safari still learns the terminal state through polling. Creation records the source revision and takes the source operation lock; post-creation mutations are flagged so success messaging can warn the installed copy may be stale. While marked, normal mutating UI is replaced by a message directing the user to the installed app, plus read/recovery/backup access as approved in Phase 049. `Resume in browser` presents an explicit divergence warning: future browser and installed changes will not merge. Confirmation removes the freeze only in Safari and records that divergence was accepted.

There is no mechanism that writes installed changes back to Safari.

## Domain/state model

Server states: `available`, `claiming`, `deleted`, `expired`, `claimed-expired`; ciphertext exists only in the first two. A `claiming` record whose commit never arrives expires into `claimed-expired`, whose tombstone (digest, terminal state, original expiry) persists so Safari can learn it; `expired` strictly means never claimed. Client states: `idle`, `creating` (outbound marker staged before the POST, token not yet received), `ready`, `claiming`, `validating`, `importing`, `localCommitted`, `deletingRemote`, `complete`, `retryable`, `terminalUnavailable`, `unknown-outcome` (indeterminate: Safari-outbound credential loss, poll exhaustion, service failure, unavailable status, or post-purge polling; always follows the G-88 divergence-warning path, never silent continuation; installed-inbound credential loss is the distinct fault that retries deletion or falls back to tombstone expiry). Recovery snapshot states: `none`, `awaitingClaimOutcome`, `confirmed`, `resumeWarning`, `resumedDiverged`.

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
- offline/service unavailable with Retry and ordinary-app continuation (scoped to failures before transfer creation: once a transfer may exist, an unavailable status is indeterminate and follows the G-88 divergence-warning path, not silent continuation);
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

- crash/timeout during create: retry the same idempotency key; a live record returns `{duplicate: true, expiresAt}` with NO token, because the server cannot reproduce a bearer it never stored. Seal the received token to the outbound marker immediately. A same-key retry can learn the server's expiry, but a local timer cannot prove that the record was never claimed. If creation may have succeeded and Safari has no recoverable bearer, enter `unknown-outcome` and freeze; never mint a new key automatically. A fresh transfer is permitted only after explicit divergence confirmation, while only a server-confirmed `expired` state with no claim permits silent resume. One key never yields two live records;
- crash before claim bind: retry claim;
- crash after bind: same claim ID resumes, different claim fails;
- crash before local writes: installed prior state unchanged;
- partial local write: boot marker finishes or fully restores;
- crash after local commit before remote delete: imported state boots and deletion retries from sealed per-context credentials (Safari outbound marker, installed inbound marker; WebCrypto-sealed token and claim ID, wiped on confirmation or expiry);
- installed inbound credential unseal failure: deletion retries impossible, record dies at tombstone expiry plus the purge runbook, imported state stays live, Safari still learns the terminal state by polling;
- Safari outbound credential unseal failure: enters `unknown-outcome` and follows the G-88 divergence-warning path (the outcome cannot be proven from Safari);
- poll exhaustion, service outage, unavailable status, or polling after tombstone purge: enters `unknown-outcome` and follows the G-88 divergence-warning path, never silent continuation;
- duplicate/expired/invalid token: no local change and generic terminal state;
- two Safari tabs creating/claiming/resuming: one source operation lock; no duplicate active snapshot markers;
- Safari/PWA divergence: browser frozen after success; resume requires explicit warning;
- service expiry failure: alarm and kill switch; manual purge runbook; no new creates until retention is healthy;
- key rotation/unknown key version: creation disabled or old key retained only through maximum record lifetime; never return undecryptable partial data.

## Privacy

Before **Install and transfer**, show a short summary that names Cloudflare and
states EU temporary storage and processing, global edge ingress as applicable,
the network requirement, a live encrypted copy for up to one hour, original
Safari retention, and a link to the cached Privacy page.

The cached Privacy page is the complete disclosure. It states the exact clone
allowlist: normalized durable program and workout state, history, archive and
provenance, DraftV2, the unfinished program-entry candidate, UI preferences,
analytics consent, and stable telemetry identity. It states that volatile
locks, journals, transaction markers, cookies, permissions, cache state, and
provider session state are excluded.

The page names Cloudflare and states that Cloudflare transiently sees plaintext
during create and claim. It explains token-derived server-side AES-256-GCM,
HKDF-SHA-256, the never-stored token-derived key, verified-import-or-minute-60
live deletion, the payload-free tombstone through minute 75, and Cloudflare
recovery images that may retain ciphertext for up to 30 days without a
decryptable token or key. It states that the static-host cookie carries only
the token, global edge ingress can precede EU Durable Object processing, and
HMAC-derived IP counters use no raw IP and last no more than two minutes.

It explains Safari divergence and recovery-snapshot behavior, transferred
analytics consent, telemetry identity, and UI preferences, and that transfer
is neither an account nor synchronization. It must not claim end-to-end
encryption, that Cloudflare never sees the data, or that all copies are
deleted within one hour. No payload/token appears in logs, error tracking,
analytics, URLs, clipboard by default, catalog fixtures, or support
screenshots.

## Telemetry

Emit `late_install_transfer` only after verified local import and according to transferred consent. Minimum approved properties: coarse outcome (`success` only for this event; separate coarse failure counters require Phase 049 approval), `source_context: browser`, `destination_context: standalone`, platform family, and schema version. Preserve `installationId`; do not generate a second identity before event initialization. Do not emit token, claim ID, timestamps precise enough to correlate service records, payload size/content, program identity, or readiness data.

## Testing and executable evidence

### Service contract/security

- Create/idempotency, claim bind/retry, competing/duplicate claim, commit-verified delete, 60-minute ciphertext expiry, tombstone retention through the 15-minute polling margin, uniform invalid response, size/schema/CORS/content-type/rate limits.
- AEAD tamper failure, unique nonces, token digest-only storage, entropy test,
  HKDF domain separation, derived-key disposal, and recovery-image
  non-decryptability after expiry.
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

- **New states:** transfer explanation, creating, ready/install instructions, importing, success, retryable failure, terminal expired/unavailable, unknown-outcome (indeterminate result under the G-88 divergence-warning path), Safari recovery snapshot, divergence warning.
- **Removed states:** none.
- **Changed states:** current iOS install sheet gains functional transfer entry only for eligible established data; Settings hook may remain minimally wired until Plan 054.
- **Matrix expansion:** consent, failure, and divergence states need EN/PT, light/dark, compact, 200%, and demanding PT-BR + 200%; installed/browser context labels need semantic evidence.

## Owner gates

1. The implementation must preserve the selected Cloudflare/EU Durable Object,
   token-derived encryption, operations, incident, and disclosure contract.
2. Physical iOS Safari → installed PWA transfer evidence is required before
   this primitive is considered complete; Plan 059 repeats it for launch
   sign-off.

## STOP conditions

- Stop if the service cannot guarantee strong one-time claim, authenticated encryption, commit-verified payload deletion, or deletion within one hour.
- Stop if the selected provider, EU processing boundary, token-derived key
  disposal, operations controls, or privacy wording drifts from Plan 049 or
  ADR 0013.
- Stop if implementation would upload raw browser storage, log secrets, place the token in a URL, or overload the setup cookie.
- Stop if atomic import would overwrite meaningful destination state or expose a partial clone.
- Stop if interrupted claims cannot safely retry without allowing a second claimant.
- Stop before adding account/sync/backup/general API behavior or broad install-promotion UI.

## Rollback

The service has a creation kill switch and independent purge command. Client rollback first disables new transfer creation, leaves ordinary local use intact, and retains parsers/import-marker recovery until no in-flight record can exist (at least one hour plus operational margin). Never deploy code that abandons a locally committed marker or strips imported state. Service rollback retains old decryption keys only through the maximum live-record window, purges records, then removes them. Existing Safari and installed local data remain recoverable.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(install): define logical clone and transfer threat fixtures` | Exact include/exclude schema, hostile inputs, redaction assertions | new client/service tests and fixtures, transfer docs | Plan 049 selected contract; Plan 051 schema known | Clone normalization/round-trip and threat checklist | Backup/shared-setup tests | None | Record selected contract/gates/schema | Tests/docs only |
| 2 | `feat(install): add one-hour transfer service` | Create/idempotency, encrypted storage, claim binding, delete/expiry, kill switch | `services/install-transfer/**` | Commit 1 and the selected Cloudflare/EU contract | Service fake-clock/security suite | Service integration/lint only | None | Record staging endpoint, retention proof, no-secret logs | Disable create/purge service |
| 3 | `feat(install): build and claim logical browser clones` | Client envelope/API, token cookie, setup-cookie coexistence, context detection | new `install-transfer.js`, `app.js`, `index.html`, i18n, SW/script revisions, tests | Commits 1–2; Plan 051 merged | Browser create/claim/cookie/context tests | Install/shared-setup/backup suites | Functional transfer states begin | Record cache/schema and redaction proof | Disable action; retain token parser through expiry |
| 4 | `feat(storage): import install transfers atomically` | Import marker, complete write/read-back, boot finish/rollback, remote delete retry | persistence portions of `app.js`, client module, storage/race tests | Commit 3 | Crash at every import boundary, partial write, two-tab | Thermonuclear/draft/backup/full storage suites | Import/recovery error states | Record every fault result | Keep recovery parser; kill new claims |
| 5 | `feat(install): preserve browser recovery snapshot` | Safari freeze/success acknowledgement and explicit divergence resume | client/app UI, i18n, focused CSS/tests | Commit 4 | Safari/PWA context and divergence journeys | Install/accessibility suites | Recovery/divergence states added | Record state machine and limitations | Remove freeze only after kill switch; keep data |
| 6 | `feat(telemetry): preserve identity across late install transfer` | Consent/identity import ordering and `late_install_transfer` event | `telemetry.js`, client/app adapter, schema/tests | Commit 4 and Phase 049 telemetry schema | Event exactly once, identity preserved, disabled consent silent | Telemetry/privacy suites | None | Record event properties/redaction | Revert emission only; preserve identity import |
| 7 | `test(install): prove transfer expiry recovery and device handoff` | Complete adversarial/upgrade/catalog/staging/physical-iOS evidence and runbook | tests, catalog manifest/scenarios/PNGs, operations/privacy docs | Commits 2–6 | Required matrix and staging purge rehearsal | Full browser/catalog/audit checks | All listed new states captured | Fill physical/device and completion evidence | Evidence reverts separately; client/service stays killed if unsafe |

For every row: mark 🟡; implement only the row; run focused proof; inspect all changes and secret/log output; remove unrelated edits; commit; push immediately; update the PR immediately; proceed only from a clean reconstructable remote boundary.

## Worker packets

The atomic commit sequence above is the delivery contract. Each row is dispatched as one or more self-contained packets
under the native worker protocol below; the coordinator fills every packet
field before dispatch. No worker is asked to design the transfer protocol — the Cloudflare Workers / EU Durable Object /
token-derived-key / operations / disclosure contract is closed by Plan 049 and ADR 0013 and **is not reopened by any
packet**. Staging-service and physical-iOS owners remain named humans; those packets record evidence, they do not
simulate it.

Rules for every packet in this plan:

- **Tests land before or with production.** PLANNED assertion files are written with independent expected values first.
- **Anchors are concrete.** Existing: `window.__repforgeWorkoutDraft` (`current`/`checkpoint`/`read`/`cas`),
  `repforge_v1`, `repforge_ui_v1`, `repforge_setup_v1` cookie, `telemetry.js` (`repforge_telemetry_identity_v1`,
  `repforge_telemetry_enabled_v1`, `installationId`), `sw.js` `CACHE = "repforge-v188"`. **NEW** (this plan):
  `install-transfer.js`, `services/install-transfer/**`, and runtime handling of
  the already-specified `repforge_install_import_v1` / `repforge_transfer_inbound_v1` markers.
  `tools/canonical-clone-hash.mjs` and `test/fixtures/install-transfer-clone-v1.json`
  already exist. Extend their proof rather than recreate them.
- **One reusable contract.** The ADR 0013 payload-boundary table is expressed once as a shared limits constant consumed
  by both the browser module and the service; packets never restate made-up limit numbers or duplicate fixture data.
- **Per-boundary oracle.** Each of create / claim / commit / status / Safari-freeze has a written actor + credential +
  fault expectation table (053-P0) before its service or client packet is dispatched.
- **Every packet carries a deliberate failing case** and a STOP boundary; the coordinator reproduces the risky
  assertion (and inspects logs for secret leakage) before the next packet of that row.

### Row → packet map

| Packet | Maps rows | Bounded objective · mode | Existing anchors (main unless NEW) | Proof-first: PLANNED assertion + independent oracle + deliberate failure | Commands: baseline now → planned | STOP · reviewer gate |
|---|---|---|---|---|---|---|
| 053-P0 | 1 | Per-boundary actor/credential/fault oracle table for create, claim, commit, status, and Safari freeze · **plan (read-only)** | Plan 049 endpoint contract, ADR 0013 boundary table, `docs/adr/0013-temporary-install-transfer.md` | Table listing, per boundary: which actor holds which sealed credential, the expected terminal state on loss, and the observable a test will assert. Failure enumerated per boundary (lost create response, unbound claim, commit-never-arrives, unavailable status, credential unseal failure) | baseline: `node --check app.js` → planned: consumed as the oracle by 053-P2/P3/P4/P5 assertion files | STOP if a boundary has no single owning actor or an ambiguous terminal state · reviewer: coordinator signs the table into PR before 053-P2 |
| 053-P1a | 1 | Logical clone V1 schema + normalization fixture: acknowledged DraftV2 section, `repforge_v1`/`repforge_ui_v1` normalized values, consent + identity; volatile fields stripped · **build** | `window.__repforgeWorkoutDraft`, `telemetry.js` keys; existing `tools/canonical-clone-hash.mjs`, `test/fixtures/install-transfer-clone-v1.json`; NEW `test/install-transfer-clone.mjs` | existing `tools/canonical-clone-hash.mjs --check` plus NEW `test/install-transfer-clone.mjs`: `integrity.canonicalPayloadHash` recomputed independently over the sorted-key preimage equals the fixture value. Failure: a fixture carrying `_storageDraftTransaction`, a WAL entry, a lock ID, or the raw flat `repforge_draft_v1` string fails normalization; an untrustworthy active draft yields a recoverable failure; confirmed absence yields `workoutDraft: null` | baseline: `node test/shared-setup-unit.mjs` → planned: `node test/install-transfer-clone.mjs` plus existing hash check | STOP if any volatile marker survives normalization or a raw storage dump is uploaded · reviewer: reproduces one stripped-field case and the untrustworthy-active-draft failure and valid no-draft case |
| 053-P1b | 1 | Shared transfer-limits constant + threat/redaction checklist fixtures (hostile inputs, log-field assertions) · **build** | ADR 0013 boundary table; NEW static-compatible limits module with Node and browser consumers; coordinator pins its file and loading contract before dispatch | NEW `test/install-transfer-limits.mjs`: the browser validator and the service validator import the same constant and reject the same over-limit fixture with the same code. Failure: the two validators disagree on one bound | baseline: `node test/shared-setup-flow.mjs` → planned: `node test/install-transfer-limits.mjs` | STOP if a limit is duplicated as a literal in two places · reviewer: reproduces the disagreement fixture turning green |
| 053-P2a | 2 | Service create + idempotency + encrypted-at-rest storage + independent 60-minute expiry (fake clock) · **build** | NEW `services/install-transfer/**`; closed Cloudflare/EU contract | NEW `services/install-transfer/test/**`: a retried create with the same idempotency key returns `{duplicate:true, expiresAt}` and no token; ciphertext is gone at/before `serverNow + 60min`. Failure: a second live record for one key; AEAD tamper accepted | baseline: `node --check sw.js` → planned: isolated service manifest gate in `services/install-transfer/`: `npm ci`, `npm run check`, `npm test`, `npm run deploy:dry` | STOP if the provider/EU/key-disposal/operations/disclosure contract would drift · reviewer: reproduces the fake-clock expiry and the AEAD-tamper rejection |
| 053-P2b | 2 | Claim bind/retry + competing/duplicate claim + commit-verified delete + payload-free tombstone + kill switch · **build** | NEW `services/install-transfer/**`; 053-P0 oracle | extend the service suite: the bound `claimId` retries; every other claim gets the generic unavailable shape; delete happens only after verified commit, never on claim. Failure: delete on claim alone; a second claimant succeeds | baseline: `node --check sw.js` → planned: same isolated service manifest gate (`npm run check`, `npm test`, `npm run deploy:dry`) | STOP if interrupted claims cannot retry without admitting a second claimant · reviewer: reproduces the competing-claim and commit-verified-delete cases |
| 053-P3 | 3 | Browser envelope build + API calls + dedicated handoff-token cookie (distinct key, never `repforge_setup_v1`) + setup-cookie coexistence + browser/standalone context detection · **build** | `index.html` install surfaces, `repforge_setup_v1` cookie (kept distinct), Plan 051 DraftV2 (merged); NEW `install-transfer.js` | NEW `test/install-transfer-client.mjs`: envelope is built from parsed state (never a storage dump); token never enters fragment/history/DOM/telemetry; a setup proposal and a transfer token coexist and disambiguate deterministically. Failure: token written to `location.hash`; the setup cookie overloaded | baseline: `node test/install-modes.mjs` → planned: `node test/install-transfer-client.mjs` | STOP if the token reaches a URL, log, or the setup cookie · reviewer: reproduces the coexistence case and a redaction assertion |
| 053-P4 | 4 | Atomic local import: `repforge_install_import_v1` marker through the existing durable write path, complete write/read-back, boot finish-or-rollback, valid destination DraftV2 checkpoint recreated, remote delete retried from the sealed inbound marker · **build** | `window.__repforgeWorkoutDraft.cas`, `_storageDraftTransaction`, boot replay, `test/thermonuclear-races.mjs`, `test/workout-draft-storage.mjs`; NEW markers | NEW `test/install-transfer-import.mjs`: crash at every numbered import step leaves either the complete incoming state or the complete previous snapshot — never mixed; a populated destination stops and asks. Failure: a partial write is exposed; an active source draft is silently dropped | baseline: `node test/thermonuclear-races.mjs && node test/workout-draft-storage.mjs` → planned: `node test/install-transfer-import.mjs` | STOP if import can overwrite meaningful destination state or expose a partial clone · reviewer: reproduces two crash-boundary recoveries |
| 053-P5 | 5 | Safari recovery-snapshot state machine: freeze after success, `claimed-expired`/`expired`/`unknown-outcome` handling, explicit `Resume in browser` divergence confirmation · **build** | 053-P0 oracle; `install-transfer.js`; ADR 0013 outbound marker and recovery-snapshot state; no competing freeze marker | extend `test/install-transfer-client.mjs`: an indeterminate outcome always routes through the divergence warning, never silent resume; `expired`-never-claimed clears the outbound marker and resumes normally. Failure: plain dismissal removes the freeze | baseline: `node test/install-modes.mjs` → planned: `node test/install-transfer-client.mjs` | STOP if any indeterminate path allows silent parallel use · reviewer: reproduces the `unknown-outcome` and the divergence-confirm cases |
| 053-P6 | 6 | `late_install_transfer` emitted only after verified local import, under the preserved identity and transferred consent; browser vs standalone distinguished · **build** | `telemetry.js` `installationId`, `repforge_telemetry_identity_v1`, `repforge_telemetry_enabled_v1`; `test/telemetry-leakage.mjs`, `test/telemetry-unit.mjs` | NEW `test/install-transfer-telemetry.mjs`: the event fires exactly once, carries no token/claim-ID/size/program identity, and is silent when consent is off; `installationId` is preserved, not regenerated. Failure: event emitted on claim (before commit); a second identity minted | baseline: `node test/telemetry-leakage.mjs && node test/telemetry-unit.mjs` → planned: `node test/install-transfer-telemetry.mjs` | STOP if a second identity is created before event init or a sensitive property appears · reviewer: reproduces the consent-off silence |
| 053-P7 | 7 | Adversarial/upgrade/catalog evidence + staging integration + physical-iOS handoff evidence + purge/kill-switch runbook rehearsal · **build + human evidence** | `test/sw-upgrade.mjs`, catalog manifest/scenarios; approved staging service; physical iOS owner | catalog frames for every new transfer state via `node tools/capture-ui-screens.mjs --flow install` (PLANNED scenarios); SW old/new update during handoff cannot execute an incompatible import schema. Failure recorded, not hidden: staging purge rehearsal that leaves a live record past deadline | baseline: `node test/sw-upgrade.mjs` → planned: `node tools/capture-ui-screens.mjs --flow install` + staging runbook log | STOP if physical-iOS evidence is claimed from emulation, or drift from the closed contract is found · reviewer + owner: device evidence and runbook proof signed into the PR |

### Reuse and ordering notes

- 053-P0's oracle is authored once and referenced by every downstream assertion file; do not re-derive fault
  expectations per packet.
- Service-only packets (053-P1b, 053-P2a, 053-P2b) and isolated client work may run now. Pin the acknowledged DraftV2 clone section before its consumers; serialize P3 app wiring/P4 storage integration after Plan 052 merges as specified below.
- The physical-device gate in 053-P7 is repeated by Plan 059 for launch sign-off; passing it here does not close 059.

## Implementation-agent operating protocol

### Native Luna worker protocol

Use the checked-in [starting prompt](../docs/agents/prompts/plan-053-luna.md).
The coordinator owns decomposition, contract review, integration decisions,
PR handoff, and final judgment. Every delegated worker, including reviewers
and the integrator, uses native Luna with Max reasoning. The latest owner
instruction removes service-tier and priority selection for this run, so the
starting prompt's Fast-service requirement is overridden here.
Do not dispatch Herdr/T3 workers or substitute Gemini, Sonnet, Sol, or Opus.

Select the actual available Luna model identifier, expected `gpt-5.6-luna`,
and reasoning effort `max`. Record the effective model and reasoning setting
in the PR. Do not add or infer a service-tier or priority setting from a model
name. If the model or reasoning setting cannot be selected or verified,
continue coordinator setup and read-only preparation, report the exact
limitation, and obtain direction before dispatching workers with different or
unverified settings.

Use explicit bounded briefs rather than inheriting the entire conversation.
Each brief includes packet ID, source/head SHA, owned paths and symbols,
approved input/output contract, cases and expected results, test commands,
fault/async completion barriers, commit message, dependencies, rollback,
and the required final report. Existing tests/checkers remain authoritative;
new tests are planned until implemented. Apply the evidence protocol and
the Plan 053 checkpoint throughout.

Use all available worker slots for independent ready packets; reserve a slot
for the coordinator. On a four-agent limit this means three concurrent workers.
Do not create idle agents for work whose prerequisite is unresolved. After
one same-contract correction fails, reconstruct its state table and oracle
before dispatching another repair; all replacement workers remain Luna.

### Parallel work and ownership

An independent writer receives a dedicated branch and worktree based on the
last accepted integration SHA. Use branches
`ui-overhaul/053-worker-<packet>` and sibling directories
`../repforge-ui-053-<packet>`. Never allow two writers in one checkout, even
when their files differ. Read-only reviewers examine a pinned commit in a
separate detached worktree if the author's checkout will continue changing.

The integration branch remains `ui-overhaul/053-ios-install-transfer`.
One designated Luna integrator owns its checkout while integration is active.
It merges only complete, reviewed, published worker branches from this plan,
one at a time. Other workers keep their own checkouts. After integration,
rerun affected producer/consumer proof before publishing the integrated slice.
The coordinator checks the evidence and maintains the main draft PR. Worker
SHAs and their dependencies must be linked from that PR as soon as pushed.
This topology explicitly permits merge commits from registered Plan 053 worker
branches; it does not permit copying or cherry-picking unpublished Plan 052 work.

The coordinator pins exact new module paths and loading interfaces before the
first parallel implementation wave. The following are ownership boundaries,
not permission to invent additional production layers:

| Wave | Concurrent assignments | Ownership and opening gate |
|---|---|---|
| A: characterize | P0 actor/credential/fault oracle; P1a existing clone/DraftV2 characterization; P1b limits and independent invalid-input test design | Separate test/doc paths assigned before launch. Coordinator reconciles one endpoint/clone/limits contract. Preserve passing baseline tests; new red tests stay local until a coherent slice passes |
| B: build isolated consumers | Service owner P2a then P2b; browser owner isolated P3 transport/cookie state; independent test owner adversarial cases | Starts after A's shared contract is accepted and committed. Service owner writes `services/install-transfer/**`; browser owner writes `install-transfer.js` and its own tests. Independent test owner writes separately named fault tests only. Shared limits/clone fixtures have one designated owner. Browser uses an injected test transport with exact approved response shapes; actual service integration remains required |
| C: integrate storage | Sole integrator P3 app wiring then P4 atomic import; service owner runs staging/expiry/runbook work; reviewer expands pure/network fault coverage | P2 and isolated P3 proof accepted. Integrator alone edits `app.js`, `index.html`, `sw.js`, generated i18n, catalog manifest/artifacts and shared browser helpers. P4a: complete import/read-back; P4b: crash/replay/stale-tab proof. Before P4a publication, existing failure guarantees must already hold |
| D: complete UI and telemetry | Integrator P5 recovery-snapshot UI; separate P6 telemetry owner; read-only security reviewer | P4 commit accepted. Telemetry owner edits `telemetry.js` and separate telemetry tests; integrator owns app call sites and merges the reviewed result before cross-context proof. No concurrent edits to `install-transfer.js` |
| E: acceptance | Service security/expiry checks; browser/storage/upgrade checks; privacy and documentation review | Same immutable integrated candidate, isolated browser contexts/artifact directories. One catalog writer. Serialize resource-heavy browser/capture runs if they contend. Owner supplies physical-iOS evidence |

P2a/P2b share one service state machine and run serially under its owner.
P3/P4/P5 share client/import state and integrate in that order. Pure tests,
service checks, independent assertions, and read-only review overlap these
serial boundaries. Packet completion follows actual dependencies; the original
atomic rows remain the completion checklist even when their subcommits overlap.

### Integration with the active Plan 052

Plans 049 and 051 are merged. Plan 052 is active in PR #228 at the time of
this amendment. Recheck its current status before every shared-storage slice.
Waves A/B and isolated service work can proceed while 052 is active.
Serialize P3 app wiring and P4 storage changes behind Plan 052's merge to main,
then explicitly merge main into the 053 integration branch and revalidate the
clone against the resulting transition/archive/recovery metadata and DraftV2
adapter. Do not freeze a stale clone schema or omit the new durable fields.
This is shared-file integration ordering, not a prerequisite for isolated
service or client-domain work. Continue ready independent packets while waiting.

Assign a distinct verified server origin and external artifact directory per
browser worker. Register PIDs; never terminate another plan's listener.
Do not overlap complete captures into the same catalog. Use focused proof
during a packet, affected suites at integration, and all required final gates
on the clean candidate. Record CI run retries and exact Git SHAs truthfully.

Native follow-up messages may continue a worker's bounded task. Avoid
status-only interruptions; wait for progress or a completed packet while
performing independent coordination/review. Before replacement, establish that
the prior writer has stopped and inspect its uncommitted work. Preserve existing
stable-history, push-after-slice, no-broken-handoff, and owner-review rules.

### Branch/worktree contract

- **Branch:** `ui-overhaul/053-ios-install-transfer`
- **Worktree:** `../repforge-ui-053-install-transfer`
- **Base:** current `origin/main`
- **Dependency gate:** Plan 049 approved/merged with the selected provider/privacy contract; Plan 051 merged before clone/import integration; staging and physical-device evidence remain downstream
- **Primary files:** `services/install-transfer/**`, new browser transfer module, persistence adapter, install/i18n/telemetry tests, operations/privacy docs
- **Shared hotspots:** `app.js`, `index.html`, `telemetry.js`, `sw.js`, i18n/generated files, install/shared-setup/storage tests, catalog manifest
- **Conflicting phases:** Plan 054 owns promotion/polish and cannot redefine transfer semantics; Plan 059 owns launch sign-off
- **Safe parallelism:** isolated service/client/test packets proceed under Waves A/B; Plan 052 owns active shared storage changes, so P3 app wiring/P4 import integration waits for its merge. Plans 049/051 are already merged.
- **Integration order:** 049/051 → isolated 053 work; 052 merge → 053 app/storage integration → transfer slice of 054 → 059

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
