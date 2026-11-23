"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adviesPad, volledigPad, wizardPad } from "@/lib/paden";
import { api, datum, kleurVan, toolWeergave, useContent, type AdviesDto } from "./client";

export function MijnAanvragen() {
  const content = useContent();
  const [adviezen, setAdviezen] = useState<AdviesDto[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  // Bevestiging na "Afronden" in de wizard (?afgerond=TC-JJJJ-NNNN).
  const [afgerond, setAfgerond] = useState<string | null>(null);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("afgerond");
    if (ref && /^TC-\d{4}-\d{4}$/.test(ref)) setAfgerond(ref);
  }, []);

  useEffect(() => {
    api<{ adviezen: AdviesDto[] }>("/api/mijn-aanvragen")
      .then((r) => setAdviezen(r.adviezen))
      .catch(() => setFout("Je aanvragen konden niet worden geladen."));
  }, []);

  async function ietsVeranderd(id: string) {
    try {
      const r = await api<{ concept: { id: string } }>(`/api/advies/${id}/opnieuw`, { method: "POST" });
      window.location.href = volledigPad(wizardPad(r.concept.id));
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
      {afgerond && content && (
        <p className="info" role="status">{content.teksten.afronden.bevestiging.replace("{referentie}", afgerond)}</p>
      )}
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
                  <strong>{toolWeergave(content, a.tooladvies)}</strong> · {a.beschrijving.length > 160 ? `${a.beschrijving.slice(0, 160)}…` : a.beschrijving}
                </p>
                <div className="knoppen" style={{ marginTop: 0 }}>
                  <Link className="knop knop--secundair" href={adviesPad(a.id)}>
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
