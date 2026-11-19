// Maakt de Teams-iconen (eenmalig; resultaat staat in teams/). Gebruik: node scripts/maak-iconen.cjs
// Neutraal icoon: hexagon uit de huisstijl met "TC". Het IJK-logo is op te vragen bij marketing.
const { chromium } = require("@playwright/test");
const path = require("node:path");
const hex = (kleur, lijn) =>
  `<polygon points="50,4 92,28 92,72 50,96 8,72 8,28" fill="${kleur}" stroke="${lijn}" stroke-width="${kleur === "none" ? 6 : 0}"/>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const maak = async (svg, grootte, bestand) => {
    await p.setViewportSize({ width: grootte, height: grootte });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg", `<svg width="${grootte}" height="${grootte}"`)}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, "..", "teams", bestand), omitBackground: true });
  };
  await maak(
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#1E0E3B"/>${hex("#50A78A", "none")}<text x="50" y="62" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="30" fill="#1E0E3B">TC</text></svg>`,
    192,
    "color.png",
  );
  await maak(
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${hex("none", "#FFFFFF")}<text x="50" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="34" fill="#FFFFFF">TC</text></svg>`,
    32,
    "outline.png",
  );
  await b.close();
})();
