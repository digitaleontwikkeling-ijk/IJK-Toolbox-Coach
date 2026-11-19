import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end-tests van de wizard. Er draaien twee servers op een aparte testdatabase:
 * één met de mock-coach en één zonder coach (de app moet ook zonder AI werken).
 * Vooraf: `npm run build`.
 */
const testDb = process.env.TEST_DATABASE_URL ?? "postgres://coach:coach_dev@localhost:5432/toolbox_coach_test";
const env = {
  DATABASE_URL: testDb,
  SESSIE_GEHEIM: "e2e-sessie-geheim",
  PSEUDONIEM_GEHEIM: "e2e-pseudoniem-geheim",
  AUTH_MODUS: "nep",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  use: { trace: "off" },
  projects: [
    { name: "mock-coach", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3100" }, testMatch: /wizard/ },
    { name: "zonder-coach", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3101" }, testMatch: /zonder-coach/ },
    { name: "telefoon", use: { ...devices["Pixel 7"], baseURL: "http://localhost:3100" }, testMatch: /smal/ },
  ],
  webServer: [
    { command: "npx next start -p 3100", port: 3100, env: { ...env, COACH_MODUS: "mock" }, reuseExistingServer: false },
    { command: "npx next start -p 3101", port: 3101, env: { ...env, COACH_MODUS: "uit" }, reuseExistingServer: false },
  ],
});
