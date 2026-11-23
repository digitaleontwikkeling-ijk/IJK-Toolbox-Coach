"use client";
import type { AdviesDto } from "./client";

/** "Ingediend door …" voor toetsers en beheerders. Zonder opgeslagen naam: het begin van het pseudoniem. */
export function Aanvrager({ advies }: { advies: AdviesDto }) {
  const a = advies.aanvrager;
  if (!a) {
    return (
      <>
        Ingediend door: onbekend{advies.pseudoniemId ? ` (pseudoniem ${advies.pseudoniemId.slice(0, 12)}…)` : ""}
      </>
    );
  }
  return (
    <>
      Ingediend door: <strong>{a.naam}</strong>
      {a.email && (
        <>
          {" "}· <a href={`mailto:${a.email}`}>{a.email}</a>
        </>
      )}
    </>
  );
}
