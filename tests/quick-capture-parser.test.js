const assert = require("node:assert/strict");
const { parseSetCommand } = require("../command-parser.js");

const cases = [
  {
    input: "80 x 8 @1",
    expected: { exerciseName: null, set: null, load: 80, reps: 8, rir: 1 },
  },
  {
    input: "set 2 82 x 7 @1",
    expected: { exerciseName: null, set: 2, load: 82, reps: 7, rir: 1 },
  },
  {
    input: "incline converging chest press 82 x 7 @1",
    expected: { exerciseName: "incline converging chest press", set: null, load: 82, reps: 7, rir: 1 },
  },
  {
    input: "incline converging chest press set 2 82 x 7 @1",
    expected: { exerciseName: "incline converging chest press", set: 2, load: 82, reps: 7, rir: 1 },
  },
  {
    input: "set 2 incline converging chest press 82 x 7 @1",
    expected: { exerciseName: "incline converging chest press", set: 2, load: 82, reps: 7, rir: 1 },
  },
  {
    input: "machine lateral raise 15 x 10 hard",
    expected: { exerciseName: "machine lateral raise", set: null, load: 15, reps: 10, rir: null, effort: "hard" },
  },
];

for (const { input, expected } of cases) {
  const actual = parseSetCommand(input);
  assert.equal(actual.ok, true, input);
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${input}: ${key}`);
}

console.log(`quick-capture parser: ${cases.length} cases passed`);
