// Generates test/fixtures/install-transfer-clone-v1.json through the real
// generator, loader, and storage writer/reader boundary. The durable-state
// section is a Plan 067 generated program; transfer consumers prove the rest.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require2 = createRequire(import.meta.url);

// Minimal browser shell so app.js evaluates without a DOM.
globalThis.window = {
  RepForgeI18n: { t: (k) => k, detectLang: () => "en", setLang() {}, normalizeLang: (v) => (v === 'pt' ? 'pt' : 'en'), },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
};
globalThis.document = {
  querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
  addEventListener() {}, hidden: false,
  documentElement: { setAttribute() {}, style: {}, dataset: {} },
  head: { append() {}, appendChild() {} },
  body: { classList: { add() {}, remove() {}, contains: () => false } },
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} }, addEventListener() {} }),
};
class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
}
const localStorage = new MemoryStorage();
const idbValues = new Map();
const idbClone = (value) => JSON.parse(JSON.stringify(value));
globalThis.localStorage = localStorage;
globalThis.sessionStorage = globalThis.localStorage;
Object.defineProperty(globalThis, "navigator", { value: { language: "en", onLine: true }, configurable: true, writable: true });
globalThis.location = { href: "http://localhost:8000/", pathname: "/", search: "", hash: "" };
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true },
        createObjectStore() {},
        close() {},
        transaction() {
          const tx = {
            oncomplete: null,
            onerror: null,
            objectStore() {
              return {
                get(key) {
                  const result = { result: undefined, onsuccess: null, onerror: null };
                  queueMicrotask(() => {
                    result.result = idbValues.has(key) ? idbClone(idbValues.get(key)) : undefined;
                    result.onsuccess?.();
                  });
                  return result;
                },
                put(value, key) {
                  idbValues.set(key, idbClone(value));
                  queueMicrotask(() => tx.oncomplete?.());
                },
                delete(key) {
                  idbValues.delete(key);
                  queueMicrotask(() => tx.oncomplete?.());
                },
              };
            },
          };
          return tx;
        },
      };
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  },
};
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.CustomEvent = class CustomEvent {};
// The only fetch app boot needs here is the local catalog asset, served as-is.
const CATALOG_BYTES = readFileSync(join(ROOT, "assets/exercise-catalog.json"), "utf8");
globalThis.fetch = async (url) => String(url).includes("assets/exercise-catalog.json")
  ? { ok: true, status: 200, text: async () => CATALOG_BYTES } : { ok: false, status: 404 };
globalThis.caches = { open: async () => ({ match: async () => undefined }) };

// Load every runtime script index.html declares before app.js, in order, as
// the page does, and mirror their globals onto the shell window app.js reads.
// Vendored motion/drag runtimes are optional and skipped.
const scripts = [...readFileSync(join(ROOT, "index.html"), "utf8").matchAll(/<script[^>]*src="([^"?]+)/g)]
  .map((match) => match[1]).filter((file) => file.endsWith(".js") && file !== "app.js" && !file.startsWith("vendor/"));
for (const file of scripts) {
  try { new Function("module", "exports", readFileSync(join(ROOT, file), "utf8")).call(globalThis, undefined, undefined); }
  catch (error) { if (!["posthog-config.js", "posthog-init.js"].includes(file)) throw error; }
  // Modules attach to window or globalThis; the page has one object for both.
  for (const [from, to] of [[globalThis, globalThis.window], [globalThis.window, globalThis]])
    for (const key of Object.keys(from)) if (/^RepForge|^Taurifer|^EXERCISE_/.test(key) && !(key in to)) to[key] = from[key];
}
const Compiler = globalThis.window.RepForgeProgramCompiler;
globalThis.ProgramCompiler = Compiler;
const Adapter = globalThis.window.RepForgeProgramEntryAdapter;
await globalThis.window.RepForgeExerciseCatalog.load();
const catalogSnapshot = globalThis.window.RepForgeExerciseCatalog.snapshot();

// Generate a REAL program through the canonical generator from Generate's own
// answer mapping, then let the app project and normalize it.
const mapped = Adapter.programRequestFromAnswers({
  desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 2, sessionMinutes: 40,
  environment: { kind: "limited_home" },
}, catalogSnapshot);
if (!mapped.ok) throw new Error("request mapping failed");
// One cycle keeps the documented example small; the contract is per cycle.
mapped.value.cycles = 1;
const generated = Compiler.generateProgram(mapped.value, catalogSnapshot, "clone-fixture-v1");
if (!generated.ok) throw new Error("generator returned conflicts");
const programDefinition = generated.value;

const appSrc = readFileSync(join(ROOT, "app.js"), "utf8");
// The production file invokes boot() as its final expression. Omit only that
// auto-start while loading the same runtime functions so this fixture can
// drive the persistence boundary without a concurrent application boot write.
// The catalog is installed the way a successful load() would install it.
const appRuntimeSrc = appSrc.replace(/\nboot\(\);\s*$/, "\n") + "\n;rawExerciseCatalog=globalThis.__cloneFixtureCatalog;";
globalThis.__cloneFixtureCatalog = catalogSnapshot;
const api = new Function(appRuntimeSrc + "\n;return { Program: typeof Program !== 'undefined' ? Program : null, normalizeLoaded: typeof normalizeLoaded !== 'undefined' ? normalizeLoaded : null, uid: typeof uid === 'function' ? uid : null, buildProgramMeta: typeof buildProgramMeta === 'function' ? buildProgramMeta : null, storageIO: typeof storageIO !== 'undefined' ? storageIO : null, readLocalStatus: typeof readLocalStatus === 'function' ? readLocalStatus : null, readIdbStatus: typeof readIdbStatus === 'function' ? readIdbStatus : null, chooseSnapshot: typeof chooseSnapshot === 'function' ? chooseSnapshot : null, durableProgramRows: typeof durableProgramRows === 'function' ? durableProgramRows : null }; ").call(globalThis);
const { normalizeLoaded, storageIO, readLocalStatus, readIdbStatus, chooseSnapshot, durableProgramRows } = api;

const programMeta = {
  id: "pm_seed01", name: "Build Muscle", started: "2026-09-07",
  created: "2026-09-07T08:00:00.000Z", updated: "2026-09-28T08:00:00.000Z",
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 2,
  splitType: null, equipment: [], priorityMuscles: [],
  sessionLength: 40, mesocycleLengthWeeks: programDefinition.cycles, mesocycleStatus: "active",
  completedAt: null, onboarded: true,
  progressionRelations: [], progressionModifiers: [],
  progressionIncompatibilities: [], programStructure: null, entrySource: null,
  programDefinition,
};
const rawProgram = durableProgramRows(programDefinition, [], programMeta);
// One completed set of the first slot, compiled to a History row by the real
// DraftV2 aggregate, so the fixture's log carries the current metric schema.
const WorkoutDraft = globalThis.window.RepForgeWorkoutDraft;
const firstDay = programDefinition.days.find((day) => day.kind === "training");
const firstSlot = firstDay.slots[0];
const firstRow = rawProgram[0];
const slotSets = firstSlot.prescriptionsByCycle[0].sets;
const loadingConvention = "external";
let seedDraft = WorkoutDraft.create({
  programId: programMeta.id, programFingerprint: "clone-fixture", durableRevision: 1,
  dayId: firstDay.id, dayLabel: firstDay.name, scheduleDate: "2026-09-08", unit: "kg", rirMode: "numeric",
  exercises: [{
    exerciseInstanceId: firstRow.id, sourceExerciseId: firstSlot.id, libraryId: firstSlot.exerciseId,
    displayName: firstRow.name, sets: slotSets.length, setIds: slotSets.map((_, index) => `set-${index + 1}`),
    minReps: firstRow.min, maxReps: firstRow.max, targetRir: 1, notes: "",
    primary: firstRow.primary, secondary: firstRow.secondary, sourceFingerprint: "clone-fixture-slot",
    metricOrigin: "source_catalog", metricDefinitions: firstSlot.metricDefinitions,
    loadingModel: firstSlot.loadingModel, loadingConvention,
    loadingContext: { loadingConvention, bodyweightKg: null, bodyweightContributionEnabled: null,
      externalLoadMultiplier: 1, bodyweightCoefficient: firstSlot.loadingModel.bodyweightCoefficient },
    programmedSets: slotSets.map((set) => ({ targetRir: set.rir, metricDefinitions: firstSlot.metricDefinitions,
      targets: set.targets, restSeconds: set.restSeconds })),
  }],
}, {
  draftId: "2026-09-08_Day 1_seed01", startedAt: "2026-09-08T17:30:00.000Z", selectedExerciseId: firstRow.id,
  writer: { installationId: "clone-fixture", tabId: "clone-fixture", operationId: "seed-create" },
  updatedAt: "2026-09-08T17:30:00.000Z", scheduleDate: "2026-09-08", bodyweight: "", notes: "",
}, {});
if (WorkoutDraft.isDomainError(seedDraft)) throw new Error(`seed draft rejected: ${JSON.stringify(seedDraft)}`);
let seedOperation = 0;
const seedApply = (type, values) => {
  const next = WorkoutDraft.reduce(seedDraft, { ...values, type, operationId: `seed-${++seedOperation}`,
    expectedRevision: seedDraft.revision, updatedAt: "2026-09-08T18:00:00.000Z",
    writer: { installationId: "clone-fixture", tabId: "clone-fixture", operationId: `seed-${seedOperation}` } });
  if (WorkoutDraft.isDomainError(next)) throw new Error(`${type} rejected: ${JSON.stringify(next)}`);
  seedDraft = next;
};
for (const metric of firstSlot.metricDefinitions)
  seedApply("editMetricValue", { exerciseInstanceId: firstRow.id, setId: "set-1", metricId: metric.id,
    value: metric.semantic === "reps" ? "10" : "120" });
seedApply("editSetField", { exerciseInstanceId: firstRow.id, setId: "set-1", field: "rir", value: "2" });
seedApply("completeSet", { exerciseInstanceId: firstRow.id, setId: "set-1", completedAt: "2026-09-08T18:00:00.000Z" });
seedApply("beginFinish", {});
const [logRow] = WorkoutDraft.toHistoryRows(seedDraft, "2026-09-08T18:00:00.000Z");
if (!logRow?.metricValues) throw new Error("seed history row has no metric values");
const customExercise = {
  id: "custom:c01", name: "Landmine press", namePt: "Desenvolvimento landmine",
  archived: false, equipment: ["barbell"], primary: "Chest", secondary: "Triceps",
  notes: "Stubborn shoulder", patterns: [], beginnerFriendly: true, custom: true,
  created: "2026-09-10T08:00:00.000Z",
};

// The raw input state (pre-normalization).
const rawState = {
  settings: { unit: "kg", lang: "en", restSec: 120, rirMode: "numeric" },
  programMeta,
  program: rawProgram,
  log: [logRow],
  programHistory: [],
  customExercises: [customExercise],
};

// Normalize through the REAL loader.
const normalized = normalizeLoaded(rawState);

// The clone's durable section is the normalized snapshot. First prove loader
// idempotence, then cross the actual storage writer and reader boundary.
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

// Plan 049 proof checkpoint: use the production storageIO writer and the
// production localStorage/IndexedDB readers. A JSON clone alone does not
// prove that either storage boundary wrote or selected the same snapshot.
if (!storageIO || !readLocalStatus || !readIdbStatus || !chooseSnapshot) {
  throw new Error("production persistence API is unavailable");
}
const writeResult = await storageIO.writeLocal(normalized);
if (writeResult !== true) throw new Error("unexpected local writer result");
await storageIO.writeIdb(normalized);
const localRead = readLocalStatus();
const idbRead = await readIdbStatus();
if (localRead.status !== "valid" || idbRead.status !== "valid") {
  throw new Error(`storage boundary did not produce valid mirrors: local=${localRead.status} idb=${idbRead.status}`);
}
const chosen = chooseSnapshot(localRead, idbRead);
if (chosen.kind !== "chosen") throw new Error(`storage boundary did not choose a mirror: ${chosen.kind}`);
const reloaded = normalizeLoaded(chosen.snapshot);
const c = JSON.stringify(stripMeta(reloaded));
if (a !== c) throw new Error("storage writer/reader round-trip mismatch");
const localLogical = JSON.stringify(stripMeta(localRead.parsed));
const idbLogical = JSON.stringify(stripMeta(idbRead.parsed));
if (localLogical !== a || idbLogical !== a) throw new Error("storage mirror logical allowlist mismatch");

// The real telemetry consumer accepts and returns only UUID-v4 identities.
// Seed its storage with the identity that the transfer fixture carries, then
// prove boot preserves the same identity rather than replacing it.
const telemetryIdentity = {
  schemaVersion: 1,
  installationId: "3e1f5c8a-9d02-4b77-8a31-6e4d2c9f0ab5",
  createdAt: "2026-08-01T10:00:00.000Z",
};
localStorage.setItem("repforge_telemetry_identity_v1", JSON.stringify(telemetryIdentity));
const Telemetry = require2(join(ROOT, "telemetry.js"));
const telemetryBoot = Telemetry.boot({ storage: localStorage, crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" } });
if (telemetryBoot.installationId !== telemetryIdentity.installationId) {
  throw new Error("telemetry consumer rejected or replaced the transfer identity");
}
const invalidTelemetryStorage = new MemoryStorage();
invalidTelemetryStorage.setItem("repforge_telemetry_identity_v1", JSON.stringify({
  schemaVersion: 1,
  installationId: "ti_9c2e",
  createdAt: "2026-08-01T10:00:00.000Z",
}));
const invalidTelemetryBoot = Telemetry.boot({
  storage: invalidTelemetryStorage,
  crypto: { randomUUID: () => "22222222-2222-4222-8222-222222222222" },
});
if (invalidTelemetryBoot.installationId !== "22222222-2222-4222-8222-222222222222") {
  throw new Error("telemetry consumer accepted the invalid legacy identity");
}

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
  telemetryIdentity,
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
