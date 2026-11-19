import { expect, type Page } from "@playwright/test";

export async function login(page: Page, naam: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(naam) }).click();
  await page.waitForURL("**/wizard");
}

/** Kiest een antwoord binnen het blok van een check, extra vraag of rode vlag. */
export async function kies(page: Page, veld: string, label: string) {
  await page.locator(`#veld-${veld}`).getByText(label, { exact: true }).first().click();
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
