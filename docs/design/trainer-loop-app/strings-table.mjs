// Writes strings.md: every proposed string in EN and PT, grouped by slice, for owner approval.
//   node docs/design/trainer-loop-app/strings-table.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NEW, EXISTING } from "./strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const en = JSON.parse(readFileSync(join(root, "i18n-en.json"), "utf8")), pt = JSON.parse(readFileSync(join(root, "i18n-pt.json"), "utf8"));
const cell = (s) => s.replaceAll("|", "\\|");
const groups = [
  ["Slice 2 · sharing a program through the relay", (k) => k.startsWith("relay.share.") || k === "relay.retry"],
  ["Slice 2 · opening a relay link (the first-run gate, and the same errors for an existing client)", (k) => k.startsWith("relay.gate.") || k.startsWith("relay.open.") || k === "relay.message_from"],
  ["Slice 3 · program update", (k) => k.startsWith("relay.update.")],
  ["Slice 4 · sending your sessions", (k) => k.startsWith("relay.send.")],
];
let out = "# Trainer loop · proposed strings (EN and PT)\n\nGenerated from `strings.mjs` by `strings-table.mjs`; edit the source, not this file. Keys are working names: the slice that ships a string gives it its final i18n key. Every string below is new and needs approval. `{name}` is the trainer's display name (first name in titles and buttons), `{program}` the program's name, `{date}` a localized date.\n";
let count = 0;
for (const [title, test] of groups) {
  const keys = Object.keys(NEW).filter(test);
  out += `\n## ${title}\n\n| Key | EN | PT |\n| --- | --- | --- |\n`;
  for (const k of keys) { out += `| \`${k}\` | ${cell(NEW[k][0])} | ${cell(NEW[k][1])} |\n`; count++; }
}
if (count !== Object.keys(NEW).length) throw new Error("a string is in no group");
out += `\n## Existing strings reused unchanged\n\n| Key | EN | PT |\n| --- | --- | --- |\n`;
for (const k of EXISTING) out += `| \`${k}\` | ${cell(en[k])} | ${cell(pt[k])} |\n`;
writeFileSync(join(here, "strings.md"), out);
console.log(`${count} new strings, ${EXISTING.length} reused`);
