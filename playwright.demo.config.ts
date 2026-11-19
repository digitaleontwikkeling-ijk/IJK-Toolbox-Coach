import { defineConfig, devices } from "@playwright/test";

/** Test van de statische demo (GitHub Pages). Vooraf: NEXT_PUBLIC_BASE_PATH=/IJK-Toolbox-Coach npm run demo:build */
export default defineConfig({
  testDir: "tests/demo",
  use: { trace: "off", baseURL: "http://127.0.0.1:3400" },
  projects: [{ name: "demo", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npx tsx scripts/serveer-demo.ts", url: "http://127.0.0.1:3400/IJK-Toolbox-Coach/login/", reuseExistingServer: false },
});
