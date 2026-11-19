"use client";
import { useState } from "react";
import { volledigPad } from "@/lib/paden";
import { api } from "./client";

const ROLNAMEN: Record<string, string> = {
  medewerker: "medewerker",
  toetser_compliance: "AI governance & compliance officer",
  toetser_architect: "architect Digitale Ontwikkeling",
  beheerder: "beheerder",
};

export function NepLogin({ gebruikers, terug = "/wizard" }: { gebruikers: { oid: string; naam: string; rollen: string[] }[]; terug?: string }) {
  const [fout, setFout] = useState<string | null>(null);

  async function kies(oid: string) {
    setFout(null);
    try {
      await api("/api/login", { body: { oid } });
      window.location.href = volledigPad(terug);
    } catch {
      setFout("Inloggen is niet gelukt. Probeer het opnieuw.");
    }
  }

  return (
    <>
      {fout && <p className="foutmelding" role="alert">{fout}</p>}
      <ul className="login-lijst">
        {gebruikers.map((g) => (
          <li key={g.oid}>
            <button type="button" className="knop knop--secundair" onClick={() => kies(g.oid)}>
              {g.naam}
              <small>{g.rollen.filter((r) => r !== "medewerker").map((r) => ROLNAMEN[r]).join(", ") || "medewerker"}</small>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
