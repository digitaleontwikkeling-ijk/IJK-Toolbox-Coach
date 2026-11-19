// Standaardinstellingen voor tests. Integratietests gebruiken een aparte testdatabase.
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? "postgres://coach:coach_dev@localhost:5432/toolbox_coach_test";
process.env.SESSIE_GEHEIM ??= "test-sessie-geheim";
process.env.PSEUDONIEM_GEHEIM ??= "test-pseudoniem-geheim";
process.env.COACH_MODUS ??= "mock";
process.env.CONTENT_DIR ??= new URL("../content", import.meta.url).pathname;
