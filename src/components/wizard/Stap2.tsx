"use client";
import { useState } from "react";
import { ANDERE_TOOL } from "@/domain/content-schema";
import { geldigeLink } from "@/domain/wizard";
import { Keuze } from "../Keuze";
import { Spelregels } from "../Spelregels";
import { ToolIcoon } from "../ToolIcoon";
import { toolNaam } from "../client";
import type { StapProps } from "./types";

interface Props extends StapProps {
  coachNietBeschikbaar: boolean;
  onAnderAdvies: () => void;
  /** In het gesprek: de coach praat zelf (ik-vorm). */
  ikVorm?: boolean;
}

export function Stap2({ content, data, wijzig, coachBezig, coachNietBeschikbaar, onAnderAdvies, ikVorm = false }: Props) {
  const g = content.teksten.gesprek;
  const [zelfKiezen, setZelfKiezen] = useState(false);
  const advies = data.tooladvies;
  const buiten = advies?.tool === ANDERE_TOOL;
  const kiesHandmatig = zelfKiezen || coachNietBeschikbaar || !advies || buiten;
  const t = content.teksten.andere_tool;
  const andere = advies?.andereTool ?? { naam: "", link: "" };
  const linkFout = buiten && !geldigeLink(andere.link);
  const ta = content.teksten.tooladvies;
  const rolLabel = (id: string) => content.tools.tools.find((x) => x.id === id)?.rol ?? "";
  // Keuzehulp: de algemene adviesregels die nu gelden (beheerbaar).
  const keuzehulp = (content.adviesregelsActief ?? []).filter((r) => r.actief && r.tool === "algemeen" && (r.soort === "algemeen" || r.soort === "voorwaarde"));

  if (coachBezig === "tooladvies") {
    return <p role="status">{ikVorm ? g.zoekt_tool : "De coach zoekt een passende tool…"}</p>;
  }

  const zetAndere = (veld: "naam" | "link", waarde: string) =>
    wijzig((d) => ({
      ...d,
      tooladvies: {
        tool: ANDERE_TOOL,
        behoefte: undefined,
        motivatie: "",
        bron: "medewerker",
        geaccepteerd: false,
        andereTool: { ...(d.tooladvies?.andereTool ?? { naam: "", link: "" }), [veld]: waarde },
      },
    }));

  return (
    <>
      {coachNietBeschikbaar && !advies && (
        <p className="info" role="status">{ikVorm ? g.niet_beschikbaar : content.teksten.coach_niet_beschikbaar}</p>
      )}

      {advies && !buiten && (
        <div className="tool-kaart">
          <p className="hulptekst" style={{ margin: 0 }}>
            {advies.bron === "coach" ? (ikVorm ? g.tool_label : "Advies van de coach") : "Door jou gekozen"}
          </p>
          {advies.doel && (
            <p className="tool-doel"><strong>{ta.doel_label}:</strong> {advies.doel.replace(/^Je wilt:\s*/i, "")}</p>
          )}
          <h3 className="tool-naam"><ToolIcoon content={content} tool={advies.tool} groot />{toolNaam(content, advies.tool)}</h3>
          <p className="tool-rol">{rolLabel(advies.tool)}{advies.rol ? ` · ${advies.rol}` : ""}</p>
          {advies.motivatie && <p>{advies.motivatie}</p>}
          {(advies.aanvullend?.length ?? 0) > 0 && (
            <div className="tool-aanvullend">
              <h4>{ta.aanvullend_titel}</h4>
              <ul>
                {advies.aanvullend!.map((a) => (
                  <li key={a.tool}>
                    <ToolIcoon content={content} tool={a.tool} /> <strong>{toolNaam(content, a.tool)}</strong> · {rolLabel(a.tool)}
                    <br />
                    {a.rol}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(advies.alternatieven?.length ?? 0) > 0 && (
            <details className="tool-alternatieven">
              <summary>{ta.alternatieven_titel}</summary>
              <ul>
                {advies.alternatieven!.map((a) => (
                  <li key={a.tool}><strong>{toolNaam(content, a.tool)}</strong>: {a.waarom_niet}</li>
                ))}
              </ul>
            </details>
          )}
          <p className="info tool-geen-goedkeuring">{ta.geen_goedkeuring}</p>
          {(() => {
            const b = content.tools.tools.find((x) => x.id === advies.tool)?.beheer;
            return b ? (
              <p className="hulptekst tool-beheer">
                {content.teksten.beheer_tool.replace("{naam}", b.naam).replace("{email}", b.email)}
                {b.licentie ? ` ${b.licentie}` : ""}
              </p>
            ) : null;
          })()}
          <Spelregels content={content} tool={advies.tool} />
        </div>
      )}

      {advies && !kiesHandmatig && (
        <div className="knoppen">
          {/* In het gesprek geen knop: wie een andere tool wil, kiest zelf of vraagt het in de chat. */}
          {!ikVorm && (
            <button type="button" className="knop knop--secundair" onClick={onAnderAdvies}>
              Vraag de coach om een andere tool
            </button>
          )}
          <button type="button" className="knop knop--tekst" onClick={() => setZelfKiezen(true)}>
            Zelf een tool kiezen
          </button>
        </div>
      )}

      {kiesHandmatig && (
        <div style={{ marginTop: "1rem" }}>
          <Keuze
            naam="tool"
            legend="Kies een tool"
            opties={[
              ...content.tools.tools.map((x) => ({ id: x.id, label: x.naam, icoon: <ToolIcoon content={content} tool={x.id} /> })),
              { id: ANDERE_TOOL, label: t.optie },
            ]}
            waarde={advies?.tool}
            onKies={(tool) =>
              wijzig((d) => ({
                ...d,
                tooladvies:
                  tool === ANDERE_TOOL
                    ? {
                        tool,
                        behoefte: undefined,
                        motivatie: "",
                        bron: "medewerker",
                        geaccepteerd: false,
                        andereTool: d.tooladvies?.andereTool ?? { naam: "", link: "" },
                      }
                    : { tool, behoefte: undefined, motivatie: "", bron: "medewerker", geaccepteerd: false },
              }))
            }
            extra={
              buiten && (
                <div className="andere-tool">
                  <p className="info">{t.uitleg}</p>
                  <div className="veld">
                    <label htmlFor="andere-tool-naam">{t.naam_label}</label>
                    <input
                      id="andere-tool-naam"
                      type="text"
                      maxLength={100}
                      autoComplete="off"
                      aria-required="true"
                      value={andere.naam}
                      onChange={(e) => zetAndere("naam", e.target.value)}
                    />
                  </div>
                  <div className="veld">
                    <label htmlFor="andere-tool-link">{t.link_label}</label>
                    <input
                      id="andere-tool-link"
                      type="url"
                      maxLength={500}
                      autoComplete="off"
                      inputMode="url"
                      aria-describedby={linkFout ? "andere-tool-link-hulp andere-tool-link-fout" : "andere-tool-link-hulp"}
                      aria-invalid={linkFout || undefined}
                      value={andere.link}
                      onChange={(e) => zetAndere("link", e.target.value)}
                    />
                    <p id="andere-tool-link-hulp" className="hulptekst">{t.link_hulp}</p>
                    {linkFout && (
                      <p id="andere-tool-link-fout" className="veldfout">{t.link_fout}</p>
                    )}
                  </div>
                </div>
              )
            }
          />
          <details>
            <summary>Welke tool past bij welke behoefte?</summary>
            <ul>
              {content.tools.behoeften.map((b) => (
                <li key={b.id}>
                  {b.omschrijving}: {b.tools.map((x) => toolNaam(content, x)).join(" of ")}
                </li>
              ))}
            </ul>
            <ul>
              {content.tools.tools.map((x) => (
                <li key={x.id}>{`${x.naam}: ${x.rol}`}</li>
              ))}
            </ul>
            {keuzehulp.length > 0 && (
              <>
                <h4>{ta.keuzehulp_titel}</h4>
                <ul className="keuzehulp">
                  {keuzehulp.map((r) => <li key={r.id}><strong>{r.titel}.</strong> <span className="witruimte">{r.tekst}</span></li>)}
                </ul>
              </>
            )}
          </details>
        </div>
      )}
    </>
  );
}
