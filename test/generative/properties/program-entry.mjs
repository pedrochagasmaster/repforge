import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { createFixtureServices } from "../../fixtures/program-entry-services.mjs";
import { runProgramEntryJourney } from "../model/program-entry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const Entry = require(join(ROOT, "program-entry.js"));
const services = createFixtureServices();

const routeAction = fc.constantFrom(...Entry.ROUTES).map((route) => ({ type: "select", route }));
const action = fc.oneof(
  { weight: 3, arbitrary: routeAction },
  { weight: 4, arbitrary: fc.constant({ type: "fill" }) },
  { weight: 6, arbitrary: fc.constant({ type: "advance" }) },
  { weight: 3, arbitrary: fc.constant({ type: "back" }) },
  { weight: 2, arbitrary: fc.constant({ type: "reload" }) },
  { weight: 1, arbitrary: fc.constant({ type: "restart" }) },
  { weight: 1, arbitrary: fc.constant({ type: "external_change" }) },
  { weight: 1, arbitrary: fc.constant({ type: "activate" }) },
);

export function buildSuites() {
  return [
    {
      name: "program entry: generated route switching resume restart and conflict journeys preserve state",
      property: fc.property(fc.array(action, { minLength: 1, maxLength: 80 }), (actions) => {
        runProgramEntryJourney(Entry, services, actions);
      }),
    },
    {
      name: "program entry: fixture compiler repeats exactly for closed generated inputs",
      property: fc.property(
        fc.constantFrom("recommend", "custom"),
        fc.integer({ min: 2, max: 6 }),
        fc.constantFrom("muscle_growth", "balanced", "strength"),
        fc.constantFrom("first", "under_6m", "6_to_24m", "over_24m"),
        fc.constantFrom("most", "about_half", "few", "none"),
        (mode, daysPerWeek, desiredResult, structuredExperience, recentConsistency) => {
          const answers = {
            desiredResult,
            structuredExperience,
            recentConsistency,
            daysPerWeek,
            sessionMinutes: 60,
            preferredRestSeconds: 120,
            environment: { kind: "commercial_gym" },
            primaryMuscles: [],
          };
          if (mode === "custom") answers.splitPreference = services.splitChoices(answers).choices[0].id;
          const input = {
            mode,
            answers,
            versions: {
              compiler: "fixture-1",
              family: "fixture-1",
              blueprint: "fixture-1",
              catalogue: "fixture-1",
              allocation: "fixture-1",
              timeModel: "fixture-1",
              contextSchema: "1",
              progression: "range-1",
            },
          };
          const first = services.compile(input);
          const second = services.compile(structuredClone(input));
          if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("fixture compile drifted");
        },
      ),
    },
  ];
}
