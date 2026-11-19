import { vereisGebruiker } from "@/auth/server";
import { Wizard } from "@/components/wizard/Wizard";

export const metadata = { title: "Nieuw idee · IJK Toolbox Coach" };

export default async function WizardPagina() {
  await vereisGebruiker();
  return <Wizard />;
}
