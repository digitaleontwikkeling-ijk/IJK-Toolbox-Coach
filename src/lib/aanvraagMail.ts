/**
 * E-mail voor een licentie- of accountaanvraag: een mailto-link naar de beheerder van de tool (tools.yaml),
 * met het onderwerp "Aanvraag licentie <tool> - <naam aanvrager>" en een korte tekst. De medewerker verstuurt de mail
 * zelf vanuit zijn eigen mailprogramma (bij IJK: Outlook). Er gaat niets naar de coach; de naam blijft in de browser.
 */
export interface AanvraagMailInvoer {
  aan: string;
  tool: string;
  naam: string;
  referentie: string;
  uitkomst: string;
  voorwaarden: string[];
  link: string;
  onderwerp: string; // sjabloon met {tool} en {naam}
  tekst: string; // sjabloon met {tool}, {referentie}, {uitkomst}, {voorwaarden}, {link}, {naam}
}

export function aanvraagMailto(m: AanvraagMailInvoer): string {
  const vul = (s: string) =>
    s
      .replaceAll("{tool}", m.tool)
      .replaceAll("{naam}", m.naam)
      .replaceAll("{referentie}", m.referentie)
      .replaceAll("{uitkomst}", m.uitkomst)
      .replaceAll("{voorwaarden}", m.voorwaarden.length ? m.voorwaarden.map((v) => `- ${v}`).join("\n") : "-")
      .replaceAll("{link}", m.link);
  // mailto: spaties als %20 (niet +), regels als %0D%0A; zo tonen Outlook en andere mailprogramma's het goed.
  const enc = (s: string) => encodeURIComponent(s).replace(/%0A/g, "%0D%0A");
  return `mailto:${m.aan}?subject=${enc(vul(m.onderwerp))}&body=${enc(vul(m.tekst))}`;
}

/** Opent het mailprogramma. In een iframe (Teams) via een nieuw venster, anders in hetzelfde venster. */
export function openMail(mailto: string) {
  try {
    if (window.self !== window.top) {
      window.open(mailto, "_blank", "noopener");
      return;
    }
  } catch {
    // Geen toegang tot window.top: ook een iframe.
    window.open(mailto, "_blank", "noopener");
    return;
  }
  window.location.href = mailto;
}
