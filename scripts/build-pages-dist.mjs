#!/usr/bin/env node
/**
 * Cloudflare Pages deploy output. Never publish the repository root.
 * Keep this list intentionally small and explicit: plans/, docs/, tests/,
 * extracted research material, tools/, and .git are NOT web assets.
 *
 * This is a deployment boundary, not a license/provenance remediation:
 * the runtime exercise catalog itself still needs separate legal review.
 */
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "dist");
const ROOT_FILES = [
  "index.html", "manifest.webmanifest", "sw.js", "styles.css", "motion-polish.css",
  "app.js", "durable-state.js", "exercise-catalog.js", "exercise-metrics.js",
  "exercises.js", "guide-registry.js", "history-ui.js", "i18n.js",
  "i18n-en.json", "i18n-pt.json", "install-policy.js",
  "install-transfer-contract.js", "install-transfer.js", "motion-layer.js",
  "notify.js", "posthog-init.js", "program-compiler.js", "program-editor.js",
  "program-entry-adapter.js", "program-entry.js", "program-transition.js",
  "progress-model.js", "progression-engine.js", "schedule.js",
  "shared-setup.js", "telemetry.js", "unsupported-workout-grammar.js",
  "workout-draft.js",
];
const OPTIONAL_ROOT_FILES = ["posthog-config.js"];
const DIRECTORIES = {
  "assets": ["brand", "exercises", "exercise-catalog.json"],
  "vendor": ["motion", "dnd-kit"],
  "icons": readdirSync(join(ROOT, "icons")).filter(x => /\.(?:png|svg|webp)$/i.test(x)),
  "fonts": readdirSync(join(ROOT, "fonts")).filter(x => /\.woff2$/i.test(x)),
};
const allowedExtension = /\.(?:js|json|css|html|webmanifest|svg|png|webp|woff2)$/i;
function copyFile(relative) {
  if (!allowedExtension.test(relative)) throw new Error("Unexpected public asset: " + relative);
  const src = join(ROOT, relative);
  if (!existsSync(src) || !statSync(src).isFile()) throw new Error("Missing required asset: " + relative);
  mkdirSync(join(OUT, relative, ".."), {recursive:true});
  copyFileSync(src, join(OUT, relative));
}
function copyFolder(relative) {
  for (const entry of readdirSync(join(ROOT, relative), {withFileTypes:true})) {
    if (entry.isDirectory()) copyFolder(join(relative, entry.name));
    else if (entry.isFile() && allowedExtension.test(entry.name)) copyFile(join(relative, entry.name));
  }
}
if (existsSync(OUT)) rmSync(OUT, {recursive:true,force:true});
mkdirSync(OUT, {recursive:true});
for (const file of ROOT_FILES) copyFile(file);
for (const file of OPTIONAL_ROOT_FILES) if (existsSync(join(ROOT,file))) copyFile(file);
for (const [dir, entries] of Object.entries(DIRECTORIES)) {
  for (const entry of entries) {
    const relative = join(dir, entry);
    if (statSync(join(ROOT,relative)).isDirectory()) copyFolder(relative);
    else copyFile(relative);
  }
}
// Enforce the private evidence boundary after assembling the artifact.
for (const sensitive of ["plans", "docs", "test", "tools", ".github", "scripts", "AGENTS.md", "README.md", "plans/067/data/app_file.json"]) {
  if (existsSync(join(OUT,sensitive))) throw new Error("Sensitive repository path in public output: "+sensitive);
}
console.log("Prepared Cloudflare Pages dist/ with runtime assets only");
