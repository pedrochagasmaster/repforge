import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TRANSFER_ROUTING_KEY_B64: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
          TRANSFER_TOKEN_MAC_KEY_ID: "k1",
          TRANSFER_TOKEN_MAC_KEY_B64: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
          TRANSFER_TOKEN_MAC_PREVIOUS_KEY_ID: "k0",
          TRANSFER_TOKEN_MAC_PREVIOUS_KEY_B64: "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM",
          TRANSFER_DIGEST_KEY_B64: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
          TRANSFER_RATE_PEPPER_B64: "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
          TRANSFER_ALLOWED_ORIGIN: "https://taurifer.example",
          TRANSFER_ALARM_HEALTH: "healthy",
          TRANSFER_WATCHDOG_HEALTH: "healthy",
          TRANSFER_LOG_HEALTH: "healthy",
          TRANSFER_KEY_HEALTH: "healthy",
          TRANSFER_DELETION_HEALTH: "healthy",
          TRANSFER_CREATES_ENABLED: "true",
          TRANSFER_KILL_SWITCH: "false",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.js"],
    fileParallelism: false,
    reporters: ["default"],
  },
});
