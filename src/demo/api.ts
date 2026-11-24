/**
 * ALLEEN VOOR DE STATISCHE DEMO (GitHub Pages).
 *
 * Bootst de API van de server na in de browser, zodat de schermen ongewijzigd werken
 * zonder server of database. Gegevens staan alleen in de localStorage van de bezoeker.
 * - Beslisregels: dezelfde pure functies als de echte app (src/domain/).
 * - Coach: dezelfde MockCoachClient + CoachService (validatie) als de echte app.
 * - Vervolgacties: alleen gelogd; er gaan geen webhooks uit.
 * - Inloggen: fictieve testgebruikers; geen echte autorisatie (alles draait in je eigen browser).
 */
import { MockCoachClient } from "../coach/MockCoachClient";
import { CoachService } from "../coach/service";
import type { Content } from "../content/laad-content";
import { TESTGEBRUIKERS } from "../auth/testgebruikers";
import { TOETSER_ROLLEN, type Rol } from "../auth/rollen";
import { evalueer, OngeldigeInvoerFout, type CheckAntwoord } from "../domain/beslisregels";
import { besluitInvoerSchema, eindstatus, type Besluit } from "../domain/besluiten";
import type { Status } from "../domain/content-schema";
import { beslisInvoerUit, toolGekozen } from "../domain/invoer";
import type { AiUitkomst, DpiaUitkomst, Feit } from "../domain/verdieping";
import { legeWizard, wizardDataSchema, type WizardData } from "../domain/wizard";
import { ApiFoutClient } from "../components/client";
import contentJson from "./content.generated.json";

const content = contentJson as unknown as Content;
const SLEUTEL = "ijk-toolbox-coach-demo";
const coach = new CoachService(new MockCoachClient(content), content);

// ---------- Opslag in localStorage ----------

interface DemoAdvies {
  id: string;
  referentie: string;
  pseudoniemId: string;
  /** Wie de aanvraag indiende (alleen voor toetsers en beheerders). */
  aanvrager?: { naam: string; email: string | null } | null;
  aangemaaktOp: string;
  bijgewerktOp: string;
  verlooptOp: string;
  beschrijving: string;
  verduidelijking: { vraag: string; antwoord: string }[];
  tooladvies: NonNullable<WizardData["tooladvies"]>;
  antwoorden: { checks: Record<string, CheckAntwoord>; extraVragen: Record<string, boolean | "onzeker">; verdieping?: Record<string, string> };
  rodeVlaggen: Record<string, boolean>;
  uitkomst: string;
  toetsers: string[];
  dpiaSignaal: boolean;
  aiActSignaal: boolean;
  dpia?: DpiaUitkomst | null;
  aiRisico?: AiUitkomst | null;
  feiten?: Feit[] | null;
  motivatie: string;
  voorwaarden: string[];
  alternatieven: string[];
  regelversie: string;
  toolsversie: string;
  status: Status;
  vorigAdviesId: string | null;
}

interface DemoStaat {
  sessie: { oid: string } | null;
  concepten: { id: string; pseudoniemId: string; data: WizardData; adviesId: string | null; bijgewerktOp: string }[];
  adviezen: DemoAdvies[];
  besluiten: { adviesId: string; toetserRol: string; toetserPseudoniemId: string; besluit: Besluit; toelichting: string | null; datum: string }[];
  log: { tijd: string; tekst: string }[];
  teller: Record<string, number>;
}

function lees(): DemoStaat {
  try {
    const ruw = window.localStorage.getItem(SLEUTEL);
    if (ruw) return JSON.parse(ruw) as DemoStaat;
  } catch {
    /* geen opslag beschikbaar: begin leeg */
  }
  return { sessie: null, concepten: [], adviezen: [], besluiten: [], log: [], teller: {} };
}

function schrijf(s: DemoStaat) {
  try {
    window.localStorage.setItem(SLEUTEL, JSON.stringify(s));
  } catch {
    /* opslag vol of geblokkeerd: de demo werkt dan alleen tot de pagina herlaadt */
  }
}

export function resetDemo() {
  try {
    window.localStorage.removeItem(SLEUTEL);
  } catch {
    /* niets */
  }
}

const nu = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const fout = (status: number, melding: string, details?: string[]) => new ApiFoutClient(status, melding, details);

/** De ingelogde demo-gebruiker (of null). */
export function demoGebruiker() {
  const s = lees();
  const g = TESTGEBRUIKERS.find((t) => t.oid === s.sessie?.oid);
  return g ? { ...g, pseudoniemId: `demo-${g.oid}` } : null;
}

function vereis(...rollen: Rol[]) {
  const g = demoGebruiker();
  if (!g) {
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login/`;
    throw fout(401, "Je bent niet ingelogd.");
  }
  if (!g.rollen.some((r) => rollen.includes(r))) throw fout(403, "Je hebt geen toegang tot deze gegevens.");
  return g;
}

/** Voor de medewerker zelf: zonder pseudoniem en zonder opgeslagen naam/e-mail. */
function zonderPseudo<T extends { pseudoniemId: string; aanvrager?: unknown }>(a: T): Omit<T, "pseudoniemId" | "aanvrager"> {
  const { pseudoniemId: _, aanvrager: __, ...rest } = a;
  return rest;
}

function besluitenVan(s: DemoStaat, id: string) {
  return s.besluiten.filter((b) => b.adviesId === id).map(({ toetserPseudoniemId: _, ...b }) => b);
}

/** Rood zonder alternatief: Team Digitale Ontwikkeling neemt contact op (demo: alleen gelogd). */
function contactNodig(a: DemoAdvies): boolean {
  const k = content.regelset.kleuren.find((x) => x.id === a.uitkomst);
  return !!k?.contact_als_geen_alternatief && k.vervolgactie === "alleen_vastleggen" && a.alternatieven.length === 0;
}

function meldContact(s: DemoStaat, a: DemoAdvies) {
  if (a.status !== "advies_gegeven" || !contactNodig(a)) return;
  a.status = "contact_volgt";
  s.log.push({ tijd: nu(), tekst: `${a.referentie}: contact met Team Digitale Ontwikkeling (demo: alleen gelogd, geen webhook)` });
}

/** Uitkomsten die toetsers ter informatie zien. */
const terInformatie = (uitkomst: string) => {
  const k = content.regelset.kleuren.find((x) => x.id === uitkomst);
  return !!k && k.toetsers === "alle" && k.vervolgactie === "alleen_vastleggen";
};

// ---------- De "server" ----------

export async function demoApi<T>(pad: string, opties: { method?: string; body?: unknown } = {}): Promise<T> {
  const methode = opties.method ?? (opties.body === undefined ? "GET" : "POST");
  const body = opties.body as Record<string, unknown> | undefined;
  const s = lees();
  const deel = pad.replace(/^\/api\//, "").split("/").map(decodeURIComponent);
  const r = (x: unknown) => {
    schrijf(s);
    return x as T;
  };

  // Inloggen / uitloggen
  if (pad === "/api/login" && methode === "POST") {
    if (!TESTGEBRUIKERS.some((t) => t.oid === body?.oid)) throw fout(400, "Onbekende testgebruiker.");
    s.sessie = { oid: String(body!.oid) };
    return r({ ok: true });
  }
  if (pad === "/api/logout") {
    s.sessie = null;
    return r({ ok: true });
  }

  if (pad === "/api/content") {
    const g = vereis("medewerker", "toetser_compliance", "toetser_architect", "beheerder");
    return r({ ...content, gebruiker: { naam: g.naam, rollen: g.rollen } });
  }

  // Concept (de wizard)
  if (deel[0] === "concept") {
    const g = vereis("medewerker");
    const heeftBeschrijving = (x: { data: WizardData }) => x.data.beschrijving.trim() !== "";
    if (!deel[1] && methode === "GET") {
      // Laatste onafgemaakte idee: wel een beschrijving, nog geen advies.
      const c = s.concepten
        .filter((x) => x.pseudoniemId === g.pseudoniemId && !x.adviesId && heeftBeschrijving(x))
        .sort((a, b) => b.bijgewerktOp.localeCompare(a.bijgewerktOp))[0];
      return r({ concept: c ? { id: c.id, adviesId: c.adviesId, data: c.data } : null });
    }
    if (!deel[1] && methode === "POST") {
      // Nieuw idee: lege en afgeronde concepten opruimen.
      s.concepten = s.concepten.filter((x) => x.pseudoniemId !== g.pseudoniemId || (!x.adviesId && heeftBeschrijving(x)));
      const c = { id: uuid(), pseudoniemId: g.pseudoniemId, data: legeWizard(), adviesId: null, bijgewerktOp: nu() };
      s.concepten.push(c);
      return r({ concept: { id: c.id, adviesId: null, data: c.data } });
    }
    const c = s.concepten.find((x) => x.id === deel[1] && x.pseudoniemId === g.pseudoniemId);
    if (methode === "GET") {
      if (!c) throw fout(404, "Niet gevonden.");
      return r({ concept: { id: c.id, adviesId: c.adviesId, data: c.data } });
    }
    if (methode === "DELETE") {
      s.concepten = s.concepten.filter((x) => x !== c);
      return r({ ok: true });
    }
    if (!c) throw fout(404, "Niet gevonden.");
    const data = wizardDataSchema.safeParse(body);
    if (!data.success) throw fout(400, "Ongeldige invoer.");
    c.data = data.data;
    c.bijgewerktOp = nu();
    return r({ ok: true });
  }

  // Coach (mock, met dezelfde validatie als de echte app)
  if (deel[0] === "coach") {
    const g = vereis("medewerker");
    const ctx = { pseudoniemId: g.pseudoniemId };
    const b = body as never;
    switch (deel[1]) {
      case "verduidelijk":
        return r({ resultaat: await coach.verduidelijk(b, ctx) });
      case "tooladvies":
        return r({ resultaat: await coach.tooladvies({ verduidelijking: [], uitsluiten: [], ...(body as object) } as never, ctx) });
      case "checks":
        return r({ resultaat: await coach.checksVoorinvullen({ verduidelijking: [], ...(body as object) } as never, ctx) });
      case "chat":
        return r({ resultaat: await coach.chat({ geschiedenis: [], ...(body as object) } as never, ctx) });
      case "uitleg": {
        const a = s.adviezen.find((x) => x.id === body?.adviesId && x.pseudoniemId === g.pseudoniemId);
        if (!a) throw fout(404, "Niet gevonden.");
        const kleur = content.regelset.kleuren.find((k) => k.id === a.uitkomst)!;
        const uitleg = await coach.uitleg(
          {
            beschrijving: a.beschrijving,
            tool: a.tooladvies.tool,
            antwoorden: {},
            uitkomst: {
              regelversie: a.regelversie, kleur: kleur.id, uitkomst: kleur.uitkomst, vervolgactie: kleur.vervolgactie,
              redenen: [], motivatie: a.motivatie, toetsers: a.toetsers, dpiaSignaal: a.dpiaSignaal, aiActSignaal: a.aiActSignaal, contactNodig: false,
              voorwaarden: a.voorwaarden, alternatieven: a.alternatieven,
              dpiaKlasse: a.dpia?.klasseNaam ?? null, aiKlasse: a.aiRisico?.klasseNaam ?? null,
            },
          },
          ctx,
        );
        return r({ resultaat: uitleg });
      }
    }
    throw fout(404, "Niet gevonden.");
  }

  // Advies berekenen en vastleggen
  if (pad === "/api/advies" && methode === "POST") {
    const g = vereis("medewerker");
    const c = s.concepten.find((x) => x.id === body?.conceptId && x.pseudoniemId === g.pseudoniemId);
    if (!c) throw fout(404, "Niet gevonden.");
    const data = c.data;
    if (!data.beschrijving.trim()) throw fout(400, "Beschrijf eerst wat je wilt bereiken (stap 1).");
    if (!data.tooladvies || !toolGekozen(data, content)) throw fout(400, "Kies eerst een tool (stap 2).");
    const invoer = beslisInvoerUit(data, content);
    let u;
    try {
      u = evalueer(invoer, content.regelset);
    } catch (e) {
      if (e instanceof OngeldigeInvoerFout) throw fout(400, "Nog niet alle vragen zijn beantwoord.", e.fouten);
      throw e;
    }
    const verloopt = new Date();
    verloopt.setMonth(verloopt.getMonth() + 12);
    const velden = {
      aanvrager: { naam: g.naam, email: g.upn ?? null },
      beschrijving: data.beschrijving.trim(),
      verduidelijking: data.verduidelijking.filter((v) => v.antwoord.trim()),
      tooladvies: data.tooladvies,
      antwoorden: { checks: invoer.checks, extraVragen: invoer.extraVragen ?? {}, verdieping: invoer.verdieping ?? {} },
      dpia: u.dpia, aiRisico: u.aiRisico, feiten: u.feiten,
      rodeVlaggen: invoer.rodeVlaggen,
      uitkomst: u.kleur, toetsers: u.toetsers, dpiaSignaal: u.dpiaSignaal, aiActSignaal: u.aiActSignaal, motivatie: u.motivatie,
      voorwaarden: u.voorwaarden, alternatieven: u.alternatieven, regelversie: u.regelversie,
      toolsversie: content.tools.versie, status: "advies_gegeven" as Status, bijgewerktOp: nu(), verlooptOp: verloopt.toISOString(),
    };
    const bestaand = s.adviezen.find((a) => a.id === c.adviesId);
    if (bestaand && bestaand.status === "advies_gegeven") {
      Object.assign(bestaand, velden);
      meldContact(s, bestaand);
      return r({ advies: zonderPseudo(bestaand) });
    }
    const jaar = new Date().getFullYear();
    s.teller[jaar] = (s.teller[jaar] ?? 0) + 1;
    const a: DemoAdvies = {
      id: uuid(),
      referentie: `TC-${jaar}-${String(s.teller[jaar]).padStart(4, "0")}`,
      pseudoniemId: g.pseudoniemId,
      aangemaaktOp: nu(),
      vorigAdviesId: bestaand?.id ?? data.vorigAdviesId,
      ...velden,
    };
    s.adviezen.push(a);
    c.adviesId = a.id;
    meldContact(s, a);
    return r({ advies: zonderPseudo(a) });
  }

  if (deel[0] === "advies" && deel[1]) {
    const g = vereis("medewerker");
    const a = s.adviezen.find((x) => x.id === deel[1] && x.pseudoniemId === g.pseudoniemId);
    if (!a) throw fout(404, "Niet gevonden.");
    if (!deel[2]) return r({ advies: { ...zonderPseudo(a), besluiten: besluitenVan(s, a.id) } });
    if (deel[2] === "actie") {
      if (a.status !== "advies_gegeven") throw fout(409, "Voor dit advies is de vervolgactie al uitgevoerd.");
      const actie = content.regelset.kleuren.find((k) => k.id === a.uitkomst)!.vervolgactie;
      const status: Status | null =
        contactNodig(a) ? "contact_volgt" : actie === "toetsing" ? "in_toetsing" : actie === "alleen_vastleggen" ? null : "account_aangevraagd";
      if (!status) throw fout(409, "Bij deze uitkomst hoort geen aanvraag.");
      a.status = status;
      s.log.push({ tijd: nu(), tekst: `${a.referentie}: ${actie} (demo: alleen gelogd, geen webhook)` });
      s.concepten = s.concepten.filter((x) => x.adviesId !== a.id);
      return r({ status, ...(actie === "toetsing" ? { meldingVerstuurd: true } : {}) });
    }
    if (deel[2] === "opnieuw") {
      const data = wizardDataSchema.parse({
        stap: 1, beschrijving: a.beschrijving, verduidelijking: a.verduidelijking, verduidelijkingGevraagd: true,
        tooladvies: { ...a.tooladvies, geaccepteerd: false }, checks: a.antwoorden.checks, checksVoorgesteld: true, fase2UitlegGezien: true,
        extraVragen: a.antwoorden.extraVragen, verdieping: a.antwoorden.verdieping ?? {}, rodeVlaggen: a.rodeVlaggen, vorigAdviesId: a.id,
      });
      const c = { id: uuid(), pseudoniemId: g.pseudoniemId, data, adviesId: null, bijgewerktOp: nu() };
      s.concepten.push(c);
      return r({ concept: { id: c.id, adviesId: null, data } });
    }
  }

  if (pad === "/api/mijn-aanvragen") {
    const g = vereis("medewerker");
    const eigen = s.adviezen.filter((a) => a.pseudoniemId === g.pseudoniemId).sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp));
    return r({ adviezen: eigen.map(zonderPseudo) });
  }

  // Toetsing
  if (deel[0] === "toetsing") {
    const g = vereis("toetser_compliance", "toetser_architect");
    const rollen = g.rollen.filter((x) => (TOETSER_ROLLEN as readonly string[]).includes(x)) as string[];
    const zichtbaar = (a: DemoAdvies) =>
      (a.status !== "advies_gegeven" || terInformatie(a.uitkomst)) && a.toetsers.some((t) => rollen.includes(t));
    if (!deel[1]) {
      const lijst = s.adviezen.filter(zichtbaar).sort((a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp));
      return r({ adviezen: lijst.map((a) => ({ ...a, besluiten: besluitenVan(s, a.id) })) });
    }
    const a = s.adviezen.find((x) => x.id === deel[1]);
    if (!a || !zichtbaar(a)) throw fout(404, "Niet gevonden.");
    const besluiten = besluitenVan(s, a.id);
    const eigenAanvraag = a.pseudoniemId === g.pseudoniemId;
    if (!deel[2]) {
      const openRollen = a.status !== "in_toetsing" || eigenAanvraag ? [] : a.toetsers.filter((t) => rollen.includes(t) && !besluiten.some((b) => b.toetserRol === t));
      return r({ advies: { ...a, besluiten, openRollen, eigenAanvraag } });
    }
    if (deel[2] === "besluit") {
      const p = besluitInvoerSchema.safeParse(body);
      if (!p.success) throw fout(400, "Ongeldige invoer.", p.error.issues.map((i) => i.message));
      if (eigenAanvraag) throw fout(403, "Je kunt je eigen aanvraag niet toetsen.");
      if (a.status !== "in_toetsing") throw fout(409, "Over deze aanvraag is al een besluit genomen.");
      const passend = a.toetsers.filter((t) => rollen.includes(t));
      const rol = p.data.rol ?? passend[0]!;
      if (besluiten.some((b) => b.toetserRol === rol)) throw fout(409, "Voor deze rol is al een besluit vastgelegd.");
      s.besluiten.push({ adviesId: a.id, toetserRol: rol, toetserPseudoniemId: g.pseudoniemId, besluit: p.data.besluit, toelichting: p.data.toelichting || null, datum: nu() });
      const status = eindstatus(a.toetsers, [...besluiten, { toetserRol: rol, besluit: p.data.besluit }]);
      if (status) a.status = status;
      return r({ status: a.status });
    }
  }

  // Beheer
  if (deel[0] === "beheer" && deel[1] === "adviezen") {
    vereis("beheerder");
    if (!deel[2]) return r({ adviezen: [...s.adviezen].reverse().map((a) => ({ ...a, besluiten: besluitenVan(s, a.id) })) });
    const a = s.adviezen.find((x) => x.id === deel[2]);
    if (!a) throw fout(404, "Niet gevonden.");
    return r({ advies: { ...a, besluiten: besluitenVan(s, a.id) } });
  }

  throw fout(404, "Niet gevonden.");
}
