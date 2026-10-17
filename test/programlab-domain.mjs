#!/usr/bin/env node
// Isolation is needed for malformed JSON, exact identity preimages, bounded
// combinatorics and injected executor/checkpoint races (PL-10 through PL-15).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const Domain = require("../programlab/domain.js");

test("lab snapshots share canonical identity and reject hostile/non-data inputs", () => {
  const source = { z: [-0, "é😀"], a: { b: 2, a: 1 } };
  const text = '{"a":{"a":1,"b":2},"z":[0,"é😀"]}';
  assert.equal(Domain.canonicalJSON(source), text);
  assert.equal(Domain.digest(source), createHash("sha256").update(text).digest("hex"));
  const copy = Domain.snapshot(source);
  source.a.a = 5;
  assert.equal(copy.a.a, 1);
  assert.ok(Object.isFrozen(copy.a));
  assert.throws(() => Domain.snapshot(JSON.parse('{"__proto__":{}}')));
  assert.throws(() => Domain.snapshot({ x: Infinity }));
  let nested = null; for (let i = 0; i < 41; i++) nested = [nested];
  assert.throws(() => Domain.snapshot(nested), /depth/);
  const getter = {}; Object.defineProperty(getter, "x", { enumerable: true, get() { throw Error("executed"); } });
  assert.throws(() => Domain.snapshot(getter), /data|accessor/);
});
