"use client";
import type { Teksten } from "@/domain/content-schema";

interface Props {
  teksten: Teksten;
  huidig: number;
  /** Hoogste stap die de medewerker al heeft bereikt; die stappen zijn klikbaar. */
  bereikt: number;
  onKies: (stap: number) => void;
}

export function Stappenbalk({ teksten, huidig, bereikt, onKies }: Props) {
  return (
    <nav className="stappenbalk" aria-label="Voortgang">
      <div className="stappenbalk__fases" aria-hidden="true">
        {teksten.fases.map((f, i) => (
          <div key={f.naam} className="stappenbalk__fase">Fase {i + 1} · {f.naam}</div>
        ))}
      </div>
      <ol>
        {teksten.stappen.map((s) => {
          const klaar = s.nummer < huidig;
          const isHuidig = s.nummer === huidig;
          const status = klaar ? "afgerond" : isHuidig ? "huidige stap" : "nog te doen";
          const inhoud = (
            <>
              <span className="stap__hex" aria-hidden="true">{klaar ? "✓" : s.nummer}</span>
              <span className="stap__titel">{s.titel}</span>
              <span className="sr-only">
                Stap {s.nummer}: {s.titel} ({status})
              </span>
            </>
          );
          return (
            <li
              key={s.nummer}
              className={`stap${klaar ? " stap--klaar" : ""}${isHuidig ? " stap--huidig" : ""}`}
              aria-current={isHuidig ? "step" : undefined}
            >
              {s.nummer <= bereikt && !isHuidig ? (
                <button type="button" onClick={() => onKies(s.nummer)}>{inhoud}</button>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>{inhoud}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
