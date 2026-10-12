// Régénère worldcards/data/silhouettes.js depuis la carte du monde (étape 1 : calcul dans le navigateur ; étape 2 : simplification).
// Utilisation : node outils/generer-silhouettes.cjs  (nécessite Playwright et Chromium)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  const p = await b.newPage(); await p.goto('http://127.0.0.1:8799/index.html'); await p.waitForTimeout(1500); // servir worldcards/ : python3 -m http.server 8799
  const sils = await p.evaluate(async () => {
    await chargerCarteMonde(); // les silhouettes sont recalculées depuis la carte (sans data/silhouettes.js)
    const o = {};
    for (const code of Object.keys(CODES_NUMERIQUES)) {
      const f0 = FEATURES[CODES_NUMERIQUES[code]]; if (!f0) continue;
      const f = territoirePrincipal(f0), [lon, lat] = d3.geoCentroid(f);
      o[code] = d3.geoPath(d3.geoAzimuthalEqualArea().rotate([-lon, -lat]).fitExtent([[3, 3], [97, 97]], f)).digits(1)(f);
    }
    return o;
  });
  const contenu = `"use strict";\n/* Silhouettes des pays pré-calculées (projection azimutale, 100 × 100) à partir de la carte Natural Earth (domaine public).\n   Évite de charger d3, topojson et la carte du monde au démarrage. Régénérer avec outils/ si la carte change. */\nconst SILHOUETTES = ${JSON.stringify(sils)};\nif (typeof module === "object" && module.exports) module.exports = { SILHOUETTES };\n`;
  require('fs').writeFileSync('/home/user/coda/worldcards/data/silhouettes.js', contenu);
  console.log(Object.keys(sils).length, 'silhouettes,', contenu.length, 'octets');
  await b.close();
})().then(() => require("./simplifier-silhouettes.cjs"));
