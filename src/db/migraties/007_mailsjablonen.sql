-- Eigen mailsjablonen voor de licentieaanvraag, per tool ingesteld door een beheerder in het beheerscherm.
-- Geen rij = de standaard uit content/teksten.yaml (aanvraag_mail). Wijzigingen staan in audit_log.
CREATE TABLE mailsjabloon (
  tool            text PRIMARY KEY,
  onderwerp       text NOT NULL,
  tekst           text NOT NULL,
  bijgewerkt_op   timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_door text NOT NULL -- pseudoniem van de beheerder
);
