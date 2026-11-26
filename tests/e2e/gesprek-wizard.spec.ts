/**
 * Stap 3 als gesprek: de coach stelt de vragen één voor één. Eerdere antwoorden zijn te wijzigen,
 * en de lijst met alle vragen blijft beschikbaar.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login, naarChecks, naarStap3 } from "./hulp";


const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const actief = (page: Page) => page.locator(".gesprek__bericht--actief");
/** De beantwoorde vragen van de checks (niet die van fase 1). */
const paren = (page: Page) => page.locator(".gesprek:not(.gesprek--fase1) .gesprek__paar");
const verder = (page: Page) => actief(page).getByRole("button", { name: /^(Ja, klopt|Volgende) →$/ });

/** Beantwoordt de huidige vraag (het voorstel, "Nee", of de eerste optie) en gaat verder. */
async function beantwoord(page: Page): Promise<string> {
  const a = actief(page);
  if ((await a.locator(".keuze__opties input:checked").count()) === 0) {
    const nee = a.locator(".keuze__opties label").getByText("Nee", { exact: true });
    await ((await nee.count()) ? nee.first() : a.locator(".keuze__opties label").first()).click();
  }
  const knop = (await verder(page).innerText()).trim();
  await verder(page).click();
  return knop;
}

test("het gesprek: één vraag tegelijk, voorstellen bevestigen, een antwoord wijzigen en het advies bekijken", async ({ page }) => {
  await login(page, "Testmedewerker Chris", { weergave: "gesprek" });
  await naarStap3(page, "Een overzicht van verlof voor mijn team, met namen van collega's (testscenario).");
  await naarChecks(page, /past, verder/, { weergave: "gesprek" });

  // Standaard het gesprek: één vraag tegelijk, beginnend bij check 1. Nog geen knop naar het advies.
  await expect(actief(page)).toHaveCount(1);
  await expect(actief(page).locator("h2")).toContainText("Check 1 van 6");
  await expect(page.getByRole("button", { name: "Bekijk het advies →" })).toHaveCount(0);
  const eersteVraag = await actief(page).locator("legend").first().innerText();

  const r1 = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r1.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  // De chat zit in het gesprek (geen chatvenster ernaast): een vraag stellen bij de huidige vraag.
  await expect(page.locator("aside.chat")).toHaveCount(0);
  await actief(page).getByLabel("Iets niet duidelijk? Vraag het mij").fill("Wat bedoel je hiermee?");
  await actief(page).getByRole("button", { name: "Stuur" }).click();
  const antwoord = actief(page).locator(".gesprek__bericht--chat.gesprek__bericht--coach");
  await expect(antwoord).toContainText(eersteVraag.split("\n")[0]!);
  await expect(actief(page).getByLabel("Iets niet duidelijk? Vraag het mij")).toHaveValue("");

  // Eerste vraag beantwoorden: de vraag schuift naar de geschiedenis, de focus gaat naar de volgende vraag.
  const knoppen = [await beantwoord(page)];
  // De vraag aan de coach en zijn antwoord blijven in de geschiedenis staan, bij die vraag.
  await expect(paren(page).first()).toContainText("Wat bedoel je hiermee?");
  await expect(actief(page).locator("h2")).toBeFocused();
  await expect(paren(page)).toHaveCount(1);
  await expect(page.locator(".gesprek__bericht--jij").first()).toContainText("Jij");

  // Een eerder antwoord wijzigen: de vraag gaat weer open, daarna verder waar je was.
  const tweedeKop = await actief(page).locator("h2").innerText();
  await page.getByRole("button", { name: `Wijzig: ${eersteVraag.split("\n")[0]}` }).click();
  await expect(actief(page).locator("h2")).toContainText("Check 1 van 6");
  await expect(actief(page).locator("h2")).toBeFocused();
  const opties = actief(page).locator(".keuze__opties input[type=radio]:not(:checked)");
  if (await opties.count()) await actief(page).locator(`label[for="${await opties.first().getAttribute("id")}"]`).click();
  await verder(page).click();
  await expect(actief(page).locator("h2")).toHaveText(tweedeKop);

  // Alle vragen doorlopen.
  for (let i = 0; i < 60 && (await verder(page).count()); i++) knoppen.push(await beantwoord(page));
  // De coach deed voorstellen die met één klik te bevestigen waren.
  expect(knoppen).toContain("Ja, klopt →");

  // Klaar: de samenvatting en de knop naar het advies.
  await expect(page.getByText("Dat waren alle vragen.")).toBeFocused();
  await expect(page.locator(".voortgang")).toContainText(/Alle \d+ vragen zijn beantwoord/);
  const r2 = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r2.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  // De lijst laat dezelfde antwoorden zien; terug naar het gesprek verandert niets.
  await page.getByRole("button", { name: "Toon alle vragen op één pagina" }).click();
  await expect(page.getByRole("heading", { name: "De zes checks" })).toBeVisible();
  // In de lijst staat het chatvenster weer naast de vragen, met het hele gesprek.
  await expect(page.locator("aside.chat")).toContainText("Wat bedoel je hiermee?");
  await expect(page.locator(".voortgang")).toContainText(/Alle \d+ vragen zijn beantwoord/);
  await page.getByRole("button", { name: "Terug naar het gesprek" }).click();
  await expect(page.getByText("Dat waren alle vragen.")).toBeVisible();

  await page.getByRole("button", { name: "Bekijk het advies →" }).click();

  // Het advies als laatste beurt van de coach, met het gesprek erboven (alleen lezen) en de chat eronder.
  const advies = actief(page);
  await expect(advies.locator(".adviescard")).toBeVisible();
  await expect(page.locator("#advies-kop")).toBeFocused();
  await expect(advies).toContainText("Het volgt uit de vaste spelregels van IJK");
  await expect(page.getByText("Dat waren alle vragen.")).toHaveCount(0);
  await expect(page.locator("aside.chat")).toHaveCount(0);
  await expect(paren(page).first()).toBeHidden();
  await page.getByText("Lees het gesprek terug").click();
  await expect(paren(page).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Wijzig/ })).toHaveCount(0);
  // De uitleg van de coach komt in het gesprek, bij het advies.
  await expect(advies.locator(".gesprek__bericht--chat.gesprek__bericht--coach").first()).toBeVisible();
  await advies.getByRole("button", { name: "Vraag stellen" }).click();
  await expect(advies.getByLabel("Vragen over het advies? Stel ze aan mij")).toBeFocused();
  await page.keyboard.type("Wat moet ik nu doen?");
  await page.keyboard.press("Enter");
  await expect(advies.locator(".gesprek__bericht--chat.gesprek__bericht--jij")).toContainText("Wat moet ik nu doen?");
  await expect(advies.locator(".gesprek__bericht--chat.gesprek__bericht--coach")).toHaveCount(2);
  const r3 = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r3.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  // Ook bij het advies kun je naar het formulier (met het chatvenster ernaast) en terug.
  await page.getByRole("button", { name: "Toon als formulier" }).click();
  await expect(page.locator("aside.chat")).toContainText("Wat moet ik nu doen?");
  await expect(page.locator(".adviescard")).toBeVisible();
  await page.getByRole("button", { name: "Terug naar het gesprek" }).click();
  await expect(actief(page).locator(".adviescard")).toBeVisible();

  // Terug naar de checks: het gesprek staat er nog, met alle antwoorden.
  await page.getByRole("button", { name: "← Terug" }).click();
  await expect(page.getByText("Dat waren alle vragen.")).toBeVisible();
});

test("het gesprek onthoudt waar je was na herladen", async ({ page }) => {
  await login(page, "Testmedewerker Chris", { weergave: "gesprek" });
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await naarChecks(page, /past, verder/, { weergave: "gesprek" });
  await beantwoord(page);
  await beantwoord(page);
  const kop = await actief(page).locator("h2").innerText();
  await expect(paren(page)).toHaveCount(2);
  // Het concept wordt kort na een wijziging opgeslagen.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(paren(page)).toHaveCount(2);
  await expect(actief(page).locator("h2")).toHaveText(kop);

  // Opruimen: geen onafgemaakt idee achterlaten voor de andere tests (die delen de database).
  const concept = new URL(page.url()).searchParams.get("concept");
  expect((await page.request.delete(`/api/concept/${concept}`)).ok()).toBe(true);
});

test("fase 1 als gesprek: beschrijving, vragen van de coach, tooladvies en de uitleg over fase 2", async ({ page }) => {
  await login(page, "Testmedewerker Chris", { weergave: "gesprek" });
  // Het gesprek gebruikt de volle breedte; de chat zit in het gesprek.
  await expect(page.locator("aside.chat")).toHaveCount(0);
  await expect(actief(page).getByRole("heading", { name: "Waar kan ik je mee helpen?" })).toBeVisible();
  const r1 = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r1.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  await actief(page).getByLabel("Jouw probleem of idee").fill("Een overzicht van verlof voor mijn team (testscenario).");
  await actief(page).getByRole("button", { name: "Volgende →" }).click();
  // Eventuele vragen van de coach zijn niet verplicht.
  await expect(actief(page).getByRole("heading", { name: /Ik heb nog|Mijn advies/ })).toBeVisible();
  if (await actief(page).getByRole("heading", { name: /Ik heb nog/ }).isVisible()) {
    await expect(actief(page).getByRole("heading", { name: /Ik heb nog/ })).toBeFocused();
    await actief(page).getByRole("button", { name: "Volgende →" }).click();
  }

  // Het tooladvies als vraag van de coach, met de beschrijving als antwoord erboven.
  await expect(actief(page).getByRole("heading", { name: "Mijn advies" })).toBeFocused();
  await expect(page.locator(".gesprek--fase1, .gesprek").first()).toContainText("Een overzicht van verlof voor mijn team");
  await expect(actief(page)).not.toContainText(/de coach/i);
  await expect(actief(page)).toContainText("Dit adviseer ik");
  const toolKnop = actief(page).getByRole("button", { name: /past, verder →$/ });
  await expect(toolKnop).toBeVisible();
  const tool = (await toolKnop.innerText()).replace(/ past, verder →$/, "");

  // Een vraag aan de coach bij het tooladvies.
  await actief(page).getByLabel("Iets niet duidelijk? Vraag het mij").fill(`Wat mag ik met ${tool}?`);
  await actief(page).getByRole("button", { name: "Stuur" }).click();
  await expect(actief(page).locator(".gesprek__bericht--chat.gesprek__bericht--coach")).toContainText(tool);
  const r2 = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r2.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  // De beschrijving wijzigen: terug naar die vraag, daarna verder naar het tooladvies.
  await page.getByRole("button", { name: "Wijzig: Wat wil je bereiken?" }).click();
  await expect(actief(page).getByRole("heading", { name: "Waar kan ik je mee helpen?" })).toBeFocused();
  await actief(page).getByLabel("Jouw probleem of idee").fill("Een overzicht van verlof voor mijn team, aangepast (testscenario).");
  await actief(page).getByRole("button", { name: "Volgende →" }).click();
  await expect(actief(page).getByRole("heading", { name: "Mijn advies" })).toBeVisible();

  // Verder: de uitleg over fase 2 in het gesprek, daarna de eerste check.
  await actief(page).getByRole("button", { name: /past, verder →$/ }).click();
  await expect(actief(page).getByRole("heading", { name: "Hoe gaat fase 2 in zijn werk?" })).toBeFocused();
  // De coach praat zelf: geen "de coach" in zijn beurt.
  await expect(actief(page)).not.toContainText(/de coach/i);
  await expect(actief(page)).toContainText("Ik ben een AI agent.");
  await actief(page).getByRole("button", { name: "Begin met de checks →" }).click();
  await expect(actief(page).locator("h2")).toContainText("Check 1 van 6");
  await expect(actief(page).locator("h2")).toBeFocused();
  // Fase 1 staat erboven, met de gekozen tool en de vraag aan de coach.
  const fase1 = page.locator(".gesprek--fase1");
  await expect(fase1).toContainText("aangepast");
  await expect(fase1).toContainText(`Wat mag ik met ${tool}?`);
  await expect(fase1.locator(".gesprek__bericht--jij").last()).toContainText(tool);

  // Naar het formulier en terug: de voorkeur geldt voor de hele wizard.
  await page.getByRole("button", { name: "Toon alle vragen op één pagina" }).click();
  await expect(page.locator("aside.chat")).toBeVisible();
  await page.getByRole("button", { name: "← Terug" }).click();
  await expect(page.getByRole("button", { name: "Terug naar het gesprek" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mijn advies" })).toHaveCount(0);
  await page.getByRole("button", { name: "Terug naar het gesprek" }).click();
  await expect(actief(page).getByRole("heading", { name: "Mijn advies" })).toBeVisible();

  // Opruimen: geen onafgemaakt idee achterlaten voor de andere tests.
  const concept = new URL(page.url()).searchParams.get("concept");
  expect((await page.request.delete(`/api/concept/${concept}`)).ok()).toBe(true);
});
