"use client";
/**
 * De wizard: vier stappen in twee fases, met de coach in het chatvenster ernaast.
 *
 * - Alle invoer wordt als concept op de server bewaard (terug/vooruit en herladen kost niets).
 * - De coach doet voorstellen; is hij niet beschikbaar, dan vult de medewerker zelf in.
 * - De uitkomst wordt altijd door de server berekend met de vaste beslisregels.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { WizardData } from "@/domain/wizard";
import { Adviescard } from "../Adviescard";
import { Chatvenster, CHAT_INVOER_ID } from "../Chatvenster";
import { Stappenbalk } from "../Stappenbalk";
import { api, ApiFoutClient, toolNaam, useContent, type AdviesDto } from "../client";
import { afgerondPad, volledigPad, wizardPad } from "@/lib/paden";
import { Stap1 } from "./Stap1";
import { Stap2 } from "./Stap2";
import { ontbrekendeVelden, Stap3 } from "./Stap3";
import { Fase2Uitleg } from "./Fase2Uitleg";
import type { Wijzig } from "./types";

interface ConceptDto {
  id: string;
  adviesId: string | null;
  data: WizardData;
}

type CheckVoorstel = {
  check: string;
  deelvraag?: string;
  voorstel: string;
  zekerheid: "hoog" | "middel" | "laag";
  vervolgvraag?: string;
};

export function Wizard() {
  const content = useContent();
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [data, setData] = useState<WizardData | null>(null);
  const [advies, setAdvies] = useState<AdviesDto | null>(null);
  const [coachBezig, setCoachBezig] = useState<string | null>(null);
  const [coachWeg, setCoachWeg] = useState<Record<string, boolean>>({});
  const [chatBezig, setChatBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [foutDetails, setFoutDetails] = useState<string[] | null>(null);
  const [ontbrekend, setOntbrekend] = useState<Set<string>>(new Set());
  const [actieBezig, setActieBezig] = useState(false);
  const [actieFout, setActieFout] = useState<string | null>(null);
  const [afgerond, setAfgerond] = useState(false);
  const [laadFout, setLaadFout] = useState<string | null>(null);

  const dataRef = useRef<WizardData | null>(null);
  const bewaarTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const kopRef = useRef<HTMLHeadingElement>(null);
  const adviesKopRef = useRef<HTMLHeadingElement>(null);
  const foutRef = useRef<HTMLDivElement>(null);
  const eersteRender = useRef(true);

  // ---------- Laden ----------
  // Met ?concept=<id> ga je verder met dat idee (ook na herladen). Zonder: altijd een nieuw idee,
  // met de vraag of je verder wilt met een onafgemaakt idee als dat er is.
  const [vorige, setVorige] = useState<ConceptDto | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const gevraagd = new URLSearchParams(window.location.search).get("concept");
        let concept: ConceptDto | null = null;
        if (gevraagd) {
          concept = (await api<{ concept: ConceptDto }>(`/api/concept/${encodeURIComponent(gevraagd)}`).catch(() => null))?.concept ?? null;
        }
        if (!concept) {
          const onafgemaakt = (await api<{ concept: ConceptDto | null }>("/api/concept")).concept;
          concept = (await api<{ concept: ConceptDto }>("/api/concept", { method: "POST" })).concept;
          if (onafgemaakt && onafgemaakt.id !== concept.id) setVorige(onafgemaakt);
        }
        window.history.replaceState(null, "", volledigPad(wizardPad(concept.id)));
        setConceptId(concept.id);
        dataRef.current = concept.data;
        setData(concept.data);
        if (concept.adviesId) {
          const r = await api<{ advies: AdviesDto }>(`/api/advies/${concept.adviesId}`).catch(() => null);
          if (r) setAdvies(r.advies);
        }
      } catch {
        setLaadFout("De wizard kon niet worden geladen. Probeer de pagina te verversen.");
      }
    })();
  }, []);

  // ---------- Opslaan ----------
  const bewaarNu = useCallback(async () => {
    clearTimeout(bewaarTimer.current);
    if (!conceptId || !dataRef.current || afgerond) return;
    await api(`/api/concept/${conceptId}`, { method: "PUT", body: dataRef.current });
  }, [conceptId, afgerond]);

  const wijzig: Wijzig = useCallback(
    (fn) => {
      const nieuw = fn(dataRef.current!);
      dataRef.current = nieuw;
      setData(nieuw);
      clearTimeout(bewaarTimer.current);
      bewaarTimer.current = setTimeout(() => void bewaarNu().catch(() => undefined), 600);
    },
    [bewaarNu],
  );

  const zegCoach = useCallback(
    (tekst: string) => wijzig((d) => ({ ...d, chat: [...d.chat, { rol: "coach", tekst }] })),
    [wijzig],
  );

  // Focus naar de kop van de nieuwe stap (voor toetsenbord- en schermlezergebruikers).
  useEffect(() => {
    if (!data) return;
    if (eersteRender.current) {
      eersteRender.current = false;
      return;
    }
    (data.stap === 4 ? adviesKopRef.current : kopRef.current)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.stap, advies?.id]);

  const gaNaar = useCallback(
    (stap: number) => {
      setFout(null);
      setFoutDetails(null);
      setOntbrekend(new Set());
      wijzig((d) => ({ ...d, stap }));
    },
    [wijzig],
  );

  // ---------- Coach-taken ----------
  async function coach<T>(taak: string, body: unknown): Promise<T | null> {
    setCoachBezig(taak);
    try {
      const r = await api<{ resultaat: T | null }>(`/api/coach/${taak}`, { body });
      setCoachWeg((w) => ({ ...w, [taak]: r.resultaat === null }));
      return r.resultaat;
    } catch {
      setCoachWeg((w) => ({ ...w, [taak]: true }));
      return null;
    } finally {
      setCoachBezig(null);
    }
  }

  async function vraagTooladvies(uitsluiten: string[]) {
    const d = dataRef.current!;
    const r = await coach<{ behoefte: string; tool: string; motivatie: string }>("tooladvies", {
      beschrijving: d.beschrijving,
      verduidelijking: d.verduidelijking,
      uitsluiten,
    });
    if (r) {
      wijzig((x) => ({ ...x, uitgeslotenTools: uitsluiten, tooladvies: { ...r, bron: "coach", geaccepteerd: false } }));
    } else if (uitsluiten.length) {
      zegCoach("Ik heb geen ander advies. Kies hieronder zelf een tool.");
    }
  }

  async function vulChecksVoor() {
    const d = dataRef.current!;
    const voorstellen = await coach<CheckVoorstel[]>("checks", {
      beschrijving: d.beschrijving,
      verduidelijking: d.verduidelijking,
      tool: d.tooladvies!.tool,
    });
    const r = content!.regelset;
    wijzig((x) => {
      const checks = { ...x.checks };
      const coachVoorstellen = { ...x.coachVoorstellen };
      for (const v of voorstellen ?? []) {
        const check = r.checks.find((c) => c.id === v.check);
        const voorstel = { voorstel: v.voorstel, zekerheid: v.zekerheid, vervolgvraag: v.vervolgvraag };
        // Nooit een keuze van de medewerker overschrijven.
        if (v.deelvraag) {
          coachVoorstellen[`${v.check}.${v.deelvraag}`] = voorstel;
          const huidig = checks[v.check];
          const perDeel = huidig && typeof huidig === "object" && !Array.isArray(huidig) ? { ...huidig } : {};
          perDeel[v.deelvraag] ??= v.voorstel;
          checks[v.check] = perDeel;
        } else {
          coachVoorstellen[v.check] = voorstel;
          checks[v.check] ??= check?.meerdere ? [v.voorstel] : v.voorstel;
        }
      }
      const naamVan = (v: CheckVoorstel) => {
        const check = r.checks.find((c) => c.id === v.check);
        const deel = check?.deelvragen.find((d) => d.id === v.deelvraag);
        return deel ? `${check?.naam} – ${deel.naam}` : check?.naam;
      };
      const vragen = (voorstellen ?? [])
        .filter((v) => v.vervolgvraag && v.zekerheid !== "hoog")
        .map((v) => `Over ${naamVan(v)}: ${v.vervolgvraag}`);
      const chat = vragen.length
        ? [...x.chat, { rol: "coach" as const, tekst: `Ik heb de checks alvast ingevuld. Bij een paar twijfel ik:\n${vragen.join("\n")}` }]
        : x.chat;
      return { ...x, checks, coachVoorstellen, checksVoorgesteld: true, chat };
    });
  }

  // ---------- Stappen ----------
  async function volgendeVanuit1() {
    const d = dataRef.current!;
    if (!d.beschrijving.trim()) {
      setFout("Beschrijf eerst wat je wilt bereiken.");
      return;
    }
    setFout(null);
    if (!d.verduidelijkingGevraagd) {
      const r = await coach<{ vragen: string[] }>("verduidelijk", { beschrijving: d.beschrijving });
      const vragen = r?.vragen ?? [];
      wijzig((x) => ({
        ...x,
        verduidelijkingGevraagd: true,
        verduidelijking: vragen.map((vraag) => ({ vraag, antwoord: "" })),
        chat: vragen.length ? [...x.chat, { rol: "coach", tekst: vragen.join("\n") }] : x.chat,
      }));
      if (vragen.length) {
        setTimeout(() => document.getElementById("verduidelijking-0")?.focus(), 50);
        return;
      }
    }
    gaNaar(2);
    if (!dataRef.current!.tooladvies) await vraagTooladvies([]);
  }

  async function volgendeVanuit2() {
    if (!dataRef.current!.tooladvies) {
      setFout("Kies eerst een tool.");
      return;
    }
    wijzig((d) => ({ ...d, tooladvies: { ...d.tooladvies!, geaccepteerd: true } }));
    gaNaar(3);
    if (!dataRef.current!.checksVoorgesteld) await vulChecksVoor();
  }

  async function bekijkAdvies() {
    const ontbreekt = ontbrekendeVelden(content!, dataRef.current!);
    if (ontbreekt.length) {
      setOntbrekend(new Set(ontbreekt.map(([id]) => id)));
      setFout("Nog niet alle vragen zijn beantwoord:");
      setFoutDetails(ontbreekt.map(([id, naam]) => `${id}|${naam}`));
      setTimeout(() => foutRef.current?.focus(), 30);
      return;
    }
    setOntbrekend(new Set());
    try {
      await bewaarNu();
      const r = await api<{ advies: AdviesDto }>("/api/advies", { body: { conceptId } });
      setAdvies(r.advies);
      gaNaar(4);
      const uitleg = await coach<string>("uitleg", { adviesId: r.advies.id });
      if (uitleg) zegCoach(uitleg);
    } catch (e) {
      setFout(e instanceof ApiFoutClient ? e.message : "Het advies kon niet worden berekend.");
      setFoutDetails(e instanceof ApiFoutClient && e.details ? e.details.map((d) => `|${d}`) : null);
      setTimeout(() => foutRef.current?.focus(), 30);
    }
  }

  async function voerActieUit() {
    if (!advies) return;
    setActieBezig(true);
    setActieFout(null);
    try {
      const r = await api<{ status: AdviesDto["status"] }>(`/api/advies/${advies.id}/actie`, { method: "POST" });
      setAdvies({ ...advies, status: r.status });
      setAfgerond(true); // het concept (met chat) is nu verwijderd
    } catch (e) {
      setActieFout(e instanceof ApiFoutClient ? e.message : "De aanvraag is niet gelukt. Probeer het opnieuw.");
    } finally {
      setActieBezig(false);
    }
  }

  /** Wizard afronden: gesprek opruimen en naar Mijn aanvragen, met een bevestiging. */
  async function afronden() {
    if (!advies) return;
    // Na een vervolgactie is het concept al verwijderd; bij "Niet op deze manier" ruimen we het hier op.
    if (conceptId && !afgerond) await api(`/api/concept/${conceptId}`, { method: "DELETE" }).catch(() => undefined);
    window.location.href = volledigPad(afgerondPad(advies.referentie));
  }

  async function opnieuwBeginnen() {
    if (!afgerond && !window.confirm("Weet je zeker dat je opnieuw wilt beginnen? Je antwoorden en het gesprek worden gewist. Een gegeven advies blijft in het register.")) return;
    if (conceptId && !afgerond) await api(`/api/concept/${conceptId}`, { method: "DELETE" }).catch(() => undefined);
    const { concept } = await api<{ concept: ConceptDto }>("/api/concept", { method: "POST" });
    window.history.replaceState(null, "", volledigPad(wizardPad(concept.id)));
    setVorige(null);
    setConceptId(concept.id);
    dataRef.current = concept.data;
    setData(concept.data);
    setAdvies(null);
    setAfgerond(false);
    setCoachWeg({});
    setFout(null);
    setTimeout(() => kopRef.current?.focus(), 30);
  }

  async function chat(tekst: string) {
    const d = dataRef.current!;
    const geschiedenis = d.chat.slice(-10);
    if (!afgerond) wijzig((x) => ({ ...x, chat: [...x.chat, { rol: "medewerker", tekst }] }));
    else setData((x) => x && { ...x, chat: [...x.chat, { rol: "medewerker", tekst }] });
    setChatBezig(true);
    let antwoord: string | null = null;
    try {
      const r = await api<{ resultaat: string | null }>("/api/coach/chat", {
        body: { vraag: tekst, stap: d.stap, beschrijving: d.beschrijving, tool: d.tooladvies?.tool, geschiedenis },
      });
      antwoord = r.resultaat;
    } catch {
      antwoord = null;
    }
    setChatBezig(false);
    const bericht = { rol: "coach" as const, tekst: antwoord ?? content!.teksten.coach_niet_beschikbaar };
    if (!afgerond) wijzig((x) => ({ ...x, chat: [...x.chat, bericht] }));
    else setData((x) => x && { ...x, chat: [...x.chat, bericht] });
  }

  // ---------- Weergave ----------
  if (laadFout) return <p className="foutmelding" role="alert">{laadFout}</p>;
  if (!content || !data) return <p role="status">Bezig met laden…</p>;

  const t = content.teksten;
  const stap = t.stappen.find((s) => s.nummer === data.stap)!;
  const bereikt = advies ? 4 : data.tooladvies?.geaccepteerd ? 3 : data.verduidelijkingGevraagd && data.beschrijving.trim() ? 2 : 1;
  const props = { content, data, wijzig, coachBezig };
  // Vóór de checks: eerst uitleg over fase 2 (één keer per idee).
  const toonFase2Uitleg = data.stap === 3 && !data.fase2UitlegGezien;

  return (
    <>
      <Stappenbalk teksten={t} huidig={data.stap} bereikt={afgerond ? 4 : bereikt} onKies={afgerond ? () => undefined : gaNaar} />
      {vorige && data.stap === 1 && !data.beschrijving.trim() && (
        <div className="info" role="status">
          <p style={{ margin: "0 0 0.5rem" }}>
            {t.onafgemaakt.melding.replace(
              "{beschrijving}",
              vorige.data.beschrijving.length > 80 ? `${vorige.data.beschrijving.slice(0, 80)}…` : vorige.data.beschrijving,
            )}
          </p>
          <a className="knop knop--secundair" href={volledigPad(wizardPad(vorige.id))}>{t.onafgemaakt.knop}</a>
        </div>
      )}
      {data.vorigAdviesId && data.stap < 4 && (
        <p className="info">Je past een eerder advies aan. Je vorige antwoorden zijn alvast ingevuld.</p>
      )}
      <div className="wizard">
        <div className="paneel">
          {data.stap < 4 && (
            <>
              <h1 ref={kopRef} tabIndex={-1}>
                <span className="sr-only">Stap {stap.nummer} van 4: </span>
                {toonFase2Uitleg ? t.fase2_uitleg.titel : stap.titel}
              </h1>
              {!toonFase2Uitleg && <p className="instructie">{stap.instructie}</p>}
              {data.stap === 3 && !toonFase2Uitleg && (
                <p>
                  <button
                    type="button"
                    className="knop knop--tekst"
                    onClick={() => {
                      wijzig((d) => ({ ...d, fase2UitlegGezien: false }));
                      setTimeout(() => kopRef.current?.focus(), 30);
                    }}
                  >
                    {t.fase2_uitleg.opnieuw_lezen}
                  </button>
                </p>
              )}
            </>
          )}

          {fout && (
            <div className="foutmelding" role="alert" tabIndex={-1} ref={foutRef}>
              <strong>{fout}</strong>
              {foutDetails && (
                <ul>
                  {foutDetails.map((d) => {
                    const [id, naam] = d.split("|");
                    return <li key={d}>{id ? <a href={`#veld-${id}`}>{naam}</a> : naam}</li>;
                  })}
                </ul>
              )}
            </div>
          )}

          {data.stap === 1 && <Stap1 {...props} fout={fout} />}
          {data.stap === 2 && (
            <Stap2
              {...props}
              coachNietBeschikbaar={!!coachWeg.tooladvies}
              onAnderAdvies={() => vraagTooladvies([...data.uitgeslotenTools, data.tooladvies!.tool])}
            />
          )}
          {data.stap === 3 && toonFase2Uitleg && <Fase2Uitleg content={content} />}
          {data.stap === 3 && !toonFase2Uitleg && (
            <Stap3 {...props} coachNietBeschikbaar={!!coachWeg.checks} ontbrekend={ontbrekend} />
          )}
          {data.stap === 4 && advies && (
            <Adviescard
              ref={adviesKopRef}
              advies={advies}
              content={content}
              onActie={voerActieUit}
              actieBezig={actieBezig}
              actieFout={actieFout}
              onVraag={() => document.getElementById(CHAT_INVOER_ID)?.focus()}
              onOpnieuw={opnieuwBeginnen}
              onAfronden={afronden}
            />
          )}

          <div className="knoppen knoppen--tussen">
            {data.stap > 1 && !afgerond ? (
              <button type="button" className="knop knop--secundair" onClick={() => gaNaar(data.stap - 1)} disabled={!!coachBezig}>
                ← Terug
              </button>
            ) : (
              <span />
            )}
            {data.stap === 1 && (
              <button type="button" className="knop" onClick={volgendeVanuit1} disabled={!!coachBezig}>
                {coachBezig === "verduidelijk" ? "Even geduld…" : "Volgende →"}
              </button>
            )}
            {data.stap === 2 && (
              <button type="button" className="knop" onClick={volgendeVanuit2} disabled={!!coachBezig || !data.tooladvies}>
                {data.tooladvies ? `${toolNaam(content, data.tooladvies.tool)} past, verder →` : "Volgende →"}
              </button>
            )}
            {data.stap === 3 && toonFase2Uitleg && (
              <button
                type="button"
                className="knop"
                onClick={() => {
                  wijzig((d) => ({ ...d, fase2UitlegGezien: true }));
                  setTimeout(() => kopRef.current?.focus(), 30);
                }}
              >
                {t.fase2_uitleg.knop} →
              </button>
            )}
            {data.stap === 3 && !toonFase2Uitleg && (
              <button type="button" className="knop" onClick={bekijkAdvies} disabled={!!coachBezig}>
                Bekijk het advies →
              </button>
            )}
          </div>
        </div>

        <Chatvenster berichten={data.chat} bezig={chatBezig} onVerstuur={chat} uitlegLink={t.hoe_werkt_het.link} />
      </div>
    </>
  );
}
