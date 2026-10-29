#!/usr/bin/env node
/**
 * Records the digest of every generated definition in the compiler corpus
 * (plus each rep pattern with and without a lighter week) under the current
 * GENERATOR_VERSION. Plan 076 ran it once on 073.4, before the bump, to write
 * test/fixtures/generator-073-4-digests.json; the guard in
 * test/generation-periodization.mjs regenerates the same requests stamped as
 * 073.4 and requires the same digests.
 *
 * Run: node tools/record-generator-baseline.mjs > test/fixtures/generator-<version>-digests.json
 */
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { corpusCases } from "../test/fixtures/program-compiler-corpus-cases.mjs";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");
const Identity = require("../generation-identity.js");
Identity.prepareCatalog(Catalog);

export function baselineCases() {
  const cases = corpusCases({ Adapter, Catalog }).map(({ key, request }) => ({ key, request }));
  for (const periodization of ["static", "linear", "reverse_linear", "undulating"]) {
    for (const deload of [false, true]) {
      for (const [days, minutes] of [[3, 60], [4, 90]]) {
        const mapped = Adapter.programRequestFromAnswers({ desiredResult: "balanced", structuredExperience: "6_to_24m", daysPerWeek: days,
          sessionMinutes: minutes, environment: { kind: "commercial_gym" }, block: { cycles: 7, periodization }, deload,
          ...(deload ? { deloadPosition: days === 3 ? "start" : "end" } : {}) }, Catalog);
        if (!mapped.ok) throw new Error(`baseline answers do not map: ${JSON.stringify(mapped.conflicts)}`);
        cases.push({ key: `block|${periodization}|${deload ? "deload" : "plain"}|${days}|${minutes}`, request: mapped.value });
      }
    }
  }
  return cases;
}

export function digestOf(result) {
  return result.ok ? `ok:${createHash("sha256").update(Identity.canonicalJSON(result.value)).digest("hex")}`
    : `fail:${result.conflicts?.map((c) => c.code).join(",")}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const digests = {};
  for (const { key, request } of baselineCases()) digests[key] = digestOf(Compiler.generateProgram(request, Catalog));
  process.stdout.write(`${JSON.stringify({ generatorVersion: Compiler.GENERATOR_VERSION, digests }, null, 2)}\n`);
}
