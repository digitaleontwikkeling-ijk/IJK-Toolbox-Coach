"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  appNaam: string;
  gebruiker: { naam: string; rollen: string[] } | null;
}

export function Kop({ appNaam, gebruiker }: Props) {
  const pad = usePathname();
  const huidig = (p: string) => (pad === p || pad.startsWith(`${p}/`) ? "page" : undefined);
  const [ijk, ...rest] = appNaam.split(" ");

  async function uitloggen() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="kop">
      <div className="kop__binnen">
        <Link href="/wizard" className="kop__naam">
          <span>{ijk}</span> {rest.join(" ")}
        </Link>
        {gebruiker && (
          <nav aria-label="Hoofdmenu">
            <Link href="/wizard" aria-current={huidig("/wizard")}>Nieuw idee</Link>
            <Link href="/mijn-aanvragen" aria-current={huidig("/mijn-aanvragen")}>Mijn aanvragen</Link>
            {gebruiker.rollen.some((r) => r.startsWith("toetser_")) && (
              <Link href="/toetsing" aria-current={huidig("/toetsing")}>Toetsing</Link>
            )}
            {gebruiker.rollen.includes("beheerder") && (
              <Link href="/beheer" aria-current={huidig("/beheer")}>Beheer</Link>
            )}
          </nav>
        )}
        {gebruiker && (
          <div className="kop__gebruiker">
            <span>{gebruiker.naam}</span>
            <button type="button" onClick={uitloggen}>Uitloggen</button>
          </div>
        )}
      </div>
    </header>
  );
}
