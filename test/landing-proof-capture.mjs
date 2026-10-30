#!/usr/bin/env node
/**
 * Landing proof-image capture tool (Plan 064 R2a-C): tools/capture-landing-proof.mjs.
 *
 * Part 1 (Node only): the capture table and the pure helpers.
 *   - 4 paste-review images and 4 exercise-chart images (EN/PT x light/dark), and no retired wt-* walkthrough screen.
 *   - compareSpots reports a stale count, a changed frame, leftover walkthrough scenes, and the empty placeholder.
 *   - the paste sample is derived from landing.ways.paste.message in both catalogs.
 *   - the committed assets/brand/landing-proof-spots.json is well formed and carries only the counts.
 *   - no capture targets retired UI (Plan 064 C-03, RF-8): the import review is cropped from its current head.
 * Part 2 (browser, via the tool itself): the tool runs against the live app.
 *   - the paste-review runner reaches the real import-review screen in both languages and reports integer counts that
 *     cover all four exercises; --check against them passes and against a changed count fails naming it;
 *   - exercise-chart opens the exercise page from Progress with best e1RM pressed and checks the figures it draws
 *     against the Progress model's reading of the chart fixture (the caption's 92.5 to 100 kg over 4 sessions);
 *   - --fault-retired puts a retired element on screen and the capture refuses it, in the paste-review and
 *     exercise-chart captures (the retired-UI check bites).
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
  CHART_FIGURES, CHART_FRAME, CHART_LIFT, CHART_MIN_SCALE, CHART_TARGETS, CHART_THEMES, DEFAULT_SPOTS_FILE, LANGS, PASTE_TARGETS, PASTE_THEMES, PROOF_FRAME,
  RETIRED_SELECTORS, SPOT_SCHEMA, chartFile, compareSpots, outputFiles, pasteFile, pasteSample, webpSize,
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
check("capture table: 4 paste-review images and 4 exercise-chart images, no retired walkthrough screen", () => {
  const files = outputFiles();
  assert.equal(files.length, 8);
  assert.equal(new Set(files).size, 8);
  assert.deepEqual(files.filter((file) => file.startsWith("exercise-chart-")).sort(),
    ["exercise-chart-en-dark.webp", "exercise-chart-en-light.webp", "exercise-chart-pt-dark.webp", "exercise-chart-pt-light.webp"]);
  assert.equal(chartFile("pt", "dark"), "exercise-chart-pt-dark.webp");
  assert.deepEqual(CHART_THEMES, ["light", "dark"]);
  assert.deepEqual(CHART_FIGURES, { from: 92.5, to: 100, sessions: 4 });
  assert(!files.some((file) => file.startsWith("wt-")), "the retired walkthrough's wt-* screens are not captured");
  assert.deepEqual(LANGS, ["en", "pt"]);
  assert.deepEqual(PASTE_THEMES, ["light", "dark"]);
  assert.equal(pasteFile("en", "light"), "paste-review-en-light.webp");
  assert.deepEqual(PROOF_FRAME, { width: 390, height: 844, scale: 2 });
});
check("the exercise-chart capture is the Progress exercise page with best e1RM, not the pre-R3i canvas page", () => {
  assert.equal(CHART_LIFT, "library:sq_bb");
  assert.match(CHART_TARGETS.page, /^#exercise\.exview--chart$/);
  assert.match(CHART_TARGETS.plot, /^#exDetail \.exchart__plot$/);
  assert.match(CHART_TARGETS.e1rm, /data-metric="e1rm"/);
  assert(![...Object.values(CHART_TARGETS)].some((selector) => /#exChart|restinline|exview-head/.test(selector)), "no chart target names a retired part");
});
check("no capture targets retired UI: the import review has its current head", () => {
  for (const retired of [".restinline", ".restpad", "#woRest"]) assert(RETIRED_SELECTORS.includes(retired), `${retired} is a retired selector`);
  assert(RETIRED_SELECTORS.includes("#importReview .exview-head"), "the old import-review head is a retired selector");
  const targets = [...Object.values(PASTE_TARGETS), ...Object.values(CHART_TARGETS)];
  for (const retired of RETIRED_SELECTORS) {
    assert(!targets.some((selector) => selector.includes(retired)), `no capture target uses ${retired}`);
  }
  assert.equal(PASTE_TARGETS.head, "#importReview .onb__head");
  const source = readFileSync(TOOL, "utf8");
  assert(!/querySelector\(['"]#importReview \.exview-head/.test(source), "the tool never queries the old head");
});

const measured = {
  frame: { ...PROOF_FRAME },
  pasteReview: { en: { linked: 1, review: 3, custom: 0 }, pt: { linked: 0, review: 4, custom: 0 } },
};
const stored = () => JSON.parse(JSON.stringify({ schema: SPOT_SCHEMA, ...measured }));

check("compareSpots: identical counts are clean", () => {
  assert.deepEqual(compareSpots(stored(), measured), []);
});
check("compareSpots: a changed count, a missing language, a changed frame and retired scenes are reported by name", () => {
  const counts = stored();
  counts.pasteReview.pt.linked = 1;
  assert.match(compareSpots(counts, measured).join("\n"), /pasteReview\.pt\.linked: stored 1 but live 0/);
  const missing = stored();
  delete missing.pasteReview.en;
  assert.match(compareSpots(missing, measured).join("\n"), /pasteReview\.en: not stored/);
  const frame = stored();
  frame.frame.height = 900;
  assert.match(compareSpots(frame, measured).join("\n"), /frame\.height/);
  const scenes = stored();
  scenes.scenes = { focus: { cue: [50, 28, 91, 8] } };
  assert.match(compareSpots(scenes, measured).join("\n"), /retired walkthrough scenes/);
  assert.match(compareSpots(null, measured).join("\n"), /missing/);
});
check("compareSpots: the empty placeholder fails with a regenerate hint", () => {
  const placeholder = { schema: SPOT_SCHEMA, frame: { ...PROOF_FRAME }, pasteReview: {} };
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
check("committed landing-proof-spots.json is well formed and carries only the counts", () => {
  const committed = JSON.parse(readFileSync(DEFAULT_SPOTS_FILE, "utf8"));
  assert.equal(committed.schema, SPOT_SCHEMA);
  assert.deepEqual({ ...committed.frame }, PROOF_FRAME);
  assert.deepEqual(Object.keys(committed).sort(), ["frame", "pasteReview", "schema"]);
  for (const lang of LANGS) assert(["linked", "review", "custom"].every((key) => Number.isInteger(committed.pasteReview[lang]?.[key])), lang);
});

// ---- Part 2 ----------------------------------------------------------------
const dir = mkdtempSync(join(tmpdir(), "landing-proof-"));
try {
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

  const spotsFile = join(dir, "paste", "landing-proof-spots.json");
  if (existsSync(spotsFile)) {
    const clean = tool(["--check", "--scenes", "paste-review", "--spots", spotsFile]);
    check("--check against freshly measured counts passes", () => {
      assert.equal(clean.status, 0, `${clean.stdout}\n${clean.stderr}`);
      assert.match(clean.stdout, /match the live DOM/);
    });
    const stale = JSON.parse(readFileSync(spotsFile, "utf8"));
    stale.pasteReview.en.review += 1;
    const staleFile = join(dir, "stale.json");
    writeFileSync(staleFile, JSON.stringify(stale));
    const drift = tool(["--check", "--scenes", "paste-review", "--spots", staleFile]);
    check("--check against a changed count FAILS and names it", () => {
      assert.notEqual(drift.status, 0, "a stale count must fail the check");
      assert.match(drift.stderr, /pasteReview\.en\.review/);
    });
  }
  const faultPaste = tool(["--proof", join(dir, "fault-paste"), "--scenes", "paste-review", "--fault-retired", "--spots-only"]);
  check("--fault-retired in the paste-review scene FAILS: the old import-review head is refused", () => {
    assert.notEqual(faultPaste.status, 0, "a retired element in the frame must fail the capture");
    assert.match(faultPaste.stderr, /paste-review-en-light: the frame shows retired UI/);
    assert.match(faultPaste.stderr, /exview-head/);
  });
  const charts = tool(["--proof", join(dir, "charts"), "--scenes", "exercise-chart"]);
  check("exercise-chart renders #exercise with the e1RM toggle pressed and draws the caption's figures", () => {
    assert.equal(charts.status, 0, `${charts.stdout}\n${charts.stderr}`);
    const report = JSON.parse(readFileSync(join(dir, "charts", "proof-report.json"), "utf8"));
    for (const lang of LANGS) for (const theme of CHART_THEMES) {
      const entry = report.pasteReview[`exercise-chart-${lang}-${theme}`];
      assert(entry, `${lang} ${theme}: a chart entry in the report`);
      assert.equal(entry.page, "#exercise");
      assert(entry.plot, `${lang} ${theme}: the exercise page drew its chart plot`);
      assert(entry.pressed.includes("e1rm"), `${lang} ${theme}: the best e1RM toggle is pressed (${entry.pressed})`);
      assert.deepEqual(entry.figures, CHART_FIGURES, `${lang} ${theme}: the Progress model reads the caption's figures`);
      assert.equal(entry.rows.length, CHART_FIGURES.sessions, `${lang} ${theme}: one table row per session`);
      // The table is what the picture draws: oldest row is the "from" load, newest the "to" load.
      assert.equal(entry.rows.at(-1).top, CHART_FIGURES.from);
      assert.equal(entry.rows[0].top, CHART_FIGURES.to);
      const size = webpSize(readFileSync(join(dir, "charts", chartFile(lang, theme))));
      // R7 V-04: the chart region of a 320 px phone at 2x, so the 230 px landing slot draws it at CHART_MIN_SCALE or better.
      assert.equal(size.width, 584, `${lang} ${theme}: 584 px wide (292 CSS px at 2x)`);
      assert(230 / (size.width / CHART_FRAME.scale) >= CHART_MIN_SCALE, `${lang} ${theme}: legible at the 230 px slot`);
      assert(size.height > 600 && size.height < 900, `${lang} ${theme}: the chart region, not the page (${size.height})`);
    }
    for (const lang of LANGS) {
      const [light, dark] = CHART_THEMES.map((theme) => webpSize(readFileSync(join(dir, "charts", chartFile(lang, theme)))));
      assert.equal(light.height, dark.height, `${lang}: light and dark are the same crop`);
    }
  });
  const faultChart = tool(["--proof", join(dir, "fault-chart"), "--scenes", "exercise-chart", "--fault-retired", "--spots-only"]);
  check("--fault-retired in the exercise-chart scene FAILS: a retired element in the frame is refused", () => {
    assert.notEqual(faultChart.status, 0, "a retired element in the frame must fail the capture");
    assert.match(faultChart.stderr, /exercise-chart-en-light: the frame shows retired UI/);
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
