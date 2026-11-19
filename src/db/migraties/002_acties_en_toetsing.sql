-- Fase 5: log van vervolgacties (webhooks) en één besluit per toetser per advies.

CREATE TABLE actie_log (
  id           bigserial PRIMARY KEY,
  advies_id    uuid NOT NULL REFERENCES advies (id) ON DELETE CASCADE,
  type         text NOT NULL,          -- accountaanvraag | toetsing | teams_melding
  resultaat    text NOT NULL,          -- verstuurd | mislukt | gelogd (mock)
  http_status  integer,
  melding      text,
  tijd         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX actie_log_advies ON actie_log (advies_id);

CREATE UNIQUE INDEX besluit_een_per_rol ON besluit (advies_id, toetser_rol);
CREATE INDEX advies_toetsers ON advies USING gin (toetsers);
CREATE INDEX audit_log_advies ON audit_log (advies_id);
