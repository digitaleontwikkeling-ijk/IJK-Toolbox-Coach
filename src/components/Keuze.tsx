"use client";
/**
 * Een vraag met keuzeknoppen. Toegankelijk: fieldset + legend + echte radio's,
 * of echte selectievakjes als meerdere antwoorden mogen.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

interface Basis {
  naam: string;
  legend: ReactNode;
  vraag?: string;
  /** Hulptekst onder de vraag (bijvoorbeeld definities of een reflectievraag). */
  toelichting?: ReactNode;
  /** Opties; met `hulp` staat er een voorbeeld bij de knop, met `uitleg` een "i"-knopje met toelichting. */
  opties: { id: string; label: string; hulp?: string; uitleg?: string; icoon?: ReactNode }[];
  extra?: ReactNode;
  fout?: boolean;
}

type Props =
  | (Basis & { meerdere?: false; waarde: string | undefined; onKies: (id: string) => void })
  | (Basis & { meerdere: true; waarde: string[]; onKies: (ids: string[]) => void });

export function Keuze(props: Props) {
  const { naam, legend, vraag, toelichting, opties, extra, fout } = props;
  const metHulp = opties.some((o) => o.hulp);
  // Toelichting achter het "i"-knopje: één tegelijk open, onder de keuzes van deze vraag.
  const [open, setOpen] = useState<string | null>(null);
  const uitlegId = `${useId()}-uitleg`;
  const vak = useRef<HTMLFieldSetElement>(null);
  const openOptie = opties.find((o) => o.id === open);
  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => {
      if (vak.current && !vak.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", buiten);
    return () => document.removeEventListener("mousedown", buiten);
  }, [open]);
  const sluitMetEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      setOpen(null);
      e.stopPropagation();
    }
  };
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
    <fieldset className="keuze" ref={vak} onKeyDown={sluitMetEscape} aria-invalid={fout || undefined} style={fout ? { borderColor: "var(--avondrood)" } : undefined}>
      <legend>
        {legend}
        {vraag && <span className="keuze__vraag">{vraag}</span>}
        {props.meerdere && <span className="keuze__hint">Je kunt meerdere antwoorden kiezen.</span>}
      </legend>
      {toelichting && <div className="keuze__toelichting">{toelichting}</div>}
      <div className={`keuze__opties${metHulp ? " keuze__opties--lijst" : ""}`}>
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
              <label htmlFor={id}>
                {o.icoon}
                {o.hulp ? (
                  <span>
                    <span className="keuze__label">{o.label}</span>
                    <span className="keuze__optiehulp">{o.hulp}</span>
                  </span>
                ) : (
                  o.label
                )}
              </label>
              {o.uitleg && (
                <button
                  type="button"
                  className="keuze__info"
                  aria-label={`Uitleg bij ${o.label}`}
                  aria-expanded={open === o.id}
                  aria-controls={uitlegId}
                  onClick={() => setOpen(open === o.id ? null : o.id)}
                >
                  <span aria-hidden="true">i</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {opties.some((o) => o.uitleg) && (
        <div id={uitlegId} className="keuze__uitleg" role="status" hidden={!openOptie}>
          {openOptie && (
            <>
              <strong>{openOptie.label}: </strong>
              {openOptie.uitleg}
            </>
          )}
        </div>
      )}
      {extra}
    </fieldset>
  );
}

export const JA_NEE = [
  { id: "ja", label: "Ja" },
  { id: "nee", label: "Nee" },
];
export const naarJaNee = (b: boolean | undefined) => (b === undefined ? undefined : b ? "ja" : "nee");

/** De gekozen antwoorden van een check altijd als lijst (bij deelvragen: alle deelantwoorden). */
export const alsLijst = (w: string | string[] | Record<string, string> | undefined): string[] =>
  Array.isArray(w) ? w : typeof w === "string" ? (w ? [w] : []) : w ? Object.values(w) : [];
