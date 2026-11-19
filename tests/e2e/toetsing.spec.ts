/** Van aanvraag tot besluit: medewerker → beide toetsers → medewerker ziet de uitkomst. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { geenRodeVlaggen, kies, login, naarStap3 } from "./hulp";

test.describe.configure({ mode: "serial" });
let referentie = "";

async function geenOvertredingen(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("medewerker dient een aanvraag in voor toetsing", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "Een verzuimdashboard bouwen voor de afdeling met gegevens uit AFAS.");
  await page.getByRole("button", { name: /past, verder/ }).click();
  await kies(page, "bijzondere_persoonsgegevens", "Ja");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.getByRole("heading", { name: "Eerst toetsen", level: 2 })).toBeVisible();
  referentie = (await page.locator(".adviescard__voet strong").innerText()).trim();
  await page.getByRole("button", { name: "Aanvraag indienen voor toetsing" }).click();
  await expect(page.locator(".adviescard")).toContainText("Status: In toetsing");
});

test("medewerker ziet geen Toetsing- of Beheer-menu en krijgt geen toegang", async ({ page }) => {
  await login(page, "Testmedewerker Anna", { nieuwIdee: false });
  await expect(page.getByRole("link", { name: "Toetsing" })).toHaveCount(0);
  await page.goto("/toetsing");
  await expect(page.getByRole("heading", { name: "Geen toegang" })).toBeVisible();
  await page.goto("/beheer");
  await expect(page.getByRole("heading", { name: "Geen toegang" })).toBeVisible();
});

test("compliance officer keurt goed met voorwaarden", async ({ page }) => {
  await login(page, "Testtoetser Compliance", { nieuwIdee: false });
  await page.getByRole("link", { name: "Toetsing" }).click();
  await expect(page.getByRole("heading", { name: /Te beoordelen/ })).toBeVisible();
  await geenOvertredingen(page);
  await page.getByRole("link", { name: referentie }).click();
  await expect(page.getByRole("heading", { name: `Aanvraag ${referentie}` })).toBeVisible();
  await expect(page.getByText("Een verzuimdashboard bouwen")).toBeVisible();
  await expect(page.locator(".adviescard")).toContainText("Mogelijk is een DPIA nodig");
  await geenOvertredingen(page);

  // Voorwaarden zijn verplicht bij "met voorwaarden".
  await page.getByText("Goedgekeurd met voorwaarden", { exact: true }).click();
  await page.getByRole("button", { name: "Besluit vastleggen" }).click();
  await expect(page.locator(".foutmelding")).toContainText("Welke voorwaarden gelden?");
  await page.getByLabel(/Welke voorwaarden gelden/).fill("Eerst een DPIA uitvoeren; alleen geanonimiseerde verzuimcijfers tonen.");
  await page.getByRole("button", { name: "Besluit vastleggen" }).click();
  await expect(page.getByText("Je besluit is vastgelegd. Status van de aanvraag: In toetsing.")).toBeVisible();
  await expect(page.locator(".adviescard")).toContainText("Eerst een DPIA uitvoeren");
});

test("architect keurt goed; eindstatus wordt 'goedgekeurd met voorwaarden'", async ({ page }) => {
  await login(page, "Testtoetser Architect", { nieuwIdee: false });
  await page.goto("/toetsing");
  await page.getByRole("link", { name: referentie }).click();
  await page.getByText("Goedgekeurd", { exact: true }).click();
  await page.getByRole("button", { name: "Besluit vastleggen" }).click();
  await expect(page.getByText("Status van de aanvraag: Goedgekeurd met voorwaarden.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Besluit vastleggen" })).toHaveCount(0);
});

test("medewerker ziet het besluit bij Mijn aanvragen", async ({ page }) => {
  await login(page, "Testmedewerker Anna", { nieuwIdee: false });
  await page.goto("/mijn-aanvragen");
  const rij = page.locator(".aanvraag", { hasText: referentie });
  await expect(rij).toContainText("Goedgekeurd met voorwaarden");
  await rij.getByRole("link", { name: /Bekijk advies/ }).click();
  await expect(page.locator(".adviescard")).toContainText("Besluiten van de toetsers");
  await expect(page.locator(".adviescard")).toContainText("Eerst een DPIA uitvoeren");
});

test("beheerder ziet alle adviezen en de inhoud, zonder besluitformulier", async ({ page }) => {
  await login(page, "Testbeheerder", { nieuwIdee: false });
  await page.getByRole("link", { name: "Beheer" }).click();
  await expect(page.getByRole("heading", { name: /Alle adviezen/ })).toBeVisible();
  await expect(page.getByText("Regelset versie")).toBeVisible();
  await geenOvertredingen(page);
  await page.getByRole("link", { name: referentie }).click();
  await expect(page.locator(".adviescard")).toContainText("Besluiten van de toetsers");
  await expect(page.getByRole("button", { name: "Besluit vastleggen" })).toHaveCount(0);
});
