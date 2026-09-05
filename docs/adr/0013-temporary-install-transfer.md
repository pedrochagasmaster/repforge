# Temporary iOS install transfer is a one-hour encrypted exception

- **Status:** Specification accepted; provider and operations selected for Plan
  053 implementation. Staging and physical-device evidence remain future gates.
- **Contract owner:** Plan 049 (this ADR); implementer Plan 053; promotion
  consumer Plan 054; evidence consumer Plan 059
- **Governing decisions:** G-07, G-39, G-48, G-71, G-84–G-88
- **Companions:** [ADR 0007](0007-shared-setup-links.md) (setup-link proposal,
  a different object), [ADR 0012](0012-ui-overhaul-canonical-reconciliation.md)
  (state ownership)

When iOS Safari already holds Taurifer data, `Install and transfer my data`
creates a real short-lived backend record with a one-time install token. The
installed PWA claims it and atomically imports an exact logical clone, then
the record is deleted. This is an approved narrow exception to the
static/local-first architecture (G-07: local-first does not mean local-only).
It is not an account, synchronization, backup, publishing, or generalized API
platform, and no later plan may widen it without a new owner decision.

Field names, state machines, and transport rules below are identical to Plan
053's; Plan 053 implements them and must not rename them.

## Selected provider and operations contract

The approved implementation uses Cloudflare Workers with EU-jurisdiction
SQLite Durable Objects. Each transfer has one Durable Object. Global Cloudflare
edge ingress is accepted. Durable storage and Durable Object processing remain
in the EU. Request bodies, bearer tokens, clone URLs, and full URLs are never
written to logs. The Privacy page names the global edge handling and the
temporary EU processing boundary.

The Taurifer owner initially owns billing, key and pepper configuration, alert
and watchdog health, incident response, and the transfer kill switch. The
service uses a $10 USD/month operating threshold for **new creates**. Billing
data can lag, so this is an operating threshold rather than a promised hard
cap. At the threshold, the service fails new creates and alerts the owner. It
continues claims, status, commit, and purge during a small overrun so existing
transfers can recover. The owner must approve any threshold increase.

New creates fail closed when deletion latency is uncertain, the alarm or
watchdog is unhealthy, or key, configuration, or sensitive-log health is
uncertain. Existing claim, status, commit, and purge paths remain available
for safe recovery. The owner re-enables creates manually only after the runbook
proves the deletion deadlines, purge path, alarms, configuration, and absence
of sensitive logging.

Public incident notice is required for a confirmed token or payload exposure,
decryptable retention beyond the stated promise, or a material processor
breach. Routine unavailability and harmless lag for ciphertext that is already
unreadable do not require a public notice. Legal notification duties still
apply.

## Pre-transfer disclosure

Before **Install and transfer**, show a short summary that names Cloudflare and
states:

- Cloudflare temporarily stores and processes the transfer in the EU.
- Global Cloudflare edge ingress can handle the request before EU Durable
  Object processing.
- The action requires a network connection.
- A live encrypted copy can exist for up to one hour.
- The original Safari data remains on the device.
- The cached Privacy page contains the full details.

The summary is part of the explicit action. The Privacy page is the complete
disclosure, not the system share message.

## Deployment boundary

Reconciliation note on G-71/G-85 shorthand: the audit's "delete on claim"
phrasing is refined here without changing the decision — deletion is verified
at import-commit, because deleting at claim binding would destroy the retry
source if the installed app crashes before import. The one-time record and
the 60-minute maximum are unchanged.

An isolated `services/install-transfer/` project with its own manifest,
tests, deployment/runbook, and lockfile if the selected provider requires
dependencies. No root package manager, no application dependency. The service
has one purpose and one encrypted record type: it cannot query by
user/installation, list transfers, retain payload history, or become a
general state endpoint. A dependency-free browser module (`install-transfer.js`,
loaded before `app.js`) owns envelope construction/validation, API calls,
handoff-token parsing, claim state, and recovery-snapshot markers; storage
mutation stays in the existing state persistence adapter.

## Logical clone V1

The browser constructs a fresh semantic envelope from parsed current state;
it never uploads `localStorage`/IndexedDB wholesale.

| Field | Type | Meaning |
|---|---|---|
| `kind` | `taurifer-install-transfer` | Envelope discriminator |
| `schemaVersion` | `1` | Clone schema version |
| `createdAt` | timestamp | Creation time |
| `source.context` | `browser` | Creating context |
| `source.logicalInstallationId` | string | Coarse logical installation reference, not a tracking ID |
| `sourceRevision` | integer | Durable revision counter at creation; lets Safari detect post-creation source mutations (not transferred as storage metadata) |
| `durableState` | object | Normalized `repforge_v1` value (program, history, archive, provenance, logical settings) |
| `workoutDraft` | null \| object | DraftV2 logical section, or explicit null when absent |
| `programEntryDraft` | null \| object | Unfinished program-entry candidate as a separately versioned section, or explicit null when absent. DECIDED: included — losing an active build/import draft would violate exact-clone fidelity (G-84). Inclusion changes nothing about activation: the candidate still requires explicit review and activation and is never auto-applied. |
| `uiPreferences` | object | Normalized `repforge_ui_v1` value |
| `analytics.enabled` | boolean | Analytics consent value |
| `telemetryIdentity.schemaVersion` | integer | Identity schema version |
| `telemetryIdentity.installationId` | string | Stable pseudonymous identity (preserved, not rotated) |
| `telemetryIdentity.createdAt` | timestamp | Identity creation time |
| `integrity.canonicalPayloadHash` | string | Lowercase hex SHA-256 over the envelope's canonical preimage — the whole envelope with `integrity.canonicalPayloadHash` itself removed (self-field exclusion), serialized as canonical JSON (recursively sorted object keys, UTF-8, no insignificant whitespace) and covering every other field including array order. Validated in memory before any local write; a mismatch stops the import |

Normalization removes `_storageRevision`, `_storageFollowUp`,
`_storageDraftTransaction`, `_storageSetupActivation`, pending/closing sidecar
data, tab/writer/operation IDs, cookies, notification/permission runtime data,
and provider analytics session IDs. Parsing applies explicit field/size/depth
limits (below) and rejects unknown required versions.

### Payload boundaries (exact)

Both the browser module and the service enforce these limits identically;
neither may invent different validators. These are NEW transfer-envelope
limits shared by the future client module and service — they are informed by
the scale of the app's existing internal bounds (`app.js`
`PROGRESSION_VALUE_LIMITS`, the shared-setup
`MAX_ENCODED_CHARS`/`MAX_COMPRESSED_BYTES` ceilings) but are not the same
numbers, because a whole-state clone is a different object from a progression
value or a setup fragment. Sharing one table here is what stops the two
sides from drifting; nothing in the app changes.

| Boundary | Limit | Rationale |
|---|---|---|
| Request body (create) | ≤ 2,000,000 bytes | One complete logical clone with headroom; service rejects larger |
| Request body (claim/commit/status) | ≤ 4,096 bytes | Token + claim ID only |
| Envelope total JSON size | ≤ 2,000,000 bytes | Matches the body bound |
| Nesting depth | ≤ 64 levels | Well above any real state shape; below pathological recursion |
| Object keys per object | ≤ 256 | Bounded fan-out |
| Array items per array | ≤ 10,000 | Long histories stay representable |
| String value length | ≤ 8,000 chars | Longest real field (program export text) fits |
| Identifier/key length | ≤ 256 chars | Storage-key and id namespacing |
| `durableState.log` rows | ≤ 200,000 | A decade of daily training |
| `durableState.program` rows | ≤ 2,000 | Far beyond any real split |
| `durableState.programHistory` entries | ≤ 2,000 | Blocks of blocks |
| `durableState.customExercises` | ≤ 1,000 | Far beyond real authorship |
| Serialized `log` row size | ≤ 8,000 chars | One set with notes |
| Claims per token | 1 | Server-enforced |
| Claim ID length | 128–256 bits (22–43 base64url chars) | Entropy bound |
| Create rate | ≤ 5/min per IP | Abuse bound |
| Claim/commit/status rate | ≤ 60/min per token | Retry headroom |

Parsing rejects any value outside these bounds before allocation; a request
exceeding the body bound fails with the constant-shape terminal response.
Depth and size are measured while parsing, never after.

### Example envelope (parseable; values illustrative)

```json
{
  "kind": "taurifer-install-transfer",
  "schemaVersion": 1,
  "createdAt": "2026-10-01T09:00:00.000Z",
  "source": {
    "context": "browser",
    "logicalInstallationId": "li_7f3a"
  },
  "sourceRevision": 42,
  "durableState": {
    "settings": {
      "jumpPct": 2.5,
      "minJump": 2.5,
      "rirHigh": 2,
      "hardRir": 4,
      "restSec": 120,
      "lastExport": "",
      "unit": "kg",
      "lang": "en",
      "rirMode": "numeric",
      "voiceInputEnabled": false,
      "notify": {
        "enabled": false,
        "timer": true,
        "session": true,
        "unfinished": true,
        "missed": true
      }
    },
    "programMeta": {
      "id": "pm_seed01",
      "name": "Build Muscle",
      "started": "2026-09-07",
      "created": "2026-09-07T08:00:00.000Z",
      "updated": "2026-09-28T08:00:00.000Z",
      "goal": "muscle_growth",
      "experience": "6_to_24m",
      "daysPerWeek": 3,
      "splitType": null,
      "equipment": [
        "commercial_gym"
      ],
      "priorityMuscles": [],
      "sessionLength": null,
      "mesocycleLengthWeeks": 6,
      "mesocycleStatus": "active",
      "completedAt": null,
      "onboarded": true,
      "progressionRelations": [],
      "progressionModifiers": [],
      "progressionIncompatibilities": [],
      "blockPromptDismissedId": null,
      "programStructure": {
        "schemaVersion": 1,
        "days": [
          {
            "dayId": "growth_3_d1",
            "label": "Knee / horizontal",
            "order": 1,
            "displayNameKey": "program.day.growth_3_d1"
          },
          {
            "dayId": "growth_3_d2",
            "label": "Hip / vertical",
            "order": 2,
            "displayNameKey": "program.day.growth_3_d2"
          },
          {
            "dayId": "growth_3_d3",
            "label": "Mixed",
            "order": 3,
            "displayNameKey": "program.day.growth_3_d3"
          }
        ],
        "provenance": {
          "familyId": "growth",
          "blueprintId": "growth_3_v1",
          "blueprintVersion": 1,
          "compilerVersion": 2,
          "catalogueVersion": 1,
          "rulesVersion": 1,
          "contextVersion": 2,
          "profileId": "standard@1",
          "recentConsistencyVersion": 1
        },
        "weekPrescriptions": [],
        "customizedFrom": null
      },
      "entrySource": null
    },
    "program": [
      {
        "id": "ex_growth_3_d1_s1",
        "day": "Knee / horizontal",
        "order": 1,
        "name": "Leg press",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Quads",
        "secondary": "Glutes,Hamstrings,Calves",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d1_s1",
        "dayId": "growth_3_d1",
        "libraryId": "sq_lp",
        "movementId": "library:sq_lp",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d1_s2",
        "day": "Knee / horizontal",
        "order": 2,
        "name": "Chest press machine",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Chest",
        "secondary": "Triceps,Front delts",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d1_s2",
        "dayId": "growth_3_d1",
        "libraryId": "pr_mc",
        "movementId": "library:pr_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d1_s3",
        "day": "Knee / horizontal",
        "order": 3,
        "name": "Seated row machine",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Mid/upper back",
        "secondary": "Biceps,Forearms",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d1_s3",
        "dayId": "growth_3_d1",
        "libraryId": "rw_mc",
        "movementId": "library:rw_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d1_s4",
        "day": "Knee / horizontal",
        "order": 4,
        "name": "Romanian deadlift machine",
        "sets": 3,
        "min": 8,
        "max": 12,
        "primary": "Hamstrings,Glutes",
        "secondary": "Spinal erectors",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d1_s4",
        "dayId": "growth_3_d1",
        "libraryId": "hg_mc",
        "movementId": "library:hg_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d1_s5",
        "day": "Knee / horizontal",
        "order": 5,
        "name": "Cable lateral raise",
        "sets": 2,
        "min": 8,
        "max": 15,
        "primary": "Side delts",
        "secondary": "Traps",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d1_s5",
        "dayId": "growth_3_d1",
        "libraryId": "dl_cb",
        "movementId": "library:dl_cb",
        "progressionType": "rep_goal@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d1_s6",
        "day": "Knee / horizontal",
        "order": 6,
        "name": "Cable curl",
        "sets": 2,
        "min": 8,
        "max": 15,
        "primary": "Biceps",
        "secondary": "Forearms",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d1_s6",
        "dayId": "growth_3_d1",
        "libraryId": "cu_cb",
        "movementId": "library:cu_cb",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d2_s1",
        "day": "Hip / vertical",
        "order": 1,
        "name": "Romanian deadlift machine",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Hamstrings,Glutes",
        "secondary": "Spinal erectors",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d2_s1",
        "dayId": "growth_3_d2",
        "libraryId": "hg_mc",
        "movementId": "library:hg_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d2_s2",
        "day": "Hip / vertical",
        "order": 2,
        "name": "Assisted pull-up",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Lats",
        "secondary": "Biceps,Forearms",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d2_s2",
        "dayId": "growth_3_d2",
        "libraryId": "pd_bw",
        "movementId": "library:pd_bw",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d2_s3",
        "day": "Hip / vertical",
        "order": 3,
        "name": "Shoulder press machine",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Front delts",
        "secondary": "Triceps",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d2_s3",
        "dayId": "growth_3_d2",
        "libraryId": "sp_mc",
        "movementId": "library:sp_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d2_s4",
        "day": "Hip / vertical",
        "order": 4,
        "name": "Leg press",
        "sets": 3,
        "min": 8,
        "max": 12,
        "primary": "Quads",
        "secondary": "Glutes,Hamstrings,Calves",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d2_s4",
        "dayId": "growth_3_d2",
        "libraryId": "sq_lp",
        "movementId": "library:sq_lp",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d2_s5",
        "day": "Hip / vertical",
        "order": 5,
        "name": "Incline chest press machine",
        "sets": 3,
        "min": 8,
        "max": 12,
        "primary": "Chest",
        "secondary": "Front delts,Triceps",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d2_s5",
        "dayId": "growth_3_d2",
        "libraryId": "ip_mc",
        "movementId": "library:ip_mc",
        "progressionType": "rep_goal@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d2_s6",
        "day": "Hip / vertical",
        "order": 6,
        "name": "Standing calf raise machine",
        "sets": 2,
        "min": 8,
        "max": 15,
        "primary": "Calves",
        "secondary": "",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d2_s6",
        "dayId": "growth_3_d2",
        "libraryId": "cv_mc",
        "movementId": "library:cv_mc",
        "progressionType": "rep_goal@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d3_s1",
        "day": "Mixed",
        "order": 1,
        "name": "Barbell lunge",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Quads",
        "secondary": "Glutes,Hamstrings,Calves",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d3_s1",
        "dayId": "growth_3_d3",
        "libraryId": "lg_bb",
        "movementId": "library:lg_bb",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d3_s2",
        "day": "Mixed",
        "order": 2,
        "name": "Incline chest press machine",
        "sets": 3,
        "min": 4,
        "max": 8,
        "primary": "Chest",
        "secondary": "Front delts,Triceps",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d3_s2",
        "dayId": "growth_3_d3",
        "libraryId": "ip_mc",
        "movementId": "library:ip_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d3_s3",
        "day": "Mixed",
        "order": 3,
        "name": "Seated row machine",
        "sets": 3,
        "min": 8,
        "max": 12,
        "primary": "Mid/upper back",
        "secondary": "Biceps,Forearms",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d3_s3",
        "dayId": "growth_3_d3",
        "libraryId": "rw_mc",
        "movementId": "library:rw_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d3_s4",
        "day": "Mixed",
        "order": 4,
        "name": "Romanian deadlift machine",
        "sets": 3,
        "min": 8,
        "max": 12,
        "primary": "Hamstrings,Glutes",
        "secondary": "Spinal erectors",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d3_s4",
        "dayId": "growth_3_d3",
        "libraryId": "hg_mc",
        "movementId": "library:hg_mc",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d3_s5",
        "day": "Mixed",
        "order": 5,
        "name": "Cable lateral raise",
        "sets": 2,
        "min": 8,
        "max": 15,
        "primary": "Side delts",
        "secondary": "Traps",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d3_s5",
        "dayId": "growth_3_d3",
        "libraryId": "dl_cb",
        "movementId": "library:dl_cb",
        "progressionType": "rep_goal@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      },
      {
        "id": "ex_growth_3_d3_s6",
        "day": "Mixed",
        "order": 6,
        "name": "Cable curl",
        "sets": 2,
        "min": 8,
        "max": 15,
        "primary": "Biceps",
        "secondary": "Forearms",
        "notes": "",
        "alternates": [],
        "slotId": "growth_3_d3_s6",
        "dayId": "growth_3_d3",
        "libraryId": "cu_cb",
        "movementId": "library:cu_cb",
        "progressionType": "range@1",
        "targetRirStart": 1,
        "targetRirEnd": 3,
        "minSets": 2,
        "maxSets": 4
      }
    ],
    "log": [
      {
        "session": "2026-09-08_Day 1_seed01",
        "date": "2026-09-08",
        "day": "Day 1",
        "name": "Leg press",
        "exerciseId": "ex_growth_3_d1_s1",
        "set": 1,
        "load": 120,
        "reps": 10,
        "rir": 2,
        "notes": "",
        "created": "2026-09-08T18:00:00.000Z",
        "performedName": "Leg press",
        "performedLibraryId": "sq_lp"
      }
    ],
    "programHistory": [],
    "customExercises": [
      {
        "id": "custom:c01",
        "name": "Landmine press",
        "namePt": "Desenvolvimento landmine",
        "archived": false,
        "equipment": [
          "barbell"
        ],
        "primary": "Chest",
        "secondary": "Triceps",
        "notes": "Stubborn shoulder",
        "patterns": [],
        "beginnerFriendly": true,
        "custom": true,
        "created": "2026-09-10T08:00:00.000Z"
      }
    ]
  },
  "workoutDraft": null,
  "programEntryDraft": null,
  "uiPreferences": {
    "theme": "system"
  },
  "analytics": {
    "enabled": true
  },
  "telemetryIdentity": {
    "schemaVersion": 1,
    "installationId": "3e1f5c8a-9d02-4b77-8a31-6e4d2c9f0ab5",
    "createdAt": "2026-08-01T10:00:00.000Z"
  },
  "integrity": {
    "canonicalPayloadHash": "a2989b2293c1c700a8dd9087b1ae856d5ed80c7eda8e2eefd048584c51812915"
  }
}
```

Executable fixture: `test/fixtures/install-transfer-clone-v1.json` holds the
exact envelope above; `node tools/canonical-clone-hash.mjs --check` recomputes
its digest under the documented rule, verifies it against the recorded value,
and proves the helper accepts frozen input without mutation.

## Server record and endpoints

The bearer token travels in request bodies only, never in a URL path, query
string, fragment, or loggable surface. URL shapes below are exact; an
implementation may not move the token into the path.

### Token-derived server-side encryption

The service generates a one-time token with at least 256 bits of cryptographic
randomness. It derives the per-transfer AES-256-GCM key with HKDF-SHA-256 from
the token bytes, a fresh random salt, and domain-separated information that
includes the transfer-encryption protocol version. The service may store the
random salt, nonce, and associated data with the ciphertext. It stores only a
keyed token digest for lookup. It returns the token once, keeps neither the
token nor the derived encryption key after the request, and never stores the
derived key.

A long-lived HMAC pepper may authenticate token and IP digests. That pepper is
not an encryption key and cannot decrypt a clone. AES-GCM authenticates the
schema, transfer identifier, creation time, expiry, and protocol version as
associated data. A restored Cloudflare recovery image may contain ciphertext,
salt, nonce, and associated data for up to 30 days, but the image alone cannot
decrypt the ciphertext after the live token and derived key have been discarded.

This is server-side encryption, not end-to-end encryption. Cloudflare
transiently sees plaintext while it validates and creates the encrypted record
and while it decrypts a claimed record for the installed client. The browser
and service use TLS in transit. Intentional Safari and installed-app local
copies remain outside remote deletion.

1. `POST /v1/transfers` with `{envelope, idempotencyKey}`: validate envelope
   and size, assign `expiresAt <= serverNow + 60 minutes`, derive the
   token-bound AES-256-GCM key, encrypt with a per-record nonce and stored
   random salt, and store only a keyed token digest alongside the
   idempotency key, and return the plaintext opaque token plus absolute
   expiry exactly once — on first creation only. A retry carrying a known
   idempotency key while its record is still live returns
   `{duplicate: true, expiresAt}` with NO token: the server cannot reproduce
   a bearer it never stored. The client seals the received token to its
   local outbound marker immediately (see commit credentials), so a crash
   after receipt stays recoverable; a client that never received the token
   starts over with a new key after the orphan expires. One key never yields
   two live records.
2. `POST /v1/transfers/claims` with `{token, claimId}`: atomically bind an
   `available` transfer to the client-generated claim ID (128+ bits) and
   return the clone to that same claim on safe retries. Every other claim ID
   receives a generic unavailable response with uniform invalid/expired/
   claimed shape.
3. `POST /v1/transfers/claims/commit` with `{token, claimId}`: accept the
   bound claim and delete ciphertext immediately. A minimal non-sensitive
   tombstone retains only token digest, terminal state, and original expiry
   to communicate one-time/recovery status; it contains no clone or identity
   and is purged after the tombstone margin below.
4. `POST /v1/transfers/status` with `{token}`: return `{state, expiresAt}`
   and nothing else — no clone, no identity. This is how the creating Safari
   learns the outcome (see Safari polling below).
5. Expiry processing: an independent process deletes ciphertext at or before
   60 minutes even when the client never returns. The terminal tombstone
   lives longer: original expiry plus a 15-minute tombstone margin, so a
   `claimed-expired` record stays learnable through Safari's 10-minute
   post-expiry polling window with 5 minutes of slack. Monitor the oldest
   live record and deletion lag.

Tokens carry at least 256 random bits and are never stored plaintext. Server
states are `available`, `claiming`, `deleted`, `expired`, and
`claimed-expired`; ciphertext exists only in the first two. A `claiming`
record whose commit is never confirmed expires into `claimed-expired` — the
import may have completed — and its tombstone (digest, terminal state,
original expiry, no clone or identity) persists through the 15-minute
tombstone margin so the creating Safari can learn it. `expired` strictly
means never claimed.

```text
available ──claim──▶ claiming ──commit──▶ deleted
    │                   │
    │                   └──expiry──▶ claimed-expired
    └──expiry──▶ expired
```

Responses use TLS, strict origin/CORS, `Cache-Control: no-store`, no
redirect, bounded bodies, and rate limiting. AEAD tamper failure, unique
nonces, entropy, and token-key disposal across the maximum lifetime are tested;
structured logs and traces must contain no token, claim ID, ciphertext,
envelope fields, or request body.

Create abuse control uses a separate short-lived rate-limit Durable Object.
Each bucket is keyed by an HMAC of the client IP with the rotating long-lived
pepper. The service never stores a raw IP, links a bucket to a transfer or
token, or keeps a bucket longer than two minutes. The exact create limit is
five requests per minute per IP. Claim, commit, and status limits are
sixty requests per minute per token. Pepper rotation invalidates old bucket
keys without changing transfer decryption.

## Threat model

Each row names the threat, the controlling mitigation, and where it is
specified. Residual risk is accepted and disclosed, never defined away.

| # | Threat | Control |
|---|---|---|
| T-01 | Token theft, including a bearer observed in static-host access logs before the legitimate claim | 256-bit bearer; digest-only storage; first-claim-wins binding; prompt claiming; ≤60-minute window; `Cookie`-header log redaction requirement. A pre-claim bearer CAN claim the clone — the window is narrowed, not closed |
| T-02 | Brute force against tokens or claim IDs | 256-bit token / 128-bit claim entropy; digest lookup; rate limits; constant-shape failures |
| T-03 | Replay or a second claimant | Atomic `available → claiming → deleted`, with uncommitted claims expiring into `claimed-expired`; bound claim retries only until commit or expiry |
| T-04 | Log, referrer, or trace leakage of bearer, clone, or envelope fields | Ban from logs, analytics, error tracking, referrers, foreign URLs, fixtures, screenshots; sealed local credentials; redacted static-host logs |
| T-05 | Malicious or stale tabs racing create, claim, or resume | Claim-ID binding; source operation lock; validate-before-touch; versioned import marker; cross-tab freeze |
| T-06 | Service or operator access to the clone | Token-derived server-side AEAD; Cloudflare transient plaintext access is disclosed; minimal one-hour retention; commit-verified deletion; kill switch and purge runbook |
| T-07 | Oversized or malformed payloads and envelopes | Schema/depth/size bounds enforced before and during parsing; unknown required versions fail closed |
| T-08 | Cross-origin requests | Exact-origin CORS; content-type enforcement; no redirects |
| T-09 | Interrupted create, claim, import, or commit | Pre-request outbound marker with phase-specific fields; same-key create dedupe (duplicate returns expiry without the token); same-claim retry; two-sided sealed markers; boot finish-or-restore; idempotent remote commit retry |
| T-10 | Clock skew between client, server, and expiry job | Absolute server-issued expiry; skew-tolerant acceptance window documented by the implementer; server clock owns expiry |
| T-11 | Expiration backlog or purge failure | Expiry-job monitoring with deletion-latency bounds; alarm and kill switch; manual purge runbook; no new creates while deletion health is uncertain |
| T-12 | Token-derived-key compromise or disposal gap | The service keeps the token and derived key only in request memory; recovery images may retain ciphertext for up to 30 days, but cannot decrypt it without the discarded token; creation is disabled if key/config health is uncertain |
| T-13 | Sealed commit-credential loss (key wiped, profile reset) | Unrecoverable by design; 60-minute expiry plus purge backstop; local data never at risk; fresh-transfer user guidance |
| T-14 | Status-polling oracle or unknown-outcome confusion | Status returns state plus expiry only, to the bearer holder alone; every indeterminate outcome — Safari-outbound credential loss, poll exhaustion, service failure, or status unavailability — routes into the non-silent G-88 divergence-warning path, never a silent browser continue (installed-inbound credential loss is the separate deletion-retry fault, not an unknown outcome) |

## iOS handoff cookie

Phase 049 selects the handoff key: **`repforge_transfer_v1`**.
Historical-codename-compatible, distinct from `repforge_setup_v1`, which it
never overloads — a setup proposal and a full-state transfer may coexist and
are disambiguated deterministically. The cookie carries only the opaque token
and expiry, never the clone: matching `index.html` path, short lifetime,
`SameSite=Lax`, and `Secure` outside localhost. The installed context
consumes and expires its transfer cookie before ordinary boot writes state.
Token values never enter fragment/history, DOM text, telemetry, console,
service-worker cache keys, or screenshots.

### The static host necessarily receives the cookie

The matching static host gets the token in the `Cookie` request header, and
ordinary access logs record request headers. This is accepted with layered
controls, stated here so no later document can soften it:

- The logged value is useful only before the legitimate claim: the first
  claim ID to bind wins, the installed client claims within seconds of
  install, and the record dies on verified-import commit or within one hour. It is NOT true
  that a logged token is harmless: anyone holding an unclaimed bearer can
  claim and retrieve the clone before the legitimate client does. The
  controls below narrow that window; they do not close it, and the residual
  risk is accepted and disclosed rather than defined away.
- Processor trust is explicit: the static-host operator (token header, timing)
  and the transfer operator (encrypted clone, claim behavior) can each
  observe what they handle. Do not claim end-to-end encryption unless the
  server truly cannot decrypt.
- Operational requirement: static-host and Cloudflare edge access logs covering
  transfer-period requests have bounded retention with `Cookie`, request-body,
  token, and full-URL values stripped or redacted, plus a manual purge runbook.
  The service fails new creates when log health is uncertain. The Privacy page
  names global edge ingress and the EU Durable Object boundary; it does not
  claim that Cloudflare never sees the data.
- The user-facing disclosure names the temporary copy, its one-hour life,
  commit-verified deletion, token-cookie transport including static-host
  receipt, Safari retention, and recovery/divergence behavior.

## Atomic local import

A versioned `repforge_install_import_v1` transaction marker travels the
existing durable write path:

```text
transactionId, claimIdDigest, phase
previous: validated logical local clone
incoming: validated logical clone
createdAt, expectedLocalRevision
```

1. Before app initialization exposes mutable UI, read the handoff token,
   stage the `repforge_transfer_inbound_v1` marker with the sealed token and
   a stable client-generated claim ID, then claim.
2. Validate all envelope sections and the canonical hash in memory.
3. Acquire the cross-tab state/draft/import lock; freeze other tabs via
   BroadcastChannel/storage signaling.
4. Stage the marker with complete previous and incoming snapshots.
5. Write normalized durable state through the existing mirror/WAL path,
   write or remove DraftV2 and the candidate draft, then
   preferences/consent/identity.
6. Re-read and validate every section and identity; set marker
   `local-committed`.
7. Release into installed boot, call remote commit/delete, then clear the
   marker after confirmed or retryable deletion bookkeeping.

On boot, an incomplete marker either finishes the entire incoming import if
the committed sections and hash prove safe, or restores the entire previous
snapshot. Mixed state is never exposed. Failure before local commit leaves current
installed state unchanged. If the installed context already holds meaningful
local state, stop and require explicit choice; never overwrite automatically.
Client states: `idle`, `creating`, `ready`, `claiming`, `validating`,
`importing`, `localCommitted`, `deletingRemote`, `complete`, `retryable`,
`terminalUnavailable`, `unknown-outcome` (indeterminate result — Safari-outbound
credential loss, poll exhaustion, service failure, unavailable status, or
post-purge polling; always follows the G-88 divergence-warning path, never
silent continuation). Identical to Plan 053's client enum.

### Commit credentials (crash-safe remote deletion on both sides)

Remote commit needs the plaintext token and claim ID, but each side keeps
only digests in its durable markers — so a crash after local commit (or
after claim binding) would strand the ciphertext with no retry path. Each
storage context therefore seals its own credentials locally; the Safari
outbound marker and the installed inbound marker never cross contexts:

- At creation, the Safari side writes a single local-only
  `repforge_transfer_outbound_v1` marker BEFORE the create POST:
  `{idempotencyKey, sealedToken?, tokenDigest?, createdAt, expiresAt?,
  sourceRevision, mutatedAfterCreation, phase}` with phase `creating`. The
  token-dependent fields are present only after the response: when the token
  arrives the same marker is updated in place to `awaiting-claim` with
  `sealedToken`, `tokenDigest`, and `expiresAt` filled. A crash before the
  response leaves a `creating` marker that still holds the idempotency key
  and creation timestamp — on reboot Safari retries the create with that
  same key: a live record answers `{duplicate: true, expiresAt}` (no token;
  the orphan dies at expiry and Safari starts a new transfer then), a
  terminal record is confirmed and the marker cleared. One key never yields
  two live records, and the fault test for this exact boundary is required
  (crash between staged marker and response). Safari never learns the
  installed app's claim ID and never needs it: creation retry uses the
  idempotency key, outcome polling uses the token. There is no second
  Safari-side marker.
- `sourceRevision` captures the durable revision counter at creation, and
  creation takes the source operation lock so two Safari tabs cannot mint
  competing transfers. Any local mutation after creation sets
  `mutatedAfterCreation`, which the success messaging surfaces (see
  recovery).
- On receiving the token and BEFORE sending the claim request, the installed
  side writes a local-only `repforge_transfer_inbound_v1` marker:
  `{sealedToken, sealedClaimId, expiresAt, phase}` with phase starting at
  `staged`, advancing to `claiming` when the request is sent, then
  `local-committed` and finally `delete-confirmed`.
  A crash after claim binding resumes the same claim ID from this marker; a
  crash after local commit retries the remote commit from it.
- Sealing uses device-local WebCrypto AES-GCM under a non-extractable device
  key held in that context's IndexedDB outside backup scope. Plaintext
  credentials never touch logs, backup, telemetry, or the DOM.
- After the remote commit is confirmed, the completing side wipes its marker
  and the device key material for that transfer.
- Unsealing failure is context-specific. Installed inbound credential
  loss (key lost, profile reset) makes deletion retry impossible: the record
  dies at tombstone expiry (plus the purge runbook as backstop), the
  imported state stays live, and Safari still learns the terminal state
  through polling — no divergence warning is needed. Safari outbound
  credential loss means Safari can never prove the outcome: it enters
  `unknown-outcome` and follows the G-88 divergence-warning path exactly
  like every other indeterminate outcome. Both fallbacks are documented in
  the user-facing failure copy; "start a fresh transfer" is never offered
  for an indeterminate Safari outcome.
- Markers are excluded from backup export/import exactly like token and
  import markers (Plan 053), and are wiped no later than expiry plus an
  operational margin.

## Browser recovery snapshot

Safari retains its original data. It learns the outcome by polling, never by
a shared channel (none exists across the Safari/installed storage boundary):

1. At creation Safari writes the outbound marker above and keeps the token
   in memory (own cookie as fallback while it lives).
2. After handing off to installation, Safari polls `POST
   /v1/transfers/status` with the token, backing off from 5 seconds to 60
   seconds, until a terminal state or `expiresAt` plus a 10-minute margin.
3. On `deleted`, Safari stores the recovery-snapshot marker (tied to token
   digest and time) and freezes mutating UI: a message directs the user to
   the installed app, plus read/recovery/backup access. If
   `mutatedAfterCreation` is set, the message adds that the source changed
   after sending and the installed copy may be stale.
4. On `claimed-expired` — a claim was bound but the commit was never
   confirmed, so the import MAY have completed — Safari must NOT silently
   resume. It freezes exactly as in (3), with copy stating the transfer may
   have completed and directing the user to the installed app. This is the
   divergence case G-88 governs: two active copies are possible, and only an
   explicit divergence warning may resume browser use.
5. On `expired` with no claim ever bound, Safari clears the outbound marker
   and resumes normal use — the transfer never completed and nothing local
   ever changed. This is the only silent-resume path.
6. If Safari restarts with an outbound marker, it first attempts to unseal
   the token from that marker and resume polling at step 2 — a normal
   restart must not lose a recoverable transfer.
7. Any indeterminate outcome enters the same non-silent path as credential
   loss. Poll exhaustion at `expiresAt` plus margin without a terminal
   state, a service outage or unavailable status response, or polling after
   the tombstone has been purged all mean the outcome cannot be proven —
   and the installed PWA may already have imported the clone. Safari shows
   the unknown-outcome state (check the installed app; the transfer window
   and its expiry are shown). If the installed app holds the data, Safari
   treats the transfer as complete (freeze plus snapshot marker). Otherwise
   resuming browser use requires the explicit G-88 divergence warning and
   confirmation — plain dismissal is prohibited, because silent divergence
   is exactly what this lifecycle exists to prevent. Ordinary browser
   continuation without the warning is permitted only before transfer
   creation or on `expired` with no claim ever bound.

`Resume in browser` presents an explicit divergence warning — future browser
and installed changes will not merge — and confirmation removes the freeze
only in Safari while recording accepted divergence. Recovery snapshot states:
`none`, `awaitingClaimOutcome`, `confirmed`, `resumeWarning`,
`resumedDiverged`. There is no mechanism that writes installed changes back
to Safari.

## Telemetry

Emit `late_install_transfer` only after verified local import and according
to transferred consent. Approved properties: coarse outcome (`success` for
this event; separate coarse failure counters need Phase 049 approval),
`source_context: browser`, `destination_context: standalone`, platform
family, and schema version. Preserve `installationId`; never generate a
second identity before event initialization. Never emit the token, claim ID,
timestamps precise enough to correlate service records, payload
size/content, program identity, or readiness data.

## Privacy disclosure checklist

The cached Privacy page is the full user disclosure. It names Cloudflare and
states all of the following:

- The logical clone includes normalized durable program and workout state,
  history, archive and provenance, the active DraftV2 section, the unfinished
  program-entry candidate section, UI preferences, analytics consent, and the
  stable telemetry identity. Volatile locks, journals, transaction markers,
  cookies, permissions, cache state, and provider session state are excluded.
- Cloudflare transiently sees plaintext while it validates and creates the
  record and while it claims and returns the clone. The transfer uses TLS and
  token-derived server-side AES-256-GCM. It is not end-to-end encryption.
- The service never stores the one-time token or its derived encryption key.
  It stores the token digest, ciphertext, nonce, associated data, and allowed
  random salt. A Cloudflare recovery image may retain ciphertext for up to 30
  days, but a restored image alone cannot decrypt it after expiry.
- The live ciphertext is deleted after verified local import and commit, or no
  later than minute 60. A payload-free tombstone containing only the token
  digest, terminal state, and original expiry remains through minute 75.
- The transfer requires a network connection. Global Cloudflare edge ingress
  can handle the request before durable storage and Durable Object processing
  in the EU. The static-host handoff cookie carries only the opaque token and
  is sent with the matching HTML request.
- Create abuse counters use HMAC-derived IP buckets in a separate rate-limit
  Durable Object. The buckets last no more than two minutes, store no raw IP,
  and are not linked to a transfer or token.
- Safari keeps its original local data. After a verified import, Safari enters
  recovery-snapshot mode. Unknown outcomes require the explicit divergence
  warning before browser use resumes. Browser and installed changes never
  synchronize.
- Analytics consent, telemetry identity, and UI preferences transfer with the
  logical clone. This transfer is neither an account nor synchronization.

The page also states that intentional Safari and installed-app local copies
remain on their devices. It never claims end-to-end encryption, that Cloudflare
never sees the data, or that all copies are deleted within one hour. It never
places a token, payload, clone field, or full URL in logs, analytics, error
tracking, referrers, screenshots, or support fixtures.

## Operations

The owner monitors the expiry deadline, deletion latency, purge job, alarms,
watchdog, key and pepper configuration, and sensitive-log redaction. The
$10/month threshold applies to new creates. Billing lag means the threshold
is not a hard cap. At the threshold, new creates fail and alert the owner;
claims, status, commit, and purge continue during a small overrun. The owner
raises the threshold only by explicit approval.

The service fails new creates when retention, alarm/watchdog, key/config, or
log health is uncertain. Manual re-enable requires a runbook check for
deletion deadlines, purge completion, alarms, configuration, and clean logs.
The purge path covers ciphertext by minute 60 and tombstones through minute
75. It also accounts for Cloudflare recovery images that can retain ciphertext
for up to 30 days without retaining the token-derived decryption key.

The owner publishes an incident notice for confirmed token or payload exposure,
decryptable retention past the promise, or a material processor breach. A
routine outage or lag for ciphertext that is already unreadable does not by
itself trigger a public notice, subject to legal duties. The kill switch
removes new promotion and creation without stranding local data. A service
outage never blocks ordinary browser use, setup links, backups, or manual
installation. Service-worker fetch handlers never cache transfer requests or
responses.

## Specified UI states (no visual design)

Transfer: unavailable, eligible, creating, ready-to-install, claiming,
importing, success/recovery-snapshot, invalid, expired, already-claimed,
interrupted/retryable, service-disabled, unknown-outcome, divergence-warning.
Recovery-week states live in `docs/recovery-week-policy.md`. Plans must never claim that
installation is required for offline use or that it supplies native-grade
reminders or storage durability.
