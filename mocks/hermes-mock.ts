/**
 * Nagebootste Hermes API-server (alleen voor ontwikkeling en tests).
 * Spreekt hetzelfde protocol als Hermes: POST /v1/chat/completions met Bearer-token.
 * De inhoud van de antwoorden komt van de MockCoachClient.
 *
 * Testtriggers in de tekst van de medewerker (beschrijving of vraag):
 *   #hermes-fout        → HTTP 500
 *   #hermes-druk        → HTTP 429 (te veel gelijktijdige runs)
 *   #geen-json          → tekst zonder JSON
 *   #codeblok           → JSON in een ```json-codeblok (moet toch werken)
 *   #verkeerde-tool     → tooladvies met een tool die niet in de toolbox staat
 *   #ongeldige-checks   → checks met waarden buiten de schaal
 *   #andere-uitkomst    → uitleg die een andere uitkomst noemt
 *   #afgebroken         → finish_reason "error"
 *   #traag              → antwoord na 3 seconden
 *
 * Starten: npm run mock:hermes  (poort 8642, sleutel uit HERMES_API_KEY of "mock-sleutel")
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { laadContent, type Content } from "../src/content/laad-content";
import { MockCoachClient } from "../src/coach/MockCoachClient";

export interface Verzoek {
  taak: string;
  headers: Record<string, string | string[] | undefined>;
  body: { model: string; messages: { role: string; content: string }[] };
}

export interface HermesMock {
  url: string;
  verzoeken: Verzoek[];
  stop: () => Promise<void>;
}

function antwoord(content: string, finish = "stop") {
  return {
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "toolbox-coach",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finish }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function maakInhoud(taak: string, invoer: Record<string, unknown>, coach: MockCoachClient, c: Content): Promise<unknown> {
  const tekst = `${invoer.beschrijving ?? ""} ${invoer.vraag ?? ""}`;
  switch (taak) {
    case "verduidelijk":
      return coach.verduidelijk({ beschrijving: String(invoer.beschrijving) });
    case "tooladvies":
      if (tekst.includes("#verkeerde-tool")) return { behoefte: "bouwen", tool: "gratis_chatbot", motivatie: "Handig en gratis." };
      return coach.tooladvies(invoer as never);
    case "checks":
      if (tekst.includes("#ongeldige-checks")) {
        return { checks: c.regelset.checks.map((ch) => ({ check: ch.id, voorstel: "weet_ik_niet", zekerheid: "hoog" })) };
      }
      return coach.checksVoorinvullen(invoer as never);
    case "uitleg": {
      const u = invoer.uitkomst as { naam: string; motivatie: string };
      if (tekst.includes("#andere-uitkomst")) {
        const ander = c.regelset.kleuren.find((k) => k.uitkomst !== u.naam)!;
        return { uitleg: `Goed nieuws: ${ander.uitkomst}!` };
      }
      return { uitleg: `Je advies is "${u.naam}". ${u.motivatie} (uitleg via Hermes)` };
    }
    case "chat":
      return coach.chat({ ...(invoer as object), geschiedenis: [] } as never);
    default:
      return { fout: "onbekende taak" };
  }
}

export async function startHermesMock(opties: { port?: number; apiKey: string; content?: Content }): Promise<HermesMock> {
  const content = opties.content ?? laadContent();
  const coach = new MockCoachClient(content);
  const verzoeken: Verzoek[] = [];

  const server: Server = createServer(async (req, res) => {
    const stuur = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/health") return stuur(200, { status: "ok" });
    if (req.headers.authorization !== `Bearer ${opties.apiKey}`) return stuur(401, { error: { message: "Invalid API key" } });
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") return stuur(404, { error: { message: "Not found" } });

    let ruw = "";
    for await (const deel of req) ruw += deel;
    const body = JSON.parse(ruw) as Verzoek["body"];
    const systeem = body.messages.find((m) => m.role === "system")?.content ?? "";
    const taak = /TAAK: (\w+)/.exec(systeem)?.[1] ?? "onbekend";
    verzoeken.push({ taak, headers: req.headers, body });
    const invoer = JSON.parse(body.messages.find((m) => m.role === "user")?.content ?? "{}");
    const tekst = `${invoer.beschrijving ?? ""} ${invoer.vraag ?? ""}`;

    if (tekst.includes("#hermes-fout")) return stuur(500, { error: { message: "internal error" } });
    if (tekst.includes("#hermes-druk")) return stuur(429, { error: { message: "Too many concurrent runs (max 10)" } });
    if (tekst.includes("#traag")) await new Promise((r) => setTimeout(r, 3000));
    if (tekst.includes("#geen-json")) return stuur(200, antwoord("Ik denk dat dit prima kan, groen licht!"));
    if (tekst.includes("#afgebroken")) return stuur(200, antwoord("", "error"));

    const inhoud = JSON.stringify(await maakInhoud(taak, invoer, coach, content));
    return stuur(200, antwoord(tekst.includes("#codeblok") ? `\`\`\`json\n${inhoud}\n\`\`\`` : inhoud));
  });

  await new Promise<void>((r) => server.listen(opties.port ?? 0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    verzoeken,
    stop: () => new Promise((r) => server.close(() => r())),
  };
}

if (process.argv[1]?.endsWith("hermes-mock.ts")) {
  const poortArg = process.argv.indexOf("--port");
  const port = poortArg > 0 ? Number(process.argv[poortArg + 1]) : 8642;
  startHermesMock({ port, apiKey: process.env.HERMES_API_KEY ?? "mock-sleutel" }).then((m) =>
    console.log(`Nagebootste Hermes API-server op ${m.url}`),
  );
}
