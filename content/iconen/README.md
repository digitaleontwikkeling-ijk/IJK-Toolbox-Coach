# Logo's van de tools

Zet hier de logo's van de tools uit de IJK Toolbox en verwijs ernaar in `content/tools.yaml` met `icoon`, bijvoorbeeld:

```yaml
  - id: hubbi
    naam: HubBI
    icoon: iconen/hubbi.png
```

- Formaat: `.png`, `.svg` of `.webp`, maximaal 200 kB. Het liefst alleen het beeldmerk, vierkant, met een transparante achtergrond.
- Bestandsnaam: kleine letters, cijfers, `-` of `_`.
- De app laadt de logo's bij het starten in (als data-URI), dus ze werken ook in de statische demo.
- Het logo is decoratief: de naam van de tool staat er altijd naast.

Verwachte bestanden (tool-id → bestand): `m365_copilot`, `copilot_workflows`, `hubbi`, `ai_flows`, `claude_code`, `azure_openai`.
