# Wijzigingen in de content (regelset, tools, spelregels)

Elke inhoudelijke wijziging krijgt een nieuw versienummer in `regelset.yaml` (of `tools.yaml`).
Dit versienummer wordt bij elk advies opgeslagen, zodat altijd terug te zien is met welke regels een advies is gegeven.

## regelset 0.2 (concept)

- Checks Data, Systemen, Gebruikers en Autonomie staan meerdere antwoorden toe (`meerdere: true`);
  per check telt het antwoord met de hoogste kleur. Impact en Afhankelijkheid: één antwoord.
- TODO: valideren door toetsers.

## tools.yaml 0.2 (concept)

- n8n verwijderd uit de toolbox; Copilot workflows toegevoegd (waarschijnlijke opvolger, nog te bevestigen).
- Behoeften "automatiseren" en "verbinden": HubBI of Copilot workflows; HubBI heeft voorrang bij AFAS.
- Spelregels Copilot workflows: placeholder, nog aan te leveren door IJK.

## 0.1 (concept)

- Startversie op basis van de opdracht.
- Nog niet gevalideerd door de AI governance & compliance officer en de architect Digitale Ontwikkeling.
- Placeholders (zoeken op `TODO: valideren door toetsers`):
  - voorwaarden bij Autonomie = Lezen en Impact = Beperkt;
  - alternatieven bij rode antwoorden en rode vlaggen.
- Kleuren: groen, oranje en rood uit het huisstijlhandboek (Blad, Zon, Avondrood); geel uit de opdracht.
