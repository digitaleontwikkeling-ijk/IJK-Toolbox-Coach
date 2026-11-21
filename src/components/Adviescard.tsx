"use client";
/**
 * De adviescard. Alle inhoud komt uit het vastgelegde advies (berekend met de
 * beslisregels) en de content. Kleur is nooit de enige drager van betekenis:
 * de naam van de uitkomst staat er altijd bij.
 */
import { forwardRef } from "react";
import { alsLijst } from "./Keuze";
import { HoeWerktHetLink } from "./HoeWerktHet";
import { hoeWerktHetHref } from "@/lib/paden";
import { datum, kleurVan, toetserNaam, toolNaam, type AdviesDto, type ContentDto } from "./client";

interface Props {
  advies: AdviesDto;
  content: ContentDto;
  onActie?: () => void;
  actieBezig?: boolean;
  onVraag?: () => void;
  onOpnieuw?: () => void;
  /** Wizard afronden; alleen getoond als er geen vervolgactie meer openstaat. */
  onAfronden?: () => void;
  actieFout?: string | null;
  /** "medewerker" (standaard) toont de vervolgactie; "inzage" is voor toetsers en beheerders. */
  weergave?: "medewerker" | "inzage";
}

export const Adviescard = forwardRef<HTMLHeadingElement, Props>(function Adviescard(
  { advies, content, onActie, actieBezig, onVraag, onOpnieuw, onAfronden, actieFout, weergave = "medewerker" },
  kopRef,
) {
  const kleur = kleurVan(content, advies.uitkomst)!;
  const t = content.teksten;
  const r = content.regelset;
  const tool = toolNaam(content, advies.tooladvies.tool);
  const actie = t.vervolgacties[kleur.vervolgactie];
  const toetserNamen = advies.toetsers.map((id) => r.toetsers.find((x) => x.id === id)?.naam ?? id);
  const vlaggenJa = r.rode_vlaggen.filter((v) => advies.rodeVlaggen[v.id]);
  const actieKanNog = advies.status === "advies_gegeven" && actie?.knop;
  // Klaar = geen vervolgactie meer open: al uitgevoerd, of bij deze uitkomst hoort er geen.
  const klaar = !actieKanNog;

  return (
    <article className="adviescard" aria-labelledby="advies-kop">
      <div className="adviescard__kop" style={{ background: kleur.hex, color: kleur.tekstkleur }}>
        <span className="adviescard__hex" aria-hidden="true" />
        <div>
          <div className="adviescard__kleur">Uitkomst: {kleur.id}</div>
          <h2 id="advies-kop" ref={kopRef} tabIndex={-1}>{kleur.uitkomst}</h2>
        </div>
      </div>

      <div className="adviescard__inhoud">
        <section>
          <h3>Tooladvies</h3>
          <p><strong>{tool}</strong>{advies.tooladvies.motivatie ? ` — ${advies.tooladvies.motivatie}` : ""}</p>
        </section>

        <section>
          <h3>Waarom deze kleur?</h3>
          <p>{advies.motivatie}</p>
          <p className="hulptekst" style={{ margin: 0 }}>
            {t.hoe_werkt_het.kleur_hint}{" "}
            <HoeWerktHetLink tekst={t.hoe_werkt_het.link} href={hoeWerktHetHref()} />
          </p>
        </section>

        {advies.voorwaarden.length > 0 && (
          <section>
            <h3>Voorwaarden</h3>
            <ul>{advies.voorwaarden.map((v) => <li key={v}>{v}</li>)}</ul>
          </section>
        )}

        {advies.alternatieven.length > 0 && (
          <section>
            <h3>Zo kan het wel</h3>
            <ul>{advies.alternatieven.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>
        )}

        {toetserNamen.length > 0 && (
          <section>
            <h3>Wie toetst?</h3>
            <ul>{toetserNamen.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
        )}

        {advies.dpiaSignaal && (
          <section className="info" style={{ margin: 0 }}>
            <h3>{t.dpia.titel}</h3>
            <p style={{ margin: 0 }}>{t.dpia.uitleg}</p>
          </section>
        )}

        <section>
          <h3>{weergave === "inzage" ? "Antwoorden" : "Je antwoorden"}</h3>
          <table className="antwoorden">
            <caption className="sr-only">Antwoorden per check en op de aanvullende vragen</caption>
            <tbody>
              {r.checks.map((c) => {
                const ids = alsLijst(advies.antwoorden.checks[c.id]);
                const gekozen = c.antwoorden.filter((x) => ids.includes(x.id));
                return (
                  <tr key={c.id}>
                    <th scope="row">{c.nummer}. {c.naam}</th>
                    <td>
                      {gekozen.length === 0 && "—"}
                      {gekozen.map((a) => {
                        const ak = kleurVan(content, a.kleur)!;
                        return (
                          <div key={a.id}>
                            {a.label}{" "}
                            <span className="badge-kleur" style={{ background: ak.hex, color: ak.tekstkleur }}>{ak.id}</span>
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                );
              })}
              {r.extra_vragen
                .filter((e) => e.id in advies.antwoorden.extraVragen)
                .map((e) => (
                  <tr key={e.id}>
                    <th scope="row">{e.vraag}</th>
                    <td>{advies.antwoorden.extraVragen[e.id] ? "Ja" : "Nee"}</td>
                  </tr>
                ))}
              <tr>
                <th scope="row">{t.aanvullende_vragen.titel}</th>
                <td>{vlaggenJa.length ? vlaggenJa.map((v) => `Ja: ${v.kort}`).join("; ") : t.aanvullende_vragen.geen}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {advies.besluiten && advies.besluiten.length > 0 && (
          <section>
            <h3>Besluiten van de toetsers</h3>
            <ul>
              {advies.besluiten.map((b) => (
                <li key={b.toetserRol}>
                  <strong>{toetserNaam(content, b.toetserRol)}</strong>: {t.besluiten[b.besluit]} ({datum(b.datum)})
                  {b.toelichting && <><br />{b.toelichting}</>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {weergave === "inzage" ? (
          <section>
            <h3>Status</h3>
            <p>{t.statussen[advies.status]}</p>
          </section>
        ) : (
        <section>
          <h3>Wat nu?</h3>
          {/* aria-live: na het indienen hoort een schermlezer meteen wat er is gebeurd. */}
          <div aria-live="polite">
            {advies.status === "advies_gegeven" ? (
              <p>{actie?.uitleg}</p>
            ) : (
              <>
                <p className="info" style={{ margin: "0 0 0.75rem" }}>
                  <strong>Status: {t.statussen[advies.status]}.</strong>{" "}
                  {t.na_actie[advies.status as keyof typeof t.na_actie]
                    .replace("{tool}", tool)
                    .replace("{toetsers}", toetserNamen.join(" en ") || "de toetsers")}
                </p>
              </>
            )}
          </div>
          {actieFout && <p className="foutmelding" role="alert">{actieFout}</p>}
          <div className="knoppen">
            {actieKanNog && onActie && (
              <button type="button" className="knop" onClick={onActie} disabled={actieBezig}>
                {actie.knop.replace("{tool}", tool)}
              </button>
            )}
            {klaar && onAfronden && (
              <button type="button" className="knop" onClick={onAfronden}>{t.afronden.knop}</button>
            )}
            {onVraag && <button type="button" className="knop knop--secundair" onClick={onVraag}>Vraag stellen</button>}
            {onOpnieuw && (
              <button type="button" className="knop knop--secundair" onClick={onOpnieuw}>
                {advies.status === "advies_gegeven" ? "Opnieuw beginnen" : "Nieuw idee"}
              </button>
            )}
          </div>
        </section>
        )}
      </div>

      <footer className="adviescard__voet">
        Referentienummer <strong>{advies.referentie}</strong>. Dit advies staat in het adviesregister (regelversie{" "}
        {advies.regelversie}).
      </footer>
    </article>
  );
});
