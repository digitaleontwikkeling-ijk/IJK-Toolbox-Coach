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
import { ANDERE_TOOL } from "@/domain/content-schema";
import { geldigeLink } from "@/domain/wizard";
import { Beoordelingen } from "./Beoordelingen";
import { ToolIcoon } from "./ToolIcoon";
import { datum, kleurVan, toetserNaam, toolWeergave, type AdviesDto, type ContentDto } from "./client";

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
  /** In het gesprek: de coach praat zelf (ik-vorm). */
  ikVorm?: boolean;
  /** "medewerker" (standaard) toont de vervolgactie; "inzage" is voor toetsers en beheerders. */
  weergave?: "medewerker" | "inzage";
}

export const Adviescard = forwardRef<HTMLHeadingElement, Props>(function Adviescard(
  { advies, content, onActie, actieBezig, onVraag, onOpnieuw, onAfronden, actieFout, weergave = "medewerker", ikVorm = false },
  kopRef,
) {
  const kleur = kleurVan(content, advies.uitkomst)!;
  const t = content.teksten;
  const r = content.regelset;
  const tool = toolWeergave(content, advies.tooladvies);
  const andere = advies.tooladvies.tool === ANDERE_TOOL ? advies.tooladvies.andereTool : undefined;
  const link = andere?.link?.trim() && geldigeLink(andere.link) ? andere.link.trim() : null;
  const actie = t.vervolgacties[kleur.vervolgactie];
  const toetserNamen = advies.toetsers.map((id) => r.toetsers.find((x) => x.id === id)?.naam ?? id);
  const vlaggenJa = r.rode_vlaggen.filter((v) => advies.rodeVlaggen[v.id] === true);
  const vlaggenOnzeker = r.rode_vlaggen.filter((v) => advies.rodeVlaggen[v.id] === "onzeker");
  // Rood zonder alternatief: Team DO neemt contact op. Mislukte de melding, dan kan het opnieuw.
  const contactNodig = kleur.contact_als_geen_alternatief && kleur.vervolgactie === "alleen_vastleggen" && advies.alternatieven.length === 0;
  const contactOpnieuw = contactNodig && advies.status === "advies_gegeven";
  const actieKanNog = advies.status === "advies_gegeven" && (actie?.knop || contactOpnieuw);
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
          <p><ToolIcoon content={content} tool={advies.tooladvies.tool} /><strong>{tool}</strong>{advies.tooladvies.motivatie ? ` — ${advies.tooladvies.motivatie}` : ""}</p>
          {link && (
            <p className="hulptekst" style={{ margin: 0, overflowWrap: "anywhere" }}>
              Link: <a href={link} rel="noopener noreferrer nofollow" target="_blank">{link}</a>
            </p>
          )}
        </section>

        <section>
          <h3>Waarom deze kleur?</h3>
          <p>{advies.motivatie}</p>
          <p className="hulptekst" style={{ margin: 0 }}>
            {ikVorm ? t.gesprek.kleur_hint : t.hoe_werkt_het.kleur_hint}{" "}
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

        <Beoordelingen advies={advies} content={content} />

        {toetserNamen.length > 0 && (
          <section>
            <h3>{kleur.vervolgactie === "toetsing" ? "Wie toetst?" : "Wie kijkt mee?"}</h3>
            <ul>{toetserNamen.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
        )}

        <p className="disclaimer">{t.disclaimer}</p>

        <section>
          <h3>{weergave === "inzage" ? "Antwoorden" : "Je antwoorden"}</h3>
          <table className="antwoorden">
            <caption className="sr-only">Antwoorden per check en op de aanvullende vragen</caption>
            <tbody>
              {r.checks.map((c) => {
                const ruw = advies.antwoorden.checks[c.id];
                const badge = (id: string | undefined, voor?: string) => {
                  const a = c.antwoorden.find((x) => x.id === id);
                  if (!a) return <div key={voor ?? "leeg"}>{voor ? `${voor}: ` : ""}—</div>;
                  const ak = kleurVan(content, a.kleur)!;
                  return (
                    <div key={voor ?? a.id}>
                      {voor && <>{voor}: </>}
                      {a.label}{" "}
                      <span className="badge-kleur" style={{ background: ak.hex, color: ak.tekstkleur }}>{ak.id}</span>
                    </div>
                  );
                };
                const perDeel = ruw && typeof ruw === "object" && !Array.isArray(ruw) ? ruw : {};
                const ids = alsLijst(ruw);
                return (
                  <tr key={c.id}>
                    <th scope="row">{c.nummer}. {c.naam}</th>
                    <td>
                      {c.deelvragen.length > 0
                        ? c.deelvragen.map((d) => badge(perDeel[d.id], d.naam))
                        : ids.length === 0
                          ? "—"
                          : c.antwoorden.filter((x) => ids.includes(x.id)).map((a) => badge(a.id))}
                    </td>
                  </tr>
                );
              })}
              {r.extra_vragen
                .filter((e) => e.id in advies.antwoorden.extraVragen)
                .map((e) => (
                  <tr key={e.id}>
                    <th scope="row">{e.vraag}</th>
                    <td>
                      {advies.antwoorden.extraVragen[e.id] === "onzeker"
                        ? "Weet ik niet zeker"
                        : advies.antwoorden.extraVragen[e.id]
                          ? "Ja"
                          : "Nee"}
                    </td>
                  </tr>
                ))}
              {r.gegevens
                .filter((g) => advies.antwoorden.verdieping?.[g.id] !== undefined)
                .map((g) => (
                  <tr key={g.id}>
                    <th scope="row">{g.vraag}</th>
                    <td>{g.antwoorden.find((x) => x.id === advies.antwoorden.verdieping![g.id])?.label ?? "—"}</td>
                  </tr>
                ))}
              <tr>
                <th scope="row">{t.aanvullende_vragen.titel}</th>
                <td>
                  {vlaggenJa.length || vlaggenOnzeker.length
                    ? [...vlaggenJa.map((v) => `Ja: ${v.kort}`), ...vlaggenOnzeker.map((v) => `Weet ik niet zeker: ${v.kort}`)].join("; ")
                    : t.aanvullende_vragen.geen}
                </td>
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
              <>
                <p>{(ikVorm && t.gesprek.vervolgactie_uitleg[kleur.vervolgactie]) || actie?.uitleg}</p>
                {contactOpnieuw && <p className="foutmelding">{t.contact_opnieuw.melding}</p>}
              </>
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
                {contactOpnieuw ? t.contact_opnieuw.knop : actie!.knop.replace("{tool}", tool)}
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
