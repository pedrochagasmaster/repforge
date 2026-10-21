#!/usr/bin/env node
/**
 * Plan 074 S2 shape check (P074-S2-SHAPE): moving a training day changes the
 * order of the definition's days and of the program structure, nothing else.
 *
 * The seed program's definition with its training days moved the way the
 * installed editor's host moves them (training days take the new order in the
 * positions training days hold; every day is renumbered) must:
 *   - pass validateProgramDefinition unchanged in shape (same keys everywhere);
 *   - canonicalize to itself;
 *   - travel through a setup link and come back in the new order.
 *
 * It also holds the editor's pure day-order rules to malformed moves: a list
 * that omits, repeats or invents a day, or names a rest day, is refused, and a
 * move made against an order another edit (a reorder or a rename) has since
 * changed does not replay.
 *
 * Run: node test/program-day-move-shape.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const Compiler = require(join(root, "program-compiler.js"));
const Setup = require(join(root, "shared-setup.js"));
const { reorderTrainingDays, dayOrderConflict } = require(join(root, "program-editor.js"));
const source = JSON.parse(fs.readFileSync(join(root, "plans/067/data/app_file.json"), "utf8"));
const seed = JSON.parse(fs.readFileSync(join(root, "test/fixtures/seed-program-v067.json"), "utf8"));
const settings = {
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg", lang: "en", rirMode: "numeric",
};
const compilerOptions = {
  builtInIds: new Set(source.exercises.map((entry) => entry.id)),
  catalogSnapshot: source,
  validateProgramDefinition: Compiler.validateProgramDefinition,
};

let passed = 0;
const check = (condition, message, detail) => {
  assert.ok(condition, `${message}${detail === undefined ? "" : ` ${JSON.stringify(detail).slice(0, 600)}`}`);
  passed++;
  console.log(`  ✓ ${message}`);
};

/** The host's day_move rule: app.js applies the editor's reorderTrainingDays to the definition. */
function moveDays(definition, wanted) {
  const days = reorderTrainingDays(definition, wanted);
  return days && { ...structuredClone(definition), days };
}
const keys = (value) => Array.isArray(value) ? value.map(keys)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, keys(value[key])])) : typeof value;

console.log("Plan 074 S2: a day move keeps the program definition's shape");
const before = seed.programMeta.programDefinition;
const training = before.days.filter((day) => day.kind === "training").map((day) => day.name);
check(training.join() === "Day 1,Day 2,Day 3", "the seed program trains Day 1, Day 2 and Day 3", training);
const moved = moveDays(before, ["Day 3", "Day 1", "Day 2"]);
check(!!moved, "a permutation of the training days is a move");
const kinds = (definition) => definition.days.map((day) => day.kind).join();
check(kinds(moved) === kinds(before), "rest days keep their positions", { before: kinds(before), after: kinds(moved) });
check(moved.days.map((day) => day.order).join() === before.days.map((_, index) => index + 1).join(), "every day is renumbered contiguously");
const byId = (definition) => new Map(definition.days.map((day) => [day.id, day]));
check([...byId(before)].every(([id, day]) => JSON.stringify({ ...day, order: 0 }) === JSON.stringify({ ...byId(moved).get(id), order: 0 })),
  "each day keeps its identity and every field but its order");
check(JSON.stringify(before.days.map((day) => day.order)) === JSON.stringify(seed.programMeta.programDefinition.days.map((day) => day.order)),
  "the move does not write into the definition it was given");

const rest = before.days.find((day) => day.kind !== "training")?.name;
for (const [label, wanted] of [
  ["a list that omits a training day", ["Day 3", "Day 1"]],
  ["a list that repeats a training day", ["Day 3", "Day 3", "Day 1"]],
  ["a list that names an unknown day", ["Day 3", "Day 1", "Day 9"]],
  ["a list that names a rest day", ["Day 3", "Day 1", rest]],
  ["a list with an extra day", ["Day 3", "Day 1", "Day 2", "Day 2"]],
  ["no list", undefined],
]) check(moveDays(before, wanted) === null, `${label} is not a move`, wanted);

const order = ["Day 1", "Day 2", "Day 3"];
const edit = { kind: "day_move", targetDay: "Day 3", before: order, after: ["Day 3", "Day 1", "Day 2"] };
check(dayOrderConflict(order, edit) === null, "a move applies over the order it was made against");
check(dayOrderConflict(["Day 2", "Day 1", "Day 3"], edit) === "day_order_changed", "a move made before another reorder does not replay over it");
check(dayOrderConflict(["Push", "Day 2", "Day 3"], edit) === "day_order_changed", "a move made before a rename does not replay over it");
for (const [label, after] of [
  ["omits", ["Day 3", "Day 1"]], ["repeats", ["Day 3", "Day 3", "Day 1"]], ["invents", ["Day 3", "Day 1", "Day 9"]],
]) check(dayOrderConflict(order, { ...edit, after }) === "invalid_day_order", `a move whose new order ${label} a day is refused`, after);
check(dayOrderConflict(order, { kind: "day_move" }) === "day_order_changed", "a move without its orders is refused");

const validated = Compiler.validateProgramDefinition(moved, source, []);
check(validated.ok === true, "validateProgramDefinition accepts the reordered definition", validated.issues);
check(JSON.stringify(keys(moved.days.map((day) => ({ ...day, slots: [] })).sort((a, b) => a.id.localeCompare(b.id)))) ===
  JSON.stringify(keys(before.days.map((day) => ({ ...day, slots: [] })).sort((a, b) => a.id.localeCompare(b.id)))),
"no day gains or loses a field");
check(JSON.stringify(Object.keys(moved).sort()) === JSON.stringify(Object.keys(before).sort()), "the definition keeps the same top-level fields");
const slotShapes = (definition) => definition.days.flatMap((day) => day.slots).map((slot) => JSON.stringify(keys(slot))).sort();
check(JSON.stringify(slotShapes(moved)) === JSON.stringify(slotShapes(before)), "every slot keeps its shape");
check(JSON.stringify(Compiler.canonicalizeProgramDefinition(moved)) === JSON.stringify(Compiler.canonicalizeProgramDefinition(structuredClone(moved))),
  "canonicalizing the reordered definition is stable");

const input = {
  kind: "taurifer-shared-setup", version: 2,
  program: { name: "Reordered", definition: Compiler.canonicalizeProgramDefinition(moved), customExercises: [] },
  settings, language: "en",
};
const encoded = await Setup.encode(input, compilerOptions);
check(encoded.ok === true, "a setup link encodes the reordered program", encoded);
const decoded = await Setup.decode(encoded.value, compilerOptions);
check(decoded.ok === true, "and decodes it", decoded);
const back = decoded.value.program.definition.days.filter((day) => day.kind === "training").map((day) => day.name);
check(back.join() === "Day 3,Day 1,Day 2", "the decoded program keeps the new day order", back);

console.log(`\n${passed} passed, 0 failed`);
