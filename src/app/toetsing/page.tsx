import { gebruikerMetRol } from "@/auth/server";
import { AdviezenLijst } from "@/components/AdviezenLijst";
import { GeenToegang } from "@/components/GeenToegang";
import { content } from "@/content/laad-content";

export const metadata = { title: "Toetsing · IJK Toolbox Coach" };

export default async function ToetsingPagina() {
  if (!(await gebruikerMetRol("toetser_compliance", "toetser_architect"))) return <GeenToegang />;
  const t = content().teksten.toetsing;
  return (
    <>
      <h1>{t.titel}</h1>
      <p className="instructie">{t.intro}</p>
      <AdviezenLijst modus="toetsing" />
    </>
  );
}
