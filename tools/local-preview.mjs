/** Owns one isolated worktree preview for browser tests and screen capture. */
import { spawn, execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { join } from "node:path";
import { BROWSER_LANES } from "../test/suites.mjs";

const PREVIEW_GENERATED_FILES = ["index.html", "posthog-config.js"];
const PREVIEW_READINESS_TIMEOUT_MS = 500;
function snapshotPreviewFiles(cwd) {
  return PREVIEW_GENERATED_FILES.map((relativePath) => {
    const path = join(cwd, relativePath);
    try {
      return { path, exists: true, bytes: readFileSync(path) };
    } catch (error) {
      if (error.code === "ENOENT") return { path, exists: false, bytes: null };
      throw error;
    }
  });
}

function restorePreviewFiles(snapshot) {
  for (const file of snapshot) {
    if (file.exists) writeFileSync(file.path, file.bytes);
    else rmSync(file.path, { force: true });
  }
}

async function allocateLoopbackPort(createServerImpl = createServer) {
  return new Promise((resolvePort, reject) => {
    const server = createServerImpl();
    server.unref?.();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (!Number.isInteger(port)) reject(new Error("Could not allocate a loopback preview port"));
        else resolvePort(port);
      });
    });
  });
}

const isLoopback = (url) => ["localhost", "127.0.0.1"].includes(url.hostname);

export async function maybeStartLocalPreview(entries, {
  cwd = ROOT,
  env = process.env,
  fetchImpl = globalThis.fetch,
  execFileSyncImpl = execFileSync,
  spawnImpl = spawn,
  signalSource = process,
  killGroup = (pid, signal) => process.kill(-pid, signal),
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds)),
  allocatePort = () => allocateLoopbackPort(),
  identityToken = randomUUID(),
} = {}) {
  if (!entries.some(({ lane }) => BROWSER_LANES.has(lane))) return null;

  const explicitUrl = typeof env.REPFORGE_URL === "string" && env.REPFORGE_URL.trim()
    ? new URL(env.REPFORGE_URL)
    : null;
  if (explicitUrl && !isLoopback(explicitUrl)) {
    return { env: { ...env, REPFORGE_URL: explicitUrl.href }, cleanup() {} };
  }

  mkdirSync(join(cwd, ".ci-results"), { recursive: true });
  const identityRelativePath = `.ci-results/preview-identity-${identityToken}.txt`;
  const identityPath = join(cwd, identityRelativePath);
  writeFileSync(identityPath, identityToken);

  let serverLog = null;
  let child = null;
  let childExited = false;
  let cleanupDone = false;
  let cleanupError = null;
  let interrupted = false;
  let spawnError = null;
  let snapshot = null;
  const abort = new AbortController();
  const removeSignalListener = () => {
    signalSource.removeListener("SIGINT", onSignal);
    signalSource.removeListener("SIGTERM", onSignal);
  };
  const cleanup = () => {
    if (cleanupDone) return cleanupError;
    cleanupDone = true;
    removeSignalListener();
    const errors = [];
    if (child && !childExited && child.pid) {
      try {
        if (process.platform === "win32") child.kill("SIGTERM");
        else killGroup(child.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") errors.push(error);
      }
    }
    if (serverLog !== null) {
      try { closeSync(serverLog); } catch (error) { if (error.code !== "EBADF") errors.push(error); }
    }
    if (snapshot) {
      try { restorePreviewFiles(snapshot); } catch (error) { errors.push(error); }
    }
    try { rmSync(identityPath, { force: true }); } catch (error) { errors.push(error); }
    cleanupError = errors.length ? new AggregateError(errors, "Could not clean up the temporary local preview") : null;
    return cleanupError;
  };
  const onSignal = () => {
    interrupted = true;
    abort.abort();
    cleanup();
  };
  const fetchWithDeadline = async (url) => {
    const requestAbort = new AbortController();
    let rejectDeadline;
    let rejectLifecycle;
    let lifecycleRejected = false;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const lifecycle = new Promise((_, reject) => { rejectLifecycle = reject; });
    const rejectOnLifecycle = () => {
      if (lifecycleRejected) return;
      lifecycleRejected = true;
      rejectLifecycle(abort.signal.reason || new Error("Local preview startup interrupted"));
    };
    const relayAbort = () => requestAbort.abort(abort.signal.reason);
    const onLifecycleAbort = () => {
      relayAbort();
      rejectOnLifecycle();
    };
    if (abort.signal.aborted) onLifecycleAbort();
    else abort.signal.addEventListener("abort", onLifecycleAbort, { once: true });
    const timeout = setTimeoutImpl(() => {
      const error = new Error("Local preview readiness request timed out");
      requestAbort.abort(error);
      rejectDeadline(error);
    }, PREVIEW_READINESS_TIMEOUT_MS);
    try {
      const response = await Promise.race([
        Promise.resolve().then(() => fetchImpl(url, { signal: requestAbort.signal })), deadline, lifecycle,
      ]);
      return response;
    } finally {
      clearTimeoutImpl(timeout);
      abort.signal.removeEventListener("abort", onLifecycleAbort);
    }
  };
  const verifyIdentity = async (target) => {
    const identityUrl = new URL(identityRelativePath, target);
    const response = await fetchWithDeadline(identityUrl);
    if (!response.ok) return false;
    return (await response.text()) === identityToken;
  };

  signalSource.once("SIGINT", onSignal);
  signalSource.once("SIGTERM", onSignal);
  try {
    if (explicitUrl) {
      let matches = false;
      try { matches = await verifyIdentity(explicitUrl); } catch {}
      if (!matches) {
        throw new Error(
          `REPFORGE_URL (${explicitUrl.href}) is not serving this worktree. ` +
          `Use a server rooted at ${cwd} or unset REPFORGE_URL so the runner can start an isolated preview.`
        );
      }
      console.log(`Verified local preview belongs to this worktree: ${explicitUrl.href}`);
      return { env: { ...env, REPFORGE_URL: explicitUrl.href }, cleanup: () => { const error = cleanup(); if (error) throw error; } };
    }

    snapshot = snapshotPreviewFiles(cwd);
    execFileSyncImpl(process.execPath, ["scripts/generate-posthog-config.mjs"], {
      cwd,
      stdio: "ignore",
      env: { ...env, CF_PAGES_BRANCH: "", POSTHOG_ENABLE_PREVIEWS: "false", POSTHOG_PROJECT_TOKEN: "" },
    });
    if (interrupted) throw new Error("Temporary local preview startup interrupted");
    const port = await allocatePort();
    const target = new URL(`http://127.0.0.1:${port}/`);
    serverLog = openSync(join(cwd, ".ci-results/local-server.log"), "w");
    child = spawnImpl("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", cwd], {
      cwd, detached: process.platform !== "win32", stdio: ["ignore", serverLog, serverLog],
    });
    child.once?.("error", (error) => { spawnError = error; });
    child.once?.("exit", () => { childExited = true; });
    child.once?.("close", () => { childExited = true; });
    for (let attempt = 0; attempt < 40; attempt++) {
      if (interrupted) throw new Error("Temporary local preview startup interrupted");
      if (spawnError) throw spawnError;
      try {
        if (await verifyIdentity(target)) {
          console.log(`Started isolated local preview for browser checks: ${target.href}`);
          return { env: { ...env, REPFORGE_URL: target.href }, cleanup: () => { const error = cleanup(); if (error) throw error; } };
        }
      } catch (error) {
        if (interrupted) throw new Error("Temporary local preview startup interrupted", { cause: error });
        if (spawnError) throw spawnError;
      }
      await wait(100);
    }
    throw new Error(`Could not start the temporary local preview for ${cwd}`);
  } catch (error) {
    removeSignalListener();
    const cleanupFailure = cleanup();
    if (cleanupFailure) throw new AggregateError([error, cleanupFailure], "Temporary local preview failed");
    throw error;
  }
}
