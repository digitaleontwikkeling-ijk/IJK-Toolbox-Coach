-- Regelset 0.8: privacy (pre-DPIA) en AI-risico als aparte beoordelingen, met traceerbaarheid.
-- dpia:      { actief, score, klasse, klasseNaam, indicatoren: [{ id, naam, waarde, telt, feit }] }
-- ai_risico: { actief, klasse, klasseNaam, redenen: [{ gegeven, antwoord, klasse, voorwaarde?, feit }], domein }
-- feiten:    alle feiten met herkomst: [{ id, waarde, bron, herkomst, zekerheid, gebruiktDoor, toelichting }]
-- De antwoorden op de verdiepingsvragen staan in antwoorden.verdieping (alleen de relevante).
-- Leeg (NULL) bij adviezen van vóór regelset 0.8.
ALTER TABLE advies ADD COLUMN dpia jsonb;
ALTER TABLE advies ADD COLUMN ai_risico jsonb;
ALTER TABLE advies ADD COLUMN feiten jsonb;
