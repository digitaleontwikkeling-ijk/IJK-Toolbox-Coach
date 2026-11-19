/**
 * Bouwt het Teams-app-pakket (zip met manifest.json en twee iconen) in build/teams/.
 * Gebruik:
 *   APP_DOMEIN=coach.ijk.nl ENTRA_CLIENT_ID=<guid> [TEAMS_APP_ID=<guid>] npm run teams:pakket
 * TEAMS_APP_ID is standaard gelijk aan ENTRA_CLIENT_ID.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { controleerManifest, vulManifest } from "./teams-manifest";

const root = path.resolve(import.meta.dirname, "..");
const uit = path.join(root, "build", "teams");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };

try {
  const clientId = process.env.ENTRA_CLIENT_ID ?? "";
  const manifest = vulManifest(readFileSync(path.join(root, "teams", "manifest.template.json"), "utf8"), {
    VERSIE: pkg.version,
    TEAMS_APP_ID: process.env.TEAMS_APP_ID ?? clientId,
    ENTRA_CLIENT_ID: clientId,
    APP_DOMEIN: process.env.APP_DOMEIN ?? "",
  });
  const fouten = controleerManifest(manifest);
  if (fouten.length) throw new Error(fouten.join(" "));

  rmSync(uit, { recursive: true, force: true });
  mkdirSync(uit, { recursive: true });
  writeFileSync(path.join(uit, "manifest.json"), JSON.stringify(manifest, null, 2));
  for (const f of ["color.png", "outline.png"]) copyFileSync(path.join(root, "teams", f), path.join(uit, f));
  const zip = path.join(uit, "ijk-toolbox-coach-teams.zip");
  execFileSync("zip", ["-j", "-q", zip, "manifest.json", "color.png", "outline.png"], { cwd: uit });
  console.log(`Teams-pakket gemaakt: ${path.relative(root, zip)}`);
} catch (e) {
  console.error(`Teams-pakket niet gemaakt: ${(e as Error).message}`);
  process.exitCode = 1;
}
