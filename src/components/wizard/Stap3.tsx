"use client";
/**
 * Stap 3: de zes checks, met de verdiepingsvragen (privacy en AI) onder de check waar ze bij horen,
 * en de aanvullende vragen (rode vlaggen). Alles (vragen, schalen, hulpteksten) komt uit de regelset.
 * Welke verdiepingsvragen nodig zijn, bepaalt `analyseer` (domein): wat al bekend is, wordt niet gevraagd.
 */
import type { Check } from "@/domain/content-schema";
import { geldigExtraAntwoord, rodeVlagVanToepassing } from "@/domain/beslisregels";
import { analyseer, type OpenVraag } from "@/domain/verdieping";
import { alsLijst, Keuze, JA_NEE, naarJaNee } from "../Keuze";
import type { StapProps } from "./types";

type Data = StapProps["data"];
type Content = StapProps["content"];

/** De verdieping bij de huidige antwoorden (pure berekening uit het domein). */
export function verdiepingVan(content: Content, data: Data) {
  const r = content.regelset;
  const invoer = { checks: data.checks, extraVragen: data.extraVragen, rodeVlaggen: {}, verdieping: data.verdieping };
  const vlaggen = Object.fromEntries(
    r.rode_vlaggen.filter((v) => rodeVlagVanToepassing(v.id, invoer, r)).map((v) => [v.id, data.rodeVlaggen[v.id] === true]),
  );
  return analyseer({ ...invoer, rodeVlaggen: vlaggen }, r);
}

/** De aanvullende vragen die nu gesteld worden, met hun volgnummer. */
function zichtbareVlaggen(content: Content, data: Data) {
  const invoer = { checks: data.checks, rodeVlaggen: data.rodeVlaggen };
  return content.regelset.rode_vlaggen
    .filter((v) => rodeVlagVanToepassing(v.id, invoer, content.regelset))
    .map((v, i) => ({ vlag: v, nummer: i + 1 }));
}

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

  const verdieping = verdiepingVan(content, data);
  const velden = alleVelden(content, data);
  const open = velden.filter((v) => !v.beantwoord).length;
  const voortgang =
    open === 0
      ? t.verdieping.voortgang_klaar
      : (open === 1 ? t.verdieping.voortgang_een : t.verdieping.voortgang).replace("{aantal}", String(open));

  /** Eén verdiepingsvraag (privacy of AI), met waarom en eventueel een inleiding. */
  const verdiepingsVraag = (v: OpenVraag) => {
    const g = v.gegeven;
    const voorstel = data.coachVoorstellen[`tool.${g.id}`];
    return (
      <div id={`veld-${g.id}`} key={g.id} className="verdieping">
        <Keuze
          naam={g.id}
          fout={ontbrekend.has(g.id)}
          legend={
            <>
              {g.vraag}
              {voorstel && v.antwoord === voorstel.voorstel && <span className="coach-label">{t.verdieping.tool_voorstel}</span>}
            </>
          }
          vraag={v.signaal && g.signaal ? g.signaal : g.uitleg}
          opties={g.antwoorden}
          waarde={v.antwoord}
          onKies={(id) => wijzig((d) => ({ ...d, verdieping: { ...d.verdieping, [g.id]: id } }))}
        />
      </div>
    );
  };

  /** Verdiepingsvragen onder een check: eerst basis en privacy, daarna (bij Autonomie) de AI-groep. */
  const verdiepingBij = (c: Check) => {
    const hier = verdieping.vragen.filter((v) => v.gegeven.plek === c.id);
    const zonderAi = hier.filter((v) => v.gegeven.spoor !== "ai");
    const ai = hier.filter((v) => v.gegeven.spoor === "ai");
    const persoonsgegevens = verdieping.feiten.find((f) => f.id === "persoonsgegevens")?.waarde;
    const aiGebruik = verdieping.feiten.find((f) => f.id === "ai_gebruik")?.waarde;
    return (
      <>
        {c.id === "data" && verdieping.dpiaActief && (
          <p className="info verdieping__intro" role="status">
            {persoonsgegevens === "onzeker" ? t.verdieping.privacy_intro_onzeker : t.verdieping.privacy_intro}
          </p>
        )}
        {zonderAi.map(verdiepingsVraag)}
        {ai.length > 0 && (
          <div className="verdieping__groep" role="group" aria-labelledby="ai-groep-titel">
            <h4 id="ai-groep-titel">{t.verdieping.ai_titel}</h4>
            <p className="hulptekst">{aiGebruik === "weet_niet" ? t.verdieping.ai_intro_onzeker : t.verdieping.ai_intro}</p>
            {ai.map(verdiepingsVraag)}
          </div>
        )}
      </>
    );
  };

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
            opties={e.onzeker_mogelijk ? [...JA_NEE, { id: "onzeker", label: "Weet ik niet zeker" }] : JA_NEE}
            waarde={data.extraVragen[e.id] === "onzeker" ? "onzeker" : naarJaNee(data.extraVragen[e.id] as boolean | undefined)}
            onKies={(v) =>
              wijzig((d) => ({ ...d, extraVragen: { ...d.extraVragen, [e.id]: v === "onzeker" ? "onzeker" : v === "ja" } }))
            }
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
        {verdiepingBij(c)}
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
        {verdiepingBij(c)}
      </div>
    );
  };

  return (
    <>
      {coachNietBeschikbaar && <p className="info" role="status">{t.coach_niet_beschikbaar}</p>}

      <p className="voortgang" role="status" aria-live="polite">{voortgang.replace("{totaal}", String(velden.length))}</p>

      <h2>De zes checks</h2>
      {r.checks.map((c) => (c.deelvragen.length > 0 ? metDeelvragen(c) : gewoon(c)))}

      <h2>{t.aanvullende_vragen.titel}</h2>
      <p className="instructie">{t.aanvullende_vragen.intro}</p>
      {zichtbareVlaggen(content, data).map(({ vlag: v, nummer }) => (
        <div id={`veld-${v.id}`} key={v.id}>
          <Keuze
            naam={v.id}
            fout={ontbrekend.has(v.id)}
            legend={t.aanvullende_vragen.vraag_label.replace("{nummer}", String(nummer))}
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

/** Alle vragen van stap 3 die nu gesteld worden: [veld-id, leesbare naam, beantwoord]. */
export function alleVelden(content: Content, data: Data): { id: string; naam: string; beantwoord: boolean }[] {
  const r = content.regelset;
  const uit: { id: string; naam: string; beantwoord: boolean }[] = [];
  const verdieping = verdiepingVan(content, data);
  for (const c of r.checks) {
    const huidig = data.checks[c.id];
    if (c.deelvragen.length > 0) {
      const perDeel = huidig && typeof huidig === "object" && !Array.isArray(huidig) ? huidig : {};
      for (const d of c.deelvragen) uit.push({ id: `${c.id}-${d.id}`, naam: `${c.nummer}. ${c.naam} – ${d.naam}`, beantwoord: !!perDeel[d.id] });
    } else {
      uit.push({ id: c.id, naam: `${c.nummer}. ${c.naam}`, beantwoord: alsLijst(huidig).length > 0 });
    }
    const gekozen = alsLijst(huidig);
    for (const e of r.extra_vragen) {
      if (e.check === c.id && gekozen.some((g) => e.toon_bij.includes(g))) {
        uit.push({ id: e.id, naam: e.vraag, beantwoord: geldigExtraAntwoord(data.extraVragen[e.id], e.onzeker_mogelijk) });
      }
    }
    for (const v of verdieping.vragen.filter((x) => x.gegeven.plek === c.id)) {
      uit.push({ id: v.gegeven.id, naam: v.gegeven.vraag, beantwoord: v.antwoord !== undefined });
    }
  }
  for (const { vlag: v, nummer } of zichtbareVlaggen(content, data)) {
    uit.push({
      id: v.id,
      naam: content.teksten.aanvullende_vragen.vraag_label.replace("{nummer}", String(nummer)),
      beantwoord: typeof data.rodeVlaggen[v.id] === "boolean",
    });
  }
  return uit;
}

/** Welke velden van stap 3 ontbreken nog? Geeft [veld-id, leesbare naam]. */
export function ontbrekendeVelden(content: Content, data: Data): [string, string][] {
  return alleVelden(content, data)
    .filter((v) => !v.beantwoord)
    .map((v) => [v.id, v.naam]);
}
