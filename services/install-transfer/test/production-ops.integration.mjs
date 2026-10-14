// Production provisioning and health-loop guards: secret formats, the
// private ops env file, the honest attested receipts, and redacted output.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBillingObservation, parseProviderHealthObservation } from "../src/observation.js";
import {
  CRYPTO_KEY_SECRETS,
  NAMESPACE_PLACEHOLDER,
  OPS_SECRETS,
  TOKEN_PLACEHOLDER,
  assertPrivatePath,
  generateSecret,
  parseOpsEnv,
  serializeOpsEnv,
} from "../scripts/provision-production-secrets.mjs";
import {
  ATTESTED_CHECK_VERSION,
  ATTESTED_EVIDENCE_REF,
  attestedReceipts,
  readyOpsValues,
  summarizeProducer,
} from "../scripts/production-health-loop.mjs";

const provisionScript = fileURLToPath(new URL("../scripts/provision-production-secrets.mjs", import.meta.url));
const loopScript = fileURLToPath(new URL("../scripts/production-health-loop.mjs", import.meta.url));
const accountId = "0123456789abcdef0123456789abcdef";

function privateDir() {
  const directory = mkdtempSync(join(tmpdir(), "transfer-prod-ops-"));
  chmodSync(directory, 0o700);
  return directory;
}

function run(script, args, env, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input ?? "");
  });
}

// Every Worker key and ops secret is 32 CSPRNG bytes as unpadded base64url.
const samples = new Set(Array.from({ length: 64 }, generateSecret));
assert.equal(samples.size, 64);
for (const value of samples) {
  assert.match(value, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(Buffer.from(value, "base64url").length, 32);
}

// `worker` pipes exactly the eight secrets to wrangler on stdin, never argv, and
// writes only the four ops secrets to a 0600 file. A fake npx records the shape.
{
  const directory = privateDir();
  const bin = join(directory, "bin");
  const record = join(directory, "wrangler-record.json");
  const opsEnv = join(directory, "production-ops.env");
  mkdirSync(bin, { mode: 0o700 });
  writeFileSync(join(bin, "npx"), `#!${process.execPath}
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  require("node:fs").writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), payload }));
});
`, { mode: 0o700 });
  const env = { PATH: `${bin}:${process.env.PATH}`, TRANSFER_PRODUCTION_OPS_ENV: opsEnv, CLOUDFLARE_ACCOUNT_ID: accountId };
  const result = await run(provisionScript, ["worker"], env);
  assert.equal(result.code, 0, result.stderr);
  const { argv, payload } = JSON.parse(readFileSync(record, "utf8"));
  assert.deepEqual(argv, ["wrangler", "secret", "bulk", "--env", "production"]);
  assert.deepEqual(Object.keys(payload).sort(), [...CRYPTO_KEY_SECRETS, ...OPS_SECRETS].sort());
  for (const value of Object.values(payload)) assert.match(value, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(new Set(Object.values(payload)).size, 8, "every secret is independently generated");
  assert.equal(statSync(opsEnv).mode & 0o777, 0o600);
  const stored = parseOpsEnv(readFileSync(opsEnv, "utf8"));
  for (const name of OPS_SECRETS) assert.equal(stored[name], payload[name]);
  for (const name of CRYPTO_KEY_SECRETS) {
    assert.equal(name in stored, false);
    assert.doesNotMatch(readFileSync(opsEnv, "utf8"), new RegExp(payload[name], "u"), `${name} never touches disk`);
  }
  assert.equal(stored.TRANSFER_SERVICE_URL, "https://taurifer.com");
  assert.equal(stored.TRANSFER_CF_ACCOUNT_ID, accountId);
  assert.equal(stored.TRANSFER_CF_API_TOKEN, TOKEN_PLACEHOLDER);
  assert.equal(stored.TRANSFER_DO_NAMESPACE_ID, NAMESPACE_PLACEHOLDER);
  for (const value of Object.values(payload)) assert.equal((result.stdout + result.stderr).includes(value), false, "no secret is printed");

  // A second run refuses rather than silently rotating live keys.
  const again = await run(provisionScript, ["worker"], env);
  assert.notEqual(again.code, 0);
  assert.match(again.stderr, /already exists/u);

  // The scoped token is read from stdin, must not equal the deploy token, and is never echoed.
  const deployToken = "D".repeat(40);
  const refused = await run(provisionScript, ["api-token"], { ...env, CLOUDFLARE_API_TOKEN: deployToken }, deployToken);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /must not be the deploy token/u);
  const scoped = "S".repeat(40);
  const accepted = await run(provisionScript, ["api-token"], { ...env, CLOUDFLARE_API_TOKEN: deployToken }, `${scoped}\n`);
  assert.equal(accepted.code, 0, accepted.stderr);
  assert.equal(parseOpsEnv(readFileSync(opsEnv, "utf8")).TRANSFER_CF_API_TOKEN, scoped);
  assert.equal((accepted.stdout + accepted.stderr).includes(scoped), false);
  assert.equal(statSync(opsEnv).mode & 0o777, 0o600);

  // The loop refuses while the namespace id is still the placeholder, and when permissions loosen.
  const pending = await run(loopScript, [], { TRANSFER_PRODUCTION_OPS_ENV: opsEnv });
  assert.equal(pending.code, 1);
  assert.match(pending.stderr, /namespace id has not been recorded/u);
  chmodSync(opsEnv, 0o640);
  const loose = await run(loopScript, [], { TRANSFER_PRODUCTION_OPS_ENV: opsEnv });
  assert.equal(loose.code, 1);
  assert.match(loose.stderr, /mode 0600/u);
  chmodSync(opsEnv, 0o600);
  chmodSync(directory, 0o750);
  const looseDir = await run(loopScript, [], { TRANSFER_PRODUCTION_OPS_ENV: opsEnv });
  assert.equal(looseDir.code, 1);
  assert.match(looseDir.stderr, /mode 0700/u);
  const looseProvision = await run(provisionScript, ["namespace"], { TRANSFER_PRODUCTION_OPS_ENV: opsEnv, CLOUDFLARE_API_TOKEN: deployToken });
  assert.equal(looseProvision.code, 1);
  assert.match(looseProvision.stderr, /mode 0700/u);
  for (const value of Object.values(payload)) {
    assert.equal((pending.stderr + loose.stderr + looseDir.stderr + looseProvision.stderr).includes(value), false);
  }
}

// Private-path checks and the env file format.
{
  const directory = privateDir();
  const file = join(directory, "ops.env");
  assert.doesNotThrow(() => assertPrivatePath(file, { allowMissingFile: true }));
  assert.throws(() => assertPrivatePath(file), /missing/u);
  assert.throws(() => parseOpsEnv("UNKNOWN_KEY=value\n"), /unexpected line/u);
  assert.throws(() => parseOpsEnv('TRANSFER_SERVICE_URL="https://taurifer.com"\n'), /unexpected line/u);
  assert.throws(() => serializeOpsEnv({}), /invalid/u);
}

// The attested receipts are accepted by the producer's parsers and say what they are.
{
  const now = Date.now();
  const receipts = attestedReceipts(now, 0);
  const health = parseProviderHealthObservation(receipts.watchdog, { now });
  for (const value of Object.values(health.health)) {
    assert.equal(value.checkVersion, ATTESTED_CHECK_VERSION);
    assert.equal(value.evidenceRef, ATTESTED_EVIDENCE_REF);
    assert.equal(value.source, "owner-watchdog");
  }
  const billing = parseBillingObservation(receipts.billing, { now });
  assert.equal(billing.checkVersion, "operator-attested-v1");
  assert.equal(billing.evidenceRef, "owner-override-20261014");
  assert.equal(billing.monthlyCostCents, 0);
}

// Ready values require the recorded token and namespace and a bounded attested cost.
{
  const values = {
    TRANSFER_SERVICE_URL: "https://taurifer.com",
    TRANSFER_WATCHDOG_SECRET: generateSecret(),
    TRANSFER_BILLING_SECRET: generateSecret(),
    TRANSFER_PURGE_SECRET: generateSecret(),
    TRANSFER_ACK_SECRET: generateSecret(),
    TRANSFER_CF_ACCOUNT_ID: accountId,
    TRANSFER_DO_NAMESPACE_ID: "namespace-0123",
    TRANSFER_CF_API_TOKEN: "S".repeat(40),
    TRANSFER_ATTESTED_MONTHLY_COST_CENTS: "0",
  };
  assert.equal(readyOpsValues({ ...values }).TRANSFER_DO_NAMESPACE_ID, "namespace-0123");
  assert.throws(() => readyOpsValues({ ...values, TRANSFER_CF_API_TOKEN: TOKEN_PLACEHOLDER }), /scoped Durable Object list token/u);
  assert.throws(() => readyOpsValues({ ...values, TRANSFER_ATTESTED_MONTHLY_COST_CENTS: "-1" }), /attested monthly cost/u);
}

// The loop's own output keeps counts and fixed error text only.
{
  assert.equal(summarizeProducer(0, "scheduled health accepted; purge examined=3 purged=2\n", ""), "health pass ok; purge examined=3 purged=2");
  assert.equal(
    summarizeProducer(1, "", "file:///x/health-producer.mjs:276\n    throw new Error(`scheduled operations request failed: ${path}`);\nError: scheduled operations request rejected: /_ops/heartbeat\n    at postJson\n"),
    "health pass failed exit=1; scheduled operations request rejected: /_ops/heartbeat",
  );
  const leaked = summarizeProducer(1, "Authorization: Bearer abc", "Error: Bearer secret-value={\"token\":\"v1.k1.x\"}\n");
  assert.equal(leaked, "health pass failed exit=1");
}

console.log("production ops integration passed");
