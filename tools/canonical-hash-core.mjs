// Prototype-safe deep clone and canonical JSON shared by the Phase 0 hash
// helpers. Own-property cloning via Object.hasOwn prevents __proto__/
// constructor-style prototype pollution, and the canonical serializer emits
// only own enumerable properties, so a hostile "__proto__" key can never
// change a digest.
export function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const k of Object.keys(value)) {
    if (!Object.hasOwn(value, k)) continue;
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      throw new TypeError(`canonical hash: dangerous key "${k}" rejected`);
    }
    out[k] = deepClone(value[k]);
  }
  return out;
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}
