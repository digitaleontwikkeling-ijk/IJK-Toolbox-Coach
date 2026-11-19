import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integratie/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Integratietests delen één database; niet parallel draaien.
    fileParallelism: false,
  },
});
