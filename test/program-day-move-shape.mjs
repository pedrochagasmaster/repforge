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

/** The host's day_move rule (app.js, syncEditorCanonicalIntent). */
function moveDays(definition, wanted) {
  const next = structuredClone(definition);
  const byName = new Map(next.days.filter((day) => day.kind === "training").map((day) => [day.name, day]));
  const ordered = wanted.map((name) => byName.get(name));
  let index = 0;
  next.days = next.days.map((day) => day.kind === "training" ? ordered[index++] : day);
  next.days.forEach((day, position) => { day.order = position + 1; });
  return next;
}
const keys = (value) => Array.isArray(value) ? value.map(keys)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, keys(value[key])])) : typeof value;

console.log("Plan 074 S2: a day move keeps the program definition's shape");
const before = seed.programMeta.programDefinition;
const training = before.days.filter((day) => day.kind === "training").map((day) => day.name);
check(training.join() === "Day 1,Day 2,Day 3", "the seed program trains Day 1, Day 2 and Day 3", training);
const moved = moveDays(before, ["Day 3", "Day 1", "Day 2"]);

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
