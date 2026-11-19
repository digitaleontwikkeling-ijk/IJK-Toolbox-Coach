import { route } from "@/lib/api";
import { lijstVoorBeheer } from "@/register/toetsing";

export const GET = route(["beheerder"], async ({ gebruiker }) => ({ adviezen: await lijstVoorBeheer(gebruiker) }));
