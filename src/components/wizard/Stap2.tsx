"use client";
import { useState } from "react";
import { Keuze } from "../Keuze";
import { Spelregels } from "../Spelregels";
import { toolNaam } from "../client";
import type { StapProps } from "./types";

interface Props extends StapProps {
  coachNietBeschikbaar: boolean;
  onAnderAdvies: () => void;
}

export function Stap2({ content, data, wijzig, coachBezig, coachNietBeschikbaar, onAnderAdvies }: Props) {
  const [zelfKiezen, setZelfKiezen] = useState(false);
  const advies = data.tooladvies;
  const kiesHandmatig = zelfKiezen || coachNietBeschikbaar || !advies;

  if (coachBezig === "tooladvies") {
    return <p role="status">De coach zoekt een passende tool…</p>;
  }

  return (
    <>
      {coachNietBeschikbaar && !advies && (
        <p className="info" role="status">{content.teksten.coach_niet_beschikbaar}</p>
      )}

      {advies && (
        <div className="tool-kaart">
          <p className="hulptekst" style={{ margin: 0 }}>
            {advies.bron === "coach" ? "Advies van de coach" : "Door jou gekozen"}
          </p>
          <h3>{toolNaam(content, advies.tool)}</h3>
          {advies.motivatie && <p>{advies.motivatie}</p>}
          <Spelregels content={content} tool={advies.tool} />
        </div>
      )}

      {advies && !kiesHandmatig && (
        <div className="knoppen">
          <button type="button" className="knop knop--secundair" onClick={onAnderAdvies}>
            Vraag de coach om een andere tool
          </button>
          <button type="button" className="knop knop--tekst" onClick={() => setZelfKiezen(true)}>
            Zelf een tool kiezen
          </button>
        </div>
      )}

      {kiesHandmatig && (
        <div style={{ marginTop: "1rem" }}>
          <Keuze
            naam="tool"
            legend="Kies een tool uit de IJK Toolbox"
            opties={content.tools.tools.map((t) => ({ id: t.id, label: t.naam }))}
            waarde={advies?.tool}
            onKies={(tool) =>
              wijzig((d) => ({
                ...d,
                tooladvies: { tool, behoefte: undefined, motivatie: "", bron: "medewerker", geaccepteerd: false },
              }))
            }
          />
          <details>
            <summary>Welke tool past bij welke behoefte?</summary>
            <ul>
              {content.tools.behoeften.map((b) => (
                <li key={b.id}>
                  {b.omschrijving}: {b.tools.map((t) => toolNaam(content, t)).join(" of ")}
                </li>
              ))}
              {content.tools.keuzehints.map((h) => <li key={h}>{h}</li>)}
            </ul>
          </details>
        </div>
      )}
    </>
  );
}
