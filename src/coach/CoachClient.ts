/**
 * Koppeling met de coach (Hermes Agent, profiel toolbox-coach).
 *
 * Een CoachClient geeft RUWE antwoorden terug (onbekende JSON). De service in
 * `coach/service.ts` valideert elk antwoord tegen de schema's en de content.
 * Een ongeldig of ontbrekend antwoord wordt `null`; de wizard valt dan terug op
 * handmatig invullen. De coach bepaalt NOOIT de kleur: dat doen de beslisregels.
 *
 * Privacy: er gaat nooit een naam of e-mailadres naar de coach, alleen het
 * pseudoniem gebruikers-ID en de inhoud die nodig is voor de taak.
 */
import type { BeslisUitkomst } from "../domain/beslisregels";

export interface CoachContext {
  pseudoniemId: string;
}

export interface Verduidelijking {
  vraag: string;
  antwoord: string;
}

export interface VerduidelijkInvoer {
  beschrijving: string;
}

export interface TooladviesInvoer {
  beschrijving: string;
  verduidelijking: Verduidelijking[];
  /** Tools die de medewerker niet wil. */
  uitsluiten: string[];
}

export interface ChecksInvoer {
  beschrijving: string;
  verduidelijking: Verduidelijking[];
  tool: string;
}

export interface UitlegInvoer {
  beschrijving: string;
  tool: string;
  /** Door de beslisregels berekend; de coach legt alleen uit. */
  uitkomst: BeslisUitkomst;
  /** Gekozen antwoorden, als leesbare labels: { "Data": "Intern", ... } */
  antwoorden: Record<string, string>;
}

export interface ChatInvoer {
  vraag: string;
  stap: number;
  beschrijving: string;
  tool?: string;
  /** Laatste berichten, voor context. */
  geschiedenis: { rol: "coach" | "medewerker"; tekst: string }[];
}

export interface CoachClient {
  /** Taak 1: maximaal twee verduidelijkende vragen. Verwacht: { vragen: string[] } */
  verduidelijk(invoer: VerduidelijkInvoer, ctx: CoachContext): Promise<unknown>;
  /** Taak 2: tooladvies. Verwacht: { behoefte, tool, motivatie } */
  tooladvies(invoer: TooladviesInvoer, ctx: CoachContext): Promise<unknown>;
  /** Taak 3: checks voorinvullen. Verwacht: { checks: [{ check, voorstel, zekerheid, vervolgvraag? }] } */
  checksVoorinvullen(invoer: ChecksInvoer, ctx: CoachContext): Promise<unknown>;
  /** Taak 4: uitleg bij de berekende uitkomst. Verwacht: { uitleg } */
  uitleg(invoer: UitlegInvoer, ctx: CoachContext): Promise<unknown>;
  /** Vrije vraag in het chatvenster. Verwacht: { antwoord } */
  chat(invoer: ChatInvoer, ctx: CoachContext): Promise<unknown>;
}
