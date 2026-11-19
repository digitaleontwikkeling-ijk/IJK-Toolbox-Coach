"use client";
import type { ContentDto } from "./client";

export function Spelregels({ content, tool }: { content: ContentDto; tool: string }) {
  const regels = content.spelregels[tool];
  if (!regels) return null;
  const k = content.teksten.spelregels_kopjes;
  const lijst = (titel: string, items: string[]) => (
    <div>
      <h4>{titel}</h4>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
  return (
    <div className="spelregels">
      {lijst(k.zelf_doen, regels.zelf_doen)}
      {lijst(k.eerst_toetsen, regels.eerst_toetsen)}
      {lijst(k.altijd, regels.altijd)}
    </div>
  );
}
