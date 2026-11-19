/**
 * Nagebootste webhook-ontvanger (alleen ontwikkeling/tests). Logt elke aanroep.
 * Controleert het gedeelde geheim. Pad met "/fout" geeft HTTP 500.
 * Starten: npm run mock:webhooks  (poort 8650, geheim uit ACTIE_GEHEIM of "mock-geheim")
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface Ontvangen {
  pad: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

export async function startWebhookMock(opties: { port?: number; geheim: string; header?: string; stil?: boolean }) {
  const header = (opties.header ?? "X-IJK-Webhook-Secret").toLowerCase();
  const ontvangen: Ontvangen[] = [];
  const server = createServer(async (req, res) => {
    let ruw = "";
    for await (const d of req) ruw += d;
    if (req.headers[header] !== opties.geheim) {
      res.writeHead(401).end();
      return;
    }
    const body = ruw ? JSON.parse(ruw) : {};
    ontvangen.push({ pad: req.url ?? "", headers: req.headers, body });
    if (!opties.stil) console.log(`[webhook-mock] ${req.url} ${JSON.stringify(body)}`);
    res.writeHead(req.url?.includes("/fout") ? 500 : 200, { "Content-Type": "application/json" }).end('{"ok":true}');
  });
  await new Promise<void>((r) => server.listen(opties.port ?? 0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    ontvangen,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

if (process.argv[1]?.endsWith("webhook-mock.ts")) {
  const i = process.argv.indexOf("--port");
  startWebhookMock({ port: i > 0 ? Number(process.argv[i + 1]) : 8650, geheim: process.env.ACTIE_GEHEIM ?? "mock-geheim" }).then((m) =>
    console.log(`Nagebootste webhooks op ${m.url} (paden: /account, /toetsing, /melding; /fout geeft 500)`),
  );
}
