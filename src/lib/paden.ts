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

export const adviesPad = (id: string) => (IS_DEMO ? `/advies/?id=${id}` : `/advies/${id}`);
export const toetsingPad = (id: string) => (IS_DEMO ? `/toetsing/advies/?id=${id}` : `/toetsing/${id}`);
export const beheerAdviesPad = (id: string) => (IS_DEMO ? `/beheer/advies/?id=${id}` : `/beheer/advies/${id}`);
