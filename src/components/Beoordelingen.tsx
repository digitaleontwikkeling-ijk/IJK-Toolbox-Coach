"use client";
/**
 * Adviescard: de beoordelingen naast de Toolbox-uitkomst. Privacy (pre-DPIA), AI-risico en techniek en beheer,
 * elk met een tekstuele uitkomst (kleur is nooit de enige informatiedrager) en de antwoorden die meetelden,
 * inclusief herkomst (beantwoord of afgeleid). Alle teksten komen uit de content.
 */
import type { Feit } from "@/domain/verdieping";
import { alsLijst } from "./Keuze";
import type { AdviesDto, ContentDto } from "./client";

const JA_NEE: Record<string, string> = { ja: "Ja", nee: "Nee", weet_niet: "Weet ik niet zeker", onzeker: "Weet ik niet zeker" };

/** Leesbaar antwoord bij een feit (label uit de regelset, of ja/nee). */
function antwoordLabel(content: ContentDto, f: Pick<Feit, "id" | "waarde">): string {
  const g = content.regelset.gegevens.find((x) => x.id === f.id);
  return g?.antwoorden.find((a) => a.id === f.waarde)?.label ?? JA_NEE[f.waarde] ?? f.waarde;
}

/** "(beantwoord)" of "(afgeleid uit Autonomie: Beslissen (over mensen))" */
function Herkomst({ feit }: { feit: Feit }) {
  return <span className="herkomst"> ({feit.herkomst === "afgeleid" ? feit.toelichting : "jouw antwoord"})</span>;
}

/** Kort: alleen de uitkomst van de privacy- en AI-beoordeling (de toelichting staat onder "Meer over dit advies"). */
export function BeoordelingenKort({ advies, content }: { advies: AdviesDto; content: ContentDto }) {
  const t = content.teksten;
  const { dpia, aiRisico } = advies;
  if (!dpia || !aiRisico) return null;
  return (
    <ul className="beoordeling-kort">
      <li><strong>{t.privacy.titel}:</strong> {dpia.actief ? dpia.klasseNaam : "niet van toepassing"}</li>
      <li><strong>{t.ai.titel}:</strong> {aiRisico.actief ? aiRisico.klasseNaam : "niet van toepassing"}</li>
    </ul>
  );
}

export function Beoordelingen({ advies, content, kopNiveau = 3 }: { advies: AdviesDto; content: ContentDto; kopNiveau?: 3 | 4 }) {
  const Kop = kopNiveau === 4 ? "h4" : "h3";
  const t = content.teksten;
  const { dpia, aiRisico } = advies;
  // Adviezen van vóór regelset 0.8 hebben deze beoordelingen niet.
  if (!dpia || !aiRisico) return null;

  const feiten = advies.feiten ?? [];
  const aiFeiten = content.regelset.gegevens
    .filter((g) => g.spoor === "ai")
    .flatMap((g) => feiten.filter((f) => f.id === g.id).map((f) => ({ g, f })));

  // Techniek en beheer: punten bij de gekozen antwoorden van Systemen, Gebruikers en Afhankelijkheid.
  const techniek = Object.entries(t.techniek.punten).filter(([sleutel]) => {
    const [check, antwoord] = sleutel.split(".");
    return alsLijst(advies.antwoorden.checks[check!]).includes(antwoord!);
  });

  return (
    <>
      <section className="beoordeling" aria-labelledby="privacy-kop">
        <Kop id="privacy-kop">
          {t.privacy.titel}: {dpia.actief ? dpia.klasseNaam : "niet van toepassing"}
        </Kop>
        {!dpia.actief ? (
          <p>{t.privacy.niet_nodig}</p>
        ) : (
          <>
            <p>{t.privacy.per_klasse[dpia.klasse ?? ""]}</p>
            <p className="beoordeling__sub">{t.privacy.indicatoren_titel}</p>
            {dpia.indicatoren.some((i) => i.telt) ? (
              <ul>
                {dpia.indicatoren
                  .filter((i) => i.telt)
                  .map((i) => (
                    <li key={i.id}>
                      {i.naam}: {antwoordLabel(content, i.feit)}
                      <Herkomst feit={i.feit} />
                    </li>
                  ))}
              </ul>
            ) : (
              <p>{t.privacy.geen_indicatoren}</p>
            )}
          </>
        )}
      </section>

      <section className="beoordeling" aria-labelledby="ai-kop">
        <Kop id="ai-kop">
          {t.ai.titel}: {aiRisico.actief ? aiRisico.klasseNaam : "niet van toepassing"}
        </Kop>
        {!aiRisico.actief ? (
          <p>{t.ai.niet_nodig}</p>
        ) : (
          <>
            <p>{t.ai.per_klasse[aiRisico.klasse ?? ""]}</p>
            {aiRisico.redenen.length > 0 && (
              <>
                <p className="beoordeling__sub">{t.ai.redenen_titel}</p>
                <ul>
                  {aiRisico.redenen.map((r) => (
                    <li key={`${r.gegeven}-${r.antwoord}`}>
                      {r.naam}: {r.antwoordLabel}
                      <Herkomst feit={r.feit} />
                      {r.voorwaarde && <> Regel: {r.voorwaarde}</>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {aiFeiten.length > 0 && (
              <details>
                <summary>{t.ai.feiten_titel}</summary>
                <ul>
                  {aiFeiten.map(({ g, f }) => (
                    <li key={g.id}>
                      {g.naam}: {antwoordLabel(content, f)}
                      <Herkomst feit={f} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      {techniek.length > 0 && (
        <section className="beoordeling" aria-labelledby="techniek-kop">
          <Kop id="techniek-kop">{t.techniek.titel}</Kop>
          <p className="beoordeling__sub">{t.techniek.intro}</p>
          <ul>{techniek.map(([k, v]) => <li key={k}>{v}</li>)}</ul>
        </section>
      )}
    </>
  );
}
