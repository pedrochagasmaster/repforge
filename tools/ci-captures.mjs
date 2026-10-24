/**
 * CI-rendered catalog frames that differ from the committed catalog, published
 * so a session can review and commit what CI renders instead of recapturing on
 * a small machine (tools/fetch-ci-captures.mjs). Publishing never changes a
 * verdict: the committed frames stay the immutable baseline and must still
 * match what CI renders.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const CI_CAPTURES_KIND = "ci-captures";

/**
 * Copy changed frames under `<dir>/frames/<repo path>` and merge them into
 * `<dir>/changes-<producer>.json`. Without a directory (every local run) it does nothing.
 */
export function recordCiCaptures({ dir = process.env.REPFORGE_CI_CAPTURES_DIR, producer, source, frames = [], semanticChanged = false } = {}) {
  if (!dir) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(producer || "")) throw new Error(`CI capture producer must be a plain name, got ${JSON.stringify(producer)}`);
  const manifestPath = join(dir, `changes-${producer}.json`);
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const byPath = new Map((previous?.frames || []).map((frame) => [frame.path, frame]));
  for (const frame of frames) {
    const target = join(dir, "frames", frame.path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(frame.file, target);
    byPath.set(frame.path, { path: frame.path, state: frame.state, reasons: frame.reasons || [] });
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({ schemaVersion: 1, kind: CI_CAPTURES_KIND, source, producer,
    frames: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    semanticChanged: Boolean(previous?.semanticChanged || semanticChanged) }, null, 2)}\n`);
  return manifestPath;
}

export const DETERMINISTIC_MARKER = "deterministic-failure.json";

/**
 * Record that this command failed on a pure comparison (catalog frames, entry
 * semantics, rendered-role findings) that a replay would only repeat. The runner
 * then skips the diagnostic replay it gives other browser failures.
 */
export function markDeterministicFailure(reason, { dir = process.env.REPFORGE_ARTIFACT_DIR } = {}) {
  if (!dir) return null;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, DETERMINISTIC_MARKER);
  writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, kind: "deterministic-failure", reason }, null, 2)}\n`);
  return path;
}
