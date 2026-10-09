import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import { createReviewServer } from "../tools/review-pt-names-server.mjs";

const A = "1a25c6f170d8803d8231d083fdd65458";
const B = "19f5c6f170d8808bb424e98de4472a7e";
const SOURCE = "plans/067/data/app_file.json";
const read = path => JSON.parse(readFileSync(path, "utf8"));
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

async function fixture({ rebuildFailure = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "taurifer-pt-review-"));
  for (const dir of ["tools", "plans/067/data", "assets/exercises"]) mkdirSync(join(root, dir), { recursive: true });
  const curationPath = join(root, "tools/exercise-catalog-curation.json");
  const draftPath = join(root, "tools/exercise-names-pt-draft.json");
  write(join(root, SOURCE), {
    exercises: [
      { id: A, name: "Barbell back squat", resistanceEquipmentGroupIds: ["group1"], supportEquipmentGroupIds: [],
        primaryMuscle: ["muscle1"], secondaryMuscle: ["muscle2"] },
      { id: B, name: "Barbell bench press", resistanceEquipmentGroupIds: ["group1"], supportEquipmentGroupIds: [],
        primaryMuscle: ["muscle3"], secondaryMuscle: [] }
    ],
    uuidIndex: {
      group1: { type: "resistanceEquipmentGroup", name: "Barbell group", equipment: ["equipment1"] },
      equipment1: { type: "equipment", name: "Barbell" },
      muscle1: { type: "muscle", name: "Quadriceps" },
      muscle2: { type: "muscle", name: "Glutes" },
      muscle3: { type: "muscle", name: "Pectorals" }
    }
  });
  write(curationPath, { schemaVersion: 1, source: SOURCE,
    entries: { [B]: { sourceName: "Barbell bench press", namePt: "Supino reto com barra",
      aliases: ["Supino"], mediaId: "pr_bb" } } });
  write(draftPath, { schemaVersion: 1, source: SOURCE, status: "draft-for-review",
    entries: { [A]: { sourceName: "Barbell back squat", namePt: "Agachamento com barra", aliases: ["Agachamento livre"] } } });
  writeFileSync(join(root, "exercises.js"), "BEFORE\n");
  writeFileSync(join(root, "assets/exercise-catalog.json"), "BEFORE ASSET\n");
  let calls = 0;
  const server = createReviewServer({
    root,
    rebuild: () => {
      calls++;
      writeFileSync(join(root, "exercises.js"), "BUILT\n");
      if (rebuildFailure) throw new Error("simulated builder failure");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const origin = "http://127.0.0.1:" + port;
  const get = async () => fetch(origin + "/api/state").then(async r => [r.status, await r.json()]);
  const review = async value => fetch(origin + "/api/review", {
    method: "POST", headers: { "content-type": "application/json", origin },
    body: JSON.stringify(value)
  }).then(async r => [r.status, await r.json()]);
  return { root, origin, get, review, curationPath, draftPath, calls: () => calls,
    close: async () => { server.close(); await once(server, "close"); rmSync(root, { recursive: true, force: true }); } };
}

test("feed lists only drafts and resolves equipment/muscles from UUID references", async t => {
  const f = await fixture();
  t.after(f.close);
  const [status, state] = await f.get();
  assert.equal(status, 200);
  assert.equal(state.total, 2);
  assert.equal(state.reviewed, 1);
  assert.equal(state.remaining, 1);
  assert.deepEqual(state.pending.map(x => x.id), [A]);
  assert.deepEqual(state.pending[0].equipment, ["Barbell"]);
  assert.deepEqual(state.pending[0].muscles, ["Quadriceps", "Glutes"]);
  assert.equal(state.pending[0].draftName, "Agachamento com barra");
  assert.deepEqual(state.pending[0].aliases, ["Agachamento livre"]);
  assert.equal(state.pending[0].media, null);
});

test("edited approval moves exactly one UUID, regenerates, and rejects a second approval", async t => {
  const f = await fixture();
  t.after(f.close);
  const [status, result] = await f.review({
    id: A, namePt: "Agachamento livre com barra", aliases: ["Agachamento livre", "Agachamento"] });
  assert.equal(status, 200, JSON.stringify(result));
  assert.equal(result.remaining, 0);
  assert.equal(result.reviewed, 2);
  assert.equal(f.calls(), 1);
  const curated = read(f.curationPath).entries;
  assert.deepEqual(curated[A], {
    sourceName: "Barbell back squat", namePt: "Agachamento livre com barra",
    aliases: ["Agachamento livre", "Agachamento"] });
  assert.equal(curated[B].mediaId, "pr_bb", "existing reviewed media is preserved");
  assert.equal(Object.hasOwn(read(f.draftPath).entries, A), false);
  assert.equal(readFileSync(join(f.root, "exercises.js"), "utf8"), "BUILT\n");
  const [again] = await f.review({ id: A, namePt: "Wrong", aliases: [] });
  assert.equal(again, 409);
});

test("invalid and duplicate aliases cannot alter either catalog", async t => {
  const f = await fixture();
  t.after(f.close);
  const beforeCuration = readFileSync(f.curationPath, "utf8");
  const beforeDraft = readFileSync(f.draftPath, "utf8");
  for (const bad of [
    { id: A, namePt: "", aliases: [] },
    { id: A, namePt: "Valid", aliases: ["abc", " ABC "] },
    { id: A, namePt: "Valid", aliases: [""] },
    { id: A, namePt: "Valid", aliases: "incorrect" },
    { id: "not-a-uuid", namePt: "Valid", aliases: [] }
  ]) {
    const [status] = await f.review(bad);
    assert.ok(status >= 400);
  }
  assert.equal(readFileSync(f.curationPath, "utf8"), beforeCuration);
  assert.equal(readFileSync(f.draftPath, "utf8"), beforeDraft);
  assert.equal(f.calls(), 0);
});

test("builder failure restores BOTH inputs and generated output, with no phantom review", async t => {
  const f = await fixture({ rebuildFailure: true });
  t.after(f.close);
  const beforeCuration = readFileSync(f.curationPath, "utf8");
  const beforeDraft = readFileSync(f.draftPath, "utf8");
  const [status] = await f.review({ id: A, namePt: "Agachamento", aliases: [] });
  assert.equal(status, 500);
  assert.equal(readFileSync(f.curationPath, "utf8"), beforeCuration);
  assert.equal(readFileSync(f.draftPath, "utf8"), beforeDraft);
  assert.equal(readFileSync(join(f.root, "exercises.js"), "utf8"), "BEFORE\n");
  assert.equal(readFileSync(join(f.root, "assets/exercise-catalog.json"), "utf8"), "BEFORE ASSET\n");
  const [, state] = await f.get();
  assert.equal(state.remaining, 1);
});

test("local write endpoint refuses nonlocal origins and unsupported methods", async t => {
  const f = await fixture();
  t.after(f.close);
  const foreign = await fetch(f.origin + "/api/review", {
    method: "POST",
    headers: { origin: "https://malicious.example", "content-type": "application/json" },
    body: JSON.stringify({ id: A, namePt: "Bad", aliases: [] })
  });
  assert.equal(foreign.status, 403);
  const other = await fetch(f.origin + "/api/review", { method: "GET" });
  assert.equal(other.status, 405);
  assert.equal(f.calls(), 0);
});
