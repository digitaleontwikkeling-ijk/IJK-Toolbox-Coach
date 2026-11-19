/**
 * Fictieve testgebruikers voor de nep-login (proof of concept).
 * Het "oid" bootst het Entra-object-ID na. Namen worden alleen in de sessiecookie
 * getoond en nooit opgeslagen of naar de coach gestuurd.
 */
import type { Rol } from "./rollen";

export interface Testgebruiker {
  oid: string;
  naam: string;
  rollen: Rol[];
}

export const TESTGEBRUIKERS: Testgebruiker[] = [
  { oid: "test-0001", naam: "Testmedewerker Anna", rollen: ["medewerker"] },
  { oid: "test-0002", naam: "Testmedewerker Bram", rollen: ["medewerker"] },
  { oid: "test-0003", naam: "Testtoetser Compliance", rollen: ["medewerker", "toetser_compliance"] },
  { oid: "test-0004", naam: "Testtoetser Architect", rollen: ["medewerker", "toetser_architect"] },
  { oid: "test-0005", naam: "Testbeheerder", rollen: ["medewerker", "beheerder"] },
];
