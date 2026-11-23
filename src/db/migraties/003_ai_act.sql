-- Regelset 0.4: AI Act-signaal in het adviesregister.
-- (De deelscores van Impact (B, I, V) staan in de kolom antwoorden, per deelvraag.)
ALTER TABLE advies ADD COLUMN ai_act_signaal boolean NOT NULL DEFAULT false;
