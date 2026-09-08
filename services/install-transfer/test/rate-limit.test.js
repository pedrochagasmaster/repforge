import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { rateBucketName, rateLimitForScope } from "../src/rate-limit.js";
import { euStub } from "../src/namespaces.js";

const pepper = new Uint8Array(32).fill(5);

describe("short-lived HMAC-keyed rate buckets", () => {
  it("uses a stable opaque bucket name without storing the identity", async () => {
    const first = await rateBucketName({ scope: "create", identity: "203.0.113.10", pepper });
    const repeat = await rateBucketName({ scope: "create", identity: "203.0.113.10", pepper });
    const other = await rateBucketName({ scope: "create", identity: "203.0.113.11", pepper });
    expect(first).toBe(repeat);
    expect(first).not.toContain("203.0.113.10");
    expect(first).not.toBe(other);
  });

  it("allows exactly the configured window quota and resets after one minute", async () => {
    const name = await rateBucketName({ scope: "create", identity: "198.51.100.8", pepper });
    const stub = euStub(env.RATE_LIMIT_BUCKETS, name, { allowLocalFallback: true });
    const now = Date.now();
    const results = [];
    for (let index = 0; index < rateLimitForScope("create") + 1; index += 1) {
      results.push(await stub.consume({ now, limit: rateLimitForScope("create") }));
    }
    expect(results.slice(0, 5).every((result) => result.allowed)).toBe(true);
    expect(results[5]).toMatchObject({ allowed: false, retryAt: now + 60_000 });
    await expect(stub.consume({ now: now + 60_000, limit: 5 })).resolves.toMatchObject({ allowed: true, retryAt: now + 120_000 });
    const stored = await runInDurableObject(stub, (_instance, state) => state.storage.sql.exec("SELECT * FROM rate_bucket").toArray());
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0])).not.toContain("198.51.100.8");
  });

  it("disposes expired buckets completely and recreates them lazily", async () => {
    const name = await rateBucketName({ scope: "status", identity: "198.51.100.20", pepper });
    const stub = euStub(env.RATE_LIMIT_BUCKETS, name, { allowLocalFallback: true });
    const now = Date.now();
    await stub.consume({ now, limit: 5 });
    const alarmResult = await runInDurableObject(stub, async (instance) => {
      const originalNow = Date.now;
      Date.now = () => now + 120_001;
      try {
        return await instance.alarm();
      } finally {
        Date.now = originalNow;
      }
    });
    expect(alarmResult).toEqual({ ok: true, purged: true });
    const empty = await runInDurableObject(stub, async (_instance, state) => ({
      alarm: (await state.storage.getAlarm()) ?? null,
      tables: state.storage.sql.exec(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rate_bucket'",
      ).toArray(),
    }));
    expect(empty).toEqual({ alarm: null, tables: [] });
    await evictDurableObject(stub);
    await expect(stub.consume({ now: now + 120_002, limit: 5 })).resolves.toMatchObject({ allowed: true });
  });

  it("fails closed on bucket disposal failure and retries before allowing a new window", async () => {
    const name = await rateBucketName({ scope: "commit", identity: "198.51.100.21", pepper });
    const stub = euStub(env.RATE_LIMIT_BUCKETS, name, { allowLocalFallback: true });
    const now = Date.now();
    await stub.consume({ now, limit: 5 });
    const failed = await runInDurableObject(stub, async (instance, state) => {
      const originalNow = Date.now;
      const original = state.storage.deleteAll.bind(state.storage);
      let fail = true;
      state.storage.deleteAll = async () => {
        if (fail) {
          fail = false;
          throw new Error("injected deleteAll failure");
        }
        return original();
      };
      Date.now = () => now + 120_001;
      try {
        return { result: await instance.alarm(), alarm: await state.storage.getAlarm() };
      } finally {
        Date.now = originalNow;
      }
    });
    expect(failed.result).toEqual({ ok: false, code: "storage-disposal" });
    expect(Number.isSafeInteger(failed.alarm)).toBe(true);
    await expect(stub.consume({ now: now + 120_002, limit: 5 })).resolves.toMatchObject({ allowed: true });
  });

  it("recovers when deleteAll succeeds before its acknowledgement is lost", async () => {
    const name = await rateBucketName({ scope: "status", identity: "198.51.100.22", pepper });
    const stub = euStub(env.RATE_LIMIT_BUCKETS, name, { allowLocalFallback: true });
    const now = Date.now();
    await stub.consume({ now, limit: 5 });
    const failed = await runInDurableObject(stub, async (instance, state) => {
      const original = state.storage.deleteAll.bind(state.storage);
      let loseAcknowledgement = true;
      state.storage.deleteAll = async () => {
        await original();
        if (loseAcknowledgement) {
          loseAcknowledgement = false;
          throw new Error("injected lost deleteAll acknowledgement");
        }
      };
      const originalNow = Date.now;
      Date.now = () => now + 120_001;
      try {
        return instance.alarm();
      } finally {
        Date.now = originalNow;
      }
    });
    expect(failed).toEqual({ ok: false, code: "storage-disposal" });
    await expect(stub.consume({ now: now + 120_002, limit: 5 })).resolves.toMatchObject({ allowed: true });
  });
});
