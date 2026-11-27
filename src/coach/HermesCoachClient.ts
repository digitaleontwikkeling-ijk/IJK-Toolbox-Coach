/**
 * Koppeling met Hermes Agent via de HTTP API-server (OpenAI-compatibel).
 *
 * Bron: Hermes-documentatie "API Server" (website/docs/user-guide/features/api-server.md).
 * - Endpoint: POST {HERMES_API_URL}/chat/completions (stateless; alle berichten per verzoek)
 * - Authenticatie: Authorization: Bearer {API_SERVER_KEY van het Hermes-profiel}
 * - Profiel: elk Hermes-profiel draait een eigen API-server; de modelnaam is de
 *   profielnaam ("toolbox-coach").
 *
 * Deze client geeft het ruwe JSON-antwoord terug; CoachService valideert het.
 * Bij elke fout gooit hij een exception; CoachService maakt daar `null` van.
 */
import type { Content } from "../content/laad-content";
import type {
  ChatInvoer,
  ChecksInvoer,
  CoachClient,
  CoachContext,
  TooladviesInvoer,
  UitlegInvoer,
  VerduidelijkInvoer,
} from "./CoachClient";
import { verwijderContactgegevens } from "./privacy";
import { systeemPrompt, type CoachTaak, type PromptOpties } from "./prompts";

export interface HermesInstellingen {
  /** Basis-URL inclusief /v1, bijvoorbeeld http://hermes.intern:8642/v1 */
  apiUrl: string;
  apiKey: string;
  /** Modelnaam = profielnaam in Hermes. */
  model: string;
  timeoutMs: number;
}

export class HermesFout extends Error {}

/** Haalt het JSON-object uit het antwoord, ook als het model er toch een codeblok omheen zet. */
export function haalJsonUitTekst(tekst: string): unknown {
  const zonderBlok = tekst.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const begin = zonderBlok.indexOf("{");
  const eind = zonderBlok.lastIndexOf("}");
  if (begin === -1 || eind <= begin) throw new HermesFout("Antwoord bevat geen JSON-object.");
  try {
    return JSON.parse(zonderBlok.slice(begin, eind + 1));
  } catch {
    throw new HermesFout("Antwoord bevat ongeldige JSON.");
  }
}

const schoon = (s: string) => verwijderContactgegevens(s);

export class HermesCoachClient implements CoachClient {
  constructor(
    private readonly instellingen: HermesInstellingen,
    private readonly content: Content,
    private readonly doeFetch: typeof fetch = fetch,
  ) {}

  /** Eén verzoek aan Hermes. Stuurt alleen het pseudoniem en de inhoud die voor de taak nodig is. */
  private async vraag(taak: CoachTaak, ctx: CoachContext, invoer: object, opties: PromptOpties = {}): Promise<unknown> {
    const { apiUrl, apiKey, model, timeoutMs } = this.instellingen;
    const res = await this.doeFetch(`${apiUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: systeemPrompt(taak, this.content, opties) },
          { role: "user", content: JSON.stringify({ gebruiker: ctx.pseudoniemId, ...invoer }) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new HermesFout(`Hermes antwoordde met HTTP ${res.status}.`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: unknown }; finish_reason?: string }[];
    };
    const keuze = json.choices?.[0];
    if (keuze?.finish_reason && keuze.finish_reason !== "stop") {
      throw new HermesFout(`Hermes stopte met finish_reason "${keuze.finish_reason}".`);
    }
    const tekst = keuze?.message?.content;
    if (typeof tekst !== "string" || !tekst.trim()) throw new HermesFout("Leeg antwoord van Hermes.");
    return haalJsonUitTekst(tekst);
  }

  verduidelijk({ beschrijving }: VerduidelijkInvoer, ctx: CoachContext) {
    return this.vraag("verduidelijk", ctx, { beschrijving: schoon(beschrijving) });
  }

  tooladvies({ beschrijving, verduidelijking, uitsluiten, adviesregels }: TooladviesInvoer, ctx: CoachContext) {
    // De adviesregels gaan in de systeeminstructie (als afgebakende gegevens), niet in het gebruikersbericht.
    return this.vraag(
      "tooladvies",
      ctx,
      {
        beschrijving: schoon(beschrijving),
        verduidelijking: verduidelijking.map((v) => ({ vraag: v.vraag, antwoord: schoon(v.antwoord) })),
        uitsluiten,
      },
      { adviesregels },
    );
  }

  checksVoorinvullen({ beschrijving, verduidelijking, tool }: ChecksInvoer, ctx: CoachContext) {
    return this.vraag(
      "checks",
      ctx,
      {
        beschrijving: schoon(beschrijving),
        verduidelijking: verduidelijking.map((v) => ({ vraag: v.vraag, antwoord: schoon(v.antwoord) })),
        tool,
      },
      { tool },
    );
  }

  uitleg({ beschrijving, tool, uitkomst, antwoorden }: UitlegInvoer, ctx: CoachContext) {
    return this.vraag(
      "uitleg",
      ctx,
      {
        beschrijving: schoon(beschrijving),
        tool,
        antwoorden,
        // Alleen de berekende uitkomst; de coach legt uit, beslist niet.
        uitkomst: {
          naam: uitkomst.uitkomst,
          motivatie: uitkomst.motivatie,
          voorwaarden: uitkomst.voorwaarden,
          alternatieven: uitkomst.alternatieven,
          toetsing_nodig: uitkomst.toetsers.length > 0,
          dpia_mogelijk_nodig: uitkomst.dpiaSignaal,
          privacy: uitkomst.dpiaKlasse ?? null,
          ai_risico: uitkomst.aiKlasse ?? null,
        },
      },
      { tool },
    );
  }

  chat({ vraag, stap, beschrijving, tool, geschiedenis, onderwerp, adviesregels }: ChatInvoer, ctx: CoachContext) {
    return this.vraag(
      "chat",
      ctx,
      {
        vraag: schoon(vraag),
        stap,
        beschrijving: schoon(beschrijving),
        tool,
        geschiedenis: geschiedenis.map((b) => ({ rol: b.rol, tekst: schoon(b.tekst) })),
        ...(onderwerp ? { huidige_vraag: onderwerp } : {}),
      },
      { tool, adviesregels },
    );
  }
}
