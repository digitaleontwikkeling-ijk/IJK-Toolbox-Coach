/** Automatische WCAG 2.1 AA-controle (axe) op elke stap van de wizard en op Mijn aanvragen. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { geenRodeVlaggen, kies, login, naarStap3 } from "./hulp";

async function controleer(page: Page, waar: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const samenvatting = r.violations.map((v) => `${waar}: ${v.id} (${v.nodes.length}×) ${v.help}`);
  expect(samenvatting).toEqual([]);
}

test("geen WCAG 2.1 AA-overtredingen in de wizard", async ({ page }) => {
  await login(page, "Testtoetser Compliance");
  await controleer(page, "stap 1");
  await naarStap3(page, "Ik wil voor mezelf een prototype bouwen met testdata.");
  await controleer(page, "stap 2");
  await page.getByRole("button", { name: /past, verder/ }).click();
  await expect(page.getByRole("heading", { name: /Zes checks/ })).toBeVisible();
  await page.getByRole("button", { name: "Bekijk het advies →" }).click(); // toont foutmelding
  await controleer(page, "stap 3 met foutmelding");
  await kies(page, "data", "Openbaar");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.locator(".adviescard")).toBeVisible();
  await controleer(page, "stap 4");
  await page.goto("/mijn-aanvragen");
  await expect(page.locator(".aanvraag").first()).toBeVisible();
  await controleer(page, "mijn aanvragen");
  await page.goto("/login");
  await controleer(page, "login");
});
