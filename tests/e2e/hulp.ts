import { expect, type Page } from "@playwright/test";

/**
 * Inloggen. Standaard daarna naar de wizard met een nieuw, leeg idee (tests delen één database).
 * Met { nieuwIdee: false } blijf je op de startpagina die bij de rol hoort.
 */
export async function login(page: Page, naam: string, opties: { nieuwIdee?: boolean } = {}) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(naam) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  // /wizard begint altijd met een nieuw, leeg idee.
  if (opties.nieuwIdee !== false) await page.goto("/wizard");
}

/**
 * Kiest precies dit antwoord binnen het blok van een check, extra vraag of rode vlag.
 * Bij een check met meerdere antwoorden worden andere aangevinkte antwoorden eerst uitgezet.
 */
export async function kies(page: Page, veld: string, label: string) {
  // Wacht tot het formulier er staat (niet meer "De coach vult de checks in…").
  await expect(page.getByText("De coach vult de checks alvast voor je in…")).toHaveCount(0);
  const blok = page.locator(`#veld-${veld} > fieldset`).first();
  await blok.waitFor();
  const opties = blok.locator(":scope > .keuze__opties input");
  for (let i = 0; i < (await opties.count()); i++) {
    const invoer = opties.nth(i);
    const id = await invoer.getAttribute("id");
    const isDit = (await page.locator(`label[for="${id}"]`).innerText()) === label;
    const isVakje = (await invoer.getAttribute("type")) === "checkbox";
    // Selectievakjes: precies dit antwoord aan, de rest uit. Keuzerondjes: alleen dit antwoord aanklikken.
    if (isVakje ? (await invoer.isChecked()) !== isDit : isDit) {
      await page.locator(`label[for="${id}"]`).click();
      await expect(invoer).toBeChecked({ checked: isDit });
    }
  }
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
