# Production install-transfer deletion incident (found 2026-10-24): read-only investigation

Investigated 2026-10-30 using read-only operations only: `npm run ops:health-status`,
`wrangler deployments list`, a five-minute `wrangler tail` of the watcher, the runbook's
provider listing of the Durable Object namespace (counts and flags only), the devbox
journal, and the source at `646ff2fa`. No ack, purge, deploy or setting change was made.
Production transfers stay latched off until the owner decides.

## State now (2026-10-30 00:34 UTC)

`ops:health-status`: `leaseFresh: true`, `deletionHealthy: false`,
`billingHealthy: true`, `createsEnabled: false`, `incidentGeneration: 3`,
`ackGeneration: 1`. Claims, status, commit and the purge routes don't depend on
the lease and keep working. Only new creates return `503 {"state":"unavailable"}`.

## What latches it

`src/health-do.js` `recordDeletionHealth({ healthy: false })`: every failed deletion
heartbeat sets `deletion_healthy = 0` and increments `incident_generation`. A later
passing check never clears it (`healthy: true` only refreshes an already acknowledged
generation). Creates need `ack_generation === incident_generation`, which only
`ops:ack` sets.

Generation 1 was acknowledged at launch. **Generation 3 means exactly two failed
deletion heartbeats were recorded after that.** No further failure has happened
since: the generation is still 3, six days later.

## Who reported the failures, and when

- **Not the devbox loop.** `taurifer-transfer-health.timer` was stopped and removed
  on 2026-10-15 07:45 UTC at the watcher cutover. Its journal ends there with
  `health pass ok`.
- **The scheduled watcher Worker** (`taurifer-install-transfer-watcher`, cron
  `*/2 * * * *`, unchanged since its 2026-10-15 07:35 deploy) is the only remaining
  reporter. `src/watcher.js` posts a `deletion` `fail` heartbeat on exactly two paths:
  1. the registry purge (`POST /_ops/purge-due`) answers with `failed > 0` or
     `remainingDue > 0` (check version `scheduled-purge-failure-v1`);
  2. anything in the provider step throws (check version
     `provider-enumeration-failure-v1`). That covers the Cloudflare API listing
     (request error, non-2xx, a malformed page or cursor) and the batched
     `POST /_ops/purge-objects` to the transfer Worker (rejected, or `failed > 0`).

  A `purge-due` request that fails outright (network, 429, 5xx) throws without
  reporting, so that path can't raise the generation.
- **Window:** after 2026-10-21 20:48 UTC (the #461 deploy, after which
  `createsEnabled` read true at generation 1) and before 2026-10-24 09:47 UTC,
  when it was found at generation 3.
- **No deploys in the window.** The production transfer Worker's deployment list
  goes from 2026-10-21 20:48 (#461) to 2026-10-24 09:46 (#498), and the watcher
  hasn't been deployed since 2026-10-15. A deploy landing mid-pass is ruled out.

**The exact failing path and timestamps couldn't be recovered.** The health Durable
Object stores the last failure's `check_version` and `observed_at`, but
`/_ops/health` returns only the booleans and generations above. The watcher's
Workers Logs for 21–24 October fall outside the retention I could reach. Wrangler
4.130 has only live `tail`, and querying the telemetry API with the stored login
was refused in this session.

## Most likely cause (inference, not proven)

Path 2, a transient provider-side failure, twice:
- the registry has had nothing due (`purge examined=0` every pass);
- nothing was deployed in the window;
- the failures stopped on their own.

The two failures could be two consecutive passes in one outage, or separate blips.
Either way, a transient error in the Cloudflare listing API or in a
`purge-objects` call raises a deletion incident by design: the watcher fails closed
on any enumeration error.

## Is the cause still present? No

- Live tail, 2026-10-30 ~00:50 UTC, three consecutive passes: `health pass ok; purge
  examined=0 purged=0; provider objects=2; createsEnabled=false`. They're healthy; only
  the latch keeps creates off.
- Provider listing of the transfer namespace: 2 objects, both `hasStoredData:
  false`. These are leftover entries for already-disposed transfers, not undeleted
  data.
- The generation hasn't moved since 2026-10-24.

## Re-enabling: steps and what each risks (owner decision; nothing done here)

From `~/taurifer-transfer-production/services/install-transfer`, with
`~/.config/taurifer/production-ops.env` sourced (never printed):

1. **Optional: the kill switch first** (`RUNBOOK.md` "Turning creates off"). The
   runbook says to set it before investigating a deletion incident. Creates are
   already off through the latch, so this only keeps them off once the ack lands,
   until the owner removes it. Risk: none to data. It's a production deploy, and a
   later deploy without `--var` restores the checked-in values.
2. **Manual registry purge**, `npm run ops:purge` with `TRANSFER_PURGE_EVIDENCE_REF`
   (and optionally a bounded `TRANSFER_PURGE_OPERATION_ID`). It prints only `examined
   purged failed remainingDue`, and the expectation is all zero. Risk: low. It only
   deletes records that are already due. It uses the purge role's rate limit (10 a
   minute), shared with the watcher, so one watcher pass may get a 429. That's
   harmless, since a rejected `purge-due` throws without raising the generation.
3. **Confirm the scheduled provider pass** is clean: `wrangler tail
   taurifer-install-transfer-watcher` across two passes shows `health pass ok`.
   Risk: none (read-only).
4. **Redaction review**, as the runbook requires before an ack. Re-run the
   redaction fixtures or check that the evidence above holds no IDs, tokens or
   cursors. Risk: none.
5. **Acknowledge generation 3**: `TRANSFER_ACK_CONFIRM=I_HAVE_REVIEWED_DELETION
   TRANSFER_ACK_EVIDENCE_REF=<ref> npm run ops:ack`. The script refuses if deletion
   is already healthy. It reads the current generation and acknowledges exactly that
   one (`deletion_healthy = 1`, `ack_generation = 3`), then the next watcher pass
   stamps a fresh positive deletion check.
   - **Risk:** this is the step that re-enables creates. The lease is fresh, so
     `createsEnabled` becomes true at once, and live users can start transfers
     again. If the cause comes back, the next failure latches it off again
     (generation 4), which is the intended fail-closed behaviour.
   - If a new failure lands between reading health and acking, the ack is for a
     stale generation and the Durable Object refuses it. That's safe; re-check and
     repeat.
6. **Verify**: `npm run ops:health-status` shows `deletionHealthy` and
   `createsEnabled` true, and generation equals ack. Then one controlled production
   transfer (browser to standalone) before relying on it.

## Recommendations for the owner (not acted on)

- **Before the ack, make the cause observable next time.** Expose the last deletion
  evidence's `checkVersion` and `observedAt` (no IDs) in `/_ops/health`, and log the
  provider pass's `purged/deferred/failed` counts in the watcher line. This would
  have answered "which path failed, when" directly. It's a small code change plus a
  Worker redeploy.
- **Consider whether one transient listing error should latch.** Today it does, by
  design. An alternative is to require two consecutive enumeration failures, or to
  retry the listing once within the pass, before reporting a deletion failure. That
  trades a little fail-closed strictness for fewer false incidents, and it's a policy
  decision.
- **Alerting:** nothing paged anyone for six days. The runbook's proposal (Workers
  Issues for the watcher, or a scheduled `ops:health-status` check) still applies.
