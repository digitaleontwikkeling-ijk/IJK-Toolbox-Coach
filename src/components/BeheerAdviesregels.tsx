"use client";
/**
 * Beheer: de adviesregels voor het tooladvies bekijken, wijzigen, toevoegen, (de)activeren, verwijderen en
 * terugzetten. Zelfde opbouw als de mailsjablonen: per toepassingsgebied inklapbaar, met Opslaan en Standaard
 * herstellen. De server controleert elke wijziging op de hele set; bij een fout blijft alles zoals het was.
 */
import { useEffect, useState, type FormEvent } from "react";
import { ALGEMEEN, SOORTEN, type Adviesregel, type Historie, type RegelMetStatus, type Soort } from "@/domain/adviesregels";
import { api, ApiFoutClient, useContent, type ContentDto } from "./client";

interface Overzicht {
  regels: RegelMetStatus[];
  verwijderdeStandaard: Adviesregel[];
  historie: Historie[];
  versie: string;
  controle: { fouten: string[]; waarschuwingen: string[] };
  waarschuwingen?: string[];
}
type Teksten = ContentDto["teksten"]["adviesregels_beheer"];
type Melding = { soort: "info" | "foutmelding"; tekst: string; details?: string[] } | null;

const PAD = "/api/beheer/adviesregels";

export function BeheerAdviesregels() {
  const c = useContent();
  const [o, setO] = useState<Overzicht | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState(false);
  const [melding, setMelding] = useState<Melding>(null);

  useEffect(() => {
    api<Overzicht>(PAD)
      .then(setO)
      .catch(() => setFout("De adviesregels konden niet worden geladen. De coach gebruikt intussen de laatst bekende regels."));
  }, []);

  if (fout) return <p className="foutmelding" role="alert">{fout}</p>;
  if (!c || !o) return <p role="status">Bezig met laden…</p>;
  const t = c.teksten.adviesregels_beheer;
  const groepen = [{ id: ALGEMEEN, naam: t.algemeen }, ...c.tools.tools.map((x) => ({ id: x.id, naam: x.naam }))];

  /** Voert een wijziging uit en geeft de melding terug (bij een formulier staat die bij het formulier). */
  async function stuur(methode: string, body: unknown, gelukt: string): Promise<NonNullable<Melding>> {
    try {
      const r = await api<Overzicht>(PAD, { method: methode, body });
      setO(r);
      return { soort: "info", tekst: gelukt, details: r.waarschuwingen?.length ? r.waarschuwingen : undefined };
    } catch (e) {
      return { soort: "foutmelding", tekst: e instanceof ApiFoutClient ? e.message : t.fout, details: e instanceof ApiFoutClient ? e.details : undefined };
    }
  }
  const algemeen = async (methode: string, body: unknown, gelukt: string) => setMelding(await stuur(methode, body, gelukt));

  return (
    <>
      <p className="instructie">{t.intro}</p>
      <p className="hulptekst">{t.versie.replace("{versie}", o.versie)}</p>
      <details className="mailsjablonen__velden">
        <summary>{t.soorten_titel}</summary>
        <ul>
          {SOORTEN.map((s) => (
            <li key={s}><strong>{t.soorten[s]}</strong>: {t.soorten_uitleg[s]}</li>
          ))}
        </ul>
      </details>
      {o.controle.waarschuwingen.length > 0 && (
        <div className="info">
          <p style={{ margin: 0 }}>{t.aandacht}</p>
          <ul>{o.controle.waarschuwingen.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      <MeldingTekst melding={melding} />

      <div className="knoppen" style={{ marginTop: "1rem" }}>
        {!nieuw && (
          <button type="button" className="knop knop--secundair" onClick={() => setNieuw(true)}>{t.toevoegen}</button>
        )}
      </div>
      {nieuw && (
        <div className="paneel beheer-blok">
          <h3>{t.nieuwe_regel}</h3>
          <RegelFormulier
            content={c}
            teksten={t}
            regel={null}
            onOpslaan={async (r) => {
              const m = await stuur("POST", { actie: "toevoegen", regel: r }, t.toegevoegd);
              if (m.soort === "info") {
                setNieuw(false);
                setMelding(m);
              }
              return m;
            }}
            onAnnuleren={() => setNieuw(false)}
          />
        </div>
      )}

      {groepen.map((g) => {
        const regels = o.regels.filter((r) => r.tool === g.id);
        if (regels.length === 0) return null;
        const inactief = regels.filter((r) => !r.actief).length;
        return (
          <details key={g.id} className="paneel beheer-blok adviesregels-groep">
            <summary>
              <h3 id={`regels-${g.id}`}>
                {g.naam}{" "}
                <span className="status">
                  {t.aantal.replace("{n}", String(regels.length))}
                  {inactief ? `, ${t.aantal_inactief.replace("{n}", String(inactief))}` : ""}
                </span>
              </h3>
            </summary>
            {regels.map((r) => (
              <details key={r.id} className="adviesregel">
                <summary>
                  <span className="adviesregel__titel">{r.titel}</span>{" "}
                  <span className="status">{t.soorten[r.soort]}</span>{" "}
                  <span className="status">{t.status[r.status]}</span>
                  {!r.actief && <> <span className="status status--inactief">{t.inactief}</span></>}
                </summary>
                <RegelFormulier
                  content={c}
                  teksten={t}
                  regel={r}
                  onOpslaan={(n) => stuur("PUT", { regel: n }, t.opgeslagen)}
                  onStandaard={r.status === "aangepast" ? () => stuur("DELETE", { id: r.id, standaard: true }, t.hersteld) : undefined}
                  onVerwijderen={() => {
                    if (!window.confirm(t.bevestig_verwijderen.replace("{titel}", r.titel))) return;
                    void algemeen("DELETE", { id: r.id }, t.verwijderd);
                  }}
                />
              </details>
            ))}
          </details>
        );
      })}

      {o.verwijderdeStandaard.length > 0 && (
        <details className="paneel beheer-blok">
          <summary><h3>{t.verwijderde_titel} <span className="status">{o.verwijderdeStandaard.length}</span></h3></summary>
          <ul className="adviesregels-lijst">
            {o.verwijderdeStandaard.map((r) => (
              <li key={r.id}>
                <span>{r.titel} ({r.tool === ALGEMEEN ? t.algemeen : c.tools.tools.find((x) => x.id === r.tool)?.naam ?? r.tool})</span>
                <button type="button" className="knop knop--tekst" onClick={() => void algemeen("DELETE", { id: r.id, standaard: true }, t.hersteld)}>
                  {t.terugzetten}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="paneel beheer-blok">
        <summary><h3>{t.historie_titel}</h3></summary>
        {o.historie.length === 0 ? (
          <p>{t.historie_leeg}</p>
        ) : (
          <ul className="adviesregels-lijst">
            {o.historie.map((h) => (
              <li key={h.nr}>
                <span>
                  {new Date(h.gewijzigdOp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                  {(h.nieuwe ?? h.vorige)?.titel ?? h.regelId} ·{" "}
                  {h.vorige === null ? t.historie_toegevoegd : h.nieuwe === null ? t.historie_verwijderd : t.historie_gewijzigd}
                  {h.vorige && h.nieuwe ? <WatVeranderde vorige={h.vorige} nieuwe={h.nieuwe} teksten={t} /> : null}
                </span>
                <button
                  type="button"
                  className="knop knop--tekst"
                  onClick={() => {
                    if (!window.confirm(t.bevestig_terugzetten)) return;
                    void algemeen("POST", { actie: "terugzetten", historie: h.nr }, t.teruggezet);
                  }}
                >
                  {t.vorige_terugzetten}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
}

function WatVeranderde({ vorige, nieuwe, teksten: t }: { vorige: Adviesregel; nieuwe: Adviesregel; teksten: Teksten }) {
  const velden = (Object.keys(t.velden) as (keyof Teksten["velden"])[]).filter(
    (k) => JSON.stringify((vorige as unknown as Record<string, unknown>)[k]) !== JSON.stringify((nieuwe as unknown as Record<string, unknown>)[k]),
  );
  return velden.length ? <> ({velden.map((k) => t.velden[k].toLowerCase()).join(", ")})</> : null;
}

function MeldingTekst({ melding }: { melding: Melding }) {
  if (!melding) return null;
  return (
    <div className={melding.soort} role={melding.soort === "foutmelding" ? "alert" : "status"}>
      <p style={{ margin: 0 }}>{melding.tekst}</p>
      {melding.details && melding.details.length > 0 && <ul>{melding.details.map((d) => <li key={d}>{d}</li>)}</ul>}
    </div>
  );
}

interface Velden {
  id: string;
  titel: string;
  soort: Soort;
  tool: string;
  tekst: string;
  actief: boolean;
  prioriteit: string;
  trefwoorden: string;
  boven: string[];
  bij: string[];
  nooit_hoofdtool: boolean;
}

const naarVelden = (r: Adviesregel | null): Velden =>
  r
    ? { ...r, prioriteit: String(r.prioriteit), trefwoorden: r.trefwoorden.join(", ") }
    : { id: "", titel: "", soort: "algemeen", tool: ALGEMEEN, tekst: "", actief: true, prioriteit: "100", trefwoorden: "", boven: [], bij: [], nooit_hoofdtool: false };

function RegelFormulier({ content: c, teksten: t, regel, onOpslaan, onAnnuleren, onStandaard, onVerwijderen }: {
  content: ContentDto;
  teksten: Teksten;
  regel: RegelMetStatus | null;
  onOpslaan: (r: unknown) => Promise<NonNullable<Melding>>;
  onAnnuleren?: () => void;
  onStandaard?: () => Promise<NonNullable<Melding>>;
  onVerwijderen?: () => void;
}) {
  const opgeslagen = naarVelden(regel);
  const [v, setV] = useState<Velden>(opgeslagen);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<Melding>(null);
  const bewaard = JSON.stringify(regel);
  // Alleen terugzetten als de opgeslagen regel zelf veranderde (niet bij elke wijziging van een andere regel).
  useEffect(() => setV(naarVelden(regel)), [bewaard]); // eslint-disable-line react-hooks/exhaustive-deps
  const gewijzigd = JSON.stringify(v) !== JSON.stringify(opgeslagen);
  const zet = <K extends keyof Velden>(k: K, w: Velden[K]) => setV((x) => ({ ...x, [k]: w }));
  const id = `regel-${regel?.id ?? "nieuw"}`;
  const tools = c.tools.tools.filter((x) => x.id !== v.tool);
  const metTrefwoorden = v.soort === "toepassing" || v.soort === "voorkeur" || v.soort === "uitsluiting" || v.soort === "combinatie";

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setBezig(true);
    setMelding(null);
    const p = Number(v.prioriteit);
    const m = await onOpslaan({
      id: v.id.trim(),
      titel: v.titel,
      soort: v.soort,
      tool: v.tool,
      tekst: v.tekst,
      actief: v.actief,
      prioriteit: Number.isFinite(p) && v.prioriteit.trim() !== "" ? p : v.prioriteit,
      trefwoorden: metTrefwoorden ? v.trefwoorden.split(",").map((x) => x.trim()).filter(Boolean) : [],
      boven: v.soort === "voorkeur" ? v.boven.filter((x) => x !== v.tool) : [],
      bij: v.soort === "combinatie" ? v.bij.filter((x) => x !== v.tool) : [],
      nooit_hoofdtool: v.soort === "uitsluiting" && v.tool !== ALGEMEEN ? v.nooit_hoofdtool : false,
    });
    setMelding(m);
    setBezig(false);
  }

  const vinkjes = (veld: "boven" | "bij", legend: string) => (
    <fieldset className="veld">
      <legend>{legend}</legend>
      {tools.map((x) => (
        <label key={x.id} className="vinkje">
          <input
            type="checkbox"
            checked={v[veld].includes(x.id)}
            onChange={(e) => zet(veld, e.target.checked ? [...v[veld], x.id] : v[veld].filter((y) => y !== x.id))}
          />{" "}
          {x.naam}
        </label>
      ))}
    </fieldset>
  );

  return (
    <form onSubmit={verstuur} className="adviesregel__formulier" aria-label={regel ? regel.titel : t.nieuwe_regel}>
      {regel ? (
        <p className="hulptekst" style={{ marginTop: 0 }}>{t.velden.id}: <code>{regel.id}</code></p>
      ) : (
        <div className="veld">
          <label htmlFor={`${id}-id`}>{t.velden.id}</label>
          <input id={`${id}-id`} type="text" maxLength={60} value={v.id} aria-describedby={`${id}-id-hulp`} onChange={(e) => zet("id", e.target.value.toLowerCase())} />
          <p id={`${id}-id-hulp`} className="hulptekst">{t.id_hulp}</p>
        </div>
      )}
      <div className="veld">
        <label htmlFor={`${id}-titel`}>{t.velden.titel}</label>
        <input id={`${id}-titel`} type="text" maxLength={100} value={v.titel} onChange={(e) => zet("titel", e.target.value)} />
      </div>
      <div className="adviesregel__rij">
        <div className="veld">
          <label htmlFor={`${id}-soort`}>{t.velden.soort}</label>
          <select id={`${id}-soort`} value={v.soort} onChange={(e) => zet("soort", e.target.value as Soort)}>
            {SOORTEN.map((s) => <option key={s} value={s}>{t.soorten[s]}</option>)}
          </select>
        </div>
        <div className="veld">
          <label htmlFor={`${id}-tool`}>{t.velden.tool}</label>
          <select id={`${id}-tool`} value={v.tool} onChange={(e) => zet("tool", e.target.value)}>
            <option value={ALGEMEEN}>{t.algemeen}</option>
            {c.tools.tools.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
          </select>
        </div>
        <div className="veld">
          <label htmlFor={`${id}-prioriteit`}>{t.velden.prioriteit}</label>
          <input id={`${id}-prioriteit`} type="number" min={1} max={999} step={1} inputMode="numeric" value={v.prioriteit} aria-describedby={`${id}-prioriteit-hulp`} onChange={(e) => zet("prioriteit", e.target.value)} />
        </div>
      </div>
      <p id={`${id}-prioriteit-hulp`} className="hulptekst" style={{ marginTop: 0 }}>{t.prioriteit_hulp}</p>
      <div className="veld">
        <label htmlFor={`${id}-tekst`}>{t.velden.tekst}</label>
        <textarea id={`${id}-tekst`} maxLength={1200} rows={v.soort === "toepassing" || v.tekst.length > 300 ? 8 : 4} value={v.tekst} aria-describedby={`${id}-tekst-hulp`} onChange={(e) => zet("tekst", e.target.value)} />
        <p id={`${id}-tekst-hulp`} className="hulptekst">{t.tekst_hulp[v.soort]}</p>
      </div>
      {v.soort === "voorkeur" && vinkjes("boven", t.velden.boven)}
      {v.soort === "combinatie" && vinkjes("bij", t.velden.bij)}
      {v.soort === "uitsluiting" && v.tool !== ALGEMEEN && (
        <label className="vinkje veld">
          <input type="checkbox" checked={v.nooit_hoofdtool} onChange={(e) => zet("nooit_hoofdtool", e.target.checked)} /> {t.velden.nooit_hoofdtool}
        </label>
      )}
      {metTrefwoorden && (
        <div className="veld">
          <label htmlFor={`${id}-trefwoorden`}>{t.velden.trefwoorden}</label>
          <input id={`${id}-trefwoorden`} type="text" value={v.trefwoorden} aria-describedby={`${id}-trefwoorden-hulp`} onChange={(e) => zet("trefwoorden", e.target.value)} />
          <p id={`${id}-trefwoorden-hulp`} className="hulptekst">{t.trefwoorden_hulp}</p>
        </div>
      )}
      <label className="vinkje veld">
        <input type="checkbox" checked={v.actief} onChange={(e) => zet("actief", e.target.checked)} /> {t.velden.actief}
      </label>
      <MeldingTekst melding={melding} />
      <div className="knoppen" style={{ marginTop: "0.75rem" }}>
        <button type="submit" className="knop" disabled={bezig || (regel !== null && !gewijzigd)}>{t.opslaan}</button>
        <button
          type="button"
          className="knop knop--secundair"
          disabled={bezig || (regel !== null && !gewijzigd)}
          onClick={() => {
            setMelding(regel ? { soort: "info", tekst: t.geannuleerd } : null);
            if (regel) setV(opgeslagen);
            else onAnnuleren?.();
          }}
        >
          {t.annuleren}
        </button>
        {onStandaard && (
          <button type="button" className="knop knop--secundair" disabled={bezig} onClick={async () => setMelding(await onStandaard())}>
            {t.herstellen}
          </button>
        )}
        {onVerwijderen && <button type="button" className="knop knop--tekst" disabled={bezig} onClick={onVerwijderen}>{t.verwijderen}</button>}
      </div>
    </form>
  );
}
