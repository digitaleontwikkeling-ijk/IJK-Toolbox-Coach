/** De wizard via het Hermes-protocol (nagebootste Hermes API-server). */
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, kiesImpact, login, naarStap3, naarChecks } from "./hulp";

test("volledige wizard via Hermes: tooladvies, voorinvullen en uitleg", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "Ik wil voor mezelf een prototype bouwen met testdata.");
  await expect(page.getByText("Advies van de coach")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Claude Code", level: 3 })).toBeVisible();
  await naarChecks(page, "Claude Code past, verder →");
  await expect(page.getByLabel("Openbaar", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Eenmalig of om uit te proberen (experiment)", { exact: true })).toBeChecked();
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.getByRole("heading", { name: "Direct aan de slag", level: 2 })).toBeVisible();
  await expect(page.locator(".chat")).toContainText("(uitleg via Hermes)");
});

test("Hermes faalt: de wizard valt terug op handmatig invullen en blijft bruikbaar", async ({ page }) => {
  await login(page, "Testmedewerker Bram");
  await page.getByLabel("Jouw use case").fill("Notulen van het teamoverleg laten maken #hermes-fout");
  await page.getByRole("button", { name: "Volgende →" }).click();
  await expect(page.getByText("De coach is nu niet beschikbaar")).toBeVisible();
  await page.getByText("Microsoft 365 Copilot", { exact: true }).click();
  await naarChecks(page, "Microsoft 365 Copilot past, verder →");
  await expect(page.getByText("Voorgesteld door de coach")).toHaveCount(0);
  await kies(page, "data", "Intern");
  await kies(page, "systemen", "Geen");
  await kies(page, "gebruikers", "Collega's");
  await kies(page, "autonomie", "Assisteren");
  await kiesImpact(page, { beschikbaarheid: "Beperkt" });
  await kies(page, "afhankelijkheid", "Regelmatig, voor mijn eigen werk (persoonlijke oplossing)");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.getByRole("heading", { name: "Aan de slag met voorwaarden", level: 2 })).toBeVisible();
});

test("coach geeft ongeldige checks: niets wordt voorgeselecteerd, handmatig invullen werkt", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een dashboard bouwen voor mijn team #ongeldige-checks");
  await naarChecks(page);
  await expect(page.getByRole("heading", { name: /Zes checks/ })).toBeVisible();
  for (const naam of ["Openbaar", "Intern", "Persoonsgegevens", "Vertrouwelijk/gevoelig"]) {
    await expect(page.getByLabel(naam, { exact: true })).not.toBeChecked();
  }
});
