"use client";
/** Een vraag met keuzeknoppen (radiogroep). Toegankelijk: fieldset + legend + echte radio's. */
import type { ReactNode } from "react";

interface Props {
  naam: string;
  legend: ReactNode;
  vraag?: string;
  opties: { id: string; label: string }[];
  waarde: string | undefined;
  onKies: (id: string) => void;
  extra?: ReactNode;
  fout?: boolean;
}

export function Keuze({ naam, legend, vraag, opties, waarde, onKies, extra, fout }: Props) {
  return (
    <fieldset className="keuze" aria-invalid={fout || undefined} style={fout ? { borderColor: "var(--avondrood)" } : undefined}>
      <legend>
        {legend}
        {vraag && <span className="keuze__vraag">{vraag}</span>}
      </legend>
      <div className="keuze__opties">
        {opties.map((o) => {
          const id = `${naam}-${o.id}`;
          return (
            <div className="keuze__optie" key={o.id}>
              <input type="radio" id={id} name={naam} value={o.id} checked={waarde === o.id} onChange={() => onKies(o.id)} />
              <label htmlFor={id}>{o.label}</label>
            </div>
          );
        })}
      </div>
      {extra}
    </fieldset>
  );
}

export const JA_NEE = [
  { id: "ja", label: "Ja" },
  { id: "nee", label: "Nee" },
];
export const naarJaNee = (b: boolean | undefined) => (b === undefined ? undefined : b ? "ja" : "nee");
