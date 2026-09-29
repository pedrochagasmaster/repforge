#!/usr/bin/env node
/**
 * Self-host a Google Fonts family for a Round 4 candidate (design
 * exploration only; nothing here ships in the app). Downloads the latin and
 * latin-ext woff2 files for the requested weights/styles into
 * round-4/fonts/<slug>/ and writes <slug>.css with @font-face rules that
 * point at the local files, plus PROVENANCE.txt (source URLs, date). Google
 * Fonts serves OFL / Apache-licensed families; check the family's licence on
 * fonts.google.com before shipping anything beyond the harness.
 *
 * Usage: node tools/fetch-font.mjs "Jost" "400;500;700;900" [--italic]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const [family, weights = "400;700", ...rest] = process.argv.slice(2);
if (!family) { console.error('usage: fetch-font.mjs "Family Name" "400;700" [--italic]'); process.exit(1); }
const italic = rest.includes("--italic");
const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "round-4", "fonts", slug);
mkdirSync(out, { recursive: true });
const axis = italic ? `ital,wght@${weights.split(";").map((w) => `0,${w}`).concat(weights.split(";").map((w) => `1,${w}`)).join(";")}` : `wght@${weights}`;
const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:${axis}&display=swap`;
/* A modern UA gets woff2 with unicode-range subsets. */
const css = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" } })).text();
if (!css.includes("@font-face")) { console.error("no @font-face in response:\n" + css.slice(0, 400)); process.exit(1); }
const blocks = css.split("/*").slice(1).map((b) => ({ subset: b.slice(0, b.indexOf("*/")).trim(), body: b.slice(b.indexOf("*/") + 2) }));
const keep = blocks.filter((b) => b.subset === "latin" || b.subset === "latin-ext");
let local = `/* ${family}: self-hosted from Google Fonts for the Round 4 harness. See PROVENANCE.txt. */\n`;
const prov = [`${family}`, `Fetched ${new Date().toISOString()} from ${url}`, `Licence: see https://fonts.google.com/specimen/${encodeURIComponent(family).replace(/%20/g, "+")}/license`, ""];
let n = 0;
for (const b of keep) {
  const src = b.body.match(/url\((https:[^)]+)\)/)[1];
  const style = (b.body.match(/font-style:\s*(\w+)/) || [])[1] || "normal";
  const weight = (b.body.match(/font-weight:\s*([\d ]+)/) || [])[1] || "400";
  const file = `${slug}-${weight.replace(/ /g, "-")}-${style}-${b.subset}.woff2`;
  const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
  writeFileSync(join(out, file), buf); n++;
  prov.push(`${file} <- ${src}`);
  local += b.body.replace(/url\(https:[^)]+\)/, `url("${file}")`).replace(/^\s*\n/, "");
}
writeFileSync(join(out, `${slug}.css`), local);
writeFileSync(join(out, "PROVENANCE.txt"), prov.join("\n") + "\n");
console.log(`${family}: ${n} files into round-4/fonts/${slug}/ (link ../fonts/${slug}/${slug}.css from a candidate)`);
