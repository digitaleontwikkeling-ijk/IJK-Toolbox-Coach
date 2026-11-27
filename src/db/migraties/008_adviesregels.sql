-- Adviesregels voor het tooladvies (fase 1), beheerd door een beheerder in het beheerscherm. Zelfde patroon als
-- mailsjabloon: geen rij = de standaard uit content/adviesregels.yaml. Een rij is een eigen versie van een
-- standaardregel, een nieuwe regel, of (verwijderd = true) een verwijderde standaardregel.
CREATE TABLE adviesregel (
  id              text PRIMARY KEY,
  regel           jsonb,                          -- null alleen als verwijderd = true
  verwijderd      boolean NOT NULL DEFAULT false,
  bijgewerkt_op   timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_door text NOT NULL,                  -- pseudoniem van de beheerder
  CHECK (verwijderd OR regel IS NOT NULL)
);

-- Wijzigingshistorie: per wijziging de vorige en de nieuwe regel (null = bestond niet / verwijderd).
-- Hiermee zet een beheerder een eerdere versie terug. Het hoogste nr bepaalt de versie (adviesregels <versie>+b<nr>).
CREATE TABLE adviesregel_historie (
  nr             bigserial PRIMARY KEY,
  regel_id       text NOT NULL,
  vorige         jsonb,
  nieuwe         jsonb,
  gewijzigd_op   timestamptz NOT NULL DEFAULT now(),
  gewijzigd_door text NOT NULL
);
CREATE INDEX adviesregel_historie_regel ON adviesregel_historie (regel_id);
