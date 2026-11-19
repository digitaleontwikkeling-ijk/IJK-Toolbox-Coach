import { gebruikerMetRol } from "@/auth/server";
import { AdviesInzage } from "@/components/AdviesInzage";
import { GeenToegang } from "@/components/GeenToegang";

export const metadata = { title: "Aanvraag toetsen · IJK Toolbox Coach" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  if (!(await gebruikerMetRol("toetser_compliance", "toetser_architect"))) return <GeenToegang />;
  return <AdviesInzage id={(await params).id} modus="toetsing" />;
}
