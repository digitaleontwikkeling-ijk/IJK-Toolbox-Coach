import { HoeWerktHet } from "@/components/HoeWerktHet";
import content from "@/demo/content.generated.json";

export const metadata = { title: "Hoe werkt de coach? · IJK Toolbox Coach (demo)" };

export default function Pagina() {
  return <HoeWerktHet t={content.teksten.hoe_werkt_het} isDemo />;
}
