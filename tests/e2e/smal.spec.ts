/** Smal scherm (telefoon / smal Teams-tabblad): geen horizontaal scrollen, niets valt buiten de kaarten. */
import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, login, naarStap3, naarChecks, rustigeVerdieping } from "./hulp";

test("wizard en adviescard werken op een smal scherm", async ({ page }) => {
  await login(page, "Testmedewerker Chris");
  await expect(page.getByRole("heading", { name: /Wat wil je bereiken/ })).toBeVisible();
  await expect(page.getByLabel("Je vraag aan de coach")).toBeVisible();

  // Een advies met DPIA-signaal: de uitleg bevat het lange woord "gegevensbeschermingseffectbeoordeling".
  await naarStap3(page, "Een verzuimdashboard voor de afdeling met gegevens uit AFAS.");
  await naarChecks(page);
  await kies(page, "bijzondere_persoonsgegevens", "Nee");
  await rustigeVerdieping(page, { kwetsbare_groepen: "Ja", grote_schaal: "Ja" });
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.locator(".adviescard")).toContainText("gegevensbeschermingseffectbeoordeling");

  const overloop = await page.evaluate(() => {
    const kaart = document.querySelector(".adviescard")!.getBoundingClientRect();
    const buiten = [...document.querySelectorAll(".adviescard *")]
      .filter((el) => el.getBoundingClientRect().right > kaart.right + 1)
      .map((el) => `${el.tagName}: ${(el.textContent ?? "").slice(0, 40)}`);
    return { pagina: document.documentElement.scrollWidth - window.innerWidth, buiten };
  });
  expect(overloop).toEqual({ pagina: 0, buiten: [] });
});
