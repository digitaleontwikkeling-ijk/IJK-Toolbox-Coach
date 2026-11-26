/**
 * Mock-coach voor ontwikkeling en tests. Werkt zonder AI met eenvoudige
 * trefwoorden en geeft altijd hetzelfde antwoord op dezelfde invoer.
 * De antwoorden hebben dezelfde vorm als die van Hermes en worden net zo gevalideerd.
 */
import type { Content } from "../content/laad-content";
import type {
  ChatInvoer,
  ChecksInvoer,
  CoachClient,
  TooladviesInvoer,
  UitlegInvoer,
  VerduidelijkInvoer,
} from "./CoachClient";

const heeft = (tekst: string, patroon: RegExp) => patroon.test(tekst.toLowerCase());

/** Volgorde waarin de mock tools herkent: [tool, behoefte, trefwoorden]. IJK gebruikt geen n8n. */
const TOOLREGELS: [string, string, RegExp][] = [
  ["hubbi", "verbinden", /\bafas\b|koppel|verbind/],
  ["ai_flows", "ai_in_werkproces", /\bai\b|beoordeel|kandidat|classific/],
  ["azure_openai", "ai_model_eigen_oplossing", /taalmodel|openai|\bmodel\b/],
  ["claude_code", "bouwen", /dashboard|prototype|\bapp\b|tool bouwen|bouwen/],
  ["copilot_workflows", "m365_automatiseren", /outlook|planner|sharepoint|herinner|workflow|automati/],
  ["m365_copilot", "sneller_afhandelen", /notulen|mail|vergader|document|samenvat/],
];

export class MockCoachClient implements CoachClient {
  constructor(private readonly content: Content) {}

  async verduidelijk({ beschrijving }: VerduidelijkInvoer) {
    const vragen: { vraag: string; opties: string[] }[] = [];
    if (!heeft(beschrijving, /gegevens|data|testdata|persoon|klant/)) {
      vragen.push({
        vraag: "Met welke gegevens ga je werken?",
        opties: [
          "Persoonsgegevens",
          "Klantgegevens of andere vertrouwelijke informatie",
          "Interne werkinformatie, zoals werkinstructies",
          "Openbare informatie",
          "Alleen testdata",
          "Weet ik niet zeker",
        ],
      });
    }
    if (!heeft(beschrijving, /mezelf|mij|collega|team|afdeling|organisatie|klanten/)) {
      vragen.push({
        vraag: "Wie gaat de oplossing gebruiken?",
        opties: ["Alleen ik", "Mijn team of een paar collega's", "Mijn afdeling", "Heel IJK (de hele organisatie)", "Ook mensen buiten IJK, zoals klanten"],
      });
    }
    return { vragen };
  }

  async tooladvies({ beschrijving, verduidelijking, uitsluiten }: TooladviesInvoer) {
    const tekst = [beschrijving, ...verduidelijking.map((v) => v.antwoord)].join(" ");
    const kandidaten = TOOLREGELS.filter(([tool]) => !uitsluiten.includes(tool));
    const match = kandidaten.find(([, , patroon]) => heeft(tekst, patroon)) ?? kandidaten[0];
    if (!match) return { fout: "geen tool meer over" };
    const [tool, behoefte] = match;
    const behoefteTekst = this.content.tools.behoeften.find((b) => b.id === behoefte)?.omschrijving ?? "";
    const naam = this.content.tools.tools.find((t) => t.id === tool)?.naam ?? tool;
    return {
      behoefte,
      tool,
      motivatie: `Je wilt: ${behoefteTekst.toLowerCase()}. Daarvoor is ${naam} de tool in de IJK Toolbox.`,
    };
  }

  async checksVoorinvullen({ beschrijving, verduidelijking }: ChecksInvoer) {
    const t = [beschrijving, ...verduidelijking.map((v) => v.antwoord)].join(" ").toLowerCase();
    const checks: { check: string; deelvraag?: string; voorstel: string; zekerheid: string; vervolgvraag?: string }[] = [];
    const zet = (check: string, voorstel: string, zekerheid = "middel", vervolgvraag?: string) =>
      checks.push({ check, voorstel, zekerheid, ...(vervolgvraag ? { vervolgvraag } : {}) });

    // Data
    if (/verzuim|\bhr\b|hr-|cv|kandidat|salaris|persoonsgegevens|medewerkergegevens|over personen/.test(t)) {
      zet("data", "persoonsgegevens", "hoog");
    } else if (/weet ik niet zeker/.test(t)) {
      zet("data", "weet_niet", "laag", "Staan er gegevens in die je aan een persoon kunt koppelen, zoals namen?");
    } else if (/klantgegevens|vertrouwelijk|contract/.test(t)) {
      zet("data", "vertrouwelijk", "middel", "Staan er namen of andere gegevens over personen in?");
    } else if (/testdata|openba/.test(t)) {
      zet("data", "openbaar", "middel");
    } else {
      zet("data", "intern", "laag", "Gebruik je gegevens over personen, zoals namen of e-mailadressen?");
    }

    // Systemen
    if (/verwerk|schrijf|bijwerken|invoeren/.test(t)) zet("systemen", "schrijven", "middel");
    else if (/koppel/.test(t)) zet("systemen", "koppelen", "middel");
    else if (/uit afas|overzicht|rapport|dashboard/.test(t)) zet("systemen", "lezen", "middel");
    else if (/lokaal|testdata/.test(t)) zet("systemen", "geen", "middel");
    else zet("systemen", "geen", "laag", "Haal je gegevens uit een systeem, zoals AFAS?");

    // Gebruikers
    if (/klanten|extern|internet/.test(t) && !/klantgegevens/.test(t)) zet("gebruikers", "extern", "middel");
    else if (/organisatie|iedereen/.test(t)) zet("gebruikers", "organisatie", "middel");
    else if (/afdeling/.test(t)) zet("gebruikers", "afdeling", "hoog");
    else if (/team|collega/.test(t)) zet("gebruikers", "collegas", "hoog");
    else if (/mezelf|alleen voor mij|alleen ik/.test(t)) zet("gebruikers", "alleen_ik", "hoog");
    else zet("gebruikers", "alleen_ik", "laag", "Wie gaat de oplossing gebruiken?");

    // Autonomie
    if (/kiest|beslist|selecteert|beoordeel/.test(t)) zet("autonomie", "beslissen", "middel");
    else if (/automatisch.*(verwerk|verstuur)/.test(t)) zet("autonomie", "handelen", "middel");
    else if (/verwerk|schrijf|bijwerken/.test(t)) zet("autonomie", "schrijven", "middel");
    else if (/overzicht|dashboard|rapport/.test(t)) zet("autonomie", "lezen", "middel");
    else zet("autonomie", "assisteren", "middel");

    // Impact: per deelvraag (beschikbaarheid, integriteit, vertrouwelijkheid)
    const deel = (deelvraag: string, voorstel: string, zekerheid = "middel", vervolgvraag?: string) =>
      checks.push({ check: "impact", deelvraag, voorstel, zekerheid, ...(vervolgvraag ? { vervolgvraag } : {}) });
    if (/afdeling|team|collega/.test(t)) deel("beschikbaarheid", "beperkt");
    else deel("beschikbaarheid", "nauwelijks", "laag", "Wat gebeurt er als de oplossing een tijdje niet werkt?");
    if (/kiest|beslist|selecteert/.test(t)) deel("integriteit", "groot");
    else if (/verwerk|schrijf|bijwerken/.test(t)) deel("integriteit", "serieus");
    else if (/overzicht|dashboard|rapport/.test(t)) deel("integriteit", "beperkt");
    else deel("integriteit", "nauwelijks");
    if (/verzuim|gezond/.test(t)) {
      deel("vertrouwelijkheid", "serieus", "laag", "Gaat het om gezondheidsgegevens die op straat kunnen komen? Kies dan Groot.");
    }
    else if (/\bhr\b|hr-|cv|kandidat|salaris|persoonsgegevens|klantgegevens/.test(t)) deel("vertrouwelijkheid", "serieus");
    else if (/testdata|openbaar/.test(t)) deel("vertrouwelijkheid", "nauwelijks");
    else deel("vertrouwelijkheid", "beperkt");

    // Afhankelijkheid
    if (/prototype|experiment|uitproberen|testdata/.test(t)) zet("afhankelijkheid", "experiment", "hoog");
    else if (/herinner|mezelf|voor mij/.test(t)) zet("afhankelijkheid", "persoonlijk", "middel");
    else if (/wekelijks|elke week|dagelijks/.test(t) && /afdeling|hr/.test(t)) zet("afhankelijkheid", "team", "middel");
    else zet("afhankelijkheid", "persoonlijk", "laag", "Hoe ga je de oplossing gebruiken: om uit te proberen, voor je eigen werk, of wordt hij vast onderdeel van het werk van je team?");

    return { checks };
  }

  async uitleg({ uitkomst, tool }: UitlegInvoer) {
    const naam = this.content.tools.tools.find((t) => t.id === tool)?.naam ?? tool;
    const delen = [
      `Je advies is "${uitkomst.uitkomst}".`,
      `Waarom? ${uitkomst.motivatie}`,
      uitkomst.voorwaarden.length ? `Je kunt met ${naam} aan de slag als je je aan de voorwaarden houdt.` : "",
      uitkomst.toetsers.length ? "Een toetser kijkt eerst met je mee voordat je verder gaat." : "",
      uitkomst.alternatieven.length ? `Zo kan het wel: ${uitkomst.alternatieven.join(" ")}` : "",
    ];
    return { uitleg: delen.filter(Boolean).join(" ") };
  }

  async chat({ vraag, tool, onderwerp }: ChatInvoer) {
    const expliciet = this.content.tools.tools.find((t) => vraag.toLowerCase().includes(t.naam.toLowerCase()))?.id;
    // In het gesprek: uitleg over de vraag waar de medewerker nu is (tenzij hij naar een tool vraagt).
    if (onderwerp && !expliciet) {
      // Noemt de medewerker een antwoord? Dan alleen dat antwoord uitleggen.
      const optie = onderwerp.opties.find((o) => o.uitleg && vraag.toLowerCase().includes(o.label.toLowerCase().split(" (")[0]!));
      if (optie) return { antwoord: `${optie.label}: ${optie.uitleg} Kies zelf het antwoord dat het best bij je idee past.` };
      const uitleg = onderwerp.uitleg.length ? ` ${onderwerp.uitleg.join(" ")}` : "";
      const metUitleg = onderwerp.opties.some((o) => o.uitleg) ? " Klik op de i naast een antwoord voor de uitleg, of vraag naar een antwoord." : "";
      return { antwoord: `Bij "${onderwerp.vraag}" (${onderwerp.naam}):${uitleg}${metUitleg} Kies zelf het antwoord dat het best bij je idee past.`.slice(0, 2900) };
    }
    const genoemd = expliciet ?? tool;
    const regels = genoemd ? this.content.spelregels[genoemd] : undefined;
    if (regels) {
      const naam = this.content.tools.tools.find((t) => t.id === genoemd)!.naam;
      return {
        antwoord: `Voor ${naam} geldt: zelf doen mag bij ${regels.zelf_doen.join(", ").toLowerCase()}. Let altijd op: ${regels.altijd.join(", ").toLowerCase()}.`,
      };
    }
    return {
      antwoord:
        "Ik ben de oefencoach (zonder AI). Ik kan je vraag nu niet inhoudelijk beantwoorden. Vul de stappen zelf in; de uitkomst wordt altijd met de vaste spelregels berekend.",
    };
  }
}
