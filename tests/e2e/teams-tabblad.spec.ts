/**
 * "Test in het tabblad": de app draait in een iframe op een ándere site, zoals in
 * Microsoft Teams. Controleert dat inloggen (sessiecookie) en de wizard daar werken,
 * zowel op de breedte van een Teams-tabblad als smal (mobiel / zijpaneel).
 */
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";

const APP = "http://localhost:3103";
let host: Server;
let hostUrl = "";

test.beforeAll(async () => {
  host = createServer((req, res) => {
    const breedte = new URL(req.url ?? "/", "http://x").searchParams.get("breedte") ?? "1000";
    res.writeHead(200, { "Content-Type": "text/html" }).end(`<!doctype html><html lang="nl"><title>Nagebootst Teams</title>
      <body style="margin:0;font-family:sans-serif;background:#f0f0f0">
      <div style="background:#464775;color:#fff;padding:8px">Teams (nagebootst) · Toolbox Coach</div>
      <iframe id="tab" title="Toolbox Coach" src="${APP}/login?inTeams=1&terug=/wizard"
        style="border:0;width:${breedte}px;height:900px;background:#fff"></iframe></body></html>`);
  });
  await new Promise<void>((r) => host.listen(0, "127.0.0.1", r));
  hostUrl = `http://127.0.0.1:${(host.address() as { port: number }).port}`;
});
test.afterAll(() => host.close());

async function openTab(page: Page, breedte: number): Promise<FrameLocator> {
  await page.goto(`${hostUrl}/?breedte=${breedte}`);
  return page.frameLocator("#tab");
}

for (const breedte of [1000, 360]) {
  test(`wizard werkt in een Teams-iframe van ${breedte}px breed`, async ({ page }) => {
    const tab = await openTab(page, breedte);
    await tab.getByRole("button", { name: /Testmedewerker Bram/ }).click();
    await expect(tab.getByRole("navigation", { name: "Voortgang" })).toBeVisible();
    // Begin met een nieuw idee (de testdatabase wordt gedeeld). Dit gebeurt vanuit het
    // frame zelf, dus met de cross-site sessiecookie.
    const frame = page.frame({ url: /localhost:3103/ })!;
    await frame.evaluate(() => fetch("/api/concept", { method: "POST" }));
    await frame.goto(`${APP}/wizard`);
    await expect(tab.getByRole("heading", { name: /Wat wil je bereiken/ })).toBeVisible();
    // Sessiecookie werkt cross-site (SameSite=None; Secure; Partitioned): de API's zijn bereikbaar.
    await tab.getByLabel("Jouw use case").fill("Ik wil voor mezelf een prototype bouwen met testdata.");
    await tab.getByRole("button", { name: "Volgende →" }).click();
    if (await tab.getByRole("heading", { name: /De coach heeft nog|Ik heb nog/ }).isVisible().catch(() => false)) {
      await tab.getByRole("button", { name: "Volgende →" }).click();
    }
    await expect(tab.getByRole("heading", { name: /Welke tool past/ })).toBeVisible();
    await expect(tab.getByRole("heading", { name: "Claude Code", level: 3 })).toBeVisible();
    // Geen horizontaal scrollen binnen het tabblad.
    expect(await frame.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/teams-tabblad-${breedte}.png` });
  });
}

test("de app weigert insluiten op een site die niet is toegestaan", async ({ page }) => {
  // De app op poort 3100 kent de testhost niet als toegestane omgeving.
  await page.setContent(`<iframe id="tab" src="http://localhost:3100/login"></iframe>`);
  const res = await page.request.get("http://localhost:3100/login");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'self' https://teams.microsoft.com");
  expect(res.headers()["content-security-policy"]).not.toContain("127.0.0.1");
});
