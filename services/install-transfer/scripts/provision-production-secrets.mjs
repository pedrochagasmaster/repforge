// Production install-transfer secret provisioning (owner override, 2026-10-14).
//
//   node scripts/provision-production-secrets.mjs worker
//     Generates every Worker secret with node:crypto, pipes one JSON object to
//     `wrangler secret bulk --env production` on stdin, then records only the
//     four ops secrets in the 0600 production ops env file the health loop reads.
//   node scripts/provision-production-secrets.mjs namespace
//     After the first deploy, resolves the production TransferDurableObject
//     namespace id with the deploy credentials already in the environment and
//     writes that non-secret id to the ops env file.
//   node scripts/provision-production-secrets.mjs api-token < token-on-stdin
//     Stores the owner's separately scoped Durable Object list token. It must
//     not be the deploy token (CLOUDFLARE_API_TOKEN); the command refuses it.
//
// No value is printed, logged, or passed in argv. The routing, token-MAC,
// digest, and rate-pepper keys exist only in this process and the wrangler pipe.
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, constants, existsSync, fsyncSync, linkSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export const WORKER_NAME = "taurifer-install-transfer";
export const SERVICE_ORIGIN = "https://taurifer.com";
export const CRYPTO_KEY_SECRETS = Object.freeze([
  "TRANSFER_ROUTING_KEY_B64",
  "TRANSFER_TOKEN_MAC_KEY_B64",
  "TRANSFER_DIGEST_KEY_B64",
  "TRANSFER_RATE_PEPPER_B64",
]);
export const OPS_SECRETS = Object.freeze([
  "TRANSFER_WATCHDOG_SECRET",
  "TRANSFER_BILLING_SECRET",
  "TRANSFER_PURGE_SECRET",
  "TRANSFER_ACK_SECRET",
]);
export const TOKEN_PLACEHOLDER = "OWNER_ACTION_SCOPED_DO_LIST_TOKEN";
export const NAMESPACE_PLACEHOLDER = "SET_AFTER_FIRST_DEPLOY";
export const OPS_ENV_KEYS = Object.freeze([
  "TRANSFER_SERVICE_URL",
  ...OPS_SECRETS,
  "TRANSFER_CF_ACCOUNT_ID",
  "TRANSFER_DO_NAMESPACE_ID",
  "TRANSFER_CF_API_TOKEN",
  "TRANSFER_ATTESTED_MONTHLY_COST_CENTS",
]);

const SERVICE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export function defaultOpsEnvPath() {
  return process.env.TRANSFER_PRODUCTION_OPS_ENV ?? join(homedir(), ".config", "taurifer", "production-ops.env");
}

/** 32 CSPRNG bytes as 43 unpadded base64url characters: the Worker's key and ops-secret format. */
export function generateSecret() {
  return randomBytes(32).toString("base64url");
}

/** The ops env file and its directory must not be readable by group or others. */
export function assertPrivatePath(path, { allowMissingFile = false } = {}) {
  const directory = statSync(dirname(path));
  if (!directory.isDirectory() || (directory.mode & 0o077) !== 0 || directory.uid !== process.getuid()) {
    throw new Error("ops env directory must be owned by this user with mode 0700");
  }
  if (!existsSync(path)) {
    if (allowMissingFile) return;
    throw new Error("ops env file is missing");
  }
  const file = statSync(path);
  if (!file.isFile() || (file.mode & 0o077) !== 0 || file.uid !== process.getuid()) {
    throw new Error("ops env file must be owned by this user with mode 0600");
  }
}

export function parseOpsEnv(text) {
  const values = {};
  for (const line of text.split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=([A-Za-z0-9_.:/-]*)$/u.exec(line);
    if (!match || !OPS_ENV_KEYS.includes(match[1]) || match[1] in values) throw new Error("ops env file has an unexpected line");
    values[match[1]] = match[2];
  }
  return values;
}

export function serializeOpsEnv(values) {
  const lines = ["# Taurifer production install-transfer ops credentials. Mode 0600; never print or copy."];
  for (const key of OPS_ENV_KEYS) {
    const value = values[key];
    if (typeof value !== "string" || !/^[A-Za-z0-9_.:/-]*$/u.test(value)) throw new Error(`ops env value for ${key} is invalid`);
    lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n")}\n`;
}

function writePrivateFile(path, text, { replace }) {
  process.umask(0o077);
  const temporary = `${path}.tmp-${process.pid}`;
  const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  try {
    try {
      writeSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    // A first write never replaces an existing file; link fails if one appeared.
    if (replace) renameSync(temporary, path);
    else linkSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  assertPrivatePath(path);
}

function wranglerSecretBulk(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "secret", "bulk", "--env", "production"], {
      cwd: SERVICE_DIR,
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.on("error", () => reject(new Error("wrangler could not start")));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`wrangler secret bulk exited ${code}`))));
    child.stdin.end(JSON.stringify(payload));
  });
}

async function provisionWorker(opsEnvPath) {
  assertPrivatePath(opsEnvPath, { allowMissingFile: true });
  if (existsSync(opsEnvPath)) {
    throw new Error("production ops env file already exists; rotating keys is a runbook procedure, not a re-run");
  }
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (typeof accountId !== "string" || !/^[0-9a-f]{32}$/u.test(accountId)) throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
  const secrets = {};
  for (const name of [...CRYPTO_KEY_SECRETS, ...OPS_SECRETS]) secrets[name] = generateSecret();
  await wranglerSecretBulk(secrets);
  const opsValues = {
    TRANSFER_SERVICE_URL: SERVICE_ORIGIN,
    TRANSFER_CF_ACCOUNT_ID: accountId,
    TRANSFER_DO_NAMESPACE_ID: NAMESPACE_PLACEHOLDER,
    TRANSFER_CF_API_TOKEN: TOKEN_PLACEHOLDER,
    TRANSFER_ATTESTED_MONTHLY_COST_CENTS: "0",
  };
  for (const name of OPS_SECRETS) opsValues[name] = secrets[name];
  writePrivateFile(opsEnvPath, serializeOpsEnv(opsValues), { replace: false });
  console.log(`provisioned ${CRYPTO_KEY_SECRETS.length + OPS_SECRETS.length} Worker secrets for ${WORKER_NAME}; ops env written with mode 0600`);
}

async function recordNamespace(opsEnvPath) {
  assertPrivatePath(opsEnvPath);
  const values = parseOpsEnv(readFileSync(opsEnvPath, "utf8"));
  const accountId = values.TRANSFER_CF_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (typeof token !== "string" || token.length === 0) throw new Error("CLOUDFLARE_API_TOKEN is required to read the namespace list");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/durable_objects/namespaces?per_page=1000`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`namespace list failed with status ${response.status}`);
  const body = await response.json();
  const matches = (body?.result ?? []).filter((namespace) => namespace?.script === WORKER_NAME && namespace?.class === "TransferDurableObject");
  if (matches.length !== 1 || !/^[A-Za-z0-9_-]{1,128}$/u.test(matches[0].id ?? "")) {
    throw new Error(`expected one ${WORKER_NAME} TransferDurableObject namespace, found ${matches.length}`);
  }
  values.TRANSFER_DO_NAMESPACE_ID = matches[0].id;
  writePrivateFile(opsEnvPath, serializeOpsEnv(values), { replace: true });
  console.log(`recorded the ${WORKER_NAME} TransferDurableObject namespace id ${matches[0].id}`);
}

async function readStdin() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 1024) throw new Error("token input is too long");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function recordApiToken(opsEnvPath) {
  assertPrivatePath(opsEnvPath);
  if (process.stdin.isTTY) throw new Error("pipe the scoped token on stdin; it is never accepted as an argument");
  const values = parseOpsEnv(readFileSync(opsEnvPath, "utf8"));
  const token = await readStdin();
  if (!/^[A-Za-z0-9_-]{32,256}$/u.test(token)) throw new Error("scoped token format is invalid");
  if (token === process.env.CLOUDFLARE_API_TOKEN) throw new Error("the scoped token must not be the deploy token");
  values.TRANSFER_CF_API_TOKEN = token;
  writePrivateFile(opsEnvPath, serializeOpsEnv(values), { replace: true });
  console.log("recorded the scoped Durable Object list token");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const opsEnvPath = defaultOpsEnvPath();
  try {
    if (command === "worker") await provisionWorker(opsEnvPath);
    else if (command === "namespace") await recordNamespace(opsEnvPath);
    else if (command === "api-token") await recordApiToken(opsEnvPath);
    else throw new Error("usage: provision-production-secrets.mjs worker|namespace|api-token");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "provisioning failed");
    process.exit(1);
  }
}
