"use client";
import { MijnAanvragen } from "@/components/MijnAanvragen";
import { Bewaakt } from "../DemoOnderdelen";

export default function Pagina() {
  return <Bewaakt rollen={["medewerker"]}><MijnAanvragen /></Bewaakt>;
}
