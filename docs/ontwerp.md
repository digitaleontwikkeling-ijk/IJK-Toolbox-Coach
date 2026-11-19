# IJK Toolbox Coach – Technisch ontwerp (fase 1)

Status: concept, wacht op akkoord. Alle domeininhoud is startversie `v0.1` en moet nog worden gevalideerd door beide toetsers.

## 1. Technische keuzes

| Onderdeel | Keuze | Motivatie |
| --- | --- | --- |
| Taal | TypeScript (strict) | Conform voorkeur |
| Framework | Next.js 15 (App Router), frontend + API-routes in één app | Eén codebase, eenvoudig te beheren |
| Database | PostgreSQL 16 | Conform voorkeur |
| Database-toegang | `pg` met gewone SQL in `src/db/` + SQL-migraties (bij opstarten uitgevoerd) | Afwijking van eerder plan (Drizzle): gewone SQL is voor het beheerteam het makkelijkst te lezen |
| Validatie | Zod (invoer API, content-bestanden, coach-antwoorden) | Eén schema-bibliotheek voor alles |
| Content | YAML in `content/`, bij opstart gevalideerd met Zod | Leesbaar voor niet-ontwikkelaars |
| Auth | MSAL (`@azure/msal-browser`) + Teams JS SDK v2 (`authentication.getAuthToken`), backend valideert Entra-JWT via JWKS (`jose`) | Conform voorkeur; rollen via Entra **App Roles** |
| Tests | Vitest (unit + API-integratie tegen echte Postgres in Docker), Playwright (e2e met mock-coach) | Snel, TypeScript-native |
| UI | React + CSS Modules, geen UI-framework | Volledige controle over IJK-huisstijl en WCAG |
| Acties | Generieke HTTP-webhooks (URL + gedeeld geheim per actie). Het ontvangende platform (n8n, Copilot workflows, Power Automate) maakt voor de app niet uit | IJK kan van platform wisselen zonder codewijziging |
| Container | Dockerfile (multi-stage) + docker-compose: app, postgres, mock-webhooks, mock-hermes | Lokaal alles zonder externe afhankelijkheden |

## 2. Mappenstructuur

```
ijk-toolbox-coach/
├─ content/                      # beheerd door TDO + compliance officer
│  ├─ regelset.yaml              # versie, kleuren, uitkomsten, checks+schalen, rode vlaggen,
│  │                             #   toetser-toewijzing, DPIA-regels, voorwaarden bij geel
│  ├─ tools.yaml                 # tools + behoeften (4.1)
│  ├─ spelregels/<tool>.yaml     # 3 lijsten per tool (4.6)
│  ├─ teksten.yaml               # UI-/motivatieteksten, alternatieven bij rood
│  └─ CHANGELOG.md               # versiegeschiedenis regelset
├─ src/
│  ├─ domain/
│  │  ├─ beslisregels.ts         # PURE functie evalueer(antwoorden, regelset)
│  │  ├─ content-schema.ts       # Zod-schema's voor content
│  │  └─ types.ts
│  ├─ content/laad-content.ts    # leest + valideert YAML, cached
│  ├─ coach/
│  │  ├─ CoachClient.ts          # interface
│  │  ├─ HermesCoachClient.ts
│  │  ├─ MockCoachClient.ts
│  │  ├─ schemas.ts              # JSON-schema's per coachtaak
│  │  └─ prompts.ts
│  ├─ acties/                    # webhook-client (HMAC/gedeeld geheim), mock
│  ├─ auth/                      # token-validatie, rollen, pseudoniem-ID
│  ├─ db/                        # schema, migraties, repositories
│  ├─ audit/
│  ├─ app/                       # Next.js pages + API-routes
│  └─ components/                # Stappenbalk, Chatvenster, CheckKeuze, Adviescard, ...
├─ teams/manifest.json + iconen  # alleen staticTabs, scope personal
├─ mocks/                        # mock-webhook-server, mock-hermes-server
├─ tests/{unit,integratie,e2e}/
├─ Dockerfile, docker-compose.yml, .env.example, README.md
```

## 3. Datamodel (PostgreSQL)

- **gebruiker**: `id` (uuid), `pseudoniem_id` (HMAC-SHA256 van Entra `oid` met server-geheim), `aangemaakt_op`. Geen naam of e-mail opgeslagen.
- **advies** (= adviesregister), met naast `regelversie` ook `toolsversie`: `id`, `referentie` (`TC-JJJJ-NNNN`, uniek, teller per jaar), `pseudoniem_id`, `aangemaakt_op`, `beschrijving`, `tooladvies` (jsonb: behoefte, tool, motivatie, geaccepteerd), `antwoorden` (jsonb: checks + bijzondere persoonsgegevens), `rode_vlaggen` (jsonb), `uitkomst`, `toetsers` (text[]), `dpia_signaal`, `motivatie`, `voorwaarden` (jsonb), `regelversie`, `status`, `vorig_advies_id` (bij "Er is iets veranderd"), `verloopt_op` (bewaartermijn).
- **besluit**: `id`, `advies_id`, `toetser_rol`, `toetser_pseudoniem_id`, `besluit` (goedgekeurd / goedgekeurd_met_voorwaarden / afgewezen), `toelichting`, `datum`.
- **gesprek_bericht**: alleen tijdens de wizard (concept), `advies_id`/`concept_id`, rol, tekst, tijd. Wordt verwijderd bij bewaartermijn; zie vraag 6.
- **concept**: de wizard-voortgang (stap, ingevulde antwoorden), zodat terug/vooruit en herladen geen gegevens verliezen.
- **audit_log**: `wie` (pseudoniem + rol), `actie` (inzage/besluit), `advies_id`, `tijd`.
- **actie_log**: welke webhook, wanneer, resultaat (voor herhaalpogingen).

Statussen: `advies_gegeven`, `account_aangevraagd`, `in_toetsing`, `goedgekeurd`, `goedgekeurd_met_voorwaarden`, `afgewezen`.

## 4. Beslisfunctie

```ts
evalueer(invoer: { checks: Record<CheckId, AntwoordId>; bijzonderePersoonsgegevens?: boolean;
                   rodeVlaggen: Record<VlagId, boolean> }, regelset: Regelset)
  → { uitkomst, uitkomstNaam, toetsers[], dpiaSignaal, motivatie, doorslaggevend[], voorwaarden[], regelversie }
```

Geen I/O, geen datum, geen random. Alle kleuren, toewijzingen, DPIA-condities en teksten komen uit `regelset`. Ontbrekend antwoord → fout (geen stille aanname).

## 5. API-routes (alle routes: token-validatie + rolcontrole)

| Route | Rol | Doel |
| --- | --- | --- |
| `GET /api/content` | alle | Checks, schalen, tools, spelregels voor de UI |
| `POST /api/concept` / `PATCH /api/concept/:id` | medewerker | Wizard-voortgang opslaan |
| `POST /api/coach/verduidelijk` | medewerker | Max 2 vragen (stap 1) |
| `POST /api/coach/tooladvies` | medewerker | Stap 2 |
| `POST /api/coach/checks` | medewerker | Voorinvullen stap 3 |
| `POST /api/coach/chat` | medewerker | Vrije vraag in chatvenster |
| `POST /api/advies` | medewerker | Server berekent uitkomst, slaat op, geeft referentie |
| `POST /api/advies/:id/uitleg` | eigenaar | Coach-uitleg bij berekende uitkomst |
| `POST /api/advies/:id/actie` | eigenaar | Vervolgactie (webhooks) |
| `GET /api/mijn-aanvragen` | medewerker | Eigen adviezen |
| `POST /api/advies/:id/opnieuw` | eigenaar | "Er is iets veranderd" → nieuw concept |
| `GET /api/toetsing` / `GET /api/toetsing/:id` | toetser_* | Eigen wachtrij (audit-gelogd) |
| `POST /api/toetsing/:id/besluit` | toetser_* | Besluit vastleggen |
| `GET /api/beheer/adviezen`, `GET /api/beheer/content` | beheerder | Alles inzien (audit-gelogd) |

De uitkomst wordt **altijd server-side** berekend; de client stuurt alleen antwoorden.

## 6. Componenten (frontend)

`Stappenbalk`, `WizardLayout` (wizard + chat naast elkaar; in smal Teams-tabblad chat als uitklapbaar paneel), `Stap1Beschrijving`, `Stap2Tooladvies` (+ `Spelregels`), `Stap3Checks` (`CheckKeuze` als radiogroep, `RodeVlagVraag`), `Stap4Adviescard`, `Chatvenster`, `MijnAanvragen`, `ToetsingLijst`/`ToetsingDetail`, `BeheerOverzicht`.

## 7. Coach-koppeling

`CoachClient` met `verduidelijk`, `tooladvies`, `checksVoorinvullen`, `uitleg`, `chat`. Elk antwoord → Zod-validatie (tool moet in `tools.yaml`, waarden in de schaal). Ongeldig, time-out of fout → `null` → UI valt terug op handmatig invullen. Naar Hermes gaat alleen: beschrijving, relevante content, pseudoniem-ID.

> Uitgewerkt in fase 4: zie `docs/hermes.md` (OpenAI-compatibele `/v1/chat/completions`, Bearer-token, profielnaam als model).

## 8. Fasering

Zoals in de opdracht (fases 2–7), met na elke fase een samenvatting en wacht op akkoord.

## 9. Huisstijl (uit Huisstijlhandboek IJK, versie 08-2025)

| Rol in de app | Kleur handboek | Hex |
| --- | --- | --- |
| Primair (koppen, stappenbalk, tekst) | Lucht | `#1E0E3B` (opdracht noemde `#1C0E3B`; handboek gevolgd) |
| Accent, uitkomst groen | Blad | `#50A78A` |
| Vlakken | Wolk | `#DFE9F0` (in plaats van `#F2F3F7` uit de opdracht) |
| Randen, secundaire tekst | Dauw | `#98A8AF` (alleen voor randen; te weinig contrast voor tekst) |
| Links/focus | Water | `#005282` |
| Uitkomst oranje | Zon | `#F69B37` |
| Uitkomst rood | Avondrood | `#D61539` |
| Uitkomst geel | (niet in handboek) | `#EFBE2E` uit de opdracht |

Contrast (WCAG AA): op groen, geel en oranje staat tekst in Lucht (contrast > 6:1); op rood witte tekst (≈ 5:1). Witte tekst op Blad haalt AA niet (≈ 2,9:1) en gebruiken we dus niet.

Lettertypes: Riona Sans (titels) en Ratio (platte tekst) zijn licentie-fonts, op te vragen bij marketing. Tot die er zijn: systeemlettertype als terugval. Logo alleen in Blad of wit. Iconen in hexagonvorm (Wolk-vlak, Lucht-lijn) passen we toe in fase 3.

## 10. Besluiten na fase 2

- n8n vervalt als tool; Copilot workflows komt (waarschijnlijk) in de plaats. HubBI gaat voor bij AFAS.
- Bij twee toetsers: één afwijzing → *afgewezen*; één keer "met voorwaarden" → *goedgekeurd met voorwaarden*; status is definitief als alle toetsers hebben besloten.
- Proof of concept: nep-login met testgebruikers per rol; Entra ID/Teams-SSO volgt later.
- Webhook-payloads bevatten standaard alleen het pseudoniem. Meesturen van de UPN is instelbaar (`ACTIE_STUUR_UPN`, standaard uit).

## 11. Stand na fase 3

- Wizard (4 stappen, terug zonder verlies, concept op de server), chatvenster, adviescard, "Mijn aanvragen", "Er is iets veranderd".
- Nep-login met vijf testgebruikers (`src/auth/testgebruikers.ts`); sessie = ondertekende cookie.
- Mock-coach (`src/coach/MockCoachClient.ts`) met validatie en terugval (`src/coach/service.ts`). `COACH_MODUS=uit` = volledig handmatig.
- Vervolgactie zet nu alleen de status en logt; webhooks volgen in fase 5.
- Chat staat alleen in het concept en wordt verwijderd na de vervolgactie, bij "Opnieuw beginnen" of na `CONCEPT_BEWAARDAGEN`. `npm run opruimen` handhaaft de bewaartermijnen.
- Schermafbeeldingen: `docs/schermen/`.

## 12. Stand na fase 4

- `HermesCoachClient` (`src/coach/HermesCoachClient.ts`) met instructies uit de content (`src/coach/prompts.ts`).
- Schema-validatie per taak, plus weigering van een uitleg die een andere uitkomst noemt.
- Terugval op handmatig bij fout, time-out, 401/429/500, afgebroken turn of ongeldige JSON.
- Contactgegevens worden uit tekst gehaald voor verzending (`src/coach/privacy.ts`).
- Nagebootste Hermes API-server voor tests en ontwikkeling (`mocks/hermes-mock.ts`).
- Inrichting en advies voor het Hermes-profiel: `docs/hermes.md`.
