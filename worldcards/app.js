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
const jourLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => jourLocal();
const semaine = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return jourLocal(d); };
const court = (s) => s.split(" (")[0];
const duree = (ms) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
const minuit = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); };
function weighted(items, weightOf) {
  const total = items.reduce((s, x) => s + weightOf(x), 0);
  let r = Math.random() * total;
  for (const x of items) { r -= weightOf(x); if (r <= 0) return x; }
  return items[items.length - 1];
}
const premium = () => typeof estPremium === "function" && estPremium();

/* =====================================================================
   Raretés, boosters et cartes
   ===================================================================== */
const RARETES = {
  "commun":     { nom: "Commune",      gems: "◆",    ordre: 0, poids: 62,  doublon: 5,   prix: 60 },
  "peu-commun": { nom: "Peu commune",  gems: "◆◆",   ordre: 1, poids: 24,  doublon: 10,  prix: 120 },
  "rare":       { nom: "Rare",         gems: "◆◆◆",  ordre: 2, poids: 10,  doublon: 25,  prix: 300 },
  "epique":     { nom: "Épique",       gems: "◆◆◆◆", ordre: 3, poids: 3.3, doublon: 60,  prix: 700 },
  "ultra-rare": { nom: "Ultra rare",   gems: "✸✸",   ordre: 4, poids: 1.2, doublon: 100, prix: 1000 },
  "legendaire": { nom: "Légendaire",   gems: "★",    ordre: 5, poids: 0.7, doublon: 150, prix: 1500 },
  "secrete":    { nom: "Secrète",      gems: "✦",    ordre: 6 },
};
const TYPES = { pays: "Pays", ville: "Ville", monument: "Monument", nature: "Nature", animal: "Animal", plat: "Gastronomie", culture: "Culture", merveille: "Merveille", secrete: "Secrète" };
const EMOJI_TYPE = { pays: "🌍", ville: "🏙️", monument: "🏛️", nature: "🏔️", animal: "🐾", plat: "🍜", culture: "🎭", merveille: "🌟", secrete: "✦" };
const PLURIEL = { pays: "Pays", ville: "Villes", monument: "Monuments", nature: "Nature", animal: "Animaux", plat: "Gastronomie", culture: "Culture", merveille: "Merveilles", secrete: "Secrètes" };
const VERSION_JEU = "v76"; // affichée en bas de page : permet de vérifier que la dernière version est en ligne
const CHANCE_SHINY = 1 / 45; // chaque carte d'un booster peut sortir en version Shiny
const CHANCE_HOLO = 1 / 10;  // ou en version Holo (reflet irisé, purement décoratif)
const GRATUIT_MS = 12 * 3600e3; // un booster gratuit toutes les 12 heures
// Réglables par l'admin (chargés depuis /api/reglages) : progression de la jauge de chance et bonus des cartes jamais obtenues
let PITY_PAS = 5, BONUS_NOUVELLE = 1;

// Boosters : plus ils sont chers, plus les cartes rares sont fréquentes
const PACKS = {
  monde: { nom: "Classique", emoji: "🌍", prix: 120, cartes: 5, garanties: [2], shiny: 1,
    desc: "5 cartes, dont au moins une rare ou mieux." },
  argent: { nom: "Argent", emoji: "🥈", prix: 380, cartes: 5, garanties: [2, 3], shiny: 1.5,
    poids: { "commun": 34, "peu-commun": 36, "rare": 20, "epique": 6.5, "ultra-rare": 2.4, "legendaire": 1.1 },
    desc: "Peu de communes. Une épique ou mieux garantie, Shiny ×1,5." },
  or: { nom: "Or", emoji: "🥇", prix: 900, cartes: 5, garanties: [3, 4], shiny: 2,
    poids: { "commun": 12, "peu-commun": 34, "rare": 32, "epique": 13, "ultra-rare": 6, "legendaire": 3 },
    desc: "Une épique et une ultra rare ou mieux garanties. Shiny ×2." },
  prestige: { nom: "Prestige", emoji: "💎", prix: 1500, cartes: 6, garanties: [3, 4, 5], shiny: 3, premium: true,
    poids: { "commun": 0, "peu-commun": 28, "rare": 36, "epique": 20, "ultra-rare": 10, "legendaire": 6 },
    desc: "6 cartes dont une légendaire garantie. Shiny ×3. Réservé au Premium." },
};

const CARDS = [];
const BY_ID = {};
const add = (c) => { if (BY_ID[c.id]) return; CARDS.push(c); BY_ID[c.id] = c; };
const RECHERCHE_PHOTO = {}; // requête de secours quand l'article Wikipédia n'a pas de photo

PAYS_BRUTS
  .map(([code, nom, capitale, continent, anecdote]) => ({ code, nom, capitale, continent, anecdote }))
  .forEach((p, i) => add({ id: "pays:" + p.code, univers: "monde", type: "pays", rarete: "commun", num: i + 1, ...p }));
const NOM_PAYS = Object.fromEntries(PAYS_BRUTS.map((p) => [p[0], p[1]]));
const CONT_PAYS = Object.fromEntries(PAYS_BRUTS.map((p) => [p[0], p[3]]));
// Chaque pays est illustré par la photo d'un lieu emblématique (souvent sa capitale)
for (const p of PAYS_BRUTS) {
  if (typeof PHOTOS_PAYS !== "undefined" && PHOTOS_PAYS[p[0]]) PHOTOS_WIKI["pays:" + p[0]] = PHOTOS_PAYS[p[0]];
  RECHERCHE_PHOTO["pays:" + p[0]] = `${court(p[2])} ${p[1]}`;
}
const villes = [...VILLES_BRUTES, ...(typeof VILLES_EXTRA !== "undefined" ? VILLES_EXTRA : [])];
villes.forEach(([id, nom, pays, lat, lon, emoji, anecdote, wiki], i) => {
  add({ id: "ville:" + id, univers: "monde", type: "ville", rarete: "peu-commun", num: i + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] });
  if (wiki && !PHOTOS_WIKI["ville:" + id]) PHOTOS_WIKI["ville:" + id] = wiki;
  RECHERCHE_PHOTO["ville:" + id] = `${nom} ${NOM_PAYS[pays]}`;
});
const extra = (nom) => (typeof globalThis[nom] !== "undefined" ? globalThis[nom] : (() => { try { return eval(nom); } catch { return []; } })());
for (const [i, [id, nom, pays, lat, lon, emoji, anecdote, wiki]] of extra("VILLES_EXTRA2").entries()) {
  add({ id: "ville:" + id, univers: "monde", type: "ville", rarete: "peu-commun", num: villes.length + i + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] });
  if (wiki && !PHOTOS_WIKI["ville:" + id]) PHOTOS_WIKI["ville:" + id] = wiki;
  RECHERCHE_PHOTO["ville:" + id] = `${nom} ${NOM_PAYS[pays]}`;
}
const monuments = [...MONUMENTS_BRUTS, ...(typeof MONUMENTS_EXTRA !== "undefined" ? MONUMENTS_EXTRA : []), ...extra("MONUMENTS_EXTRA2"), ...extra("MONUMENTS_EXTRA3")];
monuments.forEach(([id, nom, pays, lat, lon, emoji, rarete, anecdote, wiki], i) => {
  add({ id: "monu:" + id, univers: "monde", type: "monument", rarete, num: i + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] });
  if (wiki && !PHOTOS_WIKI["monu:" + id]) PHOTOS_WIKI["monu:" + id] = wiki;
  RECHERCHE_PHOTO["monu:" + id] = nom;
});
[...extra("NATURE_BRUTS"), ...extra("NATURE_BRUTS2")].forEach(([id, nom, pays, lat, lon, emoji, rarete, anecdote, wiki], i) => {
  add({ id: "nat:" + id, univers: "monde", type: "nature", rarete, num: i + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] });
  if (wiki) PHOTOS_WIKI["nat:" + id] = wiki;
  RECHERCHE_PHOTO["nat:" + id] = nom;
});
[...extra("ANIMAUX_BRUTS"), ...extra("ANIMAUX_BRUTS2")].forEach(([id, nom, pays, emoji, rarete, anecdote, wiki], i) => {
  add({ id: "ani:" + id, univers: "monde", type: "animal", rarete, num: i + 1, nom, pays, emoji, anecdote, continent: CONT_PAYS[pays] });
  if (wiki) PHOTOS_WIKI["ani:" + id] = wiki;
  RECHERCHE_PHOTO["ani:" + id] = nom;
});
extra("CULTURE_BRUTS").forEach(([id, nom, pays, emoji, rarete, anecdote, wiki], i) => {
  add({ id: "cult:" + id, univers: "monde", type: "culture", rarete, num: i + 1, nom, pays, emoji, anecdote, continent: CONT_PAYS[pays] });
  if (wiki) PHOTOS_WIKI["cult:" + id] = wiki;
  RECHERCHE_PHOTO["cult:" + id] = nom;
});
[...extra("PLATS_BRUTS"), ...extra("PLATS_BRUTS2")].forEach(([id, nom, pays, emoji, rarete, anecdote, wiki], i) => {
  add({ id: "plat:" + id, univers: "monde", type: "plat", rarete, num: i + 1, nom, pays, emoji, anecdote, continent: CONT_PAYS[pays] });
  if (wiki) PHOTOS_WIKI["plat:" + id] = wiki;
  RECHERCHE_PHOTO["plat:" + id] = nom;
});
MERVEILLES_BRUTES.forEach(([id, nom, pays, lat, lon, emoji, groupe, anecdote], i) =>
  add({ id: "merv:" + id, univers: "monde", type: "merveille", rarete: "legendaire", num: i + 1, nom, pays, lat, lon, emoji, groupe, anecdote, continent: CONT_PAYS[pays] }));
SECRETES_MONDE.forEach(([id, nom, emoji, condition, anecdote], i) =>
  add({ id: "secret:" + id, univers: "monde", type: "secrete", rarete: "secrete", num: i + 1, nom, emoji, condition, anecdote }));

// Enregistrement des extensions de cartes (Nouvelles Villes, Monuments, Nature, Événements)
// Une carte qui existe déjà sous un autre identifiant (même nom) n'est pas ajoutée en double
const normNom = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^(le|la|les|l')\s*/, "").replace(/[^a-z0-9]/g, "");
const NOMS_EXISTANTS = new Set(CARDS.map((c) => normNom(c.nom)));
const doublon = (nom) => { const k = normNom(nom); if (NOMS_EXISTANTS.has(k)) return true; NOMS_EXISTANTS.add(k); return false; };
if (typeof VILLES_NOUVELLES !== "undefined") {
  VILLES_NOUVELLES.forEach(([id, nom, pays, lat, lon, emoji, anecdote, wiki], i) => {
    if (doublon(nom)) return;
    add({ id: "ville:" + id, univers: "monde", type: "ville", rarete: "peu-commun", num: CARDS.filter((c) => c.type === "ville").length + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] });
    if (wiki) PHOTOS_WIKI["ville:" + id] = wiki;
    RECHERCHE_PHOTO["ville:" + id] = `${nom} ${NOM_PAYS[pays] || ""}`;
  });
}
if (typeof MONUMENTS_NOUVEAUX !== "undefined") {
  MONUMENTS_NOUVEAUX.forEach(([id, nom, pays, lat, lon, emoji, rarete, anecdote, wiki], i) => {
    if (doublon(nom) || doublon(wiki || nom)) return;
    add({ id: "monu:" + id, univers: "monde", type: "monument", rarete, num: CARDS.filter((c) => c.type === "monument").length + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] });
    if (wiki) PHOTOS_WIKI["monu:" + id] = wiki;
    RECHERCHE_PHOTO["monu:" + id] = nom;
  });
}
if (typeof NATURE_NOUVELLE !== "undefined") {
  NATURE_NOUVELLE.forEach(([id, nom, pays, lat, lon, emoji, rarete, anecdote, wiki], i) => {
    if (doublon(nom) || doublon(wiki || nom)) return;
    add({ id: "nat:" + id, univers: "monde", type: "nature", rarete, num: CARDS.filter((c) => c.type === "nature").length + 1, nom, pays, lat, lon, emoji, anecdote, continent: CONT_PAYS[pays] });
    if (wiki) PHOTOS_WIKI["nat:" + id] = wiki;
    RECHERCHE_PHOTO["nat:" + id] = nom;
  });
}
// Cartes supplémentaires par pays (tous les types), sans doublon de nom
const PREFIXES = { ville: "ville:", monument: "monu:", nature: "nat:", animal: "ani:", plat: "plat:", culture: "cult:" };
for (const liste of ["CARTES_PAYS_AF", "CARTES_PAYS_EUAS", "CARTES_PAYS_AMOC", "CARTES_PAYS_MOYENS", "CARTES_PAYS_PLUS"]) {
  for (const [type, id, nom, pays, lat, lon, emoji, rarete, anecdote, wiki] of extra(liste)) {
    if (!PREFIXES[type] || !RARETES[rarete] || BY_ID[PREFIXES[type] + id] || doublon(nom)) continue;
    const cid = PREFIXES[type] + id;
    add({ id: cid, univers: "monde", type, rarete: type === "ville" ? "peu-commun" : rarete, num: CARDS.filter((c) => c.type === type).length + 1, nom, pays, emoji, anecdote, continent: CONT_PAYS[pays],
      ...(lat != null && lon != null ? { lat, lon } : {}) });
    if (wiki) PHOTOS_WIKI[cid] = wiki;
    RECHERCHE_PHOTO[cid] = `${nom} ${NOM_PAYS[pays] || ""}`;
  }
}
// Événements supplémentaires : nouvelles cartes d'Halloween et de Noël, et nouveaux événements
if (typeof EVENEMENTS_SAISONNIERS !== "undefined") for (const [cle, ev] of Object.entries(extra("EVENEMENTS_EXTRA") || {})) {
  if (EVENEMENTS_SAISONNIERS[cle]) EVENEMENTS_SAISONNIERS[cle].cartes.push(...(ev.cartes || []));
  else if (ev.nom && ev.cartes?.length) EVENEMENTS_SAISONNIERS[cle] = ev;
}
if (typeof EVENEMENTS_SAISONNIERS !== "undefined") {
  for (const [evKey, ev] of Object.entries(EVENEMENTS_SAISONNIERS)) {
    ev.cartes.forEach(([id, nom, pays, emoji, rarete, anecdote, wiki], i) => {
      add({ id: "event:" + id, univers: "monde", type: "monument", rarete, saisonnier: evKey, num: i + 1, nom, pays, emoji, anecdote, continent: CONT_PAYS[pays] || "EU" });
      if (wiki) PHOTOS_WIKI["event:" + id] = wiki;
      RECHERCHE_PHOTO["event:" + id] = nom;
    });
  }
}

// Saisons de cartes : une série par mois ; la 1re carte de chaque série est une carte animée
const MOIS_SAISON = new Date().toISOString().slice(0, 7);
const SAISONS = extra("SAISONS_CARTES") || {};
for (const [mois, sa] of Object.entries(SAISONS)) {
  sa.cartes.forEach(([id, nom, pays, emoji, rarete, anecdote, wiki], i) => {
    const cid = "saison:" + id.replace(/_/g, "-");
    add({ id: cid, univers: "monde", type: "monument", rarete, saisonnier: "saison-" + mois, num: i + 1, nom, pays, emoji, anecdote, animee: i === 0, continent: CONT_PAYS[pays] || { PF: "OC", PR: "NA" }[pays] || "OC" });
    if (wiki) PHOTOS_WIKI[cid] = wiki;
    RECHERCHE_PHOTO[cid] = nom;
  });
}

// Un seul univers : le monde (gardé sous cette forme pour compte.js)
const UNIVERS = {
  monde: { nom: "Monde", emoji: "🌍", dos: "🌐", titre: "Collectionner le monde",
    intro: "Pays, villes, monuments, nature, animaux, gastronomie et merveilles : ouvrez des boosters, complétez l'atlas et affrontez les autres joueurs avec vos cartes." },
};
const of = (u, type) => CARDS.filter((c) => c.univers === u && (!type || c.type === type));

// Boosters supplémentaires : le Méga (10 cartes) et les boosters thématiques (un type ou un continent)
PACKS.mega = { nom: "Méga", emoji: "📦", prix: 1000, cartes: 10, garanties: [2, 2, 3], shiny: 1.5,
  poids: { "commun": 40, "peu-commun": 33, "rare": 17, "epique": 6.5, "ultra-rare": 2.4, "legendaire": 1.1 },
  desc: "10 cartes d'un coup ! Deux rares et une épique ou mieux garanties." };

// Boosters d'événement : disponibles seulement quand l'administrateur active l'événement.
// Ils contiennent 2 cartes de l'événement et 3 cartes normales ; les cartes d'événement ne sortent nulle part ailleurs.
let EVENEMENT = (() => { try { const e = JSON.parse(localStorage.getItem("worldcards:evenement")); return e && e.fin > Date.now() ? e : null; } catch { return null; } })();
let PROCHAIN_EVENEMENT = null; // événement programmé (annoncé avant son début)
const evenementActif = (cle) => !!EVENEMENT && EVENEMENT.cle === cle && EVENEMENT.fin > Date.now();
if (typeof EVENEMENTS_SAISONNIERS !== "undefined") for (const [cle, ev] of Object.entries(EVENEMENTS_SAISONNIERS)) {
  PACKS[cle] = { nom: ev.nom, emoji: ev.emoji, prix: 350, cartes: 5, garanties: [2], shiny: 2, evenement: cle, couleur: ev.couleur,
    poids: { "commun": 20, "peu-commun": 35, "rare": 25, "epique": 14, "ultra-rare": 4, "legendaire": 2 },
    desc: `Événement limité : 2 cartes exclusives « ${ev.theme} » par booster, Shiny ×2.` };
}

// Booster de la série du mois (disponible seulement pendant le mois)
if (SAISONS[MOIS_SAISON]) {
  const sa = SAISONS[MOIS_SAISON];
  PACKS["saison-" + MOIS_SAISON] = { nom: sa.nom, emoji: sa.emoji, prix: 320, cartes: 5, garanties: [2], shiny: 1.5, evenement: "saison-" + MOIS_SAISON, couleur: sa.couleur, saison: true,
    poids: { "commun": 25, "peu-commun": 35, "rare": 24, "epique": 11, "ultra-rare": 3.5, "legendaire": 1.5 },
    desc: `Série du mois : 2 cartes « ${sa.nom} » par booster, dont la carte animée exclusive !` };
}
for (const t of ["ville", "monument", "nature", "animal", "plat", "culture"]) {
  if (!of("monde", t).length) continue;
  PACKS["theme-" + t] = { nom: PLURIEL[t], emoji: EMOJI_TYPE[t], prix: 260, cartes: 5, garanties: [2], shiny: 1, theme: true,
    filtre: (c) => c.type === t, desc: `5 cartes « ${TYPES[t]} », dont une rare ou mieux.` };
}
for (const [k, ct] of Object.entries(CONTINENTS)) {
  PACKS["cont-" + k] = { nom: ct.nom, emoji: ct.emoji, prix: 260, cartes: 5, garanties: [2], shiny: 1, theme: true, couleur: ct.couleur,
    filtre: (c) => c.continent === k, desc: `5 cartes d'${ct.nom}, dont une rare ou mieux.` };
}
const PACKS_PRINCIPAUX = ["monde", "argent", "or", "mega", "prestige"];
// Offre du jour : un booster à -40 %, une fois par jour
const offreDuJour = () => { const cles = Object.keys(PACKS).filter((k) => k !== "monde" && k !== "prestige" && !PACKS[k].evenement && !PACKS[k].saison); return cles[COMBAT.hash(today()) % cles.length]; };
const prixOffre = (k) => Math.round(PACKS[k].prix * 0.6 / 10) * 10;

/* =====================================================================
   Sauvegarde
   ===================================================================== */
const SAVE_KEY = "worldcards:v1";
const nouvelleSauvegarde = () => ({
  coins: 200, poussiere: 0, paysRecompense: {}, owned: {}, shiny: {}, holo: {}, doree: {}, qualite: {}, nouveaux: {}, recents: [], badges: {},
  boosters: { monde: 3, argent: 0, or: 0, prestige: 0, halloween: 1, noel: 1 }, gratuitLe: 0, xp: 0, defisFaits: 0, son: true, premiumJour: "", prestigeSemaine: "", ouverts: 0,
  pity: 0, tempsJeuTotal: 0, nbSessions: 1, premierJour: new Date().toISOString(),
  quiz: { monde: { serie: 0, record: 0, bonnes: 0, total: 0 } }, quizJour: { d: "", n: 0 },
  deck: [], combat: { victoires: 0, defaites: 0, jour: "", recompenses: 0 }, solo: {},
  univers: "monde", vue: "accueil", theme: "", photos: true,
});
// Anciennes sauvegardes : Gaming et Objets ont disparu, leurs cartes sont échangées contre des pièces
function migrer(s) {
  const d = nouvelleSauvegarde();
  s = { ...d, ...s, boosters: { ...d.boosters, ...s.boosters }, quiz: { ...d.quiz, ...s.quiz }, combat: { ...d.combat, ...s.combat }, quizJour: { ...d.quizJour, ...s.quizJour } };
  s.univers = "monde";
  s.doree ||= {};
  s.pity = s.pity || 0;
  s.tempsJeuTotal = s.tempsJeuTotal || 0;
  s.nbSessions = (s.nbSessions || 0) + 1;
  s.premierJour = s.premierJour || new Date().toISOString();
  if (!s.migreMonde) {
    let pieces = 0;
    for (const id of Object.keys(s.owned)) {
      if (!BY_ID[id] && /^(jeu|gsecret|obj|osecret):/.test(id)) { pieces += 40 * s.owned[id]; delete s.owned[id]; delete s.nouveaux[id]; if (s.shiny) delete s.shiny[id]; }
    }
    const anciens = (s.boosters.gaming || 0) + (s.boosters.objets || 0);
    s.boosters.monde += anciens; delete s.boosters.gaming; delete s.boosters.objets;
    delete s.quiz.gaming; delete s.quiz.objets;
    s.recents = (s.recents || []).filter((id) => BY_ID[id]);
    s.vitrine = (s.vitrine || []).filter((id) => BY_ID[id]);
    s.coins += pieces;
    s.migreMonde = 1;
    if (pieces || anciens) s.messageMigration = { pieces, boosters: anciens };
  }
  // Chaque carte possédée reçoit ses statistiques (qualité tirée au hasard)
  s.qualite ||= {}; s.holo ||= {};
  for (const id of Object.keys(s.owned)) if (BY_ID[id] && !s.qualite[id]) s.qualite[id] = COMBAT.tirerQualite();
  s.deck = (s.deck || []).filter((id) => BY_ID[id] && (s.owned[id] || 0) > 0);
  return s;
}
function charger() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.owned) return migrer(s);
  } catch {}
  return nouvelleSauvegarde();
}
let S = charger();
const sauver = () => {
  S.majLocale = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {}
  if (typeof apresSauvegarde === "function") apresSauvegarde(); // sauvegarde dans le cloud (compte.js)
};
// Les anciennes collections personnelles (univers Gaming) restent stockées, sans être affichées
let PERSO = { collections: [], illus: {} };
const sauverPerso = () => { if (typeof apresSauvegarde === "function") apresSauvegarde(); };

const has = (id) => (S.owned[id] || 0) > 0;
const count = (ids) => ids.filter(has).length;

/* =====================================================================
   Statistiques de combat
   ===================================================================== */
function statsDe(c, qualite = S.qualite[c.id], exemplaires = S.owned[c.id] || 1, shiny = !!S.shiny?.[c.id], doree = !!S.doree?.[c.id]) {
  return COMBAT.stats(c.id, c.type, c.rarete, qualite, exemplaires, shiny, doree);
}
const puissanceDe = (c) => COMBAT.puissance(statsDe(c));
const coutDe = (c) => COMBAT.COUT[c.rarete] || 1;

/* =====================================================================
   Carte du monde : silhouettes et atlas
   ===================================================================== */
// La carte du monde (d3, topojson, Natural Earth : ~1 Mo) n'est chargée que pour l'Atlas ;
// les silhouettes des cartes viennent de data/silhouettes.js (pré-calculées)
const FEATURES = {};
let NUM_TO_CODE = {}, cartePrete = null;
function chargerCarteMonde() {
  if (cartePrete) return cartePrete;
  const script = (src) => new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.append(s); });
  cartePrete = (async () => {
    if (typeof d3 === "undefined") await script("vendor/d3.min.js");
    if (typeof topojson === "undefined") await script("vendor/topojson-client.min.js");
    if (typeof CARTE_MONDE === "undefined") await script("data/carte.js");
    // Plusieurs objets peuvent porter le même code (ex. l'Australie et les îles Ashmore) : on garde le plus grand
    topojson.feature(CARTE_MONDE, CARTE_MONDE.objects.countries).features.forEach((f) => { if (f.id && (!FEATURES[f.id] || d3.geoArea(f) > d3.geoArea(FEATURES[f.id]))) FEATURES[f.id] = f; });
    NUM_TO_CODE = Object.fromEntries(Object.entries(CODES_NUMERIQUES).map(([c, n]) => [n, c]));
  })();
  cartePrete.catch(() => { cartePrete = null; });
  return cartePrete;
}
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
  if (typeof SILHOUETTES !== "undefined" && SILHOUETTES[code]) return (silCache[code] = `<svg class="sil" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="${SILHOUETTES[code]}"/></svg>`);
  if (typeof CODES_NUMERIQUES === "undefined") return "";
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
  return CONTINENTS[c.continent]?.couleur || "#888";
}
function sousTitre(c) {
  switch (c.type) {
    case "pays": return "🏛️ " + court(c.capitale);
    case "ville": case "monument": return "📍 " + NOM_PAYS[c.pays];
    case "nature": return "📍 " + NOM_PAYS[c.pays];
    case "animal": return "🐾 " + NOM_PAYS[c.pays];
    case "plat": return "🍽️ " + NOM_PAYS[c.pays];
    case "culture": return "🎭 " + NOM_PAYS[c.pays];
    case "merveille": return c.groupe === "antiques" ? "🏺 Merveille antique" : "🌟 Merveille moderne";
    case "secrete": return "Carte secrète";
  }
  return "";
}
const totalType = (c) => of(c.univers, c.type).length;

/* =====================================================================
   Vraies photos : chargées depuis Wikipédia / Wikimedia Commons
   ===================================================================== */
const PHOTOS_KEY = "worldcards:photos:v1";
let PHOTOS = (() => {
  try { const j = JSON.parse(localStorage.getItem(PHOTOS_KEY)); if (j && Date.now() - j.t < 30 * 864e5) return j.data || {}; } catch {}
  return {};
})();
const photoDe = (id) => (S.photos !== false ? PHOTOS[id]?.src : null);
function photoHTML(c, locked) {
  const src = photoDe(c.id);
  if (!src || (locked && c.type === "secrete")) return "";
  return `<img class="photo${locked ? " teaser" : ""}" src="${esc(src)}" alt="${locked ? "" : "Photo : " + esc(c.nom)}" loading="lazy">`;
}
// Ajoute les photos aux cartes déjà affichées, une fois chargées
function rafraichirPhotos(root = document) {
  for (const el of root.querySelectorAll(".card[data-id]")) {
    const c = BY_ID[el.dataset.id], art = el.querySelector(".art");
    if (!c || !art || art.querySelector(".photo")) continue;
    const h = photoHTML(c, el.classList.contains("locked"));
    if (h) art.insertAdjacentHTML("afterbegin", h);
  }
}
document.addEventListener("error", (e) => { if (e.target.classList?.contains("photo")) e.target.remove(); }, true);
async function requeteWiki(params) {
  const u = new URL("https://fr.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ action: "query", format: "json", formatversion: "2", origin: "*", ...params })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
const pagePhoto = (p) => (p?.thumbnail?.source ? { src: p.thumbnail.source, file: p.pageimage || null, titre: p.title } : null);
function memoriserPhotos() { try { localStorage.setItem(PHOTOS_KEY, JSON.stringify({ t: Date.now(), data: PHOTOS })); } catch {} }
let chargementPhotos = null;
function chargerPhotos() {
  if (S.photos === false) return Promise.resolve();
  return (chargementPhotos ||= (async () => {
    // Les cartes possédées d'abord : ce sont celles que l'on regarde
    const manquants = Object.keys(PHOTOS_WIKI).filter((id) => BY_ID[id] && !(id in PHOTOS)).sort((a, b) => has(b) - has(a));
    if (!manquants.length) return;
    try {
      // Par lots de 45 articles : la photo principale de chaque article
      for (let i = 0; i < manquants.length; i += 45) {
        const lot = manquants.slice(i, i + 45);
        const j = await requeteWiki({ redirects: "1", prop: "pageimages", piprop: "thumbnail|name", pithumbsize: "480", titles: lot.map((id) => PHOTOS_WIKI[id]).join("|") });
        const alias = {};
        for (const x of [...(j.query?.normalized || []), ...(j.query?.redirects || [])]) alias[x.from] = x.to;
        const fin = (t) => { for (let k = 0; k < 4 && alias[t]; k++) t = alias[t]; return t; };
        const pages = j.query?.pages || [];
        for (const id of lot) { const ph = pagePhoto(pages.find((p) => p.title === fin(PHOTOS_WIKI[id]))); if (ph) PHOTOS[id] = ph; }
        if (i % 180 === 0) { memoriserPhotos(); rafraichirPhotos(); }
      }
      memoriserPhotos(); rafraichirPhotos();
      // Article introuvable ou sans photo : on cherche l'article le plus proche
      const restants = manquants.filter((x) => !PHOTOS[x]);
      for (let i = 0; i < restants.length; i += 4) {
        await Promise.all(restants.slice(i, i + 4).map(async (id) => {
          try {
            const j = await requeteWiki({ generator: "search", gsrsearch: RECHERCHE_PHOTO[id] || PHOTOS_WIKI[id], gsrlimit: "1", prop: "pageimages", piprop: "thumbnail|name", pithumbsize: "480" });
            PHOTOS[id] = pagePhoto(j.query?.pages?.[0]);
          } catch {}
        }));
        if (i % 40 === 0) rafraichirPhotos();
      }
      memoriserPhotos(); rafraichirPhotos();
    } catch (e) {
      console.info("Photos Wikipédia indisponibles :", e.message); // hors ligne : les cartes gardent leur dessin
    }
  })().finally(() => { chargementPhotos = null; }));
}
async function creditPhoto(c, el) {
  const p = PHOTOS[c.id];
  if (!p || S.photos === false) return;
  el.innerHTML = `<a href="https://fr.wikipedia.org/wiki/${encodeURIComponent(p.titre.replace(/ /g, "_"))}" target="_blank" rel="noopener">📖 Lire l'article Wikipédia</a>`;
  if (!p.file) return;
  try {
    const j = await requeteWiki({ prop: "imageinfo", iiprop: "extmetadata|url", titles: "Fichier:" + p.file });
    const ii = j.query?.pages?.[0]?.imageinfo?.[0];
    if (!ii) return;
    const m = ii.extmetadata || {};
    const texte = (h) => new DOMParser().parseFromString(h || "", "text/html").body.textContent.trim();
    const auteur = texte(m.Artist?.value) || "auteur inconnu", licence = texte(m.LicenseShortName?.value);
    el.insertAdjacentHTML("afterbegin", `📷 Photo : ${esc(auteur)}${licence ? " · " + esc(licence) : ""} · <a href="${esc(ii.descriptionurl)}" target="_blank" rel="noopener">Wikimedia Commons</a><br>`);
  } catch {}
}

// Icônes au trait des cartes (pas d'emoji)
const ICONE_TYPE = { pays: "drapeau", ville: "ville", monument: "monument", nature: "montagne", animal: "patte", plat: "plat", culture: "masque", merveille: "etincelle", secrete: "cle" };
const icCarte = (k) => `<svg class="rc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(typeof TRAITS === "object" && TRAITS[k]) || '<circle cx="12" cy="12" r="3"/>'}</svg>`;
function cardHTML(c, opts = {}) {
  const locked = opts.locked ?? !has(c.id);
  const r = c.rarete;
  const col = couleurCarte(c);
  if (locked) {
    const secret = c.type === "secrete";
    const sil = c.type === "pays" ? silhouette(c.code) : "";
    return `<div class="card locked${secret ? " secret-locked" : ""}" data-id="${esc(c.id)}" data-r="${r}" tabindex="0" role="button" aria-label="${esc(secret ? "Carte secrète" : c.nom)} (non possédée)">
      <div class="in"><div class="head"><span>${TYPES[c.type]}</span><span>#${String(c.num).padStart(3, "0")}</span></div>
      <div class="art">${sil}${photoHTML(c, true)}<span class="q">${secret ? "✦" : "?"}</span></div>
      <div class="name">${secret ? "???" : esc(c.nom)}</div><div class="sub">${secret ? "Terminez une collection" : "Non découverte"}</div></div></div>`;
  }
  let art = "";
  if (c.type === "pays") art = `<img class="flag" src="flags/${c.code.toLowerCase()}.svg" alt="Drapeau : ${esc(c.nom)}" loading="lazy">`;
  else art = `<span class="rc-ic-fond">${icCarte(ICONE_TYPE[c.type] || "point")}</span>`;
  art = photoHTML(c, false) + art;
  const n = S.owned[c.id] || 0;
  const doree = opts.doree ?? !!S.doree?.[c.id];
  const shiny = !doree && (opts.shiny ?? !!S.shiny?.[c.id]);
  const holo = !doree && !shiny && (opts.holo ?? !!S.holo?.[c.id]);
  const st = opts.stats ?? (n ? statsDe(c, S.qualite[c.id], n, shiny, doree) : statsDe(c, [0, 0, 0], 1, shiny, doree));
  const tal = COMBAT.TALENTS[st.talent || COMBAT.talentDe(c.id, c.type)];
  return `<div class="card${doree ? " doree" : ""}${shiny ? " shiny" : ""}${holo ? " holo" : ""}${c.animee ? " animee" : ""}" data-id="${esc(c.id)}" data-r="${r}" data-t="${c.type}" style="--g:${degrade(col)};--c:${col}" ${c.saisonnier ? `data-saisonnier="${c.saisonnier}"` : ""} tabindex="0" role="button" aria-label="${esc(c.nom)}">
    ${opts.compte && n > 1 ? `<span class="badge-count">×${n}</span>` : ""}${opts.compte && S.nouveaux[c.id] ? `<span class="badge-new">NEW</span>` : ""}
    <div class="in">
    <div class="art" style="--g:${degrade(col)}">${art}</div><span class="rc-voile" aria-hidden="true"></span>
    <div class="head rc-tete"><span class="rc-badge">${icCarte(ICONE_TYPE[c.type] || "point")}${TYPES[c.type]}${c.saisonnier ? ` · ${c.saisonnier === "halloween" ? "Halloween" : "Noël"}` : ""}</span>
      <span class="rc-statut" title="${RARETES[r].nom}${doree ? " · Version Dorée" : shiny ? " · Shiny" : holo ? " · Holo" : ""}"><i class="rc-point"></i>${doree ? "Dorée" : shiny ? "Shiny" : holo ? "Holo" : RARETES[r].nom}</span></div>
    <div class="rc-identite"><div class="name">${esc(c.nom)}</div><div class="sub">${esc(String(sousTitre(c)).replace(/[\p{Extended_Pictographic}\uFE0F]+\s*/gu, ""))}</div></div>
    <div class="rc-pied"><div class="cstats" title="Attaque · Défense · Points de vie"><span class="rc-label">N° ${String(c.num).padStart(3, "0")} · Coût ${coutDe(c)}${st.niveau > 1 ? ` · Niv. ${st.niveau}` : ""}</span>
      <span class="rc-valeur"><span class="s-atk">${icCarte("epees")}${st.atk}</span><span class="s-def">${icCarte("bouclier")}${st.def}</span><span class="s-pv">${icCarte("coeur")}${st.pv}</span></span></div>
      <span class="rc-tuile"${tal ? ` title="Talent : ${tal.nom} — ${esc(tal.desc)}"` : ""}>${icCarte(tal ? "eclair" : ICONE_TYPE[c.type] || "point")}</span></div></div></div>`;
}

/* =====================================================================
   Progression : secrets et badges
   ===================================================================== */
function idsCondition(cond) {
  const [k, v] = cond.split(":");
  if (k === "continent") return of("monde", "pays").filter((c) => c.continent === v).map((c) => c.id);
  if (k === "merveilles") return of("monde", "merveille").filter((c) => c.groupe === v).map((c) => c.id);
  if (k === "tous-les-pays") return of("monde", "pays").map((c) => c.id);
  if (k === "type") return of("monde", v).map((c) => c.id);
  return [];
}
function libelleCondition(cond) {
  const [k, v] = cond.split(":");
  if (k === "continent") return `Collectionnez tous les pays d'${CONTINENTS[v].nom}`;
  if (k === "merveilles") return `Collectionnez les 7 merveilles ${v === "antiques" ? "du monde antique" : "du monde moderne"}`;
  if (k === "tous-les-pays") return "Collectionnez les 195 pays";
  if (k === "type") return `Collectionnez toutes les cartes « ${TYPES[v]} »`;
  return "";
}

const RECOMPENSE = { bronze: 50, argent: 120, or: 300 };
const CATEGORIES_BADGES = { collection: "📚 Collection", continent: "🌍 Continents", pays: "🏳️ Pays", combat: "⚔️ Combat", joueur: "⭐ Joueur", special: "✨ Spécial" };
// Cartes liées à chaque pays (le pays lui-même, ses villes, monuments, animaux, plats…)
const CARTES_PAR_PAYS = {};
for (const c of CARDS) { const k = c.type === "pays" ? c.code : c.pays; if (k) (CARTES_PAR_PAYS[k] ||= []).push(c.id); }
const TYPES_COLLECTION = ["ville", "monument", "nature", "animal", "plat", "culture"];
let BADGES_DEF = null;
function definirBadges() {
  const list = [];
  const frac = (ids) => () => [count(ids), ids.length];
  const palier = (n, max) => () => [Math.min(max, n()), max];
  const ajoute = (b) => list.push({ seuil: 1, ...b });
  // Continents : pays
  for (const [k, ct] of Object.entries(CONTINENTS)) {
    const ids = of("monde", "pays").filter((c) => c.continent === k).map((c) => c.id);
    [["bronze", 0.25], ["argent", 0.5], ["or", 1]].forEach(([niv, sv]) =>
      ajoute({ id: `cont-${k}-${niv}`, cat: "continent", nom: `${ct.nom} — ${niv}`, emoji: ct.emoji, niveau: niv, desc: `${Math.round(sv * 100)} % des pays d'${ct.nom}`, prog: frac(ids), seuil: sv }));
    // Chaque type de carte sur chaque continent
    for (const t of TYPES_COLLECTION) {
      const idsT = of("monde", t).filter((c) => c.continent === k).map((c) => c.id);
      if (idsT.length >= 3) ajoute({ id: `ct-${k}-${t}`, cat: "continent", nom: `${PLURIEL[t]} : ${ct.nom}`, emoji: EMOJI_TYPE[t], niveau: "argent", desc: `Toutes les cartes « ${TYPES[t]} » d'${ct.nom} (${idsT.length})`, prog: frac(idsT) });
    }
  }
  // Collections par type
  const noms = { ville: ["Voyageur", "Globe-trotteur"], monument: ["Guide touristique", "Bâtisseur"], nature: ["Randonneur", "Explorateur"], animal: ["Observateur", "Naturaliste"], plat: ["Gourmand", "Grand chef"], culture: ["Curieux", "Ambassadeur"] };
  for (const t of TYPES_COLLECTION) {
    const ids = of("monde", t).map((c) => c.id);
    if (!ids.length) continue;
    const [debut, fin] = noms[t];
    for (const [n, niv] of [[10, "bronze"], [50, "argent"]]) if (ids.length > n) ajoute({ id: `${t}-${n}`, cat: "collection", nom: `${debut} ${n === 10 ? "débutant" : "confirmé"}`, emoji: EMOJI_TYPE[t], niveau: niv, desc: `${n} cartes « ${TYPES[t]} »`, prog: palier(() => count(ids), n) });
    ajoute({ id: t === "ville" ? "villes" : t === "monument" ? "monuments" : `${t}-tout`, cat: "collection", nom: fin, emoji: EMOJI_TYPE[t], niveau: "or", desc: `Toutes les cartes « ${TYPES[t]} » (${ids.length})`, prog: frac(ids) });
  }
  ajoute({ id: "merv-mod", cat: "collection", nom: "Merveilles modernes", emoji: "🌟", niveau: "or", desc: "Les 7 merveilles du monde moderne", prog: frac(idsCondition("merveilles:modernes")) });
  ajoute({ id: "merv-ant", cat: "collection", nom: "Merveilles antiques", emoji: "🏺", niveau: "or", desc: "Les 7 merveilles du monde antique", prog: frac(idsCondition("merveilles:antiques")) });
  ajoute({ id: "maitre", cat: "collection", nom: "Maître du monde", emoji: "👑", niveau: "or", desc: "Les 195 pays", prog: frac(idsCondition("tous-les-pays")) });
  for (const r of ["epique", "ultra-rare", "legendaire"]) {
    const ids = CARDS.filter((c) => c.rarete === r).map((c) => c.id);
    ajoute({ id: `rar-${r}-10`, cat: "collection", nom: `10 ${RARETES[r].nom.toLowerCase()}s`, emoji: RARETES[r].gems.slice(0, 2), niveau: "argent", desc: `10 cartes ${RARETES[r].nom.toLowerCase()}s différentes`, prog: palier(() => count(ids), 10) });
    ajoute({ id: `rar-${r}`, cat: "collection", nom: `Toutes les ${RARETES[r].nom.toLowerCase()}s`, emoji: RARETES[r].gems.slice(0, 2), niveau: "or", desc: `Les ${ids.length} cartes ${RARETES[r].nom.toLowerCase()}s`, prog: frac(ids) });
  }
  const toutes = CARDS.map((c) => c.id);
  const paliers = [[25, "bronze", "Premiers pas", "🎒"], [100, "argent", "Collectionneur", "📚"], [300, "or", "Grand collectionneur", "🗃️"], [600, "or", "Encyclopédie vivante", "📖"], [1000, "or", "Le monde entier", "🌐"], [1500, "or", "Légende vivante", "🏆"]];
  for (const [n, niv, nom, emoji] of paliers) if (toutes.length >= n) ajoute({ id: n === 100 ? "collec-100" : n === 300 ? "collec-300" : n === 600 ? "collec-600" : n === 1000 ? "collec-1000" : `collec-${n}`, cat: "collection", nom, emoji, niveau: niv, desc: `${fmt(n)} cartes différentes`, prog: palier(() => count(toutes), n) });
  // Pays : toutes les cartes liées à un pays
  for (const [code, ids] of Object.entries(CARTES_PAR_PAYS)) {
    if (ids.length < 3) continue;
    ajoute({ id: `pays-${code}`, cat: "pays", nom: `Ambassadeur : ${NOM_PAYS[code]}`, emoji: `<img class="bdrap" src="flags/${code.toLowerCase()}.svg" alt="">`, niveau: ids.length >= 6 ? "argent" : "bronze", desc: `Les ${ids.length} cartes liées à ce pays`, prog: frac(ids) });
  }
  // Combat
  const vic = () => S.combat.victoires;
  for (const [n, niv, nom, emoji] of [[1, "bronze", "Premier combat", "⚔️"], [10, "bronze", "Combattant", "🥊"], [25, "argent", "Stratège", "🛡️"], [100, "or", "Conquérant", "🏆"], [250, "or", "Seigneur de guerre", "🗡️"], [500, "or", "Invincible", "💪"]])
    ajoute({ id: n === 1 ? "combat-1" : `combat-${n}`, cat: "combat", nom, emoji, niveau: niv, desc: `Gagner ${n} combat${n > 1 ? "s" : ""}`, prog: palier(vic, n) });
  const etoilesSolo = () => Object.values(S.solo || {}).reduce((a, b) => a + b, 0);
  for (const [n, niv, nom] of [[3, "bronze", "Aventurier"], [15, "argent", "Grand voyageur"], [45, "or", "Tour du monde"], [90, "or", "Perfection mondiale"]])
    ajoute({ id: `solo-${n}`, cat: "combat", nom, emoji: "⭐", niveau: niv, desc: `${n} étoiles en mode Solo`, prog: palier(etoilesSolo, n) });
  for (const k of Object.keys(CONTINENTS)) ajoute({ id: `boss-${k}`, cat: "combat", nom: `Boss vaincu : ${CONTINENTS[k].nom}`, emoji: "👑", niveau: "argent", desc: `Battre le boss d'${CONTINENTS[k].nom} en mode Solo`, prog: palier(() => ((S.solo || {})[`${k}-4`] ? 1 : 0), 1) });
  const niv5 = () => CARDS.filter((c) => (S.owned[c.id] || 0) >= 16).length;
  ajoute({ id: "niveau-max", cat: "combat", nom: "Carte au maximum", emoji: "⭐", niveau: "argent", desc: "Une carte au niveau 5 (16 exemplaires)", prog: palier(niv5, 1) });
  ajoute({ id: "niveau-max-10", cat: "combat", nom: "Armée d'élite", emoji: "🎖️", niveau: "or", desc: "10 cartes au niveau 5", prog: palier(niv5, 10) });
  // Joueur
  const nivJ = () => niveauJoueur().niveau;
  for (const [n, niv] of [[5, "bronze"], [10, "argent"], [25, "or"], [50, "or"], [100, "or"]]) ajoute({ id: `joueur-${n}`, cat: "joueur", nom: `Niveau ${n}`, emoji: "🎓", niveau: niv, desc: `Atteindre le niveau ${n}`, prog: palier(nivJ, n) });
  for (const [n, niv] of [[10, "bronze"], [50, "argent"], [200, "or"], [500, "or"]]) ajoute({ id: `boosters-${n}`, cat: "joueur", nom: `${n} boosters ouverts`, emoji: "🎁", niveau: niv, desc: `Ouvrir ${n} boosters`, prog: palier(() => S.ouverts, n) });
  const bonnes = () => S.quiz.monde.bonnes || 0, record = () => S.quiz.monde.record || 0;
  for (const [n, niv] of [[10, "bronze"], [100, "argent"], [500, "or"]]) ajoute({ id: `quiz-${n}`, cat: "joueur", nom: `Érudit ${n}`, emoji: "🧠", niveau: niv, desc: `${n} bonnes réponses au quiz`, prog: palier(bonnes, n) });
  for (const [n, niv] of [[5, "bronze"], [10, "argent"], [20, "or"]]) ajoute({ id: `serie-${n}`, cat: "joueur", nom: `Série de ${n}`, emoji: "🔥", niveau: niv, desc: `${n} bonnes réponses d'affilée`, prog: palier(record, n) });
  for (const [n, niv] of [[1, "bronze"], [10, "argent"], [30, "or"]]) ajoute({ id: `defis-${n}`, cat: "joueur", nom: `${n} défi${n > 1 ? "s" : ""} du jour`, emoji: "📅", niveau: niv, desc: `Réussir ${n} défi${n > 1 ? "s" : ""} du jour`, prog: palier(() => S.defisFaits || 0, n) });
  // Spécial
  ajoute({ id: "secret-1", cat: "special", nom: "Chasseur de secrets", emoji: "🔮", niveau: "bronze", desc: "Débloquer une carte secrète", prog: palier(() => count(of("monde", "secrete").map((c) => c.id)), 1) });
  ajoute({ id: "secret-tout", cat: "special", nom: "Gardien des mystères", emoji: "🗝️", niveau: "or", desc: "Toutes les cartes secrètes", prog: frac(of("monde", "secrete").map((c) => c.id)) });
  const nbShiny = () => CARDS.filter((c) => S.shiny?.[c.id]).length, nbHolo = () => CARDS.filter((c) => S.holo?.[c.id]).length;
  for (const [n, niv, nom, id] of [[1, "bronze", "Premier Shiny", "shiny1-monde"], [3, "bronze", "Brillant", "shiny3"], [10, "or", "Collection brillante", "shiny10-monde"], [25, "or", "Éblouissant", "shiny25"]]) ajoute({ id, cat: "special", nom, emoji: "✨", niveau: niv, desc: `${n} carte${n > 1 ? "s" : ""} Shiny`, prog: palier(nbShiny, n) });
  for (const [n, niv, nom, id] of [[10, "bronze", "Reflets irisés", "holo-10"], [50, "argent", "Arc-en-ciel", "holo-50"], [150, "or", "Prisme", "holo-150"]]) ajoute({ id, cat: "special", nom, emoji: "🌈", niveau: niv, desc: `${n} cartes Holo`, prog: palier(nbHolo, n) });
  return list;
}
function badgesDe() {
  BADGES_DEF ||= definirBadges();
  return BADGES_DEF.map((b) => { const [n, t] = b.prog(); return { ...b, n, t, ok: t > 0 && n / t >= b.seuil }; });
}

/* =====================================================================
   Niveau du joueur (XP) et défis du jour
   ===================================================================== */
const xpPourNiveau = (n) => 80 + n * 40; // XP nécessaire pour passer du niveau n au suivant
function niveauJoueur(xp = S.xp || 0) {
  let n = 1;
  while (xp >= xpPourNiveau(n)) { xp -= xpPourNiveau(n); n++; }
  return { niveau: n, xp, besoin: xpPourNiveau(n) };
}
function gagnerXP(n, pourquoi) {
  const avant = niveauJoueur().niveau;
  S.xp = (S.xp || 0) + n;
  const apres = niveauJoueur().niveau;
  for (let niv = avant + 1; niv <= apres; niv++) {
    const pieces = 100 + niv * 20;
    S.coins += pieces;
    const booster = niv % 10 === 0 ? "or" : niv % 5 === 0 ? "argent" : null;
    if (booster) S.boosters[booster] = (S.boosters[booster] || 0) + 1;
    toast(`🎓 <b>Niveau ${niv} !</b> +${pieces} 🪙${booster ? ` et un booster ${PACKS[booster].nom}` : ""}`, 5000);
    if (typeof son === "function") son("niveau");
  }
  majCoins(); majNiveau();
}
function majNiveau() {
  const n = niveauJoueur(), el = $("#niveauJoueur");
  if (el) { el.innerHTML = `<b>Niv. ${n.niveau}</b><i style="width:${(n.xp / n.besoin) * 100}%"></i>`; el.title = `Niveau ${n.niveau} · ${n.xp}/${n.besoin} XP`; }
}
// Trois défis différents chaque jour
const MODELES_DEFIS = [
  { id: "boosters", nom: "Ouvrir {n} boosters", cibles: [2, 3, 4], emoji: "🎁" },
  { id: "victoires", nom: "Gagner {n} combats", cibles: [2, 3, 5], emoji: "⚔️" },
  { id: "solo", nom: "Gagner {n} étapes en mode Solo", cibles: [1, 2], emoji: "🗺️" },
  { id: "quiz", nom: "Donner {n} bonnes réponses au quiz", cibles: [3, 5, 7], emoji: "❓" },
  { id: "nouvelles", nom: "Découvrir {n} nouvelles cartes", cibles: [5, 8, 12], emoji: "🆕" },
  { id: "speciaux", nom: "Utiliser {n} attaques spéciales", cibles: [3, 5, 8], emoji: "✨" },
  { id: "ko", nom: "Mettre {n} cartes K.O.", cibles: [5, 8, 12], emoji: "💥" },
];
function defisDuJour() {
  if (S.defis?.d === today()) return S.defis;
  const r = COMBAT.rng(COMBAT.hash(today() + (S.compte || "")));
  const modeles = MODELES_DEFIS.slice().sort(() => r() - 0.5).slice(0, 3);
  S.defis = { d: today(), bonus: false, liste: modeles.map((m) => { const n = m.cibles[Math.floor(r() * m.cibles.length)]; return { id: m.id, n, prog: 0, recu: false }; }) };
  return S.defis;
}
const recompenseDefi = (d) => 60 + d.n * 10;
function progresDefi(id, n = 1) {
  const D = defisDuJour();
  for (const d of D.liste) {
    if (d.id !== id || d.prog >= d.n) continue;
    d.prog = Math.min(d.n, d.prog + n);
    if (d.prog >= d.n) toast(`📅 Défi réussi : ${MODELES_DEFIS.find((m) => m.id === id).nom.replace("{n}", d.n)} ! Récupérez la récompense sur l'accueil.`, 4500);
  }
}
function recupererDefi(i) {
  const D = defisDuJour(), d = D.liste[i];
  if (!d || d.prog < d.n || d.recu) return;
  d.recu = true; S.coins += recompenseDefi(d); S.defisFaits = (S.defisFaits || 0) + 1; gagnerXP(30);
  if (!D.bonus && D.liste.every((x) => x.recu)) { D.bonus = true; S.boosters.argent = (S.boosters.argent || 0) + 1; toast("🏅 Tous les défis du jour réussis : un booster Argent offert !", 5000); }
  sauver(); majCoins(); verifierProgression(); aller(S.vue);
}
function blocDefis() {
  const D = defisDuJour();
  return `<div class="panel defis"><div class="row" style="justify-content:space-between"><h3 style="margin:0">📅 Défis du jour</h3><span class="muted">Tous réussis : un booster Argent ${D.bonus ? "✓" : ""}</span></div>
    ${D.liste.map((d, i) => { const m = MODELES_DEFIS.find((x) => x.id === d.id); return `<div class="defi ${d.recu ? "fait" : ""}"><span class="em">${m.emoji}</span>
      <div style="flex:1;min-width:0"><b>${m.nom.replace("{n}", d.n)}</b><div class="bar"><i style="width:${(d.prog / d.n) * 100}%"></i></div><small class="muted">${d.prog}/${d.n} · +${recompenseDefi(d)} 🪙 +30 XP</small></div>
      ${d.recu ? "✅" : `<button class="btn small ${d.prog >= d.n ? "primary" : ""}" data-defi-recu="${i}" ${d.prog >= d.n ? "" : "disabled"}>Récupérer</button>`}</div>`; }).join("")}</div>`;
}

const aReveler = [];
// Vérifie secrets et badges après chaque gain ; renvoie vrai si quelque chose a été débloqué
function verifierProgression() {
  let changed = false;
  for (const c of CARDS.filter((x) => x.type === "secrete" && !has(x.id))) {
    const ids = idsCondition(c.condition);
    if (ids.length && ids.every(has)) {
      gagner(c.id);
      aReveler.push({ kind: "secret", card: c }); changed = true;
    }
  }
  const obtenus = [];
  for (const b of badgesDe()) {
    if (b.ok && !S.badges[b.id]) { S.badges[b.id] = today(); S.coins += RECOMPENSE[b.niveau]; obtenus.push(b); changed = true; }
  }
  if (obtenus.length) {
    S.xp = (S.xp || 0) + 20 * obtenus.length; majNiveau();
    if (typeof son === "function") son("badge");
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

// Ajoute un exemplaire : une nouvelle carte reçoit sa qualité ; un doublon peut l'améliorer
function gagner(id) {
  const neuf = !has(id);
  const avant = neuf ? 0 : (S.owned[id] || 0);
  S.owned[id] = avant + 1;
  const tirage = COMBAT.tirerQualite();
  let ameliore = false;
  if (neuf || !S.qualite[id]) S.qualite[id] = tirage;
  else if (tirage.reduce((a, b) => a + b, 0) > S.qualite[id].reduce((a, b) => a + b, 0)) { S.qualite[id] = tirage; ameliore = true; }
  const niveauPlus = !neuf && COMBAT.niveau(S.owned[id]) > COMBAT.niveau(avant);
  if (neuf) { S.nouveaux[id] = 1; S.recents = [id, ...S.recents.filter((x) => x !== id)].slice(0, 12); }
  return { neuf, ameliore, niveauPlus };
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
// Notifications discrètes : deux au maximum à l'écran, touchez pour fermer
function toast(html, ms = 3200) {
  const box = $("#toasts");
  while (box.children.length >= 2) box.firstElementChild.remove();
  const t = document.createElement("div"); t.className = "toast"; t.innerHTML = html;
  t.onclick = () => t.remove();
  box.appendChild(t); setTimeout(() => { t.classList.add("sort"); setTimeout(() => t.remove(), 300); }, ms);
}
function ouvrirModal(html, onClose) {
  const m = $("#modal");
  m.innerHTML = `<div class="box"><button class="close" data-close aria-label="Fermer">✕</button>${html}</div>`;
  m.classList.remove("hidden", "plein", "feuille", "sombre");
  m._onClose = onClose;
  document.body.style.overflow = "hidden";
}
function fermerModal() {
  const m = $("#modal");
  if (m.classList.contains("hidden")) return;
  m.classList.add("hidden"); m.classList.remove("plein", "feuille", "sombre"); m.innerHTML = "";
  document.body.style.overflow = "";
  const cb = m._onClose; m._onClose = null;
  if (cb) cb();
  revelerSuivant();
}
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" || e.target.closest("[data-close]")) fermerModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").classList.contains("verrou")) fermerModal(); });

// Booster gratuit et bonus premium
const gratuitDans = () => Math.max(0, (S.gratuitLe || 0) + GRATUIT_MS - Date.now());
const bonusPremiumDispo = () => premium() && S.premiumJour !== today();
const prestigeSemaineDispo = () => premium() && S.prestigeSemaine !== semaine();
const boostersEnStock = () => Object.values(S.boosters).reduce((a, b) => a + (b || 0), 0);
const NAV = [["accueil", "🏠", "Accueil"], ["boosters", "🎁", "Boutique"], ["album", "📚", "Album"], ["combat", "⚔️", "Combat"], ["atlas", "🗺️", "Atlas"], ["quiz", "❓", "Quiz"], ["badges", "🏅", "Badges"]];
// Vues hors menu (définies dans compte.js)
const VUES_GLOBALES = ["compte", "hub", "admin", "legal", "premium", "pays", "collections"];
// Toutes les destinations : menu latéral (ordinateur), onglets du bas et panneau « Plus » (mobile)
const DESTINATIONS = [
  ["accueil", "🏠", "Accueil"], ["boosters", "🎁", "Boutique"], ["album", "📚", "Album"], ["combat", "⚔️", "Combat"],
  ["collections", "🏳️", "Pays"], ["atlas", "🗺️", "Atlas"], ["quiz", "❓", "Quiz"], ["badges", "🏅", "Badges"], ["hub", "👥", "Communauté"], ["premium", "💎", "Premium"], ["compte", "👤", "Mon compte"],
];
const ONGLETS_MOBILE = ["accueil", "boosters", "album", "combat"];
const TITRES = Object.fromEntries([...DESTINATIONS.map(([v, ic, l]) => [v, `${ic} ${l}`]), ["admin", "👑 Administration"], ["legal", "📄 Informations légales"], ["pays", "🏳️ Collection du pays"]]);
function renderNav() {
  if (!NAV.some(([v]) => v === S.vue) && !VUES_GLOBALES.includes(S.vue)) S.vue = "accueil";
  const pill = boostersEnStock() + (gratuitDans() === 0 ? 1 : 0) + (bonusPremiumDispo() ? 2 : 0);
  const badge = (v) => (v === "boosters" && pill ? `<span class="pill">${pill}</span>` : "");
  const admin = typeof COMPTE !== "undefined" && COMPTE.admin;
  const dest = admin ? [...DESTINATIONS, ["admin", "👑", "Administration"]] : DESTINATIONS;
  // Onglets du bas (mobile) : 4 principaux + « Plus »
  const dansPlus = !ONGLETS_MOBILE.includes(S.vue);
  $("#nav").innerHTML = ONGLETS_MOBILE.map((v) => { const [, ic, label] = DESTINATIONS.find((d) => d[0] === v);
    return `<button data-v="${v}" class="${S.vue === v ? "on" : ""}"><span class="ic">${ic}</span><span>${label}</span>${badge(v)}</button>`; }).join("")
    + `<button data-plus class="${dansPlus ? "on" : ""}"><span class="ic">☰</span><span>Plus</span></button>`;
  $$("#nav button[data-v]").forEach((b) => b.onclick = () => aller(b.dataset.v));
  $("#nav [data-plus]").onclick = ouvrirMenuPlus;
  // Menu latéral (ordinateur)
  const nav = $("#navSide");
  if (nav) {
    nav.innerHTML = dest.map(([v, ic, label]) => `<button data-v="${v}" class="${S.vue === v ? "on" : ""}"><span class="ic">${ic}</span><span>${label}</span>${badge(v)}</button>`).join("");
    $$("button", nav).forEach((b) => b.onclick = () => aller(b.dataset.v));
    const n = niveauJoueur(), c = typeof COMPTE !== "undefined" && COMPTE.pseudo;
    $("#joueurBloc").innerHTML = `<span class="avatar grand">${c ? esc(COMPTE.pseudo[0].toUpperCase()) + avImg(COMPTE.pseudo) : "🌐"}</span>
      <span class="jb-infos"><b>${c ? esc(COMPTE.pseudo) : "Invité"}${premium() ? " 💎" : ""}</b><small>Niveau ${n.niveau} · ${fmt(S.coins)} 🪙</small>
      <span class="bar"><i style="width:${(n.xp / n.besoin) * 100}%"></i></span></span>`;
    $("#joueurBloc").onclick = () => aller("compte");
    $("#sideBas").innerHTML = `<button data-act="feedback">💡 Idée ou bug ?</button><button data-act="reglages">⚙︎ Réglages</button>${typeof PWA !== "undefined" && !PWA.installee ? `<button data-act="installer">📲 Installer l'app</button>` : ""}`;
    $$("#sideBas [data-act]").forEach((b) => b.onclick = () => actionMenu(b.dataset.act));
  }
  const t = $("#titreVue"); if (t) t.textContent = TITRES[S.vue] || "";
  $("#premiumBtn")?.classList.toggle("actif", premium());
}
function actionMenu(act) {
  fermerModal();
  if (act === "feedback" && typeof ouvrirModalFeedback === "function") ouvrirModalFeedback();
  else if (act === "reglages") $("#settingsBtn").click();
  else if (act === "installer" && typeof guideInstallation === "function") guideInstallation();
  else if (act) aller(act);
}
// Panneau « Plus » (mobile) : tout ce qui n'est pas dans les onglets du bas
function ouvrirMenuPlus() {
  const admin = typeof COMPTE !== "undefined" && COMPTE.admin;
  const n = niveauJoueur();
  const autres = [...DESTINATIONS.filter(([v]) => !ONGLETS_MOBILE.includes(v)), ...(admin ? [["admin", "👑", "Admin"]] : [])];
  ouvrirModal(`<div class="menu-plus">
    <div class="mp-joueur"><span class="avatar grand">${typeof COMPTE !== "undefined" && COMPTE.pseudo ? esc(COMPTE.pseudo[0].toUpperCase()) + avImg(COMPTE.pseudo) : "🌐"}</span>
      <div><b>${typeof COMPTE !== "undefined" && COMPTE.pseudo ? esc(COMPTE.pseudo) : "Invité"}${premium() ? " 💎" : ""}</b><br><small class="muted">Niveau ${n.niveau} · ${n.xp}/${n.besoin} XP · ${fmt(S.coins)} 🪙</small>
      <div class="bar"><i style="width:${(n.xp / n.besoin) * 100}%"></i></div></div></div>
    <div class="mp-grille">${autres.map(([v, ic, l]) => `<button data-mp="${v}" class="${S.vue === v ? "on" : ""}"><span>${ic}</span>${l}</button>`).join("")}
      <button data-mp-act="feedback"><span>💡</span>Idée ou bug</button><button data-mp-act="reglages"><span>⚙︎</span>Réglages</button>
      ${typeof PWA !== "undefined" && !PWA.installee ? `<button data-mp-act="installer"><span>📲</span>Installer</button>` : ""}</div>
    <p class="muted mp-pied">🟢 ${$("#nbEnLigne")?.textContent || "…"} joueurs en ligne · ${VERSION_JEU}</p></div>`);
  $("#modal").classList.add("feuille");
  $$("[data-mp]").forEach((b) => b.onclick = () => { fermerModal(); aller(b.dataset.mp); });
  $$("[data-mp-act]").forEach((b) => b.onclick = () => actionMenu(b.dataset.mpAct));
}
function aller(vue, opts) {
  if (typeof arreterCombat === "function") arreterCombat();
  if (vue === "tournoi" || vue === "tournois") {
    if (typeof hubEtat !== "undefined") hubEtat.onglet = "tournois";
    vue = "hub";
  }
  if (vue === "echanges" || vue === "echange") {
    if (typeof hubEtat !== "undefined") hubEtat.onglet = "echanges";
    vue = "hub";
  }
  S.vue = vue; renderNav(); vue = S.vue; sauver(); // renderNav remplace une vue inconnue par l'accueil
  // Zone neuve à chaque navigation : une page encore en chargement (async) ne peut plus écraser la nouvelle
  const ancienne = $("#view"), v = ancienne.cloneNode(false); ancienne.replaceWith(v);
  ({ accueil: vueAccueil, boosters: vueBoosters, album: vueAlbum, atlas: vueAtlas, badges: vueBadges, quiz: vueQuiz, combat: vueCombat,
    compte: vueCompte, hub: vueHub, admin: vueAdmin, legal: vueLegal, premium: vuePremium, pays: vuePays, collections: vueCollectionsPays, ...(typeof VUES_EXTRA === "object" ? VUES_EXTRA : {}) })[vue](v, opts);
  $("#hubBtn")?.classList.toggle("on", vue === "hub");
  $("#premiumBtn")?.classList.toggle("on", vue === "premium");
  $("#compteBtn")?.classList.toggle("on", vue === "compte" || vue === "admin");
  window.scrollTo({ top: 0 });
}

// Clic sur n'importe quelle carte : fiche détaillée
document.addEventListener("click", (e) => {
  const el = e.target.closest(".card[data-id]");
  if (!el || !el.isConnected || el.closest(".opening") || el.closest(".poke") || el.closest(".detail") || el.closest(".reveal") || el.closest("[data-noclick]") || el.closest(".arene") || el.closest(".vue3d")) return;
  if (BY_ID[el.dataset.id]) ficheCarte(BY_ID[el.dataset.id]);
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches?.(".card[data-id]")) e.target.click(); });

$("#hubBtn").onclick = () => aller("hub");
$("#compteBtn").onclick = () => aller("compte");
$("#premiumBtn").onclick = () => aller("premium");
$$("[data-pied]").forEach((a) => a.onclick = (e) => { e.preventDefault(); aller(a.dataset.pied); });
$$("[data-pied-legal]").forEach((a) => a.onclick = (e) => { e.preventDefault(); aller("legal", { page: a.dataset.piedLegal }); });
$("#installBtn").onclick = () => installer();

// Effet holographique : la carte s'incline et son reflet suit le doigt ou la souris
const GRANDES = ".detail, .pk-carte, .reveal";
document.addEventListener("pointermove", (e) => {
  const card = e.target.closest?.(".card");
  if (!card || card.classList.contains("locked") || card.closest(".vue3d") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const grande = card.closest(GRANDES);
  const brillante = card.matches(".shiny, [data-r=legendaire], [data-r=ultra-rare], [data-r=secrete]");
  if (!grande && (!brillante || e.pointerType !== "mouse")) return;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  card.style.setProperty("--mx", `${x * 100}%`); card.style.setProperty("--my", `${y * 100}%`);
  card.style.setProperty("--rx", `${(0.5 - y) * 18}deg`); card.style.setProperty("--ry", `${(x - 0.5) * 22}deg`);
  card.classList.add("tilt");
});
document.addEventListener("pointerout", (e) => {
  const card = e.target.closest?.(".card.tilt");
  if (card && !card.contains(e.relatedTarget)) card.classList.remove("tilt");
});

/* =====================================================================
   Fiche détaillée
   ===================================================================== */
function blocStats(c) {
  const n = S.owned[c.id] || 0;
  const st = statsDe(c), q = COMBAT.borne(S.qualite[c.id]);
  const tal = COMBAT.TALENTS[st.talent];
  const bat = COMBAT.AVANTAGE[c.type], battuPar = Object.keys(COMBAT.AVANTAGE).find((t) => COMBAT.AVANTAGE[t] === c.type);
  const prochain = st.niveau < COMBAT.NIVEAU_MAX ? 2 ** st.niveau : null;
  const pct = (x) => `<small class="${x > 0 ? "plus" : x < 0 ? "moins" : ""}">${x > 0 ? "+" : ""}${x} %</small>`;
  return `<div class="statbloc">
    <div><span>⚔️ Attaque</span><b>${st.atk}</b>${pct(q[0])}</div>
    <div><span>🛡️ Défense</span><b>${st.def}</b>${pct(q[1])}</div>
    <div><span>❤️ Vie</span><b>${st.pv}</b>${pct(q[2])}</div>
    <p class="talentbloc">${tal.emoji} <b>Talent : ${tal.nom}</b> — ${esc(tal.desc)}${bat ? `<br><small class="muted">Fort contre ${EMOJI_TYPE[bat]} ${TYPES[bat]} · faible contre ${EMOJI_TYPE[battuPar]} ${TYPES[battuPar]}</small>` : ""}</p>
    <p class="muted">Qualité de votre exemplaire : <b>${COMBAT.noteQualite(q)} %</b> · Niveau <b>${st.niveau}</b>${prochain ? ` (niveau ${st.niveau + 1} à ${prochain} exemplaires, vous en avez ${n})` : " (maximum)"}${S.shiny?.[c.id] ? " · ✨ Shiny : +5 %" : S.holo?.[c.id] ? " · 🌈 Holo" : ""} · Coût en deck : <b>${coutDe(c)}</b>.
    Chaque doublon peut améliorer la qualité.</p></div>`;
}
function ficheCarte(c) {
  const owned = has(c.id);
  if (S.nouveaux[c.id]) { delete S.nouveaux[c.id]; sauver(); }
  const rows = [];
  if (c.type === "pays") rows.push(["Capitale", c.capitale], ["Continent", CONTINENTS[c.continent].nom]);
  if (["animal", "plat", "culture"].includes(c.type)) rows.push([c.type === "animal" ? "Pays emblème" : "Origine", NOM_PAYS[c.pays]], ["Continent", CONTINENTS[c.continent].nom]);
  if (["ville", "monument", "merveille", "nature"].includes(c.type)) rows.push(["Pays", NOM_PAYS[c.pays]], ["Continent", CONTINENTS[c.continent].nom], ["Coordonnées", `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? "N" : "S"}, ${Math.abs(c.lon).toFixed(2)}° ${c.lon >= 0 ? "E" : "O"}`]);
  if (c.type === "merveille") rows.push(["Liste", c.groupe === "antiques" ? "Sept merveilles du monde antique" : "Sept nouvelles merveilles du monde (2007)"]);
  if (c.type === "secrete" && !owned) rows.push(["Pour la débloquer", libelleCondition(c.condition)]);
  const secretVerrou = c.type === "secrete" && !owned;
  const ids = secretVerrou ? idsCondition(c.condition) : [];
  const prix = RARETES[c.rarete].prix;
  const lieu = c.type === "pays" || c.lat !== undefined;
  const dansDeck = S.deck.includes(c.id);
  ouvrirModal(`<div class="detail">
      <div>${cardHTML(c)}</div>
      <div>
        <div class="row"><span class="rbadge" data-r="${c.rarete}">${RARETES[c.rarete].nom}</span><span class="muted">${TYPES[c.type]} n° ${c.num} / ${totalType(c)}</span></div>
        <h2>${secretVerrou ? "Carte secrète" : esc(c.nom)}</h2>
        <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        ${secretVerrou
          ? `<div class="anecdote"><b>Progression</b>${count(ids)} / ${ids.length}<div class="bar" style="margin-top:6px"><i style="width:${(count(ids) / ids.length) * 100}%"></i></div></div>`
          : owned ? `<div class="anecdote"><b>💡 Le saviez-vous ?</b>${esc(c.anecdote)}</div>`
          : `<div class="anecdote"><b>🔒 Anecdote cachée</b>Collectionnez cette carte pour découvrir son anecdote.</div>`}
        ${owned ? blocStats(c) : ""}
        <div class="row" style="flex-wrap:wrap;gap:8px">
          ${!owned && !secretVerrou && prix ? `<button class="btn primary" id="craft" ${S.coins < prix ? "disabled" : ""}>Obtenir pour ${fmt(prix)} 🪙</button>` : ""}
          ${owned ? `<button class="btn primary" id="voir3d">🧊 Voir en 3D</button>` : ""}
          ${!owned && c.type !== "secrete" && !c.saisonnier && POUSSIERE_FABRICATION[c.rarete] ? `<button class="btn" id="fabriquer" ${(S.poussiere || 0) < POUSSIERE_FABRICATION[c.rarete] ? "disabled" : ""}>🔨 Fabriquer · ${fmt(POUSSIERE_FABRICATION[c.rarete])} ✨ (vous : ${fmt(S.poussiere || 0)})</button>` : ""}
          ${owned && doublonsRecyclables(c) > 0 && POUSSIERE_RECYCLAGE[c.rarete] ? `<button class="btn" id="recycler">♻️ Recycler ${doublonsRecyclables(c)} doublon${doublonsRecyclables(c) > 1 ? "s" : ""} · +${fmt(doublonsRecyclables(c) * POUSSIERE_RECYCLAGE[c.rarete])} ✨</button>` : ""}
          ${(c.pays || c.code) ? `<button class="btn" id="voirPays">🏳️ Cartes de ${esc(NOM_PAYS[c.pays || c.code])}</button>` : ""}
          ${owned ? `<button class="btn" id="deckBtn">${dansDeck ? "Retirer du deck" : "⚔️ Ajouter au deck"}</button>` : ""}
          ${owned && (S.owned[c.id] || 0) >= 3 && !S.doree?.[c.id] ? `<button class="btn primary" id="evolveBtn" style="background:linear-gradient(135deg, #ffd700, #ff9800);color:#1a1409;font-weight:800">👑 Forger en Version Dorée ✨ (2 doublons)</button>` : ""}
          ${owned && S.doree?.[c.id] ? `<span class="rbadge" style="background:linear-gradient(135deg, #fff3b0, #ffd700);color:#1a1409;font-weight:800">👑 Version Dorée Débloquée (+15 % stats)</span>` : ""}
          ${owned && (S.owned[c.id] || 0) >= 2 ? `<button class="btn" id="echangeBtn">🤝 Échanger un doublon</button>` : ""}
          ${owned && lieu ? `<button class="btn" id="voirAtlas">🗺️ Voir sur l'atlas</button>` : ""}
        </div>
        ${!owned && !secretVerrou && prix && S.coins < prix ? `<p class="muted" style="font-size:13px">Il vous manque ${fmt(prix - S.coins)} 🪙. Gagnez-en au quiz et en combat !</p>` : ""}
        ${!secretVerrou && PHOTOS[c.id] && S.photos !== false ? `<p class="credit" id="credit"></p>` : ""}
        ${!secretVerrou && typeof connecte === "function" ? `<p class="muted" style="font-size:12.5px;margin:4px 0 0"><a href="#" id="signalerPhoto">📷 Photo incorrecte ?</a></p>` : ""}
      </div></div>`);
  if ($("#credit")) creditPhoto(c, $("#credit"));
  $("#craft")?.addEventListener("click", () => {
    if (S.coins < prix) return;
    S.coins -= prix; gagner(c.id); sauver(); majCoins();
    toast(`✨ <b>${esc(c.nom)}</b> rejoint votre collection !`);
    fermerModal(); verifierProgression(); aller(S.vue);
  });
  $("#voir3d")?.addEventListener("click", () => voir3D(c));
  $("#fabriquer")?.addEventListener("click", () => { if (fabriquer(c)) { majCoins(); toast(`🔨 <b>${esc(c.nom)}</b> fabriquée !`); fermerModal(); verifierProgression(); ficheCarte(c); } });
  $("#recycler")?.addEventListener("click", () => confirmer(`Recycler ${doublonsRecyclables(c)} doublon(s) de « ${c.nom} » ? Vous gardez 1 exemplaire, mais la carte peut perdre des niveaux.`, "Recycler", () => { const g = recycler(c); sauver(); fermerModal(); toast(`♻️ +${fmt(g)} ✨ poussière`); ficheCarte(c); }));
  $("#voirPays")?.addEventListener("click", () => { fermerModal(); aller("pays", { code: c.pays || c.code }); });
  $("#evolveBtn")?.addEventListener("click", () => {
    if ((S.owned[c.id] || 0) < 3) return toast("⚠ Il vous faut au moins 3 exemplaires pour forger la version dorée.");
    S.owned[c.id] -= 2;
    S.doree[c.id] = true;
    sauver();
    if (typeof son === "function") son("badge");
    toast(`👑 <b>${esc(c.nom)}</b> a évolué en Version Dorée ✨ (+15 % en combat) !`, 4000);
    fermerModal();
    ficheCarte(c);
  });
  $("#echangeBtn")?.addEventListener("click", () => {
    fermerModal();
    ouvrirModalCreerEchange(c.id);
  });
  $("#deckBtn")?.addEventListener("click", () => { basculerDeck(c.id); fermerModal(); if (S.vue === "combat") aller("combat"); });
  $("#voirAtlas")?.addEventListener("click", () => { fermerModal(); aller("atlas", { focus: c }); });
  $("#signalerPhoto")?.addEventListener("click", (e) => { e.preventDefault(); signalerPhoto(c); });
}
/* =====================================================================
   Carte en 3D : faites-la tourner du doigt, ou en inclinant le téléphone
   ===================================================================== */
function voir3D(c) {
  const shiny = !!S.shiny?.[c.id];
  const r = RARETES[c.rarete];
  ouvrirModal(`<div class="vue3d">
      <div class="vue3d-top"><b>🧊 ${esc(c.nom)}</b><span class="muted">Faites glisser pour tourner · double-tap pour retourner</span></div>
      <div class="scene3d" id="scene3d">
        <div class="carte3d" id="carte3d" data-r="${c.rarete}">
          <div class="face3d avant">${cardHTML(c)}</div>
          <div class="face3d arriere" data-r="${c.rarete}"><div class="dos3d"><span>${UNIVERS.monde.dos}</span><b>Play2F1</b><small>${r.gems} ${r.nom}${shiny ? " · ✨ Shiny" : ""}</small></div></div>
          <div class="reflet3d" id="reflet3d"></div>
        </div>
        <div class="ombre3d" id="ombre3d"></div>
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn small" id="r3dTourner">🔄 Retourner</button>
        <button class="btn small" id="r3dAuto">▶️ Rotation auto</button>
        <button class="btn small" id="r3dGyro">📱 Gyroscope</button>
        <button class="btn small" data-close>Fermer</button>
      </div></div>`);
  $("#modal").classList.add("plein", "sombre");
  const carte = $("#carte3d"), reflet = $("#reflet3d"), scene = $("#scene3d"), ombre = $("#ombre3d");
  let rx = -8, ry = 20, vx = 0, vy = 0, glisse = false, px = 0, py = 0, auto = true, gyro = false, dernierTap = 0, anim = 0, cible = null;
  carte.regler = (x, y) => { rx = x; ry = y; auto = false; cible = null; vx = vy = 0; };
  const appliquer = () => {
    carte.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    // On affiche la face tournée vers nous (plus fiable que backface-visibility sur tous les navigateurs)
    const dos = Math.cos(ry * Math.PI / 180) * Math.cos(rx * Math.PI / 180) < 0;
    carte.classList.toggle("dos", dos);
    const a = ((ry % 360) + 360) % 360;
    reflet.style.background = `linear-gradient(${105 + ry * 0.6}deg, transparent 30%, rgba(255,255,255,${0.12 + Math.abs(Math.sin(a * Math.PI / 180)) * 0.25}) 48%, transparent 62%)`;
    ombre.style.transform = `translateX(${Math.sin(ry * Math.PI / 180) * 18}px) scaleX(${0.55 + Math.abs(Math.cos(ry * Math.PI / 180)) * 0.45})`;
  };
  const boucle = () => {
    if (!$("#carte3d")) return;
    if (!glisse && !gyro) {
      if (cible !== null) { ry += (cible - ry) * 0.12; if (Math.abs(cible - ry) < 0.3) { ry = cible; cible = null; } }
      else if (auto) ry += 0.6;
      else { ry += vy; rx += vx; vy *= 0.94; vx *= 0.94; }
      rx += (-8 - rx) * (auto ? 0.04 : 0.01);
    }
    appliquer();
    anim = requestAnimationFrame(boucle);
  };
  scene.addEventListener("pointerdown", (e) => {
    const t = Date.now();
    if (t - dernierTap < 300) { cible = Math.round((ry + 180) / 180) * 180; auto = false; }
    dernierTap = t; glisse = true; auto = false; px = e.clientX; py = e.clientY; scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener("pointermove", (e) => {
    if (!glisse) return;
    vy = (e.clientX - px) * 0.5; vx = -(e.clientY - py) * 0.4;
    ry += vy; rx = Math.max(-60, Math.min(60, rx + vx)); px = e.clientX; py = e.clientY;
  });
  const fin = () => { glisse = false; };
  scene.addEventListener("pointerup", fin); scene.addEventListener("pointercancel", fin);
  $("#r3dTourner").onclick = () => { auto = false; cible = Math.round(ry / 180) * 180 + 180; };
  $("#r3dAuto").onclick = () => { auto = !auto; cible = null; };
  const orientation = (e) => { if (!gyro || e.gamma == null) return; ry = e.gamma * 1.4; rx = Math.max(-50, Math.min(50, -(e.beta - 45) * 0.9)); };
  $("#r3dGyro").onclick = async () => {
    if (gyro) { gyro = false; $("#r3dGyro").classList.remove("on"); return; }
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        if ((await DeviceOrientationEvent.requestPermission()) !== "granted") return toast("Gyroscope refusé.");
      }
      gyro = true; auto = false; $("#r3dGyro").classList.add("on");
      addEventListener("deviceorientation", orientation);
      toast("📱 Inclinez votre téléphone pour faire tourner la carte.");
    } catch { toast("Gyroscope indisponible sur cet appareil."); }
  };
  $("#modal")._onClose = () => { cancelAnimationFrame(anim); removeEventListener("deviceorientation", orientation); $("#modal").classList.remove("sombre"); };
  boucle();
}
function basculerDeck(id) {
  if (S.deck.includes(id)) { S.deck = S.deck.filter((x) => x !== id); sauver(); toast("Carte retirée du deck."); return; }
  const c = BY_ID[id];
  const cout = S.deck.reduce((s, x) => s + coutDe(BY_ID[x]), 0) + coutDe(c);
  if (S.deck.length >= COMBAT.TAILLE_DECK) return toast(`⚠ Votre deck est complet (${COMBAT.TAILLE_DECK} cartes). Retirez-en une d'abord.`);
  if (cout > COMBAT.BUDGET) return toast(`⚠ Budget dépassé : ${cout}/${COMBAT.BUDGET}. Les cartes rares coûtent plus cher.`, 4500);
  S.deck = [...S.deck, id]; sauver(); toast(`⚔️ <b>${esc(c.nom)}</b> rejoint votre deck.`);
}

/* =====================================================================
   Accueil
   ===================================================================== */
function vueAccueil(v) {
  const all = of("monde").filter((c) => c.type !== "secrete");
  const secrets = of("monde", "secrete");
  const badges = badgesDe();
  const groupes = Object.entries(CONTINENTS).map(([k, ct]) => [ct.emoji + " " + ct.nom, of("monde", "pays").filter((c) => c.continent === k)])
    .concat([["🏙️ Villes", of("monde", "ville")], ["🏛️ Monuments", of("monde", "monument")], ["🏔️ Nature", of("monde", "nature")], ["🐾 Animaux", of("monde", "animal")], ["🍜 Gastronomie", of("monde", "plat")], ["🎭 Culture", of("monde", "culture")], ["🌟 Merveilles", of("monde", "merveille")]])
    .filter(([, l]) => l.length);
  const recents = S.recents.map((id) => BY_ID[id]).filter(Boolean).slice(0, 12);
  const attente = gratuitDans(), n = niveauJoueur(), D = defisDuJour();
  const possedees = count(all.map((c) => c.id)), pct = Math.round((possedees / all.length) * 1000) / 10;
  const etoilesSolo = Object.values(S.solo || {}).reduce((a, b) => a + b, 0);
  const pseudo = typeof COMPTE !== "undefined" && COMPTE.pseudo;
  const tuile = (id, ic, titre, sous, classe = "") => `<button class="tuile ${classe}" id="${id}"><span class="t-ic">${ic}</span><span class="t-txt"><b>${titre}</b><small>${sous}</small></span></button>`;
  v.innerHTML = `
    ${S.messageMigration ? `<div class="panel annonce">🌍 <b>Play2F1 se concentre sur le monde !</b> Vos anciennes cartes Gaming et Objets ont été échangées contre <b>${fmt(S.messageMigration.pieces)} 🪙</b>. <button class="btn small" id="okMigration">OK</button></div>` : ""}
    ${EVENEMENT && EVENEMENTS_SAISONNIERS?.[EVENEMENT.cle] ? `<div class="panel bandeau-evenement" style="--ec:${EVENEMENTS_SAISONNIERS[EVENEMENT.cle].couleur}">
      <span class="big">${EVENEMENTS_SAISONNIERS[EVENEMENT.cle].emoji}</span><div><b>Événement ${esc(EVENEMENTS_SAISONNIERS[EVENEMENT.cle].nom)} !</b><br><span>${CARDS.filter((c) => c.saisonnier === EVENEMENT.cle).length} cartes exclusives jusqu'au ${new Date(EVENEMENT.fin).toLocaleDateString("fr-FR")}.</span></div>
      <button class="btn primary" data-aller-boutique>Voir le booster</button></div>` : ""}
    <section class="accueil-hero">
      <div class="ah-gauche">
        <div class="anneau" style="--p:${(n.xp / n.besoin) * 100}"><span><small>Niv.</small><b>${n.niveau}</b></span></div>
        <div><p class="ah-salut">${pseudo ? `Bonjour, <b>${esc(pseudo)}</b> 👋` : "Bienvenue, explorateur 👋"}</p>
          <h1>Collectionnez le monde</h1>
          <p class="ah-sous">${fmt(possedees)} / ${fmt(all.length)} cartes · ${pct} % du monde · ${n.xp}/${n.besoin} XP</p></div>
      </div>
      <div class="ah-chiffres">
        <div><b>${count(of("monde", "pays").map((c) => c.id))}</b><span>pays</span></div>
        <div><b>${S.combat.victoires}</b><span>victoires</span></div>
        <div><b>${CARDS.filter((c) => S.shiny?.[c.id]).length}</b><span>✨ Shiny</span></div>
        <div><b>${badges.filter((b) => S.badges[b.id]).length}</b><span>badges</span></div>
      </div>
    </section>
    <section class="tuiles">
      ${attente === 0 ? tuile("gratuit", "🎁", "Booster gratuit", "Disponible maintenant !", "chaude") : tuile("goBoutique2", "⏳", "Booster gratuit", `Dans ${duree(attente)}`)}
      ${bonusPremiumDispo() ? tuile("bonusPremium", "💎", "Bonus Premium", "+2 boosters aujourd'hui", "premium") : ""}
      ${tuile("goBooster", "🛍️", boostersEnStock() ? `Ouvrir mes boosters` : "Boutique", boostersEnStock() ? `${boostersEnStock()} en attente` : "Boosters Or, Méga, thématiques…", boostersEnStock() ? "chaude" : "")}
      ${tuile("goCombat", "🗺️", "Mode Solo", `⭐ ${etoilesSolo} étoiles · tour du monde`)}
      ${tuile("goArene", "⚔️", "Combat & Arène", "Contre l'ordinateur ou les joueurs")}
      ${tuile("goQuiz", "❓", "Quiz du jour", `${quizRestant()} question${quizRestant() > 1 ? "s" : ""} restante${quizRestant() > 1 ? "s" : ""}`)}
      ${tuile("goDefis", "📅", "Défis du jour", `${D.liste.filter((d) => d.prog >= d.n).length}/3 réussis`)}
      ${tuile("goHub", "👥", "Communauté", "Échanges, tournoi, classement")}
      ${premium() ? "" : tuile("voirPremium", "💎", "Premium", "Dès 3,99 € : +2 boosters/jour…", "premium")}
      ${typeof PWA !== "undefined" && !PWA.installee ? tuile("goInstall", "📲", "Installer l'app", "Sur votre écran d'accueil") : ""}
    </section>
    ${recents.length ? `<div class="sectiontitle"><h3>🆕 Dernières découvertes</h3><a href="#" id="voirAlbum" class="muted">Tout l'album →</a></div><div class="carrousel">${recents.map((c) => cardHTML(c, { compte: true })).join("")}</div>` : ""}
    <div class="accueil-grille">
      <div id="blocDefis">${blocDefis()}<div style="margin-top:16px">${blocQuetes()}</div></div>
      <div class="panel progress-list">
        <h3 style="margin-top:0">🌍 Progression</h3>
        ${groupes.map(([nom, list]) => { const k = count(list.map((c) => c.id)); return `<div class="p"><span>${nom}</span><div class="bar"><i style="width:${(k / list.length) * 100}%"></i></div><span>${k}/${list.length}</span></div>`; }).join("")}
      </div>
    </div>
    <div class="sectiontitle"><h3>✦ Cartes secrètes</h3><span class="muted">Terminez une collection entière pour les débloquer</span></div>
    <div class="carrousel">${secrets.map((c) => cardHTML(c)).join("")}</div>`;
  $$("[data-defi-recu]", v).forEach((b) => b.onclick = () => recupererDefi(Number(b.dataset.defiRecu)));
  $$("[data-quete]", v).forEach((b) => b.onclick = () => recupererQuete(Number(b.dataset.quete)));
  $("[data-aller-boutique]", v)?.addEventListener("click", () => aller("boosters"));
  $("#okMigration")?.addEventListener("click", () => { delete S.messageMigration; aller("accueil"); });
  $("#gratuit")?.addEventListener("click", recupererGratuit);
  $("#bonusPremium")?.addEventListener("click", recupererBonusPremium);
  $("#goBoutique2")?.addEventListener("click", () => aller("boosters"));
  $("#goBooster").onclick = () => aller("boosters");
  $("#goCombat").onclick = () => aller("combat");
  $("#goArene").onclick = () => aller("combat");
  $("#goQuiz").onclick = () => aller("quiz");
  $("#goDefis").onclick = () => $("#blocDefis").scrollIntoView({ behavior: "smooth", block: "center" });
  $("#goHub").onclick = () => aller("hub");
  $("#voirAlbum")?.addEventListener("click", (e) => { e.preventDefault(); aller("album"); });
  $("#goInstall")?.addEventListener("click", () => guideInstallation());
  $("#voirPremium")?.addEventListener("click", () => aller("premium"));
}
function recupererGratuit() {
  if (gratuitDans() > 0) return;
  S.gratuitLe = Date.now(); S.boosters.monde++; S.coins += 20; sauver(); majCoins();
  if (typeof programmerRappel === "function") programmerRappel(S.gratuitLe + GRATUIT_MS);
  toast("🎁 Booster gratuit récupéré, +20 🪙 ! Le prochain dans 12 heures.");
  aller(S.vue);
}
function recupererBonusPremium() {
  if (!bonusPremiumDispo()) return;
  S.premiumJour = today(); S.boosters.monde += 2; sauver();
  toast("💎 Bonus Premium du jour : +2 boosters Classiques !");
  aller(S.vue);
}
// Le compte à rebours se met à jour tout seul quand le booster gratuit devient disponible
setInterval(() => { if (gratuitDans() === 0 && ["accueil", "boosters"].includes(S.vue) && !$("#gratuit") && $("#modal").classList.contains("hidden")) aller(S.vue); else renderNav(); }, 60000);

/* =====================================================================
   Boutique et boosters
   ===================================================================== */
function vueBoosters(v) {
  const attente = gratuitDans();
  const stock = Object.entries(PACKS).filter(([k]) => S.boosters[k] > 0);
  const nbStock = stock.reduce((t, [k]) => t + S.boosters[k], 0);
  const offre = offreDuJour(), offreDispo = S.offreJour !== today();
  const carteOffre = (k, p) => {
    const bloque = p.premium && !premium();
    return `<div class="offre ${k}">
      <div class="pack ${k} mini" ${p.couleur ? `style="--pc:${p.couleur}"` : ""}><span class="big">${p.emoji}</span><b>${p.nom}</b></div>
      <div><b>Booster ${p.nom}</b>${p.premium ? ` <span class="rbadge premium">💎 Premium</span>` : ""}${p.cartes > 5 ? ` <span class="rbadge" data-r="rare">${p.cartes} cartes</span>` : ""}<p class="muted">${p.desc}</p>
      ${bloque ? `<button class="btn" data-acheter="${k}">💎 Devenir Premium</button>` : `<div class="achat-lot">
        <button class="btn primary" data-acheter="${k}" data-n="1" ${S.coins < p.prix ? "disabled" : ""}>Acheter · ${fmt(p.prix)} 🪙</button>
        <button class="btn" data-acheter="${k}" data-n="5" ${S.coins < p.prix * 5 ? "disabled" : ""}>×5 · ${fmt(p.prix * 5)} 🪙</button>
        <button class="btn" data-acheter="${k}" data-n="10" ${S.coins < p.prix * 10 ? "disabled" : ""}>×10 · ${fmt(p.prix * 10)} 🪙 <small>+1 offert</small></button></div>`}</div></div>`;
  };
  v.innerHTML = `
    <div class="panel" style="text-align:center">
      <h2 style="margin-top:0">🎁 Mes boosters ${nbStock ? `(${nbStock})` : ""}</h2>
      ${stock.length ? `<div class="packs">${stock.map(([k, p]) => `<button class="pack ${k}" data-ouvrir="${k}" ${p.couleur ? `style="--pc:${p.couleur}"` : ""}>
          <span class="count">×${S.boosters[k]}</span><span class="big">${p.emoji}</span><b>${p.nom}</b><small>Touchez pour ouvrir</small></button>`).join("")}</div>
          ${nbStock > 1 ? `<button class="btn primary" id="toutOuvrir" style="margin-top:12px">⚡ Tout ouvrir d'un coup (${nbStock})</button>` : ""}`
        : `<p class="muted">Aucun booster pour l'instant. Récupérez le booster gratuit ou achetez-en un ci-dessous.</p>`}
      <div class="row" style="justify-content:center;margin-top:10px">
        ${attente === 0 ? `<button class="btn primary" id="gratuit">🎁 Récupérer le booster gratuit</button>` : `<span class="muted">⏳ Prochain booster gratuit dans <b>${duree(attente)}</b></span>`}
        ${bonusPremiumDispo() ? `<button class="btn primary premium" id="bonusPremium">💎 +2 boosters Premium</button>` : ""}
        ${prestigeSemaineDispo() ? `<button class="btn primary premium" id="prestigeOffert">💎 Prestige offert de la semaine</button>` : ""}
      </div>
    </div>
    <div class="panel offre-jour" style="margin-top:16px">
      <div class="pack ${offre} mini" ${PACKS[offre].couleur ? `style="--pc:${PACKS[offre].couleur}"` : ""}><span class="big">${PACKS[offre].emoji}</span><b>${PACKS[offre].nom}</b></div>
      <div><span class="rbadge" data-r="ultra-rare">🔥 OFFRE DU JOUR -40 %</span><h3 style="margin:6px 0">Booster ${PACKS[offre].nom}</h3>
      <p class="muted" style="margin:0 0 8px">${PACKS[offre].desc}</p>
      ${offreDispo ? `<button class="btn primary" id="acheterOffre" ${S.coins < prixOffre(offre) ? "disabled" : ""}><s>${fmt(PACKS[offre].prix)}</s> ${fmt(prixOffre(offre))} 🪙</button>` : `<span class="muted">✓ Déjà profité aujourd'hui. Nouvelle offre demain !</span>`}</div>
    </div>
    <div class="panel pity-box" style="margin-top:16px">
      <div class="pity-head">
        <span>🍀 Jauge de Chance & Pity System : <b>${Math.min(100, S.pity || 0)} %</b></span>
        <span class="muted">${(S.pity || 0) >= 90 ? "✨ Prochain booster : Ultra rare ou Légendaire GARANTIE !" : `Encore ${Math.ceil((100 - (S.pity || 0)) / 10)} booster(s) avant le gros lot garanti`}</span>
      </div>
      <div class="pity-track">
        <div class="pity-fill" style="width:${Math.min(100, S.pity || 0)}%"></div>
      </div>
      <p class="muted" style="margin:4px 0 0;font-size:12.5px">La jauge monte de 10 % à chaque booster ouvert. Au 10e booster sans Ultra rare ni Légendaire, une carte Ultra rare ou Légendaire est garantie ! Elle repart à zéro quand vous en obtenez une.</p>
    </div>
    ${EVENEMENT && PACKS[EVENEMENT.cle] ? `<div class="sectiontitle"><h3>${PACKS[EVENEMENT.cle].emoji} Événement : ${esc(EVENEMENTS_SAISONNIERS[EVENEMENT.cle].nom)}</h3><span class="muted">Jusqu'au ${new Date(EVENEMENT.fin).toLocaleDateString("fr-FR")} · cartes exclusives</span></div>
      <div class="boutique evenement">${carteOffre(EVENEMENT.cle, PACKS[EVENEMENT.cle])}</div>` : ""}
    <div class="panel poussiere-bloc"><div><b>✨ Poussière d'étoiles : ${fmt(S.poussiere || 0)}</b><br><span class="muted">Recyclez vos doublons en poussière, puis fabriquez la carte de votre choix depuis sa fiche (ou depuis la page d'un pays).</span></div>
      <button class="btn" id="toutRecycler">♻️ Recycler tous les doublons</button></div>
    <div class="sectiontitle"><h3>🛍️ Boutique</h3><span class="muted">Plus le booster est cher, plus les cartes sont rares</span></div>
    <div class="boutique">${PACKS_PRINCIPAUX.map((k) => carteOffre(k, PACKS[k])).join("")}</div>
    <div class="sectiontitle"><h3>🎯 Boosters thématiques</h3><span class="muted">Ciblez la catégorie ou le continent qui vous manque</span></div>
    <div class="boutique themes">${Object.entries(PACKS).filter(([, p]) => p.theme).map(([k, p]) => carteOffre(k, p)).join("")}</div>
    ${S.coins < PACKS.monde.prix ? `<p class="muted">Pas assez de pièces ? <a href="#" id="toQuiz">Jouez au quiz</a>, <a href="#" id="toCombat">combattez</a> ou réussissez les défis du jour.</p>` : ""}
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Chances par carte (booster Classique)</h3>
      <div class="row">${chancesPack("monde").map(([r, pc]) => `<span class="rbadge" data-r="${r}">${RARETES[r].nom} · ${pc} %</span>`).join(" ")}</div>
      <p class="muted" style="margin-bottom:0;font-size:13.5px">Système de tirage : Les cartes non découvertes sortent avec un bonus de découverte, et les doublons permettent de monter de niveau ou de forger la prestigieuse <b>Version Dorée 👑 (+15 % de puissance)</b>. Environ 1 carte sur 10 sort en 🌈 Holo et 1 sur 45 en ✨ Shiny (doublé en Premium).</p>
    </div>`;
  $$("[data-ouvrir]", v).forEach((b) => b.onclick = () => ouvrirBooster(b.dataset.ouvrir));
  $$("[data-acheter]", v).forEach((b) => b.onclick = () => {
    const k = b.dataset.acheter, p = PACKS[k], n = Math.max(1, Number(b.dataset.n) || 1);
    if (p.premium && !premium()) return aller("premium");
    if (S.coins < p.prix * n) return;
    // Par lot de 10, un booster est offert ; les boosters achetés en lot vont dans « Mes boosters »
    const recus = n + (n >= 10 ? 1 : 0);
    S.coins -= p.prix * n; S.boosters[k] = (S.boosters[k] || 0) + recus; sauver(); majCoins();
    // Le booster acheté rejoint « Mes boosters » : on l'ouvre quand on veut
    toast(`🎁 ${recus > 1 ? `${recus} boosters` : "Booster"} ${esc(p.nom)} ajouté${recus > 1 ? "s" : ""} à vos boosters ! Ouvrez-le${recus > 1 ? "s" : ""} quand vous voulez.`); aller("boosters"); scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#acheterOffre")?.addEventListener("click", () => {
    if (S.coins < prixOffre(offre) || S.offreJour === today()) return;
    S.coins -= prixOffre(offre); S.offreJour = today(); S.boosters[offre] = (S.boosters[offre] || 0) + 1; sauver(); majCoins();
    toast(`🎁 Booster ${esc(PACKS[offre].nom)} ajouté à vos boosters !`); aller("boosters"); scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#toutOuvrir")?.addEventListener("click", toutOuvrir);
  $("#toutRecycler")?.addEventListener("click", toutRecycler);
  $("#gratuit")?.addEventListener("click", recupererGratuit);
  $("#bonusPremium")?.addEventListener("click", recupererBonusPremium);
  $("#prestigeOffert")?.addEventListener("click", () => { S.prestigeSemaine = semaine(); S.boosters.prestige++; sauver(); toast("💎 Booster Prestige offert !"); aller("boosters"); });
  $("#toQuiz")?.addEventListener("click", (e) => { e.preventDefault(); aller("quiz"); });
  $("#toCombat")?.addEventListener("click", (e) => { e.preventDefault(); aller("combat"); });
}
// Ouvre tous les boosters en stock d'un coup, avec un résumé
function toutOuvrir() {
  const tout = [];
  let pieces = 0, n = 0;
  for (const k of Object.keys(PACKS)) while (S.boosters[k] > 0 && n < 200) { const r = deballer(k); tout.push(...r); pieces += r.reduce((t, x) => t + x.bonus, 0); n++; }
  sauver(); majCoins();
  const neuves = tout.filter((x) => x.neuf), brillantes = tout.filter((x) => x.shiny || x.nouveauHolo);
  const vus = new Set(), aMontrer = [...brillantes, ...neuves.sort((a, b) => RARETES[b.c.rarete].ordre - RARETES[a.c.rarete].ordre)].filter((x) => !vus.has(x.c.id) && vus.add(x.c.id));
  ouvrirModal(`<div class="poke"><div class="poke-top"><span>⚡ ${n} boosters ouverts</span></div>
    <p class="poke-indice">${neuves.length} nouvelle${neuves.length > 1 ? "s" : ""} carte${neuves.length > 1 ? "s" : ""} · ${tout.filter((x) => x.shiny).length} ✨ Shiny · ${tout.filter((x) => x.nouveauHolo).length} 🌈 Holo · +${fmt(pieces)} 🪙 de doublons</p>
    <div class="opening tout">${aMontrer.slice(0, 120).map((x) => `<div>${x.shiny ? `<span class="tagnew shinytag">✨</span>` : x.nouveauHolo ? `<span class="tagnew holotag">🌈</span>` : x.neuf ? `<span class="tagnew">NEW</span>` : ""}${cardHTML(x.c, { locked: false, shiny: x.shiny, holo: x.holo })}</div>`).join("")}</div>
    ${aMontrer.length > 120 ? `<p class="poke-indice">… et ${aMontrer.length - 120} autres : retrouvez-les dans l'album.</p>` : ""}
    <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-close>Super !</button></div></div>`, () => { verifierProgression(); aller(S.vue); });
  $("#modal").classList.add("plein");
}
// Probabilités réelles d'un booster (en %), à partir des poids utilisés par le tirage
function chancesPack(type) {
  const p = PACKS[type], rs = Object.keys(RARETES).filter((r) => r !== "secrete");
  const w = rs.map((r) => [r, (p?.poids ? p.poids[r] : RARETES[r].poids) || 0]), tot = w.reduce((t, [, x]) => t + x, 0) || 1;
  return w.map(([r, x]) => [r, Math.round((x / tot) * 1000) / 10]);
}
function tirerBooster(type) {
  const p = PACKS[type];
  const pool = of("monde").filter((c) => c.type !== "secrete" && !c.saisonnier && (!p.filtre || p.filtre(c)));
  const poolEvenement = p.evenement ? CARDS.filter((c) => c.saisonnier === p.evenement) : [];
  const poids = (r) => (p.poids ? p.poids[r] : RARETES[r].poids) || 0;
  const rars = Object.keys(RARETES).filter((r) => pool.some((c) => c.rarete === r) && poids(r) > 0);
  const out = [];

  // Jauge de chance : +10 % par booster ; seule une Ultra rare ou une Légendaire la remet à zéro
  S.pity = Math.min(100, (S.pity || 0) + PITY_PAS);
  const pityDeclenchee = S.pity >= 100;
  let grosLot = false;

  for (let i = 0; i < p.cartes; i++) {
    // Les dernières cartes du booster ont une rareté minimale garantie
    let g = p.garanties[i - (p.cartes - p.garanties.length)];
    if (pityDeclenchee && i === p.cartes - 1 && !grosLot) g = Math.max(g || 0, 4); // jauge pleine : Ultra rare ou Légendaire garantie
    let opts = g !== undefined ? rars.filter((r) => RARETES[r].ordre >= g) : rars;
    if (!opts.length) opts = Object.keys(RARETES).filter((r) => RARETES[r].ordre >= (g || 0) && r !== "secrete" && pool.some((c) => c.rarete === r));
    const r = weighted(opts, (x) => poids(x) || RARETES[x].poids || 1);
    if (RARETES[r].ordre >= 4) grosLot = true;
    let cands = pool.filter((c) => c.rarete === r && !out.includes(c));
    if (!cands.length) cands = pool.filter((c) => !out.includes(c));
    // Les doublons tombent naturellement pour permettre la fusion / évolution dorée et les échanges
    out.push(weighted(cands, (c) => (has(c.id) ? 1 : BONUS_NOUVELLE)));
  }
  if (grosLot) S.pity = 0; // une Ultra rare ou une Légendaire vide la jauge
  // Booster d'événement : les deux premières cartes sont des cartes exclusives de l'événement
  for (let i = 0; i < Math.min(2, poolEvenement.length); i++) {
    const libres = poolEvenement.filter((c) => !out.includes(c));
    out[i] = weighted(libres, (c) => (RARETES[c.rarete].poids || 1) * (has(c.id) ? 1 : 3));
  }
  return out;
}
// Retire un booster du stock et ajoute ses cartes à la collection
function deballer(type) {
  const p = PACKS[type];
  S.boosters[type]--; S.ouverts++;
  const chance = CHANCE_SHINY * p.shiny * (premium() ? 2 : 1);
  const cartes = tirerBooster(type);
  const res = cartes.map((c) => {
    const shiny = Math.random() < chance;
    const holo = !shiny && Math.random() < CHANCE_HOLO;
    const g = gagner(c.id);
    let nouveauHolo = false;
    if (holo && !S.holo[c.id]) { S.holo[c.id] = 1; nouveauHolo = true; }
    let bonus = g.neuf ? 0 : RARETES[c.rarete].doublon, nouveauShiny = false;
    if (shiny) {
      if (!S.shiny[c.id]) { S.shiny[c.id] = 1; nouveauShiny = true; }
      else { S.shiny[c.id]++; bonus += RARETES[c.rarete].doublon * 3; }
    }
    S.coins += bonus;
    return { c, ...g, bonus, shiny, nouveauShiny, holo, nouveauHolo };
  });
  const neuves = res.filter((x) => x.neuf).length;
  progresDefi("boosters"); if (neuves) progresDefi("nouvelles", neuves);
  gagnerXP(8 + neuves * 2);
  return res;
}
function ouvrirBooster(type) {
  if (!S.boosters[type]) return;
  const p = PACKS[type];
  const res = deballer(type);
  sauver(); majCoins();
  if (typeof son === "function") son("booster");
  // Comme dans les jeux de cartes : la plus rare est révélée en dernier, et une Shiny après tout le reste
  const poidsOrdre = (x) => (x.shiny ? 10 : 0) + RARETES[x.c.rarete].ordre;
  const ordre = res.slice().sort((a, b) => poidsOrdre(a) - poidsOrdre(b));
  const etiquette = ({ neuf, bonus, shiny, nouveauShiny, holo, nouveauHolo, ameliore, niveauPlus }, court) => shiny
    ? `<span class="tagnew shinytag">✨ SHINY${nouveauShiny ? " NOUVELLE" : bonus ? ` · +${bonus} 🪙` : ""}</span>`
    : nouveauHolo ? `<span class="tagnew holotag">🌈 HOLO${neuf ? " NOUVELLE" : ""}</span>`
    : neuf ? `<span class="tagnew">NOUVELLE</span>`
    : `<span class="tagdup">${niveauPlus ? "⬆ Niveau ! " : ameliore ? "📈 Stats ! " : court ? "" : "Doublon · "}+${bonus} 🪙</span>`;
  ouvrirModal(`<div class="poke">
      <div class="poke-top"><span id="pkCompte">${p.emoji} Booster ${p.nom}</span><button class="btn small" id="pkPasser">Tout voir ⏭</button></div>
      <div class="poke-compteur" id="pkPoints"></div>
      <div class="poke-scene" id="pkScene" role="button" tabindex="0"></div>
      <p class="poke-indice" id="pkIndice"></p>
    </div>`, () => { verifierProgression(); aller(S.vue); });
  $("#modal").classList.add("plein");
  let etape = "paquet", i = 0, occupe = false, rapide = false, finAttente = null;
  const scene = $("#pkScene");
  // La fenêtre peut être fermée à tout moment : on n'écrit plus rien dans une scène qui n'existe plus
  const vivant = () => scene.isConnected && etape !== "resume";
  const texte = (sel, t) => { const el = $(sel); if (el) el.textContent = t; };
  const indice = (t) => texte("#pkIndice", t);
  // Toucher pendant une animation l'accélère au lieu d'être ignoré
  const attendre = (ms) => new Promise((r) => { const t = setTimeout(r, rapide ? 0 : ms); finAttente = () => { clearTimeout(t); r(); }; });
  const accelerer = () => { rapide = true; finAttente?.(); };

  scene.innerHTML = `<div class="pack ${type} grand" id="pkPaquet" ${p.couleur ? `style="--pc:${p.couleur}"` : ""}><span class="rabat"></span><span class="entaille"></span><span class="big">${p.emoji}</span><b>Booster ${p.nom}</b><small>${p.cartes} cartes</small></div>`;
  indice("Glissez le doigt sur le haut du booster pour le déchirer, ou touchez-le");
  // Déchirer le booster en glissant le doigt
  let ignorerClic = false;
  (() => {
    const paquet = $("#pkPaquet");
    let x0 = null;
    paquet.addEventListener("pointerdown", (e) => { x0 = e.clientX; paquet.setPointerCapture(e.pointerId); });
    paquet.addEventListener("pointermove", (e) => {
      if (x0 === null || etape !== "paquet") return;
      const prog = Math.min(1, Math.abs(e.clientX - x0) / (paquet.offsetWidth * 0.8));
      paquet.style.setProperty("--dechirure", `${prog * 100}%`); paquet.style.setProperty("--dechirure-n", prog);
      if (prog > 0.6) { x0 = null; ignorerClic = true; navigator.vibrate?.(25); toucher(); setTimeout(() => { ignorerClic = false; }, 400); }
    });
    const fin = () => { if (etape === "paquet") { paquet.style.setProperty("--dechirure", "0%"); paquet.style.setProperty("--dechirure-n", 0); } x0 = null; };
    paquet.addEventListener("pointerup", fin); paquet.addEventListener("pointercancel", fin);
  })();
  const couleurRarete = { "commun": "#d6dbe0", "peu-commun": "#6ee0a6", "rare": "#8fb8ff", "epique": "#d1a2ff", "ultra-rare": "#ff8a7a", "legendaire": "#ffd34d" };
  function etincelles(n, couleur) {
    for (let k = 0; k < n; k++) {
      const el = document.createElement("i"), a = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 110;
      el.className = "etincelle";
      el.style.cssText = `--x:${Math.cos(a) * dist}px;--y:${Math.sin(a) * dist}px;--d:${0.6 + Math.random() * 0.7}s;--ec:${couleur === "shiny" ? `hsl(${Math.random() * 360} 95% 70%)` : couleur}`;
      scene.appendChild(el); setTimeout(() => el.remove(), 1400);
    }
  }
  const points = () => { $("#pkPoints").innerHTML = ordre.map((_, k) => `<i class="${k < i ? "vu" : k === i && etape !== "paquet" ? "courant" : ""}"></i>`).join(""); };

  function montrer() {
    if (!scene.isConnected) return;
    const x = ordre[i], c = x.c;
    const rare = RARETES[c.rarete].ordre >= 2 || x.shiny;
    etape = "carte";
    texte("#pkCompte", `Carte ${i + 1} / ${ordre.length}`);
    delete scene.dataset.ambiance; points();
    scene.innerHTML = `<div class="pk-carte">
        <div class="flip grand">
          <div class="face back ${rare ? "glow-" + (x.shiny ? "shiny" : c.rarete) : ""} ${typeof dosChoisi === "function" ? dosChoisi().cls : ""}" style="${typeof dosChoisi === "function" ? dosChoisi().style : ""}">${typeof dosChoisi === "function" ? dosChoisi().ic : UNIVERS.monde.dos}</div>
          <div class="face front">${etiquette(x)}${cardHTML(c, { locked: false, shiny: x.shiny, holo: x.holo })}</div>
        </div></div>
      <div class="pk-rarete"></div>`;
    indice(rare ? "Ça brille… Touchez pour retourner !" : "Touchez pour retourner la carte");
  }
  async function retourner() {
    const x = ordre[i], c = x.c;
    const r = x.shiny ? 6 : RARETES[c.rarete].ordre;
    const flip = scene.querySelector(".flip");
    if (!flip) return;
    if (r >= 2) { flip.classList.add("suspense"); await attendre(r >= 4 ? 1100 : 700); flip.classList.remove("suspense"); }
    if (!vivant()) return;
    flip.classList.add("done");
    await attendre(450);
    if (!vivant()) return;
    const lab = scene.querySelector(".pk-rarete");
    lab.dataset.r = x.shiny ? "shiny" : c.rarete;
    lab.textContent = x.shiny ? `✨ SHINY ! ✨` : x.nouveauHolo && r < 4 ? `🌈 ${RARETES[c.rarete].nom} Holo !` : r >= 4 ? `${RARETES[c.rarete].gems} ${RARETES[c.rarete].nom} ! ${RARETES[c.rarete].gems}` : RARETES[c.rarete].nom;
    if (r >= 2) {
      scene.querySelector(".pk-carte").classList.add("eclat");
      scene.dataset.ambiance = x.shiny ? "shiny" : c.rarete;
      etincelles(8 + r * 7, x.shiny ? "shiny" : couleurRarete[c.rarete]);
      navigator.vibrate?.(r >= 4 ? [30, 50, 80] : 20);
      if (typeof son === "function") son(r >= 4 ? "niveau" : "badge");
    }
    etape = "retournee";
    indice(i < ordre.length - 1 ? "Touchez pour la carte suivante" : "Touchez pour voir votre booster");
  }
  // Ouverture façon Hearthstone : toutes les cartes posées face cachée, on les retourne dans l'ordre qu'on veut.
  // L'aura du dos annonce la rareté avant de retourner la carte.
  const retournees = new Set();
  function table() {
    if (!scene.isConnected) return;
    etape = "table"; delete scene.dataset.ambiance; $("#pkPoints").innerHTML = "";
    texte("#pkCompte", `${p.emoji} Booster ${p.nom}`);
    // Les cartes sont placées au hasard sur la table (la plus rare n'est pas toujours au même endroit)
    const places = ordre.map((_, k) => k).sort(() => Math.random() - 0.5);
    scene.innerHTML = `<div class="hs-table n${ordre.length}">${places.map((k, pos) => { const x = ordre[k], rare = RARETES[x.c.rarete].ordre >= 2 || x.shiny;
      return `<button type="button" class="hs-carte" style="--pos:${pos};--n:${ordre.length}" data-i="${k}" aria-label="Retourner la carte ${pos + 1}"><div class="flip">
        <div class="face back ${rare ? "glow-" + (x.shiny ? "shiny" : x.c.rarete) : ""} ${typeof dosChoisi === "function" ? dosChoisi().cls : ""}" style="${typeof dosChoisi === "function" ? dosChoisi().style : ""}">${typeof dosChoisi === "function" ? dosChoisi().ic : UNIVERS.monde.dos}</div>
        <div class="face front">${etiquette(x, true)}${cardHTML(x.c, { locked: false, shiny: x.shiny, holo: x.holo })}</div></div></button>`; }).join("")}</div>
      <div class="pk-rarete"></div>`;
    indice("Touchez les cartes pour les retourner");
    $$(".hs-carte", scene).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); retournerTable(Number(b.dataset.i)); }));
  }
  async function retournerTable(k) {
    const b = scene.querySelector(`.hs-carte[data-i="${k}"]`);
    if (!b) return;
    if (retournees.has(k)) { zoomTable(k); return; }
    retournees.add(k);
    const x = ordre[k], c = x.c, r = x.shiny ? 6 : RARETES[c.rarete].ordre, flip = $(".flip", b);
    if (r >= 3 && !rapide) { flip.classList.add("suspense"); await attendre(r >= 4 ? 700 : 450); flip.classList.remove("suspense"); }
    if (!scene.isConnected) return;
    flip.classList.add("done"); b.classList.add("vue", "r-" + (x.shiny ? "shiny" : c.rarete));
    const lab = scene.querySelector(".pk-rarete");
    if (lab) { lab.dataset.r = x.shiny ? "shiny" : c.rarete; lab.textContent = x.shiny ? "✨ Shiny !" : x.nouveauHolo && r < 4 ? `🌈 ${RARETES[c.rarete].nom} Holo` : RARETES[c.rarete].nom; }
    if (r >= 2) {
      const sr = scene.getBoundingClientRect(), br = b.getBoundingClientRect();
      const avant = scene.children.length;
      etincelles(6 + r * 5, x.shiny ? "shiny" : couleurRarete[c.rarete]);
      [...scene.children].slice(avant).forEach((el) => { el.style.left = `${br.left - sr.left + br.width / 2}px`; el.style.top = `${br.top - sr.top + br.height / 2}px`; });
      navigator.vibrate?.(r >= 4 ? [30, 50, 80] : 20);
      if (typeof son === "function") son(r >= 4 ? "niveau" : "badge");
    }
    if (retournees.size === ordre.length) {
      // Le bouton va dans la barre du bas de la fenêtre : toujours visible, même sur un petit écran
      setTimeout(() => {
        const ind = $("#pkIndice");
        if (!scene.isConnected || etape !== "table" || !ind) return;
        ind.innerHTML = `<button class="btn primary" id="hsSuite">Voir le résumé →</button><small>Touchez une carte pour la voir en grand</small>`;
        $("#hsSuite").addEventListener("click", (e) => { e.stopPropagation(); resume(); });
      }, 450);
    }
  }
  // Une carte retournée s'affiche en grand par-dessus la table ; on touche pour revenir
  function zoomTable(k) {
    const x = ordre[k];
    $(".hs-zoom", scene)?.remove();
    const z = document.createElement("div");
    z.className = "hs-zoom";
    z.innerHTML = `<div class="hs-zoom-carte">${etiquette(x, true)}${cardHTML(x.c, { locked: false, shiny: x.shiny, holo: x.holo })}</div><small>Touchez pour revenir</small>`;
    z.addEventListener("click", (e) => { e.stopPropagation(); z.remove(); });
    scene.appendChild(z);
  }
  async function suivante() {
    scene.querySelector(".pk-carte")?.classList.add("sort");
    await attendre(260);
    if (!vivant()) return;
    i++;
    if (i < ordre.length) montrer(); else resume();
  }
  function resume() {
    if (!scene.isConnected) return;
    etape = "resume"; finAttente?.(); delete scene.dataset.ambiance; $("#pkPoints").innerHTML = "";
    document.dispatchEvent(new CustomEvent("booster-revele"));
    $("#pkPasser").classList.add("hidden");
    texte("#pkCompte", `${p.emoji} Votre booster ${p.nom}`);
    const neuves = res.filter((x) => x.neuf).length, pieces = res.reduce((t, x) => t + x.bonus, 0);
    indice(`${neuves} nouvelle${neuves > 1 ? "s" : ""} carte${neuves > 1 ? "s" : ""}${pieces ? ` · +${pieces} 🪙 de doublons` : ""} · 🍀 Chance : ${S.pity || 0} %${(S.pity || 0) >= 90 ? " (gros lot au prochain !)" : ""}`);
    const encore = Object.keys(PACKS).find((k) => S.boosters[k] > 0);
    // La meilleure carte du booster est mise en avant, et le résumé se lit de la moins rare à la plus rare
    const top = ordre[ordre.length - 1], st = statsDe(top.c);
    scene.innerHTML = `<div class="meilleure-carte r-${top.c.rarete}"><span>🏆 Meilleure carte</span><b>${esc(top.c.nom)}</b>
        <small>${RARETES[top.c.rarete].nom}${top.shiny ? " · ✨ Shiny" : ""} · ${esc(TYPES[top.c.type] || "")} n° ${String(top.c.num || 0).padStart(3, "0")} · ⚔️ ${st.atk} · 🛡️ ${st.def} · ❤️ ${st.pv}</small></div>
      <div class="opening">${ordre.map((x, k) => `<div class="flip done${x === top ? " la-meilleure" : ""}" style="--k:${k}" data-voir="${x.c.id}"><div class="face back"></div>
        <div class="face front">${etiquette(x, true)}${cardHTML(x.c, { locked: false, shiny: x.shiny, holo: x.holo })}</div></div>`).join("")}</div>
      <div class="row" style="justify-content:center;margin-top:14px">
        ${encore ? `<button class="btn primary" id="again">Ouvrir un booster ${PACKS[encore].nom} (${S.boosters[encore]})</button>` : ""}
        <button class="btn" id="pkPartager">📤 Partager</button><button class="btn" data-close>Terminer</button></div>`;
    // Toucher une carte du résumé l'agrandit (toucher encore pour la remettre)
    $$("[data-voir]", scene).forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      const deja = el.classList.contains("agrandie");
      $$(".opening .agrandie", scene).forEach((x) => x.classList.remove("agrandie"));
      if (!deja) el.classList.add("agrandie");
    }));
    // Évite de toucher « Terminer » ou « Ouvrir » par erreur en tapotant vite pour faire défiler les cartes
    const boutonsResume = $$(".poke .row button", scene);
    boutonsResume.forEach((x) => { x.disabled = true; x.classList.add("attente"); });
    setTimeout(() => boutonsResume.forEach((x) => { x.disabled = false; x.classList.remove("attente"); }), 900);
    // « Terminer » est dans la scène, dont le gestionnaire de toucher bloque la propagation : on le branche directement
    $$("[data-close]", scene).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); if (!b.disabled) fermerModal(); }));
    $("#pkPartager")?.addEventListener("click", (e) => { e.stopPropagation(); if (typeof partager === "function") partager(ordre.map((x) => x.c), `Mon booster ${p.nom}`); });
    $("#again")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const m = $("#modal"); m._onClose = null; fermerModal();
      verifierProgression(); aller(S.vue);
      if ($("#modal").classList.contains("hidden")) ouvrirBooster(encore); // sinon une carte secrète est en train d'être révélée
    });
  }
  async function toucher(e) {
    e?.stopPropagation?.(); // un toucher dans le booster ne doit jamais ouvrir la fiche d'une carte
    if (e?.type === "click" && ignorerClic) return;
    if (etape === "resume" || !scene.isConnected) return;
    if (occupe) return accelerer();
    occupe = true; rapide = false;
    try {
      if (etape === "paquet") { $("#pkPaquet")?.classList.add("dechire"); await attendre(650); if (vivant()) (S.modeOuverture === "une" ? montrer : table)(); }
      else if (etape === "table") { const k = ordre.findIndex((_, i) => !retournees.has(i)); if (k >= 0) await retournerTable(k); else resume(); }
      else if (etape === "carte") await retourner();
      else if (etape === "retournee") await suivante();
    } finally { occupe = false; rapide = false; finAttente = null; }
  }
  scene.addEventListener("click", toucher);
  scene.addEventListener("keydown", (e) => { if (["Enter", " ", "ArrowRight"].includes(e.key)) { e.preventDefault(); toucher(); } });
  // Glisser la carte vers la gauche ou la droite = carte suivante (une fois retournée)
  let xCarte = null;
  scene.addEventListener("pointerdown", (e) => { if (etape === "retournee" || etape === "carte") xCarte = e.clientX; });
  scene.addEventListener("pointerup", (e) => {
    if (xCarte !== null && Math.abs(e.clientX - xCarte) > 60 && !occupe) { ignorerClic = true; setTimeout(() => { ignorerClic = false; }, 350); toucher(); }
    xCarte = null;
  });
  $("#pkPasser").onclick = () => resume(); // fonctionne même pendant une animation
  scene.focus();
}

/* =====================================================================
   Album
   ===================================================================== */
const filtres = { type: "tout", cont: "tout", possedees: false, shiny: false, tri: "num", q: "" };
const sansAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function vueAlbum(v) {
  const f = filtres;
  const chips = [["tout", "Tout"], ["pays", "Pays"], ["ville", "Villes"], ["monument", "Monuments"], ["nature", "Nature"], ["animal", "Animaux"], ["plat", "Gastronomie"], ["culture", "Culture"], ["merveille", "Merveilles"], ["secrete", "Secrètes"]].filter(([k]) => k === "tout" || of("monde", k).length);
  v.innerHTML = `<div class="toolbar">
      ${chips.map(([k, l]) => `<button class="chip ${f.type === k ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}
      <input class="search" id="q" type="search" placeholder="Rechercher…" value="${esc(f.q)}">
      <label class="chip" style="cursor:pointer"><input type="checkbox" id="poss" ${f.possedees ? "checked" : ""}> Possédées</label>
      <label class="chip" style="cursor:pointer"><input type="checkbox" id="filtreShiny" ${f.shiny ? "checked" : ""}> ✨ Shiny / 🌈 Holo</label>
      <select class="chip" id="tri"><option value="num">Tri : numéro</option><option value="puissance">Tri : puissance</option><option value="rarete">Tri : rareté</option><option value="nom">Tri : nom</option></select>
    </div>
    ${f.type !== "merveille" && f.type !== "secrete" ? `<div class="toolbar">${[["tout", "Tous les continents"], ...Object.entries(CONTINENTS).map(([k, c]) => [k, c.emoji + " " + c.nom])].map(([k, l]) => `<button class="chip ${f.cont === k ? "on" : ""}" data-cont="${k}">${l}</button>`).join("")}</div>` : ""}
    <div id="sections"></div>`;
  $("#tri").value = f.tri;
  $$(".toolbar [data-k]", v).forEach((b) => b.onclick = () => { f.type = b.dataset.k; aller("album"); });
  $$(".toolbar [data-cont]", v).forEach((b) => b.onclick = () => { f.cont = b.dataset.cont; aller("album"); });
  $("#poss").onchange = (e) => { f.possedees = e.target.checked; dessinerSections(); };
  $("#filtreShiny").onchange = (e) => { f.shiny = e.target.checked; dessinerSections(); };
  $("#tri").onchange = (e) => { f.tri = e.target.value; dessinerSections(); };
  let t = 0;
  $("#q").oninput = (e) => { f.q = e.target.value; clearTimeout(t); t = setTimeout(dessinerSections, 150); };
  dessinerSections();
}
function dessinerSections() {
  const f = filtres;
  const q = sansAccents(f.q.trim());
  const contOk = (c) => f.cont === "tout" || c.continent === f.cont;
  const ok = (c) => contOk(c) && (!f.shiny || S.shiny?.[c.id] || S.holo?.[c.id]) && (!f.possedees || has(c.id)) && (!q || sansAccents(c.nom + " " + (c.capitale || "") + " " + (NOM_PAYS[c.pays] || "")).includes(q) && (c.type !== "secrete" || has(c.id)));
  const trier = (list) => {
    if (f.tri === "nom") return list.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    if (f.tri === "rarete") return list.slice().sort((a, b) => RARETES[b.rarete].ordre - RARETES[a.rarete].ordre);
    if (f.tri === "puissance") return list.slice().sort((a, b) => (has(b.id) - has(a.id)) || (has(a.id) ? puissanceDe(b) - puissanceDe(a) : 0));
    return list;
  };
  const sections = [];
  const T = f.type;
  if (T === "tout" || T === "pays") {
    for (const [k, ct] of Object.entries(CONTINENTS)) if (f.cont === "tout" || f.cont === k) sections.push([`${ct.emoji} ${ct.nom}`, of("monde", "pays").filter((c) => c.continent === k)]);
  }
  if (T === "tout" || T === "ville") sections.push(["🏙️ Villes", of("monde", "ville")]);
  if (T === "tout" || T === "monument") sections.push(["🏛️ Monuments", of("monde", "monument")]);
  if (T === "tout" || T === "nature") sections.push(["🏔️ Nature", of("monde", "nature")]);
  if (T === "tout" || T === "animal") sections.push(["🐾 Animaux", of("monde", "animal")]);
  if (T === "tout" || T === "plat") sections.push(["🍜 Gastronomie", of("monde", "plat")]);
  if (T === "tout" || T === "culture") sections.push(["🎭 Culture", of("monde", "culture")]);
  if (T === "tout" || T === "merveille") sections.push(["🌟 Merveilles du monde moderne", of("monde", "merveille").filter((c) => c.groupe === "modernes")], ["🏺 Merveilles du monde antique", of("monde", "merveille").filter((c) => c.groupe === "antiques")]);
  if (T === "tout" || T === "secrete") sections.push(["✦ Cartes secrètes", of("monde", "secrete")]);
  // Affichage progressif : 2 500 cartes d'un coup bloquaient le téléphone plusieurs secondes.
  // Chaque rubrique montre ses premières cartes, la suite arrive pendant qu'on fait défiler.
  const blocs = sections.map(([titre, list]) => ({ titre, list, vis: trier(list.filter(ok)), n: 0 })).filter((b) => b.vis.length);
  albumObs?.disconnect();
  const zone = $("#sections");
  if (!blocs.length) { zone.innerHTML = `<p class="muted" style="text-align:center;margin-top:40px">Aucune carte ne correspond.</p>`; return; }
  zone.innerHTML = blocs.map((b, i) => `<div class="sectiontitle"><h3>${b.titre}</h3><span class="muted">${count(b.list.map((c) => c.id))}/${b.list.length}</span></div>
      <div class="cards" data-bloc="${i}"></div><div class="cards-suite" data-bloc="${i}" aria-hidden="true"></div>`).join("");
  const suite = (i) => {
    const b = blocs[i], el = zone.querySelector(`.cards[data-bloc="${i}"]`);
    if (!el || b.n >= b.vis.length) return false;
    const lot = b.vis.slice(b.n, b.n + ALBUM_LOT); b.n += lot.length;
    el.insertAdjacentHTML("beforeend", lot.map((c) => cardHTML(c, { compte: true })).join(""));
    if (b.n >= b.vis.length) zone.querySelector(`.cards-suite[data-bloc="${i}"]`)?.remove();
    return true;
  };
  suite(0);
  if (typeof IntersectionObserver === "undefined") { blocs.forEach((_, i) => { while (suite(i)); }); return; }
  albumObs = new IntersectionObserver((entrees) => {
    // On réobserve après chaque lot : si la fin de la rubrique est encore proche, le lot suivant arrive aussitôt
    for (const e of entrees) if (e.isIntersecting) { albumObs.unobserve(e.target); if (suite(Number(e.target.dataset.bloc)) && e.target.isConnected) albumObs.observe(e.target); }
  }, { rootMargin: "1200px 0px" });
  zone.querySelectorAll(".cards-suite").forEach((x) => albumObs.observe(x));
}
const ALBUM_LOT = 36;
let albumObs = null;

/* =====================================================================
   Atlas interactif
   ===================================================================== */
const couches = { pays: true, villes: true, monuments: true, nature: true, merveilles: true };
function vueAtlas(v, opts = {}) {
  if (typeof d3 === "undefined" || !Object.keys(FEATURES).length) {
    v.innerHTML = `<div class="panel"><p class="muted">🗺️ Chargement de la carte du monde…</p></div>`;
    chargerCarteMonde().then(() => { if (S.vue === "atlas") vueAtlas(v, opts); }).catch(() => { v.innerHTML = `<div class="panel"><p class="err">Impossible de charger la carte. Vérifiez votre connexion.</p></div>`; });
    return;
  }
  const nPays = count(of("monde", "pays").map((c) => c.id));
  v.innerHTML = `<div class="toolbar">
      <b>${nPays}/195 pays</b><div class="bar" style="flex:1;min-width:120px;max-width:300px"><i style="width:${nPays / 1.95}%"></i></div>
      ${[["villes", "🏙️ Villes"], ["monuments", "🏛️ Monuments"], ["nature", "🏔️ Nature"], ["merveilles", "🌟 Merveilles"]].map(([k, l]) => `<button class="chip ${couches[k] ? "on" : ""}" data-c="${k}">${l}</button>`).join("")}
    </div>
    <div class="atlas" id="atlas">
      <div class="zoombtns"><button class="iconbtn" id="zin" aria-label="Zoomer">＋</button><button class="iconbtn" id="zout" aria-label="Dézoomer">−</button><button class="iconbtn" id="zreset" aria-label="Vue entière">⟲</button></div>
      <div class="legend">${Object.values(CONTINENTS).map((c) => `<span><i style="background:${c.couleur}"></i>${c.nom}</span>`).join("")}<span><i style="background:var(--panel2);border:1px solid var(--border)"></i>À découvrir</span></div>
      <div class="tip hidden" id="tip"></div>
    </div>
    <p class="muted" style="font-size:13px">Plus un pays est coloré, plus vous avez de ses cartes. Touchez un pays pour voir toute sa collection, ou un symbole pour ouvrir sa carte.</p>`;
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
    .attr("class", (f) => { const code = NUM_TO_CODE[f.id]; return "country " + (!code ? "none" : progresPays(code).n ? "col own" : "col off"); })
    .attr("fill", (f) => { const code = NUM_TO_CODE[f.id]; if (!code) return null; const p = progresPays(code); return p.n ? CONTINENTS[CONT_PAYS[code]].couleur : null; })
    .attr("fill-opacity", (f) => { const code = NUM_TO_CODE[f.id]; if (!code) return null; const p = progresPays(code); return p.n ? 0.35 + 0.65 * (p.n / p.t) : null; })
    .each(function (f) { const code = NUM_TO_CODE[f.id]; if (code && path.area(f) < 6) petits.push([code, path.centroid(f)]); })
    .on("pointermove", (ev, f) => { const code = NUM_TO_CODE[f.id]; montrerTip(ev, code ? `${NOM_PAYS[code]} · ${progresPays(code).n}/${progresPays(code).t} cartes` : "Territoire hors collection"); })
    .on("pointerleave", cacherTip)
    .on("click", (ev, f) => { const code = NUM_TO_CODE[f.id]; if (code) aller("pays", { code }); });
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
  const reperes = [...(couches.villes ? of("monde", "ville") : []), ...(couches.monuments ? of("monde", "monument") : []), ...(couches.nature ? of("monde", "nature") : []), ...(couches.merveilles ? of("monde", "merveille") : [])].filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && !c.saisonnier);
  const pins = g.append("g").selectAll("g.pin").data(reperes).join("g")
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
const filtreBadges = { cat: "tout", etat: "tout" };
function vueBadges(v) {
  const list = badgesDe(), f = filtreBadges;
  const vis = list.filter((b) => (f.cat === "tout" || b.cat === f.cat) && (f.etat === "tout" || (f.etat === "obtenus" ? S.badges[b.id] : !S.badges[b.id])))
    .sort((a, b) => (f.etat === "encours" ? (b.n / b.t / b.seuil) - (a.n / a.t / a.seuil) : 0));
  v.innerHTML = `<div class="sectiontitle"><h3>🏅 Badges</h3><span class="muted">${list.filter((b) => S.badges[b.id]).length}/${list.length} obtenus · bronze +${RECOMPENSE.bronze} 🪙, argent +${RECOMPENSE.argent} 🪙, or +${RECOMPENSE.or} 🪙, +20 XP chacun</span></div>
    <div class="toolbar">${[["tout", "Tous"], ...Object.entries(CATEGORIES_BADGES)].map(([k, l]) => `<button class="chip ${f.cat === k ? "on" : ""}" data-bc="${k}">${l} <small>${list.filter((b) => (k === "tout" || b.cat === k) && S.badges[b.id]).length}/${list.filter((b) => k === "tout" || b.cat === k).length}</small></button>`).join("")}</div>
    <div class="toolbar">${[["tout", "Tous"], ["encours", "Les plus proches"], ["obtenus", "Obtenus"]].map(([k, l]) => `<button class="chip ${f.etat === k ? "on" : ""}" data-be="${k}">${l}</button>`).join("")}</div>
    <div class="badges">${vis.map((b) => `<div class="badge ${b.niveau} ${S.badges[b.id] ? "got" : ""}">
      <div class="medal">${b.emoji}</div>
      <div style="flex:1;min-width:0"><b>${esc(b.nom)}</b><small>${esc(b.desc)}</small>
      <div class="bar"><i style="width:${Math.min(100, (b.n / b.t / b.seuil) * 100)}%"></i></div>
      <small>${S.badges[b.id] ? "Obtenu ✓" : `${b.n}/${Math.ceil(b.t * b.seuil)}`}</small></div></div>`).join("") || `<p class="muted">Aucun badge ici.</p>`}</div>`;
  $$("[data-bc]", v).forEach((b) => b.onclick = () => { f.cat = b.dataset.bc; aller("badges"); });
  $$("[data-be]", v).forEach((b) => b.onclick = () => { f.etat = b.dataset.be; aller("badges"); });
}

/* =====================================================================
   Quiz : 10 questions par jour (20 en Premium)
   ===================================================================== */
const limiteQuiz = () => (premium() ? 20 : 10);
const quizFaites = () => (S.quizJour.d === today() ? S.quizJour.n : 0);
const quizRestant = () => Math.max(0, limiteQuiz() - quizFaites());
function options(bonne, pool, n = 4) {
  const autres = shuffle([...new Set(pool.filter((x) => x !== bonne))]).slice(0, n - 1);
  return shuffle([bonne, ...autres]);
}
function questionMonde() {
  const pays = of("monde", "pays");
  const lieux = [...of("monde", "ville"), ...of("monde", "monument"), ...of("monde", "nature"), ...of("monde", "merveille")];
  const plats = of("monde", "plat"), animaux = of("monde", "animal"), cultures = of("monde", "culture");
  const type = pick(["capitale", "capitale", "drapeau", "drapeau", "lieu", "lieu", "continent", "anecdote", ...(plats.length ? ["plat", "plat"] : []), ...(animaux.length ? ["animal", "animal"] : []), ...(cultures.length ? ["culture", "culture"] : [])]);
  if (type === "plat" || type === "animal" || type === "culture") {
    const c = pick(type === "plat" ? plats : type === "culture" ? cultures : animaux);
    const voisins = pays.filter((x) => x.continent === c.continent).map((x) => x.nom);
    return { q: type === "plat" ? `De quel pays vient cette spécialité : ${c.nom} ?` : type === "culture" ? `De quel pays vient cette tradition : ${c.nom} ?` : `À quel pays cet animal est-il associé : ${c.nom} ?`,
      media: photoDe(c.id) ? `<img class="qphoto" src="${esc(photoDe(c.id))}" alt="">` : `<div class="qemoji">${c.emoji}</div>`, bonne: NOM_PAYS[c.pays], choix: options(NOM_PAYS[c.pays], voisins), carte: c };
  }
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
    return { q: `Dans quel pays se trouve : ${c.nom} ?`, media: photoDe(c.id) ? `<img class="qphoto" src="${esc(photoDe(c.id))}" alt="Photo du lieu">` : `<div class="qemoji">${c.emoji}</div>`, bonne: NOM_PAYS[c.pays], choix: options(NOM_PAYS[c.pays], voisins), carte: c };
  }
  if (type === "continent") {
    const c = pick(pays);
    const bonne = CONTINENTS[c.continent].nom;
    return { q: `Sur quel continent se trouve ce pays : ${c.nom} ?`, bonne, choix: options(bonne, Object.values(CONTINENTS).map((x) => x.nom)), carte: c };
  }
  const c = pick(of("monde", "monument").concat(of("monde", "merveille")));
  return { q: "De quel monument parle cette anecdote ?", media: `<p class="anec">« ${esc(c.anecdote)} »</p>`, bonne: c.nom, choix: options(c.nom, lieux.filter((x) => x.type !== "ville").map((x) => x.nom)), carte: c };
}
function vueQuiz(v) {
  const st = S.quiz.monde;
  if (!quizRestant()) {
    v.innerHTML = `<div class="quiz panel" style="text-align:center">
      <div style="font-size:52px">🌙</div><h2>Quiz terminé pour aujourd'hui</h2>
      <p>Vous avez répondu à vos ${limiteQuiz()} questions du jour. Revenez dans <b>${duree(minuit() - Date.now())}</b> !</p>
      <p class="muted">Série : ${st.serie} 🔥 · Record : ${st.record} · ${st.bonnes}/${st.total} bonnes réponses</p>
      ${premium() ? "" : `<button class="btn primary premium" id="qPremium">💎 Premium : 20 questions par jour</button>`}
      <button class="btn" id="qCombat">⚔️ Gagner des pièces en combat</button></div>`;
    $("#qPremium")?.addEventListener("click", () => aller("premium"));
    $("#qCombat").onclick = () => aller("combat");
    return;
  }
  const Q = questionMonde();
  v.innerHTML = `<div class="quiz panel">
    <div class="row" style="justify-content:space-between"><span>Série : <span class="streak">${st.serie} 🔥</span></span><span class="muted">Question ${quizFaites() + 1}/${limiteQuiz()} aujourd'hui · Record : ${st.record}</span></div>
    <div class="q">${esc(Q.q)}</div>${Q.media || ""}
    <div class="answers" style="margin-top:14px">${Q.choix.map((x) => `<button>${esc(x)}</button>`).join("")}</div>
    <div class="feedback" id="fb"></div></div>`;
  $$(".answers button", v).forEach((b) => b.onclick = () => {
    const bon = b.textContent === Q.bonne;
    $$(".answers button", v).forEach((x) => { x.disabled = true; if (x.textContent === Q.bonne) x.classList.add("good"); });
    st.total++;
    S.quizJour = { d: today(), n: quizFaites() + 1 };
    let gain = 0;
    if (bon) {
      st.bonnes++; st.serie++; st.record = Math.max(st.record, st.serie); gain = 25;
      progresDefi("quiz"); gagnerXP(6);
      if (st.serie % 5 === 0) gain += 50;
    } else { b.classList.add("bad"); st.serie = 0; }
    S.coins += gain; sauver(); majCoins();
    const c = Q.carte;
    $("#fb").innerHTML = `<p style="font-weight:700;font-size:17px;margin:4px 0">${bon ? `✅ Bravo ! +${gain} 🪙${gain > 25 ? " (bonus de série !)" : ""}` : `❌ C'était : ${esc(Q.bonne)}`}</p>
      ${has(c.id) ? `<p class="muted" style="margin:4px 0">💡 ${esc(c.anecdote)}</p>` : `<p class="muted" style="margin:4px 0">Collectionnez la carte « ${esc(c.nom)} » pour découvrir son anecdote.</p>`}
      <button class="btn primary" id="next">${quizRestant() ? `Question suivante → (${quizRestant()} restantes)` : "Terminer"}</button>`;
    $("#next").onclick = () => aller("quiz");
    $("#next").focus();
  });
}

/* =====================================================================
   Effets sonores (synthétisés, sans fichier audio)
   ===================================================================== */
let audioCtx = null;
function son(type) {
  if (S.son === false) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = { coup: [[180, 0.06, "square"]], crit: [[260, 0.05, "sawtooth"], [520, 0.08, "sawtooth"]], ko: [[300, 0.08, "triangle"], [150, 0.25, "triangle"]],
      victoire: [[523, 0.12, "triangle"], [659, 0.12, "triangle"], [784, 0.25, "triangle"]], defaite: [[392, 0.15, "sine"], [311, 0.3, "sine"]],
      booster: [[440, 0.06, "triangle"], [880, 0.1, "triangle"]], badge: [[784, 0.08, "sine"], [1047, 0.15, "sine"]], niveau: [[523, 0.1, "square"], [784, 0.1, "square"], [1047, 0.2, "square"]],
      soin: [[660, 0.08, "sine"], [880, 0.1, "sine"]], special: [[330, 0.05, "sawtooth"], [440, 0.05, "sawtooth"], [660, 0.12, "sawtooth"]] }[type] || [[440, 0.05, "sine"]];
    let t = audioCtx.currentTime;
    for (const [f, d, forme] of notes) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = forme; o.frequency.value = f; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + d); t += d * 0.9;
    }
  } catch {}
}

/* =====================================================================
   Réglages : thème, sauvegarde, remise à zéro
   ===================================================================== */
// Thème clair « Éclat » par défaut ; le thème sombre reste disponible dans les réglages.
// Les joueurs passent une fois au nouveau thème clair lors de son arrivée.
function appliquerTheme() {
  if (!S.daEclat) { S.daEclat = true; S.theme = ""; }
  // Interface « Pop » : version claire (crème et jaune) par défaut, version sombre dans les Réglages
  if (!S.popDefaut) { S.popDefaut = true; S.theme = "light"; }
  document.documentElement.dataset.theme = S.theme === "dark" ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", S.theme === "dark" ? "#121733" : "#2a5ae6");
}
$("#settingsBtn").onclick = () => {
  ouvrirModal(`<h2 style="margin-top:0">Réglages</h2>
    <div class="form">
      <label>Thème<select id="sTheme"><option value="light">Clair (par défaut)</option><option value="dark">Sombre</option></select></label>
      <div class="panel" style="padding:12px">
        <b>Sauvegarde</b>
        <p class="muted" style="margin:4px 0 10px;font-size:13.5px">Votre progression reste dans ce navigateur (et dans le cloud si vous avez un compte). Exportez-la pour la garder ou la transférer.</p>
        <div class="row"><button class="btn small" id="sExport">⬇ Exporter</button><button class="btn small" id="sImport">⬆ Importer</button></div>
      </div>
      <button class="btn" id="sReset" style="color:var(--bad)">Recommencer à zéro</button>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" id="sSon" ${S.son !== false ? "checked" : ""}> Effets sonores</label>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" id="sPhotos" ${S.photos !== false ? "checked" : ""}> Afficher les vraies photos (Wikipédia)</label>
      <p class="muted" style="font-size:12.5px;margin:0">Photos : Wikipédia et Wikimedia Commons, sous licences libres ; l'auteur et la licence de chaque photo sont indiqués sur la fiche de la carte. Carte : Natural Earth (domaine public). Drapeaux : flag-icons (licence MIT).</p>
    </div>`);
  $("#sTheme").value = S.theme || "light";
  $("#sTheme").onchange = (e) => { S.theme = e.target.value; sauver(); appliquerTheme(); };
  $("#sSon").onchange = (e) => { S.son = e.target.checked; sauver(); if (S.son) son("badge"); };
  $("#sPhotos").onchange = (e) => { S.photos = e.target.checked; sauver(); aller(S.vue); if (S.photos) chargerPhotos(); };
  $("#sExport").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "worldcards", version: 2, sauvegarde: S })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `worldcards-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#sImport").onclick = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const j = JSON.parse(await input.files[0].text());
        if (j.app !== "worldcards" || !j.sauvegarde?.owned) throw new Error();
        S = migrer(j.sauvegarde);
        sauver(); fermerModal(); appliquerTheme(); majCoins(); aller(S.vue); toast("✅ Sauvegarde importée.");
      } catch { toast("⚠ Fichier de sauvegarde invalide."); }
    };
    input.click();
  };
  $("#sReset").onclick = () => confirmer("Effacer toute votre progression ? C'est définitif.", "Tout effacer", () => {
    S = nouvelleSauvegarde(); S.migreMonde = 1;
    sauver(); fermerModal(); majCoins(); aller("accueil");
  });
};

/* =====================================================================
   Démarrage (une fois tous les scripts chargés)
   ===================================================================== */
async function demarrer() {
  appliquerTheme(); majCoins(); majNiveau();
  const pv = $("#versionJeu"); if (pv) pv.textContent = `${VERSION_JEU} · ${fmt(CARDS.length)} cartes`;
  // Raccourcis de l'app installée et des notifications (ex. ./#boosters, ./#combat)
  const ancre = location.hash.slice(1);
  if (["accueil", "boosters", "album", "quiz", "badges", "combat", "hub", "compte", "premium", ...Object.keys(typeof VUES_EXTRA === "object" ? VUES_EXTRA : {})].includes(ancre)) { S.vue = ancre; history.replaceState(null, "", location.pathname); }
  aller(S.vue);
  verifierProgression();
  chargerPhotos();
  initCompte();
  if (!S.ouverts && !count(CARDS.map((c) => c.id)) && S.vue !== "defi" && S.vue !== "devine") { // un visiteur venu jouer au défi du jour n'est pas interrompu
    ouvrirModal(`<div style="text-align:center"><div style="font-size:56px">🌐</div><h2>Bienvenue dans Play2F1 !</h2>
      <p>Collectionnez le monde : <b>195 pays</b>, des centaines de <b>villes</b>, de <b>monuments</b> et de <b>sites naturels</b>, des <b>animaux</b>, des <b>plats</b> et les <b>merveilles</b> du monde. Chaque carte a ses points d'attaque, de défense et de vie : construisez votre deck et combattez !</p>
      <p class="muted">Vous recevez <b>3 boosters</b> et <b>200 🪙</b> pour commencer, puis un <b>booster gratuit toutes les 12 heures</b>.</p>
      <button class="btn primary" id="go">Ouvrir mon premier booster</button></div>`);
    $("#go").onclick = () => { const m = $("#modal"); m._onClose = null; fermerModal(); aller("boosters"); ouvrirBooster("monde"); };
  }
}
addEventListener("DOMContentLoaded", demarrer);
