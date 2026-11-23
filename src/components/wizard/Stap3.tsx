"use client";
/**
 * Stap 3: de zes checks en de aanvullende vragen (rode vlaggen).
 * Alles (vragen, schalen, hulpteksten, deelvragen) komt uit de regelset.
 */
import type { Check } from "@/domain/content-schema";
import { alsLijst, Keuze, JA_NEE, naarJaNee } from "../Keuze";
import type { StapProps } from "./types";

interface Props extends StapProps {
  coachNietBeschikbaar: boolean;
  /** id's van velden die nog niet zijn ingevuld (na een poging om verder te gaan). */
  ontbrekend: Set<string>;
}

type Voorstel = StapProps["data"]["coachVoorstellen"][string];

/** Label "Voorgesteld door de coach", zolang de keuze precies het voorstel is. */
function CoachLabel({ voorstel, gekozen }: { voorstel: Voorstel | undefined; gekozen: string[] }) {
  if (!voorstel || gekozen.length !== 1 || gekozen[0] !== voorstel.voorstel) return null;
  return (
    <span className={`coach-label${voorstel.zekerheid === "laag" ? " coach-label--laag" : ""}`}>
      {voorstel.zekerheid === "laag" ? "Voorstel coach (onzeker, check dit)" : "Voorgesteld door de coach"}
    </span>
  );
}

/** Hulpteksten bij een check (definities, principes, reflectievraag). */
function Hulp({ check }: { check: Check }) {
  if (check.hulp.length === 0) return null;
  return (
    <>
      {check.hulp.map((h, i) => (
        <p key={i}>
          {h.kop && <strong>{h.kop}: </strong>}
          {h.tekst}
        </p>
      ))}
    </>
  );
}

export function Stap3({ content, data, wijzig, coachBezig, coachNietBeschikbaar, ontbrekend }: Props) {
  const r = content.regelset;
  const t = content.teksten;

  if (coachBezig === "checks") {
    return <p role="status">De coach vult de checks alvast voor je in…</p>;
  }

  const zetCheck = (checkId: string, w: string | string[] | Record<string, string>) =>
    wijzig((d) => ({ ...d, checks: { ...d.checks, [checkId]: w } }));

  const extraVragen = (c: Check, gekozen: string[]) =>
    r.extra_vragen
      .filter((e) => e.check === c.id && gekozen.some((g) => e.toon_bij.includes(g)))
      .map((e) => (
        <div id={`veld-${e.id}`} key={e.id} style={{ marginTop: "0.75rem" }}>
          <Keuze
            naam={e.id}
            fout={ontbrekend.has(e.id)}
            legend={e.vraag}
            vraag={e.uitleg}
            opties={JA_NEE}
            waarde={naarJaNee(data.extraVragen[e.id])}
            onKies={(v) => wijzig((d) => ({ ...d, extraVragen: { ...d.extraVragen, [e.id]: v === "ja" } }))}
          />
        </div>
      ));

  /** Check met deelvragen (Impact): één blok met per deelvraag een keuze. */
  const metDeelvragen = (c: Check) => {
    const huidig = data.checks[c.id];
    const perDeel: Record<string, string> = huidig && typeof huidig === "object" && !Array.isArray(huidig) ? huidig : {};
    return (
      <div id={`veld-${c.id}`} key={c.id}>
        <fieldset className="keuze">
          <legend>
            {c.nummer}. {c.naam}
            <span className="keuze__vraag">{c.vraag}</span>
          </legend>
          <div className="keuze__toelichting"><Hulp check={c} /></div>
          <div className="deelvragen">
            {c.deelvragen.map((d) => {
              const veld = `${c.id}-${d.id}`;
              return (
                <div id={`veld-${veld}`} key={d.id}>
                  <Keuze
                    naam={veld}
                    fout={ontbrekend.has(veld)}
                    legend={
                      <>
                        {d.naam}
                        <CoachLabel voorstel={data.coachVoorstellen[`${c.id}.${d.id}`]} gekozen={perDeel[d.id] ? [perDeel[d.id]!] : []} />
                      </>
                    }
                    vraag={d.vraag}
                    opties={c.antwoorden.map((a) => ({ id: a.id, label: a.label }))}
                    waarde={perDeel[d.id]}
                    onKies={(id) => zetCheck(c.id, { ...perDeel, [d.id]: id })}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>
      </div>
    );
  };

  /** Gewone check (één of meerdere antwoorden). */
  const gewoon = (c: Check) => {
    const gekozen = alsLijst(data.checks[c.id]);
    const keuzeProps = c.meerdere
      ? ({ meerdere: true, waarde: gekozen, onKies: (ids: string[]) => zetCheck(c.id, ids) } as const)
      : ({ waarde: gekozen[0], onKies: (id: string) => zetCheck(c.id, id) } as const);
    const extraRegelen = c.antwoorden.filter((a) => a.extra_regelen);
    return (
      <div id={`veld-${c.id}`} key={c.id}>
        <Keuze
          {...keuzeProps}
          naam={c.id}
          fout={ontbrekend.has(c.id)}
          legend={
            <>
              {c.nummer}. {c.naam}
              <CoachLabel voorstel={data.coachVoorstellen[c.id]} gekozen={gekozen} />
            </>
          }
          vraag={c.vraag}
          toelichting={c.hulp.length > 0 ? <Hulp check={c} /> : undefined}
          opties={c.antwoorden.map((a) => ({ id: a.id, label: a.label, uitleg: a.uitleg }))}
          extra={
            <>
              {extraRegelen.length > 0 && (
                <div className="extra-regelen">
                  <h4>{t.extra_regelen_titel}</h4>
                  <ul>
                    {extraRegelen.map((a) => (
                      <li key={a.id}>
                        {gekozen.includes(a.id) ? <strong>{a.kort ?? a.label}: {a.extra_regelen}</strong> : <>{a.kort ?? a.label}: {a.extra_regelen}</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {extraVragen(c, gekozen)}
            </>
          }
        />
      </div>
    );
  };

  return (
    <>
      {coachNietBeschikbaar && <p className="info" role="status">{t.coach_niet_beschikbaar}</p>}

      <h2>De zes checks</h2>
      {r.checks.map((c) => (c.deelvragen.length > 0 ? metDeelvragen(c) : gewoon(c)))}

      <h2>{t.aanvullende_vragen.titel}</h2>
      <p className="instructie">{t.aanvullende_vragen.intro}</p>
      {r.rode_vlaggen.map((v) => (
        <div id={`veld-${v.id}`} key={v.id}>
          <Keuze
            naam={v.id}
            fout={ontbrekend.has(v.id)}
            legend={t.aanvullende_vragen.vraag_label.replace("{nummer}", String(v.nummer))}
            vraag={v.vraag}
            toelichting={v.uitleg}
            opties={JA_NEE}
            waarde={naarJaNee(data.rodeVlaggen[v.id])}
            onKies={(x) => wijzig((d) => ({ ...d, rodeVlaggen: { ...d.rodeVlaggen, [v.id]: x === "ja" } }))}
          />
        </div>
      ))}
    </>
  );
}

/** Welke velden van stap 3 ontbreken nog? Geeft [veld-id, leesbare naam]. */
export function ontbrekendeVelden(content: StapProps["content"], data: StapProps["data"]): [string, string][] {
  const r = content.regelset;
  const uit: [string, string][] = [];
  for (const c of r.checks) {
    const huidig = data.checks[c.id];
    if (c.deelvragen.length > 0) {
      const perDeel = huidig && typeof huidig === "object" && !Array.isArray(huidig) ? huidig : {};
      for (const d of c.deelvragen) if (!perDeel[d.id]) uit.push([`${c.id}-${d.id}`, `${c.nummer}. ${c.naam} – ${d.naam}`]);
    } else if (alsLijst(huidig).length === 0) {
      uit.push([c.id, `${c.nummer}. ${c.naam}`]);
    }
    const gekozen = alsLijst(huidig);
    for (const e of r.extra_vragen) {
      if (e.check === c.id && gekozen.some((g) => e.toon_bij.includes(g)) && typeof data.extraVragen[e.id] !== "boolean") {
        uit.push([e.id, e.vraag]);
      }
    }
  }
  for (const v of r.rode_vlaggen) {
    if (typeof data.rodeVlaggen[v.id] !== "boolean") {
      uit.push([v.id, content.teksten.aanvullende_vragen.vraag_label.replace("{nummer}", String(v.nummer))]);
    }
  }
  return uit;
}
