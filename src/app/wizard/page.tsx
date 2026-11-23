import { gebruikerMetRol } from "@/auth/server";
import { GeenToegang } from "@/components/GeenToegang";
import { Wizard } from "@/components/wizard/Wizard";

export const metadata = { title: "Nieuw idee · IJK Toolbox Coach" };

export default async function WizardPagina() {
  // Alleen medewerkers dienen ideeën in (toetsers niet).
  if (!(await gebruikerMetRol("medewerker"))) return <GeenToegang />;
  return <Wizard />;
}
