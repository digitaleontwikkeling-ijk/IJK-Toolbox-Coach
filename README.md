# IJK Toolbox Coach

Een webapp waarin medewerkers van IJK via een wizard advies krijgen over het verantwoord gebruik van tools uit de
**IJK Toolbox**. Uitgangspunt: *niet de tool bepaalt wat mag, maar wat je ermee doet.*

| Fase | Stap |
| --- | --- |
| 1 · Welke tool past? | 1. Wat wil je bereiken? · 2. Welke tool past? |
| 2 · Mag ik dit doen? | 3. Zes checks (+ rode vlaggen) · 4. Advies in één van vier kleuren, met de vervolgactie |

De coach (Hermes Agent) voert het gesprek, vraagt door en legt uit. **De webapp bewaakt het stappenpad en berekent
de uitkomst met vaste beslisregels; het taalmodel bepaalt nooit de kleur.** De app werkt ook volledig zonder AI.

> **Status: proof of concept.** Gebruik alleen testgegevens en fictieve voorbeelden. Volgens het IJK-kader moet deze
> app zelf eerst worden getoetst (door beide toetsers) voordat hij met echte gegevens of door collega's wordt gebruikt.
> De regelset is versie `0.1` en nog niet gevalideerd.

## Demo bekijken

**https://timbrons.github.io/IJK-Toolbox-Coach/**

De demo draait volledig in je browser: geen server, geen database, geen AI (oefencoach), geen echte aanvragen.
Gegevens blijven in de localStorage van je eigen browser ("Demo leegmaken" wist ze). Kies een testgebruiker;
probeer ook de rollen toetser en beheerder. De demo gebruikt dezelfde schermen, content en beslisregels als de app.

## Snel starten (lokaal)

Vereist: Node.js 22 en PostgreSQL 16 (of Docker).

**Met Docker:**

```bash
docker compose up --build
```

Open http://localhost:3000 en kies een testgebruiker. Coach en acties draaien als mock.
(De Docker-bestanden zijn tijdens de bouw niet getest: daar was geen Docker beschikbaar.)

**Zonder Docker:**

```bash
npm install
cp .env.example .env
```

Vul in `.env` minimaal `DATABASE_URL`, `SESSIE_GEHEIM` en `PSEUDONIEM_GEHEIM` in (geheimen bijvoorbeeld met
`openssl rand -base64 32`). Start daarna:

```bash
npm run dev
```

De databasetabellen worden bij het starten automatisch aangemaakt of bijgewerkt (`src/db/migraties/`).

## Scripts

| Script | Wat het doet |
| --- | --- |
| `npm run dev` / `build` / `start` | Ontwikkelserver / productiebuild / productieserver |
| `npm test` | Unit- en integratietests (Vitest; integratietests gebruiken de testdatabase, zie `tests/setup.ts`) |
| `npm run test:e2e` | End-to-end-tests (Playwright; vooraf `npm run build`) |
| `npm run content:check` | Content in `content/` controleren |
| `npm run db:migreer` | Databasemigraties handmatig uitvoeren |
| `npm run opruimen` | Gegevens na de bewaartermijn verwijderen (dagelijks inplannen) |
| `npm run mock:hermes` / `mock:webhooks` | Nagebootste Hermes API-server / webhook-ontvanger |
| `npm run teams:pakket` | Teams-app-pakket maken (zie `docs/teams.md`) |
| `npm run demo:build` / `demo:serve` / `test:demo` | Statische demo bouwen / lokaal bekijken / testen |

## Configuratie

Alle instellingen gaan via omgevingsvariabelen; zie [`.env.example`](.env.example) voor de volledige lijst met uitleg.
Er staan geen geheimen in de code.

| Onderdeel | Instelling | Waarden |
| --- | --- | --- |
| Inloggen | `AUTH_MODUS` | `nep` (testgebruikers) · `entra` (Microsoft Entra ID / Teams-SSO) |
| Coach | `COACH_MODUS` | `mock` · `hermes` · `uit` (alles handmatig) |
| Vervolgacties | `ACTIE_MODUS` | `mock` (alleen loggen) · `webhook` |
| Bewaartermijn | `BEWAARTERMIJN_MAANDEN` | standaard 12 |

## Documentatie

| Document | Onderwerp |
| --- | --- |
| [docs/content-beheren.md](docs/content-beheren.md) | Regels, tools, spelregels en teksten wijzigen; versienummers |
| [docs/hermes.md](docs/hermes.md) | Koppeling met Hermes Agent en inrichting van het profiel `toolbox-coach` |
| [docs/acties.md](docs/acties.md) | Webhooks, statussen, toetsing, beheer en audit-log |
| [docs/teams.md](docs/teams.md) | Entra ID-app-registratie, Teams-SSO, Teams-pakket en installatie |
| [docs/ontwerp.md](docs/ontwerp.md) | Technisch ontwerp en keuzes per fase |
| [docs/schermen/](docs/schermen/) | Schermafbeeldingen |

## Architectuur

```
Teams (persoonlijk tabblad) / link
        ↓
Next.js-app (TypeScript): wizard, chat, adviescard, Mijn aanvragen, toetsing, beheer
        ↓
API-routes: inloggen, stappenpad, beslisregels (pure functie), adviesregister (PostgreSQL)
        ↓                                         ↓
Hermes API-server (profiel toolbox-coach)     Webhooks naar flows van IJK
```

| Map | Inhoud |
| --- | --- |
| `content/` | Regelset, tools, spelregels, teksten (YAML) |
| `src/domain/` | Beslisregels, eindstatus na besluiten, schema's (pure functies, geen afhankelijkheden) |
| `src/coach/` | `CoachClient`, `HermesCoachClient`, `MockCoachClient`, prompts, validatie |
| `src/acties/` | Vervolgacties (webhooks) |
| `src/register/` | Adviesregister, toetsing, beheer |
| `src/auth/` | Sessie, rollen, Entra ID |
| `src/db/` | SQL, migraties, opruimen |
| `src/app/`, `src/components/` | Pagina's, API-routes en schermonderdelen |
| `src/demo/`, `demo/` | Alleen voor de statische demo (GitHub Pages) |
| `teams/` | Teams-manifestsjabloon en iconen |
| `mocks/` | Nagebootste Hermes- en webhook-servers |
| `tests/` | Unit-, integratie- en end-to-end-tests |

## Beveiliging en privacy (kort)

- Geen namen of e-mailadressen in de database of naar de coach: alleen een pseudoniem (HMAC van het Entra-object-ID).
- Contactgegevens worden uit tekst gehaald voordat die naar de coach gaat.
- Chatgeschiedenis staat alleen in het onafgemaakte concept en komt niet in het adviesregister.
- Autorisatie per rol op elke API-route; audit-log van inzage en besluiten door toetsers en beheerders.
- Invoer wordt gevalideerd (Zod); React escapet uitvoer.
- Bewaartermijnen instelbaar; `npm run opruimen` handhaaft ze.

## Nog open (te valideren door IJK)

- Regelset `0.1`: placeholders voor voorwaarden (Autonomie = Lezen, Impact = Beperkt) en alternatieven bij rood.
- Spelregels voor Copilot workflows (placeholder).
- Eerste test met echte Hermes, echte Entra-tenant en echte Teams (zie de documenten hierboven).
- Lettertypes Riona Sans en Ratio en het IJK-logo (op te vragen bij marketing).
