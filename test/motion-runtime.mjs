#!/usr/bin/env node
/* Contracts for the vendored Motion runtime and its integration layer.
 *
 * Pure Node, no browser, no network — this is the gate that has to keep working
 * in the cheapest CI job there is, because everything it protects is the kind
 * of thing that breaks silently:
 *
 *   - a runtime fetched from a CDN instead of vendored (the app stops animating
 *     offline, and starts leaking a request to a third party);
 *   - an unpinned or hand-edited bundle (the gesture feel changes with no diff
 *     anybody reviewed);
 *   - a runtime that is loaded but not precached, or precached but loaded after
 *     the modules that use it;
 *   - the integration layer growing a second opinion about reduced motion, or
 *     app code reaching past it into `window.Motion`;
 *   - the interaction discipline pass from the motion-polish work being undone
 *     from JavaScript instead of from CSS, which its own gate cannot see.
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

console.log("motion runtime");

/* ---- The runtime is ours, pinned, and offline ---- */
assert(pin.motion === "13.2.0" && /^\d+\.\d+\.\d+$/.test(pin.esbuild),
  "the runtime is pinned to exact motion and bundler versions",
  `motion@${pin.motion} esbuild@${pin.esbuild}`);
assert(createHash("sha256").update(runtime, "utf8").digest("hex") === pin.sha256,
  "the committed bundle still hashes to its pin");
assert(runtime.startsWith(`/* Motion ${pin.motion} —`),
  "the bundle names the Motion version it was built from");
{
  /* The same offline check CI runs, exercised here so one command covers it. */
  let checked = true;
  try { execFileSync(process.execPath, [join(ROOT, "tools/build-motion-runtime.mjs"), "--check"], { stdio: "pipe" }); }
  catch { checked = false; }
  assert(checked, "tools/build-motion-runtime.mjs --check agrees with the committed bundle");
}
{
  let parses = true;
  try { execFileSync(process.execPath, ["--check", join(ROOT, "vendor/motion/motion.js")], { stdio: "pipe" }); }
  catch { parses = false; }
  assert(parses, "the vendored bundle is syntactically valid browser JavaScript");
}
assert(!/https?:\/\/(cdn|unpkg|esm|jsdelivr)/i.test(index) && !/import\(["']https?:/.test(layer),
  "nothing loads Motion from a CDN");
assert(!/\bfetch\s*\(|\bimport\s*\(/.test(layer),
  "the integration layer resolves no module and issues no request at runtime");
assert(notice.includes("Motion animation runtime") && notice.includes("Copyright (c) 2018 Framer B.V."),
  "the vendored runtime carries its MIT attribution");

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
  for (const entry of ["settle(", "dismiss(", "settleFocusDeck(", "returnToRest(", "animateExerciseReorder(", "animateDisclosure("]) {
    const body = layer.slice(layer.indexOf(`  ${entry}`) >= 0 ? layer.indexOf(`  ${entry}`) : layer.indexOf(entry));
    assert(/reducedMotion\(\)/.test(body.slice(0, 900)),
      `${entry.replace("(", "")} has a reduced-motion alternate, not a slower animation`);
  }
  assert(/pickUp\(\) \{[\s\S]{0,160}reducedMotion\(\)/.test(layer),
    "picking a row up under reduced motion leaves it flat");
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
  assert(/disposeD?|let disposed = false/.test(layer) && (layer.match(/disposed = true/g) || []).length >= 2,
    "gesture handles can only be disposed once");
  assert(/disclosureRuns/.test(layer) && /disclosureRuns\.get\(panel\) !== token/.test(layer),
    "a superseded disclosure animation cannot clear the height its replacement is writing");
  assert(/const COLLAPSING = "is-collapsing"/.test(layer) &&
         /\.settings-panel\.is-collapsing\{display:block\}/.test(readStyles()),
    "a closing panel is held on screen by a marker that never appears at rest");
  assert(/apply\(\);\n    panel\.classList\.toggle\(COLLAPSING/.test(layer),
    "the class a disclosure toggle reads is updated at the tap, so a second tap reverses it");
  const hints = (layer.match(/hint\([a-zA-Z]+, null\)/g) || []).length;
  assert(hints >= 5, "every layer promotion is removed again when the animation ends", String(hints));
  assert(/rec\.motion/.test(app) && /rec\.motion\.cancel\(\)/.test(app),
    "a sheet torn down mid-gesture stops its animation instead of reopening part-way down");
}

/* ---- Every caller keeps a path for a runtime that is not there ---- */
{
  assert(/if\(sheetDrag\.motion\)sheetDrag\.motion\.follow/.test(app) && /else\{\n?\s*rec\.el\.style\.transform=/.test(app),
    "the sheet gesture still works without the runtime");
  assert(/if\(run\)\{run\.then\(done\);return\}/.test(app) && /setTimeout\(done,220\)/.test(app),
    "the focus deck snap-back falls back to its stylesheet transition without the runtime");
  assert(/function focusAnimateTo\(dir\)\{/.test(app) && /setTimeout\(\(\)=>\{\n?\s*focusFlinging=false/.test(app),
    "carrying the deck to the next card is deliberately left as a plain CSS transition");
  assert(/if \(root\.RepForgeMotion\?\.animateExerciseReorder\(rows, beforeRects, carry\)\) return;/.test(editor) &&
         /program-editor-flip-y/.test(editor),
    "the editor reorder falls back to its FLIP keyframe without the runtime");
  assert(/if\(window\.RepForgeMotion\)window\.RepForgeMotion\.animateDisclosure\(panel,on,show\);\n  else show\(\)/.test(app),
    "a disclosure opens either way, and its class is toggled exactly once");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
