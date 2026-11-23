# Wijzigingen in de content (regelset, tools, spelregels)

Elke inhoudelijke wijziging krijgt een nieuw versienummer in `regelset.yaml` (of `tools.yaml`).
Dit versienummer wordt bij elk advies opgeslagen, zodat altijd terug te zien is met welke regels een advies is gegeven.

## regelset 0.7 (concept)

- Nieuw: in stap 2 kan de medewerker kiezen voor "Een andere tool (nog niet in de IJK Toolbox)", met de naam en
  eventueel een link. De zes checks en de aanvullende vragen gelden gewoon (rood blijft mogelijk), maar de uitkomst
  is minstens "Eerst toetsen" en de aanvraag gaat altijd naar beide toetsers (`tool_buiten_toolbox`, keuze IJK).
  TODO: valideren door toetsers.
- Aanvullende vraag "Gebruik je een tool die IJK niet heeft goedgekeurd?" vervallen: die route loopt nu via stap 2.
  De overige aanvullende vragen zijn hernummerd (1 t/m 4).
- Aanvullende vraag over persoonlijke inlog concreter: "Log je met je eigen account in op een systeem buiten
  Microsoft 365 (bijvoorbeeld een HubBI-flow met jouw AFAS-inlog), of zet je wachtwoorden of API-keys in de code?"

## regelset 0.6 (concept)

- Toelichting per keuzemogelijkheid bij de checks (achter een "i"-knopje). Conceptteksten, deels uit de opdracht
  (definitie persoonsgegevens, voorwaarde bij Lezen), verder geformuleerd door de bouwer.
  TODO: valideren door toetsers. Geen wijziging in de uitkomsten.
- De voorbeelden bij de keuzes van Impact (B, I, V) worden niet meer in de wizard getoond (verwarrend, sluiten vaak
  niet aan op de use case). Ze blijven in de regelset als achtergrond voor de coach.
- Hulptekst bij Afhankelijkheid ("Hoe vaster de oplossing onderdeel wordt van het werk, …") verwijderd.

## tools 0.4 (concept)

- "IJK gebruikt geen n8n" staat niet meer in de keuzehulp in de wizard, alleen nog in de instructies voor de coach
  (`coach_instructies`).

## regelset 0.5 (concept)

- Een AI Act-signaal maakt de uitkomst minstens "Eerst toetsen" (oranje), zodat de compliance officer altijd
  meekijkt, ook als alle checks groen of geel zijn (keuze IJK). Instelbaar met `ai_act.minimale_uitkomst`.
  TODO: valideren door toetsers.

## regelset 0.4 en tools 0.3 (concept)

Bijgewerkt naar de opdracht op basis van de presentatie "Verantwoord innoveren en ontwikkelen met de IJK Toolbox coach" (nov. 2026).

- Tooladvies: nieuwe behoeften (taak in Microsoft 365 automatiseren → Copilot workflows; verbinden → HubBI),
  toelichting voor de coach; IJK gebruikt geen n8n.
- Spelregels van alle zes tools letterlijk uit de presentatie (geen placeholders meer voor Copilot workflows).
- Check 5 Impact in drie deelvragen: Beschikbaarheid, Integriteit, Vertrouwelijkheid (hoogste telt), met voorbeelden.
  TODO: afstemmen op de BIV-definities uit het IJK-risicomanagementproces.
- Check 6 Afhankelijkheid: nieuwe vraag en labels, met "Wat moet je extra regelen?".
- Hulpteksten per check (definitie persoonsgegevens en testdata, reflectievraag bij Autonomie, enz.).
- Rode vlag 5 (IJK-proces op een persoonlijke oplossing zonder eigenaar of beheer); uitzondering bij vlag 2 voor
  Copilot workflows; alternatieven uit de presentatie. Vlag 3 heeft geen alternatief.
- Het zelfbedachte alternatief bij Impact = Groot is verwijderd: zonder alternatief volgt contact met Team DO.
- Bij rood: beide toetsers kijken mee (ter informatie, zonder besluit).
- Nieuw AI Act-signaal (Autonomie Handelen of Beslissen, advies over mensen, of rode vlag 3). Extra vraag bij
  Autonomie = Adviseren: "Gaat het advies over mensen?". TODO: valideren door toetsers.
- DPIA-signaal: Vertrouwelijkheid Serieus of Groot geeft altijd een DPIA-signaal, ook zonder aangevinkte persoonsgegevens.
- Rood zonder alternatief: melding aan Team Digitale Ontwikkeling en status "contact volgt".

## regelset 0.3 (concept)

- "Waarom deze kleur?" noemt een rode vlag zonder het woord "rode vlag" (bijv. "Een tool die IJK niet heeft goedgekeurd.").
  In de interface heten de rode vlaggen nu "Aanvullende vragen" (zie teksten.yaml). Geen wijziging in de uitkomsten.

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
