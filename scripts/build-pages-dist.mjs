#!/usr/bin/env node
/**
 * Cloudflare Pages deploy output. Never publish the repository root.
 * dist/ holds exactly the files the app references: the service worker's
 * release inventory (ASSETS), index.html's scripts, stylesheets, icons and
 * images, the manifest icons, stylesheet url()s, catalog media, and the
 * service worker itself. plans/, docs/, test/, tools/, services/, research
 * data and markdown are never referenced, so they are never published.
 *
 * Run after scripts/generate-posthog-config.mjs, which writes
 * posthog-config.js and its index.html tag; both are copied when present.
 *
 * This is a deployment boundary, not a license/provenance remediation:
 * the runtime exercise catalog itself still needs separate legal review.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";
import { assembleRelease } from "./release-assembly.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "dist");
const allowedExtension = /\.(?:js|json|css|html|webmanifest|svg|png|webp|woff2)$/i;
const read = (file) => readFileSync(join(ROOT, file), "utf8");

function localPath(url) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) return null;
  const path = new URL(url, "https://app.test/").pathname.slice(1);
  return path === "" ? "index.html" : decodeURIComponent(path);
}

function releaseAssets() {
  const source = read("sw.js");
  const start = source.indexOf("const ASSETS = [");
  const end = source.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("sw.js has no ASSETS inventory");
  return vm.runInNewContext(`(${source.slice(start + "const ASSETS = ".length, end + 1)})`)
    .map(entry => typeof entry === "string" ? { url: entry } : entry);
}

const html = read("index.html");
// Required files fail the build when missing; optional ones are copied when present.
const required = new Set(["index.html", "sw.js", "manifest.webmanifest"]);
const optional = new Set();
for (const asset of releaseAssets()) (asset.required === false ? optional : required).add(localPath(asset.url));
for (const [, url] of html.matchAll(/<(?:script\b[^>]*\bsrc|link\b[^>]*\brel="stylesheet"[^>]*\bhref)="([^"]+)"/g)) required.add(localPath(url));
const media = [
  ...[...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m => m[1]),
  ...JSON.parse(read("manifest.webmanifest")).icons.map(icon => icon.src),
  ...["styles.css", "motion-polish.css"].flatMap(file => [...read(file).matchAll(/url\(\s*["']?([^"')]+)/g)].map(m => m[1])),
  ...[...read("exercises.js").matchAll(/"media":"([^"]+)"/g)].map(m => m[1]),
];
for (const url of media) {
  const path = localPath(url);
  if (path && !required.has(path)) optional.add(path);
}
required.delete(null);
// posthog-config.js is precached as optional but must ship whenever index.html loads it.
if (/<script src="posthog-config\.js\?/.test(html)) { optional.delete("posthog-config.js"); required.add("posthog-config.js"); }

// All migrated native modules ship at native paths, including Worker entrypoints.
function collectSource(directory) {
  if (!existsSync(join(ROOT, directory))) return;
  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectSource(path);
    else if (/\.(?:js|json|css)$/.test(entry.name)) required.add(path);
  }
}
collectSource("src");
collectSource("styles");

const present = (relative) => existsSync(join(ROOT, relative)) && statSync(join(ROOT, relative)).isFile();
function copyFile(relative) {
  if (!allowedExtension.test(relative)) throw new Error("Unexpected public asset: " + relative);
  mkdirSync(dirname(join(OUT, relative)), { recursive: true });
  copyFileSync(join(ROOT, relative), join(OUT, relative));
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const file of required) {
  if (!present(file)) throw new Error("Missing required asset: " + file);
  copyFile(file);
}
for (const file of optional) {
  if (present(file)) copyFile(file);
  else if (file !== "posthog-config.js") console.warn("Referenced file not in the repository, not published: " + file);
}
// Enforce the private evidence boundary after assembling the artifact.
for (const sensitive of ["plans", "docs", "test", "tools", "services", ".github", "scripts", "AGENTS.md", "README.md"]) {
  if (existsSync(join(OUT, sensitive))) throw new Error("Sensitive repository path in public output: " + sensitive);
}
const releaseOptional = releaseAssets().filter(asset => asset.required === false).map(asset => localPath(asset.url));
// A generated analytics config explicitly loaded by HTML is required.
if (/<script src="posthog-config\.js\?/.test(html)) releaseOptional.splice(releaseOptional.indexOf("posthog-config.js"), 1);
const release = assembleRelease(OUT, { optional: releaseOptional });
console.log(`Assembled immutable native release ${release.id}`);
const count = (dir) => readdirSync(dir, { withFileTypes: true })
  .reduce((n, entry) => n + (entry.isDirectory() ? count(join(dir, entry.name)) : 1), 0);
console.log(`Prepared Cloudflare Pages dist/ with ${count(OUT)} runtime files`);
