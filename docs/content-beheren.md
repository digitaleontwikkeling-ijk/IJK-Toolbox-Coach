# Regels en teksten beheren (content)

Alle inhoud van de coach staat in `content/`, niet in de code. Beheer: Team Digitale Ontwikkeling
en de AI governance & compliance officer. Wijzigen gaat via Git, zodat elke wijziging zichtbaar,
beoordeeld en terug te draaien is.

| Bestand | Inhoud |
| --- | --- |
| `content/regelset.yaml` | Uitkomsten en kleuren, de zes checks met schalen, extra vraag, rode vlaggen, toetsers, DPIA-regels, voorwaarden (geel), alternatieven (rood), teksten voor "Waarom deze kleur?" |
| `content/tools.yaml` | Tools in de IJK Toolbox, behoeften → tools, keuzehulp voor de coach |
| `content/spelregels/<tool>.yaml` | Per tool: zelf doen / eerst toetsen / altijd |
| `content/teksten.yaml` | Teksten in de interface (stappen, knoppen, statussen, uitleg) |
| `content/CHANGELOG.md` | Wat er per versie is veranderd |

## Zo voer je een wijziging door

1. Maak een branch: `git checkout -b regelset-0.2`.
2. Pas de YAML aan (zie de voorbeelden hieronder).
3. **Verhoog het versienummer**: `versie` in `regelset.yaml` (beslisregels, checks, teksten van de uitkomst)
   en/of `versie` in `tools.yaml` (tools, behoeften, spelregels). Dit nummer wordt bij elk advies opgeslagen.
4. Noteer de wijziging in `content/CHANGELOG.md`.
5. Controleer: `npm run content:check` (vorm en verwijzingen) en `npm test` (beslisregels en scenario's).
   Faalt een scenariotest omdat de regel bewust is veranderd? Pas dan de verwachting in
   `tests/unit/scenarios.test.ts` aan en vermeld dat in het pull request.
6. Open een pull request. **Laat wijzigingen aan de regelset beoordelen door beide toetsers**
   (AI governance & compliance officer en architect Digitale Ontwikkeling). Tip: leg dat vast met een
   `CODEOWNERS`-regel voor `content/`.
7. Na het samenvoegen: opnieuw uitrollen of de app herstarten. De content wordt bij het starten gelezen
   en gecontroleerd; een fout in de content stopt het starten met een duidelijke melding.

Is de regelset gevalideerd door beide toetsers? Zet dan `gevalideerd: true` en verhoog de versie
(bijvoorbeeld naar `1.0`). Verwijder daarbij de placeholders (`TODO: valideren door toetsers`).

## Belangrijk

- **Hernoem nooit een bestaand `id`** (van een check, antwoord, rode vlag, tool of kleur). Eerdere adviezen in het
  register verwijzen ernaar. Wil je een antwoord vervangen? Voeg een nieuw antwoord toe met een nieuwe `id` en
  verwijder het oude pas als er geen nieuwe adviezen meer mee worden gemaakt.
- Labels en teksten mag je wél gewoon aanpassen.
- De **volgorde** van `kleuren` bepaalt welke kleur "het hoogst" is (van laag naar hoog).
- Een **gele** uitkomst toont de `voorwaarde` van elk antwoord dat geel scoorde; een **rode** uitkomst toont het
  `alternatief`. Geef dus elk geel antwoord een voorwaarde en elk rood antwoord een alternatief
  (een test controleert dat).
- De coach (Hermes) krijgt de tools, schalen en spelregels automatisch uit deze bestanden mee.

## Voorbeelden

**Tekst van een voorwaarde aanpassen** (`regelset.yaml`):

```yaml
      - id: lezen
        label: Lezen
        kleur: geel
        voorwaarde: Gebruik alleen een account met leesrechten en controleer de uitkomst steekproefsgewijs.
```

**Kleur van een antwoord wijzigen** (bijvoorbeeld "Collega's" naar oranje): verander `kleur: geel` in
`kleur: oranje` en verwijder de `voorwaarde` (die wordt bij oranje niet getoond). Bij oranje bepaalt het
veld `toetser` van de check wie de aanvraag krijgt.

**Een tool toevoegen**: voeg de tool toe aan `tools.yaml`, koppel hem aan één of meer behoeften en maak
`content/spelregels/<tool-id>.yaml` met de drie lijsten.

**Een rode vlag toevoegen** (`regelset.yaml`, onder `rode_vlaggen`): geef een nieuwe `id`, het volgende `nummer`,
de `vraag`, een korte omschrijving (`kort`, voor "Waarom deze kleur?") en een `alternatief`.

**Een DPIA-situatie toevoegen** (`regelset.yaml`, onder `dpia.minstens_een_van`):

```yaml
    - { check: afhankelijkheid, antwoorden: [bedrijf] }
```
