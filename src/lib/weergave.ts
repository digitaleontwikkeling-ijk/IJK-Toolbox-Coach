/**
 * Voor de medewerker zelf: haalt het pseudoniem en de opgeslagen naam/e-mail weg voordat een advies naar de
 * browser gaat. De interface heeft ze niet nodig.
 */
export function zonderPseudoniem<T extends { pseudoniemId: string; aanvrager?: unknown }>(a: T): Omit<T, "pseudoniemId" | "aanvrager"> {
  const { pseudoniemId: _, aanvrager: __, ...rest } = a;
  return rest;
}
