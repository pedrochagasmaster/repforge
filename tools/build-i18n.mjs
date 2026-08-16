#!/usr/bin/env node
/* Rewrites the EN and PT dictionaries inside i18n.js from i18n-en.json and
   i18n-pt.json.

   The header already said i18n.js was generated from those two files, but the
   regeneration was manual — three files hand-edited in step, which is exactly
   the drift test/i18n.mjs exists to catch. This does the mechanical half.

   Only the two dictionary literals are replaced; the runtime below them (t, tp,
   applyDom, the RepForgeI18n export) is left untouched.

   Usage: node tools/build-i18n.mjs [--check] */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(ROOT, "i18n.js");
const src = readFileSync(target, "utf8");

const dict = name => {
  const open = `const ${name} = {`;
  const start = src.indexOf(open);
  if (start < 0) throw new Error(`${name} dictionary not found in i18n.js`);
  const end = src.indexOf("\n};", start);
  if (end < 0) throw new Error(`${name} dictionary is unterminated`);
  return { start, end: end + "\n};".length, open };
};

const render = (name, obj) =>
  `const ${name} = {\n` +
  Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n") +
  `\n};`;

const en = JSON.parse(readFileSync(join(ROOT, "i18n-en.json"), "utf8"));
const pt = JSON.parse(readFileSync(join(ROOT, "i18n-pt.json"), "utf8"));

const enSpan = dict("EN");
const ptSpan = dict("PT");
if (ptSpan.start < enSpan.start) throw new Error("expected EN before PT in i18n.js");

// Rebuilt back to front so the first splice cannot move the second offset.
let out = src.slice(0, ptSpan.start) + render("PT", pt) + src.slice(ptSpan.end);
out = out.slice(0, enSpan.start) + render("EN", en) + out.slice(enSpan.end);

if (process.argv.includes("--check")) {
  if (out !== src) {
    console.error("i18n.js is stale — run: node tools/build-i18n.mjs");
    process.exit(1);
  }
  console.log(`i18n.js matches the catalogs (${Object.keys(en).length} keys)`);
  process.exit(0);
}

writeFileSync(target, out);
console.log(`i18n.js — ${Object.keys(en).length} EN / ${Object.keys(pt).length} PT keys`);
