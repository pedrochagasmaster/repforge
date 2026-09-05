#!/usr/bin/env node
/* Rewrites i18n.js from i18n-en.json, i18n-pt.json, and i18n-runtime.js.

   Usage: node tools/build-i18n.mjs [--check] */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(ROOT, "i18n.js");
const src = readFileSync(target, "utf8");
const runtime = readFileSync(join(ROOT, "tools", "i18n-runtime.js"), "utf8").trimEnd();

const render = (name, obj) =>
  `const ${name} = {\n` +
  Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n") +
  `\n};`;

const en = JSON.parse(readFileSync(join(ROOT, "i18n-en.json"), "utf8"));
const pt = JSON.parse(readFileSync(join(ROOT, "i18n-pt.json"), "utf8"));
const out = [
  "// Taurifer i18n — English / Portuguese UI strings.",
  "// Generated from i18n-en.json + i18n-pt.json + tools/i18n-runtime.js; edit those and regenerate.",
  render("EN", en),
  render("PT", pt),
  runtime,
  "",
].join("\n");

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
