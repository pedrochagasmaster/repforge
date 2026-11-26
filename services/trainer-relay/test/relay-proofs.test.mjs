// Plan 086 section 4: the five slice-1 proofs against a local relay.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { APP_ORIGIN, Client, Contract, startRelay } from "./local-relay.mjs";
import { Setup, fourDaySevenWeekDocument } from "./program-fixture.mjs";

const { ENDPOINTS, LIMITS } = Contract;
const STUDIO_ORIGIN = "https://studio.taurifer.com";

function leafStrings(value, out = new Set()) {
  if (typeof value === "string") out.add(value);
  else if (Array.isArray(value)) value.forEach((entry) => leafStrings(entry, out));
  else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      out.add(key);
      leafStrings(entry, out);
    }
  }
  return out;
}

function keyForms(key) {
  const raw = Contract.base64UrlDecode(key);
  const buffer = Buffer.from(raw);
  return [key, buffer.toString("base64"), buffer.toString("hex"), buffer.toString("hex").toUpperCase()];
}

/** Render a QR code at `pixelsPerModule` with the standard four-module quiet zone, as RGBA. */
function rasterize(qr, pixelsPerModule) {
  const quiet = 4;
  const modules = qr.modules.size;
  const side = (modules + 2 * quiet) * pixelsPerModule;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      for (let dy = 0; dy < pixelsPerModule; dy += 1) {
        for (let dx = 0; dx < pixelsPerModule; dx += 1) {
          const offset = (((row + quiet) * pixelsPerModule + dy) * side + (col + quiet) * pixelsPerModule + dx) * 4;
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
        }
      }
    }
  }
  return { data, side };
}

describe("trainer relay slice-1 proofs", () => {
  let fixture;
  let text;
  before(() => {
    fixture = fourDaySevenWeekDocument();
    text = JSON.stringify(fixture.document);
  });

  test("proof 1: the full four-day, seven-week program round-trips byte for byte", async () => {
    const link = await Setup.encode(fixture.document, fixture.options);
    assert.equal(link.ok, false, "the setup link refuses this program today");
    assert.equal(link.code, "encoded-too-large");
    const relay = await startRelay();
    try {
      const sent = await Client.send(text, relay.clientOptions());
      assert.equal(sent.ok, true, sent.code);
      const received = await Client.receive(sent.link, relay.clientOptions());
      assert.equal(received.ok, true, received.code);
      assert.deepEqual(Buffer.from(received.text, "utf8"), Buffer.from(text, "utf8"), "identical UTF-8 bytes");
      const decoded = Setup.validate(JSON.parse(received.text), fixture.options);
      assert.equal(decoded.ok, true, "the received document validates as the shared setup it was");
      assert.deepEqual(decoded.value, fixture.document);
      const again = await Client.receive(sent.link, relay.clientOptions());
      assert.equal(again.ok, true, "a record can be read more than once before it expires");
      assert.equal(again.text, text);
    } finally {
      await relay.stop();
    }
  });

  test("proof 2: the link is short enough for a QR code a phone reads", async () => {
    const relay = await startRelay();
    try {
      for (const origin of [APP_ORIGIN, STUDIO_ORIGIN]) {
        const sent = await Client.send(text, relay.clientOptions({ linkBase: origin + "/" }));
        assert.equal(sent.ok, true, sent.code);
        // Fixed length: base + "#r=" + 22-character id + "." + 43-character key.
        assert.equal(sent.link.length, (origin + "/").length + 3 + LIMITS.recordIdChars + 1 + LIMITS.keyChars);
        assert.ok(sent.link.length <= 100, `link measured ${sent.link.length} characters`);
        const qr = QRCode.create(sent.link, { errorCorrectionLevel: "M" });
        assert.ok(qr.version <= 6, `QR version ${qr.version} (${qr.modules.size} modules) at error correction M`);
        // Two pixels per module is a low-resolution capture; it must still decode exactly.
        const { data, side } = rasterize(qr, 2);
        const decoded = jsQR(data, side, side);
        assert.equal(decoded?.data, sent.link, "the rendered code decodes to the exact link");
        assert.deepEqual(Client.parseLocator(decoded.data), { id: sent.id, key: sent.link.split(".").pop() });
        console.log(`measured ${origin} link: ${sent.link.length} characters, QR version ${qr.version}-M (${qr.modules.size}x${qr.modules.size} modules)`);
      }
    } finally {
      await relay.stop();
    }
  });

  test("proof 3: the service never receives or stores the key or any plaintext field", async () => {
    const relay = await startRelay();
    try {
      const sent = await Client.send(text, relay.clientOptions());
      assert.equal(sent.ok, true, sent.code);
      const received = await Client.receive(sent.link, relay.clientOptions());
      assert.equal(received.ok, true);
      const key = sent.link.split(".").pop();
      const ciphertext = JSON.parse(relay.received[0].body).ciphertext;
      await relay.mf.dispose();
      const stored = relay.storedFiles();
      assert.ok(stored.length > 0, "the local relay persisted its Durable Objects");
      const storedBytes = Buffer.concat(stored.map((file) => file.bytes));
      // SQLite spreads a large blob over overflow pages, so the sanity probe is a short slice.
      assert.ok(storedBytes.includes(Buffer.from(Contract.base64UrlDecode(ciphertext)).subarray(0, 256)), "the scan sees the stored ciphertext, so it can see stored bytes");
      const sentText = relay.received.map((entry) => entry.url + "\n" + entry.headers + "\n" + entry.body).join("\n");
      for (const form of keyForms(key)) {
        assert.equal(sentText.includes(form), false, "no request carried the key");
        assert.equal(storedBytes.includes(Buffer.from(form)), false, "storage holds no encoding of the key");
      }
      assert.equal(storedBytes.includes(Buffer.from(Contract.base64UrlDecode(key))), false, "storage holds no raw key bytes");
      assert.equal(storedBytes.includes(Buffer.from(sent.id)), false, "storage holds no record id: objects are named by a keyed hash");
      const fields = [...leafStrings(fixture.document)].filter((value) => value.length >= 8);
      assert.ok(fields.length > 50, "the plaintext probe covers the document's names, identities and keys");
      for (const field of fields) {
        assert.equal(sentText.includes(field), false, `no request carried plaintext field ${JSON.stringify(field.slice(0, 24))}`);
        assert.equal(storedBytes.includes(Buffer.from(field, "utf8")), false, `storage holds no plaintext field ${JSON.stringify(field.slice(0, 24))}`);
      }
      assert.equal(storedBytes.includes(Buffer.from(text.slice(0, 64), "utf8")), false);
    } finally {
      await relay.stop().catch(() => {});
    }
  });

  test("proof 4: an expired record is unreadable and a wrong key fails closed", async () => {
    const relay = await startRelay();
    try {
      const before = Date.now();
      const sent = await Client.send(text, relay.clientOptions());
      const afterSend = Date.now();
      assert.equal(sent.ok, true, sent.code);
      const expiresAt = Date.parse(sent.expiresAt);
      assert.ok(expiresAt >= before + LIMITS.recordLifetimeMs && expiresAt <= afterSend + LIMITS.recordLifetimeMs,
        "the service assigns a seven-day expiry");

      const otherKey = Contract.base64UrlEncode(new Uint8Array(LIMITS.keyBytes).fill(7));
      const wrong = await Client.receive(Contract.formatLink(APP_ORIGIN + "/", sent.id, otherKey), relay.clientOptions());
      assert.deepEqual(wrong, { ok: false, code: "decrypt-failed" }, "a wrong key yields a code and no text");

      const record = JSON.parse(relay.received[0].body);
      const tampered = Buffer.from(Contract.base64UrlDecode(record.ciphertext));
      tampered[tampered.length - 1] ^= 1;
      const opened = await Client.open({ ...record, ciphertext: Contract.base64UrlEncode(tampered) }, sent.link.split(".").pop());
      assert.deepEqual(opened, { ok: false, code: "decrypt-failed" }, "a tampered record yields a code and no text");

      const stub = await relay.recordStub(sent.id);
      const live = await stub.read({ now: expiresAt - 1 });
      assert.equal(live.kind, "record", "readable until the last millisecond");
      const expired = await stub.read({ now: expiresAt });
      assert.equal(expired.kind, "gone", "unreadable at the expiry");
      const afterExpiry = await Client.receive(sent.link, relay.clientOptions());
      assert.deepEqual(afterExpiry, { ok: false, code: "unavailable" }, "the expired record was deleted");

      const malformed = await Client.receive(APP_ORIGIN + "/#r=short.key", relay.clientOptions());
      assert.deepEqual(malformed, { ok: false, code: "invalid-link" });
    } finally {
      await relay.stop();
    }
  });

  test("proof 4: a shorter deployment lifetime is honoured but never exceeds seven days", async () => {
    for (const [seconds, expectedMs] of [["120", 120_000], ["1", LIMITS.minRecordLifetimeMs], ["99999999", LIMITS.recordLifetimeMs]]) {
      const relay = await startRelay({ RELAY_RECORD_LIFETIME_SECONDS: seconds });
      try {
        const before = Date.now();
        const sent = await Client.send("lifetime probe", relay.clientOptions());
        const afterSend = Date.now();
        assert.equal(sent.ok, true, sent.code);
        const expiresAt = Date.parse(sent.expiresAt);
        assert.ok(expiresAt >= before + expectedMs && expiresAt <= afterSend + expectedMs, `${seconds}s configured gives ${expiresAt - before}ms`);
      } finally {
        await relay.stop();
      }
    }
  });

  test("proof 5: the size bound rejects as specified", async () => {
    const relay = await startRelay();
    try {
      const nonce = Contract.base64UrlEncode(new Uint8Array(LIMITS.nonceBytes));
      const atLimit = Contract.base64UrlEncode(new Uint8Array(LIMITS.maxCiphertextBytes).fill(1));
      const overLimit = Contract.base64UrlEncode(new Uint8Array(LIMITS.maxCiphertextBytes + 1).fill(1));
      assert.equal((await relay.post(ENDPOINTS.create, { v: 1, nonce, ciphertext: atLimit })).status, 201, "a record at the bound is stored");
      assert.equal((await relay.post(ENDPOINTS.create, { v: 1, nonce, ciphertext: overLimit })).status, 413, "one byte over is refused");
      assert.equal((await relay.post(ENDPOINTS.create, "x".repeat(LIMITS.maxCreateBodyBytes + 1))).status, 413, "an oversized body is refused");
      assert.equal((await relay.post(ENDPOINTS.create, { v: 1, nonce, ciphertext: "AAAA" })).status, 413, "below the tag size is refused");
      assert.equal((await relay.post(ENDPOINTS.create, { v: 2, nonce, ciphertext: atLimit.slice(0, 40) })).status, 400, "a newer protocol is refused");
      assert.equal((await relay.post(ENDPOINTS.create, { v: 1, nonce, ciphertext: atLimit.slice(0, 40), extra: 1 })).status, 400, "unknown fields are refused");
      // Random text does not compress: the client refuses it before any upload.
      const noise = randomBytes(LIMITS.maxCiphertextBytes).toString("base64");
      const sentBefore = relay.received.length;
      assert.deepEqual(await Client.send(noise, relay.clientOptions()), { ok: false, code: "payload-too-large" });
      assert.equal(relay.received.length, sentBefore, "nothing was uploaded");
    } finally {
      await relay.stop();
    }
  });

  test("proof 5: the per-address create rate rejects as specified", async () => {
    // ADR 0026 amendment (2026-11-26): 300 creates per address per hour.
    assert.equal(LIMITS.createsPerAddressPerHour, 300);
    const relay = await startRelay();
    try {
      let link;
      for (let index = 0; index < LIMITS.createsPerAddressPerHour; index += 1) {
        const sent = await Client.send(`create ${index}`, relay.clientOptions());
        assert.equal(sent.ok, true, `create ${index + 1} is admitted`);
        link = sent.link;
      }
      assert.deepEqual(await Client.send("one more", relay.clientOptions()), { ok: false, code: "rate-limited" });
      const elsewhere = await Client.send("other address", relay.clientOptions({ fetch: relay.fetchFrom("203.0.113.9") }));
      assert.equal(elsewhere.ok, true, "another address is unaffected");
      assert.equal((await Client.receive(link, relay.clientOptions())).ok, true, "reads from the limited address continue");
    } finally {
      await relay.stop();
    }
  });

  test("proof 5: the cost threshold stops creates, alerts once, and leaves reads", async () => {
    const alerts = [];
    const outbound = async (request) => {
      alerts.push({ url: request.url, body: await request.text() });
      return new Response("{}", { status: 201 });
    };
    const relay = await startRelay({ RELAY_ALERT_GITHUB_TOKEN: "test-token", RELAY_ALERT_REPO: "example/relay-alerts" }, { outbound });
    try {
      const month = new Date().toISOString().slice(0, 7);
      const sent = await Client.send("before the threshold", relay.clientOptions());
      assert.equal(sent.ok, true);
      assert.equal((await relay.ops("/_ops/billing", { month, monthlyCostCents: 999 })).status, 200);
      assert.equal((await Client.send("just under", relay.clientOptions())).ok, true, "999 cents admits creates");
      assert.equal((await relay.ops("/_ops/billing", { month, monthlyCostCents: LIMITS.costThresholdCents })).status, 200);
      assert.deepEqual(await Client.send("at the threshold", relay.clientOptions()), { ok: false, code: "service-unavailable" });
      assert.deepEqual(await Client.send("still refused", relay.clientOptions()), { ok: false, code: "service-unavailable" });
      assert.equal((await Client.receive(sent.link, relay.clientOptions())).ok, true, "reads continue");
      const health = await (await relay.ops("/_ops/health")).json();
      assert.equal(health.costThresholdReached, true);
      assert.equal(health.createsOpen, false);
      assert.equal(health.refusedCreates, 2);
      assert.equal(alerts.length, 1, "one alert for the month");
      assert.match(alerts[0].url, /^https:\/\/api\.github\.com\/repos\/example\/relay-alerts\/issues$/);
      assert.equal(alerts[0].body.includes(sent.id), false, "the alert carries no record id");
      assert.equal((await relay.ops("/_ops/billing", { month: "1999-01", monthlyCostCents: 0 })).status, 409, "only the current month is attested");
      assert.equal((await relay.ops("/_ops/billing", { month, monthlyCostCents: 10 })).status, 200);
      assert.equal((await Client.send("after a corrected receipt", relay.clientOptions())).ok, true);

      // The metered estimate closes the gate on its own: charge a month of
      // storage worth the threshold through the meter's own admission path.
      const meter = await relay.meterStub();
      const bytesAtThreshold = Math.ceil((LIMITS.costThresholdCents * 1_000_000) / 0.005);
      assert.equal((await meter.admitCreate({ now: Date.now(), bytes: bytesAtThreshold })).allowed, true);
      assert.deepEqual(await Client.send("metered over", relay.clientOptions()), { ok: false, code: "service-unavailable" });
      assert.equal(alerts.length, 1, "still one alert for the month");
    } finally {
      await relay.stop();
    }
  });

  test("proof 5: the kill switch stops creates while reads continue", async () => {
    let relay = await startRelay();
    try {
      const sent = await Client.send("kept through the kill switch", relay.clientOptions());
      assert.equal(sent.ok, true);
      relay = await relay.restart({ RELAY_KILL_SWITCH: "true" });
      assert.deepEqual(await Client.send("refused", relay.clientOptions()), { ok: false, code: "service-unavailable" });
      const read = await Client.receive(sent.link, relay.clientOptions());
      assert.equal(read.ok, true);
      assert.equal(read.text, "kept through the kill switch");
      relay = await relay.restart({ RELAY_KILL_SWITCH: "false", RELAY_CREATES_ENABLED: "false" });
      assert.deepEqual(await Client.send("disabled", relay.clientOptions()), { ok: false, code: "service-unavailable" });
    } finally {
      await relay.stop();
    }
  });
});

describe("trainer relay request boundary", () => {
  test("only allowed origins, POST and the two endpoints are served", async () => {
    const relay = await startRelay();
    try {
      const sent = await Client.send("boundary", relay.clientOptions());
      const read = { v: 1, id: sent.id };
      assert.equal((await relay.post(ENDPOINTS.read, read)).status, 200);
      assert.equal((await relay.post(ENDPOINTS.read, read, { origin: STUDIO_ORIGIN })).status, 200, "the trainer site's origin is allowed");
      assert.equal((await relay.post(ENDPOINTS.read, read, { origin: "https://evil.example" })).status, 404);
      assert.equal((await relay.mf.dispatchFetch("https://relay.test" + ENDPOINTS.read, { headers: { Origin: APP_ORIGIN } })).status, 404, "GET is refused");
      assert.equal((await relay.mf.dispatchFetch(`https://relay.test${ENDPOINTS.read}?id=${sent.id}`, {
        method: "POST", headers: { Origin: APP_ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify(read) })).status, 404, "no query strings");
      assert.equal((await relay.post(ENDPOINTS.read, { v: 1, id: sent.id + "A" })).status, 400);
      assert.equal((await relay.post(ENDPOINTS.read, { v: 1, id: "A".repeat(22) })).status, 404, "an unknown id is unavailable");
      assert.equal((await relay.post(ENDPOINTS.read, read, { headers: { "Content-Type": "text/plain" } })).status, 415);
      const preflight = await relay.mf.dispatchFetch("https://relay.test" + ENDPOINTS.create, {
        method: "OPTIONS", headers: { Origin: APP_ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), APP_ORIGIN);
      const unauthorized = await relay.mf.dispatchFetch("https://relay.test/_ops/health", { method: "POST" });
      assert.equal(unauthorized.status, 404, "operations need the bearer");
    } finally {
      await relay.stop();
    }
  });

  test("the read rate is bounded per address", async () => {
    const relay = await startRelay();
    try {
      const sent = await Client.send("reads", relay.clientOptions());
      for (let index = 0; index < LIMITS.readsPerAddressPerMinute; index += 1) {
        assert.equal((await relay.post(ENDPOINTS.read, { v: 1, id: sent.id })).status, 200);
      }
      assert.equal((await relay.post(ENDPOINTS.read, { v: 1, id: sent.id })).status, 429);
      assert.equal((await relay.post(ENDPOINTS.read, { v: 1, id: sent.id }, { address: "203.0.113.9" })).status, 200);
    } finally {
      await relay.stop();
    }
  });
});
