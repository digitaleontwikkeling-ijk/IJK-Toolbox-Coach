/** Van aanvraag tot besluit: medewerker → beide toetsers → medewerker ziet de uitkomst. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { geenRodeVlaggen, kies, login, naarStap3, naarChecks, rustigeVerdieping } from "./hulp";

test.describe.configure({ mode: "serial" });
let referentie = "";

async function geenOvertredingen(page: Page) {
  // Next.js vult de paginatitel bij dynamische pagina's iets later in; wacht daarop.
  await expect(page).toHaveTitle(/IJK Toolbox Coach/);
  // En tot de pagina klaar is met laden (geen "Bezig met laden…" meer).
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Bezig met laden…")).toHaveCount(0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("medewerker dient een aanvraag in voor toetsing", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await naarStap3(page, "Een verzuimdashboard bouwen voor de afdeling met gegevens uit AFAS.");
  await naarChecks(page);
  await kies(page, "bijzondere_persoonsgegevens", "Ja");
  await rustigeVerdieping(page, { kwetsbare_groepen: "Ja" });
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
  await expect(page.locator(".aanvraag", { hasText: referentie })).toContainText("Ingediend door: Testmedewerker Anna · anna@voorbeeld.invalid");
  await geenOvertredingen(page);
  await page.getByRole("link", { name: referentie }).click();
  await expect(page.getByRole("heading", { name: `Aanvraag ${referentie}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "anna@voorbeeld.invalid" })).toHaveAttribute("href", "mailto:anna@voorbeeld.invalid");
  // Titel van de use case (eerste zin) en de volledige beschrijving.
  await expect(page.getByRole("heading", { name: "Use case: Een verzuimdashboard bouwen voor de afdeling met gegevens uit AFAS", level: 2 })).toBeVisible();
  const kaart = page.locator(".adviescard");
  await expect(kaart).toContainText("Privacy: Waarschijnlijk volledige DPIA nodig");
  // Waarom deze kleur in zinnen; aandachtspunten onder een eigen titel; geen uitleg over de coach en geen disclaimer.
  await expect(kaart).toContainText("De uitkomst is ‘Eerst toetsen’ (oranje). Dat komt door het volgende:");
  await expect(kaart.getByRole("heading", { name: "Aandachtspunten voor de toetsing", level: 3 })).toBeVisible();
  await expect(kaart.getByRole("heading", { name: /^Privacy:/, level: 4 })).toBeVisible();
  await expect(kaart).not.toContainText("niet door de AI agent");
  await expect(kaart).not.toContainText("eerste risico-indicatie");
  // Het overzicht met alle vragen en antwoorden staat onder de adviescard.
  const onder = await page.evaluate(() => {
    const k = document.querySelector(".adviescard")!, o = document.querySelector(".overzicht")!;
    return !!(k.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(onder).toBe(true);

  // Alle vragen en antwoorden: ingeklapt; open: per vraag het antwoord en de herkomst.
  const overzicht = page.locator(".overzicht");
  await expect(overzicht.getByRole("table")).toHaveCount(0);
  await overzicht.getByText(/^Alle vragen en antwoorden \(\d+\)$/).click();
  const data = overzicht.getByRole("row", { name: /Welke data gebruik je\?/ });
  await expect(data).toContainText("Persoonsgegevens");
  // Kleurlabel bij het antwoord; de tabel "Antwoorden" staat niet meer op de kaart.
  await expect(data.locator(".badge-kleur")).toHaveText("oranje");
  await expect(page.locator(".adviescard").getByRole("heading", { name: "Antwoorden" })).toHaveCount(0);
  await expect(data).toContainText(/Zelf gekozen|Voorstel van de coach, bevestigd|Zelf aangepast/);
  await expect(overzicht.getByRole("row", { name: /kwetsbare positie/ })).toContainText("Ja");
  await expect(overzicht.getByRole("row", { name: /Welke tool past\?/ })).toBeVisible();
  await expect(overzicht).toContainText("Aanvullende vragen");
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
  await expect(page.locator(".aanvraag", { hasText: referentie })).toContainText("Ingediend door: Testmedewerker Anna");
  await page.getByRole("link", { name: referentie }).click();
  await expect(page.getByRole("heading", { name: `Aanvraag ${referentie}` })).toBeVisible();
  await expect(page.locator(".paneel").first()).toContainText("Ingediend door: Testmedewerker Anna");
  await expect(page.locator(".adviescard")).toContainText("Besluiten van de toetsers");
  await expect(page.getByRole("button", { name: "Besluit vastleggen" })).toHaveCount(0);
});

test("na het inloggen begint iedereen op de pagina die bij de rol hoort; alleen medewerkers zien Nieuw idee", async ({ page }) => {
  for (const [naam, pad, eerste] of [
    ["Testmedewerker Bram", "/wizard", "Nieuw idee"],
    ["Testtoetser Compliance", "/toetsing", "Toetsing"],
    ["Testtoetser Architect", "/toetsing", "Toetsing"],
    ["Testbeheerder", "/beheer", "Beheer"],
  ] as const) {
    await login(page, naam, { nieuwIdee: false });
    await expect(page).toHaveURL(new RegExp(`${pad}(\\?|$)`));
    const menu = page.getByRole("navigation", { name: "Hoofdmenu" }).getByRole("link");
    await expect(menu.first()).toHaveText(eerste);
    // Alleen medewerkers dienen ideeën in; toetsers en beheerders niet.
    const medewerker = naam.startsWith("Testmedewerker");
    await expect(menu.filter({ hasText: "Nieuw idee" })).toHaveCount(medewerker ? 1 : 0);
    await expect(menu.filter({ hasText: "Mijn aanvragen" })).toHaveCount(medewerker ? 1 : 0);
    if (!medewerker) {
      await page.goto("/wizard");
      await expect(page.getByRole("heading", { name: "Geen toegang" })).toBeVisible();
    }
  }
  // De startpagina (/) stuurt ook naar de pagina bij de rol.
  await login(page, "Testbeheerder", { nieuwIdee: false });
  await page.goto("/");
  await expect(page).toHaveURL(/\/beheer$/);
});
