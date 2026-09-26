/* Prints the table of new strings (every PT/EN pair that is not a shipped
   i18n key) used by D, E, F and G, and rewrites it into README.md between
   the strings-table markers. Pure Node; no browser needed.

     node docs/design/main-screen-directions/checks/strings-table.mjs */
import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import vm from "vm";

const here = new URL(".", import.meta.url);
const root = new URL("../../../../", import.meta.url);
const require = createRequire(import.meta.url);

const noop = () => {};
const doc = { createElement: () => ({}), head: { appendChild: noop } };
const win = { navigator: { language: "pt" } };
const ctx = { window: win, document: doc, Intl, Math, Date, Object, Array, String, Number, JSON, Map, Set, Error, encodeURIComponent };
vm.createContext(ctx);
win.RepForgeI18n = require(new URL("i18n.js", root).pathname);
win.RepForgeProgression = require(new URL("progression-engine.js", root).pathname);
for (const f of ["data.js", "data-d.js", "kit.js", "kit-d.js", "dir-d.js", "dir-e.js", "dir-f.js", "dir-g.js"]) {
  vm.runInContext(readFileSync(new URL("../" + f, here), "utf8"), ctx, { filename: f });
}
const NEW = win.DX.NEW;
const owner = (k) => ({ d: "D, E, F, G", e: "E", f: "F", g: "G" }[k[0]]);
const cell = (s) => s.replace(/\|/g, "\\|");
const rows = Object.keys(NEW).map((k) => `| \`${k}\` | ${owner(k)} | ${cell(NEW[k][0])} | ${cell(NEW[k][1])} |`);
const table = `| Key | Used by | PT | EN |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;

const readme = new URL("../README.md", here);
const text = readFileSync(readme, "utf8");
const a = "<!-- strings-table:start -->", b = "<!-- strings-table:end -->";
if (text.includes(a)) {
  writeFileSync(readme, text.slice(0, text.indexOf(a) + a.length) + "\n" + table + "\n" + text.slice(text.indexOf(b)));
}
console.log(`${Object.keys(NEW).length} new strings`);
