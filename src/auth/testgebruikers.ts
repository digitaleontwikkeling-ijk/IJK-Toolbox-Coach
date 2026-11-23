/**
 * Fictieve testgebruikers voor de nep-login (proof of concept).
 * Het "oid" bootst het Entra-object-ID na. Naam en e-mail worden bij een advies opgeslagen
 * (zichtbaar voor toetsers en beheerders), maar nooit naar de coach gestuurd.
 */
import type { Rol } from "./rollen";

export interface Testgebruiker {
  oid: string;
  naam: string;
  /** Fictief; alleen meegestuurd met acties als ACTIE_STUUR_UPN=true. */
  upn: string;
  rollen: Rol[];
}

export const TESTGEBRUIKERS: Testgebruiker[] = [
  { oid: "test-0001", upn: "anna@voorbeeld.invalid", naam: "Testmedewerker Anna", rollen: ["medewerker"] },
  { oid: "test-0002", upn: "bram@voorbeeld.invalid", naam: "Testmedewerker Bram", rollen: ["medewerker"] },
  { oid: "test-0003", upn: "compliance@voorbeeld.invalid", naam: "Testtoetser Compliance", rollen: ["toetser_compliance"] },
  { oid: "test-0004", upn: "architect@voorbeeld.invalid", naam: "Testtoetser Architect", rollen: ["toetser_architect"] },
  { oid: "test-0006", upn: "chris@voorbeeld.invalid", naam: "Testmedewerker Chris", rollen: ["medewerker"] },
  { oid: "test-0005", upn: "beheer@voorbeeld.invalid", naam: "Testbeheerder", rollen: ["beheerder"] },
];
