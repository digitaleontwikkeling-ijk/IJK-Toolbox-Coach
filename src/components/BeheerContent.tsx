"use client";
/** Inzage in de inhoud van de coach (alleen lezen; wijzigen gaat via Git). */
import { Spelregels } from "./Spelregels";
import { ToolIcoon } from "./ToolIcoon";
import { kleurVan, toetserNaam, useContent } from "./client";

export function BeheerContent() {
  const c = useContent();
  if (!c) return <p role="status">Bezig met laden…</p>;
  const r = c.regelset;
  return (
    <>
      <p>
        Regelset versie <strong>{r.versie}</strong> ({r.gevalideerd ? "gevalideerd" : "nog niet gevalideerd door de toetsers"}) ·
        Tools versie <strong>{c.tools.versie}</strong>
      </p>

      <h3>Uitkomsten</h3>
      <ul>
        {r.kleuren.map((k) => (
          <li key={k.id}>
            <span className="badge-kleur" style={{ background: k.hex, color: k.tekstkleur }}>{k.id}</span> {k.uitkomst}
          </li>
        ))}
      </ul>

      <h3>De zes checks</h3>
      <table className="antwoorden">
        <thead>
          <tr><th scope="col">Check</th><th scope="col">Antwoorden</th><th scope="col">Toetser bij oranje</th></tr>
        </thead>
        <tbody>
          {r.checks.map((ch) => (
            <tr key={ch.id}>
              <th scope="row">
                {ch.nummer}. {ch.naam}<br /><span className="hulptekst">{ch.vraag}</span>
                {ch.meerdere && <><br /><span className="hulptekst">Meerdere antwoorden mogelijk (hoogste kleur telt)</span></>}
                {ch.deelvragen.length > 0 && (
                  <><br /><span className="hulptekst">Deelvragen: {ch.deelvragen.map((d) => d.naam).join(", ")} (hoogste score telt)</span></>
                )}
              </th>
              <td>
                {ch.antwoorden.map((a) => {
                  const k = kleurVan(c, a.kleur)!;
                  return (
                    <div key={a.id}>
                      {a.label} <span className="badge-kleur" style={{ background: k.hex, color: k.tekstkleur }}>{k.id}</span>
                      {a.voorwaarde && <div className="hulptekst">Voorwaarde: {a.voorwaarde}</div>}
                      {a.alternatief && <div className="hulptekst">Alternatief: {a.alternatief}</div>}
                    </div>
                  );
                })}
              </td>
              <td>{toetserNaam(c, ch.toetser)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{c.teksten.aanvullende_vragen.titel} (rode vlaggen: ja = altijd {kleurVan(c, r.rode_vlag_kleur)?.uitkomst})</h3>
      <ol>{r.rode_vlaggen.map((v) => <li key={v.id}>{v.vraag}</li>)}</ol>

      <h3>Tools en spelregels</h3>
      {c.tools.tools.map((t) => (
        <details key={t.id} style={{ marginBottom: "0.5rem" }}>
          <summary><ToolIcoon content={c} tool={t.id} /><strong>{t.naam}</strong></summary>
          <Spelregels content={c} tool={t.id} />
        </details>
      ))}
    </>
  );
}
