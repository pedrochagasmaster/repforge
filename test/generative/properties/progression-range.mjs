/**
 * Range progression properties run through the intentional Node adapter.
 * The model supplies valid normalized evidence but does not duplicate the
 * strategy algorithm.
 */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { intIn, smallCount } from "../arbitraries/numbers.mjs";
import { stableStringify } from "../model/canonicalize.mjs";

const { Progression } = loadDomain();

const loadArbitrary = fc.integer({ min: 1, max: 400 }).map((value) => value * 2.5);
const setArbitrary = fc.record({
  load: loadArbitrary,
  reps: intIn(1, 100),
  rir: fc.oneof(fc.constant(null), fc.integer({ min: -5, max: 20 })),
});

const sessionSetsArbitrary = fc.array(setArbitrary, { minLength: 1, maxLength: 8 });
const historyArbitrary = fc.array(sessionSetsArbitrary, { maxLength: 12 }).map((sessions) =>
  sessions.map((sets, index) => ({
    sessionId: `session-${index + 1}`,
    date: `2026-${String(1 + Math.floor(index / 28)).padStart(2, "0")}-${String(1 + index % 28).padStart(2, "0")}`,
    sets,
  })),
);

const validInputArbitrary = fc.record({
  workingSets: smallCount(8),
  repMin: intIn(1, 99),
  span: intIn(0, 10),
  minLoadIncrement: fc.constantFrom(0.5, 1, 1.25, 2.5, 5),
  jumpPercent: fc.constantFrom(0, 1, 2.5, 5, 10),
  hardRir: intIn(1, 10),
  history: historyArbitrary,
  currentSession: fc.array(setArbitrary, { maxLength: 8 }),
  weekNumber: intIn(1, 6),
  freshnessFactor: fc.option(fc.constantFrom(0.95, 0.975, 1), { nil: undefined }),
}).map((source) => {
  const repMax = Math.min(100, source.repMin + source.span);
  const context = { weekNumber: source.weekNumber, blockLength: 6, blockStart: null };
  if (source.freshnessFactor !== undefined) context.freshnessFactor = source.freshnessFactor;
  return {
    engineVersion: 1,
    prescription: {
      schemaVersion: 1,
      strategy: {
        id: "range",
        version: 1,
        params: { workingSets: source.workingSets, repMin: source.repMin, repMax },
      },
      modifiers: [],
    },
    relation: null,
    modifiers: [],
    settings: {
      minLoadIncrement: source.minLoadIncrement,
      jumpPercent: source.jumpPercent,
      hardRir: source.hardRir,
    },
    history: source.history,
    currentSession: source.currentSession,
    context,
  };
});

function assertResultBounds(input, result) {
  if (result.kind !== "recommendation") throw new Error(`valid input returned ${result.kind}`);
  if (result.engineVersion !== 1 || result.strategy.id !== "range" || result.strategy.version !== 1) {
    throw new Error("result lost engine or strategy provenance");
  }
  if (result.provenance.evidenceWindow.sessionCount !== input.history.length) {
    throw new Error("session evidence count drifted");
  }
  if (result.provenance.evidenceWindow.currentSetCount !== input.currentSession.length) {
    throw new Error("current-set evidence count drifted");
  }
  const params = input.prescription.strategy.params;
  const expectedTargets = input.currentSession.length ? 1 : params.workingSets;
  if (result.target.sets.length !== expectedTargets) throw new Error("target set count drifted");
  for (const target of result.target.sets) {
    if (target.load !== null && (!Number.isFinite(target.load) || target.load < 0)) throw new Error("invalid target load");
    if (!Number.isInteger(target.reps) || target.reps < params.repMin || target.reps > params.repMax) {
      throw new Error("target reps escaped the range");
    }
  }
  if (stableStringify(result).includes("deload")) throw new Error("range result scheduled a deload");
}

export function buildSuites() {
  return [
    {
      name: "progression range: deterministic, pure, finite, bounded, and provenance-complete",
      property: fc.property(validInputArbitrary, (input) => {
        const before = stableStringify(input);
        const first = Progression.evaluateProgression(input);
        const second = Progression.evaluateProgression(input);
        if (stableStringify(input) !== before) throw new Error("evaluation mutated input");
        if (stableStringify(first) !== stableStringify(second)) throw new Error("equal input produced different output");
        assertResultBounds(input, first);
      }),
    },
    {
      name: "progression range: performed top-of-range always advances",
      property: fc.property(
        intIn(1, 8),
        intIn(1, 90),
        intIn(0, 10),
        loadArbitrary,
        (workingSets, repMin, span, load) => {
          const repMax = Math.min(100, repMin + span);
          const input = {
            engineVersion: 1,
            prescription: {
              schemaVersion: 1,
              strategy: { id: "range", version: 1, params: { workingSets, repMin, repMax } },
              modifiers: [],
            },
            relation: null,
            modifiers: [],
            settings: { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 },
            history: [{
              sessionId: "top",
              date: "2026-01-01",
              sets: Array.from({ length: workingSets }, () => ({ load, reps: repMax, rir: 0 })),
            }],
            currentSession: [],
            context: { weekNumber: 1, blockLength: 6, blockStart: null },
          };
          const result = Progression.evaluateProgression(input);
          if (result.status !== "advance") throw new Error(`performed top returned ${result.status}`);
          if (!result.reasonCodes.includes("range.performed_top")
            && !result.reasonCodes.includes("range.capacity_top_double")) {
            throw new Error(`performed top lost an advancement reason: ${result.reasonCodes}`);
          }
        },
      ),
    },
    {
      name: "progression range: family, program, and entitlement fields are rejected",
      property: fc.property(
        validInputArbitrary,
        fc.constantFrom("familyId", "programId", "publicName", "entitlement"),
        fc.string(),
        (input, key, value) => {
          const clean = Progression.evaluateProgression(input);
          assertResultBounds(input, clean);
          const polluted = Progression.evaluateProgression({ ...input, [key]: value });
          if (polluted.kind !== "invalid" || polluted.reasonCodes[0] !== "engine.invalid_input") {
            throw new Error(`${key} entered progression logic`);
          }
        },
      ),
    },
  ];
}
