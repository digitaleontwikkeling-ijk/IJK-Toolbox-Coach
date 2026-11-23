/** De app moet volledig bruikbaar blijven zonder AI (COACH_MODUS=uit). */
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, kiesImpact, login } from "./hulp";

test("zonder coach: alles handmatig invullen geeft een advies", async ({ page }) => {
  await login(page, "Testbeheerder");
  await page.getByLabel("Jouw probleem of idee").fill("Notulen van het teamoverleg automatisch laten maken.");
  await page.getByRole("button", { name: "Volgende →" }).click();

  await expect(page.getByText("De coach is nu niet beschikbaar")).toBeVisible();
  await page.getByText("Microsoft 365 Copilot", { exact: true }).click();
  await page.getByRole("button", { name: "Microsoft 365 Copilot past, verder →" }).click();

  await expect(page.getByText("De coach is nu niet beschikbaar")).toBeVisible();
  await expect(page.getByText("Voorgesteld door de coach")).toHaveCount(0);
  await kies(page, "data", "Intern");
  await kies(page, "systemen", "Geen");
  await kies(page, "gebruikers", "Collega's");
  await kies(page, "autonomie", "Assisteren");
  await kiesImpact(page, { beschikbaarheid: "Beperkt" });
  await kies(page, "afhankelijkheid", "Regelmatig, voor mijn eigen werk (persoonlijke oplossing)");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();

  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Aan de slag met voorwaarden", level: 2 })).toBeVisible();
  await expect(card).toContainText("Wijs een eigenaar aan en documenteer.");

  // Chat zonder coach geeft een nette melding.
  await page.getByRole("button", { name: "Vraag stellen" }).click();
  await expect(page.getByLabel("Je vraag aan de coach")).toBeFocused();
  await page.getByLabel("Je vraag aan de coach").fill("Mag ik dit delen met mijn team?");
  await page.getByRole("button", { name: "Stuur" }).click();
  await expect(page.locator(".chat")).toContainText("De coach is nu niet beschikbaar");
});
