/** Uitleg wat AI wel en niet doet in de tool. Teksten uit content/teksten.yaml (hoe_werkt_het). */
import type { Teksten } from "@/domain/content-schema";

export function HoeWerktHet({ t, isDemo = false }: { t: Teksten["hoe_werkt_het"]; isDemo?: boolean }) {
  return (
    <article className="uitleg">
      <h1>{t.titel}</h1>
      <p className="uitleg__intro">{t.intro}</p>
      {isDemo && <p className="info">{t.demo_melding}</p>}

      <section aria-labelledby="wie-titel">
        <h2 id="wie-titel">{t.wie_titel}</h2>
        <ol className="uitleg__stappen">
          {t.rijen.map((r) => (
            <li key={r.onderdeel} className="uitleg__stap">
              <h3>{r.onderdeel}</h3>
              <p className="uitleg__wie">{r.wie}</p>
              <p>{r.hoe}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="waarom-titel">
        <h2 id="waarom-titel">{t.waarom_titel}</h2>
        <ul>{t.waarom.map((w) => <li key={w}>{w}</li>)}</ul>
      </section>

      <section aria-labelledby="privacy-titel">
        <h2 id="privacy-titel">{t.privacy_titel}</h2>
        <ul>{t.privacy.map((w) => <li key={w}>{w}</li>)}</ul>
      </section>

      <section aria-labelledby="zonder-titel">
        <h2 id="zonder-titel">{t.zonder_ai_titel}</h2>
        <p>{t.zonder_ai}</p>
      </section>
    </article>
  );
}

/** Link naar de uitleg; opent in een nieuw tabblad, zodat je de wizard niet verlaat. */
export function HoeWerktHetLink({ tekst, href }: { tekst: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener">
      {tekst}
      <span className="sr-only"> (opent in een nieuw tabblad)</span>
    </a>
  );
}
