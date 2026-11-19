import { vereisGebruiker } from "@/auth/server";
import { AdviesPagina } from "@/components/AdviesPagina";

export const metadata = { title: "Advies · IJK Toolbox Coach" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  await vereisGebruiker();
  const { id } = await params;
  return <AdviesPagina id={id} />;
}
