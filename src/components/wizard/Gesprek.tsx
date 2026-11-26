"use client";
/**
 * Stap 3 als gesprek: de coach stelt de vragen één voor één. Eerdere vragen en antwoorden staan erboven,
 * met een knop om ze te wijzigen.
 *
 * Dit is alleen een andere weergave. De vragen, de antwoorden en de volgorde komen uit `beurten` (velden.ts),
 * dezelfde bron als de lijst; de uitkomst wordt daarna gewoon met de vaste beslisregels berekend.
 * Voorstellen van de coach worden niet stilzwijgend overgenomen: de medewerker bevestigt elk antwoord.
 *
 * De vrije chat zit in het gesprek: bij elke vraag kun je de coach iets vragen. Het bericht onthoudt bij welke
 * vraag het hoort (`bij`), zodat het in de geschiedenis op de goede plek blijft staan.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatBericht } from "@/domain/wizard";
import { Keuze } from "../Keuze";
import type { StapProps } from "./types";
import { afgeleidBij, beurten, isAfgerond, type Beurt } from "./velden";

interface Props extends StapProps {
  coachNietBeschikbaar: boolean;
  /** Een eigen vraag aan de coach, bij een vraag uit het gesprek (veld-id) of "klaar". */
  onChat: (tekst: string, bij: string) => void;
  chatBezig: boolean;
  /** Bij het advies: het gesprek terugkijken, zonder Wijzig en zonder huidige vraag. */
  alleenLezen?: boolean;
}

type Teksten = StapProps["content"]["teksten"]["gesprek"];

/** De berichten bij één vraag, als bubbels. */
export function Berichten({ berichten, bezig, t }: { berichten: ChatBericht[]; bezig?: boolean; t: Teksten }) {
  return (
    <>
      {berichten.map((b, i) => (
        <li key={i} className={`gesprek__bericht gesprek__bericht--chat gesprek__bericht--${b.rol === "coach" ? "coach" : "jij"}`}>
          <span className="gesprek__wie">{b.rol === "coach" ? "Coach" : "Jij"}</span>
          {b.tekst}
        </li>
      ))}
      {bezig && (
        <li className="gesprek__bericht gesprek__bericht--chat gesprek__bericht--coach">
          <span className="gesprek__wie">Coach</span>
          {t.denkt}
        </li>
      )}
    </>
  );
}

/** Vraag de coach iets, binnen de huidige vraag van het gesprek. */
export function Chat({ bij, berichten, bezig, label, t, onVerstuur, plaatshouder }: {
  plaatshouder?: string;
  bij: string;
  berichten: ChatBericht[];
  bezig: boolean;
  label: string;
  t: Teksten;
  onVerstuur: (tekst: string, bij: string) => void;
}) {
  const [tekst, setTekst] = useState("");
  const id = `gesprek-chat-${bij}`;
  const verstuur = (e: FormEvent) => {
    e.preventDefault();
    const x = tekst.trim();
    if (!x || bezig) return;
    onVerstuur(x, bij);
    setTekst("");
  };
  return (
    <div className="gesprek__chat">
      <ol className="gesprek__chatberichten" aria-live="polite" aria-relevant="additions">
        <Berichten berichten={berichten} bezig={bezig} t={t} />
      </ol>
      <form onSubmit={verstuur}>
        <label htmlFor={id}>{label}</label>
        <div className="gesprek__chatinvoer">
          <input id={id} type="text" value={tekst} maxLength={2000} autoComplete="off" placeholder={plaatshouder ?? t.chat_plaatshouder} onChange={(e) => setTekst(e.target.value)} />
          <button type="submit" className="knop knop--secundair" disabled={bezig || !tekst.trim()}>{t.chat_stuur}</button>
        </div>
      </form>
    </div>
  );
}

export function Gesprek({ content, data, wijzig, coachBezig, coachNietBeschikbaar, onChat, chatBezig, alleenLezen = false }: Props) {
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
    if (huidigId === undefined || alleenLezen) return;
    if (vorige.current !== undefined && vorige.current !== huidigId) {
      const doel = huidigId ? kopRef.current : klaarRef.current;
      doel?.focus();
      const rustig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      doel?.scrollIntoView?.({ block: "center", behavior: rustig ? "auto" : "smooth" });
    }
    vorige.current = huidigId;
  }, [huidigId, alleenLezen]);

  if (coachBezig === "checks") {
    return <p role="status">{t.vult_checks}</p>;
  }

  const berichtenBij = (bij: string) => data.chat.filter((m) => m.bij === bij);
  const eerder = data.chat.filter((m) => !m.bij);
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

  const actief = (b: Beurt) => {
    const keuzeProps = b.meerdere
      ? ({ meerdere: true, waarde: b.gekozen, onKies: (ids: string[]) => wijzig((d) => b.zet(d, ids)) } as const)
      : ({ waarde: b.gekozen[0], onKies: (id: string) => wijzig((d) => b.zet(d, [id])) } as const);
    return (
      <li className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief" id={`veld-${b.id}`} key={b.id}>
        <span className="gesprek__wie">Coach</span>
        <h2 className="gesprek__kop" ref={kopRef} tabIndex={-1}>{b.kop}</h2>
        {b.intro && <p>{b.intro}</p>}
        {/* Een voorstel van de coach staat alleen als vooraf gekozen antwoord; de medewerker bevestigt het met Volgende. */}
        <Keuze {...keuzeProps} naam={b.id} legend={b.vraag} vraag={b.uitleg} opties={b.opties} />
        {/* Geen "Wat bedoel je hiermee?": de i bij een antwoord legt het uit, en anders vraag je het de coach. */}
        <Chat bij={b.id} berichten={berichtenBij(b.id)} bezig={chatBezig} label={t.chat_label} t={t} onVerstuur={onChat} />
        <div className="knoppen">
          <button type="button" className="knop" disabled={b.gekozen.length === 0} onClick={() => bevestig(b)}>
            {t.volgende} →
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
      {berichtenBij(b.id).length > 0 && (
        <ol className="gesprek__chatberichten">
          <Berichten berichten={berichtenBij(b.id)} t={t} />
        </ol>
      )}
      <div className="gesprek__bericht gesprek__bericht--jij">
        <span className="gesprek__wie">Jij</span>
        <span className="sr-only">{t.jouw_antwoord} </span>
        {labels(b).join(", ")}
        {!alleenLezen && (
          <button type="button" className="gesprek__wijzig" onClick={() => setBewerk(b.id)} aria-label={`${t.wijzig}: ${b.vraag}`}>
            {t.wijzig}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <>
      {!alleenLezen && <p className="voortgang" role="status" aria-live="polite">{voortgang}</p>}
      {eerder.length > 0 && (
        <details className="gesprek__eerder">
          <summary>{t.eerdere_berichten.replace("{aantal}", String(eerder.length))}</summary>
          <ol className="gesprek__chatberichten">
            <Berichten berichten={eerder} t={t} />
          </ol>
        </details>
      )}
      <ol className="gesprek">
        <li className="gesprek__bericht gesprek__bericht--coach">
          <span className="gesprek__wie">Coach</span>
          {coachNietBeschikbaar ? t.intro_zonder_coach : t.intro}
        </li>
        {lijst.flatMap((b, i) => {
          if (alleenLezen) return b.gekozen.length > 0 ? [paar(b)] : [];
          if (b === huidige) return [actief(b)];
          if (!isAfgerond(b, data)) return [];
          return [paar(b), alBekend(b, i)].filter((x) => x !== null);
        })}
        {!huidige && !alleenLezen && (
          <li className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief">
            <span className="gesprek__wie">Coach</span>
            <p ref={klaarRef} tabIndex={-1} style={{ margin: 0 }}>{t.klaar}</p>
            <Chat bij="klaar" berichten={berichtenBij("klaar")} bezig={chatBezig} label={t.chat_label_klaar} t={t} onVerstuur={onChat} />
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
