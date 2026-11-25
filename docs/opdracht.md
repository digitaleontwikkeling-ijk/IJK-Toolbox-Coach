> **Oorspronkelijke opdracht (nov. 2026), ongewijzigd bewaard.** Latere keuzes van IJK gaan voor: zie
> `content/CHANGELOG.md`, `docs/ontwerp.md` en `docs/analyse-privacy-ai.md`. Voorbeelden: geen rode vlag
> "niet-goedgekeurde tool" maar de route "Een andere tool" (0.7), en het DPIA- en AI Act-signaal vervangen door
> de privacy-telling en het AI-risico (0.8).

# Opdracht: bouw de webapp "IJK Toolbox Coach"

Je bent een ervaren full-stack ontwikkelaar. Je bouwt voor IJK (een Nederlandse organisatie) een webapp waarin medewerkers via een wizard advies krijgen over het verantwoord gebruik van digitale tools. De inhoud is gebaseerd op de presentatie *"Verantwoord innoveren en ontwikkelen met de IJK Toolbox coach"* (versie november 2026). Lees deze hele opdracht eerst door. Stel daarna je vragen en maak een plan, **voordat je code schrijft**.

---

## 1. Context

IJK heeft een **IJK Toolbox**: een set goedgekeurde digitale tools. Daarbij hoort een kader met één uitgangspunt: *niet de tool bepaalt wat mag, maar wat je ermee doet.*

Een medewerker die een idee heeft, doorloopt een wizard van vier stappen in twee fases:

| Fase | Stap | Wat gebeurt er |
|---|---|---|
| Fase 1 · Welke tool past? | 1. Wat wil je bereiken? | De medewerker beschrijft in eigen woorden zijn probleem of idee. |
| | 2. Welke tool past? | De coach geeft tooladvies uit de IJK Toolbox. |
| Fase 2 · Mag ik dit doen? | 3. Zes checks | Data, Systemen, Gebruikers, Autonomie, Impact, Afhankelijkheid. |
| | 4. Advies | Een risicoprofiel in één van vier kleuren, met de vervolgactie. |

De **IJK Toolbox Coach** is een AI-agent die draait op **Hermes Agent** (open source, Nous Research), in een eigen VM van IJK. Hermes voert het gesprek, vraagt door en legt uit. **De webapp bewaakt het stappenpad en berekent de uitkomst met vaste beslisregels.** Dat is een harde ontwerpkeuze: het taalmodel bepaalt nooit zelf de kleur.

---

## 2. Wat je bouwt

1. **Een webapp** die als **persoonlijk tabblad in Microsoft Teams** draait en ook los via een link te openen is.
2. **Een backend** met het stappenpad, de beslisregels, het adviesregister en de koppelingen.
3. **Een Teams-app-manifest** met alleen een persoonlijk tabblad (scope `personal`), dus geen bot, kanaal of groepschat.

### Architectuur

```
Teams (persoonlijk tabblad) / intranetlink
        ↓
Frontend: wizard, chatvenster, adviescard, "Mijn aanvragen"
        ↓
Backend: inloggen (Entra ID), stappenpad, beslisregels, adviesregister
        ↓                                   ↓
Hermes API (profiel toolbox-coach)     Actie-webhooks
gesprek, tooladvies, uitleg            aanvraag toetsing, accountaanvraag, Teams-melding
```

---

## 3. Functionele eisen

### 3.1 Inloggen
- Single sign-on via **Microsoft Entra ID**. In Teams via Teams-SSO, los via de normale Entra-login.
- De medewerker ziet alleen zijn eigen gesprekken en aanvragen.
- Rollen: `medewerker`, `toetser_compliance` (AI governance & compliance officer), `toetser_architect` (architect Digitale Ontwikkeling) en `beheerder` (Team Digitale Ontwikkeling).

### 3.2 De wizard
- Een **stappenbalk** bovenaan met de vier stappen. Afgeronde stappen krijgen een vinkje, de huidige stap is gemarkeerd.
- Op elke stap kan de medewerker **terug** zonder gegevens te verliezen.
- Een **chatvenster** naast de wizard, waarin de coach doorvraagt en vragen beantwoordt.

**Stap 1 · Wat wil je bereiken?**
- Een open tekstveld: "Beschrijf in eigen woorden welk probleem je wilt oplossen of welk idee je hebt, zonder al aan een tool te denken."
- De coach mag maximaal twee verduidelijkende vragen stellen.

**Stap 2 · Welke tool past?**
- De coach geeft tooladvies op basis van de behoefte (zie 4.1), met een korte motivatie.
- De medewerker kan het advies accepteren of om een andere tool vragen.

**Stap 3 · Zes checks**
- De coach **vult de checks vooraf in** op basis van de beschrijving. De medewerker bevestigt of past aan.
- Elke check toont de schaal als keuzeknoppen (zie 4.2). De voorgestelde waarde is geselecteerd.
- Check 5 (Impact) toont drie rijen: Beschikbaarheid, Integriteit en Vertrouwelijkheid (zie 4.2a), elk met dezelfde vier niveaus.
- Toon per check de hulpteksten uit 4.2b (bijvoorbeeld de definitie van persoonsgegevens en testdata, en de reflectievraag bij check 4).
- Is de coach onzeker over een check, dan stelt hij in het chatvenster een gerichte vraag.
- Daarnaast stelt de wizard de **rode-vlag-vragen** uit 4.3 (ja/nee).

**Stap 4 · Advies (de adviescard)**
- Een kop in de kleur van de uitkomst, met de naam van de uitkomst.
- Het tooladvies.
- De zes checks met de gekozen antwoorden.
- **"Waarom deze kleur?"**: welke checks of rode vlaggen de doorslag gaven. Deze tekst wordt gegenereerd uit de beslisregels, niet vrij door het taalmodel.
- De voorwaarden (alleen bij geel).
- Het DPIA-signaal en/of het AI Act-signaal, als die van toepassing zijn (zie 4.4).
- Een knop voor de vervolgactie (zie 4.5), plus "Vraag stellen" en "Opnieuw beginnen".
- Het referentienummer (formaat `TC-JJJJ-NNNN`) en de melding dat het advies in het adviesregister staat.

### 3.3 Mijn aanvragen
- Een overzicht van eigen adviezen en aanvragen, met status: *advies gegeven*, *account aangevraagd*, *in toetsing*, *goedgekeurd*, *goedgekeurd met voorwaarden*, *afgewezen*, *contact volgt*.
- Een knop "Er is iets veranderd" bij een bestaand advies. Die start de wizard opnieuw met de vorige antwoorden ingevuld. Elke nieuwe toepassing of wijziging doorloopt de wizard opnieuw.

### 3.4 Toetsers en beheer
- Toetsers zien de aanvragen die bij hen horen (zie 4.4), met alle antwoorden, de uitkomst en de regelversie.
- Toetsers kunnen een besluit vastleggen: goedgekeurd, goedgekeurd met voorwaarden (tekstveld) of afgewezen (met motivatie).
- Beheerders zien alle adviezen en kunnen de inhoud (tools, spelregels) inzien. Wijzigen gaat via Git (zie 5).

---

## 4. Domeinlogica

> **Belangrijk:** alle inhoud hieronder (tools, schalen, kleuren, regels, teksten) moet in **configuratiebestanden** staan (YAML of JSON in `content/`), niet hardcoded in de code. Deze inhoud wordt beheerd door Team Digitale Ontwikkeling en de AI governance & compliance officer. Elke wijziging krijgt een **versienummer**, en dat versienummer wordt bij elk advies opgeslagen. De waarden hieronder zijn de startversie (`v0.1`) en moeten nog door beide toetsers worden gevalideerd.

### 4.1 Tooladvies (behoefte → tool)

| Behoefte | Tool |
|---|---|
| Mails, vergaderingen en documenten sneller afhandelen | Microsoft 365 Copilot |
| Een taak in Microsoft 365 automatiseren | Copilot workflows |
| Systemen of gegevens met elkaar verbinden | HubBI |
| AI toevoegen aan een werkproces | AI Flows |
| Een tool, app of dashboard bouwen | Claude Code |
| Een AI-model gebruiken in een eigen oplossing | Azure OpenAI |

Toelichting voor de coach:
- **HubBI** is IJK's eigen automatiserings- en integratieplatform voor AFAS: voor handmatige, repeterende taken in en om AFAS. Bij voorkeur ook gebruiken voor data van klantmedewerkers waarvoor IJK verwerker is.
- **Copilot workflows** automatiseert terugkerende taken binnen Microsoft 365 (Outlook, Teams, SharePoint, Planner). Kan niet koppelen met systemen buiten Microsoft 365. De workflow draait op het account van de medewerker. Het is een functie in vroege toegang (Microsoft Frontier-programma) die nog kan veranderen.
- **AI Flows** en Copilot workflows zijn beide geschikt om AI-stappen in werkprocessen in te bouwen. Kies AI Flows bij data van klantmedewerkers waarvoor IJK verwerker is.
- IJK gebruikt **geen n8n**. Stel het nooit voor.

### 4.2 De zes checks, met de kleur per antwoord

Kleuren: `groen` < `geel` < `oranje` < `rood`.

| # | Check | Vraag | Antwoorden → kleur |
|---|---|---|---|
| 1 | Data | Welke data gebruik je? | Openbaar → groen · Intern → groen · Persoonsgegevens → oranje · Vertrouwelijk/gevoelig → oranje |
| 2 | Systemen | Welke systemen raak je? | Geen → groen · Lezen (uit een goedgekeurde IJK-bron) → geel · Koppelen → oranje · Schrijven in bedrijfssystemen → oranje |
| 3 | Gebruikers | Wie gebruikt de oplossing? | Alleen ik → groen · Collega's → geel · Afdeling → oranje · Organisatie → oranje · Extern/klanten → oranje |
| 4 | Autonomie | Wat mag de oplossing doen? | Assisteren → groen · Adviseren → groen · Lezen → geel · Schrijven → oranje · Handelen → oranje · Beslissen (over mensen) → rood |
| 5 | Impact | Wat is de impact als het misgaat? Drie deelvragen (B, I, V), zie 4.2a | Per deelvraag: Nauwelijks → groen · Beperkt → geel · Serieus → oranje · Groot → rood. De check krijgt de **hoogste** kleur van de drie. |
| 6 | Afhankelijkheid | Hoe ga je de oplossing gebruiken? | Eenmalig of om uit te proberen (experiment) → groen · Regelmatig, voor mijn eigen werk (persoonlijke oplossing) → groen · Vast onderdeel van het werk van mijn team (teamoplossing) → oranje · Vast onderdeel van een IJK-proces (bedrijfsoplossing) → oranje |

Extra vraag bij check 1, alleen als Persoonsgegevens is gekozen: *"Gaat het om bijzondere persoonsgegevens, zoals gezondheid?"* (ja/nee). Deze vraag is nodig voor het DPIA-signaal.

### 4.2a Check 5 · Impact in drie deelvragen (BIV)

Check 5 sluit aan op het risicomanagementproces van IJK, dat impact beoordeelt op **beschikbaarheid, integriteit en vertrouwelijkheid** (BIV). Toon boven de deelvragen de uitleg: *"Kijk naar de gevolgen voor jezelf, collega's, klanten en IJK."*

| Deelvraag | Vraag | Nauwelijks | Beperkt | Serieus | Groot |
|---|---|---|---|---|---|
| Beschikbaarheid | Wat als het niet werkt? | Ik doe het zelf even opnieuw. | Een paar collega's kunnen tijdelijk niet verder. | Een afdeling of klantproces ligt stil. | Een kritisch IJK-proces of de dienstverlening aan klanten valt langdurig uit. |
| Integriteit | Wat als de uitkomst fout is? | Een fout in mijn eigen concept, die ik zelf zie. | Een fout in een intern overzicht, snel te herstellen. | Verkeerde gegevens in AFAS of verkeerde informatie naar klanten. | Een automatisch besluit met grote gevolgen voor mensen. |
| Vertrouwelijkheid | Wat als informatie bij de verkeerde komt? | Alleen openbare informatie. | Interne informatie bij de verkeerde collega. | Persoons- of klantgegevens buiten de bedoelde groep. | Bijzondere persoonsgegevens of veel klantgegevens op straat (datalek). |

- De score van check 5 is de **hoogste** van de drie deelvragen. Sla de drie deelscores ook apart op.
- Toon de voorbeeldteksten als hulptekst bij de keuzeknoppen.
- Deze teksten zijn een eerste versie. Zet ze in de configuratie en markeer ze met `TODO: afstemmen op de BIV-definities uit het IJK-risicomanagementproces`.

### 4.2b Hulpteksten per check

| Check | Hulptekst |
|---|---|
| 1 Data | **Persoonsgegevens:** naam, e-mailadres, personeelsnummer, of alles wat je direct of indirect aan een persoon kunt koppelen. **Testdata:** gegevens die speciaal zijn gemaakt of geselecteerd om te testen, en die niet herleidbaar zijn tot echte personen, klanten of vertrouwelijke IJK-informatie. Een kopie van echte gegevens of een testomgeving met productiegegevens is géén testdata. |
| 2 Systemen | Voorwaarde bij *Lezen*: via een goedgekeurde koppeling en met IJK-credentials (alleen lezen). |
| 3 Gebruikers | IJK-principe: hoe breder een oplossing wordt gebruikt, hoe minder het nog een persoonlijk experiment is en hoe meer eisen we stellen aan beheer, beveiliging en continuïteit. |
| 4 Autonomie | Reflectievraag: *Beslist de tool, of beslis jij op basis van wat de tool aangeeft?* |
| 5 Impact | Kijk naar de gevolgen voor jezelf, collega's, klanten en IJK, op beschikbaarheid, integriteit en vertrouwelijkheid. De hoogste score telt. |
| 6 Afhankelijkheid | Hoe vaster de oplossing onderdeel wordt van het werk, hoe meer je moet regelen. Experiment: niets extra's. Persoonlijke oplossing: + documentatie, security. Teamoplossing: + eigenaarschap, beheer, logging. Bedrijfsoplossing: + monitoring, architectuur, continuïteit, lifecycle management. Toon dit als lijst "Wat moet je extra regelen?". |

### 4.3 Rode vlaggen (ja → altijd rood)
1. Je gebruikt een tool die IJK niet heeft goedgekeurd, bijvoorbeeld een gratis AI-tool op een persoonlijk account.
2. Je koppelt met je eigen persoonlijke inlog, of er staan wachtwoorden of API-keys in de code. *Uitzondering:* Copilot workflows draaien standaard op het account van de medewerker binnen Microsoft 365; dat is geen rode vlag. Deze vlag gaat over koppelingen met systemen buiten Microsoft 365. `TODO: valideren door toetsers`
3. AI beslist zelfstandig over mensen, met grote gevolgen.
4. Je zet een oplossing met echte gegevens zonder toetsing open voor klanten of op internet.
5. Een proces binnen IJK draait op een persoonlijke oplossing zonder eigenaar of beheer.

Toon bij elke rode vlag het alternatief, zoals in de presentatie: *gebruik een goedgekeurde IJK-tool*, *gebruik IJK-credentials*, *eerst toetsen, dan pas delen*, *wijs een eigenaar aan en regel het beheer*.

### 4.4 Beslisregels

```
uitkomst = hoogste kleur over alle zes checks en rode vlaggen
  groen  → "Direct aan de slag"
  geel   → "Aan de slag met voorwaarden"
  oranje → "Eerst toetsen"
  rood   → "Niet op deze manier"
```

**Toetsers bij oranje:**
- Oranje op check 1 (Data), 4 (Autonomie) of 5 (Impact) → **AI governance & compliance officer**.
- Oranje op check 2 (Systemen), 3 (Gebruikers) of 6 (Afhankelijkheid) → **architect Digitale Ontwikkeling**.
- Oranje op checks van beide, of een rode uitkomst → **beide toetsers** samen.
- `TODO: valideren door toetsers` of oranje op Impact-Beschikbaarheid (continuïteit) ook naar de architect moet.

**DPIA-signaal** (`dpia_mogelijk_nodig = true`): er zijn persoonsgegevens gekozen (check 1) **én** minstens één van deze situaties geldt:
- het zijn bijzondere persoonsgegevens;
- Autonomie is "Beslissen" of "Handelen";
- Gebruikers is "Organisatie" of "Extern/klanten";
- Impact (de hoogste van B, I en V) is "Serieus" of "Groot". Vertrouwelijkheid weegt hier het zwaarst: staat die op "Serieus" of "Groot", dan is er altijd een DPIA-signaal.

Bij een DPIA-signaal gaat de aanvraag altijd (ook) naar de compliance officer.

**AI Act-signaal** (`ai_act_classificatie_nodig = true`): een apart spoor naast de DPIA, ook **zonder** persoonsgegevens. Dit signaal geldt als Autonomie "Handelen" of "Beslissen" is, of als AI adviseert of beslist over mensen. De compliance officer classificeert de toepassing dan volgens de AI Act. Voorbeeld: *"Ik wil dat AI zelfstandig facturen goedkeurt voor betaling."* Beide signalen kunnen tegelijk gelden (bijvoorbeeld AI die sollicitanten selecteert). `TODO: valideren door toetsers`

**"Waarom deze kleur?"**: genereer een korte zin uit de checks en vlaggen die de hoogste kleur veroorzaakten. Bijvoorbeeld: *"Persoonsgegevens (Data) en schrijven in AFAS (Systemen)."*

**Voorwaarden bij geel**: haal ze uit de configuratie, per check die geel scoorde. Voorbeelden:
- Systemen = Lezen → "Gebruik de goedgekeurde koppeling en IJK-credentials met alleen leesrechten."
- Gebruikers = Collega's → "Gaat je team erop vertrouwen? Wijs een eigenaar aan en documenteer."

Implementeer de beslisregels als een **pure functie** zonder afhankelijkheden (input: antwoorden + regelset, output: uitkomst, toetsers, DPIA-signaal, motivatie, voorwaarden), met **volledige unittests**.

### 4.5 Vervolgacties per uitkomst

| Uitkomst | Actie | Technisch |
|---|---|---|
| Direct aan de slag | Accountaanvraag voor de geadviseerde tool | Webhook `ACTIE_ACCOUNT_URL` |
| Aan de slag met voorwaarden | Accountaanvraag, inclusief de voorwaarden | Webhook `ACTIE_ACCOUNT_URL` |
| Eerst toetsen | Aanvraag naar de juiste toetser(s) + melding in Teams | Webhooks `ACTIE_TOETSING_URL` en `ACTIE_MELDING_URL` |
| Niet op deze manier | Geen aanvraag; de coach stelt waar mogelijk een alternatief voor. **Is er geen alternatief, dan neemt Team Digitale Ontwikkeling altijd contact op**, zodat de medewerker niet zelf een weg buiten de kaders gaat zoeken. | Vastleggen. Zonder alternatief ook een melding naar Team DO via webhook `ACTIE_CONTACT_URL`, en status *contact volgt* bij de aanvraag |

De webhooks wijzen naar automatiseringen die IJK zelf beheert (bijvoorbeeld in HubBI of Microsoft 365). Kies geen specifiek platform; maak de URL's configureerbaar. Bouw ze als configureerbare URL's met een gedeeld geheim in de header. Bouw voor ontwikkeling een **mock** die de aanroepen alleen logt.

### 4.6 Spelregels per tool (beginversie, als content-bestand)
Neem per tool drie lijsten op: **"Wat mag je zelf doen?"**, **"Wanneer laat je eerst toetsen?"** en **"Waar let je altijd op?"**. De coach gebruikt deze bij de uitleg en de webapp toont ze bij het tooladvies. Gebruik de teksten hieronder letterlijk; ze komen uit de presentatie.

**Microsoft 365 Copilot**
- *Zelf doen:* teksten opstellen, herschrijven of samenvatten · e-mails en Teams-gesprekken samenvatten · conceptantwoorden laten maken · vergaderingen samenvatten en actiepunten opstellen · informatie zoeken in je eigen IJK-omgeving.
- *Eerst toetsen:* de uitkomst wordt gebruikt voor besluiten over personen · je bouwt of deelt een Copilot-agent met anderen · Copilot wordt gekoppeld aan externe bronnen · output gaat zonder controle naar klanten · bijzondere persoonsgegevens worden verwerkt.
- *Altijd:* controleer de uitkomst voordat je hem gebruikt · je blijft zelf verantwoordelijk voor het resultaat · werk alleen met je IJK-account · houd bestandsrechten op orde (Copilot ziet wat jij mag zien) · meld onjuiste of ongewenste uitkomsten.

**Copilot workflows**
- *Zelf doen:* eigen terugkerende taken automatiseren in Outlook, Teams, SharePoint en Planner · herinneringen, samenvattingen en meldingen voor jezelf of je team · eenvoudige goedkeuringen binnen je team · experimenteren met testdata.
- *Eerst toetsen:* de workflow mailt automatisch naar klanten of externen · de workflow wijzigt gedeelde SharePoint-lijsten of -bestanden · een team of proces gaat afhangen van de workflow · je wilt koppelen met systemen buiten Microsoft 365.
- *Altijd:* je geeft geen dienstverleningsprocessen vorm met Copilot workflows · de workflow draait op jouw account: hij kan alles wat jij mag · test eerst en controleer wat de AI-stappen doen · wijs een eigenaar aan en documenteer wat de workflow doet · gaat je team erop vertrouwen? Regel de overdracht · menselijke controle waar fouten relevante gevolgen hebben.

**HubBI**
- *Zelf doen:* bij voorkeur HubBI gebruiken voor data van klantmedewerkers waarvoor IJK verwerker is · gegevens in AFAS laten wijzigen door een automatisering · gegevens uit AFAS ophalen voor eigen overzichten.
- *Eerst toetsen:* persoons- of salarisgegevens worden verwerkt · een nieuwe API (systeem van een derde partij) wordt gekoppeld aan HubBI · een bedrijfsproces gaat afhangen van de automatisering.
- *Altijd:* eerst testen in een testomgeving · alleen noodzakelijke rechten in AFAS en HubBI · API-tokens veilig beheren en nooit delen · wijzigingen in AFAS herleidbaar houden (logging) · een eigenaar (per hub) aanwijzen en dit documenteren.

**AI Flows**
- *Zelf doen:* bij voorkeur AI Flows gebruiken voor data van klantmedewerkers waarvoor IJK verwerker is · teksten samenvatten of classificeren binnen een werkproces · informatie uit documenten halen voor eigen gebruik · AI-voorstellen die een mens controleert.
- *Eerst toetsen:* persoonsgegevens of vertrouwelijke gegevens gaan door de AI-stap · de AI-uitkomst werkt automatisch door in een systeem · de uitkomst gaat naar klanten of externen · AI bepaalt de route of uitkomst van een proces.
- *Altijd:* alleen goedgekeurde AI-modellen gebruiken · menselijke controle waar fouten gevolgen hebben · prompts en instellingen documenteren · de kwaliteit van de uitkomsten periodiek controleren · een eigenaar (per flow) aanwijzen.

**Claude Code**
- *Zelf doen:* experimenteren en leren · prototypes maken · code laten genereren en lokaal (op je laptop) opslaan · een kleine, interne tool of applicatie bouwen · bestaande code begrijpen of verbeteren · apps en dashboards ontwikkelen.
- *Eerst toetsen:* de tool/applicatie verwerkt persoonsgegevens · de tool/applicatie gebruikt vertrouwelijke gegevens · er wordt verbinding gemaakt met IJK-systemen · meerdere collega's gaan de applicatie gebruiken · de applicatie wordt bedrijfskritisch · AI kan zelfstandig acties uitvoeren.
- *Altijd:* alleen het zakelijke Claude-account van IJK gebruiken · geen credentials of secrets hardcoded opslaan · alleen toegestane repositories en data gebruiken · testen voordat iets echt gebruikt wordt · geef de tool alleen toegang tot wat echt nodig is (bijvoorbeeld alleen leesrechten als je alleen gegevens ophaalt, en laat de tool alleen in je projectmap werken).

**Azure OpenAI**
- *Zelf doen:* experimenteren met testdata in de IJK-Azure-omgeving · prompts en modelinstellingen testen · AI-functionaliteit toevoegen aan prototypes · persoons- of vertrouwelijke gegevens verwerken via een goedgekeurde IJK-deployment in de EU · het model gebruiken via goedgekeurde koppelingen (bijvoorbeeld binnen AI Flows).
- *Eerst toetsen:* er worden bijzondere persoonsgegevens verwerkt, zoals gezondheid · je hebt een nieuwe deployment of een andere regio nodig · de toepassing neemt beslissingen over mensen · ook anderen gaan de oplossing gebruiken · de uitkomst gaat naar klanten of bedrijfssystemen · je wilt een model trainen of finetunen.
- *Altijd:* alleen EU Data Zone- of regionale deployments van IJK gebruiken, nooit Global · bij gebruik van het model vanuit AI Flows of via Claude Code ontwikkelde software: bewaar API-keys in je kluis (Keeper) · een eigenaar per deployment aanwijzen.

---

## 5. Koppeling met Hermes

- Hermes draait apart, met een eigen profiel `toolbox-coach`. Jij bouwt Hermes niet, maar koppelt de webapp eraan via de **HTTP API-server van Hermes**.
- Zoek in de officiële documentatie van Hermes Agent (hermes-agent.nousresearch.com) op welke API en authenticatie beschikbaar zijn. Bouw een interface `CoachClient` met twee implementaties: `HermesCoachClient` en `MockCoachClient`. De mock gebruik je voor ontwikkeling en tests.
- De coach heeft vier taken. Laat de coach voor elke taak **gestructureerde JSON** teruggeven en valideer die met een schema:
  1. **Verduidelijken** (stap 1): maximaal twee vervolgvragen.
  2. **Tooladvies** (stap 2): `{ behoefte, tool, motivatie }`. De tool moet in de configuratie staan.
  3. **Checks voorinvullen** (stap 3): per check `{ check, voorstel, zekerheid, vervolgvraag? }`. Voor check 5 per deelvraag (B, I, V) een eigen voorstel. De waarden moeten uit de schaal komen.
  4. **Uitleg** (stap 4): een uitleg in begrijpelijk Nederlands bij de uitkomst die **jouw** beslisregels hebben berekend.
- Valideer alle antwoorden van de coach. Geldt een antwoord niet, of geeft de coach geen antwoord, dan valt de wizard terug op handmatig invullen door de medewerker. **De webapp moet volledig bruikbaar blijven zonder AI.**
- Stuur alleen naar Hermes wat nodig is. Geen namen of e-mailadressen; gebruik een pseudoniem gebruikers-ID.

---

## 6. Niet-functionele eisen

### Huisstijl en taal
- Alle teksten in de interface in het **Nederlands**: helder, laagdrempelig, zonder jargon. Gebruik vaktermen (DPIA, OAuth, AI Act) alleen waar nodig, met uitleg.
- IJK-kleuren:
  - paars `#1C0E3B` (primair)
  - groen `#50A78A` (accent)
  - lichtgrijs `#F2F3F7` (vlakken)
- Uitkomstkleuren:
  - groen `#50A78A`
  - geel `#EFBE2E`
  - oranje `#E07B2E`
  - rood `#BE1F4E`

  Toon de kleur nooit als enige drager van betekenis: altijd met de naam van de uitkomst erbij.
- Toegankelijk (WCAG 2.1 AA) en responsive. De app moet ook in het smalle Teams-tabblad goed werken.

### Beveiliging en privacy
De app volgt zelf de spelregels van het kader:
- geen secrets in code; alles via omgevingsvariabelen en `.env.example`;
- minimale rechten voor elke koppeling;
- invoer valideren en uitvoer escapen;
- autorisatie per rol op elke API-route;
- audit-logging van inzage door toetsers en beheerders.

Over de chatgeschiedenis:
- sla alleen op wat nodig is voor het adviesregister;
- maak een bewaartermijn instelbaar via configuratie (standaard 12 maanden).

**Adviesregister** (per advies):
- referentienummer;
- datum;
- pseudoniem gebruikers-ID;
- beschrijving;
- tooladvies;
- antwoorden per check (bij Impact per deelvraag B, I en V) en rode vlaggen;
- uitkomst, toetsers, DPIA-signaal en AI Act-signaal;
- voorwaarden;
- regelversie;
- status;
- besluiten van toetsers.

### Techniek
- Voorkeur:
  - TypeScript;
  - Next.js (of een vergelijkbaar framework) voor frontend en backend;
  - PostgreSQL;
  - Teams JavaScript SDK voor het tabblad en SSO;
  - MSAL voor Entra ID.

  Wijk je af, motiveer dat dan.
- Draait in een container (Dockerfile + docker-compose voor lokaal, inclusief database en mocks).
- Tests: unittests voor de beslisregels, integratietests voor de API, en een end-to-end-test van de wizard met de mock-coach.

---

## 7. Testscenario's (verplicht als geautomatiseerde tests)

| # | Beschrijving | Verwachte uitkomst |
|---|---|---|
| 1 | Notulen van het teamoverleg automatisch laten maken (Copilot; intern, collega's, assisteren, beperkt) | Geel |
| 2 | Wekelijks overzicht van openstaande facturen uit AFAS in Teams (HubBI; intern, lezen, collega's, lezen, beperkt, persoonlijk) | Geel, voorwaarden: leesrechten, eigenaar |
| 3 | Lokaal prototype met testdata, alleen voor mezelf (Claude Code; openbaar, geen, alleen ik, assisteren, nauwelijks, experiment) | Groen |
| 4 | Verzuimdashboard van mijn afdeling (Claude Code; persoonsgegevens + bijzonder, lezen, afdeling, lezen, serieus) | Oranje, beide toetsers, DPIA-signaal |
| 5 | HR-gegevens wekelijks automatisch in AFAS verwerken (HubBI; persoonsgegevens, schrijven, afdeling, handelen, serieus, teamoplossing) | Oranje, beide toetsers, DPIA-signaal, AI Act-signaal |
| 6 | AI beoordeelt cv's en kiest kandidaten (AI Flows; persoonsgegevens, beslissen, groot) | Rood, met alternatief: AI vat samen, recruiter beslist |
| 7 | Klantgegevens in een gratis AI-tool plakken (rode vlag 1) | Rood |
| 8 | Een HubBI-flow logt in met een persoonlijk account (rode vlag 2) | Rood |

Waar bij Impact in de tabel één waarde staat, is dat de hoogste deelscore. Kies de andere deelvragen gelijk of lager.

Voeg ook deze scenario's toe:

| # | Beschrijving | Verwachte uitkomst |
|---|---|---|
| 9 | Alles groen, behalve Vertrouwelijkheid = Groot (bijzondere persoonsgegevens kunnen uitlekken) | Rood |
| 10 | Alles groen, behalve Beschikbaarheid = Serieus (een afdeling ligt stil als het uitvalt) | Oranje, compliance officer |
| 11 | AI keurt zelfstandig facturen goed voor betaling (Copilot workflows of AI Flows; intern, handelen, serieus) | Oranje, AI Act-signaal, géén DPIA-signaal |
| 12 | Persoonlijke herinneringen in Outlook via Copilot workflows (intern, geen, alleen ik, assisteren, nauwelijks, persoonlijk) | Groen; geen rode vlag voor het eigen account |

Voeg zelf minimaal tien randgevallen toe, zoals een ontbrekend antwoord, een ongeldige waarde van de coach of het opnieuw doorlopen na een wijziging.

---

## 8. Werkwijze en fasering

Werk in deze volgorde. Lever na elke fase een korte samenvatting en wacht op akkoord:

1. **Plan en vragen.** Stel je vragen over onduidelijkheden. Maak een technisch ontwerp (mappenstructuur, datamodel, API-routes, componenten).
2. **Beslisregels.** Content-bestanden + pure beslisfunctie + alle tests uit hoofdstuk 7, groen.
3. **Wizard met mock-coach.** De volledige gebruikersflow, adviescard en "Mijn aanvragen", werkend zonder AI.
4. **Koppeling met Hermes.** `HermesCoachClient`, schema-validatie, terugvalopties.
5. **Acties en adviesregister.** Webhooks (met mock), statussen, toetsersscherm.
6. **Teams.** Het manifest (alleen scope `personal`), SSO en een test in het tabblad.
7. **Afronding.** README (installatie, configuratie, content beheren), `.env.example`, uitleg over het bijwerken van de regelset.

---

## 9. Belangrijk

- **Werk alleen met testdata en fictieve gegevens.** Volgens het IJK-kader is deze app zelf een toepassing die "Eerst toetsen" moet doorlopen (bij beide toetsers), voordat hij met echte gegevens of door collega's gebruikt wordt.
- Verzin geen nieuwe spelregels of beslisregels. Is iets onduidelijk, vraag het dan, of maak het configureerbaar en markeer het als `TODO: valideren door toetsers`.
- Houd de code eenvoudig en goed leesbaar. Team Digitale Ontwikkeling gaat dit beheren.
