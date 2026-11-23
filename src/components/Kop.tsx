"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { startPad, volledigPad, wizardPad } from "@/lib/paden";
import { api } from "./client";

interface Props {
  appNaam: string;
  gebruiker: { naam: string; rollen: string[] } | null;
}

export function Kop({ appNaam, gebruiker }: Props) {
  const pad = usePathname();
  // In Teams (iframe) regelt Teams het inloggen; dan geen knop "Uitloggen".
  const [inIframe, setInIframe] = useState(false);
  useEffect(() => setInIframe(window.parent !== window), []);
  const huidig = (p: string) => (pad === p || pad.startsWith(`${p}/`) ? "page" : undefined);
  const [ijk, ...rest] = appNaam.split(" ");

  async function uitloggen() {
    await api("/api/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = volledigPad("/login");
  }

  return (
    <header className="kop">
      <div className="kop__binnen">
        <a href={volledigPad(gebruiker ? startPad(gebruiker.rollen) : "/login")} className="kop__naam">
          <span>{ijk}</span> {rest.join(" ")}
        </a>
        {gebruiker && (
          <nav aria-label="Hoofdmenu">
            {/* Eigen werk van toetsers en beheerders vooraan; de wizard is er ook voor hen. */}
            {gebruiker.rollen.some((r) => r.startsWith("toetser_")) && (
              <Link href="/toetsing" aria-current={huidig("/toetsing")}>Toetsing</Link>
            )}
            {gebruiker.rollen.includes("beheerder") && (
              <Link href="/beheer" aria-current={huidig("/beheer")}>Beheer</Link>
            )}
            {/* Gewone link (geen client-navigatie): de wizard moet altijd opnieuw starten met een leeg idee,
                ook als je er al in staat. */}
            {gebruiker.rollen.includes("medewerker") && (
              <>
                <a href={volledigPad(wizardPad())} aria-current={huidig("/wizard")}>Nieuw idee</a>
                <Link href="/mijn-aanvragen" aria-current={huidig("/mijn-aanvragen")}>Mijn aanvragen</Link>
              </>
            )}
          </nav>
        )}
        {gebruiker && (
          <div className="kop__gebruiker">
            <span>{gebruiker.naam}</span>
            {!inIframe && <button type="button" onClick={uitloggen}>Uitloggen</button>}
          </div>
        )}
      </div>
    </header>
  );
}
