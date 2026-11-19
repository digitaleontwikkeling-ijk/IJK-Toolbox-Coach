/** Smal scherm (telefoon / smal Teams-tabblad): geen horizontaal scrollen, alles bereikbaar. */
import { expect, test } from "@playwright/test";
import { login } from "./hulp";

test("wizard werkt op een smal scherm", async ({ page }) => {
  await login(page, "Testtoetser Architect");
  await expect(page.getByRole("heading", { name: /Wat wil je bereiken/ })).toBeVisible();
  const overloop = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overloop).toBeLessThanOrEqual(0);
  await expect(page.getByLabel("Je vraag aan de coach")).toBeVisible();
});
