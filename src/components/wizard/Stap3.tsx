"use client";
import { alsLijst, Keuze, JA_NEE, naarJaNee } from "../Keuze";
import type { StapProps } from "./types";

interface Props extends StapProps {
  coachNietBeschikbaar: boolean;
  /** id's van velden die nog niet zijn ingevuld (na een poging om verder te gaan). */
  ontbrekend: Set<string>;
}

export function Stap3({ content, data, wijzig, coachBezig, coachNietBeschikbaar, ontbrekend }: Props) {
  const r = content.regelset;

  if (coachBezig === "checks") {
    return <p role="status">De coach vult de checks alvast voor je in…</p>;
  }

  return (
    <>
      {coachNietBeschikbaar && (
        <p className="info" role="status">{content.teksten.coach_niet_beschikbaar}</p>
      )}

      <h2>De zes checks</h2>
      {r.checks.map((c) => {
        const voorstel = data.coachVoorstellen[c.id];
        const gekozen = alsLijst(data.checks[c.id]);
        // Het label blijft staan zolang de keuze precies het voorstel van de coach is.
        const vanCoach = voorstel && gekozen.length === 1 && gekozen[0] === voorstel.voorstel;
        const zetChecks = (w: string | string[]) => wijzig((d) => ({ ...d, checks: { ...d.checks, [c.id]: w } }));
        const keuzeProps = c.meerdere
          ? ({ meerdere: true, waarde: gekozen, onKies: (ids: string[]) => zetChecks(ids) } as const)
          : ({ waarde: gekozen[0], onKies: (id: string) => zetChecks(id) } as const);
        return (
          <div id={`veld-${c.id}`} key={c.id}>
            <Keuze
              {...keuzeProps}
              naam={c.id}
              fout={ontbrekend.has(c.id)}
              legend={
                <>
                  {c.nummer}. {c.naam}
                  {vanCoach && (
                    <span className={`coach-label${voorstel.zekerheid === "laag" ? " coach-label--laag" : ""}`}>
                      {voorstel.zekerheid === "laag" ? "Voorstel coach (onzeker, check dit)" : "Voorgesteld door de coach"}
                    </span>
                  )}
                </>
              }
              vraag={c.vraag}
              opties={c.antwoorden.map((a) => ({ id: a.id, label: a.label }))}
              extra={r.extra_vragen
                .filter((e) => e.check === c.id && gekozen.some((g) => e.toon_bij.includes(g)))
                .map((e) => (
                  <div id={`veld-${e.id}`} key={e.id} style={{ marginTop: "0.75rem" }}>
                    <Keuze
                      naam={e.id}
                      fout={ontbrekend.has(e.id)}
                      legend={e.vraag}
                      vraag={e.uitleg}
                      opties={JA_NEE}
                      waarde={naarJaNee(data.extraVragen[e.id])}
                      onKies={(v) => wijzig((d) => ({ ...d, extraVragen: { ...d.extraVragen, [e.id]: v === "ja" } }))}
                    />
                  </div>
                ))}
            />
          </div>
        );
      })}

      <h2>{content.teksten.aanvullende_vragen.titel}</h2>
      <p className="instructie">{content.teksten.aanvullende_vragen.intro}</p>
      {r.rode_vlaggen.map((v) => (
        <div id={`veld-${v.id}`} key={v.id}>
          <Keuze
            naam={v.id}
            fout={ontbrekend.has(v.id)}
            legend={content.teksten.aanvullende_vragen.vraag_label.replace("{nummer}", String(v.nummer))}
            vraag={v.vraag}
            opties={JA_NEE}
            waarde={naarJaNee(data.rodeVlaggen[v.id])}
            onKies={(x) => wijzig((d) => ({ ...d, rodeVlaggen: { ...d.rodeVlaggen, [v.id]: x === "ja" } }))}
          />
        </div>
      ))}
    </>
  );
}

/** Welke velden van stap 3 ontbreken nog? Geeft [id, leesbare naam]. */
export function ontbrekendeVelden(content: StapProps["content"], data: StapProps["data"]): [string, string][] {
  const r = content.regelset;
  const uit: [string, string][] = [];
  for (const c of r.checks) {
    const gekozen = alsLijst(data.checks[c.id]);
    if (gekozen.length === 0) uit.push([c.id, `${c.nummer}. ${c.naam}`]);
    for (const e of r.extra_vragen) {
      if (e.check === c.id && gekozen.some((g) => e.toon_bij.includes(g)) && typeof data.extraVragen[e.id] !== "boolean") {
        uit.push([e.id, e.vraag]);
      }
    }
  }
  for (const v of r.rode_vlaggen) {
    if (typeof data.rodeVlaggen[v.id] !== "boolean") uit.push([v.id, content.teksten.aanvullende_vragen.vraag_label.replace("{nummer}", String(v.nummer))]);
  }
  return uit;
}
