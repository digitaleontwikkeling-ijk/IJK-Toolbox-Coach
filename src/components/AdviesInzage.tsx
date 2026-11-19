"use client";
/** Eén advies bekijken als toetser (met besluitformulier) of als beheerder (alleen inzage). */
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Adviescard } from "./Adviescard";
import { Keuze } from "./Keuze";
import { api, ApiFoutClient, toetserNaam, useContent, type AdviesDto, type ContentDto } from "./client";

export function AdviesInzage({ id, modus }: { id: string; modus: "toetsing" | "beheer" }) {
  const content = useContent();
  const [advies, setAdvies] = useState<AdviesDto | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(() => {
    const pad = modus === "toetsing" ? `/api/toetsing/${encodeURIComponent(id)}` : `/api/beheer/adviezen/${encodeURIComponent(id)}`;
    return api<{ advies: AdviesDto }>(pad)
      .then((r) => setAdvies(r.advies))
      .catch(() => setFout("Deze aanvraag is niet gevonden, of hoort niet bij jouw rol."));
  }, [id, modus]);

  useEffect(() => {
    void laad();
  }, [laad]);

  return (
    <>
      <p><Link href={modus === "toetsing" ? "/toetsing" : "/beheer"}>← Terug naar het overzicht</Link></p>
      <h1>{advies ? `Aanvraag ${advies.referentie}` : "Aanvraag"}</h1>
      {fout && <p className="foutmelding" role="alert">{fout}</p>}
      {!fout && (!content || !advies) && <p role="status">Bezig met laden…</p>}
      {content && advies && (
        <div className="wizard">
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="paneel paneel--vlak">
              <h2>Beschrijving van de medewerker</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{advies.beschrijving}</p>
              {advies.verduidelijking.length > 0 && (
                <dl style={{ margin: 0 }}>
                  {advies.verduidelijking.map((v, i) => (
                    <div key={i}>
                      <dt style={{ fontWeight: 600 }}>{v.vraag}</dt>
                      <dd style={{ margin: "0 0 0.5rem" }}>{v.antwoord}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="hulptekst" style={{ margin: 0 }}>
                Aanvrager (pseudoniem): {advies.pseudoniemId?.slice(0, 12)}… · Regelversie {advies.regelversie} · Toolsversie{" "}
                {advies.toolsversie}
              </p>
            </div>
            <Adviescard advies={advies} content={content} weergave="inzage" />
          </div>
          {modus === "toetsing" && <Besluitpaneel advies={advies} content={content} onKlaar={laad} />}
        </div>
      )}
    </>
  );
}

function Besluitpaneel({ advies, content, onKlaar }: { advies: AdviesDto; content: ContentDto; onKlaar: () => void }) {
  const t = content.teksten;
  const open = advies.openRollen ?? [];
  const [rol, setRol] = useState(open[0]);
  const [besluit, setBesluit] = useState<string | undefined>();
  const [toelichting, setToelichting] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [gelukt, setGelukt] = useState<string | null>(null);

  const toelichtingLabel =
    besluit === "goedgekeurd_met_voorwaarden" ? t.toetsing.toelichting_voorwaarden : besluit === "afgewezen" ? t.toetsing.toelichting_afwijzing : "Toelichting (optioneel)";
  const verplicht = besluit === "goedgekeurd_met_voorwaarden" || besluit === "afgewezen";

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!besluit) return setFout("Kies een besluit.");
    if (verplicht && toelichting.trim().length < 5) return setFout(`${toelichtingLabel} Vul dit in.`);
    setBezig(true);
    try {
      const r = await api<{ status: AdviesDto["status"] }>(`/api/toetsing/${advies.id}/besluit`, {
        body: { besluit, toelichting, rol },
      });
      setGelukt(`Je besluit is vastgelegd. Status van de aanvraag: ${t.statussen[r.status]}.`);
      onKlaar();
    } catch (err) {
      setFout(err instanceof ApiFoutClient ? (err.details?.join(" ") || err.message) : "Het besluit kon niet worden vastgelegd.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <aside className="paneel" aria-labelledby="besluit-titel">
      <h2 id="besluit-titel">Besluit</h2>
      {gelukt && <p className="info" role="status">{gelukt}</p>}
      {advies.eigenAanvraag ? (
        <p>Dit is je eigen aanvraag. Een andere toetser beoordeelt hem.</p>
      ) : open.length === 0 ? (
        !gelukt && <p>Je hoeft voor deze aanvraag geen besluit (meer) te nemen.</p>
      ) : (
        <form onSubmit={verstuur} noValidate>
          {open.length > 1 && (
            <Keuze naam="rol" legend="Namens welke rol besluit je?" opties={open.map((r) => ({ id: r, label: toetserNaam(content, r) }))} waarde={rol} onKies={setRol} />
          )}
          <p className="hulptekst">Je besluit als {toetserNaam(content, rol ?? "")}.</p>
          <Keuze
            naam="besluit"
            legend="Jouw besluit"
            opties={(["goedgekeurd", "goedgekeurd_met_voorwaarden", "afgewezen"] as const).map((b) => ({ id: b, label: t.besluiten[b] }))}
            waarde={besluit}
            onKies={setBesluit}
          />
          <div className="veld">
            <label htmlFor="toelichting">{toelichtingLabel}{verplicht && <span aria-hidden="true"> *</span>}</label>
            <textarea id="toelichting" value={toelichting} maxLength={2000} required={verplicht} aria-required={verplicht} onChange={(e) => setToelichting(e.target.value)} />
          </div>
          {fout && <p className="foutmelding" role="alert">{fout}</p>}
          <button type="submit" className="knop" disabled={bezig}>Besluit vastleggen</button>
        </form>
      )}
    </aside>
  );
}
