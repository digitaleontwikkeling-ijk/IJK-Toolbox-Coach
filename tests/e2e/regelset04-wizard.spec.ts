/** Regelset 0.4: Impact (BIV), hulpteksten, AI Act-signaal, contact volgt en "ter informatie" voor toetsers. */
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, kiesImpact, login, naarStap3 } from "./hulp";

test.describe.configure({ mode: "serial" });
let referentie = "";

test("stap 3 toont Impact in drie deelvragen met voorbeelden, hulpteksten en 'Wat moet je extra regelen?'", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await page.getByRole("button", { name: /past, verder/ }).click();

  const impact = page.locator("#veld-impact");
  for (const naam of ["Beschikbaarheid", "Integriteit", "Vertrouwelijkheid"]) {
    await expect(impact.getByRole("group", { name: new RegExp(naam) })).toBeVisible();
  }
  await expect(impact).toContainText("Een afdeling of klantproces ligt stil.");
  await expect(impact).toContainText("De hoogste score telt.");
  await expect(page.locator("#veld-data")).toContainText("Een kopie van echte gegevens of een testomgeving met productiegegevens is géén testdata.");
  await expect(page.locator("#veld-autonomie")).toContainText("Beslist de tool, of beslis jij op basis van wat de tool aangeeft?");
  await expect(page.locator("#veld-afhankelijkheid")).toContainText("Wat moet je extra regelen?");
  await expect(page.locator("#veld-afhankelijkheid")).toContainText("Bedrijfsoplossing: + monitoring, architectuur, continuïteit, lifecycle management");
  await expect(page.locator("#veld-persoonlijke_inlog_of_secrets")).toContainText("Copilot workflows draaien standaard op je eigen account");
  await expect(page.locator("#veld-proces_zonder_eigenaar")).toBeVisible();
});

test("AI Act-signaal: AI keurt zelfstandig facturen goed (scenario 11)", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "AI keurt facturen zelfstandig goed voor betaling.");
  await page.getByRole("button", { name: /past, verder/ }).click();
  await kies(page, "data", "Intern");
  await kies(page, "systemen", "Geen");
  await kies(page, "gebruikers", "Alleen ik");
  await kies(page, "autonomie", "Handelen");
  await kiesImpact(page, { integriteit: "Serieus" });
  await kies(page, "afhankelijkheid", "Regelmatig, voor mijn eigen werk (persoonlijke oplossing)");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Eerst toetsen", level: 2 })).toBeVisible();
  await expect(card).toContainText("AI Act-classificatie nodig");
  await expect(card).not.toContainText("Mogelijk is een DPIA nodig");
  await expect(card.getByRole("row", { name: /5\. Impact/ })).toContainText("Integriteit: Serieus");
});

test("rood zonder alternatief: status 'Contact volgt' (scenario 9)", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await page.getByRole("button", { name: /past, verder/ }).click();
  await kies(page, "data", "Openbaar");
  await kiesImpact(page, { vertrouwelijkheid: "Groot" });
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Niet op deze manier", level: 2 })).toBeVisible();
  await expect(card).toContainText("Groot (Impact – Vertrouwelijkheid).");
  await expect(card).toContainText("Status: Contact volgt.");
  await expect(card).toContainText("Team Digitale Ontwikkeling neemt contact met je op");
  await expect(card).toContainText("Wie kijkt mee?");
  referentie = (await page.locator(".adviescard__voet strong").innerText()).trim();
});

test("toetser ziet het rode advies ter informatie, zonder besluitformulier", async ({ page }) => {
  await login(page, "Testtoetser Compliance", { nieuwIdee: false });
  await expect(page.getByRole("heading", { name: /Ter informatie/ })).toBeVisible();
  await page.getByRole("link", { name: referentie }).click();
  await expect(page.getByText("Bij deze uitkomst is er geen aanvraag en hoef je geen besluit te nemen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Besluit vastleggen" })).toHaveCount(0);
});
