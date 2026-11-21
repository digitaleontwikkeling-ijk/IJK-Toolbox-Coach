import type { Metadata, Viewport } from "next";
import "./globals.css";
import { huidigeGebruiker } from "@/auth/server";
import { content } from "@/content/laad-content";
import { Kop } from "@/components/Kop";
import { hoeWerktHetHref } from "@/lib/paden";

export const metadata: Metadata = {
  title: "IJK Toolbox Coach",
  description: "Advies over verantwoord gebruik van digitale tools uit de IJK Toolbox.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gebruiker = await huidigeGebruiker();
  const teksten = content().teksten;
  return (
    <html lang="nl">
      <body>
        <a className="skiplink" href="#inhoud">Naar de inhoud</a>
        <Kop
          appNaam={teksten.app.naam}
          gebruiker={gebruiker ? { naam: gebruiker.naam, rollen: gebruiker.rollen } : null}
        />
        <p className="melding-testdata">{teksten.app.testdata_melding}</p>
        <main id="inhoud" tabIndex={-1}>{children}</main>
        <footer className="voet">
          <a href={hoeWerktHetHref()}>{teksten.hoe_werkt_het.link}</a>
          <span aria-hidden="true"> · </span>
          <span>{teksten.app.uitgangspunt}</span>
        </footer>
      </body>
    </html>
  );
}
