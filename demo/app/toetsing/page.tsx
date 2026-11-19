"use client";
import { AdviezenLijst } from "@/components/AdviezenLijst";
import content from "@/demo/content.generated.json";
import { Bewaakt } from "../DemoOnderdelen";

export default function Pagina() {
  const t = content.teksten.toetsing;
  return (
    <Bewaakt rollen={["toetser_compliance", "toetser_architect"]}>
      <h1>{t.titel}</h1>
      <p className="instructie">{t.intro}</p>
      <AdviezenLijst modus="toetsing" />
    </Bewaakt>
  );
}
