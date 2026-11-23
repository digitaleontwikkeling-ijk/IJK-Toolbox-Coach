"use client";
/**
 * Uitleg vóór fase 2 (na het tooladvies, vóór de checks): hoe de coach werkt, welke vragen
 * er komen en waarom, en wat er na de wizard gebeurt. Teksten uit content/teksten.yaml.
 */
import { kleurVan, type ContentDto } from "../client";

export function Fase2Uitleg({ content }: { content: ContentDto }) {
  const t = content.teksten.fase2_uitleg;
  const r = content.regelset;
  return (
    <div className="fase-uitleg">
      <p>{t.intro}</p>

      <h3>{t.hoe_titel}</h3>
      <ol>{t.hoe.map((h) => <li key={h}>{h}</li>)}</ol>

      <h3>{t.vragen_titel}</h3>
      <p>{t.vragen_intro}</p>
      <ol className="fase-uitleg__checks">
        {r.checks.map((c) => (
          <li key={c.id}>
            <strong>{c.naam}</strong>: {c.vraag.charAt(0).toLowerCase() + c.vraag.slice(1)}{" "}
            {t.waarom_per_check[c.id] && <span className="fase-uitleg__waarom">{t.waarom_per_check[c.id]}</span>}
          </li>
        ))}
      </ol>
      <p>{t.aanvullend}</p>

      <h3>{t.daarna_titel}</h3>
      <p>{t.daarna_intro}</p>
      <ul className="fase-uitleg__uitkomsten">
        {r.kleuren.map((k) => {
          const kleur = kleurVan(content, k.id)!;
          return (
            <li key={k.id}>
              <span className="badge-kleur" style={{ background: kleur.hex, color: kleur.tekstkleur }}>{k.uitkomst}</span>{" "}
              {t.per_vervolgactie[k.vervolgactie]}
            </li>
          );
        })}
      </ul>
      <p>{t.register}</p>
    </div>
  );
}
