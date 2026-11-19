import type { Metadata, Viewport } from "next";
import "../../src/app/globals.css";
import { DemoKop, DemoMelding } from "./DemoOnderdelen";

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
      </body>
    </html>
  );
}
