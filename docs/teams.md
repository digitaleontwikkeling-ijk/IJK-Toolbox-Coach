# Teams en inloggen met Microsoft Entra ID

De app draait als **persoonlijk tabblad** in Microsoft Teams (scope `personal`; geen bot,
kanaal of groepschat) en is ook los te openen via een link.

| Waar | Inloggen |
| --- | --- |
| In Teams | Teams-SSO (`authentication.getAuthToken` uit de Teams JavaScript SDK), zonder extra klik |
| Los in de browser | MSAL (`@azure/msal-browser`) met een redirect naar de Microsoft-inlogpagina |

Na het inloggen komt iedereen op de pagina die bij de rol hoort: toetsers op "Toetsing", beheerders op "Beheer",
medewerkers in de wizard. Iedereen krijgt de rol medewerker, behalve toetsers en beheerders: zij dienen zelf
geen aanvragen in.

In beide gevallen stuurt de browser het token naar `POST /api/sessie/entra`. De server controleert het
(`src/auth/entra.ts`: handtekening, eigen tenant, doelgroep, geldigheid) en maakt een sessiecookie.
In Teams draait de app in een iframe op een andere site; daarom is de cookie `SameSite=None; Secure; Partitioned`.

> Niet getest in een echte Teams-omgeving of tegen een echte tenant (niet beschikbaar tijdens de bouw).
> Wel getest: tokencontrole met eigen sleutels, het manifest, en de app in een iframe op een andere site
> (`tests/e2e/teams-tabblad.spec.ts`). Doe de eerste echte test met testgebruikers en testdata.

## 1. App-registratie in Entra ID (beheerder van de tenant)

1. **Nieuwe registratie** "IJK Toolbox Coach", alleen accounts in deze organisatie.
2. **Authentication** → platform *Single-page application*, redirect-URI `https://<APP_DOMEIN>/login`.
3. **Expose an API**
   - Application ID URI: `api://<APP_DOMEIN>/<client-id>`
   - Scope `access_as_user` (beheerders en gebruikers mogen toestemming geven).
   - Authorized client applications (voor Teams-SSO), met de scope `access_as_user`:
     - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop en mobiel)
     - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)
     - TODO: controleren tegen de actuele Microsoft-documentatie over Teams-SSO.
4. **App roles** (toegestaan voor *Users/Groups*), met deze *values*:
   `toetser_compliance`, `toetser_architect`, `beheerder`. Iedereen die inlogt krijgt automatisch de rol
   `medewerker` (instelbaar met `ENTRA_STANDAARD_ROL`).
5. **Enterprise applications** → wijs de rollen toe aan de juiste personen of groepen.
6. **API permissions** → *Grant admin consent*, zodat medewerkers geen toestemmingsvenster krijgen.
7. Manifest van de registratie: `"accessTokenAcceptedVersion": 2` (aanbevolen; v1-tokens worden ook geaccepteerd).

Er is **geen client secret** nodig: de app controleert alleen tokens.

## 2. Webapp instellen

```bash
AUTH_MODUS=entra
ENTRA_TENANT_ID=<tenant-id>
ENTRA_CLIENT_ID=<client-id>
ENTRA_APP_ID_URI=api://<APP_DOMEIN>/<client-id>
APP_URL=https://<APP_DOMEIN>
```

De app moet via **HTTPS** bereikbaar zijn op `APP_DOMEIN`.

## 3. Teams-pakket maken en installeren

```bash
APP_DOMEIN=<APP_DOMEIN> ENTRA_CLIENT_ID=<client-id> npm run teams:pakket
```

Dit maakt `build/teams/ijk-toolbox-coach-teams.zip` (manifest + iconen). Het script controleert dat het
manifest alleen één persoonlijk tabblad bevat. Valideer het pakket daarna in het
**Teams Developer Portal** (Apps → Import app → Validate); het officiële schema was tijdens de bouw niet bereikbaar.

Installeren: **Teams admin center** → *Manage apps* → *Upload new app*. Optioneel via een
*app setup policy* vastpinnen voor de testgroep.

Het icoon is een neutrale hexagon met "TC" in de huisstijlkleuren. Het officiële IJK-logo is op te vragen
bij marketing; vervang dan `teams/color.png` (192×192) en `teams/outline.png` (32×32, wit, transparant).

## 4. Insluiten

De app mag alleen in de eigen site en in Teams/Microsoft 365 worden ingesloten
(`Content-Security-Policy: frame-ancestors`, zie `src/middleware.ts`).
