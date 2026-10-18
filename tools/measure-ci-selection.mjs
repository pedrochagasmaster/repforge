#!/usr/bin/env node
/** Reproducible, read-only selector-count matrix. Not a wall-time benchmark. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectBranch, selectEdit, selectPacket } from "./test-selection.mjs";
import { selectVisuals } from "./ci-selection.mjs";
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/ui-screens/manifest.json"), "utf8"));
const cases = {
  docs: ["docs/ci.md"], directTest: ["test/history.mjs"], helper: ["test/fixtures/seed-program.mjs"],
  history: ["src/app/history-read-models.js"], program: ["src/ui/editors/program.js"], progress: ["src/training/progress.js"],
  appLocal: { files: ["src/app/history.js"] },
  appGlobal: { files: ["app.js"], appDiff: "@@ -1 +1 @@\n+// synthetic unannotated global edit" },
  durable: ["src/persistence/durable.js"], draft: ["src/training/workout.js"],
  telemetry: ["src/platform/telemetry.js"], serviceWorker: ["sw.js"], css: ["styles.css"],
  workflow: [".github/workflows/ci.yml"], baseline: ["docs/ui-screens/screens/history/list__phone-390-light-en.png"],
  capture: ["tools/capture-ui-screens.mjs"],
};
const result = Object.fromEntries(Object.entries(cases).map(([name, entry]) => {
  const { files, appDiff } = Array.isArray(entry) ? { files: entry } : entry;
  const old = selectBranch(files, { cwd: root });
  const edit = selectEdit(files, { cwd: root });
  const packet = selectPacket(files, { cwd: root });
  const visual = selectVisuals(files, manifest, { cwd: root, appDiff });
  const count = (plan) => ({ commands: plan.entries.length, lanes: new Set(plan.entries.map(({ lane }) => lane)).size });
  return [name, { files, ...(appDiff ? { appDiff } : {}), branch: count(old), edit: count(edit), packet: count(packet), visual: {
    mode: visual.mode, screens: visual.screens.length,
    frames: visual.mode === "full" ? manifest.screens.reduce((n, s) => n + manifest.variantSets[s.variants].length, 0)
      : manifest.screens.filter((s) => visual.screens.includes(`${s.flow}/${s.id}`)).reduce((n, s) => n + manifest.variantSets[s.variants].length, 0),
  } }];
}));
mkdirSync(resolve(root, ".ci-results"), { recursive: true });
writeFileSync(resolve(root, ".ci-results/selection-matrix.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
