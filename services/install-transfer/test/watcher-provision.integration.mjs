// Watcher secret provisioning (#397): reads the private production ops env,
// pipes exactly the watcher's seven values to `wrangler secret bulk` for the
// watcher config on stdin, never argv, and prints no value.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKEN_PLACEHOLDER, serializeOpsEnv } from "../scripts/provision-production-secrets.mjs";

const script = fileURLToPath(new URL("../scripts/provision-watcher-secrets.mjs", import.meta.url));

function run(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolve({ code, output }));
  });
}

const directory = mkdtempSync(join(tmpdir(), "transfer-watcher-ops-"));
chmodSync(directory, 0o700);
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

const values = {
  TRANSFER_SERVICE_URL: "https://taurifer.com",
  TRANSFER_WATCHDOG_SECRET: "W".repeat(43),
  TRANSFER_BILLING_SECRET: "B".repeat(43),
  TRANSFER_PURGE_SECRET: "P".repeat(43),
  TRANSFER_ACK_SECRET: "A".repeat(43),
  TRANSFER_CF_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  TRANSFER_DO_NAMESPACE_ID: "namespace0123",
  TRANSFER_CF_API_TOKEN: "S".repeat(40),
  TRANSFER_ATTESTED_MONTHLY_COST_CENTS: "0",
};
const env = { PATH: `${bin}:${process.env.PATH}`, TRANSFER_PRODUCTION_OPS_ENV: opsEnv };
writeFileSync(opsEnv, serializeOpsEnv(values), { mode: 0o600 });

{
  const result = await run(env);
  assert.equal(result.code, 0, result.output);
  const { argv, payload } = JSON.parse(readFileSync(record, "utf8"));
  assert.deepEqual(argv, ["wrangler", "secret", "bulk", "--config", "wrangler.watcher.jsonc"]);
  assert.deepEqual(payload, {
    TRANSFER_WATCHDOG_SECRET: values.TRANSFER_WATCHDOG_SECRET,
    TRANSFER_BILLING_SECRET: values.TRANSFER_BILLING_SECRET,
    TRANSFER_PURGE_SECRET: values.TRANSFER_PURGE_SECRET,
    TRANSFER_CF_API_TOKEN: values.TRANSFER_CF_API_TOKEN,
    TRANSFER_CF_ACCOUNT_ID: values.TRANSFER_CF_ACCOUNT_ID,
    TRANSFER_DO_NAMESPACE_ID: values.TRANSFER_DO_NAMESPACE_ID,
    TRANSFER_ATTESTED_MONTHLY_COST_CENTS: "0",
  }, "the ack bearer and service URL stay off the watcher");
  assert.match(result.output, /^provisioned 7 watcher secrets for taurifer-install-transfer-watcher\n$/u);
  for (const value of Object.values(values)) {
    if (value.length >= 32) assert.equal(result.output.includes(value), false, "no secret is printed");
  }
}

// It refuses an unready file (the token placeholder) and loose permissions, and calls wrangler for neither.
for (const [prepare, message] of [
  [() => writeFileSync(opsEnv, serializeOpsEnv({ ...values, TRANSFER_CF_API_TOKEN: TOKEN_PLACEHOLDER }), { mode: 0o600 }), /scoped Durable Object list token has not been recorded/u],
  [() => { writeFileSync(opsEnv, serializeOpsEnv(values), { mode: 0o600 }); chmodSync(opsEnv, 0o640); }, /mode 0600/u],
]) {
  writeFileSync(record, "");
  prepare();
  const refused = await run(env);
  assert.equal(refused.code, 1);
  assert.match(refused.output, message);
  assert.equal(readFileSync(record, "utf8"), "", "wrangler is never called");
  chmodSync(opsEnv, 0o600);
}
assert.ok(existsSync(opsEnv));

// The health status reader sends the watchdog bearer from the file and prints only the lease fields.
{
  const { createServer } = await import("node:http");
  let seen;
  const server = createServer((request, response) => {
    if (request.url === "/_ops/deletion-evidence") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, incidentGeneration: 1, ackGeneration: 1, lastDeletionFailure: null, providerRetries: null }));
      return;
    }
    seen = { path: request.url, authorization: request.headers.authorization };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, leaseFresh: true, deletionHealthy: true, billingHealthy: true, createsEnabled: true, incidentGeneration: 1, ackGeneration: 1, lastDeletionCheck: null, extra: "dropped" }));
  });
  await new Promise((resolve) => server.listen(0, "localhost", resolve));
  writeFileSync(opsEnv, serializeOpsEnv({ ...values, TRANSFER_SERVICE_URL: `http://localhost:${server.address().port}` }), { mode: 0o600 });
  const status = await new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/production-health-status.mjs", import.meta.url))], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolve({ code, output }));
  });
  server.close();
  assert.equal(status.code, 0, status.output);
  assert.deepEqual(seen, { path: "/_ops/health", authorization: `Bearer ${values.TRANSFER_WATCHDOG_SECRET}` });
  const printed = JSON.parse(status.output);
  assert.deepEqual(Object.keys(printed), ["checkedAt", "leaseFresh", "deletionHealthy", "billingHealthy", "createsEnabled", "incidentGeneration", "ackGeneration", "lastDeletionCheck", "lastDeletionFailure", "providerRetries"]);
  assert.equal(printed.lastDeletionFailure, null);
  assert.equal(printed.createsEnabled, true);
  assert.equal(status.output.includes(values.TRANSFER_WATCHDOG_SECRET), false);
}

// The deletion ack reads the health response, including the last-check
// evidence, and acknowledges exactly the current generation.
{
  const { createServer } = await import("node:http");
  const seen = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      seen.push({ method: request.method, path: request.url, body: body ? JSON.parse(body) : undefined });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(request.url === "/_ops/health"
        ? {
          ok: true, leaseFresh: true, deletionHealthy: false, billingHealthy: true, createsEnabled: false, incidentGeneration: 3, ackGeneration: 1,
          lastDeletionCheck: { checkVersion: "operator-attested-v1", observedAt: Date.now(), result: "pass", path: null, errorClass: null, consecutiveFailures: 0 },
        }
        : { ok: true, acknowledged: true, createsEnabled: true }));
    });
  });
  await new Promise((resolve) => server.listen(0, "localhost", resolve));
  const ack = await new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/deletion-ack.mjs", import.meta.url))], {
      env: {
        PATH: process.env.PATH,
        TRANSFER_SERVICE_URL: `http://localhost:${server.address().port}`,
        TRANSFER_ACK_SECRET: "a".repeat(43),
        TRANSFER_ACK_CONFIRM: "I_HAVE_REVIEWED_DELETION",
        TRANSFER_ACK_EVIDENCE_REF: "fixture-ack",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolve({ code, output }));
  });
  server.close();
  assert.equal(ack.code, 0, ack.output);
  assert.equal(ack.output.trim(), "deletion incident acknowledgement accepted");
  assert.deepEqual(seen.map((call) => [call.method, call.path]), [["GET", "/_ops/health"], ["POST", "/_ops/deletion-ack"]]);
  assert.equal(seen[1].body.generation, 3);
}

// The controlled transfer refuses to run without its explicit confirmation and
// makes no request.
{
  const refused = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/controlled-transfer.mjs", import.meta.url))], {
    env: { PATH: process.env.PATH, TRANSFER_SERVICE_URL: "http://localhost:9" },
    encoding: "utf8",
  });
  assert.equal(refused.status, 1);
  assert.equal(refused.stderr.trim(), "set TRANSFER_CONTROLLED_CONFIRM=CREATE_ONE_SYNTHETIC_TRANSFER to create one synthetic production transfer");
  assert.equal(refused.stdout, "");
}
console.log("watcher provisioning integration passed");
