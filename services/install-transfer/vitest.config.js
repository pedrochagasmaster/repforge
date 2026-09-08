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
          TRANSFER_WATCHDOG_SECRET: "test-watchdog-secret-012345678901234567890123",
          TRANSFER_BILLING_SECRET: "test-billing-secret-012345678901234567890123",
          TRANSFER_PURGE_SECRET: "test-purge-secret-012345678901234567890123",
          TRANSFER_ACK_SECRET: "test-ack-secret-012345678901234567890123",
          TRANSFER_LOCAL_TEST_EU: "true",
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
