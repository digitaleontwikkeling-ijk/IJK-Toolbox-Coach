# Vervolgacties en toetsing

## Vervolgacties (webhooks)

| Uitkomst | Actie | Webhook | Nieuwe status |
| --- | --- | --- | --- |
| Direct aan de slag | Accountaanvraag | `ACTIE_ACCOUNT_URL` | account aangevraagd |
| Aan de slag met voorwaarden | Accountaanvraag + voorwaarden | `ACTIE_ACCOUNT_URL` | account aangevraagd |
| Eerst toetsen | Aanvraag naar toetser(s) + Teams-melding | `ACTIE_TOETSING_URL`, `ACTIE_MELDING_URL` | in toetsing |
| Niet op deze manier, met alternatief | Geen aanvraag, alleen vastgelegd; alternatief op de adviescard | – | advies gegeven |
| Niet op deze manier, zonder alternatief | Melding aan Team Digitale Ontwikkeling, dat contact opneemt | `ACTIE_CONTACT_URL` | contact volgt |

De webhooks wijzen naar automatiseringen die IJK zelf beheert (bijvoorbeeld in HubBI of Microsoft 365).
Elke aanroep is een `POST` met JSON en de headers:

- `X-IJK-Webhook-Secret: <ACTIE_GEHEIM>` (naam instelbaar met `ACTIE_GEHEIM_HEADER`); de flow moet dit controleren;
- `Idempotency-Key: <advies-id>:<type>`, zodat de flow een herhaalde aanroep kan negeren.

Voorbeeld (accountaanvraag):

```json
{
  "type": "accountaanvraag",
  "referentie": "TC-2026-0001",
  "adviesId": "…",
  "aanvrager": { "pseudoniemId": "3f2a…" },
  "regelversie": "0.7",
  "tool": { "id": "hubbi", "naam": "HubBI", "buitenToolbox": false,
            "beheer": { "naam": "HR tech (IJK)", "email": "info@hubbi.nl" } },
  "uitkomst": { "kleur": "geel", "naam": "Aan de slag met voorwaarden" },
  "voorwaarden": ["Gebruik de goedgekeurde koppeling …"],
  "link": "https://<app>/advies/…"
}
```

**E-mail naar de beheerder.** `tool.beheer` komt uit `content/tools.yaml` (wie de tool beheert en waar je een
licentie of account aanvraagt). De flow achter `ACTIE_ACCOUNT_URL` stuurt de accountaanvraag per e-mail naar
`tool.beheer.email`, met de referentie, de tool, de uitkomst, eventuele voorwaarden en de link naar het advies.
Bijvoorbeeld: Claude Code → digitaleontwikkeling@ijk.nl, Microsoft 365 Copilot en Copilot workflows →
ict@driessengroep.nl, HubBI en AI Flows → info@hubbi.nl. De webapp verstuurt zelf geen e-mail (geen mailserver of
geheimen in de app); de medewerker ziet op de adviescard naar welk adres de aanvraag gaat.

Bij een tool buiten de IJK Toolbox is `tool` bijvoorbeeld
`{ "id": "andere_tool", "naam": "<naam die de medewerker opgaf>", "buitenToolbox": true, "link": "https://…" }`
(`link` alleen als die is ingevuld). Zo'n aanvraag is altijd minstens `toetsing` en gaat naar beide toetsers.

`toetsing` bevat daarnaast `toetsers`, `motivatie` en `dpiaSignaal`; `teams_melding` bevat `ontvangers` en `tekst`;
`contact` bevat `motivatie`, `toetsers`, `tekst` en een link naar het advies in het beheerscherm.

**Contact volgt** (rood zonder alternatief): de melding gaat direct uit zodra het advies is berekend, maximaal één keer
per advies. Mislukt de melding, dan blijft de status *advies gegeven* en ziet de medewerker de knop
"Team Digitale Ontwikkeling informeren" om het opnieuw te proberen.
De beschrijving en de antwoorden gaan **niet** mee (dataminimalisatie): de toetser leest ze in de app via de link.
De UPN van de aanvrager gaat alleen mee met `ACTIE_STUUR_UPN=true`.

Werking:

1. De status wordt eerst geclaimd, zodat dubbel klikken maar één aanvraag geeft.
2. Mislukt de hoofdactie (fout, time-out, geen 2xx), dan gaat de status terug en ziet de medewerker een melding.
3. Een mislukte Teams-melding draait de aanvraag niet terug, maar wordt wel gelogd.
4. Elke aanroep staat in de tabel `actie_log`.

Lokaal: `ACTIE_MODUS=mock` logt alleen. Of start `npm run mock:webhooks` (poort 8650) en zet `ACTIE_MODUS=webhook`.

## Toetsing

- Toetsers zien alleen **ingediende** aanvragen die naar hun rol zijn gestuurd (`/toetsing`).
- Bij **Niet op deze manier** kijken beide toetsers mee: ze zien die adviezen onder **Ter informatie**, zonder besluit.
- Een toetser ziet alle antwoorden, de uitkomst, het DPIA-signaal, de regelversie en eerdere besluiten.
- Besluit per rol: *goedgekeurd*, *goedgekeurd met voorwaarden* (voorwaarden verplicht) of *afgewezen* (motivatie verplicht).
- Eindstatus (`src/domain/besluiten.ts`): pas als alle toetsers hebben besloten; één afwijzing → afgewezen;
  anders één keer met voorwaarden → goedgekeurd met voorwaarden; anders goedgekeurd.
- Een toetser kan zijn eigen aanvraag niet toetsen.
- De medewerker ziet de besluiten en toelichtingen bij zijn advies.

## Beheer en audit-log

- Beheerders zien alle adviezen en de inhoud (`/beheer`). Wijzigen van de inhoud gaat via Git (`content/`).
- Toetsers en beheerders zien bij elke aanvraag de naam en het e-mailadres van de aanvrager
  (`AANVRAGER_OPSLAAN`, standaard aan). Die gaan niet mee in de webhooks (daar alleen de UPN met `ACTIE_STUUR_UPN=true`).
- Elke inzage en elk besluit door een toetser of beheerder komt in `audit_log` (pseudoniem, rol, actie, advies, tijd).
  `npm run opruimen` verwijdert auditregels na de bewaartermijn.
