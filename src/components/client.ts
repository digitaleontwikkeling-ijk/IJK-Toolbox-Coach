"use client";
/** Hulpfuncties voor de browser: API-aanroepen en de content. */
import { useEffect, useState } from "react";
import type { Regelset, Spelregels, Teksten, ToolsConfig } from "@/domain/content-schema";
import type { AdviesRij } from "@/db/adviezen";

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
  const res = await fetch(pad, {
    method: opties.method ?? (opties.body === undefined ? "GET" : "POST"),
    headers: opties.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opties.body === undefined ? undefined : JSON.stringify(opties.body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
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

export function kleurVan(c: ContentDto, id: string) {
  return c.regelset.kleuren.find((k) => k.id === id);
}

export function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
