/**
 * Serveert demo/out zoals GitHub Pages dat doet: onder het basispad, met index.html
 * per map en een redirect naar de map met slash. Gebruik: npm run demo:serve
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const BASIS = process.env.NEXT_PUBLIC_BASE_PATH ?? "/IJK-Toolbox-Coach";
const MAP = path.resolve(import.meta.dirname, "..", "demo", "out");
const POORT = Number(process.env.POORT ?? 3400);
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".txt": "text/plain", ".ico": "image/x-icon" };

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (!url.pathname.startsWith(BASIS)) return res.writeHead(404).end("Niet gevonden");
  let bestand = path.join(MAP, decodeURIComponent(url.pathname.slice(BASIS.length)));
  if (!bestand.startsWith(MAP)) return res.writeHead(403).end();
  if (existsSync(bestand) && statSync(bestand).isDirectory()) {
    if (!url.pathname.endsWith("/")) return res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
    bestand = path.join(bestand, "index.html");
  }
  if (!existsSync(bestand)) return res.writeHead(404).end("Niet gevonden");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(bestand)] ?? "application/octet-stream" });
  createReadStream(bestand).pipe(res);
}).listen(POORT, "127.0.0.1", () => console.log(`Demo op http://127.0.0.1:${POORT}${BASIS}/`));
