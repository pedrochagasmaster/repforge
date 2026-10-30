// One controlled production transfer through the public API (RUNBOOK,
// "Deletion incidents", step 6), run after a deletion acknowledgement:
//
//   TRANSFER_SERVICE_URL=https://taurifer.com \
//   TRANSFER_CONTROLLED_CONFIRM=CREATE_ONE_SYNTHETIC_TRANSFER \
//   npm run ops:controlled-transfer
//
// It creates one transfer holding a synthetic, empty install (no workouts, no
// program, analytics off), claims it, checks the claimed envelope is the one
// sent, commits, and checks the transfer reads `deleted` and can't be claimed
// again. The token and claim ID stay in memory; output is fixed step lines
// with states and HTTP statuses only. It needs no operator bearer.
import contract from "../../../install-transfer-contract.js";

export const CONFIRMATION = "CREATE_ONE_SYNTHETIC_TRANSFER";
const REQUEST_TIMEOUT_MS = 10_000;

const randomUUID = () => crypto.randomUUID();

function randomClaimId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export async function syntheticEnvelope({ now = new Date(), id = randomUUID() } = {}) {
  const createdAt = now.toISOString();
  const value = {
    kind: "taurifer-install-transfer",
    schemaVersion: 1,
    createdAt,
    source: { context: "browser", logicalInstallationId: `controlled-check-${id}` },
    sourceRevision: 1,
    durableState: { settings: {}, programMeta: {}, program: [], log: [], programHistory: [], customExercises: [] },
    workoutDraft: null,
    programEntryDraft: null,
    uiPreferences: {},
    analytics: { enabled: false },
    telemetryIdentity: { schemaVersion: 1, installationId: `controlled-check-${id}`, createdAt },
    integrity: { canonicalPayloadHash: "" },
  };
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(contract.canonicalJson({ ...value, integrity: {} })),
  ));
  value.integrity.canonicalPayloadHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return value;
}

function serviceOrigin(value) {
  let parsed;
  try { parsed = new URL(value ?? ""); } catch { throw new Error("TRANSFER_SERVICE_URL is invalid"); }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash
    || !(parsed.protocol === "https:" || (parsed.protocol === "http:" && parsed.hostname === "localhost"))) {
    throw new Error("TRANSFER_SERVICE_URL must be an HTTPS origin without credentials, path, query, or fragment");
  }
  return parsed.origin;
}

/**
 * Runs the create → claim → commit → status → re-claim check. Returns the
 * fixed step lines; throws with a fixed message on the first failed step.
 */
export async function runControlledTransfer({ origin, fetcher = fetch, log = () => {} } = {}) {
  const base = serviceOrigin(origin);
  const post = async (path, body) => {
    let response;
    try {
      response = await fetcher(`${base}${path}`, {
        method: "POST",
        headers: { Origin: base, Accept: "application/json", "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(body),
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Error(`${path} request failed`);
    }
    let value = null;
    try { value = await response.json(); } catch { /* checked by the caller */ }
    return { status: response.status, value };
  };
  const lines = [];
  const step = (line) => { lines.push(line); log(line); };

  const envelope = await syntheticEnvelope();
  const created = await post(contract.ENDPOINTS.create, { idempotencyKey: `controlled-${randomUUID()}`, envelope });
  if (created.status === 503) throw new Error("create refused with 503: creates are disabled");
  if (created.status !== 201 || typeof created.value?.token !== "string") throw new Error(`create failed with ${created.status}`);
  const token = created.value.token;
  step("create 201");

  const claimId = randomClaimId();
  const claimed = await post(contract.ENDPOINTS.claims, { token, claimId });
  if (claimed.status !== 200) throw new Error(`claim failed with ${claimed.status}`);
  if (contract.canonicalJson(claimed.value?.envelope) !== contract.canonicalJson(envelope)) throw new Error("claimed envelope does not match the one sent");
  step("claim 200; envelope matches");

  const committed = await post(contract.ENDPOINTS.commit, { token, claimId });
  if (committed.status !== 200 || committed.value?.state !== "deleted") throw new Error(`commit failed with ${committed.status}`);
  step("commit 200; state=deleted");

  const status = await post(contract.ENDPOINTS.status, { token });
  if (status.status !== 200 || status.value?.state !== "deleted") throw new Error(`status read ${status.status} ${status.value?.state ?? "unknown"}, expected deleted`);
  step("status 200; state=deleted");

  const reclaimed = await post(contract.ENDPOINTS.claims, { token, claimId });
  if (reclaimed.status === 200 || reclaimed.value?.envelope !== undefined) throw new Error("a committed transfer could be claimed again");
  step(`re-claim ${reclaimed.status}; refused`);
  step("controlled transfer passed");
  return lines;
}

if (globalThis.process?.argv?.[1] && new URL(`file://${globalThis.process.argv[1]}`).href === import.meta.url) {
  try {
    if (process.env.TRANSFER_CONTROLLED_CONFIRM !== CONFIRMATION) {
      throw new Error(`set TRANSFER_CONTROLLED_CONFIRM=${CONFIRMATION} to create one synthetic production transfer`);
    }
    await runControlledTransfer({ origin: process.env.TRANSFER_SERVICE_URL, log: (line) => console.log(line) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "controlled transfer failed");
    process.exit(1);
  }
}
