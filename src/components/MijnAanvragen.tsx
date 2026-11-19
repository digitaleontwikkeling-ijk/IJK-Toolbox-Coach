"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, datum, kleurVan, toolNaam, useContent, type AdviesDto } from "./client";

export function MijnAanvragen() {
  const content = useContent();
  const [adviezen, setAdviezen] = useState<AdviesDto[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    api<{ adviezen: AdviesDto[] }>("/api/mijn-aanvragen")
      .then((r) => setAdviezen(r.adviezen))
      .catch(() => setFout("Je aanvragen konden niet worden geladen."));
  }, []);

  async function ietsVeranderd(id: string) {
    try {
      await api(`/api/advies/${id}/opnieuw`, { method: "POST" });
      window.location.href = "/wizard";
    } catch {
      setFout("Het opnieuw starten is niet gelukt. Probeer het later opnieuw.");
    }
  }

  return (
    <>
      <h1>Mijn aanvragen</h1>
      <p className="instructie">
        Hier staan je adviezen en aanvragen. Is er iets veranderd aan je idee? Doorloop de wizard dan opnieuw: elke nieuwe
        toepassing of wijziging krijgt een eigen advies.
      </p>
      {fout && <p className="foutmelding" role="alert">{fout}</p>}
      {!content || !adviezen ? (
        !fout && <p role="status">Bezig met laden…</p>
      ) : adviezen.length === 0 ? (
        <p>
          Je hebt nog geen adviezen. <Link href="/wizard">Begin met een nieuw idee</Link>.
        </p>
      ) : (
        <ul className="aanvragen">
          {adviezen.map((a) => {
            const k = kleurVan(content, a.uitkomst)!;
            return (
              <li key={a.id} className="aanvraag">
                <div className="aanvraag__regel">
                  <span className="aanvraag__ref">{a.referentie}</span>
                  <span>{datum(a.aangemaaktOp)}</span>
                  <span className="badge-kleur" style={{ background: k.hex, color: k.tekstkleur }}>{k.uitkomst}</span>
                  <span className="status">Status: {content.teksten.statussen[a.status]}</span>
                </div>
                <p style={{ margin: 0 }}>
                  <strong>{toolNaam(content, a.tooladvies.tool)}</strong> · {a.beschrijving.length > 160 ? `${a.beschrijving.slice(0, 160)}…` : a.beschrijving}
                </p>
                <div className="knoppen" style={{ marginTop: 0 }}>
                  <Link className="knop knop--secundair" href={`/advies/${a.id}`}>
                    Bekijk advies<span className="sr-only"> {a.referentie}</span>
                  </Link>
                  <button type="button" className="knop knop--tekst" onClick={() => ietsVeranderd(a.id)}>
                    Er is iets veranderd<span className="sr-only"> bij {a.referentie}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
