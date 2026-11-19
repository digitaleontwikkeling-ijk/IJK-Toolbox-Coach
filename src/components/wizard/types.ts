import type { WizardData } from "@/domain/wizard";
import type { ContentDto } from "../client";

export type Wijzig = (fn: (d: WizardData) => WizardData) => void;

export interface StapProps {
  content: ContentDto;
  data: WizardData;
  wijzig: Wijzig;
  /** Coach-taak die nu loopt (voor laadmeldingen), of null. */
  coachBezig: string | null;
}
