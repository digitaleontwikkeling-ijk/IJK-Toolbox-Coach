"use client";
import { useState } from "react";
import { ANDERE_TOOL } from "@/domain/content-schema";
import { geldigeLink } from "@/domain/wizard";
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
  const buiten = advies?.tool === ANDERE_TOOL;
  const kiesHandmatig = zelfKiezen || coachNietBeschikbaar || !advies || buiten;
  const t = content.teksten.andere_tool;
  const andere = advies?.andereTool ?? { naam: "", link: "" };
  const linkFout = buiten && !geldigeLink(andere.link);

  if (coachBezig === "tooladvies") {
    return <p role="status">De coach zoekt een passende tool…</p>;
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
        <p className="info" role="status">{content.teksten.coach_niet_beschikbaar}</p>
      )}

      {advies && !buiten && (
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
            legend="Kies een tool"
            opties={[
              ...content.tools.tools.map((x) => ({ id: x.id, label: x.naam })),
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
              {content.tools.keuzehints.map((h) => <li key={h}>{h}</li>)}
            </ul>
          </details>
        </div>
      )}
    </>
  );
}
