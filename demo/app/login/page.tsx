import { TESTGEBRUIKERS } from "@/auth/testgebruikers";
import { NepLogin } from "@/components/NepLogin";

export const metadata = { title: "Inloggen · IJK Toolbox Coach (demo)" };

export default function LoginPagina() {
  return (
    <>
      <h1>Inloggen</h1>
      <p>Niet de tool bepaalt wat mag, maar wat je ermee doet.</p>
      <div className="info">
        <p>
          In deze demo kies je een fictieve testgebruiker. Probeer ook de rollen van toetser en beheerder: dien eerst als
          medewerker een aanvraag in met de uitkomst &quot;Eerst toetsen&quot; en log daarna in als toetser.
        </p>
      </div>
      <NepLogin gebruikers={TESTGEBRUIKERS.map((g) => ({ oid: g.oid, naam: g.naam, rollen: g.rollen }))} />
    </>
  );
}
