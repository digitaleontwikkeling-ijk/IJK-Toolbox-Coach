/** Regelset 0.7: een tool kiezen die (nog) niet in de IJK Toolbox zit → altijd ter toetsing bij beide toetsers. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, kiesImpact, login, naarChecks, naarStap3 } from "./hulp";

test("andere tool: naam en link invullen, checks doorlopen → Eerst toetsen bij beide toetsers", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een notitie-app voor mijn eigen planning, met testdata (testscenario).");
  await page.getByRole("button", { name: "Zelf een tool kiezen" }).click();
  await page.getByText("Een andere tool (nog niet in de IJK Toolbox)", { exact: true }).click();
  await expect(page.locator(".andere-tool")).toContainText("altijd ter toetsing");
  // Geen spelregels: die zijn er voor deze tool nog niet.
  await expect(page.getByRole("heading", { name: "Wat mag je zelf doen?" })).toHaveCount(0);

  // Zonder naam kun je niet verder.
  await page.getByRole("button", { name: "Volgende →" }).click();
  await expect(page.locator(".foutmelding")).toContainText("Vul de naam van de tool in.");
  await expect(page.getByLabel("Naam van de tool")).toBeFocused();

  await page.getByLabel("Naam van de tool").fill("Notion");
  await page.getByLabel("Link naar de tool (optioneel)").fill("www.notion.so");
  await expect(page.locator(".veldfout")).toContainText("Een link begint met https://");
  await page.getByLabel("Link naar de tool (optioneel)").fill("https://www.notion.so");
  await expect(page.locator(".veldfout")).toHaveCount(0);

  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  await naarChecks(page, "Notion past, verder →");
  await kies(page, "data", "Openbaar");
  await kies(page, "systemen", "Geen");
  await kies(page, "gebruikers", "Alleen ik");
  await kies(page, "autonomie", "Assisteren");
  await kiesImpact(page);
  await kies(page, "afhankelijkheid", "Eenmalig of om uit te proberen (experiment)");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();

  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Eerst toetsen", level: 2 })).toBeVisible();
  await expect(card).toContainText("Notion (nog niet in de IJK Toolbox)");
  await expect(card).toContainText("De tool zit nog niet in de IJK Toolbox.");
  await expect(card.getByRole("link", { name: "https://www.notion.so" })).toHaveAttribute("rel", /noopener/);
  await expect(card).toContainText("AI governance & compliance officer");
  await expect(card).toContainText("architect Digitale Ontwikkeling");
});
