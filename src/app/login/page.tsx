import { TESTGEBRUIKERS } from "@/auth/testgebruikers";
import { content } from "@/content/laad-content";
import { config } from "@/lib/config";
import { EntraLogin } from "@/components/EntraLogin";
import { NepLogin } from "@/components/NepLogin";

export const metadata = { title: "Inloggen · IJK Toolbox Coach" };

/** Alleen interne paden als terugadres (geen open redirect). */
function veiligTerug(t: string | undefined): string {
  return t && t.startsWith("/") && !t.startsWith("//") && !t.startsWith("/\\") ? t : "/wizard";
}

export default async function LoginPagina({ searchParams }: { searchParams: Promise<{ inTeams?: string; terug?: string }> }) {
  const t = content().teksten;
  const { inTeams, terug } = await searchParams;

  if (config.authModus === "entra") {
    const e = config.entra;
    return (
      <>
        <h1>Inloggen</h1>
        <p>{t.app.uitgangspunt}</p>
        <EntraLogin
          clientId={e.clientId}
          tenantId={e.tenantId}
          scope={`${e.appIdUri}/access_as_user`}
          inTeams={inTeams === "1"}
          terug={veiligTerug(terug)}
        />
      </>
    );
  }

  return (
    <>
      <h1>Inloggen</h1>
      <p>{t.app.uitgangspunt}</p>
      <div className="info">
        <p>
          Dit is een proof of concept. In plaats van inloggen met je IJK-account (Microsoft Entra ID) kies je hier een
          fictieve testgebruiker.
        </p>
      </div>
      <NepLogin
        gebruikers={TESTGEBRUIKERS.map((g) => ({ oid: g.oid, naam: g.naam, rollen: g.rollen }))}
        terug={veiligTerug(terug)}
      />
    </>
  );
}
