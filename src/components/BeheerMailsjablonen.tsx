"use client";
/**
 * Beheer: per tool het mailsjabloon voor de licentieaanvraag (onderwerp en tekst) aanpassen of terugzetten naar de
 * standaard. Het adres staat in tools.yaml (beheer.email) en is hier alleen te lezen. Wijzigingen staan in de audit-log.
 */
import { useEffect, useState, type FormEvent } from "react";
import { MAIL_VELDEN, type Mailsjabloon } from "@/domain/mailsjablonen";
import { api, ApiFoutClient, useContent } from "./client";

type Sjablonen = Record<string, Mailsjabloon & { aangepast: boolean }>;

export function BeheerMailsjablonen() {
  const c = useContent();
  const [sjablonen, setSjablonen] = useState<Sjablonen | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    api<{ sjablonen: Sjablonen }>("/api/beheer/mailsjablonen")
      .then((r) => setSjablonen(r.sjablonen))
      .catch(() => setFout("De mailsjablonen konden niet worden geladen."));
  }, []);

  if (fout) return <p className="foutmelding" role="alert">{fout}</p>;
  if (!c || !sjablonen) return <p role="status">Bezig met laden…</p>;
  const t = c.teksten.mailsjablonen_beheer;
  return (
    <>
      <p className="instructie">{t.intro}</p>
      <details className="mailsjablonen__velden">
        <summary>{t.velden_titel}</summary>
        <ul>
          {MAIL_VELDEN.map((v) => (
            <li key={v.veld}><code>{v.veld}</code>: {v.uitleg}</li>
          ))}
        </ul>
      </details>
      {c.tools.tools
        .filter((tool) => tool.beheer && sjablonen[tool.id])
        .map((tool) => (
          <Sjabloon
            key={tool.id}
            toolId={tool.id}
            toolNaam={tool.naam}
            aan={tool.beheer!.email}
            sjabloon={sjablonen[tool.id]!}
            teksten={t}
            onOpgeslagen={setSjablonen}
          />
        ))}
    </>
  );
}

function Sjabloon({ toolId, toolNaam, aan, sjabloon, teksten: t, onOpgeslagen }: {
  toolId: string;
  toolNaam: string;
  aan: string;
  sjabloon: Mailsjabloon & { aangepast: boolean };
  teksten: NonNullable<ReturnType<typeof useContent>>["teksten"]["mailsjablonen_beheer"];
  onOpgeslagen: (s: Sjablonen) => void;
}) {
  const [onderwerp, setOnderwerp] = useState(sjabloon.onderwerp);
  const [tekst, setTekst] = useState(sjabloon.tekst);
  const [melding, setMelding] = useState<{ soort: "info" | "foutmelding"; tekst: string } | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    setOnderwerp(sjabloon.onderwerp);
    setTekst(sjabloon.tekst);
  }, [sjabloon.onderwerp, sjabloon.tekst]);

  async function verstuur(e: FormEvent, methode: "PUT" | "DELETE") {
    e.preventDefault();
    setBezig(true);
    setMelding(null);
    try {
      const r = await api<{ sjablonen: Sjablonen }>("/api/beheer/mailsjablonen", {
        method: methode,
        body: methode === "PUT" ? { tool: toolId, onderwerp, tekst } : { tool: toolId },
      });
      onOpgeslagen(r.sjablonen);
      setMelding({ soort: "info", tekst: methode === "PUT" ? t.opgeslagen : t.hersteld });
    } catch (err) {
      setMelding({ soort: "foutmelding", tekst: err instanceof ApiFoutClient ? err.message : t.fout });
    } finally {
      setBezig(false);
    }
  }

  const id = `mail-${toolId}`;
  return (
    <details className="paneel beheer-blok mailsjabloon">
      <summary>
        <h3 id={`${id}-kop`}>
          {toolNaam} <span className="status">{sjabloon.aangepast ? t.aangepast : t.standaard}</span>
        </h3>
      </summary>
    <form onSubmit={(e) => verstuur(e, "PUT")} aria-labelledby={`${id}-kop`}>
      <p className="hulptekst" style={{ marginTop: 0 }}>{t.aan.replace("{email}", aan)}</p>
      <div className="veld">
        <label htmlFor={`${id}-onderwerp`}>{t.onderwerp}</label>
        <input id={`${id}-onderwerp`} type="text" maxLength={200} value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} />
      </div>
      <div className="veld">
        <label htmlFor={`${id}-tekst`}>{t.tekst}</label>
        <textarea id={`${id}-tekst`} maxLength={4000} rows={8} value={tekst} onChange={(e) => setTekst(e.target.value)} />
      </div>
      {melding && <p className={melding.soort} role="status">{melding.tekst}</p>}
      <div className="knoppen" style={{ marginTop: "0.75rem" }}>
        <button type="submit" className="knop" disabled={bezig}>{t.opslaan}</button>
        {sjabloon.aangepast && (
          <button type="button" className="knop knop--secundair" disabled={bezig} onClick={(e) => verstuur(e as unknown as FormEvent, "DELETE")}>
            {t.herstellen}
          </button>
        )}
      </div>
    </form>
    </details>
  );
}
