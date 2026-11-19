import { migreer } from "./db/migreer";

const nieuw = await migreer();
if (nieuw.length) console.info(`Databasemigraties uitgevoerd: ${nieuw.join(", ")}`);
