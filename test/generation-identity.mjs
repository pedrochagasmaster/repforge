#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const Identity = require("../generation-identity.js");
const hash = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const catalog = () => ({ generatedAt: "one", exercises: [{ id: "b", name: "B" }, { id: "a", name: "A" }],
  uuidIndex: { b: { equipment: ["one", "two"] }, a: { movementPattern: ["push", "pull"] } } });
const canonicalCatalogText = '{"exercises":[{"id":"a","name":"A"},{"id":"b","name":"B"}],"uuidIndex":{"a":{"movementPattern":["push","pull"]},"b":{"equipment":["one","two"]}}}';

test("canonical JSON sorts keys, preserves semantic arrays and does not mutate", () => {
  const value = { z: [3, { b: 2, a: "é😀" }, null], a: true, "10": 10, "2": 2 };
  const before = structuredClone(value);
  assert.equal(Identity.canonicalJSON(value), '{"10":10,"2":2,"a":true,"z":[3,{"a":"é😀","b":2},null]}');
  assert.deepEqual(value, before);
  assert.notEqual(Identity.canonicalJSON(["one", "two"]), Identity.canonicalJSON(["two", "one"]));
  const shared = { b: 1 };
  assert.equal(Identity.canonicalJSON([shared, shared]), '[{"b":1},{"b":1}]');
});

test("non-JSON data rejects instead of silently changing the identity preimage", () => {
  const cycle = {}; cycle.self = cycle;
  const sparse = []; sparse.length = 1;
  const symbolKey = { a: 1 }; symbolKey[Symbol("private")] = 2;
  const hidden = {}; Object.defineProperty(hidden, "a", { value: undefined });
  const getter = {}; Object.defineProperty(getter, "a", { enumerable: true, get() { throw Error("getter executed"); } });
  for (const value of [undefined, NaN, Infinity, -Infinity, 1n, () => 1, Symbol("x"), new Date(),
    { a: undefined }, [undefined], sparse, cycle, symbolKey, getter, hidden]) {
    assert.throws(() => Identity.canonicalJSON(value), { name: "TypeError" });
  }
});

test("catalog identity ignores generation timestamps and catalogue container order only", () => {
  const source = catalog(), before = structuredClone(source);
  assert.equal(Identity.catalogIdentity(source), hash(canonicalCatalogText));
  const reordered = { uuidIndex: { a: source.uuidIndex.a, b: source.uuidIndex.b }, exercises: [...source.exercises].reverse(), generatedAt: "two" };
  assert.equal(Identity.catalogIdentity(reordered), Identity.catalogIdentity(source));
  for (const mutate of [c => c.uuidIndex.a.movementPattern.reverse(), c => c.uuidIndex.b.equipment.reverse(),
    c => { c.exercises[0].name = "changed"; }, c => { c.uuidIndex.a.newRule = true; }]) {
    const changed = catalog(); mutate(changed);
    assert.notEqual(Identity.catalogIdentity(changed), Identity.catalogIdentity(source));
  }
  assert.deepEqual(source, before);
  const initial = Identity.catalogIdentity(source);
  source.uuidIndex.a.movementPattern.push("new");
  assert.notEqual(Identity.catalogIdentity(source), initial, "mutable object identity must not cache stale catalogue content");
});

test("generation identity matches Node SHA-256 across Unicode and padding boundaries", () => {
  for (let n = 0; n <= 160; n++) {
    const request = { value: "a".repeat(n) + "é😀\ud800", list: [1, true, null] };
    const expected = hash(JSON.stringify({ catalogIdentity: hash(canonicalCatalogText), generatorVersion: "073.1",
      request: { list: [1, true, null], value: request.value }, requestVersion: 1 }));
    assert.equal(Identity.generationIdentity(request, catalog(), "073.1"), expected, `UTF-8/padding vector ${n}`);
  }
});

test("request and version changes affect identity while object-key order does not", () => {
  const request = { b: ["x", "y"], a: 1 }, source = catalog(), before = structuredClone({ request, source });
  const id = Identity.generationIdentity(request, source, "073.1");
  assert.equal(Identity.generationIdentity({ a: 1, b: ["x", "y"] }, source, "073.1"), id);
  assert.notEqual(Identity.generationIdentity({ a: 2, b: ["x", "y"] }, source, "073.1"), id);
  assert.notEqual(Identity.generationIdentity({ a: 1, b: ["y", "x"] }, source, "073.1"), id);
  assert.notEqual(Identity.generationIdentity(request, source, "073.2"), id);
  assert.deepEqual({ request, source }, before);
});

test("explicit preparation deeply freezes and reuses only the prepared catalogue identity", () => {
  let inspections = 0;
  const source = new Proxy(catalog(), { ownKeys(target) { inspections++; return Reflect.ownKeys(target); } });
  const before = Identity.catalogIdentity(source);
  assert.equal(Identity.prepareCatalog(source), source);
  assert.ok(Object.isFrozen(source));
  assert.ok(Object.isFrozen(source.exercises));
  assert.ok(Object.isFrozen(source.exercises[0]));
  assert.ok(Object.isFrozen(source.uuidIndex.a.movementPattern));
  assert.throws(() => source.uuidIndex.a.movementPattern.push("changed"), TypeError);
  const afterPreparation = inspections;
  assert.equal(Identity.catalogIdentity(source), before);
  assert.equal(Identity.prepareCatalog(source), source);
  assert.equal(Identity.catalogIdentity(source), before);
  assert.equal(inspections, afterPreparation, "repeated prepared identities do not inspect or serialize catalogue content");
});

test("catalogue normalization rejects non-JSON array properties before copying", () => {
  const source = catalog();
  source.exercises.hidden = undefined;
  assert.throws(() => Identity.catalogIdentity(source), TypeError);
});

// Digest collisions cannot be produced reliably through the browser. Inject a
// failing digest here to prove local collision handling before implementation.
test("ID allocator retains the complete generation namespace and bounds arbitrary semantic paths", () => {
  const namespace = "a".repeat(64);
  const allocate = Identity.createIdAllocator(namespace);
  const path = "week/slot/" + "é😀/".repeat(1000);
  const expected = namespace + "." + hash(Identity.canonicalJSON({ namespace, path })).slice(0, 8);
  assert.equal(allocate(path), expected);
  assert.equal(allocate(path), expected);
  assert.equal(allocate(path).length, 73);
  assert.ok(allocate("another/path").startsWith(namespace + "."));
  assert.notEqual(allocate(path), allocate("another/path"));
  assert.ok(Identity.createIdAllocator("other")(path).startsWith(Identity.digestCanonical("other") + "."));
  assert.notEqual(allocate(path), Identity.createIdAllocator("other")(path));
  assert.equal(Identity.digestCanonical({ b: 2, a: 1 }), hash('{"a":1,"b":2}'));
});

test("ID allocator resolves injected digest collisions locally and deterministically", () => {
  const digest = () => "f".repeat(64);
  const run = () => {
    const allocate = Identity.createIdAllocator("namespace", { digest });
    const ids = Array.from({ length: 200 }, (_, i) => allocate(`slot/${i}`));
    assert.equal(new Set(ids).size, 200);
    const base = Identity.digestCanonical("namespace") + "." + "f".repeat(8);
    assert.equal(ids[0], base);
    assert.equal(ids[1], base + "_1");
    assert.equal(allocate("slot/0"), ids[0]);
    assert.equal(allocate("slot/199"), ids[199]);
    assert.ok(ids.every(id => `slot-${id}`.length <= 96));
    return ids;
  };
  assert.deepEqual(run(), run(), "a new generation has no shared collision state");
  assert.throws(() => Identity.createIdAllocator("namespace", { digest: () => "short" })("slot"), TypeError);
});
