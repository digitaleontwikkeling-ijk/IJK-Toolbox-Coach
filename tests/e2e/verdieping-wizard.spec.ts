/**
 * Regelset 0.8: privacy en AI geïntegreerd in de checks (scenario's 8, 13, 14 en 16 van de opdracht).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, kiesImpact, login, naarChecks, naarStap3, rustigeVerdieping, vinkAan } from "./hulp";

test("vragen verschijnen alleen als ze nodig zijn; terugzetten naar openbare gegevens haalt ze weer weg", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een overzicht van verlof voor mijn team (testscenario).");
  await page.getByRole("button", { name: "Zelf een tool kiezen" }).click();
  await page.getByText("Claude Code", { exact: true }).click();
  await naarChecks(page, "Claude Code past, verder →");

  await kies(page, "data", "Openbaar");
  await kies(page, "systemen", "Koppelen");
  await expect(page.locator("#veld-kwetsbare_groepen")).toHaveCount(0);

  // Persoonsgegevens: de privacyvragen verschijnen onder de checks, met een korte uitleg waarom.
  await kies(page, "data", "Persoonsgegevens");
  await expect(page.getByText("Je gaf aan dat je persoonsgegevens gebruikt.").first()).toBeVisible();
  await expect(page.locator("#veld-kwetsbare_groepen")).toBeVisible();
  // Koppelen is een signaal, geen bewijs: een verduidelijking met inleiding (geen nieuwe vraag over systemen).
  await expect(page.locator("#veld-koppeling_datasets")).toContainText("Je koppelt systemen");
  await kies(page, "kwetsbare_groepen", "Ja");
  // Ook bij de extra vraag over bijzondere persoonsgegevens kun je twijfel aangeven.
  await kies(page, "bijzondere_persoonsgegevens", "Weet ik niet zeker");

  // Toegankelijkheid van stap 3 met de extra vragen.
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  // Terug naar openbaar: de privacyvragen verdwijnen en tellen niet meer mee.
  await kies(page, "data", "Openbaar");
  await expect(page.locator("#veld-kwetsbare_groepen")).toHaveCount(0);
  await kiesImpact(page);
  await rustigeVerdieping(page);
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  const card = page.locator(".adviescard");
  await expect(card).toContainText("Privacy: niet van toepassing");
  await expect(card).not.toContainText("kwetsbare positie");

  // Opnieuw persoonsgegevens: het eerdere antwoord staat er weer (niets kwijt).
  await page.getByRole("button", { name: "← Terug" }).click();
  await kies(page, "data", "Persoonsgegevens");
  await expect(page.locator("#veld-kwetsbare_groepen").getByLabel("Ja", { exact: true })).toBeChecked();
});

test("toetsenbord: een verdiepingsvraag beantwoorden met pijltjes, en de voortgang wordt bijgewerkt", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await naarChecks(page);
  const voortgang = page.locator(".voortgang");
  await expect(voortgang).toHaveAttribute("role", "status");
  const voor = await voortgang.innerText();
  const nee = page.locator("#veld-ai_gebruik").getByLabel("Nee", { exact: true });
  await page.locator("#veld-ai_gebruik").getByLabel("Ja", { exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(nee).toBeChecked();
  await expect(nee).toBeFocused();
  await expect(voortgang).not.toHaveText(voor);
});

test("verduidelijkende vragen: meerdere antwoorden kiezen, en 'Iets anders' met een eigen antwoord", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await page.getByLabel("Jouw probleem of idee").fill("Vergaderingen moeten automatisch worden uitgeschreven");
  await page.getByRole("button", { name: "Volgende →" }).click();
  const gegevens = page.getByRole("group", { name: /Met welke gegevens ga je werken\?/ });
  // De focus staat op de eerste keuze van de eerste vraag.
  await expect(gegevens.getByRole("checkbox").first()).toBeFocused();
  await expect(gegevens).toContainText("Je kunt meerdere antwoorden kiezen.");
  await vinkAan(page, "verduidelijking-0", "Interne werkinformatie, zoals werkinstructies");
  await vinkAan(page, "verduidelijking-0", "Weet ik niet zeker");
  await vinkAan(page, "verduidelijking-1", "Mijn team of een paar collega's");
  await vinkAan(page, "verduidelijking-1", "Iets anders");
  const eigen = page.getByLabel("Jouw eigen antwoord op: Wie gaat de oplossing gebruiken?");
  await expect(eigen).toBeFocused();
  await eigen.fill("Twee externe adviseurs");

  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  // Vooruit en terug: alle keuzes en het eigen antwoord staan er nog.
  await page.getByRole("button", { name: "Volgende →" }).click();
  await expect(page.getByRole("heading", { name: /Welke tool past/ })).toBeVisible();
  await page.getByRole("button", { name: "← Terug" }).click();
  await expect(page.getByLabel("Interne werkinformatie, zoals werkinstructies")).toBeChecked();
  await expect(page.getByLabel("Weet ik niet zeker")).toBeChecked();
  await expect(page.getByLabel("Mijn team of een paar collega's")).toBeChecked();
  await expect(page.getByLabel("Jouw eigen antwoord op: Wie gaat de oplossing gebruiken?")).toHaveValue("Twee externe adviseurs");

  // De antwoorden helpen de coach bij het voorinvullen van de checks.
  await page.getByRole("button", { name: "Volgende →" }).click();
  await naarChecks(page);
  await expect(page.locator("#veld-data > fieldset").first().getByLabel("Weet ik niet zeker", { exact: true }).first()).toBeChecked();
});
