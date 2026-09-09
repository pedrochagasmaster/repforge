#!/usr/bin/env node
/* Offline runtime, loading, motion and dialog contracts. Source checks protect
 * integration boundaries; exported behavior protects values and live decisions.
 * No browser, network, or additional dependencies. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(ROOT, file), "utf8");
const runtime = read("vendor/motion/motion.js");
const pin = JSON.parse(read("vendor/motion/motion.pin.json"));
const dnd = read("vendor/dnd-kit/dnd-kit.js");
const dndPin = JSON.parse(read("vendor/dnd-kit/dnd-kit.pin.json"));
const layer = read("motion-layer.js");
const app = read("app.js");
const editor = read("program-editor.js");
const index = read("index.html");
const sw = read("sw.js");
const polish = read("motion-polish.css");
const notice = read("NOTICE.md");
const styles = read("styles.css");
let passed = 0, failed = 0;
function assert(condition, name, detail = "") {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

// Evaluate the actual public layer, not a regex-extracted private declaration.
function loadLayer(source) {
  const query = { matches: false };
  let mediaCalls = 0, stops = 0;
  const sandbox = {
    document: { readyState: "loading", getElementById: () => null, createElement: () => ({}), head: { append() {} }, addEventListener() {} },
    setInterval: () => 1, clearInterval() {},
    matchMedia(value) { assert(value === "(prefers-reduced-motion: reduce)", "the live preference query is reduced motion"); mediaCalls++; return query; },
    Motion: {
      animate: () => Promise.resolve(),
      motionValue(initial) {
        let value = initial;
        return { get: () => value, set: (next) => { value = next; }, stop: () => { stops++; }, on: () => () => {} };
      },
    },
  };
  vm.runInNewContext(source, sandbox, { filename: "motion-layer.js", timeout: 1000 });
  return { api: sandbox.RepForgeMotion, query, mediaCalls: () => mediaCalls, stops: () => stops };
}
const motion = loadLayer(layer);

console.log("vendored runtimes");
for (const [label, bundle, meta, file] of [
  ["Motion", runtime, pin, "vendor/motion/motion.js"],
  ["@dnd-kit", dnd, dndPin, "vendor/dnd-kit/dnd-kit.js"],
]) {
  assert(/^\d+\.\d+\.\d+$/.test(meta.version) && /^\d+\.\d+\.\d+$/.test(meta.esbuild), `${label} pins exact package and bundler versions`);
  assert(createHash("sha256").update(bundle, "utf8").digest("hex") === meta.sha256, `the committed ${label} bundle hashes to its pin`);
  assert(bundle.startsWith(`/* ${meta.package} ${meta.version} —`), `${label} names its build version`);
  let parses = true;
  try { execFileSync(process.execPath, ["--check", join(ROOT, file)], { stdio: "pipe" }); } catch { parses = false; }
  assert(parses, `${label} is syntactically valid browser JavaScript`);
}
{
  let checked = true;
  try { execFileSync(process.execPath, [join(ROOT, "tools/build-vendor-runtimes.mjs"), "--check"], { stdio: "pipe" }); } catch { checked = false; }
  assert(checked, "the offline build check agrees with both committed bundles");
}
assert(!/https?:\/\/(cdn|unpkg|esm|jsdelivr)/i.test(index) && !/import\s*\(["']https?:/.test(layer), "nothing loads a runtime from a CDN");
assert(!/\bfetch\s*\(|\bimport\s*\(/.test(layer), "the integration layer resolves no module and issues no request");
assert(notice.includes("Motion animation runtime") && notice.includes("Copyright (c) 2018 Framer B.V.") && notice.includes("Drag and drop") && notice.includes("@dnd-kit/dom"), "both runtimes carry MIT attribution");

{
  const revision = sw.match(/\bCACHE\s*=\s*["']repforge-v(\d+)["']/)?.[1] || "";
  assert(sw.includes('"./vendor/motion/motion.js"') && sw.includes('"./motion-layer.js"'), "the runtime and layer are atomically precached");
  assert(sw.includes(`"./motion-layer.js?v=${revision}"`) && index.includes(`src="motion-layer.js?v=${revision}"`), "the layer is coupled to the cache revision", revision);
  const shell = sw.match(/\bSHELL\s*=\s*new\s+Set\s*\(\s*(\[[\s\S]*?\])\s*\)/)?.[1] || "[]";
  const paths = vm.runInNewContext(shell, {}, { timeout: 1000 });
  assert(paths.includes("/vendor/motion/motion.js") && paths.includes("/motion-layer.js"), "both files belong to the installed offline shell");
  const runtimeAt = index.indexOf('src="vendor/motion/motion.js"');
  const layerAt = index.indexOf('src="motion-layer.js?v=');
  const editorAt = index.indexOf('src="program-editor.js?v=');
  const appAt = index.indexOf('src="app.js?v=');
  assert(runtimeAt > 0 && runtimeAt < layerAt && layerAt < editorAt && layerAt < appAt, "runtime precedes layer, which precedes its callers");
}
{
  const leaks = Object.entries({ "app.js": app, "program-editor.js": editor })
    .filter(([, source]) => /\bwindow\.Motion\b|\broot\.Motion\b|(?<![\w.])Motion\.animate\b/.test(source)).map(([file]) => file);
  assert(leaks.length === 0, "application modules do not bypass the Motion layer", leaks.join(", "));
  assert(/RepForgeMotion/.test(app) && /RepForgeMotion/.test(editor), "callers use RepForgeMotion");
}
{
  const vocabulary = motion.api.vocabulary;
  assert(vocabulary && typeof vocabulary === "object", "one named motion vocabulary is exposed");
  for (const name of ["gestureSettle", "gestureExit", "layoutShift", "revealIn", "revealOut"]) {
    assert(Object.hasOwn(vocabulary, name), `the vocabulary names ${name}`);
  }
  const values = Object.values(vocabulary);
  const durations = values.filter((v) => Object.hasOwn(v, "duration")).map((v) => v.duration);
  assert(durations.length === 2 && durations.every((d) => Number.isFinite(d) && d <= 0.3), "both tweens stay within 300ms");
  const springs = values.filter((v) => v.type === "spring");
  assert(springs.length === 3 && springs.every((s) => s.stiffness > 0 && s.damping > 0 && s.mass > 0) && values.every((v) => !Object.hasOwn(v, "visualDuration") && !Object.hasOwn(v, "bounce")), "all springs use physics parameters, not duration or bounce");
  const ratios = springs.map((s) => Math.round(s.damping / (2 * Math.sqrt(s.stiffness * s.mass)) * 100) / 100);
  assert(ratios.every((z) => z >= 0.75 && z <= 1.05), "springs are damped between 0.75 and critical", ratios.join(", "));
  assert(springs.every((s) => Number.isFinite(s.restDelta) && s.restDelta > 0), "each spring has a pixel-scale rest threshold");
  const strayLiterals = [...layer.matchAll(/type\s*:\s*["']spring["']/g)].length - springs.length;
  assert(strayLiterals === 0, "no spring literals appear outside the vocabulary");
  assert(!/ease\s*:\s*"?ease-?in"?\s*[,}]/i.test(layer) && !/easeIn[,"']/.test(layer), "nothing enters or exits on ease-in");
  const tinyScales = [...layer.matchAll(/scale\(\$?\{?[^)]*?([0-9]*\.[0-9]+)\)/g)].map((m) => Number(m[1])).filter((v) => v < 0.9);
  assert(tinyScales.length === 0, "no entry grows from a scale below 0.9");
  const reformatted = loadLayer(layer.replace("const VOCABULARY =", "let VOCABULARY\n ="));
  assert(JSON.stringify(reformatted.api.vocabulary) === JSON.stringify(vocabulary), "equivalent declaration formatting does not change the contract");
}
{
  assert(motion.mediaCalls() === 1, "the layer asks the reduced-motion question once");
  assert(motion.api.reducedMotion() === false, "the initial preference is read");
  motion.query.matches = true;
  assert(motion.api.reducedMotion() === true, "a preference change takes effect live");
  motion.query.matches = false;
  for (const entry of ["settle(", "dismiss(", "settleFocusDeck(", "animateExerciseReorder(", "animateDisclosure("]) {
    const body = layer.slice(layer.indexOf(`  ${entry}`) >= 0 ? layer.indexOf(`  ${entry}`) : layer.indexOf(entry));
    assert(/reducedMotion\s*\(\s*\)/.test(body.slice(0, 900)), `${entry} has a reduced-motion alternate`);
  }
}
assert(!/animateSetCompletion|animateLedger|animate\(.*ledger/i.test(layer), "set completion remains a short CSS acknowledgement");
assert(polish.includes(".ledger__row.is-fresh") && polish.includes(".sumsheet.is-played"), "CSS still owns frequent surfaces");
assert(!/\.view\b/.test(layer) && !/\.toast\b/.test(layer) && !/effortpop/.test(layer), "navigation, toasts and effort explanations remain CSS-owned");
{
  const sheet = { offsetHeight: 200, style: { removeProperty() {} } };
  const handle = motion.api.trackSheetGesture(sheet, null);
  handle.cancel(); handle.cancel();
  assert(motion.stops() === 1, "a gesture is disposed only once, regardless of declaration layout");
  assert(/disclosureRuns/.test(layer) && /disclosureRuns\.get\(panel\)\s*!==\s*token/.test(layer), "superseded disclosure runs cannot clear replacement height");
  assert(/\bCOLLAPSING\s*=\s*"is-collapsing"/.test(layer) && /\.settings-panel\.is-collapsing\{display:block\}/.test(styles), "closing panels have a transient display marker");
  assert(/apply\(\);\s*panel\.classList\.toggle\(COLLAPSING/.test(layer), "the disclosure class changes at the tap, allowing reversal");
  assert((layer.match(/hint\([a-zA-Z]+,\s*null\)/g) || []).length >= 5, "layer promotions are removed after animation");
  assert(/rec\.motion/.test(app) && (app.match(/rec\.motion\.cancel\(\)/g) || []).length >= 2, "teardown and interruption cancel the active sheet animation");
}
{
  assert(/if\s*\(sheetDrag\.motion\)\s*sheetDrag\.motion\.follow/.test(app) && /else\s*\{\s*rec\.el\.style\.transform\s*=/.test(app), "sheet gestures retain a no-runtime fallback");
  assert(/if\(run\)\{run\.then\(done\);return\}/.test(app) && /setTimeout\(done,220\)/.test(app), "focus snap-back retains its CSS fallback");
  assert(/function focusAnimateTo\(dir\)\{/.test(app) && /setTimeout\(\(\)=>\{\s*focusFlinging=false/.test(app), "deck carry remains a CSS transition");
  assert(/if\s*\(root\.RepForgeMotion\?\.animateExerciseReorder\(rows,\s*beforeRects\)\)\s*return;/.test(editor) && /program-editor-flip-y/.test(editor), "editor reorder retains FLIP fallback");
  assert(/settle\s*=\s*true/.test(editor) && /moveExercise\(id,\s*day,\s*index,\s*\{\s*settle:\s*false\s*\}\)/.test(editor), "library drags are not animated twice");
  assert(/if\(window\.RepForgeMotion\)window\.RepForgeMotion\.animateDisclosure\(panel,on,show\);\s*else show\(\)/.test(app), "disclosures toggle exactly once with or without Motion");
}
{
  const en = JSON.parse(read("i18n-en.json")), pt = JSON.parse(read("i18n-pt.json"));
  const keys = ["program.editor.drag.instructions", "program.editor.drag.picked_up", "program.editor.drag.over", "program.editor.drag.dropped", "program.editor.drag.cancelled"];
  assert(keys.every((key) => en[key] && pt[key] && en[key] !== pt[key]), "drag announcements are translated");
  assert(/Accessibility\.configure\(\{[\s\S]{0,220}announcements: dragAnnouncements\(\)/.test(editor) && /screenReaderInstructions: \{ draggable: label\("dragInstructions"\) \}/.test(editor), "translated announcements reach the drag library");
  assert(/PointerActivationConstraints\.Delay\(\{ value: 90, tolerance: 10 \}\)/.test(editor) && /event\.pointerType === "mouse"/.test(editor), "90ms touch hold and mouse exemption remain");
  assert(/setTimeout\(\(\) => \{[\s\S]{0,200}is-drag-target-expanded[\s\S]{0,40}\}, 450\)/.test(editor), "450ms collapsed-day expansion remains");
  assert(/\bglide\s*=\s*reduced\s*\?\s*null\s*:\s*\{\s*duration:\s*200/.test(editor) && /dropAnimation: glide/.test(editor) && /keyboardTransition: glide/.test(editor) && /transition: glide/.test(editor), "reduced motion disables drop, keyboard and reorder animations");
  assert(!/feedback: "move"/.test(editor) && /\.program-editor__exercise\[data-dnd-dragging\]/.test(styles) && /\.program-editor__exercise\[data-dnd-placeholder\]/.test(styles), "library feedback uses the intended row and gap styles");
  assert(!/\.setPointerCapture\(|\.elementFromPoint\?\.\(|function beginDrag/.test(editor), "the replaced hand-rolled pointer drag is absent");
  assert(["move-to-day", "move-up", "move-down", "drag-handle"].every((role) => editor.includes(`data-role="${role}"`)), "explicit Move controls remain");
  assert(/if \(destroyed\) return;/.test(editor) && /if \(!Dnd\) \{/.test(editor) && /teardownSorting\(\)/.test(editor), "editor mount and disposal work without the drag library");
  assert(/root\.RepForgeDndRuntime/.test(editor) && /runtime\.load\(\)\.then\(\(\) => \{ if \(!destroyed && !sorting\) mountSorting\(\); \}/.test(editor), "deferred runtime arrival mounts sortables");
  assert(/moveExercise\(id, day, index/.test(editor) && (editor.match(/moveExercise\(/g) || []).length >= 4, "all reorder paths share one transaction");
}
{
  const dialog = (id) => new RegExp(`<dialog id="${id}"[^>]*>`).test(index);
  const divDialog = (id) => new RegExp(`<div id="${id}"[^>]*role="dialog"`).test(index);
  for (const id of ["blockReview", "importChoice", "endBlockConfirm", "storageRecovery", "programEditorLeave"]) assert(dialog(id), `#${id} is a native dialog`);
  assert(!/<dialog[^>]*\bclass="[^"]*\bhidden\b/.test(index), "no hidden class fights the native dialog display rule");
  for (const id of ["blockReview", "importChoice", "endBlockConfirm"]) assert(!new RegExp(`<dialog id="${id}"[^>]*(aria-modal=|role="dialog")`).test(index), `#${id} does not restate native semantics`);
  assert(/\.blockreview::backdrop\{background:var\(--scrim\)\}/.test(styles) && /\.importchoice::backdrop\{background:var\(--scrim\)\}/.test(styles) && /\.storage-recovery::backdrop\{background:var\(--scrim\)\}/.test(styles), "native dialogs share the scrim token");
  assert(/\.blockreview\{[\s\S]*?max-width:none;max-height:none/.test(styles), "full-bleed dialog overrides UA sizing");
  for (const id of ["whySheet", "exNoteSheet", "dayPickSheet", "programTextSheet", "shareSetupSheet", "exPickSheet", "exCustomSheet", "restSheet", "iosInstallSheet", "sessionSummary", "firstRun", "tour", "glossary"]) assert(divDialog(id), `#${id} retains its deliberately custom dialog behavior`);
  assert(divDialog("installBanner") && /banner\.setAttribute\("role", "region"\)/.test(layer), "install banner becomes a region at runtime");
  assert(/hideModalElement[\s\S]{0,400}el\.tagName==="DIALOG"/.test(app) && /if\(el\.tagName==="DIALOG"\)\{if\(typeof el\.showModal==="function"/.test(app), "one lifecycle covers both modal types");
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
