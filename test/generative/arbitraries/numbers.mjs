/**
 * Boundary-biased numeric arbitraries.
 *
 * Generated values deliberately cluster on the boundaries a schema cares
 * about (min, min+1, max-1, max) instead of relying on uniform randomness,
 * because uniform draws almost never land on an edge.
 */
import fc from "fast-check";

export function intIn(min, max) {
  const edges = [...new Set([min, min + 1, max - 1, max])].filter((n) => n >= min && n <= max);
  return fc.oneof(
    { weight: 3, arbitrary: fc.integer({ min, max }) },
    ...edges.map((edge) => ({ weight: 1, arbitrary: fc.constant(edge) })),
  );
}

/** Small counts (sets, days, exercises) with heavy low-end bias. */
export function smallCount(max = 8) {
  return fc.oneof(
    { weight: 5, arbitrary: fc.integer({ min: 1, max: 3 }) },
    { weight: 2, arbitrary: fc.integer({ min: 4, max }) },
  );
}

/** Finite doubles including extremes and subnormals — still JSON-safe. */
export function finiteDouble(min = -1e308, max = 1e308) {
  return fc.oneof(
    { weight: 4, arbitrary: fc.double({ min, max, noNaN: true, noDefaultInfinity: true }) },
    { weight: 1, arbitrary: fc.constantFrom(0.5, 1.25, -0.5, 5e-324, 1e308, -1e308, 9007199254740991) },
  );
}

/**
 * Values that must be rejected by any numeric schema slot: non-finite
 * floats, out-of-range magnitudes, numeric strings and container junk.
 * Never mixed into generators that build valid state.
 */
export function hostileNumber() {
  return fc.oneof(
    { weight: 2, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity) },
    { weight: 2, arbitrary: fc.constantFrom(-0, -1, -1000, 1e309, -1e309, 2 ** 53 + 1) },
    { weight: 2, arbitrary: fc.constantFrom("42", "", " 3", true, null) },
    { weight: 1, arbitrary: fc.constantFrom({}, [], [42], { value: 1 }) },
    { weight: 1, arbitrary: fc.integer({ min: 10001, max: 1e9 }) },
  );
}
