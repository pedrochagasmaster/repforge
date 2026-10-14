// One production health pass, run every two minutes by the devbox systemd
// user timer (ops/systemd/). Owner override, 2026-10-14: the receipts below are
// the owner's self-attestation stamped at run time, not independent monitoring,
// and the billing receipt is an attested amount, not an observed bill. When the
// timer stops, the five-minute lease lapses and creates fail closed with 503;
// claims, status, and commit do not use the lease.
//
// The pass refuses to run unless the ops env file and its directory are private.
// Its own output is limited to counts and exit codes.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NAMESPACE_PLACEHOLDER,
  OPS_ENV_KEYS,
  TOKEN_PLACEHOLDER,
  assertPrivatePath,
  defaultOpsEnvPath,
  parseOpsEnv,
} from "./provision-production-secrets.mjs";

export const ATTESTED_CHECK_VERSION = "operator-attested-v1";
export const ATTESTED_EVIDENCE_REF = "owner-override-20261014";
const HEALTH_KINDS = ["alarm", "watchdog", "log", "key", "deletion"];
const PRODUCER = join(dirname(fileURLToPath(import.meta.url)), "health-producer.mjs");
const PRODUCER_ENV_KEYS = [
  "TRANSFER_SERVICE_URL",
  "TRANSFER_WATCHDOG_SECRET",
  "TRANSFER_BILLING_SECRET",
  "TRANSFER_PURGE_SECRET",
  "TRANSFER_CF_ACCOUNT_ID",
  "TRANSFER_DO_NAMESPACE_ID",
  "TRANSFER_CF_API_TOKEN",
];

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

export function readyOpsValues(values) {
  for (const key of OPS_ENV_KEYS) {
    if (typeof values[key] !== "string" || values[key].length === 0) throw new Error(`ops env is missing ${key}`);
  }
  if (values.TRANSFER_CF_API_TOKEN === TOKEN_PLACEHOLDER) throw new Error("the scoped Durable Object list token has not been recorded");
  if (values.TRANSFER_DO_NAMESPACE_ID === NAMESPACE_PLACEHOLDER) throw new Error("the production namespace id has not been recorded");
  if (!/^(?:0|[1-9][0-9]{0,8})$/u.test(values.TRANSFER_ATTESTED_MONTHLY_COST_CENTS)) throw new Error("attested monthly cost is invalid");
  return values;
}

/** Keeps only the producer's fixed summary or error line; never headers, bodies, or tokens. */
export function summarizeProducer(code, stdout, stderr) {
  if (code === 0) {
    const match = /scheduled health accepted; purge examined=(\d+) purged=(\d+)/u.exec(stdout);
    return match ? `health pass ok; purge examined=${match[1]} purged=${match[2]}` : "health pass ok";
  }
  const reason = stderr.split("\n").map((line) => /^Error: ([A-Za-z0-9 _:/.-]{1,120})$/u.exec(line.trim())?.[1]).find(Boolean);
  return `health pass failed exit=${code}${reason ? `; ${reason}` : ""}`;
}

function writeReceipt(directory, name, value) {
  const path = join(directory, name);
  writeFileSync(path, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  return path;
}

async function runPass() {
  process.umask(0o077);
  const opsEnvPath = defaultOpsEnvPath();
  assertPrivatePath(opsEnvPath);
  const values = readyOpsValues(parseOpsEnv(readFileSync(opsEnvPath, "utf8")));
  const receiptDir = join(dirname(opsEnvPath), "production-receipts");
  mkdirSync(receiptDir, { recursive: true, mode: 0o700 });
  if ((statSync(receiptDir).mode & 0o077) !== 0) throw new Error("receipt directory must have mode 0700");
  const receipts = attestedReceipts(Date.now(), Number(values.TRANSFER_ATTESTED_MONTHLY_COST_CENTS));
  const env = {
    TRANSFER_WATCHDOG_RECEIPT_FILE: writeReceipt(receiptDir, "watchdog.json", receipts.watchdog),
    TRANSFER_BILLING_RECEIPT_FILE: writeReceipt(receiptDir, "billing.json", receipts.billing),
    TRANSFER_PURGE_EVIDENCE_REF: ATTESTED_EVIDENCE_REF,
  };
  for (const key of PRODUCER_ENV_KEYS) env[key] = values[key];
  const { code, stdout, stderr } = await new Promise((resolve) => {
    const child = spawn(process.execPath, [PRODUCER], { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { if (out.length < 4096) out += chunk; });
    child.stderr.on("data", (chunk) => { if (err.length < 16_384) err += chunk; });
    child.on("error", () => resolve({ code: 127, stdout: "", stderr: "" }));
    child.on("close", (exitCode) => resolve({ code: exitCode ?? 1, stdout: out, stderr: err }));
  });
  const summary = summarizeProducer(code, stdout, stderr);
  if (code === 0) console.log(summary);
  else console.error(summary);
  return code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await runPass();
  } catch (error) {
    console.error(`health pass refused; ${error instanceof Error ? error.message : "unexpected error"}`);
    process.exitCode = 1;
  }
}
