"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Adviescard } from "./Adviescard";
import { api, ApiFoutClient, useContent, type AdviesDto } from "./client";

export function AdviesPagina({ id }: { id: string }) {
  const content = useContent();
  const [advies, setAdvies] = useState<AdviesDto | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [actieBezig, setActieBezig] = useState(false);
  const [actieFout, setActieFout] = useState<string | null>(null);

  useEffect(() => {
    api<{ advies: AdviesDto }>(`/api/advies/${encodeURIComponent(id)}`)
      .then((r) => setAdvies(r.advies))
      .catch(() => setFout("Dit advies is niet gevonden."));
  }, [id]);

  async function actie() {
    if (!advies) return;
    setActieBezig(true);
    setActieFout(null);
    try {
      const r = await api<{ status: AdviesDto["status"] }>(`/api/advies/${advies.id}/actie`, { method: "POST" });
      setAdvies({ ...advies, status: r.status });
    } catch (e) {
      setActieFout(e instanceof ApiFoutClient ? e.message : "De aanvraag is niet gelukt.");
    } finally {
      setActieBezig(false);
    }
  }

  return (
    <>
      <p><Link href="/mijn-aanvragen">← Mijn aanvragen</Link></p>
      <h1 className="sr-only">Advies</h1>
      {fout && <p className="foutmelding" role="alert">{fout}</p>}
      {!fout && (!content || !advies) && <p role="status">Bezig met laden…</p>}
      {content && advies && (
        <>
          <div className="paneel paneel--vlak" style={{ marginBottom: "1rem" }}>
            <h2>{content.teksten.gesprek.beschrijving_label}</h2>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{advies.beschrijving}</p>
          </div>
          <Adviescard advies={advies} content={content} onActie={actie} actieBezig={actieBezig} actieFout={actieFout} />
        </>
      )}
    </>
  );
}
