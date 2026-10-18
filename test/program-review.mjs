#!/usr/bin/env node
import {Adapter as NativeAdapter} from './fixtures/training-runtime.mjs';
/**
 * Plan 070 slice 2: the review editor's edit rules on a canonical
 * ProgramDefinition (ADR 0020, consequences).
 *
 * Isolated from the browser on purpose. The browser journey in
 * generate-program-browser.mjs proves one path through the screen. These
 * rules have boundaries it cannot reach deterministically:
 * - manual-edit deload arithmetic (half the edited sets, RIR 2 higher, capped
 *   at 6), distinct from recovered generation's prefix and +3 rule;
 * - periodized ranges that shift together across cycles;
 * - the per-side retarget and catalog-derived fields on a swap;
 * - the alternates limit and identity rules;
 * - every edit validated, with refused edits leaving the definition untouched;
 * - replay determinism of an edit log over seeded random edit sequences, which
 *   is what lets a reload restore undo.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Adapter = NativeAdapter;
const Compiler = require("../src/training/generation.js");
const Metrics = require("../src/training/metrics.js");
const Catalog = require("../assets/exercise-catalog.json");
const Review = require("../src/training/authoring.js").review;

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 1500)}`);
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ctx = { compiler: Compiler, catalog: Catalog, metrics: Metrics };
const valid = (definition) => Compiler.validateProgramDefinition(definition, Catalog).ok;
const SUPPORTED_PER_SIDE_SEMANTICS = [
  ["loadKg", "repsPerSide"],
  ["repsPerSide"],
  ["repsPerSide", "loadPerSideKg"],
  ["persistentLoadPerSideKg", "repsPerSide"],
];
const PLAN069_S3_ADDITIONS = [
  ["loadKg", "repsPerSide"],
  ["repsPerSide"],
  ["reps", "loadPerSideKg"],
];

function generate({ days = 4, goal = "muscle_growth", environment = "commercial_gym", extra = {} } = {}) {
  const request = Adapter.programRequestFromAnswers({
    desiredResult: goal, structuredExperience: "6_to_24m", daysPerWeek: days,
    environment: { kind: environment }, sessionMinutes: 60,
    competencyAnswers: Object.fromEntries(["pullups10", "pullups5", "pushups15", "inclineBarbell10", "overheadPress10", "bodyweightDips10", "benchPress10"].map(key => [key, true])),
    primaryMuscles: [], deEmphasizedMuscles: [],
  }, Catalog);
  if (!request.ok) throw new Error("request failed");
  const generated = Compiler.generateProgram({ ...request.value, ...extra }, Catalog);
  if (!generated.ok) throw new Error("generation failed");
  return generated.value;
}
const slotsOf = (definition) => definition.days.flatMap((day) => day.slots || []);
const slotById = (definition, id) => slotsOf(definition).find((slot) => slot.id === id);
const dayOfSlot = (definition, id) => definition.days.find((day) => (day.slots || []).some((slot) => slot.id === id));
const isDeload = (cycle) => cycle.sets.some((set) => set.provenance?.deload === true);
const repsOf = (set) => set.targets.reps || set.targets.repsPerSide;
const semanticsOf = (exercise) => {
  const result = Metrics.definitionsForIds(exercise?.exerciseMetrics || []);
  return result.ok ? result.value.map((metric) => metric.semantic) : [];
};
const exerciseWithSemantics = (semantics, excluded = new Set(), { ambiguous = false } = {}) =>
  Catalog.exercises.find((exercise) => {
    if (excluded.has(exercise.id) || !Number.isFinite(exercise.bodyweight) || !same(semanticsOf(exercise), semantics)) return false;
    const names = (exercise.laterality || []).map((id) => Catalog.uuidIndex[id]?.name);
    const hasUnilateral = names.includes("Unilateral"), hasBilateral = names.includes("Bilateral");
    return ambiguous ? hasUnilateral === hasBilateral : hasUnilateral !== hasBilateral;
  }) || null;
function apply(definition, edit, ordinal = 1) {
  return Review.applyEdit(definition, edit, { ...ctx, ordinal });
}

// A manually authored fixture retains the review editor's own deload policy.
// Its valid source-generated shell supplies metric identities and cycle ranges;
// this is not an assertion that generation uses the manual +2 editing rule.
const plain = generate();
const deload = clone(generate({ days: 3, extra: { cycles: 8, deloadCycles: [8], periodization: "linear" } }));
deload.generatorVersion = "manual@1";
deload.request = {};
deload.provenance = { source: "manual", policyVersion: "manual@1" };
check(valid(plain) && valid(deload), "fixtures: generated and manually authored programs validate");

console.log("program-review: set count");
{
  const slot = slotsOf(deload)[0];
  const before = clone(deload);
  const result = apply(deload, { kind: "sets", slotId: slot.id, count: 4 });
  check(result.ok, "sets: a count of 4 is accepted", result);
  const edited = slotById(result.definition, slot.id);
  check(edited.prescriptionsByCycle.every((cycle) => cycle.sets.length === (isDeload(cycle) ? 2 : 4)),
    "sets: every cycle gets the count and the deload cycle keeps ceil(count / 2)",
    edited.prescriptionsByCycle.map((cycle) => cycle.sets.length));
  check(edited.prescriptionsByCycle.every((cycle) => cycle.sets.every((set, index) => set.setIndex === index + 1 && set.cycleIndex === cycle.cycleIndex)),
    "sets: set and cycle indexes stay ordered");
  const ids = slotsOf(result.definition).flatMap((item) => item.prescriptionsByCycle.flatMap((cycle) => cycle.sets.map((set) => set.id)));
  check(new Set(ids).size === ids.length, "sets: added sets have unique ids");
  const cycle1 = edited.prescriptionsByCycle[0];
  const last = slot.prescriptionsByCycle[0].sets.at(-1);
  check(same(cycle1.sets.at(-1).targets, last.targets) && cycle1.sets.at(-1).rir === last.rir && cycle1.sets.at(-1).restSeconds === last.restSeconds,
    "sets: an added set copies the cycle's last set");
  check(valid(result.definition), "sets: the result validates");
  check(same(deload, before), "sets: the input definition is not mutated");
  const six = apply(deload, { kind: "sets", slotId: slot.id, count: 6 });
  check(six.ok && slotById(six.definition, slot.id).prescriptionsByCycle.every((cycle) =>
    cycle.sets.length === (isDeload(cycle) ? 3 : 6)),
  "sets: six edited sets produce three in the deload cycle",
  slotById(six.definition, slot.id).prescriptionsByCycle.map((cycle) => cycle.sets.length));
  const one = apply(deload, { kind: "sets", slotId: slot.id, count: 1 });
  check(one.ok && slotById(one.definition, slot.id).prescriptionsByCycle.every((cycle) => cycle.sets.length === 1),
    "sets: a count of 1 leaves the deload cycle at its minimum of 1");
  for (const count of [0, 9, 2.5]) check(!apply(deload, { kind: "sets", slotId: slot.id, count }).ok, `sets: ${count} is refused`);
}

console.log("program-review: rep range");
{
  const slot = slotsOf(deload)[0];
  const first = repsOf(slot.prescriptionsByCycle[0].sets[0]);
  const result = apply(deload, { kind: "rep_range", slotId: slot.id, min: first.min - 1, max: first.max + 2 });
  check(result.ok, "reps: a range change is accepted", result);
  const edited = slotById(result.definition, slot.id);
  check(edited.prescriptionsByCycle.every((cycle, cycleIndex) => cycle.sets.every((set, setIndex) => {
    const was = repsOf(slot.prescriptionsByCycle[cycleIndex].sets[setIndex]);
    const now = repsOf(set);
    return now.min === was.min - 1 && now.max === was.max + 2;
  })), "reps: min and max shift together across every cycle, keeping the periodized offsets");
  check(valid(result.definition), "reps: the result validates");
  check(!apply(deload, { kind: "rep_range", slotId: slot.id, min: 8, max: 7 }).ok, "reps: max below min is refused");
  check(!apply(deload, { kind: "rep_range", slotId: slot.id, min: 0, max: 5 }).ok, "reps: a min below 1 is refused");
  check(!apply(deload, { kind: "rep_range", slotId: slot.id, min: first.min, max: 31 }).ok, "reps: a max above 30 is refused");
  const perSide = slotsOf(plain).find((item) => item.metricDefinitions.some((metric) => metric.semantic === "repsPerSide"));
  if (perSide) {
    const range = repsOf(perSide.prescriptionsByCycle[0].sets[0]);
    const shifted = apply(plain, { kind: "rep_range", slotId: perSide.id, min: range.min + 1, max: range.max + 1 });
    check(shifted.ok && slotById(shifted.definition, perSide.id).prescriptionsByCycle[0].sets.every((set) => set.targets.repsPerSide && !set.targets.reps),
      "reps: a per-side slot keeps repsPerSide");
  }
}

console.log("program-review: RIR per set");
{
  const slot = slotsOf(deload)[0];
  const result = apply(deload, { kind: "rir", slotId: slot.id, setIndex: 1, rir: 3 });
  check(result.ok, "rir: RIR 3 on set 1 is accepted", result);
  const edited = slotById(result.definition, slot.id);
  check(edited.prescriptionsByCycle.every((cycle) => cycle.sets[0].rir === (isDeload(cycle) ? 5 : 3)),
    "rir: set 1 in every cycle, manual deload 2 higher and capped at 6",
    edited.prescriptionsByCycle.map((cycle) => cycle.sets[0].rir));
  check(edited.prescriptionsByCycle.every((cycle, index) => cycle.sets.slice(1).every((set, k) => set.rir === slot.prescriptionsByCycle[index].sets[k + 1].rir)),
    "rir: other sets keep their RIR");
  const second = apply(deload, { kind: "rir", slotId: slot.id, setIndex: 2, rir: 0 });
  check(second.ok && slotById(second.definition, slot.id).prescriptionsByCycle.every((cycle) => !cycle.sets[1] || cycle.sets[1].rir === (isDeload(cycle) ? 2 : 0)),
    "rir: present sets retain the manual deload offset and absent sets are skipped");
  const deloadLow = apply(deload, { kind: "rir", slotId: slot.id, setIndex: 1, rir: 0 });
  check(deloadLow.ok && slotById(deloadLow.definition, slot.id).prescriptionsByCycle.filter(isDeload).every((cycle) => cycle.sets[0].rir === 2),
    "rir: deload is 2 above the edited value");
  for (const rir of [-1, 7]) check(!apply(deload, { kind: "rir", slotId: slot.id, setIndex: 1, rir }).ok, `rir: ${rir} is refused`);
  check(!apply(deload, { kind: "rir", slotId: slot.id, setIndex: 9, rir: 2 }).ok, "rir: a set the slot does not have is refused");
}

console.log("program-review: rest");
{
  const slot = slotsOf(plain)[0];
  const result = apply(plain, { kind: "rest", slotId: slot.id, seconds: 90 });
  check(result.ok && slotById(result.definition, slot.id).prescriptionsByCycle.every((cycle) => cycle.sets.every((set) => set.restSeconds === 90)),
    "rest: every set in every cycle");
  check(!apply(plain, { kind: "rest", slotId: slot.id, seconds: 75 }).ok, "rest: a value outside the presets is refused");
}

console.log("program-review: edited sets keep adapting");
{
  const slot = slotsOf(plain)[0];
  let definition = plain;
  for (const [index, edit] of [
    { kind: "sets", slotId: slot.id, count: 4 },
    { kind: "rir", slotId: slot.id, setIndex: 1, rir: 3 },
    { kind: "rest", slotId: slot.id, seconds: 150 },
  ].entries()) definition = apply(definition, edit, index + 1).definition;
  const sets = slotById(definition, slot.id).prescriptionsByCycle.flatMap((cycle) => cycle.sets);
  check(sets.every((set) => set.status === "ready"), "status: edited sets stay ready, so suggestions keep adapting");
  check(sets.every((set) => set.provenance.source === "lifter_review"), "provenance: edited sets record the lifter's review");
}

console.log("program-review: swap");
{
  const slot = slotsOf(plain).find((item) => Compiler.findSubstitutions(plain, item.id, {}, Catalog).length);
  const candidates = Compiler.findSubstitutions(plain, slot.id, {}, Catalog);
  const target = candidates[0].exerciseId;
  const withAlternates = apply(plain, { kind: "alternates", slotId: slot.id, alternates: candidates.slice(0, 2).map((item) => item.exerciseId) }).definition;
  const result = apply(withAlternates, { kind: "swap", slotId: slot.id, exerciseId: target }, 2);
  check(result.ok, "swap: an engine candidate is accepted", result);
  const swapped = slotById(result.definition, slot.id);
  const raw = Catalog.exercises.find((exercise) => exercise.id === target);
  check(swapped.exerciseId === target && same(swapped.sourceExerciseIds, [target]), "swap: the slot names the new movement");
  check(same(swapped.metricIds, raw.exerciseMetrics), "swap: metrics come from the catalog");
  check(swapped.loadingModel.bodyweightCoefficient === (Number.isFinite(raw.bodyweight) ? raw.bodyweight : null),
    "swap: the bodyweight coefficient comes from the catalog");
  check(same(swapped.lateralityIds, raw.laterality || []), "swap: laterality comes from the catalog");
  check(swapped.executionMode === candidates[0].executionMode, "swap: an engine candidate keeps its execution mode");
  check(swapped.purposeId === slot.purposeId && swapped.role === slot.role, "swap: an engine candidate fills the same job");
  check(!(swapped.alternates || []).includes(target) && (swapped.alternates || []).length === 1,
    "swap: the new movement leaves the alternates");
  check(valid(result.definition), "swap: the result validates");

  const used = slotsOf(plain).find((item) => item.id !== slot.id && item.role !== "manual").exerciseId;
  check(!apply(plain, { kind: "swap", slotId: slot.id, exerciseId: used }).ok, "swap: a movement another generated slot uses is refused");

  const program = new Set(slotsOf(plain).map((item) => item.exerciseId));
  const perSideMovement = Catalog.exercises.find((exercise) => !program.has(exercise.id) &&
    Metrics.definitionsForIds(exercise.exerciseMetrics || []).ok &&
    Metrics.definitionsForIds(exercise.exerciseMetrics).value.some((metric) => metric.semantic === "repsPerSide"));
  const repsSlot = slotsOf(plain).find((item) => item.metricDefinitions.some((metric) => metric.semantic === "reps"));
  const before = repsOf(repsSlot.prescriptionsByCycle[0].sets[0]);
  const search = apply(plain, { kind: "swap", slotId: repsSlot.id, exerciseId: perSideMovement.id });
  check(search.ok, "swap: any catalog movement that records reps is accepted", search);
  const searched = slotById(search.definition, repsSlot.id);
  check(searched.prescriptionsByCycle.every((cycle) => cycle.sets.every((set) => set.targets.repsPerSide && !set.targets.reps)) &&
    same(searched.prescriptionsByCycle[0].sets[0].targets.repsPerSide, before),
    "swap: the range moves to the new movement's per-side reps");
  check(same(searched.metricIds, perSideMovement.exerciseMetrics), "swap: a searched movement's metrics come from the catalog");
  check(valid(search.definition), "swap: a searched movement validates");
  const durationOnly = Catalog.exercises.find((exercise) => Metrics.definitionsForIds(exercise.exerciseMetrics || []).ok &&
    Metrics.definitionsForIds(exercise.exerciseMetrics).value.length &&
    !Metrics.definitionsForIds(exercise.exerciseMetrics).value.some((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide"));
  check(!apply(plain, { kind: "swap", slotId: repsSlot.id, exerciseId: durationOnly.id }).ok, "swap: a movement that records no reps is refused");
  check(!apply(plain, { kind: "swap", slotId: repsSlot.id, exerciseId: "not-a-movement" }).ok, "swap: an unknown movement is refused");
}

console.log("program-review: execution mode");
{
  const program = new Set(slotsOf(plain).map((item) => item.exerciseId));
  const ambiguous = Catalog.exercises.find((exercise) => {
    if (program.has(exercise.id) || !Number.isFinite(exercise.bodyweight)) return false;
    const result = Metrics.definitionsForIds(exercise.exerciseMetrics || []);
    if (!result.ok || !SUPPORTED_PER_SIDE_SEMANTICS.some((semantics) => same(result.value.map((metric) => metric.semantic), semantics))) return false;
    const names = (exercise.laterality || []).map((id) => Catalog.uuidIndex[id]?.name);
    const unilateral = names.includes("Unilateral"), bilateral = names.includes("Bilateral");
    return unilateral === bilateral;
  });
  const source = slotsOf(plain).find((slot) => slot.metricDefinitions.some((metric) => metric.semantic === "reps"));
  check(!!ambiguous && !!source, "execution mode: fixtures include a generated source and an ambiguous supported per-side movement");
  if (ambiguous && source) {
    const swapped = apply(plain, { kind: "swap", slotId: source.id, exerciseId: ambiguous.id });
    check(swapped.ok, "execution mode: a catalog swap is accepted", swapped);
    if (swapped.ok) {
      const unresolved = slotById(swapped.definition, source.id);
      check(unresolved.executionMode === null && unresolved.prescriptionsByCycle.every((cycle) =>
        cycle.sets.every((set) => set.status === "configuration_required")),
      "execution mode: an unanswered per-side movement stays configuration-required");
      const resolved = apply(swapped.definition, { kind: "execution_mode", slotId: source.id, executionMode: "unilateral" });
      check(resolved.ok, "execution mode: a valid answer intent applies", resolved);
      if (resolved.ok) {
        const slot = slotById(resolved.definition, source.id);
        check(slot.executionMode === "unilateral", "execution mode: the answer is stored on the slot");
        check(slot.prescriptionsByCycle.every((cycle) => cycle.sets.every((set) => set.status === "ready")),
          "execution mode: a validated, otherwise eligible slot returns to ready");
        check(valid(resolved.definition), "execution mode: the resolved definition validates");
      }

      const deliberateManual = clone(swapped.definition);
      const manual = slotById(deliberateManual, source.id).prescriptionsByCycle[0].sets[0];
      manual.status = "manual";
      manual.provenance.source = "manual";
      const manualResult = apply(deliberateManual, { kind: "execution_mode", slotId: source.id, executionMode: "bilateral" });
      check(manualResult.ok && slotById(manualResult.definition, source.id).prescriptionsByCycle[0].sets[0].status === "manual" &&
        slotById(manualResult.definition, source.id).prescriptionsByCycle[0].sets[0].provenance.source === "manual",
      "execution mode: an explicitly manual prescription and its provenance remain manual", manualResult);

      const missingRir = clone(swapped.definition);
      const missing = slotById(missingRir, source.id).prescriptionsByCycle[0].sets[0];
      missing.rir = null;
      const missingResult = apply(missingRir, { kind: "execution_mode", slotId: source.id, executionMode: "unilateral" });
      const missingSet = missingResult.ok && slotById(missingResult.definition, source.id).prescriptionsByCycle[0].sets[0];
      check(missingSet && missingSet.rir === null && missingSet.status === "configuration_required",
        "execution mode: a non-manual prescription missing RIR stays configuration-required", missingResult);

      const scalarTarget = clone(swapped.definition);
      const scalarSet = slotById(scalarTarget, source.id).prescriptionsByCycle[0].sets[0];
      scalarSet.targets.repsPerSide = scalarSet.targets.repsPerSide.min;
      const scalarResult = apply(scalarTarget, { kind: "execution_mode", slotId: source.id, executionMode: "unilateral" });
      const scalarSetResult = scalarResult.ok && slotById(scalarResult.definition, source.id).prescriptionsByCycle[0].sets[0];
      check(scalarSetResult && typeof scalarSetResult.targets.repsPerSide === "number" && scalarSetResult.status === "ready",
        "execution mode: a supported scalar R3 rep target returns to ready", scalarResult);

      const fractionalRir = clone(swapped.definition);
      slotById(fractionalRir, source.id).prescriptionsByCycle[0].sets[0].rir = 2.5;
      check(valid(fractionalRir), "execution mode: the current program contract accepts fractional RIR");
      const fractionalResult = apply(fractionalRir, { kind: "execution_mode", slotId: source.id, executionMode: "unilateral" });
      const fractionalSet = fractionalResult.ok && slotById(fractionalResult.definition, source.id).prescriptionsByCycle[0].sets[0];
      check(fractionalSet?.rir === 2.5 && fractionalSet.status === "ready",
        "execution mode: fractional RIR accepted by the engine remains ready after mode resolution", fractionalResult);
    }
  }
}

console.log("program-review: Plan 069 S3 adaptive compositions");
{
  const used = new Set(slotsOf(plain).map((slot) => slot.exerciseId));
  const source = slotsOf(plain).find((slot) => slot.metricDefinitions.some((metric) => metric.semantic === "reps"));
  const day = plain.days.find((item) => item.kind === "training");
  for (const semantics of PLAN069_S3_ADDITIONS) {
    const exercise = exerciseWithSemantics(semantics, used);
    check(!!exercise, `fixtures: catalog contains an unambiguous ${semantics.join("+")} movement`);
    if (!exercise || !source || !day) continue;
    const swapped = apply(plain, { kind: "swap", slotId: source.id, exerciseId: exercise.id });
    const swappedSlot = swapped.ok && slotById(swapped.definition, source.id);
    check(swappedSlot && same(swappedSlot.metricDefinitions.map((metric) => metric.semantic), semantics) &&
      swappedSlot.prescriptionsByCycle.every((cycle) => cycle.sets.every((set) => set.status === "ready")),
    `swap: approved ${semantics.join("+")} source composition remains adaptive`, swapped);

    const added = apply(plain, { kind: "add", dayId: day.id, exerciseId: exercise.id }, 11);
    const addedSlot = added.ok && added.definition.days.find((item) => item.id === day.id)?.slots.at(-1);
    check(addedSlot && same(addedSlot.metricDefinitions.map((metric) => metric.semantic), semantics) &&
      addedSlot.prescriptionsByCycle.every((cycle) => cycle.sets.every((set) => set.status === "ready")),
    `add: approved ${semantics.join("+")} source composition remains adaptive`, added);
  }

  for (const semantics of PLAN069_S3_ADDITIONS.slice(0, 2)) {
    const exercise = exerciseWithSemantics(semantics, used, { ambiguous: true });
    check(!!exercise, `fixtures: catalog contains an ambiguous ${semantics.join("+")} movement`);
    if (!exercise || !source) continue;
    const swapped = apply(plain, { kind: "swap", slotId: source.id, exerciseId: exercise.id });
    const slot = swapped.ok && slotById(swapped.definition, source.id);
    check(slot?.executionMode === null && slot.prescriptionsByCycle.every((cycle) =>
      cycle.sets.every((set) => set.status === "configuration_required")),
    `mode answer: ambiguous ${semantics.join("+")} stays configuration-required before answer`, swapped);
    if (!swapped.ok) continue;
    const resolved = apply(swapped.definition, { kind: "execution_mode", slotId: source.id, executionMode: "unilateral" });
    const resolvedSlot = resolved.ok && slotById(resolved.definition, source.id);
    check(resolvedSlot && resolvedSlot.prescriptionsByCycle.every((cycle) =>
      cycle.sets.every((set) => set.status === "ready")),
    `mode answer: supported ${semantics.join("+")} returns to ready`, resolved);
  }
}

console.log("program-review: alternates");
{
  const slot = slotsOf(plain)[0];
  const ids = Catalog.exercises.filter((exercise) => exercise.id !== slot.exerciseId).slice(0, 6).map((exercise) => exercise.id);
  const five = apply(plain, { kind: "alternates", slotId: slot.id, alternates: ids.slice(0, 5) });
  check(five.ok && same(slotById(five.definition, slot.id).alternates, ids.slice(0, 5)), "alternates: up to five, in order");
  check(!apply(plain, { kind: "alternates", slotId: slot.id, alternates: ids }).ok, "alternates: a sixth is refused");
  check(!apply(plain, { kind: "alternates", slotId: slot.id, alternates: [slot.exerciseId] }).ok, "alternates: the slot's own movement is refused");
  check(!apply(plain, { kind: "alternates", slotId: slot.id, alternates: [ids[0], ids[0]] }).ok, "alternates: a repeat is refused");
  const cleared = apply(five.definition, { kind: "alternates", slotId: slot.id, alternates: [] });
  check(cleared.ok && !("alternates" in slotById(cleared.definition, slot.id)), "alternates: an empty list removes the field");
}

console.log("program-review: move, remove, reorder");
{
  const training = plain.days.filter((day) => day.kind === "training");
  const [from, to] = training;
  const slot = from.slots[1];
  const moved = apply(plain, { kind: "move", slotId: slot.id, toDayId: to.id });
  check(moved.ok, "move: to another training day is accepted", moved);
  const target = moved.definition.days.find((day) => day.id === to.id);
  check(target.slots.at(-1).id === slot.id && target.slots.every((item, index) => item.order === index + 1),
    "move: appended to the target day, orders renumbered");
  check(moved.definition.days.find((day) => day.id === from.id).slots.every((item, index) => item.order === index + 1),
    "move: the source day renumbers");
  const rest = plain.days.find((day) => day.kind === "rest");
  check(!apply(plain, { kind: "move", slotId: slot.id, toDayId: rest.id }).ok, "move: to a rest day is refused");
  check(!apply(plain, { kind: "move", slotId: slot.id, toDayId: from.id }).ok, "move: to its own day is refused");

  let emptied = plain;
  for (const [index, item] of from.slots.entries()) emptied = apply(emptied, { kind: "remove", slotId: item.id }, index + 1).definition;
  check(emptied.days.find((day) => day.id === from.id).slots.length === 0 && valid(emptied), "remove: a day can be emptied and still validates");
  check(same(Review.blockers(emptied), [`day_empty:${from.id}`]), "remove: an empty training day blocks Activate", Review.blockers(emptied));
  check(same(Review.blockers(plain), []), "blockers: none for the recommendation");

  const order = from.slots.map((item) => item.id).reverse();
  const reordered = apply(plain, { kind: "reorder", dayId: from.id, slotIds: order });
  check(reordered.ok && same(reordered.definition.days.find((day) => day.id === from.id).slots.map((item) => item.id), order) &&
    reordered.definition.days.find((day) => day.id === from.id).slots.every((item, index) => item.order === index + 1),
    "reorder: the new order, renumbered");
  check(!apply(plain, { kind: "reorder", dayId: from.id, slotIds: order.slice(1) }).ok, "reorder: a list that drops a slot is refused");
}

console.log("program-review: add and rename");
{
  const day = deload.days.find((item) => item.kind === "training");
  const program = new Set(slotsOf(deload).map((item) => item.exerciseId));
  const movement = Catalog.exercises.find((exercise) => !program.has(exercise.id) && Metrics.definitionsForIds(exercise.exerciseMetrics || []).ok &&
    Metrics.definitionsForIds(exercise.exerciseMetrics).value.some((metric) => metric.semantic === "reps"));
  const added = apply(deload, { kind: "add", dayId: day.id, exerciseId: movement.id }, 7);
  check(added.ok, "add: a catalog movement is accepted", added);
  const slot = added.definition.days.find((item) => item.id === day.id).slots.at(-1);
  check(slot.exerciseId === movement.id && slot.role === "manual" && slot.order === day.slots.length + 1, "add: appended as a manual slot");
  check(slot.prescriptionsByCycle.every((cycle) => cycle.sets.length === (isDeload(cycle) ? 2 : 3)), "add: three sets, two in the deload week");
  check(same(slot.metricIds, movement.exerciseMetrics), "add: metrics come from the catalog");
  const again = apply(deload, { kind: "add", dayId: day.id, exerciseId: movement.id }, 7);
  check(same(added.definition, again.definition), "add: the same edit at the same position builds the same ids");
  check(valid(added.definition), "add: the result validates");
  const rest = deload.days.find((item) => item.kind === "rest");
  if (rest) check(!apply(deload, { kind: "add", dayId: rest.id, exerciseId: movement.id }).ok, "add: to a rest day is refused");

  const renamed = apply(deload, { kind: "day_name", dayId: day.id, name: "  Peito e costas " });
  check(renamed.ok && renamed.definition.days.find((item) => item.id === day.id).name === "Peito e costas", "rename: trimmed and applied");
  const otherDay = deload.days.find((item) => item.kind === "training" && item.id !== day.id);
  if (otherDay) {
    const duplicate = apply(deload, { kind: "day_name", dayId: day.id, name: otherDay.name });
    check(!duplicate.ok && duplicate.code === "day_name_exists", "rename: a stored duplicate name is refused at the edit boundary", duplicate);
  }
  check(!apply(deload, { kind: "day_name", dayId: day.id, name: "   " }).ok, "rename: an empty name is refused");
  check(!apply(deload, { kind: "day_name", dayId: day.id, name: "x".repeat(41) }).ok, "rename: more than 40 characters is refused");
  check(!apply(deload, { kind: "nonsense", slotId: day.slots[0].id }).ok, "edits: an unknown kind is refused");
}

console.log("program-review: estimates follow the edits");
{
  const day = plain.days.find((item) => item.kind === "training");
  const result = apply(plain, { kind: "sets", slotId: day.slots[0].id, count: 6 });
  const edited = result.definition.days.find((item) => item.id === day.id);
  check(result.definition.provenance.estimatedSessionSeconds[edited.name] === Compiler.estimateDaySeconds(edited, undefined, Catalog),
    "estimates: the provenance estimate is the engine's for the edited day");
}

console.log("program-review: changes against the recommendation");
{
  const [first, second] = plain.days.filter((day) => day.kind === "training");
  const log = [
    { kind: "sets", slotId: first.slots[0].id, count: 5 },
    { kind: "remove", slotId: first.slots[1].id },
    { kind: "day_name", dayId: second.id, name: "Costas" },
    { kind: "reorder", dayId: second.id, slotIds: second.slots.map((slot) => slot.id).reverse() },
  ];
  const replayed = Review.replay(plain, log, ctx);
  check(replayed.ok, "changes: the log replays", replayed);
  const program = new Set(slotsOf(plain).map((item) => item.exerciseId));
  const movement = Catalog.exercises.find((exercise) => !program.has(exercise.id) && Metrics.definitionsForIds(exercise.exerciseMetrics || []).ok &&
    Metrics.definitionsForIds(exercise.exerciseMetrics).value.some((metric) => metric.semantic === "reps"));
  const withAdd = Review.replay(plain, [...log, { kind: "add", dayId: first.id, exerciseId: movement.id }], ctx);
  const changes = Review.changes(plain, withAdd.definition);
  const added = withAdd.definition.days.find((day) => day.id === first.id).slots.at(-1).id;
  check(changes.slots[first.slots[0].id] === "edited" && changes.slots[added] === "added", "changes: edited and added rows are marked", changes);
  check(changes.count === 5, "changes: one edited, one added, one removed, one renamed and one reordered day", changes);
  check(Review.changes(plain, plain).count === 0, "changes: none for the recommendation");
}

console.log("program-review: replay determinism over random edit logs");
{
  // A seeded generator of plausible edits; refused edits are part of the test
  // too, because they must leave the log and the definition unchanged.
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const fixtures = [plain, deload, generate({ days: 5, goal: "strength" }), generate({ days: 3, environment: "limited_home" })];
  const pool = Catalog.exercises.filter((exercise) => Metrics.definitionsForIds(exercise.exerciseMetrics || []).ok &&
    Metrics.definitionsForIds(exercise.exerciseMetrics).value.some((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide"));
  for (const [fixtureIndex, baseline] of fixtures.entries()) {
    const random = rng(101 + fixtureIndex);
    const pick = (list) => list[Math.floor(random() * list.length)];
    let current = baseline;
    const log = [], snapshots = [baseline];
    let invalid = 0;
    for (let step = 0; step < 60; step++) {
      const slots = slotsOf(current), training = current.days.filter((day) => day.kind === "training");
      const slot = slots.length ? pick(slots) : null;
      const day = pick(training);
      const kinds = slot ? ["sets", "rep_range", "rir", "rest", "swap", "swap_search", "alternates", "move", "remove", "reorder", "add", "day_name"] : ["add", "day_name"];
      const kind = pick(kinds);
      let edit;
      if (kind === "sets") edit = { kind, slotId: slot.id, count: 1 + Math.floor(random() * 8) };
      else if (kind === "rep_range") { const r = repsOf(slot.prescriptionsByCycle[0].sets[0]) || { min: 8, max: 10 }; const min = Math.max(1, r.min + Math.floor(random() * 5) - 2); edit = { kind, slotId: slot.id, min, max: Math.min(30, Math.max(min, r.max + Math.floor(random() * 5) - 2)) }; }
      else if (kind === "rir") edit = { kind, slotId: slot.id, setIndex: 1 + Math.floor(random() * slot.prescriptionsByCycle[0].sets.length), rir: Math.floor(random() * 5) };
      else if (kind === "rest") edit = { kind, slotId: slot.id, seconds: pick([60, 90, 120, 150, 180, 240]) };
      else if (kind === "swap") { const subs = Compiler.findSubstitutions(current, slot.id, {}, Catalog); if (!subs.length) continue; edit = { kind: "swap", slotId: slot.id, exerciseId: pick(subs).exerciseId }; }
      else if (kind === "swap_search") edit = { kind: "swap", slotId: slot.id, exerciseId: pick(pool).id };
      else if (kind === "alternates") edit = { kind, slotId: slot.id, alternates: [pick(pool).id, pick(pool).id].filter((id, i, all) => id !== slot.exerciseId && all.indexOf(id) === i) };
      else if (kind === "move") { const others = training.filter((item) => !(item.slots || []).some((s) => s.id === slot.id)); if (!others.length) continue; edit = { kind, slotId: slot.id, toDayId: pick(others).id }; }
      else if (kind === "remove") edit = { kind, slotId: slot.id };
      else if (kind === "reorder") { const ids = day.slots.map((s) => s.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } edit = { kind, dayId: day.id, slotIds: ids }; }
      else if (kind === "add") edit = { kind, dayId: day.id, exerciseId: pick(pool).id };
      else edit = { kind, dayId: day.id, name: `Dia ${step}` };
      const result = Review.applyEdit(current, edit, { ...ctx, ordinal: log.length + 1 });
      if (!result.ok) {
        check(result.definition === undefined, `random ${fixtureIndex}: a refused edit returns no definition`);
        continue;
      }
      if (!valid(result.definition)) invalid++;
      log.push(edit);
      current = result.definition;
      snapshots.push(current);
    }
    check(invalid === 0, `random ${fixtureIndex}: every accepted edit validates (${log.length} accepted)`, invalid);
    check(log.length >= 20, `random ${fixtureIndex}: the sequence exercises enough edits`, log.length);
    const replayed = Review.replay(baseline, log, ctx);
    check(replayed.ok && same(replayed.definition, current), `random ${fixtureIndex}: replaying the log rebuilds the same definition`);
    const undone = Review.replay(baseline, log.slice(0, -1), ctx);
    check(undone.ok && same(undone.definition, snapshots.at(-2)), `random ${fixtureIndex}: replaying all but the last edit is undo`);
    check(same(Review.replay(baseline, [], ctx).definition, baseline), `random ${fixtureIndex}: an empty log is the recommendation`);
  }
  const bad = Review.replay(plain, [{ kind: "sets", slotId: "missing", count: 3 }], ctx);
  check(!bad.ok && bad.failedAt === 0, "replay: a log that no longer applies says where it stopped", bad);
}

if (failures.length) {
  console.error(`\nprogram-review: ${failures.length} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`program-review: ${passed} passed`);
