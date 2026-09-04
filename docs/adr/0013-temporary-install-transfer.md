# Temporary iOS install transfer is a one-hour encrypted exception

- **Status:** Specification accepted; deployment ⛔ BLOCKED on the owner gate below
- **Contract owner:** Plan 049 (this ADR); implementer Plan 053; promotion
  consumer Plan 054; evidence consumer Plan 059
- **Governing decisions:** G-07, G-39, G-48, G-71, G-84–G-88
- **Companions:** [ADR 0007](0007-shared-setup-links.md) (setup-link proposal,
  a different object), [ADR 0012](0012-ui-overhaul-canonical-reconciliation.md)
  (state ownership), `docs/block-transition-provenance.md` (no shared fields)

When iOS Safari already holds Taurifer data, `Install and transfer my data`
creates a real short-lived backend record with a one-time install token. The
installed PWA claims it and atomically imports an exact logical clone, then
the record is deleted. This is an approved narrow exception to the
static/local-first architecture (G-07: local-first does not mean local-only).
It is not an account, synchronization, backup, publishing, or generalized API
platform, and no later plan may widen it without a new owner decision.

## ⛔ Owner gate (open)

The infrastructure provider, region/data residency, key ownership and
rotation owner, deletion mechanism, expiry-job and incident operations owner,
and the approved user-facing privacy disclosure are unresolved. Plan 053 must
not implement and Plan 054 must not offer the established-data transfer until
the owner records them here. The contract below is written so the selection
fills named slots without reshaping it.

## Logical clone schema (`taurifer-install-transfer` v1)

The envelope is a logical clone, never a raw storage dump. No implementation
may enumerate browser storage and upload arbitrary keys.

| Section | Contents |
|---|---|
| `schemaVersion` | `1` |
| `createdAt` | Creation timestamp |
| `sourceContext` | Browser/Safari context that created the record (coarse only) |
| `durable` | Normalized durable state from `repforge_v1`, excluding storage revisions, write-ahead records, locks, and in-flight transaction markers |
| `draft` | The active workout draft migrated to the Plan 051 schema, or explicit absence |
| `candidate` | Unfinished program-entry candidate as a separately versioned section, or explicit absence (default disposition: included, because losing an active build/import draft would violate "exact logical clone"; it retains its no-program-persistence boundary) |
| `uiPrefs` | Device/UI preferences from `repforge_ui_v1` |
| `analyticsConsent` | Analytics consent value |
| `telemetryIdentity` | The stable telemetry identity (preserved, not rotated) |
| `integrity` | Integrity metadata (algorithm id plus digest; the digest covers every section above) |

Excluded: notification permission, service-worker and cache state, OS install
state, locks, pending journals, storage revision counters,
`_storageDraftTransaction`, `_storageSetupActivation`, claim cookies, PostHog
session state, and all other volatile runtime state.

Each section is independently parsed and validated at the import boundary.
Unknown required schema versions stop the import; unknown optional sections
are retained only if a later schema version explicitly permits round-tripping.

### Example envelope (shape-exact; values redacted or illustrative)

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-10-01T09:00:00.000Z",
  "sourceContext": { "platform": "ios-safari", "standalone": false },
  "durable": "<normalized repforge_v1: program, logs, history, settings; no revisions, journals, locks, or markers>",
  "draft": "<DraftV2 active workout draft, or null when absent>",
  "candidate": "<versioned program-entry candidate section, or null when absent>",
  "uiPrefs": "<repforge_ui_v1 contents>",
  "analyticsConsent": "<consent value>",
  "telemetryIdentity": "<stable pseudonymous identity>",
  "integrity": { "algorithm": "<named digest>", "digest": "<hex>" }
}
```

## Endpoint contract

Equivalent operations (URL shapes may differ only if the threat, retry, and
deletion semantics below are identical and recorded here):

1. `POST /v1/transfers`: accept one validated encrypted logical clone over
   TLS; return an opaque bearer token and an absolute expiry (creation + 60
   minutes maximum).
2. `POST /v1/transfers/{token}/claims`: atomically bind an available transfer
   to a client-generated claim ID and return the clone to that same claim on
   safe retries.
3. `DELETE /v1/transfers/{token}/claims/{claimId}` (or an equivalent commit
   operation): delete the encrypted payload immediately after the client
   proves atomic local import.
4. Expiry processing: delete any unclaimed payload no later than one hour
   after creation, independent of client activity.

Server state machine:

```text
available ──claim──▶ claiming ──commit──▶ deleted
    │                   │
    └──expiry──▶ expired ◀──expiry──┘
```

A second claim ID never receives the payload. The bound claim may retry only
until commit or expiry. Invalid, already-claimed, and expired tokens return a
constant-shape non-disclosing terminal response.

## Security and privacy requirements

- Token entropy of at least 256 bits from a cryptographic generator; the
  server stores only a keyed digest of the token, never the bearer.
- Authenticated encryption at rest with managed key rotation; TLS in transit.
- The bearer and the clone never enter logs, analytics, error tracking,
  referrers, or URLs visible to unrelated origins.
- Exact-origin CORS, `Cache-Control: no-store`, content-type enforcement,
  schema/depth/size bounds, rate limits, and constant-shape
  invalid/expired responses.
- The iOS handoff cookie carries only the opaque install-transfer token,
  never the clone. It is distinct from the historical `repforge_setup_v1`
  setup-proposal cookie and uses the matching HTML path, a short lifetime,
  `SameSite=Lax`, and `Secure` outside localhost.
- User-facing disclosure (approved copy lands with the provider selection):
  the temporary service operator can process the decrypted clone, the opaque
  token is sent with the matching HTML request, and the payload is deleted on
  claim or within one hour. No document may imply the operator cannot read a
  payload it decrypts.

## Threat model

| Threat | Mitigation in this contract |
|---|---|
| Token theft | 256-bit bearer; digest-only storage; short lifetime; single claimant |
| Brute force | Digest lookup with rate limits and constant-shape failures |
| Replay | Atomic `available → claiming → deleted/expired`; second claim IDs rejected |
| Log or referrer leakage | Bearer/clone ban from logs, analytics, errors, referrers, foreign URLs |
| Malicious or stale tabs | Claim-ID binding; validate-before-touch; versioned import marker |
| Service or operator access | Disclosure above; minimal one-hour retention; immediate claim deletion |
| Oversized or malformed payloads | Schema/depth/size bounds enforced before and during parsing |
| Cross-origin requests | Exact-origin CORS; content-type enforcement |
| Interrupted claims | Same-claim retry before commit; boot-verified delete retry after commit |
| Clock skew | Absolute server-issued expiry; skew-tolerant acceptance window documented by the implementer |
| Expiration backlog | Expiry job with monitoring and deletion-latency bounds (operations) |
| Key compromise | Managed rotation; incident handling with a feature kill switch |

## Claim, import, and recovery protocol

1. The client creates a random claim ID and obtains a server claim lease.
2. It validates the complete envelope before touching live state.
3. It stages both the incoming clone and the pre-import local snapshot, then
   acquires the existing cross-tab storage lock.
4. A versioned import marker makes boot either finish the complete import or
   restore the complete pre-import snapshot. Partial visibility is prohibited.
5. Only after a verified local read-back does the client commit the remote
   claim, causing immediate payload deletion.
6. If the process stops before local commit, the same claim ID retries. If it
   stops after local commit but before remote deletion, boot verifies the
   import and retries the delete. A different or duplicate claimant sees the
   non-disclosing terminal state. Invalid or expired tokens leave local data
   unchanged.
7. Safari retains its original local state. After the installed app reports a
   successful claim, Safari is marked as a recovery snapshot: ordinary browser
   use stops, and `Resume in browser` requires an explicit divergence warning
   and confirmation. There is no reverse merge and no synchronization.
8. `late_install_transfer` emits only after successful local import, under the
   transferred telemetry identity and consent, with browser-versus-standalone
   context and coarse outcome fields. Never the token, fingerprinting-granular
   sizes, program contents, or clone fields.

## Operations

The implementer documents expiry-job monitoring, deletion latency, key
rotation, incident handling, cost and retention bounds, and a feature kill
switch that removes the promotion and the action without stranding local
data. A service outage never blocks ordinary browser use, setup links,
backups, or manual installation.

## Specified UI states (no visual design)

Transfer: unavailable, eligible, creating, ready-to-install, claiming,
importing, success/recovery-snapshot, invalid, expired, already-claimed,
interrupted/retryable, service-disabled, divergence-warning. Recovery-week
states live in `docs/recovery-week-policy.md`. Plans must never claim that
installation is required for offline use or that it supplies native-grade
reminders or storage durability.
