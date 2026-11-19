"use client";
import { AdviesInzage } from "@/components/AdviesInzage";
import { Bewaakt, MetId } from "../../DemoOnderdelen";

export default function Pagina() {
  return (
    <Bewaakt rollen={["beheerder"]}>
      <MetId kind={(id) => <AdviesInzage id={id} modus="beheer" />} />
    </Bewaakt>
  );
}
