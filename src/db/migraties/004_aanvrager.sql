-- Naam en e-mailadres van de aanvrager, zodat toetsers en beheerders weten wie een aanvraag indiende
-- (keuze IJK). Alleen zichtbaar voor toetsers en beheerders; gaat nooit naar de coach.
-- Wordt met het advies verwijderd na de bewaartermijn. Leeg als AANVRAGER_OPSLAAN=false.
ALTER TABLE advies ADD COLUMN aanvrager_naam text;
ALTER TABLE advies ADD COLUMN aanvrager_email text;
