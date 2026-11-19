"use client";
import { AdviesPagina } from "@/components/AdviesPagina";
import { Bewaakt, MetId } from "../DemoOnderdelen";

export default function Pagina() {
  return <Bewaakt rollen={["medewerker"]}><MetId kind={(id) => <AdviesPagina id={id} />} /></Bewaakt>;
}
