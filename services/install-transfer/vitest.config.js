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
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.js"],
    reporters: ["default"],
  },
});
