import { expect, test } from "@playwright/test";
import { geenRodeVlaggen, kies, kiesImpact, login, naarStap3, rustigeVerdieping, vinkAan, naarChecks } from "./hulp";

test.describe.configure({ mode: "serial" });

test("volledige wizard met mock-coach: verzuimdashboard → Eerst toetsen, aanvraag, Mijn aanvragen", async ({ page }) => {
  await login(page, "Testmedewerker Anna");

  await naarStap3(page, "Ik wil een verzuimdashboard van mijn afdeling, met gegevens uit AFAS. Het is voor de afdeling.");
  // De mock-coach adviseert HubBI (AFAS); de medewerker kiest zelf Claude Code.
  await expect(page.getByRole("heading", { name: "HubBI", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wat mag je zelf doen?" })).toBeVisible();
  await page.getByRole("button", { name: "Zelf een tool kiezen" }).click();
  await page.getByText("Claude Code", { exact: true }).click();
  await naarChecks(page, "Claude Code past, verder →");

  // Stap 3: de coach heeft voorgesteld; voorgestelde waarde is geselecteerd.
  await expect(page.getByRole("heading", { name: /Zes checks/ })).toBeVisible();
  await expect(page.getByLabel("Persoonsgegevens", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Afdeling", { exact: true })).toBeChecked();
  await expect(page.getByText("Voorgesteld door de coach").first()).toBeVisible();

  // Zonder de aanvullende vragen (rode vlaggen) kun je niet verder: duidelijke foutmelding.
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  await expect(page.locator(".foutmelding")).toContainText("Nog niet alle vragen zijn beantwoord");
  await expect(page.locator(".foutmelding")).toContainText("Vraag 1");

  await kies(page, "bijzondere_persoonsgegevens", "Ja");
  // Verzuim: zieke medewerkers zijn een kwetsbare groep → 2 privacy-indicatoren.
  await rustigeVerdieping(page, { kwetsbare_groepen: "Ja" });
  await geenRodeVlaggen(page);

  // Terug en weer vooruit: niets kwijt.
  await page.getByRole("button", { name: "← Terug" }).click();
  await expect(page.getByRole("heading", { name: /Welke tool past/ })).toBeVisible();
  await naarChecks(page, "Claude Code past, verder →");
  await expect(page.getByLabel("Ja", { exact: true }).first()).toBeChecked();

  await page.getByRole("button", { name: "Bekijk het advies →" }).click();

  // Stap 4: de adviescard.
  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Eerst toetsen", level: 2 })).toBeFocused();
  await expect(card).toContainText("Uitkomst: oranje");
  await expect(card).toContainText("Claude Code");
  await expect(card).toContainText("Persoonsgegevens (Data), Afdeling (Gebruikers) en Serieus (Impact – Vertrouwelijkheid).");
  await expect(card).toContainText("AI governance & compliance officer");
  await expect(card).toContainText("architect Digitale Ontwikkeling");
  await expect(card).toContainText("Privacy: Waarschijnlijk volledige DPIA nodig");
  await expect(card).toContainText("Mensen in een kwetsbare positie: Ja (jouw antwoord)");
  await expect(card).toContainText("AI: niet van toepassing");
  await expect(card).toContainText("eerste risico-indicatie");
  await expect(card).toContainText(/TC-\d{4}-\d{4}/);
  await expect(card).toContainText("adviesregister");
  // De coach legt uit in het chatvenster.
  await expect(page.locator(".chat")).toContainText('Je advies is "Eerst toetsen"');

  await page.getByRole("button", { name: "Aanvraag indienen voor toetsing" }).click();
  await expect(card).toContainText("Status: In toetsing");
  // Na het indienen: uitleg wat er gebeurd is, en de weg naar Mijn aanvragen.
  await expect(card).toContainText("Je aanvraag is ingediend bij AI governance & compliance officer en architect Digitale Ontwikkeling.");
  await expect(card.getByRole("button", { name: "Aanvraag indienen voor toetsing" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Nieuw idee" })).toBeVisible();

  // Afronden: naar Mijn aanvragen, met een bevestiging.
  const ref = (await page.locator(".adviescard__voet strong").innerText()).trim();
  await card.getByRole("button", { name: "Afronden" }).click();
  await page.waitForURL(/\/mijn-aanvragen\?afgerond=/);
  await expect(page.locator(".info[role=status]")).toContainText(`Klaar. Je advies ${ref} is afgerond`);
  const rij = page.locator(".aanvraag").first();
  await expect(rij).toContainText(/TC-\d{4}-\d{4}/);
  await expect(rij).toContainText("Eerst toetsen");
  await expect(rij).toContainText("In toetsing");
});

test("Er is iets veranderd: wizard start opnieuw met vorige antwoorden en geeft een nieuw advies", async ({ page }) => {
  await login(page, "Testmedewerker Anna");
  await page.goto("/mijn-aanvragen");
  await page.getByRole("button", { name: /Er is iets veranderd/ }).first().click();
  await page.waitForURL(/\/wizard\?concept=/);
  await expect(page.getByText("Je past een eerder advies aan")).toBeVisible();
  await expect(page.getByLabel("Jouw use case")).toHaveValue(/verzuimdashboard/);

  await page.getByRole("button", { name: "Volgende →" }).click();
  await naarChecks(page, "Claude Code past, verder →");
  // Vorige antwoorden staan er nog; de wijziging: alleen voor mezelf, met testdata.
  await expect(page.getByLabel("Afdeling", { exact: true })).toBeChecked();
  await kies(page, "data", "Openbaar");
  await kies(page, "systemen", "Geen");
  await kies(page, "gebruikers", "Alleen ik");
  await kies(page, "autonomie", "Assisteren");
  await kiesImpact(page);
  await kies(page, "afhankelijkheid", "Eenmalig of om uit te proberen (experiment)");
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();

  await expect(page.getByRole("heading", { name: "Direct aan de slag", level: 2 })).toBeVisible();
  await expect(page.locator(".adviescard")).toContainText(/TC-\d{4}-\d{4}/);
  // Claude Code: beheer bij Team Digitale Ontwikkeling; de aanvraag gaat per e-mail naar hun adres.
  await expect(page.locator(".adviescard")).toContainText("Met de knop hieronder opent een e-mail aan Team Digitale Ontwikkeling (digitaleontwikkeling@ijk.nl) in je mailprogramma");
  await page.getByRole("button", { name: "Account aanvragen voor Claude Code" }).click();
  await expect(page.locator(".adviescard")).toContainText("Status: Account aangevraagd");
  await expect(page.locator(".adviescard")).toContainText("er is een e-mail aan Team Digitale Ontwikkeling (digitaleontwikkeling@ijk.nl) geopend");
  // De e-mail: aan de beheerder, met het onderwerp "Aanvraag licentie <tool> - <naam>" (opnieuw te openen).
  const mail = await page.getByRole("link", { name: "Open de e-mail aan Team Digitale Ontwikkeling opnieuw" }).getAttribute("href");
  expect(mail).toMatch(/^mailto:digitaleontwikkeling@ijk\.nl\?subject=/);
  const url = new URL(mail!);
  expect(url.searchParams.get("subject")).toBe("Aanvraag licentie Claude Code - Testmedewerker Anna");
  expect(url.searchParams.get("body")).toContain("Referentie: TC-");

  // Het nieuwe advies staat naast het vorige in Mijn aanvragen.
  const nieuweRef = (await page.locator(".adviescard__voet strong").innerText()).trim();
  await page.goto("/mijn-aanvragen");
  await expect(page.locator(".aanvraag", { hasText: nieuweRef })).toContainText("Account aangevraagd");
  await expect(page.locator(".aanvraag", { hasText: "In toetsing" }).first()).toBeVisible();
});

test("een medewerker ziet alleen zijn eigen aanvragen", async ({ page }) => {
  await login(page, "Testmedewerker Bram");
  await page.goto("/mijn-aanvragen");
  await expect(page.getByText("Je hebt nog geen adviezen")).toBeVisible();
  const res = await page.request.get("/api/mijn-aanvragen");
  expect((await res.json()).adviezen).toEqual([]);
});

test("rode vlag: Niet op deze manier, met alternatief en zonder aanvraagknop", async ({ page }) => {
  await login(page, "Testmedewerker Bram");
  await naarStap3(page, "Ik wil een rooster-app met echte gegevens zonder toetsing op internet zetten (testscenario).");
  await naarChecks(page);
  await kies(page, "open_zonder_toetsing", "Ja");
  // "AI beslist over mensen" verschijnt alleen bij Autonomie = Beslissen (regelset 0.8).
  await expect(page.locator("#veld-ai_beslist_over_mensen")).toHaveCount(0);
  for (const v of ["persoonlijke_inlog_of_secrets", "proces_zonder_eigenaar"]) await kies(page, v, "Nee");
  await rustigeVerdieping(page);
  // Coach is onzeker over sommige checks: die moet de medewerker bevestigen of zijn al voorgesteld.
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Niet op deze manier", level: 2 })).toBeVisible();
  await expect(card).toContainText("een oplossing met echte gegevens die zonder toetsing openstaat");
  await expect(card).toContainText("Eerst toetsen, dan pas delen.");
  await expect(card).not.toContainText("Rode vlag");
  await expect(card).toContainText("Zo kan het wel");
  await expect(card.getByRole("button", { name: /Account aanvragen|Aanvraag indienen/ })).toHaveCount(0);

  // Ook hier kun je afronden: het gesprek wordt opgeruimd, het advies blijft in het register.
  await card.getByRole("button", { name: "Afronden" }).click();
  await page.waitForURL(/\/mijn-aanvragen\?afgerond=/);
  await expect(page.locator(".aanvraag").first()).toContainText("Niet op deze manier");
  // Er is geen concept (met gesprek) meer dat bij dit advies hoort.
  const concept = await (await page.request.get("/api/concept")).json();
  expect(concept.concept?.adviesId ?? null).toBeNull();
});

test("meerdere antwoorden: collega's én klanten bij Gebruikers → de hoogste kleur telt", async ({ page }) => {
  await login(page, "Testmedewerker Bram");
  await naarStap3(page, "Een overzicht van openstaande facturen voor mijn team.");
  await naarChecks(page);
  await expect(page.locator("#veld-gebruikers")).toContainText("Je kunt meerdere antwoorden kiezen.");
  await expect(page.locator("#veld-impact")).not.toContainText("Je kunt meerdere antwoorden kiezen.");
  await kies(page, "data", "Intern");
  await kies(page, "systemen", "Geen");
  await kies(page, "gebruikers", "Collega's");
  await vinkAan(page, "gebruikers", "Extern/klanten");
  await expect(page.locator("#veld-gebruikers").getByLabel("Collega's", { exact: true })).toBeChecked();
  await expect(page.locator("#veld-gebruikers").getByLabel("Extern/klanten", { exact: true })).toBeChecked();
  await kies(page, "autonomie", "Assisteren");
  await kiesImpact(page, { beschikbaarheid: "Beperkt" });
  await kies(page, "afhankelijkheid", "Regelmatig, voor mijn eigen werk (persoonlijke oplossing)");
  await geenRodeVlaggen(page);
  await page.getByRole("button", { name: "Bekijk het advies →" }).click();
  const card = page.locator(".adviescard");
  await expect(page.getByRole("heading", { name: "Eerst toetsen", level: 2 })).toBeVisible();
  await expect(card).toContainText("Extern/klanten (Gebruikers).");
  // Beide gekozen antwoorden staan op de adviescard (onder "Meer over dit advies").
  await card.getByText(/^Meer over dit advies/).click();
  const rij = card.getByRole("row", { name: /3\. Gebruikers/ });
  await expect(rij).toContainText("Collega's");
  await expect(rij).toContainText("Extern/klanten");
});
