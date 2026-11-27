"use client";
import { AdviezenLijst } from "@/components/AdviezenLijst";
import { BeheerAdviesregels } from "@/components/BeheerAdviesregels";
import { BeheerContent } from "@/components/BeheerContent";
import { BeheerMailsjablonen } from "@/components/BeheerMailsjablonen";
import content from "@/demo/content.generated.json";
import { Bewaakt } from "../DemoOnderdelen";

export default function Pagina() {
  const t = content.teksten.beheer;
  return (
    <Bewaakt rollen={["beheerder"]}>
      <h1>{t.titel}</h1>
      <p className="instructie">{t.intro}</p>
      <AdviezenLijst modus="beheer" />
      <section aria-labelledby="mail-titel" style={{ marginTop: "2rem" }}>
        <h2 id="mail-titel">{content.teksten.mailsjablonen_beheer.titel}</h2>
        <BeheerMailsjablonen />
      </section>
      <section aria-labelledby="regels-titel" style={{ marginTop: "2rem" }}>
        <h2 id="regels-titel">{content.teksten.adviesregels_beheer.titel}</h2>
        <BeheerAdviesregels />
      </section>
      <section aria-labelledby="inhoud-titel" style={{ marginTop: "2rem" }}>
        <h2 id="inhoud-titel">Inhoud van de coach</h2>
        <BeheerContent />
      </section>
    </Bewaakt>
  );
}
