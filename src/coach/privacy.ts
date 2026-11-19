/**
 * Dataminimalisatie: haalt herkenbare contactgegevens uit tekst voordat die naar de
 * coach gaat. Dit is een vangnet, geen garantie: de interface vraagt medewerkers
 * ook om geen namen of persoonsgegevens te gebruiken.
 */
const PATRONEN: [RegExp, string][] = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-mailadres verwijderd]"],
  [/\bNL\d{2}\s?[A-Z]{4}(?:\s?\d{4}){2}\s?\d{2}\b/gi, "[IBAN verwijderd]"],
  [/(?:\+31|0031|\b0)[\s-]?(?:\d[\s-]?){9}\b/g, "[telefoonnummer verwijderd]"],
  [/\b\d{9}\b/g, "[nummer verwijderd]"], // o.a. BSN
];

export function verwijderContactgegevens(tekst: string): string {
  return PATRONEN.reduce((t, [patroon, vervanging]) => t.replace(patroon, vervanging), tekst);
}
