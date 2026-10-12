// Extrait le catalogue complet des cartes depuis le jeu (chargé dans Chromium) vers outils/cartes.json.
// Utilisation : node outils/extraire-cartes.cjs   (puis node outils/generer-pages-cartes.cjs)
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new"] });
  const p = await b.newPage();
  await p.goto("file://" + path.resolve(__dirname, "../worldcards/index.html"));
  await p.waitForTimeout(1500);
  const data = await p.evaluate(() => ({
    types: TYPES, raretes: Object.fromEntries(Object.entries(RARETES).map(([k, r]) => [k, { nom: r.nom, ordre: r.ordre }])),
    continents: Object.fromEntries(Object.entries(CONTINENTS).map(([k, c]) => [k, { nom: c.nom, emoji: c.emoji }])),
    nomPays: NOM_PAYS,
    cartes: CARDS.filter((c) => c.univers === "monde" && c.type !== "secrete").map((c) => {
      const st = COMBAT.stats(c.id, c.type, c.rarete, [0, 0, 0], 1, false, false);
      return { id: c.id, nom: c.nom, type: c.type, rarete: c.rarete, num: c.num, pays: c.pays || (c.type === "pays" ? c.code : null), code: c.code || null, capitale: c.capitale || null,
        continent: c.continent || null, anecdote: c.anecdote || c.desc || "", emoji: c.emoji || null, lat: c.lat ?? null, lon: c.lon ?? null, wiki: (typeof PHOTOS_WIKI !== "undefined" && PHOTOS_WIKI[c.id]) || c.wiki || null,
        saisonnier: c.saisonnier || null, sous: sousTitre(c), atk: st.atk, def: st.def, pv: st.pv, talent: COMBAT.TALENTS[st.talent]?.nom || null, special: (COMBAT.SPECIAUX[c.type] || {}).nom || null };
    }),
  }));
  require("fs").writeFileSync(path.join(__dirname, "cartes.json"), JSON.stringify(data));
  console.log(data.cartes.length, "cartes extraites");
  await b.close();
})();
