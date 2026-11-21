import type { Metadata, Viewport } from "next";
import "../../src/app/globals.css";
import { DemoKop, DemoMelding } from "./DemoOnderdelen";
import { hoeWerktHetHref } from "@/lib/paden";
import content from "@/demo/content.generated.json";

export const metadata: Metadata = {
  title: "IJK Toolbox Coach (demo)",
  description: "Demo van de IJK Toolbox Coach: advies over verantwoord gebruik van digitale tools.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <a className="skiplink" href="#inhoud">Naar de inhoud</a>
        <DemoKop />
        <DemoMelding />
        <main id="inhoud" tabIndex={-1}>{children}</main>
        <footer className="voet">
          <a href={hoeWerktHetHref()}>{content.teksten.hoe_werkt_het.link}</a>
          <span aria-hidden="true"> · </span>
          <span>{content.teksten.app.uitgangspunt}</span>
        </footer>
      </body>
    </html>
  );
}
