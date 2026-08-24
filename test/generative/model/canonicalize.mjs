/**
 * Test-side semantic comparison utilities.
 *
 * Deliberately independent of shared-setup.js `canonicalize` so the properties
 * never trust the implementation under test to define its own oracle.
 */

export function stableStringify(value) {
  return stringifyValue(value, "", 0);
}

function stringifyValue(value, indent, depth) {
  if (depth > 512) throw new TypeError("structure too deep");
  if (value === null) return "null";
  const type = typeof value;
  if (type === "string") return JSON.stringify(value);
  if (type === "boolean") return value ? "true" : "false";
  if (type === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`non-finite number: ${value}`);
    if (Object.is(value, -0)) return "-0";
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${indent}  ${stringifyValue(item, `${indent}  `, depth + 1)}`);
    return `[\n${items.join(",\n")}\n${indent}]`;
  }
  if (type === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError("exotic object");
    const keys = Object.keys(value).sort();
    if (keys.length === 0) return "{}";
    const fields = keys.map(
      (key) => `${indent}  ${JSON.stringify(key)}: ${stringifyValue(value[key], `${indent}  `, depth + 1)}`,
    );
    return `{\n${fields.join(",\n")}\n${indent}}`;
  }
  throw new TypeError(`unsupported type: ${type}`);
}

export function deepEqual(a, b) {
  try {
    return stableStringify(a) === stableStringify(b);
  } catch {
    return false;
  }
}

/** Every own-key position (object field or array slot) as a mutable path of segments. */
export function jsonPaths(value, limit = 2000) {
  const paths = [];
  const stack = [[[], value]];
  while (stack.length) {
    const [path, node] = stack.pop();
    if (path.length) paths.push(path);
    if (paths.length >= limit) break;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push([[...path, i], node[i]]);
    } else if (isPlainObject(node)) {
      for (const key of Object.keys(node).reverse()) stack.push([[...path, key], node[key]]);
    }
  }
  return paths;
}

export function getPath(value, path) {
  let node = value;
  for (const segment of path) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[segment];
  }
  return node;
}

export function clone(value) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) out[key] = clone(value[key]);
  return out;
}

export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** True when the value contains a leaf JSON cannot represent. */
export function containsPoisonLeaf(value) {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return true;
  if (typeof value === "number" && !Number.isFinite(value)) return true;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return value.some(containsPoisonLeaf);
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (containsPoisonLeaf(value[key])) return true;
    }
  } else if (typeof value === "object" && value !== null) {
    return true;
  }
  return false;
}

/** True when any reachable number is NaN or infinite. */
export function containsNonFiniteNumber(value) {
  if (typeof value === "number") return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(containsNonFiniteNumber);
  if (isPlainObject(value)) {
    return Object.keys(value).some((key) => containsNonFiniteNumber(value[key]));
  }
  return false;
}

export function containsText(value, needle) {
  if (typeof value === "string") return value.includes(needle);
  if (Array.isArray(value)) return value.some((entry) => containsText(entry, needle));
  if (isPlainObject(value)) {
    return Object.keys(value).some(
      (key) => key.includes(needle) || containsText(value[key], needle),
    );
  }
  return false;
}

export function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
