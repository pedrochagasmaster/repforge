import { readFileSync, writeFileSync } from "node:fs";

const INDEX_PATH = "index.html";
const CONFIG_PATH = "posthog-config.js";
const POSTHOG_INIT_TAG = '  <script src="posthog-init.js"></script>';
const GENERATED_TAG_PATTERN = /^\s*<script src="posthog-config\.js\?v=[^"]+"><\/script>\r?\n/m;

const branch = process.env.CF_PAGES_BRANCH || "";
const isProduction = branch === "main";
const previewAnalyticsEnabled = process.env.POSTHOG_ENABLE_PREVIEWS === "true";
const analyticsEnabled = isProduction || previewAnalyticsEnabled;
const projectToken = process.env.POSTHOG_PROJECT_TOKEN?.trim();
const host = (process.env.POSTHOG_HOST?.trim() || "https://e.taurifer.com").replace(/\/+$/, "");

if (isProduction && !projectToken) {
  throw new Error("POSTHOG_PROJECT_TOKEN is required for production Cloudflare Pages builds.");
}

const config = analyticsEnabled && projectToken
  ? { projectToken, host }
  : {};

writeFileSync(
  CONFIG_PATH,
  `window.__POSTHOG_CONFIG__ = Object.freeze(${JSON.stringify(config)});\n`,
  "utf8",
);

let html = readFileSync(INDEX_PATH, "utf8").replace(GENERATED_TAG_PATTERN, "");
if (!html.includes(POSTHOG_INIT_TAG)) {
  throw new Error(`Could not find ${POSTHOG_INIT_TAG} in ${INDEX_PATH}.`);
}

const revision = (process.env.CF_PAGES_COMMIT_SHA || "local")
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 12) || "local";
const configTag = `  <script src="${CONFIG_PATH}?v=${revision}"></script>`;
html = html.replace(POSTHOG_INIT_TAG, `${configTag}\n${POSTHOG_INIT_TAG}`);
writeFileSync(INDEX_PATH, html, "utf8");

console.log(
  config.projectToken
    ? `Generated PostHog browser config (${isProduction ? "production" : "preview"}).`
    : "Generated analytics-disabled PostHog browser config.",
);
