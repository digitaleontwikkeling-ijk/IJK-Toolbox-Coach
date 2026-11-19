"use client";
/** Onderdelen die alleen de statische demo gebruikt. */
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { Rol } from "@/auth/rollen";
import { Kop } from "@/components/Kop";
import { GeenToegang } from "@/components/GeenToegang";
import { demoGebruiker, resetDemo } from "@/demo/api";
import { volledigPad } from "@/lib/paden";

export function DemoKop() {
  const [g, setG] = useState<ReturnType<typeof demoGebruiker>>(null);
  useEffect(() => setG(demoGebruiker()), []);
  return <Kop appNaam="IJK Toolbox Coach" gebruiker={g ? { naam: g.naam, rollen: g.rollen } : null} />;
}

export function DemoMelding() {
  return (
    <div className="melding-testdata">
      <strong>Demo (proof of concept).</strong> Alles blijft in je eigen browser: geen server, geen AI (oefencoach), geen
      echte aanvragen. Gebruik alleen fictieve voorbeelden.{" "}
      <button
        type="button"
        className="knop--tekst"
        style={{ background: "none", border: 0, color: "var(--water)", textDecoration: "underline", cursor: "pointer", font: "inherit" }}
        onClick={() => {
          resetDemo();
          window.location.href = volledigPad("/login/");
        }}
      >
        Demo leegmaken
      </button>
    </div>
  );
}

/** Toont de inhoud alleen voor een ingelogde demo-gebruiker met één van de rollen. */
export function Bewaakt({ rollen, children }: { rollen: Rol[]; children: ReactNode }) {
  const [staat, setStaat] = useState<"laden" | "ok" | "geen-toegang">("laden");
  useEffect(() => {
    const g = demoGebruiker();
    if (!g) {
      window.location.replace(volledigPad("/login/"));
      return;
    }
    setStaat(g.rollen.some((r) => rollen.includes(r)) ? "ok" : "geen-toegang");
  }, [rollen]);
  if (staat === "laden") return <p role="status">Bezig met laden…</p>;
  if (staat === "geen-toegang") return <GeenToegang />;
  return <>{children}</>;
}

/** Leest ?id= uit de adresbalk (statische hosting kent geen dynamische paden). */
export function MetId({ kind }: { kind: (id: string) => ReactNode }) {
  return (
    <Suspense fallback={<p role="status">Bezig met laden…</p>}>
      <IdLezer kind={kind} />
    </Suspense>
  );
}
function IdLezer({ kind }: { kind: (id: string) => ReactNode }) {
  const id = useSearchParams().get("id") ?? "";
  return <>{kind(id)}</>;
}
