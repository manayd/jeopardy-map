import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  // The SQLite file is opened via a runtime-built path, which static file
  // tracing can't see — include it explicitly so serverless bundles carry it.
  outputFileTracingIncludes: {
    "/api/**": ["./data/processed/clues.db"],
  },
};

export default nextConfig;
