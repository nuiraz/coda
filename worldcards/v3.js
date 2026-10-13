"use strict";
/* Play2F1 — nouvelle direction artistique : icônes au trait, barre de navigation, page de connexion,
   page boosters, Forge, Codex, et visuels de boosters envoyés par l'admin. Chargé après social.js. */

/* ---------- Icônes au trait (remplacent les emojis du menu) ---------- */
const ICONES = {
  accueil: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  boosters: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  forge: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.6 1.5-3.5.2 1.5 1 2 1.5 2C11 7 12 5 12 3z"/><path d="M5 21h14M8 17.5h8"/>',
  album: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
  codex: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  combat: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 6.5 13 3h3v3l-3.5 3.5"/>',
  hub: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.8-1.9-5.1-4.5-5.8"/>',
  compte: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  collections: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  atlas: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
  badges: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
  premium: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 18 3-18"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  guilde: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  passe: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2.5"/>',
  style: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 2-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  encheres: '<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8"/>',
  expedition: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  samedi: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  parrainage: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 8v6M16 11h6"/>',
  soutenir: '<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
  langue: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  admin: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
  plus: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const svgIcone = (k) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[k] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;
// Menu de l'ordinateur : une barre horizontale avec l'essentiel, le reste dans « Plus »
const NAV_ORDI = ["accueil", "boosters", "forge", "album", "codex", "combat", "hub", "compte"];
const estOrdi = () => matchMedia("(min-width: 1000px)").matches;
const _renderNav = renderNav;
renderNav = function () {
  _renderNav();
  const nav = $("#nav"); if (!nav) return;
  if (estOrdi()) {
    const pill = boostersEnStock() + (gratuitDans() === 0 ? 1 : 0);
    nav.innerHTML = NAV_ORDI.map((v) => { const d = DESTINATIONS.find((x) => x[0] === v); if (!d) return "";
      return `<button data-v="${v}" class="${S.vue === v ? "on" : ""}">${svgIcone(v)}<span>${esc(d[2])}</span>${v === "boosters" && pill ? `<span class="pill">${pill}</span>` : ""}</button>`; }).join("")
      + `<button data-plus class="${NAV_ORDI.includes(S.vue) ? "" : "on"}">${svgIcone("plus")}<span>Plus</span></button>`;
    $$("button[data-v]", nav).forEach((b) => b.onclick = () => aller(b.dataset.v));
    $("[data-plus]", nav).onclick = ouvrirMenuPlus;
  } else {
    $$("button[data-v]", nav).forEach((b) => { const ic = $(".ic", b); if (ic && ICONES[b.dataset.v]) ic.innerHTML = svgIcone(b.dataset.v); });
    const ic = $("[data-plus] .ic", nav); if (ic) ic.innerHTML = svgIcone("plus");
  }
};
addEventListener("resize", (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => renderNav(), 150); }; })());
// Panneau « Plus » : mêmes icônes au trait
const _ouvrirMenuPlus = ouvrirMenuPlus;
ouvrirMenuPlus = function () {
  _ouvrirMenuPlus();
  $$(".mp-grille button[data-v], .mp-grille button[data-act]").forEach((b) => { const k = b.dataset.v || b.dataset.act; const sp = $("span", b); if (sp && ICONES[k]) sp.innerHTML = svgIcone(k); });
};

/* ---------- Visuels de boosters (images de l'admin) ---------- */
let VISUELS = {};
const COULEURS_PACK = { monde: "#f5b21b", argent: "#c0c7d6", or: "#f5b21b", prestige: "#a78bfa", mega: "#22d3ee" };
function appliquerVisuels(racine = document) {
  for (const el of racine.querySelectorAll ? racine.querySelectorAll(".pack") : []) {
    const k = [...el.classList].find((c) => PACKS[c]);
    if (!k) continue;
    if (!el.style.getPropertyValue("--pc")) el.style.setProperty("--pc", PACKS[k].couleur || COULEURS_PACK[k] || (PACKS[k].theme ? "#38bdf8" : "#f5b21b"));
    if (VISUELS[k] && !el.classList.contains("a-visuel")) { el.classList.add("a-visuel"); el.style.setProperty("background-image", `url(/api/visuel/${encodeURIComponent(k)}?v=${VISUELS[k]})`, "important"); }
  }
}
new MutationObserver((l) => { for (const m of l) for (const n of m.addedNodes) if (n.nodeType === 1) appliquerVisuels(n.matches?.(".pack") ? n.parentElement || n : n); }).observe(document.documentElement, { childList: true, subtree: true });
addEventListener("DOMContentLoaded", () => {
  fetch("/api/visuels").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.visuels) { VISUELS = j.visuels; appliquerVisuels(); } }).catch(() => {});
});

/* ---------- Page boosters : grand paquet, compteurs et bouton « Ouvrir » ---------- */
const _vueBoostersV3 = vueBoosters;
vueBoosters = function (v, opts) {
  _vueBoostersV3(v, opts);
  const ancien = v.firstElementChild; if (!ancien) return;
  const stock = Object.keys(PACKS).filter((k) => S.boosters[k] > 0), nb = stock.reduce((t, k) => t + S.boosters[k], 0);
  const choix = stock.includes(boosterHeroEtat.cle) ? boosterHeroEtat.cle : stock[0] || "monde", p = PACKS[choix];
  const attente = gratuitDans();
  const libelle = stock.length ? `Ouvrir · booster ${p.nom}` : attente === 0 ? "Récupérer le booster gratuit" : null;
  const hero = document.createElement("section");
  hero.className = "booster-hero";
  hero.innerHTML = `<div class="bh-pills">
      <span class="bh-pill">${svgIcone("boosters")} <b>${nb}</b> booster${nb > 1 ? "s" : ""} en stock</span>
      <span class="bh-pill cyan">${attente === 0 ? "🎁 Booster gratuit disponible" : `⏱ +1 gratuit dans <b>${duree(attente)}</b>`}</span></div>
    <button class="pack ${choix} hero" ${p.couleur ? `style="--pc:${p.couleur}"` : ""} aria-label="Ouvrir le booster ${esc(p.nom)}">
      <span class="pk-marque">PLAY2F1</span><span class="pk-sous">Cartes à collectionner</span>
      <span class="big">${p.emoji}</span><b>${esc(p.nom)}</b>
      <span class="pk-pied"><i>${p.cartes}</i> cartes</span></button>
    ${libelle ? `<button class="btn-ouvrir" id="bhOuvrir">${esc(libelle)}</button>` : `<p class="muted">Achetez un booster ci-dessous ou revenez dans ${duree(attente)}.</p>`}
    <p class="bh-note">Chaque booster contient ${p.cartes} cartes du monde entier ; plus il est rare, plus vos chances de cartes légendaires sont élevées.</p>
    ${stock.length > 1 ? `<div class="bh-choix">${stock.map((k) => `<button class="chip ${k === choix ? "on" : ""}" data-bh="${k}">${PACKS[k].emoji} ${esc(PACKS[k].nom)} ×${S.boosters[k]}</button>`).join("")}</div>` : ""}`;
  ancien.classList.add("hidden");
  ancien.before(hero);
  const ouvrir = () => {
    if (stock.length) return ouvrirBooster(choix);
    ancien.querySelector("#gratuit")?.click();
  };
  $("#bhOuvrir", hero)?.addEventListener("click", ouvrir);
  $(".pack.hero", hero).onclick = ouvrir;
  $$("[data-bh]", hero).forEach((b) => b.onclick = () => { boosterHeroEtat.cle = b.dataset.bh; aller("boosters"); });
  // Les autres boutons de l'ancien bloc (bonus Premium, tout ouvrir) restent accessibles sous le paquet
  const extras = [...ancien.querySelectorAll("#toutOuvrir, #bonusPremium, #prestigeOffert")];
  if (extras.length) { const r = document.createElement("div"); r.className = "row bh-extras"; extras.forEach((x) => r.appendChild(x)); hero.appendChild(r); }
};
const boosterHeroEtat = { cle: null };

/* ---------- Page de connexion (logo, nom, avantages, onglets) ---------- */
const _vueCompteV3 = vueCompte;
vueCompte = function (v, opts) {
  _vueCompteV3(v, opts);
  if (connecte()) return;
  const fc = $("#fConnexion", v), fi = $("#fInscription", v);
  if (!fc || !fi) return;
  const carte = document.createElement("section");
  carte.className = "connexion-carte";
  carte.innerHTML = `<img class="cx-logo" src="icons/logo-2f1.png" alt="" width="96" height="96">
    <h1 class="cx-nom">PLAY2F1</h1>
    <p class="cx-accroche">Le jeu de cartes à collectionner du monde entier : pays, villes, monuments, animaux et merveilles. Ouvrez des boosters, complétez votre collection et affrontez les autres joueurs.</p>
    <div class="cx-atouts">
      <div>${svgIcone("boosters")}<b>3 boosters</b><small>offerts au départ</small></div>
      <div>${svgIcone("album")}<b>Sauvegarde cloud</b><small>sur tous vos appareils</small></div>
      <div>${svgIcone("combat")}<b>Arène & duels</b><small>combats en ligne</small></div>
    </div>
    <div class="cx-onglets"><button class="on" data-cx="connexion">Se connecter</button><button data-cx="inscription">Créer un compte</button></div>
    <div class="cx-forms"></div>
    <button class="cx-invite" id="cxInvite">Jouer sans compte →</button>
    <p class="cx-secu">${svgIcone("guilde")} Compte sécurisé : mot de passe chiffré, aucune adresse e-mail demandée.</p>`;
  $(".cx-forms", carte).append(fc, fi);
  $$("h3", carte).forEach((h) => h.remove());
  const montrer = (k) => { fc.classList.toggle("hidden", k !== "connexion"); fi.classList.toggle("hidden", k !== "inscription"); $$("[data-cx]", carte).forEach((b) => b.classList.toggle("on", b.dataset.cx === k)); };
  $$("[data-cx]", carte).forEach((b) => b.onclick = () => montrer(b.dataset.cx));
  montrer(S.ouverts ? "connexion" : "inscription");
  $("#cxInvite", carte).onclick = () => { document.body.classList.remove("ecran-connexion"); aller(S.ouverts ? "accueil" : "boosters"); if (!S.ouverts && S.boosters.monde) setTimeout(() => ouvrirBooster("monde"), 300); };
  v.innerHTML = ""; v.appendChild(carte);
};
// Premier passage : la page de connexion s'affiche en plein écran (on peut jouer sans compte)
addEventListener("DOMContentLoaded", () => {
  let vu = false; try { vu = !!localStorage.getItem("worldcards:vu-connexion"); localStorage.setItem("worldcards:vu-connexion", "1"); } catch {}
  if (vu || S.ouverts || location.hash === "#defi" || S.vue === "defi" || S.vue === "devine") return; // lien partagé du défi du jour : on joue tout de suite
  setTimeout(() => {
    if (typeof connecte === "function" && connecte()) return;
    fermerModal(); document.body.classList.add("ecran-connexion"); aller("compte");
  }, 400);
});
const _allerV3 = aller;
aller = function (vue, opts) { if (vue !== "compte") document.body.classList.remove("ecran-connexion"); return _allerV3(vue, opts); };

/* ---------- La Forge : 10 cartes de même rareté → 1 carte de rareté supérieure garantie ---------- */
const ORDRE_FORGE = ["commun", "peu-commun", "rare", "epique", "ultra-rare", "legendaire"];
const forgeEtat = { slots: [], filtre: null };
const disponiblesForge = (c) => Math.max(0, (S.owned[c.id] || 0) - 1 - forgeEtat.slots.filter((x) => x === c.id).length); // on garde toujours 1 exemplaire
function cartesForgeables() { return CARDS.filter((c) => c.type !== "secrete" && ORDRE_FORGE.indexOf(c.rarete) >= 0 && ORDRE_FORGE.indexOf(c.rarete) < ORDRE_FORGE.length - 1 && (S.owned[c.id] || 0) > 1); }
function vueForge(v) {
  const rarete = forgeEtat.slots.length ? BY_ID[forgeEtat.slots[0]].rarete : null;
  const suivante = rarete ? ORDRE_FORGE[ORDRE_FORGE.indexOf(rarete) + 1] : null;
  const filtre = rarete || forgeEtat.filtre;
  const dispo = cartesForgeables().filter((c) => (!filtre || c.rarete === filtre) && disponiblesForge(c) > 0)
    .sort((a, b) => ORDRE_FORGE.indexOf(a.rarete) - ORDRE_FORGE.indexOf(b.rarete) || disponiblesForge(b) - disponiblesForge(a));
  const parRarete = Object.fromEntries(ORDRE_FORGE.slice(0, -1).map((r) => [r, cartesForgeables().filter((c) => c.rarete === r).reduce((t, c) => t + (S.owned[c.id] - 1), 0)]));
  v.innerHTML = `<header class="page-tete"><h1>La Forge</h1><p>Vos doublons prennent la poussière ? Réunissez-en <b>10 de la même rareté</b> et la Forge les fond en <b>une carte du niveau au-dessus</b>, de préférence une que vous n'avez pas encore. Un exemplaire de chaque carte reste toujours dans votre album.</p></header>
    <section class="panel forge">
      <div class="forge-haut"><span class="forge-ic">${svgIcone("forge")}</span>
        <div class="forge-txt"><b>Progression : <span class="tag-num">${forgeEtat.slots.length} / 10 cartes</span></b>
          <div class="muted">Résultat garanti : ${suivante ? `<b class="r-${suivante}">une carte ${RARETES[suivante].nom}</b>` : "choisissez 10 cartes de même rareté"}</div></div>
        <button class="btn" id="forgeAuto">Remplir automatiquement</button><button class="btn" id="forgeVider">Vider</button></div>
      <div class="forge-slots" data-noclick>${Array.from({ length: 10 }, (_, i) => { const id = forgeEtat.slots[i]; return id ? `<button class="slot plein" data-retirer="${i}">${cardHTML(BY_ID[id], { locked: false })}</button>` : `<div class="slot"><span>+</span><small>#${i + 1}</small></div>`; }).join("")}</div>
      <button class="btn-ouvrir" id="forgeGo" ${forgeEtat.slots.length === 10 ? "" : "disabled"}>${forgeEtat.slots.length === 10 ? `Forger une carte ${RARETES[suivante].nom}` : "Placez 10 cartes de même rareté"}</button>
    </section>
    <section class="panel"><div class="row" style="justify-content:space-between;gap:8px"><h3 style="margin:0">Vos doublons</h3>
      <div class="toolbar" style="margin:0">${ORDRE_FORGE.slice(0, -1).map((r) => `<button class="chip ${filtre === r ? "on" : ""}" data-fr="${r}" ${rarete && rarete !== r ? "disabled" : ""}>${RARETES[r].nom} · ${parRarete[r]}</button>`).join("")}</div></div>
      <p class="muted" style="margin:6px 0 12px">Touchez une carte pour la placer dans la forge (les niveaux de la carte peuvent baisser).</p>
      <div class="cards forge-dispo" data-noclick>${dispo.length ? dispo.slice(0, 120).map((c) => `<div class="forge-c" data-ajout="${c.id}">${cardHTML(c, { locked: false })}<span class="forge-n">×${disponiblesForge(c)}</span></div>`).join("") : `<p class="muted">Aucun doublon${filtre ? " de cette rareté" : ""} pour l'instant : ouvrez des boosters !</p>`}</div></section>`;
  $$("[data-fr]", v).forEach((b) => b.onclick = () => { forgeEtat.filtre = forgeEtat.filtre === b.dataset.fr ? null : b.dataset.fr; vueForge(v); });
  $$("[data-ajout]", v).forEach((b) => b.onclick = () => {
    const c = BY_ID[b.dataset.ajout];
    if (forgeEtat.slots.length >= 10 || (rarete && c.rarete !== rarete) || disponiblesForge(c) <= 0) return;
    forgeEtat.slots.push(c.id); vueForge(v);
  });
  $$("[data-retirer]", v).forEach((b) => b.onclick = () => { forgeEtat.slots.splice(Number(b.dataset.retirer), 1); vueForge(v); });
  $("#forgeVider").onclick = () => { forgeEtat.slots = []; vueForge(v); };
  $("#forgeAuto").onclick = () => {
    const r = rarete || forgeEtat.filtre || ORDRE_FORGE.slice(0, -1).find((x) => parRarete[x] >= 10);
    if (!r) return toast("Il vous faut 10 doublons de même rareté.");
    for (const c of cartesForgeables().filter((x) => x.rarete === r).sort((a, b) => disponiblesForge(b) - disponiblesForge(a))) {
      while (forgeEtat.slots.length < 10 && disponiblesForge(c) > 0) forgeEtat.slots.push(c.id);
    }
    if (forgeEtat.slots.length < 10) toast(`Pas assez de doublons ${RARETES[r].nom.toLowerCase()} (${forgeEtat.slots.length}/10).`);
    vueForge(v);
  };
  $("#forgeGo").onclick = () => forger(v, suivante);
}
function forger(v, cible) {
  if (forgeEtat.slots.length !== 10 || !cible) return;
  for (const id of forgeEtat.slots) if ((S.owned[id] || 0) < 2) return toast("⚠ Une carte n'est plus disponible.");
  for (const id of forgeEtat.slots) S.owned[id]--;
  const pool = CARDS.filter((c) => c.rarete === cible && c.type !== "secrete" && !c.saisonnier);
  const neuves = pool.filter((c) => !has(c.id)), l = neuves.length ? neuves : pool;
  const c = l[Math.floor(Math.random() * l.length)];
  const neuve = !has(c.id); gagner(c.id);
  forgeEtat.slots = []; gagnerXP(20); sauver(); majCoins();
  ouvrirModal(`<div class="forge-resultat"><div class="forge-flamme">${svgIcone("forge")}</div><p class="muted">La forge chauffe…</p></div>`);
  setTimeout(() => {
    const box = $("#modal .box"); if (!box) return;
    box.innerHTML = `<button class="close" data-close aria-label="Fermer">✕</button><div class="forge-resultat revele"><small class="r-${cible}">${RARETES[cible].nom.toUpperCase()} FORGÉE</small>
      <div style="max-width:230px;margin:10px auto">${cardHTML(c, { locked: false })}</div><h2 style="margin:6px 0">${esc(c.nom)}</h2>
      <p class="muted">${neuve ? "Nouvelle carte pour votre collection !" : "Vous l'aviez déjà : un exemplaire de plus."}</p><button class="btn-ouvrir" data-close>Continuer</button></div>`;
    son?.("niveau"); verifierProgression();
  }, 1300);
  $("#modal")._onClose = () => aller("forge");
}
ajouterPage("forge", "🔥", "Forge", vueForge);

/* ---------- Le Codex : l'encyclopédie vivante de toutes les cartes ---------- */
const codexEtat = { q: "", rarete: null, info: null, filtre: "toutes", type: null, nb: 60 };
async function vueCodex(v) {
  const toutes = CARDS.filter((c) => c.univers === "monde" && c.type !== "secrete");
  const miennes = toutes.filter((c) => has(c.id));
  const parRarete = ORDRE_FORGE.map((r) => [r, miennes.filter((c) => c.rarete === r).length, toutes.filter((c) => c.rarete === r).length]);
  v.innerHTML = `<section class="codex-tete">
      <div style="flex:1;min-width:0"><span class="codex-badge">${svgIcone("codex")} Codex Play2F1</span>
        <h1>Le grand atlas des cartes</h1>
        <p>Les 195 pays, les villes, les monuments, les animaux et les plats du jeu, rangés au même endroit. Feuilletez les cartes qui vous manquent, repérez celles à chasser dans les boosters, et voyez quel joueur a trouvé chacune en premier.</p></div>
      <div class="codex-monde"><small>Découvertes mondiales</small><b id="cxMonde">…</b><span class="muted">/ ${fmt(toutes.length)} cartes</span><em>${fmt(miennes.length)} découvertes par vous</em></div>
      <div class="codex-raretes">${parRarete.map(([r, n, t]) => `<div class="r-${r}"><small>${RARETES[r].nom}</small><b>${n}</b><span>/ ${t}</span></div>`).join("")}</div></section>
    <div class="codex-recherche"><input id="cxQ" type="search" placeholder="Rechercher une carte, un pays, une ville…" value="${esc(codexEtat.q)}"><button class="btn" id="cxHasard">Au hasard</button></div>
    <div class="toolbar">${[["toutes", "Toutes les cartes"], ["manquantes", "À découvrir"], ["miennes", "Ma collection"]].map(([k, n]) => `<button class="chip ${codexEtat.filtre === k ? "on" : ""}" data-cf="${k}">${n}</button>`).join("")}</div>
    <div class="toolbar">${ORDRE_FORGE.map((r) => `<button class="chip ${codexEtat.rarete === r ? "on" : ""}" data-cr="${r}">${RARETES[r].nom}</button>`).join("")}</div>
    <div class="toolbar">${[...new Set(toutes.map((c) => c.type))].map((ty) => `<button class="chip ${codexEtat.type === ty ? "on" : ""}" data-ct="${ty}">${esc(TYPES[ty] || ty)}</button>`).join("")}</div>
    <div id="cxRes"></div>
    <div class="grid2" style="margin-top:16px"><section class="panel"><h3 style="margin-top:0">Dernières découvertes</h3><div id="cxRecentes" class="muted">Chargement…</div></section>
      <section class="panel"><h3 style="margin-top:0">Grands explorateurs</h3><div id="cxTop" class="muted">Chargement…</div></section></div>`;
  const dessiner = () => {
    const q = sansAccents(codexEtat.q.trim());
    const res = toutes.filter((c) => (!codexEtat.rarete || c.rarete === codexEtat.rarete) && (!codexEtat.type || c.type === codexEtat.type)
      && (codexEtat.filtre === "toutes" || (codexEtat.filtre === "miennes") === has(c.id))
      && (!q || sansAccents(`${c.nom} ${NOM_PAYS[c.pays] || ""} ${c.capitale || ""}`).includes(q)));
    $("#cxRes").innerHTML = `<p class="muted">${fmt(res.length)} carte${res.length > 1 ? "s" : ""} · ${fmt(res.filter((c) => has(c.id)).length)} dans votre collection</p>
      <div class="codex-grille">${res.slice(0, codexEtat.nb).map((c) => `<div class="codex-c${has(c.id) ? " possedee" : " manquante"}" data-cx="${c.id}">${cardHTML(c, { locked: false })}${has(c.id) ? `<span class="cx-etiq ok">✓ Possédée</span>` : `<span class="cx-etiq">À découvrir</span>`}</div>`).join("")}</div>
      ${res.length > codexEtat.nb ? `<button class="btn" id="cxPlus" style="display:block;margin:16px auto 0">Voir plus (${fmt(res.length - codexEtat.nb)} restantes)</button>` : ""}`;
    $$("[data-cx]", $("#cxRes")).forEach((b) => b.onclick = (e) => { e.stopPropagation(); ficheCodex(BY_ID[b.dataset.cx]); });
    const plus = $("#cxPlus"); if (plus) plus.onclick = () => { codexEtat.nb += 60; dessiner(); };
  };
  let t; $("#cxQ").oninput = (e) => { codexEtat.q = e.target.value; codexEtat.nb = 60; clearTimeout(t); t = setTimeout(dessiner, 150); };
  $$("[data-cr]", v).forEach((b) => b.onclick = () => { codexEtat.rarete = codexEtat.rarete === b.dataset.cr ? null : b.dataset.cr; codexEtat.nb = 60; vueCodex(v); });
  $$("[data-ct]", v).forEach((b) => b.onclick = () => { codexEtat.type = codexEtat.type === b.dataset.ct ? null : b.dataset.ct; codexEtat.nb = 60; vueCodex(v); });
  $$("[data-cf]", v).forEach((b) => b.onclick = () => { codexEtat.filtre = b.dataset.cf; codexEtat.nb = 60; vueCodex(v); });
  $("#cxHasard").onclick = () => ficheCodex(toutes[Math.floor(Math.random() * toutes.length)]);
  dessiner();
  try {
    const r = await api("codex");
    $("#cxMonde").textContent = fmt(r.total);
    $("#cxRecentes").innerHTML = r.recentes.length ? r.recentes.filter((x) => BY_ID[x.carte]).map((x) => `<div class="codex-ligne"><span>${esc(BY_ID[x.carte].nom)}</span><small>par <b>${esc(x.pseudo)}</b> · ${depuis(x.cree_le)}</small></div>`).join("") : "Aucune découverte pour l'instant.";
    $("#cxTop").innerHTML = r.explorateurs.length ? r.explorateurs.map((x, i) => `<div class="codex-ligne"><span>${["🥇", "🥈", "🥉"][i] || i + 1} ${esc(x.pseudo)}</span><small>${fmt(x.n)} premières découvertes</small></div>`).join("") : "Personne pour l'instant.";
  } catch { const m = $("#cxMonde"); if (m) m.textContent = "—"; $("#cxRecentes") && ($("#cxRecentes").textContent = "Disponible avec un compte en ligne."); $("#cxTop") && ($("#cxTop").textContent = "—"); }
}
async function ficheCodex(c) {
  if (!c) return;
  if (has(c.id)) return ficheCarte(c);
  ouvrirModal(`<div class="codex-fiche"><div class="cx-grande">${cardHTML(c, { locked: false })}</div><h2 style="margin:8px 0 2px">${esc(c.nom)}</h2>
    <p class="muted" style="margin:0">${esc(TYPES[c.type] || "")} · <span class="r-${c.rarete}">${esc(RARETES[c.rarete].nom)}</span>${c.pays && NOM_PAYS[c.pays] ? ` · ${esc(NOM_PAYS[c.pays])}` : ""}</p>
    <p>Vous n'avez pas encore cette carte. Ouvrez des boosters${c.saisonnier ? " (carte d'événement ou de saison)" : ""} ou fabriquez-la avec de la poussière.</p>
    <p class="muted" id="cxPremier">Recherche du premier découvreur…</p></div>`);
  try { const r = await api("codex/carte/" + encodeURIComponent(c.id)); const el = $("#cxPremier"); if (el) el.innerHTML = r.decouverte ? `Découverte en premier par <b>${esc(r.decouverte.pseudo)}</b> ${depuis(r.decouverte.cree_le)}.` : "Personne ne l'a encore découverte : soyez le premier !"; }
  catch { const el = $("#cxPremier"); if (el) el.textContent = ""; }
}
ajouterPage("codex", "🧭", "Codex", vueCodex);
// La Forge et le Codex juste après Boutique dans les menus
for (const k of ["codex", "forge"]) { const i = DESTINATIONS.findIndex((d) => d[0] === k); if (i >= 0) { const [d] = DESTINATIONS.splice(i, 1); DESTINATIONS.splice(DESTINATIONS.findIndex((x) => x[0] === "boosters") + 1, 0, d); } }

/* ---------- Admin : visuels des boosters ---------- */
// Boosters : 900 px de haut au plus. Photos de cartes (petites à l'écran) : 600 px de large au plus, qualité un peu plus basse
function preparerVisuel(fichier, carte = false) {
  return new Promise((ok, ko) => {
    if (!/^image\//.test(fichier.type)) return ko(new Error("Choisissez une image."));
    const img = new Image(), url = URL.createObjectURL(fichier);
    img.onload = () => {
      const r = carte ? Math.min(1, 600 / img.width, 600 / img.height) : Math.min(1, 900 / img.height);
      const w = Math.round(img.width * r), h = Math.round(img.height * r);
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = carte ? 0.8 : 0.88, data = c.toDataURL("image/webp", q);
      if (!data.startsWith("data:image/webp")) data = c.toDataURL("image/jpeg", q);
      while (data.length > 1350000 && q > 0.4) { q -= 0.1; data = c.toDataURL(data.startsWith("data:image/webp") ? "image/webp" : "image/jpeg", q); }
      ok(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("Image illisible.")); };
    img.src = url;
  });
}
async function adminVisuels(el) {
  try { VISUELS = (await api("visuels")).visuels || {}; } catch {}
  const groupes = [["Boosters principaux", Object.keys(PACKS).filter((k) => !PACKS[k].theme && !PACKS[k].evenement)], ["Boosters thématiques", Object.keys(PACKS).filter((k) => PACKS[k].theme && !PACKS[k].perso)], ["Boosters créés", Object.keys(PACKS).filter((k) => PACKS[k].perso)], ["Événements et saisons", Object.keys(PACKS).filter((k) => PACKS[k].evenement)]];
  el.innerHTML = `<p class="muted">Envoyez l'image de chaque booster (créée avec Google Flow, Canva…). Format conseillé : <b>portrait 2:3</b> (par exemple 800 × 1200), PNG, JPEG ou WebP. L'image est réduite et compressée automatiquement, puis remplace le paquet dessiné dans la boutique et à l'ouverture.</p>
    ${groupes.filter(([, c]) => c.length).map(([titre, cles]) => `<h3>${titre}</h3><div class="visuels-grille">${cles.map((k) => `<div class="visuel-item">
      <div class="pack ${k} mini-visuel" ${PACKS[k].couleur ? `style="--pc:${PACKS[k].couleur}"` : ""}><span class="big">${PACKS[k].emoji}</span><b>${esc(PACKS[k].nom)}</b></div>
      <b>${esc(PACKS[k].nom)}</b><small class="muted">${VISUELS[k] ? "✅ image personnalisée" : "paquet dessiné"}</small>
      <label class="btn small primary">Envoyer une image<input type="file" accept="image/*" hidden data-vis="${k}"></label>
      ${VISUELS[k] ? `<button class="btn small" data-vis-suppr="${k}">Retirer</button>` : ""}</div>`).join("")}</div>`).join("")}`;
  appliquerVisuels(el);
  $$("[data-vis]", el).forEach((inp) => inp.onchange = async () => {
    try { const image = await preparerVisuel(inp.files[0]); const r = await api("admin/visuels", { methode: "POST", corps: { cle: inp.dataset.vis, image } }); VISUELS[inp.dataset.vis] = r.maj; toast("🖼️ Image du booster enregistrée."); adminVisuels(el); }
    catch (e) { toast("⚠ " + e.message, 6000); }
  });
  $$("[data-vis-suppr]", el).forEach((b) => b.onclick = async () => { try { await api("admin/visuels/" + encodeURIComponent(b.dataset.visSuppr), { methode: "DELETE" }); delete VISUELS[b.dataset.visSuppr]; adminVisuels(el); } catch (e) { toast("⚠ " + e.message); } });
}

/* ---------- Thème sombre par défaut (nouvelle direction artistique) ---------- */
if (!S.daV3) { if (!S.theme) S.theme = "dark"; S.daV3 = true; try { sauver(); } catch {} appliquerTheme(); }

/* ---------- Photos de cartes envoyées par l'admin (prioritaires sur Wikipédia) ---------- */
let PHOTOS_PERSO = {};
const urlPhotoPerso = (id) => `/api/photo-perso/${id.replace(":", "~")}?v=${PHOTOS_PERSO[id]}`;
const _photoHTMLv3 = photoHTML;
photoHTML = function (c, locked) {
  if (!PHOTOS_PERSO[c.id] || S.photos === false) return _photoHTMLv3(c, locked);
  if (locked && c.type === "secrete") return "";
  return `<img class="photo perso${locked ? " teaser" : ""}" src="${esc(urlPhotoPerso(c.id))}" alt="${locked ? "" : "Photo : " + esc(c.nom)}" loading="lazy">`;
};
function majPhotosPerso(id) {
  for (const el of document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"] .art`)) {
    el.querySelector(".photo")?.remove();
    const h = photoHTML(BY_ID[id], el.closest(".card").classList.contains("locked")); if (h) el.insertAdjacentHTML("afterbegin", h);
  }
}
(async () => {
  try {
    PHOTOS_PERSO = (await api("photos/perso")).perso || {};
    for (const id of Object.keys(PHOTOS_PERSO)) if (BY_ID[id]) majPhotosPerso(id);
  } catch {}
})();
function choisirPhotoCarte(c) {
  ouvrirModal(`<h2 style="margin-top:0">📷 Photo de « ${esc(c.nom)} »</h2>
    <div class="photo-perso-apercu">${cardHTML(c, { locked: false })}</div>
    <p class="muted">Envoyez votre propre photo pour cette carte : elle remplace la photo Wikipédia chez tous les joueurs. Format paysage conseillé, JPEG, PNG ou WebP ; l'image est réduite à 600 px et compressée automatiquement (environ 60 à 90 Ko).</p>
    <div class="row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap">
      ${PHOTOS_PERSO[c.id] ? `<button class="btn" id="ppSuppr">Revenir à la photo d'origine</button>` : ""}
      <label class="btn primary" style="cursor:pointer">Choisir une image<input type="file" id="ppFichier" accept="image/*" hidden></label></div>
    <p class="muted" id="ppEtat" style="margin-bottom:0"></p>`);
  $("#ppFichier").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $("#ppEtat").textContent = "Envoi en cours…";
    try {
      const image = await preparerVisuel(f, true);
      const r = await api("admin/photo-perso", { methode: "POST", corps: { carte: c.id, image } });
      PHOTOS_PERSO[c.id] = r.maj; majPhotosPerso(c.id); fermerModal(); toast("📷 Photo enregistrée pour tous les joueurs.");
    } catch (err) { $("#ppEtat").textContent = "⚠ " + err.message; }
  };
  const sup = $("#ppSuppr");
  if (sup) sup.onclick = async () => {
    try { await api("admin/photo-perso/" + c.id.replace(":", "~"), { methode: "DELETE" }); delete PHOTOS_PERSO[c.id]; majPhotosPerso(c.id); fermerModal(); toast("Photo d'origine rétablie."); }
    catch (err) { $("#ppEtat").textContent = "⚠ " + err.message; }
  };
}
// Pour l'admin, « Photo incorrecte ? » devient « Changer la photo »
const _signalerPhotoV3 = signalerPhoto;
signalerPhoto = function (c) { return COMPTE?.admin ? choisirPhotoCarte(c) : _signalerPhotoV3(c); };
const _ficheCarteV3 = ficheCarte;
ficheCarte = function (c) {
  const r = _ficheCarteV3.apply(this, arguments);
  const a = $("#signalerPhoto"); if (a && COMPTE?.admin) a.textContent = "📷 Changer la photo de cette carte";
  return r;
};
const _ficheCodexV3 = ficheCodex;
ficheCodex = async function (c) {
  const r = _ficheCodexV3.apply(this, arguments);
  if (c && !has(c.id) && COMPTE?.admin) { const f = $(".codex-fiche"); if (f) { f.insertAdjacentHTML("beforeend", `<button class="btn" id="cxPhoto">📷 Changer la photo</button>`); $("#cxPhoto").onclick = () => choisirPhotoCarte(c); } }
  return r;
};
// Onglet admin Photos : envoi direct d'une image pour n'importe quelle carte
const _adminPhotosV3 = adminPhotos;
adminPhotos = async function (el) {
  const r = _adminPhotosV3(el);
  el.insertAdjacentHTML("afterbegin", `<form class="panel form" id="fPhotoPerso" style="max-width:640px"><h3 style="margin:0">🖼️ Mettre ma propre photo sur une carte</h3>
    <label>Carte<input id="ppCarte" list="ppListe" placeholder="Tapez le nom de la carte…" required><datalist id="ppListe"></datalist></label>
    <button class="btn primary">Choisir la photo…</button>
    <p class="muted" style="margin:0;font-size:13px">${Object.keys(PHOTOS_PERSO).length} carte(s) avec une photo personnalisée. Astuce : depuis la fiche d'une carte, le lien « Changer la photo » fait la même chose.</p></form>`);
  $("#ppCarte").oninput = (e) => {
    const q = sansAccents(e.target.value);
    $("#ppListe").innerHTML = q.length < 2 ? "" : CARDS.filter((c) => sansAccents(c.nom).includes(q)).slice(0, 20).map((c) => `<option value="${esc(c.id)}">${esc(c.nom)} (${TYPES[c.type]})</option>`).join("");
  };
  $("#fPhotoPerso").onsubmit = (e) => {
    e.preventDefault();
    const v = $("#ppCarte").value.trim(), c = BY_ID[v] || CARDS.find((x) => sansAccents(x.nom) === sansAccents(v));
    if (!c) return toast("⚠ Carte introuvable : choisissez-la dans la liste.");
    choisirPhotoCarte(c);
  };
  return r;
};
