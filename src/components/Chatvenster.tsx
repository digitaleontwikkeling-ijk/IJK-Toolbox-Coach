"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatBericht } from "@/domain/wizard";
import { hoeWerktHetHref } from "@/lib/paden";
import { HoeWerktHetLink } from "./HoeWerktHet";

interface Props {
  berichten: ChatBericht[];
  bezig: boolean;
  onVerstuur: (tekst: string) => void;
  /** Tekst voor de link naar "Hoe werkt de coach?" */
  uitlegLink?: string;
}

export const CHAT_INVOER_ID = "chat-invoer";

export function Chatvenster({ berichten, bezig, onVerstuur, uitlegLink }: Props) {
  const [tekst, setTekst] = useState("");
  const lijst = useRef<HTMLOListElement>(null);

  useEffect(() => {
    lijst.current?.scrollTo({ top: lijst.current.scrollHeight });
  }, [berichten.length]);

  function verstuur(e: FormEvent) {
    e.preventDefault();
    const t = tekst.trim();
    if (!t || bezig) return;
    onVerstuur(t);
    setTekst("");
  }

  return (
    <aside className="paneel paneel--vlak chat" aria-labelledby="chat-titel">
      <h2 id="chat-titel">Chat met de coach</h2>
      {uitlegLink && (
        <p className="hulptekst" style={{ marginTop: "-0.25rem" }}>
          <HoeWerktHetLink tekst={uitlegLink} href={hoeWerktHetHref()} />
        </p>
      )}
      <ol className="chat__berichten" ref={lijst} aria-live="polite" aria-relevant="additions">
        {berichten.length === 0 && (
          <li className="chat__bericht chat__bericht--coach">
            <span className="chat__wie">Coach</span>
            Hoi! Ik denk met je mee. Stel gerust een vraag.
          </li>
        )}
        {berichten.map((b, i) => (
          <li key={i} className={`chat__bericht chat__bericht--${b.rol}`}>
            <span className="chat__wie">{b.rol === "coach" ? "Coach" : "Jij"}</span>
            {b.tekst}
          </li>
        ))}
        {bezig && (
          <li className="chat__bericht chat__bericht--coach">
            <span className="chat__wie">Coach</span>
            <span>Even denken…</span>
          </li>
        )}
      </ol>
      <form onSubmit={verstuur}>
        <label htmlFor={CHAT_INVOER_ID} className="sr-only">Je vraag aan de coach</label>
        <input id={CHAT_INVOER_ID} type="text" value={tekst} maxLength={2000} onChange={(e) => setTekst(e.target.value)} placeholder="Stel een vraag…" />
        <button type="submit" className="knop" disabled={bezig || !tekst.trim()}>Stuur</button>
      </form>
    </aside>
  );
}
