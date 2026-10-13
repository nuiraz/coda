/* =====================================================================
   Photos de paysage automatiques (Wikidata / Wikimedia Commons)
   - Pays : la photo officielle du pays sur Wikidata (souvent un paysage), sinon celle de sa capitale.
   - Villes : la photo de la ville sur Wikidata (une vraie vue, pas un montage de plusieurs photos).
   - Toutes les autres cartes dont la photo est une carte, un drapeau, un blason ou un montage : remplacée.
   Les photos choisies par l'admin (corrections, photos envoyées) restent prioritaires.
   ===================================================================== */
const IMAGE_RATEE = /flag|drapeau|bandera|bandeira|flagge|\bmap\b|_map|map_|carte|karte|locator|location|orthographic|relief|topographic|coat[ _]of[ _]arms|blason|armoiries|wappen|emblem|seal[ _]of|logo|montage|collage|mosaic|mosaique|composite|\.svg$/i;
const fichierCommons = (uri) => { try { return decodeURIComponent(String(uri).split("/Special:FilePath/")[1] || "").replace(/_/g, " "); } catch { return ""; } };
const urlCommons = (f, w = 640) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, "_"))}?width=${w}`;
async function sparql(q) {
  const r = await fetch("https://query.wikidata.org/sparql", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" }, body: "query=" + encodeURIComponent(q) });
  if (!r.ok) throw new Error("Wikidata " + r.status);
  return (await r.json()).results?.bindings || [];
}
function memoriserPaysages(vus) { try { localStorage.setItem(PAYSAGES_KEY, JSON.stringify({ t: Date.now(), data: PAYSAGES, vus: [...vus] })); } catch {} }
function paysagesVus() { try { const j = JSON.parse(localStorage.getItem(PAYSAGES_KEY)); if (j && Date.now() - j.t < 30 * 864e5) return new Set(j.vus || []); } catch {} return new Set(); }
// Met à jour les images déjà affichées
function rafraichirPaysages() {
  for (const el of document.querySelectorAll(".card[data-id]")) {
    const src = photoDe(el.dataset.id), img = el.querySelector(".art img.photo");
    if (src && img && img.getAttribute("src") !== src) img.src = src;
  }
  if (typeof rafraichirPhotos === "function") rafraichirPhotos();
}
let chargementPaysages = null;
function chargerPaysages() {
  if (S.photos === false) return Promise.resolve();
  return (chargementPaysages ||= (async () => {
    const vus = paysagesVus();
    const poser = (id, f, titre) => { if (f && !IMAGE_RATEE.test(f)) { PAYSAGES[id] = { src: urlCommons(f), file: f, titre: titre || PHOTOS[id]?.titre || PHOTOS_WIKI[id] || BY_ID[id]?.nom }; return true; } return false; };
    try {
      // 1. Les pays, par leur code ISO : photo du pays, sinon photo de la capitale
      const pays = CARDS.filter((c) => c.type === "pays" && c.code && !vus.has(c.id));
      if (pays.length) {
        const lignes = await sparql(`SELECT ?iso ?img ?capImg WHERE { ?c wdt:P297 ?iso . FILTER NOT EXISTS { ?c wdt:P576 ?fin } OPTIONAL { ?c wdt:P18 ?img } OPTIONAL { ?c wdt:P36 ?cap . ?cap wdt:P18 ?capImg } }`);
        const parIso = {};
        for (const l of lignes) { const k = l.iso?.value; if (!k) continue; (parIso[k] ||= { img: [], cap: [] }); if (l.img) parIso[k].img.push(fichierCommons(l.img.value)); if (l.capImg) parIso[k].cap.push(fichierCommons(l.capImg.value)); }
        for (const c of pays) {
          const x = parIso[c.code.toUpperCase()];
          if (x) [...new Set(x.img), ...new Set(x.cap)].some((f) => poser(c.id, f, c.nom));
          vus.add(c.id);
        }
        memoriserPaysages(vus); rafraichirPaysages();
      }
      // 2. Villes + cartes dont la photo actuelle est ratée : élément Wikidata de l'article, puis sa photo
      if (chargementPhotos) await chargementPhotos.catch(() => {});
      const cibles = Object.keys(PHOTOS_WIKI).filter((id) => BY_ID[id] && !vus.has(id) && !PAYSAGES_EXCLUS.has(id) && BY_ID[id].type !== "pays"
        && (BY_ID[id].type === "ville" || !PHOTOS[id] || IMAGE_RATEE.test(PHOTOS[id].file || "")));
      for (let i = 0; i < cibles.length; i += 50) {
        const lot = cibles.slice(i, i + 50), titreDe = (id) => PHOTOS[id]?.titre || PHOTOS_WIKI[id];
        const j = await requeteWiki({ redirects: "1", prop: "pageprops", ppprop: "wikibase_item", titles: lot.map(titreDe).join("|") });
        const alias = {};
        for (const x of [...(j.query?.normalized || []), ...(j.query?.redirects || [])]) alias[x.from] = x.to;
        const fin = (t) => { for (let k = 0; k < 4 && alias[t]; k++) t = alias[t]; return t; };
        const qid = {};
        for (const id of lot) { const pg = (j.query?.pages || []).find((p) => p.title === fin(titreDe(id))); if (pg?.pageprops?.wikibase_item) qid[id] = pg.pageprops.wikibase_item; }
        const qs = [...new Set(Object.values(qid))];
        if (qs.length) {
          const lignes = await sparql(`SELECT ?item ?img WHERE { VALUES ?item { ${qs.map((q) => "wd:" + q).join(" ")} } ?item wdt:P18 ?img }`);
          const parQ = {};
          for (const l of lignes) { const q = l.item.value.split("/").pop(); (parQ[q] ||= []).push(fichierCommons(l.img.value)); }
          for (const id of lot) (parQ[qid[id]] || []).some((f) => poser(id, f));
        }
        lot.forEach((id) => vus.add(id));
        memoriserPaysages(vus); rafraichirPaysages();
      }
    } catch (e) { console.info("Paysages Wikidata indisponibles :", e.message); }
  })().finally(() => { chargementPaysages = null; }));
}
addEventListener("DOMContentLoaded", () => setTimeout(chargerPaysages, 2500));
