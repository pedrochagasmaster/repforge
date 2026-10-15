// Owner self-attestation receipts (owner override, 2026-10-14). Each health
// pass stamps these with the current time. They are the owner's attestation,
// not independent monitoring, and the billing amount is attested, not an
// observed bill. See RUNBOOK.md, "Production enablement".
export const ATTESTED_CHECK_VERSION = "operator-attested-v1";
export const ATTESTED_EVIDENCE_REF = "owner-override-20261014";
export const HEALTH_KINDS = Object.freeze(["alarm", "watchdog", "log", "key", "deletion"]);

export function attestedReceipts(now, monthlyCostCents) {
  const entry = { source: "owner-watchdog", observedAt: now, checkVersion: ATTESTED_CHECK_VERSION, result: "pass", evidenceRef: ATTESTED_EVIDENCE_REF };
  return {
    watchdog: { schemaVersion: 1, health: Object.fromEntries(HEALTH_KINDS.map((kind) => [kind, { ...entry }])) },
    billing: {
      source: "owner-billing-receipt",
      observedAt: now,
      checkVersion: ATTESTED_CHECK_VERSION,
      result: "observed",
      evidenceRef: ATTESTED_EVIDENCE_REF,
      monthlyCostCents,
    },
  };
}
