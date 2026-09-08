import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
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
});
