import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

function run(environment) {
  const directory = mkdtempSync(resolve(tmpdir(), "taurifer-posthog-config-"));
  mkdirSync(resolve(directory, "scripts"));
  copyFileSync(resolve(root, "scripts/generate-posthog-config.mjs"), resolve(directory, "scripts/generate-posthog-config.mjs"));
  writeFileSync(resolve(directory, "index.html"), '  <script src="posthog-init.js"></script>\n');
  const result = spawnSync(process.execPath, ["scripts/generate-posthog-config.mjs"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
  return { directory, result };
}

{
  const { directory, result } = run({
    CF_PAGES_BRANCH: "main",
    CF_PAGES_COMMIT_SHA: "abcdef1234567890",
    POSTHOG_HOST: "https://e.taurifer.com",
    POSTHOG_PROJECT_TOKEN: "phc_publictoken",
  });
  assert.equal(result.status, 0, result.stderr);
  const generated = readFileSync(resolve(directory, "posthog-config.js"), "utf8");
  assert.match(generated, /"sdkVersion":"1\.400\.0"/);
  assert.match(generated, /"appVersion":"abcdef123456"/);
  assert.match(generated, /"releaseChannel":"production"/);
  assert.match(readFileSync(resolve(directory, "index.html"), "utf8"), /posthog-config\.js\?v=abcdef123456/);
}

{
  const { result } = run({
    CF_PAGES_BRANCH: "main",
    POSTHOG_HOST: "http://unsafe.example/path",
    POSTHOG_PROJECT_TOKEN: "phc_publictoken",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /POSTHOG_HOST must be an HTTPS origin/);
}

{
  const { result } = run({ CF_PAGES_BRANCH: "main", POSTHOG_PROJECT_TOKEN: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /POSTHOG_PROJECT_TOKEN is required/);
}

console.log("posthog config: production pin and invalid configuration gates pass");
