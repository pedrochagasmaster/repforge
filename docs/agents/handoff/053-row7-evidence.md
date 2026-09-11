# Plan 053 Row 7: Service & Operations Evidence

- **Packet / Row**: Plan 053 Row 7 (Service / Operations Evidence)
- **Worktree**: `/home/ubuntu/repforge-ui-053-install-transfer`
- **Service Directory**: `/home/ubuntu/repforge-ui-053-install-transfer/services/install-transfer`
- **Date**: 2026-09-11
- **Status**: Historical local packet at `5074c4eefc389d45adc93c4c2f6d133b01ee3f22`; not current-candidate acceptance evidence. Staging gates remain open.

---

## 1. Executive Summary & Verification Matrix

All environment-independent service contracts, operational runbooks, and negative-result lifecycle paths have been verified locally. The service enforces fail-closed operations, 60-minute ciphertext expiry, 75-minute tombstone disposal, incident latching, billing limits, diagnostic redaction, and create-disabled recovery availability.

| Verification Item | Requirement | Local Result | Automated Test / Assertion Reference |
|---|---|---|---|
| Service test suite | `npm test` | **PASS** (14 files, 65 tests passed; health producer integration passed) | `npm --prefix services/install-transfer test` |
| Static & source checks | `npm run check` | **PASS** (14 source files, 5 scripts, Wrangler config) | `npm --prefix services/install-transfer run check` |
| Dry-run deployment bundle | `npm run deploy:dry` | **PASS** (162.20 KiB upload / 31.87 KiB gzip; 4 DO bindings) | `npm --prefix services/install-transfer run deploy:dry` |
| Staging / Auth Status | `wrangler whoami` | **CONFIRMED UNAUTHENTICATED** (Expected open gate, no mock deployment) | `wrangler whoami` |
| Minute-60 ciphertext expiry | Expiry at 60m deletes ciphertext immediately | **VERIFIED** | `transfer-do.test.js`: `distinguishes unclaimed expiry from claimed-expired and purges the tombstone` |
| Minute-75 tombstone / purge | Purge at 75m deletes alarm and all SQLite tables | **VERIFIED** | `transfer-do.test.js`: `storageSummary: { alarm: null, tables: [] }` |
| Provider object disposal & restored image | Complete teardown; no secret/bearer persistence in SQLite image | **LOCAL MODEL VERIFIED; PROVIDER RESTORE OPEN** | `transfer-do.test.js`: disposal failure recovery, ambiguous disposal recovery, alarm delete order, deduplicated create hygiene; authenticated provider restore remains required |
| Watchdog & deletion-lag behavior | 5-minute lease expiry; deletion incident latches until generation ack | **VERIFIED** | `health-do.test.js`: fresh lease requirement, deletion incident latching & rollback; `ops.test.js` |
| Billing kill-switch behavior | >= 1,000 cents or > 24h stale observation disables creates | **VERIFIED** | `health-do.test.js`: `recordBilling` threshold & age checks; `operations.test.js`: `TRANSFER_KILL_SWITCH` |
| Sensitive-log & redaction verification | Zero bearer, claimId, clone, ciphertext, or full URL in logs/diagnostics | **VERIFIED** | `test/install-transfer-limits.mjs`: 5 redaction channels, canary omission checks; `health-producer.integration.mjs` |
| Create-disabled recovery availability | When creates are disabled, claim, status, commit, and purge remain available | **VERIFIED** | `http.test.js`: existing transfer claim/commit/status while deletion unhealthy; `src/index.js` route guards |

---

## 2. Command Execution Evidence

### 2.1. `npm test`
Executed in `services/install-transfer`:
```text
> test
> vitest run && node test/health-producer.integration.mjs

 RUN  v4.1.11 /home/ubuntu/repforge-ui-053-install-transfer/services/install-transfer

 ✓ test/transfer-do.test.js (11 tests) 784ms
 ✓ test/http.test.js (5 tests) 593ms
 ✓ test/client-http.test.js (3 tests) 572ms
     ✓ uses actual normalized producers and preserves an independently hashed six-section clone  305ms
 ✓ test/ops.test.js (8 tests) 552ms
 ✓ test/registry-do.test.js (5 tests) 488ms
 ✓ test/health-do.test.js (4 tests) 365ms
 ✓ test/rate-limit.test.js (6 tests) 251ms
 ✓ test/observation.test.js (5 tests) 10ms
 ✓ test/routing.test.js (5 tests) 15ms
 ✓ test/crypto.test.js (3 tests) 11ms
 ✓ test/transport.test.js (3 tests) 11ms
 ✓ test/namespaces.test.js (2 tests) 6ms
 ✓ test/operations.test.js (2 tests) 10ms
 ✓ test/lifetime.test.js (3 tests) 5ms

 Test Files  14 passed (14)
      Tests  65 passed (65)
   Start at  00:25:27
   Duration  16.53s (transform 273ms, setup 0ms, import 1.48s, tests 3.67s, environment 3ms)

health producer integration passed
```

### 2.2. `npm run check`
Executed in `services/install-transfer`:
```text
> check
> node scripts/check.mjs

checked 14 service source files, 5 scripts, and Wrangler configuration
```

### 2.3. `npm run deploy:dry`
Executed in `services/install-transfer`:
```text
> deploy:dry
> wrangler deploy --dry-run

 ⛅️ wrangler 4.130.0
────────────────────
Total Upload: 162.20 KiB / gzip: 31.87 KiB
Your Worker has access to the following bindings:
Binding                                                          Resource
env.TRANSFER_OBJECTS (TransferDurableObject)                     Durable Object
env.RATE_LIMIT_BUCKETS (RateLimitDurableObject)                  Durable Object
env.TRANSFER_HEALTH (TransferHealthDurableObject)                Durable Object
env.TRANSFER_REGISTRY (TransferRouteRegistryDurableObject)       Durable Object

--dry-run: exiting now.
```

### 2.4. `wrangler whoami` & Staging Status
Executed in `services/install-transfer`:
```text
 ⛅️ wrangler 4.130.0 (update available 4.131.0)
───────────────────────────────────────────────
Getting User settings...
You are not authenticated. Please run `wrangler login`.
To deploy without logging in, run a command like `wrangler deploy --temporary` to use a temporary preview account.
```
**Staging Status**: As strictly mandated by Plan 053 operational guardrails, no temporary preview account or unauthenticated deployment was initiated. The environment is unauthenticated, which is an expected, documented open gate pending owner Cloudflare credentials.

---

## 3. Deep Architectural & Behavioral Verification

### 3.1. Minute-60 Ciphertext Expiry
- **Specification**: `LIVE_WINDOW_MS = 60 * 60 * 1000` (60 minutes).
- **Behavior**:
  - Expiry is calculated as `Math.min(requestedExpiry, serverNow + LIVE_WINDOW_MS)`.
  - When `serverNow >= record.expires_at`, `_expireIfDue(now)` invokes `_setTerminal(record, nextState)`.
  - The SQL update executes:
    ```sql
    UPDATE transfer_records
    SET state = ?, envelope_ciphertext = NULL, envelope_salt = NULL,
        envelope_nonce = NULL, envelope_aad = NULL, claim_digest = NULL,
        idempotency_digest = NULL, created_at = NULL, claimed_at = NULL,
        record_version = NULL, transfer_id = NULL
    WHERE singleton = 1 AND state = ? AND token_digest = ?
      AND expires_at = ? AND tombstone_until = ?
    ```
  - State transitions to `expired` (if previously `available`) or `claimed-expired` (if previously `claiming`).
  - **Evidence**: In `test/transfer-do.test.js`, asserting `availableStored[0].envelope_ciphertext === null` at timestamp `baseNow + 10`.

### 3.2. Minute-75 Tombstone / Purge Boundary
- **Specification**: `TOMBSTONE_MARGIN_MS = 15 * 60 * 1000` (15 minutes). Total retention = 60m live + 15m tombstone = 75 minutes.
- **Behavior**:
  - While in tombstone state, the object retains only minimal routing metadata (`singleton`, `state`, `token_digest`, `expires_at`, `tombstone_until`) to answer status inquiries idempotently and prevent duplicate reuse of the idempotency key.
  - When `now >= record.tombstone_until`, `_disposeStorage()` is executed:
    1. `await this.ctx.storage.deleteAlarm();`
    2. `await this.ctx.storage.deleteAll();`
    3. `this.schemaReady = false; this.storageDisposed = true;`
  - **Evidence**: Verified in `test/transfer-do.test.js`: at `baseNow + 15 * 60_000 + 10`, `rows(claimedStub)` returns empty array `[]`, and `storageSummary` confirms `{ alarm: null, tables: [] }`.

### 3.3. Local Disposal Model; Provider Restored-Image Gate Open
- **Zero lingering artifacts**:
  - Durable Object alarms are stored inside the DO storage engine. Deleting the alarm prior to `deleteAll()` ensures no trailing metadata remains.
- **Disposal Failure & Recovery**:
  - If `deleteAll()` throws, disposal fails closed: `storageDisposed` remains false, deletion health is latched unhealthy via `_markDeletionUnhealthy()`, and a bounded alarm (`DISPOSAL_RETRY_MS = 60,000`) is armed.
  - If `deleteAll()` succeeds but the network acknowledgement is dropped, the subsequent invocation cleanly completes without recreating tables.
- **Local SQLite storage-model inspection**:
  - The SQLite table schema contains: `singleton`, `state`, `record_version`, `transfer_id`, `idempotency_digest`, `token_digest`, `envelope_ciphertext`, `envelope_salt`, `envelope_nonce`, `envelope_aad`, `claim_digest`, `expires_at`, `tombstone_until`, `created_at`, `claimed_at`.
  - At no point is a raw bearer token, AEAD key, claim ID, or plaintext payload stored in SQLite.
  - Local cold-rescan tests contain only encrypted bytes, keyed HMAC digests, or nullified columns after the terminal transition. They do not prove Cloudflare provider backup/restore behavior; authenticated staging restore evidence remains open.

### 3.4. Watchdog and Deletion-Lag Behavior
- **Watchdog Signal Lease**:
  - `HEALTH_SIGNAL_MAX_AGE_MS = 300,000` (5 minutes).
  - Create admission requires positive, fresh observations across 5 domains: `alarm`, `watchdog`, `log`, `key`, `deletion`.
  - If watchdog reports are delayed by > 5 minutes, `leaseFresh` becomes false, instantly disabling `createsEnabled`.
- **Deletion-Lag Latching**:
  - Any disposal failure or purge error trips `markDeletionUnhealthy()`.
  - The health DO records `deletion_healthy = 0` and increments `incident_generation`.
  - **Crucial Invariant**: Even if subsequent regular heartbeats report healthy, deletion health stays latched false until an explicit operator acknowledgement is submitted (`acknowledgeDeletion`) with matching current `generation` and 32-character `proofNonce`.
  - Verified atomic transaction rollback in `test/health-do.test.js` prevents partial acknowledgement or masked failures.

### 3.5. Billing Kill-Switch Behavior
- **Cost Threshold**:
  - `CREATE_COST_THRESHOLD_CENTS = 1,000` ($10.00 / month).
  - Monthly billing evidence is validated via `recordBilling()`.
  - If `monthlyCostCents >= 1,000`, `billingHealthy` evaluates to `false`, immediately disabling creates.
  - If billing receipt age exceeds `BILLING_EVIDENCE_MAX_AGE_MS = 86,400,000` (24 hours), `billingHealthy` evaluates to `false`.
- **Operator Kill Switch**:
  - Environment variable `TRANSFER_KILL_SWITCH = "true"` forces public endpoints to return generic `503 {"state":"unavailable"}`.

### 3.6. Sensitive-Log & Redaction Verification
- **Redaction Protocol**:
  - Enforced across 5 observation channels: `service-structured-log`, `static-host-access-log`, `client-response-observable`, `telemetry`, and `error-tracking`.
  - Explicitly forbidden in any observable log: `token`, `claimId`, `ciphertext`, `envelope`, `body`, `payload`, `fullUrl`, `cookie`.
- **Transport Hygiene**:
  - All token and claim exchanges occur strictly in HTTP request bodies (`POST /v1/transfers/claims`, `POST /v1/transfers/status`), never in URLs or query strings.
  - Verified in `test/http.test.js`: `expect(create.url).not.toContain(created.token)` and `expect(status.url).not.toContain(created.token)`.
  - Independent oracle `test/install-transfer-limits.mjs` verifies that every redaction canary is filtered and that error shapes contain only fixed enum codes (`{ ok: false, code }`) without detailed reflection.
  - `scripts/health-producer.mjs` verifies stdout/stderr contain zero provider tokens or watchdog secrets.

### 3.7. Create-Disabled while Recovery Remains Available
- **Architectural Seam**:
  - In `src/index.js`, `handleCreate` explicitly evaluates `operationalServiceHealth(env)`:
    ```javascript
    const health = await operationalServiceHealth(env);
    if (!health.createsEnabled) return unavailable(503, headers);
    ```
  - Conversely, recovery endpoints (`handleClaim`, `handleCommit`, `handleStatus`, `handleOperations`) **do not** require `createsEnabled`.
  - When creates are disabled (due to kill-switch, unacknowledged deletion incident, billing threshold, or stale health lease):
    - Public `POST /v1/transfers` returns `503 {"state":"unavailable"}`.
    - Public `POST /v1/transfers/claims`, `POST /v1/transfers/claims/commit`, and `POST /v1/transfers/status` remain active and functional for already-created transfers.
    - Private `/_ops/purge-due` and `/_ops/purge-objects` remain fully functional to purge remaining data.
  - **Evidence**: Verified in `test/http.test.js` where `markDeletionUnhealthy` is called, and existing transfer claim and commit proceed to HTTP 200 `{ state: "deleted" }`.

---

## 4. Open Operational Gates (Owner Action Required)

The following gates are intentionally kept open and cannot be closed in local or simulated environments without owner credentials and physical devices:

1. **Owner Cloudflare Staging Deployment**: Requires owner authentication (`wrangler login`), binding to an EU Durable Object namespace (`TRANSFER_OBJECTS`, `TRANSFER_HEALTH`, `RATE_LIMIT_BUCKETS`, `TRANSFER_REGISTRY` in EU subnamespace).
2. **Real Cloudflare Log Audit**: Owner verification of Cloudflare Edge & Worker logs to confirm that access logs and console output omit token headers and URL parameters.
3. **Physical iOS 17.2+ Safari-to-PWA Handoff**: Physical device validation of Safari cookie preservation, Home Screen PWA isolated storage, atomic import, and browser recovery snapshot.
4. **Billing & Watchdog Scheduled Automation**: Cron trigger setup for `health-producer.mjs` and verification of live Cloudflare API token enumeration.

---

## 5. Conclusion

This historical packet closes only its named local assertions. Authenticated staging, provider restore/disposal, real logs, scheduled automation, and physical-device acceptance remain open; no production or temporary-preview deployment was used.
