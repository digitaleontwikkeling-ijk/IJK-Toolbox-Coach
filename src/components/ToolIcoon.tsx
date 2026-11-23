"use client";
import type { ContentDto } from "./client";

/**
 * Logo van een tool uit de IJK Toolbox. Decoratief (alt=""): de naam van de tool staat er altijd naast.
 * Geen logo ingesteld (of een tool buiten de toolbox)? Dan niets.
 */
export function ToolIcoon({ content, tool, groot = false }: { content: ContentDto; tool: string | undefined; groot?: boolean }) {
  const src = tool ? content.iconen?.[tool] : undefined;
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- data-URI uit de content; werkt ook in de statische demo
  return <img src={src} alt="" className={`tool-icoon${groot ? " tool-icoon--groot" : ""}`} />;
}
