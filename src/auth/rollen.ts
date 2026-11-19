export const ROLLEN = ["medewerker", "toetser_compliance", "toetser_architect", "beheerder"] as const;
export type Rol = (typeof ROLLEN)[number];

export const TOETSER_ROLLEN = ["toetser_compliance", "toetser_architect"] as const;
