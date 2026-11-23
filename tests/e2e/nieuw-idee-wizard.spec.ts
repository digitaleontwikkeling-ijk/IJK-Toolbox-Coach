/** "Nieuw idee" begint altijd leeg; een onafgemaakt idee kun je bewust hervatten. */
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, login } from "./hulp";

test("Nieuw idee is leeg; onafgemaakt idee hervatten; afgerond idee komt niet terug", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  const beschrijving = page.getByLabel("Jouw probleem of idee");
  await expect(beschrijving).toHaveValue("");
  await expect(page).toHaveURL(/\/wizard\?concept=/);

  // Begin aan een idee; herladen houdt het vast.
  const opgeslagen = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes("/api/concept/"));
  await beschrijving.fill("Een prototype voor mezelf met testdata (onafgemaakt).");
  await opgeslagen;
  await page.reload();
  await expect(beschrijving).toHaveValue("Een prototype voor mezelf met testdata (onafgemaakt).");

  // Via Mijn aanvragen naar Nieuw idee: leeg, met de vraag of je verder wilt met het onafgemaakte idee.
  await page.getByRole("link", { name: "Mijn aanvragen", exact: true }).click();
  await page.getByRole("navigation", { name: "Hoofdmenu" }).getByRole("link", { name: "Nieuw idee" }).click();
  await expect(beschrijving).toHaveValue("");
  await expect(page.locator(".info[role=status]")).toContainText("Je hebt nog een onafgemaakt idee");
  await page.getByRole("link", { name: "Verder met dat idee" }).click();
  await expect(beschrijving).toHaveValue("Een prototype voor mezelf met testdata (onafgemaakt).");

  // Maak het idee af tot een advies.
  await page.getByRole("button", { name: "Volgende →" }).click();
  if (await page.getByRole("heading", { name: /De coach heeft nog/ }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Volgende →" }).click();
  }
  await page.getByRole("button", { name: /past, verder/ }).click();
  await kies(page, "data", "Openbaar");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.locator(".adviescard")).toBeVisible();

  // Nieuw idee na een advies: leeg en zonder melding (het advies staat in Mijn aanvragen).
  await page.getByRole("navigation", { name: "Hoofdmenu" }).getByRole("link", { name: "Nieuw idee" }).click();
  await expect(beschrijving).toHaveValue("");
  await expect(page.getByText("Je hebt nog een onafgemaakt idee")).toHaveCount(0);
});
