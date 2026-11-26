#!/usr/bin/env node
// Runs Plan 086's slice-1 proofs against the deployed staging relay.
//
//   RELAY_STAGING_URL=https://<staging host> RELAY_STAGING_ENV=<private env file> \
//     node scripts/staging-proofs.mjs <phase>
//
// Phases, in this order (the create rate is per address per hour, so `rate`
// runs last):
//   main         round trip, link length and QR decode, request inspection,
//                wrong key, size bound, cost threshold
//   expiry       needs a deployment with RELAY_RECORD_LIFETIME_SECONDS=60
//   kill-before  creates a record and keeps its link in the private state dir
//   kill-after   needs a deployment with RELAY_KILL_SWITCH=true
//   rate         creates until the per-address limit refuses
//
// It prints counts, lengths and outcomes only: never a key, link, record id or
// payload. The ops secret is read from the private env file, never printed.
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { Client, Contract } from "../test/local-relay.mjs";
import { Setup, fourDaySevenWeekDocument } from "../test/program-fixture.mjs";

const { ENDPOINTS, LIMITS } = Contract;
const base = process.env.RELAY_STAGING_URL;
const envFile = process.env.RELAY_STAGING_ENV;
if (!base || !envFile) throw new Error("RELAY_STAGING_URL and RELAY_STAGING_ENV are required");
const secrets = Object.fromEntries(readFileSync(envFile, "utf8").split("\n").filter(Boolean).map((line) => {
  const at = line.indexOf("=");
  return [line.slice(0, at), line.slice(at + 1)];
}));
const stateFile = join(dirname(envFile), "kill-switch-state.json");
const APP = "https://taurifer.com";
const sent = [];

function relayFetch(origin = APP) {
  return async (url, init = {}) => {
    sent.push(`${url}\n${JSON.stringify(init.headers || {})}\n${typeof init.body === "string" ? init.body : ""}`);
    const { cache, credentials, referrerPolicy, ...rest } = init;
    return fetch(url, { ...rest, headers: { ...(init.headers || {}), Origin: origin } });
  };
}
const options = (extra = {}) => ({ serviceOrigin: base, linkBase: APP + "/", fetch: relayFetch(), ...extra });
async function post(path, body) {
  return fetch(new URL(path, base), { method: "POST", headers: { "Content-Type": "application/json", Origin: APP }, body: JSON.stringify(body) });
}
async function ops(path, body = {}) {
  return fetch(new URL(path, base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secrets.RELAY_OPS_SECRET}` },
    body: JSON.stringify(body),
  });
}
const report = (line) => console.log(line);

async function main() {
  const { document, options: setupOptions } = fourDaySevenWeekDocument();
  const text = JSON.stringify(document);
  const refused = await Setup.encode(document, setupOptions);
  assert.equal(refused.code, "encoded-too-large");
  report(`program: ${Buffer.byteLength(text)} bytes of JSON; the setup link refuses it (${refused.code})`);

  // Proof 1: byte-for-byte round trip, read twice.
  const started = Date.now();
  const created = await Client.send(text, options());
  assert.equal(created.ok, true, created.code);
  const uploadMs = Date.now() - started;
  const ciphertextChars = JSON.parse(sent.at(-1).split("\n")[2]).ciphertext.length;
  const first = await Client.receive(created.link, options());
  const second = await Client.receive(created.link, options());
  assert.equal(first.ok && second.ok, true, first.code || second.code);
  assert.deepEqual(Buffer.from(first.text), Buffer.from(text));
  assert.equal(second.text, text);
  const lifetimeMs = Date.parse(created.expiresAt) - started;
  report(`proof 1: round trip byte for byte, read twice; upload ${uploadMs} ms; ciphertext ${ciphertextChars} base64url chars; lifetime ${(lifetimeMs / 86_400_000).toFixed(3)} days`);

  // Proof 2: link length and QR decode, for both origins.
  for (const origin of [APP, "https://studio.taurifer.com"]) {
    const link = Contract.formatLink(origin + "/", created.id, created.link.split(".").pop());
    const qr = QRCode.create(link, { errorCorrectionLevel: "M" });
    const quiet = 4, ppm = 2, side = (qr.modules.size + 2 * quiet) * ppm;
    const data = new Uint8ClampedArray(side * side * 4).fill(255);
    for (let r = 0; r < qr.modules.size; r += 1) for (let c = 0; c < qr.modules.size; c += 1) {
      if (!qr.modules.get(r, c)) continue;
      for (let dy = 0; dy < ppm; dy += 1) for (let dx = 0; dx < ppm; dx += 1) {
        const o = (((r + quiet) * ppm + dy) * side + (c + quiet) * ppm + dx) * 4;
        data[o] = data[o + 1] = data[o + 2] = 0;
      }
    }
    assert.equal(jsQR(data, side, side)?.data, link);
    report(`proof 2: ${origin} link ${link.length} chars, QR ${qr.version}-M (${qr.modules.size}x${qr.modules.size}), decodes exactly`);
  }

  // Proof 3 (requests half): nothing sent to staging carried the key or a plaintext field.
  const key = created.link.split(".").pop();
  const raw = Buffer.from(Contract.base64UrlDecode(key));
  const all = sent.join("\n");
  for (const form of [key, raw.toString("base64"), raw.toString("hex")]) assert.equal(all.includes(form), false);
  const fields = new Set();
  const walk = (value) => {
    if (typeof value === "string") fields.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { fields.add(k); walk(v); }
  };
  walk(document);
  const probed = [...fields].filter((value) => value.length >= 8);
  for (const field of probed) assert.equal(all.includes(field), false);
  report(`proof 3: ${sent.length} requests to staging carried no key form and none of ${probed.length} plaintext fields`);

  // Proof 4 (key half): a wrong key fails closed.
  const wrongKey = Contract.base64UrlEncode(new Uint8Array(LIMITS.keyBytes).fill(9));
  const wrong = await Client.receive(Contract.formatLink(APP + "/", created.id, wrongKey), options());
  assert.deepEqual(wrong, { ok: false, code: "decrypt-failed" });
  report("proof 4: a wrong key returns decrypt-failed and no text");

  // Proof 5: size bound.
  const nonce = Contract.base64UrlEncode(new Uint8Array(LIMITS.nonceBytes));
  const over = Contract.base64UrlEncode(new Uint8Array(LIMITS.maxCiphertextBytes + 1).fill(1));
  assert.equal((await post(ENDPOINTS.create, { v: 1, nonce, ciphertext: over })).status, 413);
  assert.equal((await post(ENDPOINTS.create, { v: 2, nonce, ciphertext: over.slice(0, 40) })).status, 400);
  report("proof 5: one byte over the ciphertext bound is refused (413); a newer protocol is refused (400)");

  // Proof 5: cost threshold, then restore.
  const month = new Date().toISOString().slice(0, 7);
  assert.equal((await ops("/_ops/billing", { month, monthlyCostCents: LIMITS.costThresholdCents })).status, 200);
  assert.deepEqual(await Client.send("cost probe", options()), { ok: false, code: "service-unavailable" });
  assert.equal((await Client.receive(created.link, options())).ok, true);
  const health = await (await ops("/_ops/health")).json();
  assert.equal(health.costThresholdReached, true);
  assert.equal((await ops("/_ops/billing", { month, monthlyCostCents: 0 })).status, 200);
  const after = await Client.send("after restore", options());
  assert.equal(after.ok, true, after.code);
  const restored = await (await ops("/_ops/health")).json();
  report(`proof 5: at ${LIMITS.costThresholdCents} cents creates are refused (503) while reads continue; alert latched=${health.alerted}; after a 0-cent receipt createsOpen=${restored.createsOpen}; metered ${restored.meteredCents} cents this month`);
}

async function expiry() {
  const health = await (await ops("/_ops/health")).json();
  assert.equal(health.recordLifetimeSeconds, 60, "deploy staging with RELAY_RECORD_LIFETIME_SECONDS=60 first");
  const created = await Client.send("expiry probe", options());
  assert.equal(created.ok, true, created.code);
  assert.equal((await Client.receive(created.link, options())).ok, true);
  const expiresAt = Date.parse(created.expiresAt);
  // A staging script, not a test: the event awaited is the clock passing the expiry.
  while (Date.now() < expiresAt + 1000) await new Promise((resolve) => setTimeout(resolve, 1000));
  const gone = await Client.receive(created.link, options());
  assert.deepEqual(gone, { ok: false, code: "unavailable" });
  report("proof 4: readable before its 60-second expiry, unavailable after it");
}

async function killBefore() {
  const created = await Client.send("kill switch probe", options());
  assert.equal(created.ok, true, created.code);
  writeFileSync(stateFile, JSON.stringify({ link: created.link }), { mode: 0o600 });
  chmodSync(stateFile, 0o600);
  report("kill switch: record created; redeploy with RELAY_KILL_SWITCH=true, then run kill-after");
}

async function killAfter() {
  assert.ok(existsSync(stateFile), "run kill-before first");
  const { link } = JSON.parse(readFileSync(stateFile, "utf8"));
  try {
    const health = await (await ops("/_ops/health")).json();
    assert.equal(health.killSwitch, true, "deploy staging with RELAY_KILL_SWITCH=true first");
    assert.deepEqual(await Client.send("refused", options()), { ok: false, code: "service-unavailable" });
    const read = await Client.receive(link, options());
    assert.equal(read.ok, true, read.code);
    assert.equal(read.text, "kill switch probe");
    report("proof 5: with the kill switch on, creates are refused (503) and an existing record still reads");
  } finally {
    rmSync(stateFile, { force: true });
  }
}

async function rate() {
  let admitted = 0;
  for (let index = 0; index <= LIMITS.createsPerAddressPerHour; index += 1) {
    const created = await Client.send(`rate probe ${index}`, options());
    if (!created.ok) {
      assert.equal(created.code, "rate-limited");
      report(`proof 5: this address was refused (429) after ${admitted} creates in this hour (limit ${LIMITS.createsPerAddressPerHour}, including earlier phases)`);
      return;
    }
    admitted += 1;
  }
  assert.fail("the create rate never refused");
}

const phases = { main, expiry, "kill-before": killBefore, "kill-after": killAfter, rate };
const phase = phases[process.argv[2]];
if (!phase) throw new Error(`phase: ${Object.keys(phases).join(" | ")}`);
await phase();
