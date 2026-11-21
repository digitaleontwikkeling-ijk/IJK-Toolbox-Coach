/**
 * Paden in de interface. Normaal draait de app op de root van een domein.
 * De statische demo (GitHub Pages) draait onder een basispad en gebruikt
 * ?id= in plaats van dynamische paden.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
const BASIS = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Voor window.location (Next.js-links voegen het basispad zelf toe). */
export function volledigPad(pad: string): string {
  return `${BASIS}${pad}`;
}

/**
 * Startpagina na het inloggen: toetsers beginnen bij hun toetsing, beheerders bij beheer,
 * alle anderen in de wizard. (Toetsers en beheerders zijn ook medewerker.)
 */
export function startPad(rollen: readonly string[]): string {
  if (rollen.some((r) => r.startsWith("toetser_"))) return "/toetsing";
  if (rollen.includes("beheerder")) return "/beheer";
  return "/wizard";
}

/** "Mijn aanvragen" met een bevestiging dat dit advies is afgerond. */
export const afgerondPad = (referentie: string) =>
  `${IS_DEMO ? "/mijn-aanvragen/" : "/mijn-aanvragen"}?afgerond=${encodeURIComponent(referentie)}`;

/** Uitlegpagina, voor gewone <a>-links (inclusief basispad en, in de demo, slash). */
export const hoeWerktHetHref = () => volledigPad(IS_DEMO ? "/hoe-werkt-het/" : "/hoe-werkt-het");

export const adviesPad = (id: string) => (IS_DEMO ? `/advies/?id=${id}` : `/advies/${id}`);
export const toetsingPad = (id: string) => (IS_DEMO ? `/toetsing/advies/?id=${id}` : `/toetsing/${id}`);
export const beheerAdviesPad = (id: string) => (IS_DEMO ? `/beheer/advies/?id=${id}` : `/beheer/advies/${id}`);
