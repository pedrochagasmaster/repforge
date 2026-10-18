#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import historicalDrafts from "./fixtures/program-entry-draft-plan070.json" with { type: "json" };

// Plan 072 S1: the answers onboarding B adds before any of its screens exist.
// These are isolated proofs because each contract is combinatorial or a
// byte-identity boundary the browser journey cannot enumerate: preset and
// equipment-group set algebra over catalog UUIDs, the request every legacy
// answer set produced before this change, the answer schema a stored setup
// draft must still satisfy, and the compiler's confirmation-offer ranking.
// The browser journeys that drive these inputs land with S2-S4.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Entry = require(path.join(root, "src/training/authoring.js")).createEntryRules(require(path.join(root,"assets/exercise-catalog.json")));
const generation = require(path.join(root, "src/training/generation.js")).createGenerationRules();
const Compiler = generation.compiler;
const Adapter = require(path.join(root, "src/training/authoring.js")).createEntryAdapter({compiler:Compiler});
const Catalog = require(path.join(root, "assets/exercise-catalog.json"));
generation.identity.prepareCatalog(Catalog);
const fixturePath = path.join(root, "test/fixtures/program-entry-request-baseline.json");
const index = Catalog.uuidIndex;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function legacyAnswerCorpus() {
  const cases = [];
  for (const kind of ["commercial_gym", "basic_gym", "limited_home", "full_home", "other"]) {
    for (const desiredResult of ["muscle_growth", "balanced", "strength"]) {
      for (const daysPerWeek of [2, 4, 6]) {
        for (const structuredExperience of ["first", "under_6m", "6_to_24m", "over_24m"]) {
          for (const sessionMinutes of [20, 60, 150]) {
            const answers = { desiredResult, structuredExperience, daysPerWeek, sessionMinutes, environment: { kind } };
            if (daysPerWeek === 4 && sessionMinutes === 60) {
              answers.primaryMuscles = ["back", "glutes"];
              answers.deEmphasizedMuscles = ["calves"];
              answers.competencyAnswers = { benchPress10: true, pullups5: false, overheadPress10: null };
            }
            cases.push({ key: `${kind}|${desiredResult}|${daysPerWeek}|${structuredExperience}|${sessionMinutes}`, answers });
          }
        }
      }
    }
  }
  return cases;
}

function requestDigests() {
  const digests = {};
  for (const { key, answers } of legacyAnswerCorpus()) {
    const mapped = Adapter.programRequestFromAnswers(answers, Catalog);
    assert.equal(mapped.ok, true, `${key}: ${JSON.stringify(mapped.conflicts)}`);
    digests[key] = crypto.createHash("sha256").update(stable(mapped.value)).digest("hex").slice(0, 16);
  }
  return digests;
}

if (process.argv.includes("--update")) {
  const digests = requestDigests();
  fs.writeFileSync(fixturePath, `${JSON.stringify({ recordedFrom: process.argv[process.argv.indexOf("--update") + 1] || "", digests }, null, 2)}\n`);
  console.log(`wrote ${Object.keys(digests).length} request digests`);
  process.exit(0);
}

const equipmentIds = (flag) => Object.keys(index)
  .filter((id) => index[id]?.type === "equipment" && (!flag || index[id][flag] === 1)).sort();
const PRESETS = {
  everything: null, commercial_gym: "commercialGym", warehouse_gym: "warehouseGym",
  basic_gym: "localGym", full_home: "garageGym", limited_home: "homeGym",
};
const BASE = { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60 };
const requestFor = (answers) => {
  const mapped = Adapter.programRequestFromAnswers({ ...BASE, ...answers }, Catalog);
  assert.equal(mapped.ok, true, JSON.stringify(mapped.conflicts));
  return mapped.value;
};

test("every legacy answer set still produces the request it produced before Plan 072", () => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const digests = requestDigests();
  assert.deepEqual(Object.keys(digests), Object.keys(fixture.digests), "the corpus enumerates the recorded cases");
  for (const [key, digest] of Object.entries(fixture.digests)) assert.equal(digests[key], digest, `${key} is byte-identical`);
});

test("the six presets map to all equipment or to their catalog flag", () => {
  for (const [kind, flag] of Object.entries(PRESETS)) {
    assert.deepEqual(requestFor({ environment: { kind } }).gymProfile.equipmentIds, equipmentIds(flag), kind);
  }
  assert.deepEqual(requestFor({ environment: { kind: "other" } }).gymProfile.equipmentIds, equipmentIds("localGym"),
    "a stored Other keeps the Local gym equipment");
});

test("the thirteen equipment groups are disjoint sets of catalog equipment UUIDs", () => {
  const groups = Adapter.EQUIPMENT_GROUPS;
  assert.deepEqual(Object.keys(groups), [...Entry.EQUIPMENT_GROUPS]);
  assert.equal(Object.keys(groups).length, 13);
  const seen = new Map();
  for (const [token, members] of Object.entries(groups)) {
    assert.ok(members.length > 0, `${token} has members`);
    for (const id of members) {
      assert.equal(index[id]?.type, "equipment", `${token}: ${id} is catalog equipment`);
      assert.ok(!seen.has(id), `${id} belongs to ${seen.get(id)} and ${token}`);
      seen.set(id, token);
      const singular = index[id].pluralOf;
      if (singular && index[singular]?.type === "equipment") {
        assert.ok(members.includes(singular), `${token} lists the singular of ${index[id].name}`);
      }
    }
  }
});

test("equipment adjustment is the preset plus added groups minus removed groups", () => {
  const groups = Adapter.EQUIPMENT_GROUPS;
  for (const [kind, flag] of Object.entries(PRESETS)) {
    const preset = equipmentIds(flag);
    assert.deepEqual(requestFor({ environment: { kind, adjust: { add: [], remove: [] } } }).gymProfile.equipmentIds, preset,
      `${kind}: an empty adjustment is the preset`);
    for (const [token, members] of Object.entries(groups)) {
      const added = requestFor({ environment: { kind, adjust: { add: [token], remove: [] } } }).gymProfile.equipmentIds;
      assert.deepEqual(added, [...new Set([...preset, ...members])].sort(), `${kind} + ${token}`);
      const removed = requestFor({ environment: { kind, adjust: { add: [], remove: [token] } } }).gymProfile.equipmentIds;
      assert.deepEqual(removed, preset.filter((id) => !members.includes(id)), `${kind} - ${token}`);
    }
  }
  const both = requestFor({ environment: { kind: "limited_home", adjust: { add: ["bench", "barbell"], remove: ["bands"] } } });
  const expected = new Set([...equipmentIds("homeGym"), ...groups.bench, ...groups.barbell]);
  for (const id of groups.bands) expected.delete(id);
  assert.deepEqual(both.gymProfile.equipmentIds, [...expected].sort());
});

test("seven regular weeks and optional extra deload map to total cycles", () => {
  const untouched = requestFor({ environment: { kind: "commercial_gym" } });
  assert.deepEqual([untouched.cycles, untouched.periodization, untouched.deloadCycles], [7, "static", []]);
  const block = requestFor({ environment: { kind: "commercial_gym" }, block: { cycles: 7, periodization: "undulating" }, deload: true });
  assert.deepEqual([block.cycles, block.periodization, block.deloadCycles], [8, "undulating", [8]]);
  const off = requestFor({ environment: { kind: "commercial_gym" }, block: { cycles: 7, periodization: "linear" }, deload: false });
  assert.deepEqual([off.cycles, off.periodization, off.deloadCycles], [7, "linear", []]);
  for (const cycles of [4, 10]) {
    const answers = { desiredResult: "balanced", structuredExperience: "6_to_24m", daysPerWeek: 4,
      environment: { kind: "commercial_gym" }, block: { cycles, periodization: "static" } };
    const before = structuredClone(answers);
    const result = Adapter.programRequestFromAnswers(answers, Catalog);
    assert.deepEqual(result, { ok: false, conflicts: [{ field: "block", code: "block_cycles_unsupported" }] });
    assert.deepEqual(answers, before);
  }
});

const exercisesById = new Map(Catalog.exercises.map((exercise) => [exercise.id, exercise]));
const gated = Catalog.exercises.filter((exercise) => Array.isArray(exercise.preconditions) && exercise.preconditions.length);

test("movement confirmations reach the request only for current gated exercises and their own prerequisites", () => {
  const [first, second] = gated;
  const unrelated = gated.find((exercise) => exercise.preconditions[0] !== first.preconditions[0]);
  const request = requestFor({
    environment: { kind: "commercial_gym" },
    movementConfirmations: {
      [first.id]: [...first.preconditions],
      [second.id]: [...unrelated.preconditions],
      ffffffffffffffffffffffffffffffff: [...first.preconditions],
    },
  });
  assert.deepEqual(request.movementConfirmations, { [first.id]: [...first.preconditions].sort() });
});

function answersState() {
  return Entry.selectRoute(Entry.createState({
    draftId: "00000000-0000-4000-8000-000000000072", activeProgramRevisionAtStart: 0,
    now: "2026-10-11T12:00:00.000Z", versions: Adapter.currentVersions(Compiler),
  }), "recommend");
}

test("the answer schema takes B's Basics, presets, adjustment, block, deload and confirmations", () => {
  const exercise = gated[0];
  const accepted = Entry.setAnswers(answersState(), {
    basics: {
      sex: "undisclosed", birthDate: "1993-05-14", heightCm: 174, heightUnit: "ftin",
      weightKg: 80.5, weightUnit: "lb", cardioExperience: "1_to_4y",
    },
    environment: { kind: "warehouse_gym", adjust: { add: ["smith", "bench"], remove: ["bands"] } },
    block: { cycles: 12, periodization: "reverse_linear" },
    deload: true,
    movementConfirmations: { [exercise.id]: [...exercise.preconditions] },
  });
  assert.deepEqual(accepted.answers.environment, { kind: "warehouse_gym", adjust: { add: ["bench", "smith"], remove: ["bands"] } });
  assert.equal(accepted.answers.basics.birthDate, "1993-05-14");
  assert.equal(accepted.answers.deload, true);
  assert.equal(Entry.setAnswers(answersState(), { environment: { kind: "everything" } }).answers.environment.kind, "everything");
  assert.deepEqual(Entry.setAnswers(answersState(), { basics: { sex: "female" } }).answers.basics, { sex: "female" },
    "every Basics field is optional");

  const rejected = [
    { basics: { sex: "other" } },
    { basics: { birthDate: "1993-02-30" } },
    { basics: { heightCm: 40 } },
    { basics: { weightKg: 900 } },
    { basics: { cardioExperience: "elite" } },
    { basics: { unknown: 1 } },
    { block: { cycles: 3, periodization: "static" } },
    { block: { cycles: 13, periodization: "static" } },
    { block: { cycles: 7, periodization: "wave" } },
    { deload: "yes" },
    { environment: { kind: "moon_base" } },
    { environment: { kind: "basic_gym", adjust: { add: "bench" } } },
    { movementConfirmations: { [exercise.id]: "all" } },
  ];
  for (const patch of rejected) {
    assert.throws(() => Entry.setAnswers(answersState(), patch), /Invalid answer patch/, JSON.stringify(patch));
  }

  const overlapping = Entry.setAnswers(answersState(), {
    environment: { kind: "basic_gym", adjust: { add: ["bench", "laser", "smith"], remove: ["smith", "cable"] } },
  });
  assert.deepEqual(overlapping.answers.environment.adjust, { add: ["bench"], remove: ["cable"] },
    "unknown tokens are dropped and a group in both lists cancels out");
});

test("a draft an earlier release stored normalizes to itself and maps to the same request", () => {
  // Both consumers use frozen outputs of the pre-Plan-072 public producer and
  // adapter, never a draft enriched by today's constructors or normalizer.
  const fixture = historicalDrafts;
  assert.deepEqual(fixture.cases.map(c => c.id), ["commercial-empty", "commercial-authored", "other-empty"]);
  for (const sample of fixture.cases) {
    const stored = structuredClone(sample.draft);
    const resumed = Entry.normalizeSetupDraft(stored);
    assert.equal(resumed.ok, true, JSON.stringify(resumed.issues));
    assert.deepEqual(resumed.value, sample.draft, `${sample.id}: every historical field survives`);
    assert.deepEqual(stored, sample.draft, `${sample.id}: input remains untouched`);
    const request = Adapter.programRequestFromAnswers(resumed.value.answers, Catalog);
    assert.equal(request.ok, true, JSON.stringify(request.conflicts));
    assert.deepEqual(request.value, sample.expectedRequest, `${sample.id}: prior-release request meaning survives`);
  }
});

// Offers: the generator reports, per slot, the best-ranked candidate that is
// blocked only by prerequisites nobody has answered. The adapter keeps an
// offer only when confirming it alone, puts that movement
// in that slot.
const generate = (request) => Compiler.generateProgram(request, Catalog);
const slotsById = (definition) => new Map(definition.days.flatMap((day) => day.slots.map((slot) => [slot.id, { day, slot }])));

function offerCorpus() {
  const cases = [];
  const competencyAll = (value) => Object.fromEntries(Entry.COMPETENCY_ANSWERS.map((key) => [key, value]));
  for (const kind of ["commercial_gym", "limited_home"]) {
    for (const desiredResult of ["muscle_growth", "strength"]) {
      for (const daysPerWeek of [3, 5]) {
        for (const [label, competencyAnswers] of [["unsure", {}], ["yes", competencyAll(true)], ["no", competencyAll(false)]]) {
          cases.push({ key: `${kind}|${desiredResult}|${daysPerWeek}|${label}`, label,
            request: requestFor({ desiredResult, daysPerWeek, environment: { kind }, competencyAnswers }) });
        }
      }
    }
  }
  return cases;
}

test("confirmation offers are verified swaps that name every other slot they move", async () => {
  let offered = 0;
  let verified = 0;
  for (const { key, label, request } of offerCorpus()) {
    const result = generate(request);
    assert.equal(result.ok, true, key);
    assert.ok(Array.isArray(result.confirmationOffers), `${key}: the generator reports offers`);
    const slots = slotsById(result.value);
    const seenSlots = new Set();
    for (const offer of result.confirmationOffers) {
      offered++;
      const placed = slots.get(offer.slotId);
      assert.ok(placed, `${key}: offer names a generated slot`);
      assert.ok(!seenSlots.has(offer.slotId), `${key}: at most one offer per slot`);
      seenSlots.add(offer.slotId);
      assert.equal(placed.day.id, offer.dayId);
      assert.equal(placed.slot.exerciseId, offer.currentExerciseId);
      const exercise = exercisesById.get(offer.offeredExerciseId);
      assert.ok(exercise, `${key}: the offered movement is a catalog exercise`);
      assert.ok(offer.prerequisiteIds.length > 0 && offer.prerequisiteIds.every((id) => exercise.preconditions.includes(id)),
        `${key}: an offer confirms only the movement's own prerequisites`);
      if (label === "no") {
        for (const id of offer.prerequisiteIds) {
          assert.ok(!Compiler.PRECONDITION_COMPETENCIES[index[id].name], `${key}: no offer overrides a "no" answer`);
        }
      }
    }
    const checks = [];
    const kept = await Adapter.verifyConfirmationOffers({ generate: async (next) => {
      checks.push({ request: next });
      return generate(next);
    }, request, result });
    assert.equal(checks.length, result.confirmationOffers.length, `${key}: each reported offer is checked once`);
    for (const check of checks) {
      const added = Object.keys(check.request.movementConfirmations).filter((id) =>
        JSON.stringify(check.request.movementConfirmations[id]) !== JSON.stringify(request.movementConfirmations[id] || []));
      assert.equal(added.length, 1, `${key}: a check confirms one offered movement only`);
    }
    for (const offer of kept) {
      verified++;
      const confirmed = generate({ ...request, movementConfirmations: { ...request.movementConfirmations,
        [offer.offeredExerciseId]: offer.prerequisiteIds } });
      assert.equal(confirmed.ok, true);
      const positions = result.value.days.flatMap((day, dayIndex) => day.slots.map((slot, slotIndex) =>
        ({ slot, dayIndex, slotIndex })));
      const after = ({ dayIndex, slotIndex }) => confirmed.value.days[dayIndex]?.slots[slotIndex]?.exerciseId;
      assert.equal(after(positions.find(({ slot }) => slot.id === offer.slotId)), offer.offeredExerciseId, `${key}: the offer swaps in alone`);
      const changed = positions.filter((position) => position.slot.id !== offer.slotId && after(position) !== position.slot.exerciseId)
        .map(({ slot }) => slot.id);
      assert.deepEqual(offer.alsoChangedSlotIds, changed, `${key}: the offer names the other slots it moves`);
    }
    assert.ok(kept.every((offer) => result.confirmationOffers.some((item) => item.slotId === offer.slotId)));
  }
  assert.ok(offered > 0 && verified > 0, `the corpus exercises offers (${offered} reported, ${verified} verified)`);
});

test("once every gated movement is confirmed there is nothing left to offer", () => {
  const confirmations = Object.fromEntries(gated.map((exercise) => [exercise.id, [...exercise.preconditions]]));
  const request = { ...requestFor({ environment: { kind: "commercial_gym" } }), movementConfirmations: confirmations };
  const result = generate(request, "offers-all");
  assert.equal(result.ok, true);
  assert.deepEqual(result.confirmationOffers, []);
});

test("ten strict pull-ups implies five in the request (owner decision on #340)", () => {
  const only10 = requestFor({ environment: { kind: "commercial_gym" }, competencyAnswers: { pullups10: true } });
  assert.equal(only10.competencyAnswers.pullups10, true);
  assert.equal(only10.competencyAnswers.pullups5, true, "a yes to ten pull-ups is a yes to five");
  const contradictory = requestFor({ environment: { kind: "commercial_gym" }, competencyAnswers: { pullups10: true, pullups5: false } });
  assert.deepEqual([contradictory.competencyAnswers.pullups5, contradictory.competencyAnswers.pullups10], [true, true],
    "a stored yes to ten with a no to five resolves to the stronger answer");
  const five = requestFor({ environment: { kind: "commercial_gym" }, competencyAnswers: { pullups5: true, pullups10: false } });
  assert.deepEqual([five.competencyAnswers.pullups5, five.competencyAnswers.pullups10], [true, false], "five does not imply ten");
});

test("confirmation verification compares corresponding positions across request identities", async () => {
  const definition = (prefix, first, second) => ({ days: [{ id: `${prefix}-day`, slots: [
    { id: `${prefix}-one`, exerciseId: first }, { id: `${prefix}-two`, exerciseId: second },
  ] }] });
  const offer = { slotId: "before-one", dayId: "before-day", currentExerciseId: "old",
    offeredExerciseId: "new", prerequisiteIds: ["confirmed"] };
  const verified = await Adapter.verifyConfirmationOffers({ request: { movementConfirmations: {} },
    result: { ok: true, value: definition("before", "old", "other"), confirmationOffers: [offer] },
    generate: async () => ({ ok: true, value: definition("after", "new", "changed") }) });
  assert.deepEqual(verified, [{ ...offer, alsoChangedSlotIds: ["before-two"] }]);
});
