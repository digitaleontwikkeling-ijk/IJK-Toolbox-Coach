"use client";
import { Wizard } from "@/components/wizard/Wizard";
import { Bewaakt } from "../DemoOnderdelen";

export default function Pagina() {
  return <Bewaakt rollen={["medewerker"]}><Wizard /></Bewaakt>;
}
