// Shared helpers for the round-2 engine scripts. Each script runs Taurifer's
// real progression engine (progression-engine.js at the repo root), prints the
// JSON the landing page embeds, and can check or rewrite that embedded copy:
//
//   node docs/design/landing-candidates/round-2/<script>.mjs           # print
//   node docs/design/landing-candidates/round-2/<script>.mjs --check   # verify index.html
//   node docs/design/landing-candidates/round-2/<script>.mjs --write   # update index.html
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const Engine = createRequire(import.meta.url)(join(here, "../../../../progression-engine.js"));
export const PAGE = join(here, "index.html");

// The settings every round-2 example uses: 2.5 kg plates, a 2.5% jump and the
// default hard-set ceiling of 4 RIR.
export const SETTINGS = Object.freeze({ minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 });

export function rangePrescription(workingSets, repMin, repMax) {
  return { schemaVersion: 1, strategy: { id: "range", version: 1, params: { workingSets, repMin, repMax } }, modifiers: [] };
}

export function evaluate({ prescription, history, weekNumber = 1, blockStart = null }) {
  const result = Engine.evaluateProgression({
    engineVersion: 1,
    prescription,
    relation: null,
    modifiers: [],
    settings: SETTINGS,
    history,
    currentSession: [],
    context: { weekNumber, blockLength: 6, blockStart },
  });
  if (result.kind !== "recommendation") throw new Error("engine did not recommend: " + JSON.stringify(result));
  return result;
}

export const sets = (rows) => rows.map(([load, reps, rir]) => ({ load, reps, rir }));

// The page holds each dataset between `/*@<name>*/` and `/*@end*/`.
export function embed(name, value) {
  const line = "var " + name + " = " + JSON.stringify(value) + ";";
  const mode = process.argv[2];
  if (!mode) { console.log(JSON.stringify(value, null, 2)); return; }
  const html = readFileSync(PAGE, "utf8");
  const re = new RegExp("/\\*@" + name + "\\*/[\\s\\S]*?/\\*@end\\*/");
  if (!re.test(html)) throw new Error("marker /*@" + name + "*/ not found in " + PAGE);
  const next = html.replace(re, "/*@" + name + "*/" + line + "/*@end*/");
  if (mode === "--write") { writeFileSync(PAGE, next); console.log("wrote " + name); return; }
  if (mode === "--check") {
    if (next !== html) { console.error(name + ": embedded data differs from the engine. Run with --write."); process.exit(1); }
    console.log(name + ": embedded data matches the engine.");
    return;
  }
  throw new Error("unknown mode " + mode);
}
