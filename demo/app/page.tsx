"use client";
import { useEffect } from "react";
import { demoGebruiker } from "@/demo/api";
import { volledigPad } from "@/lib/paden";

export default function Start() {
  useEffect(() => {
    window.location.replace(volledigPad(demoGebruiker() ? "/wizard/" : "/login/"));
  }, []);
  return <p role="status">Bezig met laden…</p>;
}
