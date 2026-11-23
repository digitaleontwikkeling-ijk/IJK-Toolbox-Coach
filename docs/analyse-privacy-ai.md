# Analyse en mapping: Privacy/DPIA en AI-risico integreren in de IJK Toolbox Coach

Status: **fase 1 (analyse) en fase 2 (mapping)**. Er is nog geen code gewijzigd. De open beslissingen staan in §6.

**Bronnen**
- Code: deze repository, regelset `0.7`, tools `0.5`.
- Beoogde werking: de opdracht *"Bouw de webapp IJK Toolbox Coach"*, gebaseerd op de presentatie *"Verantwoord
  innoveren en ontwikkelen met de IJK Toolbox coach"* (nov. 2026). **De presentatie zelf is niet meegestuurd.**
  Waar hieronder "presentatie" staat, gaat het om die opdracht. Lever de presentatie aan als er dia's zijn die
  afwijken van de opdracht.
- De opdracht voor deze uitbreiding (DPIA met 8 indicatoren, AI-risico met 8 vragen).

---

## 1. Analyse van de huidige implementatie

### 1.1 Opbouw van de wizard

| Fase | Stap | Wat er gebeurt | Code |
| --- | --- | --- | --- |
| 1 | 1. Wat wil je bereiken? | Open tekst, daarna maximaal 2 verduidelijkende vragen van de coach | `wizard/Stap1.tsx` |
| 1 | 2. Welke tool past? | Tooladvies van de coach (behoefte → tool). Of zelf kiezen, of "Een andere tool (nog niet in de toolbox)". Met de spelregels van de tool. | `wizard/Stap2.tsx` |
| 2 | (uitleg) | Eenmalig uitlegscherm "Fase 2 · Mag ik dit doen?" | `wizard/Fase2Uitleg.tsx` |
| 2 | 3. Zes checks | Eén pagina: 6 checks (de coach vult ze vooraf in, met een label voor de zekerheid). Daaronder extra vragen die alleen bij bepaalde antwoorden verschijnen, en 4 aanvullende vragen (rode vlaggen). | `wizard/Stap3.tsx` |
| 2 | 4. Advies | Adviescard met kleur, "Waarom deze kleur?", voorwaarden of alternatieven, DPIA- en AI Act-blok, wie er meekijkt en de vervolgactie | `Adviescard.tsx` |

Een **chatvenster** naast de wizard beantwoordt vragen. Het beïnvloedt de uitkomst niet.

### 1.2 Vragen die nu daadwerkelijk zijn geïmplementeerd (`content/regelset.yaml`)

| # | Check | Vraag | Antwoorden → kleur | Meer antwoorden mogelijk |
| --- | --- | --- | --- | --- |
| 1 | Data | Welke data gebruik je? | Openbaar → groen · Intern → groen · Persoonsgegevens → oranje · Vertrouwelijk/gevoelig → oranje | ja |
| 2 | Systemen | Welke systemen raak je? | Geen → groen · Lezen (uit een goedgekeurde IJK-bron) → geel · Koppelen → oranje · Schrijven in bedrijfssystemen → oranje | ja |
| 3 | Gebruikers | Wie gebruikt de oplossing? | Alleen ik → groen · Collega's → geel · Afdeling / Organisatie / Extern/klanten → oranje | ja |
| 4 | Autonomie | Wat mag de oplossing doen? | Assisteren → groen · Adviseren → groen · Lezen → geel · Schrijven / Handelen → oranje · Beslissen (over mensen) → rood | ja |
| 5 | Impact | Wat is de impact als het misgaat? Drie deelvragen: B, I, V | Nauwelijks → groen · Beperkt → geel · Serieus → oranje · Groot → rood. De hoogste deelscore telt. | per deelvraag 1 |
| 6 | Afhankelijkheid | Hoe ga je de oplossing gebruiken? | Experiment / Persoonlijke oplossing → groen · Teamoplossing / Bedrijfsoplossing → oranje | nee |

**Extra vragen** (verschijnen alleen bij een bepaald antwoord):
- `bijzondere_persoonsgegevens`: alleen bij Data = Persoonsgegevens.
- `advies_over_mensen`: alleen bij Autonomie = Adviseren.

**Aanvullende vragen** (rode vlaggen; altijd gesteld, "ja" betekent rood):
1. Eigen inlog buiten Microsoft 365, of wachtwoorden of API-keys in de code.
2. AI beslist zelfstandig over mensen, met grote gevolgen.
3. Echte gegevens zonder toetsing open voor klanten of internet.
4. IJK-proces op een persoonlijke oplossing zonder eigenaar.

### 1.3 Vertakkingen
- De enige vertakkingen binnen de checks zijn `extra_vragen[].toon_bij`. Het mechanisme is generiek: een vraag verschijnt
  als een gekozen antwoord in `toon_bij` staat.
- **Antwoorden die niet meer van toepassing zijn**, blijven in het concept staan, maar `beslisInvoerUit`
  (`src/domain/invoer.ts`) neemt alleen extra vragen mee die nog van toepassing zijn. Dat is precies het patroon dat
  scenario 8 nodig heeft.
- Stap 2: een tool buiten de toolbox zet `toolBuitenToolbox`. Verder heeft de toolkeuze geen invloed op het risico.

### 1.4 Toolselectie
- De coach kiest een behoefte en een tool uit `content/tools.yaml`. Zod valideert dat de tool in de toolbox staat
  (`src/coach/schemas.ts`).
- Zonder coach, of als de medewerker liever zelf kiest: een keuzelijst.
- Het doel bepaalt de tool. Het risico komt alleen uit de checks, met één uitzondering: een tool buiten de toolbox
  maakt de uitkomst minstens oranje.

### 1.5 Risicoberekening (`src/domain/beslisregels.ts`, pure functie `evalueer`)
1. De kleur per check is de hoogste kleur van de gekozen antwoorden (of van de deelvragen).
2. De uitkomst is de hoogste kleur over alle checks en rode vlaggen.
3. Signalen:
   - **DPIA-signaal** (één ja/nee-waarde): Persoonsgegevens **én** minstens één van:
     - bijzondere persoonsgegevens;
     - Autonomie = Handelen of Beslissen;
     - Gebruikers = Organisatie of Extern;
     - Impact = Serieus of Groot.

     Daarnaast **altijd** bij Vertrouwelijkheid = Serieus of Groot, ook zonder persoonsgegevens.
   - **AI Act-signaal**: één van Autonomie = Handelen of Beslissen, `advies_over_mensen` = ja, of rode vlag
     "AI beslist" = ja.
4. Minimale kleuren:
   - AI Act-signaal → minstens oranje (keuze IJK, regelset 0.5).
   - Tool buiten de toolbox → minstens oranje (regelset 0.7).
5. Toetsers:
   - oranje: per check (Data, Autonomie en Impact → compliance; Systemen, Gebruikers en Afhankelijkheid → architect);
   - plus compliance bij een DPIA- of AI Act-signaal;
   - plus beide toetsers bij een tool buiten de toolbox;
   - rood: beide toetsers.
6. Uitvoer:
   - "Waarom deze kleur?" uit de redenen;
   - voorwaarden (geel), alternatieven (rood), en contact als er geen alternatief is;
   - `dpiaSignaal` en `aiActSignaal`.

### 1.6 Resultaat en vervolgacties
- **Adviescard**:
  - kop in de uitkomstkleur, met de uitkomst ook als tekst;
  - het tooladvies;
  - de tabel met de checks (met de B-, I- en V-scores);
  - "Waarom deze kleur?" en voorwaarden of alternatieven;
  - een DPIA-blok en een AI Act-blok (beide met vaste tekst);
  - "Wie kijkt mee?" en de vervolgactie.
- **Vervolgacties** (webhooks): accountaanvraag (met of zonder voorwaarden), toetsing met een Teams-melding,
  alleen vastleggen, en contact.
- Deze bestemmingen bestaan als configuratiepunten (`ACTIE_*_URL`). Er zijn verder geen andere bestemmingen.

### 1.7 State en opslag
- **State**:
  - `WizardData` (Zod, `src/domain/wizard.ts`) staat als jsonb in de tabel `concept` en wordt automatisch opgeslagen;
  - terug en vooruit gaan kost geen gegevens;
  - er is één bron per antwoord: `checks`, `extraVragen` en `rodeVlaggen`.
- **Register** (tabel `advies`):
  - beschrijving, tooladvies, antwoorden (alleen de antwoorden die van toepassing zijn), rode vlaggen;
  - uitkomst, toetsers, `dpia_signaal`, `ai_act_signaal`, motivatie, voorwaarden, alternatieven;
  - `regelversie`, `toolsversie`, status, aanvrager (naam en e-mail);
  - `vorig_advies_id`: bij "Er is iets veranderd" komt er een nieuw advies, gekoppeld aan het vorige. Er is dus al een
    eenvoudige versieketen.
- **Audit-log** van inzage en besluiten.

### 1.8 UI-componenten die hergebruikt kunnen worden
- `Keuze`: radio of checkbox, met een "i"-uitleg en een foutmarkering.
- `Stappenbalk`, `CoachLabel`, de `.info`- en `.foutmelding`-blokken, `Adviescard` en `Chatvenster`.
- Het patroon "extra vraag onder de check" in `Stap3`.

---

## 2. Verschillen tussen presentatie (opdracht) en code

| # | Onderwerp | Presentatie/opdracht | Code nu | Herkomst |
| --- | --- | --- | --- | --- |
| V1 | Rode vlag "niet-goedgekeurde tool" | Rode vlag 1 → rood | Vervallen; de route loopt via "Een andere tool" in stap 2 → minstens oranje, beide toetsers | Besluit gebruiker (regelset 0.7) |
| V2 | Eén of meer antwoorden per check | Eén antwoord | Checks 1 t/m 4 meer antwoorden, de hoogste kleur telt | Besluit gebruiker (0.3) |
| V3 | AI Act-signaal | Alleen een signaal | Ook minstens oranje | Besluit gebruiker (0.5) |
| V4 | Voorbeelden bij Impact | Tonen als hulptekst | Niet getoond (alleen voor de coach) | Besluit gebruiker (0.6) |
| V5 | "AI adviseert over mensen" | Onderdeel van het AI Act-signaal, maar er is geen vraag die dit vastlegt | Extra vraag `advies_over_mensen` bij Adviseren | Voorstel bouwer, akkoord gebruiker |
| V6 | Hulptekst Afhankelijkheid | "Hoe vaster …" | Zin verwijderd | Besluit gebruiker |
| V7 | Rode vlag 2 (persoonlijke inlog) | Algemene formulering | Concreter (HubBI/AFAS) | Besluit gebruiker (0.7) |

**Verschillen tussen deze nieuwe opdracht en de code** (de opdracht vraagt die te benoemen):

| # | De nieuwe opdracht zegt | Code | Gevolg |
| --- | --- | --- | --- |
| N1 | Data kent "testdata / zelfgemaakte fictieve gegevens" en "onzeker" | Data heeft 4 opties. Testdata staat alleen in de hulptekst; er is geen optie "Weet ik niet" | Zonder optie "onzeker" kan het DPIA-spoor niet starten bij twijfel → **beslissing B1** |
| N2 | Autonomie heeft "Assisteren/adviseren" als één optie | Twee aparte opties | Geen probleem: de code is fijner. Zo houden. |
| N3 | Afhankelijkheid: "Experiment, Persoonlijke oplossing, …" | Langere labels met hetzelfde id | Geen inhoudelijk verschil |
| N4 | DPIA = score op 8 indicatoren (0–1 / 2 / ≥3) | DPIA-signaal = één ja/nee-regel (§1.5) | Twee regels voor hetzelfde onderwerp → **beslissing B2** |
| N5 | AI-classificatie Geen/laag, Beperkt, Hoog | AI Act-signaal (ja/nee, minstens oranje) | Hoe verhouden die twee zich? → **B3, B4** |
| N6 | "AI: ja/nee" is een feit | **Bestaat niet.** De Autonomie-vraag gaat over "de oplossing", niet over AI. Gevolg: een HubBI-flow zonder AI die "Handelt" geeft nu een AI Act-signaal (scenario 5 van de opdracht verwacht dat ook). | Het belangrijkste ontbrekende gegeven → **B3** |
| N7 | Een DPIA alleen bij persoonsgegevens of twijfel | Bij Vertrouwelijkheid = Serieus of Groot is er altijd een DPIA-signaal, ook zonder persoonsgegevens | Conflict → **B2** |
| N8 | Geen dubbele vragen | Rode vlag 2 ("AI beslist zelfstandig over mensen") wordt altijd gesteld, ook als Autonomie ≠ Beslissen. Dat antwoord ligt dan al vast. | Voorstel B7 |

---

## 3. Centraal feitenmodel (voorstel)

Eén lijst met **feiten**, afgeleid uit de bestaande antwoorden en de nieuwe verdiepingsvragen. Elk feit heeft:

`{ id, waarde, bron (vraag-id), soort: expliciet | afgeleid, zekerheid: deterministisch | signaal, gebruiktDoor: [toolbox, dpia, ai] }`

- **Bron van waarheid**: de antwoorden in `WizardData` (zoals nu).
- **Feiten**: worden altijd opnieuw berekend door een pure functie (`leidFeitenAf`). Ze worden nooit los bewerkt.
  Zo is er geen verborgen, verouderde state.

Categorieën van hergebruik (§23 van de opdracht):
- **R** = volledig herbruikbaar (deterministisch);
- **V** = gedeeltelijk herbruikbaar, dus een korte verduidelijkingsvraag;
- **N** = niet herbruikbaar, dus een nieuwe vraag.

---

## 4. Mapping

### 4.1 DPIA-indicatoren

Het DPIA-spoor is actief als Data = Persoonsgegevens, of "Weet ik niet" (B1). Telling: "ja" en "onzeker" tellen allebei
als indicator.

| # | Indicator | Bestaande vraag / bestaand feit | Hergebruik | Verdiepingsvraag (alleen als nodig) | Reden | Technische bron |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Profilering of beoordeling van personen | Autonomie = Beslissen (over mensen) → ja. `advies_over_mensen` = ja → ja. | **R** in die gevallen. Anders **N**. | "Beoordeelt of rangschikt de oplossing mensen, bijvoorbeeld op prestaties, gedrag of geschiktheid?" (ja/nee/weet ik niet) | Adviseren *over mensen* is per definitie een beoordeling van personen | `checks.autonomie`, `extraVragen.advies_over_mensen` |
| D2 | Geautomatiseerde besluitvorming | Autonomie = Beslissen → ja. Rode vlag "AI beslist" = ja → ja. Autonomie alleen Assisteren/Adviseren/Lezen → nee. | **R** | Bij Schrijven/Handelen zonder Beslissen: **V** "Neemt de oplossing zelf besluiten over mensen, zonder dat een mens die eerst controleert?" | Handelen (bijv. een mail versturen) is niet automatisch een besluit over personen | `checks.autonomie` |
| D3 | Significante gevolgen voor betrokkenen | Rode vlag "AI beslist … met grote gevolgen" = ja → ja. Impact Serieus/Groot is alleen een **signaal**: de voorbeeldteksten zijn niet zichtbaar (V4), dus "Groot" zegt niet waarom. | **R** bij de rode vlag, anders **V** of **N** | Bij Impact ≥ Serieus: **V** "Je gaf aan dat de impact serieus of groot kan zijn. Kan dat ook gevolgen hebben voor de mensen van wie de gegevens zijn, zoals hun baan, inkomen of gezondheid?" Anders **N** met dezelfde vraag zonder inleiding. | Opdracht §9 en §23: "Groot" mag niet automatisch "significante gevolgen" betekenen | `checks.impact.*`, `rodeVlaggen` |
| D4 | Bijzondere of gevoelige persoonsgegevens | Extra vraag `bijzondere_persoonsgegevens` | **R** | – (de vraag bestaat al en wordt niet opnieuw gesteld) | Dezelfde betekenis | `extraVragen.bijzondere_persoonsgegevens` |
| D5 | Grote schaal of structurele monitoring | Gebruikers (Organisatie/Extern) en Afhankelijkheid (Team/Bedrijf) zijn **signalen**. Het aantal gebruikers is niet de omvang van de verwerking. | **V** | "Verwerk je gegevens van veel mensen (bijvoorbeeld alle medewerkers of klanten), of volg je mensen structureel?" De inleiding noemt het signaal als dat er is. | Opdracht §7 | `checks.gebruikers`, `checks.afhankelijkheid` |
| D6 | Kwetsbare groepen | Nergens | **N** | "Gaat het om gegevens van mensen in een kwetsbare positie, zoals kinderen, zieke of re-integrerende medewerkers of sollicitanten?" | Geen bron | – |
| D7 | Innovatieve technologie, waaronder AI | **Feit AI** (B3) | **R** (zodra het AI-feit bekend is) | – | Dezelfde informatie als het AI-spoor: één feit, twee sporen (scenario 10) | `feit.ai` |
| D8 | Koppeling van datasets | Systemen = Koppelen is een **signaal**. Alleen Geen of Lezen uit één bron → nee. | **V** bij Koppelen, Schrijven of meerdere systemen | "Je koppelt systemen. Combineer je daarbij persoonsgegevens uit verschillende bronnen?" | Opdracht §6 en §23 | `checks.systemen` |

### 4.2 AI-spoor

Het AI-spoor is actief als het feit AI = ja (B3).

| # | Onderwerp (vraag uit de opdracht) | Bestaande vraag / bestaand feit | Hergebruik | Verdiepingsvraag | Regel (uit de opdracht) |
| --- | --- | --- | --- | --- | --- |
| A0 | **Gebruikt de oplossing AI?** | Tool (Azure OpenAI, AI Flows, M365 Copilot → sterk signaal; HubBI, Claude Code → geen betrouwbaar signaal), beschrijving (de coach) | **V**: vooraf ingevuld, de medewerker bevestigt | "Gebruikt je oplossing AI, bijvoorbeeld om tekst te maken, iets te beoordelen of te voorspellen?" (ja / nee / weet ik niet). Hoort bij check 4. | – (bepaalt of het spoor actief is) |
| A1 | Invloed op rechten, plichten of kansen | Autonomie = Beslissen → "ja, direct". `advies_over_mensen` = ja → minstens "indirect". Autonomie alleen Assisteren → "nee". | **R** bij Beslissen of Assisteren, anders **V** | "Raakt wat de AI doet de rechten, plichten of kansen van mensen?" (nee / indirect / direct) | Direct → Hoog |
| A2 | Toepassingsdomein | – | **N**, alleen als A1 ≠ nee | 6 domeinen uit de opdracht (+ "Iets anders", B6) | Alleen vastleggen |
| A3 | Ongelijkheid, discriminatie, uitsluiting | – | **N**, alleen als A1 ≠ nee | nee / mogelijk / ja | Ja → Hoog |
| A4 | Menselijke herziening door betrokkenen | – | **N**, alleen als A1 ≠ nee | ja, altijd / ja, beperkt / nee / onzeker | Nee → Hoog |
| A5 | Doorslaggevend in de besluitvorming | Autonomie = Beslissen → "doorslaggevend". Alleen Assisteren → "nee". Adviseren over mensen → **signaal**. | **R** of **V** | Bij Adviseren: "De AI adviseert. Hoe zwaar weegt dat advies?" (nee / mede bepalend / doorslaggevend). De bestaande reflectievraag "Beslist de tool, of beslis jij?" wordt daarmee een echte vraag. | Doorslaggevend → Hoog |
| A6 | Transparantie richting betrokkenen | – | **N**, als A1 ≠ nee of Gebruikers = Extern | ja / gedeeltelijk / nee / onzeker | Nee → Hoog · Gedeeltelijk → Beperkt |
| A7 | Structureel menselijk toezicht | Alleen Assisteren (de mens gebruikt elke uitkomst zelf) → "structureel" (signaal, zekerheid middel) | **V** of **N** | ja, structureel / ja, incidenteel / nee / onzeker | Nee → Hoog · Incidenteel → Beperkt |
| A8 | Uitlegbaarheid | – | **N**, altijd als AI = ja | goed / beperkt / niet / onbekend | Goed → laag · Beperkt → Beperkt · Niet → Hoog · Onbekend → Beperkt |

**Klasse** = maximum over de regels (Hoog > Beperkt > Geen/laag). De klasse kan alleen omhoog. Het spoor stopt niet
vroegtijdig. Bij elke regel wordt vastgelegd welk antwoord de regel activeerde.

### 4.3 Toolbox-uitkomst en vervolgacties

| Feit | Toolbox | DPIA | AI | Vervolg / toetser |
| --- | --- | --- | --- | --- |
| Data | ja (kleur) | ingang + D4 | – | compliance (bestaand) |
| Systemen | ja | D8 (signaal) | – | architect (bestaand) |
| Gebruikers | ja | D5 (signaal) | A6 (extern) | architect (bestaand) |
| Autonomie | ja | D1, D2 | A1, A5, A7 | compliance (bestaand) |
| Impact | ja | D3 (signaal) | – | compliance (bestaand) |
| Afhankelijkheid | ja | D5 (signaal) | – | architect (bestaand) |
| AI (nieuw) | B4 | D7 | spoor aan/uit | compliance |
| DPIA-klasse | B4 | – | – | compliance (bestaand: DPIA → compliance) |
| AI-klasse | B4 | – | – | compliance (bestaand: AI Act → compliance) |

Er komen **geen nieuwe bestemmingen** bij. Alleen de bestaande rollen `toetser_compliance` en `toetser_architect` en
de bestaande webhooks worden gebruikt. De webhook-payload krijgt de DPIA- en AI-klasse erbij.

### 4.4 Bestaande vragen die beperkt moeten veranderen om dubbele vragen te voorkomen

1. **Data**: optie "Weet ik niet zeker" erbij (B1).
2. **Autonomie**:
   - de vraag "Gebruikt de oplossing AI?" (A0) komt erbij;
   - `advies_over_mensen` wordt gesteld bij AI = ja **en** Autonomie ≠ alleen Assisteren (nu alleen bij Adviseren).
     Daarmee is A1 meestal al bekend.
3. **Rode vlag "AI beslist zelfstandig over mensen"** wordt alleen gesteld als Autonomie = Beslissen. Anders is het
   antwoord deterministisch "nee" (B7). De uitkomst verandert daardoor niet: Beslissen is al rood.
4. **De reflectievraag bij Autonomie** ("Beslist de tool, of beslis jij?") wordt bij Adviseren de echte vraag A5.

---

## 5. Ontwerpschets (alvast, om de mapping concreet te maken)

- **Content**: een nieuw bestand `content/verdieping.yaml` (versie), met:
  - de feiten;
  - de afleidingen (met de categorie R/V/N);
  - de verdiepingsvragen (tekst, opties, "waarom"-zin, `toon_als`-condities, plek onder welke check);
  - de DPIA-indicatoren met de drempels;
  - de AI-regels.

  Validatie met Zod en kruisverwijzingen, zoals bij de regelset.
- **Domein** (pure functies, zonder UI):
  - `leidFeitenAf`;
  - `relevanteVragen` (de volgende informatiegaten, als lijst);
  - `evalueerDpia`;
  - `evalueerAi`;
  - `evalueer` (Toolbox, uitgebreid volgens B4).

  Elke uitkomst heeft `redenen[]` met regel → feit → bron → expliciet of afgeleid → zekerheid.
- **UI**:
  - geen apart scherm. De verdiepingsvragen verschijnen **onder de check waar ze bij horen** (het bestaande patroon
    voor extra vragen), met één zin over het waarom;
  - een teller "Nog N vragen" op basis van de relevante, nog niet beantwoorde vragen, aangekondigd via `aria-live`;
  - de coach kan de verdiepingsvragen vooraf invullen, net als de checks.
- **Antwoorden die niet meer van toepassing zijn**: ze blijven in het concept staan, maar tellen niet mee en komen
  niet in het register (bestaand patroon). Wordt de vraag weer relevant, dan staat het oude antwoord voorgeselecteerd.
  Wil je liever dat de medewerker het opnieuw bevestigt, zeg het dan.
- **Adviescard**:
  - één samenhangend advies: de Toolbox-uitkomst bovenaan, dan Privacy (klasse + indicatoren in gewone taal), AI
    (klasse + de antwoorden die de doorslag gaven), "Techniek en beheer", en "Wie kijkt mee?";
  - met de disclaimer uit de opdracht;
  - alle uitkomsten ook als tekst, niet alleen als kleur.
- **Opslag**: migratie 005 met `dpia` (jsonb: score, klasse, indicatoren met herkomst) en `ai_risico` (jsonb: klasse,
  domein, regels) bij het advies. Alle feiten staan in `antwoorden`. `regelversie` en `verdiepingsversie` worden
  opgeslagen. De versieketen via `vorig_advies_id` bestaat al, er komt dus geen nieuw versiebeheer.

---

## 6. Beslissingen die nodig zijn vóór de bouw

Deze punten raken de classificatie of de route. Mijn voorstel staat erbij.

| # | Vraag | Geraakte routes | Voorstel |
| --- | --- | --- | --- |
| **B1** | Krijgt Data een optie "Weet ik niet zeker"? Welke kleur? En een optie "Testdata of fictieve gegevens"? | DPIA-ingang, Toolbox-kleur | "Weet ik niet zeker" → **oranje** (net als Persoonsgegevens) en het DPIA-spoor start. **Geen** aparte testdata-optie: testdata valt onder Openbaar of Intern, en de hulptekst blijft. |
| **B2** | Vervangt de DPIA-score (8 indicatoren) het huidige DPIA-signaal? En wat gebeurt er met de regel "Vertrouwelijkheid Serieus/Groot → altijd DPIA-signaal", ook zonder persoonsgegevens? | DPIA-blok, toetsers | De score **vervangt** het signaal. `dpiaSignaal` wordt "score ≥ 2". De Vertrouwelijkheidsregel komt te vervallen voor de DPIA. Die situatie blijft wel oranje via Impact (compliance kijkt dus toch mee). |
| **B3** | Komt er een expliciete vraag "Gebruikt je oplossing AI?" (vooraf ingevuld op basis van tool en beschrijving)? En geldt het AI Act-signaal dan alleen bij AI = ja? | AI-spoor, D7, AI Act → minstens oranje | **Ja en ja.** Gevolg: een flow **zonder AI** die "Handelt" krijgt geen AI-signaal meer. Die blijft wel oranje via Autonomie = Handelen. Scenario 5 en 11 van de opdracht worden daarop aangepast: met AI blijft het AI-signaal. |
| **B4** | Hoe bepalen DPIA- en AI-klasse de Toolbox-uitkomst? | Alle uitkomsten | DPIA "waarschijnlijk" of "verplicht" → minstens **oranje** + compliance. AI **Hoog** → minstens **oranje** + compliance. AI **Beperkt** → minstens **geel**, met voorwaarden die volgen uit het antwoord dat de doorslag gaf (bijv. "Informeer betrokkenen over het gebruik van AI", "Regel structureel menselijk toezicht"). AI **Geen/laag** → geen invloed. Het huidige AI Act-signaal (minstens oranje) gaat op in AI-klasse ≥ Beperkt plus de bestaande regels voor Handelen en Beslissen. |
| **B5** | Welke AI-vragen stel je als de AI geen mensen raakt (A1 = nee)? | Lengte van het AI-spoor | Alleen A0, A1 en A8 (en A6 als er externe gebruikers zijn). A2 t/m A5 en A7 gaan over betrokkenen en worden dan overgeslagen; ze tellen als "ga verder". |
| **B6** | Krijgt de vraag over het domein (A2) een optie "Iets anders"? | Alleen vastlegging | Ja: de 6 domeinen zijn niet uitputtend, en het domein telt niet mee in de klasse. |
| **B7** | Wordt de rode vlag "AI beslist zelfstandig over mensen" alleen gesteld bij Autonomie = Beslissen? | Aanvullende vragen | Ja. Anders "nee", afgeleid uit Autonomie. |
| **B8** | Gelden de DPIA-drempels (0–1 / 2 / ≥3) en de 8 AI-regels zoals in de opdracht? | Classificaties | Ja, overnemen. Ze krijgen een eigen versie en `TODO: valideren door de AI governance & compliance officer`. Let op: door "Onbekend → Beperkt" bij uitlegbaarheid krijgt bijna elke toepassing met generatieve AI minstens **Beperkt**, en dus (bij B4) minstens geel. |

Zonder antwoord op B1–B4 kan ik het rekendeel niet bouwen zonder beslisregels "stil" te veranderen. B5–B8 zijn
kleiner. Als je met alle voorstellen akkoord bent, is "akkoord met de voorstellen" genoeg.

---

## 7. Testscenario's (vooruitblik)

De 16 scenario's uit de opdracht komen als unittests op `leidFeitenAf`, `relevanteVragen`, `evalueerDpia` en
`evalueerAi`. Scenario 8, 9 en 13 (wijzigen en terug) komen daarnaast als integratietest en e2e-test, en scenario 16
als e2e-test met axe en toetsenbordbediening. De bestaande scenario's 1–12 blijven, behalve waar B2 of B3 een
uitkomst bewust verandert. Dat leg ik vast in de CHANGELOG.
