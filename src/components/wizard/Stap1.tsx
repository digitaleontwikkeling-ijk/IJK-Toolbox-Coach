"use client";
import type { StapProps } from "./types";

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
            <div className="veld" key={i}>
              <label htmlFor={`verduidelijking-${i}`}>{v.vraag}</label>
              <input
                id={`verduidelijking-${i}`}
                type="text"
                maxLength={1000}
                value={v.antwoord}
                onChange={(e) => {
                  const antwoord = e.target.value;
                  wijzig((d) => ({
                    ...d,
                    verduidelijking: d.verduidelijking.map((x, j) => (j === i ? { ...x, antwoord } : x)),
                  }));
                }}
              />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
