#!/usr/bin/env node
/* Contracts for the two vendored runtimes the app ships — Motion and @dnd-kit
 * — and for the boundaries the application keeps around them.
 *
 * Pure Node, no browser, no network. This is the gate that has to keep working
 * in the cheapest CI job there is, because everything it protects is the kind
 * of thing that breaks silently:
 *
 *   - a runtime fetched from a CDN instead of vendored (the app stops working
 *     offline, and starts leaking a request to a third party);
 *   - an unpinned or hand-edited bundle (a gesture changes feel with no diff
 *     anybody reviewed);
 *   - a runtime loaded but not precached, or precached but loaded after the
 *     modules that use it;
 *   - an integration layer growing a second opinion about reduced motion, or
 *     app code reaching past it into `window.Motion`;
 *   - a drag library announcing in English to a Portuguese install;
 *   - the interaction discipline pass from the motion-polish work being undone
 *     from JavaScript instead of from CSS, where its own gate cannot see it.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
const readStyles = () => read("styles.css");

let passed = 0, failed = 0;
function assert(condition, name, detail = "") {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

console.log("vendored runtimes");

/* ---- Both runtimes are ours, pinned, and offline ---- */
for (const [label, bundle, meta, file] of [
  ["Motion", runtime, pin, "vendor/motion/motion.js"],
  ["@dnd-kit", dnd, dndPin, "vendor/dnd-kit/dnd-kit.js"],
]) {
  assert(/^\d+\.\d+\.\d+$/.test(meta.version) && /^\d+\.\d+\.\d+$/.test(meta.esbuild),
    `${label} is pinned to exact package and bundler versions`,
    `${meta.package}@${meta.version} esbuild@${meta.esbuild}`);
  assert(createHash("sha256").update(bundle, "utf8").digest("hex") === meta.sha256,
    `the committed ${label} bundle still hashes to its pin`);
  assert(bundle.startsWith(`/* ${meta.package} ${meta.version} —`),
    `the ${label} bundle names the version it was built from`);
  let parses = true;
  try { execFileSync(process.execPath, ["--check", join(ROOT, file)], { stdio: "pipe" }); }
  catch { parses = false; }
  assert(parses, `the vendored ${label} bundle is syntactically valid browser JavaScript`);
}
{
  /* The same offline check CI runs, exercised here so one command covers it. */
  let checked = true;
  try { execFileSync(process.execPath, [join(ROOT, "tools/build-vendor-runtimes.mjs"), "--check"], { stdio: "pipe" }); }
  catch { checked = false; }
  assert(checked, "tools/build-vendor-runtimes.mjs --check agrees with both committed bundles");
}
assert(!/https?:\/\/(cdn|unpkg|esm|jsdelivr)/i.test(index) && !/import\(["']https?:/.test(layer),
  "nothing loads a runtime from a CDN");
assert(!/\bfetch\s*\(|\bimport\s*\(/.test(layer),
  "the integration layer resolves no module and issues no request at runtime");
assert(notice.includes("Motion animation runtime") && notice.includes("Copyright (c) 2018 Framer B.V.") &&
       notice.includes("Drag and drop") && notice.includes("@dnd-kit/dom"),
  "both vendored runtimes carry their MIT attribution");

/* ---- Offline shell ---- */
{
  const revision = sw.match(/const CACHE = "repforge-v(\d+)"/)?.[1] || "";
  assert(sw.includes('"./vendor/motion/motion.js"') && sw.includes('"./motion-layer.js"'),
    "the runtime and its layer are in the service worker's atomic precache");
  assert(sw.includes(`"./motion-layer.js?v=${revision}"`) && index.includes(`src="motion-layer.js?v=${revision}"`),
    "the integration layer is version coupled to the current cache revision", revision);
  assert(/SHELL = new Set\([^\n]+"\/vendor\/motion\/motion\.js"/.test(sw) &&
         /SHELL = new Set\([^\n]+"\/motion-layer\.js"/.test(sw),
    "both files are part of the offline shell an installed worker answers for");
  const runtimeAt = index.indexOf('src="vendor/motion/motion.js"');
  const layerAt = index.indexOf('src="motion-layer.js?v=');
  const editorAt = index.indexOf('src="program-editor.js?v=');
  const appAt = index.indexOf('src="app.js?v=');
  assert(runtimeAt > 0 && runtimeAt < layerAt && layerAt < editorAt && layerAt < appAt,
    "the runtime loads before the layer, and the layer before every module that uses it",
    `runtime ${runtimeAt}, layer ${layerAt}, editor ${editorAt}, app ${appAt}`);
}

/* ---- One integration layer, not scattered Motion calls ---- */
{
  const callers = { "app.js": app, "program-editor.js": editor };
  const leaks = Object.entries(callers)
    .filter(([, source]) => /\bwindow\.Motion\b|\broot\.Motion\b|(?<![\w.])Motion\.animate\b/.test(source))
    .map(([file]) => file);
  assert(leaks.length === 0,
    "no application module reaches past the layer into the Motion runtime",
    leaks.join(", "));
  assert(/RepForgeMotion/.test(app) && /RepForgeMotion/.test(editor),
    "the application talks to Motion through RepForgeMotion");
}

/* ---- The vocabulary is named, shared, and inside the discipline pass ---- */
{
  const vocabulary = layer.match(/const VOCABULARY = \{[\s\S]*?\n  \};/)?.[0] || "";
  assert(vocabulary.length > 0, "the layer defines one named motion vocabulary");
  for (const name of ["gestureSettle", "gestureExit", "layoutShift", "revealIn", "revealOut"]) {
    assert(vocabulary.includes(`${name}:`), `the vocabulary names "${name}" after what the interface is doing`);
  }
  const durations = [...vocabulary.matchAll(/duration: ([0-9.]+)/g)].map(m => Number(m[1]));
  assert(durations.length === 2 && durations.every(d => d <= 0.3),
    "the two tweens stay inside the 300ms ceiling the discipline pass set",
    durations.join(", "));
  /* Duration-parameterised springs solve for an arrival time and barely react
     to the velocity a gesture hands them, which would make every one of these
     a CSS transition wearing a spring's name. Physics parameters are the
     contract, and the damping ratio is what keeps them from wobbling. */
  const springs = [...vocabulary.matchAll(/stiffness: (\d+), damping: (\d+), mass: (\d+)/g)]
    .map(m => ({ k: Number(m[1]), c: Number(m[2]), m: Number(m[3]) }));
  assert(springs.length === 3 && !/visualDuration|bounce:/.test(vocabulary),
    "every spring is parameterised as physics, so it can carry a release velocity",
    String(springs.length));
  const ratios = springs.map(s => Math.round(s.c / (2 * Math.sqrt(s.k * s.m)) * 100) / 100);
  assert(ratios.every(z => z >= 0.75 && z <= 1.05),
    "each is damped between 0.75 and critical — caught, never wobbling",
    ratios.join(", "));
  assert(springs.every(s => vocabulary.includes(`stiffness: ${s.k}, damping: ${s.c}, mass: ${s.m}, restDelta`)),
    "each spring sets a pixel-scale rest threshold rather than settling invisibly");
  /* A spring literal outside the vocabulary is how a codebase ends up with
     four slightly different settles nobody chose. */
  const strayLiterals = [...layer.matchAll(/type: "spring"/g)].length
    - [...vocabulary.matchAll(/type: "spring"/g)].length;
  assert(strayLiterals === 0, "no spring settings are written outside the vocabulary", String(strayLiterals));
  assert(!/ease: *"?ease-?in"?[,}]/i.test(layer) && !/easeIn[,"']/.test(layer),
    "nothing enters or exits on ease-in");
  /* Emil's rule, kept mechanical: nothing may grow from nothing. The layer
     animates offsets and heights, so a scale must always start near 1. */
  const tinyScales = [...layer.matchAll(/scale\(\$?\{?[^)]*?([0-9]*\.[0-9]+)\)/g)]
    .map(m => Number(m[1])).filter(value => value < 0.9);
  assert(tinyScales.length === 0, "no entry grows from a scale below 0.9", tinyScales.join(", "));
}

/* ---- Reduced motion is decided once, and every path honours it ---- */
{
  assert((layer.match(/matchMedia\(/g) || []).length === 1 &&
         layer.includes('"(prefers-reduced-motion: reduce)")'),
    "the layer asks the reduced-motion question exactly once");
  assert(/const reducedMotion = \(\) =>/.test(layer),
    "reduced motion is read live, so turning it on mid-session takes effect");
  for (const entry of ["settle(", "dismiss(", "settleFocusDeck(", "animateExerciseReorder(", "animateDisclosure("]) {
    const body = layer.slice(layer.indexOf(`  ${entry}`) >= 0 ? layer.indexOf(`  ${entry}`) : layer.indexOf(entry));
    assert(/reducedMotion\(\)/.test(body.slice(0, 900)),
      `${entry.replace("(", "")} has a reduced-motion alternate, not a slower animation`);
  }
}

/* ---- The discipline pass is not undone from JavaScript ---- */
{
  assert(!/animateSetCompletion|animateLedger|animate\(.*ledger/i.test(layer),
    "set completion stays the short CSS acknowledgement the discipline pass made it");
  assert(polish.includes(".ledger__row.is-fresh") && polish.includes(".sumsheet.is-played"),
    "the CSS discipline layer still owns the frequent surfaces");
  assert(!/\.view\b/.test(layer) && !/\.toast\b/.test(layer) && !/effortpop/.test(layer),
    "navigation, toasts and the effort explainer are not taken over from CSS");
}

/* ---- Interruptibility and clean-up ---- */
{
  assert(/let disposed = false/.test(layer) && /if \(disposed\) return;\n      disposed = true;/.test(layer),
    "the sheet gesture handle can only be disposed once");
  assert(/disclosureRuns/.test(layer) && /disclosureRuns\.get\(panel\) !== token/.test(layer),
    "a superseded disclosure animation cannot clear the height its replacement is writing");
  assert(/const COLLAPSING = "is-collapsing"/.test(layer) &&
         /\.settings-panel\.is-collapsing\{display:block\}/.test(readStyles()),
    "a closing panel is held on screen by a marker that never appears at rest");
  assert(/apply\(\);\n    panel\.classList\.toggle\(COLLAPSING/.test(layer),
    "the class a disclosure toggle reads is updated at the tap, so a second tap reverses it");
  const hints = (layer.match(/hint\([a-zA-Z]+, null\)/g) || []).length;
  assert(hints >= 5, "every layer promotion is removed again when the animation ends", String(hints));
  assert(/rec\.motion/.test(app) && (app.match(/rec\.motion\.cancel\(\)/g) || []).length >= 2,
    "a sheet torn down mid-gesture — or grabbed again mid-spring — stops the animation that was painting it");
}

/* ---- Every caller keeps a path for a runtime that is not there ---- */
{
  assert(/if\(sheetDrag\.motion\)sheetDrag\.motion\.follow/.test(app) && /else\{\n?\s*rec\.el\.style\.transform=/.test(app),
    "the sheet gesture still works without the runtime");
  assert(/if\(run\)\{run\.then\(done\);return\}/.test(app) && /setTimeout\(done,220\)/.test(app),
    "the focus deck snap-back falls back to its stylesheet transition without the runtime");
  assert(/function focusAnimateTo\(dir\)\{/.test(app) && /setTimeout\(\(\)=>\{\n?\s*focusFlinging=false/.test(app),
    "carrying the deck to the next card is deliberately left as a plain CSS transition");
  assert(/if \(root\.RepForgeMotion\?\.animateExerciseReorder\(rows, beforeRects\)\) return;/.test(editor) &&
         /program-editor-flip-y/.test(editor),
    "the editor reorder falls back to its FLIP keyframe without the runtime");
  assert(/settle = true/.test(editor) && /moveExercise\(id, day, index, \{ settle: false \}\)/.test(editor),
    "a drag the drag library already animated is not animated a second time");
  assert(/if\(window\.RepForgeMotion\)window\.RepForgeMotion\.animateDisclosure\(panel,on,show\);\n  else show\(\)/.test(app),
    "a disclosure opens either way, and its class is toggled exactly once");
}

/* ---- The drag library is configured, not merely dropped in ---- */
{
  const en = JSON.parse(read("i18n-en.json"));
  const pt = JSON.parse(read("i18n-pt.json"));
  const keys = ["program.editor.drag.instructions", "program.editor.drag.picked_up",
    "program.editor.drag.over", "program.editor.drag.dropped", "program.editor.drag.cancelled"];
  assert(keys.every(key => en[key] && pt[key] && en[key] !== pt[key]),
    "the drag's screen-reader copy is translated, not left in the library's English",
    keys.filter(key => !pt[key]).join(", "));
  assert(/Accessibility\.configure\(\{[\s\S]{0,220}announcements: dragAnnouncements\(\)/.test(editor) &&
         /screenReaderInstructions: \{ draggable: label\("dragInstructions"\) \}/.test(editor),
    "and it is the copy handed to the library, replacing its defaults");
  assert(/PointerActivationConstraints\.Delay\(\{ value: 90, tolerance: 10 \}\)/.test(editor) &&
         /event\.pointerType === "mouse"/.test(editor),
    "the 90ms that tells a thumb-drag from a tap survived, and a mouse on the handle is exempt");
  assert(/setTimeout\(\(\) => \{[\s\S]{0,200}is-drag-target-expanded[\s\S]{0,40}\}, 450\)/.test(editor),
    "so did the 450ms hold that opens a collapsed day");
  assert(/const glide = reduced \? null : \{ duration: 200/.test(editor) &&
         /dropAnimation: glide/.test(editor) && /keyboardTransition: glide/.test(editor) &&
         /transition: glide/.test(editor),
    "reduced motion turns off the drop, keyboard and reorder animations rather than shortening them");
  assert(!/feedback: "move"/.test(editor) &&
         /\.program-editor__exercise\[data-dnd-dragging\]/.test(readStyles()) &&
         /\.program-editor__exercise\[data-dnd-placeholder\]/.test(readStyles()),
    "the library's own feedback is used, and the stylesheet gives the carried row and its gap the old drag's language");
  assert(!/\.setPointerCapture\(|\.elementFromPoint\?\.\(|function beginDrag/.test(editor),
    "the hand-rolled pointer drag it replaced is gone, not left alongside it");
  assert(/data-role="move-to-day"/.test(editor) && /data-role="move-up"/.test(editor) &&
         /data-role="move-down"/.test(editor) && /data-role="drag-handle"/.test(editor),
    "the explicit Move up / Move down / Move to another day controls remain");
  assert(/if \(destroyed \|\| !Dnd\) return;/.test(editor) && /teardownSorting\(\)/.test(editor),
    "the editor still mounts, and still disposes cleanly, without the drag library");
  assert(/moveExercise\(id, day, index/.test(editor) &&
         (editor.match(/moveExercise\(/g) || []).length >= 4,
    "every reorder path — drag, keyboard drag and the Move controls — goes through one transaction");
}

/* ---- Modal surfaces are the platform's where the platform models them ---- */
{
  const dialog = id => new RegExp(`<dialog id="${id}"[^>]*>`).test(index);
  const divDialog = id => new RegExp(`<div id="${id}"[^>]*role="dialog"`).test(index);
  for (const id of ["blockReview", "importChoice", "endBlockConfirm", "storageRecovery", "programEditorLeave"]) {
    assert(dialog(id), `#${id} is a native <dialog>`);
  }
  assert(!/<dialog[^>]*\bclass="[^"]*\bhidden\b/.test(index),
    "no dialog is hidden by a class the UA's own display rule would fight");
  for (const id of ["blockReview", "importChoice", "endBlockConfirm"]) {
    assert(!new RegExp(`<dialog id="${id}"[^>]*(aria-modal=|role="dialog")`).test(index),
      `#${id} does not restate the role or modality showModal already implies`);
  }
  /* Every modal in the app dims what is behind it, and these three were the
     exception only because a div has no backdrop to draw. */
  assert(/\.blockreview::backdrop\{background:var\(--scrim\)\}/.test(readStyles()) &&
         /\.importchoice::backdrop\{background:var\(--scrim\)\}/.test(readStyles()) &&
         /\.storage-recovery::backdrop\{background:var\(--scrim\)\}/.test(readStyles()),
    "every native dialog draws the same scrim, from the same token");
  assert(/\.blockreview\{[\s\S]*?max-width:none;max-height:none/.test(readStyles()),
    "the full-bleed panel undoes the UA dialog sizing so it still fills the screen");
  /* The surfaces deliberately left alone. Each is listed so a later reader can
     see the exclusion was a decision rather than an oversight; the reasons are
     in docs/design/interaction-runtime-audit.md. */
  for (const id of ["whySheet", "exNoteSheet", "dayPickSheet", "programTextSheet", "shareSetupSheet",
                    "exPickSheet", "exCustomSheet", "restSheet", "iosInstallSheet",
                    "sessionSummary", "firstRun", "tour", "installBanner", "glossary"]) {
    assert(divDialog(id), `#${id} deliberately keeps its hand-rolled dialog behaviour`);
  }
  assert(/hideModalElement[\s\S]{0,400}el\.tagName==="DIALOG"/.test(app) &&
         /if\(el\.tagName==="DIALOG"\)\{if\(typeof el\.showModal==="function"/.test(app),
    "one modal lifecycle covers both kinds, so focus return and inertness are unchanged");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
