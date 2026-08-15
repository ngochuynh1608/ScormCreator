import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "mupdf",
    "better-sqlite3",
    "bullmq",
    "ioredis",
    "pg",
    "@aws-sdk/client-s3",
    "resend",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
    // Default ~10mb — large PPTX uploads fail with "Failed to parse body as FormData".
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
