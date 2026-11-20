"use client";
/**
 * Een vraag met keuzeknoppen. Toegankelijk: fieldset + legend + echte radio's,
 * of echte selectievakjes als meerdere antwoorden mogen.
 */
import type { ReactNode } from "react";

interface Basis {
  naam: string;
  legend: ReactNode;
  vraag?: string;
  opties: { id: string; label: string }[];
  extra?: ReactNode;
  fout?: boolean;
}

type Props =
  | (Basis & { meerdere?: false; waarde: string | undefined; onKies: (id: string) => void })
  | (Basis & { meerdere: true; waarde: string[]; onKies: (ids: string[]) => void });

export function Keuze(props: Props) {
  const { naam, legend, vraag, opties, extra, fout } = props;
  const gekozen = (id: string) => (props.meerdere ? props.waarde.includes(id) : props.waarde === id);
  const wissel = (id: string) => {
    if (props.meerdere) {
      const nieuw = props.waarde.includes(id) ? props.waarde.filter((x) => x !== id) : [...props.waarde, id];
      // Volgorde van de schaal aanhouden.
      props.onKies(opties.map((o) => o.id).filter((o) => nieuw.includes(o)));
    } else {
      props.onKies(id);
    }
  };

  return (
    <fieldset className="keuze" aria-invalid={fout || undefined} style={fout ? { borderColor: "var(--avondrood)" } : undefined}>
      <legend>
        {legend}
        {vraag && <span className="keuze__vraag">{vraag}</span>}
        {props.meerdere && <span className="keuze__hint">Je kunt meerdere antwoorden kiezen.</span>}
      </legend>
      <div className="keuze__opties">
        {opties.map((o) => {
          const id = `${naam}-${o.id}`;
          return (
            <div className="keuze__optie" key={o.id}>
              <input
                type={props.meerdere ? "checkbox" : "radio"}
                id={id}
                name={naam}
                value={o.id}
                checked={gekozen(o.id)}
                onChange={() => wissel(o.id)}
              />
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

/** De gekozen antwoorden van een check altijd als lijst. */
export const alsLijst = (w: string | string[] | undefined): string[] => (Array.isArray(w) ? w : w ? [w] : []);
