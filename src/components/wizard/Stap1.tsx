"use client";
import { useState } from "react";
import { Keuze } from "../Keuze";
import type { StapProps } from "./types";

const ANDERS = "anders";

type VerduidelijkingData = StapProps["data"]["verduidelijking"][number];

/** Het antwoord zoals de coach het leest: de gekozen opties en het eigen antwoord, gescheiden door "; ". */
export function samengesteldAntwoord(gekozen: string[], eigen: string): string {
  return [...gekozen, eigen.trim()].filter(Boolean).join("; ");
}

/**
 * Antwoord op een verduidelijkende vraag van de coach. Met opties: aanvinkbare knoppen (meerdere antwoorden
 * mogelijk) plus "Iets anders", dat een tekstveld voor een eigen antwoord toont. Zonder opties: een tekstveld.
 */
function Verduidelijking({ i, v, zet }: { i: number; v: VerduidelijkingData; zet: (w: Partial<VerduidelijkingData>) => void }) {
  const naam = `verduidelijking-${i}`;
  // "Iets anders" staat aan zodra er een eigen antwoord is, of zodra de medewerker erop klikt.
  const [anders, setAnders] = useState(v.eigen.trim() !== "");
  if (v.opties.length === 0) {
    return (
      <div className="veld">
        <label htmlFor={naam}>{v.vraag}</label>
        <input id={naam} type="text" maxLength={1000} value={v.antwoord} onChange={(e) => zet({ antwoord: e.target.value })} />
      </div>
    );
  }
  const opties = [...v.opties.map((label, j) => ({ id: `o${j}`, label })), { id: ANDERS, label: "Iets anders" }];
  const waarde = [...v.opties.flatMap((o, j) => (v.gekozen.includes(o) ? [`o${j}`] : [])), ...(anders ? [ANDERS] : [])];
  return (
    <div id={`veld-${naam}`} className="veld">
      <Keuze
        naam={naam}
        meerdere
        legend={v.vraag}
        opties={opties}
        waarde={waarde}
        onKies={(ids) => {
          const gekozen = v.opties.filter((_, j) => ids.includes(`o${j}`));
          const metAnders = ids.includes(ANDERS);
          const eigen = metAnders ? v.eigen : "";
          if (metAnders && !anders) setTimeout(() => document.getElementById(`${naam}-eigen`)?.focus(), 0);
          setAnders(metAnders);
          zet({ gekozen, eigen, antwoord: samengesteldAntwoord(gekozen, eigen) });
        }}
        extra={
          anders && (
            <div style={{ marginTop: "0.5rem" }}>
              <label htmlFor={`${naam}-eigen`} className="sr-only">Jouw eigen antwoord op: {v.vraag}</label>
              <input
                id={`${naam}-eigen`}
                type="text"
                maxLength={500}
                placeholder="Typ je eigen antwoord"
                value={v.eigen}
                onChange={(e) => zet({ eigen: e.target.value, antwoord: samengesteldAntwoord(v.gekozen, e.target.value) })}
              />
            </div>
          )
        }
      />
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
              v={v}
              zet={(w) =>
                wijzig((d) => ({
                  ...d,
                  verduidelijking: d.verduidelijking.map((x, j) => (j === i ? { ...x, ...w } : x)),
                }))
              }
            />
          ))}
        </section>
      )}
    </>
  );
}
