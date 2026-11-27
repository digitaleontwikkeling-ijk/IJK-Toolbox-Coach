"use client";
/**
 * Alle vragen en antwoorden van een advies, voor toetsers en beheerders: per vraag de volledige vraag, het antwoord
 * en de herkomst. Ingeklapt, zodat het besluitformulier overzichtelijk blijft. Opbouw: `antwoordenOverzicht` (domein).
 */
import { antwoordenOverzicht } from "@/domain/overzicht";
import { kleurVan, type AdviesDto, type ContentDto } from "./client";

export function AlleAntwoorden({ advies, content }: { advies: AdviesDto; content: ContentDto }) {
  const t = content.teksten.overzicht;
  const groepen = antwoordenOverzicht(content.regelset, content.tools, {
    verduidelijking: advies.verduidelijking,
    tooladvies: advies.tooladvies,
    antwoorden: advies.antwoorden,
    rodeVlaggen: advies.rodeVlaggen,
    feiten: advies.feiten,
    coachVoorstellen: advies.coachVoorstellen ?? null,
  });
  const aantal = groepen.reduce((n, g) => n + g.regels.length, 0);
  return (
    <details className="paneel overzicht">
      <summary>
        <h2>{t.titel.replace("{aantal}", String(aantal))}</h2>
      </summary>
      <p className="hulptekst">{advies.coachVoorstellen ? t.intro : t.intro_oud}</p>
      {groepen.map((g) => (
        <section key={g.titel} className="overzicht__groep">
          <h3>{g.titel}</h3>
          <table className="overzicht__tabel">
            <caption className="sr-only">{g.titel}</caption>
            <thead>
              <tr>
                <th scope="col">{t.kolom_vraag}</th>
                <th scope="col">{t.kolom_antwoord}</th>
                <th scope="col">{t.kolom_herkomst}</th>
              </tr>
            </thead>
            <tbody>
              {g.regels.map((r, i) => (
                <tr key={i} className={r.herkomst === "niet_gesteld" || r.herkomst === "afgeleid" ? "overzicht__rij--niet-gevraagd" : undefined}>
                  <th scope="row">{r.vraag}</th>
                  <td>
                    {r.antwoordKleuren && r.antwoordKleuren.length > 0
                      ? r.antwoordKleuren.map((a) => {
                          const k = kleurVan(content, a.kleur);
                          return (
                            <div key={a.label} className="overzicht__antwoord">
                              {a.label}{" "}
                              {k && <span className="badge-kleur" style={{ background: k.hex, color: k.tekstkleur }}>{k.id}</span>}
                            </div>
                          );
                        })
                      : r.antwoord}
                  </td>
                  <td>
                    {r.herkomst ? t.herkomst[r.herkomst] : "—"}
                    {r.toelichting && <span className="hulptekst overzicht__toelichting"> ({r.toelichting})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </details>
  );
}
