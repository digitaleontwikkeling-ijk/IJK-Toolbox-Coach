import { TESTGEBRUIKERS } from "@/auth/testgebruikers";
import { content } from "@/content/laad-content";
import { NepLogin } from "@/components/NepLogin";

export const metadata = { title: "Inloggen · IJK Toolbox Coach" };

export default function LoginPagina() {
  const t = content().teksten;
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
      <NepLogin gebruikers={TESTGEBRUIKERS.map((g) => ({ oid: g.oid, naam: g.naam, rollen: g.rollen }))} />
    </>
  );
}
