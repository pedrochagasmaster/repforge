/**
 * Regression for the setup-link payload arbitrary's trim-aware uniqueness.
 *
 * The production schema trims priority-muscle labels before rejecting
 * duplicates. This replay keeps the original suite seed so a generator that
 * deduplicates only the untrimmed labels goes red at the original path.
 */
import assert from "node:assert/strict";
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary } from "../arbitraries/setup-payload.mjs";

const { Setup } = loadDomain();
const options = loadDomain().opts();

fc.assert(
  fc.property(payloadArbitrary(), (payload) => {
    const checked = Setup.validate(payload, options);
    assert.equal(checked.ok, true, checked.ok ? "" : checked.issues.join(", "));
  }),
  {
    numRuns: 300,
    seed: 1210005925,
    endOnFailure: true,
  },
);

console.log("setup-link priority-muscle arbitrary regression passed");
