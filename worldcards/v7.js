"use strict";
/* =====================================================================
   Play2F1 — v7 : marché d'échange automatique, défi photo du jour, combat express du jour
   ===================================================================== */
const attendreCompte = async () => { for (let i = 0; i < 40 && typeof COMPTE !== "undefined" && COMPTE.etat === "inconnu"; i++) await new Promise((r) => setTimeout(r, 100)); };
const estConnecte = () => typeof connecte === "function" && connecte();
const blocConnexion = (txt) => `<section class="panel"><p>${txt}</p><button class="btn primary" onclick="aller('compte')">Se connecter</button></section>`;
const miniCarte = (id) => { const c = BY_ID[id]; if (!c) return esc(id); return `<span class="mc r-${c.rarete}">${c.type === "pays" && c.code ? `<img src="flags/${c.code.toLowerCase()}.svg" alt="">` : `<i>${esc(c.emoji || "🃏")}</i>`}<b>${esc(c.nom)}</b><small>${RARETES[c.rarete]?.nom || ""}</small></span>`; };
function retirerCarteLocale(id) {
  if (!S.owned[id]) return false;
  S.owned[id]--; if (!S.owned[id]) { delete S.owned[id]; S.deck = (S.deck || []).filter((x) => x !== id); }
  sauver(); return true;
}

/* ---------- Marché d'échange ---------- */
async function vueMarche(v) {
  v.innerHTML = `<header class="page-tete"><h1>🔄 Marché d'échange</h1><p>Le jeu compare vos doublons et vos <a href="#" data-aller="souhaits">cartes recherchées</a> avec ceux des autres joueurs, et vous propose des échanges équitables. La carte proposée est mise de côté jusqu'à la réponse (3 jours au plus), puis rendue si l'échange ne se fait pas.</p></header><div id="maCorps"><p class="muted">Chargement…</p></div>`;
  brancherLiens(v);
  await attendreCompte();
  if (!estConnecte()) { $("#maCorps").innerHTML = blocConnexion("Connectez-vous pour échanger des cartes."); return; }
  let s, pr; try { [s, pr] = await Promise.all([api("marche/suggestions"), api("marche/propositions")]); } catch (e) { $("#maCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const el = $("#maCorps"); if (!el) return;
  const recues = pr.propositions.filter((x) => x.moi === "recue" && x.statut === "ouverte"), envoyees = pr.propositions.filter((x) => x.moi === "envoyee");
  const STATUTS = { ouverte: "⏳ En attente", acceptee: "✅ Acceptée", refusee: "❌ Refusée", annulee: "Annulée", expiree: "⌛ Expirée" };
  el.innerHTML = `${recues.length ? `<section class="panel ma-recues"><h3 style="margin-top:0">📨 Propositions reçues (${recues.length})</h3>${recues.map((x) => `<div class="ma-ligne"><div class="ma-echange"><span class="muted">${esc(x.de)} vous donne</span>${miniCarte(x.donne)}<span class="ma-fleche">⇄</span><span class="muted">contre votre</span>${miniCarte(x.recoit)}</div>
        <div class="row"><button class="btn primary small" data-accepter="${x.id}">✅ Accepter</button><button class="btn small" data-refuser="${x.id}">Refuser</button></div></div>`).join("")}</section>` : ""}
    <section class="panel"><h3 style="margin-top:0">💡 Échanges suggérés</h3>
      ${s.suggestions.length ? s.suggestions.map((x, i) => `<div class="ma-ligne"><div class="ma-echange"><span class="muted">Vous donnez</span>${miniCarte(x.donne)}<span class="ma-fleche">⇄</span><span class="muted">${esc(x.pseudo)} donne</span>${miniCarte(x.recoit)}${x.equitable ? `<span class="rbadge" data-r="peu-commun">Équitable</span>` : `<span class="rbadge">${x.ecart > 0 ? "Vous donnez plus rare" : "Vous recevez plus rare"}</span>`}</div>
          <button class="btn primary small" data-proposer="${i}">Proposer</button></div>`).join("")
        : `<p class="muted">Aucun échange croisé pour l'instant. ${s.souhaits ? "" : "Commencez par ajouter des cartes à vos <a href='#' data-aller='souhaits'>cartes recherchées</a>."} Il faut qu'un joueur ait en double une carte que vous cherchez, et cherche une carte que vous avez en double (vous en avez ${s.doubles}).</p>`}</section>
    ${envoyees.length ? `<section class="panel"><h3 style="margin-top:0">📤 Mes propositions</h3>${envoyees.map((x) => `<div class="ma-ligne"><div class="ma-echange">${miniCarte(x.donne)}<span class="ma-fleche">⇄</span>${miniCarte(x.recoit)}<span class="muted">avec ${esc(x.a)} · ${STATUTS[x.statut] || x.statut}</span></div>
        ${x.statut === "ouverte" ? `<button class="btn small" data-annuler="${x.id}">Annuler</button>` : ""}</div>`).join("")}</section>` : ""}`;
  brancherLiens(el);
  $$("[data-proposer]", el).forEach((b) => b.onclick = async () => {
    const x = s.suggestions[Number(b.dataset.proposer)];
    if (!confirm(`Proposer à ${x.pseudo} : votre « ${BY_ID[x.donne]?.nom} » contre son « ${BY_ID[x.recoit]?.nom} » ?\nVotre carte est mise de côté jusqu'à sa réponse.`)) return;
    b.disabled = true;
    try { await envoyerSauvegarde?.(); await api("marche/proposer", { methode: "POST", corps: { pseudo: x.pseudo, donne: x.donne, recoit: x.recoit } }); retirerCarteLocale(x.donne); toast("🔄 Proposition envoyée !"); aller("marche"); }
    catch (e) { toast("⚠ " + e.message); b.disabled = false; }
  });
  const agir = (sel, action, apres) => $$(`[data-${sel}]`, el).forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { const r = await api(`marche/propositions/${b.dataset[sel]}/${action}`, { methode: "POST", corps: {} }); await apres?.(r); aller("marche"); }
    catch (e) { toast("⚠ " + e.message); b.disabled = false; }
  });
  agir("accepter", "accepter", async (r) => { retirerCarteLocale(r.donne); toast("🤝 " + esc(r.message)); await verifierLivraisons(); });
  agir("refuser", "refuser", () => toast("Proposition refusée."));
  agir("annuler", "annuler", async () => { toast("Proposition annulée : votre carte revient."); await verifierLivraisons(); });
}
ajouterPage("marche", "🔄", "Marché d'échange", vueMarche);

/* ---------- Défi photo du jour ---------- */
const CLE_PHOTO = "worldcards:defi-photo";
const ZOOMS_PHOTO = [4, 3, 2.3, 1.7, 1.3, 1, 1];
async function vuePhoto(v) {
  v.innerHTML = `<header class="page-tete"><h1>📷 Défi photo</h1><p>Quel est ce monument ? La photo est très zoomée au début et se dévoile à chaque essai. 6 essais, un nouveau monument chaque jour à minuit.</p></header><div id="phCorps"><p class="muted">Chargement…</p></div>`;
  await attendreCompte();
  let d; try { d = await api("defi-photo"); } catch (e) { $("#phCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const local = !estConnecte();
  if (local) { try { const l = JSON.parse(localStorage.getItem(CLE_PHOTO)); if (l?.jour === d.jour) Object.assign(d, l); else d.essais = []; } catch { d.essais = []; } }
  const noms = Object.fromEntries(d.noms), parNom = new Map(d.noms.map(([id, n]) => [sansAccents(n), id]));
  // Point de zoom du jour (le même pour tous)
  const h = COMBAT.hash("photo-focus:" + d.jour), fx = 25 + (h % 50), fy = 25 + ((h >> 8) % 50);
  const dessiner = () => {
    const el = $("#phCorps"); if (!el) return;
    const zoom = d.fini ? 1 : ZOOMS_PHOTO[d.essais.length];
    el.innerHTML = `<div class="df-grille"><section class="panel df-jeu">
        <div class="df-num">Défi photo n° ${d.numero}</div>
        <div class="ph-cadre ${d.fini ? (d.gagne ? "gagne" : "perdu") : ""}"><img src="${PHOTO_SECOURS?.j === d.jour ? PHOTO_SECOURS.u : `/api/defi-photo/image?j=${d.jour}`}" data-j="${d.jour}" alt="Monument mystère" style="transform:scale(${zoom});transform-origin:${fx}% ${fy}%" onerror="secoursPhotoDuJour(this)"></div>
        <div class="ph-indices">${d.indices?.continent ? `<span class="chip">🌍 ${esc(d.indices.continent)}</span>` : `<span class="chip muted">🌍 Continent au 2e essai</span>`}${d.indices?.pays ? `<span class="chip">${drapeau(d.indices.pays.code)} ${esc(d.indices.pays.nom)}</span>` : `<span class="chip muted">🏳️ Pays au 4e essai</span>`}</div>
        <ol class="ph-essais">${d.essais.map((id) => `<li class="${d.solution?.id === id ? "juste" : ""}">${d.solution?.id === id ? "✅" : "❌"} ${esc(noms[id] || id)}</li>`).join("")}</ol>
        ${d.fini ? `<div class="df-fin"><h3>${d.gagne ? `🎉 Trouvé en ${d.essais.length} essai${d.essais.length > 1 ? "s" : ""} !` : "😢 Perdu pour aujourd'hui"}</h3><p>C'était <b>${esc(d.solution.nom)}</b>${BY_ID[d.solution.id] ? ` <button class="lien-chances" id="phFiche">voir la carte</button>` : ""}.</p>${d.recompense ? `<p class="sc-ok">+${d.recompense} 🪙</p>` : ""}
            <button class="btn primary" id="phPartager">📤 Partager</button></div>`
          : `<form class="df-form" id="phForm"><input id="phQ" list="phListe" placeholder="Nom du monument…" autocomplete="off" required><datalist id="phListe"></datalist><button class="btn primary">Deviner (${d.essais.length + 1}/${d.essaisMax})</button></form><p class="err" id="phErr"></p>`}
      </section>
      <aside class="panel df-cote"><h3 style="margin-top:0">🏆 Classement du jour</h3>${d.top.length ? `<ol class="df-top">${d.top.map((x) => `<li><b>${esc(x.pseudo)}</b><span>${x.n}/6</span></li>`).join("")}</ol>` : `<p class="muted">Personne n'a encore trouvé. À vous !</p>`}
        <p class="muted" style="font-size:13px">Avec un compte : ${d.recompenses.slice(1).map((r, i) => `${i + 1} essai${i ? "s" : ""} ${r} 🪙`).join(" · ")}</p></aside></div>`;
    $("#phFiche")?.addEventListener("click", () => ficheCarte(BY_ID[d.solution.id]));
    $("#phPartager")?.addEventListener("click", () => {
      const t = `📷 Play2F1 · Défi photo n° ${d.numero} — ${d.gagne ? d.essais.length : "X"}/6\n${d.essais.map((id) => (id === d.solution?.id ? "🟩" : "🟥")).join("")}\nhttps://play2f1.com/#photo`;
      (navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t).then(() => toast("📋 Résultat copié !"))).catch(() => {});
    });
    const f = $("#phForm");
    if (!f) return;
    $("#phQ").oninput = (e) => { const q = sansAccents(e.target.value); $("#phListe").innerHTML = q.length < 2 ? "" : d.noms.filter(([, n]) => sansAccents(n).includes(q)).slice(0, 15).map(([, n]) => `<option value="${esc(n)}">`).join(""); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const id = parNom.get(sansAccents($("#phQ").value.trim()));
      if (!id) { $("#phErr").textContent = "Choisissez un monument de la liste."; return; }
      if (d.essais.includes(id)) { $("#phErr").textContent = "Déjà proposé."; return; }
      f.querySelector("button").disabled = true;
      try {
        const r = await api("defi-photo/essai", { methode: "POST", corps: { id, numero: d.essais.length + 1 } });
        d.essais = r.essais || [...d.essais, id];
        Object.assign(d, { fini: r.fini, gagne: r.gagne, solution: r.solution, indices: r.indices, recompense: r.recompense || 0 });
        if (local) try { localStorage.setItem(CLE_PHOTO, JSON.stringify({ jour: d.jour, essais: d.essais, fini: d.fini, gagne: d.gagne, solution: d.solution, indices: d.indices })); } catch {}
        if (r.gagne && r.recompense && typeof verifierCadeaux === "function") verifierCadeaux();
        dessiner();
      } catch (err) { $("#phErr").textContent = err.message; f.querySelector("button").disabled = false; }
    };
  };
  dessiner();
}
ajouterPage("photo", "📷", "Défi photo", vuePhoto);

/* ---------- Combat express du jour ---------- */
async function vueExpress(v) {
  v.innerHTML = `<header class="page-tete"><h1>⚡ Combat express</h1><p>Chaque jour, le même deck adverse pour tout le monde. Votre deck l'affronte en combat automatique (environ 30 secondes). 3 essais : seul votre meilleur score compte au classement.</p></header><div id="exCorps"><p class="muted">Chargement…</p></div>`;
  await attendreCompte();
  let d; try { d = await api("express"); } catch (e) { $("#exCorps").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const el = $("#exCorps"); if (!el) return;
  const essais = d.moi?.essais || 0, deckOk = (S.deck || []).length === COMBAT.TAILLE_DECK;
  el.innerHTML = `<div class="df-grille"><section class="panel">
      <h3 style="margin-top:0">Adversaire du jour n° ${d.numero}</h3>
      <div class="ex-deck">${d.adversaire.map((u) => `<div class="ex-u r-${BY_ID[u.id]?.rarete || ""}">${miniCarte(u.id)}<small>⚔️ ${u.atk} · 🛡️ ${u.def} · ❤️ ${u.pv}</small></div>`).join("")}</div>
      <div class="ex-action">${!estConnecte() ? blocConnexion("Connectez-vous pour participer au classement.")
        : !deckOk ? `<p>Il vous faut un deck complet de ${COMBAT.TAILLE_DECK} cartes.</p><button class="btn primary" onclick="aller('combat')">Préparer mon deck</button>`
        : essais >= d.essaisMax ? `<p class="muted">Vos 3 essais du jour sont utilisés. Meilleur score : <b>${d.moi.score}</b>. Revenez demain !</p>`
        : `<button class="btn primary" id="exGo">⚡ Lancer le combat (${essais + 1}/${d.essaisMax})</button>${d.moi ? `<p class="muted">Meilleur score aujourd'hui : <b>${d.moi.score}</b></p>` : ""}<p class="muted" style="font-size:13px">Astuce : changez votre deck entre deux essais pour contrer celui du jour.</p>`}</div></section>
    <aside class="panel df-cote"><h3 style="margin-top:0">🏆 Classement du jour</h3>${d.top.length ? `<ol class="df-top">${d.top.map((x) => `<li><b>${esc(x.pseudo)}</b><span>${x.score}${x.gagne ? " ✅" : ""}</span></li>`).join("")}</ol>` : `<p class="muted">Aucun score pour l'instant.</p>`}
      <p class="muted" style="font-size:13px">Score : victoire +1 000, chaque K.O. infligé +120, chaque K.O. subi −40, bonus de rapidité. Première victoire du jour : +150 🪙.</p></aside></div>`;
  $("#exGo")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      await envoyerSauvegarde?.();
      const r = await api("express/jouer", { methode: "POST", corps: { deck: S.deck } });
      lancerCombat({ titre: `⚡ Combat express n° ${d.numero}`, adversaire: "Deck du jour", moi: r.deckA, lui: r.deckB, graine: r.graine, spectateur: true,
        fin: async () => `${r.gagne ? "🏆 Victoire !" : "Défaite."} Score : <b>${r.score}</b> (meilleur : ${r.meilleur}) · ${r.rang}${r.rang > 1 ? "e" : "er"} du jour${r.gagne ? " · +150 🪙 si c'est votre première victoire du jour" : ""}`,
        duel: { cote: 0, resteMs: 600000, abandon: async () => {}, tours: async (t) => [r.paires[t - 1] || ["attaque", "attaque"]] } });
      setTimeout(() => $("#cbAuto")?.click(), 500);
      if (r.gagne && typeof verifierCadeaux === "function") setTimeout(verifierCadeaux, 4000);
    } catch (err) { toast("⚠ " + err.message); e.target.disabled = false; }
  });
}
ajouterPage("express", "⚡", "Combat express", vueExpress);

// Menu « Plus » et accueil : les nouveaux modes
if (typeof GROUPES_PLUS !== "undefined") {
  GROUPES_PLUS[0][1].splice(3, 0, "photo", "express");
  GROUPES_PLUS[2][1].splice(1, 0, "marche");
}
const _vueAccueilV7 = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV7.apply(this, arguments);
  const t = $(".tuiles", v);
  if (t && !$("#tuilePhoto", v)) {
    $("#tuileDefi", v)?.insertAdjacentHTML("afterend", `<button class="tuile" id="tuilePhoto"><span class="t-ic">📷</span><span class="t-txt"><b>Défi photo</b><small>Quel est ce monument ?</small></span></button>
      <button class="tuile" id="tuileExpress"><span class="t-ic">⚡</span><span class="t-txt"><b>Combat express</b><small>Le deck du jour, 3 essais</small></span></button>
      <button class="tuile" id="tuileMarche"><span class="t-ic">🔄</span><span class="t-txt"><b>Marché d'échange</b><small>Échanges suggérés</small></span></button>`);
    $("#tuilePhoto").onclick = () => aller("photo"); $("#tuileExpress").onclick = () => aller("express"); $("#tuileMarche").onclick = () => aller("marche");
  }
  return r;
};

/* =====================================================================
   Devinettes : devinez un pays, une ville, un monument, un plat, un animal…
   On choisit la catégorie et le mode ; les indices se dévoilent un par un (moins d'indices = plus de points).
   ===================================================================== */
const CATS_DEVINE = [
  ["tout", "🎲", "Tout mélangé"], ["pays", "🏳️", "Pays"], ["ville", "🏙️", "Villes"], ["monument", "🏛️", "Monuments"],
  ["nature", "🏔️", "Nature"], ["animal", "🐾", "Animaux"], ["plat", "🍜", "Plats"], ["culture", "🎭", "Culture"],
  ["drapeau", "🚩", "Drapeaux"], ["sport", "⚽", "Sport"], ["invention", "💡", "Inventions"], ["personnage", "👤", "Personnages"],
];
// Banque de devinettes écrites (indépendantes des cartes), chargée à la demande :
// { cat: [[réponse, [3 leurres], [3 indices du plus dur au plus facile], explication], …] }
let BANQUE_DEVINE = null, DEVINE_PERSO = {};
function chargerBanqueDevine(forcer) {
  if (!forcer && (BANQUE_DEVINE || chargerBanqueDevine.p)) return chargerBanqueDevine.p;
  chargerBanqueDevine.p = Promise.all([
    BANQUE_DEVINE ? null : fetch(`data/devinettes.json?v=${VERSION_JEU}`).then((r) => r.json()).then((d) => { BANQUE_DEVINE = d; }).catch(() => { BANQUE_DEVINE = {}; }),
    api(forcer ? `devinettes/perso?t=${Date.now()}` : "devinettes/perso").then((d) => { DEVINE_PERSO = d.perso || {}; }).catch(() => {}),
  ]);
  return chargerBanqueDevine.p;
}
const CATS_BANQUE = ["pays", "ville", "monument", "nature", "animal", "plat", "culture", "drapeau", "sport", "invention", "personnage"];
// Une devinette avec les modifications de l'admin appliquées
function devinetteDe(id, cat, e, admin) {
  const m = DEVINE_PERSO[id] || {}, d = m.donnees || e;
  if (!d) return null;
  return { id, nom: d[0], leurres: d[1], indices: d[2], anecdote: d[3] || "", banque: cat, wiki: m.wiki || "", img: m.img || 0, sansImage: !!m.sansImage, masque: !!m.masque, modifiee: !!DEVINE_PERSO[id], creee: id.startsWith("dvp:") };
}
// Toutes les devinettes d'une catégorie (admin : y compris les masquées)
const banqueDevine = (cat, admin) => {
  const B = BANQUE_DEVINE || {}, cats = cat === "tout" ? CATS_BANQUE : [cat];
  const liste = cats.flatMap((k) => (B[k] || []).map((e, i) => devinetteDe(`dv:${k}:${i}`, k, e)));
  for (const [id, m] of Object.entries(DEVINE_PERSO)) if (id.startsWith("dvp:") && cats.includes(m.cat)) liste.push(devinetteDe(id, m.cat, null));
  return liste.filter((x) => x && (admin || !x.masque));
};
const PIECES_DEVINE_JOUR = 400, QUESTIONS_DEVINE = 10, DUREE_CHRONO = 60;
const devine = { cat: "tout", mode: "classique", partie: null };
const poolDevine = (cat) => CARDS.filter((c) => !c.saisonnier && !["secrete", "merveille"].includes(c.type) && (cat === "tout" || c.type === cat) && (c.anecdote || c.type === "pays"));
const masquerNom = (texte, c) => {
  let t = String(texte || "");
  for (const mot of [c.nom, ...c.nom.split(/[\s'’-]+/).filter((m) => m.length > 3)]) t = t.replace(new RegExp(mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "…");
  return t;
};
// Image d'une devinette : drapeau pour les drapeaux, photo de la carte, sinon l'illustration Wikipédia
/* Images Wikipédia : si le serveur ne peut pas les fournir, le navigateur les cherche lui-même
   (même méthode que les photos des cartes). */
const IMAGES_WIKI = {};
function imageWiki(titre, taille = 640) {
  const cherche = (p) => requeteWiki({ prop: "pageimages", piprop: "thumbnail", pithumbsize: String(taille), ...p }).then((j) => j.query?.pages?.find((x) => x.thumbnail)?.thumbnail?.source || null);
  return (IMAGES_WIKI[titre + "|" + taille] ||= cherche({ redirects: "1", titles: titre })
    .then((u) => u || cherche({ generator: "search", gsrsearch: titre, gsrlimit: "1" })).catch(() => null));
}
function secoursImage(img) {
  const titre = img.dataset.wiki;
  if (!titre || img.dataset.secours) { (img.closest(".dv-photo, .de-apercu-img") || img).remove(); return; }
  img.dataset.secours = "1";
  imageWiki(titre).then((u) => { if (u) img.src = u; else (img.closest(".dv-photo, .de-apercu-img") || img).remove(); });
}
let PHOTO_SECOURS = null;
async function secoursPhotoDuJour(img) {
  const raté = () => img.replaceWith(Object.assign(document.createElement("p"), { className: "muted ph-erreur", textContent: "La photo du jour ne se charge pas. Réessayez dans un instant." }));
  if (img.dataset.secours) return raté();
  img.dataset.secours = "1";
  try {
    const { t } = await api("defi-photo/source");
    const u = await imageWiki(new TextDecoder().decode(Uint8Array.from(atob(t), (c) => c.charCodeAt(0))), 900);
    if (u) { PHOTO_SECOURS = { j: img.dataset.j, u }; img.src = u; } else raté();
  } catch { raté(); }
}
function imageDevine(c) {
  if (c.banque === "drapeau" || c.type === "pays") {
    const cle = (n) => sansAccents(n).replace(/[^a-z]/g, ""), code = c.code || Object.keys(NOM_PAYS).find((k) => cle(NOM_PAYS[k]) === cle(c.nom));
    if (code) return `flags/${code.toLowerCase()}.svg`;
  }
  if (c.img) return `/api/devinette-image/${c.id.replaceAll(":", "~")}?v=${c.img}`;
  if (c.sansImage) return "";
  return (!c.banque && typeof photoDe === "function" && photoDe(c.id)) || `/api/devine/image?t=${encodeURIComponent(c.wiki || c.nom)}`;
}
const imgDevine = (c, cls = "dv-photo") => { const u = imageDevine(c); return u ? `<div class="${cls}"><img src="${esc(u)}" alt="" loading="lazy" ${u.startsWith("/api/devine/image") ? `data-wiki="${esc(c.wiki || c.nom)}" ` : ""}onerror="secoursImage(this)"></div>` : ""; };
function indicesDevine(c) {
  if (c.banque) return c.indices.map((t, i) => `<p class="dv-texte">${esc(t)}</p>${i === 2 && (c.banque !== "drapeau" || c.img) ? imgDevine(c) : ""}`);
  const cont = CONTINENTS[c.continent], pays = c.pays && NOM_PAYS[c.pays];
  const premier = c.type === "pays"
    ? `<div class="dv-sil">${silhouette(c.code) || ""}</div><p>Un pays d'${esc(cont?.nom || "?")}</p>`
    : `<p class="dv-texte">${esc(TYPES[c.type])}${pays ? ` · ${drapeau(c.pays)} ${esc(pays)}` : cont ? ` · ${esc(cont.nom)}` : ""}</p>`;
  const anecdote = `<p class="dv-anecdote">« ${esc(masquerNom(c.anecdote, c))} »</p>`;
  const troisieme = c.type === "pays" ? `<p>Sa capitale : <b>${esc(c.capitale || "?")}</b></p>`
    : `${imgDevine(c)}<p>Première lettre : <b>${esc(c.nom[0])}</b> · ${c.nom.length} lettres</p>`;
  return [premier, anecdote, troisieme];
}
function questionDevine(cat, deja) {
  // 3 questions sur 4 viennent de la banque de devinettes écrites, le reste des cartes
  const banque = banqueDevine(cat), cartes = poolDevine(cat);
  const banqueLibre = banque.filter((x) => !deja.has(x.id));
  if (banque.length && (!cartes.length || (banqueLibre.length && Math.random() < 0.75))) {
    const c = pick(banqueLibre.length ? banqueLibre : banque);
    return { c, choix: [c, ...c.leurres.map((n) => ({ id: "f:" + n, nom: n }))].sort(() => Math.random() - 0.5) };
  }
  const pool = cartes;
  const libres = pool.filter((c) => !deja.has(c.id)), c = pick(libres.length ? libres : pool);
  // Les mauvaises réponses : même type, de préférence du même continent (plus difficile)
  const memeType = pool.filter((x) => x.type === c.type && x.id !== c.id && x.nom !== c.nom);
  const proches = memeType.filter((x) => x.continent === c.continent);
  const leurres = [];
  for (const l of [proches, memeType]) while (leurres.length < 3 && l.length > leurres.length) { const x = pick(l); if (!leurres.includes(x) && x.nom !== c.nom) leurres.push(x); }
  return { c, choix: [c, ...leurres.slice(0, 3)].sort(() => Math.random() - 0.5) };
}
function piecesDevine(n) {
  const j = today();
  if (!S.devineJour || S.devineJour.d !== j) S.devineJour = { d: j, pieces: 0 };
  const g = Math.max(0, Math.min(n, PIECES_DEVINE_JOUR - S.devineJour.pieces));
  S.devineJour.pieces += g; S.coins += g; return g;
}
function vueDevine(v) {
  if (!BANQUE_DEVINE) { v.innerHTML = `<p class="muted" style="text-align:center;padding:40px">Chargement des devinettes…</p>`; chargerBanqueDevine().then(() => { if (S.vue === "devine") aller("devine"); }); return; }
  const p = devine.partie;
  if (!p) {
    const rec = S.devineRecords || {};
    v.innerHTML = `<header class="page-tete"><h1>🧠 Devinettes</h1><p>Pays, villes, drapeaux, plats, animaux, inventions, personnages… Les indices se dévoilent un par un : moins vous en utilisez, plus vous marquez de points.</p></header>
      <div id="dvJour"></div><div id="dvDefi"></div>
      <section class="panel dv-choix"><h3 style="margin-top:0">1. Choisissez une catégorie</h3>
        <div class="dv-cats">${CATS_DEVINE.map(([k, ic, n]) => `<button class="dv-cat ${devine.cat === k ? "on" : ""}" data-cat="${k}"><span>${ic}</span><b>${n}</b><small>${banqueDevine(k).length + poolDevine(k).length} devinettes${rec[`classique:${k}`] ? ` · record ${rec[`classique:${k}`]}` : ""}</small></button>`).join("")}</div>
        <h3>2. Choisissez le mode</h3>
        <div class="dv-modes"><button class="dv-mode ${devine.mode === "classique" ? "on" : ""}" data-mode="classique"><b>🎯 Classique</b><small>${QUESTIONS_DEVINE} questions, jusqu'à 3 indices chacune</small></button>
          <button class="dv-mode ${devine.mode === "chrono" ? "on" : ""}" data-mode="chrono"><b>⏱️ Contre la montre</b><small>${DUREE_CHRONO} secondes, un maximum de bonnes réponses</small></button></div>
        <button class="btn primary" id="dvGo" style="margin-top:16px;width:100%">C'est parti !</button>
        <button class="btn" id="dvDefier" style="margin-top:8px;width:100%">Défier mes amis sur cette catégorie</button>${COMPTE.admin ? `<button class="btn" data-aller="devine-admin" style="margin-top:8px;width:100%">Gérer les devinettes (admin)</button>` : ""}
        <p class="muted" style="font-size:13px;margin-bottom:0">Jusqu'à ${PIECES_DEVINE_JOUR} 🪙 à gagner par jour aux Devinettes${S.devineJour?.d === today() ? ` (déjà ${S.devineJour.pieces} aujourd'hui)` : ""}.</p></section>`;
    $$("[data-cat]", v).forEach((b) => b.onclick = () => { devine.cat = b.dataset.cat; aller("devine"); });
    $$("[data-mode]", v).forEach((b) => b.onclick = () => { devine.mode = b.dataset.mode; aller("devine"); });
    brancherLiens(v);
    blocDevineJour($("#dvJour"));
    if (devine.defiCode) blocDefiDevine($("#dvDefi"));
    v.querySelector(".dv-choix").insertAdjacentHTML("afterend", `<details class="panel dv-succes" id="dvSucces"></details>`); blocSuccesDevine($("#dvSucces"));
    $("#dvDefier").onclick = async () => {
      if (typeof connecte !== "function" || !connecte()) return toast("Connectez-vous pour défier vos amis.");
      try {
        const d = await api("devine-defi", { methode: "POST", corps: { cat: devine.cat } });
        devine.defiCode = d.code; partagerDefiDevine(d.code); aller("devine");
      } catch (e) { toast("⚠ " + e.message); }
    };
    $("#dvGo").onclick = () => {
      devine.partie = { cat: devine.cat, mode: devine.mode, n: 0, score: 0, bonnes: 0, serie: 0, deja: new Set(), fin: devine.mode === "chrono" ? Date.now() + DUREE_CHRONO * 1000 : 0, q: null, indice: 1 };
      aller("devine");
    };
    return;
  }
  const finie = p.mode === "classique" ? p.n >= QUESTIONS_DEVINE : Date.now() >= p.fin;
  if (finie && p.defi) {
    // Fin d'un défi entre amis : le score est envoyé, puis on montre le classement du défi
    devine.partie = null; devine.defiCode = p.defi.code; finPartieDevine(p);
    if (!p.envoye) { p.envoye = true; api(`devine-defi/${p.defi.code}/score`, { methode: "POST", corps: { score: p.score, bonnes: p.bonnes } }).then(() => { toast(`Défi terminé : ${p.score} points !`); if (S.vue === "devine") aller("devine"); }).catch((e) => toast("⚠ " + e.message)); }
    aller("devine"); return;
  }
  if (finie) {
    finPartieDevine(p);
    const cle = `${p.mode}:${p.cat}`, rec = (S.devineRecords ||= {}), record = p.score > (rec[cle] || 0);
    if (record) rec[cle] = p.score;
    sauver();
    v.innerHTML = `<section class="panel dv-fin"><div style="font-size:52px;color:var(--accent)">${record ? "🏆" : "🧠"}</div><h2>${p.score} points${record ? " · nouveau record !" : ""}</h2>
      <p>${p.bonnes} bonne${p.bonnes > 1 ? "s" : ""} réponse${p.bonnes > 1 ? "s" : ""} sur ${p.n} · ${CATS_DEVINE.find((x) => x[0] === p.cat)[2]} · ${p.mode === "chrono" ? "Contre la montre" : "Classique"}</p>
      <p class="muted">Record : ${rec[cle] || p.score} points</p>
      <div class="row" style="justify-content:center"><button class="btn primary" id="dvRejouer">Rejouer</button><button class="btn" id="dvMenu">Changer de catégorie</button>
      <button class="btn" id="dvPartager">📤 Partager</button></div></section>`;
    $("#dvRejouer").onclick = () => { devine.partie = { cat: p.cat, mode: p.mode, n: 0, score: 0, bonnes: 0, serie: 0, deja: new Set(), fin: p.mode === "chrono" ? Date.now() + DUREE_CHRONO * 1000 : 0, q: null, indice: 1 }; aller("devine"); };
    $("#dvMenu").onclick = () => { devine.partie = null; aller("devine"); };
    $("#dvPartager").onclick = () => { const t = `🧠 Play2F1 · Devinettes ${CATS_DEVINE.find((x) => x[0] === p.cat)[2]} : ${p.score} points (${p.bonnes}/${p.n})\nhttps://play2f1.com/#devine`; (navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t).then(() => toast("📋 Copié !"))).catch(() => {}); };
    return;
  }
  if (!p.q) { p.q = p.defi ? questionDefi(p) : questionDevine(p.cat, p.deja); p.indice = p.mode === "chrono" ? 2 : 1; p.deja.add(p.q.c.id); }
  const { c, choix } = p.q, indices = indicesDevine(c);
  const points = p.mode === "chrono" ? 2 : [0, 3, 2, 1][p.indice];
  v.innerHTML = `<section class="panel dv-jeu">
      <div class="dv-tete"><span>${CATS_DEVINE.find((x) => x[0] === p.cat)[1]} ${p.mode === "chrono" ? `<b class="dv-chrono" id="dvChrono">${Math.ceil((p.fin - Date.now()) / 1000)} s</b>` : `Question ${p.n + 1}/${QUESTIONS_DEVINE}`}</span>
        <span>Score <b>${p.score}</b>${p.serie >= 3 ? ` · 🔥 ${p.serie}` : ""}</span></div>
      <div class="dv-indices">${indices.slice(0, p.indice).map((h, i) => `<div class="dv-indice"><small>Indice ${i + 1}</small>${h}</div>`).join("")}</div>
      ${p.mode === "classique" && p.indice < 3 ? `<button class="lien-chances" id="dvIndice">💡 Indice suivant (la réponse vaudra ${[0, 3, 2, 1][p.indice + 1]} point${p.indice + 1 < 3 ? "s" : ""})</button>` : ""}
      <div class="answers dv-reps">${choix.map((x) => `<button data-rep="${esc(x.id)}">${esc(x.nom)}</button>`).join("")}</div>
      <div id="dvFb" class="feedback"></div>
      <button class="lien-chances" id="dvQuitter">Arrêter la partie</button></section>`;
  $("#dvIndice")?.addEventListener("click", () => { p.indice++; aller("devine"); });
  $("#dvQuitter").onclick = () => { if (p.mode === "chrono") p.fin = 0; else p.n = QUESTIONS_DEVINE; p.q = null; aller("devine"); };
  if (p.mode === "chrono") {
    const t = setInterval(() => { const el = $("#dvChrono"); if (!el || devine.partie !== p) { clearInterval(t); return; } const s = Math.ceil((p.fin - Date.now()) / 1000); el.textContent = `${Math.max(0, s)} s`; if (s <= 0) { clearInterval(t); p.q = null; aller("devine"); } }, 250);
  }
  $$("[data-rep]", v).forEach((b) => b.onclick = () => {
    const bon = b.dataset.rep === c.id;
    $$("[data-rep]", v).forEach((x) => { x.disabled = true; if (x.dataset.rep === c.id) x.classList.add("good"); });
    if (!bon) b.classList.add("bad");
    p.n++;
    let gain = 0;
    if (bon) { p.bonnes++; p.serie++; const pts = points + (p.serie >= 3 ? 1 : 0); p.score += pts; gain = piecesDevine(pts * 4); gagnerXP?.(2); statsDevine(c, p); }
    else p.serie = 0;
    majCoins(); sauver();
    $("#dvFb").innerHTML = `${p.mode === "classique" ? imgDevine(c, "dv-photo dv-photo-rep") : ""}<p style="font-weight:700;margin:6px 0">${bon ? `✅ Bravo ! +${points + (p.serie >= 3 ? 1 : 0)} pt${gain ? ` · +${gain} 🪙` : ""}` : `❌ C'était <b>${esc(c.nom)}</b>`}</p>${!bon || p.mode === "classique" ? `<p class="muted" style="margin:4px 0">${esc(c.anecdote || "")}</p>` : ""}
      ${COMPTE.admin ? `<button class="lien-chances" id="dvModifier">Modifier cette devinette (admin)</button>` : ""}
      ${p.mode === "classique" ? `<button class="btn primary" id="dvSuite">${p.n >= QUESTIONS_DEVINE ? "Voir le résultat" : "Question suivante →"}</button>` : ""}`;
    p.q = null;
    if (p.mode === "chrono") setTimeout(() => { if (devine.partie === p && S.vue === "devine") aller("devine"); }, bon ? 450 : 1100);
    else { $("#dvSuite").onclick = () => aller("devine"); $("#dvSuite").focus(); }
    $("#dvModifier")?.addEventListener("click", () => c.banque ? editerDevinette(c) : choisirPhotoCarte(c));
  });
}
ajouterPage("devine", "🧠", "Devinettes", vueDevine);
if (typeof GROUPES_PLUS !== "undefined") GROUPES_PLUS[0][1].splice(1, 0, "devine");
// Le quiz du jour propose aussi les Devinettes (illimitées, par catégorie)
const _vueQuizV7 = vueQuiz;
vueQuiz = function (v) {
  const r = _vueQuizV7.apply(this, arguments);
  v.insertAdjacentHTML("afterbegin", `<button class="panel dv-pub" id="dvPub"><span>🧠</span><div><b>Nouveau : les Devinettes</b><small class="muted">Choisissez la catégorie (pays, villes, plats, animaux…) et jouez sans limite, en classique ou contre la montre.</small></div><span class="btn primary small">Jouer</span></button>`);
  $("#dvPub").onclick = () => aller("devine");
  return r;
};
const _vueAccueilV7b = vueAccueil;
vueAccueil = function (v) {
  const r = _vueAccueilV7b.apply(this, arguments);
  if ($("#tuileExpress", v) && !$("#tuileDevine", v)) {
    $("#tuileExpress", v).insertAdjacentHTML("afterend", `<button class="tuile" id="tuileDevine"><span class="t-ic">🧠</span><span class="t-txt"><b>Devinettes</b><small>Pays, villes, plats… au choix</small></span></button>`);
    $("#tuileDevine").onclick = () => aller("devine");
  }
  return r;
};

/* ---------- Admin : modifier les devinettes, leurs images, en créer ---------- */
const devineAdmin = { cat: "pays", q: "" };
function vueDevineAdmin(v) {
  if (!COMPTE.admin) return aller("devine");
  if (!BANQUE_DEVINE) { v.innerHTML = `<p class="muted" style="padding:40px;text-align:center">Chargement…</p>`; chargerBanqueDevine().then(() => S.vue === "devine-admin" && aller("devine-admin")); return; }
  const q = sansAccents(devineAdmin.q), liste = banqueDevine(devineAdmin.cat, true).filter((x) => !q || sansAccents(x.nom + " " + x.indices.join(" ")).includes(q));
  v.innerHTML = `<header class="page-tete"><h1>Devinettes · admin</h1><p>Changez une image (envoi de votre fichier ou autre article Wikipédia), corrigez les textes, masquez ou créez des devinettes. Les changements sont visibles par tous les joueurs.</p></header>
    <section class="panel">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select id="daCat">${CATS_DEVINE.filter(([k]) => k !== "tout").map(([k, , n]) => `<option value="${k}" ${devineAdmin.cat === k ? "selected" : ""}>${n} (${banqueDevine(k, true).length})</option>`).join("")}</select>
        <input id="daQ" placeholder="Chercher une réponse ou un indice" value="${esc(devineAdmin.q)}" style="flex:1;min-width:180px">
        <button class="btn primary" id="daNouv">+ Nouvelle devinette</button></div>
      <p class="muted" style="font-size:13px">${liste.length} devinette${liste.length > 1 ? "s" : ""}</p>
      <div class="da-liste">${liste.map((c) => { const u = imageDevine(c); return `<button class="da-ligne ${c.masque ? "masquee" : ""}" data-da="${esc(c.id)}">
        <span class="da-img">${u ? `<img src="${esc(u)}" alt="" loading="lazy" ${u.startsWith("/api/devine/image") ? `data-wiki="${esc(c.wiki || c.nom)}" ` : ""}onerror="secoursImage(this)">` : ""}</span>
        <span class="da-txt"><b>${esc(c.nom)}</b><small class="muted">${esc(c.indices[0])}</small></span>
        <span class="da-tags">${c.creee ? `<i class="da-tag">créée</i>` : c.modifiee ? `<i class="da-tag">modifiée</i>` : ""}${c.img ? `<i class="da-tag">image perso</i>` : ""}${c.masque ? `<i class="da-tag">masquée</i>` : ""}</span></button>`; }).join("")}</div>
    </section>`;
  $("#daCat").onchange = (e) => { devineAdmin.cat = e.target.value; aller("devine-admin"); };
  let t; $("#daQ").oninput = (e) => { devineAdmin.q = e.target.value; clearTimeout(t); t = setTimeout(() => { aller("devine-admin"); const i = $("#daQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); };
  $("#daNouv").onclick = () => editerDevinette({ id: `dvp:${devineAdmin.cat}:${Date.now().toString(36)}`, nom: "", leurres: ["", "", ""], indices: ["", "", ""], anecdote: "", banque: devineAdmin.cat, wiki: "", img: 0, creee: true, nouvelle: true });
  $$("[data-da]", v).forEach((b) => b.onclick = () => editerDevinette(liste.find((x) => x.id === b.dataset.da)));
}
function editerDevinette(c) {
  let image = null; // null = inchangée, "" = retirée, data:… = nouvelle
  const apercu = () => { const u = image ? image : image === "" ? (c.sansImage ? "" : `/api/devine/image?t=${encodeURIComponent($("#deWiki")?.value || c.nom)}`) : imageDevine({ ...c, wiki: $("#deWiki")?.value ?? c.wiki, sansImage: $("#deSans")?.checked ?? c.sansImage }); return u ? `<span class="de-apercu-img"><img src="${esc(u)}" alt="" ${u.startsWith("/api/devine/image") ? `data-wiki="${esc($("#deWiki")?.value || c.wiki || c.nom)}" ` : ""}onerror="secoursImage(this)"></span>` : `<p class="muted">Pas d'image</p>`; };
  ouvrirModal(`<h2 style="margin-top:0">${c.nouvelle ? "Nouvelle devinette" : "Modifier la devinette"}</h2>
    <div class="de-form">
      <label>Catégorie<select id="deCat" ${c.nouvelle ? "" : "disabled"}>${CATS_BANQUE.map((k) => `<option value="${k}" ${c.banque === k ? "selected" : ""}>${CATS_DEVINE.find((x) => x[0] === k)[2]}</option>`).join("")}</select></label>
      <label>Bonne réponse<input id="deRep" value="${esc(c.nom)}" maxlength="80"></label>
      ${[0, 1, 2].map((i) => `<label>Mauvaise réponse ${i + 1}<input class="deFaux" value="${esc(c.leurres[i] || "")}" maxlength="80"></label>`).join("")}
      ${[0, 1, 2].map((i) => `<label>Indice ${i + 1} ${["(difficile)", "(moyen)", "(facile)"][i]}<textarea class="deInd" rows="2" maxlength="200">${esc(c.indices[i] || "")}</textarea></label>`).join("")}
      <label>Explication (affichée après la réponse)<textarea id="deExpl" rows="2" maxlength="300">${esc(c.anecdote || "")}</textarea></label>
      <h3 style="margin:10px 0 4px">Image</h3>
      <div class="de-apercu" id="deApercu">${apercu()}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <label class="btn primary small" style="cursor:pointer">Envoyer une image<input type="file" id="deFichier" accept="image/*" hidden></label>
        ${c.img ? `<button class="btn small" id="deRetirer">Retirer mon image</button>` : ""}</div>
      <label>Ou titre de l'article Wikipédia à utiliser<input id="deWiki" value="${esc(c.wiki || "")}" placeholder="${esc(c.nom || "Ex. : Tour Eiffel")}"></label>
      <label class="de-coche"><input type="checkbox" id="deSans" ${c.sansImage ? "checked" : ""}> Pas d'image pour cette devinette</label>
      <label class="de-coche"><input type="checkbox" id="deMasque" ${c.masque ? "checked" : ""}> Masquer cette devinette (plus posée aux joueurs)</label>
    </div>
    <p class="err" id="deErr"></p>
    <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
      ${c.modifiee || c.creee && !c.nouvelle ? `<button class="btn" id="deReset">${c.creee ? "Supprimer" : "Revenir à l'original"}</button>` : "<span></span>"}
      <span class="row" style="gap:8px"><button class="btn" id="deAnnuler">Annuler</button><button class="btn primary" id="deOk">Enregistrer</button></span></div>`);
  const maj = () => { $("#deApercu").innerHTML = apercu(); };
  let tw; $("#deWiki").oninput = () => { clearTimeout(tw); tw = setTimeout(maj, 600); };
  $("#deSans").onchange = maj;
  $("#deFichier").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { image = await preparerVisuel(f, true); maj(); } catch (err) { $("#deErr").textContent = err.message; } };
  $("#deRetirer")?.addEventListener("click", () => { image = ""; c.img = 0; maj(); });
  $("#deAnnuler").onclick = fermerModal;
  const url = (id) => "admin/devinettes/" + id.replaceAll(":", "~");
  const fini = async (msg) => { await chargerBanqueDevine(true); fermerModal(); toast(msg); if (S.vue === "devine-admin") aller("devine-admin"); };
  $("#deReset")?.addEventListener("click", async () => {
    if (!confirm(c.creee ? "Supprimer cette devinette ?" : "Annuler toutes vos modifications sur cette devinette ?")) return;
    try { await api(url(c.id), { methode: "DELETE" }); await fini(c.creee ? "Devinette supprimée." : "Devinette d'origine rétablie."); } catch (err) { $("#deErr").textContent = err.message; }
  });
  $("#deOk").onclick = async () => {
    const d = [$("#deRep").value.trim(), $$(".deFaux").map((x) => x.value.trim()), $$(".deInd").map((x) => x.value.trim()), $("#deExpl").value.trim()];
    const cat = $("#deCat").value, id = c.nouvelle ? c.id.replace(/^dvp:[a-z]+:/, `dvp:${cat}:`) : c.id;
    // On n'envoie le texte que s'il a changé (sinon la devinette suit les mises à jour de la banque)
    const orig = !c.creee && BANQUE_DEVINE[c.banque]?.[Number(c.id.split(":")[2])];
    const texteChange = !orig || JSON.stringify(d) !== JSON.stringify([orig[0], orig[1], orig[2], orig[3] || ""]);
    $("#deOk").disabled = true;
    try {
      await api(url(id), { methode: "PUT", corps: { cat, donnees: texteChange ? d : null, image, wiki: $("#deWiki").value.trim(), sansImage: $("#deSans").checked, masque: $("#deMasque").checked } });
      await fini("Devinette enregistrée pour tous les joueurs.");
    } catch (err) { $("#deErr").textContent = err.message; $("#deOk").disabled = false; }
  };
}
ajouterPage("devine-admin", "🧠", "Devinettes · admin", vueDevineAdmin);
// Page réservée à l'admin : pas dans le menu Plus ni la recherche
{ const i = DESTINATIONS.findIndex((d) => d[0] === "devine-admin"); if (i >= 0) DESTINATIONS.splice(i, 1); }

/* ---------- Devinette du jour ---------- */
const lireLocal = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const ecrireLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
async function blocDevineJour(el) {
  if (!el) return;
  const co = typeof connecte === "function" && connecte(), cleAnon = "worldcards:devine-jour";
  let anon = lireLocal(cleAnon, {});
  let d;
  try { d = await api(`devine-jour${co ? "" : `?n=${anon.n || 1}`}`); } catch (e) { el.innerHTML = ""; return; }
  if (!co) { if (anon.jour !== d.jour) anon = { jour: d.jour, n: 1 }; if (anon.fini) Object.assign(d, { fini: true, juste: anon.juste, maReponse: anon.reponse, solution: anon.solution }); }
  const rendre = () => {
    const cat = CATS_DEVINE.find((x) => x[0] === d.cat), c = (BANQUE_DEVINE && banqueDevine(d.cat, true).find((x) => x.id === d.id)) || { id: d.id, banque: d.cat, nom: d.solution?.reponse || "" };
    const n = d.nIndices, pieces = d.recompenses[n];
    el.innerHTML = `<section class="panel dv-jour"><div class="dv-jour-tete"><div><small class="muted">Même devinette pour tout le monde · nouvelle chaque jour</small><h3 style="margin:2px 0">Devinette du jour n° ${d.numero}</h3></div><span class="pill-cat">${cat ? cat[1] + " " + cat[2] : ""}</span></div>
      <div class="dv-indices">${d.indices.map((t, i) => `<div class="dv-indice"><small>Indice ${i + 1}</small><p class="dv-texte">${esc(t)}</p></div>`).join("")}</div>
      ${d.fini ? `<div class="dv-jour-fin ${d.juste ? "ok" : "ko"}">${imgDevine(c)}<p style="font-weight:700;margin:8px 0 2px">${d.juste ? `✅ Trouvée avec ${n} indice${n > 1 ? "s" : ""} !` : `❌ C'était <b>${esc(d.solution.reponse)}</b>`}${d.recompense ? ` · +${d.recompense} 🪙` : ""}</p>
          <p class="muted" style="margin:2px 0 8px">${esc(d.solution.explication || "")}</p>
          <button class="btn small" id="djPartager">📤 Partager mon résultat</button></div>`
      : `${n < 3 ? `<button class="lien-chances" id="djIndice">💡 Voir l'indice suivant (la bonne réponse rapportera ${d.recompenses[n + 1]} 🪙 au lieu de ${pieces})</button>` : ""}
        <div class="answers dv-reps">${d.choix.map((x) => `<button data-dj="${esc(x)}">${esc(x)}</button>`).join("")}</div>
        <p class="muted" style="font-size:12.5px;margin:6px 0 0">Une seule réponse possible${co ? ` · ${pieces} 🪙 si vous trouvez maintenant` : " · connectez-vous pour gagner des pièces et entrer au classement"}.</p>`}
      ${d.top.length ? `<details class="dv-top"><summary>Classement du jour · ${d.gagnants || 0} trouvé${d.gagnants > 1 ? "s" : ""} sur ${d.joueurs} joueur${d.joueurs > 1 ? "s" : ""}</summary><ol>${d.top.map((t) => `<li><b>${esc(t.pseudo)}</b> <span class="muted">· ${t.indices} indice${t.indices > 1 ? "s" : ""}</span></li>`).join("")}</ol></details>` : ""}
    </section>`;
    $("#djIndice", el)?.addEventListener("click", async () => {
      try {
        if (co) d = await api("devine-jour/indice", { methode: "POST", corps: {} });
        else { anon.n = Math.min(3, (anon.n || 1) + 1); ecrireLocal(cleAnon, anon); d = await api(`devine-jour?n=${anon.n}`); }
        rendre();
      } catch (e) { toast("⚠ " + e.message); }
    });
    $$("[data-dj]", el).forEach((b) => b.onclick = async () => {
      $$("[data-dj]", el).forEach((x) => x.disabled = true);
      try {
        const r = await api("devine-jour/reponse", { methode: "POST", corps: { reponse: b.dataset.dj } });
        if (co) { d = r; if (r.recompense && typeof verifierCadeaux === "function") verifierCadeaux(); }
        else { Object.assign(d, { fini: true, juste: r.juste, maReponse: b.dataset.dj, solution: r.solution }); Object.assign(anon, { fini: true, juste: r.juste, reponse: b.dataset.dj, solution: r.solution }); ecrireLocal(cleAnon, anon); }
        if (d.juste) { navigator.vibrate?.([30, 50, 80]); if (typeof son === "function") son("niveau"); }
        rendre();
      } catch (e) { toast("⚠ " + e.message); $$("[data-dj]", el).forEach((x) => x.disabled = false); }
    });
    $("#djPartager", el)?.addEventListener("click", () => {
      const cases = [1, 2, 3].map((i) => d.juste && i <= d.nIndices ? (i === d.nIndices ? "🟩" : "🟨") : d.juste ? "⬜" : "🟥").join("");
      const t = `Play2F1 · Devinette du jour n° ${d.numero}\n${d.juste ? `Trouvée avec ${d.nIndices} indice${d.nIndices > 1 ? "s" : ""}` : "Ratée…"} ${cases}\nhttps://play2f1.com/#devine`;
      (navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t).then(() => toast("Copié !"))).catch(() => {});
    });
  };
  rendre();
}

/* ---------- Défi Devinettes entre amis ---------- */
function partagerDefiDevine(code) {
  const t = `Je te défie aux Devinettes de Play2F1 ! Même série de 10 questions : fais mieux que moi.\nhttps://play2f1.com/#devine?defi=${code}`;
  (navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t).then(() => toast("Lien du défi copié : envoyez-le à vos amis !"))).catch(() => {});
}
function questionDefi(p) {
  const id = p.defi.ids[p.n], tous = banqueDevine("tout", true), c = tous.find((x) => x.id === id) || pick(tous);
  const rng = COMBAT.rng(COMBAT.hash(p.defi.code + id)), choix = [c, ...c.leurres.map((n) => ({ id: "f:" + n, nom: n }))];
  for (let i = choix.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [choix[i], choix[j]] = [choix[j], choix[i]]; }
  return { c, choix };
}
async function blocDefiDevine(el) {
  if (!el) return;
  try {
    const d = await api(`devine-defi/${devine.defiCode}`), cat = CATS_DEVINE.find((x) => x[0] === d.cat);
    el.innerHTML = `<section class="panel dv-defi"><div class="dv-jour-tete"><div><small class="muted">Défi lancé par ${esc(d.createur)}</small><h3 style="margin:2px 0">Défi Devinettes · ${cat ? cat[2] : ""}</h3></div><button class="btn small" id="dfFermer">Fermer</button></div>
      <p class="muted" style="margin:4px 0 10px">10 devinettes, les mêmes pour tout le monde. Le meilleur score gagne.</p>
      ${d.scores.length ? `<ol class="dv-classement">${d.scores.map((x) => `<li class="${x.moi ? "moi" : ""}"><b>${esc(x.pseudo)}</b><span>${x.score} pts · ${x.bonnes}/10</span></li>`).join("")}</ol>` : `<p class="muted">Personne n'a encore joué : à vous de lancer le score !</p>`}
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">${d.dejaJoue ? "" : `<button class="btn primary" id="dfJouer">Relever le défi</button>`}<button class="btn" id="dfPartager">📤 Inviter des amis</button></div></section>`;
    $("#dfFermer", el).onclick = () => { devine.defiCode = null; el.innerHTML = ""; };
    $("#dfPartager", el).onclick = () => partagerDefiDevine(d.code);
    $("#dfJouer", el)?.addEventListener("click", () => {
      if (typeof connecte !== "function" || !connecte()) return toast("Connectez-vous pour relever le défi.");
      devine.partie = { cat: d.cat, mode: "classique", n: 0, score: 0, bonnes: 0, serie: 0, deja: new Set(), fin: 0, q: null, indice: 1, defi: { code: d.code, ids: d.ids } };
      aller("devine");
    });
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; devine.defiCode = null; }
}
// Lien partagé : /#devine?defi=CODE
function lienDefiDevine(apresDemarrage) {
  const m = /^#devine\?defi=([a-z0-9]{5})$/.exec(location.hash);
  if (!m) return;
  devine.defiCode = m[1]; devine.partie = null;
  history.replaceState(null, "", location.pathname + (apresDemarrage ? "" : "#devine"));
  if (apresDemarrage) aller("devine");
}
lienDefiDevine(false);
addEventListener("hashchange", () => lienDefiDevine(true));

/* ---------- Succès Devinettes ---------- */
const NOMS_CATS_DEVINE = Object.fromEntries(CATS_DEVINE.map(([k, , n]) => [k, n]));
const SUCCES_DEVINE = [
  ["total10", "Premiers pas", "10 bonnes réponses", (st) => [st.total, 10], 100],
  ["total100", "Curieux", "100 bonnes réponses", (st) => [st.total, 100], 300],
  ["total500", "Encyclopédie vivante", "500 bonnes réponses", (st) => [st.total, 500], 1000],
  ["serie10", "Sur sa lancée", "10 bonnes réponses de suite", (st) => [st.serieMax, 10], 200],
  ["serie20", "Inarrêtable", "20 bonnes réponses de suite", (st) => [st.serieMax, 20], 500],
  ["parfait", "Sans faute", "10/10 en mode classique", (st) => [st.parfait, 1], 300],
  ["chrono15", "Éclair", "15 bonnes réponses contre la montre", (st) => [st.chronoMax, 15], 300],
  ...CATS_BANQUE.map((k) => [`cat-${k}`, `Expert : ${NOMS_CATS_DEVINE[k]}`, `25 bonnes réponses en ${NOMS_CATS_DEVINE[k]}`, (st) => [st.cats[k] || 0, 25], 200]),
];
const statsDevineDe = () => (S.devineStats ||= { total: 0, serieMax: 0, parfait: 0, chronoMax: 0, cats: {} });
function statsDevine(c, p) {
  const st = statsDevineDe(), k = c.banque || c.type;
  st.total++; st.cats[k] = (st.cats[k] || 0) + 1; st.serieMax = Math.max(st.serieMax, p.serie);
  const avant = SUCCES_DEVINE.filter(([cle, , , f]) => !(S.devineSucces || {})[cle] && f(st)[0] >= f(st)[1]).map((x) => x[0]);
  for (const cle of avant) if (!(st.annonces ||= []).includes(cle)) { st.annonces.push(cle); const x = SUCCES_DEVINE.find((y) => y[0] === cle); setTimeout(() => toast(`Succès débloqué : ${x[1]} ! Récupérez ${x[4]} 🪙 sur la page Devinettes.`, 5000), 900); }
}
function finPartieDevine(p) {
  const st = statsDevineDe();
  if (p.mode === "classique" && p.n >= QUESTIONS_DEVINE && p.bonnes === QUESTIONS_DEVINE) st.parfait = 1;
  if (p.mode === "chrono") st.chronoMax = Math.max(st.chronoMax, p.bonnes);
  sauver();
}
function blocSuccesDevine(el) {
  if (!el) return;
  const st = statsDevineDe(), pris = S.devineSucces || {};
  const prets = SUCCES_DEVINE.filter(([k, , , f]) => !pris[k] && f(st)[0] >= f(st)[1]).length, faits = SUCCES_DEVINE.filter(([k]) => pris[k]).length;
  el.innerHTML = `<summary><b>Succès Devinettes</b> <span class="muted">· ${faits}/${SUCCES_DEVINE.length}</span>${prets ? ` <span class="pill">${prets} à récupérer</span>` : ""}</summary>
    <div class="dv-succes-grille">${SUCCES_DEVINE.map(([k, nom, desc, f, pieces]) => { const [v, max] = f(st), ok = v >= max; return `<div class="dv-sc ${pris[k] ? "fait" : ok ? "pret" : ""}">
      <b>${esc(nom)}</b><small class="muted">${esc(desc)} · ${pieces} 🪙</small>
      <div class="dv-barre"><i style="width:${Math.min(100, Math.round(v / max * 100))}%"></i></div>
      ${pris[k] ? `<small class="sc-ok">✓ Récupéré</small>` : ok ? `<button class="btn primary small" data-dsc="${k}">Récupérer</button>` : `<small class="muted">${Math.min(v, max)} / ${max}</small>`}</div>`; }).join("")}</div>`;
  if (prets) el.open = true;
  $$("[data-dsc]", el).forEach((b) => b.onclick = () => {
    const x = SUCCES_DEVINE.find((y) => y[0] === b.dataset.dsc), [v, max] = x[3](statsDevineDe());
    if ((S.devineSucces ||= {})[x[0]] || v < max) return;
    S.devineSucces[x[0]] = true; S.coins += x[4]; sauver(); majCoins();
    toast(`${x[1]} : +${x[4]} 🪙`); blocSuccesDevine(el); el.open = true;
  });
}

/* ---------- Admin : surveillance de l'économie (pièces) ---------- */
async function adminEconomie(el) {
  el.innerHTML = "Chargement…";
  try {
    const d = await api("admin/economie"), j = d.jours, auj = j[0] || {}, hier = j[1];
    const delta = hier ? auj.total - hier.total : 0, noms = ["moins de 1 000", "1 000 à 5 000", "5 000 à 20 000", "20 000 à 100 000", "plus de 100 000"];
    const maxT = Math.max(1, ...j.map((x) => x.total));
    el.innerHTML = `<div class="eco-chiffres">
        <div class="panel"><small class="muted">Pièces en circulation</small><b>${fmt(auj.total || 0)}</b><small class="${delta > 0 ? "eco-hausse" : ""}">${hier ? `${delta >= 0 ? "+" : ""}${fmt(delta)} depuis hier` : "premier relevé"}</small></div>
        <div class="panel"><small class="muted">Moyenne par joueur</small><b>${fmt(auj.moyenne || 0)}</b><small class="muted">${fmt(auj.joueurs || 0)} comptes · ${fmt(auj.actifs || 0)} actifs (7 j)</small></div>
        <div class="panel"><small class="muted">Distribuées aujourd'hui par le serveur</small><b>${fmt(auj.distribues || 0)}</b><small class="muted">défis, cadeaux, récompenses</small></div></div>
      <h3>Pièces en circulation, 30 derniers jours</h3>
      <div class="eco-graphe">${j.slice().reverse().map((x) => `<div title="${x.jour} : ${fmt(x.total)} pièces · ${fmt(x.distribues)} distribuées"><i style="height:${Math.max(2, Math.round(x.total / maxT * 100))}%"></i><small>${x.jour.slice(8)}</small></div>`).join("")}</div>
      <div class="eco-deux"><div><h3>Répartition des joueurs</h3>${noms.map((n, i) => `<div class="codex-ligne"><span>${n}</span><b>${fmt(d.tranches.find((t) => t.t === i)?.n || 0)}</b></div>`).join("")}</div>
      <div><h3>Plus riches</h3>${d.riches.map((r, i) => `<div class="codex-ligne"><span>${i + 1}. ${esc(r.pseudo)}</span><b>${fmt(r.pieces || 0)}</b></div>`).join("")}</div></div>
      <h3>Sources des pièces distribuées (7 jours)</h3>${d.sources.length ? d.sources.map((x) => `<div class="codex-ligne"><span>${esc(x.source)}…</span><span><b>${fmt(x.pieces)}</b> <small class="muted">(${x.n} fois)</small></span></div>`).join("") : `<p class="muted">Rien pour l'instant.</p>`}
      <p class="muted" style="font-size:12.5px">Les pièces gagnées dans les mini-jeux sont comptées dans la sauvegarde des joueurs (« en circulation ») ; la liste ci-dessus ne montre que ce que le serveur distribue lui-même. Un relevé est fait chaque heure.</p>`;
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
