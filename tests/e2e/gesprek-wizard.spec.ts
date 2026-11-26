/**
 * Stap 3 als gesprek: de coach stelt de vragen één voor één. Eerdere antwoorden zijn te wijzigen,
 * en de lijst met alle vragen blijft beschikbaar.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login, naarChecks, naarStap3 } from "./hulp";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const actief = (page: Page) => page.locator(".gesprek__bericht--actief");
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
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een overzicht van verlof voor mijn team, met namen van collega's (testscenario).");
  await naarChecks(page, /past, verder/, { weergave: "gesprek" });

  // Standaard het gesprek: één vraag tegelijk, beginnend bij check 1. Nog geen knop naar het advies.
  await expect(actief(page)).toHaveCount(1);
  await expect(actief(page).locator("h2")).toContainText("Check 1 van 6");
  await expect(page.getByRole("button", { name: "Bekijk het advies →" })).toHaveCount(0);
  const eersteVraag = await actief(page).locator("legend").first().innerText();

  const r1 = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(r1.violations.map((v) => `${v.id} (${v.nodes.length}×) ${v.help}`)).toEqual([]);

  // Eerste vraag beantwoorden: de vraag schuift naar de geschiedenis, de focus gaat naar de volgende vraag.
  const knoppen = [await beantwoord(page)];
  await expect(actief(page).locator("h2")).toBeFocused();
  await expect(page.locator(".gesprek__paar")).toHaveCount(1);
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
  await expect(page.locator(".voortgang")).toContainText(/Alle \d+ vragen zijn beantwoord/);
  await page.getByRole("button", { name: "Terug naar het gesprek" }).click();
  await expect(page.getByText("Dat waren alle vragen.")).toBeVisible();

  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.locator(".adviescard")).toBeVisible();

  // Terug naar de checks: het gesprek staat er nog, met alle antwoorden.
  await page.getByRole("button", { name: "← Terug" }).click();
  await expect(page.getByText("Dat waren alle vragen.")).toBeVisible();
});

test("het gesprek onthoudt waar je was na herladen", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await naarStap3(page, "Een prototype voor mezelf met testdata.");
  await naarChecks(page, /past, verder/, { weergave: "gesprek" });
  await beantwoord(page);
  await beantwoord(page);
  const kop = await actief(page).locator("h2").innerText();
  await expect(page.locator(".gesprek__paar")).toHaveCount(2);
  // Het concept wordt kort na een wijziging opgeslagen.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator(".gesprek__paar")).toHaveCount(2);
  await expect(actief(page).locator("h2")).toHaveText(kop);

  // Opruimen: geen onafgemaakt idee achterlaten voor de andere tests (die delen de database).
  const concept = new URL(page.url()).searchParams.get("concept");
  expect((await page.request.delete(`/api/concept/${concept}`)).ok()).toBe(true);
});
