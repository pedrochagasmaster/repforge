// Generates test/fixtures/install-transfer-clone-v1.json through the real
// runtime normalization path (normalizeLoaded), then verifies the
// round-trip: normalizeLoaded(fixture.durableState) deep-equals
// fixture.durableState (storage metadata excluded).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require2 = createRequire(import.meta.url);

// Minimal browser shell so app.js evaluates without a DOM.
globalThis.window = {
  RepForgeI18n: { t: (k) => k, detectLang: () => "en", setLang() {}, normalizeLang: (v) => (v === 'pt' ? 'pt' : 'en'), },
  RepForgeProgression: null,
  RepForgeProgramEntry: null,
  RepForgeSharedSetup: null,
  RepForgeSchedule: null,
  RepForgeNotify: null,
  RepForgeProgramEntryAdapter: { DAY_MERGE_VOCABULARY: { primary: "primary", secondary: "secondary", none: "none" } },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
};
globalThis.document = {
  querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
  addEventListener() {}, hidden: false,
  documentElement: { setAttribute() {}, style: {} },
  body: { classList: { add() {}, remove() {}, contains: () => false } },
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} }, addEventListener() {} }),
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
Object.defineProperty(globalThis, "navigator", { value: { language: "en", onLine: true }, configurable: true, writable: true });
globalThis.location = { href: "http://localhost:8000/", pathname: "/", search: "", hash: "" };
globalThis.indexedDB = { open: () => ({ set onupdate(v) {}, set onsuccess(v) {}, set onerror(v) {}, set onupgradeneeded(v) {} }) };
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.CustomEvent = class CustomEvent {};
globalThis.fetch = async () => ({ ok: false });
globalThis.caches = { open: async () => ({ match: async () => undefined }) };

// Load the library and compiler first (app.js expects them on window).
const exercisesSrc = readFileSync(join(ROOT, "exercises.js"), "utf8");
new Function(exercisesSrc).call(globalThis);
const Compiler = require2(join(ROOT, "program-compiler.js"));
globalThis.window.RepForgeProgramCompiler = Compiler;
globalThis.ProgramCompiler = Compiler;
// withExplicitProgramStructure reads the bare global first, then window.

// Compile a REAL growth_3_v1 program through the actual compiler, then let
// the app normalize it — no hand-built state anywhere.
const context = {
  schemaVersion: 1, familyId: "growth", frequency: 3, sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
};
const EXERCISE_LIBRARY = require2(join(ROOT, "exercises.js")).EXERCISE_LIBRARY;
const compiled = Compiler.compile(context, EXERCISE_LIBRARY);
if (compiled.kind !== "compiled") throw new Error("compiler returned " + compiled.kind);

const appSrc = readFileSync(join(ROOT, "app.js"), "utf8");
const api = new Function(appSrc + "\n;return { Program: typeof Program !== 'undefined' ? Program : null, normalizeLoaded: typeof normalizeLoaded !== 'undefined' ? normalizeLoaded : null, uid: typeof uid === 'function' ? uid : null, buildProgramMeta: typeof buildProgramMeta === 'function' ? buildProgramMeta : null, normalizeLoadedLen: 1 };").call(globalThis);
const { Program, normalizeLoaded, uid, buildProgramMeta } = api;

// Turn compiler output into raw rows the app loader accepts (as backup import does).
const rawProgram = [];
let order = 0;
const labels = {};
for (const day of compiled.days) {
  for (const slot of day.slots) {
    const row = {
      id: "ex_" + slot.slotId.replace(/[^a-z0-9]/gi, "_"),
      day: day.label, order: order++,
      name: slot.exercise.name, sets: slot.prescription.sets,
      min: slot.prescription.repMin, max: slot.prescription.repMax,
      primary: slot.exercise.primary, secondary: slot.exercise.secondary,
      notes: "", alternates: [],
      slotId: slot.slotId, dayId: day.dayId,
      libraryId: slot.exercise.id, movementId: "library:" + slot.exercise.id,
      progressionType: `${slot.prescription.progression.strategy.id}@${slot.prescription.progression.strategy.version}`,
      targetRirStart: slot.prescription.targetRirMin, targetRirEnd: slot.prescription.targetRirMax,
      minSets: slot.prescription.sets[0] ?? 2, maxSets: slot.prescription.sets[1] ?? 4,
      jumpAmount: slot.prescription.progression.params?.jumpAmount ?? null,
      compilerProvenance: slot.provenance ?? null,
    };
    if (row.jumpAmount == null) delete row.jumpAmount;
    if (row.compilerProvenance == null) delete row.compilerProvenance;
    rawProgram.push(row);
  }
  labels[day.dayId] = day.label;
}
const logRow = {
  session: "2026-09-08_Day 1_seed01", date: "2026-09-08", day: "Day 1",
  name: rawProgram[0].name, exerciseId: rawProgram[0].id, set: 1,
  load: 120, reps: 10, rir: 2, notes: "", created: "2026-09-08T18:00:00.000Z",
  primary: rawProgram[0].primary, secondary: rawProgram[0].secondary,
  performedName: rawProgram[0].name, performedPrimary: rawProgram[0].primary,
  performedSecondary: rawProgram[0].secondary, performedLibraryId: rawProgram[0].libraryId,
};
const customExercise = {
  id: "custom:c01", name: "Landmine press", namePt: "Desenvolvimento landmine",
  archived: false, equipment: ["barbell"], primary: "Chest", secondary: "Triceps",
  notes: "Stubborn shoulder", patterns: [], beginnerFriendly: true, custom: true,
  created: "2026-09-10T08:00:00.000Z",
};

// The raw input state (pre-normalization).
// Seed programStructure the way the production activation path does (the
// compiler result is persisted with the program), so post-normalization
// provenance is the real compiler provenance, not legacy_migration.
const structureSeed = Compiler.migrateLegacyStructure(rawProgram, {
  schemaVersion: 1,
  days: compiled.days.map((day) => ({ dayId: day.dayId, label: day.label })),
  provenance: compiled.provenance,
});
const rawState = {
  settings: { unit: "kg", lang: "en", restSec: 120, rirMode: "numeric" },
  programMeta: {
    id: "pm_seed01", name: "Build Muscle", started: "2026-09-07",
    created: "2026-09-07T08:00:00.000Z", updated: "2026-09-28T08:00:00.000Z",
    goal: "muscle_growth", experience: "6_to_24m", daysPerWeek: 3,
    splitType: null, equipment: ["commercial_gym"], priorityMuscles: [],
    sessionLength: 60, mesocycleLengthWeeks: 6, mesocycleStatus: "active",
    completedAt: null, onboarded: true,
    progressionRelations: [], progressionModifiers: [],
    progressionIncompatibilities: [], programStructure: structureSeed.structure, entrySource: null,
  },
  program: rawProgram,
  log: [logRow],
  programHistory: [],
  customExercises: [customExercise],
};

// Normalize through the REAL loader.
const normalized = normalizeLoaded(rawState);

// The clone's durable section is the normalized snapshot. Round-trip check.
const reread = normalizeLoaded(normalized);
const stripMeta = (s) => {
  const c = JSON.parse(JSON.stringify(s));
  delete c._storageRevision; delete c._storageFollowUp;
  delete c._storageDraftTransaction; delete c._storageSetupActivation;
  return c;
};
const a = JSON.stringify(stripMeta(normalized));
const b = JSON.stringify(stripMeta(reread));
if (a !== b) throw new Error("round-trip mismatch");

// Plan 049 proof checkpoint: prove the save/serialization/load path, not just
// normalizeLoaded. Serialize the normalized state exactly as the app persists
// it (storageIO.writeLocal does JSON.stringify), reload through
// normalizeLoaded, and require equality again — the storage boundary is part
// of the contract.
const serialized = JSON.stringify(normalized);
const reloaded = normalizeLoaded(JSON.parse(serialized));
const c = JSON.stringify(stripMeta(reloaded));
if (a !== c) throw new Error("save/load round-trip mismatch");

const envelope = {
  kind: "taurifer-install-transfer",
  schemaVersion: 1,
  createdAt: "2026-10-01T09:00:00.000Z",
  source: { context: "browser", logicalInstallationId: "li_7f3a" },
  sourceRevision: 42,
  durableState: stripMeta(normalized),
  workoutDraft: null,
  programEntryDraft: null,
  uiPreferences: { theme: "system" },
  analytics: { enabled: true },
  telemetryIdentity: { schemaVersion: 1, installationId: "ti_9c2e", createdAt: "2026-08-01T10:00:00.000Z" },
  integrity: { canonicalPayloadHash: "PENDING" },
};
// Compute the canonical digest through the shared helper, then write the
// fixture with the digest filled in — one source of truth.
const { canonicalJson } = await import(join(ROOT, "tools", "canonical-hash-core.mjs"));
const preimage = JSON.parse(JSON.stringify(envelope));
delete preimage.integrity.canonicalPayloadHash;
const { createHash } = await import("node:crypto");
const digest = createHash("sha256").update(canonicalJson(preimage), "utf8").digest("hex");
envelope.integrity.canonicalPayloadHash = digest;
writeFileSync(join(ROOT, "test/fixtures/install-transfer-clone-v1.json"), JSON.stringify(envelope, null, 2) + "\n");
console.log(`fixture regenerated through real normalization; program rows: ${envelope.durableState.program.length}; digest ${digest.slice(0, 12)}…`);
