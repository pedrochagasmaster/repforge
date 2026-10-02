#!/usr/bin/env node
/**
 * Landing proof-image capture tool (Plan 064 R2a-C): tools/capture-landing-proof.mjs.
 *
 * Part 1 (Node only): the scene table and the pure helpers.
 *   - 8 Focus-family images (focus/rest/actions/note x EN/PT), dark only, plus 4 paste-review
 *     images (EN/PT x light/dark); no light wt-* file exists.
 *   - compareSpots tolerates movement inside the tolerance and reports drift, missing spots,
 *     a stale count, and the empty placeholder.
 *   - the paste sample is derived from landing.ways.paste.message in both catalogs.
 *   - the committed assets/brand/landing-proof-spots.json is well formed.
 *   - no scene targets retired UI (Plan 064 C-03, RF-8): the rest scene is the inline rest on Focus, never
 *     the rest sheet, and the import review is cropped from its current head, never `.exview-head`.
 * Part 2 (browser, via the tool itself): the tool runs against the live app.
 *   - --proof writes real 780x1688 WebP files and a spots JSON for the focus scene;
 *   - --check against that JSON passes, and against a JSON with one hotspot moved fails
 *     naming the spot (the stale-lens gate bites);
 *   - the paste-review runner reaches the real import-review screen in both languages and
 *     reports integer counts that cover all four exercises;
 *   - the rest, actions and note scenes render through production code (inline rest in the Focus card,
 *     the exercise-actions sheet, the exercise-note sheet) and measure their hotspots;
 *   - --fault-retired puts a retired element on screen and the capture refuses it, in the rest scene and the
 *     paste-review scene (the retired-UI check bites).
 * Files are written to a temporary directory, never to assets/brand/.
 *
 * Run: node test/landing-proof-capture.mjs   (with REPFORGE_URL set, or a server on :8000)
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SPOTS_FILE, LANGS, PASTE_TARGETS, PASTE_THEMES, PROOF_FRAME, PROOF_SCENES, RETIRED_SELECTORS, SPOT_SCHEMA,
  SPOT_TARGETS, SPOT_TOLERANCE, compareSpots, outputFiles, pasteFile, pasteSample, sceneFile, webpSize,
} from "../tools/capture-landing-proof.mjs";

const TOOL = fileURLToPath(new URL("../tools/capture-landing-proof.mjs", import.meta.url));
const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
let failed = 0;
function check(name, fn) {
  try { fn(); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
function tool(args) {
  return spawnSync(process.execPath, [TOOL, ...args], { encoding: "utf8", env: process.env, timeout: 280000 });
}

// ---- Part 1 ----------------------------------------------------------------
check("scene table: 8 dark wt-* images and 4 paste-review images", () => {
  assert.deepEqual(PROOF_SCENES.map((scene) => scene.name), ["focus", "rest", "actions", "note"]);
  const files = outputFiles();
  assert.equal(files.length, 12);
  assert.equal(new Set(files).size, 12);
  assert.equal(files.filter((file) => file.startsWith("wt-")).length, 8);
  assert(files.filter((file) => file.startsWith("wt-")).every((file) => /^wt-(focus|rest|actions|note)-(en|pt)-dark\.webp$/.test(file)));
  assert.deepEqual(LANGS, ["en", "pt"]);
  assert.deepEqual(PASTE_THEMES, ["light", "dark"]);
  assert.equal(sceneFile("focus", "pt"), "wt-focus-pt-dark.webp");
  assert.equal(pasteFile("en", "light"), "paste-review-en-light.webp");
  assert.deepEqual(PROOF_FRAME, { width: 390, height: 844, scale: 2 });
  assert(PROOF_SCENES.every((scene) => scene.spots.length > 0));
});

check("no scene or crop targets retired UI: the rest scene is the inline rest, the import review has its current head", () => {
  assert(RETIRED_SELECTORS.includes("#restSheet"), "the rest sheet is a retired selector");
  assert(RETIRED_SELECTORS.includes("#importReview .exview-head"), "the old import-review head is a retired selector");
  const targets = [...Object.values(SPOT_TARGETS), ...Object.values(PASTE_TARGETS)];
  for (const retired of RETIRED_SELECTORS) {
    assert(!targets.some((selector) => selector.includes(retired)), `no capture target uses ${retired}`);
  }
  assert(!targets.some((selector) => /restSheet|restdial|exview-head/.test(selector)), "no capture target names a retired part");
  assert.match(SPOT_TARGETS.rest, /\.fx-slot\[data-rest="running"\] \.restinline/, "the rest scene reads the inline rest in the Focus card's cue slot");
  assert.match(PROOF_SCENES.find((scene) => scene.name === "rest").shows, /inline rest/);
  assert.equal(PASTE_TARGETS.head, "#importReview .onb__head");
  const source = readFileSync(TOOL, "utf8");
  assert(!/querySelector\(['"]#importReview \.exview-head/.test(source), "the tool never queries the old head");
  assert(!/waitForSelector\(['"`]#restSheet/.test(source), "the tool never waits for the rest sheet");
});

const measured = {
  frame: { ...PROOF_FRAME },
  scenes: { focus: { cue: [50, 66.92, 81.03, 2.57] }, note: { text: [50, 46.79, 91.28, 2.94] } },
  pasteReview: { en: { linked: 1, review: 3, custom: 0 }, pt: { linked: 0, review: 4, custom: 0 } },
};
const stored = () => JSON.parse(JSON.stringify({ schema: SPOT_SCHEMA, ...measured }));

check("compareSpots: identical and within tolerance is clean", () => {
  assert.deepEqual(compareSpots(stored(), measured), []);
  const nudged = stored();
  nudged.scenes.focus.cue[1] += SPOT_TOLERANCE / 2;
  assert.deepEqual(compareSpots(nudged, measured), []);
});
check("compareSpots: drift, missing and stale values are reported by name", () => {
  const moved = stored();
  moved.scenes.focus.cue[1] += 1;
  assert.match(compareSpots(moved, measured).join("\n"), /focus\.cue: stored/);
  const missing = stored();
  delete missing.scenes.note;
  assert.match(compareSpots(missing, measured).join("\n"), /note: scene not stored/);
  const lacking = stored();
  delete lacking.scenes.focus.cue;
  assert.match(compareSpots(lacking, measured).join("\n"), /focus\.cue: not stored/);
  const extra = stored();
  extra.scenes.focus.gone = [1, 2, 3, 4];
  assert.match(compareSpots(extra, measured).join("\n"), /focus\.gone: stored but no longer measured/);
  const counts = stored();
  counts.pasteReview.pt.linked = 1;
  assert.match(compareSpots(counts, measured).join("\n"), /pasteReview\.pt\.linked: stored 1 but live 0/);
  const frame = stored();
  frame.frame.height = 900;
  assert.match(compareSpots(frame, measured).join("\n"), /frame\.height/);
  assert.match(compareSpots(null, measured).join("\n"), /missing/);
});
check("compareSpots: the empty placeholder fails with a regenerate hint", () => {
  const placeholder = { schema: SPOT_SCHEMA, frame: { ...PROOF_FRAME }, scenes: {}, pasteReview: {} };
  assert.match(compareSpots(placeholder, measured).join("\n"), /placeholder/);
});
check("paste sample is derived from landing.ways.paste.message in both catalogs", () => {
  for (const lang of LANGS) {
    const sample = pasteSample(read(`i18n-${lang}.json`));
    assert.equal(sample.exercises.length, 4, lang);
    assert(sample.exercises.every((item) => item.sets === 3 && item.min < item.max && item.name.length > 3), lang);
    const reply = JSON.parse(sample.reply);
    assert.equal(reply.version, 3);
    assert.equal(reply.exercises.length, 4);
    assert(sample.message.includes(sample.exercises[0].name));
  }
});
check("webpSize reads dimensions and rejects non-WebP bytes", () => {
  assert.equal(webpSize(Buffer.from("not an image at all, not an image at all")), null);
  const vp8 = Buffer.alloc(40);
  vp8.write("RIFF", 0, "ascii"); vp8.write("WEBP", 8, "ascii"); vp8.write("VP8 ", 12, "ascii");
  vp8.writeUInt16LE(780, 26); vp8.writeUInt16LE(1688, 28);
  assert.deepEqual(webpSize(vp8), { width: 780, height: 1688 });
});
check("committed landing-proof-spots.json is well formed (placeholder or generated)", () => {
  const committed = JSON.parse(readFileSync(DEFAULT_SPOTS_FILE, "utf8"));
  assert.equal(committed.schema, SPOT_SCHEMA);
  assert.deepEqual({ ...committed.frame }, PROOF_FRAME);
  for (const [scene, spots] of Object.entries(committed.scenes)) {
    assert(PROOF_SCENES.some((item) => item.name === scene), `unknown scene ${scene}`);
    for (const box of Object.values(spots)) assert(Array.isArray(box) && box.length === 4 && box.every(Number.isFinite));
  }
});

// ---- Part 2 ----------------------------------------------------------------
const dir = mkdtempSync(join(tmpdir(), "landing-proof-"));
try {
  const proof = join(dir, "proof");
  const run = tool(["--proof", proof, "--scenes", "focus"]);
  check("--proof focus exits 0 and writes real 780x1688 WebP files plus the spots JSON", () => {
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    for (const lang of LANGS) {
      const file = join(proof, sceneFile("focus", lang));
      assert(existsSync(file), `${file} missing`);
      assert.deepEqual(webpSize(readFileSync(file)), { width: 780, height: 1688 });
    }
    assert(!existsSync(join(proof, "wt-focus-en-light.webp")), "no light wt-* image is produced");
    const spots = JSON.parse(readFileSync(join(proof, "landing-proof-spots.json"), "utf8"));
    assert.deepEqual(Object.keys(spots.scenes), ["focus"]);
    assert.deepEqual(Object.keys(spots.scenes.focus).sort(), ["cue", "last", "log"]);
    for (const box of Object.values(spots.scenes.focus)) assert(box.length === 4 && box.every((value) => value >= 0 && value <= 100));
  });

  const spotsFile = join(proof, "landing-proof-spots.json");
  if (existsSync(spotsFile)) {
    const clean = tool(["--check", "--scenes", "focus", "--spots", spotsFile]);
    check("--check against freshly generated spots passes", () => {
      assert.equal(clean.status, 0, `${clean.stdout}\n${clean.stderr}`);
      assert.match(clean.stdout, /match the live DOM/);
    });
    const stale = JSON.parse(readFileSync(spotsFile, "utf8"));
    stale.scenes.focus.cue[1] += 3;
    const staleFile = join(dir, "stale.json");
    writeFileSync(staleFile, JSON.stringify(stale));
    const drift = tool(["--check", "--scenes", "focus", "--spots", staleFile]);
    check("--check against a moved hotspot FAILS and names it (the stale-lens gate bites)", () => {
      assert.notEqual(drift.status, 0, "a drifted spot must fail the check");
      assert.match(drift.stderr, /focus\.cue/);
    });
    const placeholderFile = join(dir, "placeholder.json");
    writeFileSync(placeholderFile, JSON.stringify({ schema: SPOT_SCHEMA, frame: PROOF_FRAME, scenes: {}, pasteReview: {} }));
    const empty = tool(["--check", "--scenes", "focus", "--spots", placeholderFile]);
    check("--check against the empty placeholder fails", () => {
      assert.notEqual(empty.status, 0);
      assert.match(empty.stderr, /placeholder/);
    });
  }

  const paste = tool(["--proof", join(dir, "paste"), "--scenes", "paste-review", "--spots-only"]);
  check("paste-review reaches the real import-review screen in EN and PT and reports true counts", () => {
    assert.equal(paste.status, 0, `${paste.stdout}\n${paste.stderr}`);
    const spots = JSON.parse(readFileSync(join(dir, "paste", "landing-proof-spots.json"), "utf8"));
    for (const lang of LANGS) {
      const counts = spots.pasteReview[lang];
      assert(counts && ["linked", "review", "custom"].every((key) => Number.isInteger(counts[key])), lang);
      assert.equal(counts.linked + counts.review, 4, `${lang}: every exercise is either linked or to review`);
      assert.match(paste.stdout, new RegExp(`paste-review ${lang}: ${counts.linked} linked, ${counts.review} to review`));
    }
    assert(!existsSync(join(dir, "paste", pasteFile("en", "light"))), "--spots-only writes no images");
  });

  const scenes = tool(["--proof", join(dir, "scenes"), "--scenes", "rest,actions,note"]);
  check("--proof rest,actions,note writes real 780x1688 frames and measures the live hotspots", () => {
    assert.equal(scenes.status, 0, `${scenes.stdout}\n${scenes.stderr}`);
    for (const scene of ["rest", "actions", "note"]) for (const lang of LANGS) {
      const file = join(dir, "scenes", sceneFile(scene, lang));
      assert(existsSync(file), `${file} missing`);
      assert.deepEqual(webpSize(readFileSync(file)), { width: 780, height: 1688 });
    }
    const spots = JSON.parse(readFileSync(join(dir, "scenes", "landing-proof-spots.json"), "utf8"));
    assert.deepEqual(Object.keys(spots.scenes), ["rest", "actions", "note"]);
    assert.deepEqual(Object.keys(spots.scenes.rest), ["dial"]);
    assert.deepEqual(Object.keys(spots.scenes.actions), ["swap"]);
    assert.deepEqual(Object.keys(spots.scenes.note), ["text"]);
    // The inline rest sits in the Focus card's cue slot, near the top of the frame; the retired sheet's dial sat at 54% of it.
    assert(spots.scenes.rest.dial[1] < 45, `the rest hotspot is the inline clock, not the retired sheet's dial (${spots.scenes.rest.dial})`);
    for (const box of Object.values(spots.scenes).flatMap((spot) => Object.values(spot))) {
      assert(box.length === 4 && box.every((value) => value >= 0 && value <= 100));
    }
  });
  const faultRest = tool(["--proof", join(dir, "fault-rest"), "--scenes", "rest", "--fault-retired", "--spots-only"]);
  check("--fault-retired in the rest scene FAILS: the rest sheet on screen is refused", () => {
    assert.notEqual(faultRest.status, 0, "a retired element in the frame must fail the capture");
    assert.match(faultRest.stderr, /rest-en: the frame shows retired UI/);
    assert.match(faultRest.stderr, /#restSheet/);
  });
  const faultPaste = tool(["--proof", join(dir, "fault-paste"), "--scenes", "paste-review", "--fault-retired", "--spots-only"]);
  check("--fault-retired in the paste-review scene FAILS: the old import-review head is refused", () => {
    assert.notEqual(faultPaste.status, 0, "a retired element in the frame must fail the capture");
    assert.match(faultPaste.stderr, /paste-review-en-light: the frame shows retired UI/);
    assert.match(faultPaste.stderr, /exview-head/);
  });
  const pasteImages = tool(["--proof", join(dir, "paste-images"), "--scenes", "paste-review"]);
  check("paste-review images are 390 CSS px wide at 2x, cropped from the current head through the first row", () => {
    assert.equal(pasteImages.status, 0, `${pasteImages.stdout}\n${pasteImages.stderr}`);
    for (const lang of LANGS) {
      const sizes = PASTE_THEMES.map((theme) => webpSize(readFileSync(join(dir, "paste-images", pasteFile(lang, theme)))));
      assert(sizes.every((size) => size.width === 780), `${lang}: 780 px wide`);
      assert.equal(sizes[0].height, sizes[1].height, `${lang}: light and dark are the same crop`);
      assert(sizes[0].height > 800 && sizes[0].height < 1688, `${lang}: a crop, not the whole frame (${sizes[0].height})`);
    }
    const report = JSON.parse(readFileSync(join(dir, "paste-images", "proof-report.json"), "utf8"));
    assert(Object.keys(report.sizes).every((file) => /^paste-review-(en|pt)-(light|dark)\.webp$/.test(file)));
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\nlanding proof capture: ${failed} failed` : "\nlanding proof capture: all passed");
process.exit(failed ? 1 : 0);
