export const ROLLEN = ["medewerker", "toetser_compliance", "toetser_architect", "beheerder"] as const;
export type Rol = (typeof ROLLEN)[number];

export const TOETSER_ROLLEN = ["toetser_compliance", "toetser_architect"] as const;

/**
 * Toetsers en beheerders dienen zelf geen aanvragen in: zij krijgen de rol medewerker niet automatisch.
 * (Keuze IJK: het kan in theorie, maar komt niet of nauwelijks voor.)
 */
export const ROLLEN_ZONDER_AANVRAGEN = [...TOETSER_ROLLEN, "beheerder"] as const;
export const dientGeenAanvragenIn = (r: string) => (ROLLEN_ZONDER_AANVRAGEN as readonly string[]).includes(r);
