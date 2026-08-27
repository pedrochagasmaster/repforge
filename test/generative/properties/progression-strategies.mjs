/** Generative long-running journeys for every owner-approved Wave 2 strategy. */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { stableStringify } from "../model/canonicalize.mjs";

const { Progression } = loadDomain();
const GRID = 2.5;
const settings = { minLoadIncrement: GRID, jumpPercent: 2.5, hardRir: 4 };
const context = { weekNumber: 1, blockLength: 6, blockStart: null };

const repGoalArbitrary = fc.record({
  sets: fc.integer({ min: 1, max: 6 }),
  floor: fc.integer({ min: 3, max: 10 }),
  span: fc.integer({ min: 0, max: 6 }),
  goalFraction: fc.integer({ min: 0, max: 100 }),
}).map(({ sets, floor, span, goalFraction }) => {
  const ceiling = floor + span;
  const minimum = sets * floor, maximum = sets * ceiling;
  const goal = minimum + Math.floor((maximum - minimum) * goalFraction / 100);
  return { schemaVersion: 1, strategy: { id: "rep_goal", version: 1, params: {
    workingSets: sets, repGoal: goal, repFloor: floor, repCeiling: ceiling,
    targetRirMin: 1, targetRirMax: 3, minLoadIncrement: GRID,
    jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1",
  } }, modifiers: [] };
});

const anchorArbitrary = fc.record({
  anchorMin: fc.integer({ min: 2, max: 6 }),
  anchorSpan: fc.integer({ min: 0, max: 4 }),
  backoffSets: fc.integer({ min: 1, max: 6 }),
  backoffMin: fc.integer({ min: 5, max: 12 }),
  backoffSpan: fc.integer({ min: 0, max: 6 }),
  percent: fc.integer({ min: 70, max: 95 }),
}).map((v) => ({ schemaVersion: 1, strategy: { id: "anchor_backoff", version: 1, params: {
  anchorRepMin: v.anchorMin, anchorRepMax: v.anchorMin + v.anchorSpan,
  anchorTargetRirMin: 1, anchorTargetRirMax: 3,
  backoffSets: v.backoffSets, backoffRepMin: v.backoffMin, backoffRepMax: v.backoffMin + v.backoffSpan,
  backoffPercent: v.percent / 100, minLoadIncrement: GRID, jumpPercent: 2.5,
} }, modifiers: [] }));

const manual = { schemaVersion: 1, strategy: { id: "manual", version: 1, params: {} }, modifiers: [] };
const strategyArbitrary = fc.oneof(repGoalArbitrary, anchorArbitrary, fc.constant(manual));

const inputFor = (prescription, history, currentSession = []) => ({
  engineVersion: 1, prescription, relation: null, modifiers: [], settings,
  history, currentSession, context,
});
const date = (index) => `2026-${String(1 + Math.floor(index / 28)).padStart(2, "0")}-${String(1 + index % 28).padStart(2, "0")}`;
const completed = (targets) => targets.map((target) => ({ role: target.role, load: target.load, reps: target.reps, rir: 2 }));

function seedFor(prescription) {
  const id = prescription.strategy.id, p = prescription.strategy.params;
  if (id === "rep_goal") {
    const reps = Progression.balancedFrontload(p.repGoal, p.workingSets, p.repFloor, p.repCeiling);
    return reps.map((value) => ({ role: "working", load: 100, reps: value, rir: 2 }));
  }
  if (id === "anchor_backoff") return [
    { role: "anchor", load: 100, reps: p.anchorRepMax, rir: 2 },
    ...Array.from({ length: p.backoffSets }, () => ({ role: "backoff", load: 80, reps: p.backoffRepMin, rir: 2 })),
  ];
  return [{ load: 100, reps: 8, rir: null }];
}

function assertTyped(prescription, result) {
  const id = prescription.strategy.id;
  if (result.strategy.id !== id) throw new Error(`${id} silently became ${result.strategy.id}`);
  if (stableStringify(result).toLowerCase().includes("deload")) throw new Error(`${id} scheduled a deload`);
  if (id === "manual") {
    if (result.kind !== "manual" || result.target.sets.length) throw new Error("manual invented a target");
    return;
  }
  if (result.kind !== "recommendation" && result.kind !== "insufficient_evidence") throw new Error(`${id} returned ${result.kind}`);
  for (const set of result.target.sets) {
    if (set.load !== null && (!Number.isFinite(set.load) || Progression.roundToGrid(set.load, GRID) !== set.load)) throw new Error(`${id} returned an invalid grid load`);
    if (set.reps !== null && !Number.isInteger(set.reps)) throw new Error(`${id} returned non-integer reps`);
  }
}

export function buildSuites() {
  return [
    {
      name: "progression strategies: author, train, partial-session, switch, and serialized restore journeys stay typed and pure",
      property: fc.property(
        strategyArbitrary,
        strategyArbitrary,
        fc.integer({ min: 12, max: 52 }),
        fc.integer({ min: 1, max: 11 }),
        (authored, switched, weeks, switchAt) => {
          let prescription = structuredClone(authored);
          let history = [{ sessionId: "seed", date: date(0), sets: seedFor(prescription) }];
          const archive = [];
          for (let index = 1; index <= weeks; index++) {
            if (index === Math.min(switchAt, weeks)) prescription = structuredClone(switched);
            // Export/import, archive/restore, and backup/restore all use the
            // actual JSON-safe domain envelopes; each round trip must be exact.
            const exported = JSON.parse(JSON.stringify({ prescription, history }));
            archive.push(exported);
            const restored = JSON.parse(JSON.stringify(archive.at(-1)));
            if (stableStringify(restored) !== stableStringify(exported)) throw new Error("serialized restore drifted");

            const input = inputFor(restored.prescription, restored.history);
            const before = stableStringify(input);
            const result = Progression.evaluateProgression(input);
            assertTyped(restored.prescription, result);
            if (stableStringify(input) !== before) throw new Error("evaluation mutated committed history");

            if (result.target.sets.length) {
              const first = completed(result.target.sets.slice(0, 1));
              const partialInput = inputFor(restored.prescription, restored.history, first);
              const partialBefore = stableStringify(partialInput);
              const partial = Progression.evaluateProgression(partialInput);
              assertTyped(restored.prescription, partial);
              if (stableStringify(partialInput) !== partialBefore) throw new Error("partial session mutated completed or future sets");
              history = restored.history.concat({ sessionId: `session-${index}`, date: date(index), sets: completed(result.target.sets) });
            } else history = restored.history;
            prescription = restored.prescription;
          }
        },
      ),
    },
    {
      name: "progression strategies: unsupported versions remain incompatible and never fall back to range",
      property: fc.property(fc.string({ minLength: 1, maxLength: 20 }), fc.integer({ min: 2, max: 99 }), (suffix, version) => {
        const id = `future_${suffix.replace(/[^a-z]/gi, "a").toLowerCase() || "x"}`;
        const input = inputFor({ schemaVersion: 1, strategy: { id, version, params: { retained: true } }, modifiers: [] }, []);
        const result = Progression.evaluateProgression(input);
        if (result.kind !== "incompatible" || result.strategy.id !== id || result.strategy.id === "range") throw new Error("unknown strategy fell through");
      }),
    },
    {
      name: "progression strategies: paired exposure is temper-only and distinct machine identities stay incompatible",
      property: fc.property(anchorArbitrary, repGoalArbitrary, fc.constantFrom("advance", "hold", "reduce", "recalibrate"), (heavy, volume, counterpartStatus) => {
        const heavyInput = inputFor(heavy, [{ sessionId: "heavy", date: date(0), sets: seedFor(heavy) }]);
        const independent = Progression.evaluateProgression(heavyInput);
        const relation = {
          schemaVersion: 1, id: "generated-pair", type: "paired_exposure", version: 1,
          movementId: "same-machine", members: [
            { exerciseId: "heavy", role: "heavy" }, { exerciseId: "volume", role: "volume" },
          ], selfRole: "heavy",
          counterpart: { strategy: "rep_goal@1", sessionsInWindow: 3, mostRecentExpectedExposureCompleted: true, status: counterpartStatus },
        };
        const paired = Progression.evaluateProgression({ ...heavyInput, relation });
        if ((paired.target.sets[0]?.load ?? 0) > (independent.target.sets[0]?.load ?? 0)) throw new Error("pair promoted the heavy target");
        if (!Progression.pairedExposureCompatibility({ heavy: "anchor_backoff@1", volume: `${volume.strategy.id}@1` }).compatible) throw new Error("approved pair rejected");
        if (Progression.pairedMovementCompatibility({ heavy: "machine-a", volume: "machine-b" }).compatible) throw new Error("distinct machines paired");
      }),
    },
  ];
}
