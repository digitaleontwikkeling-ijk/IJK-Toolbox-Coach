"use client";
import { useState } from "react";

const ROLNAMEN: Record<string, string> = {
  medewerker: "medewerker",
  toetser_compliance: "AI governance & compliance officer",
  toetser_architect: "architect Digitale Ontwikkeling",
  beheerder: "beheerder",
};

export function NepLogin({ gebruikers }: { gebruikers: { oid: string; naam: string; rollen: string[] }[] }) {
  const [fout, setFout] = useState<string | null>(null);

  async function kies(oid: string) {
    setFout(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oid }),
    });
    if (res.ok) window.location.href = "/wizard";
    else setFout("Inloggen is niet gelukt. Probeer het opnieuw.");
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
