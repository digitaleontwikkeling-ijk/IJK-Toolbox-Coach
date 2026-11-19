import { gebruikerMetRol } from "@/auth/server";
import { AdviesInzage } from "@/components/AdviesInzage";
import { GeenToegang } from "@/components/GeenToegang";

export const metadata = { title: "Advies inzien · IJK Toolbox Coach" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  if (!(await gebruikerMetRol("beheerder"))) return <GeenToegang />;
  return <AdviesInzage id={(await params).id} modus="beheer" />;
}
