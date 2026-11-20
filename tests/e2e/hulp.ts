import { expect, type Page } from "@playwright/test";

/** Inloggen en met een nieuw, leeg idee beginnen (tests delen één database). */
export async function login(page: Page, naam: string, opties: { nieuwIdee?: boolean } = {}) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(naam) }).click();
  await page.waitForURL("**/wizard");
  if (opties.nieuwIdee !== false) {
    await page.request.post("/api/concept");
    await page.reload();
  }
}

/**
 * Kiest precies dit antwoord binnen het blok van een check, extra vraag of rode vlag.
 * Bij een check met meerdere antwoorden worden andere aangevinkte antwoorden eerst uitgezet.
 */
export async function kies(page: Page, veld: string, label: string) {
  const blok = page.locator(`#veld-${veld} > fieldset`).first();
  const vakjes = blok.locator(':scope > .keuze__opties input[type="checkbox"]');
  for (let i = 0; i < (await vakjes.count()); i++) {
    const v = vakjes.nth(i);
    const tekst = await page.locator(`label[for="${await v.getAttribute("id")}"]`).innerText();
    if ((await v.isChecked()) !== (tekst === label)) await page.locator(`label[for="${await v.getAttribute("id")}"]`).click();
  }
  if ((await vakjes.count()) === 0) await blok.getByText(label, { exact: true }).first().click();
}

/** Vinkt een extra antwoord aan bij een check met meerdere antwoorden. */
export async function vinkAan(page: Page, veld: string, label: string) {
  const l = page.locator(`#veld-${veld} > fieldset > .keuze__opties`).getByText(label, { exact: true });
  const id = await l.getAttribute("for");
  if (!(await page.locator(`#${id}`).isChecked())) await l.click();
}

export async function geenRodeVlaggen(page: Page) {
  for (const v of ["niet_goedgekeurde_tool", "persoonlijke_inlog_of_secrets", "ai_beslist_over_mensen", "open_zonder_toetsing"]) {
    await kies(page, v, "Nee");
  }
}

export async function naarStap3(page: Page, beschrijving: string) {
  await page.getByLabel("Jouw probleem of idee").fill(beschrijving);
  await page.getByRole("button", { name: "Volgende →" }).click();
  // De coach kan verduidelijkende vragen stellen; die zijn niet verplicht.
  const h = page.getByRole("heading", { name: /Welke tool past|De coach heeft nog/ });
  await h.first().waitFor();
  if (await page.getByRole("heading", { name: /De coach heeft nog/ }).isVisible()) {
    await page.getByRole("button", { name: "Volgende →" }).click();
  }
  await expect(page.getByRole("heading", { name: /Welke tool past/ })).toBeVisible();
}
