"use client";
/**
 * Fase 1 als gesprek, en de overgang naar fase 2: wat wil je bereiken, de vragen van de coach, het tooladvies
 * en de uitleg over fase 2. Daarna volgen de checks (Gesprek.tsx).
 *
 * Alleen een andere weergave van stap 1 en 2: dezelfde gegevens, dezelfde coach-taken en dezelfde knoppen
 * (de wizard doet het werk). Eerdere antwoorden staan erboven, met Wijzig.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ANDERE_TOOL } from "@/domain/content-schema";
import { gekozenToolNaam } from "../client";
import { Fase2Uitleg } from "./Fase2Uitleg";
import { Berichten, Chat } from "./Gesprek";
import type { ChatBericht } from "@/domain/wizard";
import { Stap2 } from "./Stap2";
import { Verduidelijking } from "./Stap1";
import type { StapProps } from "./types";

interface Props extends StapProps {
  fout: string | null;
  tooladviesNietBeschikbaar: boolean;
  onVolgende1: () => void;
  onVolgende2: () => void;
  onAnderAdvies: () => void;
  onBeginChecks: () => void;
  gaNaar: (stap: number) => void;
  onChat: (tekst: string, bij: string) => void;
  chatBezig: boolean;
}

/** Een vraag van de coach en jouw antwoord, met Wijzig. */
function Paar({ kop, vraag, antwoord, wijzigLabel, onWijzig, t, berichten = [] }: {
  berichten?: ChatBericht[];
  kop?: string;
  vraag: string;
  antwoord: string;
  wijzigLabel: string;
  onWijzig: () => void;
  t: StapProps["content"]["teksten"]["gesprek"];
}) {
  return (
    <li className="gesprek__paar">
      <div className="gesprek__bericht gesprek__bericht--coach">
        <span className="gesprek__wie">Coach</span>
        {kop && <span className="gesprek__kop-klein">{kop}</span>}
        {vraag}
      </div>
      {berichten.length > 0 && (
        <ol className="gesprek__chatberichten">
          <Berichten berichten={berichten} t={t} />
        </ol>
      )}
      <div className="gesprek__bericht gesprek__bericht--jij">
        <span className="gesprek__wie">Jij</span>
        <span className="sr-only">{t.jouw_antwoord} </span>
        <span className="gesprek__antwoord">{antwoord}</span>
        <button type="button" className="gesprek__wijzig" onClick={onWijzig} aria-label={`${t.wijzig}: ${wijzigLabel}`}>
          {t.wijzig}
        </button>
      </div>
    </li>
  );
}

export function GesprekFase1(props: Props) {
  const { content, data, wijzig, coachBezig, fout, gaNaar } = props;
  const t = content.teksten.gesprek;
  const stappen = content.teksten.stappen;
  const titel = (n: number) => stappen.find((s) => s.nummer === n)!.titel;
  const [bewerkBeschrijving, setBewerkBeschrijving] = useState(false);
  const kopRef = useRef<HTMLHeadingElement>(null);

  const vragen = data.verduidelijking;
  const actief =
    data.stap === 1
      ? data.verduidelijkingGevraagd && vragen.length > 0 && !bewerkBeschrijving
        ? "verduidelijking"
        : "beschrijving"
      : data.stap === 2
        ? "tool"
        : !data.fase2UitlegGezien
          ? "fase2"
          : null;

  // Een nieuwe beurt binnen dezelfde stap (beschrijving → vragen van de coach): focus naar de kop.
  // Bij een nieuwe stap zet de wizard de focus.
  const vorige = useRef({ actief, stap: data.stap });
  useEffect(() => {
    if (vorige.current.actief !== actief && vorige.current.stap === data.stap) kopRef.current?.focus();
    vorige.current = { actief, stap: data.stap };
  }, [actief, data.stap]);

  const bij = (id: string) => data.chat.filter((m) => m.bij === id);
  const chat = (id: string, label = t.chat_label) => (
    <Chat bij={id} berichten={bij(id)} bezig={props.chatBezig} label={label} t={t} onVerstuur={props.onChat} />
  );
  const toolNaam = data.tooladvies ? gekozenToolNaam(content, data.tooladvies) : undefined;
  const items: ReactNode[] = [];

  // ---------- Wat wil je bereiken? ----------
  if (actief === "beschrijving") {
    items.push(
      <li key="beschrijving" className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief">
        <span className="gesprek__wie">Coach</span>
        <h2 className="gesprek__kop" ref={kopRef} tabIndex={-1}>{t.kop_beschrijving}</h2>
        <p>{t.fase1_intro}</p>
        <div className="veld">
          <label htmlFor="beschrijving">Jouw probleem of idee</label>
          <textarea
            id="beschrijving"
            value={data.beschrijving}
            maxLength={4000}
            aria-describedby="beschrijving-hulp"
            aria-invalid={fout ? true : undefined}
            onChange={(e) => {
              const beschrijving = e.target.value;
              wijzig((d) => ({ ...d, beschrijving }));
            }}
          />
          <p id="beschrijving-hulp" className="hulptekst">{t.beschrijving_hulp}</p>
        </div>
        {coachBezig === "verduidelijk" && <p role="status">{t.leest}</p>}
        {chat("beschrijving")}
        <div className="knoppen">
          <button
            type="button"
            className="knop"
            disabled={!!coachBezig}
            onClick={() => {
              setBewerkBeschrijving(false);
              props.onVolgende1();
            }}
          >
            Volgende →
          </button>
        </div>
      </li>,
    );
    return <ol className="gesprek">{items}</ol>;
  }

  items.push(
    <Paar
      key="beschrijving"
      t={t}
      kop={titel(1)}
      vraag={t.fase1_vraag}
      antwoord={data.beschrijving}
      berichten={bij("beschrijving")}
      wijzigLabel={titel(1)}
      onWijzig={() => {
        setBewerkBeschrijving(true);
        if (data.stap !== 1) gaNaar(1);
        else setTimeout(() => kopRef.current?.focus(), 30);
      }}
    />,
  );

  // ---------- Vragen van de coach (verduidelijking) ----------
  if (actief === "verduidelijking") {
    items.push(
      <li key="verduidelijking" className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief">
        <span className="gesprek__wie">Coach</span>
        <h2 className="gesprek__kop" ref={kopRef} tabIndex={-1}>
          De coach heeft nog {vragen.length === 1 ? "een vraag" : "twee vragen"}
        </h2>
        <p>{t.verduidelijking_intro}</p>
        {vragen.map((v, i) => (
          <Verduidelijking
            key={i}
            i={i}
            v={v}
            zet={(w) => wijzig((d) => ({ ...d, verduidelijking: d.verduidelijking.map((x, j) => (j === i ? { ...x, ...w } : x)) }))}
          />
        ))}
        {chat("verduidelijking")}
        <div className="knoppen">
          <button type="button" className="knop" disabled={!!coachBezig} onClick={props.onVolgende1}>
            Volgende →
          </button>
        </div>
      </li>,
    );
    return <ol className="gesprek">{items}</ol>;
  }
  vragen.forEach((v, i) =>
    items.push(
      <Paar
        key={`verduidelijking-${i}`}
        t={t}
        vraag={v.vraag}
        antwoord={v.antwoord.trim() || t.niet_beantwoord}
        wijzigLabel={v.vraag}
        berichten={i === vragen.length - 1 ? bij("verduidelijking") : []}
        onWijzig={() => gaNaar(1)}
      />,
    ),
  );

  // ---------- Welke tool past? ----------
  if (actief === "tool") {
    const advies = data.tooladvies;
    const klaar = advies && toolNaam && (advies.tool !== ANDERE_TOOL || advies.andereTool?.naam.trim());
    items.push(
      <li key="tool" className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief">
        <span className="gesprek__wie">Coach</span>
        <h2 className="gesprek__kop" ref={kopRef} tabIndex={-1}>{t.kop_tool}</h2>
        {coachBezig !== "tooladvies" && advies?.bron === "coach" && advies.tool !== ANDERE_TOOL && <p>{t.tooladvies_intro}</p>}
        <Stap2 {...props} coachNietBeschikbaar={props.tooladviesNietBeschikbaar} onAnderAdvies={props.onAnderAdvies} />
        {coachBezig !== "tooladvies" && chat("tooladvies")}
        {coachBezig !== "tooladvies" && (
          <div className="knoppen">
            <button type="button" className="knop" disabled={!!coachBezig || !advies} onClick={props.onVolgende2}>
              {klaar ? `${toolNaam} past, verder →` : "Volgende →"}
            </button>
          </div>
        )}
      </li>,
    );
    return <ol className="gesprek">{items}</ol>;
  }
  items.push(
    <Paar key="tool" t={t} kop={titel(2)} vraag={t.tool_vraag} antwoord={toolNaam ?? ""} berichten={bij("tooladvies")} wijzigLabel={titel(2)} onWijzig={() => gaNaar(2)} />,
  );

  // ---------- Fase 2: uitleg ----------
  const f2 = content.teksten.fase2_uitleg;
  if (actief === "fase2") {
    items.push(
      <li key="fase2" className="gesprek__bericht gesprek__bericht--coach gesprek__bericht--actief">
        <span className="gesprek__wie">Coach</span>
        <h2 className="gesprek__kop" ref={kopRef} tabIndex={-1}>{t.kop_fase2}</h2>
        <Fase2Uitleg content={content} />
        <div className="knoppen">
          <button type="button" className="knop" onClick={props.onBeginChecks}>{f2.knop} →</button>
        </div>
      </li>,
    );
  } else {
    items.push(
      <li key="fase2" className="gesprek__bericht gesprek__bericht--coach">
        <span className="gesprek__wie">Coach</span>
        <span className="gesprek__kop-klein">{f2.titel}</span>
        <p>{f2.intro}</p>
        <details className="gesprek__hulp">
          <summary>{f2.opnieuw_lezen}</summary>
          <Fase2Uitleg content={content} />
        </details>
      </li>,
    );
  }
  return <ol className="gesprek gesprek--fase1">{items}</ol>;
}
