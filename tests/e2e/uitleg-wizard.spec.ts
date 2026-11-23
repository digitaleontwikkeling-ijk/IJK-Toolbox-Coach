/** De uitlegpagina "Hoe werkt de coach?" en de verwijzingen ernaar. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, login, naarStap3 } from "./hulp";

test("uitlegpagina is zonder inloggen te lezen en toegankelijk", async ({ page }) => {
  await page.goto("/hoe-werkt-het");
  await expect(page.getByRole("heading", { name: "Hoe werkt de coach?", level: 1 })).toBeVisible();
  await expect(page.getByText("Maar de AI agent beslist niet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waarom bepaalt de AI agent niet de kleur?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wat gaat er naar de AI agent?" })).toBeVisible();
  await expect(page).toHaveTitle(/IJK Toolbox Coach/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test("links naar de uitleg: inlogpagina, voet, chatvenster en bij 'Waarom deze kleur?'", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("main").getByRole("link", { name: "Hoe werkt de coach?" })).toHaveAttribute("href", "/hoe-werkt-het");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Hoe werkt de coach?" })).toBeVisible();

  // Chris: andere tests verwachten dat Bram geen adviezen heeft (gedeelde testdatabase).
  await login(page, "Testmedewerker Chris");
  const chatLink = page.locator(".chat").getByRole("link", { name: /Hoe werkt de coach\?/ });
  await expect(chatLink).toHaveAttribute("target", "_blank");

  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await page.getByRole("button", { name: /past, verder/ }).click();
  await kies(page, "data", "Openbaar");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.locator(".adviescard")).toContainText("Deze kleur is berekend met de vaste spelregels van IJK, niet door de AI agent.");
});
