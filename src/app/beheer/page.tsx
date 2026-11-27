import { gebruikerMetRol } from "@/auth/server";
import { AdviezenLijst } from "@/components/AdviezenLijst";
import { BeheerContent } from "@/components/BeheerContent";
import { BeheerMailsjablonen } from "@/components/BeheerMailsjablonen";
import { GeenToegang } from "@/components/GeenToegang";
import { content } from "@/content/laad-content";

export const metadata = { title: "Beheer · IJK Toolbox Coach" };

export default async function BeheerPagina() {
  if (!(await gebruikerMetRol("beheerder"))) return <GeenToegang />;
  const t = content().teksten.beheer;
  return (
    <>
      <h1>{t.titel}</h1>
      <p className="instructie">{t.intro}</p>
      <AdviezenLijst modus="beheer" />
      <section aria-labelledby="mail-titel" style={{ marginTop: "2rem" }}>
        <h2 id="mail-titel">{content().teksten.mailsjablonen_beheer.titel}</h2>
        <BeheerMailsjablonen />
      </section>
      <section aria-labelledby="inhoud-titel" style={{ marginTop: "2rem" }}>
        <h2 id="inhoud-titel">Inhoud van de coach</h2>
        <BeheerContent />
      </section>
    </>
  );
}
