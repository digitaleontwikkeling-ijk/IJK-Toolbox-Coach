"use client";
/** Hulpfuncties voor de browser: API-aanroepen en de content. */
import { useEffect, useState } from "react";
import { ANDERE_TOOL, type Regelset, type Spelregels, type Teksten, type ToolsConfig } from "@/domain/content-schema";
import type { AdviesRij } from "@/db/adviezen";
import { volledigPad } from "@/lib/paden";

export interface ContentDto {
  regelset: Regelset;
  tools: ToolsConfig;
  spelregels: Record<string, Spelregels>;
  teksten: Teksten;
  gebruiker: { naam: string; rollen: string[] };
}

/** Een advies zoals de API het teruggeeft (datums als tekst, zonder pseudoniem). */
export interface BesluitDto {
  toetserRol: string;
  besluit: "goedgekeurd" | "goedgekeurd_met_voorwaarden" | "afgewezen";
  toelichting: string | null;
  datum: string;
}

export type AdviesDto = Omit<AdviesRij, "pseudoniemId" | "aangemaaktOp" | "bijgewerktOp" | "verlooptOp"> & {
  aangemaaktOp: string;
  bijgewerktOp: string;
  verlooptOp: string;
  besluiten?: BesluitDto[];
  /** Alleen voor toetsers en beheerders. */
  pseudoniemId?: string;
  openRollen?: string[];
  eigenAanvraag?: boolean;
};

export function toetserNaam(c: ContentDto, rol: string): string {
  return c.regelset.toetsers.find((t) => t.id === rol)?.naam ?? rol;
}

export class ApiFoutClient extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: string[]) {
    super(message);
  }
}

export async function api<T>(pad: string, opties: { method?: string; body?: unknown } = {}): Promise<T> {
  // Letterlijke env-vergelijking: dan laat de bundler deze tak (en src/demo/) weg uit de echte app.
  if (process.env.NEXT_PUBLIC_DEMO === "1") {
    // Statische demo: de "server" draait in de browser (zie src/demo/).
    const { demoApi } = await import("@/demo/api");
    return demoApi<T>(pad, opties);
  }
  const res = await fetch(pad, {
    method: opties.method ?? (opties.body === undefined ? "GET" : "POST"),
    headers: opties.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opties.body === undefined ? undefined : JSON.stringify(opties.body),
  });
  if (res.status === 401) {
    window.location.href = volledigPad("/login");
    throw new ApiFoutClient(401, "Je bent niet ingelogd.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiFoutClient(res.status, json.fout ?? "Er ging iets mis.", json.details);
  return json as T;
}

let contentBelofte: Promise<ContentDto> | undefined;

export function useContent(): ContentDto | null {
  const [c, setC] = useState<ContentDto | null>(null);
  useEffect(() => {
    contentBelofte ??= api<ContentDto>("/api/content");
    contentBelofte.then(setC).catch(() => {
      contentBelofte = undefined;
    });
  }, []);
  return c;
}

export function toolNaam(c: ContentDto, id: string | undefined): string {
  return c.tools.tools.find((t) => t.id === id)?.naam ?? id ?? "";
}

/** Naam van de gekozen tool; bij een tool buiten de toolbox de naam die de medewerker opgaf. */
export function gekozenToolNaam(c: ContentDto, t: { tool: string; andereTool?: { naam: string } } | null | undefined): string {
  if (!t) return "";
  if (t.tool === ANDERE_TOOL) return t.andereTool?.naam.trim() || c.teksten.andere_tool.optie;
  return toolNaam(c, t.tool);
}

/** Naam met kenmerk, bijvoorbeeld "Notion (nog niet in de IJK Toolbox)". */
export function toolWeergave(c: ContentDto, t: { tool: string; andereTool?: { naam: string } }): string {
  const naam = gekozenToolNaam(c, t);
  return t.tool === ANDERE_TOOL ? `${naam} (${c.teksten.andere_tool.kenmerk})` : naam;
}

export function kleurVan(c: ContentDto, id: string) {
  return c.regelset.kleuren.find((k) => k.id === id);
}

/** Uitkomsten die toetsers alleen ter informatie zien (beide toetsers kijken mee, geen aanvraag). */
export function isTerInformatie(c: ContentDto, uitkomst: string): boolean {
  const k = kleurVan(c, uitkomst);
  return !!k && k.toetsers === "alle" && k.vervolgactie === "alleen_vastleggen";
}

export function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
