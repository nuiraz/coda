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
  ["Communauté", ["hub", "direct", "souhaits", "guilde", "encheres", "parrainage", "streamer"]],
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

/* =====================================================================
   Duels en direct : suivre le duel d'un ami ou d'un membre de sa guilde (2 tours de retard)
   ===================================================================== */
async function regarderDuel(id) {
  let m;
  try { m = await api(`duels/${id}/regarder`); } catch (e) { toast("⚠ " + e.message); return; }
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  lancerCombat({ titre: `👁 ${m.a} contre ${m.b}${m.statut === "encours" ? " · en direct" : ""}`, adversaire: m.b, moi: m.deckA, lui: m.deckB, graine: m.graine, spectateur: true,
    fin: async () => (m.gagnant === null ? "🏁 Duel terminé." : `🏁 ${m.gagnant === 0 ? m.a : m.b} remporte le duel.`),
    duel: { cote: 0, resteMs: 600000, abandon: async () => {}, tours: async (t) => {
      // On attend que le tour soit joué (et passé le petit différé anti-triche)
      for (let k = 0; k < 200; k++) {
        if (m.paires[t - 1]) return [m.paires[t - 1]];
        if (m.statut !== "encours") return [["attaque", "attaque"]];
        await attendre(3000);
        try { m = await api(`duels/${id}/regarder`); } catch { return [["attaque", "attaque"]]; }
      }
      return [["attaque", "attaque"]];
    } } });
  setTimeout(() => $("#cbAuto")?.click(), 600);
}
async function vueDirect(v) {
  v.innerHTML = `<header class="page-tete"><h1>📺 Duels en direct</h1><p>Suivez les duels en cours de vos amis et des membres de votre guilde. Les coups s'affichent avec 2 tours de retard, pour que personne ne puisse souffler la suite à un joueur.</p></header><section class="panel" id="drListe"><p class="muted">Chargement…</p></section>`;
  if (typeof connecte !== "function" || !connecte()) { $("#drListe").innerHTML = `<p>Connectez-vous pour voir les duels de vos amis.</p><button class="btn primary" onclick="aller('compte')">Se connecter</button>`; return; }
  const charger = async () => {
    const el = $("#drListe"); if (!el) return false;
    try {
      const { duels } = await api("duels/direct");
      el.innerHTML = duels.length ? `<ul class="dr-liste">${duels.map((d) => `<li><span class="dr-live">● EN DIRECT</span><b>${esc(d.a)}</b> <span class="muted">contre</span> <b>${esc(d.b)}</b>
          <small class="muted">${d.classe ? "Classé · " : ""}tour ${d.tours + 1}</small><button class="btn primary small" data-regarder="${d.id}">👁 Regarder</button></li>`).join("")}</ul>`
        : `<p class="muted">Aucun duel en cours chez vos amis pour le moment. La liste se met à jour toute seule.</p>`;
      $$("[data-regarder]", el).forEach((b) => b.onclick = () => regarderDuel(b.dataset.regarder));
    } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    return true;
  };
  await charger();
  const t = setInterval(async () => { if (S.vue !== "direct" || !(await charger())) clearInterval(t); }, 15000);
}
ajouterPage("direct", "📺", "Duels en direct", vueDirect);

/* =====================================================================
   Cartes recherchées : ma liste, les joueurs qui ont ces cartes en double, et ceux qui cherchent mes doublons
   ===================================================================== */
const estRecherchee = (id) => (S.souhaits || []).includes(id);
async function basculerSouhait(id) {
  if (typeof connecte !== "function" || !connecte()) { toast("Connectez-vous pour publier vos cartes recherchées."); return false; }
  const ajout = !estRecherchee(id);
  try {
    await api(`souhaits/${encodeURIComponent(id)}`, { methode: ajout ? "PUT" : "DELETE" });
    S.souhaits = ajout ? [...(S.souhaits || []), id] : (S.souhaits || []).filter((x) => x !== id); sauver();
    toast(ajout ? "⭐ Ajoutée à vos cartes recherchées : les joueurs qui l'ont en double vous seront proposés." : "Retirée de vos cartes recherchées.");
    return true;
  } catch (e) { toast("⚠ " + e.message); return false; }
}
const _ficheCarteV6 = ficheCarte;
ficheCarte = function (c) {
  const r = _ficheCarteV6.apply(this, arguments);
  const zone = $("#modal .detail .row") || $("#modal .detail");
  if (zone && c && c.type !== "secrete" && !$("#fcSouhait")) {
    const libelle = () => (estRecherchee(c.id) ? "✓ Dans mes recherches" : "⭐ Je la recherche");
    zone.insertAdjacentHTML("beforeend", `<button class="btn" id="fcSouhait">${libelle()}</button>`);
    $("#fcSouhait").onclick = async () => { if (await basculerSouhait(c.id)) $("#fcSouhait").textContent = libelle(); };
  }
  return r;
};
async function vueSouhaits(v) {
  v.innerHTML = `<header class="page-tete"><h1>🔎 Cartes recherchées</h1><p>Publiez les cartes qui vous manquent : le jeu vous montre les joueurs qui les ont en double, et ceux qui cherchent vos propres doublons. Il ne reste plus qu'à échanger !</p></header><div id="soCorps"><p class="muted">Chargement…</p></div>`;
  if (typeof connecte !== "function" || !connecte()) { $("#soCorps").innerHTML = `<section class="panel"><p>Connectez-vous pour publier vos cartes recherchées.</p><button class="btn primary" onclick="aller('compte')">Se connecter</button></section>`; return; }
  let d; try { d = await api("souhaits"); } catch (e) { $("#soCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  S.souhaits = d.souhaits.map((x) => x.carte); sauver();
  const el = $("#soCorps"); if (!el) return;
  const nomCarte = (id) => BY_ID[id] ? `${BY_ID[id].type === "pays" && BY_ID[id].code ? drapeau(BY_ID[id].code) : esc(BY_ID[id].emoji || "🃏")} <b>${esc(BY_ID[id].nom)}</b> <span class="rbadge" data-r="${BY_ID[id].rarete}">${RARETES[BY_ID[id].rarete]?.nom || ""}</span>` : esc(id);
  const joueur = (pseudo) => `<span class="so-joueur"><button class="lien-chances" data-profil="${esc(pseudo)}">${esc(pseudo)}</button><button class="btn small" data-echange="${esc(pseudo)}" title="Échange en direct (entre amis)">🤝</button></span>`;
  el.innerHTML = `<div class="so-grille">
    <section class="panel"><h3 style="margin-top:0">Mes cartes recherchées <small class="muted">${d.souhaits.length}/${d.max}</small></h3>
      <form class="row" id="soForm"><input id="soQ" list="soListe" placeholder="Ajouter une carte (nom)…" style="flex:1;min-width:180px" autocomplete="off"><datalist id="soListe"></datalist><button class="btn primary">Ajouter</button></form>
      ${d.souhaits.length ? `<ul class="so-liste">${d.souhaits.map((x) => `<li><div class="so-carte">${nomCarte(x.carte)}<button class="lien-chances" data-retirer="${esc(x.carte)}">retirer</button></div>
          ${x.joueurs.length ? `<div class="so-qui"><small class="muted">En double chez :</small> ${x.joueurs.map((j) => joueur(j.pseudo)).join("")}</div>` : `<small class="muted">Personne ne l'a en double pour l'instant.</small>`}</li>`).join("")}</ul>`
        : `<p class="muted">Aucune carte pour l'instant. Astuce : le bouton « ⭐ Je la recherche » est aussi sur la fiche de chaque carte.</p>`}</section>
    <section class="panel"><h3 style="margin-top:0">Ils cherchent vos doublons</h3>
      ${d.demandes.length ? `<ul class="so-liste">${d.demandes.map((x) => `<li><div class="so-carte">${nomCarte(x.carte)}</div><div class="so-qui"><small class="muted">Recherchée par :</small> ${joueur(x.pseudo)}</div></li>`).join("")}</ul>`
        : `<p class="muted">Personne ne cherche vos doublons pour le moment.</p>`}
      <p class="muted" style="font-size:13px">🤝 = échange en direct (entre amis). Sinon, ouvrez le profil du joueur pour l'ajouter en ami ou lui écrire.</p></section></div>`;
  $("#soQ").oninput = (e) => { const q = sansAccents(e.target.value); $("#soListe").innerHTML = q.length < 2 ? "" : CARDS.filter((c) => c.type !== "secrete" && sansAccents(c.nom).includes(q)).slice(0, 20).map((c) => `<option value="${esc(c.nom)}">`).join(""); };
  $("#soForm").onsubmit = async (e) => {
    e.preventDefault();
    const q = sansAccents($("#soQ").value.trim()), c = CARDS.find((x) => x.type !== "secrete" && sansAccents(x.nom) === q);
    if (!c) { toast("Choisissez une carte de la liste."); return; }
    if (!estRecherchee(c.id) && await basculerSouhait(c.id)) aller("souhaits");
  };
  $$("[data-retirer]", el).forEach((b) => b.onclick = async () => { if (await basculerSouhait(b.dataset.retirer)) aller("souhaits"); });
  $$("[data-profil]", el).forEach((b) => b.onclick = () => ouvrirProfil(b.dataset.profil));
  $$("[data-echange]", el).forEach((b) => b.onclick = () => proposerEchangeDirect(b.dataset.echange));
}
ajouterPage("souhaits", "🔎", "Cartes recherchées", vueSouhaits);

/* ---------- Admin : applis Android et iPhone (Google Play / App Store) ---------- */
async function adminApps(el) {
  let c = {}; try { c = await api("admin/apps"); } catch {}
  el.innerHTML = `<section class="panel"><h3 style="margin-top:0">📱 Applis Android et iPhone</h3>
    <p>Le jeu est déjà une application installable (PWA). Pour le publier sur les stores, le plus simple est <b>PWABuilder</b> (gratuit, de Microsoft) :</p>
    <ol class="na-regles">
      <li>Allez sur <b>pwabuilder.com</b>, entrez <b>https://play2f1.com</b> et lancez l'analyse.</li>
      <li><b>Android</b> : « Package for stores » → Android → téléchargez le paquet. Gardez précieusement le fichier de signature (<i>signing key</i>) qu'il contient. Créez un compte développeur Google Play (25 $ une fois), puis envoyez le fichier <code>.aab</code>.</li>
      <li>Copiez ci-dessous le <b>nom du paquet</b> et l'<b>empreinte SHA-256</b> donnés par PWABuilder (et celle de « Play App Signing » dans la console Google Play) : sans cela, l'appli affiche une barre d'adresse.</li>
      <li><b>iPhone</b> : « Package for stores » → iOS. Il faut un compte Apple Developer (99 $ par an) et un Mac avec Xcode pour envoyer l'appli. Apple refuse parfois les applis qui ne sont qu'un site : mettez en avant le jeu hors ligne et les notifications.</li>
    </ol>
    <form class="form" id="fApps" style="max-width:640px">
      <label>Nom du paquet Android<input name="paquet" value="${esc(c.paquet || "")}" placeholder="com.play2f1.app"></label>
      <label>Empreinte(s) SHA-256 du certificat (séparées par un espace)<input name="empreintes" value="${esc(c.empreintes || "")}" placeholder="AB:CD:…"></label>
      <label>Lien Google Play (quand l'appli est en ligne)<input name="android" value="${esc(c.android || "")}" placeholder="https://play.google.com/store/apps/details?id=…"></label>
      <label>Lien App Store<input name="ios" value="${esc(c.ios || "")}" placeholder="https://apps.apple.com/app/…"></label>
      <div class="row"><button class="btn primary">Enregistrer</button><a class="btn" href="/.well-known/assetlinks.json" target="_blank" rel="noopener">Vérifier assetlinks.json</a><span class="err" id="apErr"></span></div></form></section>`;
  const f = $("#fApps", el);
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("admin/apps", { methode: "PUT", corps: Object.fromEntries(new FormData(f)) }); toast("📱 Réglages des applis enregistrés."); }
    catch (err) { $("#apErr").textContent = err.message; }
  };
}
