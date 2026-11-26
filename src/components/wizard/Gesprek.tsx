"use client";
/**
 * Stap 3 als gesprek: de coach stelt de vragen één voor één. Eerdere vragen en antwoorden staan erboven,
 * met een knop om ze te wijzigen.
 *
 * Dit is alleen een andere weergave. De vragen, de antwoorden en de volgorde komen uit `beurten` (velden.ts),
 * dezelfde bron als de lijst; de uitkomst wordt daarna gewoon met de vaste beslisregels berekend.
 * Voorstellen van de coach worden niet stilzwijgend overgenomen: de medewerker bevestigt elk antwoord.
 */
import { useEffect, useRef, useState } from "react";
import { Keuze } from "../Keuze";
import type { StapProps } from "./types";
import { afgeleidBij, beurten, isAfgerond, isVoorstel, type Beurt } from "./velden";

interface Props extends StapProps {
  coachNietBeschikbaar: boolean;
  /** Focus naar het chatvenster (een eigen vraag aan de coach). */
  onVraagCoach: () => void;
}

export function Gesprek({ content, data, wijzig, coachBezig, coachNietBeschikbaar, onVraagCoach }: Props) {
  const t = content.teksten.gesprek;
  const [bewerk, setBewerk] = useState<string | null>(null);
  const kopRef = useRef<HTMLHeadingElement>(null);
  const klaarRef = useRef<HTMLParagraphElement>(null);
  const vorige = useRef<string | null | undefined>(undefined);

  const lijst = coachBezig === "checks" ? [] : beurten(content, data);
  const huidige = lijst.find((b) => b.id === bewerk) ?? lijst.find((b) => !isAfgerond(b, data));
  const open = lijst.filter((b) => !isAfgerond(b, data)).length;
  const v = content.teksten.verdieping;
  const voortgang = (open === 0 ? v.voortgang_klaar : open === 1 ? v.voortgang_een : v.voortgang)
    .replace("{aantal}", String(open))
    .replace("{totaal}", String(lijst.length));

  // Nieuwe vraag: focus naar de kop ervan (niet bij het openen van de stap; dan zet de wizard de focus).
  const huidigId = coachBezig === "checks" ? undefined : huidige?.id ?? null;
  useEffect(() => {
    if (huidigId === undefined) return;
    if (vorige.current !== undefined && vorige.current !== huidigId) {
      const doel = huidigId ? kopRef.current : klaarRef.current;
      doel?.focus();
      const rustig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      doel?.scrollIntoView?.({ block: "center", behavior: rustig ? "auto" : "smooth" });
    }
    vorige.current = huidigId;
  }, [huidigId]);

  if (coachBezig === "checks") {
    return <p role="status">De coach vult de checks alvast voor je in…</p>;
  }

  const labels = (b: Beurt) => b.gekozen.map((id) => b.opties.find((o) => o.id === id)?.label ?? id);
  const bevestig = (b: Beurt) => {
    wijzig((d) => ({ ...d, bevestigd: d.bevestigd.includes(b.id) ? d.bevestigd : [...d.bevestigd, b.id] }));
    setBewerk(null);
  };

  /** Wat de coach al weet bij deze check, na de laatste vraag van die check. */
  const alBekend = (b: Beurt, i: number) => {
    if (!b.check || lijst[i + 1]?.check?.id === b.check.id) return null;
    if (!lijst.filter((x) => x.check?.id === b.check!.id).every((x) => isAfgerond(x, data))) return null;
    const afgeleid = afgeleidBij(content, data, b.check.id);
    if (afgeleid.length === 0) return null;
    return (
      <li className="gesprek__bericht gesprek__bericht--coach" key={`${b.check.id}-bekend`}>
        <span className="gesprek__wie">Coach</span>
        <p>{t.al_bekend}</p>
        <ul>
          {afgeleid.map((a) => (
            <li key={a.feit.id}>
              {a.vraag} <strong>{a.antwoord}</strong> <span className="hulptekst">({a.feit.toelichting})</span>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  const voorstelTekst = (b: Beurt) => {
    if (!b.voorstel || !isVoorstel(b)) return null;
    const label = labels(b)[0]!;
    const sjabloon = b.voorstel.bron === "tool" ? t.voorstel_tool : b.voorstel.zekerheid === "laag" ? t.voorstel_onzeker : t.voorstel;
    const [voor, na] = sjabloon.split("{antwoord}");
    return (
      <p className="gesprek__voorstel">
        {voor}
        <strong>{label}</strong>
        {na}
      </p>
    );
  };

  const actief = (b: Beurt) => {
    const extraRegelen = b.check && b.id === b.check.id ? b.check.antwoorden.filter((a) => a.extra_regelen) : [];
    const keuzeProps = b.meerdere
      ? ({ meerdere: true, waarde: b.gekozen, onKies: (ids: string[]) => wijzig((d) => b.zet(d, ids)) } as const)
      : ({ waarde: b.gekozen[0], onKies: (id: string) => wijzig((d) => b.zet(d, [id])) } as const);
    return (
      <li className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief" id={`veld-${b.id}`} key={b.id}>
        <span className="gesprek__wie">Coach</span>
        <h2 className="gesprek__kop" ref={kopRef} tabIndex={-1}>{b.kop}</h2>
        {b.intro && <p>{b.intro}</p>}
        {voorstelTekst(b)}
        {b.voorstel?.vervolgvraag && b.voorstel.zekerheid !== "hoog" && isVoorstel(b) && (
          <p className="gesprek__voorstel">{t.twijfel.replace("{vraag}", b.voorstel.vervolgvraag)}</p>
        )}
        <Keuze {...keuzeProps} naam={b.id} legend={b.vraag} vraag={b.uitleg} opties={b.opties} />
        {extraRegelen.length > 0 && (
          <div className="extra-regelen">
            <h3>{content.teksten.extra_regelen_titel}</h3>
            <ul>
              {extraRegelen.map((a) => (
                <li key={a.id}>
                  {b.gekozen.includes(a.id) ? <strong>{a.kort ?? a.label}: {a.extra_regelen}</strong> : <>{a.kort ?? a.label}: {a.extra_regelen}</>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {b.hulp.length > 0 && (
          <details className="gesprek__hulp">
            <summary>{t.wat_bedoel_je}</summary>
            {b.hulp.map((h, i) => (
              <p key={i}>
                {h.kop && <strong>{h.kop}: </strong>}
                {h.tekst}
              </p>
            ))}
          </details>
        )}
        <div className="knoppen">
          <button type="button" className="knop" disabled={b.gekozen.length === 0} onClick={() => bevestig(b)}>
            {isVoorstel(b) ? t.bevestig : t.volgende} →
          </button>
          <button type="button" className="knop knop--tekst" onClick={onVraagCoach}>
            {t.vraag_coach}
          </button>
        </div>
      </li>
    );
  };

  const paar = (b: Beurt) => (
    <li className="gesprek__paar" key={b.id}>
      <div className="gesprek__bericht gesprek__bericht--coach">
        <span className="gesprek__wie">Coach</span>
        <span className="gesprek__kop-klein">{b.kop}</span>
        {b.vraag}
      </div>
      <div className="gesprek__bericht gesprek__bericht--jij">
        <span className="gesprek__wie">Jij</span>
        <span className="sr-only">{t.jouw_antwoord} </span>
        {labels(b).join(", ")}
        <button type="button" className="gesprek__wijzig" onClick={() => setBewerk(b.id)} aria-label={`${t.wijzig}: ${b.vraag}`}>
          {t.wijzig}
        </button>
      </div>
    </li>
  );

  return (
    <>
      <p className="voortgang" role="status" aria-live="polite">{voortgang}</p>
      <ol className="gesprek">
        <li className="gesprek__bericht gesprek__bericht--coach">
          <span className="gesprek__wie">Coach</span>
          {coachNietBeschikbaar ? t.intro_zonder_coach : t.intro}
        </li>
        {lijst.flatMap((b, i) => {
          if (b === huidige) return [actief(b)];
          if (!isAfgerond(b, data)) return [];
          return [paar(b), alBekend(b, i)].filter((x) => x !== null);
        })}
        {!huidige && (
          <li className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief">
            <span className="gesprek__wie">Coach</span>
            <p ref={klaarRef} tabIndex={-1} style={{ margin: 0 }}>{t.klaar}</p>
          </li>
        )}
      </ol>
    </>
  );
}

/** Zijn alle vragen in het gesprek beantwoord en bevestigd? */
export function gesprekKlaar(content: StapProps["content"], data: StapProps["data"]): boolean {
  return beurten(content, data).every((b) => isAfgerond(b, data));
}
