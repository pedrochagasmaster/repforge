import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Cursor SDK and sharp ship native binaries — keep them out of the bundler.
  serverExternalPackages: ["@cursor/sdk", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
