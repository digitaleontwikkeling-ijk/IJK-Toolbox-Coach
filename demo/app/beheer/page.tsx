"use client";
import { AdviezenLijst } from "@/components/AdviezenLijst";
import { BeheerContent } from "@/components/BeheerContent";
import content from "@/demo/content.generated.json";
import { Bewaakt } from "../DemoOnderdelen";

export default function Pagina() {
  const t = content.teksten.beheer;
  return (
    <Bewaakt rollen={["beheerder"]}>
      <h1>{t.titel}</h1>
      <p className="instructie">{t.intro}</p>
      <AdviezenLijst modus="beheer" />
      <section aria-labelledby="inhoud-titel" style={{ marginTop: "2rem" }}>
        <h2 id="inhoud-titel">Inhoud van de coach</h2>
        <BeheerContent />
      </section>
    </Bewaakt>
  );
}
