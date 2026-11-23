import { gebruikerMetRol } from "@/auth/server";
import { GeenToegang } from "@/components/GeenToegang";
import { AdviesPagina } from "@/components/AdviesPagina";

export const metadata = { title: "Advies · IJK Toolbox Coach" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  if (!(await gebruikerMetRol("medewerker"))) return <GeenToegang />;
  const { id } = await params;
  return <AdviesPagina id={id} />;
}
