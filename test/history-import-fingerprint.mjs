#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HistoryImport = createRequire(import.meta.url)("../history-import.js");
const digest = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const header = "date,session_id,title,exercise_name,exercise_id,set,weight_kg,reps,rir,set_type";
const row = (changes = {}) => ({ date: "2024-06-03", session: "s1", title: "Push", exercise: "Barbell bench press",
  exerciseId: "b1", set: "1", load: "80", reps: "8", rir: "2", type: "normal", ...changes });
const line = r => [r.date, r.session, r.title, r.exercise, r.exerciseId, r.set, r.load, r.reps, r.rir, r.type].join(",");
const csv = (...rows) => [header, ...rows.map(line)].join("\n");
const normalized = async text => {
  const parsed = HistoryImport.parseSourceText(text, { source: "generic" });
  assert.equal(parsed.ok, true);
  const result = await HistoryImport.normalizeSourceRecords(parsed);
  assert.equal(result.ok, true);
  return result.sessions[0];
};
const base = await normalized(csv(row()));
const expectedPreimage = JSON.stringify({ date: "2024-06-03", title: "Push", start: "2024-06-03", end: null,
  duration: "", notes: "", rows: [{ name: "Barbell bench press", sourceExerciseId: "b1", supersetId: null,
    sessionTitle: "Push", sessionDurationSeconds: null, sessionDurationRaw: "", sourceSetIndex: 1,
    date: "2024-06-03", created: "2024-06-03", sourceTimestamp: "2024-06-03", sourceEndTimestamp: null,
    loadKg: 80, reps: 8, rir: 2, warmup: false, sourceSetType: "normal", exerciseNote: "", sessionNote: "", issues: [] }],
  skippedRows: [] });
assert.equal(base.sourceSessionFingerprint, digest(expectedPreimage), "source fingerprint hashes the independently declared source fact preimage");
assert.equal(base.sourceSessionKey, digest('["generic-csv","id","s1"]'), "source key hashes the declared source identity");
for (const [label, changes] of Object.entries({ load: { load: "82" }, reps: { reps: "9" }, rir: { rir: "1" },
  warmup: { type: "warmup" }, setType: { type: "dropset" }, exercise: { exercise: "Dumbbell bench press" },
  exerciseId: { exerciseId: "b2" }, date: { date: "2024-06-04" }, session: { session: "s2" } })) {
  const changed = await normalized(csv(row(changes)));
  if (label === "session") {
    assert.notEqual(changed.sourceSessionKey, base.sourceSessionKey, "source session identity changes the source key");
    assert.equal(changed.sourceSessionFingerprint, base.sourceSessionFingerprint,
      "source fingerprint excludes session identity because the source key owns it");
  } else assert.notEqual(changed.sourceSessionFingerprint, base.sourceSessionFingerprint, `${label} changes the source fingerprint`);
}
const startHeader = `${header},start_time`;
const withTime = async time => normalized(`${startHeader}\n${line(row())},${time}`);
assert.notEqual((await withTime("2024-06-03T09:00:00Z")).sourceSessionFingerprint,
  (await withTime("2024-06-03T10:00:00Z")).sourceSessionFingerprint, "source timestamp changes source fingerprint");
const two = csv(row(), row({ set: "2", load: "82" }));
const reversed = csv(row({ set: "2", load: "82" }), row());
assert.equal((await normalized(two)).sourceSessionFingerprint, (await normalized(reversed)).sourceSessionFingerprint,
  "indexed set order is canonical regardless of CSV order");
const unindexed = csv(row({ set: "" }), row({ set: "", load: "82" }));
const unindexedReversed = csv(row({ set: "", load: "82" }), row({ set: "" }));
assert.notEqual((await normalized(unindexed)).sourceSessionFingerprint, (await normalized(unindexedReversed)).sourceSessionFingerprint,
  "unindexed source row order is meaningful");
assert.notEqual((await normalized(two)).sourceSessionFingerprint, base.sourceSessionFingerprint,
  "removing a distinct source row changes source fingerprint");
assert.equal((await normalized(csv(row(), row()))).sourceSessionFingerprint, base.sourceSessionFingerprint,
  "identical keyed duplicate rows are removed before source fingerprinting");
const changedExport = await normalized(csv(row({ load: "82" })));
assert.equal(changedExport.sourceSessionKey, base.sourceSessionKey, "changed export retains the same source key");
assert.notEqual(changedExport.sourceSessionFingerprint, base.sourceSessionFingerprint,
  "changed export under that key has a different source fingerprint");
const exactOptions = { source: "generic", classifyExercise: async () => ({ status: "exact", matchId: "pr_bb", candidateIds: [] }),
  getExercise: async id => ({ id, primary: "Chest", secondary: "Triceps" }) };
const exact = await HistoryImport.prepareHistoryImport(csv(row()), exactOptions);
assert.equal(exact.status, "ready");
const expectedSemantic = JSON.stringify({ date: "2024-06-03", rows: [{ identity: "library:pr_bb", date: "2024-06-03",
  set: 1, load: 80, reps: 8, rir: 2, warmup: false }] });
assert.equal(exact.proposal.sessions[0].semanticFingerprint, digest(expectedSemantic),
  "semantic fingerprint hashes the independently declared performed facts");
const unresolvedOptions = { source: "generic", classifyExercise: async () => ({ status: "unmatched", matchId: null, candidateIds: [] }),
  getExercise: async () => null };
const unresolved = await HistoryImport.prepareHistoryImport(csv(row()), unresolvedOptions);
assert.equal(unresolved.status, "needs-review");
const movementId = unresolved.sessions[0].rows[0].sourceMovementId;
const kept = await HistoryImport.prepareHistoryImport(csv(row()), {
  ...unresolvedOptions, decisions: { [movementId]: { kind: "keep-source" } },
});
assert.equal(kept.status, "ready");
assert.equal(kept.proposal.sessions[0].sourceSessionFingerprint, exact.proposal.sessions[0].sourceSessionFingerprint,
  "later identity reconciliation does not rewrite source fingerprint");
assert.notEqual(kept.proposal.sessions[0].semanticFingerprint, exact.proposal.sessions[0].semanticFingerprint,
  "different performed identity changes semantic fingerprint independently");
const noHashRealm = { TextEncoder };
vm.createContext(noHashRealm);
vm.runInContext(readFileSync(new URL("../history-import.js", import.meta.url), "utf8"), noHashRealm);
const noHashParsed = noHashRealm.RepForgeHistoryImport.parseSourceText(csv(row()), { source: "generic" });
const noHashResult = await noHashRealm.RepForgeHistoryImport.normalizeSourceRecords(noHashParsed);
assert.equal(noHashResult.ok, false, "hash-unavailable cannot produce a normalized candidate");
assert.equal(noHashResult.issues[0].code, "hash-unavailable", "missing WebCrypto has an explicit failure code");
console.log("PASS history source fingerprint preimage and semantic boundaries");
