"use client";
/** Overzicht van aanvragen voor toetsers ("toetsing") of van alle adviezen voor beheerders ("beheer"). */
import Link from "next/link";
import { useEffect, useState } from "react";
import { beheerAdviesPad, toetsingPad } from "@/lib/paden";
import { ToolIcoon } from "./ToolIcoon";
import { api, datum, isTerInformatie, kleurVan, toetserNaam, toolWeergave, useContent, type AdviesDto, type ContentDto } from "./client";

export function AdviezenLijst({ modus }: { modus: "toetsing" | "beheer" }) {
  const content = useContent();
  const [adviezen, setAdviezen] = useState<AdviesDto[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    api<{ adviezen: AdviesDto[] }>(modus === "toetsing" ? "/api/toetsing" : "/api/beheer/adviezen")
      .then((r) => setAdviezen(r.adviezen))
      .catch(() => setFout("De aanvragen konden niet worden geladen."));
  }, [modus]);

  if (fout) return <p className="foutmelding" role="alert">{fout}</p>;
  if (!content || !adviezen) return <p role="status">Bezig met laden…</p>;

  const open = modus === "toetsing" ? adviezen.filter((a) => a.status === "in_toetsing") : adviezen;
  const info = modus === "toetsing" ? adviezen.filter((a) => a.status !== "in_toetsing" && isTerInformatie(content, a.uitkomst)) : [];
  const klaar = modus === "toetsing" ? adviezen.filter((a) => a.status !== "in_toetsing" && !isTerInformatie(content, a.uitkomst)) : [];

  return (
    <>
      <section aria-labelledby="open-titel">
        <h2 id="open-titel">{modus === "toetsing" ? `Te beoordelen (${open.length})` : `Alle adviezen (${open.length})`}</h2>
        {open.length === 0 ? <p>Er zijn geen aanvragen.</p> : <Lijst adviezen={open} content={content} modus={modus} />}
      </section>
      {info.length > 0 && (
        <section aria-labelledby="info-titel" style={{ marginTop: "2rem" }}>
          <h2 id="info-titel">{content.teksten.toetsing.ter_informatie} ({info.length})</h2>
          <p className="instructie">{content.teksten.toetsing.ter_informatie_uitleg}</p>
          <Lijst adviezen={info} content={content} modus={modus} />
        </section>
      )}
      {modus === "toetsing" && klaar.length > 0 && (
        <section aria-labelledby="klaar-titel" style={{ marginTop: "2rem" }}>
          <h2 id="klaar-titel">Afgehandeld ({klaar.length})</h2>
          <Lijst adviezen={klaar} content={content} modus={modus} />
        </section>
      )}
    </>
  );
}

function Lijst({ adviezen, content, modus }: { adviezen: AdviesDto[]; content: ContentDto; modus: "toetsing" | "beheer" }) {
  return (
    <ul className="aanvragen">
      {adviezen.map((a) => {
        const k = kleurVan(content, a.uitkomst)!;
        const href = modus === "toetsing" ? toetsingPad(a.id) : beheerAdviesPad(a.id);
        return (
          <li key={a.id} className="aanvraag">
            <div className="aanvraag__regel">
              <Link className="aanvraag__ref" href={href}>{a.referentie}</Link>
              <span>{datum(a.aangemaaktOp)}</span>
              <span className="badge-kleur" style={{ background: k.hex, color: k.tekstkleur }}>{k.uitkomst}</span>
              <span className="status">Status: {content.teksten.statussen[a.status]}</span>
              {a.dpiaSignaal && <span className="status">DPIA-signaal</span>}
            </div>
            <p style={{ margin: 0 }}>
              <ToolIcoon content={content} tool={a.tooladvies.tool} /><strong>{toolWeergave(content, a.tooladvies)}</strong> ·{" "}
              {a.beschrijving.length > 160 ? `${a.beschrijving.slice(0, 160)}…` : a.beschrijving}
            </p>
            {a.toetsers.length > 0 && (
              <p className="hulptekst" style={{ margin: 0 }}>
                Toetsers: {a.toetsers.map((t) => {
                  const b = a.besluiten?.find((x) => x.toetserRol === t);
                  return `${toetserNaam(content, t)} (${b ? content.teksten.besluiten[b.besluit].toLowerCase() : "nog geen besluit"})`;
                }).join(", ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
