/** Beheer: mailsjablonen voor de licentieaanvraag aanpassen en terugzetten; de medewerker krijgt het nieuwe sjabloon. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./hulp";

test("beheerder past het mailsjabloon voor Claude Code aan en zet het terug", async ({ page }) => {
  await login(page, "Testbeheerder", { nieuwIdee: false });
  await page.goto("/beheer");
  await expect(page.getByRole("heading", { name: "Mailsjablonen voor licentieaanvragen", level: 2 })).toBeVisible();
  const form = page.locator("form.mailsjabloon", { has: page.getByRole("heading", { name: /^Claude Code/ }) });
  await expect(form).toContainText("Aan: digitaleontwikkeling@ijk.nl");
  await expect(form.getByLabel("Onderwerp")).toHaveValue("Aanvraag licentie {tool} - {naam}");
  await expect(form.getByLabel("Tekst")).toHaveValue(/licentie aanvragen voor de \{licentie\}/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Aanpassen en opslaan.
  await form.getByLabel("Onderwerp").fill("Licentie {tool} voor {naam}");
  await form.getByRole("button", { name: "Opslaan" }).click();
  await expect(form.getByText("Het sjabloon is opgeslagen.")).toBeVisible();
  await expect(form).toContainText("eigen sjabloon");

  // Na herladen staat het er nog; de content geeft het eigen sjabloon.
  await page.reload();
  await expect(form.getByLabel("Onderwerp")).toHaveValue("Licentie {tool} voor {naam}");
  const c = await (await page.request.get("/api/content")).json();
  expect(c.mailsjablonen.claude_code.onderwerp).toBe("Licentie {tool} voor {naam}");

  // Terug naar de standaard (andere tests verwachten de standaard).
  await form.getByRole("button", { name: "Standaard herstellen" }).click();
  await expect(form.getByText("Het standaardsjabloon geldt weer.")).toBeVisible();
  await expect(form.getByLabel("Onderwerp")).toHaveValue("Aanvraag licentie {tool} - {naam}");
  await expect(form).toContainText("standaard");
});
