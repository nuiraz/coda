"use strict";

/* =====================================================================
   Outils
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = (n) => n.toLocaleString("fr-FR");
const today = () => new Date().toISOString().slice(0, 10);
const court = (s) => s.split(" (")[0];
function weighted(items, weightOf) {
  const total = items.reduce((s, x) => s + weightOf(x), 0);
  let r = Math.random() * total;
  for (const x of items) { r -= weightOf(x); if (r <= 0) return x; }
  return items[items.length - 1];
}

/* =====================================================================
   Raretés et cartes
   ===================================================================== */
const RARETES = {
  "commun":     { nom: "Commune",      gems: "◆",    ordre: 0, poids: 62,  doublon: 5,   prix: 60 },
  "peu-commun": { nom: "Peu commune",  gems: "◆◆",   ordre: 1, poids: 24,  doublon: 10,  prix: 120 },
  "rare":       { nom: "Rare",         gems: "◆◆◆",  ordre: 2, poids: 10,  doublon: 25,  prix: 300 },
  "epique":     { nom: "Épique",       gems: "◆◆◆◆", ordre: 3, poids: 3.3, doublon: 60,  prix: 700 },
  "legendaire": { nom: "Légendaire",   gems: "★",    ordre: 4, poids: 0.7, doublon: 150, prix: 1500 },
  "secrete":    { nom: "Secrète",      gems: "✦",    ordre: 5 },
  "perso":      { nom: "Personnelle",  gems: "✎",    ordre: 0 },
};
const TYPES = {
  pays: "Pays", ville: "Ville", monument: "Monument", merveille: "Merveille", secrete: "Secrète", jeu: "Jeu", perso: "Ma carte",
};
const PRIX_BOOSTER = 120;
const CARTES_PAR_BOOSTER = 5;

const CARDS = [];
const BY_ID = {};
const add = (c) => { CARDS.push(c); BY_ID[c.id] = c; };

PAYS_BRUTS
  .map(([code, nom, capitale, continent, anecdote]) => ({ code, nom, capitale, continent, anecdote }))
  .forEach((p, i) => add({ id: "pays:" + p.code, univers: "monde", type: "pays", rarete: "commun", num: i + 1, ...p }));
const NOM_PAYS = Object.fromEntries(PAYS_BRUTS.map((p) => [p[0], p[1]]));
const CONT_PAYS = Object.fromEntries(PAYS_BRUTS.map((p) => [p[0], p[3]]));
VILLES_BRUTES.forEach(([id, nom, pays, lat, lon, emoji, anecdote], i) =>
  add({ id: "ville:" + id, univers: "monde", type: "ville", rarete: "peu-commun", num: i + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] }));
MONUMENTS_BRUTS.forEach(([id, nom, pays, lat, lon, emoji, rarete, anecdote], i) =>
  add({ id: "monu:" + id, univers: "monde", type: "monument", rarete, num: i + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] }));
MERVEILLES_BRUTES.forEach(([id, nom, pays, lat, lon, emoji, groupe, anecdote], i) =>
  add({ id: "merv:" + id, univers: "monde", type: "merveille", rarete: "legendaire", num: i + 1, nom, pays, lat, lon, emoji, groupe, anecdote, continent: CONT_PAYS[pays] }));
SECRETES_MONDE.forEach(([id, nom, emoji, condition, anecdote], i) =>
  add({ id: "secret:" + id, univers: "monde", type: "secrete", rarete: "secrete", num: i + 1, nom, emoji, condition, anecdote }));
JEUX_BRUTS.forEach(([id, nom, annee, studio, epoque, emoji, rarete, anecdote], i) =>
  add({ id: "jeu:" + id, univers: "gaming", type: "jeu", rarete, num: i + 1, nom, annee, studio, epoque, emoji, anecdote }));
SECRETES_GAMING.forEach(([id, nom, emoji, condition, anecdote], i) =>
  add({ id: "gsecret:" + id, univers: "gaming", type: "secrete", rarete: "secrete", num: i + 1, nom, emoji, condition, anecdote }));

const of = (u, type) => CARDS.filter((c) => c.univers === u && (!type || c.type === type));

/* =====================================================================
   Sauvegarde
   ===================================================================== */
const SAVE_KEY = "worldcards:v1";
const nouvelleSauvegarde = () => ({
  coins: 200, owned: {}, nouveaux: {}, recents: [], badges: {},
  boosters: { monde: 3, gaming: 2 }, daily: {}, ouverts: 0,
  quiz: { monde: { serie: 0, record: 0, bonnes: 0, total: 0 }, gaming: { serie: 0, record: 0, bonnes: 0, total: 0 } },
  univers: "monde", vue: "accueil", theme: "",
});
function charger() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.owned) return { ...nouvelleSauvegarde(), ...s }; } catch {}
  return nouvelleSauvegarde();
}
let S = charger();
const sauver = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} };

// Collections personnelles et illustrations (images) : IndexedDB, plus spacieux que localStorage
const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open("worldcards", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(this.db = r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
};
let PERSO = { collections: [], illus: {} };
const sauverPerso = () => idb.set("perso", PERSO).catch((e) => toast("⚠ Impossible d'enregistrer l'image : " + e.message));

const has = (id) => (S.owned[id] || 0) > 0;
const count = (ids) => ids.filter(has).length;

/* =====================================================================
   Carte du monde : silhouettes et atlas
   ===================================================================== */
const FEATURES = {};
topojson.feature(CARTE_MONDE, CARTE_MONDE.objects.countries).features.forEach((f) => { if (f.id) FEATURES[f.id] = f; });
const NUM_TO_CODE = Object.fromEntries(Object.entries(CODES_NUMERIQUES).map(([c, n]) => [n, c]));
const POINTS_ABSENTS = { TV: [179.2, -8.52] }; // pays trop petits pour la carte au 1:50m

// Garde le territoire principal (sans les territoires lointains comme la Guyane pour la France)
function territoirePrincipal(f) {
  if (f.geometry.type !== "MultiPolygon") return f;
  const polys = f.geometry.coordinates.map((c) => {
    const g = { type: "Feature", geometry: { type: "Polygon", coordinates: c } };
    return { c, aire: d3.geoArea(g), centre: d3.geoCentroid(g) };
  });
  const big = polys.reduce((a, b) => (b.aire > a.aire ? b : a));
  const gardes = polys.filter((p) => p.aire >= big.aire * 0.005 && d3.geoDistance(p.centre, big.centre) < 0.6);
  return { type: "Feature", geometry: { type: "MultiPolygon", coordinates: gardes.map((p) => p.c) } };
}
const silCache = {};
function silhouette(code) {
  if (code in silCache) return silCache[code];
  const f0 = FEATURES[CODES_NUMERIQUES[code]];
  if (!f0) return (silCache[code] = "");
  const f = territoirePrincipal(f0);
  const [lon, lat] = d3.geoCentroid(f);
  const proj = d3.geoAzimuthalEqualArea().rotate([-lon, -lat]).fitExtent([[3, 3], [97, 97]], f);
  const d = d3.geoPath(proj).digits(1)(f);
  return (silCache[code] = `<svg class="sil" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="${d}"/></svg>`);
}

/* =====================================================================
   Rendu d'une carte
   ===================================================================== */
const assombrir = (col) => `color-mix(in srgb, ${col} 55%, #000)`;
const degrade = (col) => `linear-gradient(150deg, ${col}, ${assombrir(col)})`;
function couleurCarte(c) {
  if (c.type === "secrete") return "#2a1840";
  if (c.univers === "gaming") return c.epoque ? EPOQUES[c.epoque].couleur : "#e0913a";
  return CONTINENTS[c.continent]?.couleur || "#888";
}
function sousTitre(c) {
  switch (c.type) {
    case "pays": return "🏛️ " + court(c.capitale);
    case "ville": case "monument": return "📍 " + NOM_PAYS[c.pays];
    case "merveille": return c.groupe === "antiques" ? "🏺 Merveille antique" : "🌟 Merveille moderne";
    case "jeu": return `${c.annee} · ${c.studio}`;
    case "secrete": return "Carte secrète";
    case "perso": return c.sous || "Ma collection";
  }
  return "";
}
function totalType(c) {
  if (c.type === "perso") return "";
  return of(c.univers, c.type).length;
}
function illustrationDe(c) { return c.image || PERSO.illus[c.id] || null; }

function cardHTML(c, opts = {}) {
  const locked = opts.locked ?? (c.type !== "perso" && !has(c.id));
  const r = c.rarete;
  const col = couleurCarte(c);
  if (locked) {
    const secret = c.type === "secrete";
    const sil = c.type === "pays" ? silhouette(c.code) : "";
    return `<div class="card locked${secret ? " secret-locked" : ""}" data-id="${esc(c.id)}" data-r="${r}" tabindex="0" role="button" aria-label="${esc(secret ? "Carte secrète" : c.nom)} (non possédée)">
      <div class="in"><div class="head"><span>${TYPES[c.type]}</span><span>#${String(c.num).padStart(3, "0")}</span></div>
      <div class="art">${sil}<span class="q">${secret ? "✦" : "?"}</span></div>
      <div class="name">${secret ? "???" : esc(c.nom)}</div><div class="sub">${secret ? "Terminez une collection" : "Non découverte"}</div></div></div>`;
  }
  let art = "";
  const ill = illustrationDe(c);
  if (c.type === "pays") art = silhouette(c.code) + `<img class="flag" src="flags/${c.code.toLowerCase()}.svg" alt="Drapeau : ${esc(c.nom)}" loading="lazy">`;
  else if (["ville", "monument", "merveille"].includes(c.type)) art = silhouette(c.pays) + `<span class="emoji">${c.emoji}</span>`;
  else art = `<span class="emoji">${esc(c.emoji || "🃏")}</span>`;
  if (ill) art += `<img class="ill" src="${esc(ill)}" alt="Illustration : ${esc(c.nom)}" loading="lazy">`;
  if (c.type === "jeu") art += `<span class="corner">${c.annee}</span>`;
  const n = S.owned[c.id] || 0;
  const tot = totalType(c);
  return `<div class="card" data-id="${esc(c.id)}" data-r="${r}" tabindex="0" role="button" aria-label="${esc(c.nom)}">
    ${opts.compte && n > 1 ? `<span class="badge-count">×${n}</span>` : ""}${opts.compte && S.nouveaux[c.id] ? `<span class="badge-new">NEW</span>` : ""}
    <div class="in"><div class="head"><span>${TYPES[c.type]}${c.continent && c.type === "pays" ? " · " + CONTINENTS[c.continent].nom : ""}</span><span class="gems" title="${RARETES[r].nom}">${RARETES[r].gems}</span></div>
    <div class="art" style="--g:${degrade(col)}">${art}</div>
    <div class="name">${esc(c.nom)}</div><div class="sub">${esc(sousTitre(c))}</div>
    ${tot ? `<span class="num">${c.num}/${tot}</span>` : ""}</div></div>`;
}

/* =====================================================================
   Progression : secrets et badges
   ===================================================================== */
function idsCondition(cond) {
  const [k, v] = cond.split(":");
  if (k === "continent") return of("monde", "pays").filter((c) => c.continent === v).map((c) => c.id);
  if (k === "merveilles") return of("monde", "merveille").filter((c) => c.groupe === v).map((c) => c.id);
  if (k === "tous-les-pays") return of("monde", "pays").map((c) => c.id);
  if (k === "epoque") return of("gaming", "jeu").filter((c) => c.epoque === v).map((c) => c.id);
  if (k === "tous-les-jeux") return of("gaming", "jeu").map((c) => c.id);
  return [];
}
function libelleCondition(cond) {
  const [k, v] = cond.split(":");
  if (k === "continent") return `Collectionnez tous les pays d'${CONTINENTS[v].nom}`;
  if (k === "merveilles") return `Collectionnez les 7 merveilles ${v === "antiques" ? "du monde antique" : "du monde moderne"}`;
  if (k === "tous-les-pays") return "Collectionnez les 195 pays";
  if (k === "epoque") return `Collectionnez tous les jeux de l'époque « ${EPOQUES[v].court} »`;
  if (k === "tous-les-jeux") return "Collectionnez toute l'encyclopédie du jeu vidéo";
  return "";
}

const RECOMPENSE = { bronze: 50, argent: 120, or: 300 };
function badgesDe(u) {
  const list = [];
  const frac = (ids) => [count(ids), ids.length];
  if (u === "monde") {
    for (const [k, ct] of Object.entries(CONTINENTS)) {
      const ids = of("monde", "pays").filter((c) => c.continent === k).map((c) => c.id);
      [["bronze", 0.25], ["argent", 0.5], ["or", 1]].forEach(([niv, s]) =>
        list.push({ id: `cont-${k}-${niv}`, nom: `${ct.nom} — ${niv}`, emoji: ct.emoji, niveau: niv, desc: `${Math.round(s * 100)} % des pays d'${ct.nom}`, prog: () => frac(ids), seuil: s }));
    }
    list.push({ id: "villes", nom: "Globe-trotteur", emoji: "🧳", niveau: "or", desc: "Toutes les villes", prog: () => frac(of("monde", "ville").map((c) => c.id)), seuil: 1 });
    list.push({ id: "monuments", nom: "Bâtisseur", emoji: "🏗️", niveau: "or", desc: "Tous les monuments", prog: () => frac(of("monde", "monument").map((c) => c.id)), seuil: 1 });
    list.push({ id: "merv-mod", nom: "Merveilles modernes", emoji: "🌟", niveau: "or", desc: "Les 7 merveilles du monde moderne", prog: () => frac(idsCondition("merveilles:modernes")), seuil: 1 });
    list.push({ id: "merv-ant", nom: "Merveilles antiques", emoji: "🏺", niveau: "or", desc: "Les 7 merveilles du monde antique", prog: () => frac(idsCondition("merveilles:antiques")), seuil: 1 });
    list.push({ id: "collec-100", nom: "Collectionneur", emoji: "📚", niveau: "argent", desc: "100 cartes différentes", prog: () => [Math.min(100, count(of("monde").map((c) => c.id))), 100], seuil: 1 });
    list.push({ id: "secret-1", nom: "Chasseur de secrets", emoji: "🔮", niveau: "bronze", desc: "Débloquer une carte secrète", prog: () => [Math.min(1, count(of("monde", "secrete").map((c) => c.id))), 1], seuil: 1 });
    list.push({ id: "maitre", nom: "Maître du monde", emoji: "👑", niveau: "or", desc: "Les 195 pays", prog: () => frac(idsCondition("tous-les-pays")), seuil: 1 });
  } else {
    for (const [k, ep] of Object.entries(EPOQUES)) {
      const ids = idsCondition("epoque:" + k);
      [["bronze", 0.25], ["argent", 0.5], ["or", 1]].forEach(([niv, s]) =>
        list.push({ id: `ep-${k}-${niv}`, nom: `${ep.court} — ${niv}`, emoji: ep.emoji, niveau: niv, desc: `${Math.round(s * 100)} % des jeux « ${ep.court} »`, prog: () => frac(ids), seuil: s }));
    }
    list.push({ id: "legendes", nom: "Légendes du jeu vidéo", emoji: "🏆", niveau: "or", desc: "Tous les jeux légendaires", prog: () => frac(of("gaming", "jeu").filter((c) => c.rarete === "legendaire").map((c) => c.id)), seuil: 1 });
    list.push({ id: "createur", nom: "Créateur", emoji: "🎨", niveau: "argent", desc: "Une collection perso d'au moins 3 cartes", prog: () => [Math.min(3, Math.max(0, ...PERSO.collections.map((c) => c.cartes.length))), 3], seuil: 1 });
    list.push({ id: "artiste", nom: "Artiste", emoji: "🖌️", niveau: "bronze", desc: "Ajouter 3 illustrations à vous", prog: () => [Math.min(3, Object.keys(PERSO.illus).length + PERSO.collections.reduce((s, c) => s + c.cartes.filter((x) => x.image).length, 0)), 3], seuil: 1 });
    list.push({ id: "gsecret-1", nom: "Easter egg", emoji: "🥚", niveau: "bronze", desc: "Débloquer une carte secrète", prog: () => [Math.min(1, count(of("gaming", "secrete").map((c) => c.id))), 1], seuil: 1 });
    list.push({ id: "encyclo", nom: "Encyclopédiste", emoji: "📖", niveau: "or", desc: "Toute l'encyclopédie", prog: () => frac(idsCondition("tous-les-jeux")), seuil: 1 });
  }
  return list.map((b) => { const [n, t] = b.prog(); return { ...b, n, t, ok: t > 0 && n / t >= b.seuil }; });
}

const aReveler = [];
// Vérifie secrets et badges après chaque gain ; renvoie vrai si quelque chose a été débloqué
function verifierProgression() {
  let changed = false;
  for (const c of CARDS.filter((x) => x.type === "secrete" && !has(x.id))) {
    const ids = idsCondition(c.condition);
    if (ids.length && ids.every(has)) {
      S.owned[c.id] = 1; S.nouveaux[c.id] = 1; S.recents = [c.id, ...S.recents].slice(0, 12);
      aReveler.push({ kind: "secret", card: c }); changed = true;
    }
  }
  const obtenus = [];
  for (const u of ["monde", "gaming"]) for (const b of badgesDe(u)) {
    if (b.ok && !S.badges[b.id]) { S.badges[b.id] = today(); S.coins += RECOMPENSE[b.niveau]; obtenus.push(b); changed = true; }
  }
  const gain = obtenus.reduce((t, b) => t + RECOMPENSE[b.niveau], 0);
  if (obtenus.length === 1) toast(`🏅 Badge obtenu : <b>${esc(obtenus[0].nom)}</b> · +${gain} 🪙`);
  else if (obtenus.length > 1) toast(`🏅 ${obtenus.length} badges obtenus : ${obtenus.map((b) => `<b>${esc(b.nom)}</b>`).join(", ")} · +${gain} 🪙`, 5000);
  if (changed) { sauver(); majCoins(); }
  revelerSuivant();
  return changed;
}
function revelerSuivant() {
  if (!aReveler.length || !$("#modal").classList.contains("hidden")) return;
  const ev = aReveler.shift();
  ouvrirModal(`<div class="reveal"><h2>✦ Carte secrète débloquée !</h2>
    <p class="muted">${esc(libelleCondition(ev.card.condition))} : c'est fait.</p>
    ${cardHTML(ev.card, { locked: false })}
    <p class="anecdote" style="text-align:left;background:var(--panel2);border-radius:12px;padding:10px 14px">${esc(ev.card.anecdote)}</p>
    <button class="btn primary" data-close>Incroyable !</button></div>`);
}

function gagner(id) {
  const neuf = !has(id);
  S.owned[id] = (S.owned[id] || 0) + 1;
  if (neuf) { S.nouveaux[id] = 1; S.recents = [id, ...S.recents.filter((x) => x !== id)].slice(0, 12); }
  return neuf;
}

// Confirmation dans la page (les fenêtres confirm() du navigateur ne sont pas toujours disponibles)
function confirmer(message, libelle, action) {
  ouvrirModal(`<h2 style="margin-top:0">Confirmer</h2><p>${esc(message)}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-close>Annuler</button><button class="btn primary" id="okConfirm" style="background:var(--bad);border-color:var(--bad)">${esc(libelle)}</button></div>`);
  $("#okConfirm").onclick = action;
}

/* =====================================================================
   Interface générale
   ===================================================================== */
function majCoins() { $("#coins").textContent = fmt(S.coins); }
function toast(html, ms = 3200) {
  const t = document.createElement("div"); t.className = "toast"; t.innerHTML = html;
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), ms);
}
function ouvrirModal(html, onClose) {
  const m = $("#modal");
  m.innerHTML = `<div class="box"><button class="close" data-close aria-label="Fermer">✕</button>${html}</div>`;
  m.classList.remove("hidden");
  m._onClose = onClose;
  document.body.style.overflow = "hidden";
}
function fermerModal() {
  const m = $("#modal");
  if (m.classList.contains("hidden")) return;
  m.classList.add("hidden"); m.innerHTML = "";
  document.body.style.overflow = "";
  const cb = m._onClose; m._onClose = null;
  if (cb) cb();
  revelerSuivant();
}
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" || e.target.closest("[data-close]")) fermerModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerModal(); });

const dailyDispo = (u) => S.daily[u] !== today();
const NAV = {
  monde: [["accueil", "🏠", "Accueil"], ["boosters", "🎁", "Boosters"], ["album", "📚", "Album"], ["atlas", "🗺️", "Atlas"], ["badges", "🏅", "Badges"], ["quiz", "❓", "Quiz"]],
  gaming: [["accueil", "🏠", "Accueil"], ["boosters", "🎁", "Boosters"], ["album", "📚", "Encyclopédie"], ["collections", "🎨", "Mes collections"], ["badges", "🏅", "Badges"], ["quiz", "❓", "Quiz"]],
};
function renderNav() {
  $$("#univers button").forEach((b) => b.classList.toggle("on", b.dataset.u === S.univers));
  const items = NAV[S.univers];
  if (!items.some(([v]) => v === S.vue)) S.vue = "accueil";
  const pill = S.boosters[S.univers] + (dailyDispo(S.univers) ? 1 : 0);
  $("#nav").innerHTML = items.map(([v, ic, label]) =>
    `<button data-v="${v}" class="${S.vue === v ? "on" : ""}"><span class="ic">${ic}</span><span>${label}</span>${v === "boosters" && pill ? `<span class="pill">${pill}</span>` : ""}</button>`).join("");
  $$("#nav button").forEach((b) => b.onclick = () => aller(b.dataset.v));
}
function aller(vue, opts) {
  S.vue = vue; sauver(); renderNav();
  const v = $("#view"); v.innerHTML = "";
  ({ accueil: vueAccueil, boosters: vueBoosters, album: vueAlbum, atlas: vueAtlas, badges: vueBadges, quiz: vueQuiz, collections: vueCollections })[vue](v, opts);
  window.scrollTo({ top: 0 });
}
$$("#univers button").forEach((b) => b.onclick = () => { S.univers = b.dataset.u; aller(S.vue); });

// Clic sur n'importe quelle carte : fiche détaillée
document.addEventListener("click", (e) => {
  const el = e.target.closest(".card[data-id]");
  if (!el || el.closest(".opening") || el.closest(".detail") || el.closest(".reveal") || el.closest("[data-noclick]")) return;
  const id = el.dataset.id;
  if (id.startsWith("perso:")) return ouvrirCartePerso(id);
  if (BY_ID[id]) ficheCarte(BY_ID[id]);
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches?.(".card[data-id]")) e.target.click(); });

/* =====================================================================
   Fiche détaillée
   ===================================================================== */
function ficheCarte(c) {
  const owned = has(c.id);
  if (S.nouveaux[c.id]) { delete S.nouveaux[c.id]; sauver(); }
  const rows = [];
  if (c.type === "pays") rows.push(["Capitale", c.capitale], ["Continent", CONTINENTS[c.continent].nom]);
  if (["ville", "monument", "merveille"].includes(c.type)) rows.push(["Pays", NOM_PAYS[c.pays]], ["Continent", CONTINENTS[c.continent].nom], ["Coordonnées", `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? "N" : "S"}, ${Math.abs(c.lon).toFixed(2)}° ${c.lon >= 0 ? "E" : "O"}`]);
  if (c.type === "merveille") rows.push(["Liste", c.groupe === "antiques" ? "Sept merveilles du monde antique" : "Sept nouvelles merveilles du monde (2007)"]);
  if (c.type === "jeu") rows.push(["Sortie", c.annee], ["Studio", c.studio], ["Époque", EPOQUES[c.epoque].nom]);
  if (c.type === "secrete" && !owned) rows.push(["Pour la débloquer", libelleCondition(c.condition)]);
  const secretVerrou = c.type === "secrete" && !owned;
  const ids = secretVerrou ? idsCondition(c.condition) : [];
  const prix = RARETES[c.rarete].prix;
  const lieu = c.type === "pays" || c.lat !== undefined;
  ouvrirModal(`<div class="detail">
      <div>${cardHTML(c)}</div>
      <div>
        <div class="row"><span class="rbadge" data-r="${c.rarete}">${RARETES[c.rarete].nom}</span><span class="muted">${TYPES[c.type]} n° ${c.num}${totalType(c) ? " / " + totalType(c) : ""}</span></div>
        <h2>${secretVerrou ? "Carte secrète" : esc(c.nom)}</h2>
        <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        ${secretVerrou
          ? `<div class="anecdote"><b>Progression</b>${count(ids)} / ${ids.length}<div class="bar" style="margin-top:6px"><i style="width:${(count(ids) / ids.length) * 100}%"></i></div></div>`
          : owned ? `<div class="anecdote"><b>💡 Le saviez-vous ?</b>${esc(c.anecdote)}</div>`
          : `<div class="anecdote"><b>🔒 Anecdote cachée</b>Collectionnez cette carte pour découvrir son anecdote.</div>`}
        <div class="row">
          ${!owned && !secretVerrou ? `<button class="btn primary" id="craft" ${S.coins < prix ? "disabled" : ""}>Obtenir pour ${fmt(prix)} 🪙</button>` : ""}
          ${owned && c.univers === "monde" && lieu ? `<button class="btn" id="voirAtlas">🗺️ Voir sur l'atlas</button>` : ""}
          ${owned && c.type === "jeu" ? `<button class="btn" id="illus">🎨 ${PERSO.illus[c.id] ? "Changer" : "Ajouter"} mon illustration</button>${PERSO.illus[c.id] ? `<button class="btn" id="illusDel">Retirer l'illustration</button>` : ""}` : ""}
          ${(S.owned[c.id] || 0) > 1 ? `<span class="muted">Obtenue ${S.owned[c.id]} fois (doublons convertis en pièces)</span>` : ""}
        </div>
        ${!owned && !secretVerrou && S.coins < prix ? `<p class="muted" style="font-size:13px">Il vous manque ${fmt(prix - S.coins)} 🪙. Gagnez-en au quiz !</p>` : ""}
      </div></div>`);
  $("#craft")?.addEventListener("click", () => {
    if (S.coins < prix) return;
    S.coins -= prix; gagner(c.id); sauver(); majCoins();
    toast(`✨ <b>${esc(c.nom)}</b> rejoint votre collection !`);
    fermerModal(); verifierProgression(); aller(S.vue);
  });
  $("#voirAtlas")?.addEventListener("click", () => { fermerModal(); aller("atlas", { focus: c }); });
  $("#illus")?.addEventListener("click", async () => {
    const img = await choisirImage(); if (!img) return;
    PERSO.illus[c.id] = img; await sauverPerso(); fermerModal(); verifierProgression(); aller(S.vue); ficheCarte(c);
  });
  $("#illusDel")?.addEventListener("click", async () => { delete PERSO.illus[c.id]; await sauverPerso(); fermerModal(); aller(S.vue); ficheCarte(c); });
}

/* =====================================================================
   Accueil
   ===================================================================== */
function vueAccueil(v) {
  const u = S.univers;
  const all = of(u).filter((c) => c.type !== "secrete");
  const secrets = of(u, "secrete");
  const badges = badgesDe(u);
  const groupes = u === "monde"
    ? Object.entries(CONTINENTS).map(([k, ct]) => [ct.emoji + " " + ct.nom, of("monde", "pays").filter((c) => c.continent === k)])
      .concat([["🏙️ Villes", of("monde", "ville")], ["🏛️ Monuments", of("monde", "monument")], ["🌟 Merveilles", of("monde", "merveille")]])
    : Object.entries(EPOQUES).map(([k, ep]) => [ep.emoji + " " + ep.court, of("gaming", "jeu").filter((c) => c.epoque === k)]);
  const recents = S.recents.map((id) => BY_ID[id]).filter((c) => c && c.univers === u).slice(0, 6);
  v.innerHTML = `
    <div class="hero">
      <div class="panel">
        <h1>${u === "monde" ? "Collectionner le monde" : "Les cartes du gaming"}</h1>
        <p class="muted" style="margin:0">${u === "monde"
          ? "Chaque carte est un pays, une ville, un monument ou une merveille du monde. Ouvrez des boosters, gagnez des badges par continent et complétez l'atlas."
          : "Une encyclopédie du jeu vidéo à collectionner, de Pong à Elden Ring. Et vos propres collections, avec vos illustrations."}</p>
        <div class="statgrid">
          ${u === "monde" ? `<div class="stat"><b>${count(of("monde", "pays").map((c) => c.id))}/195</b><span>pays</span></div>` : `<div class="stat"><b>${count(of("gaming", "jeu").map((c) => c.id))}/${of("gaming", "jeu").length}</b><span>jeux</span></div>`}
          <div class="stat"><b>${count(all.map((c) => c.id))}/${all.length}</b><span>cartes</span></div>
          <div class="stat"><b>${count(secrets.map((c) => c.id))}/${secrets.length}</b><span>cartes secrètes</span></div>
          <div class="stat"><b>${badges.filter((b) => S.badges[b.id]).length}/${badges.length}</b><span>badges</span></div>
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn primary" id="goBooster">🎁 ${S.boosters[u] ? `Ouvrir un booster (${S.boosters[u]})` : "Boosters"}</button>
          ${dailyDispo(u) ? `<button class="btn" id="daily">🎉 Cadeau du jour</button>` : ""}
          <button class="btn" id="goQuiz">❓ Quiz (+20 🪙 par bonne réponse)</button>
        </div>
      </div>
      <div class="panel progress-list">
        <h3 style="margin-top:0">Progression</h3>
        ${groupes.map(([nom, list]) => { const n = count(list.map((c) => c.id)); return `<div class="p"><span>${nom}</span><div class="bar"><i style="width:${(n / list.length) * 100}%"></i></div><span>${n}/${list.length}</span></div>`; }).join("")}
      </div>
    </div>
    ${recents.length ? `<div class="sectiontitle"><h3>Dernières découvertes</h3></div><div class="cards">${recents.map((c) => cardHTML(c, { compte: true })).join("")}</div>` : ""}
    <div class="sectiontitle"><h3>✦ Cartes secrètes</h3><span class="muted">Terminez une collection entière pour les débloquer</span></div>
    <div class="cards">${secrets.map((c) => cardHTML(c)).join("")}</div>`;
  $("#goBooster").onclick = () => aller("boosters");
  $("#goQuiz").onclick = () => aller("quiz");
  $("#daily")?.addEventListener("click", () => cadeauDuJour(u));
}
function cadeauDuJour(u) {
  if (!dailyDispo(u)) return;
  S.daily[u] = today(); S.boosters[u]++; S.coins += 30; sauver(); majCoins();
  toast("🎉 Cadeau du jour : 1 booster et 30 🪙 !"); aller(S.vue);
}

/* =====================================================================
   Boosters
   ===================================================================== */
function vueBoosters(v) {
  const u = S.univers;
  const nom = u === "monde" ? "Booster Monde" : "Booster Gaming";
  v.innerHTML = `
    <div class="panel" style="text-align:center">
      <h2 style="margin-top:0">${nom}</h2>
      <p class="muted">${CARTES_PAR_BOOSTER} cartes par booster, dont au moins une <b>rare ou mieux</b>. Les doublons sont convertis en pièces.</p>
      <div class="packs">
        <button class="pack ${u}" id="open" ${S.boosters[u] ? "" : "disabled"}>
          ${S.boosters[u] ? `<span class="count">×${S.boosters[u]}</span>` : ""}
          <span class="big">${u === "monde" ? "🌍" : "🎮"}</span><b>${nom}</b><small>${S.boosters[u] ? "Cliquez pour ouvrir" : "Aucun booster"}</small>
        </button>
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn" id="buy" ${S.coins < PRIX_BOOSTER ? "disabled" : ""}>Acheter un booster · ${PRIX_BOOSTER} 🪙</button>
        ${dailyDispo(u) ? `<button class="btn primary" id="daily">🎉 Récupérer le cadeau du jour</button>` : `<span class="muted">Prochain cadeau : demain</span>`}
      </div>
      ${S.coins < PRIX_BOOSTER ? `<p class="muted">Pas assez de pièces ? <a href="#" id="toQuiz">Jouez au quiz</a> : chaque bonne réponse rapporte 20 🪙.</p>` : ""}
    </div>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Chances par carte</h3>
      <div class="row">${Object.entries(RARETES).filter(([r]) => of(u).some((c) => c.rarete === r && c.type !== "secrete"))
        .map(([r, x]) => `<span class="rbadge" data-r="${r}">${x.nom}</span>`).join(" ")}</div>
      <p class="muted" style="margin-bottom:0;font-size:13.5px">Les cartes que vous n'avez pas encore sortent quatre fois plus souvent que vos doublons. Une carte précise vous manque ? Ouvrez-la dans l'album pour l'obtenir contre des pièces.</p>
    </div>`;
  $("#open").onclick = () => ouvrirBooster(u);
  $("#buy").onclick = () => { if (S.coins < PRIX_BOOSTER) return; S.coins -= PRIX_BOOSTER; S.boosters[u]++; sauver(); majCoins(); aller("boosters"); };
  $("#daily")?.addEventListener("click", () => cadeauDuJour(u));
  $("#toQuiz")?.addEventListener("click", (e) => { e.preventDefault(); aller("quiz"); });
}
function tirerBooster(u) {
  const pool = of(u).filter((c) => c.type !== "secrete");
  const rars = Object.keys(RARETES).filter((r) => pool.some((c) => c.rarete === r));
  const out = [];
  for (let i = 0; i < CARTES_PAR_BOOSTER; i++) {
    const opts = i === CARTES_PAR_BOOSTER - 1 ? rars.filter((r) => RARETES[r].ordre >= 2) : rars;
    const r = weighted(opts, (x) => RARETES[x].poids);
    let cands = pool.filter((c) => c.rarete === r && !out.includes(c));
    if (!cands.length) cands = pool.filter((c) => !out.includes(c));
    out.push(weighted(cands, (c) => (has(c.id) ? 1 : 4)));
  }
  return out;
}
function ouvrirBooster(u) {
  if (!S.boosters[u]) return;
  S.boosters[u]--; S.ouverts++;
  const cartes = tirerBooster(u);
  const res = cartes.map((c) => { const neuf = gagner(c.id); const bonus = neuf ? 0 : RARETES[c.rarete].doublon; S.coins += bonus; return { c, neuf, bonus }; });
  sauver(); majCoins();
  ouvrirModal(`<h2 style="margin-top:0;text-align:center">${u === "monde" ? "🌍" : "🎮"} Votre booster</h2>
    <p class="muted" style="text-align:center;margin-top:0">Touchez les cartes pour les retourner</p>
    <div class="opening">${res.map(({ c, neuf, bonus }, i) => `
      <div class="flip" data-i="${i}">
        <div class="face back ${RARETES[c.rarete].ordre >= 2 ? "glow-" + c.rarete : ""}">${u === "monde" ? "🌐" : "🎮"}</div>
        <div class="face front">${neuf ? `<span class="tagnew">NOUVELLE</span>` : `<span class="tagdup">Doublon · +${bonus} 🪙</span>`}${cardHTML(c, { locked: false })}</div>
      </div>`).join("")}</div>
    <div class="row" style="justify-content:center;margin-top:10px">
      <button class="btn" id="flipAll">Tout retourner</button>
      <button class="btn primary hidden" id="again">Ouvrir un autre booster (${S.boosters[u]})</button>
      <button class="btn hidden" id="finish" data-close>Terminer</button>
    </div>`, () => { verifierProgression(); aller(S.vue); });
  const fin = () => {
    if ($$(".flip:not(.done)").length) return;
    $("#flipAll").classList.add("hidden"); $("#finish").classList.remove("hidden");
    if (S.boosters[u]) $("#again").classList.remove("hidden");
  };
  $$(".flip").forEach((f) => f.addEventListener("click", () => { f.classList.add("done"); fin(); }));
  $("#flipAll").onclick = () => { $$(".flip").forEach((f, i) => setTimeout(() => { f.classList.add("done"); fin(); }, i * 140)); };
  $("#again").onclick = () => {
    const m = $("#modal"); m._onClose = null; fermerModal();
    verifierProgression(); aller(S.vue);
    if ($("#modal").classList.contains("hidden")) ouvrirBooster(u); // sinon une carte secrète est en train d'être révélée
  };
}

/* =====================================================================
   Album / Encyclopédie
   ===================================================================== */
const filtres = { monde: { type: "tout", cont: "tout", possedees: false, q: "" }, gaming: { epoque: "tout", possedees: false, q: "" } };
const sansAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function vueAlbum(v) {
  const u = S.univers, f = filtres[u];
  const chips = u === "monde"
    ? [["tout", "Tout"], ["pays", "Pays"], ["ville", "Villes"], ["monument", "Monuments"], ["merveille", "Merveilles"], ["secrete", "Secrètes"]]
    : [["tout", "Toutes les époques"], ...Object.entries(EPOQUES).map(([k, e]) => [k, e.emoji + " " + e.court]), ["secrete", "✦ Secrètes"]];
  const key = u === "monde" ? "type" : "epoque";
  v.innerHTML = `<div class="toolbar">
      ${chips.map(([k, l]) => `<button class="chip ${f[key] === k ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}
      <input class="search" id="q" type="search" placeholder="Rechercher…" value="${esc(f.q)}">
      <label class="chip" style="cursor:pointer"><input type="checkbox" id="poss" ${f.possedees ? "checked" : ""}> Possédées</label>
    </div>
    ${u === "monde" && f.type === "pays" ? `<div class="toolbar">${[["tout", "Tous les continents"], ...Object.entries(CONTINENTS).map(([k, c]) => [k, c.emoji + " " + c.nom])].map(([k, l]) => `<button class="chip ${f.cont === k ? "on" : ""}" data-cont="${k}">${l}</button>`).join("")}</div>` : ""}
    <div id="sections"></div>`;
  $$(".toolbar [data-k]", v).forEach((b) => b.onclick = () => { f[key] = b.dataset.k; aller("album"); });
  $$(".toolbar [data-cont]", v).forEach((b) => b.onclick = () => { f.cont = b.dataset.cont; aller("album"); });
  $("#poss").onchange = (e) => { f.possedees = e.target.checked; dessinerSections(); };
  $("#q").oninput = (e) => { f.q = e.target.value; dessinerSections(); };
  dessinerSections();
}
function dessinerSections() {
  const u = S.univers, f = filtres[u];
  const q = sansAccents(f.q.trim());
  const ok = (c) => (!f.possedees || has(c.id)) && (!q || sansAccents(c.nom + " " + (c.capitale || "") + " " + (NOM_PAYS[c.pays] || "") + " " + (c.studio || "")).includes(q) && (c.type !== "secrete" || has(c.id)));
  const sections = [];
  if (u === "monde") {
    const T = f.type;
    if (T === "tout" || T === "pays") {
      for (const [k, ct] of Object.entries(CONTINENTS)) {
        if (T === "pays" && f.cont !== "tout" && f.cont !== k) continue;
        sections.push([`${ct.emoji} ${ct.nom}`, of("monde", "pays").filter((c) => c.continent === k)]);
      }
    }
    if (T === "tout" || T === "ville") sections.push(["🏙️ Villes", of("monde", "ville")]);
    if (T === "tout" || T === "monument") sections.push(["🏛️ Monuments", of("monde", "monument")]);
    if (T === "tout" || T === "merveille") sections.push(["🌟 Merveilles du monde moderne", of("monde", "merveille").filter((c) => c.groupe === "modernes")], ["🏺 Merveilles du monde antique", of("monde", "merveille").filter((c) => c.groupe === "antiques")]);
    if (T === "tout" || T === "secrete") sections.push(["✦ Cartes secrètes", of("monde", "secrete")]);
  } else {
    for (const [k, ep] of Object.entries(EPOQUES)) if (f.epoque === "tout" || f.epoque === k) sections.push([`${ep.emoji} ${ep.nom}`, of("gaming", "jeu").filter((c) => c.epoque === k).sort((a, b) => a.annee - b.annee)]);
    if (f.epoque === "tout" || f.epoque === "secrete") sections.push(["✦ Cartes secrètes", of("gaming", "secrete")]);
  }
  const html = sections.map(([titre, list]) => {
    const vis = list.filter(ok);
    if (!vis.length) return "";
    return `<div class="sectiontitle"><h3>${titre}</h3><span class="muted">${count(list.map((c) => c.id))}/${list.length}</span></div>
      <div class="cards">${vis.map((c) => cardHTML(c, { compte: true })).join("")}</div>`;
  }).join("");
  $("#sections").innerHTML = html || `<p class="muted" style="text-align:center;margin-top:40px">Aucune carte ne correspond.</p>`;
}

/* =====================================================================
   Atlas interactif
   ===================================================================== */
const couches = { pays: true, villes: true, monuments: true, merveilles: true };
function vueAtlas(v, opts = {}) {
  const nPays = count(of("monde", "pays").map((c) => c.id));
  v.innerHTML = `<div class="toolbar">
      <b>${nPays}/195 pays</b><div class="bar" style="flex:1;min-width:120px;max-width:300px"><i style="width:${nPays / 1.95}%"></i></div>
      ${[["villes", "🏙️ Villes"], ["monuments", "🏛️ Monuments"], ["merveilles", "🌟 Merveilles"]].map(([k, l]) => `<button class="chip ${couches[k] ? "on" : ""}" data-c="${k}">${l}</button>`).join("")}
    </div>
    <div class="atlas" id="atlas">
      <div class="zoombtns"><button class="iconbtn" id="zin" aria-label="Zoomer">＋</button><button class="iconbtn" id="zout" aria-label="Dézoomer">−</button><button class="iconbtn" id="zreset" aria-label="Vue entière">⟲</button></div>
      <div class="legend">${Object.values(CONTINENTS).map((c) => `<span><i style="background:${c.couleur}"></i>${c.nom}</span>`).join("")}<span><i style="background:var(--panel2);border:1px solid var(--border)"></i>À découvrir</span></div>
      <div class="tip hidden" id="tip"></div>
    </div>
    <p class="muted" style="font-size:13px">Faites glisser pour vous déplacer, molette ou pincement pour zoomer. Touchez un pays ou un symbole pour ouvrir sa carte.</p>`;
  $$("[data-c]", v).forEach((b) => b.onclick = () => { couches[b.dataset.c] = !couches[b.dataset.c]; aller("atlas"); });

  const W = 960, H = 500;
  const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" });
  const path = d3.geoPath(proj);
  const svg = d3.select("#atlas").insert("svg", ":first-child").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Atlas de votre collection");
  const g = svg.append("g");
  g.append("path").attr("class", "ocean").attr("d", path({ type: "Sphere" }));
  const tip = $("#tip");
  const montrerTip = (ev, txt) => {
    const r = $("#atlas").getBoundingClientRect();
    tip.textContent = txt; tip.classList.remove("hidden");
    tip.style.left = (ev.clientX - r.left) + "px"; tip.style.top = (ev.clientY - r.top) + "px";
  };
  const cacherTip = () => tip.classList.add("hidden");
  const feats = Object.values(FEATURES).filter((f) => f.id !== "010"); // sans l'Antarctique
  const petits = [];
  g.selectAll("path.country").data(feats).join("path")
    .attr("d", path)
    .attr("class", (f) => { const code = NUM_TO_CODE[f.id]; return "country " + (!code ? "none" : has("pays:" + code) ? "col own" : "col off"); })
    .attr("fill", (f) => { const code = NUM_TO_CODE[f.id]; return code && has("pays:" + code) ? CONTINENTS[CONT_PAYS[code]].couleur : null; })
    .each(function (f) { const code = NUM_TO_CODE[f.id]; if (code && path.area(f) < 6) petits.push([code, path.centroid(f)]); })
    .on("pointermove", (ev, f) => { const code = NUM_TO_CODE[f.id]; montrerTip(ev, code ? (has("pays:" + code) ? NOM_PAYS[code] : "🔒 " + NOM_PAYS[code]) : "Territoire hors collection"); })
    .on("pointerleave", cacherTip)
    .on("click", (ev, f) => { const code = NUM_TO_CODE[f.id]; if (code) ficheCarte(BY_ID["pays:" + code]); });
  // Petits pays : un point cliquable en plus du tracé
  for (const [code, lonlat] of Object.entries(POINTS_ABSENTS)) petits.push([code, proj(lonlat)]);
  const dots = g.append("g").selectAll("circle").data(petits).join("circle")
    .attr("class", "dot").attr("cx", (d) => d[1][0]).attr("cy", (d) => d[1][1]).attr("r", 2.6)
    .attr("fill", ([code]) => has("pays:" + code) ? CONTINENTS[CONT_PAYS[code]].couleur : "var(--panel2)")
    .attr("stroke", "var(--muted)")
    .on("pointermove", (ev, [code]) => montrerTip(ev, has("pays:" + code) ? NOM_PAYS[code] : "🔒 " + NOM_PAYS[code]))
    .on("pointerleave", cacherTip)
    .on("click", (ev, [code]) => ficheCarte(BY_ID["pays:" + code]));
  // Repères : villes, monuments, merveilles
  const repères = [...(couches.villes ? of("monde", "ville") : []), ...(couches.monuments ? of("monde", "monument") : []), ...(couches.merveilles ? of("monde", "merveille") : [])];
  const pins = g.append("g").selectAll("g.pin").data(repères).join("g")
    .attr("class", (c) => "pin" + (has(c.id) ? "" : " off"))
    .attr("transform", (c) => { const [x, y] = proj([c.lon, c.lat]); return `translate(${x},${y})`; })
    .on("pointermove", (ev, c) => montrerTip(ev, (has(c.id) ? "" : "🔒 ") + c.nom))
    .on("pointerleave", cacherTip)
    .on("click", (ev, c) => { ev.stopPropagation(); ficheCarte(c); });
  pins.append("circle").attr("r", (c) => (has(c.id) ? 0 : 3));
  pins.filter((c) => has(c.id)).append("text").text((c) => c.emoji);

  const zoom = d3.zoom().scaleExtent([1, 14]).translateExtent([[0, 0], [W, H]]).on("zoom", (ev) => {
    g.attr("transform", ev.transform);
    const k = ev.transform.k;
    pins.attr("transform", (c) => { const [x, y] = proj([c.lon, c.lat]); return `translate(${x},${y}) scale(${1 / Math.sqrt(k)})`; });
    dots.attr("r", 2.6 / Math.sqrt(k));
  });
  svg.call(zoom);
  $("#zin").onclick = () => svg.transition().call(zoom.scaleBy, 1.8);
  $("#zout").onclick = () => svg.transition().call(zoom.scaleBy, 1 / 1.8);
  $("#zreset").onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);
  if (opts.focus) {
    const c = opts.focus;
    const [x, y] = c.type === "pays" ? (FEATURES[CODES_NUMERIQUES[c.code]] ? path.centroid(territoirePrincipal(FEATURES[CODES_NUMERIQUES[c.code]])) : proj(POINTS_ABSENTS[c.code])) : proj([c.lon, c.lat]);
    const k = 5;
    svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - k * x, H / 2 - k * y).scale(k));
  }
}

/* =====================================================================
   Badges
   ===================================================================== */
function vueBadges(v) {
  const list = badgesDe(S.univers);
  v.innerHTML = `<div class="sectiontitle"><h3>🏅 Badges</h3><span class="muted">${list.filter((b) => S.badges[b.id]).length}/${list.length} · bronze +${RECOMPENSE.bronze} 🪙, argent +${RECOMPENSE.argent} 🪙, or +${RECOMPENSE.or} 🪙</span></div>
    <div class="badges">${list.map((b) => `<div class="badge ${b.niveau} ${S.badges[b.id] ? "got" : ""}">
      <div class="medal">${b.emoji}</div>
      <div style="flex:1;min-width:0"><b>${esc(b.nom)}</b><small>${esc(b.desc)}</small>
      <div class="bar"><i style="width:${Math.min(100, (b.n / b.t / b.seuil) * 100)}%"></i></div>
      <small>${S.badges[b.id] ? "Obtenu ✓" : `${b.n}/${Math.ceil(b.t * b.seuil)}`}</small></div></div>`).join("")}</div>`;
}

/* =====================================================================
   Quiz
   ===================================================================== */
function options(bonne, pool, n = 4) {
  const autres = shuffle([...new Set(pool.filter((x) => x !== bonne))]).slice(0, n - 1);
  return shuffle([bonne, ...autres]);
}
function questionMonde() {
  const pays = of("monde", "pays");
  const lieux = [...of("monde", "ville"), ...of("monde", "monument"), ...of("monde", "merveille")];
  const type = pick(["capitale", "capitale", "drapeau", "drapeau", "lieu", "continent", "anecdote"]);
  if (type === "capitale") {
    const c = pick(pays);
    const meme = pays.filter((x) => x.continent === c.continent).map((x) => court(x.capitale));
    return { q: `Quelle est la capitale de ce pays : ${c.nom} ?`, bonne: court(c.capitale), choix: options(court(c.capitale), meme), carte: c };
  }
  if (type === "drapeau") {
    const c = pick(pays);
    const meme = pays.filter((x) => x.continent === c.continent).map((x) => x.nom);
    return { q: "À quel pays appartient ce drapeau ?", media: `<img class="qflag" src="flags/${c.code.toLowerCase()}.svg" alt="Drapeau mystère">`, bonne: c.nom, choix: options(c.nom, meme), carte: c };
  }
  if (type === "lieu") {
    const c = pick(lieux);
    const voisins = pays.filter((x) => x.continent === c.continent).map((x) => x.nom);
    return { q: `Dans quel pays se trouve : ${c.nom} ?`, media: `<div class="qemoji">${c.emoji}</div>`, bonne: NOM_PAYS[c.pays], choix: options(NOM_PAYS[c.pays], voisins), carte: c };
  }
  if (type === "continent") {
    const c = pick(pays);
    const bonne = CONTINENTS[c.continent].nom;
    return { q: `Sur quel continent se trouve ce pays : ${c.nom} ?`, bonne, choix: options(bonne, Object.values(CONTINENTS).map((x) => x.nom)), carte: c };
  }
  const c = pick(of("monde", "monument").concat(of("monde", "merveille")));
  return { q: "De quel monument parle cette anecdote ?", media: `<p class="anec">« ${esc(c.anecdote)} »</p>`, bonne: c.nom, choix: options(c.nom, lieux.filter((x) => x.type !== "ville").map((x) => x.nom)), carte: c };
}
function questionGaming() {
  const jeux = of("gaming", "jeu");
  const type = pick(["annee", "studio", "anecdote", "anecdote"]);
  const c = pick(jeux);
  if (type === "annee") {
    const autres = shuffle([-6, -4, -3, -2, -1, 1, 2, 3, 4, 6].map((d) => c.annee + d).filter((a) => a >= 1970 && a <= 2025));
    return { q: `En quelle année est sorti ${c.nom} ?`, media: `<div class="qemoji">${c.emoji}</div>`, bonne: String(c.annee), choix: options(String(c.annee), autres.map(String)), carte: c };
  }
  if (type === "studio") {
    return { q: `Qui a créé ${c.nom} ?`, media: `<div class="qemoji">${c.emoji}</div>`, bonne: c.studio, choix: options(c.studio, jeux.map((x) => x.studio)), carte: c };
  }
  const titre = new RegExp(c.nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return { q: "De quel jeu parle cette anecdote ?", media: `<p class="anec">« ${esc(c.anecdote.replace(titre, "ce jeu"))} »</p>`, bonne: c.nom, choix: options(c.nom, jeux.filter((x) => x.epoque === c.epoque).map((x) => x.nom)), carte: c };
}
function vueQuiz(v) {
  const u = S.univers, st = S.quiz[u];
  const Q = u === "monde" ? questionMonde() : questionGaming();
  v.innerHTML = `<div class="quiz panel">
    <div class="row" style="justify-content:space-between"><span>Série : <span class="streak">${st.serie} 🔥</span></span><span class="muted">Record : ${st.record} · ${st.bonnes}/${st.total} bonnes réponses</span></div>
    <div class="q">${esc(Q.q)}</div>${Q.media || ""}
    <div class="answers" style="margin-top:14px">${Q.choix.map((x) => `<button>${esc(x)}</button>`).join("")}</div>
    <div class="feedback" id="fb"></div></div>`;
  $$(".answers button", v).forEach((b) => b.onclick = () => {
    const bon = b.textContent === Q.bonne;
    $$(".answers button", v).forEach((x) => { x.disabled = true; if (x.textContent === Q.bonne) x.classList.add("good"); });
    st.total++;
    let gain = 0;
    if (bon) {
      st.bonnes++; st.serie++; st.record = Math.max(st.record, st.serie); gain = 20;
      if (st.serie % 5 === 0) gain += 50;
    } else { b.classList.add("bad"); st.serie = 0; }
    S.coins += gain; sauver(); majCoins();
    const c = Q.carte;
    $("#fb").innerHTML = `<p style="font-weight:700;font-size:17px;margin:4px 0">${bon ? `✅ Bravo ! +${gain} 🪙${gain > 20 ? " (bonus de série !)" : ""}` : `❌ C'était : ${esc(Q.bonne)}`}</p>
      ${has(c.id) ? `<p class="muted" style="margin:4px 0">💡 ${esc(c.anecdote)}</p>` : `<p class="muted" style="margin:4px 0">Collectionnez la carte « ${esc(c.nom)} » pour découvrir son anecdote.</p>`}
      <button class="btn primary" id="next">Question suivante →</button>`;
    $("#next").onclick = () => aller("quiz");
    $("#next").focus();
  });
}

/* =====================================================================
   Mes collections (Gaming) : cartes perso avec vos illustrations
   ===================================================================== */
function choisirImage() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return resolve(null);
      try { resolve(await reduireImage(f)); } catch { toast("⚠ Image illisible."); resolve(null); }
    };
    input.click();
  });
}
// Redimensionne l'image (600 px max) pour garder la sauvegarde légère
async function reduireImage(file, max = 600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const webp = cv.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : cv.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}
const EMOJIS_COLL = ["🎮", "🕹️", "👾", "🏆", "⚔️", "🐉", "🚀", "🍄", "💎", "🔥", "🌈", "🎨"];
function persoCarte(coll, x) {
  const ref = x.ref ? BY_ID[x.ref] : null;
  return {
    id: "perso:" + coll.id + ":" + x.id, univers: "gaming", type: "perso", rarete: x.rarete || ref?.rarete || "perso",
    nom: x.titre || ref?.nom || "Sans titre", emoji: ref?.emoji || coll.emoji, epoque: ref?.epoque, annee: ref?.annee,
    image: x.image || (ref ? PERSO.illus[ref.id] : null), anecdote: x.texte || ref?.anecdote || "", sous: ref ? `${ref.annee} · ${ref.studio}` : coll.nom, num: 0,
  };
}
let collOuverte = null;
function vueCollections(v) {
  if (collOuverte && !PERSO.collections.find((c) => c.id === collOuverte)) collOuverte = null;
  if (collOuverte) return vueUneCollection(v, PERSO.collections.find((c) => c.id === collOuverte));
  v.innerHTML = `<div class="sectiontitle"><h3>🎨 Mes collections</h3><span class="muted">Rassemblez vos jeux préférés, avec vos propres illustrations</span></div>
    <div class="grid2">
      ${PERSO.collections.map((c) => {
        const cover = c.cartes.find((x) => x.image)?.image;
        return `<div class="coll" data-coll="${c.id}"><div class="cv" style="background:${degrade("#e0913a")}">${cover ? `<img src="${esc(cover)}" alt="">` : esc(c.emoji)}</div>
          <div style="min-width:0"><b>${esc(c.nom)}</b><div class="muted" style="font-size:13.5px">${c.cartes.length} carte${c.cartes.length > 1 ? "s" : ""}${c.description ? " · " + esc(c.description) : ""}</div></div></div>`;
      }).join("")}
      <button class="coll" id="newColl" style="justify-content:center;border-style:dashed;font-weight:700">＋ Nouvelle collection</button>
    </div>
    ${PERSO.collections.length ? "" : `<p class="muted" style="text-align:center;margin-top:24px">Exemples : « Mes RPG cultes », « Nintendo forever », « Les jeux de mon enfance »…</p>`}`;
  $$("[data-coll]", v).forEach((el) => el.onclick = () => { collOuverte = el.dataset.coll; aller("collections"); });
  $("#newColl").onclick = () => editerCollection();
}
function editerCollection(coll) {
  const neuf = !coll;
  coll = coll || { id: uid(), nom: "", emoji: "🎮", description: "", cartes: [] };
  ouvrirModal(`<h2 style="margin-top:0">${neuf ? "Nouvelle collection" : "Modifier la collection"}</h2>
    <div class="form">
      <label>Nom<input id="cNom" maxlength="60" value="${esc(coll.nom)}" placeholder="Ex. : Mes RPG cultes"></label>
      <label>Description<input id="cDesc" maxlength="120" value="${esc(coll.description)}" placeholder="Facultatif"></label>
      <label>Symbole<div class="row">${EMOJIS_COLL.map((e) => `<button type="button" class="chip ${coll.emoji === e ? "on" : ""}" data-e="${e}">${e}</button>`).join("")}</div></label>
      <div class="row" style="justify-content:space-between">
        ${neuf ? "<span></span>" : `<button class="btn" id="cDel" style="color:var(--bad)">Supprimer</button>`}
        <button class="btn primary" id="cSave">${neuf ? "Créer" : "Enregistrer"}</button>
      </div>
    </div>`);
  let emoji = coll.emoji;
  $$("[data-e]").forEach((b) => b.onclick = () => { emoji = b.dataset.e; $$("[data-e]").forEach((x) => x.classList.toggle("on", x === b)); });
  $("#cNom").focus();
  $("#cSave").onclick = async () => {
    const nom = $("#cNom").value.trim();
    if (!nom) { $("#cNom").focus(); return; }
    Object.assign(coll, { nom, description: $("#cDesc").value.trim(), emoji });
    if (neuf) PERSO.collections.push(coll);
    await sauverPerso(); collOuverte = coll.id; fermerModal(); aller("collections");
  };
  $("#cDel")?.addEventListener("click", () => confirmer(`Supprimer la collection « ${coll.nom} » et ses cartes ?`, "Supprimer", async () => {
    PERSO.collections = PERSO.collections.filter((c) => c.id !== coll.id);
    await sauverPerso(); collOuverte = null; fermerModal(); aller("collections");
  }));
}
function vueUneCollection(v, coll) {
  v.innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn small" id="back">← Mes collections</button></div>
    <div class="panel row" style="justify-content:space-between">
      <div class="row"><span style="font-size:40px">${esc(coll.emoji)}</span><div><h2 style="margin:0">${esc(coll.nom)}</h2><span class="muted">${esc(coll.description || "")}</span></div></div>
      <div class="row"><button class="btn" id="edit">✏️ Modifier</button><button class="btn" id="addGame">＋ Jeu de l'encyclopédie</button><button class="btn primary" id="addCard">＋ Créer une carte</button></div>
    </div>
    <div class="cards" style="margin-top:16px">${coll.cartes.map((x) => cardHTML(persoCarte(coll, x), { locked: false })).join("")}</div>
    ${coll.cartes.length ? "" : `<p class="muted" style="text-align:center;margin-top:30px">Ajoutez des jeux de l'encyclopédie ou créez vos propres cartes, avec vos illustrations.</p>`}`;
  $("#back").onclick = () => { collOuverte = null; aller("collections"); };
  $("#edit").onclick = () => editerCollection(coll);
  $("#addCard").onclick = () => editerCartePerso(coll);
  $("#addGame").onclick = () => choisirJeu(coll);
}
function choisirJeu(coll) {
  const deja = new Set(coll.cartes.map((x) => x.ref).filter(Boolean));
  ouvrirModal(`<h2 style="margin-top:0">Ajouter un jeu</h2>
    <input class="search" id="gq" type="search" placeholder="Rechercher un jeu…" style="max-width:none;width:100%;margin-bottom:10px">
    <div class="picklist" id="gl"></div>
    <p class="muted" style="font-size:13px">Tous les jeux de l'encyclopédie sont disponibles ici, même ceux que vous n'avez pas encore en carte.</p>`);
  const draw = () => {
    const q = sansAccents($("#gq").value);
    $("#gl").innerHTML = of("gaming", "jeu").filter((c) => !deja.has(c.id) && sansAccents(c.nom + " " + c.studio).includes(q)).sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
      .map((c) => `<button data-g="${c.id}"><span style="font-size:22px">${c.emoji}</span><span><b>${esc(c.nom)}</b><br><small class="muted">${c.annee} · ${esc(c.studio)}</small></span></button>`).join("") || `<p class="muted" style="padding:10px">Aucun jeu.</p>`;
    $$("[data-g]").forEach((b) => b.onclick = async () => {
      coll.cartes.push({ id: uid(), ref: b.dataset.g });
      await sauverPerso(); fermerModal(); verifierProgression(); aller("collections");
      toast(`Ajouté à « ${esc(coll.nom)} ». Touchez la carte pour y mettre votre illustration.`);
    });
  };
  $("#gq").oninput = draw; draw(); $("#gq").focus();
}
function editerCartePerso(coll, x, neufForce) {
  const neuf = neufForce ?? !x;
  x = x || { id: uid(), titre: "", texte: "", rarete: "perso", image: null };
  const ref = x.ref ? BY_ID[x.ref] : null;
  let image = x.image;
  ouvrirModal(`<h2 style="margin-top:0">${neuf ? "Créer une carte" : "Modifier la carte"}</h2>
    <div class="detail">
      <div id="prev"></div>
      <div class="form">
        <label>Titre<input id="pTitre" maxlength="60" value="${esc(x.titre || "")}" placeholder="${esc(ref?.nom || "Ex. : Mon perso préféré")}"></label>
        <label>Texte / anecdote<textarea id="pTexte" rows="3" maxlength="300" placeholder="${esc(ref?.anecdote || "Pourquoi ce jeu compte pour vous…")}">${esc(x.texte || "")}</textarea></label>
        <label>Cadre<select id="pRar">${["perso", "commun", "peu-commun", "rare", "epique", "legendaire"].map((r) => `<option value="${r}" ${(x.rarete || "perso") === r ? "selected" : ""}>${RARETES[r].nom}</option>`).join("")}</select></label>
        <div class="drop" id="pImg">${image ? `<img src="${esc(image)}" alt="">Changer l'illustration` : "🖼️ Ajouter mon illustration<br><small>dessin, capture, photo…</small>"}</div>
        ${image ? `<button class="btn small" id="pImgDel" type="button">Retirer l'illustration</button>` : ""}
        <div class="row" style="justify-content:space-between">
          ${neuf ? "<span></span>" : `<button class="btn" id="pDel" style="color:var(--bad)">Retirer de la collection</button>`}
          <button class="btn primary" id="pSave">${neuf ? "Ajouter" : "Enregistrer"}</button>
        </div>
      </div></div>`);
  const apercu = () => {
    const tmp = { ...x, titre: $("#pTitre").value.trim() || x.titre, texte: $("#pTexte").value, rarete: $("#pRar").value, image };
    $("#prev").innerHTML = cardHTML(persoCarte(coll, tmp), { locked: false });
  };
  ["#pTitre", "#pTexte", "#pRar"].forEach((s) => $(s).addEventListener("input", apercu));
  apercu();
  $("#pImg").onclick = async () => { const img = await choisirImage(); if (img) { image = img; x.image = img; editerCartePerso(coll, Object.assign(x, { titre: $("#pTitre").value, texte: $("#pTexte").value, rarete: $("#pRar").value }), neuf); } };
  $("#pImgDel")?.addEventListener("click", () => { image = null; x.image = null; editerCartePerso(coll, x, neuf); });
  $("#pSave").onclick = async () => {
    const titre = $("#pTitre").value.trim();
    if (!titre && !ref) { $("#pTitre").focus(); return; }
    Object.assign(x, { titre, texte: $("#pTexte").value.trim(), rarete: $("#pRar").value, image });
    if (!coll.cartes.includes(x)) coll.cartes.push(x);
    await sauverPerso(); fermerModal(); verifierProgression(); aller("collections");
  };
  $("#pDel")?.addEventListener("click", async () => {
    coll.cartes = coll.cartes.filter((y) => y !== x);
    await sauverPerso(); fermerModal(); aller("collections");
  });
}
function ouvrirCartePerso(fullId) {
  const [, cid, xid] = fullId.split(":");
  const coll = PERSO.collections.find((c) => c.id === cid);
  const x = coll?.cartes.find((y) => y.id === xid);
  if (coll && x) editerCartePerso(coll, x);
}

/* =====================================================================
   Réglages : thème, sauvegarde, remise à zéro
   ===================================================================== */
function appliquerTheme() { if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme; }
$("#settingsBtn").onclick = () => {
  ouvrirModal(`<h2 style="margin-top:0">Réglages</h2>
    <div class="form">
      <label>Thème<select id="sTheme"><option value="">Automatique</option><option value="light">Clair</option><option value="dark">Sombre</option></select></label>
      <div class="panel" style="padding:12px">
        <b>Sauvegarde</b>
        <p class="muted" style="margin:4px 0 10px;font-size:13.5px">Votre progression reste dans ce navigateur. Exportez-la pour la garder ou la transférer sur un autre appareil.</p>
        <div class="row"><button class="btn small" id="sExport">⬇ Exporter</button><button class="btn small" id="sImport">⬆ Importer</button></div>
      </div>
      <button class="btn" id="sReset" style="color:var(--bad)">Recommencer à zéro</button>
      <p class="muted" style="font-size:12.5px;margin:0">Carte : Natural Earth (domaine public). Drapeaux : flag-icons (licence MIT).</p>
    </div>`);
  $("#sTheme").value = S.theme;
  $("#sTheme").onchange = (e) => { S.theme = e.target.value; sauver(); appliquerTheme(); };
  $("#sExport").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "worldcards", version: 1, sauvegarde: S, perso: PERSO })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `worldcards-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#sImport").onclick = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const j = JSON.parse(await input.files[0].text());
        if (j.app !== "worldcards" || !j.sauvegarde?.owned) throw new Error();
        S = { ...nouvelleSauvegarde(), ...j.sauvegarde }; PERSO = j.perso || { collections: [], illus: {} };
        sauver(); await sauverPerso(); fermerModal(); appliquerTheme(); majCoins(); aller(S.vue); toast("✅ Sauvegarde importée.");
      } catch { toast("⚠ Fichier de sauvegarde invalide."); }
    };
    input.click();
  };
  $("#sReset").onclick = () => confirmer("Effacer toute votre progression et vos collections ? C'est définitif.", "Tout effacer", async () => {
    S = nouvelleSauvegarde(); PERSO = { collections: [], illus: {} };
    sauver(); await sauverPerso(); fermerModal(); majCoins(); aller("accueil");
  });
};

/* =====================================================================
   Démarrage
   ===================================================================== */
async function demarrer() {
  appliquerTheme(); majCoins();
  try { PERSO = (await idb.get("perso")) || PERSO; } catch (e) { console.warn("IndexedDB indisponible", e); }
  aller(S.vue);
  verifierProgression();
  if (!S.ouverts && !count(CARDS.map((c) => c.id))) {
    ouvrirModal(`<div style="text-align:center"><div style="font-size:56px">🌐</div><h2>Bienvenue dans WorldCards !</h2>
      <p>Collectionnez le monde : <b>195 pays</b>, des villes, des monuments, les <b>merveilles</b> du monde… et les grands <b>jeux vidéo</b>.</p>
      <p class="muted">Vous recevez <b>3 boosters Monde</b>, <b>2 boosters Gaming</b> et <b>200 🪙</b> pour commencer. Gagnez des pièces au quiz, débloquez des badges, et terminez une collection pour révéler une <b>carte secrète</b>.</p>
      <button class="btn primary" id="go">Ouvrir mon premier booster</button></div>`);
    $("#go").onclick = () => { const m = $("#modal"); m._onClose = null; fermerModal(); S.univers = "monde"; aller("boosters"); ouvrirBooster("monde"); };
  }
}
demarrer();
