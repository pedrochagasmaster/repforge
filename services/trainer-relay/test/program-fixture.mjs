// The four-day, seven-week program test/shared-setup-unit.mjs generates,
// as a complete shared-setup document (Plan 086 section 4, proof 1).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROOT } from "./local-relay.mjs";

const require = createRequire(import.meta.url);
export const Setup = require(join(ROOT, "shared-setup.js"));
const Compiler = require(join(ROOT, "program-compiler.js"));

let cached;
export function fourDaySevenWeekDocument() {
  if (cached) return { document: structuredClone(cached.document), options: cached.options };
  const source = JSON.parse(readFileSync(join(ROOT, "plans/067/data/app_file.json"), "utf8"));
  require(join(ROOT, "generation-identity.js")).prepareCatalog(source);
  const workerFixture = JSON.parse(readFileSync(join(ROOT,
    "services/install-transfer/test/fixtures/program-definition-plan067-worker.json"), "utf8"));
  const request = structuredClone(workerFixture.request);
  delete request.seed;
  Object.assign(request, { daysPerWeek: 4, timeCeilingMinutes: 40, cycles: 7, deloadCycles: [], split: "auto" });
  const generated = Compiler.generateProgram(request, source);
  if (!generated.ok) throw new Error("fixture generation failed");
  const options = {
    builtInIds: new Set(source.exercises.map((entry) => entry.id)),
    catalogSnapshot: source,
    validateProgramDefinition: Compiler.validateProgramDefinition,
  };
  const document = {
    kind: "taurifer-shared-setup",
    version: 2,
    program: { name: "Compact four-day", definition: generated.value, customExercises: [] },
    settings: { jumpPct: 3.5, minJump: 1.25, rirHigh: 3, hardRir: 4, restSec: 165, unit: "lb", lang: "pt", rirMode: "effort" },
    language: "pt",
  };
  const checked = Setup.validate(document, options);
  if (!checked.ok) throw new Error("fixture document is invalid");
  cached = { document: checked.value, options };
  return { document: structuredClone(cached.document), options };
}
