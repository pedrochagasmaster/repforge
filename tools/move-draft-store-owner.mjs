#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.env.TAURIFER_DRAFT_STORE_ROOT || join(dirname(fileURLToPath(import.meta.url)), ".."));
const appPath = join(root, "app.js");
const durablePath = join(root, "src/persistence/durable.js");
// Historical command name retained for the accepted risk inventory. The one-off
// source rewrite has been removed; this command only checks current ownership.

const app = readFileSync(appPath, "utf8");
const durable = readFileSync(durablePath, "utf8");

function fail(message) {
  throw new Error(`draft-store ownership migration: ${message}`);
}

function verify() {
  if (!/\bDraftStore\s*=\s*DurableState\.DraftStore\s*;/.test(app)) fail("app.js does not use the durable owner");
  if (app.includes("const DraftStore={")) fail("app.js still defines DraftStore algorithms");
  if (!durable.includes("  const DraftStore={")) fail("src/persistence/durable.js does not define DraftStore");
  if (!durable.includes("    DraftStore,")) fail("src/persistence/durable.js does not export DraftStore");
  if (!durable.includes("  async function reconcileV2Checkpoint(read,label){") ||
      !durable.includes("    reconcileV2Checkpoint,"))
    fail("src/persistence/durable.js does not own and export V2 checkpoint reconciliation");
  if (!/async function reconcileV2Checkpoint\(read,label\)\{\s*return DurableState\.reconcileV2Checkpoint\(read,label\)\}/.test(app))
    fail("app.js checkpoint reconciliation is not forwarding-only");
  if (/DraftStore\.(?:writeV2Checkpoint|publishCanonical|v2Tombstone)\(/.test(app))
    fail("app.js still mutates DraftV2 checkpoint state");
  if (!durable.includes("function currentStateSnapshot()")) fail("live-state host boundary is missing");
  if (/localStorage\.removeItem\(KEY\)/.test(app) || /idbDel\(KEY\)/.test(app))
    fail("app.js directly deletes a primary durable replica");
  if (/indexedDB\.open\(DB/.test(app)) fail("app.js still defines IndexedDB primitives");
}

verify();
console.log("draft-store ownership: native durable owner verified");
