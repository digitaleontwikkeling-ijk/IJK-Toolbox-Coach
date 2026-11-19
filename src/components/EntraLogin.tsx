"use client";
/**
 * Inloggen met Microsoft Entra ID.
 * - In Teams: Teams-SSO (authentication.getAuthToken), zonder extra klik.
 * - Los in de browser: MSAL met een redirect naar de Microsoft-inlogpagina.
 * Het token gaat naar /api/sessie/entra; de server controleert het en maakt een sessie.
 */
import { useEffect, useState } from "react";

interface Props {
  clientId: string;
  tenantId: string;
  /** Scope van de eigen API, bijvoorbeeld api://coach.ijk.nl/<clientId>/access_as_user */
  scope: string;
  inTeams: boolean;
  terug: string;
}

async function probeerTeams(): Promise<boolean> {
  const { app } = await import("@microsoft/teams-js");
  try {
    await Promise.race([app.initialize(), new Promise((_, r) => setTimeout(() => r(new Error("geen Teams")), 3000))]);
    return true;
  } catch {
    return false;
  }
}

async function tokenViaTeams(): Promise<string> {
  const { authentication } = await import("@microsoft/teams-js");
  return authentication.getAuthToken();
}

/** Geeft een token, of null als de browser nu wordt doorgestuurd naar Microsoft. */
async function tokenViaMsal({ clientId, tenantId, scope }: Props): Promise<string | null> {
  const { PublicClientApplication } = await import("@azure/msal-browser");
  const msal = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: `${window.location.origin}/login`,
    },
    cache: { cacheLocation: "sessionStorage" },
  });
  await msal.initialize();
  const resultaat = await msal.handleRedirectPromise();
  const account = resultaat?.account ?? msal.getAllAccounts()[0];
  if (!account) {
    await msal.loginRedirect({ scopes: [scope], state: window.location.search });
    return null;
  }
  const t = await msal.acquireTokenSilent({ scopes: [scope], account }).catch(async () => {
    await msal.acquireTokenRedirect({ scopes: [scope], account });
    return null;
  });
  return t?.accessToken ?? null;
}

export function EntraLogin(props: Props) {
  const [status, setStatus] = useState<"bezig" | "fout">("bezig");
  const [poging, setPoging] = useState(0);

  useEffect(() => {
    let actief = true;
    (async () => {
      setStatus("bezig");
      try {
        const inTeams = props.inTeams || window.parent !== window ? await probeerTeams() : false;
        const token = inTeams ? await tokenViaTeams() : await tokenViaMsal(props);
        if (!token) return; // doorgestuurd naar Microsoft
        const res = await fetch("/api/sessie/entra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.location.replace(props.terug);
      } catch (e) {
        console.warn("Inloggen mislukt", e);
        if (actief) setStatus("fout");
      }
    })();
    return () => {
      actief = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poging]);

  if (status === "bezig") return <p role="status">Je wordt ingelogd met je IJK-account…</p>;
  return (
    <div className="foutmelding" role="alert">
      <p>
        Inloggen met je IJK-account is niet gelukt. Probeer het opnieuw. Lukt het dan nog niet, neem contact op met Team
        Digitale Ontwikkeling.
      </p>
      <button type="button" className="knop" onClick={() => setPoging((p) => p + 1)}>Opnieuw proberen</button>
    </div>
  );
}
