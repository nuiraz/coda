// Régénère worldcards/data/silhouettes.js depuis la carte du monde (étape 1 : calcul dans le navigateur ; étape 2 : simplification).
// Utilisation : node outils/generer-silhouettes.cjs  (nécessite Playwright et Chromium)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new'] });
  const p = await b.newPage(); await p.goto('file:///home/user/coda/worldcards/index.html'); await p.waitForTimeout(1500);
  const sils = await p.evaluate(() => { const o = {}; for (const code of Object.keys(CODES_NUMERIQUES)) { const h = silhouette(code); const m = /d="([^"]*)"/.exec(h); if (m) o[code] = m[1]; } return o; });
  const contenu = `"use strict";\n/* Silhouettes des pays pré-calculées (projection azimutale, 100 × 100) à partir de la carte Natural Earth (domaine public).\n   Évite de charger d3, topojson et la carte du monde au démarrage. Régénérer avec outils/ si la carte change. */\nconst SILHOUETTES = ${JSON.stringify(sils)};\n`;
  require('fs').writeFileSync('/home/user/coda/worldcards/data/silhouettes.js', contenu);
  console.log(Object.keys(sils).length, 'silhouettes,', contenu.length, 'octets');
  await b.close();
})().then(() => require("./simplifier-silhouettes.cjs"));
