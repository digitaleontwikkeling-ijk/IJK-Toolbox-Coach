/**
 * Roept de coach aan en valideert elk antwoord. Bij een fout, time-out of
 * ongeldig antwoord geeft elke functie `null`: de wizard valt dan terug op
 * handmatig invullen. De app werkt dus ook volledig zonder AI.
 */
import type { Content } from "../content/laad-content";
import { MockCoachClient } from "./MockCoachClient";
import type {
  ChatInvoer,
  ChecksInvoer,
  CoachClient,
  CoachContext,
  TooladviesInvoer,
  UitlegInvoer,
  VerduidelijkInvoer,
} from "./CoachClient";
import {
  chatSchema,
  checksAntwoordSchema,
  checkVoorstelSchema,
  tooladviesSchema,
  uitlegSchema,
  verduidelijkSchema,
} from "./schemas";

export interface CheckVoorstel {
  check: string;
  voorstel: string;
  zekerheid: "hoog" | "middel" | "laag";
  vervolgvraag?: string;
}

export class CoachService {
  constructor(
    private readonly client: CoachClient | null,
    private readonly content: Content,
    private readonly timeoutMs = 20_000,
  ) {}

  get beschikbaar() {
    return this.client !== null;
  }

  private async vraag(taak: string, fn: (c: CoachClient) => Promise<unknown>): Promise<unknown | null> {
    if (!this.client) return null;
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(this.client),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("time-out")), this.timeoutMs);
        }),
      ]);
    } catch (e) {
      console.warn(`Coach-taak "${taak}" mislukt: ${(e as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private valideer<T>(taak: string, schema: { safeParse(x: unknown): { success: true; data: T } | { success: false } }, ruw: unknown): T | null {
    if (ruw === null) return null;
    const r = schema.safeParse(ruw);
    if (!r.success) {
      console.warn(`Coach-taak "${taak}": ongeldig antwoord, terugval op handmatig invullen.`);
      return null;
    }
    return r.data;
  }

  async verduidelijk(invoer: VerduidelijkInvoer, ctx: CoachContext) {
    const ruw = await this.vraag("verduidelijk", (c) => c.verduidelijk(invoer, ctx));
    return this.valideer("verduidelijk", verduidelijkSchema, ruw);
  }

  async tooladvies(invoer: TooladviesInvoer, ctx: CoachContext) {
    const ruw = await this.vraag("tooladvies", (c) => c.tooladvies(invoer, ctx));
    return this.valideer("tooladvies", tooladviesSchema(this.content, invoer.uitsluiten), ruw);
  }

  /**
   * Geeft alleen geldige voorstellen terug. Een voorstel met een waarde buiten de schaal
   * of voor een onbekende check wordt overgeslagen; die check vult de medewerker zelf in.
   */
  async checksVoorinvullen(invoer: ChecksInvoer, ctx: CoachContext): Promise<CheckVoorstel[] | null> {
    const ruw = await this.vraag("checks", (c) => c.checksVoorinvullen(invoer, ctx));
    const lijst = this.valideer("checks", checksAntwoordSchema, ruw);
    if (!lijst) return null;
    const schema = checkVoorstelSchema(this.content);
    const geldig = new Map<string, CheckVoorstel>();
    for (const item of lijst.checks) {
      const r = schema.safeParse(item);
      if (r.success && !geldig.has(r.data.check)) geldig.set(r.data.check, r.data);
      else if (!r.success) console.warn('Coach-taak "checks": ongeldig voorstel overgeslagen.');
    }
    return [...geldig.values()];
  }

  async uitleg(invoer: UitlegInvoer, ctx: CoachContext) {
    const ruw = await this.vraag("uitleg", (c) => c.uitleg(invoer, ctx));
    return this.valideer("uitleg", uitlegSchema, ruw)?.uitleg ?? null;
  }

  async chat(invoer: ChatInvoer, ctx: CoachContext) {
    const ruw = await this.vraag("chat", (c) => c.chat(invoer, ctx));
    return this.valideer("chat", chatSchema, ruw)?.antwoord ?? null;
  }
}

export function maakCoachClient(modus: "mock" | "uit", content: Content): CoachClient | null {
  if (modus === "mock") return new MockCoachClient(content);
  return null;
}
