-- Basisschema IJK Toolbox Coach.
-- Er worden geen namen of e-mailadressen opgeslagen: alleen een pseudoniem gebruikers-ID.

-- Onafgemaakte wizard, inclusief chat. Wordt verwijderd na de vervolgactie,
-- bij "Opnieuw beginnen" of na CONCEPT_BEWAARDAGEN.
CREATE TABLE concept (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudoniem_id   text NOT NULL,
  data            jsonb NOT NULL,
  advies_id       uuid,
  aangemaakt_op   timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX concept_pseudoniem ON concept (pseudoniem_id);

-- Teller voor referentienummers TC-JJJJ-NNNN (per jaar opnieuw vanaf 1).
CREATE TABLE referentie_teller (
  jaar    integer PRIMARY KEY,
  laatste integer NOT NULL
);

-- Het adviesregister.
CREATE TABLE advies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referentie       text NOT NULL UNIQUE,
  pseudoniem_id    text NOT NULL,
  aangemaakt_op    timestamptz NOT NULL DEFAULT now(),
  bijgewerkt_op    timestamptz NOT NULL DEFAULT now(),
  beschrijving     text NOT NULL,
  verduidelijking  jsonb NOT NULL DEFAULT '[]',
  tooladvies       jsonb NOT NULL,
  antwoorden       jsonb NOT NULL,   -- { checks: {...}, extraVragen: {...} }
  rode_vlaggen     jsonb NOT NULL,
  uitkomst         text NOT NULL,
  toetsers         text[] NOT NULL DEFAULT '{}',
  dpia_signaal     boolean NOT NULL,
  motivatie        text NOT NULL,
  voorwaarden      jsonb NOT NULL DEFAULT '[]',
  alternatieven    jsonb NOT NULL DEFAULT '[]',
  regelversie      text NOT NULL,
  toolsversie      text NOT NULL,
  status           text NOT NULL,
  vorig_advies_id  uuid REFERENCES advies (id) ON DELETE SET NULL,
  verloopt_op      timestamptz NOT NULL
);
CREATE INDEX advies_pseudoniem ON advies (pseudoniem_id);
CREATE INDEX advies_status ON advies (status);

-- Besluiten van toetsers (fase 5).
CREATE TABLE besluit (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advies_id              uuid NOT NULL REFERENCES advies (id) ON DELETE CASCADE,
  toetser_rol            text NOT NULL,
  toetser_pseudoniem_id  text NOT NULL,
  besluit                text NOT NULL,
  toelichting            text,
  datum                  timestamptz NOT NULL DEFAULT now()
);

-- Audit-log van inzage en besluiten door toetsers en beheerders (fase 5).
CREATE TABLE audit_log (
  id             bigserial PRIMARY KEY,
  pseudoniem_id  text NOT NULL,
  rol            text NOT NULL,
  actie          text NOT NULL,
  advies_id      uuid,
  tijd           timestamptz NOT NULL DEFAULT now()
);
