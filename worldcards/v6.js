"use strict";
/* =====================================================================
   Play2F1 — v6 : nouvelle direction artistique (crème, rose, encre), accueil plus sobre
   avec les boosters à droite, menu « Plus » du mobile rangé par thèmes, mode d'ouverture
   ===================================================================== */

/* ---------- Accueil : un en-tête clair (texte à gauche, boosters à droite), le reste rangé dessous ---------- */
function ouvrirDepuisAccueil() {
  const k = Object.keys(PACKS).find((x) => S.boosters[x] > 0);
  if (k) return ouvrirBooster(k);
  if (gratuitDans() === 0 && typeof recupererGratuit === "function") return recupererGratuit();
  aller("boosters");
}
function heroAccueil() {
  const n = niveauJoueur(), pseudo = typeof COMPTE !== "undefined" && COMPTE.pseudo;
  const possedees = Object.keys(S.owned || {}).filter((id) => S.owned[id] > 0 && BY_ID[id]).length;
  const pays = Object.keys(S.owned || {}).filter((id) => S.owned[id] > 0 && id.startsWith("pays:")).length;
  const stock = Object.keys(PACKS).filter((k) => S.boosters[k] > 0), nb = stock.reduce((t, k) => t + S.boosters[k], 0);
  const attente = gratuitDans();
  const empile = (stock.length ? stock : ["monde"]).slice(0, 3);
  const el = document.createElement("section");
  el.className = "ec-hero";
  el.innerHTML = `<div class="ec-hero-txt">
      <p class="ec-kicker">${pseudo ? `Bonjour ${esc(pseudo)} ♡` : "Bienvenue, explorateur ♡"}</p>
      <h1>Collectionnez <em>le monde</em></h1>
      <p class="ec-intro">Pays, villes, monuments, animaux et merveilles : ouvrez vos boosters, complétez votre collection et affrontez les autres joueurs.</p>
      <div class="ec-actions"><button class="btn primary" id="ecOuvrir">${nb ? `Ouvrir un booster →` : attente === 0 ? "Récupérer mon booster gratuit →" : "Aller à la boutique →"}</button>
        <button class="btn btn-outline" id="ecCollection">Ma collection</button></div>
      <dl class="ec-stats"><div><dt>Cartes</dt><dd>${fmt(possedees)}<small> / ${fmt(CARDS.length)}</small></dd></div>
        <div><dt>Pays</dt><dd>${pays}<small> / 195</small></dd></div>
        <div><dt>Niveau</dt><dd>${n.niveau}</dd></div></dl>
    </div>
    <div class="ec-boosters">
      <span class="ec-blob" aria-hidden="true"></span><span class="leaf leaf-a" aria-hidden="true"></span><span class="leaf leaf-b" aria-hidden="true"></span>
      <button class="ec-pile" id="ecPile" aria-label="Ouvrir un booster">${empile.map((k, i) => `<span class="pack ${k} ec-p${i}" ${PACKS[k].couleur ? `style="--pc:${PACKS[k].couleur}"` : ""}><span class="big">${PACKS[k].emoji}</span><b>${esc(PACKS[k].nom)}</b></span>`).join("")}
        ${nb ? `<span class="ec-compte">${nb}</span>` : ""}</button>
      <p class="ec-note">${nb ? `${nb} booster${nb > 1 ? "s" : ""} vous attend${nb > 1 ? "ent" : ""} ♡` : attente === 0 ? "Un booster gratuit vous attend ♡" : `Prochain booster gratuit dans ${duree(attente)}`}</p>
      ${nb && attente === 0 ? `<p class="ec-sous">+ un booster gratuit à récupérer</p>` : nb ? `<p class="ec-sous">Booster gratuit dans ${duree(attente)}</p>` : ""}
    </div>`;
  $("#ecOuvrir", el).onclick = ouvrirDepuisAccueil;
  $("#ecPile", el).onclick = ouvrirDepuisAccueil;
  $("#ecCollection", el).onclick = () => aller("album");
  return el;
}
function refaireAccueil(v) {
  const ancienHero = $(".accueil-hero", v), ancienBooster = $(".accueil-booster", v);
  const hero = heroAccueil();
  v.prepend(hero);
  ancienHero?.remove(); ancienBooster?.remove();
  // Tutoriel et événements juste sous l'en-tête
  for (const sel of [".tuto", ".bandeau-bientot", ".bandeau-evenement:not(.bandeau-bientot)"]) { const x = $(sel, v); if (x) hero.after(x); }
  const ordreHaut = [hero, $(".tuto", v), $(".bandeau-evenement", v), $(".bandeau-bientot", v)].filter(Boolean);
  ordreHaut.reduce((prec, x) => { prec.after(x); return x; });
  // Les tuiles deviennent une rubrique « Explorer » plus discrète
  const tuiles = $(".tuiles", v);
  if (tuiles) {
    const sec = document.createElement("section"); sec.className = "ec-explorer";
    sec.innerHTML = `<div class="ec-tete"><h2>Explorer</h2><p class="muted">Tous les modes de jeu, en un coup d'œil</p></div>`;
    tuiles.before(sec); sec.appendChild(tuiles);
  }
  // Défis, quêtes, progression et cartes secrètes : rangés dans un volet à ouvrir
  const secondaires = [$(".accueil-grille", v)];
  const titres = $$(".sectiontitle", v), secretes = titres.find((t) => /secr[eè]t/i.test(t.textContent));
  if (secretes) secondaires.push(secretes, secretes.nextElementSibling);
  const restes = secondaires.filter(Boolean);
  if (restes.length) {
    const d = document.createElement("details"); d.className = "ec-plus panel";
    d.innerHTML = `<summary><span><b>Défis, quêtes et progression</b><small class="muted">Défis du jour, quêtes de la semaine, progression par continent, cartes secrètes</small></span></summary>`;
    v.appendChild(d); restes.forEach((x) => d.appendChild(x));
    try { if (localStorage.getItem("worldcards:accueil-plus") === "1") d.open = true; } catch {}
    d.addEventListener("toggle", () => { try { localStorage.setItem("worldcards:accueil-plus", d.open ? "1" : "0"); } catch {} });
  }
}
const _vueAccueilV6 = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV6.apply(this, arguments);
  try { refaireAccueil(v); } catch (e) { console.error(e); }
  return r;
};

/* ---------- Menu « Plus » du mobile : rangé par thèmes, bouton Fermer toujours visible, glisser pour fermer ---------- */
const GROUPES_PLUS = [
  ["Jouer", ["combat", "ligues", "defi", "samedi", "missions", "quiz", "expedition", "nations"]],
  ["Ma collection", ["album", "forge", "codex", "albums", "decks", "pays", "atlas", "collections", "badges", "succes", "stats"]],
  ["Communauté", ["hub", "guilde", "encheres", "parrainage", "streamer"]],
  ["Boutique et compte", ["boosters", "passe", "premium", "style", "soutenir", "compte", "langue", "admin"]],
];
ouvrirMenuPlus = function () {
  const admin = typeof COMPTE !== "undefined" && COMPTE.admin;
  const n = niveauJoueur(), pseudo = typeof COMPTE !== "undefined" && COMPTE.pseudo;
  const dest = Object.fromEntries([...DESTINATIONS, ...(admin ? [["admin", "👑", "Admin"]] : [])].map((d) => [d[0], d]));
  const dejaRanges = new Set(GROUPES_PLUS.flatMap(([, l]) => l));
  const autres = Object.keys(dest).filter((k) => !dejaRanges.has(k) && !ONGLETS_MOBILE.includes(k));
  const bouton = (k) => { const d = dest[k]; if (!d || (ONGLETS_MOBILE.includes(k) && k !== "boosters")) return ""; const ic = typeof ICONES !== "undefined" && ICONES[k] ? svgIcone(k) : `<i class="mp-emoji">${d[1]}</i>`;
    return `<button data-mp="${k}" class="${S.vue === k ? "on" : ""}">${ic}<span>${esc(d[2])}</span></button>`; };
  const groupes = [...GROUPES_PLUS, ...(autres.length ? [["Autres", autres]] : [])]
    .map(([t, l]) => { const h = l.map(bouton).join(""); return h ? `<section class="mp-groupe"><h3>${t}</h3><div class="mp-liste">${h}</div></section>` : ""; }).join("");
  ouvrirModal(`<div class="menu-plus2">
    <div class="mp-poignee" aria-hidden="true"></div>
    <header class="mp-tete"><span class="avatar">${pseudo ? esc(pseudo[0].toUpperCase()) + avImg(pseudo) : "🌐"}</span>
      <div><b>${pseudo ? esc(pseudo) : "Invité"}${premium() ? " 💎" : ""}</b><small class="muted">Niveau ${n.niveau} · ${fmt(S.coins)} 🪙</small></div>
      <button class="mp-fermer" data-close aria-label="Fermer le menu">✕</button></header>
    <div class="mp-corps">${groupes}
      <section class="mp-groupe"><h3>Aide</h3><div class="mp-liste">
        <button data-mp-act="feedback"><i class="mp-emoji">💡</i><span>Idée ou bug</span></button>
        <button data-mp-act="reglages"><i class="mp-emoji">⚙︎</i><span>Réglages</span></button>
        ${typeof PWA !== "undefined" && !PWA.installee ? `<button data-mp-act="installer"><i class="mp-emoji">📲</i><span>Installer l'app</span></button>` : ""}
        <button data-mp-act="discord"><i class="mp-emoji">💬</i><span>Discord</span></button></div></section>
      <p class="muted mp-pied">${$("#nbEnLigne")?.textContent || "…"} joueurs en ligne · ${VERSION_JEU}</p></div>
    <button class="btn mp-fermer-bas" data-close>Fermer</button></div>`);
  const m = $("#modal");
  m.classList.add("feuille", "feuille-plus");
  $(".box > .close", m)?.remove(); // la croix est dans l'en-tête du menu, toujours visible
  $$("[data-mp]", m).forEach((b) => b.onclick = () => { fermerModal(); aller(b.dataset.mp); });
  $$("[data-mp-act]", m).forEach((b) => b.onclick = () => (b.dataset.mpAct === "discord" ? (fermerModal(), typeof ouvrirDiscord === "function" && ouvrirDiscord()) : actionMenu(b.dataset.mpAct)));
  // Glisser l'en-tête vers le bas pour fermer
  const box = $(".box", m), tete = $(".mp-tete", m), poignee = $(".mp-poignee", m);
  let y0 = null;
  const debut = (e) => { y0 = e.touches ? e.touches[0].clientY : e.clientY; box.style.transition = "none"; };
  const bouge = (e) => { if (y0 === null) return; const dy = Math.max(0, (e.touches ? e.touches[0].clientY : e.clientY) - y0); box.style.transform = `translateY(${dy}px)`; };
  const fin = (e) => { if (y0 === null) return; const dy = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - y0; y0 = null; box.style.transition = ""; box.style.transform = ""; if (dy > 90) fermerModal(); };
  for (const el of [tete, poignee]) { el.addEventListener("touchstart", debut, { passive: true }); el.addEventListener("touchmove", bouge, { passive: true }); el.addEventListener("touchend", fin); }
};

/* ---------- Mode d'ouverture des boosters (sur la table ou une par une) ---------- */
const _vueBoostersV6 = vueBoosters;
vueBoosters = function (v) {
  const r = _vueBoostersV6.apply(this, arguments);
  const hero = $(".booster-hero", v);
  if (hero && !$(".mode-ouverture", hero)) {
    const table = S.modeOuverture !== "une";
    hero.insertAdjacentHTML("beforeend", `<div class="mode-ouverture" role="group" aria-label="Mode d'ouverture"><span class="muted">Ouverture :</span>
      <button class="chip ${table ? "on" : ""}" data-mode="table">🃏 Toutes les cartes sur la table</button><button class="chip ${table ? "" : "on"}" data-mode="une">Une par une</button></div>`);
    $$("[data-mode]", hero).forEach((b) => b.onclick = () => { S.modeOuverture = b.dataset.mode; sauver(); aller("boosters"); });
  }
  return r;
};
