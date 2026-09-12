#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.env.TAURIFER_DRAFT_STORE_ROOT || join(dirname(fileURLToPath(import.meta.url)), ".."));
const appPath = join(root, "app.js");
const durablePath = join(root, "durable-state.js");
const checkOnly = process.argv.includes("--check");

let app = readFileSync(appPath, "utf8");
let durable = readFileSync(durablePath, "utf8");

function fail(message) {
  throw new Error(`draft-store ownership migration: ${message}`);
}

function verify() {
  if (!app.includes("const DraftStore=DurableState.DraftStore;")) fail("app.js does not use the durable owner");
  if (app.includes("const DraftStore={")) fail("app.js still defines DraftStore algorithms");
  if (!durable.includes("  const DraftStore={")) fail("durable-state.js does not define DraftStore");
  if (!durable.includes("    DraftStore,")) fail("durable-state.js does not export DraftStore");
  if (!durable.includes("function currentStateSnapshot()")) fail("live-state host boundary is missing");
}

if (app.includes("const DraftStore=DurableState.DraftStore;")) {
  verify();
  console.log("draft-store ownership migration: already applied");
  process.exit(0);
}
if (checkOnly) fail("migration has not been applied");

const storeStart = app.indexOf("const DraftStore={");
const storeEndMarker = "\n};\nfunction parsedAcknowledgedDraftV2";
const storeEnd = app.indexOf(storeEndMarker, storeStart);
if (storeStart < 0 || storeEnd < 0) fail("cannot find the app.js DraftStore block");
let store = app.slice(storeStart, storeEnd + 3);
store = store
  .replaceAll("WorkoutDraft?.", "workoutDraft()?.")
  .replaceAll("DurableState.STORAGE_LOCK", "STORAGE_LOCK")
  .replaceAll("DurableState.getJournalWriterId()", "getJournalWriterId()")
  .replaceAll("DurableState.hasPendingJournal()", "hasPendingJournal()")
  .replaceAll("DurableState.pendingJournalOrder()", "pendingJournalOrder()")
  .replaceAll("draftContextFingerprint(state)", "draftContextFingerprint(currentStateSnapshot())")
  .replaceAll("storeDraftRecovery(", "retainDraftRecovery(");

const helperStart = app.indexOf("function v2CheckpointRecord");
const helperEndMarker = "\n\n\nfunction readPendingJournal";
const helperEnd = app.indexOf(helperEndMarker, helperStart);
if (helperStart < 0 || helperEnd < 0) fail("cannot find the checkpoint helper block");
let helpers = app.slice(helperStart, helperEnd);
helpers = helpers.replaceAll("WorkoutDraft?.", "workoutDraft()?.");

const support = `function hostFunction(name) {
  const fn = host?.[name];
  if (typeof fn !== "function") throw new Error(\`durable host adapter missing \${name}\`);
  return fn;
}

function currentStateSnapshot(){
  return typeof host?.getLiveState==="function"?host.getLiveState():persistHead}
function workoutDraft(){return host?.workoutDraft||root?.RepForgeWorkoutDraft||null}
function retainDraftRecovery(raw,reason){return hostFunction("storeDraftRecovery")(raw,reason)}
`;
const indent = (source) => source.split("\n").map((line) => `  ${line}`).join("\n");

const proxyPattern = /  function getDraftStore\(\)[\s\S]*?  const DraftStore = new Proxy\(\{\}, \{[\s\S]*?^  \}\);\n/m;
if (!proxyPattern.test(durable)) fail("cannot find the durable-state.js DraftStore proxy");
durable = durable.replace(proxyPattern, `${indent(support)}\n${indent(helpers)}\n\n${indent(store)}\n`);
durable = durable.replaceAll("storeDraftRecovery(currentRaw,\"canonical-overwrite-before-state-transaction\")",
  "retainDraftRecovery(currentRaw,\"canonical-overwrite-before-state-transaction\")");
durable = durable.replace(
  "  const DRAFT_CLOSE_PREFIX = \"repforge_draft_v1:closing:\";",
  "  const DRAFT_CLOSE_PREFIX = \"repforge_draft_v1:closing:\";\n  const DRAFT_WRITE_TRANSACTION = \"draft-write\";"
);
durable = durable.replace(
  "    // Normalizer & Contracts\n    normalizeDurableOutcome,",
  "    // DraftV2 storage owner\n    DraftStore,\n    v2CheckpointRecord,\n    prepareV2CheckpointEffect,\n    commitV2CheckpointEffect,\n\n    // Normalizer & Contracts\n    normalizeDurableOutcome,"
);

app = app.slice(0, storeStart) + "const DraftStore=DurableState.DraftStore;" + app.slice(storeEnd + 3);

const migratedHelperStart = app.indexOf("function v2CheckpointRecord");
const migratedHelperEnd = app.indexOf(helperEndMarker, migratedHelperStart);
if (migratedHelperStart < 0 || migratedHelperEnd < 0) fail("cannot relocate the app.js checkpoint wrappers");
const wrappers = `function v2CheckpointRecord(draft,raw,operationId=draft.writer.operationId){
  return DurableState.v2CheckpointRecord(draft,raw,operationId)}
function prepareV2CheckpointEffect(currentRaw,nextRaw,operationId,options={}){
  return DurableState.prepareV2CheckpointEffect(currentRaw,nextRaw,operationId,options)}
function commitV2CheckpointEffect(prepared,nextRaw){
  return DurableState.commitV2CheckpointEffect(prepared,nextRaw)}`;
app = app.slice(0, migratedHelperStart) + wrappers + app.slice(migratedHelperEnd);
app = app.replace(
  "    draftStore:DraftStore,",
  "    workoutDraft:WorkoutDraft,\n    getLiveState:()=>state,\n    storeDraftRecovery,"
);

writeFileSync(appPath, app);
writeFileSync(durablePath, durable);
app = readFileSync(appPath, "utf8");
durable = readFileSync(durablePath, "utf8");
verify();
console.log("draft-store ownership migration: applied");
