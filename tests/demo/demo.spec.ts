/** De statische demo: volledige keten in de browser, zonder server. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const B = "/IJK-Toolbox-Coach";
const kies = (p: Page, veld: string, label: string) => p.locator(`#veld-${veld}`).getByText(label, { exact: true }).first().click();

async function login(page: Page, naam: string) {
  await page.goto(`${B}/login/`);
  await page.getByRole("button", { name: new RegExp(naam) }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  await page.waitForLoadState("networkidle");
}

test("demo: medewerker → toetsers → besluit, beheer, en geen WCAG-overtredingen", async ({ page }) => {
  const fouten: string[] = [];
  page.on("pageerror", (e) => fouten.push(e.message));

  await page.goto(`${B}/`);
  await page.waitForURL(`**${B}/login/`);
  await expect(page.getByText("Alles blijft in je eigen browser")).toBeVisible();

  await login(page, "Testmedewerker Anna");
  await expect(page).toHaveURL(new RegExp(`${B}/wizard/(\\?concept=.*)?$`));
  await page.getByLabel("Jouw probleem of idee").fill("HR-gegevens van mijn afdeling wekelijks automatisch in AFAS verwerken.");
  await page.getByRole("button", { name: "Volgende →" }).click();
  if (await page.getByRole("heading", { name: /De coach heeft nog/ }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Volgende →" }).click();
  }
  await expect(page.getByRole("heading", { name: "HubBI", level: 3 })).toBeVisible();
  await page.getByRole("button", { name: "HubBI past, verder →" }).click();
  // Eerst de uitleg over fase 2.
  await expect(page.getByRole("heading", { name: "Fase 2 · Mag ik dit doen?" })).toBeVisible();
  await page.getByRole("button", { name: "Begin met de checks →" }).click();
  await expect(page.getByLabel("Persoonsgegevens", { exact: true })).toBeChecked();
  await kies(page, "bijzondere_persoonsgegevens", "Nee");
  for (const v of ["persoonlijke_inlog_of_secrets", "ai_beslist_over_mensen", "open_zonder_toetsing", "proces_zonder_eigenaar"]) await kies(page, v, "Nee");
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.getByRole("heading", { name: "Eerst toetsen", level: 2 })).toBeVisible();
  const ref = (await page.locator(".adviescard__voet strong").innerText()).trim();
  expect((await new AxeBuilder({ page }).withTags(["wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Aanvraag indienen voor toetsing" }).click();
  await expect(page.locator(".adviescard")).toContainText("Status: In toetsing");

  // Afronden → Mijn aanvragen met bevestiging; herladen: gegevens blijven (localStorage).
  await page.getByRole("button", { name: "Afronden" }).click();
  await page.waitForURL(`**${B}/mijn-aanvragen/?afgerond=${ref}`);
  await expect(page.locator(".info[role=status]")).toContainText(`Je advies ${ref} is afgerond`);
  await page.reload();
  await expect(page.locator(".aanvraag", { hasText: ref })).toContainText("In toetsing");

  // Beide toetsers
  for (const [naam, besluit, toelichting] of [
    ["Testtoetser Compliance", "Goedgekeurd met voorwaarden", "Eerst een DPIA uitvoeren."],
    ["Testtoetser Architect", "Goedgekeurd", ""],
  ] as const) {
    await login(page, naam);
    // Toetsers beginnen op hun eigen pagina.
    await expect(page).toHaveURL(new RegExp(`${B}/toetsing/$`));
    await page.getByRole("link", { name: ref }).click();
    await page.getByText(besluit, { exact: true }).click();
    if (toelichting) await page.getByLabel(/Welke voorwaarden gelden/).fill(toelichting);
    await page.getByRole("button", { name: "Besluit vastleggen" }).click();
    await expect(page.getByText("Je besluit is vastgelegd.")).toBeVisible();
  }

  await login(page, "Testmedewerker Anna");
  await page.getByRole("link", { name: "Mijn aanvragen", exact: true }).click();
  await expect(page.locator(".aanvraag", { hasText: ref })).toContainText("Goedgekeurd met voorwaarden");
  await page.locator(".aanvraag", { hasText: ref }).getByRole("link", { name: /Bekijk advies/ }).click();
  await expect(page.locator(".adviescard")).toContainText("Eerst een DPIA uitvoeren.");

  await login(page, "Testbeheerder");
  await expect(page).toHaveURL(new RegExp(`${B}/beheer/$`));
  await expect(page.getByText("Regelset versie")).toBeVisible();
  await expect(page.getByRole("link", { name: ref })).toBeVisible();

  // Medewerker heeft geen toegang tot toetsing.
  await login(page, "Testmedewerker Bram");
  await page.goto(`${B}/toetsing/`);
  await expect(page.getByRole("heading", { name: "Geen toegang" })).toBeVisible();

  // Uitlegpagina in de demo, met de melding over de oefencoach.
  await page.goto(`${B}/hoe-werkt-het/`);
  await expect(page.getByRole("heading", { name: "Hoe werkt de coach?", level: 1 })).toBeVisible();
  await expect(page.getByText("In deze demo is de coach een oefencoach zonder AI.")).toBeVisible();

  // Demo leegmaken
  await page.getByRole("button", { name: "Demo leegmaken" }).click();
  await page.waitForURL(`**${B}/login/`);
  expect(fouten).toEqual([]);
});
