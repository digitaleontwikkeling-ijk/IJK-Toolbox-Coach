# IJK Toolbox Coach – werkafspraken voor Claude Code

Lees dit eerst. De oorspronkelijke opdracht staat in `docs/opdracht.md`; latere keuzes van IJK in
`content/CHANGELOG.md`, `docs/ontwerp.md` (keuzes per fase) en `docs/analyse-privacy-ai.md` (privacy en AI).
Bij tegenstrijdigheid gaan de latere keuzes voor.

## Wat het is
Webapp (Next.js 15, TypeScript strict, PostgreSQL) waarin IJK-medewerkers via een wizard advies krijgen over het
verantwoord gebruik van tools uit de IJK Toolbox. Fase 1: doel → tooladvies. Fase 2: zes checks met waar nodig
privacy- en AI-vragen, en aanvullende vragen → advies in vier kleuren, met privacy- (pre-DPIA) en AI-beoordeling en
een vervolgactie (webhooks). Ook als persoonlijk tabblad in Microsoft Teams. Proof of concept: alleen testdata.

## Harde regels
- **Het taalmodel bepaalt nooit de uitkomst.** De kleur, de toetsers, de DPIA-klasse en het AI-risico komen uit pure
  functies: `src/domain/beslisregels.ts` en `src/domain/verdieping.ts`. De coach (Hermes Agent, profiel
  `toolbox-coach`) stelt alleen vragen, doet voorstellen en legt uit; alles wordt gevalideerd (Zod).
- **Inhoud staat in `content/` (YAML), niet in code.** Elke inhoudelijke wijziging: versienummer verhogen in
  `regelset.yaml`, `tools.yaml` of `adviesregels.yaml` en een regel in `content/CHANGELOG.md`. Het versienummer wordt
  bij elk advies opgeslagen. Uitzondering: mailsjablonen en adviesregels (tooladvies) kan een beheerder in het
  beheerscherm wijzigen (database, audit-log; adviesregels met historie en versie `<versie>+b<n>`).
- **Verzin geen beslisregels.** Is iets onduidelijk: vraag het, of maak het instelbaar en markeer het met
  `TODO: valideren door toetsers`. Pas bestaande regels niet stilzwijgend aan.
- **Vraag informatie één keer** (REUSE → REFINE → ASK): wat uit eerdere antwoorden volgt, wordt niet opnieuw gevraagd.
  Welke vraag wanneer verschijnt, staat op één plek: `src/domain/verdieping.ts`.
- **Privacy**: geen namen of e-mailadressen naar de coach (pseudoniem, contactgegevens worden uit tekst gehaald).
  Naam en e-mail van de aanvrager alleen in het register voor toetsers en beheerders (`AANVRAGER_OPSLAAN`).
  Geen geheimen in code: alles via omgevingsvariabelen (`.env.example`).
- **Rollen**: autorisatie per rol op elke API-route; inzage door toetsers en beheerders gaat in de audit-log.
  Toetsers en beheerders dienen zelf geen aanvragen in.
- **Interface in het Nederlands**, helder en zonder jargon; IJK-huisstijl; WCAG 2.1 AA (kleur is nooit de enige
  informatiedrager; testen met axe).

## Werken in een sessie
```bash
npm ci
pg_ctlcluster 16 main start          # PostgreSQL stopt soms tussen sessies
```
Testdatabase (eenmalig per nieuwe machine):
```bash
sudo -u postgres psql -c "CREATE ROLE coach LOGIN PASSWORD 'coach_dev'" -c "CREATE DATABASE toolbox_coach_test OWNER coach"
```
Na elke wijziging, in deze volgorde:
```bash
npx tsc --noEmit -p .
npx vitest run                                   # unit + integratie (gebruikt de testdatabase)
npx next build
npx playwright test --trace off                  # e2e (draait op de build)
NEXT_PUBLIC_BASE_PATH=/IJK-Toolbox-Coach npm run -s demo:build && npm run -s test:demo
```
De statische demo (GitHub Pages) wordt bij elke push naar `main` gebouwd door `.github/workflows/demo-pages.yml`.
Afspraak (IJK): is een wijziging klaar en slagen alle stappen hierboven, maak dan zonder te vragen een pull request
naar `main` en voeg die samen (merge), zodat de demo wordt bijgewerkt. Controleer daarna of de Pages-workflow slaagt.

## Waar staat wat
| Map | Inhoud |
| --- | --- |
| `content/` | Regelset (checks, aanvullende vragen, privacy- en AI-vragen, regels), tools en logo's, adviesregels (tooladvies), spelregels, teksten |
| `src/domain/` | Beslisregels, verdieping (feiten met herkomst, DPIA-telling, AI-risico), schema's, wizarddata |
| `src/components/` | Wizard (Stap1–3, uitleg fase 2), Adviescard, Beoordelingen, lijsten, toetsing |
| `src/coach/` | Hermes- en oefencoach, prompts, validatie |
| `src/acties/`, `src/register/`, `src/db/` | Webhooks, adviesregister en toetsing, SQL en migraties |
| `src/demo/`, `demo/` | Alleen voor de statische demo (API in de browser) |
| `tests/` | `unit`, `integratie`, `e2e` (Playwright), `demo` |

## Open punten (te valideren door IJK)
Zoek in `content/` op `TODO:`. Onder meer: de placeholders bij Autonomie = Lezen en Impact = Beperkt, de
BIV-definities, de privacy-drempels en AI-regels (regelset 0.8), "weet ik niet zeker" bij de aanvullende vragen (0.9),
de route voor tools buiten de toolbox (0.7), en een eerste test met echte Hermes, Entra ID en Teams.
