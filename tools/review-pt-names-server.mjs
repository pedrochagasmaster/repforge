#!/usr/bin/env node
/* Local-only owner review for Plan 067 Portuguese exercise names.
   No dependencies, no production route, no remote API. */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "plans/067/data/app_file.json";
const CURATION = "tools/exercise-catalog-curation.json";
const DRAFT = "tools/exercise-names-pt-draft.json";
const GENERATED = ["exercises.js", "assets/exercise-catalog.json"];
const UUID = /^[0-9a-f]{32}$/;
const MEDIA = /^[a-zA-Z0-9_-]+\.webp$/;
let tempSerial = 0;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function stableLabels(ids, index, expandEquipment = false) {
  const labels = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    const entry = index[id];
    if (!entry) continue;
    const members = expandEquipment && Array.isArray(entry.equipment) && entry.equipment.length
      ? entry.equipment : [id];
    for (const member of members) {
      const target = index[member];
      const label = target && typeof target.name === "string" && target.name.trim()
        ? target.name.trim() : null;
      if (label) labels.add(label);
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b, "en"));
}

function exerciseContext(exercise, index, mediaId) {
  const equipment = stableLabels([
    ...(exercise.resistanceEquipmentGroupIds || []),
    ...(exercise.supportEquipmentGroupIds || [])
  ], index, true);
  const muscles = stableLabels([
    ...(exercise.primaryMuscle || []),
    ...(exercise.secondaryMuscle || [])
  ], index);
  const names = ids => (Array.isArray(ids) ? ids : [ids])
    .map(id => index[id]?.name?.trim()).filter(Boolean);
  return {
    equipment,
    muscles,
    pattern: names(exercise.movementPattern),
    alternatives: names(exercise.alternativeName),
    laterality: names(exercise.laterality),
    media: mediaId ? "/assets/exercises/" + mediaId + ".webp" : null
  };
}

function readState(root) {
  const source = readJson(join(root, SOURCE));
  const curation = readJson(join(root, CURATION));
  const draft = readJson(join(root, DRAFT));
  if (!Array.isArray(source.exercises) || !source.uuidIndex ||
      curation.schemaVersion !== 1 || draft.schemaVersion !== 1 ||
      draft.status !== "draft-for-review" || curation.source !== SOURCE ||
      draft.source !== SOURCE || !curation.entries || !draft.entries)
    throw new Error("The Plan 067 source or review JSON is not in the expected format.");

  const byId = new Map(source.exercises.map(item => [item.id, item]));
  for (const [id, entry] of Object.entries(draft.entries)) {
    if (Object.hasOwn(curation.entries, id))
      throw new Error("Reviewed and draft lists overlap for UUID " + id + ". Run the catalog checker.");
    if (byId.get(id)?.name !== entry.sourceName)
      throw new Error("Draft identity no longer matches the source for UUID " + id);
  }

  const pending = Object.entries(draft.entries).map(([id, entry]) => {
    const exercise = byId.get(id);
    return {
      id, englishName: exercise.name, draftName: entry.namePt,
      aliases: entry.aliases,
      ...exerciseContext(exercise, source.uuidIndex, null)
    };
  });
  const compare = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
  pending.sort((a, b) => compare(a.equipment[0] || "zzz", b.equipment[0] || "zzz") ||
    compare(a.muscles[0] || "zzz", b.muscles[0] || "zzz") ||
    compare(a.englishName, b.englishName) || compare(a.id, b.id));

  const reviewedExamples = Object.entries(curation.entries).flatMap(([id, entry]) => {
    const exercise = byId.get(id);
    return exercise ? [{
      id, englishName: exercise.name, namePt: entry.namePt,
      ...exerciseContext(exercise, source.uuidIndex, entry.mediaId)
    }] : [];
  });
  return {
    total: source.exercises.length, reviewed: Object.keys(curation.entries).length,
    remaining: pending.length, pending, reviewedExamples
  };
}

function validateReview(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      typeof value.id !== "string" || !UUID.test(value.id))
    throw Object.assign(new Error("Select a valid exercise UUID."), { status: 400 });
  if (typeof value.namePt !== "string" || !value.namePt.trim() ||
      value.namePt.trim().length > 140)
    throw Object.assign(new Error("Portuguese name must be 1–140 characters."), { status: 400 });
  if (!Array.isArray(value.aliases) || value.aliases.length > 24)
    throw Object.assign(new Error("Aliases must be an array of at most 24 terms."), { status: 400 });
  const seen = new Set();
  const aliases = value.aliases.map(item => {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 140)
      throw Object.assign(new Error("Every alias must contain 1–140 characters."), { status: 400 });
    const text = item.trim();
    const normalized = text.normalize("NFKC").toLocaleLowerCase("en");
    if (seen.has(normalized))
      throw Object.assign(new Error("Aliases must be unique (ignoring case and spacing)."), { status: 400 });
    seen.add(normalized);
    return text;
  });
  return { id: value.id, namePt: value.namePt.trim(), aliases };
}

function atomicWrite(path, contents) {
  const next = path + ".review-" + process.pid + "-" + ++tempSerial + ".tmp";
  try {
    writeFileSync(next, contents, { flag: "wx" });
    renameSync(next, path);
  } finally {
    if (existsSync(next)) unlinkSync(next);
  }
}

function renderJsonLikeOriginal(original, value) {
  const indent = original.match(/\n( +)"/)?.[1]?.length || 2;
  return JSON.stringify(value, null, indent) + "\n";
}

function defaultRebuild(root) {
  const result = spawnSync(process.execPath, [join(root, "tools/build-exercises.mjs")], {
    cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024
  });
  if (result.error || result.status !== 0)
    throw new Error("Catalog regeneration failed: " +
      (result.error?.message || result.stderr || result.stdout || "unknown error").slice(0, 1200));
}

function acceptReview(root, rebuild, body, history = new Map()) {
  const { id, namePt, aliases } = validateReview(body);
  const source = readJson(join(root, SOURCE));
  const rawExercise = source.exercises.find(item => item.id === id);
  if (!rawExercise) throw Object.assign(new Error("UUID is not in the source corpus."), { status: 404 });

  const paths = [join(root, CURATION), join(root, DRAFT), ...GENERATED.map(name => join(root, name))];
  const originals = paths.map(path => existsSync(path) ? readFileSync(path, "utf8") : null);
  const curation = JSON.parse(originals[0]);
  const draft = JSON.parse(originals[1]);
  if (Object.hasOwn(curation.entries, id))
    throw Object.assign(new Error("Already reviewed. Reload to see the latest progress."), { status: 409 });
  const entry = draft.entries[id];
  if (!entry || entry.sourceName !== rawExercise.name)
    throw Object.assign(new Error("Draft missing or stale. Reload the feed."), { status: 409 });
  if (curation.schemaVersion !== 1 || draft.schemaVersion !== 1 ||
      curation.source !== SOURCE || draft.source !== SOURCE || draft.status !== "draft-for-review")
    throw Object.assign(new Error("Catalog metadata changed; review aborted."), { status: 409 });

  const keys = Object.keys(draft.entries);
  const previousDraft = { entry: structuredClone(entry), after: keys[keys.indexOf(id) - 1] ?? null };
  // Never copy a mediaId from a draft. Existing reviewed artwork assignments stay intact.
  delete draft.entries[id];
  curation.entries[id] = { sourceName: rawExercise.name, namePt, aliases };
  try {
    // Remove the draft first. No intermediate state can contain the same UUID twice.
    atomicWrite(paths[1], renderJsonLikeOriginal(originals[1], draft));
    atomicWrite(paths[0], renderJsonLikeOriginal(originals[0], curation));
    rebuild(root);
  } catch (error) {
    // A failed builder must not leave the reviewed mapping, draft, or index half-published.
    try {
      paths.forEach((path, i) => {
        if (originals[i] === null) {
          if (existsSync(path)) unlinkSync(path);
        } else atomicWrite(path, originals[i]);
      });
    } catch (rollbackError) {
      throw new Error("Review failed AND rollback failed: " + rollbackError.message +
        ". Restore the files from Git before proceeding.");
    }
    throw error;
  }
  history.set(id, previousDraft);
  return {
    id, reviewed: Object.keys(curation.entries).length,
    remaining: Object.keys(draft.entries).length
  };
}

// Session-only undo: moves an entry approved by this server process back to the draft.
function undoReview(root, rebuild, body, history) {
  const id = body?.id;
  const previous = typeof id === "string" ? history.get(id) : null;
  if (!previous) throw Object.assign(new Error("Only approvals from this session can be undone."), { status: 409 });
  const paths = [join(root, CURATION), join(root, DRAFT), ...GENERATED.map(name => join(root, name))];
  const originals = paths.map(path => existsSync(path) ? readFileSync(path, "utf8") : null);
  const curation = JSON.parse(originals[0]);
  const draft = JSON.parse(originals[1]);
  if (!Object.hasOwn(curation.entries, id) || Object.hasOwn(draft.entries, id))
    throw Object.assign(new Error("Entry changed outside this session; undo aborted."), { status: 409 });
  delete curation.entries[id];
  // Reinsert at the original position so an approve+undo leaves no diff.
  const entries = Object.entries(draft.entries);
  const at = previous.after === null ? 0 : entries.findIndex(([key]) => key === previous.after) + 1;
  entries.splice(at > 0 || previous.after === null ? at : entries.length, 0, [id, previous.entry]);
  draft.entries = Object.fromEntries(entries);
  try {
    atomicWrite(paths[0], renderJsonLikeOriginal(originals[0], curation));
    atomicWrite(paths[1], renderJsonLikeOriginal(originals[1], draft));
    rebuild(root);
  } catch (error) {
    paths.forEach((path, i) => { if (originals[i] !== null) atomicWrite(path, originals[i]); });
    throw error;
  }
  history.delete(id);
  return { id, reviewed: Object.keys(curation.entries).length, remaining: Object.keys(draft.entries).length };
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

async function requestJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body) > 16384)
      throw Object.assign(new Error("Request is too large."), { status: 413 });
  }
  try { return JSON.parse(body); }
  catch { throw Object.assign(new Error("Invalid JSON body."), { status: 400 }); }
}

export function createReviewServer({ root = DEFAULT_ROOT, rebuild = defaultRebuild } = {}) {
  root = resolve(root);
  let writeQueue = Promise.resolve();
  const history = new Map();
  const server = createServer(async (req, res) => {
    const port = server.address()?.port;
    const hosts = new Set(["127.0.0.1:" + port, "localhost:" + port]);
    if (!hosts.has(req.headers.host)) {
      send(res, 403, { error: "Only loopback requests are accepted." });
      return;
    }
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (req.method === "GET" && (pathname === "/" || pathname === "/tools/review-pt-names.html")) {
        send(res, 200, readFileSync(join(root, "tools/review-pt-names.html"), "utf8"),
          "text/html; charset=utf-8");
      } else if (req.method === "GET" && pathname === "/api/state") {
        send(res, 200, readState(root));
      } else if (req.method === "GET" && pathname.startsWith("/assets/exercises/")) {
        const filename = pathname.slice("/assets/exercises/".length);
        if (!MEDIA.test(filename)) { send(res, 404, { error: "Not found" }); return; }
        const path = join(root, "assets/exercises", filename);
        if (!existsSync(path)) { send(res, 404, { error: "Not found" }); return; }
        send(res, 200, readFileSync(path), "image/webp");
      } else if ((pathname === "/api/review" || pathname === "/api/undo") && req.method !== "POST") {
        send(res, 405, { error: "Method not allowed." });
      } else if (pathname === "/api/review" || pathname === "/api/undo") {
        const acceptedOrigins = new Set(["http://127.0.0.1:" + port, "http://localhost:" + port]);
        if (!acceptedOrigins.has(req.headers.origin)) { send(res, 403, { error: "Local origin required." }); return; }
        if (req.headers["content-type"]?.split(";")[0]?.trim() !== "application/json") {
          send(res, 415, { error: "Expected application/json." }); return;
        }
        const body = await requestJson(req);
        const commit = writeQueue.then(() => pathname === "/api/undo"
          ? undoReview(root, rebuild, body, history) : acceptReview(root, rebuild, body, history));
        writeQueue = commit.catch(() => {});
        send(res, 200, await commit);
      } else send(res, 404, { error: "Not found" });
    } catch (error) {
      send(res, error.status || 500, { error: error.message || "Unexpected review error." });
    }
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.argv[2] === undefined ? 8765 : Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Usage: node tools/review-pt-names-server.mjs [port]");
    process.exit(1);
  }
  const server = createReviewServer();
  server.listen(port, "127.0.0.1", () => {
    console.log("Taurifer Portuguese-name review: http://127.0.0.1:" + port + "/");
    console.log("Local-only. Accept/Edit writes both JSON files and rebuilds exercises.js.");
  });
}
