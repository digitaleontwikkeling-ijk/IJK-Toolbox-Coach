"use client";
import { useEffect } from "react";
import { demoGebruiker } from "@/demo/api";
import { startPad, volledigPad } from "@/lib/paden";

export default function Start() {
  useEffect(() => {
    const g = demoGebruiker();
    window.location.replace(volledigPad(g ? `${startPad(g.rollen)}/` : "/login/"));
  }, []);
  return <p role="status">Bezig met laden…</p>;
}
