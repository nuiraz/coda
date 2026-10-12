// Génère worldcards/data/centres.js : centre (lat, lon) et superficie approximative de chaque pays, depuis la carte du monde.
// Utilisé par le défi du jour (distance et direction entre deux pays). Utilisation : node outils/generer-centres.cjs (Playwright + Chromium)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  const p = await b.newPage(); await p.goto('http://127.0.0.1:8799/index.html'); await p.waitForTimeout(1500);
  const centres = await p.evaluate(async () => {
    await chargerCarteMonde();
    const feats = topojson.feature(CARTE_MONDE, CARTE_MONDE.objects.countries).features.filter((f) => f.id);
    const parNum = {}; for (const [code, num] of Object.entries(CODES_NUMERIQUES)) parNum[String(num)] = code;
    const o = {};
    for (const f of feats) {
      const code = NUM_TO_CODE[f.id] || parNum[String(f.id)] || parNum[String(Number(f.id))]; if (!code) continue;
      let geo = f.geometry;
      if (geo.type === "MultiPolygon") { // le plus grand morceau (évite l'Alaska, la Guyane…)
        let best = null, ba = -1;
        for (const poly of geo.coordinates) { const g = { type: "Polygon", coordinates: poly }, a = d3.geoArea(g); if (a > ba) { ba = a; best = g; } }
        geo = best;
      }
      const [lon, lat] = d3.geoCentroid(geo);
      const aire = Math.round(d3.geoArea(f.geometry) * 6371 * 6371);
      if (!o[code] || o[code][2] < aire) o[code] = [Math.round(lat * 10) / 10, Math.round(lon * 10) / 10, aire]; // plusieurs objets peuvent porter le même code
    }
    return o;
  });
  const contenu = `"use strict";\n/* Centre (latitude, longitude) et superficie approximative (km²) de chaque pays, calculés depuis la carte Natural Earth (domaine public).\n   Régénérer avec outils/generer-centres.cjs. */\nconst CENTRES_PAYS = ${JSON.stringify(centres)};\nif (typeof module === "object" && module.exports) module.exports = { CENTRES_PAYS };\n`;
  require('fs').writeFileSync('/home/user/coda/worldcards/data/centres.js', contenu);
  console.log(Object.keys(centres).length, 'pays,', contenu.length, 'octets');
  await b.close();
})();
