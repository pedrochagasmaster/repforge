import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

function audit(source) {
  assert.doesNotMatch(source, /\b(?:setLogMode|syncLogModeControls|setRowHtml)\b|\.setrow\b|\.sets__head\b|workout\/list/,
    "retired List ownership must not return");
  assert.doesNotMatch(source, /__repforgeEnterWorkout\s*\(\s*\{[^}]*\bfocus\s*:/,
    "workout callers must not retain a legacy route option");
}

for (const file of ["app.js", "styles.css", "motion-polish.css", "tools/ui-screens/screens-app.mjs"]) {
  audit(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
}
for (const file of readdirSync(new URL("./",import.meta.url))) {
  if(file.endsWith(".mjs") && file!=="focus-only-source.mjs") {
    let source=readFileSync(new URL(file,import.meta.url),"utf8");
    if(file==="workout-draft-sw-upgrade.mjs") {
      const retained=/window\.__repforgeEnterWorkout\(\{ day: "Day 1", focus: true \}\)/g;
      assert.equal(source.match(retained)?.length,1,"only the retained Plan 050 worker keeps its historical route flag");
      source=source.replace(retained,"window.__repforgeEnterWorkout({ day: \"Day 1\" })");
    }
    audit(source);
  }
}
audit(readFileSync(new URL("../docs/ui-screens/manifest.json",import.meta.url),"utf8"));
assert.throws(() => audit('function setRowHtml() { return "<div class=\"setrow\">"; }'));
assert.throws(() => audit('.setrow { display: grid }'));
audit('function focusCardHtml() { return "<article>"; }');
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /<div hidden inert aria-hidden="true" id="legacyWorkoutShell">/);
assert.doesNotMatch(html, /<button[^>]+id="mode(?:Full|Focus)"/);
console.log("Focus-only source ownership and deliberate violations verified");
