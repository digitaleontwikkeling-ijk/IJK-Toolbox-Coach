import { content } from "@/content/laad-content";
import { HoeWerktHet } from "@/components/HoeWerktHet";

export const metadata = { title: "Hoe werkt de coach? · IJK Toolbox Coach" };

/** Openbare uitleg (ook zonder inloggen te lezen). */
export default function Pagina() {
  return <HoeWerktHet t={content().teksten.hoe_werkt_het} />;
}
