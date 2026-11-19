/** Controleert de content-bestanden. Gebruik: npm run content:check */
import { laadContent } from "../src/content/laad-content";

try {
  const c = laadContent();
  console.log(`Content in orde. Regelset versie ${c.regelset.versie}, ${c.tools.tools.length} tools.`);
  if (!c.regelset.gevalideerd) console.warn("Let op: deze regelset is nog niet gevalideerd door de toetsers.");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
