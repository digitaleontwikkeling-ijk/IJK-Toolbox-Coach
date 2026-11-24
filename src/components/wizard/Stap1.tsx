"use client";
import { useState } from "react";
import type { StapProps } from "./types";

const ANDERS = "__anders";

/**
 * Antwoord op een verduidelijkende vraag van de coach. Met opties: een keuzelijst met "Iets anders…",
 * dat een tekstveld voor een eigen antwoord toont. Zonder opties: een tekstveld.
 */
function Verduidelijking({
  i,
  vraag,
  opties,
  antwoord,
  zet,
}: {
  i: number;
  vraag: string;
  opties: string[];
  antwoord: string;
  zet: (antwoord: string) => void;
}) {
  const eigen = antwoord !== "" && !opties.includes(antwoord);
  const [anders, setAnders] = useState(eigen);
  const id = `verduidelijking-${i}`;
  if (opties.length === 0) {
    return (
      <div className="veld">
        <label htmlFor={id}>{vraag}</label>
        <input id={id} type="text" maxLength={1000} value={antwoord} onChange={(e) => zet(e.target.value)} />
      </div>
    );
  }
  const keuze = anders || eigen ? ANDERS : antwoord;
  return (
    <div className="veld">
      <label htmlFor={id}>{vraag}</label>
      <select
        id={id}
        value={keuze}
        onChange={(e) => {
          const w = e.target.value;
          if (w === ANDERS) {
            setAnders(true);
            zet("");
            setTimeout(() => document.getElementById(`${id}-eigen`)?.focus(), 0);
          } else {
            setAnders(false);
            zet(w);
          }
        }}
      >
        <option value="">Kies een antwoord…</option>
        {opties.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={ANDERS}>Iets anders…</option>
      </select>
      {(anders || eigen) && (
        <div style={{ marginTop: "0.5rem" }}>
          <label htmlFor={`${id}-eigen`} className="sr-only">Jouw eigen antwoord op: {vraag}</label>
          <input
            id={`${id}-eigen`}
            type="text"
            maxLength={1000}
            placeholder="Typ je eigen antwoord"
            value={antwoord}
            onChange={(e) => zet(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export function Stap1({ data, wijzig, fout }: StapProps & { fout: string | null }) {
  return (
    <>
      <div className="veld">
        <label htmlFor="beschrijving">Jouw probleem of idee</label>
        <textarea
          id="beschrijving"
          value={data.beschrijving}
          maxLength={4000}
          aria-describedby="beschrijving-hulp"
          aria-invalid={fout ? true : undefined}
          onChange={(e) => {
            const beschrijving = e.target.value;
            wijzig((d) => ({ ...d, beschrijving }));
          }}
        />
        <p id="beschrijving-hulp" className="hulptekst">
          Bijvoorbeeld: &quot;Ik wil elke week een overzicht van openstaande facturen, zodat mijn team weet wat er
          openstaat.&quot; Gebruik geen echte namen of gegevens van personen.
        </p>
      </div>

      {data.verduidelijking.length > 0 && (
        <section aria-labelledby="verduidelijking-titel">
          <h2 id="verduidelijking-titel">De coach heeft nog {data.verduidelijking.length === 1 ? "een vraag" : "twee vragen"}</h2>
          <p className="hulptekst">Beantwoorden is niet verplicht, maar helpt de coach om je beter te adviseren.</p>
          {data.verduidelijking.map((v, i) => (
            <Verduidelijking
              key={i}
              i={i}
              vraag={v.vraag}
              opties={v.opties}
              antwoord={v.antwoord}
              zet={(antwoord) =>
                wijzig((d) => ({
                  ...d,
                  verduidelijking: d.verduidelijking.map((x, j) => (j === i ? { ...x, antwoord } : x)),
                }))
              }
            />
          ))}
        </section>
      )}
    </>
  );
}
