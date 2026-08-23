#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const requiredVariables = ["POSTHOG_TOKEN", "POSTHOG_HOST"];
const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(
    `Missing required deploy-time environment variable${missingVariables.length === 1 ? "" : "s"}: ${missingVariables.join(", ")}`,
  );
  process.exit(1);
}

const config = {
  projectToken: process.env.POSTHOG_TOKEN,
  host: process.env.POSTHOG_HOST,
};

writeFileSync(
  new URL("../config.js", import.meta.url),
  `window.__POSTHOG_CONFIG__ = ${JSON.stringify(config)};\n`,
  "utf8",
);

console.log("Generated config.js from deploy-time environment variables.");
