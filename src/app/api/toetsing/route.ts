import { route } from "@/lib/api";
import { lijstVoorToetser } from "@/register/toetsing";

export const GET = route(["toetser_compliance", "toetser_architect"], async ({ gebruiker }) => ({
  adviezen: await lijstVoorToetser(gebruiker),
}));
