/** Regelset 0.4: Impact (BIV), hulpteksten, AI Act-signaal, contact volgt en "ter informatie" voor toetsers. */
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, kiesImpact, login, naarStap3, naarChecks } from "./hulp";

test.describe.configure({ mode: "serial" });
let referentie = "";

test("stap 3 toont Impact in drie deelvragen (zonder voorbeelden) en hulpteksten; 'Wat moet je extra regelen?' niet bij de vraag", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await naarChecks(page);

  const impact = page.locator("#veld-impact");
  for (const naam of ["Beschikbaarheid", "Integriteit", "Vertrouwelijkheid"]) {
    await expect(impact.getByRole("group", { name: new RegExp(naam) })).toBeVisible();
  }
  // Geen voorbeelden bij de keuzes (keuze IJK: verwarrend, sluiten vaak niet aan op de use case).
  await expect(impact).not.toContainText("Een afdeling of klantproces ligt stil.");
  await expect(impact).toContainText("De hoogste score telt.");
  await expect(page.locator("#veld-data")).toContainText("Een kopie van echte gegevens of een testomgeving met productiegegevens is géén testdata.");
  await expect(page.locator("#veld-autonomie")).toContainText("Beslist de tool, of beslis jij op basis van wat de tool aangeeft?");
  // "Wat moet je extra regelen?" hoort bij het advies, niet bij de vraag.
  await expect(page.locator("#veld-afhankelijkheid")).not.toContainText("Wat moet je extra regelen?");
  await expect(page.locator("#veld-persoonlijke_inlog_of_secrets")).toContainText("Copilot workflows draaien standaard op je eigen account");
  await expect(page.locator("#veld-proces_zonder_eigenaar")).toBeVisible();
});

test("AI-risico: AI keurt zelfstandig facturen goed (scenario 11, regelset 0.8)", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "AI keurt facturen zelfstandig goed voor betaling.");
  await naarChecks(page);
  await kies(page, "data", "Intern");
  await kies(page, "systemen", "Geen");
  await kies(page, "gebruikers", "Alleen ik");
  await kies(page, "autonomie", "Handelen");
  await kiesImpact(page, { integriteit: "Serieus" });
  await kies(page, "afhankelijkheid", "Regelmatig, voor mijn eigen werk (persoonlijke oplossing)");
  // AI Flows gebruikt AI: de vraag staat al op Ja (de medewerker bevestigt).
  await expect(page.locator("#veld-ai_gebruik")).toContainText("Voorgesteld op basis van de gekozen tool");
  await expect(page.locator("#veld-ai_gebruik").getByLabel("Ja", { exact: true })).toBeChecked();
  await expect(page.getByRole("group", { name: "Over de AI in je oplossing" })).toBeVisible();
  // Facturen, geen mensen: de vragen over betrokkenen verschijnen niet.
  await kies(page, "ai_invloed", "Nee");
  await expect(page.locator("#veld-ai_domein")).toHaveCount(0);
  await kies(page, "ai_uitlegbaarheid", "Beperkt uitlegbaar");
  await geenRodeVlaggen(page);
  await expect(page.locator(".voortgang")).toContainText("zijn beantwoord");
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Eerst toetsen", level: 2 })).toBeVisible();
  await expect(card).toContainText("AI: Beperkt risico");
  await expect(card).toContainText("Uitlegbaarheid: Beperkt uitlegbaar (jouw antwoord)");
  await expect(card).toContainText("Privacy: niet van toepassing");
  await expect(card.getByRole("row", { name: /5\. Impact/ })).toContainText("Integriteit: Serieus");
  // Op de adviescard: wat je extra moet regelen, alleen bij het gekozen antwoord.
  await expect(card).toContainText("Wat moet je extra regelen?");
  await expect(card).toContainText("Persoonlijke oplossing: + documentatie, security");
  await expect(card).not.toContainText("Bedrijfsoplossing: + monitoring");
});

test("rood zonder alternatief: status 'Contact volgt' (scenario 9)", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await naarChecks(page);
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

test("'i'-knopje bij een keuze toont de toelichting, kiest het antwoord niet, en sluit met Escape", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await naarChecks(page);

  const data = page.locator("#veld-data");
  const info = data.getByRole("button", { name: "Uitleg bij Persoonsgegevens" });
  await expect(info).toHaveAttribute("aria-expanded", "false");
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  await expect(data.locator(".keuze__uitleg")).toContainText("Persoonsgegevens: Naam, e-mailadres, personeelsnummer");
  await expect(data.getByLabel("Persoonsgegevens", { exact: true })).not.toBeChecked();

  // Een ander knopje vervangt de toelichting; Escape sluit hem.
  await data.getByRole("button", { name: "Uitleg bij Openbaar" }).click();
  await expect(data.locator(".keuze__uitleg")).toContainText("Openbaar: Informatie die iedereen mag zien");
  await page.keyboard.press("Escape");
  await expect(data.locator(".keuze__uitleg")).toBeHidden();

  // Elke keuze bij de checks (behalve Impact, met voorbeelden) heeft een knopje.
  await expect(page.locator("#veld-autonomie").getByRole("button", { name: /^Uitleg bij/ })).toHaveCount(6);
  await expect(page.locator("#veld-impact").getByRole("button", { name: /^Uitleg bij/ })).toHaveCount(0);
});
