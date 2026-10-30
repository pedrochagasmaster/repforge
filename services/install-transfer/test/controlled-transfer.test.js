import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { euStub } from "../src/namespaces.js";
import { runControlledTransfer, syntheticEnvelope } from "../scripts/controlled-transfer.mjs";

const origin = "https://taurifer.example";

async function enableCreates() {
  const now = Date.now();
  const stub = euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: true });
  for (const kind of ["alarm", "watchdog", "log", "key"]) await stub.recordHeartbeat({ kind, observedAt: now, now });
  await stub.recordBilling({ monthlyCostCents: 1, observedAt: now, now });
  const snapshot = await stub.snapshot({ now });
  await stub.acknowledgeDeletion({ generation: snapshot.incidentGeneration, proofNonce: "T".repeat(32), observedAt: now, now });
}

/** Sends the script's requests to the Worker as the edge would, and records them. */
function edge() {
  const calls = [];
  const fetcher = async (input, init) => {
    const request = new Request(input, init);
    const body = await request.clone().text();
    calls.push({ url: request.url, body });
    const headers = new Headers(request.headers);
    headers.set("CF-Connecting-IP", "198.51.100.90");
    const response = await worker.fetch(new Request(request.url, { method: request.method, headers, body }), env);
    calls.at(-1).response = await response.clone().text();
    return response;
  };
  return { calls, fetcher };
}

describe("controlled production transfer script", () => {
  beforeEach(async () => {
    await reset();
  });

  it("builds a synthetic envelope the service contract accepts", async () => {
    const envelope = await syntheticEnvelope({ now: new Date("2026-10-30T12:00:00.000Z"), id: "fixed" });
    expect(envelope.durableState).toEqual({ settings: {}, programMeta: {}, program: [], log: [], programHistory: [], customExercises: [] });
    expect(envelope.analytics).toEqual({ enabled: false });
    expect(envelope.integrity.canonicalPayloadHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("creates, claims, commits and confirms deletion, printing no credential", async () => {
    await enableCreates();
    const { calls, fetcher } = edge();
    const lines = await runControlledTransfer({ origin, fetcher });
    expect(lines).toEqual([
      "create 201",
      "claim 200; envelope matches",
      "commit 200; state=deleted",
      "status 200; state=deleted",
      "re-claim 404; refused",
      "controlled transfer passed",
    ]);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/v1/transfers", "/v1/transfers/claims", "/v1/transfers/claims/commit", "/v1/transfers/status", "/v1/transfers/claims",
    ]);
    const token = JSON.parse(calls[0].response).token;
    const claimId = JSON.parse(calls[1].body).claimId;
    for (const secret of [token, claimId]) {
      expect(lines.join("\n")).not.toContain(secret);
      expect(calls.every((call) => !call.url.includes(secret))).toBe(true);
    }
  });

  it("stops at create with a fixed message while creates are disabled", async () => {
    const { calls, fetcher } = edge();
    await expect(runControlledTransfer({ origin, fetcher })).rejects.toThrow("create refused with 503: creates are disabled");
    expect(calls).toHaveLength(1);
  });

  it("refuses a service URL with a path or credentials", async () => {
    for (const bad of ["https://taurifer.example/v1", "https://user:pass@taurifer.example", "http://taurifer.example", undefined]) {
      await expect(runControlledTransfer({ origin: bad, fetcher: () => { throw new Error("no request expected"); } }))
        .rejects.toThrow("TRANSFER_SERVICE_URL");
    }
  });
});
