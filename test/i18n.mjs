#!/usr/bin/env node
/**
 * Locale parity checks: JSON duplicate keys, EN/PT JSON ↔ i18n.js dictionaries,
 * HTML data-i18n key coverage, and placeholder-name sets.
 *
 * Step 9 extends this with JS t()/tp() family expansion and populated-view
 * raw-key fallback instrumentation.
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "i18n.js"));

let passed = 0;
let failed = 0;
function assert(cond, name, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    ${detail}`);
  }
}

function findDuplicateKeys(text, filename) {
  const dups = [];
  let i = 0;
  const n = text.length;
  const skipWs = () => {
    while (i < n && /[ \t\n\r]/.test(text[i])) i++;
  };
  const parseString = () => {
    if (text[i] !== '"') throw new Error(`${filename}: expected string at ${i}`);
    i++;
    let s = "";
    while (i < n) {
      const c = text[i++];
      if (c === '"') return s;
      if (c === "\\") {
        const e = text[i++];
        if (e === "u") {
          s += String.fromCharCode(parseInt(text.slice(i, i + 4), 16));
          i += 4;
        } else s += e;
      } else s += c;
    }
    throw new Error(`${filename}: unterminated string`);
  };
  const parseValue = () => {
    skipWs();
    const c = text[i];
    if (c === '"') {
      parseString();
      return;
    }
    if (c === "{") {
      parseObject();
      return;
    }
    if (c === "[") {
      parseArray();
      return;
    }
    while (i < n && /[^\s,\]}]/.test(text[i])) i++;
  };
  const parseObject = () => {
    i++;
    const seen = new Set();
    skipWs();
    if (text[i] === "}") {
      i++;
      return;
    }
    while (i < n) {
      skipWs();
      const key = parseString();
      if (seen.has(key)) dups.push({ file: filename, key });
      seen.add(key);
      skipWs();
      if (text[i] !== ":") throw new Error(`${filename}: expected ':' after ${key}`);
      i++;
      parseValue();
      skipWs();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "}") {
        i++;
        return;
      }
      throw new Error(`${filename}: expected ',' or '}' in object (at ${i})`);
    }
  };
  const parseArray = () => {
    i++;
    skipWs();
    if (text[i] === "]") {
      i++;
      return;
    }
    while (i < n) {
      parseValue();
      skipWs();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "]") {
        i++;
        return;
      }
      throw new Error(`${filename}: expected ',' or ']' in array (at ${i})`);
    }
  };
  skipWs();
  parseValue();
  return dups;
}

function placeholders(s) {
  return [...new Set(String(s ?? "").match(/\{(\w+)\}/g) || [])].sort();
}

function htmlI18nKeys(html) {
  const keys = new Set();
  const re = /data-i18n(?:-aria|-placeholder|-title)?="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) keys.add(m[1]);
  return [...keys].sort();
}

console.log("\ni18n parity");

const enPath = join(ROOT, "i18n-en.json");
const ptPath = join(ROOT, "i18n-pt.json");
const enText = readFileSync(enPath, "utf8");
const ptText = readFileSync(ptPath, "utf8");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const enDups = findDuplicateKeys(enText, "i18n-en.json");
const ptDups = findDuplicateKeys(ptText, "i18n-pt.json");
assert(enDups.length === 0, "i18n-en.json has no duplicate keys", enDups.map((d) => d.key).join(", "));
assert(ptDups.length === 0, "i18n-pt.json has no duplicate keys", ptDups.map((d) => d.key).join(", "));

const en = JSON.parse(enText);
const pt = JSON.parse(ptText);
const enKeys = Object.keys(en).sort();
const ptKeys = Object.keys(pt).sort();
assert(enKeys.length === ptKeys.length && enKeys.every((k, i) => k === ptKeys[i]), "EN/PT JSON key sets match", `en=${enKeys.length} pt=${ptKeys.length}`);

const I18N = require(join(ROOT, "i18n.js"));
const enRt = I18N.STRINGS.en;
const ptRt = I18N.STRINGS.pt;
assert(typeof enRt === "object" && typeof ptRt === "object", "i18n.js exports EN/PT dictionaries");

const missingEnRt = enKeys.filter((k) => !(k in enRt));
const extraEnRt = Object.keys(enRt).filter((k) => !(k in en));
const valEn = enKeys.filter((k) => k in enRt && en[k] !== enRt[k]);
assert(missingEnRt.length === 0 && extraEnRt.length === 0 && valEn.length === 0, "EN JSON matches runtime dictionary", `missing=${missingEnRt.slice(0, 8)} extra=${extraEnRt.slice(0, 8)} values=${valEn.slice(0, 8)}`);

const missingPtRt = ptKeys.filter((k) => !(k in ptRt));
const extraPtRt = Object.keys(ptRt).filter((k) => !(k in pt));
const valPt = ptKeys.filter((k) => k in ptRt && pt[k] !== ptRt[k]);
assert(missingPtRt.length === 0 && extraPtRt.length === 0 && valPt.length === 0, "PT JSON matches runtime dictionary", `missing=${missingPtRt.slice(0, 8)} extra=${extraPtRt.slice(0, 8)} values=${valPt.slice(0, 8)}`);

const phMismatch = enKeys.filter((k) => placeholders(en[k]).join() !== placeholders(pt[k]).join());
assert(phMismatch.length === 0, "EN/PT placeholder names match per key", phMismatch.slice(0, 8).join(", "));

const domKeys = htmlI18nKeys(html);
const missingDomEn = domKeys.filter((k) => !(k in en));
const missingDomPt = domKeys.filter((k) => !(k in pt));
assert(missingDomEn.length === 0, "index.html data-i18n keys exist in EN", missingDomEn.join(", "));
assert(missingDomPt.length === 0, "index.html data-i18n keys exist in PT", missingDomPt.join(", "));

console.log(`\ni18n tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
