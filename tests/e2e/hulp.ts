import { expect, type Page } from "@playwright/test";

/**
 * Inloggen. Standaard daarna naar de wizard met een nieuw, leeg idee (tests delen één database).
 * Met { nieuwIdee: false } blijf je op de startpagina die bij de rol hoort.
 */
export async function login(page: Page, naam: string, opties: { nieuwIdee?: boolean; weergave?: "lijst" | "gesprek" } = {}) {
  // De wizard opent standaard als gesprek. De meeste tests gebruiken het formulier (een voorkeur per browser).
  if ((opties.weergave ?? "lijst") === "lijst") {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("toolbox-coach.weergave", "lijst");
      } catch {
        // geen opslag
      }
    });
  }
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
  let gevonden = false;
  for (let i = 0; i < (await opties.count()); i++) {
    const invoer = opties.nth(i);
    const id = await invoer.getAttribute("id");
    // Bij opties met een voorbeeldtekst staat het label apart (.keuze__label).
    const lab = page.locator(`label[for="${id}"]`);
    const tekst = (await lab.locator(".keuze__label").count()) ? await lab.locator(".keuze__label").innerText() : await lab.innerText();
    const isDit = tekst === label;
    if (isDit) gevonden = true;
    const isVakje = (await invoer.getAttribute("type")) === "checkbox";
    // Selectievakjes: precies dit antwoord aan, de rest uit. Keuzerondjes: alleen dit antwoord aanklikken.
    if (isVakje ? (await invoer.isChecked()) !== isDit : isDit) {
      await page.locator(`label[for="${id}"]`).click();
      await expect(invoer).toBeChecked({ checked: isDit });
    }
  }
  if (!gevonden) throw new Error(`Antwoord "${label}" bestaat niet bij "${veld}".`);
}

/** Vinkt een extra antwoord aan bij een check met meerdere antwoorden. */
export async function vinkAan(page: Page, veld: string, label: string) {
  const l = page.locator(`#veld-${veld} > fieldset > .keuze__opties`).getByText(label, { exact: true });
  const id = await l.getAttribute("for");
  if (!(await page.locator(`#${id}`).isChecked())) await l.click();
}

/** Impact: per deelvraag (beschikbaarheid, integriteit, vertrouwelijkheid) een niveau. Niet genoemd = Nauwelijks. */
export async function kiesImpact(page: Page, niveaus: Partial<Record<"beschikbaarheid" | "integriteit" | "vertrouwelijkheid", string>> = {}) {
  for (const d of ["beschikbaarheid", "integriteit", "vertrouwelijkheid"] as const) {
    await kies(page, `impact-${d}`, niveaus[d] ?? "Nauwelijks");
  }
}

export const RODE_VLAGGEN = [
  "persoonlijke_inlog_of_secrets",
  "ai_beslist_over_mensen",
  "open_zonder_toetsing",
  "proces_zonder_eigenaar",
];

/** Antwoorden op de verdiepingsvragen (privacy en AI) die het risico niet verhogen. */
export const RUSTIGE_VERDIEPING: Record<string, string> = {
  ai_gebruik: "Nee",
  kwetsbare_groepen: "Nee",
  koppeling_datasets: "Nee",
  grote_schaal: "Nee",
  profilering: "Nee",
  geautomatiseerd_besluit: "Nee",
  significante_gevolgen: "Nee",
  ai_invloed: "Nee",
  ai_doorslaggevend: "Niet doorslaggevend: een mens beslist",
  ai_domein: "Iets anders",
  ai_discriminatie: "Nee",
  ai_herziening: "Ja, altijd",
  ai_transparantie: "Ja",
  ai_toezicht: "Ja, structureel",
  ai_uitlegbaarheid: "Goed uitlegbaar",
};

/**
 * Beantwoordt de zichtbare verdiepingsvragen die nog open staan met een rustig antwoord
 * (of met `antwoorden[id]`). Herhaalt, omdat een antwoord nieuwe vragen kan laten verschijnen.
 */
export async function rustigeVerdieping(page: Page, antwoorden: Record<string, string> = {}) {
  for (let ronde = 0; ronde < 10; ronde++) {
    let gedaan = false;
    for (const blok of await page.locator("div.verdieping[id^=veld-]").all()) {
      const id = (await blok.getAttribute("id"))!.replace(/^veld-/, "");
      if ((await blok.locator("input:checked").count()) > 0) continue;
      await kies(page, id, antwoorden[id] ?? RUSTIGE_VERDIEPING[id] ?? "Nee");
      gedaan = true;
    }
    if (!gedaan) return;
  }
}

/** Alle zichtbare aanvullende vragen op "Nee", en open verdiepingsvragen rustig beantwoorden. */
export async function geenRodeVlaggen(page: Page) {
  await rustigeVerdieping(page);
  for (const v of RODE_VLAGGEN) {
    if ((await page.locator(`#veld-${v}`).count()) === 0) continue;
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

/**
 * Van stap 2 naar de checks: klik op "<tool> past, verder" en daarna, als het uitlegscherm
 * over fase 2 verschijnt (één keer per idee), op "Begin met de checks".
 */
export async function naarChecks(page: Page, knop: string | RegExp = /past, verder/, opties: { weergave?: "lijst" | "gesprek" } = {}) {
  await page.getByRole("button", { name: knop }).click();
  const begin = page.getByRole("button", { name: "Begin met de checks →" });
  await expect(begin.or(page.getByRole("heading", { name: /Zes checks/ })).first()).toBeVisible();
  if (await begin.isVisible()) await begin.click();
  await expect(page.getByRole("heading", { name: /Zes checks/ })).toBeVisible();
  // Standaard toont de wizard het gesprek. De meeste tests vullen de lijst met alle vragen in.
  if ((opties.weergave ?? "lijst") === "lijst") await naarLijst(page);
}

/** Stap 3: van het gesprek naar de lijst met alle vragen (als het gesprek open staat). */
export async function naarLijst(page: Page) {
  const knop = page.getByRole("button", { name: "Toon alle vragen op één pagina" });
  if (await knop.isVisible()) await knop.click();
  await expect(page.getByRole("button", { name: "Terug naar het gesprek" })).toBeVisible();
}
