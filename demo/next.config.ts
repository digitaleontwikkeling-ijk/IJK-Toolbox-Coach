/**
 * Statische demo voor GitHub Pages. Gebruikt de componenten uit ../src; de API
 * draait in de browser (src/demo/api.ts). Bouwen: npm run demo:build
 */
import type { NextConfig } from "next";
import path from "node:path";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { externalDir: true },
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  env: { NEXT_PUBLIC_DEMO: "1", NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
