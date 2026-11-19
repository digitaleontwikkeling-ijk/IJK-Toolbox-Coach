/** Haalt het pseudoniem weg voordat een advies naar de browser gaat: de interface heeft het niet nodig. */
export function zonderPseudoniem<T extends { pseudoniemId: string }>(a: T): Omit<T, "pseudoniemId"> {
  const { pseudoniemId: _, ...rest } = a;
  return rest;
}
