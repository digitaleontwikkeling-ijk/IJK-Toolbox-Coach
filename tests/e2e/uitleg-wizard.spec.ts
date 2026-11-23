/** De uitlegpagina "Hoe werkt de coach?" en de verwijzingen ernaar. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, login, naarStap3, naarChecks } from "./hulp";

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
  await naarChecks(page);
  await kies(page, "data", "Openbaar");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.locator(".adviescard")).toContainText("Deze kleur is berekend met de vaste spelregels van IJK, niet door de AI agent.");
});

test("na het tooladvies volgt eerst uitleg over fase 2: werking, vragen en waarom, en wat er daarna gebeurt", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await page.getByRole("button", { name: /past, verder/ }).click();

  await expect(page.getByRole("heading", { name: "Fase 2 · Mag ik dit doen?", level: 1 })).toBeFocused();
  for (const kop of ["Hoe werkt het?", "Welke vragen krijg je, en waarom?", "Wat gebeurt er daarna?"]) {
    await expect(page.getByRole("heading", { name: kop })).toBeVisible();
  }
  const uitleg = page.locator(".fase-uitleg");
  await expect(uitleg).toContainText("Data: welke data gebruik je?");
  await expect(uitleg).toContainText("Hoe zelfstandiger de oplossing werkt, hoe belangrijker menselijke controle is.");
  for (const u of ["Direct aan de slag", "Aan de slag met voorwaarden", "Eerst toetsen", "Niet op deze manier"]) await expect(uitleg).toContainText(u);
  await expect(page.getByRole("button", { name: "Bekijk het advies →" })).toHaveCount(0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);

  // Verder naar de checks; de uitleg is daarna opnieuw te lezen.
  await page.getByRole("button", { name: "Begin met de checks →" }).click();
  await expect(page.getByRole("heading", { name: /Zes checks/, level: 1 })).toBeFocused();
  await expect(page.locator("#veld-data")).toBeVisible();
  await page.getByRole("button", { name: "Lees de uitleg over deze fase opnieuw" }).click();
  await expect(page.getByRole("heading", { name: "Fase 2 · Mag ik dit doen?", level: 1 })).toBeVisible();

  // Terug naar stap 2 en weer verder: de uitleg is gelezen en komt niet nog eens.
  await page.getByRole("button", { name: "Begin met de checks →" }).click();
  await page.getByRole("button", { name: "← Terug" }).click();
  await page.getByRole("button", { name: /past, verder/ }).click();
  await expect(page.getByRole("heading", { name: /Zes checks/, level: 1 })).toBeVisible();
});
