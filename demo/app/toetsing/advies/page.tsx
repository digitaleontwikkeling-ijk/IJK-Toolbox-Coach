"use client";
import { AdviesInzage } from "@/components/AdviesInzage";
import { Bewaakt, MetId } from "../../DemoOnderdelen";

export default function Pagina() {
  return (
    <Bewaakt rollen={["toetser_compliance", "toetser_architect"]}>
      <MetId kind={(id) => <AdviesInzage id={id} modus="toetsing" />} />
    </Bewaakt>
  );
}
