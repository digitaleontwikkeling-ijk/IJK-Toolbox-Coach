-- Voorstellen van de coach bij de checks en verdiepingsvragen, voor het overzicht "Alle vragen en antwoorden"
-- (toetsers en beheerders): zo is te zien of een antwoord een bevestigd voorstel was of een eigen keuze.
-- { "<check-id | check-id.deelvraag-id | tool.gegeven-id>": { "voorstel": "<antwoord-id>", "zekerheid": "hoog|middel|laag" } }
-- Leeg (NULL) bij adviezen van vóór deze migratie. Geen vrije tekst van de medewerker of de coach.
ALTER TABLE advies ADD COLUMN coach_voorstellen jsonb;
