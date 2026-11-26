# Wijzigingen in de content (regelset, tools, spelregels)

Elke inhoudelijke wijziging krijgt een nieuw versienummer in `regelset.yaml` (of `tools.yaml`).
Dit versienummer wordt bij elk advies opgeslagen, zodat altijd terug te zien is met welke regels een advies is gegeven.

## teksten: stap 3 als gesprek (geen nieuwe regelset)

- Nieuwe teksten onder `gesprek` in `teksten.yaml` voor de checks als gesprek (één vraag tegelijk). De vragen,
  antwoorden en beslisregels zijn niet veranderd; daarom geen nieuw versienummer. TODO: valideren (concepttekst).
- Gesprek: in de chatvelden staat "Typ hier je vraag".
- Gesprek: geen automatische uitleg van de coach onder de adviescard (herhaalde de kaart); de chat blijft. In het
  formulier komt de uitleg nog in het chatvenster.
- Adviescard voor de medewerker compacter: privacy en AI als korte regel; de toelichting, je antwoorden en de
  disclaimer onder "Meer over dit advies" (ingeklapt). In het gesprek niet nog eens "Deze kleur volgt uit de vaste
  spelregels …". Toetsers en beheerders zien de kaart volledig.
- "Wat moet je extra regelen?" staat niet meer bij de vraag (gesprek en formulier), maar op de adviescard, alleen voor
  het gekozen antwoord. Geen nieuwe regels: dezelfde teksten (`extra_regelen` in de regelset).
- Gesprek: geen zinnen meer over waarom een vraag komt ("Je gaf aan dat je persoonsgegevens gebruikt. Daarom …",
  de inleidingen bij de privacy- en AI-vragen). Uitleg met een definitie of voorbeeld blijft bij de vragen in
  `gesprek.uitleg_bij`. Het formulier en de regelset zijn niet veranderd.
- Gesprek: geen "Wat bedoel je hiermee?" meer bij de vragen; de i bij een antwoord legt het uit, en anders vraag je
  het de coach (die krijgt de uitleg bij de vraag mee).
- Gesprek: geen zinnen meer over het voorstel van de coach ("Op basis van je beschrijving denk ik: …", twijfel); het
  voorgestelde antwoord staat alleen vooraf gekozen bij de antwoorden. De knop heet altijd "Volgende".
- Gesprek, uitleg vóór fase 2: nieuwe tekst van IJK (`gesprek.fase2`): intro, "Hoe werkt het?", "Wat gebeurt er
  daarna?" per uitkomst, "Wat is verder goed om te weten?" en de knop "Vervolg de vragen". De lijst met de zes checks
  staat niet meer in deze uitleg (wel in het formulier). Bij *Direct aan de slag*: "…dan kun je met één klik een
  aanvraag versturen" (de medewerker verstuurt de aanvraag zelf).
- Vragen van de coach: zonder de zin "Beantwoorden is niet verplicht…" (gesprek en formulier); in de oefencoach heet
  de optie nu "Persoonsgegevens".
- Gesprek, tooladvies: "Op basis van wat je vertelt, past deze tool het best bij jouw use case:" en geen knop
  "Stel een andere tool voor" (wel "Zelf een tool kiezen" en de chat).
- Formulier, "Wat wil je bereiken?": ook "Jouw use case" en de instructie "welke uitdaging … zonder al meteen aan een tool te denken".
- Gesprek, "Wat wil je bereiken?": nieuwe introductie van de IJK Toolbox Coach (twee alinea's), veld "Jouw use case".
- Gesprek, adviescard: bij elke uitkomst "Heb jij nog een aanvullende vraag? Stel deze hieronder dan gerust!".
- Melding "Je hebt nog een onafgemaakt idee": ook een knop "Verwijder dat idee" (met bevestiging).
- Gesprek, adviescard: geen knop "Vraag stellen" (het chatveld staat eronder); bij *Eerst toetsen* de tekst "Laat je
  idee eerst toetsen. Je aanvraag gaat naar de juiste toetser(s). Zij krijgen hier een melding van. Heb jij nog een
  aanvullende vraag? Stel deze hieronder dan gerust!" (`gesprek.vervolgactie_uitleg`).
- Gesprek: geen "berekenen" meer in de zinnen van de coach ("Dan zoek ik met de vaste spelregels van IJK uit welk
  advies bij je antwoorden past", "Het volgt uit de vaste spelregels van IJK; de uitkomst bepaal ik niet zelf").
- In het gesprek praat de coach zelf (ik-vorm): "Ik heb nog een vraag", "Ik zoek een passende tool voor je…",
  "Dit adviseer ik", "Vraag het mij", de uitleg over fase 2 en de adviescard ("niet door mij"). Nieuwe teksten onder
  `gesprek`; het formulier en de uitlegpagina "Hoe werkt de coach?" blijven ongewijzigd.
- Teksten voor het advies in het gesprek (`advies_intro`, `terugkijken`, `chat_label_advies`, `chat_plaatshouder_advies`).
- Teksten voor stap 1 en het tooladvies als gesprek (`naar_formulier`, `fase1_intro`, `fase1_vraag`, `kop_*`,
  `beschrijving_hulp`, `leest`, `verduidelijking_intro`, `niet_beantwoord`, `tooladvies_intro`, `tool_vraag`).
- Teksten voor de chat in het gesprek (`chat_label`, `chat_label_klaar`, `chat_plaatshouder`, `chat_stuur`, `denkt`,
  `eerdere_berichten`). Ook geen nieuwe regelset.

## regelset 0.9.1 (concept)

- Afhankelijkheid = Experiment: geen tekst meer bij "Wat moet je extra regelen?" (was "Niets extra's."). Op de
  adviescard staat dat onderdeel bij een experiment dus niet. Geen nieuwe of gewijzigde beslisregel; de uitkomst
  verandert niet.

## regelset 0.9 (concept)

- Aanvullende vragen hebben nu ook "Weet ik niet zeker" (keuze IJK). Twijfel geeft minstens *Eerst toetsen* en beide
  toetsers kijken mee (`rode_vlag_onzeker`); "Waarom deze kleur?" noemt de vraag ("Niet zeker bij: …").
  Een "ja" elders blijft rood; twijfel bij een vraag die niet gesteld wordt, telt niet.
  TODO: valideren door toetsers.

## regelset 0.8.1 (concept)

- Extra vraag "Gaat het om bijzondere persoonsgegevens?" heeft nu ook "Weet ik niet zeker" (`onzeker_mogelijk`).
  Telt bij de privacy-telling als indicator, net als bij de andere privacyvragen. Geen nieuwe beslisregel.

## regelset 0.8 en tools 0.6 (concept)

Privacy (pre-DPIA) en AI-risico geïntegreerd in de checks. Keuzes B1–B8 in `docs/analyse-privacy-ai.md` (akkoord
gebruiker). TODO: valideren door de AI governance & compliance officer.

- Data: nieuwe optie "Weet ik niet zeker" (oranje; start de privacyvragen) (B1).
- Nieuwe vraag bij Autonomie: "Gebruikt je oplossing AI?" (B3). Staat vooraf op "Ja" bij tools met `ai: true`
  (Microsoft 365 Copilot, AI Flows, Azure OpenAI).
- Verdiepingsvragen onder de check waar ze bij horen, alleen als ze nodig zijn en niet uit eerdere antwoorden volgen.
- **Privacy**: telling van 8 indicatoren ("ja" en "weet ik niet" tellen). 0–1: geen volledige DPIA; 2: waarschijnlijk;
  ≥3: verplicht. Waarschijnlijk of verplicht → minstens *Eerst toetsen* + compliance officer (B4).
  **Vervangt het DPIA-signaal** (B2). Gevolgen: de regel "Vertrouwelijkheid Serieus/Groot → altijd DPIA" vervalt
  (zonder persoonsgegevens geen DPIA; de uitkomst blijft oranje/rood via Impact); scenario 4 heeft nu 2 indicatoren
  nodig voor het DPIA-signaal.
- **AI-risico**: 8 regels uit de opdracht; Hoog > Beperkt > Laag, alleen omhoog. Hoog → minstens *Eerst toetsen* +
  compliance officer; Beperkt → minstens *Aan de slag met voorwaarden*, met de voorwaarde bij het antwoord (B4).
  **Vervangt het AI Act-signaal**. Gevolgen: Handelen zonder AI geeft geen AI-beoordeling meer (scenario 5, B3);
  "AI adviseert over mensen" alleen is niet meer automatisch *Eerst toetsen* (dat hangt nu af van de AI-antwoorden).
- De extra vraag "Gaat het advies over mensen?" is opgegaan in de AI-vraag "Raakt wat de AI doet de rechten,
  plichten of kansen van mensen?".
- Aanvullende vraag "AI beslist zelfstandig over mensen" alleen bij Autonomie = Beslissen; anders "nee" (B7).
- Vragen over betrokkenen (domein, discriminatie, herziening, toezicht) alleen als de AI mensen raakt (B5);
  domein met "Iets anders" (B6).

## tools 0.5 (concept)

- Logo's bij alle zes tools (`icoon`, uit de toolbox-sheet "Onze huidige digitale toolbox (2026)"); alleen het
  beeldmerk, want de naam staat er al naast. Bij Azure OpenAI de beeldmerken van Azure en OpenAI samen.
  Geen wijziging in de uitkomsten.

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
