# Koppeling met Hermes Agent (profiel `toolbox-coach`)

De webapp praat met Hermes via de **HTTP API-server** van Hermes. Hermes voert het gesprek;
de webapp bewaakt het stappenpad en berekent de uitkomst met de vaste beslisregels.
**Het taalmodel bepaalt nooit de kleur.**

Bron: officiële Hermes-documentatie, `website/docs/user-guide/features/api-server.md`,
`profiles.md`, `features/memory.md` en `reference/toolsets-reference.md` in
[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent).
Controleer bij een nieuwe Hermes-versie of dit nog klopt.

## Hoe de koppeling werkt

| Onderdeel | Waarde |
| --- | --- |
| Endpoint | `POST {HERMES_API_URL}/chat/completions` (OpenAI-compatibel, stateless) |
| Authenticatie | `Authorization: Bearer {HERMES_API_KEY}` (= `API_SERVER_KEY` van het profiel) |
| Model | `toolbox-coach` (Hermes gebruikt de profielnaam als modelnaam) |
| Antwoord | De coach geeft per taak één JSON-object terug (`src/coach/prompts.ts`) |
| Validatie | Elk antwoord wordt gecontroleerd met schema's uit de content (`src/coach/schemas.ts`) |
| Terugval | Fout, time-out, HTTP 429/500, `finish_reason` ≠ `stop` of ongeldige JSON → de medewerker vult zelf in |

De vier coach-taken (plus vrije chat):

1. **verduidelijk** – `{ "vragen": [max. 2] }`; elke vraag is een tekst (open vraag) of `{ "vraag", "opties": [max. 6] }`. De wizard toont opties als keuzelijst en voegt zelf "Iets anders…" toe.
2. **tooladvies** – `{ "behoefte", "tool", "motivatie" }`; tool moet in `content/tools.yaml` staan
3. **checks** – `{ "checks": [{ "check", "voorstel", "zekerheid", "vervolgvraag?" }] }`; waarden uit de schaal
4. **uitleg** – `{ "uitleg" }`; wordt geweigerd als de tekst een andere uitkomst noemt dan berekend
5. **chat** – `{ "antwoord" }`

## Privacy

- Naar Hermes gaat alleen het **pseudoniem gebruikers-ID** en de tekst die voor de taak nodig is.
  Nooit naam, e-mailadres of Entra-ID.
- E-mailadressen, telefoonnummers, IBAN's en 9-cijferige nummers (zoals BSN) worden vóór verzending
  uit de tekst gehaald (`src/coach/privacy.ts`). Dit is een vangnet; medewerkers wordt ook gevraagd
  geen persoonsgegevens te gebruiken.

## Hermes inrichten (door de beheerder van de Hermes-VM)

```bash
hermes profile create toolbox-coach
```

`~/.hermes/profiles/toolbox-coach/.env`:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=<lang willekeurig geheim; zelfde waarde als HERMES_API_KEY in de webapp>
API_SERVER_PORT=8642
# Standaard alleen localhost. Draait de webapp op een andere machine, bind dan aan het
# interne adres en scherm de poort af met een firewall (alleen de webapp mag erbij).
API_SERVER_HOST=127.0.0.1
```

Starten: `hermes -p toolbox-coach gateway`

### Aanbevolen: minimale rechten (spelregel van het kader)

De coach hoeft alleen tekst te lezen en JSON terug te geven. Zet daarom tools en geheugen uit
in `~/.hermes/profiles/toolbox-coach/config.yaml`:

```yaml
memory:
  memory_enabled: false        # geen geheugen tussen gesprekken
  user_profile_enabled: false  # geen gebruikersprofiel opbouwen
agent:
  disabled_toolsets: [terminal, file, browser, web, search, code_execution, delegation,
                      cronjob, messaging, memory, skills, session_search, image_gen, tts, vision]
```

> TODO: valideren door toetsers en de beheerder van Hermes. Controleer met
> `hermes -p toolbox-coach` welke toolsets in jullie versie bestaan, en stel een bewaartermijn
> in voor de sessies die Hermes zelf opslaat (state database), passend bij de bewaartermijn
> van het adviesregister.

## Webapp instellen

```bash
COACH_MODUS=hermes
HERMES_API_URL=http://<hermes-vm>:8642/v1   # https buiten een afgeschermd netwerk
HERMES_API_KEY=<zelfde geheim als API_SERVER_KEY>
HERMES_MODEL=toolbox-coach
COACH_TIMEOUT_MS=30000
```

## Lokaal ontwikkelen zonder Hermes

```bash
npm run mock:hermes   # nagebootste Hermes API-server op http://127.0.0.1:8642/v1
```

Zet daarna `COACH_MODUS=hermes`, `HERMES_API_URL=http://127.0.0.1:8642/v1` en
`HERMES_API_KEY=mock-sleutel`. De nagebootste server kent testtriggers (zoals `#hermes-fout`,
`#geen-json`, `#verkeerde-tool`) om de terugval te testen; zie `mocks/hermes-mock.ts`.
